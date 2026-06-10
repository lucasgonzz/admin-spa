<template>
  <div v-if="effective_record && effective_record.id" class="lead-conversation-tab">
    <p class="text-muted small">
      Los mensajes automáticos de bienvenida y presentación se envían solos al primer contacto.
      Cuando el lead responde, Claude sugiere una respuesta: revisala y usá <strong>Enviar</strong> o
      <strong>Editar</strong> → <strong>Guardar y enviar</strong> para mandarla por WhatsApp.
      Para identificar al lead, conviene tener cargado su teléfono en la ficha.
    </p>

    <div v-if="has_pending_followup_suggestion" class="alert alert-info py-2 small mb-2">
      <i class="bi bi-clock-history me-1" aria-hidden="true" />
      Hay una <strong>sugerencia de seguimiento automático</strong> por inactividad del lead. Revisá el mensaje marcado en la conversación.
    </div>

    <div v-if="ai_error" class="alert alert-danger py-2 small mb-2">{{ ai_error }}</div>

    <div
      v-if="show_ai_consult_countdown"
      class="alert alert-secondary py-2 small mb-2 d-flex align-items-center gap-2 lead-ai-timer-alert"
    >
      <i class="bi bi-stars" aria-hidden="true" />
      <span>
        Sugerencia IA automática en
        <strong>{{ ai_consult_remaining_seconds }}</strong>
        s
      </span>
    </div>

    <div ref="conversation_scroll_box" class="conversation-scroll border rounded p-2 mb-3 bg-light">
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
        @enviar="on_enviar_sugerencia(msg.id)"
        @guardar_y_enviar="on_guardar_y_enviar_sugerencia(msg.id, $event)"
      />
    </div>

    <div class="mb-2">
      <label class="form-label small text-muted">Nuevos mensajes del chat (WhatsApp)</label>
      <textarea
        v-model="nuevo_mensaje"
        class="form-control"
        rows="5"
        placeholder="Pegá el bloque copiado desde WhatsApp (varios mensajes del lead y/o del setter)…"
      />
    </div>
    <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap">
      <div class="d-flex align-items-center gap-2 flex-wrap">
        <button
          type="button"
          class="btn btn-primary btn-sm d-inline-flex align-items-center gap-2"
          :disabled="loading_ai || !has_paste_text"
          @click="on_add_message"
        >
          <template v-if="loading_ai">
            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
            <span>Enviando a Claude</span>
          </template>
          <template v-else> Agregar mensajes y pedir sugerencia </template>
        </button>
        <button
          v-if="show_request_ai_suggestion_button"
          type="button"
          class="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-2"
          :disabled="loading_ai || !can_request_manual_ai_suggestion"
          :title="request_ai_suggestion_button_title"
          @click="on_request_ai_suggestion"
        >
          <span
            v-if="loading_ai"
            class="spinner-border spinner-border-sm"
            role="status"
            aria-hidden="true"
          />
          <i v-else class="bi bi-stars" aria-hidden="true" />
          <span>Pedir sugerencia a Claude</span>
        </button>
      </div>
      <a
        v-if="lead_whatsapp_url"
        :href="lead_whatsapp_url"
        target="_blank"
        rel="noopener noreferrer"
        class="btn btn-success btn-sm d-inline-flex align-items-center justify-content-center lead-wa-open-btn"
        title="Abrir WhatsApp con el lead"
        aria-label="Abrir WhatsApp con el lead"
      >
        <i class="bi bi-whatsapp" aria-hidden="true" />
      </a>
      <button
        v-else
        type="button"
        class="btn btn-outline-secondary btn-sm d-inline-flex align-items-center justify-content-center lead-wa-open-btn"
        disabled
        title="Cargá el teléfono del lead para abrir WhatsApp"
        aria-label="WhatsApp (sin teléfono del lead)"
      >
        <i class="bi bi-whatsapp" aria-hidden="true" />
      </button>
    </div>
  </div>
  <div v-else class="text-muted small">Guardá el lead primero para habilitar la conversación.</div>
</template>

