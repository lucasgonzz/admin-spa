<template>
  <!-- Panel de progreso por etapas para un DemoUpdate -->
  <div>

    <!-- ===== TARJETA DE RESUMEN SUPERIOR ===== -->
    <div class="card border-secondary border-opacity-25 mb-3">
      <div class="card-body py-2 px-3 d-flex align-items-center flex-wrap gap-3">

        <!-- Badge de estado del pipeline -->
        <span class="badge" :class="status_badge_class">
          <!-- Spinner inline cuando está ejecutando -->
          <span
            v-if="demo_update.status === 'ejecutandose'"
            class="spinner-border spinner-border-sm me-1"
            role="status"
            aria-hidden="true"
          ></span>
          {{ status_label }}
        </span>

        <!-- Hora de inicio si está disponible -->
        <span v-if="demo_update.started_at" class="small text-muted">
          <i class="bi bi-play-circle me-1"></i>Inicio: {{ format_time(demo_update.started_at) }}
        </span>

        <!-- Duración total si ya terminó -->
        <span v-if="demo_update.started_at && demo_update.finished_at" class="small text-muted">
          <i class="bi bi-clock me-1"></i>{{ duration_seconds }} seg
        </span>
      </div>
    </div>

    <!-- ===== 4 SUB-TASK ITEMS DE ETAPAS ===== -->
    <div class="card border-secondary border-opacity-25 mb-3">
      <div class="card-body py-2 px-3">
        <!-- Etapa 1: Compilar empresa-spa -->
        <div class="d-flex align-items-start gap-2 py-1">
          <div class="step-icon flex-shrink-0 mt-1">
            <i :class="step_icon_class('compile_spa')"></i>
          </div>
          <span class="small" :class="step_label_class('compile_spa')">Compilar empresa-spa</span>
        </div>

        <!-- Etapa 2: Subir SPA al hosting -->
        <div class="d-flex align-items-start gap-2 py-1">
          <div class="step-icon flex-shrink-0 mt-1">
            <i :class="step_icon_class('upload_spa')"></i>
          </div>
          <span class="small" :class="step_label_class('upload_spa')">Subir SPA al hosting</span>
        </div>

        <!-- Etapa 3: Subir API al hosting -->
        <div class="d-flex align-items-start gap-2 py-1">
          <div class="step-icon flex-shrink-0 mt-1">
            <i :class="step_icon_class('upload_api')"></i>
          </div>
          <span class="small" :class="step_label_class('upload_api')">Subir API al hosting</span>
        </div>

        <!-- Etapa 4: Demo setup (reset de datos) -->
        <div class="d-flex align-items-start gap-2 py-1">
          <div class="step-icon flex-shrink-0 mt-1">
            <i :class="step_icon_class('run_demo_setup')"></i>
          </div>
          <span class="small" :class="step_label_class('run_demo_setup')">Demo setup (reset de datos)</span>
        </div>
      </div>
    </div>

    <!-- ===== PANEL DE LOG COLAPSABLE ===== -->
    <!-- Solo visible si hay al menos una línea de log -->
    <div v-if="parsed_lines.length" class="card border-secondary border-opacity-25">
      <!-- Header clickeable para colapsar/expandir -->
      <div
        class="card-header d-flex align-items-center gap-2 py-2"
        style="cursor: pointer; user-select: none"
        @click="log_expanded = !log_expanded"
      >
        <i class="bi bi-terminal text-secondary"></i>
        <span class="small fw-semibold">Log en vivo</span>
        <!-- Spinner cuando el pipeline está ejecutándose -->
        <span
          v-if="demo_update.status === 'ejecutandose'"
          class="spinner-border spinner-border-sm text-warning ms-1"
          role="status"
        ></span>
        <!-- Contador de líneas -->
        <span class="badge text-bg-secondary small ms-1">{{ parsed_lines.length }}</span>
        <!-- Chevron de colapso -->
        <i class="bi ms-auto" :class="log_expanded ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
      </div>

      <!-- Cuerpo del log colapsable -->
      <div v-if="log_expanded" class="card-body p-0">
        <div
          ref="log_container"
          class="demo-update-log-panel border-0 rounded-bottom bg-dark text-light small p-2"
        >
          <!-- Una línea por cada entrada del log parseado -->
          <div
            v-for="(entry, idx) in parsed_lines"
            :key="idx"
            class="demo-update-log-line"
            :class="log_line_class(entry.level)"
          >
            <!-- Timestamp en gris -->
            <span class="text-muted">[{{ entry.timestamp }}]</span>
            <!-- Contenido de la línea -->
            {{ entry.line }}
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script>
/**
 * Orden de las etapas del pipeline de DemoUpdate.
 * Se usa para determinar el estado de cada etapa a partir del log.
 */
