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
}

const mutations = {
  set_message(s, v) {
    s.message = v
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
