<template>
  <div class="closer-partner-row border rounded-3 p-2 mb-2 bg-white">
    <div class="d-flex align-items-start justify-content-between gap-2">
      <div class="min-w-0 flex-grow-1">
        <!-- Nombre y teléfono detectados del socio -->
        <div class="fw-semibold small text-truncate">
          {{ partner.name || '(sin nombre)' }}
        </div>
        <div v-if="partner.phone" class="text-muted small">
          {{ partner.phone }}
        </div>
        <!-- Fuente de detección traducida al español -->
        <div class="text-muted small mt-1">
          <i class="bi bi-info-circle me-1" aria-hidden="true" />
          {{ source_label }}
        </div>
        <!-- Notas internas si las hay -->
        <div v-if="partner.notes" class="small mt-1 text-secondary" style="white-space: pre-line">
          {{ partner.notes }}
        </div>
      </div>
      <div class="d-flex flex-column gap-1 flex-shrink-0">
        <button
          type="button"
          class="btn btn-sm btn-success"
          :disabled="busy"
          @click="on_confirm"
        >
          Confirmar
        </button>
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          :disabled="busy"
          @click="on_discard"
        >
          Descartar
        </button>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * Fila de socio pendiente de confirmación en el panel del closer.
 * Permite confirmar (POST confirm) o descartar (DELETE) el registro sugerido.
 */
export default {
  name: 'CloserPartnerRow',

  props: {
    /** Registro LeadPartner con pending_confirmation = true. */
    partner: {
      type: Object,
      required: true,
    },
    /** Lead padre al que pertenece el socio (para mutar el array local). */
    lead_id: {
      type: [Number, String],
      required: true,
    },
  },

  emits: ['confirmed', 'discarded'],

  data() {
    return {
      /** true mientras hay una acción en curso contra la API. */
      busy: false,
    }
  },

  computed: {
    /**
     * Etiqueta legible de la fuente de detección del socio.
     *
     * @returns {string}
     */
    source_label() {
      const map = {
        call_transcript: 'Detectado en transcripción',
        whatsapp_suggestion: 'Mencionado en WhatsApp',
        manual: 'Manual',
      }
      const source = this.partner && this.partner.source ? this.partner.source : ''
      return map[source] || 'Origen desconocido'
    },
  },

  methods: {
    /**
     * Confirma el socio vía store y emite evento al padre.
     *
     * @returns {void}
     */
    on_confirm() {
      const self = this
      if (self.busy) {
        return
      }
      self.busy = true
      self.$store
        .dispatch('closer/confirm_partner', self.partner.id)
        .then(function () {
          self.$emit('confirmed', self.partner.id)
        })
        .catch(function () {
          return null
        })
        .then(function () {
          self.busy = false
        })
    },
    /**
     * Descarta el socio vía store y emite evento al padre.
     *
     * @returns {void}
     */
    on_discard() {
      const self = this
      if (self.busy) {
        return
      }
      self.busy = true
      self.$store
        .dispatch('closer/discard_partner', {
          partner_id: self.partner.id,
          lead_id: self.lead_id,
        })
        .then(function () {
          self.$emit('discarded', self.partner.id)
        })
        .catch(function () {
          return null
        })
        .then(function () {
          self.busy = false
        })
    },
  },
}
</script>
