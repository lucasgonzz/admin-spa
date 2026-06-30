<template>
  <div class="closer-lead-card card border-0 shadow-sm mb-3">
    <div class="card-body p-3">
      <!-- Encabezado: nombre, indicador en vivo y badge de estado -->
      <div class="d-flex align-items-start justify-content-between gap-2 mb-2">
        <div class="min-w-0">
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <span class="fw-semibold">{{ lead_display_name }}</span>
            <!-- Pulso verde cuando la demo está en horario activo (sección en_curso) -->
            <span
              v-if="section === 'en_curso' && demo_is_live"
              class="closer-live-badge badge bg-success"
              title="Demo en horario activo"
            >
              <span class="closer-live-dot" aria-hidden="true" />
              En vivo
            </span>
          </div>
          <!-- Socios confirmados debajo del nombre -->
          <div v-if="confirmed_partners.length" class="mt-1 d-flex flex-wrap gap-2">
            <button
              v-for="partner in confirmed_partners"
              :key="'partner-' + partner.id"
              type="button"
              class="btn btn-link btn-sm p-0 text-secondary closer-partner-chip"
              :title="partner_chip_title(partner)"
              @click="on_partner_click(partner)"
            >
              <i class="bi bi-person-fill me-1" aria-hidden="true" />
              {{ partner.name || 'Socio' }}
            </button>
          </div>
        </div>
        <span
          v-if="status_badge.label"
          class="badge flex-shrink-0"
          :class="status_badge.class_name"
        >
          {{ status_badge.label }}
        </span>
      </div>

      <!-- Meta contextual según sección -->
      <div class="small text-muted mb-2">
        <template v-if="section === 'en_curso' || section === 'agendadas'">
          <i class="bi bi-clock me-1" aria-hidden="true" />
          {{ demo_datetime_label }}
        </template>
        <template v-else-if="section === 'seguimiento'">
          <i class="bi bi-telephone me-1" aria-hidden="true" />
          Llamada: {{ closer_called_label }}
        </template>
      </div>

      <!-- Resumen estructurado en agendadas (empresa + situación) -->
      <div
        v-if="section === 'agendadas' && demo_summary_preview"
        class="small text-secondary mb-2 closer-summary-preview"
        :title="demo_summary_tooltip"
      >
        {{ demo_summary_preview }}
      </div>

      <!-- Escenario y próximo paso en seguimiento -->
      <div v-if="section === 'seguimiento' && call_summary_parsed" class="mb-2">
        <span class="badge me-2" :class="escenario_badge_class">
          {{ escenario_label }}
        </span>
        <span v-if="call_summary_parsed.proximo_paso" class="small text-secondary">
          {{ call_summary_parsed.proximo_paso }}
        </span>
      </div>

      <!-- Socios pendientes de confirmación (colapsable) -->
      <div v-if="pending_partners.length" class="mb-2">
        <button
          type="button"
          class="btn btn-link btn-sm p-0 text-decoration-none closer-partners-toggle"
          @click="partners_expanded = !partners_expanded"
        >
          <i
            class="bi me-1"
            :class="partners_expanded ? 'bi-chevron-down' : 'bi-chevron-right'"
            aria-hidden="true"
          />
          Socios detectados ({{ pending_partners.length }})
        </button>
        <div v-show="partners_expanded" class="mt-2">
          <CloserPartnerRow
            v-for="partner in pending_partners"
            :key="'pending-' + partner.id"
            :partner="partner"
            :lead_id="lead.id"
          />
        </div>
      </div>

      <!-- Resumen de llamada colapsable (solo seguimiento) -->
      <div v-if="section === 'seguimiento' && call_summary_parsed" class="mb-2">
        <button
          type="button"
          class="btn btn-link btn-sm p-0 text-decoration-none"
          @click="summary_expanded = !summary_expanded"
        >
          <i
            class="bi me-1"
            :class="summary_expanded ? 'bi-chevron-down' : 'bi-chevron-right'"
            aria-hidden="true"
          />
          Resumen de llamada
        </button>
        <div v-show="summary_expanded" class="mt-2">
          <CallSummaryPanel :call_summary="lead.call_summary" />
        </div>
      </div>

      <!-- Acciones principales -->
      <div class="d-flex flex-wrap gap-2 mt-2">
        <button
          v-if="section === 'en_curso'"
          type="button"
          class="btn btn-sm btn-primary"
          :disabled="!lead.meet_url"
          :title="lead.meet_url ? 'Unirse a la llamada y enviar bot de grabación' : 'Sin link de Meet disponible'"
          @click="join_meet"
        >
          <i class="bi bi-camera-video me-1" aria-hidden="true" />
          Unirse a Meet
        </button>

        <button
          type="button"
          class="btn btn-sm"
          :class="section === 'en_curso' ? 'btn-outline-secondary' : 'btn-primary'"
          @click="go_to_conversation"
        >
          <i class="bi bi-chat-dots me-1" aria-hidden="true" />
          Ver conversación
        </button>

        <a
          v-if="section === 'seguimiento' && whatsapp_href"
          :href="whatsapp_href"
          target="_blank"
          rel="noopener noreferrer"
          class="btn btn-sm btn-success"
        >
          <i class="bi bi-whatsapp me-1" aria-hidden="true" />
          WhatsApp
        </a>
      </div>
    </div>
  </div>
