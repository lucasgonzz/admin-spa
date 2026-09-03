<template>
  <div class="closer-panel lead-module h-100 d-flex flex-column">

    <!-- Encabezado del panel -->
    <div class="closer-panel__header d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
      <div>
        <h1 class="h4 mb-0 fw-semibold">Panel del closer</h1>
        <p v-if="last_fetched_label" class="text-muted small mb-0 mt-1">
          Actualizado {{ last_fetched_label }}
        </p>
        <!-- Cuenta con la que se crean los Meet: si el navegador está logueado con otra,
             Google pide que el anfitrión te admita. Verla acá hace obvio el desajuste. -->
        <p v-if="closer_google_account" class="text-muted small mb-0 mt-1">
          <i class="bi bi-google me-1" aria-hidden="true" />
          Entrás a los Meet como <span class="fw-semibold">{{ closer_google_account }}</span>
        </p>
      </div>
      <button
        type="button"
        class="btn btn-sm btn-outline-primary"
        :disabled="loading"
        @click="on_manual_refresh"
      >
        <i class="bi bi-arrow-clockwise me-1" aria-hidden="true" />
        Actualizar
      </button>
    </div>

    <!-- Tarjetas de resumen: eligen qué sección se muestra abajo -->
    <LeadStatusCards
      :cards="cards"
      :active_status_slug="active_section"
      :loading="loading"
      @select="on_select_card"
    />

    <!-- Sección activa (una sola, siempre, en cualquier ancho) -->
    <div class="closer-panel__sections flex-grow-1 min-h-0">
      <section class="closer-panel__section">
        <div class="closer-panel__section-header d-flex align-items-center gap-2 mb-3 flex-wrap">
          <h2 class="h6 mb-0 fw-semibold">{{ active_tab.title }}</h2>
          <span class="badge bg-secondary rounded-pill">{{ active_tab.count }}</span>
          <!-- Botones de orden: solo visibles en la sección "seguimiento" -->
          <div v-if="active_section === 'seguimiento'" class="d-flex gap-1 ms-auto">
            <button
              type="button"
              class="btn btn-xs closer-sort-btn"
              :class="followup_sort === 'suggestion' ? 'btn-warning' : 'btn-outline-secondary'"
              title="Mostrar primero los leads con sugerencia de seguimiento pendiente"
              @click="$store.commit('closer/set_followup_sort', 'suggestion')"
            >
              <i class="bi bi-chat-right-text me-1" aria-hidden="true" />
              Sugerencia
            </button>
            <button
              type="button"
              class="btn btn-xs closer-sort-btn"
              :class="followup_sort === 'last_call' ? 'btn-primary' : 'btn-outline-secondary'"
              title="Ordenar por fecha de la última reunión (más reciente primero)"
              @click="$store.commit('closer/set_followup_sort', 'last_call')"
            >
              <i class="bi bi-calendar-event me-1" aria-hidden="true" />
              Última reunión
            </button>
            <button
              type="button"
              class="btn btn-xs closer-sort-btn"
              :class="followup_sort === 'first_call' ? 'btn-primary' : 'btn-outline-secondary'"
              title="Ordenar por la fecha en que el lead pasó a seguimiento (primera reunión)"
              @click="$store.commit('closer/set_followup_sort', 'first_call')"
            >
              <i class="bi bi-calendar-plus me-1" aria-hidden="true" />
              Primera reunión
            </button>
          </div>
        </div>

        <div v-if="loading && !active_tab.leads.length" class="text-center text-muted py-4">
          <span class="spinner-border spinner-border-sm me-2" aria-hidden="true" />
          Cargando…
        </div>

        <div v-else-if="!active_tab.leads.length" class="text-muted small py-3 px-2 closer-panel__empty">
          {{ active_tab.empty_message }}
        </div>

        <div v-else class="closer-panel__grid">
          <CloserLeadCard
            v-for="lead in active_tab.leads"
            :key="active_section + '-' + lead.id"
            :lead="lead"
            :section="active_section"
            @open-conversation="on_open_conversation"
            @open-lead-modal="on_open_lead_modal"
          />
        </div>
      </section>
    </div>

    <!-- Sidebar lateral de conversación WhatsApp (solo desktop; en mobile se navega a ruta) -->
    <lead-conversation-sidebar
      :lead="sidebar_lead"
      @close="on_sidebar_close"
      @record-updated="on_sidebar_record_updated"
    />

    <!-- Modal de detalle del lead: el mismo ModelModal genérico que usa el módulo de Leads,
         montado acá directo para que el panel del closer no navegue a otra vista. -->
    <ModelModal
      model_name="lead"
      :show="modal_lead !== null"
      :all_properties="lead_all_properties"
      :record="modal_lead"
      @update:show="on_lead_modal_show"
      @close="on_close_lead_modal"
      @saved="on_lead_modal_saved"
      @open-conversation="on_open_conversation"
    />
  </div>
