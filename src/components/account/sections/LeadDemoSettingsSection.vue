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

      <!-- Campo: recordatorio de mañana de la demo -->
      <div class="row g-2 align-items-end mb-3">
        <div class="col-sm-5">
          <label class="form-label small" for="demo_recordatorio_manana_hora">Hora del recordatorio de mañana de la demo</label>
          <!-- Hora del día en que se envía el recordatorio de mañana por WhatsApp -->
          <input
            id="demo_recordatorio_manana_hora"
            v-model="local.recordatorio_manana_hora"
            type="time"
            class="form-control form-control-sm"
            :disabled="saving"
          />
          <p class="text-muted small mb-0 mt-1">Se envía automáticamente por WhatsApp el día de la demo a esta hora.</p>
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

      <!-- Campo: horario laboral del closer lunes a viernes -->
      <div class="row g-2 align-items-end mb-3">
        <div class="col-sm-5">
          <label class="form-label small" for="demo_closer_horario_lunes_viernes">Horario de trabajo del closer (lunes a viernes)</label>
          <!-- Rango horario H:i-H:i; define en qué ventana el closer puede atender demos -->
          <input
            id="demo_closer_horario_lunes_viernes"
            v-model="local.closer_horario_lunes_viernes"
            type="text"
            class="form-control form-control-sm"
            placeholder="09:00-18:00"
            :disabled="saving"
          />
          <p class="text-muted small mb-0 mt-1">Formato HH:MM-HH:MM. Ej: 09:00-18:00</p>
        </div>
      </div>

      <!-- Campo: horario laboral del closer sábados -->
      <div class="row g-2 align-items-end mb-3">
        <div class="col-sm-5">
          <label class="form-label small" for="demo_closer_horario_sabado">Horario de trabajo del closer (sábados)</label>
          <!-- Dejar vacío si el closer no trabaja los sábados -->
          <input
            id="demo_closer_horario_sabado"
            v-model="local.closer_horario_sabado"
            type="text"
            class="form-control form-control-sm"
            placeholder="10:00-13:00"
            :disabled="saving"
          />
          <p class="text-muted small mb-0 mt-1">Dejar vacío si el closer no trabaja los sábados.</p>
        </div>
      </div>

      <!-- Campo: horario laboral del closer domingos -->
      <div class="row g-2 align-items-end mb-3">
        <div class="col-sm-5">
          <label class="form-label small" for="demo_closer_horario_domingo">Horario de trabajo del closer (domingos)</label>
          <!-- Dejar vacío si el closer no trabaja los domingos -->
          <input
            id="demo_closer_horario_domingo"
            v-model="local.closer_horario_domingo"
            type="text"
            class="form-control form-control-sm"
            placeholder=""
            :disabled="saving"
          />
          <p class="text-muted small mb-0 mt-1">Dejar vacío si el closer no trabaja los domingos.</p>
        </div>
      </div>

      <!-- Campo: frecuencia de slots en minutos -->
      <div class="row g-2 align-items-end mb-3">
        <div class="col-sm-5">
          <label class="form-label small" for="demo_frecuencia_slots_minutos">Frecuencia de slots (minutos)</label>
          <!-- Cada cuántos minutos se generan los horarios disponibles para agendar demos -->
          <input
            id="demo_frecuencia_slots_minutos"
            v-model.number="local.frecuencia_slots_minutos"
            type="number"
            class="form-control form-control-sm"
            min="5"
            max="60"
            :disabled="saving"
          />
          <p class="text-muted small mb-0 mt-1">Cada cuántos minutos se generan los horarios disponibles. Valores válidos: 5, 10, 15, 30, 60.</p>
        </div>
      </div>

      <!-- Campo: checkbox llamada del closer debe terminar dentro del horario -->
      <div class="row g-2 align-items-end mb-3">
        <div class="col-sm-7">
          <div class="form-check">
            <!-- Controla si el slot solo se ofrece cuando la llamada completa cabe en el horario laboral -->
            <input
              id="demo_llamada_debe_terminar_en_horario"
              v-model="local.llamada_debe_terminar_en_horario"
              type="checkbox"
              class="form-check-input"
              :disabled="saving"
            />
            <label class="form-check-label small" for="demo_llamada_debe_terminar_en_horario">
              La llamada del closer debe terminar dentro de su horario laboral
            </label>
          </div>
          <p class="text-muted small mb-0 mt-1">Si está activado, solo se ofrecen demos donde la llamada completa quede dentro del horario. Si está desactivado, basta con que la llamada comience dentro del horario.</p>
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
 * Gestiona los 8 parámetros que controlan duración, márgenes de setup/gracia,
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
        recordatorio_manana_hora: '09:00',
        check_ingreso_minutos_post: 5,
        resumen_minutos_antes_fin: 10,
        /** Minutos que el closer necesita para atender al lead post-demo; bloquea la ventana en otras demos. */
        duracion_llamada_closer_minutos: 30,
        /** Horario laboral del closer lunes a viernes (H:i-H:i). */
        closer_horario_lunes_viernes: '09:00-18:00',
        /** Horario laboral del closer sábados (H:i-H:i o vacío). */
        closer_horario_sabado: '10:00-13:00',
        /** Horario laboral del closer domingos (H:i-H:i o vacío). */
        closer_horario_domingo: '',
        /** Frecuencia en minutos con que se generan los slots disponibles. */
        frecuencia_slots_minutos: 30,
        /** Si la llamada del closer debe terminar dentro del horario laboral. */
        llamada_debe_terminar_en_horario: false,
      },
      /** Valores persistidos en servidor (para detectar cambios). */
      stored: {
        duracion_minutos: 60,
        setup_minutos_antes: 15,
        gracia_minutos_post: 10,
        recordatorio_minutos_antes: 15,
        recordatorio_manana_hora: '09:00',
        check_ingreso_minutos_post: 5,
        resumen_minutos_antes_fin: 10,
        /** Espejo del servidor para detectar si el campo fue modificado localmente. */
        duracion_llamada_closer_minutos: 30,
        /** Espejo del servidor: horario laboral del closer lunes a viernes. */
        closer_horario_lunes_viernes: '09:00-18:00',
        /** Espejo del servidor: horario laboral del closer sábados. */
        closer_horario_sabado: '10:00-13:00',
        /** Espejo del servidor: horario laboral del closer domingos. */
        closer_horario_domingo: '',
        /** Espejo del servidor: frecuencia de slots en minutos. */
        frecuencia_slots_minutos: 30,
        /** Espejo del servidor: si la llamada del closer debe terminar dentro del horario. */
        llamada_debe_terminar_en_horario: false,
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
          /* Campos que se tratan como string (no entero). */
          var string_fields = ['recordatorio_manana_hora', 'closer_horario_lunes_viernes', 'closer_horario_sabado', 'closer_horario_domingo']
          /* Campos que se tratan como booleano. */
          var bool_fields = ['llamada_debe_terminar_en_horario']
          fields.forEach(function (key) {
            if (data[key] !== undefined) {
              if (bool_fields.indexOf(key) !== -1) {
                /* El backend devuelve true/false; normalizar a boolean. */
                self.local[key]  = data[key] === true || data[key] === 1 || data[key] === '1'
                self.stored[key] = self.local[key]
              } else if (string_fields.indexOf(key) !== -1) {
                self.local[key]  = String(data[key])
                self.stored[key] = String(data[key])
              } else {
                self.local[key]  = parseInt(data[key], 10)
                self.stored[key] = parseInt(data[key], 10)
              }
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
          duracion_minutos:                    self.local.duracion_minutos,
          setup_minutos_antes:                 self.local.setup_minutos_antes,
          gracia_minutos_post:                 self.local.gracia_minutos_post,
          recordatorio_minutos_antes:          self.local.recordatorio_minutos_antes,
          recordatorio_manana_hora:            self.local.recordatorio_manana_hora,
          check_ingreso_minutos_post:          self.local.check_ingreso_minutos_post,
          resumen_minutos_antes_fin:           self.local.resumen_minutos_antes_fin,
          duracion_llamada_closer_minutos:     self.local.duracion_llamada_closer_minutos,
          closer_horario_lunes_viernes:        self.local.closer_horario_lunes_viernes,
          closer_horario_sabado:               self.local.closer_horario_sabado,
          closer_horario_domingo:              self.local.closer_horario_domingo,
          frecuencia_slots_minutos:            self.local.frecuencia_slots_minutos,
          llamada_debe_terminar_en_horario:    self.local.llamada_debe_terminar_en_horario,
        })
        .then(function (res) {
          /* Actualizar los valores de referencia para que can_save vuelva a false. */
          var data = res.data || {}
          var fields = Object.keys(self.local)
          /* Campos que se tratan como string (no entero). */
          var string_fields = ['recordatorio_manana_hora', 'closer_horario_lunes_viernes', 'closer_horario_sabado', 'closer_horario_domingo']
          /* Campos que se tratan como booleano. */
          var bool_fields = ['llamada_debe_terminar_en_horario']
          fields.forEach(function (key) {
            if (data[key] !== undefined) {
              if (bool_fields.indexOf(key) !== -1) {
                self.local[key]  = data[key] === true || data[key] === 1 || data[key] === '1'
                self.stored[key] = self.local[key]
              } else if (string_fields.indexOf(key) !== -1) {
                self.local[key]  = String(data[key])
                self.stored[key] = String(data[key])
              } else {
                self.local[key]  = parseInt(data[key], 10)
                self.stored[key] = parseInt(data[key], 10)
              }
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
