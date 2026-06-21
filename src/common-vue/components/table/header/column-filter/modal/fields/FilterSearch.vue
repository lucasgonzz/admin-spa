<template>
  <div class="mb-2">
    <label class="form-label">Id del registro relacionado</label>
    <input
      v-model="draft.igual_que"
      type="number"
      min="0"
      step="1"
      class="form-control"
      @keyup.enter="$emit('filter')"
    />
  </div>
</template>

<script>
/**
 * Búsqueda de FK: en esta versión, por id. El modal de búsqueda completo puede ampliar esto.
 */
export default {
  name: 'FilterSearch',
  props: {
    field: { type: Object, default: null },
    model_name: { type: String, default: '' },
    draft: { type: Object, required: true },
  },
  emits: ['filter'],
}
</script>
