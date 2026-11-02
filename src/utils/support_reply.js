/**
 * Textos de la cita al responder un mensaje en la conversación de soporte.
 *
 * Los usan la burbuja (bloque de cita) y la barra «Respondiendo a…» del input, así los dos dicen
 * lo mismo del mismo mensaje.
 */

/** Largo máximo del texto citado antes de cortarlo con puntos suspensivos. */
const REPLY_PREVIEW_MAX = 140

/** Rótulo del mensaje cuando no tiene texto, según su tipo. */
const REPLY_KIND_LABELS = {
  audio: '🎤 Audio',
  ptt: '🎤 Audio',
  voice: '🎤 Audio',
  image: '📷 Foto',
  video: '🎥 Video',
  document: '📄 Documento',
  file: '📄 Archivo',
  sticker: 'Sticker',
}

/**
 * Quién escribió el mensaje citado.
 *
 * @param {Object} message Mensaje citado (o su vista previa).
 * @returns {string}
 */
export function reply_author_label(message) {
  if (!message) {
    return ''
  }
  return message.sender_type === 'admin' ? 'Soporte' : 'Cliente'
}

/**
 * Texto corto del mensaje citado: su cuerpo, o el rótulo de su tipo si no tiene texto.
 *
 * @param {Object} message Mensaje citado (o su vista previa).
 * @returns {string}
 */
export function reply_preview_text(message) {
  if (!message) {
    return ''
  }
  const kind = String(message.kind || '').toLowerCase()
  const label = REPLY_KIND_LABELS[kind] || ''
  const body = String(message.body || '').replace(/\s+/g, ' ').trim()
  const es_marcador = /^\[[^\]]*\]$/.test(body)
  if (!body || es_marcador || (label && kind !== 'image' && kind !== 'video' && kind !== 'document' && kind !== 'file')) {
    return label || body || 'Mensaje'
  }
  const recorte = body.length > REPLY_PREVIEW_MAX ? body.slice(0, REPLY_PREVIEW_MAX) + '…' : body
  return label ? label + ' · ' + recorte : recorte
}

/**
 * Vista previa mínima de un mensaje, la que viaja con la fila optimista y la barra del input.
 *
 * @param {Object} message Mensaje del hilo.
 * @returns {Object|null}
 */
export function reply_preview_of(message) {
  if (!message || message.id == null) {
    return null
  }
  return {
    id: message.id,
    support_ticket_id: message.support_ticket_id,
    sender_type: message.sender_type,
    kind: message.kind,
    body: message.body,
  }
}
