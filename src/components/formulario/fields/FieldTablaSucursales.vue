<template>
  <!-- Tabla dinámica de sucursales o depósitos con columna de nombre -->
  <div class="field-tabla-sucursales">
    <!-- Vista desktop -->
    <div class="d-none d-sm-block">
      <table class="table field-tabla__table mb-2">
        <thead>
          <tr>
            <th>Nombre de la sucursal o depósito</th>
            <th class="field-tabla__th-action"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in rows" :key="index" class="field-tabla__row">
            <td>
              <input
                v-model="row.name"
                type="text"
                class="form-control form-control-sm field-tabla__input"
                placeholder="Ej: Depósito central, Sucursal Palermo..."
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
            <td colspan="2" class="text-muted text-center small py-3">
              No hay sucursales. Agregá la primera con el botón de abajo.
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
          <span class="small fw-bold text-muted">Sucursal {{ index + 1 }}</span>
          <button
            type="button"
            class="btn btn-link field-tabla__btn-delete p-0"
            @click="remove_row(index)"
          >
            <i class="bi bi-trash"></i>
          </button>
        </div>
        <input
          v-model="row.name"
          type="text"
          class="form-control form-control-sm"
          placeholder="Nombre de la sucursal"
          @input="on_change"
        />
      </div>
      <p v-if="rows.length === 0" class="text-muted text-center small py-2 mb-2">
        No hay sucursales. Agregá la primera con el botón de abajo.
      </p>
    </div>

    <button
      type="button"
      class="btn btn-outline-primary btn-sm"
      @click="add_row"
    >
      <i class="bi bi-plus me-1"></i>Agregar sucursal
    </button>
  </div>
</template>

<script>
/**
 * Tabla dinámica de sucursales o depósitos.
 * Solo tiene columna de nombre.
 *
 * @prop {object} question - Definición de la pregunta.
 * @prop {Array} value - Array de objetos { name }.
 * @emits update:value - Emite el array actualizado al padre.
 */
export default {
  name: 'FieldTablaSucursales',

  props: {
    /**
     * Definición de la pregunta.
     */
    question: {
      type: Object,
      required: true,
    },

    /**
     * Array de sucursales cargadas.
     * Cada elemento: { name: string }
     */
    value: {
      type: Array,
      default: function () { return [] },
    },
  },

  data() {
    return {
      /**
       * Copia local mutable del array para edición.
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
            return { name: r.name || '' }
          })
        }
      },
    },
  },

  methods: {
    /**
     * Agrega una fila vacía.
     *
     * @returns {void}
     */
    add_row() {
      this.rows.push({ name: '' })
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
        return { name: r.name }
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
  color: #6c757d;
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
