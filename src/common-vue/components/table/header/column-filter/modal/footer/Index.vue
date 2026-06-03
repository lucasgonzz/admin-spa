<template>
  <div>
    <button type="button" class="btn btn-secondary me-2" @click="add_only">Agregar filtro</button>
    <button type="button" class="btn btn-primary" @click="do_filter">Filtrar</button>
  </div>
</template>

<script>
/**
 * "Agregar filtro" solo encola; "Filtrar" aplica búsqueda inmediata.
 */
export default {
  name: 'ColumnFilterFooter',
  emits: ['add-only', 'filter'],
  methods: {
    add_only() {
      this.$emit('add-only')
    },
    do_filter() {
      this.$emit('filter')
    },
  },
}
</script>
