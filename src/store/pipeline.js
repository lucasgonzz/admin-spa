/**
 * Módulo de Pipelines (CRM) — misión pipelines-crm, 27/9/2026.
 *
 * Guarda solo lo que comparten todas las pantallas del módulo (tablero, agenda, configuración y la
 * pestaña "Pipelines" de la ficha del cliente y del lead):
 *
 *   - `meta`: las enumeraciones que publica el back (`GET pipelines/meta`): tipos de etapa, tipos de
 *     campo, canales y tipos de actividad, cada una con su etiqueta en español. 🔴 La SPA no las
 *     vuelve a escribir: si mañana el back suma un canal, aparece solo (clase "contrato de
 *     enumeración partido entre cliente y servidor").
 *   - `pipelines`: todos los pipelines, archivados incluidos (`GET pipelines?include_archived=1`).
 *     Cada vista filtra lo que muestra; así hay una sola lista y un solo pedido.
 *   - `admins`: los operadores para los selectores de responsable. No se piden acá: se delega en el
 *     módulo `admin`, que es la única fuente de `GET /admin` (mismo espejo que hacen `task` y
 *     `task_template`), para no sumar un tercer pedido idéntico con su propia caché.
 *
 * Nada del tablero vive acá (oportunidades, filtros, resumen): eso es estado de cada vista.
 */
import api from '@/utils/axios'
import { cached_get, run_once, MAX_AGE_SESION } from '@/common-vue/helpers/request_cache_helper'

/**
 * Ordena pipelines como los devuelve la API: `sort_order` y después `id`.
 *
 * @param {Array<Object>} list
 * @returns {Array<Object>}
 */
function sort_pipelines(list) {
  return list.slice().sort(function (a, b) {
    const by_order = Number(a.sort_order || 0) - Number(b.sort_order || 0)
    if (by_order !== 0) {
      return by_order
    }
    return Number(a.id) - Number(b.id)
  })
}

