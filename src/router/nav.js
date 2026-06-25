import routes_def from './routes'

/**
 * Indica si el perfil admin autenticado es closer operativo.
 *
 * @param {Object|null|undefined} admin Perfil desde auth.admin.
 * @returns {boolean}
 */
function admin_is_closer(admin) {
  return !!(admin && admin.is_closer)
}

/**
 * Rutas visibles en la barra de navegación lateral (meta.nav === true).
 * Oculta rutas closer_only cuando el admin no es closer.
 *
 * @param {Object|null|undefined} admin Perfil admin autenticado.
 * @returns {Array<object>}
 */
export function get_nav_routes(admin) {
  const is_closer = admin_is_closer(admin)
  return routes_def.filter(function (r) {
    if (!r.meta || !r.meta.nav) {
      return false
    }
    if (r.meta.closer_only && !is_closer) {
      return false
    }
    return true
  })
}

/**
 * Primer ítem del menú lateral; destino por defecto tras login o bootstrap autenticado.
 * Para closers, el panel operativo queda primero en routes.js.
 *
 * @param {Object|null|undefined} admin Perfil admin autenticado.
 * @returns {object|null} Definición de ruta con name y path, o null si no hay ítems de nav.
 */
export function get_first_nav_route(admin) {
  const nav_routes = get_nav_routes(admin)
  if (!nav_routes.length) {
    return null
  }
  return nav_routes[0]
}
