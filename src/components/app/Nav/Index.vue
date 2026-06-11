<template>
  <aside
    class="app-nav"
    :class="nav_root_classes"
    :aria-hidden="is_mobile_viewport && !mobile_open ? 'true' : 'false'"
    @mouseenter="on_nav_mouse_enter"
    @mouseleave="on_nav_mouse_leave"
  >
    <div class="app-nav-inner d-flex flex-column">
      <div
        v-if="!is_mobile_viewport"
        class="app-nav-header"
      >
        <span v-show="show_nav_labels" class="app-nav-header__title">ComercioCity</span>
        <span v-show="!show_nav_labels" class="app-nav-header__title app-nav-header__title--compact" title="ComercioCity">CC</span>
      </div>

      <nav class="app-nav-menu flex-grow-1">
        <template v-for="r in nav_routes">
          <!-- Ítem con submenú (children): toggle expandible en lugar de router-link -->
          <div
            v-if="r.children && r.children.length"
            :key="'nav-group-' + r.path"
            class="app-nav-group"
          >
            <div
              class="app-nav-route route app-nav-group-trigger"
              :class="{ 'active-item': is_group_active(r) }"
              :title="nav_link_title(r)"
              @click="toggle_group(r)"
            >
              <div class="menu-trigger">
                <div class="ruta-principal">
                  <div class="route-text-block">
                    <span class="route-text">{{ r.text }}</span>
                    <span
                      v-if="show_nav_labels && r.name === 'implementations' && implementations_ready_count > 0"
                      class="badge bg-danger rounded-pill nav-support-unread-badge"
                      :title="'Implementaciones listas para avanzar: ' + implementations_ready_count"
                    >
                      {{ implementations_ready_count > 99 ? '99+' : implementations_ready_count }}
                    </span>
                  </div>
                  <div class="route-icon-badge-wrap">
                    <i :class="[icon(r), 'route-icon']" />
                    <span
                      v-if="!show_nav_labels && r.name === 'implementations' && implementations_ready_count > 0"
                      class="badge rounded-pill bg-danger nav-support-unread-badge nav-support-unread-badge--dot"
                      :title="'Implementaciones listas para avanzar: ' + implementations_ready_count"
                    >
                      {{ implementations_ready_count > 9 ? '9+' : implementations_ready_count }}
                    </span>
                    <i
                      v-if="show_nav_labels"
                      class="bi route-caret"
                      :class="is_group_expanded(r) ? 'bi-chevron-up' : 'bi-chevron-down'"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Submenú con los hijos: visible solo expandido y con labels mostrados -->
            <div v-show="show_nav_labels && is_group_expanded(r)" class="app-nav-submenu">
              <router-link
                v-for="child in r.children"
                :key="'nav-child-' + child.path"
                class="app-nav-route route route--child"
                :class="{ 'active-item': is_nav_item_active(child) }"
                active-class=""
                :to="child.path"
                @mouseenter="on_nav_link_hover(child)"
                @click="on_nav_link_click(child)"
              >
                <div class="menu-trigger">
                  <div class="ruta-principal">
                    <div class="route-text-block">
                      <span class="route-text">{{ child.text }}</span>
                    </div>
                  </div>
                </div>
              </router-link>
            </div>
          </div>

          <router-link
            v-else-if="!r.meta || !r.meta.disabled"
            :key="'nav-' + r.path"
            class="app-nav-route route"
            :class="{ 'active-item': is_nav_item_active(r) }"
            active-class=""
            :to="r.path"
            :title="nav_link_title(r)"
            @mouseenter="on_nav_link_hover(r)"
            @click="on_nav_link_click(r)"
          >
            <div class="menu-trigger">
              <div class="ruta-principal">
                <div class="route-text-block">
                  <span class="route-text">{{ r.text }}</span>
                  <span
                    v-if="show_nav_labels && r.name === 'support' && support_unread_mine > 0"
                    class="badge bg-danger rounded-pill nav-support-unread-badge"
                    :title="'Mensajes de usuario sin leer en tus tickets: ' + support_unread_mine"
                  >
                    {{ support_unread_mine > 99 ? '99+' : support_unread_mine }}
                  </span>
                  <span
                    v-if="show_nav_labels && r.name === 'leads' && leads_unread_total > 0"
                    class="badge bg-danger rounded-pill nav-support-unread-badge"
                    :title="'Mensajes del lead sin leer: ' + leads_unread_total"
                  >
                    {{ leads_unread_total > 99 ? '99+' : leads_unread_total }}
                  </span>
                  <span
                    v-if="show_nav_labels && r.name === 'tasks' && tasks_pending_assigned_mine > 0"
                    class="badge bg-danger rounded-pill nav-support-unread-badge"
                    :title="'Tareas pendientes asignadas a vos: ' + tasks_pending_assigned_mine"
                  >
                    {{ tasks_pending_assigned_mine > 99 ? '99+' : tasks_pending_assigned_mine }}
                  </span>
                  <span
                    v-if="show_nav_labels && r.name === 'implementations' && implementations_ready_count > 0"
                    class="badge bg-danger rounded-pill nav-support-unread-badge"
                    :title="'Implementaciones listas para avanzar: ' + implementations_ready_count"
                  >
                    {{ implementations_ready_count > 99 ? '99+' : implementations_ready_count }}
                  </span>
                </div>
                <div class="route-icon-badge-wrap">
                  <i :class="[icon(r), 'route-icon']" />
                  <span
                    v-if="!show_nav_labels && r.name === 'support' && support_unread_mine > 0"
                    class="badge rounded-pill bg-danger nav-support-unread-badge nav-support-unread-badge--dot"
                    :title="'Mensajes sin leer: ' + support_unread_mine"
                  >
                    {{ support_unread_mine > 9 ? '9+' : support_unread_mine }}
                  </span>
                  <span
                    v-if="!show_nav_labels && r.name === 'leads' && leads_unread_total > 0"
                    class="badge rounded-pill bg-danger nav-support-unread-badge nav-support-unread-badge--dot"
                    :title="'Mensajes del lead sin leer: ' + leads_unread_total"
                  >
                    {{ leads_unread_total > 9 ? '9+' : leads_unread_total }}
                  </span>
                  <span
                    v-if="!show_nav_labels && r.name === 'tasks' && tasks_pending_assigned_mine > 0"
                    class="badge rounded-pill bg-danger nav-support-unread-badge nav-support-unread-badge--dot"
                    :title="'Tareas pendientes: ' + tasks_pending_assigned_mine"
                  >
                    {{ tasks_pending_assigned_mine > 9 ? '9+' : tasks_pending_assigned_mine }}
                  </span>
                  <span
                    v-if="!show_nav_labels && r.name === 'implementations' && implementations_ready_count > 0"
                    class="badge rounded-pill bg-danger nav-support-unread-badge nav-support-unread-badge--dot"
                    :title="'Implementaciones listas para avanzar: ' + implementations_ready_count"
                  >
                    {{ implementations_ready_count > 9 ? '9+' : implementations_ready_count }}
                  </span>
                </div>
              </div>
            </div>
          </router-link>

          <span
            v-else
            :key="'nav-disabled-' + r.path"
            class="app-nav-route route route--disabled"
            :title="nav_link_title(r)"
          >
            <div class="menu-trigger">
              <div class="ruta-principal">
                <div class="route-text-block">
                  <span class="route-text">{{ r.text }}</span>
                  <span v-show="show_nav_labels" class="badge text-bg-warning nav-support-unread-badge">Próximamente</span>
                </div>
                <div class="route-icon-badge-wrap">
                  <i :class="[icon(r), 'route-icon']" />
                </div>
              </div>
            </div>
          </span>
        </template>

        <a
          href="#"
          class="app-nav-route route route--logout"
          :title="nav_link_title({ text: 'Salir' })"
          @click.prevent="logout"
        >
          <div class="menu-trigger">
            <div class="ruta-principal">
              <div class="route-text-block">
                <span class="route-text">Salir</span>
              </div>
              <div class="route-icon-badge-wrap">
                <i class="bi bi-box-arrow-right route-icon" />
              </div>
            </div>
          </div>
        </a>
      </nav>
    </div>
  </aside>
