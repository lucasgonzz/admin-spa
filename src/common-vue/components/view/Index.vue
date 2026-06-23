<template>
  <div class="container-fluid">
    <view-header
      :model_name="model_name"
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
    >
      <template #toolbar-right>
        <slot name="toolbar-right" />
      </template>
      <template #right>
        <slot name="right" />
      </template>
    </view-header>

    <slot name="header"></slot>

    <view-list
      :model_name="model_name"
      :rows="display_rows"
      :loading="st.loading"
      :is_selectable="st.is_selectable"
      :table_properties="table_properties"
      :filters="st.filters"
      :selected="st.selected"
      @open-filter="open_filter"
      @clear-filter="on_clear_filter"
      @row="on_row"
      @toggle="on_toggle"
    >
      <!-- Reenvía el slot de acciones por fila definido por el consumidor de ResourceView. -->
      <template v-if="$slots['row-actions']" #row-actions="slot_props">
        <slot name="row-actions" v-bind="slot_props" />
      </template>
    </view-list>

    <column-filter-modal
      :show="show_filter_modal"
      :field="filter_field"
      :model_name="model_name"
      @close="show_filter_modal = false"
      @add="on_filter_add"
      @add-and-run="on_filter_add_and_run"
    />

    <model-modal
      :show="show_model_modal"
      :model_name="model_name"
      :api_resource_path="resource_api_path"
      :all_properties="all_properties"
      :record="edit_record"
      :extra_tabs="resolved_model_extra_tabs"
      :properties_nav_order="model_properties_nav_order"
      :before_create="before_create_hook"
      @update:show="(v) => (show_model_modal = v)"
      @close="on_model_modal_close"
      @saved="on_model_saved"
      @deleted="on_model_deleted"
      @extra-record-updated="on_extra_record_updated"
    >
      <template v-for="t in extra_tabs_for_slot_forward" #[`model-extra-${t.key}`]="bind">
        <slot
          :key="t.key"
          :name="slot_name_on_resource_view_for_extra_tab(t)"
          v-bind="bind"
        />
      </template>
    </model-modal>

    <table-fab
      :visible="fab_visible"
      @apply="on_fab_apply"
    />
  </div>
</template>

<script>
import ViewHeader from './header/Index.vue'
import ViewList from './List.vue'
import ColumnFilterModal from '../table/header/column-filter/modal/Index.vue'
import ModelModal from '../model/Index.vue'
import TableFab from '../table-fab/Index.vue'
import { resolve_props_to_show } from '../../helpers/column_preferences_helper'

/**
 * Vista reutilizable: header, tabla, filtros por columna, modal CRUD, FAB.
 * Pestañas extra del modal: prop `model_extra_tabs` (`{ key, label, component? }`) o slot legacy `model-extra`
 * (equivale a una pestaña `{ key: 'extra', label: 'Extra' }`). Slots con scope: `model-extra-${key}`.
 */
