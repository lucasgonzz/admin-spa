<template>
  <div v-if="effective_record && effective_record.id" class="lead-conversation-tab">

    <!-- Toggle respuesta automática de Claude por lead + pedido manual de sugerencia -->
    <div class="d-flex align-items-center justify-content-between gap-2 mb-2">
      <span class="small text-muted">Respuesta automática de Claude</span>
      <div class="d-flex align-items-center gap-2 flex-wrap justify-content-end">
        <button
          type="button"
          class="btn btn-sm d-inline-flex align-items-center gap-1"
          :class="export_conversation_feedback ? 'btn-success' : 'btn-outline-secondary'"
          :disabled="export_conversation_loading || !sorted_messages.length"
          :title="sorted_messages.length
            ? 'Copiar toda la conversación al portapapeles con fecha, emisor y contenido'
            : 'No hay mensajes para exportar'"
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
          <span>{{ export_conversation_feedback ? 'Copiado' : 'Exportar conversación' }}</span>
        </button>
        <button
          type="button"
          class="btn btn-sm d-inline-flex align-items-center gap-1"
          :class="can_request_ai_suggestion ? 'btn-outline-primary' : 'btn-outline-secondary'"
          :disabled="!can_request_ai_suggestion"
          :title="request_ai_suggestion_button_title"
          @click="on_request_ai_suggestion"
        >
          <span
            v-if="ai_suggestion_request_loading"
            class="spinner-border spinner-border-sm"
            role="status"
            aria-hidden="true"
          />
          <i v-else class="bi bi-lightning-charge" aria-hidden="true" />
          <span>Pedir respuesta</span>
        </button>
        <button
          type="button"
          class="btn btn-sm d-inline-flex align-items-center gap-1"
          :class="claude_auto_reply_enabled ? 'btn-success' : 'btn-outline-secondary'"
          :disabled="toggling_claude_auto_reply"
          :title="claude_auto_reply_enabled
            ? 'Claude responde automáticamente a este lead. Clic para desactivar y responder vos.'
            : 'Claude no intercepta mensajes de este lead. Clic para reactivar.'"
          @click="on_toggle_claude_auto_reply"
        >
          <span
            v-if="toggling_claude_auto_reply"
            class="spinner-border spinner-border-sm"
            role="status"
            aria-hidden="true"
          />
          <i v-else class="bi bi-stars" aria-hidden="true" />
          <span>Claude: {{ claude_auto_reply_enabled ? 'ON' : 'OFF' }}</span>
        </button>
      </div>
    </div>

    <!-- Alerta cuando Claude está desactivado para este lead -->
    <div v-if="!claude_auto_reply_enabled" class="alert alert-warning py-2 small mb-2">
      <i class="bi bi-person-check me-1" aria-hidden="true" />
      Respondés vos a este lead. Claude <strong>no</strong> generará sugerencias ni enviará respuestas automáticas.
    </div>

    <!-- Alerta de seguimiento automático -->
    <div v-if="has_pending_followup_suggestion" class="alert alert-info py-2 small mb-2">
      <i class="bi bi-clock-history me-1" aria-hidden="true" />
      Hay una <strong>sugerencia de seguimiento automático</strong> por inactividad del lead. Revisá el mensaje marcado en la conversación.
    </div>

    <!-- Error de IA -->
    <div v-if="ai_error" class="alert alert-danger py-2 small mb-2">{{ ai_error }}</div>

    <!-- Claude está consultando -->
    <div v-if="ai_suggestion_request_loading" class="alert alert-secondary py-2 small mb-2 d-flex align-items-center gap-2">
      <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
      Consultando a Claude…
    </div>

    <!-- Countdown antes de consultar a Claude (versión simple) -->
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

    <!-- Conversación -->
    <div ref="conversation_scroll_box" class="conversation-scroll whatsapp-conversation-wallpaper border rounded p-2 mb-3">
      <div
        v-if="loading_conversation"
        class="text-muted small p-2 d-flex align-items-center gap-2"
      >
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
        Cargando conversación…
      </div>
      <div v-else-if="!sorted_messages.length" class="text-muted small p-2">Sin mensajes todavía.</div>
      <template v-for="item in messages_with_date_dividers">
        <div
          v-if="item.type === 'date_divider'"
          :key="item.key"
          class="wa-date-divider"
        >
          <span class="wa-date-divider-label">{{ item.date_label }}</span>
        </div>
        <message-bubble
          v-else
          :key="item.key"
          :message="item.message"
          :busy="busy_message_id === item.message.id"
          :now_tick="now_tick"
          :auto_send_delay_seconds="ai_suggestion_auto_send_delay_seconds"
          @enviar="on_enviar_sugerencia(item.message.id)"
          @guardar_y_enviar="on_guardar_y_enviar_sugerencia(item.message.id, $event)"
          @cancelar_envio_automatico="on_cancelar_envio_automatico(item.message.id)"
          @toggle_deleted_from_context="on_toggle_deleted_from_context(item.message.id)"
        />
      </template>
    </div>

    <!-- Textarea para enviar mensaje directo al lead (Enter = nueva línea; solo el botón envía). -->
    <div class="d-flex align-items-end gap-2 lead-direct-compose">
      <textarea
        v-model="mensaje_directo"
        class="form-control form-control-sm lead-direct-textarea"
        rows="3"
        placeholder="Escribir mensaje para enviar por WhatsApp…"
        :disabled="enviando_directo"
      />
      <button
        type="button"
        class="btn btn-primary btn-sm d-inline-flex align-items-center gap-2"
        :disabled="enviando_directo || !has_mensaje_directo"
        @click="on_enviar_directo"
      >
        <span v-if="enviando_directo" class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
        <template v-else>Enviar</template>
      </button>
    </div>

    <!-- Input para simular un mensaje entrante del lead (testing, sin pasar por WhatsApp) -->
    <div class="d-flex align-items-center gap-2 mt-2">
      <input
        v-model="mensaje_simulado"
        type="text"
        class="form-control form-control-sm"
        placeholder="Simular mensaje del lead (test)…"
        :disabled="enviando_simulado"
        @keydown.enter.prevent="on_simular_inbound"
      />
      <button
        type="button"
        class="btn btn-outline-warning btn-sm d-inline-flex align-items-center gap-2"
        :disabled="enviando_simulado || !has_mensaje_simulado"
        @click="on_simular_inbound"
      >
        <span v-if="enviando_simulado" class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
        <template v-else>Simular</template>
      </button>
    </div>

    <!-- Forzar seguimiento manual (testing): dispara el seguimiento que corresponda ahora mismo -->
    <div class="d-flex align-items-center gap-2 mt-2">
      <button
        type="button"
        class="btn btn-outline-info btn-sm d-inline-flex align-items-center gap-2"
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
  <div v-else class="text-muted small">Guardá el lead primero para habilitar la conversación.</div>