</template>

<script>
import routes, { prefetch_route_component } from '@/router/routes'
import { useSupportBadgeSocket } from '@/composables/useSupportBadgeSocket'
import { useLeadSocket } from '@/composables/useLeadSocket'

/**
 * Menú lateral fijo: en desktop queda colapsado (solo íconos visibles a la derecha)
 * y se expande al pasar el mouse, igual que empresa-spa.
 * En móvil funciona como drawer controlado por App.vue.
 * Mantiene suscripción Pusher a canales admin de soporte para el badge de no leídos en "Soporte".
 * Mantiene suscripción Pusher al canal `leads.admins` para actualizar leads en tiempo real.
 * Mantiene suscripción Pusher al canal `admin-implementations` para el badge de implementaciones
 * listas para avanzar de etapa.
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
    /** En móvil: drawer visible. */
    mobile_open: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['close-mobile'],
  data() {
    return {
      // Rutas declaradas con meta.nav para armar el menú.
      routes: routes,
      /**
       * true cuando el puntero está sobre la barra en desktop (expande textos y badges completos).
       */
      nav_hovered: false,
      /**
       * Instancia devuelta por useSupportBadgeSocket; se libera en teardown o al cambiar de admin.
       */
      support_badge_socket_instance: null,
      /**
       * Instancia devuelta por useLeadSocket; se libera en teardown o al cambiar de admin.
       */
      lead_socket_instance: null,

      /**
       * Canal Pusher suscrito para el evento `implementation.stage.completed`.
       * Se guarda para poder hacer leave() en teardown o al cambiar de admin.
       */
      _implementations_nav_channel: null,

      /**
       * Estado expandido/colapsado de los grupos del menú con submenú (keyed por r.name).
       */
      expanded_groups: {},
    }
  },
  computed: {
    nav_routes() {
      return this.routes.filter((r) => r.meta && r.meta.nav)
    },
    /**
     * Clases del contenedor según drawer móvil abierto.
     */
    nav_root_classes() {
      return {
        'app-nav--mobile-open': this.is_mobile_viewport && this.mobile_open,
      }
    },
    /**
     * Muestra textos y badges expandidos en desktop con hover o cuando el drawer móvil está abierto.
     */
    show_nav_labels() {
      if (this.is_mobile_viewport) {
        return this.mobile_open
      }
      return this.nav_hovered
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
     * Cantidad de implementaciones que completaron su conversación automática
     * y están esperando que el admin presione "Avanzar etapa".
     * Alimenta el badge verde en el ítem "Implementaciones" del menú.
     *
     * @returns {number}
     */
    implementations_ready_count() {
      const n = parseInt(this.$store.state.implementation.ready_to_advance_count, 10)
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
        this.refresh_implementations_ready_count()
        this.rebuild_implementations_nav_socket()
      },
    },
  },
  beforeUnmount() {
    this.teardown_support_badge_socket()
    this.teardown_lead_socket()
    this.teardown_implementations_nav_socket()
  },
  methods: {
    /**
     * Marca la barra como expandida en desktop al entrar con el mouse.
     *
     * @returns {void}
     */
    on_nav_mouse_enter() {
      if (!this.is_mobile_viewport) {
        this.nav_hovered = true
      }
    },
    /**
     * Restaura el estado colapsado en desktop al salir con el mouse.
     *
     * @returns {void}
     */
    on_nav_mouse_leave() {
      if (!this.is_mobile_viewport) {
        this.nav_hovered = false
      }
    },
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
     * Resalta el ítem activo de inmediato (pending_nav_path) o según la ruta confirmada.
     *
     * @param {object} r Definición de ruta del menú
     * @returns {boolean}
     */
    is_nav_item_active(r) {
      if (!r || !r.path) {
        return false
      }
      const pending_path = this.$store.state.general.pending_nav_path
      if (pending_path && pending_path === r.path) {
        return true
      }
      return this.$route.path === r.path
    },
    /**
     * Indica si algún hijo del grupo es la ruta activa actual.
     *
     * @param {object} r Definición de ruta padre con children.
     * @returns {boolean}
     */
    is_group_active(r) {
      if (!r || !r.children) {
        return false
      }
      const self = this
      return r.children.some(function (child) {
        return self.is_nav_item_active(child)
      })
    },
    /**
     * Indica si el grupo debe mostrarse expandido: por toggle manual o porque
     * uno de sus hijos es la ruta activa.
     *
     * @param {object} r Definición de ruta padre con children.
     * @returns {boolean}
     */
    is_group_expanded(r) {
      if (!r || !r.name) {
        return false
      }
      if (this.expanded_groups[r.name]) {
        return true
      }
      return this.is_group_active(r)
    },
    /**
     * Alterna el estado expandido/colapsado de un grupo del menú.
     *
     * @param {object} r Definición de ruta padre con children.
     * @returns {void}
     */
    toggle_group(r) {
      if (!r || !r.name) {
        return
      }
      // Reasignar el objeto para asegurar reactividad en Vue 3.
      this.expanded_groups = Object.assign({}, this.expanded_groups, {
        [r.name]: !this.is_group_expanded(r),
      })
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
      if (r && r.path) {
        this.$store.commit('general/set_pending_nav_path', r.path)
      }
      if (r && r.name && this.$route.name === r.name) {
        this.$store.commit('general/set_route_navigating', true)
        this.$store.commit('general/bump_route_reload', r.name)
      }
    },
    /**
     * Precarga el chunk de la vista al pasar el mouse (reduce demora al hacer clic).
     *
     * @param {object} r Definición de ruta del menú
     * @returns {void}
     */
    on_nav_link_hover(r) {
      prefetch_route_component(r)
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
    /**
     * Consulta al backend el conteo inicial de implementaciones listas para avanzar.
     * Se llama al montar el Nav y al cambiar de sesión.
     *
     * @returns {void}
     */
    refresh_implementations_ready_count() {
      if (!this.current_admin_id) {
        return
      }
      this.$store.dispatch('implementation/fetch_ready_to_advance_count').catch(function () {
        return null
      })
    },

    /**
     * Libera el canal Pusher de implementaciones y limpia la referencia.
     *
     * @returns {void}
     */
    teardown_implementations_nav_socket() {
      const echo = window.admin_support_echo

      if (!echo || !this._implementations_nav_channel) {
        this._implementations_nav_channel = null
        return
      }

      echo.leave('admin-implementations')
      this._implementations_nav_channel = null
    },

    /**
     * Suscribe el Nav al canal `admin-implementations` para incrementar el badge
     * cuando una etapa se completa automáticamente (evento `.implementation.stage.completed`).
     *
     * Si ya existe una suscripción previa (cambio de sesión), la destruye primero.
     *
     * @returns {void}
     */
    rebuild_implementations_nav_socket() {
      const self = this

      this.teardown_implementations_nav_socket()

      if (!this.current_admin_id) {
        return
      }

      const echo = window.admin_support_echo

      if (!echo) {
        return
      }

      /* Suscribirse al canal compartido de implementaciones. */
      self._implementations_nav_channel = echo.channel('admin-implementations')

      /*
       * Al completarse una etapa automáticamente: el cliente terminó su conversación
       * y ahora el admin necesita presionar "Avanzar etapa".
       * Incrementar el badge del Nav para alertar al admin.
       */
      self._implementations_nav_channel.listen('.implementation.stage.completed', function () {
        self.$store.commit('implementation/increment_ready_to_advance_count')
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
/* Tokens visuales alineados con empresa-spa (nav-vertical). */
$nav_width: 220px
$nav_collapsed_visible: 56px
$nav_collapsed_offset: $nav_width - $nav_collapsed_visible
$nav_bg: #16181d
$nav_border: rgba(255, 255, 255, 0.06)
$nav_text: rgba(255, 255, 255, 0.72)
$nav_text_muted: rgba(255, 255, 255, 0.5)
$nav_hover_bg: rgba(255, 255, 255, 0.06)
$nav_active_bg: rgba(#007bff, 0.14)
$nav_item_radius: 8px
$nav_blue: #007bff

.app-nav
	position: fixed
	top: 0
	left: 0
	width: $nav_width
	height: 100vh
	z-index: 1000
	background: $nav_bg
	border-right: 1px solid $nav_border
	overflow-y: auto
	overflow-x: hidden
	transition: transform 0.22s ease, box-shadow 0.22s ease
	-ms-overflow-style: none !important
	scrollbar-width: none !important
	&::-webkit-scrollbar
		display: none !important

.app-nav-inner
	width: 100%
	min-height: 100vh
	padding: 12px 0 16px

.app-nav-header
	display: flex
	align-items: center
	justify-content: flex-end
	padding: 8px 14px 14px
	border-bottom: 1px solid $nav_border
	margin-bottom: 8px

.app-nav-header__title
	color: #ffffff
	font-size: 0.9375rem
	font-weight: 600
	letter-spacing: -0.01em
	white-space: nowrap

.app-nav-header__title--compact
	font-size: 0.8125rem
	opacity: 0.85

.app-nav-menu
	display: flex
	flex-direction: column

.app-nav-route
	display: block
	text-decoration: none
	color: inherit

.route
	width: calc(100% - 16px)
	margin: 2px 8px
	color: $nav_text
	font-size: 1rem
	font-weight: 500
	line-height: 1.35
	cursor: pointer
	border-radius: $nav_item_radius
	transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease
	&:hover
		background: $nav_hover_bg
		color: #ffffff
		.route-icon
			color: #ffffff

.route--disabled
	cursor: default
	opacity: 0.55
	&:hover
		background: transparent
		color: $nav_text

.route--logout
	margin-top: 12px
	color: $nav_text_muted

.menu-trigger
	width: 100%
	display: flex
	flex-direction: column

.ruta-principal
	display: flex
	flex-direction: row
	justify-content: space-between
	align-items: center
	padding: 10px 12px 10px 14px
	cursor: pointer
	gap: 10px

.route-text-block
	flex: 1
	display: flex
	align-items: center
	min-width: 0
	gap: 6px

.route-text
	flex: 1
	text-align: left
	white-space: nowrap
	overflow: hidden
	text-overflow: ellipsis

.route-icon-badge-wrap
	position: relative
	flex-shrink: 0
	display: flex
	align-items: center
	justify-content: center
	width: 22px
	min-height: 22px

.route-icon
	font-size: 1.1rem
	width: 20px
	text-align: center
	color: $nav_text_muted
	transition: color 0.15s ease

.active-item
	background: $nav_active_bg
	color: #ffffff
	font-weight: 600
	box-shadow: inset 3px 0 0 0 $nav_blue
	.route-icon
		color: $nav_blue

.nav-support-unread-badge
	font-size: 0.65rem
	min-width: 1.1rem
	line-height: 1.1
	padding: 0.12em 0.4em
	vertical-align: text-top

.nav-support-unread-badge--dot
	position: absolute
	top: -6px
	right: -8px
	min-width: 16px
	height: 16px
	padding: 0 4px
	margin: 0
	display: inline-flex
	align-items: center
	justify-content: center
	font-size: 0.625rem
	font-weight: 700
	line-height: 1
	border-radius: 999px
	box-shadow: 0 0 0 2px $nav_bg

// Grupo del menú con submenú (ítem padre + hijos)
.app-nav-group
	display: flex
	flex-direction: column

// Disparador del grupo: se comporta como un ítem pero no navega
.app-nav-group-trigger
	cursor: pointer

// Chevron de expandir/colapsar del grupo
.route-caret
	font-size: 0.75rem
	margin-left: 6px
	color: $nav_text_muted

// Contenedor de subítems
.app-nav-submenu
	display: flex
	flex-direction: column

// Subítem (hijo) indentado y con tipografía levemente menor
.route--child
	font-size: 0.9rem
	.ruta-principal
		padding-left: 28px
	.route-text
		color: $nav_text_muted
	&:hover .route-text
		color: #ffffff
	&.active-item .route-text
		color: #ffffff

@media (min-width: 768px)
	.app-nav
		transform: translateX(-$nav_collapsed_offset)
		&:hover
			transform: translateX(0)
			box-shadow: 4px 0 24px rgba(15, 23, 42, 0.18)

@media (max-width: 767.98px)
	.app-nav
		width: 80vw
		max-width: 80vw
		border: none
		background: transparent
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
		background: $nav_bg
		overflow-y: auto
</style>
