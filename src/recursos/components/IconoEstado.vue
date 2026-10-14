<template>
  <!-- Terminado: círculo verde con check (el mismo SVG del prototipo). -->
  <svg v-if="hecho" class="estado-ico" viewBox="0 0 20 20" aria-hidden="true">
    <circle cx="10" cy="10" r="9" fill="var(--verde)" />
    <path
      d="M5.8 10.4l2.7 2.7 5.7-6"
      fill="none"
      stroke="var(--sobre-verde)"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
  <!-- Sin empezar (o menos del 1 %): círculo vacío. -->
  <svg v-else-if="fraccion <= 0.01" class="estado-ico" viewBox="0 0 20 20" aria-hidden="true">
    <circle cx="10" cy="10" r="8" fill="none" stroke="var(--borde)" stroke-width="2" />
  </svg>
  <!-- Empezado: anillo verde con lo visto. -->
  <svg v-else class="estado-ico" viewBox="0 0 20 20" role="img" :aria-label="porcentaje + ' % visto'">
    <title>{{ porcentaje }} % visto</title>
    <circle cx="10" cy="10" r="7" fill="none" stroke="var(--pista)" stroke-width="3.2" />
    <circle
      cx="10"
      cy="10"
      r="7"
      fill="none"
      stroke="var(--verde)"
      stroke-width="3.2"
      :stroke-dasharray="trazo"
      transform="rotate(-90 10 10)"
    />
  </svg>
</template>

<script>
/** Largo de la circunferencia del anillo (radio 7). */
const CIRCUNFERENCIA = 2 * Math.PI * 7

/**
 * Ícono de estado de un video en la barra de carpetas y en los chips de relacionados:
 * vacío / anillo con el % / check. Es el `icono()` del prototipo.
 */
export default {
  name: 'IconoEstado',
  props: {
    /** Fracción vista (0–1). */
    fraccion: { type: Number, default: 0 },
    /** true si el video cuenta como terminado. */
    hecho: { type: Boolean, default: false },
  },
  computed: {
    /**
     * Porcentaje redondeado, para el título.
     * @returns {number}
     */
    porcentaje() {
      return Math.round(this.fraccion * 100)
    },
    /**
     * `stroke-dasharray` del anillo: lo visto pintado, el resto vacío.
     * @returns {string}
     */
    trazo() {
      return (CIRCUNFERENCIA * this.fraccion).toFixed(1) + ' ' + CIRCUNFERENCIA.toFixed(1)
    },
  },
}
</script>
