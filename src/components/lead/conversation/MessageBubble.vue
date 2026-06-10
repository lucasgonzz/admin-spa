<template>
  <div class="wa-bubble-row d-flex flex-column" :class="bubble_column_align">
    <div class="wa-meta text-muted">{{ sender_label }} · {{ formatted_time }}</div>
    <div class="wa-bubble border" :class="bubble_style_class">
      <div v-if="is_followup_suggestion" class="wa-extra mb-1">
        <span class="badge bg-warning text-dark wa-badge-tight">
          <i class="bi bi-clock-history me-1" aria-hidden="true" />
          Seguimiento
        </span>
      </div>
      <div
        v-if="is_audio_message && !has_local_attachment"
        class="wa-audio-missing text-muted small mb-1">
        🎤 Audio recibido — transcripción abajo. El archivo aún no está en el servidor.
      </div>
      <!-- Reproductor de audio (mismo patrón que soporte) -->
      <template v-if="has_local_attachment">
        <audio
          v-if="is_audio_message"
          controls
          :src="attachment_url(message.attachments[0])"
          class="wa-message-audio"
          preload="metadata">
          Tu navegador no soporta reproducción de audio.
        </audio>
        <a
          v-else
          :href="attachment_url(message.attachments[0])"
          target="_blank"
          rel="noopener noreferrer"
          class="wa-attachment-link small">
          Ver adjunto
        </a>
      </template>
      <!-- Modo lectura: transcripción / texto (original o editado tras aprobar) -->
      <div v-if="!editing && show_message_text" class="message-text">{{ effective_content }}</div>
      <!-- Modo edición: textarea precargado con el content original de la sugerencia -->
      <textarea
        v-else
        v-model="edited_text"
        class="form-control form-control-sm wa-edit-textarea"
        rows="4"
        :disabled="busy"
      />
      <div v-if="pipeline_status_change_label" class="wa-extra mt-1">
        <span class="badge bg-info text-dark wa-badge-tight" :title="pipeline_status_change_title">
          {{ pipeline_status_change_label }}
        </span>
      </div>
      <div v-if="message.requiere_verificacion" class="wa-extra mt-1">
        <span class="badge bg-warning text-dark wa-badge-tight">Requiere verificación con Lucas</span>
      </div>
      <div v-if="message.ai_reasoning" class="wa-extra mt-1">
        <button type="button" class="btn btn-link wa-link-tight p-0" @click="toggle_reasoning">
          {{ show_reasoning ? 'Ocultar' : 'Ver' }} razonamiento
        </button>
        <div v-show="show_reasoning" class="wa-reasoning text-muted border-top mt-1 pt-1">
          {{ message.ai_reasoning }}
        </div>
      </div>
      <div v-if="show_pending_suggestion_actions" class="wa-actions d-flex flex-wrap gap-1 align-items-center">
        <template v-if="!editing">
          <button
            type="button"
            class="btn btn-success btn-sm wa-btn-tight"
            :disabled="busy || !has_sendable_text"
            @click="on_enviar"
          >
            Enviar
          </button>
          <button type="button" class="btn btn-outline-primary btn-sm wa-btn-tight" :disabled="busy" @click="on_start_edit">
            Editar
          </button>
        </template>
        <template v-else>
          <button
            type="button"
            class="btn btn-success btn-sm wa-btn-tight"
            :disabled="busy || !has_edited_text_for_send"
            @click="on_guardar_y_enviar"
          >
            Guardar y enviar
          </button>
          <button type="button" class="btn btn-outline-secondary btn-sm wa-btn-tight" :disabled="busy" @click="on_cancel_edit">
            Cancelar
          </button>
        </template>
      </div>
      <div v-if="show_pending_confirmation_label" class="wa-pending-confirmation text-muted">
        <template v-if="show_auto_send_countdown">
          Envío automático en <strong>{{ auto_send_remaining_seconds }}</strong> s
        </template>
        <template v-else>Esperando confirmación</template>
      </div>
      <div
        v-if="show_sending_indicator"
        class="wa-message-meta d-flex align-items-center justify-content-end mt-1"
      >
        <span class="wa-meta-sending text-muted small" aria-label="Enviando">Enviando…</span>
      </div>
      <div v-if="show_whatsapp_delivery_error" class="wa-delivery-error text-danger small mt-1">
        No enviado por WhatsApp
      </div>
      <div
        v-if="show_whatsapp_sent_meta"
        class="wa-message-meta d-flex align-items-center justify-content-end mt-1"
      >
        <span class="wa-meta-delivery" :title="whatsapp_delivery_title">
          <i class="bi bi-whatsapp wa-meta-whatsapp-icon" aria-hidden="true" />
          <i class="bi bi-check2-all wa-tick-double" aria-hidden="true" />
        </span>
      </div>
      <div v-if="status_badge_text" class="wa-extra mt-1">
        <span class="badge wa-badge-tight" :class="status_badge_class">{{ status_badge_text }}</span>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * Burbuja de mensaje de la conversación WhatsApp (lead, setter, sistema / IA).
 */
