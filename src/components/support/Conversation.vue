<template>
  <div class="support-conversation">
    <div class="support-conversation-body whatsapp-conversation-wallpaper" ref="conversation_body">
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
      <!-- Mensajes agrupados por día con divisor sticky estilo WhatsApp (Hoy / Ayer / día / fecha),
           con el mismo marcado que la conversación de leads. -->
      <div class="conversation-messages-flow support-messages-flow">
        <div
          v-for="section in message_date_sections"
          :key="section.key"
          class="wa-date-section">
          <div v-if="section.date_label" class="wa-date-divider">
            <span class="wa-date-divider-label">{{ section.date_label }}</span>
          </div>
          <div
            v-for="message in section.messages"
            :key="message_key(message)"
            :class="['support-message-row', message.sender_type == 'admin' ? 'mine' : 'their']">
            <div class="support-message-col">
              <!-- Fila burbuja + botón de reaccionar. Se comparte la zona para cerrar la barra al
                   tocar afuera (ver on_document_click). -->
              <div
                class="support-message-bubble-row support-reaction-zone"
                :class="{ 'support-message-bubble-row--react': can_react(message) }">
              <border-progress-wrap
                :active="is_ai_draft_auto_send_active(message)"
                :duration_seconds="ai_draft_total_seconds(message)"
                :elapsed_seconds="ai_draft_elapsed_seconds(message)"
                :animation_key="ai_draft_animation_key(message)"
                variant="bubble">
                <div
                  :class="[
                    'support-message-bubble',
                    bubble_has_wide_media(message) ? 'support-message-bubble--media' : '',
                    has_delivery_error(message) ? 'support-message-bubble--error' : '',
                    is_ai_draft_message(message) ? 'support-message-bubble--ai-draft' : '',
                  ]"
                  :title="message_sent_at_tooltip(message)">
                  <div
                    v-if="visible_body(message)"
                    class="support-message-text">
                    {{ visible_body(message) }}
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
                <!-- Adjuntos guardados: se renderiza cada uno según su tipo real (mime, extensión o kind) -->
                <template v-if="has_local_attachment(message)">
                  <div
                    v-for="(attachment, attachment_index) in message.attachments"
                    :key="attachment_key(attachment, attachment_index)"
                    class="support-media">
                    <!-- Imagen: miniatura que abre el visor; si no carga, aviso con descarga -->
                    <template v-if="attachment_media_type(message, attachment) === 'image'">
                      <button
                        v-if="!has_media_error(attachment)"
                        type="button"
                        class="support-message-image-btn"
                        title="Ver imagen en grande"
                        @click="open_image_preview(attachment_open_url(attachment))">
                        <img
                          :src="attachment_open_url(attachment)"
                          class="support-message-image"
                          alt="Imagen adjunta"
                          @error="on_media_error(attachment)" />
                      </button>
                      <div v-else class="support-media-error">
                        <i class="bi bi-image" aria-hidden="true" />
                        <span>No se pudo cargar la imagen</span>
                        <span aria-hidden="true">·</span>
                        <a
                          :href="attachment_download_url(attachment)"
                          :download="attachment_display_name(attachment)"
                          target="_blank"
                          rel="noopener noreferrer">Descargar</a>
                      </div>
                    </template>
                    <!-- Audio: el mismo reproductor que la conversación de leads -->
                    <template v-else-if="attachment_media_type(message, attachment) === 'audio'">
                      <audio-player
                        v-if="!has_media_error(attachment)"
                        :src="audio_src(attachment)"
                        :is_outgoing="is_mine(message)"
                        @error="on_media_error(attachment)" />
                      <div v-else class="support-media-error">
                        <i class="bi bi-mic-mute" aria-hidden="true" />
                        <span>No se pudo reproducir acá</span>
                        <span aria-hidden="true">·</span>
                        <a
                          :href="attachment_download_url(attachment)"
                          :download="attachment_display_name(attachment)"
                          target="_blank"
                          rel="noopener noreferrer">Descargar audio</a>
                      </div>
                    </template>
                    <!-- Video: #t=0.001 hace que iOS muestre el primer cuadro con preload="metadata" -->
                    <template v-else-if="attachment_media_type(message, attachment) === 'video'">
                      <video
                        v-if="!has_media_error(attachment)"
                        controls
                        playsinline
                        preload="metadata"
                        class="support-message-video"
                        :src="attachment_open_url(attachment) + '#t=0.001'"
                        @error="on_media_error(attachment)">
                        Tu navegador no soporta la reproducción de video.
                      </video>
                      <div v-else class="support-media-error">
                        <i class="bi bi-camera-video-off" aria-hidden="true" />
                        <span>No se pudo reproducir el video</span>
                        <span aria-hidden="true">·</span>
                        <a
                          :href="attachment_download_url(attachment)"
                          :download="attachment_display_name(attachment)"
                          target="_blank"
                          rel="noopener noreferrer">Descargar video</a>
                      </div>
                    </template>
                    <!-- Documento, sticker sin tipo claro y cualquier otro archivo: tarjeta con descarga -->
                    <a
                      v-else
                      :href="attachment_download_url(attachment)"
                      :download="attachment_display_name(attachment)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="support-file-card"
                      :title="'Descargar ' + attachment_display_name(attachment)">
                      <i class="bi support-file-card-icon" :class="attachment_icon_class(attachment)" aria-hidden="true" />
                      <span class="support-file-card-name">{{ attachment_display_name(attachment) }}</span>
                      <i class="bi bi-download support-file-card-download" aria-hidden="true" />
                    </a>
                  </div>
                </template>
                <!-- Transcripción del audio entrante (el body del mensaje), debajo del reproductor -->
                <div
                  v-if="transcription_text(message)"
                  class="support-message-transcription">
                  <span class="support-message-transcription-label">Transcripción</span>
                  <span class="support-message-transcription-text">{{ transcription_text(message) }}</span>
                </div>
                <!-- Placeholder cuando el mensaje es multimedia pero el archivo no se guardó -->
                <div
                  v-if="media_placeholder(message)"
                  class="support-message-placeholder text-muted">
                  {{ media_placeholder(message) }}
                </div>
                <!-- La hora también acompaña cada mensaje entrante; los ticks siguen siendo solo salientes. -->
                <div v-if="!is_mine(message) || has_bubble_ticks(message)" class="support-message-footer">
                  <span class="support-message-time">{{ format_read_time(message_datetime(message)) }}</span>
                  <message-ticks v-if="has_bubble_ticks(message)" :message="message" :ticket="ticks_ticket" />
                </div>
                </div>
              </border-progress-wrap>
              <!-- Reaccionar a un mensaje del cliente (solo tickets de WhatsApp): el botón aparece
                   al pasar el mouse y en pantallas táctiles está siempre visible. -->
              <button
                v-if="can_react(message)"
                type="button"
                class="support-react-btn"
                :class="{ 'support-react-btn--open': reaction_bar_message_id === message.id }"
                :disabled="reacting_message_id !== null"
                title="Reaccionar"
                aria-label="Reaccionar a este mensaje"
                aria-haspopup="true"
                :aria-expanded="reaction_bar_message_id === message.id ? 'true' : 'false'"
                @click="toggle_reaction_bar(message)">
                <i class="bi bi-emoji-smile" aria-hidden="true"></i>
              </button>
              </div>
              <!-- Barra de reacciones: abierta debajo de la burbuja (en el flujo, para que el
                   scroll del hilo no la recorte). Elegir el mismo emoji que ya está puesto lo quita. -->
              <div
                v-if="can_react(message) && reaction_bar_message_id === message.id"
                class="support-reaction-bar support-reaction-zone"
                role="group"
                aria-label="Elegí una reacción">
                <button
                  v-for="emoji in reaction_emojis"
                  :key="emoji"
                  type="button"
                  class="support-reaction-option"
                  :class="{ 'support-reaction-option--active': is_current_reaction(message, emoji) }"
                  :aria-pressed="is_current_reaction(message, emoji) ? 'true' : 'false'"
                  :disabled="reacting_message_id !== null"
                  @click="react_with(message, emoji)">{{ emoji }}</button>
              </div>
              <!-- Chip con la reacción puesta por el operador, bajo la burbuja. -->
              <button
                v-if="reaction_of(message)"
                type="button"
                class="support-reaction-chip"
                :disabled="!can_react(message) || reacting_message_id !== null"
                :title="can_react(message) ? 'Tu reacción. Tocá para quitarla.' : 'Tu reacción'"
                @click="react_with(message, reaction_of(message))">{{ reaction_of(message) }}</button>

              <!-- Borrador del agente esperando aprobación: se lee, se corrige y se manda acá.
                   Con ai_auto_send_at en null no hay contador, porque no se manda solo. -->
              <div v-if="is_ai_draft_message(message)" class="support-ai-draft-actions">
                <template v-if="editing_draft_id === message.id">
                  <textarea
                    v-model="draft_edit_text"
                    class="form-control form-control-sm support-ai-draft-textarea"
                    rows="4"
                    :disabled="draft_busy"></textarea>
                  <div class="support-ai-draft-buttons">
                    <button
                      type="button"
                      class="btn btn-sm btn-success"
                      :disabled="draft_busy || !draft_edit_text.trim()"
                      @click="send_draft(message, draft_edit_text)">
                      Enviar con mis ajustes
                    </button>
                    <button
                      type="button"
                      class="btn btn-sm btn-outline-secondary"
                      :disabled="draft_busy"
                      @click="cancel_draft_edit()">
                      Cancelar
                    </button>
                  </div>
                </template>
                <template v-else>
                  <span class="support-ai-draft-label">
                    {{ is_ai_draft_auto_send_active(message) ? 'Se envía solo en unos segundos' : 'Esperando tu aprobación' }}
                  </span>
                  <div class="support-ai-draft-buttons">
                    <button
                      type="button"
                      class="btn btn-sm btn-success"
                      :disabled="draft_busy"
                      @click="send_draft(message, null)">
                      Enviar
                    </button>
                    <button
                      type="button"
                      class="btn btn-sm btn-outline-primary"
                      :disabled="draft_busy"
                      @click="start_draft_edit(message)">
                      Editar
                    </button>
                    <button
                      type="button"
                      class="btn btn-sm btn-outline-danger"
                      :disabled="draft_busy"
                      @click="$emit('discard-draft', message)">
                      Descartar
                    </button>
                  </div>
                </template>
              </div>

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
        </div>
      </div>
      <!-- Aviso de ventana vencida. Va al final del hilo y no en el pie de la pantalla para que
           quede pegado a lo último que se dijo: es la respuesta a "por qué no puedo contestar
           esto", y ahí es donde el operador está mirando. -->
      <div v-if="!whatsapp_window_open" class="support-window-closed-notice">
        <i class="bi bi-clock-history" aria-hidden="true" />
        <div class="support-window-closed-text">
          <strong>Pasaron más de 24hs desde el último mensaje del cliente.</strong>
          Meta no deja mandar texto libre hasta que el cliente vuelva a escribir. Para retomar la
          conversación tenés que mandarle una plantilla aprobada.
        </div>
        <button
          type="button"
          class="btn btn-sm btn-outline-primary support-window-closed-btn"
          @click="template_modal_visible = true">
          Elegir plantilla
        </button>
      </div>
      <div
        ref="scroll_end_anchor"
        class="support-conversation-scroll-end"
        aria-hidden="true" />
      </template>
    </div>

    <image-lightbox
      :zoom_enabled="true"
      :show="image_preview_visible"
      :image_url="image_preview_url"
      @update:show="image_preview_visible = $event"
      @close="on_image_preview_close" />

    <support-template-picker-modal
      :show="template_modal_visible"
      :ticket_id="active_ticket_id"
      @update:show="template_modal_visible = $event"
      @sent="on_template_sent" />
  </div>
