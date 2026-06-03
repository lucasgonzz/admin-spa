/**
 * Gestión global de la tecla Escape para cerrar modales.
 * Usa una pila LIFO: el modal abierto más recientemente se cierra primero (soporta modales anidados).
 */

/** Callbacks de cierre registrados por cada modal visible, en orden de apertura. */
const escape_close_stack = []

/** Indica si el listener de document ya está activo. */
let document_listener_active = false

/**
 * Maneja Escape en document: cierra solo el modal del tope de la pila.
 *
 * @param {KeyboardEvent} event
 */
function on_document_escape(event) {
  if (event.key !== 'Escape' && event.key !== 'Esc') {
    return
  }
  const close_fn = escape_close_stack[escape_close_stack.length - 1]
  if (!close_fn) {
    return
  }
  event.preventDefault()
  event.stopPropagation()
  close_fn()
}

/**
 * Activa el listener en document si aún no existe.
 */
function ensure_document_listener() {
  if (!document_listener_active) {
    document.addEventListener('keydown', on_document_escape, true)
    document_listener_active = true
  }
}

/**
 * Quita el listener cuando no queda ningún modal registrado.
 */
function remove_document_listener_if_empty() {
  if (escape_close_stack.length === 0 && document_listener_active) {
    document.removeEventListener('keydown', on_document_escape, true)
    document_listener_active = false
  }
}

/**
 * Registra un callback para cerrar el modal con Escape.
 *
 * @param {Function} close_fn Función que cierra el modal (sin argumentos).
 * @returns {Function} Función para desregistrar este modal de la pila.
 */
export function register_modal_escape(close_fn) {
  escape_close_stack.push(close_fn)
  ensure_document_listener()
  return function unregister_modal_escape() {
    const idx = escape_close_stack.indexOf(close_fn)
    if (idx >= 0) {
      escape_close_stack.splice(idx, 1)
    }
    remove_document_listener_if_empty()
  }
}
