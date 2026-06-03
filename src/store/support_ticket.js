import __base_store from '@/common-vue/store/__base_store'
import api from '@/utils/axios'

export default __base_store({
  /**
   * Estado principal de tickets de soporte.
   */
  state: {
    model_name: 'support_ticket',
    use_per_page: false,
    /**
     * Filtro de bandeja hacia admin-api: mine | all | unassigned | others (legacy) | id admin como string.
     */
    assigned_filter: 'mine',
    /**
     * No leídos agregados por filtro (badges globales nav); se actualiza con listado o GET ligero.
     */
    unread_totals: { mine: 0, others: 0 },
    /**
     * Botones por operador + Sin asignar (nombre y unread_count por fila).
     */
    inbox_nav: [],
  },
  mutations: {
    /**
     * Totales de mensajes user sin leer (API index o /support-ticket/unread-badges).
     */
    set_unread_totals(state, value) {
      if (!value || typeof value !== 'object') {
        return
      }
      const mine = parseInt(value.mine, 10)
      const others = parseInt(value.others, 10)
      state.unread_totals = {
        mine: isNaN(mine) ? 0 : mine,
        others: isNaN(others) ? 0 : others,
      }
    },
    /**
     * Guarda filtro de asignación activo (menú lateral por operador).
     */
    set_assigned_filter(state, value) {
      state.assigned_filter = value
    },
    /**
     * Actualiza filas del menú lateral devueltas por index / unread-badges.
     */
    set_inbox_nav(state, value) {
      state.inbox_nav = Array.isArray(value) ? value : []
    },
    /**
     * Quita un ticket de la lista (p. ej. al dejar de cumplir el filtro con datos en tiempo real).
     */
    remove_ticket_by_id(state, id) {
      if (id == null) {
        return
      }
      state.models = state.models.filter(function (m) {
        return m.id != id
      })
    },
    /**
     * Ajusta solo el contador de no leídos de un ticket (p. ej. tras marcar leídos al abrir el hilo).
     */
    patch_ticket_unread_count(state, payload) {
      if (!payload || payload.ticket_id == null) {
        return
      }
      const tid = payload.ticket_id
      const count = payload.unread_messages_count
      let i = 0
      for (i = 0; i < state.models.length; i = i + 1) {
        if (String(state.models[i].id) === String(tid)) {
          const merged = Object.assign({}, state.models[i], {
            unread_messages_count: count,
          })
          state.models.splice(i, 1, merged)
          return
        }
      }
    },
    /**
     * Actualiza sugerencia IA pendiente y hora de envío automático en la fila del ticket.
     */
    patch_ticket_ai_pending(state, payload) {
      if (!payload || payload.ticket_id == null) {
        return
      }
      const tid = payload.ticket_id
      let i = 0
      for (i = 0; i < state.models.length; i = i + 1) {
        if (String(state.models[i].id) === String(tid)) {
          const merged = Object.assign({}, state.models[i], {
            ai_pending_suggestion: payload.ai_pending_suggestion || null,
            ai_suggestion_send_at: payload.ai_suggestion_send_at || null,
          })
          state.models.splice(i, 1, merged)
          return
        }
      }
    },
    /**
     * Inserta o reordena un ticket a partir de eventos o respuestas API.
     */
    upsert_from_broadcast(state, ticket) {
      if (!ticket || !ticket.id) {
        return
      }
      const tid = ticket.id
      let idx = -1
      let i = 0
      for (i = 0; i < state.models.length; i = i + 1) {
        if (state.models[i].id == tid) {
          idx = i
          break
        }
      }
      if (idx >= 0) {
        const prev = state.models[idx]
        const merged = Object.assign({}, prev, ticket)
        /**
         * Algunos broadcasts (p. ej. sólo cabecera) no incluyen last_message; conserva preview previo.
         */
        if (!ticket.last_message && prev.last_message) {
          merged.last_message = prev.last_message
        }
        state.models.splice(idx, 1, merged)
      } else {
        state.models.push(ticket)
      }
      const sorted = state.models.slice().sort(function (a, b) {
        const da = a.updated_at ? new Date(a.updated_at).getTime() : 0
        const db = b.updated_at ? new Date(b.updated_at).getTime() : 0
        return db - da
      })
      state.models = sorted
    },
  },
  actions: {
    /**
     * Carga tickets aplicando filtro (HTTP sólo al abrir panel o al cambiar filtro).
     */
    get_models({ commit, state }) {
      commit('set_loading', true)
      const af = state.assigned_filter != null && state.assigned_filter !== '' ? state.assigned_filter : 'mine'
      return api
        .get('/support-ticket?assigned_filter=' + encodeURIComponent(String(af)))
        .then(function (response) {
          commit('set_loading', false)
          commit('set_models', response.data.models || [])
          if (response.data.unread_totals) {
            commit('set_unread_totals', response.data.unread_totals)
          }
          if (response.data.inbox_nav) {
            commit('set_inbox_nav', response.data.inbox_nav)
          }
        })
        .catch(function (error) {
          commit('set_loading', false)
          console.log(error)
        })
    },
    /**
     * Refresca solo contadores de badges (Pusher o tras marcar leído).
     */
    fetch_unread_badges({ commit }) {
      return api
        .get('/support-ticket/unread-badges')
        .then(function (response) {
          if (response.data && response.data.unread_totals) {
            commit('set_unread_totals', response.data.unread_totals)
          }
          if (response.data && response.data.inbox_nav) {
            commit('set_inbox_nav', response.data.inbox_nav)
          }
        })
        .catch(function (error) {
          console.log(error)
        })
    },
    /**
     * Expone mutación de contador no leídos en un ticket (llamada desde módulo support_message).
     */
    patch_ticket_unread_count({ commit }, payload) {
      commit('patch_ticket_unread_count', payload)
    },
    /**
     * Fusiona un SupportTicket (objeto) en la bandeja respetando filtro míos/otros/todos.
     */
    apply_ticket_row({ commit, state, rootState }, ticket) {
      if (!ticket || !ticket.id) {
        return
      }
      const t = ticket
      const me = rootState.auth && rootState.auth.admin && rootState.auth.admin.id
      const f = state.assigned_filter || 'mine'
      if (f === 'all') {
        commit('upsert_from_broadcast', t)
        return
      }
      if (f === 'mine' && me != null) {
        if (t.assigned_admin_id == null || String(t.assigned_admin_id) !== String(me)) {
          commit('remove_ticket_by_id', t.id)
          return
        }
        commit('upsert_from_broadcast', t)
        return
      }
      if (f === 'others' && me != null) {
        if (t.assigned_admin_id != null && String(t.assigned_admin_id) === String(me)) {
          commit('remove_ticket_by_id', t.id)
          return
        }
        commit('upsert_from_broadcast', t)
        return
      }
      if (f === 'unassigned') {
        if (t.assigned_admin_id != null) {
          commit('remove_ticket_by_id', t.id)
          return
        }
        commit('upsert_from_broadcast', t)
        return
      }
      if (/^\d+$/.test(String(f))) {
        if (String(t.assigned_admin_id) !== String(f)) {
          commit('remove_ticket_by_id', t.id)
          return
        }
        commit('upsert_from_broadcast', t)
        return
      }
      commit('upsert_from_broadcast', t)
    },
    /**
     * Desde un SupportMessage (Pusher) con relación ticket embebida.
     */
    apply_ticket_from_message({ dispatch }, message) {
      if (!message || !message.ticket) {
        return
      }
      const ticket = Object.assign({}, message.ticket)
      /**
       * El payload del mensaje es el último evento; fija preview de bandeja aunque el ticket venga con muchas relaciones.
       */
      ticket.last_message = {
        id: message.id,
        body: message.body,
        kind: message.kind,
        sender_type: message.sender_type,
        sender_admin: message.sender_admin,
        created_at: message.created_at,
      }
      return dispatch('apply_ticket_row', ticket)
    },
    /**
     * Actualiza ticket en servidor; fusiona en lista local sin re-fetch.
     */
    update_ticket({ dispatch }, payload) {
      return api.put('/support-ticket/' + payload.id, payload).then(function (response) {
        if (response.data && response.data.model) {
          return dispatch('apply_ticket_row', response.data.model).then(function () {
            return response.data.model
          })
        }
        return dispatch('get_models').then(function () {
          return null
        })
      })
    },
    /**
     * Crea ticket y añade/ajusta en lista vía el modelo devuelto.
     */
    store({ dispatch }, payload) {
      return api.post('/support-ticket', payload).then(function (response) {
        const m = response.data && response.data.model
        if (m) {
          return dispatch('apply_ticket_row', m).then(function () {
            return m
          })
        }
        return dispatch('get_models').then(function () {
          return m
        })
      })
    },
  },
})

