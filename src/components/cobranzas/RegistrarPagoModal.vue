<template>
  <base-modal
    :show="show"
    :title="titulo"
    size="md"
    :stack_level="stack_level"
    @update:show="on_update_show"
    @close="cerrar"
  >
    <div class="row g-3">
      <!-- Período que se paga. Viene prefijado con el mes de referencia, pero se puede cambiar:
           un cliente que paga dos meses juntos se registra con dos pagos, uno por mes. -->
      <div class="col-12 col-md-6">
        <label class="form-label small mb-1 fw-semibold">Mes</label>
        <input v-model="form.periodo" type="month" class="form-control" />
        <div class="form-text small">{{ etiqueta_periodo }}</div>
      </div>

      <!-- Monto cobrado. Prefijado con lo esperado del mes; vacío vale como "pagó, sin importe"
           (es como quedaron importados los meses PAGADO de la planilla). -->
      <div class="col-12 col-md-6">
        <label class="form-label small mb-1 fw-semibold">Monto</label>
        <div class="input-group">
          <span class="input-group-text">$</span>
          <input v-model="form.monto" type="number" min="0" step="1" class="form-control" placeholder="Sin importe" />
        </div>
        <div v-if="monto_esperado_visible" class="form-text small">
          Esperado: {{ format_plata(monto_esperado) }}
        </div>
      </div>

      <div class="col-12 col-md-6">
        <label class="form-label small mb-1 fw-semibold">Fecha de pago</label>
        <input v-model="form.fecha_pago" type="date" class="form-control" />
      </div>

      <div class="col-12 col-md-6">
        <label class="form-label small mb-1 fw-semibold">Medio</label>
        <select v-model="form.medio" class="form-select">
          <option v-for="opcion in medios" :key="opcion" :value="opcion">{{ opcion }}</option>
        </select>
      </div>

      <div class="col-12">
        <label class="form-label small mb-1 fw-semibold">Observación</label>
        <input v-model="form.observacion" type="text" class="form-control" placeholder="Opcional" />
      </div>

      <!-- La casilla decide si el mes queda `pagado` o `parcial`. Arranca marcada porque el
           caso normal es que paguen el mes entero; cuando el monto queda corto se avisa cuánto
           falta y se sugiere desmarcarla, pero no se desmarca sola: puede ser un descuento
           acordado y ahí el mes sí queda pagado con menos plata. -->
      <div class="col-12">
        <div class="form-check">
          <input
            :id="'cerrar-periodo-' + stack_level"
            v-model="form.cerrar_periodo"
            class="form-check-input"
            type="checkbox"
          />
          <label class="form-check-label" :for="'cerrar-periodo-' + stack_level">
            El mes queda pagado completo
          </label>
        </div>
        <!-- Informativo (pedido 7, 18/9/2026): un solo click hace todo — registra el pago,
             adelanta el vencimiento y avisa al sistema del cliente. Sin confirm() extra a
             propósito: agregar un click más iría contra el pedido de simplificar el flujo. -->
        <p v-if="form.cerrar_periodo" class="text-muted small mt-1 mb-0">
          Al registrar este pago se adelanta un mes el vencimiento y se avisa al sistema del cliente.
        </p>
        <div v-if="faltante > 0" class="small mt-1" :class="form.cerrar_periodo ? 'text-warning-emphasis' : 'text-muted'">
          Faltarían {{ format_plata(faltante) }}.
          <span v-if="form.cerrar_periodo">Si es un pago parcial, desmarcá la casilla para que el mes quede en amarillo.</span>
          <span v-else>El mes queda como parcial hasta que se registre el resto.</span>
        </div>
      </div>
    </div>

    <template #footer>
      <button type="button" class="btn btn-secondary" :disabled="guardando" @click="cerrar">Cancelar</button>
      <button type="button" class="btn btn-primary" :disabled="guardando || !periodo_valido" @click="guardar">
        <span v-if="guardando" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
        {{ guardando ? 'Guardando...' : 'Registrar pago' }}
      </button>
    </template>
  </base-modal>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import BaseModal from '@/components/ui/BaseModal.vue'
