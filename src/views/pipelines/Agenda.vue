<template>
  <!--
    Pipelines > Agenda (misión pipelines-crm, 27/9/2026).

    Las próximas acciones de las oportunidades ABIERTAS de los pipelines no archivados, agrupadas
    como las agrupa el back (GET pipeline-opportunities/agenda): vencidas, hoy, próximos 7 días,
    más adelante y sin próxima acción. Qué cae en cada grupo lo decide el back con su reloj; acá
    solo se pinta. Filtrable por responsable y por pipeline.
  -->
  <div class="pl-vista">
    <div class="pl-head">
      <div class="pl-head__title">
        <h2 class="h4 mb-0">Agenda</h2>
        <p class="pl-head__desc">Próximas acciones de las oportunidades abiertas.</p>
      </div>
      <button
        type="button"
        class="btn btn-outline-secondary btn-sm"
        :disabled="loading"
        title="Volver a cargar"
        aria-label="Volver a cargar"
        @click="load(false)"
      >
        <span v-if="loading" class="spinner-border spinner-border-sm" aria-hidden="true" />
        <i v-else class="bi bi-arrow-clockwise" aria-hidden="true" />
      </button>
    </div>

    <div class="pl-filters">
      <select v-model="owner_admin_id" class="form-select form-select-sm pl-filters__select" aria-label="Responsable">
        <option value="">Todos los responsables</option>
        <option v-for="admin in admins" :key="admin.id" :value="String(admin.id)">
          {{ admin.name }}{{ Number(admin.id) === Number(my_admin_id) ? ' (yo)' : '' }}
        </option>
      </select>
      <select v-model="pipeline_id" class="form-select form-select-sm pl-filters__select" aria-label="Pipeline">
        <option value="">Todos los pipelines</option>
        <option v-for="p in active_pipelines" :key="p.id" :value="String(p.id)">{{ p.name }}</option>
      </select>
    </div>

    <div v-if="loading && !loaded_once" class="text-center py-5" role="status" aria-live="polite">
      <span class="spinner-border text-primary" aria-hidden="true" />
      <p class="text-muted small mt-2 mb-0">Cargando agenda…</p>
    </div>

    <div v-else-if="load_error" class="alert alert-danger">
      {{ load_error }}
      <button type="button" class="btn btn-link btn-sm" @click="load(false)">Reintentar</button>
    </div>

    <div v-else class="pl-agenda" :class="{ 'pl-agenda--refreshing': loading }">
      <section v-for="section in sections" :key="section.key" class="pl-agenda__section">
        <button
          type="button"
          class="pl-agenda__header"
          :aria-expanded="is_open(section.key) ? 'true' : 'false'"
          @click="toggle_section(section.key)"
        >
          <span class="pl-agenda__dot" :class="'pl-agenda__dot--' + section.key" aria-hidden="true" />
          <span class="pl-agenda__title">{{ section.label }}</span>
          <span class="pl-agenda__count">{{ section.items.length }}</span>
          <i class="bi pl-agenda__chevron" :class="is_open(section.key) ? 'bi-chevron-up' : 'bi-chevron-down'" aria-hidden="true" />
        </button>

        <div v-if="is_open(section.key)">
          <p v-if="!section.items.length" class="pl-agenda__empty">{{ section.empty }}</p>
          <div v-else class="pl-agenda__grid">
            <opportunity-card
              v-for="opportunity in section.items"
              :key="opportunity.id"
              :opportunity="opportunity"
              show_pipeline
              show_stage
              @open="open_opportunity"
              @move="open_move_modal"
            />
          </div>
        </div>
      </section>
    </div>

    <move-modal
      v-if="move_modal.show && move_pipeline"
      :key="'move-' + move_modal.key"
      :show="true"
      :opportunity="move_modal.opportunity"
      :pipeline="move_pipeline"
      @close="move_modal.show = false"
      @moved="on_moved"
      @rule-error="load(true)"
    />

    <opportunity-modal
      v-if="opportunity_modal.show"
      :key="'ficha-' + opportunity_modal.key"
      :show="true"
      :opportunity_id="opportunity_modal.opportunity_id"
      @close="on_opportunity_closed"
      @changed="load(true)"
      @deleted="on_deleted"
    />
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import OpportunityCard from '@/components/pipeline/OpportunityCard.vue'
import MoveModal from '@/components/pipeline/MoveModal.vue'
import OpportunityModal from '@/components/pipeline/OpportunityModal.vue'
import { show_toast } from '@/components/pipeline/pipeline_helpers'

