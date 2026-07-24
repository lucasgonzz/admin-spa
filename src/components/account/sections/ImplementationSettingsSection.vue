<template>
  <div class="implementation-settings-section">
    <p class="text-muted small mb-3">
      El admin seleccionado se asigna automáticamente a cada nueva implementación que se inicie,
      y es quien figura como responsable en los mensajes de WhatsApp enviados al cliente.
    </p>

    <!-- Estado: cargando datos iniciales -->
    <p v-if="loading || loading_file_wait || loading_employees_wait" class="text-muted small mb-0">Cargando…</p>

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
      <div class="row g-2 align-items-end mb-3">
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

      <!-- Mensajes de estado para el campo de espera de archivos -->
      <p v-if="saved_file_wait_message" class="text-success small mt-2 mb-0">{{ saved_file_wait_message }}</p>
      <p v-else-if="error_file_wait_message" class="text-danger small mt-2 mb-0">{{ error_file_wait_message }}</p>

      <!-- Campo: segundos de espera antes de confirmar lista de empleados (Etapa 1) -->
      <div class="row g-2 align-items-end">
        <div class="col-sm-6">
          <label class="form-label small" for="impl_employees_wait_seconds">
            Segundos de espera antes de confirmar lista de empleados
          </label>
          <!-- Input numérico; al expirar el timer sin nuevos mensajes, se pregunta si terminó la carga -->
          <input
            id="impl_employees_wait_seconds"
            v-model.number="local_employees_wait_seconds"
            type="number"
            class="form-control form-control-sm"
            min="1"
            max="120"
            :disabled="saving_employees_wait"
          />
        </div>

        <div class="col-auto">
          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="saving_employees_wait || !can_save_employees_wait"
            @click="on_save_employees_wait"
          >
            {{ saving_employees_wait ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </div>

      <!-- Mensajes de estado para el campo de espera de empleados -->
      <p v-if="saved_employees_wait_message" class="text-success small mt-2 mb-0">{{ saved_employees_wait_message }}</p>
      <p v-else-if="error_employees_wait_message" class="text-danger small mt-2 mb-0">{{ error_employees_wait_message }}</p>

      <!-- Mensajes de estado para el selector de admin -->
      <p v-if="saved_message" class="text-success small mt-2 mb-0">{{ saved_message }}</p>
      <p v-else-if="error_message" class="text-danger small mt-2 mb-0">{{ error_message }}</p>

      <!-- Campo: URL base del formulario de configuración del cliente -->
      <div class="row g-2 align-items-end mt-3 mb-3">
        <div class="col-sm-8">
          <label class="form-label small" for="impl_form_url">
            URL base del formulario (se agrega /{token} al final)
          </label>
          <!-- Input de texto con la URL base del formulario público del cliente -->
          <input
            id="impl_form_url"
            v-model="local_form_url"
            type="text"
            class="form-control form-control-sm"
            placeholder="https://app.comerciocity.com/configuracion"
            :disabled="loading_form_url || saving_form_url"
          />
        </div>

        <div class="col-auto">
          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="loading_form_url || saving_form_url || !can_save_form_url"
            @click="on_save_form_url"
          >
            {{ saving_form_url ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </div>

      <!-- Mensajes de estado para la URL del formulario -->
      <p v-if="saved_form_url_message" class="text-success small mt-2 mb-3">{{ saved_form_url_message }}</p>
      <p v-else-if="error_form_url_message" class="text-danger small mt-2 mb-3">{{ error_form_url_message }}</p>

      <!-- Campo: minutos de delay entre envío del formulario y primer contacto de WhatsApp -->
      <div class="row g-2 align-items-end mb-3">
        <div class="col-sm-6">
          <label class="form-label small" for="impl_form_contact_delay">
            Minutos entre el envío del formulario y el primer mensaje de WhatsApp de Martín
          </label>
          <!-- Input numérico en minutos; se convierte a segundos al enviar -->
          <input
            id="impl_form_contact_delay"
            v-model.number="local_form_contact_delay_minutes"
            type="number"
            class="form-control form-control-sm"
            min="0"
            :disabled="loading_form_contact_delay || saving_form_contact_delay"
          />
        </div>

        <div class="col-auto">
          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="loading_form_contact_delay || saving_form_contact_delay || !can_save_form_contact_delay"
            @click="on_save_form_contact_delay"
          >
            {{ saving_form_contact_delay ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </div>

      <!-- Mensajes de estado para el delay de contacto -->
      <p v-if="saved_form_contact_delay_message" class="text-success small mt-2 mb-0">{{ saved_form_contact_delay_message }}</p>
      <p v-else-if="error_form_contact_delay_message" class="text-danger small mt-2 mb-0">{{ error_form_contact_delay_message }}</p>

      <!-- Google (búsqueda de imágenes): API key y cuota, para clientes reales y para demos -->
      <h6 class="mt-3 mb-2">Google (búsqueda de imágenes)</h6>

      <!-- Campo: API key de Google para clientes nuevos (reales) -->
      <div class="row g-2 align-items-end mb-1">
        <div class="col-sm-8">
          <label class="form-label small" for="impl_google_api_key_default">
            API key de Google para clientes nuevos (users.google_custom_search_api_key)
          </label>
          <!-- Input de texto (no password): panel interno, Lucas necesita ver la key cargada -->
          <input
            id="impl_google_api_key_default"
            v-model="local_google_api_key_default"
            type="text"
            class="form-control form-control-sm"
            :disabled="loading_google_api_key_default || saving_google_api_key_default"
          />
          <small class="text-muted d-block">
            Si queda vacío se usa la key que empresa-api tiene hardcodeada como respaldo. El valor se aplica solo a los setups nuevos: los clientes ya creados conservan la key que recibieron.
          </small>
        </div>

        <div class="col-auto">
          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="loading_google_api_key_default || saving_google_api_key_default || !can_save_google_api_key_default"
            @click="on_save_google_api_key_default"
          >
            {{ saving_google_api_key_default ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </div>

      <!-- Mensajes de estado para la API key de clientes -->
      <p v-if="saved_google_api_key_default_message" class="text-success small mt-2 mb-0">{{ saved_google_api_key_default_message }}</p>
      <p v-else-if="error_google_api_key_default_message" class="text-danger small mt-2 mb-0">{{ error_google_api_key_default_message }}</p>

      <!-- Campo: cuota de Google por defecto para nuevos usuarios reales -->
      <div class="row g-2 align-items-end mt-3 mb-3">
        <div class="col-sm-6">
          <label class="form-label small" for="impl_google_cuota_default">
            Búsquedas de Google por día por defecto para nuevos usuarios (users.google_cuota)
          </label>
          <!-- Input numérico; se aplica al crear el User real en el user-setup -->
          <input
            id="impl_google_cuota_default"
            v-model.number="local_google_cuota_default"
            type="number"
            class="form-control form-control-sm"
            min="0"
            :disabled="loading_google_cuota_default || saving_google_cuota_default"
          />
        </div>

        <div class="col-auto">
          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="loading_google_cuota_default || saving_google_cuota_default || !can_save_google_cuota_default"
            @click="on_save_google_cuota_default"
          >
            {{ saving_google_cuota_default ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </div>

      <!-- Mensajes de estado para la cuota de Google (clientes) -->
      <p v-if="saved_google_cuota_default_message" class="text-success small mt-2 mb-0">{{ saved_google_cuota_default_message }}</p>
      <p v-else-if="error_google_cuota_default_message" class="text-danger small mt-2 mb-0">{{ error_google_cuota_default_message }}</p>

      <!-- Nota: por qué API key y cuota de demos están separadas de las de clientes reales -->
      <small class="text-muted d-block mt-2">
        La cuota diaria de búsquedas de Google es por API key: si demos y clientes comparten la misma key, las demos se comen la cuota de los clientes que pagan. Por eso hay una key y una cuota independientes para las demos.
      </small>

      <!-- Campo: API key de Google para demos -->
      <div class="row g-2 align-items-end mt-3 mb-1">
        <div class="col-sm-8">
          <label class="form-label small" for="impl_google_api_key_demo">
            API key de Google para demos
          </label>
          <!-- Input de texto (no password): panel interno, Lucas necesita ver la key cargada -->
          <input
            id="impl_google_api_key_demo"
            v-model="local_google_api_key_demo"
            type="text"
            class="form-control form-control-sm"
            :disabled="loading_google_api_key_demo || saving_google_api_key_demo"
          />
          <small class="text-muted d-block">
            Si queda vacío se usa la key que empresa-api tiene hardcodeada como respaldo. El valor se aplica solo a los setups nuevos: los clientes ya creados conservan la key que recibieron.
          </small>
        </div>

        <div class="col-auto">
          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="loading_google_api_key_demo || saving_google_api_key_demo || !can_save_google_api_key_demo"
            @click="on_save_google_api_key_demo"
          >
            {{ saving_google_api_key_demo ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </div>

      <!-- Mensajes de estado para la API key de demos -->
      <p v-if="saved_google_api_key_demo_message" class="text-success small mt-2 mb-0">{{ saved_google_api_key_demo_message }}</p>
      <p v-else-if="error_google_api_key_demo_message" class="text-danger small mt-2 mb-0">{{ error_google_api_key_demo_message }}</p>

      <!-- Campo: cuota de Google por día para demos -->
      <div class="row g-2 align-items-end mt-3 mb-3">
        <div class="col-sm-6">
          <label class="form-label small" for="impl_google_cuota_demo">
            Búsquedas de Google por día para demos (users.google_cuota)
          </label>
          <!-- Input numérico; se aplica al crear el User de demo -->
          <input
            id="impl_google_cuota_demo"
            v-model.number="local_google_cuota_demo"
            type="number"
            class="form-control form-control-sm"
            min="0"
            :disabled="loading_google_cuota_demo || saving_google_cuota_demo"
          />
        </div>

        <div class="col-auto">
          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="loading_google_cuota_demo || saving_google_cuota_demo || !can_save_google_cuota_demo"
            @click="on_save_google_cuota_demo"
          >
            {{ saving_google_cuota_demo ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </div>

      <!-- Mensajes de estado para la cuota de Google (demos) -->
      <p v-if="saved_google_cuota_demo_message" class="text-success small mt-2 mb-0">{{ saved_google_cuota_demo_message }}</p>
      <p v-else-if="error_google_cuota_demo_message" class="text-danger small mt-2 mb-0">{{ error_google_cuota_demo_message }}</p>
    </template>
  </div>
</template>

<script>
import api from '@/utils/axios'

/**
 * Sección en Cuenta: configuración global del flujo de implementaciones.
 *
 * Gestiona tres settings independientes:
 * - Admin asignado por defecto: GET/PUT /settings/implementation-assigned-admin
 * - Segundos de espera antes de procesar archivos (Etapa 4): GET/PUT /settings/implementation-file-wait
 * - Segundos de espera antes de confirmar lista de empleados (Etapa 1): GET/PUT /settings/implementation-employees-wait
 * - Cuota de Google por defecto (clientes reales): GET/PUT /settings/implementation-google-cuota-default
 * - API key de Google para clientes nuevos: GET/PUT /settings/implementation-google-api-key-default
 * - API key de Google para demos: GET/PUT /settings/implementation-google-api-key-demo
 * - Cuota de Google por día para demos: GET/PUT /settings/implementation-google-cuota-demo
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

      /**
       * Segundos de espera configurados localmente antes de confirmar lista de empleados (Etapa 1).
       * Rango: 1–120. Valor inicial del servidor poblado en load_employees_wait_setting().
       */
      local_employees_wait_seconds: 30,

      /**
       * Valor guardado en el servidor para detectar cambios sin guardar (espera de empleados).
       */
      stored_employees_wait_seconds: 30,

      /**
       * Indicador de carga del setting de espera de empleados.
       */
      loading_employees_wait: true,

      /**
       * Indica que hay un PUT del setting de espera de empleados en curso.
       */
      saving_employees_wait: false,

      /**
       * Mensaje de éxito tras guardar los segundos de espera de empleados.
       */
      saved_employees_wait_message: '',

      /**
       * Mensaje de error para el campo de segundos de espera de empleados.
       */
      error_employees_wait_message: '',

      /**
       * URL base del formulario de configuración del cliente (valor local editable).
       * Se agrega /{token} al final para construir el link de cada cliente.
       */
      local_form_url: '',

      /**
       * URL guardada en el servidor para detectar cambios sin guardar.
       */
      stored_form_url: '',

      /**
       * Indicador de carga del setting de URL del formulario.
       */
      loading_form_url: true,

      /**
       * Indica que hay un PUT del setting de URL en curso.
       */
      saving_form_url: false,

      /**
       * Mensaje de éxito tras guardar la URL del formulario.
       */
      saved_form_url_message: '',

      /**
       * Mensaje de error para el campo de URL del formulario.
       */
      error_form_url_message: '',

      /**
       * Minutos de delay entre el envío del formulario y el primer contacto de WhatsApp (valor local editable).
       * Se convierte a segundos al persistir en la API.
       */
      local_form_contact_delay_minutes: 0,

      /**
       * Valor guardado en el servidor (en minutos) para detectar cambios sin guardar.
       */
      stored_form_contact_delay_minutes: 0,

      /**
       * Indicador de carga del setting de delay de contacto.
       */
      loading_form_contact_delay: true,

      /**
       * Indica que hay un PUT del setting de delay en curso.
       */
      saving_form_contact_delay: false,

      /**
       * Mensaje de éxito tras guardar el delay de contacto.
       */
      saved_form_contact_delay_message: '',

      /**
       * Mensaje de error para el campo de delay de contacto.
       */
      error_form_contact_delay_message: '',

      /**
       * Cuota de Google configurada localmente para nuevos usuarios reales (valor editable).
       * Se aplica a users.google_cuota al ejecutar el user-setup real en empresa-api.
       */
      local_google_cuota_default: 100,

      /**
       * Valor guardado en el servidor para detectar cambios sin guardar (cuota de Google).
       */
      stored_google_cuota_default: 100,

      /**
       * Indicador de carga del setting de cuota de Google.
       */
      loading_google_cuota_default: true,

      /**
       * Indica que hay un PUT de la cuota de Google en curso.
       */
      saving_google_cuota_default: false,

      /**
       * Mensaje de éxito tras guardar la cuota de Google.
       */
      saved_google_cuota_default_message: '',

      /**
       * Mensaje de error para el campo de cuota de Google.
       */
      error_google_cuota_default_message: '',

      /**
       * API key de Google configurada localmente para nuevos usuarios reales (valor editable).
       * Si queda vacía, empresa-api usa una key hardcodeada de respaldo. Se aplica solo a setups nuevos.
       */
      local_google_api_key_default: '',

      /**
       * Valor guardado en el servidor para detectar cambios sin guardar (API key de clientes).
       */
      stored_google_api_key_default: '',

      /**
       * Indicador de carga del setting de API key de clientes.
       */
      loading_google_api_key_default: true,

      /**
       * Indica que hay un PUT de la API key de clientes en curso.
       */
      saving_google_api_key_default: false,

      /**
       * Mensaje de éxito tras guardar la API key de clientes.
       */
      saved_google_api_key_default_message: '',

      /**
       * Mensaje de error para el campo de API key de clientes (incluye el error de formato local).
       */
      error_google_api_key_default_message: '',

      /**
       * API key de Google configurada localmente para las demos (valor editable).
       * Separada de la de clientes reales para que las demos no consuman la cuota de los que pagan.
       */
      local_google_api_key_demo: '',

      /**
       * Valor guardado en el servidor para detectar cambios sin guardar (API key de demos).
       */
      stored_google_api_key_demo: '',

      /**
       * Indicador de carga del setting de API key de demos.
       */
      loading_google_api_key_demo: true,

      /**
       * Indica que hay un PUT de la API key de demos en curso.
       */
      saving_google_api_key_demo: false,

      /**
       * Mensaje de éxito tras guardar la API key de demos.
       */
      saved_google_api_key_demo_message: '',

      /**
       * Mensaje de error para el campo de API key de demos (incluye el error de formato local).
       */
      error_google_api_key_demo_message: '',

      /**
       * Cuota de Google configurada localmente para nuevos usuarios de demo (valor editable).
       * Hoy hardcodeada en 100 en empresa-api; con esto queda configurable.
       */
      local_google_cuota_demo: 100,

      /**
       * Valor guardado en el servidor para detectar cambios sin guardar (cuota de demos).
       */
      stored_google_cuota_demo: 100,

      /**
       * Indicador de carga del setting de cuota de demos.
       */
      loading_google_cuota_demo: true,

      /**
       * Indica que hay un PUT de la cuota de demos en curso.
       */
      saving_google_cuota_demo: false,

      /**
       * Mensaje de éxito tras guardar la cuota de demos.
       */
      saved_google_cuota_demo_message: '',

      /**
       * Mensaje de error para el campo de cuota de demos.
       */
      error_google_cuota_demo_message: '',
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

    /**
     * Habilita el botón Guardar de los segundos de espera de empleados solo si el valor cambió.
     *
     * @returns {boolean}
     */
    can_save_employees_wait() {
      return this.local_employees_wait_seconds !== this.stored_employees_wait_seconds
    },

    /**
     * Habilita el botón Guardar de la URL del formulario solo si el valor cambió.
     *
     * @returns {boolean}
     */
    can_save_form_url() {
      return this.local_form_url !== this.stored_form_url
    },

    /**
     * Habilita el botón Guardar del delay de contacto solo si el valor cambió.
     *
     * @returns {boolean}
     */
    can_save_form_contact_delay() {
      return this.local_form_contact_delay_minutes !== this.stored_form_contact_delay_minutes
    },

    /**
     * Habilita el botón Guardar de la cuota de Google solo si el valor cambió.
     *
     * @returns {boolean}
     */
    can_save_google_cuota_default() {
      return this.local_google_cuota_default !== this.stored_google_cuota_default
    },

    /**
     * Habilita el botón Guardar de la API key de clientes solo si el valor cambió.
     *
     * @returns {boolean}
     */
    can_save_google_api_key_default() {
      return this.local_google_api_key_default !== this.stored_google_api_key_default
    },

    /**
     * Habilita el botón Guardar de la API key de demos solo si el valor cambió.
     *
     * @returns {boolean}
     */
    can_save_google_api_key_demo() {
      return this.local_google_api_key_demo !== this.stored_google_api_key_demo
    },

    /**
     * Habilita el botón Guardar de la cuota de demos solo si el valor cambió.
     *
     * @returns {boolean}
     */
    can_save_google_cuota_demo() {
      return this.local_google_cuota_demo !== this.stored_google_cuota_demo
    },
  },

  mounted() {
    /* Cargar todos los settings en paralelo al montar el componente. */
    this.load_admins()
    this.load_setting()
    this.load_file_wait_setting()
    this.load_employees_wait_setting()
    this.load_form_url_setting()
    this.load_form_contact_delay_setting()
    this.load_google_cuota_default_setting()
    this.load_google_api_key_default_setting()
    this.load_google_api_key_demo_setting()
    this.load_google_cuota_demo_setting()
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

    /**
     * Carga el setting de segundos de espera de empleados desde GET /settings/implementation-employees-wait.
     *
     * @returns {void}
     */
    load_employees_wait_setting() {
      const self = this
      self.loading_employees_wait = true
      self.error_employees_wait_message = ''

      api
        .get('/settings/implementation-employees-wait')
        .then(function (res) {
          /** Valor de segundos retornado por el servidor; fallback a 30. */
          const seconds = res.data && res.data.seconds != null ? res.data.seconds : 30
          self.local_employees_wait_seconds  = seconds
          self.stored_employees_wait_seconds = seconds
        })
        .catch(function () {
          self.error_employees_wait_message = 'No se pudo cargar la configuración de espera de empleados.'
        })
        .then(function () {
          self.loading_employees_wait = false
        })
    },

    /**
     * Guarda los segundos de espera de empleados via PUT /settings/implementation-employees-wait.
     *
     * Valida localmente que el valor esté entre 1 y 120 antes de enviar la solicitud.
     *
     * @returns {void}
     */
    on_save_employees_wait() {
      const self = this

      /** Validación local del rango permitido. */
      const seconds = parseInt(self.local_employees_wait_seconds, 10)

      if (isNaN(seconds) || seconds < 1 || seconds > 120) {
        self.error_employees_wait_message = 'El valor debe estar entre 1 y 120 segundos.'
        return
      }

      self.saving_employees_wait        = true
      self.saved_employees_wait_message = ''
      self.error_employees_wait_message = ''

      api
        .put('/settings/implementation-employees-wait', { seconds: seconds })
        .then(function (res) {
          /** Valor confirmado por el servidor. */
          const saved_seconds = res.data && res.data.seconds != null ? res.data.seconds : seconds
          self.local_employees_wait_seconds  = saved_seconds
          self.stored_employees_wait_seconds = saved_seconds
          self.saved_employees_wait_message  = 'Configuración guardada.'
        })
        .catch(function (err) {
          const msg =
            (err.response && err.response.data && err.response.data.message) ||
            'No se pudo guardar.'
          self.error_employees_wait_message = msg
        })
        .then(function () {
          self.saving_employees_wait = false
        })
    },

    /**
     * Carga la URL base del formulario desde GET /settings/implementation-form-url.
     *
     * @returns {void}
     */
    load_form_url_setting() {
      const self = this
      self.loading_form_url      = true
      self.error_form_url_message = ''

      api
        .get('/settings/implementation-form-url')
        .then(function (res) {
          /** URL retornada por el servidor; fallback a cadena vacía. */
          const url = res.data && res.data.url != null ? res.data.url : ''
          self.local_form_url  = url
          self.stored_form_url = url
        })
        .catch(function () {
          self.error_form_url_message = 'No se pudo cargar la URL del formulario.'
        })
        .then(function () {
          self.loading_form_url = false
        })
    },

    /**
     * Guarda la URL del formulario via PUT /settings/implementation-form-url.
     *
     * @returns {void}
     */
    on_save_form_url() {
      const self = this

      self.saving_form_url        = true
      self.saved_form_url_message = ''
      self.error_form_url_message = ''

      api
        .put('/settings/implementation-form-url', { url: self.local_form_url })
        .then(function (res) {
          /** URL confirmada por el servidor. */
          const saved_url = res.data && res.data.url != null ? res.data.url : self.local_form_url
          self.local_form_url  = saved_url
          self.stored_form_url = saved_url
          self.saved_form_url_message = 'Configuración guardada.'
        })
        .catch(function (err) {
          const msg =
            (err.response && err.response.data && err.response.data.message) ||
            'No se pudo guardar.'
          self.error_form_url_message = msg
        })
        .then(function () {
          self.saving_form_url = false
        })
    },

    /**
     * Carga el delay de contacto post-formulario desde GET /settings/implementation-form-contact-delay.
     * El servidor almacena el valor en segundos; se convierte a minutos para la UI.
     *
     * @returns {void}
     */
    load_form_contact_delay_setting() {
      const self = this
      self.loading_form_contact_delay      = true
      self.error_form_contact_delay_message = ''

      api
        .get('/settings/implementation-form-contact-delay')
        .then(function (res) {
          /** Segundos retornados por el servidor; convertir a minutos para el input. */
          const seconds = res.data && res.data.seconds != null ? res.data.seconds : 0
          const minutes = Math.round(seconds / 60)
          self.local_form_contact_delay_minutes  = minutes
          self.stored_form_contact_delay_minutes = minutes
        })
        .catch(function () {
          self.error_form_contact_delay_message = 'No se pudo cargar el delay de contacto.'
        })
        .then(function () {
          self.loading_form_contact_delay = false
        })
    },

    /**
     * Guarda el delay de contacto via PUT /settings/implementation-form-contact-delay.
     * Convierte minutos a segundos antes de enviar al servidor.
     *
     * @returns {void}
     */
    on_save_form_contact_delay() {
      const self = this

      /** Validación: el valor debe ser un número no negativo. */
      const minutes = parseInt(self.local_form_contact_delay_minutes, 10)

      if (isNaN(minutes) || minutes < 0) {
        self.error_form_contact_delay_message = 'El valor debe ser 0 o más minutos.'
        return
      }

      self.saving_form_contact_delay        = true
      self.saved_form_contact_delay_message = ''
      self.error_form_contact_delay_message = ''

      /* Convertir minutos a segundos para la API */
      const seconds = minutes * 60

      api
        .put('/settings/implementation-form-contact-delay', { seconds: seconds })
        .then(function (res) {
          /** Segundos confirmados por el servidor; reconvertir a minutos. */
          const saved_seconds = res.data && res.data.seconds != null ? res.data.seconds : seconds
          const saved_minutes = Math.round(saved_seconds / 60)
          self.local_form_contact_delay_minutes  = saved_minutes
          self.stored_form_contact_delay_minutes = saved_minutes
          self.saved_form_contact_delay_message  = 'Configuración guardada.'
        })
        .catch(function (err) {
          const msg =
            (err.response && err.response.data && err.response.data.message) ||
            'No se pudo guardar.'
          self.error_form_contact_delay_message = msg
        })
        .then(function () {
          self.saving_form_contact_delay = false
        })
    },

    /**
     * Carga la cuota de Google configurada desde GET /settings/implementation-google-cuota-default.
     *
     * @returns {void}
     */
    load_google_cuota_default_setting() {
      const self = this
      self.loading_google_cuota_default = true
      self.error_google_cuota_default_message = ''

      api
        .get('/settings/implementation-google-cuota-default')
        .then(function (res) {
          /** Cuota retornada por el servidor; fallback a 100. */
          const cuota = res.data && res.data.cuota != null ? res.data.cuota : 100
          self.local_google_cuota_default  = cuota
          self.stored_google_cuota_default = cuota
        })
        .catch(function () {
          self.error_google_cuota_default_message = 'No se pudo cargar la cuota de Google.'
        })
        .then(function () {
          self.loading_google_cuota_default = false
        })
    },

    /**
     * Guarda la cuota de Google via PUT /settings/implementation-google-cuota-default.
     *
     * Valida localmente que el valor sea un entero mayor o igual a 0.
     *
     * @returns {void}
     */
    on_save_google_cuota_default() {
      const self = this

      const cuota = parseInt(self.local_google_cuota_default, 10)

      if (isNaN(cuota) || cuota < 0) {
        self.error_google_cuota_default_message = 'El valor debe ser 0 o más.'
        return
      }

      self.saving_google_cuota_default        = true
      self.saved_google_cuota_default_message = ''
      self.error_google_cuota_default_message = ''

      api
        .put('/settings/implementation-google-cuota-default', { cuota: cuota })
        .then(function (res) {
          const saved_cuota = res.data && res.data.cuota != null ? res.data.cuota : cuota
          self.local_google_cuota_default  = saved_cuota
          self.stored_google_cuota_default = saved_cuota
          self.saved_google_cuota_default_message = 'Configuración guardada.'
        })
        .catch(function (err) {
          const msg =
            (err.response && err.response.data && err.response.data.message) ||
            'No se pudo guardar.'
          self.error_google_cuota_default_message = msg
        })
        .then(function () {
          self.saving_google_cuota_default = false
        })
    },

    /**
     * Valida localmente que un valor de API key de Google tenga el formato esperado
     * (`AIza` + 35 caracteres alfanuméricos/`-`/`_`). Un valor vacío es válido (se usa el
     * respaldo hardcodeado de empresa-api).
     *
     * @param {string} value Valor a validar.
     * @returns {boolean} true si el formato es válido o el valor está vacío.
     */
    is_valid_google_api_key_format(value) {
      if (!value) {
        return true
      }

      return /^AIza[0-9A-Za-z\-_]{35}$/.test(value)
    },

    /**
     * Carga la API key de Google para clientes reales desde GET /settings/implementation-google-api-key-default.
     *
     * @returns {void}
     */
    load_google_api_key_default_setting() {
      const self = this
      self.loading_google_api_key_default = true
      self.error_google_api_key_default_message = ''

      api
        .get('/settings/implementation-google-api-key-default')
        .then(function (res) {
          /** API key retornada por el servidor; fallback a cadena vacía. */
          const api_key = res.data && res.data.api_key != null ? res.data.api_key : ''
          self.local_google_api_key_default  = api_key
          self.stored_google_api_key_default = api_key
        })
        .catch(function () {
          self.error_google_api_key_default_message = 'No se pudo cargar la API key de clientes.'
        })
        .then(function () {
          self.loading_google_api_key_default = false
        })
    },

    /**
     * Guarda la API key de Google de clientes reales via PUT /settings/implementation-google-api-key-default.
     * Valida el formato localmente antes de enviar el request.
     *
     * @returns {void}
     */
    on_save_google_api_key_default() {
      const self = this

      if (!self.is_valid_google_api_key_format(self.local_google_api_key_default)) {
        self.error_google_api_key_default_message =
          'La key no tiene el formato de una API key de Google (empieza con AIza y tiene 39 caracteres). Fijate que no se haya cortado al copiarla.'
        return
      }

      self.saving_google_api_key_default        = true
      self.saved_google_api_key_default_message = ''
      self.error_google_api_key_default_message = ''

      api
        .put('/settings/implementation-google-api-key-default', { api_key: self.local_google_api_key_default })
        .then(function (res) {
          /** API key confirmada por el servidor. */
          const saved_api_key = res.data && res.data.api_key != null ? res.data.api_key : self.local_google_api_key_default
          self.local_google_api_key_default  = saved_api_key
          self.stored_google_api_key_default = saved_api_key
          self.saved_google_api_key_default_message = 'Configuración guardada.'
        })
        .catch(function (err) {
          const msg =
            (err.response && err.response.data && err.response.data.message) ||
            'No se pudo guardar.'
          self.error_google_api_key_default_message = msg
        })
        .then(function () {
          self.saving_google_api_key_default = false
        })
    },

    /**
     * Carga la API key de Google para demos desde GET /settings/implementation-google-api-key-demo.
     *
     * @returns {void}
     */
    load_google_api_key_demo_setting() {
      const self = this
      self.loading_google_api_key_demo = true
      self.error_google_api_key_demo_message = ''

      api
        .get('/settings/implementation-google-api-key-demo')
        .then(function (res) {
          /** API key retornada por el servidor; fallback a cadena vacía. */
          const api_key = res.data && res.data.api_key != null ? res.data.api_key : ''
          self.local_google_api_key_demo  = api_key
          self.stored_google_api_key_demo = api_key
        })
        .catch(function () {
          self.error_google_api_key_demo_message = 'No se pudo cargar la API key de demos.'
        })
        .then(function () {
          self.loading_google_api_key_demo = false
        })
    },

    /**
     * Guarda la API key de Google de demos via PUT /settings/implementation-google-api-key-demo.
     * Valida el formato localmente antes de enviar el request.
     *
     * @returns {void}
     */
    on_save_google_api_key_demo() {
      const self = this

      if (!self.is_valid_google_api_key_format(self.local_google_api_key_demo)) {
        self.error_google_api_key_demo_message =
          'La key no tiene el formato de una API key de Google (empieza con AIza y tiene 39 caracteres). Fijate que no se haya cortado al copiarla.'
        return
      }

      self.saving_google_api_key_demo        = true
      self.saved_google_api_key_demo_message = ''
      self.error_google_api_key_demo_message = ''

      api
        .put('/settings/implementation-google-api-key-demo', { api_key: self.local_google_api_key_demo })
        .then(function (res) {
          /** API key confirmada por el servidor. */
          const saved_api_key = res.data && res.data.api_key != null ? res.data.api_key : self.local_google_api_key_demo
          self.local_google_api_key_demo  = saved_api_key
          self.stored_google_api_key_demo = saved_api_key
          self.saved_google_api_key_demo_message = 'Configuración guardada.'
        })
        .catch(function (err) {
          const msg =
            (err.response && err.response.data && err.response.data.message) ||
            'No se pudo guardar.'
          self.error_google_api_key_demo_message = msg
        })
        .then(function () {
          self.saving_google_api_key_demo = false
        })
    },

    /**
     * Carga la cuota de Google para demos desde GET /settings/implementation-google-cuota-demo.
     *
     * @returns {void}
     */
    load_google_cuota_demo_setting() {
      const self = this
      self.loading_google_cuota_demo = true
      self.error_google_cuota_demo_message = ''

      api
        .get('/settings/implementation-google-cuota-demo')
        .then(function (res) {
          /** Cuota retornada por el servidor; fallback a 100. */
          const cuota = res.data && res.data.cuota != null ? res.data.cuota : 100
          self.local_google_cuota_demo  = cuota
          self.stored_google_cuota_demo = cuota
        })
        .catch(function () {
          self.error_google_cuota_demo_message = 'No se pudo cargar la cuota de demos.'
        })
        .then(function () {
          self.loading_google_cuota_demo = false
        })
    },

    /**
     * Guarda la cuota de Google de demos via PUT /settings/implementation-google-cuota-demo.
     *
     * Valida localmente que el valor sea un entero mayor o igual a 0.
     *
     * @returns {void}
     */
    on_save_google_cuota_demo() {
      const self = this

      const cuota = parseInt(self.local_google_cuota_demo, 10)

      if (isNaN(cuota) || cuota < 0) {
        self.error_google_cuota_demo_message = 'El valor debe ser 0 o más.'
        return
      }

      self.saving_google_cuota_demo        = true
      self.saved_google_cuota_demo_message = ''
      self.error_google_cuota_demo_message = ''

      api
        .put('/settings/implementation-google-cuota-demo', { cuota: cuota })
        .then(function (res) {
          const saved_cuota = res.data && res.data.cuota != null ? res.data.cuota : cuota
          self.local_google_cuota_demo  = saved_cuota
          self.stored_google_cuota_demo = saved_cuota
          self.saved_google_cuota_demo_message = 'Configuración guardada.'
        })
        .catch(function (err) {
          const msg =
            (err.response && err.response.data && err.response.data.message) ||
            'No se pudo guardar.'
          self.error_google_cuota_demo_message = msg
        })
        .then(function () {
          self.saving_google_cuota_demo = false
        })
    },
  },
}
</script>
