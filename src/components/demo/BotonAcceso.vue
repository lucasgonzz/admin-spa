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
         un obstáculo. Copy de la misión 46, pieza 3, ahora con la espera CONTADA:
         el demo setup tarda ~9,4 minutos medidos contra un video de ~7, así que el
         lead que mira el video hasta el final llega acá y espera de verdad. Hasta
         hoy veía un cartel quieto -- y si el poleo se agotaba a los 20 minutos, lo
         seguía viendo para siempre.

         Las cuatro variantes salen de `espera_variante`. La que manda cuando el
         payload no trae los campos nuevos --o cuando no muestra ninguna corrida en
         vuelo-- es el texto de siempre: entre el merge y el deploy este front convive
         con la API vieja, y esa convivencia no puede verse rota ni tirar nada por
         consola. -->
    <div v-else class="demo-boton-acceso__bloque">
      <!-- g.1) Hay una corrida del armado en vuelo, ya pasada del estimado, Y encima
           el poleo se agotó: no va a llegar ningún payload nuevo, así que este texto
           es el último que el lead va a ver y tiene que darle una salida. Mismo tono
           que el bloque d) de setup fallido. Las tres condiciones van juntas a
           propósito: con el poleo agotado solo, este cartel le salía a un lead cuya
           demo se estaba armando perfecto (ver el docblock de `espera_variante`). -->
      <template v-if="espera_variante === 'agotada'">
        <p class="demo-boton-acceso__titulo"><strong>Se está demorando más de lo esperable.</strong></p>
        <p class="demo-boton-acceso__nota">
          Escribinos por WhatsApp y lo destrabamos.
        </p>
      </template>

      <!-- g.2) Se pasó del estimado pero el poleo sigue vivo. Se cambia el texto en
           vez de repetir "en un momento", que a los doce minutos ya suena a mentira. -->
      <template v-else-if="espera_variante === 'demorada'">
        <p class="demo-boton-acceso__titulo"><strong>Está tardando un poco más de lo normal.</strong></p>
        <p class="demo-boton-acceso__nota">
          En cuanto esté, el botón se habilita solo.
        </p>
      </template>

      <!-- g.3) Espera contada. La barra es lo que avanza cada 10 segundos, porque
           cada poleo trae un `iniciado_hace_seg` fresco; los minutos cambian una vez
           por minuto. 🔴 Acá NO hay ningún timer nuevo: el número es una función pura
           del payload, y el `setInterval` que existe en este componente es el de la
           cuenta regresiva del turno, que no se toca. -->
      <template v-else-if="espera_variante === 'contando'">
        <p class="demo-boton-acceso__titulo"><strong>Estamos preparando tu demo.</strong></p>
        <div class="demo-boton-acceso__barra" role="presentation">
          <div class="demo-boton-acceso__barra-avance" :style="{ width: espera_pct + '%' }"></div>
        </div>
        <p class="demo-boton-acceso__nota">{{ espera_restante_texto }}</p>
      </template>

      <!-- g.4) Default seguro: sin `iniciado_hace_seg` va el texto de siempre, sin
           contador y sin cuentas. Es el estado del front nuevo contra la API vieja. -->
      <template v-else>
        <p class="demo-boton-acceso__titulo"><strong>Estamos preparando tu demo.</strong></p>
        <p class="demo-boton-acceso__nota">
          En un momento se habilita el ingreso.
        </p>
      </template>
    </div>
  </section>
</template>

<script>
import { hay_bloque_de_turno } from './estados-turno'

/**
 * Cuánto se estima que tarda un demo setup, en segundos. Es el MISMO número que
 * `RunDemoSetupService::DURACION_ESTIMADA_SEGUNDOS` del admin-api, que es quien lo
 * manda en `setup.duracion_estimada_seg`. Acá vive sólo como red: si un payload
 * trajera `iniciado_hace_seg` sin la duración, la cuenta igual se puede hacer en
 * vez de mostrar una barra sin escala. No gobierna ninguna puerta -- la puerta es
 * `puede_ingresar` y la calcula el backend.
 */
const DURACION_ESTIMADA_FALLBACK_SEG = 600

