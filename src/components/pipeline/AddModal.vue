<template>
  <!--
    Alta masiva de clientes y/o leads a un pipeline (POST pipelines/{id}/opportunities).

    Los candidatos salen de GET pipelines/{id}/candidates: clientes (con "solo activos", prendido de
    entrada) o leads (filtrables por estado), con búsqueda y "cargar más". Los que ya tienen una
    oportunidad abierta en este pipeline aparecen deshabilitados con "Ya está". La selección
    sobrevive a cambiar de pestaña y de búsqueda, así que se pueden mandar clientes y leads juntos.
  -->
  <base-modal
    :show="show"
    :title="modal_title"
    size="lg"
    :stack_level="stack_level"
    @close="on_cancel"
  >
    <div class="pl-add">
      <div class="pl-add__top">
        <div class="btn-group btn-group-sm" role="group" aria-label="Qué agregar">
          <button
            type="button"
            class="btn"
            :class="type === 'client' ? 'btn-secondary' : 'btn-outline-secondary'"
            :aria-pressed="type === 'client' ? 'true' : 'false'"
            @click="set_type('client')"
          >
            Clientes
          </button>
          <button
            type="button"
            class="btn"
            :class="type === 'lead' ? 'btn-secondary' : 'btn-outline-secondary'"
            :aria-pressed="type === 'lead' ? 'true' : 'false'"
            @click="set_type('lead')"
          >
            Leads
          </button>
        </div>
        <span class="pl-add__selected">
          {{ selected_count }} {{ selected_count === 1 ? 'seleccionado' : 'seleccionados' }}
          <button
            v-if="selected_count > 0"
            type="button"
            class="btn btn-link btn-sm p-0 ms-1"
            @click="clear_selection"
          >
            Limpiar
          </button>
        </span>
      </div>

      <div class="pl-add__filters">
        <input
          v-model="q_input"
          type="search"
          class="form-control form-control-sm pl-add__search"
          :placeholder="type === 'client' ? 'Buscar cliente' : 'Buscar lead'"
          aria-label="Buscar"
        />
        <div v-if="type === 'client'" class="form-check form-switch mb-0">
          <input
            id="pl-add-solo-activos"
            v-model="solo_activos"
            class="form-check-input"
            type="checkbox"
          />
          <label class="form-check-label small" for="pl-add-solo-activos">Solo activos</label>
        </div>
        <select
          v-else
          v-model="lead_status"
          class="form-select form-select-sm pl-add__status"
          aria-label="Estado del lead"
        >
          <option value="">Todos los estados</option>
          <option v-for="status in lead_statuses" :key="status.slug" :value="status.slug">{{ status.label }}</option>
        </select>
      </div>

      <div class="pl-add__list-head">
        <div class="form-check mb-0">
          <input
            id="pl-add-todos"
            class="form-check-input"
            type="checkbox"
            :checked="all_visible_selected"
            :indeterminate.prop="some_visible_selected && !all_visible_selected"
            :disabled="!selectable_visible.length"
            @change="toggle_all_visible($event.target.checked)"
          />
          <label class="form-check-label small" for="pl-add-todos">
            Seleccionar los visibles ({{ selectable_visible.length }})
          </label>
        </div>
        <span class="text-muted small">{{ total }} en total</span>
      </div>

      <div class="pl-add__list" :class="{ 'pl-add__list--loading': loading && candidates.length > 0 }">
        <p v-if="loading && !candidates.length" class="text-center text-muted small py-4 mb-0">
          <span class="spinner-border spinner-border-sm me-1" aria-hidden="true" />Buscando…
        </p>
        <p v-else-if="!candidates.length" class="text-center text-muted small py-4 mb-0">
          {{ type === 'client' ? 'No hay clientes' : 'No hay leads' }} con estos filtros.
        </p>
        <template v-else>
          <label
            v-for="candidate in candidates"
            :key="candidate.type + ':' + candidate.id"
            class="pl-add__row"
            :class="{ 'pl-add__row--disabled': !is_selectable(candidate) }"
          >
            <input
              type="checkbox"
              class="form-check-input mt-0"
              :checked="is_selected(candidate)"
              :disabled="!is_selectable(candidate)"
              @change="toggle(candidate, $event.target.checked)"
            />
            <span class="pl-add__row-text">
              <span class="pl-add__row-name">{{ candidate.name }}</span>
              <span v-if="candidate.secondary" class="pl-add__row-secondary">{{ candidate.secondary }}</span>
            </span>
            <span class="pl-add__row-tags">
              <span v-if="candidate.open_opportunity_id" class="pl-add__tag pl-add__tag--in">Ya está</span>
              <span
                v-else-if="Number(candidate.closed_count) > 0"
                class="pl-add__tag"
                :title="'Ya tuvo ' + candidate.closed_count + (Number(candidate.closed_count) === 1 ? ' oportunidad cerrada' : ' oportunidades cerradas') + ' en este pipeline'"
              >Ya pasó</span>
              <span v-if="candidate.type === 'client' && candidate.is_active === false" class="pl-add__tag">Inactivo</span>
              <span v-if="candidate.type === 'lead' && candidate.status_label" class="pl-add__tag">{{ candidate.status_label }}</span>
            </span>
          </label>
          <div v-if="has_more" class="text-center py-2">
            <button type="button" class="btn btn-link btn-sm" :disabled="loading" @click="load_candidates(true)">
              {{ loading ? 'Cargando…' : 'Cargar más' }}
            </button>
          </div>
        </template>
      </div>
      <div v-if="subjects_error" class="invalid-feedback d-block">{{ subjects_error }}</div>

      <div class="pl-add__options">
        <div>
          <label class="form-label mb-1" for="pl-add-stage">Etapa inicial</label>
          <select
            id="pl-add-stage"
            v-model="stage_id"
            class="form-select form-select-sm"
            :class="{ 'is-invalid': !!error_for('stage_id') }"
          >
            <option v-for="stage in open_stages" :key="stage.id" :value="String(stage.id)">{{ stage.name }}</option>
          </select>
          <div v-if="error_for('stage_id')" class="invalid-feedback d-block">{{ error_for('stage_id') }}</div>
        </div>
        <div>
          <label class="form-label mb-1" for="pl-add-owner">Responsable</label>
          <select
            id="pl-add-owner"
            v-model="owner_value"
            class="form-select form-select-sm"
            :class="{ 'is-invalid': !!error_for('owner_admin_id') }"
          >
            <option value="">Sin responsable</option>
            <option v-for="admin in admins" :key="admin.id" :value="String(admin.id)">{{ admin.name }}</option>
          </select>
          <div v-if="error_for('owner_admin_id')" class="invalid-feedback d-block">{{ error_for('owner_admin_id') }}</div>
        </div>
        <div class="pl-add__note">
          <label class="form-label mb-1" for="pl-add-note">Nota</label>
          <input
            id="pl-add-note"
            v-model="note"
            type="text"
            class="form-control form-control-sm"
            :class="{ 'is-invalid': !!error_for('note') }"
            placeholder="Opcional: queda en el historial de cada una"
          />
          <div v-if="error_for('note')" class="invalid-feedback d-block">{{ error_for('note') }}</div>
        </div>
      </div>
    </div>

    <template #footer>
      <button type="button" class="btn btn-secondary" :disabled="saving" @click="on_cancel">Cancelar</button>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="saving || selected_count === 0"
        @click="submit"
      >
        <span v-if="saving" class="spinner-border spinner-border-sm me-1" aria-hidden="true" />
        {{ saving ? 'Agregando…' : 'Agregar ' + selected_count }}
      </button>
    </template>
  </base-modal>
