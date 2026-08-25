<template>
  <!-- Con URL cargada: el reproductor real, con controles y sonido. Sin autoplay
       ni loop: son varios minutos y el lead lo mira, no lo ojea. -->
  <video
    v-if="url"
    ref="video"
    class="demo-pieza-media"
    :src="url"
    controls
    playsinline
    @loadedmetadata="on_loadedmetadata"
    @timeupdate="on_timeupdate"
    @seeking="on_seeking"
    @pause="on_pause"
    @ended="on_ended"
    @error="on_error"
  />

  <!-- Sin URL: mismo placeholder de marca que el resto de las piezas, con las
       proporciones que va a tener el video real (el tamaño lo fija MarcoDispositivo).
       Mientras la pieza no esté cargada el gate del intro no aplica -- eso lo
       decide el backend, no este componente. -->
  <div v-else class="demo-pieza-placeholder">
    <span class="demo-pieza-placeholder__titulo">{{ titulo }}</span>
    <span class="demo-pieza-placeholder__badge">Sin cargar</span>
  </div>
</template>

<script>
/**
 * Cuánto se espera a que el video dé señales de vida antes de dar por hecho que no va a
 * cargar y liberar el ingreso. Generoso a propósito: un lead con la conexión mala tiene
 * que poder mirarlo. Si carga después, no se pierde nada — el lead lo mira igual, sólo
 * que el botón ya estaba habilitado.
 */
const ESPERA_CARGA_MS = 45000

/** Cuántas veces se reintenta el reporte que libera el ingreso, incluido el primero. */
const REINTENTOS_LIBERACION = 4

/** Cuánto se espera entre reintentos de ese reporte. */
const ESPERA_REINTENTO_MS = 8000

/**
 * Velocidad a la que arranca el video si la configurada no llegó o no sirve. Es la que estuvo
 * hardcodeada acá hasta que se volvió configurable: el default no cambia nada.
 */
const VELOCIDAD_FALLBACK = 1.5

/**
 * Reproductor del video de introducción de la página inmersiva (misión 46, pieza 4).
 *
 * 🔴 POR QUÉ ES UN COMPONENTE APARTE Y NO UN MODO MÁS DE PiezaMultimedia: esa pieza la
 * comparten los ~15 clips en loop del scroll de dolor. Meterle acá el tracking, el
 * clamp del adelantado y el reporte al backend la ensuciaría para todos, y el día que
 * alguien toque el loop de los clips tendría que entender también el gate del ingreso.
 * Este video no es un clip: es la puerta.
 *
 * Lo que hace, y por qué cada cosa:
 *
 * - Arranca a la velocidad configurada en el panel (intro.velocidad, 1.5 por defecto), UNA sola
 *   vez (al `loadedmetadata`). Si el lead la cambia desde los controles nativos no se le pelea:
 *   es su decisión.
 * - No se puede adelantar. Se lleva `max_visto` (el mayor `currentTime` alcanzado
 *   reproduciendo) y en `seeking` se lo devuelve si intentó saltar hacia adelante.
 *   Atrasar, pausar y volumen quedan intactos: lo que se impide es saltearse el
 *   contenido, no navegarlo.
 * - Reporta el progreso al backend, que es quien decide si el botón se habilita. El
 *   reporte es monótono también de este lado (nunca manda un pct menor al último
 *   enviado), aunque el endpoint tampoco baja el valor guardado: los dos extremos, para
 *   que un reporte que llegue tarde por la red no pise al bueno.
 */
