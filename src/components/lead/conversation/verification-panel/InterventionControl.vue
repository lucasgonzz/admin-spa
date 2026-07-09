<template>
  <div class="vp-row">
    <div class="form-check form-switch vp-mail-toggle">
      <input
        id="vp_requiere_intervencion"
        class="form-check-input"
        type="checkbox"
        role="switch"
        :checked="enabled"
        :disabled="disabled"
        @change="$emit('update:enabled', $event.target.checked)"
      />
      <label class="form-check-label vp-label" for="vp_requiere_intervencion">
        Requiere intervención humana
      </label>
    </div>
    <textarea
      v-if="enabled"
      class="form-control form-control-sm vp-motivo"
      rows="2"
      placeholder="Motivo (por qué necesita revisión manual)"
      :value="motivo"
      :disabled="disabled"
      @input="$emit('update:motivo', $event.target.value)"
    />
  </div>
</template>

<script>
/**
 * Control de "requiere intervención humana" dentro del panel de verificación (prompt 323).
 *
 * Toggle + textarea de motivo (visible solo si el toggle está activo). Precargado desde
 * pending_actions.requiere_intervencion_humana / pending_actions.motivo_intervencion.
 */
export default {
  name: 'VerificationInterventionControl',
  props: {
    /** true si el paquete marca que el lead necesita intervención de un humano. */
    enabled: { type: Boolean, default: false },
    /** Motivo de la intervención (texto libre). */
    motivo: { type: String, default: '' },
    /** true mientras se envía el mensaje (bloquea los controles). */
    disabled: { type: Boolean, default: false },
  },
  emits: ['update:enabled', 'update:motivo'],
}
</script>

<style scoped>
.vp-row {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.vp-mail-toggle {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.vp-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: rgba(17, 27, 33, 0.55);
  margin: 0;
}
.vp-motivo {
  font-size: 0.8rem;
}
</style>
