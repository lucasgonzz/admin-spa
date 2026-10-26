<template>
  <!--
    Interruptores del agente para este ticket: prendido/apagado, y si sus respuestas
    necesitan que una persona las apruebe antes de salir.

    Prendido = botón RELLENO de color (agente azul, verificación verde). Apagado = gris tenue.
    El estado no depende solo del color: el agente apagado cambia el ícono (robot tachado) y el
    texto ("Agente apagado"), y la verificación apagada cambia el ícono y el texto ("Contesta solo").
  -->
  <div v-if="has_ticket" class="d-flex align-items-center gap-2 flex-shrink-0">
    <button
      type="button"
      class="btn btn-sm ticket-agent-btn"
      :class="agent_button_class"
      :disabled="saving"
      :title="agent_title"
      @click="$emit('toggle-agent')">
      <!-- Robot; apagado lleva encima una línea diagonal (clase --struck). -->
      <span class="ticket-agent-icon" :class="{ 'ticket-agent-icon--struck': !agent_on }" aria-hidden="true">
        <i class="bi bi-robot" />
      </span>
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
     * Clase del botón del agente: relleno azul si está prendido, gris tenue si está apagado.
     *
     * @returns {string}
     */
    agent_button_class() {
      return this.agent_on ? 'btn-primary' : 'ticket-agent-btn--off'
    },
    /**
     * Clase del botón de verificación: relleno verde si exige verificación; gris tenue si contesta
     * solo, y también gris tenue (y deshabilitado) si el agente está apagado.
     *
     * @returns {string}
     */
    verification_button_class() {
      if (!this.agent_on) {
        return 'ticket-agent-btn--off'
      }
      return this.verification_on ? 'btn-success' : 'ticket-agent-btn--off'
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

/* Estado apagado: gris tenue (fondo gris claro, borde y texto grises). El texto oscuro sobre el
   gris claro mantiene el contraste de lectura; lo "tenue" lo da la falta de color, no la opacidad. */
.ticket-agent-btn--off {
  background-color: #e9ecef;
  border: 1px solid #ced4da;
  color: #5c636a;
}
.ticket-agent-btn--off:hover:not(:disabled),
.ticket-agent-btn--off:focus-visible {
  background-color: #dee2e6;
  border-color: #adb5bd;
  color: #495057;
}
.ticket-agent-btn--off:active:not(:disabled) {
  background-color: #ced4da;
  color: #343a40;
}

/* Contenedor del robot: el margen que antes llevaba el <i> pasa a ser de este wrapper para que
   la línea diagonal tache solo el ícono. */
.ticket-agent-icon {
  position: relative;
  display: inline-block;
  line-height: 1;
}
.ticket-agent-icon i {
  margin-right: 0;
}
.ticket-agent-btn .ticket-agent-icon {
  margin-right: 4px;
}

/* Robot tachado: no existe un ícono "robot tachado" en Bootstrap Icons, así que se dibuja una
   línea diagonal por encima. El halo del color del fondo la despega del dibujo. */
.ticket-agent-icon--struck::after {
  content: '';
  position: absolute;
  left: -2px;
  right: -2px;
  top: 50%;
  height: 2px;
  margin-top: -1px;
  background: currentColor;
  border-radius: 1px;
  transform: rotate(-45deg);
  box-shadow: 0 0 0 1px #e9ecef;
}
</style>
