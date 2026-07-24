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

/* Amarillo de fila que necesita atencion, mas saturado que el pastel de Bootstrap.
   Hay que pisar las tres variantes (base, striped y hover) porque en Bootstrap 5.3
   las filas impares usan --bs-table-striped-bg y el hover usa --bs-table-hover-bg:
   pisando solo --bs-table-bg el color viejo seguiria apareciendo en la mitad de las filas. */
tr.table-warning {
  --bs-table-bg: #ffe08a;
  --bs-table-striped-bg: #f7d67f;
  --bs-table-hover-bg: #f5cf6d;
  --bs-table-border-color: #f0cf6a;
}

/* Rojo de fila que pide accion (pendiente de revision, o mensaje que no se pudo enviar). */
tr.table-danger {
  --bs-table-bg: #f7b0b6;
  --bs-table-striped-bg: #efa7ad;
  --bs-table-hover-bg: #eb9aa1;
  --bs-table-border-color: #e79ba1;
}
</style>
