/** La identidad incluye al operador: una sesión nueva nunca hereda envíos de otra. */
export function support_scope(admin_id, ticket_id) {
  return admin_id != null && ticket_id != null ? String(admin_id) + ':' + String(ticket_id) : null
}

export function same_message(a, b) {
  if (!a || !b || String(a.support_ticket_id) !== String(b.support_ticket_id)) return false
  if (a.id != null && b.id != null && String(a.id) === String(b.id)) return true
  const ak = a.client_message_id || a._retry_client_message_id || a._client_pending
  const bk = b.client_message_id || b._retry_client_message_id || b._client_pending
  // El texto no es una identidad: dos Enter con «sí» son dos mensajes distintos.
  return !!ak && !!bk && String(ak) === String(bk)
}

export function is_durable_support_message(model, kind) {
  return !!model && model.id != null && (kind === 'text' || !!(model.attachments && model.attachments.length))
}

/** Superpone el buzón local sobre el GET sin perderlo al navegar ni duplicar el eco de Pusher. */
export function visible_support_messages(models, outbox, scope) {
  if (!scope) return []
  const rows = (models || []).slice()
  for (const entry of outbox || []) {
    if (entry.scope !== scope) continue
    const row = entry.model || entry.row
    const index = rows.findIndex((existing) => same_message(existing, row))
    if (index < 0) rows.push(row)
    else rows.splice(index, 1, entry.model ? { ...rows[index], ...entry.model } : row)
  }
  // El GET y el eco pueden llegar en cualquier orden. Los confirmados siguen su id y
  // los pendientes quedan después en FIFO. Mezclar fechas del dispositivo y del servidor
  // hacía saltar el tercero delante del primero al confirmar una subida con latencia.
  return rows.sort((a, b) => {
    if (a.id != null && b.id != null) return Number(a.id) - Number(b.id)
    if (a.id != null && b.id == null) return -1
    if (b.id != null && a.id == null) return 1
    return 0
  })
}
