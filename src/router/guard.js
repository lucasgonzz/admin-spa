import { get_first_nav_route } from './nav'

/**
 * Destino por defecto autenticado: primer ítem del menú lateral.
 *
 * @returns {{ name: string }|null}
 */
function default_authenticated_target() {
  const first_nav_route = get_first_nav_route()
  if (!first_nav_route || !first_nav_route.name) {
    return null
  }
  return { name: first_nav_route.name }
}

/**
 * Lógica del guard una vez resuelto auth/bootstrap.
 *
 * @param {import('vue-router').RouteLocationNormalized} to
 * @param {import('vue-router').RouteLocationNormalized} from
 * @param {import('vue-router').NavigationGuardNext} next
 * @param {import('vuex').Store} store
 */
function resolve_navigation(to, from, next, store) {
  const authenticated_target = default_authenticated_target()

  /** Raíz sin ruta concreta: redirige según sesión. */
  if (to.path === '/') {
    if (store.getters['auth/authenticated'] && authenticated_target) {
      next(authenticated_target)
      return
    }
    next({ name: 'login' })
    return
  }

  if (to.meta && to.meta.guest) {
    if (store.getters['auth/authenticated'] && authenticated_target) {
      next(authenticated_target)
      return
    }
    next()
    return
  }

  if (to.meta && to.meta.requiresAuth) {
    if (!store.state.auth.token || !store.state.auth.admin) {
      next({ name: 'login', query: { redirect: to.fullPath } })
      return
    }
  }

  next()
}

/**
 * Marca navegación en curso para mostrar spinner y resaltar ítem del menú de inmediato.
 *
 * @param {import('vue-router').RouteLocationNormalized} to
 * @param {import('vue-router').RouteLocationNormalized} from
 * @param {import('vuex').Store} store
 */
function begin_route_navigation_feedback(to, from, store) {
  if (to.path === from.path && to.name === from.name) {
    return
  }
  store.commit('general/set_route_navigating', true)
  store.commit('general/set_pending_nav_path', to.path)
}

/**
 * Limpia feedback de navegación (éxito, error o cancelación).
 *
 * @param {import('vuex').Store} store
 */
function end_route_navigation_feedback(store) {
  store.commit('general/set_route_navigating', false)
  store.commit('general/set_pending_nav_path', null)
}

/**
 * Protege rutas autenticadas; espera bootstrap de sesión antes de navegar.
 * Registra feedback visual (spinner + menú) durante la resolución de rutas lazy.
 *
 * @param {import('vue-router').Router} router
 * @param {import('vuex').Store} store
 */
export function setup_guard(router, store) {
  router.beforeEach(function (to, from, next) {
    begin_route_navigation_feedback(to, from, store)

    if (store.state.auth.session_ready) {
      resolve_navigation(to, from, next, store)
      return
    }
    store.dispatch('auth/bootstrap').then(function () {
      resolve_navigation(to, from, next, store)
    })
  })

  router.afterEach(function () {
    end_route_navigation_feedback(store)
  })

  router.onError(function () {
    end_route_navigation_feedback(store)
  })
}
