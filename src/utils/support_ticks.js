/**
 * Lógica pura de la bandeja y la conversación de soporte que no depende de Vue ni del store:
 * ticks de WhatsApp, nombre del cliente, contador de no leídos y mezcla de los eventos de estado
 * y de reacción sobre un mensaje.
 *
 * Vive en un util para poder probarla con Node puro (`pruebas/support-sin-operador.cjs`), igual
 * que `support_media.js`. No importa nada ni toca `import.meta.env`.
 *
 * 🔴 Compatibilidad: la API vieja no manda `whatsapp_delivery_status`, ni `unread_total`, ni los
 * campos de reacción. Todo lo de acá tiene que degradar a "como antes" cuando faltan.
 */

/** Estados que devuelve `ticks_state`. */
export const TICK_SENT = 'sent'
export const TICK_DELIVERED = 'delivered'
export const TICK_READ = 'read'
export const TICK_FAILED = 'failed'

/** Reacciones que ofrece la barra (misma lista corta que valida la API). */
export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

/**
 * true si el valor es un texto con algo más que espacios.
 *
 * @param {*} value Valor cualquiera.
 * @returns {boolean}
 */
function has_text(value) {
  return value !== null && value !== undefined && String(value).trim() !== ''
}

/** Pasado este tiempo, un mensaje sin estado de entrega deja de mostrar el check de «enviado» (3 días). */
const SENT_TICK_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000

/**
 * true si el mensaje es saliente: lo escribió un operador o el agente (el mensaje de IA sale con
 * `sender_type = 'admin'`, igual que el de una persona). Los borradores del agente que todavía
 * esperan aprobación no salieron, así que no cuentan.
 *
 * @param {Object|null} message Mensaje del hilo o `last_message` de un ticket.
 * @returns {boolean}
 */
export function is_outgoing_message(message) {
  if (!message || message.sender_type !== 'admin') {
    return false
  }
  return !message.is_ai_suggestion_draft
}

/**
 * Estado de los ticks de un mensaje, o null si no corresponde mostrar ninguno.
 *
 * Solo hay ticks para un mensaje saliente con `whatsapp_message_id` de un ticket de WhatsApp. En
 * un ticket del ERP, o en un mensaje que todavía no salió (sin wamid), no se muestra nada.
 *
 *  - sin `whatsapp_delivery_status` (o con uno desconocido) -> 'sent'      (un check gris)
 *  - 'entregado'                                           -> 'delivered' (dos checks grises)
 *  - 'leido'                                               -> 'read'      (dos checks azules)
 *  - 'fallido'                                             -> 'failed'    (icono rojo)
 *
 * @param {Object|null} message Mensaje del hilo o `last_message` de un ticket.
 * @param {Object|null} ticket  Ticket (solo se mira `source`).
 * @param {number} [now_ms]     Ahora en ms (para pruebas); por defecto Date.now().
 * @returns {string|null} 'sent' | 'delivered' | 'read' | 'failed' | null
 */
export function ticks_state(message, ticket, now_ms) {
  if (!ticket || ticket.source !== 'whatsapp') {
    return null
  }
  if (!is_outgoing_message(message) || !has_text(message.whatsapp_message_id)) {
    return null
  }
  const status = String(message.whatsapp_delivery_status || '').trim().toLowerCase()
  if (status === 'leido') {
    return TICK_READ
  }
  if (status === 'entregado') {
    return TICK_DELIVERED
  }
  if (status === 'fallido') {
    return TICK_FAILED
  }
  /* Sin estado de entrega: WhatsApp manda «entregado» y «leído» dentro de los días siguientes al envío. Un mensaje
     más viejo que eso sin estado es historia anterior a los ticks (o un estado que nunca llegó): un solo check gris
     diría «enviado, nunca entregado», que es mentira para casi todos. Ahí no se muestra nada. */
  const creado = message.created_at ? new Date(message.created_at).getTime() : NaN
  const ahora = typeof now_ms === 'number' ? now_ms : Date.now()
  if (!isNaN(creado) && ahora - creado > SENT_TICK_MAX_AGE_MS) {
    return null
  }
  return TICK_SENT
}

/**
 * Texto del tooltip de los ticks.
 *
 * @param {string|null} state   Resultado de `ticks_state`.
 * @param {Object|null} message Mensaje (para el motivo del fallo si la API lo mandó).
 * @returns {string}
 */
export function ticks_title(state, message) {
  if (state === TICK_READ) {
    return 'Leído por el cliente'
  }
  if (state === TICK_DELIVERED) {
    return 'Entregado al cliente'
  }
  if (state === TICK_FAILED) {
    const motivo = message && has_text(message.last_send_error) ? String(message.last_send_error).trim() : ''
    return motivo ? 'No se pudo entregar: ' + motivo : 'WhatsApp no pudo entregar el mensaje'
  }
  if (state === TICK_SENT) {
    return 'Enviado'
  }
  return ''
}

