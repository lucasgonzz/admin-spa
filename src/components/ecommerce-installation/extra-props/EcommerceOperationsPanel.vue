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
        </div>
      </div>
    </div>

    <!-- ==================== CHECKLIST DE ETAPAS DEL PIPELINE ==================== -->
    <div class="card border-primary border-opacity-25">
      <div class="card-header d-flex align-items-center gap-2 bg-primary bg-opacity-10">
        <i class="bi bi-hdd-stack text-primary"></i>
        <h6 class="mb-0 fw-semibold">
          {{ installation.mode === 'update' ? 'Actualización de la tienda' : 'Instalación de la tienda' }}
        </h6>
      </div>
      <div class="card-body">
        <sub-task-item label="Clonar/actualizar tienda-spa" :status="get_step_status('ensure_spa_cloned')" />
        <sub-task-item label="Compilar SPA (branding + build)" :status="get_step_status('compile_spa')" />
        <sub-task-item label="Subir SPA al hosting" :status="get_step_status('upload_spa')" />
        <sub-task-item label="Subir API al hosting" :status="get_step_status('upload_api')" />
        <sub-task-item label="Instalar composer" :status="get_step_status('composer_install')" />
        <!--
          write_env solo corre en instalaciones desde cero (mode='install'): una actualización
          nunca re-crea el .env ya existente (ver EcommerceDeploymentService::$steps). Se muestra
          igual como "Saltado" para no romper la forma del checklist entre install/update.
        -->
        <sub-task-item
          label="Escribir .env"
          :status="get_step_status('write_env')"
          :is_skipped="installation.mode === 'update'"
        />
        <sub-task-item label="Finalizar" :status="get_step_status('finalize')" />
      </div>
    </div>
  </div>
</template>

<script>
import SubTaskItem from '@/components/update/extra-props/operations/SubTaskItem.vue'
import { deployment_log_level_class } from '@/utils/deployment_item_logs'

/**
 * Orden real de las etapas del pipeline de instalación/actualización del ecommerce
 * (ClientEcommerceInstallation), calcado de EcommerceInstallationService::class (prompt 584)
 * y de las etapas que reutiliza EcommerceDeploymentService (prompt 585, sin write_env).
 */
var LOG_STEPS_ORDER = ['ensure_spa_cloned', 'compile_spa', 'upload_spa', 'upload_api', 'write_env', 'finalize']

/**
 * "Instalar composer" no es una etapa propia del backend: ocurre dentro del tag upload_api,
 * igual que en el pipeline de empresa. Se detecta por estos dos marcadores de texto,
 * verificados contra EcommerceInstallationService.php (step_upload_api, líneas con tag 'upload_api').
 */
var COMPOSER_START_MARKER = 'Corriendo composer install en hosting'
var COMPOSER_DONE_MARKER = 'tienda-api lista en el hosting'

/**
 * Panel de operaciones de una corrida de instalación/actualización del ecommerce: log en vivo
 * (colapsable, auto-scroll) + checklist de las etapas del pipeline (SubTaskItem, reutilizado
 * del panel de actualización de empresa), con estado derivado directamente del campo `step`
 * de cada EcommerceDeploymentLog. Espeja InstallationOperationsPanel.vue (empresa) 1 a 1.
 */
export default {
  name: 'EcommerceInstallationOperationsPanel',
  components: { SubTaskItem },
  props: {
    /** Objeto completo de la ClientEcommerceInstallation (status, mode, deployment_logs, etc). */
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
     * Líneas de log de la corrida. Ya vienen estructuradas como { step, line, level }
     * desde el backend (EcommerceDeploymentLog), no hace falta parsear texto plano.
     *
     * @returns {Array<{step: string, line: string, level: string}>}
     */
    log_lines() {
      return this.installation.logs || []
    },
  },
  watch: {
    /**
     * Abre el log automáticamente cuando la corrida pasa a 'instalando'.
     * @param {string} new_status
     * @returns {void}
     */
    'installation.status'(new_status) {
      if (new_status === 'instalando') {
        this.log_expanded = true
      }
    },
    /**
     * Hace scroll al final del log cada vez que llegan líneas nuevas (el polling del padre
     * reemplaza installation.logs por un array nuevo, lo que dispara este watcher).
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
     * Indica si una etapa (tag de log) tiene al menos una línea registrada.
     * @param {string} step
     * @returns {boolean}
     */
    has_logs_for(step) {
      return this.log_lines.some(function (l) { return l.step === step })
    },
    /**
     * Líneas de log pertenecientes al tag upload_api (donde corre composer install).
     * @returns {Array}
     */
    upload_api_lines() {
      return this.log_lines.filter(function (l) { return l.step === 'upload_api' })
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
     * Determina el estado visual de un ítem del checklist a partir de los logs de la corrida.
     *
     * @param {string} key - 'ensure_spa_cloned' | 'compile_spa' | 'upload_spa' | 'upload_api' |
     *   'composer_install' | 'write_env' | 'finalize'
     * @returns {string} - 'pending' | 'running' | 'completed' | 'failed'
     */
    get_step_status(key) {
      // write_env no corre en actualizaciones: no hay logs propios que buscar, se marca
      // "Saltado" desde el template (is_skipped) y acá simplemente queda pendiente.
      if (key === 'write_env' && this.installation.mode === 'update') {
        return 'pending'
      }

      // Corrida completa: todas las etapas quedan en verde sin importar el detalle del log.
      if (this.installation.status === 'completada') {
        return 'completed'
      }

      // "Instalar composer" es un sub-paso derivado dentro de upload_api (ver marcadores arriba).
      if (key === 'composer_install') {
        if (this.composer_done()) return 'completed'
        if (this.composer_started()) {
          return this.installation.status === 'fallida' ? 'failed' : 'running'
        }
        return 'pending'
      }

      // upload_api se da por completado en cuanto arrancó composer, porque eso es
      // lo último que hace ese step antes de pasar a escribir el .env (o finalizar, en updates).
      if (key === 'upload_api') {
        if (this.composer_started()) return 'completed'
        if (this.has_logs_for('upload_api')) {
          return this.installation.status === 'fallida' ? 'failed' : 'running'
        }
        return 'pending'
      }

      // finalize es la última etapa: no hay un step siguiente cuyos logs indiquen que
      // terminó. El early-return de 'completada' ya cubre el caso feliz; acá sólo se
      // distingue 'running' de 'failed' según el status general de la corrida.
      if (key === 'finalize') {
        if (!this.has_logs_for('finalize')) return 'pending'
        return this.installation.status === 'fallida' ? 'failed' : 'running'
      }

      // ensure_spa_cloned / compile_spa / upload_spa / write_env: se completan cuando el
      // siguiente tag del pipeline ya tiene logs propios (señal de que el step actual terminó bien).
      var idx = LOG_STEPS_ORDER.indexOf(key)
      var next = LOG_STEPS_ORDER[idx + 1]
      var next_has_logs = next ? this.has_logs_for(next) : false
      if (!this.has_logs_for(key)) return 'pending'
      if (next_has_logs) return 'completed'
      return this.installation.status === 'fallida' ? 'failed' : 'running'
    },
    /**
     * Clase de color Bootstrap según nivel del log (info, success, error).
     *
     * @param {string} level
     * @returns {string}
     */
    log_level_class(level) {
      return deployment_log_level_class(level)
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
/* Panel de log en vivo, calcado del equivalente en installation/extra-props/OperationsPanel.vue */
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
