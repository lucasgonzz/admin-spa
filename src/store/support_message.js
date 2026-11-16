import api from '@/utils/axios'
import { keep_best_delivery, merge_status_payload, emoji_to_send, admin_reaction_of } from '@/utils/support_ticks'
import { remove_audio_draft } from '@/utils/support_audio_drafts'
import { support_scope, same_message, visible_support_messages, is_durable_support_message } from '@/utils/support_outbox'

// Las promesas no van en Vuex: el buzón conserva sólo datos del envío y el File original.
const outbox_results = new Map()
const outbox_preparation = new Map()
function result_key(entry) { return entry.scope + ':' + entry.key }
function complete_outbox(entry, model) {
  const resolve = outbox_results.get(result_key(entry))
  outbox_results.delete(result_key(entry))
  if (resolve) resolve(model)
}
function release_preview(entry) {
  if (entry.preview_url) URL.revokeObjectURL(entry.preview_url)
}

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
    active_owner_id: null,
    models: [],
    sending: false,
    outbox: [],
    composer_drafts: {},
    load_sequence: 0,
    /**
     * Carga de mensajes del ticket seleccionado (GET conversación).
     */
    messages_loading: false,
  },
  getters: {
    visible_messages(state, getters, rootState) {
      const admin = rootState.auth.admin
      if (String(state.active_owner_id) !== String(admin && admin.id)) return []
      return visible_support_messages(state.models, state.outbox, support_scope(admin && admin.id, state.active_ticket_id))
    },
  },
  mutations: {
    set_active_owner_id(state, id) { state.active_owner_id = id },
    set_composer_draft(state, { scope, draft }) {
      if (scope) state.composer_drafts[scope] = draft
    },
    enqueue_message(state, entry) { state.outbox.push(entry) },
    set_outbox_state(state, { entry, status, error }) {
      entry.status = status
      entry.processing = status === 'sending'
      entry.row._queue_status = status
      entry.row._delivery_error = error || null
    },
    finish_outbox_attempt(state, entry) { entry.processing = false },
    confirm_outbox(state, { entry, model }) {
      entry.model = keep_best_delivery(model, entry.model || {})
      entry.status = 'sent'
      entry.row._retry_attachment = null
      release_preview(entry)
      entry.preview_url = null
    },
    merge_loaded_models(state, messages) {
      for (const entry of state.outbox) {
        if (String(entry.owner_id) !== String(state.active_owner_id)) continue
        const confirmed = messages.find((row) => same_message(row, entry.model || entry.row))
        if (confirmed && is_durable_support_message(confirmed, entry.row.kind)) {
          entry.model = keep_best_delivery(confirmed, entry.model || {})
          entry.status = 'sent'
          release_preview(entry)
          entry.preview_url = null
        }
      }
      const rows = (messages || []).slice()
      for (const live of state.models) {
        const index = rows.findIndex((row) => same_message(row, live))
        if (index < 0) rows.push(live)
        else rows[index] = Object.assign({}, rows[index], keep_best_delivery(live, rows[index]))
      }
      state.models = rows
      // Sólo se limpia una confirmación cuando el GET ya trae esa misma identidad.
      state.outbox = state.outbox.filter((entry) => entry.processing || String(entry.owner_id) !== String(state.active_owner_id) || !entry.model || !messages.some((row) => same_message(row, entry.model)))
    },
    /**
     * Define ticket activo para cargar mensajes.
     */
    set_active_ticket_id(state, value) {
      state.active_ticket_id = value
      state.load_sequence += 1
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
     * Actualiza read_at desde evento SupportMessageRead.
     */
    patch_message_read(state, incoming) {
      for (const entry of state.outbox) {
        if (entry.model && String(entry.model.id) === String(incoming && incoming.id)) entry.model = { ...entry.model, read_at: incoming.read_at }
      }
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
      for (const entry of state.outbox) {
        if (entry.model && String(entry.model.id) === String(data.id)) entry.model = merge_status_payload(entry.model, data)
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
      const queued = state.outbox.find((entry) => String(entry.owner_id) === String(state.active_owner_id) && same_message(entry.model || entry.row, value))
      if (queued && is_durable_support_message(value, queued.row.kind)) {
        queued.model = keep_best_delivery(value, queued.model || {})
        queued.status = 'sent'
        release_preview(queued)
        queued.preview_url = null
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
     * Actualiza un mensaje persistido tras reintento de sync remoto.
     */
    patch_message(state, incoming) {
      for (const entry of state.outbox) {
        if (entry.model && same_message(entry.model, incoming)) entry.model = { ...entry.model, ...keep_best_delivery(incoming, entry.model) }
      }
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
    /** Recupera una burbuja privada sin reiniciar la conversación ni las filas optimistas. */
    load_private_message({ state, commit, rootState }, { id, support_ticket_id }) {
      const owner = rootState.auth.admin && rootState.auth.admin.id
      return api
        .get('/support-ticket/' + support_ticket_id)
        .then(function (response) {
          if (String(owner) !== String(rootState.auth.admin && rootState.auth.admin.id) || String(state.active_ticket_id) !== String(support_ticket_id)) {
            return null
          }
          const ticket = response.data.model
          const message = ticket && ticket.messages && ticket.messages.find((row) => String(row.id) === String(id))
          if (message) {
            commit('add_model', message)
          }
          return message
        })
        .catch(function (error) {
          console.log(error)
        })
    },
    /**
     * Carga conversación del ticket seleccionado.
     */
    load_ticket_messages({ state, commit, dispatch, rootState }, ticket_id) {
      commit('set_active_ticket_id', ticket_id)
      commit('set_active_owner_id', rootState.auth.admin && rootState.auth.admin.id)
      commit('set_models', [])
      commit('set_messages_loading', true)
      const sequence = state.load_sequence
      const owner = rootState.auth.admin && rootState.auth.admin.id
      const current = () => sequence === state.load_sequence && String(state.active_ticket_id) === String(ticket_id) && String(owner) === String(rootState.auth.admin && rootState.auth.admin.id)
      return api
        .get('/support-ticket/' + ticket_id)
        .then(function (response) {
          if (String(owner) !== String(rootState.auth.admin && rootState.auth.admin.id)) return
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
          /* Si el operador ya pasó a otro ticket, este hilo no se escribe: pisaría al que tiene
             abierto, y con el spinner apagado parecería el suyo. Con reintentos por throttle la
             respuesta puede llegar mucho después. Lo que sigue (fila de la bandeja, marcar leído)
             va igual: está atado a este ticket, y es justamente lo que busca el que pasa por los
             tickets para sacar los no leídos. */
          if (current()) {
            commit('merge_loaded_models', messages)
            commit('set_messages_loading', false)
          }
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
                return dispatch('support_ticket/schedule_unread_badges', null, { root: true })
              })
              .catch(function (err) {
                console.log(err)
                return dispatch('support_ticket/schedule_unread_badges', null, { root: true })
              })
          }
          return Promise.resolve()
        })
        .catch(function (error) {
          /* Mismo criterio que arriba: el error de un ticket que ya se dejó no apaga el spinner del vigente. */
          if (current()) {
            commit('set_messages_loading', false)
          }
          console.log(error)
        })
    },
    /**
     * Envía mensaje desde admin-spa con fila optimista.
     */
    send_message({ commit, state, dispatch, rootState }, payload) {
      const owner_id = rootState.auth.admin && rootState.auth.admin.id
      const ticket_id = payload.ticket_id || state.active_ticket_id
      const scope = support_scope(owner_id, ticket_id)
      if (!scope || (!String(payload.body || '').trim() && !payload.attachment)) return Promise.resolve(null)
      const key = payload.client_message_id || 'c' + Date.now() + '-' + Math.random().toString(36).slice(2)
      let entry = state.outbox.find((row) => row.scope === scope && row.key === key)
      if (entry) {
        if (entry.model) return Promise.resolve(entry.model)
        if (entry.status !== 'failed') return Promise.resolve(null)
        commit('set_outbox_state', { entry, status: 'queued' })
      } else {
        const file = payload.attachment || null
        const preview_url = file && URL.createObjectURL ? URL.createObjectURL(file) : null
        entry = {
          key, scope, owner_id, ticket_id, status: 'queued', processing: false, model: null, preview_url,
          row: {
            _client_pending: key, _queue_status: 'queued', _owner_id: owner_id,
            support_ticket_id: ticket_id, sender_type: 'admin', kind: payload.kind || 'text',
            body: String(payload.body || '').trim(), created_at: new Date().toISOString(),
            _retry_attachment: file, _retry_client_message_id: key,
            reply_to_message_id: payload.reply_to_message_id || null,
            reply_to_message: payload.reply_to_message || null,
            attachments: preview_url ? [{ id: key, public_url: preview_url, display_filename: file.name, mime: file.type }] : [],
          },
        }
        commit('enqueue_message', entry)
      }
      if (payload.prepared) outbox_preparation.set(result_key(entry), payload.prepared)
      if (payload.on_queued) payload.on_queued()
      const result = new Promise((resolve) => outbox_results.set(result_key(entry), resolve))
      dispatch('drain_outbox')
      return result
    },
    /** Un solo consumidor: Enter nunca descarta el siguiente mensaje ni adelanta un POST. */
    async drain_outbox({ commit, state, dispatch, rootState }) {
      if (state.sending) return
      commit('set_sending', true)
      try {
        let entry
        while ((entry = state.outbox.find((row) => row.status === 'queued'))) {
          const owner = rootState.auth.admin && rootState.auth.admin.id
          if (String(owner) !== String(entry.owner_id)) {
            commit('set_outbox_state', { entry, status: 'failed', error: 'session_changed' })
            complete_outbox(entry, null)
            continue
          }
          commit('set_outbox_state', { entry, status: 'sending' })
          const form = new FormData()
          form.append('body', entry.row.body)
          form.append('kind', entry.row.kind)
          form.append('client_message_id', entry.key)
          if (entry.row.reply_to_message_id) form.append('reply_to_message_id', entry.row.reply_to_message_id)
          if (entry.row._retry_attachment) form.append('attachment', entry.row._retry_attachment)
          try {
            const prepared = outbox_preparation.get(result_key(entry))
            outbox_preparation.delete(result_key(entry))
            if (prepared) await prepared
            // La preparación de un audio puede demorar: no heredar una sesión que cambió.
            if (String(entry.owner_id) !== String(rootState.auth.admin && rootState.auth.admin.id)) throw new Error('La sesión cambió antes de enviar.')
            const response = await api.post('/support-ticket/' + entry.ticket_id + '/message', form, {
              timeout: 60000, headers: { 'Content-Type': 'multipart/form-data' },
            })
            const model = response.data && response.data.model
            if (!is_durable_support_message(model, entry.row.kind)) {
              throw new Error('El servidor no confirmó el mensaje y su archivo.')
            }
            commit('confirm_outbox', { entry, model })
          } catch (error) {
            // Pusher puede confirmar antes que un POST termine con timeout. Ese eco es durable.
            if (!entry.model) commit('set_outbox_state', { entry, status: 'failed', error: String(entry.owner_id) === String(rootState.auth.admin && rootState.auth.admin.id) ? 'not_sent' : 'session_changed' })
          }
          commit('finish_outbox_attempt', entry)
          const model = entry.model
          if (model) {
            if (String(owner) === String(rootState.auth.admin && rootState.auth.admin.id)) {
              dispatch('support_ticket/apply_ticket_from_message', model, { root: true })
              commit('support_ticket/patch_ticket_ai_pending', { ticket_id: entry.ticket_id, ai_pending_suggestion: null, ai_suggestion_send_at: null }, { root: true })
            }
            if (entry.row.kind === 'audio') {
              remove_audio_draft(entry.key).catch(() => {})
              window.dispatchEvent(new CustomEvent('support-audio-confirmed', { detail: { id: entry.key, scope: entry.scope, model } }))
            }
          }
          complete_outbox(entry, model)
        }
      } finally {
        commit('set_sending', false)
      }
    },
    /** Un fallo conserva File, cita y clave: reintentar nunca crea otro mensaje en el servidor. */
    retry_send_message({ state, dispatch, rootState }, message) {
      const owner = rootState.auth.admin && rootState.auth.admin.id
      const scope = support_scope(owner, message.support_ticket_id)
      const entry = state.outbox.find((row) => row.scope === scope && row.key === message._client_pending)
      if (!entry || entry.status !== 'failed') return Promise.resolve(null)
      return dispatch('send_message', {
        ticket_id: entry.ticket_id, client_message_id: entry.key, body: entry.row.body,
        kind: entry.row.kind, attachment: entry.row._retry_attachment,
        reply_to_message_id: entry.row.reply_to_message_id, reply_to_message: entry.row.reply_to_message,
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