/**
 * Nombre del cliente para la primera línea de la fila de la bandeja.
 *
 * Es la EMPRESA del cliente (no el contacto, que se ve en el header de la conversación). Orden:
 * empresa/nombre del cliente, nombre del usuario remoto, nombre del empleado y, si no hay nada,
 * "Cliente #id".
 *
 * @param {Object|null} ticket Ticket de la bandeja.
 * @returns {string}
 */
export function client_display_name(ticket) {
  if (!ticket) {
    return 'Cliente'
  }
  const client = ticket.client
  if (client && has_text(client.company_name)) {
    return String(client.company_name).trim()
  }
  if (client && has_text(client.name)) {
    return String(client.name).trim()
  }
  if (has_text(ticket.client_user_name)) {
    return String(ticket.client_user_name).trim()
  }
  if (ticket.client_employee && has_text(ticket.client_employee.name)) {
    return String(ticket.client_employee.name).trim()
  }
  const client_id = ticket.client_id != null ? ticket.client_id : client && client.id != null ? client.id : null
  if (client_id != null && client_id !== '') {
    return 'Cliente #' + client_id
  }
  return 'Cliente #' + (ticket.id != null ? ticket.id : '')
}

/**
 * true si el ticket tiene el agente apagado y sigue abierto (para el chip «Agente apagado · modo
 * manual»). Un ticket cerrado no lo muestra. Solo cuenta el `false`/`0` explícito: si la API no
 * manda el campo, no se inventa un chip.
 *
 * @param {Object|null} ticket Ticket de la bandeja.
 * @returns {boolean}
 */
export function agent_is_off_on_open_ticket(ticket) {
  if (!ticket) {
    return false
  }
  const closed = ticket.status === 'closed' || !!ticket.closed_at
  if (closed) {
    return false
  }
  return ticket.claude_auto_reply === false || ticket.claude_auto_reply === 0
}

/**
 * Prefijo de quién mandó el último mensaje: 'Vos' si fue el operador logueado, el nombre del
 * operador si fue otro, 'Agente' si lo mandó el agente (mensaje saliente sin operador) y el
 * nombre del cliente si lo escribió el cliente.
 *
 * @param {Object|null} last_message         `ticket.last_message`.
 * @param {number|string|null} current_admin_id Operador logueado.
 * @param {string} client_label              Nombre a usar si lo escribió el cliente.
 * @returns {string}
 */
export function last_message_author(last_message, current_admin_id, client_label) {
  if (!last_message) {
    return ''
  }
  if (last_message.sender_type !== 'admin') {
    return client_label || 'Cliente'
  }
  const admin_id = last_message.sender_admin_id != null
    ? last_message.sender_admin_id
    : last_message.sender_admin && last_message.sender_admin.id != null ? last_message.sender_admin.id : null
  if (admin_id === null) {
    return 'Agente'
  }
  if (current_admin_id !== null && current_admin_id !== undefined && String(admin_id) === String(current_admin_id)) {
    return 'Vos'
  }
  if (last_message.sender_admin && has_text(last_message.sender_admin.name)) {
    return String(last_message.sender_admin.name).trim()
  }
  return 'Operador'
}

/**
 * Total de mensajes del cliente sin leer para el contador del Nav y de la bandeja.
 *
 * Con la API nueva viene `unread_total`. Con una API vieja no viene: se suma `mine + others`.
 *
 * @param {Object|null} data Respuesta con `unread_total` y/o `unread_totals`.
 * @returns {number|null} null si la respuesta no trae ninguno de los dos.
 */
export function unread_total_from_response(data) {
  if (!data || typeof data !== 'object') {
    return null
  }
  if (data.unread_total !== undefined && data.unread_total !== null) {
    const direct = parseInt(data.unread_total, 10)
    if (!isNaN(direct)) {
      return direct < 0 ? 0 : direct
    }
  }
  const totals = data.unread_totals
  if (totals && typeof totals === 'object') {
    const mine = parseInt(totals.mine, 10)
    const others = parseInt(totals.others, 10)
    return (isNaN(mine) ? 0 : mine) + (isNaN(others) ? 0 : others)
  }
  return null
}

/** Campos de entrega que SOLO avanzan: un valor vacío del evento nunca borra uno que ya había. */
const DELIVERY_FIELDS = ['whatsapp_delivered_at', 'whatsapp_seen_at']

/** Campos que el evento copia tal cual cuando vienen definidos (null incluido: reacción quitada). */
const COPY_FIELDS = ['whatsapp_message_id', 'admin_reaction_emoji', 'admin_reaction_at']

/**
 * Peso de cada estado de entrega para no retroceder: vacío < fallido < entregado < leído.
 *
 * @param {*} status Valor de `whatsapp_delivery_status`.
 * @returns {number}
 */
function delivery_rank(status) {
  const value = String(status || '').trim().toLowerCase()
  if (value === 'leido') {
    return 3
  }
  if (value === 'entregado') {
    return 2
  }
  if (value === 'fallido') {
    return 1
  }
  return 0
}

