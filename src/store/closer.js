import api from '@/utils/axios'

/**
 * Busca un lead por id en las tres secciones del panel del closer.
 *
 * @param {Object} state Estado del módulo closer.
 * @param {number|string} lead_id ID del lead.
 * @returns {{ section_key: string, index: number, lead: Object }|null}
 */
function find_lead_in_panel(state, lead_id) {
  const sections = ['en_curso', 'agendadas', 'seguimiento']
  let i = 0
  for (i = 0; i < sections.length; i = i + 1) {
    const section_key = sections[i]
    const list = state[section_key] || []
    let j = 0
    for (j = 0; j < list.length; j = j + 1) {
      if (String(list[j].id) === String(lead_id)) {
        return { section_key: section_key, index: j, lead: list[j] }
      }
    }
  }
  return null
}

/**
 * Actualiza el array partners de un lead dentro de una sección del panel.
 *
 * @param {Object} state Estado del módulo closer.
 * @param {number|string} lead_id ID del lead.
 * @param {Function} updater Función que recibe partners[] y devuelve el nuevo array.
 * @returns {void}
 */
function mutate_lead_partners(state, lead_id, updater) {
  const found = find_lead_in_panel(state, lead_id)
  if (!found) {
    return
  }
  const current_partners = found.lead.partners ? found.lead.partners.slice() : []
  const updated_partners = updater(current_partners)
  const updated_lead = Object.assign({}, found.lead, { partners: updated_partners })
  const section_list = state[found.section_key].slice()
  section_list.splice(found.index, 1, updated_lead)
  state[found.section_key] = section_list
}

/**
 * Store del panel operativo del closer: tres listas de leads y acciones sobre socios.
 */
export default {
  namespaced: true,
  state: {
    /** Leads con demo en curso o recién finalizada. */
    en_curso: [],
    /** Leads con demo agendada o pidiendo disponibilidad. */
    agendadas: [],
    /** Leads en seguimiento post-llamada con resumen de Recall. */
    seguimiento: [],
    /** Settings de timing de alertas (desde GET /closer/panel). */
    settings: {},
    /** true durante la carga inicial o refresh explícito con indicador. */
    loading: false,
    /** Timestamp ISO del último fetch exitoso. */
    last_fetched_at: null,
  },
  mutations: {
    /**
     * Reemplaza el contenido completo del panel desde la API.
     *
     * @param {Object} state
     * @param {Object} payload Respuesta de GET /closer/panel.
     * @returns {void}
     */
    set_panel(state, payload) {
      state.en_curso = payload.en_curso || []
      state.agendadas = payload.agendadas || []
      state.seguimiento = payload.seguimiento || []
      state.settings = payload.settings || {}
      state.last_fetched_at = new Date().toISOString()
    },
    /**
     * Activa o desactiva el indicador de carga visible.
     *
     * @param {Object} state
     * @param {boolean} value
     * @returns {void}
     */
    set_loading(state, value) {
      state.loading = !!value
    },
    /**
     * Fusiona un socio confirmado en el lead correspondiente del panel local.
     *
     * @param {Object} state
     * @param {Object} partner Modelo LeadPartner devuelto por la API.
     * @returns {void}
     */
    update_partner_confirmed(state, partner) {
      if (!partner || partner.lead_id == null) {
        return
      }
      mutate_lead_partners(state, partner.lead_id, function (partners) {
        const updated = []
        let i = 0
        for (i = 0; i < partners.length; i = i + 1) {
          if (String(partners[i].id) === String(partner.id)) {
            updated.push(Object.assign({}, partners[i], partner, { pending_confirmation: false }))
          } else {
            updated.push(partners[i])
          }
        }
        return updated
      })
    },
    /**
     * Elimina un socio del lead en el estado local tras DELETE.
     *
     * @param {Object} state
     * @param {{ partner_id: number|string, lead_id: number|string }} payload
     * @returns {void}
     */
    remove_partner(state, payload) {
      if (!payload || payload.lead_id == null || payload.partner_id == null) {
        return
      }
      mutate_lead_partners(state, payload.lead_id, function (partners) {
        return partners.filter(function (p) {
          return String(p.id) !== String(payload.partner_id)
        })
      })
    },
  },
  actions: {
    /**
     * Carga inicial del panel con indicador de carga global.
     *
     * @param {Object} context
     * @returns {Promise<Object>}
     */
    fetch_panel(context) {
      context.commit('set_loading', true)
      return api
        .get('/closer/panel')
        .then(function (res) {
          context.commit('set_panel', res.data || {})
          return res.data
        })
        .finally(function () {
          context.commit('set_loading', false)
        })
    },
    /**
     * Refresco silencioso para polling periódico (sin overlay global).
     *
     * @param {Object} context
     * @returns {Promise<Object>}
     */
    refresh_panel(context) {
      return api.get('/closer/panel').then(function (res) {
        context.commit('set_panel', res.data || {})
        return res.data
      })
    },
    /**
     * Confirma un socio sugerido y actualiza el lead en el state local.
     *
     * @param {Object} context
     * @param {number|string} partner_id ID del LeadPartner.
     * @returns {Promise<Object>}
     */
    confirm_partner(context, partner_id) {
      return api.post('/lead-partner/' + partner_id + '/confirm').then(function (res) {
        const partner = res.data.model
        context.commit('update_partner_confirmed', partner)
        return partner
      })
    },
    /**
     * Descarta un socio sugerido y lo remueve del array local del lead.
     *
     * @param {Object} context
     * @param {{ partner_id: number|string, lead_id: number|string }} payload
     * @returns {Promise<Object>}
     */
    discard_partner(context, payload) {
      return api.delete('/lead-partner/' + payload.partner_id).then(function (res) {
        context.commit('remove_partner', payload)
        return res.data
      })
    },
  },
}
