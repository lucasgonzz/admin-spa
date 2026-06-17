<template>
  <div class="lead-demo-settings-section">
    <!-- Estado: cargando datos iniciales -->
    <p v-if="loading" class="text-muted small mb-0">Cargando…</p>

    <!-- Formulario: visible una vez cargado -->
    <template v-else>
      <!-- Campo: duración de la demo -->
      <div class="row g-2 align-items-end mb-3">
        <div class="col-sm-5">
          <label class="form-label small" for="demo_duracion_minutos">Duración de la demo (minutos)</label>
          <!-- Tiempo total estimado de la demo; define el ancho del slot en el cálculo de disponibilidad -->
          <input
            id="demo_duracion_minutos"
            v-model.number="local.duracion_minutos"
            type="number"
            class="form-control form-control-sm"
            min="0"
            max="240"
            :disabled="saving"
          />
        </div>
      </div>

      <!-- Campo: minutos antes para demo setup automático -->
      <div class="row g-2 align-items-end mb-3">
        <div class="col-sm-5">
          <label class="form-label small" for="demo_setup_minutos_antes">Minutos antes para correr demo setup automático</label>
          <!-- Margen reservado antes del inicio; el slot queda bloqueado desde (inicio - este valor) -->
          <input
            id="demo_setup_minutos_antes"
            v-model.number="local.setup_minutos_antes"
            type="number"
            class="form-control form-control-sm"
            min="0"
            max="240"
            :disabled="saving"
          />
        </div>
      </div>

      <!-- Campo: minutos de gracia tras finalizar la demo -->
      <div class="row g-2 align-items-end mb-3">
        <div class="col-sm-5">
          <label class="form-label small" for="demo_gracia_minutos_post">Minutos de gracia tras finalizar la demo</label>
          <!-- Margen post-cierre; el slot se libera recién cuando expira este tiempo -->
          <input
            id="demo_gracia_minutos_post"
            v-model.number="local.gracia_minutos_post"
            type="number"
            class="form-control form-control-sm"
            min="0"
            max="240"
            :disabled="saving"
          />
        </div>
      </div>

      <!-- Campo: recordatorio antes del inicio -->
      <div class="row g-2 align-items-end mb-3">
        <div class="col-sm-5">
          <label class="form-label small" for="demo_recordatorio_minutos_antes">Minutos antes para enviar recordatorio por WhatsApp</label>
          <!-- Cuántos minutos antes del inicio se envía el mensaje de recordatorio al lead -->
          <input
            id="demo_recordatorio_minutos_antes"
            v-model.number="local.recordatorio_minutos_antes"
            type="number"
            class="form-control form-control-sm"
            min="0"
            max="240"
            :disabled="saving"
          />
        </div>
      </div>

      <!-- Campo: check de ingreso post-inicio -->
      <div class="row g-2 align-items-end mb-3">
        <div class="col-sm-5">
          <label class="form-label small" for="demo_check_ingreso_minutos_post">Minutos después del inicio para preguntar si pudo ingresar</label>
          <!-- Cuántos minutos después del inicio se verifica si el lead logró acceder a la demo -->
          <input
            id="demo_check_ingreso_minutos_post"
            v-model.number="local.check_ingreso_minutos_post"
            type="number"
            class="form-control form-control-sm"
            min="0"
            max="240"
            :disabled="saving"
          />
        </div>
      </div>

      <!-- Campo: resumen antes del fin de la demo -->
      <div class="row g-2 align-items-end mb-3">
        <div class="col-sm-5">
          <label class="form-label small" for="demo_resumen_minutos_antes_fin">Minutos antes del fin para generar resumen del lead (para el closer)</label>
          <!-- Cuántos minutos antes del fin de la demo se genera el resumen del lead con Claude -->
          <input
            id="demo_resumen_minutos_antes_fin"
            v-model.number="local.resumen_minutos_antes_fin"
            type="number"
            class="form-control form-control-sm"
            min="0"
            max="240"
            :disabled="saving"
          />
        </div>
      </div>

      <!-- Campo: duración de la llamada del closer post-demo -->
      <div class="row g-2 align-items-end mb-3">
        <div class="col-sm-5">
          <label class="form-label small" for="demo_duracion_llamada_closer_minutos">Minutos de llamada del closer post-demo</label>
          <!-- Cuánto tiempo necesita el closer para atender a un lead; ningún otro lead puede liberar su demo dentro de esta ventana -->
          <input
            id="demo_duracion_llamada_closer_minutos"
            v-model.number="local.duracion_llamada_closer_minutos"
            type="number"
            class="form-control form-control-sm"
            min="0"
            max="240"
            :disabled="saving"
          />
        </div>
      </div>

      <!-- Botón guardar: único para todos los campos -->
      <div class="d-flex align-items-center gap-2">
        <button
          type="button"
          class="btn btn-primary btn-sm"
          :disabled="saving || !can_save"
          @click="on_save"
        >
          {{ saving ? 'Guardando…' : 'Guardar' }}
        </button>
      </div>

      <!-- Mensajes de resultado inline -->
      <p v-if="saved_message" class="text-success small mt-2 mb-0">{{ saved_message }}</p>
      <p v-else-if="error_message" class="text-danger small mt-2 mb-0">{{ error_message }}</p>
    </template>
  </div>
