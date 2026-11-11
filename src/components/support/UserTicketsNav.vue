<template>
  <!--
    Bandeja de soporte: un botón «Clientes» con el total de mensajes del cliente sin leer y, desde el
    10/11/2026 (misión prueba-ayuda-unificada-en-soporte), un botón «Prueba» para los tickets de los
    negocios en prueba gratuita, que atiende Martín y van aparte de la cola y de los contadores.

    Los tickets ya no pertenecen a un operador, así que no hay un botón por operador ni «Sin
    asignar»: el filtro del store queda fijo en `all`. «Prueba» aparece solo si la API marca las
    filas (`es_prueba`); con una API vieja la bandeja se ve completa, como antes.
  -->
  <div class="user-tickets-nav d-flex flex-wrap gap-1 w-100" role="group" aria-label="Bandeja de soporte">
    <button
      type="button"
      class="btn btn-sm"
      :class="filtro_prueba === 'prueba' ? 'btn-outline-primary' : 'btn-primary'"
      :aria-pressed="filtro_prueba === 'prueba' ? 'false' : 'true'"
      title="Tickets de clientes (sin las pruebas gratuitas)"
      @click="elegir('clientes')">
      Clientes
      <span
        v-if="unread_total > 0"
        class="badge bg-danger rounded-pill user-tickets-nav-unread-badge ms-1"
        :title="badge_title">
        {{ unread_total > 99 ? '99+' : unread_total }}
      </span>
    </button>
    <button
      v-if="api_marca_pruebas"
      type="button"
      class="btn btn-sm"
      :class="filtro_prueba === 'prueba' ? 'btn-primary' : 'btn-outline-primary'"
      :aria-pressed="filtro_prueba === 'prueba' ? 'true' : 'false'"
      title="Tickets de negocios en prueba gratuita (los atiende Martín)"
      @click="elegir('prueba')">
      Prueba
      <span
        v-if="unread_total_prueba > 0"
        class="badge bg-danger rounded-pill user-tickets-nav-unread-badge ms-1"
        :title="'Mensajes de pruebas sin leer: ' + unread_total_prueba">
        {{ unread_total_prueba > 99 ? '99+' : unread_total_prueba }}
      </span>
    </button>
  </div>
</template>

<script>
export default {
  name: 'UserTicketsNav',
  computed: {
    /**
     * Total de mensajes del cliente sin leer en la bandeja de clientes (sin las pruebas).
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
     * No leídos de los tickets de prueba gratuita.
     *
     * @returns {number}
     */
    unread_total_prueba() {
      const n = parseInt(this.$store.state.support_ticket.unread_total_prueba, 10)
      return isNaN(n) ? 0 : n
    },
    /**
     * Bandeja elegida: `clientes` o `prueba`.
     *
     * @returns {string}
     */
    filtro_prueba() {
      return this.$store.state.support_ticket.filtro_prueba
    },
    /**
     * Si la API manda `es_prueba` en las filas. Se mira si la clave está DEFINIDA en alguna fila (no si
     * es true): con una API vieja ninguna la trae y el botón no se muestra.
     *
     * @returns {boolean}
     */
    api_marca_pruebas() {
      const tickets = this.$store.state.support_ticket.models || []
      return tickets.some(function (ticket) {
        return !!ticket && ticket.es_prueba !== undefined
      })
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
     * Elige la bandeja (`clientes` o `prueba`), fija el filtro de operador en «todos» y recarga el
     * listado. Apretar el botón ya elegido sirve para refrescar a mano, como antes.
     *
     * @param {string} filtro
     * @returns {void}
     */
    elegir(filtro) {
      this.$store.commit('support_ticket/set_filtro_prueba', filtro)
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
