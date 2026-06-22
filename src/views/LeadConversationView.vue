<template>
  <div class="conversation-view">

    <!-- ====================================================
         HEADER FIJO: atrás | nombre del lead | 5 botones icono
         ==================================================== -->
    <div class="conversation-header d-flex align-items-center justify-content-between px-3 py-2 border-bottom bg-white">

      <!-- Izquierda: botón atrás + nombre del lead -->
      <div class="d-flex align-items-center gap-2 overflow-hidden">
        <button
          type="button"
          class="icon-btn"
          title="Volver a Leads"
          aria-label="Volver a Leads"
          @click="$router.push({ name: 'leads' })"
        >
          <i class="bi bi-arrow-left" aria-hidden="true" />
        </button>
        <span class="fw-semibold text-truncate conversation-lead-name">
          {{ lead_name }}
        </span>
      </div>

      <!-- Derecha: 5 botones de acción (solo ícono) -->
      <div class="d-flex align-items-center gap-1 flex-shrink-0">

        <!-- Resumen del lead -->
        <button
          type="button"
          class="icon-btn text-muted"
          title="Ver resumen del lead"
          aria-label="Ver resumen del lead"
          :disabled="!effective_record"
          @click="show_resumen_modal = true"
        >
          <i class="bi bi-person-lines-fill" aria-hidden="true" />
        </button>

        <!-- Notificar mensajes: campana l͏͏͏͏ si activo, vacía si no -->
        <button
          type="button"
          class="icon-btn"
          :class="notify_active ? 'text-primary' : 'text-muted'"
          :title="notify_active
            ? 'Recibirás un WhatsApp cuando llegue un mensaje de este lead. Clic para desactivar.'
            : 'Activar notificaciones WhatsApp para mensajes de este lead.'"
          :aria-label="notify_active
            ? 'Desactivar notificaciones WhatsApp para este lead'
            : 'Activar notificaciones WhatsApp para este lead'"
          :disabled="toggling_notify || !effective_record"
          @click="on_toggle_notify_messages(!notify_active)"
        >
          <span
            v-if="toggling_notify"
            class="spinner-border spinner-border-sm"
            role="status"
            aria-hidden="true"
          />
          <i v-else class="bi" :class="notify_active ? 'bi-bell-fill' : 'bi-bell'" aria-hidden="true" />
        </button>

        <!-- Exportar conversación: feedback verde 2s tras copiar -->
        <button
          type="button"
          class="icon-btn"
          :class="export_conversation_feedback ? 'text-success' : 'text-muted'"
          :title="sorted_messages.length ? 'Copiar conversación al portapapeles' : 'No hay mensajes para exportar'"
          :aria-label="export_conversation_feedback
            ? 'Conversación copiada al portapapeles'
            : 'Copiar conversación al portapapeles'"
          :disabled="export_conversation_loading || !sorted_messages.length"
          @click="on_export_conversation"
        >
          <span
            v-if="export_conversation_loading"
            class="spinner-border spinner-border-sm"
            role="status"
            aria-hidden="true"
          />
          <i v-else class="bi" :class="export_conversation_feedback ? 'bi-check-lg' : 'bi-clipboard'" aria-hidden="true" />
        </button>

        <!-- Pedir sugerencia IA a Claude manualmente -->
        <button
          type="button"
          class="icon-btn"
          :class="can_request_ai_suggestion ? 'text-primary' : 'text-muted'"
          :title="request_ai_suggestion_button_title"
          aria-label="Pedir sugerencia de respuesta a Claude"
          :disabled="!can_request_ai_suggestion"
          @click="on_request_ai_suggestion"
        >
          <span
            v-if="ai_suggestion_request_loading"
            class="spinner-border spinner-border-sm"
            role="status"
            aria-hidden="true"
          />
          <i v-else class="bi bi-lightning-charge" aria-hidden="true" />
        </button>

        <!-- Toggle respuesta automática de Claude por lead -->
        <button
          type="button"
          class="icon-btn"
          :class="claude_auto_reply_enabled ? 'text-success' : 'text-muted'"
          :title="claude_auto_reply_enabled
            ? 'Claude responde automáticamente. Clic para desactivar.'
            : 'Claude desactivado. Clic para reactivar.'"
          :aria-label="claude_auto_reply_enabled
            ? 'Desactivar respuesta automática de Claude'
            : 'Activar respuesta automática de Claude'"
          :disabled="toggling_claude_auto_reply"
          @click="on_toggle_claude_auto_reply"
        >
          <span
            v-if="toggling_claude_auto_reply"
            class="spinner-border spinner-border-sm"
            role="status"
            aria-hidden="true"
          />
          <i v-else class="bi bi-stars" aria-hidden="true" />
        </button>

      </div>
    </div>

    <!-- ====================================================
         ÁREA DE MENSAJES: scroll vertical, alertas sticky al tope
         ==================================================== -->
    <div ref="conversation_scroll_box" class="conversation-messages whatsapp-conversation-wallpaper px-3 py-2">

      <!-- Alertas contextuales pegadas al tope del scroll -->
      <div class="conversation-alerts sticky-top-alerts">

        <!-- Alerta cuando Claude está desactivado para este lead -->
        <div v-if="!claude_auto_reply_enabled" class="alert alert-warning py-2 small mb-2">
          <i class="bi bi-person-check me-1" aria-hidden="true" />
          Respondés vos a este lead. Claude <strong>no</strong> generará sugerencias ni enviará respuestas automáticas.
        </div>

        <!-- Seguimiento automático pendiente de revisión -->
        <div v-if="has_pending_followup_suggestion" class="alert alert-info py-2 small mb-2">
          <i class="bi bi-clock-history me-1" aria-hidden="true" />
          Hay una <strong>sugerencia de seguimiento automático</strong> por inactividad del lead. Revisá el mensaje marcado en la conversación.
        </div>

        <!-- Error de IA -->
        <div v-if="ai_error" class="alert alert-danger py-2 small mb-2">{{ ai_error }}</div>

        <!-- Claude está consultando (spinner) -->
        <div
          v-if="ai_suggestion_request_loading"
          class="alert alert-secondary py-2 small mb-2 d-flex align-items-center gap-2"
        >
          <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
          Consultando a Claude…
        </div>

        <!-- Countdown antes de consultar a Claude (mutuamente excluyente con el spinner) -->
        <div
          v-else-if="show_ai_consult_countdown"
          class="alert alert-secondary py-2 small mb-2 d-flex align-items-center justify-content-between gap-2"
        >
          <span>
            <i class="bi bi-stars me-1" aria-hidden="true" />
            Claude consulta en <strong>{{ ai_consult_remaining_seconds }}</strong> s
          </span>
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm d-inline-flex align-items-center justify-content-center"
            :disabled="cancelling_auto_consult"
            title="Cancelar la petición automática a Claude"
            aria-label="Cancelar la petición automática a Claude"
            @click="on_cancel_auto_ai_consult"
          >
            <span
              v-if="cancelling_auto_consult"
              class="spinner-border spinner-border-sm"
              role="status"
              aria-hidden="true"
            />
            <i v-else class="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>

      </div>

      <!-- Spinner de carga inicial de la conversación -->
      <div
        v-if="loading_conversation"
        class="text-muted small p-2 d-flex align-items-center gap-2"
      >
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
        Cargando conversación…
      </div>

      <!-- Sin mensajes en el hilo -->
      <div v-else-if="!sorted_messages.length" class="text-muted small p-2">Sin mensajes todavía.</div>

      <!-- Burbujas y divisores de fecha (sticky por sección, estilo WhatsApp) -->
      <div v-else class="conversation-messages-flow">
        <div
          v-for="section in message_date_sections"
          :key="section.key"
          class="wa-date-section"
        >
          <div v-if="section.date_label" class="wa-date-divider">
            <span class="wa-date-divider-label">{{ section.date_label }}</span>
          </div>
          <message-bubble
            v-for="msg in section.messages"
            :key="msg.id"
            :message="msg"
            :busy="busy_message_id === msg.id"
            :now_tick="now_tick"
            :auto_send_delay_seconds="ai_suggestion_auto_send_delay_seconds"
            @enviar="on_enviar_sugerencia(msg.id)"
            @guardar_y_enviar="on_guardar_y_enviar_sugerencia(msg.id, $event)"
            @cancelar_envio_automatico="on_cancelar_envio_automatico(msg.id)"
            @toggle_deleted_from_context="on_toggle_deleted_from_context(msg.id)"
          />
        </div>
      </div>

    </div>

    <!-- ====================================================
         FOOTER FIJO: textarea auto-expandible + botón mic/enviar
         (+ herramientas DEV solo en import.meta.env.DEV)
         ==================================================== -->
    <div class="conversation-footer border-top px-3 py-2">

      <!-- Área de redacción tipo WhatsApp -->
      <div class="d-flex align-items-end gap-2">
        <textarea
          v-model="mensaje_directo"
          class="message-input"
          rows="1"
          placeholder="Mensaje."
          :disabled="enviando_directo"
          @input="on_input_resize"
        />

        <!-- Botón mic cuando no hay texto: grabación de audio -->
        <button
          v-if="!has_mensaje_directo"
          type="button"
          class="icon-btn flex-shrink-0"
          :class="recording_audio ? 'text-danger audio-recording-pulse' : 'text-muted'"
          :disabled="enviando_audio"
          :title="recording_audio ? 'Grabando. Tocá para detener y enviar' : 'Mantené pulsado o tocá para grabar audio'"
          @click="on_mic_click"
          @mousedown="on_mic_mousedown"
          @mouseup="on_mic_mouseup_or_leave"
          @mouseleave="on_mic_mouseup_or_leave"
          @touchstart.prevent="on_mic_touchstart"
          @touchend.prevent="on_mic_touchend"
        >
          <span v-if="enviando_audio" class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
          <i v-else class="bi" :class="recording_audio ? 'bi-stop-circle-fill' : 'bi-mic'" aria-hidden="true" />
        </button>

        <!-- Botón enviar cuando hay texto -->
        <button
          v-else
          type="button"
          class="icon-btn flex-shrink-0 text-primary"
          :disabled="enviando_directo"
          title="Enviar mensaje"
          aria-label="Enviar mensaje"
          @click="on_enviar_directo"
        >
          <span
            v-if="enviando_directo"
            class="spinner-border spinner-border-sm"
            role="status"
            aria-hidden="true"
          />
          <i v-else class="bi bi-send" aria-hidden="true" />
        </button>
      </div>

      <!-- Herramientas de desarrollo (solo en entorno DEV, no se muestran en producción) -->
      <div v-if="is_dev" class="dev-tools border-top mt-2 pt-2">

        <!-- Simular mensaje entrante del lead (testing sin pasar por WhatsApp) -->
        <div class="d-flex gap-2 mb-2">
          <input
            v-model="mensaje_simulado"
            type="text"
            class="form-control form-control-sm"
            placeholder="Simular mensaje del lead."
            :disabled="enviando_simulado"
            @keydown.enter.prevent="on_simular_inbound"
          />
          <button
            type="button"
            class="btn btn-outline-warning btn-sm d-inline-flex align-items-center justify-content-center"
            :disabled="enviando_simulado || !has_mensaje_simulado"
            title="Simular mensaje entrante del lead (testing)"
            aria-label="Simular mensaje entrante del lead"
            @click="on_simular_inbound"
          >
            <span v-if="enviando_simulado" class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
            <i v-else class="bi bi-chat-left-dots" aria-hidden="true" />
          </button>
        </div>

        <!-- Forzar seguimiento manual (testing) -->
        <div class="d-flex gap-2 align-items-center">
          <button
            type="button"
            class="btn btn-outline-info btn-sm d-inline-flex align-items-center justify-content-center"
            :disabled="forzando_seguimiento"
            title="Dispara el seguimiento correspondiente ahora mismo, sin esperar el tiempo configurado"
            aria-label="Forzar seguimiento automático ahora"
            @click="on_forzar_seguimiento"
          >
            <span v-if="forzando_seguimiento" class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
            <i v-else class="bi bi-clock-history" aria-hidden="true" />
          </button>
          <span v-if="forzar_seguimiento_resultado" class="small text-muted">{{ forzar_seguimiento_resultado }}</span>
        </div>

      </div>
    </div>

    <!-- ====================================================
         MODAL: Resumen del lead
         ==================================================== -->
    <div
      v-if="show_resumen_modal"
      class="resumen-modal-overlay"
      @click.self="show_resumen_modal = false"
    >
      <div class="resumen-modal-panel">

        <!-- Header del modal -->
        <div class="d-flex align-items-center justify-content-between px-4 py-3 border-bottom">
          <span class="fw-semibold">
            <i class="bi bi-person-lines-fill me-2 text-primary" aria-hidden="true" />
            Resumen del lead
          </span>
          <button
            type="button"
            class="icon-btn text-muted"
            title="Cerrar"
            aria-label="Cerrar resumen del lead"
            @click="show_resumen_modal = false"
          >
            <i class="bi bi-x-lg" aria-hidden="true" />
          </button>
        </div>

        <!-- Cuerpo: reutiliza LeadResumenTab -->
        <div class="resumen-modal-body">
          <lead-resumen-tab
            :record="effective_record"
            @record-updated="on_record_updated"
          />
        </div>

      </div>
    </div>

  </div>
