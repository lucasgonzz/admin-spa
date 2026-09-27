<template>
  <!--
    Pipelines > Configuración (misión pipelines-crm, 27/9/2026).

    ABM de pipelines (nombre, descripción, motivos de pérdida, archivar, borrar) y de sus etapas
    (nombre, color, tipo abierta/ganada/perdida, orden y los campos que pide cada una al entrar).
    Todo lo que es regla (no cambiar el tipo de una etapa con oportunidades, no quedarse sin una
    etapa abierta, no borrar un pipeline con oportunidades, definiciones de campos válidas) lo
    decide el back y llega como 422: el toast lo dice y el formulario marca el campo.
  -->
  <div class="pl-vista">
    <div class="pl-head">
      <div class="pl-head__title">
        <h2 class="h4 mb-0">Configuración de pipelines</h2>
        <p class="pl-head__desc">Etapas, lo que pide cada una al entrar y los motivos de pérdida.</p>
      </div>
      <button type="button" class="btn btn-primary btn-sm" @click="open_new_pipeline">
        <i class="bi bi-plus-lg me-1" aria-hidden="true" />Nuevo pipeline
      </button>
    </div>

    <div v-if="load_error" class="alert alert-danger d-flex flex-wrap align-items-center gap-2">
      <span>{{ load_error }}</span>
      <button type="button" class="btn btn-outline-danger btn-sm ms-auto" @click="load_pipelines">Reintentar</button>
    </div>

    <div v-else-if="!pipelines_loaded" class="text-center py-5" role="status" aria-live="polite">
      <span class="spinner-border text-primary" aria-hidden="true" />
      <p class="text-muted small mt-2 mb-0">Cargando pipelines…</p>
    </div>

    <div v-else-if="!all_pipelines.length" class="pl-empty">
      <i class="bi bi-kanban pl-empty__icon" aria-hidden="true" />
      <p class="mb-1 fw-semibold">Todavía no hay pipelines.</p>
      <p class="text-muted small mb-3">Un pipeline es una campaña con sus etapas (por ejemplo, ofrecer los agentes a los clientes).</p>
      <button type="button" class="btn btn-primary btn-sm" @click="open_new_pipeline">Crear el primero</button>
    </div>

    <div v-else class="pl-config">
      <!-- Lista de pipelines -->
      <aside class="pl-config__list">
        <div class="pl-config__items">
          <button
            v-for="p in listed_pipelines"
            :key="p.id"
            type="button"
            class="pl-config__item"
            :class="{ 'pl-config__item--active': Number(p.id) === Number(selected_id) }"
            :aria-current="Number(p.id) === Number(selected_id) ? 'true' : 'false'"
            @click="select_pipeline(p.id)"
          >
            <span class="pl-config__item-name">{{ p.name }}</span>
            <span class="pl-config__item-meta">
              {{ total_of(p) }} {{ total_of(p) === 1 ? 'oportunidad' : 'oportunidades' }}
              <span v-if="p.archived_at" class="pl-config__item-archived">Archivado</span>
            </span>
          </button>
        </div>
        <div v-if="archived_pipelines.length" class="form-check form-switch mt-2 ms-1">
          <input id="pl-config-archivados" v-model="show_archived" class="form-check-input" type="checkbox" />
          <label class="form-check-label small" for="pl-config-archivados">
            Ver archivados ({{ archived_pipelines.length }})
          </label>
        </div>
      </aside>

      <!-- Editor del pipeline elegido -->
      <section v-if="selected" class="pl-config__editor">
        <div class="pl-panel">
          <div class="pl-panel__head">
            <h3 class="pl-panel__title">
              Datos
              <span v-if="selected.archived_at" class="pl-config__item-archived">Archivado</span>
            </h3>
            <div class="pl-panel__actions">
              <router-link class="btn btn-link btn-sm" :to="'/pipelines/tablero?pipeline=' + selected.id">Ver tablero</router-link>
              <button type="button" class="btn btn-outline-secondary btn-sm" :disabled="busy" @click="toggle_archived">
                {{ selected.archived_at ? 'Desarchivar' : 'Archivar' }}
              </button>
              <button type="button" class="btn btn-outline-danger btn-sm" :disabled="busy" @click="delete_pipeline">Borrar</button>
            </div>
          </div>

          <div class="pl-form-grid">
            <div>
              <label class="form-label mb-1" for="pl-config-nombre">Nombre</label>
              <input
                id="pl-config-nombre"
                v-model="pipeline_form.name"
                type="text"
                class="form-control"
                :class="{ 'is-invalid': !!pipeline_error('name') }"
              />
              <div v-if="pipeline_error('name')" class="invalid-feedback d-block">{{ pipeline_error('name') }}</div>
            </div>
            <div>
              <label class="form-label mb-1" for="pl-config-descripcion">Descripción</label>
              <textarea
                id="pl-config-descripcion"
                v-model="pipeline_form.description"
                rows="2"
                class="form-control"
                :class="{ 'is-invalid': !!pipeline_error('description') }"
              />
              <div v-if="pipeline_error('description')" class="invalid-feedback d-block">{{ pipeline_error('description') }}</div>
            </div>
          </div>

          <div class="mt-3">
            <p class="form-label mb-1">Motivos de pérdida</p>
            <p class="pl-hint">Se ofrecen al pasar una oportunidad a una etapa perdida (además de escribir otro).</p>
            <div class="pl-reasons">
              <span v-for="(reason, index) in pipeline_form.lost_reasons" :key="index + '-' + reason" class="pl-reason">
                {{ reason }}
                <button
                  type="button"
                  class="pl-reason__remove"
                  :aria-label="'Quitar el motivo ' + reason"
                  @click="remove_reason(index)"
                >
                  <i class="bi bi-x" aria-hidden="true" />
                </button>
              </span>
              <span v-if="!pipeline_form.lost_reasons.length" class="text-muted small">Sin motivos cargados.</span>
            </div>
            <div class="pl-reasons__add">
              <input
                v-model="new_reason"
                type="text"
                class="form-control form-control-sm"
                placeholder="Nuevo motivo"
                aria-label="Nuevo motivo de pérdida"
                @keydown.enter.prevent="add_reason"
              />
              <button type="button" class="btn btn-outline-secondary btn-sm" @click="add_reason">Agregar</button>
            </div>
            <div v-for="message in lost_reasons_errors" :key="message" class="invalid-feedback d-block">{{ message }}</div>
          </div>

          <div class="pl-panel__footer">
            <span v-if="pipeline_dirty" class="pl-hint mb-0">Hay cambios sin guardar.</span>
            <button
              v-if="pipeline_dirty"
              type="button"
              class="btn btn-link btn-sm"
              :disabled="saving_pipeline"
              @click="reset_pipeline_form"
            >
              Descartar
            </button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="saving_pipeline || !pipeline_dirty"
              @click="save_pipeline"
            >
              {{ saving_pipeline ? 'Guardando…' : 'Guardar cambios' }}
            </button>
          </div>
        </div>

        <div class="pl-panel">
          <div class="pl-panel__head">
            <h3 class="pl-panel__title">Etapas</h3>
            <button type="button" class="btn btn-outline-primary btn-sm" @click="open_new_stage">
              <i class="bi bi-plus-lg me-1" aria-hidden="true" />Agregar etapa
            </button>
          </div>
          <p class="pl-hint">Las abiertas van en el orden que elijas; las cerradas (ganada / perdida) siempre quedan al final del tablero.</p>

          <ol class="pl-stages">
            <li v-for="(stage, index) in ordered_stages" :key="stage.id" class="pl-stages__row">
              <div class="pl-stages__order">
                <button
                  type="button"
                  class="btn btn-sm btn-light"
                  :disabled="!can_move_stage(index, -1) || busy"
                  :aria-label="'Subir la etapa ' + stage.name"
                  title="Subir"
                  @click="move_stage(index, -1)"
                >
                  <i class="bi bi-arrow-up" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-light"
                  :disabled="!can_move_stage(index, 1) || busy"
                  :aria-label="'Bajar la etapa ' + stage.name"
                  title="Bajar"
                  @click="move_stage(index, 1)"
                >
                  <i class="bi bi-arrow-down" aria-hidden="true" />
                </button>
              </div>
              <span class="pl-stages__dot" :style="{ backgroundColor: stage.color || '#adb5bd' }" aria-hidden="true" />
              <div class="pl-stages__info">
                <span class="pl-stages__name">{{ stage.name }}</span>
                <span class="pl-stages__meta">
                  {{ stage_type_label(stage.type) }}
                  · {{ Number(stage.opportunities_count) || 0 }} {{ Number(stage.opportunities_count) === 1 ? 'oportunidad' : 'oportunidades' }}
                  · {{ fields_count(stage) }} {{ fields_count(stage) === 1 ? 'campo' : 'campos' }}
                </span>
              </div>
              <div class="pl-stages__actions">
                <button type="button" class="btn btn-outline-secondary btn-sm" @click="open_edit_stage(stage)">Editar</button>
                <button
                  type="button"
                  class="btn btn-outline-danger btn-sm"
                  :disabled="busy"
                  :aria-label="'Borrar la etapa ' + stage.name"
                  title="Borrar"
                  @click="delete_stage(stage)"
                >
                  <i class="bi bi-trash" aria-hidden="true" />
                </button>
              </div>
            </li>
          </ol>
        </div>
      </section>
    </div>

    <!-- Alta / edición de etapa -->
    <base-modal
      v-if="stage_modal.show"
      :key="'etapa-' + stage_modal.key"
      :show="true"
      :title="stage_modal.form.id ? 'Editar etapa' : 'Nueva etapa'"
      size="lg"
      @close="close_stage_modal"
    >
      <div class="pl-form-grid">
        <div>
          <label class="form-label mb-1" for="pl-etapa-nombre">Nombre</label>
          <input
            id="pl-etapa-nombre"
            v-model="stage_modal.form.name"
            type="text"
            class="form-control"
            :class="{ 'is-invalid': !!stage_error('name') }"
          />
          <div v-if="stage_error('name')" class="invalid-feedback d-block">{{ stage_error('name') }}</div>
        </div>
        <div>
          <label class="form-label mb-1" for="pl-etapa-tipo">Tipo</label>
          <select
            id="pl-etapa-tipo"
            v-model="stage_modal.form.type"
            class="form-select"
            :class="{ 'is-invalid': !!stage_error('type') }"
          >
            <option v-for="type in stage_type_options" :key="type.value" :value="type.value">{{ type.label }}</option>
          </select>
          <p v-if="stage_modal.opportunities_count > 0" class="pl-hint mb-0 mt-1">
            Tiene {{ stage_modal.opportunities_count }}
            {{ stage_modal.opportunities_count === 1 ? 'oportunidad' : 'oportunidades' }}: mientras tenga, el tipo no se puede cambiar.
          </p>
          <div v-if="stage_error('type')" class="invalid-feedback d-block">{{ stage_error('type') }}</div>
        </div>
      </div>

      <div class="mt-3">
        <p class="form-label mb-1">Color</p>
        <div class="pl-colors">
          <button
            v-for="color in color_presets"
            :key="color"
            type="button"
            class="pl-colors__swatch"
            :class="{ 'pl-colors__swatch--selected': String(stage_modal.form.color).toLowerCase() === color }"
            :style="{ backgroundColor: color }"
            :aria-label="'Color ' + color"
            :title="color"
            @click="stage_modal.form.color = color"
          />
          <input
            v-model="stage_modal.form.color"
            type="color"
            class="form-control form-control-color pl-colors__picker"
            aria-label="Elegir otro color"
            title="Otro color"
          />
        </div>
        <div v-if="stage_error('color')" class="invalid-feedback d-block">{{ stage_error('color') }}</div>
      </div>

      <div class="mt-3">
        <p class="form-label mb-1">Campos que pide al entrar</p>
        <p class="pl-hint">
          Se completan al mover una oportunidad a esta etapa. Un campo de fecha marcado como "agenda"
          pasa a ser la próxima acción.
        </p>
        <stage-fields-editor
          v-model="stage_modal.form.field_rows"
          :field_types="field_types"
          :errors="stage_modal.errors"
        />
      </div>

      <template #footer>
        <button type="button" class="btn btn-secondary" :disabled="stage_modal.saving" @click="close_stage_modal">Cancelar</button>
        <button type="button" class="btn btn-primary" :disabled="stage_modal.saving" @click="save_stage">
          {{ stage_modal.saving ? 'Guardando…' : 'Guardar etapa' }}
        </button>
      </template>
    </base-modal>

    <!-- Pipeline nuevo -->
    <base-modal
      v-if="new_modal.show"
      :key="'nuevo-' + new_modal.key"
      :show="true"
      title="Nuevo pipeline"
      @close="close_new_pipeline"
    >
      <div class="mb-3">
        <label class="form-label mb-1" for="pl-nuevo-nombre">Nombre</label>
        <input
          id="pl-nuevo-nombre"
          v-model="new_modal.form.name"
          type="text"
          class="form-control"
          :class="{ 'is-invalid': !!new_error('name') }"
          placeholder="Ej.: Agentes"
        />
        <div v-if="new_error('name')" class="invalid-feedback d-block">{{ new_error('name') }}</div>
      </div>
      <div class="mb-3">
        <label class="form-label mb-1" for="pl-nuevo-descripcion">Descripción</label>
        <textarea
          id="pl-nuevo-descripcion"
          v-model="new_modal.form.description"
          rows="2"
          class="form-control"
          :class="{ 'is-invalid': !!new_error('description') }"
          placeholder="Para qué es esta campaña (opcional)"
        />
        <div v-if="new_error('description')" class="invalid-feedback d-block">{{ new_error('description') }}</div>
      </div>
      <div>
        <label class="form-label mb-1" for="pl-nuevo-motivos">Motivos de pérdida</label>
        <textarea
          id="pl-nuevo-motivos"
          v-model="new_modal.form.lost_reasons_text"
          rows="3"
          class="form-control"
          placeholder="Uno por línea (opcional)"
        />
        <div v-for="message in new_lost_reasons_errors" :key="message" class="invalid-feedback d-block">{{ message }}</div>
      </div>
      <p class="pl-hint mt-3 mb-0">Se crea con etapas básicas para arrancar; después las editás, agregás y reordenás acá.</p>

      <template #footer>
        <button type="button" class="btn btn-secondary" :disabled="new_modal.saving" @click="close_new_pipeline">Cancelar</button>
        <button type="button" class="btn btn-primary" :disabled="new_modal.saving" @click="create_pipeline">
          {{ new_modal.saving ? 'Creando…' : 'Crear pipeline' }}
        </button>
      </template>
    </base-modal>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import BaseModal from '@/components/ui/BaseModal.vue'
