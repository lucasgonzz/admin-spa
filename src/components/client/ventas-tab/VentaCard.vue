<template>
  <div class="card venta-card mb-3">
    <!-- ============================================================ -->
    <!-- Encabezado de la venta: qué se vendió, cuánto, cuánto pagó   -->
    <!-- el cliente y qué le toca al vendedor.                        -->
    <!-- ============================================================ -->
    <div class="card-body pb-2">
      <div class="d-flex flex-wrap align-items-start gap-2 mb-2">
        <div class="flex-grow-1 min-w-0">
          <div class="d-flex flex-wrap align-items-center gap-1">
            <span
              v-for="producto in productos_visibles"
              :key="producto.clave"
              class="badge venta-card__badge"
              :class="clase_badge_producto(producto.clave)"
            >
              {{ producto.etiqueta }}
            </span>
            <span v-if="!productos_visibles.length" class="text-muted small">Sin productos</span>
            <span class="text-muted small ms-1">· {{ formatear_fecha(venta.fecha) }}</span>
            <span v-if="etiqueta_origen" class="badge text-bg-light border text-muted ms-1" :title="'Origen: ' + etiqueta_origen">{{ etiqueta_origen }}</span>
          </div>
          <p v-if="venta.descripcion" class="small mb-0 mt-1">{{ venta.descripcion }}</p>
          <p v-if="venta.observacion" class="text-muted small mb-0 mt-1 fst-italic">{{ venta.observacion }}</p>
          <!-- Seña (misión senas-en-ventas, 30/10/2026): chip con el total; al tocarlo se despliega
               la lista (fecha, monto, nota). Oculto si la venta no tiene señas. -->
          <div v-if="tiene_senas" class="mt-1">
            <button
              type="button"
              class="btn btn-sm btn-outline-success venta-card__sena-chip"
              :aria-expanded="senas_abiertas ? 'true' : 'false'"
              :title="senas_abiertas ? 'Ocultar las señas' : 'Ver las señas'"
              @click="senas_abiertas = !senas_abiertas"
            >
              <i class="bi bi-cash-coin me-1"></i>Seña {{ format_monto_con_moneda(sena_total, venta.moneda) }}
              <i class="bi ms-1" :class="senas_abiertas ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
            </button>
            <ul v-if="senas_abiertas" class="list-unstyled small mb-0 mt-1 venta-card__senas">
              <li v-for="sena in senas" :key="sena.id" class="venta-card__sena">
                <span class="text-muted">{{ formatear_fecha(sena.fecha) }}</span>
                <span class="fw-semibold ms-2">{{ format_monto_con_moneda(sena.monto, sena.moneda || venta.moneda) }}</span>
                <span v-if="sena.nota" class="text-muted fst-italic ms-2">{{ sena.nota }}</span>
              </li>
            </ul>
          </div>
        </div>
        <div class="d-flex flex-wrap gap-1 ms-auto">
          <button type="button" class="btn btn-outline-primary btn-sm" :disabled="ocupado" @click="alternar_cuota_nueva">
            <i class="bi bi-plus-lg"></i>
            <span class="d-none d-sm-inline ms-1">{{ cuota_nueva.show ? 'Cancelar' : 'Cuota' }}</span>
          </button>
          <!-- Solo si queda saldo: una seña no puede pasar la deuda. -->
          <button v-if="puede_registrar_sena" type="button" class="btn btn-outline-success btn-sm" :disabled="ocupado" @click="alternar_sena_nueva">
            <i class="bi bi-cash-coin"></i>
            <span class="ms-1">{{ sena_nueva.show ? 'Cancelar' : 'Registrar seña' }}</span>
          </button>
          <button type="button" class="btn btn-outline-secondary btn-sm" :disabled="ocupado" title="Editar la venta" @click="alternar_edicion">
            <i class="bi bi-pencil"></i>
          </button>
          <button type="button" class="btn btn-outline-danger btn-sm" :disabled="ocupado" title="Eliminar la venta" @click="eliminar_venta">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>

      <!-- Cifras: lo del cliente a la izquierda, lo del vendedor a la derecha. En teléfono se
           apilan de a dos por renglón. -->
      <div class="row g-2 venta-card__cifras">
        <div class="col-6 col-md-2">
          <div class="text-muted small">Total</div>
          <div class="fw-semibold">{{ format_monto_con_moneda(resumen.total, venta.moneda) }}</div>
        </div>
        <div class="col-6 col-md-2">
          <div class="text-muted small">Cobrado</div>
          <div class="fw-semibold text-success">{{ format_monto_con_moneda(resumen.cobrado, venta.moneda) }}</div>
        </div>
        <div class="col-6 col-md-2">
          <div class="text-muted small">Debe el cliente</div>
          <!-- Rojo = plata a cobrar; ámbar = el cliente es de dudoso cobro (deuda en stand-by). -->
          <div class="fw-semibold" :class="{ 'text-danger': resumen.pendiente > 0 && !venta.cobro_dudoso, 'text-warning-emphasis': resumen.pendiente > 0 && venta.cobro_dudoso }">{{ format_monto_con_moneda(resumen.pendiente, venta.moneda) }}</div>
        </div>
        <div class="col-6 col-md-6">
          <div class="text-muted small">
            Comisión
            <template v-if="nombre_vendedor">de {{ nombre_vendedor }}</template>
            <template v-if="comision.porcentaje !== null"> · {{ comision.porcentaje }} %</template>
          </div>
          <div v-if="nombre_vendedor" class="small">
            <span class="fw-semibold">{{ format_monto_con_moneda(comision.total, comision.moneda) }}</span>
            <span class="text-muted"> · liberada {{ format_monto_con_moneda(comision.liberada, comision.moneda) }}</span>
            <span class="text-muted"> · pagada {{ format_monto_con_moneda(comision.pagada, comision.moneda) }}</span>
            <span class="fw-semibold" :class="comision.a_pagar > 0 ? 'text-primary' : 'text-muted'"> · a pagar {{ format_monto_con_moneda(comision.a_pagar, comision.moneda) }}</span>
          </div>
          <div v-else class="text-muted small fst-italic">Sin vendedor asignado</div>
        </div>
      </div>
    </div>

    <div class="card-body pt-0">
      <!-- ========================================================== -->
      <!-- Edición de la venta, inline                                -->
      <!-- ========================================================== -->
      <div v-if="edicion.show" class="bg-light rounded p-3 mb-2">
        <p class="small fw-semibold mb-2">Editar venta</p>
        <div class="d-flex flex-wrap gap-3 mb-2">
          <div v-for="(etiqueta, clave) in productos" :key="clave" class="form-check">
            <input
              :id="'venta-' + venta.id + '-producto-' + clave"
              v-model="edicion.form.productos"
              class="form-check-input"
              type="checkbox"
              :value="clave"
            />
            <label class="form-check-label small" :for="'venta-' + venta.id + '-producto-' + clave">{{ etiqueta }}</label>
          </div>
        </div>
        <div class="row g-2">
          <div class="col-6 col-md-2">
            <label class="form-label small mb-1">Fecha</label>
            <input v-model="edicion.form.fecha" type="date" class="form-control form-control-sm" />
          </div>
          <div class="col-6 col-md-2">
            <label class="form-label small mb-1">Moneda</label>
            <select v-model="edicion.form.moneda" class="form-select form-select-sm">
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </div>
          <div class="col-12 col-md-4">
            <label class="form-label small mb-1">Vendedor</label>
            <select v-model="edicion.form.vendedor_admin_id" class="form-select form-select-sm">
              <option :value="null">Sin vendedor</option>
              <option v-for="vendedor in vendedores" :key="vendedor.id" :value="vendedor.id">{{ vendedor.name }}</option>
            </select>
          </div>
          <div class="col-6 col-md-2">
            <label class="form-label small mb-1">Comisión %</label>
            <input v-model="edicion.form.comision_porcentaje" type="number" min="0" max="100" step="0.5" class="form-control form-control-sm" :placeholder="String(porcentaje_sugerido_edicion)" />
          </div>
          <div class="col-6 col-md-2">
            <label class="form-label small mb-1">Comisión total</label>
            <div class="form-control form-control-sm bg-white">{{ format_monto_con_moneda(comision_editada, edicion.form.moneda) }}</div>
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label small mb-1">Descripción <span v-if="descripcion_obligatoria_edicion" class="text-danger">*</span></label>
            <input v-model="edicion.form.descripcion" type="text" maxlength="255" class="form-control form-control-sm" :placeholder="descripcion_obligatoria_edicion ? 'Qué se vendió' : 'Opcional'" />
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label small mb-1">Observación</label>
            <input v-model="edicion.form.observacion" type="text" class="form-control form-control-sm" placeholder="Opcional" />
          </div>
        </div>
        <p class="text-muted small mb-0 mt-2">
          El total de la venta sale de sus cuotas: para cambiarlo, editá o agregá cuotas.
        </p>
        <div class="d-flex justify-content-end gap-2 mt-2">
          <button type="button" class="btn btn-secondary btn-sm" @click="edicion.show = false">Cancelar</button>
          <button type="button" class="btn btn-primary btn-sm" :disabled="ocupado || !edicion_valida" @click="guardar_edicion">
            {{ ocupado ? 'Guardando...' : 'Guardar venta' }}
          </button>
        </div>
      </div>

      <!-- ========================================================== -->
      <!-- Alta de una cuota más en esta venta, inline. La moneda es  -->
      <!-- la de la venta: una venta no mezcla monedas.               -->
      <!-- ========================================================== -->
      <div v-if="cuota_nueva.show" class="bg-light rounded p-3 mb-2">
        <p class="small fw-semibold mb-2">Agregar cuota a esta venta ({{ venta.moneda }})</p>
        <div class="row g-2">
          <div class="col-6 col-md-3">
            <label class="form-label small mb-1">Monto</label>
            <input v-model="cuota_nueva.form.monto" type="number" min="0" step="0.01" class="form-control form-control-sm" />
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label small mb-1">Vencimiento</label>
            <input v-model="cuota_nueva.form.vencimiento" type="date" class="form-control form-control-sm" />
          </div>
          <div class="col-12 col-md-6">
            <label class="form-label small mb-1">Observación</label>
            <input v-model="cuota_nueva.form.observacion" type="text" class="form-control form-control-sm" placeholder="Opcional" />
          </div>
        </div>
        <p class="text-muted small mb-0 mt-2">La cuota se suma al total de la venta y recalcula la comisión.</p>
        <div class="d-flex justify-content-end mt-2">
          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="ocupado || cuota_nueva.form.monto === '' || cuota_nueva.form.monto === null"
            @click="agregar_cuota"
          >
            {{ ocupado ? 'Guardando...' : 'Guardar cuota' }}
          </button>
        </div>
      </div>

      <!-- ========================================================== -->
      <!-- Registrar una seña: pago a cuenta que el backend aplica    -->
      <!-- solo a las cuotas pendientes más próximas.                 -->
      <!-- ========================================================== -->
      <sena-form
        v-if="sena_nueva.show"
        :id_base="'venta-' + venta.id + '-sena'"
        :url="'/ventas/' + venta.id + '/senas'"
        :moneda="venta.moneda || 'USD'"
        :maximo="resumen.pendiente"
        titulo="Registrar seña"
        ayuda="La seña se aplica sola a las cuotas pendientes más próximas."
        @registrada="sena_registrada"
        @cancelar="sena_nueva.show = false"
      />

      <cuotas-tabla
        :client_id="client_id"
        :cuotas="cuotas"
        :moneda_venta="venta.moneda || 'USD'"
        texto_vacio="Esta venta no tiene cuotas cargadas."
        @cambio="$emit('cambio')"
      />
    </div>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import CuotasTabla from './CuotasTabla.vue'
