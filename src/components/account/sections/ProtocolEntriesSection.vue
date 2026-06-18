<template>
  <div class="protocol-entries-section">
    <view-header
      model_name="protocol_entry"
      :default_properties="meta_properties_for_table_prefs"
      :is_selectable="st.is_selectable"
      :is_filtered="st.is_filtered"
      :has_filters="st.filters && st.filters.length > 0"
      :selected_count="st.selected.length"
      @create="on_create"
      @toggle-select="on_toggle_select"
      @act-filtered="on_act_filtered"
      @act-selected="on_act_selected"
      @reset-filters="on_reset_filters"
      @saved="on_props_saved"
    />

    <div class="row g-2 align-items-end mb-3">
      <div class="col-auto">
        <label class="form-label small text-muted mb-0">Estado</label>
        <select
          v-model="activa_filter"
          class="form-select form-select-sm"
          style="min-width: 200px"
          @change="on_filter_change"
        >
          <option value="">Todas</option>
          <option value="1">Activas</option>
          <option value="0">Pendientes de revisión</option>
        </select>
      </div>
      <div class="col-auto">
        <label class="form-label small text-muted mb-0">Categoría</label>
        <select
          v-model="categoria_filter"
          class="form-select form-select-sm"
          style="min-width: 220px"
          @change="on_filter_change"
        >
          <option value="">Todas</option>
          <option value="etapa_principal">Etapa principal</option>
          <option value="seguimiento">Seguimiento</option>
          <option value="situacion_frecuente">Situación frecuente</option>
        </select>
      </div>
    </div>

    <div class="table-responsive position-relative">
      <div
        v-if="st.loading"
        class="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-white bg-opacity-75"
        style="z-index: 2"
      >
        <span class="spinner-border text-primary" role="status" />
      </div>
      <table class="table table-sm table-striped table-hover table-bordered align-middle">
        <thead class="table-light">
          <tr>
            <th>Título</th>
            <th>Categoría</th>
            <th>Estado lead</th>
            <th>Estado</th>
            <th v-if="show_claude_original_column">Mensaje original de Claude</th>
            <th>Corrección / template</th>
            <th class="text-center" style="width: 100px">Activa</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in display_rows"
            :key="row.id"
            class="cursor-pointer"
            @click="on_row(row)"
          >
            <td class="text-break">{{ row.titulo || '—' }}</td>
            <td><code>{{ row.categoria || '—' }}</code></td>
            <td>{{ row.estado_aplicable || '—' }}</td>
            <td>
              <span v-if="row.activa" class="badge bg-success">Activa</span>
              <span v-else class="badge bg-warning text-dark">Pendiente de revisión</span>
            </td>
            <td v-if="show_claude_original_column" class="text-break small text-muted">
              {{ claude_original_text(row) }}
            </td>
            <td class="text-break small">{{ row.mensaje_template || '—' }}</td>
            <td class="text-center" @click.stop>
              <div class="form-check form-switch d-inline-block mb-0">
                <input
                  :id="'protocol-act-' + row.id"
                  class="form-check-input"
                  type="checkbox"
                  :checked="Boolean(row.activa)"
                  :disabled="toggle_busy_id === row.id"
                  @change="on_toggle_activa(row, $event)"
                />
              </div>
            </td>
          </tr>
          <tr v-if="!st.loading && display_rows.length === 0">
            <td :colspan="show_claude_original_column ? 7 : 6" class="text-muted text-center py-4">
              No hay entradas con los filtros seleccionados.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <model-modal
      :show="show_model_modal"
      model_name="protocol_entry"
      api_resource_path="protocol-entry"
      :all_properties="all_properties"
      :record="edit_record"
      @update:show="(v) => (show_model_modal = v)"
      @close="on_model_modal_close"
      @saved="on_model_saved"
      @deleted="on_model_deleted"
    />
  </div>
</template>

<script>
import ViewHeader from '@/common-vue/components/view/header/Index.vue'
import ModelModal from '@/common-vue/components/model/Index.vue'
import { resolve_props_to_show } from '@/common-vue/helpers/column_preferences_helper'

/** Prefijo guardado en `notas_setter` al crear correcciones automáticas del setter. */
const CLAUDE_ORIGINAL_PREFIX = 'Mensaje original de Claude: '

/**
 * Sección de cuenta: ABM del protocolo de ventas con filtros por categoría y estado activo,
 * badges de revisión y toggle de activación desde la tabla.
 */
