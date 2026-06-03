<template>
  <ul class="nav nav-tabs" role="tablist">
    <li v-for="tab in tabs" :key="tab.id" class="nav-item" role="presentation">
      <button
        type="button"
        class="nav-link"
        :class="{ active: active_tab === tab.id }"
        @click="$emit('change', tab.id)"
      >
        {{ tab.label }}
        <span class="badge bg-light text-dark ms-1">{{ tab.count }}</span>
        <span v-if="tab.has_error" class="badge bg-danger ms-1">!</span>
      </button>
    </li>
  </ul>
</template>

<script>
/**
 * Barra de pestañas del detalle de una actualización.
 * Cada tab puede mostrar un contador y un indicador de error.
 */
export default {
  name: 'UpdateTabNav',
  props: {
    tabs: { type: Array, default: () => [] },
    active_tab: { type: String, default: 'steps' },
  },
  emits: ['change'],
}
</script>
