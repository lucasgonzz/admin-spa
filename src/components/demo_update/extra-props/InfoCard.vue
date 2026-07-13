<template>
  <div class="card p-3 mb-3">
    <div class="row g-2">
      <div class="col-md-3">
        <small class="text-muted d-block">Demo</small>
        <span>{{ demo_update.demo ? demo_update.demo.erp_spa_url : '—' }}</span>
      </div>
      <div class="col-md-2">
        <small class="text-muted d-block">Versión destino</small>
        <span class="fw-semibold">{{ demo_update.version ? demo_update.version.version : '—' }}</span>
      </div>
      <div class="col-md-2">
        <small class="text-muted d-block">Estado</small>
        <span class="badge" :class="status_badge_class">
          <span
            v-if="demo_update.status === 'ejecutandose'"
            class="spinner-border spinner-border-sm me-1"
            role="status"
            aria-hidden="true"
          ></span>
          {{ status_label }}
        </span>
      </div>
      <div class="col-md-2">
        <small class="text-muted d-block">Iniciado</small>
        <span>{{ demo_update.started_at ? format_date(demo_update.started_at) : '—' }}</span>
      </div>
      <div class="col-md-3">
        <small class="text-muted d-block">Finalizado</small>
        <span>{{ demo_update.finished_at ? format_date(demo_update.finished_at) : '—' }}</span>
      </div>
    </div>
    <div class="row g-2 mt-1">
      <div class="col-md-2">
        <small class="text-muted d-block">Duración</small>
        <span>{{ duration_label }}</span>
      </div>
      <div class="col-md-3">
        <small class="text-muted d-block">Creada por</small>
        <span>{{ demo_update.created_by_admin ? demo_update.created_by_admin.name : '—' }}</span>
        <small class="text-muted d-block">{{ demo_update.created_at ? format_date(demo_update.created_at) : '' }}</small>
      </div>
    </div>
  </div>
</template>

<script>
/** Tarjeta de información rápida de la actualización de demo: demo, versión destino, estado, fechas. */
export default {
  name: 'DemoUpdateInfoCard',
  props: {
    demo_update: { type: Object, required: true },
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
     * Duración del pipeline en formato "Xm Ys".
     * Requiere started_at y finished_at; si el proceso sigue en curso (sin finished_at)
     * todavía no hay duración final que mostrar.
     * @returns {string}
     */
    duration_label() {
      if (!this.demo_update.started_at || !this.demo_update.finished_at) return '—'

      // Diferencia en milisegundos entre inicio y fin, convertida a segundos totales.
      var started = new Date(this.demo_update.started_at)
      var finished = new Date(this.demo_update.finished_at)
      var total_seconds = Math.max(0, Math.round((finished - started) / 1000))

      var minutes = Math.floor(total_seconds / 60)
      var seconds = total_seconds % 60
      // Segundos siempre con dos dígitos (ej: "12m 04s").
      var seconds_text = seconds < 10 ? '0' + seconds : String(seconds)

      return minutes + 'm ' + seconds_text + 's'
    },
  },
  methods: {
    format_date(val) {
      if (!val) return ''
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
