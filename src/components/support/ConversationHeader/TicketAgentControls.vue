<template>
  <!--
    Interruptores del agente para este ticket: prendido/apagado, y si sus respuestas
    necesitan que una persona las apruebe antes de salir.
  -->
  <div v-if="has_ticket" class="d-flex align-items-center gap-2 flex-shrink-0">
    <button
      type="button"
      class="btn btn-sm ticket-agent-btn"
      :class="agent_button_class"
      :disabled="saving"
      :title="agent_title"
      @click="$emit('toggle-agent')">
      <i class="bi" :class="agent_on ? 'bi-robot' : 'bi-slash-circle'" aria-hidden="true" />
      {{ agent_on ? 'Agente' : 'Agente apagado' }}
    </button>

    <button
      type="button"
      class="btn btn-sm ticket-agent-btn"
      :class="verification_button_class"
      :disabled="saving || !agent_on"
      :title="verification_title"
      @click="$emit('toggle-verification')">
      <i class="bi" :class="verification_on ? 'bi-shield-check' : 'bi-shield-slash'" aria-hidden="true" />
      {{ verification_on ? 'Con verificación' : 'Contesta solo' }}
    </button>
  </div>
</template>

<script>
/**
 * Dos interruptores del agente de IA, por ticket.
 *
 * Son los mismos que ya tiene la conversación de leads en su header. El de verificación se
 * deshabilita con el agente apagado porque no hay nada que verificar.
 */
export default {
  name: 'TicketAgentControls',
  emits: ['toggle-agent', 'toggle-verification'],
  props: {
    /**
     * Hay un ticket abierto en el panel.
     */
    has_ticket: {
      type: Boolean,
      default: false,
    },
    /**
     * Valor de support_tickets.claude_auto_reply.
     */
    agent_on: {
      type: Boolean,
      default: true,
    },
    /**
     * Valor de support_tickets.requiere_verificacion_mensajes.
     */
    verification_on: {
      type: Boolean,
      default: true,
    },
    /**
     * true mientras corre alguno de los dos POST.
     */
    saving: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    /**
     * Clase del botón del agente.
     *
     * @returns {string}
     */
    agent_button_class() {
      return this.agent_on ? 'btn-outline-primary' : 'btn-outline-secondary'
    },
    /**
     * Clase del botón de verificación.
     *
     * @returns {string}
     */
    verification_button_class() {
      if (!this.agent_on) {
        return 'btn-outline-secondary'
      }
      return this.verification_on ? 'btn-outline-success' : 'btn-outline-warning'
    },
    /**
     * Tooltip del botón del agente.
     *
     * @returns {string}
     */
    agent_title() {
      if (this.agent_on) {
        return 'El agente está generando respuestas para este ticket. Tocá para apagarlo.'
      }
      return 'El agente está apagado en este ticket: no se generan respuestas nuevas. Tocá para prenderlo.'
    },
    /**
     * Tooltip del botón de verificación.
     *
     * @returns {string}
     */
    verification_title() {
      if (!this.agent_on) {
        return 'Con el agente apagado no hay nada que verificar.'
      }
      if (this.verification_on) {
        return 'Cada respuesta del agente queda esperando que la apruebes, con o sin ajustes. Tocá para que conteste solo.'
      }
      return 'El agente le contesta al cliente sin pasar por vos. Tocá para volver a exigir tu aprobación.'
    },
  },
}
</script>

<style scoped>
.ticket-agent-btn {
  font-size: 12px;
  white-space: nowrap;
}
.ticket-agent-btn i {
  margin-right: 4px;
}
</style>
