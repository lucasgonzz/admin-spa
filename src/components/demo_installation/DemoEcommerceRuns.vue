<template>
  <div class="demo-ecommerce-runs">

    <!-- Encabezado de la pestaña -->
    <div class="d-flex align-items-start flex-wrap gap-2 mb-3">
      <div class="flex-grow-1">
        <h5 class="mb-0">{{ texts.heading }}</h5>
        <p class="text-muted small mb-0 mt-1">
          {{ texts.subheading }}
        </p>
      </div>
      <button
        type="button"
        class="btn btn-primary ms-md-auto"
        @click="open_create_modal"
      >
        {{ texts.create_button }}
      </button>
    </div>

    <!-- Carga inicial del listado -->
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="text-muted mt-2">Cargando corridas…</p>
    </div>

    <!-- Sin corridas registradas todavía -->
    <div v-else-if="runs.length === 0" class="alert alert-secondary">
      {{ texts.empty_state }}
    </div>

    <!-- Tabla de corridas -->
    <div v-else class="table-responsive">
      <table class="table table-hover table-sm align-middle">
        <thead class="table-light">
          <tr>
            <th>#</th>
            <th>Demo</th>
            <th>Estado</th>
            <th class="d-none d-md-table-cell">Inicio</th>
            <th class="d-none d-md-table-cell">Fin</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="run in runs"
            :key="run.id"
            style="cursor: pointer"
            @click="open_manage_modal(run)"
          >
            <td>{{ run.id }}</td>
            <td class="text-break">{{ run_demo_label(run) }}</td>
            <td>
              <span class="badge" :class="status_badge_class(run.status)">
                {{ run.status }}
              </span>
            </td>
            <td class="small text-muted d-none d-md-table-cell">
              {{ format_datetime(run.started_at) || '—' }}
            </td>
            <td class="small text-muted d-none d-md-table-cell">
              {{ format_datetime(run.finished_at) || '—' }}
            </td>
            <td class="text-end">
              <!-- La fila entera ya abre el modal: @click.stop evita que se dispare dos veces. -->
              <button
                type="button"
                class="btn btn-sm btn-outline-primary"
                @click.stop="open_manage_modal(run)"
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
      :title="texts.create_modal_title"
      @update:show="show_create_modal = $event"
      @close="on_create_modal_closed"
    >
      <div v-if="loading_demos" class="text-center py-4">
        <div class="spinner-border text-primary" role="status"></div>
      </div>

      <form v-else @submit.prevent>
        <p class="text-muted small">
          {{ texts.create_modal_help }}
        </p>

        <!-- Filtro de texto sobre el catálogo, para no scrollear un select largo -->
        <div class="mb-2">
          <label class="form-label small">Buscar demo</label>
          <input
            v-model="demo_filter_text"
            type="text"
            class="form-control form-control-sm"
            placeholder="Escribí para filtrar por nombre o URL…"
          />
        </div>

        <div class="mb-3">
          <label class="form-label small">Demo</label>
          <select
            v-model="selected_demo_id"
            class="form-select form-select-sm"
            size="8"
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

        <!-- Destino del ecommerce de la demo elegida, para no disparar sobre el subdominio equivocado. -->
        <div v-if="selected_demo" class="alert alert-light border py-2 small mb-0">
          <div class="text-break">Ecommerce SPA: <code>{{ selected_demo.ecommerce_spa_url || '— sin cargar —' }}</code></div>
          <div class="text-break">Ecommerce API: <code>{{ selected_demo.ecommerce_api_url || '— sin cargar —' }}</code></div>
          <div
            v-if="selected_demo.ecommerce_hosting_type === 'vps'"
            class="text-danger mt-1 mb-0"
          >
            Esta demo tiene el ecommerce marcado como VPS. El pipeline de ecommerce todavía solo
            sabe desplegar en hosting compartido, así que la corrida va a fallar antes de conectarse.
          </div>
        </div>
      </form>

      <template #footer>
        <button type="button" class="btn btn-secondary" @click="show_create_modal = false">
          Cancelar
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!selected_demo_id || creating"
          @click="create_run"
        >
          {{ creating ? 'Creando…' : texts.create_modal_submit }}
        </button>
      </template>
    </base-modal>

    <!-- ==================== MODAL DE SEGUIMIENTO ==================== -->
    <base-modal
      :show="show_manage_modal"
      :title="texts.manage_modal_title"
      size="lg"
      @update:show="show_manage_modal = $event"
      @close="on_manage_modal_closed"
    >
      <template v-if="selected_run">
        <p class="text-muted small mb-3 text-break">
          {{ run_demo_label(selected_run) }}
          <span v-if="selected_run.client_ecommerce && selected_run.client_ecommerce.domain">
            — <code>{{ selected_run.client_ecommerce.domain }}</code>
          </span>
        </p>
        <ecommerce-operations-panel :installation="selected_run" />
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
          :disabled="!selected_run || selected_run.status === 'instalando' || deleting"
          :title="selected_run && selected_run.status === 'instalando' ? 'No se puede eliminar una corrida en curso' : 'Eliminar esta corrida'"
          @click="delete_selected_run"
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
import BaseModal from '@/components/ui/BaseModal.vue'
import EcommerceOperationsPanel from '@/components/ecommerce-installation/extra-props/EcommerceOperationsPanel.vue'
import demo_installation_api from '@/store/demo_installation'

