<template>
  <div class="container-fluid px-0 py-4 cobranzas-vista">
    <!-- Encabezado y filtros -->
    <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
      <div>
        <h2 class="h4 mb-0">Comisiones</h2>
        <p class="text-muted small mb-0 mt-1">
          Lo que le corresponde a cada vendedor por sus ventas. Se libera a medida que paga el cliente.
        </p>
      </div>

      <div class="d-flex flex-wrap align-items-end gap-2 gap-md-3 comisiones-filtros">
        <div>
          <label class="form-label small text-muted mb-1 d-block">Vendedor</label>
          <select v-model="vendedor_id" class="form-select form-select-sm" @change="cargar">
            <option :value="null">Todos</option>
            <option v-for="vendedor in vendedores" :key="vendedor.id" :value="vendedor.id">{{ vendedor.name }}</option>
          </select>
        </div>
        <div class="form-check mb-1">
          <input id="comisiones-solo-a-pagar" v-model="solo_a_pagar" class="form-check-input" type="checkbox" />
          <label class="form-check-label small" for="comisiones-solo-a-pagar">Solo con saldo a pagar</label>
        </div>
        <button type="button" class="btn btn-outline-primary btn-sm" :disabled="loading" title="Volver a cargar" @click="cargar">
          <span v-if="loading" class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
          <i v-else class="bi bi-arrow-clockwise"></i>
        </button>
      </div>
    </div>

    <!-- Carga inicial -->
    <div v-if="loading && !cargado_alguna_vez" class="text-center py-5">
      <span class="spinner-border text-primary" role="status" aria-hidden="true" />
      <p class="text-muted mt-2">Cargando comisiones...</p>
    </div>

    <!-- Error de carga -->
    <div v-else-if="load_error" class="alert alert-danger">
      {{ load_error }}
    </div>

    <div v-else :class="{ 'comisiones--actualizando': loading }">
      <!-- ============================================================ -->
      <!-- Resumen por vendedor: una tarjeta por vendedor y, adentro,   -->
      <!-- un renglón por moneda (a pagar grande; el resto, chico).     -->
      <!-- ============================================================ -->
      <div v-if="resumen_por_vendedor.length" class="row g-2 g-md-3 mb-3">
        <div v-for="fila in resumen_por_vendedor" :key="fila.vendedor_admin_id" class="col-12 col-md-6 col-xl-4">
          <div class="card h-100 cobranzas-cifra cobranzas-cifra--primary">
            <div class="card-body py-3">
              <p class="cobranzas-cifra__rotulo mb-1">{{ fila.vendedor_nombre || 'Admin #' + fila.vendedor_admin_id }} · a pagar</p>
              <div v-for="(cifras, moneda) in fila.por_moneda" :key="moneda" class="mb-1">
                <p class="cobranzas-cifra__valor mb-0" :class="{ 'text-primary': numero(cifras.a_pagar) > 0 }">
                  {{ format_monto_con_moneda(cifras.a_pagar, moneda) }}
                </p>
                <p class="cobranzas-cifra__pie mb-0">
                  Total {{ format_monto_con_moneda(cifras.total, moneda) }}
                  · liberada {{ format_monto_con_moneda(cifras.liberada, moneda) }}
                  · pagada {{ format_monto_con_moneda(cifras.pagada, moneda) }}
                  · por liberar {{ format_monto_con_moneda(cifras.por_liberar, moneda) }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p v-if="comisiones_visibles.length === 0" class="text-muted small fst-italic mb-0">
        <span v-if="solo_a_pagar">No hay comisiones con saldo a pagar.</span>
        <span v-else>No hay ventas con vendedor asignado.</span>
      </p>

      <!-- ============================================================ -->
      <!-- Una fila por venta con vendedor.                             -->
      <!-- ============================================================ -->
      <div v-else class="table-responsive cobranzas-tabla-wrap">
        <table class="table table-sm align-middle mb-0 cobranzas-tabla">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Productos</th>
              <th v-if="!vendedor_id">Vendedor</th>
              <th class="text-end">Venta</th>
              <th class="text-end">Comisión</th>
              <th class="text-end">Liberada</th>
              <th class="text-end">Pagada</th>
              <th class="text-end">A pagar</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in comisiones_visibles"
              :key="item.id"
              :class="{ 'comisiones-fila--abierta': pagos_abiertos_id === item.id }"
            >
              <td>
                <span class="fw-semibold">{{ nombre_de_cliente(item.client) }}</span>
                <div class="cobranzas-tabla__nota">{{ formatear_fecha(item.fecha) }}</div>
              </td>
              <td>
                <div class="d-flex flex-wrap gap-1">
                  <span
                    v-for="producto in productos_de(item)"
                    :key="producto.clave"
                    class="badge comisiones-badge"
                    :class="clase_badge_producto(producto.clave)"
                  >
                    {{ producto.etiqueta }}
                  </span>
                </div>
              </td>
              <td v-if="!vendedor_id">{{ vendedor_de(item) }}</td>
              <td class="text-end text-nowrap">
                {{ format_monto_con_moneda(resumen_de(item).total, item.moneda) }}
                <div class="cobranzas-tabla__nota">cobrado {{ porcentaje_cobrado(item) }} %</div>
              </td>
              <td class="text-end text-nowrap">
                {{ format_monto_con_moneda(comision_de(item).total, comision_de(item).moneda) }}
                <div v-if="comision_de(item).porcentaje !== null" class="cobranzas-tabla__nota">{{ comision_de(item).porcentaje }} %</div>
              </td>
              <td class="text-end text-nowrap">{{ format_monto_con_moneda(comision_de(item).liberada, comision_de(item).moneda) }}</td>
              <td class="text-end text-nowrap">{{ format_monto_con_moneda(comision_de(item).pagada, comision_de(item).moneda) }}</td>
              <td class="text-end text-nowrap fw-semibold" :class="comision_de(item).a_pagar > 0 ? 'text-primary' : 'text-muted'">
                {{ format_monto_con_moneda(comision_de(item).a_pagar, comision_de(item).moneda) }}
              </td>
              <td class="text-end text-nowrap">
                <button
                  type="button"
                  class="btn btn-outline-primary btn-sm py-0"
                  title="Registrar un pago al vendedor"
                  @click="abrir_pago(item)"
                >
                  <i class="bi bi-cash-coin"></i>
                  <span class="d-none d-lg-inline ms-1">Registrar pago</span>
                </button>
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm py-0 ms-1"
                  :title="'Pagos registrados (' + pagos_de(item).length + ')'"
                  :disabled="!pagos_de(item).length"
                  @click="alternar_pagos(item)"
                >
                  <i class="bi bi-list-ul"></i>
                  <span class="ms-1">{{ pagos_de(item).length }}</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ============================================================ -->
      <!-- Pagos de la venta elegida, DEBAJO de la tabla (no como fila  -->
      <!-- extra): en teléfono la tabla scrollea a lo ancho y una fila  -->
      <!-- desplegada quedaba medio fuera de vista.                     -->
      <!-- ============================================================ -->
      <div v-if="venta_con_pagos_abiertos" class="bg-light rounded p-3 mt-2">
        <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
          <p class="small fw-semibold mb-0">
            Pagos a {{ vendedor_de(venta_con_pagos_abiertos) || 'el vendedor' }} · {{ nombre_de_cliente(venta_con_pagos_abiertos.client) }}
          </p>
          <button type="button" class="btn btn-link btn-sm ms-auto p-0" @click="pagos_abiertos_id = null">Cerrar</button>
        </div>
        <div class="table-responsive">
          <table class="table table-sm table-bordered small mb-0 bg-white">
            <thead>
              <tr class="table-light">
                <th>Fecha</th>
                <th class="text-end">Monto</th>
                <th>Nota</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="pago in pagos_de(venta_con_pagos_abiertos)" :key="pago.id">
                <td class="text-nowrap">{{ formatear_fecha(pago.fecha) }}</td>
                <td class="text-end text-nowrap">{{ format_monto_con_moneda(pago.monto, pago.moneda) }}</td>
                <td>{{ pago.nota || '' }}</td>
                <td class="text-end">
                  <button
                    type="button"
                    class="btn btn-outline-danger btn-sm py-0"
                    title="Eliminar el pago"
                    :disabled="eliminando_id === pago.id"
                    @click="eliminar_pago(pago)"
                  >
                    <i class="bi bi-trash"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ============================================================ -->
    <!-- Modal "Registrar pago" al vendedor.                          -->
    <!-- ============================================================ -->
    <base-modal
      :show="pago.show"
      :title="pago.venta ? 'Pago a ' + (vendedor_de(pago.venta) || 'el vendedor') : 'Registrar pago'"
      @update:show="pago.show = $event"
      @close="pago.show = false"
    >
      <template v-if="pago.venta">
        <p class="small text-muted mb-3">
          {{ nombre_de_cliente(pago.venta.client) }} · liberada {{ format_monto_con_moneda(comision_de(pago.venta).liberada, comision_de(pago.venta).moneda) }}
          · pagada {{ format_monto_con_moneda(comision_de(pago.venta).pagada, comision_de(pago.venta).moneda) }}
          · a pagar <strong>{{ format_monto_con_moneda(comision_de(pago.venta).a_pagar, comision_de(pago.venta).moneda) }}</strong>
        </p>
        <div class="row g-2">
          <div class="col-12 col-sm-6">
            <label class="form-label small mb-1">Monto ({{ comision_de(pago.venta).moneda }})</label>
            <input v-model="pago.form.monto" type="number" min="0" step="0.01" class="form-control form-control-sm" />
          </div>
          <div class="col-12 col-sm-6">
            <label class="form-label small mb-1">Fecha</label>
            <input v-model="pago.form.fecha" type="date" class="form-control form-control-sm" />
          </div>
          <div class="col-12">
            <label class="form-label small mb-1">Nota</label>
            <input v-model="pago.form.nota" type="text" maxlength="255" class="form-control form-control-sm" placeholder="Opcional (transferencia, efectivo...)" />
          </div>
        </div>
        <!-- Aviso ANTES de guardar: la API lo permite (y lo marca con `excede`), pero es plata
             que el vendedor cobra antes de que pague el cliente. -->
        <div v-if="excedente_del_pago > 0" class="alert alert-warning py-2 small mt-3 mb-0">
          <i class="bi bi-exclamation-triangle me-1"></i>
          Este pago supera lo liberado por {{ format_monto_con_moneda(excedente_del_pago, comision_de(pago.venta).moneda) }}:
          el vendedor estaría cobrando antes de que pague el cliente.
        </div>
      </template>
      <template #footer>
        <button type="button" class="btn btn-secondary" :disabled="pago.guardando" @click="pago.show = false">Cancelar</button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="pago.guardando || numero(pago.form.monto) <= 0"
          @click="registrar_pago"
        >
          {{ pago.guardando ? 'Guardando...' : 'Registrar pago' }}
        </button>
      </template>
    </base-modal>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import BaseModal from '@/components/ui/BaseModal.vue'
import { formatear_fecha, hoy_iso } from '@/components/cobranzas/meses'
import { format_monto_con_moneda } from '@/components/cobranzas/plata'
import {
  PRODUCTOS_ETIQUETAS_DEFAULT,
  clase_badge_producto,
  comision_de_venta,
  nombre_de_cliente,
  nombre_de_vendedor,
  numero,
  productos_de_venta,
  redondear,
  resumen_de_venta,
} from '@/components/cobranzas/ventas'

/**
 * Cobranzas › Comisiones (misión ventas-y-comisiones, 28/10/2026).
 *
 * La pantalla de Lucas para pagarles a los vendedores. Arriba, el resumen por vendedor (a pagar,
 * y total · liberada · pagada · por liberar, por moneda); abajo, una fila por venta con vendedor:
 * cliente, productos, el total de la venta y cuánto cobró el cliente, y la comisión (total,
 * liberada, pagada, a pagar).
 *
 * La comisión se libera a medida que paga el cliente (decisión de Lucas, 28/10/2026): lo que se
 * le puede pagar al vendedor es `a_pagar` = liberada − pagada. "Registrar pago" abre un modal con
 * ese monto precargado; si se tipea más, se avisa antes de guardar (la API lo deja pasar y lo
 * marca con `excede`).
 *
 * API:
 * - `GET comisiones?vendedor_admin_id=` → `{comisiones, resumen_por_vendedor, vendedores}`; cada
 *   ítem de `comisiones` es la venta (`venta_para_json`) + `client: {id, nombre}` + `pagos`.
 * - `POST ventas/{ventaId}/comision/pagos` `{monto, fecha, nota}`.
 * - `DELETE comision-pagos/{pagoId}`.
 * Después de cada escritura se recarga la tabla entera: cambian la fila y el resumen de arriba.
 */
export default {
  name: 'ViewCobranzasComisiones',
  components: { BaseModal },
  data() {
    return {
      // true mientras se consulta el listado.
      loading: false,
      // true una vez que se cargó al menos una vez.
      cargado_alguna_vez: false,
      // Mensaje de error de la carga (null = sin error).
      load_error: null,
      // Ventas con vendedor, con su cliente, su comisión y sus pagos.
      comisiones: [],
      // `[{vendedor_admin_id, vendedor_nombre, por_moneda: {USD: {total, liberada, pagada, a_pagar, por_liberar}}}]`.
      resumen_por_vendedor: [],
      // Admins vendedores `[{id, name}]`, para el selector.
      vendedores: [],
      // Mapa `{clave: etiqueta}` de productos (esta ruta no lo manda: alcanza con los defaults y
      // con `productos_etiquetas` de cada venta).
      productos: Object.assign({}, PRODUCTOS_ETIQUETAS_DEFAULT),
      // Vendedor elegido en el selector (null = todos). Viaja como `vendedor_admin_id`.
      vendedor_id: null,
      // Filtro local: solo las ventas con algo para pagarle al vendedor.
      solo_a_pagar: false,
      // id de la venta cuyos pagos se ven debajo de la tabla (null = ninguna).
      pagos_abiertos_id: null,
      // id del pago que se está eliminando (null = ninguno).
      eliminando_id: null,
      // Modal de registrar pago.
      pago: { show: false, venta: null, guardando: false, form: { monto: '', fecha: '', nota: '' } },
    }
  },
  computed: {
    /**
     * Filas de la tabla, con el filtro "solo con saldo a pagar".
     * @returns {Array<Object>}
     */
    comisiones_visibles() {
      if (!this.solo_a_pagar) {
        return this.comisiones
      }
      return this.comisiones.filter(function (item) {
        return comision_de_venta(item).a_pagar > 0
      })
    },
    /**
     * La venta cuyos pagos están abiertos (null si ninguna o si desapareció al recargar).
     * @returns {Object|null}
     */
    venta_con_pagos_abiertos() {
      const self = this
      if (!this.pagos_abiertos_id) {
        return null
      }
      return this.comisiones.find(function (item) { return item.id === self.pagos_abiertos_id }) || null
    },
    /**
     * Cuánto se pasa el pago que se está tipeando de lo que hay para pagar (0 si no se pasa).
     * @returns {number}
     */
    excedente_del_pago() {
      if (!this.pago.venta) {
        return 0
      }
      const diferencia = redondear(numero(this.pago.form.monto) - comision_de_venta(this.pago.venta).a_pagar)
      return diferencia > 0 ? diferencia : 0
    },
  },
  mounted() {
    this.cargar()
  },
  methods: {
    formatear_fecha,
    format_monto_con_moneda,
    clase_badge_producto,
    nombre_de_cliente,
    numero,
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
     * GET comisiones (con `vendedor_admin_id` si hay uno elegido).
     */
    cargar() {
      const self = this
      const params = {}
      if (this.vendedor_id) {
        params.vendedor_admin_id = this.vendedor_id
      }
      self.loading = true
      self.load_error = null
      api
        .get('/comisiones', { params: params, silent_error: true })
        .then(function (res) {
          const data = res.data || {}
          self.comisiones = Array.isArray(data.comisiones) ? data.comisiones : []
          self.resumen_por_vendedor = Array.isArray(data.resumen_por_vendedor) ? data.resumen_por_vendedor : []
          if (Array.isArray(data.vendedores)) {
            self.vendedores = data.vendedores
          }
          self.loading = false
          self.cargado_alguna_vez = true
        })
        .catch(function (error) {
          self.load_error = resolve_error_message(error)
          self.loading = false
        })
    },
    /**
     * Productos de una venta con su etiqueta.
     * @param {Object} item
     * @returns {Array<{clave: string, etiqueta: string}>}
     */
    productos_de(item) {
      return productos_de_venta(item, this.productos)
    },
    /**
     * `{total, cobrado, pendiente}` de la venta.
     * @param {Object} item
     * @returns {Object}
     */
    resumen_de(item) {
      return resumen_de_venta(item)
    },
    /**
     * Comisión de la venta con defaults.
     * @param {Object} item
     * @returns {Object}
     */
    comision_de(item) {
      return comision_de_venta(item)
    },
    /**
     * Nombre del vendedor de la venta.
     * @param {Object} item
     * @returns {string}
     */
    vendedor_de(item) {
      return nombre_de_vendedor(item, this.vendedores)
    },
    /**
     * Pagos al vendedor de una venta.
     * @param {Object} item
     * @returns {Array<Object>}
     */
    pagos_de(item) {
      return item && Array.isArray(item.pagos) ? item.pagos : []
    },
    /**
     * Qué parte de la venta pagó el cliente, en % entero: es lo que explica cuánto de la
     * comisión está liberado.
     * @param {Object} item
     * @returns {number}
     */
    porcentaje_cobrado(item) {
      const resumen = resumen_de_venta(item)
      if (resumen.total <= 0) {
        return 0
      }
      return Math.min(100, Math.round((resumen.cobrado / resumen.total) * 100))
    },
    /**
     * Muestra u oculta los pagos de una venta debajo de la tabla.
     * @param {Object} item
     */
    alternar_pagos(item) {
      this.pagos_abiertos_id = this.pagos_abiertos_id === item.id ? null : item.id
    },
    /**
     * Abre el modal de pago con `a_pagar` precargado (vacío si no hay nada liberado: así no se
     * registra un pago por error) y la fecha de hoy.
     * @param {Object} item
     */
    abrir_pago(item) {
      const a_pagar = comision_de_venta(item).a_pagar
      this.pago = {
        show: true,
        venta: item,
        guardando: false,
        form: { monto: a_pagar > 0 ? a_pagar : '', fecha: hoy_iso(), nota: '' },
      }
    },
    /**
     * POST ventas/{ventaId}/comision/pagos. Si el monto excede lo liberado se pide una
     * confirmación más (el aviso amarillo ya estaba a la vista).
     */
    registrar_pago() {
      const self = this
      const venta = this.pago.venta
      if (!venta || this.pago.guardando) {
        return
      }
      if (this.excedente_del_pago > 0) {
        const seguir = window.confirm('El pago supera lo liberado. ¿Registrarlo igual?')
        if (!seguir) {
          return
        }
      }
      const f = this.pago.form
      self.pago.guardando = true
      api
        .post('/ventas/' + venta.id + '/comision/pagos', {
          monto: redondear(f.monto),
          fecha: f.fecha || null,
          nota: String(f.nota || '').trim() || null,
        }, { silent_error: true })
        .then(function (res) {
          const data = res.data || {}
          self.pago.guardando = false
          self.pago.show = false
          self.avisar(data.excede ? 'Pago registrado (supera lo liberado).' : 'Pago registrado.', data.excede ? 'warning' : 'success')
          self.cargar()
        })
        .catch(function (error) {
          self.pago.guardando = false
          self.avisar(resolve_error_message(error), 'danger')
        })
    },
    /**
     * DELETE comision-pagos/{pagoId}, previa confirmación.
     * @param {Object} pago
     */
    eliminar_pago(pago) {
      const self = this
      if (this.eliminando_id) {
        return
      }
      const confirmado = window.confirm(
        '¿Eliminar el pago de ' + format_monto_con_moneda(pago.monto, pago.moneda) + ' del ' + formatear_fecha(pago.fecha) + '?'
      )
      if (!confirmado) {
        return
      }
      self.eliminando_id = pago.id
      api
        .delete('/comision-pagos/' + pago.id, { silent_error: true })
        .then(function () {
          self.eliminando_id = null
          self.avisar('Pago eliminado.')
          self.cargar()
        })
        .catch(function (error) {
          self.eliminando_id = null
          self.avisar(resolve_error_message(error), 'danger')
        })
    },
  },
}
</script>

<style scoped lang="scss">
/* Mismo margen lateral que Mensualidades: compensa el gutter negativo de los .row. */
.cobranzas-vista {
	padding-left: 0.5rem;
	padding-right: 0.5rem;
}

.comisiones--actualizando {
	opacity: 0.6;
	transition: opacity 0.15s ease-out;
}

/* Tarjetas de cifras: misma familia que Mensualidades y Ventas. */
.cobranzas-cifra {
	border-radius: 0.75rem;
	border: 1px solid transparent;
}

.cobranzas-cifra--primary {
	background-color: var(--bs-primary-bg-subtle);
	border-color: var(--bs-primary-border-subtle);
}

.cobranzas-cifra__rotulo {
	font-size: 0.75rem;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: #6c757d;
}

.cobranzas-cifra__valor {
	font-size: 1.5rem;
	font-weight: 600;
	line-height: 1.15;
	letter-spacing: -0.02em;
}

.cobranzas-cifra__pie {
	font-size: 0.75rem;
	color: #6c757d;
	margin-top: 0.25rem;
}

/* La tabla scrollea a lo ancho DENTRO de su caja; la página nunca. */
.cobranzas-tabla-wrap {
	border: 1px solid #ededf0;
	border-radius: 0.75rem;
	overflow-x: auto;
}

/* Headers con el mismo contraste que Mensualidades (fondo oscuro global de _app.sass). */
.cobranzas-tabla th {
	font-size: 0.78rem;
	text-transform: uppercase;
	letter-spacing: 0.03em;
	color: #fff;
	font-weight: 600;
	white-space: nowrap;
}

.cobranzas-tabla td {
	font-size: 0.875rem;
}

.cobranzas-tabla__nota {
	font-size: 0.7rem;
	color: #8a8a8f;
}

.comisiones-badge {
	font-weight: 500;
}

/* La fila cuyos pagos están abiertos debajo de la tabla, para que se vea cuál es. */
.comisiones-fila--abierta > td:first-child {
	box-shadow: inset 3px 0 0 #0d6efd;
}

@media (max-width: 575.98px) {
	.cobranzas-cifra__valor {
		font-size: 1.1rem;
	}

	/* En teléfono el selector de vendedor ocupa el ancho disponible. */
	.comisiones-filtros {
		width: 100%;
	}

	.comisiones-filtros > div:not(.form-check) {
		flex: 1 1 10rem;
	}
}
</style>
