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

/** Texto exacto con el que el middleware `throttle` de Laravel rechaza un pedido. */
const THROTTLE_LARAVEL_MESSAGE = 'Too Many Attempts.'
/** Lo que ve el operador si el pedido sigue rebotando después de los reintentos. */
const THROTTLE_USER_MESSAGE =
  'El sistema recibió muchos pedidos seguidos. Esperá un momento y volvé a intentar.'
/** Reintentos automáticos de un mismo pedido rechazado por el throttle. */
const THROTTLE_MAX_RETRIES = 2
/** Espera de cada reintento cuando la respuesta no trae `Retry-After`. */
const THROTTLE_WAIT_WITHOUT_HEADER_MS = [5000, 10000]
/** Cotas de la espera: la ventana del limitador es de un minuto, nunca tiene sentido más. */
const THROTTLE_MIN_WAIT_MS = 1000
const THROTTLE_MAX_WAIT_MS = 65000
/** Dispersión al salir de la pausa, para que los pedidos en espera no vuelvan todos juntos. */
const THROTTLE_JITTER_MS = 400

/**
 * Instante (ms) hasta el que no sale ningún pedido. Es de todo el cliente y no por pedido: con la
 * cubeta agotada, cualquier pedido nuevo rebotaría igual y encima alargaría el problema.
 */
let throttle_pause_until = 0

/**
 * Indica si el error es el rechazo del middleware `throttle` de Laravel.
 *
 * 🔴 Status Y mensaje: un 429 con texto propio de un controller (por ejemplo, un tope de negocio)
 * no es esto, puede ser una respuesta después de haber hecho algo y su texto hay que mostrarlo.
 *
 * @param {import('axios').AxiosError} error
 * @returns {boolean}
 */
function is_throttle_error(error) {
  if (!error || !error.response || error.response.status !== 429) {
    return false
  }
  const response_data = error.response.data
  return !!response_data && response_data.message === THROTTLE_LARAVEL_MESSAGE
}

/**
 * Calcula cuánto esperar antes de volver a pegarle a la API tras un rechazo del throttle.
 *
 * @param {import('axios').AxiosResponse} response
 * @param {number} retry_count Reintentos ya hechos de este pedido.
 * @returns {number} Milisegundos.
 */
function throttle_wait_ms(response, retry_count) {
  const headers = response.headers || {}
  const retry_after =
    typeof headers.get === 'function' ? headers.get('retry-after') : headers['retry-after']
  const retry_after_seconds = parseInt(retry_after, 10)
  if (isNaN(retry_after_seconds)) {
    const last_index = THROTTLE_WAIT_WITHOUT_HEADER_MS.length - 1
    return THROTTLE_WAIT_WITHOUT_HEADER_MS[Math.min(retry_count, last_index)]
  }
  return Math.min(THROTTLE_MAX_WAIT_MS, Math.max(THROTTLE_MIN_WAIT_MS, retry_after_seconds * 1000))
}

/**
 * Resuelve cuando termina la pausa compartida, incluso si se alargó mientras se esperaba.
 *
 * @returns {Promise<void>}
 */
function wait_for_throttle_pause() {
  const remaining_ms = throttle_pause_until - Date.now()
  if (remaining_ms <= 0) {
    return Promise.resolve()
  }
  return new Promise(function (resolve) {
    window.setTimeout(resolve, remaining_ms + Math.random() * THROTTLE_JITTER_MS)
  }).then(wait_for_throttle_pause)
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

  if (is_throttle_error(error)) {
    return THROTTLE_USER_MESSAGE
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
    /* Durante la pausa del throttle el pedido espera acá en vez de salir a rebotar. El token se lee
       después de esperar, porque la pausa puede durar un minuto y en el medio cambiar la sesión. */
    return wait_for_throttle_pause().then(function () {
      const token = window.localStorage.getItem('admin_token')
      if (token) {
        config.headers.Authorization = 'Bearer ' + token
      }
      return config
    })
  },
  (err) => Promise.reject(err)
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    /*
     * Rechazo del throttle: reintento automático y sin avisar (misión admin-too-many-attempts,
     * 10/11/2026). Vale para cualquier método, POST incluido, porque el throttle corta antes de
     * llegar al controller: nada se ejecutó, no hay riesgo de duplicar. El reintento pasa por el
     * interceptor de request, que es el que hace la espera.
     */
    if (is_throttle_error(error) && error.config) {
      const retry_count = error.config.throttle_retry_count || 0
      throttle_pause_until = Math.max(
        throttle_pause_until,
        Date.now() + throttle_wait_ms(error.response, retry_count)
      )
      if (retry_count < THROTTLE_MAX_RETRIES) {
        return api.request(
          Object.assign({}, error.config, {
            throttle_retry_count: retry_count + 1,
            /* `error.config.data` ya salió transformado del primer intento (JSON hecho string, o
               el mismo FormData): se reenvía tal cual para no volver a codificarlo. */
            transformRequest: [
              function (data) {
                return data
              },
            ],
          })
        )
      }
    }

    /** Status HTTP para evitar toasts en errores de autenticación no relevantes para UX global. */
    const status_code = error && error.response ? error.response.status : null
    /** Peticiones con silent_error: true no muestran toast (p. ej. debug/virtual-time 404 en producción). */
    const silent_error = error && error.config && error.config.silent_error === true
    /**
     * `silent_error_statuses: [404, 405]` silencia SOLO esos status y deja avisar a todos los
     * demás. Es para el que sondea un endpoint que puede no existir todavía (el SPA y la API no
     * llegan juntos a producción) y tiene un camino de respaldo: el 404 del sondeo no es un
     * problema del operador, pero un 500 sí — y con `silent_error: true` a secas se perdía.
     */
    const silent_statuses = (error && error.config && error.config.silent_error_statuses) || null
    const silenciado_por_status =
      Array.isArray(silent_statuses) && silent_statuses.indexOf(status_code) !== -1
    if (status_code !== 401 && !silent_error && !silenciado_por_status) {
      /** Mensaje final que se mostrará en la toast. */
      const error_message = resolve_error_message(error)
      emit_api_error_toast(error_message)
    }
    return Promise.reject(error)
  }
)

export default api
