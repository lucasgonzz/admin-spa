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
              <!--
                Las tres claves que completa el aprovisionamiento van deshabilitadas con el motivo
                en el placeholder: el valor que se tipee acá lo pisa igual step_write_env con el de
                la base recién creada, así que dejarlas editables es invitar a escribir algo que no
                va a servir para nada.
              -->
              <input
                :value="get_env_value(template.key)"
                class="form-control form-control-sm"
                :disabled="es_clave_aprovisionada(template.key)"
                :placeholder="es_clave_aprovisionada(template.key)
                  ? 'lo completa el aprovisionamiento'
                  : (template.notes || template.key)"
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
        Credenciales que generó el aprovisionamiento.

        🔴 No salen del objeto de la instalación y no hay forma de que salgan: ClientApi tiene
        provisioning_secrets en $hidden porque esa relación viaja en el index y en el show de
        instalaciones, de upgrades y de clientes, y descifrada quedaría escrita en cualquier log de
        request y en la caché del navegador. Llegan por un GET propio, cuando alguien aprieta el
        botón, y de a una API por vez.
      -->
      <div v-if="muestra_credenciales" class="card border-secondary border-opacity-25 mt-3">
        <div class="card-header d-flex align-items-center flex-wrap gap-2 py-2">
          <i class="bi bi-key text-secondary" aria-hidden="true"></i>
          <span class="small fw-semibold">Credenciales del hosting</span>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary ms-auto"
            :disabled="cargando_credenciales"
            @click="load_hosting_credentials"
          >
            {{ cargando_credenciales
              ? 'Buscando…'
              : (credenciales === null ? 'Ver credenciales' : 'Volver a pedirlas') }}
          </button>
        </div>
        <div class="card-body py-2">
          <p v-if="credenciales === null" class="small text-muted mb-0">
            El aprovisionamiento generó la contraseña de la base (y en VPS, las de los sitios de
            CloudPanel). Se piden con el botón: no viajan en el resto de las respuestas.
          </p>
          <p v-else-if="credenciales_items.length === 0" class="small text-muted mb-0">
            Esta API no tiene credenciales guardadas. Si la instalación falló antes de crear la
            base, no llegó a generarse ninguna.
          </p>
          <div v-else class="row g-2">
            <div
              v-for="item in credenciales_items"
              :key="item.key"
              class="col-md-6"
            >
              <label class="form-label small mb-1">
                {{ item.label }} <code class="text-muted">{{ item.key }}</code>
              </label>
              <div class="input-group input-group-sm">
                <input
                  :type="credenciales_visibles[item.key] ? 'text' : 'password'"
                  class="form-control form-control-sm credencial-valor"
                  :value="item.value"
                  readonly
                />
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  :title="credenciales_visibles[item.key] ? 'Ocultar' : 'Mostrar'"
                  @click="toggle_credencial_visible(item.key)"
                >
                  <i
                    class="bi"
                    :class="credenciales_visibles[item.key] ? 'bi-eye-slash' : 'bi-eye'"
                    aria-hidden="true"
                  ></i>
                </button>
                <button
                  type="button"
                  class="btn"
                  :class="credencial_copiada === item.key ? 'btn-success' : 'btn-outline-secondary'"
                  title="Copiar"
                  @click="copy_credencial(item)"
                >
                  <i
                    class="bi"
                    :class="credencial_copiada === item.key ? 'bi-check-lg' : 'bi-clipboard'"
                    aria-hidden="true"
                  ></i>
                </button>
              </div>
            </div>
          </div>
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
import { copy_text_to_clipboard } from '@/utils/version_notification_clipboard'

/**
 * Las tres claves del .env que completa solo el aprovisionamiento.
 *
 * 🔴 Es el espejo exacto de ClientInstallation::CLAVES_ENV_APROVISIONADAS en admin-api, y las dos
 * mitades tienen que coincidir: allá start() exceptúa estas claves de la validación de "todas las
 * variables manuales cargadas" antes de despachar, y acá se saltean en all_manual_values_filled().
 * Si una lista se toca y la otra no, el botón "Iniciar" queda gris para siempre (si sobra acá) o
 * el POST devuelve 422 sin que la pantalla explique por qué (si sobra allá).
 */
