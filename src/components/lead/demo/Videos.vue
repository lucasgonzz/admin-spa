<template>
  <div v-if="draft" class="lead-demo-videos">
    <!-- El editor de siempre, tal cual: escribe en el borrador y lo guarda el Guardar del modal. -->
    <lead-personalized-demo-videos-editor
      v-model="draft.personalized_demo_videos"
      field_label="Videos tutoriales personalizados (mail demo)"
    />
    <p class="small text-muted mt-2 mb-0">
      <i class="bi bi-info-circle me-1" aria-hidden="true" />
      Los videos se guardan con el botón <strong>Guardar</strong> del modal.
    </p>
  </div>
</template>

<script>
import LeadPersonalizedDemoVideosEditor from '@/components/lead/PersonalizedDemoVideosEditor.vue'

/**
 * Sub-solapa Videos personalizados de la Demo (misión flujo-lead-landing-closer, 17/10/2026).
 * Envuelve `PersonalizedDemoVideosEditor` sin cambios: antes lo montaba el form genérico desde el
 * meta (`custom_component: lead_personalized_demo_videos`); ahora lo monta esta sub-solapa, con el
 * mismo v-model sobre `draft.personalized_demo_videos`.
 */
export default {
  name: 'LeadDemoVideos',
  components: { LeadPersonalizedDemoVideosEditor },
  props: {
    draft: { type: Object, default: null },
    record: { type: Object, default: null },
    all_properties: { type: Array, default: () => [] },
  },
  emits: ['record-updated'],
}
</script>
