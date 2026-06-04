import store from '@/store'

/**
 * Suscripción Pusher al canal compartido `support.admins`.
 *
 * admin-api emite cada mensaje/lectura también aquí además de support.client.* y support.admin.*.
 * También SupportTicketUpdated (reasignación, nombre, cierre) para que otras sesiones alineen la bandeja.
 * Así cualquier operador conectado actualiza en tiempo real: bandeja (apply_ticket), UserTicketsNav
 * (inbox_nav via fetch_unread_badges) y badge del nav (unread_totals.mine del usuario logeado).
 *
 * @param {Object} options
 * @param {number|string} options.admin_id Id del operador (evita suscripción sin sesión válida).
 * @returns {{ disconnect: Function }} Objeto con método para dejar canales y limpiar timers.
 */
export function useSupportBadgeSocket(options) {
  // Id de operador: exige sesión antes de unirse al canal.
  const admin_id = options.admin_id
  // Instancia Echo global creada en main.js (null si no hay Pusher en .env).
  const echo = window.admin_support_echo
  // Único canal global escuchado aquí (evita triple dispatch por mismo evento en admin+admins).
  const channels_to_leave = []
  // Timer para agrupar fetch_unread_badges (inbox_nav + unread_totals).
  let unread_badges_debounce_timer = null

  /**
   * Programa GET /support-ticket/unread-badges (totales + filas por operador).
   */
  function schedule_refresh_unread_badges() {
    if (unread_badges_debounce_timer) {
      clearTimeout(unread_badges_debounce_timer)
    }
    unread_badges_debounce_timer = setTimeout(function () {
      unread_badges_debounce_timer = null
      store.dispatch('support_ticket/fetch_unread_badges')
    }, 450)
  }

  /**
   * Mensaje nuevo: fusiona ticket en la bandeja según filtro y refresca contadores.
   *
   * @param {Object} event_data Payload Echo (.SupportMessageReceived).
   */
  function handle_message_received(event_data) {
    if (event_data && event_data.message) {
      store.dispatch('support_ticket/apply_ticket_from_message', event_data.message)
    }
    schedule_refresh_unread_badges()
  }

  /**
   * Mensaje marcado leído: alinea ticket y contadores.
   *
   * @param {Object} event_data Payload Echo (.SupportMessageRead).
   */
  function handle_message_read(event_data) {
    if (event_data && event_data.message) {
      store.dispatch('support_ticket/apply_ticket_from_message', event_data.message)
    }
    schedule_refresh_unread_badges()
  }

  /**
   * Ticket actualizado en servidor (p. ej. reasignación): fusiona fila en bandeja según filtro activo.
   *
   * @param {Object} event_data Payload Echo (.SupportTicketUpdated)
   */
  function handle_ticket_updated(event_data) {
    if (event_data && event_data.ticket) {
      store.dispatch('support_ticket/apply_ticket_row', event_data.ticket)
    }
    schedule_refresh_unread_badges()
  }

  /**
   * Alerta de ticket sin respuesta del operador: toast global.
   *
   * @param {Object} event_data Payload Echo (.SupportTicketAlert).
   */
  function handle_ticket_alert(event_data) {
    if (!event_data) {
      return
    }
    const name = event_data.ticket_name || ('Ticket #' + event_data.ticket_id)
    const mins = event_data.minutos_sin_respuesta
    let message = 'Demora en respuesta: ' + name
    if (mins != null && mins !== '') {
      message += ' (' + mins + ' min sin respuesta)'
    }
    window.dispatchEvent(
      new CustomEvent('admin-spa-toast', {
        detail: { message: message, variant: 'warning' },
      })
    )
    window.dispatchEvent(
      new CustomEvent('support-ticket-alert', {
        detail: event_data,
      })
    )
  }

  /**
   * Escalado de ticket: Claude no pudo resolver el caso y requiere revisión humana.
   * Emite toast de peligro y evento custom para que otros componentes reaccionen.
   *
   * @param {Object} event_data Payload Echo (.SupportTicketEscalated).
   */
  function handle_ticket_escalated(event_data) {
    if (!event_data) {
      return
    }
    /* Nombre visible del ticket con fallback por id. */
    const name = event_data.ticket_name || ('Ticket #' + event_data.ticket_id)
    /* Motivo del escalado con fallback genérico. */
    const reason = event_data.escalation_reason || 'Claude no pudo resolver este caso'
    const message = 'Requiere revisión: ' + name + ' — ' + reason
    window.dispatchEvent(
      new CustomEvent('admin-spa-toast', {
        detail: { message: message, variant: 'danger' },
      })
    )
    window.dispatchEvent(
      new CustomEvent('support-ticket-escalated', {
        detail: event_data,
      })
    )
  }

  if (!echo || admin_id == null || admin_id === '') {
    return {
      /**
       * Sin Echo o sin admin: no hay canales que limpiar.
       */
      disconnect() {
        return null
      },
    }
  }

  const all_admins_channel_name = 'support.admins'
  channels_to_leave.push(all_admins_channel_name)
  echo.channel(all_admins_channel_name).listen('.SupportMessageReceived', handle_message_received)
  echo.channel(all_admins_channel_name).listen('.SupportMessageRead', handle_message_read)
  echo.channel(all_admins_channel_name).listen('.SupportTicketUpdated', handle_ticket_updated)
  echo.channel(all_admins_channel_name).listen('.SupportTicketAlert', handle_ticket_alert)
  echo.channel(all_admins_channel_name).listen('.SupportTicketEscalated', handle_ticket_escalated)

  return {
    /**
     * Deja canal support.admins y cancela debounce (no desconecta Echo global).
     */
    disconnect() {
      if (unread_badges_debounce_timer) {
        clearTimeout(unread_badges_debounce_timer)
        unread_badges_debounce_timer = null
      }
      let i = 0
      for (i = 0; i < channels_to_leave.length; i = i + 1) {
        echo.leave(channels_to_leave[i])
      }
    },
  }
}