<script>
import MessageBubble from './MessageBubble.vue'
import api from '@/utils/axios'

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
      /** Texto pegado del chat (uno o varios mensajes lead/setter). */
      nuevo_mensaje: '',
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
      /** Tras un pedido manual exitoso, no exigir de nuevo el debounce automático. */
      manual_ai_suggestion_bypass_debounce: false,
      /** Intervalo que actualiza now_tick para los countdown visibles. */
      now_tick_interval_id: null,
      /** Timestamp actual (ms) para countdown de debounce y auto-envío. */
      now_tick: Date.now(),
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
        return Object.assign({}, this.record, conv)
      }
      return this.record
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
      return copy
    },
    loading_ai() {
      return this.$store.state.lead.loading_ai
    },
    ai_error() {
      return this.$store.state.lead.ai_error
    },
    /**
     * true si el textarea tiene texto para enviar (el botón se deshabilita aparte durante loading_ai).
     * @returns {boolean}
     */
    has_paste_text() {
      return (this.nuevo_mensaje || '').trim() !== ''
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
      if (this.lead_inbound_message_count <= 1) {
        return false
      }
      if (!this.has_unanswered_lead_messages) {
        return false
      }
      if (this.has_pending_non_followup_suggestion) {
        return false
      }
      if (this.manual_ai_suggestion_bypass_debounce) {
        return false
      }
      if (this.loading_ai) {
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
      const list = this.sorted_messages
      let i = 0
      for (i = 0; i < list.length; i++) {
        const m = list[i]
        if (m.sender !== 'sistema' || m.status !== 'sugerido' || m.is_followup || m.requiere_verificacion) {
          continue
        }
        if (!m.ai_auto_send_at) {
          continue
        }
        const ends_at = new Date(m.ai_auto_send_at).getTime()
        if (!isNaN(ends_at) && ends_at > this.now_tick) {
          return true
        }
      }
      return false
    },
    /**
     * Muestra el botón cuando hay mensajes sin responder y ya venció el debounce automático
     * (o el setter ya pidió sugerencia manual en el mismo turno de conversación).
     *
     * @returns {boolean}
     */
    show_request_ai_suggestion_button() {
      if (this.lead_inbound_message_count <= 1) {
        return false
      }
      if (!this.has_unanswered_lead_messages) {
        return false
      }
      if (this.has_pending_non_followup_suggestion) {
        return false
      }
      return this.manual_ai_suggestion_bypass_debounce || this.ai_suggestion_debounce_elapsed
    },
    /**
     * Habilita el pedido manual: debounce cumplido o bypass tras un pedido previo en el mismo turno.
     *
     * @returns {boolean}
     */
    can_request_manual_ai_suggestion() {
      if (!this.has_unanswered_lead_messages) {
        return false
      }
      if (this.has_pending_non_followup_suggestion) {
        return false
      }
      if (this.manual_ai_suggestion_bypass_debounce) {
        return true
      }
      return this.ai_suggestion_debounce_elapsed
    },
    /**
     * Tooltip del botón según si falta esperar el debounce automático.
     *
     * @returns {string}
     */
    request_ai_suggestion_button_title() {
      if (this.can_request_manual_ai_suggestion) {
        return 'Pedir sugerencia a Claude sin esperar el timer automático'
      }
      if (!this.ai_suggestion_debounce_elapsed) {
        return 'Esperá a que venza la demora automática antes de pedir sugerencia'
      }
      if (this.has_pending_non_followup_suggestion) {
        return 'Revisá o enviá la sugerencia pendiente antes de pedir otra'
      }
      return 'Pedir sugerencia a Claude'
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
        if (id_changed && this.parent_active_tab === 'extra:conversation') {
          this.load_conversation_if_needed(true)
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
    loading_ai(newVal, oldVal) {
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
    outbound_messages_signature(new_val, old_val) {
      if (old_val !== undefined && new_val !== old_val) {
        this.manual_ai_suggestion_bypass_debounce = false
      }
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
  },
  methods: {
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
    try_mark_whatsapp_messages_read() {
      const self = this
      const rec = this.effective_record
      if (!rec || !rec.id) {
        return
      }
      const unread = parseInt(rec.unread_messages_count, 10)
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
          self.$emit('record-updated', model)
        })
        .catch(function () {
          self.marking_whatsapp_read = false
        })
    },
    /**
     * Envía el bloque pegado al backend (varios mensajes posibles) y refresca el modelo en el modal.
     * @returns {void}
     */
    on_add_message() {
      const self = this
      const id = this.effective_record.id
      const text = (this.nuevo_mensaje || '').trim()
      if (!text) {
        return
      }
      this.$store
        .dispatch('lead/store_message', { lead_id: id, content: text })
        .then(function (model) {
          self.nuevo_mensaje = ''
          self.manual_ai_suggestion_bypass_debounce = false
          self.$emit('record-updated', model)
          self.schedule_scroll_to_bottom()
        })
        .catch(function () {
          /* toast global vía axios */
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
        this.manual_ai_suggestion_bypass_debounce = false
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
     * Pide sugerencia a Claude sobre el hilo ya cargado (sin pegar mensajes nuevos).
     *
     * @returns {void}
     */
    on_request_ai_suggestion() {
      const self = this
      const rec = this.effective_record
      if (!rec || !rec.id || !this.can_request_manual_ai_suggestion) {
        return
      }
      this.$store
        .dispatch('lead/request_ai_suggestion', rec.id)
        .then(function (model) {
          self.manual_ai_suggestion_bypass_debounce = true
          self.$emit('record-updated', model)
          self.schedule_scroll_to_bottom()
        })
        .catch(function () {
          /* toast global vía axios; ai_error en store */
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
  },
}
</script>

<style scoped>
/* Más alto en pantalla: aprovecha el alto del viewport dentro del modal. */
.conversation-scroll {
  min-height: 280px;
  max-height: min(62vh, calc(100vh - 170px));
  overflow-y: auto;
}

/* Botón cuadrado con icono WhatsApp alineado a la derecha de la fila de acciones. */
.lead-wa-open-btn {
  width: 2rem;
  height: 2rem;
  padding: 0;
}
</style>
