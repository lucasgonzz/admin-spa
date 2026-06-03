<template>
  <div class="support-input-bar">
    <!-- Editor de anotaciones sobre imagen (pegado o adjunto) antes de enviar -->
    <image-annotation-editor
      :show="image_editor_visible"
      :source_file="image_editor_source_file"
      @update:show="image_editor_visible = $event"
      @confirm="on_image_annotation_confirm"
      @cancel="on_image_annotation_cancel" />

    <!-- Indicador de adjunto pendiente: nombre del archivo y botón para cancelarlo -->
    <div v-if="attachment" class="support-input-attachment-preview">
      <span class="support-input-attachment-icon">
        {{ attachment_is_audio ? '🎤' : attachment_is_image ? '🖼' : '📎' }}
      </span>
      <span class="support-input-attachment-name text-truncate">{{ attachment.name }}</span>
      <button
        v-if="attachment_is_image"
        type="button"
        class="btn btn-sm btn-link support-input-attachment-edit"
        title="Volver a marcar la imagen"
        @click="open_image_editor_for_attachment">
        Editar
      </button>
      <button
        type="button"
        class="btn btn-sm btn-link support-input-attachment-remove"
        title="Quitar adjunto"
        @click="remove_attachment">
        ✕
      </button>
    </div>
    <!-- Aviso cuando el navegador deniega el permiso de micrófono -->
    <div v-if="mic_error" class="support-input-mic-error">
      {{ mic_error_message }}
    </div>
    <div v-if="pending_send_at_label" class="alert alert-info py-1 px-2 small mb-2">
      Sugerencia IA lista. Envío automático: {{ pending_send_at_label }}
    </div>
    <div v-if="suggestion_error" class="support-input-suggestion-error">
      {{ suggestion_error }}
    </div>
    <div class="support-input-composer">
      <textarea
        class="form-control support-input-textarea"
        rows="3"
        placeholder="Escribir mensaje..."
        :disabled="!can_send"
        v-model="body"
        @paste="on_paste"
        @keydown.enter.exact.prevent="emit_send" />
      <input ref="file_input" class="d-none" type="file" accept="audio/*,image/*" @change="on_file_change" />
      <!-- Botonera horizontal con iconos y tooltips -->
      <div class="support-input-toolbar">
        <div class="support-input-toolbar-actions">
          <button
            type="button"
            class="btn btn-outline-primary btn-sm support-input-icon-btn"
            :disabled="!can_send || !ticket_id || loading_suggestion"
            title="Sugerencia IA"
            aria-label="Sugerencia IA"
            @click="request_suggestion">
            <span
              v-if="loading_suggestion"
              class="spinner-border spinner-border-sm"
              role="status"
              aria-hidden="true" />
            <i v-else class="bi bi-stars" aria-hidden="true" />
          </button>
          <!-- Botón de grabación: rojo mientras graba; muestra tiempo en tooltip -->
          <button
            type="button"
            :class="[
              'btn btn-sm support-input-icon-btn',
              recording ? 'btn-danger support-input-icon-btn--recording' : 'btn-outline-secondary',
            ]"
            :disabled="!can_send"
            :title="recording ? ('Detener grabación (' + recording_time_label + ')') : 'Grabar audio'"
            :aria-label="recording ? ('Detener grabación (' + recording_time_label + ')') : 'Grabar audio'"
            @click="toggle_recording">
            <i v-if="recording" class="bi bi-stop-fill" aria-hidden="true" />
            <i v-else class="bi bi-mic" aria-hidden="true" />
            <span v-if="recording" class="support-input-recording-time">{{ recording_time_label }}</span>
          </button>
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm support-input-icon-btn"
            :disabled="!can_send || recording"
            title="Adjuntar archivo"
            aria-label="Adjuntar archivo"
            @click="open_file_input">
            <i class="bi bi-paperclip" aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          class="btn btn-success btn-sm support-input-icon-btn support-input-icon-btn--send"
          :disabled="!can_send || recording"
          title="Enviar mensaje"
          aria-label="Enviar mensaje"
          @click="emit_send">
          <i class="bi bi-send-fill" aria-hidden="true" />
        </button>
      </div>
    </div>
    <div v-if="ai_reasoning" class="support-input-reasoning mt-2">
      <button
        type="button"
        class="btn btn-link btn-sm p-0 support-input-reasoning-toggle"
        @click="reasoning_visible = !reasoning_visible">
        {{ reasoning_visible ? 'Ocultar razonamiento' : 'Ver razonamiento' }}
      </button>
      <div v-show="reasoning_visible" class="support-input-reasoning-body small text-muted mt-1">
        {{ ai_reasoning }}
      </div>
    </div>
  </div>
