<template>
  <span class="column-filter-actions d-inline-flex align-items-center">
    <button
      type="button"
      class="column-filter-btn"
      :class="{ 'column-filter-btn--active': active }"
      :title="active ? 'Filtro activo' : 'Filtrar'"
      :aria-label="active ? 'Filtro activo en esta columna' : 'Filtrar esta columna'"
      @click.stop="$emit('open')"
    >
      <i class="bi bi-search" aria-hidden="true" />
    </button>
    <button
      v-if="active"
      type="button"
      class="column-filter-btn column-filter-btn--clear"
      title="Quitar filtro de esta columna"
      aria-label="Quitar filtro de esta columna"
      @click.stop="$emit('clear')"
    >
      <i class="bi bi-x-lg" aria-hidden="true" />
    </button>
  </span>
</template>

<script>
/**
 * Botones de filtro por columna: lupa circular y quitar filtro cuando hay criterio activo.
 */
export default {
  name: 'ColumnBtnFilter',
  props: {
    active: { type: Boolean, default: false },
  },
  emits: ['open', 'clear'],
}
</script>

<style scoped lang="scss">
.column-filter-actions {
	gap: 0.35rem;
}

.column-filter-btn {
	width: 1.65rem;
	height: 1.65rem;
	padding: 0;
	border: 1px solid rgba(255, 255, 255, 0.28);
	border-radius: 999px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	background: rgba(255, 255, 255, 0.1);
	color: rgba(255, 255, 255, 0.92);
	font-size: 0.72rem;
	line-height: 1;
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
	transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}

.column-filter-btn:hover {
	background: rgba(255, 255, 255, 0.22);
	border-color: rgba(255, 255, 255, 0.5);
	box-shadow: 0 2px 6px rgba(0, 0, 0, 0.22);
	transform: translateY(-1px);
}

.column-filter-btn:active {
	transform: translateY(0);
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.16);
}

.column-filter-btn--active {
	background: #20c997;
	border-color: #1aa179;
	color: #fff;
	box-shadow: 0 2px 8px rgba(32, 201, 151, 0.35);
}

.column-filter-btn--active:hover {
	background: #1db888;
	border-color: #189e76;
}

.column-filter-btn--clear {
	background: rgba(255, 193, 7, 0.18);
	border-color: rgba(255, 193, 7, 0.55);
	color: #ffe08a;
}

.column-filter-btn--clear:hover {
	background: rgba(255, 193, 7, 0.32);
	border-color: rgba(255, 193, 7, 0.75);
	color: #fff3bf;
}
</style>
