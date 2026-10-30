<template>
  <div class="container-fluid px-0 py-4 cobranzas-vista">
    <!-- Encabezado y filtros -->
    <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
      <div>
        <h2 class="h4 mb-0">Ventas</h2>
        <p class="text-muted small mb-0 mt-1">
          Lo que se le vendió a cada cliente, cuánto pagó y cuánto le corresponde al vendedor.
        </p>
      </div>

      <div class="d-flex flex-wrap align-items-end gap-2 gap-md-3 ventas-filtros">
        <div>
          <label class="form-label small text-muted mb-1 d-block">Producto</label>
          <select v-model="filtro_producto" class="form-select form-select-sm">
            <option value="">Todos</option>
            <option v-for="(etiqueta, clave) in productos" :key="clave" :value="clave">{{ etiqueta }}</option>
          </select>
        </div>
        <div>
          <label class="form-label small text-muted mb-1 d-block">Buscar</label>
          <input v-model="busqueda" type="search" class="form-control form-control-sm" placeholder="Cliente" />
        </div>
        <div class="form-check mb-1">
          <input id="ventas-solo-pendientes" v-model="solo_pendientes" class="form-check-input" type="checkbox" />
          <label class="form-check-label small" for="ventas-solo-pendientes">Con saldo pendiente</label>
        </div>
        <button type="button" class="btn btn-outline-primary btn-sm" :disabled="loading" title="Volver a cargar" @click="cargar">
          <span v-if="loading" class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
          <i v-else class="bi bi-arrow-clockwise"></i>
        </button>
        <button type="button" class="btn btn-primary btn-sm" @click="abrir_elegir_cliente">
          <i class="bi bi-plus-lg me-1"></i>Nueva venta
        </button>
      </div>
    </div>

    <!-- Carga inicial -->
    <div v-if="loading && !cargado_alguna_vez" class="text-center py-5">
      <span class="spinner-border text-primary" role="status" aria-hidden="true" />
      <p class="text-muted mt-2">Cargando ventas...</p>
    </div>

    <!-- Error de carga -->
    <div v-else-if="load_error" class="alert alert-danger">
      {{ load_error }}
    </div>

    <div v-else>
      <!-- ============================================================ -->
      <!-- Cifras de arriba, por moneda: lo vendido, lo que hay que     -->
      <!-- cobrarle a los clientes, lo que está en stand-by (clientes   -->
      <!-- de dudoso cobro) y lo que hay que pagarles a los vendedores. -->
      <!-- Suman lo que se ve (respetan los filtros).                   -->
      <!-- ============================================================ -->
      <div class="row g-2 g-md-3 mb-3">
        <div class="col-12 col-md-6 col-xl-3">
          <div class="card h-100 cobranzas-cifra cobranzas-cifra--neutral">
            <div class="card-body py-3">
              <p class="cobranzas-cifra__rotulo mb-1">Vendido</p>
              <p class="cobranzas-cifra__valor mb-0">{{ format_por_moneda(totales.total) }}</p>
              <p class="cobranzas-cifra__pie mb-0">
                Cobrado {{ format_por_moneda(totales.cobrado) }} · {{ cantidad_ventas_visibles }} {{ cantidad_ventas_visibles === 1 ? 'venta' : 'ventas' }}
              </p>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-6 col-xl-3">
          <div class="card h-100 cobranzas-cifra cobranzas-cifra--danger">
            <div class="card-body py-3">
              <p class="cobranzas-cifra__rotulo mb-1">Deben los clientes</p>
              <p class="cobranzas-cifra__valor mb-0" :class="{ 'text-danger': hay_valor(totales.por_cobrar) }">{{ format_por_moneda(totales.por_cobrar) }}</p>
              <p class="cobranzas-cifra__pie mb-0">Plata que se espera cobrar</p>
            </div>
          </div>
        </div>
        <!-- Deuda de clientes de dudoso cobro: ni se espera cobrar ni se da por perdida. Ámbar, no
             rojo. Una API vieja no manda la cifra y queda en "—". -->
        <div class="col-6 col-md-6 col-xl-3">
          <div class="card h-100 cobranzas-cifra cobranzas-cifra--warning">
            <div class="card-body py-3">
              <p class="cobranzas-cifra__rotulo mb-1">En stand-by</p>
              <p class="cobranzas-cifra__valor mb-0" :class="{ 'text-warning-emphasis': hay_valor(totales.en_espera) }">{{ format_por_moneda(totales.en_espera) }}</p>
              <p class="cobranzas-cifra__pie mb-0">Cobro dudoso, no se da por perdida</p>
            </div>
          </div>
        </div>
        <div class="col-12 col-md-6 col-xl-3">
          <div class="card h-100 cobranzas-cifra cobranzas-cifra--primary">
            <div class="card-body py-3">
              <p class="cobranzas-cifra__rotulo mb-1">A pagar a vendedores</p>
              <p class="cobranzas-cifra__valor mb-0" :class="{ 'text-primary': hay_valor(totales.a_pagar) }">{{ format_por_moneda(totales.a_pagar) }}</p>
              <p class="cobranzas-cifra__pie mb-0">Falta liberar {{ format_por_moneda(totales.por_liberar) }}</p>
            </div>
          </div>
        </div>
      </div>
      <p v-if="hay_filtros" class="text-muted small mb-2">
        Las cifras suman solo lo que muestra el filtro.
      </p>

      <p v-if="clientes_visibles.length === 0" class="text-muted small fst-italic mb-0">
        <span v-if="hay_filtros">Ninguna venta coincide con el filtro.</span>
        <span v-else>Todavía no hay ventas cargadas. Usá "Nueva venta" para dar de alta la primera.</span>
      </p>

      <!-- ============================================================ -->
      <!-- Tabla por cliente → por venta. La celda del cliente ocupa    -->
      <!-- todas las filas de sus ventas (rowspan). Click en cualquier  -->
      <!-- fila abre el cliente en su pestaña Ventas.                   -->
      <!-- ============================================================ -->
      <div v-else class="table-responsive cobranzas-tabla-wrap" :class="{ 'cobranzas-tabla-wrap--actualizando': loading }">
        <table class="table table-sm align-middle mb-0 cobranzas-tabla ventas-tabla">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Productos</th>
              <th class="text-nowrap">Fecha</th>
              <th class="text-end">Total</th>
              <th class="text-end">Cobrado</th>
              <th class="text-end">Pendiente</th>
              <th>Vendedor</th>
              <th class="text-end">%</th>
              <th class="text-end">Comisión</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="cliente in clientes_visibles" :key="cliente.client_id">
              <tr
                v-for="(venta, indice) in cliente.ventas_visibles"
                :key="venta.id"
                class="cobranzas-tabla__fila"
                :class="{ 'ventas-tabla__fila--primera': indice === 0 }"
                @click="abrir_cliente(cliente)"
              >
                <td v-if="indice === 0" :rowspan="cliente.ventas_visibles.length" class="ventas-tabla__cliente">
                  <span class="fw-semibold">{{ nombre_de_cliente(cliente) }}</span>
                  <!-- Cliente de dudoso cobro: su deuda está en stand-by (ámbar, no rojo). -->
                  <div v-if="es_cobro_dudoso(cliente)">
                    <span
                      class="badge text-bg-warning"
                      :title="titulo_cobro_dudoso(cliente)"
                    >Cobro dudoso</span>
                  </div>
                  <div v-if="cliente.ventas_visibles.length > 1" class="cobranzas-tabla__nota">{{ cliente.ventas_visibles.length }} ventas</div>
                </td>
                <td>
                  <div class="d-flex flex-wrap gap-1">
                    <span
                      v-for="producto in productos_de(venta)"
                      :key="producto.clave"
                      class="badge ventas-tabla__badge"
                      :class="clase_badge_producto(producto.clave)"
                    >
                      {{ producto.etiqueta }}
                    </span>
                  </div>
                  <div v-if="venta.descripcion" class="cobranzas-tabla__nota ventas-tabla__descripcion" :title="venta.descripcion">{{ venta.descripcion }}</div>
                </td>
                <td class="text-nowrap">{{ formatear_fecha(venta.fecha) }}</td>
                <td class="text-end text-nowrap">{{ format_monto_con_moneda(resumen_de(venta).total, venta.moneda) }}</td>
                <td class="text-end text-nowrap text-success">{{ format_monto_con_moneda(resumen_de(venta).cobrado, venta.moneda) }}</td>
                <td class="text-end text-nowrap" :class="clase_pendiente(cliente, venta)">
                  {{ format_monto_con_moneda(resumen_de(venta).pendiente, venta.moneda) }}
                </td>
                <td>
                  <span v-if="vendedor_de(venta)">{{ vendedor_de(venta) }}</span>
                  <span v-else class="text-muted">—</span>
                </td>
                <td class="text-end text-nowrap">
                  <template v-if="vendedor_de(venta) && comision_de(venta).porcentaje !== null">{{ comision_de(venta).porcentaje }} %</template>
                  <span v-else class="text-muted">—</span>
                </td>
                <td class="text-end text-nowrap ventas-tabla__comision">
                  <template v-if="vendedor_de(venta)">
                    <div>{{ format_monto_con_moneda(comision_de(venta).total, comision_de(venta).moneda) }}</div>
                    <div class="cobranzas-tabla__nota">
                      liberada {{ format_monto_con_moneda(comision_de(venta).liberada, comision_de(venta).moneda) }}
                      · pagada {{ format_monto_con_moneda(comision_de(venta).pagada, comision_de(venta).moneda) }}
                    </div>
                    <div class="fw-semibold" :class="comision_de(venta).a_pagar > 0 ? 'text-primary' : 'text-muted'">
                      a pagar {{ format_monto_con_moneda(comision_de(venta).a_pagar, comision_de(venta).moneda) }}
                    </div>
                  </template>
                  <span v-else class="text-muted">—</span>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ============================================================ -->
    <!-- "Nueva venta": primero se elige el cliente; después se abre  -->
    <!-- su modal en la pestaña Ventas con el formulario de alta.     -->
    <!-- ============================================================ -->
    <base-modal
      :show="elegir.show"
      title="Nueva venta · elegí el cliente"
      @update:show="elegir.show = $event"
      @close="elegir.show = false"
    >
      <div v-if="elegir.cargando" class="text-center py-4">
        <span class="spinner-border text-primary" role="status" aria-hidden="true" />
      </div>
      <template v-else>
        <div class="mb-2">
          <label class="form-label small">Buscar cliente</label>
          <input v-model="elegir.texto" type="search" class="form-control form-control-sm" placeholder="Escribí para filtrar…" />
        </div>
        <select v-model="elegir.client_id" class="form-select form-select-sm" size="8">
          <option v-for="cliente in clientes_para_elegir" :key="cliente.id" :value="cliente.id">{{ nombre_de_cliente(cliente) }}</option>
        </select>
        <p v-if="clientes_para_elegir.length === 0" class="text-muted small mt-1 mb-0">No hay clientes que coincidan con el filtro.</p>
      </template>
      <template #footer>
        <button type="button" class="btn btn-secondary" @click="elegir.show = false">Cancelar</button>
        <button type="button" class="btn btn-primary" :disabled="!elegir.client_id" @click="confirmar_cliente_elegido">Continuar</button>
      </template>
    </base-modal>

    <!-- Modal del cliente, abierto en Ventas. Al cerrarlo se recarga: adentro se pudieron crear,
         editar o cobrar ventas. -->
    <cliente-modal
      :show="modal_cliente.show"
      :cliente="modal_cliente.cliente"
      pestana_inicial="ventas"
      :abrir_nueva_venta="modal_cliente.nueva"
      @update:show="modal_cliente.show = $event"
      @close="on_modal_cliente_cerrado"
    />
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import BaseModal from '@/components/ui/BaseModal.vue'
import ClienteModal from '@/components/cobranzas/ClienteModal.vue'
import { formatear_fecha } from '@/components/cobranzas/meses'
import { format_monto_con_moneda, format_por_moneda } from '@/components/cobranzas/plata'
import {
  PRODUCTOS_ETIQUETAS_DEFAULT,
  clase_badge_producto,
  comision_de_venta,
  es_cobro_dudoso,
  nombre_de_cliente,
  nombre_de_vendedor,
  numero,
  productos_de_venta,
  resumen_de_venta,
  sumar_en_moneda,
} from '@/components/cobranzas/ventas'

