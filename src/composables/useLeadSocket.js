import store from '@/store'
import api from '@/utils/axios'

/**
 * Suscripción Pusher al canal compartido `leads.admins`.
 *
 * Eventos:
 *  - LeadSuggestionCreated: flags de sugerencia IA / recordatorio demo.
 *  - LeadConversationUpdated: mensajes nuevos, no leídos y conversación en tiempo real.
 *  - LeadAiSuggestionGenerating / LeadAiSuggestionFinished: spinner del botón de sugerencia IA.
 *
 * @param {Object} options
 * @param {number|string} options.admin_id Id del operador autenticado.
 * @returns {{ disconnect: Function }}
 */
export function useLeadSocket(options) {
  const admin_id = options.admin_id
  const echo = window.admin_support_echo
  const channels_to_leave = []
  let unread_badges_debounce_timer = null
  let conversation_refetch_debounce_timer = null
  let list_row_refetch_debounce_timer = null
  /** Debounce del POST mark-whatsapp-messages-read mientras el operador mira el hilo. */
  let mark_read_if_viewing_debounce_timer = null

  /**
   * true si el admin tiene visible la conversación WhatsApp del lead indicado.
   *
   * @param {number|string|null|undefined} lead_id
   * @returns {boolean}
   */
  function is_viewing_lead_conversation(lead_id) {
    if (lead_id == null || lead_id === '') {
      return false
    }
    const visible_id = store.state.lead.lead_conversation_visible_id
    if (visible_id == null || visible_id === '') {
      return false
    }
    return String(visible_id) === String(lead_id)
  }

  /**
   * Marca leídos los mensajes del lead si el operador está viendo su conversación (evita badges falsos).
   *
   * @param {number|string} lead_id
   * @returns {void}
   */
  function schedule_mark_read_if_viewing(lead_id) {
    if (!is_viewing_lead_conversation(lead_id)) {
      return
    }
    // Si ya hay un POST en vuelo, no acumular otro
    if (store.state.lead._mark_read_in_flight != null) {
      return
    }
    if (mark_read_if_viewing_debounce_timer) {
      clearTimeout(mark_read_if_viewing_debounce_timer)
    }
    mark_read_if_viewing_debounce_timer = setTimeout(function () {
      mark_read_if_viewing_debounce_timer = null
      // Re-verificar flag al momento de ejecutar (puede haber cambiado durante el debounce)
      if (store.state.lead._mark_read_in_flight != null) {
        return
      }
      store.dispatch('lead/mark_whatsapp_messages_read', lead_id).catch(function () {
        return null
      })
    }, 250)
  }

  /**
   * GET /lead/{id} con debounce para actualizar unread_count en la grilla (payload Pusher mínimo).
   *
   * @param {number|string} lead_id
   * @returns {void}
   */
  function schedule_list_row_refetch(lead_id) {
    if (list_row_refetch_debounce_timer) {
      clearTimeout(list_row_refetch_debounce_timer)
    }
    list_row_refetch_debounce_timer = setTimeout(function () {
      list_row_refetch_debounce_timer = null
      api.get('/lead/' + lead_id).then(function (res) {
        const model = res.data && res.data.model ? res.data.model : null
        if (model && model.id) {
          store.dispatch('lead/upsert_model_in_lists', model)
        }
      }).catch(function () {
        return null
      })
    }, 800)
  }

  /**
   * GET /lead/{id} con debounce para no disparar 429 (throttle Laravel).
   *
   * @param {number|string} lead_id
   * @returns {void}
   */
  function schedule_conversation_refetch(lead_id) {
    if (conversation_refetch_debounce_timer) {
      clearTimeout(conversation_refetch_debounce_timer)
    }
    conversation_refetch_debounce_timer = setTimeout(function () {
      conversation_refetch_debounce_timer = null
      const conv = store.state.lead.lead_en_conversacion
      if (conv && conv.id == lead_id) {
        store.dispatch('lead/fetch_lead_for_conversation', lead_id)
      }
    }, 1200)
  }

  /**
   * Programa GET /lead/unread-badges para el badge del menú.
   */
  function schedule_refresh_unread_badges() {
    if (unread_badges_debounce_timer) {
      clearTimeout(unread_badges_debounce_timer)
    }
    unread_badges_debounce_timer = setTimeout(function () {
      unread_badges_debounce_timer = null
      store.dispatch('lead/fetch_unread_badges')
    }, 450)
  }

  /**
   * Fusiona lead en tabla y conversación abierta.
   *
   * @param {Object|null} lead
   * @returns {void}
   */
  function apply_lead_row(lead) {
    if (!lead || !lead.id) {
      return
    }
    store.dispatch('lead/upsert_model_in_lists', lead)
    store.commit('lead/update_lead_en_conversacion', lead)
  }

  /**
   * @param {Object} event_data
   * @returns {void}
   */
  function handle_suggestion_created(event_data) {
    apply_lead_row(event_data ? event_data.lead : null)
    if (event_data && event_data.lead && event_data.lead.id != null) {
      const generating_id = store.state.lead.ai_generating_lead_id
      if (generating_id != null && String(generating_id) === String(event_data.lead.id)) {
        store.commit('lead/set_ai_generating_lead_id', null)
      }
    }
  }

  /**
   * Claude empezó a generar sugerencia para un lead (job automático o pedido manual en otra pestaña).
   *
   * @param {Object} event_data
   * @returns {void}
   */
  function handle_ai_suggestion_generating(event_data) {
    if (!event_data || event_data.lead_id == null) {
      return
    }
    store.commit('lead/set_ai_generating_lead_id', event_data.lead_id)
  }

  /**
   * Finalizó la consulta a Claude (éxito, error o sugerencia descartada).
   *
   * @param {Object} event_data
   * @returns {void}
   */
  function handle_ai_suggestion_finished(event_data) {
    if (!event_data || event_data.lead_id == null) {
      return
    }
    const generating_id = store.state.lead.ai_generating_lead_id
    if (generating_id != null && String(generating_id) === String(event_data.lead_id)) {
      store.commit('lead/set_ai_generating_lead_id', null)
    }
    const conv = store.state.lead.lead_en_conversacion
    if (conv && conv.id == event_data.lead_id) {
      schedule_conversation_refetch(event_data.lead_id)
    }
  }

  /**
   * Mensaje nuevo o lectura: actualiza fila, hilo abierto y badge global.
   *
   * El payload del evento es mínimo (solo IDs) para no superar el límite de 10KB de Pusher.
   * Si no viene el objeto `lead` completo, se programa un refetch por ID.
   *
   * @param {Object} event_data
   * @returns {void}
   */
  function handle_conversation_updated(event_data) {
    if (!event_data) {
      return
    }

    const lead = event_data.lead || null
    const message = event_data.message || null
    const lead_id = event_data.lead_id || (lead && lead.id) || null
    const lead_message_id = event_data.lead_message_id || (message && message.id) || null
    const viewing_this_lead = is_viewing_lead_conversation(lead_id)

    if (lead) {
      // Payload completo (compatibilidad con versiones anteriores del evento)
      store.dispatch('lead/upsert_model_in_lists', lead)
      store.commit('lead/update_lead_en_conversacion', lead)

      if (message && lead.id) {
        store.commit('lead/append_message_to_open_conversation', {
          lead_id: lead.id,
          message: message,
        })
        const kind = ((message.kind || '') + '').toLowerCase()
        const is_pending_ai_suggestion =
          message.sender === 'sistema' &&
          message.status === 'sugerido' &&
          !message.is_followup
        const needs_refetch =
          ((kind === 'audio' || kind === 'ptt' || kind === 'voice') &&
            (!message.attachments || !message.attachments.length)) ||
          (is_pending_ai_suggestion && !message.ai_auto_send_at)
        if (needs_refetch) {
          schedule_conversation_refetch(lead.id)
        }
      } else if (lead.id) {
        const conv = store.state.lead.lead_en_conversacion
        if (conv && conv.id == lead.id && (!conv.messages || !conv.messages.length)) {
          schedule_conversation_refetch(lead.id)
        }
      }
    } else if (lead_id != null) {
      // Payload mínimo (solo IDs): refetch para obtener datos actualizados
      schedule_conversation_refetch(lead_id)
      schedule_list_row_refetch(lead_id)
    }

    if (viewing_this_lead && lead_id != null) {
      /** El operador ya ve el hilo: marcar leído en backend en lugar de sumar badges locales. */
      schedule_mark_read_if_viewing(lead_id)
    } else if (event_data.unread_total != null) {
      store.commit('lead/set_unread_total', event_data.unread_total)
    } else {
      schedule_refresh_unread_badges()
    }
  }

  if (!echo || admin_id == null || admin_id === '') {
    return {
      disconnect() {
        return null
      },
    }
  }

  const channel_name = 'leads.admins'
  channels_to_leave.push(channel_name)
  const channel = echo.channel(channel_name)
  channel.listen('.LeadSuggestionCreated', handle_suggestion_created)
  channel.listen('.LeadConversationUpdated', handle_conversation_updated)
  channel.listen('.LeadAiSuggestionGenerating', handle_ai_suggestion_generating)
  channel.listen('.LeadAiSuggestionFinished', handle_ai_suggestion_finished)

  return {
    disconnect() {
      if (unread_badges_debounce_timer) {
        clearTimeout(unread_badges_debounce_timer)
        unread_badges_debounce_timer = null
      }
      if (conversation_refetch_debounce_timer) {
        clearTimeout(conversation_refetch_debounce_timer)
        conversation_refetch_debounce_timer = null
      }
      if (list_row_refetch_debounce_timer) {
        clearTimeout(list_row_refetch_debounce_timer)
        list_row_refetch_debounce_timer = null
      }
      if (mark_read_if_viewing_debounce_timer) {
        clearTimeout(mark_read_if_viewing_debounce_timer)
        mark_read_if_viewing_debounce_timer = null
      }
      let i = 0
      for (i = 0; i < channels_to_leave.length; i = i + 1) {
        echo.leave(channels_to_leave[i])
      }
    },
  }
}
