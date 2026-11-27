<template>
  <!-- Cuerpo scrollable: crece bajo el bloque de filtros en support-left. -->
  <div ref="ticket_list" class="support-ticket-list flex-grow-1 min-h-0 position-relative">
    <div
      v-if="loading"
      class="support-ticket-list-loading d-flex align-items-center justify-content-center"
      role="status"
      aria-live="polite"
      aria-busy="true">
      <span class="spinner-border text-primary" aria-hidden="true"></span>
      <span class="visually-hidden">Cargando tickets…</span>
    </div>
    <div class="support-ticket-toolbar d-flex align-items-center gap-2 px-2 py-2 border-bottom">
      <div class="support-ticket-search" role="search" aria-label="Buscar tickets de soporte">
        <input
          ref="ticket_search"
          v-model="search_query"
          type="search"
          class="form-control form-control-sm"
          :class="{ 'support-ticket-search--filled': search_query }"
          placeholder="Nº, negocio o persona"
          aria-label="Buscar por número de ticket, negocio o persona"
          title="Buscar por número de ticket, negocio o persona"
          autocomplete="off"
          @keydown.esc.stop.prevent="clear_search" />
        <button v-if="search_query" type="button" class="support-ticket-search-clear"
          aria-label="Limpiar búsqueda" title="Limpiar búsqueda" @click="clear_search">
          <i class="bi bi-x" aria-hidden="true"></i>
        </button>
      </div>
      <button type="button" class="btn btn-sm btn-outline-primary support-ticket-create"
        @click="$emit('create-ticket')">Nuevo ticket</button>
    </div>
    <p v-if="normalized_search && !loading && !display_tickets.length"
      class="text-muted small px-3 py-3 mb-0" role="status" aria-live="polite">
      No hay tickets que coincidan en esta bandeja. Probá con otro número, negocio o persona.
    </p>
    <!-- Fila con el formato de la lista de chats de leads (lead/chats/ChatRow.vue): avatar con
         inicial y tres líneas. 1) nombre del CLIENTE en negrita y la hora del último mensaje;
         2) "Ticket #id" (más el chip de agente apagado, si corresponde); 3) último mensaje, con
         los ticks de WhatsApp si lo mandó un operador o el agente, y los badges a la derecha.
         El semáforo de estado queda como punto sobre el avatar. Los tickets no tienen operador. -->
    <div
      v-for="ticket in display_tickets"
      :key="ticket.id"
      :class="[
        'support-ticket-item',
        {
          active: ticket.id == selected_ticket_id,
          'support-ticket-item--escalated': is_ticket_escalated(ticket),
          'support-ticket-item--unread': unread_count(ticket) > 0,
          'support-ticket-item--pinned': is_pinned(ticket),
          'support-ticket-item--marked-unread': is_marked_unread(ticket),
        },
      ]"
      role="listitem"
      tabindex="0"
      @click="$emit('select-ticket', ticket.id)"
      @contextmenu="open_ticket_menu($event, ticket)"
      @keydown.enter.prevent="$emit('select-ticket', ticket.id)">
      <span class="support-ticket-avatar" aria-hidden="true">
        {{ ticket_initial(ticket) }}
        <span
          class="support-status-dot"
          :class="ticket_status_dot_class(ticket)"
          :title="ticket_status_class(ticket) === 'open' ? 'Abierto' : 'Cerrado'"></span>
      </span>
      <div class="support-ticket-body">
        <div class="support-ticket-line">
          <span
            class="support-ticket-title"
            :class="{ 'support-ticket-title--escalated': is_ticket_escalated(ticket) }"
            :title="client_title_line(ticket)">
            {{ client_name(ticket) }}<span v-if="contact_name(ticket)" class="support-ticket-contact"> - {{ contact_name(ticket) }}</span>
          </span>
          <i v-if="is_pinned(ticket)" class="bi bi-pin-angle-fill support-ticket-pin-icon" title="Ticket fijado" aria-label="Ticket fijado"></i>
          <span class="support-ticket-time" :title="last_activity_full(ticket)">{{ last_activity_label(ticket) }}</span>
        </div>
        <div class="support-ticket-line support-ticket-line--sub">
          <!-- «#89 · título» cuando el ticket tiene título (lo pone Martín o Lucas); si no, «Ticket #89»
               como siempre. El resumen va en el tooltip. -->
          <span
            class="support-ticket-number"
            :class="{ 'support-ticket-number--titled': has_ticket_title(ticket) }"
            :title="ticket_number_tooltip(ticket)">{{ ticket_heading(ticket) }}</span>
          <!-- Agente apagado en un ticket abierto: nadie contesta solo, hay que escribir a mano. -->
          <span
            v-if="agent_is_off(ticket)"
            class="support-agent-off-chip"
            title="El agente está apagado en este ticket: no contesta solo, hay que responder a mano.">
            <span class="support-agent-off-icon" aria-hidden="true">
              <i class="bi bi-robot"></i>
            </span>
            <span class="support-agent-off-text">Agente apagado · modo manual</span>
          </span>
        </div>
        <div class="support-ticket-line">
          <span class="support-ticket-last">
            <!-- Ticks de WhatsApp del último mensaje, solo si lo mandó un operador o el agente. -->
            <message-ticks
              class="support-ticket-ticks"
              :message="ticket.last_message"
              :ticket="ticket" />
            <span
              class="support-ticket-last-preview"
              :class="{ 'support-ticket-last-preview--muted': !last_message_preview(ticket) }"
              :title="last_message_preview(ticket)">
              {{ last_message_preview(ticket) || 'Sin mensajes todavía' }}
            </span>
          </span>
          <span class="support-ticket-meta">
            <span
              v-if="response_time_badge(ticket)"
              class="badge rounded-pill support-response-badge"
              :class="response_time_badge(ticket).class_name"
              :title="'Tiempo sin respuesta del operador'">
              {{ response_time_badge(ticket).label }}
            </span>
            <span
              v-if="is_marked_unread(ticket)"
              class="badge rounded-pill support-marked-unread-badge"
              title="Marcado como no leído">
              No leído
            </span>
            <span
              v-if="unread_count(ticket) > 0"
              class="badge rounded-pill support-unread-badge"
              :title="'Mensajes no leídos: ' + unread_count(ticket)">
              {{ unread_count(ticket) }}
            </span>
          </span>
        </div>
        <!-- La misión puede seguir su curso mientras Martín atiende otras consultas. Solo una
             intervención pendiente pinta la fila de rojo; los dos avisos pueden coexistir. -->
        <div
          v-if="is_ticket_escalated(ticket) || mission_groups(ticket)?.length || ticket_mission(ticket)"
          class="support-ticket-attention">
          <span
            v-if="is_ticket_escalated(ticket)"
            class="badge rounded-pill support-escalated-badge"
            :title="escalation_badge_title(ticket)">
            Necesita tu intervención
          </span>
          <span
            v-for="group in mission_groups(ticket) || []"
            :key="group.type"
            class="badge rounded-pill support-mission-badge"
            :class="group.completed === group.total ? 'support-mission-badge--completed' : 'support-mission-badge--started'"
            :title="mission_count_title(group)">
            {{ group.label }} {{ group.total }} ({{ group.completed }})
          </span>
          <span
            v-if="ticket_mission(ticket)"
            class="badge rounded-pill support-mission-badge"
            :class="ticket_mission(ticket).status === 'started' ? 'support-mission-badge--started' : 'support-mission-badge--pending'"
            :title="mission_reason_line(ticket)">
            {{ ticket_mission(ticket).status === 'started' ? 'Misión iniciada' : 'Misión pendiente' }}
          </span>
        </div>
        <small
          v-if="is_ticket_escalated(ticket) && escalation_reason_line(ticket)"
          class="d-block text-truncate support-ticket-escalation-reason"
          :title="escalation_reason_line(ticket)">
          {{ escalation_reason_line(ticket) }}
        </small>
        <small
          v-if="ticket_mission(ticket)"
          class="d-block support-ticket-mission-reason">
          {{ mission_reason_line(ticket) }}
        </small>
      </div>
    </div>
    <teleport to="body">
      <div v-if="ticket_menu" class="support-ticket-menu-overlay"
        @click.self="ticket_menu = null"
        @contextmenu.self.prevent="ticket_menu = null"
        @keydown.esc.stop.prevent="dismiss_ticket_menu"
        @focusout="on_menu_focusout">
        <div class="support-ticket-menu shadow" role="menu"
          :style="{ left: ticket_menu.x + 'px', top: ticket_menu.y + 'px' }">
          <button v-if="!ticket_menu.closed" ref="close_ticket_action" type="button" class="support-ticket-menu-action"
            role="menuitem" @click="request_ticket_close">
            Cerrar ticket
          </button>
          <button ref="pin_ticket_action" type="button" class="support-ticket-menu-action"
            role="menuitem" @click="request_ticket_pin">
            {{ ticket_menu.pinned ? 'Desfijar ticket' : 'Fijar ticket' }}
          </button>
          <button type="button" class="support-ticket-menu-action"
            role="menuitem" @click="request_ticket_unread">
            {{ ticket_menu.marked_unread ? 'Marcar como leído' : 'Marcar como no leído' }}
          </button>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script>
