/** Búsqueda de la bandeja: sin diferencias por mayúsculas, tildes o espacios repetidos. */
export function normalize_ticket_search(value) {
  return String(value == null ? '' : value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

export function ticket_matches_search(ticket, query) {
  if (!query) return true
  if (!ticket) return false

  // Un número identifica el ticket completo: buscar 12 no debe traer también el 123.
  const number = query.match(/^#?\s*(\d+)$/)
  if (number) return String(ticket.id) === number[1].replace(/^0+(?=\d)/, '')
  if (query.startsWith('#')) return false

  const client = ticket.client || {}
  const employee = ticket.client_employee || {}
  const names = [client.company_name, client.name, ticket.client_user_name, employee.name]
    .map(normalize_ticket_search)
    .join(' ')
  return query.split(' ').every((word) => names.includes(word))
}
