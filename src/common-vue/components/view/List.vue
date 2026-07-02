<template>
  <div>
    <resource-table
      v-bind="$attrs"
      :rows="rows"
      :loading="loading"
      :is_selectable="is_selectable"
      :table_properties="table_properties"
      :model_name="model_name"
      :filters="filters"
      :selected="selected"
      :highlighted_row_id="highlighted_row_id"
      @open-filter="$emit('open-filter', $event)"
      @clear-filter="$emit('clear-filter', $event)"
      @row="$emit('row', $event)"
      @toggle="$emit('toggle', $event)"
    >
      <!-- Reenvía el slot de acciones por fila hacia la tabla de recursos. -->
      <template v-if="$slots['row-actions']" #row-actions="slot_props">
        <slot name="row-actions" v-bind="slot_props" />
      </template>
    </resource-table>
  </div>
</template>

<script>
import ResourceTable from '@/common-vue/components/table/Index.vue'

/**
 * Contenedor de tabla (más adelante: días previos, paginación adicional).
 */
export default {
  name: 'ViewList',
  components: { ResourceTable },
  props: {
    model_name: { type: String, required: true },
    rows: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    is_selectable: { type: Boolean, default: false },
    table_properties: { type: Array, default: () => [] },
    filters: { type: Array, default: () => [] },
    selected: { type: Array, default: () => [] },
    /** Id de fila resaltada (opcional); se reenvía a la tabla de recursos. */
    highlighted_row_id: {
      type: [Number, String],
      default: null,
    },
  },
  emits: ['open-filter', 'clear-filter', 'row', 'toggle'],
}
</script>
