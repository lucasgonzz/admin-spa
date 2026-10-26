<template>
  <div v-if="contrato" class="mb-3">
    <template v-if="contrato.contract_precios_sistemas">
      <h6 class="text-primary mb-2">Precios por sistema</h6>
      <div class="alert alert-light border">
        <p class="small text-muted">Editá los importes acordados. Se suman únicamente los sistemas marcados como contratados.</p>
        <div v-for="sistema in sistemas" :key="sistema.key" class="row g-2 mb-3 align-items-end">
          <div class="col-md-4 fw-semibold">{{ sistema.label }}</div>
          <div class="col-md-4">
            <label class="form-label" :for="id + '-licencia-' + sistema.key">Licencia ({{ contrato.contract_currency || 'USD' }})</label>
            <input :id="id + '-licencia-' + sistema.key" v-model.number="contrato.contract_precios_sistemas[sistema.key].licencia" type="number" min="0" step="0.01" class="form-control" />
          </div>
          <div class="col-md-4">
            <label class="form-label" :for="id + '-abono-' + sistema.key">Mensualidad ({{ contrato.contract_mensualidad_moneda || 'ARS' }})</label>
            <input :id="id + '-abono-' + sistema.key" v-model.number="contrato.contract_precios_sistemas[sistema.key].mensualidad" type="number" min="0" step="0.01" class="form-control" />
          </div>
        </div>
        <div v-if="resumen.tres" class="mb-3">
          <label class="form-label" :for="id + '-descuento'">Descuento por contratar los tres sistemas ({{ contrato.contract_currency || 'USD' }})</label>
          <input :id="id + '-descuento'" v-model.number="contrato.contract_descuento_conjunto" type="number" min="0" :max="resumen.subtotal" step="0.01" class="form-control" />
        </div>
        <p class="mb-1">Licencias individuales: {{ contrato.contract_currency }} {{ formato(resumen.subtotal) }}<span v-if="resumen.tres"> − descuento: {{ formato(resumen.descuento) }}</span></p>
        <p class="fw-semibold mb-1">Total de licencia e implementación: {{ contrato.contract_currency }} {{ formato(resumen.total) }}</p>
        <p class="fw-semibold mb-0">Abono base mensual: {{ contrato.contract_mensualidad_moneda }} {{ formato(resumen.mensualidad) }}</p>
        <p v-if="resumen.total < 0" class="text-danger mt-2 mb-0">El descuento no puede superar las licencias individuales.</p>
      </div>
    </template>
    <div v-else class="alert alert-light border">
      <p class="small mb-2">Este contrato conserva sus importes anteriores. Podés cargar el nuevo desglose si acordás actualizarlo.</p>
      <button type="button" class="btn btn-outline-primary btn-sm" @click="iniciar">Cargar precios por sistema</button>
    </div>
    <div class="form-check mb-3">
      <input :id="id + '-mes-gratis'" v-model="contrato.contract_mes_gratis" type="checkbox" class="form-check-input" />
      <label class="form-check-label" :for="id + '-mes-gratis'">Incluir un mes gratis en el contrato</label>
      <div class="form-text">Bonifica el primer mes desde la puesta en marcha. Si cargás una fecha de primer pago, elegí la del período siguiente.</div>
    </div>
  </div>
</template>

<script>
import { SISTEMAS } from '@/utils/contract_modalidades'
import { iniciar_precios_por_sistema, resumen_precios, actualizar_totales } from '@/utils/contract_precios'

export default {
  props: { contrato: { type: Object, required: true }, id: { type: String, required: true } },
  computed: {
    sistemas() { return SISTEMAS },
    resumen() { return resumen_precios(this.contrato) },
  },
  watch: {
    resumen: {
      deep: true,
      handler() { actualizar_totales(this.contrato) },
    },
  },
  methods: {
    iniciar() { iniciar_precios_por_sistema(this.contrato) },
    formato(valor) { return Number(valor).toLocaleString('es-AR', { maximumFractionDigits: 2 }) },
  },
}
</script>
