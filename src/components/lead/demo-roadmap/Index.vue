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
        <div v-for="(grupo, gi) in grupos" :key="gi">

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
                <i v-else-if="hito.estado === 'parcial'" class="bi bi-slash-circle text-warning"></i>
                <i v-else class="bi bi-circle text-muted"></i>
              </div>

              <div class="flex-grow-1 min-width-0">
                <div
                  class="small fw-semibold demo-roadmap-titulo"
                  :class="{
                    'text-success': hito.estado === 'completo',
                    'text-warning': hito.estado === 'parcial',
                    'text-muted':   hito.estado === 'pendiente',
                  }"
                >{{ hito.titulo }}</div>

                <!-- Texto de apoyo: la hora en el completo, la explicación en el parcial. -->
                <div v-if="hito.estado === 'completo' && hito.accion_hecha_at" class="small text-muted mt-1">
                  {{ hito.accion_hecha_at }}
                </div>
                <div v-else-if="hito.estado === 'parcial'" class="small text-muted mt-1">
                  Vio el tutorial, no llegó a hacerlo
                </div>
              </div>
            </div>
          </div>
        </div>

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

      // Poleo: el id del intervalo y cuántos ticks quedan antes de parar.
      intervalo_id: null,
      ticks_restantes: 0,
      poleo_agotado: false,
    }
  },

  computed: {
    /**
     * Los hitos agrupados para la exhibición: el de ingreso suelto arriba (sin encabezado de
     * sección) y después un grupo por sección, en el orden en que vienen del backend.
     *
     * @returns {Array} Lista de { seccion, hitos }.
     */
    grupos() {
      const grupos = []
      let actual = null

      this.hitos.forEach(function (hito) {
        // El nombre de sección se muestra sin el prefijo `S<n> - ` del catálogo: adentro de la
        // tarjeta el orden ya lo da la posición, y el prefijo sólo gasta ancho en el teléfono.
        const seccion = hito.seccion ? hito.seccion.replace(/^S\d+\s*-\s*/, '') : null

        if (actual === null || actual.seccion !== seccion) {
          actual = { seccion: seccion, hitos: [] }
          grupos.push(actual)
        }

        actual.hitos.push(hito)
      })

      return grupos
    },
  },

  watch: {
    /**
     * Cambio de lead sin desmontar el componente (pasa en el panel lateral, que se reusa entre
     * leads): se reinicia todo, incluido el poleo. Sin esto el intervalo seguiría pidiendo el
     * recorrido del lead anterior.
     */
    'lead.id': function () {
      this.detener_poleo()
      this.cargando_primera_vez = true
      this.iniciar_poleo()
    },
  },

  mounted() {
    this.iniciar_poleo()
  },

  /**
   * 🔴 `beforeUnmount` y NO `beforeDestroy`: este repo es Vue 3, donde ese hook se renombró y el
   * nombre viejo no se ejecuta nunca — ni con un warning. Un intervalo que sobrevive al desmontaje
   * deja el panel pegándole a la API para siempre, y el modo de falla es silencioso.
   */
  beforeUnmount() {
    this.detener_poleo()
  },

  methods: {
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

      api.get('lead/' + this.lead.id + '/demo-roadmap')
        .then(function (response) {
          const data = response.data || {}

          self.tiene_plan = !!data.tiene_plan
          self.condiciones_invalidas = data.condiciones_invalidas || []
          self.hitos = data.hitos || []
          self.completos = data.progreso ? data.progreso.completos : 0
          self.total = data.progreso ? data.progreso.total : 0
        })
        .catch(function () {
          // Un error de red en un poleo no se le muestra al usuario: el próximo tick lo resuelve,
          // y una alerta cada 10 segundos sería peor que el problema. Lo que sí se hace es no
          // pisar los datos que ya estaban en pantalla.
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
     * invocar desde el watch, desde beforeDestroy y desde el propio tick sin coordinarlos.
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

// El título de un clip puede ser largo y la tarjeta se abre desde el teléfono: se envuelve en vez
// de desbordar, que es lo que empujaría el badge fuera del header.
.demo-roadmap-titulo
	word-break: break-word

.min-width-0
	min-width: 0
</style>
