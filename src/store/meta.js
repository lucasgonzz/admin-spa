/**
 * Caché de meta/{model} (properties[]) para armar tablas y formularios.
 */
import api from '@/utils/axios'
import { log_debug } from '@/utils/logger'
import { run_once } from '@/common-vue/helpers/request_cache_helper'

const state = {
  /** @type {Object<string, { properties: Array, model_name: string }>} */
  cache: {},
}

const mutations = {
  set_meta(s, { key, payload }) {
    s.cache[key] = payload
  },
}

const actions = {
  /**
   * Devuelve el meta de un modelo. Lo pide una sola vez por sesión: el payload sale de
   * `app/ModelProperties/*.php` del backend, que es estático mientras la pestaña esté abierta.
   *
   * Hasta acá el `cache` del state se escribía pero no se leía nunca, así que cada ResourceView
   * (y cada HasMany, y el panel del closer) rebajaba el mismo meta al montarse. Ahora:
   *   - si ya está en el state, se devuelve de ahí sin tocar la red;
   *   - si hay un pedido en vuelo para ese mismo modelo, los dos llamadores comparten la promesa.
   *
   * @param {Object} context Contexto del módulo Vuex.
   * @param {string} model_name Nombre del modelo (ej. `lead`).
   * @returns {Promise<{ properties: Array, model_name: string }>}
   */
  fetch_meta({ commit, state }, model_name) {
    const cached = state.cache[model_name]
    if (cached) {
      return Promise.resolve(cached)
    }
    return run_once('meta:' + model_name, function () {
      return api
        .get('/meta/' + model_name)
        .then(function (res) {
          commit('set_meta', { key: model_name, payload: res.data })
          return res.data
        })
        .catch(function (err) {
          log_debug(err)
          throw err
        })
    })
  },
}

const getters = {
  /**
   * @returns {function(string): Array}
   */
  properties: (state) => (model_name) => {
    const row = state.cache[model_name]
    return (row && row.properties) ? row.properties : []
  },
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters,
}
