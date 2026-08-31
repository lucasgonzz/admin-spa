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
          v-if="installation.status === 'instalando'"
          class="spinner-border spinner-border-sm text-warning ms-1"
          role="status"
        ></span>
        <span v-if="log_lines.length" class="badge text-bg-secondary small ms-1">{{ log_lines.length }}</span>
        <i class="bi ms-auto" :class="log_expanded ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
      </div>
      <div v-if="log_expanded" class="card-body p-0">
        <div
          ref="log_container"
          class="deployment-log-panel border-0 rounded-bottom bg-dark text-light small p-2"
        >
          <div
            v-for="(entry, idx) in log_lines"
            :key="idx"
            class="deployment-log-line"
            :class="'text-' + log_level_class(entry.level)"
          >
            <span class="text-muted">[{{ entry.step }}]</span>
            {{ entry.line }}
          </div>
          <div v-if="!log_lines.length && installation.status === 'instalando'" class="text-muted">
            Esperando líneas de log…
          </div>
          <div v-if="!log_lines.length && installation.status === 'pendiente'" class="text-muted">
            La corrida todavía está en la cola.
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== INSTALACIÓN DEL SISTEMA DE LA DEMO ==================== -->
    <div class="card border-primary border-opacity-25">
      <div class="card-header d-flex align-items-center gap-2 bg-primary bg-opacity-10">
        <i class="bi bi-hdd-stack text-primary"></i>
        <h6 class="mb-0 fw-semibold">Instalación del sistema de la demo</h6>
      </div>
      <div class="card-body">
        <sub-task-item
          v-for="item in checklist_items"
          :key="item.key"
          :label="item.label"
          :status="get_step_status(item.key)"
        />
      </div>
    </div>
  </div>
</template>

<script>
import SubTaskItem from '@/components/update/extra-props/operations/SubTaskItem.vue'

/**
 * Orden real de las etapas del pipeline de instalación de una demo (DemoInstallationService),
 * calcado del plan de la misión: es el orden de InstallationService pero resolviendo rutas con
 * DemoPathResolver y con dos etapas propias al final (run_demo_setup y verify).
 */
const LOG_STEPS_ORDER = [
  'prepare_dirs',
  'upload_public',
  'compile_spa',
  'upload_spa',
  'upload_api',
  'write_env',
  'finalize_api',
  'run_demo_setup',
  'verify',
]

/**
 * Ítems del checklist. `install_composer` no es una etapa del backend: ocurre adentro del tag
 * upload_api y se detecta por marcadores de texto (igual que en el panel de clientes), por eso
 * está en esta lista y no en LOG_STEPS_ORDER.
 */
const CHECKLIST = [
  { key: 'prepare_dirs',    label: 'Preparar directorios' },
  { key: 'upload_public',   label: 'Subir public/' },
  { key: 'compile_spa',     label: 'Compilar SPA' },
  { key: 'upload_spa',      label: 'Subir SPA al hosting' },
  { key: 'upload_api',      label: 'Subir API al hosting' },
  { key: 'install_composer', label: 'Instalar composer' },
  { key: 'write_env',       label: 'Escribir .env' },
  { key: 'finalize_api',    label: 'Finalizar API' },
  { key: 'run_demo_setup',  label: 'Correr demo-setup (vacía la base de la demo)' },
  { key: 'verify',          label: 'Verificar que la demo responde' },
]

/** Marcador de inicio de "composer install" adentro del tag upload_api. */
const COMPOSER_START_MARKER = 'Corriendo composer install en la demo'

/** Marcador de fin de "composer install" adentro del tag upload_api. */
const COMPOSER_DONE_MARKER = 'API lista en el servidor de la demo'

/**
 * Panel de operaciones de una instalación de sistema de demo: log en vivo (colapsable, con
 * auto-scroll) + checklist de las etapas del pipeline.
 *
 * 🔴 El log viene en `installation.logs`: una fila por línea (`DemoInstallationLog`), cargada por
 * `DemoInstallation::scopeWithAll()`. NO es `deployment_logs` (eso es de ClientInstallation) ni el
 * campo de texto `log` (eso es de DemoUpdate, y es el diseño que este pipeline evitó a propósito
 * porque ya desbordó una columna TEXT y dejó corridas colgadas para siempre).
 *
 * Esta pantalla se programó en paralelo con el backend, contra un contrato que todavía no existía,
 * y adivinó los otros dos nombres: el panel se quedaba en "Esperando líneas de log…" durante los
 * treinta minutos del pipeline y el checklist entero en gris, que es exactamente el rato en que no
 * se puede estar a ciegas sobre una corrida que hace `migrate:fresh`. Si alguna vez hay que
 * soportar otra forma, que sea agregando, no adivinando.
 */
