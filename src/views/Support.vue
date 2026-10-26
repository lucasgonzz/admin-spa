<template>
  <!--
    Altura: ocupa el alto visible del contenedor (viewport menos padding de main;
    overflow: hidden para que solo conversación y listado lateral tengan scroll).
  -->
  <!--
    Teléfono (<768px): en /soporte se ve solo la bandeja; tocar un ticket abre
    /soporte/ticket/:id, donde se ve solo la conversación a pantalla completa, como en leads.
    Escritorio: bandeja y conversación lado a lado en las dos rutas.
  -->
  <div class="support-view d-flex w-100" :class="support_view_class">

    <!-- Parte izquierda -->
    <div class="support-left d-flex flex-column min-h-0">
      <div class="support-left-top flex-shrink-0">
        <user-tickets-nav />
        <!--
          Chip del filtro que llegó por deep link desde el panel de inicio. Sin él el operador ve
          una bandeja corta y no sabe por qué.
        -->
        <div v-if="filtro_activo" class="support-filtro-chip px-2 py-2 border-bottom">
          <span class="badge rounded-pill text-bg-primary d-inline-flex align-items-center">
            {{ filtro_rotulo }}
            <button
              type="button"
              class="btn btn-sm btn-link p-0 ms-2 text-white lh-1 text-decoration-none"
              title="Quitar el filtro"
              aria-label="Quitar el filtro"
              @click="quitar_filtro"
            >
              <i class="bi bi-x-lg" aria-hidden="true" />
            </button>
          </span>
          <!--
            El aviso de API vieja pide `tickets.length`: durante la primera carga la bandeja
            todavía está vacía y `api_manda_indicadores` da false por falta de filas, no porque
            el servidor no mande el flag. Sin esta guarda el aviso parpadeaba en cada entrada.
          -->
          <p
            v-if="!tickets_loading && tickets.length && !api_manda_indicadores"
            class="text-muted small mb-0 mt-1"
          >
            Este servidor todavía no marca los tickets: se muestra la bandeja completa.
          </p>
          <p v-else-if="!tickets_loading && !tickets_visibles.length" class="text-muted small mb-0 mt-1">
            Ningún ticket con este filtro.
          </p>
        </div>
      </div>
      <ticket-list
        :tickets="tickets_visibles"
        :loading="tickets_loading"
        :selected_ticket_id="selected_ticket_id"
        :support_alert_minutes="support_alert_minutes"
        :now_tick="now_tick"
        @select-ticket="on_ticket_list_select"
        @create-ticket="create_ticket" />
    </div>


    <!-- Parte derecha -->
    <div class="support-right d-flex flex-column min-h-0 min-w-0 flex-grow-1">
      <div class="support-right-top flex-shrink-0">
        <conversation-header
          :selected_ticket="selected_ticket"
          :ticket_name_draft="ticket_name_draft"
          :assigned_admin_id="assigned_admin_id"
          :ticket_status_draft="ticket_status_draft"
          :admin_rows="admin_assign_options"
          :saving_header="saving_header"
          :saving_agent_controls="saving_agent_controls"
          :ai_suggestion_loading="loading_suggestion"
          :ai_suggestion_disabled="ai_suggestion_disabled"
          :ai_consult_timer="active_ai_consult_timer_for_input"
          :show_back="is_mobile && is_conversation_route"
          @update:ticket_name_draft="set_header_ticket_name_draft"
          @update:assigned_admin_id="set_header_assigned_admin_id"
          @update:ticket_status_draft="set_header_ticket_status_draft"
          @save-header="save_header"
          @exit-ticket="on_exit_ticket"
          @back="volver_a_la_lista"
          @toggle-agent="toggle_agent"
          @toggle-verification="toggle_verification"
          @request-suggestion="request_suggestion" />
      </div>
      <div class="support-right-middle flex-grow-1 min-h-0 d-flex flex-column overflow-hidden">
        <conversation
          :messages="messages"
          :loading="messages_loading"
          :ticket_source="selected_ticket ? selected_ticket.source : null"
          :now_tick="now_tick"
          :draft_busy="draft_busy"
          @retry-message="on_retry_message"
          @send-draft="on_send_draft"
          @discard-draft="on_discard_draft" />
      </div>
      <div class="support-right-bottom flex-shrink-0">
        <message-input
          ref="message_input"
          :can_send="can_send_message"
          :ai_suggestion_send_at="selected_ticket_ai_send_at"
          :suggestion_error="suggestion_error"
          :ai_reasoning="ai_reasoning"
          @send-message="send_message" />
      </div>
    </div>

    <create-ticket-modal
      :show="create_ticket_modal_visible"
      :assigned_admin_id="current_admin_id"
      @update:show="create_ticket_modal_visible = $event"
      @created="on_ticket_created" />
    
  </div>
</template>

<script>
import TicketList from '@/components/support/TicketList.vue'
import Conversation from '@/components/support/Conversation.vue'
import ConversationHeader from '@/components/support/ConversationHeader/ConversationHeader.vue'
import MessageInput from '@/components/support/MessageInput.vue'
import UserTicketsNav from '@/components/support/UserTicketsNav.vue'
import CreateTicketModal from '@/components/support/CreateTicketModal.vue'
import { useSupportSocket } from '@/composables/useSupportSocket'
import api from '@/utils/axios'
import { cached_get, MAX_AGE_SETTINGS } from '@/common-vue/helpers/request_cache_helper'

