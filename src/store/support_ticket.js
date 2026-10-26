import __base_store from '@/common-vue/store/__base_store'
import api from '@/utils/axios'
import { run_once } from '@/common-vue/helpers/request_cache_helper'
import { keep_best_delivery, merge_status_payload, payload_matches_message, unread_total_from_response } from '@/utils/support_ticks'

/** Los eventos públicos no llevan el resumen privado de atención: se refresca por HTTP autenticado. */
let attention_refresh_timer = null

/**
 * Pide los contadores de la bandeja y los vuelca al store. Nunca rechaza.
 *
 * Va por `run_once` con la clave del GET: dos llamadores en el mismo tick comparten la request.
 * Sin ventana de frescura a propósito — lo único que se deduplica es lo simultáneo.
 *
 * @param {Function} commit Committer del módulo.
 * @param {boolean} [force] Pedir de nuevo aunque haya un GET en vuelo.
 * @returns {Promise}
 */
function pedir_unread_badges(commit, force) {
  return run_once(
    'GET /support-ticket/unread-badges',
    function (sigue_vigente) {
      return api.get('/support-ticket/unread-badges').then(function (response) {
        /* Si un `force` salió después y ya volvió, esta respuesta es la de antes del evento. */
        if (!sigue_vigente()) {
          return
        }
        if (response.data && response.data.unread_totals) {
          commit('set_unread_totals', response.data.unread_totals)
        }
        /* Total de no leídos de TODA la bandeja (sin operadores): `unread_total` de la API nueva,
           o la suma de `unread_totals` si la API es vieja. */
        commit('set_unread_total', unread_total_from_response(response.data))
        if (response.data && response.data.inbox_nav) {
          commit('set_inbox_nav', response.data.inbox_nav)
        }
        /* Opcional: una API vieja no lo manda y los badges siguen con no leídos. */
        if (response.data && response.data.open_totals) {
          commit('set_open_totals', response.data.open_totals)
        }
      })
    },
    { force: force === true }
    /* El catch va acá afuera y no adentro del runner a propósito: si fuera adentro, `run_once`
       vería una promesa resuelta y daría por bueno un pedido que falló, dejando el valor fallido
       cacheado en la entrada. Acá adentro el error sigue invalidando la entrada, y para el
       llamador la acción sigue sin rechazar, como antes. */
  ).catch(function (error) {
    console.log(error)
  })
}

/**
 * Resuelve status operativo al fusionar filas de bandeja (index, PUT, Pusher).
 * Evita perder `closed` cuando llega un ticket parcial o un mensaje serializado antes del cierre.
 *
 * @param {Object|null|undefined} prev Ticket previo en Vuex
 * @param {Object|null|undefined} incoming Ticket del evento o respuesta API
 * @returns {'open'|'closed'}
 */
function support_ticket_resolve_status(prev, incoming) {
  const prev_status = prev && prev.status ? String(prev.status) : ''
  const incoming_status = incoming && incoming.status ? String(incoming.status) : ''
  const prev_closed = prev_status === 'closed' || !!(prev && prev.closed_at)
  const incoming_closed = incoming_status === 'closed' || !!(incoming && incoming.closed_at)

  if (prev_closed || incoming_closed) {
    return 'closed'
  }
  if (incoming_status === 'open' || incoming_status === 'closed') {
    return incoming_status
  }
  if (prev_status === 'open' || prev_status === 'closed') {
    return prev_status
  }
  return 'open'
}