</template>

<script>
import CloserLeadCard from '@/components/closer/CloserLeadCard.vue'
import LeadConversationSidebar from '@/components/lead/LeadConversationSidebar.vue'
import LeadStatusCards from '@/components/lead/LeadStatusCards.vue'
import ModelModal from '@/common-vue/components/model/Index.vue'

/** Intervalo de polling silencioso en milisegundos. */
const PANEL_POLL_MS = 60000

/**
 * Momento (en ms) de la llamada que el lead tiene AGENDADA y todavía no arrancó, o Infinity si
 * no tiene ninguna. Se usa para ordenar "Listos para la llamada": los que tienen horario
 * acordado con el agente van primero, del más próximo al más lejano.
 *
 * En esa columna ningún lead tiene llamadas iniciadas (es justamente su condición de entrada),
 * así que cualquier fila de `calls` que traiga es una llamada agendada pendiente.
 *
 * @param {Object} lead
 * @returns {number}
 */
function scheduled_at_of(lead) {
  const calls = (lead && lead.calls) || []
  let earliest = Infinity
  let i = 0
  for (i = 0; i < calls.length; i = i + 1) {
    if (!calls[i].scheduled_at) {
      continue
    }
    const at = new Date(calls[i].scheduled_at).getTime()
    if (!isNaN(at) && at < earliest) {
      earliest = at
    }
  }
  return earliest
}

/**
 * Momento (en ms) de la última llamada REALIZADA del lead, con fallback a `closer_called_at`.
 *
 * El fallback importa: `closer_called_at` es la columna vieja de `leads`, de cuando un lead tenía
 * una sola llamada, y no se carga en las llamadas nuevas. Ordenar solo por ella hundía al fondo
 * justo a los leads recién llamados.
 *
 * @param {Object} lead
 * @returns {number}
 */
function last_call_at_of(lead) {
  const calls = (lead && lead.calls) || []
  let latest = 0
  let i = 0
  for (i = 0; i < calls.length; i = i + 1) {
    if (!calls[i].started_at) {
      continue
    }
    const at = new Date(calls[i].started_at).getTime()
    if (!isNaN(at) && at > latest) {
      latest = at
    }
  }
  if (latest > 0) {
    return latest
  }
  const fallback = new Date((lead && lead.closer_called_at) || 0).getTime()
  return isNaN(fallback) ? 0 : fallback
}

/**
 * Momento (en ms) de la PRIMERA llamada REALIZADA del lead: la que marcó su ingreso a
 * "En seguimiento". Sin fallback a `closer_called_at` (a diferencia de `last_call_at_of`):
 * un lead en esta sección siempre tiene al menos una llamada con `started_at`, que es
 * justamente la condición de entrada que usa el backend para moverlo acá.
 *
 * @param {Object} lead
 * @returns {number}
 */
function first_call_at_of(lead) {
  const calls = (lead && lead.calls) || []
  let earliest = Infinity
  let i = 0
  for (i = 0; i < calls.length; i = i + 1) {
    if (!calls[i].started_at) {
      continue
    }
    const at = new Date(calls[i].started_at).getTime()
    if (!isNaN(at) && at < earliest) {
      earliest = at
    }
  }
  return earliest === Infinity ? 0 : earliest
}

/**
 * Vista dedicada del closer: una sola sección visible a la vez (agendadas / para_llamar /
 * seguimiento), elegida con las tarjetas de resumen de arriba. Mismo layout en cualquier ancho.
 */
