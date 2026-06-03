<template>
  <div v-if="show" class="mb-2 p-2 bg-light rounded small">Navegación por días (próxima iteración)</div>
</template>

<script>
/**
 * Fracción "días previos" (empresa-spa). Activar con prop + store from_dates.
 */
export default {
  name: 'PreviusDays',
  props: {
    show: { type: Boolean, default: false },
  },
}
</script>