import StageFieldsEditor from '@/components/pipeline/StageFieldsEditor.vue'
import {
  STAGE_COLOR_PRESETS,
  field_definition_from_rows,
  field_rows_from_definition,
  first_error,
  is_rule_error,
  show_toast,
  sort_stages_for_board,
  validation_errors,
} from '@/components/pipeline/pipeline_helpers'

/**
 * Líneas no vacías de un texto (una opción por línea).
 *
 * @param {string} text
 * @returns {Array<string>}
 */
function lines_of(text) {
  return String(text || '').split('\n').map(function (line) {
    return line.trim()
  }).filter(function (line) {
    return line !== ''
  })
}

/**
 * Mensajes de un 422 cuyas claves empiezan con `prefix` (`lost_reasons`, `lost_reasons.2`…).
 *
 * @param {Object} errors
 * @param {string} prefix
 * @returns {Array<string>}
 */
function messages_with_prefix(errors, prefix) {
  const messages = []
  Object.keys(errors || {}).forEach(function (key) {
    if (key !== prefix && key.indexOf(prefix + '.') !== 0) {
      return
    }
    const value = errors[key]
    const list = Array.isArray(value) ? value : [value]
    list.forEach(function (message) {
      if (message && messages.indexOf(String(message)) === -1) {
        messages.push(String(message))
      }
    })
  })
  return messages
}

