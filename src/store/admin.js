/**
 * Lista de operadores del equipo (`GET /admin`), la que alimenta todos los selectores de
 * asignación del panel.
 *
 * Por qué existe este módulo: la misma lista se pedía desde tres lugares con tres cachés
 * distintas — `task/fetch_admins`, `task_template/fetch_admins` y el `load_admins()` de
 * ImplementationSettingsSection, que no cacheaba nada. Entrar a /tareas, abrir las plantillas de
 * tareas y abrir la configuración de implementaciones eran tres `GET /admin` idénticos, dos de
 * ellos en la misma pantalla (/cuenta). Acá hay uno solo y los otros dos módulos lo espejan para
 * no tocar a los componentes que leen `state.task.admins` o `state.task_template.admins`.
 */
import api from '@/utils/axios'
import {
  cached_get,
  invalidate_cached_get,
  MAX_AGE_SESION,
} from '@/common-vue/helpers/request_cache_helper'

/*
 * El ABM de operadores escribe en `/admin-user`, no en `/admin`, así que la invalidación por
 * ruta del helper no lo alcanza sola: se la declaramos acá. Sin esto, dar de alta un operador y
 * abrir un selector de asignación en la misma sesión mostraría la lista vieja.
 */
api.interceptors.response.use(function (response) {
  const config = response.config || {}
  const method = String(config.method || 'get').toLowerCase()
  const url = String(config.url || '').split('?')[0]
  const escribe_operadores = url === '/admin-user' || url.indexOf('/admin-user/') === 0
  if (method !== 'get' && method !== 'head' && escribe_operadores) {
    invalidate_cached_get('/admin')
  }
  return response
})

export default {
  namespaced: true,

  state: {
    /** @type {Array<Object>} Operadores disponibles para asignar tareas, tickets y demás. */
    admins: [],
    /** Indica si hay un pedido de la lista en curso. */
    loading: false,
  },

  mutations: {
    /**
     * Reemplaza la lista de operadores.
     *
     * @param {Object} state
     * @param {Array} value
     */
    set_admins(state, value) {
      state.admins = value || []
    },
    /**
     * Activa o desactiva el indicador de carga.
     *
     * @param {Object} state
     * @param {boolean} value
     */
    set_loading(state, value) {
      state.loading = !!value
    },
  },

  actions: {
    /**
     * Trae la lista de operadores, una sola vez por sesión. Nunca rechaza: si el GET falla deja
     * lo que había (o una lista vacía) y sigue.
     *
     * @param {Object} context Contexto del módulo Vuex.
     * @returns {Promise<Array<Object>>}
     */
    fetch_admins({ commit, state }) {
      commit('set_loading', true)
      return cached_get('/admin', { max_age_ms: MAX_AGE_SESION })
        .then(function (data) {
          /* El controller responde { admins: [...] } o { models: [...] } según la ruta. */
          const lista = (data && (data.admins || data.models)) || []
          commit('set_admins', lista.slice())
          commit('set_loading', false)
          return state.admins
        })
        .catch(function () {
          commit('set_loading', false)
          return state.admins
        })
    },
  },
}