export default {
  name: 'DemoInstallationOperationsPanel',

  components: { SubTaskItem },

  props: {
    /** Objeto completo de la DemoInstallation (status, logs, fechas, failure_reason). */
    installation: { type: Object, required: true },
  },

  data() {
    return {
      /** Controla si el panel de log está expandido o colapsado. */
      log_expanded: this.installation.status === 'instalando',
    }
  },

  computed: {
    /**
     * Líneas del log de la corrida, tal como las devuelve el backend.
     *
     * @returns {Array<{step: string, line: string, level: string}>}
     */
    log_lines() {
      return Array.isArray(this.installation.logs) ? this.installation.logs : []
    },

    /**
     * Ítems del checklist (constante de módulo, expuesta al template).
     *
     * @returns {Array<{key: string, label: string}>}
     */
    checklist_items() {
      return CHECKLIST
    },
  },

  watch: {
    /**
     * Abre el log automáticamente cuando la corrida pasa a 'instalando'.
     *
     * @param {string} new_status
     * @returns {void}
     */
    'installation.status'(new_status) {
      if (new_status === 'instalando') {
        this.log_expanded = true
      }
    },

    /**
     * Hace scroll al final del log cada vez que llegan líneas nuevas (el polling reemplaza el
     * objeto entero, lo que dispara este watcher).
     *
     * @returns {void}
     */
    log_lines() {
      if (this.log_expanded) {
        this.scroll_log_to_bottom()
      }
    },
  },

  methods: {

    /**
     * ¿Esta etapa tiene al menos una línea registrada?
     *
     * @param {string} step
     * @returns {boolean}
     */
    has_logs_for(step) {
      return this.log_lines.some(function (l) { return l.step === step })
    },

    /**
     * Líneas del tag upload_api (donde corre composer install).
     *
     * @returns {Array}
     */
    upload_api_lines() {
      return this.log_lines.filter(function (l) { return l.step === 'upload_api' })
    },

    /**
     * ¿El log ya tiene el marcador de inicio de composer install?
     *
     * @returns {boolean}
     */
    composer_started() {
      return this.upload_api_lines().some(function (l) {
        return String(l.line).indexOf(COMPOSER_START_MARKER) !== -1
      })
    },

    /**
     * ¿El log ya tiene el marcador de fin de composer install?
     *
     * @returns {boolean}
     */
    composer_done() {
      return this.upload_api_lines().some(function (l) {
        return String(l.line).indexOf(COMPOSER_DONE_MARKER) !== -1
      })
    },

    /**
     * Estado visual de un ítem del checklist, derivado del log.
     *
     * @param {string} key Una key de CHECKLIST.
     * @returns {string} 'pending' | 'running' | 'completed' | 'failed'
     */
    get_step_status(key) {
      /* Corrida completada: todo en verde, sin importar el detalle del log. */
      if (this.installation.status === 'completada') {
        return 'completed'
      }

      /* Sub-paso derivado adentro de upload_api (ver marcadores de arriba). */
      if (key === 'install_composer') {
        if (this.composer_done()) return 'completed'
        if (this.composer_started()) {
          return this.installation.status === 'fallida' ? 'failed' : 'running'
        }
        return 'pending'
      }

      /* upload_api se da por terminado apenas arranca composer: es lo último que hace ese step. */
      if (key === 'upload_api') {
        if (this.composer_started()) return 'completed'
        if (this.has_logs_for('upload_api')) {
          return this.installation.status === 'fallida' ? 'failed' : 'running'
        }
        return 'pending'
      }

      /*
        El resto se completa cuando la etapa siguiente ya tiene logs propios. La última (verify)
        no tiene siguiente que la confirme: cae sola en 'running'/'failed' y su caso feliz lo
        cubre el early-return de 'completada' de arriba.
      */
      const idx = LOG_STEPS_ORDER.indexOf(key)
      const next = idx !== -1 ? LOG_STEPS_ORDER[idx + 1] : null
      const next_has_logs = next ? this.has_logs_for(next) : false
      if (!this.has_logs_for(key)) return 'pending'
      if (next_has_logs) return 'completed'
      return this.installation.status === 'fallida' ? 'failed' : 'running'
    },

    /**
     * Clase de color Bootstrap según el nivel de la línea de log.
     *
     * @param {string} level
     * @returns {string}
     */
    log_level_class(level) {
      if (level === 'error') return 'danger'
      if (level === 'success') return 'success'
      return 'light'
    },

    /**
     * Mantiene visible la última línea del log entre vueltas del polling.
     *
     * @returns {void}
     */
    scroll_log_to_bottom() {
      const self = this
      self.$nextTick(function () {
        const el = self.$refs.log_container
        if (el) {
          el.scrollTop = el.scrollHeight
        }
      })
    },
  },
}
</script>

<style scoped>
/* Panel de log en vivo, calcado del equivalente de demo_update / installation. */
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
