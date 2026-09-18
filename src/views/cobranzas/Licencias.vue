<template>
  <div class="container-fluid px-0 py-4 cobranzas-vista">
    <!-- Encabezado -->
    <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
      <div>
        <h2 class="h4 mb-0">Licencias</h2>
        <p class="text-muted small mb-0 mt-1">
          Las cuotas de la licencia de cada cliente, mes a mes: verde pagada, amarillo pago parcial, rojo pendiente.
        </p>
      </div>

      <div class="d-flex flex-wrap align-items-end gap-3">
        <div class="form-check mb-1">
          <input id="licencias-mostrar-sin-cuotas" v-model="mostrar_sin_cuotas" class="form-check-input" type="checkbox" />
          <label class="form-check-label small" for="licencias-mostrar-sin-cuotas">Mostrar clientes sin cuotas</label>
        </div>
        <div>
          <label class="form-label small text-muted mb-1 d-block">Orden</label>
          <select v-model="orden" class="form-select form-select-sm">
            <option value="pendientes">Pendientes primero</option>
            <option value="carga">Orden de carga</option>
          </select>
        </div>
        <div>
          <label class="form-label small text-muted mb-1 d-block">Buscar</label>
          <input v-model="busqueda" type="search" class="form-control form-control-sm" placeholder="Cliente" />
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
      <p class="text-muted mt-2">Cargando licencias...</p>
    </div>

    <!-- Error de carga -->
    <div v-else-if="load_error" class="alert alert-danger">
      {{ load_error }}
    </div>

    <div v-else>
      <!-- Totales de toda la cartera, por moneda -->
      <div class="row g-2 g-md-3 mb-3">
        <div class="col-12 col-md-4">
          <div class="card h-100 border-0 cobranzas-cifra">
            <div class="card-body py-3">
              <p class="cobranzas-cifra__rotulo mb-1">Total en cuotas</p>
              <p class="cobranzas-cifra__valor mb-0">{{ format_por_moneda(totales.total) }}</p>
              <p class="cobranzas-cifra__pie mb-0">{{ clientes_con_cuotas.length }} {{ clientes_con_cuotas.length === 1 ? 'cliente con cuotas' : 'clientes con cuotas' }}</p>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-4">
          <div class="card h-100 border-0 cobranzas-cifra">
            <div class="card-body py-3">
              <p class="cobranzas-cifra__rotulo mb-1">Cobrado</p>
              <p class="cobranzas-cifra__valor mb-0 text-success">{{ format_por_moneda(totales.pagado) }}</p>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-4">
          <div class="card h-100 border-0 cobranzas-cifra">
            <div class="card-body py-3">
              <p class="cobranzas-cifra__rotulo mb-1">Pendiente</p>
              <p class="cobranzas-cifra__valor mb-0" :class="{ 'text-danger': hay_pendiente }">{{ format_por_moneda(totales.pendiente) }}</p>
              <p class="cobranzas-cifra__pie mb-0">{{ totales.cuotas_pendientes }} pendientes · {{ totales.cuotas_parciales }} parciales</p>
            </div>
          </div>
        </div>
      </div>

      <p v-if="clientes_visibles.length === 0" class="text-muted small fst-italic mb-0">
        <span v-if="busqueda">Ningún cliente coincide con la búsqueda.</span>
        <span v-else-if="!mostrar_sin_cuotas">Ningún cliente tiene cuotas de licencia cargadas. Marcá "Mostrar clientes sin cuotas" para verlos todos.</span>
        <span v-else>No hay clientes cargados.</span>
      </p>

      <!-- ============================================================ -->
      <!-- Tabla estilo Excel: una columna por mes del rango, con el    -->
      <!-- monto de la cuota de ese mes pintado según su estado.        -->
      <!-- ============================================================ -->
      <div v-else class="table-responsive cobranzas-tabla-wrap" :class="{ 'cobranzas-tabla-wrap--actualizando': loading }">
        <table class="table table-sm table-hover align-middle mb-0 cobranzas-tabla">
          <thead>
            <tr>
              <th>Cliente</th>
              <th class="text-nowrap">Ingreso</th>
              <th class="text-end">Cuotas</th>
              <th class="text-end text-nowrap">Total</th>
              <th class="text-end text-nowrap">Pagado</th>
              <th class="text-end text-nowrap">Pendiente</th>
              <th v-for="mes in meses_del_rango" :key="'th-' + mes" class="text-center text-nowrap" :class="{ 'cobranzas-tabla__ref': mes === mes_corriente_actual }">
                {{ etiqueta_corta(mes) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="cliente in clientes_visibles"
              :key="cliente.id"
              :class="clase_fila(cliente)"
              class="cobranzas-tabla__fila"
              @click="abrir_cliente(cliente)"
            >
              <td>
                <span class="fw-semibold">{{ cliente.nombre || 'Cliente #' + cliente.id }}</span>
                <div v-if="cliente.name && cliente.name !== cliente.nombre" class="cobranzas-tabla__nota">{{ cliente.name }}</div>
              </td>
              <td class="text-nowrap">{{ cliente.mensualidad_inicio ? etiqueta_corta(cliente.mensualidad_inicio) : '—' }}</td>
              <td class="text-end">{{ cliente.cuotas ? cliente.cuotas.length : 0 }}</td>
              <td class="text-end text-nowrap">{{ format_por_moneda(resumen_de(cliente).total_por_moneda) }}</td>
              <td class="text-end text-nowrap">{{ format_por_moneda(resumen_de(cliente).pagado_por_moneda) }}</td>
              <td class="text-end text-nowrap" :class="{ 'text-danger fw-semibold': tiene_pendiente(cliente) }">
                {{ format_por_moneda(resumen_de(cliente).pendiente_por_moneda) }}
              </td>
              <td
                v-for="mes in meses_del_rango"
                :key="cliente.id + '-' + mes"
                class="text-center text-nowrap cobranzas-celda-mes"
                :class="clase_celda(cliente, mes)"
              >
                <template v-for="cuota in cuotas_del_mes(cliente, mes)" :key="cuota.id">
                  <span class="d-block" :title="titulo_cuota(cuota)">{{ format_numero(cuota.monto) }}</span>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal del cliente, abierto en Licencias. Al cerrarlo se recarga: adentro se pudieron
         agregar, pagar o editar cuotas. -->
    <cliente-modal
      :show="modal_cliente.show"
      :cliente="modal_cliente.cliente"
      pestana_inicial="licencias"
      @update:show="modal_cliente.show = $event"
      @close="on_modal_cliente_cerrado"
    />
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import ClienteModal from '@/components/cobranzas/ClienteModal.vue'
import { etiqueta_corta, etiqueta_larga, formatear_fecha, lista_de_meses, mes_corriente } from '@/components/cobranzas/meses'
import { format_numero, format_monto_con_moneda, format_por_moneda } from '@/components/cobranzas/plata'

/**
 * Cobranzas › Licencias (misión modulo-cobranzas, 18/9/2026).
 *
 * La hoja LICENCIAS de la planilla de Lucas: un renglón por cliente, una columna por mes, y en
 * cada celda el monto de la cuota que vence ese mes pintado según cómo está (verde pagada,
 * amarillo parcial, rojo pendiente). Lee `GET cobranzas/licencias`, que trae todos los clientes
 * con sus cuotas y su resumen por moneda; por defecto se muestran solo los que tienen cuotas.
 *
 * El orden y la búsqueda son locales y no se guardan: acá no hay selección de meses que
 * recordar, el rango lo da el backend con las cuotas que existen.
 */
export default {
  name: 'ViewCobranzasLicencias',
  components: { ClienteModal },
  data() {
    return {
      // true mientras se consulta el listado.
      loading: false,
      // true una vez que se cargó al menos una vez.
      cargado_alguna_vez: false,
      // Mensaje de error de la carga (null = sin error).
      load_error: null,
      // Filas tal como las devuelve el backend: `{id, nombre, name, company_name, mensualidad_inicio, cuotas, resumen}`.
      clientes: [],
      // Rango de meses de las columnas: `{desde, hasta}` del backend (min/max de las cuotas).
      rango: { desde: '', hasta: '' },
      // Mes corriente, para marcar vencida una cuota pendiente de un mes pasado.
      mes_corriente_actual: mes_corriente(),
      // Si se muestran también los clientes sin cuotas (default: solo los que tienen).
      mostrar_sin_cuotas: false,
      // Orden: `pendientes` (default) | `carga`.
      orden: 'pendientes',
      // Filtro local por nombre.
      busqueda: '',
      // Estado del modal del cliente.
      modal_cliente: { show: false, cliente: null },
    }
  },
  computed: {
    /**
     * Columnas de la tabla: cada mes entre `rango.desde` y `rango.hasta`. Sin rango (no hay
     * cuotas todavía), el mes corriente solo.
     * @returns {string[]}
     */
    meses_del_rango() {
      const desde = this.rango.desde || this.mes_corriente_actual
      const hasta = this.rango.hasta || this.mes_corriente_actual
      const meses = lista_de_meses(desde, hasta)
      return meses.length ? meses : [this.mes_corriente_actual]
    },
    /**
     * Clientes que tienen al menos una cuota.
     * @returns {Array<Object>}
     */
    clientes_con_cuotas() {
      return this.clientes.filter(function (cliente) {
        return Array.isArray(cliente.cuotas) && cliente.cuotas.length > 0
      })
    },
    /**
     * Filas visibles: con o sin cuotas según el checkbox, filtradas por nombre y ordenadas.
     * @returns {Array<Object>}
     */
    clientes_visibles() {
      const self = this
      const termino = String(this.busqueda || '').trim().toLowerCase()
      const base = this.mostrar_sin_cuotas ? this.clientes : this.clientes_con_cuotas
      const filtrados = base.filter(function (cliente) {
        if (!termino) {
          return true
        }
        const texto = [cliente.nombre, cliente.name, cliente.company_name].join(' ').toLowerCase()
        return texto.indexOf(termino) !== -1
      })
      return filtrados.slice().sort(function (a, b) {
        const rango_a = self.rango_de_orden(a)
        const rango_b = self.rango_de_orden(b)
        if (rango_a !== rango_b) {
          return rango_a - rango_b
        }
        return Number(a.id) - Number(b.id)
      })
    },
    /**
     * Totales de toda la cartera, sumando los resúmenes por moneda de cada cliente.
     * @returns {{total: Object, pagado: Object, pendiente: Object, cuotas_pendientes: number, cuotas_parciales: number}}
     */
    totales() {
      const self = this
      const acumulado = { total: {}, pagado: {}, pendiente: {}, cuotas_pendientes: 0, cuotas_parciales: 0 }
      const sumar = function (destino, origen) {
        Object.keys(origen || {}).forEach(function (moneda) {
          destino[moneda] = Number(destino[moneda] || 0) + Number(origen[moneda] || 0)
        })
      }
      this.clientes.forEach(function (cliente) {
        const resumen = self.resumen_de(cliente)
        sumar(acumulado.total, resumen.total_por_moneda)
        sumar(acumulado.pagado, resumen.pagado_por_moneda)
        sumar(acumulado.pendiente, resumen.pendiente_por_moneda)
        acumulado.cuotas_pendientes += Number(resumen.pendientes || 0)
        acumulado.cuotas_parciales += Number(resumen.parciales || 0)
      })
      return acumulado
    },
    /**
     * true si queda algo pendiente en alguna moneda.
     * @returns {boolean}
     */
    hay_pendiente() {
      const pendiente = this.totales.pendiente
      return Object.keys(pendiente).some(function (moneda) {
        return Number(pendiente[moneda] || 0) > 0
      })
    },
  },
  mounted() {
    this.cargar()
  },
  methods: {
    etiqueta_corta,
    etiqueta_larga,
    formatear_fecha,
    format_numero,
    format_por_moneda,
    /**
     * GET cobranzas/licencias → todos los clientes con sus cuotas y el rango de meses.
     */
    cargar() {
      const self = this
      self.loading = true
      self.load_error = null
      api
        .get('/cobranzas/licencias', { silent_error: true })
        .then(function (res) {
          const data = res.data || {}
          self.clientes = Array.isArray(data.clientes) ? data.clientes : []
          if (data.rango) {
            self.rango = { desde: data.rango.desde || '', hasta: data.rango.hasta || '' }
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
     * Resumen del cliente con defaults, para no chequear null en cada celda.
     * @param {Object} cliente
     * @returns {Object}
     */
    resumen_de(cliente) {
      const resumen = (cliente && cliente.resumen) || {}
      return {
        cantidad: resumen.cantidad || 0,
        total_por_moneda: resumen.total_por_moneda || {},
        pagado_por_moneda: resumen.pagado_por_moneda || {},
        pendiente_por_moneda: resumen.pendiente_por_moneda || {},
        pendientes: resumen.pendientes || 0,
        parciales: resumen.parciales || 0,
      }
    },
    /**
     * Cuotas del cliente que caen en un mes (normalmente una, pero puede haber más).
     * @param {Object} cliente
     * @param {string} mes `YYYY-MM`
     * @returns {Array<Object>}
     */
    cuotas_del_mes(cliente, mes) {
      if (!cliente || !Array.isArray(cliente.cuotas)) {
        return []
      }
      return cliente.cuotas.filter(function (cuota) {
        return String(cuota.periodo || '').slice(0, 7) === mes
      })
    },
    /**
     * true si el cliente tiene alguna cuota pendiente de un mes ya pasado.
     * @param {Object} cliente
     * @returns {boolean}
     */
    tiene_vencida(cliente) {
      const self = this
      return (cliente.cuotas || []).some(function (cuota) {
        return cuota.estado === 'pendiente' && String(cuota.periodo || '').slice(0, 7) < self.mes_corriente_actual
      })
    },
    /**
     * true si el cliente tiene alguna cuota parcial.
     * @param {Object} cliente
     * @returns {boolean}
     */
    tiene_parcial(cliente) {
      return (cliente.cuotas || []).some(function (cuota) {
        return cuota.estado === 'parcial'
      })
    },
    /**
     * true si el cliente tiene alguna cuota pendiente (vencida o no).
     * @param {Object} cliente
     * @returns {boolean}
     */
    tiene_pendiente(cliente) {
      return (cliente.cuotas || []).some(function (cuota) {
        return cuota.estado === 'pendiente' || cuota.estado === 'parcial'
      })
    },
    /**
     * Rango de la fila para el orden `pendientes`: con vencidas 0, con parciales 1, con
     * pendientes a futuro 2, al día 3, sin cuotas 4. En `carga` todos iguales (queda el id).
     * @param {Object} cliente
     * @returns {number}
     */
    rango_de_orden(cliente) {
      if (this.orden === 'carga') {
        return 0
      }
      if (!Array.isArray(cliente.cuotas) || cliente.cuotas.length === 0) {
        return 4
      }
      if (this.tiene_vencida(cliente)) {
        return 0
      }
      if (this.tiene_parcial(cliente)) {
        return 1
      }
      if (this.tiene_pendiente(cliente)) {
        return 2
      }
      return 3
    },
    /**
     * Color de la fila: rojo con alguna pendiente vencida, amarillo con parciales, nada al día.
     * @param {Object} cliente
     * @returns {string}
     */
    clase_fila(cliente) {
      if (this.tiene_vencida(cliente)) {
        return 'table-danger'
      }
      if (this.tiene_parcial(cliente)) {
        return 'table-warning'
      }
      return ''
    },
    /**
     * Color de la celda de un mes según la cuota que cae ahí: verde pagada, rojo pendiente,
     * amarillo parcial; sin cuota, nada. Con más de una cuota manda la peor.
     * @param {Object} cliente
     * @param {string} mes
     * @returns {string}
     */
    clase_celda(cliente, mes) {
      const cuotas = this.cuotas_del_mes(cliente, mes)
      if (!cuotas.length) {
        return ''
      }
      const estados = cuotas.map(function (cuota) {
        return cuota.estado
      })
      if (estados.indexOf('pendiente') !== -1) {
        return 'cobranzas-celda-mes--pendiente'
      }
      if (estados.indexOf('parcial') !== -1) {
        return 'cobranzas-celda-mes--parcial'
      }
      return 'cobranzas-celda-mes--pagada'
    },
    /**
     * Tooltip de una cuota en su celda.
     * @param {Object} cuota
     * @returns {string}
     */
    titulo_cuota(cuota) {
      const partes = ['Cuota ' + cuota.numero + ': ' + format_monto_con_moneda(cuota.monto, cuota.moneda)]
      if (cuota.estado === 'pagada') {
        partes.push('pagada' + (cuota.fecha_pago ? ' el ' + formatear_fecha(cuota.fecha_pago) : ''))
      } else if (cuota.estado === 'parcial') {
        partes.push('pagado ' + format_monto_con_moneda(cuota.monto_pagado, cuota.moneda) + ', faltan ' + format_monto_con_moneda(Number(cuota.monto || 0) - Number(cuota.monto_pagado || 0), cuota.moneda))
      } else {
        partes.push('pendiente' + (cuota.vencimiento ? ', vence ' + formatear_fecha(cuota.vencimiento) : ''))
      }
      if (cuota.observacion) {
        partes.push(String(cuota.observacion))
      }
      return partes.join(' · ')
    },
    /**
     * Click en la fila: abre el modal del cliente en Licencias.
     * @param {Object} cliente
     */
    abrir_cliente(cliente) {
      this.modal_cliente = {
        show: true,
        cliente: { id: cliente.id, name: cliente.name, company_name: cliente.company_name },
      }
    },
    /**
     * Se cerró el modal: se recarga, adentro pudieron cambiar las cuotas.
     */
    on_modal_cliente_cerrado() {
      this.modal_cliente.show = false
      this.cargar()
    },
  },
}
</script>

<style scoped>
/* Ver el comentario equivalente en Mensualidades.vue: el gutter de los .row. */
.cobranzas-vista {
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}

.cobranzas-cifra {
  background: #f7f7f8;
  border-radius: 0.75rem;
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

.cobranzas-tabla-wrap {
  border: 1px solid #ededf0;
  border-radius: 0.75rem;
}

.cobranzas-tabla-wrap--actualizando {
  opacity: 0.6;
  transition: opacity 0.15s ease-out;
}

.cobranzas-tabla th {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #8a8a8f;
  font-weight: 600;
  border-bottom-width: 1px;
  white-space: nowrap;
}

.cobranzas-tabla td {
  font-size: 0.875rem;
}

.cobranzas-tabla__fila {
  cursor: pointer;
}

.cobranzas-tabla__ref {
  background-color: rgba(0, 0, 0, 0.03);
}

.cobranzas-tabla__nota {
  font-size: 0.7rem;
  color: #8a8a8f;
}

/* Celdas de mes con los colores de Bootstrap para las tablas, pero aplicados a la celda y no a
   la fila: acá cada mes tiene su propio estado. `--bs-table-bg` es lo que usa `table-*`, así
   el color pisa el de la fila (que también se pinta) sin pelearse con él. */
.cobranzas-celda-mes {
  min-width: 4.25rem;
}

.cobranzas-celda-mes--pagada {
  --bs-table-bg: #d1e7dd;
  --bs-table-accent-bg: #d1e7dd;
  background-color: #d1e7dd;
  color: #0a3622;
}

.cobranzas-celda-mes--parcial {
  --bs-table-bg: #fff3cd;
  --bs-table-accent-bg: #fff3cd;
  background-color: #fff3cd;
  color: #664d03;
  box-shadow: inset 0 0 0 1px #dc3545;
}

.cobranzas-celda-mes--pendiente {
  --bs-table-bg: #f8d7da;
  --bs-table-accent-bg: #f8d7da;
  background-color: #f8d7da;
  color: #58151c;
}

@media (max-width: 575.98px) {
  .cobranzas-cifra__valor {
    font-size: 1.1rem;
  }
}
</style>
