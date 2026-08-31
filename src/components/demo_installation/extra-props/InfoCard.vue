<template>
  <div class="card p-3 mb-3">
    <div class="row g-2">
      <div class="col-12 col-sm-6 col-md-3">
        <small class="text-muted d-block">Demo</small>
        <span class="text-break">{{ demo_label }}</span>
      </div>
      <div class="col-6 col-sm-6 col-md-2">
        <small class="text-muted d-block">Versión</small>
        <span class="fw-semibold">{{ installation.version ? installation.version.version : '—' }}</span>
      </div>
      <div class="col-6 col-sm-6 col-md-2">
        <small class="text-muted d-block">Estado</small>
        <span class="badge" :class="status_badge_class">
          <span
            v-if="installation.status === 'instalando'"
            class="spinner-border spinner-border-sm me-1"
            role="status"
            aria-hidden="true"
          ></span>
          {{ status_label }}
        </span>
      </div>
      <div class="col-6 col-sm-6 col-md-2">
        <small class="text-muted d-block">Iniciada</small>
        <span>{{ installation.started_at ? format_date(installation.started_at) : '—' }}</span>
      </div>
      <div class="col-6 col-sm-6 col-md-3">
        <small class="text-muted d-block">Finalizada</small>
        <span>{{ installation.finished_at ? format_date(installation.finished_at) : '—' }}</span>
      </div>
    </div>
    <div class="row g-2 mt-1">
      <div class="col-6 col-md-2">
        <small class="text-muted d-block">Duración</small>
        <span>{{ duration_label }}</span>
      </div>
      <div v-if="installation.demo && installation.demo.erp_spa_url" class="col-12 col-md-5">
        <small class="text-muted d-block">ERP SPA</small>
        <code class="text-break">{{ installation.demo.erp_spa_url }}</code>
      </div>
      <div v-if="installation.demo && installation.demo.erp_api_url" class="col-12 col-md-5">
        <small class="text-muted d-block">ERP API</small>
        <code class="text-break">{{ installation.demo.erp_api_url }}</code>
      </div>
    </div>

    <!-- Motivo de la falla: sin esto hay que abrir el log entero para saber por qué se cortó. -->
    <div v-if="installation.status === 'fallida' && installation.failure_reason" class="alert alert-danger py-2 small mb-0 mt-2">
      <strong>Error:</strong> {{ installation.failure_reason }}
    </div>
  </div>
</template>

<script>
import demo_installation_api from '@/store/demo_installation'

/**
 * Tarjeta de información rápida de una instalación de sistema de demo: demo, versión, estado,
 * fechas y duración. Calcada de demo_update/extra-props/InfoCard.vue, con el vocabulario de
 * estados del pipeline de instalación (pendiente/instalando/completada/fallida).
 */
export default {
  name: 'DemoInstallationInfoCard',

  props: {
    /** Objeto completo de la DemoInstallation (demo, version, status, fechas, log). */
    installation: { type: Object, required: true },
  },

  computed: {
    /**
     * Nombre legible de la demo dueña de la corrida.
     *
     * @returns {string}
     */
    demo_label() {
      if (!this.installation.demo) {
        return this.installation.demo_id ? ('Demo #' + this.installation.demo_id) : '—'
      }
      return demo_installation_api.demo_label(this.installation.demo)
    },

    /**
     * Clase Bootstrap del badge de estado del pipeline.
     *
     * @returns {string}
     */
    status_badge_class() {
      const map = {
        pendiente:  'text-bg-secondary',
        instalando: 'text-bg-warning',
        completada: 'text-bg-success',
        fallida:    'text-bg-danger',
      }
      return map[this.installation.status] || 'text-bg-secondary'
    },

    /**
     * Texto visible del badge de estado.
     *
     * @returns {string}
     */
    status_label() {
      const map = {
        pendiente:  'Pendiente',
        instalando: 'Instalando...',
        completada: 'Completada',
        fallida:    'Fallida',
      }
      return map[this.installation.status] || this.installation.status || 'Desconocido'
    },

    /**
     * Duración del pipeline en formato "Xm YYs". Requiere started_at y finished_at: mientras la
     * corrida sigue en curso todavía no hay duración final que mostrar.
     *
     * @returns {string}
     */
    duration_label() {
      if (!this.installation.started_at || !this.installation.finished_at) {
        return '—'
      }
      const started = new Date(this.installation.started_at)
      const finished = new Date(this.installation.finished_at)
      const total_seconds = Math.max(0, Math.round((finished - started) / 1000))
      const minutes = Math.floor(total_seconds / 60)
      const seconds = total_seconds % 60
      const seconds_text = seconds < 10 ? '0' + seconds : String(seconds)
      return minutes + 'm ' + seconds_text + 's'
    },
  },

  methods: {
    /**
     * Formatea una fecha ISO para la tarjeta.
     *
     * @param {string|null} val
     * @returns {string}
     */
    format_date(val) {
      if (!val) {
        return ''
      }
      const d = new Date(val)
      return (
        d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
        ' ' +
        d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
      )
    },
  },
}
</script>
