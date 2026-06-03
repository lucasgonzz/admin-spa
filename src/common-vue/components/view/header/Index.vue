<template>
  <div class="view-header d-flex flex-wrap align-items-center gap-2 py-2 mb-2 border-bottom">

    <props-to-show
      :model_name="model_name"
      :default_properties="default_properties"
      @saved="on_props_saved"
    />
    
    <button v-if="show_create" class="btn btn-primary btn-sm" @click="$emit('create')">
      <i class="bi bi-plus-lg me-1" /> Nuevo
    </button>
    <button
      class="btn btn-sm"
      :class="is_selectable ? 'btn-secondary' : 'btn-outline-secondary'"
      @click="$emit('toggle-select')"
    >
      <i class="bi bi-check2-square me-1" /> Selección
    </button>
    <button
      v-if="is_filtered"
      class="btn btn-warning btn-sm"
      @click="$emit('act-filtered')"
    >
      Actuar (filtrados)
    </button>
    <button
      v-if="selected_count > 0"
      class="btn btn-info btn-sm"
      @click="$emit('act-selected')"
    >
      Actuar ({{ selected_count }})
    </button>
    <button
      v-if="has_filters"
      class="btn btn-outline-warning btn-sm"
      @click="$emit('reset-filters')"
    >
      <i class="bi bi-arrow-counterclockwise me-1" /> Resetear filtros
    </button>

    <div class="ms-auto d-flex gap-2">
      <slot name="right" />
    </div>
  </div>
</template>

<script>
/**
 * Fila de acciones superior (crear, selección, masivos). Columnas vía slot `right`.
 */
import PropsToShow from './props-to-show/Index.vue'
export default {
  name: 'ViewHeader',
  components: {
    PropsToShow,
  },
  props: {
    /** Nombre del módulo Vuex / recurso (ej. `lead`, `client`). */
    model_name: { type: String, required: true },
    /**
     * Propiedades meta aptas para tabla (sin separadores de grupo).
     * Se usan como fallback si no hay preferencias guardadas en la API.
     */
    default_properties: { type: Array, default: () => [] },
    show_create: { type: Boolean, default: true },
    is_selectable: { type: Boolean, default: false },
    is_filtered: { type: Boolean, default: false },
    has_filters: { type: Boolean, default: false },
    selected_count: { type: Number, default: 0 },
  },
  emits: ['create', 'toggle-select', 'act-filtered', 'act-selected', 'reset-filters', 'saved'],
  methods: {
    /**
     * Reenvía la configuración de columnas guardada hacia ResourceView.
     * @param {Array<Object>} rows filas de preferencias de columnas.
     * @returns {void}
     */
    on_props_saved(rows) {
      this.$emit('saved', rows)
    },
  },
}
</script>
