<template>
  <div
    v-if="!session_ready"
    class="app-bootstrap-loading min-vh-100 d-flex flex-column align-items-center justify-content-center"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <span class="spinner-border text-primary" aria-hidden="true" />
    <span class="visually-hidden">Validando sesión…</span>
    <p class="text-muted small mt-3 mb-0">Cargando ComercioCity…</p>
  </div>

  <div
    v-else
    class="d-flex min-vh-100 app-root mx-auto w-100"
    :class="{ 'app-root--mobile': is_mobile_viewport }"
  >
    <div
      v-if="show_nav && is_mobile_viewport && nav_mobile_open"
      class="app-nav-mobile-backdrop d-md-none"
      aria-hidden="true"
      @click="close_mobile_nav"
    />

    <app-nav
      v-if="show_nav"
      class="flex-shrink-0"
      :is_mobile_viewport="is_mobile_viewport"
      :collapsed="nav_collapsed"
      :mobile_open="nav_mobile_open"
      @toggle-collapsed="toggle_nav_collapsed"
      @close-mobile="close_mobile_nav"
    />

    <header
      v-if="show_nav && is_mobile_viewport"
      class="app-mobile-topbar d-md-none"
    >
      <span class="app-mobile-topbar__title text-truncate">{{ current_route_text }}</span>
      <button
        type="button"
        class="btn btn-link app-mobile-topbar__toggle p-0"
        :aria-label="nav_mobile_open ? 'Ocultar menú de navegación' : 'Mostrar menú de navegación'"
        @click="toggle_mobile_nav"
      >
        <i class="bi fs-5" :class="nav_mobile_open ? 'bi-x-lg' : 'bi-list'" aria-hidden="true" />
      </button>
    </header>

    <div
      class="app-main-column flex-grow-1 d-flex flex-column min-vh-100 overflow-hidden"
      :class="{ 'app-main-column--mobile-topbar': show_nav && is_mobile_viewport }"
    >
      <div
        v-if="route_navigating"
        class="app-route-loading"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span class="spinner-border text-primary" aria-hidden="true" />
        <span class="visually-hidden">Cargando vista…</span>
        <p v-if="route_navigating_label" class="text-muted small mt-2 mb-0">{{ route_navigating_label }}</p>
      </div>

      <main :class="main_content_class">
        <router-view :key="router_view_key" />
      </main>
    </div>

    <div class="global-toast-container">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="alert alert-dismissible fade show shadow-sm mb-2"
        :class="'alert-' + toast.variant"
        role="alert"
      >
        {{ toast.message }}
        <button type="button" class="btn-close" aria-label="Close" @click="remove_toast(toast.id)"></button>
      </div>
    </div>
  </div>
</template>

<script>
import AppNav from '@/components/app/Nav/Index.vue'
import routes from '@/router/routes'

/** Clave localStorage para recordar si el menú lateral está contraído en desktop. */
const NAV_COLLAPSED_STORAGE_KEY = 'admin_spa_nav_collapsed'

/**
 * Layout raíz: barra lateral + contenido. Oculta nav en login.
 * En desktop la barra se puede contraer; en móvil queda oculta hasta abrir el drawer.
 */
