/**
 * Crea suscripción realtime al canal tenant del ticket activo (`support.client.{uuid}`).
 *
 * Los canales `support.admin.*` viven en `useSupportBadgeSocket` (nav global) para no perderlos
 * al desmontar la vista Soporte.
 *
 * @param {Object} options
 * @param {string|null} options.client_uuid UUID del cliente del ticket abierto.
 * @param {Function} options.on_message Callback con el mensaje recibido.
 * @param {Function} [options.on_message_read] Callback al marcar leído.
 * @param {Function} [options.on_ai_suggestion_pending] Callback con sugerencia IA pendiente.
 * @returns {Object}
 */
export function useSupportSocket(options) {
  // Handler de mensaje entrante ejecutado por cada evento.
  const on_message = options.on_message
  // Nombres de canales a liberar al desmontar.
  const channels_to_leave = []
  // Canal per-tenant del ticket seleccionado (mismo criterio que admin-api).
  const client_channel_name = options.client_uuid
    ? 'support.client.' + options.client_uuid
    : null

  // Reutiliza instancia global de Echo inicializada en main.js.
  const echo = window.admin_support_echo
  if (!echo || !client_channel_name) {
    return {
      /**
       * Sin Echo o sin tenant del ticket: no hay listeners que limpiar.
       */
      disconnect() {
        return null
      },
    }
  }

  channels_to_leave.push(client_channel_name)

  /**
   * Entrega el payload del evento a la vista.
   *
   * @param {Object} event_data Payload del evento Pusher.
   */
  function handle_event(event_data) {
    if (event_data && event_data.message) {
      on_message(event_data.message)
    }
  }

  const on_message_read = options.on_message_read
  /**
   * Actualiza read_at en burbujas (doble check / "visto").
   *
   * @param {Object} event_data Payload del evento Pusher.
   */
  function handle_read(event_data) {
    if (!on_message_read || !event_data || !event_data.message) {
      return
    }
    on_message_read(event_data.message)
  }

  echo.channel(client_channel_name).listen('.SupportMessageReceived', handle_event)
  echo.channel(client_channel_name).listen('.SupportMessageRead', handle_read)

  const on_ai_suggestion_pending = options.on_ai_suggestion_pending
  const on_ai_suggestion_scheduled = options.on_ai_suggestion_scheduled
  const on_ai_suggestion_generating = options.on_ai_suggestion_generating
  const on_message_removed = options.on_message_removed
  /**
   * Entrega sugerencia IA pendiente al panel de conversación.
   *
   * @param {Object} event_data Payload del evento Pusher.
   */
  function handle_ai_pending(event_data) {
    if (on_ai_suggestion_pending && event_data) {
      on_ai_suggestion_pending(event_data)
    }
  }

  if (on_ai_suggestion_pending) {
    echo.channel(client_channel_name).listen('.SupportAiSuggestionPending', handle_ai_pending)
  }

  /**
   * Debounce antes de consultar a Claude: reinicia animación del botón IA.
   *
   * @param {Object} event_data Payload del evento Pusher.
   */
  function handle_ai_scheduled(event_data) {
    if (on_ai_suggestion_scheduled && event_data) {
      on_ai_suggestion_scheduled(event_data)
    }
  }

  /**
   * Claude en curso: detiene animación de espera y muestra spinner en el botón.
   *
   * @param {Object} event_data Payload del evento Pusher.
   */
  function handle_ai_generating(event_data) {
    if (on_ai_suggestion_generating && event_data) {
      on_ai_suggestion_generating(event_data)
    }
  }

  /**
   * Elimina borrador obsoleto del hilo (p. ej. nuevo mensaje del cliente).
   *
   * @param {Object} event_data Payload del evento Pusher.
   */
  function handle_message_removed(event_data) {
    if (on_message_removed && event_data) {
      on_message_removed(event_data)
    }
  }

  if (on_ai_suggestion_scheduled) {
    echo.channel(client_channel_name).listen('.SupportAiSuggestionScheduled', handle_ai_scheduled)
  }
  if (on_ai_suggestion_generating) {
    echo.channel(client_channel_name).listen('.SupportAiSuggestionGenerating', handle_ai_generating)
  }
  if (on_message_removed) {
    echo.channel(client_channel_name).listen('.SupportMessageRemoved', handle_message_removed)
  }

  return {
    /**
     * Sólo deja canales: no hace echo.disconnect() global o se rompe el resto de la app.
     */
    disconnect() {
      let i = 0
      for (i = 0; i < channels_to_leave.length; i = i + 1) {
        echo.leave(channels_to_leave[i])
      }
    },
  }
}