var STEPS_ORDER = ['compile_spa', 'upload_spa', 'upload_api', 'run_demo_setup']

/**
 * Panel de progreso por etapas para un DemoUpdate.
 * Muestra el estado del pipeline (pendiente/ejecutandose/completado/fallido),
 * 4 sub-tareas con íconos animados y un log colapsable en tiempo real.
 *
 * @prop {Object} demo_update - Objeto completo del DemoUpdate (campos: log, status, started_at, finished_at).
 */
export default {
  name: 'DemoUpdateProgressPanel',

  props: {
    /** Objeto completo del DemoUpdate con campos log, status, started_at y finished_at. */
    demo_update: { type: Object, required: true },
  },

  data() {
    return {
      /**
       * Controla si el panel de log está expandido.
       * Se abre automáticamente cuando el pipeline está ejecutándose.
       */
      log_expanded: this.demo_update.status === 'ejecutandose',
    }
  },

  computed: {
    /**
     * Clase Bootstrap del badge de estado del pipeline.
     * @returns {string}
     */
    status_badge_class() {
      var status = this.demo_update.status
      if (status === 'pendiente') return 'text-bg-secondary'
      if (status === 'ejecutandose') return 'text-bg-warning'
      if (status === 'completado') return 'text-bg-success'
      if (status === 'fallido') return 'text-bg-danger'
      return 'text-bg-secondary'
    },

    /**
     * Texto visible del badge de estado.
     * @returns {string}
     */
    status_label() {
      var status = this.demo_update.status
      if (status === 'pendiente') return 'Pendiente'
      if (status === 'ejecutandose') return 'Ejecutando...'
      if (status === 'completado') return 'Completado'
      if (status === 'fallido') return 'Fallido'
      return status || 'Desconocido'
    },

    /**
     * Duración total del pipeline en segundos (desde started_at hasta finished_at).
     * @returns {number}
     */
    duration_seconds() {
      if (!this.demo_update.started_at || !this.demo_update.finished_at) {
        return 0
      }
      var start = new Date(this.demo_update.started_at).getTime()
      var end = new Date(this.demo_update.finished_at).getTime()
      return Math.round((end - start) / 1000)
    },

    /**
     * Líneas del campo log parseadas como array de objetos { timestamp, step, line, level }.
     * El campo log es texto plano con formato: [HH:mm:ss] [step_name] mensaje
     * @returns {Array<{timestamp: string, step: string, line: string, level: string}>}
     */
    parsed_lines() {
      return this.parse_log_lines()
    },
  },

  watch: {
    /**
     * Abre el log automáticamente cuando el pipeline pasa a ejecutándose.
     * @param {string} new_status
     * @returns {void}
     */
    'demo_update.status'(new_status) {
      if (new_status === 'ejecutandose') {
        this.log_expanded = true
      }
    },

    /**
     * Hace scroll al final del log cada vez que llegan nuevas líneas.
     * @returns {void}
     */
    parsed_lines() {
      if (this.log_expanded) {
        this.scroll_log_to_bottom()
      }
    },
  },

  methods: {
    /**
     * Parsea el campo log del DemoUpdate en un array de entradas estructuradas.
     * Formato esperado de cada línea: [HH:mm:ss] [step_name] mensaje
     *
     * @returns {Array<{timestamp: string, step: string, line: string, level: string}>}
     */
    parse_log_lines() {
      /* Regex para parsear el formato de línea del DemoUpdateService */
      var regex = /^\[(\d{2}:\d{2}:\d{2})\]\s+\[(\w+)\]\s*(.*)$/

      /* Texto crudo del log (puede ser null o vacío) */
      var raw_log = this.demo_update.log || ''

      /* Array final de entradas parseadas */
      var result = []

      raw_log.split('\n').forEach(function (raw_line) {
        var trimmed = raw_line.trim()
        if (!trimmed) {
          return
        }

        var match = trimmed.match(regex)
        if (!match) {
          return
        }

        /* Componentes de la línea */
        var timestamp = match[1]
        var step = match[2]
        var line = match[3]

        /* Nivel de la línea: error si contiene ERROR:, success si es el último paso completado */
        var level = 'info'
        if (line.indexOf('ERROR:') !== -1 || line.toLowerCase().indexOf('fallido') !== -1) {
          level = 'error'
        } else if (step === 'run_demo_setup' && line.toLowerCase().indexOf('completado') !== -1) {
          level = 'success'
        }

        result.push({ timestamp: timestamp, step: step, line: line, level: level })
      })

      return result
    },

    /**
     * Determina el estado visual de una etapa del pipeline.
     * La lógica infiere el estado a partir del log parseado y el status global.
     *
     * @param {string} step_name - Nombre de la etapa (ej: 'compile_spa').
     * @returns {string} - 'pending' | 'running' | 'completed' | 'failed'
     */
    get_step_status(step_name) {
      /* Verificar si la etapa tiene al menos una línea de log */
      var has_logs = this.parsed_lines.some(function (l) {
        return l.step === step_name
      })

      /* Índice de la etapa y nombre de la siguiente */
      var idx = STEPS_ORDER.indexOf(step_name)
      var next = STEPS_ORDER[idx + 1]

      /* Verificar si la etapa siguiente ya tiene logs (implica que ésta terminó) */
      var next_has_logs = next ? this.parsed_lines.some(function (l) {
        return l.step === next
      }) : false

      /* Si el pipeline completó exitosamente, todas las etapas están completadas */
      if (this.demo_update.status === 'completado') {
        return 'completed'
      }

      /* Sin logs: etapa todavía pendiente */
      if (!has_logs) {
        return 'pending'
      }

      /* Si la siguiente etapa ya tiene logs, ésta terminó bien */
      if (next_has_logs) {
        return 'completed'
      }

      /* Si el pipeline falló y es la última etapa con logs, marcamos como fallida */
      if (this.demo_update.status === 'fallido') {
        return 'failed'
      }

      /* Tiene logs y es la etapa activa */
      return 'running'
    },

    /**
     * Clase del ícono Bootstrap Icons según el estado de una etapa.
     *
     * @param {string} step_name - Nombre de la etapa.
     * @returns {string} - Clases CSS del ícono.
     */
    step_icon_class(step_name) {
      var status = this.get_step_status(step_name)
      if (status === 'completed') return 'bi bi-check-circle-fill text-success'
      if (status === 'failed') return 'bi bi-x-circle-fill text-danger'
      if (status === 'running') return 'bi bi-arrow-repeat text-warning rotating-icon'
      return 'bi bi-circle text-muted'
    },

    /**
     * Clase del texto de etiqueta de una etapa según su estado.
     *
     * @param {string} step_name - Nombre de la etapa.
     * @returns {string} - Clases CSS para el texto.
     */
    step_label_class(step_name) {
      var status = this.get_step_status(step_name)
      if (status === 'completed') return 'text-success fw-semibold'
      if (status === 'failed') return 'text-danger'
      if (status === 'running') return 'text-warning fw-semibold'
      return 'text-muted'
    },

    /**
     * Clase de color Bootstrap para una línea de log según su nivel.
     *
     * @param {string} level - Nivel: 'error' | 'success' | 'info'.
     * @returns {string} - Clase CSS de color.
     */
    log_line_class(level) {
      if (level === 'error') return 'text-danger'
      if (level === 'success') return 'text-success'
      return 'text-light'
    },

    /**
     * Formatea un timestamp ISO como HH:mm:ss.
     *
     * @param {string|null} iso_date - Fecha en formato ISO.
     * @returns {string}
     */
    format_time(iso_date) {
      if (!iso_date) {
        return ''
      }
      var d = new Date(iso_date)
      return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    },

    /**
     * Hace scroll al final del panel de log para seguir la ejecución en tiempo real.
     *
     * @returns {void}
     */
    scroll_log_to_bottom() {
      var self = this
      self.$nextTick(function () {
        var el = self.$refs.log_container
        if (el) {
          el.scrollTop = el.scrollHeight
        }
      })
    },
  },
}
</script>

<style scoped>
/* Panel de log en vivo */
.demo-update-log-panel {
  max-height: 260px;
  overflow-y: auto;
  font-family: ui-monospace, monospace;
  font-size: 0.75rem;
  line-height: 1.35;
  border-radius: 0 0 0.375rem 0.375rem;
}
.demo-update-log-line {
  white-space: pre-wrap;
  word-break: break-word;
  margin-bottom: 0.15rem;
}

/* Animación del ícono "en curso" */
.rotating-icon {
  display: inline-block;
  animation: spin 1.2s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.step-icon {
  width: 1rem;
  text-align: center;
}
</style>
