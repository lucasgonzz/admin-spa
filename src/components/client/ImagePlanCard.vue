<template>
  <section class="card border-0 mb-4" aria-labelledby="titulo-paquete-cliente-imagenes">
    <div class="card-body">
      <h3 id="titulo-paquete-cliente-imagenes" class="h6">Paquete de imágenes del agente</h3>
      <p class="text-muted small">Gestioná la generación de imágenes y su cupo mensual por separado del chat.</p>
      <p v-if="error" class="alert alert-danger py-2" role="alert">{{ error }}</p>
      <p v-if="aviso" class="alert alert-success py-2" role="status">{{ aviso }}</p>
      <p v-if="cargando" class="text-muted small" role="status">Cargando el paquete de imágenes…</p>
      <button v-else-if="!datos" type="button" class="btn btn-outline-primary btn-sm" @click="cargar">Reintentar</button>
      <template v-else>
        <p class="small mb-3">
          Consumo de {{ datos.periodo }} <strong>{{ usd(datos.consumo_usd) }}</strong>
          <span v-if="datos.reservado_usd"> · Reservado {{ usd(datos.reservado_usd) }}</span>
          <span v-if="plan_asignado"> · Tope {{ usd(plan_asignado.tope_usd_mensual) }}</span>
        </p>
        <p v-if="plan_asignado && !plan_asignado.activo" class="text-muted small">El paquete asignado está inactivo y la generación está pausada.</p>
        <form class="row g-2 align-items-end" @submit.prevent="guardar">
          <div class="col-12 col-md-5">
            <label for="paquete-cliente-imagenes" class="form-label small">Paquete asignado</label>
            <select id="paquete-cliente-imagenes" v-model="plan_id" class="form-select form-select-sm" :disabled="guardando">
              <option :value="null">Sin paquete de imágenes</option>
              <option v-for="plan in opciones" :key="plan.id" :value="plan.id" :disabled="!plan.activo">
                {{ plan.nombre }} · {{ usd(plan.tope_usd_mensual) }}{{ plan.activo ? '' : ' (inactivo)' }}
              </option>
            </select>
          </div>
          <div class="col-12 col-md-4">
            <label for="calidad-cliente-imagenes" class="form-label small">Calidad de imagen</label>
            <select id="calidad-cliente-imagenes" v-model="calidad" class="form-select form-select-sm" :disabled="guardando">
              <option value="medium">Media · {{ usd(costos.medium) }} por imagen</option>
              <option value="high">Alta · {{ usd(costos.high) }} por imagen</option>
            </select>
          </div>
          <div class="col-12 col-md-3">
            <button type="submit" class="btn btn-primary btn-sm" :disabled="guardando">Guardar paquete</button>
          </div>
        </form>
      </template>
    </div>
  </section>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'

export default {
  props: {
    clientId: { type: [Number, String], required: true },
  },
  data() {
    return {
      datos: null, planes: [], costos: null, plan_id: null, calidad: 'medium',
      cargando: true, guardando: false, error: '', aviso: '',
    }
  },
  computed: {
    url() {
      return '/client/' + this.clientId + '/ai-image-plan'
    },
    plan_asignado() {
      return this.planes.find((plan) => plan.id === this.datos.ai_image_plan_id)
    },
    opciones() {
      return this.planes.filter((plan) => plan.activo || plan.id === this.datos.ai_image_plan_id)
    },
  },
  mounted() {
    this.cargar()
  },
  methods: {
    usd(valor) {
      return 'USD ' + Number(valor).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
    },
    async cargar() {
      this.cargando = true
      this.error = ''
      try {
        const [catalogo, cliente] = await Promise.all([
          api.get('/ai-image-plan', { silent_error: true }),
          api.get(this.url, { silent_error: true }),
        ])
        this.planes = catalogo.data.ai_image_plans
        this.costos = catalogo.data.costos
        this.datos = cliente.data
        this.plan_id = this.datos.ai_image_plan_id
        this.calidad = this.datos.ai_image_quality
      } catch (error) {
        this.error = resolve_error_message(error, 'No se pudo cargar el paquete de imágenes.')
      } finally {
        this.cargando = false
      }
    },
    async guardar() {
      this.guardando = true
      this.aviso = ''
      this.error = ''
      try {
        const { data } = await api.put(this.url, {
          ai_image_plan_id: this.plan_id,
          ai_image_quality: this.calidad,
        }, { silent_error: true })
        this.datos = data
        this.aviso = 'Paquete y calidad de imágenes guardados.'
      } catch (error) {
        this.error = resolve_error_message(error, 'No se pudo guardar el paquete de imágenes.')
      } finally {
        this.guardando = false
      }
    },
  },
}
</script>
