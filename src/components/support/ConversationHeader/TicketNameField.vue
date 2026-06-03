<template>
  <!--
    Campo de nombre del ticket (persistencia con el botón Guardar del header).
  -->
  <div class="d-flex align-items-center gap-2 flex-grow-1 support-ticket-name-row">
    <input
      type="text"
      class="form-control form-control-sm"
      :disabled="!has_ticket"
      :value="ticket_name_draft"
      :placeholder="name_placeholder"
      @input="on_draft_input" />
  </div>
</template>

<script>
/**
 * Input del nombre del ticket; el padre consolida el PUT con asignación y estado.
 */
export default {
  name: 'TicketNameField',
  props: {
    /**
     * Si hay ticket seleccionado (habilita edición).
     */
    has_ticket: {
      type: Boolean,
      default: false,
    },
    /**
     * Texto del borrador sincronizado con la vista padre.
     */
    ticket_name_draft: {
      type: String,
      default: '',
    },
    /**
     * false cuando el ticket guardado no tiene nombre (WhatsApp sin título aún).
     */
    ticket_has_name: {
      type: Boolean,
      default: true,
    },
  },
  computed: {
    /**
     * Placeholder del input según si el ticket ya tiene título persistido.
     *
     * @returns {string}
     */
    name_placeholder() {
      if (!this.ticket_has_name) {
        return 'Sin título — esperando sugerencia de IA'
      }
      return 'Nombre del ticket'
    },
  },
  methods: {
    /**
     * Propaga actualización del borrador al padre.
     *
     * @param {Event} event Evento input nativo
     * @returns {void}
     */
    on_draft_input(event) {
      const v = event && event.target ? event.target.value : ''
      this.$emit('update:ticket_name_draft', v)
    },
  },
}
</script>

<style scoped>
.support-ticket-name-row {
  min-width: 220px;
  max-width: 480px;
}
</style>
