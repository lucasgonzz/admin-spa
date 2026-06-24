<template>
  <!-- Input de texto corto para respuestas simples de una sola línea -->
  <input
    :value="value"
    type="text"
    class="form-control field-texto"
    :placeholder="question.hint || ''"
    @input="on_input"
  />
</template>

<script>
/**
 * Campo de texto corto (input type="text").
 * Emite el nuevo valor al padre en cada cambio.
 *
 * @prop {object} question - Definición de la pregunta.
 * @prop {string} value - Valor actual del campo.
 * @emits update:value - Emite el nuevo string ingresado.
 */
export default {
  name: 'FieldTexto',

  props: {
    /**
     * Definición de la pregunta.
     */
    question: {
      type: Object,
      required: true,
    },

    /**
     * Valor actual del campo de texto.
     */
    value: {
      type: String,
      default: '',
    },
  },

  methods: {
    /**
     * Emite el valor del input al componente padre.
     *
     * @param {InputEvent} event
     * @returns {void}
     */
    on_input(event) {
      this.$emit('update:value', event.target.value)
    },
  },
}
</script>

<style scoped>
.field-texto {
  border-radius: 10px;
  border: 1px solid #dee2e6;
  font-size: 0.95rem;
  padding: 10px 14px;
}

.field-texto:focus {
  border-color: var(--bs-primary);
  box-shadow: 0 0 0 0.15rem rgba(var(--bs-primary-rgb), 0.2);
}
</style>
