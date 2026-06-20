/**
 * Mixin: secciones de conversación agrupadas por día con divisor sticky estilo WhatsApp.
 * Requiere que el componente exponga el computed `sorted_messages`.
 *
 * Cada sección envuelve sus mensajes: el divisor sticky solo flota mientras esa
 * sección está visible; al llegar la siguiente, empuja al anterior sin superponerse.
 */
export default {
  computed: {
    /**
     * Mensajes agrupados por día con etiqueta de fecha para el divisor sticky.
     *
     * @returns {Array<{key: string, date_label: string|null, messages: Array<Object>}>}
     */
    message_date_sections() {
      /* Secciones finales, una por cada día distinto en el hilo. */
      const sections = []
      /* Fecha ISO (YYYY-MM-DD) de la sección en construcción. */
      let last_date_str = null
      /* Sección abierta a la que se van agregando mensajes consecutivos del mismo día. */
      let current_section = null

      /**
       * Normaliza un timestamp a medianoche en hora local del navegador.
       *
       * @param {string|number|Date} raw
       * @returns {Date|null}
       */
      function normalize_to_midnight(raw) {
        const d = new Date(raw)
        if (isNaN(d.getTime())) {
          return null
        }
        d.setHours(0, 0, 0, 0)
        return d
      }

      /**
       * Etiqueta legible para el divisor según distancia respecto a hoy.
       *
       * @param {Date} date
       * @returns {string}
       */
      function get_date_label(date) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const diff_days = Math.round((today - date) / 86400000)
        if (diff_days === 0) {
          return 'Hoy'
        }
        if (diff_days === 1) {
          return 'Ayer'
        }
        if (diff_days >= 2 && diff_days <= 6) {
          const name = date.toLocaleDateString('es-AR', { weekday: 'long' })
          return name.charAt(0).toUpperCase() + name.slice(1)
        }
        return date.toLocaleDateString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      }

      /**
       * Cierra la sección abierta y la agrega al listado final.
       *
       * @returns {void}
       */
      function push_current_section() {
        if (current_section) {
          sections.push(current_section)
          current_section = null
        }
      }

      for (let i = 0; i < this.sorted_messages.length; i++) {
        const msg = this.sorted_messages[i]
        const d = normalize_to_midnight(msg.created_at)
        const date_str = d ? d.toISOString().slice(0, 10) : null

        /* Nuevo día: cerrar sección anterior y abrir una con divisor de fecha. */
        if (date_str && date_str !== last_date_str) {
          push_current_section()
          current_section = {
            key: 'section-' + date_str,
            date_label: get_date_label(d),
            messages: [],
          }
          last_date_str = date_str
        }

        /* Mensajes sin fecha válida van en sección sin divisor visible. */
        if (!current_section) {
          current_section = {
            key: 'section-no-date-' + msg.id,
            date_label: null,
            messages: [],
          }
        }

        current_section.messages.push(msg)
      }

      push_current_section()
      return sections
    },
  },
}
