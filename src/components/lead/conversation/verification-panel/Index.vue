<template>
  <div class="vp-panel">
    <div class="vp-panel-title text-muted">
      <i class="bi bi-clipboard2-check me-1" aria-hidden="true" />
      Acciones al aprobar
    </div>

    <status-control
      v-model:value="estado_sugerido"
      :options="status_options"
      :disabled="disabled"
    />

    <div class="vp-separator" />

    <demo-schedule-control
      v-model:value="agendar_demo"
      v-model:forzar_slot="forzar_slot"
      v-model:enviar_mail_demo="enviar_mail_demo"
      v-model:reenviar_mail_demo="reenviar_mail_demo"
      v-model:cancelar_demo="cancelar_demo"
      :demos="demos"
      :slots="slots"
      :disabled="disabled"
    />

    <div class="vp-separator" />

    <contact-fields-control
      v-model:nombre="guardar_nombre"
      v-model:email="guardar_email"
      :disabled="disabled"
    />

    <div class="vp-separator" />

    <intervention-control
      v-model:enabled="requiere_intervencion_humana"
      v-model:motivo="motivo_intervencion"
      :disabled="disabled"
    />
  </div>
</template>

<script>
import StatusControl from '@/components/lead/conversation/verification-panel/StatusControl.vue'
import DemoScheduleControl from '@/components/lead/conversation/verification-panel/DemoScheduleControl.vue'
import ContactFieldsControl from '@/components/lead/conversation/verification-panel/ContactFieldsControl.vue'
import InterventionControl from '@/components/lead/conversation/verification-panel/InterventionControl.vue'
import verification_actions_panel_mixin from '@/components/lead/conversation/verification-panel/verification_actions_panel_mixin.js'

/**
 * Panel de acciones editables de la burbuja de verificación (prompt 323).
 *
 * Reemplaza la lista de solo lectura "Al aprobar, este mensaje va a: …" por controles
 * editables que SIEMPRE se muestran en mensajes `status==='sugerido'` con
 * `requiere_verificacion`, precargados con lo que sugirió Claude (`message.pending_actions`)
 * o vacíos si no sugirió nada. Al aprobar, MessageBubble lee `final_actions` (evento
 * `update:final_actions`) y lo manda junto al texto editado al endpoint
 * `approve-with-actions` (prompt 320).
 *
 * Orquestador puro: solo importa/registra los sub-componentes y arma el layout. La
 * precarga, el armado del payload y la llamada a la API de disponibilidad viven en
 * `verification_actions_panel_mixin.js`, tal como exige el CLAUDE.md del workspace
 * para componentes con Index.vue orquestador.
 */
export default {
  name: 'VerificationActionsPanel',
  components: { StatusControl, DemoScheduleControl, ContactFieldsControl, InterventionControl },
  mixins: [verification_actions_panel_mixin],
}
</script>

<style scoped>
/* Bloque prolijo debajo del texto del mensaje: fondo sutil, separadores livianos, sin saturar. */
.vp-panel {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.4rem;
  padding: 0.55rem 0.6rem;
  background: rgba(255, 255, 255, 0.55);
  border-radius: 8px;
  clear: both;
}
.vp-panel-title {
  font-size: 0.75rem;
  font-weight: 600;
}
.vp-separator {
  height: 1px;
  background: rgba(17, 27, 33, 0.08);
}
</style>
