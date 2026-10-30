<template>
  <!--
    Cabecera del panel: arriba, con quién se habla (nombre y teléfono del contacto); abajo,
    nombre del ticket, estado, Guardar (API) y Salir. El ticket no tiene operador asignado.
  -->
  <div class="support-conversation-header d-flex flex-column gap-2 flex-shrink-0 w-100">
    <div v-if="has_ticket" class="d-flex align-items-center gap-2 w-100 min-w-0">
      <ticket-contact-info
        class="flex-grow-1 min-w-0"
        :ticket="selected_ticket"
        :show_back="show_back"
        @back="$emit('back')" />
      <!-- En teléfono los controles del ticket ocupaban cuatro renglones y le comían media
           pantalla a la conversación: quedan detrás de este botón, como el menú de WhatsApp. -->
      <button
        v-if="show_back"
        type="button"
        class="btn btn-sm flex-shrink-0 support-conversation-header-toggle"
        :class="controles_abiertos ? 'btn-secondary' : 'btn-outline-secondary'"
        :title="controles_abiertos ? 'Ocultar opciones del ticket' : 'Opciones del ticket'"
        :aria-label="controles_abiertos ? 'Ocultar opciones del ticket' : 'Opciones del ticket'"
        :aria-expanded="controles_abiertos ? 'true' : 'false'"
        @click="controles_abiertos = !controles_abiertos">
        <i class="bi bi-sliders" aria-hidden="true"></i>
      </button>
    </div>
    <button
      v-else-if="show_back"
      type="button"
      class="btn btn-link p-0 align-self-start support-conversation-header-back"
      title="Volver a los tickets"
      aria-label="Volver a los tickets"
      @click="$emit('back')">
      <i class="bi bi-arrow-left" aria-hidden="true"></i>
    </button>
    <!-- d-none y no v-show: el display:none en línea de v-show pierde contra el d-flex !important. -->
    <div
      class="d-flex align-items-center flex-wrap gap-2 w-100"
      :class="{ 'd-none': show_back && !controles_abiertos }">
      <ticket-source-badge
        v-if="has_ticket"
        :ticket_source="selected_ticket.source || 'erp'" />
      <ticket-name-field
        :has_ticket="has_ticket"
        :ticket_name_draft="ticket_name_draft"
        :ticket_has_name="ticket_has_stored_name"
        @update:ticket_name_draft="on_update_draft" />
      <ticket-status-select
        :has_ticket="has_ticket"
        :ticket_status_draft="ticket_status_draft"
        @update:ticket_status_draft="on_update_status" />
      <ticket-agent-controls
        :has_ticket="has_ticket"
        :agent_on="agent_on"
        :verification_on="verification_on"
        :attention_on="attention_on"
        :attention_available="attention_available"
        :attention_reason="attention_reason"
        :saving="saving_agent_controls"
        @toggle-agent="$emit('toggle-agent')"
        @toggle-verification="$emit('toggle-verification')"
        @toggle-attention="$emit('toggle-attention')" />
      <ticket-ai-suggestion-button
        :has_ticket="has_ticket"
        :loading="ai_suggestion_loading"
        :disabled="ai_suggestion_disabled"
        :consult_timer="ai_consult_timer"
        @request-suggestion="$emit('request-suggestion')" />
      <div class="ms-auto d-flex align-items-center gap-2 flex-shrink-0 ticket-header-actions-end">
        <button
          type="button"
          class="btn btn-sm btn-primary flex-shrink-0"
          :disabled="!save_button_enabled"
          @click="$emit('save-header')">
          <span v-if="saving_header" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
          <span v-else>Guardar</span>
        </button>
        <ticket-conversation-actions :has_ticket="has_ticket" @exit-ticket="$emit('exit-ticket')" />
      </div>
    </div>
  </div>
</template>

<script>
import TicketNameField from './TicketNameField.vue'
import TicketSourceBadge from './TicketSourceBadge.vue'
import TicketStatusSelect from './TicketStatusSelect.vue'
import TicketConversationActions from './TicketConversationActions.vue'
import TicketAgentControls from './TicketAgentControls.vue'
import TicketAiSuggestionButton from './TicketAiSuggestionButton.vue'
import TicketContactInfo from './TicketContactInfo.vue'

/**
 * Agrupa controles del hilo y un único guardado HTTP para nombre y estado.
 */
