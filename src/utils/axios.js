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
 * Obtiene el mensaje de error más útil desde la respuesta de admin-api.
 *
 * @param {import('axios').AxiosError} error
 * @returns {string}
 */
function resolve_error_message(error) {
  /** Mensaje por defecto para fallas sin detalle de backend. */
  const fallback_message = 'Ocurrió un error al comunicarse con el servidor.'
  if (!error || !error.response || !error.response.data) {
    return fallback_message
  }

  /** Payload de error devuelto por Laravel/admin-api. */
  const response_data = error.response.data
  if (typeof response_data.message === 'string' && response_data.message.trim() !== '') {
    return response_data.message
  }
  if (typeof response_data.error === 'string' && response_data.error.trim() !== '') {
    return response_data.error
  }
  if (Array.isArray(response_data.errors)) {
    return response_data.errors.join(', ')
  }
  if (response_data.errors && typeof response_data.errors === 'object') {
    /** Primer mensaje de validación disponible (Laravel validation errors). */
    const error_keys = Object.keys(response_data.errors)
    if (error_keys.length > 0) {
      const first_error_list = response_data.errors[error_keys[0]]
      if (Array.isArray(first_error_list) && first_error_list.length > 0) {
        return String(first_error_list[0])
      }
    }
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