export default {
  name: 'VideoIntro',

  props: {
    /** URL del video; vacía = todavía no se cargó la pieza y se muestra el placeholder. */
    url: {
      type: String,
      default: '',
    },
    /** Título del slot, para el placeholder. */
    titulo: {
      type: String,
      default: 'Video de introducción',
    },
    /**
     * Porcentaje ya guardado en el backend para este lead. El progreso PERSISTE entre
     * visitas: el lead que mira el intro hoy y tiene el turno mañana no lo vuelve a
     * mirar, así que `max_visto` arranca donde quedó y no en cero.
     */
    visto_pct: {
      type: Number,
      default: 0,
    },
    /**
     * Velocidad de reproducción inicial, configurable desde el panel y servida por el payload
     * público (`intro.velocidad`). Se aplica UNA sola vez: si el lead la cambia desde los controles
     * nativos, no se le pelea.
     */
    velocidad: {
      type: Number,
      default: VELOCIDAD_FALLBACK,
    },
    /**
     * Función inyectada por el contenedor que hace el POST del progreso. Firma:
     * reportar(pct) -> Promise. Mismo patrón que `enviar_formulario` e `ingresar`: este
     * componente no conoce el uuid ni el cliente HTTP.
     */
    reportar: {
      type: Function,
      default: function () {
        return Promise.resolve({})
      },
    },
  },

  data() {
    return {
      /** Mayor segundo alcanzado reproduciendo. El clamp del adelantado se mide contra esto. */
      max_visto: 0,
      /** Último porcentaje efectivamente enviado al backend; nunca se manda uno menor. */
      ultimo_reportado: 0,
      /** Marca de tiempo (ms) del último envío, para el throttle de 5 segundos. */
      ultimo_envio_ms: 0,
      /** true una vez fijada la velocidad: no se vuelve a tocar aunque el lead la cambie. */
      velocidad_fijada: false,
      /** Handle del timeout que libera el gate si el video nunca llega a cargar. */
      timeout_carga_id: null,
      /** Handle del reintento del reporte de liberación, cuando el primero falla. */
      reintento_liberacion_id: null,
      /** true una vez liberado el gate por un video que no carga: se hace una sola vez. */
      liberado_por_fallo: false,
    }
  },

  created() {
    /* El progreso guardado es el piso de esta sesión. Sin esto, un lead que ya había
       visto el 95% volvería a arrancar de cero y el reporte monótono del backend haría
       que no pasara nada -- pero acá el clamp del adelantado lo dejaría trabado sin
       poder saltar a donde ya había llegado. */
    this.ultimo_reportado = Number(this.visto_pct) || 0
  },

  mounted() {
    /* 🔴 Válvula de escape por reloj, y no es defensiva de más: sin esto, un video que no
       carga deja al lead afuera de su demo PARA SIEMPRE, y si lo que se rompe es la URL
       del catálogo, le pasa a todos los leads a la vez. El backend sólo verifica que haya
       una URL cargada, no que el archivo exista: un 404, un codec que ese navegador no
       soporta, CORS o mixed content dan el mismo resultado -- `loadedmetadata` no dispara
       nunca, la duración no se puede calcular, el porcentaje se queda en 0, y `ended`
       -que es la otra salida- tampoco llega jamás.
       El criterio es el mismo que el de "sin URL cargada el intro no es obligatorio":
       ante un video que no se puede mirar, se libera el ingreso. Fallar hacia "el lead no
       hace su demo" es el peor de los dos errores posibles.
       Cubre además el caso en que el video SÍ carga pero su `duration` no sirve para
       calcular nada (Infinity en un stream, NaN con metadata rota): por eso la condición
       del callback es "¿hay duración válida?" y no "¿llegó loadedmetadata?". */
    this.armar_valvula()
  },

  watch: {
    /**
     * La URL puede aparecer con el componente ya montado: el video se graba después del
     * merge y el contenedor refresca `media` en cada tick del poleo. Sin esto, ese caso se
     * quedaba sin válvula — sólo lo cubría `@error`, que agarra un 404 o un codec no
     * soportado pero no un servidor que abre la conexión y no manda nada.
     *
     * @param {string} nueva
     * @returns {void}
     */
    url(nueva) {
      if (nueva) {
        this.armar_valvula()
      }
    },
  },

  beforeUnmount() {
    if (this.timeout_carga_id) {
      window.clearTimeout(this.timeout_carga_id)
      this.timeout_carga_id = null
    }
    if (this.reintento_liberacion_id) {
      window.clearTimeout(this.reintento_liberacion_id)
      this.reintento_liberacion_id = null
    }

    /* Último reporte al salir: si el lead cierra la pestaña a mitad, lo que vio hasta
       acá no se pierde. Es best-effort -- si la request no llega a salir, el peor caso
       es que la próxima visita arranque desde el último reporte periódico. */
    this.reportar_progreso(this.pct_actual(), true)
  },

  methods: {
    /**
     * Arma (una sola vez) el reloj que libera el ingreso si el video no llega a estar en
     * condiciones de ser mirado. Idempotente y sin URL no hace nada.
     *
     * @returns {void}
     */
    armar_valvula() {
      if (!this.url || this.timeout_carga_id || this.liberado_por_fallo) {
        return
      }

      const self = this
      this.timeout_carga_id = window.setTimeout(function () {
        self.timeout_carga_id = null
        const video = self.$refs.video
        /* Si para este momento hay duración utilizable, el video se puede mirar y no hay
           nada que liberar. La condición es "¿hay duración válida?" y no "¿cargó?": una
           duración Infinity o NaN carga igual y deja el porcentaje trabado en 0. */
        if (video && self.duracion_valida(video) !== null) {
          return
        }
        self.liberar_por_fallo('el video no cargó dentro del tiempo esperado')
      }, ESPERA_CARGA_MS)
    },

    /**
     * Fija la velocidad de reproducción y ubica el cursor donde el lead había quedado.
     *
     * @returns {void}
     */
    on_loadedmetadata() {
      const video = this.$refs.video
      if (!video) {
        return
      }

      /* 🔴 La válvula de escape NO se cancela acá aunque el video haya dado señales de
         vida. `loadedmetadata` puede llegar con una `duration` inútil —Infinity en un
         stream, NaN con metadata rota—, y en ese caso el porcentaje no se puede calcular
         nunca: el lead quedaría trabado igual, que es exactamente el defecto que la
         válvula viene a cerrar. El callback ya decide solo: si para entonces hay duración
         válida, no libera nada. */
      if (!this.velocidad_fijada) {
        video.playbackRate = this.velocidad_efectiva()
        this.velocidad_fijada = true
      }

      /* Retoma desde donde quedó (el progreso vive en el backend, no en el navegador).
         Se calcula sobre la duración real: lo que se guarda es un porcentaje. */
      const duracion = this.duracion_valida(video)
      if (duracion !== null && this.ultimo_reportado > 0 && this.ultimo_reportado < 100) {
        this.max_visto = (this.ultimo_reportado / 100) * duracion
        video.currentTime = this.max_visto
      }
    },

    /**
     * Avanza `max_visto` y reporta cada 5 segundos de reproducción.
     *
     * @returns {void}
     */
    on_timeupdate() {
      const video = this.$refs.video
      if (!video) {
        return
      }

      if (video.currentTime > this.max_visto) {
        this.max_visto = video.currentTime
      }

      const ahora = Date.now()
      if (ahora - this.ultimo_envio_ms < 5000) {
        return
      }
      this.ultimo_envio_ms = ahora
      this.reportar_progreso(this.pct_actual(), false)
    },

    /**
     * Impide adelantar. El margen de 0.5s no es cosmético: el navegador dispara `seeking`
     * con saltos de fracciones de segundo durante la reproducción normal (buffering,
     * cambios de pista), y sin margen el video se trabaría solo.
     *
     * 🔴 SIN FLAG DE REENTRADA, y las dos versiones que lo tenían eran peores. Asignar
     * `currentTime` actualiza la posición de forma sincrónica, así que el `seeking` que
     * dispara esa misma corrección llega con `currentTime === max_visto` y no cumple la
     * condición: la reentrada se corta sola, por la comparación, sin necesidad de estado.
     * Un flag, en cambio, abre una ventana donde los `seeking` que lleguen mientras está
     * arriba pasan SIN clamp — y con un arrastre continuo de la barra eso es justo lo que
     * pasa: corregir un salto puede tardar de 100ms a 2s si el destino no está
     * buffereado, el lead sigue arrastrando, y el navegador termina honrando la posición
     * nueva. Lo detectó la fase de verificación de la misión 46, midiendo que la variante
     * con `seeked` dejaba una ventana MÁS grande que la de `setTimeout(0)`.
     *
     * @returns {void}
     */
    on_seeking() {
      const video = this.$refs.video
      if (!video) {
        return
      }

      if (video.currentTime > this.max_visto + 0.5) {
        video.currentTime = this.max_visto
      }
    },

    /**
     * El medio falló (404, codec no soportado, CORS, mixed content). Se libera el ingreso:
     * ver el comentario largo del `mounted()`.
     *
     * @returns {void}
     */
    on_error() {
      this.liberar_por_fallo('el video no se pudo cargar')
    },

    /**
     * Libera el gate reportando 100 cuando el video no se puede mirar. Una sola vez.
     *
     * @param {string} motivo Para el log; el lead no ve nada de esto.
     * @returns {void}
     */
    liberar_por_fallo(motivo) {
      if (this.liberado_por_fallo) {
        return
      }
      this.liberado_por_fallo = true

      if (this.timeout_carga_id) {
        window.clearTimeout(this.timeout_carga_id)
        this.timeout_carga_id = null
      }

      console.warn('[demo-experiencia] intro liberado sin verse: ' + motivo)
      this.reportar_liberacion(1)
    },

    /**
     * Manda el 100 de la liberación, reintentando si no sale.
     *
     * 🔴 El reintento no es de más: lo más probable que rompa el video es justamente una
     * red caída, o sea la misma que puede voltear este POST. Sin reintentar, el lead se
     * queda esperando un botón que ya se le tendría que haber habilitado, y la única
     * salida sería que recargue la página — que es lo último que se le ocurre a alguien
     * que está mirando un cartel que dice "esperá".
     *
     * @param {number} intento Número de intento, arrancando en 1.
     * @returns {void}
     */
    reportar_liberacion(intento) {
      const self = this

      self
        .reportar(100)
        .then(function () {
          self.ultimo_reportado = 100
        })
        .catch(function () {
          if (intento >= REINTENTOS_LIBERACION) {
            return
          }
          self.reintento_liberacion_id = window.setTimeout(function () {
            self.reintento_liberacion_id = null
            self.reportar_liberacion(intento + 1)
          }, ESPERA_REINTENTO_MS)
        })
    },

    /**
     * Reporta al pausar, sin throttle: es un momento donde el lead deja de mirar y puede
     * ser el último dato que tengamos de esta sesión.
     *
     * @returns {void}
     */
    on_pause() {
      this.reportar_progreso(this.pct_actual(), true)
    },

    /**
     * Al terminar reporta 100 SIN mirar el cálculo. Es el borde que importa: con una
     * `duration` inválida o infinita (streams, metadata rota) el porcentaje no se puede
     * computar, `pct_actual()` devolvería 0 y el lead quedaría trabado afuera de su demo
     * habiendo mirado el video entero.
     *
     * @returns {void}
     */
    on_ended() {
      this.reportar_progreso(100, true)
    },

    /**
     * Porcentaje visto según el mayor segundo alcanzado.
     *
     * @returns {number} 0..100; 0 si la duración no es utilizable todavía.
     */
    pct_actual() {
      const video = this.$refs.video
      const duracion = video ? this.duracion_valida(video) : null
      if (duracion === null) {
        return 0
      }
      const pct = Math.round((this.max_visto / duracion) * 100)
      return Math.max(0, Math.min(100, pct))
    },

    /**
     * @param {HTMLMediaElement} video
     * @returns {number|null} La duración en segundos, o null si no sirve para calcular.
     */
    duracion_valida(video) {
      const duracion = Number(video.duration)
      if (!isFinite(duracion) || isNaN(duracion) || duracion <= 0) {
        return null
      }
      return duracion
    },

    /**
     * La velocidad a aplicar, con red por si el valor configurado no sirve.
     *
     * 🔴 El guard no es defensivo de más: `playbackRate = 0` deja el video en marcha pero sin
     * avanzar nunca, y con el gate del intro eso es un lead trabado afuera de su demo — el mismo
     * defecto que la válvula del `mounted()` viene a cerrar, por otra puerta. Un negativo tira
     * `NotSupportedError` en varios navegadores y corta el handler entero. Sólo se cae al fallback
     * en esos casos: el rango lo fija el backend, y NO se lo vuelve a acotar acá para no tener dos
     * reglas para el mismo número.
     *
     * @returns {number}
     */
    velocidad_efectiva() {
      const valor = Number(this.velocidad)
      if (!isFinite(valor) || valor <= 0) {
        return VELOCIDAD_FALLBACK
      }
      return valor
    },

    /**
     * Manda el progreso al backend si aporta algo.
     *
     * @param {number} pct Porcentaje a reportar.
     * @param {boolean} forzar true para saltear el throttle (pause, ended, desmontaje).
     * @returns {void}
     */
    reportar_progreso(pct, forzar) {
      const self = this
      const valor = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)))

      /* Nunca hacia atrás: el endpoint tampoco baja el valor guardado, pero mandarlo
         igual sería pedirle al backend que resuelva algo que acá ya se sabe. */
      if (valor <= self.ultimo_reportado) {
        return
      }

      self.ultimo_reportado = valor
      if (forzar) {
        self.ultimo_envio_ms = Date.now()
      }

      self
        .reportar(valor)
        .catch(function () {
          /* Silencioso a propósito: el progreso del video no es una acción del lead y un
             cartel de error acá sería ruido. Si el reporte falla, el siguiente tick lo
             vuelve a intentar con un pct mayor. Se retrocede `ultimo_reportado` para que
             ese reintento no lo filtre la guarda de arriba. */
          self.ultimo_reportado = valor - 1
        })
    },
  },
}
</script>