import { etiqueta_larga, formatear_fecha, hoy_iso, mes_corriente, partes_de_periodo } from './meses'
import { format_plata } from './plata'

/**
 * Modal "Registrar pago" de la mensualidad (misión modulo-cobranzas, 18/9/2026).
 *
 * Hace un solo POST (`client/{id}/mensualidad/pagos`) y devuelve por el evento `saved` el
 * `estado_de` del período ya recalculado por el backend, para que quien lo abrió (la tabla del
 * módulo o la pestaña Mensualidad del cliente) refresque solo esa fila o recargue, según le
 * convenga. No sabe nada de facturas: pagar y facturar son dos actos distintos y acá se registra
 * solo el primero.
 *
 * `stack_level` va por prop porque el mismo modal se abre desde dos alturas: encima de la tabla
 * (nivel 0) y encima del modal del cliente (nivel 1), y sin eso quedaría debajo del padre.
 */
export default {
  name: 'RegistrarPagoModal',
  components: { BaseModal },
  props: {
    /** Visibilidad, controlada por el padre (v-model:show). */
    show: { type: Boolean, default: false },
    /** Cliente al que se le registra el pago: `{id, name, company_name}`. */
    cliente: { type: Object, default: null },
    /** Período prefijado, `YYYY-MM`. Si falta se usa el mes corriente. */
    periodo: { type: String, default: '' },
    /** Monto esperado del mes, para prefijar el importe y calcular el faltante. */
    monto_esperado: { type: [Number, String], default: null },
    /** Nivel de apilamiento del BaseModal: 1 cuando se abre desde adentro del modal del cliente. */
    stack_level: { type: Number, default: 0 },
  },
  emits: ['update:show', 'close', 'saved'],
  data() {
    return {
      /** true mientras corre el POST. */
      guardando: false,
      /** Medios de pago que se ofrecen; el backend los guarda como texto libre de hasta 40. */
      medios: ['Transferencia', 'Mercado Pago', 'Efectivo', 'Otro'],
      /** Formulario del pago; se rearma cada vez que el modal se abre (ver watch `show`). */
      form: this.form_vacio(),
    }
  },
  computed: {
    /**
     * Título del modal con el nombre del cliente.
     * @returns {string}
     */
    titulo() {
      const nombre = this.cliente ? this.cliente.company_name || this.cliente.name : ''
      return nombre ? 'Registrar pago · ' + nombre : 'Registrar pago'
    },
    /**
     * Mes elegido escrito en largo, debajo del input.
     * @returns {string}
     */
    etiqueta_periodo() {
      return this.periodo_valido ? etiqueta_larga(this.form.periodo) : 'Elegí un mes'
    },
    /**
     * true si el período del form tiene forma `YYYY-MM`.
     * @returns {boolean}
     */
    periodo_valido() {
      return partes_de_periodo(this.form.periodo) !== null
    },
    /**
     * Monto esperado como número, o null si no vino.
     * @returns {number|null}
     */
    monto_esperado_numero() {
      if (this.monto_esperado === null || this.monto_esperado === undefined || this.monto_esperado === '') {
        return null
      }
      return Number(this.monto_esperado)
    },
    /**
     * Si hay un esperado mayor a cero para mostrarlo debajo del monto.
     * @returns {boolean}
     */
    monto_esperado_visible() {
      return this.monto_esperado_numero !== null && this.monto_esperado_numero > 0
    },
    /**
     * Lo que faltaría para completar el mes con el monto tipeado. Cero si no hay esperado o si
     * el monto está vacío (vacío no es "pagó cero": es "pagó, sin importe").
     * @returns {number}
     */
    faltante() {
      if (!this.monto_esperado_visible || this.form.monto === '' || this.form.monto === null) {
        return 0
      }
      const diferencia = this.monto_esperado_numero - Number(this.form.monto || 0)
      return diferencia > 0 ? diferencia : 0
    },
  },
  watch: {
    /**
     * Al abrir se rearma el formulario con lo que mandó el padre: período de referencia, monto
     * esperado, fecha de hoy. Si se hiciera en `mounted` quedaría con los valores de la primera
     * apertura para siempre, porque el componente vive mientras vive la vista.
     */
    show(visible) {
      if (visible) {
        this.form = this.form_vacio()
      }
    },
  },
  methods: {
    format_plata,
    /**
     * Formulario inicial, a partir de las props del momento.
     * @returns {Object}
     */
    form_vacio() {
      const esperado =
        this.monto_esperado !== null && this.monto_esperado !== undefined && this.monto_esperado !== ''
          ? Number(this.monto_esperado)
          : null
      return {
        periodo: this.periodo || mes_corriente(),
        monto: esperado !== null && esperado > 0 ? esperado : '',
        fecha_pago: hoy_iso(),
        medio: 'Transferencia',
        observacion: '',
        cerrar_periodo: true,
      }
    },
    /**
     * Propaga el cierre pedido por el BaseModal (Escape, backdrop, X).
     * @param {boolean} visible
     */
    on_update_show(visible) {
      this.$emit('update:show', visible)
    },
    /**
     * Cierra sin guardar.
     */
    cerrar() {
      if (this.guardando) {
        return
      }
      this.$emit('update:show', false)
      this.$emit('close')
    },
    /**
     * POST del pago. El backend recalcula el estado del mes (pagado / parcial / pendiente) y lo
     * devuelve; se emite tal cual en `saved` y se cierra.
     *
     * Desde el pedido 7 (18/9/2026) este mismo POST puede además adelantar
     * `payment_expired_at` del cliente y avisar al sistema del cliente (cuando el pago cierra el
     * mes y admin ya tenía una fecha de próximo pago cargada) — el backend lo informa en la
     * clave nueva `vencimiento_avanzado` de la respuesta, que acá se refleja en el toast para
     * que quede claro que este único click hizo más de lo que hacía antes.
     */
    guardar() {
      const self = this
      if (!this.cliente || !this.cliente.id || !this.periodo_valido || this.guardando) {
        return
      }
      self.guardando = true
      api
        .post('/client/' + this.cliente.id + '/mensualidad/pagos', {
          periodo: self.form.periodo,
          monto: self.form.monto === '' || self.form.monto === null ? null : Number(self.form.monto),
          fecha_pago: self.form.fecha_pago || null,
          medio: self.form.medio || null,
          observacion: self.form.observacion || null,
          cerrar_periodo: !!self.form.cerrar_periodo,
        }, { silent_error: true })
        .then(function (res) {
          const periodo = (res.data && res.data.periodo) || null
          self.guardando = false
          const vencimiento = periodo && periodo.vencimiento_avanzado ? periodo.vencimiento_avanzado : null
          let mensaje = 'Pago registrado para ' + etiqueta_larga(self.form.periodo) + '.'
          let variante = 'success'
          if (vencimiento && vencimiento.ocurrio) {
            mensaje += ' Próximo vencimiento: ' + formatear_fecha(vencimiento.nueva_fecha) + '.'
            if (!vencimiento.sincronizado) {
              // Se adelantó en admin pero no se pudo avisar al sistema del cliente (best-effort,
              // punto D del plan): no es un error del pago en sí, pero merece un tono distinto.
              mensaje += ' No se pudo avisar al sistema del cliente' +
                (vencimiento.motivo_no_sincronizado ? ' (' + vencimiento.motivo_no_sincronizado + ')' : '') + '.'
              variante = 'warning'
            }
          }
          window.dispatchEvent(new CustomEvent('admin-spa-toast', {
            detail: { message: mensaje, variant: variante },
          }))
          self.$emit('saved', periodo)
          self.$emit('update:show', false)
          self.$emit('close')
        })
        .catch(function (error) {
          self.guardando = false
          window.dispatchEvent(new CustomEvent('admin-spa-toast', {
            detail: { message: resolve_error_message(error), variant: 'danger' },
          }))
        })
    },
  },
}
</script>
