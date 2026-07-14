<template>
  <div>
    <!-- ==================== LOG EN VIVO ==================== -->
    <div class="card border-secondary border-opacity-25 mb-3">
      <div
        class="card-header d-flex align-items-center gap-2 py-2"
        style="cursor: pointer; user-select: none"
        @click="log_expanded = !log_expanded"
      >
        <i class="bi bi-terminal text-secondary"></i>
        <span class="small fw-semibold">Log en vivo</span>
        <span
          v-if="demo_update.status === 'ejecutandose'"
          class="spinner-border spinner-border-sm text-warning ms-1"
          role="status"
        ></span>
        <span v-if="parsed_lines.length" class="badge text-bg-secondary small ms-1">{{ parsed_lines.length }}</span>
        <i class="bi ms-auto" :class="log_expanded ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
      </div>
      <div v-if="log_expanded" class="card-body p-0">
        <div
          ref="log_container"
          class="deployment-log-panel border-0 rounded-bottom bg-dark text-light small p-2"
        >
          <div
            v-for="(entry, idx) in parsed_lines"
            :key="idx"
            class="deployment-log-line"
            :class="'text-' + log_level_class(entry.level)"
          >
            <span class="text-muted">[{{ entry.timestamp }}]</span>
            {{ entry.line }}
          </div>
          <div v-if="!parsed_lines.length && demo_update.status === 'ejecutandose'" class="text-muted">
            Esperando líneas de log…
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== ACTUALIZACIÓN DE LA DEMO ==================== -->
    <div class="card border-primary border-opacity-25">
      <div class="card-header d-flex align-items-center gap-2 bg-primary bg-opacity-10">
        <i class="bi bi-cloud-upload text-primary"></i>
        <h6 class="mb-0 fw-semibold">Actualización de la demo</h6>
      </div>
      <div class="card-body">
        <sub-task-item label="Compilar SPA" :status="get_step_status('compile_spa')" />
        <sub-task-item label="Subir SPA al hosting" :status="get_step_status('upload_spa')" />
        <sub-task-item label="Subir API al hosting" :status="get_step_status('upload_api')" />
        <sub-task-item label="Instalar composer" :status="get_step_status('install_composer')" />
        <sub-task-item label="Migraciones" :status="get_step_status('run_migrations')" />
      </div>
    </div>
  </div>
</template>

<script>
import SubTaskItem from '@/components/update/extra-props/operations/SubTaskItem.vue'

/** Orden de las etapas de log del pipeline de DemoUpdate. */
var LOG_STEPS_ORDER = ['compile_spa', 'upload_spa', 'upload_api', 'run_migrations']

/** Marcador de inicio de "composer install" dentro del tag upload_api. */
var COMPOSER_START_MARKER = 'Corriendo composer install en hosting'

/** Marcador de fin de "composer install" dentro del tag upload_api. */
var COMPOSER_DONE_MARKER = 'API lista en el hosting'

/**
 * Panel de operaciones de una actualización de demo: log en vivo + checklist de 4 pasos.
 * El checklist deriva su estado del log parseado (no hay tabla de sub-pasos en backend).
 */
