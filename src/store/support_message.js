import api from '@/utils/axios'
import { keep_best_delivery, merge_status_payload, emoji_to_send, admin_reaction_of } from '@/utils/support_ticks'
import { remove_audio_draft } from '@/utils/support_audio_drafts'

/**
 * Cuántos ids entran en cada POST masivo de "marcar leído". El backend valida hasta 500 por
 * request; 200 deja margen y sigue siendo un solo pedido para cualquier hilo real.
 */
const MARK_READ_BULK_CHUNK = 200

/**
 * Marca leídos los mensajes entrantes de un hilo con un solo POST.
 *
 * Antes salía un `POST /support-message/{id}/mark-read` por cada mensaje sin leer: abrir un
 * ticket con 40 mensajes entrantes eran 40 requests, todas con el mismo efecto y todas contra un
 * servidor que atiende de a una.
 *
 * Si el endpoint masivo no existe (404/405 — el SPA y la API no llegan juntos a producción), se
 * cae al camino viejo de a uno, así ninguna de las dos mitades rompe sola.
 *
 * 🔴 Va con `silent_error_statuses` y no con `silent_error: true`: lo que hay que callar es el
 * 404/405 del sondeo, no cualquier error. Con el flag a secas, un 500 del bulk dejaba al operador
 * viendo el contador rebotar a cero y volver al número real, sin un solo aviso, y el ticket seguía
 * sin leer en el servidor — cuando con los POST de a uno sí salía el aviso.
 *
 * @param {Array<number>} ids Ids de los mensajes a marcar.
 * @returns {Promise}
 */
function mark_messages_read(ids) {
  const chunks = []
  let offset = 0
  while (offset < ids.length) {
    chunks.push(ids.slice(offset, offset + MARK_READ_BULK_CHUNK))
    offset = offset + MARK_READ_BULK_CHUNK
  }

  return Promise.all(
    chunks.map(function (chunk) {
      return api
        .post(
          '/support-message/mark-read-bulk',
          { ids: chunk },
          { silent_error_statuses: [404, 405] }
        )
        .catch(function (err) {
          const status = err && err.response ? err.response.status : null
          if (status !== 404 && status !== 405) {
            throw err
          }
          return Promise.all(
            chunk.map(function (id) {
              return api.post('/support-message/' + id + '/mark-read')
            })
          )
        })
    })
  )
}

