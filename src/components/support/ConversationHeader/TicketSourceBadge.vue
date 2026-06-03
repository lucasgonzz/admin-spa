<template>
  <!-- Badge de origen del ticket: WhatsApp o sistema ERP -->
  <span
    v-if="source_label"
    class="badge support-ticket-source-badge"
    :class="source_badge_class"
    :title="source_title">
    {{ source_label }}
  </span>
</template>

<script>
/**
 * Indica el canal de origen del ticket de soporte (WhatsApp o ERP).
 */
export default {
  name: 'TicketSourceBadge',
  props: {
    /**
     * Valor de support_tickets.source: erp | whatsapp.
     */
    ticket_source: {
      type: String,
      default: 'erp',
    },
  },
  computed: {
    /**
     * Texto visible del badge según source.
     *
     * @returns {string}
     */
    source_label() {
      if (this.ticket_source === 'whatsapp') {
        return 'WhatsApp'
      }
      if (this.ticket_source === 'erp') {
        return 'Sistema'
      }
      return ''
    },
    /**
     * Clase Bootstrap del badge (verde WhatsApp, gris ERP).
     *
     * @returns {string}
     */
    source_badge_class() {
      if (this.ticket_source === 'whatsapp') {
        return 'bg-success'
      }
      return 'bg-secondary'
    },
    /**
     * Tooltip descriptivo del origen.
     *
     * @returns {string}
     */
    source_title() {
      if (this.ticket_source === 'whatsapp') {
        return 'Conversación iniciada por WhatsApp'
      }
      return 'Conversación del sistema ERP del cliente'
    },
  },
}
</script>

<style scoped>
.support-ticket-source-badge {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
</style>