export default {
  namespaced: true,

  state() {
    return {
      /** Enumeraciones del back: `{ stage_types, field_types, channels, activity_types }`. */
      meta: { stage_types: [], field_types: [], channels: [], activity_types: [] },
      /** true cuando `meta` ya se cargó al menos una vez. */
      meta_loaded: false,
      /** Todos los pipelines (incluidos los archivados), con sus etapas y conteos. */
      pipelines: [],
      /** true cuando `pipelines` ya se cargó al menos una vez. */
      pipelines_loaded: false,
      /** true mientras corre `GET pipelines`. */
      loading_pipelines: false,
      /** Operadores para los selectores de responsable (espejo del módulo `admin`). */
      admins: [],
    }
  },

  getters: {
    /**
     * Pipelines no archivados, en el orden de la API.
     *
     * @param {Object} state
     * @returns {Array<Object>}
     */
    active_pipelines(state) {
      return state.pipelines.filter(function (p) {
        return !p.archived_at
      })
    },

    /**
     * Pipelines archivados, en el orden de la API.
     *
     * @param {Object} state
     * @returns {Array<Object>}
     */
    archived_pipelines(state) {
      return state.pipelines.filter(function (p) {
        return !!p.archived_at
      })
    },

    /**
     * Busca un pipeline por id.
     *
     * @param {Object} state
     * @returns {function(number|string): (Object|null)}
     */
    pipeline_by_id(state) {
      return function (id) {
        if (id === null || id === undefined || id === '') {
          return null
        }
        const target = Number(id)
        return state.pipelines.find(function (p) {
          return Number(p.id) === target
        }) || null
      }
    },

    /**
     * Etiqueta en español de un valor de enumeración, tal como la publica el back. Si el valor no
     * está en el catálogo (o el catálogo todavía no llegó) devuelve el valor crudo, para no
     * mostrar un hueco.
     *
     * @param {Object} state
     * @returns {function(string, string): string}
     */
    label_for(state) {
      return function (group, value) {
        const list = (state.meta && state.meta[group]) || []
        const found = list.find(function (item) {
          return item && item.value === value
        })
        if (found && found.label) {
          return found.label
        }
        return value === null || value === undefined ? '' : String(value)
      }
    },
  },

  mutations: {
    /**
     * @param {Object} state
     * @param {Object} value `{ stage_types, field_types, channels, activity_types }`
     */
    set_meta(state, value) {
      const data = value || {}
      state.meta = {
        stage_types: Array.isArray(data.stage_types) ? data.stage_types : [],
        field_types: Array.isArray(data.field_types) ? data.field_types : [],
        channels: Array.isArray(data.channels) ? data.channels : [],
        activity_types: Array.isArray(data.activity_types) ? data.activity_types : [],
      }
      state.meta_loaded = true
    },

    /**
     * @param {Object} state
     * @param {Array<Object>} value
     */
    set_pipelines(state, value) {
      state.pipelines = sort_pipelines(Array.isArray(value) ? value : [])
      state.pipelines_loaded = true
    },

    /**
     * Reemplaza (o agrega) un pipeline con la versión que devolvió una escritura.
     *
     * @param {Object} state
     * @param {Object} pipeline
     */
    upsert_pipeline(state, pipeline) {
      if (!pipeline || !pipeline.id) {
        return
      }
      const list = state.pipelines.filter(function (p) {
        return Number(p.id) !== Number(pipeline.id)
      })
      list.push(pipeline)
      state.pipelines = sort_pipelines(list)
    },

    /**
     * Saca un pipeline borrado de la lista.
     *
     * @param {Object} state
     * @param {number} pipeline_id
     */
    remove_pipeline(state, pipeline_id) {
      state.pipelines = state.pipelines.filter(function (p) {
        return Number(p.id) !== Number(pipeline_id)
      })
    },

    /**
     * @param {Object} state
     * @param {boolean} value
     */
    set_loading_pipelines(state, value) {
      state.loading_pipelines = !!value
    },

    /**
     * @param {Object} state
     * @param {Array<Object>} value
     */
    set_admins(state, value) {
      state.admins = Array.isArray(value) ? value.slice() : []
    },
  },

  actions: {
    /**
     * Trae las enumeraciones (`GET pipelines/meta`). Cambian solo con un deploy del back, así que
     * se piden una vez por sesión (caché con ventana larga). Nunca rechaza: si falla, las
     * etiquetas caen al valor crudo y la pantalla sigue.
     *
     * @param {Object} context
     * @returns {Promise<Object>}
     */
    fetch_meta({ commit, state }) {
      return cached_get('/pipelines/meta', { max_age_ms: MAX_AGE_SESION })
        .then(function (data) {
          commit('set_meta', data || {})
          return state.meta
        })
        .catch(function () {
          return state.meta
        })
    },

    /**
     * Trae todos los pipelines, archivados incluidos (`GET pipelines?include_archived=1`). Sin
     * ventana de frescura: los conteos cambian con cada movimiento. Dos pantallas que lo piden en
     * el mismo tick comparten el pedido. Rechaza si falla, para que la vista muestre el error.
     *
     * @param {Object} context
     * @returns {Promise<Array<Object>>}
     */
    fetch_pipelines({ commit, state }) {
      commit('set_loading_pipelines', true)
      return run_once('pipeline:list', function () {
        return api.get('/pipelines', { params: { include_archived: 1 } }).then(function (res) {
          return res.data || {}
        })
      })
        .then(function (data) {
          commit('set_pipelines', data.pipelines || [])
          commit('set_loading_pipelines', false)
          return state.pipelines
        })
        .catch(function (error) {
          commit('set_loading_pipelines', false)
          throw error
        })
    },

    /**
     * Operadores para los selectores de responsable. Delega en `admin/fetch_admins` (única fuente
     * de `GET /admin`, con su caché de sesión) y lo espeja acá. Nunca rechaza.
     *
     * @param {Object} context
     * @returns {Promise<Array<Object>>}
     */
    fetch_admins({ commit, dispatch, state }) {
      return dispatch('admin/fetch_admins', null, { root: true })
        .then(function (admins) {
          commit('set_admins', admins)
          return state.admins
        })
        .catch(function () {
          return state.admins
        })
    },
  },
}
