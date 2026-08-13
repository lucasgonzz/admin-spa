<template>
  <!-- Sin turno asignado: no se muestra ningún bloque (tabla de estados,
       demo_pagina.md §4 + contexto/demo_experiencia.md §3.14). La condición sale de
       estados-turno.js y no está escrita acá porque ExperienciaDemo.vue necesita la
       misma respuesta para saber si achicarle el sitio al video: ver el comentario
       de ese módulo. -->
  <section v-if="muestra_bloque" class="demo-boton-acceso">
    <!-- a) Se puede entrar: botón activo. La decisión NO es de este componente ni
         del reloj del navegador -- es `puede_ingresar`, que calcula el backend
         (misión 46, pieza 3). Antes esto dependía de `estado === 'activo'`, así
         que un lead con la demo lista y el video visto tenía que esperar a la
         hora en punto. El clic dispara el ingreso real (grupo 233 del lado de
         empresa-api/empresa-spa). -->
    <div v-if="puede_ingresar" class="demo-boton-acceso__bloque">
      <button
        type="button"
        class="demo-boton-acceso__boton"
        :disabled="cargando"
        @click="on_click"
      >
        {{ cargando ? 'Entrando…' : 'Entrar a mi demo' }}
      </button>
      <p v-if="turno.hora_fin" class="demo-boton-acceso__nota">
        <em>Reservada hasta las {{ turno.hora_fin }}.</em>
      </p>
      <p v-if="mensaje_error" class="demo-boton-acceso__error">{{ mensaje_error }}</p>
    </div>

    <!-- b) Vencido, con la demo ya hecha (turno.ingreso === true). Tono amable,
         nada de urgencia fabricada. Texto de demo_pagina.md §4 c). Va antes que
         los bloques de preparación: a un turno vencido no lo arregla mirar el
         video. -->
    <div v-else-if="estado === 'vencido' && turno.ingreso" class="demo-boton-acceso__bloque">
      <p class="demo-boton-acceso__titulo"><strong>Tu turno terminó.</strong></p>
      <p class="demo-boton-acceso__nota">
        Si querés volver a recorrerla, escribinos y te reservamos otro.
      </p>
    </div>

    <!-- c) Vencido, sin haber entrado nunca. El más delicado: ese lead sigue
         siendo recuperable, la instancia no es escasa (§3.16 D). Texto de
         demo_pagina.md §4 d). -->
    <div v-else-if="estado === 'vencido'" class="demo-boton-acceso__bloque">
      <p class="demo-boton-acceso__titulo"><strong>Tu turno venció.</strong></p>
      <p class="demo-boton-acceso__nota">
        Escribinos y coordinamos uno nuevo cuando te quede cómodo.
      </p>
    </div>

    <!-- d) El armado de la instancia falló. Es el único caso donde el lead no
         puede hacer nada por su cuenta, así que el texto lo manda a WhatsApp.
         Copy de la misión 46, pieza 3: se transcribe, no se reescribe. -->
    <div v-else-if="setup_fallido" class="demo-boton-acceso__bloque">
      <p class="demo-boton-acceso__titulo"><strong>Se nos complicó preparar tu demo.</strong></p>
      <p class="demo-boton-acceso__nota">
        Escribinos por WhatsApp y la dejamos lista en un momento.
      </p>
    </div>

    <!-- e) Falta terminar el video de introducción. Va ANTES del bloque de
         "preparando" a propósito: mirar el video es lo único accionable, y
         mientras tanto la demo se está armando sola por debajo. -->
    <div v-else-if="intro_pendiente" class="demo-boton-acceso__bloque">
      <p class="demo-boton-acceso__titulo"><strong>Mirá el video hasta el final.</strong></p>
      <p class="demo-boton-acceso__nota">
        El botón para entrar se te habilita cuando termine.
      </p>
    </div>

    <!-- f) Turno para más adelante y el armado todavía ni arrancó: hora
         reservada + cuenta regresiva + recordatorio de entrar desde una
         computadora. Texto de demo_pagina.md §4 a). -->
    <div v-else-if="estado === 'antes' && setup_estado === 'pendiente'" class="demo-boton-acceso__bloque">
      <p class="demo-boton-acceso__titulo">
        <strong>Tu demo está reservada para las {{ turno.hora_inicio }}.</strong>
      </p>
      <p v-if="cuenta_regresiva_texto" class="demo-boton-acceso__regresiva">
        {{ cuenta_regresiva_texto }}
      </p>
      <p class="demo-boton-acceso__nota">
        <em>Entrá desde una computadora: vas a usar el sistema con tus manos.</em>
      </p>
    </div>

    <!-- g) La instancia se está armando (o está por hacerlo) y el video ya no es
         un obstáculo. Copy de la misión 46, pieza 3. -->
    <div v-else class="demo-boton-acceso__bloque">
      <p class="demo-boton-acceso__titulo"><strong>Estamos preparando tu demo.</strong></p>
      <p class="demo-boton-acceso__nota">
        En un momento se habilita el ingreso.
      </p>
    </div>
  </section>
