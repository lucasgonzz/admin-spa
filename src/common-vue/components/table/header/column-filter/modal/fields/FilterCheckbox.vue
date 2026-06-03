<template>
  <div class="mb-2">
    <label class="form-label">{{ field.text }}</label>
    <select v-model="draft.checkbox" class="form-select">
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
}
</script>
