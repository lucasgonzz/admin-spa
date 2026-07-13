<template>
  <div class="client-installations container-fluid px-0 py-4">

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

    <!-- Listado de instalaciones: cada card se gestiona a sí misma (variables, iniciar, logs, eliminar) -->
    <div v-else>
      <installation-detail
        v-for="installation in installations"
        :key="installation.id"
        :installation="installation"
        @update:installation="on_installation_updated"
        @deleted="on_installation_deleted"
      />
    </div>

  </div>
</template>

<script>
import api from '@/utils/axios'
import InstallationDetail from '@/components/installation/InstallationDetail.vue'

/**
 * Vista de instalaciones iniciales de sistema para un cliente.
 *
 * Muestra la lista de ClientInstallations del cliente seleccionado y permite crear
 * nuevas instalaciones. La gestión individual de cada instalación (variables manuales,
 * iniciar pipeline, polling de logs propio, eliminar) vive en InstallationDetail.vue,
 * reutilizado también en el modal de gestión del listado global (Installations.vue).
 */
export default {
  name: 'ViewClientInstallations',

  components: {
    InstallationDetail,
  },

  data() {
    return {
      /** ID del cliente obtenido de los parámetros de la ruta. */
      client_id: null,

      /** Datos del cliente (nombre, etc.) */
      client: null,

      /** Lista de instalaciones del cliente. */
      installations: [],

      /** true mientras se carga la lista inicial de instalaciones. */
      loading: false,

      /** true mientras se está creando una nueva instalación. */
      creating: false,
    }
  },

  created() {
    /* Toma el clientId de los parámetros de la ruta (/clientes/:clientId/instalaciones). */
    this.client_id = this.$route.params.clientId

    this.load_installations()
  },

  methods: {
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
     * Reemplaza una instalación de la lista por su versión actualizada
     * (emitida por InstallationDetail tras un cambio de env, inicio o polling).
     *
     * @param {Object} updated
     * @returns {void}
     */
    on_installation_updated(updated) {
      const index = this.installations.findIndex(function (i) { return i.id === updated.id })
      if (index !== -1) {
        this.installations.splice(index, 1, updated)
      }
    },

    /**
     * Quita una instalación eliminada de la lista.
     *
     * @param {number} installation_id
     * @returns {void}
     */
    on_installation_deleted(installation_id) {
      this.installations = this.installations.filter(function (i) {
        return i.id !== installation_id
      })
    },
  },
}
</script>
