<template>
  <!-- Textarea para respuestas de texto largo o multilínea -->
  <textarea
    :value="value"
    class="form-control field-texto-largo"
    :placeholder="question.hint || ''"
    rows="4"
    @input="on_input"
  ></textarea>
</template>

<script>
/**
 * Campo de texto largo (textarea).
 * Útil para contenido multilínea como listas de redes sociales.
 *
 * @prop {object} question - Definición de la pregunta.
 * @prop {string} value - Valor actual del textarea.
 * @emits update:value - Emite el nuevo string ingresado.
 */
export default {
  name: 'FieldTextoLargo',

  props: {
    /**
     * Definición de la pregunta.
     */
    question: {
      type: Object,
      required: true,
    },

    /**
     * Valor actual del textarea.
     */
    value: {
      type: String,
      default: '',
    },
  },

  methods: {
    /**
     * Emite el valor del textarea al componente padre.
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
.field-texto-largo {
  border-radius: 10px;
  border: 1px solid #dee2e6;
  font-size: 0.95rem;
  padding: 10px 14px;
  resize: vertical;
}

.field-texto-largo:focus {
  border-color: var(--bs-primary);
  box-shadow: 0 0 0 0.15rem rgba(var(--bs-primary-rgb), 0.2);
}
</style>
