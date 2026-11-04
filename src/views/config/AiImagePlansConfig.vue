<template>
  <section class="card mt-4" aria-labelledby="titulo-planes-imagenes">
    <div class="card-body">
      <h3 id="titulo-planes-imagenes" class="h5">Paquetes de imágenes</h3>
      <p class="text-muted small">El precio mensual se expresa en pesos y el cupo de generación se mide en dólares. Se asignan desde la solapa Tokens de cada cliente.</p>
      <p v-if="error" class="alert alert-danger py-2" role="alert">{{ error }}</p>
      <p v-if="aviso" class="alert alert-success py-2" role="status">{{ aviso }}</p>
      <p v-if="cargando" class="text-muted" role="status">Cargando paquetes de imágenes…</p>
      <button v-else-if="!costos" type="button" class="btn btn-outline-primary btn-sm" @click="cargar">Reintentar</button>
      <template v-else>
        <form class="row g-2 align-items-end mb-4" @submit.prevent="guardar_costos">
          <div class="col-12 col-sm-4">
            <label for="costo-imagen-media" class="form-label small">Costo por imagen media (USD)</label>
            <input id="costo-imagen-media" v-model="costos.medium" type="number" class="form-control form-control-sm" min="0.000001" max="1000" step="0.000001" required>
          </div>
          <div class="col-12 col-sm-4">
            <label for="costo-imagen-alta" class="form-label small">Costo por imagen alta (USD)</label>
            <input id="costo-imagen-alta" v-model="costos.high" type="number" class="form-control form-control-sm" min="0.000001" max="1000" step="0.000001" required>
          </div>
          <div class="col-12 col-sm-4">
            <button type="submit" class="btn btn-outline-primary btn-sm" :disabled="guardando">Guardar costos</button>
          </div>
        </form>

        <div class="table-responsive">
          <table class="table table-sm align-middle">
            <thead><tr><th>Paquete</th><th>Precio mensual (ARS)</th><th>Tope mensual (USD)</th><th>Estado</th><th><span class="visually-hidden">Acciones</span></th></tr></thead>
            <tbody>
              <tr v-for="plan in planes" :key="plan.id">
                <td>{{ plan.nombre }}</td>
                <td>{{ monto(plan.precio_ars) }}</td>
                <td>{{ monto(plan.tope_usd_mensual) }}</td>
                <td>{{ plan.activo ? 'Activo' : 'Inactivo' }}</td>
                <td class="text-end"><button type="button" class="btn btn-outline-secondary btn-sm" @click="editar(plan)">Editar</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <button v-if="!edicion" type="button" class="btn btn-primary btn-sm" @click="editar()">Nuevo paquete de imágenes</button>
        <form v-else class="row g-2 align-items-end" @submit.prevent="guardar_plan">
          <div class="col-12 col-md-4">
            <label for="plan-imagen-nombre" class="form-label small">Nombre</label>
            <input id="plan-imagen-nombre" v-model="edicion.nombre" class="form-control form-control-sm" maxlength="255" required>
          </div>
          <div class="col-6 col-md-3">
            <label for="plan-imagen-precio" class="form-label small">Precio (ARS)</label>
            <input id="plan-imagen-precio" v-model="edicion.precio_ars" type="number" class="form-control form-control-sm" min="0" max="9999999999.99" step="0.01" required>
          </div>
          <div class="col-6 col-md-3">
            <label for="plan-imagen-tope" class="form-label small">Tope mensual (USD)</label>
            <input id="plan-imagen-tope" v-model="edicion.tope_usd_mensual" type="number" class="form-control form-control-sm" min="0.01" max="99999999.99" step="0.01" required>
          </div>
          <div class="col-12 col-md-2 form-check ps-4">
            <input id="plan-imagen-activo" v-model="edicion.activo" type="checkbox" class="form-check-input">
            <label for="plan-imagen-activo" class="form-check-label small">Activo</label>
          </div>
          <div class="col-12 d-flex gap-2">
            <button type="submit" class="btn btn-primary btn-sm" :disabled="guardando">Guardar paquete</button>
            <button type="button" class="btn btn-outline-secondary btn-sm" :disabled="guardando" @click="edicion = null">Cancelar</button>
          </div>
        </form>
      </template>
    </div>
  </section>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'

export default {
  data() {
    return { planes: [], costos: null, edicion: null, cargando: true, guardando: false, error: '', aviso: '' }
  },
  mounted() {
    this.cargar()
  },
  methods: {
    monto(valor) {
      return Number(valor).toLocaleString('es-AR', { minimumFractionDigits: 2 })
    },
    async cargar() {
      this.cargando = true
      this.error = ''
      try {
        const { data } = await api.get('/ai-image-plan', { silent_error: true })
        this.planes = data.ai_image_plans
        this.costos = data.costos
      } catch (error) {
        this.error = resolve_error_message(error, 'No se pudieron cargar los paquetes de imágenes.')
      } finally {
        this.cargando = false
      }
    },
    editar(plan) {
      this.edicion = plan ? { ...plan } : { nombre: '', precio_ars: '', tope_usd_mensual: '', activo: true }
      this.aviso = ''
      this.error = ''
    },
    async guardar_costos() {
      this.guardando = true
      this.error = ''
      this.aviso = ''
      try {
        const { data } = await api.put('/ai-image-plan/costos', {
          medium: Number(this.costos.medium).toFixed(6),
          high: Number(this.costos.high).toFixed(6),
        }, { silent_error: true })
        this.costos = data.costos
        this.aviso = 'Costos de imágenes guardados.'
      } catch (error) {
        this.error = resolve_error_message(error, 'No se pudieron guardar los costos de imágenes.')
      } finally {
        this.guardando = false
      }
    },
    async guardar_plan() {
      this.guardando = true
      this.error = ''
      this.aviso = ''
      try {
        const { id, ...plan } = this.edicion
        if (id) {
          await api.put('/ai-image-plan/' + id, plan, { silent_error: true })
        } else {
          await api.post('/ai-image-plan', plan, { silent_error: true })
        }
        this.edicion = null
        this.aviso = 'Paquete de imágenes guardado.'
        await this.cargar()
      } catch (error) {
        this.error = resolve_error_message(error, 'No se pudo guardar el paquete de imágenes.')
      } finally {
        this.guardando = false
      }
    },
  },
}
</script>
