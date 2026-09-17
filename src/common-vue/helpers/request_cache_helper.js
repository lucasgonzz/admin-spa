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
 *      las preferencias de columnas), `max_age_ms` evita repetir el pedido mientras el valor sea
 *      reciente. Pasado el umbral se vuelve a pedir, siempre.
 *
 * 🔴 **La regla que ordena todo esto: ningún caché puede dejar datos viejos a la vista.** Por eso
 * un interceptor de respuestas invalida solo la entrada afectada cuando una escritura (POST, PUT,
 * PATCH, DELETE) toca la misma ruta que un GET cacheado. Eso cubre incluso a los componentes que
 * escriben sin saber que hay un caché del otro lado.
 *
 * 🔴 **Y por eso los badges del Nav NO usan ventana, solo el punto 1.** Se probó con una de medio
 * minuto y perdía eventos: el Nav vive bajo un `v-if` en App.vue y se desmonta al entrar a una
 * conversación, así que mientras no está montado sus sockets están caídos y todo lo que llega en
 * el medio se pierde. Lo único que recuperaba ese hueco era el GET del remonte — que es
 * exactamente el que la ventana saltea si la ida y vuelta duró menos que el umbral. El duplicado
 * que la ventana quería evitar (el Nav y la vista pidiendo lo mismo al entrar a un módulo) pasa en
 * el MISMO tick, así que lo resuelve solo el punto 1, sin ventana.
 */
import api from '@/utils/axios'

/**
 * Ventana pensada para lo que no cambia dentro de una sesión y solo se invalida al escribirlo
 * (meta de modelos, preferencias de columnas). No es "para siempre": si la pestaña queda abierta
 * un día entero, se vuelve a pedir.
 */
export const MAX_AGE_SESION = 24 * 60 * 60 * 1000

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
 * Sin `max_age_ms` (o con 0) no hay ventana de frescura: queda solo la deduplicación de lo
 * simultáneo, que es lo que quieren los badges del Nav.
 *
 * 🔴 `force` es para el que necesita el dato de VERDAD al día: un socket que acaba de recibir un
 * evento, o un «marcar leído» que acaba de cambiar el número. Esos no pueden engancharse a la
 * promesa en vuelo, porque ese GET pudo salir ANTES del evento que motivó la llamada — se
 * engancharían a una respuesta que todavía no lo cuenta. Con `force` sale un pedido nuevo aunque
 * haya otro en el aire, y ese pedido nuevo pasa a ser el que ven los que lleguen después.
 *
 * Un rechazo limpia la entrada: un error nunca queda cacheado. Y una respuesta vieja nunca pisa a
 * una nueva: solo escribe en la entrada la promesa que sigue siendo la vigente.
 *
 * 🔴 `run` recibe un `sigue_vigente()` y el que ESCRIBE en un store tiene que consultarlo antes
 * de escribir. Sin eso, `force` queda a medias: el pedido nuevo sale y deja el número al día, pero
 * si el pedido viejo vuelve después —tenía una respuesta ya en camino con el número de antes—
 * pisa al nuevo y el badge termina atrasado igual. Medido: da exactamente eso. `sigue_vigente()`
 * es false para toda promesa que ya fue reemplazada o que ya terminó.
 *
 * 🔴 Para que todo esto sirva, `run` tiene que RECHAZAR si el pedido falló. Si se le pasa un
 * runner que se traga el error y resuelve igual, acá se ve una resolución exitosa y se le abre
 * ventana de frescura a un pedido que nunca trajo nada.
 *
 * @param {string} key Clave de deduplicación (ej. `meta:lead`).
 * @param {function(function(): boolean): Promise} run Qué hacer cuando efectivamente hay que
 *   pedir. Recibe `sigue_vigente()`; los runners que solo devuelven un valor pueden ignorarlo.
 * @param {Object} [options]
 * @param {number} [options.max_age_ms] Ventana de frescura; sin ella siempre se vuelve a pedir.
 * @param {boolean} [options.force] Pide de nuevo aunque haya uno en vuelo y aunque haya ventana.
 * @returns {Promise}
 */
export function run_once(key, run, options) {
  const opts = options || {}
  const entry = entry_for(key)
  const forzado = opts.force === true

  if (!forzado) {
    if (entry.promise) {
      return entry.promise
    }

    const max_age = parseInt(opts.max_age_ms, 10)
    const es_fresco =
      !isNaN(max_age) && max_age > 0 && entry.has_value && Date.now() - entry.resolved_at < max_age
    if (es_fresco) {
      return Promise.resolve(entry.value)
    }
  }

  /* En una caja y no en una variable suelta para que el runner pueda llamar a `sigue_vigente()`
     apenas lo reciba, sin toparse con la zona muerta del `const` de abajo. */
  const vigencia = { promesa: null }

  /**
   * ¿Esta corrida sigue siendo la que manda para esta clave?
   *
   * @returns {boolean} false si un `force` la reemplazó, o si ya terminó.
   */
  function sigue_vigente() {
    return vigencia.promesa !== null && entry.promise === vigencia.promesa
  }

  const promesa = run(sigue_vigente)
    .then(function (value) {
      /* Solo la promesa vigente escribe: si un `force` la reemplazó mientras tanto, esta
         respuesta es la vieja y no tiene que pisar a la nueva. */
      if (sigue_vigente()) {
        entry.promise = null
        entry.resolved_at = Date.now()
        entry.has_value = true
        entry.value = value
      }
      return value
    })
    .catch(function (err) {
      if (sigue_vigente()) {
        entry.promise = null
        entry.resolved_at = 0
        entry.has_value = false
        entry.value = null
      }
      throw err
    })

  vigencia.promesa = promesa
  entry.promise = promesa
  return promesa
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
 * `force` es para el lado que **escribe** ese dato: una pantalla de edición no puede mostrar un
 * valor cacheado y guardar encima de lo que otro operador cambió mientras tanto. Con `force` sale
 * un pedido propio —aunque haya otro en vuelo, que pudo salir antes del último guardado— y de
 * paso se deja el caché al día para los que solo leen.
 *
 * @param {string} path Ruta relativa al baseURL de axios (ej. `/settings/lead-demo`).
 * @param {Object} [options]
 * @param {number} [options.max_age_ms] Ventana de frescura.
 * @param {boolean} [options.force] Ignora la ventana y lo que haya en vuelo, y vuelve a pedir.
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
    { max_age_ms: opts.max_age_ms, force: opts.force === true }
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
