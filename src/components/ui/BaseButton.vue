<template>
  <button
    :type="type"
    class="btn"
    :class="button_class"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<script>
/**
 * Botón base reusable con clases Bootstrap.
 */
export default {
  name: 'BaseButton',
  props: {
    type: {
      type: String,
      default: 'button',
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    button_class: {
      type: String,
      default: 'btn-primary',
    },
  },
  emits: ['click'],
}
</script>