</template>

<script>
import api from '@/utils/axios'
import ImageLightbox from '@/components/common/ImageLightbox.vue'
import AudioPlayer from '@/components/lead/conversation/AudioPlayer.vue'
import BorderProgressWrap from '@/components/support/BorderProgressWrap.vue'
import MessageTicks from '@/components/support/MessageTicks.vue'
import SupportTemplatePickerModal from '@/components/support/SupportTemplatePickerModal.vue'
import lead_conversation_date_dividers from '@/mixins/lead_conversation_date_dividers'
import {
  media_type_of,
  attachment_open_url,
  attachment_download_url,
  attachment_display_name,
  attachment_audio_src,
  attachment_icon_class,
  browser_can_play_ogg_opus,
} from '@/utils/support_media'
import {
  REACTION_EMOJIS,
  ticks_state,
  can_react_to_message,
  admin_reaction_of,
  same_emoji,
} from '@/utils/support_ticks'
import '@/styles/whatsapp-conversation-wallpaper.css'
import '@/styles/whatsapp-date-divider.css'

export default {
  name: 'SupportConversation',
  components: {
    ImageLightbox,
    AudioPlayer,
    BorderProgressWrap,
    MessageTicks,
    SupportTemplatePickerModal,
  },
  /* Secciones por día (message_date_sections) a partir del computed sorted_messages. */
  mixins: [lead_conversation_date_dividers],
  emits: ['retry-message', 'send-draft', 'discard-draft'],
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
    /** true mientras corre el POST de aprobar o descartar un borrador. */
    draft_busy: { type: Boolean, default: false },
  },
  data() {
    return {
      /** Visor de imagen ampliada abierto. */
      image_preview_visible: false,
      /** URL de la imagen mostrada en el visor. */
      image_preview_url: '',
      /** Id del borrador que se está editando, o null. */
      editing_draft_id: null,
      /** Texto en edición del borrador. El original no se toca hasta aprobar. */
      draft_edit_text: '',
      /** Ventana de 24hs del ticket abierto, tal como la devolvió la API. null = todavía no se sabe. */
      whatsapp_window: null,
      /** GET de la ventana en curso. */
      window_loading: false,
      /** Ticket al que corresponde whatsapp_window: evita repetir el GET del mismo hilo. */
      window_ticket_id: null,
      /** Id del último entrante que ya está contemplado en whatsapp_window. */
      window_last_inbound_id: null,
      /** Selector de plantillas abierto. */
      template_modal_visible: false,
      /** Adjuntos que el navegador no pudo cargar o reproducir: clave (ver media_error_key) -> true. */
      media_errors: {},
      /** true si el navegador reproduce Ogg/Opus de forma nativa (Safari/iOS viejo: false). */
      can_play_ogg_opus: browser_can_play_ogg_opus(),
      /** Emojis de la barra de reacciones. */
      reaction_emojis: REACTION_EMOJIS,
      /** Id del mensaje cuya barra de reacciones está abierta, o null. */
      reaction_bar_message_id: null,
      /** Id del mensaje con un POST de reacción en vuelo, o null (bloquea los demás botones). */
      reacting_message_id: null,
    }
  },
  computed: {
    /**
     * Mensajes del hilo para el mixin de divisores de fecha, en el orden en que vienen del store.
     *
     * Los pendientes del operador (`_client_pending`, el optimista de send_message) no traen
     * `created_at`: sin fecha el mixin los dejaría en una sección sin divisor. Se les completa
     * la hora local en una copia, sin mutar el store, para que caigan en la sección de hoy.
     *
     * @returns {Array<Object>}
     */
    sorted_messages() {
      const list = Array.isArray(this.messages) ? this.messages : []
      const ahora = new Date().toISOString()
      return list.map(function (message) {
        const fecha = message && message.created_at ? new Date(message.created_at) : null
        if (fecha && !isNaN(fecha.getTime())) {
          return message
        }
        return Object.assign({}, message, { created_at: message.delivered_at || ahora })
      })
    },
    /**
     * Ticket abierto en el hilo.
     *
     * Sale del store y no de un prop para no obligar a la pantalla a pasarlo: el store ya lo
     * setea en load_ticket_messages y es el mismo id con el que se pidieron estos mensajes.
     *
     * @returns {number|string|null}
     */
    active_ticket_id() {
      return this.$store.state.support_message.active_ticket_id
    },
    /**
     * Ticket mínimo para <message-ticks>: solo hace falta el origen (los ticks son de WhatsApp).
     *
     * @returns {{source: string|null}}
     */
    ticks_ticket() {
      return { source: this.ticket_source }
    },
    /**
     * Id del último mensaje entrante del hilo. null si el cliente todavía no escribió.
     *
     * @returns {number|string|null}
     */
    last_inbound_message_id() {
      const list = this.messages
      if (!list || !list.length) {
        return null
      }
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].sender_type === 'user' && list[i].id != null) {
          return list[i].id
        }
      }
      return null
    },
    /**
     * true si Meta todavía deja mandar texto libre a este contacto.
     *
     * Se compara expires_at contra el reloj de la pantalla en vez de volver a preguntarle a la
     * API cada minuto: la ventana se vence sola a una hora conocida, y un operador con el ticket
     * abierto tiene que ver el aviso aparecer cuando se vence, no en el próximo refresco.
     *
     * @returns {boolean}
     */
    whatsapp_window_open() {
      if (this.ticket_source !== 'whatsapp' || !this.whatsapp_window) {
        return true
      }
      if (!this.whatsapp_window.open) {
        return false
      }
      const vence = new Date(this.whatsapp_window.expires_at).getTime()
      if (isNaN(vence)) {
        return true
      }
      return vence > this.now_tick
    },
  },
  /**
   * Al montar, posiciona al final (ticket ya cargado o carga inmediata).
   */
  mounted() {
    this.schedule_scroll_to_bottom()
    document.addEventListener('click', this.on_document_click)
    document.addEventListener('keydown', this.on_document_keydown)
  },
  /**
   * Saca los listeners globales de la barra de reacciones.
   */
  beforeUnmount() {
    document.removeEventListener('click', this.on_document_click)
    document.removeEventListener('keydown', this.on_document_keydown)
  },
  watch: {
    /**
     * deep: el store muta el mismo array (push/splice); sin deep el watcher no corre.
     */
    messages: {
      deep: true,
      handler() {
        this.schedule_scroll_to_bottom()
        this.revisar_entrante_nuevo()
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
    /**
     * Al abrir un ticket se pregunta la ventana una sola vez; de ahí en más se vence sola contra
     * el reloj de la pantalla. Lo que quedaba del ticket anterior se descarta acá mismo: un
     * aviso de otro hilo colgado un instante es peor que no mostrar nada.
     */
    active_ticket_id: {
      immediate: true,
      handler() {
        this.template_modal_visible = false
        this.reaction_bar_message_id = null
        this.reacting_message_id = null
        this.whatsapp_window = null
        this.window_ticket_id = null
        this.window_last_inbound_id = this.last_inbound_message_id
        this.fetch_whatsapp_window(false)
      },
    },
    /**
     * El canal puede llegar un instante después del id, porque sale de la fila de la bandeja y
     * no del GET del hilo. Sin este watcher, un ticket abierto desde una notificación se
     * quedaría sin ventana hasta que el operador cambie de hilo y vuelva.
     */
    ticket_source() {
      this.fetch_whatsapp_window(false)
    },
  },
  methods: {
    /**
     * Pide a la API el estado de la ventana de 24hs del ticket abierto.
     *
     * Al ticket del canal Sistema no se le pregunta nada: no tiene ventana de Meta y el aviso
     * no le aplica. Si el GET falla, la ventana queda en null y no se muestra ningún aviso: es
     * preferible callarse a decirle al operador que no puede escribir cuando quizá sí puede.
     *
     * @param {boolean} forzar true para volver a preguntar por un ticket que ya se preguntó
     *   (entró un mensaje del cliente, o se acaba de mandar una plantilla).
     * @returns {void}
     */
    fetch_whatsapp_window(forzar) {
      const ticket_id = this.active_ticket_id
      if (!ticket_id || this.ticket_source !== 'whatsapp') {
        this.whatsapp_window = null
        this.window_ticket_id = null
        this.window_last_inbound_id = null
        this.window_loading = false
        return
      }
      if (!forzar && String(this.window_ticket_id) === String(ticket_id)) {
        return
      }
      const self = this
      this.window_ticket_id = ticket_id
      this.window_loading = true
      api
        .get('/support-ticket/' + ticket_id + '/whatsapp-window', { silent_error: true })
        .then(function (response) {
          // La respuesta puede llegar tarde, con otro ticket ya abierto en pantalla.
          if (String(self.active_ticket_id) !== String(ticket_id)) {
            return
          }
          self.whatsapp_window = (response.data && response.data.window) || null
        })
        .catch(function () {
          if (String(self.active_ticket_id) !== String(ticket_id)) {
            return
          }
          self.whatsapp_window = null
        })
        .then(function () {
          if (String(self.active_ticket_id) !== String(ticket_id)) {
            return
          }
          // El dato que volvió contempla todo lo que hay en el hilo AHORA, no lo que había
          // cuando se pidió: por eso la referencia se toma recién acá.
          self.window_last_inbound_id = self.last_inbound_message_id
          self.window_loading = false
        })
    },
    /**
     * Vuelve a pedir la ventana cuando entró un mensaje del cliente.
     *
     * Un entrante es lo ÚNICO que puede reabrir una ventana cerrada o correrle el vencimiento
     * 24hs para adelante, así que es el único cambio del hilo que justifica otra consulta: un
     * mensaje del operador, un visto o un borrador del agente no la mueven.
     *
     * @returns {void}
     */
    revisar_entrante_nuevo() {
      if (this.ticket_source !== 'whatsapp' || this.window_loading) {
        return
      }
      if (String(this.last_inbound_message_id) === String(this.window_last_inbound_id)) {
        return
      }
      this.fetch_whatsapp_window(true)
    },
    /**
     * La plantilla salió: se cierra el selector y se vuelve a preguntar la ventana.
     *
     * El mensaje NO se agrega a mano al hilo: la API dispara SupportMessageReceived y el socket
     * al que ya está suscripta la pantalla lo empuja solo. Agregarlo acá lo mostraría dos veces.
     *
     * @returns {void}
     */
    on_template_sent() {
      this.template_modal_visible = false
      this.fetch_whatsapp_window(true)
    },
    /**
     * true si el mensaje saliente lleva hora y ticks en el pie de su burbuja: mensaje del
     * operador o del agente, ya enviado por WhatsApp (tiene wamid) en un ticket de WhatsApp.
     *
     * @param {Object} message Mensaje del hilo.
     * @returns {boolean}
     */
    has_bubble_ticks(message) {
      return ticks_state(message, this.ticks_ticket) !== null
    },
    /**
     * true si se puede reaccionar al mensaje (del cliente, con wamid, en un ticket de WhatsApp).
     *
     * @param {Object} message Mensaje del hilo.
     * @returns {boolean}
     */
    can_react(message) {
      return can_react_to_message(message, this.ticket_source)
    },
    /**
     * Emoji que el operador ya puso sobre el mensaje ('' si ninguno).
     *
     * @param {Object} message Mensaje del hilo.
     * @returns {string}
     */
    reaction_of(message) {
      return admin_reaction_of(message)
    },
    /**
     * true si el emoji es la reacción que ya está puesta (se resalta en la barra).
     *
     * @param {Object} message Mensaje del hilo.
     * @param {string} emoji   Emoji de la barra.
     * @returns {boolean}
     */
    is_current_reaction(message, emoji) {
      return same_emoji(admin_reaction_of(message), emoji)
    },
    /**
     * Abre o cierra la barra de reacciones de un mensaje. Si es el último del hilo, vuelve a
     * bajar el scroll para que la barra no quede tapada al pie.
     *
     * @param {Object} message Mensaje del hilo.
     * @returns {void}
     */
    toggle_reaction_bar(message) {
      if (this.reaction_bar_message_id === message.id) {
        this.reaction_bar_message_id = null
        return
      }
      this.reaction_bar_message_id = message.id
      const list = this.messages || []
      const last = list.length ? list[list.length - 1] : null
      if (last && last.id === message.id) {
        this.schedule_scroll_to_bottom()
      }
    },
    /**
     * Manda la reacción (o la quita si es la misma que ya está puesta) y cierra la barra. El
     * store avisa los errores (422: motivo de la API; 404: servidor sin el endpoint) y nunca
     * rechaza; acá solo se libera el bloqueo de botones al terminar.
     *
     * @param {Object} message Mensaje del cliente.
     * @param {string} emoji   Emoji elegido.
     * @returns {void}
     */
    react_with(message, emoji) {
      if (this.reacting_message_id !== null || !this.can_react(message)) {
        return
      }
      const self = this
      this.reaction_bar_message_id = null
      this.reacting_message_id = message.id
      this.$store
        .dispatch('support_message/react_to_message', { message: message, emoji: emoji })
        .then(function () {
          self.reacting_message_id = null
        })
    },
    /**
     * Cierra la barra de reacciones al tocar fuera de la zona de reacciones.
     *
     * @param {Event} event Click del documento.
     * @returns {void}
     */
    on_document_click(event) {
      if (this.reaction_bar_message_id === null) {
        return
      }
      const target = event && event.target
      if (target && typeof target.closest === 'function' && target.closest('.support-reaction-zone')) {
        return
      }
      this.reaction_bar_message_id = null
    },
    /**
     * Esc cierra la barra de reacciones.
     *
     * @param {KeyboardEvent} event Tecla del documento.
     * @returns {void}
     */
    on_document_keydown(event) {
      if (event && event.key === 'Escape' && this.reaction_bar_message_id !== null) {
        this.reaction_bar_message_id = null
      }
    },
    /**
     * Abre la edición del borrador con el texto que propuso el agente.
     *
     * @param {Object} message
     * @returns {void}
     */
    start_draft_edit(message) {
      this.editing_draft_id = message.id
      this.draft_edit_text = String(message.body || '')
    },
    /**
     * Cierra la edición sin mandar nada. El borrador queda como estaba.
     *
     * @returns {void}
     */
    cancel_draft_edit() {
      this.editing_draft_id = null
      this.draft_edit_text = ''
    },
    /**
     * Pide al padre que apruebe el borrador, con o sin ajustes.
     *
     * El texto editado NO se persiste hasta que se aprueba: así no existe el estado
     * "borrador editado pero sin mandar", que es el que se vuelve ambiguo cuando el cliente
     * escribe de nuevo y el borrador se descarta solo.
     *
     * @param {Object}      message
     * @param {string|null} edited_body Texto final, o null para mandar el del agente.
     * @returns {void}
     */
    send_draft(message, edited_body) {
      const final_body = edited_body === null ? null : String(edited_body).trim()
      this.$emit('send-draft', { message: message, body: final_body })
      this.cancel_draft_edit()
    },
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
      /* En WhatsApp los ticks van en el pie de cada burbuja (<message-ticks>), no acá. */
      if (this.ticket_source === 'whatsapp') {
        return false
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
     * Fecha de envío para la hora visible y el tooltip, según el sentido del mensaje.
     */
    message_datetime(message) {
      // En entrantes delivered_at conserva la hora original de WhatsApp; created_at es la recepción.
      return this.is_mine(message) ? message.created_at || message.delivered_at : message.delivered_at || message.created_at
    },
    /** Hora:minuto local para hora de envío y leyenda de visto. */
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
      const raw = this.message_datetime(message)
      const formatted = this.format_sent_datetime(raw)
      if (!formatted) {
        return ''
      }
      return 'Enviado el ' + formatted
    },
    /**
     * Tipo de media de un adjunto (image | audio | video | file), decidido por mime, extensión y kind.
     *
     * @param {Object} message Mensaje del hilo.
     * @param {Object} attachment Adjunto del mensaje.
     * @returns {string}
     */
    attachment_media_type(message, attachment) {
      return media_type_of(message, attachment)
    },
    /**
     * URL para mostrar el adjunto inline: la firmada de la API o, si no vino, /storage/<path>.
     * La base del backend (VITE_BACKEND_BASE_URL o derivada de VITE_API_URL) la resuelve la utilidad.
     *
     * @param {Object} attachment Adjunto del mensaje.
     * @returns {string}
     */
    attachment_open_url(attachment) {
      return attachment_open_url(attachment)
    },
    /**
     * URL para descargar el adjunto (con la API vieja, la misma que la de apertura).
     *
     * @param {Object} attachment Adjunto del mensaje.
     * @returns {string}
     */
    attachment_download_url(attachment) {
      return attachment_download_url(attachment)
    },
    /**
     * Nombre legible del adjunto.
     *
     * @param {Object} attachment Adjunto del mensaje.
     * @returns {string}
     */
    attachment_display_name(attachment) {
      return attachment_display_name(attachment)
    },
    /**
     * Clase de ícono Bootstrap de la tarjeta de archivo.
     *
     * @param {Object} attachment Adjunto del mensaje.
     * @returns {string}
     */
    attachment_icon_class(attachment) {
      return attachment_icon_class(attachment)
    },
    /**
     * Fuente del reproductor de audio: la versión de reproducción (AAC) solo si el navegador no
     * reproduce Ogg/Opus y la API la mandó; en el resto, la URL normal.
     *
     * @param {Object} attachment Adjunto de audio.
     * @returns {string}
     */
    audio_src(attachment) {
      return attachment_audio_src(attachment, this.can_play_ogg_opus)
    },
    /**
     * Clave estable de un adjunto en el v-for. Usa el índice si faltara el id.
     *
     * @param {Object} attachment Adjunto del mensaje.
     * @param {number} attachment_index Posición en message.attachments.
     * @returns {string}
     */
    attachment_key(attachment, attachment_index) {
      return 'att-' + (attachment && attachment.id != null ? attachment.id : 'i' + attachment_index)
    },
    /**
     * Clave con la que se recuerda que un adjunto falló. Lleva la URL: cuando la firma cambia
     * (otro día) o llega la URL nueva de la API, el adjunto se vuelve a intentar solo.
     *
     * @param {Object} attachment Adjunto del mensaje.
     * @returns {string}
     */
    media_error_key(attachment) {
      return String(attachment && attachment.id != null ? attachment.id : '') + '|' + attachment_open_url(attachment)
    },
    /**
     * @param {Object} attachment Adjunto del mensaje.
     * @returns {boolean} true si el navegador ya falló al cargarlo o reproducirlo.
     */
    has_media_error(attachment) {
      return !!this.media_errors[this.media_error_key(attachment)]
    },
    /**
     * Marca el adjunto como fallido: la burbuja muestra el aviso con el enlace de descarga.
     * Se reasigna el objeto completo para que la vista reaccione.
     *
     * @param {Object} attachment Adjunto del mensaje.
     * @returns {void}
     */
    on_media_error(attachment) {
      const next_errors = Object.assign({}, this.media_errors)
      next_errors[this.media_error_key(attachment)] = true
      this.media_errors = next_errors
    },
    /**
     * true si el mensaje es una nota de voz o audio: por sus adjuntos o, sin adjuntos, por el kind.
     *
     * @param {Object} message Mensaje del hilo.
     * @returns {boolean}
     */
    message_is_audio(message) {
      const self = this
      if (this.has_local_attachment(message)) {
        return message.attachments.filter(function (attachment) {
          return self.attachment_media_type(message, attachment) === 'audio'
        }).length > 0
      }
      const kind = String((message && message.kind) || '').toLowerCase()
      return kind === 'audio' || kind === 'ptt' || kind === 'voice'
    },
    /**
     * Ancho de burbuja fijo para video y audio: sin eso la burbuja se encoge al texto y el
     * reproductor queda aplastado. Con max-width 100% sigue respetando el ancho de la columna.
     *
     * @param {Object} message Mensaje del hilo.
     * @returns {boolean}
     */
    bubble_has_wide_media(message) {
      const self = this
      if (!this.has_local_attachment(message)) {
        return false
      }
      return message.attachments.filter(function (attachment) {
        const type = self.attachment_media_type(message, attachment)
        return type === 'audio' || type === 'video'
      }).length > 0
    },
    /**
     * Texto del cuerpo que va ARRIBA de los adjuntos. Se omite cuando:
     * - hay imagen remota de Kapso (el body es el texto largo con la URL);
     * - el mensaje es un audio entrante (su body es la transcripción y va debajo del reproductor);
     * - el body repite el placeholder que la burbuja ya muestra ("[Audio]", "[Video]"...).
     *
     * @param {Object} message Mensaje del hilo.
     * @returns {string} Texto a mostrar o cadena vacía.
     */
    visible_body(message) {
      if (!message || !message.body || this.should_hide_body_for_remote_image(message)) {
        return ''
      }
      if (!this.is_mine(message) && this.message_is_audio(message)) {
        return ''
      }
      const placeholder = this.media_placeholder(message)
      if (placeholder && String(message.body).trim().toLowerCase() === placeholder.toLowerCase()) {
        return ''
      }
      return message.body
    },
    /**
     * Transcripción de un audio entrante (message.body), o cadena vacía. Un body que es solo un
     * placeholder entre corchetes ("[Audio]") no es una transcripción y no se muestra.
     *
     * @param {Object} message Mensaje del hilo.
     * @returns {string}
     */
    transcription_text(message) {
      if (!message || !message.body || this.is_mine(message) || !this.message_is_audio(message)) {
        return ''
      }
      const text = String(message.body).trim()
      if (!text || /^\[[^\]]*\]$/.test(text)) {
        return ''
      }
      return text
    },
    /**
     * Placeholder de un mensaje multimedia cuyo archivo no está guardado (y, si es imagen, sin
     * imagen remota de Kapso ni texto). Cadena vacía si no corresponde.
     *
     * @param {Object} message Mensaje del hilo.
     * @returns {string} '[Imagen]' | '[Audio]' | '[Video]' | '[Documento]' | '[Sticker]' | '[Archivo]' | ''
     */
    media_placeholder(message) {
      if (!message || this.has_local_attachment(message)) {
        return ''
      }
      const kind = String(message.kind || '').toLowerCase()
      if (kind === 'image') {
        if (this.remote_image_url_from_message(message) || message.body) {
          return ''
        }
        return '[Imagen]'
      }
      if (kind === 'audio' || kind === 'ptt' || kind === 'voice') {
        return '[Audio]'
      }
      if (kind === 'video') {
        return '[Video]'
      }
      if (kind === 'document') {
        return '[Documento]'
      }
      if (kind === 'sticker') {
        return '[Sticker]'
      }
      if (kind === 'file') {
        return '[Archivo]'
      }
      return ''
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

/*
  Sin `background` acá: el atajo pisaría el background-image de
  .whatsapp-conversation-wallpaper, que es la clase que pinta el fondo del hilo.
 */
.support-conversation-body {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
  position: relative;
}

/* Ocupa el área scroll mientras se espera el GET de la conversación.
   El velo va en el beige del wallpaper para que abrir un ticket no destelle en gris. */
.support-conversation-loading {
  position: absolute;
  inset: 0;
  z-index: 2;
  min-height: 8rem;
  background: rgba(239, 234, 226, 0.92);
}

/* El flujo de secciones ya separa con gap: las filas no suman su margen propio. */
.support-messages-flow .support-message-row {
  margin-bottom: 0;
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

/* Verde de WhatsApp: sobre el beige del wallpaper contrasta bastante más que el #dff7df
   que se usaba cuando el fondo era gris claro. */
.support-message-row.mine .support-message-bubble {
  background: #d9fdd3;
}

/* Fila burbuja + botón de reaccionar. Sin botón (mensajes propios, tickets del ERP) es un bloque
   común y la burbuja se comporta igual que antes. */
.support-message-bubble-row {
  max-width: 100%;
  min-width: 0;
}

.support-message-bubble-row--react {
  display: flex;
  align-items: flex-end;
  gap: 4px;
}

/* Con botón al costado, la burbuja ya no ocupa el 100% de la columna: se achica lo necesario. */
.support-message-bubble-row--react :deep(.border-progress-wrap--bubble) {
  width: auto;
  flex: 0 1 auto;
  min-width: 0;
}

/* Hora en todas las burbujas entrantes y ticks en las salientes de WhatsApp. */
.support-message-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  margin-top: 2px;
  font-size: 11px;
  line-height: 1;
  color: #667781;
}

/* Botón de reaccionar: invisible hasta pasar el mouse por la fila (conserva su lugar para no
   mover el texto), siempre visible en pantallas táctiles y en teléfono. */
.support-react-btn {
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  color: #667781;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s ease;
}

.support-message-row:hover .support-react-btn,
.support-react-btn:focus-visible,
.support-react-btn--open {
  opacity: 1;
}

.support-react-btn:hover:not(:disabled) {
  background: #fff;
  color: #212529;
}

.support-react-btn:disabled {
  cursor: default;
}

@media (hover: none), (pointer: coarse), (max-width: 767.98px) {
  /* Táctil: sin hover, el botón se ve siempre y tiene tamaño de toque (>= 32 px). */
  .support-react-btn {
    opacity: 1;
    width: 34px;
    height: 34px;
    font-size: 1.1rem;
  }
}

/* Barra con las seis reacciones, abierta debajo de la burbuja del cliente. */
.support-reaction-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  max-width: 100%;
  margin-top: 4px;
  padding: 3px 6px;
  background: #fff;
  border: 1px solid #e6e6e6;
  border-radius: 999px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.support-reaction-option {
  min-width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  font-size: 1.35rem;
  line-height: 1;
  cursor: pointer;
  transition: transform 0.1s ease, background 0.1s ease;
}

.support-reaction-option:hover:not(:disabled) {
  background: #f0f2f5;
  transform: scale(1.15);
}

/* La reacción que ya está puesta se resalta (elegirla de nuevo la quita). */
.support-reaction-option--active {
  background: #d9fdd3;
}

.support-reaction-option:disabled {
  opacity: 0.5;
  cursor: default;
}

/* Chip con la reacción del operador, pegado bajo la burbuja del cliente. */
.support-reaction-chip {
  position: relative;
  z-index: 1;
  align-self: flex-start;
  margin: -6px 0 0 10px;
  min-height: 24px;
  padding: 0 7px;
  border: 1px solid #e6e6e6;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
  font-size: 0.95rem;
  line-height: 1;
  cursor: pointer;
}

.support-reaction-chip:disabled {
  cursor: default;
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

/* Burbuja con audio o video: ancho propio (no se encoge al texto) pero nunca más que la columna
   (80% del hilo), así que en teléfono ocupa todo lo que le deja la fila. */
.support-message-bubble--media {
  width: 300px;
  max-width: 100%;
  box-sizing: border-box;
}

/* Cada adjunto de la burbuja; los que siguen al primero se separan un poco. */
.support-media {
  max-width: 100%;
}

.support-media + .support-media {
  margin-top: 4px;
}

/* El reproductor de leads trae su propio margen inferior y un ancho máximo de 320px. */
.support-media :deep(.wa-audio-player) {
  max-width: 100%;
  box-sizing: border-box;
}

/* Video: ocupa el ancho de la burbuja y mantiene la proporción; el alto tope evita que un video
   vertical se coma la pantalla del teléfono. */
.support-message-video {
  display: block;
  width: 100%;
  height: auto;
  max-height: 320px;
  border-radius: 6px;
  background: #000;
}

/* Aviso cuando una imagen, audio o video no se pudo cargar: una línea con el enlace de descarga. */
.support-media-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #6c757d;
}

/* Tarjeta de documento: ícono, nombre (parte palabras largas) y flecha de descarga. */
.support-file-card {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.05);
  color: inherit;
  text-decoration: none;
}

.support-file-card:hover {
  background: rgba(0, 0, 0, 0.09);
  color: inherit;
  text-decoration: none;
}

.support-file-card-icon {
  flex-shrink: 0;
  font-size: 1.35rem;
}

.support-file-card-name {
  min-width: 0;
  font-size: 13px;
  line-height: 1.25;
  word-break: break-word;
}

.support-file-card-download {
  flex-shrink: 0;
  font-size: 1rem;
  opacity: 0.65;
}

/* Transcripción del audio: chica y atenuada, con rótulo, debajo del reproductor. */
.support-message-transcription {
  display: flex;
  flex-direction: column;
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.35;
  color: #6c757d;
}

.support-message-transcription-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  opacity: 0.8;
}

.support-message-transcription-text {
  white-space: pre-wrap;
  word-break: break-word;
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

.support-ai-draft-actions {
	display: flex;
	flex-direction: column;
	gap: 6px;
	margin-top: 6px;
	max-width: 100%;
}
.support-ai-draft-label {
	font-size: 11px;
	color: var(--bs-secondary-color, #6c757d);
}
.support-ai-draft-buttons {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
}
.support-ai-draft-textarea {
	font-size: 13px;
}

/* Cartel del sistema al pie del hilo: centrado, angosto y amarillo justamente para que no se
   lea como la burbuja de nadie. */
.support-window-closed-notice {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 8px;
  max-width: 520px;
  margin: 12px auto;
  padding: 10px 12px;
  background: #fff8e1;
  border: 1px solid #ffe08a;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.4;
  color: #664d03;
}

.support-window-closed-notice > i {
  flex-shrink: 0;
  font-size: 15px;
  line-height: 1.4;
}

.support-window-closed-text {
  flex: 1 1 220px;
  min-width: 0;
}

.support-window-closed-text strong {
  display: block;
}

.support-window-closed-btn {
  flex-shrink: 0;
  align-self: center;
  margin-left: auto;
  white-space: nowrap;
  font-size: 12px;
}
</style>
