<template>
  <div class="p-3">
    <!-- Indicador de carga inicial del snapshot de mensualidad -->
    <div v-if="loading" class="text-center py-4">
      <span class="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true" />
      <p class="text-muted small mt-2 mb-0">Cargando mensualidad...</p>
    </div>

    <!-- Sin cliente guardado todavía: no hay id para consultar el snapshot -->
    <p v-else-if="!record || !record.id" class="text-muted small fst-italic mb-0">
      Guardá el cliente primero para gestionar su mensualidad.
    </p>

    <!-- Error de carga del snapshot -->
    <div v-else-if="load_error" class="alert alert-danger py-2 small mb-0">
      {{ load_error }}
    </div>

    <div v-else>
      <!-- ============================================================ -->
      <!-- Bloque 1: Mensualidad (cálculo local, independiente de la    -->
      <!-- facturación). Guarda inputs + fecha + datos fiscales.        -->
      <!-- ============================================================ -->
      <div class="card mb-3">
        <div class="card-header bg-white">
          <strong>Mensualidad</strong>
        </div>
        <div class="card-body">
          <div class="row g-3">
            <!-- Fecha de próximo pago con botones de referencia para atrasar/adelantar 1 mes -->
            <div class="col-md-6">
              <label class="form-label small mb-1 fw-semibold">Fecha de próximo pago</label>
              <div class="input-group">
                <input v-model="form.payment_expired_at" type="date" class="form-control" />
              </div>
              <div class="btn-group btn-group-sm mt-1" role="group">
                <button type="button" class="btn btn-outline-secondary" @click="ajustar_mes(-1)">
                  Atrasar 1 mes
                </button>
                <button type="button" class="btn btn-outline-secondary" @click="ajustar_mes(1)">
                  Adelantar 1 mes
                </button>
              </div>
            </div>

            <!-- Cantidad de empleados: input principal para clientes viejos, se carga a mano -->
            <div class="col-md-6">
              <label class="form-label small mb-1 fw-semibold">Cantidad de empleados</label>
              <input
                v-model.number="form.cantidad_empleados"
                type="number"
                min="0"
                step="1"
                class="form-control"
              />
            </div>

            <!-- Precio base del plan (fijo, cubre al dueño) -->
            <div class="col-md-6">
              <label class="form-label small mb-1 fw-semibold">Precio base del plan</label>
              <input v-model.number="form.precio_plan" type="number" min="0" step="0.01" class="form-control" />
            </div>

            <!-- Precio por cuenta: base para empleados y fallback de los módulos -->
            <div class="col-md-6">
              <label class="form-label small mb-1 fw-semibold">Precio por cuenta</label>
              <input
                v-model.number="form.precio_por_cuenta"
                type="number"
                min="0"
                step="0.01"
                class="form-control"
              />
            </div>

            <!-- Toggles de módulos: se editan a mano (sin datos vivos, salvo el sync opcional del 335) -->
            <div class="col-12">
              <hr class="my-2" />
              <div class="row g-3">
                <div class="col-md-4">
                  <div class="form-check form-switch">
                    <input
                      id="mensualidad-ecommerce"
                      v-model="form.tiene_ecommerce"
                      class="form-check-input"
                      type="checkbox"
                    />
                    <label class="form-check-label small" for="mensualidad-ecommerce">Ecommerce</label>
                  </div>
                  <input
                    v-model.number="form.precio_ecommerce"
                    type="number"
                    min="0"
                    step="0.01"
                    class="form-control form-control-sm mt-1"
                    :placeholder="'Por defecto: $' + format_numero(form.precio_por_cuenta)"
                  />
                </div>
                <div class="col-md-4">
                  <div class="form-check form-switch">
                    <input
                      id="mensualidad-mercado-libre"
                      v-model="form.tiene_mercado_libre"
                      class="form-check-input"
                      type="checkbox"
                    />
                    <label class="form-check-label small" for="mensualidad-mercado-libre">Mercado Libre</label>
                  </div>
                  <input
                    v-model.number="form.precio_mercado_libre"
                    type="number"
                    min="0"
                    step="0.01"
                    class="form-control form-control-sm mt-1"
                    :placeholder="'Por defecto: $' + format_numero(form.precio_por_cuenta)"
                  />
                </div>
                <div class="col-md-4">
                  <div class="form-check form-switch">
                    <input
                      id="mensualidad-tienda-nube"
                      v-model="form.tiene_tienda_nube"
                      class="form-check-input"
                      type="checkbox"
                    />
                    <label class="form-check-label small" for="mensualidad-tienda-nube">Tienda Nube</label>
                  </div>
                  <input
                    v-model.number="form.precio_tienda_nube"
                    type="number"
                    min="0"
                    step="0.01"
                    class="form-control form-control-sm mt-1"
                    :placeholder="'Por defecto: $' + format_numero(form.precio_por_cuenta)"
                  />
                </div>
              </div>
            </div>

            <!-- Desglose reactivo: se recalcula en el front con cada cambio, sin esperar al backend -->
            <div class="col-12">
              <table class="table table-sm table-bordered mt-2 mb-0 small">
                <thead>
                  <tr class="table-light">
                    <th>Concepto</th>
                    <th>Precio unitario</th>
                    <th>Cuentas</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Plan (sistema)</td>
                    <td>${{ format_numero(form.precio_plan) }}</td>
                    <td>—</td>
                    <td>${{ format_numero(desglose.plan) }}</td>
                  </tr>
                  <tr>
                    <td>Empleados</td>
                    <td>${{ format_numero(form.precio_por_cuenta) }}</td>
                    <td>{{ form.cantidad_empleados || 0 }}</td>
                    <td>${{ format_numero(desglose.empleados) }}</td>
                  </tr>
                  <tr :class="{ 'text-muted': !form.tiene_ecommerce }">
                    <td>Ecommerce</td>
                    <td>${{ format_numero(precio_ecommerce_efectivo) }}</td>
                    <td>{{ form.tiene_ecommerce ? 1 : 0 }}</td>
                    <td>${{ format_numero(desglose.ecommerce) }}</td>
                  </tr>
                  <tr :class="{ 'text-muted': !form.tiene_mercado_libre }">
                    <td>Mercado Libre</td>
                    <td>${{ format_numero(precio_mercado_libre_efectivo) }}</td>
                    <td>{{ form.tiene_mercado_libre ? 1 : 0 }}</td>
                    <td>${{ format_numero(desglose.mercado_libre) }}</td>
                  </tr>
                  <tr :class="{ 'text-muted': !form.tiene_tienda_nube }">
                    <td>Tienda Nube</td>
                    <td>${{ format_numero(precio_tienda_nube_efectivo) }}</td>
                    <td>{{ form.tiene_tienda_nube ? 1 : 0 }}</td>
                    <td>${{ format_numero(desglose.tienda_nube) }}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr class="table-primary fw-bold">
                    <td colspan="3">Total mensualidad (calculado localmente)</td>
                    <td>${{ format_numero(total_local) }}</td>
                  </tr>
                </tfoot>
              </table>
              <p class="text-muted small mb-0 mt-1">
                El total definitivo lo confirma el backend al guardar (puede diferir por redondeo).
              </p>
            </div>
          </div>

          <div class="d-flex justify-content-end mt-3">
            <button type="button" class="btn btn-primary btn-sm" :disabled="saving" @click="guardar">
              {{ saving ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Bloque 2: Facturación. Independiente del guardado de arriba. -->
      <!-- Los datos fiscales viven en el mismo form y se persisten con -->
      <!-- el botón Guardar del bloque 1 (mismo PUT del backend).       -->
      <!-- ============================================================ -->
      <div class="card">
        <div class="card-header bg-white">
          <strong>Facturación</strong>
        </div>
        <div class="card-body">
          <div class="row g-3">
            <!-- Datos fiscales del receptor -->
            <div class="col-md-6">
              <label class="form-label small mb-1 fw-semibold">CUIT del cliente</label>
              <input v-model="form.afip_cuit" type="text" class="form-control" placeholder="20-12345678-9" />
            </div>
            <div class="col-md-6">
              <label class="form-label small mb-1 fw-semibold">Razón social</label>
              <input v-model="form.afip_razon_social" type="text" class="form-control" />
            </div>
            <div class="col-md-6">
              <label class="form-label small mb-1 fw-semibold">Condición IVA</label>
              <select v-model="form.afip_condicion_iva" class="form-select">
                <option value="">Sin definir</option>
                <option value="Monotributista">Monotributista</option>
                <option value="Responsable inscripto">Responsable inscripto</option>
                <option value="Consumidor final">Consumidor final</option>
                <option value="Exento">Exento</option>
              </select>
            </div>
            <div class="col-md-6">
              <label class="form-label small mb-1 fw-semibold">Domicilio</label>
              <input v-model="form.afip_domicilio" type="text" class="form-control" />
            </div>
          </div>

          <hr class="my-3" />

          <!-- Total a facturar: siempre el confirmado por el backend, no el local -->
          <p class="mb-2">
            Total a facturar: <strong>${{ format_numero(record_total_mensualidad) }}</strong>
          </p>

          <!-- Resultado de la última emisión intentada en esta sesión -->
          <div v-if="factura_result" class="mb-3">
            <div v-if="factura_result.ok" class="alert alert-success py-2 small mb-0">
              <span v-if="factura_result.ya_facturado">Este período ya estaba facturado.</span>
              <span v-else>Factura emitida correctamente.</span>
              CAE: <strong>{{ factura_result.cae }}</strong> — Comprobante N°
              <strong>{{ factura_result.cbte_numero }}</strong>
              <div class="mt-2">
                <button
                  type="button"
                  class="btn btn-outline-success btn-sm"
                  :disabled="descargando_pdf"
                  @click="descargar_pdf"
                >
                  {{ descargando_pdf ? 'Descargando...' : 'Descargar PDF' }}
                </button>
              </div>
            </div>
            <div v-else class="alert alert-danger py-2 small mb-0">
              {{ factura_result.error_message || 'No se pudo emitir la factura.' }}
            </div>
          </div>

          <button
            type="button"
            class="btn btn-warning btn-sm"
            :disabled="emitiendo_factura"
            @click="emitir_factura"
          >
            {{ emitiendo_factura ? 'Emitiendo...' : 'Emitir factura' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import api from '@/utils/axios'

/**
 * Pestaña "Mensualidad" del detalle del cliente (admin-spa).
 *
 * Dos bloques independientes (a pedido de Lucas, sin unir sus acciones):
 *  1. Mensualidad: formulario con desglose reactivo calculado en el front,
 *     que se guarda vía PUT admin/client/{id}/mensualidad (el total final
 *     lo confirma siempre el backend, en `ClientMensualidadService`).
 *  2. Facturación: emite la Factura C vía POST admin/client/{id}/emitir-factura
 *     (AfipFacturacionService) y permite descargar el PDF ya autorizado.
 *
 * Es autónoma: no llama a la empresa-api del cliente (esa sincronización
 * opcional de conteos vivos vive aparte, prompt 335).
 */
export default {
  name: 'ClientMensualidadTab',
  props: {
    /** Cliente actualmente abierto en el modal de detalle de ResourceView. */
    record: { type: Object, default: null },
  },
  data() {
    return {
      // true mientras se carga el snapshot inicial de mensualidad.
      loading: false,
      // Mensaje de error si falla la carga inicial (null = sin error).
      load_error: null,
      // true mientras se guarda el formulario (PUT mensualidad).
      saving: false,
      // true mientras se emite la factura (POST emitir-factura).
      emitiendo_factura: false,
      // true mientras se descarga el PDF de la factura ya autorizada.
      descargando_pdf: false,
      // Total de mensualidad confirmado por el backend (el que se factura realmente).
      record_total_mensualidad: 0,
      // Resultado de la última emisión de factura intentada en esta sesión del modal.
      factura_result: null,
      /**
       * Inputs de mensualidad + datos fiscales del receptor, precargados desde
       * el backend al montar. Se editan a mano (sin datos vivos del cliente).
       */
      form: {
        payment_expired_at: '',
        precio_plan: 0,
        precio_por_cuenta: 0,
        cantidad_empleados: 0,
        tiene_ecommerce: false,
        tiene_mercado_libre: false,
        tiene_tienda_nube: false,
        precio_ecommerce: null,
        precio_mercado_libre: null,
        precio_tienda_nube: null,
        afip_cuit: '',
        afip_razon_social: '',
        afip_condicion_iva: '',
        afip_domicilio: '',
      },
    }
  },
  computed: {
    /**
     * Precio efectivo de Ecommerce: el individual si está cargado, sino
     * precio_por_cuenta como fallback (misma regla que empresa-api).
     * @returns {number}
     */
    precio_ecommerce_efectivo() {
      return this.form.precio_ecommerce !== null && this.form.precio_ecommerce !== ''
        ? Number(this.form.precio_ecommerce)
        : Number(this.form.precio_por_cuenta || 0)
    },
    /**
     * Precio efectivo de Mercado Libre: idem Ecommerce.
     * @returns {number}
     */
    precio_mercado_libre_efectivo() {
      return this.form.precio_mercado_libre !== null && this.form.precio_mercado_libre !== ''
        ? Number(this.form.precio_mercado_libre)
        : Number(this.form.precio_por_cuenta || 0)
    },
    /**
     * Precio efectivo de Tienda Nube: idem Ecommerce.
     * @returns {number}
     */
    precio_tienda_nube_efectivo() {
      return this.form.precio_tienda_nube !== null && this.form.precio_tienda_nube !== ''
        ? Number(this.form.precio_tienda_nube)
        : Number(this.form.precio_por_cuenta || 0)
    },
    /**
     * Desglose reactivo local (previsualización), con la misma fórmula que
     * `ClientMensualidadService::calcular_total` de admin-api: plan fijo +
     * empleados por precio_por_cuenta + un cargo por cada módulo activo.
     * @returns {{plan: number, empleados: number, ecommerce: number, mercado_libre: number, tienda_nube: number}}
     */
    desglose() {
      const precio_plan = Number(this.form.precio_plan || 0)
      const precio_por_cuenta = Number(this.form.precio_por_cuenta || 0)
      const cantidad_empleados = Number(this.form.cantidad_empleados || 0)
      return {
        plan: precio_plan,
        empleados: precio_por_cuenta * cantidad_empleados,
        ecommerce: this.form.tiene_ecommerce ? this.precio_ecommerce_efectivo : 0,
        mercado_libre: this.form.tiene_mercado_libre ? this.precio_mercado_libre_efectivo : 0,
        tienda_nube: this.form.tiene_tienda_nube ? this.precio_tienda_nube_efectivo : 0,
      }
    },
    /**
     * Total calculado localmente en vivo (previsualización, no reemplaza al
     * total confirmado por el backend tras guardar).
     * @returns {number}
     */
    total_local() {
      const d = this.desglose
      return d.plan + d.empleados + d.ecommerce + d.mercado_libre + d.tienda_nube
    },
  },
  watch: {
    /** Si cambia el cliente abierto en el modal, recarga el snapshot. */
    'record.id': function (new_id, old_id) {
      if (new_id && new_id !== old_id) {
        this.cargar_mensualidad()
      }
    },
  },
  mounted() {
    this.cargar_mensualidad()
  },
  methods: {
    /**
     * Formatea un número para mostrarlo con separador de miles y sin decimales,
     * igual criterio visual que la Blade de referencia de empresa-api.
     * @param {number|string|null} valor
     * @returns {string}
     */
    format_numero(valor) {
      const numero = Number(valor || 0)
      return numero.toLocaleString('es-AR', { maximumFractionDigits: 0 })
    },
    /**
     * Carga el snapshot de mensualidad del cliente (GET admin/client/{id}/mensualidad)
     * y precarga el formulario.
     * @returns {void}
     */
    cargar_mensualidad() {
      const self = this
      if (!this.record || !this.record.id) {
        return
      }
      self.loading = true
      self.load_error = null
      api
        .get('/client/' + this.record.id + '/mensualidad')
        .then(function (res) {
          self.aplicar_snapshot(res.data || {})
          self.loading = false
        })
        .catch(function () {
          self.load_error = 'No se pudo cargar la mensualidad de este cliente.'
          self.loading = false
        })
    },
    /**
     * Vuelca un snapshot recibido del backend (GET o PUT mensualidad) al formulario.
     * @param {Object} snapshot
     * @returns {void}
     */
    aplicar_snapshot(snapshot) {
      this.form = {
        /* La fecha viene en formato ISO (con hora); nos quedamos solo con la parte de fecha para el input type=date */
        payment_expired_at: snapshot.payment_expired_at ? String(snapshot.payment_expired_at).slice(0, 10) : '',
        precio_plan: Number(snapshot.precio_plan || 0),
        precio_por_cuenta: Number(snapshot.precio_por_cuenta || 0),
        cantidad_empleados: Number(snapshot.cantidad_empleados || 0),
        tiene_ecommerce: !!snapshot.tiene_ecommerce,
        tiene_mercado_libre: !!snapshot.tiene_mercado_libre,
        tiene_tienda_nube: !!snapshot.tiene_tienda_nube,
        precio_ecommerce: snapshot.precio_ecommerce !== null && snapshot.precio_ecommerce !== undefined ? Number(snapshot.precio_ecommerce) : null,
        precio_mercado_libre: snapshot.precio_mercado_libre !== null && snapshot.precio_mercado_libre !== undefined ? Number(snapshot.precio_mercado_libre) : null,
        precio_tienda_nube: snapshot.precio_tienda_nube !== null && snapshot.precio_tienda_nube !== undefined ? Number(snapshot.precio_tienda_nube) : null,
        afip_cuit: snapshot.afip_cuit || '',
        afip_razon_social: snapshot.afip_razon_social || '',
        afip_condicion_iva: snapshot.afip_condicion_iva || '',
        afip_domicilio: snapshot.afip_domicilio || '',
      }
      this.record_total_mensualidad = Number(snapshot.total_mensualidad || 0)
    },
    /**
     * Suma o resta un mes a `form.payment_expired_at`, cuidando el overflow
     * de fin de mes (ej: 31 de enero - 1 mes → último día de diciembre).
     * @param {number} delta Cantidad de meses a sumar (negativo para restar).
     * @returns {void}
     */
    ajustar_mes(delta) {
      // Fecha base: la cargada en el form, o la fecha actual si está vacía.
      const partes = this.form.payment_expired_at ? this.form.payment_expired_at.split('-').map(Number) : null
      const base = partes && partes.length === 3 ? new Date(partes[0], partes[1] - 1, partes[2]) : new Date()

      const dia_original = base.getDate()
      base.setMonth(base.getMonth() + delta)
      // Si el día cambió por overflow (ej. 31 -> 3), retrocede al último día del mes destino.
      if (base.getDate() !== dia_original) {
        base.setDate(0)
      }

      const yyyy = base.getFullYear()
      const mm = String(base.getMonth() + 1).padStart(2, '0')
      const dd = String(base.getDate()).padStart(2, '0')
      this.form.payment_expired_at = yyyy + '-' + mm + '-' + dd
    },
    /**
     * Guarda los inputs de mensualidad + fecha + datos fiscales
     * (PUT admin/client/{id}/mensualidad). El total definitivo lo confirma
     * siempre el backend (ClientMensualidadService::calcular_total).
     * @returns {void}
     */
    guardar() {
      const self = this
      if (!this.record || !this.record.id) {
        return
      }
      self.saving = true
      api
        .put('/client/' + this.record.id + '/mensualidad', self.form)
        .then(function (res) {
          self.aplicar_snapshot(res.data || {})
          self.saving = false
          window.dispatchEvent(new CustomEvent('admin-spa-toast', {
            detail: {
              message: 'Mensualidad guardada. Total confirmado: $' + self.format_numero(self.record_total_mensualidad),
              variant: 'success',
            },
          }))
        })
        .catch(function () {
          self.saving = false
          window.dispatchEvent(new CustomEvent('admin-spa-toast', {
            detail: { message: 'No se pudo guardar la mensualidad.', variant: 'danger' },
          }))
        })
    },
    /**
     * Emite la Factura C de la mensualidad del cliente (POST emitir-factura),
     * previa alerta de confirmación porque genera un comprobante fiscal real
     * e irreversible. No toca la fecha de pago.
     * @returns {void}
     */
    emitir_factura() {
      const self = this
      if (!this.record || !this.record.id) {
        return
      }

      const confirmado = window.confirm(
        '¿Emitir la factura de la mensualidad de ' +
          (this.record.company_name || this.record.name || 'este cliente') +
          ' por $' +
          this.format_numero(this.record_total_mensualidad) +
          '? Genera un comprobante fiscal real e irreversible.'
      )
      if (!confirmado) {
        return
      }

      self.emitiendo_factura = true
      self.factura_result = null
      api
        .post('/client/' + this.record.id + '/emitir-factura')
        .then(function (res) {
          self.factura_result = res.data || null
          self.emitiendo_factura = false
          if (self.factura_result && self.factura_result.ok) {
            window.dispatchEvent(new CustomEvent('admin-spa-toast', {
              detail: {
                message: self.factura_result.ya_facturado
                  ? 'Este período ya estaba facturado.'
                  : 'Factura emitida correctamente (CAE ' + self.factura_result.cae + ').',
                variant: 'success',
              },
            }))
          } else {
            window.dispatchEvent(new CustomEvent('admin-spa-toast', {
              detail: {
                message: (self.factura_result && self.factura_result.error_message) || 'No se pudo emitir la factura.',
                variant: 'danger',
              },
            }))
          }
        })
        .catch(function (error) {
          self.emitiendo_factura = false
          const mensaje =
            error && error.response && error.response.data && error.response.data.error_message
              ? error.response.data.error_message
              : 'No se pudo emitir la factura.'
          self.factura_result = { ok: false, error_message: mensaje }
        })
    },
    /**
     * Descarga el PDF de la última factura emitida (GET .../factura/{invoiceId}/pdf),
     * siguiendo el mismo patrón de blob que `lead/contract/Index.vue`.
     * @returns {void}
     */
    descargar_pdf() {
      const self = this
      if (!this.record || !this.record.id || !this.factura_result || !this.factura_result.invoice_id) {
        return
      }
      self.descargando_pdf = true
      api
        .get('/client/' + this.record.id + '/factura/' + this.factura_result.invoice_id + '/pdf', {
          responseType: 'blob',
        })
        .then(function (response) {
          const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
          const link = document.createElement('a')
          link.href = url
          link.setAttribute('download', 'factura_mensualidad_' + self.record.id + '.pdf')
          document.body.appendChild(link)
          link.click()
          link.remove()
          window.URL.revokeObjectURL(url)
        })
        .catch(function () {
          window.dispatchEvent(new CustomEvent('admin-spa-toast', {
            detail: { message: 'No se pudo descargar el PDF de la factura.', variant: 'danger' },
          }))
        })
        .then(function () {
          self.descargando_pdf = false
        })
    },
  },
}
</script>
