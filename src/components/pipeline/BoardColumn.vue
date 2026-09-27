<template>
  <!--
    Columna del tablero: una etapa con su punto de color, nombre y cantidad, y sus tarjetas.
    Es zona de "soltar": al soltar una tarjeta de otra columna avisa al tablero, que abre el modal
    de mover con esta etapa ya elegida.
  -->
  <section
    class="pl-col"
    :class="{
      'pl-col--drag-over': is_drag_over,
      'pl-col--closed': stage.type !== 'open',
    }"
    :aria-label="stage.name + ': ' + opportunities.length"
    @dragover="on_dragover"
    @drop.prevent="$emit('column-drop', $event)"
  >
    <header class="pl-col__header">
      <span class="pl-col__dot" :style="{ backgroundColor: stage.color || '#adb5bd' }" aria-hidden="true" />
      <h3 class="pl-col__title" :title="stage.name">{{ stage.name }}</h3>
      <span v-if="stage.type !== 'open'" class="pl-col__type">{{ type_label }}</span>
      <span class="pl-col__count">{{ opportunities.length }}</span>
    </header>

    <div class="pl-col__list">
      <opportunity-card
        v-for="opportunity in opportunities"
        :key="opportunity.id"
        :opportunity="opportunity"
        :is_dragging="Number(dragging_id) === Number(opportunity.id)"
        :draggable_enabled="draggable_enabled"
        @open="$emit('open', $event)"
        @move="$emit('move', $event)"
        @dragstart="$emit('card-dragstart', $event)"
        @dragend="$emit('card-dragend', $event)"
      />
      <p v-if="!opportunities.length" class="pl-col__empty">{{ is_drag_over ? 'Soltá acá' : 'Sin oportunidades' }}</p>
    </div>
  </section>
</template>

<script>
import OpportunityCard from '@/components/pipeline/OpportunityCard.vue'

/**
 * Columna (etapa) del tablero.
 */
export default {
  name: 'PipelineBoardColumn',
  components: { OpportunityCard },
  props: {
    /** Etapa: `{ id, name, color, type }`. */
    stage: { type: Object, required: true },
    /** Oportunidades que están en esta etapa (ya filtradas y ordenadas por la API). */
    opportunities: { type: Array, default: function () { return [] } },
    /** id de la oportunidad que se está arrastrando (null = ninguna). */
    dragging_id: { type: [Number, String], default: null },
    /** true cuando una tarjeta de otra columna está encima de esta. */
    is_drag_over: { type: Boolean, default: false },
    /** false = sin arrastre. */
    draggable_enabled: { type: Boolean, default: true },
  },
  emits: ['open', 'move', 'card-dragstart', 'card-dragend', 'column-dragover', 'column-drop'],
  computed: {
    /** @returns {string} */
    type_label() {
      return this.$store.getters['pipeline/label_for']('stage_types', this.stage.type)
    },
  },
  methods: {
    /**
     * Habilita soltar acá (el `preventDefault` es lo que le dice al navegador que se puede) solo
     * mientras hay una tarjeta nuestra en el aire.
     *
     * @param {DragEvent} event
     */
    on_dragover(event) {
      if (this.dragging_id === null || this.dragging_id === undefined) {
        return
      }
      event.preventDefault()
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move'
      }
      this.$emit('column-dragover', event)
    },
  },
}
</script>

<style scoped>
.pl-col {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg-hover);
  border: 1px solid transparent;
  border-radius: 12px;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.pl-col--drag-over {
  background: var(--bg-nav-hover);
  border-color: var(--color-primary);
  border-style: dashed;
}

.pl-col__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 0.8rem 0.5rem;
}

.pl-col__dot {
  flex: 0 0 auto;
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.pl-col__title {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pl-col__type {
  flex: 0 0 auto;
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.pl-col__count {
  flex: 0 0 auto;
  min-width: 1.5rem;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  background: var(--bg-card);
  font-size: 0.75rem;
  font-weight: 600;
  text-align: center;
  color: var(--color-text-secondary);
}

.pl-col__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0 0.5rem 0.6rem;
  min-height: 3rem;
}

/* Escritorio y tablet: cada columna scrollea sola, así el scroll horizontal del tablero queda a
   la vista sin bajar hasta el final de la columna más larga. En teléfono la columna crece y
   scrollea la página (sin scroll anidado vertical dentro del horizontal). */
@media (min-width: 768px) {
  .pl-col__list {
    max-height: calc(100vh - 17rem);
    min-height: 6rem;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
  }
}

.pl-col__empty {
  margin: 0;
  padding: 1rem 0.5rem;
  text-align: center;
  font-size: 0.78rem;
  color: var(--color-text-secondary);
  border: 1px dashed var(--color-border);
  border-radius: 10px;
}
</style>
