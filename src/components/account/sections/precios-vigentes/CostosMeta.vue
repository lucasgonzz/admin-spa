<template>
  <div class="precios-costos-meta">
    <h3 class="h6 mb-2">Costos de Meta por WhatsApp</h3>
    <p class="text-muted small mb-2">
      Los paga el negocio aparte, en su cuenta de WhatsApp. Son los que muestra la landing en «Ver costos
      de Meta». Cuando Meta cambie las tarifas, actualizá los importes y la fecha desde la que rigen.
    </p>

    <div class="table-responsive">
      <table class="table table-sm align-middle precios-tabla mb-2">
        <thead>
          <tr>
            <th scope="col">Tipo de mensaje</th>
            <th scope="col" class="text-end">Dólares (USD)</th>
            <th scope="col" class="text-end">Pesos</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tarifa in precios.costos_meta.tarifas" :key="tarifa.clave">
            <th scope="row" class="fw-normal">{{ tarifa.nombre }}</th>
            <td>
              <div class="input-group input-group-sm flex-nowrap">
                <span class="input-group-text">USD</span>
                <input
                  v-model.number="tarifa.usd"
                  type="number"
                  min="0"
                  step="0.0001"
                  class="form-control text-end"
                  :class="{ 'is-invalid': errors['costos_meta.tarifas.' + tarifa.clave + '.usd'] }"
                  :aria-label="'Dólares, ' + tarifa.nombre"
                  :disabled="disabled"
                />
              </div>
              <div class="invalid-feedback d-block">{{ errors['costos_meta.tarifas.' + tarifa.clave + '.usd'] }}</div>
            </td>
            <td>
              <div class="input-group input-group-sm flex-nowrap">
                <span class="input-group-text">$</span>
                <input
                  v-model.number="tarifa.ars"
                  type="number"
                  min="0"
                  step="0.01"
                  class="form-control text-end"
                  :class="{ 'is-invalid': errors['costos_meta.tarifas.' + tarifa.clave + '.ars'] }"
                  :aria-label="'Pesos, ' + tarifa.nombre"
                  :disabled="disabled"
                />
              </div>
              <div class="invalid-feedback d-block">{{ errors['costos_meta.tarifas.' + tarifa.clave + '.ars'] }}</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="row g-2 align-items-start">
      <div class="col-12 col-sm-6 col-md-4">
        <label class="form-label small" for="precios_vigente_desde">Tarifas vigentes desde</label>
        <!-- El input de fecha entrega y recibe AAAA-MM-DD, el mismo formato que valida la API. -->
        <input
          id="precios_vigente_desde"
          v-model="precios.costos_meta.vigente_desde"
          type="date"
          class="form-control form-control-sm"
          :class="{ 'is-invalid': errors['costos_meta.vigente_desde'] }"
          :disabled="disabled"
        />
        <div class="invalid-feedback d-block">{{ errors['costos_meta.vigente_desde'] }}</div>
      </div>
      <div class="col-12 col-sm-6 col-md-4">
        <label class="form-label small" for="precios_mensajes_gratis">Mensajes libres gratis por mes (por número)</label>
        <input
          id="precios_mensajes_gratis"
          v-model.number="precios.costos_meta.mensajes_libres_gratis_por_mes"
          type="number"
          min="0"
          step="1"
          class="form-control form-control-sm text-end"
          :class="{ 'is-invalid': errors['costos_meta.mensajes_libres_gratis_por_mes'] }"
          :disabled="disabled"
        />
        <div class="invalid-feedback d-block">{{ errors['costos_meta.mensajes_libres_gratis_por_mes'] }}</div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * Tabla editable de las tarifas de Meta por mensaje de WhatsApp (USD y pesos) y de los mensajes
 * libres gratis por mes.
 *
 * Subcomponente de «Precios vigentes»: edita en el lugar el contrato que le pasa el orquestador.
 */
export default {
  name: 'PreciosCostosMeta',
  props: {
    /** Contrato de precios completo (§2.6 del plan). */
    precios: {
      type: Object,
      required: true,
    },
    /** Errores por ruta de campo (cliente y servidor), con cada tarifa nombrada por su `clave` (ej. `costos_meta.tarifas.marketing.usd`). */
    errors: {
      type: Object,
      default: function () {
        return {}
      },
    },
    /** Deshabilita los inputs mientras se guarda. */
    disabled: {
      type: Boolean,
      default: false,
    },
  },
}
</script>

<style scoped>
.precios-tabla {
  min-width: 28rem;
}
.precios-tabla input {
  min-width: 5rem;
}
</style>
