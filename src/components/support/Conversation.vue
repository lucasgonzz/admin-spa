<template>
  <div class="support-conversation">
    <div class="support-conversation-body" ref="conversation_body">
      <div
        v-if="loading"
        class="support-conversation-loading d-flex align-items-center justify-content-center"
        role="status"
        aria-live="polite"
        aria-busy="true">
        <span class="spinner-border text-primary" aria-hidden="true"></span>
        <span class="visually-hidden">Cargando mensajes…</span>
      </div>
      <template v-else>
      <div
        v-for="message in messages"
        :key="message_key(message)"
        :class="['support-message-row', message.sender_type == 'admin' ? 'mine' : 'their']">
        <div class="support-message-col">
          <border-progress-wrap
            :active="is_ai_draft_auto_send_active(message)"
            :duration_seconds="ai_draft_total_seconds(message)"
            :elapsed_seconds="ai_draft_elapsed_seconds(message)"
            :animation_key="ai_draft_animation_key(message)"
            variant="bubble">
            <div
              :class="[
                'support-message-bubble',
                has_delivery_error(message) ? 'support-message-bubble--error' : '',
                is_ai_draft_message(message) ? 'support-message-bubble--ai-draft' : '',
              ]"
              :title="message_sent_at_tooltip(message)">
              <div
                v-if="message.body && !should_hide_body_for_remote_image(message)"
                class="support-message-text">
                {{ message.body }}
              </div>
            <!-- Imagen remota (Kapso) cuando no hay adjunto local -->
            <template
              v-if="message.kind === 'image' && remote_image_url_from_message(message) && !has_local_attachment(message)">
              <button
                type="button"
                class="support-message-image-btn"
                title="Ver imagen en grande"
                @click="open_image_preview(remote_image_url_from_message(message))">
                <img
                  :src="remote_image_url_from_message(message)"
                  class="support-message-image"
                  alt="Imagen de WhatsApp"
                  @error="on_remote_image_error" />
              </button>
              <a
                :href="remote_image_url_from_message(message)"
                target="_blank"
                rel="noopener noreferrer"
                class="support-message-remote-link small">
                Abrir imagen
              </a>
            </template>
            <!-- Renderizado diferenciado según tipo de adjunto -->
            <template v-if="has_local_attachment(message)">
              <!-- Reproductor inline para mensajes de audio -->
              <audio
                v-if="message.kind === 'audio'"
                controls
                :src="attachment_url(message.attachments[0])"
                class="support-message-audio"
                preload="metadata">
                Tu navegador no soporta reproducción de audio.
              </audio>
              <!-- Miniatura: abre visor en la misma página -->
              <button
                v-else-if="message.kind === 'image'"
                type="button"
                class="support-message-image-btn"
                title="Ver imagen en grande"
                @click="open_image_preview(attachment_url(message.attachments[0]))">
                <img
                  :src="attachment_url(message.attachments[0])"
                  class="support-message-image"
                  alt="Imagen adjunta" />
              </button>
              <!-- Fallback genérico para otros tipos de adjunto -->
              <a
                v-else
                :href="attachment_url(message.attachments[0])"
                target="_blank">
                Ver adjunto
              </a>
            </template>
            <div
              v-if="message.kind === 'image' && !has_local_attachment(message) && !remote_image_url_from_message(message) && !message.body"
              class="support-message-placeholder text-muted">
              [Imagen]
            </div>
            </div>
          </border-progress-wrap>
          <div
            v-if="is_mine(message) && has_delivery_error(message)"
            class="support-message-error-row">
            <span class="support-message-error-text">{{ delivery_error_label(message) }}</span>
            <button
              type="button"
              class="btn btn-sm btn-outline-danger support-message-retry-btn"
              @click="$emit('retry-message', message)">
              Reintentar
            </button>
          </div>
          <div
            v-else-if="is_mine(message) && is_last_mine_message(message)"
            class="support-message-meta">
            <span
              v-if="message._client_pending"
              class="support-meta-sending"
              aria-label="Enviando">Enviando…</span>
            <template v-else>
              <span
                v-if="message.whatsapp_message_id"
                class="support-meta-whatsapp"
                title="Enviado por WhatsApp">
                <i class="bi bi-whatsapp" aria-hidden="true"></i>
              </span>
              <span
                v-if="message.read_at"
                class="support-meta-read">Visto a las {{ format_read_time(message.read_at) }}</span>
              <span
                v-else-if="show_delivery_tick(message)"
                class="support-meta-delivery"
                :title="delivery_remote_title(message)">
                <i
                  v-if="message.synced_to_client_at"
                  class="bi bi-check2-all support-tick-double"></i>
                <i
                  v-else
                  class="bi bi-check2 support-tick-single"></i>
              </span>
            </template>
          </div>
        </div>
      </div>
      <div
        ref="scroll_end_anchor"
        class="support-conversation-scroll-end"
        aria-hidden="true" />
      </template>
    </div>

    <image-lightbox
      :show="image_preview_visible"
      :image_url="image_preview_url"
      @update:show="image_preview_visible = $event"
      @close="on_image_preview_close" />
  </div>
