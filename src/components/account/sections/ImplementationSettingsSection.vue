<template>
  <div class="implementation-settings-section">
    <p class="text-muted small mb-3">
      El admin seleccionado se asigna automáticamente a cada nueva implementación que se inicie,
      y es quien figura como responsable en los mensajes de WhatsApp enviados al cliente.
    </p>

    <!-- Estado: cargando datos iniciales -->
    <p v-if="loading" class="text-muted small mb-0">Cargando…</p>

    <!-- Formulario: visible una vez cargado -->
    <template v-else>
      <div class="row g-2 align-items-end">
        <div class="col-sm-6">
          <label class="form-label small" for="impl_assigned_admin">Admin asignado por defecto</label>
          <!-- Select de admins disponibles; se precarga la opción actualmente configurada -->
          <select
            id="impl_assigned_admin"
            v-model="local_admin_id"
            class="form-select form-select-sm"
            :disabled="loading_admins || saving"
          >
            <option :value="null">— Sin asignar —</option>
            <option
              v-for="admin in admins"
              :key="admin.id"
              :value="admin.id"
            >
              {{ admin.name }}
            </option>
          </select>
        </div>

        <div class="col-auto">
          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="loading_admins || saving || !can_save"
            @click="on_save"
          >
            {{ saving ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </div>

      <!-- Mensajes de estado -->
      <p v-if="saved_message" class="text-success small mt-2 mb-0">{{ saved_message }}</p>
      <p v-else-if="error_message" class="text-danger small mt-2 mb-0">{{ error_message }}</p>
    </template>
  </div>
</template>

<script>
import api from '@/utils/axios'

/**
 * Sección en Cuenta: admin asignado por defecto a nuevas implementaciones.
 *
 * Carga la lista de admins desde GET /admin y el setting actual desde
 * GET /settings/implementation-assigned-admin. Al guardar hace PUT al mismo endpoint.
 */
export default {
  name: 'ImplementationSettingsSection',

  data() {
    return {
      /**
       * ID del admin seleccionado en el select (valor local editable).
       * null = sin asignar.
       */
      local_admin_id: null,

      /**
       * Valor guardado en el servidor para detectar cambios sin guardar.
       */
      stored_admin_id: null,

      /**
       * Lista de admins disponibles para el select.
       */
      admins: [],

      /**
       * Indicador de carga del setting actual (GET /settings/...).
       */
      loading: true,

      /**
       * Indicador de carga del listado de admins (GET /admin).
       */
      loading_admins: true,

      /**
       * Indica que hay un PUT en curso.
       */
      saving: false,

      /**
       * Mensaje de éxito tras guardar.
       */
      saved_message: '',

      /**
       * Mensaje de error de validación o API.
       */
      error_message: '',
    }
  },

  computed: {
    /**
     * Habilita el botón Guardar solo si el valor local difiere del guardado.
     *
     * @returns {boolean}
     */
    can_save() {
      return this.local_admin_id !== this.stored_admin_id
    },
  },

  mounted() {
    /* Cargar lista de admins y setting actual en paralelo al montar. */
    this.load_admins()
    this.load_setting()
  },

  methods: {
    /**
     * Carga la lista de admins desde GET /admin para poblar el select.
     *
     * @returns {void}
     */
    load_admins() {
      const self = this
      self.loading_admins = true

      api
        .get('/admin')
        .then(function (res) {
          /* La API retorna { admins: [...] } o { models: [...] } según el controller. */
          self.admins = res.data.admins || res.data.models || []
        })
        .catch(function () {
          self.admins = []
        })
        .then(function () {
          self.loading_admins = false
        })
    },

    /**
     * Carga el setting actual del admin asignado desde GET /settings/implementation-assigned-admin.
     *
     * @returns {void}
     */
    load_setting() {
      const self = this
      self.loading = true
      self.error_message = ''

      api
        .get('/settings/implementation-assigned-admin')
        .then(function (res) {
          /** ID del admin actualmente configurado; puede ser null si no hay uno asignado. */
          const admin_id = res.data && res.data.admin_id != null ? res.data.admin_id : null
          self.local_admin_id  = admin_id
          self.stored_admin_id = admin_id
        })
        .catch(function () {
          self.error_message = 'No se pudo cargar la configuración.'
        })
        .then(function () {
          self.loading = false
        })
    },

    /**
     * Guarda el admin seleccionado via PUT /settings/implementation-assigned-admin.
     *
     * @returns {void}
     */
    on_save() {
      const self = this

      if (self.local_admin_id == null) {
        self.error_message = 'Seleccioná un admin antes de guardar.'
        return
      }

      self.saving        = true
      self.saved_message = ''
      self.error_message = ''

      api
        .put('/settings/implementation-assigned-admin', { admin_id: self.local_admin_id })
        .then(function (res) {
          /** ID confirmado por el servidor tras persistir. */
          const saved_id = res.data && res.data.admin_id != null ? res.data.admin_id : self.local_admin_id
          self.local_admin_id  = saved_id
          self.stored_admin_id = saved_id
          self.saved_message   = 'Configuración guardada.'
        })
        .catch(function (err) {
          const msg =
            (err.response && err.response.data && err.response.data.message) ||
            'No se pudo guardar.'
          self.error_message = msg
        })
        .then(function () {
          self.saving = false
        })
    },
  },
}
</script>
