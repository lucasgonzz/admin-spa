<template>
  <!-- Barra de progreso fija en la parte superior de la pantalla con label de sección -->
  <div class="formulario-progress">
    <!-- Barra horizontal con ancho proporcional al progreso -->
    <div class="formulario-progress__bar">
      <div
        class="formulario-progress__fill"
        :style="{ width: progress_percent + '%' }"
      ></div>
    </div>

    <!-- Encabezado con marca y datos de la sección activa -->
    <div class="formulario-progress__body">
      <!-- Indicador de autoguardado anclado a la esquina del header -->
      <formulario-save-status :save_status="save_status" />

      <span class="formulario-progress__brand">ComercioCity</span>
      <div class="formulario-progress__meta">
        <span class="formulario-progress__step">Sección {{ current_index + 1 }} de {{ total }}</span>
        <h1 class="formulario-progress__title">{{ current_title }}</h1>
      </div>
    </div>
  </div>
</template>

<script>
import FormularioSaveStatus from './FormularioSaveStatus.vue'

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

  components: {
    FormularioSaveStatus,
  },

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

    /**
     * Estado del autoguardado para mostrar en el header.
     * null | 'saving' | { saved_at: Date }
     */
    save_status: {
      type: [String, Object],
      default: null,
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
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.06);
}

/* Franja de progreso más visible */
.formulario-progress__bar {
  height: 8px;
  background: #e8edf5;
  width: 100%;
}

/* Relleno animado con degradado primario */
.formulario-progress__fill {
  height: 100%;
  background: linear-gradient(90deg, #0d6efd 0%, #4c8dff 100%);
  transition: width 0.45s ease;
  border-radius: 0 4px 4px 0;
}

/* Cuerpo del encabezado */
.formulario-progress__body {
  position: relative;
  padding: 14px 20px 16px;
  text-align: center;
}

/* Marca del producto */
.formulario-progress__brand {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #0d6efd;
  margin-bottom: 6px;
}

/* Contenedor del contador y título de sección */
.formulario-progress__meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

/* Contador de sección */
.formulario-progress__step {
  font-size: 0.82rem;
  color: #6c757d;
  font-weight: 500;
}

/* Título de la sección activa, más destacado */
.formulario-progress__title {
  font-size: 1.35rem;
  font-weight: 700;
  color: #1a1d21;
  margin: 0;
  line-height: 1.25;
  letter-spacing: -0.02em;
}
</style>
