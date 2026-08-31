<template>
  <div class="demo-system-installations">

    <!-- Encabezado de la pestaña -->
    <div class="d-flex align-items-start flex-wrap gap-2 mb-3">
      <div class="flex-grow-1">
        <h5 class="mb-0">Instalación del sistema</h5>
        <p class="text-muted small mb-0 mt-1">
          Instala desde cero el ERP (empresa-spa + empresa-api) de una demo del catálogo.
        </p>
      </div>
      <button
        type="button"
        class="btn btn-primary ms-md-auto"
        @click="open_create_modal"
      >
        + Nueva instalación
      </button>
    </div>

    <!--
      Las dos cosas que hay que saber ANTES de apretar el botón, y que no las hace el pipeline.
      Van fijas arriba y no adentro del modal: la segunda es destructiva y quien mira el listado
      tiene que poder entender qué significa cada fila sin abrir nada.
    -->
    <div class="alert alert-warning py-2 small">
      <div class="mb-1">
        <i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>
        <strong>El subdominio y la base de datos los creás vos a mano en hPanel, antes de correr
        la instalación.</strong> El admin sube el código, escribe el <code>.env</code> con las
        credenciales que cargues abajo, migra y verifica — pero no crea nada en el hosting.
      </div>
      <div class="mb-0">
        <i class="bi bi-database-exclamation me-1" aria-hidden="true"></i>
        <strong>La instalación corre el demo-setup, que vacía la base de esa demo.</strong>
        Es un <code>migrate:fresh</code> más los seeders: todo lo que haya cargado en esa demo se
        pierde. Por eso el demo-setup corre solo acá, nunca en una actualización.
      </div>
    </div>

    <!-- Carga inicial del listado -->
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="text-muted mt-2">Cargando corridas…</p>
    </div>

    <!-- Sin corridas registradas todavía -->
    <div v-else-if="installations.length === 0" class="alert alert-secondary">
      Todavía no se instaló ninguna demo desde cero. Creá una corrida con el botón
      "+ Nueva instalación".
    </div>

    <!-- Tabla de corridas -->
    <div v-else class="table-responsive">
      <table class="table table-hover table-sm align-middle">
        <thead class="table-light">
          <tr>
            <th>#</th>
            <th>Demo</th>
            <th>Versión</th>
            <th>Estado</th>
            <th class="d-none d-md-table-cell">Inicio</th>
            <th class="d-none d-md-table-cell">Fin</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="installation in installations"
            :key="installation.id"
            style="cursor: pointer"
            @click="open_manage_modal(installation)"
          >
            <td>{{ installation.id }}</td>
            <td class="text-break">{{ row_demo_label(installation) }}</td>
            <td>
              <span v-if="installation.version">{{ installation.version.version }}</span>
              <span v-else class="text-muted">—</span>
            </td>
            <td>
              <span class="badge" :class="status_badge_class(installation.status)">
                {{ installation.status }}
              </span>
            </td>
            <td class="small text-muted d-none d-md-table-cell">
              {{ format_datetime(installation.started_at) || '—' }}
            </td>
            <td class="small text-muted d-none d-md-table-cell">
              {{ format_datetime(installation.finished_at) || '—' }}
            </td>
            <td class="text-end">
              <!-- La fila entera ya abre el modal: @click.stop evita que se dispare dos veces. -->
              <button
                type="button"
                class="btn btn-sm btn-outline-primary"
                @click.stop="open_manage_modal(installation)"
              >
                Ver
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ==================== MODAL DE CREACIÓN ==================== -->
    <base-modal
      :show="show_create_modal"
      title="Nueva instalación de demo"
      size="lg"
      @update:show="show_create_modal = $event"
      @close="on_create_modal_closed"
    >
      <div v-if="loading_create_data" class="text-center py-4">
        <div class="spinner-border text-primary" role="status"></div>
      </div>

      <form v-else @submit.prevent>
        <div class="alert alert-warning py-2 small">
          Antes de crear la corrida: el subdominio y la base de datos de esta demo tienen que estar
          creados a mano en hPanel. Y tené presente que la instalación corre el demo-setup, que
          <strong>vacía la base de la demo elegida</strong>.
        </div>

        <div class="row g-3">
          <!-- Filtro de texto sobre el catálogo, para no scrollear un select largo -->
          <div class="col-12">
            <label class="form-label small">Buscar demo</label>
            <input
              v-model="demo_filter_text"
              type="text"
              class="form-control form-control-sm"
              placeholder="Escribí para filtrar por nombre o URL…"
            />
          </div>

          <div class="col-12 col-md-7">
            <label class="form-label small">Demo</label>
            <select
              v-model="new_installation.demo_id"
              class="form-select form-select-sm"
              size="6"
            >
              <option :value="null" disabled>Seleccioná una demo…</option>
              <option
                v-for="demo in filtered_demos"
                :key="demo.id"
                :value="demo.id"
              >
                {{ demo_label(demo) }}
              </option>
            </select>
            <p v-if="filtered_demos.length === 0" class="text-muted small mt-1 mb-0">
              No hay demos que coincidan con el filtro.
            </p>
          </div>

          <div class="col-12 col-md-5">
            <label class="form-label small">Versión</label>
            <select
              v-model="new_installation.version_id"
              class="form-select form-select-sm"
            >
              <option :value="null" disabled>Seleccioná una versión…</option>
              <option
                v-for="version in versions_desc"
                :key="version.id"
                :value="version.id"
              >
                {{ version.version }}{{ version.status === 'published' ? ' (publicada)' : '' }}
              </option>
            </select>

            <!-- Resumen del destino: dice a qué subdominio va a parar todo esto. -->
            <div v-if="selected_demo" class="form-text small mt-2">
              <div class="text-break">SPA: <code>{{ selected_demo.erp_spa_url || '—' }}</code></div>
              <div class="text-break">API: <code>{{ selected_demo.erp_api_url || '—' }}</code></div>
            </div>
          </div>
        </div>

        <!--
          Variables manuales del .env: las mismas is_manual_on_create que pide la instalación de
          un cliente (GET /env-template, scope empresa por default). Son las credenciales de la
          base que ya creaste en hPanel.
        -->
        <div v-if="manual_templates.length > 0" class="mt-4">
          <h6 class="text-muted mb-1">Variables del .env que se cargan a mano</h6>
          <p class="small text-muted">
            Son las credenciales de la base de datos que creaste en hPanel para esta demo. El resto
            del <code>.env</code> lo arma la plantilla del sistema.
          </p>
          <div class="row g-2">
            <div
              v-for="template in manual_templates"
              :key="template.id"
              class="col-12 col-md-6"
            >
              <label class="form-label small mb-1 text-break">
                <code>{{ template.key }}</code>
                <span v-if="template.notes" class="text-muted ms-1">— {{ template.notes }}</span>
              </label>
              <input
                v-model="new_installation.env_manual_values[template.key]"
                class="form-control form-control-sm"
                :placeholder="template.notes || template.key"
              />
            </div>
          </div>
        </div>

        <div v-else class="alert alert-secondary py-2 small mt-3 mb-0">
          La plantilla <code>.env</code> del sistema no tiene ninguna variable marcada como
          "manual al crear", así que no hay nada que completar acá.
        </div>
      </form>

      <template #footer>
        <button type="button" class="btn btn-secondary" @click="show_create_modal = false">
          Cancelar
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!can_create || creating"
          @click="create_installation"
        >
          {{ creating ? 'Creando…' : 'Crear instalación' }}
        </button>
      </template>
    </base-modal>

    <!-- ==================== MODAL DE SEGUIMIENTO ==================== -->
    <base-modal
      :show="show_manage_modal"
      title="Seguimiento de la instalación"
      size="lg"
      @update:show="show_manage_modal = $event"
      @close="on_manage_modal_closed"
    >
      <template v-if="selected_installation">
        <demo-installation-info-card :installation="selected_installation" />
        <demo-installation-operations-panel :installation="selected_installation" />
      </template>

      <!--
        Footer propio para sumar "Eliminar". Al usar el slot se pierde el footer por defecto de
        base-modal (que llama a su close() interno), por eso "Cerrar" invoca a mano la limpieza
        del polling. La cruz del header sigue funcionando igual.
      -->
      <template #footer>
        <button
          type="button"
          class="btn btn-outline-danger btn-sm me-auto"
          :disabled="!selected_installation || selected_installation.status === 'instalando' || deleting"
          :title="selected_installation && selected_installation.status === 'instalando' ? 'No se puede eliminar una corrida en curso' : 'Eliminar esta corrida'"
          @click="delete_selected_installation"
        >
          <i class="bi bi-trash me-1" aria-hidden="true"></i>{{ deleting ? 'Eliminando...' : 'Eliminar' }}
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          @click="on_manage_modal_closed(); show_manage_modal = false"
        >
          Cerrar
        </button>
      </template>
    </base-modal>

  </div>