export default {
  name: 'App',
  components: { AppNav },
  data() {
    return {
      /** Cola de toasts visibles para errores globales de API. */
      toasts: [],
      /** Contador incremental para keys estables del v-for. */
      next_toast_id: 1,
      /** Referencias de timeout por toast para autocierre. */
      toast_timeout_by_id: {},
      /** true si el viewport es menor que breakpoint md de Bootstrap (< 768px). */
      is_mobile_viewport: false,
      /** Drawer del menú visible en móvil. */
      nav_mobile_open: false,
      /** Menú lateral contraído (solo iconos) en desktop. */
      nav_collapsed: false,
      /** MediaQueryList para detectar cambios de viewport sin polling. */
      mobile_media_query: null,
    }
  },
  computed: {
    /**
     * true cuando bootstrap de auth terminó (token validado o ausente).
     */
    session_ready() {
      return this.$store.state.auth.session_ready
    },
    show_nav() {
      return this.$route.name !== 'login'
    },
    /**
     * Clases del contenedor principal: sin padding en login para ocupar toda la pantalla.
     *
     * @returns {string}
     */
    main_content_class() {
      if (this.$route.name === 'login') {
        return 'flex-grow-1 overflow-auto app-main--login'
      }
      return 'flex-grow-1 p-2 p-md-3 overflow-auto'
    },
    /**
     * Texto de la ruta activa para la barra superior móvil (coincide con el menú lateral).
     */
    /**
     * Key de router-view: cambia al recargar la misma ruta desde el menú (remount = created/mounted de nuevo).
     */
    router_view_key() {
      const route_name = this.$route.name || 'unknown'
      const versions = this.$store.state.general.route_reload_versions
      const reload_version = versions && versions[route_name] ? versions[route_name] : 0
      return route_name + '-' + String(reload_version)
    },
    /**
     * true mientras vue-router resuelve la navegación (chunk lazy + montaje inicial).
     */
    route_navigating() {
      return this.$store.state.general.route_navigating
    },
    /**
     * Etiqueta legible de la ruta destino durante la navegación (spinner global).
     */
    route_navigating_label() {
      const pending_path = this.$store.state.general.pending_nav_path
      const route_text = this.route_text_for_path(pending_path || this.$route.path)
      if (!route_text) {
        return 'Cargando…'
      }
      return 'Cargando ' + route_text + '…'
    },
    current_route_text() {
      const pending_path = this.$store.state.general.pending_nav_path
      if (pending_path) {
        const pending_text = this.route_text_for_path(pending_path)
        if (pending_text) {
          return pending_text
        }
      }
      const route_name = this.$route.name
      if (!route_name) {
        return 'ComercioCity'
      }
      const matched_text = this.route_text_for_name(route_name)
      if (matched_text) {
        return matched_text
      }
      if (this.$route.meta && this.$route.meta.title) {
        return String(this.$route.meta.title)
      }
      return 'ComercioCity'
    },
  },
  watch: {
    /**
     * Al cambiar de ruta en móvil, cierra el drawer para no tapar la nueva vista.
     */
    $route() {
      this.close_mobile_nav()
    },
    /**
     * Recarga del mismo ítem del menú (bump_route_reload): vue-router no dispara afterEach;
     * limpiamos el spinner cuando router-view remonta la vista.
     */
    router_view_key() {
      if (!this.$store.state.general.route_navigating) {
        return
      }
      const self = this
      this.$nextTick(function () {
        self.$store.commit('general/set_route_navigating', false)
        self.$store.commit('general/set_pending_nav_path', null)
      })
    },
    /**
     * Al pasar de móvil a desktop, resetea el drawer; al volver a móvil, fuerza cierre.
     */
    is_mobile_viewport(is_mobile) {
      if (!is_mobile) {
        this.nav_mobile_open = false
      }
    },
  },
  mounted() {
    /**
     * Listener global: recibe eventos emitidos por el interceptor de axios.
     */
    window.addEventListener('admin-spa-toast', this.on_global_toast)
    this.init_nav_viewport_listener()
    this.load_nav_collapsed_from_storage()
  },
  beforeUnmount() {
    /**
     * Limpieza de listener para evitar duplicados al recrear App.
     */
    window.removeEventListener('admin-spa-toast', this.on_global_toast)
    this.teardown_nav_viewport_listener()
  },
  methods: {
    /**
     * Texto legible de una ruta por su path (menú lateral / spinner).
     *
     * @param {string|null|undefined} path
     * @returns {string}
     */
    route_text_for_path(path) {
      if (!path) {
        return ''
      }
      let matched_text = ''
      routes.forEach(function (r) {
        if (r.path === path && r.text) {
          matched_text = r.text
        }
      })
      return matched_text
    },
    /**
     * Texto legible de una ruta por su name.
     *
     * @param {string|null|undefined} route_name
     * @returns {string}
     */
    route_text_for_name(route_name) {
      if (!route_name) {
        return ''
      }
      let matched_text = ''
      routes.forEach(function (r) {
        if (r.name === route_name && r.text) {
          matched_text = r.text
        }
      })
      return matched_text
    },
    /**
     * Lee preferencia de menú contraído guardada en localStorage (solo desktop).
     */
    load_nav_collapsed_from_storage() {
      const stored = window.localStorage.getItem(NAV_COLLAPSED_STORAGE_KEY)
      if (stored === '1') {
        this.nav_collapsed = true
      }
    },
    /**
     * Registra matchMedia (md) y sincroniza is_mobile_viewport.
     */
    init_nav_viewport_listener() {
      const self = this
      this.mobile_media_query = window.matchMedia('(max-width: 767.98px)')
      this.is_mobile_viewport = this.mobile_media_query.matches
      this.on_mobile_media_change = function () {
        self.is_mobile_viewport = self.mobile_media_query.matches
        if (self.is_mobile_viewport) {
          self.nav_mobile_open = false
        }
      }
      if (this.mobile_media_query.addEventListener) {
        this.mobile_media_query.addEventListener('change', this.on_mobile_media_change)
      } else {
        this.mobile_media_query.addListener(this.on_mobile_media_change)
      }
    },
    /**
     * Elimina listener de viewport al destruir App.
     */
    teardown_nav_viewport_listener() {
      if (!this.mobile_media_query || !this.on_mobile_media_change) {
        return
      }
      if (this.mobile_media_query.removeEventListener) {
        this.mobile_media_query.removeEventListener('change', this.on_mobile_media_change)
      } else {
        this.mobile_media_query.removeListener(this.on_mobile_media_change)
      }
    },
    /**
     * Muestra u oculta el drawer del menú en móvil (botón de la barra superior).
     */
    toggle_mobile_nav() {
      this.nav_mobile_open = !this.nav_mobile_open
    },
    /**
     * Cierra el drawer del menú en móvil.
     */
    close_mobile_nav() {
      this.nav_mobile_open = false
    },
    /**
     * Alterna menú contraído en desktop y persiste la preferencia.
     */
    toggle_nav_collapsed() {
      this.nav_collapsed = !this.nav_collapsed
      window.localStorage.setItem(NAV_COLLAPSED_STORAGE_KEY, this.nav_collapsed ? '1' : '0')
    },
    /**
     * Normaliza evento global y delega la creación de la toast.
     *
     * @param {CustomEvent} event
     * @returns {void}
     */
    on_global_toast(event) {
      /** Payload emitido desde utils/axios.js. */
      const detail = event && event.detail ? event.detail : {}
      /** Mensaje visible al usuario con fallback defensivo. */
      const message = detail.message ? String(detail.message) : 'Ocurrió un error inesperado.'
      /** Variante visual bootstrap (danger, warning, success, etc.). */
      const variant = detail.variant ? String(detail.variant) : 'danger'
      this.push_toast(message, variant)
    },
    /**
     * Inserta una toast en la cola y programa autocierre.
     *
     * @param {string} message
     * @param {string} variant
     * @returns {void}
     */
    push_toast(message, variant) {
      /** Id único local para controlar render y cierre. */
      const toast_id = this.next_toast_id
      this.next_toast_id += 1

      this.toasts.push({
        id: toast_id,
        message,
        variant,
      })

      /** Timeout de autocierre para no dejar toasts eternas en pantalla. */
      this.toast_timeout_by_id[toast_id] = window.setTimeout(() => {
        this.remove_toast(toast_id)
      }, 5000)
    },
    /**
     * Elimina una toast específica y limpia su timeout asociado.
     *
     * @param {number} toast_id
     * @returns {void}
     */
    remove_toast(toast_id) {
      this.toasts = this.toasts.filter((toast) => toast.id !== toast_id)
      if (this.toast_timeout_by_id[toast_id]) {
        window.clearTimeout(this.toast_timeout_by_id[toast_id])
        delete this.toast_timeout_by_id[toast_id]
      }
    },
  },
}
</script>

