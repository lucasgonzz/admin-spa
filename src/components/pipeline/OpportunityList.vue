<template>
  <!--
    Vista de listado del tablero: las mismas oportunidades (misma forma, mismo endpoint) en una
    tabla. En teléfono la tabla scrollea a lo ancho dentro de su propio contenedor; la página no.
  -->
  <div>
    <p v-if="!opportunities.length" class="pl-list__empty">{{ empty_message }}</p>
    <div v-else class="pl-list-wrap">
      <table class="table table-hover align-middle mb-0 pl-list">
        <thead>
          <tr>
            <th>Cliente / lead</th>
            <th>Etapa</th>
            <th>Próxima acción</th>
            <th>Responsable</th>
            <th class="text-end">Días</th>
            <th>Última actividad</th>
            <th class="text-end"><span class="visually-hidden">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="opportunity in opportunities"
            :key="opportunity.id"
            class="pl-list__row"
            tabindex="0"
            @click="$emit('open', opportunity)"
            @keydown.enter.self="$emit('open', opportunity)"
          >
            <td>
              <div class="pl-list__cell pl-list__cell--subject">
                <div class="pl-list__subject-line">
                  <span class="pl-list__name">{{ subject_name(opportunity) }}</span>
                  <subject-type-badge :type="opportunity.subject_type" />
                </div>
                <div v-if="opportunity.subject && opportunity.subject.secondary" class="pl-list__secondary">
                  {{ opportunity.subject.secondary }}
                </div>
              </div>
            </td>
            <td><div class="pl-list__cell pl-list__cell--stage"><stage-tag :stage="opportunity.stage" show_type /></div></td>
            <td><div class="pl-list__cell pl-list__cell--next"><next-action-text :opportunity="opportunity" /></div></td>
            <td><div class="pl-list__cell pl-list__cell--owner"><owner-avatar :owner="opportunity.owner" with_name /></div></td>
            <td class="text-end pl-list__days" :title="days_title(opportunity)">{{ opportunity.days_in_stage }}</td>
            <td>
              <div class="pl-list__cell pl-list__cell--last" :title="last_activity_title(opportunity)">
                {{ last_activity_text(opportunity) }}
              </div>
            </td>
            <td class="text-end">
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary pl-list__move"
                @click.stop="$emit('move', opportunity)"
                @keydown.enter.stop
              >
                <i class="bi bi-arrow-left-right" aria-hidden="true" />Mover
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import NextActionText from '@/components/pipeline/NextActionText.vue'
import OwnerAvatar from '@/components/pipeline/OwnerAvatar.vue'
import StageTag from '@/components/pipeline/StageTag.vue'
import SubjectTypeBadge from '@/components/pipeline/SubjectTypeBadge.vue'
import { subject_name } from '@/components/pipeline/pipeline_helpers'
import { format_datetime, format_relative } from '@/utils/pipeline_dates'

/**
 * Listado de oportunidades.
 */
export default {
  name: 'PipelineOpportunityList',
  components: { NextActionText, OwnerAvatar, StageTag, SubjectTypeBadge },
  props: {
    /** Oportunidades en el orden de la API. */
    opportunities: { type: Array, default: function () { return [] } },
    /** Texto cuando no hay filas. */
    empty_message: { type: String, default: 'No hay oportunidades con estos filtros.' },
  },
  emits: ['open', 'move'],
  methods: {
    subject_name,
    /**
     * @param {Object} opportunity
     * @returns {string}
     */
    days_title(opportunity) {
      const n = Number(opportunity.days_in_stage) || 0
      return n === 1 ? '1 día en la etapa' : n + ' días en la etapa'
    },
    /**
     * @param {Object} opportunity
     * @returns {string}
     */
    last_activity_text(opportunity) {
      const activity = opportunity.last_activity
      if (!activity) {
        return '—'
      }
      const text = activity.body
        ? String(activity.body).replace(/\s+/g, ' ').trim()
        : this.$store.getters['pipeline/label_for']('activity_types', activity.type)
      const who = activity.admin_name ? activity.admin_name + ': ' : ''
      const when = format_relative(activity.occurred_at)
      return who + text + (when ? ' · ' + when : '')
    },
    /**
     * @param {Object} opportunity
     * @returns {string}
     */
    last_activity_title(opportunity) {
      const activity = opportunity.last_activity
      if (!activity) {
        return ''
      }
      return format_datetime(activity.occurred_at) + (activity.body ? ' — ' + activity.body : '')
    },
  },
}
</script>

<style scoped>
.pl-list__empty {
  margin: 0;
  padding: 2rem 1rem;
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 0.9rem;
  border: 1px dashed var(--color-border);
  border-radius: 12px;
}

/* El scroll horizontal es de este contenedor (dos declaraciones: un `overflow: hidden` pisaría
   el `overflow-x`). La tabla tiene un ancho mínimo para que en teléfono no se aplaste. */
.pl-list-wrap {
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  border-radius: 7px;
}

.pl-list {
  min-width: 860px;
  font-size: 0.875rem;
}

.pl-list th {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-weight: 600;
  white-space: nowrap;
}

.pl-list__row {
  cursor: pointer;
}

.pl-list__row:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

/* El ancho máximo va en un div interno: en una tabla de layout automático el `max-width` de la
   celda no se respeta y el texto largo estiraría la columna en vez de cortarse. */
.pl-list__cell {
  min-width: 0;
}

.pl-list__cell--subject {
  max-width: 16rem;
}

.pl-list__cell--stage,
.pl-list__cell--owner {
  max-width: 11rem;
  display: flex;
}

.pl-list__cell--next {
  max-width: 16rem;
  display: flex;
}

.pl-list__cell--last {
  max-width: 18rem;
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pl-list__subject-line {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.pl-list__name {
  font-weight: 600;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pl-list__secondary {
  font-size: 0.78rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pl-list__days {
  white-space: nowrap;
}

.pl-list__move {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  white-space: nowrap;
}
</style>