import SenaForm from '@/components/senas/SenaForm.vue'
import { formatear_fecha } from '@/components/cobranzas/meses'
import { format_monto_con_moneda } from '@/components/cobranzas/plata'
import {
  PRODUCTOS_LIBRES,
  clase_badge_producto,
  comision_de_venta,
  nombre_de_vendedor,
  numero,
  porcentaje_sugerido,
  productos_de_venta,
  redondear,
  resumen_de_venta,
} from '@/components/cobranzas/ventas'

/**
 * Una venta del cliente en la pestaña Ventas (misión ventas-y-comisiones, 28/10/2026).
 *
 * Arriba, el encabezado: qué se vendió (badges de productos), cuándo, de dónde vino (contrato,
 * manual, Claude, planilla), cuánto es, cuánto pagó el cliente y la comisión del vendedor
 * (total · liberada · pagada · a pagar). Abajo, sus cuotas, con la misma gestión de siempre
 * (`CuotasTabla`).
 *
 * Desde acá se edita la venta (`PUT client/{id}/ventas/{ventaId}`), se le agrega una cuota
 * (`POST client/{id}/ventas/{ventaId}/cuotas`, que además suma al total) y se la elimina
 * (`DELETE client/{id}/ventas/{ventaId}`; la API contesta 422 si ya se le pagó comisión al
 * vendedor, y ese mensaje se muestra tal cual).
 *
 * Señas (misión senas-en-ventas, 30/10/2026): si la venta trae `senas` / `resumen.sena_total` se
 * muestra el chip «Seña USD X» con la lista desplegable, y mientras haya saldo pendiente el botón
 * «Registrar seña» abre `SenaForm` (`POST ventas/{id}/senas`). La seña se aplica sola a las
 * cuotas en el backend; acá solo se redibuja con la respuesta. Contra una API vieja que no manda
 * `senas`, el chip no aparece (lista vacía, total 0).
 *
 * No guarda estado propio de la venta: todo lo que cambia vuelve al orquestador, con `lista`
 * cuando la respuesta trae la lista entera de ventas (forma del GET) o con `cambio` cuando hay
 * que volver a pedirla.
 */
