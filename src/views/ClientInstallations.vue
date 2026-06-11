<template>
  <div class="client-installations container-fluid py-4">

    <!-- Cabecera con nombre del cliente y botón para crear nueva instalación -->
    <div class="d-flex align-items-center flex-wrap gap-2 mb-4">
      <div>
        <h4 class="mb-0">Instalaciones del cliente</h4>
        <p v-if="client" class="text-muted small mb-0 mt-1">
          {{ client.name || client.business_name || 'Cliente #' + client_id }}
        </p>
      </div>
      <div class="ms-auto d-flex gap-2 align-items-center">
        <!-- Botón volver al listado de clientes -->
        <router-link to="/clientes" class="btn btn-sm btn-outline-secondary">
          ← Volver a clientes
        </router-link>
        <!-- Botón para crear una nueva instalación -->
        <button
          class="btn btn-sm btn-primary"
          :disabled="creating"
          @click="create_installation"
        >
          {{ creating ? 'Creando...' : '+ Nueva instalación' }}
        </button>
      </div>
    </div>

    <!-- Estado de carga inicial -->
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="text-muted mt-2">Cargando instalaciones…</p>
    </div>

    <!-- Mensaje si no hay instalaciones -->
    <div v-else-if="installations.length === 0" class="alert alert-secondary">
      Este cliente no tiene instalaciones registradas. Podés crear una con el botón de arriba.
    </div>

    <!-- Listado de instalaciones -->
    <div v-else>
      <div
        v-for="installation in installations"
        :key="installation.id"
        class="card mb-4 installation-card"
      >
        <div class="card-header d-flex align-items-center flex-wrap gap-2">
          <!-- Información básica de la instalación -->
          <div>
            <strong>Instalación #{{ installation.id }}</strong>
            <span class="text-muted small ms-2">
              versión:
              <strong>{{ installation.version ? installation.version.version : 'Sin versión' }}</strong>
            </span>
            <span class="text-muted small ms-2">
              API: <code>{{ installation.client_api ? installation.client_api.url : 'Sin API' }}</code>
            </span>
          </div>
          <!-- Badge de estado con color según status -->
          <span
            class="badge ms-auto"
            :class="status_badge_class(installation.status)"
          >
            {{ installation.status }}
          </span>
          <!-- Fecha de inicio y fin -->
          <span v-if="installation.started_at" class="text-muted small">
            Inicio: {{ format_datetime(installation.started_at) }}
          </span>
          <span v-if="installation.finished_at" class="text-muted small">
            Fin: {{ format_datetime(installation.finished_at) }}
          </span>
        </div>

        <div class="card-body">

          <!-- Mensaje de error si la instalación falló -->
          <div v-if="installation.status === 'fallida' && installation.failure_reason" class="alert alert-danger py-2 small mb-3">
            <strong>Error:</strong> {{ installation.failure_reason }}
          </div>

          <!-- Formulario de variables manuales (solo para instalaciones pendientes) -->
          <div v-if="installation.status === 'pendiente'">

            <!-- Sección de variables manuales si existen templates -->
            <div v-if="manual_templates.length > 0" class="mb-3">
              <h6 class="text-muted mb-2">Variables requeridas para la instalación</h6>
              <p class="small text-muted">
                Completá estos valores antes de iniciar la instalación. Son específicos de este cliente.
              </p>
              <div class="row g-2">
                <div
                  v-for="template in manual_templates"
                  :key="template.id"
                  class="col-md-6"
                >
                  <label class="form-label small mb-1">
                    <code>{{ template.key }}</code>
                    <span v-if="template.notes" class="text-muted ms-1">— {{ template.notes }}</span>
                  </label>
                  <input
                    :value="get_env_value(installation, template.key)"
                    class="form-control form-control-sm"
                    :placeholder="template.notes || template.key"
                    @change="on_env_value_change(installation, template.key, $event.target.value)"
                  />
                </div>
              </div>
            </div>

            <!-- Botón iniciar instalación: habilitado solo cuando todos los campos tienen valor -->
            <div class="d-flex align-items-center gap-2">
              <button
                class="btn btn-success btn-sm"
                :disabled="!all_manual_values_filled(installation) || starting_id === installation.id"
                @click="start_installation(installation)"
              >
                {{ starting_id === installation.id ? 'Iniciando...' : '▶ Iniciar instalación' }}
              </button>
              <span v-if="!all_manual_values_filled(installation)" class="text-warning small">
                Completá todas las variables antes de iniciar.
              </span>
            </div>
          </div>

          <!-- Panel de logs (para todas las instalaciones que tengan logs) -->
          <div v-if="installation.deployment_logs && installation.deployment_logs.length > 0" class="mt-3">
            <h6 class="text-muted mb-2">Log de instalación</h6>
            <div
              ref="log_container"
              class="installation-log-panel border rounded bg-dark text-light small p-2"
            >
              <div
                v-for="(log_line, log_index) in installation.deployment_logs"
                :key="log_index"
                class="installation-log-line"
                :class="log_level_class(log_line.level)"
              >
                <span class="text-muted">[{{ log_line.step }}]</span>
                {{ log_line.line }}
              </div>
            </div>
          </div>

          <!-- Mensaje de espera mientras se instala (sin logs aún) -->
          <div
            v-else-if="installation.status === 'instalando'"
            class="text-muted small mt-3"
          >
            <div class="spinner-border spinner-border-sm text-primary me-1" role="status"></div>
            Instalando… los logs aparecerán aquí en tiempo real.
          </div>

        </div>
      </div>
    </div>

  </div>