</template>

<script>
import CallSummaryPanel from '@/components/lead/resumen/CallSummaryPanel.vue'
import CloserPartnerRow from './CloserPartnerRow.vue'

/** Etiquetas legibles de estados frecuentes en el panel del closer. */
const STATUS_LABELS = {
  demo_agendada: 'Demo agendada',
  solicita_disponibilidad: 'Solicita disponibilidad',
  ingresando_demo: 'Ingresando a demo',
  demo_en_curso: 'Demo en curso',
  demo_pendiente_de_ingreso: 'Pendiente de ingreso',
  demo_pendiente_de_terminar: 'Pendiente de terminar',
  demo_realizada: 'Demo realizada',
  closer_activo: 'En seguimiento',
}

/** Clases Bootstrap para badges de estado (alineadas al catálogo de colores del módulo leads). */
const STATUS_BADGE_CLASSES = {
  solicita_disponibilidad: 'bg-primary',
  demo_agendada: 'badge-demo-agendada',
  ingresando_demo: 'bg-danger',
  demo_en_curso: 'bg-warning text-dark',
  demo_pendiente_de_ingreso: 'bg-danger',
  demo_pendiente_de_terminar: 'bg-danger',
  demo_realizada: 'bg-primary',
  closer_activo: 'bg-success',
}

/**
 * Tarjeta compacta de un lead dentro del panel del closer.
 * Adapta contenido y acciones según la sección (en_curso, agendadas, seguimiento).
 */
