<template>
  <transition name="fade">
    <button
      v-if="visible"
      class="table-fab position-fixed rounded-circle p-3 shadow btn btn-primary"
      @click="$emit('apply')"
    >
      <i class="bi bi-funnel-fill" />
    </button>
  </transition>
</template>

<script>
/**
 * FAB inferior derecho: aplica los filtros armados hacia el API.
 */
export default {
  name: 'TableFab',
  props: {
    visible: { type: Boolean, default: false },
  },
  emits: ['apply'],
}
</script>

<style scoped lang="scss">
.table-fab {
  right: 1.25rem;
  bottom: 1.25rem;
  z-index: 1020;
}
</style>
