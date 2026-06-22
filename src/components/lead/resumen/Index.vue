<template>
  <!-- Contenedor principal del tab Resumen: muestra resumen narrativo y estructurado del lead -->
  <div class="lead-resumen-tab">

    <!-- Header: título del tab y botón Regenerar -->
    <div class="d-flex align-items-center justify-content-between mb-3">
      <span class="small fw-semibold text-secondary">
        <i class="bi bi-stars me-2"></i> Resumen del lead
      </span>
      <!-- Botón para regenerar el resumen via Claude -->
      <button
        type="button"
        class="btn btn-outline-secondary btn-sm d-inline-flex align-items-center justify-content-center"
        :disabled="loading_regenerate"
        title="Regenerar resumen del lead con Claude"
        aria-label="Regenerar resumen del lead con Claude"
        @click="regenerate_summary"
      >
        <span v-if="loading_regenerate" class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
        <i v-else class="bi bi-arrow-clockwise" aria-hidden="true" />
      </button>
    </div>

    <!-- Estado vacío: cuando no existe resumen generado aún -->
    <div v-if="!record || !record.demo_summary" class="text-center py-5 text-muted">
      <i class="bi bi-file-earmark-text d-block mb-3" style="font-size: 3rem"></i>
      <p class="small mb-1 fw-semibold">El resumen aún no fue generado.</p>
      <p class="small mb-0">Hacé clic en "Regenerar" para generarlo ahora.</p>
    </div>

    <!-- Contenido cuando existe resumen narrativo -->
    <template v-else>

      <!-- Card con el resumen narrativo completo generado por Claude -->
      <div class="border-0 bg-light rounded-3 p-3 mb-3">
        <div class="d-flex align-items-center mb-2">
          <i class="bi bi-file-person-fill text-primary me-2"></i>
          <span class="fw-semibold small">Resumen narrativo</span>
        </div>
        <!-- Texto del resumen respetando saltos de línea del backend -->
        <p class="mb-0 small lh-base" style="white-space: pre-line">{{ record.demo_summary }}</p>
      </div>

      <!-- Grid con las 4 tarjetas del resumen estructurado (si está disponible) -->
      <div v-if="structured_data" class="row g-3">

        <!-- Tarjeta: A qué se dedica la empresa -->
        <div class="col-md-6">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body">
              <div class="d-flex align-items-center gap-2 mb-2">
                <span class="badge bg-primary-subtle text-primary">
                  <i class="bi bi-building-fill"></i>
                </span>
                <span class="fw-semibold small">A qué se dedica</span>
              </div>
              <p class="mb-0 small text-secondary lh-base">{{ structured_data.empresa }}</p>
            </div>
          </div>
        </div>

        <!-- Tarjeta: Situación actual del prospecto -->
        <div class="col-md-6">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body">
              <div class="d-flex align-items-center gap-2 mb-2">
                <span class="badge bg-warning-subtle text-warning-emphasis">
                  <i class="bi bi-laptop-fill"></i>
                </span>
                <span class="fw-semibold small">Situación actual</span>
              </div>
              <p class="mb-0 small text-secondary lh-base">{{ structured_data.situacion_actual }}</p>
            </div>
          </div>
        </div>

        <!-- Tarjeta: Funcionalidades que le interesan -->
        <div class="col-md-6">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body">
              <div class="d-flex align-items-center gap-2 mb-2">
                <span class="badge bg-success-subtle text-success">
                  <i class="bi bi-star-fill"></i>
                </span>
                <span class="fw-semibold small">Le interesa</span>
              </div>
              <p class="mb-0 small text-secondary lh-base">{{ structured_data.funcionalidades }}</p>
            </div>
          </div>
        </div>

        <!-- Tarjeta: Puntos de dolor detectados -->
        <div class="col-md-6">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body">
              <div class="d-flex align-items-center gap-2 mb-2">
                <span class="badge bg-danger-subtle text-danger">
                  <i class="bi bi-exclamation-triangle-fill"></i>
                </span>
                <span class="fw-semibold small">Puntos de dolor</span>
              </div>
              <p class="mb-0 small text-secondary lh-base">{{ structured_data.puntos_dolor }}</p>
            </div>
          </div>
        </div>

      </div>
      <!-- Fin grid de tarjetas estructuradas -->

    </template>

  </div>
</template>

<script>
/**
 * Tab "Resumen" del modal de lead.
 *
 * Muestra el resumen narrativo generado por Claude y las 4 tarjetas del resumen
 * estructurado (empresa, situación actual, funcionalidades, puntos de dolor).
 * Incluye botón para regenerar ambos resúmenes invocando la acción del store.
 */
export default {
  name: 'LeadResumenTab',

  props: {
    /** Lead completo recibido desde el ModelModal (draft actualizado en tiempo real). */
    record: { type: Object, default: null },
  },

  emits: ['record-updated'],

  data() {
    return {
      /** Indica si se está ejecutando la regeneración del resumen (controla spinner y disabled). */
      loading_regenerate: false,
    }
  },

  computed: {
    /**
     * Parsea y devuelve el objeto demo_summary_structured del lead.
     * Maneja tanto el caso en que el backend lo devuelve ya como objeto JS
     * (cast 'array' de Laravel) como el caso en que viene como string JSON.
     * @returns {Object|null} Objeto con claves empresa, situacion_actual, funcionalidades, puntos_dolor o null.
     */
    structured_data() {
      if (!this.record || !this.record.demo_summary_structured) {
        return null
      }
      /* Valor del campo del backend: puede ser objeto (cast) o string JSON */
      var s = this.record.demo_summary_structured
      if (typeof s === 'string') {
        try {
          return JSON.parse(s)
        } catch (e) {
          return null
        }
      }
      return (typeof s === 'object' && s !== null) ? s : null
    },
  },

  methods: {
    /**
     * Llama a la acción del store para regenerar el resumen del lead via Claude.
     * Al completarse emite record-updated con el modelo actualizado y muestra toast.
     * @returns {void}
     */
    regenerate_summary() {
      var self = this
      self.loading_regenerate = true

      /* Invocar la acción existente del store que llama al endpoint de resumen */
      self.$store.dispatch('lead/generate_demo_summary', self.record.id)
        .then(function (model) {
          /* Notificar al padre (ModelModal) para que actualice el draft con el nuevo resumen */
          self.$emit('record-updated', model)
          if (self.$root && self.$root.$emit) {
            self.$root.$emit('open_toast', 'Resumen regenerado correctamente.')
          }
        })
        .catch(function () {
          if (self.$root && self.$root.$emit) {
            self.$root.$emit('open_toast', 'Error al regenerar el resumen.')
          }
        })
        .then(function () {
          /* Siempre desactivar el spinner al terminar, tanto en éxito como en error */
          self.loading_regenerate = false
        })
    },
  },
}
</script>
