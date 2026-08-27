<template>
  <div class="support-input-bar">
    <!-- Editor de anotaciones sobre imagen (pegado o adjunto) antes de enviar -->
    <image-annotation-editor
      :show="image_editor_visible"
      :source_file="image_editor_source_file"
      @update:show="image_editor_visible = $event"
      @confirm="on_image_annotation_confirm"
      @cancel="on_image_annotation_cancel" />

    <!-- Los cuatro avisos de acá abajo quedan AFUERA de la fila del composer a propósito: son de
         alto variable y adentro la partirían en dos renglones. -->
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
    <!-- Una sola fila: campo de texto y los cuatro botones -->
    <div class="support-input-composer">
      <textarea
        ref="textarea"
        class="form-control support-input-textarea"
        rows="1"
        placeholder="Escribir mensaje..."
        :disabled="!can_send"
        v-model="body"
        @input="ajustar_alto"
        @paste="on_paste"
        @keydown.enter.exact.prevent="emit_send" />
      <input ref="file_input" class="d-none" type="file" accept="audio/*,image/*" @change="on_file_change" />
      <!-- Botón de grabación: rojo mientras graba; muestra tiempo en tooltip -->
      <button
        type="button"
        :class="[
          'btn btn-sm support-input-icon-btn',
          audio_recording ? 'btn-danger support-input-icon-btn--recording' : 'btn-outline-secondary',
        ]"
        :disabled="!can_send"
        :title="audio_closing
          ? 'Cerrando la grabación…'
          : (audio_recording ? ('Detener grabación (' + audio_elapsed_label + ')') : 'Grabar audio')"
        :aria-label="audio_closing
          ? 'Cerrando la grabación…'
          : (audio_recording ? ('Detener grabación (' + audio_elapsed_label + ')') : 'Grabar audio')"
        @click="on_audio_click"
        @mousedown="on_audio_mousedown"
        @mouseup="on_audio_mouseup_or_leave"
        @mouseleave="on_audio_mouseup_or_leave"
        @touchstart.prevent="on_audio_touchstart"
        @touchend.prevent="on_audio_touchend"
        @touchcancel.prevent="on_audio_touchcancel">
        <span
          v-if="audio_closing"
          class="spinner-border spinner-border-sm"
          role="status"
          aria-hidden="true" />
        <i v-else-if="audio_recording" class="bi bi-stop-fill" aria-hidden="true" />
        <i v-else class="bi bi-mic" aria-hidden="true" />
        <span v-if="audio_recording" class="support-input-recording-time">
          {{ audio_closing ? 'Cerrando…' : audio_elapsed_label }}
        </span>
      </button>
      <!-- Sólo mientras graba: cancelar sin enviar (grupo 323, prompt 04). NO se esconde
           mientras cierra: es la única salida que tiene la pantalla si el grabador se queda
           colgado. Ver el comentario largo en LeadConversationView.vue. -->
      <button
        v-if="audio_recording"
        type="button"
        class="btn btn-link btn-sm text-muted support-input-cancel-btn"
        title="Cancelar grabación"
        aria-label="Cancelar grabación"
        @click="cancel_audio_recording">
        Cancelar
      </button>
      <button
        type="button"
        class="btn btn-outline-secondary btn-sm support-input-icon-btn"
        :disabled="!can_send || audio_recording"
        title="Adjuntar archivo"
        aria-label="Adjuntar archivo"
        @click="open_file_input">
        <i class="bi bi-paperclip" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="btn btn-success btn-sm support-input-icon-btn support-input-icon-btn--send"
        :disabled="!can_send || audio_recording"
        title="Enviar mensaje"
        aria-label="Enviar mensaje"
        @click="emit_send">
        <i class="bi bi-send-fill" aria-hidden="true" />
      </button>
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
import ImageAnnotationEditor from '@/components/common/ImageAnnotationEditor.vue'
import { OggOpusRecorder } from '@/utils/oggOpusRecorder'
import audio_recorder_button from '@/mixins/audio_recorder_button'

