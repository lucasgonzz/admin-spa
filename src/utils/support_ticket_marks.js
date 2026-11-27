/**
 * Marcas manuales de la bandeja de soporte (misión soporte-fijar-no-leido): un ticket fijado va arriba de todo
 * y uno marcado como no leído se pinta en amarillo hasta que se abre. Las dos viajan en la fila del API
 * (`pinned_at`, `marked_unread_at`); con un API viejo no existen y la bandeja se ve como siempre.
 */

/** @param {Object} ticket @returns {boolean} true si el ticket está fijado. */
export function ticket_is_pinned(ticket) {
  return !!ticket && !!ticket.pinned_at
}

/** @param {Object} ticket @returns {boolean} true si el ticket quedó marcado como no leído a mano. */
export function ticket_is_marked_unread(ticket) {
  return !!ticket && !!ticket.marked_unread_at
}

/**
 * Orden de la bandeja: primero los fijados (el que se fijó antes, más arriba) y después el resto por la hora del
 * último mensaje, los más recientes arriba. No modifica la lista que recibe.
 *
 * @param {Array<Object>} tickets
 * @param {Map<number|string, {time: number}>} order Hora de último mensaje por id.
 * @returns {Array<Object>}
 */
export function sort_inbox_tickets(tickets, order) {
  const time_of = (ticket) => {
    const entry = order.get(ticket.id)
    return entry ? entry.time : 0
  }
  return tickets.slice().sort((a, b) => {
    const pinned_a = ticket_is_pinned(a)
    const pinned_b = ticket_is_pinned(b)
    if (pinned_a !== pinned_b) return pinned_a ? -1 : 1
    if (pinned_a && pinned_b) {
      const by_pin = new Date(a.pinned_at).getTime() - new Date(b.pinned_at).getTime()
      if (by_pin !== 0) return by_pin
    }
    return time_of(b) - time_of(a) || Number(b.id) - Number(a.id)
  })
}
