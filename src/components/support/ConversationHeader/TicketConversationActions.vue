<template>
  <!--
    Abandonar la vista del ticket sin persistir (la bandeja lateral sigue igual).
  -->
  <div class="d-flex align-items-center flex-shrink-0 ticket-conversation-actions">
    <button
      type="button"
      class="btn btn-sm btn-outline-secondary flex-shrink-0"
      :disabled="!has_ticket"
      title="Dejar de ver este ticket. La bandeja sigue visible; elegí otro para abrir otra conversación."
      @click="$emit('exit-ticket')">
      Salir
    </button>
  </div>
</template>

<script>
/**
 * Botón para cerrar solo el panel de conversación en pantalla.
 */
export default {
  name: 'TicketConversationActions',
  props: {
    /**
     * Habilita el botón Salir.
     */
    has_ticket: {
      type: Boolean,
      default: false,
    },
  },
}
</script>
