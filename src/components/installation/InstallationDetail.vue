<template>
  <div class="card mb-4 installation-card">
    <div class="card-header d-flex align-items-center flex-wrap gap-2">
      <!-- Información básica de la instalación -->
      <div>
        <strong>Instalación #{{ installation.id }}</strong>
        <!-- Tipo de instalación: sin esto, una fila de esqueleto se lee igual que una completa. -->
        <span class="badge ms-2" :class="kind_badge_class(installation.kind)">
          {{ installation.kind || 'completa' }}
        </span>
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
      <!-- Botón eliminar: deshabilitado mientras la instalación está en curso -->
      <button
        type="button"
        class="btn btn-sm btn-outline-danger"
        :disabled="installation.status === 'instalando' || deleting"
        :title="installation.status === 'instalando' ? 'No se puede eliminar una instalación en curso' : 'Eliminar instalación'"
        @click="on_delete"
      >
        <i class="bi bi-trash me-1" aria-hidden="true"></i>{{ deleting ? 'Eliminando...' : 'Eliminar' }}
      </button>
    </div>

    <div class="card-body">

      <!--
        Qué hace y qué NO hace el esqueleto. El "no" es lo importante: después de un esqueleto el
        subdominio sirve un directorio vacío hasta el primer upgrade, y sin este aviso eso se
        reporta como bug.
      -->
      <div v-if="installation.kind === 'esqueleto'" class="alert alert-info py-2 small mb-3">
        <strong>Esqueleto:</strong> deja el subdominio listo para que el upgrade corra entero
        (directorios, <code>public/</code>, symlink de storage y <code>.env</code>). No sube el
        código de la API ni compila el SPA.
      </div>

      <!-- Mensaje de error si la instalación falló -->
      <div v-if="installation.status === 'fallida' && installation.failure_reason" class="alert alert-danger py-2 small mb-3">
        <strong>Error:</strong> {{ installation.failure_reason }}
      </div>

      <!-- Formulario de variables manuales (solo para instalaciones pendientes) -->
      <div v-if="installation.status === 'pendiente'">

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
                :value="get_env_value(template.key)"
                class="form-control form-control-sm"
                :placeholder="template.notes || template.key"
                @change="on_env_value_change(template.key, $event.target.value)"
              />
            </div>
          </div>
        </div>

        <!-- flex-wrap: en teléfono el texto de al lado no entra en la misma línea que el botón. -->
        <div class="d-flex align-items-center flex-wrap gap-2">
          <button
            class="btn btn-success btn-sm"
            :disabled="!all_manual_values_filled() || starting"
            @click="start_installation"
          >
            {{ starting ? 'Iniciando...' : '▶ Iniciar instalación' }}
          </button>
          <span v-if="!all_manual_values_filled()" class="text-warning small">
            Completá todas las variables antes de iniciar.
          </span>
          <!--
            Un solo botón para las dos filas del par: el backend arranca todo el grupo de una y en
            orden. Se dice acá para que no se busque un segundo botón que no existe.
          -->
          <span v-else-if="installation.group_uuid" class="text-muted small">
            Se van a iniciar las dos: primero la instalación real, después el esqueleto.
          </span>
        </div>
      </div>

      <!--
        Panel de operaciones: log en vivo + checklist de las 6 etapas del pipeline.
        Visible siempre que la instalación ya haya arrancado (instalando/completada/fallida);
        mientras está 'pendiente' sólo se ve el formulario de variables manuales de arriba.
      -->
      <div v-if="installation.status !== 'pendiente'" class="mt-3">
        <operations-panel :installation="installation" />
      </div>

    </div>
  </div>
</template>

<script>
import api from '@/utils/axios'
import OperationsPanel from '@/components/installation/extra-props/OperationsPanel.vue'

/**
 * Detalle y gestión completa de una ClientInstallation individual.
 *
 * Reutilizable tanto en la pestaña de instalaciones del cliente (ClientInstallations.vue,
 * una instancia por cada instalación de la lista) como en el modal de gestión del listado
 * global (Installations.vue, una sola instancia para la instalación seleccionada).
 *
 * Se hace cargo de: cargar variables manuales is_manual_on_create, guardar valores de env,
 * iniciar el pipeline, pollear estado/logs cada 3s mientras status='instalando' (GET
 * /client-installations/{id}, prompt 339), y eliminar la instalación (DELETE, prompt 339).
 *
 * Emite update:installation cada vez que cambia su copia (el padre es dueño de la lista real
 * y debe reemplazar el item correspondiente), group-updated con TODAS las filas del par cuando
 * la respuesta trae models, y deleted cuando se elimina con éxito.
 */
