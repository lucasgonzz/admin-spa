<template>
  <div class="implementation-settings-section">
    <p class="text-muted small mb-3">
      El admin seleccionado se asigna automáticamente a cada nueva implementación que se inicie,
      y es quien figura como responsable en los mensajes de WhatsApp enviados al cliente.
    </p>

    <!-- Estado: cargando datos iniciales -->
    <p v-if="loading || loading_file_wait" class="text-muted small mb-0">Cargando…</p>

    <!-- Formulario: visible una vez cargado -->
    <template v-else>
      <!-- Campo: admin asignado por defecto -->
      <div class="row g-2 align-items-end mb-3">
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

      <!-- Campo: segundos de espera antes de procesar archivos recibidos (Etapa 4) -->
      <div class="row g-2 align-items-end">
        <div class="col-sm-6">
          <label class="form-label small" for="impl_file_wait_seconds">
            Segundos de espera antes de procesar archivos recibidos
          </label>
          <!-- Input numérico; al expirar el timer sin nuevos archivos, se procesa lo acumulado -->
          <input
            id="impl_file_wait_seconds"
            v-model.number="local_file_wait_seconds"
            type="number"
            class="form-control form-control-sm"
            min="1"
            max="120"
            :disabled="saving_file_wait"
          />
        </div>

        <div class="col-auto">
          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="saving_file_wait || !can_save_file_wait"
            @click="on_save_file_wait"
          >
            {{ saving_file_wait ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </div>

      <!-- Mensajes de estado para el campo de espera -->
      <p v-if="saved_file_wait_message" class="text-success small mt-2 mb-0">{{ saved_file_wait_message }}</p>
      <p v-else-if="error_file_wait_message" class="text-danger small mt-2 mb-0">{{ error_file_wait_message }}</p>

      <!-- Mensajes de estado para el selector de admin -->
      <p v-if="saved_message" class="text-success small mt-2 mb-0">{{ saved_message }}</p>
      <p v-else-if="error_message" class="text-danger small mt-2 mb-0">{{ error_message }}</p>
    </template>
  </div>
</template>

<script>
import api from '@/utils/axios'

/**
 * Sección en Cuenta: configuración global del flujo de implementaciones.
 *
 * Gestiona dos settings independientes:
 * - Admin asignado por defecto: GET/PUT /settings/implementation-assigned-admin
 * - Segundos de espera antes de procesar archivos (Etapa 4): GET/PUT /settings/implementation-file-wait
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
       * Valor guardado en el servidor para detectar cambios sin guardar (admin asignado).
       */
      stored_admin_id: null,

      /**
       * Lista de admins disponibles para el select.
       */
      admins: [],

      /**
       * Indicador de carga del setting de admin asignado (GET /settings/...).
       */
      loading: true,

      /**
       * Indicador de carga del listado de admins (GET /admin).
       */
      loading_admins: true,

      /**
       * Indica que hay un PUT del admin asignado en curso.
       */
      saving: false,

      /**
       * Mensaje de éxito tras guardar el admin asignado.
       */
      saved_message: '',

      /**
       * Mensaje de error para el campo de admin asignado.
       */
      error_message: '',

      /**
       * Segundos de espera configurados localmente (valor editable por el admin).
       * Rango: 1–120. Valor inicial del servidor poblado en load_file_wait_setting().
       */
      local_file_wait_seconds: 15,

      /**
       * Valor guardado en el servidor para detectar cambios sin guardar (espera de archivos).
       */
      stored_file_wait_seconds: 15,

      /**
       * Indicador de carga del setting de espera de archivos.
       */
      loading_file_wait: true,

      /**
       * Indica que hay un PUT del setting de espera en curso.
       */
      saving_file_wait: false,

      /**
       * Mensaje de éxito tras guardar los segundos de espera.
       */
      saved_file_wait_message: '',

      /**
       * Mensaje de error para el campo de segundos de espera.
       */
      error_file_wait_message: '',
    }
  },

  computed: {
    /**
     * Habilita el botón Guardar del admin asignado solo si el valor local difiere del guardado.
     *
     * @returns {boolean}
     */
    can_save() {
      return this.local_admin_id !== this.stored_admin_id
    },

    /**
     * Habilita el botón Guardar de los segundos de espera solo si el valor cambió.
     *
     * @returns {boolean}
     */
    can_save_file_wait() {
      return this.local_file_wait_seconds !== this.stored_file_wait_seconds
    },
  },

  mounted() {
    /* Cargar lista de admins, setting de admin y setting de espera en paralelo al montar. */
    this.load_admins()
    this.load_setting()
    this.load_file_wait_setting()
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
     * Carga el setting de segundos de espera desde GET /settings/implementation-file-wait.
     *
     * @returns {void}
     */
    load_file_wait_setting() {
      const self = this
      self.loading_file_wait = true
      self.error_file_wait_message = ''

      api
        .get('/settings/implementation-file-wait')
        .then(function (res) {
          /** Valor de segundos retornado por el servidor; fallback a 15. */
          const seconds = res.data && res.data.seconds != null ? res.data.seconds : 15
          self.local_file_wait_seconds  = seconds
          self.stored_file_wait_seconds = seconds
        })
        .catch(function () {
          self.error_file_wait_message = 'No se pudo cargar la configuración de espera.'
        })
        .then(function () {
          self.loading_file_wait = false
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

    /**
     * Guarda los segundos de espera via PUT /settings/implementation-file-wait.
     *
     * Valida localmente que el valor esté entre 1 y 120 antes de enviar la solicitud.
     *
     * @returns {void}
     */
    on_save_file_wait() {
      const self = this

      /** Validación local del rango permitido. */
      const seconds = parseInt(self.local_file_wait_seconds, 10)

      if (isNaN(seconds) || seconds < 1 || seconds > 120) {
        self.error_file_wait_message = 'El valor debe estar entre 1 y 120 segundos.'
        return
      }

      self.saving_file_wait        = true
      self.saved_file_wait_message = ''
      self.error_file_wait_message = ''

      api
        .put('/settings/implementation-file-wait', { seconds: seconds })
        .then(function (res) {
          /** Valor confirmado por el servidor. */
          const saved_seconds = res.data && res.data.seconds != null ? res.data.seconds : seconds
          self.local_file_wait_seconds  = saved_seconds
          self.stored_file_wait_seconds = saved_seconds
          self.saved_file_wait_message  = 'Configuración guardada.'
        })
        .catch(function (err) {
          const msg =
            (err.response && err.response.data && err.response.data.message) ||
            'No se pudo guardar.'
          self.error_file_wait_message = msg
        })
        .then(function () {
          self.saving_file_wait = false
        })
    },
  },
}
</script>
