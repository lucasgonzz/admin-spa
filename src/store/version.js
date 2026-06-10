import __base_store, { api_resource_segment } from '@/common-vue/store/__base_store'
import api from '@/utils/axios'
import { route_string } from '@/utils/route_string'
import { log_debug } from '@/utils/logger'

/** Promesa compartida para no duplicar GET /version?for_select=1 en paralelo. */
let select_catalog_promise = null

/**
 * Extrae filas livianas del payload de listado admin-api.
 *
 * @param {Object|null} body respuesta JSON
 * @returns {Array<Object>}
 */
function extract_models_from_response(body) {
  if (!body || !body.models) {
    return []
  }
  if (Array.isArray(body.models)) {
    return body.models
  }
  if (body.models.data && Array.isArray(body.models.data)) {
    return body.models.data
  }
  return []
}

/**
 * Proyecta un registro de versión a los campos usados en listado y selects.
 *
 * @param {Object|null} model registro completo o liviano
 * @returns {Object|null}
 */
function to_lite_version_row(model) {
  if (!model || model.id == null) {
    return null
  }
  return {
    id: model.id,
    version: model.version,
    title: model.title,
    status: model.status,
    published_at: model.published_at,
  }
}

export default __base_store({
  state: {
    model_name: 'version',
    /** Listado del módulo Versiones usa el catálogo liviano (sin paginación pesada). */
    use_per_page: false,
    per_page: 100,
    /** Catálogo liviano para selects y tabla (sin seeders/comandos/notificaciones). */
    select_catalog: [],
    select_catalog_loading: false,
    select_catalog_loaded: false,
  },
  mutations: {
    /**
     * Reemplaza el catálogo liviano de versiones.
     *
     * @param {Object} state
     * @param {Array<Object>} value
     */
    set_select_catalog(state, value) {
      state.select_catalog = value ? value : []
    },
    /**
     * Indica si hay una petición de catálogo en curso.
     *
     * @param {Object} state
     * @param {boolean} value
     */
    set_select_catalog_loading(state, value) {
      state.select_catalog_loading = !!value
    },
    /**
     * Marca el catálogo como cargado al menos una vez en la sesión.
     *
     * @param {Object} state
     * @param {boolean} value
     */
    set_select_catalog_loaded(state, value) {
      state.select_catalog_loaded = !!value
    },
    /**
     * Inserta o actualiza una fila liviana del catálogo.
     *
     * @param {Object} state
     * @param {Object|null} model
     */
    upsert_select_catalog_row(state, model) {
      /** Fila normalizada con solo campos de listado/select. */
      const lite_row = to_lite_version_row(model)
      if (!lite_row) {
        return
      }
      /** Índice del registro existente en catálogo. */
      const existing_index = state.select_catalog.findIndex(function (row) {
        return row.id == lite_row.id
      })
      if (existing_index === -1) {
        state.select_catalog.unshift(lite_row)
        return
      }
      /** Copia del arreglo para mantener reactividad en Vue 3. */
      const next_catalog = state.select_catalog.slice()
      next_catalog.splice(existing_index, 1, lite_row)
      state.select_catalog = next_catalog
    },
    /**
     * Quita una versión del catálogo liviano (p. ej. tras eliminar).
     *
     * @param {Object} state
     * @param {number|string} id
     */
    remove_from_select_catalog(state, id) {
      state.select_catalog = state.select_catalog.filter(function (row) {
        return row.id != id
      })
    },
    /**
     * Limpia catálogo al cerrar sesión.
     *
     * @param {Object} state
     */
    reset_select_catalog(state) {
      state.select_catalog = []
      state.select_catalog_loading = false
      state.select_catalog_loaded = false
    },
  },
  actions: {
    /**
     * Descarga todas las versiones sin relaciones (`for_select=1`).
     * Idempotente: reutiliza datos si ya se cargó en esta sesión.
     *
     * @returns {Promise<Array<Object>>}
     */
    load_select_catalog({ commit, state }) {
      if (state.select_catalog_loaded) {
        return Promise.resolve(state.select_catalog)
      }
      if (select_catalog_promise) {
        return select_catalog_promise
      }

      commit('set_select_catalog_loading', true)
      select_catalog_promise = api
        .get('/' + route_string('version') + '?for_select=1')
        .then(function (res) {
          /** Filas livianas devueltas por admin-api. */
          const models = extract_models_from_response(res.data)
          commit('set_select_catalog', models)
          commit('set_select_catalog_loaded', true)
          commit('set_select_catalog_loading', false)
          return models
        })
        .catch(function (err) {
          commit('set_select_catalog_loading', false)
          select_catalog_promise = null
          log_debug(err)
          return []
        })
        .then(function (models) {
          select_catalog_promise = null
          return models
        })

      return select_catalog_promise
    },
    /**
     * Listado del módulo Versiones: reutiliza el catálogo liviano global.
     *
     * @returns {Promise<Array<Object>>}
     */
    get_models({ commit, dispatch }) {
      commit('set_selected', [])
      commit('set_filtered', [])
      commit('set_is_filtered', false)
      commit('set_loading', true)
      return dispatch('load_select_catalog')
        .then(function (models) {
          commit('set_models', models.slice())
          commit('set_total_results', models.length)
          commit('set_total_pages', 1)
          commit('set_page', 1)
          commit('set_loading', false)
          return models
        })
        .catch(function (err) {
          commit('set_loading', false)
          log_debug(err)
          return []
        })
    },
    /**
     * Registro completo con relaciones anidadas (modal de edición en Versiones).
     *
     * @param {Object} context
     * @param {number|string} id
     * @returns {Promise<Object|null>}
     */
    fetch_full_model({ commit }, id) {
      return api
        .get('/' + route_string('version') + '/' + id)
        .then(function (res) {
          /** Modelo con seeders, comandos, notificaciones, etc. */
          const model = res.data && res.data.model ? res.data.model : null
          if (model) {
            commit('set_model', { model })
          }
          return model
        })
    },
    /**
     * Sincroniza listado y catálogo con datos básicos tras guardar.
     *
     * @param {Object} context
     * @param {Object|null} model
     */
    upsert_model_in_lists({ commit, state }, model) {
      /** Fila liviana para tabla y selects. */
      const lite_row = to_lite_version_row(model)
      if (!lite_row) {
        return
      }
      commit('upsert_select_catalog_row', lite_row)

      /** Índice en el listado visible del módulo. */
      const list_index = state.models.findIndex(function (row) {
        return row.id == lite_row.id
      })
      /** Copia del listado para reactividad. */
      const next_models = state.models.slice()
      if (list_index === -1) {
        next_models.unshift(lite_row)
      } else {
        next_models.splice(list_index, 1, lite_row)
      }
      commit('set_models', next_models)

      if (state.is_filtered) {
        /** Índice en resultados filtrados activos. */
        const filtered_index = state.filtered.findIndex(function (row) {
          return row.id == lite_row.id
        })
        if (filtered_index !== -1) {
          const next_filtered = state.filtered.slice()
          next_filtered.splice(filtered_index, 1, lite_row)
          commit('set_filtered', next_filtered)
        }
      }
    },
    /**
     * Elimina versión en API y actualiza catálogo liviano local.
     *
     * @param {Object} context
     * @param {number|string} id
     * @returns {Promise<void>}
     */
    delete_model({ commit, state }, id) {
      /** Path HTTP del recurso version en admin-api. */
      const path = '/' + api_resource_segment(state) + '/' + id
      return api.delete(path).then(function () {
        commit('set_models', state.models.filter(function (row) {
          return row.id != id
        }))
        if (state.is_filtered) {
          commit('set_filtered', state.filtered.filter(function (row) {
            return row.id != id
          }))
        }
        commit('set_selected', state.selected.filter(function (row) {
          return row.id != id
        }))
        commit('remove_from_select_catalog', id)
      })
    },
    /**
     * Limpia catálogo al cerrar sesión (nueva sesión recarga desde API).
     */
    reset_select_catalog({ commit }) {
      select_catalog_promise = null
      commit('reset_select_catalog')
    },
  },
})
