<template>
  <div class="mb-3">
    <label class="form-label">Contiene (cualquier orden)</label>
    <input v-model="draft.que_contenga" type="text" class="form-control" />
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
}
</script>
