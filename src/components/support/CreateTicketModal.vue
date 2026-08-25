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

      <!-- Canal por el que va a viajar la conversación. Los dos son excluyentes. -->
      <div class="mb-3">
        <label class="form-label d-block">Canal</label>
        <div class="btn-group w-100" role="group" aria-label="Canal de la conversación">
          <button
            type="button"
            class="btn btn-sm"
            :class="source === 'erp' ? 'btn-primary' : 'btn-outline-secondary'"
            :disabled="creating"
            @click="source = 'erp'">
            Sistema
          </button>
          <button
            type="button"
            class="btn btn-sm"
            :class="source === 'whatsapp' ? 'btn-success' : 'btn-outline-secondary'"
            :disabled="creating || whatsapp_disabled"
            :title="whatsapp_disabled ? whatsapp_disabled_reason : 'Abrir la conversación por WhatsApp'"
            @click="source = 'whatsapp'">
            WhatsApp
          </button>
        </div>
        <p v-if="whatsapp_disabled && whatsapp_disabled_reason" class="text-muted small mt-2 mb-0">
          {{ whatsapp_disabled_reason }}
        </p>
      </div>

      <template v-if="source === 'whatsapp'">
        <div class="mb-3">
          <label class="form-label" for="support_create_ticket_phone">Contacto</label>
          <div v-if="contacts_loading" class="text-muted small d-flex align-items-center">
            <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            Buscando teléfonos del cliente…
          </div>
          <select
            v-else
            id="support_create_ticket_phone"
            v-model="selected_phone"
            class="form-select"
            :disabled="creating">
            <option :value="null">Seleccioná un contacto…</option>
            <option v-for="contact in whatsapp_contacts" :key="contact.phone" :value="contact.phone">
              {{ contact.label }} — {{ contact.phone }}
            </option>
          </select>
        </div>

        <!-- Aviso de ventana: el operador tiene que saber ANTES de mandar si su texto sale
             tal cual o metido dentro de la plantilla aprobada de Meta. -->
        <div v-if="selected_contact" class="alert py-2 px-3 small" :class="window_alert_class">
          {{ window_alert_text }}
        </div>

        <div class="mb-3">
          <label class="form-label" for="support_create_ticket_body">Mensaje</label>
          <textarea
            id="support_create_ticket_body"
            v-model="message_body"
            class="form-control"
            rows="4"
            :maxlength="body_max_length"
            :disabled="creating"
            placeholder="Escribí el primer mensaje…"></textarea>
          <div class="d-flex justify-content-end">
            <small class="text-muted">{{ message_body.length }}/{{ body_max_length }}</small>
          </div>
        </div>
      </template>

      <p v-if="clients_error" class="text-danger small mb-2">{{ clients_error }}</p>
      <p v-if="submit_error" class="text-danger small mb-2">{{ submit_error }}</p>
      <button
        type="button"
        class="btn w-100"
        :class="source === 'whatsapp' ? 'btn-success' : 'btn-primary'"
        :disabled="!can_submit"
        @click="submit">
        <span v-if="creating" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
        {{ submit_label }}
      </button>
    </template>
  </base-modal>
</template>

<script>
import api from '@/utils/axios'
import BaseModal from '@/components/ui/BaseModal.vue'

