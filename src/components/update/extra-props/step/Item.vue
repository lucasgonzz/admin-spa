<template>
  <div class="d-flex align-items-start mb-3 p-2 rounded" :class="{ 'bg-light': done }">
    <div class="me-3 pt-1">
      <i v-if="done" class="bi bi-check-circle-fill text-success fs-5"></i>
      <i v-else class="bi bi-circle text-muted fs-5"></i>
    </div>
    <div class="flex-grow-1">
      <div class="fw-semibold">{{ step.label }}</div>
      <small class="text-muted">{{ step.hint }}</small>
      <div v-if="done">
        <small class="text-success">{{ format_date(update[step.key]) }}</small>
      </div>
    </div>
    <div class="ms-2 flex-shrink-0">
      <button
        v-if="done"
        type="button"
        class="btn btn-sm btn-outline-secondary"
        :disabled="loading"
        @click="$emit('unmark', step.key)"
      >
        Desmarcar
      </button>
      <button
        v-else
        type="button"
        class="btn btn-sm btn-outline-success"
        :disabled="loading"
        @click="$emit('mark', step.key)"
      >
        Marcar
      </button>
    </div>
  </div>
</template>

<script>
/**
 * Un paso del proceso de actualización (ej: "Sistema actualizado").
 * Emite 'mark' o 'unmark' con la key del campo timestamp.
 */
export default {
  name: 'StepItem',
  props: {
    step: { type: Object, required: true },
    update: { type: Object, required: true },
    loading: { type: Boolean, default: false },
  },
  emits: ['mark', 'unmark'],
  computed: {
    done() {
      return Boolean(this.update[this.step.key])
    },
  },
  methods: {
    format_date(val) {
      if (!val) return ''
      const d = new Date(val)
      return (
        d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
        ' ' +
        d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
      )
    },
  },
}
</script>
