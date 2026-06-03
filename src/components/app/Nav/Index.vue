<template>
  <aside
    class="app-nav flex-shrink-0 border-end"
    :class="nav_root_classes"
    :aria-hidden="is_mobile_viewport && !mobile_open ? 'true' : 'false'"
  >
    <div class="app-nav-inner p-3 text-white min-vh-100 d-flex flex-column">
      <div
        v-if="!is_mobile_viewport"
        class="app-nav-header d-flex align-items-center mb-3"
        :class="{ 'justify-content-center': collapsed }"
      >
        <h2 v-show="show_nav_labels" class="h5 mb-0 flex-grow-1 text-truncate">ComercioCity</h2>
        <h2 v-show="collapsed" class="h5 mb-0" title="ComercioCity">CC</h2>
      </div>

      <nav class="d-flex flex-column gap-1 flex-grow-1">
        <template v-for="r in nav_routes">
          <router-link
            v-if="!r.meta || !r.meta.disabled"
            :key="'nav-' + r.path"
            class="nav-link text-white py-1 px-2 rounded d-flex align-items-center flex-wrap"
            :class="{ 'justify-content-center': collapsed && !is_mobile_viewport }"
            active-class="bg-primary fw-semibold"
            :to="r.path"
            :title="nav_link_title(r)"
            @click="on_nav_link_click(r)"
          >
            <i :class="[icon(r), 'nav-link-icon', { 'me-1': show_nav_labels }]" />
            <span v-show="show_nav_labels" class="nav-link-label">{{ r.text }}</span>
            <span
              v-if="show_nav_labels && r.name === 'support' && support_unread_mine > 0"
              class="badge bg-danger rounded-pill ms-1 nav-support-unread-badge"
              :title="'Mensajes de usuario sin leer en tus tickets: ' + support_unread_mine"
            >
              {{ support_unread_mine > 99 ? '99+' : support_unread_mine }}
            </span>
            <span
              v-if="show_nav_labels && r.name === 'leads' && leads_unread_total > 0"
              class="badge bg-danger rounded-pill ms-1 nav-support-unread-badge"
              :title="'Mensajes del lead sin leer: ' + leads_unread_total"
            >
              {{ leads_unread_total > 99 ? '99+' : leads_unread_total }}
            </span>
            <span
              v-if="show_nav_labels && r.name === 'tasks' && tasks_pending_assigned_mine > 0"
              class="badge bg-danger rounded-pill ms-1 nav-support-unread-badge"
              :title="'Tareas pendientes asignadas a vos: ' + tasks_pending_assigned_mine"
            >
              {{ tasks_pending_assigned_mine > 99 ? '99+' : tasks_pending_assigned_mine }}
            </span>
            <span
              v-if="!show_nav_labels && r.name === 'support' && support_unread_mine > 0"
              class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger nav-support-unread-badge nav-support-unread-badge--dot"
              :title="'Mensajes sin leer: ' + support_unread_mine"
            >
              {{ support_unread_mine > 9 ? '9+' : support_unread_mine }}
            </span>
            <span
              v-if="!show_nav_labels && r.name === 'leads' && leads_unread_total > 0"
              class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger nav-support-unread-badge nav-support-unread-badge--dot"
              :title="'Mensajes del lead sin leer: ' + leads_unread_total"
            >
              {{ leads_unread_total > 9 ? '9+' : leads_unread_total }}
            </span>
            <span
              v-if="!show_nav_labels && r.name === 'tasks' && tasks_pending_assigned_mine > 0"
              class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger nav-support-unread-badge nav-support-unread-badge--dot"
              :title="'Tareas pendientes: ' + tasks_pending_assigned_mine"
            >
              {{ tasks_pending_assigned_mine > 9 ? '9+' : tasks_pending_assigned_mine }}
            </span>
          </router-link>
          <span
            v-else
            :key="'nav-disabled-' + r.path"
            class="nav-link text-white-50 py-1 px-2 small d-flex align-items-center flex-wrap"
            :class="{ 'justify-content-center': collapsed && !is_mobile_viewport }"
            :title="nav_link_title(r)"
          >
            <i :class="[icon(r), 'nav-link-icon', { 'me-1': show_nav_labels }]" />
            <span v-show="show_nav_labels" class="nav-link-label">{{ r.text }}</span>
            <span v-show="show_nav_labels" class="badge text-bg-warning ms-1">Próximamente</span>
          </span>
        </template>

        <a
          href="#"
          class="nav-link text-white-50 small mt-3 d-flex align-items-center"
          :class="{ 'justify-content-center': collapsed && !is_mobile_viewport }"
          :title="collapsed && !is_mobile_viewport ? 'Salir' : ''"
          @click.prevent="logout"
        >
          <i :class="['bi', 'bi-box-arrow-right', 'nav-link-icon', { 'me-1': show_nav_labels }]" />
          <span v-show="show_nav_labels">Salir</span>
        </a>
      </nav>

      <button
        v-if="!is_mobile_viewport"
        type="button"
        class="btn btn-sm btn-outline-light app-nav-collapse-toggle mt-3"
        :aria-label="collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'"
        :title="collapsed ? 'Expandir menú' : 'Contraer menú'"
        @click="on_toggle_collapsed"
      >
        <i class="bi" :class="collapsed ? 'bi-chevron-right' : 'bi-chevron-left'" aria-hidden="true" />
      </button>
    </div>
  </aside>