export default {
  name: 'ViewPipelinesConfiguracion',
  components: { BaseModal, StageFieldsEditor },
  data() {
    return {
      /** Pipeline elegido en la lista. */
      selected_id: null,
      /** true = la lista incluye los archivados. */
      show_archived: false,
      load_error: null,
      /** Borrador de los datos del pipeline elegido. */
      pipeline_form: { name: '', description: '', lost_reasons: [] },
      pipeline_errors: {},
      saving_pipeline: false,
      /** Motivo que se está tipeando. */
      new_reason: '',
      /** true mientras corre una acción sobre el pipeline o sus etapas (archivar, ordenar, borrar). */
      busy: false,
      color_presets: STAGE_COLOR_PRESETS,
      stage_modal: {
        show: false,
        key: 0,
        form: { id: null, name: '', color: '#adb5bd', type: 'open', field_rows: [] },
        opportunities_count: 0,
        errors: {},
        saving: false,
      },
      new_modal: {
        show: false,
        key: 0,
        form: { name: '', description: '', lost_reasons_text: '' },
        errors: {},
        saving: false,
      },
    }
  },
  computed: {
    /** @returns {Array<Object>} */
    all_pipelines() {
      return this.$store.state.pipeline.pipelines
    },
    /** @returns {boolean} */
    pipelines_loaded() {
      return this.$store.state.pipeline.pipelines_loaded
    },
    /** @returns {Array<Object>} */
    active_pipelines() {
      return this.$store.getters['pipeline/active_pipelines']
    },
    /** @returns {Array<Object>} */
    archived_pipelines() {
      return this.$store.getters['pipeline/archived_pipelines']
    },
    /**
     * Pipelines de la lista: los activos, más los archivados si se pidió verlos (o si el elegido es
     * uno archivado, para que no desaparezca de la lista).
     * @returns {Array<Object>}
     */
    listed_pipelines() {
      const self = this
      const archived = this.archived_pipelines.filter(function (p) {
        return self.show_archived || Number(p.id) === Number(self.selected_id)
      })
      return this.active_pipelines.concat(archived)
    },
    /** @returns {Object|null} */
    selected() {
      return this.$store.getters['pipeline/pipeline_by_id'](this.selected_id)
    },
    /** @returns {Array<Object>} Etapas en el orden del tablero. */
    ordered_stages() {
      return sort_stages_for_board((this.selected && this.selected.stages) || [])
    },
    /** @returns {Array<Object>} */
    field_types() {
      return this.$store.state.pipeline.meta.field_types || []
    },
    /**
     * Tipos de etapa del catálogo del back; si todavía no llegó, al menos el valor actual.
     * @returns {Array<{value: string, label: string}>}
     */
    stage_type_options() {
      const types = this.$store.state.pipeline.meta.stage_types || []
      if (types.length) {
        return types
      }
      const current = this.stage_modal.form.type
      return current ? [{ value: current, label: current }] : []
    },
    /** @returns {boolean} true si el formulario de datos difiere de lo guardado. */
    pipeline_dirty() {
      if (!this.selected) {
        return false
      }
      const saved = {
        name: this.selected.name || '',
        description: this.selected.description || '',
        lost_reasons: Array.isArray(this.selected.lost_reasons) ? this.selected.lost_reasons : [],
      }
      const current = {
        name: this.pipeline_form.name || '',
        description: this.pipeline_form.description || '',
        lost_reasons: this.pipeline_form.lost_reasons,
      }
      return JSON.stringify(saved) !== JSON.stringify(current)
    },
    /** @returns {Array<string>} */
    lost_reasons_errors() {
      return messages_with_prefix(this.pipeline_errors, 'lost_reasons')
    },
    /** @returns {Array<string>} */
    new_lost_reasons_errors() {
      return messages_with_prefix(this.new_modal.errors, 'lost_reasons')
    },
  },
  watch: {
    /** Otro pipeline: el borrador arranca de cero con lo guardado. */
    selected_id: function () {
      this.reset_pipeline_form()
    },
  },
  created() {
    this.$store.dispatch('pipeline/fetch_meta')
    this.load_pipelines()
  },
  methods: {
    /**
     * Trae la lista de pipelines y elige el de entrada. También es el "Reintentar" cuando falla.
     */
    load_pipelines() {
      const self = this
      this.load_error = null
      this.$store
        .dispatch('pipeline/fetch_pipelines')
        .then(function () {
          if (!self.selected_id) {
            self.resolve_initial_selection()
          }
        })
        .catch(function (error) {
          self.load_error = resolve_error_message(error)
        })
    },
    /**
     * Elige de entrada el de `?pipeline=` (el link "Configurar" del tablero) o el primero activo.
     */
    resolve_initial_selection() {
      const from_query = this.$store.getters['pipeline/pipeline_by_id'](this.$route.query.pipeline)
      const chosen = from_query || this.active_pipelines[0] || this.archived_pipelines[0] || null
      if (chosen && chosen.archived_at) {
        this.show_archived = true
      }
      this.selected_id = chosen ? chosen.id : null
    },
    /**
     * @param {number} id
     */
    select_pipeline(id) {
      if (Number(id) === Number(this.selected_id)) {
        return
      }
      if (this.pipeline_dirty && !window.confirm('Hay cambios sin guardar en los datos del pipeline. ¿Descartarlos?')) {
        return
      }
      this.selected_id = id
    },
    /**
     * Vuelve el borrador a lo guardado.
     */
    reset_pipeline_form() {
      const p = this.selected
      this.pipeline_form = {
        name: p ? p.name || '' : '',
        description: p ? p.description || '' : '',
        lost_reasons: p && Array.isArray(p.lost_reasons) ? p.lost_reasons.slice() : [],
      }
      this.pipeline_errors = {}
      this.new_reason = ''
    },
    /**
     * @param {Object} p
     * @returns {number}
     */
    total_of(p) {
      return Number(p && p.counts && p.counts.total) || 0
    },
    /**
     * @param {string} key
     * @returns {string}
     */
    pipeline_error(key) {
      return first_error(this.pipeline_errors, key)
    },
    /**
     * @param {string} key
     * @returns {string}
     */
    stage_error(key) {
      return first_error(this.stage_modal.errors, key)
    },
    /**
     * @param {string} key
     * @returns {string}
     */
    new_error(key) {
      return first_error(this.new_modal.errors, key)
    },
    /**
     * @param {string} type
     * @returns {string}
     */
    stage_type_label(type) {
      return this.$store.getters['pipeline/label_for']('stage_types', type)
    },
    /**
     * @param {Object} stage
     * @returns {number}
     */
    fields_count(stage) {
      return Array.isArray(stage.fields) ? stage.fields.length : 0
    },
    add_reason() {
      const reason = this.new_reason.trim()
      if (reason === '') {
        return
      }
      if (this.pipeline_form.lost_reasons.indexOf(reason) === -1) {
        this.pipeline_form.lost_reasons.push(reason)
      }
      this.new_reason = ''
    },
    /**
     * @param {number} index
     */
    remove_reason(index) {
      this.pipeline_form.lost_reasons.splice(index, 1)
    },
    /**
     * PUT pipelines/{id} con nombre, descripción y motivos.
     */
    save_pipeline() {
      const self = this
      if (!this.selected || this.saving_pipeline) {
        return
      }
      const payload = {
        name: this.pipeline_form.name,
        description: this.pipeline_form.description.trim() !== '' ? this.pipeline_form.description : null,
        lost_reasons: this.pipeline_form.lost_reasons.slice(),
      }
      this.saving_pipeline = true
      this.pipeline_errors = {}
      api
        .put('/pipelines/' + this.selected.id, payload)
        .then(function (res) {
          self.saving_pipeline = false
          self.$store.commit('pipeline/upsert_pipeline', (res.data || {}).pipeline)
          self.reset_pipeline_form()
          show_toast('Pipeline guardado.')
        })
        .catch(function (error) {
          self.saving_pipeline = false
          self.pipeline_errors = validation_errors(error)
        })
    },
    /**
     * Archivar / desarchivar (PUT pipelines/{id} con `archived`).
     */
    toggle_archived() {
      const self = this
      if (!this.selected || this.busy) {
        return
      }
      const archive = !this.selected.archived_at
      if (archive && !window.confirm(
        '¿Archivar «' + this.selected.name + '»? Deja de aparecer en el tablero y en la agenda; '
        + 'sus oportunidades quedan guardadas y se puede desarchivar cuando quieras.'
      )) {
        return
      }
      this.busy = true
      api
        .put('/pipelines/' + this.selected.id, { archived: archive })
        .then(function (res) {
          self.busy = false
          self.$store.commit('pipeline/upsert_pipeline', (res.data || {}).pipeline)
          if (archive) {
            self.show_archived = true
          }
          show_toast(archive ? 'Pipeline archivado: ya no aparece en el tablero ni en la agenda.' : 'Pipeline desarchivado.')
        })
        .catch(function () {
          self.busy = false
        })
    },
    /**
     * DELETE pipelines/{id}. Con oportunidades el back contesta 422 ("archivalo en vez de borrarlo").
     */
    delete_pipeline() {
      const self = this
      if (!this.selected || this.busy) {
        return
      }
      const name = this.selected.name
      if (!window.confirm('¿Borrar el pipeline «' + name + '»? Solo se puede si no tiene oportunidades.')) {
        return
      }
      const id = this.selected.id
      this.busy = true
      api
        .delete('/pipelines/' + id)
        .then(function () {
          self.busy = false
          self.$store.commit('pipeline/remove_pipeline', id)
          const next = self.active_pipelines[0] || self.archived_pipelines[0] || null
          self.selected_id = next ? next.id : null
          show_toast('Pipeline «' + name + '» borrado.')
        })
        .catch(function () {
          self.busy = false
        })
    },
    /**
     * ¿Se puede mover la etapa de la posición `index` en esa dirección? Solo dentro de su grupo
     * (abiertas con abiertas, cerradas con cerradas): el tablero muestra las cerradas al final.
     *
     * @param {number} index
     * @param {number} direction
     * @returns {boolean}
     */
    can_move_stage(index, direction) {
      const target = index + direction
      const stages = this.ordered_stages
      if (target < 0 || target >= stages.length) {
        return false
      }
      const is_open = stages[index].type === 'open'
      return (stages[target].type === 'open') === is_open
    },
    /**
     * PUT pipelines/{id}/stage-order con todas las etapas en el orden nuevo.
     *
     * @param {number} index
     * @param {number} direction
     */
    move_stage(index, direction) {
      const self = this
      if (!this.selected || this.busy || !this.can_move_stage(index, direction)) {
        return
      }
      const ids = this.ordered_stages.map(function (s) {
        return s.id
      })
      const moved = ids.splice(index, 1)[0]
      ids.splice(index + direction, 0, moved)
      this.busy = true
      api
        .put('/pipelines/' + this.selected.id + '/stage-order', { stage_ids: ids })
        .then(function (res) {
          self.busy = false
          self.$store.commit('pipeline/upsert_pipeline', (res.data || {}).pipeline)
        })
        .catch(function (error) {
          self.busy = false
          // "El orden no coincide" y parecidos: la lista de etapas que tenemos quedó vieja.
          if (is_rule_error(error)) {
            self.refresh_pipelines()
          }
        })
    },
    /**
     * DELETE pipeline-stages/{id}. El back no deja borrar una etapa con oportunidades ni la última
     * abierta (422 con el motivo).
     *
     * @param {Object} stage
     */
    delete_stage(stage) {
      const self = this
      if (this.busy) {
        return
      }
      if (!window.confirm('¿Borrar la etapa «' + stage.name + '»?')) {
        return
      }
      this.busy = true
      api
        .delete('/pipeline-stages/' + stage.id)
        .then(function () {
          self.busy = false
          show_toast('Etapa «' + stage.name + '» borrada.')
          self.refresh_pipelines()
        })
        .catch(function () {
          self.busy = false
        })
    },
    /**
     * Vuelve a traer la lista (etapas, órdenes y conteos al día) después de una escritura. Si
     * falla, el toast global ya avisó y la pantalla queda con lo que tenía.
     */
    refresh_pipelines() {
      this.$store.dispatch('pipeline/fetch_pipelines').catch(function () {
        return null
      })
    },
    open_new_stage() {
      this.stage_modal = {
        show: true,
        key: this.stage_modal.key + 1,
        form: { id: null, name: '', color: '#adb5bd', type: 'open', field_rows: [] },
        opportunities_count: 0,
        errors: {},
        saving: false,
      }
    },
    /**
     * @param {Object} stage
     */
    open_edit_stage(stage) {
      this.stage_modal = {
        show: true,
        key: this.stage_modal.key + 1,
        form: {
          id: stage.id,
          name: stage.name || '',
          color: stage.color || '#adb5bd',
          type: stage.type || 'open',
          field_rows: field_rows_from_definition(stage.fields),
        },
        opportunities_count: Number(stage.opportunities_count) || 0,
        errors: {},
        saving: false,
      }
    },
    close_stage_modal() {
      if (this.stage_modal.saving) {
        return
      }
      this.stage_modal.show = false
    },
    /**
     * POST pipelines/{id}/stages (nueva) o PUT pipeline-stages/{id} (edición). Después se vuelve a
     * traer la lista: una etapa abierta nueva corre el orden de las cerradas.
     */
    save_stage() {
      const self = this
      if (!this.selected || this.stage_modal.saving) {
        return
      }
      const form = this.stage_modal.form
      const payload = {
        name: form.name,
        color: form.color,
        type: form.type,
        fields: field_definition_from_rows(form.field_rows),
      }
      const request = form.id
        ? api.put('/pipeline-stages/' + form.id, payload)
        : api.post('/pipelines/' + this.selected.id + '/stages', payload)
      this.stage_modal.saving = true
      this.stage_modal.errors = {}
      request
        .then(function () {
          // El modal se cierra apenas el back confirma: si después fallara el refresco de la
          // lista, un segundo "Guardar" no puede terminar en una etapa duplicada.
          self.stage_modal.saving = false
          self.stage_modal.show = false
          show_toast(form.id ? 'Etapa guardada.' : 'Etapa agregada.')
          self.refresh_pipelines()
        })
        .catch(function (error) {
          self.stage_modal.saving = false
          self.stage_modal.errors = validation_errors(error)
        })
    },
    open_new_pipeline() {
      this.new_modal = {
        show: true,
        key: this.new_modal.key + 1,
        form: { name: '', description: '', lost_reasons_text: '' },
        errors: {},
        saving: false,
      }
    },
    close_new_pipeline() {
      if (this.new_modal.saving) {
        return
      }
      this.new_modal.show = false
    },
    /**
     * POST pipelines sin `stages`: el back lo crea con sus etapas por defecto.
     */
    create_pipeline() {
      const self = this
      if (this.new_modal.saving) {
        return
      }
      const form = this.new_modal.form
      const payload = {
        name: form.name,
        lost_reasons: lines_of(form.lost_reasons_text),
      }
      if (form.description.trim() !== '') {
        payload.description = form.description
      }
      this.new_modal.saving = true
      this.new_modal.errors = {}
      api
        .post('/pipelines', payload)
        .then(function (res) {
          const pipeline = (res.data || {}).pipeline
          self.new_modal.saving = false
          self.new_modal.show = false
          self.$store.commit('pipeline/upsert_pipeline', pipeline)
          if (pipeline && pipeline.id) {
            self.selected_id = pipeline.id
          }
          show_toast('Pipeline creado.')
        })
        .catch(function (error) {
          self.new_modal.saving = false
          self.new_modal.errors = validation_errors(error)
        })
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
  margin-bottom: 1rem;
}

.pl-head__title {
  min-width: 0;
}

.pl-head__desc {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.pl-hint {
  font-size: 0.78rem;
  color: var(--color-text-secondary);
  margin-bottom: 0.5rem;
}

.pl-empty {
  text-align: center;
  padding: 3rem 1rem;
  border: 1px dashed var(--color-border);
  border-radius: 12px;
  background: var(--bg-card);
}

.pl-empty__icon {
  display: block;
  font-size: 2rem;
  color: var(--color-text-secondary);
  margin-bottom: 0.5rem;
}

/* Lista a la izquierda y editor a la derecha en escritorio; apilados en tablet angosta y teléfono. */
.pl-config {
  display: grid;
  grid-template-columns: minmax(0, 15rem) minmax(0, 1fr);
  gap: 1.25rem;
  align-items: start;
}

@media (max-width: 991.98px) {
  .pl-config {
    grid-template-columns: minmax(0, 1fr);
  }
}

.pl-config__items {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

@media (max-width: 991.98px) {
  /* En angosto, la lista es una tira horizontal que scrollea sola. */
  .pl-config__items {
    flex-direction: row;
    overflow-x: auto;
    padding-bottom: 0.25rem;
    scrollbar-width: thin;
  }

  .pl-config__item {
    flex: 0 0 auto;
    max-width: 16rem;
  }
}

.pl-config__item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  text-align: left;
  color: var(--color-text-primary);
  transition: background 0.15s ease;
}

.pl-config__item:hover {
  background: var(--bg-hover);
}

.pl-config__item--active,
.pl-config__item--active:hover {
  background: var(--bg-card);
  border-color: var(--color-border);
}

.pl-config__item-name {
  font-weight: 600;
  font-size: 0.9rem;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pl-config__item-meta {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.pl-config__item-archived {
  display: inline-block;
  margin-left: 0.35rem;
  font-size: 0.65rem;
  font-weight: 600;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: var(--bs-warning-bg-subtle);
  color: var(--bs-warning-text-emphasis);
  vertical-align: middle;
}

.pl-config__editor {
  min-width: 0;
}

.pl-panel {
  background: var(--bg-card);
  border: 1px solid var(--color-border-secondary);
  border-radius: 12px;
  padding: 1rem 1.1rem;
  margin-bottom: 1rem;
}

.pl-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.pl-panel__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.pl-panel__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}

.pl-panel__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
}

.pl-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem 1rem;
}

@media (max-width: 575.98px) {
  .pl-form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.pl-reasons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.5rem;
}

.pl-reason {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.2rem 0.3rem 0.2rem 0.65rem;
  border-radius: 999px;
  background: var(--bg-hover);
  font-size: 0.82rem;
  max-width: 100%;
  word-break: break-word;
}

.pl-reason__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-secondary);
  padding: 0;
}

