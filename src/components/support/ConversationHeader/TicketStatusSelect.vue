<template>
  <!--
    Estado operativo del ticket (abierto / cerrado); se persiste con Guardar del header.
  -->
  <select
    class="form-select form-select-sm ticket-status-select"
    :disabled="!has_ticket"
    :value="ticket_status_draft"
    @change="on_change">
    <option value="open">Abierto</option>
    <option value="closed">Cerrado</option>
  </select>
</template>

<script>
/**
 * Selector de estado del caso; valores alineados con admin-api (open | closed).
 */
export default {
  name: 'TicketStatusSelect',
  props: {
    /**
     * Ticket activo o ausencia de selección.
     */
    has_ticket: {
      type: Boolean,
      default: false,
    },
    /**
     * Estado local antes de guardar (open / closed).
     */
    ticket_status_draft: {
      type: String,
      default: 'open',
    },
  },
  methods: {
    /**
     * Sincroniza borrador de estado con el padre.
     *
     * @param {Event} event Change del select
     * @returns {void}
     */
    on_change(event) {
      const raw = event && event.target ? event.target.value : 'open'
      this.$emit('update:ticket_status_draft', raw)
    },
  },
}
</script>

<style scoped>
.ticket-status-select {
  max-width: 160px;
}
</style>
