<template>
  <!--
    Pestaña "Pipelines" del modal del cliente y del modal del lead (misión pipelines-crm, 27/9/2026).

    Lista las oportunidades del sujeto en todos los pipelines (GET pipeline-opportunities con
    client_id o lead_id): primero las abiertas, después las cerradas. Click abre la ficha encima
    de este modal. "Agregar a un pipeline" lo suma a uno donde no tenga una abierta.

    El tipo de sujeto sale del prop `subject_type` o, si no viene (el modal genérico no lo pasa),
    del `model_name` del modal: `client` o `lead`.
  -->
  <div class="p-3 pl-subject-tab">
    <p v-if="!record || !record.id" class="text-muted small fst-italic mb-0">
      Guardá el {{ subject_label }} primero para sumarlo a un pipeline.
    </p>

    <div v-else-if="loading && !loaded_once" class="text-center py-4" role="status" aria-live="polite">
      <span class="spinner-border spinner-border-sm text-primary" aria-hidden="true" />
      <p class="text-muted small mt-2 mb-0">Cargando oportunidades…</p>
    </div>

    <div v-else-if="load_error" class="alert alert-danger py-2 small mb-0">
      {{ load_error }}
      <button type="button" class="btn btn-link btn-sm p-0 ms-1" @click="load(false)">Reintentar</button>
    </div>

    <template v-else>
      <div class="pl-subject-tab__head">
        <strong class="small">Oportunidades en pipelines</strong>
        <button type="button" class="btn btn-outline-primary btn-sm" @click="toggle_add">
          {{ add.show ? 'Cancelar' : 'Agregar a un pipeline' }}
        </button>
      </div>

      <!-- Alta en un pipeline -->
      <div v-if="add.show" class="pl-subject-add">
        <p v-if="!available_pipelines.length" class="small text-muted mb-0">
          {{ active_pipelines.length ? 'Ya tiene una oportunidad abierta en todos los pipelines activos.' : 'No hay pipelines activos.' }}
        </p>
        <template v-else>
          <div class="pl-subject-add__grid">
            <div>
              <label class="form-label mb-1" :for="uid + '-pipeline'">Pipeline</label>
              <select
                :id="uid + '-pipeline'"
                v-model="add.pipeline_id"
                class="form-select form-select-sm"
                @change="on_add_pipeline_change"
              >
                <option v-for="p in available_pipelines" :key="p.id" :value="String(p.id)">{{ p.name }}</option>
              </select>
            </div>
            <div>
              <label class="form-label mb-1" :for="uid + '-etapa'">Etapa</label>
              <select
                :id="uid + '-etapa'"
                v-model="add.stage_id"
                class="form-select form-select-sm"
                :class="{ 'is-invalid': !!add_error('stage_id') }"
              >
                <option v-for="stage in add_open_stages" :key="stage.id" :value="String(stage.id)">{{ stage.name }}</option>
              </select>
              <div v-if="add_error('stage_id')" class="invalid-feedback d-block">{{ add_error('stage_id') }}</div>
            </div>
            <div>
              <label class="form-label mb-1" :for="uid + '-responsable'">Responsable</label>
              <select
                :id="uid + '-responsable'"
                v-model="add.owner_value"
                class="form-select form-select-sm"
                :class="{ 'is-invalid': !!add_error('owner_admin_id') }"
              >
                <option value="">Sin responsable</option>
                <option v-for="admin in admins" :key="admin.id" :value="String(admin.id)">{{ admin.name }}</option>
              </select>
              <div v-if="add_error('owner_admin_id')" class="invalid-feedback d-block">{{ add_error('owner_admin_id') }}</div>
            </div>
            <div class="pl-subject-add__note">
              <label class="form-label mb-1" :for="uid + '-nota'">Nota</label>
              <input
                :id="uid + '-nota'"
                v-model="add.note"
                type="text"
                class="form-control form-control-sm"
                :class="{ 'is-invalid': !!add_error('note') }"
                placeholder="Opcional"
              />
              <div v-if="add_error('note')" class="invalid-feedback d-block">{{ add_error('note') }}</div>
            </div>
          </div>
          <div class="d-flex justify-content-end gap-2 mt-2">
            <button type="button" class="btn btn-secondary btn-sm" :disabled="add.saving" @click="add.show = false">Cancelar</button>
            <button type="button" class="btn btn-primary btn-sm" :disabled="add.saving || !add.pipeline_id" @click="submit_add">
              {{ add.saving ? 'Agregando…' : 'Agregar' }}
            </button>
          </div>
        </template>
      </div>

      <p v-if="!opportunities.length" class="text-muted small mb-0">Todavía no está en ningún pipeline.</p>

      <div v-else class="pl-subject-list" :class="{ 'pl-subject-list--refreshing': loading }">
        <div
          v-for="opportunity in opportunities"
          :key="opportunity.id"
          class="pl-subject-item"
          :class="{ 'pl-subject-item--closed': is_closed(opportunity) }"
          role="button"
          tabindex="0"
          :aria-label="'Abrir la oportunidad en ' + pipeline_name(opportunity)"
          @click="open_opportunity(opportunity)"
          @keydown.enter.self.prevent="open_opportunity(opportunity)"
        >
          <div class="pl-subject-item__top">
            <span class="pl-subject-item__pipeline">{{ pipeline_name(opportunity) }}</span>
            <span v-if="opportunity.pipeline && opportunity.pipeline.archived_at" class="pl-subject-item__archived">Archivado</span>
            <span class="pl-subject-item__stage"><stage-tag :stage="opportunity.stage" show_type /></span>
          </div>
          <div class="pl-subject-item__line"><next-action-text :opportunity="opportunity" /></div>
          <div v-if="last_activity_text(opportunity)" class="pl-subject-item__last">{{ last_activity_text(opportunity) }}</div>
          <div class="pl-subject-item__footer">
            <owner-avatar :owner="opportunity.owner" with_name />
            <span v-if="!is_closed(opportunity)" class="pl-subject-item__days">
              {{ days_text(opportunity) }}
            </span>
          </div>
        </div>
      </div>
    </template>

    <!-- Ficha, encima del modal del cliente/lead -->
    <opportunity-modal
      v-if="ficha.show"
      :key="'ficha-' + ficha.key"
      :show="true"
      :opportunity_id="ficha.opportunity_id"
      :stack_level="1"
      @close="ficha.show = false"
      @changed="load(true)"
      @deleted="on_deleted"
    />
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import NextActionText from './NextActionText.vue'
import OpportunityModal from './OpportunityModal.vue'
import OwnerAvatar from './OwnerAvatar.vue'
import StageTag from './StageTag.vue'
import {
  first_error,
  first_open_stage,
  show_toast,
  sort_stages_for_board,
  validation_errors,
} from './pipeline_helpers'
import { format_relative } from '@/utils/pipeline_dates'