.pl-reason__remove:hover {
  background: var(--color-border);
  color: var(--color-text-primary);
}

.pl-reasons__add {
  display: flex;
  gap: 0.5rem;
  max-width: 26rem;
}

.pl-stages {
  list-style: none;
  padding: 0;
  margin: 0;
}

.pl-stages__row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0;
  border-top: 1px solid var(--color-border-secondary);
}

.pl-stages__order {
  display: flex;
  gap: 0.2rem;
  flex: 0 0 auto;
}

.pl-stages__order .btn,
.pl-stages__actions .btn {
  padding: 0.15rem 0.45rem;
}

.pl-stages__order .btn {
  border: 1px solid var(--color-border-secondary);
}

.pl-stages__dot {
  flex: 0 0 auto;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.pl-stages__info {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.pl-stages__name {
  font-weight: 600;
  font-size: 0.9rem;
  word-break: break-word;
}

.pl-stages__meta {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.pl-stages__actions {
  display: flex;
  gap: 0.35rem;
  flex: 0 0 auto;
}

@media (max-width: 575.98px) {
  .pl-stages__row {
    flex-wrap: wrap;
  }

  .pl-stages__actions {
    width: 100%;
    justify-content: flex-end;
  }
}

.pl-colors {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.pl-colors__swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--bg-card);
  box-shadow: 0 0 0 1px var(--color-border);
  padding: 0;
}

.pl-colors__swatch--selected {
  box-shadow: 0 0 0 2px var(--color-text-primary);
}

.pl-colors__picker {
  width: 3rem;
  min-height: 32px;
  padding: 0.2rem;
}
</style>
