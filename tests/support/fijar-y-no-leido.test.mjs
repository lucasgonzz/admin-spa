import test from 'node:test'
import assert from 'node:assert/strict'
import { sort_inbox_tickets, ticket_is_pinned, ticket_is_marked_unread } from '../../src/utils/support_ticket_marks.js'
import { support_summary, support_filter_tickets } from '../../src/utils/support_summary.js'

/**
 * Bandeja de soporte (misión soporte-fijar-no-leido, 27/11/2026): los fijados van arriba de todo, las pruebas
 * abiertas tienen su tarjeta y las marcas viajan en la fila del API.
 */

const orden = (filas) => new Map(filas.map(([id, hora]) => [id, { time: new Date(hora).getTime() }]))

test('los fijados van arriba y el resto por la hora del último mensaje', () => {
  const tickets = [
    { id: 1 }, { id: 2, pinned_at: '2026-11-27T10:00:00Z' }, { id: 3 }, { id: 4, pinned_at: '2026-11-27T09:00:00Z' },
  ]
  const por_hora = orden([[1, '2026-11-27T12:00:00Z'], [2, '2026-11-20T12:00:00Z'], [3, '2026-11-27T13:00:00Z'], [4, '2026-11-01T12:00:00Z']])
  assert.deepEqual(sort_inbox_tickets(tickets, por_hora).map((t) => t.id), [4, 2, 3, 1])
})

test('desfijar devuelve el ticket a su lugar por hora y no modifica la lista de entrada', () => {
  const tickets = [{ id: 1, pinned_at: null }, { id: 2 }]
  const por_hora = orden([[1, '2026-11-20T12:00:00Z'], [2, '2026-11-27T12:00:00Z']])
  const antes = tickets.map((t) => t.id)
  assert.deepEqual(sort_inbox_tickets(tickets, por_hora).map((t) => t.id), [2, 1])
  assert.deepEqual(tickets.map((t) => t.id), antes)
})

test('las marcas se leen de pinned_at y marked_unread_at; sin ellas (API vieja) no hay marca', () => {
  assert.equal(ticket_is_pinned({ pinned_at: '2026-11-27T10:00:00Z' }), true)
  assert.equal(ticket_is_pinned({ pinned_at: null }), false)
  assert.equal(ticket_is_pinned({}), false)
  assert.equal(ticket_is_marked_unread({ marked_unread_at: '2026-11-27T10:00:00Z' }), true)
  assert.equal(ticket_is_marked_unread({}), false)
  assert.equal(ticket_is_marked_unread(null), false)
})

test('la tarjeta «Pruebas abiertas» cuenta solo los abiertos de negocios en prueba y filtra la lista', () => {
  const tickets = [
    { id: 1, status: 'open', es_prueba: true, abierto_hoy: false, sin_responder: false },
    { id: 2, status: 'closed', es_prueba: true, abierto_hoy: false, sin_responder: false },
    { id: 3, status: 'open', es_prueba: false, abierto_hoy: true, sin_responder: false },
  ]
  const tarjeta = support_summary(tickets).find((c) => c.key === 'pruebas')
  assert.equal(tarjeta.label, 'Pruebas abiertas')
  assert.equal(tarjeta.count, 1)
  assert.deepEqual(support_filter_tickets(tickets, 'pruebas').map((t) => t.id), [1])
})

test('con un API que no marca es_prueba la tarjeta queda sin dato y el filtro no vacía la lista', () => {
  const tickets = [{ id: 1, status: 'open', abierto_hoy: true, sin_responder: false }]
  assert.equal(support_summary(tickets).find((c) => c.key === 'pruebas').count, null)
  assert.deepEqual(support_filter_tickets(tickets, 'pruebas').map((t) => t.id), [1])
})
