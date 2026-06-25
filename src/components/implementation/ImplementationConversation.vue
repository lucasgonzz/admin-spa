<template>
  <!--
    Componente de conversación WhatsApp para el panel de implementación.

    Muestra el hilo de mensajes con burbujas outbound/inbound, separadores de etapa,
    soporte de audio, imagen y adjuntos de archivo, más dos inputs:
    - Uno para enviar mensajes salientes directamente por WhatsApp.
    - Otro para simular mensajes entrantes del cliente (testing).

    Recibe los mensajes a través de la prop `implementation`, que el padre actualiza
    en tiempo real vía Pusher. El componente no suscribe al canal por sí mismo.
  -->
  <div class="impl-conversation d-flex flex-column">

    <!-- Área de mensajes con scroll propio -->
    <div ref="messages_container" class="impl-conv-messages overflow-auto flex-grow-1 p-3">

      <!-- Estado: sin mensajes -->
      <div
        v-if="!messages_list.length"
        class="conversation-placeholder conversation-placeholder--empty"
      >
        <div class="conversation-placeholder__card">
          <i class="bi bi-chat-dots conversation-placeholder__icon" aria-hidden="true" />
          <p class="conversation-placeholder__title">Sin mensajes todavía</p>
          <p class="conversation-placeholder__subtitle">Los mensajes con el cliente aparecerán aquí.</p>
        </div>
      </div>

      <!-- Lista de burbujas con separadores por etapa -->
      <template v-else>
        <!--
          Wrapper con clave por mensaje: agrupa el separador de etapa opcional y la burbuja.
          Se usa div en lugar de template para respetar la regla vue/no-v-for-template-key.
        -->
        <div v-for="(message, index) in messages_list" :key="message.id" class="impl-message-group">

          <!--
            Separador de etapa: visible la primera vez que aparece una etapa
            o cuando cambia respecto al mensaje anterior.
          -->
          <div
            v-if="index === 0 || messages_list[index - 1].stage_number !== message.stage_number"
            class="impl-stage-separator text-center text-muted small"
          >
            — Etapa {{ message.stage_number }} —
          </div>

          <!-- Burbuja de mensaje: alineación según dirección -->
          <div
            class="d-flex mb-2"
            :class="message.direction === 'outbound' ? 'justify-content-end' : 'justify-content-start'"
          >
            <div
              class="impl-bubble"
              :class="message.direction === 'outbound' ? 'impl-bubble--outbound' : 'impl-bubble--inbound'"
            >

              <!-- Audio: reproductor nativo si hay URL disponible -->
              <div v-if="parse_message_media(message) && parse_message_media(message).type === 'audio'">
                <audio
                  v-if="parse_message_media(message).url"
                  controls
                  :src="parse_message_media(message).url"
                  class="impl-bubble__audio"
                />
                <!-- Fallback cuando no hay URL directa -->
                <div v-else class="impl-bubble__body d-flex align-items-center gap-2">
                  <i class="bi bi-mic" aria-hidden="true" />
                  <span>Audio recibido</span>
                </div>
              </div>

              <!-- Imagen inline si hay URL; ícono fallback si no -->
              <div v-else-if="parse_message_media(message) && parse_message_media(message).type === 'image'">
                <img
                  v-if="parse_message_media(message).url"
                  :src="parse_message_media(message).url"
                  class="impl-bubble__image"
                  alt="Imagen recibida"
                />
                <div v-else class="impl-bubble__body d-flex align-items-center gap-2">
                  <i class="bi bi-image" aria-hidden="true" style="font-size: 1.5rem;" />
                  <span class="small">Imagen recibida</span>
                </div>
              </div>

              <!-- Documento: tarjeta con ícono, nombre y botón de descarga -->
              <div
                v-else-if="parse_message_media(message) && (parse_message_media(message).type === 'document' || parse_message_media(message).type === 'video')"
                class="impl-bubble__attachment"
              >
                <div class="impl-stage4-file-card impl-bubble-file-card d-flex align-items-center gap-2 p-2 border rounded">
                  <!-- Ícono del tipo de archivo según extensión -->
                  <i
                    class="impl-stage4-file-icon bi flex-shrink-0"
                    :class="file_type_icon_class(parse_message_media(message).filename)"
                    :style="{ color: file_type_color(parse_message_media(message).filename), fontSize: '1.6rem' }"
                    aria-hidden="true"
                  />

                  <!-- Nombre y extensión del archivo -->
                  <div class="flex-grow-1 min-w-0">
                    <div
                      class="text-truncate small fw-semibold"
                      :title="parse_message_media(message).filename"
                    >
                      {{ parse_message_media(message).filename }}
                    </div>
                    <div class="text-muted" style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em;">
                      {{ file_ext(parse_message_media(message).filename) }}
                    </div>
                  </div>

                  <!-- Botón de descarga vía proxy del backend -->
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-secondary flex-shrink-0 impl-stage4-download-btn"
                    :title="'Descargar ' + parse_message_media(message).filename"
                    @click.stop="download_message_file(message)"
                  >
                    <i class="bi bi-download" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <!-- Texto plano para mensajes sin multimedia -->
              <div v-else class="impl-bubble__body">{{ message.body }}</div>

              <!-- Timestamp debajo de la burbuja -->
              <div class="impl-bubble__time">{{ format_date(message.sent_at) }}</div>
            </div>
          </div>
        </div>

        <!-- Ancla al final del hilo para scrollIntoView tras renderizar nuevos mensajes -->
        <div ref="messages_bottom" style="height: 0; width: 0; overflow: hidden;" aria-hidden="true" />
      </template>
    </div>

    <!-- Footer fijo al fondo: inputs de envío y simulación -->
    <div class="impl-conv-footer flex-shrink-0 border-top p-2">

      <!-- Textarea + botón para enviar mensaje saliente directo por WhatsApp -->
      <div class="d-flex align-items-end gap-2 mb-2">
        <textarea
          v-model="outbound_text"
          class="form-control form-control-sm impl-conv-textarea"
          rows="2"
          placeholder="Escribir mensaje para enviar por WhatsApp…"
          :disabled="sending_outbound"
          @keydown.enter.exact.prevent="on_send_outbound"
        />
        <button
          type="button"
          class="btn btn-primary btn-sm d-inline-flex align-items-center justify-content-center"
          :disabled="sending_outbound || !outbound_text.trim()"
          title="Enviar mensaje por WhatsApp"
          aria-label="Enviar mensaje por WhatsApp"
          @click="on_send_outbound"
        >
          <span
            v-if="sending_outbound"
            class="spinner-border spinner-border-sm"
            role="status"
            aria-hidden="true"
          />
          <i v-else class="bi bi-send" aria-hidden="true" />
        </button>
      </div>

      <!-- Input + botón para simular mensaje entrante del cliente (testing) -->
      <div class="d-flex align-items-center gap-2">
        <input
          v-model="inbound_sim_text"
          type="text"
          class="form-control form-control-sm"
          placeholder="Simular mensaje del cliente (test)."
          :disabled="sending_inbound_sim"
          @keydown.enter.prevent="on_simulate_inbound"
        />
        <button
          type="button"
          class="btn btn-outline-warning btn-sm d-inline-flex align-items-center justify-content-center"
          :disabled="sending_inbound_sim || !inbound_sim_text.trim()"
          title="Simular mensaje entrante del cliente (testing)"
          aria-label="Simular mensaje entrante del cliente"
          @click="on_simulate_inbound"
        >
          <span
            v-if="sending_inbound_sim"
            class="spinner-border spinner-border-sm"
            role="status"
            aria-hidden="true"
          />
          <i v-else class="bi bi-chat-left-dots" aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import api from '@/utils/axios'
