<template>
  <!-- "Cliente" o "Lead": gris y chico, para que no compita con el nombre. -->
  <span v-if="label" class="pl-subject-badge" :class="'pl-subject-badge--' + type">
    <i class="bi" :class="type === 'client' ? 'bi-building' : 'bi-person'" aria-hidden="true" />
    {{ label }}
  </span>
</template>

<script>
import { subject_type_label } from './pipeline_helpers'

/**
 * Badge del tipo de sujeto de una oportunidad.
 */
export default {
  name: 'PipelineSubjectTypeBadge',
  props: {
    /** `client` | `lead`. */
    type: { type: String, default: '' },
  },
  computed: {
    /** @returns {string} */
    label() {
      return subject_type_label(this.type)
    },
  },
}
</script>

<style scoped>
.pl-subject-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex: 0 0 auto;
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1;
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
  background: var(--bg-hover);
  color: var(--color-text-secondary);
  white-space: nowrap;
}
</style>
