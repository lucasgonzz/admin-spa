import store from '@/store'

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
   * @param {Object} event_data
   * @returns {void}
   */
  function handle_conversation_updated(event_data) {
    if (!event_data) {
      return
    }

    const lead = event_data.lead
    const message = event_data.message

    if (lead) {
      store.dispatch('lead/upsert_model_in_lists', lead)
      store.commit('lead/update_lead_en_conversacion', lead)
    }

    if (message && lead && lead.id) {
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
    } else if (lead && lead.id) {
      const conv = store.state.lead.lead_en_conversacion
      if (conv && conv.id == lead.id && (!conv.messages || !conv.messages.length)) {
        schedule_conversation_refetch(lead.id)
      }
    }

    if (event_data.unread_total != null) {
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
      let i = 0
      for (i = 0; i < channels_to_leave.length; i = i + 1) {
        echo.leave(channels_to_leave[i])
      }
    },
  }
}
