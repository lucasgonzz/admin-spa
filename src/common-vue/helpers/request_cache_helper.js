/**
 * Deduplicación y caché de requests hacia admin-api.
 *
 * Resuelve dos problemas distintos con la misma pieza:
 *
 *   1. **Promesa en vuelo compartida.** Dos componentes que se montan en el mismo tick y piden lo
 *      mismo (el Nav y la vista, por ejemplo) hoy disparan dos requests idénticas. Con `run_once`
 *      la segunda se engancha a la promesa de la primera: misma data, misma resolución, una sola
 *      ida al servidor. Esto no introduce datos viejos en ningún caso, porque el valor que llega
 *      es el mismo que habría llegado por el segundo pedido.
 *
 *   2. **Ventana de frescura.** Para lo que no cambia dentro de una sesión (el meta de un modelo,
 *      las preferencias de columnas) o para lo que se vuelve a pedir a los pocos segundos por un
 *      remonte, `max_age_ms` evita repetir el pedido mientras el valor sea reciente. Pasado el
 *      umbral se vuelve a pedir, siempre.
 *
 * 🔴 **La regla que ordena todo esto: ningún caché puede dejar datos viejos a la vista.** Por eso
 * un interceptor de respuestas invalida solo la entrada afectada cuando una escritura (POST, PUT,
 * PATCH, DELETE) toca la misma ruta que un GET cacheado. Eso cubre incluso a los componentes que
 * escriben sin saber que hay un caché del otro lado.
 */
import api from '@/utils/axios'

/**
 * Ventana pensada para lo que no cambia dentro de una sesión y solo se invalida al escribirlo
 * (meta de modelos, preferencias de columnas). No es "para siempre": si la pestaña queda abierta
 * un día entero, se vuelve a pedir.
 */
export const MAX_AGE_SESION = 24 * 60 * 60 * 1000

/**
 * Ventana corta para badges y contadores que se remontan al navegar. Alcanza para absorber un
 * ida y vuelta entre pantallas sin que nada quede atrasado más de medio minuto.
 */
export const MAX_AGE_BADGES = 30 * 1000

/**
 * Ventana media para los `GET /settings/*`, que solo cambian cuando alguien los guarda desde
 * /cuenta — y ese guardado invalida la entrada por el interceptor de abajo.
 */
export const MAX_AGE_SETTINGS = 5 * 60 * 1000

/**
 * @typedef {Object} EntradaDeCache
 * @property {Promise|null} promise Promesa en vuelo, o null si no hay ninguna.
 * @property {number} resolved_at Timestamp de la última resolución exitosa.
 * @property {boolean} has_value Si `value` tiene algo que se pueda devolver.
 * @property {*} value Último valor resuelto.
 */

/** @type {Object<string, EntradaDeCache>} */
const entries = {}

/**
 * Devuelve (creando si hace falta) la entrada de caché de una clave.
 *
 * @param {string} key
 * @returns {EntradaDeCache}
 */
function entry_for(key) {
  if (!entries[key]) {
    entries[key] = { promise: null, resolved_at: 0, has_value: false, value: null }
  }
  return entries[key]
}

/**
 * Ejecuta `run` deduplicando: si ya hay una promesa en vuelo para esa clave devuelve esa misma, y
 * si el último valor sigue dentro de `max_age_ms` lo devuelve sin pedir nada.
 *
 * Un rechazo limpia la entrada: un error nunca queda cacheado.
 *
 * @param {string} key Clave de deduplicación (ej. `meta:lead`).
 * @param {function(): Promise} run Qué hacer cuando efectivamente hay que pedir.
 * @param {Object} [options]
 * @param {number} [options.max_age_ms] Ventana de frescura; sin ella siempre se vuelve a pedir.
 * @returns {Promise}
 */
