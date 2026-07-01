<template>
  <div class="client-shared-database-group">
    <small class="text-muted d-block mb-2">Base de datos compartida</small>

  <div v-if="loading_groups" class="text-muted small">Cargando grupos...</div>

  <template v-else-if="!client_in_group">
    <p class="text-muted small mb-2">Este cliente no comparte BD con ningún otro cliente.</p>

    <div v-if="show_assign_form" class="d-flex flex-wrap gap-2 align-items-center mb-2">
      <select v-model="selected_group_id" class="form-select form-select-sm" style="max-width: 220px">
        <option :value="null">— Elegir grupo —</option>
        <option v-for="group in available_groups" :key="group.id" :value="group.id">
          {{ group_label(group) }}
        </option>
      </select>
      <button
        type="button"
        class="btn btn-sm btn-primary"
        :disabled="!selected_group_id || loading_action !== ''"
        @click="assign_to_existing_group"
      >
        {{ loading_action === 'assign' ? 'Asignando...' : 'Confirmar asignación' }}
      </button>
      <button
        type="button"
        class="btn btn-sm btn-link text-muted"
        :disabled="loading_action !== ''"
        @click="show_assign_form = false"
      >
        Cancelar
      </button>
    </div>

    <div v-else class="d-flex flex-wrap gap-2">
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary"
        :disabled="loading_action !== '' || available_groups.length === 0"
        @click="show_assign_form = true"
      >
        Asignar a grupo existente
      </button>
      <button
        type="button"
        class="btn btn-sm btn-outline-primary"
        :disabled="loading_action !== ''"
        @click="create_group_and_assign"
      >
        {{ loading_action === 'create_and_assign' ? 'Creando...' : 'Crear nuevo grupo y asignar' }}
      </button>
    </div>
  </template>

  <template v-else>
    <p class="mb-1 small">
      <span class="fw-semibold">{{ current_group_label }}</span>
    </p>
    <ul v-if="other_clients_in_group.length" class="small text-muted mb-2 ps-3">
      <li v-for="peer in other_clients_in_group" :key="peer.id">{{ peer.name }}</li>
    </ul>
    <p v-else class="text-muted small mb-2">No hay otros clientes en este grupo.</p>
    <button
      type="button"
      class="btn btn-sm btn-outline-danger"
      :disabled="loading_action !== ''"
      @click="remove_from_group"
    >
      {{ loading_action === 'remove' ? 'Quitando...' : 'Quitar del grupo' }}
    </button>
  </template>
  </div>
</template>

<script>
import { resolve_error_message } from '@/utils/axios'

/**
 * Sección del panel de cliente para gestionar la pertenencia a un grupo de BD compartida.
 */
