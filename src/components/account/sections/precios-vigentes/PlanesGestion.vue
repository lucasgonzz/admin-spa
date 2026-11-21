<template>
  <div class="precios-planes">
    <h3 class="h6 mb-2">Planes del sistema de gestión</h3>
    <p class="text-muted small mb-2">
      El abono es el precio final mensual (no se suma IVA). Los rangos son operaciones por mes
      (ventas + compras + gastos) y tienen que encadenarse: cada plan arranca un número después de
      donde termina el anterior, y Empresa es ilimitado.
    </p>

    <!-- Cada tabla scrollea dentro de su tarjeta: en el teléfono la página no se ensancha. -->
    <div class="table-responsive">
      <table class="table table-sm align-middle precios-tabla mb-2">
        <thead>
          <tr>
            <th scope="col">Plan</th>
            <th scope="col" class="text-end">Desde</th>
            <th scope="col" class="text-end">Hasta</th>
            <th scope="col" class="text-end">Usuarios</th>
            <th scope="col" class="text-end">Abono mensual</th>
            <th scope="col" class="text-end">Con descuento</th>
            <th scope="col" class="text-end">Excedente por operación</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(plan, index) in precios.gestion.planes" :key="plan.clave">
            <th scope="row" class="fw-semibold">{{ plan.nombre }}</th>
            <td>
              <input
                v-model.number="plan.desde"
                type="number"
                min="0"
                step="1"
                class="form-control form-control-sm text-end"
                :class="{ 'is-invalid': errors['gestion.planes.' + index + '.desde'] }"
                :aria-label="'Desde, plan ' + plan.nombre"
                :disabled="disabled"
              />
              <div class="invalid-feedback d-block">{{ errors['gestion.planes.' + index + '.desde'] }}</div>
            </td>
            <td>
              <!-- El último plan es ilimitado: su «hasta» no se edita. -->
              <span v-if="plan.hasta === null" class="text-muted">ilimitadas</span>
              <template v-else>
                <input
                  v-model.number="plan.hasta"
                  type="number"
                  min="0"
                  step="1"
                  class="form-control form-control-sm text-end"
                  :class="{ 'is-invalid': errors['gestion.planes.' + index + '.hasta'] }"
                  :aria-label="'Hasta, plan ' + plan.nombre"
                  :disabled="disabled"
                />
                <div class="invalid-feedback d-block">{{ errors['gestion.planes.' + index + '.hasta'] }}</div>
              </template>
            </td>
            <td>
              <input
                v-model.number="plan.usuarios"
                type="number"
                min="1"
                step="1"
                class="form-control form-control-sm text-end"
                :class="{ 'is-invalid': errors['gestion.planes.' + index + '.usuarios'] }"
                :aria-label="'Usuarios incluidos, plan ' + plan.nombre"
                :disabled="disabled"
              />
              <div class="invalid-feedback d-block">{{ errors['gestion.planes.' + index + '.usuarios'] }}</div>
            </td>
            <td>
              <div class="input-group input-group-sm flex-nowrap">
                <span class="input-group-text">$</span>
                <input
                  v-model.number="plan.abono"
                  type="number"
                  min="0"
                  step="0.01"
                  class="form-control text-end"
                  :class="{ 'is-invalid': errors['gestion.planes.' + index + '.abono'] }"
                  :aria-label="'Abono mensual, plan ' + plan.nombre"
                  :disabled="disabled"
                />
              </div>
              <div class="invalid-feedback d-block">{{ errors['gestion.planes.' + index + '.abono'] }}</div>
            </td>
            <!-- Calculado: abono * (100 - descuento) / 100. Sólo lectura. -->
            <td class="text-end text-muted precios-calculado">
              {{ discounted_label(plan) }}
            </td>
            <td>
              <span v-if="plan.excedente === null" class="text-muted">sin excedente</span>
              <template v-else>
                <div class="input-group input-group-sm flex-nowrap">
                  <span class="input-group-text">$</span>
                  <input
                    v-model.number="plan.excedente"
                    type="number"
                    min="0"
                    step="0.01"
                    class="form-control text-end"
                    :class="{ 'is-invalid': errors['gestion.planes.' + index + '.excedente'] }"
                    :aria-label="'Excedente por operación, plan ' + plan.nombre"
                    :disabled="disabled"
                  />
                </div>
                <div class="invalid-feedback d-block">{{ errors['gestion.planes.' + index + '.excedente'] }}</div>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import { calculate_discounted_fee, format_pesos, is_missing_number } from '@/utils/precios_vigentes'

/**
 * Tabla editable de los planes del sistema de gestión (Inicial, Intermedio y Empresa).
 *
 * Es un subcomponente de la sección «Precios vigentes»: recibe el contrato de precios del
 * orquestador y edita sus planes en el lugar (el orquestador es el dueño del estado y detecta los
 * cambios comparando contra la copia guardada).
 */
export default {
  name: 'PreciosPlanesGestion',
  props: {
    /** Contrato de precios completo (§2.6 del plan); acá se editan `gestion.planes`. */
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
  methods: {
    /**
     * Texto del abono con el descuento de bienvenida para un plan.
     *
     * @param {{abono: number}} plan Plan de gestión.
     * @returns {string} Importe formateado o «—» si el abono o el descuento están incompletos.
     */
    discounted_label(plan) {
      const porcentaje = this.precios.gestion.descuento_bienvenida.porcentaje
      if (is_missing_number(plan.abono) || is_missing_number(porcentaje)) {
        return '—'
      }
      return format_pesos(calculate_discounted_fee(plan.abono, porcentaje))
    },
  },
}
</script>

<style scoped>
.precios-tabla {
  min-width: 46rem;
}
.precios-tabla input {
  min-width: 5rem;
}
.precios-calculado {
  white-space: nowrap;
}
</style>