</template>

<script>
import { hay_bloque_de_turno } from './estados-turno'

/**
 * Botón de acceso a la demo (Grupo 300 · pagina-inmersiva-demo, prompt 05).
 * Siete bloques excluyentes, con los textos de contexto/demo_pagina.md §4 y de
 * la misión 46 -- se transcriben, no se reescriben.
 *
 * 🔴 QUIÉN DECIDE QUE SE PUEDE ENTRAR (misión 46, pieza 3): el flag
 * `puede_ingresar` del payload, y sólo él. Lo calcula el backend en un único
 * lugar (DemoExperienciaController::evaluar_ingreso) juntando tres cosas: que
 * el demo setup haya terminado bien, que el turno no esté vencido, y que el
 * lead haya visto el video de introducción (salvo en entorno local o si todavía
 * no hay video cargado). Este componente NO lo deriva ni lo recalcula: si lo
 * hiciera habría dos reglas para la misma puerta, y la del navegador sería la
 * fácil de saltear.
 *
 * Hasta la misión 46 la puerta era `turno.estado === 'activo'`, o sea el reloj.
 * Los demás campos del turno se siguen usando igual para los textos: la cuenta
 * regresiva del estado "antes" y los dos casos de vencido. La cuenta regresiva
 * es lo único que mira el reloj del cliente, y al llegar a cero no habilita
 * nada por su cuenta: vuelve a pedir el payload (`refrescar`) y usa lo que
 * responda.
 */
