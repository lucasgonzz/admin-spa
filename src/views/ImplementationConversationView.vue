<template>
  <!--
    Vista fullscreen de conversación WhatsApp de una implementación.
    Accesible desde /implementaciones/:implementation_id/conversacion.
    Replica el layout de LeadConversationView pero adaptado al modelo de implementaciones:
    header simplificado, burbujas inline (sin MessageBubble separado), separadores de etapa.
  -->
  <div class="conversation-view">

    <!-- ====================================================
         HEADER FIJO: botón atrás | nombre del cliente | exportar
         ==================================================== -->
    <div class="conversation-header d-flex align-items-center justify-content-between px-3 py-2 border-bottom bg-white">

      <!-- Izquierda: botón atrás + nombre del cliente -->
      <div class="d-flex align-items-center gap-2 overflow-hidden">
        <button
          type="button"
          class="icon-btn"
          title="Volver a Implementaciones"
          aria-label="Volver a Implementaciones"
          @click="$router.push({ name: 'implementations_sistema' })"
        >
          <i class="bi bi-arrow-left" aria-hidden="true" />
        </button>
        <span class="fw-semibold text-truncate conversation-lead-name">
          {{ client_name }}
        </span>
      </div>

      <!-- Derecha: botón exportar conversación con feedback verde 2s -->
      <div class="d-flex align-items-center gap-1 flex-shrink-0">
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
      </div>
    </div>

    <!-- ====================================================
         ÁREA DE MENSAJES: scroll vertical con wallpaper WhatsApp
         ==================================================== -->
    <div ref="conversation_scroll_box" class="conversation-messages whatsapp-conversation-wallpaper px-3 py-2">

      <!-- Spinner de carga inicial -->
      <div
        v-if="loading_conversation"
        class="text-muted small p-2 d-flex align-items-center gap-2"
      >
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
        Cargando conversación…
      </div>

      <!-- Sin mensajes todavía -->
      <div v-else-if="!sorted_messages.length" class="text-muted small p-2">Sin mensajes todavía.</div>

      <!-- Burbujas con divisores de fecha (sticky) y separadores de etapa -->
      <div v-else class="conversation-messages-flow">
        <div
          v-for="section in processed_message_sections"
          :key="section.key"
          class="wa-date-section"
        >
          <!-- Divisor de fecha sticky estilo WhatsApp -->
          <div v-if="section.date_label" class="wa-date-divider">
            <span class="wa-date-divider-label">{{ section.date_label }}</span>
          </div>

          <!-- Mensajes reales y marcadores de cambio de etapa mezclados -->
          <template v-for="item in section.items">

            <!-- Separador de etapa: mismo estilo que divisor de fecha -->
            <div v-if="item._is_marker" :key="item._key" class="wa-date-divider">
              <span class="wa-date-divider-label">— Etapa {{ item.stage_number }} —</span>
            </div>

            <!-- Burbuja de mensaje -->
            <div
              v-else
              :key="'msg-' + item.id"
              class="d-flex mb-2"
              :class="item.direction === 'outbound' ? 'justify-content-end' : 'justify-content-start'"
            >
              <div
                class="impl-bubble"
                :class="item.direction === 'outbound' ? 'impl-bubble--outbound' : 'impl-bubble--inbound'"
              >
                <!-- Adjunto de archivo (Document attached) -->
                <div v-if="is_file_attachment(item)" class="impl-bubble__attachment">
                  <div class="impl-bubble-file-card border rounded p-2 d-flex align-items-center gap-2">
                    <i
                      class="bi flex-shrink-0"
                      :class="file_type_icon_class(parse_attachment_filename(item))"
                      :style="{ color: file_type_color(parse_attachment_filename(item)), fontSize: '1.6rem' }"
                      aria-hidden="true"
                    />
                    <div class="flex-grow-1 min-w-0">
                      <div class="text-truncate small fw-semibold" :title="parse_attachment_filename(item)">
                        {{ parse_attachment_filename(item) }}
                      </div>
                      <div class="text-muted" style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em;">
                        {{ file_ext(parse_attachment_filename(item)) }}
                      </div>
                    </div>
                    <button
                      type="button"
                      class="btn btn-sm btn-outline-secondary flex-shrink-0"
                      title="Descargar archivo"
                      @click="download_message_file(item)"
                    >
                      <i class="bi bi-download" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <!-- Mensaje de audio -->
                <div v-else-if="is_audio_message(item)">
                  <template v-if="extract_media_url(item)">
                    <audio controls :src="extract_media_url(item)" class="impl-audio-player" />
                  </template>
                  <template v-else>
                    <i class="bi bi-mic me-1" aria-hidden="true" />
                    Audio recibido
                  </template>
                </div>

                <!-- Mensaje de imagen -->
                <div v-else-if="is_image_message(item)">
                  <template v-if="extract_media_url(item)">
                    <img :src="extract_media_url(item)" class="impl-inline-image" alt="Imagen adjunta" />
                  </template>
                  <template v-else>
                    <i class="bi bi-image me-1" aria-hidden="true" />
                    Imagen recibida
                  </template>
                </div>

                <!-- Texto normal con saltos de línea preservados -->
                <div v-else class="impl-bubble__body">{{ item.body }}</div>

                <!-- Timestamp debajo del mensaje -->
                <div class="impl-bubble__time">{{ format_timestamp(item.sent_at) }}</div>
              </div>
            </div>
          </template>
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

      <!-- Herramientas de desarrollo (solo en entorno DEV, no en producción) -->
      <div v-if="is_dev" class="dev-tools border-top mt-2 pt-2">

        <!-- Simular mensaje entrante del cliente (testing sin pasar por WhatsApp) -->
        <div class="d-flex gap-2">
          <input
            v-model="mensaje_simulado"
            type="text"
            class="form-control form-control-sm"
            placeholder="Simular mensaje del cliente."
            :disabled="enviando_simulado"
            @keydown.enter.prevent="on_simular_inbound"
          />
          <button
            type="button"
            class="btn btn-outline-warning btn-sm d-inline-flex align-items-center justify-content-center"
            :disabled="enviando_simulado || !has_mensaje_simulado"
            title="Simular mensaje entrante del cliente (testing)"
            aria-label="Simular mensaje entrante del cliente"
            @click="on_simular_inbound"
          >
            <span v-if="enviando_simulado" class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
            <i v-else class="bi bi-chat-left-dots" aria-hidden="true" />
          </button>
        </div>

      </div>
    </div>

  </div>
