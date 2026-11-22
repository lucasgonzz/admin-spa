<template>
  <div class="precios-adicionales">
    <h3 class="h6 mb-2">Adicionales y mensualidades</h3>

    <div class="table-responsive">
      <table class="table table-sm align-middle precios-tabla mb-2">
        <thead>
          <tr>
            <th scope="col">Concepto</th>
            <th scope="col" class="text-end">Importe</th>
            <th scope="col" class="text-end">Detalle</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" class="fw-normal">Usuario extra (por mes, en cualquier plan)</th>
            <td>
              <div class="input-group input-group-sm flex-nowrap">
                <span class="input-group-text">$</span>
                <input
                  v-model.number="precios.gestion.usuario_extra"
                  type="number"
                  min="0"
                  step="0.01"
                  class="form-control text-end"
                  :class="{ 'is-invalid': errors['gestion.usuario_extra'] }"
                  aria-label="Usuario extra"
                  :disabled="disabled"
                />
              </div>
              <div class="invalid-feedback d-block">{{ errors['gestion.usuario_extra'] }}</div>
            </td>
            <td></td>
          </tr>
          <tr>
            <th scope="row" class="fw-normal">Descuento de bienvenida (porcentaje)</th>
            <td>
              <div class="input-group input-group-sm flex-nowrap">
                <input
                  v-model.number="precios.gestion.descuento_bienvenida.porcentaje"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  class="form-control text-end"
                  :class="{ 'is-invalid': errors['gestion.descuento_bienvenida.porcentaje'] }"
                  aria-label="Porcentaje del descuento de bienvenida"
                  :disabled="disabled"
                />
                <span class="input-group-text">%</span>
              </div>
              <div class="invalid-feedback d-block">{{ errors['gestion.descuento_bienvenida.porcentaje'] }}</div>
            </td>
            <td class="text-end text-muted small">sobre el abono de gestión</td>
          </tr>
          <tr>
            <th scope="row" class="fw-normal">Descuento de bienvenida (meses)</th>
            <td>
              <div class="input-group input-group-sm flex-nowrap">
                <input
                  v-model.number="precios.gestion.descuento_bienvenida.meses"
                  type="number"
                  min="0"
                  max="24"
                  step="1"
                  class="form-control text-end"
                  :class="{ 'is-invalid': errors['gestion.descuento_bienvenida.meses'] }"
                  aria-label="Meses del descuento de bienvenida"
                  :disabled="disabled"
                />
                <span class="input-group-text">meses</span>
              </div>
              <div class="invalid-feedback d-block">{{ errors['gestion.descuento_bienvenida.meses'] }}</div>
            </td>
            <td class="text-end text-muted small">desde el alta</td>
          </tr>
          <tr>
            <th scope="row" class="fw-normal">Tienda online (mensualidad)</th>
            <td>
              <div class="input-group input-group-sm flex-nowrap">
                <span class="input-group-text">$</span>
                <input
                  v-model.number="precios.tienda.mensualidad"
                  type="number"
                  min="0"
                  step="0.01"
                  class="form-control text-end"
                  :class="{ 'is-invalid': errors['tienda.mensualidad'] }"
                  aria-label="Mensualidad de la tienda online"
                  :disabled="disabled"
                />
              </div>
              <div class="invalid-feedback d-block">{{ errors['tienda.mensualidad'] }}</div>
            </td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
/**
 * Tabla editable de adicionales y mensualidades: usuario extra, descuento de bienvenida,
 * y tienda online. Agentes de IA tiene su propio bloque (`Agentes.vue`).
 *
 * Subcomponente de «Precios vigentes»: edita en el lugar el contrato que le pasa el orquestador.
 */
export default {
  name: 'PreciosAdicionales',
  props: {
    /** Contrato de precios completo (§2.6 del plan). */
    precios: {
      type: Object,
      required: true,
    },
    /** Errores por ruta de campo (cliente y servidor), con la misma notación de puntos que usa Laravel. */
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
  min-width: 30rem;
}
.precios-tabla input {
  min-width: 5rem;
}
</style>
