<template>
  <div class="table-responsive">
    <!--
      Carga inicial sin filas: la tabla vacía no da altura al contenedor relativo y el overlay
      queda minúsculo arriba; usamos un bloque alto centrado hasta el primer listado.
    -->
    <div
      v-if="show_initial_loading"
      class="resource-table-initial-loading d-flex flex-column align-items-center justify-content-center text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span
        class="spinner-border text-primary resource-table-initial-loading__spinner"
        aria-hidden="true"
      />
      <span class="visually-hidden">Cargando datos…</span>
      <p class="text-muted small mt-3 mb-0">Cargando…</p>
    </div>

    <div v-else class="position-relative">
      <!-- Recarga con filas ya visibles: overlay sobre la tabla existente. -->
      <div
        v-if="loading"
        class="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-white bg-opacity-75 resource-table-loading-overlay"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span class="spinner-border text-primary resource-table-loading-overlay__spinner" aria-hidden="true" />
        <span class="visually-hidden">Actualizando datos…</span>
      </div>
      <table class="table table-sm table-striped table-hover table-bordered align-middle">
        <table-header
          :table_properties="table_properties"
          :is_selectable="is_selectable"
          :filters="filters"
          :has_row_actions="has_row_actions"
          @open-filter="$emit('open-filter', $event)"
          @clear-filter="$emit('clear-filter', $event)"
        />
        <table-body
          :rows="rows"
          :table_properties="table_properties"
          :is_selectable="is_selectable"
          :selected="selected"
          :highlighted_row_id="highlighted_row_id"
          @row="$emit('row', $event)"
          @toggle="$emit('toggle', $event)"
        >
          <!-- Reenvía el slot de acciones por fila hacia el cuerpo de la tabla. -->
          <template v-if="$slots['row-actions']" #row-actions="slot_props">
            <slot name="row-actions" v-bind="slot_props" />
          </template>
        </table-body>
      </table>
    </div>
  </div>
</template>

<script>
import TableHeader from './header/Index.vue'
import TableBody from './body/Index.vue'

/**
 * Tabla de recursos con cabecera (lupitas) y cuerpo.
 * `table-striped`: filas alternadas (Bootstrap) para leer filas con más claridad.
 */
export default {
  name: 'ResourceTable',
  components: { TableHeader, TableBody },
  props: {
    rows: { type: Array, default: () => [] },
    table_properties: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    is_selectable: { type: Boolean, default: false },
    model_name: { type: String, default: '' },
    filters: { type: Array, default: () => [] },
    selected: { type: Array, default: () => [] },
    /** Id de fila resaltada (opcional); se reenvía al cuerpo de la tabla. */
    highlighted_row_id: {
      type: [Number, String],
      default: null,
    },
  },
  emits: ['open-filter', 'clear-filter', 'row', 'toggle'],
  computed: {
    /**
     * true en la primera carga del módulo (sin filas aún): evita overlay diminuto sobre tabla vacía.
     * @returns {boolean}
     */
    show_initial_loading() {
      return this.loading && (!this.rows || this.rows.length === 0)
    },
    /**
     * true cuando el consumidor define el slot de acciones por fila (columna extra).
     * @returns {boolean}
     */
    has_row_actions() {
      return Boolean(this.$slots['row-actions'])
    },
  },
}
</script>

<style scoped>
.resource-table-initial-loading {
  min-height: calc(100vh - 11rem);
  padding: 2rem 1rem;
}

.resource-table-initial-loading__spinner,
.resource-table-loading-overlay__spinner {
  width: 2.75rem;
  height: 2.75rem;
}

.resource-table-loading-overlay {
  z-index: 2;
  /* No bloquear scroll de la página mientras se recarga la tabla. */
  pointer-events: none;
}
</style>
