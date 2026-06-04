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
    <div
      v-for="ticket in display_tickets"
      :key="ticket.id"
      :class="[
        'support-ticket-item',
        {
          active: ticket.id == selected_ticket_id,
          'support-ticket-item--escalated': is_ticket_escalated(ticket),
        },
      ]"
      @click="$emit('select-ticket', ticket.id)">
      <div class="support-status-dot flex-shrink-0" :class="ticket_status_dot_class(ticket)"></div>
      <div class="flex-grow-1 min-w-0">
        <div class="d-flex align-items-center justify-content-between gap-2">
          <span
            class="fw-semibold text-truncate"
            :class="{ 'support-ticket-title--escalated': is_ticket_escalated(ticket) }">
            {{ ticket_title(ticket) }}
          </span>
          <div class="d-flex align-items-center gap-1 flex-shrink-0">
            <!-- Badge prioritario: Claude escaló el caso y requiere intervención humana. -->
            <span
              v-if="is_ticket_escalated(ticket)"
              class="badge rounded-pill support-escalated-badge"
              :title="escalation_badge_title(ticket)">
              Requiere supervision
            </span>
            <span
              v-if="response_time_badge(ticket)"
              class="badge rounded-pill support-response-badge"
              :class="response_time_badge(ticket).class_name"
              :title="'Tiempo sin respuesta del operador'">
              {{ response_time_badge(ticket).label }}
            </span>
            <span
              v-if="unread_count(ticket) > 0"
              class="badge bg-danger rounded-pill support-unread-badge"
              :title="'Mensajes no leídos: ' + unread_count(ticket)">
              {{ unread_count(ticket) }}
            </span>
          </div>
        </div>
        <small
          v-if="is_ticket_escalated(ticket) && escalation_reason_line(ticket)"
          class="d-block text-truncate support-ticket-escalation-reason"
          :title="escalation_reason_line(ticket)">
          {{ escalation_reason_line(ticket) }}
        </small>
        <small class="text-muted d-block text-truncate support-ticket-involved">{{ involved_users_line(ticket) }}</small>
        <small
          v-if="last_message_preview(ticket)"
          class="text-muted d-block text-truncate support-ticket-last-preview"
          :title="last_message_preview(ticket)">
          {{ last_message_preview(ticket) }}
        </small>
      </div>
    </div>
  </div>
</template>

<script>
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
     * Tickets ordenados: escalados primero, luego por updated_at descendente.
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
     * Indica si el ticket fue escalado por Claude y aún requiere revisión humana.
     * Los tickets cerrados/resueltos no muestran el estilo de escalado aunque conserven el dato en BD.
     *
     * @param {Object} ticket
     * @returns {boolean}
     */
    is_ticket_escalated(ticket) {
      if (!ticket || !ticket.escalated_at) {
        return false
      }
      return this.ticket_status_class(ticket) === 'open'
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
        return 'Requiere supervision: ' + reason
      }
      return 'Requiere supervision humana'
    },
    /**
     * Motivo del escalado visible bajo el título del ticket.
     *
     * @param {Object} ticket
     * @returns {string}
     */
    escalation_reason_line(ticket) {
      if (!ticket || !ticket.escalation_reason) {
        return ''
      }
      return String(ticket.escalation_reason).trim()
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
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border-bottom: 1px solid #f1f3f5;
  cursor: pointer;
  transition: background 0.12s ease, box-shadow 0.12s ease;
}

/* Fila escalada: fondo rojizo, borde izquierdo y sombra suave para destacar en la bandeja. */
.support-ticket-item--escalated {
  background: linear-gradient(90deg, #fff1f2 0%, #fff8f8 100%);
  border-left: 3px solid #dc3545;
  box-shadow: inset 0 0 0 1px rgba(220, 53, 69, 0.12);
}

.support-ticket-item--escalated:hover {
  background: linear-gradient(90deg, #ffe4e6 0%, #fff1f2 100%);
}

/* Ticket seleccionado: fondo claramente más gris y acento a la izquierda (no desplaza el layout). */
.support-ticket-item.active {
  background: #dee2e6;
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
  font-size: 0.8rem;
  margin-top: 2px;
}

.support-ticket-last-preview {
  font-size: 0.78rem;
  margin-top: 2px;
  opacity: 0.92;
}

.support-status-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  flex-shrink: 0;
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

/* Badge compacto alineado a la derecha del título. */
.support-unread-badge {
  font-size: 0.65rem;
  min-width: 1.2rem;
  line-height: 1.1;
  padding: 0.2em 0.45em;
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
  letter-spacing: 0.02em;
  text-transform: uppercase;
  padding: 0.3em 0.55em;
  color: #fff;
  background: #dc3545;
  border: 1px solid #b02a37;
  box-shadow: 0 1px 3px rgba(176, 42, 55, 0.35);
}
</style>