</template>

<script>
import api from '@/utils/axios'
import BaseModal from '@/components/ui/BaseModal.vue'
import {
  first_error,
  show_toast,
  sort_stages_for_board,
  validation_errors,
} from '@/components/pipeline/pipeline_helpers'

/** Candidatos por página (el back acepta hasta 300). */
const PAGE_SIZE = 100

/** Espera antes de buscar mientras se tipea. */
const SEARCH_DEBOUNCE_MS = 300

/**
 * Clave de selección de un candidato: el mismo id puede ser un cliente y un lead distintos.
 *
 * @param {Object} candidate
 * @returns {string}
 */
function selection_key(candidate) {
  return candidate.type + ':' + candidate.id
}

/**
 * Modal de alta masiva. El padre lo monta con `v-if` y una `key` nueva por apertura.
 */
export default {
  name: 'PipelineAddModal',
  components: { BaseModal },
  props: {
    /** Visibilidad del modal. */
    show: { type: Boolean, default: true },
    /** Pipeline destino (con `stages`). */
    pipeline: { type: Object, required: true },
    /** Nivel de apilamiento. */
    stack_level: { type: Number, default: 0 },
  },
  emits: ['close', 'added'],
  data() {
    const me = this.$store.state.auth.admin
    return {
      /** Pestaña activa: `client` | `lead`. */
      type: 'client',
      /** Lo que se tipea en el buscador (se aplica con debounce a `q`). */
      q_input: '',
      /** Búsqueda aplicada. */
      q: '',
      /** Solo clientes activos (default sí). */
      solo_activos: true,
      /** Estado del lead (slug) o vacío. */
      lead_status: '',
      /** Estados de lead que publica el back con los candidatos de tipo lead. */
      lead_statuses: [],
      /** Candidatos visibles. */
      candidates: [],
      total: 0,
      has_more: false,
      loading: false,
      /** Seleccionados, por `tipo:id` → `{ type, id, name }`. */
      selected: {},
      /** Etapa inicial (string para el select). */
      stage_id: '',
      /** Responsable: el operador logueado de entrada; "" = sin responsable. */
      owner_value: me && me.id ? String(me.id) : '',
      note: '',
      errors: {},
      saving: false,
      /** Secuencia de pedidos: una respuesta vieja no pisa a una nueva. */
      request_seq: 0,
      /** Timer del debounce del buscador. */
      search_timer: null,
    }
  },
  computed: {
    /** @returns {string} */
    modal_title() {
      return 'Agregar a «' + (this.pipeline.name || 'pipeline') + '»'
    },
    /** @returns {Array<Object>} Etapas abiertas en el orden del tablero. */
    open_stages() {
      return sort_stages_for_board(this.pipeline.stages || []).filter(function (s) {
        return s.type === 'open'
      })
    },
    /** @returns {Array<Object>} */
    admins() {
      return this.$store.state.pipeline.admins || []
    },
    /** @returns {number} */
    selected_count() {
      return Object.keys(this.selected).length
    },
    /** @returns {Array<Object>} Visibles que se pueden elegir. */
    selectable_visible() {
      const self = this
      return this.candidates.filter(function (c) {
        return self.is_selectable(c)
      })
    },
    /** @returns {boolean} */
    all_visible_selected() {
      const self = this
      return this.selectable_visible.length > 0 && this.selectable_visible.every(function (c) {
        return !!self.selected[selection_key(c)]
      })
    },
    /** @returns {boolean} */
    some_visible_selected() {
      const self = this
      return this.selectable_visible.some(function (c) {
        return !!self.selected[selection_key(c)]
      })
    },
    /**
     * Errores de `subjects` o de alguno de sus ítems (`subjects.3.id`…), en una línea.
     * @returns {string}
     */
    subjects_error() {
      const errors = this.errors || {}
      const keys = Object.keys(errors).filter(function (k) {
        return k === 'subjects' || k.indexOf('subjects.') === 0
      })
      return keys.length ? first_error(errors, keys[0]) : ''
    },
  },
  watch: {
    /** Buscar mientras se tipea, con un respiro. */
    q_input: function () {
      const self = this
      if (this.search_timer) {
        clearTimeout(this.search_timer)
      }
      this.search_timer = setTimeout(function () {
        self.search_timer = null
        self.q = self.q_input
      }, SEARCH_DEBOUNCE_MS)
    },
    q: function () {
      this.load_candidates(false)
    },
    solo_activos: function () {
      this.load_candidates(false)
    },
    lead_status: function () {
      this.load_candidates(false)
    },
  },
  created() {
    const first = this.open_stages[0]
    this.stage_id = first ? String(first.id) : ''
    this.$store.dispatch('pipeline/fetch_admins')
    this.load_candidates(false)
  },
  beforeUnmount() {
    if (this.search_timer) {
      clearTimeout(this.search_timer)
    }
  },
  methods: {
    /**
     * @param {string} key
     * @returns {string}
     */
    error_for(key) {
      return first_error(this.errors, key)
    },
    /**
     * Cambia entre clientes y leads (la selección se conserva).
     *
     * @param {string} type
     */
    set_type(type) {
      if (this.type === type) {
        return
      }
      this.type = type
      this.candidates = []
      this.total = 0
      this.has_more = false
      this.load_candidates(false)
    },
    /**
     * GET pipelines/{id}/candidates con los filtros actuales. `append` = "cargar más".
     *
     * @param {boolean} append
     */
    load_candidates(append) {
      const self = this
      const type = this.type
      const params = {
        type: type,
        limit: PAGE_SIZE,
        offset: append ? this.candidates.length : 0,
      }
      if (this.q.trim() !== '') {
        params.q = this.q.trim()
      }
      if (type === 'client' && this.solo_activos) {
        params.solo_activos = 1
      }
      if (type === 'lead' && this.lead_status) {
        params.lead_status = this.lead_status
      }
      this.request_seq = this.request_seq + 1
      const seq = this.request_seq
      this.loading = true
      api
        .get('/pipelines/' + this.pipeline.id + '/candidates', { params: params })
        .then(function (res) {
          if (seq !== self.request_seq) {
            return
          }
          const data = res.data || {}
          const list = (Array.isArray(data.candidates) ? data.candidates : []).map(function (c) {
            return Object.assign({}, c, { type: c.type || type })
          })
          self.candidates = append ? self.candidates.concat(list) : list
          self.total = Number(data.total) || 0
          self.has_more = !!data.has_more
          if (Array.isArray(data.lead_statuses)) {
            self.lead_statuses = data.lead_statuses
          }
          self.loading = false
        })
        .catch(function () {
          if (seq === self.request_seq) {
            self.loading = false
          }
        })
    },
    /**
     * @param {Object} candidate
     * @returns {boolean}
     */
    is_selectable(candidate) {
      return !candidate.open_opportunity_id && !candidate.missing
    },
    /**
     * @param {Object} candidate
     * @returns {boolean}
     */
    is_selected(candidate) {
      return !!this.selected[selection_key(candidate)]
    },
    /**
     * @param {Object} candidate
     * @param {boolean} checked
     */
    toggle(candidate, checked) {
      const key = selection_key(candidate)
      if (checked) {
        this.selected[key] = { type: candidate.type, id: candidate.id, name: candidate.name }
      } else {
        delete this.selected[key]
      }
    },
    /**
     * Marca o desmarca todos los visibles que se pueden elegir.
     *
     * @param {boolean} checked
     */
    toggle_all_visible(checked) {
      const self = this
      this.selectable_visible.forEach(function (candidate) {
        self.toggle(candidate, checked)
      })
    },
    clear_selection() {
      this.selected = {}
    },
    on_cancel() {
      if (this.saving) {
        return
      }
      this.$emit('close')
    },
    /**
     * POST del alta. `owner_admin_id` viaja siempre: el id elegido o `null` (sin responsable).
     */
    submit() {
      const self = this
      if (this.saving || this.selected_count === 0) {
        return
      }
      const subjects = Object.keys(this.selected).map(function (key) {
        return { type: self.selected[key].type, id: self.selected[key].id }
      })
      const payload = {
        subjects: subjects,
        owner_admin_id: this.owner_value === '' ? null : Number(this.owner_value),
      }
      if (this.stage_id !== '') {
        payload.stage_id = Number(this.stage_id)
      }
      if (this.note.trim() !== '') {
        payload.note = this.note.trim()
      }
      this.saving = true
      this.errors = {}
      api
        .post('/pipelines/' + this.pipeline.id + '/opportunities', payload)
        .then(function (res) {
          const data = res.data || {}
          self.saving = false
          self.notify_result(data)
          self.$emit('added', data)
        })
        .catch(function (error) {
          self.saving = false
          self.errors = validation_errors(error)
        })
    },
    /**
     * Toast con el resultado: cuántas se crearon y cuántas se saltearon (y por qué).
     *
     * @param {Object} data `{ created, skipped }`
     */
    notify_result(data) {
      const created = Array.isArray(data.created) ? data.created.length : 0
      const skipped = Array.isArray(data.skipped) ? data.skipped : []
      const already_open = skipped.filter(function (s) { return s.reason === 'already_open' }).length
      const not_found = skipped.filter(function (s) { return s.reason === 'not_found' }).length
      const parts = []
      parts.push(created === 1 ? 'Se agregó 1 oportunidad.' : 'Se agregaron ' + created + ' oportunidades.')
      if (already_open > 0) {
        parts.push(already_open === 1 ? '1 ya estaba.' : already_open + ' ya estaban.')
      }
      if (not_found > 0) {
        parts.push(not_found === 1 ? '1 no se encontró.' : not_found + ' no se encontraron.')
      }
      show_toast(parts.join(' '), created > 0 ? 'success' : 'warning')
    },
  },
}
</script>