/** Contador para ids únicos de los controles (puede haber dos modales con esta pestaña). */
let instance_seq = 0

export default {
  name: 'PipelineSubjectPipelinesTab',
  components: { NextActionText, OpportunityModal, OwnerAvatar, StageTag },
  props: {
    /** Borrador del modal (no se usa: la pestaña no escribe en el formulario del cliente/lead). */
    draft: { type: Object, default: null },
    /** Cliente o lead abierto en el modal. */
    record: { type: Object, default: null },
    /** Meta del modelo (no se usa). */
    all_properties: { type: Array, default: function () { return [] } },
    /** `client` | `lead`, lo pasa el modal genérico. */
    model_name: { type: String, default: '' },
    /** Pestaña activa del modal (no se usa). */
    parent_active_tab: { type: String, default: null },
    /** Tipo de sujeto explícito; si no viene, se deduce de `model_name`. */
    subject_type: { type: String, default: '' },
  },
  data() {
    instance_seq = instance_seq + 1
    return {
      uid: 'pl-subject-' + instance_seq,
      opportunities: [],
      loading: false,
      loaded_once: false,
      load_error: null,
      request_seq: 0,
      add: this.empty_add_form(),
      ficha: { show: false, opportunity_id: null, key: 0 },
    }
  },
  computed: {
    /** @returns {string} `client` | `lead` */
    effective_subject_type() {
      if (this.subject_type === 'client' || this.subject_type === 'lead') {
        return this.subject_type
      }
      return this.model_name === 'lead' ? 'lead' : 'client'
    },
    /** @returns {string} */
    subject_label() {
      return this.effective_subject_type === 'lead' ? 'lead' : 'cliente'
    },
    /** @returns {Array<Object>} */
    admins() {
      return this.$store.state.pipeline.admins || []
    },
    /** @returns {Array<Object>} */
    active_pipelines() {
      return this.$store.getters['pipeline/active_pipelines']
    },
    /**
     * Pipelines activos donde el sujeto NO tiene una oportunidad abierta (la regla de "una abierta
     * por pipeline" la hace cumplir el back; esto solo evita ofrecer lo que va a rebotar).
     * @returns {Array<Object>}
     */
    available_pipelines() {
      const busy_ids = []
      this.opportunities.forEach(function (opportunity) {
        if (opportunity.stage && opportunity.stage.type === 'open') {
          busy_ids.push(Number(opportunity.pipeline_id))
        }
      })
      return this.active_pipelines.filter(function (p) {
        return busy_ids.indexOf(Number(p.id)) === -1
      })
    },
    /** @returns {Array<Object>} Etapas abiertas del pipeline elegido en el alta. */
    add_open_stages() {
      const pipeline = this.$store.getters['pipeline/pipeline_by_id'](this.add.pipeline_id)
      return sort_stages_for_board((pipeline && pipeline.stages) || []).filter(function (s) {
        return s.type === 'open'
      })
    },
  },
  watch: {
    /** Otro cliente/lead en el mismo modal: todo de cero. */
    'record.id': function (new_id, old_id) {
      if (new_id && new_id !== old_id) {
        this.opportunities = []
        this.loaded_once = false
        this.add = this.empty_add_form()
        this.ficha = { show: false, opportunity_id: null, key: this.ficha.key }
        this.load(false)
      }
    },
  },
  created() {
    this.$store.dispatch('pipeline/fetch_meta')
    this.$store.dispatch('pipeline/fetch_admins')
    if (!this.$store.state.pipeline.pipelines_loaded) {
      this.$store.dispatch('pipeline/fetch_pipelines').catch(function () {
        return null
      })
    }
    this.load(false)
  },
  methods: {
    /**
     * Formulario de alta vacío (responsable = el operador logueado).
     * @returns {Object}
     */
    empty_add_form() {
      const me = this.$store.state.auth.admin
      return {
        show: false,
        pipeline_id: '',
        stage_id: '',
        owner_value: me && me.id ? String(me.id) : '',
        note: '',
        errors: {},
        saving: false,
      }
    },
    /**
     * GET pipeline-opportunities?client_id= (o lead_id=). `silent` = sin spinner.
     *
     * @param {boolean} silent
     */
    load(silent) {
      const self = this
      if (!this.record || !this.record.id) {
        return
      }
      const record_id = this.record.id
      const params = {}
      params[this.effective_subject_type === 'lead' ? 'lead_id' : 'client_id'] = record_id
      this.request_seq = this.request_seq + 1
      const seq = this.request_seq
      if (!silent) {
        this.loading = true
        this.load_error = null
      }
      api
        .get('/pipeline-opportunities', { params: params })
        .then(function (res) {
          if (seq !== self.request_seq || !self.record || self.record.id !== record_id) {
            return
          }
          const data = res.data || {}
          self.opportunities = Array.isArray(data.opportunities) ? data.opportunities : []
          self.loading = false
          self.loaded_once = true
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
     * @param {Object} opportunity
     * @returns {boolean}
     */
    is_closed(opportunity) {
      return !!opportunity.stage && opportunity.stage.type !== 'open'
    },
    /**
     * @param {Object} opportunity
     * @returns {string}
     */
    pipeline_name(opportunity) {
      return opportunity.pipeline && opportunity.pipeline.name ? opportunity.pipeline.name : 'Pipeline'
    },
    /**
     * @param {Object} opportunity
     * @returns {string}
     */
    days_text(opportunity) {
      const days = Number(opportunity.days_in_stage) || 0
      return days === 1 ? '1 día en la etapa' : days + ' días en la etapa'
    },
    /**
     * @param {Object} opportunity
     * @returns {string}
     */
    last_activity_text(opportunity) {
      const activity = opportunity.last_activity
      if (!activity) {
        return ''
      }
      const text = activity.body
        ? String(activity.body).replace(/\s+/g, ' ').trim()
        : this.$store.getters['pipeline/label_for']('activity_types', activity.type)
      const who = activity.admin_name ? activity.admin_name + ': ' : ''
      const when = format_relative(activity.occurred_at)
      return who + text + (when ? ' · ' + when : '')
    },
    /**
     * @param {string} key
     * @returns {string}
     */
    add_error(key) {
      return first_error(this.add.errors, key)
    },
    /**
     * Abre o cierra el alta. Al abrir se trae la lista de pipelines al día y se preelige el
     * primero disponible con su primera etapa abierta.
     */
    toggle_add() {
      const self = this
      if (this.add.show) {
        this.add.show = false
        return
      }
      this.add = Object.assign(this.empty_add_form(), { show: true })
      this.preselect_add_pipeline()
      this.$store
        .dispatch('pipeline/fetch_pipelines')
        .then(function () {
          if (self.add.show && !self.add.pipeline_id) {
            self.preselect_add_pipeline()
          }
        })
        .catch(function () {
          return null
        })
    },
    preselect_add_pipeline() {
      const first = this.available_pipelines[0]
      this.add.pipeline_id = first ? String(first.id) : ''
      this.on_add_pipeline_change()
    },
    /**
     * Al cambiar de pipeline en el alta, la etapa vuelve a la primera abierta de ese pipeline.
     */
    on_add_pipeline_change() {
      const pipeline = this.$store.getters['pipeline/pipeline_by_id'](this.add.pipeline_id)
      const stage = first_open_stage(pipeline)
      this.add.stage_id = stage ? String(stage.id) : ''
      this.add.errors = {}
    },
    /**
     * POST pipelines/{id}/opportunities con este sujeto solo.
     */
    submit_add() {
      const self = this
      if (!this.record || !this.record.id || this.add.saving || !this.add.pipeline_id) {
        return
      }
      const pipeline = this.$store.getters['pipeline/pipeline_by_id'](this.add.pipeline_id)
      const pipeline_label = pipeline ? '«' + pipeline.name + '»' : 'el pipeline'
      const payload = {
        subjects: [{ type: this.effective_subject_type, id: this.record.id }],
        owner_admin_id: this.add.owner_value === '' ? null : Number(this.add.owner_value),
      }
      if (this.add.stage_id !== '') {
        payload.stage_id = Number(this.add.stage_id)
      }
      if (this.add.note.trim() !== '') {
        payload.note = this.add.note.trim()
      }
      this.add.saving = true
      this.add.errors = {}
      api
        .post('/pipelines/' + this.add.pipeline_id + '/opportunities', payload)
        .then(function (res) {
          const data = res.data || {}
          const created = Array.isArray(data.created) ? data.created.length : 0
          const skipped = Array.isArray(data.skipped) ? data.skipped : []
          self.add.saving = false
          if (created > 0) {
            self.add.show = false
            show_toast('Agregado a ' + pipeline_label + '.')
          } else if (skipped.length && skipped[0].reason === 'already_open') {
            show_toast('Ya tiene una oportunidad abierta en ' + pipeline_label + '.', 'warning')
          } else {
            show_toast('No se pudo agregar: no se encontró el ' + self.subject_label + '.', 'warning')
          }
          self.load(true)
        })
        .catch(function (error) {
          self.add.saving = false
          self.add.errors = validation_errors(error)
        })
    },
    /**
     * @param {Object} opportunity
     */
    open_opportunity(opportunity) {
      this.ficha = { show: true, opportunity_id: opportunity.id, key: this.ficha.key + 1 }
    },
    on_deleted() {
      this.ficha = { show: false, opportunity_id: null, key: this.ficha.key }
      this.load(true)
    },
  },
}
</script>

<style scoped>
.pl-subject-tab__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.pl-subject-add {
  padding: 0.9rem;
  margin-bottom: 1rem;
  background: var(--bg-section);
  border: 1px solid var(--color-border-secondary);
  border-radius: 12px;
}

.pl-subject-add__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem 0.75rem;
}

.pl-subject-add__note {
  grid-column: 1 / -1;
}

@media (max-width: 767.98px) {
  .pl-subject-add__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.pl-subject-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
  transition: opacity 0.15s ease;
}

.pl-subject-list--refreshing {
  opacity: 0.65;
}

@media (max-width: 767.98px) {
  .pl-subject-list {
    grid-template-columns: minmax(0, 1fr);
  }
}

.pl-subject-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
  padding: 0.7rem 0.8rem;
  background: var(--bg-card);
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  font-size: 0.85rem;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s ease;
}

.pl-subject-item:hover {
  border-color: var(--color-border);
}

.pl-subject-item:focus-visible {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--form-focus-ring);
}

.pl-subject-item--closed {
  background: var(--bg-section);
}

.pl-subject-item__top {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem 0.5rem;
}

.pl-subject-item__pipeline {
  font-weight: 600;
  font-size: 0.9rem;
  min-width: 0;
  word-break: break-word;
}

.pl-subject-item__archived {
  font-size: 0.65rem;
  font-weight: 600;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: var(--bs-warning-bg-subtle);
  color: var(--bs-warning-text-emphasis);
}

.pl-subject-item__stage {
  display: flex;
  margin-left: auto;
  min-width: 0;
  max-width: 100%;
}

.pl-subject-item__line {
  display: flex;
  min-width: 0;
  font-size: 0.8rem;
}

.pl-subject-item__last {
  font-size: 0.78rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pl-subject-item__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  min-width: 0;
}

.pl-subject-item__days {
  flex: 0 0 auto;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}
</style>
