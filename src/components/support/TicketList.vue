<template>
  <!-- Cuerpo scrollable: crece bajo el bloque de filtros en support-left. -->
  <div class="support-ticket-list flex-grow-1 min-h-0 position-relative">
    <div
      v-if="loading"
      class="support-ticket-list-loading d-flex align-items-center justify-content-center"
      role="status"
      aria-live="polite"
      aria-busy="true">
      <span class="spinner-border text-primary" aria-hidden="true"></span>
      <span class="visually-hidden">Cargando tickets…</span>
    </div>
    <div class="px-2 py-2 border-bottom">
      <button class="btn btn-sm btn-outline-primary w-100" @click="$emit('create-ticket')">Nuevo ticket</button>
    </div>
    <!-- Fila con el formato de la lista de chats de leads (lead/chats/ChatRow.vue): avatar con
         inicial, título y hora del último mensaje arriba, preview y badges abajo. El semáforo de
         estado queda como punto sobre el avatar y el operador asignado en la línea chica de abajo. -->
    <div
      v-for="ticket in display_tickets"
      :key="ticket.id"
      :class="[
        'support-ticket-item',
        {
          active: ticket.id == selected_ticket_id,
          'support-ticket-item--escalated': is_ticket_escalated(ticket),
          'support-ticket-item--unread': unread_count(ticket) > 0,
        },
      ]"
      role="listitem"
      tabindex="0"
      @click="$emit('select-ticket', ticket.id)"
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
            :class="{ 'support-ticket-title--escalated': is_ticket_escalated(ticket) }">
            {{ ticket_title(ticket) }}
          </span>
          <span class="support-ticket-time" :title="last_activity_full(ticket)">{{ last_activity_label(ticket) }}</span>
        </div>
        <div class="support-ticket-line">
          <span
            class="support-ticket-last-preview"
            :class="{ 'support-ticket-last-preview--muted': !last_message_preview(ticket) }"
            :title="last_message_preview(ticket)">
            {{ last_message_preview(ticket) || 'Sin mensajes todavía' }}
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
          v-if="is_ticket_escalated(ticket) || ticket_mission(ticket)"
          class="support-ticket-attention">
          <span
            v-if="is_ticket_escalated(ticket)"
            class="badge rounded-pill support-escalated-badge"
            :title="escalation_badge_title(ticket)">
            Necesita tu intervención
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
        <small class="text-muted d-block text-truncate support-ticket-involved">{{ involved_users_line(ticket) }}</small>
      </div>
    </div>
  </div>
</template>

<script>
import moment from 'moment'

export default {
  name: 'SupportTicketList',
  props: {
    tickets: { type: Array, default: () => [] },
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
  computed: {
    /**
     * Tickets ordenados: intervención humana primero, luego por updated_at descendente.
     *
     * @returns {Array<Object>}
     */
    display_tickets() {
      const self = this
      const list = this.tickets || []
      return list.slice().sort(function (a, b) {
        const a_escalated = self.is_ticket_escalated(a) ? 1 : 0
        const b_escalated = self.is_ticket_escalated(b) ? 1 : 0
        if (a_escalated !== b_escalated) {
          return b_escalated - a_escalated
        }
        const da = a && a.updated_at ? new Date(a.updated_at).getTime() : 0
        const db = b && b.updated_at ? new Date(b.updated_at).getTime() : 0
        return db - da
      })
    },
  },
  methods: {
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
     * Inicial del avatar: la del contacto (o la del título si no hay contacto). Si arranca con un número
     * (p. ej. un teléfono) muestra "#", como en la lista de leads.
     *
     * @param {Object} ticket
     * @returns {string}
     */
    ticket_initial(ticket) {
      /* Inicial del contacto, como el avatar de los chats de leads: con la del título muchos
         tickets ("Consulta…", "Ticket #…") terminaban con la misma letra. */
      const contacto = ticket.client_user_name ||
        (ticket.client_employee && ticket.client_employee.name) ||
        (ticket.client && (ticket.client.company_name || ticket.client.name)) ||
        this.ticket_title(ticket)
      const primera = String(contacto || '').trim().charAt(0)
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
     * Define título de ticket usando nombre o fallback por id.
     */
    ticket_title(ticket) {
      if (ticket.name) {
        return ticket.name
      }
      return 'Ticket #' + ticket.id
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
     * Cliente remoto y operador asignado en una sola línea.
     * @param {Object} ticket
     * @returns {string}
     */
    involved_users_line(ticket) {
      let client_label = ticket.client_user_name || ''
      if (!client_label && ticket.client_employee && ticket.client_employee.name) {
        client_label = ticket.client_employee.name
      }
      if (!client_label && ticket.client) {
        client_label = ticket.client.company_name || ticket.client.name || ''
      }
      if (!client_label) {
        client_label = 'Usuario #' + ticket.client_user_id
      }
      if (ticket.assigned_admin && ticket.assigned_admin.name) {
        return client_label + ' · ' + ticket.assigned_admin.name
      }
      if (!ticket.assigned_admin_id) {
        return client_label + ' · Sin asignar'
      }
      return client_label + ' · Operador #' + ticket.assigned_admin_id
    },
    /**
     * Texto compacto del último mensaje (enviado o recibido) para la fila de bandeja.
     * @param {Object} ticket
     * @returns {string}
     */
    last_message_preview(ticket) {
      const lm = ticket.last_message
      if (!lm) {
        return ''
      }
      const who = lm.sender_type === 'admin' ? 'Operador' : 'Cliente'
      let admin_suffix = ''
      if (lm.sender_type === 'admin' && lm.sender_admin && lm.sender_admin.name) {
        admin_suffix = ' (' + lm.sender_admin.name + ')'
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
      return who + admin_suffix + ': ' + snippet
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
  font-weight: 600;
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

/* Ticket seleccionado: fondo claramente más gris y acento a la izquierda (no desplaza el layout). */
.support-ticket-item.active {
  background: var(--bs-success-bg-subtle);
  box-shadow: inset 3px 0 0 #0d6efd;
}

.support-ticket-item--escalated.active {
  background: linear-gradient(90deg, #ffd6da 0%, #ffe8ea 100%);
  box-shadow: inset 3px 0 0 #dc3545;
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

.support-ticket-involved {
  font-size: 0.75rem;
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
</style>

