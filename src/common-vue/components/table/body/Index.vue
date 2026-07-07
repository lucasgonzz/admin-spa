<template>
  <tbody>
    <tr
      v-for="row in rows"
      :key="row.id"
      class="clickable"
      :class="row_highlight_classes(row)"
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
    /**
     * Id opcional de fila a resaltar (p. ej. lead con conversación WhatsApp abierta en sidebar).
     * null = ninguna fila resaltada.
     */
    highlighted_row_id: {
      type: [Number, String],
      default: null,
    },
    /**
     * Ids de filas a pintar en rojo (p. ej. leads pendientes de revisión). Vacío = ninguna.
     */
    danger_row_ids: {
      type: Array,
      default: () => [],
    },
  },
  emits: ['row', 'toggle'],
  methods: {
    /**
     * true si la fila coincide con highlighted_row_id (conversación u otro contexto activo).
     * @param {Object} row
     * @returns {boolean}
     */
    is_row_highlighted(row) {
      if (this.highlighted_row_id == null || this.highlighted_row_id === '') {
        return false
      }
      return row && row.id != null && String(row.id) === String(this.highlighted_row_id)
    },
    /**
     * true si la fila trae el flag genérico `row_warning` (fila que necesita atención). En leads lo
     * setea el backend (prompt 294) cuando el lead tiene ≥1 mensaje pendiente de verificación del
     * setter. Reservado y genérico: cualquier módulo puede exponer row.row_warning para pintar la
     * fila de amarillo, sin threadear props.
     * @param {Object} row
     * @returns {boolean}
     */
    is_row_warning(row) {
      return Boolean(row && row.row_warning)
    },
    /**
     * true si la fila está en la lista de filas "peligro" (rojo), p. ej. leads pendientes de
     * revisión (prompt 296). Vacío en danger_row_ids = ninguna fila en rojo.
     * @param {Object} row
     * @returns {boolean}
     */
    is_row_danger(row) {
      if (!this.danger_row_ids || this.danger_row_ids.length === 0) {
        return false
      }
      if (!row || row.id == null) {
        return false
      }
      return this.danger_row_ids.some((id) => String(id) === String(row.id))
    },
    /**
     * Clases Bootstrap de la fila. Prioridad (una sola gana): verde (conversación activa) > rojo
     * (pendiente de revisión) > amarillo (necesita atención / verificación pendiente) > azul
     * (seleccionada con checkbox).
     * @param {Object} row
     * @returns {Object}
     */
    row_highlight_classes(row) {
      var highlighted = this.is_row_highlighted(row)
      var danger = !highlighted && this.is_row_danger(row)
      var warning = !highlighted && !danger && this.is_row_warning(row)
      return {
        'table-success': highlighted,
        'table-danger': danger,
        'table-warning': warning,
        'table-primary': !highlighted && !danger && !warning && this.is_selected(row),
      }
    },
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
