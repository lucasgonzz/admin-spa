import store from '@/store'
import api from '@/utils/axios'
import router from '@/router'

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
   * true si el admin está en la grilla de Leads (ruta `leads`, no conversación fullscreen).
   *
   * @returns {boolean}
   */
  function is_admin_viewing_leads_grid() {
    return router.currentRoute.value.name === 'leads'
  }

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

    /*
     * Solo cambió whatsapp_delivery_status: refrescar hilo abierto, sin badges ni fila de grilla,
     * EXCEPTO cuando la entrega falló ('fallido'): ese caso además refresca la fila del lead en
     * la grilla (si está abierta) para que se pinte de rojo sin esperar a que recarguen la página.
     */
    if (event_data.is_status_update) {
      if (lead_id != null) {
        schedule_conversation_refetch(lead_id)
        if (event_data.delivery_status === 'fallido' && is_admin_viewing_leads_grid()) {
          schedule_list_row_refetch(lead_id)
        }
      }
      return
    }

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
      if (is_admin_viewing_leads_grid()) {
        schedule_list_row_refetch(lead_id)
      }
    }

    // Solo re-marcar leído si el evento trae un mensaje puntual nuevo (lead_message_id real).
    // Sin esto, el propio POST mark-whatsapp-messages-read (que no pasa lead_message_id al
    // emitir su broadcast) hace eco al mismo admin que lo disparó, y schedule_mark_read_if_viewing
    // vuelve a llamarlo -> nuevo broadcast -> bucle infinito cada ~250ms hasta 429 Too Many
    // Attempts (bug reportado por Lucas, 17/7/2026). mark-whatsapp-messages-read ya marca leído
    // TODO el hilo de una sola vez, así que no hace falta re-dispararlo por su propio eco.
    if (viewing_this_lead && lead_id != null && lead_message_id != null) {
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

  /*
   * Canal privado de alerta cuando un mensaje requiere verificación por agendamiento (ver
   * prompt 233). Sonido en el navegador — mismo patrón que closer-alerts en CloserPanel.vue.
   * Además del sonido, refresca badges/grilla igual que un mensaje nuevo (reutiliza el mismo
   * mecanismo de refetch que ya existe para no duplicar lógica de actualización de la UI).
   */
  const verificacion_channel_name = 'verificacion-agendamiento-alerts'
  channels_to_leave.push(verificacion_channel_name)
  const verificacion_channel = echo.private(verificacion_channel_name)
  verificacion_channel.listen('.verificacion.agendamiento.alert', function (event_data) {
    try {
      var audio = new Audio('/sounds/alert.mp3')
      audio.play().catch(function () { return null })
    } catch (e) {
      // Ignorar si el navegador bloquea la reproducción automática.
    }
    if (event_data && event_data.lead_id != null) {
      schedule_list_row_refetch(event_data.lead_id)
      schedule_conversation_refetch(event_data.lead_id)
    }
  })

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
        // Los canales privados se registran en Echo con el prefijo "private-"; echo.leave()
        // lo requiere para desuscribir correctamente (mismo patrón que teardown_closer_alert_channel
        // en CloserPanel.vue, que usa 'private-closer-alerts').
        if (channels_to_leave[i] === verificacion_channel_name) {
          echo.leave('private-' + channels_to_leave[i])
        } else {
          echo.leave(channels_to_leave[i])
        }
      }
    },
  }
}
