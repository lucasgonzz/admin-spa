<template>
  <!--
    Responsable de una oportunidad: círculo con las iniciales (el nombre completo en el tooltip).
    Sin responsable: círculo punteado con un ícono de persona.
  -->
  <span class="pl-owner" :title="title">
    <span
      class="pl-owner__circle"
      :class="{ 'pl-owner__circle--empty': !has_owner }"
      aria-hidden="true"
    >
      <template v-if="has_owner">{{ owner_initials }}</template>
      <i v-else class="bi bi-person" />
    </span>
    <span v-if="with_name" class="pl-owner__name">{{ has_owner ? owner.name : 'Sin responsable' }}</span>
    <span v-else class="visually-hidden">{{ title }}</span>
  </span>
</template>

<script>
import { initials } from './pipeline_helpers'

/**
 * Avatar del responsable (admin) de una oportunidad.
 */
export default {
  name: 'PipelineOwnerAvatar',
  props: {
    /** `{ id, name }` o null si no tiene responsable. */
    owner: { type: Object, default: null },
    /** true = muestra el nombre al lado del círculo. */
    with_name: { type: Boolean, default: false },
  },
  computed: {
    /** @returns {boolean} */
    has_owner() {
      return !!(this.owner && this.owner.name)
    },
    /** @returns {string} */
    owner_initials() {
      return initials(this.owner && this.owner.name)
    },
    /** @returns {string} */
    title() {
      return this.has_owner ? 'Responsable: ' + this.owner.name : 'Sin responsable'
    },
  },
}
</script>

<style scoped>
.pl-owner {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.pl-owner__circle {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--color-border-secondary);
  color: #495057;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1;
}

.pl-owner__circle--empty {
  background: transparent;
  border: 1px dashed var(--color-border);
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}

.pl-owner__name {
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
</style>