</template>

<script>
import ImageAnnotationEditor from '@/components/support/ImageAnnotationEditor.vue'
import api from '@/utils/axios'

export default {
  name: 'SupportMessageInput',
  components: {
    ImageAnnotationEditor,
  },
  emits: ['send-message', 'suggested-title'],
  props: {
    can_send: { type: Boolean, default: true },
    /** Id del ticket activo; necesario para POST /suggest. */
    ticket_id: { type: [Number, String], default: null },
    /** ISO8601 del envío automático programado (null si no hay timer). */
    ai_suggestion_send_at: { type: String, default: null },
  },
  data() {
    return {
      /** Texto pendiente de envío. */
      body: '',
      /** Razonamiento devuelto por Claude en la última sugerencia. */
      ai_reasoning: '',
      /** Panel colapsable del razonamiento visible. */
      reasoning_visible: false,
      /** POST suggest en curso. */
      loading_suggestion: false,
      /** Error de sugerencia IA sin bloquear el input. */
      suggestion_error: '',
      /** Archivo adjunto temporal (File). */
      attachment: null,
      /** Modal de marcas sobre imagen visible. */
      image_editor_visible: false,
      /** Imagen en edición antes de confirmar adjunto. */
      image_editor_source_file: null,
      /** true mientras MediaRecorder está activo. */
      recording: false,
      /** Instancia activa de MediaRecorder; null si no hay grabación. */
      media_recorder: null,
      /** Chunks binarios acumulados durante la grabación. */
      audio_chunks: [],
      /** true si no se puede grabar (contexto inseguro, permiso o API ausente). */
      mic_error: false,
      /** Texto del aviso rojo según el motivo del fallo. */
      mic_error_message: '',
      /** Segundos transcurridos desde que inició la grabación actual. */
      recording_seconds: 0,
      /** ID del interval que incrementa recording_seconds cada 1 s. */
      recording_timer_id: null,
    }
  },
  computed: {
    /**
     * Indica si el adjunto pendiente es audio (para el ícono del preview).
     * @returns {boolean}
     */
    attachment_is_audio() {
      return this.attachment && this.attachment.type.indexOf('audio') === 0
    },
    /**
     * Indica si el adjunto pendiente es imagen.
     * @returns {boolean}
     */
    attachment_is_image() {
      return this.attachment && this.attachment.type.indexOf('image') === 0
    },
    /**
     * Etiqueta legible del envío automático pendiente.
     *
     * @returns {string}
     */
    pending_send_at_label() {
      if (!this.ai_suggestion_send_at) {
        return ''
      }
      const date = new Date(this.ai_suggestion_send_at)
      if (isNaN(date.getTime())) {
        return ''
      }
      return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    },
    /**
     * Duración de grabación formateada como MM:SS para mostrar junto al botón.
     * @returns {string}
     */
    recording_time_label() {
      const s = this.recording_seconds
      const minutes = Math.floor(s / 60)
      const seconds = s % 60
      return (minutes < 10 ? '0' : '') + minutes + ':' + (seconds < 10 ? '0' : '') + seconds
    },
    /**
     * getUserMedia requiere contexto seguro (HTTPS, localhost, 127.0.0.1).
     * @returns {boolean}
     */
    microphone_available() {
      return !!(
        typeof navigator !== 'undefined' &&
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === 'function'
      )
    },
  },
  methods: {
    /**
     * Captura imagen pegada desde portapapeles y abre el editor de anotaciones.
     *
     * @param {ClipboardEvent} event
     */
    on_paste(event) {
      const items = event.clipboardData ? event.clipboardData.items : []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.kind == 'file' && item.type.indexOf('image/') == 0) {
          const file = item.getAsFile()
          if (file) {
            this.open_image_editor(file)
          }
          return
        }
      }
    },

    /**
     * Abre el modal para dibujar sobre la imagen antes de adjuntarla.
     *
     * @param {File} file
     */
    open_image_editor(file) {
      if (!file || file.type.indexOf('image/') !== 0) {
        return
      }
      this.image_editor_source_file = file
      this.image_editor_visible = true
    },

    /**
     * Reabre el editor con el adjunto de imagen ya confirmado.
     */
    open_image_editor_for_attachment() {
      if (this.attachment && this.attachment_is_image) {
        this.open_image_editor(this.attachment)
      }
    },

    /**
     * Recibe la imagen anotada exportada desde el modal.
     *
     * @param {File} annotated_file
     */
    on_image_annotation_confirm(annotated_file) {
      this.attachment = annotated_file
      this.image_editor_source_file = null
    },

    /**
     * Cierra el editor sin adjuntar (descarta borrador).
     */
    on_image_annotation_cancel() {
      this.image_editor_source_file = null
    },
    /**
     * Abre selector de archivos.
     */
    open_file_input() {
      this.$refs.file_input.click()
    },
    /**
     * Captura archivo seleccionado para incluirlo en payload.
     */
    on_file_change(event) {
      const files = event.target.files || []
      if (!files.length) {
        return
      }
      const file = files[0]
      /* Solo las imágenes pasan por el editor; audio y otros van directo al adjunto. */
      if (file.type.indexOf('image/') === 0) {
        this.open_image_editor(file)
      } else {
        this.attachment = file
      }
      event.target.value = ''
    },
    /**
     * Elimina el adjunto pendiente y resetea el input de archivo.
     */
    remove_attachment() {
      this.attachment = null
      this.$refs.file_input.value = ''
    },
    /**
     * Mensaje cuando el micrófono no está disponible.
     * @returns {string}
     */
    build_mic_unavailable_message() {
      if (typeof window !== 'undefined' && window.isSecureContext === false) {
        return (
          'La grabación requiere HTTPS o abrir la app en http://localhost. ' +
          'Podés usar Adjuntar para subir un audio.'
        )
      }
      return 'No se puede acceder al micrófono en este navegador. Usá Adjuntar para subir un archivo de audio.'
    },
    /**
     * Elige mime de grabación compatible con WhatsApp (prioriza OGG/Opus para nota de voz).
     *
     * @returns {string|null}
     */
    pick_recorder_mime_type() {
      if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
        return null
      }
      const candidates = [
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/webm',
      ]
      let i = 0
      for (i = 0; i < candidates.length; i = i + 1) {
        if (MediaRecorder.isTypeSupported(candidates[i])) {
          return candidates[i]
        }
      }
      return null
    },
    /**
     * Extensión de archivo según el mime del MediaRecorder.
     *
     * @param {string} mime_type
     * @returns {string}
     */
    recorder_file_extension(mime_type) {
      if (!mime_type) {
        return 'webm'
      }
      if (mime_type.indexOf('ogg') >= 0) {
        return 'ogg'
      }
      if (mime_type.indexOf('mp4') >= 0) {
        return 'm4a'
      }
      return 'webm'
    },
    /**
     * Inicia o detiene grabación de audio (OGG/Opus preferido para WhatsApp).
     * Si el navegador rechaza el permiso, muestra aviso en lugar de fallar silenciosamente.
     */
    toggle_recording() {
      const self = this
      if (this.recording && this.media_recorder) {
        this.media_recorder.stop()
        return
      }
      this.mic_error = false
      this.mic_error_message = ''
      if (!this.microphone_available) {
        this.mic_error = true
        this.mic_error_message = this.build_mic_unavailable_message()
        return
      }
      const recorder_mime = this.pick_recorder_mime_type()
      if (!recorder_mime) {
        this.mic_error = true
        this.mic_error_message = 'Tu navegador no permite grabar audio. Usá Adjuntar para subir un .ogg o .mp3.'
        return
      }
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function (stream) {
          self.audio_chunks = []
          const recorder_options = { mimeType: recorder_mime }
          self.media_recorder = new MediaRecorder(stream, recorder_options)
          self.media_recorder.ondataavailable = function (audio_event) {
            if (audio_event.data && audio_event.data.size > 0) {
              self.audio_chunks.push(audio_event.data)
            }
          }
          self.media_recorder.onstop = function () {
            /* Detener timer de duración. */
            clearInterval(self.recording_timer_id)
            self.recording_timer_id = null
            self.recording_seconds = 0

            const blob_mime = self.media_recorder.mimeType || recorder_mime
            const file_ext = self.recorder_file_extension(blob_mime)
            const audio_blob = new Blob(self.audio_chunks, { type: blob_mime })
            self.attachment = new File(
              [audio_blob],
              'audio_' + Date.now() + '.' + file_ext,
              { type: blob_mime }
            )
            self.recording = false
            stream.getTracks().forEach(function (track) {
              track.stop()
            })
          }
          /* Iniciar timer de duración visible en el botón. */
          self.recording_seconds = 0
          self.recording_timer_id = setInterval(function () {
            self.recording_seconds++
          }, 1000)

          self.recording = true
          self.media_recorder.start()
        })
        .catch(function (error) {
          console.warn('[SupportChat] getUserMedia error:', error)
          self.mic_error = true
          self.mic_error_message =
            'Sin acceso al micrófono. Verificá los permisos del navegador o usá Adjuntar.'
        })
    },
    /**
     * Solicita sugerencia IA al backend y completa el textarea.
     *
     * @returns {void}
     */
    /**
     * Completa el textarea con una sugerencia recibida por Pusher o al abrir el ticket.
     *
     * @param {string} suggestion_text Texto sugerido por Claude.
     * @returns {void}
     */
    apply_pending_suggestion(suggestion_text) {
      const text = String(suggestion_text || '').trim()
      if (text) {
        this.body = text
        this.suggestion_error = ''
      }
    },
    /**
     * Solicita sugerencia IA al backend y completa el textarea.
     *
     * @returns {void}
     */
    request_suggestion() {
      const self = this
      if (!self.ticket_id || self.loading_suggestion) {
        return
      }
      self.loading_suggestion = true
      self.suggestion_error = ''
      api
        .post('/support-ticket/' + self.ticket_id + '/suggest')
        .then(function (res) {
          const suggested = (res.data && res.data.suggested_message) || ''
          const reasoning = (res.data && res.data.reasoning) || ''
          const suggested_title = (res.data && res.data.suggested_title) || ''
          if (suggested) {
            self.body = suggested
          }
          if (suggested_title) {
            self.$emit('suggested-title', suggested_title)
          }
          self.ai_reasoning = reasoning
          self.reasoning_visible = !!reasoning
          if (!suggested && reasoning) {
            self.suggestion_error = reasoning
          }
        })
        .catch(function (err) {
          const msg =
            (err.response && err.response.data && err.response.data.message) ||
            'No se pudo obtener la sugerencia.'
          self.suggestion_error = msg
        })
        .then(function () {
          self.loading_suggestion = false
        })
    },
    /**
     * Emite mensaje al padre con tipo detectado por mime.
     */
    emit_send() {
      if (!this.body && !this.attachment) {
        return
      }
      let kind = 'text'
      if (this.attachment && this.attachment.type.indexOf('audio') == 0) {
        kind = 'audio'
      }
      if (this.attachment && this.attachment.type.indexOf('image') == 0) {
        kind = 'image'
      }
      this.$emit('send-message', {
        body: this.body,
        kind: kind,
        attachment: this.attachment,
      })
      this.body = ''
      this.attachment = null
      this.ai_reasoning = ''
      this.reasoning_visible = false
      this.suggestion_error = ''
      this.$refs.file_input.value = ''
    },
  },
}
</script>

