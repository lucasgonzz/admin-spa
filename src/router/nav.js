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
 *
 * @param {Object|null|undefined} admin Perfil admin autenticado (reservado para filtros futuros por perfil).
 * @returns {Array<object>}
 */
export function get_nav_routes(admin) {
  return routes_def.filter(function (r) {
    if (!r.meta || !r.meta.nav) {
      return false
    }
    return true
  })
}

/**
 * Primer ítem del menú lateral; destino por defecto tras login o bootstrap autenticado.
 * Closers aterrizan en el panel operativo; el resto en Leads (primer ítem distinto del panel).
 *
 * @param {Object|null|undefined} admin Perfil admin autenticado.
 * @returns {object|null} Definición de ruta con name y path, o null si no hay ítems de nav.
 */
export function get_first_nav_route(admin) {
  const nav_routes = get_nav_routes(admin)
  if (!nav_routes.length) {
    return null
  }

  /* Closers: destino por defecto el panel operativo si está en el menú. */
  if (admin_is_closer(admin)) {
    const closer_panel_route = nav_routes.find(function (r) {
      return r.name === 'closer-panel'
    })
    if (closer_panel_route) {
      return closer_panel_route
    }
  }

  /* Resto de admins: primer ítem del menú que no sea el panel del closer. */
  const default_route = nav_routes.find(function (r) {
    return r.name !== 'closer-panel'
  })
  return default_route || nav_routes[0]
}
