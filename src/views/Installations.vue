<template>
  <div class="installations-view container-fluid px-0 py-4">

    <!-- Encabezado del listado global -->
    <div class="d-flex align-items-center flex-wrap gap-2 mb-4">
      <div>
        <h4 class="mb-0">Instalaciones</h4>
        <p class="text-muted small mb-0 mt-1">
          Instalaciones iniciales de sistema para todos los clientes.
        </p>
      </div>
      <!-- Botón que abre el modal de creación; ahora se puede instalar sin pasar por Clientes -->
      <button
        type="button"
        class="btn btn-primary ms-auto"
        @click="open_create_modal"
      >
        + Nueva instalación
      </button>
    </div>

    <!-- Carga inicial -->
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="text-muted mt-2">Cargando instalaciones…</p>
    </div>

    <!-- Sin registros: el empty state ahora invita a usar el botón nuevo, ya no hace falta ir a Clientes -->
    <div v-else-if="installations.length === 0" class="alert alert-secondary">
      No hay instalaciones registradas todavía. Creá una con el botón "+ Nueva instalación".
    </div>

    <!-- Tabla resumen -->
    <div v-else class="table-responsive">
      <table class="table table-hover table-sm align-middle">
        <thead class="table-light">
          <tr>
            <th>#</th>
            <th>Cliente</th>
            <th>Versión</th>
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
            <td>
              <span v-if="installation.version">
                {{ installation.version.version }}
              </span>
              <span v-else class="text-muted">—</span>
            </td>
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
                Abre el modal de gestión de esta instalación puntual (reemplaza la navegación anterior).
                Queda como affordance visual; la fila entera ya dispara el mismo handler, por eso
                @click.stop evita ejecutarlo dos veces (una por el <tr>, otra por el botón).
              -->
              <button
                type="button"
                class="btn btn-sm btn-outline-primary"
                @click.stop="open_manage_modal(installation)"
              >
                Gestionar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal de gestión: muestra InstallationDetail de la instalación seleccionada -->
    <base-modal
      :show="show_manage_modal"
      title="Gestionar instalación"
      size="lg"
      @update:show="show_manage_modal = $event"
      @close="on_manage_modal_closed"
    >
      <installation-detail
        v-if="selected_installation"
        :installation="selected_installation"
        @update:installation="on_modal_installation_updated"
        @deleted="on_modal_installation_deleted"
      />
    </base-modal>

    <!-- Modal de creación: elegir cliente, API destino y versión para instalar sin pasar por Clientes -->
    <base-modal
      :show="show_create_modal"
      title="Nueva instalación"
      @update:show="show_create_modal = $event"
      @close="on_create_modal_closed"
    >
      <div v-if="loading_create_data" class="text-center py-4">
        <div class="spinner-border text-primary" role="status"></div>
      </div>

      <form v-else @submit.prevent>
        <!-- Selección de cliente -->
        <div class="mb-3">
          <label class="form-label small">Cliente</label>
          <select
            v-model="new_installation.client_id"
            class="form-select form-select-sm"
            @change="on_client_selected"
          >
            <option :value="null" disabled>Seleccioná un cliente…</option>
            <option
              v-for="client in clients"
              :key="client.id"
              :value="client.id"
            >
              {{ client.name || client.business_name }}
            </option>
          </select>
        </div>

        <!-- Selección de API destino: deshabilitada hasta elegir cliente, preselecciona la activa -->
        <div class="mb-3">
          <label class="form-label small">API destino</label>
          <select
            v-model="new_installation.client_api_id"
            class="form-select form-select-sm"
            :disabled="!selected_client"
          >
            <option :value="null" disabled>Seleccioná una API…</option>
            <option
              v-for="client_api in selected_client_apis"
              :key="client_api.id"
              :value="client_api.id"
            >
              {{ client_api.url }}{{ client_api.id === selected_client_active_api_id ? ' (activa)' : '' }}
            </option>
          </select>
          <!-- Aviso cuando el cliente elegido no tiene ninguna API cargada -->
          <div
            v-if="selected_client && selected_client_apis.length === 0"
            class="alert alert-warning py-2 small mt-2"
          >
            Este cliente no tiene ninguna API cargada. Cargale una API en su perfil antes de instalar.
          </div>
        </div>

        <!-- Selección de versión: preselecciona la última publicada -->
        <div class="mb-3">
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
        </div>
      </form>

      <!-- Footer con el botón de crear: deshabilitado si falta algún campo o mientras se crea -->
      <template #footer>
        <button type="button" class="btn btn-secondary" @click="show_create_modal = false">
          Cancelar
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!can_create_installation || creating"
          @click="create_installation"
        >
          {{ creating ? 'Creando…' : 'Crear instalación' }}
        </button>
      </template>
    </base-modal>

  </div>
