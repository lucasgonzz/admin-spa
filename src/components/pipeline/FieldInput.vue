<template>
  <!--
    Un campo de los que pide una etapa al entrar, dibujado según su `type` (lo usa el modal de mover).
    El `*` de obligatorio sale del `required` que manda la API; el control NUNCA bloquea: si falta,
    lo dice el back con un 422 y el mensaje aparece acá abajo.
  -->
  <div class="pl-field">
    <label
      v-if="!is_boolean"
      class="form-label mb-1"
      :for="input_id"
    >
      {{ field.label }}<span v-if="field.required" class="pl-field__required" title="Obligatorio"> *</span>
    </label>
    <p
      v-else
      :id="input_id + '-label'"
      class="form-label mb-1"
    >
      {{ field.label }}<span v-if="field.required" class="pl-field__required" title="Obligatorio"> *</span>
    </p>

    <textarea
      v-if="field.type === 'textarea'"
      :id="input_id"
      class="form-control"
      :class="{ 'is-invalid': !!error }"
      rows="3"
      :value="text_value"
      @input="emit_value($event.target.value)"
    />

    <input
      v-else-if="field.type === 'number'"
      :id="input_id"
      type="number"
      step="any"
      inputmode="decimal"
      class="form-control"
      :class="{ 'is-invalid': !!error }"
      :value="text_value"
      @input="emit_value($event.target.value)"
    />

    <input
      v-else-if="field.type === 'date'"
      :id="input_id"
      type="date"
      class="form-control pl-field__date"
      :class="{ 'is-invalid': !!error }"
      :value="text_value"
      @input="emit_value($event.target.value)"
    />

    <input
      v-else-if="field.type === 'datetime'"
      :id="input_id"
      type="datetime-local"
      class="form-control pl-field__date"
      :class="{ 'is-invalid': !!error }"
      :value="text_value"
      @input="emit_value($event.target.value)"
    />

    <select
      v-else-if="field.type === 'select'"
      :id="input_id"
      class="form-select"
      :class="{ 'is-invalid': !!error }"
      :value="text_value"
      @change="emit_value($event.target.value)"
    >
      <option value="">Elegí una opción</option>
      <option v-for="option in options" :key="option" :value="option">{{ option }}</option>
    </select>

    <div
      v-else-if="is_boolean"
      class="btn-group btn-group-sm pl-field__bool"
      role="group"
      :aria-labelledby="input_id + '-label'"
    >
      <button
        type="button"
        class="btn"
        :class="modelValue === true ? 'btn-dark' : 'btn-outline-secondary'"
        :aria-pressed="modelValue === true ? 'true' : 'false'"
        @click="toggle_boolean(true)"
      >
        Sí
      </button>
      <button
        type="button"
        class="btn"
        :class="modelValue === false ? 'btn-dark' : 'btn-outline-secondary'"
        :aria-pressed="modelValue === false ? 'true' : 'false'"
        @click="toggle_boolean(false)"
      >
        No
      </button>
    </div>

    <input
      v-else
      :id="input_id"
      type="text"
      class="form-control"
      :class="{ 'is-invalid': !!error }"
      :value="text_value"
      @input="emit_value($event.target.value)"
    />

    <p v-if="field.agenda" class="pl-field__hint mb-0">
      <i class="bi bi-calendar-check" aria-hidden="true" />
      Completa la próxima acción de la oportunidad.
    </p>
    <div v-if="error" class="invalid-feedback d-block">{{ error }}</div>
  </div>
</template>

<script>
/**
 * Input de un campo de etapa. `v-model` guarda el valor TAL COMO lo da el control (el de fecha y
 * hora queda `YYYY-MM-DDTHH:mm`); lo convierte a lo que pide la API el modal, al mandar
 * (`serialize_field_value` de pipeline_helpers).
 */
export default {
  name: 'PipelineFieldInput',
  props: {
    /** Definición del campo: `{ key, label, type, required, agenda, options }`. */
    field: { type: Object, required: true },
    /** Valor actual (string, o true/false/null en un sí/no). */
    modelValue: { type: [String, Number, Boolean], default: null },
    /** Mensaje de error del 422 para este campo (vacío = sin error). */
    error: { type: String, default: '' },
    /** id único del control, para asociar la etiqueta. */
    input_id: { type: String, required: true },
  },
  emits: ['update:modelValue'],
  computed: {
    /** @returns {boolean} */
    is_boolean() {
      return this.field.type === 'boolean'
    },
    /** Valor para los controles de texto: nunca null ni undefined. */
    text_value() {
      if (this.modelValue === null || this.modelValue === undefined) {
        return ''
      }
      return String(this.modelValue)
    },
    /** @returns {Array<string>} */
    options() {
      return Array.isArray(this.field.options) ? this.field.options : []
    },
  },
  methods: {
    /**
     * @param {*} value
     */
    emit_value(value) {
      this.$emit('update:modelValue', value)
    },
    /**
     * Sí/No con tres estados: tocar la opción ya elegida la desmarca (queda sin responder).
     *
     * @param {boolean} value
     */
    toggle_boolean(value) {
      this.$emit('update:modelValue', this.modelValue === value ? null : value)
    },
  },
}
</script>

<style scoped>
.pl-field__required {
  color: var(--bs-danger);
}

.pl-field__hint {
  margin-top: 0.3rem;
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}

/* Los inputs de fecha no necesitan todo el ancho en escritorio. */
@media (min-width: 576px) {
  .pl-field__date {
    max-width: 16rem;
  }
}
</style>