/**
 * Cobranzas › Ventas (misión ventas-y-comisiones, 28/10/2026). Reemplaza a Cobranzas › Licencias.
 *
 * Una tabla por cliente → por venta: qué se vendió (badges), cuándo, el total, lo cobrado, lo que
 * debe el cliente, el vendedor, su % y la comisión (total · liberada · pagada · a pagar). Arriba,
 * las cifras por moneda: lo vendido, lo que deben los clientes y lo que hay que pagarles a los
 * vendedores.
 *
 * Clientes de dudoso cobro (misión cobro-dudoso-y-pagos-ventas, 30/10/2026): su deuda no cuenta
 * como plata a cobrar ("Deben los clientes" usa `resumen.por_cobrar`) sino que va a la cifra aparte
 * "En stand-by" (`resumen.en_espera`), y su saldo pendiente se pinta en ámbar, no en rojo. El
 * filtro "Con saldo pendiente" los sigue mostrando: siguen debiendo.
 *
 * Lee `GET cobranzas/ventas` → `{clientes: [{client_id, nombre, ventas, resumen_por_moneda}],
 * vendedores, productos}`. Los filtros (producto, con saldo pendiente, búsqueda por nombre) son
 * locales: la respuesta ya trae todas las ventas.
 *
 * Toda la gestión (alta, edición, cuotas, pagos) vive en la pestaña Ventas del cliente
 * (`components/client/ventas-tab/`): click en una fila abre el `ClienteModal` en esa pestaña, y
 * "Nueva venta" pide primero el cliente (`GET /client?for_select=1`, la lista completa pero en su
 * forma liviana `{id, name, company_name}`: el cliente al que se le vende por primera vez
 * todavía no figura en esta tabla) y lo abre con el formulario de alta.
 */
