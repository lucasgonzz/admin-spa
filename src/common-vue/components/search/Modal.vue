<template>
  <base-modal
    :show="open"
    :title="title"
    size="xl"
    @update:show="on_update_show"
    @close="on_close"
  >
    <div v-if="!model_name" class="alert alert-warning mb-0">
      No se indicó el modelo a buscar (prop <code>relation</code> en el campo).
    </div>
    <template v-else>
      <div class="d-flex flex-wrap gap-2 align-items-start mb-3">
        <div class="flex-grow-1" style="min-width: 200px">
          <label class="form-label small text-muted mb-0">Criterio</label>
          <input
            ref="query_input"
            v-model="query"
            type="text"
            class="form-control"
            placeholder="Escriba y pulse Enter"
            autocomplete="off"
            @keydown.enter.prevent="search(1)"
          />
        </div>
        <div style="min-width: 220px; max-width: 100%">
          <label class="form-label small text-muted mb-0">Buscar en (propiedades)</label>
          <select
            v-model="selected_prop_keys"
            class="form-select"
            multiple
            size="4"
          >
            <option v-for="opt in filterable_property_options" :key="opt.key" :value="opt.key">
              {{ opt.text || opt.key }}
            </option>
          </select>
        </div>
        <div class="align-self-end">
          <button
            type="button"
            class="btn btn-primary"
            :disabled="loading"
            @click="search(1)"
          >
            {{ loading ? 'Buscando…' : 'Buscar' }}
          </button>
        </div>
      </div>

      <p v-if="search_error" class="text-danger small">{{ search_error }}</p>

      <div v-if="loading" class="text-center py-4">
        <div class="spinner-border text-primary" role="status"></div>
      </div>
      <template v-else>
        <div
          v-if="results.length || total_from_api > 0"
          class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2"
        >
          <span class="fw-semibold small">Resultados ({{ total_from_api }})</span>
          <div v-if="last_page > 1" class="btn-group btn-group-sm">
            <button
              type="button"
              class="btn btn-outline-secondary"
              :disabled="current_page <= 1"
              @click="search(current_page - 1)"
            >
              Anterior
            </button>
            <span class="btn btn-outline-secondary disabled">Pág. {{ current_page }} / {{ last_page }}</span>
            <button
              type="button"
              class="btn btn-outline-secondary"
              :disabled="current_page >= last_page"
              @click="search(current_page + 1)"
            >
              Siguiente
            </button>
          </div>
        </div>
        <div v-if="results.length" class="table-responsive" style="max-height: 55vh; overflow: auto">
          <table class="table table-sm table-hover table-bordered align-middle mb-0">
            <thead class="table-light position-sticky top-0">
              <tr>
                <th
                  v-for="col in table_columns"
                  :key="col.key"
                  :style="col.width ? { width: col.width + 'px' } : {}"
                >
                  {{ col.text || col.key }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in results"
                :key="row.id"
                class="cursor-pointer"
                style="cursor: pointer"
                @click="pick_row(row)"
              >
                <td v-for="col in table_columns" :key="col.key">
                  <span class="text-break">{{ cell_value(row, col) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else-if="searched_once" class="text-muted small mb-0">No se encontraron resultados.</p>
      </template>
    </template>
    <template #footer>
      <button type="button" class="btn btn-secondary" @click="on_close">Cerrar</button>
    </template>
  </base-modal>
</template>

<script>
import api from '@/utils/axios'
import BaseModal from '@/components/ui/BaseModal.vue'

/**
 * Modal de búsqueda remota: criterio, selección múltiple de columnas a cruzar (OR), tabla de resultados.
 * Llama a `POST /search-from-modal/{model_name}` (admin-api).
 */
export default {
  name: 'SearchModal',
  components: { BaseModal },
  props: {
    show: { type: Boolean, default: false },
    /** Nombre corto de modelo en API (client, version, …). */
    model_name: { type: String, default: '' },
    /** Texto inicial del input de criterio al abrir. */
    initial_query: { type: String, default: '' },
  },
  emits: ['update:show', 'close', 'selected'],
  data() {
    return {
      open: false,
      query: '',
      /** Keys de columnas elegidas para el filtro OR. */
      selected_prop_keys: [],
      /** Propiedades del meta del modelo relacionado. */
      meta_props: [],
      loading: false,
      results: [],
      current_page: 1,
      last_page: 1,
      total_from_api: 0,
      per_page: 25,
      meta_loaded: false,
      search_error: '',
      searched_once: false,
    }
  },
  computed: {
    title() {
      return this.model_name ? 'Buscar: ' + this.model_name : 'Buscar'
    },
    /**
     * Opciones del multiselect: columnas buscables (use_to_filter_in_search o tipos de texto).
     * @returns {Array<Object>}
     */
    filterable_property_options() {
      return (this.meta_props || []).filter((p) => {
        if (!p || !p.key || p.only_show) {
          return false
        }
        if (p.use_to_filter_in_search) {
          return true
        }
        return ['text', 'textarea', 'number', 'search', 'select'].indexOf(p.type) !== -1
      })
    },
    /**
     * Columnas visibles en la tabla de resultados.
     * @returns {Array<Object>}
     */
    table_columns() {
      return (this.meta_props || []).filter(
        (p) => p && p.key && p.show !== false && !p.not_show_on_table && !p.only_show
      )
    },
  },
  watch: {
    show: {
      immediate: true,
      /**
       * Sincroniza apertura con el padre y dispara carga al mostrar.
       * @param {boolean} v
       * @returns {void}
       */
      handler(v) {
        this.open = v
        if (v && this.model_name) {
          this.on_open()
        }
      },
    },
  },
  methods: {
    /**
     * Sincroniza visibilidad con v-model show del padre.
     * @param {boolean} v
     * @returns {void}
     */
    on_update_show(v) {
      this.open = v
      this.$emit('update:show', v)
      if (!v) {
        this.$emit('close')
      }
    },
    /**
     * Cierra el modal.
     * @returns {void}
     */
    on_close() {
      this.open = false
      this.$emit('update:show', false)
      this.$emit('close')
    },
    /**
     * Al abrir: carga meta, preselecciona columnas, aplica criterio inicial.
     * @returns {void}
     */
    on_open() {
      this.search_error = ''
      this.searched_once = false
      this.query = this.initial_query || ''
      this.results = []
      this.current_page = 1
      this.last_page = 1
      this.total_from_api = 0
      const self = this
      this.load_meta()
        .then(function () {
          self.$nextTick(function () {
            const el = self.$refs.query_input
            if (el) {
              el.focus()
            }
            if (self.query.length >= 1) {
              self.search(1)
            }
          })
        })
        .catch(function () {})
    },
    /**
     * GET meta del modelo para armar multiselect y columnas.
     * @returns {Promise<void>}
     */
    load_meta() {
      const self = this
      if (!self.model_name) {
        return Promise.resolve()
      }
      return api
        .get('/meta/' + self.model_name)
        .then(function (res) {
          const list = (res.data && res.data.properties) || []
          self.meta_props = list
          self.meta_loaded = true
          const with_flag = list.filter((p) => p && p.use_to_filter_in_search)
          const filterable = list.filter((p) => {
            if (!p || !p.key || p.only_show) {
              return false
            }
            if (p.use_to_filter_in_search) {
              return true
            }
            return (
              p.type && ['text', 'textarea', 'number', 'search', 'select', 'pipeline_status'].indexOf(p.type) !== -1
            )
          })
          if (with_flag.length) {
            self.selected_prop_keys = with_flag.map((p) => p.key)
          } else {
            self.selected_prop_keys = filterable.map((p) => p.key)
          }
        })
        .catch(function () {
          self.meta_props = []
        })
    },
    /**
     * Ejecuta búsqueda en el API.
     * @param {number} page número de página
     * @returns {void}
     */
    search(page) {
      const self = this
      if (!self.model_name) {
        return
      }
      if (!self.selected_prop_keys || !self.selected_prop_keys.length) {
        self.search_error = 'Seleccione al menos una propiedad.'
        return
      }
      const q = (self.query || '').trim()
      if (!q) {
        self.search_error = 'Escriba un criterio de búsqueda.'
        return
      }
      self.search_error = ''
      self.loading = true
      self.searched_once = true
      const p = page > 0 ? page : 1
      self.current_page = p
      api
        .post(
          '/search-from-modal/' + self.model_name,
          {
            query_value: q,
            props_to_filter: self.selected_prop_keys,
            page: p,
            per_page: self.per_page,
          }
        )
        .then(function (res) {
          const pag = res.data && res.data.models
          if (pag && pag.data) {
            self.results = pag.data
            self.current_page = pag.current_page || 1
            self.last_page = pag.last_page || 1
            self.total_from_api = pag.total != null ? pag.total : self.results.length
          } else {
            self.results = []
          }
        })
        .catch(function (err) {
          self.results = []
          const msg =
            err.response && err.response.data && err.response.data.message
              ? err.response.data.message
              : 'Error al buscar.'
          self.search_error = msg
        })
        .then(function () {
          self.loading = false
        })
    },
    /**
     * Valor a mostrar en una celda (anida relación simple por si el row trae withAll).
     * @param {Object} row
     * @param {Object} col property def
     * @returns {string|number}
     */
    cell_value(row, col) {
      if (!row || !col || !col.key) {
        return ''
      }
      const v = row[col.key]
      if (v !== null && typeof v === 'object' && col.relation_label) {
        return v[col.relation_label] != null ? v[col.relation_label] : JSON.stringify(v)
      }
      if (v === null || v === undefined) {
        return ''
      }
      return v
    },
    /**
     * El usuario elige una fila: se emite el registro y se cierra.
     * @param {Object} row
     * @returns {void}
     */
    pick_row(row) {
      this.$emit('selected', row)
      this.on_close()
    },
  },
}
</script>
