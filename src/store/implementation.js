import api from '@/utils/axios'

/**
 * Módulo Vuex para el estado global de implementaciones.
 *
 * Responsabilidad: mantener el conteo de implementaciones que completaron su
 * conversación automática y están esperando que el admin presione "Avanzar etapa".
 * El badge del Nav consume este conteo en tiempo real (Pusher + fetch inicial).
 */
export default {
  namespaced: true,

  state: {
    /**
     * Cantidad de implementaciones `in_progress` cuya etapa actual tiene status
     * 'completed' y están esperando avance manual del admin.
     * Alimenta el badge del ítem "Implementaciones" en el Nav.
     */
    ready_to_advance_count: 0,
  },

  mutations: {
    /**
     * Establece el conteo directamente (usado tras GET inicial o recarga).
     *
     * @param {Object} state Estado del módulo.
     * @param {number} count Valor entero devuelto por el backend.
     */
    set_ready_to_advance_count(state, count) {
      /* Parsear a entero y proteger contra valores no numéricos. */
      const n = parseInt(count, 10)
      state.ready_to_advance_count = isNaN(n) ? 0 : n
    },

    /**
     * Incrementa en 1 el contador (evento Pusher: implementación completó etapa).
     *
     * @param {Object} state Estado del módulo.
     */
    increment_ready_to_advance_count(state) {
      state.ready_to_advance_count += 1
    },

    /**
     * Decrementa en 1 el contador, sin bajar de cero.
     * Se llama cuando el admin presiona "Avanzar etapa" con éxito.
     *
     * @param {Object} state Estado del módulo.
     */
    decrement_ready_to_advance_count(state) {
      /* Garantizar que el conteo no quede en negativo. */
      if (state.ready_to_advance_count > 0) {
        state.ready_to_advance_count -= 1
      }
    },
  },

  actions: {
    /**
     * Consulta al backend cuántas implementaciones están listas para avanzar.
     * Hace GET /implementation/ready-to-advance-count y aplica el resultado al state.
     *
     * @param {Object} context Contexto del módulo Vuex con commit.
     * @returns {Promise<void>}
     */
    fetch_ready_to_advance_count({ commit }) {
      return api.get('/implementation/ready-to-advance-count').then(function (res) {
        if (res.data && res.data.count != null) {
          commit('set_ready_to_advance_count', res.data.count)
        }
      })
    },
  },
}
