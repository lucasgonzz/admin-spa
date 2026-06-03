import routes_def from './routes'

/**
 * Rutas visibles en la barra de navegación lateral (meta.nav === true).
 *
 * @returns {Array<object>}
 */
export function get_nav_routes() {
  return routes_def.filter(function (r) {
    return r.meta && r.meta.nav
  })
}

/**
 * Primer ítem del menú lateral; destino por defecto tras login o bootstrap autenticado.
 *
 * @returns {object|null} Definición de ruta con name y path, o null si no hay ítems de nav.
 */
export function get_first_nav_route() {
  const nav_routes = get_nav_routes()
  if (!nav_routes.length) {
    return null
  }
  return nav_routes[0]
}