</template>

<script>
import MessageBubble from '@/components/lead/conversation/MessageBubble.vue'
import LeadResumenTab from '@/components/lead/resumen/Index.vue'
import api from '@/utils/axios'
import { copy_lead_conversation_to_clipboard } from '@/utils/lead_conversation_clipboard'
import lead_conversation_date_dividers from '@/mixins/lead_conversation_date_dividers'
import '@/styles/whatsapp-conversation-wallpaper.css'
import '@/styles/whatsapp-date-divider.css'

/**
 * Vista de pantalla completa para la conversación WhatsApp de un lead.
 *
 * Accesible desde /leads/:lead_id/conversacion. Replica toda la lógica de
 * LeadConversationTab (modal) pero como vista independiente con layout WhatsApp:
 * header fijo, área de mensajes scrolleable y footer fijo con textarea auto-expandible.
 *
 * El lead se carga al montar la vista usando el param :lead_id de la ruta.
 * No depende de ResourceView ni de ningún componente de common-vue.
 */
export default {
  name: 'LeadConversationView',
  components: { MessageBubble, LeadResumenTab },
  mixins: [lead_conversation_date_dividers],

  data() {
    return {
      /**
       * Registro completo del lead cargado desde la API al montar la vista.
       * Equivale al prop `record` del componente de modal, pero aquí es estado local.
       */
      lead_record: null,

      /** true mientras la vista espera el primer GET del lead con mensajes. */
      loading_conversation: false,

      /** Texto del mensaje directo a enviar al lead por WhatsApp. */
      mensaje_directo: '',

      /** true mientras se envía el mensaje directo (evita doble envío). */
      enviando_directo: false,

      /** Texto del mensaje simulado del lead (testing, no pasa por WhatsApp). */
      mensaje_simulado: '',

      /** true mientras se simula el mensaje entrante (evita doble envío). */
      enviando_simulado: false,

      /** true mientras se fuerza el seguimiento manual (testing). */
      forzando_seguimiento: false,

      /** Texto descriptivo del último resultado de forzar seguimiento (testing). */
      forzar_seguimiento_resultado: '',

      /** Evita doble click mientras se persiste el toggle de notificaciones push. */
      toggling_notify: false,

      /** Id del mensaje en acción de aprobar/rechazar (deshabilita botones duplicados). */
      busy_message_id: null,

      /** Evita POST duplicados al marcar seguimiento como visto. */
      marking_followup_seen: false,

      /** Evita GET duplicados por Pusher (rate limit 429). */
      last_conversation_fetch_ms: 0,

      /** Id del lead del último fetch exitoso de conversación. */
      last_conversation_fetch_lead_id: null,

      /** Segundos de debounce antes de pedir sugerencia IA (cargado desde settings). */
      ai_suggestion_delay_seconds: 60,

      /** Segundos antes del envío automático de la sugerencia generada. */
      ai_suggestion_auto_send_delay_seconds: 120,

      /** Timestamp del último mensaje entrante del lead (ms) para evaluar debounce. */
      last_lead_inbound_at_ms: 0,

      /** Id del último mensaje entrante del lead (detecta inbound nuevo aunque no cambie created_at). */
      last_lead_inbound_message_id: 0,

      /** true si el setter canceló la sugerencia automática en el turno actual. */
      ai_auto_consult_cancelled: false,

      /** Evita doble POST al cancelar el debounce automático. */
      cancelling_auto_consult: false,

      /** Evita doble POST al activar/desactivar Claude por lead. */
      toggling_claude_auto_reply: false,

      /** Intervalo que actualiza now_tick para los countdown visibles. */
      now_tick_interval_id: null,

      /** Timestamp actual (ms) para countdown de debounce y auto-envío. */
      now_tick: Date.now(),

      /** true mientras se copia la conversación al portapapeles. */
      export_conversation_loading: false,

      /** Feedback visual breve (2s) tras exportar con éxito. */
      export_conversation_feedback: false,

      /** Timer para resetear el feedback del botón de exportación. */
      export_conversation_feedback_timer: null,

      /**
       * true si estamos corriendo en entorno de desarrollo (Vite DEV).
       * Controla la visibilidad de las herramientas de testing en el footer.
       */
      is_dev: import.meta.env.DEV,

      /** true mientras el micrófono está grabando. */
      recording_audio: false,

      /** Instancia MediaRecorder activa (null cuando no graba). */
      audio_recorder: null,

      /** Stream de micrófono activo (null cuando no graba). */
      audio_stream: null,

      /** true mientras se envía el audio al backend. */
      enviando_audio: false,

      /** true cuando el usuario mantiene pulsado el botón (hold mode). */
      audio_hold_mode: false,

      /** Controla la visibilidad del modal de resumen del lead. */
      show_resumen_modal: false,
    }
  },

  computed: {
    /**
     * Nombre visible del lead en el header. Usa contact_name si está disponible,
     * o cae a 'Lead #ID' como fallback mientras carga o si está vacío.
     *
     * @returns {string}
     */
    lead_name() {
      const rec = this.lead_record
      if (!rec) {
        return 'Cargando…'
      }
      return (rec.contact_name || '').trim() || 'Lead #' + rec.id
    },

    /**
     * Registro efectivo: fusiona lead_record local con los mensajes del store
     * (que pueden haber llegado vía Pusher sin un GET explícito).
     *
     * @returns {Object|null}
     */
    effective_record() {
      if (!this.lead_record || !this.lead_record.id) {
        return null
      }
      const conv = this.$store.state.lead.lead_en_conversacion
      if (conv && conv.id == this.lead_record.id) {
        /* Fusión local + store; el contador de no leídos toma el máximo salvo que la vista esté activa. */
        const merged = Object.assign({}, this.lead_record, conv)
        const visible_id = this.$store.state.lead.lead_conversation_visible_id
        const viewing_this_lead =
          visible_id != null
          && String(visible_id) === String(this.lead_record.id)
        if (viewing_this_lead) {
          merged.unread_count = 0
          merged.unread_messages_count = 0
          return merged
        }
        const unread = this.resolve_effective_unread_count(this.lead_record, conv)
        merged.unread_count = unread
        merged.unread_messages_count = unread
        return merged
      }
      return this.lead_record
    },

    /**
     * true si el admin autenticado está suscrito a notificaciones WhatsApp de este lead.
     * Lee is_notified_by_me que el backend incluye en la respuesta del lead.
     *
     * @returns {boolean}
     */
    notify_active() {
      return Boolean(this.effective_record && this.effective_record.is_notified_by_me)
    },

    /**
     * true si Claude puede actuar automáticamente en este lead (default true si campo ausente).
     *
     * @returns {boolean}
     */
    claude_auto_reply_enabled() {
      const rec = this.effective_record
      if (!rec) {
        return true
      }
      if (rec.claude_auto_reply === undefined || rec.claude_auto_reply === null) {
        return true
      }
      return Boolean(rec.claude_auto_reply)
    },

    /**
     * Mensajes ordenados cronológicamente por id, sin reacciones legacy.
     *
     * @returns {Array<Object>}
     */
    sorted_messages() {
      const rec = this.effective_record
      const list = rec && rec.messages ? rec.messages : []
      if (!list.length) {
        return []
      }
      const copy = list.slice()
      copy.sort(function (a, b) {
        return (a.id || 0) - (b.id || 0)
      })
      const self = this
      return copy.filter(function (msg) {
        return !self.is_legacy_whatsapp_reaction_message(msg)
      })
    },

    /**
     * true mientras Claude genera sugerencia para este lead.
     *
     * @returns {boolean}
     */
    ai_suggestion_request_loading() {
      const rec = this.effective_record
      if (!rec || !rec.id) {
        return false
      }
      const generating_id = this.$store.state.lead.ai_generating_lead_id
      if (generating_id == null) {
        return false
      }
      return String(generating_id) === String(rec.id)
    },

    /**
     * Mensaje de error de IA desde el store global.
     *
     * @returns {string|null}
     */
    ai_error() {
      return this.$store.state.lead.ai_error
    },

    /**
     * true si hay texto en el input de mensaje directo.
     *
     * @returns {boolean}
     */
    has_mensaje_directo() {
      return (this.mensaje_directo || '').trim() !== ''
    },

    /**
     * true si hay texto en el input de simulación.
     *
     * @returns {boolean}
     */
    has_mensaje_simulado() {
      return (this.mensaje_simulado || '').trim() !== ''
    },

    /**
     * true si hay al menos una sugerencia de seguimiento automático pendiente.
     *
     * @returns {boolean}
     */
    has_pending_followup_suggestion() {
      const list = this.sorted_messages
      let i = 0
      for (i = 0; i < list.length; i++) {
        const m = list[i]
        if (m.status === 'sugerido' && Boolean(m.is_followup) && !((m.edited_content || '') + '').trim()) {
          return true
        }
      }
      return false
    },

    /**
     * Firma estable de la lista de mensajes para detectar altas o cambios de estado.
     *
     * @returns {string}
     */
    conversation_messages_signature() {
      const list = this.sorted_messages
      if (!list.length) {
        return ''
      }
      const parts = []
      let i = 0
      for (i = 0; i < list.length; i++) {
        const m = list[i]
        const att_count = m.attachments && m.attachments.length ? String(m.attachments.length) : '0'
        parts.push(String(m.id) + ':' + String(m.status || '') + ':' + String(m.kind || '') + ':' + att_count)
      }
      return parts.join('|')
    },

    /**
     * Id del último mensaje saliente aprobado del setter/sistema.
     *
     * @returns {string}
     */
    outbound_messages_signature() {
      const list = this.sorted_messages
      let last_outbound_id = ''
      let i = 0
      for (i = 0; i < list.length; i++) {
        const m = list[i]
        const sender = ((m.sender || '') + '').toLowerCase()
        const status = ((m.status || '') + '').toLowerCase()
        if (sender === 'setter' && (status === 'enviado' || status === 'aprobado')) {
          last_outbound_id = String(m.id)
        }
        if (sender === 'sistema' && status === 'aprobado') {
          last_outbound_id = String(m.id)
        }
      }
      return last_outbound_id
    },

    /**
     * Cantidad de mensajes entrantes del lead en el hilo.
     *
     * @returns {number}
     */
    lead_inbound_message_count() {
      const list = this.sorted_messages
      let count = 0
      let i = 0
      for (i = 0; i < list.length; i++) {
        const m = list[i]
        const sender = ((m.sender || '') + '').toLowerCase()
        const status = ((m.status || '') + '').toLowerCase()
        if (sender === 'lead' && status === 'enviado') {
          count = count + 1
        }
      }
      return count
    },

    /**
     * true si hay mensajes del lead sin respuesta tras el último envío saliente.
     *
     * @returns {boolean}
     */
    has_unanswered_lead_messages() {
      const list = this.sorted_messages
      let last_outbound_index = -1
      let i = 0
      for (i = 0; i < list.length; i++) {
        const m = list[i]
        const sender = ((m.sender || '') + '').toLowerCase()
        const status = ((m.status || '') + '').toLowerCase()
        if (sender === 'setter' && (status === 'enviado' || status === 'aprobado')) {
          last_outbound_index = i
        }
        if (sender === 'sistema' && status === 'aprobado') {
          last_outbound_index = i
        }
      }
      let j = last_outbound_index + 1
      for (j = last_outbound_index + 1; j < list.length; j++) {
        const m = list[j]
        const sender = ((m.sender || '') + '').toLowerCase()
        const status = ((m.status || '') + '').toLowerCase()
        if (sender === 'lead' && status === 'enviado') {
          return true
        }
      }
      return false
    },

    /**
     * true si existe una sugerencia de Claude pendiente (no seguimiento automático).
     *
     * @returns {boolean}
     */
    has_pending_non_followup_suggestion() {
      const list = this.sorted_messages
      let i = 0
      for (i = 0; i < list.length; i++) {
        const m = list[i]
        if (m.sender === 'sistema' && m.status === 'sugerido' && !m.is_followup) {
          return true
        }
      }
      return false
    },

    /**
     * true si se puede pedir sugerencia a Claude manualmente.
     *
     * @returns {boolean}
     */
    can_request_ai_suggestion() {
      if (!this.effective_record || !this.effective_record.id) {
        return false
      }
      if (this.ai_suggestion_request_loading) {
        return false
      }
      if (this.lead_inbound_message_count <= 1) {
        return false
      }
      if (!this.has_unanswered_lead_messages) {
        return false
      }
      if (this.has_pending_non_followup_suggestion) {
        return false
      }
      return true
    },

    /**
     * Tooltip del botón "Pedir IA" según el estado actual.
     *
     * @returns {string}
     */
    request_ai_suggestion_button_title() {
      if (this.ai_suggestion_request_loading) {
        return 'Consultando a Claude…'
      }
      if (this.lead_inbound_message_count <= 1) {
        return 'La sugerencia IA aplica desde el segundo mensaje del lead.'
      }
      if (!this.has_unanswered_lead_messages) {
        return 'No hay mensajes del lead sin responder.'
      }
      if (this.has_pending_non_followup_suggestion) {
        return 'Ya hay una sugerencia pendiente de revisión.'
      }
      return 'Pedir sugerencia a Claude ahora y continuar con el envío automático si corresponde.'
    },

    /**
     * true cuando ya transcurrió la demora configurada desde el último mensaje del lead.
     *
     * @returns {boolean}
     */
    ai_suggestion_debounce_elapsed() {
      const delay_seconds = parseInt(this.ai_suggestion_delay_seconds, 10)
      if (isNaN(delay_seconds) || delay_seconds <= 0) {
        return true
      }
      if (!this.last_lead_inbound_at_ms) {
        return this.last_lead_inbound_message_id > 0
      }
      return this.now_tick - this.last_lead_inbound_at_ms >= delay_seconds * 1000
    },

    /**
     * true mientras corre el debounce antes de pedir sugerencia automática.
     * La vista siempre está activa (sin guard de parent_active_tab).
     *
     * @returns {boolean}
     */
    show_ai_consult_countdown() {
      if (!this.claude_auto_reply_enabled) {
        return false
      }
      if (this.lead_inbound_message_count <= 1) {
        return false
      }
      if (!this.has_unanswered_lead_messages) {
        return false
      }
      if (this.has_pending_non_followup_suggestion) {
        return false
      }
      if (this.ai_auto_consult_cancelled) {
        return false
      }
      if (this.ai_suggestion_request_loading) {
        return false
      }
      const delay_seconds = parseInt(this.ai_suggestion_delay_seconds, 10)
      if (isNaN(delay_seconds) || delay_seconds <= 0) {
        return false
      }
      return !this.ai_suggestion_debounce_elapsed
    },

    /**
     * Segundos restantes hasta la petición automática a Claude.
     *
     * @returns {number}
     */
    ai_consult_remaining_seconds() {
      if (!this.show_ai_consult_countdown || !this.last_lead_inbound_at_ms) {
        return 0
      }
      const delay_seconds = parseInt(this.ai_suggestion_delay_seconds, 10)
      if (isNaN(delay_seconds) || delay_seconds <= 0) {
        return 0
      }
      const consult_at_ms = this.last_lead_inbound_at_ms + delay_seconds * 1000
      const remaining_ms = consult_at_ms - this.now_tick
      if (remaining_ms <= 0) {
        return 0
      }
      return Math.ceil(remaining_ms / 1000)
    },

    /**
     * true si alguna sugerencia pendiente tiene timer de auto-envío activo.
     *
     * @returns {boolean}
     */
    has_active_auto_send_countdown() {
      const delay_seconds = parseInt(this.ai_suggestion_auto_send_delay_seconds, 10)
      const list = this.sorted_messages
      let i = 0
      for (i = 0; i < list.length; i++) {
        const m = list[i]
        if (m.sender !== 'sistema' || m.status !== 'sugerido' || m.is_followup || m.requiere_verificacion) {
          continue
        }
        if (m.ai_auto_send_at) {
          const ends_at = new Date(m.ai_auto_send_at).getTime()
          if (!isNaN(ends_at)) {
            return true
          }
        }
        if (!isNaN(delay_seconds) && delay_seconds > 0 && m.created_at) {
          return true
        }
      }
      return false
    },
  },

  watch: {
    /**
     * Al terminar la generación de Claude, bajar el scroll para ver la sugerencia.
     *
     * @param {boolean} newVal
     * @param {boolean} oldVal
     */
    ai_suggestion_request_loading(newVal, oldVal) {
      if (oldVal === true && newVal === false) {
        this.schedule_scroll_to_bottom()
      }
      this.sync_countdown_clock()
    },

    /**
     * Cualquier cambio en mensajes (alta, aprobación, rechazo) mantiene el foco
     * al final del hilo y sincroniza el estado de la IA.
     * El marcado como leídos no va aquí: se hace en mounted() y desde el socket.
     * Llamarlo en este watcher genera un bucle infinito (cada respuesta del backend
     * actualiza el modelo, cambia la firma, dispara otro POST y termina en 429).
     */
    conversation_messages_signature() {
      this.schedule_scroll_to_bottom()
      this.sync_manual_ai_suggestion_state()
      this.sync_countdown_clock()
    },
  },

  mounted() {
    const self = this
    /* Cargar el lead completo (con mensajes) usando el param de la ruta. */
    const lead_id = this.$route.params.lead_id
    this.$store.commit('lead/set_lead_conversation_visible_id', lead_id)
    this.loading_conversation = true
    this.$store
      .dispatch('lead/fetch_lead_for_conversation', lead_id)
      .then(function (model) {
        /* Almacenar el lead y sincronizar el store de conversación. */
        self.lead_record = model
        self.merge_lead_into_conversation_store(model)
        /* Inicializar el estado del debounce de IA y el reloj de countdown. */
        self.load_ai_suggestion_settings()
        self.sync_manual_ai_suggestion_state()
        self.sync_countdown_clock()
        self.$nextTick(function () {
          self.schedule_scroll_to_bottom()
        })
        /* Marcar alertas de seguimiento como vistas y mensajes como leídos. */
        self.try_mark_followup_suggestion_seen()
        self.try_mark_whatsapp_messages_read()
        self.loading_conversation = false
      })
      .catch(function () {
        self.loading_conversation = false
      })
  },

  beforeUnmount() {
    const lead_id = this.$route.params.lead_id
    const visible_id = this.$store.state.lead.lead_conversation_visible_id
    if (lead_id != null && visible_id != null && String(visible_id) === String(lead_id)) {
      this.$store.commit('lead/set_lead_conversation_visible_id', null)
    }
    this.stop_countdown_clock()
    if (this.export_conversation_feedback_timer) {
      clearTimeout(this.export_conversation_feedback_timer)
      this.export_conversation_feedback_timer = null
    }
    /* Liberar micrófono si la vista se destruye mientras graba. */
    if (this.recording_audio) {
      try {
        if (this.audio_recorder) {
          this.audio_recorder.stop()
        }
      } catch (_) {}
    }
    this.release_audio_stream()
  },

  methods: {
    /**
     * Centraliza la actualización del registro local y del store tras cualquier
     * operación que modifique el lead (envío, aprobación, toggle, etc.).
     *
     * @param {Object} model Lead actualizado devuelto por la API.
     * @returns {void}
     */
    on_record_updated(model) {
      if (!model) {
        return
      }
      this.lead_record = model
      this.merge_lead_into_conversation_store(model)
    },

    /**
     * Ajusta el alto del textarea al contenido escrito (comportamiento tipo WhatsApp).
     * Máximo 128px antes de activar el scroll interno.
     *
     * @param {Event} event Evento `input` del textarea.
     * @returns {void}
     */
    on_input_resize(event) {
      const el = event.target
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 128) + 'px'
    },

    /**
     * Oculta mensajes espurios creados antes de soportar reacciones.
     *
     * @param {Object} msg Fila lead_messages.
     * @returns {boolean}
     */
    is_legacy_whatsapp_reaction_message(msg) {
      if (!msg) {
        return false
      }
      if (msg.kind === 'reaction') {
        return true
      }
      if (msg.sender !== 'lead') {
        return false
      }
      const text = ((msg.content || '') + '').trim()
      if (!text) {
        return false
      }
      return /^Reacted(?: with)? .+ to message wamid\./i.test(text)
        || /^Removed reaction from message wamid\./i.test(text)
    },

    /**
     * Actualiza el lead en store sin perder mensajes/adjuntos ya cargados.
     *
     * @param {Object} val Registro del lead a sincronizar.
     * @returns {void}
     */
    merge_lead_into_conversation_store(val) {
      const prev = this.$store.state.lead.lead_en_conversacion
      if (prev && prev.id == val.id) {
        this.$store.commit('lead/update_lead_en_conversacion', val)
        return
      }
      this.$store.commit('lead/set_lead_en_conversacion', val)
    },

    /**
     * Programa scroll al final del hilo tras actualizar el DOM.
     *
     * @returns {void}
     */
    schedule_scroll_to_bottom() {
      const self = this
      this.$nextTick(function () {
        self.$nextTick(function () {
          self.scroll_conversation_to_bottom()
        })
      })
    },

    /**
     * Desplaza el panel de mensajes hasta el último mensaje.
     *
     * @returns {void}
     */
    scroll_conversation_to_bottom() {
      const el = this.$refs.conversation_scroll_box
      if (!el) {
        return
      }
      el.scrollTop = el.scrollHeight
    },

    /**
     * Quita el badge de seguimiento sin ver si el lead lo tiene pendiente.
     *
     * @returns {void}
     */
    try_mark_followup_suggestion_seen() {
      const self = this
      const rec = this.effective_record
      if (!rec || !rec.id || !rec.tiene_seguimiento_sin_ver) {
        return
      }
      if (this.marking_followup_seen) {
        return
      }
      this.marking_followup_seen = true
      this.$store
        .dispatch('lead/mark_followup_suggestion_seen', rec.id)
        .then(function (model) {
          self.marking_followup_seen = false
          self.on_record_updated(model)
        })
        .catch(function () {
          self.marking_followup_seen = false
        })
    },

    /**
     * Mayor contador de no leídos entre el registro local y el del store.
     *
     * @param {Object|null} record_row Fila del registro local.
     * @param {Object|null} conv_row Lead en Vuex.
     * @returns {number}
     */
    resolve_effective_unread_count(record_row, conv_row) {
      const candidates = []
      if (record_row) {
        candidates.push(record_row.unread_count, record_row.unread_messages_count)
      }
      if (conv_row) {
        candidates.push(conv_row.unread_count, conv_row.unread_messages_count)
      }
      let max_unread = 0
      let i = 0
      for (i = 0; i < candidates.length; i = i + 1) {
        const n = parseInt(candidates[i], 10)
        if (!isNaN(n) && n > max_unread) {
          max_unread = n
        }
      }
      return max_unread
    },

    /**
     * Marca como leídos los mensajes entrantes del lead (la vista siempre está activa).
     *
     * @returns {void}
     */
    try_mark_whatsapp_messages_read() {
      const self = this
      const rec = this.effective_record
      if (!rec || !rec.id) {
        return
      }
      const conv = this.$store.state.lead.lead_en_conversacion
      const unread = this.resolve_effective_unread_count(
        this.lead_record,
        conv && conv.id == rec.id ? conv : null
      )
      if (unread < 1) {
        return
      }
      // El store controla que no haya llamadas paralelas
      this.$store
        .dispatch('lead/mark_whatsapp_messages_read', rec.id)
        .then(function (model) {
          if (model) {
            self.on_record_updated(model)
          }
        })
        .catch(function () {
          // silencioso: el store ya manejó el flag
        })
    },

    /**
     * Envía un mensaje directo al lead por WhatsApp sin pasar por Claude.
     *
     * @returns {void}
     */
    on_enviar_directo() {
      const self = this
      const rec = this.effective_record
      const text = (this.mensaje_directo || '').trim()
      if (!text || !rec || !rec.id || this.enviando_directo) {
        return
      }
      this.enviando_directo = true
      this.$store
        .dispatch('lead/send_direct_message', { lead_id: rec.id, content: text })
        .then(function (model) {
          self.enviando_directo = false
          self.mensaje_directo = ''
          /* Resetear altura del textarea al vaciarlo. */
          self.$nextTick(function () {
            const textarea = self.$el && self.$el.querySelector('.message-input')
            if (textarea) {
              textarea.style.height = 'auto'
            }
          })
          self.on_record_updated(model)
          self.schedule_scroll_to_bottom()
        })
        .catch(function () {
          self.enviando_directo = false
        })
    },

    /**
     * Simula un mensaje entrante del lead (testing) sin pasar por WhatsApp.
     *
     * @returns {void}
     */
    on_simular_inbound() {
      const self = this
      const rec = this.effective_record
      const text = (this.mensaje_simulado || '').trim()
      if (!text || !rec || !rec.id || this.enviando_simulado) {
        return
      }
      this.enviando_simulado = true
      this.$store
        .dispatch('lead/simulate_inbound_message', { lead_id: rec.id, content: text })
        .then(function (model) {
          self.enviando_simulado = false
          self.mensaje_simulado = ''
          self.on_record_updated(model)
          self.schedule_scroll_to_bottom()
        })
        .catch(function () {
          self.enviando_simulado = false
        })
    },

    /**
     * Fuerza el seguimiento que corresponde al lead ahora mismo (testing).
     *
     * @returns {void}
     */
    on_forzar_seguimiento() {
      const self = this
      const rec = this.effective_record
      if (!rec || !rec.id || this.forzando_seguimiento) {
        return
      }
      this.forzando_seguimiento = true
      this.forzar_seguimiento_resultado = ''
      this.$store
        .dispatch('lead/force_followup', rec.id)
        .then(function (data) {
          self.forzando_seguimiento = false
          self.on_record_updated(data.model)
          self.schedule_scroll_to_bottom()
          const outcome = data.outcome || {}
          if (outcome.result === 'no_rule') {
            self.forzar_seguimiento_resultado = 'No hay regla de seguimiento activa para este estado.'
          } else if (outcome.result === 'paused') {
            self.forzar_seguimiento_resultado = 'Se alcanzó el máximo de seguimientos: el lead pasó a en_pausa.'
          } else if (outcome.result === 'suggestion') {
            const via = outcome.via === 'template' ? 'plantilla de WhatsApp' : 'sugerencia de Claude'
            self.forzar_seguimiento_resultado = 'Seguimiento #' + outcome.followup_number + ' disparado vía ' + via + '.'
          }
        })
        .catch(function () {
          self.forzando_seguimiento = false
          self.forzar_seguimiento_resultado = 'Error al forzar el seguimiento.'
        })
    },

    /**
     * Activa o desactiva la suscripción WhatsApp para este lead.
     * El backend inserta/elimina la fila en lead_admin_notifications según el estado solicitado.
     *
     * @param {boolean} enabled Nuevo estado deseado del toggle.
     * @returns {void}
     */
    on_toggle_notify_messages(enabled) {
      const self = this
      const rec = this.effective_record
      if (!rec || !rec.id || this.toggling_notify) {
        return
      }
      this.toggling_notify = true
      api
        .post('/lead/' + rec.id + '/toggle-notify-messages', { enabled: enabled })
        .then(function (res) {
          self.toggling_notify = false
          /* Fusiona is_notified_by_me desde la respuesta del backend sobre el registro actual. */
          self.on_record_updated(Object.assign({}, rec, {
            is_notified_by_me: res.data.notificar_mensajes
          }))
        })
        .catch(function (error) {
          self.toggling_notify = false
          console.error('Error al actualizar notificaciones del lead', error)
        })
    },

    /**
     * GET settings/lead-whatsapp-onboarding para cargar demora de debounce IA.
     *
     * @returns {void}
     */
    load_ai_suggestion_settings() {
      const self = this
      api
        .get('/settings/lead-whatsapp-onboarding')
        .then(function (res) {
          const delay = parseInt(res.data && res.data.ai_suggestion_delay_seconds, 10)
          if (!isNaN(delay)) {
            self.ai_suggestion_delay_seconds = delay
          }
          const auto_send_delay = parseInt(res.data && res.data.ai_suggestion_auto_send_delay_seconds, 10)
          if (!isNaN(auto_send_delay)) {
            self.ai_suggestion_auto_send_delay_seconds = auto_send_delay
          }
          self.sync_countdown_clock()
        })
        .catch(function () {
          /* Mantener default local si falla la carga. */
        })
    },

    /**
     * Actualiza el timestamp del último inbound y reinicia bypass si llegó mensaje nuevo.
     *
     * @returns {void}
     */
    sync_manual_ai_suggestion_state() {
      const list = this.sorted_messages
      let last_ms = 0
      let last_id = 0
      let i = 0
      for (i = 0; i < list.length; i++) {
        const m = list[i]
        const sender = ((m.sender || '') + '').toLowerCase()
        const status = ((m.status || '') + '').toLowerCase()
        if (sender !== 'lead' || status !== 'enviado') {
          continue
        }
        const msg_id = parseInt(m.id, 10)
        if (isNaN(msg_id)) {
          continue
        }
        if (msg_id >= last_id) {
          last_id = msg_id
          const raw = m.created_at
          const parsed = raw ? new Date(raw).getTime() : 0
          last_ms = isNaN(parsed) ? 0 : parsed
        }
      }
      if (last_id > this.last_lead_inbound_message_id) {
        this.ai_auto_consult_cancelled = false
      }
      this.last_lead_inbound_message_id = last_id
      this.last_lead_inbound_at_ms = last_ms
    },

    /**
     * Arranca o detiene el reloj local cuando hay countdowns visibles.
     * La vista siempre está activa (sin guard de parent_active_tab).
     *
     * @returns {void}
     */
    sync_countdown_clock() {
      /* La vista siempre está activa: solo necesita el reloj cuando hay countdown. */
      const needs_clock = this.show_ai_consult_countdown || this.has_active_auto_send_countdown
      if (!needs_clock) {
        this.stop_countdown_clock()
        return
      }
      if (this.now_tick_interval_id) {
        return
      }
      const self = this
      this.now_tick = Date.now()
      this.now_tick_interval_id = setInterval(function () {
        self.now_tick = Date.now()
        if (!self.show_ai_consult_countdown && !self.has_active_auto_send_countdown) {
          self.stop_countdown_clock()
        }
      }, 1000)
    },

    /**
     * Detiene el intervalo del reloj de countdown.
     *
     * @returns {void}
     */
    stop_countdown_clock() {
      if (!this.now_tick_interval_id) {
        return
      }
      clearInterval(this.now_tick_interval_id)
      this.now_tick_interval_id = null
    },

    /**
     * Cancela el job diferido que pediría sugerencia IA automática a Claude.
     *
     * @returns {void}
     */
    on_cancel_auto_ai_consult() {
      const self = this
      const rec = this.effective_record
      if (!rec || !rec.id || this.cancelling_auto_consult) {
        return
      }
      this.cancelling_auto_consult = true
      this.$store
        .dispatch('lead/cancel_scheduled_ai_suggestion', rec.id)
        .then(function (model) {
          self.cancelling_auto_consult = false
          self.ai_auto_consult_cancelled = true
          self.on_record_updated(model)
          self.sync_countdown_clock()
        })
        .catch(function () {
          self.cancelling_auto_consult = false
        })
    },

    /**
     * Pide sugerencia a Claude de inmediato (sin esperar el debounce automático).
     *
     * @returns {void}
     */
    on_request_ai_suggestion() {
      const self = this
      const rec = this.effective_record
      if (!rec || !rec.id || !this.can_request_ai_suggestion) {
        return
      }
      this.$store
        .dispatch('lead/request_ai_suggestion', rec.id)
        .then(function (model) {
          self.ai_auto_consult_cancelled = false
          self.on_record_updated(model)
          self.schedule_scroll_to_bottom()
          self.sync_countdown_clock()
        })
        .catch(function () {
          /* ai_error queda en store para el alert rojo. */
        })
    },

    /**
     * Activa o desactiva la respuesta automática de Claude para este lead.
     *
     * @returns {void}
     */
    on_toggle_claude_auto_reply() {
      const self = this
      const rec = this.effective_record
      if (!rec || !rec.id || this.toggling_claude_auto_reply) {
        return
      }
      this.toggling_claude_auto_reply = true
      this.$store
        .dispatch('lead/toggle_claude_auto_reply', rec.id)
        .then(function (model) {
          self.toggling_claude_auto_reply = false
          if (!model.claude_auto_reply) {
            self.ai_auto_consult_cancelled = true
          }
          self.on_record_updated(model)
          self.sync_countdown_clock()
        })
        .catch(function () {
          self.toggling_claude_auto_reply = false
        })
    },

    /**
     * Envía por WhatsApp la sugerencia de Claude sin modificar el texto.
     *
     * @param {number} message_id Id del mensaje a aprobar.
     * @returns {void}
     */
    on_enviar_sugerencia(message_id) {
      const self = this
      this.busy_message_id = message_id
      this.$store
        .dispatch('lead/approve_message', message_id)
        .then(function (model) {
          self.busy_message_id = null
          self.on_record_updated(model)
          self.schedule_scroll_to_bottom()
        })
        .catch(function () {
          self.busy_message_id = null
        })
    },

    /**
     * Guarda el texto editado y lo envía por WhatsApp.
     *
     * @param {number} message_id Id del mensaje a aprobar con edición.
     * @param {string} edited_content Texto editado por el setter.
     * @returns {void}
     */
    on_guardar_y_enviar_sugerencia(message_id, edited_content) {
      const self = this
      const text = (edited_content || '').trim()
      if (!text) {
        return
      }
      this.busy_message_id = message_id
      this.$store
        .dispatch('lead/approve_message_with_edit', {
          message_id: message_id,
          edited_content: text,
        })
        .then(function (model) {
          self.busy_message_id = null
          self.on_record_updated(model)
          self.schedule_scroll_to_bottom()
        })
        .catch(function () {
          self.busy_message_id = null
        })
    },

    /**
     * Cancela el envío automático de una sugerencia y la marca como no enviada.
     *
     * @param {number} message_id Id del mensaje a cancelar.
     * @returns {void}
     */
    on_cancelar_envio_automatico(message_id) {
      const self = this
      this.busy_message_id = message_id
      this.$store
        .dispatch('lead/cancel_auto_send_message', message_id)
        .then(function (model) {
          self.busy_message_id = null
          self.on_record_updated(model)
          self.sync_countdown_clock()
        })
        .catch(function () {
          self.busy_message_id = null
        })
    },

    /**
     * Alterna si el mensaje se incluye o excluye del historial enviado a Claude.
     *
     * @param {number} message_id Id del mensaje a alternar.
     * @returns {void}
     */
    on_toggle_deleted_from_context(message_id) {
      const self = this
      this.busy_message_id = message_id
      this.$store
        .dispatch('lead/toggle_message_deleted_from_context', message_id)
        .then(function (model) {
          self.busy_message_id = null
          self.on_record_updated(model)
        })
        .catch(function () {
          self.busy_message_id = null
        })
    },

    /**
     * Formatea la conversación completa y la copia al portapapeles.
     *
     * @returns {void}
     */
    on_export_conversation() {
      const self = this
      const rec = this.effective_record
      if (!rec || !this.sorted_messages.length || this.export_conversation_loading) {
        return
      }
      this.export_conversation_loading = true
      copy_lead_conversation_to_clipboard(rec, this.sorted_messages)
        .then(function () {
          self.export_conversation_feedback = true
          if (self.export_conversation_feedback_timer) {
            clearTimeout(self.export_conversation_feedback_timer)
          }
          self.export_conversation_feedback_timer = setTimeout(function () {
            self.export_conversation_feedback = false
            self.export_conversation_feedback_timer = null
          }, 2000)
        })
        .catch(function () {
          alert('No se pudo copiar la conversación al portapapeles.')
        })
        .then(function () {
          self.export_conversation_loading = false
        })
    },

    /**
     * Click simple en el micrófono:
     * - Si no está grabando → inicia
     * - Si está grabando → detiene y envía
     * Si el usuario hizo hold (mousedown + mouseup), el click se ignora
     * porque on_mic_mouseup_or_leave ya manejó el stop.
     *
     * @returns {void}
     */
    on_mic_click() {
      if (this.audio_hold_mode) {
        this.audio_hold_mode = false
        return
      }
      if (this.recording_audio) {
        this.stop_and_send_audio()
      } else {
        this.start_audio_recording()
      }
    },

    /**
     * MouseDown: marca que el usuario puede estar en modo hold y empieza a grabar.
     * Se distingue del click simple con un timer corto.
     *
     * @returns {void}
     */
    on_mic_mousedown() {
      const self = this
      this._mic_hold_timer = setTimeout(function () {
        self.audio_hold_mode = true
        self.start_audio_recording()
      }, 200)
    },

    /**
     * MouseUp o MouseLeave: si estaba en hold y grabando, detiene y envía.
     *
     * @returns {void}
     */
    on_mic_mouseup_or_leave() {
      if (this._mic_hold_timer) {
        clearTimeout(this._mic_hold_timer)
        this._mic_hold_timer = null
      }
      if (this.audio_hold_mode && this.recording_audio) {
        this.audio_hold_mode = false
        this.stop_and_send_audio()
      }
    },

    /**
     * TouchStart: inicia el hold en dispositivos táctiles.
     *
     * @param {TouchEvent} event
     * @returns {void}
     */
    on_mic_touchstart(event) {
      event.preventDefault()
      this.audio_hold_mode = true
      this.start_audio_recording()
    },

    /**
     * TouchEnd: detiene la grabación en hold táctil.
     *
     * @param {TouchEvent} event
     * @returns {void}
     */
    on_mic_touchend(event) {
      event.preventDefault()
      if (this.audio_hold_mode && this.recording_audio) {
        this.audio_hold_mode = false
        this.stop_and_send_audio()
      }
    },

    /**
     * Solicita acceso al micrófono y empieza a grabar con MediaRecorder.
     *
     * @returns {void}
     */
    start_audio_recording() {
      const self = this
      if (this.recording_audio || this.enviando_audio) {
        return
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Tu navegador no soporta grabación de audio.')
        return
      }
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function (stream) {
          self.audio_stream = stream
          const recorder = new MediaRecorder(stream)
          self.audio_recorder = recorder
          const chunks = []
          recorder.ondataavailable = function (e) {
            if (e.data && e.data.size > 0) {
              chunks.push(e.data)
            }
          }
          recorder.onstop = function () {
            const mime = recorder.mimeType || 'audio/webm'
            const blob = new Blob(chunks, { type: mime })
            self._pending_audio_blob = blob
            self._pending_audio_mime = mime
            self.recording_audio = false
            self.release_audio_stream()
            self.send_pending_audio()
          }
          recorder.start()
          self.recording_audio = true
        })
        .catch(function (err) {
          console.error('Error al acceder al micrófono', err)
          alert('No se pudo acceder al micrófono. Verificá los permisos del navegador.')
          self.recording_audio = false
        })
    },

    /**
     * Detiene la grabación activa; el envío se dispara desde recorder.onstop.
     *
     * @returns {void}
     */
    stop_and_send_audio() {
      if (!this.recording_audio || !this.audio_recorder) {
        return
      }
      try {
        this.audio_recorder.stop()
      } catch (err) {
        console.error('Error al detener el MediaRecorder', err)
        this.recording_audio = false
        this.release_audio_stream()
      }
    },

    /**
     * Libera el stream del micrófono (apaga el LED de grabación en el sistema operativo).
     *
     * @returns {void}
     */
    release_audio_stream() {
      if (this.audio_stream) {
        this.audio_stream.getTracks().forEach(function (t) {
          t.stop()
        })
        this.audio_stream = null
      }
      this.audio_recorder = null
    },

    /**
     * Envía el blob de audio al backend vía POST multipart.
     *
     * @returns {void}
     */
    send_pending_audio() {
      const self = this
      const rec = this.effective_record
      const blob = this._pending_audio_blob
      const mime = this._pending_audio_mime || 'audio/webm'
      if (!blob || !rec || !rec.id || this.enviando_audio) {
        return
      }
      this._pending_audio_blob = null
      this._pending_audio_mime = null

      let ext = 'webm'
      if (mime.indexOf('ogg') !== -1) {
        ext = 'ogg'
      } else if (mime.indexOf('mp4') !== -1) {
        ext = 'mp4'
      }
      const form = new FormData()
      form.append('audio', blob, 'audio.' + ext)

      this.enviando_audio = true
      api
        .post('/lead/' + rec.id + '/send-direct-audio', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then(function (res) {
          self.enviando_audio = false
          self.on_record_updated(res.data.model)
          self.schedule_scroll_to_bottom()
        })
        .catch(function (err) {
          self.enviando_audio = false
          console.error('Error al enviar audio', err)
          alert('No se pudo enviar el audio.')
        })
    },
  },
}
</script>