export default {
  name: 'CloserPanel',

  components: {
    CloserLeadCard,
    LeadConversationSidebar,
    LeadStatusCards,
    ModelModal,
  },

  data() {
    return {
      /** Referencia al setInterval de polling. */
      poll_interval_id: null,

      /** Lead actualmente abierto en el sidebar lateral de conversación (null = cerrado). */
      sidebar_lead: null,

      /** Lead actualmente abierto en el modal de detalle (null = cerrado). */
      modal_lead: null,
    }
  },

  computed: {
    /**
     * true mientras la carga inicial está en curso.
     *
     * @returns {boolean}
     */
    loading() {
      return this.$store.state.closer.loading
    },
    /**
     * Timestamp del último fetch exitoso.
     *
     * @returns {string|null}
     */
    last_fetched_at() {
      return this.$store.state.closer.last_fetched_at
    },
    /**
     * Etiqueta legible del último refresh.
     *
     * @returns {string}
     */
    last_fetched_label() {
      if (!this.last_fetched_at) {
        return ''
      }
      const date = new Date(this.last_fetched_at)
      if (isNaN(date.getTime())) {
        return ''
      }
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return 'a las ' + hours + ':' + minutes
    },
    /**
     * Criterio de orden activo para la sección "En seguimiento".
     *
     * @returns {'suggestion'|'last_call'|'first_call'}
     */
    followup_sort() {
      return this.$store.state.closer.followup_sort
    },
    /**
     * Tarjetas de resumen (agendadas/para_llamar/seguimiento) tal cual las manda el backend.
     *
     * @returns {Array<Object>}
     */
    cards() {
      return this.$store.state.closer.cards || []
    },
    /**
     * Sección mostrada ahora: 'agendadas' | 'para_llamar' | 'seguimiento'.
     *
     * @returns {string}
     */
    active_section() {
      return this.$store.state.closer.active_section
    },
    /**
     * Meta de propiedades del modelo `lead` (grupos del formulario del modal de detalle).
     * Se carga en `mounted()` vía `meta/fetch_meta` porque este panel no pasa por ResourceView,
     * que es quien normalmente la precarga para el módulo de Leads.
     *
     * @returns {Array<Object>}
     */
    lead_all_properties() {
      return this.$store.getters['meta/properties']('lead') || []
    },
    /**
     * Mail de la cuenta de Google conectada del closer (la que crea los eventos y los Meet).
     *
     * @returns {string}
     */
    closer_google_account() {
      const settings = this.$store.state.closer.settings || {}
      return settings.closer_google_account || ''
    },
    /**
     * Leads listos para la llamada, con los que YA tienen horario acordado por el agente
     * arriba (ordenados por ese horario, el más próximo primero) y el resto después, por
     * fecha de demo descendente. El que tiene hora es el que tiene un compromiso que cumplir.
     *
     * @returns {Array<Object>}
     */
    sorted_para_llamar() {
      const leads = (this.$store.state.closer.para_llamar || []).slice()
      return leads.sort(function (a, b) {
        var a_at = scheduled_at_of(a)
        var b_at = scheduled_at_of(b)
        if (a_at !== b_at) {
          /* Los que no tienen horario acordado van al final (Infinity). */
          return a_at - b_at
        }
        var a_demo = new Date(a.demo_date || 0).getTime()
        var b_demo = new Date(b.demo_date || 0).getTime()
        return b_demo - a_demo
      })
    },
    /**
     * Lista de leads en seguimiento ordenada según el criterio activo.
     * - 'suggestion': primero los que tienen tiene_sugerencia_pendiente = true.
     * - 'last_call': por fecha de la última llamada realizada, más reciente primero.
     * - 'first_call': por fecha de la primera llamada realizada, más reciente primero.
     *
     * @returns {Array<Object>}
     */
    sorted_seguimiento() {
      const leads = (this.$store.state.closer.seguimiento || []).slice()
      if (this.followup_sort === 'suggestion') {
        return leads.sort(function (a, b) {
          /* Leads con sugerencia pendiente van al inicio (0 < 1). */
          var a_pending = a.tiene_sugerencia_pendiente ? 0 : 1
          var b_pending = b.tiene_sugerencia_pendiente ? 0 : 1
          if (a_pending !== b_pending) {
            return a_pending - b_pending
          }
          /* Dentro del mismo grupo: más reciente primero. */
          return last_call_at_of(b) - last_call_at_of(a)
        })
      }
      if (this.followup_sort === 'first_call') {
        return leads.sort(function (a, b) {
          return first_call_at_of(b) - first_call_at_of(a)
        })
      }
      /* 'last_call': más reciente primero. */
      return leads.sort(function (a, b) {
        return last_call_at_of(b) - last_call_at_of(a)
      })
    },
    /**
     * Definición (título/leads/contador/mensaje vacío) de la sección activa.
     *
     * @returns {{ key: string, title: string, leads: Array<Object>, count: number, empty_message: string }}
     */
    active_tab() {
      const state = this.$store.state.closer
      const defs = {
        agendadas: {
          title: 'Demos agendadas',
          leads: state.agendadas || [],
          empty_message: 'No hay demos agendadas sin terminar',
        },
        para_llamar: {
          title: 'Listos para la llamada',
          leads: this.sorted_para_llamar,
          empty_message: 'No hay leads esperando la llamada',
        },
        seguimiento: {
          title: 'En seguimiento',
          leads: this.sorted_seguimiento,
          empty_message: 'No hay leads en seguimiento',
        },
      }
      const def = defs[this.active_section] || defs.agendadas
      return {
        key: this.active_section,
        title: def.title,
        leads: def.leads,
        count: def.leads.length,
        empty_message: def.empty_message,
      }
    },
  },

  mounted() {
    const self = this
    self.$store.dispatch('closer/fetch_panel').catch(function () {
      return null
    })
    /* Meta del modelo `lead`: la necesita el ModelModal de detalle para armar sus grupos/campos.
       Fuera de ResourceView (que la precarga sola) nadie más la pide en este panel. */
    self.$store.dispatch('meta/fetch_meta', 'lead').catch(function () {
      return null
    })
    self.poll_interval_id = window.setInterval(function () {
      self.$store.dispatch('closer/refresh_panel').catch(function () {
        return null
      })
    }, PANEL_POLL_MS)
  },

  beforeUnmount() {
    if (this.poll_interval_id) {
      window.clearInterval(this.poll_interval_id)
      this.poll_interval_id = null
    }
  },

  methods: {
    /**
     * Refresco manual con indicador de carga.
     *
     * @returns {void}
     */
    on_manual_refresh() {
      this.$store.dispatch('closer/fetch_panel').catch(function () {
        return null
      })
    },
    /**
     * Cambia la sección mostrada al hacer clic en una tarjeta de resumen.
     *
     * @param {{ value: string }} card
     * @returns {void}
     */
    on_select_card(card) {
      if (!card || !card.value) {
        return
      }
      this.$store.commit('closer/set_active_section', card.value)
    },
    /**
     * Abre la conversación del lead. Desktop (>=768px): sidebar lateral.
     * Mobile (<768px): navega a la pantalla completa (comportamiento anterior).
     *
     * @param {Object} lead
     * @returns {void}
     */
    on_open_conversation(lead) {
      if (!lead || !lead.id) {
        return
      }
      if (window.innerWidth >= 768) {
        this.sidebar_lead = lead
      } else {
        this.$router.push({ name: 'lead_conversation', params: { lead_id: lead.id } })
      }
    },
    /**
     * Cierra el sidebar lateral limpiando el lead activo.
     *
     * @returns {void}
     */
    on_sidebar_close() {
      this.sidebar_lead = null
    },
    /**
     * Refresca el panel en silencio para reflejar cambios de estado del lead.
     *
     * @returns {void}
     */
    on_sidebar_record_updated() {
      this.$store.dispatch('closer/refresh_panel').catch(function () { return null })
    },
    /**
     * Abre el modal de detalle completo del lead en el mismo panel del closer, sin navegar
     * a otra vista (antes redirigía al módulo de Leads con `?lead_id=`).
     *
     * @param {Object} lead
     * @returns {void}
     */
    on_open_lead_modal(lead) {
      if (!lead || !lead.id) {
        return
      }
      this.modal_lead = lead
    },
    /**
     * Sincroniza el cierre del modal disparado desde adentro (BaseModal: Escape/backdrop/botón).
     *
     * @param {boolean} value
     * @returns {void}
     */
    on_lead_modal_show(value) {
      if (!value) {
        this.modal_lead = null
      }
    },
    /**
     * Cierra el modal de detalle del lead.
     *
     * @returns {void}
     */
    on_close_lead_modal() {
      this.modal_lead = null
    },
    /**
     * Tras guardar el lead desde el modal, refresca el panel en silencio: pudo haber
     * cambiado de estado o de sección.
     *
     * @returns {void}
     */
    on_lead_modal_saved() {
      this.$store.dispatch('closer/refresh_panel').catch(function () { return null })
    },
  },
}
</script>

<style lang="sass" scoped>
.closer-panel
	min-height: 0

.closer-panel__sections
	display: flex
	flex-direction: column
	min-height: 0

.closer-panel__section
	min-height: 0
	display: flex
	flex-direction: column
	background: #f8f9fa
	border-radius: 0.75rem
	padding: 0.75rem

.closer-panel__grid
	flex: 1
	min-height: 0
	overflow-y: auto
	padding-right: 0.25rem
	display: grid
	grid-template-columns: repeat(2, minmax(0, 1fr))
	gap: 1rem
	align-content: start

	@media (max-width: 1024px)
		grid-template-columns: minmax(0, 1fr)

.closer-panel__empty
	background: #fff
	border-radius: 0.5rem
	border: 1px dashed #dee2e6

/* Botones compactos de ordenamiento en el encabezado de sección */
.closer-sort-btn
	font-size: 0.7rem
	padding: 0.15rem 0.45rem
	line-height: 1.4
	border-radius: 0.35rem
</style>
