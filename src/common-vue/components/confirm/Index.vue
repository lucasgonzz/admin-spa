<template>
  <base-modal :show="open" title="Confirmar" @update:show="open = $event" @close="open = false">
    <p>{{ text }}</p>
    <template #footer>
      <button type="button" class="btn btn-secondary" @click="open = false">Cancelar</button>
      <button type="button" class="btn btn-primary" @click="on_ok">Aceptar</button>
    </template>
  </base-modal>
</template>

<script>
import BaseModal from '@/components/ui/BaseModal.vue'
/**
 * Diálogo de confirmación mínimo.
 */
export default {
  name: 'ConfirmModal',
  components: { BaseModal },
  props: {
    show: { type: Boolean, default: false },
    text: { type: String, default: '' },
  },
  data() {
    return {
      open: false,
    }
  },
  watch: {
    show(v) {
      this.open = v
    },
  },
  methods: {
    on_ok() {
      this.$emit('ok')
    },
  },
}
</script>
