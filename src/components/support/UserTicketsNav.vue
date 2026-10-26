<template>
  <!--
    Botones de bandeja: Todos + un botón por operador (y Sin asignar) con badge de tickets abiertos.
    Si la API no manda `open_count` (API vieja), el badge cae a mensajes sin leer como antes.
    El filtro activo se persiste en Vuex (support_ticket.assigned_filter).
  -->
  <div class="user-tickets-nav d-flex flex-wrap gap-1 w-100" role="group" aria-label="Filtro de bandeja por operador">
    <button
      type="button"
      class="btn btn-sm"
      :class="filter_button_class('all')"
      title="Ver todos los tickets"
      @click="change_assigned_filter('all')">
      Todos
      <span
        v-if="total_badge_all > 0"
        class="badge bg-danger rounded-pill user-tickets-nav-unread-badge ms-1"
        :title="badge_title_all">
        {{ total_badge_all > 99 ? '99+' : total_badge_all }}
      </span>
    </button>
    <button
      v-for="row in inbox_nav"
      :key="nav_row_key(row)"
      type="button"
      class="btn btn-sm"
      :class="filter_button_class_for_row(row)"
      :title="nav_row_title(row)"
      @click="on_nav_row_click(row)">
      {{ row.display_name }}
      <span
        v-if="row_badge_count(row) > 0"
        class="badge bg-danger rounded-pill user-tickets-nav-unread-badge ms-1"
        :title="row_badge_title(row)">
        {{ row_badge_count(row) > 99 ? '99+' : row_badge_count(row) }}
      </span>
    </button>
  </div>
</template>

