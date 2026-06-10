/**
 * Utilidades para armar y copiar al portapapeles el texto de notificaciones
 * de versión destinado al cliente (WhatsApp, etc.).
 */

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
    if (trimmed.indexOf('➡️') === 0) {
      details.push(trimmed)
    }
  })

  return details
}

/**
 * Formatea una notificación individual: título y debajo cada detalle en su línea.
 *
 * @param {Object} notif  Registro con title y body.
 * @returns {string}
 */
export function format_single_notification_for_clipboard(notif) {
  var title = notif && notif.title ? String(notif.title).trim() : ''
  var details = extract_notification_details(notif ? notif.body : '')
  var lines = []

  if (title) {
    lines.push(title)
  }

  details.forEach(function (detail) {
    lines.push(detail)
  })

  return lines.join('\n')
}

/**
 * Arma el mensaje completo con todas las notificaciones separadas por doble salto de línea.
 *
 * @param {Array} notifications  Lista de notificaciones del upgrade.
 * @param {Object} [options]
 * @param {boolean} [options.only_active=true]  Si true, omite notificaciones inactivas.
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

  return blocks.join('\n\n')
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
