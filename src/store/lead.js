import __base_store from '@/common-vue/store/__base_store'
import api from '@/utils/axios'

/**
 * Fusiona mensajes del hilo conservando adjuntos si el payload nuevo no los trae.
 *
 * @param {Array<Object>} previous
 * @param {Array<Object>} incoming
 * @returns {Array<Object>}
 */
function merge_lead_messages_preserving_attachments(previous, incoming) {
  const by_id = {}
  let i = 0
  for (i = 0; i < previous.length; i = i + 1) {
    by_id[previous[i].id] = previous[i]
  }
  const merged = []
  for (i = 0; i < incoming.length; i = i + 1) {
    const msg = incoming[i]
    const old = by_id[msg.id]
    if (!old) {
      merged.push(msg)
      continue
    }
    const row = Object.assign({}, old, msg)
    if (
      old.attachments &&
      old.attachments.length &&
      (!msg.attachments || !msg.attachments.length)
    ) {
      row.attachments = old.attachments
    }
    merged.push(row)
  }
  return merged
}

/**
 * Fusiona mensajes del hilo abierto sin perder el historial completo cuando llega un payload liviano.
 *
 * @param {Array<Object>|null|undefined} previous
 * @param {Array<Object>|null|undefined} incoming
 * @returns {Array<Object>|null|undefined}
 */
function merge_conversation_messages(previous, incoming) {
  if (!incoming || !incoming.length) {
    return previous
  }
  if (!previous || !previous.length) {
    return incoming
  }
  /** Índice por id para conservar todo el hilo previo y actualizar filas puntuales. */
  const by_id = {}
  let i = 0
  for (i = 0; i < previous.length; i = i + 1) {
    by_id[previous[i].id] = previous[i]
  }
  for (i = 0; i < incoming.length; i = i + 1) {
    /** Mensaje entrante (notificación o actualización puntual). */
    const msg = incoming[i]
    const old = by_id[msg.id]
    if (!old) {
      by_id[msg.id] = msg
      continue
    }
    const row = Object.assign({}, old, msg)
    if (
      old.attachments &&
      old.attachments.length &&
      (!msg.attachments || !msg.attachments.length)
    ) {
      row.attachments = old.attachments
    }
    by_id[msg.id] = row
  }
  /** Lista ordenada cronológicamente por id. */
  const merged = []
  const keys = Object.keys(by_id)
  keys.sort(function (a, b) {
    return parseInt(a, 10) - parseInt(b, 10)
  })
  for (i = 0; i < keys.length; i = i + 1) {
    merged.push(by_id[keys[i]])
  }
  return merged
}

