<template>
  <!--
    Bandeja de soporte: una sola lista con todos los tickets, los de clientes y los de negocios en prueba
    gratuita (Lucas, 27/11/2026, misión soporte-fijar-no-leido). Antes había un botón «Clientes» y otro «Prueba»
    que separaban la lista; ahora los de prueba se aíslan con la tarjeta «Pruebas abiertas» del resumen.

    Los tickets no pertenecen a un operador: el filtro del store queda fijo en `all`. Apretar el botón refresca
    la lista a mano.
  -->
  <div class="user-tickets-nav d-flex flex-wrap gap-1 w-100" role="group" aria-label="Bandeja de soporte">
    <button
      type="button"
      class="btn btn-sm btn-primary"
      title="Todos los tickets (clientes y pruebas gratuitas). Tocá para actualizar la lista."
      @click="refrescar">
      Tickets
      <span
        v-if="unread_total > 0"
        class="badge bg-danger rounded-pill user-tickets-nav-unread-badge ms-1"
        :title="badge_title">
        {{ unread_total > 99 ? '99+' : unread_total }}
      </span>
    </button>
  </div>
</template>

<script>
export default {
  name: 'UserTicketsNav',
  computed: {
    /**
     * Total de mensajes del cliente sin leer en toda la bandeja: los de clientes más los de pruebas.
     *
     * El store los arma con `unread_total` y `unread_total_prueba` de la API (la vieja no manda el segundo y
     * queda en 0).
     *
     * @returns {number}
     */
    unread_total() {
      const clientes = parseInt(this.$store.state.support_ticket.unread_total, 10)
      const pruebas = parseInt(this.$store.state.support_ticket.unread_total_prueba, 10)
      return (isNaN(clientes) ? 0 : clientes) + (isNaN(pruebas) ? 0 : pruebas)
    },
    /**
     * Tooltip del badge.
     *
     * @returns {string}
     */
    badge_title() {
      return 'Mensajes de clientes sin leer: ' + this.unread_total
    },
  },
  methods: {
    /**
     * Fija el filtro de operador en «todos» y recarga el listado.
     *
     * @returns {void}
     */
    refrescar() {
      this.$store.commit('support_ticket/set_assigned_filter', 'all')
      this.$store.dispatch('support_ticket/get_models')
    },
  },
}
</script>

<style scoped>
/* Badge compacto junto al nombre (coherente con la vista Soporte anterior). */
.user-tickets-nav-unread-badge {
  font-size: 0.65rem;
  min-width: 1.1rem;
  line-height: 1.1;
  padding: 0.12em 0.4em;
  vertical-align: text-top;
}
</style>
