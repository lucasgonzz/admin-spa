<template>
  <!-- Footer fijo con botones de navegación: Anterior, Siguiente (o Enviar en la última sección) -->
  <div class="formulario-navigation">
    <div class="formulario-navigation__inner">
      <!-- Botón Anterior: deshabilitado en la primera sección -->
      <button
        type="button"
        class="btn btn-outline-secondary formulario-navigation__btn"
        :disabled="is_first_section"
        @click="$emit('prev')"
      >
        <i class="bi bi-arrow-left me-1"></i>Anterior
      </button>

      <!-- Botón Siguiente o Enviar según posición -->
      <button
        v-if="!is_last_section"
        type="button"
        class="btn btn-primary formulario-navigation__btn"
        :disabled="!can_continue"
        @click="$emit('next')"
      >
        Siguiente<i class="bi bi-arrow-right ms-1"></i>
      </button>

      <button
        v-else
        type="button"
        class="btn btn-success formulario-navigation__btn"
        :disabled="!can_continue || submitting"
        @click="$emit('submit')"
      >
        <!-- Spinner mientras se envía el formulario -->
        <span
          v-if="submitting"
          class="spinner-border spinner-border-sm me-1"
          role="status"
          aria-hidden="true"
        ></span>
        {{ submitting ? 'Enviando...' : 'Enviar' }}
        <i v-if="!submitting" class="bi bi-check2 ms-1"></i>
      </button>
    </div>
  </div>
</template>

<script>
/**
 * Barra de navegación fija al pie del formulario.
 * Muestra botones Anterior / Siguiente o Enviar dependiendo de la posición.
 * El botón Siguiente se deshabilita si la sección tiene campos requeridos sin responder.
 *
 * @prop {boolean} is_first_section - Si es la primera sección (deshabilita Anterior).
 * @prop {boolean} is_last_section  - Si es la última sección (muestra Enviar en lugar de Siguiente).
 * @prop {boolean} can_continue     - Si la sección actual permite avanzar.
 * @prop {boolean} submitting       - Si hay un envío en curso (muestra spinner).
 * @emits prev   - Solicita ir a la sección anterior.
 * @emits next   - Solicita ir a la siguiente sección.
 * @emits submit - Solicita enviar el formulario.
 */
export default {
  name: 'FormularioNavigation',

  props: {
    /**
     * True cuando se está mostrando la primera sección.
     */
    is_first_section: {
      type: Boolean,
      required: true,
    },

    /**
     * True cuando se está mostrando la última sección.
     */
    is_last_section: {
      type: Boolean,
      required: true,
    },

    /**
     * True cuando todas las preguntas requeridas de la sección tienen respuesta.
     */
    can_continue: {
      type: Boolean,
      required: true,
    },

    /**
     * True mientras el formulario se está enviando al servidor.
     */
    submitting: {
      type: Boolean,
      default: false,
    },
  },
}
</script>

<style scoped>
/* Footer fijo al pie de la pantalla */
.formulario-navigation {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  border-top: 1px solid #e9ecef;
  padding: 12px 16px;
  z-index: 100;
}

/* Distribución de botones: espacio entre ellos */
.formulario-navigation__inner {
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.formulario-navigation__btn {
  min-width: 120px;
  border-radius: 10px;
  font-size: 0.95rem;
}
</style>