export default {
  name: 'ViewSupport',
  components: {
    TicketList,
    Conversation,
    ConversationHeader,
    MessageInput,
    UserTicketsNav,
    CreateTicketModal,
  },
  data() {
    return {
      /**
       * Ticket seleccionado en la bandeja lateral.
       */
      selected_ticket_id: null,
      /**
       * Admin asignado al ticket actual.
       */
      assigned_admin_id: null,
      /**
       * Cleanup de canales Pusher (se reemplaza al cambiar admin o ticket).
       */
      support_socket_instance: null,
      /**
       * Borrador de nombre al editar el ticket activo.
       */
      ticket_name_draft: '',
      /**
       * Estado local del ticket (open | closed) antes del PUT del header.
       */
      ticket_status_draft: 'open',
      /**
       * Mientras se persiste nombre, asignación y estado del header vía API.
       */
      saving_header: false,
      /**
       * Timer para agrupar refrescos de badges tras varios mark-read seguidos.
       */
      unread_badges_debounce_timer: null,
      /** POST de sugerencia IA en curso (el botón vive en el header). */
      loading_suggestion: false,
      /** Motivo del último fallo al pedir sugerencia; se muestra arriba del composer. */
      suggestion_error: '',
      /** Razonamiento devuelto por Claude en la última sugerencia. */
      ai_reasoning: '',
      /** Umbral de alerta de demora (minutos). */
      support_alert_minutes: 30,
      /** Tick reactivo para recalcular badges cada minuto. */
      now_tick: Date.now(),
      /** Interval id del tick de badges. */
      now_tick_interval_id: null,
      /** Estado del debounce previo a Claude por ticket (desde Pusher). */
      ai_consult_timer: null,
      /** Ticket cuyo job está consultando a Claude en este momento. */
      ai_generating_ticket_id: null,
      /** POST de alguno de los dos interruptores del agente en curso. */
      saving_agent_controls: false,
      /** POST de aprobar o descartar un borrador en curso. */
      draft_busy: false,
      /** Modal de alta manual de ticket (select de cliente). */
      create_ticket_modal_visible: false,
      /** Ancho de teléfono (<768px): bandeja y conversación van en pantallas separadas. */
      is_mobile: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
    }
  },
  computed: {
    /**
     * true en /soporte/ticket/:ticket_id (conversación a pantalla completa en teléfono).
     *
     * @returns {boolean}
     */
    is_conversation_route() {
      return !!(this.$route && this.$route.name === 'support_ticket_conversation')
    },
    /**
     * Id del ticket que viene en la ruta de conversación; null en /soporte.
     *
     * @returns {string|null}
     */
    route_ticket_id() {
      if (!this.is_conversation_route || !this.$route.params) {
        return null
      }
      const id = this.$route.params.ticket_id
      return id == null || id === '' ? null : String(id)
    },
    /**
     * Clases del contenedor según ancho y ruta (ver el comentario del template).
     *
     * @returns {Object}
     */
    support_view_class() {
      return {
        'support-view--fullscreen': this.is_conversation_route,
        'support-view--mobile-list': this.is_mobile && !this.is_conversation_route,
        'support-view--mobile-conversation': this.is_mobile && this.is_conversation_route,
      }
    },
    /**
     * Tickets cargados desde módulo Vuex de soporte.
     */
    tickets() {
      return this.$store.state.support_ticket.models
    },
    /**
     * Filtro que llegó por la query (`?filtro=`), normalizado. Cualquier otro valor se ignora:
     * la bandeja se muestra completa y sin chip.
     *
     * @returns {'sin-responder'|'hoy'|null}
     */
    filtro_activo() {
      const valor = this.$route && this.$route.query ? this.$route.query.filtro : null
      const normalizado = String(valor == null ? '' : valor)
      if (normalizado === 'sin-responder' || normalizado === 'hoy') {
        return normalizado
      }
      return null
    },
    /**
     * Rótulo del chip del filtro activo.
     *
     * @returns {string}
     */
    filtro_rotulo() {
      if (this.filtro_activo === 'sin-responder') {
        return 'Solo sin responder'
      }
      if (this.filtro_activo === 'hoy') {
        return 'Abiertos hoy'
      }
      return ''
    },
    /**
     * Clave que manda la API para el filtro activo.
     *
     * 🔴 El filtro usa el flag de la API y NO un criterio recalculado acá: si se mirara
     * `lastMessage` a mano, los borradores de IA contarían como respuesta y el número de la
     * tarjeta de inicio y la cantidad de filas se separarían sin que nada lo avise.
     *
     * @returns {string|null}
     */
    clave_del_filtro() {
      if (this.filtro_activo === 'sin-responder') {
        return 'sin_responder'
      }
      if (this.filtro_activo === 'hoy') {
        return 'abierto_hoy'
      }
      return null
    },
    /**
     * Indica si la API manda los indicadores de inicio en las filas de la bandeja.
     *
     * 🔴 Compatibilidad hacia atrás: se mira si la clave está DEFINIDA en alguna fila, no fila
     * por fila. Con una API vieja (SPA nuevo, API todavía no desplegada) ninguna fila la trae y
     * filtrar dejaría la lista vacía, que es un falso "no hay nada".
     *
     * @returns {boolean}
     */
    api_manda_indicadores() {
      const clave = this.clave_del_filtro
      if (!clave) {
        return false
      }
      return (this.tickets || []).some(function (ticket) {
        return !!ticket && ticket[clave] !== undefined
      })
    },
    /**
     * Tickets que se muestran en la bandeja: la lista completa, o acotada al filtro del deep link.
     *
     * @returns {Array<Object>}
     */
    tickets_visibles() {
      const clave = this.clave_del_filtro
      if (!clave || !this.api_manda_indicadores) {
        return this.tickets
      }
      return (this.tickets || []).filter(function (ticket) {
        return !!(ticket && ticket[clave])
      })
    },
    /**
     * Mensajes del ticket activo.
     */
    messages() {
      return this.$store.state.support_message.models
    },
    /**
     * Listado de tickets en carga (get_models / filtro).
     */
    tickets_loading() {
      return this.$store.state.support_ticket.loading
    },
    /**
     * Mensajes del ticket activo en carga (GET conversación).
     */
    messages_loading() {
      return this.$store.state.support_message.messages_loading
    },
    /**
     * Ticket actualmente seleccionado.
     *
     * ⚠️ Busca sobre `tickets` (la lista COMPLETA) y no sobre `tickets_visibles`: el ticket que
     * llega por `?ticket_id=` puede no cumplir el filtro del deep link, y buscándolo en la lista
     * filtrada quedaría seleccionado y sin datos.
     */
    selected_ticket() {
      return this.tickets.find((ticket) => ticket.id == this.selected_ticket_id)
    },
    /**
     * ID del admin autenticado.
     */
    current_admin_id() {
      return this.$store.state.auth.admin ? this.$store.state.auth.admin.id : null
    },
    /**
     * Solo permite enviar con ticket abierto.
     */
    can_send_message() {
      return this.selected_ticket && this.selected_ticket.status == 'open'
    },
    /**
     * Timestamp ISO del envío automático de sugerencia IA (si hay timer activo).
     *
     * @returns {string|null}
     */
    selected_ticket_ai_send_at() {
      if (!this.selected_ticket || !this.selected_ticket.ai_suggestion_send_at) {
        return null
      }
      return String(this.selected_ticket.ai_suggestion_send_at)
    },
    /**
     * Timer de debounce antes de Claude para el ticket activo (animación del botón IA).
     *
     * @returns {Object|null}
     */
    active_ai_consult_timer_for_input() {
      if (!this.ai_consult_timer || !this.selected_ticket_id) {
        return null
      }
      if (String(this.ai_consult_timer.ticket_id) !== String(this.selected_ticket_id)) {
        return null
      }
      const consult_ms = new Date(this.ai_consult_timer.consult_at).getTime()
      const delay_seconds = parseFloat(this.ai_consult_timer.delay_seconds) || 0
      const started_ms = consult_ms - delay_seconds * 1000
      const elapsed_seconds = Math.max(0, (this.now_tick - started_ms) / 1000)
      const still_active = !isNaN(consult_ms) && this.now_tick < consult_ms && !this.ai_generating_for_selected_ticket

      return {
        active: still_active,
        delay_seconds: delay_seconds,
        elapsed_seconds: elapsed_seconds,
        schedule_token: this.ai_consult_timer.schedule_token,
      }
    },
    /**
     * Indica si el botón de sugerencia IA del header está inhabilitado.
     *
     * @returns {boolean}
     */
    ai_suggestion_disabled() {
      return (
        !this.can_send_message ||
        !this.selected_ticket_id ||
        this.loading_suggestion ||
        this.ai_generating_for_selected_ticket
      )
    },
    /**
     * Indica si Claude está generando sugerencia para el ticket abierto.
     *
     * @returns {boolean}
     */
    ai_generating_for_selected_ticket() {
      if (!this.ai_generating_ticket_id || !this.selected_ticket_id) {
        return false
      }
      return String(this.ai_generating_ticket_id) === String(this.selected_ticket_id)
    },
    /**
     * UUID del Client (tenant) del ticket abierto: habilita canal support.client.* en Pusher.
     */
    support_socket_client_uuid() {
      if (!this.selected_ticket || !this.selected_ticket.client) {
        return null
      }
      return this.selected_ticket.client.uuid || null
    },
    /**
     * Cadena estable para re-suscribir Pusher al cambiar admin o tenant del ticket.
     */
    support_socket_fingerprint() {
      return String(this.current_admin_id || '') + ':' + String(this.support_socket_client_uuid || '')
    },
    /**
     * Filas de operadores con nombre (misma fuente que UserTicketsNav / API index).
     */
    admin_assign_options() {
      const nav = this.$store.state.support_ticket.inbox_nav
      if (!Array.isArray(nav)) {
        return []
      }
      return nav.filter(function (row) {
        return row && row.assigned_admin_id != null && row.assigned_admin_id !== undefined
      })
    },
  },
  watch: {
    /**
     * En la ruta de conversación, si cambia el ticket de la URL (otro ticket desde la bandeja
     * en escritorio, o atrás/adelante del navegador) se abre ese.
     */
    route_ticket_id(value) {
      if (!value || String(value) === String(this.selected_ticket_id)) {
        return
      }
      this.abrir_ticket_de_la_ruta()
    },
    /**
     * Carga suscripción (admin + optional client) cuando haya id de operador o al cambiar de hilo.
     */
    support_socket_fingerprint: {
      immediate: true,
      handler() {
        this.rebuild_support_socket()
      },
    },
  },
  created() {
    const self = this
    this.load_support_alert_minutes()
    this.now_tick_interval_id = window.setInterval(function () {
      self.now_tick = Date.now()
    }, 250)
    /* El ticket del query param se resuelve DESPUÉS de que vuelve la bandeja. Los dos eran
       requests sueltos y el puntual ganaba casi siempre: después llegaba el listado, pisaba el
       array entero (set_models) y seleccionaba tickets[0], así que el link del WhatsApp de
       escalado terminaba abriendo cualquier otro ticket. */
    /* 🔴 Un deep link desde el panel de inicio fuerza la bandeja a 'all' ANTES del get_models.
       La bandeja arranca en 'mine' (store/support_ticket.js) y las tarjetas de inicio cuentan
       global: sin esto la tarjeta diría 3 y el listado mostraría 0 o 1 — el mismo defecto
       "dice 2 y veo una sola fila" que Lucas reportó el 2/9/2026 del lado de leads. */
    if (this.filtro_activo) {
      this.$store.commit('support_ticket/set_assigned_filter', 'all')
    }
    /* Teléfono con ?ticket_id= (link del WhatsApp de escalado): la conversación va en su
       propia pantalla, así que se pasa a la ruta de conversación conservando el filtro. */
    if (this.is_mobile && !this.is_conversation_route && this.$route.query && this.$route.query.ticket_id) {
      this.$router
        .replace({
          name: 'support_ticket_conversation',
          params: { ticket_id: String(this.$route.query.ticket_id) },
          query: this.query_del_filtro(),
        })
        .catch(function () {})
      return
    }
    this.$store.dispatch('support_ticket/get_models').then(function () {
      /* Ruta de conversación: se abre el ticket de la URL y nada más. */
      if (self.is_conversation_route) {
        self.abrir_ticket_de_la_ruta()
        return
      }
      if (self.abrir_ticket_del_query_param()) {
        return
      }
      /* En teléfono /soporte es solo la bandeja: abrir un ticket solo no tiene sentido porque
         la conversación no se ve hasta que el operador toca uno. */
      if (self.is_mobile) {
        return
      }
      /* El auto-seleccionado va sobre la lista YA filtrada: con el filtro puesto, abrir un
         ticket que no cumple sería contradecir lo que se está mostrando. */
      if (self.tickets_visibles.length) {
        self.select_ticket(self.tickets_visibles[0].id)
      }
    })
  },
  mounted() {
    window.addEventListener('support-ticket-alert', this.on_support_ticket_alert)
    window.addEventListener('resize', this.on_window_resize)
  },
  beforeUnmount() {
    window.removeEventListener('support-ticket-alert', this.on_support_ticket_alert)
    window.removeEventListener('resize', this.on_window_resize)
    if (this.unread_badges_debounce_timer) {
      clearTimeout(this.unread_badges_debounce_timer)
    }
    if (this.now_tick_interval_id) {
      clearInterval(this.now_tick_interval_id)
    }
    this.teardown_support_socket()
  },
  methods: {
    /**
     * Recalcula si el ancho es de teléfono al redimensionar o rotar.
     *
     * @returns {void}
     */
    on_window_resize() {
      this.is_mobile = window.innerWidth < 768
    },
    /**
     * Query a conservar al ir y volver entre la bandeja y la conversación: solo el `filtro`
     * del deep link del panel de inicio (el chip tiene que seguir puesto al volver).
     *
     * @returns {Object}
     */
    query_del_filtro() {
      const filtro = this.$route && this.$route.query ? this.$route.query.filtro : null
      return filtro ? { filtro: filtro } : {}
    },
    /**
     * Click en una fila de la bandeja.
     *
     * En teléfono, desde /soporte, abre la conversación en su propia pantalla. En escritorio
     * sobre la ruta de conversación cambia el id de la URL (el watch de route_ticket_id lo abre).
     * En cualquier otro caso selecciona en el lugar, como siempre.
     *
     * @param {number|string} ticket_id
     * @returns {void}
     */
    on_ticket_list_select(ticket_id) {
      if (this.is_conversation_route) {
        if (String(ticket_id) === String(this.route_ticket_id)) {
          return
        }
        this.$router
          .replace({
            name: 'support_ticket_conversation',
            params: { ticket_id: String(ticket_id) },
            query: this.query_del_filtro(),
          })
          .catch(function () {})
        return
      }
      if (this.is_mobile) {
        this.$router
          .push({
            name: 'support_ticket_conversation',
            params: { ticket_id: String(ticket_id) },
            query: this.query_del_filtro(),
          })
          .catch(function () {})
        return
      }
      this.select_ticket(ticket_id)
    },
    /**
     * Vuelve de la conversación a pantalla completa a la bandeja, con el filtro que hubiera.
     *
     * @returns {void}
     */
    volver_a_la_lista() {
      this.$router.push({ name: 'support', query: this.query_del_filtro() }).catch(function () {})
    },
    /**
     * "Salir" del header: en la ruta de conversación vuelve a la bandeja (esa ruta no tiene la
     * barra de navegación); en /soporte solo deselecciona, como siempre.
     *
     * @returns {void}
     */
    on_exit_ticket() {
      if (this.is_conversation_route) {
        this.volver_a_la_lista()
        return
      }
      this.deselect_ticket()
    },
    /**
     * Abre el ticket de /soporte/ticket/:ticket_id.
     *
     * Mismo criterio que abrir_ticket_del_query_param: si no está en la bandeja cargada (el
     * filtro por defecto es "míos"), se lo trae con un GET puntual. Si no se puede traer, se
     * vuelve a la bandeja en vez de dejar una conversación vacía sin explicación.
     *
     * @returns {void}
     */
    abrir_ticket_de_la_ruta() {
      const ticket_id = this.route_ticket_id
      if (!ticket_id) {
        return
      }
      const ya_esta = this.tickets.some(function (ticket) {
        return String(ticket.id) === String(ticket_id)
      })
      if (ya_esta) {
        this.select_ticket(ticket_id)
        return
      }
      const self = this
      api
        .get('/support-ticket/' + ticket_id)
        .then(function (response) {
          const model = response.data && response.data.model
          /* La respuesta puede llegar con otro ticket ya en la URL. */
          if (!model || String(self.route_ticket_id) !== String(ticket_id)) {
            return
          }
          self.$store.commit('support_ticket/upsert_from_broadcast', model)
          self.select_ticket(model.id)
        })
        .catch(function () {
          if (String(self.route_ticket_id) === String(ticket_id)) {
            self.volver_a_la_lista()
          }
        })
    },
    /**
     * GET umbral de alertas para badges en TicketList.
     *
     * @returns {void}
     */
    load_support_alert_minutes() {
      const self = this
      /* Cacheado: este umbral solo cambia cuando alguien lo guarda en /cuenta, y ese PUT invalida
         la entrada. Acá solo se lee, así que no hace falta pedirlo de nuevo en cada entrada al
         módulo. */
      cached_get('/settings/support-alert-minutes', { max_age_ms: MAX_AGE_SETTINGS })
        .then(function (data) {
          const value = parseInt(data && data.value, 10)
          if (!isNaN(value)) {
            self.support_alert_minutes = value
          }
        })
        .catch(function () {})
    },
    /**
     * Le pide a Claude una respuesta para el ticket abierto y la vuelca en el input.
     *
     * El POST vive acá y no en MessageInput porque el botón que lo dispara se mudó al header:
     * este es el único componente que ve a los dos, y además ya tiene el estado del debounce
     * que llega por Pusher (ai_consult_timer, ai_generating_ticket_id).
     *
     * @returns {void}
     */
    request_suggestion() {
      const self = this
      if (!self.selected_ticket_id || self.loading_suggestion) {
        return
      }
      /* El ticket que pidió la sugerencia queda capturado acá y se compara en las tres ramas de
         la promesa. Claude tarda varios segundos: sin esta guarda, pedir una sugerencia en un
         ticket y cambiar de conversación antes de que vuelva le escribe la respuesta del primero
         en el cuadro de texto del segundo -pisando lo que el operador ya hubiera tecleado-, y si
         el segundo todavía no tiene nombre, le mete el título pensado para el otro. Es el mismo
         patrón que usa fetch_whatsapp_window en Conversation.vue. */
      const ticket_id = self.selected_ticket_id
      self.loading_suggestion = true
      self.suggestion_error = ''
      api
        .post('/support-ticket/' + ticket_id + '/suggest')
        .then(function (res) {
          if (String(self.selected_ticket_id) !== String(ticket_id)) {
            return
          }
          const suggested = (res.data && res.data.suggested_message) || ''
          const reasoning = (res.data && res.data.reasoning) || ''
          const suggested_title = (res.data && res.data.suggested_title) || ''
          if (suggested) {
            self.push_body_to_input(suggested)
          }
          if (suggested_title) {
            self.apply_suggested_title(suggested_title)
          }
          self.ai_reasoning = reasoning
          if (!suggested && reasoning) {
            self.suggestion_error = reasoning
          }
        })
        .catch(function (err) {
          if (String(self.selected_ticket_id) !== String(ticket_id)) {
            return
          }
          const msg =
            (err.response && err.response.data && err.response.data.message) ||
            'No se pudo obtener la sugerencia.'
          self.suggestion_error = msg
        })
        .then(function () {
          if (String(self.selected_ticket_id) !== String(ticket_id)) {
            return
          }
          self.loading_suggestion = false
        })
    },
    /**
     * Vuelca el texto sugerido en el textarea del composer.
     *
     * Va por ref y no por un prop porque un prop habría que "des-setear" para poder volcar dos
     * veces seguidas la misma sugerencia.
     *
     * @param {string} texto Texto sugerido por Claude.
     * @returns {void}
     */
    push_body_to_input(texto) {
      if (this.$refs.message_input && texto) {
        this.$refs.message_input.set_body(texto)
      }
    },
    /**
     * Refresca badges de tiempo cuando llega alerta Pusher global.
     *
     * @returns {void}
     */
    on_support_ticket_alert() {
      this.now_tick = Date.now()
    },
    /**
     * Borrador nombre del header (equivalente a v-model: en Vue 3; .sync no existe).
     *
     * @param {string} value Texto del input
     * @returns {void}
     */
    set_header_ticket_name_draft(value) {
      this.ticket_name_draft = value
    },
    /**
     * Completa el borrador del nombre cuando Claude devuelve suggested_title
     * y el ticket aún no tiene título guardado (WhatsApp u otros sin name).
     *
     * @param {string} title Título sugerido por IA
     * @returns {void}
     */
    apply_suggested_title(title) {
      const ticket = this.selected_ticket
      if (!ticket) {
        return
      }
      const stored = ticket.name == null || ticket.name === undefined ? '' : String(ticket.name)
      if (String(stored).trim() !== '') {
        return
      }
      const suggested = String(title || '').trim()
      if (suggested) {
        this.ticket_name_draft = suggested
      }
    },
    /**
     * Borrador admin asignado.
     *
     * @param {number|string|null} value Id de operador o null
     * @returns {void}
     */
    set_header_assigned_admin_id(value) {
      this.assigned_admin_id = value
    },
    /**
     * Borrador estado open/closed.
     *
     * @param {string} value open | closed
     * @returns {void}
     */
    set_header_ticket_status_draft(value) {
      this.ticket_status_draft = value
    },
    /**
     * Actualiza contadores de badges (Míos / Otros) con petición ligera, agrupada en ráfagas.
     */
    schedule_refresh_unread_badges() {
      const self = this
      if (this.unread_badges_debounce_timer) {
        clearTimeout(this.unread_badges_debounce_timer)
      }
      this.unread_badges_debounce_timer = setTimeout(function () {
        self.unread_badges_debounce_timer = null
        self.$store.dispatch('support_ticket/fetch_unread_badges')
      }, 450)
    },
    /**
     * Cierra listeners previos de soporte.
     */
    teardown_support_socket() {
      if (this.support_socket_instance && this.support_socket_instance.disconnect) {
        this.support_socket_instance.disconnect()
      }
      this.support_socket_instance = null
    },
    /**
     * Suscribe canales Pusher: admin asignado + tenant del ticket (ver conversación aunque no seas el asignado).
     */
    rebuild_support_socket() {
      const self = this
      this.teardown_support_socket()
      this.support_socket_instance = useSupportSocket({
        admin_id: this.current_admin_id,
        client_uuid: this.support_socket_client_uuid,
        on_message(message) {
          if (message) {
            self.$store.dispatch('support_ticket/apply_ticket_from_message', message)
            self.schedule_refresh_unread_badges()
          }
          const active_id = self.$store.state.support_message.active_ticket_id
          if (message && active_id && String(message.support_ticket_id) !== String(active_id)) {
            return
          }
          if (message) {
            if (message.is_ai_suggestion_draft) {
              self.ai_generating_ticket_id = null
            }
            self.$store.commit('support_message/add_model', message)
          }
        },
        on_message_read(message) {
          if (message) {
            self.$store.dispatch('support_ticket/apply_ticket_from_message', message)
            self.schedule_refresh_unread_badges()
          }
          const active_id = self.$store.state.support_message.active_ticket_id
          if (message && active_id && String(message.support_ticket_id) !== String(active_id)) {
            return
          }
          if (message) {
            self.$store.commit('support_message/patch_message_read', message)
          }
        },
        on_ai_suggestion_pending(payload) {
          if (!payload || !payload.ticket_id) {
            return
          }
          self.$store.commit('support_ticket/patch_ticket_ai_pending', payload)
          if (String(payload.ticket_id) !== String(self.selected_ticket_id)) {
            return
          }
          self.ai_generating_ticket_id = null
          /* Ya NO se vuelca la sugerencia al input: desde esta misión se aprueba, se edita o
             se descarta desde la propia burbuja. Tenerla en los dos lados hacía ambiguo qué
             se mandaba al apretar Enviar. */
        },
        on_ai_suggestion_scheduled(payload) {
          if (!payload || !payload.ticket_id) {
            return
          }
          self.ai_consult_timer = {
            ticket_id: payload.ticket_id,
            delay_seconds: parseFloat(payload.delay_seconds) || 0,
            consult_at: payload.consult_at,
            schedule_token: payload.schedule_token,
          }
          if (String(payload.ticket_id) === String(self.selected_ticket_id)) {
            self.ai_generating_ticket_id = null
          }
        },
        on_ai_suggestion_generating(payload) {
          if (!payload || !payload.ticket_id) {
            return
          }
          if (String(payload.ticket_id) === String(self.selected_ticket_id)) {
            self.ai_generating_ticket_id = payload.ticket_id
          }
          if (
            self.ai_consult_timer &&
            String(self.ai_consult_timer.ticket_id) === String(payload.ticket_id)
          ) {
            self.ai_consult_timer = null
          }
        },
        on_message_removed(payload) {
          if (!payload || payload.message_id == null) {
            return
          }
          const active_id = self.$store.state.support_message.active_ticket_id
          if (payload.ticket_id && active_id && String(payload.ticket_id) !== String(active_id)) {
            return
          }
          self.$store.commit('support_message/remove_model_by_id', payload.message_id)
        },
      })
    },
    /**
     * Abre ticket y carga su conversación.
     */
    select_ticket(ticket_id) {
      const self = this
      this.selected_ticket_id = ticket_id
      this.ai_consult_timer = null
      this.ai_generating_ticket_id = null
      /* El error y el razonamiento son del ticket anterior: dejarlos colgados haría que el
         operador leyera un motivo de fallo que no tiene nada que ver con el hilo que abrió. */
      this.loading_suggestion = false
      this.suggestion_error = ''
      this.ai_reasoning = ''
      this.$store.dispatch('support_message/load_ticket_messages', ticket_id)
      const ticket = this.tickets.find((t) => t.id == ticket_id)
      if (ticket) {
        this.assigned_admin_id = ticket.assigned_admin_id || this.current_admin_id
        this.ticket_name_draft = ticket.name == null ? '' : String(ticket.name)
        this.ticket_status_draft = ticket.status === 'closed' ? 'closed' : 'open'
      } else {
        this.ticket_name_draft = ''
        this.ticket_status_draft = 'open'
      }
    },
    /**
     * Prende o apaga el agente para el ticket abierto.
     *
     * @returns {void}
     */
    toggle_agent() {
      this.post_agent_toggle('toggle-claude-auto-reply')
    },
    /**
     * Prende o apaga la verificación humana para el ticket abierto.
     *
     * @returns {void}
     */
    toggle_verification() {
      this.post_agent_toggle('toggle-requiere-verificacion')
    },
    /**
     * Manda uno de los dos toggles y refresca la fila del ticket con lo que devuelve la API.
     *
     * Se guarda al toque y no con el botón Guardar del header: ese botón agrupa nombre,
     * asignado y estado, y estos dos son interruptores, no un formulario. Es además lo que
     * hace la conversación de leads.
     *
     * @param {string} endpoint Sufijo de la ruta.
     * @returns {void}
     */
    post_agent_toggle(endpoint) {
      if (this.saving_agent_controls || !this.selected_ticket_id) {
        return
      }
      const self = this
      this.saving_agent_controls = true
      api
        .post('/support-ticket/' + this.selected_ticket_id + '/' + endpoint)
        .then(function (response) {
          const model = response.data && response.data.model
          if (model) {
            self.$store.commit('support_ticket/upsert_from_broadcast', model)
          }
        })
        .catch(function (error) {
          self.mostrar_error_de_borrador(error, 'No se pudo cambiar el interruptor del agente.')
        })
        .then(function () {
          self.saving_agent_controls = false
        })
    },
    /**
     * Aprueba un borrador del agente, con o sin ajustes, y lo manda al cliente.
     *
     * @param {Object} payload message y body (null si va sin ajustes).
     * @returns {void}
     */
    on_send_draft(payload) {
      if (this.draft_busy || !payload || !payload.message) {
        return
      }
      const self = this
      const cuerpo = payload.body === null ? {} : { body: payload.body }
      this.draft_busy = true
      api
        .post('/support-message/' + payload.message.id + '/approve-ai-draft', cuerpo)
        .then(function (response) {
          const datos = response.data || {}
          const model = datos.model
          if (model) {
            self.$store.commit('support_message/patch_message', model)
          }
          self.$store.commit('support_ticket/patch_ticket_ai_pending', {
            ticket_id: self.selected_ticket_id,
            ai_pending_suggestion: null,
            ai_suggestion_send_at: null,
          })
          /* Una respuesta partida puede salir a medias: el cliente recibe las primeras partes y
             las demás quedan en la conversación marcadas como no enviadas. Sin este aviso, el
             operador aprieta Enviar, no ve ningún error, y no tiene por qué mirar si aparecieron
             dos burbujas rojas más abajo. */
          if (datos.partial) {
            window.alert(datos.error)
          }
        })
        .catch(function (error) {
          self.mostrar_error_de_borrador(error, 'No se pudo enviar la sugerencia.')
        })
        .then(function () {
          self.draft_busy = false
        })
    },
    /**
     * Descarta un borrador del agente sin mandarlo.
     *
     * @param {Object} message Borrador a descartar.
     * @returns {void}
     */
    on_discard_draft(message) {
      if (this.draft_busy || !message) {
        return
      }
      const self = this
      this.draft_busy = true
      api
        .post('/support-message/' + message.id + '/discard-ai-draft')
        .then(function () {
          self.$store.commit('support_message/remove_model_by_id', message.id)
          self.$store.commit('support_ticket/patch_ticket_ai_pending', {
            ticket_id: self.selected_ticket_id,
            ai_pending_suggestion: null,
            ai_suggestion_send_at: null,
          })
        })
        .catch(function (error) {
          self.mostrar_error_de_borrador(error, 'No se pudo descartar la sugerencia.')
        })
        .then(function () {
          self.draft_busy = false
        })
    },
    /**
     * Muestra el motivo real que devolvió la API al fallar una acción sobre un borrador.
     *
     * Se comían con un console.log, así que el operador apretaba Enviar, los botones se
     * reactivaban y no pasaba nada: ni el mensaje salía ni había forma de saber por qué.
     *
     * @param {Object} error    Error de axios.
     * @param {string} fallback Texto si la API no mandó motivo.
     * @returns {void}
     */
    mostrar_error_de_borrador(error, fallback) {
      const respuesta = error && error.response
      const detalle = respuesta && respuesta.data ? respuesta.data.error : null
      window.alert(detalle || fallback)
    },
    /**
     * Quita el filtro del deep link: saca `filtro` de la query y la bandeja vuelve completa.
     *
     * Va por `$router.replace` (y no `push`) para no dejar el filtro en el historial: el botón
     * de atrás del navegador tiene que llevar a de dónde vino el operador, no a volver a poner
     * el chip que acaba de sacar.
     *
     * @returns {void}
     */
    quitar_filtro() {
      const query = Object.assign({}, this.$route.query)
      delete query.filtro
      this.$router.replace({ query: query }).catch(function () {})
    },
    /**
     * Abre el ticket que viene en ?ticket_id=, si lo hay.
     *
     * Es lo que hace clickeable el link del WhatsApp de escalado. El ticket puede no estar en
     * la bandeja cargada —el filtro por defecto es "míos" y el escalado bien puede ser de un
     * ticket de otro—, así que si no aparece se lo trae con un GET puntual. Después se limpia
     * el query param para que un refresh no lo vuelva a abrir.
     *
     * @returns {boolean} true si había un ticket que abrir (aunque el GET todavía esté en vuelo).
     */
    abrir_ticket_del_query_param() {
      const ticket_id = this.$route && this.$route.query ? this.$route.query.ticket_id : null
      if (!ticket_id) {
        return false
      }

      const self = this
      const limpiar_query = function () {
        /* Se saca SOLO `ticket_id`: el `filtro` del deep link del panel de inicio tiene que
           sobrevivir, o el chip desaparecería y la bandeja se desfiltraría sola. */
        const query = Object.assign({}, self.$route.query)
        delete query.ticket_id
        self.$router.replace({ query: query }).catch(function () {})
      }

      const ya_esta = this.tickets.some(function (ticket) {
        return String(ticket.id) === String(ticket_id)
      })

      if (ya_esta) {
        this.select_ticket(ticket_id)
        limpiar_query()

        return true
      }

      api
        .get('/support-ticket/' + ticket_id)
        .then(function (response) {
          const model = response.data && response.data.model
          if (!model) {
            return
          }
          self.$store.commit('support_ticket/upsert_from_broadcast', model)
          self.select_ticket(model.id)
        })
        .catch(function () {
          /* Si no se pudo traer, al menos que no quede el panel vacío: se abre el primero de
             la bandeja (ya filtrada) en vez de dejar la conversación en blanco sin explicación. */
          if (self.tickets_visibles.length) {
            self.select_ticket(self.tickets_visibles[0].id)
          }
        })
        .then(limpiar_query)

      return true
    },
    /**
     * Quita la selección: vacía el panel de conversación sin tocar el ticket en el servidor.
     * El operador vuelve a abrir un hilo eligiendo otra fila en la bandeja.
     */
    deselect_ticket() {
      this.selected_ticket_id = null
      this.ai_consult_timer = null
      this.ai_generating_ticket_id = null
      this.loading_suggestion = false
      this.suggestion_error = ''
      this.ai_reasoning = ''
      this.ticket_name_draft = ''
      this.ticket_status_draft = 'open'
      this.assigned_admin_id = this.current_admin_id
      this.$store.commit('support_message/set_active_ticket_id', null)
      this.$store.commit('support_message/set_models', [])
      this.$store.commit('support_message/set_messages_loading', false)
    },
    /**
     * Persiste nombre, operador asignado y estado del ticket en un único PUT.
     * nextTick: deja encolar el último input/change de los controles antes de leer this.*.
     */
    save_header() {
      if (!this.selected_ticket || this.saving_header) {
        return
      }
      const self = this
      this.$nextTick(function () {
        if (!self.selected_ticket || self.saving_header) {
          return
        }
        const name_trimmed = String(self.ticket_name_draft).trim()
        const status_value = self.ticket_status_draft === 'closed' ? 'closed' : 'open'
        self.saving_header = true
        self.$store
          .dispatch('support_ticket/update_ticket', {
            id: self.selected_ticket.id,
            name: name_trimmed || null,
            assigned_admin_id: self.assigned_admin_id,
            status: status_value,
          })
          .then(function (model) {
            if (model) {
              self.ticket_name_draft = model.name == null ? '' : String(model.name)
              self.assigned_admin_id = model.assigned_admin_id != null ? model.assigned_admin_id : self.current_admin_id
              self.ticket_status_draft = model.status === 'closed' ? 'closed' : 'open'
            }
          })
          .catch(function () {
            // El store ya registra el error; los borradores quedan para reintentar.
          })
          .then(function () {
            self.saving_header = false
          })
      })
    },
    /**
     * Envía mensaje; la bandeja se alinea vía Pusher y apply_ticket del store.
     */
    send_message(payload) {
      /* La sugerencia que había en pantalla ya se mandó o se descartó al escribir arriba: dejar
         su error o su razonamiento visibles después del envío no explica nada del mensaje nuevo. */
      this.suggestion_error = ''
      this.ai_reasoning = ''
      this.$store.dispatch('support_message/send_message', payload)
    },
    /**
     * Reintenta POST local o sincronización hacia el empresa-api del cliente.
     * @param {Object} message Mensaje con error de entrega.
     */
    on_retry_message(message) {
      if (message.remote_delivery_status === 'not_received' && message.id != null) {
        this.$store.dispatch('support_message/retry_remote_sync', message)
        return
      }
      this.$store.dispatch('support_message/retry_send_message', message)
    },
    /**
     * Abre el modal de creación de ticket (select de cliente).
     *
     * @returns {void}
     */
    create_ticket() {
      this.create_ticket_modal_visible = true
    },
    /**
     * Tras crear ticket desde el modal, abre el hilo recién creado.
     *
     * @param {number|string} ticket_id
     * @returns {void}
     */
    on_ticket_created(ticket_id) {
      if (ticket_id != null) {
        /* Mismo camino que tocar la fila: en teléfono la conversación vive en su propia ruta y
           seleccionar en el lugar la dejaba abierta detrás de la lista, sin que se viera. */
        this.on_ticket_list_select(ticket_id)
      }
    },
  },
}
</script>

