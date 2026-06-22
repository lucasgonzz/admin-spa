<template>
  <div class="mb-2">
    <label class="form-label">{{ field.text || 'Valor' }}</label>
    <select ref="first_input" v-model="draft.igual_que" class="form-select">
      <option :value="null">—</option>
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.text }}</option>
    </select>
  </div>
</template>

<script>
/**
 * Filtro select: lista estática de options de la property.
 */
export default {
  name: 'FilterSelect',
  props: {
    field: { type: Object, required: true },
    draft: { type: Object, required: true },
  },
  computed: {
    options() {
      return this.field.options || []
    },
  },
  methods: {
    /**
     * Enfoca el select al abrir el modal de filtro.
     * @returns {void}
     */
    focus_input() {
      const select = this.$refs.first_input
      if (select) {
        select.focus()
      }
    },
  },
}
</script>
