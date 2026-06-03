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
      @open-filter="$emit('open-filter', $event)"
      @clear-filter="$emit('clear-filter', $event)"
      @row="$emit('row', $event)"
      @toggle="$emit('toggle', $event)"
    />
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
  },
  emits: ['open-filter', 'clear-filter', 'row', 'toggle'],
}
</script>