<style scoped>
/* Alto pantalla: resta el padding vertical típico de <main> (p-2 / p-md-3 en App.vue). */
.support-view {
  height: calc(100dvh - 2.5rem);
  max-height: calc(100dvh - 2.5rem);
  min-height: 0;
  box-sizing: border-box;
  overflow: hidden;
}

/* Ruta de conversación (hide_app_nav): <main> va sin padding, así que ocupa todo el alto.
   100dvh y no 100vh: en el teléfono deja el input de mensaje arriba de la barra del navegador. */
.support-view--fullscreen {
  height: 100dvh;
  max-height: 100dvh;
}

/* Teléfono en /soporte: solo la bandeja, a todo el ancho. */
.support-view--mobile-list .support-left {
  width: 100%;
  min-width: 0;
  border-right: none;
}

.support-view--mobile-list .support-right {
  display: none !important;
}

/* Teléfono en la conversación: solo el hilo, a todo el ancho y alto. */
.support-view--mobile-conversation .support-left {
  display: none !important;
}

.support-view--mobile-conversation .support-right {
  width: 100%;
}

.support-left {
  width: 30%;
  border-right: 1px solid #e9ecef;
  min-width: 280px;
}

.support-left-top {
  padding: 8px;
  border-bottom: 1px solid #e9ecef;
}

.support-right {
  /* Columna central de conversación; min-h-0 permite scroll interno. */
  min-width: 0;
  flex: 1 1 0;
}

.support-right-top {
  min-height: 56px;
  border-bottom: 1px solid #e9ecef;
  padding: 8px;
}

.support-right-bottom {
  border-top: 1px solid #e9ecef;
}

</style>