export default {
  name: 'InstallationDetail',

  components: { OperationsPanel },

  props: {
    /** La instalación a mostrar/gestionar. El padre es dueño del dato real. */
    installation: {
      type: Object,
      required: true,
    },
  },

  /*
    group-updated lleva TODAS las filas del par, no solo esta. Va aparte de update:installation
    porque el padre hace cosas distintas con cada una: una es la fila que este componente muestra
    y la otra es la hermana, que el padre tiene en su lista pero nadie está mirando.
  */
  emits: ['update:installation', 'group-updated', 'deleted'],

  data() {
    return {
      /** Variables is_manual_on_create del sistema. */
      manual_templates: [],

      /** true mientras se está iniciando el pipeline. */
      starting: false,

      /** true mientras se está eliminando la instalación. */
      deleting: false,

      /** Timer de polling propio de esta instancia (una instalación). */
      polling_timer: null,
    }
  },

  created() {
    this.load_templates()
    if (this.installation.status === 'instalando') {
      this.start_polling()
    }
  },

  beforeUnmount() {
    this.stop_polling()
  },

  watch: {
    /* Si la instalación pasa a 'instalando' (recién iniciada) o sale de ese estado, ajusta el polling. */
    'installation.status'(new_status) {
      if (new_status === 'instalando') {
        this.start_polling()
      } else {
        this.stop_polling()
      }
    },
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
          self.manual_templates = (res.data.models || []).filter(function (t) {
            return t.is_manual_on_create
          })
        })
        .catch(function () {
          /* En caso de error silencioso, el formulario queda sin campos (no bloquea). */
        })
    },

    /**
     * Devuelve el valor guardado de una variable manual de esta instalación.
     *
     * @param {string} key
     * @returns {string}
     */
    get_env_value(key) {
      const env_values = this.installation.env_manual_values || {}
      return env_values[key] || ''
    },

    /**
     * Guarda un cambio de valor en una variable manual. Actualiza el estado local
     * (vía evento, el padre reemplaza el item) de inmediato y persiste en el backend.
     *
     * @param {string} key
     * @param {string} value
     * @returns {void}
     */
    on_env_value_change(key, value) {
      const self = this
      const env_values = Object.assign({}, this.installation.env_manual_values || {})
      env_values[key] = value

      self.$emit('update:installation', Object.assign({}, self.installation, { env_manual_values: env_values }))

      const values_payload = {}
      values_payload[key] = value

      api.put('/client-installations/' + self.installation.id + '/env-values', { values: values_payload })
        .then(function (res) {
          self.$emit('update:installation', res.data.model)
        })
        .catch(function () {
          /* El interceptor de axios ya muestra el toast de error. */
        })
    },

    /**
     * Verifica si todas las variables manuales requeridas tienen valor.
     *
     * @returns {boolean}
     */
    all_manual_values_filled() {
      const env_values = this.installation.env_manual_values || {}
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
     * Inicia el pipeline de instalación en background.
     *
     * Un solo POST arranca las dos filas del par, así que la respuesta trae models además de
     * model: se emite group-updated para que el padre actualice también la hermana, que quedó
     * en 'instalando' sin que nadie la haya tocado desde la pantalla.
     *
     * @returns {void}
     */
    start_installation() {
      const self = this
      self.starting = true
      api.post('/client-installations/' + self.installation.id + '/start')
        .then(function (res) {
          self.$emit('update:installation', res.data.model)
          if (res.data.models) {
            self.$emit('group-updated', res.data.models)
          }
          self.start_polling()
        })
        .catch(function () {
          /* El interceptor ya muestra el error. */
        })
        .finally(function () {
          self.starting = false
        })
    },

    /**
     * Elimina la instalación tras confirmación. Bloqueada en el backend si está
     * 'instalando' (el botón ya viene deshabilitado en ese caso).
     *
     * @returns {void}
     */
    on_delete() {
      const self = this
      if (!window.confirm('¿Eliminar la instalación #' + this.installation.id + '? Esta acción no se puede deshacer.')) {
        return
      }
      self.deleting = true
      api.delete('/client-installations/' + self.installation.id)
        .then(function () {
          self.stop_polling()
          self.$emit('deleted', self.installation.id)
        })
        .catch(function () {
          /* El interceptor ya muestra el error (ej. 422 si está en curso). */
        })
        .finally(function () {
          self.deleting = false
        })
    },

    /**
     * Inicia el polling propio de esta instancia cada 3 segundos.
     *
     * @returns {void}
     */
    start_polling() {
      if (this.polling_timer !== null) {
        return
      }
      const self = this
      self.polling_timer = setInterval(function () {
        self.poll_installation()
      }, 3000)
    },

    /**
     * Detiene el polling propio.
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
     * Refresca esta instalación puntual (GET /client-installations/{id}, prompt 339).
     * Detiene el polling apenas deja de estar 'instalando'.
     *
     * @returns {void}
     */
    poll_installation() {
      const self = this
      api.get('/client-installations/' + self.installation.id)
        .then(function (res) {
          const updated = res.data.model
          self.$emit('update:installation', updated)
          /* La hermana viaja en el mismo GET: sin esto haría falta un segundo request por ciclo. */
          if (res.data.models) {
            self.$emit('group-updated', res.data.models)
          }
          if (updated.status !== 'instalando') {
            self.stop_polling()
          }
        })
        .catch(function () {
          /* Polling: silencia errores de red transitorios. */
        })
    },

    /**
     * Clase CSS del badge según el estado de la instalación.
     *
     * @param {string} status
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
     * Clase CSS del badge según el tipo de instalación.
     *
     * El fallback a 'completa' cubre una respuesta vieja sin la clave: en la base todas las filas
     * anteriores quedaron en 'completa', pero acá no queremos un badge vacío.
     *
     * @param {string} kind
     * @returns {string}
     */
    kind_badge_class(kind) {
      return kind === 'esqueleto' ? 'text-bg-info' : 'text-bg-light border'
    },

    /**
     * Formatea una fecha ISO para mostrarla en la UI.
     *
     * @param {string} datetime
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

