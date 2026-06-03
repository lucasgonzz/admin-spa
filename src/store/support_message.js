import api from '@/utils/axios'

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
        state.models.splice(merge_idx, 1, Object.assign({}, state.models[merge_idx], value))
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
          const merged = Object.assign({}, state.models[k], incoming)
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
          if (response.data.model && response.data.model.messages) {
            messages = response.data.model.messages
          }
          commit('set_models', messages)
          commit('set_messages_loading', false)
          const mark_promises = []
          messages.forEach(function (message) {
            if (message.sender_type == 'user' && !message.read_at) {
              mark_promises.push(api.post('/support-message/' + message.id + '/mark-read'))
            }
          })
          if (mark_promises.length) {
            dispatch(
              'support_ticket/patch_ticket_unread_count',
              { ticket_id: ticket_id, unread_messages_count: 0 },
              { root: true }
            )
            return Promise.all(mark_promises)
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
    send_message({ commit, state, dispatch }, payload) {
      commit('set_sending', true)
      const client_key = 'c' + String(Date.now()) + '-' + String(Math.random()).slice(2, 8)
      const body_text = (payload.body && String(payload.body).trim()) || ''
      const kind_val = payload.kind || 'text'
      commit('push_pending_message', {
        _client_pending: client_key,
        support_ticket_id: state.active_ticket_id,
        sender_type: 'admin',
        kind: kind_val,
        body: body_text,
        _retry_attachment: payload.attachment || null,
      })
      const form_data = new FormData()
      form_data.append('body', payload.body || '')
      form_data.append('kind', kind_val)
      if (payload.attachment) {
        form_data.append('attachment', payload.attachment)
      }
      return api
        .post('/support-ticket/' + state.active_ticket_id + '/message', form_data, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
        .then(function (response) {
          commit('set_sending', false)
          commit('replace_pending_with_model', { client_key: client_key, model: response.data.model })
          if (state.active_ticket_id != null) {
            commit(
              'support_ticket/patch_ticket_ai_pending',
              {
                ticket_id: state.active_ticket_id,
                ai_pending_suggestion: null,
                ai_suggestion_send_at: null,
              },
              { root: true }
            )
          }
          if (response.data && response.data.model) {
            dispatch('support_ticket/apply_ticket_from_message', response.data.model, { root: true })
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
     * Typing desactivado: no se llama al API de soporte (no persistir “escribiendo”).
     */
    send_typing() {
      return Promise.resolve()
    },
  },
}
