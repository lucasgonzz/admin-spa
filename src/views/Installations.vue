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
    </div>

    <!-- Carga inicial -->
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="text-muted mt-2">Cargando instalaciones…</p>
    </div>

    <!-- Sin registros -->
    <div v-else-if="installations.length === 0" class="alert alert-secondary">
      No hay instalaciones registradas. Podés crear una desde el detalle de un cliente
      (Clientes → abrir cliente → pestaña Instalaciones).
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
              <!-- Abre el modal de gestión de esta instalación puntual (reemplaza la navegación anterior) -->
              <button
                type="button"
                class="btn btn-sm btn-outline-primary"
                @click="open_manage_modal(installation)"
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
    }
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
