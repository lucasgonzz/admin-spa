/**
 * Sesión admin: token Sanctum + perfil mínimo.
 */
import api from '@/utils/axios'
import { log_debug } from '@/utils/logger'

const state = {
  admin: null,
  token: null,
  loading: false,
  /** false hasta validar token en storage y resolver /me si corresponde. */
  session_ready: false,
}

/** Promesa compartida para no ejecutar bootstrap en paralelo (main + guard). */
let bootstrap_promise = null

const mutations = {
  set_admin(s, v) {
    s.admin = v
  },
  set_token(s, v) {
    s.token = v
    if (v) {
      window.localStorage.setItem('admin_token', v)
    } else {
      window.localStorage.removeItem('admin_token')
    }
  },
  set_loading(s, v) {
    s.loading = v
  },
  set_session_ready(s, v) {
    s.session_ready = !!v
  },
}

const actions = {
  init_from_storage({ commit }) {
    const t = window.localStorage.getItem('admin_token')
    if (t) {
      commit('set_token', t)
    }
  },
  /**
   * Arranque de sesión: lee token local y valida con /me antes de mostrar la app.
   * Idempotente; reutiliza la misma promesa si se invoca más de una vez.
   *
   * @returns {Promise<void>}
   */
  bootstrap({ commit, dispatch, state }) {
    if (state.session_ready) {
      return Promise.resolve()
    }
    if (bootstrap_promise) {
      return bootstrap_promise
    }
    bootstrap_promise = dispatch('init_from_storage')
      .then(function () {
        if (!state.token) {
          return null
        }
        return dispatch('me')
          .catch(function () {
            return null
          })
          .then(function (admin) {
            if (!admin) {
              return null
            }
            return dispatch('version/load_select_catalog', null, { root: true })
          })
      })
      .finally(function () {
        commit('set_session_ready', true)
      })
    return bootstrap_promise
  },
  login({ commit, dispatch }, { email, password }) {
    // Normalizar credenciales antes de enviarlas al backend.
    const normalized_email = ((email || '') + '').trim()
    const normalized_password = ((password || '') + '').trim()
    commit('set_loading', true)
    return api
      .post('/login', { email: normalized_email, password: normalized_password })
      .then((res) => {
        commit('set_token', res.data.token)
        commit('set_admin', res.data.admin)
        commit('set_loading', false)
        return dispatch('version/load_select_catalog', null, { root: true }).then(function () {
          return res.data
        })
      })
      .catch((err) => {
        commit('set_loading', false)
        log_debug(err)
        throw err
      })
  },
  logout({ commit, dispatch }) {
    return api
      .post('/logout')
      .then(() => {
        commit('set_token', null)
        commit('set_admin', null)
        dispatch('version/reset_select_catalog', null, { root: true })
      })
      .catch(() => {
        commit('set_token', null)
        commit('set_admin', null)
        dispatch('version/reset_select_catalog', null, { root: true })
      })
  },
  me({ commit }) {
    return api
      .get('/me')
      .then((res) => {
        commit('set_admin', res.data.admin)
        return res.data.admin
      })
      .catch((err) => {
        log_debug(err)
        // Solo limpiar la sesión si el servidor confirma explícitamente que el
        // token no es válido (401). Errores de red, timeouts o fallas del servidor
        // (5xx) no deben destruir el token — el usuario puede estar simplemente
        // sin conexión o el servidor puede tener un pico de carga puntual.
        const status = err && err.response ? err.response.status : null
        if (status === 401) {
          commit('set_token', null)
          commit('set_admin', null)
        }
        throw err
      })
  },
  /**
   * Persiste preferencias del perfil del admin autenticado.
   * Acepta is_default_support_owner y/o is_default_task_assignee.
   * Solo se envían los campos presentes en el payload.
   *
   * @param {Object} payload  Puede contener { is_default_support_owner, is_default_task_assignee }
   * @returns {Promise}
   */
  update_profile({ commit }, payload) {
    return api
      .put('/me', payload)
      .then((res) => {
        commit('set_admin', res.data.admin)
        return res.data.admin
      })
  },
}

const getters = {
  authenticated: (s) => !!s.token && !!s.admin,
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters,
}
