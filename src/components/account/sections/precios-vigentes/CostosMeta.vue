<template>
  <div class="precios-costos-meta">
    <h3 class="h6 mb-2">Costos de Meta por WhatsApp</h3>
    <p class="text-muted small mb-2">
      Los paga el negocio aparte, en su cuenta de WhatsApp. Vigentes desde
      <strong>{{ vigente_desde_label }}</strong>. Son los que muestra la landing en «Ver costos de Meta».
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
          <tr v-for="(tarifa, index) in precios.costos_meta.tarifas" :key="tarifa.clave">
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
                  :class="{ 'is-invalid': errors['costos_meta.tarifas.' + index + '.usd'] }"
                  :aria-label="'Dólares, ' + tarifa.nombre"
                  :disabled="disabled"
                />
              </div>
              <div class="invalid-feedback d-block">{{ errors['costos_meta.tarifas.' + index + '.usd'] }}</div>
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
                  :class="{ 'is-invalid': errors['costos_meta.tarifas.' + index + '.ars'] }"
                  :aria-label="'Pesos, ' + tarifa.nombre"
                  :disabled="disabled"
                />
              </div>
              <div class="invalid-feedback d-block">{{ errors['costos_meta.tarifas.' + index + '.ars'] }}</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="row g-2 align-items-start">
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
    /** Errores por ruta de campo (cliente y servidor), con la notación de puntos de Laravel. */
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
  computed: {
    /**
     * Fecha de vigencia de las tarifas en formato día/mes/año (la API manda `AAAA-MM-DD`).
     *
     * @returns {string} Fecha legible o el texto original si no tiene el formato esperado.
     */
    vigente_desde_label() {
      const crudo = this.precios.costos_meta.vigente_desde || ''
      const partes = crudo.split('-')
      if (partes.length !== 3) {
        return crudo
      }
      return partes[2] + '/' + partes[1] + '/' + partes[0]
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