var CLAVES_ENV_APROVISIONADAS = ['DB_DATABASE', 'DB_USERNAME', 'DB_PASSWORD']

/**
 * Nombre legible de cada credencial que puede venir en provisioning_secrets.
 *
 * El fallback es la clave cruda: el backend puede agregar una clave nueva sin que este SPA se
 * entere, y es mejor mostrarla con su nombre técnico que esconderla.
 */
var ETIQUETAS_CREDENCIALES = {
  db_name: 'Base de datos',
  db_user: 'Usuario de la base',
  db_password: 'Contraseña de la base',
  cron_uid: 'UID del cron en Hostinger',
  api_site_user: 'Usuario del sitio de la API (CloudPanel)',
  api_site_password: 'Contraseña del sitio de la API (CloudPanel)',
  spa_site_user: 'Usuario del sitio del SPA (CloudPanel)',
  spa_site_password: 'Contraseña del sitio del SPA (CloudPanel)',
  api2_site_user: 'Usuario del sitio de la API 2 (CloudPanel)',
  api2_site_password: 'Contraseña del sitio de la API 2 (CloudPanel)',
  spa2_site_user: 'Usuario del sitio del SPA 2 (CloudPanel)',
  spa2_site_password: 'Contraseña del sitio del SPA 2 (CloudPanel)',
  provisioned_by_installation_id: 'Instalación que la aprovisionó',
}

