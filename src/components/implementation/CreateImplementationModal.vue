<template>
  <!--
    Modal de creación de una nueva implementación (Prompt 178-05).
    Buscador de cliente de selección única + botón de confirmación.
    Reutiliza BaseModal como los demás modales del admin (ver Leads.vue / CreateTicketModal.vue).
  -->
  <base-modal
    :show="show"
    title="Nueva implementación"
    size="sm"
    @update:show="on_update_show"
    @close="close"
  >
    <!-- Estado: cargando el catálogo de clientes -->
    <div v-if="clients_loading" class="text-muted small d-flex align-items-center">
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      Cargando clientes…
    </div>

    <template v-else>
      <!-- Buscador por razón social / nombre -->
      <div class="mb-2">
        <label class="form-label" for="create_impl_client_search">Cliente</label>
        <input
          id="create_impl_client_search"
          v-model="search_text"
          type="text"
          class="form-control form-control-sm"
          placeholder="Buscar cliente por razón social…"
          :disabled="creating"
          @focus="dropdown_open = true"
        />
      </div>

      <!-- Cliente ya elegido: chip con opción de cambiarlo -->
      <div v-if="selected_client" class="create-impl-selected d-flex align-items-center justify-content-between mb-2">
        <span class="text-truncate">{{ client_label(selected_client) }}</span>
        <button
          type="button"
          class="btn btn-link btn-sm p-0"
          :disabled="creating"
          @click="clear_selection"
        >
          Cambiar
        </button>
      </div>

      <!-- Dropdown de resultados filtrados (solo mientras no hay cliente confirmado) -->
      <ul
        v-if="!selected_client && dropdown_open && search_text.trim() !== ''"
        class="create-impl-dropdown"
      >
        <li
          v-for="client in filtered_clients"
          :key="client.id"
          class="create-impl-dropdown__option"
          @click="select_client(client)"
        >
          {{ client_label(client) }}
        </li>
        <li v-if="!filtered_clients.length" class="create-impl-dropdown__empty">
          Sin resultados (o el cliente ya tiene una implementación iniciada)
        </li>
      </ul>

      <p v-if="clients_error" class="text-danger small mb-2 mt-2">{{ clients_error }}</p>
      <p v-if="submit_error" class="text-danger small mb-2 mt-2">{{ submit_error }}</p>
    </template>

    <!-- Footer: botón de confirmación, habilitado solo con cliente elegido -->
    <template #footer>
      <button type="button" class="btn btn-secondary btn-sm" :disabled="creating" @click="close">
        Cancelar
      </button>
      <button
        type="button"
        class="btn btn-primary btn-sm"
        :disabled="!can_submit"
        @click="submit"
      >
        <span v-if="creating" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
        {{ creating ? 'Creando…' : 'Crear implementación' }}
      </button>
    </template>
  </base-modal>
</template>

<script>
import api from '@/utils/axios'
import BaseModal from '@/components/ui/BaseModal.vue'

/**
 * Modal para dar de alta una nueva implementación eligiendo el cliente (Prompt 178-05).
 *
 * Carga el catálogo de clientes desde GET /client la primera vez que se abre y lo
 * cachea en data (no vuelve a pedirlo en aperturas posteriores). Excluye del buscador
 * los clientes que ya tienen una implementación iniciada, cruzando contra la prop
 * `existing_client_ids` que arma el padre a partir de `this.implementations`.
 *
 * Al confirmar hace POST /client/{id}/implementation/start y emite `created` con el
 * modelo devuelto por el backend para que el padre refresque el listado y seleccione
 * la implementación recién creada.
 */
