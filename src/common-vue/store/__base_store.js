/**
 * Factory de módulo Vuex 4 para listados CRUD + filtros (patrón empresa-spa, mejorado).
 * Mutations en snake_case, sin require dinámico de models: el meta se resuelve vía store meta.
 */
import api from '@/utils/axios'
import { route_string } from '@/utils/route_string'
import { log_debug } from '@/utils/logger'
import moment from 'moment'

/**
 * Segmento de path HTTP del recurso en admin-api (p. ej. `protocol-entry`).
 * Si el state define `api_resource_path`, se usa en lugar de `route_string(model_name)`.
 *
 * @param {Object} state estado del módulo Vuex
 * @returns {string}
 */
export function api_resource_segment(state) {
  if (state.api_resource_path && String(state.api_resource_path).trim() !== '') {
    return String(state.api_resource_path).replace(/^\//, '')
  }
  return route_string(state.model_name)
}

/**
 * Activa o desactiva el overlay global durante búsquedas filtradas.
 *
 * @param {Function} commit committer Vuex del módulo de listado
 * @param {boolean} active true mientras la petición está en curso
 * @param {string} [message] texto visible en LogoLoading
 * @returns {void}
 */
export function set_global_filter_loading(commit, active, message) {
  if (active) {
    commit('auth/setLoading', true, { root: true })
    commit('auth/setMessage', message || 'Filtrando…', { root: true })
    return
  }
  commit('auth/setLoading', false, { root: true })
  commit('auth/setMessage', '', { root: true })
}

/**
 * @param {Object} options
 * @param {Object|Function} options.state
 * @param {Object} [options.mutations]
 * @param {Object} [options.actions]
 * @param {Object} [options.getters]
 * @param {Object} [options.modules]
 * @param {Object} [options.features]
 * @returns {import('vuex').Module}
 */
export default function __base_store(options = {}) {
  const custom_state = options.state
  const custom_mutations = options.mutations || {}
  const custom_actions = options.actions || {}
  const custom_getters = options.getters || {}
  const custom_modules = options.modules || {}

  function base_state() {
    const base = {
      model_name: '',
      route_prefix: '',

      from_dates: false,
      from_date: moment().format('YYYY-MM-DD'),
      until_date: '',

      is_selectable: false,
      use_per_page: true,
      page: 1,
      per_page: 100,
      total_pages: 1,
      total_results: 0,

      models: [],
      model: {},
      selected: [],

      filters: [],
      filtered: [],
      is_filtered: false,
      filter_page: 1,
      filter_per_page: 100,
      total_filter_pages: 1,
      total_filter_results: 0,
      loading_filtered: false,

      display: 'table',
      loading: false,
      props_to_show: [],
      /** Si no es vacío, reemplaza el segmento de URL del recurso (ej. protocol-entry vs protocol_entry). */
      api_resource_path: '',
    }

    let extra = {}
    if (typeof custom_state === 'function') {
      extra = custom_state() || {}
    } else if (custom_state && typeof custom_state === 'object') {
      extra = custom_state
    }
    return Object.assign({}, base, extra)
  }

  const base_mutations = {
    set_props_to_show(state, value) {
      state.props_to_show = value
    },
    set_loading(state, value) {
      state.loading = value
    },
    set_model(state, payload) {
      if (payload && payload.model) {
        state.model = { ...payload.model }
      } else {
        state.model = { id: null }
      }
    },
    set_models(state, value) {
      state.models = value ? value : []
    },
    set_page(state, value) {
      state.page = value
    },
    set_total_pages(state, value) {
      state.total_pages = value
    },
    set_total_results(state, value) {
      state.total_results = value
    },
    set_selected(state, value) {
      state.selected = value
    },
    add_selected(state, value) {
      const idx = state.selected.findIndex((m) => m.id == value.id)
      if (idx != -1) {
        state.selected.splice(idx, 1)
      } else {
        state.selected.push(value)
      }
    },
    set_is_selectable(state, value) {
      state.is_selectable = value
    },
    set_filters(state, value) {
      state.filters = value
    },
    add_filter(state, filter_to_add) {
      const idx = state.filters.findIndex((f) => f.key == filter_to_add.key)
      if (idx == -1) {
        state.filters.unshift(filter_to_add)
      } else {
        state.filters.splice(idx, 1, filter_to_add)
      }
    },
    remove_filter_by_key(state, key) {
      state.filters = state.filters.filter((f) => f.key != key)
    },
    set_is_filtered(state, value) {
      state.is_filtered = value
    },
    set_filtered(state, value) {
      state.filtered = value
    },
    set_filter_page(state, value) {
      state.filter_page = value
    },
    set_filter_per_page(state, value) {
      let n = parseInt(value, 10)
      if (isNaN(n) || n < 1) n = 20
      if (n > 200) n = 200
      state.filter_per_page = n
    },
    set_total_filter_pages(state, value) {
      state.total_filter_pages = value
    },
    set_total_filter_results(state, value) {
      state.total_filter_results = value
    },
    set_loading_filtered(state, value) {
      state.loading_filtered = value
    },
  }

  const base_actions = {
    get_models({ commit, state, dispatch }) {
      commit('set_selected', [])
      commit('set_filtered', [])
      commit('set_is_filtered', false)
      if (state.use_per_page) {
        commit('set_page', 1)
        commit('set_models', [])
      }
      return dispatch('_get_models')
    },

    _get_models({ commit, state }) {
      commit('set_loading', true)
      const path = '/' + api_resource_segment(state)
      const q = state.use_per_page
        ? '?page=' + state.page + '&per_page=' + state.per_page
        : ''
      return api
        .get(path + q)
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

    run_filter({ commit, state }, payload = {}) {
      const page = payload.page != null ? payload.page : state.filter_page
      const per = state.filter_per_page || 50
      const url =
        '/search/' + route_string(state.model_name) + '/null/1?page=' + page
      commit('set_loading_filtered', true)
      set_global_filter_loading(commit, true, 'Filtrando…')
      return api
        .post(
          url,
          {
            filters: state.filters,
            papelera: false,
            per_page: per,
          }
        )
        .then((res) => {
          const body = res.data
          const rows = body.data || []
          commit('set_is_filtered', true)
          commit('set_filtered', rows)
          commit('set_total_filter_pages', body.last_page || 1)
          commit('set_total_filter_results', body.total != null ? body.total : rows.length)
          commit('set_loading_filtered', false)
          set_global_filter_loading(commit, false)
        })
        .catch((err) => {
          commit('set_loading_filtered', false)
          set_global_filter_loading(commit, false)
          log_debug(err)
        })
    },

    /**
     * Elimina un registro por id en el server y actualiza listas locales.
     */
    delete_model({ commit, state }, id) {
      const path = '/' + api_resource_segment(state) + '/' + id
      return api.delete(path).then(() => {
        const next = state.models.filter((m) => m.id != id)
        commit('set_models', next)
        if (state.is_filtered) {
          const nf = state.filtered.filter((m) => m.id != id)
          commit('set_filtered', nf)
        }
        commit('set_selected', state.selected.filter((m) => m.id != id))
      })
    },

    /**
     * Reemplaza o agrega un modelo en models / filtered luego de guardar.
     */
    upsert_model_in_lists({ commit, state }, model) {
      if (!model || !model.id) {
        return
      }
      const in_idx = state.models.findIndex((m) => m.id == model.id)
      const arr = state.models.slice()
      if (in_idx == -1) {
        arr.unshift(model)
      } else {
        arr.splice(in_idx, 1, model)
      }
      commit('set_models', arr)
      if (state.is_filtered) {
        const idx = state.filtered.findIndex((m) => m.id == model.id)
        const f = state.filtered.slice()
        if (idx == -1) {
          f.unshift(model)
        } else {
          f.splice(idx, 1, model)
        }
        commit('set_filtered', f)
      }
    },
  }

  return {
    namespaced: true,
    state: base_state,
    mutations: Object.assign({}, base_mutations, custom_mutations),
    actions: Object.assign({}, base_actions, custom_actions),
    getters: Object.assign({}, custom_getters),
    modules: Object.assign({}, custom_modules),
  }
}