</template>

<script>
import api from '@/utils/axios'

/**
 * Vista de instalaciones iniciales de sistema para un cliente.
 *
 * Muestra la lista de ClientInstallations del cliente seleccionado, permite crear
 * nuevas instalaciones, cargar variables manuales de .env e iniciar el pipeline SSH.
 * Los logs se actualizan via polling cada 3 segundos mientras haya instalaciones activas.
 */
export default {
  name: 'ViewClientInstallations',

  data() {
    return {
      /** ID del cliente obtenido de los parámetros de la ruta. */
      client_id: null,

      /** Datos del cliente (nombre, etc.) */
      client: null,

      /** Lista de instalaciones del cliente. */
      installations: [],

      /** Variables is_manual_on_create del sistema. */
      manual_templates: [],

      /** Valores de env pendientes de guardar, indexados por installation_id y key. */
      pending_env_values: {},

      /** true mientras se carga la lista inicial de instalaciones. */
      loading: false,

      /** true mientras se está creando una nueva instalación. */
      creating: false,

      /** ID de la instalación que se está iniciando actualmente (para deshabilitar su botón). */
      starting_id: null,

      /** Timer del polling de logs para instalaciones activas. */
      polling_timer: null,
    }
  },

  computed: {
    /**
     * Indica si hay alguna instalación en estado 'instalando' (para activar el polling).
     *
     * @returns {boolean}
     */
    has_active_installation() {
      return this.installations.some(function (inst) {
        return inst.status === 'instalando'
      })
    },
  },

  created() {
    /* Toma el clientId de los parámetros de la ruta (/clientes/:clientId/instalaciones). */
    this.client_id = this.$route.params.clientId

    this.load_templates()
    this.load_installations()
  },

  beforeUnmount() {
    /* Detiene el polling al abandonar la vista. */
    this.stop_polling()
  },

  methods: {
    /**
     * Carga las variables is_manual_on_create del sistema desde el endpoint de env-template.
     *
     * @returns {void}
     */
    load_templates() {
      const self = this
      api.get('/env-template')
        .then(function (res) {
          /* Filtra solo las variables que requieren valor manual al crear. */
          self.manual_templates = (res.data.models || []).filter(function (t) {
            return t.is_manual_on_create
          })
        })
        .catch(function () {
          /* En caso de error silencioso, el formulario queda sin campos (no bloquea). */
        })
    },

    /**
     * Carga la lista de instalaciones del cliente desde la API.
     *
     * @returns {void}
     */
    load_installations() {
      const self = this
      self.loading = true
      api.get('/clients/' + self.client_id + '/installations')
        .then(function (res) {
          self.installations = res.data.models || []

          /* Extrae el objeto client del primer resultado si está disponible. */
          if (self.installations.length > 0 && self.installations[0].client) {
            self.client = self.installations[0].client
          }

          /* Si hay instalaciones activas, inicia el polling para refrescar logs. */
          if (self.has_active_installation) {
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
     * Crea una nueva instalación en estado 'pendiente' para este cliente.
     *
     * @returns {void}
     */
    create_installation() {
      const self = this
      self.creating = true
      api.post('/clients/' + self.client_id + '/installations')
        .then(function (res) {
          /* Agrega la nueva instalación al principio de la lista. */
          self.installations.unshift(res.data.model)
        })
        .catch(function () {
          /* El interceptor ya muestra el error. */
        })
        .finally(function () {
          self.creating = false
        })
    },

    /**
     * Guarda un cambio de valor en una variable manual de la instalación.
     * Llama al backend inmediatamente al cambiar el input.
     *
     * @param {Object} installation  La instalación que se está editando.
     * @param {string} key           Nombre de la variable .env.
     * @param {string} value         Nuevo valor ingresado por el operador.
     * @returns {void}
     */
    on_env_value_change(installation, key, value) {
      const self = this

      /* Actualiza el valor local en la instalación para reflejar el cambio en la UI. */
      const env_values = Object.assign({}, installation.env_manual_values || {})
      env_values[key] = value

      /* Actualiza el objeto local inmediatamente (reactividad). */
      installation.env_manual_values = env_values

      /* Persiste el cambio en el backend. */
      const values_payload = {}
      values_payload[key] = value

      api.put('/client-installations/' + installation.id + '/env-values', { values: values_payload })
        .then(function (res) {
          /* Actualiza el modelo con lo que devuelve el backend (incluye los valores mergeados). */
          const updated = res.data.model
          installation.env_manual_values = updated.env_manual_values
        })
        .catch(function () {
          /* El interceptor ya muestra el error. */
        })
    },

    /**
     * Inicia el pipeline de instalación en background.
     *
     * @param {Object} installation  Instalación a iniciar.
     * @returns {void}
     */
    start_installation(installation) {
      const self = this
      self.starting_id = installation.id

      api.post('/client-installations/' + installation.id + '/start')
        .then(function (res) {
          /* Actualiza la instalación con el nuevo status (instalando). */
          const updated = res.data.model
          const index = self.installations.findIndex(function (i) { return i.id === updated.id })
          if (index !== -1) {
            self.installations.splice(index, 1, updated)
          }

          /* Activa el polling para refrescar logs mientras esté activa. */
          self.start_polling()
        })
        .catch(function () {
          /* El interceptor ya muestra el error. */
        })
        .finally(function () {
          self.starting_id = null
        })
    },

    /**
     * Inicia el polling cada 3 segundos para refrescar instalaciones activas.
     * No crea timers duplicados si ya hay uno corriendo.
     *
     * @returns {void}
     */
    start_polling() {
      if (this.polling_timer !== null) {
        return
      }
      const self = this
      self.polling_timer = setInterval(function () {
        self.poll_active_installations()
      }, 3000)
    },

    /**
     * Detiene el timer de polling y lo limpia.
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
     * Refresca la lista completa de instalaciones.
     * Detiene el polling si ya no hay instalaciones activas.
     *
     * @returns {void}
     */
    poll_active_installations() {
      const self = this
      api.get('/clients/' + self.client_id + '/installations')
        .then(function (res) {
          self.installations = res.data.models || []

          /* Si ya no hay instalaciones activas, detiene el polling. */
          if (!self.has_active_installation) {
            self.stop_polling()
          }
        })
        .catch(function () {
          /* Polling: silencia errores de red transitorios. */
        })
    },

    /**
     * Devuelve el valor guardado de una variable manual para una instalación dada.
     *
     * @param {Object} installation  Instalación que contiene env_manual_values.
     * @param {string} key           Nombre de la variable .env.
     * @returns {string}
     */
    get_env_value(installation, key) {
      const env_values = installation.env_manual_values || {}
      return env_values[key] || ''
    },

    /**
     * Verifica si todas las variables manuales requeridas tienen valor en la instalación.
     * Determina si el botón "Iniciar instalación" se habilita.
     *
     * @param {Object} installation  Instalación a verificar.
     * @returns {boolean}
     */
    all_manual_values_filled(installation) {
      const env_values = installation.env_manual_values || {}
      const self = this
      let all_filled = true
      self.manual_templates.forEach(function (template) {
        const value = env_values[template.key]
        if (!value || String(value).trim() === '') {
          all_filled = false
        }
      })
      return all_filled
    },

    /**
     * Devuelve la clase CSS del badge de status según el estado de la instalación.
     *
     * @param {string} status  Estado de la instalación.
     * @returns {string}
     */
    status_badge_class(status) {
      const map = {
        pendiente:   'bg-secondary',
        instalando:  'bg-primary',
        completada:  'bg-success',
        fallida:     'bg-danger',
      }
      return map[status] || 'bg-secondary'
    },

    /**
     * Devuelve la clase CSS de texto para una línea de log según su nivel.
     *
     * @param {string} level  Nivel del log (info | success | error).
     * @returns {string}
     */
    log_level_class(level) {
      const map = {
        info:    'text-light',
        success: 'text-success',
        error:   'text-danger',
      }
      return map[level] || 'text-light'
    },

    /**
     * Formatea una fecha ISO para mostrarla en la UI.
     *
     * @param {string} datetime  Fecha ISO 8601.
     * @returns {string}
     */
    format_datetime(datetime) {
      if (!datetime) {
        return ''
      }
      const d = new Date(datetime)
      return d.toLocaleString('es-AR', {
        day:    '2-digit',
        month:  '2-digit',
        year:   'numeric',
        hour:   '2-digit',
        minute: '2-digit',
      })
    },
  },
}
</script>

<style lang="sass">
/* Panel de logs estilo terminal */
.installation-log-panel
	max-height: 400px
	overflow-y: auto
	font-family: monospace
	font-size: 0.78rem
	line-height: 1.4

.installation-log-line
	white-space: pre-wrap
	word-break: break-all
	margin-bottom: 2px
</style>
