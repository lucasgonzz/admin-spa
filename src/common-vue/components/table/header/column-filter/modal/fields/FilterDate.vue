<template>
  <div>
    <div class="mb-2">
      <label class="form-label">Desde (mayor estricto)</label>
      <input ref="first_input" v-model="draft.mayor_que" type="date" class="form-control" @keyup.enter="$emit('filter')" />
    </div>
    <div class="mb-2">
      <label class="form-label">Día exacto</label>
      <input v-model="draft.igual_que" type="date" class="form-control" @keyup.enter="$emit('filter')" />
    </div>
    <div class="mb-2">
      <label class="form-label">Hasta (menor estricto)</label>
      <input v-model="draft.menor_que" type="date" class="form-control" @keyup.enter="$emit('filter')" />
    </div>
  </div>
</template>

<script>
/**
 * Filtro fecha (whereDate).
 */
export default {
  name: 'FilterDate',
  props: {
    draft: { type: Object, required: true },
  },
  emits: ['filter'],
  methods: {
    /**
     * Enfoca el primer campo de fecha al abrir el modal.
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
