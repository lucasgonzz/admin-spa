<template>
  <div class="mb-2">
    <label class="form-label">{{ field.text || 'Valor' }}</label>
    <select v-model="draft.igual_que" class="form-select">
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
}
</script>
