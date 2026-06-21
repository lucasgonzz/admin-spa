<template>
  <div>
    <div class="mb-2">
      <label class="form-label">Mayor que</label>
      <input v-model="draft.menor_que" class="form-control" @keyup.enter="$emit('filter')" />
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
}
</script>
