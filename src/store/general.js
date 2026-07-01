/**
 * Estado transversal mínimo (mensajes globales opcionales).
 */
const state = {
  message: '',
  /**
   * Contador por nombre de ruta para forzar remount de la vista activa
   * (p. ej. al pulsar de nuevo el mismo ítem del menú lateral).
   */
  route_reload_versions: {},
  /**
   * true mientras vue-router resuelve la navegación (carga de chunk lazy + cambio de vista).
   */
  route_navigating: false,
  /**
   * Path destino antes de que $route se actualice; alimenta highlight inmediato del menú lateral.
   */
  pending_nav_path: null,
}

const mutations = {
  set_message(s, v) {
    s.message = v
  },
  /**
   * Activa o desactiva el overlay de carga durante navegación entre rutas.
   *
   * @param {object} s state del módulo
   * @param {boolean} value
   */
  set_route_navigating(s, value) {
    s.route_navigating = Boolean(value)
  },
  /**
   * Guarda el path destino para feedback visual instantáneo en el menú.
   *
   * @param {object} s state del módulo
   * @param {string|null} path
   */
  set_pending_nav_path(s, path) {
    s.pending_nav_path = path ? String(path) : null
  },
  /**
   * Incrementa la versión de recarga de una ruta; App.vue usa esto como parte del :key de router-view.
   *
   * @param {object} s state del módulo
   * @param {string} route_name nombre de la ruta (router name)
   */
  bump_route_reload(s, route_name) {
    if (!route_name) {
      return
    }
    const current = s.route_reload_versions[route_name] || 0
    s.route_reload_versions = Object.assign({}, s.route_reload_versions, {
      [route_name]: current + 1,
    })
  },
}

/** Rutas cuyo componente raíz está en keep-alive y no puede remontarse por :key. */
const KEEP_ALIVE_ROUTE_NAMES = ['leads']

const actions = {
  /**
   * Fuerza recarga del módulo activo cuando el operador vuelve a pulsar el mismo ítem del menú.
   * - Rutas normales: incrementa route_reload_versions → App.vue cambia :key → remount + mounted.
   * - Leads (keep-alive): incrementa leads_reload_version → Leads.vue detecta y recarga en caliente.
   *
   * @param {{ commit: Function }} context
   * @param {string} route_name nombre de la ruta vue-router
   * @returns {void}
   */
  request_module_reload({ commit }, route_name) {
    if (!route_name) {
      return
    }

    if (KEEP_ALIVE_ROUTE_NAMES.indexOf(route_name) !== -1) {
      if (route_name === 'leads') {
        commit('lead/bump_leads_reload_version', null, { root: true })
      }
      commit('set_pending_nav_path', null)
      return
    }

    commit('set_route_navigating', true)
    commit('bump_route_reload', route_name)
  },
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
}