</template>

<script>
import ImageLightbox from '@/components/common/ImageLightbox.vue'
import BorderProgressWrap from '@/components/support/BorderProgressWrap.vue'

export default {
  name: 'SupportConversation',
  components: {
    ImageLightbox,
    BorderProgressWrap,
  },
  props: {
    messages: { type: Array, default: () => [] },
    /**
     * GET de mensajes del ticket (antes de rellenar el hilo).
     */
    loading: { type: Boolean, default: false },
    /**
     * Origen del ticket (erp | whatsapp): define checks y textos de error de entrega.
     */
    ticket_source: { type: String, default: null },
    /** Timestamp reactivo para animaciones de auto-envío en borradores IA. */
    now_tick: { type: Number, default: 0 },
  },
  data() {
    return {
      /** Visor de imagen ampliada abierto. */
      image_preview_visible: false,
      /** URL de la imagen mostrada en el visor. */
      image_preview_url: '',
    }
  },
  /**
   * Al montar, posiciona al final (ticket ya cargado o carga inmediata).
   */
  mounted() {
    this.schedule_scroll_to_bottom()
  },
  watch: {
    /**
     * deep: el store muta el mismo array (push/splice); sin deep el watcher no corre.
     */
    messages: {
      deep: true,
      handler() {
        this.schedule_scroll_to_bottom()
      },
    },
    /**
     * Al terminar de cargar, alinea el scroll con el final del hilo.
     */
    loading: {
      handler(value) {
        if (!value) {
          this.schedule_scroll_to_bottom()
        }
      },
    },
  },
  methods: {
    /**
     * Indica si el mensaje es borrador IA pendiente de envío automático.
     *
     * @param {Object} message
     * @returns {boolean}
     */
    is_ai_draft_message(message) {
      return !!(message && message.is_ai_suggestion_draft)
    },
    /**
     * Activa animación de borde en borrador IA hasta ai_auto_send_at.
     *
     * @param {Object} message
     * @returns {boolean}
     */
    is_ai_draft_auto_send_active(message) {
      if (!this.is_ai_draft_message(message) || !message.ai_auto_send_at) {
        return false
      }
      const ends_at = new Date(message.ai_auto_send_at).getTime()
      return !isNaN(ends_at) && ends_at > this.now_tick
    },
    /**
     * Duración total del timer de auto-envío del borrador (segundos).
     *
     * @param {Object} message
     * @returns {number}
     */
    ai_draft_total_seconds(message) {
      if (!message || !message.ai_auto_send_at) {
        return 0
      }
      const ends_at = new Date(message.ai_auto_send_at).getTime()
      const starts_at = message.created_at ? new Date(message.created_at).getTime() : NaN
      if (isNaN(ends_at) || isNaN(starts_at) || ends_at <= starts_at) {
        return 0
      }
      return (ends_at - starts_at) / 1000
    },
    /**
     * Segundos transcurridos del timer de auto-envío (reanuda animación al abrir ticket).
     *
     * @param {Object} message
     * @returns {number}
     */
    ai_draft_elapsed_seconds(message) {
      if (!message || !message.created_at) {
        return 0
      }
      const starts_at = new Date(message.created_at).getTime()
      if (isNaN(starts_at)) {
        return 0
      }
      const elapsed = (this.now_tick - starts_at) / 1000
      const total = this.ai_draft_total_seconds(message)
      if (total <= 0) {
        return 0
      }
      return Math.min(elapsed, total)
    },
    /**
     * Key estable del borrador para reiniciar animación si cambia ai_auto_send_at.
     *
     * @param {Object} message
     * @returns {string}
     */
    ai_draft_animation_key(message) {
      if (!message || message.id == null) {
        return '0'
      }
      return String(message.id) + '-' + String(message.ai_auto_send_at || '')
    },
    /**
     * Clave para v-for: id persistido o token de optimista.
     */
    message_key(message) {
      if (message.id != null) {
        return 'm-' + message.id
      }
      if (message._client_pending) {
        return 'p-' + message._client_pending
      }
      return 'x-' + String(Math.random())
    },
    /**
     * Burbuja del operador (incluye fila en envío).
     */
    is_mine(message) {
      return message.sender_type == 'admin'
    },
    /**
     * @param {Object} message
     * @returns {boolean}
     */
    has_local_attachment(message) {
      return !!(message.attachments && message.attachments.length)
    },
    /**
     * Extrae URL https del body (texto Kapso) para previsualizar sin adjunto local.
     *
     * @param {Object} message
     * @returns {string|null}
     */
    remote_image_url_from_message(message) {
      if (!message || !message.body) {
        return null
      }
      const text = String(message.body)
      let match = text.match(/URL:\s*(https?:\/\/\S+)/i)
      if (match && match[1]) {
        return match[1].replace(/[.,;)"']+$/, '')
      }
      match = text.match(/(https?:\/\/[^\s\])"'<>]+)/i)
      if (match && match[1]) {
        return match[1].replace(/[.,;)"']+$/, '')
      }
      return null
    },
    /**
     * Si hay miniatura remota, no repetir el bloque de texto largo de Kapso.
     *
     * @param {Object} message
     * @returns {boolean}
     */
    should_hide_body_for_remote_image(message) {
      if (message.kind !== 'image') {
        return false
      }
      if (this.has_local_attachment(message)) {
        return false
      }
      return !!this.remote_image_url_from_message(message)
    },
    /**
     * Oculta img rota si la URL de Kapso no es accesible desde el navegador.
     */
    on_remote_image_error(event) {
      if (event && event.target) {
        event.target.style.display = 'none'
      }
    },
    /**
     * Visto / checks / "Enviando": solo bajo el último mensaje del operador (orden en el hilo).
     */
    is_last_mine_message(message) {
      const list = this.messages
      if (!list || !list.length) {
        return false
      }
      let last = null
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].sender_type == 'admin') {
          last = list[i]
          break
        }
      }
      if (!last) {
        return false
      }
      if (message.id != null && last.id != null) {
        return String(message.id) === String(last.id)
      }
      if (message._client_pending && last._client_pending) {
        return message._client_pending === last._client_pending
      }
      return last === message
    },
    /**
     * Tooltip: un check = local; doble = confirmado por empresa-api del cliente.
     */
    delivery_remote_title(message) {
      if (this.ticket_source === 'whatsapp') {
        return 'Enviado por WhatsApp al cliente'
      }
      if (message.synced_to_client_at) {
        return 'Recibido por el sistema del cliente (empresa-api)'
      }
      return 'Guardado en admin; pendiente de entrega a empresa-api'
    },
    /**
     * Muestra el ícono de check solo cuando la entrega remota fue exitosa.
     *
     * @param {Object} message
     * @returns {boolean}
     */
    show_delivery_tick(message) {
      if (this.has_delivery_error(message)) {
        return false
      }
      if (this.ticket_source === 'whatsapp') {
        return !!message.whatsapp_message_id
      }
      return true
    },
    /**
     * Fallo de POST a admin-api o de replica hacia empresa-api.
     * @param {Object} message
     * @returns {boolean}
     */
    has_delivery_error(message) {
      if (message.is_ai_suggestion_draft) {
        return false
      }
      if (message._delivery_error === 'not_sent') {
        return true
      }
      if (message.remote_delivery_status === 'not_received') {
        return true
      }
      // WhatsApp: sin meta id de Kapso el mensaje no llegó al cliente (incluye fallos previos al flag en API).
      if (
        this.ticket_source === 'whatsapp' &&
        message.sender_type === 'admin' &&
        !message._client_pending &&
        message.id != null &&
        !message.whatsapp_message_id
      ) {
        return true
      }
      return false
    },
    /**
     * Etiqueta visible junto al botón de reintento.
     * @param {Object} message
     * @returns {string}
     */
    delivery_error_label(message) {
      if (message._delivery_error === 'not_sent') {
        return 'No enviado'
      }
      if (this.ticket_source === 'whatsapp' && !message.whatsapp_message_id) {
        return 'No enviado por WhatsApp'
      }
      if (message.remote_delivery_status === 'not_received') {
        return 'No recibido en empresa-api del cliente'
      }
      return 'Error de entrega'
    },
    /**
     * Hora:minuto local para leyenda de visto.
     */
    format_read_time(value) {
      if (!value) {
        return ''
      }
      const d = new Date(value)
      if (isNaN(d.getTime())) {
        return ''
      }
      const h = d.getHours()
      const m = d.getMinutes()
      return h + ':' + (m < 10 ? '0' : '') + m
    },
    /**
     * Fecha y hora local de envío para tooltip al hover (ISO desde API).
     *
     * @param {string} value created_at o delivered_at en formato parseable por Date.
     * @returns {string} Texto vacío si no hay fecha válida.
     */
    format_sent_datetime(value) {
      if (!value) {
        return ''
      }
      const d = new Date(value)
      if (isNaN(d.getTime())) {
        return ''
      }
      const pad = function (n) {
        return (n < 10 ? '0' : '') + n
      }
      return (
        pad(d.getDate()) +
        '/' +
        pad(d.getMonth() + 1) +
        '/' +
        d.getFullYear() +
        ' ' +
        pad(d.getHours()) +
        ':' +
        pad(d.getMinutes())
      )
    },
    /**
     * Leyenda nativa (atributo title) al pasar el mouse sobre la burbuja.
     *
     * @param {Object} message Fila de mensaje del hilo.
     * @returns {string}
     */
    message_sent_at_tooltip(message) {
      if (message._client_pending && !message.created_at) {
        return 'Enviando…'
      }
      const raw = message.created_at || message.delivered_at
      const formatted = this.format_sent_datetime(raw)
      if (!formatted) {
        return ''
      }
      return 'Enviado el ' + formatted
    },
    /**
     * URL pública del adjunto en admin-api (/storage/...).
     * No usar el origen del dev server (Vite :8002): sin base correcta el navegador recibe index.html (text/html).
     * Prioridad: VITE_BACKEND_BASE_URL; si no está, se deriva de VITE_API_URL quitando /api/admin.
     *
     * @param {Object} attachment Fila support_message_attachments con path relativo al disco public.
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
    /**
     * Abre el visor de imagen en la misma página.
     *
     * @param {string} url URL pública del adjunto.
     */
    open_image_preview(url) {
      if (!url) {
        return
      }
      this.image_preview_url = url
      this.image_preview_visible = true
    },
    /**
     * Limpia la URL al cerrar el visor.
     */
    on_image_preview_close() {
      this.image_preview_url = ''
    },
    /**
     * Diferir scroll: DOM y layout; doble rAF atasca contenido que aún mide 0 p. ej. fuentes.
     */
    schedule_scroll_to_bottom() {
      const self = this
      this.$nextTick(function () {
        self.scroll_bottom()
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            self.scroll_bottom()
          })
        })
      })
    },
    /**
     * Ancla al pie del hilo (scrollTop + scrollIntoView en el ancla) para asegurar tope.
     */
    scroll_bottom() {
      const container = this.$refs.conversation_body
      if (container) {
        container.scrollTop = container.scrollHeight
      }
      const anchor = this.$refs.scroll_end_anchor
      if (anchor && typeof anchor.scrollIntoView === 'function') {
        anchor.scrollIntoView({ block: 'end', inline: 'nearest' })
      }
    },
  },
}
</script>