import moment from 'moment'
import MessageTicks from '@/components/support/MessageTicks.vue'
import { client_display_name, contact_display_name, agent_is_off_on_open_ticket, last_message_author } from '@/utils/support_ticks'
import { ticket_heading, ticket_title, ticket_summary } from '@/utils/support_ticket_title'
import { normalize_ticket_search, ticket_matches_search } from '@/utils/support_ticket_search'
import { mission_groups, mission_count_title } from '@/utils/support_missions'
import { ticket_is_pinned, ticket_is_marked_unread, sort_inbox_tickets } from '@/utils/support_ticket_marks'

export default {
  name: 'SupportTicketList',
  components: {
    MessageTicks,
  },
  props: {
    tickets: { type: Array, default: () => [] },
    all_tickets: { type: Array, default: null },
    selected_ticket_id: { type: [String, Number], default: null },
    /**
     * Indicador de carga de la bandeja (GET /support-ticket con filtro).
     */
    loading: { type: Boolean, default: false },
    /**
     * Umbral en minutos para badges de demora (desde Account / settings).
     */
    support_alert_minutes: { type: Number, default: 30 },
    /**
     * Timestamp reactivo para recalcular minutos transcurridos cada minuto.
     */
    now_tick: { type: Number, default: 0 },
  },
  emits: ['select-ticket', 'create-ticket', 'close-ticket', 'pin-ticket', 'mark-unread'],
  data() {
    return { ticket_menu: null, ticket_order: new Map(), search_query: '' }
  },
  watch: {
    search_query() {
      if (this.$refs.ticket_list) this.$refs.ticket_list.scrollTop = 0
    },
    order_source: {
      immediate: true,
      handler(tickets) {
        const order = new Map()
        for (const ticket of tickets || []) {
          // Orden siempre por la hora del último mensaje (enviado o recibido); sin mensajes, la de creación.
          order.set(ticket.id, {
            time: new Date((ticket.last_message && ticket.last_message.created_at) || ticket.created_at || 0).getTime(),
          })
        }
        this.ticket_order = order
      },
    },
  },
  computed: {
    normalized_search() {
      return normalize_ticket_search(this.search_query)
    },
    order_source() {
      return this.all_tickets || this.tickets
    },
    /**
     * Tickets ordenados: primero los fijados y después por la hora del último mensaje (enviado o
     * recibido), los más recientes arriba.
     *
     * @returns {Array<Object>}
     */
    display_tickets() {
      const list = (this.tickets || []).filter((ticket) => ticket_matches_search(ticket, this.normalized_search))
      return sort_inbox_tickets(list, this.ticket_order)
    },
  },
  methods: {
    mission_groups,
    mission_count_title,
    ticket_heading,
    clear_search() {
      this.search_query = ''
      this.$refs.ticket_search.focus()
    },
    /** true si el ticket tiene título guardado (cambia el recorte de la segunda línea). */
    has_ticket_title(ticket) {
      return ticket_title(ticket) !== ''
    },
    /** Tooltip de «#89 · título»: el título entero y, si hay, el resumen. */
    ticket_number_tooltip(ticket) {
      const partes = [ticket_heading(ticket)]
      const resumen = ticket_summary(ticket)
      if (resumen !== '') {
        partes.push(resumen)
      }
      return partes.join(' — ')
    },
    is_pinned: ticket_is_pinned,
    is_marked_unread: ticket_is_marked_unread,
    open_ticket_menu(event, ticket) {
      event.preventDefault()
      const row = event.currentTarget
      const bounds = row.getBoundingClientRect()
      const closed = this.ticket_status_class(ticket) === 'closed'
      this.ticket_menu = {
        id: ticket.id,
        row,
        closed,
        pinned: ticket_is_pinned(ticket),
        marked_unread: ticket_is_marked_unread(ticket),
        x: Math.max(0, Math.min(event.clientX || bounds.left, window.innerWidth - 172)),
        y: Math.max(0, Math.min(event.clientY || bounds.top, window.innerHeight - (closed ? 90 : 130))),
      }
      this.$nextTick(() => {
        const first = this.$refs.close_ticket_action || this.$refs.pin_ticket_action
        if (first) first.focus()
      })
    },
    dismiss_ticket_menu() {
      const menu = this.ticket_menu
      this.ticket_menu = null
      if (menu && menu.row.isConnected) menu.row.focus({ preventScroll: true })
    },
    /** El menú se cierra al perder el foco hacia fuera de él (como el botón único de antes). */
    on_menu_focusout(event) {
      const next = event.relatedTarget
      if (next && event.currentTarget.contains(next)) return
      this.ticket_menu = null
    },
    request_ticket_close() {
      if (!this.ticket_menu) return
      const id = this.ticket_menu.id
      this.dismiss_ticket_menu()
      this.$emit('close-ticket', id)
    },
    request_ticket_pin() {
      if (!this.ticket_menu) return
      const { id, pinned } = this.ticket_menu
      this.dismiss_ticket_menu()
      this.$emit('pin-ticket', { id, pinned: !pinned })
    },
    request_ticket_unread() {
      if (!this.ticket_menu) return
      const { id, marked_unread } = this.ticket_menu
      this.dismiss_ticket_menu()
      this.$emit('mark-unread', { id, unread: !marked_unread })
    },
    /**
     * Una misión pendiente no equivale a una atención bloqueada. El dato aditivo del API
     * decide la intervención; escalated_at queda como respaldo para servidores anteriores.
     *
     * @param {Object} ticket
     * @returns {boolean}
     */
    is_ticket_escalated(ticket) {
      if (!ticket || this.ticket_status_class(ticket) !== 'open') {
        return false
      }
      const attention = this.ticket_attention(ticket)
      return attention ? attention.needs_human === true : !!ticket.escalated_at
    },
    ticket_attention(ticket) {
      const attention = ticket && ticket.support_attention
      return attention && typeof attention === 'object' && !Array.isArray(attention) ? attention : null
    },
    ticket_mission(ticket) {
      // Una colección vacía es explícita. Solo la API anterior usa el aviso de misión única.
      if (mission_groups(ticket) !== null) return null
      if (this.ticket_status_class(ticket) !== 'open') {
        return null
      }
      const attention = this.ticket_attention(ticket)
      const mission = attention && attention.mission
      return mission && ['pending', 'started'].includes(mission.status) ? mission : null
    },
    mission_reason_line(ticket) {
      const mission = this.ticket_mission(ticket)
      if (!mission) {
        return ''
      }
      return mission.status === 'started' ? 'La misión ya fue iniciada.' : 'La misión todavía no se inició.'
    },
    /**
     * Tooltip del badge de escalado: motivo corto si existe.
     *
     * @param {Object} ticket
     * @returns {string}
     */
    escalation_badge_title(ticket) {
      const reason = this.escalation_reason_line(ticket)
      if (reason) {
        return 'Necesita tu intervención: ' + reason
      }
      return 'Necesita tu intervención'
    },
    /**
     * Motivo del escalado visible bajo el título del ticket.
     *
     * @param {Object} ticket
     * @returns {string}
     */
    escalation_reason_line(ticket) {
      if (!this.is_ticket_escalated(ticket)) {
        return ''
      }
      const attention = this.ticket_attention(ticket)
      const reason = attention ? attention.reason : ticket.escalation_reason
      return reason ? String(reason).trim() : ''
    },
    /**
     * Clase CSS del indicador de estado (open = rojo, closed = verde).
     * Usa status y closed_at por si el store quedó desalineado tras merges parciales de Pusher.
     *
     * @param {Object} ticket
     * @returns {'open'|'closed'}
     */
    ticket_status_class(ticket) {
      if (!ticket) {
        return 'open'
      }
      if (ticket.status === 'closed' || ticket.closed_at) {
        return 'closed'
      }
      return 'open'
    },
    /**
     * Clase del punto de estado; los escalados usan variante visual propia.
     *
     * @param {Object} ticket
     * @returns {string}
     */
    ticket_status_dot_class(ticket) {
      const status = this.ticket_status_class(ticket)
      if (this.is_ticket_escalated(ticket) && status === 'open') {
        return 'escalated'
      }
      return status
    },
    /**
     * Badge amarillo/rojo según tiempo desde last_client_message_at si el último mensaje es del cliente.
     *
     * @param {Object} ticket
     * @returns {{ label: string, class_name: string }|null}
     */
    response_time_badge(ticket) {
      if (!ticket || this.ticket_status_class(ticket) !== 'open') {
        return null
      }
      const last_msg = ticket.last_message
      if (!last_msg || last_msg.sender_type !== 'user') {
        return null
      }
      const raw = ticket.last_client_message_at
      if (!raw) {
        return null
      }
      const threshold = parseInt(this.support_alert_minutes, 10)
      if (isNaN(threshold) || threshold < 1) {
        return null
      }
      const last_at = new Date(raw).getTime()
      if (isNaN(last_at)) {
        return null
      }
      const now_ms = this.now_tick > 0 ? this.now_tick : Date.now()
      const elapsed_min = Math.floor((now_ms - last_at) / 60000)
      if (elapsed_min < threshold * 0.75) {
        return null
      }
      let label = elapsed_min + ' min'
      if (elapsed_min >= 60) {
        label = Math.floor(elapsed_min / 60) + ' h'
      }
      if (elapsed_min >= threshold) {
        return { label: label, class_name: 'bg-danger' }
      }
      return { label: label, class_name: 'bg-warning text-dark' }
    },
    /**
     * Inicial del avatar: la del nombre del cliente que se ve en la primera línea. Si arranca con
     * un número (p. ej. un teléfono) muestra "#", como en la lista de leads.
     *
     * @param {Object} ticket
     * @returns {string}
     */
    ticket_initial(ticket) {
      const primera = String(this.client_name(ticket) || '').trim().charAt(0)
      if (!primera || /\d/.test(primera)) {
        return '#'
      }
      return primera.toUpperCase()
    },
    /**
     * Momento de la última actividad: el último mensaje, o el updated_at del ticket si no hay.
     *
     * @param {Object} ticket
     * @returns {string|null}
     */
    last_activity_at(ticket) {
      if (ticket && ticket.last_message && ticket.last_message.created_at) {
        return ticket.last_message.created_at
      }
      if (ticket && ticket.updated_at) {
        return ticket.updated_at
      }
      return null
    },
    /**
     * Hora a la derecha del título, como WhatsApp: HH:mm si es de hoy, "Ayer", el día de la
     * semana si es de los últimos seis días y DD/MM/AA si es más viejo.
     *
     * Depende de `now_tick` para que "hoy" pase a "Ayer" sola al cambiar el día.
     *
     * @param {Object} ticket
     * @returns {string}
     */
    last_activity_label(ticket) {
      const raw = this.last_activity_at(ticket)
      if (!raw) {
        return ''
      }
      const m = moment(raw)
      if (!m.isValid()) {
        return ''
      }
      const ahora = this.now_tick > 0 ? moment(this.now_tick) : moment()
      const dias = ahora.clone().startOf('day').diff(m.clone().startOf('day'), 'days')
      if (dias <= 0) {
        return m.format('HH:mm')
      }
      if (dias === 1) {
        return 'Ayer'
      }
      if (dias <= 6) {
        const nombre = m.toDate().toLocaleDateString('es-AR', { weekday: 'long' })
        return nombre.charAt(0).toUpperCase() + nombre.slice(1)
      }
      return m.format('DD/MM/YY')
    },
    /**
     * Tooltip de la hora con la fecha completa.
     *
     * @param {Object} ticket
     * @returns {string}
     */
    last_activity_full(ticket) {
      const raw = this.last_activity_at(ticket)
      if (!raw) {
        return ''
      }
      const m = moment(raw)
      return m.isValid() ? m.format('DD/MM/YYYY HH:mm') : ''
    },
    /**
     * Nombre del cliente (la empresa) para la primera línea de la fila. El nombre propio del
     * ticket ya no se muestra acá: el que importa para ubicar la conversación es el cliente.
     *
     * @param {Object} ticket
     * @returns {string}
     */
    client_name(ticket) {
      return client_display_name(ticket)
    },
    /**
     * Nombre de la persona con la que se habla, que va después de un guión al lado del negocio.
     *
     * @param {Object} ticket
     * @returns {string}
     */
    contact_name(ticket) {
      return contact_display_name(ticket)
    },
    /**
     * «Negocio - Persona» completo, para el tooltip de la primera línea.
     *
     * @param {Object} ticket
     * @returns {string}
     */
    client_title_line(ticket) {
      const contacto = this.contact_name(ticket)
      return contacto ? this.client_name(ticket) + ' - ' + contacto : this.client_name(ticket)
    },
    /**
     * true si hay que mostrar el chip «Agente apagado · modo manual» (agente apagado y ticket abierto).
     *
     * @param {Object} ticket
     * @returns {boolean}
     */
    agent_is_off(ticket) {
      return agent_is_off_on_open_ticket(ticket)
    },
    /**
     * Cantidad de mensajes del usuario (empresa) sin leer; viene del API y de Pusher (unread_messages_count).
     * @param {Object} ticket
     * @returns {number}
     */
    unread_count(ticket) {
      const n = ticket.unread_messages_count
      if (n == null || n === '') {
        return 0
      }
      const parsed = parseInt(n, 10)
      if (isNaN(parsed)) {
        return 0
      }
      return parsed
    },
    /**
     * Quién escribió el último mensaje, para el prefijo del preview: «Vos» si fue el operador
     * logueado, el nombre del operador si fue otro, «Agente» si salió del agente y, si lo
     * escribió el cliente, el nombre de la persona (o «Cliente»).
     *
     * @param {Object} ticket
     * @returns {string}
     */
    last_message_prefix(ticket) {
      const admin = this.$store.state.auth && this.$store.state.auth.admin
      const contact = ticket.client_user_name ||
        (ticket.client_employee && ticket.client_employee.name) ||
        'Cliente'
      return last_message_author(ticket.last_message, admin ? admin.id : null, contact)
    },
    /**
     * Texto compacto del último mensaje (enviado o recibido) para la fila de bandeja:
     * «Quién: texto». Los ticks de WhatsApp van aparte, delante, en <message-ticks>.
     *
     * @param {Object} ticket
     * @returns {string}
     */
    last_message_preview(ticket) {
      const lm = ticket.last_message
      if (!lm) {
        return ''
      }
      let snippet = ''
      if (lm.body && String(lm.body).trim()) {
        snippet = String(lm.body).trim().replace(/\s+/g, ' ')
        if (snippet.length > 72) {
          snippet = snippet.slice(0, 69) + '…'
        }
      } else if (lm.kind === 'image') {
        snippet = '[Imagen]'
      } else if (lm.kind === 'audio') {
        snippet = '[Audio]'
      } else {
        snippet = '[Mensaje]'
      }
      return this.last_message_prefix(ticket) + ': ' + snippet
    },
  },
}
</script>

