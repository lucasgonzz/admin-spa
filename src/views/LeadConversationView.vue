<template>
  <div class="lead-conversation-view">

    <!-- ====================== HEADER FIJO ====================== -->
    <header class="lcv-header">
      <!-- Zona izquierda: volver + nombre del lead -->
      <div class="lcv-header-left">
        <!-- Botón volver a la tabla de leads (solo ícono) -->
        <button
          type="button"
          class="lcv-circle-btn"
          title="Volver a leads"
          aria-label="Volver a leads"
          @click="on_back_to_leads"
        >
          <i class="bi bi-arrow-left" aria-hidden="true" />
        </button>
        <!-- Nombre del lead (contact_name) o "Lead #N" si está vacío -->
        <span class="lcv-lead-name text-truncate">{{ lead_display_name }}</span>
      </div>

      <!-- Zona derecha: acciones de la conversación (solo íconos) -->
      <div class="lcv-header-actions">
        <!-- Notificar mensajes de este lead (toggle por push) -->
        <button
          type="button"
          class="lcv-circle-btn"
          :class="notify_messages_active ? 'lcv-circle-btn--active' : ''"
          :disabled="toggling_notify"
          :title="notify_messages_active
            ? 'Estás recibiendo notificaciones push de este lead. Clic para desactivar.'
            : 'Activar notificaciones push de los mensajes de este lead.'"
          aria-label="Notificar mensajes de este lead"
          @click="on_toggle_notify_messages(!notify_messages_active)"
        >
          <span
            v-if="toggling_notify"
            class="spinner-border spinner-border-sm"
            role="status"
            aria-hidden="true"
          />
          <i
            v-else
            class="bi"
            :class="notify_messages_active ? 'bi-bell-fill' : 'bi-bell'"
            aria-hidden="true"
          />
        </button>

        <!-- Exportar conversación al portapapeles -->
        <button
          type="button"
          class="lcv-circle-btn"
          :class="export_conversation_feedback ? 'lcv-circle-btn--success' : ''"
          :disabled="export_conversation_loading || !sorted_messages.length"
          :title="sorted_messages.length
            ? 'Copiar toda la conversación al portapapeles con fecha, emisor y contenido'
            : 'No hay mensajes para exportar'"
          aria-label="Exportar conversación"
          @click="on_export_conversation"
        >
          <span
            v-if="export_conversation_loading"
            class="spinner-border spinner-border-sm"
            role="status"
            aria-hidden="true"
          />
          <i
            v-else
            class="bi"
            :class="export_conversation_feedback ? 'bi-check-lg' : 'bi-clipboard'"
            aria-hidden="true"
          />
        </button>

        <!-- Pedir respuesta IA a Claude (deshabilitado si no corresponde) -->
        <button
          type="button"
          class="lcv-circle-btn"
          :disabled="!can_request_ai_suggestion"
          :title="request_ai_suggestion_button_title"
          aria-label="Pedir respuesta a Claude"
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

        <!-- Toggle de respuesta automática de Claude (ON/OFF) -->
        <button
          type="button"
          class="lcv-circle-btn"
          :class="claude_auto_reply_enabled ? 'lcv-circle-btn--active' : ''"
          :disabled="toggling_claude_auto_reply"
          :title="claude_auto_reply_enabled
            ? 'Claude responde automáticamente a este lead. Clic para desactivar y responder vos.'
            : 'Claude no intercepta mensajes de este lead. Clic para reactivar.'"
          aria-label="Activar o desactivar respuesta automática de Claude"
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
    </header>

    <!-- ====================== ÁREA DE MENSAJES (SCROLL) ====================== -->
    <div ref="conversation_scroll_box" class="lcv-messages bg-light">

      <!-- Alertas contextuales sticky al tope de la lista (no ocupan espacio fijo) -->
      <div class="lcv-sticky-alerts">
        <!-- Alerta cuando Claude está desactivado para este lead -->
        <div v-if="!claude_auto_reply_enabled" class="alert alert-warning py-2 small mb-2">
          <i class="bi bi-person-check me-1" aria-hidden="true" />
          Respondés vos a este lead. Claude <strong>no</strong> generará sugerencias ni enviará respuestas automáticas.
        </div>

        <!-- Alerta de seguimiento automático pendiente -->
        <div v-if="has_pending_followup_suggestion" class="alert alert-info py-2 small mb-2">
          <i class="bi bi-clock-history me-1" aria-hidden="true" />
          Hay una <strong>sugerencia de seguimiento automático</strong> por inactividad del lead. Revisá el mensaje marcado en la conversación.
        </div>

        <!-- Error de IA -->
        <div v-if="ai_error" class="alert alert-danger py-2 small mb-2">{{ ai_error }}</div>

        <!-- Claude está consultando -->
        <div
          v-if="ai_suggestion_request_loading"
          class="alert alert-secondary py-2 small mb-2 d-flex align-items-center gap-2"
        >
          <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
          Consultando a Claude…
        </div>

        <!-- Countdown antes de consultar a Claude automáticamente -->
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
            class="btn btn-outline-secondary btn-sm"
            :disabled="cancelling_auto_consult"
            title="Cancelar la petición automática a Claude"
            @click="on_cancel_auto_ai_consult"
          >
            <span
              v-if="cancelling_auto_consult"
              class="spinner-border spinner-border-sm"
              role="status"
              aria-hidden="true"
            />
            <template v-else>Cancelar</template>
          </button>
        </div>
      </div>

      <!-- Estados de la lista de mensajes -->
      <div
        v-if="loading_conversation"
        class="text-muted small p-2 d-flex align-items-center gap-2"
      >
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
        Cargando conversación…
      </div>
      <div v-else-if="!sorted_messages.length" class="text-muted small p-2">Sin mensajes todavía.</div>
      <message-bubble
        v-for="msg in sorted_messages"
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

    <!-- ====================== FOOTER FIJO (REDACCIÓN) ====================== -->
    <footer class="lcv-footer">
      <!-- Fila de redacción: textarea auto-expandible + botón audio/enviar -->
      <div class="lcv-compose-row">
        <textarea
          ref="compose_textarea"
          v-model="mensaje_directo"
          class="lcv-compose-input"
          rows="1"
          placeholder="Mensaje…"
          :disabled="enviando_directo"
          @input="on_compose_input"
          @keydown.enter.exact.prevent
        />
        <!-- Si no hay texto: botón de audio (placeholder deshabilitado) -->
        <button
          v-if="!has_mensaje_directo"
          type="button"
          class="lcv-circle-btn lcv-circle-btn--accent"
          disabled
          title="Grabación de audio próximamente"
          aria-label="Grabar audio"
        >
          <i class="bi bi-mic" aria-hidden="true" />
        </button>
        <!-- Si hay texto: botón de enviar -->
        <button
          v-else
          type="button"
          class="lcv-circle-btn lcv-circle-btn--accent"
          :disabled="enviando_directo"
          title="Enviar mensaje por WhatsApp"
          aria-label="Enviar mensaje"
          @click="on_enviar_directo"
        >
          <span v-if="enviando_directo" class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
          <i v-else class="bi bi-send" aria-hidden="true" />
        </button>
      </div>

      <!-- Controles solo de desarrollo: simular mensaje del lead + forzar seguimiento -->
      <div v-if="is_dev_environment" class="lcv-dev-controls">
        <!-- Simular un mensaje entrante del lead (testing, sin pasar por WhatsApp) -->
        <div class="d-flex align-items-center gap-2 mb-2">
          <input
            v-model="mensaje_simulado"
            type="text"
            class="form-control form-control-sm"
            placeholder="Simular mensaje del lead…"
            :disabled="enviando_simulado"
            @keydown.enter.prevent="on_simular_inbound"
          />
          <button
            type="button"
            class="btn btn-outline-warning btn-sm d-inline-flex align-items-center gap-2 flex-shrink-0"
            :disabled="enviando_simulado || !has_mensaje_simulado"
            @click="on_simular_inbound"
          >
            <span v-if="enviando_simulado" class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
            <template v-else>Simular</template>
          </button>
        </div>
        <!-- Forzar el seguimiento que corresponda ahora mismo (testing) -->
        <div class="d-flex align-items-center gap-2">
          <button
            type="button"
            class="btn btn-outline-info btn-sm d-inline-flex align-items-center gap-2 flex-shrink-0"
            :disabled="forzando_seguimiento"
            title="Dispara ahora el seguimiento que corresponda según el estado y los seguimientos ya enviados, sin esperar el tiempo configurado"
            @click="on_forzar_seguimiento"
          >
            <span v-if="forzando_seguimiento" class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
            <template v-else>Forzar seguimiento</template>
          </button>
          <span v-if="forzar_seguimiento_resultado" class="small text-muted">{{ forzar_seguimiento_resultado }}</span>
        </div>
      </div>
    </footer>

  </div>
