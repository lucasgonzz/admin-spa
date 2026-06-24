<template>
  <!-- Barra de progreso fija en la parte superior de la pantalla con label de sección -->
  <div class="formulario-progress">
    <!-- Barra horizontal de 4px con ancho proporcional al progreso -->
    <div class="formulario-progress__bar">
      <div
        class="formulario-progress__fill"
        :style="{ width: progress_percent + '%' }"
      ></div>
    </div>

    <!-- Label con número de sección y título -->
    <div class="formulario-progress__label">
      Sección {{ current_index + 1 }} de {{ total }} — {{ current_title }}
    </div>
  </div>
</template>

<script>
/**
 * Barra de progreso del formulario de configuración.
 * Muestra el porcentaje completado y el nombre de la sección actual.
 * Se ubica fija en la parte superior de la pantalla.
 *
 * @prop {number} current_index - Índice 0-based de la sección activa.
 * @prop {number} total - Total de secciones del formulario.
 * @prop {string} current_title - Título de la sección activa.
 */
export default {
  name: 'FormularioProgress',

  props: {
    /**
     * Índice de la sección actualmente visible (0-based).
     */
    current_index: {
      type: Number,
      required: true,
    },

    /**
     * Total de secciones del formulario.
     */
    total: {
      type: Number,
      required: true,
    },

    /**
     * Título de la sección actualmente visible.
     */
    current_title: {
      type: String,
      required: true,
    },
  },

  computed: {
    /**
     * Porcentaje de progreso basado en secciones completadas.
     * La primera sección muestra progreso del (1/total)*100 para que
     * la barra no empiece vacía.
     *
     * @returns {number}
     */
    progress_percent() {
      return Math.round(((this.current_index + 1) / this.total) * 100)
    },
  },
}
</script>

<style scoped>
/* Contenedor fijo al tope de la pantalla */
.formulario-progress {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: #fff;
  border-bottom: 1px solid #f1f3f5;
}

/* Franja de progreso de 4px de altura */
.formulario-progress__bar {
  height: 4px;
  background: #e9ecef;
  width: 100%;
}

/* Relleno animado de la barra */
.formulario-progress__fill {
  height: 100%;
  background: var(--bs-primary);
  transition: width 0.4s ease;
}

/* Label de sección debajo de la barra */
.formulario-progress__label {
  text-align: center;
  font-size: 0.8rem;
  color: #6c757d;
  padding: 6px 16px;
  font-weight: 500;
}
</style>
