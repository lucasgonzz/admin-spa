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

      <!-- Horario laboral del closer: lunes a viernes -->
      <div class="row g-2 align-items-end mb-3">
        <div class="col-12">
          <label class="form-label small">Horario de trabajo del closer (lunes a viernes)</label>
          <!-- Inicio y fin del horario laboral entre semana; define en qué ventana el closer puede atender demos -->
          <div class="d-flex flex-wrap align-items-end gap-3">
            <div class="col-auto">
              <label class="form-label small mb-0" for="demo_closer_lv_inicio">Inicio</label>
              <input
                id="demo_closer_lv_inicio"
                v-model="local.closer_lv_inicio"
                type="time"
                class="form-control form-control-sm"
                :disabled="saving"
              />
            </div>
            <div class="col-auto">
              <label class="form-label small mb-0" for="demo_closer_lv_fin">Fin</label>
              <input
                id="demo_closer_lv_fin"
                v-model="local.closer_lv_fin"
                type="time"
                class="form-control form-control-sm"
                :disabled="saving"
              />
            </div>
          </div>
          <p class="text-muted small mb-0 mt-1">Si dejás Inicio o Fin vacíos, el sistema no ofrecerá slots entre semana.</p>
        </div>
      </div>

      <!-- Horario laboral del closer: sábados -->
      <div class="row g-2 align-items-end mb-3">
        <div class="col-12">
          <label class="form-label small">Horario de trabajo del closer (sábados)</label>
          <!-- Dejar ambos vacíos si el closer no trabaja los sábados -->
          <div class="d-flex flex-wrap align-items-end gap-3">
            <div class="col-auto">
              <label class="form-label small mb-0" for="demo_closer_sabado_inicio">Inicio</label>
              <input
                id="demo_closer_sabado_inicio"
                v-model="local.closer_sabado_inicio"
                type="time"
                class="form-control form-control-sm"
                :disabled="saving"
              />
            </div>
            <div class="col-auto">
              <label class="form-label small mb-0" for="demo_closer_sabado_fin">Fin</label>
              <input
                id="demo_closer_sabado_fin"
                v-model="local.closer_sabado_fin"
                type="time"
                class="form-control form-control-sm"
                :disabled="saving"
              />
            </div>
          </div>
          <p class="text-muted small mb-0 mt-1">Dejar vacío para indicar que el closer no trabaja ese día.</p>
        </div>
      </div>

      <!-- Horario laboral del closer: domingos -->
      <div class="row g-2 align-items-end mb-3">
        <div class="col-12">
          <label class="form-label small">Horario de trabajo del closer (domingos)</label>
          <!-- Dejar ambos vacíos si el closer no trabaja los domingos -->
          <div class="d-flex flex-wrap align-items-end gap-3">
            <div class="col-auto">
              <label class="form-label small mb-0" for="demo_closer_domingo_inicio">Inicio</label>
              <input
                id="demo_closer_domingo_inicio"
                v-model="local.closer_domingo_inicio"
                type="time"
                class="form-control form-control-sm"
                :disabled="saving"
              />
            </div>
            <div class="col-auto">
              <label class="form-label small mb-0" for="demo_closer_domingo_fin">Fin</label>
              <input
                id="demo_closer_domingo_fin"
                v-model="local.closer_domingo_fin"
                type="time"
                class="form-control form-control-sm"
                :disabled="saving"
              />
            </div>
          </div>
          <p class="text-muted small mb-0 mt-1">Dejar vacío para indicar que el closer no trabaja ese día.</p>
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

      <!-- Campo: timeout de ingreso -->
      <div class="row g-2 align-items-end mb-3">
        <div class="col-sm-5">
          <label class="form-label small" for="demo_ingreso_timeout_minutos">Timeout de ingreso (min)</label>
          <!-- Minutos sin respuesta al check de ingreso antes de marcar pendiente y avisar admins -->
          <input
            id="demo_ingreso_timeout_minutos"
            v-model.number="local.ingreso_timeout_minutos"
            type="number"
            class="form-control form-control-sm"
            min="0"
            max="240"
            :disabled="saving"
          />
          <p class="text-muted small mb-0 mt-1">Si el lead no responde al check de ingreso pasados estos minutos, se marca como pendiente de ingreso y se avisa a los admins.</p>
        </div>
      </div>

      <!-- Campo: seguimiento de fin -->
      <div class="row g-2 align-items-end mb-3">
        <div class="col-sm-5">
          <label class="form-label small" for="demo_fin_seguimiento_minutos">Seguimiento de fin (min)</label>
          <!-- Minutos desde la pregunta de fin antes de insistir una vez más -->
          <input
            id="demo_fin_seguimiento_minutos"
            v-model.number="local.fin_seguimiento_minutos"
            type="number"
            class="form-control form-control-sm"
            min="0"
            max="240"
            :disabled="saving"
          />
          <p class="text-muted small mb-0 mt-1">Minutos tras preguntar si terminó la demo, antes de insistir una vez más.</p>
        </div>
      </div>

      <!-- Campo: timeout de fin -->
      <div class="row g-2 align-items-end mb-3">
        <div class="col-sm-5">
          <label class="form-label small" for="demo_fin_timeout_minutos">Timeout de fin (min)</label>
          <!-- Minutos desde la pregunta de fin antes de marcar pendiente de terminar y avisar admins -->
          <input
            id="demo_fin_timeout_minutos"
            v-model.number="local.fin_timeout_minutos"
            type="number"
            class="form-control form-control-sm"
            min="0"
            max="240"
            :disabled="saving"
          />
          <p class="text-muted small mb-0 mt-1">Si el lead no confirma que terminó pasados estos minutos, se marca pendiente de terminar y se avisa a los admins.</p>
        </div>
      </div>

      <!-- Campo: horas sin ingreso antes de revertir a calificado -->
      <div class="row g-2 align-items-end mb-3">
        <div class="col-sm-5">
          <label class="form-label small" for="demo_pendiente_ingreso_horas_timeout">Horas sin ingreso antes de revertir a calificado</label>
          <!-- Horas desde el horario de la demo antes de volver a calificado para que el seguimiento retome el contacto -->
          <input
            id="demo_pendiente_ingreso_horas_timeout"
            v-model.number="local.pendiente_ingreso_horas_timeout"
            type="number"
            class="form-control form-control-sm"
            min="1"
            max="720"
            :disabled="saving"
          />
          <p class="text-muted small mb-0 mt-1">Si el lead queda en 'Demo pendiente de ingreso' más de estas horas desde el horario de la demo, vuelve a Calificado para que el seguimiento lo retome.</p>
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
        /** Hora de inicio del horario laboral del closer lunes a viernes. */
        closer_lv_inicio: '09:00',
        /** Hora de fin del horario laboral del closer lunes a viernes. */
        closer_lv_fin: '18:00',
        /** Hora de inicio del horario laboral del closer los sábados (vacío = no trabaja). */
        closer_sabado_inicio: '',
        /** Hora de fin del horario laboral del closer los sábados (vacío = no trabaja). */
        closer_sabado_fin: '',
        /** Hora de inicio del horario laboral del closer los domingos (vacío = no trabaja). */
        closer_domingo_inicio: '',
        /** Hora de fin del horario laboral del closer los domingos (vacío = no trabaja). */
        closer_domingo_fin: '',
        /** Frecuencia en minutos con que se generan los slots disponibles. */
        frecuencia_slots_minutos: 30,
        /** Si la llamada del closer debe terminar dentro del horario laboral. */
        llamada_debe_terminar_en_horario: false,
        /** Minutos sin respuesta al check de ingreso antes de marcar demo_pendiente_de_ingreso. */
        ingreso_timeout_minutos: 15,
        /** Minutos desde el check de fin antes de insistir una vez más ("¿pudiste terminar?"). */
        fin_seguimiento_minutos: 10,
        /** Minutos desde el check de fin antes de marcar demo_pendiente_de_terminar. */
        fin_timeout_minutos: 25,
        /** Horas desde el horario de la demo sin ingreso antes de revertir a calificado. */
        pendiente_ingreso_horas_timeout: 24,
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
        /** Espejo del servidor: hora de inicio lunes a viernes. */
        closer_lv_inicio: '09:00',
        /** Espejo del servidor: hora de fin lunes a viernes. */
        closer_lv_fin: '18:00',
        /** Espejo del servidor: hora de inicio sábados. */
        closer_sabado_inicio: '',
        /** Espejo del servidor: hora de fin sábados. */
        closer_sabado_fin: '',
        /** Espejo del servidor: hora de inicio domingos. */
        closer_domingo_inicio: '',
        /** Espejo del servidor: hora de fin domingos. */
        closer_domingo_fin: '',
        /** Espejo del servidor: frecuencia de slots en minutos. */
        frecuencia_slots_minutos: 30,
        /** Espejo del servidor: si la llamada del closer debe terminar dentro del horario. */
        llamada_debe_terminar_en_horario: false,
        /** Espejo del servidor: timeout de ingreso en minutos. */
        ingreso_timeout_minutos: 15,
        /** Espejo del servidor: minutos antes de insistir en el fin de la demo. */
        fin_seguimiento_minutos: 10,
        /** Espejo del servidor: timeout de fin en minutos. */
        fin_timeout_minutos: 25,
        /** Espejo del servidor: horas sin ingreso antes de revertir a calificado. */
        pendiente_ingreso_horas_timeout: 24,
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
     * Parsea un string H:i-H:i del backend en hora de inicio y fin separadas.
     *
     * @param {string} range_string - Rango horario del servidor o cadena vacía.
     * @returns {{ inicio: string, fin: string }}
     */
    parse_horario_range(range_string) {
      if (!range_string || range_string.trim() === '') {
        return { inicio: '', fin: '' }
      }
      var parts = range_string.split('-')
      if (parts.length === 2) {
        return { inicio: parts[0].trim(), fin: parts[1].trim() }
      }
      return { inicio: '', fin: '' }
    },
    /**
     * Construye el string H:i-H:i que espera el backend a partir de inicio y fin.
     *
     * @param {string} inicio - Hora de inicio (input type="time").
     * @param {string} fin - Hora de fin (input type="time").
     * @returns {string} Rango concatenado o vacío si falta algún extremo.
     */
    build_horario_range(inicio, fin) {
      if (!inicio || !fin || inicio.trim() === '' || fin.trim() === '') {
        return ''
      }
      return inicio.trim() + '-' + fin.trim()
    },
    /**
     * Pobla los seis campos de horario del closer desde la respuesta del servidor.
     *
     * @param {Object} data - Payload de GET/PUT con closer_horario_*.
     * @param {boolean} sync_stored - Si true, actualiza también stored para can_save.
     * @returns {void}
     */
    apply_closer_horario_from_api(data, sync_stored) {
      var lv = this.parse_horario_range(
        data.closer_horario_lunes_viernes !== undefined ? String(data.closer_horario_lunes_viernes) : ''
      )
      var sab = this.parse_horario_range(
        data.closer_horario_sabado !== undefined ? String(data.closer_horario_sabado) : ''
      )
      var dom = this.parse_horario_range(
        data.closer_horario_domingo !== undefined ? String(data.closer_horario_domingo) : ''
      )
      this.local.closer_lv_inicio = lv.inicio
      this.local.closer_lv_fin = lv.fin
      this.local.closer_sabado_inicio = sab.inicio
      this.local.closer_sabado_fin = sab.fin
      this.local.closer_domingo_inicio = dom.inicio
      this.local.closer_domingo_fin = dom.fin
      if (sync_stored) {
        this.stored.closer_lv_inicio = lv.inicio
        this.stored.closer_lv_fin = lv.fin
        this.stored.closer_sabado_inicio = sab.inicio
        this.stored.closer_sabado_fin = sab.fin
        this.stored.closer_domingo_inicio = dom.inicio
        this.stored.closer_domingo_fin = dom.fin
      }
    },
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
          var string_fields = ['recordatorio_manana_hora']
          /* Campos que se tratan como booleano. */
          var bool_fields = ['llamada_debe_terminar_en_horario']
          /* Campos que maneja apply_closer_horario_from_api — saltear en el forEach general. */
          var horario_closer_fields = [
            'closer_lv_inicio', 'closer_lv_fin',
            'closer_sabado_inicio', 'closer_sabado_fin',
            'closer_domingo_inicio', 'closer_domingo_fin',
          ]
          fields.forEach(function (key) {
            /* Los horarios del closer son strings; no pasarlos por parseInt (vacío → NaN). */
            if (horario_closer_fields.indexOf(key) !== -1) {
              return
            }
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
          /* Horarios del closer: el API devuelve strings H:i-H:i; mapear a inicio/fin separados. */
          self.apply_closer_horario_from_api(data, true)
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
          closer_horario_lunes_viernes:        self.build_horario_range(self.local.closer_lv_inicio, self.local.closer_lv_fin),
          closer_horario_sabado:               self.build_horario_range(self.local.closer_sabado_inicio, self.local.closer_sabado_fin),
          closer_horario_domingo:              self.build_horario_range(self.local.closer_domingo_inicio, self.local.closer_domingo_fin),
          frecuencia_slots_minutos:            self.local.frecuencia_slots_minutos,
          llamada_debe_terminar_en_horario:    self.local.llamada_debe_terminar_en_horario,
          ingreso_timeout_minutos:             self.local.ingreso_timeout_minutos,
          fin_seguimiento_minutos:             self.local.fin_seguimiento_minutos,
          fin_timeout_minutos:                 self.local.fin_timeout_minutos,
          pendiente_ingreso_horas_timeout:     self.local.pendiente_ingreso_horas_timeout,
        })
        .then(function (res) {
          /* Actualizar los valores de referencia para que can_save vuelva a false. */
          var data = res.data || {}
          var fields = Object.keys(self.local)
          /* Campos que se tratan como string (no entero). */
          var string_fields = ['recordatorio_manana_hora']
          /* Campos que se tratan como booleano. */
          var bool_fields = ['llamada_debe_terminar_en_horario']
          /* Campos que maneja apply_closer_horario_from_api — saltear en el forEach general. */
          var horario_closer_fields = [
            'closer_lv_inicio', 'closer_lv_fin',
            'closer_sabado_inicio', 'closer_sabado_fin',
            'closer_domingo_inicio', 'closer_domingo_fin',
          ]
          fields.forEach(function (key) {
            /* Los horarios del closer son strings; no pasarlos por parseInt (vacío → NaN). */
            if (horario_closer_fields.indexOf(key) !== -1) {
              return
            }
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
          /* Sincronizar horarios parseados desde la respuesta del PUT. */
          self.apply_closer_horario_from_api(data, true)
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