</template>

<script>
import MessageBubble from '@/components/lead/conversation/MessageBubble.vue'
import api from '@/utils/axios'
import { copy_lead_conversation_to_clipboard } from '@/utils/lead_conversation_clipboard'

/**
 * Vista de pantalla completa de la conversación WhatsApp de un lead.
 *
 * Migra la lógica de `components/lead/conversation/Index.vue` (que vivía dentro del modal)
 * a un módulo de pantalla completa con layout tipo WhatsApp: header fijo, área de mensajes
 * scrolleable y footer fijo de redacción. El lead se obtiene por `$route.params.lead_id` y
 * la fuente de verdad reactiva es `lead_en_conversacion` del store (todas las acciones del
 * store ya hacen commit de `update_lead_en_conversacion`).
 */
export default {
  name: 'LeadConversationView',
  components: { MessageBubble },
  data() {
    return {
      /** Lead cargado por id de ruta (copia local; el store es la fuente reactiva). */
      lead_record: null,
      /** Texto del mensaje directo a enviar al lead por WhatsApp. */
      mensaje_directo: '',
      /** true mientras se envía el mensaje directo (evita doble envío). */
      enviando_directo: false,
      /** Texto del mensaje simulado del lead (testing, no pasa por WhatsApp). */
      mensaje_simulado: '',
      /** true mientras se simula el mensaje entrante (evita doble envío). */
      enviando_simulado: false,
      /** true mientras se fuerza el seguimiento manual (testing) (evita doble click). */
      forzando_seguimiento: false,
      /** Texto descriptivo del último resultado de forzar seguimiento (testing). */
      forzar_seguimiento_resultado: '',
      /** Evita doble click mientras se persiste el toggle de notificaciones. */
      toggling_notify: false,
      /** Id del mensaje en acción de aprobar/rechazar (deshabilita botones duplicados). */
      busy_message_id: null,
      /** Evita POST duplicados al marcar seguimiento como visto. */
      marking_followup_seen: false,
      /** Evita POST duplicados al marcar mensajes WhatsApp como leídos. */
      marking_whatsapp_read: false,
      /** GET /lead/{id} con messages al abrir la vista. */
      loading_conversation: false,
      /** Timestamp del último fetch exitoso de conversación (ms). */
      last_conversation_fetch_ms: 0,
      /** Id del lead del último fetch exitoso de conversación. */
      last_conversation_fetch_lead_id: null,
      /** Segundos de debounce antes de pedir sugerencia IA (settings de cuenta). */
      ai_suggestion_delay_seconds: 60,
      /** Segundos antes del envío automático de la sugerencia generada (settings de cuenta). */
      ai_suggestion_auto_send_delay_seconds: 120,
      /** Timestamp del último mensaje entrante del lead (ms) para evaluar debounce. */
      last_lead_inbound_at_ms: 0,
      /** Id del último mensaje entrante del lead (detecta inbound nuevo aunque no cambie created_at). */
      last_lead_inbound_message_id: 0,
      /** true si el setter canceló la sugerencia automática en el turno actual (se reinicia con inbound nuevo). */
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
      /** Feedback visual breve tras exportar con éxito. */
      export_conversation_feedback: false,
      /** Timer para resetear el feedback del botón de exportación. */
      export_conversation_feedback_timer: null,
    }
  },
  computed: {
    /**
     * true cuando la app corre en entorno de desarrollo (Vite).
     * Habilita los controles de testing (simular mensaje / forzar seguimiento).
     * @returns {boolean}
     */
    is_dev_environment() {
      return import.meta.env.DEV === true
    },
    /**
     * Registro efectivo del lead: prioriza el lead en store (fuente de verdad reactiva con el
     * hilo completo) y cae a la copia local cargada por ruta.
     * @returns {Object|null}
     */
    effective_record() {
      const conv = this.$store.state.lead.lead_en_conversacion
      if (conv && this.lead_record && conv.id == this.lead_record.id) {
        return conv
      }
      return this.lead_record
    },
    /**
     * Nombre a mostrar en el header: contact_name o "Lead #N" si está vacío.
     * @returns {string}
     */
    lead_display_name() {
      const rec = this.effective_record
      if (!rec) {
        return 'Lead'
      }
      const name = (rec.contact_name || '').trim()
      if (name) {
        return name
      }
      return 'Lead #' + rec.id
    },
    /**
     * true si el toggle de notificaciones push de este lead está activo.
     * @returns {boolean}
     */
    notify_messages_active() {
      const rec = this.effective_record
      return Boolean(rec && rec.notificar_mensajes)
    },
    /**
     * true si Claude puede actuar automáticamente en este lead (default true si el campo no viene aún).
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
     * Mensajes ordenados cronológicamente por id (sin reacciones legacy).
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
     * true mientras Claude genera sugerencia para este lead (automática o manual).
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
    ai_error() {
      return this.$store.state.lead.ai_error
    },
    /**
     * true si hay texto en el input directo para enviar.
     * @returns {boolean}
     */
    has_mensaje_directo() {
      return (this.mensaje_directo || '').trim() !== ''
    },
    /**
     * true si hay texto en el input de simulación de mensaje del lead.
     * @returns {boolean}
     */
    has_mensaje_simulado() {
      return (this.mensaje_simulado || '').trim() !== ''
    },
    /**
     * true si hay al menos un mensaje sugerido generado por el chequeo de seguimiento.
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
     * Firma estable de la lista de mensajes para detectar cambios (altas o cambio de estado).
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
        const att_count =
        m.attachments && m.attachments.length ? String(m.attachments.length) : '0'
        parts.push(String(m.id) + ':' + String(m.status || '') + ':' + String(m.kind || '') + ':' + att_count)
      }
      return parts.join('|')
    },
    /**
     * Cantidad de mensajes entrantes del lead en el hilo.
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
     * true si hay mensajes del lead sin respuesta del setter tras el último envío saliente.
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
     * true si se puede pedir sugerencia a Claude manualmente (mismas reglas que el backend).
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
     * Tooltip del botón "Pedir respuesta" según por qué está habilitado o deshabilitado.
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
     * true mientras corre el debounce antes de pedir sugerencia automática a Claude.
     * (En esta vista la pestaña de conversación siempre está activa.)
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
     * Segundos restantes hasta que se pida automáticamente la sugerencia a Claude.
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
     * Al terminar la generación automática o manual, bajar el scroll para ver la sugerencia.
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
     * Cualquier cambio en mensajes (alta, aprobar, rechazar) mantiene el foco al final del hilo.
     */
    conversation_messages_signature() {
      this.schedule_scroll_to_bottom()
      this.sync_manual_ai_suggestion_state()
      this.sync_countdown_clock()
    },
  },
  mounted() {
    /* Carga settings de IA y el lead completo de la ruta. */
    this.load_ai_suggestion_settings()
    this.load_lead_and_conversation()
  },
  beforeUnmount() {
    this.stop_countdown_clock()
    if (this.export_conversation_feedback_timer) {
      clearTimeout(this.export_conversation_feedback_timer)
      this.export_conversation_feedback_timer = null
    }
  },
  methods: {
    /**
     * Navega de vuelta a la tabla de leads.
     * @returns {void}
     */
    on_back_to_leads() {
      this.$router.push({ name: 'leads' })
    },
    /**
     * Carga el lead completo (con messages) por id de ruta y lo sincroniza con el store.
     * El store queda como fuente de verdad reactiva (fetch_full_model ya hace
     * commit de set_lead_en_conversacion).
     * @returns {void}
     */
    load_lead_and_conversation() {
      const self = this
      const lead_id = this.$route.params.lead_id
      if (!lead_id) {
        return
      }
      this.loading_conversation = true
      this.$store
        .dispatch('lead/fetch_lead_for_conversation', lead_id)
        .then(function (model) {
          self.loading_conversation = false
          if (model) {
            self.lead_record = model
            self.last_conversation_fetch_ms = Date.now()
            self.last_conversation_fetch_lead_id = model.id
          }
          self.sync_manual_ai_suggestion_state()
          self.try_mark_followup_suggestion_seen()
          self.try_mark_whatsapp_messages_read()
          self.sync_countdown_clock()
          self.schedule_scroll_to_bottom()
        })
        .catch(function () {
          self.loading_conversation = false
        })
    },
    /**
     * Sincroniza el modelo actualizado devuelto por una acción del store con la
     * fuente de verdad reactiva (lead_en_conversacion) y la copia local.
     * Reemplaza al antiguo `$emit('record-updated', ...)` del componente modal.
     * @param {Object} model lead actualizado (puede traer solo algunos campos).
     * @returns {void}
     */
    apply_updated_record(model) {
      if (!model || !model.id) {
        return
      }
      const conv = this.$store.state.lead.lead_en_conversacion
      if (conv && conv.id == model.id) {
        this.$store.commit('lead/update_lead_en_conversacion', model)
      } else {
        this.$store.commit('lead/set_lead_en_conversacion', model)
      }
      /* Copia local de respaldo por si el store aún no tenía el lead. */
      this.lead_record = Object.assign({}, this.lead_record || {}, model)
    },
    /**
     * Auto-expande el textarea de redacción a medida que crece el contenido (tipo WhatsApp).
     * @param {Event} event evento input del textarea.
     * @returns {void}
     */
    on_compose_input(event) {
      const el = event && event.target ? event.target : this.$refs.compose_textarea
      if (!el) {
        return
      }
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    },
    /**
     * Oculta mensajes espurios creados antes de soportar reacciones (texto "Reacted with … to message wamid.…").
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
     * Programa scroll al final tras actualizar el DOM (mensajes nuevos o estado post-Claude).
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
     * Desplaza el panel de conversación hasta el último mensaje.
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
     * Quita el badge de la tabla si el lead tiene seguimiento sin ver.
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
          self.apply_updated_record(model)
        })
        .catch(function () {
          self.marking_followup_seen = false
        })
    },
    /**
     * Marca como leídos los mensajes entrantes del lead al abrir la conversación.
     * @returns {void}
     */
    try_mark_whatsapp_messages_read() {
      const self = this
      const rec = this.effective_record
      if (!rec || !rec.id) {
        return
      }
      /* Contador per-usuario: unread_count y unread_messages_count son alias del mismo withCount. */
      const raw = rec.unread_count != null ? rec.unread_count : rec.unread_messages_count
      const unread = parseInt(raw, 10)
      if (isNaN(unread) || unread < 1) {
        return
      }
      if (this.marking_whatsapp_read) {
        return
      }
      this.marking_whatsapp_read = true
      this.$store
        .dispatch('lead/mark_whatsapp_messages_read', rec.id)
        .then(function (model) {
          self.marking_whatsapp_read = false
          self.apply_updated_record(model)
        })
        .catch(function () {
          self.marking_whatsapp_read = false
        })
    },
    /**
     * Envía un mensaje directo al lead por WhatsApp sin pasar por Claude.
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
          self.reset_compose_textarea_height()
          self.apply_updated_record(model)
          self.schedule_scroll_to_bottom()
        })
        .catch(function () {
          self.enviando_directo = false
        })
    },
    /**
     * Restablece la altura del textarea de redacción tras enviar (vuelve a una sola línea).
     * @returns {void}
     */
    reset_compose_textarea_height() {
      const self = this
      this.$nextTick(function () {
        const el = self.$refs.compose_textarea
        if (el) {
          el.style.height = 'auto'
        }
      })
    },
    /**
     * Simula un mensaje entrante del lead (testing) sin pasar por WhatsApp.
     * Dispara en el backend el mismo flujo que el webhook real (sugerencia IA con debounce).
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
          self.apply_updated_record(model)
          self.schedule_scroll_to_bottom()
        })
        .catch(function () {
          self.enviando_simulado = false
        })
    },
    /**
     * Fuerza el seguimiento que corresponde al lead ahora mismo (testing), sin esperar
     * el tiempo configurado ni estar bloqueado por una sugerencia pendiente.
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
          self.apply_updated_record(data.model)
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
     * Activa o desactiva las notificaciones push para el lead abierto.
     * El admin autenticado queda como destinatario al activar (backend toma Auth::id()).
     * @param {boolean} enabled
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
          /* Fusiona la respuesta parcial (notificar_mensajes, notify_admin_id) sobre el registro actual. */
          self.apply_updated_record(Object.assign({}, rec, res.data))
        })
        .catch(function (error) {
          self.toggling_notify = false
          console.error('Error al actualizar notificaciones del lead', error)
        })
    },
    /**
     * GET settings/lead-whatsapp-onboarding para conocer la demora de debounce IA.
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
     * Actualiza el timestamp del último inbound del lead y reinicia bypass si llegó mensaje nuevo.
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
     * @returns {void}
     */
    sync_countdown_clock() {
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
          self.apply_updated_record(model)
          self.sync_countdown_clock()
        })
        .catch(function () {
          self.cancelling_auto_consult = false
        })
    },
    /**
     * Pide sugerencia a Claude de inmediato (sin esperar el debounce automático).
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
          self.apply_updated_record(model)
          self.schedule_scroll_to_bottom()
          self.sync_countdown_clock()
        })
        .catch(function () {
          /* ai_error queda en store para el alert rojo. */
        })
    },
    /**
     * Activa o desactiva la respuesta automática de Claude para el lead de esta conversación.
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
          self.apply_updated_record(model)
          self.sync_countdown_clock()
        })
        .catch(function () {
          self.toggling_claude_auto_reply = false
        })
    },
    /**
     * Envía por WhatsApp la sugerencia de Claude sin modificar el texto.
     * @param {number} message_id
     * @returns {void}
     */
    on_enviar_sugerencia(message_id) {
      const self = this
      this.busy_message_id = message_id
      this.$store
        .dispatch('lead/approve_message', message_id)
        .then(function (model) {
          self.busy_message_id = null
          self.apply_updated_record(model)
          self.schedule_scroll_to_bottom()
        })
        .catch(function () {
          self.busy_message_id = null
        })
    },
    /**
     * Guarda el texto editado y lo envía por WhatsApp.
     * @param {number} message_id
     * @param {string} edited_content
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
          self.apply_updated_record(model)
          self.schedule_scroll_to_bottom()
        })
        .catch(function () {
          self.busy_message_id = null
        })
    },
    /**
     * Cancela el envío automático de una sugerencia y la marca como no enviada.
     * @param {number} message_id
     * @returns {void}
     */
    on_cancelar_envio_automatico(message_id) {
      const self = this
      this.busy_message_id = message_id
      this.$store
        .dispatch('lead/cancel_auto_send_message', message_id)
        .then(function (model) {
          self.busy_message_id = null
          self.apply_updated_record(model)
          self.sync_countdown_clock()
        })
        .catch(function () {
          self.busy_message_id = null
        })
    },
    /**
     * Alterna si el mensaje se incluye o excluye del historial enviado a Claude.
     * @param {number} message_id Id del mensaje de lead a alternar.
     * @returns {void}
     */
    on_toggle_deleted_from_context(message_id) {
      const self = this
      /* Marca el mensaje como ocupado para evitar doble clic. */
      this.busy_message_id = message_id
      this.$store
        .dispatch('lead/toggle_message_deleted_from_context', message_id)
        .then(function (model) {
          self.busy_message_id = null
          self.apply_updated_record(model)
        })
        .catch(function () {
          self.busy_message_id = null
        })
    },
    /**
     * Formatea la conversación completa y la copia al portapapeles.
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
  },
}
</script>

<style scoped>
/* Contenedor raíz: ocupa todo el alto del viewport en columna (header / mensajes / footer). */
.lead-conversation-view {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background-color: var(--bs-body-bg);
}

