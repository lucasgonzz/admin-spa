/**
 * Utilidades para armar y copiar al portapapeles el texto de notificaciones
 * de versión destinado al cliente (WhatsApp, etc.).
 */

/** Emoji del título de cada notificación (resaltado). */
var NOTIFICATION_TITLE_EMOJI = '✅'

/** Emoji de cada renglón de detalle (menos llamativo que el del título). */
var NOTIFICATION_DETAIL_EMOJI = '➡️'

/**
 * Nombre de la persona de contacto del cliente (para saludo en WhatsApp).
 * Prioriza name; si no hay, cae a company_name.
 *
 * @param {Object|null} client  Relación client del upgrade.
 * @returns {string}
 */
export function resolve_client_display_name(client) {
  if (!client) {
    return ''
  }

  var person_name = client.name ? String(client.name).trim() : ''
  if (person_name) {
    return person_name
  }

  return client.company_name ? String(client.company_name).trim() : ''
}

/**
 * URL del SPA destino del upgrade (link de ingreso post-actualización).
 *
 * @param {Object|null} update  ClientVersionUpgrade con target_client_api.
 * @returns {string}
 */
export function resolve_update_spa_url(update) {
  if (!update || !update.target_client_api || !update.target_client_api.spa_url) {
    return ''
  }

  return String(update.target_client_api.spa_url).trim()
}

/**
 * Extrae las líneas de detalle del cuerpo de una notificación.
 * Se consideran detalle las líneas que comienzan con el emoji ➡️.
 *
 * @param {string} body  Texto completo del cuerpo almacenado en admin.
 * @returns {string[]}
 */
export function extract_notification_details(body) {
  if (!body || !String(body).trim()) {
    return []
  }

  var details = []
  var lines = String(body).split(/\r?\n/)

  lines.forEach(function (line) {
    var trimmed = line.trim()
    if (trimmed.indexOf(NOTIFICATION_DETAIL_EMOJI) === 0) {
      details.push(trimmed)
    }
  })

  return details
}

/**
 * Convierte el cuerpo de una notificación en renglones con emoji de detalle.
 * Si ya tiene líneas con ➡️, las reutiliza; si no, parte el texto por párrafos.
 *
 * @param {string} body
 * @returns {string[]}
 */
export function body_to_notification_details(body) {
  var existing_details = extract_notification_details(body)
  if (existing_details.length > 0) {
    return existing_details
  }

  if (!body || !String(body).trim()) {
    return []
  }

  var details = []
  var paragraphs = String(body).split(/\n\n+/)

  paragraphs.forEach(function (paragraph) {
    var trimmed = paragraph.trim()
    if (trimmed) {
      details.push(NOTIFICATION_DETAIL_EMOJI + ' ' + trimmed)
    }
  })

  return details
}

/**
 * Formatea el título de una notificación con ✅ y negrita para WhatsApp.
 *
 * @param {string} title
 * @returns {string}
 */
export function format_notification_title_for_clipboard(title) {
  var clean_title = title ? String(title).trim() : ''
  if (!clean_title) {
    return ''
  }

  if (clean_title.indexOf(NOTIFICATION_TITLE_EMOJI) === 0) {
    clean_title = clean_title.replace(/^✅\s*/, '').trim()
  }

  clean_title = clean_title.replace(/^\*\*(.*)\*\*$/, '$1').trim()
  if (!clean_title) {
    return ''
  }

  return NOTIFICATION_TITLE_EMOJI + ' **' + clean_title + '**'
}

/**
 * Arma el encabezado del mensaje para el cliente (saludo, link SPA y cantidad).
 *
 * @param {string} client_name
 * @param {string} spa_url
 * @param {number} notifications_count
 * @returns {string}
 */
