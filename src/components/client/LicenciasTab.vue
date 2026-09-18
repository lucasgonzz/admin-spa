<template>
  <div class="p-3 licencias-tab">
    <!-- Sin cliente guardado todavía: no hay id al que pedirle las cuotas -->
    <p v-if="!record || !record.id" class="text-muted small fst-italic mb-0">
      Guardá el cliente primero para gestionar sus licencias.
    </p>

    <div v-else-if="loading" class="text-center py-4">
      <span class="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true" />
      <p class="text-muted small mt-2 mb-0">Cargando licencias...</p>
    </div>

    <div v-else-if="load_error" class="alert alert-danger py-2 small mb-0">
      {{ load_error }}
    </div>

    <template v-else>
      <!-- ============================================================ -->
      <!-- Encabezado: lo que dice el contrato y el resumen de las      -->
      <!-- cuotas. El contrato es la referencia; las cuotas, la realidad.-->
      <!-- ============================================================ -->
      <div class="row g-3 mb-3">
        <div class="col-12 col-lg-5">
          <div class="card h-100 border-0 licencias-panel">
            <div class="card-body">
              <p class="licencias-panel__titulo mb-2">Según contrato</p>
              <template v-if="contrato_tiene_licencia">
                <p class="licencias-cifra mb-1">{{ precio_licencia_visible }}</p>
                <p class="text-muted small mb-0">
                  <span v-if="contrato.financiacion && contrato.financiacion.length">
                    {{ contrato.financiacion.length }} {{ contrato.financiacion.length === 1 ? 'cuota' : 'cuotas' }} de financiación
                  </span>
                  <span v-else-if="contrato.fecha_primer_pago_unico">
                    Pago único · primer pago {{ formatear_fecha(contrato.fecha_primer_pago_unico) }}
                  </span>
                  <span v-else>Pago único</span>
                </p>
              </template>
              <p v-else class="text-muted small mb-0">
                El contrato no tiene precio de licencia cargado. Las cuotas se agregan a mano.
              </p>
            </div>
          </div>
        </div>

        <div class="col-12 col-lg-7">
          <div class="card h-100 border-0 licencias-panel">
            <div class="card-body">
              <p class="licencias-panel__titulo mb-2">Cuotas</p>
              <div class="row g-2">
                <div class="col-4">
                  <div class="text-muted small">Total</div>
                  <div class="fw-semibold">{{ format_por_moneda(resumen.total_por_moneda) }}</div>
                </div>
                <div class="col-4">
                  <div class="text-muted small">Pagado</div>
                  <div class="fw-semibold text-success">{{ format_por_moneda(resumen.pagado_por_moneda) }}</div>
                </div>
                <div class="col-4">
                  <div class="text-muted small">Pendiente</div>
                  <div class="fw-semibold" :class="hay_pendiente ? 'text-danger' : ''">{{ format_por_moneda(resumen.pendiente_por_moneda) }}</div>
                </div>
              </div>
              <p class="text-muted small mb-0 mt-2">
                {{ resumen.cantidad || 0 }} {{ (resumen.cantidad || 0) === 1 ? 'cuota' : 'cuotas' }}
                · {{ resumen.pendientes || 0 }} pendientes
                · {{ resumen.parciales || 0 }} parciales
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Tabla de cuotas. Los formularios (pago, edición) se abren    -->
      <!-- como una fila extra debajo de la cuota: en teléfono un       -->
      <!-- formulario adentro de una celda no entra, y un modal encima  -->
      <!-- de un modal ya es demasiado para tres campos.                -->
      <!-- ============================================================ -->
      <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
        <strong class="small">Detalle de cuotas</strong>
        <div class="ms-auto d-flex flex-wrap gap-2">
          <button
            v-if="cuotas.length === 0 && contrato_tiene_licencia"
            type="button"
            class="btn btn-outline-primary btn-sm"
            :disabled="generando"
            @click="generar_desde_contrato"
          >
            {{ generando ? 'Generando...' : 'Generar cuotas desde el contrato' }}
          </button>
          <button
            type="button"
            class="btn btn-outline-primary btn-sm"
            @click="alternar_nueva"
          >
            {{ nueva.show ? 'Cancelar' : 'Agregar cuota' }}
          </button>
        </div>
      </div>

      <!-- Alta de cuota, inline -->
      <div v-if="nueva.show" class="bg-light rounded p-3 mb-3">
        <div class="row g-2">
          <div class="col-6 col-md-2">
            <label class="form-label small mb-1">Moneda</label>
            <select v-model="nueva.form.moneda" class="form-select form-select-sm">
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </select>
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label small mb-1">Monto</label>
            <input v-model="nueva.form.monto" type="number" min="0" step="1" class="form-control form-control-sm" />
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label small mb-1">Vencimiento</label>
            <input v-model="nueva.form.vencimiento" type="date" class="form-control form-control-sm" />
          </div>
          <div class="col-6 col-md-4">
            <label class="form-label small mb-1">Observación</label>
            <input v-model="nueva.form.observacion" type="text" class="form-control form-control-sm" placeholder="Opcional" />
          </div>
        </div>
        <div class="d-flex justify-content-end mt-2">
          <button
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="guardando_nueva || nueva.form.monto === '' || nueva.form.monto === null"
            @click="agregar_cuota"
          >
            {{ guardando_nueva ? 'Guardando...' : 'Guardar cuota' }}
          </button>
        </div>
      </div>

      <p v-if="cuotas.length === 0" class="text-muted small mb-0">
        Este cliente no tiene cuotas de licencia cargadas.
      </p>

      <div v-else class="table-responsive">
        <table class="table table-sm table-bordered small mb-0 align-middle">
          <thead>
            <tr class="table-light">
              <th>N°</th>
              <th>Mes</th>
              <th>Vence</th>
              <th class="text-end">Monto</th>
              <th class="text-end">Pagado</th>
              <th>Estado</th>
              <th>Observación</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="cuota in cuotas" :key="cuota.id">
              <tr :class="clase_fila(cuota)">
                <td>{{ cuota.numero }}</td>
                <td class="text-nowrap">{{ etiqueta_corta(cuota.periodo) }}</td>
                <td class="text-nowrap">{{ cuota.vencimiento ? formatear_fecha(cuota.vencimiento) : '—' }}</td>
                <td class="text-end text-nowrap">{{ format_monto_con_moneda(cuota.monto, cuota.moneda) }}</td>
                <td class="text-end text-nowrap">
                  <template v-if="Number(cuota.monto_pagado || 0) > 0">
                    {{ format_monto_con_moneda(cuota.monto_pagado, cuota.moneda) }}
                    <div v-if="cuota.fecha_pago" class="text-muted">{{ formatear_fecha(cuota.fecha_pago) }}</div>
                  </template>
                  <span v-else class="text-muted">—</span>
                </td>
                <td>
                  <span class="badge licencias-badge" :class="clase_badge(cuota)">{{ texto_badge(cuota) }}</span>
                  <div v-if="cuota.estado === 'pendiente' && esta_vencida(cuota)" class="text-danger small">vencida</div>
                  <span v-if="cuota.importado" class="badge text-bg-light text-muted border ms-1" title="Importada de la planilla">Imp.</span>
                </td>
                <td class="small">{{ cuota.observacion || '' }}</td>
                <td class="text-end text-nowrap">
                  <button
                    v-if="cuota.estado !== 'pagada'"
                    type="button"
                    class="btn btn-outline-primary btn-sm py-0"
                    title="Registrar un pago de esta cuota"
                    :disabled="en_curso_id === cuota.id"
                    @click="alternar_pago(cuota)"
                  >
                    <i class="bi bi-cash-coin"></i>
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline-secondary btn-sm py-0 ms-1"
                    title="Editar la cuota"
                    :disabled="en_curso_id === cuota.id"
                    @click="alternar_edicion(cuota)"
                  >
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline-danger btn-sm py-0 ms-1"
                    title="Eliminar la cuota"
                    :disabled="en_curso_id === cuota.id"
                    @click="eliminar(cuota)"
                  >
                    <i class="bi bi-trash"></i>
                  </button>
                </td>
              </tr>

              <!-- Registrar pago, inline -->
              <tr v-if="pago.id === cuota.id">
                <td colspan="8" class="bg-light">
                  <div class="row g-2 align-items-end">
                    <div class="col-6 col-md-3">
                      <label class="form-label small mb-1">Monto pagado ({{ cuota.moneda }})</label>
                      <input v-model="pago.form.monto_pagado" type="number" min="0" step="1" class="form-control form-control-sm" />
                    </div>
                    <div class="col-6 col-md-3">
                      <label class="form-label small mb-1">Fecha de pago</label>
                      <input v-model="pago.form.fecha_pago" type="date" class="form-control form-control-sm" />
                    </div>
                    <div class="col-12 col-md-4">
                      <label class="form-label small mb-1">Observación</label>
                      <input v-model="pago.form.observacion" type="text" class="form-control form-control-sm" placeholder="Opcional" />
                    </div>
                    <div class="col-12 col-md-2">
                      <div class="form-check">
                        <input :id="'cuota-completa-' + cuota.id" v-model="pago.form.completa" class="form-check-input" type="checkbox" />
                        <label class="form-check-label small" :for="'cuota-completa-' + cuota.id">Cuota completa</label>
                      </div>
                    </div>
                  </div>
                  <p v-if="faltante_con_pago(cuota) > 0 && !pago.form.completa" class="text-muted small mb-0 mt-1">
                    Quedarían pendientes {{ format_monto_con_moneda(faltante_con_pago(cuota), cuota.moneda) }}.
                  </p>
                  <div class="d-flex justify-content-end gap-2 mt-2">
                    <button type="button" class="btn btn-secondary btn-sm" @click="pago.id = null">Cancelar</button>
                    <button
                      type="button"
                      class="btn btn-primary btn-sm"
                      :disabled="en_curso_id === cuota.id || pago.form.monto_pagado === '' || pago.form.monto_pagado === null"
                      @click="registrar_pago(cuota)"
                    >
                      {{ en_curso_id === cuota.id ? 'Guardando...' : 'Registrar pago' }}
                    </button>
                  </div>
                </td>
              </tr>

              <!-- Edición, inline -->
              <tr v-if="edicion.id === cuota.id">
                <td colspan="8" class="bg-light">
                  <div class="row g-2">
                    <div class="col-6 col-md-2">
                      <label class="form-label small mb-1">Moneda</label>
                      <select v-model="edicion.form.moneda" class="form-select form-select-sm">
                        <option value="USD">USD</option>
                        <option value="ARS">ARS</option>
                      </select>
                    </div>
                    <div class="col-6 col-md-2">
                      <label class="form-label small mb-1">Monto</label>
                      <input v-model="edicion.form.monto" type="number" min="0" step="1" class="form-control form-control-sm" />
                    </div>
                    <div class="col-6 col-md-2">
                      <label class="form-label small mb-1">Mes</label>
                      <input v-model="edicion.form.periodo" type="month" class="form-control form-control-sm" />
                    </div>
                    <div class="col-6 col-md-2">
                      <label class="form-label small mb-1">Vencimiento</label>
                      <input v-model="edicion.form.vencimiento" type="date" class="form-control form-control-sm" />
                    </div>
                    <div class="col-6 col-md-2">
                      <label class="form-label small mb-1">Estado</label>
                      <select v-model="edicion.form.estado" class="form-select form-select-sm">
                        <option value="pendiente">Pendiente</option>
                        <option value="parcial">Parcial</option>
                        <option value="pagada">Pagada</option>
                      </select>
                    </div>
                    <div class="col-12 col-md-2">
                      <label class="form-label small mb-1">Observación</label>
                      <input v-model="edicion.form.observacion" type="text" class="form-control form-control-sm" />
                    </div>
                  </div>
                  <div class="d-flex justify-content-end gap-2 mt-2">
                    <button type="button" class="btn btn-secondary btn-sm" @click="edicion.id = null">Cancelar</button>
                    <button
                      type="button"
                      class="btn btn-primary btn-sm"
                      :disabled="en_curso_id === cuota.id"
                      @click="guardar_edicion(cuota)"
                    >
                      {{ en_curso_id === cuota.id ? 'Guardando...' : 'Guardar cambios' }}
                    </button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import { etiqueta_corta, formatear_fecha, hoy_iso, mes_corriente, partes_de_periodo } from '@/components/cobranzas/meses'
