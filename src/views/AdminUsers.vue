<template>
  <!--
    Vista CRUD de usuarios admin (equipo interno de ComercioCity).
    Muestra la tabla de admins con acciones de crear, editar y eliminar.
    Si el admin editado tiene is_closer = true, muestra el panel de Google Calendar.
  -->
  <div class="admin-users-view">

    <!-- Barra de acciones superior -->
    <div class="d-flex align-items-center justify-content-between mb-4">
      <h1 class="h4 mb-0">Usuarios admin</h1>
      <button
        type="button"
        class="btn btn-primary"
        @click="open_create_modal"
      >
        <i class="bi bi-plus-lg me-1" />
        Nuevo usuario
      </button>
    </div>

    <!-- Spinner de carga inicial -->
    <div v-if="loading" class="text-center py-5 text-muted">
      <span class="spinner-border spinner-border-sm me-2" />
      Cargando usuarios…
    </div>

    <!-- Tabla de admins -->
    <div v-else class="table-responsive">
      <table class="table table-hover align-middle">
        <thead>
          <tr>
            <th style="width: 64px">N°</th>
            <th>Nombre</th>
            <th>Email</th>
            <th>Teléfono</th>
            <th>Es closer</th>
            <th style="width: 100px">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="admin in admins" :key="admin.id">
            <td class="text-muted small">{{ admin.id }}</td>
            <td>{{ admin.name }}</td>
            <td>{{ admin.email }}</td>
            <!-- Teléfono del admin; visible para verificar que el closer lo tiene cargado. -->
            <td class="text-muted small">{{ admin.phone_number || '—' }}</td>
            <td>
              <!-- Indicador visual del flag is_closer -->
              <span
                class="badge"
                :class="admin.is_closer ? 'bg-success' : 'bg-light text-muted'"
              >
                {{ admin.is_closer ? 'Sí' : 'No' }}
              </span>
            </td>
            <td>
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary me-1"
                title="Editar"
                @click="open_edit_modal(admin)"
              >
                <i class="bi bi-pencil" />
              </button>
              <button
                type="button"
                class="btn btn-sm btn-outline-danger"
                title="Eliminar"
                @click="on_delete(admin)"
              >
                <i class="bi bi-trash" />
              </button>
            </td>
          </tr>
          <tr v-if="!admins.length">
            <td colspan="6" class="text-muted text-center py-4">No hay usuarios registrados.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal de crear / editar admin -->
    <div
      v-if="show_modal"
      class="modal d-block"
      tabindex="-1"
      style="background: rgba(0,0,0,0.4)"
      @click.self="close_modal"
    >
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ editing_admin ? 'Editar usuario' : 'Nuevo usuario' }}</h5>
            <button type="button" class="btn-close" @click="close_modal" />
          </div>
          <div class="modal-body">

            <!-- Campo: Nombre -->
            <div class="mb-3">
              <label class="form-label">Nombre</label>
              <input
                v-model="form.name"
                type="text"
                class="form-control"
                :class="{ 'is-invalid': form_errors.name }"
                placeholder="Nombre completo"
              />
              <div v-if="form_errors.name" class="invalid-feedback">{{ form_errors.name }}</div>
            </div>

            <!-- Campo: Email (solo editable al crear) -->
            <div class="mb-3">
              <label class="form-label">Email</label>
              <input
                v-model="form.email"
                type="email"
                class="form-control"
                :class="{ 'is-invalid': form_errors.email }"
                :disabled="!!editing_admin"
                placeholder="email@example.com"
              />
              <div v-if="form_errors.email" class="invalid-feedback">{{ form_errors.email }}</div>
              <div v-if="editing_admin" class="form-text text-muted">El email no se puede cambiar.</div>
            </div>

            <!-- Campo: Contraseña (obligatoria al crear, opcional al editar) -->
            <div class="mb-3">
              <label class="form-label">
                {{ editing_admin ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña' }}
              </label>
              <input
                v-model="form.password"
                type="password"
                class="form-control"
                :class="{ 'is-invalid': form_errors.password }"
                placeholder="Mínimo 8 caracteres"
              />
              <div v-if="form_errors.password" class="invalid-feedback">{{ form_errors.password }}</div>
            </div>

            <!-- Campo: Teléfono (formato E.164, ej: +5491112345678); necesario para notificar al closer por WhatsApp -->
            <div class="mb-3">
              <label class="form-label">Teléfono</label>
              <input
                v-model="form.phone_number"
                type="text"
                class="form-control"
                placeholder="+5491112345678"
              />
              <div class="form-text text-muted">
                En formato E.164 (ej: +5491112345678). Se usa para notificar al closer por WhatsApp cuando una demo se confirma.
              </div>
            </div>

            <!-- Campo: Es closer -->
            <div class="mb-3 form-check">
              <input
                v-model="form.is_closer"
                type="checkbox"
                class="form-check-input"
                id="is_closer_check"
              />
              <label class="form-check-label" for="is_closer_check">
                Es closer
              </label>
              <div class="form-text text-muted">
                Los closers pueden conectar su Google Calendar para bloquear disponibilidad de demos.
              </div>
            </div>

            <!-- Campo: Notificar escalaciones por WhatsApp -->
            <div class="mb-3 form-check">
              <input
                v-model="form.notify_lead_escalation_whatsapp"
                type="checkbox"
                class="form-check-input"
                id="notify_escalation_check"
              />
              <label class="form-check-label" for="notify_escalation_check">
                Notificar escalaciones por WhatsApp
              </label>
              <div class="form-text text-muted">
                Recibir un WhatsApp cuando el agente no puede resolver una conversación y escala al equipo humano.
              </div>
            </div>

            <!-- Campo: Notificar demos agendadas por WhatsApp -->
            <div class="mb-3 form-check">
              <input
                v-model="form.notify_demo_scheduled_whatsapp"
                type="checkbox"
                class="form-check-input"
                id="notify_demo_check"
              />
              <label class="form-check-label" for="notify_demo_check">
                Notificar demos agendadas por WhatsApp
              </label>
              <div class="form-text text-muted">
                Recibir un WhatsApp cuando un lead confirma y agenda una demo.
              </div>
            </div>

            <!-- Panel de Google Calendar: solo al editar un admin con is_closer = true -->
            <div v-if="editing_admin && form.is_closer" class="mt-4">
              <hr />
              <calendar-connection-panel :admin="editing_admin" />
            </div>

            <!-- Error genérico del formulario -->
            <p v-if="save_error" class="text-danger small mt-2 mb-0">{{ save_error }}</p>

          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="close_modal">Cancelar</button>
            <button
              type="button"
              class="btn btn-primary"
              :disabled="saving"
              @click="on_save"
            >
              <span v-if="saving" class="spinner-border spinner-border-sm me-1" />
              {{ saving ? 'Guardando…' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script>
import api from '@/utils/axios'
import CalendarConnectionPanel from '@/components/admin/CalendarConnectionPanel.vue'

/**
 * Vista principal de gestión de usuarios admin (equipo interno de ComercioCity).
 *
 * Permite crear, editar y eliminar usuarios. Si el admin editado tiene is_closer = true,
 * muestra el panel de conexión de Google Calendar para que configure su disponibilidad.
 */
export default {
  name: 'ViewAdminUsers',

  components: { CalendarConnectionPanel },

  data() {
    return {
      /** Indica si se está cargando la lista de admins. */
      loading: false,
      /** Lista de admins cargados desde la API. */
      admins: [],
      /** Controla la visibilidad del modal de crear/editar. */
      show_modal: false,
      /** Admin que se está editando. Null indica modo creación. */
      editing_admin: null,
      /** Datos del formulario del modal. */
      form: {
        name: '',
        email: '',
        password: '',
        is_closer: false,
        /* Teléfono en formato E.164; requerido para notificar al closer por WhatsApp. */
        phone_number: '',
        /* Flag para recibir WhatsApp cuando el agente escala una conversación de lead. */
        notify_lead_escalation_whatsapp: false,
        /* Flag para recibir WhatsApp cuando se agenda una demo. */
        notify_demo_scheduled_whatsapp: false,
      },
      /** Errores de validación por campo. */
      form_errors: {},
      /** Error genérico del guardado (red, servidor). */
      save_error: '',
      /** Indica si se está guardando el formulario. */
      saving: false,
    }
  },

  created() {
    // Cargar la lista de admins al montar la vista.
    this.load_admins()

    // Si el usuario vuelve del callback de Google OAuth, verificar el resultado.
    this.handle_calendar_callback()
  },

  methods: {
    /**
     * Carga todos los admins desde la API.
     */
    load_admins() {
      var self = this
      self.loading = true

      api.get('/admin-user')
        .then(function (res) {
          self.admins = res.data.models || []
        })
        .catch(function () {
          // Error silencioso; la tabla queda vacía.
        })
        .then(function () {
          self.loading = false
        })
    },

    /**
     * Abre el modal en modo creación.
     */
    open_create_modal() {
      this.editing_admin = null
      /* Resetear form completo incluyendo phone_number y flags de notificación. */
      this.form = {
        name: '',
        email: '',
        password: '',
        is_closer: false,
        phone_number: '',
        notify_lead_escalation_whatsapp: false,
        notify_demo_scheduled_whatsapp: false,
      }
      this.form_errors = {}
      this.save_error = ''
      this.show_modal = true
    },

    /**
     * Abre el modal en modo edición con los datos del admin recibido.
     *
     * @param {Object} admin  Admin a editar.
     */
    open_edit_modal(admin) {
      this.editing_admin = admin
      this.form = {
        name:         admin.name,
        email:        admin.email,
        password:     '',
        is_closer:    !!admin.is_closer,
        /* Cargar teléfono existente para que el setter pueda editarlo. */
        phone_number: admin.phone_number || '',
        /* Cargar flags de notificación WhatsApp existentes. */
        notify_lead_escalation_whatsapp: !!admin.notify_lead_escalation_whatsapp,
        notify_demo_scheduled_whatsapp:  !!admin.notify_demo_scheduled_whatsapp,
      }
      this.form_errors = {}
      this.save_error = ''
      this.show_modal = true
    },

    /**
     * Cierra el modal y limpia el estado.
     */
    close_modal() {
      this.show_modal = false
      this.editing_admin = null
      this.saving = false
      this.form_errors = {}
      this.save_error = ''
    },

    /**
     * Guarda el admin (crear o actualizar) según el estado de editing_admin.
     */
    on_save() {
      var self = this
      self.saving = true
      self.form_errors = {}
      self.save_error = ''

      // Construir payload; solo incluir password si no está vacío.
      var payload = {
        name:         self.form.name,
        is_closer:    self.form.is_closer,
        /* Teléfono del admin; se envía siempre (puede estar vacío para borrarlo). */
        phone_number: self.form.phone_number,
        /* Flags de notificación WhatsApp; se envían siempre para permitir desactivarlos. */
        notify_lead_escalation_whatsapp: self.form.notify_lead_escalation_whatsapp,
        notify_demo_scheduled_whatsapp:  self.form.notify_demo_scheduled_whatsapp,
      }
      if (self.form.password) {
        payload.password = self.form.password
      }

      // Crear o actualizar según el modo del modal.
      var request
      if (self.editing_admin) {
        request = api.put('/admin-user/' + self.editing_admin.id, payload)
      } else {
        // Al crear, email y password son obligatorios.
        payload.email    = self.form.email
        payload.password = self.form.password
        request = api.post('/admin-user', payload)
      }

      request
        .then(function (res) {
          var saved_admin = res.data.model
          if (self.editing_admin) {
            // Actualizar el admin en la lista local.
            var idx = self.admins.findIndex(function (a) { return a.id === saved_admin.id })
            if (idx !== -1) {
              self.admins.splice(idx, 1, saved_admin)
            }
          } else {
            // Agregar el nuevo admin al inicio de la lista.
            self.admins.unshift(saved_admin)
          }
          self.close_modal()
        })
        .catch(function (err) {
          // Mostrar errores de validación por campo si los devuelve Laravel.
          var data = err.response && err.response.data
          if (data && data.errors) {
            var errors = {}
            Object.keys(data.errors).forEach(function (key) {
              errors[key] = data.errors[key][0]
            })
            self.form_errors = errors
          } else {
            self.save_error = (data && data.message) || 'No se pudo guardar el usuario.'
          }
          self.saving = false
        })
    },

    /**
     * Confirma y elimina un admin.
     * Protege contra la auto-eliminación del usuario autenticado.
     *
     * @param {Object} admin  Admin a eliminar.
     */
    on_delete(admin) {
      if (!window.confirm('¿Eliminar al usuario "' + admin.name + '"? Esta acción no se puede deshacer.')) {
        return
      }
      var self = this

      api.delete('/admin-user/' + admin.id)
        .then(function () {
          // Remover de la lista local.
          self.admins = self.admins.filter(function (a) { return a.id !== admin.id })
        })
        .catch(function (err) {
          var msg = err.response && err.response.data && err.response.data.message
          alert(msg || 'No se pudo eliminar el usuario.')
        })
    },

    /**
     * Verifica si el usuario acaba de volver del callback de Google OAuth.
     * Lee los query params calendar_connected y admin_id de la URL.
     * Si es éxito, intenta re-abrir el modal del admin que inició el flujo.
     */
    handle_calendar_callback() {
      var params = new URLSearchParams(window.location.search)

      if (!params.has('calendar_connected')) {
        return
      }

      var connected = params.get('calendar_connected') === 'true'
      var admin_id  = parseInt(params.get('admin_id') || '0', 10)

      // Limpiar los query params de la URL sin recargar.
      window.history.replaceState({}, '', window.location.pathname)

      if (connected) {
        // Si tenemos el admin_id, esperar que carguen los admins y re-abrir el modal.
        if (admin_id) {
          var self = this
          var check_and_open = function () {
            var admin = self.admins.find(function (a) { return a.id === admin_id })
            if (admin) {
              self.open_edit_modal(admin)
            }
          }
          // Si los admins ya cargaron, abrir inmediatamente; si no, esperar la carga.
          if (this.admins.length) {
            check_and_open()
          } else {
            var unwatch = this.$watch('admins', function (new_val) {
              if (new_val.length) {
                check_and_open()
                unwatch()
              }
            })
          }
        }
      } else {
        var error_code = params.get('error') || ''
        alert('No se pudo conectar Google Calendar. ' + (error_code ? '(' + error_code + ')' : ''))
      }
    },
  },
}
</script>

<style scoped>
/* Altura mínima para llenar el viewport disponible. */
.admin-users-view {
  min-height: 100%;
}
</style>