export default {
  namespaced: true,
  /**
   * Estado de conversación activa de soporte.
   */
  state: {
    active_ticket_id: null,
    models: [],
    sending: false,
    /**
     * Carga de mensajes del ticket seleccionado (GET conversación).
     */
    messages_loading: false,
  },
  mutations: {
    /**
     * Define ticket activo para cargar mensajes.
     */
    set_active_ticket_id(state, value) {
      state.active_ticket_id = value
    },
    /**
     * Indicador de carga de la conversación (spinner en Conversation).
     */
    set_messages_loading(state, value) {
      state.messages_loading = value
    },
    /**
     * Reemplaza la lista completa de mensajes visibles.
     */
    set_models(state, value) {
      state.models = value || []
    },
    /**
     * Cola visual de envío antes de confirmar por API.
     */
    push_pending_message(state, value) {
      if (!value || !value._client_pending) {
        return
      }
      state.models.push(value)
    },
    /**
     * Elimina fila optimista si falla el envío.
     */
    remove_pending_message(state, client_key) {
      let i = state.models.length - 1
      while (i >= 0) {
        if (state.models[i]._client_pending === client_key) {
          state.models.splice(i, 1)
        }
        i = i - 1
      }
    },
    /**
     * Sustituye la fila optimista por el modelo persistido.
     */
    replace_pending_with_model(state, payload) {
      const client_key = payload.client_key
      const model = payload.model
      if (!model || model.id == null) {
        return
      }
      let idx = -1
      let j = 0
      for (j = 0; j < state.models.length; j = j + 1) {
        if (state.models[j]._client_pending === client_key) {
          idx = j
          break
        }
      }
      if (idx >= 0) {
        state.models.splice(idx, 1, model)
      } else {
        let exists = false
        state.models.forEach(function (existing) {
          if (existing.id == model.id) {
            exists = true
          }
        })
        if (!exists) {
          state.models.push(model)
        }
      }
    },
    /**
     * Actualiza read_at desde evento SupportMessageRead.
     */
    patch_message_read(state, incoming) {
      if (!incoming || incoming.id == null) {
        return
      }
      let k = 0
      for (k = 0; k < state.models.length; k = k + 1) {
        if (state.models[k].id == incoming.id) {
          const cur = state.models[k]
          const merged = Object.assign({}, cur, { read_at: incoming.read_at })
          state.models.splice(k, 1, merged)
          return
        }
      }
    },
    /**
     * Mezcla en el mensaje el evento `.support.message.status` (ticks de WhatsApp y, si el
     * servidor los manda en el mismo evento, los datos de la reacción del operador).
     *
     * Acepta el payload plano o envuelto en `message`. No retrocede un estado de entrega.
     *
     * @param {Object} state   Estado del módulo.
     * @param {Object} payload Payload del evento: { id, support_ticket_id, whatsapp_delivery_status, ... }
     */
    patch_message_status(state, payload) {
      const data = payload && payload.message ? payload.message : payload
      if (!data || data.id == null) {
        return
      }
      let k = 0
      for (k = 0; k < state.models.length; k = k + 1) {
        if (state.models[k].id == data.id) {
          state.models.splice(k, 1, merge_status_payload(state.models[k], data))
          return
        }
      }
    },
    /**
     * Agrega mensaje en tiempo real al final del listado.
     * Evita duplicados por id; al enviar, quita fila optimista coincidente.
     */
    add_model(state, value) {
      if (!value || value.id == null) {
        return
      }
      if (value.support_ticket_id) {
        let n = state.models.length - 1
        while (n >= 0) {
          const m = state.models[n]
          if (m._client_pending && m.support_ticket_id == value.support_ticket_id && m.body == value.body) {
            state.models.splice(n, 1)
          }
          n = n - 1
        }
      }
      let merge_idx = -1
      let idx_check = 0
      for (idx_check = 0; idx_check < state.models.length; idx_check = idx_check + 1) {
        if (state.models[idx_check].id == value.id) {
          merge_idx = idx_check
          break
        }
      }
      if (merge_idx >= 0) {
        /* El snapshot que llega puede ser más viejo que un tick que ya entró por el evento de
           estado: se conserva el mayor progreso de entrega. */
        state.models.splice(
          merge_idx,
          1,
          Object.assign({}, state.models[merge_idx], keep_best_delivery(value, state.models[merge_idx]))
        )
        return
      }
      state.models.push(value)
    },
    /**
     * Controla estado de envío del input.
     */
    set_sending(state, value) {
      state.sending = value
    },
    /**
     * Marca error de red/API local sobre la fila optimista (no enviado).
     */
    mark_pending_delivery_error(state, payload) {
      const client_key = payload.client_key
      const error_code = payload.error_code
      let idx = state.models.length - 1
      while (idx >= 0) {
        if (state.models[idx]._client_pending === client_key) {
          const merged = Object.assign({}, state.models[idx], {
            _delivery_error: error_code,
          })
          state.models.splice(idx, 1, merged)
          return
        }
        idx = idx - 1
      }
    },
    /**
     * Actualiza un mensaje persistido tras reintento de sync remoto.
     */
    patch_message(state, incoming) {
      if (!incoming || incoming.id == null) {
        return
      }
      let k = 0
      for (k = 0; k < state.models.length; k = k + 1) {
        if (state.models[k].id == incoming.id) {
          const merged = Object.assign({}, state.models[k], keep_best_delivery(incoming, state.models[k]))
          state.models.splice(k, 1, merged)
          return
        }
      }
    },
    /**
     * Quita un mensaje del hilo (borrador IA descartado vía Pusher).
     */
    remove_model_by_id(state, message_id) {
      if (message_id == null) {
        return
      }
      let idx = state.models.length - 1
      while (idx >= 0) {
        if (String(state.models[idx].id) === String(message_id)) {
          state.models.splice(idx, 1)
          return
        }
        idx = idx - 1
      }
    },
  },
  actions: {
    /**
     * Carga conversación del ticket seleccionado.
     */
    load_ticket_messages({ commit, dispatch }, ticket_id) {
      commit('set_active_ticket_id', ticket_id)
      commit('set_models', [])
      commit('set_messages_loading', true)
      return api
        .get('/support-ticket/' + ticket_id)
        .then(function (response) {
          let messages = []
          let ticket_row = null
          if (response.data.model) {
            if (response.data.model.messages) {
              messages = response.data.model.messages
            }
            /**
             * Alinea la fila lateral con el GET del hilo (status, nombre, etc.) sin volcar todos los mensajes al store de tickets.
             */
            ticket_row = Object.assign({}, response.data.model)
            delete ticket_row.messages
          }
          commit('set_models', messages)
          commit('set_messages_loading', false)
          if (ticket_row && ticket_row.id != null) {
            dispatch('support_ticket/apply_ticket_row', ticket_row, { root: true })
          }
          const unread_ids = []
          messages.forEach(function (message) {
            if (message.sender_type == 'user' && !message.read_at) {
              unread_ids.push(message.id)
            }
          })
          if (unread_ids.length) {
            dispatch(
              'support_ticket/patch_ticket_unread_count',
              { ticket_id: ticket_id, unread_messages_count: 0 },
              { root: true }
            )
            return mark_messages_read(unread_ids)
              .then(function () {
                return dispatch('support_ticket/fetch_unread_badges', null, { root: true })
              })
              .catch(function (err) {
                console.log(err)
                return dispatch('support_ticket/fetch_unread_badges', null, { root: true })
              })
          }
          return Promise.resolve()
        })
        .catch(function (error) {
          commit('set_messages_loading', false)
          console.log(error)
        })
    },
    /**
     * Envía mensaje desde admin-spa con fila optimista.
     */
    send_message({ commit, state, dispatch, rootState }, payload) {
      if (state.sending) return Promise.resolve(null)
      commit('set_sending', true)
      const ticket_id = payload.ticket_id || state.active_ticket_id
      const owner_id = rootState.auth.admin && rootState.auth.admin.id
      const client_key = payload.client_message_id || 'c' + String(Date.now()) + '-' + String(Math.random()).slice(2, 8)
      const body_text = (payload.body && String(payload.body).trim()) || ''
      const kind_val = payload.kind || 'text'
      commit('remove_pending_message', client_key)
      if (String(state.active_ticket_id) === String(ticket_id)) commit('push_pending_message', {
        _client_pending: client_key,
        support_ticket_id: ticket_id,
        sender_type: 'admin',
        kind: kind_val,
        body: body_text,
        _retry_attachment: payload.attachment || null,
        _retry_client_message_id: client_key,
      })
      const form_data = new FormData()
      form_data.append('body', payload.body || '')
      form_data.append('kind', kind_val)
      form_data.append('client_message_id', client_key)
      if (payload.attachment) {
        form_data.append('attachment', payload.attachment)
      }
      return api
        .post('/support-ticket/' + ticket_id + '/message', form_data, {
          timeout: 60000,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
        .then(function (response) {
          const model = response.data && response.data.model
          if (!model || model.id == null || (kind_val === 'audio' && !(model.attachments && model.attachments.length))) {
            throw new Error('El servidor no confirmó el archivo del mensaje.')
          }
          commit('set_sending', false)
          if (String(state.active_ticket_id) === String(ticket_id)) commit('replace_pending_with_model', { client_key: client_key, model: model })
          if (ticket_id != null) {
            commit(
              'support_ticket/patch_ticket_ai_pending',
              {
                ticket_id: ticket_id,
                ai_pending_suggestion: null,
                ai_suggestion_send_at: null,
              },
              { root: true }
            )
          }
          if (response.data && response.data.model) {
            dispatch('support_ticket/apply_ticket_from_message', response.data.model, { root: true })
          }
          if (kind_val === 'audio') {
            // También confirma el reintento de la fila optimista, que no pasa por el input.
            remove_audio_draft(client_key).catch(function () {})
            window.dispatchEvent(new CustomEvent('support-audio-confirmed', {
              detail: { id: client_key, scope: String(owner_id) + ':' + String(ticket_id), model: model },
            }))
          }
          return response.data.model
        })
        .catch(function (error) {
          commit('set_sending', false)
          commit('mark_pending_delivery_error', {
            client_key: client_key,
            error_code: 'not_sent',
          })
          console.log(error)
          return null
        })
    },
    /**
     * Reintenta POST cuando admin-api no recibió el mensaje (fallo de red).
     */
    retry_send_message({ commit, dispatch }, message) {
      const pending_key = message._client_pending
      if (pending_key) {
        commit('remove_pending_message', pending_key)
      }
      return dispatch('send_message', {
        ticket_id: message.support_ticket_id,
        client_message_id: message._retry_client_message_id || message._client_pending,
        body: message.body,
        kind: message.kind || 'text',
        attachment: message._retry_attachment || null,
      })
    },
    /**
     * Reintenta replicar el mensaje hacia el empresa-api del cliente.
     */
    retry_remote_sync({ commit }, message_or_id) {
      const id = typeof message_or_id === 'object' ? message_or_id.id : message_or_id
      return api
        .post('/support-message/' + id + '/retry-remote-sync')
        .then(function (res) {
          if (res.data && res.data.model) {
            commit('patch_message', res.data.model)
          }
        })
        .catch(function (err) {
          console.log(err)
        })
    },
    /**
     * Reacciona (o quita la reacción) a un mensaje del cliente por WhatsApp.
     *
     * POST /support-message/{id}/reaction con { emoji }. Elegir el mismo emoji que ya está puesto
     * lo quita (`emoji: null`). Si sale bien, el mensaje del store se reemplaza por el `model`
     * de la respuesta. El 422 (ventana de 24 h cerrada, mensaje que no admite reacción) lo avisa
     * el interceptor de axios con el `error` de la respuesta; el 404/405 (API vieja sin el
     * endpoint) se silencia ahí y se avisa acá con un texto propio.
     *
     * Nunca rechaza: devuelve el modelo actualizado o null si no se pudo.
     *
     * @param {Object} contexto Contexto Vuex.
     * @param {Object} payload  { message: mensaje del hilo, emoji: emoji elegido }
     * @returns {Promise<Object|null>}
     */
    react_to_message({ commit }, payload) {
      const message = payload && payload.message
      if (!message || message.id == null) {
        return Promise.resolve(null)
      }
      const emoji = emoji_to_send(admin_reaction_of(message), payload.emoji)
      return api
        .post(
          '/support-message/' + message.id + '/reaction',
          { emoji: emoji },
          { silent_error_statuses: [404, 405] }
        )
        .then(function (response) {
          const model = response.data && response.data.model
          if (model) {
            commit('patch_message', model)
          }
          return model || null
        })
        .catch(function (error) {
          const status = error && error.response ? error.response.status : null
          if (status === 404 || status === 405) {
            window.dispatchEvent(
              new CustomEvent('admin-spa-toast', {
                detail: {
                  message: 'Este servidor todavía no permite reaccionar a los mensajes.',
                  variant: 'warning',
                },
              })
            )
          }
          return null
        })
    },
    /**
     * Typing desactivado: no se llama al API de soporte (no persistir “escribiendo”).
     */
    send_typing() {
      return Promise.resolve()
    },
  },
}
