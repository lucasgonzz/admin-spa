<template>
  <div class="bg-light rounded p-3 mb-3 nueva-venta">
    <p class="fw-semibold small mb-2">Nueva venta</p>

    <!-- ============================================================ -->
    <!-- Qué se vende. Los tres sistemas tienen precio de lista y lo  -->
    <!-- precargan; Desarrollo a medida y Otro son de importe libre y -->
    <!-- piden descripción.                                           -->
    <!-- ============================================================ -->
    <div class="d-flex flex-wrap gap-3 mb-2">
      <div v-for="(etiqueta, clave) in productos" :key="clave" class="form-check">
        <input
          :id="'nueva-venta-producto-' + clave"
          v-model="form.productos"
          class="form-check-input"
          type="checkbox"
          :value="clave"
        />
        <label class="form-check-label small" :for="'nueva-venta-producto-' + clave">
          {{ etiqueta }}
          <span v-if="precio_de_lista(clave) !== null" class="text-muted">({{ format_monto_con_moneda(precio_de_lista(clave), 'USD') }})</span>
        </label>
      </div>
    </div>

    <div class="row g-2">
      <div class="col-6 col-md-2">
        <label class="form-label small mb-1">Moneda</label>
        <select v-model="form.moneda" class="form-select form-select-sm">
          <option value="USD">USD</option>
          <option value="ARS">ARS</option>
        </select>
      </div>
      <div class="col-6 col-md-3">
        <label class="form-label small mb-1">Total de la venta</label>
        <input
          v-model="form.monto_total"
          type="number"
          min="0"
          step="0.01"
          class="form-control form-control-sm"
          :class="{ 'is-invalid': falta_total_en_pesos }"
          :placeholder="hay_importe_libre || form.moneda !== 'USD' ? 'Importe libre' : ''"
        />
      </div>
      <div class="col-6 col-md-2 d-flex align-items-end">
        <div class="form-check mb-1">
          <input id="nueva-venta-contado" v-model="form.contado" class="form-check-input" type="checkbox" />
          <label class="form-check-label small" for="nueva-venta-contado">
            De contado<span v-if="descuento_contado > 0" class="text-muted"> (−{{ descuento_contado }} %)</span>
          </label>
        </div>
      </div>
      <div class="col-6 col-md-2">
        <label class="form-label small mb-1">Fecha de la venta</label>
        <input v-model="form.fecha" type="date" class="form-control form-control-sm" @change="on_fecha_cambiada" />
      </div>
      <div class="col-6 col-md-1">
        <label class="form-label small mb-1">Cuotas</label>
        <input
          v-model.number="form.cantidad_cuotas"
          type="number"
          min="1"
          max="60"
          step="1"
          class="form-control form-control-sm"
          @input="cantidad_tocada = true"
        />
      </div>
      <div class="col-6 col-md-2">
        <label class="form-label small mb-1">1er vencimiento</label>
        <input v-model="form.primer_vencimiento" type="date" class="form-control form-control-sm" @input="vencimiento_tocado = true" />
      </div>

      <div class="col-12 col-md-6">
        <label class="form-label small mb-1">
          Descripción <span v-if="hay_importe_libre" class="text-danger">*</span>
        </label>
        <input
          v-model="form.descripcion"
          type="text"
          maxlength="255"
          class="form-control form-control-sm"
          :class="{ 'is-invalid': intento_guardar && hay_importe_libre && !form.descripcion.trim() }"
          :placeholder="hay_importe_libre ? 'Qué se desarrolla o qué se vende' : 'Opcional'"
        />
      </div>
      <div class="col-12 col-md-6">
        <label class="form-label small mb-1">Observación</label>
        <input v-model="form.observacion" type="text" class="form-control form-control-sm" placeholder="Opcional" />
      </div>

      <!-- Comisión del vendedor: vendedor, %, y cuánto da en vivo. -->
      <div class="col-12 col-md-5">
        <label class="form-label small mb-1">Vendedor</label>
        <select v-model="form.vendedor_admin_id" class="form-select form-select-sm">
          <option :value="null">Sin vendedor</option>
          <option v-for="vendedor in vendedores" :key="vendedor.id" :value="vendedor.id">{{ vendedor.name }}</option>
        </select>
      </div>
      <div class="col-6 col-md-2">
        <label class="form-label small mb-1">Comisión %</label>
        <input
          v-model="form.comision_porcentaje"
          type="number"
          min="0"
          max="100"
          step="0.5"
          class="form-control form-control-sm"
          :disabled="!form.vendedor_admin_id"
          @input="porcentaje_tocado = true"
        />
      </div>
      <div class="col-6 col-md-5">
        <label class="form-label small mb-1">Comisión del vendedor</label>
        <div class="form-control form-control-sm bg-white nueva-venta__comision">
          <template v-if="form.vendedor_admin_id">
            <span class="fw-semibold">{{ format_monto_con_moneda(comision_calculada, form.moneda) }}</span>
            <span class="text-muted"> · se libera a medida que paga el cliente</span>
          </template>
          <span v-else class="text-muted">Sin vendedor, sin comisión</span>
        </div>
      </div>
    </div>

    <!-- Aviso del 30 %: que se vea por qué el % cambió solo. -->
    <p v-if="aplica_suscripcion" class="small text-primary mb-0 mt-2">
      <i class="bi bi-info-circle me-1"></i>
      El cliente está en modalidad Suscripción y la venta incluye el sistema: la comisión por defecto es {{ porcentaje_suscripcion }} %.
    </p>
    <!-- En pesos no hay precio de lista: el total es obligatorio (la API contesta 422 sin él) y
         el botón Guardar queda bloqueado hasta que se cargue. -->
    <p v-if="form.moneda !== 'USD' && (hay_precio_de_lista || falta_total_en_pesos)" class="small mb-0 mt-2" :class="falta_total_en_pesos ? 'text-danger' : 'text-muted'">
      Los precios de lista son en dólares: en pesos el total no se precarga<template v-if="falta_total_en_pesos"> y hay que cargarlo para poder guardar</template>.
    </p>

    <!-- ============================================================ -->
    <!-- Vista previa de las cuotas: el mismo reparto que hace la API -->
    <!-- (cuotas iguales, mensuales, la última absorbe el redondeo).  -->
    <!-- ============================================================ -->
    <div v-if="vista_previa.length" class="mt-3">
      <p class="small text-muted mb-1">Así quedan las cuotas:</p>
      <div class="table-responsive">
        <table class="table table-sm table-bordered small mb-0 nueva-venta__previa">
          <thead>
            <tr class="table-light">
              <th>N°</th>
              <th>Vence</th>
              <th class="text-end">Monto</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cuota in vista_previa" :key="cuota.numero">
              <td>{{ cuota.numero }}</td>
              <td class="text-nowrap">{{ cuota.vencimiento ? formatear_fecha(cuota.vencimiento) : '—' }}</td>
              <td class="text-end text-nowrap">{{ format_monto_con_moneda(cuota.monto, form.moneda) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <p v-if="intento_guardar && error_validacion" class="text-danger small mb-0 mt-2">{{ error_validacion }}</p>

    <div class="d-flex flex-wrap justify-content-end gap-2 mt-3">
      <button type="button" class="btn btn-secondary btn-sm" :disabled="guardando" @click="$emit('cancelar')">Cancelar</button>
      <button type="button" class="btn btn-primary btn-sm" :disabled="guardando || falta_total_en_pesos" @click="guardar">
        {{ guardando ? 'Guardando...' : 'Guardar venta' }}
      </button>
    </div>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import { formatear_fecha, hoy_iso } from '@/components/cobranzas/meses'
import { format_monto_con_moneda } from '@/components/cobranzas/plata'
import {
  COMISION_PORCENTAJE_SUSCRIPCION,
  PRODUCTOS_CON_PRECIO,
  PRODUCTOS_LIBRES,
  numero,
  porcentaje_sugerido,
  precio_sugerido,
  redondear,
  repartir_en_cuotas,
} from '@/components/cobranzas/ventas'

/**
 * Formulario "Nueva venta" de la pestaña Ventas del cliente (misión ventas-y-comisiones,
 * 28/10/2026).
 *
 * Arma el alta manual de una venta con todo precargado según la política de precios del
 * 26/10/2026 y la regla de comisiones del 28/10/2026, y todo editable:
 *
 * - **Total**: al tildar productos se precarga con `precios` (los tres sistemas juntos → precio
 *   de paquete; si no, la suma de los precios de lista); de contado, con el descuento de contado.
 *   Con Desarrollo a medida u Otro no hay precio: el importe es libre y la descripción
 *   obligatoria. En pesos no se precarga (los precios de lista son en dólares).
 * - **Cuotas**: una por defecto; tres si son los tres sistemas sin contado (la política); de
 *   contado, una. La vista previa reparte el total igual que la API.
 * - **Vendedor**: el `vendedor_por_defecto` (el único admin marcado "Es vendedor") o ninguno.
 * - **% de comisión**: 15, o 30 si se tilda el sistema en un cliente en Suscripción. Si el
 *   operador lo toca a mano, ya no se pisa.
 *
 * Guarda con `POST client/{id}/ventas` y le pasa al orquestador la respuesta (la lista entera de
 * ventas, misma forma que el GET) con `creada`.
 */
export default {
  name: 'VentasTabNuevaVentaForm',
  props: {
    /** id del cliente al que se le vende. */
    client_id: { type: [Number, String], required: true },
    /** Mapa `{clave: etiqueta}` de los productos vendibles. */
    productos: { type: Object, default: function () { return {} } },
    /** Precios de lista: `{gestion, ecommerce, agentes, los_tres, contado_descuento}`. */
    precios: { type: Object, default: function () { return {} } },
    /** Admins vendedores: `[{id, name}]`. */
    vendedores: { type: Array, default: function () { return [] } },
    /** id del vendedor que se preselecciona (null = ninguno). */
    vendedor_por_defecto: { type: [Number, String], default: null },
    /** true si el contrato del cliente (o de su lead) está en modalidad Suscripción. */
    es_suscripcion: { type: Boolean, default: false },
  },
  emits: ['creada', 'cancelar'],
  data() {
    const hoy = hoy_iso()
    return {
      // Campos del alta; los nombres son los del payload de `VentaService::crear()`.
      form: {
        productos: [],
        moneda: 'USD',
        monto_total: '',
        contado: false,
        fecha: hoy,
        cantidad_cuotas: 1,
        primer_vencimiento: hoy,
        descripcion: '',
        observacion: '',
        vendedor_admin_id: this.vendedor_por_defecto ? Number(this.vendedor_por_defecto) : null,
        comision_porcentaje: porcentaje_sugerido([], this.es_suscripcion),
      },
      // true si el operador tocó a mano la cantidad de cuotas: desde ahí no se recalcula sola.
      cantidad_tocada: false,
      // true si el operador tocó a mano el % de comisión: desde ahí no se recalcula solo.
      porcentaje_tocado: false,
      // true si el operador tocó a mano el primer vencimiento: deja de seguir a la fecha de la venta.
      vencimiento_tocado: false,
      // Último total que precargó el formulario (null = ninguno, o el operador lo pisó). Sirve
      // para limpiarlo al pasar a pesos: un 1.500 de lista en dólares no vale como ARS 1.500.
      ultimo_precargado: null,
      // true después del primer intento de guardar: recién ahí se pintan los errores.
      intento_guardar: false,
      // true mientras corre el POST.
      guardando: false,
    }
  },
  computed: {
    /**
     * true si hay tildado un producto de importe libre (Desarrollo a medida u Otro).
     * @returns {boolean}
     */
    hay_importe_libre() {
      return this.form.productos.some(function (clave) {
        return PRODUCTOS_LIBRES.indexOf(clave) !== -1
      })
    },
    /**
     * true si hay tildado al menos un producto con precio de lista.
     * @returns {boolean}
     */
    hay_precio_de_lista() {
      return this.form.productos.some(function (clave) {
        return PRODUCTOS_CON_PRECIO.indexOf(clave) !== -1
      })
    },
    /**
     * true si están tildados los tres sistemas (gestión, e-commerce y agentes).
     * @returns {boolean}
     */
    estan_los_tres() {
      const productos = this.form.productos
      return PRODUCTOS_CON_PRECIO.every(function (clave) {
        return productos.indexOf(clave) !== -1
      })
    },
    /**
     * Porcentaje de descuento de contado de la política (10 hoy).
     * @returns {number}
     */
    descuento_contado() {
      return numero(this.precios ? this.precios.contado_descuento : 0)
    },
    /**
     * El 30 % de Suscripción, para el texto del aviso.
     * @returns {number}
     */
    porcentaje_suscripcion() {
      return COMISION_PORCENTAJE_SUSCRIPCION
    },
    /**
     * true si a esta venta le corresponde el % de Suscripción (cliente en suscripción + gestión).
     * @returns {boolean}
     */
    aplica_suscripcion() {
      return this.es_suscripcion && this.form.productos.indexOf('gestion') !== -1
    },
    /**
     * Comisión total con lo que está cargado: total × % / 100. Sin vendedor, cero.
     * @returns {number}
     */
    comision_calculada() {
      if (!this.form.vendedor_admin_id) {
        return 0
      }
      return redondear(numero(this.form.monto_total) * numero(this.form.comision_porcentaje) / 100)
    },
    /**
     * Las cuotas que va a crear la API con este total, cantidad y primer vencimiento.
     * @returns {Array<{numero: number, monto: number, vencimiento: string}>}
     */
    vista_previa() {
      if (numero(this.form.monto_total) <= 0) {
        return []
      }
      return repartir_en_cuotas(this.form.monto_total, this.form.cantidad_cuotas, this.form.primer_vencimiento || this.form.fecha)
    },
    /**
     * true si la venta es en pesos y el total está vacío (o en cero). En pesos no hay precio de
     * lista que la API pueda usar, así que sin total contesta 422: el formulario lo bloquea antes.
     * @returns {boolean}
     */
    falta_total_en_pesos() {
      return this.form.moneda !== 'USD' && numero(this.form.monto_total) <= 0
    },
    /**
     * Primer error de validación (vacío si el formulario se puede mandar).
     * @returns {string}
     */
    error_validacion() {
      const f = this.form
      if (!f.productos.length) {
        return 'Elegí al menos un producto.'
      }
      if (this.falta_total_en_pesos) {
        return 'En pesos no hay precio de lista: cargá el total de la venta.'
      }
      if (numero(f.monto_total) <= 0) {
        return 'Cargá el total de la venta.'
      }
      if (this.hay_importe_libre && !String(f.descripcion || '').trim()) {
        return 'Para un desarrollo a medida u otro producto, escribí qué se vende.'
      }
      const cantidad = Math.floor(numero(f.cantidad_cuotas))
      if (cantidad < 1 || cantidad > 60) {
        return 'La cantidad de cuotas tiene que estar entre 1 y 60 (el tope de la API).'
      }
      if (f.vendedor_admin_id && (String(f.comision_porcentaje) === '' || numero(f.comision_porcentaje) < 0 || numero(f.comision_porcentaje) > 100)) {
        return 'El porcentaje de comisión tiene que estar entre 0 y 100.'
      }
      return ''
    },
  },
  watch: {
    /** Al tildar o destildar un producto se recalculan total, cuotas y %. */
    'form.productos': function () {
      this.recalcular_sugeridos()
    },
    /**
     * De contado: el total baja con el descuento y la venta pasa a una sola cuota (es un solo
     * pago). Al destildarlo vuelve el precio de lista y la cantidad sugerida.
     */
    'form.contado': function (contado) {
      if (contado) {
        this.cantidad_tocada = false
      }
      this.recalcular_sugeridos()
    },
    /** En pesos no hay precio de lista: al volver a dólares se vuelve a precargar. */
    'form.moneda': function () {
      this.recalcular_sugeridos()
    },
  },
  methods: {
    formatear_fecha,
    format_monto_con_moneda,
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
     * Precio de lista de un producto suelto (null si es de importe libre), para mostrarlo al lado
     * de la casilla.
     * @param {string} clave
     * @returns {number|null}
     */
    precio_de_lista(clave) {
      if (PRODUCTOS_CON_PRECIO.indexOf(clave) === -1 || !this.precios) {
        return null
      }
      const precio = this.precios[clave]
      return precio === undefined || precio === null ? null : numero(precio)
    },
    /**
     * Recalcula lo que el formulario precarga solo:
     * - el total, si hay precio sugerido (en dólares y sin productos de importe libre); si no lo
     *   hay, se deja lo que haya tipeado el operador;
     * - la cantidad de cuotas, si no la tocó: 1 de contado, 3 con los tres sistemas, 1 si no;
     * - el % de comisión, si no lo tocó: 30 con el sistema en Suscripción, 15 si no.
     */
    recalcular_sugeridos() {
      const f = this.form
      if (f.moneda === 'USD') {
        const sugerido = precio_sugerido(f.productos, f.contado, this.precios)
        if (sugerido !== null) {
          f.monto_total = sugerido
          this.ultimo_precargado = sugerido
        }
      } else if (this.ultimo_precargado !== null && numero(f.monto_total) === this.ultimo_precargado) {
        /* Se pasó a pesos con el precio de lista en dólares todavía en el campo: se vacía para
           que no se guarde "ARS 1.500" por error. Lo que el operador tipeó a mano no se toca. */
        f.monto_total = ''
        this.ultimo_precargado = null
      }
      if (!this.cantidad_tocada) {
        if (f.contado) {
          f.cantidad_cuotas = 1
        } else {
          f.cantidad_cuotas = this.estan_los_tres ? 3 : 1
        }
      }
      if (!this.porcentaje_tocado) {
        f.comision_porcentaje = porcentaje_sugerido(f.productos, this.es_suscripcion)
      }
    },
    /**
     * Si el operador no fijó a mano el primer vencimiento, sigue a la fecha de la venta (es el
     * default de la API: `primer_vencimiento` = `fecha`).
     */
    on_fecha_cambiada() {
      if (!this.vencimiento_tocado) {
        this.form.primer_vencimiento = this.form.fecha
      }
    },
    /**
     * POST client/{id}/ventas con el payload de `VentaService::crear()`. Se mandan
     * `cantidad_cuotas` y `primer_vencimiento` (no `cuotas` explícitas): la API arma las mismas
     * cuotas que muestra la vista previa. `vendedor_admin_id` va siempre, null explícito = sin
     * vendedor; sin vendedor no se manda %.
     */
    guardar() {
      const self = this
      this.intento_guardar = true
      if (this.guardando || this.error_validacion) {
        return
      }
      const f = this.form
      const payload = {
        productos: f.productos.slice(),
        descripcion: String(f.descripcion || '').trim() || null,
        fecha: f.fecha || null,
        monto_total: redondear(f.monto_total),
        moneda: f.moneda || 'USD',
        contado: !!f.contado,
        cantidad_cuotas: Math.floor(numero(f.cantidad_cuotas)) || 1,
        primer_vencimiento: f.primer_vencimiento || f.fecha || null,
        vendedor_admin_id: f.vendedor_admin_id ? Number(f.vendedor_admin_id) : null,
        observacion: String(f.observacion || '').trim() || null,
      }
      if (payload.vendedor_admin_id) {
        payload.comision_porcentaje = numero(f.comision_porcentaje)
      }
      self.guardando = true
      api
        .post('/client/' + this.client_id + '/ventas', payload, { silent_error: true })
        .then(function (res) {
          self.guardando = false
          self.avisar('Venta guardada.')
          self.$emit('creada', res.data || {})
        })
        .catch(function (error) {
          self.guardando = false
          self.avisar(resolve_error_message(error), 'danger')
        })
    },
  },
}
</script>

<style scoped lang="scss">
/* La comisión calculada se ve como un campo más (misma altura) pero no se edita. */
.nueva-venta__comision {
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

/* La vista previa es chica: no hace falta que ocupe todo el ancho en escritorio. */
.nueva-venta__previa {
	max-width: 28rem;
}
</style>