export default {
  name: 'CloserLeadCard',

  components: {
    CallSummaryPanel,
    CloserPartnerRow,
  },

  props: {
    /** Lead completo devuelto por GET /closer/panel. */
    lead: {
      type: Object,
      required: true,
    },
    /** Sección del panel donde se renderiza la card. */
    section: {
      type: String,
      required: true,
      validator: function (value) {
        return ['en_curso', 'agendadas', 'seguimiento'].indexOf(value) !== -1
      },
    },
  },

  data() {
    return {
      /** Controla visibilidad de socios pendientes. */
      partners_expanded: false,
      /** Controla visibilidad del CallSummaryPanel en seguimiento. */
      summary_expanded: false,
    }
  },

  computed: {
    /**
     * Nombre visible del lead en la card.
     *
     * @returns {string}
     */
    lead_display_name() {
      const name = (this.lead.contact_name || '').trim()
      if (name) {
        return name
      }
      return 'Lead #' + this.lead.id
    },
    /**
     * Badge de estado actual del lead.
     *
     * @returns {{ label: string, class_name: string }}
     */
    status_badge() {
      const status = this.lead.status || ''
      const label = STATUS_LABELS[status] || status.replace(/_/g, ' ')
      const class_name = STATUS_BADGE_CLASSES[status] || 'bg-secondary'
      return { label: label, class_name: class_name }
    },
    /**
     * Texto de fecha y hora de demo para en_curso y agendadas.
     *
     * @returns {string}
     */
    demo_datetime_label() {
      const parts = []
      if (this.lead.demo_date) {
        parts.push(this.format_date(this.lead.demo_date))
      }
      if (this.lead.demo_start_time) {
        parts.push('a las ' + this.lead.demo_start_time)
      }
      if (!parts.length) {
        return 'Sin fecha de demo'
      }
      return parts.join(' ')
    },
    /**
     * Fecha formateada de la llamada del closer.
     *
     * @returns {string}
     */
    closer_called_label() {
      if (!this.lead.closer_called_at) {
        return '—'
      }
      return this.format_datetime(this.lead.closer_called_at)
    },
    /**
     * Preview corto del resumen estructurado para la card de agendadas.
     *
     * @returns {string}
     */
    demo_summary_preview() {
      const structured = this.lead.demo_summary_structured
      if (!structured || typeof structured !== 'object') {
        return ''
      }
      const empresa = structured.empresa ? String(structured.empresa).trim() : ''
      const situacion = structured.situacion_actual ? String(structured.situacion_actual).trim() : ''
      if (empresa && situacion) {
        return empresa + ' — ' + situacion
      }
      return empresa || situacion || ''
    },
    /**
     * Tooltip con el resumen estructurado completo.
     *
     * @returns {string}
     */
    demo_summary_tooltip() {
      const structured = this.lead.demo_summary_structured
      if (!structured || typeof structured !== 'object') {
        return ''
      }
      const lines = []
      if (structured.empresa) {
        lines.push('Empresa: ' + structured.empresa)
      }
      if (structured.situacion_actual) {
        lines.push('Situación: ' + structured.situacion_actual)
      }
      return lines.join('\n')
    },
    /**
     * call_summary parseado como objeto JS.
     *
     * @returns {Object|null}
     */
    call_summary_parsed() {
      const raw = this.lead.call_summary
      if (!raw) {
        return null
      }
      if (typeof raw === 'object') {
        return raw
      }
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw)
        } catch (e) {
          return null
        }
      }
      return null
    },
    /**
     * Clase del badge de escenario de cierre (A/B/C/D).
     *
     * @returns {string}
     */
    escenario_badge_class() {
      const escenario = this.call_summary_parsed ? this.call_summary_parsed.escenario_cierre : null
      const map = {
        A: 'bg-success',
        B: 'bg-warning text-dark',
        C: 'bg-info text-dark',
        D: 'bg-danger',
      }
      return map[escenario] || 'bg-secondary'
    },
    /**
     * Etiqueta del escenario de cierre.
     *
     * @returns {string}
     */
    escenario_label() {
      const escenario = this.call_summary_parsed ? this.call_summary_parsed.escenario_cierre : null
      const labels = {
        A: 'Cerró',
        B: 'Reunión con Lucas',
        C: 'Seguimiento',
        D: 'No avanza',
      }
      return labels[escenario] || 'Sin determinar'
    },
    /**
     * Socios ya confirmados por el closer.
     *
     * @returns {Array<Object>}
     */
    confirmed_partners() {
      const partners = this.lead.partners || []
      return partners.filter(function (p) {
        return !p.pending_confirmation
      })
    },
    /**
     * Socios sugeridos pendientes de confirmación.
     *
     * @returns {Array<Object>}
     */
    pending_partners() {
      const partners = this.lead.partners || []
      return partners.filter(function (p) {
        return !!p.pending_confirmation
      })
    },
    /**
     * Link wa.me del lead para la sección seguimiento.
     *
     * @returns {string}
     */
    whatsapp_href() {
      return this.build_whatsapp_href(this.lead.phone)
    },
    /**
     * true si la hora actual cae dentro del slot de demo (inicio + 60 min, hoy).
     *
     * @returns {boolean}
     */
    demo_is_live() {
      return this.demo_is_in_progress(this.lead)
    },
  },

  methods: {
    /**
     * Navega a la vista fullscreen de conversación del lead.
     *
     * @returns {void}
     */
    go_to_conversation() {
      this.$router.push({
        name: 'lead_conversation',
        params: { lead_id: this.lead.id },
      })
    },
    /**
     * Abre Google Meet en nueva pestaña y dispara el bot Recall.ai en background.
     * Fire-and-forget: el Meet se abre de inmediato; el bot se envía sin bloquear.
     *
     * @returns {void}
     */
    join_meet: function () {
      if (!this.lead.meet_url) {
        return
      }

      /* Abrir Meet inmediatamente sin esperar al bot. */
      window.open(this.lead.meet_url, '_blank', 'noopener,noreferrer')

      /* Disparar el bot en background — no await, no spinner. */
      this.$store.dispatch('closer/send_recall_bot', this.lead.id)
    },
    /**
     * Al clic en socio confirmado: abre WhatsApp si hay teléfono, sino alerta con datos.
     *
     * @param {Object} partner
     * @returns {void}
     */
    on_partner_click(partner) {
      const href = this.build_whatsapp_href(partner.phone)
      if (href) {
        window.open(href, '_blank', 'noopener,noreferrer')
        return
      }
      const lines = []
      if (partner.name) {
        lines.push('Nombre: ' + partner.name)
      }
      if (partner.notes) {
        lines.push('Notas: ' + partner.notes)
      }
      window.alert(lines.length ? lines.join('\n') : 'Sin datos de contacto del socio.')
    },
    /**
     * Título del chip de socio confirmado.
     *
     * @param {Object} partner
     * @returns {string}
     */
    partner_chip_title(partner) {
      if (partner.phone) {
        return partner.name + ' — ' + partner.phone
      }
      return partner.name || 'Socio confirmado'
    },
    /**
     * Construye URL wa.me normalizando el teléfono a dígitos.
     *
     * @param {string|null|undefined} phone
     * @returns {string}
     */
    build_whatsapp_href(phone) {
      if (!phone) {
        return ''
      }
      const digits = String(phone).replace(/\D/g, '')
      if (!digits) {
        return ''
      }
      return 'https://wa.me/' + digits
    },
    /**
     * Formatea demo_date a DD/MM/YYYY (Día) usando fecha local sin timezone.
     *
     * @param {string} date_raw
     * @returns {string}
     */
    format_date(date_raw) {
      const key = (date_raw + '').substring(0, 10)
      const parts = key.split('-')
      if (parts.length !== 3) {
        return key
      }
      const weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
      const local_date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
      const weekday = weekdays[local_date.getDay()] || ''
      return parts[2] + '/' + parts[1] + '/' + parts[0] + ' (' + weekday + ')'
    },
    /**
     * Formatea datetime ISO a fecha + hora local legible.
     *
     * @param {string} datetime_raw
     * @returns {string}
     */
    format_datetime(datetime_raw) {
      const date = new Date(datetime_raw)
      if (isNaN(date.getTime())) {
        return datetime_raw
      }
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return day + '/' + month + '/' + year + ' ' + hours + ':' + minutes
    },
    /**
     * Normaliza demo_date del lead a YYYY-MM-DD.
     *
     * @param {Object} lead
     * @returns {string|null}
     */
    parse_demo_date_key(lead) {
      if (!lead || !lead.demo_date) {
        return null
      }
      return (lead.demo_date + '').substring(0, 10)
    },
    /**
     * Bounds de la demo en minutos desde medianoche (duración 60 min).
     *
     * @param {Object} lead
     * @returns {{ date_key: string, start_minutes: number, end_minutes: number }|null}
     */
    get_demo_time_bounds(lead) {
      const date_key = this.parse_demo_date_key(lead)
      if (!date_key || !lead.demo_start_time) {
        return null
      }
      const match = (lead.demo_start_time + '').match(/(\d{1,2}):(\d{2})/)
      if (!match) {
        return null
      }
      const start_minutes = parseInt(match[1], 10) * 60 + parseInt(match[2], 10)
      const end_minutes = start_minutes + 60
      return {
        date_key: date_key,
        start_minutes: start_minutes,
        end_minutes: end_minutes,
      }
    },
    /**
     * Indica si la demo está en curso según fecha/hora actual.
     *
     * @param {Object} lead
     * @returns {boolean}
     */
    demo_is_in_progress(lead) {
      const bounds = this.get_demo_time_bounds(lead)
      if (!bounds) {
        return false
      }
      const today = new Date()
      const today_str = today.getFullYear()
        + '-' + String(today.getMonth() + 1).padStart(2, '0')
        + '-' + String(today.getDate()).padStart(2, '0')
      if (bounds.date_key !== today_str) {
        return false
      }
      const now_minutes = today.getHours() * 60 + today.getMinutes()
      return now_minutes >= bounds.start_minutes && now_minutes < bounds.end_minutes
    },
  },
}
</script>

<style lang="sass" scoped>
.closer-lead-card
	transition: box-shadow 0.15s ease
	&:hover
		box-shadow: 0 0.25rem 0.75rem rgba(0, 0, 0, 0.08) !important

.closer-summary-preview
	display: -webkit-box
	-webkit-line-clamp: 2
	-webkit-box-orient: vertical
	overflow: hidden

.closer-partner-chip
	font-size: 0.8125rem
	line-height: 1.2

.closer-live-badge
	display: inline-flex
	align-items: center
	gap: 0.35rem
	font-weight: 600

.closer-live-dot
	display: inline-block
	width: 8px
	height: 8px
	border-radius: 50%
	background: #fff
	animation: closer-live-pulse 1.2s ease-in-out infinite

@keyframes closer-live-pulse
	0%, 100%
		opacity: 1
		transform: scale(1)
	50%
		opacity: 0.5
		transform: scale(0.85)

/* Azul fuerte de demo agendada (mismo hex que el catálogo del pipeline). */
.badge-demo-agendada
	background-color: #0a58ca
	color: #fff
</style>
