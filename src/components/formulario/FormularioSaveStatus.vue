<template>
  <!-- Indicador de guardado automático en la esquina superior derecha -->
  <div class="formulario-save-status">
    <!-- Estado: guardando en curso -->
    <template v-if="save_status === 'saving'">
      <span class="formulario-save-status__spinner"></span>
      <span class="formulario-save-status__text">Guardando...</span>
    </template>

    <!-- Estado: guardado exitoso con hora -->
    <template v-else-if="save_status && save_status.saved_at">
      <span class="formulario-save-status__icon">✓</span>
      <span class="formulario-save-status__text">Guardado · {{ formatted_time }}</span>
    </template>

    <!-- Estado: sin actividad (no muestra nada) -->
  </div>
</template>

<script>
/**
 * Indicador de estado del autoguardado del formulario.
 * Muestra spinner + "Guardando..." o el checkmark con hora del último guardado.
 * Cuando no hay actividad, el componente queda invisible.
 *
 * @prop {string|null|object} save_status - null | 'saving' | { saved_at: Date }
 */
export default {
  name: 'FormularioSaveStatus',

  props: {
    /**
     * Estado actual del guardado.
     * null: sin actividad.
     * 'saving': petición en curso.
     * { saved_at: Date }: guardado exitoso con timestamp.
     */
    save_status: {
      type: [String, Object],
      default: null,
    },
  },

  computed: {
    /**
     * Formatea la hora del último guardado como HH:MM.
     *
     * @returns {string}
     */
    formatted_time() {
      if (!this.save_status || !this.save_status.saved_at) {
        return ''
      }

      const date = this.save_status.saved_at
      /* Obtener horas y minutos con padding de 2 dígitos */
      const hours   = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return hours + ':' + minutes
    },
  },
}
</script>

<style scoped>
/* Posición en la esquina superior derecha, sobre el contenido */
.formulario-save-status {
  position: fixed;
  top: 52px;
  right: 16px;
  z-index: 99;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  color: #6c757d;
  background: rgba(255, 255, 255, 0.9);
  padding: 4px 10px;
  border-radius: 20px;
  pointer-events: none;
}

/* Texto del estado */
.formulario-save-status__text {
  white-space: nowrap;
}

/* Ícono de checkmark en verde */
.formulario-save-status__icon {
  color: #198754;
  font-weight: bold;
}

/* Spinner CSS simple */
.formulario-save-status__spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid #dee2e6;
  border-top-color: var(--bs-primary);
  border-radius: 50%;
  animation: save-spin 0.6s linear infinite;
}

@keyframes save-spin {
  to { transform: rotate(360deg); }
}
</style>