export default {
  name: 'SupportMessageInput',
  components: {
    ImageAnnotationEditor,
  },
  mixins: [audio_recorder_button],
  emits: ['send-message'],
  props: {
    can_send: { type: Boolean, default: true },
    /** ISO8601 del envío automático programado (null si no hay timer). */
    ai_suggestion_send_at: { type: String, default: null },
    /** Motivo por el que falló la última sugerencia IA (la pide el header). */
    suggestion_error: { type: String, default: '' },
    /** Razonamiento devuelto por Claude en la última sugerencia. */
    ai_reasoning: { type: String, default: '' },
  },
  data() {
    return {
      /** Texto pendiente de envío. */
      body: '',
      /** Panel colapsable del razonamiento visible. */
      reasoning_visible: false,
      /** Tope de renglones antes de que el textarea deje de crecer y aparezca el scroll. */
      max_renglones: 8,
      /** Archivo adjunto temporal (File). */
      attachment: null,
      /** Modal de marcas sobre imagen visible. */
      image_editor_visible: false,
      /** Imagen en edición antes de confirmar adjunto. */
      image_editor_source_file: null,
      /** true si no se puede grabar (contexto inseguro, permiso o API ausente). */
      mic_error: false,
      /** Texto del aviso rojo según el motivo del fallo. */
      mic_error_message: '',
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
  watch: {
    /**
     * Abre el panel de razonamiento cuando llega uno nuevo, y lo pliega cuando se limpia.
     *
     * El razonamiento ahora lo trae el padre, así que el plegado no se puede resolver dentro del
     * método que pide la sugerencia: hay que reaccionar al texto que baja.
     *
     * @param {string} texto Razonamiento nuevo.
     * @returns {void}
     */
    ai_reasoning(texto) {
      this.reasoning_visible = !!texto
    },
  },
  mounted() {
    this.ajustar_alto()
  },
  methods: {
    /**
     * Ajusta el alto del textarea al contenido, hasta ocho renglones. A partir de ahí aparece
     * el scroll interno y el footer deja de crecer.
     *
     * El tope se calcula con el line-height real y no con un alto fijo en píxeles: con el zoom
     * del navegador cambiado, un tope duro corta a la mitad del séptimo renglón o deja crecer
     * hasta doce.
     *
     * @returns {void}
     */
    ajustar_alto() {
      const el = this.$refs.textarea
      if (!el) {
        return
      }
      const estilo = window.getComputedStyle(el)
      /* getComputedStyle devuelve "normal" en algunos navegadores: ahí se deriva del tamaño de
         fuente con el 1.5 que usa Bootstrap, y como último recurso 20px. */
      let alto_renglon = parseFloat(estilo.lineHeight)
      if (isNaN(alto_renglon) || alto_renglon <= 0) {
        alto_renglon = (parseFloat(estilo.fontSize) || 13.33) * 1.5
      }
      const relleno = (parseFloat(estilo.paddingTop) || 0) + (parseFloat(estilo.paddingBottom) || 0)
      /* El borde entra en la cuenta porque el textarea es border-box: scrollHeight no lo incluye
         y asignar height sin sumarlo deja el último renglón cortado. */
      const borde = (parseFloat(estilo.borderTopWidth) || 0) + (parseFloat(estilo.borderBottomWidth) || 0)
      const tope = alto_renglon * this.max_renglones + relleno + borde

      el.style.height = 'auto'
      const deseado = el.scrollHeight + borde
      el.style.height = Math.min(deseado, tope) + 'px'
      el.style.overflowY = deseado > tope ? 'auto' : 'hidden'
    },

    /**
     * Vuelca un texto en el input y lo deja del alto que le corresponda.
     *
     * Lo llama Support.vue por ref cuando vuelve una sugerencia IA. Es una llamada y no un prop
     * porque un prop habría que "des-setear" para poder volcar dos veces el mismo texto.
     *
     * @param {string} texto Texto a dejar en el input.
     * @returns {void}
     */
    set_body(texto) {
      const self = this
      this.body = texto == null ? '' : String(texto)
      this.$nextTick(function () {
        self.ajustar_alto()
      })
    },

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
     * Hook del contrato de audio_recorder_button: llega con el Blob 'audio/ogg' ya listo. Igual
     * que hacía antes el onData del botón que alternaba grabar/cortar.
     *
     * @param {Blob} blob
     * @returns {void}
     */
    on_audio_blob(blob) {
      this.attachment = new File([blob], 'audio_' + Date.now() + '.ogg', { type: 'audio/ogg' })
    },

    /**
     * Hook del contrato de audio_recorder_button: además de decidir si se puede grabar, este
     * guard es el único punto por el que pasa cada intento de grabación -- por eso también
     * actualiza el aviso visible (mic_error/mic_error_message), igual que hacía antes el arranque
     * del botón que alternaba grabar/cortar.
     *
     * @returns {boolean}
     */
    can_record_audio() {
      if (!this.microphone_available || !OggOpusRecorder.isSupported()) {
        this.mic_error = true
        this.mic_error_message = this.build_mic_unavailable_message()
        return false
      }
      this.mic_error = false
      this.mic_error_message = ''
      return true
    },

    /**
     * Hook del contrato de audio_recorder_button.
     *
     * El cartel depende de la fase: mandar a alguien a revisar los permisos del micrófono cuando
     * el micrófono anduvo bien y lo que falló fue el cierre es peor que no decirle nada.
     *
     * @param {string} message
     * @param {'arranque'|'cierre'} fase
     * @returns {void}
     */
    on_audio_error(message, fase) {
      console.warn('[SupportChat] error al grabar audio:', message)
      this.mic_error = true
      this.mic_error_message = fase === 'cierre'
        ? 'No se pudo cerrar la grabación. Probá de nuevo o usá Adjuntar.'
        : 'Sin acceso al micrófono. Verificá los permisos del navegador o usá Adjuntar.'
    },
    /**
     * Emite mensaje al padre con tipo detectado por mime.
     */
    emit_send() {
      if (!this.body && !this.attachment) {
        return
      }
      const self = this
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
      this.reasoning_visible = false
      this.$refs.file_input.value = ''
      /* Con el texto ya vaciado el textarea tiene que volver a un renglón; si no, el footer se
         queda del alto que tenía el mensaje que se acaba de mandar. */
      this.$nextTick(function () {
        self.ajustar_alto()
      })
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

/* Una sola fila: campo de texto y los cuatro botones, alineados al pie para que al crecer el
   textarea los botones queden pegados al último renglón, como en WhatsApp. */
.support-input-composer {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  flex-wrap: nowrap;
  gap: 6px;
}

.support-input-textarea {
  /* flex: 1 1 auto + min-width: 0 es lo que deja que el textarea se achique cuando el botón de
     audio se ensancha para mostrar el tiempo y aparece el Cancelar al lado. Sin el min-width: 0
     el textarea se niega a bajar de su ancho de contenido y la fila se parte en dos renglones. */
  flex: 1 1 auto;
  min-width: 0;
  /* Arranca en un renglón; ajustar_alto() lo lleva hasta ocho. resize: none porque el alto lo
     maneja el componente: la manija del navegador pelearía con él. */
  resize: none;
  overflow-y: hidden;
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

/* El "Cancelar" es el único botón sin ancho fijo: sin esto la fila lo achica y le parte el texto. */
.support-input-cancel-btn {
  flex-shrink: 0;
  white-space: nowrap;
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
