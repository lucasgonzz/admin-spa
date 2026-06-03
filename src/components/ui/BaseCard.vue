<template>
  <div class="card shadow-sm" :class="card_class">
    <div class="card-body">
      <slot />
    </div>
  </div>
</template>

<script>
/**
 * Tarjeta base reusable con estilos Bootstrap puros.
 */
export default {
  name: 'BaseCard',
  props: {
    card_class: {
      type: String,
      default: '',
    },
  },
}
</script>
