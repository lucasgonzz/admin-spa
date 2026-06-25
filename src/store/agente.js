import api from '@/utils/axios'

/**
 * Store del módulo Agente: variantes de mensajes A/B y métricas de onboarding.
 */
export default {
  namespaced: true,
  state: {
    /** Variantes devueltas por GET /admin/message-variant. */
    variants: [],
    /** true mientras se cargan o actualizan variantes. */
    loading: false,
    /** Mensaje de error de la última operación, si hubo fallo. */
    error: null,
  },
  mutations: {
    /**
     * Reemplaza la lista completa de variantes.
     *
     * @param {Object} state estado del módulo
     * @param {Array} variants registros de variantes
     * @returns {void}
     */
    set_variants(state, variants) {
      state.variants = variants ? variants : []
    },

    /**
     * Actualiza el flag de carga del módulo.
     *
     * @param {Object} state estado del módulo
     * @param {boolean} loading indica si hay operación en curso
     * @returns {void}
     */
    set_loading(state, loading) {
      state.loading = loading
    },

    /**
     * Guarda el mensaje de error de la última operación.
     *
     * @param {Object} state estado del módulo
     * @param {string|null} error texto de error o null para limpiar
     * @returns {void}
     */
    set_error(state, error) {
      state.error = error
    },

    /**
     * Reemplaza una variante en la lista local por id.
     *
     * @param {Object} state estado del módulo
     * @param {Object} variant variante actualizada
     * @returns {void}
     */
    upsert_variant(state, variant) {
      const variants = state.variants.slice()
      const idx = variants.findIndex(function (v) {
        return v.id == variant.id
      })
      if (idx !== -1) {
        variants.splice(idx, 1, variant)
        state.variants = variants
      }
    },

    /**
     * Quita una variante de la lista local por id.
     *
     * @param {Object} state estado del módulo
     * @param {number|string} id identificador de la variante
     * @returns {void}
     */
    remove_variant(state, id) {
      state.variants = state.variants.filter(function (v) {
        return v.id != id
      })
    },
  },
  actions: {
    /**
     * Trae todas las variantes desde la API.
     *
     * @param {Object} context contexto Vuex
     * @returns {Promise<Array>} lista de variantes
     */
    fetch_variants(context) {
      context.commit('set_loading', true)
      context.commit('set_error', null)

      return api
        .get('/message-variant')
        .then(function (res) {
          const variants = res.data.models || []
          context.commit('set_variants', variants)
          return variants
        })
        .catch(function (err) {
          const message =
            (err.response && err.response.data && err.response.data.message) ||
            'No se pudieron cargar las variantes.'
          context.commit('set_error', message)
          throw err
        })
        .finally(function () {
          context.commit('set_loading', false)
        })
    },

    /**
     * Activa o desactiva una variante.
     *
     * @param {Object} context contexto Vuex
     * @param {{ id: number|string, active: boolean }} payload id y nuevo estado active
     * @returns {Promise<Object>} variante actualizada
     */
    toggle_active(context, payload) {
      context.commit('set_error', null)

      return api
        .put('/message-variant/' + payload.id, { active: payload.active })
        .then(function (res) {
          const updated = res.data.model
          context.commit('upsert_variant', updated)
          return updated
        })
        .catch(function (err) {
          const message =
            (err.response && err.response.data && err.response.data.message) ||
            'No se pudo actualizar la variante.'
          context.commit('set_error', message)
          throw err
        })
    },

    /**
     * Elimina una variante sin envíos previos.
     *
     * @param {Object} context contexto Vuex
     * @param {number|string} id identificador de la variante
     * @returns {Promise<void>}
     */
    delete_variant(context, id) {
      context.commit('set_error', null)

      return api
        .delete('/message-variant/' + id)
        .then(function () {
          context.commit('remove_variant', id)
        })
        .catch(function (err) {
          const message =
            (err.response && err.response.data && err.response.data.message) ||
            'No se pudo eliminar la variante.'
          context.commit('set_error', message)
          throw err
        })
    },
  },
}
