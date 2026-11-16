<template>
  <details v-if="missions.length" class="support-missions" :key="ticket.id">
    <summary>Misiones vinculadas <span class="text-muted">({{ missions.length }})</span></summary>
    <div class="support-missions-list">
      <div v-for="mission in missions" :key="mission.id" class="support-mission-row">
        <div class="d-flex flex-wrap align-items-center gap-2">
          <strong>{{ mission.mission_type === 'bug' ? 'Correctiva' : 'Funcionalidad' }} #{{ mission.id }}</strong>
          <span class="badge text-bg-light">{{ mission_status_label(mission) }}</span>
        </div>
        <div v-if="mission.thread_id" class="support-mission-thread text-muted">
          <span>Conversación: {{ mission.thread_id }}</span>
          <button type="button" class="btn btn-sm btn-link py-0" :aria-label="'Copiar conversación de la misión ' + mission.id"
            @click="copy_thread(mission)">{{ copied_id === mission.id ? 'Copiado' : 'Copiar' }}</button>
        </div>
      </div>
    </div>
    <span v-if="copy_error" role="status" class="small text-danger">No se pudo copiar. Seleccioná el identificador de la conversación.</span>
  </details>
</template>

<script>
import { mission_status_label } from '@/utils/support_missions'

export default {
  name: 'TicketMissions',
  props: { ticket: { type: Object, required: true } },
  data() { return { copied_id: null, copy_error: false } },
  computed: {
    missions() {
      const rows = this.ticket.support_attention && this.ticket.support_attention.missions
      return Array.isArray(rows) ? rows : []
    },
  },
  watch: { 'ticket.id'() { this.copied_id = null; this.copy_error = false } },
  methods: {
    mission_status_label,
    copy_thread(mission) {
      this.copy_error = false
      if (!navigator.clipboard) { this.copy_error = true; return }
      navigator.clipboard.writeText(mission.thread_id)
        .then(() => { this.copied_id = mission.id })
        .catch(() => { this.copy_error = true })
    },
  },
}
</script>

<style scoped>
.support-missions { font-size: 0.8rem; min-width: 0; }
.support-missions summary { cursor: pointer; width: fit-content; }
.support-missions-list { max-height: 10rem; overflow-y: auto; margin-top: 0.4rem; }
.support-mission-row { padding: 0.4rem 0; border-top: 1px solid var(--bs-border-color); }
.support-mission-thread { display: flex; flex-wrap: wrap; align-items: center; overflow-wrap: anywhere; gap: 0.25rem; }
</style>