export default {
  name: 'LeadMessageBubble',
  emits: ['enviar', 'guardar_y_enviar'],
  props: {
    /** Fila `lead_messages` desde la API. */
    message: { type: Object, required: true },
    /** true mientras corre aprobar/rechazar para este ítem. */
    busy: { type: Boolean, default: false },
    /** Timestamp actual (ms) del padre para countdown de auto-envío. */
    now_tick: { type: Number, default: 0 },
  },
  data() {
    return {
      /** Controla panel colapsable del razonamiento de Claude. */
      show_reasoning: false,
      /** true cuando el setter está editando una sugerencia antes de enviar. */
      editing: false,
      /** Texto en edición (precargado con content original). */
      edited_text: '',
    }
  },
  computed: {
    /**
     * Columna alineada como WhatsApp Web: lead (entrante) a la izquierda; cloud/saliente a la derecha.
     * @returns {string}
     */
    bubble_column_align() {
      if (this.message.sender === 'lead') {
        return 'align-items-start'
      }
      return 'align-items-end'
    },
    /**
     * Estilo de fondo según emisor + esquinas tipo burbuja entrante (izq.) / saliente (der.).
     * @returns {string}
     */
    bubble_style_class() {
      if (this.message.sender === 'lead') {
        return 'bg-primary bg-opacity-10 border-primary wa-bubble--in'
      }
      if (this.message.sender === 'setter') {
        return 'bg-light wa-bubble--out'
      }
      if (this.is_followup_suggestion) {
        return 'bg-warning bg-opacity-10 border-warning wa-bubble--out wa-bubble--followup'
      }
      return 'bg-white wa-bubble--out'
    },
    /**
     * true si el mensaje fue generado por el chequeo automático de inactividad.
     * @returns {boolean}
     */
    is_followup_suggestion() {
      return Boolean(this.message.is_followup)
    },
    /**
     * Etiqueta legible del emisor.
     * @returns {string}
     */
    sender_label() {
      const s = this.message.sender
      if (s === 'lead') {
        if (this.is_audio_message) {
          return 'Lead · audio'
        }
        return 'Lead'
      }
      if (s === 'setter') {
        return 'Setter'
      }
      if (s === 'sistema') {
        if (this.is_followup_suggestion) {
          return 'Sistema / IA (seguimiento)'
        }
        return 'Sistema / IA'
      }
      return s || '—'
    },
    /**
     * Fecha/hora corta para cabecera de burbuja.
     * @returns {string}
     */
    formatted_time() {
      const raw = this.message.created_at
      if (!raw) {
        return ''
      }
      try {
        const d = new Date(raw)
        if (isNaN(d.getTime())) {
          return String(raw)
        }
        return d.toLocaleString('es-AR')
      } catch (e) {
        return String(raw)
      }
    },
    /**
     * Texto a mostrar y copiar: edited_content si existe, sino content.
     * @returns {string}
     */
    effective_content() {
      const edited = ((this.message.edited_content || '') + '').trim()
      if (edited !== '') {
        return edited
      }
      return (this.message.content || '') + ''
    },
    /**
     * true si el mensaje fue aprobado con texto distinto al sugerido original.
     * @returns {boolean}
     */
    was_sent_with_adjustment() {
      const edited = ((this.message.edited_content || '') + '').trim()
      return edited !== ''
    },
    /**
     * Etiqueta del cambio de estado sugerido por Claude en este mensaje.
     * @returns {string}
     */
    pipeline_status_change_label() {
      const label = (this.message.suggested_lead_status_label || '') + ''
      if (label.trim() === '') {
        return ''
      }
      return 'Cambio de estado: ' + label.trim()
    },
    /**
     * Tooltip con slug del estado sugerido (depuración / soporte).
     * @returns {string}
     */
    pipeline_status_change_title() {
      const slug = (this.message.suggested_lead_status || '') + ''
      if (slug.trim() === '') {
        return ''
      }
      return 'Estado sugerido: ' + slug.trim()
    },
    /**
     * true si el mensaje es saliente (setter o sistema / cloud).
     * @returns {boolean}
     */
    is_outgoing_message() {
      return this.message.sender === 'setter' || this.message.sender === 'sistema'
    },
    /**
     * Leyenda bajo Enviar / Editar mientras la sugerencia de Claude no se envió.
     * @returns {boolean}
     */
    show_pending_confirmation_label() {
      if (this.busy) {
        return false
      }
      return this.message.sender === 'sistema' && this.message.status === 'sugerido'
    },
    /**
     * Mientras el setter confirma el envío (request en curso).
     * @returns {boolean}
     */
    show_sending_indicator() {
      if (!this.busy) {
        return false
      }
      return this.message.sender === 'sistema' && this.message.status === 'sugerido'
    },
    /**
     * Doble check de entrega WhatsApp (mismo criterio que tickets de soporte).
     * @returns {boolean}
     */
    show_whatsapp_sent_meta() {
      if (!this.is_outgoing_message) {
        return false
      }
      if (this.message.status !== 'enviado') {
        return false
      }
      return !!this.message.whatsapp_message_id
    },
    /**
     * Mensaje saliente marcado enviado pero sin id de Meta/Kapso.
     * @returns {boolean}
     */
    show_whatsapp_delivery_error() {
      if (!this.is_outgoing_message) {
        return false
      }
      if (this.message.status !== 'enviado') {
        return false
      }
      return !this.message.whatsapp_message_id
    },
    /**
     * Tooltip del check de WhatsApp.
     * @returns {string}
     */
    whatsapp_delivery_title() {
      return 'Enviado por WhatsApp al lead'
    },
    /**
     * Badge solo para estados excepcionales (p. ej. rechazado).
     * @returns {string}
     */
    status_badge_text() {
      const st = this.message.status
      if (st === 'rechazado') {
        return 'Rechazado'
      }
      return ''
    },
    /**
     * Clase Bootstrap del badge según estado (naranja si hubo ajuste).
     * @returns {string}
     */
    status_badge_class() {
      if (this.message.status === 'aprobado' && this.was_sent_with_adjustment) {
        return 'bg-warning text-dark'
      }
      return 'bg-secondary'
    },
    /**
     * Acciones Enviar / Editar para sugerencias de Claude aún no enviadas por WhatsApp.
     * @returns {boolean}
     */
    show_pending_suggestion_actions() {
      if (this.message.sender !== 'sistema') {
        return false
      }
      return this.message.status === 'sugerido'
    },
    /**
     * Timestamp ISO del envío automático programado (null si no aplica).
     *
     * @returns {number}
     */
    auto_send_at_ms() {
      const raw = this.message.ai_auto_send_at
      if (!raw) {
        return 0
      }
      const parsed = new Date(raw).getTime()
      if (isNaN(parsed)) {
        return 0
      }
      return parsed
    },
    /**
     * true si la sugerencia tiene timer de envío automático aún vigente.
     *
     * @returns {boolean}
     */
    show_auto_send_countdown() {
      if (!this.show_pending_suggestion_actions) {
        return false
      }
      if (this.is_followup_suggestion) {
        return false
      }
      if (this.message.requiere_verificacion) {
        return false
      }
      const ends_at = this.auto_send_at_ms
      if (!ends_at) {
        return false
      }
      return ends_at > this.now_tick
    },
    /**
     * Segundos restantes hasta el envío automático por WhatsApp.
     *
     * @returns {number}
     */
    auto_send_remaining_seconds() {
      if (!this.show_auto_send_countdown) {
        return 0
      }
      const remaining_ms = this.auto_send_at_ms - this.now_tick
      if (remaining_ms <= 0) {
        return 0
      }
      return Math.ceil(remaining_ms / 1000)
    },
    /**
     * Texto no vacío para enviar sin editar.
     * @returns {boolean}
     */
    has_sendable_text() {
      return ((this.message.content || '') + '').trim() !== ''
    },
    /**
     * Texto no vacío en el textarea de edición.
     * @returns {boolean}
     */
    has_edited_text_for_send() {
      return (this.edited_text || '').trim() !== ''
    },
    /**
     * true si el mensaje tiene adjunto persistido en admin-api.
     * @returns {boolean}
     */
    has_local_attachment() {
      return !!(this.message.attachments && this.message.attachments.length)
    },
    /**
     * Audio de WhatsApp: kind audio/ptt/voice o mime del adjunto.
     * @returns {boolean}
     */
    is_audio_message() {
      const kind = ((this.message.kind || '') + '').toLowerCase()
      if (kind === 'audio' || kind === 'ptt' || kind === 'voice') {
        return true
      }
      const att = this.message.attachments && this.message.attachments[0]
      if (att && att.mime && String(att.mime).indexOf('audio/') === 0) {
        return true
      }
      return false
    },
    /**
     * Muestra el bloque de texto salvo placeholders vacíos en audio solo con reproductor.
     * @returns {boolean}
     */
    show_message_text() {
      return ((this.effective_content || '') + '').trim() !== ''
    },
  },
  watch: {
    /**
     * Al cambiar el mensaje (refresh desde API), salir del modo edición.
     */
    'message.id'() {
      this.editing = false
      this.edited_text = ''
    },
    'message.status'() {
      this.editing = false
      this.edited_text = ''
    },
  },
  methods: {
    /**
     * Alterna visibilidad del bloque de razonamiento.
     * @returns {void}
     */
    toggle_reasoning() {
      this.show_reasoning = !this.show_reasoning
    },
    /**
     * Activa modo edición con el content original de la sugerencia.
     * @returns {void}
     */
    on_start_edit() {
      this.editing = true
      this.edited_text = (this.message.content || '') + ''
    },
    /**
     * Sale del modo edición sin aprobar.
     * @returns {void}
     */
    on_cancel_edit() {
      this.editing = false
      this.edited_text = ''
    },
    /**
     * Envía la sugerencia tal como la generó Claude.
     * @returns {void}
     */
    on_enviar() {
      this.$emit('enviar')
    },
    /**
     * Envía el texto editado en el textarea.
     * @returns {void}
     */
    on_guardar_y_enviar() {
      const text = (this.edited_text || '').trim()
      if (!text) {
        return
      }
      this.$emit('guardar_y_enviar', text)
    },
    /**
     * URL pública del adjunto en admin-api (/storage/...).
     *
     * @param {Object} attachment Fila lead_message_attachments.
     * @returns {string}
     */
    attachment_url(attachment) {
      let base_url = import.meta.env.VITE_BACKEND_BASE_URL || ''
      if (!base_url) {
        const api_url = import.meta.env.VITE_API_URL || ''
        if (api_url) {
          base_url = api_url.replace(/\/api\/admin\/?$/i, '')
        }
      }
      return base_url.replace(/\/$/, '') + '/storage/' + attachment.path
    },
  },
}
</script>