export default {
  name: 'ResourceView',
  emits: ['extra-record-updated'],
  components: {
    ViewHeader,
    ViewList,
    ColumnFilterModal,
    ModelModal,
    TableFab,
  },
  props: {
    model_name: {
      type: String,
      required: true,
    },
    /**
     * Pestañas adicionales del modal CRUD. Sin `component`: usar slot `model-extra-${key}` en esta vista.
     * @type {Array<{ key: string, label: string, component?: Object }>}
     */
    model_extra_tabs: {
      type: Array,
      default: () => [],
    },
    /**
     * Orden opcional de pestañas del modal CRUD (`group:<título>` o `extra:<key>`).
     * @type {string[]}
     */
    model_properties_nav_order: {
      type: Array,
      default: () => [],
    },
    /**
     * Segmento de URL del recurso en admin-api cuando difiere del `model_name` (ej. `protocol-entry`).
     */
    resource_api_path: {
      type: String,
      default: '',
    },
    /**
     * Hook opcional ejecutado antes de crear un registro nuevo desde el modal CRUD.
     * Se pasa directamente a ModelModal como prop `before_create`.
     * Recibe el payload y debe devolver una Promise; si resuelve, el guardado continúa.
     *
     * @type {Function|null}
     */
    before_create_hook: {
      type: Function,
      default: null,
    },
  },
  data() {
    return {
      show_filter_modal: false,
      filter_field: null,
      show_model_modal: false,
      edit_record: null,
    }
  },
  computed: {
    st() {
      return this.$store.state[this.model_name]
    },
    all_properties() {
      return this.$store.getters['meta/properties'](this.model_name) || []
    },
    /**
     * Meta sin filas separadoras de grupo (evita keys vacíos en UI de columnas).
     * @returns {Array<Object>}
     */
    meta_properties_for_table_prefs() {
      return this.all_properties.filter((p) => !this.is_meta_group_separator_row(p))
    },
    table_properties() {
      const base = this.meta_properties_for_table_prefs
      const sel = this.st.props_to_show
      if (sel && sel.length) {
        return sel
          .map((s) => {
            const def = base.find((b) => b.key == s.key) || {}
            if (!s.key) {
              return null
            }
            if (s.show === false) {
              return null
            }
            return Object.assign({}, def, s, { text: def.text || s.text, key: s.key })
          })
          .filter((x) => x)
      }
      return base.filter((p) => p.show !== false && !p.not_show_on_table)
    },
    /**
     * Pestañas extra efectivas: explícitas o una pestaña "Extra" si existe el slot legacy.
     * @returns {Array<{ key: string, label: string, component?: Object }>}
     */
    resolved_model_extra_tabs() {
      if (this.model_extra_tabs && this.model_extra_tabs.length) {
        return this.model_extra_tabs
      }
      if (this.$slots['model-extra']) {
        return [{ key: 'extra', label: 'Extra' }]
      }
      return []
    },
    /**
     * Pestañas que requieren reenvío de scoped slot hacia ModelModal (sin `component`).
     * @returns {Array<{ key: string, label: string, component?: Object }>}
     */
    extra_tabs_for_slot_forward() {
      return this.resolved_model_extra_tabs.filter((t) => !t.component)
    },
    display_rows() {
      if (this.st.is_filtered) {
        return this.st.filtered
      }
      return this.st.models
    },
    fab_visible() {
      return (this.st.filters && this.st.filters.length > 0) && !this.st.is_filtered
    },
  },
  mounted() {
    const self = this
    this.$store.commit(this.model_name + '/set_loading', true)
    this.$store
      .dispatch('meta/fetch_meta', this.model_name)
      .then(function (data) {
        const meta_properties = (data && data.properties) || []
        return resolve_props_to_show(self.model_name, meta_properties)
      })
      .then(function (vis) {
        self.$store.commit(self.model_name + '/set_props_to_show', vis)
        return self.$store.dispatch(self.model_name + '/get_models')
      })
      .catch(function () {
        self.$store.commit(self.model_name + '/set_loading', false)
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
     * Abre modal de creación de registro (sin fila previa).
     * @returns {void}
     */
    on_create() {
      this.edit_record = null
      this.show_model_modal = true
    },
    on_row(row) {
      this.edit_record = row
      this.show_model_modal = true
    },
    on_toggle(row) {
      this.$store.commit(this.model_name + '/add_selected', row)
    },
    on_toggle_select() {
      const v = !this.st.is_selectable
      this.$store.commit(this.model_name + '/set_is_selectable', v)
      this.$store.commit(this.model_name + '/set_selected', [])
    },
    on_act_filtered() {
      const self = this
      this.$root.$emit('open_toast', 'Acción masiva: implementar con mass-update (filtrados).')
    },
    on_act_selected() {
      this.$root.$emit('open_toast', 'Acción masiva: ' + this.st.selected.length + ' filas (pendiente de UI).')
    },
    /**
     * Limpia todos los filtros del recurso y vuelve al listado base en store.models.
     * @returns {void}
     */
    on_reset_filters() {
      // Elimina criterios acumulados de filtros por columna.
      this.$store.commit(this.model_name + '/set_filters', [])
      // Reinicia estado de paginación/filtro para mantener consistencia de la vista.
      this.$store.commit(this.model_name + '/set_filter_page', 1)
      this.$store.commit(this.model_name + '/set_filtered', [])
      this.$store.commit(this.model_name + '/set_is_filtered', false)
    },
    /**
     * Abre modal de filtro para la columna seleccionada.
     * @param {Object} p configuración de propiedad/columna.
     * @returns {void}
     */
    open_filter(p) {
      this.filter_field = p
      this.show_filter_modal = true
    },
    /**
     * Limpia filtro por key y actualiza datos visibles según el estado actual.
     * @param {Object} p configuración de columna con key.
     * @returns {void}
     */
    on_clear_filter(p) {
      // Si no hay columna válida, evita mutaciones innecesarias.
      if (!p || !p.key) {
        return
      }
      // Quita criterio de la columna desde el store del recurso actual.
      this.$store.commit(this.model_name + '/remove_filter_by_key', p.key)
      // Si no estaba en modo filtrado, no es necesario recargar.
      if (!this.st.is_filtered) {
        return
      }
      // Si aún hay filtros activos, vuelve a ejecutar búsqueda; si no, restaura listado normal.
      if (this.st.filters && this.st.filters.length > 0) {
        this.$store.commit(this.model_name + '/set_filter_page', 1)
        this.$store.dispatch(this.model_name + '/run_filter', { page: 1 })
      } else {
        this.$store.dispatch(this.model_name + '/get_models')
      }
    },
    /**
     * Agrega/actualiza un filtro sin ejecutar búsqueda inmediata.
     * @param {Object} payload criterio de filtro de columna.
     * @returns {void}
     */
    on_filter_add(payload) {
      this.$store.commit(this.model_name + '/add_filter', payload)
    },
    /**
     * Agrega/actualiza un filtro y ejecuta búsqueda filtrada.
     * @param {Object} payload criterio de filtro de columna.
     * @returns {void}
     */
    on_filter_add_and_run(payload) {
      this.$store.commit(this.model_name + '/add_filter', payload)
      this.$store.commit(this.model_name + '/set_filter_page', 1)
      this.$store.dispatch(this.model_name + '/run_filter', { page: 1 })
    },
    on_fab_apply() {
      this.$store.commit(this.model_name + '/set_filter_page', 1)
      this.$store.dispatch(this.model_name + '/run_filter', { page: 1 })
    },
    on_model_saved(model) {
      this.$store.dispatch(this.model_name + '/upsert_model_in_lists', model)
    },
    on_model_modal_close() {
      this.show_model_modal = false
      this.edit_record = null
    },
    on_model_deleted() {
      this.edit_record = null
    },
    on_props_saved(rows) {
      this.$store.commit(this.model_name + '/set_props_to_show', rows)
    },
    /**
     * Evento desde una pestaña extra basada en componente (p. ej. guardado vía API auxiliar).
     * Actualiza la fila abierta en el modal para que no quede desincronizada del store.
     *
     * @param {Object} model registro actualizado
     * @returns {void}
     */
    on_extra_record_updated(model) {
      if (model && model.id && this.edit_record && this.edit_record.id == model.id) {
        this.edit_record = model
      }
      this.$store.dispatch(this.model_name + '/upsert_model_in_lists', model)
      this.$emit('extra-record-updated', model)
    },
    /**
     * Nombre del slot en esta vista: compatibilidad `model-extra` si no hay `model_extra_tabs`.
     * @param {{ key: string }} t pestaña extra
     * @returns {string}
     */
    slot_name_on_resource_view_for_extra_tab(t) {
      const legacy =
        !(this.model_extra_tabs && this.model_extra_tabs.length) && this.$slots['model-extra']
      if (legacy && t.key === 'extra') {
        return 'model-extra'
      }
      return 'model-extra-' + t.key
    },
  },
}
</script>
