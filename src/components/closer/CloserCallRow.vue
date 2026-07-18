<template>
  <div class="closer-call-row border rounded-3 p-2 mb-2">
    <!-- Encabezado: fecha/hora, estado, botones -->
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
      <div class="d-flex align-items-center gap-2">
        <i class="bi bi-telephone-fill text-primary" aria-hidden="true" />
        <span class="small fw-semibold">{{ started_at_label }}</span>
        <span class="badge" :class="estado_badge_class">{{ estado_label }}</span>
      </div>
      <div class="d-flex flex-wrap gap-2">
        <button
          v-if="call.meet_url"
          type="button"
          class="btn btn-sm btn-outline-primary"
          @click="on_join_meet"
        >
          <i class="bi bi-camera-video me-1" aria-hidden="true" />
          Unirse a Meet
        </button>
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          :disabled="!call.meet_url"
          :title="call.meet_url ? 'Mandar el bot de grabación a esta llamada' : 'Sin link de Meet disponible'"
          @click="on_send_bot"
        >
          <i class="bi bi-robot me-1" aria-hidden="true" />
          Mandar bot
        </button>
      </div>
    </div>

    <!-- Toggle resumen (solo si hay resumen) -->
    <div v-if="call.call_summary" class="mt-2">
      <button
        type="button"
        class="btn btn-link btn-sm p-0 text-decoration-none"
        @click="summary_expanded = !summary_expanded"
      >
        <i class="bi me-1" :class="summary_expanded ? 'bi-chevron-down' : 'bi-chevron-right'" aria-hidden="true" />
        Resumen de la llamada
      </button>
      <div v-show="summary_expanded" class="mt-2">
        <CallSummaryPanel :call_summary="call.call_summary" />
      </div>
    </div>

    <!-- Toggle transcripción completa (solo si existe) -->
    <div v-if="call.transcript" class="mt-2">
      <button
        type="button"
        class="btn btn-link btn-sm p-0 text-decoration-none"
        @click="transcript_expanded = !transcript_expanded"
      >
        <i class="bi me-1" :class="transcript_expanded ? 'bi-chevron-down' : 'bi-chevron-right'" aria-hidden="true" />
        Transcripción completa
      </button>
      <div v-show="transcript_expanded" class="mt-2 p-2 bg-light rounded small" style="white-space: pre-line; max-height: 300px; overflow-y: auto;">
        {{ call.transcript }}
      </div>
    </div>

    <!-- Socios detectados/cargados en ESTA llamada -->
    <div v-if="confirmed_partners.length || pending_partners.length" class="mt-2">
      <div v-if="confirmed_partners.length" class="d-flex flex-wrap gap-2 mb-1">
        <button
          v-for="partner in confirmed_partners"
          :key="'partner-' + partner.id"
          type="button"
          class="btn btn-link btn-sm p-0 text-decoration-none text-secondary"
          @click="$emit('partner-click', partner)"
        >
          <i class="bi bi-person-fill me-1" aria-hidden="true" />
          {{ partner.name || 'Socio' }}
        </button>
      </div>
      <CloserPartnerRow
        v-for="partner in pending_partners"
        :key="'pending-' + partner.id"
        :partner="partner"
        :lead_id="lead_id"
      />
    </div>
  </div>
</template>

<script>
import CallSummaryPanel from '@/components/lead/resumen/CallSummaryPanel.vue'
import CloserPartnerRow from './CloserPartnerRow.vue'

/**
 * Fila de una llamada del closer con un lead, dentro de la sección "Seguimiento".
 * Muestra fecha, estado, resumen y transcripción colapsables, socios propios de la
 * llamada, y acciones (unirse a Meet / mandar bot manualmente).
 */
export default {
  name: 'CloserCallRow',

  components: {
    CallSummaryPanel,
    CloserPartnerRow,
  },

  emits: ['partner-click'],

  props: {
    /** LeadCall completa (meet_url, google_event_id, recall_bot_id, transcript, call_summary, estado, started_at, partners). */
    call: {
      type: Object,
      required: true,
    },
    /** ID del lead dueño de la llamada (para acciones que lo requieren). */
    lead_id: {
      type: [Number, String],
      required: true,
    },
  },

  data() {
    return {
      /** Controla visibilidad del CallSummaryPanel de esta llamada. */
      summary_expanded: false,
      /** Controla visibilidad de la transcripción completa de esta llamada. */
      transcript_expanded: false,
    }
  },

  computed: {
    /**
     * Etiqueta de fecha/hora de inicio de la llamada.
     * @returns {string}
     */
    started_at_label() {
      if (!this.call.started_at) {
        return 'Sin fecha'
      }
      const date = new Date(this.call.started_at)
      if (isNaN(date.getTime())) {
        return this.call.started_at
      }
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return day + '/' + month + '/' + year + ' ' + hours + ':' + minutes
    },
    /**
     * Clase del badge de estado de la llamada.
     * @returns {string}
     */
    estado_badge_class() {
      return this.call.estado === 'completada' ? 'bg-success' : 'bg-secondary'
    },
    /**
     * Etiqueta legible del estado de la llamada.
     * @returns {string}
     */
    estado_label() {
      return this.call.estado === 'completada' ? 'Completada' : 'Pendiente'
    },
    /**
     * Socios ya confirmados de esta llamada.
     * @returns {Array<Object>}
     */
    confirmed_partners() {
      const partners = this.call.partners || []
      return partners.filter(function (p) {
        return !p.pending_confirmation
      })
    },
    /**
     * Socios sugeridos pendientes de confirmación de esta llamada.
     * @returns {Array<Object>}
     */
    pending_partners() {
      const partners = this.call.partners || []
      return partners.filter(function (p) {
        return !!p.pending_confirmation
      })
    },
  },

  methods: {
    /**
     * Abre el Meet de esta llamada en una pestaña nueva.
     * @returns {void}
     */
    on_join_meet() {
      if (!this.call.meet_url) {
        return
      }
      window.open(this.call.meet_url, '_blank', 'noopener,noreferrer')
    },
    /**
     * Manda el bot manualmente a esta llamada puntual.
     * @returns {void}
     */
    on_send_bot() {
      this.$store.dispatch('closer/send_bot_for_call', { lead_id: this.lead_id, call_id: this.call.id })
    },
  },
}
</script>

<style lang="sass" scoped>
.closer-call-row
	background: #fff
</style>