</template>

<script>
import api from '@/utils/axios'
import BaseModal from '@/components/ui/BaseModal.vue'
import demo_installation_api from '@/store/demo_installation'
import DemoInstallationInfoCard from '@/components/demo_installation/extra-props/InfoCard.vue'
import DemoInstallationOperationsPanel from '@/components/demo_installation/extra-props/OperationsPanel.vue'

/**
 * Pestaña "Sistema" de Demos > Instalaciones: instalación desde cero del ERP de una demo.
 *
 * Hermano de `Installations.vue` (el mismo pipeline pero para un cliente), con dos diferencias
 * que vienen del contrato de admin-api:
 *
 * 1. Acá no hay paso de "guardar variables y después iniciar": el POST /demo-installation crea
 *    la corrida y encola el job de una, así que las variables manuales del .env se piden en el
 *    modal de creación y viajan en el mismo request.
 * 2. Una demo tiene un solo destino (su ERP), no un par de subdominios alternándose: no hay
 *    selector de APIs destino ni instalaciones "esqueleto".
 */
export default {
  name: 'DemoSystemInstallations',

  components: {
    BaseModal,
    DemoInstallationInfoCard,
    DemoInstallationOperationsPanel,
  },

  data() {
    return {
      /** Corridas de instalación de sistema de demos. */
      installations: [],

      /** true mientras se carga el listado inicial. */
      loading: false,

      /** Catálogo de demos, para el selector del modal de creación. */
      demos: [],

      /** Versiones disponibles, para el selector del modal de creación. */
      versions: [],

      /** Variables is_manual_on_create de la plantilla .env del sistema. */
      manual_templates: [],

      /** true mientras se cargan demos/versiones/plantilla (solo la primera vez). */
      loading_create_data: false,

      /** true una vez que esos tres pedidos ya se resolvieron, para no repetirlos. */
      create_data_loaded: false,

      /** Controla la visibilidad del modal de creación. */
      show_create_modal: false,

      /** Texto de filtro del selector de demos. */
      demo_filter_text: '',

      /** Formulario del modal de creación. */
      new_installation: {
        demo_id: null,
        version_id: null,
        env_manual_values: {},
      },

      /** true mientras se dispara la creación (POST /demo-installation). */
      creating: false,

      /** Controla la visibilidad del modal de seguimiento. */
      show_manage_modal: false,

      /** Corrida abierta en el modal de seguimiento (null = modal cerrado). */
      selected_installation: null,

      /** Timer de polling de la corrida abierta en el modal. */
      polling_timer: null,

      /** true mientras se elimina la corrida seleccionada. */
      deleting: false,
    }
  },

  computed: {
    /**
     * Demos filtradas por el texto de búsqueda (nombre o URL del ERP).
     *
     * @returns {Array<Object>}
     */
    filtered_demos() {
      const self = this
      const text = (self.demo_filter_text || '').trim().toLowerCase()
      if (!text) {
        return self.demos
      }
      return self.demos.filter(function (demo) {
        const haystack = [demo.nombre, demo.erp_spa_url, demo.erp_api_url]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.indexOf(text) !== -1
      })
    },

    /**
     * Demo elegida en el formulario (objeto completo), para mostrar sus URLs de destino.
     *
     * @returns {Object|null}
     */
    selected_demo() {
      const self = this
      if (!self.new_installation.demo_id) {
        return null
      }
      return self.demos.find(function (d) { return d.id === self.new_installation.demo_id }) || null
    },

    /**
     * Versiones ordenadas por id descendente (coherente con el orden del backend).
     *
     * @returns {Array<Object>}
     */
    versions_desc() {
      return this.versions.slice().sort(function (a, b) { return b.id - a.id })
    },

    /**
     * ¿Están todas las variables manuales completas?
     *
     * @returns {boolean}
     */
    all_manual_values_filled() {
      const values = this.new_installation.env_manual_values || {}
      let all_filled = true
      this.manual_templates.forEach(function (template) {
        const value = values[template.key]
        if (!value || String(value).trim() === '') {
          all_filled = false
        }
      })
      return all_filled
    },

    /**
     * Habilita el botón de crear: demo, versión y todas las variables manuales cargadas.
     *
     * @returns {boolean}
     */
    can_create() {
      const form = this.new_installation
      return !!(form.demo_id && form.version_id && this.all_manual_values_filled)
    },
  },

  created() {
    this.load_installations()
  },

  beforeUnmount() {
    this.stop_polling()
  },

  methods: {
    /**
     * Carga el listado de corridas de instalación de sistema de demos.
     *
     * @returns {void}
     */
    load_installations() {
      const self = this
      self.loading = true
      demo_installation_api.fetch_installations()
        .then(function (res) {
          self.installations = (res.data && res.data.models) || []
        })
        .catch(function () {
          /* El interceptor de axios ya muestra el toast de error. */
        })
        .finally(function () {
          self.loading = false
        })
    },

    /**
     * Carga demos, versiones y la plantilla .env para el modal de creación. Solo la primera vez.
     *
     * @returns {void}
     */
    load_create_data() {
      const self = this
      self.loading_create_data = true
      Promise.all([
        demo_installation_api.fetch_demos(),
        api.get('/version'),
        api.get('/env-template'),
      ])
        .then(function (responses) {
          self.demos = (responses[0].data && responses[0].data.models) || []
          self.versions = (responses[1].data && responses[1].data.models) || []
          self.manual_templates = ((responses[2].data && responses[2].data.models) || [])
            .filter(function (t) { return t.is_manual_on_create })
          self.create_data_loaded = true

          /* Preselecciona la última versión publicada, igual que la instalación de un cliente. */
          const published = self.versions.filter(function (v) { return v.status === 'published' })
          if (published.length > 0) {
            const latest = published.reduce(function (a, b) { return a.id > b.id ? a : b })
            self.new_installation.version_id = latest.id
          }
        })
        .catch(function () {
          /* El interceptor de axios ya muestra el toast de error. */
        })
        .finally(function () {
          self.loading_create_data = false
        })
    },

    /**
     * Abre el modal de creación con el formulario limpio.
     *
     * @returns {void}
     */
    open_create_modal() {
      this.new_installation = { demo_id: null, version_id: null, env_manual_values: {} }
      this.demo_filter_text = ''
      this.show_create_modal = true
      if (!this.create_data_loaded) {
        this.load_create_data()
        return
      }
      /* Con los datos ya cacheados, la preselección de versión se repone acá. */
      const published = this.versions.filter(function (v) { return v.status === 'published' })
      if (published.length > 0) {
        const latest = published.reduce(function (a, b) { return a.id > b.id ? a : b })
        this.new_installation.version_id = latest.id
      }
    },

    /**
     * Sin lógica al cerrar: el formulario se resetea recién en la próxima apertura.
     *
     * @returns {void}
     */
    on_create_modal_closed() {},

    /**
     * Crea la corrida (POST /demo-installation) y abre el modal de seguimiento de inmediato:
     * el backend ya encoló el job, así que hay algo que mirar desde el primer segundo.
     *
     * @returns {void}
     */
    create_installation() {
      const self = this
      if (!self.can_create) {
        return
      }
      self.creating = true
      demo_installation_api.create_installation({
        demo_id: self.new_installation.demo_id,
        version_id: self.new_installation.version_id,
        env_manual_values: self.new_installation.env_manual_values,
      })
        .then(function (res) {
          const created = res.data.model
          self.installations.unshift(created)
          self.show_create_modal = false
          self.open_manage_modal(created)
        })
        .catch(function () {
          /* El interceptor de axios ya muestra el toast de error. */
        })
        .finally(function () {
          self.creating = false
        })
    },

    /**
     * Abre el modal de seguimiento de una corrida y arranca el polling si todavía no terminó.
     *
     * @param {Object} installation
     * @returns {void}
     */
    open_manage_modal(installation) {
      this.selected_installation = installation
      this.show_manage_modal = true
      if (installation && this.is_running(installation.status)) {
        this.start_polling()
      }
    },

    /**
     * Detiene el polling y limpia la selección al cerrar el modal de seguimiento.
     *
     * @returns {void}
     */
    on_manage_modal_closed() {
      this.stop_polling()
      this.selected_installation = null
    },

    /**
     * ¿La corrida sigue viva? 'pendiente' cuenta: el job está encolado y todavía no arrancó,
     * pero va a arrancar solo — sin polling la pantalla se quedaría clavada en gris.
     *
     * @param {string} status
     * @returns {boolean}
     */
    is_running(status) {
      return status === 'pendiente' || status === 'instalando'
    },

    /**
     * Arranca el polling de la corrida abierta, cada 3 segundos.
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
     * Detiene el polling en curso.
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
     * Refresca la corrida abierta y refleja el estado nuevo también en la fila del listado.
     *
     * @returns {void}
     */
    poll_installation() {
      const self = this
      if (!self.selected_installation) {
        self.stop_polling()
        return
      }
      demo_installation_api.fetch_installation(self.selected_installation.id)
        .then(function (res) {
          const updated = res.data.model
          if (!updated) {
            return
          }
          self.selected_installation = updated

          const index = self.installations.findIndex(function (i) { return i.id === updated.id })
          if (index !== -1) {
            self.installations.splice(index, 1, updated)
          }

          if (!self.is_running(updated.status)) {
            self.stop_polling()
          }
        })
        .catch(function () {
          /* Polling: silencia errores de red transitorios. */
        })
    },

    /**
     * Elimina la corrida abierta (previa confirmación) y la saca del listado.
     *
     * @returns {void}
     */
    delete_selected_installation() {
      const self = this
      if (!self.selected_installation) {
        return
      }
      if (!window.confirm('¿Eliminar esta corrida? Esta acción no se puede deshacer.')) {
        return
      }
      /* Se guarda el id antes: selected_installation se limpia al terminar. */
      const deleted_id = self.selected_installation.id
      self.deleting = true
      demo_installation_api.delete_installation(deleted_id)
        .then(function () {
          self.stop_polling()
          const index = self.installations.findIndex(function (i) { return i.id === deleted_id })
          if (index !== -1) {
            self.installations.splice(index, 1)
          }
          self.show_manage_modal = false
          self.selected_installation = null
        })
        .catch(function () {
          /* El interceptor de axios ya muestra el error (ej. 422 si está en curso). */
        })
        .finally(function () {
          self.deleting = false
        })
    },

    /**
     * Nombre legible de una demo del catálogo.
     *
     * @param {Object} demo
     * @returns {string}
     */
    demo_label(demo) {
      return demo_installation_api.demo_label(demo)
    },

    /**
     * Nombre de la demo de una fila del listado. Si la corrida no trae la relación cargada, se
     * cruza contra el catálogo (que puede no estar cargado todavía) y en última instancia se
     * muestra el id, para no dejar la celda vacía.
     *
     * @param {Object} installation
     * @returns {string}
     */
    row_demo_label(installation) {
      if (installation.demo) {
        return demo_installation_api.demo_label(installation.demo)
      }
      const self = this
      const demo = self.demos.find(function (d) { return d.id === installation.demo_id })
      if (demo) {
        return demo_installation_api.demo_label(demo)
      }
      return 'Demo #' + installation.demo_id
    },

    /**
     * Clase del badge según el estado de la corrida (mismo mapeo que Installations.vue).
     *
     * @param {string} status
     * @returns {string}
     */
    status_badge_class(status) {
      const map = {
        pendiente:  'bg-secondary',
        instalando: 'bg-primary',
        completada: 'bg-success',
        fallida:    'bg-danger',
      }
      return map[status] || 'bg-secondary'
    },

    /**
     * Formatea fecha ISO para la tabla.
     *
     * @param {string|null} datetime
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
