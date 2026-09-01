<template>
  <div v-if="lead && lead.id" class="card border-secondary border-opacity-25 mb-3 demo-roadmap-card">

    <!-- Encabezado: calca el del pipeline comercial de extra-props/Index.vue a propósito.
         Son la misma pregunta ("¿por dónde va esto?") sobre objetos distintos, y dos tarjetas
         parecidas pero no iguales en la misma pantalla se leen como un error. -->
    <div class="card-header d-flex align-items-center gap-2 bg-light py-2">
      <i class="bi bi-signpost-split text-secondary"></i>
      <span class="small fw-semibold">Recorrido de la demo</span>
      <!-- Badge de progreso. El denominador es el total de ESTE lead, no una constante: cada uno
           tiene el recorrido que le tocó según sus respuestas. -->
      <span v-if="tiene_plan" class="badge text-bg-secondary ms-auto small">{{ completos }}/{{ total }}</span>
    </div>

    <div class="card-body py-2">

      <!-- Carga inicial: spinner chico DENTRO del cuerpo, nunca reemplazando la tarjeta entera.
           Si reemplazara la tarjeta, la pantalla saltaría en cada tick del poleo. -->
      <div v-if="cargando_primera_vez" class="text-center py-3">
        <span class="spinner-border spinner-border-sm text-secondary"></span>
      </div>

      <!-- 🔴 No se pudo leer, y NUNCA se pudo: no se puede decir "este lead no completó el
           formulario", porque eso sería afirmar algo sobre el lead cuando lo que falló fue la
           consulta. Es el caso de la sesión vencida, que devuelve 401 en cada tick. -->
      <p v-else-if="!cargo_alguna_vez" class="small text-muted mb-0">
        <i class="bi bi-wifi-off me-1"></i>
        No se pudo leer el recorrido. Si el problema sigue, recargá la página.
      </p>

      <!-- Sin plan: una línea y nada más. Es el estado normal de casi todos los leads, así que no
           lleva spinner, ni tabla vacía, ni botón que invite a arreglar algo que no está roto. -->
      <p v-else-if="!tiene_plan" class="small text-muted mb-0">
        El recorrido se arma cuando el lead completa el formulario de la página.
      </p>

      <template v-else>
        <!-- Errores del catálogo. Es un typo del repo que se sincronizó a producción sin deploy:
             tiene que verlo Lucas, no morir en un log. -->
        <div v-if="condiciones_invalidas.length" class="alert alert-warning py-2 small mb-2">
          <i class="bi bi-exclamation-triangle me-1"></i>
          <span class="fw-semibold">El catálogo tiene condiciones que no se pudieron leer.</span>
          <div v-for="(mala, i) in condiciones_invalidas" :key="i" class="mt-1">
            {{ mala.tipo === 'seccion' ? 'Sección' : 'Clip' }} <code>{{ mala.id }}</code>:
            <code>{{ mala.condicion }}</code>
          </div>
        </div>

        <!-- Los hitos, en orden, agrupados por sección. -->
        <!-- La clave es el id de sección más su posición, no el índice solo: si el número de
             grupos cambia entre ticks, Vue reusaría nodos por posición. -->
        <div v-for="(grupo, gi) in grupos" :key="(grupo.id || 'ingreso') + '-' + gi">

          <!-- Separador de sección. El hito de ingreso va suelto arriba, sin encabezado. -->
          <div
            v-if="grupo.seccion"
            class="text-uppercase text-muted fw-semibold demo-roadmap-seccion mt-2 mb-1"
          >{{ grupo.seccion }}</div>

          <div
            v-for="hito in grupo.hitos"
            :key="hito.orden"
            class="demo-roadmap-hito py-2"
          >
            <div class="d-flex align-items-start gap-2">
              <!-- Ícono de estado. `parcial` NO usa semántica de error: no es una falla, es el
                   dato más útil de la pantalla (dice dónde se trabó el lead). -->
              <div class="flex-shrink-0 mt-1">
                <i v-if="hito.estado === 'completo'" class="bi bi-check-circle-fill text-success"></i>
                <i v-else-if="hito.estado === 'parcial'" class="bi bi-slash-circle demo-roadmap-parcial"></i>
                <i v-else class="bi bi-circle text-muted"></i>
              </div>

              <div class="flex-grow-1 min-width-0">
                <!-- El parcial usa `demo-roadmap-parcial` y no `text-warning` a secas: el
                     amarillo de Bootstrap sobre fondo blanco no llega a contraste AA, y
                     justamente éste es el estado que más se lee. Mismo criterio que
                     DemoExperienciaControl, que ya usa la variable de énfasis. -->
                <div
                  class="small fw-semibold demo-roadmap-titulo"
                  :class="{
                    'text-success':        hito.estado === 'completo',
                    'demo-roadmap-parcial': hito.estado === 'parcial',
                    'text-muted':          hito.estado === 'pendiente',
                  }"
                >{{ hito.titulo }}</div>

                <!-- 🔴 Detalle del recorrido: cuánto vio del video y cuánto hizo del tour.
                     Es lo que Lucas pidió el 1/9/2026 ("*quiero que cuando ya vio el video (...)
                     me aparezca la información de que lo vio y la información de si lo probó*").

                     Los chips los resuelve `chips_de()` y llegan acá ya armados desde la computed
                     `grupos`. La lista viene VACÍA cuando no hay nada que decir — incluido el caso
                     de un `admin-api` VIEJO, donde los cinco campos vienen `undefined` y acá no se
                     dibuja ni un chip vacío ni un "0%".
                     `flex-wrap` porque en el teléfono los dos chips no entran en una línea. -->
                <div v-if="hito.chips.length" class="d-flex flex-wrap gap-1 mt-1">
                  <span
                    v-for="chip in hito.chips"
                    :key="chip.clave"
                    class="badge fw-normal"
                    :class="chip.clase"
                  >
                    <i class="bi me-1" :class="chip.icono"></i>{{ chip.texto }}
                  </span>
                </div>

                <!-- Texto de apoyo: la hora en el completo, y en el parcial el porqué —que ahora
                     se deriva de los datos en vez de ser un texto fijo, ver `texto_del_parcial()`. -->
                <div v-if="hito.estado === 'completo' && hito.accion_hecha_at" class="small text-muted mt-1">
                  {{ hito.accion_hecha_at }}
                </div>
                <div v-else-if="hito.estado === 'parcial'" class="small text-muted mt-1">
                  {{ texto_del_parcial(hito) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Los datos siguen en pantalla pero son los del último tick bueno: se dice, en vez de
             mostrarlos como si fueran de ahora. -->
        <p v-if="hubo_error" class="small text-muted mb-0 mt-2">
          <i class="bi bi-arrow-clockwise me-1"></i>
          No se pudo actualizar; esto es lo último que se leyó.
        </p>

        <!-- Cuando el poleo llegó a su tope, se para y se ofrece el refresco a mano. -->
        <div v-if="poleo_agotado" class="mt-2">
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            :disabled="cargando"
            @click="reanudar_poleo"
          >
            <span v-if="cargando" class="spinner-border spinner-border-sm me-1"></span>
            Actualizar
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import api from '@/utils/axios'

/**
 * Recorrido de la demo de un lead: todos los hitos que le tocan, con los que ya hizo marcados
 * (misión 49, pieza 2).
 *
 * Es una tarjeta de SOLO LECTURA. No hay botón para marcar un hito a mano ni para re-resolver el
 * plan: el estado de un hito es el registro de lo que el lead efectivamente hizo, y si se pudiera
 * editar desde acá dejaría de serlo.
 *
 * Los tres estados y por qué son tres: `parcial` —vio el tutorial pero no hizo la acción— es el
 * que dice dónde se trabó el lead, que es de lo que el closer va a hablar en la llamada. Por eso
 * se pinta en `warning` y no en `danger`: no es una falla, es información.
 *
 * Desde el 1/9/2026 cada hito de tutorial lleva además dos badges —cuánto vio del video y cuánto
 * hizo del tour— que salen de cinco campos nuevos del endpoint. **Los tres estados no cambiaron**:
 * los badges van al costado del estado, no lo reemplazan. Ver `chips_de()`, que además explica por
 * qué no se dibuja nada cuando esos campos no vienen.
 *
 * Props:
 *   lead {Object} - Lead del que se muestra el recorrido. Requerido.
 */
export default {
  name: 'DemoRoadmap',

  props: {
    /**
     * Lead del que se pide el recorrido. Se observa por id: cambiar de lead sin desmontar el
     * componente tiene que reiniciar el poleo, no dejarlo apuntando al lead anterior.
     */
    lead: {
      type: Object,
      required: true,
    },
  },

  data() {
    return {
      // Payload del endpoint, tal cual llega.
      tiene_plan: false,
      condiciones_invalidas: [],
      completos: 0,
      total: 0,
      hitos: [],

      // Estado de la vista.
      cargando: false,
      cargando_primera_vez: true,
      // El último intento falló. No borra lo que está en pantalla: lo marca como viejo.
      hubo_error: false,
      // Alguna vez llegó una respuesta buena. Es lo que distingue "este lead no tiene plan" de
      // "todavía no pudimos preguntar", que sin esto se veían igual.
      cargo_alguna_vez: false,

      // Poleo: el id del intervalo y cuántos ticks quedan antes de parar.
      intervalo_id: null,
      ticks_restantes: 0,
      poleo_agotado: false,

      /* ¿La tarjeta está a la vista? Arranca en `true` a propósito: si el navegador no
       * tiene `IntersectionObserver` o la raíz no es un elemento, no se puede medir, y el
       * repliegue correcto es poleár como se hacía antes — no quedarse mudo. */
      visible: true,
      observador_visibilidad: null,
    }
  },

  computed: {
    /**
     * Los hitos agrupados para la exhibición: el de ingreso suelto arriba (sin encabezado de
     * sección) y después un grupo por sección, en el orden en que vienen del backend.
     *
     * Cada hito sale de acá con una clave `chips` agregada —los badges de "Visto" y "Probado"—,
     * ya resueltos. Se calculan acá y no en el template porque el template los usaría dos veces
     * cada uno (una en el `v-if` y otra en el contenido), y porque ésta ya es la computed que le
     * da forma de exhibición a lo que vino del backend.
     *
     * @returns {Array} Lista de { id, seccion, hitos }.
     */
    grupos() {
      const grupos = []
      let actual = null
      const self = this

      this.hitos.forEach(function (hito) {
        /* Se compara por el id COMPLETO de la sección (`S1 - Listado`) y no por el nombre corto
         * que se muestra: si el catálogo tuviera dos secciones que colapsan al mismo nombre al
         * sacarles el prefijo —"S1 - Ventas" y "S3 - Ventas"—, comparar por el corto las
         * fusionaría en un grupo si vinieran pegadas, o dejaría dos encabezados idénticos si no.
         * El prefijo que se saca para mostrar es justamente lo único que las distingue. */
        const id = hito.seccion || null

        if (actual === null || actual.id !== id) {
          actual = {
            id: id,
            // El nombre se muestra sin el prefijo `S<n> - `: adentro de la tarjeta el orden ya lo
            // da la posición, y el prefijo sólo gasta ancho en el teléfono.
            seccion: id ? id.replace(/^S\d+\s*-\s*/, '') : null,
            hitos: [],
          }
          grupos.push(actual)
        }

        /* Se copia el hito en vez de escribirle la clave encima: `this.hitos` es lo que llegó del
         * endpoint y se pisa entero en cada tick del poleo, así que mutarlo acá sería escribir
         * sobre el dato crudo desde una computed. */
        actual.hitos.push(Object.assign({}, hito, { chips: self.chips_de(hito) }))
      })

      return grupos
    },
  },

  watch: {
    /**
     * Cambio de lead sin desmontar el componente: se reinicia todo, incluido el poleo. Sin esto
     * el intervalo seguiría pidiendo el recorrido del lead anterior.
     *
     * Nació para el panel lateral, que se reusaba entre leads. Hoy la tarjeta vive adentro del
     * modal, que re-keyea la pestaña por el id del lead y la remonta entera, así que este watch
     * quedó como red: no se saca porque el día que la tarjeta se monte en otro lado vuelve a ser
     * lo único que evita el poleo apuntado al lead equivocado.
     */
    'lead.id': function () {
      this.detener_poleo()
      this.cargando_primera_vez = true

      /* Misma regla que en todos lados: si la tarjeta está tapada, el lead nuevo se lee recién
       * cuando aparezca. El observador no dispara solo en este caso, porque la visibilidad no
       * cambió — lo que cambió es el lead. */
      if (this.visible) {
        this.iniciar_poleo()
      }
    },
  },

  mounted() {
    this.observar_visibilidad()

    /* Con observador no se arranca nada acá: su primer aviso llega solo —la especificación
     * garantiza uno por cada target apenas se lo observa, haya cruce o no— y ese aviso decide.
     * Adelantarse con una medición sincrónica de layout parecía más prolijo y era peor: el modal
     * recuerda la última pestaña abierta, así que al operador que trabaja en Operaciones se le
     * abre directo ahí, la tarjeta tiene caja de layout pero está debajo del pliegue, y salía un
     * GET al vacío más un intervalo que el observador apagaba un frame después. */
    if (this.observador_visibilidad === null) {
      this.iniciar_poleo()
    }
  },

  /**
   * 🔴 Por qué hay hooks de keep-alive acá: `App.vue` envuelve la vista de leads en
   * `<keep-alive :include="['ViewLeads']">`, así que al navegar a otra sección del admin Vue no
   * desmonta nada — sólo desactiva. `beforeUnmount` no corre y `document.hidden` es `false`
   * porque la pestaña del navegador sigue a la vista. Cuando esta tarjeta vivía en el panel
   * lateral (misión 49), sin estos dos hooks quedaban 540 requests en 90 minutos contra algo que
   * nadie estaba mirando.
   *
   * Desde la misión 58 el que decide es el observador de visibilidad, y estos hooks pasaron a
   * ocuparse de lo poco que él no puede: reanudar cuando la vista vuelve sin que la visibilidad
   * haya cambiado, y frenar en el repliegue donde no hay observador.
   */
  activated() {
    /* Simétrico con `deactivated`: con observador no hay nada que reanudar. O la tarjeta siguió
     * a la vista —y entonces el intervalo nunca paró, así que reiniciarlo sólo serviría para
     * mandar un GET fuera de cadencia, resetear el tope y hacer desaparecer solo el botón
     * "Actualizar"— o está tapada, y la despierta el observador cuando aparezca. */
    if (this.observador_visibilidad === null) {
      this.iniciar_poleo()
    }
  },

  deactivated() {
    /* 🔴 Acá está el matiz que trajo la mudanza al modal (misión 58): "la vista se desactivó"
     * dejó de ser sinónimo de "esta tarjeta ya no se ve". `BaseModal` teleporta el diálogo a
     * `body`, y keep-alive **no** se lleva el contenido teleportado a su contenedor oculto: si
     * el operador navega a otra sección con el modal abierto, el modal queda arriba de la
     * pantalla nueva, visible y usable. Frenar el poleo ahí dejaba el recorrido congelado en el
     * último tick, a la vista, y sin ninguno de los dos avisos que tiene la tarjeta para
     * decirlo (`hubo_error` y `poleo_agotado` siguen en false: no falló nada ni se agotó nada).
     *
     * Entonces se pregunta por lo que de verdad importa —¿le queda caja de layout?— en vez de
     * asumirlo, y la pregunta se hace SIEMPRE, con observador o sin él: `offsetParent` mide la
     * cosa real y no depende de que exista `IntersectionObserver`. Si se guardara esto detrás de
     * "no hay observador", el repliegue volvería a frenar el poleo con la tarjeta a la vista, o
     * sea justo el defecto que este hook viene a evitar. Con observador es redundante y no
     * molesta: cuando keep-alive saca el DOM del documento, los dos coinciden en frenar. */
    if (!this.tiene_layout()) {
      this.detener_poleo()
    }
  },

  /**
   * 🔴 `beforeUnmount` y NO `beforeDestroy`: este repo es Vue 3, donde ese hook se renombró y el
   * nombre viejo no se ejecuta nunca — ni con un warning. Un intervalo que sobrevive al desmontaje
   * deja el panel pegándole a la API para siempre, y el modo de falla es silencioso.
   */
  beforeUnmount() {
    this.detener_poleo()
    this.dejar_de_observar_visibilidad()
  },

  methods: {
    /**
     * Los badges de detalle de un hito: cuánto vio del video y cuánto hizo del tour.
     *
     * 🔴 Devuelve una lista VACÍA cuando no hay nada que decir, y ése es el caso que importa
     * defender: contra un `admin-api` viejo los cinco campos vienen `undefined`, y entonces acá no
     * se dibuja ni un badge vacío ni un "0%" —que sería afirmar que el lead no vio nada cuando lo
     * que pasa es que esta versión de la API no lo sabe—. Puede parecer imposible (el SPA y la API
     * se suben juntos con `/deploy-admin`), pero el navegador de Lucas puede tener el SPA cacheado
     * y quedar adelantado a la API por unos minutos.
     *
     * Se pregunta por `typeof === 'boolean'` y no por `!== undefined`: así un `null` de alguna
     * versión intermedia tampoco dibuja nada, en vez de caer en el `else` y mentir.
     *
     * @param {Object} hito Hito tal como vino del endpoint.
     * @returns {Array} Lista de { clave, texto, icono, clase }. Vacía si no hay nada que mostrar.
     */
    chips_de(hito) {
      const chips = []

      /* El verde queda reservado para "Probado", que es el logro: el lead se puso a hacer el
       * recorrido y lo terminó. Haber visto el video es el piso, y va en gris. La jerarquía de
       * color es la que hace legible la columna de un vistazo. */
      if (typeof hito.visto === 'boolean') {
        if (hito.visto) {
          chips.push({
            clave: 'visto',
            texto: 'Visto',
            icono: 'bi-check2',
            clase: 'bg-secondary-subtle text-secondary',
          })
        } else {
          const visto = this.porcentaje_de(hito.porcentaje_visto)

          if (visto > 0) {
            /* Ámbar oscuro y no `text-warning`: mismo motivo y misma variable que
             * `demo-roadmap-parcial` unas líneas más abajo —el amarillo de Bootstrap sobre el
             * fondo blanco de la tarjeta no llega a AA—. Es el par que ya usan `resumen/Index.vue`
             * y `CallSummaryPanel.vue` en este mismo modal. */
            chips.push({
              clave: 'visto',
              texto: 'Visto ' + visto + '%',
              icono: 'bi-play-circle',
              clase: 'bg-warning-subtle text-warning-emphasis',
            })
          }
        }
      }

      if (typeof hito.probado === 'boolean') {
        if (hito.probado) {
          chips.push({
            clave: 'tour',
            texto: 'Probado',
            icono: 'bi-check2-circle',
            clase: 'bg-success-subtle text-success',
          })
        } else {
          const tour = this.porcentaje_de(hito.porcentaje_tour)

          if (tour > 0) {
            chips.push({
              clave: 'tour',
              texto: 'Tour ' + tour + '%',
              icono: 'bi-signpost-2',
              clase: 'bg-warning-subtle text-warning-emphasis',
            })
          } else if (hito.tour_iniciado === true) {
            /* Arrancó el tour y no llegó a mostrarse un solo paso. Es poco, pero no es lo mismo
             * que no haberlo tocado nunca: dice que el lead quiso probar. */
            chips.push({
              clave: 'tour',
              texto: 'Tour empezado',
              icono: 'bi-signpost-2',
              clase: 'bg-secondary-subtle text-secondary',
            })
          }
        }
      }

      return chips
    },

    /**
     * Un porcentaje del payload, leído como entero de 0 a 100.
     *
     * La API ya lo sanea y clampea, así que esto es la segunda red y no la primera: cualquier cosa
     * que no sea un número finito da 0, que es el valor con el que no se dibuja nada. Es más barato
     * que confiar y terminar imprimiendo "Visto NaN%" en la pantalla del closer.
     *
     * @param {*} valor
     * @returns {Number} Entero de 0 a 100.
     */
    porcentaje_de(valor) {
      if (typeof valor !== 'number' || !isFinite(valor) || valor <= 0) {
        return 0
      }

      return Math.min(100, Math.round(valor))
    },

    /**
     * El texto de apoyo del estado `parcial`.
     *
     * 🔴 Hasta el 1/9/2026 acá había un texto fijo —*"Vio el tutorial, no llegó a hacerlo"*— que
     * era falso en dos casos reales, y con los badges nuevos arriba la contradicción quedaba a la
     * vista:
     *
     *  1. **El hito sin acción verificable.** `DemoHitosService::estado_segun_marcas()` deja en
     *     `parcial` para siempre a todo hito con `evento_esperado` null, que según su propio
     *     docblock es *"la mitad de los clips"*. Decir de esos que el lead "no llegó a hacerlo" lo
     *     culpa de no hacer algo que el sistema no puede detectar.
     *  2. **La acción sin el tutorial.** El estado se calcula con un O, no con un Y
     *     (`vio_tutorial || hizo_accion`), así que un lead que creó el artículo sin mirar el video
     *     también cae en `parcial` — y ahí el texto afirmaba lo contrario de lo que pasó, ahora al
     *     lado de un hito sin badge "Visto".
     *
     * Los tres campos con los que se decide (`evento_esperado`, `tutorial_visto_at`,
     * `accion_hecha_at`) están en el payload desde la misión 48, así que este arreglo vale igual
     * contra un `admin-api` viejo. Lo único que se mira de esta misión es si hay badges: si no los
     * hay, el texto tiene que seguir diciendo las dos mitades, porque nadie más las dice.
     *
     * @param {Object} hito
     * @returns {String}
     */
    texto_del_parcial(hito) {
      // 🔴 El hito de ingreso no es un clip y no tiene tutorial: cae acá cuando el lead pulsó el
      // link y no llegó a entrar. Sin esta primera rama termina en el texto de más abajo y le
      // cuenta a Tomás que "vio el tutorial", que es de otra cosa. Va primero porque el hito de
      // ingreso SÍ declara `evento_esperado` (`DemoHitosService::generar()` le pone
      // `demo.ingreso`), así que la guarda que sigue no lo ataja.
      if (hito.tipo === 'ingreso') {
        return 'Abrió el link y no llegó a entrar'
      }

      if (!hito.evento_esperado) {
        return 'Este clip no tiene una acción que el sistema pueda verificar'
      }

      if (!hito.tutorial_visto_at && hito.accion_hecha_at) {
        return 'Hizo la acción sin ver el tutorial'
      }

      // Con el badge "Visto" justo arriba, repetirlo acá es decir dos veces lo mismo.
      if (typeof hito.visto === 'boolean') {
        return 'No llegó a hacer la acción'
      }

      return 'Vio el tutorial, no llegó a hacerlo'
    },

    /**
     * 🔴 Empieza a mirar si la tarjeta está efectivamente en pantalla (misión 58).
     *
     * Desde que la tarjeta vive en la pestaña Operaciones del modal del lead, estar MONTADA
     * dejó de significar estar a la vista: el modal renderiza los paneles de sus pestañas con
     * `v-show` (`common-vue/components/model/Index.vue`), así que la tarjeta se monta apenas
     * se abre el modal —y la pestaña que abre por default es Resumen, no Operaciones—. Sin
     * esto, abrir un lead para corregirle el teléfono arrancaba el poleo igual, y encima le
     * comía el presupuesto de 90 minutos a una tarjeta que nadie estaba mirando.
     *
     * Es el mismo criterio que la guarda de `document.hidden` que ya tenía el tick, un nivel
     * más abajo: aquella pregunta si la PESTAÑA DEL NAVEGADOR está a la vista; ésta, si lo
     * está la tarjeta dentro de la página.
     *
     * @returns {void}
     */
    observar_visibilidad() {
      const el = this.$el

      /* `nodeType !== 1` es el caso del `v-if` de la raíz en false: ahí Vue deja un nodo
       * comentario, que no tiene layout ni se puede observar. */
      if (typeof IntersectionObserver === 'undefined' || !el || el.nodeType !== 1) {
        /* No se puede medir: se vuelve al comportamiento de antes en vez de quedarse mudo
         * para siempre, que es el modo de falla caro (una tarjeta que nunca carga y nadie
         * sabe por qué). */
        this.visible = true

        return
      }

      /* Se arranca en `false` y lo corrige el primer aviso, que llega en el próximo frame. Al
       * revés —arrancar en `true`— la ventana entre el montaje y ese aviso alcanza para que el
       * watch del lead dispare una lectura de algo que nadie está mirando. */
      this.visible = false

      const self = this

      /* 🔴 El observador no "avisa" nada más: **prende y apaga el poleo**. La invariante que
       * deja es la que hace fácil razonar todo lo demás — *con observador, el intervalo existe
       * si y sólo si la tarjeta está a la vista*. (En el repliegue no rige ninguna invariante
       * nueva: ahí se poléa como antes de esta misión.)
       *
       * La primera versión de esto (misión 58) sólo llamaba a `cargar()` y dejaba que un guard
       * adentro del tick saltease los ticks invisibles. Se veía más chiquito y tenía un agujero:
       * si el intervalo estaba detenido —porque se agotó el tope, o porque lo frenó el hook de
       * desactivación— reaparecer disparaba UNA lectura y nada más, y la tarjeta quedaba
       * congelada a la vista sin ninguno de sus dos avisos. Que es exactamente el defecto que
       * esta misión vino a cerrar. */
      this.observador_visibilidad = new IntersectionObserver(function (entradas) {
        const ahora_visible = entradas[entradas.length - 1].isIntersecting

        if (ahora_visible === self.visible) {
          return
        }

        self.visible = ahora_visible

        if (ahora_visible) {
          /* `iniciar_poleo` ya trae la lectura inmediata, así que el operador que llega
           * scrolleando no se come un spinner de hasta diez segundos. */
          self.iniciar_poleo()

          return
        }

        self.detener_poleo()
      })

      this.observador_visibilidad.observe(el)
    },

    /**
     * ¿La raíz de la tarjeta tiene caja de layout en este instante?
     *
     * `offsetParent` da `null` cuando un ancestro tiene `display: none` —lo que hace el `v-show`
     * de la pestaña inactiva— y también cuando el elemento salió del documento, que es lo que
     * keep-alive le hace a lo que NO está teleportado. Las dos cosas que necesita saber
     * `deactivated`, su único llamador, y sin depender de `IntersectionObserver`.
     *
     * Un nodo que no es elemento (la raíz con su `v-if` en false) devuelve `false` porque es la
     * verdad —un comentario no tiene caja— y porque para el que pregunta es además el default
     * seguro: ante la duda, frenar.
     *
     * @returns {boolean}
     */
    tiene_layout() {
      const el = this.$el

      if (!el || el.nodeType !== 1) {
        return false
      }

      return el.offsetParent !== null
    },

    /**
     * Corta la observación. Idempotente, igual que `detener_poleo`.
     *
     * @returns {void}
     */
    dejar_de_observar_visibilidad() {
      if (this.observador_visibilidad !== null) {
        this.observador_visibilidad.disconnect()
        this.observador_visibilidad = null
      }
    },

    /**
     * Trae el recorrido del lead. No pisa lo que ya está en pantalla mientras carga: el poleo
     * corre cada 10 segundos y un parpadeo por tick haría la tarjeta ilegible.
     */
    cargar() {
      if (this.cargando || !this.lead || !this.lead.id) {
        return
      }

      const self = this
      this.cargando = true

      /* `silent_error: true` y `timeout` no son adorno, son los dos que hacen que el poleo sea
       * poleo y no una molestia:
       *
       *  - Sin `silent_error`, el interceptor global de axios emite un toast rojo por CADA error
       *    que no sea 401. Con un 500 sostenido eso son 540 toasts en 90 minutos, apilados sobre
       *    cualquier pantalla. El `.catch()` de acá abajo no lo evita: el interceptor corre antes.
       *  - Sin `timeout`, el cliente no tiene ninguno (`axios.create` no lo configura), así que
       *    una petición que nunca se asienta deja `cargando` en true para siempre y el poleo
       *    queda mudo hasta que se agota el tope. */
      api.get('lead/' + this.lead.id + '/demo-roadmap', { silent_error: true, timeout: 8000 })
        .then(function (response) {
          const data = response.data || {}

          self.tiene_plan = !!data.tiene_plan
          self.condiciones_invalidas = data.condiciones_invalidas || []
          self.hitos = data.hitos || []
          self.completos = data.progreso ? data.progreso.completos : 0
          self.total = data.progreso ? data.progreso.total : 0
          self.hubo_error = false
          self.cargo_alguna_vez = true
        })
        .catch(function () {
          // No se pisan los datos que ya estaban en pantalla: un tick fallido no tiene por qué
          // borrar lo último bueno que se vio. Lo que sí se marca es que están desactualizados,
          // para no afirmar algo falso sobre el lead (ver `hubo_error` en el template).
          self.hubo_error = true
        })
        .then(function () {
          self.cargando = false
          self.cargando_primera_vez = false
        })
    },

    /**
     * Arranca el poleo cada 10 segundos, con tope de 90 minutos.
     *
     * No se usa websocket a propósito: está decidido que para esto el poleo alcanza y el
     * websocket es sobreingeniería (`demo_experiencia.md` §9 T4).
     */
    iniciar_poleo() {
      /* Idempotente por diseño, como los otros cinco poleos del repo (que abren con
       * `if (this.timer) return`): si `intervalo_id` se pisara sin limpiar el anterior, el
       * intervalo viejo quedaría vivo y ya no habría forma de referenciarlo — ni `beforeUnmount`
       * podría matarlo. Con `activated()` llamando acá, la secuencia mounted → activated es
       * alcanzable de verdad. */
      this.detener_poleo()

      this.cargar()

      this.poleo_agotado = false
      // 90 minutos a 10 segundos por tick.
      this.ticks_restantes = 540

      const self = this
      this.intervalo_id = setInterval(function () {
        /* La pestaña oculta no necesita datos frescos: el navegador ya throttlea los intervalos
         * en segundo plano, pero el request igual saldría y sumaría carga sin que nadie lo mire.
         *
         * El `return` va ANTES de descontar el tick, y es a propósito: el tope de 90 minutos mide
         * poleo efectivo, no reloj de pared. Una pestaña que estuvo dos horas de fondo no gastó
         * presupuesto, y al volver a primer plano tiene que seguir actualizándose — si el tope
         * corriera igual, el panel aparecería congelado justo cuando alguien lo mira. */
        if (document.hidden) {
          return
        }

        /* Acá NO va una guarda por tarjeta oculta, y vale decir por qué: con observador, mientras
         * la tarjeta no se ve este intervalo directamente no existe — lo apaga él y lo vuelve a
         * prender cuando reaparece (ver `observar_visibilidad`). En el repliegue no hay a quién
         * preguntarle, así que se poléa como antes. */

        // Un tick que no llega a pedir tampoco gasta presupuesto: si hay una petición todavía en
        // vuelo, `cargar()` sale por su propio guard, y descontar acá haría que el tope de 90
        // minutos se agotara sin haber consultado nunca.
        if (self.cargando) {
          return
        }

        self.ticks_restantes--

        if (self.ticks_restantes <= 0) {
          self.detener_poleo()
          self.poleo_agotado = true

          return
        }

        self.cargar()
      }, 10000)
    },

    /**
     * Corta el intervalo. Es idempotente: llamarlo dos veces no rompe nada, y por eso se lo puede
     * invocar desde el watch, desde `beforeUnmount`, desde `deactivated`, desde el arranque del
     * propio poleo y desde el tick que agota el tope, sin coordinarlos entre sí.
     */
    detener_poleo() {
      if (this.intervalo_id !== null) {
        clearInterval(this.intervalo_id)
        this.intervalo_id = null
      }
    },

    /**
     * Vuelve a arrancar el poleo desde el botón "Actualizar" que aparece al agotarse el tope.
     */
    reanudar_poleo() {
      this.detener_poleo()
      this.iniciar_poleo()
    },
  },
}
</script>

<style lang="sass" scoped>
.demo-roadmap-hito
	border-bottom: 1px solid rgba(0, 0, 0, .05)

	&:last-child
		border-bottom: none

.demo-roadmap-seccion
	font-size: .7rem
	letter-spacing: .04em

// Ámbar oscuro en vez del `text-warning` de Bootstrap (#ffc107), que sobre el fondo blanco de la
// tarjeta da ~1.6:1 y no llega a AA. `parcial` es el estado que más se lee de los tres: es el que
// dice dónde se trabó el lead. Misma variable que usa DemoExperienciaControl.
.demo-roadmap-parcial
	color: var(--bs-warning-text-emphasis, #997404)

// El título de un clip puede ser largo y la tarjeta se abre desde el teléfono: se envuelve en vez
// de desbordar, que es lo que empujaría el badge fuera del header.
.demo-roadmap-titulo
	word-break: break-word

.min-width-0
	min-width: 0
</style>
