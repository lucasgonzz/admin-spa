<template>
  <form class="sena-form bg-light rounded p-3 mb-2" novalidate @submit.prevent="registrar">
    <p class="small fw-semibold mb-2">{{ titulo }}</p>
    <div class="row g-2">
      <div class="col-6 col-md-3">
        <label class="form-label small mb-1" :for="id_base + '-monto'">Monto ({{ moneda }}) <span class="text-danger">*</span></label>
        <input
          :id="id_base + '-monto'"
          v-model="form.monto"
          type="number"
          min="0"
          step="0.01"
          inputmode="decimal"
          class="form-control form-control-sm"
          :class="{ 'is-invalid': monto_excede }"
        />
        <div v-if="monto_excede" class="invalid-feedback">
          No puede superar lo pendiente ({{ maximo_texto }}).
        </div>
      </div>
      <div class="col-6 col-md-3">
        <label class="form-label small mb-1" :for="id_base + '-fecha'">Fecha</label>
        <input :id="id_base + '-fecha'" v-model="form.fecha" type="date" class="form-control form-control-sm" />
      </div>
      <div class="col-12 col-md-6">
        <label class="form-label small mb-1" :for="id_base + '-nota'">Nota</label>
        <input
          :id="id_base + '-nota'"
          v-model="form.nota"
          type="text"
          maxlength="255"
          class="form-control form-control-sm"
          placeholder="Opcional"
        />
      </div>
    </div>
    <p v-if="ayuda" class="text-muted small mb-0 mt-2">{{ ayuda }}</p>
    <div class="d-flex justify-content-end gap-2 mt-2">
      <button type="button" class="btn btn-secondary btn-sm" :disabled="ocupado" @click="$emit('cancelar')">Cancelar</button>
      <button type="submit" class="btn btn-primary btn-sm" :disabled="ocupado || !valido">
        {{ ocupado ? 'Guardando...' : 'Registrar seña' }}
      </button>
    </div>
  </form>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import { format_monto_con_moneda } from '@/components/cobranzas/plata'

/**
 * Formulario chico para registrar una seña (misión senas-en-ventas, 30/10/2026).
 *
 * Lo comparten dos pantallas: la venta del cliente (`client/ventas-tab/VentaCard.vue`, que
 * postea a `ventas/{id}/senas`) y el contrato del lead sin promover
 * (`lead/contract/SenasDelLead.vue`, que postea a `leads/{id}/senas`). Por eso recibe la `url`
 * ya armada y no sabe de qué es la seña: manda `{monto, fecha, nota}`, y con la respuesta
 * completa avisa `registrada` para que el padre se redibuje.
 *
 * Validación del lado del navegador: monto mayor que cero y, si el padre pasa `maximo` (lo
 * pendiente de la venta), que no lo supere. La API valida lo mismo y contesta 422; su mensaje
 * se muestra tal cual en el toast.
 */
export default {
  name: 'SenaForm',
  props: {
    /** Ruta del POST, sin la base del panel: `/ventas/12/senas` o `/leads/7/senas`. */
    url: { type: String, required: true },
    /** Moneda de la seña (la de la venta o la del contrato del lead). */
    moneda: { type: String, default: 'USD' },
    /** Tope del monto (lo pendiente de la venta). `null` = sin tope (seña de un lead). */
    maximo: { type: Number, default: null },
    /** Título del formulario. */
    titulo: { type: String, default: 'Registrar seña' },
    /** Texto de ayuda debajo de los campos (opcional). */
    ayuda: { type: String, default: '' },
    /** Prefijo de los ids de los campos, para que dos formularios en pantalla no choquen. */
    id_base: { type: String, default: 'sena' },
  },
  emits: ['registrada', 'cancelar'],
  data() {
    return {
      // true mientras corre el POST.
      ocupado: false,
      // Campos del formulario; la fecha arranca en hoy.
      form: { monto: '', fecha: this.hoy(), nota: '' },
    }
  },
  computed: {
    /**
     * Monto tipeado como número (0 si está vacío o es ilegible).
     * @returns {number}
     */
    monto_numero() {
      const n = Number(this.form.monto)
      return isNaN(n) ? 0 : n
    },
    /**
     * true si el monto supera el tope. Tolera medio centavo de error de punto flotante.
     * @returns {boolean}
     */
    monto_excede() {
      return this.maximo !== null && this.monto_numero > this.maximo + 0.005
    },
    /**
     * Lo pendiente formateado con moneda, para el mensaje de error.
     * @returns {string}
     */
    maximo_texto() {
      return format_monto_con_moneda(this.maximo, this.moneda)
    },
    /**
     * true si el formulario se puede enviar: monto > 0 y dentro del tope.
     * @returns {boolean}
     */
    valido() {
      return this.monto_numero > 0 && !this.monto_excede
    },
  },
  methods: {
    /**
     * Fecha de hoy en `YYYY-MM-DD`, en hora local (no UTC: de noche en Argentina `toISOString`
     * ya daría el día siguiente).
     * @returns {string}
     */
    hoy() {
      const d = new Date()
      const dos = function (n) { return (n < 10 ? '0' : '') + n }
      return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate())
    },
    /**
     * Toast global del admin.
     * @param {string} message
     * @param {string} [variant]
     */
    avisar(message, variant) {
      window.dispatchEvent(new CustomEvent('admin-spa-toast', {
        detail: { message: String(message), variant: variant || 'success' },
      }))
    },
    /**
     * POST de la seña. Con éxito avisa `registrada` con la respuesta completa; con error muestra
     * el mensaje del servidor (422 `errors`/`message`) y deja el formulario como está.
     */
    registrar() {
      const self = this
      if (this.ocupado || !this.valido) {
        return
      }
      self.ocupado = true
      api
        .post(this.url, {
          monto: Math.round(this.monto_numero * 100) / 100,
          fecha: this.form.fecha || null,
          nota: String(this.form.nota || '').trim() || null,
        }, { silent_error: true })
        .then(function (res) {
          self.ocupado = false
          self.$emit('registrada', res.data || {})
        })
        .catch(function (error) {
          self.ocupado = false
          self.avisar(resolve_error_message(error), 'danger')
        })
    },
  },
}
</script>