export function build_notifications_intro_message(client_name, spa_url, notifications_count) {
  var display_name = client_name ? String(client_name).trim() : ''
  if (!display_name) {
    display_name = 'equipo'
  }

  var link = spa_url ? String(spa_url).trim() : ''
  var intro_line = 'Hola ' + display_name + ', queremos avisarte que les actualizamos el sistema'

  if (link) {
    intro_line += ', ahora van a ingresar desde ' + link + '.'
  } else {
    intro_line += '.'
  }

  var count_line = ''
  if (notifications_count === 1) {
    count_line = 'Te dejamos la 1 notificación de la nueva versión:'
  } else {
    count_line = 'Te dejamos las ' + notifications_count + ' notificaciones de la nueva versión:'
  }

  return intro_line + '\n\n' + count_line + '\n'
}

/**
 * Formatea una notificación individual: título con ✅ y cada detalle con ➡️.
 *
 * @param {Object} notif  Registro con title y body.
 * @returns {string}
 */
export function format_single_notification_for_clipboard(notif) {
  var formatted_title = format_notification_title_for_clipboard(notif ? notif.title : '')
  var details = body_to_notification_details(notif ? notif.body : '')
  var lines = []

  if (formatted_title) {
    lines.push(formatted_title)
  }

  details.forEach(function (detail) {
    lines.push(detail)
  })

  return lines.join('\n')
}

/**
 * Arma el mensaje completo con encabezado y todas las notificaciones separadas por doble salto de línea.
 *
 * @param {Array} notifications  Lista de notificaciones del upgrade.
 * @param {Object} [options]
 * @param {boolean} [options.only_active=true]  Si true, omite notificaciones inactivas.
 * @param {Object} [options.update]  Upgrade con client y target_client_api para el encabezado.
 * @param {string} [options.client_name]  Nombre del cliente (opcional si se pasa update).
 * @param {string} [options.spa_url]  URL del SPA (opcional si se pasa update).
 * @returns {string}
 */
export function format_notifications_for_clipboard(notifications, options) {
  var opts = options || {}
  var only_active = opts.only_active !== false
  var blocks = []

  if (!Array.isArray(notifications)) {
    return ''
  }

  notifications.forEach(function (notif) {
    if (only_active && notif && notif.is_active === false) {
      return
    }

    var block = format_single_notification_for_clipboard(notif)
    if (block) {
      blocks.push(block)
    }
  })

  if (!blocks.length) {
    return ''
  }

  var client_name = opts.client_name ? String(opts.client_name).trim() : ''
  var spa_url = opts.spa_url ? String(opts.spa_url).trim() : ''

  if (opts.update) {
    if (!client_name) {
      client_name = resolve_client_display_name(opts.update.client)
    }
    if (!spa_url) {
      spa_url = resolve_update_spa_url(opts.update)
    }
  }

  var intro = build_notifications_intro_message(client_name, spa_url, blocks.length)
  return intro + '\n' + blocks.join('\n\n')
}

/**
 * Copia un texto al portapapeles con fallback para navegadores sin Clipboard API.
 *
 * @param {string} text
 * @returns {Promise<void>}
 */
export function copy_text_to_clipboard(text) {
  return new Promise(function (resolve, reject) {
    if (!text) {
      reject(new Error('empty_text'))
      return
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(resolve).catch(function () {
        if (fallback_copy_text(text)) {
          resolve()
        } else {
          reject(new Error('copy_failed'))
        }
      })
      return
    }

    if (fallback_copy_text(text)) {
      resolve()
    } else {
      reject(new Error('copy_failed'))
    }
  })
}

/**
 * Fallback de copiado mediante textarea temporal y execCommand.
 *
 * @param {string} text
 * @returns {boolean}
 */
function fallback_copy_text(text) {
  if (typeof document === 'undefined') {
    return false
  }

  var textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, text.length)

  var copied = false
  try {
    copied = document.execCommand('copy')
  } catch (e) {
    copied = false
  }

  document.body.removeChild(textarea)
  return copied
}
