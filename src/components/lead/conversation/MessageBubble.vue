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
      <!-- Si el contenido tiene separadores ---, se renderiza como múltiples bloques -->
      <template v-if="!editing && show_message_text">
        <div
          v-for="(part, idx) in message_parts"
          :key="idx"
          class="message-text"
          :class="[
            { 'message-text--not-sent': is_not_sent_suggestion },
            { 'mt-2 pt-2 border-top border-opacity-25': idx > 0 }
          ]"
        >
          {{ part }}
        </div>
      </template>
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
      <div v-if="show_auto_send_timer_block" class="wa-auto-send-timer mt-1">
        <div class="wa-auto-send-timer-row d-flex flex-wrap align-items-center justify-content-between gap-2">
          <span class="wa-auto-send-timer-label text-muted small">
            <template v-if="show_auto_send_countdown">
              Envío automático en <strong class="wa-auto-send-seconds">{{ auto_send_remaining_seconds }}</strong> s
            </template>
            <template v-else-if="show_auto_send_dispatching">Enviando automáticamente…</template>
          </span>
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm wa-btn-tight"
            :disabled="busy"
            title="Cancelar el envío automático por WhatsApp"
            @click="on_cancelar_envio_automatico"
          >
            Cancelar envío
          </button>
        </div>
      </div>
      <div
        v-else-if="show_pending_confirmation_label"
        class="wa-pending-confirmation text-muted">
        Esperando confirmación
      </div>
      <div v-if="is_not_sent_suggestion" class="wa-not-sent-banner text-muted small mt-1">
        <i class="bi bi-x-circle me-1" aria-hidden="true" />
        Sugerencia no enviada al lead
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
  emits: ['enviar', 'guardar_y_enviar', 'cancelar_envio_automatico'],
  props: {
    /** Fila `lead_messages` desde la API. */
    message: { type: Object, required: true },
    /** true mientras corre aprobar/rechazar para este ítem. */
    busy: { type: Boolean, default: false },
    /** Timestamp actual (ms) del padre para countdown de auto-envío. */
    now_tick: { type: Number, default: 0 },
    /** Segundos configurados antes del envío automático (fallback si falta ai_auto_send_at en el mensaje). */
    auto_send_delay_seconds: { type: Number, default: 0 },
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
      if (this.is_not_sent_suggestion) {
        return 'bg-light wa-bubble--out wa-bubble--not-sent'
      }
      return 'bg-white wa-bubble--out'
    },
    /**
     * true si la sugerencia de Claude quedó marcada como no enviada al lead.
     *
     * @returns {boolean}
     */
    is_not_sent_suggestion() {
      if (this.message.sender !== 'sistema') {
        return false
      }
      return this.message.status === 'rechazado'
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
     * Partes del mensaje partidas por el separador "\n---\n" (múltiples mensajes en uno).
     * Si no hay separador, devuelve un array de un solo elemento.
     * @returns {string[]}
     */
    message_parts() {
      const text = (this.effective_content || '') + ''
      return text
        .split(/\n---\n/)
        .map(function (p) { return p.trim() })
        .filter(function (p) { return p !== '' })
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
      if (st === 'rechazado' && this.message.sender === 'sistema') {
        return 'No enviado'
      }
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
      if (this.is_not_sent_suggestion) {
        return 'bg-secondary text-white'
      }
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
     * Timestamp efectivo del auto-envío: usa ai_auto_send_at o estima desde created_at + demora configurada.
     *
     * @returns {number}
     */
    effective_auto_send_at_ms() {
      if (this.auto_send_at_ms > 0) {
        return this.auto_send_at_ms
      }
      if (!this.show_pending_suggestion_actions) {
        return 0
      }
      if (this.is_followup_suggestion || this.message.requiere_verificacion) {
        return 0
      }
      const delay_seconds = parseInt(this.auto_send_delay_seconds, 10)
      if (isNaN(delay_seconds) || delay_seconds <= 0) {
        return 0
      }
      const raw_created = this.message.created_at
      if (!raw_created) {
        return 0
      }
      const created_ms = new Date(raw_created).getTime()
      if (isNaN(created_ms)) {
        return 0
      }
      return created_ms + delay_seconds * 1000
    },
    /**
     * true si hay envío automático programado para esta sugerencia (con o sin segundos restantes).
     *
     * @returns {boolean}
     */
    show_auto_send_timer_block() {
      if (!this.show_pending_suggestion_actions) {
        return false
      }
      if (this.is_followup_suggestion) {
        return false
      }
      if (this.message.requiere_verificacion) {
        return false
      }
      return this.effective_auto_send_at_ms > 0
    },
    show_auto_send_countdown() {
      if (!this.show_auto_send_timer_block) {
        return false
      }
      return this.effective_auto_send_at_ms > this.now_tick
    },
    /**
     * true cuando venció el timer y el job de auto-envío debería estar ejecutándose.
     *
     * @returns {boolean}
     */
    show_auto_send_dispatching() {
      if (!this.show_auto_send_timer_block) {
        return false
      }
      return this.effective_auto_send_at_ms <= this.now_tick
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
      const remaining_ms = this.effective_auto_send_at_ms - this.now_tick
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
     * Pide al padre cancelar el envío automático programado de esta sugerencia.
     *
     * @returns {void}
     */
    on_cancelar_envio_automatico() {
      this.$emit('cancelar_envio_automatico')
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
.wa-auto-send-timer {
  padding-top: 0.2rem;
  border-top: 1px dashed rgba(0, 0, 0, 0.08);
}
.wa-auto-send-timer-label {
  font-style: italic;
  line-height: 1.25;
}
.wa-auto-send-seconds {
  display: inline-block;
  min-width: 1.4rem;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.wa-bubble--not-sent {
  opacity: 0.72;
  border-style: dashed !important;
  border-color: #adb5bd !important;
}
.message-text--not-sent {
  text-decoration: line-through;
  text-decoration-color: rgba(108, 117, 125, 0.75);
}
.wa-not-sent-banner {
  font-style: italic;
  line-height: 1.25;
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