export default __base_store({
  state: {
    model_name: 'lead',
    use_per_page: true,
    per_page: 50,
    /** Lead abierto en la pestaña de conversación (para refrescar listas coherentes). */
    lead_en_conversacion: null,
    /** Indica llamada en curso a Claude al agregar mensaje del lead. */
    loading_ai: false,
    /** Id del lead cuya sugerencia IA se está generando (automática o manual). */
    ai_generating_lead_id: null,
    /** Último error de IA (mensaje legible para la UI). */
    ai_error: null,
    /** Total global de mensajes del lead sin leer (badge menú Leads). */
    unread_total: 0,
    /** Id de lead con GET conversación en curso (evita duplicados). */
    _conversation_fetch_in_flight: null,
  },
  mutations: {
    /**
     * @param {Object} state
     * @param {number|null} lead_id
     */
    set_conversation_fetch_in_flight(state, lead_id) {
      state._conversation_fetch_in_flight = lead_id
    },
    /**
     * @param {Object} state
     * @param {Object|null} value modelo lead o null
     */
    set_lead_en_conversacion(state, value) {
      state.lead_en_conversacion = value
    },
    /**
     * @param {Object} state
     * @param {boolean} value
     */
    set_loading_ai(state, value) {
      state.loading_ai = Boolean(value)
    },
    /**
     * @param {Object} state
     * @param {number|string|null} lead_id
     */
    set_ai_generating_lead_id(state, lead_id) {
      if (lead_id == null || lead_id === '') {
        state.ai_generating_lead_id = null
        return
      }
      state.ai_generating_lead_id = lead_id
    },
    /**
     * @param {Object} state
     * @param {string|null} value
     */
    set_ai_error(state, value) {
      state.ai_error = value
    },
    /**
     * Fusiona el lead en conversación si coincide el id (tras POST mensaje / aprobar / rechazar).
     * @param {Object} state
     * @param {Object} model lead devuelto por la API
     */
    update_lead_en_conversacion(state, model) {
      if (!model || !model.id) {
        return
      }
      if (state.lead_en_conversacion && state.lead_en_conversacion.id == model.id) {
        /** Mensajes previos del hilo completo en la pestaña Conversación. */
        const previous_messages = state.lead_en_conversacion.messages
        state.lead_en_conversacion = Object.assign({}, state.lead_en_conversacion, model)
        if (model.messages_scope === 'full' && model.messages && model.messages.length) {
          state.lead_en_conversacion.messages = model.messages
        } else {
          state.lead_en_conversacion.messages = merge_conversation_messages(
            previous_messages,
            model.messages
          )
        }
      }
    },
    /**
     * @param {Object} state
     * @param {number} value
     */
    set_unread_total(state, value) {
      const n = parseInt(value, 10)
      state.unread_total = isNaN(n) ? 0 : n
    },
    /**
     * Agrega un mensaje al hilo abierto si no existe (evento Pusher).
     *
     * @param {Object} state
     * @param {{ lead_id: number, message: Object }} payload
     */
    append_message_to_open_conversation(state, payload) {
      if (!payload || !payload.message || !payload.lead_id) {
        return
      }
      const conv = state.lead_en_conversacion
      if (!conv || conv.id != payload.lead_id) {
        return
      }
      const messages = conv.messages ? conv.messages.slice() : []
      let exists = false
      let i = 0
      for (i = 0; i < messages.length; i = i + 1) {
        if (messages[i].id == payload.message.id) {
          exists = true
          const previous = messages[i]
          const incoming = payload.message
          const merged = Object.assign({}, previous, incoming)
          if (
            previous.attachments &&
            previous.attachments.length &&
            (!incoming.attachments || !incoming.attachments.length)
          ) {
            merged.attachments = previous.attachments
          }
          messages[i] = merged
          break
        }
      }
      if (!exists) {
        messages.push(payload.message)
        messages.sort(function (a, b) {
          return (a.id || 0) - (b.id || 0)
        })
      }
      state.lead_en_conversacion = Object.assign({}, conv, { messages: messages })
    },
  },
  actions: {
    /**
     * Fusiona fila en listados preservando `messages` si el payload de Pusher no los trae.
     *
     * @param {Object} context
     * @param {Object} model
     * @returns {void}
     */
    upsert_model_in_lists(context, model) {
      if (!model || !model.id) {
        return
      }
      const state = context.state
      const commit = context.commit

      const merge_lead_row = function (existing, incoming) {
        const merged = Object.assign({}, existing || {}, incoming)
        if (incoming && incoming.messages && incoming.messages.length) {
          merged.messages = incoming.messages
        } else if (existing && existing.messages && existing.messages.length) {
          merged.messages = existing.messages
        }
        return merged
      }

      const in_idx = state.models.findIndex(function (m) {
        return m.id == model.id
      })
      const arr = state.models.slice()
      if (in_idx === -1) {
        arr.unshift(model)
      } else {
        arr.splice(in_idx, 1, merge_lead_row(arr[in_idx], model))
      }
      commit('set_models', arr)

      if (state.is_filtered) {
        const f_idx = state.filtered.findIndex(function (m) {
          return m.id == model.id
        })
        const filtered_arr = state.filtered.slice()
        if (f_idx === -1) {
          filtered_arr.unshift(model)
        } else {
          filtered_arr.splice(f_idx, 1, merge_lead_row(filtered_arr[f_idx], model))
        }
        commit('set_filtered', filtered_arr)
      }
    },
    /**
     * Ejecuta envío de mail de presentación para un lead.
     * @param {Object} context contexto del módulo Vuex.
     * @param {number} lead_id identificador del lead.
     * @returns {Promise<Object>} modelo actualizado devuelto por el backend.
     */
    send_presentation_mail(context, lead_id) {
      return api.post('/lead/' + lead_id + '/send-presentation-mail').then((res) => {
        return res.data.model
      })
    },
    /**
     * Ejecuta envío de mail de seguimiento para un lead.
     * @param {Object} context contexto del módulo Vuex.
     * @param {number} lead_id identificador del lead.
     * @returns {Promise<Object>} modelo actualizado devuelto por el backend.
     */
    send_followup_mail(context, lead_id) {
      return api.post('/lead/' + lead_id + '/send-followup-mail').then((res) => {
        return res.data.model
      })
    },
    /**
     * Dispara el setup de demo en el sistema destino.
     * @param {Object} context contexto del módulo Vuex.
     * @param {number} lead_id identificador del lead.
     * @returns {Promise<Object>} modelo actualizado devuelto por el backend.
     */
    run_demo_setup(context, lead_id) {
      return api.post('/lead/' + lead_id + '/run-demo-setup').then((res) => {
        return res.data.model
      })
    },
    /**
     * Promueve un lead a cliente de producción.
     * @param {Object} context contexto del módulo Vuex.
     * @param {{ lead_id: number, api_url: string }} payload datos de promoción.
     * @returns {Promise<Object>} modelo actualizado devuelto por el backend.
     */
    promote_lead(context, payload) {
      return api.post('/lead/' + payload.lead_id + '/promote', { api_url: payload.api_url }).then((res) => {
        return res.data.model
      })
    },
    /**
     * Solicita a la API un subdominio sugerido para el nombre de empresa dado.
     * Llama a POST /client/suggest-subdomain y retorna el string sugerido.
     *
     * @param {Object} context contexto del módulo Vuex.
     * @param {string} company_name nombre de empresa del lead.
     * @returns {Promise<string>} subdominio sugerido por Claude.
     */
    suggest_subdomain(context, company_name) {
      return api.post('/client/suggest-subdomain', { company_name }).then(function (res) {
        return res.data.subdomain || ''
      })
    },
    /**
     * Promueve el lead a Client de producción en admin-api y genera las tareas automáticas.
     * Acepta { lead_id, suggested_subdomain } o solo un número (backward compat).
     * No ejecuta el setup remoto del empresa-api; ese paso continúa siendo `run_user_setup`.
     *
     * @param {Object} context contexto del módulo Vuex.
     * @param {{ lead_id: number, suggested_subdomain?: string }|number} payload identificador del lead con subdominio opcional.
     * @returns {Promise<Object>} modelo actualizado devuelto por el backend.
     */
    promote_to_client(context, payload) {
      /* Soporte para payload como número (backward compat) y como objeto con subdomain. */
      var lead_id            = typeof payload === 'object' ? payload.lead_id : payload
      var suggested_subdomain = typeof payload === 'object' ? (payload.suggested_subdomain || '') : ''
      return api.post('/lead/' + lead_id + '/promote-to-client', { suggested_subdomain }).then(function (res) {
        return res.data.model
      })
    },

    /**
     * Dispara el setup del sistema real para un lead promovido.
     * @param {Object} context contexto del módulo Vuex.
     * @param {number} lead_id identificador del lead.
     * @returns {Promise<Object>} modelo actualizado devuelto por el backend.
     */
    run_user_setup(context, lead_id) {
      return api.post('/lead/' + lead_id + '/run-user-setup').then((res) => {
        return res.data.model
      })
    },
    /**
     * Envía el "Mail 1 - DEMO" al prospecto con sus credenciales y horario de demo.
     * El backend valida que todos los campos obligatorios estén completos.
     * @param {Object} context contexto del módulo Vuex.
     * @param {number} lead_id identificador del lead.
     * @returns {Promise<Object>} modelo actualizado devuelto por el backend.
     */
    send_demo_mail(context, lead_id) {
      return api.post('/lead/' + lead_id + '/send-demo-mail').then((res) => {
        return res.data.model
      })
    },
    /**
     * Envía el recordatorio pre-demo manualmente sin esperar el scheduler automático.
     * @param {Object} context contexto del módulo Vuex.
     * @param {number} lead_id identificador del lead.
     * @returns {Promise<Object>} modelo actualizado devuelto por el backend.
     */
    send_demo_reminder(context, lead_id) {
      return api.post('/lead/' + lead_id + '/send-demo-reminder').then(function (res) {
        return res.data.model
      })
    },
    /**
     * Genera el check de ingreso a la demo manualmente sin esperar el scheduler automático.
     * @param {Object} context contexto del módulo Vuex.
     * @param {number} lead_id identificador del lead.
     * @returns {Promise<Object>} modelo actualizado devuelto por el backend.
     */
    check_demo_ingress(context, lead_id) {
      return api.post('/lead/' + lead_id + '/check-demo-ingress').then(function (res) {
        return res.data.model
      })
    },
    /**
     * Genera el resumen del lead con Claude manualmente sin esperar el scheduler automático.
     * @param {Object} context contexto del módulo Vuex.
     * @param {number} lead_id identificador del lead.
     * @returns {Promise<Object>} modelo actualizado devuelto por el backend.
     */
    generate_demo_summary(context, lead_id) {
      return api.post('/lead/' + lead_id + '/generate-demo-summary').then(function (res) {
        return res.data.model
      })
    },
    /**
     * Marca que el closer realizó la llamada post-demo al lead.
     * @param {Object} context contexto del módulo Vuex.
     * @param {number} lead_id identificador del lead.
     * @returns {Promise<Object>} modelo actualizado devuelto por el backend.
     */
    mark_closer_called(context, lead_id) {
      return api.post('/lead/' + lead_id + '/mark-closer-called').then(function (res) {
        return res.data.model
      })
    },
    /**
     * Envía un mensaje directo al lead por WhatsApp sin pasar por Claude.
     *
     * @param {Object} context
     * @param {{ lead_id: number, content: string }} payload
     * @returns {Promise<Object>} modelo lead actualizado
     */
    send_direct_message(context, payload) {
      const commit = context.commit
      return api
        .post('/lead/' + payload.lead_id + '/send-direct-message', { content: payload.content })
        .then((res) => {
          const model = res.data.model
          commit('update_lead_en_conversacion', model)
          return model
        })
    },
    /**
     * Simula un mensaje entrante del lead (testing) sin pasar por WhatsApp.
     * Dispara en el backend el mismo flujo que el webhook real (sugerencia IA con debounce).
     *
     * @param {Object} context
     * @param {{ lead_id: number, content: string }} payload
     * @returns {Promise<Object>} modelo lead actualizado
     */
    simulate_inbound_message(context, payload) {
      const commit = context.commit
      return api
        .post('/lead/' + payload.lead_id + '/simulate-inbound', { content: payload.content })
        .then((res) => {
          const model = res.data.model
          commit('update_lead_en_conversacion', model)
          return model
        })
    },
    /**
     * Pide sugerencia a Claude sin esperar el debounce automático (mensajes del lead ya cargados en el hilo).
     *
     * @param {Object} context
     * @param {number} lead_id
     * @returns {Promise<Object>} modelo lead actualizado
     */
    request_ai_suggestion(context, lead_id) {
      const commit = context.commit
      commit('set_ai_generating_lead_id', lead_id)
      commit('set_ai_error', null)
      return api
        .post('/lead/' + lead_id + '/request-ai-suggestion')
        .then((res) => {
          const model = res.data.model
          commit('set_ai_generating_lead_id', null)
          commit('update_lead_en_conversacion', model)
          return model
        })
        .catch((err) => {
          commit('set_ai_generating_lead_id', null)
          const msg =
            err && err.response && err.response.data && err.response.data.message
              ? String(err.response.data.message)
              : 'Error al generar sugerencia'
          commit('set_ai_error', msg)
          return Promise.reject(err)
        })
    },
    /**
     * Cancela el debounce automático antes de pedir sugerencia IA a Claude.
     *
     * @param {Object} context
     * @param {number} lead_id
     * @returns {Promise<Object>} modelo lead actualizado
     */
    cancel_scheduled_ai_suggestion(context, lead_id) {
      const commit = context.commit
      return api.post('/lead/' + lead_id + '/cancel-scheduled-ai-suggestion').then((res) => {
        const model = res.data.model
        commit('update_lead_en_conversacion', model)
        return model
      })
    },
    /**
     * Envía por WhatsApp un mensaje sugerido por IA (sin editar).
     * @param {Object} context
     * @param {number} message_id id de lead_messages
     * @returns {Promise<Object>} modelo lead
     */
    approve_message(context, message_id) {
      const commit = context.commit
      return api.put('/lead-message/' + message_id + '/approve').then((res) => {
        const model = res.data.model
        commit('update_lead_en_conversacion', model)
        return model
      })
    },
    /**
     * Envía por WhatsApp un mensaje sugerido guardando el texto editado por el setter.
     * @param {Object} context
     * @param {{ message_id: number, edited_content: string }} payload id y texto final
     * @returns {Promise<Object>} modelo lead
     */
    approve_message_with_edit(context, payload) {
      const commit = context.commit
      return api
        .put('/lead-message/' + payload.message_id + '/approve-with-edit', {
          edited_content: payload.edited_content,
        })
        .then((res) => {
          const model = res.data.model
          commit('update_lead_en_conversacion', model)
          return model
        })
    },
    /**
     * Rechaza un mensaje sugerido por IA.
     * @param {Object} context
     * @param {number} message_id id de lead_messages
     * @returns {Promise<Object>} modelo lead
     */
    reject_message(context, message_id) {
      const commit = context.commit
      return api.put('/lead-message/' + message_id + '/reject').then((res) => {
        const model = res.data.model
        commit('update_lead_en_conversacion', model)
        return model
      })
    },
    /**
     * Cancela el envío automático de una sugerencia y la marca como no enviada.
     *
     * @param {Object} context
     * @param {number} message_id id de lead_messages
     * @returns {Promise<Object>} modelo lead
     */
    cancel_auto_send_message(context, message_id) {
      const commit = context.commit
      return api.put('/lead-message/' + message_id + '/cancel-auto-send').then((res) => {
        const model = res.data.model
        commit('update_lead_en_conversacion', model)
        return model
      })
    },
    /**
     * Marca como vista la alerta de seguimiento automático en la tabla de leads.
     * @param {Object} context
     * @param {number} lead_id id del lead
     * @returns {Promise<Object>} modelo lead actualizado
     */
    mark_followup_suggestion_seen(context, lead_id) {
      const commit = context.commit
      return api.post('/lead/' + lead_id + '/mark-followup-suggestion-seen').then((res) => {
        const model = res.data.model
        commit('update_lead_en_conversacion', model)
        // Refresca la fila en la tabla para que el badge amarillo de seguimiento desaparezca al instante.
        context.dispatch('upsert_model_in_lists', model)
        return model
      })
    },
    /**
     * GET totales de mensajes del lead sin leer (badge nav Leads).
     *
     * @param {Object} context
     * @returns {Promise<number>}
     */
    fetch_unread_badges(context) {
      const commit = context.commit
      return api.get('/lead/unread-badges').then((res) => {
        if (res.data && res.data.unread_total != null) {
          commit('set_unread_total', res.data.unread_total)
        }
        return context.state.unread_total
      })
    },
    /**
     * Marca leídos los mensajes entrantes del lead y refresca modelo.
     *
     * @param {Object} context
     * @param {number} lead_id
     * @returns {Promise<Object>}
     */
    mark_whatsapp_messages_read(context, lead_id) {
      const commit = context.commit
      const dispatch = context.dispatch
      return api.post('/lead/' + lead_id + '/mark-whatsapp-messages-read').then((res) => {
        const model = res.data.model
        commit('update_lead_en_conversacion', model)
        // Refresca la fila en la tabla con el unread_count y followup_count actualizados.
        dispatch('upsert_model_in_lists', model)
        return dispatch('fetch_unread_badges').then(function () {
          return model
        })
      })
    },
    /**
     * Lead completo con todos los mensajes (modal / conversación).
     *
     * @param {Object} context
     * @param {number|string} lead_id
     * @returns {Promise<Object>}
     */
    fetch_full_model(context, lead_id) {
      const commit = context.commit
      const state = context.state
      if (state._conversation_fetch_in_flight && state._conversation_fetch_in_flight == lead_id) {
        return Promise.resolve(state.lead_en_conversacion)
      }
      commit('set_conversation_fetch_in_flight', lead_id)
      return api
        .get('/lead/' + lead_id)
        .then(function (res) {
          /** Modelo con hilo completo y messages_scope = full. */
          const model = res.data && res.data.model ? res.data.model : null
          if (model) {
            commit('set_lead_en_conversacion', model)
          }
          commit('set_conversation_fetch_in_flight', null)
          return model
        })
        .catch(function (err) {
          commit('set_conversation_fetch_in_flight', null)
          return Promise.reject(err)
        })
    },
    /**
     * Carga lead completo con mensajes (conversación abierta tras evento sin message).
     *
     * @param {Object} context
     * @param {number|string} lead_id
     * @returns {Promise<Object>}
     */
    fetch_lead_for_conversation(context, lead_id) {
      return context.dispatch('fetch_full_model', lead_id)
    },
  },
})
