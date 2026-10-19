<template>
  <section class="serper-consumo">
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
      <div><h2 class="h4 mb-1">Consumo de Serper</h2><p class="text-muted small mb-0">Búsquedas de productos e imágenes, por negocio, usuario y proceso.</p></div>
      <button class="btn btn-outline-secondary btn-sm" :disabled="loading" @click="cargar(1)"><i class="bi bi-arrow-clockwise me-1" />Actualizar</button>
    </div>
    <form class="serper-panel mb-3" @submit.prevent="cargar(1)">
      <div class="row g-2 align-items-end">
        <div class="col-6 col-lg-2"><label :for="uid + '-desde'" class="form-label small">Desde</label><input :id="uid + '-desde'" v-model="desde" type="date" class="form-control form-control-sm" required></div>
        <div class="col-6 col-lg-2"><label :for="uid + '-hasta'" class="form-label small">Hasta</label><input :id="uid + '-hasta'" v-model="hasta" type="date" class="form-control form-control-sm" required></div>
        <div v-if="!clientId" class="col-12 col-lg-3"><label :for="uid + '-cliente'" class="form-label small">Negocio</label><select :id="uid + '-cliente'" v-model="cliente" class="form-select form-select-sm"><option value="">Todos los negocios</option><option v-for="c in opcionesClientes" :key="c.id" :value="c.id">{{ c.name }}</option></select></div>
        <div class="col-6 col-lg-2"><label :for="uid + '-endpoint'" class="form-label small">Búsqueda</label><select :id="uid + '-endpoint'" v-model="endpoint" class="form-select form-select-sm"><option value="">Todas</option><option value="search">Productos / web</option><option value="images">Imágenes</option></select></div>
        <div class="col-6 col-lg-3"><label :for="uid + '-resultado'" class="form-label small">Resultado</label><select :id="uid + '-resultado'" v-model="resultado" class="form-select form-select-sm"><option value="">Todos</option><option value="ok">Correctas</option><option value="failed">Fallidas</option><option value="unknown_credits">Créditos sin confirmar</option></select></div>
        <div class="col-6 col-lg-3"><label :for="uid + '-proceso'" class="form-label small">Proceso</label><input :id="uid + '-proceso'" v-model.trim="proceso" class="form-control form-control-sm" placeholder="Todos" maxlength="100"></div>
        <div class="col-6 col-lg-3"><label :for="uid + '-usuario'" class="form-label small">ID de usuario</label><input :id="uid + '-usuario'" v-model="usuario" type="number" min="0" class="form-control form-control-sm" placeholder="Todos (0 = automático)"></div>
        <div class="col-12 col-lg-auto d-flex flex-wrap gap-2"><button class="btn btn-primary btn-sm" :disabled="loading">{{ loading ? 'Consultando…' : 'Ver consumo' }}</button><button v-for="dias in [7, 30, 90]" :key="dias" class="btn btn-outline-secondary btn-sm" type="button" :disabled="loading" @click="periodo(dias)">{{ dias }} días</button></div>
      </div>
    </form>
    <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>
    <div v-if="loading" class="text-muted small mb-3" role="status">Buscando el consumo informado…</div>
    <template v-if="payload">
      <div v-if="!payload.has_telemetry" class="alert alert-info">Todavía no hay reportes de Serper {{ clientId || cliente ? 'de este negocio' : 'de los negocios' }}. Esto no significa consumo cero: los sistemas deben tener la versión que informa estas búsquedas.</div>
      <div v-else-if="!payload.totales.attempts" class="alert alert-light border">No hay consultas registradas para estos filtros.</div>
      <div v-if="!clientId && sinReportes" class="small text-muted mb-3">{{ sinReportes }} negocio(s) todavía sin reportes de Serper. El registro empieza cuando cada sistema se actualiza; no incluye búsquedas anteriores.</div>
      <div class="row g-3 mb-3">
        <div v-for="cifra in cifras" :key="cifra.label" class="col-6 col-lg-3"><div class="serper-cifra h-100"><p class="small text-muted mb-1">{{ cifra.label }}</p><p class="h3 mb-0">{{ cifra.value }}</p></div></div>
      </div>
      <p class="small text-muted">{{ payload.nota }}</p>
      <div class="row g-3 mb-3">
        <div v-if="!clientId" class="col-12"><div class="serper-panel"><h3 class="h6">Por negocio</h3><div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr><th>Negocio</th><th class="text-end">Consultas</th><th class="text-end">Créditos confirmados</th><th class="text-end">Sin confirmar</th><th class="text-end">Fallos</th></tr></thead><tbody><tr v-for="fila in payload.por_cliente" :key="fila.client_id"><td>{{ nombreCliente(fila.client_id) }}</td><td class="text-end">{{ numero(fila.attempts) }}</td><td class="text-end">{{ numero(fila.credits) }}</td><td class="text-end">{{ numero(fila.unknown_credit_events) }}</td><td class="text-end">{{ numero(fila.failed) }}</td></tr><tr v-if="!payload.por_cliente.length"><td colspan="5" class="text-muted">Sin consultas para este período.</td></tr></tbody></table></div></div></div>
        <div class="col-12 col-xl-6"><div class="serper-panel h-100"><h3 class="h6">Por proceso</h3><div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr><th>Proceso / búsqueda</th><th class="text-end">Consultas</th><th class="text-end">Créditos</th><th class="text-end">Sin confirmar</th></tr></thead><tbody><tr v-for="fila in payload.por_proceso" :key="fila.process + fila.endpoint"><td class="serper-wrap">{{ nombreProceso(fila.process) }}<small class="d-block text-muted">{{ fila.endpoint === 'images' ? 'Imágenes' : 'Web' }}</small></td><td class="text-end">{{ numero(fila.attempts) }}</td><td class="text-end">{{ numero(fila.credits) }}</td><td class="text-end">{{ numero(fila.unknown_credit_events) }}</td></tr><tr v-if="!payload.por_proceso.length"><td colspan="4" class="text-muted">Sin consultas.</td></tr></tbody></table></div></div></div>
        <div class="col-12 col-xl-6"><div class="serper-panel h-100"><h3 class="h6">Por usuario</h3><div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr><th>Usuario</th><th class="text-end">Consultas</th><th class="text-end">Créditos</th><th class="text-end">Sin confirmar</th></tr></thead><tbody><tr v-for="fila in payload.por_usuario" :key="fila.client_id + '-' + fila.auth_user_id"><td>{{ fila.auth_user_name || (fila.auth_user_id ? 'Usuario ' + fila.auth_user_id : 'Proceso automático') }}<small class="text-muted d-block">{{ !clientId ? nombreCliente(fila.client_id) : '' }}{{ fila.auth_user_id ? ' · ID ' + fila.auth_user_id : '' }}</small></td><td class="text-end">{{ numero(fila.attempts) }}</td><td class="text-end">{{ numero(fila.credits) }}</td><td class="text-end">{{ numero(fila.unknown_credit_events) }}</td></tr><tr v-if="!payload.por_usuario.length"><td colspan="4" class="text-muted">Sin consultas.</td></tr></tbody></table></div></div></div>
        <div class="col-12"><div class="serper-panel"><h3 class="h6">Por día</h3><div class="serper-dias"><div v-for="dia in payload.por_dia" :key="dia.date" class="serper-dia"><span class="small">{{ fechaDia(dia.date) }}</span><div class="serper-barra"><span :style="{ width: Math.max(2, dia.attempts / pico * 100) + '%' }" /></div><span class="small text-nowrap">{{ numero(dia.attempts) }} consultas · {{ numero(dia.credits) }} créditos</span></div><p v-if="!payload.por_dia.length" class="text-muted small mb-0">Sin consultas.</p></div></div></div>
      </div>
      <div class="serper-panel">
        <h3 class="h6">Detalle de consultas</h3>
        <div class="table-responsive"><table class="table table-sm align-middle serper-detalle"><thead><tr><th>Fecha</th><th v-if="!clientId">Negocio</th><th>Usuario / proceso</th><th>Búsqueda</th><th>Resultado</th><th class="text-end">Créditos</th><th class="text-end">Tiempo</th></tr></thead><tbody><tr v-for="e in payload.events" :key="e.id"><td class="text-nowrap">{{ fecha(e.occurred_at) }}</td><td v-if="!clientId">{{ nombreCliente(e.client_id) }}</td><td class="serper-wrap">{{ e.auth_user_name || (e.auth_user_id ? 'Usuario ' + e.auth_user_id : 'Proceso automático') }}<small class="d-block text-muted">{{ nombreProceso(e.process) }}</small></td><td class="serper-query"><span class="badge text-bg-light mb-1">{{ e.endpoint === 'images' ? 'Imágenes' : 'Web' }}</span><div>{{ e.query || 'Sin consulta informada' }}</div></td><td><span :class="e.ok ? 'text-success' : 'text-danger'">{{ e.ok ? 'Correcta' : 'Fallida' }}</span><small class="d-block text-muted">{{ e.http_status ? 'HTTP ' + e.http_status : 'Sin respuesta HTTP' }}</small></td><td class="text-end text-nowrap">{{ numero(e.credits) }}<small v-if="e.credits === null" class="d-block text-muted">Sin confirmar</small></td><td class="text-end text-nowrap">{{ e.duration_ms === null ? '—' : numero(e.duration_ms) + ' ms' }}</td></tr><tr v-if="!payload.events.length"><td :colspan="clientId ? 6 : 7" class="text-muted">Sin consultas para estos filtros.</td></tr></tbody></table></div>
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 small"><span>{{ numero(payload.total_events) }} consultas · Página {{ payload.current_page }} de {{ payload.last_page }}</span><div class="d-flex gap-2"><button class="btn btn-outline-secondary btn-sm" :disabled="loading || payload.current_page <= 1" @click="cargar(payload.current_page - 1)">Anterior</button><button class="btn btn-outline-secondary btn-sm" :disabled="loading || payload.current_page >= payload.last_page" @click="cargar(payload.current_page + 1)">Siguiente</button></div></div>
      </div>
    </template>
  </section>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'

