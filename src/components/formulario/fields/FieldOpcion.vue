<template>
  <!-- Grupo de opciones tipo tarjeta: cada opción es un div clickeable con borde y fondo de acento al seleccionarse -->
  <div class="field-opcion">
    <div
      v-for="option in question.options"
      :key="option.value"
      class="field-opcion__card"
      :class="{ 'field-opcion__card--selected': value === option.value }"
      @click="on_select(option.value)"
    >
      <!-- Indicador visual circular tipo radio -->
      <div class="field-opcion__radio">
        <div v-if="value === option.value" class="field-opcion__radio-dot"></div>
      </div>
      <!-- Texto de la opción -->
      <span class="field-opcion__label">{{ option.label }}</span>
    </div>
  </div>
</template>

<script>
/**
 * Campo de selección de opción única, renderizado como tarjetas clickeables.
 * Reemplaza el radio button nativo por un diseño más moderno.
 *
 * @prop {object} question - Definición de la pregunta (de questions.js).
 * @prop {string|null} value - Valor actualmente seleccionado.
 * @emits update:value - Emite el nuevo valor seleccionado.
 */
export default {
  name: 'FieldOpcion',

  props: {
    /**
     * Definición de la pregunta con sus opciones.
     */
    question: {
      type: Object,
      required: true,
    },

    /**
     * Valor actualmente seleccionado (value de la opción elegida).
     */
    value: {
      type: String,
      default: null,
    },
  },

  methods: {
    /**
     * Emite el valor de la opción clickeada al componente padre.
     *
     * @param {string} option_value
     * @returns {void}
     */
    on_select(option_value) {
      this.$emit('update:value', option_value)
    },
  },
}
</script>

<style scoped>
/* Contenedor de las tarjetas de opciones */
.field-opcion {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Tarjeta individual de opción */
.field-opcion__card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border: 1px solid #dee2e6;
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
  user-select: none;
}

.field-opcion__card:hover {
  border-color: var(--bs-primary);
}

/* Estado seleccionado: borde y fondo de acento primario */
.field-opcion__card--selected {
  border-color: var(--bs-primary);
  background: rgba(var(--bs-primary-rgb), 0.06);
}

/* Indicador visual circular */
.field-opcion__radio {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border: 2px solid #adb5bd;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s ease;
}

.field-opcion__card--selected .field-opcion__radio {
  border-color: var(--bs-primary);
}

/* Punto interior del radio seleccionado */
.field-opcion__radio-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--bs-primary);
}

.field-opcion__label {
  font-size: 0.95rem;
  line-height: 1.4;
}
</style>
