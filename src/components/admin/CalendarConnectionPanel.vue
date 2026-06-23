<template>
  <!--
    Panel de conexión Google Calendar para admins closers.
    Solo se muestra contenido completo si el admin tiene is_closer = true.
    Gestiona el flujo OAuth: conectar → elegir calendario → estado activo → desconectar.
  -->
  <div class="calendar-connection-panel">

    <!-- Título del bloque -->
    <h6 class="fw-semibold mb-2">
      <i class="bi bi-calendar3 me-1" />
      Google Calendar
    </h6>

    <!-- Aviso cuando el admin no es closer -->
    <div v-if="!admin || !admin.is_closer" class="text-muted small">
      Activá el flag <strong>Es closer</strong> para conectar un calendario de Google.
    </div>

    <!-- Panel principal: solo para closers -->
    <template v-else>

      <!-- Texto explicativo para el usuario -->
      <p class="text-muted small mb-3">
        Conectá un calendario de Google dedicado <em>solo para marcar tu disponibilidad</em> —
        no tu calendario personal. Cualquier evento que crees ahí va a bloquear esos horarios
        para que no te agenden demos.
      </p>

      <!-- Estado: cargando -->
      <div v-if="loading_status" class="text-muted small">
        <span class="spinner-border spinner-border-sm me-1" />
        Verificando conexión…
      </div>

      <!-- Estado: no conectado -->
      <template v-else-if="!status.connected">
        <p class="text-muted small mb-2">No hay ningún calendario de Google conectado.</p>
        <button
          type="button"
          class="btn btn-outline-primary btn-sm"
          :disabled="connecting"
          @click="on_connect"
        >
          <span v-if="connecting" class="spinner-border spinner-border-sm me-1" />
          {{ connecting ? 'Redirigiendo…' : 'Conectar Google Calendar' }}
        </button>
      </template>

      <!-- Estado: conectado pero sin calendario elegido aún -->
      <template v-else-if="status.connected && !status.google_calendar_id">
        <p class="text-success small mb-2">
          <i class="bi bi-check-circle-fill me-1" />
          Cuenta conectada: <strong>{{ status.google_account_email }}</strong>
        </p>
        <p class="text-muted small mb-2">
          Ahora elegí qué calendario usar para marcar tu disponibilidad:
        </p>

        <!-- Carga de lista de calendarios -->
        <div v-if="loading_calendars" class="text-muted small">
          <span class="spinner-border spinner-border-sm me-1" />
          Cargando calendarios…
        </div>

        <div v-else-if="calendars.length">
          <!-- Selector de calendario dedicado -->
          <select
            v-model="selected_calendar_id"
            class="form-select form-select-sm mb-2"
            style="max-width: 360px"
          >
            <option value="">— Elegí un calendario —</option>
            <option
              v-for="cal in calendars"
              :key="cal.id"
              :value="cal.id"
            >
              {{ cal.summary }}
            </option>
          </select>

          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="!selected_calendar_id || saving_calendar"
            @click="on_save_calendar"
          >
            <span v-if="saving_calendar" class="spinner-border spinner-border-sm me-1" />
            {{ saving_calendar ? 'Guardando…' : 'Confirmar calendario' }}
          </button>
        </div>

        <p v-else class="text-danger small">No se encontraron calendarios en la cuenta conectada.</p>
      </template>

      <!-- Estado: conectado y con calendario elegido -->
      <template v-else-if="status.connected && status.google_calendar_id">
        <p class="text-success small mb-1">
          <i class="bi bi-check-circle-fill me-1" />
          Cuenta: <strong>{{ status.google_account_email }}</strong>
        </p>
        <p class="text-muted small mb-1">
          Calendario activo: <code>{{ status.google_calendar_id }}</code>
        </p>
        <p v-if="status.last_synced_at" class="text-muted small mb-2">
          Última sincronización: {{ format_date(status.last_synced_at) }}
        </p>

        <!-- Botón sincronizar -->
        <button
          type="button"
          class="btn btn-outline-secondary btn-sm mb-3"
          :disabled="syncing || loading_events"
          @click="on_sync"
        >
          <span v-if="syncing" class="spinner-border spinner-border-sm me-1" />
          <i v-else class="bi bi-arrow-clockwise me-1" />
          {{ syncing ? 'Sincronizando…' : 'Sincronizar calendario' }}
        </button>

        <!-- Tabla de eventos -->
        <div v-if="loading_events" class="text-muted small">
          <span class="spinner-border spinner-border-sm me-1" />
          Cargando eventos…
        </div>

        <div v-else-if="events_error" class="text-danger small mb-2">{{ events_error }}</div>

        <template v-else>
          <p v-if="!events.length" class="text-muted small mb-2">No hay eventos próximos en este calendario.</p>

          <template v-else>
            <!-- Agrupar eventos por fecha y mostrar una sección por día -->
            <div v-for="(day_events, day_key) in events_by_day" :key="day_key" class="mb-2">
              <p class="small fw-semibold mb-1 text-secondary">{{ format_day(day_key) }}</p>
              <table class="table table-sm table-bordered small mb-0">
                <thead>
                  <tr>
                    <th style="width: 80px">Inicio</th>
                    <th style="width: 80px">Fin</th>
                    <th>Evento</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(ev, idx) in day_events" :key="idx">
                    <td>{{ ev.inicio }}</td>
                    <td>{{ ev.fin }}</td>
                    <td>{{ ev.nombre }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </template>

        <button
          type="button"
          class="btn btn-outline-danger btn-sm"
          :disabled="disconnecting"
          @click="on_disconnect"
        >
          <span v-if="disconnecting" class="spinner-border spinner-border-sm me-1" />
          {{ disconnecting ? 'Desconectando…' : 'Desconectar' }}
        </button>
      </template>

      <!-- Mensaje de error genérico -->
      <p v-if="error_message" class="text-danger small mt-2 mb-0">{{ error_message }}</p>

    </template>
  </div>
</template>

<script>
import api from '@/utils/axios'

/**
 * Panel de conexión de Google Calendar para admins closers.
 *
 * Gestiona el flujo completo. Todas las rutas incluyen el admin_id del prop
 * para que el backend opere sobre el admin objetivo, no sobre el admin logueado:
 *   1. Consultar estado actual de la conexión (GET calendar/google/{admin_id}/status)
 *   2. Iniciar OAuth (GET calendar/google/{admin_id}/connect → redirigir al usuario)
 *   3. Después del callback, listar calendarios (GET calendar/google/{admin_id}/list-calendars)
 *   4. Guardar el calendario elegido (PUT calendar/google/{admin_id}/select-calendar)
 *   5. Desconectar (DELETE calendar/google/{admin_id})
 *
 * @prop {Object} admin  Objeto del admin que se está editando; se interpola su id en las URLs.
 */
export default {
  name: 'AdminCalendarConnectionPanel',

  props: {
    /** Admin que se está editando; se usa para verificar is_closer y cargar el estado. */
    admin: {
      type: Object,
      default: null,
    },
  },

  data() {
    return {
      /** Indica si se está cargando el estado de la conexión. */
      loading_status: false,
      /** Estado actual de la conexión devuelto por la API. */
      status: {
        connected: false,
        google_account_email: null,
        google_calendar_id: null,
        last_synced_at: null,
      },
      /** Indica si se está iniciando el flujo OAuth (redirigiendo a Google). */
      connecting: false,
      /** Indica si se está cargando la lista de calendarios disponibles. */
      loading_calendars: false,
      /** Lista de calendarios disponibles en la cuenta Google del closer. */
      calendars: [],
      /** ID del calendario seleccionado en el selector antes de confirmar. */
      selected_calendar_id: '',
      /** Indica si se está guardando la selección de calendario. */
      saving_calendar: false,
      /** Indica si se está desconectando el calendario. */
      disconnecting: false,
      /** Mensaje de error para mostrar al usuario. */
      error_message: '',
      /** Lista de eventos próximos del calendario conectado. */
      events: [],
      /** Indica si se están cargando los eventos del calendario. */
      loading_events: false,
      /** Indica si se está ejecutando una sincronización manual. */
      syncing: false,
      /** Mensaje de error específico de la carga de eventos. */
      events_error: '',
    }
  },

  computed: {
    /**
     * Agrupa los eventos por fecha (Y-m-d) para renderizar una tabla por día.
     *
     * @returns {Object.<string, Array>}
     */
    events_by_day() {
      var grouped = {}
      var self = this
      self.events.forEach(function (ev) {
        if (!grouped[ev.fecha]) {
          grouped[ev.fecha] = []
        }
        grouped[ev.fecha].push(ev)
      })
      return grouped
    },
  },

  watch: {
    /**
     * Recarga el estado cuando cambia el admin mostrado,
     * o cuando se activa el flag is_closer.
     */
    admin: {
      handler: function (new_admin) {
        if (new_admin && new_admin.is_closer) {
          this.load_status()
        }
      },
      immediate: true,
      deep: true,
    },
  },

  methods: {
    /**
     * Carga el estado actual de la conexión de Google Calendar del admin objetivo.
     * Usa this.admin.id en la URL para consultar el admin correcto, no el de la sesión.
     */
    load_status() {
      var self = this
      self.loading_status = true
      self.error_message = ''

      api.get('/calendar/google/' + self.admin.id + '/status')
        .then(function (res) {
          self.status = res.data
          // Si está conectado pero sin calendario, cargar la lista para que elija.
          if (self.status.connected && !self.status.google_calendar_id) {
            self.load_calendars()
          }
          // Si ya tiene calendario elegido, cargar eventos próximos.
          if (self.status.connected && self.status.google_calendar_id) {
            self.load_events()
          }
        })
        .catch(function () {
          self.error_message = 'No se pudo obtener el estado de la conexión.'
        })
        .then(function () {
          self.loading_status = false
        })
    },

    /**
     * Inicia el flujo OAuth redirigiendo al usuario a la URL de autorización de Google.
     * Envía el admin_id del admin objetivo para que el OAuth quede asociado correctamente.
     */
    on_connect() {
      var self = this
      self.connecting = true
      self.error_message = ''

      api.get('/calendar/google/' + self.admin.id + '/connect')
        .then(function (res) {
          // Redirigir al usuario a Google para que autorice el acceso.
          window.location.href = res.data.authorization_url
        })
        .catch(function () {
          self.error_message = 'No se pudo iniciar la conexión con Google.'
          self.connecting = false
        })
    },

    /**
     * Carga la lista de calendarios disponibles en la cuenta Google del admin objetivo.
     */
    load_calendars() {
      var self = this
      self.loading_calendars = true
      self.error_message = ''

      api.get('/calendar/google/' + self.admin.id + '/list-calendars')
        .then(function (res) {
          self.calendars = res.data.calendars || []
        })
        .catch(function () {
          self.error_message = 'No se pudo cargar la lista de calendarios.'
        })
        .then(function () {
          self.loading_calendars = false
        })
    },

    /**
     * Guarda el calendario dedicado elegido por el closer.
     */
    on_save_calendar() {
      var self = this
      if (!self.selected_calendar_id) {
        return
      }
      self.saving_calendar = true
      self.error_message = ''

      api.put('/calendar/google/' + self.admin.id + '/select-calendar', {
        calendar_id: self.selected_calendar_id,
      })
        .then(function (res) {
          // Actualizar el estado local con el calendario guardado.
          self.status.google_calendar_id = res.data.google_calendar_id
          // Cargar eventos al confirmar el calendario dedicado.
          self.load_events()
        })
        .catch(function () {
          self.error_message = 'No se pudo guardar la selección del calendario.'
        })
        .then(function () {
          self.saving_calendar = false
        })
    },

    /**
     * Carga los eventos próximos del calendario Google del admin objetivo.
     */
    load_events() {
      var self = this
      self.loading_events = true
      self.events_error = ''

      api.get('/calendar/google/' + self.admin.id + '/events')
        .then(function (res) {
          self.events = res.data.events || []
          if (res.data.last_synced_at) {
            self.status.last_synced_at = res.data.last_synced_at
          }
        })
        .catch(function () {
          self.events_error = 'No se pudieron cargar los eventos del calendario.'
        })
        .then(function () {
          self.loading_events = false
        })
    },

    /**
     * Fuerza sincronización con Google Calendar e invalida caché de disponibilidad.
     */
    on_sync() {
      var self = this
      self.syncing = true
      self.events_error = ''

      api.post('/calendar/google/' + self.admin.id + '/sync')
        .then(function (res) {
          self.events = res.data.events || []
          if (res.data.last_synced_at) {
            self.status.last_synced_at = res.data.last_synced_at
          }
        })
        .catch(function () {
          self.events_error = 'No se pudo sincronizar el calendario.'
        })
        .then(function () {
          self.syncing = false
        })
    },

    /**
     * Desconecta el Google Calendar del admin (desactivación soft).
     */
    on_disconnect() {
      if (!window.confirm('¿Desconectar Google Calendar? El sistema dejará de usar tu calendario para bloquear disponibilidad.')) {
        return
      }
      var self = this
      self.disconnecting = true
      self.error_message = ''

      api.delete('/calendar/google/' + self.admin.id)
        .then(function () {
          // Resetear el estado local al estado desconectado.
          self.status = {
            connected: false,
            google_account_email: null,
            google_calendar_id: null,
            last_synced_at: null,
          }
          self.calendars = []
          self.selected_calendar_id = ''
          self.events = []
        })
        .catch(function () {
          self.error_message = 'No se pudo desconectar el calendario.'
        })
        .then(function () {
          self.disconnecting = false
        })
    },

    /**
     * Formatea una fecha Y-m-d como encabezado de día legible en español.
     *
     * @param {string} date_string  Fecha en formato Y-m-d.
     * @returns {string} Fecha formateada con día de semana.
     */
    format_day(date_string) {
      try {
        var d = new Date(date_string + 'T12:00:00')
        return d.toLocaleDateString('es-AR', {
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      } catch (e) {
        return date_string
      }
    },

    /**
     * Formatea una fecha ISO para mostrar al usuario.
     *
     * @param {string} date_string  Fecha ISO 8601.
     * @returns {string} Fecha formateada en español.
     */
    format_date(date_string) {
      if (!date_string) {
        return ''
      }
      try {
        var d = new Date(date_string)
        return d.toLocaleString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      } catch (e) {
        return date_string
      }
    },
  },
}
</script>

<style scoped>
/* Estilo del panel de conexión de calendario; contenido dentro del formulario de edición. */
.calendar-connection-panel {
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 0.375rem;
  border: 1px solid #dee2e6;
}
</style>
