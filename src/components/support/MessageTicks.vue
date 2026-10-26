<template>
  <!--
    Ticks de WhatsApp de un mensaje saliente (operador o agente):
      un check gris       = enviado
      dos checks grises   = entregado
      dos checks azules   = leído
      icono rojo          = fallido (el motivo va en el title)
    No dibuja nada si el mensaje no corresponde (ver `ticks_state`).
  -->
  <span
    v-if="state"
    class="message-ticks"
    :class="'message-ticks--' + state"
    :title="title">
    <i class="bi" :class="icon_class" aria-hidden="true"></i>
    <!-- Texto para lectores de pantalla: el color solo no alcanza. -->
    <span class="visually-hidden">{{ title }}</span>
  </span>
</template>

<script>
import { ticks_state, ticks_title, TICK_SENT, TICK_FAILED } from '@/utils/support_ticks'

export default {
  name: 'MessageTicks',
  props: {
    /**
     * Mensaje del hilo o `last_message` de un ticket de la bandeja.
     */
    message: {
      type: Object,
      default: null,
    },
    /**
     * Ticket al que pertenece el mensaje (alcanza con `{ source }`): los ticks son solo de WhatsApp.
     */
    ticket: {
      type: Object,
      default: null,
    },
  },
  computed: {
    /**
     * Estado de los ticks: 'sent' | 'delivered' | 'read' | 'failed' | null.
     *
     * @returns {string|null}
     */
    state() {
      return ticks_state(this.message, this.ticket)
    },
    /**
     * Tooltip: el estado en palabras, o el motivo del fallo.
     *
     * @returns {string}
     */
    title() {
      return ticks_title(this.state, this.message)
    },
    /**
     * Ícono de Bootstrap Icons: un check, el doble check o el círculo de exclamación.
     *
     * @returns {string}
     */
    icon_class() {
      if (this.state === TICK_SENT) {
        return 'bi-check'
      }
      if (this.state === TICK_FAILED) {
        return 'bi-exclamation-circle-fill'
      }
      return 'bi-check-all'
    },
  },
}
</script>

<style scoped>
.message-ticks {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  line-height: 1;
  font-size: 1.1rem;
  /* Gris WhatsApp para enviado y entregado. */
  color: #8696a0;
  vertical-align: middle;
}

/* Leído: azul WhatsApp. */
.message-ticks--read {
  color: #53bdeb;
}

/* Fallido: rojo, un poco más chico porque el círculo pesa más que un check. */
.message-ticks--failed {
  color: #dc3545;
  font-size: 0.9rem;
}
</style>