export default {
  name: 'CreateImplementationModal',
  components: { BaseModal },
  props: {
    /** Visibilidad del modal (v-model:show). */
    show: {
      type: Boolean,
      default: false,
    },
    /** IDs de clientes que ya tienen una implementación iniciada, a excluir del buscador. */
    existing_client_ids: {
      type: Array,
      default: () => [],
    },
  },
  emits: ['update:show', 'created'],
  data() {
    return {
      /** Catálogo completo de clientes, cacheado tras el primer GET /client. */
      clients: [],
      /** True mientras se resuelve el GET /client inicial. */
      clients_loading: false,
      /** True si ya se cargó el catálogo al menos una vez (evita repetir el GET). */
      clients_loaded: false,
      /** Mensaje de error al cargar clientes. */
      clients_error: '',
      /** Texto tipeado en el buscador. */
      search_text: '',
      /** Controla si el dropdown de resultados está desplegado. */
      dropdown_open: false,
      /** Cliente elegido (objeto completo, no solo el id). */
      selected_client: null,
      /** True mientras el POST de creación está en curso. */
      creating: false,
      /** Mensaje de error de la creación (incluye el caso 422 de cliente duplicado). */
      submit_error: '',
    }
  },
  computed: {
    /**
     * Habilita "Crear implementación" solo con un cliente elegido y sin request en curso.
     *
     * @returns {boolean}
     */
    can_submit() {
      return !!this.selected_client && !this.creating
    },
    /**
     * Clientes que matchean el texto buscado y que todavía no tienen implementación.
     * Sin acentos ni distinción de mayúsculas, tope de 8 resultados.
     *
     * @returns {Array<Object>}
     */
    filtered_clients() {
      const query = this.normalize_text(this.search_text)
      if (query === '') {
        return []
      }
      const excluded = this.existing_client_ids
      const self = this
      const matches = this.clients.filter(function (client) {
        if (excluded.some(function (id) { return String(id) === String(client.id) })) {
          return false
        }
        return self.normalize_text(self.client_label(client)).indexOf(query) !== -1
      })
      return matches.slice(0, 8)
    },
  },
  watch: {
    /**
     * Al abrir el modal: resetea el formulario y carga clientes (solo la primera vez).
     *
     * @param {boolean} is_visible
     * @returns {void}
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
     * Quita acentos y pasa a minúsculas para comparar texto sin distinguir tildes/mayúsculas.
     *
     * @param {string} value
     * @returns {string}
     */
    normalize_text(value) {
      return String(value || '')
        .normalize('NFD')
        .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
        .toLowerCase()
        .trim()
    },
    /**
     * Etiqueta visible de un cliente: razón social si existe, si no nombre de contacto.
     *
     * @param {Object} client
     * @returns {string}
     */
    client_label(client) {
      if (!client) {
        return ''
      }
      const company_name = client.company_name ? String(client.company_name).trim() : ''
      if (company_name) {
        return company_name
      }
      const contact_name = client.name ? String(client.name).trim() : ''
      if (contact_name) {
        return contact_name
      }
      return 'Cliente #' + client.id
    },
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
     * Cierra el modal (mientras no haya una creación en curso).
     *
     * @returns {void}
     */
    close() {
      if (this.creating) {
        return
      }
      this.$emit('update:show', false)
    },
    /**
     * Limpia selección, búsqueda y mensajes de error previos.
     *
     * @returns {void}
     */
    reset_form() {
      this.search_text = ''
      this.dropdown_open = false
      this.selected_client = null
      this.submit_error = ''
      this.creating = false
    },
    /**
     * Carga el catálogo de clientes desde GET /client, una sola vez por sesión del modal.
     *
     * @returns {void}
     */
    load_clients() {
      if (this.clients_loaded) {
        return
      }

      const self = this
      this.clients_loading = true
      this.clients_error = ''

      api
        .get('/client')
        .then(function (response) {
          const raw_models = response.data && response.data.models
          self.clients = Array.isArray(raw_models) ? raw_models : (raw_models && raw_models.data) || []
          self.clients_loaded = true
        })
        .catch(function () {
          self.clients_error = 'No se pudieron cargar los clientes.'
          self.clients = []
        })
        .then(function () {
          self.clients_loading = false
        })
    },
    /**
     * Elige un cliente del dropdown y cierra la lista de resultados.
     *
     * @param {Object} client
     * @returns {void}
     */
    select_client(client) {
      this.selected_client = client
      this.dropdown_open = false
      this.search_text = ''
    },
    /**
     * Vuelve a mostrar el buscador para elegir otro cliente.
     *
     * @returns {void}
     */
    clear_selection() {
      this.selected_client = null
      this.search_text = ''
    },
    /**
     * Confirma la creación: POST /client/{id}/implementation/start.
     *
     * En éxito (201) emite `created` con el modelo devuelto y cierra el modal.
     * En 422 (cliente ya tiene implementación) muestra un toast claro y deja el
     * modal abierto para que se pueda elegir otro cliente. El resto de errores
     * ya los cubre el interceptor global de axios.
     *
     * @returns {void}
     */
    submit() {
      if (!this.can_submit) {
        return
      }

      const self = this

      /** ID del cliente elegido para el POST de creación. */
      const client_id = this.selected_client.id

      this.submit_error = ''
      this.creating = true

      api
        .post('/client/' + client_id + '/implementation/start')
        .then(function (res) {
          const model = res.data && res.data.model
          self.$emit('created', model)
        })
        .catch(function (error) {
          const status = error && error.response && error.response.status

          if (status === 422) {
            /** Mensaje del backend (cliente ya tiene una implementación iniciada). */
            const message = (error.response.data && error.response.data.message) || 'Este cliente ya tiene una implementación iniciada.'
            window.dispatchEvent(
              new CustomEvent('admin-spa-toast', {
                detail: { message: message, variant: 'danger' },
              })
            )
            return
          }
          /* Otros errores: el interceptor global de axios ya muestra el toast. */
        })
        .then(function () {
          self.creating = false
        })
    },
  },
}
</script>

<style scoped>
/* Chip del cliente ya elegido, mismo tono neutro que el resto de tarjetas del admin */
.create-impl-selected {
	background-color: #f5f5f7;
	border-radius: 8px;
	padding: 6px 10px;
	font-size: 0.875rem;
}

/* Dropdown de resultados del buscador */
.create-impl-dropdown {
	list-style: none;
	margin: 2px 0 0;
	padding: 4px 0;
	border: 1px solid #e9ecef;
	border-radius: 8px;
	background: #fff;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
	max-height: 200px;
	overflow-y: auto;
}

.create-impl-dropdown__option {
	padding: 6px 12px;
	font-size: 0.875rem;
	cursor: pointer;
}

.create-impl-dropdown__option:hover {
	background: #f1f3f5;
}

.create-impl-dropdown__empty {
	padding: 6px 12px;
	font-size: 0.8rem;
	color: #adb5bd;
}
</style>
