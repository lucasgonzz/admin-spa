<template>
  <div class="pwa-install-section">
    <p class="text-muted small mb-3">
      Instalá ComercioCity en <strong>este dispositivo</strong> para acceder más rápido desde la
      pantalla de inicio y recibir notificaciones aunque el navegador esté cerrado. La opción solo
      aparece en navegadores compatibles (Chrome / Edge) cuando la app todavía no está instalada.
    </p>

    <!-- El navegador ofrece instalar la app (capturamos beforeinstallprompt en App.vue). -->
    <template v-if="install_available">
      <button
        type="button"
        class="btn btn-primary btn-sm"
        :disabled="installing"
        @click="on_install_click"
      >
        {{ installing ? 'Instalando…' : 'Instalar ComercioCity en este dispositivo' }}
      </button>

      <!-- Falla del diálogo nativo: el usuario puede instalar desde el menú del navegador. -->
      <p v-if="install_error" class="text-danger small mt-3 mb-0">
        No se pudo instalar. Intentá desde el menú del navegador.
      </p>
    </template>

    <!-- App ya instalada, o navegador sin soporte de instalación (Safari/Firefox). -->
    <div v-else class="alert alert-secondary small mb-0">
      La aplicación ya está instalada en este dispositivo o tu navegador no permite instalarla
      desde acá. En ese caso usá la opción «Instalar app» / «Agregar a pantalla de inicio» del
      menú del navegador.
    </div>
  </div>
</template>

<script>
/**
 * Sección en Cuenta: instala la PWA en el dispositivo actual usando el evento
 * beforeinstallprompt que App.vue captura y guarda en window.__pwa_install_prompt.
 *
 * El botón solo se muestra cuando el navegador ofreció la instalación y la app
 * todavía no está instalada. Al completarse la instalación (evento appinstalled,
 * reenviado como 'pwa-installed') el botón se oculta.
 */
export default {
  name: 'PwaInstallSection',
  data() {
    return {
      /** true si el evento beforeinstallprompt está disponible (app no instalada aún). */
      install_available: !!window.__pwa_install_prompt,
      /** Evita doble click mientras el diálogo de instalación está abierto. */
      installing: false,
      /** Marca un fallo del diálogo nativo para mostrar el mensaje de error. */
      install_error: false,
    }
  },
  mounted() {
    // App.vue reenvía estos eventos custom para reaccionar sin hacer polling de window.
    window.addEventListener('pwa-install-available', this.on_prompt_available)
    window.addEventListener('pwa-installed', this.on_app_installed)
  },
  beforeUnmount() {
    // Limpieza de listeners para no acumular handlers al remontar la vista.
    window.removeEventListener('pwa-install-available', this.on_prompt_available)
    window.removeEventListener('pwa-installed', this.on_app_installed)
  },
  methods: {
    /**
     * El navegador ofreció instalar la app: muestra el botón y limpia errores previos.
     *
     * @returns {void}
     */
    on_prompt_available() {
      this.install_available = true
      this.install_error = false
    },

    /**
     * La app quedó instalada: oculta el botón de instalación.
     *
     * @returns {void}
     */
    on_app_installed() {
      this.install_available = false
    },

    /**
     * Dispara el diálogo nativo de instalación y reacciona al resultado del usuario.
     * Usa el evento diferido guardado por App.vue en window.__pwa_install_prompt.
     *
     * @returns {void}
     */
    on_install_click() {
      var self = this
      /** Evento beforeinstallprompt diferido capturado por App.vue. */
      var install_prompt = window.__pwa_install_prompt
      if (!install_prompt || self.installing) {
        return
      }
      self.installing = true
      self.install_error = false
      // prompt() abre el diálogo nativo; userChoice resuelve con la decisión del usuario.
      install_prompt.prompt()
      install_prompt.userChoice
        .then(function (choice) {
          if (choice && choice.outcome === 'accepted') {
            // El evento appinstalled termina de limpiar; acá solo ocultamos el botón.
            self.install_available = false
          }
          // Si outcome === 'dismissed', el usuario cerró el diálogo: el botón sigue visible.
          // El evento diferido solo puede usarse una vez, así que lo descartamos siempre.
          window.__pwa_install_prompt = null
        })
        .catch(function (err) {
          console.error('PWA install error:', err)
          self.install_error = true
        })
        .then(function () {
          self.installing = false
        })
    },
  },
}
</script>