export default {
  name: 'VentasTabVentaCard',
  components: { CuotasTabla, SenaForm },
  props: {
    /** id del cliente (arma las rutas). */
    client_id: { type: [Number, String], required: true },
    /** La venta, tal como la arma `VentaService::venta_para_json()`. */
    venta: { type: Object, required: true },
    /** Mapa `{clave: etiqueta}` de los productos vendibles. */
    productos: { type: Object, default: function () { return {} } },
    /** Admins que pueden ser vendedores: `[{id, name}]`. */
    vendedores: { type: Array, default: function () { return [] } },
    /**
     * true si el contrato del cliente (o de su lead) está en Suscripción: con el sistema
     * (`gestion`) en la venta, el % sugerido es 30 en vez de 15.
     */
    es_suscripcion: { type: Boolean, default: false },
  },
  emits: ['lista', 'cambio'],
  data() {
    return {
      // true mientras corre cualquier request de esta venta (editar, agregar cuota, eliminar).
      ocupado: false,
      // Edición inline de la venta.
      edicion: { show: false, form: {} },
      // Alta inline de una cuota de esta venta.
      cuota_nueva: { show: false, form: { monto: '', vencimiento: '', observacion: '' } },
      // Alta inline de una seña (el formulario vive en `SenaForm`).
      sena_nueva: { show: false },
      // true si el desplegable con la lista de señas está abierto.
      senas_abiertas: false,
    }
  },
  computed: {
    /**
     * Productos con su etiqueta, para los badges.
     * @returns {Array<{clave: string, etiqueta: string}>}
     */
    productos_visibles() {
      return productos_de_venta(this.venta, this.productos)
    },
    /**
     * Cuotas de la venta (arreglo vacío si no trae).
     * @returns {Array<Object>}
     */
    cuotas() {
      return Array.isArray(this.venta.cuotas) ? this.venta.cuotas : []
    },
    /**
     * Señas de la venta `[{id, monto, moneda, fecha, nota, origen}]`; vacío si la API no las manda.
     * @returns {Array<Object>}
     */
    senas() {
      return Array.isArray(this.venta.senas) ? this.venta.senas : []
    },
    /**
     * Total señado: `resumen.sena_total` si la API lo manda; si no, la suma de la lista; 0 sin nada.
     * @returns {number}
     */
    sena_total() {
      const resumen = this.venta.resumen || {}
      if (resumen.sena_total !== undefined && resumen.sena_total !== null) {
        return numero(resumen.sena_total)
      }
      return redondear(this.senas.reduce(function (acumulado, sena) {
        return acumulado + numero(sena.monto)
      }, 0))
    },
    /**
     * true si hay algo para mostrar en el chip de seña.
     * @returns {boolean}
     */
    tiene_senas() {
      return this.senas.length > 0 || this.sena_total > 0
    },
    /**
     * true si se puede registrar una seña: queda saldo pendiente en la venta.
     * @returns {boolean}
     */
    puede_registrar_sena() {
      return this.resumen.pendiente > 0
    },
    /**
     * `{total, cobrado, pendiente}` de la venta.
     * @returns {Object}
     */
    resumen() {
      return resumen_de_venta(this.venta)
    },
    /**
     * La comisión con defaults.
     * @returns {Object}
     */
    comision() {
      return comision_de_venta(this.venta)
    },
    /**
     * Nombre del vendedor ('' si la venta no tiene).
     * @returns {string}
     */
    nombre_vendedor() {
      return nombre_de_vendedor(this.venta, this.vendedores)
    },
    /**
     * Rótulo del origen de la venta, para el badge chiquito del encabezado. Las ventas manuales
     * no llevan badge: es el caso normal y no aporta nada.
     * @returns {string}
     */
    etiqueta_origen() {
      const etiquetas = { contrato: 'Contrato', claude: 'Claude', planilla: 'Planilla' }
      return etiquetas[this.venta.origen] || ''
    },
    /**
     * true si los productos de la edición incluyen uno de importe libre (desarrollo / otro), que
     * exige descripción.
     * @returns {boolean}
     */
    descripcion_obligatoria_edicion() {
      const productos = this.edicion.form.productos || []
      return productos.some(function (clave) {
        return PRODUCTOS_LIBRES.indexOf(clave) !== -1
      })
    },
    /**
     * true si la edición se puede guardar: al menos un producto y, si hace falta, descripción.
     * @returns {boolean}
     */
    edicion_valida() {
      const f = this.edicion.form
      if (!Array.isArray(f.productos) || !f.productos.length) {
        return false
      }
      if (this.descripcion_obligatoria_edicion && !String(f.descripcion || '').trim()) {
        return false
      }
      return true
    },
    /**
     * Comisión total con el % que se está tipeando, en vivo: total de la venta × % / 100.
     * @returns {number}
     */
    comision_editada() {
      return redondear(numero(this.resumen.total || this.venta.monto_total) * numero(this.edicion.form.comision_porcentaje) / 100)
    },
    /**
     * % que le corresponde a la venta con los productos que tiene tildados la edición: 30 si
     * incluye el sistema y el cliente está en Suscripción, 15 si no (espejo de
     * `VentaService::porcentaje_por_defecto()`).
     * @returns {number}
     */
    porcentaje_sugerido_edicion() {
      return porcentaje_sugerido(this.edicion.form.productos || [], this.es_suscripcion)
    },
  },
  watch: {
    /**
     * Hallazgo H1 de la revisión (28/10/2026): una venta sin % a la que se le asigna vendedor
     * guardaba `comision_porcentaje: null` y la comisión quedaba en cero. Ahora, al elegir un
     * vendedor con el % vacío, se precarga el % sugerido y la comisión calculada aparece en
     * vivo. Si el operador ya tenía un % cargado, no se toca.
     * @param {number|null} nuevo
     */
    'edicion.form.vendedor_admin_id': function (nuevo) {
      if (!this.edicion.show || !nuevo) {
        return
      }
      const actual = this.edicion.form.comision_porcentaje
      if (actual === '' || actual === null || actual === undefined) {
        this.edicion.form.comision_porcentaje = this.porcentaje_sugerido_edicion
      }
    },
  },
  methods: {
    formatear_fecha,
    format_monto_con_moneda,
    clase_badge_producto,
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
     * Le pasa la respuesta al orquestador: si trae la lista entera de ventas (la forma del GET)
     * se usa tal cual; si no, se pide que recargue.
     * @param {Object} data
     */
    devolver(data) {
      if (data && Array.isArray(data.ventas)) {
        this.$emit('lista', data)
      } else {
        this.$emit('cambio')
      }
    },
    /**
     * Abre o cierra la edición, precargada con lo que tiene la venta. Cierra el alta de cuota:
     * un formulario a la vez.
     */
    alternar_edicion() {
      if (this.edicion.show) {
        this.edicion.show = false
        return
      }
      this.cuota_nueva.show = false
      this.sena_nueva.show = false
      const venta = this.venta
      this.edicion = {
        show: true,
        form: {
          productos: Array.isArray(venta.productos) ? venta.productos.slice() : [],
          descripcion: venta.descripcion || '',
          fecha: venta.fecha ? String(venta.fecha).slice(0, 10) : '',
          moneda: venta.moneda || 'USD',
          vendedor_admin_id: venta.vendedor_admin_id || null,
          comision_porcentaje: venta.comision_porcentaje !== null && venta.comision_porcentaje !== undefined ? venta.comision_porcentaje : '',
          observacion: venta.observacion || '',
        },
      }
    },
    /**
     * PUT client/{id}/ventas/{ventaId}. El backend recalcula `comision_monto` si cambió el %.
     * Si el % quedó vacío, la clave NO se manda (hallazgo H1): mandar null dejaba la venta sin
     * porcentaje y con la comisión en cero; sin la clave, la API conserva lo que había o aplica
     * su default.
     */
    guardar_edicion() {
      const self = this
      if (this.ocupado || !this.edicion_valida) {
        return
      }
      const f = this.edicion.form
      const payload = {
        productos: f.productos,
        descripcion: String(f.descripcion || '').trim() || null,
        fecha: f.fecha || null,
        moneda: f.moneda || 'USD',
        vendedor_admin_id: f.vendedor_admin_id || null,
        observacion: String(f.observacion || '').trim() || null,
      }
      /* El % viaja solo si tiene un valor: vacío = no se manda la clave (ver el comentario de arriba). */
      if (f.comision_porcentaje !== '' && f.comision_porcentaje !== null && f.comision_porcentaje !== undefined) {
        payload.comision_porcentaje = Number(f.comision_porcentaje)
      }
      self.ocupado = true
      api
        .put('/client/' + this.client_id + '/ventas/' + this.venta.id, payload, { silent_error: true })
        .then(function (res) {
          self.ocupado = false
          self.edicion.show = false
          self.avisar('Venta guardada.')
          self.devolver(res.data || {})
        })
        .catch(function (error) {
          self.ocupado = false
          self.avisar(resolve_error_message(error), 'danger')
        })
    },
    /**
     * Abre o cierra el alta de cuota. Cierra la edición de la venta.
     */
    alternar_cuota_nueva() {
      if (this.cuota_nueva.show) {
        this.cuota_nueva.show = false
        return
      }
      this.edicion.show = false
      this.sena_nueva.show = false
      this.cuota_nueva = { show: true, form: { monto: '', vencimiento: '', observacion: '' } }
    },
    /**
     * POST client/{id}/ventas/{ventaId}/cuotas: la cuota nace enlazada a la venta, en su moneda,
     * y el backend suma su monto al total. El mes se deriva del vencimiento (como en el alta de
     * cuota de siempre).
     */
    agregar_cuota() {
      const self = this
      if (this.ocupado) {
        return
      }
      const f = this.cuota_nueva.form
      self.ocupado = true
      api
        .post('/client/' + this.client_id + '/ventas/' + this.venta.id + '/cuotas', {
          monto: Number(f.monto || 0),
          moneda: this.venta.moneda || 'USD',
          vencimiento: f.vencimiento || null,
          periodo: f.vencimiento ? String(f.vencimiento).slice(0, 7) : null,
          observacion: String(f.observacion || '').trim() || null,
        }, { silent_error: true })
        .then(function (res) {
          self.ocupado = false
          self.cuota_nueva.show = false
          self.avisar('Cuota agregada a la venta.')
          self.devolver(res.data || {})
        })
        .catch(function (error) {
          self.ocupado = false
          self.avisar(resolve_error_message(error), 'danger')
        })
    },
    /**
     * Abre o cierra el alta de seña. Cierra la edición de la venta y el alta de cuota: un
     * formulario a la vez.
     */
    alternar_sena_nueva() {
      if (this.sena_nueva.show) {
        this.sena_nueva.show = false
        return
      }
      this.edicion.show = false
      this.cuota_nueva.show = false
      this.sena_nueva = { show: true }
    },
    /**
     * La seña se registró (`POST ventas/{id}/senas`). El backend devuelve la lista entera del
     * cliente: en la raíz con `ventas` o, según la versión, dentro de `lista_del_cliente`. Si no
     * viene ninguna de las dos, se pide al orquestador que recargue.
     * @param {Object} data Respuesta de la API.
     */
    sena_registrada(data) {
      this.sena_nueva.show = false
      this.avisar('Seña registrada: se aplicó a las cuotas.')
      if (data && !Array.isArray(data.ventas) && data.lista_del_cliente && Array.isArray(data.lista_del_cliente.ventas)) {
        this.devolver(data.lista_del_cliente)
        return
      }
      this.devolver(data || {})
    },
    /**
     * DELETE client/{id}/ventas/{ventaId}, previa confirmación. Se lleva sus cuotas. Si al
     * vendedor ya se le pagó comisión por esta venta, la API no la deja borrar (422) y el
     * mensaje se muestra en el toast.
     */
    eliminar_venta() {
      const self = this
      if (this.ocupado) {
        return
      }
      const etiquetas = this.productos_visibles.map(function (p) { return p.etiqueta }).join(', ')
      /* Si el cliente ya pagó algo, el aviso lo dice con el monto: borrar la venta se lleva
         también las cuotas cobradas, y eso es plata registrada que desaparece. */
      const aviso_cuotas = this.resumen.cobrado > 0
        ? 'Se borran también las cuotas, incluidas las que el cliente ya pagó: ' + format_monto_con_moneda(this.resumen.cobrado, this.venta.moneda) + '.'
        : 'Se borran también sus ' + this.cuotas.length + ' cuotas.'
      const confirmado = window.confirm(
        '¿Eliminar la venta (' + (etiquetas || 'sin productos') + ') de ' +
        format_monto_con_moneda(this.resumen.total, this.venta.moneda) +
        '? ' + aviso_cuotas
      )
      if (!confirmado) {
        return
      }
      self.ocupado = true
      api
        .delete('/client/' + this.client_id + '/ventas/' + this.venta.id, { silent_error: true })
        .then(function (res) {
          self.ocupado = false
          self.avisar('Venta eliminada.')
          self.devolver(res.data || {})
        })
        .catch(function (error) {
          self.ocupado = false
          self.avisar(resolve_error_message(error), 'danger')
        })
    },
  },
}
</script>

<style scoped lang="scss">
/* Misma familia visual que los paneles de la pestaña: borde suave y esquinas redondeadas. */
.venta-card {
	border-color: #e3e3e8;
	border-radius: 0.75rem;
}

.venta-card__badge {
	font-weight: 500;
}

/* Chip de la seña: compacto, para que no robe protagonismo a las cifras. */
.venta-card__sena-chip {
	padding: 0.1rem 0.5rem;
	font-size: 0.8rem;
	border-radius: 1rem;
}

/* Lista de señas desplegada: una por renglón, con una guía a la izquierda. */
.venta-card__senas {
	border-left: 2px solid #b7dfc6;
	padding-left: 0.6rem;
}

.venta-card__sena {
	padding: 0.1rem 0;
	overflow-wrap: anywhere;
}

/* Las cifras con un separador fino arriba, para leerlas como una franja aparte del título. */
.venta-card__cifras {
	border-top: 1px solid #f0f0f3;
	padding-top: 0.5rem;
}

/* `min-width: 0` deja que el bloque del título se encoja en teléfono en vez de empujar los botones
   fuera de la tarjeta (un flex item no baja de su contenido sin esto). */
.min-w-0 {
	min-width: 0;
}
</style>
