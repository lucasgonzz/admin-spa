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
          <div class="card h-100 cobranzas-cifra cobranzas-cifra--success">
            <div class="card-body py-3">
              <p class="cobranzas-cifra__rotulo mb-1">Cobrado · {{ etiqueta_larga(mes_referencia) }}</p>
              <p class="cobranzas-cifra__valor mb-0">{{ format_plata(cifras.cobrado) }}</p>
              <p class="cobranzas-cifra__pie mb-0">{{ cifras.pagados }} {{ cifras.pagados === 1 ? 'cliente pagó' : 'clientes pagaron' }}</p>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-4">
          <div class="card h-100 cobranzas-cifra cobranzas-cifra--danger">
            <div class="card-body py-3">
              <p class="cobranzas-cifra__rotulo mb-1">Pendientes</p>
              <p class="cobranzas-cifra__valor mb-0" :class="{ 'text-danger': cifras.pendientes > 0 }">{{ cifras.pendientes }}</p>
              <p class="cobranzas-cifra__pie mb-0">sin factura ni pago</p>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-4">
          <div class="card h-100 cobranzas-cifra cobranzas-cifra--warning">
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
              <th
                v-for="mes in meses_columnas"
                :key="'th-' + mes"
                class="text-center text-nowrap cobranzas-tabla__mes"
                :class="{ 'cobranzas-tabla__ref': mes === mes_referencia }"
              >
                {{ etiqueta_larga(mes) }}
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
              <td
                v-for="mes in meses_columnas"
                :key="cliente.id + '-' + mes"
                class="text-center cobranzas-tabla__mes"
                :class="{ 'cobranzas-tabla__ref': mes === mes_referencia }"
              >
                <estado-mensualidad-badge :estado_de="estado_de(cliente, mes)" />
              </td>
              <td class="text-end text-nowrap" @click.stop>
                <div class="d-flex flex-wrap gap-1 justify-content-end cobranzas-acciones">
                  <button
                    type="button"
                    class="btn btn-outline-secondary btn-sm cobranzas-accion"
                    :title="puede_facturar(cliente) ? 'Emitir factura del mes de referencia' : 'No se factura un mes que no aplica o todavía no llegó'"
                    :disabled="hay_accion_en_curso(cliente) || !puede_facturar(cliente)"
                    @click="emitir_factura(cliente)"
                  >
                    <span v-if="accion_en_curso[cliente.id] === 'factura'" class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                    <template v-else><i class="bi bi-receipt me-1"></i>Emitir factura</template>
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline-secondary btn-sm cobranzas-accion"
                    title="Registrar pago del mes de referencia"
                    :disabled="hay_accion_en_curso(cliente)"
                    @click="abrir_registrar_pago(cliente)"
                  >
                    <i class="bi bi-cash-coin me-1"></i>Registrar pago
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline-secondary btn-sm cobranzas-accion"
                    title="Traer la cantidad de empleados del sistema del cliente"
                    :disabled="hay_accion_en_curso(cliente)"
                    @click="traer_empleados(cliente)"
                  >
                    <span v-if="accion_en_curso[cliente.id] === 'empleados'" class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                    <template v-else><i class="bi bi-people me-1"></i>Traer empleados</template>
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline-secondary btn-sm cobranzas-accion"
                    :title="factura_de_referencia(cliente) ? 'Enviar por WhatsApp la factura de ' + etiqueta_larga(mes_referencia) : 'Todavía no hay factura de este mes para enviar'"
                    :disabled="hay_accion_en_curso(cliente) || !factura_de_referencia(cliente)"
                    @click="enviar_por_whatsapp(cliente)"
                  >
                    <span v-if="accion_en_curso[cliente.id] === 'whatsapp'" class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                    <template v-else><i class="bi bi-whatsapp me-1"></i>Enviar WhatsApp</template>
                  </button>
                </div>
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
import api, { admin_api_origin, resolve_error_message } from '@/utils/axios'
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
      // 🔴 Sin monto en el confirm() (hallazgo del chequeo independiente, 18/9/2026): el backend
      // sincroniza empleados ANTES de facturar (punto E del plan), así que el total que termina
      // facturado puede no coincidir con lo que admin tiene cargado en este momento, si cambió
      // la cantidad de empleados desde la última sincronización. Prometerle acá un número que
      // después no coincide es peor que no prometer ninguno — es un comprobante fiscal
      // irreversible; el monto real se muestra recién en el toast de éxito, con `importe_total`.
      const confirmado = window.confirm(
        '¿Emitir la factura de la mensualidad de ' + (cliente.nombre || 'este cliente') +
        ' (' + etiqueta_larga(this.mes_referencia) + ')? ' +
        'El total se recalcula con los empleados actualizados del cliente antes de facturar. ' +
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
            // `importe_total` es lo que efectivamente facturó AFIP (ya con los empleados
            // sincronizados): acá sí es un hecho consumado, a diferencia del monto que se sacó
            // del confirm() de arriba.
            self.avisar(data.ya_facturado
              ? etiqueta_larga(self.mes_referencia) + ' de ' + cliente.nombre + ' ya estaba facturado.'
              : 'Factura emitida a ' + cliente.nombre + ' por ' + format_plata(data.importe_total) + ' (CAE ' + data.cae + ').')
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
    /**
     * La factura del mes de referencia de este cliente, o null si todavía no se facturó (o el
     * backend no mandó estado para ese mes). Fuente única para habilitar "Enviar WhatsApp" y para
     * sacar el `invoiceId` al clickearlo: así el botón y la acción nunca se desincronizan sobre
     * qué factura están mirando.
     * @param {Object} cliente
     * @returns {Object|null} `{id, cbte_numero, punto_venta, cae}` o null
     */
    factura_de_referencia(cliente) {
      const estado = this.estado_de(cliente, this.mes_referencia)
      return estado && estado.factura ? estado.factura : null
    },
    /**
     * "Enviar WhatsApp" de la factura del mes de referencia (pedido 10). A diferencia de "Ver PDF"
     * (que usa un token de un solo uso, `pdf-access-token` + `pdf-view`), acá se pide un link
     * PÚBLICO Y DURABLE (`link-whatsapp` + `pdf-publico`): se puede reabrir después, desde
     * cualquier dispositivo — es justo lo que hace falta para mandarlo por WhatsApp, donde el
     * cliente lo abre más tarde y no en el momento del click.
     *
     * 🔴 El teléfono NO se normaliza acá (hallazgo del chequeo independiente, 18/9/2026): el
     * `.replace(/\D/g, '')` que usa `build_whatsapp_href()` de CloserLeadCard.vue asume que el
     * teléfono ya viene con el +54 9 adelante, y `clients.phone` no lo garantiza. El backend
     * manda `cliente.phone_whatsapp` YA normalizado con el normalizador canónico del proyecto
     * (o `null` si no pudo); acá se lee tal cual, sin tocarlo.
     * @param {Object} cliente
     */
    enviar_por_whatsapp(cliente) {
      const self = this
      if (this.hay_accion_en_curso(cliente)) {
        return
      }
      const factura = this.factura_de_referencia(cliente)
      if (!factura) {
        return
      }
      const digitos = cliente.phone_whatsapp
      if (!digitos) {
        // `phone_whatsapp` en null es "no hay a quién escribirle" desde la perspectiva del
        // operador, sea porque el cliente no tiene teléfono cargado o porque el backend no pudo
        // normalizarlo — mismo aviso para los dos casos, la causa técnica no le sirve a Lucas acá.
        self.avisar('Este cliente no tiene teléfono cargado.', 'warning')
        return
      }
      self.marcar_accion(cliente, 'whatsapp')
      api
        .post('/client/' + cliente.id + '/factura/' + factura.id + '/link-whatsapp', {}, { silent_error: true })
        .then(function (res) {
          self.marcar_accion(cliente, null)
          const token = res.data && res.data.token
          if (!token) {
            self.avisar('No se pudo generar el link de la factura.', 'danger')
            return
          }
          // Ruta pública registrada fuera del grupo `admin` (sin Sanctum), igual criterio que
          // `pdf-view` en MensualidadTab.vue: se arma con `admin_api_origin()` porque no vive
          // bajo el prefijo /api/admin del cliente axios compartido.
          const url_pdf =
            admin_api_origin() +
            '/api/client/' + cliente.id +
            '/factura/' + factura.id +
            '/pdf-publico/' + token
          const mensaje = 'Hola, te acercamos la factura del mes de ' + etiqueta_larga(self.mes_referencia) + ': ' + url_pdf
          window.open('https://wa.me/' + digitos + '?text=' + encodeURIComponent(mensaje), '_blank')
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

/* Contraste de las tarjetas (pedido 1, 18/9/2026): cada una toma el color semántico que ya usa
   el resto del módulo para ese mismo concepto (filas de la tabla, EstadoMensualidadBadge) — las
   variables `subtle` de Bootstrap 5.3 en vez de hex propios, para consistencia gratis con el
   resto del admin y con los mismos badges de este módulo. */
.cobranzas-cifra {
  border-radius: 0.75rem;
  border: 1px solid transparent;
}

.cobranzas-cifra--success {
  background-color: var(--bs-success-bg-subtle);
  border-color: var(--bs-success-border-subtle);
}

.cobranzas-cifra--danger {
  background-color: var(--bs-danger-bg-subtle);
  border-color: var(--bs-danger-border-subtle);
}

.cobranzas-cifra--warning {
  background-color: var(--bs-warning-bg-subtle);
  border-color: var(--bs-warning-border-subtle);
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
  /* 🔴 Hallazgo del chequeo independiente (18/9/2026): `.table-responsive` de Bootstrap ya trae
     `overflow-x: auto`, pero se declara también acá, explícito, para no depender del orden de
     carga entre este `<style scoped>` y el CSS global de Bootstrap. `overflow-y: hidden` es el
     que recorta las esquinas redondeadas de la tabla (antes lo hacía `overflow: hidden` en
     `.table`, ver `.cobranzas-tabla` más abajo) — tiene que ser DOS declaraciones separadas: un
     `overflow: hidden` acá (shorthand) pisaría el `overflow-x: auto` y mataría el scroll
     horizontal entero. */
  overflow-x: auto;
  overflow-y: hidden;
}

/* 🔴 Cancela el `overflow: hidden` global de `.table` (`_app.sass`, TODAS las tablas del admin)
   para ESTA tabla puntual. Con ese `overflow: hidden` puesto, la propia `<table>` queda como un
   scrollport intermedio que nunca scrollea (el que scrollea es `.cobranzas-tabla-wrap`, de
   arriba) — y un ancestro con `overflow` distinto de `visible` que no sea el contenedor que
   scrollea de verdad corta la cadena de `position: sticky` para todo lo de adentro. Por eso
   ninguna columna quedaba fija: no era un problema de `left`/`z-index`, era este `overflow` de
   más. `table-layout: fixed` es la otra mitad del arreglo: con el layout automático que trae una
   tabla por default, el `width` de una columna es apenas una sugerencia que el navegador puede
   ignorar según el contenido — con `fixed`, el `width` del `<th>` de la primera fila manda de
   verdad, así que ahora hace falta declararlo en TODAS las columnas (ver las reglas de abajo),
   no solo en las que quedan fijas: una columna sin `width` se reparte el espacio sobrante de
   forma pareja entre todas las que tampoco lo tengan, que tampoco es lo que se quiere para los
   meses (que sean angostos y parejos, no elásticos según cuántos estén seleccionados). */
.cobranzas-tabla {
  overflow: visible;
  table-layout: fixed;
}

/* Mientras se recarga la tabla no se tapa: se atenúa apenas, para que no salte. */
.cobranzas-tabla-wrap--actualizando {
  opacity: 0.6;
  transition: opacity 0.15s ease-out;
}

/* Headers con más contraste (pedido 2, 18/9/2026): el fondo #444 sale de la regla global
   `.table > thead > tr > th` de _app.sass (no se toca, es de TODO el admin); acá lo que se
   arregla es el gris de bajo contraste que este archivo le pisaba encima con `color`. */
.cobranzas-tabla th {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #fff;
  font-weight: 600;
  border-bottom-width: 1px;
  white-space: nowrap;
  /* Por encima de cualquier celda fija del body (ver "Columnas fijas" más abajo). Va acá y no en
     una regla `thead th` aparte: un selector con `:nth-child` tiene más especificidad que
     `thead th` y le hubiera ganado a un z-index puesto ahí, aunque viniera después en el
     archivo — con un solo lugar que lo setea, no hay dos reglas peleando por z-index. */
  z-index: 3;
}

.cobranzas-tabla td {
  font-size: 0.875rem;
  /* Ídem: por debajo del header, ver el comentario de arriba. Sin efecto en las celdas que no
     son sticky (z-index no hace nada sin `position` distinto de `static`). */
  z-index: 2;
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

/* ============================================================ */
/* Columnas fijas / scrolleables (pedido 5, 18/9/2026). Las      */
/* cuatro columnas de antes de los meses quedan fijas a la       */
/* izquierda, y Acciones fija a la derecha (va después de los    */
/* meses en el DOM); solo los meses scrollean dentro de          */
/* `.table-responsive`. El fondo NO se pisa a mano: cada celda ya */
/* tiene `background-color: var(--bs-table-bg)` por la regla de  */
/* Bootstrap, y esa variable la setea `table-success`/`-warning`/ */
/* `-danger` puesta en el <tr> (`clase_fila`) — hereda hacia las  */
/* celdas hijas aunque no tengan la clase puesta directamente.    */
/* Con `table-layout: fixed` (ver `.cobranzas-tabla` más arriba)  */
/* el `width` de acá manda de verdad, así que TODAS las columnas  */
/* lo necesitan, no solo las fijas — una sin `width` se reparte   */
/* el espacio sobrante parejo con las demás que tampoco lo        */
/* tengan, y ahí los meses quedarían elásticos según cuántos      */
/* estén seleccionados en vez de angostos y parejos.              */
/* Medidas verificadas contra una reproducción real en Chromium   */
/* (getBoundingClientRect antes/después de scrollear, ver informe */
/* de esta misión): Cliente 200px, Monto mensual 130px, Empleados */
/* 80px, Última act. 160px, cada mes 130px, Acciones 300px (los   */
/* cuatro botones con texto entran de a dos por fila, dos filas). */
/* Monto mensual subió de 110 a 130px (tercera vuelta del chequeo */
/* independiente, 18/9/2026): el header "MONTO MENSUAL" en        */
/* mayúscula mide 116px reales y perdía la última letra contra la */
/* columna de al lado. El `left` de las dos columnas siguientes    */
/* está encadenado a este ancho — se corrigen las dos.             */
/* ============================================================ */
.cobranzas-tabla th:nth-child(1),
.cobranzas-tabla td:nth-child(1) {
  position: sticky;
  left: 0;
  width: 200px;
}

.cobranzas-tabla th:nth-child(2),
.cobranzas-tabla td:nth-child(2) {
  position: sticky;
  left: 200px;
  width: 130px;
}

.cobranzas-tabla th:nth-child(3),
.cobranzas-tabla td:nth-child(3) {
  position: sticky;
  left: 330px;
  width: 80px;
}

.cobranzas-tabla th:nth-child(4),
.cobranzas-tabla td:nth-child(4) {
  position: sticky;
  left: 410px;
  width: 160px;
}

/* Columnas de mes: NO son `:nth-child` (la posición varía según cuántos meses estén
   seleccionados), así que van por esta clase que el template les pone a todas por igual. Sin
   `position: sticky`: son justamente las que sí tienen que scrollear. */
.cobranzas-tabla__mes {
  width: 130px;
}

.cobranzas-tabla th:last-child,
.cobranzas-tabla td:last-child {
  position: sticky;
  right: 0;
  width: 300px;
}

@media (max-width: 1365.98px) {
  /* 🔴 Tercera vuelta del chequeo independiente (18/9/2026): con datos reales sembrados, en
     TABLET (768–1024px) el bloque fijo completo (Cliente + Monto + Empleados + Última act. +
     Acciones ≈ 850px de "presupuesto") no le dejaba aire a NINGÚN mes — a 820px los cinco meses
     sembrados quedaban completamente invisibles, la fila saltaba directo de "Última act." a
     "Acciones". Este bloque (antes acotado a `max-width: 575.98px`, solo teléfono) se probó y
     confirmó funcionando ahí — la solución más simple y más segura, dado que ya van dos vueltas
     de números que no sobrevivieron al navegador real, es ENSANCHARLO para que cubra todo lo que
     no sea escritorio, en vez de inventar un tercer estado intermedio sin probar. El corte queda
     justo debajo de los ≥1366px que este proyecto usa como piso de "escritorio" (regla 17 del
     contexto maestro): así el mismo bloque que ya funciona en 375px pasa a aplicarse también en
     768px y en 1024px, sin ningún ancho nuevo sin verificar en el medio.

     Queda fija SOLO "Cliente" (angosta, con ellipsis) y TODO el resto —Monto, Empleados, Última
     act. y Acciones— vuelve a scrollear junto con los meses, en su mismo ancho de siempre (no
     hace falta tocar `width` en esas: alcanza con soltar el `position`, `table-layout: fixed` ya
     les da un ancho estable). Así queda un mes entero visible por vez en cualquier punto del
     rango, y Acciones se alcanza scrolleando hasta el final. */
  .cobranzas-tabla th:nth-child(2),
  .cobranzas-tabla td:nth-child(2),
  .cobranzas-tabla th:nth-child(3),
  .cobranzas-tabla td:nth-child(3),
  .cobranzas-tabla th:nth-child(4),
  .cobranzas-tabla td:nth-child(4),
  .cobranzas-tabla th:last-child,
  .cobranzas-tabla td:last-child {
    position: static;
  }

  .cobranzas-tabla th:nth-child(1),
  .cobranzas-tabla td:nth-child(1) {
    width: 110px;
  }

  .cobranzas-tabla td:nth-child(1) .fw-semibold {
    display: inline-block;
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: bottom;
  }
}

/* Botones ícono + texto (pedido 8): ya no son cuadrados de ancho fijo como cuando eran
   ícono-solo, fluyen con el contenido. El contenedor `.cobranzas-acciones` (flex-wrap) evita
   que los cuatro se claven en una sola línea angosta. */
.cobranzas-accion {
  white-space: nowrap;
}

@media (max-width: 575.98px) {
  .cobranzas-acciones {
    flex-direction: column;
    align-items: stretch;
  }
}

@media (max-width: 575.98px) {
  .cobranzas-cifra__valor {
    font-size: 1.25rem;
  }
}
</style>