<style scoped>
/* Layout de pantalla completa tipo WhatsApp.
   Se fija sobre todo el viewport con position:fixed para neutralizar cualquier padding,
   scroll o margen que el layout de App.vue aplique al <main> contenedor. */
.conversation-view {
  position: fixed;
  inset: 0;
  z-index: 1040;
  background: var(--bs-body-bg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header y footer no ceden espacio al área de mensajes */
.conversation-header {
  flex-shrink: 0;
}
.conversation-footer {
  flex-shrink: 0;
  background: #f0f2f5;
}

/* En móvil, separar el footer del borde inferior (barra del sistema / home indicator). */
@media (max-width: 767.98px) {
  .conversation-footer {
    padding-bottom: 25px;
  }
}

/* El nombre del lead se trunca si es muy largo */
.conversation-lead-name {
  max-width: 60vw;
}

/* Área de mensajes ocupa el espacio restante y scrollea internamente. */
.conversation-messages {
  flex: 1;
  overflow-y: auto;
}

/* Columna flex para alinear burbujas; el scroll vive en .conversation-messages. */
.conversation-messages-flow {
  display: flex;
  flex-direction: column;
}

/* Alertas pegadas al tope del área de scroll (no del viewport) */
.sticky-top-alerts {
  position: sticky;
  top: 0;
  z-index: 4;
}

/* Botones circulares de solo ícono (header y footer) */
.icon-btn {
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 50%;
  border: none;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  cursor: pointer;
  transition: background 0.15s;
  padding: 0;
}
.icon-btn:hover {
  background: var(--bs-secondary-bg);
}
.icon-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

/* Textarea auto-expandible tipo WhatsApp */
.message-input {
  flex: 1;
  resize: none;
  overflow-y: auto;
  max-height: 8rem;
  border-radius: 1.35rem;
  padding: 0.55rem 1rem;
  line-height: 1.4;
  border: none;
  background: #ffffff;
  font-size: inherit;
  box-shadow: 0 1px 0.5px rgba(11, 20, 26, 0.13);
}
.message-input:focus {
  outline: none;
  box-shadow: 0 1px 0.5px rgba(11, 20, 26, 0.13);
}

/* Sección DEV con fondo suave para distinguirla del área de producción */
.dev-tools {
  background: rgba(var(--bs-warning-rgb), 0.05);
  border-radius: 0.375rem;
  padding: 0.5rem;
}

/* Pulso rojo mientras graba */
@keyframes audio-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
}
.audio-recording-pulse {
  animation: audio-pulse 1s ease-in-out infinite;
}

/* Overlay del modal de resumen */
.resumen-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1060;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

/* Panel del modal: sube desde abajo, ocupa hasta 80% del alto de pantalla */
.resumen-modal-panel {
  background: var(--bs-body-bg);
  border-radius: 1rem 1rem 0 0;
  width: 100%;
  max-width: 640px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Cuerpo scrolleable */
.resumen-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem 1.5rem;
}
</style>
