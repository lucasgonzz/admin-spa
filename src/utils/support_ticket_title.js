/**
 * Número, título y resumen de un ticket de soporte (misión ficha-del-cliente, 11/11/2026).
 *
 * El título es la columna de siempre `support_tickets.name` (la pone Martín con `titular` o Lucas a
 * mano desde el header); el resumen es la columna nueva `support_tickets.summary`. Los usan la
 * bandeja (TicketList) y el header de la conversación, para mostrar «#89 · título».
 */

/**
 * Título guardado del ticket, sin espacios sobrantes; vacío si no tiene.
 *
 * @param {Object|null} ticket
 * @returns {string}
 */
export function ticket_title(ticket) {
	if (!ticket || ticket.name == null) {
		return ''
	}
	return String(ticket.name).trim()
}

/**
 * Resumen del ticket; vacío si no tiene (o si el admin-api todavía no manda la columna).
 *
 * @param {Object|null} ticket
 * @returns {string}
 */
export function ticket_summary(ticket) {
	if (!ticket || ticket.summary == null) {
		return ''
	}
	return String(ticket.summary).trim()
}

/**
 * «#89 · Cartel de pago de la mensualidad»; sin título, `sin_titulo` (por defecto «Ticket #89»,
 * como se veía siempre).
 *
 * @param {Object|null} ticket
 * @param {string} [sin_titulo]
 * @returns {string}
 */
export function ticket_heading(ticket, sin_titulo) {
	if (!ticket) {
		return ''
	}
	const titulo = ticket_title(ticket)
	if (titulo !== '') {
		return '#' + ticket.id + ' · ' + titulo
	}
	return sin_titulo != null ? sin_titulo : 'Ticket #' + ticket.id
}