/**
 * Grupos de la agenda, en el orden en que se muestran. Las claves son las del contrato
 * (`GET pipeline-opportunities/agenda`); "más adelante" y "sin próxima acción" arrancan cerrados
 * porque pueden ser largos y no son lo urgente.
 */
const SECTIONS = [
  { key: 'overdue', label: 'Vencidas', empty: 'Nada vencido.', open: true },
  { key: 'today', label: 'Hoy', empty: 'Nada para hoy.', open: true },
  { key: 'week', label: 'Próximos 7 días', empty: 'Nada en los próximos 7 días.', open: true },
  { key: 'later', label: 'Más adelante', empty: 'Nada más adelante.', open: false },
  { key: 'none', label: 'Sin próxima acción', empty: 'Todas tienen próxima acción.', open: false },
]

export default {
  name: 'ViewPipelinesAgenda',
  components: { OpportunityCard, MoveModal, OpportunityModal },
  data() {
    const open_sections = {}
    SECTIONS.forEach(function (section) {
      open_sections[section.key] = section.open
    })
    return {
      /** Filtro de responsable ("" = todos). Arranca en todos en cada entrada, como Tareas. */
      owner_admin_id: '',
      /** Filtro de pipeline ("" = todos los no archivados). */
      pipeline_id: '',
      /** Respuesta del back: `{ overdue, today, week, later, none }`. */
      agenda: {},
      loading: false,
      loaded_once: false,
      load_error: null,
      request_seq: 0,
      open_sections: open_sections,
      move_modal: { show: false, opportunity: null, key: 0 },
      opportunity_modal: { show: false, opportunity_id: null, key: 0 },
    }
  },
  computed: {
    /** @returns {Array<Object>} */
    admins() {
      return this.$store.state.pipeline.admins || []
    },
    /** @returns {Array<Object>} */
    active_pipelines() {
      return this.$store.getters['pipeline/active_pipelines']
    },
    /** @returns {number|null} */
    my_admin_id() {
      const me = this.$store.state.auth.admin
      return me ? me.id : null
    },
    /** @returns {Array<Object>} Grupos con sus oportunidades. */
    sections() {
      const agenda = this.agenda || {}
      return SECTIONS.map(function (section) {
        const items = agenda[section.key]
        return Object.assign({}, section, { items: Array.isArray(items) ? items : [] })
      })
    },
    /**
     * Pipeline completo (etapas, campos, motivos) de la oportunidad que se va a mover: la agenda
     * trae solo `{id, name}`, el resto sale de la lista del store.
     * @returns {Object|null}
     */
    move_pipeline() {
      const opportunity = this.move_modal.opportunity
      if (!opportunity) {
        return null
      }
      const id = opportunity.pipeline_id || (opportunity.pipeline && opportunity.pipeline.id)
      return this.$store.getters['pipeline/pipeline_by_id'](id)
    },
  },
  watch: {
    owner_admin_id: function () {
      this.load(false)
    },
    pipeline_id: function () {
      this.load(false)
    },
  },
  created() {
    this.$store.dispatch('pipeline/fetch_meta')
    this.$store.dispatch('pipeline/fetch_admins')
    this.$store.dispatch('pipeline/fetch_pipelines').catch(function () {
      return null
    })
    this.load(false)
  },
  methods: {
    /**
     * GET pipeline-opportunities/agenda con los filtros. `silent` = sin spinner.
     *
     * @param {boolean} silent
     */
    load(silent) {
      const self = this
      const params = {}
      if (this.owner_admin_id) {
        params.owner_admin_id = this.owner_admin_id
      }
      if (this.pipeline_id) {
        params.pipeline_id = this.pipeline_id
      }
      this.request_seq = this.request_seq + 1
      const seq = this.request_seq
      if (!silent) {
        this.loading = true
      }
      api
        .get('/pipeline-opportunities/agenda', { params: params })
        .then(function (res) {
          if (seq !== self.request_seq) {
            return
          }
          self.agenda = res.data || {}
          self.loading = false
          self.loaded_once = true
          self.load_error = null
        })
        .catch(function (error) {
          if (seq !== self.request_seq) {
            return
          }
          self.loading = false
          if (!self.loaded_once) {
            self.load_error = resolve_error_message(error)
          }
        })
    },
    /**
     * @param {string} key
     * @returns {boolean}
     */
    is_open(key) {
      return !!this.open_sections[key]
    },
    /**
     * @param {string} key
     */
    toggle_section(key) {
      this.open_sections = Object.assign({}, this.open_sections, { [key]: !this.open_sections[key] })
    },
    /**
     * @param {Object} opportunity
     */
    open_opportunity(opportunity) {
      this.opportunity_modal = {
        show: true,
        opportunity_id: opportunity.id,
        key: this.opportunity_modal.key + 1,
      }
    },
    /**
     * Al cerrar la ficha se recarga la agenda: si se cerró con un guardado todavía en vuelo, su
     * `changed` no llega y la agenda quedaría vieja.
     */
    on_opportunity_closed() {
      this.opportunity_modal = { show: false, opportunity_id: null, key: this.opportunity_modal.key }
      this.load(true)
    },
    /**
     * Abre el modal de mover. Necesita el pipeline completo (etapas y campos), que sale de la lista
     * del store: si todavía no está (o falló la carga), se pide acá y recién ahí se abre; si ni así
     * aparece, se avisa en vez de no hacer nada.
     *
     * @param {Object} opportunity
     */
    open_move_modal(opportunity) {
      const self = this
      const pipeline_id = opportunity.pipeline_id || (opportunity.pipeline && opportunity.pipeline.id)
      const get = this.$store.getters['pipeline/pipeline_by_id']
      const open = function () {
        self.move_modal = { show: true, opportunity: opportunity, key: self.move_modal.key + 1 }
      }
      if (get(pipeline_id)) {
        open()
        return
      }
      show_toast('Cargando el pipeline…', 'info')
      this.$store
        .dispatch('pipeline/fetch_pipelines')
        .then(function () {
          if (get(pipeline_id)) {
            open()
          } else {
            show_toast('No se encontró el pipeline de esta oportunidad: recargá la agenda.', 'warning')
          }
        })
        .catch(function () {
          // El toast del error ya lo mostró el cliente HTTP.
          return null
        })
    },
    /**
     * @param {{ opportunity: Object }} payload
     */
    on_moved(payload) {
      this.move_modal = { show: false, opportunity: null, key: this.move_modal.key }
      const updated = payload && payload.opportunity
      show_toast(updated && updated.stage ? 'Pasó a «' + updated.stage.name + '».' : 'Oportunidad movida.')
      this.load(true)
    },
    on_deleted() {
      this.opportunity_modal = { show: false, opportunity_id: null, key: this.opportunity_modal.key }
      this.load(true)
    },
  },
}
</script>

