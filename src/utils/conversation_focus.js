/**
 * Utilidades puras para enfocar un mensaje puntual dentro de la conversación de un lead.
 *
 * Las usa LeadConversationView cuando se abre desde un push de "mensaje por aprobar"
 * (ruta con `?message_id=N`): centra la burbuja y la resalta un momento.
 */

/** Milisegundos que dura el resalte antes de quitar la clase. */
const FOCUS_FLASH_MS = 1600

/**
 * Lee el id de mensaje desde el query de la ruta.
 *
 * @param {object|undefined} query Query de la ruta (por ejemplo this.$route.query).
 * @returns {number|null} Entero positivo, o null si falta o es inválido ('abc', '0', '-3', '1.5', arrays).
 */
export function message_id_from_query(query) {
  if (!query) {
    return null
  }
  /** Valor crudo; sólo se aceptan number y string (un array o un objeto se descartan). */
  const raw_value = query.message_id
  if (typeof raw_value !== 'number' && typeof raw_value !== 'string') {
    return null
  }
  const text = String(raw_value).trim()
  /* Sólo dígitos: descarta signos, decimales y notación científica. */
  if (!/^[0-9]+$/.test(text)) {
    return null
  }
  const parsed = parseInt(text, 10)
  return parsed > 0 && Number.isSafeInteger(parsed) ? parsed : null
}

/**
 * Centra la fila del mensaje en el área visible y la resalta con una clase temporal.
 * Si la fila no existe no hace nada y nunca lanza.
 *
 * @param {Element|null} root_el Elemento donde buscar (raíz de la vista).
 * @param {number|string} message_id Id del mensaje (se busca [data-message-id="N"]).
 * @param {string} flash_class Clase CSS de resalte; se quita a los 1600 ms.
 * @returns {boolean} true si encontró la fila y la enfocó; false si no.
 */
export function focus_message_row(root_el, message_id, flash_class) {
  try {
    if (!root_el || typeof root_el.querySelector !== 'function') {
      return false
    }
    /** Fila del mensaje buscada por su atributo data. */
    const row_el = root_el.querySelector('[data-message-id="' + String(message_id) + '"]')
    if (!row_el) {
      return false
    }
    if (typeof row_el.scrollIntoView === 'function') {
      row_el.scrollIntoView({ block: 'center' })
    }
    row_el.classList.add(flash_class)
    setTimeout(function () {
      row_el.classList.remove(flash_class)
    }, FOCUS_FLASH_MS)
    return true
  } catch (error) {
    return false
  }
}