export default {
  name: 'ConversationHeader',
  components: {
    TicketNameField,
    TicketSourceBadge,
    TicketStatusSelect,
    TicketConversationActions,
    TicketAgentControls,
    TicketAiSuggestionButton,
    TicketContactInfo,
  },
  /**
   * Vue 3: v-model:prop requiere emitir update:prop; se declara para evitar fallos de two-way.
   */
  emits: [
    'update:ticket_name_draft',
    'update:ticket_status_draft',
    'save-header',
    'exit-ticket',
    'toggle-agent',
    'toggle-verification',
    'toggle-attention',
    'request-suggestion',
    'back',
  ],
  props: {
    /**
     * Ticket actual o null.
     */
    selected_ticket: {
      type: Object,
      default: null,
    },
    /**
     * Borrador del nombre en el input.
     */
    ticket_name_draft: {
      type: String,
      default: '',
    },
    /**
     * Estado local open | closed antes del PUT.
     */
    ticket_status_draft: {
      type: String,
      default: 'open',
    },
    /**
     * true mientras corre update_ticket del header.
     */
    saving_header: {
      type: Boolean,
      default: false,
    },
    /**
     * true mientras corre alguno de los dos toggles del agente.
     */
    saving_agent_controls: {
      type: Boolean,
      default: false,
    },
    /**
     * true mientras el POST de la sugerencia IA está en vuelo.
     */
    ai_suggestion_loading: {
      type: Boolean,
      default: false,
    },
    /**
     * true cuando el botón de sugerencia IA no se puede apretar.
     */
    ai_suggestion_disabled: {
      type: Boolean,
      default: false,
    },
    /**
     * Timer del debounce previo a Claude, para animar el borde del botón de sugerencia.
     */
    ai_consult_timer: {
      type: Object,
      default: null,
    },
    /**
     * Muestra la flecha de volver a la lista (vista de teléfono, conversación a pantalla completa).
     */
    show_back: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      /**
       * En teléfono (`show_back`): si están desplegados los controles del ticket.
       * En escritorio no se usa: los controles se ven siempre.
       */
      controles_abiertos: false,
    }
  },
  watch: {
    /**
     * Al cambiar de ticket los controles vuelven a plegarse.
     */
    'selected_ticket.id'() {
      this.controles_abiertos = false
    },
  },
  computed: {
    attention_available() {
      return !!(this.selected_ticket && this.selected_ticket.support_attention && this.selected_ticket.support_attention.can_toggle === true)
    },
    attention_on() {
      return !!(this.selected_ticket && this.selected_ticket.support_attention && this.selected_ticket.support_attention.needs_human === true)
    },
    attention_reason() {
      return this.selected_ticket && this.selected_ticket.support_attention ? (this.selected_ticket.support_attention.reason || '') : ''
    },
    /**
     * Atajo para condicionar hijos.
     *
     * @returns {boolean}
     */
    has_ticket() {
      return !!this.selected_ticket
    },
    /**
     * Agente prendido para este ticket. Sin ticket, se asume prendido (no se muestra igual).
     *
     * @returns {boolean}
     */
    agent_on() {
      if (!this.selected_ticket) {
        return true
      }
      return this.selected_ticket.claude_auto_reply !== false && this.selected_ticket.claude_auto_reply !== 0
    },
    /**
     * Verificación humana exigida para este ticket.
     *
     * @returns {boolean}
     */
    verification_on() {
      if (!this.selected_ticket) {
        return false
      }
      const value = this.selected_ticket.requiere_verificacion_mensajes
      return value === true || value === 1
    },
    /**
     * true si el ticket en servidor ya tiene nombre (no vacío).
     *
     * @returns {boolean}
     */
    ticket_has_stored_name() {
      const t = this.selected_ticket
      if (!t) {
        return true
      }
      const stored = t.name == null || t.name === undefined ? '' : String(t.name)
      return String(stored).trim() !== ''
    },
    /**
     * Diferencia en nombre respecto al modelo.
     *
     * @returns {boolean}
     */
    name_is_changed() {
      const t = this.selected_ticket
      if (!t) {
        return false
      }
      const stored = t.name == null || t.name === undefined ? '' : String(t.name)
      return String(this.ticket_name_draft).trim() !== String(stored).trim()
    },
    /**
     * Diferencia de estado open/closed.
     *
     * @returns {boolean}
     */
    status_is_changed() {
      if (!this.selected_ticket) {
        return false
      }
      const stored = this.selected_ticket.status === 'closed' ? 'closed' : 'open'
      const draft = this.ticket_status_draft === 'closed' ? 'closed' : 'open'
      return stored !== draft
    },
    /**
     * Habilita Guardar: reactivo a borradores locales (evita depender de un prop del padre).
     *
     * @returns {boolean}
     */
    save_button_enabled() {
      if (!this.selected_ticket || this.saving_header) {
        return false
      }
      return this.name_is_changed || this.status_is_changed
    },
  },
  methods: {
    /**
     * Sincroniza borrador de nombre hacia el padre.
     *
     * @param {string} value Texto del input
     * @returns {void}
     */
    on_update_draft(value) {
      this.$emit('update:ticket_name_draft', value)
    },
    /**
     * Sincroniza estado del ticket (v-model:ticket_status_draft hacia abajo).
     *
     * @param {string} status open o closed
     * @returns {void}
     */
    on_update_status(status) {
      this.$emit('update:ticket_status_draft', status)
    },
  },
}
</script>

<style scoped>
.support-conversation-header-back {
  font-size: 1.35rem;
  line-height: 1;
  color: var(--bs-body-color);
  text-decoration: none;
}

.support-conversation-header-toggle {
  line-height: 1;
}
</style>
