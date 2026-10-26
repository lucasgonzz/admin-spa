<template>
  <!--
    Bandeja de soporte: un único botón «Todos» con el total de mensajes del cliente sin leer.

    Los tickets ya no pertenecen a un operador, así que no hay un botón por operador ni «Sin
    asignar»: la bandeja siempre muestra todo (el filtro del store queda fijo en `all`).
  -->
  <div class="user-tickets-nav d-flex flex-wrap gap-1 w-100" role="group" aria-label="Bandeja de soporte">
    <button
      type="button"
      class="btn btn-sm btn-primary"
      aria-pressed="true"
      title="Todos los tickets"
      @click="reload_inbox">
      Todos
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
     * Total de mensajes del cliente sin leer en toda la bandeja.
     *
     * El store lo arma con `unread_total` de la API o, si la API es vieja y no lo manda, con la
     * suma `unread_totals.mine + unread_totals.others` (ver `unread_total_from_response`).
     *
     * @returns {number}
     */
    unread_total() {
      const n = parseInt(this.$store.state.support_ticket.unread_total, 10)
      return isNaN(n) ? 0 : n
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
     * Fija el filtro en «todos» y recarga la bandeja. Es el único filtro que existe; apretar el
     * botón sirve para refrescar el listado a mano.
     *
     * @returns {void}
     */
    reload_inbox() {
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
