<template>
  <!-- Select para elegir el responsable de migración entre los empleados cargados o "Yo mismo" -->
  <select
    :value="value"
    class="form-select field-select-empleado"
    @change="on_change"
  >
    <!-- Opción fija siempre visible al inicio -->
    <option value="yo_mismo">Yo mismo</option>
    <!-- Opciones dinámicas construidas desde los empleados cargados en la tabla -->
    <option
      v-for="(employee, index) in employees_with_name"
      :key="index"
      :value="employee.name"
    >
      {{ employee.name }}
    </option>
  </select>
</template>

<script>
/**
 * Select del responsable de migración.
 * Construye las opciones dinámicamente desde form_data.employees.
 * Siempre incluye "Yo mismo" como primera opción fija.
 *
 * @prop {object} question - Definición de la pregunta.
 * @prop {string|null} value - Nombre del empleado seleccionado o 'yo_mismo'.
 * @prop {Array} employees - Array de empleados cargados en FieldTablaEmpleados.
 * @emits update:value - Emite el nuevo valor seleccionado.
 */
export default {
  name: 'FieldSelectEmpleado',

  props: {
    /**
     * Definición de la pregunta.
     */
    question: {
      type: Object,
      required: true,
    },

    /**
     * Valor actualmente seleccionado: nombre del empleado o 'yo_mismo'.
     */
    value: {
      type: String,
      default: 'yo_mismo',
    },

    /**
     * Lista de empleados cargados desde la tabla de empleados.
     * Solo se muestran los que tienen nombre no vacío.
     */
    employees: {
      type: Array,
      default: function () { return [] },
    },
  },

  computed: {
    /**
     * Filtra los empleados que tienen nombre cargado para mostrarlos en el select.
     *
     * @returns {Array<{name: string}>}
     */
    employees_with_name() {
      return (this.employees || []).filter(function (e) {
        return e.name && e.name.trim() !== ''
      })
    },
  },

  mounted() {
    /**
     * Si no hay valor cargado en form_data, emitir 'yo_mismo' como valor por defecto
     * para que can_continue() lo reconozca como respondido desde el inicio.
     */
    if (!this.value) {
      this.$emit('update:value', 'yo_mismo')
    }
  },

  methods: {
    /**
     * Emite el valor seleccionado al padre.
     *
     * @param {Event} event
     * @returns {void}
     */
    on_change(event) {
      this.$emit('update:value', event.target.value)
    },
  },
}
</script>

<style scoped>
.field-select-empleado {
  border-radius: 10px;
  border: 1px solid #dee2e6;
  font-size: 0.95rem;
  padding: 10px 14px;
}

.field-select-empleado:focus {
  border-color: var(--bs-primary);
  box-shadow: 0 0 0 0.15rem rgba(var(--bs-primary-rgb), 0.2);
}
</style>
