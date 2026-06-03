/**
 * Caché de meta/{model} (properties[]) para armar tablas y formularios.
 */
import api from '@/utils/axios'
import { log_debug } from '@/utils/logger'

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
  fetch_meta({ commit }, model_name) {
    return api
      .get('/meta/' + model_name)
      .then((res) => {
        commit('set_meta', { key: model_name, payload: res.data })
        return res.data
      })
      .catch((err) => {
        log_debug(err)
        throw err
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
