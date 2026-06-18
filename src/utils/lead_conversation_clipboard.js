/**
 * Utilidades para exportar al portapapeles la conversación WhatsApp de un lead
 * con formato legible (fecha, emisor y contenido).
 */

import { copy_text_to_clipboard } from '@/utils/version_notification_clipboard'

/**
 * Convierte un valor de fecha/hora de la API a milisegundos (0 si no es válido).
 *
 * @param {string|null|undefined} raw
 * @returns {number}
 */
function parse_timestamp_ms(raw) {
  if (!raw) {
    return 0
  }
  try {
    var parsed = new Date(raw).getTime()
    if (isNaN(parsed)) {
      return 0
    }
    return parsed
  } catch (e) {
    return 0
  }
}

/**
 * Formatea fecha/hora para el texto exportado (locale es-AR).
 *
 * @param {string|null|undefined} raw
 * @returns {string}
 */
export function format_lead_message_datetime(raw) {
  if (!raw) {
    return '—'
  }
  try {
    var d = new Date(raw)
    if (isNaN(d.getTime())) {
      return String(raw)
    }
    return d.toLocaleString('es-AR')
  } catch (e) {
    return String(raw)
  }
}

/**
 * Timestamp preferido de un mensaje para la exportación.
 * Salientes enviados usan sent_at; el resto created_at.
 *
 * @param {Object} msg Fila lead_messages.
 * @returns {string|null|undefined}
 */
export function resolve_message_export_timestamp(msg) {
  if (!msg) {
    return null
  }
  var sender = ((msg.sender || '') + '').toLowerCase()
  var status = ((msg.status || '') + '').toLowerCase()
  var is_outgoing_sent =
    (sender === 'setter' || sender === 'sistema') &&
    (status === 'enviado' || status === 'aprobado')
  if (is_outgoing_sent && msg.sent_at) {
    return msg.sent_at
  }
  return msg.created_at
}

/**
 * true si el mensaje parece un envío automático de Claude (sin intervención del setter).
 *
 * @param {Object} msg Fila lead_messages.
 * @returns {boolean}
 */
export function is_likely_auto_sent_suggestion(msg) {
  var edited = ((msg.edited_content || '') + '').trim()
  if (edited !== '') {
    return false
  }
  var sent_ms = parse_timestamp_ms(msg.sent_at)
  var auto_ms = parse_timestamp_ms(msg.ai_auto_send_at)
  if (sent_ms <= 0) {
    return auto_ms > 0
  }
  if (auto_ms <= 0) {
    return false
  }
  /* Envío manual antes del timer programado. */
  if (sent_ms < auto_ms - 10000) {
    return false
  }
  return true
}

/**
 * Texto efectivo del mensaje (edited_content si existe, sino content).
 *
 * @param {Object} msg Fila lead_messages.
 * @returns {string}
 */
export function resolve_message_effective_content(msg) {
  var edited = ((msg.edited_content || '') + '').trim()
  if (edited !== '') {
    return edited
  }
  return (msg.content || '') + ''
}

/**
 * Partes del cuerpo separadas por "\n---\n" (varios WhatsApp en una sugerencia).
 *
 * @param {string} text
 * @returns {string[]}
 */
export function split_message_parts(text) {
  var raw = (text || '') + ''
  var parts = raw.split(/\n---\n/)
  var result = []
  parts.forEach(function (part) {
    var trimmed = part.trim()
    if (trimmed !== '') {
      result.push(trimmed)
    }
  })
  return result
}

/**
 * true si el mensaje es audio (transcripción en content).
 *
 * @param {Object} msg Fila lead_messages.
 * @returns {boolean}
 */
function is_audio_message(msg) {
  var kind = ((msg.kind || '') + '').toLowerCase()
  if (kind === 'audio' || kind === 'ptt' || kind === 'voice') {
    return true
  }
  var att = msg.attachments && msg.attachments[0]
  if (att && att.mime && String(att.mime).indexOf('audio/') === 0) {
    return true
  }
  return false
}

