<template>
  <div class="mb-3">
    <label class="form-label">Contiene (cualquier orden)</label>
    <input
      ref="first_input"
      v-model="draft.que_contenga"
      type="text"
      class="form-control"
      @keyup.enter="$emit('filter')"
    />
  </div>
</template>

<script>
/**
 * Filtro tipo texto/textarea: palabras con LIKE múltiple (backend).
 */
export default {
  name: 'FilterText',
  props: {
    draft: { type: Object, required: true },
  },
  emits: ['filter'],
  methods: {
    /**
     * Enfoca el input de texto para permitir escribir al abrir el modal.
     * @returns {void}
     */
    focus_input() {
      const input = this.$refs.first_input
      if (input) {
        input.focus()
      }
    },
  },
}
</script>
