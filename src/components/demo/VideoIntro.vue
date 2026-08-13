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
 * - Arranca a 1.5x, UNA sola vez (al `loadedmetadata`). Si el lead lo cambia desde los
 *   controles nativos no se le pelea: es su decisión.
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
      /** true mientras se está devolviendo el cursor hacia atrás, para no reentrar en `seeking`. */
      corrigiendo_salto: false,
    }
  },

  created() {
    /* El progreso guardado es el piso de esta sesión. Sin esto, un lead que ya había
       visto el 95% volvería a arrancar de cero y el reporte monótono del backend haría
       que no pasara nada -- pero acá el clamp del adelantado lo dejaría trabado sin
       poder saltar a donde ya había llegado. */
    this.ultimo_reportado = Number(this.visto_pct) || 0
  },

  beforeUnmount() {
    /* Último reporte al salir: si el lead cierra la pestaña a mitad, lo que vio hasta
       acá no se pierde. Es best-effort -- si la request no llega a salir, el peor caso
       es que la próxima visita arranque desde el último reporte periódico. */
    this.reportar_progreso(this.pct_actual(), true)
  },

  methods: {
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

      if (!this.velocidad_fijada) {
        video.playbackRate = 1.5
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
     * @returns {void}
     */
    on_seeking() {
      const video = this.$refs.video
      if (!video || this.corrigiendo_salto) {
        return
      }

      if (video.currentTime > this.max_visto + 0.5) {
        this.corrigiendo_salto = true
        video.currentTime = this.max_visto
        /* El flag se limpia en el próximo tick del navegador: asignar currentTime dispara
           otro `seeking`, y sin esto la corrección se llamaría a sí misma. */
        const self = this
        window.setTimeout(function () {
          self.corrigiendo_salto = false
        }, 0)
      }
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
