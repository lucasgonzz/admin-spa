<template>
  <details class="card mb-3" @toggle="alternar">
    <summary class="card-header small fw-semibold">Anuncios y reservas de demo</summary>
    <div class="card-body small">
      <form class="d-flex flex-wrap gap-2 align-items-end mb-3" @submit.prevent="cargar">
        <label>Leads creados desde<input v-model="desde" type="date" class="form-control form-control-sm" required /></label>
        <label>Hasta<input v-model="hasta" type="date" class="form-control form-control-sm" required /></label>
        <button class="btn btn-sm btn-outline-primary" :disabled="cargando">{{ cargando ? 'Cargando...' : 'Comparar' }}</button>
      </form>
      <p v-if="error" class="text-danger">{{ error }}</p>
      <template v-if="datos">
        <p>Denominador: <strong>{{ datos.denominador }} leads nuevos</strong>. Recontactos acreditados en el período: <strong>{{ datos.recontactos }}</strong> (se cuentan aparte).</p>
        <div class="table-responsive">
          <table class="table table-sm align-middle">
            <thead><tr><th>Anuncio / evidencia</th><th>Leads nuevos</th><th>Con reserva registrada</th><th>Reservas / leads</th></tr></thead>
            <tbody>
              <tr v-for="(fila, i) in datos.grupos" :key="i">
                <td class="text-break" style="min-width: 170px; max-width: 450px">
                  <strong>{{ etiqueta(fila) }}</strong>
                  <div v-if="fila.ad_id">ID {{ fila.ad_id }}</div>
                  <div v-if="fila.campaign_name">{{ fila.campaign_name }}</div>
                  <div class="text-muted">{{ evidencia(fila.evidencia) }}</div>
                </td>
                <td>{{ fila.leads }}</td><td>{{ fila.reservas }}</td><td>{{ tasa(fila) }}</td>
              </tr>
              <tr v-if="!datos.grupos.length"><td colspan="4" class="text-muted">No hay leads en ese período.</td></tr>
            </tbody>
          </table>
        </div>
        <p class="text-muted mb-0">{{ datos.nota }}</p>
      </template>
    </div>
  </details>
</template>

<script>
import api from '@/utils/axios'

export default {
  name: 'LeadAtribucionMetricas',
  data() {
    let hoy = new Date()
    let inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    function fecha(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }
    return { desde: fecha(inicio), hasta: fecha(hoy), datos: null, cargando: false, error: '' }
  },
  methods: {
    alternar(e) { if (e.target.open && !this.datos && !this.cargando) this.cargar() },
    cargar() {
      let self = this
      this.cargando = true
      this.error = ''
      api.get('/lead/atribucion/metricas', { params: { desde: this.desde, hasta: this.hasta } }).then(function (r) {
        self.datos = r.data
      }).catch(function () {
        self.error = 'No se pudo cargar la comparación. Revisá el período (máximo 366 días).'
      }).finally(function () { self.cargando = false })
    },
    etiqueta(fila) { return fila.evidencia === 'sin_atribucion' ? 'Sin atribución acreditada' : fila.ad_name || fila.ad_id || 'Sin ID de anuncio' },
    evidencia(valor) { return ({ meta_ctwa: 'Referral nativo de Meta', referencia_landing: 'Landing · parámetros declarados en URL', reserva_landing: 'Reserva desde la landing · parámetros declarados en URL', sin_atribucion: 'No se asigna anuncio sin evidencia' })[valor] || valor },
    tasa(fila) { return fila.leads ? (fila.reservas * 100 / fila.leads).toFixed(1) + '%' : '—' },
  },
}
</script>