/**
 * true si el mensaje es imagen con adjunto.
 *
 * @param {Object} msg Fila lead_messages.
 * @returns {boolean}
 */
function is_image_message(msg) {
  var kind = ((msg.kind || '') + '').toLowerCase()
  if (kind === 'image') {
    return true
  }
  var att = msg.attachments && msg.attachments[0]
  if (att && att.mime && String(att.mime).indexOf('image/') === 0) {
    return true
  }
  return false
}

/**
 * Nombre legible del primer adjunto.
 *
 * @param {Object} msg Fila lead_messages.
 * @returns {string}
 */
function resolve_attachment_label(msg) {
  var att = msg.attachments && msg.attachments[0]
  if (!att) {
    return ''
  }
  if (att.original_name) {
    return String(att.original_name).trim()
  }
  if (att.filename) {
    return String(att.filename).trim()
  }
  if (att.mime) {
    return String(att.mime).trim()
  }
  return 'archivo adjunto'
}

/**
 * Oculta mensajes espurios de reacciones WhatsApp (misma regla que la UI).
 *
 * @param {Object} msg Fila lead_messages.
 * @returns {boolean}
 */
export function is_legacy_whatsapp_reaction_message(msg) {
  if (!msg) {
    return false
  }
  if (msg.kind === 'reaction') {
    return true
  }
  if (msg.sender !== 'lead') {
    return false
  }
  var text = ((msg.content || '') + '').trim()
  if (!text) {
    return false
  }
  return /^Reacted(?: with)? .+ to message wamid\./i.test(text)
    || /^Removed reaction from message wamid\./i.test(text)
}

/**
 * Etiqueta del emisor para la exportación (distingue sistema automático vs setter manual).
 *
 * @param {Object} msg Fila lead_messages.
 * @returns {string}
 */
export function resolve_sender_export_label(msg) {
  var sender = ((msg.sender || '') + '').toLowerCase()
  var status = ((msg.status || '') + '').toLowerCase()
  var is_followup = Boolean(msg.is_followup)

  if (sender === 'lead') {
    if (is_audio_message(msg)) {
      return 'Lead (audio)'
    }
    return 'Lead'
  }

  if (sender === 'setter') {
    return 'Setter (manual)'
  }

  if (sender !== 'sistema') {
    return sender || '—'
  }

  if (status === 'sugerido') {
    return 'Sistema (sugerencia pendiente — no enviada)'
  }

  if (status === 'rechazado') {
    return 'Sistema (sugerencia cancelada — no enviada al lead)'
  }

  if (status === 'enviado' || status === 'aprobado') {
    var edited = ((msg.edited_content || '') + '').trim()
    if (edited !== '') {
      return 'Setter (editó y envió sugerencia de Claude)'
    }
    if (is_followup && is_likely_auto_sent_suggestion(msg)) {
      return 'Sistema (seguimiento automático)'
    }
    if (is_likely_auto_sent_suggestion(msg)) {
      return 'Sistema (respuesta automática)'
    }
    return 'Setter (aprobó sugerencia manualmente)'
  }

  return 'Sistema / IA'
}

/**
 * Arma el bloque de contenido de un mensaje (texto, partes múltiples y adjuntos).
 *
 * @param {Object} msg Fila lead_messages.
 * @returns {string}
 */