<style lang="scss">
.modal-xl {
  max-width: 1400px;
}

.global-toast-container {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 3000;
  width: min(420px, calc(100vw - 32px));
}

.app-bootstrap-loading {
  background-color: #f8f9fa;
}

.app-route-loading {
  position: absolute;
  inset: 0;
  z-index: 1020;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(248, 249, 250, 0.88);
  pointer-events: none;
}

.app-main-column {
  position: relative;
}

/* Login a pantalla completa: el layout interno centra la tarjeta sin márgenes del main. */
.app-main--login {
  padding: 0 !important;
  display: flex;
  flex-direction: column;
}

/* Barra superior fija en móvil: título de ruta a la izquierda, toggle menú a la derecha. */
.app-mobile-topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: 40px;
  z-index: 1030;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0 0.75rem;
  background: #fff;
  border-bottom: 1px solid #dee2e6;
  box-sizing: border-box;
}

.app-mobile-topbar__title {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  font-size: 0.95rem;
  line-height: 1.2;
}

.app-mobile-topbar__toggle {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #333;
  text-decoration: none;
}

.app-main-column--mobile-topbar {
  padding-top: 40px;
}

.app-nav-mobile-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  /* Debajo del drawer móvil (1040) y de modales Bootstrap (1050+). */
  z-index: 1035;
}

/* En móvil el nav no ocupa espacio en el flex; al abrirse usa hasta 80vw por encima de la barra superior. */
.app-root--mobile .app-nav {
  flex: 0 0 0 !important;
  width: 0 !important;
  min-width: 0 !important;
  max-width: 0 !important;
  padding: 0 !important;
  margin: 0 !important;
  border: none !important;
  overflow: hidden !important;
}

.app-root--mobile .app-nav.app-nav--mobile-open {
  width: 80vw !important;
  max-width: 80vw !important;
  overflow: visible !important;
}
</style>