</template>

<script>
import api from '@/utils/axios'
import BaseModal from '@/components/ui/BaseModal.vue'
import InstallationDetail from '@/components/installation/InstallationDetail.vue'

/**
 * Listado global de instalaciones iniciales (visible en el menú lateral).
 *
 * Muestra todas las ClientInstallation del sistema. El botón "Gestionar" de cada fila
 * abre un modal con InstallationDetail para esa instalación puntual (variables manuales,
 * iniciar, logs con polling propio y eliminar), en vez de navegar a otra vista.
 */
export default {
  name: 'ViewInstallations',

  components: {
    BaseModal,
    InstallationDetail,
  },

  data() {
    return {
      /** Todas las instalaciones del sistema. */
      installations: [],

      /** true mientras se carga el listado. */
      loading: false,

      /** Instalación seleccionada para el modal de gestión (null = modal cerrado). */
      selected_installation: null,

      /** Controla la visibilidad del modal de gestión. */
      show_manage_modal: false,

      /** Controla la visibilidad del modal de creación. */
      show_create_modal: false,

      /** true mientras se cargan clientes/versiones para el modal de creación (solo la primera vez). */
      loading_create_data: false,

      /** true una vez que clientes y versiones ya se cargaron, para no recargar en cada apertura. */
      create_data_loaded: false,

      /** Clientes disponibles para el select (cada uno trae sus client_apis por withAll()). */
      clients: [],

      /** Versiones disponibles para el select del modal de creación. */
      versions: [],

      /** true mientras se está creando la instalación (POST /installations). */
      creating: false,

      /** Formulario del modal de creación: los tres campos que pide el prompt, en orden. */
      new_installation: {
        client_id: null,
        client_api_id: null,
        version_id: null,
      },
    }
  },

  computed: {
    /**
     * Cliente actualmente seleccionado en el formulario de creación (objeto completo,
     * con sus client_apis ya incluidas por withAll()).
     *
     * @returns {Object|null}
     */
    selected_client() {
      const self = this
      if (!self.new_installation.client_id) {
        return null
      }
      return self.clients.find(function (c) { return c.id === self.new_installation.client_id }) || null
    },

    /**
     * client_apis del cliente seleccionado. Se puebla el select de API destino con esta lista.
     *
     * @returns {Array}
     */
    selected_client_apis() {
      if (!this.selected_client) {
        return []
      }
      return this.selected_client.client_apis || []
    },

    /**
     * id de la API activa del cliente seleccionado, para marcarla visualmente y preseleccionarla.
     *
     * @returns {number|null}
     */
    selected_client_active_api_id() {
      return this.selected_client ? this.selected_client.active_client_api_id : null
    },

    /**
     * Versiones ordenadas por id descendente (coherente con orderByDesc('id') del backend).
     *
     * @returns {Array}
     */
    versions_desc() {
      return this.versions.slice().sort(function (a, b) { return b.id - a.id })
    },

    /**
     * Habilita el botón de crear solo cuando los tres campos están completos.
     *
     * @returns {boolean}
     */
    can_create_installation() {
      const form = this.new_installation
      return !!(form.client_id && form.client_api_id && form.version_id)
    },
  },

  created() {
    this.load_installations()
  },

  methods: {
    /**
     * Abre el modal de gestión para una instalación puntual del listado.
     *
     * @param {Object} installation
     * @returns {void}
     */
    open_manage_modal(installation) {
      this.selected_installation = installation
      this.show_manage_modal = true
    },

    /**
     * Limpia la selección al cerrar el modal (backdrop, Escape o botón cerrar).
     *
     * @returns {void}
     */
    on_manage_modal_closed() {
      this.selected_installation = null
    },

    /**
     * Abre el modal de creación. Carga clientes y versiones la primera vez que se abre
     * (se cachean en data, no se recargan en aperturas siguientes).
     *
     * @returns {void}
     */
    open_create_modal() {
      this.new_installation = { client_id: null, client_api_id: null, version_id: null }
      this.show_create_modal = true
      if (!this.create_data_loaded) {
        this.load_create_data()
      }
    },

    /**
     * Sin lógica adicional al cerrar: el formulario se resetea recién en la próxima apertura
     * (open_create_modal), así que acá no hace falta tocar nada.
     *
     * @returns {void}
     */
    on_create_modal_closed() {},

    /**
     * Carga clientes (con sus client_apis vía withAll()) y versiones para poblar los selects
     * del modal de creación. Solo se ejecuta una vez, la primera vez que se abre el modal.
     *
     * @returns {void}
     */
    load_create_data() {
      const self = this
      self.loading_create_data = true
      Promise.all([
        api.get('/client'),
        api.get('/version'),
      ])
        .then(function (responses) {
          self.clients = responses[0].data.models || []
          self.versions = responses[1].data.models || []
          self.create_data_loaded = true

          // Preselecciona automáticamente la última versión publicada (mayor id).
          const published_versions = self.versions.filter(function (v) { return v.status === 'published' })
          if (published_versions.length > 0) {
            const latest_published = published_versions.reduce(function (a, b) {
              return a.id > b.id ? a : b
            })
            self.new_installation.version_id = latest_published.id
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
     * Al elegir un cliente, preselecciona automáticamente su API activa (si tiene una).
     * Si el cliente no tiene ninguna client_api, el select queda vacío y el template
     * ya se encarga de mostrar el aviso correspondiente.
     *
     * @returns {void}
     */
    on_client_selected() {
      this.new_installation.client_api_id = this.selected_client_active_api_id || null
    },

    /**
     * Crea la instalación (POST /installations) y, si sale bien, cierra el modal de creación,
     * agrega la nueva instalación al principio de la tabla y abre de inmediato el modal de
     * gestión para que se completen las variables manuales y se pueda iniciar el pipeline.
     *
     * @returns {void}
     */
    create_installation() {
      const self = this
      self.creating = true
      api.post('/installations', {
        client_id: self.new_installation.client_id,
        client_api_id: self.new_installation.client_api_id,
        version_id: self.new_installation.version_id,
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
     * Refleja en la tabla global un cambio emitido por el InstallationDetail del modal.
     *
     * @param {Object} updated
     * @returns {void}
     */
    on_modal_installation_updated(updated) {
      this.selected_installation = updated
      const index = this.installations.findIndex(function (i) { return i.id === updated.id })
      if (index !== -1) {
        this.installations.splice(index, 1, updated)
      }
    },

    /**
     * Cierra el modal y quita la instalación eliminada de la tabla global.
     *
     * @param {number} installation_id
     * @returns {void}
     */
    on_modal_installation_deleted(installation_id) {
      this.installations = this.installations.filter(function (i) {
        return i.id !== installation_id
      })
      this.show_manage_modal = false
      this.selected_installation = null
    },

    /**
     * Carga el listado global desde GET /installations.
     *
     * @returns {void}
     */
    load_installations() {
      const self = this
      self.loading = true
      api.get('/installations')
        .then(function (res) {
          self.installations = res.data.models || []
        })
        .catch(function () {
          /* El interceptor de axios ya muestra el toast de error. */
        })
        .finally(function () {
          self.loading = false
        })
    },

    /**
     * Nombre legible del cliente asociado a la instalación.
     *
     * @param {Object} installation
     * @returns {string}
     */
    client_display_name(installation) {
      const client = installation.client
      if (!client) {
        return 'Cliente #' + installation.client_id
      }
      return client.name || client.business_name || ('Cliente #' + client.id)
    },

    /**
     * Clase del badge según el estado de la instalación.
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
