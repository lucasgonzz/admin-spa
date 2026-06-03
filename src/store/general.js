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

export default {
  namespaced: true,
  state,
  mutations,
}
