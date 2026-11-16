<template>
  <div class="ticket-message-notifications">
    <button type="button" class="btn btn-sm" :class="subscribed ? 'btn-success' : 'btn-outline-secondary'"
      :disabled="loading || !available" :aria-pressed="subscribed ? 'true' : 'false'" @click="toggle">
      <span v-if="loading" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
      <i v-else class="bi me-1" :class="subscribed ? 'bi-bell-fill' : 'bi-bell'" aria-hidden="true"></i>
      {{ subscribed ? 'Avisos de mensajes activados' : 'Avisarme de nuevos mensajes' }}
    </button>
    <p v-if="!available" class="small text-muted mb-0" role="status">Los avisos por ticket requieren actualizar el servidor.</p>
    <p v-else-if="!loading && subscribed && !device" class="small text-warning mb-0" role="status">
      Activá las notificaciones en <router-link to="/cuenta">tu cuenta</router-link> desde el teléfono para recibir estos avisos.
    </p>
    <p v-if="error" class="small text-danger mb-0" role="status">{{ error }} <button v-if="!loaded" type="button" class="btn btn-link btn-sm p-0" @click="load">Reintentar</button></p>
  </div>
</template>
<script>
import api from '@/utils/axios'
export default {
  props: { ticket_id: { type: [Number, String], required: true } },
  data() { return { loading: false, loaded: false, subscribed: false, device: false, available: true, error: '', request: 0 } },
  watch: { ticket_id: { immediate: true, handler() { this.load() } } },
  beforeUnmount() { this.request++ },
  methods: {
    load() { this.send('get') },
    toggle() { if (this.loaded) this.send('put', { subscribed: !this.subscribed }) },
    send(method, payload) {
      const request = ++this.request
      this.loading = true
      this.error = ''
      const url = `/support-ticket/${this.ticket_id}/message-notifications`
      const config = { silent_error_statuses: [404, 405] }
      const operation = method === 'get' ? api.get(url, config) : api.put(url, payload, config)
      operation.then(({ data }) => {
        if (request !== this.request) return
        this.subscribed = data.subscribed === true
        this.device = data.push_device_registered === true
        this.loaded = true
        this.available = true
      }).catch(error => {
        if (request !== this.request) return
        if ([404, 405].includes(error.response?.status)) this.available = false
        else this.error = 'No se pudieron guardar o consultar los avisos de este ticket.'
      }).finally(() => { if (request === this.request) this.loading = false })
    },
  },
}
</script>
<style scoped>
.ticket-message-notifications { max-width: 100%; }
.ticket-message-notifications button { white-space: normal; text-align: left; }
</style>
