<template>
  <div class="closer-panel lead-module h-100 d-flex flex-column">

    <!-- Encabezado del panel -->
    <div class="closer-panel__header d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
      <div>
        <h1 class="h4 mb-0 fw-semibold">Panel del closer</h1>
        <p v-if="last_fetched_label" class="text-muted small mb-0 mt-1">
          Actualizado {{ last_fetched_label }}
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

    <!-- Tabs en mobile -->
    <ul v-if="is_mobile" class="nav nav-tabs closer-panel__tabs mb-3">
      <li v-for="tab in tabs" :key="'tab-' + tab.key" class="nav-item">
        <button
          type="button"
          class="nav-link"
          :class="{ active: active_tab === tab.key }"
          @click="active_tab = tab.key"
        >
          {{ tab.title }}
          <span class="badge rounded-pill ms-1" :class="tab.key === active_tab ? 'bg-primary' : 'bg-secondary'">
            {{ tab.count }}
          </span>
        </button>
      </li>
    </ul>

    <!-- Tres columnas en desktop / una sección activa en mobile -->
    <div
      class="closer-panel__sections flex-grow-1 min-h-0"
      :class="{ 'closer-panel__sections--mobile': is_mobile }"
    >
      <section
        v-for="tab in tabs"
        :key="'section-' + tab.key"
        class="closer-panel__section"
        :class="{
          'closer-panel__section--hidden-mobile': is_mobile && active_tab !== tab.key,
        }"
      >
        <div class="closer-panel__section-header d-flex align-items-center gap-2 mb-3 flex-wrap">
          <h2 class="h6 mb-0 fw-semibold">{{ tab.title }}</h2>
          <span class="badge bg-secondary rounded-pill">{{ tab.count }}</span>
          <!-- Botones de orden: solo visibles en la sección "seguimiento" -->
          <div v-if="tab.key === 'seguimiento'" class="d-flex gap-1 ms-auto">
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
              :class="followup_sort === 'date' ? 'btn-primary' : 'btn-outline-secondary'"
              title="Ordenar por fecha de llamada (más reciente primero)"
              @click="$store.commit('closer/set_followup_sort', 'date')"
            >
              <i class="bi bi-calendar-event me-1" aria-hidden="true" />
              Por fecha
            </button>
          </div>
        </div>

        <div v-if="loading && !tab.leads.length" class="text-center text-muted py-4">
          <span class="spinner-border spinner-border-sm me-2" aria-hidden="true" />
          Cargando…
        </div>

        <div v-else-if="!tab.leads.length" class="text-muted small py-3 px-2 closer-panel__empty">
          {{ tab.empty_message }}
        </div>

        <div v-else class="closer-panel__scroll">
          <CloserLeadCard
            v-for="lead in tab.leads"
            :key="tab.key + '-' + lead.id"
            :lead="lead"
            :section="tab.key"
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
  </div>
</template>

<script>
import CloserLeadCard from '@/components/closer/CloserLeadCard.vue'
import LeadConversationSidebar from '@/components/lead/LeadConversationSidebar.vue'

/** Intervalo de polling silencioso en milisegundos. */
const PANEL_POLL_MS = 60000

/**
 * Vista dedicada del closer: tres secciones operativas con scroll independiente.
 * En desktop muestra tres columnas; en mobile usa tabs.
 */
