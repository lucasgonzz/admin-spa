<template>
  <div class="p-3 ventas-tab">
    <!-- Sin cliente guardado todavía: no hay id al que pedirle las ventas -->
    <p v-if="!record || !record.id" class="text-muted small fst-italic mb-0">
      Guardá el cliente primero para gestionar sus ventas.
    </p>

    <div v-else-if="loading && !cargado_alguna_vez" class="text-center py-4">
      <span class="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true" />
      <p class="text-muted small mt-2 mb-0">Cargando ventas...</p>
    </div>

    <div v-else-if="load_error" class="alert alert-danger py-2 small mb-0">
      {{ load_error }}
    </div>

    <template v-else>
      <!-- ============================================================ -->
      <!-- Resumen del cliente, por moneda: lo vendido, lo cobrado, lo  -->
      <!-- que debe, y lo que le toca al vendedor (total y a pagar).    -->
      <!-- ============================================================ -->
      <div class="row g-2 g-md-3 mb-3" :class="{ 'ventas-tab--actualizando': loading }">
        <div class="col-12 col-lg-6">
          <div class="card h-100 border-0 ventas-panel">
            <div class="card-body">
              <p class="ventas-panel__titulo mb-2">Lo que compró</p>
              <div class="row g-2">
                <div class="col-4">
                  <div class="text-muted small">Total</div>
                  <div class="fw-semibold">{{ format_por_moneda(totales.total) }}</div>
                </div>
                <div class="col-4">
                  <div class="text-muted small">Cobrado</div>
                  <div class="fw-semibold text-success">{{ format_por_moneda(totales.cobrado) }}</div>
                </div>
                <div class="col-4">
                  <div class="text-muted small">Debe</div>
                  <div class="fw-semibold" :class="{ 'text-danger': hay_valor(totales.pendiente) }">{{ format_por_moneda(totales.pendiente) }}</div>
                </div>
              </div>
              <p class="text-muted small mb-0 mt-2">
                {{ ventas.length }} {{ ventas.length === 1 ? 'venta' : 'ventas' }}
                <template v-if="cuotas_sin_venta.length"> · {{ cuotas_sin_venta.length }} {{ cuotas_sin_venta.length === 1 ? 'cuota suelta' : 'cuotas sueltas' }}</template>
              </p>
            </div>
          </div>
        </div>
        <div class="col-12 col-lg-6">
          <div class="card h-100 border-0 ventas-panel">
            <div class="card-body">
              <p class="ventas-panel__titulo mb-2">Comisiones de vendedores</p>
              <div class="row g-2">
                <div class="col-4">
                  <div class="text-muted small">Total</div>
                  <div class="fw-semibold">{{ format_por_moneda(totales.comision) }}</div>
                </div>
                <div class="col-4">
                  <div class="text-muted small">Pagada</div>
                  <div class="fw-semibold">{{ format_por_moneda(totales.comision_pagada) }}</div>
                </div>
                <div class="col-4">
                  <div class="text-muted small">A pagar</div>
                  <div class="fw-semibold" :class="{ 'text-primary': hay_valor(totales.comision_a_pagar) }">{{ format_por_moneda(totales.comision_a_pagar) }}</div>
                </div>
              </div>
              <p class="text-muted small mb-0 mt-2">
                La comisión se libera a medida que paga el cliente.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Acciones de la pestaña -->
      <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
        <strong class="small">Ventas</strong>
        <div class="ms-auto d-flex flex-wrap gap-2">
          <button
            v-if="!ventas.length && !cuotas_sin_venta.length"
            type="button"
            class="btn btn-outline-primary btn-sm"
            :disabled="generando"
            title="Arma la venta y sus cuotas con lo que dice el contrato del cliente"
            @click="generar_desde_contrato"
          >
            {{ generando ? 'Generando...' : 'Generar cuotas desde el contrato' }}
          </button>
          <button type="button" class="btn btn-primary btn-sm" @click="alternar_nueva">
            <i v-if="!nueva_abierta" class="bi bi-plus-lg me-1"></i>
            {{ nueva_abierta ? 'Cancelar' : 'Nueva venta' }}
          </button>
        </div>
      </div>

      <nueva-venta-form
        v-if="nueva_abierta"
        :client_id="record.id"
        :productos="productos"
        :precios="precios"
        :vendedores="vendedores"
        :vendedor_por_defecto="vendedor_por_defecto"
        :es_suscripcion="es_suscripcion"
        @creada="on_venta_creada"
        @cancelar="nueva_abierta = false"
      />

      <p v-if="!ventas.length && !cuotas_sin_venta.length" class="text-muted small mb-0">
        Este cliente no tiene ventas cargadas.
      </p>

      <venta-card
        v-for="venta in ventas"
        :key="venta.id"
        :client_id="record.id"
        :venta="venta"
        :productos="productos"
        :vendedores="vendedores"
        @lista="aplicar_respuesta"
        @cambio="cargar"
      />

      <!-- ============================================================ -->
      <!-- Cuotas que todavía no pertenecen a ninguna venta (las de     -->
      <!-- antes de la migración, o las cargadas por la ruta vieja).    -->
      <!-- Se gestionan igual; no suman comisión porque no tienen venta.-->
      <!-- ============================================================ -->
      <div v-if="cuotas_sin_venta.length" class="mt-3">
        <p class="small fw-semibold mb-1">Cuotas sin venta</p>
        <p class="text-muted small mb-2">
          Cuotas cargadas antes de que existieran las ventas. Se cobran igual, pero no generan comisión.
        </p>
        <cuotas-tabla
          :client_id="record.id"
          :cuotas="cuotas_sin_venta"
          @cambio="cargar"
        />
      </div>
    </template>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import CuotasTabla from './CuotasTabla.vue'
