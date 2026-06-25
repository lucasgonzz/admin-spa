<template>
  <div class="view-header py-2 mb-2 border-bottom">
    <!-- Fila principal: acciones estándar a la izquierda y extras del recurso a la derecha. -->
    <div class="view-header-main d-flex flex-wrap align-items-center gap-2 w-100">
      <props-to-show
        :model_name="model_name"
        :default_properties="default_properties"
        @saved="on_props_saved"
      />

      <button
        v-if="show_create"
        type="button"
        class="btn btn-primary btn-sm"
        title="Nuevo"
        aria-label="Nuevo"
        @click="$emit('create')"
      >
        <i class="bi bi-plus-lg" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="btn btn-sm"
        :class="is_selectable ? 'btn-secondary' : 'btn-outline-secondary'"
        title="Selección"
        aria-label="Selección"
        @click="$emit('toggle-select')"
      >
        <i class="bi bi-check2-square" aria-hidden="true" />
      </button>
      <button
        v-if="selected_count > 0"
        class="btn btn-info btn-sm"
        @click="$emit('act-selected')"
      >
        Actuar ({{ selected_count }})
      </button>
      <span v-if="show_reset_filters" class="d-inline-flex align-items-center gap-2">
        <button
          type="button"
          class="btn btn-warning btn-sm"
          @click="$emit('reset-filters')"
        >
          <i class="bi bi-arrow-counterclockwise me-1" /> Resetear filtros
        </button>
        <span v-if="is_filtered && total_filter_results != null" class="small text-muted">
          {{ total_filter_results }} resultado{{ total_filter_results === 1 ? '' : 's' }}
        </span>
      </span>

      <div
        v-if="$slots['toolbar-right']"
        class="view-header-toolbar-right ms-auto d-flex flex-wrap align-items-center gap-2"
      >
        <slot name="toolbar-right" />
      </div>
    </div>

    <!-- Fila secundaria a ancho completo (ej. filtro de fecha en leads). -->
    <div
      v-if="$slots.right"
      class="view-header-secondary d-flex flex-wrap align-items-center gap-2 w-100 mt-2 justify-content-md-end"
    >
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
    /** Total de filas devueltas por la última búsqueda filtrada. */
    total_filter_results: { type: Number, default: 0 },
  },
  emits: ['create', 'toggle-select', 'act-selected', 'reset-filters', 'saved'],
  computed: {
    /**
     * Muestra reset cuando hay criterios pendientes o una búsqueda filtrada activa.
     * @returns {boolean}
     */
    show_reset_filters() {
      return this.has_filters || this.is_filtered
    },
  },
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
