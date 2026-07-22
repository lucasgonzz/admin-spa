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
    class="d-flex h-100 min-h-0 app-root mx-auto w-100"
    :class="{
      'app-root--mobile': is_mobile_viewport,
      'app-root--no-nav': !show_nav,
    }"
  >
    <!-- Banner de actualización de PWA -->
    <div
      v-if="pwa_update_available"
      class="pwa-update-banner d-flex align-items-center justify-content-between gap-2 px-3 py-2"
      role="alert"
    >
      <span class="small fw-semibold">
        <i class="bi bi-arrow-repeat me-1" aria-hidden="true" />
        Nueva versión disponible
      </span>
      <button
        type="button"
        class="btn btn-sm btn-light"
        @click="on_pwa_update_click"
      >
        Actualizar sistema
      </button>
    </div>

    <!-- Banner de tiempo virtual activo (solo en desarrollo local) -->
    <div
      v-if="debug_virtual_time_available && debug_virtual_time_active"
      class="virtual-time-banner d-flex align-items-center justify-content-between gap-2 px-3 py-2"
      role="alert"
    >
      <span class="small fw-semibold">
        <i class="bi bi-clock-history me-1" aria-hidden="true" />
        TIEMPO VIRTUAL ACTIVO: {{ debug_virtual_time_label }}
      </span>
    </div>

    <div
      v-if="show_nav && is_mobile_viewport && nav_mobile_open"
      class="app-nav-mobile-backdrop d-md-none"
      aria-hidden="true"
      @click="close_mobile_nav"
    />

    <app-nav
      v-if="show_nav"
      :is_mobile_viewport="is_mobile_viewport"
      :mobile_open="nav_mobile_open"
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
      class="app-main-column flex-grow-1 d-flex flex-column h-100 min-h-0 overflow-hidden"
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

      <logo-loading />

      <main :class="main_content_class">
        <!--
          Vue 3: keep-alive debe envolver el componente de ruta (v-slot), no router-view.
          Así ViewLeads permanece en memoria al ir/volver desde lead_conversation y no
          se vuelve a ejecutar ResourceView.mounted → get_models.
        -->
        <router-view v-slot="{ Component }">
          <keep-alive :include="['ViewLeads']">
            <component
              :is="Component"
              v-if="Component"
              :key="router_view_key_for_non_cached"
            />
          </keep-alive>
        </router-view>
      </main>
    </div>

    <virtual-clock-panel
      v-if="debug_virtual_time_available"
      :virtual_time="debug_virtual_time_value"
      :is_active="debug_virtual_time_active"
      :real_time="debug_real_time"
      @updated="on_virtual_time_updated"
    />

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

    <!--
      Pila global de notificaciones in-app de tareas asignadas (prompt 10, grupo 180).
      Solo en el layout autenticado: nunca en login ni en rutas públicas (formulario cliente).
    -->
    <task-notification-stack v-if="show_task_notifications" />
  </div>
</template>

<script>
import AppNav from '@/components/app/Nav/Index.vue'
import LogoLoading from '@/common-vue/components/LogoLoading.vue'
import VirtualClockPanel from '@/components/debug/VirtualClockPanel.vue'
import TaskNotificationStack from '@/components/task/TaskNotificationStack.vue'
import routes from '@/router/routes'
import api from '@/utils/axios'

/**
 * Layout raíz: barra lateral fija + contenido. Oculta nav en login.
 * En desktop la barra queda colapsada y se expande al pasar el mouse (como empresa-spa).
 * En móvil queda oculta hasta abrir el drawer.
 */
