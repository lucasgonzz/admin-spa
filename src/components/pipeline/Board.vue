<template>
  <!--
    Tablero kanban: una columna por etapa (abiertas en orden y al final las cerradas).

    🔴 El scroll horizontal es de ESTE contenedor, nunca de la página: las columnas tienen ancho
    fijo (~85vw en teléfono, con scroll-snap para que cada deslizamiento deje una columna entera)
    y el contenedor se queda en el ancho de su padre.

    Arrastrar (HTML5 nativo, como TaskColumn) no mueve nada: al soltar en otra columna se emite
    `move` con esa etapa y el padre abre el modal. Si el modal se cancela, la tarjeta sigue donde
    estaba porque la lista nunca se tocó.
  -->
  <div class="pl-board" role="list" aria-label="Tablero de oportunidades">
    <board-column
      v-for="stage in stages"
      :key="stage.id"
      class="pl-board__column"
      role="listitem"
      :stage="stage"
      :opportunities="opportunities_by_stage[stage.id] || []"
      :dragging_id="dragging_id"
      :is_drag_over="is_drag_target(stage)"
      :draggable_enabled="draggable_enabled"
      @open="$emit('open', $event)"
      @move="$emit('move', { opportunity: $event, stage_id: null })"
      @card-dragstart="on_drag_start"
      @card-dragend="on_drag_end"
      @column-dragover="drag_over_stage_id = stage.id"
      @column-drop="on_drop(stage, $event)"
    />
  </div>
</template>

<script>
import BoardColumn from '@/components/pipeline/BoardColumn.vue'

/**
 * Tablero de un pipeline.
 */
export default {
  name: 'PipelineBoard',
  components: { BoardColumn },
  props: {
    /** Etapas ya ordenadas para el tablero. */
    stages: { type: Array, default: function () { return [] } },
    /** Oportunidades a repartir en las columnas (en el orden de la API). */
    opportunities: { type: Array, default: function () { return [] } },
    /** false = sin arrastre (solo botón "Mover"). */
    draggable_enabled: { type: Boolean, default: true },
  },
  emits: ['open', 'move'],
  data() {
    return {
      /** Oportunidad que se está arrastrando. */
      dragging_id: null,
      /** Etapa de la que salió la tarjeta arrastrada. */
      dragging_from_stage_id: null,
      /** Etapa sobre la que está pasando. */
      drag_over_stage_id: null,
    }
  },
  computed: {
    /**
     * Oportunidades agrupadas por etapa, respetando el orden en que las mandó la API.
     * @returns {Object<string, Array<Object>>}
     */
    opportunities_by_stage() {
      const groups = {}
      this.opportunities.forEach(function (opportunity) {
        const key = opportunity.stage_id
        if (!groups[key]) {
          groups[key] = []
        }
        groups[key].push(opportunity)
      })
      return groups
    },
  },
  methods: {
    /**
     * @param {Object} stage
     * @returns {boolean} true si hay que resaltar la columna como destino.
     */
    is_drag_target(stage) {
      return this.dragging_id !== null
        && Number(this.drag_over_stage_id) === Number(stage.id)
        && Number(this.dragging_from_stage_id) !== Number(stage.id)
    },
    /**
     * @param {{ opportunity: Object, event: DragEvent }} payload
     */
    on_drag_start(payload) {
      const opportunity = payload.opportunity
      const event = payload.event
      this.dragging_id = opportunity.id
      this.dragging_from_stage_id = opportunity.stage_id
      this.drag_over_stage_id = null
      if (event && event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move'
        // Firefox no arranca el arrastre sin datos.
        event.dataTransfer.setData('text/plain', String(opportunity.id))
      }
    },
    on_drag_end() {
      this.dragging_id = null
      this.dragging_from_stage_id = null
      this.drag_over_stage_id = null
    },
    /**
     * Se soltó una tarjeta en una columna: si es otra etapa, el padre abre el modal.
     *
     * @param {Object} stage
     * @param {DragEvent} event
     */
    on_drop(stage, event) {
      let id = this.dragging_id
      if ((id === null || id === undefined) && event && event.dataTransfer) {
        id = event.dataTransfer.getData('text/plain')
      }
      this.on_drag_end()
      if (id === null || id === undefined || id === '') {
        return
      }
      const opportunity = this.opportunities.find(function (o) {
        return Number(o.id) === Number(id)
      })
      if (!opportunity || Number(opportunity.stage_id) === Number(stage.id)) {
        return
      }
      this.$emit('move', { opportunity: opportunity, stage_id: stage.id })
    },
  },
}
</script>

<style scoped>
.pl-board {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 0.75rem;
  scroll-snap-type: x proximity;
  scroll-padding-left: 0.25rem;
  overscroll-behavior-x: contain;
  scrollbar-width: thin;
}

.pl-board__column {
  flex: 0 0 272px;
  scroll-snap-align: start;
}

@media (min-width: 1600px) {
  .pl-board__column {
    flex-basis: 288px;
  }
}

/* Teléfono: una columna por pantalla (con un borde de la siguiente a la vista, para que se note
   que hay más) y el deslizamiento se detiene siempre en una columna entera. */
@media (max-width: 767.98px) {
  .pl-board {
    scroll-snap-type: x mandatory;
    gap: 0.6rem;
  }

  .pl-board__column {
    flex-basis: 85vw;
    max-width: 22rem;
  }
}
</style>
