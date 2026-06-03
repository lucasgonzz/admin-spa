<template>
  <div class="table-responsive">
    <div class="position-relative">
      <div v-if="loading" class="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-white bg-opacity-75" style="z-index: 2">
        <div class="spinner-border text-primary" role="status"></div>
      </div>
      <table class="table table-sm table-striped table-hover table-bordered align-middle">
        <table-header
          :table_properties="table_properties"
          :is_selectable="is_selectable"
          :filters="filters"
          @open-filter="$emit('open-filter', $event)"
          @clear-filter="$emit('clear-filter', $event)"
        />
        <table-body
          :rows="rows"
          :table_properties="table_properties"
          :is_selectable="is_selectable"
          :selected="selected"
          @row="$emit('row', $event)"
          @toggle="$emit('toggle', $event)"
        />
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
  },
  emits: ['open-filter', 'clear-filter', 'row', 'toggle'],
}
</script>
