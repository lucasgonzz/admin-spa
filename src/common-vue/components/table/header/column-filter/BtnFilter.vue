<template>
  <span class="d-inline-flex align-items-center gap-1">
    <button
      class="ms-1 border-0 btn btn-sm"
      :class="active ? 'btn-success' : 'btn-outline-primary'"
      :title="active ? 'Filtro activo' : 'Filtrar'"
      @click.stop="$emit('open')"
    >
      <i class="bi bi-search" />
    </button>
    <button
      v-if="active"
      type="button"
      class="border-0 btn btn-sm btn-warning"
      title="Quitar filtro de esta columna"
      @click.stop="$emit('clear')"
    >
      <i class="bi bi-x-circle" />
    </button>
  </span>
</template>

<script>
/**
 * Lupita de filtro por columna: verde si ya hay criterio en store.filters.
 */
export default {
  name: 'ColumnBtnFilter',
  props: {
    active: { type: Boolean, default: false },
  },
  emits: ['open', 'clear'],
}
</script>
