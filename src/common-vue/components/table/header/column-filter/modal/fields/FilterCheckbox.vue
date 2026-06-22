<template>
  <div class="mb-2">
    <label class="form-label">{{ field.text }}</label>
    <select ref="first_input" v-model="draft.checkbox" class="form-select">
      <option v-for="o in cb_options" :key="o.value" :value="o.value">{{ o.text }}</option>
    </select>
  </div>
</template>

<script>
/**
 * Filtro boolean (checkbox en backend: key checkbox).
 */
export default {
  name: 'FilterCheckbox',
  props: {
    field: { type: Object, required: true },
    draft: { type: Object, required: true },
  },
  data() {
    return {
      cb_options: [
        { value: -1, text: '—' },
        { value: 1, text: 'Sí' },
        { value: 0, text: 'No' },
      ],
    }
  },
  methods: {
    /**
     * Enfoca el select booleano al abrir el modal de filtro.
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
