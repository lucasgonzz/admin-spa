/**
 * Lógica pura del perfil «Sólo Leads» (misión embudo-whatsapp-precios, E5).
 *
 * Un admin con `solo_leads = true` (Usuarios admin → tilde «Sólo Leads») ve del admin únicamente Leads
 * (lista, conversación en sólo lectura y ficha con estado y nota), el tablero del embudo de leads en
 * Pipelines (misión embudo-juan-pipeline, E1: ahí Juan registra sus llamadas) y Cuenta (sólo «Instalar
 * aplicación» y «Notificaciones push»). El backend lo hace cumplir con un 403 (`code = 'solo_leads'`); acá se decide lo
 * que el SPA muestra para que ese 403 no llegue a verse.
 *
 * Esta es la ÚNICA fuente de esa decisión en el SPA: el menú, el guard, Cuenta, el aviso de tareas, el
 * interceptor de axios y las pantallas de Leads sólo la LLAMAN, no la repiten.
 *
 * Es JavaScript sin imports a propósito: `pruebas/solo-leads.cjs` lo lee tal cual y lo ejecuta en Node,
 * así que no puede depender de Vue, de vue-router ni de axios.
 */

/**
 * Nombres de las únicas rutas del router que puede abrir el perfil. `lead_conversation` es la
 * conversación a pantalla completa (/leads/:lead_id/conversacion).
 *
 * @type {string[]}
 */
export const RUTAS_SOLO_LEADS = ['leads', 'lead_conversation', 'account']

/**
 * Nombres de las rutas del Tablero de pipelines que también puede abrir el perfil (misión
 * embudo-juan-pipeline, E1): `pipelines` es el padre del menú (redirige al tablero) y
 * `pipelines_tablero` es el tablero del embudo de leads, donde Juan registra sus llamadas.
 *
 * Va en una lista APARTE de `RUTAS_SOLO_LEADS` a propósito: esa lista la fija
 * `pruebas/solo-leads.cjs` (y el backend, `AdminSoloLeadsPolicy::RUTAS_PERMITIDAS`, tiene su gemela
 * con un test que la compara). `pipelines_configuracion` y `pipelines_agenda` quedan afuera: el
 * backend responde 403 a la configuración de pipelines y a la agenda.
 *
 * @type {string[]}
 */
export const RUTAS_DEL_TABLERO_SOLO_LEADS = ['pipelines', 'pipelines_tablero']

/**
 * Ids de las secciones de Cuenta que ve el perfil: instalar la app y recibir las notificaciones push.
 * «Preferencias» queda afuera porque escribe `PUT me` con roles globales (soporte y tareas).
 *
 * @type {string[]}
 */
export const SECCIONES_DE_CUENTA_SOLO_LEADS = ['pwa-install', 'push-notifications']

/**
 * Indica si el admin tiene el perfil restringido a Leads.
 *
 * Una clave ausente (`undefined`: un perfil cacheado antes de esta misión, o un `/me` de una API que
 * todavía no la devuelve) cuenta como false: el admin no cambia en nada.
 *
 * @param {Object|null|undefined} admin Perfil desde `auth.admin`.
 * @returns {boolean}
 */
export function es_solo_leads(admin) {
  return !!(admin && admin.solo_leads)
}

/**
 * Indica si el perfil puede abrir la ruta con ese nombre.
 *
 * @param {string|null|undefined} nombre Nombre de la ruta de vue-router (puede faltar en una ruta sin nombre).
 * @returns {boolean}
 */
export function ruta_permitida(nombre) {
  return !!nombre && (
    RUTAS_SOLO_LEADS.indexOf(nombre) !== -1 || RUTAS_DEL_TABLERO_SOLO_LEADS.indexOf(nombre) !== -1
  )
}

/**
 * Ubicación del tablero del embudo de leads (el pipeline con slug `lead`), que es lo único de
 * Pipelines que ve el perfil. La usa el menú lateral para llevar el ítem «Pipelines» directo ahí.
 *
 * @returns {{name: string, query: {pipeline: string}}}
 */
export function ruta_de_entrada_al_tablero() {
  return { name: 'pipelines_tablero', query: { pipeline: 'lead' } }
}

/**
 * Secciones de Cuenta que ve el admin. Un admin normal las ve todas, sin cambios y en el mismo orden.
 *
 * @param {Object|null|undefined} admin Perfil desde `auth.admin`.
 * @param {Array<{id: string}>} secciones Definición completa de las secciones (ACCOUNT_SECTIONS).
 * @returns {Array<{id: string}>}
 */
export function secciones_de_cuenta(admin, secciones) {
  if (!es_solo_leads(admin)) {
    return secciones
  }
  return secciones.filter(function (seccion) {
    return SECCIONES_DE_CUENTA_SOLO_LEADS.indexOf(seccion.id) !== -1
  })
}

/**
 * Id de la sección de Cuenta que se abre cuando la URL no trae hash válido.
 *
 * @param {Object|null|undefined} admin Perfil desde `auth.admin`.
 * @returns {string} `push-notifications` para el perfil; `preferences` (el de siempre) para el resto.
 */
export function seccion_de_cuenta_por_defecto(admin) {
  return es_solo_leads(admin) ? 'push-notifications' : 'preferences'
}

/**
 * A dónde lleva el clic en un aviso de tarea.
 *
 * El perfil no ve Tareas: si la tarea trae un lead (las del embudo), abre la conversación de ese lead.
 *
 * @param {Object|null|undefined} notificacion Aviso de `task-notification/pending` (trae `task`).
 * @param {Object|null|undefined} admin Perfil desde `auth.admin`.
 * @returns {{name: string, params: {lead_id: number}}|null} Ubicación para el router, o null si el aviso
 *   sigue su camino de siempre (/tareas).
 */
export function destino_del_aviso(notificacion, admin) {
  if (!es_solo_leads(admin)) {
    return null
  }
  const tarea = notificacion && notificacion.task ? notificacion.task : null
  if (!tarea || !tarea.lead_id) {
    return null
  }
  return { name: 'lead_conversation', params: { lead_id: tarea.lead_id } }
}

/**
 * Ubicación a la que el guard manda al perfil cuando intenta abrir una ruta que no le corresponde.
 *
 * @param {Object|null|undefined} admin Perfil desde `auth.admin`.
 * @param {string|null|undefined} nombre_de_ruta Nombre de la ruta destino.
 * @returns {{name: string}|null} `{name: 'leads'}`, o null si no hay que redirigir (admin normal o ruta permitida).
 */
export function redireccion_solo_leads(admin, nombre_de_ruta) {
  if (!es_solo_leads(admin) || ruta_permitida(nombre_de_ruta)) {
    return null
  }
  return { name: 'leads' }
}

/**
 * Indica si un error de axios es el 403 de fondo del perfil (`code = 'solo_leads'`): un pedido que el
 * backend le niega, como los badges de soporte de la barra lateral. No es un problema del operador y el
 * interceptor no lo muestra como aviso.
 *
 * @param {Object|null|undefined} error Error de axios.
 * @returns {boolean}
 */
export function es_error_solo_leads(error) {
  const respuesta = error && error.response ? error.response : null
  if (!respuesta || respuesta.status !== 403) {
    return false
  }
  return !!(respuesta.data && respuesta.data.code === 'solo_leads')
}
