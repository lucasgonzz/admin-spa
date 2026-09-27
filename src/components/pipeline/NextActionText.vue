<template>
  <!--
    Próxima acción de una oportunidad en una línea: fecha (roja si está vencida, destacada si es
    hoy) y la nota. Si la oportunidad está cerrada, en su lugar va cómo terminó.
    Vencida / hoy lo decide el back (`agenda_bucket`), con su reloj: la SPA no recalcula.
  -->
  <span class="pl-next" :class="state_class" :title="title">
    <template v-if="is_closed">
      <i class="bi" :class="is_won ? 'bi-trophy' : 'bi-x-circle'" aria-hidden="true" />
      <span class="pl-next__when">{{ closed_text }}</span>
    </template>
    <template v-else-if="!has_next_action">
      <i class="bi bi-calendar" aria-hidden="true" />
      <span class="pl-next__when">Sin próxima acción</span>
    </template>
    <template v-else>
      <i
        class="bi"
        :class="bucket === 'overdue' ? 'bi-exclamation-circle' : 'bi-calendar-event'"
        aria-hidden="true"
      />
      <span class="pl-next__when">{{ when_text }}</span>
      <span v-if="show_note && opportunity.next_action_note" class="pl-next__note">· {{ opportunity.next_action_note }}</span>
    </template>
  </span>
</template>

<script>
import { format_date, format_datetime, format_short, format_time } from '@/utils/pipeline_dates'

/**
 * Texto de la próxima acción (o del cierre) de una oportunidad.
 */
export default {
  name: 'PipelineNextActionText',
  props: {
    /** Oportunidad con la forma del contrato (`next_action_at`, `agenda_bucket`, `stage`, …). */
    opportunity: { type: Object, required: true },
    /** false = solo la fecha, sin la nota. */
    show_note: { type: Boolean, default: true },
  },
  computed: {
    /** @returns {string} overdue | today | week | later | none | closed */
    bucket() {
      return this.opportunity.agenda_bucket || 'none'
    },
    /** @returns {string} */
    stage_type() {
      return (this.opportunity.stage && this.opportunity.stage.type) || 'open'
    },
    /** @returns {boolean} */
    is_closed() {
      return this.bucket === 'closed' || this.stage_type !== 'open'
    },
    /** @returns {boolean} */
    is_won() {
      return this.stage_type === 'won'
    },
    /** @returns {boolean} */
    has_next_action() {
      return !!this.opportunity.next_action_at
    },
    /**
     * "Hoy · 15:00" si el back la puso en hoy; si no, "mié 30/9 · 15:00".
     * @returns {string}
     */
    when_text() {
      if (this.bucket === 'today') {
        const time = format_time(this.opportunity.next_action_at)
        return time ? 'Hoy · ' + time : 'Hoy'
      }
      return format_short(this.opportunity.next_action_at)
    },
    /**
     * "Ganada · 26/09/2026" o "Perdida · Precio".
     * @returns {string}
     */
    closed_text() {
      const label = this.$store.getters['pipeline/label_for']('stage_types', this.stage_type)
      if (this.is_won) {
        const date = format_date(this.opportunity.closed_at)
        return date ? label + ' · ' + date : label
      }
      return this.opportunity.lost_reason ? label + ' · ' + this.opportunity.lost_reason : label
    },
    /** @returns {string} */
    state_class() {
      if (this.is_closed) {
        return this.is_won ? 'pl-next--won' : 'pl-next--lost'
      }
      if (!this.has_next_action) {
        return 'pl-next--none'
      }
      if (this.bucket === 'overdue') {
        return 'pl-next--overdue'
      }
      if (this.bucket === 'today') {
        return 'pl-next--today'
      }
      return ''
    },
    /** @returns {string} */
    title() {
      if (this.is_closed) {
        const closed = format_datetime(this.opportunity.closed_at)
        return closed ? 'Cerrada el ' + closed : ''
      }
      if (!this.has_next_action) {
        return 'Sin próxima acción'
      }
      const prefix = this.bucket === 'overdue' ? 'Vencida: ' : 'Próxima acción: '
      const note = this.opportunity.next_action_note ? ' — ' + this.opportunity.next_action_note : ''
      return prefix + format_datetime(this.opportunity.next_action_at) + note
    },
  },
}
</script>

<style scoped>
.pl-next {
  display: inline-flex;
  align-items: baseline;
  gap: 0.35rem;
  min-width: 0;
  max-width: 100%;
  color: var(--color-text-primary);
}

.pl-next .bi {
  flex: 0 0 auto;
  font-size: 0.8em;
}

.pl-next__when {
  flex: 0 0 auto;
  white-space: nowrap;
}

.pl-next__note {
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.pl-next--none,
.pl-next--none .pl-next__when {
  color: var(--color-text-secondary);
}

.pl-next--overdue .pl-next__when,
.pl-next--overdue .bi {
  color: var(--bs-danger);
  font-weight: 600;
}

.pl-next--today .pl-next__when,
.pl-next--today .bi {
  color: var(--color-primary);
  font-weight: 600;
}

.pl-next--won .pl-next__when,
.pl-next--won .bi {
  color: var(--bs-success-text-emphasis);
}

.pl-next--lost .pl-next__when,
.pl-next--lost .bi {
  color: var(--bs-danger-text-emphasis);
}

.pl-next--lost .pl-next__when {
  white-space: normal;
}
</style>
