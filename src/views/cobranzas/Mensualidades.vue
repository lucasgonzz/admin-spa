<template>
  <div class="container-fluid px-0 py-4 cobranzas-vista">
    <!-- Encabezado -->
    <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
      <div>
        <h2 class="h4 mb-0">Mensualidades</h2>
        <p class="text-muted small mb-0 mt-1">
          Un renglón por cliente, un color por mes: verde pagó, amarillo hay factura sin pago, rojo ni una cosa ni la otra.
        </p>
      </div>

      <div class="d-flex flex-wrap align-items-end gap-2">
        <div>
          <label class="form-label small text-muted mb-1 d-block">Orden</label>
          <select v-model="orden" class="form-select form-select-sm" @change="on_orden_change">
            <option value="carga">Orden de carga</option>
            <option value="sin_pago">Sin pago primero</option>
            <option value="sin_factura">Sin factura primero</option>
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

    <!-- ============================================================ -->
    <!-- Tira de meses: un botón por mes del rango, los seleccionados  -->
    <!-- en oscuro. El más reciente de los seleccionados es el mes de  -->
    <!-- referencia (punto debajo): manda el color de la fila, las     -->
    <!-- cifras y las acciones. La selección se guarda por usuario.    -->
    <!-- ============================================================ -->
    <div class="cobranzas-meses mb-3">
      <button
        v-for="mes in meses_del_rango"
        :key="mes"
        type="button"
        class="btn btn-sm cobranzas-meses__btn"
        :class="[
          esta_seleccionado(mes) ? 'btn-dark' : 'btn-outline-secondary',
          { 'cobranzas-meses__btn--referencia': mes === mes_referencia, 'cobranzas-meses__btn--actual': mes === mes_corriente_actual },
        ]"
        :title="etiqueta_larga(mes) + (mes === mes_referencia ? ' · mes de referencia' : '')"
        @click="alternar_mes(mes)"
      >
        {{ etiqueta_corta(mes) }}
      </button>
    </div>

    <!-- Carga inicial -->
    <div v-if="loading && !cargado_alguna_vez" class="text-center py-5">
      <span class="spinner-border text-primary" role="status" aria-hidden="true" />
      <p class="text-muted mt-2">Cargando mensualidades...</p>
    </div>

    <!-- Error de carga -->
    <div v-else-if="load_error" class="alert alert-danger">
      {{ load_error }}
    </div>

    <div v-else>
      <!-- Las tres cifras del mes de referencia -->
      <div class="row g-2 g-md-3 mb-3">
        <div class="col-12 col-md-4">
          <div class="card h-100 border-0 cobranzas-cifra">
            <div class="card-body py-3">
              <p class="cobranzas-cifra__rotulo mb-1">Cobrado · {{ etiqueta_larga(mes_referencia) }}</p>
              <p class="cobranzas-cifra__valor mb-0">{{ format_plata(cifras.cobrado) }}</p>
              <p class="cobranzas-cifra__pie mb-0">{{ cifras.pagados }} {{ cifras.pagados === 1 ? 'cliente pagó' : 'clientes pagaron' }}</p>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-4">
          <div class="card h-100 border-0 cobranzas-cifra">
            <div class="card-body py-3">
              <p class="cobranzas-cifra__rotulo mb-1">Pendientes</p>
              <p class="cobranzas-cifra__valor mb-0" :class="{ 'text-danger': cifras.pendientes > 0 }">{{ cifras.pendientes }}</p>
              <p class="cobranzas-cifra__pie mb-0">sin factura ni pago</p>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-4">
          <div class="card h-100 border-0 cobranzas-cifra">
            <div class="card-body py-3">
              <p class="cobranzas-cifra__rotulo mb-1">Facturadas sin pago</p>
              <p class="cobranzas-cifra__valor mb-0" :class="{ 'text-warning-emphasis': cifras.facturadas > 0 }">{{ cifras.facturadas }}</p>
              <p class="cobranzas-cifra__pie mb-0">{{ cifras.parciales }} {{ cifras.parciales === 1 ? 'pago parcial' : 'pagos parciales' }}</p>
            </div>
          </div>
        </div>
      </div>

      <p v-if="clientes_visibles.length === 0" class="text-muted small fst-italic mb-0">
        {{ busqueda ? 'Ningún cliente coincide con la búsqueda.' : 'No hay clientes cargados.' }}
      </p>

      <!-- ============================================================ -->
      <!-- La tabla. Click en la fila abre el modal del cliente; la     -->
      <!-- celda de acciones corta el click para que apretar un botón   -->
      <!-- no abra el modal además de hacer lo suyo.                    -->
      <!-- ============================================================ -->
      <div v-else class="table-responsive cobranzas-tabla-wrap" :class="{ 'cobranzas-tabla-wrap--actualizando': loading }">
        <table class="table table-sm table-hover align-middle mb-0 cobranzas-tabla">
          <thead>
            <tr>
              <th>Cliente</th>
              <th class="text-end">Monto mensual</th>
              <th class="text-end">Empleados</th>
              <th>Última act. oficial</th>
              <th v-for="mes in meses_columnas" :key="'th-' + mes" class="text-center text-nowrap" :class="{ 'cobranzas-tabla__ref': mes === mes_referencia }">
                {{ etiqueta_corta(mes) }}
              </th>
              <th class="text-end text-nowrap">Acciones · {{ etiqueta_larga(mes_referencia) }}</th>
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
                <div class="d-flex align-items-center gap-2">
                  <span class="fw-semibold">{{ cliente.nombre || 'Cliente #' + cliente.id }}</span>
                  <span v-if="cliente.is_active === false" class="badge text-bg-light text-muted border">inactivo</span>
                </div>
                <div v-if="cliente.name && cliente.name !== cliente.nombre" class="cobranzas-tabla__nota">{{ cliente.name }}</div>
                <div v-if="cliente.cobranzas_observaciones" class="cobranzas-tabla__nota" :title="cliente.cobranzas_observaciones">
                  <i class="bi bi-sticky me-1"></i>{{ primera_linea(cliente.cobranzas_observaciones) }}
                </div>
              </td>
              <td class="text-end text-nowrap">
                {{ cliente.total_mensualidad !== null && cliente.total_mensualidad !== undefined ? format_plata(cliente.total_mensualidad) : '—' }}
              </td>
              <td class="text-end">{{ cliente.cantidad_empleados !== null && cliente.cantidad_empleados !== undefined ? cliente.cantidad_empleados : '—' }}</td>
              <td class="text-nowrap">
                <template v-if="cliente.actualizacion && !cliente.actualizacion.sin_oficial">
                  <span>{{ formatear_fecha(cliente.actualizacion.ultima_oficial_fecha) }}</span>
                  <span class="cobranzas-tabla__nota d-block">{{ texto_hace_meses(cliente.actualizacion.ultima_oficial_fecha) }}</span>
                  <span v-if="cliente.actualizacion.vencida" class="badge text-bg-danger">Vencida</span>
                  <span
                    v-else-if="cliente.actualizacion.dias_restantes !== null && cliente.actualizacion.dias_restantes !== undefined && cliente.actualizacion.dias_restantes <= 30"
                    class="badge text-bg-warning"
                  >Vence en {{ cliente.actualizacion.dias_restantes }} días</span>
                </template>
                <span v-else class="badge text-bg-secondary">Sin registrar</span>
              </td>
              <td v-for="mes in meses_columnas" :key="cliente.id + '-' + mes" class="text-center" :class="{ 'cobranzas-tabla__ref': mes === mes_referencia }">
                <estado-mensualidad-badge :estado_de="estado_de(cliente, mes)" />
              </td>
              <td class="text-end text-nowrap" @click.stop>
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm cobranzas-accion"
                  :title="puede_facturar(cliente) ? 'Emitir factura del mes de referencia' : 'No se factura un mes que no aplica o todavía no llegó'"
                  :disabled="hay_accion_en_curso(cliente) || !puede_facturar(cliente)"
                  @click="emitir_factura(cliente)"
                >
                  <span v-if="accion_en_curso[cliente.id] === 'factura'" class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                  <i v-else class="bi bi-receipt"></i>
                </button>
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm cobranzas-accion ms-1"
                  title="Registrar pago del mes de referencia"
                  :disabled="hay_accion_en_curso(cliente)"
                  @click="abrir_registrar_pago(cliente)"
                >
                  <i class="bi bi-cash-coin"></i>
                </button>
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm cobranzas-accion ms-1"
                  title="Traer la cantidad de empleados del sistema del cliente"
                  :disabled="hay_accion_en_curso(cliente)"
                  @click="traer_empleados(cliente)"
                >
                  <span v-if="accion_en_curso[cliente.id] === 'empleados'" class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                  <i v-else class="bi bi-people"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal del cliente (Mensualidad + Licencias). Al cerrarlo se recarga la tabla: adentro se
         pudo registrar un pago, marcar un mes sin cargo o cambiar precios. -->
    <cliente-modal
      :show="modal_cliente.show"
      :cliente="modal_cliente.cliente"
      pestana_inicial="mensualidad"
      @update:show="modal_cliente.show = $event"
      @close="on_modal_cliente_cerrado"
    />

    <!-- Modal de registrar pago, directo desde la fila -->
    <registrar-pago-modal
      :show="modal_pago.show"
      :cliente="modal_pago.cliente"
      :periodo="modal_pago.periodo"
      :monto_esperado="modal_pago.monto_esperado"
      :stack_level="0"
      @update:show="modal_pago.show = $event"
      @saved="on_pago_guardado"
    />
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import ClienteModal from '@/components/cobranzas/ClienteModal.vue'
import RegistrarPagoModal from '@/components/cobranzas/RegistrarPagoModal.vue'
import EstadoMensualidadBadge from '@/components/cobranzas/EstadoMensualidadBadge.vue'
import { etiqueta_corta, etiqueta_larga, formatear_fecha, lista_de_meses, mes_corriente, sumar_meses, texto_hace_meses } from '@/components/cobranzas/meses'
import { format_plata } from '@/components/cobranzas/plata'