<style scoped>
.pl-add__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.pl-add__selected {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.pl-add__filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  margin-bottom: 0.75rem;
}

.pl-add__search {
  flex: 1 1 14rem;
  width: auto;
}

.pl-add__status {
  flex: 0 1 14rem;
  width: auto;
}

.pl-add__list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  background: var(--bg-section);
  border: 1px solid var(--color-border-secondary);
  border-bottom: 0;
  border-radius: 10px 10px 0 0;
}

.pl-add__list {
  max-height: min(45vh, 26rem);
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--color-border-secondary);
  border-radius: 0 0 10px 10px;
  transition: opacity 0.15s ease;
}

.pl-add__list--loading {
  opacity: 0.6;
}

.pl-add__row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  margin: 0;
  cursor: pointer;
}

.pl-add__row + .pl-add__row {
  border-top: 1px solid var(--color-border-secondary);
}

.pl-add__row:hover {
  background: var(--bg-hover);
}

.pl-add__row--disabled {
  cursor: default;
  color: var(--color-text-secondary);
}

.pl-add__row--disabled:hover {
  background: transparent;
}

.pl-add__row-text {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.pl-add__row-name {
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pl-add__row-secondary {
  font-size: 0.78rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pl-add__row-tags {
  flex: 0 1 auto;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.25rem;
}

.pl-add__tag {
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1;
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.pl-add__tag--in {
  border-color: transparent;
  background: var(--bg-hover);
  color: var(--color-text-primary);
}

.pl-add__options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem 1rem;
  margin-top: 1rem;
}

.pl-add__note {
  grid-column: 1 / -1;
}

@media (max-width: 575.98px) {
  .pl-add__options {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