export default {
  name: 'App',
  components: { AppNav, LogoLoading, VirtualClockPanel, TaskNotificationStack },
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
      /** MediaQueryList para detectar cambios de viewport sin polling. */
      mobile_media_query: null,
      /** true cuando hay una nueva versión del SW lista para activar. */
      pwa_update_available: false,
      /** true mientras se está chequeando o ejecutando seeders pendientes (evita doble disparo). */
      pending_seeders_checked: false,
      /** Debug: tiempo virtual (solo activo en entorno local — en producción el endpoint retorna 404). */
      debug_virtual_time_available: false,
      debug_virtual_time_active: false,
      debug_virtual_time_value: null,
      debug_real_time: null,
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
      /* Rutas públicas (formulario del cliente) y login: sin sidebar ni topbar móvil */
      if (this.$route.meta && this.$route.meta.public) {
        return false
      }
      if (this.$route.name === 'login') {
        return false
      }
      /*
       * Vistas fullscreen (p. ej. conversación WhatsApp): ocultar sidebar y barra
       * superior móvil para no tapar el header propio de la conversación.
       */
      if (this.$route.meta && this.$route.meta.hide_app_nav) {
        return false
      }
      return true
    },
    /**
     * true cuando corresponde mostrar la pila global de notificaciones in-app de tareas.
     * Se excluye login y rutas públicas (formulario de cliente), igual que `show_nav`,
     * pero a diferencia de `show_nav` SÍ se muestra en vistas fullscreen (hide_app_nav,
     * ej. conversación WhatsApp), porque un aviso de tarea asignada tiene que verse
     * igual ahí — el pedido de Lucas es que "no haya chance de que se le pase".
     *
     * @returns {boolean}
     */
    show_task_notifications() {
      if (this.$route.name === 'login') {
        return false
      }
      if (this.$route.meta && this.$route.meta.public) {
        return false
      }
      return true
    },
    /**
     * Rutas que ocupan toda el área útil sin padding del layout admin.
     *
     * @returns {boolean}
     */
    is_fullscreen_route() {
      if (this.$route.name === 'login') {
        return true
      }
      if (this.$route.meta && this.$route.meta.public) {
        return true
      }
      if (this.$route.meta && this.$route.meta.hide_app_nav) {
        return true
      }
      return false
    },
    /**
     * Clases del contenedor principal: sin padding en login para ocupar toda la pantalla.
     *
     * @returns {string}
     */
    main_content_class() {
      /** min-h-0: permite que overflow-auto en flex reciba scroll con rueda/trackpad. */
      const scroll_shell = 'flex-grow-1 min-h-0 overflow-auto app-main-scroll'
      if (this.is_fullscreen_route) {
        return scroll_shell + ' app-main--login'
      }
      if (this.show_nav) {
        return scroll_shell + ' app-main-with-nav'
      }
      return scroll_shell + ' p-2 p-md-3'
    },
    /**
     * Texto de la ruta activa para la barra superior móvil (coincide con el menú lateral).
     */
    /**
     * Key de router-view para vistas que NO están en keep-alive cache.
     * Para ViewLeads el keep-alive evita el remount, así que la ruta 'leads' recibe
     * siempre la misma key para no romper el cache; el hook activated() de Leads.vue
     * detecta el click en el menú a través de leads_reload_version.
     *
     * @returns {string}
     */
    router_view_key_for_non_cached() {
      const route_name = this.$route.name || 'unknown'
      /* Leads usa keep-alive: cambiar la key destruiría el cache. Devolver solo el nombre. */
      if (route_name === 'leads') {
        return route_name
      }
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
    /**
     * Texto legible del tiempo virtual para el banner: "sábado d/m H:mm".
     *
     * @returns {string}
     */
    debug_virtual_time_label() {
      return this.format_debug_virtual_time_label(this.debug_virtual_time_value)
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
     * Para Leads esta key no cambia (el cache no se destruye); el spinner se limpia
     * desde el hook activated() de Leads.vue.
     */
    router_view_key_for_non_cached() {
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
    /**
     * Al terminar el bootstrap de auth, consulta seeders pendientes si hay sesión admin.
     *
     * @param {boolean} is_ready
     * @returns {void}
     */
    session_ready(is_ready) {
      if (is_ready && this.$store.state.auth.admin && !this.pending_seeders_checked) {
        this.check_pending_seeders()
      }
    },
    /**
     * Tras login manual, session_ready ya es true; dispara el chequeo cuando aparece admin.
     *
     * @param {Object|null} admin
     * @returns {void}
     */
    '$store.state.auth.admin'(admin) {
      if (admin && this.session_ready && !this.pending_seeders_checked) {
        this.check_pending_seeders()
      }
    },
  },
  mounted() {
    /**
     * Listener global: recibe eventos emitidos por el interceptor de axios.
     */
    window.addEventListener('admin-spa-toast', this.on_global_toast)
    this.init_nav_viewport_listener()

    // Captura el evento nativo de instalación PWA lo antes posible, para que
    // PwaInstallSection (pantalla de Cuenta) pueda disparar el diálogo después.
    window.addEventListener('beforeinstallprompt', this.on_pwa_before_install_prompt)
    // Confirmación de que la app quedó instalada: limpia el evento guardado.
    window.addEventListener('appinstalled', this.on_pwa_app_installed)
    // Nueva versión del SW lista en waiting: muestra el banner de actualización.
    window.addEventListener('pwa-update-available', this.on_pwa_update_available)
    this.init_virtual_time()
  },
  beforeUnmount() {
    /**
     * Limpieza de listener para evitar duplicados al recrear App.
     */
    window.removeEventListener('admin-spa-toast', this.on_global_toast)
    this.teardown_nav_viewport_listener()
    window.removeEventListener('beforeinstallprompt', this.on_pwa_before_install_prompt)
    window.removeEventListener('appinstalled', this.on_pwa_app_installed)
    window.removeEventListener('pwa-update-available', this.on_pwa_update_available)
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
     * Intercepta el evento nativo beforeinstallprompt: evita que el navegador
     * muestre su mini-infobar y guarda el evento en window para que
     * PwaInstallSection pueda dispararlo manualmente desde el botón de Cuenta.
     *
     * @param {Event} event Evento beforeinstallprompt diferido.
     * @returns {void}
     */
    on_pwa_before_install_prompt(event) {
      event.preventDefault()
      // Acceso simple y global desde cualquier componente sin store dedicado.
      window.__pwa_install_prompt = event
      // Aviso reactivo (sin polling) para que la sección muestre el botón.
      window.dispatchEvent(new Event('pwa-install-available'))
    },

    /**
     * La app terminó de instalarse: descarta el evento guardado y avisa a la
     * sección para que oculte el botón de instalación.
     *
     * @returns {void}
     */
    on_pwa_app_installed() {
      window.__pwa_install_prompt = null
      window.dispatchEvent(new Event('pwa-installed'))
    },

    /**
     * El SW detectó una nueva versión lista: muestra el banner de actualización.
     *
     * @returns {void}
     */
    on_pwa_update_available() {
      this.pwa_update_available = true
    },

    /**
     * El usuario confirmó la actualización: invoca update_sw (skipWaiting + reload).
     *
     * @returns {void}
     */
    on_pwa_update_click() {
      if (typeof window.__pwa_update_sw === 'function') {
        window.__pwa_update_sw(true)
      } else {
        // Fallback: recarga forzada si por alguna razón la función no está disponible
        window.location.reload()
      }
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

    /**
     * Base URL de la API sin el sufijo /admin (endpoints /api/debug/*).
     *
     * @returns {string}
     */
    debug_api_base() {
      const admin_base = import.meta.env.VITE_API_URL || '/api/admin'
      const root = admin_base.replace(/\/admin\/?$/, '')
      return root || '/api'
    },
    /**
     * Consulta si el endpoint de tiempo virtual está disponible (solo local).
     * En producción responde 404 y el panel queda oculto sin errores visibles.
     *
     * @returns {void}
     */
    init_virtual_time() {
      const self = this
      api
        .get('/debug/virtual-time', {
          baseURL: self.debug_api_base(),
          silent_error: true,
        })
        .then(function (response) {
          const data = response.data
          self.debug_virtual_time_available = true
          self.debug_virtual_time_active = data.is_active
          self.debug_virtual_time_value = data.virtual_time
          self.debug_real_time = data.real_time
        })
        .catch(function () {
          self.debug_virtual_time_available = false
        })
    },
    /**
     * Sincroniza el estado del banner tras cambios desde VirtualClockPanel.
     *
     * @param {{ is_active: boolean, virtual_time: string|null, real_time: string }} payload
     * @returns {void}
     */
    on_virtual_time_updated(payload) {
      this.debug_virtual_time_active = payload.is_active
      this.debug_virtual_time_value = payload.virtual_time
      this.debug_real_time = payload.real_time
    },
    /**
     * Parsea el datetime virtual del backend en Date local (sin desfase por timezone).
     *
     * @param {string|null} virtual_time Valor Y-m-d H:i(:s) o ISO con T.
     * @returns {Date|null}
     */
    parse_debug_virtual_time_datetime(virtual_time) {
      if (!virtual_time) {
        return null
      }

      /** Cadena normalizada del valor recibido desde la API o el input datetime-local. */
      const raw_value = String(virtual_time).trim()
      /** Partes Y-m-d y hora opcional separada por espacio o T. */
      const parts_match = raw_value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/)

      if (parts_match) {
        return new Date(
          parseInt(parts_match[1], 10),
          parseInt(parts_match[2], 10) - 1,
          parseInt(parts_match[3], 10),
          parseInt(parts_match[4] || '0', 10),
          parseInt(parts_match[5] || '0', 10),
          parseInt(parts_match[6] || '0', 10)
        )
      }

      /** Fallback por si el backend devuelve otro formato parseable por el motor. */
      const fallback_date = new Date(raw_value)
      if (isNaN(fallback_date.getTime())) {
        return null
      }

      return fallback_date
    },
    /**
     * Formatea el tiempo virtual como "sábado d/m H:mm" para el banner superior.
     *
     * @param {string|null} virtual_time Valor crudo del override de tiempo virtual.
     * @returns {string}
     */
    format_debug_virtual_time_label(virtual_time) {
      if (!virtual_time) {
        return ''
      }

      /** Instante local construido desde el string del backend. */
      const parsed_date = this.parse_debug_virtual_time_datetime(virtual_time)
      if (!parsed_date) {
        return String(virtual_time)
      }

      /** Nombres de días en minúsculas, alineados al locale es-AR del resto del admin. */
      const weekday_names = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
      /** Día del mes y mes sin ceros a la izquierda (formato d/m pedido). */
      const day_of_month = parsed_date.getDate()
      const month_number = parsed_date.getMonth() + 1
      /** Hora y minutos en formato H:mm (minutos siempre con dos dígitos). */
      const hour = parsed_date.getHours()
      const minute = String(parsed_date.getMinutes()).padStart(2, '0')

      return (
        weekday_names[parsed_date.getDay()] +
        ' ' +
        day_of_month +
        '/' +
        month_number +
        ' ' +
        hour +
        ':' +
        minute
      )
    },
    /**
     * Consulta al backend si hay seeders pendientes de ejecución.
     * Si los hay, muestra un confirm; si el usuario acepta, los ejecuta.
     *
     * @returns {Promise<void>}
     */
    check_pending_seeders() {
      const self = this
      /* Evitar que se dispare más de una vez por sesión. */
      this.pending_seeders_checked = true

      return api.get('/pending-seeders')
        .then(function (response) {
          const data = response.data

          if (!data || !data.count || data.count === 0) {
            /* Sin pendientes: nada que hacer. */
            return
          }

          const list = data.pending
            .map(function (s) { return '• ' + s.description })
            .join('\n')

          const message =
            '⚠️ Hay ' + data.count + ' seeder' + (data.count === 1 ? '' : 's') + ' pendiente' + (data.count === 1 ? '' : 's') + ' de ejecución:\n\n' +
            list +
            '\n\n¿Ejecutarlos ahora?'

          const confirmed = window.confirm(message)

          if (!confirmed) {
            return
          }

          return self.run_pending_seeders()
        })
        .catch(function (err) {
          /* Error de red o endpoint inexistente: ignorar silenciosamente. */
          console.warn('[pending-seeders] Error al chequear seeders pendientes:', err)
        })
    },

    /**
     * Llama al endpoint que ejecuta todos los seeders pendientes y muestra el resultado.
     *
     * @returns {Promise<void>}
     */
    run_pending_seeders() {
      return api.post('/pending-seeders/run')
        .then(function (response) {
          const data = response.data

          if (!data || !data.results || data.results.length === 0) {
            window.alert('✅ No había seeders pendientes.')
            return
          }

          const ok_lines = data.results
            .filter(function (r) { return r.status === 'ok' })
            .map(function (r) { return '✅ ' + r.description })

          const error_lines = data.results
            .filter(function (r) { return r.status === 'error' })
            .map(function (r) { return '❌ ' + r.description + '\n   Error: ' + r.error })

          const all_lines = ok_lines.concat(error_lines)

          const summary =
            (data.error_count === 0
              ? '✅ Todos los seeders se ejecutaron correctamente.'
              : '⚠️ ' + data.ok_count + ' ejecutado' + (data.ok_count === 1 ? '' : 's') + ' correctamente, ' + data.error_count + ' con error.') +
            '\n\n' +
            all_lines.join('\n')

          window.alert(summary)
        })
        .catch(function (err) {
          window.alert('❌ Error al ejecutar los seeders. Revisá la consola del servidor.')
          console.error('[pending-seeders] Error al ejecutar seeders:', err)
        })
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

/* Móvil: el shell raíz no puede desbordar ni estirarse fuera del viewport. */
@media (max-width: 767.98px) {
  .app-root {
    width: 100%;
    max-width: 100vw;
    overflow-x: hidden;
    overscroll-behavior: none;
  }
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

/* Contenedor de scroll de vistas (Leads, Clientes, etc.): rueda y trackpad. */
.app-main-scroll {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

/* Desktop: margen mínimo tras la franja colapsada del nav (56px visible + 4px de respiro). */
@media (min-width: 768px) {
  .app-root:not(.app-root--mobile):not(.app-root--no-nav) .app-main-column {
    padding-left: 60px;
  }
}

/*
  Respiro horizontal uniforme de todos los módulos (referencia: Leads vía container-fluid).
  --app-module-gutter-x coincide con el gutter horizontal de Bootstrap (0.75rem).
  En móvil se suma el padding base del main (0.5rem) para igualar el total que tenía Leads.
*/
.app-main-with-nav {
  --app-module-gutter-x: 0.75rem;
  padding: 0.5rem;
  padding-left: calc(0.5rem + var(--app-module-gutter-x));
}

@media (min-width: 768px) {
  .app-root:not(.app-root--mobile) .app-main-with-nav {
    padding: 1rem;
    padding-left: var(--app-module-gutter-x);
  }
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

/* Banner de tiempo virtual activo — centrado, solo el ancho del contenido */
.virtual-time-banner {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2100;
  width: fit-content;
  max-width: calc(100vw - 2rem);
  background: #dc3545;
  color: #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  border-radius: 0 0 8px 8px;
  white-space: nowrap;
}

/* Banner de nueva versión disponible — fijo en la parte superior, sobre la UI */
.pwa-update-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 2000;
  background: #0d6efd;
  color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

  .btn-light {
    color: #0d6efd;
    font-weight: 600;
    white-space: nowrap;
  }
}
</style>