<style scoped>
/*
  Contenedor en columna: el bloque central (support-right-middle) es flex;
  la cuerpo con overflow hace scroll; el conjunto ocupa verticalmente el espacio restante.
 */
.support-conversation {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  height: 100%;
  width: 100%;
}

.support-conversation-body {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  background: #f5f7fb;
  padding: 12px;
  position: relative;
}

/* Ocupa el área scroll mientras se espera el GET de la conversación. */
.support-conversation-loading {
  position: absolute;
  inset: 0;
  z-index: 2;
  min-height: 8rem;
  background: rgba(245, 247, 251, 0.92);
}

/* Marcador cero altura; scrollIntoView alinea el scroll al final del hilo. */
.support-conversation-scroll-end {
  height: 0;
  width: 0;
  overflow: hidden;
}

.support-message-row {
  display: flex;
  margin-bottom: 8px;
}

.support-message-row.mine {
  justify-content: flex-end;
}

.support-message-row.their {
  justify-content: flex-start;
}

.support-message-col {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  max-width: 80%;
}

.support-message-row.their .support-message-col {
  align-items: flex-start;
}

.support-message-bubble {
  max-width: 100%;
  background: #fff;
  border: 1px solid #e6e6e6;
  border-radius: 10px;
  padding: 8px 10px;
  cursor: help;
}

