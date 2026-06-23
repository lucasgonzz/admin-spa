<template>
  <!-- Panel de resumen de llamada del closer, generado automáticamente por Recall.ai + Claude -->
  <div v-if="call_summary_parsed" class="call-summary-panel">

    <!-- Header del panel con fecha, duración y badge de escenario de cierre -->
    <div class="d-flex align-items-center justify-content-between mb-3">
      <span class="small fw-semibold">
        <i class="bi bi-telephone-fill text-primary me-2"></i>
        {{ header_text }}
      </span>
      <!-- Badge de escenario de cierre alineado a la derecha -->
      <span :class="escenario_badge_class" class="badge">
        {{ escenario_label }}
      </span>
    </div>

    <!-- Sección 1: Resumen general (siempre visible si existe) -->
    <div v-if="call_summary_parsed.resumen_general" class="border-0 bg-light rounded-3 p-3 mb-3">
      <div class="d-flex align-items-center mb-2">
        <i class="bi bi-file-text-fill text-secondary me-2"></i>
        <span class="fw-semibold small">Resumen general</span>
      </div>
      <!-- Texto con saltos de línea respetados -->
      <p class="mb-0 small lh-base" style="white-space: pre-line">{{ call_summary_parsed.resumen_general }}</p>
    </div>

    <!-- Sección 2: Grid de tarjetas con detalles de la llamada -->
    <div class="row g-3 mb-3">

      <!-- Tarjeta: Lo que planteó el lead -->
      <div v-if="call_summary_parsed.lo_que_planteo_el_lead" class="col-md-6">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="d-flex align-items-center gap-2 mb-2">
              <span class="badge bg-primary-subtle text-primary">
                <i class="bi bi-chat-quote-fill"></i>
              </span>
              <span class="fw-semibold small">Lo que planteó el lead</span>
            </div>
            <p class="mb-0 small text-secondary lh-base" style="white-space: pre-line">{{ call_summary_parsed.lo_que_planteo_el_lead }}</p>
          </div>
        </div>
      </div>

      <!-- Tarjeta: Puntos de dolor (solo si el array tiene ítems) -->
      <div v-if="call_summary_parsed.puntos_de_dolor && call_summary_parsed.puntos_de_dolor.length" class="col-md-6">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="d-flex align-items-center gap-2 mb-2">
              <span class="badge bg-danger-subtle text-danger">
                <i class="bi bi-exclamation-triangle-fill"></i>
              </span>
              <span class="fw-semibold small">Puntos de dolor</span>
            </div>
            <!-- Lista de puntos de dolor -->
            <div class="small text-secondary">
              <div
                v-for="(punto, index) in call_summary_parsed.puntos_de_dolor"
                :key="index"
                class="d-flex align-items-start gap-1 mb-1"
              >
                <span class="text-danger mt-1" style="font-size: 0.6rem">&#9679;</span>
                <span>{{ punto }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tarjeta: Sugerencias del closer (solo si el array tiene ítems) -->
      <div v-if="call_summary_parsed.sugerencias_del_closer && call_summary_parsed.sugerencias_del_closer.length" class="col-md-6">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="d-flex align-items-center gap-2 mb-2">
              <span class="badge bg-warning-subtle text-warning-emphasis">
                <i class="bi bi-lightbulb-fill"></i>
              </span>
              <span class="fw-semibold small">Sugerencias del closer</span>
            </div>
            <!-- Lista de sugerencias -->
            <div class="small text-secondary">
              <div
                v-for="(sugerencia, index) in call_summary_parsed.sugerencias_del_closer"
                :key="index"
                class="d-flex align-items-start gap-1 mb-1"
              >
                <span class="text-warning mt-1" style="font-size: 0.6rem">&#9679;</span>
                <span>{{ sugerencia }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tarjeta: Módulos de interés (solo si el array tiene ítems) -->
      <div v-if="call_summary_parsed.modulos_de_interes && call_summary_parsed.modulos_de_interes.length" class="col-md-6">
        <div class="card border-0 shadow-sm h-100">
          <div class="card-body">
            <div class="d-flex align-items-center gap-2 mb-2">
              <span class="badge bg-success-subtle text-success">
                <i class="bi bi-grid-fill"></i>
              </span>
              <span class="fw-semibold small">Módulos de interés</span>
            </div>
            <!-- Lista de módulos -->
            <div class="small text-secondary">
              <div
                v-for="(modulo, index) in call_summary_parsed.modulos_de_interes"
                :key="index"
                class="d-flex align-items-start gap-1 mb-1"
              >
                <span class="text-success mt-1" style="font-size: 0.6rem">&#9679;</span>
                <span>{{ modulo }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
    <!-- Fin grid de tarjetas -->

    <!-- Sección 3: Precio acordado (solo si hay algún valor de precio) -->
    <div v-if="has_precio_acordado" class="border rounded-3 p-3 mb-3 bg-success-subtle">
      <div class="d-flex align-items-center mb-2">
        <i class="bi bi-currency-dollar text-success me-2"></i>
        <span class="fw-semibold small">Precio acordado</span>
      </div>
      <div class="d-flex flex-wrap gap-3 small">
        <!-- Monto de licencia -->
        <span v-if="call_summary_parsed.precio_acordado.licencia_usd != null">
          <span class="text-secondary">Licencia:</span>
          <strong class="ms-1">USD {{ call_summary_parsed.precio_acordado.licencia_usd }}</strong>
        </span>
        <!-- Monto de mensualidad -->
        <span v-if="call_summary_parsed.precio_acordado.mensualidad_usd != null">
          <span class="text-secondary">Mensualidad:</span>
          <strong class="ms-1">USD {{ call_summary_parsed.precio_acordado.mensualidad_usd }}</strong>
        </span>
      </div>
      <!-- Nota adicional del precio (si existe) -->
      <p v-if="call_summary_parsed.precio_acordado.nota" class="mb-0 mt-2 small text-muted fst-italic">
        {{ call_summary_parsed.precio_acordado.nota }}
      </p>
    </div>

    <!-- Sección 4: Modificaciones requeridas (solo si el array tiene ítems) -->
    <div
      v-if="call_summary_parsed.modificaciones_requeridas && call_summary_parsed.modificaciones_requeridas.length"
      class="border rounded-3 p-3 mb-3 bg-warning-subtle"
    >
      <div class="d-flex align-items-center mb-2">
        <i class="bi bi-tools text-warning-emphasis me-2"></i>
        <span class="fw-semibold small">Modificaciones requeridas</span>
      </div>
      <!-- Lista de modificaciones -->
      <div class="small text-secondary">
        <div
          v-for="(mod, index) in call_summary_parsed.modificaciones_requeridas"
          :key="index"
          class="d-flex align-items-start gap-1 mb-1"
        >
          <span class="text-warning-emphasis mt-1" style="font-size: 0.6rem">&#9679;</span>
          <span>{{ mod }}</span>
        </div>
      </div>
    </div>

    <!-- Sección 5: Próximo paso (solo si existe) -->
    <div v-if="call_summary_parsed.proximo_paso" class="d-flex align-items-start gap-2 mb-3 small">
      <i class="bi bi-arrow-right-circle-fill text-primary mt-1 flex-shrink-0"></i>
      <span class="text-secondary lh-base">
        <span class="fw-semibold text-dark">Próximo paso:</span>
        {{ call_summary_parsed.proximo_paso }}
      </span>
    </div>

    <!-- Sección 6: Transcripción completa (colapsada por defecto) -->
    <div v-if="call_summary_parsed.transcripcion_completa">
      <!-- Botón para mostrar/ocultar la transcripción -->
      <button
        type="button"
        class="btn btn-outline-secondary btn-sm mb-2"
        @click="show_transcript = !show_transcript"
      >
        <i :class="show_transcript ? 'bi bi-chevron-up' : 'bi bi-chevron-down'" class="me-1"></i>
        {{ show_transcript ? 'Ocultar transcripción' : 'Ver transcripción completa' }}
      </button>
      <!-- Bloque de transcripción: monospace, scroll vertical limitado -->
      <div
        v-if="show_transcript"
        class="bg-light rounded-3 p-3 small"
        style="font-family: monospace; font-size: 0.75rem; max-height: 300px; overflow-y: auto; white-space: pre-wrap; word-break: break-word;"
      >{{ call_summary_parsed.transcripcion_completa }}</div>
    </div>

  </div>
</template>

<script>
/**
 * Panel visual del resumen de la llamada del closer (call_summary).
 *
 * Muestra el JSON estructurado generado automáticamente por Recall.ai + Claude
 * con escenario de cierre, precio acordado, modificaciones requeridas,
 * módulos de interés y transcripción colapsable.
 *
 * No tiene botón de regeneración: el resumen se genera automáticamente
 * desde el webhook de Recall. Si se quiere permitir regenerarlo manualmente
 * será un prompt separado.
 */
export default {
  name: 'CallSummaryPanel',

  props: {
    /**
     * Campo call_summary del lead: puede ser objeto JS, string JSON o null.
     * El componente resuelve todas las variantes en call_summary_parsed.
     */
    call_summary: { type: [Object, String], default: null },
  },

  data() {
    return {
      /** Controla si la sección de transcripción está expandida o colapsada. */
      show_transcript: false,
    }
  },

  computed: {
    /**
     * Devuelve el JSON del resumen de llamada como objeto JS.
     * Maneja tres casos: objeto directo, string JSON o valor nulo/inválido.
     * @returns {Object|null}
     */
    call_summary_parsed() {
      /* Sin valor: no renderizar nada */
      if (!this.call_summary) return null

      /* Ya es un objeto JS (cast 'array' de Laravel) */
      if (typeof this.call_summary === 'object') {
        return this.call_summary
      }

      /* Es un string: intentar parsear como JSON */
      if (typeof this.call_summary === 'string') {
        try {
          return JSON.parse(this.call_summary)
        } catch (e) {
          return null
        }
      }

      return null
    },

    /**
     * Texto del header del panel: fecha + duración (si ambas existen).
     * Omite la duración cuando es null o no está disponible.
     * @returns {string}
     */
    header_text() {
      var s = this.call_summary_parsed
      if (!s) return 'Llamada del closer'

      /* Texto base con fecha */
      var text = 'Llamada del closer'
      if (s.fecha_llamada) {
        text += ' - ' + s.fecha_llamada
      }
      /* Agregar duración solo si está presente */
      if (s.duracion_minutos != null) {
        text += ' · ' + s.duracion_minutos + ' min'
      }
      return text
    },

    /**
     * Clase CSS del badge de escenario de cierre según el valor de escenario_cierre.
     * Valores válidos: 'A', 'B', 'C', 'D', null.
     * @returns {string}
     */
    escenario_badge_class() {
      var escenario = this.call_summary_parsed ? this.call_summary_parsed.escenario_cierre : null
      var map = {
        'A': 'bg-success',
        'B': 'bg-warning text-dark',
        'C': 'bg-info text-dark',
        'D': 'bg-danger',
      }
      return map[escenario] || 'bg-secondary'
    },

    /**
     * Texto descriptivo del badge de escenario de cierre.
     * @returns {string}
     */
    escenario_label() {
      var escenario = this.call_summary_parsed ? this.call_summary_parsed.escenario_cierre : null
      var labels = {
        'A': 'Cerró',
        'B': 'Reunión con Lucas',
        'C': 'Seguimiento',
        'D': 'No avanza',
      }
      return labels[escenario] || 'Sin determinar'
    },

    /**
     * Indica si debe mostrarse la sección de precio acordado.
     * Requiere al menos un valor numérico (licencia o mensualidad).
     * @returns {boolean}
     */
    has_precio_acordado() {
      var s = this.call_summary_parsed
      if (!s || !s.precio_acordado) return false
      return s.precio_acordado.licencia_usd != null || s.precio_acordado.mensualidad_usd != null
    },
  },
}
</script>
