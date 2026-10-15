<template>
  <!-- Bloque autocontenido: dinámica de demo de este lead (grupo 293, prompt 04).
       🔴 Desde el 14/10/2026 (misión demo-solo-experiencia-nueva) ya no es un control: la dinámica
       "actual" está retirada y TODOS los leads usan la página de experiencia con su formulario.
       Queda como etiqueta fija; no hay selector, ni botón, ni confirmación, porque no hay nada
       que elegir (y la API además rechaza con 422 pedir la dinámica retirada). -->
  <div class="dec-wrap">
    <label class="dec-label">Dinámica de demo</label>

    <div class="dec-row">
      <!-- Etiqueta fija: siempre la experiencia nueva. -->
      <span class="dec-current dec-current--nueva">
        {{ experiencia_label(experiencia_actual) }}
      </span>
    </div>
  </div>
</template>

<script>
/**
 * Etiqueta de la dinámica de demo asignada a un lead (grupo 293, prompt 04).
 *
 * Historia: era un control para cambiarle a un lead puntual la dinámica ('actual' | 'nueva') y
 * pilotear la experiencia nueva con unos pocos leads. El 14/10/2026 Lucas retiró la dinámica
 * 'actual' (misión demo-solo-experiencia-nueva): todos los leads usan siempre la página de
 * experiencia, así que acá ya no hay nada que cambiar. Se conserva el componente y su contrato
 * (prop `lead`, evento `record-updated`) para no tocar a quien lo monte, pero el evento ya no
 * se emite nunca.
 *
 * Props:
 *   lead {Object} - Lead (se ignora el valor de `demo_experiencia`: la etiqueta es siempre 'Nueva').
 *
 * Eventos:
 *   record-updated - Declarado por compatibilidad; ya no se emite.
 */
export default {
  name: 'DemoExperienciaControl',

  props: {
    /**
     * Lead sobre el que se muestra la etiqueta.
     * @type {Object}
     */
    lead: {
      type: Object,
      required: true,
    },
  },

  emits: ['record-updated'],

  computed: {
    /**
     * Dinámica vigente del lead. Desde el 14/10/2026 es siempre 'nueva', sin mirar la columna:
     * el backend (`Lead::demo_experiencia_efectiva()`) hace lo mismo y un valor viejo ('actual',
     * null, vacío) no cambia nada de lo que el lead ve.
     * @returns {string} 'nueva'
     */
    experiencia_actual() {
      return this.normalize_experiencia(this.lead && this.lead.demo_experiencia)
    },
  },

  methods: {
    /**
     * Normaliza el valor crudo del backend. La dinámica 'actual' está retirada, así que cualquier
     * valor (null, undefined, vacío, 'actual' o desconocido) se muestra como 'nueva'.
     * @param {string|null|undefined} value
     * @returns {string} 'nueva'
     */
    normalize_experiencia(value) {
      return 'nueva'
    },

    /**
     * Etiqueta corta y sin jerga para mostrar la dinámica.
     * @param {string} value 'nueva'
     * @returns {string}
     */
    experiencia_label(value) {
      return 'Nueva (página de experiencia)'
    },
  },
}
</script>

<style scoped>
.dec-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--bs-border-color);
  background: var(--bs-body-bg);
}
.dec-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: rgba(17, 27, 33, 0.55);
  margin: 0;
}
.dec-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
.dec-current {
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(17, 27, 33, 0.7);
}
.dec-current--nueva {
  color: var(--bs-warning-text-emphasis, #997404);
}
</style>