export default {
  name: 'ProtocolEntriesSection',
  components: { ViewHeader, ModelModal },
  data() {
    return {
      /** Valor del filtro de categoría enlazado al store `protocol_entry`. */
      categoria_filter: '',
      /** Filtro activa: '' todas, '1' activas, '0' pendientes (default en store). */
      activa_filter: '0',
      /** Modal CRUD abierto. */
      show_model_modal: false,
      /** Fila en edición dentro del modal. */
      edit_record: null,
      /** Id de fila con toggle en curso (deshabilita el switch). */
      toggle_busy_id: null,
    }
  },
  computed: {
    st() {
      return this.$store.state.protocol_entry
    },
    all_properties() {
      return this.$store.getters['meta/properties']('protocol_entry') || []
    },
    /**
     * Meta sin filas separadoras de grupo (evita keys vacíos en preferencias de columnas).
     * @returns {Array<Object>}
     */
    meta_properties_for_table_prefs() {
      return this.all_properties.filter((p) => !this.is_meta_group_separator_row(p))
    },
    display_rows() {
      if (this.st.is_filtered) {
        return this.st.filtered
      }
      return this.st.models
    },
    /**
     * Muestra la columna de comparación cuando hay pendientes visibles o el filtro lo pide.
     * @returns {boolean}
     */
    show_claude_original_column() {
      if (this.activa_filter === '0' || this.activa_filter === '') {
        return true
      }
      return false
    },
  },
  mounted() {
    const self = this
    this.categoria_filter = this.$store.state.protocol_entry.protocol_categoria_filter || ''
    this.activa_filter = this.$store.state.protocol_entry.protocol_activa_filter
    if (this.activa_filter !== '0' && this.activa_filter !== '1') {
      this.activa_filter = this.activa_filter === '' ? '' : '0'
    }
    this.$store
      .dispatch('meta/fetch_meta', 'protocol_entry')
      .then(function (data) {
        const meta_properties = (data && data.properties) || []
        return resolve_props_to_show('protocol_entry', meta_properties)
      })
      .then(function (vis) {
        self.$store.commit('protocol_entry/set_props_to_show', vis)
        return self.$store.dispatch('protocol_entry/get_models')
      })
      .catch(function () {
        return null
      })
  },
  methods: {
    /**
     * Fila solo `group_title` (sin `key`) del meta: no es columna de tabla.
     * @param {Object|null} p
     * @returns {boolean}
     */
    is_meta_group_separator_row(p) {
      return Boolean(p && p.group_title && !p.key)
    },
    /**
     * Aplica filtros de categoría y activa y recarga el listado.
     * @returns {void}
     */
    on_filter_change() {
      this.$store.commit('protocol_entry/set_protocol_categoria_filter', this.categoria_filter)
      this.$store.commit('protocol_entry/set_protocol_activa_filter', this.activa_filter)
      this.$store.dispatch('protocol_entry/get_models')
    },
    /**
     * Extrae el mensaje original de Claude desde `notas_setter` (solo entradas pendientes).
     * @param {Object} row entrada de protocolo
     * @returns {string}
     */
    claude_original_text(row) {
      if (row.activa) {
        return '—'
      }
      const notas = (row.notas_setter || '').trim()
      if (!notas) {
        return '—'
      }
      if (notas.indexOf(CLAUDE_ORIGINAL_PREFIX) === 0) {
        return notas.substring(CLAUDE_ORIGINAL_PREFIX.length)
      }
      return notas
    },
    /**
     * Abre modal de creación.
     * @returns {void}
     */
    on_create() {
      this.edit_record = null
      this.show_model_modal = true
    },
    /**
     * Abre modal de edición al hacer clic en la fila.
     * @param {Object} row
     * @returns {void}
     */
    on_row(row) {
      this.edit_record = row
      this.show_model_modal = true
    },
    /**
     * Activa o desactiva una entrada desde el switch de la tabla.
     * @param {Object} row
     * @param {Event} event
     * @returns {void}
     */
    on_toggle_activa(row, event) {
      const self = this
      const activa = Boolean(event.target.checked)
      this.toggle_busy_id = row.id
      this.$store
        .dispatch('protocol_entry/toggle_activa', { id: row.id, activa: activa })
        .then(function (updated) {
          row.activa = updated.activa
          self.$store.dispatch('protocol_entry/upsert_model_in_lists', updated)
          const toast_msg = activa ? 'Entrada activada.' : 'Entrada desactivada.'
          // Si el filtro actual ya no debería mostrar la fila, recargar listado.
          if (
            (self.activa_filter === '0' && updated.activa) ||
            (self.activa_filter === '1' && !updated.activa)
          ) {
            return self.$store.dispatch('protocol_entry/get_models').then(function () {
              self.toggle_busy_id = null
              if (self.$root && self.$root.$emit) {
                self.$root.$emit('open_toast', toast_msg)
              }
            })
          }
          self.toggle_busy_id = null
          if (self.$root && self.$root.$emit) {
            self.$root.$emit('open_toast', toast_msg)
          }
        })
        .catch(function () {
          event.target.checked = !activa
          self.toggle_busy_id = null
        })
    },
    on_toggle_select() {
      const v = !this.st.is_selectable
      this.$store.commit('protocol_entry/set_is_selectable', v)
      this.$store.commit('protocol_entry/set_selected', [])
    },
    on_act_filtered() {
      this.$root.$emit('open_toast', 'Acción masiva: implementar con mass-update (filtrados).')
    },
    on_act_selected() {
      this.$root.$emit('open_toast', 'Acción masiva: ' + this.st.selected.length + ' filas (pendiente de UI).')
    },
    on_reset_filters() {
      this.$store.commit('protocol_entry/set_filters', [])
      this.$store.commit('protocol_entry/set_filter_page', 1)
      this.$store.commit('protocol_entry/set_filtered', [])
      this.$store.commit('protocol_entry/set_is_filtered', false)
    },
    on_props_saved() {
      /* preferencias de columnas del header genérico */
    },
    on_model_saved(model) {
      this.$store.dispatch('protocol_entry/upsert_model_in_lists', model)
    },
    on_model_modal_close() {
      this.show_model_modal = false
      this.edit_record = null
    },
    on_model_deleted() {
      this.$store.dispatch('protocol_entry/get_models')
      this.on_model_modal_close()
    },
  },
}
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
</style>
