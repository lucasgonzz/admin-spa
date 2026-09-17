import api from '@/utils/axios'
import { run_once, MAX_AGE_BADGES } from '@/common-vue/helpers/request_cache_helper'

/**
 * Pide el conteo de implementaciones listas para avanzar y lo vuelca al store.
 *
 * Va por `run_once` con la clave del GET: dos llamadores en el mismo tick comparten la request.
 *
 * @param {Function} commit Committer del módulo.
 * @param {number} [max_age_ms] Si se pasa, no vuelve a pedir mientras el valor sea más nuevo.
 * @returns {Promise<void>}
 */
function pedir_ready_to_advance_count(commit, max_age_ms) {
  return run_once(
    'GET /implementation/ready-to-advance-count',
    function () {
      return api.get('/implementation/ready-to-advance-count').then(function (res) {
        if (res.data && res.data.count != null) {
          commit('set_ready_to_advance_count', res.data.count)
        }
      })
    },
    { max_age_ms: max_age_ms }
  )
}

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
      return pedir_ready_to_advance_count(commit)
    },

    /**
     * Igual que `fetch_ready_to_advance_count`, pero no vuelve a pedir si el conteo se trajo hace
     * menos de medio minuto. Lo usa el Nav, que se desmonta y se remonta al entrar y salir de la
     * conversación de un lead (ver el comentario largo en `lead.js`).
     *
     * @param {Object} context Contexto del módulo Vuex con commit.
     * @returns {Promise<void>}
     */
    ensure_ready_to_advance_count_fresh({ commit }) {
      return pedir_ready_to_advance_count(commit, MAX_AGE_BADGES)
    },
  },
}
