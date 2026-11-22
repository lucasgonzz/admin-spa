<template>
  <div class="precios-agentes">
    <h3 class="h6 mb-2">Agentes de IA (un solo paquete, mensualidad por tokens)</h3>
    <p class="text-muted small mb-2">
      Agentes es un solo producto: incluye siempre el agente de WhatsApp. Lo que cambia es el paquete de
      tokens. La mensualidad de cada paquete es la ganancia fija más los tokens en dólares cotizados al blue;
      se calcula sola y es de sólo lectura.
    </p>

    <!-- Textos que lee Martín y la landing: qué incluye y para qué sirven los tokens. -->
    <div class="row g-2 mb-2">
      <div class="col-12 col-md-6">
        <label class="form-label small" for="precios_agentes_incluye">Qué incluye</label>
        <textarea
          id="precios_agentes_incluye"
          v-model="precios.agentes.incluye"
          rows="2"
          maxlength="400"
          class="form-control form-control-sm"
          :class="{ 'is-invalid': errors['agentes.incluye'] }"
          :disabled="disabled"
        ></textarea>
        <div class="invalid-feedback d-block">{{ errors['agentes.incluye'] }}</div>
      </div>
      <div class="col-12 col-md-6">
        <label class="form-label small" for="precios_agentes_uso_de_tokens">Para qué sirven los tokens</label>
        <textarea
          id="precios_agentes_uso_de_tokens"
          v-model="precios.agentes.uso_de_tokens"
          rows="2"
          maxlength="400"
          class="form-control form-control-sm"
          :class="{ 'is-invalid': errors['agentes.uso_de_tokens'] }"
          :disabled="disabled"
        ></textarea>
        <div class="invalid-feedback d-block">{{ errors['agentes.uso_de_tokens'] }}</div>
      </div>
    </div>

    <!-- Cotización del dólar, ganancia fija y aviso de consumo. -->
    <div class="row g-2 mb-2">
      <div class="col-12 col-sm-6 col-lg-3">
        <label class="form-label small" for="precios_agentes_cotizacion_valor">Cotización del dólar</label>
        <div class="input-group input-group-sm flex-nowrap">
          <span class="input-group-text">$</span>
          <input
            id="precios_agentes_cotizacion_valor"
            v-model.number="precios.agentes.cotizacion_usd.valor"
            type="number"
            min="0"
            step="0.01"
            class="form-control text-end"
            :class="{ 'is-invalid': errors['agentes.cotizacion_usd.valor'] }"
            :disabled="disabled"
          />
        </div>
        <div class="invalid-feedback d-block">{{ errors['agentes.cotizacion_usd.valor'] }}</div>
      </div>
      <div class="col-12 col-sm-6 col-lg-3">
        <label class="form-label small" for="precios_agentes_cotizacion_referencia">De dónde sale</label>
        <input
          id="precios_agentes_cotizacion_referencia"
          v-model="precios.agentes.cotizacion_usd.referencia"
          type="text"
          maxlength="80"
          class="form-control form-control-sm"
          :class="{ 'is-invalid': errors['agentes.cotizacion_usd.referencia'] }"
          :disabled="disabled"
        />
        <div class="invalid-feedback d-block">{{ errors['agentes.cotizacion_usd.referencia'] }}</div>
      </div>
      <div class="col-12 col-sm-6 col-lg-3">
        <label class="form-label small" for="precios_agentes_cotizacion_fecha">Cotización del día</label>
        <input
          id="precios_agentes_cotizacion_fecha"
          v-model="precios.agentes.cotizacion_usd.fecha"
          type="date"
          class="form-control form-control-sm"
          :class="{ 'is-invalid': errors['agentes.cotizacion_usd.fecha'] }"
          :disabled="disabled"
        />
        <div class="invalid-feedback d-block">{{ errors['agentes.cotizacion_usd.fecha'] }}</div>
      </div>
      <div class="col-12 col-sm-6 col-lg-3">
        <label class="form-label small" for="precios_agentes_ganancia">Ganancia fija por paquete</label>
        <div class="input-group input-group-sm flex-nowrap">
          <span class="input-group-text">$</span>
          <input
            id="precios_agentes_ganancia"
            v-model.number="precios.agentes.ganancia_por_paquete"
            type="number"
            min="0"
            step="0.01"
            class="form-control text-end"
            :class="{ 'is-invalid': errors['agentes.ganancia_por_paquete'] }"
            :disabled="disabled"
          />
        </div>
        <div class="invalid-feedback d-block">{{ errors['agentes.ganancia_por_paquete'] }}</div>
      </div>
      <div class="col-12 col-sm-6 col-lg-3">
        <label class="form-label small" for="precios_agentes_aviso">Aviso de consumo (% de los tokens)</label>
        <div class="input-group input-group-sm flex-nowrap">
          <input
            id="precios_agentes_aviso"
            v-model.number="precios.agentes.aviso_consumo_porcentaje"
            type="number"
            min="1"
            max="100"
            step="1"
            class="form-control text-end"
            :class="{ 'is-invalid': errors['agentes.aviso_consumo_porcentaje'] }"
            :disabled="disabled"
          />
          <span class="input-group-text">%</span>
        </div>
        <div class="invalid-feedback d-block">{{ errors['agentes.aviso_consumo_porcentaje'] }}</div>
      </div>
    </div>

    <!-- Los tres paquetes: nombre y USD editables, mensualidad calculada en pesos (sólo lectura). -->
    <div class="table-responsive">
      <table class="table table-sm align-middle precios-tabla mb-1">
        <thead>
          <tr>
            <th scope="col">Paquete</th>
            <th scope="col" class="text-end">Tokens (USD)</th>
            <th scope="col" class="text-end">Mensualidad</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="paquete in precios.agentes.paquetes" :key="paquete.clave">
            <td>
              <input
                v-model="paquete.nombre"
                type="text"
                maxlength="60"
                class="form-control form-control-sm"
                :class="{ 'is-invalid': errors['agentes.paquetes.' + paquete.clave + '.nombre'] }"
                :aria-label="'Nombre del paquete ' + paquete.clave"
                :disabled="disabled"
              />
              <div class="invalid-feedback d-block">{{ errors['agentes.paquetes.' + paquete.clave + '.nombre'] }}</div>
            </td>
            <td>
              <div class="input-group input-group-sm flex-nowrap">
                <span class="input-group-text">USD</span>
                <input
                  v-model.number="paquete.tokens_usd"
                  type="number"
                  min="0"
                  step="0.0001"
                  class="form-control text-end"
                  :class="{ 'is-invalid': errors['agentes.paquetes.' + paquete.clave + '.tokens_usd'] }"
                  :aria-label="'Tokens en dólares, paquete ' + paquete.nombre"
                  :disabled="disabled"
                />
              </div>
              <div class="invalid-feedback d-block">{{ errors['agentes.paquetes.' + paquete.clave + '.tokens_usd'] }}</div>
            </td>
            <!-- Calculado: ganancia + USD × cotización. Sólo lectura, en gris. -->
            <td class="text-end text-muted precios-calculado">{{ monthly_fee_label(paquete) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="text-muted small mb-0">
      Vista previa mientras editás; al guardar, la pantalla muestra lo que calcula el servidor.
    </p>
  </div>
</template>

<script>
import { format_pesos, preview_agent_packages } from '@/utils/precios_vigentes'

/**
 * Bloque de Agentes de IA: cotización del dólar, ganancia fija, aviso de consumo, textos y tabla de los
 * tres paquetes de tokens (inicial, pro y max) con su mensualidad calculada.
 *
 * Subcomponente de «Precios vigentes»: edita en el lugar el contrato que le pasa el orquestador. La
 * mensualidad que se ve acá es una vista previa con la misma fórmula de la API; al guardar, el
 * orquestador reemplaza el contrato por lo que devuelve la API.
 */
export default {
  name: 'PreciosAgentes',
  props: {
    /** Contrato de precios completo (§2.6 del plan, versión 2). */
    precios: {
      type: Object,
      required: true,
    },
    /** Errores por ruta de campo (cliente y servidor), con cada paquete nombrado por su `clave` (ej. `agentes.paquetes.pro.tokens_usd`). */
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
     * Mensualidad de cada paquete con lo que se está editando, indexada por `clave`.
     *
     * @returns {Object<string, (number|null)>} Pesos enteros o null si falta algún dato.
     */
    monthly_fees() {
      /** Resultado por clave de paquete. */
      const por_clave = {}
      preview_agent_packages(this.precios.agentes).forEach(function (vista) {
        por_clave[vista.clave] = vista.mensualidad
      })
      return por_clave
    },
  },
  methods: {
    /**
     * Texto de la mensualidad de un paquete.
     *
     * @param {{clave: string}} paquete Paquete de Agentes.
     * @returns {string} Importe en pesos por mes, o «—» si falta la cotización, la ganancia o los tokens.
     */
    monthly_fee_label(paquete) {
      const mensualidad = this.monthly_fees[paquete.clave]
      return mensualidad === null || mensualidad === undefined ? '—' : format_pesos(mensualidad) + ' por mes'
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