/** Tope de meses seleccionables a la vez: el mismo que valida el backend (CobranzasController). */
const MAXIMO_MESES = 24

/**
 * Cobranzas › Mensualidades (misión modulo-cobranzas, 18/9/2026).
 *
 * Emula la planilla "ComercioCity administracion.xlsx" que Lucas venía llevando a mano: un
 * renglón por cliente, una columna por mes, y el color de la fila según cómo está el mes de
 * referencia. Lee `GET cobranzas/mensualidades?meses=...`, que arma la tabla para TODOS los
 * clientes en tres consultas (facturas, filas de período y pagos), así que no le pega a ninguna
 * instancia de cliente; lo único que sí sale hacia afuera es "Traer empleados", y eso lo hace
 * el backend contra la empresa-api de ese cliente.
 *
 * La selección de meses y el orden se guardan por admin (`PUT cobranzas/preferencias`), con un
 * debounce corto para que tocar tres meses seguidos no mande tres PUT ni tres GET.
 */
export default {
  name: 'ViewCobranzasMensualidades',
  components: { ClienteModal, RegistrarPagoModal, EstadoMensualidadBadge },
  data() {
    return {
      // true mientras se consulta la tabla.
      loading: false,
      // true una vez que se cargó al menos una vez (para no tapar la pantalla en cada recarga).
      cargado_alguna_vez: false,
      // Mensaje de error de la carga (null = sin error).
      load_error: null,
      // Meses seleccionados (`YYYY-MM`), guardados por usuario. Siempre queda al menos uno.
      meses_seleccionados: [mes_corriente()],
      // Orden de la tabla: `carga` | `sin_pago` | `sin_factura`. Guardado por usuario.
      orden: 'carga',
      // Filtro local por nombre.
      busqueda: '',
      // Filas de la tabla, tal como las devuelve el backend (`tabla_mensualidades`).
      clientes: [],
      // Rango de meses que ofrece la tira: `{desde, hasta}` del backend.
      rango: { desde: '', hasta: '' },
      // Mes corriente según el backend (cae al del navegador hasta que responda).
      mes_corriente_actual: mes_corriente(),
      // Acción corriendo por cliente: `{[client_id]: 'factura' | 'pago' | 'empleados'}`.
      accion_en_curso: {},
      // Timer del debounce de guardar preferencias + recargar.
      timer_preferencias: null,
      // Número de la última carga pedida: una respuesta vieja que llega tarde no pisa a la nueva.
      secuencia_carga: 0,
      // true si en la ráfaga de clicks en curso cambió algún mes (hay que recargar la tabla).
      recarga_pendiente: false,
      // Estado del modal del cliente.
      modal_cliente: { show: false, cliente: null },
      // Estado del modal de registrar pago.
      modal_pago: { show: false, cliente: null, periodo: '', monto_esperado: null },
    }
  },
  computed: {
    /**
     * Meses de la tira: todo el rango que devolvió el backend (desde el primer mes de
     * mensualidad de algún cliente hasta tres meses adelante). Si todavía no respondió, doce
     * meses atrás hasta tres adelante, para que la tira exista desde el primer render.
     * @returns {string[]}
     */
    meses_del_rango() {
      const desde = this.rango.desde || sumar_meses(this.mes_corriente_actual, -12)
      const hasta = this.rango.hasta || sumar_meses(this.mes_corriente_actual, 3)
      const meses = lista_de_meses(desde, hasta)
      /* Un mes seleccionado que quedó fuera del rango (preferencia vieja) se suma igual, para que
         el operador vea qué tiene marcado y pueda destildarlo. */
      this.meses_seleccionados.forEach(function (mes) {
        if (meses.indexOf(mes) === -1) {
          meses.push(mes)
        }
      })
      return meses.slice().sort()
    },
    /**
     * Meses seleccionados en orden cronológico, que son las columnas de la tabla.
     * @returns {string[]}
     */
    meses_columnas() {
      return this.meses_seleccionados.slice().sort()
    },
    /**
     * El mes de referencia: el más reciente de los seleccionados. Comparar los strings
     * `YYYY-MM` alcanza porque el formato ordena solo.
     * @returns {string}
     */
    mes_referencia() {
      const columnas = this.meses_columnas
      return columnas.length ? columnas[columnas.length - 1] : this.mes_corriente_actual
    },
    /**
     * Filas filtradas por la búsqueda y ordenadas según `orden`.
     * @returns {Array<Object>}
     */
    clientes_visibles() {
      const self = this
      const termino = String(this.busqueda || '').trim().toLowerCase()
      const filtrados = this.clientes.filter(function (cliente) {
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
     * Las cifras del mes de referencia, sobre TODOS los clientes (no solo los filtrados): son
     * el estado de la cobranza del mes, no de la búsqueda.
     * @returns {{cobrado: number, pagados: number, pendientes: number, facturadas: number, parciales: number}}
     */
    cifras() {
      const self = this
      const acumulado = { cobrado: 0, pagados: 0, pendientes: 0, facturadas: 0, parciales: 0 }
      this.clientes.forEach(function (cliente) {
        const estado = self.estado_de(cliente, self.mes_referencia)
        if (!estado) {
          return
        }
        acumulado.cobrado += Number(estado.monto_pagado || 0)
        if (estado.estado === 'pagado') {
          acumulado.pagados++
        } else if (estado.estado === 'pendiente') {
          acumulado.pendientes++
        } else if (estado.estado === 'facturado') {
          acumulado.facturadas++
        } else if (estado.estado === 'parcial') {
          acumulado.parciales++
        }
      })
      return acumulado
    },
  },
  mounted() {
    this.cargar_preferencias()
  },
  beforeUnmount() {
    /* Si hay un guardado pendiente al irse de la pantalla, se manda ya: si no, la preferencia
       del último click se pierde. */
    if (this.timer_preferencias) {
      clearTimeout(this.timer_preferencias)
      this.timer_preferencias = null
      this.guardar_preferencias()
    }
  },
  methods: {
    etiqueta_corta,
    etiqueta_larga,
    formatear_fecha,
    texto_hace_meses,
    format_plata,
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
     * Primera línea de las observaciones, para la nota debajo del nombre (el resto va al title).
     * @param {string} texto
     * @returns {string}
     */
    primera_linea(texto) {
      return String(texto || '').split('\n')[0]
    },
    /**
     * `estado_de` de un cliente para un mes (o null si el backend no lo mandó).
     * @param {Object} cliente
     * @param {string} mes `YYYY-MM`
     * @returns {Object|null}
     */
    estado_de(cliente, mes) {
      if (!cliente || !cliente.meses) {
        return null
      }
      return cliente.meses[mes] || null
    },
    /**
     * true si el mes está seleccionado.
     * @param {string} mes
     * @returns {boolean}
     */
    esta_seleccionado(mes) {
      return this.meses_seleccionados.indexOf(mes) !== -1
    },
    /**
     * Alterna un mes de la tira. Nunca deja la selección vacía: sin mes de referencia la tabla
     * no tiene sentido. Después programa el guardado y la recarga.
     * @param {string} mes
     */
    /**
     * Un comprobante fiscal es irreversible: no se ofrece para un mes anterior al inicio del
     * cliente ni para uno que todavía no llegó (la tira muestra tres meses hacia adelante).
     * @param {Object} cliente
     * @returns {boolean}
     */
    puede_facturar(cliente) {
      const estado = this.estado_de(cliente, this.mes_referencia).estado
      return estado !== 'futuro' && estado !== 'no_aplica'
    },
    alternar_mes(mes) {
      const indice = this.meses_seleccionados.indexOf(mes)
      if (indice !== -1) {
        if (this.meses_seleccionados.length === 1) {
          return
        }
        this.meses_seleccionados.splice(indice, 1)
      } else {
        // Mismo tope que el backend (422 pasado ese número): se frena acá, con aviso, y no con
        // una tabla tapada por el error.
        if (this.meses_seleccionados.length >= MAXIMO_MESES) {
          this.avisar('Se pueden ver hasta ' + MAXIMO_MESES + ' meses a la vez.', 'warning')
          return
        }
        this.meses_seleccionados.push(mes)
      }
      this.programar_guardado(true)
    },
    /**
     * Cambio de orden: se guarda (con el mismo debounce) pero no hace falta recargar, el orden
     * es local.
     */
    on_orden_change() {
      this.programar_guardado(false)
    },
    /**
     * Debounce de ~400 ms: un solo PUT (y un solo GET si cambiaron los meses) por ráfaga de
     * clicks. La recarga se acumula en una bandera y no en el argumento del último llamado: si
     * en la misma ráfaga se toca un mes y después el orden, la tabla tiene que recargar igual.
     * @param {boolean} recargar si además de guardar hay que volver a pedir la tabla
     */
    programar_guardado(recargar) {
      const self = this
      this.recarga_pendiente = this.recarga_pendiente || !!recargar
      if (this.timer_preferencias) {
        clearTimeout(this.timer_preferencias)
      }
      this.timer_preferencias = setTimeout(function () {
        self.timer_preferencias = null
        const hay_que_recargar = self.recarga_pendiente
        self.recarga_pendiente = false
        self.guardar_preferencias()
        if (hay_que_recargar) {
          self.cargar()
        }
      }, 400)
    },
    /**
     * GET cobranzas/preferencias → meses y orden del admin (con default si no tiene nada
     * guardado), y recién después la tabla. Si falla, se sigue con el default local: la
     * preferencia es una comodidad, no un requisito.
     */
    cargar_preferencias() {
      const self = this
      api
        .get('/cobranzas/preferencias', { silent_error: true })
        .then(function (res) {
          const data = res.data || {}
          if (Array.isArray(data.meses) && data.meses.length) {
            self.meses_seleccionados = data.meses.slice()
          }
          if (data.orden) {
            self.orden = String(data.orden)
          }
        })
        .catch(function () {
          /* Sin preferencias: mes corriente y orden de carga, que ya son los defaults. */
        })
        .then(function () {
          self.cargar()
        })
    },
    /**
     * PUT cobranzas/preferencias. Si falla se avisa en amarillo y la tabla sigue: lo que se ve
     * es correcto, lo único que no pasa es que se recuerde para la próxima.
     */
    guardar_preferencias() {
      const self = this
      api
        .put('/cobranzas/preferencias', {
          meses: self.meses_seleccionados.slice().sort(),
          orden: self.orden,
        }, { silent_error: true })
        .catch(function () {
          self.avisar('No se pudo guardar la selección de meses; la tabla sigue igual.', 'warning')
        })
    },
    /**
     * GET cobranzas/mensualidades?meses=… → la tabla entera.
     */
    cargar() {
      const self = this
      /* Dos cargas pueden solaparse (el debounce de la tira y la recarga al cerrar el modal) y
         llegar en orden invertido: solo la última pedida escribe en pantalla. */
      const secuencia = ++self.secuencia_carga
      self.loading = true
      self.load_error = null
      api
        .get('/cobranzas/mensualidades', {
          params: { meses: self.meses_seleccionados.slice().sort().join(',') },
          silent_error: true,
        })
        .then(function (res) {
          if (secuencia !== self.secuencia_carga) {
            return
          }
          const data = res.data || {}
          self.clientes = Array.isArray(data.clientes) ? data.clientes : []
          if (data.rango) {
            self.rango = { desde: data.rango.desde || '', hasta: data.rango.hasta || '' }
          }
          if (data.mes_corriente) {
            self.mes_corriente_actual = String(data.mes_corriente)
          }
          self.loading = false
          self.cargado_alguna_vez = true
          self.enfocar_mes_referencia()
        })
        .catch(function (error) {
          if (secuencia !== self.secuencia_carga) {
            return
          }
          self.load_error = resolve_error_message(error)
          self.loading = false
        })
    },
    /**
     * Lleva la tira hasta el mes de referencia: con la planilla importada arranca en ago-2025 y
     * en teléfono entran seis botones, así que el mes corriente quedaba fuera de vista en cada
     * carga.
     * @returns {void}
     */
    enfocar_mes_referencia() {
      const self = this
      this.$nextTick(function () {
        const boton = self.$el && self.$el.querySelector ? self.$el.querySelector('.cobranzas-meses__btn--referencia') : null
        if (boton && typeof boton.scrollIntoView === 'function') {
          boton.scrollIntoView({ inline: 'center', block: 'nearest' })
        }
      })
    },
    /**
     * Rango numérico de una fila para el orden elegido, según el estado del mes de referencia.
     *  - `sin_pago`: facturado 0, parcial 1, pendiente 2, pagado 3, sin_cargo 4, resto 5.
     *  - `sin_factura`: pendiente 0, parcial 1, facturado 2, pagado 3, sin_cargo 4, resto 5.
     *  - `carga`: todos iguales (queda el id).
     * @param {Object} cliente
     * @returns {number}
     */
    rango_de_orden(cliente) {
      if (this.orden === 'carga') {
        return 0
      }
      const estado = this.estado_de(cliente, this.mes_referencia)
      const clave = estado ? estado.estado : null
      const tabla = this.orden === 'sin_pago'
        ? { facturado: 0, parcial: 1, pendiente: 2, pagado: 3, sin_cargo: 4 }
        : { pendiente: 0, parcial: 1, facturado: 2, pagado: 3, sin_cargo: 4 }
      return clave in tabla ? tabla[clave] : 5
    },
    /**
     * Color de la fila según el mes de referencia.
     * @param {Object} cliente
     * @returns {string}
     */
    clase_fila(cliente) {
      const estado = this.estado_de(cliente, this.mes_referencia)
      const clave = estado ? estado.estado : null
      if (clave === 'pagado') {
        return 'table-success'
      }
      if (clave === 'facturado' || clave === 'parcial') {
        return 'table-warning'
      }
      if (clave === 'pendiente') {
        return 'table-danger'
      }
      return ''
    },
    /**
     * true si hay una acción corriendo para ese cliente (deshabilita sus tres botones).
     * @param {Object} cliente
     * @returns {boolean}
     */
    hay_accion_en_curso(cliente) {
      return !!this.accion_en_curso[cliente.id]
    },
    /**
     * Marca o limpia la acción en curso de un cliente (reasignando el objeto para la reactividad).
     * @param {Object} cliente
     * @param {string|null} accion
     */
    marcar_accion(cliente, accion) {
      const copia = Object.assign({}, this.accion_en_curso)
      if (accion) {
        copia[cliente.id] = accion
      } else {
        delete copia[cliente.id]
      }
      this.accion_en_curso = copia
    },
    /**
     * Objeto mínimo del cliente para los modales: `{id, name, company_name}`.
     * @param {Object} cliente fila de la tabla
     * @returns {Object}
     */
    cliente_para_modal(cliente) {
      return { id: cliente.id, name: cliente.name, company_name: cliente.company_name }
    },
    /**
     * Click en la fila: abre el modal del cliente en Mensualidad.
     * @param {Object} cliente
     */
    abrir_cliente(cliente) {
      this.modal_cliente = { show: true, cliente: this.cliente_para_modal(cliente) }
    },
    /**
     * Se cerró el modal del cliente: se recarga la tabla, adentro pudo cambiar cualquier cosa.
     */
    on_modal_cliente_cerrado() {
      this.modal_cliente.show = false
      this.cargar()
    },
    /**
     * Emitir la Factura C del mes de referencia (POST client/{id}/emitir-factura). Confirmación
     * obligatoria: es un comprobante fiscal real e irreversible.
     * @param {Object} cliente
     */
    emitir_factura(cliente) {
      const self = this
      if (this.hay_accion_en_curso(cliente)) {
        return
      }
      const estado = this.estado_de(cliente, this.mes_referencia)
      const monto = estado && estado.monto_esperado !== null && estado.monto_esperado !== undefined
        ? estado.monto_esperado
        : cliente.total_mensualidad
      const confirmado = window.confirm(
        '¿Emitir la factura de la mensualidad de ' + (cliente.nombre || 'este cliente') +
        ' por ' + format_plata(monto) + ' (' + etiqueta_larga(this.mes_referencia) + ')? ' +
        'Genera un comprobante fiscal real e irreversible.'
      )
      if (!confirmado) {
        return
      }
      self.marcar_accion(cliente, 'factura')
      api
        .post('/client/' + cliente.id + '/emitir-factura', { periodo: self.mes_referencia }, { silent_error: true })
        .then(function (res) {
          const data = res.data || {}
          self.marcar_accion(cliente, null)
          if (data.ok) {
            self.avisar(data.ya_facturado
              ? etiqueta_larga(self.mes_referencia) + ' de ' + cliente.nombre + ' ya estaba facturado.'
              : 'Factura emitida a ' + cliente.nombre + ' (CAE ' + data.cae + ').')
          } else {
            self.avisar(data.error_message || 'No se pudo emitir la factura.', 'danger')
          }
          self.cargar()
        })
        .catch(function (error) {
          self.marcar_accion(cliente, null)
          const data = error && error.response && error.response.data
          self.avisar((data && data.error_message) || resolve_error_message(error), 'danger')
        })
    },
    /**
     * Abre el modal de registrar pago para el mes de referencia, con el esperado del mes (o el
     * total de la mensualidad si el mes no tiene fila).
     * @param {Object} cliente
     */
    abrir_registrar_pago(cliente) {
      const estado = this.estado_de(cliente, this.mes_referencia)
      const esperado = estado && estado.monto_esperado !== null && estado.monto_esperado !== undefined
        ? estado.monto_esperado
        : cliente.total_mensualidad
      this.modal_pago = {
        show: true,
        cliente: this.cliente_para_modal(cliente),
        periodo: this.mes_referencia,
        monto_esperado: esperado,
      }
    },
    /**
     * El modal registró el pago: se recarga la tabla (cambian la fila y las cifras).
     */
    on_pago_guardado() {
      this.cargar()
    },
    /**
     * Traer la cantidad de empleados del sistema del cliente
     * (POST client/{id}/mensualidad/sincronizar-empleados). El backend contesta 200 siempre y
     * dice si el cliente lo soporta.
     * @param {Object} cliente
     */
    traer_empleados(cliente) {
      const self = this
      if (this.hay_accion_en_curso(cliente)) {
        return
      }
      self.marcar_accion(cliente, 'empleados')
      api
        .post('/client/' + cliente.id + '/mensualidad/sincronizar-empleados', {}, { silent_error: true })
        .then(function (res) {
          const data = res.data || {}
          self.marcar_accion(cliente, null)
          if (!data.soportado) {
            self.avisar(data.error || (cliente.nombre + ' todavía no soporta la sincronización.'), 'warning')
            return
          }
          self.avisar(
            'Empleados actualizados para ' + cliente.nombre + ': ' + data.cantidad_empleados +
            ' (total ' + format_plata(data.total_mensualidad) + ').'
          )
          self.cargar()
        })
        .catch(function (error) {
          self.marcar_accion(cliente, null)
          self.avisar(resolve_error_message(error), 'danger')
        })
    },
  },
}
</script>

<style scoped>
/* 🔴 Los `.row` de Bootstrap traen margen horizontal negativo (-.5rem por lado con `g-3`); adentro
   de un contenedor sin padding horizontal la fila se sale 8px por la derecha (medido en Tokens).
   Se le devuelve al contenedor el padding que el gutter espera. */
.cobranzas-vista {
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}

/* Tira de meses: una sola línea con scroll horizontal cuando no entran (en teléfono, siempre).
   Nunca se achica la tipografía para que entren: se desplaza, igual que la serie de Tokens. */
.cobranzas-meses {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.25rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
  scrollbar-width: thin;
}

.cobranzas-meses__btn {
  flex: 0 0 auto;
  position: relative;
  white-space: nowrap;
  min-width: 3.5rem;
}

/* El mes de referencia lleva un punto debajo; el corriente, un borde apenas más marcado. */
.cobranzas-meses__btn--referencia::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 3px;
  width: 4px;
  height: 4px;
  margin-left: -2px;
  border-radius: 50%;
  background: currentColor;
}

.cobranzas-meses__btn--actual:not(.btn-dark) {
  border-color: #6c757d;
  color: #212529;
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

/* Mientras se recarga la tabla no se tapa: se atenúa apenas, para que no salte. */
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

/* La columna del mes de referencia se distingue apenas del resto: es la que manda el color.
   Va por la variable de acento y no por `background-color`: la clase scoped le ganaría al
   fondo de `table-danger`/`table-success` y la celda que decide el color quedaría gris. */
.cobranzas-tabla__ref {
  --bs-table-accent-bg: rgba(0, 0, 0, 0.03);
}

.cobranzas-tabla__nota {
  font-size: 0.7rem;
  color: #8a8a8f;
}

.cobranzas-accion {
  width: 2rem;
  padding-left: 0;
  padding-right: 0;
}

@media (max-width: 575.98px) {
  .cobranzas-cifra__valor {
    font-size: 1.25rem;
  }
}
</style>
