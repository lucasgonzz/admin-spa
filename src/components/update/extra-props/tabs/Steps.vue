<template>
  <div class="row g-3">
    <div class="col-md-6">
      <h6 class="fw-bold text-muted mb-3">Tareas previas</h6>
      <step-item
        v-for="step in pre_steps"
        :key="step.key"
        :step="step"
        :update="update"
        :loading="loading"
        @mark="$emit('mark-step', { step: $event, unmark: false })"
        @unmark="$emit('mark-step', { step: $event, unmark: true })"
      />
    </div>
    <div class="col-md-6">
      <h6 class="fw-bold text-muted mb-3">
        Tareas post-cierre del negocio
        <small class="text-warning fw-normal">&#9888; Realizar cuando el negocio esté cerrado</small>
      </h6>
      <step-item
        v-for="step in post_steps"
        :key="step.key"
        :step="step"
        :update="update"
        :loading="loading"
        @mark="$emit('mark-step', { step: $event, unmark: false })"
        @unmark="$emit('mark-step', { step: $event, unmark: true })"
      />
    </div>
  </div>
</template>

<script>
import { STEPS } from '@/utils/update_status'
import StepItem from '../step/Item.vue'

/**
 * Pestaña "Pasos": divide los 6 pasos del proceso en pre/post cierre del negocio.
 */
export default {
  name: 'TabSteps',
  components: { StepItem },
  props: {
    update: { type: Object, required: true },
    loading: { type: Boolean, default: false },
  },
  emits: ['mark-step'],
  computed: {
    pre_steps() {
      return STEPS.filter((s) => s.group === 'pre')
    },
    post_steps() {
      return STEPS.filter((s) => s.group === 'post')
    },
  },
}
</script>
