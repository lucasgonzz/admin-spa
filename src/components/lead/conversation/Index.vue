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
    },
    /**
     * Cualquier cambio en mensajes (alta, aprobar, rechazar) mantiene el foco al final del hilo.
     */
    conversation_messages_signature() {
      this.schedule_scroll_to_bottom()
    },
  },
  mounted() {
    const self = this
    this.$nextTick(function () {
      self.schedule_scroll_to_bottom()
    })
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
      let merged = val
      if (prev && prev.id == val.id) {
        merged = Object.assign({}, prev, val)
        if (prev.messages && prev.messages.length && (!val.messages || !val.messages.length)) {
          merged.messages = prev.messages
        }
      }
      this.$store.commit('lead/set_lead_en_conversacion', merged)
    },
    /**
     * Carga el lead completo con `messages` desde la API (el listado/Pusher no incluye el hilo).
     *
     * @param {boolean} force Si true, ignora el cooldown corto entre GET del mismo lead.
     * @returns {void}
     */
    load_conversation_if_needed(force) {
      const self = this
      const rec = this.record
      if (!rec || !rec.id) {
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
          self.$emit('record-updated', model)
          self.schedule_scroll_to_bottom()
        })
        .catch(function () {
          /* toast global vía axios */
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
