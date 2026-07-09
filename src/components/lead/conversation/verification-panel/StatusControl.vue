<template>
  <div class="vp-row">
    <label class="vp-label">Cambio de estado</label>
    <select
      class="form-select form-select-sm vp-control"
      :value="value || ''"
      :disabled="disabled"
      @change="$emit('update:value', $event.target.value || null)"
    >
      <option value="">— sin cambio —</option>
      <option v-for="opt in options" :key="opt.value" :value="opt.value">
        {{ opt.text }}
      </option>
    </select>
  </div>
</template>

<script>
/**
 * Control de "cambio de estado" dentro del panel de verificación (prompt 323).
 *
 * Select con el catálogo de estados del pipeline de leads (el mismo que usa el badge
 * de la burbuja, vía meta/properties('lead')). Opción vacía por defecto = "no tocar
 * el estado sugerido por Claude / no cambiar el estado actual del lead".
 */
export default {
  name: 'VerificationStatusControl',
  props: {
    /** Slug del estado seleccionado (o null si "sin cambio"). */
    value: { type: String, default: null },
    /** Catálogo de estados: [{ value, text, color, group }, ...] desde meta/properties('lead'). */
    options: { type: Array, default: () => [] },
    /** true mientras se envía el mensaje (bloquea el control). */
    disabled: { type: Boolean, default: false },
  },
  emits: ['update:value'],
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
.vp-control {
  font-size: 0.8rem;
}
</style>
