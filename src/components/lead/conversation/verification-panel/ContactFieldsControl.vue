<template>
  <div class="vp-row">
    <label class="vp-label">Guardar nombre / email</label>
    <div class="vp-fields-grid">
      <input
        type="text"
        class="form-control form-control-sm vp-control"
        placeholder="Nombre de contacto"
        :value="nombre"
        :disabled="disabled"
        @input="$emit('update:nombre', $event.target.value)"
      />
      <input
        type="email"
        class="form-control form-control-sm vp-control"
        placeholder="Email de contacto"
        :value="email"
        :disabled="disabled"
        @input="$emit('update:email', $event.target.value)"
      />
    </div>
  </div>
</template>

<script>
/**
 * Control de "guardar nombre / guardar email" dentro del panel de verificación (prompt 323).
 *
 * Dos inputs simples, precargados con lo que sugirió Claude si lo trae en pending_actions;
 * vacíos si no aplica. El admin puede completarlos aunque Claude no haya sugerido nada.
 */
export default {
  name: 'VerificationContactFieldsControl',
  props: {
    /** Nombre de contacto a guardar (o cadena vacía si no aplica). */
    nombre: { type: String, default: '' },
    /** Email de contacto a guardar (o cadena vacía si no aplica). */
    email: { type: String, default: '' },
    /** true mientras se envía el mensaje (bloquea los inputs). */
    disabled: { type: Boolean, default: false },
  },
  emits: ['update:nombre', 'update:email'],
}
</script>

<style scoped>
.vp-row {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.vp-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: rgba(17, 27, 33, 0.55);
  margin: 0;
}
.vp-fields-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.vp-control {
  font-size: 0.8rem;
  min-width: 9rem;
  flex: 1 1 9rem;
}
</style>