/**
 * Botón de acceso a la demo (Grupo 300 · pagina-inmersiva-demo, prompt 05).
 * Siete bloques excluyentes, con los textos de contexto/demo_pagina.md §4 y de
 * la misión 46 -- se transcriben, no se reescriben. El último, el de "preparando",
 * tiene adentro cuatro variantes de espera (ver el comentario del bloque g).
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
    /**
     * { estado, iniciado_hace_seg, duracion_estimada_seg } del demo setup.
     *
     * `estado`: son CINCO, no cuatro -- pendiente | ejecutandose | sin_confirmar |
     * exitoso | fallido. `sin_confirmar` (RunDemoSetupService::ESTADO_SIN_CONFIRMAR)
     * es el que queda cuando la llamada a la instancia venció o volvió 409: el admin
     * dejó de escuchar y nadie sabe si la corrida sigue viva del otro lado. No es un
     * sinónimo de `fallido` y acá se trata como una corrida en vuelo (ver
     * `setup_corriendo`).
     *
     * `iniciado_hace_seg`: segundos desde que arrancó el armado, medidos por el
     * backend con SU reloj, o null si todavía no arrancó. 🔴 Sale de
     * `demo_setup_last_run_at`, que es la estampa del ÚLTIMO arranque y no se borra
     * cuando la corrida termina: viene con número también para un setup ya exitoso,
     * ya fallido, o vuelto a `pendiente` por el reintento automático (misión 60).
     * O sea que por sí solo NO prueba que haya algo armándose ahora -- quien lo
     * prueba es `estado`. Puede además no venir: una API anterior a la misión que
     * agregó el contador no lo manda, y ese caso es el default seguro del bloque g).
     *
     * `duracion_estimada_seg`: el estimado con el que se cuenta la espera.
     */
    setup: {
      type: Object,
      default: function () {
        return {}
      },
    },
    /**
     * true cuando el contenedor (ExperienciaDemo.vue) ya agotó el tope del poleo:
     * dejó de pedir el payload, así que esta pantalla no se va a actualizar sola
     * nunca más.
     *
     * 🔴 Dice SOLO eso: que la pantalla quedó quieta. NO dice que el armado se esté
     * demorando, y confundir las dos cosas es lo que este componente arregla. El
     * poleo arranca en cuanto el lead completa el formulario (`debe_polear` =
     * intro_desbloqueada && !puede_ingresar), que para un turno de más tarde puede
     * ser horas antes de que el setup exista siquiera: son dos relojes distintos.
     * La evidencia de la demora la pone el payload, no esta marca -- ver
     * `espera_variante`.
     */
    espera_agotada: {
      type: Boolean,
      default: false,
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
     * true cuando el payload muestra una corrida del armado ARRANCADA y todavía sin
     * desenlace. Son dos estados y no uno: `ejecutandose` es el caso normal, y
     * `sin_confirmar` es esa misma corrida con la llamada vencida (o con un 409 de la
     * instancia) -- el admin dejó de escuchar, pero del otro lado la demo puede estar
     * sembrándose en este mismo instante.
     *
     * `sin_confirmar` NO se lleva un texto propio, y es una decisión, no un olvido:
     * desde donde lo mira el lead es indistinguible de `ejecutandose` --hay algo
     * armándose, no hay nada que él pueda hacer, y se resuelve solo (el evento
     * `demo.setup.completado` o el comando que lo vence a `fallido`)--, así que le
     * corresponden los mismos textos de espera. Un cartel aparte solo podría contarle
     * una avería que ni siquiera sabemos que ocurrió, que es exactamente el error que
     * esta corrección vino a sacar de esta pantalla.
     *
     * @returns {boolean}
     */
    setup_corriendo() {
      return this.setup_estado === 'ejecutandose' || this.setup_estado === 'sin_confirmar'
    },

    /**
     * true cuando hay evidencia REAL de que el armado se está demorando: una corrida
     * en vuelo, con su edad medida por el backend, y esa edad ya pasada del estimado.
     * Es la única condición que habilita los dos textos de demora del bloque g), y
     * ninguna de las tres partes sobra: sin `setup_corriendo` la edad puede ser la de
     * una corrida que ya terminó, y sin la edad no hay con qué comparar.
     *
     * @returns {boolean}
     */
    armado_pasado_del_estimado() {
      const iniciado = this.setup_iniciado_hace_seg
      if (!this.setup_corriendo || iniciado === null) {
        return false
      }
      return iniciado >= this.setup_duracion_estimada_seg
    },

    /**
     * Segundos desde que arrancó el demo setup, tal como los manda el backend en
     * `setup.iniciado_hace_seg`, o null cuando no hay dato utilizable.
     *
     * 🔴 Null es un caso NORMAL, no un borde defensivo: el backend manda null
     * mientras el armado todavía no arrancó, y una API anterior a esta misión no
     * manda el campo en absoluto (es exactamente lo que pasa entre el merge y el
     * deploy). En los dos casos el bloque g) cae al texto de siempre.
     *
     * El número lo mide el servidor con su propio reloj: acá nunca se hace un
     * `Date.now()` para esto. El del navegador ya nos costó una puerta mal abierta
     * en la misión 46.
     *
     * @returns {number|null}
     */
    setup_iniciado_hace_seg() {
      const crudo = this.setup ? this.setup.iniciado_hace_seg : null
      if (crudo === null || crudo === undefined || crudo === '') {
        return null
      }
      const segundos = Number(crudo)
      if (!Number.isFinite(segundos) || segundos < 0) {
        return null
      }
      return segundos
    },

    /**
     * Cuánto se estima que dura el armado, en segundos. Lo manda el backend; si no
     * viene (o viene en cero, que dividiría por nada) se usa la red del módulo.
     *
     * @returns {number}
     */
    setup_duracion_estimada_seg() {
      const segundos = Number(this.setup ? this.setup.duracion_estimada_seg : null)
      if (!Number.isFinite(segundos) || segundos <= 0) {
        return DURACION_ESTIMADA_FALLBACK_SEG
      }
      return segundos
    },

    /**
     * Cuál de las cuatro variantes del bloque g) corresponde:
     *
     *  - 'sin_datos' no hay corrida en vuelo (o no vino su edad): texto de siempre,
     *                sin contador ni cuentas.
     *  - 'contando'  hay una corrida en vuelo y todavía está dentro del estimado.
     *  - 'demorada'  esa corrida ya se pasó del estimado, y la pantalla se sigue
     *                actualizando sola.
     *  - 'agotada'   lo mismo, pero además el poleo murió: este es el último cartel
     *                que el lead va a ver, así que tiene que darle una salida.
     *
     * 🔴 PRIMERO LA EVIDENCIA, DESPUÉS EL POLEO -- y el orden está invertido a
     * propósito respecto de como nació esto. Antes 'agotada' ganaba antes de mirar
     * nada, y `espera_agotada` no habla del armado: habla del poleo, que arranca
     * apenas el lead completa el formulario. Un lead que pedía la demo para las 18
     * y completaba el formulario a las 14 agotaba el poleo a las 14:22 sin que nada
     * se viera raro (mandaba el bloque f), el del turno reservado); a las 18:00 la
     * cuenta regresiva pedía el payload fresco, la pantalla caía a este bloque y le
     * afirmaba "se está demorando, escribinos por WhatsApp" teniendo en la mano un
     * setup arrancado hacía un minuto y andando bien. Y era el ÚLTIMO cartel que
     * veía, porque el poleo ya estaba muerto.
     *
     * Ahora los dos textos de demora exigen `armado_pasado_del_estimado`, que es
     * evidencia del payload y no del reloj de otra cosa. Ante cualquier duda -- sin
     * corrida en vuelo, sin edad, o edad dentro del estimado -- sale el mensaje
     * neutro, nunca el alarmista.
     *
     * @returns {string}
     */
    espera_variante() {
      const iniciado = this.setup_iniciado_hace_seg
      if (!this.setup_corriendo || iniciado === null) {
        return 'sin_datos'
      }
      if (this.armado_pasado_del_estimado) {
        return this.espera_agotada ? 'agotada' : 'demorada'
      }
      return 'contando'
    },

    /**
     * Ancho de la barra de avance, en porcentaje.
     *
     * Se topea en 95 a propósito: la barra NUNCA llega a 100. Llegar sería decir
     * "listo" desde el navegador, y quien dice listo es `puede_ingresar` -- cuando
     * eso pase, este bloque desaparece entero y aparece el botón. El piso de 5 es
     * para que a los diez segundos se vea que algo arrancó, en vez de una barra
     * vacía que se lee como rota.
     *
     * @returns {number}
     */
    espera_pct() {
      const iniciado = this.setup_iniciado_hace_seg
      if (iniciado === null) {
        return 0
      }
      const pct = (iniciado / this.setup_duracion_estimada_seg) * 100
      return Math.max(5, Math.min(95, Math.round(pct)))
    },

    /**
     * Los minutos que faltan, redondeados hacia arriba para no prometer de menos.
     * Cadena vacía si no hay dato (esa variante no muestra esta línea).
     *
     * @returns {string}
     */
    espera_restante_texto() {
      const iniciado = this.setup_iniciado_hace_seg
      if (iniciado === null) {
        return ''
      }
      const minutos = Math.max(1, Math.ceil((this.setup_duracion_estimada_seg - iniciado) / 60))
      if (minutos === 1) {
        return 'Falta alrededor de 1 min.'
      }
      return 'Faltan alrededor de ' + minutos + ' min.'
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

/* Barra de avance de la espera del armado. Es el único elemento de esta pantalla
   que se mueve solo, y se mueve porque cambia el ancho con cada poleo: la
   transición suaviza el salto de diez segundos para que se lea como avance y no
   como parpadeo. */
.demo-boton-acceso__barra {
  width: 100%;
  max-width: 260px;
  height: 6px;
  border-radius: 999px;
  background: rgba(28, 35, 51, 0.12);
  overflow: hidden;
}

.demo-boton-acceso__barra-avance {
  height: 100%;
  border-radius: 999px;
  background: var(--demo-gradient-marca);
  transition: width 0.6s ease;
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
