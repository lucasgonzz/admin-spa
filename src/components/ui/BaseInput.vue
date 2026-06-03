<template>
  <div :class="wrapper_class">
    <label v-if="label" :for="input_id" class="form-label">{{ label }}</label>
    <input
      :id="input_id"
      :type="type"
      class="form-control"
      :class="input_class"
      :value="modelValue"
      :required="required"
      :autocomplete="autocomplete"
      :placeholder="placeholder"
      @input="on_input"
    />
  </div>
</template>

<script>
/**
 * Input base reusable con etiqueta y v-model.
 */
export default {
  name: 'BaseInput',
  props: {
    modelValue: {
      type: [String, Number],
      default: '',
    },
    label: {
      type: String,
      default: '',
    },
    input_id: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      default: 'text',
    },
    required: {
      type: Boolean,
      default: false,
    },
    autocomplete: {
      type: String,
      default: '',
    },
    placeholder: {
      type: String,
      default: '',
    },
    wrapper_class: {
      type: String,
      default: 'mb-3',
    },
    input_class: {
      type: String,
      default: '',
    },
  },
  emits: ['update:modelValue'],
  methods: {
    on_input(event) {
      this.$emit('update:modelValue', event.target.value)
    },
  },
}
</script>