<style scoped>
/* Burbujas compactas estilo WhatsApp (tipografía chica, poco padding). */
.wa-bubble-row {
  margin-bottom: 0.35rem;
  max-width: 100%;
}
.wa-meta {
  font-size: 0.65rem;
  line-height: 1.15;
  opacity: 0.82;
  margin-bottom: 2px;
  padding: 0 1px;
}
.wa-bubble {
  max-width: min(92%, 440px);
  font-size: 1rem;
  line-height: 1.38;
  padding: 0.32rem 0.55rem;
  border-radius: 8px;
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.06);
}
/* Entrante (lead): cola inferior izquierda. */
.wa-bubble--in {
  border-bottom-left-radius: 3px;
}
/* Saliente (setter / sistema / cloud): cola inferior derecha. */
.wa-bubble--out {
  border-bottom-right-radius: 3px;
}
.wa-bubble--followup {
  border-width: 2px;
}
.message-text {
  white-space: pre-wrap;
  word-break: break-word;
}
.wa-message-audio {
  display: block;
  width: 100%;
  max-width: 280px;
  height: 36px;
  margin-bottom: 0.25rem;
}
.wa-attachment-link {
  display: inline-block;
  margin-bottom: 0.25rem;
}
.wa-edit-textarea {
  font-size: 1rem;
  line-height: 1.38;
  resize: vertical;
  min-height: 4rem;
}
.wa-extra {
  font-size: 1rem;
}
.wa-link-tight {
  font-size: 0.7rem;
}
.wa-reasoning {
  font-size: 1rem;
  line-height: 1.3;
  max-height: 120px;
  overflow-y: auto;
}
.wa-actions {
  margin-top: 0.35rem;
}
.wa-btn-tight.btn-sm {
  font-size: 0.9rem;
  padding: 0.1rem 0.42rem;
  line-height: 1.2;
}
.wa-badge-tight {
  font-size: 0.9rem;
  font-weight: 500;
  padding: 0.15em 0.45em;
}
.wa-pending-confirmation {
  font-size: 0.75rem;
  line-height: 1.2;
  margin-top: 0.25rem;
  font-style: italic;
}
.wa-message-meta {
  font-size: 0.8rem;
  line-height: 1;
}
.wa-meta-sending {
  font-style: italic;
  animation: wa-sending-pulse 1.2s ease-in-out infinite;
}
@keyframes wa-sending-pulse {
  0%,
  100% {
    opacity: 0.45;
  }
  50% {
    opacity: 1;
  }
}
.wa-meta-delivery {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: #9ca3af;
  white-space: nowrap;
}
.wa-meta-whatsapp-icon {
  color: #25d366;
  font-size: 0.95rem;
}
.wa-tick-double {
  font-size: 1.05rem;
  color: #5a5f66;
}
.wa-delivery-error {
  font-size: 0.75rem;
}
</style>