/**
 * Textos de cada modo. Están acá y no en el template porque las dos pantallas son la MISMA
 * salvo estas frases y el endpoint que se dispara; escribirlo dos veces era garantía de que
 * una de las dos quedara desactualizada.
 */
const TEXTS_BY_MODE = {
  install: {
    heading: 'Instalación del ecommerce',
    subheading: 'Instala desde cero la tienda (tienda-spa + tienda-api) de una demo, usando siempre la última versión de master.',
    create_button: '+ Nueva instalación',
    empty_state: 'Todavía no se instaló el ecommerce de ninguna demo. Creá una corrida con el botón "+ Nueva instalación".',
    create_modal_title: 'Nueva instalación del ecommerce de una demo',
    create_modal_help: 'Se va a instalar desde cero la tienda de la demo elegida, con la última versión publicada en master de tienda-spa y tienda-api. La demo tiene que tener cargadas sus URLs de ecommerce en el catálogo.',
    create_modal_submit: 'Crear instalación',
    manage_modal_title: 'Seguimiento de la instalación',
  },
  update: {
    heading: 'Actualización del ecommerce',
    subheading: 'Actualiza la tienda (tienda-spa + tienda-api) ya instalada de una demo, usando siempre la última versión de master.',
    create_button: '+ Nueva actualización',
    empty_state: 'Todavía no se actualizó el ecommerce de ninguna demo. Creá una corrida con el botón "+ Nueva actualización".',
    create_modal_title: 'Nueva actualización del ecommerce de una demo',
    create_modal_help: 'Se va a actualizar la tienda de la demo elegida, con la última versión publicada en master de tienda-spa y tienda-api. No hace falta elegir versión.',
    create_modal_submit: 'Crear actualización',
    manage_modal_title: 'Seguimiento de la actualización',
  },
}

/**
 * Corridas de ecommerce cuyo dueño es una DEMO, en sus dos modos: instalación desde cero y
 * actualización. Es el equivalente demo de `EcommerceInstallations.vue` / `EcommerceUpdates.vue`,
 * con el mismo pipeline y el mismo panel de seguimiento (EcommerceOperationsPanel): después de
 * polimorfizar el dueño del `ClientEcommerce`, al backend le da igual si es cliente o demo.
 *
 * A diferencia de esas dos vistas —que son dos archivos casi idénticos— acá va uno solo con una
 * prop `mode`: lo único que cambia entre instalar y actualizar son los textos y qué endpoint se
 * dispara. El listado es el mismo (GET /ecommerce-installations?owner=demo trae las dos cosas) y
 * cada modo filtra por `mode`.
 */
