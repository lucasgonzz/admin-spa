<template>
  <div
    :class="[
      'border-progress-wrap',
      variant === 'bubble' ? 'border-progress-wrap--bubble' : 'border-progress-wrap--button',
      active ? 'border-progress-wrap--active' : '',
    ]"
    :style="wrap_style">
    <div
      v-if="active"
      :key="animation_key"
      class="border-progress-ring"
      aria-hidden="true" />
    <slot />
  </div>
</template>

<script>
/**
 * Envuelve un control o burbuja con un borde que se completa linealmente en el tiempo indicado.
 * Usa @property --border-progress-angle para animar un conic-gradient (misma UX en botón IA y borrador).
 */
export default {
  name: 'BorderProgressWrap',
  props: {
    /** Activa la animación del borde. */
    active: { type: Boolean, default: false },
    /** Duración total del recorrido del borde (segundos). */
    duration_seconds: { type: Number, default: 0 },
    /** Segundos ya transcurridos (reanuda animación al abrir ticket a mitad de timer). */
    elapsed_seconds: { type: Number, default: 0 },
    /** Cambia la key para reiniciar la animación (debounce reprogramado). */
    animation_key: { type: [String, Number], default: '0' },
    /** button = icono cuadrado; bubble = burbuja de mensaje. */
    variant: { type: String, default: 'button' },
  },
  computed: {
    /**
     * Variables CSS para duración y desfase negativo del keyframe.
     *
     * @returns {Object}
     */
    wrap_style() {
      const duration = Math.max(0, parseFloat(this.duration_seconds) || 0)
      const elapsed = Math.max(0, parseFloat(this.elapsed_seconds) || 0)
      const safe_elapsed = duration > 0 ? Math.min(elapsed, duration) : 0

      return {
        '--border-progress-duration': duration + 's',
        '--border-progress-elapsed': safe_elapsed + 's',
      }
    },
  },
}
</script>

<style scoped>
@property --border-progress-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

.border-progress-wrap {
  position: relative;
  display: inline-flex;
  border-radius: 6px;
}

.border-progress-wrap--bubble {
  display: block;
  width: 100%;
  max-width: 100%;
  border-radius: 10px;
}

.border-progress-wrap--active .border-progress-ring {
  --border-progress-angle: 0deg;
  animation: border-progress-fill var(--border-progress-duration, 60s) linear forwards;
  animation-delay: calc(-1 * var(--border-progress-elapsed, 0s));
}

.border-progress-ring {
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  pointer-events: none;
  padding: 2px;
  background: conic-gradient(
    from -90deg,
    #0d6efd 0deg,
    #0d6efd var(--border-progress-angle),
    transparent var(--border-progress-angle)
  );
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}

@keyframes border-progress-fill {
  to {
    --border-progress-angle: 360deg;
  }
}
</style>
