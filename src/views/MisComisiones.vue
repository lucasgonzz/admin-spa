<template>
  <div class="container-fluid px-0 py-4 mis-comisiones">
    <!-- Encabezado -->
    <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
      <div>
        <h2 class="h4 mb-0">Mis comisiones</h2>
        <p class="text-muted small mb-0 mt-1">
          Lo que te corresponde por tus ventas. La comisión se libera a medida que pagan los clientes.
        </p>
      </div>
      <button type="button" class="btn btn-outline-primary btn-sm" :disabled="loading" title="Volver a cargar" @click="cargar">
        <span v-if="loading" class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
        <i v-else class="bi bi-arrow-clockwise"></i>
      </button>
    </div>

    <!-- Carga inicial -->
    <div v-if="loading && !cargado_alguna_vez" class="text-center py-5">
      <span class="spinner-border text-primary" role="status" aria-hidden="true" />
      <p class="text-muted mt-2">Cargando tus comisiones...</p>
    </div>

    <!-- Error de carga -->
    <div v-else-if="load_error" class="alert alert-danger">
      {{ load_error }}
    </div>

    <div v-else :class="{ 'mis-comisiones--actualizando': loading }">
      <p v-if="!comisiones.length && !pagos.length" class="text-muted fst-italic">
        Todavía no tenés ventas asignadas.
      </p>

      <!-- ============================================================ -->
      <!-- Las tres tarjetas, por moneda: para cobrar, ya cobrado, y lo -->
      <!-- que se libera cuando paguen los clientes.                    -->
      <!-- ============================================================ -->
      <template v-else>
        <div v-for="(cifras, moneda) in por_moneda" :key="moneda" class="row g-2 g-md-3 mb-3">
          <div class="col-12 col-md-4">
            <div class="card h-100 mis-cifra mis-cifra--primary">
              <div class="card-body py-3">
                <p class="mis-cifra__rotulo mb-1">Para cobrar</p>
                <p class="mis-cifra__valor mb-0 text-primary">{{ format_monto_con_moneda(cifras.a_pagar, moneda) }}</p>
                <p class="mis-cifra__pie mb-0">Ya liberado por lo que pagaron los clientes</p>
              </div>
            </div>
          </div>
          <div class="col-6 col-md-4">
            <div class="card h-100 mis-cifra mis-cifra--success">
              <div class="card-body py-3">
                <p class="mis-cifra__rotulo mb-1">Ya cobrado</p>
                <p class="mis-cifra__valor mb-0 text-success">{{ format_monto_con_moneda(cifras.pagada, moneda) }}</p>
              </div>
            </div>
          </div>
          <div class="col-6 col-md-4">
            <div class="card h-100 mis-cifra mis-cifra--neutral">
              <div class="card-body py-3">
                <p class="mis-cifra__rotulo mb-1">Se libera cuando paguen los clientes</p>
                <p class="mis-cifra__valor mb-0">{{ format_monto_con_moneda(cifras.por_liberar, moneda) }}</p>
                <p class="mis-cifra__pie mb-0">Comisión total {{ format_monto_con_moneda(cifras.total, moneda) }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- ========================================================== -->
        <!-- Mis ventas, con cómo viene pagando cada cliente.           -->
        <!-- ========================================================== -->
        <h3 class="h6 mt-4 mb-2">Mis ventas</h3>
        <p v-if="!comisiones.length" class="text-muted small mb-0">No tenés ventas asignadas.</p>
        <div v-else class="table-responsive mis-tabla-wrap">
          <table class="table table-sm align-middle mb-0 mis-tabla">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Productos</th>
                <th class="text-end">Venta</th>
                <th>Pago del cliente</th>
                <th class="text-end">Comisión</th>
                <th class="text-end">Liberada</th>
                <th class="text-end">Cobrada</th>
                <th class="text-end">Para cobrar</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in comisiones" :key="item.id">
                <td>
                  <span class="fw-semibold">{{ nombre_de_cliente(item.client) }}</span>
                  <div class="mis-tabla__nota">{{ formatear_fecha(item.fecha) }}</div>
                </td>
                <td>
                  <div class="d-flex flex-wrap gap-1">
                    <span
                      v-for="producto in productos_de(item)"
                      :key="producto.clave"
                      class="badge mis-badge"
                      :class="clase_badge_producto(producto.clave)"
                    >
                      {{ producto.etiqueta }}
                    </span>
                  </div>
                </td>
                <td class="text-end text-nowrap">{{ format_monto_con_moneda(resumen_de(item).total, item.moneda) }}</td>
                <td class="text-nowrap">
                  <span class="badge mis-badge" :class="estado_de_pago(item).clase">{{ estado_de_pago(item).texto }}</span>
                  <div class="mis-tabla__nota">
                    pagó {{ format_monto_con_moneda(resumen_de(item).cobrado, item.moneda) }}
                    <template v-if="resumen_de(item).pendiente > 0"> · debe {{ format_monto_con_moneda(resumen_de(item).pendiente, item.moneda) }}</template>
                  </div>
                </td>
                <td class="text-end text-nowrap">
                  {{ format_monto_con_moneda(comision_de(item).total, comision_de(item).moneda) }}
                  <div v-if="comision_de(item).porcentaje !== null" class="mis-tabla__nota">{{ comision_de(item).porcentaje }} %</div>
                </td>
                <td class="text-end text-nowrap">{{ format_monto_con_moneda(comision_de(item).liberada, comision_de(item).moneda) }}</td>
                <td class="text-end text-nowrap">{{ format_monto_con_moneda(comision_de(item).pagada, comision_de(item).moneda) }}</td>
                <td class="text-end text-nowrap fw-semibold" :class="comision_de(item).a_pagar > 0 ? 'text-primary' : 'text-muted'">
                  {{ format_monto_con_moneda(comision_de(item).a_pagar, comision_de(item).moneda) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- ========================================================== -->
        <!-- Pagos que recibí, del más nuevo al más viejo.              -->
        <!-- ========================================================== -->
        <h3 class="h6 mt-4 mb-2">Pagos recibidos</h3>
        <p v-if="!pagos.length" class="text-muted small mb-0">Todavía no se te registró ningún pago.</p>
        <div v-else class="table-responsive mis-tabla-wrap">
          <table class="table table-sm align-middle mb-0 mis-tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th class="text-end">Monto</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="pago in pagos" :key="pago.id">
                <td class="text-nowrap">{{ formatear_fecha(pago.fecha) }}</td>
                <td>{{ nombre_de_cliente(pago.client) }}</td>
                <td class="text-end text-nowrap">{{ format_monto_con_moneda(pago.monto, pago.moneda) }}</td>
                <td>{{ pago.nota || '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import { formatear_fecha } from '@/components/cobranzas/meses'
import { format_monto_con_moneda } from '@/components/cobranzas/plata'
import {
  PRODUCTOS_ETIQUETAS_DEFAULT,
  clase_badge_producto,
  comision_de_venta,
  nombre_de_cliente,
  numero,
  productos_de_venta,
  resumen_de_venta,
} from '@/components/cobranzas/ventas'

/**
 * Mis comisiones (misión ventas-y-comisiones, 28/10/2026).
 *
 * La pantalla del vendedor (Tomás): solo lectura. Lee `GET comisiones/mias`, que trae lo mismo
 * que Cobranzas › Comisiones pero filtrado al admin autenticado, más su `resumen`:
 * `{comisiones, resumen_por_vendedor, resumen: {por_moneda, pagos}}`.
 *
 * - Arriba, por moneda, tres tarjetas: "Para cobrar" (`a_pagar`: lo liberado que todavía no se le
 *   pagó), "Ya cobrado" (`pagada`) y "Se libera cuando paguen los clientes" (`por_liberar`).
 * - "Mis ventas": cada venta con cómo viene pagando el cliente (pagó todo / parcial / no pagó) y
 *   la comisión.
 * - "Pagos recibidos": lo que Lucas le registró, con el cliente de cada venta.
 *
 * Si la API no mandara `resumen` (o le faltara algo), las tarjetas y la lista de pagos se arman
 * con las filas de `comisiones`, que traen todo lo necesario.
 *
 * En el menú aparece solo para los admins marcados "Es vendedor" (router/nav.js); la ruta en sí
 * no tiene más guarda que la sesión porque la API ya filtra por el admin autenticado.
 */
export default {
  name: 'ViewMisComisiones',
  data() {
    return {
      // true mientras se consulta.
      loading: false,
      // true una vez que se cargó al menos una vez.
      cargado_alguna_vez: false,
      // Mensaje de error de la carga (null = sin error).
      load_error: null,
      // Mis ventas, con cliente, comisión y pagos.
      comisiones: [],
      // `{USD: {total, liberada, pagada, a_pagar, por_liberar}}` de la API (null = armarlo acá).
      por_moneda_api: null,
      // Pagos recibidos de la API (null = armarlos acá con los `pagos` de cada venta).
      pagos_api: null,
      // Mapa `{clave: etiqueta}` de los productos (la ruta no lo manda: defaults).
      productos: Object.assign({}, PRODUCTOS_ETIQUETAS_DEFAULT),
    }
  },
  computed: {
    /**
     * Totales por moneda para las tarjetas: los de la API si vinieron; si no, sumados acá.
     * @returns {Object<string, {total: number, liberada: number, pagada: number, a_pagar: number, por_liberar: number}>}
     */
    por_moneda() {
      if (this.por_moneda_api && Object.keys(this.por_moneda_api).length) {
        return this.por_moneda_api
      }
      const acumulado = {}
      this.comisiones.forEach(function (item) {
        const comision = comision_de_venta(item)
        const moneda = comision.moneda
        if (!acumulado[moneda]) {
          acumulado[moneda] = { total: 0, liberada: 0, pagada: 0, a_pagar: 0, por_liberar: 0 }
        }
        Object.keys(acumulado[moneda]).forEach(function (clave) {
          acumulado[moneda][clave] = Math.round((acumulado[moneda][clave] + numero(comision[clave])) * 100) / 100
        })
      })
      return acumulado
    },
    /**
     * Pagos recibidos: los de la API si vinieron; si no, los de cada venta (con su cliente),
     * del más nuevo al más viejo.
     * @returns {Array<Object>}
     */
    pagos() {
      if (Array.isArray(this.pagos_api)) {
        return this.pagos_api
      }
      const lista = []
      this.comisiones.forEach(function (item) {
        (Array.isArray(item.pagos) ? item.pagos : []).forEach(function (pago) {
          lista.push(Object.assign({}, pago, { client: item.client }))
        })
      })
      return lista.sort(function (a, b) {
        return String(b.fecha || '').localeCompare(String(a.fecha || '')) || Number(b.id) - Number(a.id)
      })
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
    /**
     * GET comisiones/mias.
     */
    cargar() {
      const self = this
      self.loading = true
      self.load_error = null
      api
        .get('/comisiones/mias', { silent_error: true })
        .then(function (res) {
          const data = res.data || {}
          const resumen = data.resumen || {}
          self.comisiones = Array.isArray(data.comisiones) ? data.comisiones : []
          self.por_moneda_api = resumen.por_moneda && typeof resumen.por_moneda === 'object' && !Array.isArray(resumen.por_moneda) ? resumen.por_moneda : null
          self.pagos_api = Array.isArray(resumen.pagos) ? resumen.pagos : null
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
     * Estado de pago del cliente en una venta, para el badge: pagó todo, pagó una parte o
     * todavía no pagó nada.
     * @param {Object} item
     * @returns {{texto: string, clase: string}}
     */
    estado_de_pago(item) {
      const resumen = resumen_de_venta(item)
      if (resumen.total > 0 && resumen.pendiente <= 0) {
        return { texto: 'Pagó todo', clase: 'text-bg-success' }
      }
      if (resumen.cobrado > 0) {
        return { texto: 'Pagó una parte', clase: 'text-bg-warning' }
      }
      return { texto: 'Todavía no pagó', clase: 'text-bg-light border text-muted' }
    },
  },
}
</script>

<style scoped lang="scss">
/* Mismo margen lateral que las vistas de Cobranzas: compensa el gutter negativo de los .row. */
.mis-comisiones {
	padding-left: 0.5rem;
	padding-right: 0.5rem;
}

.mis-comisiones--actualizando {
	opacity: 0.6;
	transition: opacity 0.15s ease-out;
}

/* Tarjetas de cifras: misma familia visual que Cobranzas. */
.mis-cifra {
	border-radius: 0.75rem;
	border: 1px solid transparent;
}

.mis-cifra--primary {
	background-color: var(--bs-primary-bg-subtle);
	border-color: var(--bs-primary-border-subtle);
}

.mis-cifra--success {
	background-color: var(--bs-success-bg-subtle);
	border-color: var(--bs-success-border-subtle);
}

.mis-cifra--neutral {
	background-color: var(--bs-secondary-bg-subtle);
	border-color: var(--bs-secondary-border-subtle);
}

.mis-cifra__rotulo {
	font-size: 0.75rem;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: #6c757d;
}

.mis-cifra__valor {
	font-size: 1.5rem;
	font-weight: 600;
	line-height: 1.15;
	letter-spacing: -0.02em;
}

.mis-cifra__pie {
	font-size: 0.75rem;
	color: #6c757d;
	margin-top: 0.25rem;
}

/* Las tablas scrollean a lo ancho DENTRO de su caja; la página nunca. */
.mis-tabla-wrap {
	border: 1px solid #ededf0;
	border-radius: 0.75rem;
	overflow-x: auto;
}

/* Headers con el contraste de las tablas de Cobranzas (fondo oscuro global de _app.sass). */
.mis-tabla th {
	font-size: 0.78rem;
	text-transform: uppercase;
	letter-spacing: 0.03em;
	color: #fff;
	font-weight: 600;
	white-space: nowrap;
}

.mis-tabla td {
	font-size: 0.875rem;
}

.mis-tabla__nota {
	font-size: 0.7rem;
	color: #8a8a8f;
}

.mis-badge {
	font-weight: 500;
}

@media (max-width: 575.98px) {
	.mis-cifra__valor {
		font-size: 1.1rem;
	}
}
</style>