<style scoped>
.support-input-bar {
  border-top: 1px solid #e9ecef;
  padding: 10px;
}

/* Fila compacta que muestra el archivo adjunto pendiente antes de enviar */
.support-input-attachment-preview {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  margin-bottom: 6px;
  background: #f0f4ff;
  border: 1px solid #c3d0f5;
  border-radius: 6px;
  font-size: 12px;
  color: #3a3a5c;
  max-width: 100%;
}

.support-input-attachment-icon {
  flex-shrink: 0;
}

.support-input-attachment-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.support-input-attachment-edit {
  flex-shrink: 0;
  padding: 0 4px;
  font-size: 12px;
  line-height: 1;
  text-decoration: none;
}

.support-input-attachment-remove {
  flex-shrink: 0;
  padding: 0 4px;
  color: #888;
  font-size: 12px;
  line-height: 1;
  text-decoration: none;
}

.support-input-attachment-remove:hover {
  color: #c53030;
}

/* Aviso de permiso de micrófono denegado */
.support-input-mic-error {
  padding: 4px 8px;
  margin-bottom: 6px;
  background: #fff5f5;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  font-size: 12px;
  color: #c53030;
}

/* Contenedor del textarea y la botonera debajo */
.support-input-composer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.support-input-textarea {
  width: 100%;
  min-width: 0;
  resize: vertical;
}

/* Fila de acciones: iconos a la izquierda, enviar a la derecha */
.support-input-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.support-input-toolbar-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

/* Botones cuadrados solo con icono */
.support-input-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  flex-shrink: 0;
}

.support-input-icon-btn--send {
  width: 38px;
  height: 38px;
}

/* Durante grabación el botón se ensancha para mostrar el tiempo */
.support-input-icon-btn--recording {
  width: auto;
  min-width: 34px;
  padding: 0 8px;
  gap: 4px;
}

.support-input-recording-time {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.support-input-suggestion-error {
  padding: 4px 8px;
  margin-bottom: 6px;
  background: #fff8f0;
  border: 1px solid #fbd38d;
  border-radius: 6px;
  font-size: 12px;
  color: #c05621;
}

.support-input-reasoning-toggle {
  font-size: 12px;
  text-decoration: none;
}

.support-input-reasoning-body {
  white-space: pre-wrap;
  line-height: 1.4;
  padding: 6px 8px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}
</style>

