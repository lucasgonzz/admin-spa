<template>
  <!-- Tabla dinámica de listas de precios con nombre y margen de ganancia por defecto -->
  <div class="field-tabla-listas">
    <!-- Vista desktop -->
    <div class="d-none d-sm-block">
      <table class="table field-tabla__table mb-2">
        <thead>
          <tr>
            <th>Nombre de la lista</th>
            <th>Margen de ganancia por defecto (%)</th>
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
                placeholder="Nombre"
                @input="on_change"
              />
            </td>
            <td>
              <input
                v-model="row.margin"
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
            <td colspan="3" class="text-muted text-center small py-3">
              No hay listas. Agregá la primera con el botón de abajo.
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
          <span class="small fw-bold text-muted">Lista {{ index + 1 }}</span>
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
          class="form-control form-control-sm mb-2"
          placeholder="Nombre de la lista"
          @input="on_change"
        />
        <input
          v-model="row.margin"
          type="number"
          class="form-control form-control-sm"
          placeholder="Margen (%)"
          min="0"
          @input="on_change"
        />
      </div>
      <p v-if="rows.length === 0" class="text-muted text-center small py-2 mb-2">
        No hay listas. Agregá la primera con el botón de abajo.
      </p>
    </div>

    <button
      type="button"
      class="btn btn-outline-primary btn-sm"
      @click="add_row"
    >
      <i class="bi bi-plus me-1"></i>Agregar lista
    </button>
  </div>
</template>

<script>
/**
 * Tabla dinámica de listas de precios.
 * Permite agregar y eliminar filas con nombre y margen de ganancia por defecto.
 *
 * @prop {object} question - Definición de la pregunta.
 * @prop {Array} value - Array de objetos { name, margin }.
 * @emits update:value - Emite el array actualizado al padre.
 */
export default {
  name: 'FieldTablaListas',

  props: {
    /**
     * Definición de la pregunta.
     */
    question: {
      type: Object,
      required: true,
    },

    /**
     * Array de listas de precios cargadas.
     * Cada elemento: { name: string, margin: number }
     */
    value: {
      type: Array,
      default: function () { return [] },
    },
  },

  data() {
    return {
      /**
       * Copia local mutable del array para edición en la tabla.
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
            return { name: r.name || '', margin: r.margin != null ? r.margin : '' }
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
      this.rows.push({ name: '', margin: '' })
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
        return { name: r.name, margin: r.margin }
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
