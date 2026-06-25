<template>
  <div>
    <button type="button" class="btn btn-primary" @click="do_filter">Filtrar</button>
  </div>
</template>

<script>
/**
 * Aplica el criterio del modal y ejecuta la búsqueda filtrada de inmediato.
 */
export default {
  name: 'ColumnFilterFooter',
  emits: ['filter'],
  methods: {
    /**
     * Emite evento para agregar criterio y correr búsqueda.
     * @returns {void}
     */
    do_filter() {
      this.$emit('filter')
    },
  },
}
</script>
