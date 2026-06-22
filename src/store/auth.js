/**
 * Sesión admin: token Sanctum + perfil mínimo persistido en localStorage.
 */
import api from '@/utils/axios'
import { log_debug } from '@/utils/logger'

/** Clave localStorage del Bearer token Sanctum. */
const ADMIN_TOKEN_STORAGE_KEY = 'admin_token'

/** Clave localStorage del perfil mínimo del admin (cache offline / F5). */
const ADMIN_PROFILE_STORAGE_KEY = 'admin_profile'

const state = {
  admin: null,
  token: null,
  loading: false,
  /** false hasta validar token en storage y resolver /me si corresponde. */
  session_ready: false,
}

/** Promesa compartida para no ejecutar bootstrap en paralelo (main + guard). */
let bootstrap_promise = null

/**
 * Parsea el perfil admin guardado en localStorage.
 *
 * @returns {Object|null}
 */
function read_admin_profile_from_storage() {
  const raw_admin_profile = window.localStorage.getItem(ADMIN_PROFILE_STORAGE_KEY)
  if (!raw_admin_profile) {
    return null
  }
  try {
    const parsed_admin_profile = JSON.parse(raw_admin_profile)
    if (!parsed_admin_profile || typeof parsed_admin_profile !== 'object') {
      return null
    }
    return parsed_admin_profile
  } catch (parse_error) {
    log_debug(parse_error)
    window.localStorage.removeItem(ADMIN_PROFILE_STORAGE_KEY)
    return null
  }
}

const mutations = {
  /**
   * Persiste el perfil mínimo del admin en memoria y localStorage.
   *
   * @param {Object} s  State del módulo auth.
   * @param {Object|null} v  Perfil admin o null al cerrar sesión.
   */
  set_admin(s, v) {
    s.admin = v
    if (v) {
      window.localStorage.setItem(ADMIN_PROFILE_STORAGE_KEY, JSON.stringify(v))
      return
    }
    window.localStorage.removeItem(ADMIN_PROFILE_STORAGE_KEY)
  },
  /**
   * Persiste el token Bearer; al limpiarlo también borra el perfil cacheado.
   *
   * @param {Object} s  State del módulo auth.
   * @param {string|null} v  Token Sanctum o null.
   */
  set_token(s, v) {
    s.token = v
    if (v) {
      window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, v)
      return
    }
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY)
    s.admin = null
    window.localStorage.removeItem(ADMIN_PROFILE_STORAGE_KEY)
  },
  set_loading(s, v) {
    s.loading = v
  },
  set_session_ready(s, v) {
    s.session_ready = !!v
  },
}

const actions = {
  /**
   * Restaura token y perfil admin desde localStorage (sin validar aún con /me).
   */
  init_from_storage({ commit }) {
    const stored_token = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)
    if (stored_token) {
      commit('set_token', stored_token)
    }
    const cached_admin_profile = read_admin_profile_from_storage()
    if (cached_admin_profile) {
      commit('set_admin', cached_admin_profile)
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
        return dispatch('me').catch(function (err) {
          // me() ya limpia token y perfil en 401; aquí solo toleramos fallas transitorias.
          const status = err && err.response ? err.response.status : null
          if (status === 401) {
            return null
          }
          if (state.token) {
            return state.admin || { id: null }
          }
          return null
        })
      })
      .then(function () {
        if (!state.token) {
          return null
        }
        return dispatch('version/load_select_catalog', null, { root: true })
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
  /**
   * true si hay token activo. Tras bootstrap, basta el token (perfil puede venir de cache).
   * Durante bootstrap previo a session_ready, exige también perfil para evitar flashes.
   */
  authenticated: (s) => {
    if (!s.token) {
      return false
    }
    if (s.admin) {
      return true
    }
    return s.session_ready
  },
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters,
}