export default {
  name: 'DemoEcommerceRuns',

  components: {
    BaseModal,
    EcommerceOperationsPanel,
  },

  props: {
    /**
     * Qué corridas muestra y qué endpoint dispara el botón de crear.
     *
     * @values 'install', 'update'
     */
    mode: {
      type: String,
      required: true,
      validator: function (value) {
        return value === 'install' || value === 'update'
      },
    },
  },

  data() {
    return {
      /** Corridas de ecommerce de demos, ya filtradas por `mode`. */
      runs: [],

      /** true mientras se carga el listado inicial. */
      loading: false,

      /** Catálogo de demos, para el selector del modal de creación. */
      demos: [],

      /** true mientras se carga el catálogo de demos. */
      loading_demos: false,

      /** true una vez cargado el catálogo, para no repetir el pedido en cada apertura. */
      demos_loaded: false,

      /** Controla la visibilidad del modal de creación. */
      show_create_modal: false,

      /** Texto de filtro del selector de demos. */
      demo_filter_text: '',

      /** Demo elegida en el modal de creación. */
      selected_demo_id: null,

      /** true mientras se dispara la corrida. */
      creating: false,

      /** Controla la visibilidad del modal de seguimiento. */
      show_manage_modal: false,

      /** Corrida abierta en el modal de seguimiento (null = modal cerrado). */
      selected_run: null,

      /** Timer de polling de la corrida abierta. */
      polling_timer: null,

      /** true mientras se elimina la corrida seleccionada. */
      deleting: false,
    }
  },

  computed: {
    /**
     * Textos del modo actual.
     *
     * @returns {Object}
     */
    texts() {
      return TEXTS_BY_MODE[this.mode] || TEXTS_BY_MODE.install
    },

    /**
     * Demos filtradas por el texto de búsqueda (nombre o URLs).
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
        const haystack = [demo.nombre, demo.erp_spa_url, demo.ecommerce_spa_url]
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
      if (!self.selected_demo_id) {
        return null
      }
      return self.demos.find(function (d) { return d.id === self.selected_demo_id }) || null
    },
  },

  created() {
    this.load_runs()
    this.load_demos()
  },

  beforeUnmount() {
    this.stop_polling()
  },

  methods: {
    /**
     * Carga las corridas de ecommerce de demos y se queda solo con las del modo de esta pantalla.
     *
     * El endpoint devuelve instalaciones y actualizaciones juntas; el filtro por `mode` es el
     * mismo criterio que usan las vistas equivalentes de clientes.
     *
     * @returns {void}
     */
    load_runs() {
      const self = this
      self.loading = true
      demo_installation_api.fetch_ecommerce_runs()
        .then(function (res) {
          const models = (res.data && res.data.models) || []
          self.runs = models.filter(function (run) {
            return self.mode === 'update' ? run.mode === 'update' : run.mode !== 'update'
          })
        })
        .catch(function () {
          /* El interceptor de axios ya muestra el toast de error. */
        })
        .finally(function () {
          self.loading = false
        })
    },

    /**
     * Carga el catálogo de demos (una sola vez): sirve para el selector del modal y para
     * resolver el nombre de la demo de cada fila del listado.
     *
     * @returns {void}
     */
    load_demos() {
      const self = this
      if (self.demos_loaded) {
        return
      }
      self.loading_demos = true
      demo_installation_api.fetch_demos()
        .then(function (res) {
          self.demos = (res.data && res.data.models) || []
          self.demos_loaded = true
        })
        .catch(function () {
          /* El interceptor de axios ya muestra el toast de error. */
        })
        .finally(function () {
          self.loading_demos = false
        })
    },

    /**
     * Abre el modal de creación con el formulario limpio.
     *
     * @returns {void}
     */
    open_create_modal() {
      this.selected_demo_id = null
      this.demo_filter_text = ''
      this.show_create_modal = true
      if (!this.demos_loaded) {
        this.load_demos()
      }
    },

    /**
     * Sin lógica al cerrar: el formulario se resetea recién en la próxima apertura.
     *
     * @returns {void}
     */
    on_create_modal_closed() {},

    /**
     * Dispara la corrida sobre la demo elegida y abre el seguimiento de inmediato.
     *
     * Si la demo no tiene el ecommerce configurado, el backend responde 422 y el interceptor de
     * axios ya muestra el mensaje.
     *
     * @returns {void}
     */
    create_run() {
      const self = this
      if (!self.selected_demo_id) {
        return
      }
      self.creating = true
      const request = self.mode === 'update'
        ? demo_installation_api.start_ecommerce_update(self.selected_demo_id)
        : demo_installation_api.start_ecommerce_install(self.selected_demo_id)

      request
        .then(function (res) {
          const created = res.data.model
          self.runs.unshift(created)
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
     * Abre el modal de seguimiento de una corrida y arranca el polling si sigue en curso.
     *
     * @param {Object} run
     * @returns {void}
     */
    open_manage_modal(run) {
      this.selected_run = run
      this.show_manage_modal = true
      if (run && run.status === 'instalando') {
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
      this.selected_run = null
    },

    /**
     * Arranca el polling de la corrida abierta, cada 2 segundos (igual que el camino de clientes).
     *
     * @returns {void}
     */
    start_polling() {
      if (this.polling_timer !== null) {
        return
      }
      const self = this
      self.polling_timer = setInterval(function () {
        self.poll_logs()
      }, 2000)
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
     * Refresca las líneas de log y el estado de la corrida abierta, y refleja el estado nuevo
     * también en la fila del listado.
     *
     * @returns {void}
     */
    poll_logs() {
      const self = this
      if (!self.selected_run) {
        self.stop_polling()
        return
      }
      demo_installation_api.fetch_ecommerce_logs(self.selected_run.id)
        .then(function (res) {
          const updated = Object.assign({}, self.selected_run, {
            status: res.data.status,
            logs: res.data.models,
          })
          self.selected_run = updated

          const index = self.runs.findIndex(function (r) { return r.id === updated.id })
          if (index !== -1) {
            self.runs.splice(index, 1, Object.assign({}, self.runs[index], {
              status: updated.status,
            }))
          }

          if (res.data.status !== 'instalando') {
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
    delete_selected_run() {
      const self = this
      if (!self.selected_run) {
        return
      }
      if (!window.confirm('¿Eliminar esta corrida? Esta acción no se puede deshacer.')) {
        return
      }
      /* Se guarda el id antes: selected_run se limpia al terminar. */
      const deleted_id = self.selected_run.id
      self.deleting = true
      demo_installation_api.delete_ecommerce_run(deleted_id)
        .then(function () {
          self.stop_polling()
          const index = self.runs.findIndex(function (r) { return r.id === deleted_id })
          if (index !== -1) {
            self.runs.splice(index, 1)
          }
          self.show_manage_modal = false
          self.selected_run = null
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
     * Nombre de la demo dueña de una corrida. El listado trae el `client_ecommerce` de cada
     * corrida pero no necesariamente la demo entera, así que se cruza contra el catálogo que se
     * carga aparte (mismo criterio que usan las vistas de clientes con GET /client).
     *
     * @param {Object} run
     * @returns {string}
     */
    run_demo_label(run) {
      const client_ecommerce = run && run.client_ecommerce
      if (!client_ecommerce) {
        return 'Demo desconocida'
      }
      if (client_ecommerce.demo) {
        return demo_installation_api.demo_label(client_ecommerce.demo)
      }
      const self = this
      const demo = self.demos.find(function (d) { return d.id === client_ecommerce.demo_id })
      if (demo) {
        return demo_installation_api.demo_label(demo)
      }
      return 'Demo #' + client_ecommerce.demo_id
    },

    /**
     * Clase del badge según el estado de la corrida (mismo mapeo que las vistas de clientes).
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
