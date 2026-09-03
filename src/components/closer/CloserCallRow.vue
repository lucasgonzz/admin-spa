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

    <!-- Toggle resumen (solo si hay resumen): abre modal en vez de expandir inline -->
    <div v-if="call.call_summary" class="mt-2">
      <button
        type="button"
        class="btn btn-link btn-sm p-0 text-decoration-none"
        @click="summary_expanded = true"
      >
        <i class="bi bi-chevron-right me-1" aria-hidden="true" />
        Resumen de la llamada
      </button>
      <BaseModal
        :show="summary_expanded"
        title="Resumen de la llamada"
        size="lg"
        @update:show="v => summary_expanded = v"
        @close="summary_expanded = false"
      >
        <CallSummaryPanel :call_summary="call.call_summary" />
      </BaseModal>
    </div>

    <!-- Toggle transcripción completa (solo si existe): abre modal en vez de expandir inline -->
    <div v-if="call.transcript" class="mt-2">
      <button
        type="button"
        class="btn btn-link btn-sm p-0 text-decoration-none"
        @click="transcript_expanded = true"
      >
        <i class="bi bi-chevron-right me-1" aria-hidden="true" />
        Transcripción completa
      </button>
      <BaseModal
        :show="transcript_expanded"
        title="Transcripción completa"
        size="lg"
        @update:show="v => transcript_expanded = v"
        @close="transcript_expanded = false"
      >
        <button
          type="button"
          class="btn btn-sm mb-2"
          :class="copied_feedback ? 'btn-success' : 'btn-outline-secondary'"
          @click="on_copy_transcript"
        >
          <i class="bi" :class="copied_feedback ? 'bi-check-lg' : 'bi-clipboard'" aria-hidden="true" />
          {{ copied_feedback ? 'Copiado' : 'Copiar' }}
        </button>
        <div class="p-2 bg-light rounded small" style="white-space: pre-line; max-height: 60vh; overflow-y: auto;">
          {{ call.transcript }}
        </div>
      </BaseModal>
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
import BaseModal from '@/components/ui/BaseModal.vue'
import { with_authuser } from '@/utils/meet'
import { copy_text_to_clipboard } from '@/utils/version_notification_clipboard'

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
    BaseModal,
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
      /** Controla visibilidad del modal de resumen de esta llamada. */
      summary_expanded: false,
      /** Controla visibilidad del modal de transcripción completa de esta llamada. */
      transcript_expanded: false,
      /** true mientras se muestra el feedback "Copiado" tras copiar la transcripción. */
      copied_feedback: false,
      /** Id del setTimeout que apaga el feedback, para poder cancelarlo si se copia de nuevo. */
      copied_feedback_timer: null,
    }
  },

  beforeUnmount() {
    /* Limpiar el timer del feedback para no dejarlo apuntando a un componente muerto. */
    if (this.copied_feedback_timer) {
      clearTimeout(this.copied_feedback_timer)
    }
  },

  computed: {
    /**
     * Etiqueta de fecha/hora de inicio de la llamada.
     * @returns {string}
     */
    started_at_label() {
      /* Una llamada agendada por el agente todavía no arrancó: no tiene `started_at` pero sí
       * `scheduled_at`, y mostrar "Sin fecha" cuando hay un horario acordado es peor que no
       * mostrar nada. */
      const raw = this.call.started_at || this.call.scheduled_at
      if (!raw) {
        return 'Sin fecha'
      }
      const date = new Date(raw)
      if (isNaN(date.getTime())) {
        return raw
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
     * Abre el Meet de esta llamada en una pestaña nueva, forzando la cuenta de Google con la
     * que se creó el evento (ver `utils/meet.js`: sin eso Google le pide al closer que el
     * anfitrión lo admita, aunque el anfitrión sea él mismo).
     * @returns {void}
     */
    on_join_meet() {
      if (!this.call.meet_url) {
        return
      }
      const settings = this.$store.state.closer.settings || {}
      window.open(
        with_authuser(this.call.meet_url, settings.closer_google_account),
        '_blank',
        'noopener,noreferrer'
      )
    },
    /**
     * Manda el bot manualmente a esta llamada puntual.
     * @returns {void}
     */
    on_send_bot() {
      this.$store.dispatch('closer/send_bot_for_call', { lead_id: this.lead_id, call_id: this.call.id })
    },
    /**
     * Copia la transcripción completa al portapapeles y muestra feedback por 2 segundos.
     * Mismo patrón que `DemoIngresoLink.vue`.
     * @returns {void}
     */
    on_copy_transcript() {
      var self = this
      if (!this.call.transcript) {
        return
      }
      copy_text_to_clipboard(this.call.transcript)
        .then(function () {
          self.copied_feedback = true
          if (self.copied_feedback_timer) {
            clearTimeout(self.copied_feedback_timer)
          }
          self.copied_feedback_timer = setTimeout(function () {
            self.copied_feedback = false
            self.copied_feedback_timer = null
          }, 2000)
        })
        .catch(function () {
          alert('No se pudo copiar la transcripción al portapapeles.')
        })
    },
  },
}
</script>

<style lang="sass" scoped>
.closer-call-row
	background: #fff
</style>
