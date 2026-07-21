<template>
  <div class="ecommerce-updates-view container-fluid px-0 py-4">

    <!-- Encabezado del submódulo -->
    <div class="d-flex align-items-center flex-wrap gap-2 mb-4">
      <div>
        <h4 class="mb-0">Actualizaciones del ecommerce</h4>
        <p class="text-muted small mb-0 mt-1">
          Actualiza la tienda (tienda-spa + tienda-api) de un cliente ya configurado, usando
          siempre la última versión de <code>master</code>.
        </p>
      </div>
      <!-- Botón que abre el modal de creación: elegís el cliente y listo, sin versión. -->
      <button
        type="button"
        class="btn btn-primary ms-auto"
        @click="open_create_modal"
      >
        + Nueva actualización
      </button>
    </div>

    <!-- Carga inicial del listado -->
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="text-muted mt-2">Cargando corridas…</p>
    </div>

    <!-- Sin corridas registradas todavía -->
    <div v-else-if="installations.length === 0" class="alert alert-secondary">
      Todavía no se corrió ninguna instalación ni actualización del ecommerce. Creá una con el
      botón "+ Nueva actualización".
    </div>

    <!-- Tabla de corridas -->
    <div v-else class="table-responsive">
      <table class="table table-hover table-sm align-middle">
        <thead class="table-light">
          <tr>
            <th>#</th>
            <th>Cliente</th>
            <th>Tipo</th>
            <th>Estado</th>
            <th>Inicio</th>
            <th>Fin</th>
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
            <td>{{ client_display_name(installation) }}</td>
            <td>{{ mode_label(installation.mode) }}</td>
            <td>
              <span
                class="badge"
                :class="status_badge_class(installation.status)"
              >
                {{ installation.status }}
              </span>
            </td>
            <td class="small text-muted">
              {{ format_datetime(installation.started_at) || '—' }}
            </td>
            <td class="small text-muted">
              {{ format_datetime(installation.finished_at) || '—' }}
            </td>
            <td class="text-end">
              <!--
                Abre el modal de seguimiento (log en vivo + checklist) de esta corrida puntual.
                @click.stop evita que se dispare dos veces (fila + botón).
              -->
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

    <!-- Modal de creación: solo pide el cliente, sin selector de versión (siempre master) -->
    <base-modal
      :show="show_create_modal"
      title="Nueva actualización del ecommerce"
      @update:show="show_create_modal = $event"
      @close="on_create_modal_closed"
    >
      <div v-if="loading_clients" class="text-center py-4">
        <div class="spinner-border text-primary" role="status"></div>
      </div>

      <form v-else @submit.prevent>
        <p class="text-muted small">
          Se va a disparar una actualización de la tienda del cliente elegido, usando siempre la
          última versión publicada en <code>master</code> de tienda-spa y tienda-api. No hace
          falta elegir versión.
        </p>

        <!-- Filtro de texto sobre la razón social, para no scrollear un select largo -->
        <div class="mb-2">
          <label class="form-label small">Buscar cliente (razón social)</label>
          <input
            v-model="client_filter_text"
            type="text"
            class="form-control form-control-sm"
            placeholder="Escribí para filtrar…"
          />
        </div>

        <!-- Selección de cliente: lista filtrada por el texto de arriba -->
        <div class="mb-3">
          <label class="form-label small">Cliente</label>
          <select
            v-model="new_update.client_id"
            class="form-select form-select-sm"
            size="8"
          >
            <option :value="null" disabled>Seleccioná un cliente…</option>
            <option
              v-for="client in filtered_clients"
              :key="client.id"
              :value="client.id"
            >
              {{ client_label(client) }}
            </option>
          </select>
          <p v-if="filtered_clients.length === 0" class="text-muted small mt-1 mb-0">
            No hay clientes que coincidan con el filtro.
          </p>
        </div>
      </form>

      <!-- Footer: crear queda deshabilitado hasta elegir cliente o mientras se dispara -->
      <template #footer>
        <button type="button" class="btn btn-secondary" @click="show_create_modal = false">
          Cancelar
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!new_update.client_id || creating"
          @click="create_update"
        >
          {{ creating ? 'Creando…' : 'Crear actualización' }}
        </button>
      </template>
    </base-modal>

    <!-- Modal de gestión: log en vivo + checklist de la corrida seleccionada -->
    <base-modal
      :show="show_manage_modal"
      title="Seguimiento de la actualización"
      size="lg"
      @update:show="show_manage_modal = $event"
      @close="on_manage_modal_closed"
    >
      <template v-if="selected_installation">
        <p class="text-muted small mb-3">
          {{ client_display_name(selected_installation) }}
          <span v-if="selected_installation.client_ecommerce && selected_installation.client_ecommerce.domain">
            — <code>{{ selected_installation.client_ecommerce.domain }}</code>
          </span>
        </p>
        <ecommerce-operations-panel :installation="selected_installation" />
      </template>
    </base-modal>

  </div>
