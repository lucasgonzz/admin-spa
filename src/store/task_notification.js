/**
 * Módulo Vuex para las notificaciones in-app de tareas asignadas al admin autenticado
 * (tabla `admin_task_notifications` en admin-api).
 *
 * No es un CRUD REST estándar (no representa una lista paginada de un recurso, sino
 * la bandeja de avisos pendientes del admin logueado), por eso se escribe como módulo
 * Vuex plano en vez de usar `__base_store` (que asume el patrón index/store/update/delete
 * genérico de un recurso).
 */
import api from '@/utils/axios'

export default {
  namespaced: true,

  state() {
    return {
      /** Notificaciones pendientes (no vistas) del admin autenticado, más reciente primero. */
      models: [],
      /** true mientras se pide GET /task-notification/pending. */
      loading: false,
    }
  },

  mutations: {
    /**
     * Reemplaza la lista completa de notificaciones pendientes.
     *
     * @param {Object} state
     * @param {Array}  value  Lista de notificaciones (respuesta de /task-notification/pending).
     */
    set_models(state, value) {
      state.models = value || []
    },
    /**
     * Inserta una notificación al principio de la lista, ignorando duplicados por id.
     * El mismo aviso puede llegar dos veces: una por el fetch inicial (al montar) y otra
     * por el evento de websocket si llega justo en ese momento.
     *
     * @param {Object} state
     * @param {Object} model  Notificación a insertar ({ id, task, ... }).
     */
    add_model(state, model) {
      if (!model || model.id == null) {
        return
      }
      const already_exists = state.models.some(function (m) { return m.id == model.id })
      if (already_exists) {
        return
      }
      state.models = [model].concat(state.models)
    },
    /**
     * Quita una notificación puntual de la lista por id.
     *
     * @param {Object}         state
     * @param {number|string}  id
     */
    remove_model(state, id) {
      state.models = state.models.filter(function (m) { return m.id != id })
    },
    /**
     * Vacía la lista completa (todas las pendientes quedaron vistas).
     *
     * @param {Object} state
     */
    clear_models(state) {
      state.models = []
    },
    /**
     * Activa o desactiva el indicador de carga.
     *
     * @param {Object}  state
     * @param {boolean} value
     */
    set_loading(state, value) {
      state.loading = !!value
    },
  },

  actions: {
    /**
     * Carga las notificaciones pendientes (no vistas) del admin autenticado.
     * Se dispara al montar el componente global (cubre el caso "quedaron sin ver
     * mientras la sesión estaba cerrada").
     *
     * @param {Object} context  Contexto Vuex ({ commit }).
     * @returns {Promise}
     */
    fetch_pending({ commit }) {
      commit('set_loading', true)
      return api
        .get('/task-notification/pending')
        .then(function (res) {
          commit('set_models', res.data.models || [])
          commit('set_loading', false)
        })
        .catch(function (err) {
          commit('set_loading', false)
          throw err
        })
    },

    /**
     * Marca una notificación puntual como vista vía POST /task-notification/{id}/seen.
     * Optimista: se saca del state antes de esperar la respuesta para que la interfaz
     * reaccione al instante; si la request falla, se reinserta para no perderla.
     *
     * @param {Object}        context  Contexto Vuex ({ commit, state }).
     * @param {number|string} id       Id de la notificación.
     * @returns {Promise}
     */
    mark_seen({ commit, state }, id) {
      /** Copia de la notificación por si hay que reinsertarla ante un error de red. */
      const existing = state.models.find(function (m) { return m.id == id })
      commit('remove_model', id)
      return api
        .post('/task-notification/' + id + '/seen')
        .catch(function (err) {
          if (existing) {
            commit('add_model', existing)
          }
          throw err
        })
    },

    /**
     * Marca todas las notificaciones pendientes como vistas vía POST
     * /task-notification/seen-all y vacía el state. Optimista, con el mismo criterio
     * de reversión que `mark_seen` si la request falla.
     *
     * @param {Object} context  Contexto Vuex ({ commit, state }).
     * @returns {Promise}
     */
    mark_all_seen({ commit, state }) {
      /** Copia de la lista previa por si hay que restaurarla ante un error de red. */
      const previous_models = state.models.slice()
      commit('clear_models')
      return api
        .post('/task-notification/seen-all')
        .catch(function (err) {
          commit('set_models', previous_models)
          throw err
        })
    },
  },
}
