<template>
  <!-- Etapa: punto de color + nombre, y opcionalmente el tipo (Ganada / Perdida) si está cerrada. -->
  <span class="pl-stage" :title="title">
    <span class="pl-stage__dot" :style="{ backgroundColor: color }" aria-hidden="true" />
    <span class="pl-stage__name">{{ stage ? stage.name : '—' }}</span>
    <span
      v-if="show_type && stage && stage.type !== 'open'"
      class="pl-stage__type"
      :class="stage.type === 'won' ? 'pl-stage__type--won' : 'pl-stage__type--lost'"
    >{{ type_label }}</span>
  </span>
</template>

<script>
/**
 * Etiqueta compacta de una etapa. El tipo sale del catálogo del back (`stage_types`).
 */
export default {
  name: 'PipelineStageTag',
  props: {
    /** `{ id, name, color, type }`. */
    stage: { type: Object, default: null },
    /** true = agrega "Ganada"/"Perdida" cuando la etapa es cerrada. */
    show_type: { type: Boolean, default: false },
  },
  computed: {
    /** @returns {string} */
    color() {
      return (this.stage && this.stage.color) || '#adb5bd'
    },
    /** @returns {string} */
    type_label() {
      if (!this.stage) {
        return ''
      }
      return this.$store.getters['pipeline/label_for']('stage_types', this.stage.type)
    },
    /** @returns {string} */
    title() {
      if (!this.stage) {
        return ''
      }
      return this.stage.type === 'open' ? this.stage.name : this.stage.name + ' (' + this.type_label + ')'
    },
  },
}
</script>

<style scoped>
.pl-stage {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  max-width: 100%;
}

.pl-stage__dot {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.pl-stage__name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.pl-stage__type {
  flex: 0 0 auto;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
}

.pl-stage__type--won {
  background: var(--bs-success-bg-subtle);
  color: var(--bs-success-text-emphasis);
}

.pl-stage__type--lost {
  background: var(--bs-danger-bg-subtle);
  color: var(--bs-danger-text-emphasis);
}
</style>