export default {
  name: 'CloserPanel',

  components: {
    CloserLeadCard,
    LeadConversationSidebar,
  },

  data() {
    return {
      /** Tab activa en viewport móvil. */
      active_tab: 'en_curso',
      /** true cuando el viewport es menor a md (< 768px). */
      is_mobile: false,
      /** MediaQueryList para detectar cambios de viewport. */
      mobile_media_query: null,
      /** Referencia al setInterval de polling. */
      poll_interval_id: null,

      /** Lead actualmente abierto en el sidebar lateral de conversación (null = cerrado). */
      sidebar_lead: null,
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
     * @returns {'suggestion'|'date'}
     */
    followup_sort() {
      return this.$store.state.closer.followup_sort
    },
    /**
     * Lista de leads en seguimiento ordenada según el criterio activo.
     * - 'suggestion': primero los que tienen tiene_sugerencia_pendiente = true.
     * - 'date': por closer_called_at descendente (más reciente primero).
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
          /* Dentro del mismo grupo: más reciente primero por closer_called_at. */
          var a_date = new Date(a.closer_called_at || 0).getTime()
          var b_date = new Date(b.closer_called_at || 0).getTime()
          return b_date - a_date
        })
      }
      /* Orden por fecha: más reciente primero. */
      return leads.sort(function (a, b) {
        var a_date = new Date(a.closer_called_at || 0).getTime()
        var b_date = new Date(b.closer_called_at || 0).getTime()
        return b_date - a_date
      })
    },
    /**
     * Definición de tabs/secciones con leads y mensajes vacíos.
     *
     * @returns {Array<Object>}
     */
    tabs() {
      const state = this.$store.state.closer
      return [
        {
          key: 'en_curso',
          title: 'Hoy',
          leads: state.en_curso || [],
          count: (state.en_curso || []).length,
          empty_message: 'No hay demos para hoy',
        },
        {
          key: 'agendadas',
          title: 'Demos agendadas',
          leads: state.agendadas || [],
          count: (state.agendadas || []).length,
          empty_message: 'No hay demos agendadas',
        },
        {
          key: 'seguimiento',
          title: 'En seguimiento',
          leads: this.sorted_seguimiento,
          count: this.sorted_seguimiento.length,
          empty_message: 'No hay leads en seguimiento',
        },
      ]
    },
  },

  mounted() {
    const self = this
    self.init_viewport_listener()
    self.$store.dispatch('closer/fetch_panel').catch(function () {
      return null
    })
    self.poll_interval_id = window.setInterval(function () {
      self.$store.dispatch('closer/refresh_panel').catch(function () {
        return null
      })
    }, PANEL_POLL_MS)
  },

  beforeUnmount() {
    this.teardown_viewport_listener()
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
     * Registra matchMedia para alternar layout mobile/desktop.
     *
     * @returns {void}
     */
    init_viewport_listener() {
      const self = this
      self.mobile_media_query = window.matchMedia('(max-width: 767.98px)')
      self.is_mobile = self.mobile_media_query.matches
      self.on_mobile_media_change = function () {
        self.is_mobile = self.mobile_media_query.matches
      }
      if (self.mobile_media_query.addEventListener) {
        self.mobile_media_query.addEventListener('change', self.on_mobile_media_change)
      } else {
        self.mobile_media_query.addListener(self.on_mobile_media_change)
      }
    },
    /**
     * Limpia el listener de viewport al destruir la vista.
     *
     * @returns {void}
     */
    teardown_viewport_listener() {
      if (!this.mobile_media_query || !this.on_mobile_media_change) {
        return
      }
      if (this.mobile_media_query.removeEventListener) {
        this.mobile_media_query.removeEventListener('change', this.on_mobile_media_change)
      } else {
        this.mobile_media_query.removeListener(this.on_mobile_media_change)
      }
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
     * Navega al módulo de Leads con el query param lead_id: Leads.vue detecta el
     * parámetro (en mounted() o activated(), ver fix de keep-alive en Leads.vue)
     * y abre el modal de detalle completo del lead, igual que desde el módulo de Leads.
     *
     * @param {Object} lead
     * @returns {void}
     */
    on_open_lead_modal(lead) {
      if (!lead || !lead.id) {
        return
      }
      this.$router.push({ name: 'leads', query: { lead_id: lead.id } })
    },
  },
}
</script>

<style lang="sass" scoped>
.closer-panel
	min-height: 0

.closer-panel__sections
	display: grid
	grid-template-columns: repeat(3, minmax(0, 1fr))
	gap: 1rem
	min-height: 0

.closer-panel__sections--mobile
	display: block

.closer-panel__section
	min-height: 0
	display: flex
	flex-direction: column
	background: #f8f9fa
	border-radius: 0.75rem
	padding: 0.75rem

.closer-panel__section--hidden-mobile
	display: none

.closer-panel__scroll
	flex: 1
	min-height: 0
	overflow-y: auto
	padding-right: 0.25rem

.closer-panel__empty
	background: #fff
	border-radius: 0.5rem
	border: 1px dashed #dee2e6

.closer-panel__tabs
	.nav-link
		cursor: pointer
		border: none
		background: transparent
		color: #6c757d
		&.active
			color: #0d6efd
			font-weight: 600

/* Botones compactos de ordenamiento en el encabezado de sección */
.closer-sort-btn
	font-size: 0.7rem
	padding: 0.15rem 0.45rem
	line-height: 1.4
	border-radius: 0.35rem
</style>
