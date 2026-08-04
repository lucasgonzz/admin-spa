/**
 * Cliente HTTP hacia admin-api con prefijo /api/admin y token Sanctum.
 */
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/admin',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

/**
 * Mensajes genéricos de Laravel cuando la validación falla (422); no aportan detalle al usuario.
 */
const GENERIC_VALIDATION_MESSAGES = [
  'The given data was invalid.',
  'Los datos proporcionados no son válidos.',
]

/**
 * Indica si un texto es el mensaje genérico de validación de Laravel.
 *
 * @param {string} message
 * @returns {boolean}
 */
function is_generic_validation_message(message) {
  const normalized_message = String(message || '').trim()
  if (normalized_message === '') {
    return false
  }
  let is_generic = false
  GENERIC_VALIDATION_MESSAGES.forEach(function (generic_text) {
    if (normalized_message === generic_text) {
      is_generic = true
    }
  })
  return is_generic
}

/**
 * Extrae todos los mensajes del objeto `errors` de una respuesta 422 de Laravel.
 *
 * @param {Record<string, string[]|string>|string[]|null|undefined} errors_payload
 * @returns {string[]}
 */
function extract_laravel_validation_messages(errors_payload) {
  /** Lista acumulada de mensajes concretos para mostrar en UI. */
  const validation_messages = []
  if (!errors_payload) {
    return validation_messages
  }
  if (Array.isArray(errors_payload)) {
    errors_payload.forEach(function (item) {
      if (item != null && String(item).trim() !== '') {
        validation_messages.push(String(item))
      }
    })
    return validation_messages
  }
  if (typeof errors_payload !== 'object') {
    return validation_messages
  }
  const field_keys = Object.keys(errors_payload)
  field_keys.forEach(function (field_key) {
    const field_errors = errors_payload[field_key]
    if (Array.isArray(field_errors)) {
      field_errors.forEach(function (field_message) {
        if (field_message != null && String(field_message).trim() !== '') {
          validation_messages.push(String(field_message))
        }
      })
      return
    }
    if (typeof field_errors === 'string' && field_errors.trim() !== '') {
      validation_messages.push(field_errors)
    }
  })
  return validation_messages
}

/**
 * Obtiene el mensaje de error más útil desde la respuesta de admin-api.
 * Prioriza errores de validación por campo sobre el mensaje genérico "The given data was invalid."
 *
 * @param {import('axios').AxiosError} error
 * @returns {string}
 */
/**
 * Devuelve el origen (protocolo + host, sin el sufijo `/api/admin`) del servidor de admin-api.
 *
 * Se usa para armar URLs de recursos servidos por admin-api fuera del prefijo `/api/admin`
 * (ej. `logo_path` de la config fiscal, servido como archivo público estático), ya que el
 * cliente axios `api` de este archivo tiene `baseURL` apuntando a `/api/admin` y no sirve para
 * construir esas rutas directamente.
 *
 * @returns {string} Origen absoluto (ej. "http://localhost:8003") o "" si `VITE_API_URL` es
 *   relativo (mismo origen que el front).
 */
export function admin_api_origin() {
  /** Mismo valor de baseURL usado al crear el cliente `api` de este archivo. */
  const base = import.meta.env.VITE_API_URL || '/api/admin'
  /* Si `base` es una URL absoluta con el sufijo /api/admin, nos quedamos con el origen.
     Si es relativa (default '/api/admin', mismo origen que el front), el replace matchea
     la cadena completa y devuelve '' (string vacío = mismo origen). */
  return base.replace(/\/api\/admin\/?$/, '')
}

/*
 * Orden de precedencia (4/8/2026 — caso: adjuntar una foto desde el iPhone fallaba siempre con
 * el mismo mensaje genérico, sin importar la causa real, porque acá abajo se descartaba el
 * status HTTP disponible):
 *   1. Sin respuesta: se distingue timeout de "no se pudo contactar" — son causas y soluciones
 *      distintas para quien lo lee.
 *   2. 413: se atiende ANTES de intentar leer el cuerpo, porque en un 413 el cuerpo es HTML del
 *      servidor web (o está vacío) — leerlo como JSON siempre fallaba y caía al fallback de
 *      abajo, borrando la única información real que había (el status).
 *   3. Mensajes de validación de Laravel (422) y el resto de la lógica ya existente: se
 *      mantienen intactos y con prioridad sobre los dos casos nuevos de abajo, porque son el
 *      detalle más específico que puede mandar el backend.
 *   4. 5xx sin `message` utilizable en el cuerpo: se muestra el status real para que se pueda
 *      buscar en los logs, en vez de caer al fallback genérico.
 */
export function resolve_error_message(error) {
  /** Mensaje por defecto para fallas sin detalle de backend ni status reconocido. */
  const fallback_message = 'Ocurrió un error al comunicarse con el servidor.'

  if (!error || !error.response) {
    const is_timeout = !!(
      error &&
      (error.code === 'ECONNABORTED' ||
        (error.message && error.message.toLowerCase().indexOf('timeout') !== -1))
    )
    if (is_timeout) {
      return 'La conexión tardó demasiado. Puede ser una señal débil o un archivo muy pesado.'
    }
    return 'No se pudo contactar al servidor. Revisá la conexión.'
  }

  /** Status HTTP de la respuesta; disponible aunque el cuerpo no sea JSON utilizable. */
  const status_code = error.response.status

  if (status_code === 413) {
    return 'El archivo es demasiado grande para el servidor. Probá con uno más chico.'
  }

  /** Payload de error devuelto por Laravel/admin-api. */
  const response_data = error.response.data || {}

  /** Mensajes por campo (422); deben mostrarse antes que el message genérico de Laravel. */
  const validation_messages = extract_laravel_validation_messages(response_data.errors)
  if (validation_messages.length > 0) {
    return validation_messages.join(', ')
  }

  if (typeof response_data.message === 'string' && response_data.message.trim() !== '') {
    if (!is_generic_validation_message(response_data.message)) {
      return response_data.message
    }
  }
  if (typeof response_data.error === 'string' && response_data.error.trim() !== '') {
    return response_data.error
  }
  if (typeof response_data.message === 'string' && response_data.message.trim() !== '') {
    return response_data.message
  }

  if (status_code >= 500) {
    return 'El servidor tuvo un error (código ' + status_code + '). Volvé a intentar en un momento.'
  }

  return fallback_message
}

/**
 * Emite un evento global para que la UI muestre un toast de error.
 *
 * @param {string} message
 * @returns {void}
 */
function emit_api_error_toast(message) {
  window.dispatchEvent(
    new CustomEvent('admin-spa-toast', {
      detail: {
        message,
        variant: 'danger',
      },
    })
  )
}

api.interceptors.request.use(
  (config) => {
    const token = window.localStorage.getItem('admin_token')
    if (token) {
      config.headers.Authorization = 'Bearer ' + token
    }
    return config
  },
  (err) => Promise.reject(err)
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    /** Status HTTP para evitar toasts en errores de autenticación no relevantes para UX global. */
    const status_code = error && error.response ? error.response.status : null
    /** Peticiones con silent_error: true no muestran toast (p. ej. debug/virtual-time 404 en producción). */
    const silent_error = error && error.config && error.config.silent_error === true
    if (status_code !== 401 && !silent_error) {
      /** Mensaje final que se mostrará en la toast. */
      const error_message = resolve_error_message(error)
      emit_api_error_toast(error_message)
    }
    return Promise.reject(error)
  }
)

export default api