<style scoped>
.pl-vista {
  min-width: 0;
  max-width: 100%;
  padding-top: 0.5rem;
}

.pl-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.pl-head__title {
  min-width: 0;
}

.pl-head__desc {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.pl-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.pl-filters__select {
  flex: 0 1 15rem;
  width: auto;
  min-width: 0;
}

@media (max-width: 575.98px) {
  .pl-filters__select {
    flex: 1 1 100%;
  }
}

.pl-agenda {
  transition: opacity 0.15s ease;
}

.pl-agenda--refreshing {
  opacity: 0.65;
}

.pl-agenda__section {
  margin-bottom: 1rem;
}

.pl-agenda__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.4rem 0.1rem;
  margin-bottom: 0.5rem;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--color-border-secondary);
  text-align: left;
  color: var(--color-text-primary);
}

.pl-agenda__dot {
  flex: 0 0 auto;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--color-border);
}

.pl-agenda__dot--overdue {
  background: var(--bs-danger);
}

.pl-agenda__dot--today {
  background: var(--color-primary);
}

.pl-agenda__dot--week {
  background: #6c757d;
}

.pl-agenda__title {
  font-size: 0.95rem;
  font-weight: 600;
}

.pl-agenda__count {
  min-width: 1.5rem;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  background: var(--bg-hover);
  font-size: 0.75rem;
  font-weight: 600;
  text-align: center;
  color: var(--color-text-secondary);
}

.pl-agenda__chevron {
  margin-left: auto;
  color: var(--color-text-secondary);
}

.pl-agenda__empty {
  margin: 0 0 0.25rem;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

/* Tres tarjetas por fila en escritorio, dos en tablet, una en teléfono (como Tareas). */
.pl-agenda__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

@media (max-width: 1199.98px) {
  .pl-agenda__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 767.98px) {
  .pl-agenda__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