export function run_once(key, run, options) {
  const opts = options || {}
  const entry = entry_for(key)

  if (entry.promise) {
    return entry.promise
  }

  const max_age = parseInt(opts.max_age_ms, 10)
  const es_fresco =
    !isNaN(max_age) && max_age > 0 && entry.has_value && Date.now() - entry.resolved_at < max_age
  if (es_fresco) {
    return Promise.resolve(entry.value)
  }

  entry.promise = run()
    .then(function (value) {
      entry.promise = null
      entry.resolved_at = Date.now()
      entry.has_value = true
      entry.value = value
      return value
    })
    .catch(function (err) {
      entry.promise = null
      entry.resolved_at = 0
      entry.has_value = false
      entry.value = null
      throw err
    })

  return entry.promise
}

/**
 * Registra que el dato de esa clave se acaba de traer por otro camino, para que la próxima
 * ventana de frescura lo cuente desde ahora.
 *
 * @param {string} key
 * @param {*} [value] Valor a devolver si alguien lo pide dentro de la ventana.
 * @returns {void}
 */
export function touch_request(key, value) {
  const entry = entry_for(key)
  entry.resolved_at = Date.now()
  entry.has_value = true
  entry.value = value
}

/**
 * Olvida lo cacheado para esa clave: el próximo pedido vuelve a salir al servidor.
 *
 * @param {string} key
 * @returns {void}
 */
export function forget_request(key) {
  delete entries[key]
}

/**
 * Clave interna de un GET cacheado.
 *
 * @param {string} path
 * @returns {string}
 */
function key_for_get(path) {
  return 'GET ' + String(path).split('?')[0]
}

/**
 * GET cacheado contra admin-api. Devuelve `res.data`, igual que si se hubiera hecho el GET a mano.
 *
 * @param {string} path Ruta relativa al baseURL de axios (ej. `/settings/lead-demo`).
 * @param {Object} [options]
 * @param {number} [options.max_age_ms] Ventana de frescura.
 * @param {Object} [options.request_config] Config extra de axios (ej. `{ silent_error: true }`).
 * @returns {Promise<*>} Cuerpo de la respuesta.
 */
export function cached_get(path, options) {
  const opts = options || {}
  return run_once(
    key_for_get(path),
    function () {
      return api.get(path, opts.request_config).then(function (res) {
        return res.data
      })
    },
    { max_age_ms: opts.max_age_ms }
  )
}

/**
 * Invalida a mano un GET cacheado.
 *
 * @param {string} path
 * @returns {void}
 */
export function invalidate_cached_get(path) {
  forget_request(key_for_get(path))
}

/**
 * Invalida todo GET cacheado que la escritura de `written_path` pueda haber ensuciado: la misma
 * ruta, sus descendientes y sus ancestros.
 *
 * Ejemplos: un `PUT /settings/lead-demo` invalida `GET /settings/lead-demo`; un
 * `PUT /column-preferences/lead` invalida `GET /column-preferences/lead`.
 *
 * @param {string} written_path Ruta que se acaba de escribir (sin query string).
 * @returns {void}
 */
function invalidate_paths_touched_by(written_path) {
  const escrita = String(written_path || '').split('?')[0]
  if (escrita === '') {
    return
  }
  Object.keys(entries).forEach(function (key) {
    if (key.indexOf('GET ') !== 0) {
      return
    }
    const cacheada = key.slice(4)
    const es_la_misma = cacheada === escrita
    const el_write_es_ancestro = cacheada.indexOf(escrita + '/') === 0
    const el_write_es_descendiente = escrita.indexOf(cacheada + '/') === 0
    if (es_la_misma || el_write_es_ancestro || el_write_es_descendiente) {
      delete entries[key]
    }
  })
}

/*
 * Una sola vez al cargar el módulo: toda escritura exitosa invalida lo que haya cacheado de esa
 * ruta. Va acá y no en cada componente a propósito — el que guarda no tiene por qué saber que
 * alguien más cacheó la lectura.
 */
api.interceptors.response.use(function (response) {
  const config = response.config || {}
  const method = String(config.method || 'get').toLowerCase()
  if (method !== 'get' && method !== 'head') {
    invalidate_paths_touched_by(config.url)
  }
  return response
})