export default {
  name: 'DemoUpdateOperationsPanel',
  components: { SubTaskItem },
  props: {
    /** Objeto completo del DemoUpdate (campos: log, status, started_at, finished_at). */
    demo_update: { type: Object, required: true },
  },
  data() {
    return {
      /** Controla si el panel de log está expandido o colapsado. */
      log_expanded: this.demo_update.status === 'ejecutandose',
    }
  },
  computed: {
    /**
     * Líneas del campo log parseadas como array de objetos { timestamp, step, line, level }.
     * Formato de cada línea: [HH:mm:ss] [step_name] mensaje
     *
     * @returns {Array<{timestamp: string, step: string, line: string, level: string}>}
     */
    parsed_lines() {
      var regex = /^\[(\d{2}:\d{2}:\d{2})\]\s+\[(\w+)\]\s*(.*)$/
      var raw_log = this.demo_update.log || ''
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

        var timestamp = match[1]
        var step = match[2]
        var line = match[3]

        var level = 'info'
        if (line.indexOf('ERROR:') !== -1 || line.toLowerCase().indexOf('fallido') !== -1) {
          level = 'error'
        }

        result.push({ timestamp: timestamp, step: step, line: line, level: level })
      })

      return result
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
     * Indica si una etapa de log tiene al menos una línea registrada.
     * @param {string} step
     * @returns {boolean}
     */
    has_logs_for(step) {
      return this.parsed_lines.some(function (l) { return l.step === step })
    },
    /**
     * Líneas de log pertenecientes al tag upload_api.
     * @returns {Array}
     */
    upload_api_lines() {
      return this.parsed_lines.filter(function (l) { return l.step === 'upload_api' })
    },
    /**
     * Indica si el log ya contiene el marcador de inicio de composer install.
     * @returns {boolean}
     */
    composer_started() {
      return this.upload_api_lines().some(function (l) {
        return l.line.indexOf(COMPOSER_START_MARKER) !== -1
      })
    },
    /**
     * Indica si el log ya contiene el marcador de fin de composer install.
     * @returns {boolean}
     */
    composer_done() {
      return this.upload_api_lines().some(function (l) {
        return l.line.indexOf(COMPOSER_DONE_MARKER) !== -1
      })
    },
    /**
     * Determina el estado visual de un ítem del checklist a partir del log parseado.
     *
     * @param {string} key - 'compile_spa' | 'upload_spa' | 'upload_api' | 'install_composer' | 'run_migrations'
     * @returns {string} - 'pending' | 'running' | 'completed' | 'failed'
     */
    get_step_status(key) {
      if (this.demo_update.status === 'completado') {
        return 'completed'
      }
      if (key === 'install_composer') {
        if (this.composer_done()) return 'completed'
        if (this.composer_started()) {
          return this.demo_update.status === 'fallido' ? 'failed' : 'running'
        }
        return 'pending'
      }
      if (key === 'upload_api') {
        if (this.composer_started()) return 'completed'
        if (this.has_logs_for('upload_api')) {
          return this.demo_update.status === 'fallido' ? 'failed' : 'running'
        }
        return 'pending'
      }
      /* run_migrations: es la última etapa del pipeline, no hay etapa siguiente cuyos logs indiquen
         que terminó. El early-return de 'completado' ya cubre el caso feliz; acá se distinguen
         'ejecutandose' y 'fallido' en base a si ya empezó a loguear. */
      if (key === 'run_migrations') {
        if (!this.has_logs_for('run_migrations')) return 'pending'
        if (this.demo_update.status === 'fallido') return 'failed'
        if (this.demo_update.status === 'completado') return 'completed'
        return 'running'
      }
      /* compile_spa / upload_spa: se completan cuando el siguiente tag del pipeline ya tiene logs */
      var idx = LOG_STEPS_ORDER.indexOf(key)
      var next = LOG_STEPS_ORDER[idx + 1]
      var next_has_logs = next ? this.has_logs_for(next) : false
      if (!this.has_logs_for(key)) return 'pending'
      if (next_has_logs) return 'completed'
      return this.demo_update.status === 'fallido' ? 'failed' : 'running'
    },
    /**
     * Clase de color Bootstrap según nivel del log (info, error).
     *
     * @param {string} level
     * @returns {string}
     */
    log_level_class(level) {
      if (level === 'error') return 'danger'
      return 'light'
    },
    /**
     * Mantiene visible la última línea del log al actualizar el polling.
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
.deployment-log-panel {
  max-height: 260px;
  overflow-y: auto;
  font-family: ui-monospace, monospace;
  font-size: 0.75rem;
  line-height: 1.35;
  border-radius: 0 0 0.375rem 0.375rem;
}
.deployment-log-line {
  white-space: pre-wrap;
  word-break: break-word;
  margin-bottom: 0.15rem;
}
</style>