<style scoped>
.support-ticket-list {
  /* min-h-0 + flex-grow-1: el listado llena el lateral bajo la barra de filtros. */
  min-height: 0;
  height: 100%;
  overflow-y: auto;
  border-right: 1px solid #e9ecef;
}

.support-ticket-toolbar {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #fff;
}

.support-ticket-search {
  position: relative;
  flex: 1 1 0;
  min-width: 0;
}

.support-ticket-search--filled {
  padding-right: 1.75rem;
}

/* El botón explícito permite limpiar también con teclado, sin duplicar la cruz nativa. */
.support-ticket-search input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}

.support-ticket-search-clear {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: 1.75rem;
  border: 0;
  border-radius: 0.25rem;
  background: transparent;
  color: var(--bs-secondary-color);
}

.support-ticket-search-clear:focus-visible {
  outline: 2px solid var(--bs-primary);
  outline-offset: -2px;
}

.support-ticket-create {
  flex: 0 0 auto;
  white-space: nowrap;
}

/* Capa bloquea interacción mientras Vuex carga el listado. */
.support-ticket-list-loading {
  position: absolute;
  inset: 0;
  z-index: 2;
  background: rgba(255, 255, 255, 0.8);
  pointer-events: all;
}

.support-ticket-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--bs-border-color-translucent, rgba(0, 0, 0, 0.08));
  background: #fff;
  cursor: pointer;
  transition: background 0.12s ease, box-shadow 0.12s ease;
}