let siguienteId = 0
export default {
  name: 'ConsumoSerper',
  props: { clientId: { type: [Number, String], default: null } },
  data() {
    return { uid: 'serper-' + (++siguienteId), desde: '', hasta: '', cliente: '', endpoint: '', resultado: '', proceso: '', usuario: '', loading: false, error: null, payload: null, opcionesClientes: [], requestId: 0 }
  },
  computed: {
    cifras() {
      const t = this.payload.totales
      const conocido = this.payload.has_telemetry
      return [
        { label: 'Consultas registradas', value: conocido ? this.numero(t.attempts) : '—' },
        { label: 'Créditos confirmados', value: this.numero(t.credits) },
        { label: 'Consultas sin créditos confirmados', value: conocido ? this.numero(t.unknown_credit_events) : '—' },
        { label: 'Consultas fallidas', value: conocido ? this.numero(t.failed) : '—' },
      ]
    },
    sinReportes() { return (this.payload.clientes || []).filter(c => !c.has_telemetry).length },
    pico() { return Math.max(1, ...this.payload.por_dia.map(d => d.attempts)) },
  },
  watch: { clientId() { this.payload = null; this.periodo(30) } },
  mounted() { this.periodo(30) },
  beforeUnmount() { this.requestId++ },
  methods: {
    iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') },
    periodo(dias) {
      const hasta = new Date(); const desde = new Date(); desde.setDate(desde.getDate() - dias + 1)
      this.desde = this.iso(desde); this.hasta = this.iso(hasta); this.cargar(1)
    },
    cargar(page) {
      const request = ++this.requestId
      this.loading = true; this.error = null
      const params = { desde: this.desde, hasta: this.hasta, page }
      if (!this.clientId && this.cliente) params.client_id = this.cliente
      if (this.endpoint) params.endpoint = this.endpoint
      if (this.resultado) params.result = this.resultado
      if (this.proceso) params.process = this.proceso
      if (this.usuario !== '') params.auth_user_id = this.usuario
      api.get(this.clientId ? '/client/' + this.clientId + '/serper' : '/serper/resumen', { params, silent_error: true })
        .then(res => {
          if (request !== this.requestId) return
          this.payload = res.data
          if (!this.clientId && !this.cliente) this.opcionesClientes = res.data.clientes || []
        })
        .catch(error => { if (request === this.requestId) { this.error = resolve_error_message(error); this.payload = null } })
        .finally(() => { if (request === this.requestId) this.loading = false })
    },
    numero(n) { return n === null || n === undefined ? '—' : Number(n).toLocaleString('es-AR', { maximumFractionDigits: 4 }) },
    nombreCliente(id) { const c = [...this.opcionesClientes, ...(this.payload.clientes || [])].find(c => Number(c.id) === Number(id)); return c ? c.name : 'Negocio ' + id },
    nombreProceso(p) { return ({ product_facts: 'Ficha del producto', barcode_product_facts: 'Ficha del producto', article_images: 'Imágenes de artículos', image_search: 'Búsqueda de imágenes' })[p] || p },
    fecha(f) { return f ? new Date(f).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—' },
    fechaDia(f) { return String(f).split('-').reverse().join('/') },
  },
}
</script>

<style scoped>
.serper-consumo { min-width: 0; }
.serper-panel { padding: 1rem; border: 1px solid #ededf0; border-radius: .65rem; background: #fff; min-width: 0; }
.serper-cifra { padding: 1rem; background: #f7f7f8; border-radius: .65rem; }
.serper-panel th { font-size: .78rem; color: #6c757d; font-weight: 500; white-space: nowrap; }
.serper-panel td { font-size: .85rem; }
.serper-wrap { overflow-wrap: anywhere; min-width: 130px; }
.serper-query { min-width: 170px; max-width: 320px; overflow-wrap: anywhere; }
.serper-dia { display: flex; align-items: center; gap: .75rem; margin-bottom: .5rem; }
.serper-barra { flex: 1; min-width: 30px; height: .5rem; border-radius: 1rem; background: #f1f3f5; }
.serper-barra span { display: block; height: 100%; background: #319a75; border-radius: 1rem; }
.serper-detalle { min-width: 760px; }
@media (max-width: 575px) { .serper-panel, .serper-cifra { padding: .75rem; } .serper-cifra .h3 { font-size: 1.5rem; } .serper-dia { flex-wrap: wrap; } .serper-dia > .text-nowrap { width: 100%; } }
</style>
