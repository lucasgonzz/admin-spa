<template>
  <div class="precios-implementaciones">
    <h3 class="h6 mb-2">Implementaciones (pago único, en pesos)</h3>
    <p class="text-muted small mb-2">
      Tres productos al mismo precio: gestión, tienda y Agentes. Si el cliente lleva los tres juntos tiene un
      descuento; no hay combos de dos (dos productos se suman sin descuento).
    </p>
    <p class="text-muted small mb-2">
      <template v-if="precios.implementaciones.reembolsable">Reembolsable.</template>
      <template v-else>No reembolsable.</template>
      Se arranca pagando el anticipo; la columna «Para arrancar» se calcula sola con el porcentaje de
      abajo.
    </p>

    <div class="table-responsive">
      <table class="table table-sm align-middle precios-tabla mb-2">
        <thead>
          <tr>
            <th scope="col">Qué se implementa</th>
            <th scope="col" class="text-end">Precio</th>
            <th scope="col" class="text-end">Para arrancar</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in precios.implementaciones.items" :key="item.clave">
            <th scope="row" class="fw-normal">{{ item.nombre }}</th>
            <td>
              <div class="input-group input-group-sm flex-nowrap">
                <span class="input-group-text">$</span>
                <input
                  v-model.number="item.precio"
                  type="number"
                  min="0"
                  step="0.01"
                  class="form-control text-end"
                  :class="{ 'is-invalid': errors['implementaciones.items.' + item.clave + '.precio'] }"
                  :aria-label="'Precio de la implementación: ' + item.nombre"
                  :disabled="disabled"
                />
              </div>
              <div class="invalid-feedback d-block">{{ errors['implementaciones.items.' + item.clave + '.precio'] }}</div>
            </td>
            <!-- Calculado: precio * anticipo / 100. Sólo lectura, en gris. -->
            <td class="text-end text-muted precios-calculado">{{ down_payment_label(item) }}</td>
          </tr>
          <!-- Los tres juntos: precio de lista (suma) y precio con descuento, de sólo lectura. -->
          <tr class="precios-tres-juntos">
            <th scope="row" class="fw-normal">
              Los tres juntos
              <span class="d-block text-muted small">Precio de lista: {{ list_price_label }}</span>
            </th>
            <td class="text-end text-muted precios-calculado">{{ together_price_label }}</td>
            <td class="text-end text-muted precios-calculado">{{ together_down_payment_label }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="text-muted small mb-2">
      Vista previa mientras editás; al guardar, la pantalla muestra lo que calcula el servidor.
    </p>

    <div class="row g-2 align-items-start">
      <div class="col-12 col-sm-6 col-md-4">
        <label class="form-label small" for="precios_tres_juntos_descuento">Descuento de los tres juntos (%)</label>
        <div class="input-group input-group-sm">
          <input
            id="precios_tres_juntos_descuento"
            v-model.number="precios.implementaciones.tres_juntos.descuento_porcentaje"
            type="number"
            min="0"
            max="100"
            step="0.01"
            class="form-control text-end"
            :class="{ 'is-invalid': errors['implementaciones.tres_juntos.descuento_porcentaje'] }"
            :disabled="disabled"
          />
          <span class="input-group-text">%</span>
        </div>
        <div class="invalid-feedback d-block">{{ errors['implementaciones.tres_juntos.descuento_porcentaje'] }}</div>
      </div>
      <div class="col-12 col-sm-6 col-md-4">
        <label class="form-label small" for="precios_anticipo_porcentaje">Anticipo para arrancar (%)</label>
        <div class="input-group input-group-sm">
          <input
            id="precios_anticipo_porcentaje"
            v-model.number="precios.implementaciones.anticipo_porcentaje"
            type="number"
            min="0"
            max="100"
            step="0.01"
            class="form-control text-end"
            :class="{ 'is-invalid': errors['implementaciones.anticipo_porcentaje'] }"
            :disabled="disabled"
          />
          <span class="input-group-text">%</span>
        </div>
        <div class="invalid-feedback d-block">{{ errors['implementaciones.anticipo_porcentaje'] }}</div>
      </div>
    </div>
  </div>
</template>

<script>
import { calculate_down_payment, format_pesos, is_missing_number, preview_three_together } from '@/utils/precios_vigentes'

/**
 * Tabla editable de los precios de implementación (gestión, tienda y Agentes), con el anticipo calculado
 * al lado y el descuento de los tres juntos con su precio de lista y su precio con descuento.
 *
 * Subcomponente de «Precios vigentes»: edita en el lugar el contrato que le pasa el orquestador.
 */
export default {
  name: 'PreciosImplementaciones',
  props: {
    /** Contrato de precios completo (§2.6 del plan). */
    precios: {
      type: Object,
      required: true,
    },
    /** Errores por ruta de campo (cliente y servidor), con cada ítem nombrado por su `clave` (ej. `implementaciones.items.gestion.precio`). */
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
     * Vista previa de los tres juntos con lo que se está editando (misma fórmula de la API).
     *
     * @returns {{precio_lista: (number|null), precio: (number|null)}}
     */
    together() {
      return preview_three_together(this.precios.implementaciones)
    },
    /**
     * Texto del precio de lista de los tres juntos (la suma de los tres productos).
     *
     * @returns {string} Importe o «—» si falta algún dato.
     */
    list_price_label() {
      return this.together.precio_lista === null ? '—' : format_pesos(this.together.precio_lista)
    },
    /**
     * Texto del precio de los tres juntos con el descuento aplicado.
     *
     * @returns {string} Importe o «—» si falta algún dato.
     */
    together_price_label() {
      return this.together.precio === null ? '—' : format_pesos(this.together.precio)
    },
    /**
     * Texto del anticipo («Para arrancar») de los tres juntos.
     *
     * @returns {string} Importe o «—» si falta el precio o el porcentaje de anticipo.
     */
    together_down_payment_label() {
      const porcentaje = this.precios.implementaciones.anticipo_porcentaje
      if (this.together.precio === null || is_missing_number(porcentaje)) {
        return '—'
      }
      return format_pesos(calculate_down_payment(this.together.precio, porcentaje))
    },
  },
  methods: {
    /**
     * Texto del anticipo de una implementación («Para arrancar»).
     *
     * @param {{precio: number}} item Ítem de implementación.
     * @returns {string} Importe formateado o «—» si el precio o el porcentaje están incompletos.
     */
    down_payment_label(item) {
      const porcentaje = this.precios.implementaciones.anticipo_porcentaje
      if (is_missing_number(item.precio) || is_missing_number(porcentaje)) {
        return '—'
      }
      return format_pesos(calculate_down_payment(item.precio, porcentaje))
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
.precios-calculado {
  white-space: nowrap;
}
</style>