<script>
export default {
  name: 'UserTicketsNav',
  computed: {
    /**
     * Filas devueltas por API (index / unread-badges): operadores + opcional Sin asignar.
     */
    inbox_nav() {
      const nav = this.$store.state.support_ticket.inbox_nav
      return Array.isArray(nav) ? nav : []
    },
    /**
     * Id del admin autenticado; se usa para resolver filtro "mine" en el botón propio.
     */
    current_admin_id() {
      return this.$store.state.auth.admin ? this.$store.state.auth.admin.id : null
    },
    /**
     * Filtro de asignación activo en el store (all, mine, unassigned, id numérico como string).
     */
    assigned_filter() {
      return this.$store.state.support_ticket.assigned_filter || 'mine'
    },
    /**
     * Suma de no leídos de todas las filas del nav (respaldo cuando la API no manda abiertos).
     */
    total_unread_all() {
      let sum = 0
      this.inbox_nav.forEach(function (row) {
        const n = parseInt(row.unread_count, 10)
        if (!isNaN(n)) {
          sum += n
        }
      })
      return sum
    },
    /**
     * Si la API manda tickets abiertos (`open_count` por fila u `open_totals`), los badges los usan.
     * Con una API vieja queda en false y todo sigue con no leídos.
     */
    uses_open_count() {
      if (this.$store.state.support_ticket.open_totals) {
        return true
      }
      return this.inbox_nav.some(function (row) {
        return row.open_count !== undefined && row.open_count !== null
      })
    },
    /**
     * Total de tickets abiertos: `open_totals.all` si viene; si no, la suma de `open_count` de las filas.
     */
    total_open_all() {
      const totals = this.$store.state.support_ticket.open_totals
      if (totals && totals.all !== undefined) {
        const all = parseInt(totals.all, 10)
        return isNaN(all) ? 0 : all
      }
      let sum = 0
      this.inbox_nav.forEach(function (row) {
        const n = parseInt(row.open_count, 10)
        if (!isNaN(n)) {
          sum += n
        }
      })
      return sum
    },
    /**
     * Número del badge de "Todos": tickets abiertos, o no leídos con una API vieja.
     */
    total_badge_all() {
      return this.uses_open_count ? this.total_open_all : this.total_unread_all
    },
    /**
     * Tooltip del badge de "Todos" según qué se está contando.
     */
    badge_title_all() {
      if (this.uses_open_count) {
        return 'Tickets abiertos: ' + this.total_badge_all
      }
      return 'Total mensajes de usuario sin leer: ' + this.total_badge_all
    },
  },
  methods: {
    /**
     * Número del badge de una fila: `open_count` si la API lo manda; si no, `unread_count`.
     *
     * @param {object} row Fila inbox_nav
     * @returns {number}
     */
    row_badge_count(row) {
      const raw = row.open_count !== undefined && row.open_count !== null ? row.open_count : row.unread_count
      const n = parseInt(raw, 10)
      return isNaN(n) ? 0 : n
    },
    /**
     * Tooltip del badge de una fila según qué se está contando.
     *
     * @param {object} row Fila inbox_nav
     * @returns {string}
     */
    row_badge_title(row) {
      if (row.open_count !== undefined && row.open_count !== null) {
        return 'Tickets abiertos: ' + this.row_badge_count(row)
      }
      return 'Sin leer en tickets de ' + row.display_name + ': ' + this.row_badge_count(row)
    },
    /**
     * Clave estable para v-for según fila (admin id o sin asignar).
     *
     * @param {object} row Fila inbox_nav
     * @returns {string}
     */
    nav_row_key(row) {
      if (row.assigned_admin_id === null || row.assigned_admin_id === undefined) {
        return 'unassigned'
      }
      return 'admin-' + String(row.assigned_admin_id)
    },
    /**
     * Texto de ayuda para accesibilidad según fila.
     *
     * @param {object} row Fila inbox_nav
     * @returns {string}
     */
    nav_row_title(row) {
      if (row.assigned_admin_id === null || row.assigned_admin_id === undefined) {
        return 'Tickets sin operador asignado'
      }
      return 'Tickets asignados a ' + row.display_name
    },
    /**
     * Asigna filtro y recarga listado de tickets.
     *
     * @param {string} value Valor enviado a la API (assigned_filter)
     * @returns {void}
     */
    change_assigned_filter(value) {
      this.$store.commit('support_ticket/set_assigned_filter', value)
      this.$store.dispatch('support_ticket/get_models')
    },
    /**
     * Click en fila: Sin asignar usa valor literal; resto usa id del admin; coincide con "mine" si es el usuario actual.
     *
     * @param {object} row Fila inbox_nav
     * @returns {void}
     */
    on_nav_row_click(row) {
      if (row.assigned_admin_id === null || row.assigned_admin_id === undefined) {
        this.change_assigned_filter('unassigned')
        return
      }
      if (this.current_admin_id != null && String(row.assigned_admin_id) === String(this.current_admin_id)) {
        this.change_assigned_filter('mine')
        return
      }
      this.change_assigned_filter(String(row.assigned_admin_id))
    },
    /**
     * Indica si la fila corresponde al filtro activo en store.
     *
     * @param {object} row Fila inbox_nav
     * @returns {boolean}
     */
    is_row_active(row) {
      const f = this.assigned_filter
      if (row.assigned_admin_id === null || row.assigned_admin_id === undefined) {
        return f === 'unassigned'
      }
      if (f === 'mine' && this.current_admin_id != null) {
        return String(row.assigned_admin_id) === String(this.current_admin_id)
      }
      return String(f) === String(row.assigned_admin_id)
    },
    /**
     * Clases Bootstrap para botón según filtro genérico (Todos).
     *
     * @param {string} filter Valor comparado con assigned_filter
     * @returns {object}
     */
    filter_button_class(filter) {
      if (this.assigned_filter === filter) {
        return 'btn-primary'
      }
      return 'btn-outline-primary'
    },
    /**
     * Clases para botón de fila de operador.
     *
     * @param {object} row Fila inbox_nav
     * @returns {object}
     */
    filter_button_class_for_row(row) {
      if (this.is_row_active(row)) {
        return 'btn-primary'
      }
      return 'btn-outline-primary'
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
