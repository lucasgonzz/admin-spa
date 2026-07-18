import api from '@/utils/axios'

/**
 * Busca en las tres secciones del panel el lead que contiene un socio dado (por id),
 * ya sea en su array plano `partners` (socios generales sin llamada asociada) o anidado
 * dentro de una de sus `calls[].partners` (socios detectados/cargados en una llamada puntual).
 *
 * @param {Object} state Estado del módulo closer.
 * @param {number|string} partner_id ID del LeadPartner a ubicar.
 * @returns {{ section_key: string, lead_index: number, location: 'flat'|'call', call_index: number|null }|null}
 */
function find_partner_location(state, partner_id) {
  const sections = ['en_curso', 'agendadas', 'seguimiento']
  let s = 0
  for (s = 0; s < sections.length; s = s + 1) {
    const section_key = sections[s]
    const list = state[section_key] || []
    let i = 0
    for (i = 0; i < list.length; i = i + 1) {
      const lead = list[i]
      const flat_partners = lead.partners || []
      let f = 0
      let found_flat = false
      for (f = 0; f < flat_partners.length; f = f + 1) {
        if (String(flat_partners[f].id) === String(partner_id)) {
          found_flat = true
        }
      }
      if (found_flat) {
        return { section_key: section_key, lead_index: i, location: 'flat', call_index: null }
      }
      const calls = lead.calls || []
      let c = 0
      for (c = 0; c < calls.length; c = c + 1) {
        const call_partners = calls[c].partners || []
        let g = 0
        let found_call = false
        for (g = 0; g < call_partners.length; g = g + 1) {
          if (String(call_partners[g].id) === String(partner_id)) {
            found_call = true
          }
        }
        if (found_call) {
          return { section_key: section_key, lead_index: i, location: 'call', call_index: c }
        }
      }
    }
  }
  return null
}

/**
 * Aplica `updater` sobre el array de socios correspondiente (plano en el lead, o anidado
 * dentro de la llamada donde se encontró) y reemplaza el estado de forma inmutable.
 *
 * @param {Object} state Estado del módulo closer.
 * @param {number|string} partner_id ID del socio a mutar.
 * @param {Function} updater Recibe partners[] y devuelve el nuevo array.
 * @returns {void}
 */
function mutate_partner_by_id(state, partner_id, updater) {
  const loc = find_partner_location(state, partner_id)
  if (!loc) {
    return
  }
  const section_list = state[loc.section_key].slice()
  const lead = section_list[loc.lead_index]

  if (loc.location === 'flat') {
    const updated_partners = updater(lead.partners ? lead.partners.slice() : [])
    section_list.splice(loc.lead_index, 1, Object.assign({}, lead, { partners: updated_partners }))
  } else {
    const calls = lead.calls.slice()
    const call = calls[loc.call_index]
    const updated_call_partners = updater(call.partners ? call.partners.slice() : [])
    calls.splice(loc.call_index, 1, Object.assign({}, call, { partners: updated_call_partners }))
    section_list.splice(loc.lead_index, 1, Object.assign({}, lead, { calls: calls }))
  }

  state[loc.section_key] = section_list
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
    /**
     * Criterio de ordenamiento de la sección "En seguimiento".
     * 'suggestion' → leads con sugerencia pendiente primero.
     * 'date'       → más reciente (por closer_called_at) primero.
     */
    followup_sort: 'suggestion',
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
      if (!partner || partner.id == null) {
        return
      }
      mutate_partner_by_id(state, partner.id, function (partners) {
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
     * Actualiza el criterio de ordenamiento de la sección "En seguimiento".
     *
     * @param {Object} state
     * @param {'suggestion'|'date'} value Nuevo criterio de orden.
     * @returns {void}
     */
    set_followup_sort(state, value) {
      if (value === 'suggestion' || value === 'date') {
        state.followup_sort = value
      }
    },
    /**
     * Elimina un socio del lead en el estado local tras DELETE.
     *
     * @param {Object} state
     * @param {{ partner_id: number|string, lead_id: number|string }} payload
     * @returns {void}
     */
    remove_partner(state, payload) {
      if (!payload || payload.partner_id == null) {
        return
      }
      mutate_partner_by_id(state, payload.partner_id, function (partners) {
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
    /**
     * Envía el bot de Recall.ai a la reunión del lead (fire-and-forget).
     * Los errores se loguean en consola pero no se propagan.
     *
     * @param {Object} context
     * @param {number|string} lead_id ID del lead.
     * @returns {void}
     */
    send_recall_bot: function (context, lead_id) {
      api.post('/lead/' + lead_id + '/send-recall-bot').catch(function (err) {
        console.warn('[Recall] Error al enviar bot:', err)
      })
    },
    /**
     * Unirse a Meet (columna Hoy): pide al backend la llamada pendiente del lead (la crea
     * si hace falta, reutilizando el Meet del agendamiento la primera vez, o generando uno
     * ad-hoc si no tiene) y manda el bot automáticamente si todavía no tenía uno asignado.
     * Devuelve la llamada para que el componente abra el Meet en una pestaña nueva. Dispara
     * además un refresh silencioso del panel (el lead puede salir de "Hoy" tras esta acción).
     *
     * @param {Object} context
     * @param {number|string} lead_id
     * @returns {Promise<Object|null>} La LeadCall devuelta por el backend.
     */
    join_call(context, lead_id) {
      return api.post('/lead/' + lead_id + '/calls/join').then(function (res) {
        context.dispatch('refresh_panel').catch(function () {
          return null
        })
        return (res.data && res.data.call) || null
      })
    },
    /**
     * Nueva reunión (Seguimiento, ad-hoc): crea SIEMPRE una llamada nueva con evento para
     * ahora + la duración configurada, manda el bot, y refresca el panel.
     *
     * @param {Object} context
     * @param {number|string} lead_id
     * @returns {Promise<Object|null>} La LeadCall creada.
     */
    create_new_call(context, lead_id) {
      return api.post('/lead/' + lead_id + '/calls/new').then(function (res) {
        context.dispatch('refresh_panel').catch(function () {
          return null
        })
        return (res.data && res.data.call) || null
      })
    },
    /**
     * Manda el bot de Recall.ai a una llamada puntual (reintento manual). Fire-and-forget:
     * los errores se loguean en consola pero no se propagan.
     *
     * @param {Object} context
     * @param {{ lead_id: number|string, call_id: number|string }} payload
     * @returns {void}
     */
    send_bot_for_call(context, payload) {
      api
        .post('/lead/' + payload.lead_id + '/calls/' + payload.call_id + '/send-bot')
        .catch(function (err) {
          console.warn('[Recall] Error al enviar bot a la llamada:', err)
        })
    },
  },
}