export function format_message_body_for_export(msg) {
  var lines = []
  var text = resolve_message_effective_content(msg)
  var parts = split_message_parts(text)
  var has_attachment = !!(msg.attachments && msg.attachments.length)
  var attachment_label = resolve_attachment_label(msg)

  if (is_audio_message(msg)) {
    if (has_attachment && attachment_label) {
      lines.push('[Audio adjunto: ' + attachment_label + ']')
    } else if (has_attachment) {
      lines.push('[Audio adjunto]')
    }
  } else if (is_image_message(msg) && has_attachment) {
    lines.push('[Imagen adjunta: ' + (attachment_label || 'imagen') + ']')
  } else if (has_attachment && parts.length === 0) {
    lines.push('[Adjunto: ' + (attachment_label || 'archivo') + ']')
  } else if (has_attachment && attachment_label) {
    lines.push('[Adjunto: ' + attachment_label + ']')
  }

  if (parts.length === 0 && text.trim() !== '') {
    lines.push(text.trim())
  } else if (parts.length === 1) {
    lines.push(parts[0])
  } else if (parts.length > 1) {
    var i = 0
    for (i = 0; i < parts.length; i = i + 1) {
      if (i > 0) {
        lines.push('')
      }
      lines.push('Mensaje ' + String(i + 1) + ':')
      lines.push(parts[i])
    }
  }

  if (msg.lead_reaction_emoji) {
    var reaction_line = 'Reacción del lead: ' + String(msg.lead_reaction_emoji).trim()
    if (msg.lead_reaction_at) {
      reaction_line = reaction_line + ' (' + format_lead_message_datetime(msg.lead_reaction_at) + ')'
    }
    lines.push(reaction_line)
  }

  return lines.join('\n')
}

/**
 * Formatea un único mensaje para la exportación.
 *
 * @param {Object} msg Fila lead_messages.
 * @returns {string}
 */
export function format_single_lead_message_for_clipboard(msg) {
  var timestamp = resolve_message_export_timestamp(msg)
  var datetime_label = format_lead_message_datetime(timestamp)
  var sender_label = resolve_sender_export_label(msg)
  var body = format_message_body_for_export(msg)

  var block_lines = ['[' + datetime_label + '] ' + sender_label]
  if (body) {
    block_lines.push(body)
  } else {
    block_lines.push('(sin contenido de texto)')
  }

  return block_lines.join('\n')
}

/**
 * Ordena mensajes por id ascendente y excluye reacciones legacy.
 *
 * @param {Array<Object>|null|undefined} messages
 * @returns {Array<Object>}
 */
export function sort_messages_for_export(messages) {
  if (!messages || !messages.length) {
    return []
  }
  var copy = messages.slice()
  copy.sort(function (a, b) {
    return (a.id || 0) - (b.id || 0)
  })
  var filtered = []
  copy.forEach(function (msg) {
    if (!is_legacy_whatsapp_reaction_message(msg)) {
      filtered.push(msg)
    }
  })
  return filtered
}

/**
 * Arma el texto completo de la conversación de un lead.
 *
 * @param {Object|null|undefined} lead Registro del lead (nombre, teléfono, id).
 * @param {Array<Object>|null|undefined} messages Lista de lead_messages.
 * @returns {string}
 */
export function format_lead_conversation_for_clipboard(lead, messages) {
  var sorted = sort_messages_for_export(messages)
  if (!sorted.length) {
    return ''
  }

  var header_lines = []
  var contact_name = lead && lead.contact_name ? String(lead.contact_name).trim() : ''
  var phone = lead && lead.phone != null ? String(lead.phone).trim() : ''
  var lead_id = lead && lead.id != null ? String(lead.id) : ''

  if (contact_name) {
    header_lines.push('Conversación WhatsApp — ' + contact_name)
  } else {
    header_lines.push('Conversación WhatsApp')
  }
  if (phone) {
    header_lines.push('Teléfono: ' + phone)
  }
  if (lead_id) {
    header_lines.push('Lead ID: ' + lead_id)
  }
  header_lines.push('────────────────────────────')

  var blocks = []
  sorted.forEach(function (msg) {
    blocks.push(format_single_lead_message_for_clipboard(msg))
  })

  return header_lines.join('\n') + '\n\n' + blocks.join('\n\n')
}

/**
 * Formatea y copia la conversación del lead al portapapeles.
 *
 * @param {Object|null|undefined} lead
 * @param {Array<Object>|null|undefined} messages
 * @returns {Promise<void>}
 */
export function copy_lead_conversation_to_clipboard(lead, messages) {
  var text = format_lead_conversation_for_clipboard(lead, messages)
  if (!text) {
    return Promise.reject(new Error('empty_conversation'))
  }
  return copy_text_to_clipboard(text)
}