export default __base_store({
  /**
   * Estado principal de tickets de soporte.
   */
  state: {
    model_name: 'support_ticket',
    use_per_page: false,
    /**
     * Filtro de bandeja hacia admin-api. Desde que los tickets no pertenecen a un operador es
     * SIEMPRE 'all' (la API nueva ignora el parámetro; la vieja lo respeta, y 'all' es lo que
     * se quiere). Se conserva como estado para no tocar a los que lo leen.
     */
    assigned_filter: 'all',
    /**
     * No leídos agregados por filtro (compat con la API vieja); se actualiza con listado o GET ligero.
     */
    unread_totals: { mine: 0, others: 0 },
    /**
     * Total de mensajes del cliente sin leer en toda la bandeja (contador de "Todos" y del Nav).
     * Sale de `unread_total` o, con una API vieja, de `unread_totals.mine + .others`.
     */
    unread_total: 0,
    /**
     * Tickets abiertos (status open) para los badges: { all, mine, unassigned }.
     * Queda en null mientras la API no lo mande (API vieja): los badges caen a no leídos.
     */
    open_totals: null,
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
     * Total de no leídos de toda la bandeja. Un valor nulo (respuesta sin datos de no leídos)
     * deja el que ya había, para que un GET parcial no ponga el contador en cero.
     */
    set_unread_total(state, value) {
      if (value === null || value === undefined) {
        return
      }
      const parsed = parseInt(value, 10)
      state.unread_total = isNaN(parsed) || parsed < 0 ? 0 : parsed
    },
    /**
     * Totales de tickets abiertos (API index o /support-ticket/unread-badges).
     */
    set_open_totals(state, value) {
      if (!value || typeof value !== 'object') {
        return
      }
      const all = parseInt(value.all, 10)
      const mine = parseInt(value.mine, 10)
      const unassigned = parseInt(value.unassigned, 10)
      state.open_totals = {
        all: isNaN(all) ? 0 : all,
        mine: isNaN(mine) ? 0 : mine,
        unassigned: isNaN(unassigned) ? 0 : unassigned,
      }
    },
    /**
     * Guarda el filtro de asignación. Ya no hay filtro por operador: cualquier valor (incluido
     * un 'mine' que hubiera quedado de la versión anterior) se normaliza a 'all'.
     */
    set_assigned_filter(state) {
      state.assigned_filter = 'all'
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
     * Mezcla un evento de estado de entrega (`.support.message.status`) en el `last_message` del
     * ticket, si ese es el mensaje que el evento nombra. No reordena la lista ni toca
     * `updated_at`: un tick no es actividad nueva.
     *
     * @param {Object} state   Estado del módulo.
     * @param {Object} payload Payload del evento: { id, support_ticket_id, whatsapp_delivery_status, ... }
     */
    patch_last_message_status(state, payload) {
      if (!payload || payload.support_ticket_id == null) {
        return
      }
      let i = 0
      for (i = 0; i < state.models.length; i = i + 1) {
        const ticket = state.models[i]
        if (String(ticket.id) !== String(payload.support_ticket_id)) {
          continue
        }
        if (!payload_matches_message(ticket.last_message, payload)) {
          return
        }
        const merged = Object.assign({}, ticket, {
          last_message: merge_status_payload(ticket.last_message, payload),
        })
        state.models.splice(i, 1, merged)
        return
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
        // null en un evento significa «no precargado», no «sin misión». Una respuesta
        // autenticada con { needs_human:false, mission:null } sí reemplaza el resumen.
        if (ticket.support_attention == null && prev.support_attention) {
          merged.support_attention = prev.support_attention
        }
        /**
         * Algunos broadcasts (p. ej. sólo cabecera) no incluyen last_message; conserva preview previo.
         */
        if (!ticket.last_message && prev.last_message) {
          merged.last_message = prev.last_message
        } else if (ticket.last_message && prev.last_message && payload_matches_message(prev.last_message, ticket.last_message)) {
          /* Mismo mensaje que ya teníamos: un snapshot más viejo (sin tick o con uno anterior) no
             tiene que resetear el estado de entrega que ya llegó por el evento en vivo. */
          merged.last_message = keep_best_delivery(ticket.last_message, prev.last_message)
        }
        /**
         * Payloads parciales o mensajes Pusher serializados antes del cierre no deben
         * borrar status ni revertir closed → open en la bandeja.
         */
        merged.status = support_ticket_resolve_status(prev, ticket)
        if (!merged.closed_at && prev.closed_at) {
          merged.closed_at = prev.closed_at
        }
        state.models.splice(idx, 1, merged)
      } else {
        const normalized = Object.assign({}, ticket)
        normalized.status = support_ticket_resolve_status(null, ticket)
        state.models.push(normalized)
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
    get_models({ commit }) {
      commit('set_loading', true)
      /* Siempre 'all': los tickets ya no son de un operador. El parámetro se sigue mandando por
         si el servidor es una API vieja, que por defecto filtraba por "míos". */
      return api
        .get('/support-ticket?assigned_filter=all')
        .then(function (response) {
          commit('set_loading', false)
          commit('set_models', response.data.models || [])
          if (response.data.unread_totals) {
            commit('set_unread_totals', response.data.unread_totals)
          }
          commit('set_unread_total', unread_total_from_response(response.data))
          if (response.data.inbox_nav) {
            commit('set_inbox_nav', response.data.inbox_nav)
          }
          if (response.data.open_totals) {
            commit('set_open_totals', response.data.open_totals)
          }
        })
        .catch(function (error) {
          commit('set_loading', false)
          console.log(error)
        })
    },
    /**
     * Refresca solo contadores de badges (Pusher o tras marcar leído).
     *
     * Va con `force`: los dos que lo llaman ya saben que el número cambió, así que engancharse a
     * un GET en vuelo —que pudo salir antes del evento— traería el número viejo.
     */
    fetch_unread_badges({ commit }) {
      return pedir_unread_badges(commit, true)
    },
    /**
     * Igual que `fetch_unread_badges`, pero se engancha al GET que ya esté en vuelo en vez de
     * abrir uno propio. Lo usa el Nav, que se desmonta y se remonta al entrar y salir de la
     * conversación de un lead (ver el comentario largo en `lead.js`).
     *
     * 🔴 Sin ventana de frescura: mientras el Nav está desmontado su socket está caído, y el GET
     * del remonte es lo único que recupera lo que entró en el medio.
     */
    ensure_unread_badges_fresh({ commit }) {
      return pedir_unread_badges(commit)
    },
    /**
     * Expone mutación de contador no leídos en un ticket (llamada desde módulo support_message).
     */
    patch_ticket_unread_count({ commit }, payload) {
      commit('patch_ticket_unread_count', payload)
    },
    /**
     * Fusiona un SupportTicket (objeto) en la bandeja.
     *
     * Antes se descartaba el ticket si no cumplía el filtro "míos / otros / sin asignar". Ya no
     * hay filtro por operador: todo ticket entra a la bandeja, tenga o no tenga operador.
     */
    apply_ticket_row({ commit, dispatch }, ticket) {
      if (!ticket || !ticket.id) {
        return
      }
      // El evento público no trae el resumen privado de atención: se refresca por HTTP autenticado.
      if (ticket.support_attention == null) {
        dispatch('schedule_attention_refresh')
      }
      commit('upsert_from_broadcast', ticket)
    },
    /**
     * Aplica un evento `.support.message.status` (ticks de WhatsApp) a la fila de la bandeja.
     *
     * Acepta el payload plano ({ id, support_ticket_id, ... }) o envuelto en `message`.
     *
     * @param {Object} contexto Contexto Vuex.
     * @param {Object} event_data Payload del evento.
     */
    apply_message_status({ commit }, event_data) {
      const payload = event_data && event_data.message ? event_data.message : event_data
      if (!payload) {
        return
      }
      commit('patch_last_message_status', payload)
    },
    /** Agrupa mensajes/lecturas parciales y trae el resumen vigente sin agregarlo al canal público. */
    schedule_attention_refresh({ dispatch }) {
      if (attention_refresh_timer) {
        clearTimeout(attention_refresh_timer)
      }
      attention_refresh_timer = setTimeout(function () {
        attention_refresh_timer = null
        dispatch('get_models')
      }, 800)
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
        sender_admin_id: message.sender_admin_id,
        created_at: message.created_at,
        /* Campos para los ticks de la fila (solo mensajes salientes de WhatsApp). */
        whatsapp_message_id: message.whatsapp_message_id,
        whatsapp_delivery_status: message.whatsapp_delivery_status,
        whatsapp_delivered_at: message.whatsapp_delivered_at,
        whatsapp_seen_at: message.whatsapp_seen_at,
        last_send_error: message.last_send_error,
      }
      return dispatch('apply_ticket_row', ticket)
    },
    /**
     * Actualiza ticket en servidor; fusiona en lista local sin re-fetch.
     */
    update_ticket({ dispatch }, payload) {
      return api.put('/support-ticket/' + payload.id, payload).then(function (response) {
        /* Cerrar, reabrir o reasignar cambia los badges de tickets abiertos: se refrescan acá
           sin esperar el SupportTicketUpdated de Pusher (que puede no estar configurado). */
        dispatch('fetch_unread_badges')
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
        /* El alta por ERP no emite ningún evento de Pusher: el ticket abierto nuevo se suma
           a los badges refrescándolos acá. */
        dispatch('fetch_unread_badges')
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
    /**
     * Contactos de WhatsApp del cliente con el estado de la ventana de 24hs de cada uno.
     *
     * @param {Object} contexto Contexto Vuex (sin uso; el resultado no toca el estado).
     * @param {number} client_id Id del cliente.
     * @returns {Promise<Object>} { contacts, template_name }
     */
    fetch_whatsapp_contacts(contexto, client_id) {
      return api
        .get('/support-ticket/whatsapp-contacts', { params: { client_id: client_id } })
        .then(function (response) {
          return response.data || { contacts: [], template_name: '' }
        })
    },
    /**
     * Abre una conversación de soporte por WhatsApp.
     *
     * Se separa de store() a propósito: devuelve el resultado del envío además del ticket,
     * y store() ya está consumida por el alta del canal ERP con otro valor de retorno.
     *
     * @param {Object} contexto Contexto Vuex con dispatch.
     * @param {Object} payload  client_id, whatsapp_phone y, según si la ventana de 24hs del
     *   contacto está abierta o cerrada, `body` (texto libre) O `client_template_id` +
     *   `variables` (plantilla elegida). La action es agnóstica del payload: lo manda tal cual.
     * @returns {Promise<Object>} { model, whatsapp, reused }
     */
    store_whatsapp({ dispatch }, payload) {
      const cuerpo = Object.assign({}, payload, { source: 'whatsapp' })
      return api.post('/support-ticket', cuerpo).then(function (response) {
        /* Ticket abierto nuevo (o reutilizado): los badges de abiertos se refrescan acá. */
        dispatch('fetch_unread_badges')
        const data = response.data || {}
        const m = data.model
        if (m) {
          return dispatch('apply_ticket_row', m).then(function () {
            return data
          })
        }
        return dispatch('get_models').then(function () {
          return data
        })
      })
    },
  },
})

