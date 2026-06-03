<template>
  <div>
    <div class="mb-2">
      <label class="form-label">Desde (mayor estricto)</label>
      <input v-model="draft.mayor_que" type="date" class="form-control" />
    </div>
    <div class="mb-2">
      <label class="form-label">Día exacto</label>
      <input v-model="draft.igual_que" type="date" class="form-control" />
    </div>
    <div class="mb-2">
      <label class="form-label">Hasta (menor estricto)</label>
      <input v-model="draft.menor_que" type="date" class="form-control" />
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
}
</script>