.support-ticket-item:hover {
  background: var(--bs-tertiary-bg, #f5f6f6);
}

.support-ticket-item:focus-visible {
  outline: 2px solid var(--bs-primary);
  outline-offset: -2px;
}

/* Avatar redondo con la inicial, como en la lista de chats de leads. */
.support-ticket-avatar {
  position: relative;
  flex: 0 0 auto;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.1rem;
  background: #ced4da;
  color: #212529;
}

.support-ticket-body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.support-ticket-line {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.support-ticket-title {
  flex: 0 1 auto;
  min-width: 0;
  font-weight: 700;
  font-size: 0.95rem;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.support-ticket-time {
  flex: 0 0 auto;
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--bs-secondary-color);
  white-space: nowrap;
}

/* Con mensajes sin leer la hora se pinta en verde, como WhatsApp. */
.support-ticket-item--unread .support-ticket-time {
  color: #1fa855;
  font-weight: 600;
}

.support-ticket-meta {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.support-ticket-attention {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.15rem;
}

.support-mission-badge {
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1.2;
  padding: 0.3em 0.55em;
  border: 1px solid transparent;
}

.support-mission-badge--pending {
  color: #664d03;
  background: #fff3cd;
  border-color: #ffecb5;
}

.support-mission-badge--started {
  color: #084298;
  background: #cfe2ff;
  border-color: #b6d4fe;
}

.support-mission-badge--completed {
  color: #0f5132;
  background: #d1e7dd;
  border-color: #badbcc;
}

.support-ticket-mission-reason {
  font-size: 0.75rem;
  color: var(--bs-secondary-color);
}

/* Fila escalada: fondo rojizo, borde izquierdo y sombra suave para destacar en la bandeja. */
.support-ticket-item--escalated {
  background: linear-gradient(90deg, #fff1f2 0%, #fff8f8 100%);
  box-shadow: inset 3px 0 0 #dc3545, inset 0 0 0 1px rgba(220, 53, 69, 0.12);
}

.support-ticket-item--escalated:hover {
  background: linear-gradient(90deg, #ffe4e6 0%, #fff1f2 100%);
}

/* Ticket fijado: va arriba de todo y se pinta en azul (Lucas, 27/11/2026). */
.support-ticket-item--pinned {
  background: #e7f1ff;
  box-shadow: inset 3px 0 0 #0d6efd;
}

.support-ticket-item--pinned:hover {
  background: #d6e6ff;
}

.support-ticket-pin-icon {
  flex: 0 0 auto;
  color: #0d6efd;
  font-size: 0.8rem;
}

/* Ticket marcado como no leído a mano: amarillo hasta que se abre. Si además está fijado, gana el amarillo
   y queda el borde azul de la izquierda. */
.support-ticket-item--marked-unread {
  background: #fff3bf;
}

.support-ticket-item--marked-unread:hover {
  background: #ffec99;
}

.support-ticket-item--marked-unread.support-ticket-item--pinned {
  box-shadow: inset 3px 0 0 #0d6efd;
}

.support-marked-unread-badge {
  font-size: 0.65rem;
  line-height: 1.1;
  padding: 0.25em 0.5em;
  color: #664d03;
  background: #ffc107;
}

/* Ticket seleccionado: fondo claramente más gris y acento a la izquierda (no desplaza el layout). */
.support-ticket-item.active {
  background: var(--bs-success-bg-subtle);
  box-shadow: inset 3px 0 0 #0d6efd;
}

.support-ticket-item--escalated.active {
  background: linear-gradient(90deg, #ffd6da 0%, #ffe8ea 100%);
  box-shadow: inset 3px 0 0 #dc3545;
}

/* La persona va a continuación del negocio, con menos peso para que el negocio se lea primero. */
.support-ticket-contact {
  font-weight: 400;
}

.support-ticket-title--escalated {
  color: #842029;
}

.support-ticket-escalation-reason {
  font-size: 0.75rem;
  font-weight: 600;
  color: #b02a37;
  margin-top: 2px;
}

/* Segunda línea: "Ticket #id" y, si hace falta, el chip de agente apagado. */
.support-ticket-line--sub {
  flex-wrap: nowrap;
}

.support-ticket-number {
  flex: 0 0 auto;
  font-size: 0.78rem;
  color: var(--bs-secondary-color);
  white-space: nowrap;
}

/* Con título la línea puede ser larga: se recorta con puntos y le deja lugar al chip del agente. */
.support-ticket-number--titled {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Chip «Agente apagado · modo manual»: gris tenue con el robot tachado. No depende solo del color:
   lleva el ícono tachado y el texto. En pantallas angostas el texto se recorta con puntos. */
.support-agent-off-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  border: 1px solid #ced4da;
  background: #f1f3f5;
  color: #495057;
  font-size: 0.7rem;
  line-height: 1.35;
  font-weight: 600;
}

.support-agent-off-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Robot tachado: una línea diagonal por encima del ícono (no hay un ícono "robot tachado"). */
.support-agent-off-icon {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
  font-size: 0.8rem;
  line-height: 1;
}

.support-agent-off-icon::after {
  content: '';
  position: absolute;
  left: -2px;
  right: -2px;
  top: 50%;
  height: 2px;
  background: #495057;
  border-radius: 1px;
  transform: rotate(-45deg);
  box-shadow: 0 0 0 1px #f1f3f5;
}

/* Último mensaje: ticks (si los hay) + texto recortado, todo en una línea. */
.support-ticket-last {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.15rem;
}

.support-ticket-ticks {
  margin-right: 0.05rem;
}

/* Preview del último mensaje con quién lo mandó: ocupa lo que dejan los badges. */
.support-ticket-last-preview {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 0.85rem;
  color: var(--bs-secondary-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.support-ticket-last-preview--muted {
  font-style: italic;
}

/* Semáforo de estado: punto sobre el borde inferior derecho del avatar. */
.support-status-dot {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 12px;
  height: 12px;
  border-radius: 999px;
  border: 2px solid #fff;
}

.support-status-dot.open {
  background: #dc3545;
}

.support-status-dot.closed {
  background: #2bbf5b;
}

.support-status-dot.escalated {
  background: #dc3545;
  box-shadow: 0 0 0 2px rgba(220, 53, 69, 0.35);
  animation: support-escalated-pulse 1.8s ease-in-out infinite;
}

@keyframes support-escalated-pulse {
  0%,
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 2px rgba(220, 53, 69, 0.35);
  }
  50% {
    transform: scale(1.15);
    box-shadow: 0 0 0 4px rgba(220, 53, 69, 0.2);
  }
}

/* Contador de no leídos en verde WhatsApp, a la derecha del preview. */
.support-unread-badge {
  font-size: 0.65rem;
  min-width: 1.2rem;
  line-height: 1.1;
  padding: 0.25em 0.45em;
  background: #25d366;
  color: #fff;
}

.support-response-badge {
  font-size: 0.65rem;
  line-height: 1.1;
  padding: 0.2em 0.45em;
}

/* Badge de escalado: más visible que los demás badges de la fila. */
.support-escalated-badge {
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.15;
  white-space: normal;
  text-align: left;
  padding: 0.3em 0.55em;
  color: #fff;
  background: #dc3545;
  border: 1px solid #b02a37;
  box-shadow: 0 1px 3px rgba(176, 42, 55, 0.35);
}

@media (max-width: 575.98px) {
  .support-ticket-item {
    padding: 0.55rem 0.6rem;
    gap: 0.6rem;
  }

  .support-ticket-avatar {
    width: 2.5rem;
    height: 2.5rem;
    font-size: 1rem;
  }
}
.support-ticket-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 1080;
}

.support-ticket-menu {
  position: absolute;
  width: 172px;
  display: flex;
  flex-direction: column;
  padding: 0.25rem 0;
  border: 1px solid var(--bs-border-color);
  border-radius: 0.375rem;
  background: #fff;
}

.support-ticket-menu-action {
  padding: 0.4rem 0.9rem;
  border: 0;
  background: transparent;
  text-align: left;
  font-size: 0.9rem;
}

.support-ticket-menu-action:hover,
.support-ticket-menu-action:focus-visible {
  background: var(--bs-tertiary-bg, #f1f3f5);
  outline: none;
}
</style>

