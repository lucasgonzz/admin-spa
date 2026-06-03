<template>
  <!-- Ítem de sub-tarea: muestra ícono de estado, etiqueta y detalle de error si aplica -->
  <div class="d-flex align-items-start gap-2 py-1">
    <!-- Ícono según estado: pendiente / en curso / completado / fallido -->
    <div class="sub-task-icon flex-shrink-0 mt-1">
      <i v-if="status === 'completed'" class="bi bi-check-circle-fill text-success"></i>
      <i v-else-if="status === 'failed'" class="bi bi-x-circle-fill text-danger"></i>
      <i v-else-if="status === 'running'" class="bi bi-arrow-repeat text-warning rotating-icon"></i>
      <i v-else class="bi bi-circle text-muted"></i>
    </div>

    <div class="flex-grow-1 min-w-0">
      <!-- Etiqueta principal del sub-paso -->
      <span
        class="small"
        :class="{
          'text-success fw-semibold': status === 'completed',
          'text-danger': status === 'failed',
          'text-warning fw-semibold': status === 'running',
          'text-muted': status === 'pending',
        }"
      >
        {{ label }}
      </span>

      <span
        v-if="version_label"
        class="badge text-bg-light border text-muted ms-1 small"
        title="Versión del producto"
      >
        v{{ version_label }}
      </span>

      <!-- Badge de scope (per_user / per_database) si aplica -->
      <span
        v-if="scope_label"
        class="badge ms-1 small"
        :class="scope_badge_class"
        :title="scope_title"
      >
        {{ scope_label }}
      </span>

      <!-- Badge de ejecución manual (omitido por deployment automatizado) -->
      <span
        v-if="is_manual"
        class="badge text-bg-warning ms-1 small"
        title="Este comando no se ejecuta por deployment; debe correrse manualmente"
      >
        Manual
      </span>

      <!-- Detalles adicionales opcionales (descripción, clase del seeder, etc.) -->
      <div v-if="detail" class="text-muted" style="font-size: 0.7rem; font-family: monospace">
        {{ detail }}
      </div>

      <!-- Notas de fallo cuando el sub-paso falló -->
      <div v-if="status === 'failed' && failure_notes" class="text-danger mt-1" style="font-size: 0.72rem">
        <i class="bi bi-exclamation-circle me-1"></i>{{ failure_notes }}
      </div>

      <!-- Salida de consola del comando/seeder (colapsable) -->
      <div v-if="console_logs.length" class="mt-1">
        <button
          type="button"
          class="btn btn-link btn-sm p-0 text-decoration-none sub-task-console-toggle"
          @click="console_expanded = !console_expanded"
        >
          <i class="bi bi-terminal me-1"></i>
          {{ console_expanded ? 'Ocultar consola' : 'Ver consola' }}
          <span class="badge text-bg-secondary ms-1">{{ console_logs.length }}</span>
        </button>
        <div
          v-if="console_expanded"
          ref="console_container"
          class="sub-task-console-panel border rounded bg-dark text-light p-2 mt-1"
        >
          <div
            v-for="(log_line, log_index) in console_logs"
            :key="log_index"
            class="sub-task-console-line"
            :class="'text-' + log_level_class(log_line.level)"
          >
            {{ log_line.line }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { deployment_log_level_class } from '@/utils/deployment_item_logs'

/**
 * Sub-ítem de tarea dentro del tablero de operaciones.
 * Muestra ícono de estado (pending/running/completed/failed), scope badge,
 * notas de error y salida de consola del deployment.
 */
export default {
  name: 'SubTaskItem',
  props: {
    /** Etiqueta visible del sub-paso. */
    label: { type: String, required: true },
    /**
     * Estado del sub-paso.
     * @values 'pending', 'running', 'completed', 'failed'
     */
    status: { type: String, default: 'pending' },
    /** Texto secundario en fuente monospace (ej: clase del seeder, comando artisan). */
    detail: { type: String, default: '' },
    /** Número de versión del producto al que pertenece el seeder/comando. */
    version_label: { type: String, default: '' },
    /** Mensaje de error cuando status === 'failed'. */
    failure_notes: { type: String, default: '' },
    /**
     * Scope de ejecución: 'per_user' | 'per_database' | null.
     * Si se proporciona, muestra un badge informativo.
     */
    run_scope: { type: String, default: null },
    /** Líneas de log de consola asociadas a este seeder/comando. */
    console_logs: { type: Array, default: () => [] },
    /** Si el ítem está configurado como ejecución manual en la versión. */
    is_manual: { type: Boolean, default: false },
  },
  data() {
    return {
      /** Controla si el panel de consola está expandido. */
      console_expanded: false,
    }
  },
  computed: {
    /**
     * Etiqueta corta del scope.
     * @returns {string}
     */
    scope_label() {
      if (this.run_scope === 'per_user') return 'Por usuario'
      if (this.run_scope === 'per_database') return 'Por BD'
      return ''
    },
    /**
     * Clase Bootstrap del badge de scope.
     * @returns {string}
     */
    scope_badge_class() {
      return this.run_scope === 'per_database' ? 'text-bg-secondary' : 'text-bg-info'
    },
    /**
     * Tooltip descriptivo del scope.
     * @returns {string}
     */
    scope_title() {
      if (this.run_scope === 'per_user') return 'Se debe ejecutar una vez por cada usuario/tenant'
      if (this.run_scope === 'per_database') return 'Se ejecuta una sola vez por base de datos'
      return ''
    },
  },
  watch: {
    /**
     * Expande la consola mientras el ítem está en ejecución; colapsa al terminar.
     *
     * @param {string} new_status
     * @returns {void}
     */
    status(new_status) {
      if (new_status === 'running' || new_status === 'failed') {
        this.console_expanded = true
        this.scroll_console_to_bottom()
      }
    },
    /**
     * Auto-scroll al agregar nuevas líneas mientras la consola está visible.
     *
     * @returns {void}
     */
    console_logs: {
      handler() {
        if (this.console_expanded) {
          this.scroll_console_to_bottom()
        }
      },
      deep: true,
    },
  },
  mounted() {
    if (
      (this.status === 'running' || this.status === 'failed') &&
      this.console_logs.length
    ) {
      this.console_expanded = true
      this.scroll_console_to_bottom()
    }
  },
  methods: {
    /**
     * Clase de color según nivel del log (info, success, error).
     *
     * @param {string} level
     * @returns {string}
     */
    log_level_class(level) {
      return deployment_log_level_class(level)
    },
    /**
     * Mantiene visible la última línea del panel de consola.
     *
     * @returns {void}
     */
    scroll_console_to_bottom() {
      var self = this
      self.$nextTick(function () {
        var el = self.$refs.console_container
        if (el) {
          el.scrollTop = el.scrollHeight
        }
      })
    },
  },
}
</script>

<style scoped>
/* Animación de rotación para el ícono "en curso" */
.rotating-icon {
  display: inline-block;
  animation: spin 1.2s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.sub-task-icon {
  width: 1rem;
  text-align: center;
}
.sub-task-console-toggle {
  font-size: 0.72rem;
}
.sub-task-console-panel {
  max-height: 180px;
  overflow-y: auto;
  font-family: ui-monospace, monospace;
  font-size: 0.68rem;
  line-height: 1.35;
}
.sub-task-console-line {
  white-space: pre-wrap;
  word-break: break-word;
  margin-bottom: 0.12rem;
}
</style>