/**
 * Modal para crear un ticket de soporte manual eligiendo el cliente (tenant).
 *
 * Con canal WhatsApp abre la conversación por Kapso en vez de replicarla al ERP del
 * cliente: elige un contacto de la ficha, avisa si el mensaje va a salir como texto libre
 * o dentro de la plantilla aprobada, y manda el primer mensaje.
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
      /** Canal elegido: erp (default, comportamiento de siempre) o whatsapp. */
      source: 'erp',
      /** Contactos de WhatsApp del cliente con el estado de su ventana de 24hs. */
      whatsapp_contacts: [],
      /** GET /support-ticket/whatsapp-contacts en curso. */
      contacts_loading: false,
      /** El GET ya volvió para el cliente elegido. */
      contacts_loaded: false,
      /** Teléfono elegido, en E.164. */
      selected_phone: null,
      /** Texto del primer mensaje. */
      message_body: '',
      /** Nombre de la plantilla de apertura configurada en el admin. */
      template_name: '',
      /** Tope del primer mensaje. Es el de la variable de plantilla, que es el más chico:
          un tope variable según el contacto dejaba texto ya escrito por encima del límite. */
      body_max_length: 600,
      /** El GET de contactos falló; distinto de "el cliente no tiene teléfonos". */
      contacts_error: '',
    }
  },
  computed: {
    /**
     * Habilita el botón según el canal elegido.
     *
     * @returns {boolean}
     */
    can_submit() {
      if (this.creating || this.clients_loading || this.selected_client_id == null) {
        return false
      }
      if (!this.selected_client_row) {
        return false
      }
      if (this.source === 'whatsapp') {
        return !!this.selected_phone && this.message_body.trim().length > 0
      }
      return true
    },
    /**
     * Texto del botón según el canal.
     *
     * @returns {string}
     */
    submit_label() {
      if (this.creating) {
        return this.source === 'whatsapp' ? 'Enviando…' : 'Creando…'
      }
      return this.source === 'whatsapp' ? 'Enviar y abrir' : 'Crear'
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
    /**
     * Contacto elegido dentro de whatsapp_contacts.
     *
     * @returns {Object|null}
     */
    selected_contact() {
      const phone = this.selected_phone
      if (phone == null) {
        return null
      }
      let found = null
      this.whatsapp_contacts.forEach(function (contact) {
        if (contact.phone === phone) {
          found = contact
        }
      })
      return found
    },
    /**
     * WhatsApp deshabilitado si el cliente elegido no tiene ningún teléfono cargado.
     *
     * @returns {boolean}
     */
    whatsapp_disabled() {
      if (this.selected_client_id == null) {
        return true
      }
      if (this.contacts_loading || !this.contacts_loaded) {
        return false
      }
      return this.whatsapp_contacts.length === 0
    },
    /**
     * Motivo por el que WhatsApp está deshabilitado.
     *
     * @returns {string}
     */
    whatsapp_disabled_reason() {
      if (this.selected_client_id == null) {
        return ''
      }
      if (this.contacts_loading || this.whatsapp_contacts.length > 0) {
        return ''
      }
      if (this.contacts_error) {
        return this.contacts_error
      }
      if (!this.contacts_loaded) {
        return ''
      }
      return 'Este cliente no tiene ningún teléfono cargado, ni en la ficha ni como empleado. Cargalo primero: sin eso, la respuesta del cliente cae en el pipeline de leads.'
    },
    /**
     * Clase del cartel de ventana.
     *
     * @returns {string}
     */
    window_alert_class() {
      const contact = this.selected_contact
      if (contact && contact.window && contact.window.open) {
        return 'alert-success'
      }
      return 'alert-warning'
    },
    /**
     * Texto del cartel de ventana.
     *
     * @returns {string}
     */
    window_alert_text() {
      const contact = this.selected_contact
      if (contact && contact.window && contact.window.open) {
        return 'Escribió hace menos de 24hs: tu mensaje sale tal cual lo escribís.'
      }
      const nombre_plantilla = this.template_name ? ' (' + this.template_name + ')' : ''
      return 'Hace más de 24hs que no escribe, así que Meta no deja mandar texto libre: tu mensaje va adentro de la plantilla aprobada' + nombre_plantilla + '.'
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
    /**
     * Al cambiar de cliente, se traen sus contactos de WhatsApp.
     *
     * @param {number|null} client_id
     */
    selected_client_id() {
      this.selected_phone = null
      this.whatsapp_contacts = []
      this.contacts_loaded = false
      this.contacts_error = ''
      if (this.source === 'whatsapp') {
        this.load_whatsapp_contacts()
      }
    },
    /**
     * Los contactos se traen recién al elegir el canal WhatsApp.
     *
     * El endpoint resuelve la ventana de 24hs recorriendo los entrantes de tres tablas: no
     * tiene por qué correr cuando el operador está armando un ticket del canal Sistema.
     *
     * @param {string} value
     */
    source(value) {
      if (value === 'whatsapp' && !this.contacts_loaded && !this.contacts_loading) {
        this.load_whatsapp_contacts()
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
      this.source = 'erp'
      this.whatsapp_contacts = []
      this.selected_phone = null
      this.message_body = ''
      this.contacts_loading = false
      this.contacts_loaded = false
      this.contacts_error = ''
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
     * Trae los teléfonos del cliente y el estado de la ventana de cada uno.
     *
     * @returns {void}
     */
    load_whatsapp_contacts() {
      const client_id = this.selected_client_id
      if (client_id == null) {
        return
      }
      const self = this
      this.contacts_loading = true
      this.contacts_error = ''
      this.$store
        .dispatch('support_ticket/fetch_whatsapp_contacts', Number(client_id))
        .then(function (data) {
          // La respuesta puede llegar tarde, después de que el operador cambió de cliente.
          if (String(self.selected_client_id) !== String(client_id)) {
            return
          }
          self.whatsapp_contacts = Array.isArray(data.contacts) ? data.contacts : []
          self.template_name = data.template_name || ''
          self.contacts_loaded = true
          // Un solo contacto: se preselecciona para ahorrarle un clic al operador.
          if (self.whatsapp_contacts.length === 1) {
            self.selected_phone = self.whatsapp_contacts[0].phone
          }
        })
        .catch(function () {
          if (String(self.selected_client_id) !== String(client_id)) {
            return
          }
          self.whatsapp_contacts = []
          self.contacts_loaded = true
          self.contacts_error = 'No se pudieron traer los teléfonos del cliente. Probá de nuevo en un momento.'
        })
        .then(function () {
          if (String(self.selected_client_id) === String(client_id)) {
            self.contacts_loading = false
          }
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
     * Crea el ticket por el canal elegido.
     *
     * @returns {void}
     */
    submit() {
      if (this.creating) {
        return
      }
      if (this.source === 'whatsapp') {
        this.submit_whatsapp()
        return
      }
      this.submit_erp()
    },
    /**
     * Alta del canal ERP: replica el ticket en el sistema del cliente, como siempre.
     *
     * @returns {void}
     */
    submit_erp() {
      const client = this.selected_client_row
      if (!client) {
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
    /**
     * Alta del canal WhatsApp: abre la conversación y manda el primer mensaje.
     *
     * Si el envío falla el ticket igual queda creado, así que se abre el hilo lo mismo y el
     * error se muestra en la conversación, donde está el botón de reintentar.
     *
     * @returns {void}
     */
    submit_whatsapp() {
      const client = this.selected_client_row
      if (!client || !this.selected_phone) {
        return
      }
      const self = this
      this.submit_error = ''
      this.creating = true
      this.$store
        .dispatch('support_ticket/store_whatsapp', {
          client_id: Number(client.id),
          whatsapp_phone: this.selected_phone,
          body: this.message_body.trim(),
        })
        .then(function (data) {
          self.creating = false
          const model = data && data.model
          const whatsapp = (data && data.whatsapp) || {}
          if (!model || !model.id) {
            self.submit_error = 'No se pudo abrir la conversación.'
            return
          }
          if (whatsapp.delivery === 'failed') {
            self.submit_error = self.build_delivery_error(whatsapp)
            self.$emit('created', model.id)
            return
          }
          self.$emit('created', model.id)
          self.close()
        })
        .catch(function (error) {
          self.creating = false
          const respuesta = error && error.response
          const detalle = respuesta && respuesta.data && respuesta.data.error
          self.submit_error = detalle || 'Error al abrir la conversación. Revisá la consola o intentá de nuevo.'
        })
    },
    /**
     * Arma el aviso de envío fallido con el motivo que devolvió Meta.
     *
     * @param {Object} whatsapp Bloque whatsapp de la respuesta del alta.
     * @returns {string}
     */
    build_delivery_error(whatsapp) {
      let texto = 'La conversación quedó abierta, pero el mensaje no salió.'
      if (whatsapp.used_template) {
        texto += ' Se intentó con la plantilla' + (whatsapp.template_name ? ' ' + whatsapp.template_name : '') + '; revisá que esté aprobada en Meta.'
      }
      if (whatsapp.error) {
        texto += ' Motivo: ' + whatsapp.error
      }
      return texto
    },
  },
}
</script>
