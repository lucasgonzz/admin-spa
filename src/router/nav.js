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
 * Indica si el perfil admin autenticado es vendedor (misión ventas-y-comisiones, 28/10/2026): es
 * lo que muestra "Mis comisiones" en el menú.
 *
 * Lee `admin.es_vendedor`. Si el perfil no trae la clave (`undefined`: un perfil cacheado en
 * localStorage desde antes de esta misión, o un `/me` que todavía no la devuelve) se cae a
 * `is_closer`, porque el comando de migración `ventas:migrar-licencias` marca como vendedores
 * justamente a los closers (Tomás). Apenas la clave llega, manda ella: un `false` explícito
 * esconde el ítem aunque el admin sea closer.
 *
 * @param {Object|null|undefined} admin Perfil desde auth.admin.
 * @returns {boolean}
 */
function admin_es_vendedor(admin) {
  if (!admin) {
    return false
  }
  if (admin.es_vendedor === undefined || admin.es_vendedor === null) {
    return !!admin.is_closer
  }
  return !!admin.es_vendedor
}

/**
 * Rutas visibles en la barra de navegación lateral (meta.nav === true).
 *
 * Las que tienen `meta.solo_vendedor` (hoy, "Mis comisiones") se muestran solo si el admin es
 * vendedor (`admin_es_vendedor`).
 *
 * @param {Object|null|undefined} admin Perfil admin autenticado.
 * @returns {Array<object>}
 */
export function get_nav_routes(admin) {
  return routes_def.filter(function (r) {
    if (!r.meta || !r.meta.nav) {
      return false
    }
    if (r.meta.solo_vendedor && !admin_es_vendedor(admin)) {
      return false
    }
    return true
  })
}

/**
 * Nombre de la ruta de entrada del closer: el Tablero de pipelines.
 *
 * ⚠️ `pipelines_tablero` tiene `meta.nav: false` y es HIJO de `/pipelines`, así que NO aparece en
 * lo que devuelve `get_nav_routes()` (que filtra por `meta.nav` sobre el nivel de arriba de
 * `routes_def`). Por eso se busca recorriendo también los `children`, con
 * `find_route_def_by_name()`, y no sobre la lista del menú.
 */
const CLOSER_ENTRY_ROUTE_NAME = 'pipelines_tablero'

/**
 * Slug del pipeline al que entra el closer, como query `?pipeline=`.
 *
 * El slug `lead` lo construye la misión M3 (`pipelines-para-el-closer`), que corre en paralelo:
 * hasta que exista, `Tablero.vue` resuelve con `pipeline_by_id`, que hace `Number('lead')` → `NaN`,
 * no matchea ningún pipeline y cae solo al último usado y después al primer pipeline activo. Esa
 * caída ya está escrita y M2 no la toca.
 */
const CLOSER_ENTRY_PIPELINE_SLUG = 'lead'

/**
 * Busca una definición de ruta por nombre en `routes_def`, incluidos los hijos.
 *
 * @param {string} name Nombre de la ruta buscada.
 * @returns {object|null} Definición de ruta, o null si no existe.
 */
function find_route_def_by_name(name) {
  let encontrada = null
  routes_def.forEach(function (r) {
    if (encontrada) {
      return
    }
    if (r.name === name) {
      encontrada = r
      return
    }
    if (!Array.isArray(r.children)) {
      return
    }
    r.children.forEach(function (child) {
      if (!encontrada && child.name === name) {
        encontrada = child
      }
    })
  })
  return encontrada
}

/**
 * Ruta de entrada según el perfil: destino por defecto tras login o bootstrap autenticado.
 * Los closers aterrizan en el Tablero de pipelines; el resto en el primer ítem del menú lateral,
 * que desde la misión inicio-y-entrada-por-rol (13/10/2026) es el panel de inicio (`/inicio`).
 *
 * Acá vive la decisión por rol. Para empujar al router usá `get_first_nav_location()`, que es la
 * que además arma la query que el closer necesita.
 *
 * @param {Object|null|undefined} admin Perfil admin autenticado.
 * @returns {object|null} Definición de ruta con name y path, o null si no hay ítems de nav.
 */
export function get_first_nav_route(admin) {
  const nav_routes = get_nav_routes(admin)
  if (!nav_routes.length) {
    return null
  }

  /* Closers: el Tablero de pipelines, que es donde trabajan el embudo comercial. */
  if (admin_is_closer(admin)) {
    const closer_entry_route = find_route_def_by_name(CLOSER_ENTRY_ROUTE_NAME)
    if (closer_entry_route) {
      return closer_entry_route
    }
  }

  /* Resto de admins: el primer ítem del menú lateral (hoy, el panel de inicio). */
  return nav_routes[0]
}

/**
 * Destino de entrada listo para `$router.push` / `next()`: incluye la query cuando el rol la
 * necesita.
 *
 * Existe aparte de `get_first_nav_route()` porque los dos llamadores (el guard y el post-login)
 * armaban `{ name }` a mano y el `?pipeline=lead` del closer se habría perdido en el camino.
 *
 * @param {Object|null|undefined} admin Perfil admin autenticado.
 * @returns {{ name: string, query?: Object }|null} Ubicación para el router, o null si no hay ítems de nav.
 */
export function get_first_nav_location(admin) {
  const route_def = get_first_nav_route(admin)
  if (!route_def || !route_def.name) {
    return null
  }
  if (route_def.name === CLOSER_ENTRY_ROUTE_NAME) {
    return { name: route_def.name, query: { pipeline: CLOSER_ENTRY_PIPELINE_SLUG } }
  }
  return { name: route_def.name }
}
