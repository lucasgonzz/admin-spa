import api from '@/utils/axios'

/**
 * Plantillas de seguimiento de WhatsApp (`followup-template` en admin-api).
 *
 * Lista de solo edición: cada registro mapea un estado del lead + número de día
 * a una plantilla de Meta (`template_name`). Lucas solo edita `template_name` y
 * el flag `activa`; `language_code` se reenvía sin cambios.
 */
export default {
  namespaced: true,
  state: {
    /** Registros de plantillas devueltos por la API. */
    models: [],
  },
  mutations: {
    /**
     * Reemplaza la lista completa de plantillas.
     *
     * @param {Object} state estado del módulo
     * @param {Array} models registros de plantillas
     * @returns {void}
     */
    set_models(state, models) {
      state.models = models ? models : []
    },
  },
  actions: {
    /**
     * Trae todas las plantillas desde la API y las guarda en el store.
     *
     * @param {Object} context contexto Vuex
     * @returns {Promise<Array>} lista de plantillas
     */
    fetch(context) {
      return api.get('/followup-template').then(function (res) {
        const models = res.data.models || []
        context.commit('set_models', models)
        return models
      })
    },

    /**
     * Persiste el `template_name`, `language_code`, `activa` y `body_template` de una plantilla
     * y actualiza el registro localmente con la respuesta del servidor.
     *
     * @param {Object} context contexto Vuex
     * @param {{ id: number, template_name: string, language_code: string, activa: boolean, body_template: string|null }} model plantilla editada
     * @returns {Promise<Object>} plantilla actualizada
     */
    update(context, model) {
      // Cuerpo del PUT: campos editables incluido el texto literal de la plantilla.
      const body = {
        template_name: model.template_name,
        language_code: model.language_code,
        activa: model.activa,
        /* body_template puede ser null (para plantillas del closer sin texto automático). */
        body_template: model.body_template != null ? model.body_template : null,
      }
      return api.put('/followup-template/' + model.id, body).then(function (res) {
        const updated = res.data.model
        // Reemplaza el item en la lista local manteniendo el orden.
        const models = context.state.models.slice()
        const idx = models.findIndex(function (m) {
          return m.id == updated.id
        })
        if (idx !== -1) {
          models.splice(idx, 1, updated)
          context.commit('set_models', models)
        }
        return updated
      })
    },
  },
}
