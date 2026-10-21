<template>
  <div class="card mb-3 border-secondary border-opacity-25">
    <div class="card-header small fw-semibold">Origen y anuncio</div>
    <div class="card-body small">
      <p v-if="error" class="text-danger mb-0">{{ error }}</p>
      <p v-else-if="!detalle" class="text-muted mb-0">Cargando origen...</p>
      <template v-else>
        <div class="mb-2">Origen del primer contacto: <strong>{{ origen }}</strong></div>
        <div v-for="contacto in contactos" :key="contacto.titulo" class="border-top pt-2 mt-2">
          <strong>{{ contacto.titulo }}</strong>
          <template v-if="contacto.valor">
            <div>{{ evidencia(contacto.valor.evidencia) }} · {{ contacto.valor.contacto_at }}</div>
            <div class="text-break">Anuncio: {{ anuncio(contacto.valor.datos) }}</div>
            <div v-if="contacto.valor.datos.campaign_name || contacto.valor.datos.campaign_id" class="text-break">Campaña: {{ contacto.valor.datos.campaign_name || contacto.valor.datos.campaign_id }}</div>
            <div v-if="contacto.valor.datos.adset_name || contacto.valor.datos.adset_id" class="text-break">Conjunto: {{ contacto.valor.datos.adset_name || contacto.valor.datos.adset_id }}</div>
          </template>
          <p v-else class="text-muted mb-0">Sin evidencia acreditada.</p>
        </div>
        <div class="border-top pt-2 mt-2">
          <strong>Primera reserva registrada</strong>
          <template v-if="detalle.reserva">
            <div>{{ detalle.reserva.reserved_at }} · turno {{ detalle.reserva.demo_date }} {{ detalle.reserva.demo_start_time }}</div>
            <div class="text-break">Contacto que precedió la reserva: {{ anuncio(detalle.reserva.datos) }}</div>
          </template>
          <p v-else class="text-muted mb-0">Sin reserva registrada desde que existe esta medición.</p>
        </div>
        <p class="text-muted mt-2 mb-0">{{ detalle.nota }}</p>
      </template>
    </div>
  </div>
</template>

<script>
import api from '@/utils/axios'

export default {
  name: 'LeadAtribucionCard',
  props: { leadId: { type: [Number, String], required: true } },
  data() { return { detalle: null, error: '' } },
  computed: {
    origen() {
      return ({ landing: 'Web', anuncio_whatsapp: 'Anuncio directo a WhatsApp', instagram: 'Instagram' })[this.detalle.origen] || 'Desconocido'
    },
    contactos() {
      return [
        { titulo: 'Adquisición', valor: this.detalle.adquisicion },
        { titulo: 'Último recontacto acreditado', valor: this.detalle.recontacto },
      ]
    },
  },
  watch: { leadId: { immediate: true, handler() { this.cargar() } } },
  methods: {
    cargar() {
      let self = this
      let id = this.leadId
      this.detalle = null
      this.error = ''
      api.get('/lead/' + id + '/atribucion').then(function (r) {
        if (self.leadId === id) self.detalle = r.data
      }).catch(function () {
        if (self.leadId === id) self.error = 'No se pudo cargar la atribución.'
      })
    },
    evidencia(valor) { return valor === 'meta_ctwa' ? 'Referral nativo de Meta' : 'Referencia de landing · URL declarada' },
    anuncio(datos) {
      if (!datos) return 'Sin atribución'
      if (datos.ad_id) return (datos.ad_name ? datos.ad_name + ' · ' : '') + datos.ad_id
      return datos.ad_name || 'Sin ID de anuncio'
    },
  },
}
</script>
