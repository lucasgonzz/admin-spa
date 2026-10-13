/**
 * Cliente HTTP de la página del centro de recursos hacia admin-api (contrato C2 del plan de la
 * misión centro-de-recursos-clientes).
 *
 * Por qué uno propio y no `src/utils/axios.js`: ese mete el token del ADMIN (`admin_token`) en
 * cada pedido y dispara los toasts del panel. La página no es el admin: la abre un cliente, en
 * otro dominio, con una sesión que no es de Sanctum (`recursos_sesiones`, §3.2 del plan).
 *
 * Por qué `fetch` y no axios: el progreso se manda también al cerrar la pestaña, y eso solo
 * llega con `fetch(..., { keepalive: true })`. Y la página queda más liviana sin axios.
 *
 * La base es la misma que usa `src/utils/axios_public.js`: `VITE_API_URL` sin el `/admin` del
 * final. En producción el deploy del admin compila con
 * `VITE_API_URL=https://api-admin.comerciocity.com/public/api/admin`, así que la página le pega a
 * `https://api-admin.comerciocity.com/public/api/recursos/...`.
 */

/** Clave de `localStorage` donde vive el token de la sesión del centro (§5.1 del plan). */
const CLAVE_SESION = 'cc-recursos-sesion'

/** Base de la API pública del admin, sin barra final (ej. `https://api-admin.../public/api`). */
export const BASE_API = (import.meta.env.VITE_API_URL || '/api/admin').replace(/\/admin\/?$/, '')

/**
 * Lee el token guardado. Cualquier falla de `localStorage` (ventana privada, sitio bloqueado)
 * se trata como "sin sesión": la página tiene que andar igual.
 *
 * @returns {string|null}
 */
function leer_token_guardado() {
  try {
    return window.localStorage.getItem(CLAVE_SESION) || null
  } catch (e) {
    return null
  }
}

/** Token de la sesión del centro en memoria (null = invitado). */
let token = leer_token_guardado()

/** Función que se llama cuando el servidor rechaza el token (401): la página pasa a invitado. */
let al_perder_la_sesion = null

/**
 * Error de un pedido a la API, con el status HTTP y el código que manda el backend
 * (`{error: 'pase_invalido'}` y compañía).
 */
export class ErrorApi extends Error {
  /**
   * @param {number} status Status HTTP (0 = no hubo respuesta: sin conexión o CORS).
   * @param {string|null} codigo Valor de `error` del cuerpo, si vino.
   * @param {string|null} mensaje Valor de `message` del cuerpo, si vino.
   */
  constructor(status, codigo, mensaje) {
    super(mensaje || codigo || ('Error ' + status))
    this.status = status
    this.codigo = codigo || null
  }
}

/**
 * Indica si hay un token de sesión del centro.
 *
 * @returns {boolean}
 */
export function hay_sesion() {
  return !!token
}

/**
 * Guarda el token de una sesión recién creada (por pase o por link personal).
 *
 * @param {string} nuevo_token
 * @returns {void}
 */
export function guardar_token(nuevo_token) {
  token = nuevo_token || null
  try {
    if (token) {
      window.localStorage.setItem(CLAVE_SESION, token)
    } else {
      window.localStorage.removeItem(CLAVE_SESION)
    }
  } catch (e) {
    /* Sin localStorage la sesión dura lo que dure la pestaña: no es un error para el usuario. */
  }
}

/**
 * Borra el token (salir, o el servidor lo rechazó).
 *
 * @returns {void}
 */
export function borrar_token() {
  guardar_token(null)
}

/**
 * Registra qué hacer cuando el servidor rechaza el token con 401.
 *
 * @param {Function} funcion
 * @returns {void}
 */
export function cuando_se_pierda_la_sesion(funcion) {
  al_perder_la_sesion = funcion
}

/**
 * Hace un pedido a `BASE_API/<ruta>` y devuelve el cuerpo JSON (o null si vino vacío).
 *
 * - Manda el Bearer del centro salvo con `opciones.sin_sesion` (las rutas públicas se piden sin
 *   él: un GET sin headers propios no dispara el preflight de CORS).
 * - Un 401 con token borra el token y avisa (la página sigue como invitada). Si era un GET, se
 *   reintenta una vez sin token: `recursos/videos/{codigo}` tiene sesión OPCIONAL y tiene que
 *   devolver el video igual.
 *
 * @param {string} metodo 'GET' | 'POST' | ...
 * @param {string} ruta Ruta relativa a la base, sin barra inicial (ej. 'recursos/catalogo').
 * @param {Object} [cuerpo] Cuerpo JSON, si lleva.
 * @param {{ sin_sesion?: boolean, keepalive?: boolean }} [opciones]
 * @returns {Promise<any>}
 */
export function pedir(metodo, ruta, cuerpo, opciones) {
  /** Opciones con valores por defecto. */
  const op = opciones || {}
  /** Token con el que sale ESTE pedido (para no borrar uno nuevo si el viejo vuelve con 401). */
  const token_usado = op.sin_sesion ? null : token
  /** Headers del pedido. */
  const headers = { Accept: 'application/json' }
  if (cuerpo !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (token_usado) {
    headers.Authorization = 'Bearer ' + token_usado
  }

  return fetch(BASE_API + '/' + ruta, {
    method: metodo,
    headers: headers,
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    keepalive: !!op.keepalive,
  })
    .catch(function () {
      /* Sin respuesta (sin conexión, CORS, DNS): status 0. */
      throw new ErrorApi(0, null, 'No se pudo conectar con ComercioCity.')
    })
    .then(function (respuesta) {
      return respuesta.text().then(function (texto) {
        /** Cuerpo parseado; null si vino vacío o no es JSON. */
        let datos = null
        try {
          datos = texto ? JSON.parse(texto) : null
        } catch (e) {
          datos = null
        }
        if (respuesta.ok) {
          return datos
        }
        if (respuesta.status === 401 && token_usado) {
          if (token_usado === token) {
            borrar_token()
            if (al_perder_la_sesion) {
              al_perder_la_sesion()
            }
          }
          if (metodo === 'GET') {
            return pedir(metodo, ruta, cuerpo, Object.assign({}, op, { sin_sesion: true }))
          }
        }
        throw new ErrorApi(
          respuesta.status,
          datos && typeof datos.error === 'string' ? datos.error : null,
          datos && typeof datos.message === 'string' ? datos.message : null
        )
      })
    })
}
