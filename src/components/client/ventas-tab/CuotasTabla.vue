<template>
  <div class="cuotas-tabla">
    <p v-if="!cuotas.length" class="text-muted small mb-0">
      {{ texto_vacio }}
    </p>

    <!-- ============================================================ -->
    <!-- Tabla de cuotas. Los formularios (pago, edición) van DEBAJO  -->
    <!-- de la tabla y no adentro de una fila: en teléfono la tabla   -->
    <!-- scrollea a lo ancho y una fila-formulario quedaba con la     -->
    <!-- mitad de los campos fuera de vista (mismo criterio que la    -->
    <!-- pestaña Licencias de antes).                                 -->
    <!-- ============================================================ -->
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
          <tr
            v-for="cuota in cuotas"
            :key="cuota.id"
            :class="[clase_fila(cuota), { 'cuotas-tabla__fila--abierta': pago.id === cuota.id || edicion.id === cuota.id }]"
          >
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
              <span class="badge cuotas-tabla__badge" :class="clase_badge(cuota)">{{ texto_badge(cuota) }}</span>
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
        </tbody>
      </table>
    </div>

    <!-- Registrar pago de una cuota (parcial o completo) -->
    <div v-if="cuota_del_pago" class="bg-light rounded p-2 mt-2">
      <p class="small fw-semibold mb-2">Registrar pago · cuota {{ cuota_del_pago.numero }} ({{ etiqueta_corta(cuota_del_pago.periodo) }})</p>
      <div class="row g-2 align-items-end">
        <div class="col-6 col-md-3">
          <label class="form-label small mb-1">Monto pagado ({{ cuota_del_pago.moneda }})</label>
          <input v-model="pago.form.monto_pagado" type="number" min="0" step="0.01" class="form-control form-control-sm" />
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
            <input :id="'cuota-completa-' + cuota_del_pago.id" v-model="pago.form.completa" class="form-check-input" type="checkbox" />
            <label class="form-check-label small" :for="'cuota-completa-' + cuota_del_pago.id">Cuota completa</label>
          </div>
        </div>
      </div>
      <p v-if="faltante_con_pago(cuota_del_pago) > 0 && !pago.form.completa" class="text-muted small mb-0 mt-1">
        Quedarían pendientes {{ format_monto_con_moneda(faltante_con_pago(cuota_del_pago), cuota_del_pago.moneda) }}.
      </p>
      <div class="d-flex justify-content-end gap-2 mt-2">
        <button type="button" class="btn btn-secondary btn-sm" @click="pago.id = null">Cancelar</button>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          :disabled="en_curso_id === cuota_del_pago.id || pago.form.monto_pagado === '' || pago.form.monto_pagado === null"
          @click="registrar_pago(cuota_del_pago)"
        >
          {{ en_curso_id === cuota_del_pago.id ? 'Guardando...' : 'Registrar pago' }}
        </button>
      </div>
    </div>

    <!-- Editar una cuota -->
    <div v-if="cuota_en_edicion" class="bg-light rounded p-2 mt-2">
      <p class="small fw-semibold mb-2">Editar · cuota {{ cuota_en_edicion.numero }} ({{ etiqueta_corta(cuota_en_edicion.periodo) }})</p>
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
          <input v-model="edicion.form.monto" type="number" min="0" step="0.01" class="form-control form-control-sm" />
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
        <div class="col-6 col-md-2">
          <label class="form-label small mb-1">Observación</label>
          <input v-model="edicion.form.observacion" type="text" class="form-control form-control-sm" />
        </div>
      </div>
      <div class="d-flex justify-content-end gap-2 mt-2">
        <button type="button" class="btn btn-secondary btn-sm" @click="edicion.id = null">Cancelar</button>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          :disabled="en_curso_id === cuota_en_edicion.id"
          @click="guardar_edicion(cuota_en_edicion)"
        >
          {{ en_curso_id === cuota_en_edicion.id ? 'Guardando...' : 'Guardar cambios' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import { etiqueta_corta, formatear_fecha, hoy_iso, mes_corriente, partes_de_periodo } from '@/components/cobranzas/meses'
import { format_monto_con_moneda } from '@/components/cobranzas/plata'

/**
 * Tabla de cuotas de la pestaña Ventas del cliente (misión ventas-y-comisiones, 28/10/2026).
 *
 * Es la tabla de cuotas que tenía la pestaña Licencias, sacada a un componente propio porque
 * ahora aparece varias veces en la misma pestaña: una por cada venta (sus cuotas) y una más para
 * las cuotas viejas que todavía no quedaron agrupadas en ninguna venta.
 *
 * La gestión de cada cuota es la de siempre y sigue yendo por las rutas de licencias, que no
 * cambiaron (`client/{id}/licencias/{cuotaId}`, `.../pago`): pago parcial o completo, edición y
 * baja. Lo que esas rutas devuelven es la lista de cuotas suelta, que acá no alcanza (el
 * encabezado de la venta y su comisión también cambian cuando entra un pago), así que después de
 * cada operación se emite `cambio` y el orquestador vuelve a pedir `GET client/{id}/ventas`.
 */
export default {
  name: 'VentasTabCuotasTabla',
  props: {
    /** id del cliente dueño de las cuotas (arma las rutas). */
    client_id: { type: [Number, String], required: true },
    /** Cuotas a mostrar, tal como las arma `cuota_para_json` en la API. */
    cuotas: { type: Array, default: function () { return [] } },
    /** Texto cuando no hay ninguna cuota. */
    texto_vacio: { type: String, default: 'Sin cuotas.' },
  },
  emits: ['cambio'],
  data() {
    return {
      // Mes corriente, para marcar vencidas las pendientes de meses pasados.
      mes_corriente_actual: mes_corriente(),
      // id de la cuota sobre la que corre un request (null = ninguna), para deshabilitar solo esa fila.
      en_curso_id: null,
      // Pago inline: `id` de la cuota abierta (null = ninguna) y su formulario.
      pago: { id: null, form: { monto_pagado: '', fecha_pago: '', observacion: '', completa: false } },
      // Edición inline: `id` de la cuota abierta (null = ninguna) y su formulario.
      edicion: { id: null, form: { monto: '', moneda: 'USD', periodo: '', vencimiento: '', observacion: '', estado: 'pendiente' } },
    }
  },
  computed: {
    /**
     * La cuota cuyo formulario de pago está abierto (null si ninguno). El formulario vive debajo
     * de la tabla, así que necesita resolver la cuota por id.
     * @returns {Object|null}
     */
    cuota_del_pago() {
      const self = this
      return this.pago.id ? this.cuotas.find(function (c) { return c.id === self.pago.id }) || null : null
    },
    /**
     * La cuota en edición (null si ninguna). Mismo motivo que `cuota_del_pago`.
     * @returns {Object|null}
     */
    cuota_en_edicion() {
      const self = this
      return this.edicion.id ? this.cuotas.find(function (c) { return c.id === self.edicion.id }) || null : null
    },
  },
  methods: {
    etiqueta_corta,
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
     * Abre o cierra el formulario de pago de una cuota, prefijado con lo que falta y la fecha de
     * hoy. Cierra la edición si estaba abierta: un formulario a la vez.
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
     * POST client/{id}/licencias/{cuotaId}/pago. El backend acumula el pago y recalcula el
     * estado; después se avisa al orquestador para que recargue las ventas (cambió lo cobrado de
     * la venta y, con eso, la comisión liberada).
     * @param {Object} cuota
     */
    registrar_pago(cuota) {
      const self = this
      if (this.en_curso_id) {
        return
      }
      const f = this.pago.form
      self.en_curso_id = cuota.id
      api
        .post('/client/' + this.client_id + '/licencias/' + cuota.id + '/pago', {
          monto_pagado: Number(f.monto_pagado || 0),
          fecha_pago: f.fecha_pago || null,
          observacion: f.observacion || null,
          completa: !!f.completa,
        }, { silent_error: true })
        .then(function () {
          self.en_curso_id = null
          self.pago.id = null
          self.avisar('Pago registrado en la cuota ' + cuota.numero + '.')
          self.$emit('cambio')
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
      if (this.en_curso_id) {
        return
      }
      const f = this.edicion.form
      self.en_curso_id = cuota.id
      api
        .put('/client/' + this.client_id + '/licencias/' + cuota.id, {
          monto: Number(f.monto || 0),
          moneda: f.moneda || 'USD',
          vencimiento: f.vencimiento || null,
          periodo: partes_de_periodo(f.periodo) ? f.periodo : null,
          observacion: f.observacion || null,
          /* El estado viaja solo si el operador lo cambió: sin estado explícito el backend lo
             recalcula contra lo pagado al cambiar el monto (bajar una cuota parcial por debajo
             de lo cobrado la deja pagada sola). Mandarlo siempre anulaba esa regla. */
          estado: f.estado && f.estado !== cuota.estado ? f.estado : null,
        }, { silent_error: true })
        .then(function () {
          self.en_curso_id = null
          self.edicion.id = null
          self.avisar('Cuota ' + cuota.numero + ' guardada.')
          self.$emit('cambio')
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
      if (this.en_curso_id) {
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
        .delete('/client/' + this.client_id + '/licencias/' + cuota.id, { silent_error: true })
        .then(function () {
          self.en_curso_id = null
          self.avisar('Cuota eliminada.')
          self.$emit('cambio')
        })
        .catch(function (error) {
          self.en_curso_id = null
          self.avisar(resolve_error_message(error), 'danger')
        })
    },
  },
}
</script>

<style scoped lang="scss">
/* La fila cuyo formulario (pago o edición) está abierto debajo de la tabla, para que se vea cuál es. */
.cuotas-tabla__fila--abierta > td:first-child {
	box-shadow: inset 3px 0 0 #0d6efd;
}

/* El badge "Parcial · faltan USD 300" no se parte en dos renglones. */
.cuotas-tabla__badge {
	font-weight: 500;
	white-space: nowrap;
}
</style>
