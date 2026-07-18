<template>
  <!-- Tabla dinámica de descuentos o recargos por método de pago -->
  <div class="field-tabla-descuentos">
    <!-- Vista desktop -->
    <div class="d-none d-sm-block">
      <table class="table field-tabla__table mb-2">
        <thead>
          <tr>
            <th>Método de pago</th>
            <th>Tipo</th>
            <th>Porcentaje (%)</th>
            <th class="field-tabla__th-action"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in rows" :key="index" class="field-tabla__row">
            <td>
              <!-- Select de método de pago: reemplaza el texto libre por las opciones
                   sembradas en el backend (payment_method_options), para poder enganchar
                   el descuento con el método real al procesar ventas -->
              <select
                v-model="row.method"
                class="form-select form-select-sm field-tabla__input"
                @change="on_change"
              >
                <option value="">Elegí un método</option>
                <option
                  v-for="opt in payment_method_options"
                  :key="opt.key"
                  :value="opt.key"
                >{{ opt.label }}</option>
              </select>
            </td>
            <td>
              <!-- Select: Descuento o Recargo -->
              <select
                v-model="row.type"
                class="form-select form-select-sm field-tabla__input"
                @change="on_change"
              >
                <option value="descuento">Descuento</option>
                <option value="recargo">Recargo</option>
              </select>
            </td>
            <td>
              <input
                v-model="row.percentage"
                type="number"
                class="form-control form-control-sm field-tabla__input"
                placeholder="0"
                min="0"
                @input="on_change"
              />
            </td>
            <td class="field-tabla__td-action">
              <button
                type="button"
                class="btn btn-link field-tabla__btn-delete"
                @click="remove_row(index)"
              >
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
          <tr v-if="rows.length === 0">
            <td colspan="4" class="text-muted text-center small py-3">
              Sin descuentos ni recargos configurados.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Vista mobile: tarjetas verticales -->
    <div class="d-block d-sm-none">
      <div
        v-for="(row, index) in rows"
        :key="'m' + index"
        class="field-tabla__card mb-2"
      >
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="small fw-bold text-muted">Ítem {{ index + 1 }}</span>
          <button
            type="button"
            class="btn btn-link field-tabla__btn-delete p-0"
            @click="remove_row(index)"
          >
            <i class="bi bi-trash"></i>
          </button>
        </div>
        <!-- Select de método de pago (versión mobile), mismas opciones que el desktop -->
        <select
          v-model="row.method"
          class="form-select form-select-sm mb-2"
          @change="on_change"
        >
          <option value="">Elegí un método</option>
          <option
            v-for="opt in payment_method_options"
            :key="opt.key"
            :value="opt.key"
          >{{ opt.label }}</option>
        </select>
        <select
          v-model="row.type"
          class="form-select form-select-sm mb-2"
          @change="on_change"
        >
          <option value="descuento">Descuento</option>
          <option value="recargo">Recargo</option>
        </select>
        <input
          v-model="row.percentage"
          type="number"
          class="form-control form-control-sm"
          placeholder="Porcentaje (%)"
          min="0"
          @input="on_change"
        />
      </div>
      <p v-if="rows.length === 0" class="text-muted text-center small py-2 mb-2">
        Sin descuentos ni recargos configurados.
      </p>
    </div>

    <button
      type="button"
      class="btn btn-outline-primary btn-sm"
      @click="add_row"
    >
      <i class="bi bi-plus me-1"></i>Agregar
    </button>
  </div>
</template>

<script>
/**
 * Tabla dinámica de descuentos o recargos por método de pago.
 * Columnas: método (select sobre payment_method_options), tipo (descuento/recargo), porcentaje.
 *
 * @prop {object} question - Definición de la pregunta.
 * @prop {Array} value - Array de objetos { method, type, percentage }. `method` guarda el
 *                        `key` del método de pago elegido (ej. 'efectivo'), no texto libre.
 * @prop {Array} payment_method_options - Opciones { key, label } para el select de método.
 * @emits update:value - Emite el array actualizado al padre.
 */
export default {
  name: 'FieldTablaDescuentos',

  props: {
    /**
     * Definición de la pregunta.
     */
    question: {
      type: Object,
      required: true,
    },

    /**
     * Array de descuentos/recargos cargados.
     * Cada elemento: { method: string, type: 'descuento'|'recargo', percentage: number }
     */
    value: {
      type: Array,
      default: function () { return [] },
    },

    /**
     * Opciones de métodos de pago { key, label } para poblar el select
     * de la columna "Método de pago" (reemplaza el input de texto libre).
     */
    payment_method_options: {
      type: Array,
      default: function () { return [] },
    },
  },

  data() {
    return {
      /**
       * Copia local mutable para edición en la tabla.
       */
      rows: [],
    }
  },

  watch: {
    value: {
      immediate: true,
      handler(new_value) {
        const serialized_new = JSON.stringify(new_value)
        const serialized_rows = JSON.stringify(this.rows)
        if (serialized_new !== serialized_rows) {
          this.rows = (new_value || []).map(function (r) {
            return {
              method:     r.method || '',
              type:       r.type || 'descuento',
              percentage: r.percentage != null ? r.percentage : '',
            }
          })
        }
      },
    },
  },

  methods: {
    /**
     * Agrega una fila vacía con tipo 'descuento' por defecto.
     *
     * @returns {void}
     */
    add_row() {
      this.rows.push({ method: '', type: 'descuento', percentage: '' })
      this.on_change()
    },

    /**
     * Elimina la fila en el índice indicado.
     *
     * @param {number} index
     * @returns {void}
     */
    remove_row(index) {
      this.rows.splice(index, 1)
      this.on_change()
    },

    /**
     * Emite el array actualizado al padre.
     *
     * @returns {void}
     */
    on_change() {
      this.$emit('update:value', this.rows.map(function (r) {
        return { method: r.method, type: r.type, percentage: r.percentage }
      }))
    },
  },
}
</script>

<style scoped>
.field-tabla__table {
  border-collapse: separate;
  border-spacing: 0;
}

.field-tabla__table thead th {
  font-size: 0.8rem;
  font-weight: 600;
  color: #ffffff;
  border-bottom: 1px solid #dee2e6;
  padding: 6px 8px;
}

.field-tabla__row td {
  padding: 6px 8px;
  border-bottom: 1px solid #f1f3f5;
  vertical-align: middle;
}

.field-tabla__input {
  border: none;
  background: transparent;
  box-shadow: none;
  padding: 4px 0;
}

.field-tabla__input:focus {
  background: #f8f9fa;
  border-radius: 6px;
  box-shadow: none;
}

.field-tabla__th-action,
.field-tabla__td-action {
  width: 36px;
  text-align: center;
}

.field-tabla__btn-delete {
  color: #adb5bd;
  padding: 0;
  font-size: 0.9rem;
  transition: color 0.15s;
}

.field-tabla__btn-delete:hover {
  color: #dc3545;
}

.field-tabla__card {
  border: 1px solid #dee2e6;
  border-radius: 10px;
  padding: 12px;
  background: #fff;
}
</style>
