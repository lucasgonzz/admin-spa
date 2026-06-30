/**
 * Mixin: scroll automático al final del hilo de conversación WhatsApp.
 *
 * Requiere en el template:
 * - ref="conversation_scroll_box" en el contenedor scrolleable
 * - ref="conversation_scroll_end_anchor" al final del flujo de mensajes (cuando hay mensajes)
 *
 * Opcional: propiedad `loading_conversation` en data — al pasar a false dispara scroll al último mensaje.
 */
export default {
  watch: {
    /**
     * Al terminar la carga inicial de mensajes, alinea el scroll con el último mensaje.
     *
     * @param {boolean} value true mientras la conversación se está cargando.
     * @returns {void}
     */
    loading_conversation(value) {
      if (!value) {
        this.schedule_scroll_to_bottom()
      }
    },
  },

  methods: {
    /**
     * Programa scroll al final tras actualizar el DOM y esperar layout (doble nextTick + doble rAF).
     *
     * @returns {void}
     */
    schedule_scroll_to_bottom() {
      const self = this
      this.$nextTick(function () {
        self.scroll_conversation_to_bottom()
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            self.scroll_conversation_to_bottom()
          })
        })
      })
    },

    /**
     * Desplaza el contenedor de conversación hasta el último mensaje visible.
     * Usa scrollTop y scrollIntoView sobre el ancla de fin de hilo.
     *
     * @returns {void}
     */
    scroll_conversation_to_bottom() {
      /** Contenedor scrolleable del hilo de mensajes. */
      const container = this.$refs.conversation_scroll_box
      if (container) {
        container.scrollTop = container.scrollHeight
      }

      /** Ancla cero altura al final del hilo para alinear el último mensaje. */
      const anchor = this.$refs.conversation_scroll_end_anchor
      if (anchor && typeof anchor.scrollIntoView === 'function') {
        anchor.scrollIntoView({ block: 'end', inline: 'nearest' })
      }
    },
  },
}
