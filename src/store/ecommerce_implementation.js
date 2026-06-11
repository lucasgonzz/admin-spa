import api from '@/utils/axios'

/**
 * Estado global de las implementaciones de ecommerce.
 *
 * Mantiene el conteo de implementaciones de tienda online listas para avanzar de etapa,
 * usado para el badge del Nav. Sigue el mismo patrón que el módulo implementation.
 */
export default {
  namespaced: true,

  state: {
    // Cantidad de implementaciones de ecommerce listas para avanzar (badge del Nav).
    ready_to_advance_count: 0,
  },

  mutations: {
    /**
     * Setea el conteo de implementaciones listas para avanzar.
     *
     * @param {object} state Estado del módulo.
     * @param {number} count Nuevo conteo.
     */
    set_ready_to_advance_count(state, count) {
      const n = parseInt(count, 10)
      state.ready_to_advance_count = isNaN(n) ? 0 : n
    },
    /**
     * Incrementa el conteo en 1 (al completarse una etapa automáticamente).
     *
     * @param {object} state Estado del módulo.
     */
    increment_ready_to_advance_count(state) {
      state.ready_to_advance_count += 1
    },
    /**
     * Decrementa el conteo en 1 (al avanzar manualmente una etapa).
     *
     * @param {object} state Estado del módulo.
     */
    decrement_ready_to_advance_count(state) {
      if (state.ready_to_advance_count > 0) {
        state.ready_to_advance_count -= 1
      }
    },
  },

  actions: {
    /**
     * Consulta al backend el conteo inicial de implementaciones de ecommerce listas para avanzar.
     *
     * @param {object} context Contexto Vuex (commit).
     * @returns {Promise}
     */
    fetch_ready_to_advance_count({ commit }) {
      return api.get('/ecommerce-implementation/ready-to-advance-count').then(function (res) {
        if (res.data && res.data.count != null) {
          commit('set_ready_to_advance_count', res.data.count)
        }
      })
    },
  },
}
