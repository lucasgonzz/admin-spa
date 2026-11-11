<template>
  <div class="support-ticket-summary-row w-100">
    <!--
      Resumen del ticket (support_tickets.summary, ≤ 600): qué pasó, qué se hizo, cómo quedó. Lo
      escribe Martín con `titular`; acá Lucas lo corrige. Se guarda con el botón Guardar del header,
      igual que el nombre (misión ficha-del-cliente, 11/11/2026).
    -->
    <textarea
      class="form-control form-control-sm support-ticket-summary-input"
      rows="2"
      :maxlength="max"
      :disabled="!has_ticket"
      :value="ticket_summary_draft"
      placeholder="Resumen del ticket: qué pasó, qué se hizo y cómo quedó"
      aria-label="Resumen del ticket"
      @input="on_draft_input"></textarea>
    <small v-if="ticket_summary_draft.length > max - 100" class="text-muted support-ticket-summary-count">
      {{ ticket_summary_draft.length }}/{{ max }}
    </small>
  </div>
</template>

<script>
/**
 * Textarea del resumen del ticket; el padre consolida el PUT con nombre y estado (mismo patrón que
 * TicketNameField).
 */
export default {
  name: 'TicketSummaryField',
  emits: ['update:ticket_summary_draft'],
  props: {
    /** Si hay ticket seleccionado (habilita edición). */
    has_ticket: {
      type: Boolean,
      default: false,
    },
    /** Borrador sincronizado con la vista padre. */
    ticket_summary_draft: {
      type: String,
      default: '',
    },
  },
  data() {
    return {
      // Largo máximo de support_tickets.summary.
      max: 600,
    }
  },
  methods: {
    /**
     * Propaga el borrador al padre.
     *
     * @param {Event} event Evento input nativo
     * @returns {void}
     */
    on_draft_input(event) {
      const v = event && event.target ? event.target.value : ''
      this.$emit('update:ticket_summary_draft', v)
    },
  },
}
</script>

<style scoped lang="scss">
.support-ticket-summary-row {
	position: relative;
}

.support-ticket-summary-input {
	resize: vertical;
	min-height: 2.6rem;
	font-size: 0.82rem;
}

.support-ticket-summary-count {
	display: block;
	text-align: right;
	font-size: 0.72rem;
}
</style>