.support-message-row.mine .support-message-bubble {
  background: #dff7df;
}

.support-message-bubble--ai-draft {
  background: #eef6ff !important;
  border-style: dashed;
}

.support-message-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #6c757d;
  margin-top: 2px;
  padding-right: 2px;
  line-height: 1.2;
}

.support-message-row.their .support-message-meta {
  padding-left: 2px;
}

.support-meta-sending {
  display: inline-block;
  animation: support-sending-pulse 1s ease-in-out infinite;
}

@keyframes support-sending-pulse {
  0%,
  100% {
    opacity: 0.45;
  }
  50% {
    opacity: 1;
  }
}

.support-meta-delivery {
  color: #9ca3af;
  white-space: nowrap;
}

.support-meta-whatsapp {
  color: #25d366;
  margin-right: 4px;
  font-size: 0.95rem;
  line-height: 1;
  vertical-align: middle;
}

.support-tick-single {
  font-size: 1rem;
}

.support-tick-double {
  font-size: 1.05rem;
  color: #5a5f66;
}

.support-meta-read {
  color: #6c757d;
}

.support-message-bubble--error {
  background: #fde8e8 !important;
  border-color: #e53e3e !important;
}

.support-message-error-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
  font-size: 12px;
}

.support-message-error-text {
  color: #c53030;
  font-weight: 600;
}

.support-message-retry-btn {
  padding: 0 8px;
  font-size: 11px;
  line-height: 1.4;
}

/* Reproductor de audio compacto dentro de la burbuja */
.support-message-audio {
  display: block;
  max-width: 260px;
  width: 100%;
  height: 36px;
  margin-top: 2px;
}

/* Botón sin estilo que envuelve la miniatura */
.support-message-image-btn {
  display: block;
  padding: 0;
  margin: 0;
  border: none;
  background: transparent;
  line-height: 0;
  cursor: pointer;
}

.support-message-image-btn:focus {
  outline: 2px solid #0d6efd;
  outline-offset: 2px;
  border-radius: 6px;
}

/* Miniatura de imagen; clic abre visor en la misma página */
.support-message-image {
  display: block;
  max-width: 220px;
  max-height: 180px;
  border-radius: 6px;
  margin-top: 4px;
  object-fit: cover;
  cursor: pointer;
}

.support-message-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.support-message-remote-link {
  display: inline-block;
  margin-top: 4px;
}

.support-message-placeholder {
  font-size: 13px;
}
</style>
