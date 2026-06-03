import __base_store, { api_resource_segment } from '@/common-vue/store/__base_store'
import api from '@/utils/axios'
import { log_debug } from '@/utils/logger'

/**
 * Entradas del protocolo de ventas (`protocol-entry` en admin-api).
 * Soporta filtro opcional por categoría y por `activa` vía query.
 */
export default __base_store({
  state: {
    model_name: 'protocol_entry',
    api_resource_path: 'protocol-entry',
    use_per_page: true,
    per_page: 100,
    /** Valor de filtro de categoría para el listado (query `categoria`). */
    protocol_categoria_filter: '',
    /**
     * Filtro por estado activo: '' = todas, '1' = activas, '0' = pendientes de revisión.
     * Por defecto pendientes para priorizar correcciones automáticas del setter.
     */
    protocol_activa_filter: '0',
  },
  mutations: {
    /**
     * @param {Object} state
     * @param {string} value categoría o cadena vacía para todas
     */
    set_protocol_categoria_filter(state, value) {
      state.protocol_categoria_filter = value ? String(value) : ''
    },
    /**
     * @param {Object} state
     * @param {string} value '' | '1' | '0'
     */
    set_protocol_activa_filter(state, value) {
      if (value === '1' || value === '0') {
        state.protocol_activa_filter = value
      } else {
        state.protocol_activa_filter = ''
      }
    },
  },
  actions: {
    /**
     * Listado con paginado y filtros `categoria` y `activa` opcionales.
     * @param {Object} context
     * @returns {Promise<void>}
     */
    _get_models(context) {
      const commit = context.commit
      const state = context.state
      commit('set_loading', true)
      const seg = api_resource_segment(state)
      const params = []
      if (state.use_per_page) {
        params.push('page=' + state.page)
        params.push('per_page=' + state.per_page)
      }
      if (state.protocol_categoria_filter) {
        params.push('categoria=' + encodeURIComponent(state.protocol_categoria_filter))
      }
      if (state.protocol_activa_filter === '1' || state.protocol_activa_filter === '0') {
        params.push('activa=' + state.protocol_activa_filter)
      }
      const query = params.length ? '?' + params.join('&') : ''
      return api
        .get('/' + seg + query)
        .then((res) => {
          const body = res.data
          const pack = body.models
          if (pack && pack.data) {
            commit('set_models', pack.data)
            commit('set_total_pages', pack.last_page || 1)
            commit('set_total_results', pack.total != null ? pack.total : pack.data.length)
          } else {
            commit('set_models', pack || [])
            commit('set_total_results', (pack && pack.length) || 0)
          }
          commit('set_loading', false)
        })
        .catch((err) => {
          commit('set_loading', false)
          log_debug(err)
        })
    },
    /**
     * Actualiza solo el flag `activa` de una entrada (toggle desde la tabla).
     * @param {Object} context
     * @param {{ id: number, activa: boolean }} payload
     * @returns {Promise<Object>} entrada actualizada
     */
    toggle_activa(context, payload) {
      const id = payload.id
      const activa = Boolean(payload.activa)
      return api.patch('/protocol-entry/' + id + '/toggle-activa', { activa: activa }).then((res) => {
        return res.data
      })
    },
  },
})
