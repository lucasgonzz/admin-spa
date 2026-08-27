<template>
  <!--
    Pedido de sugerencia IA para este ticket. Vive al lado de los interruptores del agente
    porque es un control del ticket, no del texto que se está escribiendo.
  -->
  <div v-if="has_ticket" class="d-flex align-items-center flex-shrink-0">
    <border-progress-wrap
      :active="timer_active"
      :duration_seconds="duration_seconds"
      :elapsed_seconds="elapsed_seconds"
      :animation_key="animation_key"
      variant="button">
      <button
        type="button"
        class="btn btn-sm btn-outline-primary ticket-agent-btn"
        :disabled="disabled"
        title="Pedirle a la IA una respuesta para este ticket"
        aria-label="Sugerencia IA"
        @click="$emit('request-suggestion')">
        <span
          v-if="loading"
          class="spinner-border spinner-border-sm"
          role="status"
          aria-hidden="true" />
        <i v-else class="bi bi-stars" aria-hidden="true" />
        Sugerencia IA
      </button>
    </border-progress-wrap>
  </div>
</template>

<script>
import BorderProgressWrap from '@/components/support/BorderProgressWrap.vue'

/**
 * Botón de sugerencia IA del header del ticket.
 *
 * El borde animado no es decoración: mientras el debounce previo a Claude corre, el operador
 * necesita ver cuánto falta para que la consulta salga sola. Por eso el componente no dispara
 * ningún POST -- se lo deja a Support.vue, que es donde ya vive el estado del timer que llega
 * por Pusher.
 */
export default {
  name: 'TicketAiSuggestionButton',
  components: {
    BorderProgressWrap,
  },
  emits: ['request-suggestion'],
  props: {
    /**
     * Hay un ticket abierto en el panel.
     */
    has_ticket: {
      type: Boolean,
      default: false,
    },
    /**
     * true mientras el POST de la sugerencia está en vuelo.
     */
    loading: {
      type: Boolean,
      default: false,
    },
    /**
     * true cuando no se puede pedir sugerencia (ticket cerrado, ya hay una en curso).
     */
    disabled: {
      type: Boolean,
      default: false,
    },
    /**
     * Timer activo del debounce antes de consultar a Claude.
     */
    consult_timer: {
      type: Object,
      default: null,
    },
  },
  computed: {
    /**
     * Indica si debe animarse el borde del botón IA (debounce previo a Claude).
     *
     * @returns {boolean}
     */
    timer_active() {
      return !!(this.consult_timer && this.consult_timer.active)
    },
    /**
     * Duración total del debounce en segundos.
     *
     * @returns {number}
     */
    duration_seconds() {
      if (!this.consult_timer) {
        return 0
      }
      return parseFloat(this.consult_timer.delay_seconds) || 0
    },
    /**
     * Segundos ya transcurridos del debounce (para reanudar animación).
     *
     * @returns {number}
     */
    elapsed_seconds() {
      if (!this.consult_timer) {
        return 0
      }
      return parseFloat(this.consult_timer.elapsed_seconds) || 0
    },
    /**
     * Key que reinicia la animación cuando el debounce se reprograma.
     *
     * @returns {string|number}
     */
    animation_key() {
      if (!this.consult_timer) {
        return '0'
      }
      return this.consult_timer.schedule_token != null
        ? this.consult_timer.schedule_token
        : '0'
    },
  },
}
</script>

<style scoped>
.ticket-agent-btn {
  font-size: 12px;
  white-space: nowrap;
}
.ticket-agent-btn i,
/* El spinner reemplaza al ícono mientras carga: sin la misma separación, el texto se le pega. */
.ticket-agent-btn .spinner-border {
  margin-right: 4px;
}
</style>
