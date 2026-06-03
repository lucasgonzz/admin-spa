<template>
  <!--
    Altura: ocupa el alto visible del contenedor (viewport menos padding de main;
    overflow: hidden para que solo conversación y listado lateral tengan scroll).
  -->
  <div class="support-view d-flex w-100">

    <!-- Parte izquierda -->
    <div class="support-left d-flex flex-column min-h-0">
      <div class="support-left-top flex-shrink-0">
        <user-tickets-nav />
      </div>
      <ticket-list
        :tickets="tickets"
        :loading="tickets_loading"
        :selected_ticket_id="selected_ticket_id"
        :support_alert_minutes="support_alert_minutes"
        :now_tick="now_tick"
        @select-ticket="select_ticket"
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
          @update:ticket_name_draft="set_header_ticket_name_draft"
          @update:assigned_admin_id="set_header_assigned_admin_id"
          @update:ticket_status_draft="set_header_ticket_status_draft"
          @save-header="save_header"
          @exit-ticket="deselect_ticket"
          @toggle-knowledge-panel="toggle_knowledge_panel" />
      </div>
      <div class="support-right-middle flex-grow-1 min-h-0 d-flex flex-column overflow-hidden">
        <conversation
          :messages="messages"
          :loading="messages_loading"
          :ticket_source="selected_ticket ? selected_ticket.source : null"
          :now_tick="now_tick"
          @retry-message="on_retry_message" />
      </div>
      <div class="support-right-bottom flex-shrink-0">
        <message-input
          ref="message_input"
          :can_send="can_send_message"
          :ticket_id="selected_ticket_id"
          :ai_suggestion_send_at="selected_ticket_ai_send_at"
          :ai_consult_timer="active_ai_consult_timer_for_input"
          :ai_generating="ai_generating_for_selected_ticket"
          @send-message="send_message"
          @suggested-title="apply_suggested_title" />
      </div>
    </div>

    <support-knowledge-base-panel
      v-if="knowledge_panel_visible"
      class="support-knowledge-sidebar flex-shrink-0"
      @close="knowledge_panel_visible = false" />
    
  </div>
</template>

<script>
import TicketList from '@/components/support/TicketList.vue'
import Conversation from '@/components/support/Conversation.vue'
import ConversationHeader from '@/components/support/ConversationHeader/ConversationHeader.vue'
import MessageInput from '@/components/support/MessageInput.vue'
import UserTicketsNav from '@/components/support/UserTicketsNav.vue'
import SupportKnowledgeBasePanel from '@/components/support/SupportKnowledgeBasePanel.vue'
import { useSupportSocket } from '@/composables/useSupportSocket'
import api from '@/utils/axios'

export default {
  name: 'ViewSupport',
  components: {
    TicketList,
    Conversation,
    ConversationHeader,
    MessageInput,
    UserTicketsNav,
    SupportKnowledgeBasePanel,
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
      /** Panel lateral de base de conocimiento visible. */
      knowledge_panel_visible: false,
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
    }
  },
  computed: {
    /**
     * Tickets cargados desde módulo Vuex de soporte.
     */
    tickets() {
      return this.$store.state.support_ticket.models
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
    this.$store.dispatch('support_ticket/get_models').then(function () {
      if (self.tickets.length) {
        self.select_ticket(self.tickets[0].id)
      }
    })
  },
  mounted() {
    window.addEventListener('support-ticket-alert', this.on_support_ticket_alert)
  },
  beforeUnmount() {
    window.removeEventListener('support-ticket-alert', this.on_support_ticket_alert)
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
     * GET umbral de alertas para badges en TicketList.
     *
     * @returns {void}
     */
    load_support_alert_minutes() {
      const self = this
      api
        .get('/settings/support-alert-minutes')
        .then(function (res) {
          const value = parseInt(res.data && res.data.value, 10)
          if (!isNaN(value)) {
            self.support_alert_minutes = value
          }
        })
        .catch(function () {})
    },
    /**
     * Muestra u oculta el panel de base de conocimiento.
     *
     * @returns {void}
     */
    toggle_knowledge_panel() {
      this.knowledge_panel_visible = !this.knowledge_panel_visible
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
          self.sync_ai_pending_to_input(payload.ai_pending_suggestion)
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
      this.$store.dispatch('support_message/load_ticket_messages', ticket_id)
      const ticket = this.tickets.find((t) => t.id == ticket_id)
      if (ticket) {
        this.assigned_admin_id = ticket.assigned_admin_id || this.current_admin_id
        this.ticket_name_draft = ticket.name == null ? '' : String(ticket.name)
        this.ticket_status_draft = ticket.status === 'closed' ? 'closed' : 'open'
        this.$nextTick(function () {
          self.sync_ai_pending_to_input(ticket.ai_pending_suggestion)
        })
      } else {
        this.ticket_name_draft = ''
        this.ticket_status_draft = 'open'
      }
    },
    /**
     * Carga en el input la sugerencia IA pendiente del ticket activo.
     *
     * @param {string|null} suggestion_text Texto sugerido por Claude.
     * @returns {void}
     */
    sync_ai_pending_to_input(suggestion_text) {
      const input = this.$refs.message_input
      if (!input || !input.apply_pending_suggestion) {
        return
      }
      input.apply_pending_suggestion(suggestion_text)
    },
    /**
     * Quita la selección: vacía el panel de conversación sin tocar el ticket en el servidor.
     * El operador vuelve a abrir un hilo eligiendo otra fila en la bandeja.
     */
    deselect_ticket() {
      this.selected_ticket_id = null
      this.ai_consult_timer = null
      this.ai_generating_ticket_id = null
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
     * Crea ticket manual desde admin con prompts simples.
     */
    create_ticket() {
      const client_id = window.prompt('ID de cliente')
      const client_user_id = window.prompt('ID de usuario cliente')
      const name = window.prompt('Nombre del ticket')
      if (!client_id || !client_user_id) {
        return
      }
      this.$store.dispatch('support_ticket/store', {
        client_id: Number(client_id),
        client_user_id: Number(client_user_id),
        assigned_admin_id: this.current_admin_id,
        name: name || null,
      }).then((response) => {
        if (response && response.id) {
          this.select_ticket(response.id)
        }
      })
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

.support-knowledge-sidebar {
  height: 100%;
  min-height: 0;
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