import '@/styles/conversation-placeholder-states.css'

/**
 * Componente de conversación WhatsApp para el panel de implementación.
 *
 * Responsabilidad: mostrar el hilo de mensajes de una implementación con burbujas
 * estilo WhatsApp, soporte de audio/imagen/adjuntos, y dos inputs de envío:
 * uno para mensajes salientes reales y otro para simulación de mensajes entrantes.
 *
 * El padre (Implementations.vue) gestiona la suscripción Pusher y actualiza
 * la prop `implementation.messages` cuando llegan mensajes nuevos.
 */
export default {
  name: 'ImplementationConversation',

  props: {
    /**
     * Implementación activa en el panel de detalle.
     * Se espera que tenga la relación `messages` cargada y actualizada en tiempo real.
     */
    implementation: { type: Object, default: null },
  },

  data() {
    return {
      /**
       * Texto del mensaje saliente a enviar directamente por WhatsApp.
       */
      outbound_text: '',

      /**
       * Indicador de envío en curso del mensaje saliente (evita doble envío).
       */
      sending_outbound: false,

      /**
       * Texto del mensaje entrante simulado (para testing sin WhatsApp real).
       */
      inbound_sim_text: '',

      /**
       * Indicador de simulación en curso (evita doble envío).
       */
      sending_inbound_sim: false,
    }
  },

  computed: {
    /**
     * Lista de mensajes de la implementación activa, ordenados por id ascendente.
     *
     * Si la relación messages no está cargada, devuelve array vacío.
     *
     * @returns {Array}
     */
    messages_list() {
      if (!this.implementation || !this.implementation.messages) {
        return []
      }

      /** Copia para ordenar sin mutar la prop. */
      const copy = this.implementation.messages.slice()

      copy.sort(function (a, b) {
        return (a.id || 0) - (b.id || 0)
      })

      return copy
    },
  },

  watch: {
    /**
     * Cuando cambia la lista de mensajes (nuevo mensaje recibido o carga inicial),
     * desplaza el scroll al último mensaje.
     *
     * @param {Array} new_val Nueva lista de mensajes.
     */
    messages_list(new_val) {
      const self = this

      this.$nextTick(function () {
        self.scroll_to_bottom()
      })
    },

    /**
     * Cuando cambia la implementación activa (el usuario seleccionó otra),
     * reinicia los inputs y baja el scroll.
     *
     * @param {Object|null} new_val Nueva implementación seleccionada.
     * @param {Object|null} old_val Implementación anterior.
     */
    implementation(new_val, old_val) {
      const self = this

      /* Solo resetear si cambió a una implementación diferente. */
      if (!new_val || !old_val || new_val.id !== old_val.id) {
        this.outbound_text = ''
        this.inbound_sim_text = ''
      }

      this.$nextTick(function () {
        self.scroll_to_bottom()
      })
    },
  },

  mounted() {
    /* Bajar scroll al montar el componente (mensajes ya cargados). */
    const self = this

    this.$nextTick(function () {
      self.scroll_to_bottom()
    })
  },

  methods: {
    /**
     * Desplaza el contenedor de mensajes hasta el último elemento del hilo.
     * Usa scrollTop + scrollIntoView doble rAF para layout tardío.
     *
     * @returns {void}
     */
    scroll_to_bottom() {
      const self = this

      /** Contenedor scrolleable de mensajes. */
      const container = this.$refs.messages_container

      if (container) {
        container.scrollTop = container.scrollHeight
      }

      /** Ancla al final del hilo para alinear exactamente el último mensaje. */
      const anchor = this.$refs.messages_bottom

      if (anchor && typeof anchor.scrollIntoView === 'function') {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            anchor.scrollIntoView({ block: 'end', inline: 'nearest' })
          })
        })
      }
    },

    /**
     * Envía el mensaje saliente directamente por WhatsApp al cliente.
     *
     * Llama a POST /implementation/{id}/send-message con el texto escrito.
     * El backend persiste el mensaje, lo envía por WhatsApp y emite el evento Pusher.
     * Tras éxito limpia el textarea.
     *
     * @returns {void}
     */
    on_send_outbound() {
      const self = this

      /** Texto saneado del textarea. */
      const text = (this.outbound_text || '').trim()

      if (!text || !this.implementation || this.sending_outbound) {
        return
      }

      this.sending_outbound = true

      this.$store.commit('auth/setMessage', 'Enviando mensaje por WhatsApp')
      this.$store.commit('auth/setLoading', true)

      api
        .post('/implementation/' + this.implementation.id + '/send-message', {
          content: text,
        })
        .then(function () {
          self.outbound_text = ''
          self.scroll_to_bottom()
        })
        .catch(function () {
          /* El interceptor global de axios ya muestra el toast de error. */
        })
        .then(function () {
          self.sending_outbound = false
          self.$store.commit('auth/setLoading', false)
          self.$store.commit('auth/setMessage', '')
        })
    },

    /**
     * Simula un mensaje entrante del cliente para testing.
     *
     * Llama a POST /implementation/{id}/simulate-inbound con el texto del input.
     * El backend persiste el mensaje, emite el evento Pusher y dispara el flujo
     * del agente de implementación como si fuera un mensaje real de WhatsApp.
     * Tras éxito limpia el input.
     *
     * @returns {void}
     */
    on_simulate_inbound() {
      const self = this

      /** Texto del input de simulación. */
      const text = (this.inbound_sim_text || '').trim()

      if (!text || !this.implementation || this.sending_inbound_sim) {
        return
      }

      this.sending_inbound_sim = true

      this.$store.commit('auth/setMessage', 'Simulando mensaje entrante del cliente')
      this.$store.commit('auth/setLoading', true)

      api
        .post('/implementation/' + this.implementation.id + '/simulate-inbound', {
          content: text,
        })
        .then(function () {
          self.inbound_sim_text = ''
          self.scroll_to_bottom()
        })
        .catch(function () {
          /* El interceptor global de axios ya muestra el toast de error. */
        })
        .then(function () {
          self.sending_inbound_sim = false
          self.$store.commit('auth/setLoading', false)
          self.$store.commit('auth/setMessage', '')
        })
    },

    /**
     * Parsea el multimedia de un mensaje de implementación.
     *
     * Detecta el patrón guardado por el webhook de WhatsApp:
     *   [Audio attached]
     *   [Image attached (nombre.ext)]
     *   [Document attached (nombre.ext)]
     *   [Video attached (nombre.ext)]
     *   URL: https://...
     *
     * Devuelve un objeto con tipo, URL y nombre de archivo, o null si el
     * mensaje no contiene multimedia reconocible.
     *
     * @param {Object} message Fila de implementation_messages.
     * @returns {{ type: string, url: string|null, filename: string }|null}
     */
    parse_message_media(message) {
      if (!message || !message.body) {
        return null
      }

      /** Texto completo del cuerpo del mensaje. */
      const body = String(message.body)

      /* Detectar si el body contiene algún patrón de multimedia adjunto. */
      const type_match = body.match(/\b(document|image|video|audio)\s+attached\b/i)

      if (!type_match) {
        return null
      }

      /** Tipo de multimedia detectado en minúsculas. */
      const type = type_match[1].toLowerCase()

      /** Nombre de archivo extraído del patrón "(nombre.ext)". */
      let filename = 'archivo'
      const name_match = body.match(/(?:document|image|video|audio)\s+attached\s*\(([^)]+)\)/i)

      if (name_match && name_match[1]) {
        filename = name_match[1].trim()
      }

      /** URL del archivo en el storage de Kapso. */
      let url = null
      const url_match = body.match(/URL:\s*(https?:\/\/\S+)/i)

      if (url_match && url_match[1]) {
        url = url_match[1].trim()
      }

      return {
        type: type,
        url: url,
        filename: filename,
      }
    },

    /**
     * Descarga el adjunto de un mensaje de la conversación vía proxy del backend.
     *
     * Usa GET /implementation/{impl_id}/message-file-download/{message_id} con
     * responseType blob para incluir el token de autenticación en el header.
     *
     * @param {Object} message Mensaje con adjunto multimedia detectado por parse_message_media.
     * @returns {void}
     */
    download_message_file(message) {
      if (!this.implementation || !message) {
        return
      }

      /** Metadata del multimedia para obtener el nombre del archivo. */
      const media = this.parse_message_media(message)
      const filename = (media && media.filename) ? media.filename : 'archivo'

      api
        .get(
          '/implementation/' + this.implementation.id + '/message-file-download/' + message.id,
          { responseType: 'blob' }
        )
        .then(function (res) {
          /* Crear un object URL temporal y simular clic en un enlace de descarga. */
          const blob_url = window.URL.createObjectURL(new Blob([res.data]))
          const link = document.createElement('a')
          link.href = blob_url
          link.setAttribute('download', filename)
          document.body.appendChild(link)
          link.click()
          link.parentNode.removeChild(link)
          window.URL.revokeObjectURL(blob_url)
        })
        .catch(function () {
          /* El interceptor global de axios ya muestra el toast de error. */
        })
    },

    /**
     * Retorna la clase Bootstrap Icon correspondiente a la extensión del archivo.
     *
     * @param {string} filename Nombre del archivo con extensión.
     * @returns {string} Clase CSS del ícono bi-*.
     */
    file_type_icon_class(filename) {
      /** Extensión en minúsculas para comparación normalizada. */
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
     * Color del ícono de archivo según la extensión, imitando los colores del software nativo.
     *
     * @param {string} filename Nombre del archivo.
     * @returns {string} Color CSS.
     */
    file_type_color(filename) {
      /** Extensión en minúsculas para comparación normalizada. */
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
     * Devuelve la extensión en mayúsculas para mostrar debajo del nombre del archivo.
     *
     * @param {string} filename Nombre del archivo.
     * @returns {string}
     */
    file_ext(filename) {
      if (!filename) return ''
      const ext = String(filename).split('.').pop()
      return ext ? ext.toUpperCase() : ''
    },

    /**
     * Formatea una fecha ISO a string legible en locale español (Argentina).
     *
     * @param {string|null} date_string Fecha ISO o null.
     * @returns {string}
     */
    format_date(date_string) {
      if (!date_string) return '—'

      const date = new Date(date_string)

      if (isNaN(date.getTime())) return '—'

      return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    },
  },
}
</script>

<style scoped>
/* Contenedor principal: ocupa todo el espacio disponible del padre */
.impl-conversation {
  height: 100%;
  min-height: 0;
}

/* Área de mensajes: crece para llenar el espacio restante y tiene scroll propio */
.impl-conv-messages {
  min-height: 0;
}

/* Footer de inputs: no se comprime aunque los mensajes crezcan */
.impl-conv-footer {
  background-color: #fff;
}

/* Textarea de mensaje saliente: altura mínima cómoda, redimensionable */
.impl-conv-textarea {
  min-height: 4rem;
  resize: vertical;
  line-height: 1.4;
}

/* Imagen inline en burbuja: máximo ancho y bordes redondeados */
.impl-bubble__image {
  max-width: 240px;
  max-height: 240px;
  border-radius: 8px;
  display: block;
  object-fit: cover;
}

/* Audio nativo: ancho completo dentro de la burbuja */
.impl-bubble__audio {
  display: block;
  width: 100%;
  min-width: 200px;
  max-width: 280px;
}
</style>
