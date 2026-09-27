<template>
  <!--
    Tarjeta de una oportunidad (tablero y agenda).

    Click (o Enter) abre la ficha. En escritorio se puede arrastrar a otra columna; en pantallas
    táctiles el arrastre HTML5 no anda, así que el botón "Mover" abre el mismo modal con el selector
    de etapa. Nada se mueve en la base hasta que el modal confirma.
  -->
  <article
    class="pl-card"
    :class="{ 'pl-card--dragging': is_dragging, 'pl-card--draggable': draggable_enabled }"
    :draggable="draggable_enabled ? 'true' : 'false'"
    tabindex="0"
    role="button"
    :aria-label="'Abrir la ficha de ' + name"
    @click="$emit('open', opportunity)"
    @keydown.enter.self.prevent="$emit('open', opportunity)"
    @dragstart="on_dragstart"
    @dragend="$emit('dragend', $event)"
  >
    <div class="pl-card__top">
      <div class="pl-card__names">
        <p class="pl-card__name">{{ name }}</p>
        <p v-if="subject.secondary" class="pl-card__secondary">{{ subject.secondary }}</p>
      </div>
      <subject-type-badge :type="opportunity.subject_type" />
    </div>

    <p v-if="show_pipeline || show_stage" class="pl-card__context">
      <span v-if="show_pipeline && opportunity.pipeline" class="pl-card__pipeline">{{ opportunity.pipeline.name }}</span>
      <stage-tag v-if="show_stage" :stage="opportunity.stage" />
    </p>

    <p class="pl-card__line">
      <next-action-text :opportunity="opportunity" />
    </p>

    <p v-if="last_activity_text" class="pl-card__last" :title="last_activity_title">
      <span class="pl-card__last-text">{{ last_activity_text }}</span>
      <span v-if="last_activity_when" class="pl-card__last-when">{{ last_activity_when }}</span>
    </p>

    <div class="pl-card__footer">
      <owner-avatar :owner="opportunity.owner" />
      <span class="pl-card__days" :title="days_title">
        <i class="bi bi-hourglass-split" aria-hidden="true" />{{ days }} d
      </span>
      <button
        type="button"
        class="btn btn-sm pl-card__move"
        title="Mover a otra etapa"
        @click.stop="$emit('move', opportunity)"
        @keydown.enter.stop
      >
        <i class="bi bi-arrow-left-right" aria-hidden="true" />Mover
      </button>
    </div>
  </article>
</template>

<script>
import NextActionText from '@/components/pipeline/NextActionText.vue'
import OwnerAvatar from '@/components/pipeline/OwnerAvatar.vue'
import StageTag from '@/components/pipeline/StageTag.vue'
import SubjectTypeBadge from '@/components/pipeline/SubjectTypeBadge.vue'
import { subject_name } from '@/components/pipeline/pipeline_helpers'
import { format_datetime, format_relative } from '@/utils/pipeline_dates'

/**
 * Tarjeta de oportunidad.
 */
export default {
  name: 'PipelineOpportunityCard',
  components: { NextActionText, OwnerAvatar, StageTag, SubjectTypeBadge },
  props: {
    /** Oportunidad con la forma del contrato. */
    opportunity: { type: Object, required: true },
    /** true mientras esta tarjeta se arrastra. */
    is_dragging: { type: Boolean, default: false },
    /** false = no se puede arrastrar (agenda, o sin tablero). */
    draggable_enabled: { type: Boolean, default: false },
    /** Muestra el nombre del pipeline (agenda). */
    show_pipeline: { type: Boolean, default: false },
    /** Muestra la etapa (agenda: ahí no hay columna que la diga). */
    show_stage: { type: Boolean, default: false },
  },
  emits: ['open', 'move', 'dragstart', 'dragend'],
  computed: {
    /** @returns {Object} */
    subject() {
      return this.opportunity.subject || {}
    },
    /** @returns {string} */
    name() {
      return subject_name(this.opportunity)
    },
    /** @returns {number} */
    days() {
      const n = Number(this.opportunity.days_in_stage)
      return isNaN(n) ? 0 : n
    },
    /** @returns {string} */
    days_title() {
      return this.days === 1 ? '1 día en esta etapa' : this.days + ' días en esta etapa'
    },
    /** @returns {Object|null} */
    last_activity() {
      return this.opportunity.last_activity || null
    },
    /**
     * Última actividad en una línea: "Lucas: Atiende el dueño", o el tipo si no tiene texto.
     * @returns {string}
     */
    last_activity_text() {
      const activity = this.last_activity
      if (!activity) {
        return ''
      }
      const text = activity.body
        ? String(activity.body).replace(/\s+/g, ' ').trim()
        : this.$store.getters['pipeline/label_for']('activity_types', activity.type)
      return activity.admin_name ? activity.admin_name + ': ' + text : text
    },
    /** @returns {string} */
    last_activity_when() {
      return this.last_activity ? format_relative(this.last_activity.occurred_at) : ''
    },
    /** @returns {string} */
    last_activity_title() {
      if (!this.last_activity) {
        return ''
      }
      return 'Última actividad: ' + format_datetime(this.last_activity.occurred_at)
    },
  },
  methods: {
    /**
     * Arranque del arrastre: se avisa al tablero (que guarda cuál se arrastra).
     *
     * @param {DragEvent} event
     */
    on_dragstart(event) {
      if (!this.draggable_enabled) {
        event.preventDefault()
        return
      }
      this.$emit('dragstart', { opportunity: this.opportunity, event: event })
    },
  },
}
</script>

<style scoped>
.pl-card {
  background: var(--bg-card);
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  padding: 0.65rem 0.75rem;
  font-size: 0.85rem;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s ease, opacity 0.15s ease;
  min-width: 0;
}

.pl-card:hover {
  border-color: var(--color-border);
}

.pl-card:focus-visible {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--form-focus-ring);
}

.pl-card--draggable {
  cursor: grab;
}

.pl-card--dragging {
  opacity: 0.4;
  cursor: grabbing;
}

.pl-card p {
  margin: 0;
}

.pl-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.pl-card__names {
  min-width: 0;
  flex: 1 1 auto;
}

.pl-card__name {
  font-weight: 600;
  font-size: 0.9rem;
  line-height: 1.3;
  word-break: break-word;
}

.pl-card__secondary {
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pl-card__context {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem 0.6rem;
  margin-top: 0.35rem !important;
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}

.pl-card__pipeline {
  font-weight: 600;
}

.pl-card__line {
  display: flex;
  min-width: 0;
  margin-top: 0.45rem !important;
  font-size: 0.8rem;
}

.pl-card__last {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  min-width: 0;
  margin-top: 0.3rem !important;
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}

.pl-card__last-text {
  flex: 1 1 auto;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pl-card__last-when {
  flex: 0 0 auto;
  white-space: nowrap;
  font-size: 0.72rem;
}

.pl-card__footer {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 0.55rem;
}

.pl-card__days {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.pl-card__move {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.15rem 0.55rem;
  font-size: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--bg-card);
  color: var(--color-text-primary);
}

.pl-card__move:hover,
.pl-card__move:focus-visible {
  background: var(--bg-hover);
  border-color: var(--color-border);
}
</style>
