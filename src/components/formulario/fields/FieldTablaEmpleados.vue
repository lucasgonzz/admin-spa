<template>
  <!-- Tabla dinámica de empleados con columnas: Nombre, DNI, Teléfono y acción de eliminar fila -->
  <div class="field-tabla-empleados">
    <!-- Vista desktop: tabla horizontal -->
    <div class="field-tabla-empleados__table-wrap d-none d-sm-block">
      <table class="table field-tabla-empleados__table mb-2">
        <thead>
          <tr>
            <th>Nombre completo</th>
            <th>DNI</th>
            <th>Teléfono</th>
            <th class="field-tabla-empleados__th-action"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in rows" :key="index" class="field-tabla-empleados__row">
            <td>
              <input
                v-model="row.name"
                type="text"
                class="form-control form-control-sm field-tabla-empleados__input"
                placeholder="Nombre completo"
                @input="on_change"
              />
            </td>
            <td>
              <input
                v-model="row.dni"
                type="text"
                class="form-control form-control-sm field-tabla-empleados__input"
                placeholder="DNI"
                @input="on_change"
              />
            </td>
            <td>
              <input
                v-model="row.phone"
                type="text"
                class="form-control form-control-sm field-tabla-empleados__input"
                placeholder="Teléfono"
                @input="on_change"
              />
            </td>
            <td class="field-tabla-empleados__td-action">
              <!-- Botón eliminar fila: ícono de papelera, rojo al hover -->
              <button
                type="button"
                class="btn btn-link field-tabla-empleados__btn-delete"
                @click="remove_row(index)"
              >
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
          <!-- Fila vacía informativa cuando no hay empleados cargados -->
          <tr v-if="rows.length === 0">
            <td colspan="4" class="text-muted text-center small py-3">
              No hay empleados. Agregá el primero con el botón de abajo.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Vista mobile: cada fila como tarjeta vertical -->
    <div class="d-block d-sm-none">
      <div
        v-for="(row, index) in rows"
        :key="'m' + index"
        class="field-tabla-empleados__card mb-2"
      >
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="small fw-bold text-muted">Empleado {{ index + 1 }}</span>
          <button
            type="button"
            class="btn btn-link field-tabla-empleados__btn-delete p-0"
            @click="remove_row(index)"
          >
            <i class="bi bi-trash"></i>
          </button>
        </div>
        <input
          v-model="row.name"
          type="text"
          class="form-control form-control-sm mb-2"
          placeholder="Nombre completo"
          @input="on_change"
        />
        <input
          v-model="row.dni"
          type="text"
          class="form-control form-control-sm mb-2"
          placeholder="DNI"
          @input="on_change"
        />
        <input
          v-model="row.phone"
          type="text"
          class="form-control form-control-sm"
          placeholder="Teléfono"
          @input="on_change"
        />
      </div>
      <!-- Estado vacío mobile -->
      <p v-if="rows.length === 0" class="text-muted text-center small py-2 mb-2">
        No hay empleados. Agregá el primero con el botón de abajo.
      </p>
    </div>

    <!-- Botón para agregar una nueva fila vacía -->
    <button
      type="button"
      class="btn btn-outline-primary btn-sm"
      @click="add_row"
    >
      <i class="bi bi-plus me-1"></i>Agregar empleado
    </button>
  </div>
</template>

<script>
/**
 * Tabla dinámica de empleados.
 * Permite agregar y eliminar filas con nombre, DNI y teléfono.
 * En mobile se presenta cada fila como tarjeta vertical.
 *
 * @prop {object} question - Definición de la pregunta.
 * @prop {Array} value - Array de objetos { name, dni, phone }.
 * @emits update:value - Emite el array actualizado al padre.
 */
export default {
  name: 'FieldTablaEmpleados',

  props: {
    /**
     * Definición de la pregunta.
     */
    question: {
      type: Object,
      required: true,
    },

    /**
     * Array de empleados actualmente cargados.
     * Cada elemento: { name: string, dni: string, phone: string }
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
       * Se sincroniza con la prop value al montar y emite cambios al padre.
       */
      rows: [],
    }
  },

  watch: {
    /**
     * Sincroniza las filas locales cuando la prop value cambia desde el padre
     * (p. ej. al cargar datos guardados desde la API).
     */
    value: {
      immediate: true,
      handler(new_value) {
        /* Solo reemplaza si el contenido difiere para evitar loops */
        const serialized_new = JSON.stringify(new_value)
        const serialized_rows = JSON.stringify(this.rows)
        if (serialized_new !== serialized_rows) {
          this.rows = (new_value || []).map(function (r) {
            return { name: r.name || '', dni: r.dni || '', phone: r.phone || '' }
          })
        }
      },
    },
  },

  methods: {
    /**
     * Agrega una fila vacía al final de la tabla.
     *
     * @returns {void}
     */
    add_row() {
      this.rows.push({ name: '', dni: '', phone: '' })
      this.on_change()
    },

    /**
     * Elimina la fila en la posición indicada.
     *
     * @param {number} index
     * @returns {void}
     */
    remove_row(index) {
      this.rows.splice(index, 1)
      this.on_change()
    },

    /**
     * Emite el array actualizado de filas al componente padre.
     *
     * @returns {void}
     */
    on_change() {
      /* Emitir copia para evitar mutaciones reactivas inesperadas */
      this.$emit('update:value', this.rows.map(function (r) {
        return { name: r.name, dni: r.dni, phone: r.phone }
      }))
    },
  },
}
</script>

<style scoped>
/* Tabla sin bordes individuales en los inputs; el borde está en la fila */
.field-tabla-empleados__table {
  border-collapse: separate;
  border-spacing: 0;
}

.field-tabla-empleados__table thead th {
  font-size: 0.8rem;
  font-weight: 600;
  color: #6c757d;
  border-bottom: 1px solid #dee2e6;
  padding: 6px 8px;
}

.field-tabla-empleados__row td {
  padding: 6px 8px;
  border-bottom: 1px solid #f1f3f5;
  vertical-align: middle;
}

/* Input sin borde individual dentro de la tabla */
.field-tabla-empleados__input {
  border: none;
  background: transparent;
  box-shadow: none;
  padding: 4px 0;
}

.field-tabla-empleados__input:focus {
  background: #f8f9fa;
  border-radius: 6px;
  box-shadow: none;
}

.field-tabla-empleados__th-action,
.field-tabla-empleados__td-action {
  width: 36px;
  text-align: center;
}

/* Botón eliminar: gris por defecto, rojo al hover */
.field-tabla-empleados__btn-delete {
  color: #adb5bd;
  padding: 0;
  font-size: 0.9rem;
  transition: color 0.15s;
}

.field-tabla-empleados__btn-delete:hover {
  color: #dc3545;
}

/* Tarjeta mobile */
.field-tabla-empleados__card {
  border: 1px solid #dee2e6;
  border-radius: 10px;
  padding: 12px;
  background: #fff;
}
</style>
