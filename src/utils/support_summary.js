export const SUPPORT_FILTERS = [
  { key: 'hoy', flag: 'abierto_hoy', label: 'Abiertos hoy', icon: 'bi-calendar3' },
  { key: 'abiertos', label: 'Abiertos', icon: 'bi-chat-left-text' },
  { key: 'sin-responder', flag: 'sin_responder', label: 'Sin responder', icon: 'bi-reply' },
  /* Tickets abiertos de los negocios en prueba gratuita (misión soporte-fijar-no-leido): la bandeja trae a todos
     juntos, y esta tarjeta los aísla. Se apoya en `es_prueba`, que manda el API. */
  { key: 'pruebas', flag: 'es_prueba', label: 'Pruebas abiertas', icon: 'bi-hourglass-split' },
]

export function support_filter_available(tickets, key) {
  const filter = SUPPORT_FILTERS.find((row) => row.key === key)
  return !!filter && (!filter.flag || !tickets.length || tickets.every((ticket) => ticket[filter.flag] !== undefined))
}

/** El conjunto contado es el mismo que se entrega a la lista. Nunca se infiere de last_message. */
export function support_filter_tickets(tickets, key) {
  if (!key || !support_filter_available(tickets, key)) return tickets
  if (key === 'abiertos') return tickets.filter((ticket) => ticket.status === 'open')
  if (key === 'pruebas') return tickets.filter((ticket) => ticket.status === 'open' && (ticket.es_prueba === true || ticket.es_prueba === 1))
  const filter = SUPPORT_FILTERS.find((row) => row.key === key)
  return tickets.filter((ticket) => ticket[filter.flag] === true || ticket[filter.flag] === 1)
}

export function support_summary(tickets) {
  return SUPPORT_FILTERS.map((filter) => ({
    ...filter,
    count: support_filter_available(tickets, filter.key) ? support_filter_tickets(tickets, filter.key).length : null,
  }))
}
