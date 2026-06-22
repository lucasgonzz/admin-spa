<template>
  <div>
    <div class="mb-2">
      <label class="form-label">Mayor que</label>
      <input ref="first_input" v-model="draft.menor_que" class="form-control" @keyup.enter="$emit('filter')" />
    </div>
    <div class="mb-2">
      <label class="form-label">Igual a</label>
      <input v-model="draft.igual_que" class="form-control" @keyup.enter="$emit('filter')" />
    </div>
    <div class="mb-2">
      <label class="form-label">Menor que (campo < valor)</label>
      <input v-model="draft.mayor_que" class="form-control" @keyup.enter="$emit('filter')" />
    </div>
  </div>
</template>

<script>
/**
 * Filtro numérico (menor/mayor según lógica SearchController admin-api).
 */
export default {
  name: 'FilterNumber',
  props: {
    draft: { type: Object, required: true },
  },
  emits: ['filter'],
  methods: {
    /**
     * Enfoca el primer campo numérico al abrir el modal.
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