import { format_monto_con_moneda, format_por_moneda, format_numero } from '@/components/cobranzas/plata'

/**
 * Pestaña "Licencias" del cliente (misión modulo-cobranzas, 18/9/2026).
 *
 * Las cuotas de la licencia (el pago único del contrato, financiado o no), con sus pagos
 * parciales: el caso real es Únicas, que pagó $436.000 de USD 600 y le restan $500.000. Cada
 * cuota tiene monto, moneda, mes, vencimiento y estado (pendiente / parcial / pagada); el estado
 * lo recalcula el backend con cada pago (`LicenciaCuotaService`).
 *
 * Lee `GET client/{id}/licencias`, que además del listado trae el resumen por moneda y lo que
 * dice el contrato del cliente (precio de licencia, moneda, financiación), para poder generar
 * las cuotas desde ahí cuando el cliente todavía no tiene ninguna.
 *
 * Igual que la pestaña Mensualidad, del `record` solo usa `id`, `name` y `company_name`: la
 * abren tanto el modal genérico de Clientes como el modal chico del módulo Cobranzas.
 */
export default {
  name: 'ClientLicenciasTab',
  props: {
    /** Cliente abierto en el modal. */
    record: { type: Object, default: null },
  },
  data() {
    return {
      // true mientras se carga el listado inicial.
      loading: false,
      // Mensaje de error de la carga inicial (null = sin error).
      load_error: null,
      // Cuotas del cliente, ordenadas por número desde el backend.
      cuotas: [],
      // Resumen `{cantidad, total_por_moneda, pagado_por_moneda, pendiente_por_moneda, pendientes, parciales}`.
      resumen: {},
      // Lo que dice el contrato: `{precio_licencia, currency, financiacion, fecha_primer_pago_unico}`.
      contrato: {},
      // Mes corriente, para marcar vencidas las pendientes de meses pasados.
      mes_corriente_actual: mes_corriente(),
      // id de la cuota sobre la que corre un request (null = ninguna), para deshabilitar solo esa fila.
      en_curso_id: null,
      // true mientras corre el POST de alta.
      guardando_nueva: false,
      // true mientras corre el POST desde-contrato.
      generando: false,
      // Alta de cuota inline.
      nueva: { show: false, form: this.form_nueva_vacio() },
      // Pago inline: `id` de la cuota abierta (null = ninguna) y su formulario.
      pago: { id: null, form: { monto_pagado: '', fecha_pago: '', observacion: '', completa: false } },
      // Edición inline: `id` de la cuota abierta (null = ninguna) y su formulario.
      edicion: { id: null, form: { monto: '', moneda: 'USD', periodo: '', vencimiento: '', observacion: '', estado: 'pendiente' } },
    }
  },
  computed: {
    /**
     * true si el contrato tiene un precio de licencia o una financiación de donde sacar cuotas.
     * @returns {boolean}
     */
    contrato_tiene_licencia() {
      const c = this.contrato || {}
      const tiene_financiacion = Array.isArray(c.financiacion) && c.financiacion.length > 0
      const precio = c.precio_licencia
      const tiene_precio = precio !== null && precio !== undefined && String(precio).trim() !== '' && String(precio).trim() !== '0'
      return tiene_financiacion || tiene_precio
    },
    /**
     * Precio de licencia del contrato, con la moneda adelante. En el lead es un campo de texto
     * libre ("1.200", "1200"...), así que si no se puede leer como número se muestra tal cual.
     * @returns {string}
     */
    precio_licencia_visible() {
      const c = this.contrato || {}
      const crudo = String(c.precio_licencia === null || c.precio_licencia === undefined ? '' : c.precio_licencia).trim()
      const moneda = c.currency || 'USD'
      if (crudo === '') {
        return '—'
      }
      /* Se saca el separador de miles y se convierte la coma decimal antes de probar como número. */
      const numero = Number(crudo.replace(/\./g, '').replace(',', '.'))
      if (isNaN(numero)) {
        return moneda + ' ' + crudo
      }
      return format_monto_con_moneda(numero, moneda)
    },
    /**
     * true si queda algo pendiente en alguna moneda.
     * @returns {boolean}
     */
    hay_pendiente() {
      const pendiente = (this.resumen && this.resumen.pendiente_por_moneda) || {}
      return Object.keys(pendiente).some(function (moneda) {
        return Number(pendiente[moneda] || 0) > 0
      })
    },
  },
  watch: {
    /** Si cambia el cliente abierto, se recarga todo desde cero. */
    'record.id': function (new_id, old_id) {
      if (new_id && new_id !== old_id) {
        this.pago.id = null
        this.edicion.id = null
        this.nueva.show = false
        this.cargar()
      }
    },
  },
  mounted() {
    this.cargar()
  },
  methods: {
    etiqueta_corta,
    formatear_fecha,
    format_monto_con_moneda,
    format_por_moneda,
    format_numero,
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
     * Formulario vacío del alta: USD porque es la moneda de casi todas las licencias, y el
     * vencimiento en blanco para que el backend derive el mes del vencimiento o use el corriente.
     * @returns {Object}
     */
    form_nueva_vacio() {
      return { monto: '', moneda: 'USD', vencimiento: '', observacion: '' }
    },
    /**
     * Carga cuotas, resumen y datos del contrato (GET client/{id}/licencias).
     */
    cargar() {
      const self = this
      if (!this.record || !this.record.id) {
        return
      }
      const client_id = this.record.id
      self.loading = true
      self.load_error = null
      api
        .get('/client/' + client_id + '/licencias', { silent_error: true })
        .then(function (res) {
          self.loading = false
          if (!self.record || self.record.id !== client_id) {
            return
          }
          const data = res.data || {}
          self.aplicar_respuesta(data)
          self.contrato = data.contrato || {}
        })
        .catch(function (error) {
          self.loading = false
          self.load_error = resolve_error_message(error)
        })
    },
    /**
     * Vuelca `{cuotas, resumen}` de cualquier respuesta de las rutas de licencias.
     * @param {Object} data
     */
    aplicar_respuesta(data) {
      if (Array.isArray(data.cuotas)) {
        this.cuotas = data.cuotas
      }
      if (data.resumen) {
        this.resumen = data.resumen
      }
    },
    /**
     * true si la cuota es de un mes anterior al corriente.
     * @param {Object} cuota
     * @returns {boolean}
     */
    esta_vencida(cuota) {
      return !!(cuota && cuota.periodo && String(cuota.periodo).slice(0, 7) < this.mes_corriente_actual)
    },
    /**
     * Lo que le falta a una cuota: monto menos pagado, nunca negativo.
     * @param {Object} cuota
     * @returns {number}
     */
    faltante(cuota) {
      const diferencia = Number(cuota.monto || 0) - Number(cuota.monto_pagado || 0)
      return diferencia > 0 ? diferencia : 0
    },
    /**
     * Lo que le faltaría a la cuota después del pago que se está tipeando.
     * @param {Object} cuota
     * @returns {number}
     */
    faltante_con_pago(cuota) {
      const diferencia = this.faltante(cuota) - Number(this.pago.form.monto_pagado || 0)
      return diferencia > 0 ? diferencia : 0
    },
    /**
     * Color de la fila: rojo si está pendiente y vencida, amarillo si es parcial, verde si está
     * pagada, nada si es pendiente pero todavía no venció (no hay nada que reclamar).
     * @param {Object} cuota
     * @returns {string}
     */
    clase_fila(cuota) {
      if (cuota.estado === 'pagada') {
        return 'table-success'
      }
      if (cuota.estado === 'parcial') {
        return 'table-warning'
      }
      if (cuota.estado === 'pendiente' && this.esta_vencida(cuota)) {
        return 'table-danger'
      }
      return ''
    },
    /**
     * Clases del badge de estado, con los mismos colores que la mensualidad.
     * @param {Object} cuota
     * @returns {string}
     */
    clase_badge(cuota) {
      if (cuota.estado === 'pagada') {
        return 'text-bg-success'
      }
      if (cuota.estado === 'parcial') {
        return 'text-bg-warning border border-danger'
      }
      return 'text-bg-danger'
    },
    /**
     * Texto del badge de estado.
     * @param {Object} cuota
     * @returns {string}
     */
    texto_badge(cuota) {
      if (cuota.estado === 'pagada') {
        return 'Pagada'
      }
      if (cuota.estado === 'parcial') {
        return 'Parcial · faltan ' + format_monto_con_moneda(this.faltante(cuota), cuota.moneda)
      }
      return 'Pendiente'
    },
    /**
     * Abre o cierra el alta inline; al abrir arranca limpio.
     */
    alternar_nueva() {
      if (this.nueva.show) {
        this.nueva.show = false
        return
      }
      this.nueva = { show: true, form: this.form_nueva_vacio() }
    },
    /**
     * POST client/{id}/licencias. El mes se deriva del vencimiento en el backend (o del mes
     * corriente si no hay vencimiento), por eso el alta no pide el mes aparte.
     */
    agregar_cuota() {
      const self = this
      if (!this.record || !this.record.id || this.guardando_nueva) {
        return
      }
      const f = this.nueva.form
      self.guardando_nueva = true
      api
        .post('/client/' + this.record.id + '/licencias', {
          monto: Number(f.monto || 0),
          moneda: f.moneda || 'USD',
          vencimiento: f.vencimiento || null,
          periodo: f.vencimiento ? String(f.vencimiento).slice(0, 7) : null,
          observacion: f.observacion || null,
        }, { silent_error: true })
        .then(function (res) {
          self.guardando_nueva = false
          self.nueva = { show: false, form: self.form_nueva_vacio() }
          self.aplicar_respuesta(res.data || {})
          self.avisar('Cuota agregada.')
        })
        .catch(function (error) {
          self.guardando_nueva = false
          self.avisar(resolve_error_message(error), 'danger')
        })
    },
    /**
     * Abre o cierra el formulario de pago de una cuota, prefijado con lo que falta y la fecha de
     * hoy. Cierra la edición si estaba abierta en otra fila: un formulario a la vez.
     * @param {Object} cuota
     */
    alternar_pago(cuota) {
      if (this.pago.id === cuota.id) {
        this.pago.id = null
        return
      }
      this.edicion.id = null
      this.pago = {
        id: cuota.id,
        form: {
          monto_pagado: this.faltante(cuota) > 0 ? this.faltante(cuota) : '',
          fecha_pago: hoy_iso(),
          observacion: '',
          completa: false,
        },
      }
    },
    /**
     * POST client/{id}/licencias/{cuotaId}/pago. El backend acumula el pago y recalcula el estado.
     * @param {Object} cuota
     */
    registrar_pago(cuota) {
      const self = this
      if (!this.record || !this.record.id || this.en_curso_id) {
        return
      }
      const f = this.pago.form
      self.en_curso_id = cuota.id
      api
        .post('/client/' + this.record.id + '/licencias/' + cuota.id + '/pago', {
          monto_pagado: Number(f.monto_pagado || 0),
          fecha_pago: f.fecha_pago || null,
          observacion: f.observacion || null,
          completa: !!f.completa,
        }, { silent_error: true })
        .then(function (res) {
          self.en_curso_id = null
          self.pago.id = null
          self.aplicar_respuesta(res.data || {})
          self.avisar('Pago registrado en la cuota ' + cuota.numero + '.')
        })
        .catch(function (error) {
          self.en_curso_id = null
          self.avisar(resolve_error_message(error), 'danger')
        })
    },
    /**
     * Abre o cierra la edición inline de una cuota, precargada con sus valores.
     * @param {Object} cuota
     */
    alternar_edicion(cuota) {
      if (this.edicion.id === cuota.id) {
        this.edicion.id = null
        return
      }
      this.pago.id = null
      this.edicion = {
        id: cuota.id,
        form: {
          monto: cuota.monto,
          moneda: cuota.moneda || 'USD',
          periodo: cuota.periodo ? String(cuota.periodo).slice(0, 7) : '',
          vencimiento: cuota.vencimiento ? String(cuota.vencimiento).slice(0, 10) : '',
          observacion: cuota.observacion || '',
          estado: cuota.estado || 'pendiente',
        },
      }
    },
    /**
     * PUT client/{id}/licencias/{cuotaId}.
     * @param {Object} cuota
     */
    guardar_edicion(cuota) {
      const self = this
      if (!this.record || !this.record.id || this.en_curso_id) {
        return
      }
      const f = this.edicion.form
      self.en_curso_id = cuota.id
      api
        .put('/client/' + this.record.id + '/licencias/' + cuota.id, {
          monto: Number(f.monto || 0),
          moneda: f.moneda || 'USD',
          vencimiento: f.vencimiento || null,
          periodo: partes_de_periodo(f.periodo) ? f.periodo : null,
          observacion: f.observacion || null,
          estado: f.estado || null,
        }, { silent_error: true })
        .then(function (res) {
          self.en_curso_id = null
          self.edicion.id = null
          self.aplicar_respuesta(res.data || {})
          self.avisar('Cuota ' + cuota.numero + ' guardada.')
        })
        .catch(function (error) {
          self.en_curso_id = null
          self.avisar(resolve_error_message(error), 'danger')
        })
    },
    /**
     * DELETE client/{id}/licencias/{cuotaId}, previa confirmación.
     * @param {Object} cuota
     */
    eliminar(cuota) {
      const self = this
      if (!this.record || !this.record.id || this.en_curso_id) {
        return
      }
      const confirmado = window.confirm(
        '¿Eliminar la cuota ' + cuota.numero + ' de ' + format_monto_con_moneda(cuota.monto, cuota.moneda) + '?'
      )
      if (!confirmado) {
        return
      }
      self.en_curso_id = cuota.id
      api
        .delete('/client/' + this.record.id + '/licencias/' + cuota.id, { silent_error: true })
        .then(function (res) {
          self.en_curso_id = null
          self.aplicar_respuesta(res.data || {})
          self.avisar('Cuota eliminada.')
        })
        .catch(function (error) {
          self.en_curso_id = null
          self.avisar(resolve_error_message(error), 'danger')
        })
    },
    /**
     * POST client/{id}/licencias/desde-contrato: una cuota por fila de financiación del contrato,
     * o una sola con el precio de licencia. El backend contesta 422 si ya hay cuotas.
     */
    generar_desde_contrato() {
      const self = this
      if (!this.record || !this.record.id || this.generando) {
        return
      }
      self.generando = true
      api
        .post('/client/' + this.record.id + '/licencias/desde-contrato', {}, { silent_error: true })
        .then(function (res) {
          const data = res.data || {}
          self.generando = false
          self.aplicar_respuesta(data)
          self.avisar('Se generaron ' + (data.creadas || 0) + ' cuotas desde el contrato.')
        })
        .catch(function (error) {
          self.generando = false
          self.avisar(resolve_error_message(error), 'danger')
        })
    },
  },
}
</script>

<style scoped>
/* Misma familia visual que la pestaña Tokens: paneles claros sin borde pesado. */
.licencias-panel {
  background: #f7f7f8;
  border-radius: 0.75rem;
}

.licencias-panel__titulo {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #6c757d;
  font-weight: 600;
}

.licencias-cifra {
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.licencias-badge {
  font-weight: 500;
  white-space: nowrap;
}
</style>