</template>

<script>
import MessageBubble from './MessageBubble.vue'
import api from '@/utils/axios'
import { copy_lead_conversation_to_clipboard } from '@/utils/lead_conversation_clipboard'
import '@/styles/whatsapp-conversation-wallpaper.css'

/**
 * Pestaña "Conversación WhatsApp" dentro del modal de edición del lead.
 */
export default {
  name: 'LeadConversationTab',
  components: { MessageBubble },
  props: {
    /** Registro lead mostrado en la pestaña (scope del ModelModal). */
    record: { type: Object, default: null },
    /** Borrador completo del modal (misma fila que `record` en edición). */
    draft: { type: Object, default: null },
    /** Nombre del recurso padre (siempre lead en este flujo). */
    model_name: { type: String, default: 'lead' },
    /** Pestaña activa del modal (`group:…` o `extra:conversation`). */
    parent_active_tab: { type: String, default: null },
  },
  emits: ['record-updated'],
  data() {
    return {
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
      /** GET /lead/{id} con messages al abrir la pestaña. */
      loading_conversation: false,
      /** Evita GET duplicados por watcher deep / Pusher (rate limit 429). */
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
     * Registro efectivo: fusiona `record` del modal con mensajes cargados en store.
     * @returns {Object|null}
     */
    effective_record() {
      if (!this.record || !this.record.id) {
        return null
      }
      const conv = this.$store.state.lead.lead_en_conversacion
      if (conv && conv.id == this.record.id) {
        /** Fusión modal + store; el contador de no leídos toma el máximo para no quedar en 0 por estado obsoleto. */
        const merged = Object.assign({}, this.record, conv)
        const unread = this.resolve_effective_unread_count(this.record, conv)
        merged.unread_count = unread
        merged.unread_messages_count = unread
        return merged
      }
      return this.record
    },
    /**
     * true si Claude puede actuar automáticamente en este lead (default true si el campo no viene aún).
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
     * Mensajes ordenados cronológicamente por id.
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
     * Lista intercalada de mensajes y divisores de fecha (estilo WhatsApp).
     * Inserta un marcador cuando cambia el día entre mensajes consecutivos.
     *
     * @returns {Array<{type: string, key: string, date_label?: string, message?: Object}>}
     */
    messages_with_date_dividers() {
      /* Items finales: mensajes y divisores de fecha. */
      const items = []
      /* Fecha ISO (YYYY-MM-DD) del último divisor insertado. */
      let last_date_str = null

      /**
       * Normaliza un timestamp a medianoche en hora local del navegador.
       *
       * @param {string|number|Date} raw
       * @returns {Date|null}
       */
      function normalize_to_midnight(raw) {
        const d = new Date(raw)
        if (isNaN(d.getTime())) {
          return null
        }
        d.setHours(0, 0, 0, 0)
        return d
      }

      /**
       * Etiqueta legible para el divisor según distancia respecto a hoy.
       *
       * @param {Date} date
       * @returns {string}
       */
      function get_date_label(date) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const diff_days = Math.round((today - date) / 86400000)
        if (diff_days === 0) {
          return 'Hoy'
        }
        if (diff_days === 1) {
          return 'Ayer'
        }
        if (diff_days >= 2 && diff_days <= 6) {
          const name = date.toLocaleDateString('es-AR', { weekday: 'long' })
          return name.charAt(0).toUpperCase() + name.slice(1)
        }
        return date.toLocaleDateString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      }

      for (let i = 0; i < this.sorted_messages.length; i++) {
        const msg = this.sorted_messages[i]
        const d = normalize_to_midnight(msg.created_at)
        const date_str = d ? d.toISOString().slice(0, 10) : null

        /* Solo inserta divisor cuando cambia el día respecto al mensaje anterior. */
        if (date_str && date_str !== last_date_str) {
          items.push({
            type: 'date_divider',
            key: 'divider-' + msg.id,
            date_label: get_date_label(d),
          })
          last_date_str = date_str
        }

        items.push({
          type: 'message',
          key: 'msg-' + msg.id,
          message: msg,
        })
      }

      return items
    },
    /**
     * true mientras Claude genera sugerencia para el lead abierto (automática o manual).
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
     * Teléfono del lead solo con dígitos (formato requerido por api.whatsapp.com).
     * @returns {string}
     */
    lead_phone_digits() {
      const rec = this.effective_record
      const raw = rec && rec.phone != null ? String(rec.phone).trim() : ''
      return raw.replace(/\D/g, '')
    },
    /**
     * Enlace para abrir el chat de WhatsApp con el lead; vacío si no hay teléfono usable.
     * @returns {string}
     */
    lead_whatsapp_url() {
      const digits = this.lead_phone_digits
      if (!digits) {
        return ''
      }
      return 'https://api.whatsapp.com/send?phone=' + digits
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
     * Firma del último mensaje saliente del setter o sugerencia ya enviada.
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
     * true si hay mensajes del lead sin respuesta del setter tras el último envío saliente.
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
     * true si se puede pedir sugerencia a Claude manualmente (mismas reglas que el backend).
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
     * Tooltip del botón "Pedir respuesta" según por qué está habilitado o deshabilitado.
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
     * true mientras corre el debounce antes de pedir sugerencia automática a Claude.
     *
     * @returns {boolean}
     */
    show_ai_consult_countdown() {
      if (this.parent_active_tab !== 'extra:conversation') {
        return false
      }
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
    record: {
      immediate: true,
      handler(val, old_val) {
        if (!val || !val.id) {
          return
        }
        this.merge_lead_into_conversation_store(val)
        const id_changed = !old_val || old_val.id != val.id
        if (id_changed) {
          this.ai_auto_consult_cancelled = false
          this.cancelling_auto_consult = false
          this.$store.commit('lead/set_ai_generating_lead_id', null)
        }
        if (this.parent_active_tab === 'extra:conversation') {
          if (id_changed) {
            this.load_conversation_if_needed(true)
          } else {
            /** Borrador actualizado (p. ej. fetch del modal): reintentar marcar leídos si ahora hay contador. */
            this.try_mark_whatsapp_messages_read()
          }
        }
      },
    },
    /**
     * Al entrar a la pestaña Conversación, carga mensajes y marca alertas.
     * @param {string|null} tab
     */
    parent_active_tab(tab) {
      if (tab === 'extra:conversation') {
        this.load_conversation_if_needed(true)
        this.try_mark_followup_suggestion_seen()
        this.try_mark_whatsapp_messages_read()
        this.schedule_scroll_to_bottom()
        this.sync_countdown_clock()
      } else {
        this.stop_countdown_clock()
      }
    },
    /**
     * Al terminar el análisis de Claude, bajar el scroll para ver la sugerencia nueva.
     * @param {boolean} newVal
     * @param {boolean} oldVal
     */
    /**
     * Al terminar la generación automática o manual, bajar el scroll para ver la sugerencia.
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
     * Cualquier cambio en mensajes (alta, aprobar, rechazar) mantiene el foco al final del hilo.
     */
    conversation_messages_signature() {
      this.schedule_scroll_to_bottom()
      this.sync_manual_ai_suggestion_state()
      this.sync_countdown_clock()
    },
  },
  mounted() {
    const self = this
    this.load_ai_suggestion_settings()
    this.sync_manual_ai_suggestion_state()
    this.sync_countdown_clock()
    this.$nextTick(function () {
      self.schedule_scroll_to_bottom()
    })
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
     * Oculta mensajes espurios creados antes de soportar reacciones (texto "Reacted with … to message wamid.…").
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
     * @param {Object} val Registro del modal o de la API.
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
     * Carga el lead completo con `messages` desde la API (el listado/Pusher no incluye el hilo).
     *
     * @param {boolean} force Si true, ignora el cooldown corto entre GET del mismo lead.
     * @returns {void}
     */
    load_conversation_if_needed(force) {
      const self = this
      const rec = this.effective_record
      if (!rec || !rec.id) {
        return
      }
      if (
        !force
        && rec.messages_scope === 'full'
        && rec.messages
        && rec.messages.length
      ) {
        return
      }
      if (this.loading_conversation) {
        return
      }
      const now_ms = Date.now()
      const same_lead = this.last_conversation_fetch_lead_id == rec.id
      const cooldown_ms = 3000
      if (!force && same_lead && now_ms - this.last_conversation_fetch_ms < cooldown_ms) {
        return
      }
      this.loading_conversation = true
      this.$store
        .dispatch('lead/fetch_lead_for_conversation', rec.id)
        .then(function (model) {
          self.loading_conversation = false
          self.last_conversation_fetch_ms = Date.now()
          self.last_conversation_fetch_lead_id = rec.id
          self.$emit('record-updated', model)
          /** Tras GET con unread_count fresco: marcar leídos si el intento al cambiar de pestaña fue demasiado pronto. */
          self.try_mark_whatsapp_messages_read()
          self.schedule_scroll_to_bottom()
        })
        .catch(function () {
          self.loading_conversation = false
        })
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
     * Quita el badge de la tabla si el lead tiene seguimiento sin ver y la pestaña está activa.
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
          self.$emit('record-updated', model)
        })
        .catch(function () {
          self.marking_followup_seen = false
        })
    },
    /**
     * Marca como leídos los mensajes entrantes del lead al abrir la pestaña de conversación.
     *
     * @returns {void}
     */
    /**
     * Mayor contador de no leídos entre borrador del modal y lead en store (per-usuario).
     *
     * @param {Object|null|undefined} record_row Fila o borrador del modal.
     * @param {Object|null|undefined} conv_row Lead abierto en Vuex.
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
     * Marca como leídos los mensajes entrantes del lead al abrir la pestaña de conversación.
     *
     * @returns {void}
     */
    try_mark_whatsapp_messages_read() {
      const self = this
      const rec = this.effective_record
      if (!rec || !rec.id) {
        return
      }
      if (this.parent_active_tab !== 'extra:conversation') {
        return
      }
      /** Contador per-usuario: unread_count y unread_messages_count son alias del mismo withCount. */
      const conv = this.$store.state.lead.lead_en_conversacion
      const unread = this.resolve_effective_unread_count(this.record, conv && conv.id == rec.id ? conv : null)
      if (unread < 1) {
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
          self.$emit('record-updated', model)
        })
        .catch(function () {
          self.marking_whatsapp_read = false
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
          self.$emit('record-updated', model)
          self.schedule_scroll_to_bottom()
        })
        .catch(function () {
          self.enviando_directo = false
        })
    },
    /**
     * Simula un mensaje entrante del lead (testing) sin pasar por WhatsApp.
     * Dispara en el backend el mismo flujo que el webhook real (sugerencia IA con debounce).
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
          self.$emit('record-updated', model)
          self.schedule_scroll_to_bottom()
        })
        .catch(function () {
          self.enviando_simulado = false
        })
    },
    /**
     * Fuerza el seguimiento que corresponde al lead ahora mismo (testing), sin esperar
     * el tiempo configurado ni estar bloqueado por una sugerencia pendiente.
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
          self.$emit('record-updated', data.model)
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
     * Activa o desactiva la suscripción WhatsApp del admin autenticado para este lead.
     * El backend inserta/elimina la fila en lead_admin_notifications según el estado solicitado.
     *
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
          /* Fusiona is_notified_by_me desde la respuesta del backend sobre el registro actual. */
          self.$emit('record-updated', Object.assign({}, rec, {
            is_notified_by_me: res.data.notificar_mensajes
          }))
        })
        .catch(function (error) {
          self.toggling_notify = false
          console.error('Error al actualizar notificaciones del lead', error)
        })
    },
    /**
     * GET settings/lead-whatsapp-onboarding para conocer la demora de debounce IA.
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
     * Actualiza el timestamp del último inbound del lead y reinicia bypass si llegó mensaje nuevo.
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
     * Arranca o detiene el reloj local cuando hay countdowns visibles en la pestaña.
     *
     * @returns {void}
     */
    sync_countdown_clock() {
      const needs_clock =
        this.parent_active_tab === 'extra:conversation' &&
        (this.show_ai_consult_countdown || this.has_active_auto_send_countdown)
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
          self.$emit('record-updated', model)
          self.sync_countdown_clock()
        })
        .catch(function () {
          self.cancelling_auto_consult = false
        })
    },
    /**
     * Pide sugerencia a Claude de inmediato (sin esperar el debounce automático).
     * Tras generarla, el backend programa el envío automático por WhatsApp como siempre.
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
          self.$emit('record-updated', model)
          self.schedule_scroll_to_bottom()
          self.sync_countdown_clock()
        })
        .catch(function () {
          /* ai_error queda en store para el alert rojo. */
        })
    },
    /**
     * Activa o desactiva la respuesta automática de Claude para el lead de esta conversación.
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
          self.$emit('record-updated', model)
          self.sync_countdown_clock()
        })
        .catch(function () {
          self.toggling_claude_auto_reply = false
        })
    },
    /**
     * Envía por WhatsApp la sugerencia de Claude sin modificar el texto.
     *
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
          self.$emit('record-updated', model)
          self.schedule_scroll_to_bottom()
        })
        .catch(function () {
          self.busy_message_id = null
        })
    },
    /**
     * Guarda el texto editado y lo envía por WhatsApp.
     *
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
          self.$emit('record-updated', model)
          self.schedule_scroll_to_bottom()
        })
        .catch(function () {
          self.busy_message_id = null
        })
    },
    /**
     * Cancela el envío automático de una sugerencia y la marca como no enviada.
     *
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
          self.$emit('record-updated', model)
          self.sync_countdown_clock()
        })
        .catch(function () {
          self.busy_message_id = null
        })
    },
    /**
     * Alterna si el mensaje se incluye o excluye del historial enviado a Claude.
     * Marca el mensaje como ocupado durante la petición para deshabilitar los botones.
     *
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
          self.$emit('record-updated', model)
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
  },
}
</script>

<style scoped>
/* Más alto en pantalla: aprovecha el alto del viewport dentro del modal. */
.conversation-scroll {
  display: flex;
  flex-direction: column;
  min-height: 280px;
  max-height: min(62vh, calc(100vh - 170px));
  overflow-y: auto;
  border-color: rgba(11, 20, 26, 0.08) !important;
}

/* Botón cuadrado con icono WhatsApp. */
.lead-wa-open-btn {
  width: 2rem;
  height: 2rem;
  padding: 0;
}

/* Área de redacción manual: multilínea; Enter no envía. */
.lead-direct-compose {
  width: 100%;
}
.lead-direct-textarea {
  flex: 1 1 auto;
  min-height: 4.5rem;
  resize: vertical;
  line-height: 1.35;
}

/* Divisor de fecha estilo WhatsApp */
.wa-date-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0.6rem 0 0.4rem;
  pointer-events: none;
  user-select: none;
}
.wa-date-divider-label {
  font-size: 0.72rem;
  font-weight: 500;
  color: #54656f;
  background: #e1f3fb;
  border-radius: 7px;
  padding: 0.18rem 0.65rem;
  box-shadow: 0 1px 0.5px rgba(11, 20, 26, 0.13);
  letter-spacing: 0.01em;
  white-space: nowrap;
}
</style>
