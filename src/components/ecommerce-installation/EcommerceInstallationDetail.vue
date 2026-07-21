<template>
  <div class="card mb-3 ecommerce-installation-card">
    <div class="card-header d-flex align-items-center flex-wrap gap-2">
      <div>
        <strong>Instalación / Actualización de la tienda</strong>
        <span v-if="client_ecommerce" class="text-muted small ms-2">
          Dominio: <code>{{ client_ecommerce.domain || 'Sin configurar' }}</code>
        </span>
      </div>
      <!-- Badge de estado del ClientEcommerce (pending/installing/active) -->
      <span
        v-if="client_ecommerce"
        class="badge ms-auto"
        :class="ecommerce_status_badge_class(client_ecommerce.status)"
      >
        {{ ecommerce_status_label(client_ecommerce.status) }}
      </span>
    </div>

    <div class="card-body">

      <!-- Cargando el estado inicial de la tienda -->
      <div v-if="loading" class="text-muted small">Cargando estado de la tienda…</div>

      <template v-else-if="client_ecommerce">

        <!-- Datos básicos de configuración de la tienda -->
        <dl class="row mb-3 small">
          <dt class="col-sm-3 text-muted">SPA</dt>
          <dd class="col-sm-9">
            <a v-if="client_ecommerce.spa_url" :href="client_ecommerce.spa_url" target="_blank" rel="noopener">
              {{ client_ecommerce.spa_url }}
            </a>
            <span v-else class="text-muted fst-italic">Sin configurar</span>
          </dd>
          <dt class="col-sm-3 text-muted">API</dt>
          <dd class="col-sm-9">
            <code v-if="client_ecommerce.api_url">{{ client_ecommerce.api_url }}</code>
            <span v-else class="text-muted fst-italic">Sin configurar</span>
          </dd>
        </dl>

        <!-- Aviso de campos faltantes antes de poder instalar/actualizar -->
        <div v-if="missing_fields.length" class="alert alert-warning py-2 small mb-3">
          Faltan configurar: <strong>{{ missing_fields_label }}</strong>. Completalos antes de instalar o actualizar la tienda.
        </div>

        <!-- Error de la última corrida, si falló -->
        <div
          v-if="latest_installation && latest_installation.status === 'fallida' && latest_installation.failure_reason"
          class="alert alert-danger py-2 small mb-3"
        >
          <strong>Error:</strong> {{ latest_installation.failure_reason }}
        </div>

        <!-- Botones de acción: bloqueados mientras haya una corrida en curso o falte configuración -->
        <div class="d-flex align-items-center gap-2 mb-3">
          <button
            type="button"
            class="btn btn-success btn-sm"
            :disabled="!can_run || starting_install"
            :title="action_disabled_title"
            @click="start_install"
          >
            {{ starting_install ? 'Iniciando...' : '▶ Instalar desde cero' }}
          </button>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="!can_run || starting_update"
            :title="action_disabled_title"
            @click="start_update"
          >
            {{ starting_update ? 'Iniciando...' : '⭯ Actualizar (última de master)' }}
          </button>
        </div>

        <!-- Panel de operaciones de la última corrida (log en vivo + checklist) -->
        <ecommerce-operations-panel v-if="latest_installation" :installation="latest_installation" />

        <p v-else class="text-muted small fst-italic mb-0">
          Todavía no se corrió ninguna instalación ni actualización para esta tienda.
        </p>

      </template>

    </div>
  </div>
</template>

<script>
import api from '@/utils/axios'
import EcommerceOperationsPanel from '@/components/ecommerce-installation/extra-props/EcommerceOperationsPanel.vue'

/**
 * Detalle y disparador del pipeline técnico de instalación/actualización del ecommerce
 * de un cliente (ClientEcommerceInstallation), embebido en la pestaña "Ecommerce" del
 * detalle del cliente (EcommerceImplementationTab.vue).
 *
 * Espeja a InstallationDetail.vue (pipeline de empresa): carga el estado de la tienda,
 * dispara instalación/actualización, y pollea la corrida en curso cada 2s mientras esté
 * 'instalando' contra el endpoint logs_json (prompt 585), reemplazando `latest_installation`
 * en cada tick para que EcommerceOperationsPanel reciba las líneas nuevas.
 */