export default {
  name: 'BotonAcceso',

  props: {
    /** { fecha, hora_inicio, hora_fin, estado, ingreso } del turno, tal como llega del payload. */
    turno: {
      type: Object,
      default: function () {
        return {}
      },
    },
    /**
     * `puede_ingresar` del payload: lo calcula el backend y es lo único que
     * habilita el botón. Default false -- mientras el payload no llegó, la
     * puerta está cerrada.
     */
    puede_ingresar: {
      type: Boolean,
      default: false,
    },
    /** { estado } del demo setup: pendiente | ejecutandose | exitoso | fallido. */
    setup: {
      type: Object,
      default: function () {
        return {}
      },
    },
    /** { visto_pct, umbral_pct, obligatorio } del video de introducción. */
    intro: {
      type: Object,
      default: function () {
        return {}
      },
    },
    /**
     * Función inyectada por el contenedor (ExperienciaDemo.vue) que vuelve a
     * pedir el payload completo al backend -- se usa cuando la cuenta
     * regresiva local llega a cero, para que el estado real (que puede
     * cambiar por gracia post-turno, etc.) lo siga dictando siempre el
     * servidor. Firma: refrescar() -> void.
     */
    refrescar: {
      type: Function,
      default: function () {},
    },
    /**
     * Función inyectada por el contenedor (ExperienciaDemo.vue) que hace el
     * POST real de ingreso (prompt 01 de este grupo). Firma: ingresar() ->
     * Promise. Se resuelve con `{ url }` en éxito; se rechaza (error de
     * axios) si el turno no está activo, el token no es válido, o falla la
     * red -- este componente lee `error.response.data.motivo` para elegir
     * qué hacer en cada caso.
     */
    ingresar: {
      type: Function,
      default: function () {
        return Promise.resolve({})
      },
    },
  },

  data() {
    return {
      /** Reloj local, solo para la cuenta regresiva visual. Se actualiza cada minuto. */
      ahora: new Date(),
      /** Id del setInterval que actualiza `ahora`, para poder limpiarlo al desmontar. */
      interval_id: null,
      /**
       * true una vez que ya se disparó `refrescar()` para el turno actual, para
       * no reintentar en cada tick mientras el backend todavía no actualizó el
       * estado. Se resetea cada vez que cambia el prop `turno` (ver watch).
       */
      ya_refresco: false,
      /** true mientras el POST de ingreso está en vuelo: evita doble clic. */
      cargando: false,
      /** Mensaje sobrio de error del último intento de ingreso; vacío si no hay error. */
      mensaje_error: '',
    }
  },

  computed: {
    /**
     * Estado del turno tal como lo decide el backend. 'sin_turno' si el prop
     * todavía no llegó o no trae estado.
     *
     * @returns {string}
     */
    estado() {
      return (this.turno && this.turno.estado) || 'sin_turno'
    },

    /**
     * true si este componente tiene algo que mostrar. Un estado de turno que el backend
     * agregue mañana y que los `v-else-if` de arriba no contemplen cae acá en false:
     * mejor no mostrar nada que una caja vacía (y que el contenedor le achique el video
     * para hacerle lugar). La excepción es `puede_ingresar`: si el backend dice que se
     * puede entrar, el botón existe pase lo que pase con el estado.
     *
     * @returns {boolean}
     */
    muestra_bloque() {
      return hay_bloque_de_turno(this.turno, this.puede_ingresar)
    },

    /**
     * Estado del demo setup. 'pendiente' si el payload todavía no llegó o no lo trae.
     *
     * @returns {string}
     */
    setup_estado() {
      return (this.setup && this.setup.estado) || 'pendiente'
    },

    /**
     * @returns {boolean} true si el armado de la instancia falló.
     */
    setup_fallido() {
      return this.setup_estado === 'fallido'
    },

    /**
     * true cuando lo que le falta al lead es terminar el video. No es una segunda
     * versión de la regla del backend: `puede_ingresar` ya decidió que no se puede
     * entrar, y esto sólo elige QUÉ texto mostrarle. Si el video no es obligatorio
     * (no hay URL cargada, o entorno de prueba) nunca es este el motivo.
     *
     * @returns {boolean}
     */
    intro_pendiente() {
      if (!this.intro || !this.intro.obligatorio) {
        return false
      }
      return Number(this.intro.visto_pct || 0) < Number(this.intro.umbral_pct || 0)
    },

    /**
     * Fecha/hora de inicio del turno como objeto Date, fijada en la zona
     * horaria de referencia del backend (America/Argentina/Buenos_Aires,
     * offset fijo -03:00 -- el país no aplica horario de verano). Se arma
     * así, con el offset explícito en el ISO string, y no con
     * `new Date(fecha + ' ' + hora)`, para no depender de la zona horaria
     * del navegador del lead. Null si falta fecha u hora.
     *
     * @returns {Date|null}
     */
    fecha_hora_inicio() {
      if (!this.turno || !this.turno.fecha || !this.turno.hora_inicio) {
        return null
      }
      const iso = this.turno.fecha + 'T' + this.turno.hora_inicio + ':00-03:00'
      const parsed = new Date(iso)
      return isNaN(parsed.getTime()) ? null : parsed
    },

    /**
     * Milisegundos restantes hasta el inicio del turno, según el reloj local
     * (`ahora`). Null si no se pudo calcular `fecha_hora_inicio`.
     *
     * @returns {number|null}
     */
    milisegundos_restantes() {
      if (!this.fecha_hora_inicio) {
        return null
      }
      return this.fecha_hora_inicio.getTime() - this.ahora.getTime()
    },

    /**
     * Texto de la cuenta regresiva ("Faltan 2 h 14 min" / "Faltan 14 min"),
     * solo para el estado "antes". Cadena vacía si no se pudo calcular.
     *
     * @returns {string}
     */
    cuenta_regresiva_texto() {
      const ms = this.milisegundos_restantes
      if (ms === null) {
        return ''
      }
      const total_minutos = Math.max(0, Math.floor(ms / 60000))
      const horas = Math.floor(total_minutos / 60)
      const minutos = total_minutos % 60
      if (horas > 0) {
        return 'Faltan ' + horas + ' h ' + minutos + ' min'
      }
      return 'Faltan ' + minutos + ' min'
    },
  },

  watch: {
    /**
     * Cuando el contenedor refresca `turno` (por ejemplo, después de que este
     * mismo componente pidió el refresco al llegar la cuenta a cero), se
     * habilita de nuevo la posibilidad de disparar `refrescar()` si hiciera
     * falta otra vez más adelante.
     */
    turno: {
      deep: true,
      handler: function () {
        this.ya_refresco = false

        // 🔴 Con un POST de ingreso en vuelo no se toca nada (corregido en la
        // verificación de la misión 46). Desde que existe el poleo, este watcher
        // corre cada 10 segundos —y en cada reporte de progreso del video—,
        // porque el contenedor asigna un objeto `turno` nuevo cada vez. Limpiar
        // `cargando` acá anulaba la guarda de doble clic justo mientras el lead
        // esperaba la redirección, y le borraba el mensaje de error a los pocos
        // segundos de aparecer. El `catch` del propio ingreso ya apaga
        // `cargando`, así que este camino no hace falta para eso.
        if (this.cargando) {
          return
        }

        // 🔴 El mensaje de error tampoco se borra acá. El camino `preparando` lo
        // setea y pide un refresco dos líneas después, así que este watcher se lo
        // comía al volver el GET —el lead veía "probá de nuevo en un minuto" por
        // un instante y después nada—. El mensaje lo limpia `on_click` al empezar
        // el intento siguiente, que es cuando deja de ser cierto.
      },
    },
  },

  mounted() {
    /* Primer chequeo inmediato (por si la página se abre ya con la cuenta en
       cero) y luego un tick por minuto -- la cuenta regresiva "se actualiza
       sola cada minuto" (criterio de éxito 5 del prompt). */
    this.tick()
    this.interval_id = setInterval(this.tick, 60000)
  },

  beforeUnmount() {
    if (this.interval_id) {
      clearInterval(this.interval_id)
    }
  },

  methods: {
    /**
     * Refresca el reloj local y chequea si la cuenta regresiva llegó a cero.
     *
     * @returns {void}
     */
    tick: function () {
      this.ahora = new Date()
      this.verificar_vencimiento()
    },

    /**
     * Si el estado es "antes" y la cuenta regresiva local ya llegó a cero,
     * pide el payload de nuevo al backend en vez de habilitar el botón por
     * su cuenta -- el estado siempre lo dicta el servidor.
     *
     * @returns {void}
     */
    verificar_vencimiento: function () {
      if (this.estado !== 'antes' || this.ya_refresco) {
        return
      }
      const ms = this.milisegundos_restantes
      if (ms !== null && ms <= 0) {
        this.ya_refresco = true
        this.refrescar()
      }
    },

    /**
     * Maneja el clic en "Entrar a mi demo": dispara el ingreso real vía la
     * función `ingresar` inyectada por el contenedor y redirige en la MISMA
     * pestaña (nunca `window.open`: los bloqueadores de popups matan la
     * apertura en pestaña nueva cuando pasa medio segundo entre el clic y la
     * llamada). El estado del turno lo sigue decidiendo el backend -- este
     * método nunca lo recalcula, solo reacciona al `motivo` que devuelve.
     *
     * @returns {void}
     */
    on_click: function () {
      const self = this

      // Guarda contra doble clic rápido: mientras hay un POST en vuelo, un
      // segundo clic no dispara ni una segunda llamada ni una segunda
      // redirección (criterio de éxito 6).
      if (self.cargando) {
        return
      }

      self.cargando = true
      self.mensaje_error = ''

      self
        .ingresar()
        .then(function (data) {
          window.location.href = data.url
        })
        .catch(function (error) {
          const motivo =
            error && error.response && error.response.data && error.response.data.motivo

          // Se apaga siempre y acá: el watch de `turno` también lo hace, pero sólo si
          // el payload refrescado trae algo distinto -- y con los motivos nuevos
          // (misión 46) puede volver idéntico, dejando el botón en "Entrando…" para
          // siempre.
          self.cargando = false

          if (motivo === 'preparando') {
            self.mensaje_error = 'Estamos terminando de preparar tu demo. Probá de nuevo en un minuto.'
            self.refrescar()
            return
          }

          if (motivo === 'vencido' || motivo === 'intro_pendiente' || motivo === 'setup_fallido') {
            // El estado que tiene esta pantalla quedó viejo (pestaña abierta
            // desde hace rato): se pide el payload real al backend en vez de
            // reintroducir el reloj del navegador. Con el payload nuevo, el
            // bloque que corresponde se renderiza solo.
            self.refrescar()
            return
          }

          if (motivo === 'token_invalido') {
            self.mensaje_error = 'Este acceso ya no está disponible. Escribinos por WhatsApp y te lo reactivamos.'
            return
          }

          // sin_instancia, error de red, o 500: mensaje genérico sin detalles técnicos.
          self.mensaje_error = 'No pudimos abrir la demo. Probá de nuevo.'
        })
    },
  },
}
</script>

<style scoped>
.demo-boton-acceso {
  max-width: 480px;
  margin: 0 auto;
  padding: 0 20px 64px;
  text-align: center;
}

.demo-boton-acceso__bloque {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.demo-boton-acceso__titulo {
  font-size: 1.2rem;
  margin: 0;
}

.demo-boton-acceso__regresiva {
  font-size: clamp(1.4rem, 3vw, 1.8rem);
  font-weight: 700;
  background: var(--demo-gradient-marca);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin: 0;
}

.demo-boton-acceso__nota {
  color: var(--demo-color-texto-suave);
  font-size: 0.95rem;
  margin: 0;
}

.demo-boton-acceso__boton {
  min-height: 56px;
  min-width: 220px;
  padding: 14px 32px;
  border-radius: 14px;
  border: none;
  background: var(--demo-gradient-marca);
  color: #fff;
  font-family: inherit;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
}

.demo-boton-acceso__boton:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.demo-boton-acceso__error {
  color: #b3261e;
  font-size: 0.85rem;
  margin: 0;
}
</style>