</template>

<script>
import api from '@/utils/axios'
import BaseModal from '@/components/ui/BaseModal.vue'
import EcommerceOperationsPanel from '@/components/ecommerce-installation/extra-props/EcommerceOperationsPanel.vue'

/**
 * Submódulo "Actualizaciones del ecommerce" (prompt 587), dentro del módulo de Actualizaciones
 * (junto a la de empresa, ver routes.js). A diferencia de la actualización de empresa, acá NO se
 * elige versión: siempre se dispara la última de `master` (mode 'update'), reutilizando la acción
 * `start_update` del store `ecommerce_installation` (prompt 586) y el mismo panel de log en
 * vivo + checklist (EcommerceOperationsPanel) que ya usa el detalle embebido en el cliente.
 *
 * Listado (index_json, prompt 585) trae cada corrida con su `client_ecommerce` y `logs`
 * eager-cargados, pero no el `client` dueño de la tienda: para mostrar la razón social se
 * carga por separado GET /client (igual que hace Installations.vue) y se cruza por
 * client_ecommerce.client_id.
 */
export default {
  name: 'ViewEcommerceUpdates',

  components: {
    BaseModal,
    EcommerceOperationsPanel,
  },

  data() {
    return {
      /** Todas las corridas de instalación/actualización del ecommerce (todos los clientes). */
      installations: [],

      /** true mientras se carga el listado inicial. */
      loading: false,

      /** Clientes del sistema, para mostrar la razón social y poblar el selector de creación. */
      clients: [],

      /** true mientras se cargan los clientes (solo la primera vez que se abre el modal). */
      loading_clients: false,

      /** true una vez que los clientes ya se cargaron, para no repetir el pedido. */
      clients_loaded: false,

      /** Controla la visibilidad del modal de creación. */
      show_create_modal: false,

      /** Texto de filtro por razón social sobre el selector de clientes del modal de creación. */
      client_filter_text: '',

      /** Formulario del modal de creación: único campo que pide este submódulo. */
      new_update: {
        client_id: null,
      },

      /** true mientras se dispara la actualización (POST start-update). */
      creating: false,

      /** Controla la visibilidad del modal de seguimiento (log + checklist). */
      show_manage_modal: false,

      /** Corrida seleccionada para el modal de seguimiento (null = modal cerrado). */
      selected_installation: null,

      /** Timer de polling de la corrida en curso dentro del modal de seguimiento. */
      polling_timer: null,
    }
  },

  computed: {
    /**
     * Mapa client_id -> client, para resolver la razón social de cada fila del listado
     * sin recorrer el array completo en cada render.
     *
     * @returns {Object<number, Object>}
     */
    clients_by_id() {
      const map = {}
      this.clients.forEach(function (client) {
        map[client.id] = client
      })
      return map
    },

    /**
     * Clientes filtrados por el texto de búsqueda (razón social), para el selector del
     * modal de creación. Sin texto, muestra todos los clientes.
     *
     * @returns {Array<Object>}
     */
    filtered_clients() {
      const self = this
      const text = (this.client_filter_text || '').trim().toLowerCase()
      if (!text) {
        return this.clients
      }
      return this.clients.filter(function (client) {
        return (self.client_label(client) || '').toLowerCase().indexOf(text) !== -1
      })
    },
  },

  created() {
    this.load_installations()
    this.load_clients()
  },

  beforeUnmount() {
    this.stop_polling()
  },

  methods: {
    /**
     * Carga el listado global de corridas del ecommerce desde el store (GET /ecommerce-installations).
     *
     * @returns {void}
     */
    load_installations() {
      const self = this
      self.loading = true
      self.$store.dispatch('ecommerce_installation/fetch_all')
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
     * Carga los clientes del sistema (una sola vez) para mostrar la razón social en la tabla
     * y poblar el selector del modal de creación.
     *
     * @returns {void}
     */
    load_clients() {
      const self = this
      if (self.clients_loaded) {
        return
      }
      self.loading_clients = true
      api.get('/client')
        .then(function (res) {
          self.clients = res.data.models || []
          self.clients_loaded = true
        })
        .catch(function () {
          /* El interceptor de axios ya muestra el toast de error. */
        })
        .finally(function () {
          self.loading_clients = false
        })
    },

    /**
     * Abre el modal de creación con el formulario limpio.
     *
     * @returns {void}
     */
    open_create_modal() {
      this.new_update = { client_id: null }
      this.client_filter_text = ''
      this.show_create_modal = true
      if (!this.clients_loaded) {
        this.load_clients()
      }
    },

    /**
     * Sin lógica adicional al cerrar: el formulario se resetea recién en la próxima apertura.
     *
     * @returns {void}
     */
    on_create_modal_closed() {},

    /**
     * Dispara la actualización del ecommerce del cliente elegido (siempre última de master, sin
     * versión) reutilizando `start_update` del store `ecommerce_installation` (prompt 586). Si
     * el cliente elegido no tiene ecommerce configurado, el backend responde 422 y el interceptor
     * de axios ya muestra el mensaje de error correspondiente.
     *
     * @returns {void}
     */
    create_update() {
      const self = this
      if (!self.new_update.client_id) {
        return
      }
      self.creating = true
      self.$store.dispatch('ecommerce_installation/start_update', self.new_update.client_id)
        .then(function (res) {
          const created = res.data.model
          self.installations.unshift(created)
          self.show_create_modal = false
          self.open_manage_modal(created)
        })
        .catch(function () {
          /* El interceptor de axios ya muestra el toast de error (ej. 422 sin ecommerce configurado). */
        })
        .finally(function () {
          self.creating = false
        })
    },

    /**
     * Abre el modal de seguimiento (log en vivo + checklist) de una corrida puntual y arranca
     * el polling si todavía está en curso.
     *
     * @param {Object} installation
     * @returns {void}
     */
    open_manage_modal(installation) {
      this.selected_installation = installation
      this.show_manage_modal = true
      if (installation && installation.status === 'instalando') {
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
     * Inicia el polling de la corrida seleccionada cada 2 segundos, igual que
     * EcommerceInstallationDetail.vue.
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
     * Refresca las líneas de log y el status de la corrida seleccionada. Corta el polling
     * apenas deja de estar 'instalando' y refleja el cambio también en la fila del listado.
     *
     * @returns {void}
     */
    poll_logs() {
      const self = this
      if (!self.selected_installation) {
        self.stop_polling()
        return
      }
      self.$store.dispatch('ecommerce_installation/fetch_logs', self.selected_installation.id)
        .then(function (res) {
          const updated = Object.assign({}, self.selected_installation, {
            status: res.data.status,
            logs: res.data.models,
          })
          self.selected_installation = updated

          /* Refleja el estado nuevo en la fila correspondiente del listado. */
          const index = self.installations.findIndex(function (i) { return i.id === updated.id })
          if (index !== -1) {
            self.installations.splice(index, 1, Object.assign({}, self.installations[index], {
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
     * Nombre legible del cliente dueño de una corrida, cruzando client_ecommerce.client_id
     * contra el mapa de clientes cargado aparte (el listado de corridas no trae el cliente).
     *
     * @param {Object} installation
     * @returns {string}
     */
    client_display_name(installation) {
      const client_ecommerce = installation && installation.client_ecommerce
      if (!client_ecommerce) {
        return 'Cliente desconocido'
      }
      const client = this.clients_by_id[client_ecommerce.client_id]
      if (!client) {
        return 'Cliente #' + client_ecommerce.client_id
      }
      return this.client_label(client)
    },

    /**
     * Razón social de un cliente, con el mismo orden de prioridad que
     * Client::resolve_display_name() en el backend (company_name > name/business_name > id).
     *
     * @param {Object} client
     * @returns {string}
     */
    client_label(client) {
      if (!client) {
        return ''
      }
      return client.company_name || client.name || client.business_name || ('Cliente #' + client.id)
    },

    /**
     * Etiqueta legible del modo de la corrida.
     *
     * @param {string} mode
     * @returns {string}
     */
    mode_label(mode) {
      return mode === 'update' ? 'Actualización' : 'Instalación'
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
