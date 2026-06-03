import __base_store from '@/common-vue/store/__base_store'
import api from '@/utils/axios'

/**
 * Reglas de seguimiento automático (`followup-rule` en admin-api).
 */
export default __base_store({
  state: {
    model_name: 'followup_rule',
    /** Path real del recurso (kebab) distinto del nombre de módulo Vuex. */
    api_resource_path: 'followup-rule',
    use_per_page: false,
    per_page: 100,
  },
  actions: {
    /**
     * Persiste cambios de una regla (horas, máximo de seguimientos, activa).
     * @param {Object} context
     * @param {{ id: number, horas_espera?: number, max_followups?: number, activa?: boolean, descripcion?: string }} payload
     * @returns {Promise<Object>} modelo regla
     */
    update_rule(context, payload) {
      const id = payload.id
      const body = {}
      if (payload.horas_espera != null) {
        body.horas_espera = payload.horas_espera
      }
      if (payload.max_followups != null) {
        body.max_followups = payload.max_followups
      }
      if (payload.activa != null) {
        body.activa = payload.activa
      }
      if (payload.descripcion != null) {
        body.descripcion = payload.descripcion
      }
      return api.put('/followup-rule/' + id, body).then((res) => {
        return res.data.model
      })
    },
  },
})
