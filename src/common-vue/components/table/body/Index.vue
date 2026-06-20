<template>
  <tbody>
    <tr
      v-for="row in rows"
      :key="row.id"
      class="clickable"
      :class="{ 'table-primary': is_selected(row) }"
      @click="$emit('row', row)"
    >
      <td v-if="is_selectable" @click.stop>
        <input
          type="checkbox"
          class="form-check-input"
          :checked="is_selected(row)"
          @change="() => $emit('toggle', row)"
        />
      </td>
      <!-- Columna opcional de acciones por fila: primera columna de datos (slot del consumidor). -->
      <td v-if="$slots['row-actions']" class="text-center text-nowrap" @click.stop>
        <slot name="row-actions" :row="row" />
      </td>
      <td
        v-for="p in table_properties"
        :key="p.key + '-' + row.id"
        :class="{ 'text-wrap': p.wrap_content, 'd-none d-md-table-cell': p.not_show_on_table }"
        :style="cell_style(p)"
      >
        <cell-renderer :prop="p" :row="row" />
      </td>
    </tr>
  </tbody>
</template>

<script>
import CellRenderer from './cell/Index.vue'

/**
 * Filas de la tabla: selección y celdas por propiedad.
 */
export default {
  name: 'TableBody',
  components: { CellRenderer },
  props: {
    rows: { type: Array, default: () => [] },
    table_properties: { type: Array, default: () => [] },
    is_selectable: { type: Boolean, default: false },
    selected: { type: Array, default: () => [] },
  },
  emits: ['row', 'toggle'],
  methods: {
    is_selected(row) {
      return this.selected.some((s) => s.id == row.id)
    },
    cell_style(p) {
      if (p && p.width) {
        return { minWidth: p.width + 'px', maxWidth: p.width * 1.4 + 'px' }
      }
      return {}
    },
  },
}
</script>

<style scoped>
.clickable {
  cursor: pointer;
}
</style>