</template>

<script>
import api from '@/utils/axios'
import lead_conversation_date_dividers from '@/mixins/lead_conversation_date_dividers'
import '@/styles/whatsapp-conversation-wallpaper.css'
import '@/styles/whatsapp-date-divider.css'

/**
 * Vista fullscreen de conversación WhatsApp de una implementación.
 *
 * Equivalente a LeadConversationView pero para el módulo de implementaciones.
 * Carga la implementación desde la API al montar usando :implementation_id de la ruta.
 * Las burbujas se renderizan inline (sin componente separado) porque el modelo
 * implementation_messages difiere de lead_messages.
 * Se suscribe al canal Pusher admin-implementations para recibir mensajes en tiempo real.
 */
export default {
  name: 'ImplementationConversationView',

  mixins: [lead_conversation_date_dividers],

  data() {
    return {
      /**
       * Implementación completa cargada desde GET /implementation/:id al montar.
       * Incluye relación client, stages y messages.
       */
      implementation: null,

      /** true mientras se espera la respuesta del GET inicial de la implementación. */
      loading_conversation: false,

      /** Texto del mensaje directo a enviar al cliente por WhatsApp. */
      mensaje_directo: '',

      /** true mientras se envía el mensaje directo (evita doble envío). */
      enviando_directo: false,

      /** Texto del mensaje simulado para testing (solo visible en DEV). */
      mensaje_simulado: '',

      /** true mientras se procesa el envío del mensaje simulado. */
      enviando_simulado: false,

      /** true mientras se copia la conversación al portapapeles. */
      export_conversation_loading: false,

      /** Feedback visual verde durante 2s tras exportar con éxito. */
      export_conversation_feedback: false,

      /** Timer para resetear el feedback del botón de exportación. */
      export_conversation_feedback_timer: null,

      /**
       * true si la aplicación corre en modo desarrollo (Vite DEV).
       * Controla la visibilidad de las herramientas de testing en el footer.
       */
      is_dev: import.meta.env.DEV,

      /** true mientras el micrófono está grabando. */
      recording_audio: false,

      /** Instancia MediaRecorder activa (null cuando no graba). */
      audio_recorder: null,

      /** Stream del micrófono activo (null cuando no graba). */
      audio_stream: null,

      /** true mientras se envía el audio grabado al backend. */
      enviando_audio: false,

      /** true cuando el usuario mantiene pulsado el botón mic (modo hold). */
      audio_hold_mode: false,

      /**
       * Referencia al canal Pusher suscrito (admin-implementations).
       * Se guarda para poder hacer leave() al desmontar la vista.
       */
      _pusher_channel: null,
    }
  },

  computed: {
    /**
     * Nombre visible del cliente en el header.
     * Usa company_name si está disponible, cae a name como fallback.
     *
     * @returns {string}
     */
    client_name() {
      if (!this.implementation) {
        return 'Cargando…'
      }
      const client = this.implementation.client
      if (!client) {
        return 'Cliente desconocido'
      }
      return client.company_name || client.name || 'Sin nombre'
    },

    /**
     * Mensajes ordenados por id ascendente.
     * Se remapea created_at desde sent_at para que el mixin de divisores de fecha funcione
     * correctamente si la API solo provee sent_at en los mensajes de implementación.
     *
     * @returns {Array<Object>}
     */
    sorted_messages() {
      if (!this.implementation || !this.implementation.messages) {
        return []
      }
      const sorted = this.implementation.messages.slice()
      sorted.sort(function (a, b) {
        return (a.id || 0) - (b.id || 0)
      })
      /* Garantiza created_at para el mixin de divisores de fecha. */
      return sorted.map(function (msg) {
        if (!msg.created_at && msg.sent_at) {
          return Object.assign({}, msg, { created_at: msg.sent_at })
        }
        return msg
      })
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
     * true si hay texto en el input de simulación (DEV).
     *
     * @returns {boolean}
     */
    has_mensaje_simulado() {
      return (this.mensaje_simulado || '').trim() !== ''
    },

    /**
     * Secciones de fecha con stage markers insertados entre cambios de etapa.
     *
     * Extiende las secciones base del mixin lead_conversation_date_dividers
     * agregando objetos marcadores (_is_marker: true) cuando stage_number cambia.
     * Esto permite renderizar "— Etapa N —" usando la misma clase wa-date-divider.
     *
     * @returns {Array<{ key: string, date_label: string|null, items: Array<Object> }>}
     */
    processed_message_sections() {
      /* Secciones base agrupadas por día, generadas por el mixin. */
      const base = this.message_date_sections

      /* Estado de la última etapa vista: persiste entre secciones de fecha. */
      let last_stage = null

      return base.map(function (section) {
        /* Lista mezclada de mensajes reales y marcadores de etapa. */
        const items = []
        let i = 0

        for (i = 0; i < section.messages.length; i++) {
          const msg = section.messages[i]

          /* Insertar separador cuando el stage_number cambia respecto al mensaje anterior. */
          if (msg.stage_number && msg.stage_number !== last_stage) {
            items.push({
              _is_marker: true,
              stage_number: msg.stage_number,
              /* Clave única para v-for combinando etapa e id del mensaje disparador. */
              _key: 'stage-marker-' + msg.stage_number + '-' + msg.id,
            })
            last_stage = msg.stage_number
          }

          items.push(msg)
        }

        return {
          key: section.key,
          date_label: section.date_label,
          items: items,
        }
      })
    },
  },

  mounted() {
    const self = this

    /* Cargar la implementación con mensajes usando el param de la ruta. */
    const impl_id = this.$route.params.implementation_id
    this.loading_conversation = true

    api
      .get('/implementation/' + impl_id)
      .then(function (res) {
        self.implementation = res.data.model || null
        self.loading_conversation = false
        self.$nextTick(function () {
          self.schedule_scroll_to_bottom()
        })
      })
      .catch(function () {
        self.loading_conversation = false
      })

    /* Suscribirse al canal Pusher para recibir mensajes en tiempo real. */
    this.setup_pusher_subscription()
  },

  beforeUnmount() {
    /* Desuscribirse del canal Pusher al abandonar la vista. */
    this.teardown_pusher_subscription()

    /* Limpiar timer de feedback de exportación si estaba activo. */
    if (this.export_conversation_feedback_timer) {
      clearTimeout(this.export_conversation_feedback_timer)
      this.export_conversation_feedback_timer = null
    }

    /* Liberar el micrófono si la vista se destruye durante una grabación. */
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
    // -------------------------------------------------------------------------
    // Carga y scroll
    // -------------------------------------------------------------------------

    /**
     * Programa el scroll al último mensaje tras actualizar el DOM.
     * Usa doble nextTick para asegurar que el layout ya terminó de pintar.
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
     * Desplaza el área de mensajes al final del hilo.
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

    // -------------------------------------------------------------------------
    // Redimensión del textarea (comportamiento tipo WhatsApp)
    // -------------------------------------------------------------------------

    /**
     * Ajusta la altura del textarea al contenido escrito.
     * Máximo 128px antes de activar scroll interno.
     *
     * @param {Event} event Evento `input` del textarea.
     * @returns {void}
     */
    on_input_resize(event) {
      const el = event.target
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 128) + 'px'
    },

    // -------------------------------------------------------------------------
    // Envío de mensajes
    // -------------------------------------------------------------------------

    /**
     * Envía un mensaje directo al cliente por WhatsApp.
     * Usa POST /implementation/{id}/send-message con { content }.
     *
     * @returns {void}
     */
    on_enviar_directo() {
      const self = this
      const text = (this.mensaje_directo || '').trim()

      if (!text || !this.implementation || !this.implementation.id || this.enviando_directo) {
        return
      }

      /** ID de la implementación activa. */
      const impl_id = this.implementation.id

      this.enviando_directo = true

      api
        .post('/implementation/' + impl_id + '/send-message', { content: text })
        .then(function (res) {
          self.enviando_directo = false
          self.mensaje_directo = ''

          /* Resetear altura del textarea al vaciarlo. */
          self.$nextTick(function () {
            const textarea = self.$el && self.$el.querySelector('.message-input')
            if (textarea) {
              textarea.style.height = 'auto'
            }
          })

          /* Actualizar el modelo con el mensaje recién enviado si la API lo devuelve. */
          if (res.data && res.data.model) {
            self.implementation = res.data.model
          }

          self.schedule_scroll_to_bottom()
        })
        .catch(function () {
          self.enviando_directo = false
        })
    },

    /**
     * Simula un mensaje entrante del cliente (testing, no pasa por WhatsApp).
     * Solo visible en entorno DEV. Usa POST /implementation/{id}/simulate-inbound.
     *
     * @returns {void}
     */
    on_simular_inbound() {
      const self = this
      const text = (this.mensaje_simulado || '').trim()

      if (!text || !this.implementation || !this.implementation.id || this.enviando_simulado) {
        return
      }

      /** ID de la implementación activa. */
      const impl_id = this.implementation.id

      this.enviando_simulado = true

      api
        .post('/implementation/' + impl_id + '/simulate-inbound', { content: text })
        .then(function (res) {
          self.enviando_simulado = false
          self.mensaje_simulado = ''

          if (res.data && res.data.model) {
            self.implementation = res.data.model
          }

          self.schedule_scroll_to_bottom()
        })
        .catch(function () {
          self.enviando_simulado = false
        })
    },

    // -------------------------------------------------------------------------
    // Exportar conversación
    // -------------------------------------------------------------------------

    /**
     * Formatea la conversación completa y la copia al portapapeles.
     * Muestra feedback visual verde de 2s tras copiar con éxito.
     *
     * @returns {void}
     */
    on_export_conversation() {
      const self = this

      if (!this.sorted_messages.length || this.export_conversation_loading) {
        return
      }

      this.export_conversation_loading = true

      /* Construir texto plano de la conversación: [timestamp] Rol: cuerpo. */
      const lines = []
      this.sorted_messages.forEach(function (msg) {
        /** Etiqueta del emisor según dirección del mensaje. */
        const sender = msg.direction === 'outbound' ? 'Sistema' : 'Cliente'
        const ts = self.format_timestamp(msg.sent_at)
        const body = (msg.body || '').replace(/\n/g, ' ')
        lines.push('[' + ts + '] ' + sender + ': ' + body)
      })

      /** Texto final separado por saltos de línea. */
      const text = lines.join('\n')

      navigator.clipboard
        .writeText(text)
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

    // -------------------------------------------------------------------------
    // Detección y descarga de adjuntos
    // -------------------------------------------------------------------------

    /**
     * Detecta si un mensaje contiene un archivo adjunto tipo Document.
     * El patrón es: [Document attached (nombre.ext)].
     *
     * @param {Object} msg Mensaje de implementation_messages.
     * @returns {boolean}
     */
    is_file_attachment(msg) {
      return /\[Document attached/i.test(msg.body || '')
    },

    /**
     * Detecta si un mensaje contiene audio adjunto.
     * El patrón es: [Audio attached ...].
     *
     * @param {Object} msg Mensaje de implementation_messages.
     * @returns {boolean}
     */
    is_audio_message(msg) {
      return /\[Audio attached/i.test(msg.body || '')
    },

    /**
     * Detecta si un mensaje contiene una imagen adjunta.
     * El patrón es: [Image attached ...].
     *
     * @param {Object} msg Mensaje de implementation_messages.
     * @returns {boolean}
     */
    is_image_message(msg) {
      return /\[Image attached/i.test(msg.body || '')
    },

    /**
     * Extrae la URL del media adjunto (audio o imagen) del cuerpo del mensaje.
     * Busca el patrón: URL: https://...
     *
     * @param {Object} msg Mensaje de implementation_messages.
     * @returns {string|null} URL encontrada o null si no hay.
     */
    extract_media_url(msg) {
      const match = (msg.body || '').match(/URL:\s*(https?:\/\/\S+)/i)
      return match ? match[1] : null
    },

    /**
     * Extrae el nombre del archivo adjunto del cuerpo del mensaje.
     * Busca el patrón: [Document/Image/Video/Audio attached (nombre.ext)].
     *
     * @param {Object} msg Mensaje de implementation_messages.
     * @returns {string} Nombre del archivo o 'archivo' como fallback.
     */
    parse_attachment_filename(msg) {
      const match = (msg.body || '').match(
        /(?:document|image|video|audio)\s+attached\s*\(([^)]+)\)/i
      )
      return match && match[1] ? match[1].trim() : 'archivo'
    },

    /**
     * Descarga el adjunto de un mensaje vía proxy del backend.
     * Usa GET /implementation/{impl_id}/message-file-download/{message_id} con responseType blob.
     *
     * @param {Object} msg Mensaje con adjunto de archivo.
     * @returns {void}
     */
    download_message_file(msg) {
      if (!this.implementation || !msg || !msg.id) {
        return
      }

      /** ID de la implementación activa y del mensaje con el adjunto. */
      const impl_id = this.implementation.id
      const message_id = msg.id
      const filename = this.parse_attachment_filename(msg)

      api
        .get('/implementation/' + impl_id + '/message-file-download/' + message_id, {
          responseType: 'blob',
        })
        .then(function (res) {
          /** Object URL temporal para disparar la descarga sin redirección. */
          const blob_url = window.URL.createObjectURL(new Blob([res.data]))
          const link = document.createElement('a')
          link.href = blob_url
          link.setAttribute('download', filename || 'archivo')
          document.body.appendChild(link)
          link.click()
          link.parentNode.removeChild(link)
          window.URL.revokeObjectURL(blob_url)
        })
        .catch(function () {
          /* El interceptor global de axios ya muestra el toast de error. */
        })
    },

    // -------------------------------------------------------------------------
    // Helpers de tipo de archivo (ícono y color)
    // -------------------------------------------------------------------------

    /**
     * Clase Bootstrap Icon correspondiente a la extensión del archivo.
     *
     * @param {string} filename Nombre del archivo con extensión.
     * @returns {string} Clase CSS del ícono bi-*.
     */
    file_type_icon_class(filename) {
      /** Extensión normalizada en minúsculas. */
      const ext = String(filename || '').split('.').pop().toLowerCase()

      if (ext === 'pdf') return 'bi-file-earmark-pdf-fill'
      if (ext === 'xlsx' || ext === 'xls') return 'bi-file-earmark-spreadsheet-fill'
      if (ext === 'csv') return 'bi-file-earmark-text-fill'
      if (ext === 'doc' || ext === 'docx') return 'bi-file-earmark-word-fill'
      if (ext === 'zip' || ext === 'rar' || ext === '7z') return 'bi-file-earmark-zip-fill'
      if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif' || ext === 'webp') {
        return 'bi-file-earmark-image-fill'
      }
      if (ext === 'txt') return 'bi-file-earmark-text-fill'

      return 'bi-file-earmark-fill'
    },

    /**
     * Color del ícono de archivo imitando los colores del software nativo.
     *
     * @param {string} filename Nombre del archivo.
     * @returns {string} Color CSS.
     */
    file_type_color(filename) {
      const ext = String(filename || '').split('.').pop().toLowerCase()

      if (ext === 'pdf') return '#e53935'
      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return '#1d6f42'
      if (ext === 'doc' || ext === 'docx') return '#2b579a'
      if (ext === 'zip' || ext === 'rar' || ext === '7z') return '#f59e0b'
      if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif' || ext === 'webp') {
        return '#7c3aed'
      }

      return '#6c757d'
    },

    /**
     * Extensión del archivo en mayúsculas para mostrar bajo el nombre.
     *
     * @param {string} filename Nombre del archivo.
     * @returns {string}
     */
    file_ext(filename) {
      if (!filename) return ''
      const ext = String(filename).split('.').pop()
      return ext ? ext.toUpperCase() : ''
    },

    // -------------------------------------------------------------------------
    // Formato de timestamps
    // -------------------------------------------------------------------------

    /**
     * Formatea un timestamp ISO a string legible en locale es-AR.
     * Formato: DD/MM/AAAA, HH:MM.
     *
     * @param {string|null} raw Fecha ISO o null.
     * @returns {string}
     */
    format_timestamp(raw) {
      if (!raw) return '—'
      const d = new Date(raw)
      if (isNaN(d.getTime())) return '—'
      return d.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    },

    // -------------------------------------------------------------------------
    // Pusher: tiempo real
    // -------------------------------------------------------------------------

    /**
     * Se suscribe al canal admin-implementations y escucha el evento
     * .implementation.message.received para agregar mensajes en tiempo real.
     *
     * Reutiliza la instancia global window.admin_support_echo creada en main.js.
     * Si Echo no está disponible (sin Pusher en .env), no hace nada.
     *
     * @returns {void}
     */
    setup_pusher_subscription() {
      const self = this
      const echo = window.admin_support_echo

      if (!echo) {
        return
      }

      /** Canal compartido del panel admin con eventos de implementaciones. */
      self._pusher_channel = echo.channel('admin-implementations')

      self._pusher_channel.listen('.implementation.message.received', function (event_data) {
        self.on_message_received(event_data)
      })
    },

    /**
     * Deja el canal admin-implementations y limpia la referencia local.
     *
     * @returns {void}
     */
    teardown_pusher_subscription() {
      const echo = window.admin_support_echo

      if (!echo || !this._pusher_channel) {
        return
      }

      echo.leave('admin-implementations')
      this._pusher_channel = null
    },

    /**
     * Maneja el evento .implementation.message.received recibido por Pusher.
     *
     * Agrega el mensaje al hilo si pertenece a esta implementación y no está duplicado.
     * Luego hace scroll al último mensaje.
     *
     * @param {Object} event_data Payload del evento: { implementation_id, message }.
     * @returns {void}
     */
    on_message_received(event_data) {
      if (!event_data || !event_data.message || !event_data.implementation_id) {
        return
      }

      if (!this.implementation || this.implementation.id != event_data.implementation_id) {
        return
      }

      /** Mensaje recién persistido en el backend. */
      const message = event_data.message

      if (!this.implementation.messages) {
        this.implementation.messages = []
      }

      /* Evitar duplicados si el mensaje ya fue agregado por otro camino. */
      let already_exists = false
      this.implementation.messages.forEach(function (existing) {
        if (existing.id == message.id) {
          already_exists = true
        }
      })

      if (already_exists) {
        return
      }

      this.implementation.messages.push(message)
      this.schedule_scroll_to_bottom()
    },

    // -------------------------------------------------------------------------
    // Grabación de audio
    // -------------------------------------------------------------------------

    /**
     * Click simple en el micrófono:
     * - Si no está grabando → inicia grabación.
     * - Si está grabando → detiene y envía.
     * Si el usuario usó hold (mousedown + mouseup), el click se ignora porque
     * on_mic_mouseup_or_leave ya manejó el stop.
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
     * MouseDown: inicia el timer de hold y eventualmente arranca la grabación.
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
     * MouseUp o MouseLeave: si estaba en modo hold y grabando, detiene y envía.
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
     * TouchEnd: detiene la grabación en modo hold táctil.
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
     * Al finalizar, el onstop del recorder llama a send_pending_audio.
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

      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then(function (stream) {
          self.audio_stream = stream
          const recorder = new MediaRecorder(stream)
          self.audio_recorder = recorder

          /** Fragmentos de audio acumulados durante la grabación. */
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
     * Libera el stream del micrófono (apaga el indicador de grabación del SO).
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
     * Envía el blob de audio al backend vía POST /implementation/{id}/send-audio.
     *
     * NOTA: el endpoint send-audio no existe todavía en el backend; el envío
     * fallará silenciosamente hasta que sea implementado.
     *
     * @returns {void}
     */
    send_pending_audio() {
      const self = this
      const blob = this._pending_audio_blob
      const mime = this._pending_audio_mime || 'audio/webm'

      if (!blob || !this.implementation || !this.implementation.id || this.enviando_audio) {
        return
      }

      this._pending_audio_blob = null
      this._pending_audio_mime = null

      /** Extensión del archivo según el tipo MIME del MediaRecorder. */
      let ext = 'webm'
      if (mime.indexOf('ogg') !== -1) ext = 'ogg'
      else if (mime.indexOf('mp4') !== -1) ext = 'mp4'

      const form = new FormData()
      form.append('audio', blob, 'audio.' + ext)

      /** ID de la implementación para la ruta del endpoint. */
      const impl_id = this.implementation.id

      this.enviando_audio = true

      api
        .post('/implementation/' + impl_id + '/send-audio', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        .then(function (res) {
          self.enviando_audio = false
          if (res.data && res.data.model) {
            self.implementation = res.data.model
          }
          self.schedule_scroll_to_bottom()
        })
        .catch(function (err) {
          self.enviando_audio = false
          console.error('Error al enviar audio', err)
        })
    },
  },
}
</script>

<style scoped>
/* Layout de pantalla completa tipo WhatsApp.
   Fijado sobre todo el viewport con position:fixed para neutralizar
   cualquier padding, scroll o margen que el layout de App.vue aplique al <main>. */
.conversation-view {
  position: fixed;
  inset: 0;
  z-index: 1040;
  background: var(--bs-body-bg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header y footer no ceden espacio al área de mensajes. */
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

/* El nombre del cliente se trunca si es demasiado largo. */
.conversation-lead-name {
  max-width: 60vw;
}

/* Área de mensajes ocupa el espacio restante y scrollea internamente. */
.conversation-messages {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
}

/* Columna flex para alinear burbujas; el scroll vive en .conversation-messages. */
.conversation-messages-flow {
  display: flex;
  flex-direction: column;
}

/* Botones circulares de solo ícono (header y footer). */
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

/* Textarea auto-expandible tipo WhatsApp. */
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

/* Sección DEV con fondo suave para distinguirla del área de producción. */
.dev-tools {
  background: rgba(var(--bs-warning-rgb), 0.05);
  border-radius: 0.375rem;
  padding: 0.5rem;
}

/* Pulso rojo mientras graba audio. */
@keyframes audio-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
}
.audio-recording-pulse {
  animation: audio-pulse 1s ease-in-out infinite;
}

/* Burbuja de mensaje genérica. */
.impl-bubble {
  max-width: 70%;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 0.875rem;
}

/* Burbuja outbound (enviado por el sistema): azul primario, alineada a la derecha. */
.impl-bubble--outbound {
  background-color: #0d6efd;
  color: white;
  border-bottom-right-radius: 2px;
}

/* Burbuja inbound (recibida del cliente): gris claro, alineada a la izquierda. */
.impl-bubble--inbound {
  background-color: #e9ecef;
  color: #212529;
  border-bottom-left-radius: 2px;
}

/* Texto del mensaje con saltos de línea preservados. */
.impl-bubble__body {
  white-space: pre-wrap;
  word-break: break-word;
}

/* Contenedor del adjunto de archivo dentro de la burbuja. */
.impl-bubble__attachment {
  min-width: 220px;
  max-width: 300px;
}

/* Tarjeta de archivo: fondo neutro para burbujas inbound. */
.impl-bubble-file-card {
  background-color: #fff;
  border-color: #dee2e6 !important;
}

/* Tarjeta de archivo dentro de burbuja outbound: semitransparente. */
.impl-bubble--outbound .impl-bubble-file-card {
  background-color: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.35) !important;
}
.impl-bubble--outbound .impl-bubble-file-card .text-muted {
  color: rgba(255, 255, 255, 0.75) !important;
}
.impl-bubble--outbound .impl-bubble-file-card .fw-semibold {
  color: #fff;
}

/* Timestamp debajo del mensaje, opacidad reducida. */
.impl-bubble__time {
  font-size: 0.7rem;
  margin-top: 3px;
  opacity: 0.7;
  text-align: right;
}

/* Reproductor de audio inline. */
.impl-audio-player {
  max-width: 240px;
  width: 100%;
}

/* Imagen inline en la burbuja. */
.impl-inline-image {
  max-width: 240px;
  border-radius: 8px;
  display: block;
}
</style>