export default {
  name: 'ViewCobranzasVentas',
  components: { BaseModal, ClienteModal },
  data() {
    return {
      // true mientras se consulta el listado.
      loading: false,
      // true una vez que se cargó al menos una vez.
      cargado_alguna_vez: false,
      // Mensaje de error de la carga (null = sin error).
      load_error: null,
      // Filas tal como las devuelve el backend: `{client_id, nombre, ventas, resumen_por_moneda}`.
      clientes: [],
      // Admins vendedores `[{id, name}]` (para el nombre cuando la comisión no lo trae).
      vendedores: [],
      // Mapa `{clave: etiqueta}` de los productos.
      productos: Object.assign({}, PRODUCTOS_ETIQUETAS_DEFAULT),
      // Filtro por producto ('' = todos).
      filtro_producto: '',
      // Solo ventas a las que el cliente todavía les debe algo.
      solo_pendientes: false,
      // Filtro local por nombre del cliente.
      busqueda: '',
      // Selector de cliente de "Nueva venta".
      elegir: { show: false, cargando: false, texto: '', client_id: null, clientes: [] },
      // Estado del modal del cliente.
      modal_cliente: { show: false, cliente: null, nueva: false },
    }
  },
  computed: {
    /**
     * true si hay algún filtro activo (cambia el texto de las cifras y del vacío).
     * @returns {boolean}
     */
    hay_filtros() {
      return !!(this.filtro_producto || this.solo_pendientes || String(this.busqueda || '').trim())
    },
    /**
     * Clientes a mostrar, cada uno con `ventas_visibles` (las ventas que pasan los filtros). Los
     * que se quedan sin ventas visibles no aparecen. Orden: primero los que deben, por nombre.
     * @returns {Array<Object>}
     */
    clientes_visibles() {
      const self = this
      const termino = String(this.busqueda || '').trim().toLowerCase()
      const resultado = []
      this.clientes.forEach(function (cliente) {
        if (termino && nombre_de_cliente(cliente).toLowerCase().indexOf(termino) === -1) {
          return
        }
        const ventas = (Array.isArray(cliente.ventas) ? cliente.ventas : []).filter(function (venta) {
          if (self.filtro_producto && (!Array.isArray(venta.productos) || venta.productos.indexOf(self.filtro_producto) === -1)) {
            return false
          }
          if (self.solo_pendientes && resumen_de_venta(venta).pendiente <= 0) {
            return false
          }
          return true
        })
        if (ventas.length) {
          resultado.push(Object.assign({}, cliente, { ventas_visibles: ventas }))
        }
      })
      return resultado.sort(function (a, b) {
        const debe_a = self.prioridad_deuda(a)
        const debe_b = self.prioridad_deuda(b)
        if (debe_a !== debe_b) {
          return debe_a - debe_b
        }
        return nombre_de_cliente(a).localeCompare(nombre_de_cliente(b), 'es')
      })
    },
    /**
     * Cantidad de ventas que se ven.
     * @returns {number}
     */
    cantidad_ventas_visibles() {
      let cantidad = 0
      this.clientes_visibles.forEach(function (cliente) {
        cantidad += cliente.ventas_visibles.length
      })
      return cantidad
    },
    /**
     * Cifras de arriba, por moneda, sobre las ventas visibles: total, cobrado, pendiente del
     * cliente (con su corte en `por_cobrar` y `en_espera`); a pagar y por liberar de las
     * comisiones (solo ventas con vendedor).
     * @returns {Object<string, Object<string, number>>}
     */
    totales() {
      const acumulado = { total: {}, cobrado: {}, pendiente: {}, por_cobrar: {}, en_espera: {}, a_pagar: {}, por_liberar: {} }
      this.clientes_visibles.forEach(function (cliente) {
        cliente.ventas_visibles.forEach(function (venta) {
          const resumen = resumen_de_venta(venta)
          sumar_en_moneda(acumulado.total, venta.moneda, resumen.total)
          sumar_en_moneda(acumulado.cobrado, venta.moneda, resumen.cobrado)
          sumar_en_moneda(acumulado.pendiente, venta.moneda, resumen.pendiente)
          sumar_en_moneda(acumulado.por_cobrar, venta.moneda, resumen.por_cobrar)
          sumar_en_moneda(acumulado.en_espera, venta.moneda, resumen.en_espera)
          const comision = comision_de_venta(venta)
          if (comision.vendedor_admin_id) {
            sumar_en_moneda(acumulado.a_pagar, comision.moneda, comision.a_pagar)
            sumar_en_moneda(acumulado.por_liberar, comision.moneda, comision.por_liberar)
          }
        })
      })
      return acumulado
    },
    /**
     * Clientes del selector de "Nueva venta", filtrados por el texto.
     * @returns {Array<Object>}
     */
    clientes_para_elegir() {
      const termino = String(this.elegir.texto || '').trim().toLowerCase()
      return this.elegir.clientes.filter(function (cliente) {
        if (!termino) {
          return true
        }
        const texto = [cliente.company_name, cliente.name, cliente.business_name].join(' ').toLowerCase()
        return texto.indexOf(termino) !== -1
      })
    },
  },
  mounted() {
    this.cargar()
  },
  methods: {
    formatear_fecha,
    format_monto_con_moneda,
    format_por_moneda,
    clase_badge_producto,
    nombre_de_cliente,
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
     * GET cobranzas/ventas → clientes con sus ventas, vendedores y productos.
     */
    cargar() {
      const self = this
      self.loading = true
      self.load_error = null
      api
        .get('/cobranzas/ventas', { silent_error: true })
        .then(function (res) {
          const data = res.data || {}
          self.clientes = Array.isArray(data.clientes) ? data.clientes : []
          if (Array.isArray(data.vendedores)) {
            self.vendedores = data.vendedores
          }
          if (data.productos && typeof data.productos === 'object' && !Array.isArray(data.productos)) {
            self.productos = data.productos
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
     * true si algún valor del mapa por moneda es distinto de cero.
     * @param {Object<string, number>} por_moneda
     * @returns {boolean}
     */
    hay_valor(por_moneda) {
      return Object.keys(por_moneda || {}).some(function (moneda) {
        return numero(por_moneda[moneda]) > 0
      })
    },
    /**
     * Prioridad para ordenar: 0 = hay plata que se espera cobrar, 1 = solo debe en stand-by
     * (cobro dudoso), 2 = no debe nada.
     * @param {Object} cliente
     * @returns {number}
     */
    prioridad_deuda(cliente) {
      const ventas = cliente.ventas_visibles || []
      if (ventas.some(function (venta) { return resumen_de_venta(venta).por_cobrar > 0 })) {
        return 0
      }
      if (ventas.some(function (venta) { return resumen_de_venta(venta).pendiente > 0 })) {
        return 1
      }
      return 2
    },
    es_cobro_dudoso,
    /**
     * Clases de la celda "Pendiente": rojo si hay plata que se espera cobrar, ámbar si el
     * cliente es de dudoso cobro (su deuda está en stand-by), nada si no debe.
     * @param {Object} cliente
     * @param {Object} venta
     * @returns {Object}
     */
    clase_pendiente(cliente, venta) {
      const hay_deuda = resumen_de_venta(venta).pendiente > 0
      const dudoso = es_cobro_dudoso(cliente) || es_cobro_dudoso(venta)
      return {
        'text-danger fw-semibold': hay_deuda && !dudoso,
        'text-warning-emphasis fw-semibold': hay_deuda && dudoso,
      }
    },
    /**
     * Texto del tooltip de la etiqueta "Cobro dudoso": desde cuándo y por qué (si se cargó).
     * @param {Object} cliente
     * @returns {string}
     */
    titulo_cobro_dudoso(cliente) {
      let texto = 'Su deuda está en stand-by: no cuenta como plata a cobrar, pero no se da por perdida.'
      if (cliente.cobro_dudoso_desde) {
        texto += ' Desde ' + formatear_fecha(cliente.cobro_dudoso_desde) + '.'
      }
      if (cliente.cobro_dudoso_motivo) {
        texto += ' Motivo: ' + cliente.cobro_dudoso_motivo
      }
      return texto
    },
    /**
     * Productos de una venta con su etiqueta.
     * @param {Object} venta
     * @returns {Array<{clave: string, etiqueta: string}>}
     */
    productos_de(venta) {
      return productos_de_venta(venta, this.productos)
    },
    /**
     * `{total, cobrado, pendiente}` de una venta.
     * @param {Object} venta
     * @returns {Object}
     */
    resumen_de(venta) {
      return resumen_de_venta(venta)
    },
    /**
     * Comisión de una venta con defaults.
     * @param {Object} venta
     * @returns {Object}
     */
    comision_de(venta) {
      return comision_de_venta(venta)
    },
    /**
     * Nombre del vendedor de una venta ('' si no tiene).
     * @param {Object} venta
     * @returns {string}
     */
    vendedor_de(venta) {
      return nombre_de_vendedor(venta, this.vendedores)
    },
    /**
     * Click en una fila: abre el modal del cliente en Ventas.
     * @param {Object} cliente
     */
    abrir_cliente(cliente) {
      this.modal_cliente = {
        show: true,
        cliente: { id: cliente.client_id, company_name: nombre_de_cliente(cliente), name: cliente.name || '' },
        nueva: false,
      }
    },
    /**
     * "Nueva venta": abre el selector de cliente. La lista de clientes se pide una sola vez por
     * visita a la pantalla, por el camino liviano `GET /client?for_select=1` de
     * `ClientController::index_json` (solo id, name y company_name, sin las relaciones de
     * `withAll()`): para elegir un cliente no hace falta más.
     */
    abrir_elegir_cliente() {
      const self = this
      this.elegir.show = true
      this.elegir.texto = ''
      this.elegir.client_id = null
      if (this.elegir.clientes.length) {
        return
      }
      this.elegir.cargando = true
      api
        .get('/client', { params: { for_select: 1 }, silent_error: true })
        .then(function (res) {
          const modelos = (res.data && res.data.models) || []
          self.elegir.clientes = modelos.slice().sort(function (a, b) {
            return nombre_de_cliente(a).localeCompare(nombre_de_cliente(b), 'es')
          })
          self.elegir.cargando = false
        })
        .catch(function (error) {
          self.elegir.cargando = false
          self.avisar(resolve_error_message(error), 'danger')
        })
    },
    /**
     * Cliente elegido: se cierra el selector y se abre su modal en Ventas con el formulario de
     * alta ya abierto.
     */
    confirmar_cliente_elegido() {
      const self = this
      const elegido = this.elegir.clientes.find(function (cliente) {
        return cliente.id === self.elegir.client_id
      })
      if (!elegido) {
        return
      }
      this.elegir.show = false
      this.modal_cliente = {
        show: true,
        cliente: { id: elegido.id, name: elegido.name, company_name: elegido.company_name },
        nueva: true,
      }
    },
    /**
     * Se cerró el modal: se recarga, adentro pudieron cambiar ventas, cuotas o pagos.
     */
    on_modal_cliente_cerrado() {
      this.modal_cliente.show = false
      this.modal_cliente.nueva = false
      this.cargar()
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

/* Tarjetas de cifras: misma familia que Mensualidades (fondo y borde suaves por color). */
.cobranzas-cifra {
	border-radius: 0.75rem;
	border: 1px solid transparent;
}

.cobranzas-cifra--neutral {
	background-color: var(--bs-secondary-bg-subtle);
	border-color: var(--bs-secondary-border-subtle);
}

.cobranzas-cifra--danger {
	background-color: var(--bs-danger-bg-subtle);
	border-color: var(--bs-danger-border-subtle);
}

.cobranzas-cifra--warning {
	background-color: var(--bs-warning-bg-subtle);
	border-color: var(--bs-warning-border-subtle);
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

.cobranzas-tabla-wrap--actualizando {
	opacity: 0.6;
	transition: opacity 0.15s ease-out;
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

.cobranzas-tabla__fila {
	cursor: pointer;
}

.cobranzas-tabla__nota {
	font-size: 0.7rem;
	color: #8a8a8f;
}

/* Cada cliente arranca con una línea más marcada: separa los grupos de ventas. */
.ventas-tabla__fila--primera > td {
	border-top: 2px solid #dee2e6;
}

/* La celda del cliente (rowspan) arriba de todo y con un ancho mínimo legible. */
.ventas-tabla__cliente {
	vertical-align: top;
	min-width: 9rem;
}

.ventas-tabla__badge {
	font-weight: 500;
}

/* La descripción de un desarrollo puede ser larga: un renglón con puntos suspensivos. */
.ventas-tabla__descripcion {
	max-width: 16rem;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.ventas-tabla__comision {
	min-width: 11rem;
}

@media (max-width: 575.98px) {
	.cobranzas-cifra__valor {
		font-size: 1.1rem;
	}

	/* En teléfono los filtros ocupan el ancho: el select y la búsqueda se estiran. */
	.ventas-filtros {
		width: 100%;
	}

	.ventas-filtros > div:not(.form-check) {
		flex: 1 1 8rem;
	}
}
</style>