export default {
  name: 'EcommerceInstallationDetail',

  components: { EcommerceOperationsPanel },

  props: {
    /** Id del ClientEcommerce cuyo pipeline se gestiona. */
    client_ecommerce_id: {
      type: Number,
      required: true,
    },
    /** Id del Client dueño de la tienda (lo necesita start_update, que resuelve el ecommerce en el backend). */
    client_id: {
      type: Number,
      required: true,
    },
  },

  data() {
    return {
      /** Tienda (ClientEcommerce) con sus corridas cargadas (installations). */
      client_ecommerce: null,

      /** Última corrida (instalación o actualización) de la tienda, la que se muestra/pollea. */
      latest_installation: null,

      /** true mientras se carga el estado inicial de la tienda. */
      loading: false,

      /** true mientras se dispara una instalación desde cero. */
      starting_install: false,

      /** true mientras se dispara una actualización. */
      starting_update: false,

      /** Timer de polling de la corrida en curso. */
      polling_timer: null,
    }
  },

  computed: {
    /**
     * Campos de configuración de la tienda que todavía faltan completar.
     *
     * @returns {Array<string>}
     */
    missing_fields() {
      if (!this.client_ecommerce) {
        return []
      }
      var ecommerce = this.client_ecommerce
      var fields = []
      if (!ecommerce.domain) fields.push('dominio')
      if (!ecommerce.spa_url) fields.push('URL del SPA')
      if (!ecommerce.api_url) fields.push('URL de la API')
      return fields
    },

    /** Texto legible de los campos faltantes, para el mensaje de aviso. */
    missing_fields_label() {
      return this.missing_fields.join(', ')
    },

    /**
     * Indica si se puede disparar una corrida: configuración completa y ninguna corrida
     * en curso ('instalando') para esta tienda.
     *
     * @returns {boolean}
     */
    can_run() {
      if (this.missing_fields.length > 0) {
        return false
      }
      return !this.latest_installation || this.latest_installation.status !== 'instalando'
    },

    /** Tooltip explicando por qué los botones están deshabilitados. */
    action_disabled_title() {
      if (this.missing_fields.length > 0) {
        return 'Faltan configurar: ' + this.missing_fields_label
      }
      if (this.latest_installation && this.latest_installation.status === 'instalando') {
        return 'Ya hay una corrida en curso para esta tienda'
      }
      return ''
    },
  },

  created() {
    this.load_client_ecommerce()
  },

  beforeUnmount() {
    this.stop_polling()
  },

  methods: {
    /**
     * Carga el ClientEcommerce (con sus installations, prompt 585 show_json) y arranca el
     * polling si la última corrida quedó en curso (ej. se recargó la página durante una
     * instalación). El show_json no trae los logs anidados (para no cargar todo el historial
     * de líneas en cada apertura del tab de cliente), así que además se hace un fetch de logs
     * una sola vez para poder mostrar el resultado de corridas ya terminadas.
     *
     * @returns {void}
     */
    load_client_ecommerce() {
      var self = this
      self.loading = true
      api.get('/client-ecommerce/' + self.client_ecommerce_id + '/installations')
        .then(function (res) {
          self.client_ecommerce = res.data.model
          var installations = (self.client_ecommerce && self.client_ecommerce.installations) || []
          self.latest_installation = installations.length ? installations[0] : null
          if (!self.latest_installation) {
            return
          }
          // Trae los logs de la última corrida (aunque ya haya terminado) para poder
          // mostrar el panel de operaciones con su resultado completo.
          self.poll_logs()
          if (self.latest_installation.status === 'instalando') {
            self.start_polling()
          }
        })
        .catch(function () {
          /* El interceptor de axios ya muestra el toast de error. */
        })
        .finally(function () {
          self.loading = false
        })
    },

    /**
     * Dispara una instalación desde cero de la tienda.
     *
     * @returns {void}
     */
    start_install() {
      var self = this
      self.starting_install = true
      self.$store.dispatch('ecommerce_installation/start_install', self.client_ecommerce_id)
        .then(function (res) {
          self.latest_installation = res.data.model
          self.start_polling()
        })
        .catch(function () {
          /* El interceptor ya muestra el error (ej. 422 si hay otra corrida en curso). */
        })
        .finally(function () {
          self.starting_install = false
        })
    },

    /**
     * Dispara una actualización (siempre última de master) de la tienda.
     *
     * @returns {void}
     */
    start_update() {
      var self = this
      self.starting_update = true
      self.$store.dispatch('ecommerce_installation/start_update', self.client_id)
        .then(function (res) {
          self.latest_installation = res.data.model
          self.start_polling()
        })
        .catch(function () {
          /* El interceptor ya muestra el error. */
        })
        .finally(function () {
          self.starting_update = false
        })
    },

    /**
     * Inicia el polling de la corrida en curso cada 2 segundos (logs_json, prompt 585).
     *
     * @returns {void}
     */
    start_polling() {
      if (this.polling_timer !== null) {
        return
      }
      var self = this
      self.polling_timer = setInterval(function () {
        self.poll_logs()
      }, 2000)
    },

    /**
     * Detiene el polling.
     *
     * @returns {void}
     */
    stop_polling() {
      if (this.polling_timer !== null) {
        clearInterval(this.polling_timer)
        this.polling_timer = null
      }
    },

    /**
     * Refresca las líneas de log y el status de la corrida en curso. Corta el polling
     * apenas el status deja de ser 'instalando' (completada o fallida).
     *
     * @returns {void}
     */
    poll_logs() {
      var self = this
      if (!self.latest_installation) {
        self.stop_polling()
        return
      }
      self.$store.dispatch('ecommerce_installation/fetch_logs', self.latest_installation.id)
        .then(function (res) {
          /* Reemplaza el objeto completo (status + logs) para que el watcher de logs del
             panel de operaciones detecte el cambio y haga scroll/expanda como corresponde. */
          self.latest_installation = Object.assign({}, self.latest_installation, {
            status: res.data.status,
            logs: res.data.models,
          })
          if (res.data.status !== 'instalando') {
            self.stop_polling()
          }
        })
        .catch(function () {
          /* Polling: silencia errores de red transitorios. */
        })
    },

    /**
     * Etiqueta legible del estado del ClientEcommerce.
     *
     * @param {string} status
     * @returns {string}
     */
    ecommerce_status_label(status) {
      var map = {
        pending: 'Pendiente',
        installing: 'Instalando',
        active: 'Activa',
      }
      return map[status] || status || '—'
    },

    /**
     * Clase Bootstrap del badge según el estado del ClientEcommerce.
     *
     * @param {string} status
     * @returns {string}
     */
    ecommerce_status_badge_class(status) {
      var map = {
        pending: 'bg-secondary',
        installing: 'bg-primary',
        active: 'bg-success',
      }
      return map[status] || 'bg-secondary'
    },
  },
}
</script>
