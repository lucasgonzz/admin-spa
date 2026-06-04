<template>
  <base-modal
    :show="show"
    title="Nuevo ticket"
    size="sm"
    @update:show="on_update_show"
    @close="close">
    <div v-if="clients_loading" class="text-muted small d-flex align-items-center">
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      Cargando clientes…
    </div>
    <template v-else>
      <div class="mb-3">
        <label class="form-label" for="support_create_ticket_client">Cliente</label>
        <select
          id="support_create_ticket_client"
          v-model="selected_client_id"
          class="form-select"
          :disabled="creating">
          <option :value="null">Seleccioná un cliente…</option>
          <option v-for="client in client_options" :key="client.id" :value="client.id">
            {{ client_label(client) }}
          </option>
        </select>
      </div>
      <p v-if="clients_error" class="text-danger small mb-2">{{ clients_error }}</p>
      <p v-if="submit_error" class="text-danger small mb-2">{{ submit_error }}</p>
      <button
        type="button"
        class="btn btn-primary w-100"
        :disabled="!can_submit"
        @click="submit">
        <span v-if="creating" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
        {{ creating ? 'Creando…' : 'Crear' }}
      </button>
    </template>
  </base-modal>
</template>

<script>
import api from '@/utils/axios'
import BaseModal from '@/components/ui/BaseModal.vue'

/**
 * Modal para crear un ticket de soporte manual eligiendo el cliente (tenant).
 */
export default {
  name: 'CreateTicketModal',
  components: {
    BaseModal,
  },
  props: {
    /**
     * Visibilidad del modal (v-model:show).
     */
    show: {
      type: Boolean,
      default: false,
    },
    /**
     * Operador logueado; se asigna al ticket creado.
     */
    assigned_admin_id: {
      type: [Number, String],
      default: null,
    },
  },
  emits: ['update:show', 'created'],
  data() {
    return {
      /** Clientes activos para el select. */
      client_options: [],
      /** Id seleccionado en el combo. */
      selected_client_id: null,
      /** GET /client en curso. */
      clients_loading: false,
      /** Error al cargar clientes. */
      clients_error: '',
      /** POST /support-ticket en curso. */
      creating: false,
      /** Error de validación o API al crear. */
      submit_error: '',
    }
  },
  computed: {
    /**
     * Habilita Crear cuando hay cliente válido y no hay petición en curso.
     *
     * @returns {boolean}
     */
    can_submit() {
      if (this.creating || this.clients_loading || this.selected_client_id == null) {
        return false
      }
      return !!this.selected_client_row
    },
    /**
     * Fila del cliente elegido en el select.
     *
     * @returns {Object|null}
     */
    selected_client_row() {
      const selected_id = this.selected_client_id
      if (selected_id == null) {
        return null
      }
      let found = null
      this.client_options.forEach(function (client) {
        if (String(client.id) === String(selected_id)) {
          found = client
        }
      })
      return found
    },
  },
  watch: {
    /**
     * Al abrir el modal, carga clientes y limpia el formulario.
     *
     * @param {boolean} is_visible
     */
    show(is_visible) {
      if (is_visible) {
        this.reset_form()
        this.load_clients()
      }
    },
  },
  methods: {
    /**
     * Sincroniza v-model:show con el padre.
     *
     * @param {boolean} value
     * @returns {void}
     */
    on_update_show(value) {
      this.$emit('update:show', value)
    },
    /**
     * Cierra el modal y notifica al padre.
     *
     * @returns {void}
     */
    close() {
      this.$emit('update:show', false)
    },
    /**
     * Limpia selección y mensajes previos.
     *
     * @returns {void}
     */
    reset_form() {
      this.selected_client_id = null
      this.clients_error = ''
      this.submit_error = ''
      this.creating = false
    },
    /**
     * Etiqueta legible del cliente en el select.
     *
     * @param {Object} client
     * @returns {string}
     */
    client_label(client) {
      if (!client) {
        return ''
      }
      const company_name = client.company_name ? String(client.company_name).trim() : ''
      const contact_name = client.name ? String(client.name).trim() : ''
      if (company_name && contact_name) {
        return company_name + ' — ' + contact_name
      }
      if (company_name) {
        return company_name
      }
      if (contact_name) {
        return contact_name
      }
      return 'Cliente #' + client.id
    },
    /**
     * Carga clientes activos desde admin-api.
     *
     * @returns {void}
     */
    load_clients() {
      const self = this
      this.clients_loading = true
      this.clients_error = ''
      api
        .get('/client')
        .then(function (response) {
          const raw_models = response.data && response.data.models
          const rows = Array.isArray(raw_models) ? raw_models : (raw_models && raw_models.data) || []
          const active_rows = []
          rows.forEach(function (client) {
            if (client.is_active !== false && client.is_active !== 0) {
              active_rows.push(client)
            }
          })
          active_rows.sort(function (a, b) {
            return self.client_label(a).localeCompare(self.client_label(b), 'es')
          })
          self.client_options = active_rows
        })
        .catch(function () {
          self.clients_error = 'No se pudieron cargar los clientes.'
          self.client_options = []
        })
        .then(function () {
          self.clients_loading = false
        })
    },
    /**
     * Resuelve client_user_id del bloque ComercioCity del cliente.
     *
     * @param {Object} client
     * @returns {number|null}
     */
    resolve_client_user_id(client) {
      if (!client || client.user_id == null || client.user_id === '') {
        return null
      }
      const parsed = parseInt(client.user_id, 10)
      if (isNaN(parsed)) {
        return null
      }
      return parsed
    },
    /**
     * Crea el ticket vía Vuex y emite created con el id persistido.
     *
     * @returns {void}
     */
    submit() {
      const client = this.selected_client_row
      if (!client || this.creating) {
        return
      }
      const client_user_id = this.resolve_client_user_id(client)
      if (client_user_id == null) {
        this.submit_error = 'El cliente seleccionado no tiene USER_ID configurado en admin.'
        return
      }
      const self = this
      this.submit_error = ''
      this.creating = true
      const contact_name = client.name ? String(client.name).trim() : ''
      const company_name = client.company_name ? String(client.company_name).trim() : ''
      let client_user_name = contact_name
      if (!client_user_name) {
        client_user_name = company_name
      }
      this.$store
        .dispatch('support_ticket/store', {
          client_id: Number(client.id),
          client_user_id: client_user_id,
          client_user_name: client_user_name || null,
          assigned_admin_id: this.assigned_admin_id,
          name: null,
        })
        .then(function (model) {
          self.creating = false
          if (model && model.id) {
            self.$emit('created', model.id)
            self.close()
            return
          }
          self.submit_error = 'No se pudo crear el ticket.'
        })
        .catch(function () {
          self.creating = false
          self.submit_error = 'Error al crear el ticket. Revisá la consola o intentá de nuevo.'
        })
    },
  },
}
</script>