import NuevaVentaForm from './NuevaVentaForm.vue'
import VentaCard from './VentaCard.vue'
import { format_por_moneda } from '@/components/cobranzas/plata'
import {
  COMISION_PORCENTAJE_DEFAULT,
  PRODUCTOS_ETIQUETAS_DEFAULT,
  comision_de_venta,
  numero,
  resumen_de_venta,
  sumar_en_moneda,
} from '@/components/cobranzas/ventas'

/**
 * Pestaña "Ventas" del cliente (misión ventas-y-comisiones, 28/10/2026). Reemplaza a la pestaña
 * "Licencias".
 *
 * Las licencias pasaron a ser ventas: cada cosa que se le vendió al cliente (el sistema, el
 * e-commerce, los agentes, un desarrollo a medida, otra cosa) con sus cuotas y con la comisión de
 * quien la vendió. Esta pestaña es el orquestador:
 *
 * - lee `GET client/{id}/ventas` → `{ventas, cuotas_sin_venta, vendedores, productos, precios,
 *   porcentaje_por_defecto, vendedor_por_defecto}`;
 * - arriba muestra el resumen por moneda (lo que compró, cobrado, lo que debe; y la comisión);
 * - `NuevaVentaForm` es el alta manual; `VentaCard`, cada venta con sus cuotas; `CuotasTabla`
 *   (también adentro de cada venta) gestiona cuotas sueltas;
 * - "Generar cuotas desde el contrato" sigue (ruta vieja `licencias/desde-contrato`): desde esta
 *   misión, además de las cuotas, la API arma la venta con su vendedor y su comisión.
 *
 * Cualquier cambio de un hijo vuelve acá: con la lista entera si la respuesta la trae (`lista`),
 * o pidiendo de nuevo el GET (`cambio`), porque un pago de una cuota cambia lo cobrado de la
 * venta y, con eso, la comisión liberada.
 *
 * Igual que las demás pestañas de plata, del `record` solo usa `id`, `name` y `company_name`: la
 * abren tanto el modal genérico de Clientes como el modal chico del módulo Cobranzas.
 */
