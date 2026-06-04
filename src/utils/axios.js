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
export function resolve_error_message(error) {
  /** Mensaje por defecto para fallas sin detalle de backend. */
  const fallback_message = 'Ocurrió un error al comunicarse con el servidor.'
  if (!error || !error.response || !error.response.data) {
    return fallback_message
  }

  /** Payload de error devuelto por Laravel/admin-api. */
  const response_data = error.response.data

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
    if (status_code !== 401) {
      /** Mensaje final que se mostrará en la toast. */
      const error_message = resolve_error_message(error)
      emit_api_error_toast(error_message)
    }
    return Promise.reject(error)
  }
)

export default api