/**
 * Mezcla el payload del evento de estado (o un snapshot del mensaje) sobre un mensaje y devuelve
 * un objeto NUEVO.
 *
 * Reglas:
 *  - Solo copia los campos que el payload trae definidos: un evento sin `admin_reaction_emoji`
 *    (formato que no lo incluye) no borra la reacción que ya había. Una reacción quitada llega
 *    como `null` y sí se aplica.
 *  - El estado de entrega nunca retrocede: un 'leido' no vuelve a 'entregado' si los eventos
 *    llegan desordenados, y un snapshot viejo del mensaje (sin estado) no lo resetea.
 *  - Las fechas de entrega/lectura solo se pisan con un valor.
 *
 * @param {Object} message Mensaje actual (no se muta).
 * @param {Object} payload Payload del evento.
 * @returns {Object}
 */
export function merge_status_payload(message, payload) {
  const merged = Object.assign({}, message)
  if (!payload) {
    return merged
  }
  COPY_FIELDS.forEach(function (field) {
    if (payload[field] !== undefined) {
      merged[field] = payload[field]
    }
  })
  DELIVERY_FIELDS.forEach(function (field) {
    if (has_text(payload[field])) {
      merged[field] = payload[field]
    }
  })
  if (payload.whatsapp_delivery_status !== undefined) {
    const current = message ? message.whatsapp_delivery_status : null
    if (delivery_rank(payload.whatsapp_delivery_status) >= delivery_rank(current)) {
      merged.whatsapp_delivery_status = payload.whatsapp_delivery_status
    }
  }
  return merged
}

/**
 * Devuelve una copia de `incoming` (snapshot del mismo mensaje) conservando el progreso de
 * entrega de `previous` si éste va más adelantado. Es para cuando llega un snapshot viejo del
 * mensaje (p. ej. el que viajó con un evento de lectura del cliente) DESPUÉS de que el evento en
 * vivo ya marcó 'entregado' o 'leido': el snapshot no debe devolver los ticks a un check.
 *
 * @param {Object} incoming Mensaje que llega (no se muta).
 * @param {Object} previous Mensaje que ya teníamos.
 * @returns {Object}
 */
export function keep_best_delivery(incoming, previous) {
  const result = Object.assign({}, incoming)
  if (!previous) {
    return result
  }
  if (delivery_rank(previous.whatsapp_delivery_status) > delivery_rank(incoming ? incoming.whatsapp_delivery_status : null)) {
    result.whatsapp_delivery_status = previous.whatsapp_delivery_status
    result.whatsapp_delivered_at = previous.whatsapp_delivered_at
    result.whatsapp_seen_at = previous.whatsapp_seen_at
  }
  return result
}

/**
 * true si el payload del evento de estado corresponde al mensaje (por id).
 *
 * @param {Object|null} message Mensaje o `last_message`.
 * @param {Object|null} payload Payload del evento.
 * @returns {boolean}
 */
export function payload_matches_message(message, payload) {
  if (!message || !payload || message.id == null || payload.id == null) {
    return false
  }
  return String(message.id) === String(payload.id)
}

/**
 * Emoji de la reacción puesta por el operador sobre un mensaje del cliente, o ''.
 *
 * @param {Object|null} message Mensaje del hilo.
 * @returns {string}
 */
export function admin_reaction_of(message) {
  if (!message || !has_text(message.admin_reaction_emoji)) {
    return ''
  }
  return String(message.admin_reaction_emoji)
}

/**
 * Compara dos emojis ignorando el selector de variación (U+FE0F): "❤" y "❤️" son el mismo.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function same_emoji(a, b) {
  const clean = function (value) {
    return String(value || '').replace(/️/g, '')
  }
  return clean(a) !== '' && clean(a) === clean(b)
}

/**
 * Emoji a mandar a la API al elegir `chosen` en un mensaje que ya tiene `current` puesto: el
 * mismo emoji quita la reacción (devuelve null), cualquier otro la reemplaza.
 *
 * @param {string} current Reacción actual ('' si no hay).
 * @param {string} chosen  Emoji elegido en la barra.
 * @returns {string|null}
 */
export function emoji_to_send(current, chosen) {
  return same_emoji(current, chosen) ? null : chosen
}

/**
 * true si el mensaje admite reacción del operador: mensaje del cliente con `whatsapp_message_id`
 * en un ticket de WhatsApp. Los tickets del ERP no tienen botón.
 *
 * @param {Object|null} message Mensaje del hilo.
 * @param {string|null} ticket_source Origen del ticket ('whatsapp' | 'erp').
 * @returns {boolean}
 */
export function can_react_to_message(message, ticket_source) {
  if (ticket_source !== 'whatsapp' || !message) {
    return false
  }
  return message.sender_type === 'user' && has_text(message.whatsapp_message_id) && message.id != null
}
