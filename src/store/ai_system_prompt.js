/**
 * System prompt de Claude editable desde el admin (`ai-system-prompt` en admin-api).
 */
import api from '@/utils/axios'
import { log_debug } from '@/utils/logger'

const state = {
  /** Registro activo devuelto por la API (id, contenido, descripcion, activa). */
  prompt: null,
  /** Carga inicial o guardado en curso. */
  loading: false,
  /** Indicador breve de éxito tras guardar. */
  guardado: false,
}

const mutations = {
  set_prompt(s, v) {
    s.prompt = v
  },
  set_loading(s, v) {
    s.loading = v
  },
  set_guardado(s, v) {
    s.guardado = v
  },
}

const actions = {
  /**
   * Obtiene el prompt activo desde GET /ai-system-prompt.
   *
   * @param {{ commit: Function }} context
   * @returns {Promise<Object|null>}
   */
  get_prompt({ commit }) {
    commit('set_loading', true)
    return api
      .get('/ai-system-prompt')
      .then((res) => {
        commit('set_prompt', res.data || null)
        commit('set_loading', false)
        return res.data
      })
      .catch((err) => {
        commit('set_loading', false)
        log_debug(err)
        throw err
      })
  },

  /**
   * Invalida la caché del protocolo de GitHub (POST /protocol/refresh-cache).
   *
   * @returns {Promise<Object>}
   */
  refresh_protocol_cache() {
    return api.post('/protocol/refresh-cache').then(function (res) {
      return res.data
    })
  },

  /**
   * Persiste el contenido del prompt vía PUT /ai-system-prompt.
   *
   * @param {{ commit: Function }} context
   * @param {{ contenido: string, descripcion?: string }} payload
   * @returns {Promise<Object>}
   */
  update_prompt({ commit }, { contenido, descripcion }) {
    commit('set_loading', true)
    const body = { contenido: contenido }
    if (descripcion != null) {
      body.descripcion = descripcion
    }
    return api
      .put('/ai-system-prompt', body)
      .then((res) => {
        commit('set_prompt', res.data)
        commit('set_loading', false)
        commit('set_guardado', true)
        return res.data
      })
      .catch((err) => {
        commit('set_loading', false)
        log_debug(err)
        throw err
      })
  },
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
}