/* ====================== HEADER ====================== */
.lcv-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background-color: var(--bs-body-bg);
  border-bottom: 1px solid var(--bs-border-color);
}
.lcv-header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}
.lcv-lead-name {
  font-weight: 600;
  font-size: 1.05rem;
  max-width: 48vw;
}
.lcv-header-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

/* ====================== ÁREA DE MENSAJES ====================== */
.lcv-messages {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
}
/* Alertas contextuales pegadas al tope del scroll sin ocupar espacio fijo. */
.lcv-sticky-alerts {
  position: sticky;
  top: 0;
  z-index: 3;
}
.lcv-sticky-alerts:empty {
  display: none;
}

/* ====================== FOOTER ====================== */
.lcv-footer {
  flex-shrink: 0;
  padding: 0.5rem 0.75rem;
  background-color: var(--bs-body-bg);
  border-top: 1px solid var(--bs-border-color);
}
.lcv-compose-row {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
}
/* Textarea estilo WhatsApp: bordes redondeados, auto-expandible hasta un máximo. */
.lcv-compose-input {
  flex: 1 1 auto;
  border: 1px solid var(--bs-border-color);
  border-radius: 1.2rem;
  padding: 0.4rem 0.9rem;
  line-height: 1.35;
  max-height: 8rem;
  overflow-y: auto;
  resize: none;
  background-color: var(--bs-body-bg);
  color: var(--bs-body-color);
  font-size: 0.95rem;
}
.lcv-compose-input:focus {
  outline: none;
  border-color: var(--bs-primary);
}
/* Controles de desarrollo (testing): separados con borde superior suave. */
.lcv-dev-controls {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--bs-border-color);
}

/* ====================== BOTONES CIRCULARES (header / footer) ====================== */
.lcv-circle-btn {
  width: 2.2rem;
  height: 2.2rem;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background-color: transparent;
  color: var(--bs-body-color);
  font-size: 1.05rem;
  padding: 0;
  transition: background-color 0.15s, color 0.15s;
}
.lcv-circle-btn:hover:not(:disabled) {
  background-color: var(--bs-secondary-bg);
}
.lcv-circle-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
/* Estado activo (campana / Claude ON): resalta con color primario. */
.lcv-circle-btn--active {
  color: var(--bs-primary);
}
/* Feedback de exportación exitosa. */
.lcv-circle-btn--success {
  color: var(--bs-success);
}
/* Botón de acento (enviar / audio): fondo verde tipo WhatsApp. */
.lcv-circle-btn--accent {
  background-color: var(--bs-success);
  color: #fff;
}
.lcv-circle-btn--accent:hover:not(:disabled) {
  background-color: var(--bs-success);
  filter: brightness(0.95);
}
</style>
