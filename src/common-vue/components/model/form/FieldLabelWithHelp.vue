<template>
  <div class="field-label-with-help">
    <label class="form-label mb-0">{{ text }}</label>
    <small v-if="description" class="form-text text-muted d-block mt-1 mb-1">{{ description }}</small>
  </div>
</template>

<script>
/**
 * Etiqueta de campo del formulario declarativo con texto de ayuda opcional (`description` en meta).
 *
 * @param {string} text Etiqueta visible del campo.
 * @param {string} description Orientación breve debajo del label (no persiste en el modelo).
 */
export default {
  name: 'FieldLabelWithHelp',
  props: {
    text: { type: String, default: '' },
    description: { type: String, default: '' },
  },
}
</script>
