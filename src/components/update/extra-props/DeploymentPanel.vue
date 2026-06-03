<template>
  <div class="card mb-3 border-primary border-opacity-25">
    <div class="card-body py-3">
      <div class="d-flex align-items-center flex-wrap gap-2 mb-2">
        <h6 class="mb-0 me-2">Deployment automatizado</h6>
        <span
          v-if="deployment_status"
          class="badge"
          :class="'bg-' + deployment_status_badge"
        >
          {{ deployment_status_label }}
        </span>
        <span v-else class="badge bg-secondary">Sin iniciar</span>
      </div>
      <p class="small text-muted mb-2">
        Compila <strong>empresa-spa</strong> en el VPS (tag Git de la versión destino), sube el
        <code>dist</code> al hosting del cliente, empaqueta y sube <strong>empresa-api</strong>, y
        continúa con migraciones, seeders y comandos del upgrade.
      </p>
      <div v-if="target_api_label" class="small mb-2">
        <span class="text-muted">API destino:</span>
        <code class="ms-1">{{ target_api_label }}</code>
      </div>
      <div v-else class="alert alert-warning py-2 small mb-2">
        Configure <strong>API destino</strong> en el grupo Básico del upgrade antes de desplegar.
      </div>

      <div
        v-if="deployment_logs.length"
        ref="log_container"
        class="deployment-log-panel border rounded bg-dark text-light small p-2 mb-2"
      >
        <div
          v-for="(log_line, log_index) in deployment_logs"
          :key="log_index"
          class="deployment-log-line"
          :class="'text-' + log_level_class(log_line.level)"
        >
          <span class="text-muted">[{{ log_line.step }}]</span>
          {{ log_line.line }}
        </div>
      </div>

      <div v-else-if="deployment_loading" class="text-muted small mb-2">
        Esperando líneas de log…
      </div>
    </div>
  </div>
</template>

<script>
import {
  DEPLOYMENT_STATUS_LABELS,
  DEPLOYMENT_STATUS_BADGE,
} from '@/utils/deployment_status'

/**
 * Panel de estado y logs del deployment (upload SPA/API, migraciones, etc.).
 */
export default {
  name: 'UpdateDeploymentPanel',
  props: {
    update: { type: Object, required: true },
    deployment_logs: { type: Array, default: () => [] },
    deployment_loading: { type: Boolean, default: false },
  },
  computed: {
    deployment_status() {
      return this.update.deployment_status || null
    },
    deployment_status_label() {
      return DEPLOYMENT_STATUS_LABELS[this.deployment_status] || this.deployment_status
    },
    deployment_status_badge() {
      return DEPLOYMENT_STATUS_BADGE[this.deployment_status] || 'secondary'
    },
    target_api_label() {
      const api = this.update.target_client_api
      if (!api) {
        return ''
      }
      let label = api.url || ''
      if (api.path) {
        label = label + ' · ' + api.path
      }
      return label
    },
  },
  watch: {
    deployment_logs: {
      handler() {
        this.scroll_logs_to_bottom()
      },
      deep: true,
    },
  },
  methods: {
    /**
     * Clase de color según nivel del log (info, success, error).
     *
     * @param {string} level
     * @returns {string}
     */
    log_level_class(level) {
      if (level === 'error') {
        return 'danger'
      }
      if (level === 'success') {
        return 'success'
      }
      return 'light'
    },
    /**
     * Mantiene visible la última línea del log al actualizar el polling.
     *
     * @returns {void}
     */
    scroll_logs_to_bottom() {
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
.deployment-log-panel {
  max-height: 220px;
  overflow-y: auto;
  font-family: ui-monospace, monospace;
  font-size: 0.75rem;
  line-height: 1.35;
}
.deployment-log-line {
  white-space: pre-wrap;
  word-break: break-word;
  margin-bottom: 0.15rem;
}
</style>