/**
 * Detalle y gestión completa de una ClientInstallation individual.
 *
 * Reutilizable tanto en la pestaña de instalaciones del cliente (ClientInstallations.vue,
 * una instancia por cada instalación de la lista) como en el modal de gestión del listado
 * global (Installations.vue, una sola instancia para la instalación seleccionada).
 *
 * Se hace cargo de: cargar variables manuales is_manual_on_create, guardar valores de env,
 * iniciar el pipeline, pollear estado/logs cada 3s mientras alguna fila del par siga en
 * 'instalando' (GET /client-installations/{id}, prompt 339), y eliminar la instalación (DELETE,
 * prompt 339).
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

      /**
       * Últimas filas conocidas del par (incluida la propia), tal como vinieron en 'models'.
       *
       * Existe solo para decidir cuándo parar el polling. La fila que este componente muestra
       * llega por prop y es del padre; esto es una foto de las hermanas, que en el listado global
       * no las está mirando nadie.
       */
      group_rows: [],

      /**
       * true una vez desmontado el componente.
       *
       * Hace falta desde que poll_installation() puede ARRANCAR el timer y no solo pararlo: si el
       * modal se cierra con un GET en vuelo, la respuesta llega después de beforeUnmount y
       * levantaría un intervalo sobre un componente muerto que ya nadie apaga.
       */
      unmounted: false,

      /**
       * Credenciales del aprovisionamiento, o null mientras nadie las haya pedido.
       *
       * Arranca en null y no en {} a propósito: null es "todavía no se pidieron" y {} es "se
       * pidieron y no hay ninguna", que son dos mensajes distintos en pantalla.
       */
      credenciales: null,

      /** true mientras está en vuelo el GET de credenciales. */
      cargando_credenciales: false,

      /** Qué credenciales están reveladas: { clave: true }. */
      credenciales_visibles: {},

      /** Clave de la última credencial copiada, para el feedback del botón. */
      credencial_copiada: '',

      /** Timer del feedback de copiado, para poder limpiarlo al desmontar. */
      copiada_timer: null,
    }
  },

  computed: {
    /**
     * ¿Esta fila aprovisiona el hosting?
     *
     * Un SPA nuevo contra un backend viejo lee undefined acá y degrada solo al comportamiento de
     * siempre: los inputs de las DB_* quedan habilitados y el operador las carga a mano.
     *
     * @returns {boolean}
     */
    aprovisiona_hosting() {
      return String(this.installation.provision_hosting_type || '').trim() !== ''
    },

    /**
     * ¿Se muestra el bloque de credenciales del hosting?
     *
     * Solo con aprovisionamiento y con la corrida terminada: antes de que corra provision_db no
     * hay ninguna credencial generada, y ofrecer el botón sería ofrecer una respuesta vacía.
     * 'fallida' cuenta igual que 'completada': si el pipeline se cayó DESPUÉS de crear la base, la
     * contraseña existe y es justo cuando más hace falta verla.
     *
     * @returns {boolean}
     */
    muestra_credenciales() {
      if (!this.aprovisiona_hosting) {
        return false
      }
      return this.installation.status === 'completada' || this.installation.status === 'fallida'
    },

    /**
     * Credenciales listas para pintar, en el orden en que las mandó el backend.
     *
     * @returns {Array<{key: string, label: string, value: string}>}
     */
    credenciales_items() {
      const secretos = this.credenciales || {}
      return Object.keys(secretos).map(function (key) {
        return {
          key: key,
          label: ETIQUETAS_CREDENCIALES[key] || key,
          value: String(secretos[key]),
        }
      })
    },
  },

  created() {
    this.load_templates()
    if (this.installation.status === 'instalando') {
      this.start_polling()
      return
    }
    /*
      Fila de un par que ya terminó lo suyo: la hermana puede seguir corriendo, porque el grupo
      corre en secuencia (primero la real, después el esqueleto). Un GET suelto averigua cómo está
      el par y arranca el polling si hace falta; abrir el modal sobre la real recién terminada no
      puede dejar al esqueleto congelado en pantalla.
    */
    if (this.installation.group_uuid && this.installation.status !== 'pendiente') {
      this.poll_installation()
    }
  },

  beforeUnmount() {
    this.unmounted = true
    this.stop_polling()
    if (this.copiada_timer !== null) {
      clearTimeout(this.copiada_timer)
      this.copiada_timer = null
    }
  },

  watch: {
    /* Si la instalación pasa a 'instalando' (recién iniciada) o sale de ese estado, ajusta el polling. */
    'installation.status'(new_status) {
      if (new_status === 'instalando') {
        this.start_polling()
        return
      }
      /*
        Que esta fila haya terminado NO alcanza para parar: en un par la real termina primero y el
        esqueleto arranca recién ahí. Si se cortaba acá, nadie volvía a preguntar por el esqueleto
        y quedaba en 'instalando' para siempre en la tabla, aunque hubiera fallado.
      */
      if (!this.group_is_running(this.group_rows)) {
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
     * ¿Esta clave del .env la completa el aprovisionamiento en vez del operador?
     *
     * @param {string} key
     * @returns {boolean}
     */
    es_clave_aprovisionada(key) {
      if (!this.aprovisiona_hosting) {
        return false
      }
      return CLAVES_ENV_APROVISIONADAS.indexOf(key) !== -1
    },

    /**
     * Verifica si todas las variables manuales requeridas tienen valor.
     *
     * 🔴 Las tres claves del aprovisionamiento se saltean, y es espejo exacto de lo que hace
     * start() en el backend con CLAVES_ENV_APROVISIONADAS. Sin este salteo el botón "Iniciar"
     * quedaría gris para siempre en toda instalación con aprovisionamiento —los inputs están
     * deshabilitados, nadie puede cargarlos— y la funcionalidad entera sería inusable.
     *
     * @returns {boolean}
     */
    all_manual_values_filled() {
      const env_values = this.installation.env_manual_values || {}
      const self = this
      let all_filled = true
      self.manual_templates.forEach(function (template) {
        if (self.es_clave_aprovisionada(template.key)) {
          return
        }
        const value = env_values[template.key]
        if (!value || String(value).trim() === '') {
          all_filled = false
        }
      })
      return all_filled
    },

    /**
     * Pide al backend las credenciales que generó el aprovisionamiento para la API de esta fila.
     *
     * Es un GET aparte y bajo demanda: provisioning_secrets está en el $hidden del modelo, así que
     * no viene en el show de la instalación ni en ningún listado. Buscarlo en installation.client_api
     * no falla ruidosamente, simplemente no está: por eso este método existe.
     *
     * @returns {void}
     */
    load_hosting_credentials() {
      const self = this
      const client_api = self.installation.client_api
      const client_api_id = client_api ? client_api.id : self.installation.client_api_id
      if (!client_api_id) {
        return
      }
      self.cargando_credenciales = true
      api.get('/client-apis/' + client_api_id + '/hosting-credentials')
        .then(function (res) {
          self.credenciales = res.data.provisioning_secrets || {}
          /* Cada pedido las vuelve a tapar: si quedaran reveladas, una respuesta nueva se pintaría
             en claro sobre la pantalla que alguien dejó abierta. */
          self.credenciales_visibles = {}
        })
        .catch(function () {
          /* El interceptor de axios ya muestra el toast de error. */
        })
        .finally(function () {
          self.cargando_credenciales = false
        })
    },

    /**
     * Revela u oculta una credencial puntual.
     *
     * @param {string} key
     * @returns {void}
     */
    toggle_credencial_visible(key) {
      const visibles = Object.assign({}, this.credenciales_visibles)
      visibles[key] = !visibles[key]
      this.credenciales_visibles = visibles
    },

    /**
     * Copia una credencial al portapapeles y deja el visto puesto un par de segundos.
     *
     * @param {{key: string, value: string}} item
     * @returns {void}
     */
    copy_credencial(item) {
      const self = this
      copy_text_to_clipboard(item.value)
        .then(function () {
          self.credencial_copiada = item.key
          if (self.copiada_timer !== null) {
            clearTimeout(self.copiada_timer)
          }
          self.copiada_timer = setTimeout(function () {
            self.credencial_copiada = ''
            self.copiada_timer = null
          }, 2000)
        })
        .catch(function () {
          /* El navegador puede negar el portapapeles sin gesto de usuario; el valor se ve igual
             con el ojito y se puede copiar a mano. */
        })
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
          /* Se guarda antes de emitir: el watcher de 'installation.status' corre con el cambio de
             prop y necesita el par ya cargado para no parar el polling apenas termine esta fila. */
          self.group_rows = res.data.models || [res.data.model]
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
     * Idempotente a propósito: created(), el watcher del estado y el propio poll pueden llamarlo
     * en la misma vuelta y tiene que quedar un solo intervalo.
     *
     * @returns {void}
     */
    start_polling() {
      if (this.polling_timer !== null || this.unmounted) {
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
     * ¿Queda alguna fila del par corriendo?
     *
     * Sin par (o sin datos del par todavía) la respuesta es simplemente si la única fila que hay
     * está corriendo, que es el comportamiento de siempre para una instalación suelta.
     *
     * @param {Array<Object>} rows
     * @returns {boolean}
     */
    group_is_running(rows) {
      let alguna_corriendo = false
      const filas = rows || []
      filas.forEach(function (row) {
        if (row && row.status === 'instalando') {
          alguna_corriendo = true
        }
      })
      return alguna_corriendo
    },

    /**
     * Refresca esta instalación puntual (GET /client-installations/{id}, prompt 339).
     *
     * El polling sigue vivo mientras CUALQUIER fila del par esté 'instalando', no solo la que se
     * está mirando: el grupo corre en secuencia y la real termina bastante antes que el esqueleto.
     * Mirando solo la propia fila, el modal quedaba en verde y el esqueleto congelado en
     * 'instalando' en la tabla aunque hubiera fallado — y un esqueleto fallido recién se descubre
     * en la próxima actualización, que es justo lo que hay que evitar.
     *
     * También arranca el timer si estaba apagado, así este mismo método sirve para el GET suelto
     * de created() sin duplicar la decisión de "¿hay que seguir mirando?".
     *
     * @returns {void}
     */
    poll_installation() {
      const self = this
      api.get('/client-installations/' + self.installation.id)
        .then(function (res) {
          const updated = res.data.model
          /* Antes de emitir: el watcher de la prop lee group_rows para decidir si para. */
          self.group_rows = res.data.models || [updated]
          self.$emit('update:installation', updated)
          /* La hermana viaja en el mismo GET: sin esto haría falta un segundo request por ciclo. */
          if (res.data.models) {
            self.$emit('group-updated', res.data.models)
          }
          if (self.group_is_running(self.group_rows)) {
            self.start_polling()
          } else {
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


<style scoped>
/*
  Las credenciales se leen carácter por carácter (una contraseña de 24 con mayúsculas, minúsculas y
  dígitos), así que van en monoespaciada: en la tipografía del sistema una l y un 1 se confunden
  justo cuando alguien la está transcribiendo a mano.
*/
.credencial-valor {
  font-family: ui-monospace, monospace;
}
</style>
