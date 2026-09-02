import store from '@/store'
import api from '@/utils/axios'
import router from '@/router'

/**
 * Debounce del GET /lead/status-cards. Más largo que el de badges (450 ms) porque la query es
 * bastante más cara y los números de las tarjetas cambian mucho menos seguido.
 */
const STATUS_CARDS_DEBOUNCE_MS = 1500

/**
 * Tope de espera del mismo refresco: por más seguido que lleguen los eventos, entre dos
 * refrescos de tarjetas nunca pasa más que esto.
 */
const STATUS_CARDS_MAX_ESPERA_MS = 6000

/**
 * Debounce del GET /lead/{id} que refresca una fila de la grilla. Agrupa la ráfaga de eventos
 * que produce un mismo lead (mensaje + sugerencia + estado de entrega llegan casi juntos).
 */
const LIST_ROW_REFETCH_DEBOUNCE_MS = 800

/**
 * Tope de espera del refresco de filas, con el mismo criterio que el de las tarjetas de estado:
 * con varios leads conversando a la vez el timer se reprograma sin parar y la grilla se congela
 * justo en el momento de mayor movimiento.
 */
const LIST_ROW_REFETCH_MAX_ESPERA_MS = 3200

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
  /**
   * Ids de lead esperando su GET /lead/{id}. Es un Set y no una variable con el último id
   * justamente porque son varios: ver schedule_list_row_refetch.
   */
  let list_row_refetch_pendientes = new Set()
  /** Momento del primer pedido de refresco de fila de la ráfaga actual (null si no hay ráfaga). */
  let list_row_refetch_primer_pedido_at = null
  /** Debounce del POST mark-whatsapp-messages-read mientras el operador mira el hilo. */
  let mark_read_if_viewing_debounce_timer = null
  /** Debounce del GET /lead/status-cards (tarjetas de estado arriba de la grilla). */
  let status_cards_debounce_timer = null
  /** Momento del primer pedido de refresco de tarjetas de la ráfaga actual (null si no hay ráfaga). */
  let status_cards_primer_pedido_at = null

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
   * Programa el refresco por API de la fila de un lead (GET /lead/{id}).
   *
   * 🔴 ACUMULA LOS IDS PENDIENTES, no guarda el último. Hasta el 2/9/2026 esta función tenía un
   * solo timer y ningún id: cada llamada hacía clearTimeout y reprogramaba con el lead nuevo, y
   * el anterior se perdía sin dejar rastro. Con dos leads a menos de 800 ms —dos conversaciones
   * activas, que es lo normal— la fila del primero se quedaba vieja en silencio. Eso antes era
   * el camino raro; desde que los eventos mandan solo ids, es el ÚNICO camino: por acá pasa
   * ahora todo refresco de fila.
   *
   * El tope de espera sigue el mismo criterio que schedule_refresh_status_cards: un debounce que
   * se reprograma en cada evento se muere de hambre justo cuando más importa.
   *
   * El Set además dedupe: varios eventos del mismo lead en la ráfaga siguen siendo un solo GET,
   * que era el motivo original del debounce (no disparar el throttle de Laravel). Lo que sí
   * crece es la cantidad de leads distintos, y eso es inevitable: cada uno necesita su GET.
   *
   * @param {number|string} lead_id
   * @returns {void}
   */
  function schedule_list_row_refetch(lead_id) {
    if (lead_id == null || lead_id === '') {
      return
    }
    list_row_refetch_pendientes.add(String(lead_id))
    if (list_row_refetch_primer_pedido_at == null) {
      list_row_refetch_primer_pedido_at = Date.now()
    }
    if (Date.now() - list_row_refetch_primer_pedido_at >= LIST_ROW_REFETCH_MAX_ESPERA_MS) {
      if (list_row_refetch_debounce_timer) {
        clearTimeout(list_row_refetch_debounce_timer)
        list_row_refetch_debounce_timer = null
      }
      flush_list_row_refetch()
      return
    }
    if (list_row_refetch_debounce_timer) {
      clearTimeout(list_row_refetch_debounce_timer)
    }
    list_row_refetch_debounce_timer = setTimeout(function () {
      list_row_refetch_debounce_timer = null
      flush_list_row_refetch()
    }, LIST_ROW_REFETCH_DEBOUNCE_MS)
  }

  /**
   * Dispara el GET de todos los leads que quedaron pendientes en la ráfaga y vacía la cola.
   *
   * @returns {void}
   */
  function flush_list_row_refetch() {
    list_row_refetch_primer_pedido_at = null
    /** Copia de los pendientes: la cola se vacía ANTES de pedir, para que un evento que llegue
     *  mientras los GET están en vuelo arranque una ráfaga nueva y no se pierda. */
    const ids = Array.from(list_row_refetch_pendientes)
    list_row_refetch_pendientes.clear()
    let i = 0
    for (i = 0; i < ids.length; i = i + 1) {
      fetch_list_row(ids[i])
    }
  }

  /**
   * GET /lead/{id} y aplicación del modelo que devuelve, para un lead puntual.
   *
   * @param {number|string} lead_id
   * @returns {void}
   */
  function fetch_list_row(lead_id) {
    api.get('/lead/' + lead_id).then(function (res) {
      const model = res.data && res.data.model ? res.data.model : null
      if (!model || !model.id) {
        return
      }
      apply_refetched_lead_row(model)
      /* Acá es donde puede haber cambiado el `status` del lead: refrescar las tarjetas. */
      schedule_refresh_status_cards()
    }).catch(function () {
      return null
    })
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
   * Programa GET /lead/status-cards para refrescar los conteos de las tarjetas de estado.
   *
   * Debounce más largo que el de badges (450 ms) porque la query es bastante más cara y los
   * números cambian mucho menos seguido. Solo corre si el admin está parado en la grilla de
   * Leads: si está en otra vista, las tarjetas ni se ven.
   *
   * @returns {void}
   */
  function schedule_refresh_status_cards() {
    if (!is_admin_viewing_leads_grid()) {
      return
    }
    /* 🔴 Tope de espera. Un debounce que se reprograma en cada evento se muere de hambre justo
       cuando más importa: con varios leads conversando a la vez, los eventos llegan a menos de
       1500 ms de distancia y el timer nunca llega a disparar, así que las tarjetas se congelan
       en el momento de mayor movimiento. Con este tope, entre dos refrescos nunca pasan más de
       STATUS_CARDS_MAX_ESPERA_MS por más seguido que lleguen los eventos. */
    if (status_cards_primer_pedido_at == null) {
      status_cards_primer_pedido_at = Date.now()
    }
    if (Date.now() - status_cards_primer_pedido_at >= STATUS_CARDS_MAX_ESPERA_MS) {
      if (status_cards_debounce_timer) {
        clearTimeout(status_cards_debounce_timer)
        status_cards_debounce_timer = null
      }
      status_cards_primer_pedido_at = null
      store.dispatch('lead/fetch_status_cards')
      return
    }
    if (status_cards_debounce_timer) {
      clearTimeout(status_cards_debounce_timer)
    }
    status_cards_debounce_timer = setTimeout(function () {
      status_cards_debounce_timer = null
      status_cards_primer_pedido_at = null
      store.dispatch('lead/fetch_status_cards')
    }, STATUS_CARDS_DEBOUNCE_MS)
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
   * Aplica el lead que devolvió GET /lead/{id}: la fila de la grilla Y los flags de la
   * conversación abierta.
   *
   * 🔴 LAS DOS COSAS, no solo la fila. Hasta el 2/9/2026 el camino del refetch hacía únicamente
   * `upsert_model_in_lists` mientras que apply_lead_row (el camino que tenía el modelo en el
   * evento) hacía además el commit de `update_lead_en_conversacion`. Resultado: el operador que
   * tenía abierta la conversación de ese lead seguía viendo los flags viejos —
   * `tiene_sugerencia_pendiente` entre ellos— hasta recargar. En los dos sitios de LeadAiService
   * quedaba tapado de casualidad porque atrás venía un emit_conversation_updated; en los tres de
   * LeadController, no. Y desde que el evento manda solo el id, este es el único camino.
   *
   * ⚠️ EL HILO DE MENSAJES SE SACA ANTES DE COMMITEAR, y esto no es una optimización. GET
   * /lead/{id} pasa por `prepare_lead_for_detail_json()`, que marca `messages_scope = 'full'`, y
   * la mutación `update_lead_en_conversacion` REEMPLAZA el hilo cuando ve esa marca y lo FUSIONA
   * cuando no. Commitear el modelo tal cual convertiría un refresco de fila en un reemplazo del
   * hilo abierto, tirando lo que el panel tenga en vuelo. Ese error ya está documentado en
   * `LeadController::full_lead_with_demo_link()` de admin-api; sin `messages` ni
   * `messages_scope`, la mutación toma la rama de fusión y `merge_conversation_messages()`
   * devuelve el hilo previo intacto — que es exactamente lo que hacía el camino del modelo.
   *
   * La grilla sí recibe el modelo entero, igual que antes: ahí no hay hilo que preservar.
   *
   * @param {Object} model Lead completo tal como lo devuelve GET /lead/{id}.
   * @returns {void}
   */
  function apply_refetched_lead_row(model) {
    if (!model || !model.id) {
      return
    }
    store.dispatch('lead/upsert_model_in_lists', model)
    /** Mismo lead, sin el hilo ni su marca de alcance. */
    const solo_flags = Object.assign({}, model)
    delete solo_flags.messages
    delete solo_flags.messages_scope
    store.commit('lead/update_lead_en_conversacion', solo_flags)
  }

  /**
   * Sugerencia nueva para un lead (.LeadSuggestionCreated).
   *
   * 🔴 El payload trae `lead_id` y NADA MÁS (decisión de Lucas, 2/9/2026). `leads.admins` es un
   * canal público y la clave de Pusher está en este bundle, así que por ahí se suscribe
   * cualquiera: el `Lead` que venía adentro publicaba teléfono, mail, notas y resúmenes de la
   * llamada y de la demo. Además pesaba 23221 bytes con la demo resuelta, contra los 10240 que
   * admite Pusher, y eso hacía explotar el broadcast entero — la excepción se llevaba puesto el
   * reporte de una sugerencia que sí se había generado y guardado.
   *
   * La rama de `event_data.lead` se conserva a propósito, aunque hoy no la use ninguna versión
   * de admin-api: es lo que hace que esta SPA siga andando contra una API vieja (que sí manda el
   * modelo). Es tolerancia hacia atrás, no un camino vivo.
   *
   * @param {Object} event_data Payload Echo: { lead_id }.
   * @returns {void}
   */
  function handle_suggestion_created(event_data) {
    if (!event_data) {
      return
    }
    /* Id del lead: del campo suelto, o del modelo si vino de una API vieja. */
    const lead_id = event_data.lead && event_data.lead.id != null
      ? event_data.lead.id
      : event_data.lead_id
    if (event_data.lead) {
      apply_lead_row(event_data.lead)
    } else if (lead_id != null) {
      /* El camino normal: la fila se refresca por API — mismo mecanismo que ya usa el
       * listener de verificacion-agendamiento-alerts más abajo. */
      schedule_list_row_refetch(lead_id)
    }
    /* Una sugerencia nueva cambia el "sin responder" de la tarjeta de ese estado. */
    schedule_refresh_status_cards()
    /* 🔴 El spinner se apaga leyendo `lead_id` y NO `event_data.lead.id`: con el payload
     * recortado el modelo no viene, y la versión vieja dejaba el lead girando para siempre. */
    if (lead_id != null) {
      const generating_id = store.state.lead.ai_generating_lead_id
      if (generating_id != null && String(generating_id) === String(lead_id)) {
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
      schedule_refresh_status_cards()
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
      list_row_refetch_pendientes.clear()
      list_row_refetch_primer_pedido_at = null
      if (mark_read_if_viewing_debounce_timer) {
        clearTimeout(mark_read_if_viewing_debounce_timer)
        mark_read_if_viewing_debounce_timer = null
      }
      if (status_cards_debounce_timer) {
        clearTimeout(status_cards_debounce_timer)
        status_cards_debounce_timer = null
      }
      status_cards_primer_pedido_at = null
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