export default {
  name: 'ClientSharedDatabaseGroup',
  props: {
    /**
     * Cliente en edición (borrador del modal CRUD).
     */
    record: { type: Object, default: null },
  },
  emits: ['record-updated'],
  data() {
    return {
      /**
       * Grupos cargados desde la API para asignación y listado de pares.
       */
      groups: [],
      /**
       * Indica carga inicial de grupos.
       */
      loading_groups: false,
      /**
       * Acción en curso (assign, create_and_assign, remove).
       */
      loading_action: '',
      /**
       * Muestra el formulario de asignación a grupo existente.
       */
      show_assign_form: false,
      /**
       * ID del grupo elegido en el select de asignación.
       */
      selected_group_id: null,
    }
  },
  computed: {
    /**
     * Indica si el cliente pertenece a algún grupo de BD compartida.
     * @returns {boolean}
     */
    client_in_group() {
      return Boolean(this.record && this.record.shared_database_group_id)
    },
    /**
     * Grupo actual del cliente según el listado cargado.
     * @returns {Object|null}
     */
    current_group() {
      if (!this.client_in_group) {
        return null
      }
      var group_id = this.record.shared_database_group_id
      var found = null
      this.groups.forEach(function (group) {
        if (group.id === group_id) {
          found = group
        }
      })
      return found
    },
    /**
     * Etiqueta legible del grupo actual (nombre o fallback por ID).
     * @returns {string}
     */
    current_group_label() {
      if (this.current_group) {
        return this.group_label(this.current_group)
      }
      return 'Grupo #' + this.record.shared_database_group_id
    },
    /**
     * Otros clientes del mismo grupo (excluye el cliente actual).
     * @returns {Array<Object>}
     */
    other_clients_in_group() {
      if (!this.current_group || !this.current_group.clients) {
        return []
      }
      var self_id = this.record.id
      var peers = []
      this.current_group.clients.forEach(function (client) {
        if (client.id !== self_id) {
          peers.push(client)
        }
      })
      return peers
    },
    /**
     * Grupos disponibles para asignar (todos los existentes).
     * @returns {Array<Object>}
     */
    available_groups() {
      return this.groups
    },
  },
  watch: {
    /**
     * Recarga grupos si cambia el ID del cliente o su grupo asignado.
     */
    'record.id': {
      immediate: true,
      handler() {
        this.load_groups()
      },
    },
    'record.shared_database_group_id'() {
      this.load_groups()
    },
  },
  methods: {
    /**
     * Etiqueta de un grupo para selects y encabezados.
     * @param {Object} group Grupo serializado.
     * @returns {string}
     */
    group_label(group) {
      if (group.name) {
        return group.name + ' (#' + group.id + ')'
      }
      return 'Grupo #' + group.id
    },
    /**
     * Muestra feedback al operador (toast global o alert).
     * @param {string} message Texto a mostrar.
     * @returns {void}
     */
    open_feedback(message) {
      if (this.$root && this.$root.$emit) {
        this.$root.$emit('open_toast', message)
        return
      }
      alert(message)
    },
    /**
     * Normaliza mensajes de error de la API.
     * @param {any} error Error capturado.
     * @returns {string}
     */
    get_error_message(error) {
      return resolve_error_message(error)
    },
    /**
     * Aplica el cliente devuelto por la API al record local y notifica al padre.
     * @param {Object|null} client_model Cliente fullModel.
     * @returns {void}
     */
    apply_client_model(client_model) {
      if (!client_model || !this.record) {
        return
      }
      var self = this
      Object.keys(client_model).forEach(function (key) {
        self.record[key] = client_model[key]
      })
      self.$emit('record-updated', self.record)
    },
    /**
     * Carga el listado de grupos desde el store.
     * @returns {void}
     */
    load_groups() {
      if (!this.record || !this.record.id) {
        return
      }
      var self = this
      self.loading_groups = true
      self.$store
        .dispatch('shared_database_group/getSharedDatabaseGroups')
        .then(function (models) {
          self.groups = models || []
        })
        .catch(function (error) {
          self.open_feedback(self.get_error_message(error))
        })
        .then(function () {
          self.loading_groups = false
        })
    },
    /**
     * Asigna el cliente al grupo seleccionado en el dropdown.
     * @returns {void}
     */
    assign_to_existing_group() {
      var self = this
      if (!self.record || !self.record.id || !self.selected_group_id) {
        return
      }
      self.loading_action = 'assign'
      self.$store
        .dispatch('shared_database_group/assignClientToGroup', {
          client_id: self.record.id,
          group_id: self.selected_group_id,
        })
        .then(function (client_model) {
          self.apply_client_model(client_model)
          self.show_assign_form = false
          self.selected_group_id = null
          self.load_groups()
          self.open_feedback('Cliente asignado al grupo correctamente.')
        })
        .catch(function (error) {
          self.open_feedback(self.get_error_message(error))
        })
        .then(function () {
          self.loading_action = ''
        })
    },
    /**
     * Crea un grupo nuevo (nombre opcional) y asigna al cliente.
     * @returns {void}
     */
    create_group_and_assign() {
      var self = this
      if (!self.record || !self.record.id) {
        return
      }
      /** Nombre opcional ingresado por el operador. */
      var optional_name = window.prompt('Nombre del grupo (opcional):', '')
      if (optional_name === null) {
        return
      }
      optional_name = optional_name.trim()
      if (optional_name === '') {
        optional_name = null
      }
      self.loading_action = 'create_and_assign'
      self.$store
        .dispatch('shared_database_group/createSharedDatabaseGroup', optional_name)
        .then(function (group) {
          if (!group || !group.id) {
            throw new Error('No se pudo crear el grupo.')
          }
          return self.$store.dispatch('shared_database_group/assignClientToGroup', {
            client_id: self.record.id,
            group_id: group.id,
          })
        })
        .then(function (client_model) {
          self.apply_client_model(client_model)
          self.load_groups()
          self.open_feedback('Grupo creado y cliente asignado correctamente.')
        })
        .catch(function (error) {
          self.open_feedback(self.get_error_message(error))
        })
        .then(function () {
          self.loading_action = ''
        })
    },
    /**
     * Quita al cliente del grupo tras confirmación.
     * @returns {void}
     */
    remove_from_group() {
      var self = this
      if (!self.record || !self.record.id) {
        return
      }
      if (!window.confirm('¿Querés quitar a este cliente del grupo de BD compartida?')) {
        return
      }
      self.loading_action = 'remove'
      self.$store
        .dispatch('shared_database_group/removeClientFromGroup', self.record.id)
        .then(function (client_model) {
          self.apply_client_model(client_model)
          self.load_groups()
          self.open_feedback('Cliente quitado del grupo correctamente.')
        })
        .catch(function (error) {
          self.open_feedback(self.get_error_message(error))
        })
        .then(function () {
          self.loading_action = ''
        })
    },
  },
}
</script>