export default {
  name: 'ClientVentasTab',
  components: { CuotasTabla, NuevaVentaForm, VentaCard },
  props: {
    /** Cliente abierto en el modal. */
    record: { type: Object, default: null },
    /** Si es true, la pestaña abre el formulario "Nueva venta" apenas carga (botón "Nueva venta" de Cobranzas › Ventas). */
    abrir_nueva: { type: Boolean, default: false },
  },
  data() {
    return {
      // true mientras se consulta el GET.
      loading: false,
      // true una vez que cargó al menos una vez (las recargas no tapan la pestaña con el spinner).
      cargado_alguna_vez: false,
      // Mensaje de error de la carga (null = sin error).
      load_error: null,
      // Ventas del cliente, cada una con sus cuotas, su resumen y su comisión.
      ventas: [],
      // Cuotas del cliente que no pertenecen a ninguna venta.
      cuotas_sin_venta: [],
      // Admins vendedores: `[{id, name}]`.
      vendedores: [],
      // Mapa `{clave: etiqueta}` de los productos vendibles.
      productos: Object.assign({}, PRODUCTOS_ETIQUETAS_DEFAULT),
      // Precios de lista: `{gestion, ecommerce, agentes, los_tres, contado_descuento}`.
      precios: {},
      // % de comisión por defecto del cliente según la API (30 si está en Suscripción).
      porcentaje_por_defecto: COMISION_PORCENTAJE_DEFAULT,
      // id del vendedor por defecto (el único "Es vendedor"), o null.
      vendedor_por_defecto: null,
      // true si el contrato del cliente está en Suscripción (ver `aplicar_respuesta`).
      es_suscripcion: false,
      // true con el formulario "Nueva venta" abierto.
      nueva_abierta: false,
      // true mientras corre el POST desde-contrato.
      generando: false,
    }
  },
  computed: {
    /**
     * Totales del cliente por moneda, sumando lo que ya vino calculado en cada venta y en las
     * cuotas sueltas: total, cobrado y pendiente del cliente; comisión total, pagada y a pagar.
     * @returns {Object<string, Object<string, number>>}
     */
    totales() {
      const acumulado = { total: {}, cobrado: {}, pendiente: {}, comision: {}, comision_pagada: {}, comision_a_pagar: {} }
      this.ventas.forEach(function (venta) {
        const resumen = resumen_de_venta(venta)
        sumar_en_moneda(acumulado.total, venta.moneda, resumen.total)
        sumar_en_moneda(acumulado.cobrado, venta.moneda, resumen.cobrado)
        sumar_en_moneda(acumulado.pendiente, venta.moneda, resumen.pendiente)
        const comision = comision_de_venta(venta)
        if (comision.vendedor_admin_id) {
          sumar_en_moneda(acumulado.comision, comision.moneda, comision.total)
          sumar_en_moneda(acumulado.comision_pagada, comision.moneda, comision.pagada)
          sumar_en_moneda(acumulado.comision_a_pagar, comision.moneda, comision.a_pagar)
        }
      })
      /* Las cuotas sueltas también son plata que el cliente debe (o pagó). Pueden venir en
         monedas distintas, así que se suman de a una, cada una con su moneda (se la pasa como
         una "venta" de una sola cuota para reusar el mismo criterio de cobrado). */
      this.cuotas_sin_venta.forEach(function (cuota) {
        const una = resumen_de_venta({ cuotas: [cuota] })
        sumar_en_moneda(acumulado.total, cuota.moneda, una.total)
        sumar_en_moneda(acumulado.cobrado, cuota.moneda, una.cobrado)
        sumar_en_moneda(acumulado.pendiente, cuota.moneda, una.pendiente)
      })
      return acumulado
    },
  },
  watch: {
    /** Si cambia el cliente abierto, se recarga todo desde cero. */
    'record.id': function (new_id, old_id) {
      if (new_id && new_id !== old_id) {
        this.nueva_abierta = false
        this.cargado_alguna_vez = false
        this.cargar()
      }
    },
  },
  mounted() {
    this.cargar()
  },
  methods: {
    format_por_moneda,
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
     * GET client/{id}/ventas. La primera vez abre "Nueva venta" si el padre lo pidió.
     */
    cargar() {
      const self = this
      if (!this.record || !this.record.id) {
        return
      }
      const client_id = this.record.id
      const primera_vez = !this.cargado_alguna_vez
      self.loading = true
      self.load_error = null
      api
        .get('/client/' + client_id + '/ventas', { silent_error: true })
        .then(function (res) {
          self.loading = false
          if (!self.record || self.record.id !== client_id) {
            return
          }
          self.aplicar_respuesta(res.data || {})
          self.cargado_alguna_vez = true
          if (primera_vez && self.abrir_nueva) {
            self.nueva_abierta = true
          }
        })
        .catch(function (error) {
          self.loading = false
          self.load_error = resolve_error_message(error)
        })
    },
    /**
     * Vuelca cualquier respuesta con la forma del GET (el GET, el alta, la edición, el alta de
     * cuota). Lo que no venga en la respuesta se deja como estaba.
     *
     * `es_suscripcion`: la API manda el `porcentaje_por_defecto` del cliente (30 si su contrato
     * está en Suscripción). Si además manda `es_suscripcion` explícito se usa ese; si no, se
     * deduce del porcentaje: más que el default = Suscripción.
     * @param {Object} data
     */
    aplicar_respuesta(data) {
      if (Array.isArray(data.ventas)) {
        this.ventas = data.ventas
      }
      if (Array.isArray(data.cuotas_sin_venta)) {
        this.cuotas_sin_venta = data.cuotas_sin_venta
      }
      if (Array.isArray(data.vendedores)) {
        this.vendedores = data.vendedores
      }
      if (data.productos && typeof data.productos === 'object' && !Array.isArray(data.productos)) {
        this.productos = data.productos
      }
      if (data.precios && typeof data.precios === 'object') {
        this.precios = data.precios
      }
      if (data.porcentaje_por_defecto !== undefined && data.porcentaje_por_defecto !== null) {
        this.porcentaje_por_defecto = numero(data.porcentaje_por_defecto)
      }
      if (data.vendedor_por_defecto !== undefined) {
        this.vendedor_por_defecto = data.vendedor_por_defecto
      }
      if (typeof data.es_suscripcion === 'boolean') {
        this.es_suscripcion = data.es_suscripcion
      } else {
        this.es_suscripcion = this.porcentaje_por_defecto > COMISION_PORCENTAJE_DEFAULT
      }
    },
    /**
     * Abre o cierra el formulario "Nueva venta".
     */
    alternar_nueva() {
      this.nueva_abierta = !this.nueva_abierta
    },
    /**
     * La venta se creó: se cierra el formulario y se usa la lista que devolvió el POST (o se
     * recarga si no vino).
     * @param {Object} data
     */
    on_venta_creada(data) {
      this.nueva_abierta = false
      if (data && Array.isArray(data.ventas)) {
        this.aplicar_respuesta(data)
      } else {
        this.cargar()
      }
    },
    /**
     * POST client/{id}/licencias/desde-contrato: una cuota por fila de financiación del contrato,
     * o una sola con el precio de licencia, y (desde esta misión) la venta que las agrupa. La API
     * contesta 422 si ya hay cuotas o si el contrato no tiene precio; el mensaje va al toast.
     * Lo que devuelve es la forma vieja (cuotas sueltas), así que después se recarga.
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
          self.avisar('Se generaron ' + (data.creadas || 0) + ' cuotas desde el contrato.')
          self.cargar()
        })
        .catch(function (error) {
          self.generando = false
          self.avisar(resolve_error_message(error), 'danger')
        })
    },
  },
}
</script>

<style scoped lang="scss">
/* Misma familia visual que las pestañas Tokens y Mensualidad: paneles claros sin borde pesado. */
.ventas-panel {
	background: #f7f7f8;
	border-radius: 0.75rem;
}

.ventas-panel__titulo {
	font-size: 0.75rem;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: #6c757d;
	font-weight: 600;
}

/* Mientras se recarga después de un cambio, las cifras se atenúan en vez de desaparecer. */
.ventas-tab--actualizando {
	opacity: 0.6;
	transition: opacity 0.15s ease-out;
}
</style>
