<template>
  <div v-if="draft" class="lead-demo-formulario">
    <!-- La tarjeta de las nueve respuestas, tal cual: guarda por su cuenta con PUT lead/{id}/demo-form. -->
    <lead-demo-form-respuestas
      :record="draft"
      field_label="Respuestas del formulario de la demo"
      @record-updated="$emit('record-updated', $event)"
    />
  </div>
</template>

<script>
import LeadDemoFormRespuestas from '@/components/lead/DemoFormRespuestas.vue'

/**
 * Sub-solapa Formulario de la Demo (misión flujo-lead-landing-closer, 17/10/2026). Envuelve
 * `DemoFormRespuestas` sin cambios: antes lo montaba el form genérico desde el meta
 * (`custom_component: lead_demo_form_respuestas`) con `:record="form"`, el borrador del modal; acá
 * recibe el mismo borrador.
 */
export default {
  name: 'LeadDemoFormulario',
  components: { LeadDemoFormRespuestas },
  props: {
    draft: { type: Object, default: null },
    record: { type: Object, default: null },
    all_properties: { type: Array, default: () => [] },
  },
  emits: ['record-updated'],
}
</script>
