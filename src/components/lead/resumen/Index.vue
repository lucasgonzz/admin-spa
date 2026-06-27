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

    <!-- Acceso rápido a la conversación WhatsApp del lead (sidebar en desktop o ruta en mobile) -->
    <div v-if="show_whatsapp_button" class="mb-3">
      <button
        type="button"
        class="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-2"
        title="Abrir conversación de WhatsApp"
        aria-label="Abrir conversación de WhatsApp"
        @click="open_whatsapp_conversation"
      >
        <i class="bi bi-whatsapp" aria-hidden="true" />
        Abrir conversación de WhatsApp
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

        <!-- Tarjeta: Precio sugerido (uso interno del equipo, inferido por Claude) -->
        <div v-if="structured_data.precio_sugerido" class="col-md-6">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body">
              <div class="d-flex align-items-center gap-2 mb-2">
                <span class="badge bg-info-subtle text-info">
                  <i class="bi bi-cash-coin"></i>
                </span>
                <span class="fw-semibold small">Precio sugerido</span>
              </div>
              <p class="mb-1 fw-bold fs-5">USD {{ structured_data.precio_sugerido.total }}</p>
              <p v-if="structured_data.precio_sugerido.incluye_ecommerce" class="mb-1 small text-muted">
                (incluye ecommerce)
              </p>
              <p
                v-if="structured_data.precio_sugerido.bono !== null && structured_data.precio_sugerido.bono !== undefined"
                class="mb-1 small text-success"
              >
                Bono acción rápida: USD {{ structured_data.precio_sugerido.bono }}
              </p>
              <p class="mb-0 small text-secondary lh-base">
                {{ structured_data.precio_sugerido.razonamiento }}
              </p>
            </div>
          </div>
        </div>

        <!-- Tarjeta: Temperatura del lead (uso interno, inferida por Claude) -->
        <div v-if="structured_data.temperatura" class="col-md-6">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body">
              <div class="d-flex align-items-center gap-2 mb-2">
                <span
                  class="badge"
                  :class="temperatura_badge_class"
                >
                  <i :class="temperatura_icon_class"></i>
                </span>
                <span class="fw-semibold small">Temperatura del lead</span>
              </div>
              <p class="mb-1 small fw-semibold text-uppercase">{{ structured_data.temperatura.nivel }}</p>
              <p class="mb-0 small text-secondary lh-base">
                {{ structured_data.temperatura.razonamiento }}
              </p>
            </div>
          </div>
        </div>

      </div>
      <!-- Fin grid de tarjetas estructuradas -->

      <!-- Divisor entre resumen de demo y resumen de llamada (solo si ambos existen) -->
      <hr v-if="record.call_summary" class="my-4">

      <!-- Subtítulo de la sección de llamada del closer -->
      <div v-if="record.call_summary" class="d-flex align-items-center justify-content-between mb-3">
        <span class="small fw-semibold text-secondary">
          <i class="bi bi-telephone-fill me-2"></i> Llamada del closer
        </span>
      </div>

      <!-- Panel de resumen de la llamada del closer (generado por Recall.ai + Claude) -->
      <call-summary-panel v-if="record.call_summary" :call_summary="record.call_summary" />

      <!-- Estado vacío de llamada: lead hizo la demo pero el closer todavía no llamó -->
      <div
        v-else
        class="text-center py-3 text-muted border rounded-3 mt-3"
      >
        <i class="bi bi-telephone d-block mb-2" style="font-size: 1.5rem"></i>
        <p class="small mb-0">El resumen de la llamada del closer aún no está disponible.</p>
      </div>

    </template>

  </div>
</template>

<script>
/* Componente que muestra el resumen de la llamada del closer (call_summary JSON) */
import CallSummaryPanel from './CallSummaryPanel.vue'

/**
 * Tab "Resumen" del modal de lead.
 *
 * Muestra el resumen narrativo generado por Claude y las 4 tarjetas del resumen
 * estructurado (empresa, situación actual, funcionalidades, puntos de dolor,
 * precio sugerido y temperatura del lead).
 * Incluye el panel de resumen de llamada del closer (CallSummaryPanel) con escenario
 * de cierre, precio acordado, modificaciones y transcripción colapsable.
 * Incluye botón para regenerar el resumen de demo invocando la acción del store.
 * Incluye acceso rápido a la conversación WhatsApp del lead (mismo flujo que el botón de la tabla).
 */
export default {
  name: 'LeadResumenTab',

  components: {
    /* Panel de resumen de llamada del closer generado por Recall.ai + Claude */
    CallSummaryPanel,
  },

  props: {
    /** Lead completo recibido desde el ModelModal (draft actualizado en tiempo real). */
    record: { type: Object, default: null },
  },

  emits: ['record-updated', 'open-conversation'],

  data() {
    return {
      /** Indica si se está ejecutando la regeneración del resumen (controla spinner y disabled). */
      loading_regenerate: false,
    }
  },

  computed: {
    /**
     * Indica si debe mostrarse el botón para abrir la conversación WhatsApp.
     * Se oculta cuando ya se está viendo la conversación de este mismo lead.
     * @returns {boolean}
     */
    show_whatsapp_button() {
      if (!this.record || !this.record.id) {
        return false
      }
      if (
        this.$route.name === 'lead_conversation'
        && String(this.$route.params.lead_id) === String(this.record.id)
      ) {
        return false
      }
      return true
    },

    /**
     * Parsea y devuelve el objeto demo_summary_structured del lead.
     * Maneja tanto el caso en que el backend lo devuelve ya como objeto JS
     * (cast 'array' de Laravel) como el caso en que viene como string JSON.
     * @returns {Object|null} Objeto con claves empresa, situacion_actual, funcionalidades,
     *   puntos_dolor, precio_sugerido y temperatura, o null.
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

    /**
     * Clase CSS del badge según el nivel de temperatura del lead.
     * @returns {string}
     */
    temperatura_badge_class() {
      var nivel = this.structured_data && this.structured_data.temperatura
        ? this.structured_data.temperatura.nivel
        : ''
      if (nivel === 'alta') {
        return 'bg-danger-subtle text-danger'
      }
      if (nivel === 'media') {
        return 'bg-warning-subtle text-warning-emphasis'
      }
      return 'bg-secondary-subtle text-secondary'
    },

    /**
     * Clase del ícono Bootstrap según el nivel de temperatura del lead.
     * @returns {string}
     */
    temperatura_icon_class() {
      var nivel = this.structured_data && this.structured_data.temperatura
        ? this.structured_data.temperatura.nivel
        : ''
      if (nivel === 'alta') {
        return 'bi bi-thermometer-high'
      }
      if (nivel === 'media') {
        return 'bi bi-thermometer-half'
      }
      return 'bi bi-thermometer-low'
    },
  },

  methods: {
    /**
     * Solicita abrir la conversación WhatsApp del lead.
     * Emite al padre (Leads.vue) para reutilizar sidebar en desktop o ruta en mobile.
     * @returns {void}
     */
    open_whatsapp_conversation() {
      if (!this.record || !this.record.id) {
        return
      }
      this.$emit('open-conversation', this.record)
    },

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
