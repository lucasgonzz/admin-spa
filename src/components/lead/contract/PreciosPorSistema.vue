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
          <div v-if="sistema.key === 'gestion'" class="col-12">
            <label class="form-label" :for="id + '-plan-gestion'">Plan de Gestión (ventas por mes)</label>
            <select :id="id + '-plan-gestion'" v-model="plan_gestion" class="form-select">
              <option value="">Sin plan (importe acordado)</option>
              <option v-for="plan in planes" :key="plan.clave" :value="plan.clave">{{ nombre_plan(plan) }}</option>
            </select>
            <div v-if="contrato.contract_plan_gestion === 'a_medida'" class="form-text">Plan a medida: cargá el importe acordado.</div>
            <div v-else-if="contrato.contract_plan_gestion" class="form-text">Abono precargado del plan; podés editarlo.</div>
          </div>
        </div>
        <div v-if="resumen.tres" class="mb-3">
          <label class="form-label" :for="id + '-descuento'">Descuento por contratar los tres sistemas ({{ contrato.contract_currency || 'USD' }})</label>
          <input :id="id + '-descuento'" v-model.number="contrato.contract_descuento_conjunto" type="number" min="0" :max="resumen.subtotal" step="0.01" class="form-control" />
        </div>
        <p class="mb-1">Licencias individuales: {{ contrato.contract_currency }} {{ formato(resumen.subtotal) }}<span v-if="resumen.tres"> − descuento: {{ formato(resumen.descuento) }}</span></p>
        <p class="fw-semibold mb-1">Total de licencia e implementación: {{ contrato.contract_currency }} {{ formato(resumen.total) }}</p>
        <p class="fw-semibold mb-0">{{ contrato.contract_pago_anual ? 'Base mensual de referencia' : 'Abono base mensual' }}: {{ contrato.contract_mensualidad_moneda }} {{ formato(resumen.mensualidad) }}</p>
        <p v-if="resumen.total < 0" class="text-danger mt-2 mb-0">El descuento no puede superar las licencias individuales.</p>
      </div>
    </template>
    <div v-else class="alert alert-light border">
      <p class="small mb-2">Este contrato conserva sus importes anteriores. Podés cargar el nuevo desglose si acordás actualizarlo.</p>
      <button type="button" class="btn btn-outline-primary btn-sm" @click="iniciar">Cargar precios por sistema</button>
    </div>
    <div class="alert alert-light border">
      <div class="form-check mb-2">
        <input :id="id + '-pago-anual'" v-model="contrato.contract_pago_anual" type="checkbox" class="form-check-input" />
        <label class="form-check-label" :for="id + '-pago-anual'">Incluir pago anual anticipado del abono base</label>
      </div>
      <template v-if="contrato.contract_pago_anual">
        <label class="form-label" :for="id + '-descuento-anual'">Descuento por pago anual (%)</label>
        <input :id="id + '-descuento-anual'" v-model.number="contrato.contract_descuento_anual" type="number" min="0" max="100" step="0.01" class="form-control mb-2" placeholder="20" />
        <p class="small mb-1">Base mensual de referencia: {{ contrato.contract_mensualidad_moneda }} {{ formato(anual.base) }} × 12 meses = {{ formato(anual.bruto) }}.</p>
        <p class="small mb-1">Descuento anual ({{ anual.porcentaje }}%): {{ contrato.contract_mensualidad_moneda }} {{ formato(anual.descuento) }}.</p>
        <p class="fw-semibold mb-1">Total anual anticipado: {{ contrato.contract_mensualidad_moneda }} {{ formato(anual.total) }}</p>
        <p class="small mb-1">Usuarios extra actuales, por fuera del adelanto: {{ contrato.contract_mensualidad_moneda }} {{ formato(anual.extras) }} por mes. Se cobran mes a mes según la cantidad de usuarios extra existentes; no tienen descuento anual.</p>
        <p class="small mb-0">El abono base queda cubierto por doce meses sin ajustes por IPC durante ese período. Los usuarios extra siguen sujetos al IPC pactado. Podés usar 0% para quitar el descuento; vaciarlo también equivale a cero.</p>
        <p v-if="contrato.contract_mes_gratis" class="small mt-2 mb-0">Los doce meses pagos comienzan después del mes bonificado. La fecha del primer pago se carga a mano.</p>
      </template>
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
import { PLANES_GESTION, iniciar_precios_por_sistema, elegir_plan_gestion, resumen_precios, resumen_anual, actualizar_totales } from '@/utils/contract_precios'

export default {
  props: { contrato: { type: Object, required: true }, id: { type: String, required: true } },
  computed: {
    sistemas() { return SISTEMAS },
    planes() { return PLANES_GESTION },
    /** El select del plan: lee y escribe `contract_plan_gestion` por `elegir_plan_gestion`, que precarga el abono. */
    plan_gestion: {
      get() { return this.contrato.contract_plan_gestion || '' },
      set(clave) { elegir_plan_gestion(this.contrato, clave) },
    },
    resumen() { return resumen_precios(this.contrato) },
    anual() { return resumen_anual(this.contrato) },
  },
  watch: {
    resumen: {
      deep: true,
      handler() { actualizar_totales(this.contrato) },
    },
  },
  methods: {
    iniciar() { iniciar_precios_por_sistema(this.contrato) },
    /** Texto de cada opción: «Inicial — hasta 300 ventas por mes»; las demás abrevian el sufijo. */
    nombre_plan(plan) {
      const limite = Number(plan.limite).toLocaleString('es-AR')
      if (plan.clave === 'a_medida') return plan.nombre + ' — más de 5.000'
      if (plan.clave === 'inicial') return plan.nombre + ' — hasta ' + limite + ' ventas por mes'
      return plan.nombre + ' — hasta ' + limite
    },
    formato(valor) { return Number(valor).toLocaleString('es-AR', { maximumFractionDigits: 2 }) },
  },
}
</script>