</template>

<script>
import api from '@/utils/axios'

/**
 * Sección en Cuenta: configuración de demos.
 *
 * Gestiona los 7 parámetros que controlan duración, márgenes de setup/gracia,
 * tiempos de automatizaciones (recordatorio, check de ingreso, resumen del lead)
 * y la duración de la llamada del closer para el bloqueo global de disponibilidad.
 */
export default {
  name: 'LeadDemoSettingsSection',
  data() {
    return {
      /** Valores editables en el formulario. */
      local: {
        duracion_minutos: 60,
        setup_minutos_antes: 15,
        gracia_minutos_post: 10,
        recordatorio_minutos_antes: 15,
        check_ingreso_minutos_post: 5,
        resumen_minutos_antes_fin: 10,
        /** Minutos que el closer necesita para atender al lead post-demo; bloquea la ventana en otras demos. */
        duracion_llamada_closer_minutos: 30,
      },
      /** Valores persistidos en servidor (para detectar cambios). */
      stored: {
        duracion_minutos: 60,
        setup_minutos_antes: 15,
        gracia_minutos_post: 10,
        recordatorio_minutos_antes: 15,
        check_ingreso_minutos_post: 5,
        resumen_minutos_antes_fin: 10,
        /** Espejo del servidor para detectar si el campo fue modificado localmente. */
        duracion_llamada_closer_minutos: 30,
      },
      /** Carga inicial GET settings. */
      loading: true,
      /** PUT en curso. */
      saving: false,
      /** Mensaje de éxito tras guardar. */
      saved_message: '',
      /** Error de validación o API. */
      error_message: '',
    }
  },
  computed: {
    /**
     * Habilita el botón guardar solo si algún campo cambió respecto al valor guardado en servidor.
     *
     * @returns {boolean}
     */
    can_save() {
      var fields = Object.keys(this.local)
      for (var i = 0; i < fields.length; i++) {
        var key = fields[i]
        if (this.local[key] !== this.stored[key]) {
          return true
        }
      }
      return false
    },
  },
  mounted() {
    this.load_settings()
  },
  methods: {
    /**
     * GET /settings/lead-demo — carga la configuración actual de demos.
     *
     * @returns {void}
     */
    load_settings() {
      var self = this
      self.loading = true
      self.error_message = ''
      api
        .get('/settings/lead-demo')
        .then(function (res) {
          /* Poblar campos locales y almacenar los valores de referencia del servidor. */
          var data = res.data || {}
          var fields = Object.keys(self.local)
          fields.forEach(function (key) {
            if (data[key] !== undefined) {
              self.local[key]  = parseInt(data[key], 10)
              self.stored[key] = parseInt(data[key], 10)
            }
          })
        })
        .catch(function () {
          self.error_message = 'No se pudo cargar la configuración de demos.'
        })
        .then(function () {
          self.loading = false
        })
    },
    /**
     * PUT /settings/lead-demo — persiste todos los campos editados.
     *
     * @returns {void}
     */
    on_save() {
      var self = this
      if (!self.can_save) {
        return
      }
      self.saving = true
      self.saved_message = ''
      self.error_message = ''
      api
        .put('/settings/lead-demo', {
          duracion_minutos:                self.local.duracion_minutos,
          setup_minutos_antes:             self.local.setup_minutos_antes,
          gracia_minutos_post:             self.local.gracia_minutos_post,
          recordatorio_minutos_antes:      self.local.recordatorio_minutos_antes,
          check_ingreso_minutos_post:      self.local.check_ingreso_minutos_post,
          resumen_minutos_antes_fin:       self.local.resumen_minutos_antes_fin,
          duracion_llamada_closer_minutos: self.local.duracion_llamada_closer_minutos,
        })
        .then(function (res) {
          /* Actualizar los valores de referencia para que can_save vuelva a false. */
          var data = res.data || {}
          var fields = Object.keys(self.local)
          fields.forEach(function (key) {
            if (data[key] !== undefined) {
              self.local[key]  = parseInt(data[key], 10)
              self.stored[key] = parseInt(data[key], 10)
            }
          })
          self.saved_message = 'Configuración de demos guardada.'
        })
        .catch(function (err) {
          /* Mostrar mensaje del servidor si está disponible, o genérico. */
          var msg =
            (err.response && err.response.data && err.response.data.message) ||
            'No se pudo guardar la configuración.'
          self.error_message = msg
        })
        .then(function () {
          self.saving = false
        })
    },
  },
}
</script>
