<template>
  <div>
    <!-- Spinner de carga inicial -->
    <div v-if="loading && !local_demo_update.id" class="d-flex justify-content-center py-4">
      <div class="spinner-border text-primary" role="status"></div>
    </div>

    <template v-else-if="local_demo_update.id">
      <!-- Información rápida de la actualización de demo -->
      <demo-update-info-card :demo_update="local_demo_update" />

      <!-- Log en vivo + checklist de pasos del pipeline -->
      <demo-update-operations-panel :demo_update="local_demo_update" />
    </template>
  </div>
</template>

<script>
import api from '@/utils/axios'
import DemoUpdateInfoCard from './InfoCard.vue'
import DemoUpdateOperationsPanel from './OperationsPanel.vue'

/**
 * Extra-props de una actualización de demo (DemoUpdate).
 * Se monta dentro del modal de la vista DemoUpdates.
 * Carga el registro completo y hace polling mientras el pipeline sigue corriendo.
 */
export default {
  name: 'DemoUpdateExtraProps',
  components: {
    DemoUpdateInfoCard,
    DemoUpdateOperationsPanel,
  },
  props: {
    /** Borrador del modal (misma referencia que el formulario Básico). */
    draft: { type: Object, default: null },
    /** Fila original de la tabla; fallback si aún no hay draft con id. */
    record: { type: Object, default: null },
  },
  emits: ['record-updated'],
  data() {
    return {
      local_demo_update: this.effective_record_source()
        ? Object.assign({}, this.effective_record_source())
        : {},
      loading: false,
      /** Intervalo de polling mientras status sea pendiente/ejecutandose. */
      poll_timer: null,
    }
  },
  watch: {
    draft(val) {
      if (val && val.id) {
        this.local_demo_update = Object.assign({}, val)
        this.stop_poll()
        this.load_full_demo_update()
      }
    },
    record(val) {
      if (val && val.id && (!this.draft || !this.draft.id)) {
        this.local_demo_update = Object.assign({}, val)
        this.stop_poll()
        this.load_full_demo_update()
      }
    },
  },
  mounted() {
    const src = this.effective_record_source()
    if (src && src.id) {
      this.load_full_demo_update()
    }
  },
  beforeUnmount() {
    this.stop_poll()
  },
  methods: {
    /**
     * Registro efectivo para cargar operaciones: prioriza el borrador del modal.
     * @returns {Object|null}
     */
    effective_record_source() {
      if (this.draft && this.draft.id) {
        return this.draft
      }
      if (this.record && this.record.id) {
        return this.record
      }
      return null
    },
    /**
     * Carga el DemoUpdate completo (con relaciones demo/version/created_by_admin).
     * @returns {void}
     */
    load_full_demo_update() {
      const self = this
      const id = self.local_demo_update.id
      self.loading = true
      api
        .get('/demo-update/' + id)
        .then(function (res) {
          self.local_demo_update = res.data.model
          self.sync_poll_from_status()
        })
        .catch(function () {})
        .then(function () {
          self.loading = false
        })
    },
    /**
     * Inicia o detiene el polling según el status del pipeline.
     * @returns {void}
     */
    sync_poll_from_status() {
      if (this.local_demo_update.status === 'pendiente' || this.local_demo_update.status === 'ejecutandose') {
        this.start_poll()
      } else {
        this.stop_poll()
      }
    },
    /**
     * Polling cada 4 segundos mientras el pipeline sigue corriendo.
     * @returns {void}
     */
    start_poll() {
      const self = this
      if (self.poll_timer) {
        return
      }
      self.poll_timer = setInterval(function () {
        const id = self.local_demo_update.id
        api
          .get('/demo-update/' + id)
          .then(function (res) {
            const model = res.data.model
            self.local_demo_update = model
            self.$emit('record-updated', model)
            if (model.status === 'completado' || model.status === 'fallido') {
              self.stop_poll()
            }
          })
          .catch(function () {})
      }, 4000)
    },
    /**
     * Detiene el intervalo de polling activo.
     * @returns {void}
     */
    stop_poll() {
      if (this.poll_timer) {
        clearInterval(this.poll_timer)
        this.poll_timer = null
      }
    },
  },
}
</script>