</template>

<script>
import routes from '@/router/routes'
import { useSupportBadgeSocket } from '@/composables/useSupportBadgeSocket'
import { useLeadSocket } from '@/composables/useLeadSocket'

/**
 * Menú lateral: colapsable en desktop (solo iconos) y drawer en móvil (controlado por App.vue).
 * Mantiene suscripción Pusher a canales admin de soporte para el badge de no leídos en "Soporte".
 * Mantiene suscripción Pusher al canal `leads.admins` para actualizar leads en tiempo real.
 * Precarga tareas (GET /task) con el admin autenticado para el conteo de pendientes en "Tareas".
 */
export default {
  name: 'AppNav',
  props: {
    /** true cuando el viewport es móvil (< md bootstrap). */
    is_mobile_viewport: {
      type: Boolean,
      default: false,
    },
    /** En desktop: barra contraída (solo iconos). */
    collapsed: {
      type: Boolean,
      default: false,
    },
    /** En móvil: drawer visible. */
    mobile_open: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['toggle-collapsed', 'close-mobile'],
  data() {
    return {
      // Rutas declaradas con meta.nav para armar el menú.
      routes: routes,
      /**
       * Instancia devuelta por useSupportBadgeSocket; se libera en teardown o al cambiar de admin.
       */
      support_badge_socket_instance: null,
      /**
       * Instancia devuelta por useLeadSocket; se libera en teardown o al cambiar de admin.
       */
      lead_socket_instance: null,
    }
  },
  computed: {
    nav_routes() {
      return this.routes.filter((r) => r.meta && r.meta.nav)
    },
    /**
     * Clases del contenedor según modo desktop colapsado o drawer móvil abierto.
     */
    nav_root_classes() {
      return {
        'app-nav--collapsed': this.collapsed && !this.is_mobile_viewport,
        'app-nav--mobile-open': this.is_mobile_viewport && this.mobile_open,
      }
    },
    /**
     * Muestra textos del menú cuando está expandido en desktop o cuando el drawer móvil está abierto.
     */
    show_nav_labels() {
      if (this.is_mobile_viewport) {
        return this.mobile_open
      }
      return !this.collapsed
    },
    /**
     * Id del admin autenticado; null hasta que /me resuelva tras F5 con token.
     */
    current_admin_id() {
      return this.$store.state.auth.admin ? this.$store.state.auth.admin.id : null
    },
    /**
     * Total de mensajes de usuario sin leer en tickets asignados a este operador (mismo origen que vista Soporte).
     */
    support_unread_mine() {
      const t = this.$store.state.support_ticket.unread_totals
      if (!t || t.mine == null) {
        return 0
      }
      const n = parseInt(t.mine, 10)
      return isNaN(n) ? 0 : n
    },
    /**
     * Mensajes entrantes del lead sin leer (todos los leads).
     * @returns {number}
     */
    leads_unread_total() {
      const n = parseInt(this.$store.state.lead.unread_total, 10)
      return isNaN(n) ? 0 : n
    },
    /**
     * Tareas pendientes (no realizadas) cuyo asignatario es el admin logueado.
     * @returns {number}
     */
    tasks_pending_assigned_mine() {
      const admin_id = this.current_admin_id
      if (!admin_id) {
        return 0
      }
      return this.$store.getters['task/pending_assigned_count_for_admin'](admin_id)
    },
  },
  watch: {
    /**
     * Al tener admin (o cambiar de sesión), refresca badges y (re)suscribe canales Pusher admin.
     */
    current_admin_id: {
      immediate: true,
      handler() {
        this.rebuild_support_badge_socket()
        this.rebuild_lead_socket()
        this.refresh_task_nav_count()
      },
    },
  },
  beforeUnmount() {
    this.teardown_support_badge_socket()
    this.teardown_lead_socket()
  },
  methods: {
    icon(r) {
      const n = (r.meta && r.meta.icon) || 'dot'
      return 'bi bi-' + n
    },
    /**
     * Tooltip en links cuando el menú está contraído en desktop.
     *
     * @param {object} r Ruta del router
     * @returns {string}
     */
    nav_link_title(r) {
      if (this.show_nav_labels) {
        return ''
      }
      return r.text || ''
    },
    /**
     * Solicita a App.vue alternar el estado colapsado (solo desktop).
     */
    on_toggle_collapsed() {
      this.$emit('toggle-collapsed')
    },
    /**
     * Cierra el drawer móvil (botón X o backdrop).
     */
    on_close_mobile() {
      this.$emit('close-mobile')
    },
    /**
     * Al pulsar un ítem del menú: en móvil cierra el drawer; si ya estamos en esa ruta, fuerza recarga de la vista.
     *
     * @param {object} r Definición de ruta del menú (routes.js)
     * @returns {void}
     */
    on_nav_link_click(r) {
      if (this.is_mobile_viewport) {
        this.on_close_mobile()
      }
      if (r && r.name && this.$route.name === r.name) {
        this.$store.commit('general/bump_route_reload', r.name)
      }
    },
    /**
     * Cierra listeners Pusher de badge de soporte y limpia referencia.
     */
    teardown_support_badge_socket() {
      if (this.support_badge_socket_instance && this.support_badge_socket_instance.disconnect) {
        this.support_badge_socket_instance.disconnect()
      }
      this.support_badge_socket_instance = null
    },
    /**
     * Reconstruye socket global de soporte: deja canales viejos, fetch inicial y nueva suscripción si hay admin.
     */
    rebuild_support_badge_socket() {
      const self = this
      this.teardown_support_badge_socket()
      if (!this.current_admin_id) {
        return
      }
      this.$store.dispatch('support_ticket/fetch_unread_badges').then(function () {
        if (self.current_admin_id) {
          self.support_badge_socket_instance = useSupportBadgeSocket({ admin_id: self.current_admin_id })
        }
      })
    },
    /**
     * Deja el canal leads.admins y limpia la referencia a la instancia de socket.
     */
    teardown_lead_socket() {
      if (this.lead_socket_instance && this.lead_socket_instance.disconnect) {
        this.lead_socket_instance.disconnect()
      }
      this.lead_socket_instance = null
    },
    /**
     * Reconstruye socket de leads: fetch inicial de no leídos y suscripción Pusher.
     */
    rebuild_lead_socket() {
      const self = this
      this.teardown_lead_socket()
      if (!this.current_admin_id) {
        return
      }
      this.$store.dispatch('lead/fetch_unread_badges').then(function () {
        if (self.current_admin_id) {
          self.lead_socket_instance = useLeadSocket({ admin_id: self.current_admin_id })
        }
      })
    },
    /**
     * Pide la lista de tareas al backend para alimentar el badge del menú (sin bloquear la UI).
     *
     * @returns {void}
     */
    refresh_task_nav_count() {
      if (!this.current_admin_id) {
        return
      }
      this.$store.dispatch('task/get_models').catch(function () {
        return null
      })
    },
    logout() {
      const self = this
      this.on_close_mobile()
      this.$store.dispatch('auth/logout').then(function () {
        self.$router.push({ name: 'login' })
      })
    },
  },
}
</script>
<style lang="sass" scoped>
.app-nav
  background: #333
  position: relative
  transition: width 0.2s ease

.app-nav-inner
  width: 15rem
  transition: width 0.2s ease
  position: relative

.app-nav--collapsed .app-nav-inner
  width: 3.75rem
  padding-left: 0.5rem !important
  padding-right: 0.5rem !important

.app-nav .nav-link
  position: relative

.app-nav-collapse-toggle
  align-self: stretch

/* Badge compacto al lado del texto "Soporte" (coherente con Support.vue). */
.nav-support-unread-badge
  font-size: 0.65rem
  min-width: 1.1rem
  line-height: 1.1
  padding: 0.12em 0.4em
  vertical-align: text-top

.nav-support-unread-badge--dot
  font-size: 0.55rem
  min-width: 0.95rem
  padding: 0.1em 0.25em

@media (max-width: 767.98px)
  .app-nav
    position: fixed
    top: 0
    left: 0
    height: 100vh
    width: 80vw
    max-width: 80vw
    border: none
    background: transparent
    /* Por encima de la barra superior (1030), por debajo de modales Bootstrap (1050+). */
    z-index: 1040
    transform: translateX(-100%)
    visibility: hidden
    opacity: 0
    transition: transform 0.25s ease, visibility 0.25s ease, opacity 0.25s ease
    pointer-events: none

  .app-nav--mobile-open
    transform: translateX(0)
    visibility: visible
    opacity: 1
    pointer-events: auto

  .app-nav-inner
    width: 100%
    max-width: 80vw
    height: 100vh
    box-shadow: 4px 0 16px rgba(0, 0, 0, 0.2)
    background: #333
    overflow-y: auto
</style>
