<template>
  <div class="p-3 tokens-tab">
    <!-- Sin cliente guardado todavía: no hay id al que pedirle el consumo -->
    <p v-if="!record || !record.id" class="text-muted small fst-italic mb-0">
      Guardá el cliente primero para ver su consumo de IA.
    </p>

    <!-- Carga inicial -->
    <div v-else-if="loading" class="text-center py-4">
      <span class="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true" />
      <p class="text-muted small mt-2 mb-0">Cargando consumo...</p>
    </div>

    <!-- Error de carga -->
    <div v-else-if="load_error" class="alert alert-danger py-2 small mb-0">
      {{ load_error }}
    </div>

    <div v-else class="tokens-cuerpo">
      <!-- ============================================================ -->
      <!-- Rango del período. Los tres atajos cubren el 99% de las      -->
      <!-- consultas; las fechas a mano quedan para el caso puntual.    -->
      <!-- ============================================================ -->
      <div class="d-flex flex-wrap align-items-end gap-3 mb-4">
        <div>
          <label class="form-label small text-muted mb-1 d-block">Período</label>
          <div class="btn-group btn-group-sm" role="group">
            <button
              v-for="opcion in atajos"
              :key="opcion.dias"
              type="button"
              class="btn"
              :class="dias_elegidos === opcion.dias ? 'btn-dark' : 'btn-outline-secondary'"
              @click="elegir_atajo(opcion.dias)"
            >
              {{ opcion.label }}
            </button>
          </div>
        </div>

        <div>
          <label class="form-label small text-muted mb-1">Desde</label>
          <input v-model="desde" type="date" class="form-control form-control-sm" @change="fechas_a_mano" />
        </div>

        <div>
          <label class="form-label small text-muted mb-1">Hasta</label>
          <input v-model="hasta" type="date" class="form-control form-control-sm" @change="fechas_a_mano" />
        </div>

        <button
          type="button"
          class="btn btn-outline-primary btn-sm"
          :disabled="recargando"
          @click="cargar_consumo(true)"
        >
          <span
            v-if="recargando"
            class="spinner-border spinner-border-sm me-1"
            role="status"
            aria-hidden="true"
          />
          Ver
        </button>
      </div>

      <!-- ============================================================ -->
      <!-- Los tres números grandes. Sin colores ni iconos: el dato es  -->
      <!-- el dato.                                                     -->
      <!-- ============================================================ -->
      <div class="row g-3 mb-4">
        <div class="col-12 col-md-4">
          <div class="card h-100 border-0 tokens-cifra">
            <div class="card-body">
              <p class="tokens-cifra__rotulo mb-1">Costo estimado</p>
              <p class="tokens-cifra__valor mb-0">{{ costo_visible(totales.costo_usd) }}</p>
              <p v-if="hay_sin_precio" class="tokens-cifra__pie mb-0">
                No incluye {{ modelos_sin_precio_texto }}: sin precio cargado.
              </p>
            </div>
          </div>
        </div>

        <div class="col-6 col-md-4">
          <div class="card h-100 border-0 tokens-cifra">
            <div class="card-body">
              <p class="tokens-cifra__rotulo mb-1">Tokens</p>
              <p class="tokens-cifra__valor mb-0">{{ numero(totales.tokens) }}</p>
              <!-- En dos renglones y no separados por un punto: a 360px de ancho la línea única
                   se parte por la mitad de un número y se lee como si fueran tres cifras. -->
              <p class="tokens-cifra__pie mb-0">
                <span class="d-block">{{ numero(totales.input_tokens) }} de entrada</span>
                <span class="d-block">{{ numero(totales.output_tokens) }} de salida</span>
              </p>
            </div>
          </div>
        </div>

        <div class="col-6 col-md-4">
          <div class="card h-100 border-0 tokens-cifra">
            <div class="card-body">
              <p class="tokens-cifra__rotulo mb-1">Llamadas</p>
              <p class="tokens-cifra__valor mb-0">{{ numero(totales.llamadas) }}</p>
              <p class="tokens-cifra__pie mb-0">{{ dias_del_rango.length }} días</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Serie por día. Barras con divs: no se estrena una librería   -->
      <!-- de gráficos para una serie diaria.                           -->
      <!-- ============================================================ -->
      <div class="card border-0 tokens-panel mb-4">
        <div class="card-body">
          <p class="tokens-panel__titulo mb-3">Por día</p>

          <p v-if="!hay_consumo" class="text-muted small fst-italic mb-0">
            Sin consumo registrado en este período.
          </p>

          <div v-else class="tokens-serie">
            <div
              v-for="dia in dias_del_rango"
              :key="dia.fecha"
              class="tokens-serie__col"
              :title="titulo_del_dia(dia)"
            >
              <div class="tokens-serie__pista">
                <div class="tokens-serie__barra" :style="{ height: alto_de(dia) }" />
              </div>
              <span class="tokens-serie__dia">{{ dia_corto(dia.fecha) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Los dos desgloses: por acción (lo que pidió Lucas) y por     -->
      <!-- modelo (donde se ve si el gasto está bien repartido).        -->
      <!-- ============================================================ -->
      <div class="row g-3 mb-4">
        <div class="col-12 col-lg-6">
          <div class="card border-0 tokens-panel h-100">
            <div class="card-body">
              <p class="tokens-panel__titulo mb-3">Por acción</p>

              <p v-if="por_proceso.length === 0" class="text-muted small fst-italic mb-0">
                Sin datos.
              </p>

              <div v-else class="table-responsive">
                <table class="table table-sm align-middle mb-0 tokens-tabla">
                  <thead>
                    <tr>
                      <th>Acción</th>
                      <th class="text-end">Llamadas</th>
                      <th class="text-end">Tokens</th>
                      <th class="text-end">Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="fila in por_proceso" :key="fila.proceso">
                      <td>{{ fila.proceso || '(sin acción)' }}</td>
                      <td class="text-end">{{ numero(fila.llamadas) }}</td>
                      <td class="text-end">{{ numero(fila.tokens) }}</td>
                      <td class="text-end">{{ costo_visible(fila.costo_usd) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div class="col-12 col-lg-6">
          <div class="card border-0 tokens-panel h-100">
            <div class="card-body">
              <p class="tokens-panel__titulo mb-3">Por modelo</p>

              <p v-if="por_modelo.length === 0" class="text-muted small fst-italic mb-0">
                Sin datos.
              </p>

              <div v-else class="table-responsive">
                <table class="table table-sm align-middle mb-0 tokens-tabla">
                  <thead>
                    <tr>
                      <th>Modelo</th>
                      <th class="text-end">Tokens</th>
                      <th class="text-end">Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="fila in por_modelo" :key="fila.modelo + '|' + fila.proveedor">
                      <td>
                        <span class="d-block">{{ fila.modelo || '(sin modelo)' }}</span>
                        <span class="tokens-tabla__nota">{{ fila.proveedor }}</span>
                      </td>
                      <td class="text-end">{{ numero(fila.tokens) }}</td>
                      <td class="text-end">
                        <span v-if="fila.tiene_precio">{{ costo_visible(fila.costo_usd) }}</span>
                        <span v-else class="tokens-tabla__nota">sin precio cargado</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Quién lo gastó.                                              -->
      <!--                                                              -->
      <!-- 🔴 Sin columna de plata, y el pie lo dice: este corte no     -->
      <!-- trae el modelo, y sin modelo no hay precio. Repartir el      -->
      <!-- costo total en proporción a los tokens sería inventar un     -->
      <!-- número que parece medido.                                    -->
      <!-- ============================================================ -->
      <div class="card border-0 tokens-panel mb-4">
        <div class="card-body">
          <p class="tokens-panel__titulo mb-3">Por persona</p>

          <p v-if="por_persona.length === 0" class="text-muted small fst-italic mb-0">
            Sin datos por persona en este período.
          </p>

          <div v-else>
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0 tokens-tabla">
                <thead>
                  <tr>
                    <th>Persona</th>
                    <th class="text-end">Llamadas</th>
                    <th class="text-end">Tokens</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="fila in por_persona" :key="fila.es_automatico ? 'auto' : fila.auth_user_id">
                    <td>
                      {{ fila.nombre }}
                      <span v-if="fila.es_automatico" class="tokens-tabla__nota d-block">
                        embeddings del catálogo, informes por comando y demás tareas sin nadie atrás
                      </span>
                    </td>
                    <td class="text-end">{{ numero(fila.llamadas) }}</td>
                    <td class="text-end">{{ numero(fila.tokens) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p class="tokens-tabla__nota mb-0 mt-2">
              Este corte va en tokens, no en dólares: el sistema del cliente no informa con qué
              modelo gastó cada persona, y sin el modelo no hay precio que aplicar.
            </p>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Estado de la recolección + "Traer ahora".                    -->
      <!--                                                              -->
      <!-- 🔴 El cartel de `no_soportado` no es decorativo: sin él, un  -->
      <!-- cliente con una versión vieja se ve EXACTAMENTE igual que    -->
      <!-- uno que no gastó nada, y la conclusión equivocada ("este     -->
      <!-- cliente no usa la IA") no tiene cómo corregirse sola.        -->
      <!-- ============================================================ -->
      <div class="card border-0 tokens-panel">
        <div class="card-body">
          <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <p class="tokens-panel__titulo mb-1">Recolección</p>
              <p class="mb-0 small text-muted">{{ sync_texto }}</p>
            </div>

            <button
              type="button"
              class="btn btn-outline-primary btn-sm"
              :disabled="trayendo || no_soportado_en_esta_sesion"
              @click="traer_ahora"
            >
              <span
                v-if="trayendo"
                class="spinner-border spinner-border-sm me-1"
                role="status"
                aria-hidden="true"
              />
              Traer ahora
            </button>
          </div>

          <div v-if="sync_status === 'no_soportado'" class="alert alert-warning py-2 small mt-3 mb-0">
            <strong>Este cliente todavía no tiene la versión que informa el consumo.</strong>
            Su sistema no conoce el endpoint que trae los tokens, así que lo que se ve acá es lo que
            se haya podido traer antes (o nada). Se arregla solo cuando el cliente se actualice.
          </div>

          <div v-else-if="sync_status === 'failed'" class="alert alert-danger py-2 small mt-3 mb-0">
            {{ sync_message || 'La última recolección falló.' }}
          </div>

          <p v-if="nota_refresco" class="text-muted small fst-italic mt-3 mb-0">
            {{ nota_refresco }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'

/**
 * Pestaña "Tokens" del detalle del cliente (admin-spa).
 *
 * Muestra cuánto gastó ese cliente en IA: el total en dólares y en tokens, la serie por día, el
 * desglose por acción y por modelo, y el estado de la última recolección, con un botón para
 * traerla a mano.
 *
 * Tres cosas que NO se hacen acá, a propósito:
 *
 *  1. **No se calcula ningún costo en el front.** La tabla de precios vive en el admin-api y viaja
 *     ya aplicada. Si el precio de un modelo cambia, cambia en un solo lugar.
 *  2. **No se estrena una librería de gráficos.** Las barras por día son divs con alto porcentual:
 *     alcanza de sobra para una serie diaria y no le agrega peso ni riesgo al build.
 *  3. **No se inventa un costo cero.** Un modelo sin precio cargado llega con `costo_usd: null` y
 *     se muestra como "sin precio cargado". Cero significaría que no costó nada.
 *
 * El GET lee del espejo local del admin y no sale a la red, así que abrir la pestaña es barato. El
 * único camino que le pega al sistema del cliente es "Traer ahora", y por eso tiene su propio
 * spinner y su propio estado.
 */
export default {
  name: 'ClientTokensTab',
  props: {
    /** Cliente actualmente abierto en el modal de detalle de ResourceView. */
    record: { type: Object, default: null },
  },
  data() {
    return {
      // true mientras se hace la carga inicial (muestra el esqueleto entero).
      loading: false,
      // true mientras se recarga por un cambio de rango (no tapa lo que ya está en pantalla).
      recargando: false,
      // true mientras corre "Traer ahora".
      trayendo: false,
      // Mensaje de error de la carga (null = sin error).
      load_error: null,
      // Extremos del rango, en AAAA-MM-DD.
      desde: '',
      hasta: '',
      // Atajo activo, o null cuando las fechas se tocaron a mano.
      dias_elegidos: 30,
      // Totales del período, tal como los manda el backend.
      totales: {
        llamadas: 0,
        tokens: 0,
        costo_usd: 0,
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        modelos_sin_precio: [],
      },
      // Serie por día: [{ fecha, llamadas, tokens, costo_usd, ... }].
      por_dia: [],
      // Desglose por acción, ya ordenado por costo desde el backend.
      por_proceso: [],
      // Desglose por modelo, con `tiene_precio` resuelto por el backend.
      por_modelo: [],
      /*
       * Desglose por persona, ya plegado y ordenado por el backend. Viene SIN costo a propósito:
       * este corte no trae el modelo y sin modelo no hay precio (ver el panel "Por persona").
       */
      por_persona: [],
      // Estado persistido de la última recolección.
      sync_status: null,
      sync_message: '',
      sync_synced_at: null,
      /*
       * 🔴 Se deshabilita el botón solo cuando el `no_soportado` lo devolvió un intento de ESTA
       * sesión (molde: MensualidadTab). El estado persistido puede ser de hace días y el cliente
       * puede haberse actualizado desde entonces: dejarlo deshabilitado para siempre obligaría a
       * esperar a la corrida de la noche para poder siquiera probar.
       */
      no_soportado_en_esta_sesion: false,
      // Aviso cuando el refresco a mano tuvo que recortar el rango (lo manda el backend).
      nota_refresco: '',
      // Atajos de período. Tres alcanzan: el mes es el corte natural del gasto.
      atajos: [
        { dias: 7, label: '7 días' },
        { dias: 30, label: '30 días' },
        { dias: 90, label: '90 días' },
      ],
    }
  },
  computed: {
    /**
     * Días del rango completo, con los que no tuvieron consumo rellenados en cero.
     *
     * El backend solo devuelve los días que gastaron algo; un gráfico con los huecos tapados
     * miente sobre la forma de la serie (tres días salteados parecerían consecutivos).
     * @returns {Array<Object>}
     */
    dias_del_rango() {
      if (!this.desde || !this.hasta) {
        return []
      }
      const por_fecha = {}
      this.por_dia.forEach(function (fila) {
        por_fecha[String(fila.fecha || '').slice(0, 10)] = fila
      })

      const dias = []
      const cursor = new Date(this.desde + 'T00:00:00')
      const fin = new Date(this.hasta + 'T00:00:00')
      /* Red de seguridad, no un recorte real: el backend rechaza con 422 cualquier rango de más
         de 366 días, así que este bucle nunca llega a 400 vueltas con una respuesta legítima. Está
         para que un `desde`/`hasta` corrupto en el estado local no cuelgue el navegador. Si algún
         día sube el techo del backend, este número tiene que subir con él o la tarjeta de "N días"
         empieza a mentir. */
      let vueltas = 0
      while (cursor <= fin && vueltas < 400) {
        const clave =
          cursor.getFullYear() +
          '-' +
          String(cursor.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(cursor.getDate()).padStart(2, '0')
        dias.push(
          por_fecha[clave] || { fecha: clave, llamadas: 0, tokens: 0, costo_usd: 0 }
        )
        cursor.setDate(cursor.getDate() + 1)
        vueltas++
      }
      return dias
    },
    /**
     * El día más alto de la serie, que define el 100% de las barras.
     * @returns {number}
     */
    pico_de_la_serie() {
      let pico = 0
      this.dias_del_rango.forEach(function (dia) {
        if (Number(dia.tokens || 0) > pico) {
          pico = Number(dia.tokens || 0)
        }
      })
      return pico
    },
    /**
     * true si hubo algún consumo en el período.
     * @returns {boolean}
     */
    hay_consumo() {
      return this.pico_de_la_serie > 0
    },
    /**
     * true si el total dejó afuera algún modelo por no tener precio cargado.
     * @returns {boolean}
     */
    hay_sin_precio() {
      return Array.isArray(this.totales.modelos_sin_precio) && this.totales.modelos_sin_precio.length > 0
    },
    /**
     * Los modelos sin precio, listos para meter en una frase.
     *
     * Una fila con el `modelo` vacío es un caso real —el cliente no informó con qué modelo gastó—
     * y llega como cadena vacía. Sin esto, la frase queda "No incluye : sin precio cargado.", que
     * se lee como un error de la pantalla en vez de como el dato que es.
     * @returns {string}
     */
    modelos_sin_precio_texto() {
      const lista = Array.isArray(this.totales.modelos_sin_precio)
        ? this.totales.modelos_sin_precio
        : []
      return lista
        .map(function (modelo) {
          return String(modelo || '').trim() === '' ? '(sin modelo)' : String(modelo)
        })
        .join(', ')
    },
    /**
     * Texto de la línea de estado de la recolección.
     * @returns {string}
     */
    sync_texto() {
      if (this.sync_status === 'success') {
        return this.sync_synced_at
          ? 'Traído el ' + this.formatear_fecha_hora(this.sync_synced_at) + '.'
          : 'Traído.'
      }
      if (this.sync_status === 'no_soportado') {
        return 'El sistema de este cliente todavía no informa su consumo.'
      }
      if (this.sync_status === 'failed') {
        return 'La última recolección falló.'
      }
      return 'Todavía no se trajo nada de este cliente.'
    },
  },
  watch: {
    /** Si cambia el cliente abierto en el modal, recarga su consumo. */
    'record.id': function (nuevo_id, viejo_id) {
      if (nuevo_id && nuevo_id !== viejo_id) {
        this.elegir_atajo(this.dias_elegidos || 30)
      }
    },
  },
  mounted() {
    this.elegir_atajo(30)
  },
  methods: {
    /**
     * Fija el rango a los últimos N días y recarga.
     * @param {number} dias
     * @returns {void}
     */
    elegir_atajo(dias) {
      this.dias_elegidos = dias
      const hoy = new Date()
      const inicio = new Date()
      inicio.setDate(inicio.getDate() - (dias - 1))
      this.hasta = this.a_iso(hoy)
      this.desde = this.a_iso(inicio)
      this.cargar_consumo()
    },
    /**
     * Marca que las fechas se tocaron a mano (apaga el resaltado del atajo).
     * @returns {void}
     */
    fechas_a_mano() {
      this.dias_elegidos = null
    },
    /**
     * Fecha de un objeto Date en AAAA-MM-DD, en hora local (no UTC: `toISOString()` corre el día
     * para cualquiera que esté al oeste de Greenwich, que es todo el país).
     * @param {Date} fecha
     * @returns {string}
     */
    a_iso(fecha) {
      return (
        fecha.getFullYear() +
        '-' +
        String(fecha.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(fecha.getDate()).padStart(2, '0')
      )
    },
    /**
     * Trae el consumo del período (GET admin/client/{id}/tokens).
     * @param {boolean} recarga true cuando ya hay algo en pantalla y no se quiere tapar.
     * @returns {void}
     */
    cargar_consumo(recarga) {
      const self = this
      if (!this.record || !this.record.id) {
        return
      }
      if (recarga) {
        self.recargando = true
      } else {
        self.loading = true
      }
      self.load_error = null
      api
        .get('/client/' + this.record.id + '/tokens', {
          params: { desde: this.desde, hasta: this.hasta },
          silent_error: true,
        })
        .then(function (res) {
          self.aplicar_payload(res.data || {})
          self.loading = false
          self.recargando = false
        })
        .catch(function (error) {
          self.load_error = resolve_error_message(error)
          self.loading = false
          self.recargando = false
        })
    },
    /**
     * Le pide el consumo al sistema del cliente en el momento
     * (POST admin/client/{id}/tokens/sync) y aplica el payload que vuelve ya releído.
     * @returns {void}
     */
    traer_ahora() {
      const self = this
      if (!this.record || !this.record.id) {
        return
      }
      self.trayendo = true
      self.nota_refresco = ''
      api
        .post(
          '/client/' + this.record.id + '/tokens/sync',
          { desde: this.desde, hasta: this.hasta },
          { silent_error: true }
        )
        .then(function (res) {
          const cuerpo = res.data || {}
          self.aplicar_payload(cuerpo)
          self.trayendo = false
          self.avisar_del_refresco(cuerpo.refresco || {})
        })
        .catch(function (error) {
          self.trayendo = false
          window.dispatchEvent(
            new CustomEvent('admin-spa-toast', {
              detail: { message: resolve_error_message(error), variant: 'danger' },
            })
          )
        })
    },
    /**
     * Traduce el desenlace del refresco a un aviso, distinguiendo el 404 (versión vieja) de un
     * fallo real: son dos cosas distintas y el operador tiene que poder saber cuál le tocó.
     * @param {Object} refresco
     * @returns {void}
     */
    avisar_del_refresco(refresco) {
      this.nota_refresco = refresco.nota || ''

      if (refresco.estado === 'success') {
        window.dispatchEvent(
          new CustomEvent('admin-spa-toast', {
            detail: {
              message: 'Consumo actualizado (' + (refresco.filas || 0) + ' renglones).',
              variant: 'success',
            },
          })
        )
        return
      }

      if (refresco.estado === 'no_soportado') {
        this.no_soportado_en_esta_sesion = true
        window.dispatchEvent(
          new CustomEvent('admin-spa-toast', {
            detail: {
              message: 'Este cliente todavía no tiene la versión que informa el consumo.',
              variant: 'warning',
            },
          })
        )
        return
      }

      window.dispatchEvent(
        new CustomEvent('admin-spa-toast', {
          detail: { message: refresco.mensaje || 'No se pudo traer el consumo.', variant: 'danger' },
        })
      )
    },
    /**
     * Vuelca al estado local un payload del backend (respuesta del GET o del POST).
     * @param {Object} payload
     * @returns {void}
     */
    aplicar_payload(payload) {
      const cuerpo = payload || {}
      if (cuerpo.desde) {
        this.desde = String(cuerpo.desde)
      }
      if (cuerpo.hasta) {
        this.hasta = String(cuerpo.hasta)
      }
      if (cuerpo.totales) {
        this.totales = cuerpo.totales
      }
      this.por_dia = Array.isArray(cuerpo.por_dia) ? cuerpo.por_dia : []
      this.por_proceso = Array.isArray(cuerpo.por_proceso) ? cuerpo.por_proceso : []
      this.por_modelo = Array.isArray(cuerpo.por_modelo) ? cuerpo.por_modelo : []
      this.por_persona = Array.isArray(cuerpo.por_persona) ? cuerpo.por_persona : []

      const sync = cuerpo.sincronizacion || {}
      this.sync_status = sync.estado || null
      this.sync_message = sync.mensaje || ''
      this.sync_synced_at = sync.sincronizado_at || null
    },
    /**
     * Alto de la barra de un día, como porcentaje del día más alto de la serie.
     * @param {Object} dia
     * @returns {string}
     */
    alto_de(dia) {
      if (this.pico_de_la_serie <= 0) {
        return '0%'
      }
      const proporcion = Number(dia.tokens || 0) / this.pico_de_la_serie
      /* Un día con consumo pero chiquito tiene que verse: por debajo del 2% la barra desaparece y
       * se lee como "ese día no gastó nada", que es otra cosa. */
      if (proporcion > 0 && proporcion < 0.02) {
        return '2%'
      }
      return Math.round(proporcion * 100) + '%'
    },
    /**
     * Texto del tooltip de un día de la serie.
     * @param {Object} dia
     * @returns {string}
     */
    titulo_del_dia(dia) {
      return (
        this.fecha_larga(dia.fecha) +
        ': ' +
        this.numero(dia.tokens) +
        ' tokens · ' +
        this.costo_visible(dia.costo_usd)
      )
    },
    /**
     * Día y mes de una fecha ISO, para el pie de la barra.
     * @param {string} fecha
     * @returns {string}
     */
    dia_corto(fecha) {
      const partes = String(fecha || '').slice(0, 10).split('-')
      if (partes.length !== 3) {
        return ''
      }
      return partes[2] + '/' + partes[1]
    },
    /**
     * Fecha ISO en formato largo local.
     * @param {string} fecha
     * @returns {string}
     */
    fecha_larga(fecha) {
      const partes = String(fecha || '').slice(0, 10).split('-')
      if (partes.length !== 3) {
        return String(fecha || '')
      }
      return partes[2] + '/' + partes[1] + '/' + partes[0]
    },
    /**
     * Fecha y hora legible de un timestamp del backend.
     * @param {string} valor
     * @returns {string}
     */
    formatear_fecha_hora(valor) {
      const fecha = new Date(String(valor).replace(' ', 'T'))
      if (isNaN(fecha.getTime())) {
        return String(valor)
      }
      return fecha.toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    },
    /**
     * Número entero con separadores de miles.
     * @param {number} valor
     * @returns {string}
     */
    numero(valor) {
      return Number(valor || 0).toLocaleString('es-AR')
    },
    /**
     * Costo en dólares, listo para mostrar.
     *
     * 🔴 `null` NO se muestra como cero: se muestra como un guion. Cero significa "no costó nada"
     * y null significa "no sé cuánto costó"; mostrarlos igual es exactamente lo que el backend se
     * cuidó de no hacer.
     *
     * Los importes muy chicos van con cuatro decimales: con dos, medio centavo de gasto real se
     * ve como US$ 0,00 y parece que el registro no anduvo.
     * @param {number|null} valor
     * @returns {string}
     */
    costo_visible(valor) {
      if (valor === null || valor === undefined) {
        return '—'
      }
      const numero = Number(valor)
      if (numero > 0 && numero < 0.01) {
        return 'US$ ' + numero.toLocaleString('es-AR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
      }
      return (
        'US$ ' + numero.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      )
    },
  },
}
</script>

<style scoped>

/* 🔴 Los `.row` de Bootstrap traen margen horizontal NEGATIVO (-.5rem por lado con `g-3`) para
   compensar el padding que sus columnas ponen por dentro. Adentro de un contenedor sin padding
   horizontal ese margen no lo compensa nadie y la fila se sale 8px por la derecha: medido, 1360
   contra 1352. No tapa nada ni genera scroll de página, pero es ancho fantasma y se ve.

   Se le devuelve al contenedor el padding que el gutter espera —la mitad de `--bs-gutter-x` de
   `g-3`, o sea 8px—, que además es lo que deja el contenido de las columnas alineado con el de
   los paneles que NO están en una fila. */
.tokens-cuerpo {
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}
/* Tarjetas de cifra: fondo tenue, sin borde y sin sombra. El número es lo único que pesa. */
.tokens-cifra {
  background: #f7f7f8;
  border-radius: 0.75rem;
}

.tokens-cifra__rotulo {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #6c757d;
}

.tokens-cifra__valor {
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.tokens-cifra__pie {
  font-size: 0.75rem;
  color: #6c757d;
  margin-top: 0.25rem;
}

.tokens-panel {
  background: #ffffff;
  border: 1px solid #ededf0;
  border-radius: 0.75rem;
}

.tokens-panel__titulo {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #6c757d;
  font-weight: 600;
}

/* Serie por día: una columna por día, con scroll horizontal cuando no entran (teléfono con 90
   días). Nunca se achica la tipografía para que entre: se desplaza. */
.tokens-serie {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.tokens-serie__col {
  /* 🔴 28px y no 14px: "19/08" necesita 25px a 0.625rem (medido), y con la columna más angosta la
     etiqueta se sale de su caja y se pisa con la de al lado — a 820px la columna daba 21px y a
     360px, 14px. Una fecha cortada a la mitad es lo peor de los dos mundos: ni se lee ni se sabe
     que falta. Si con eso no entran todos los días, la serie scrollea, que es el patrón que ya
     usa el resto de la pantalla para lo ancho.
     El techo es para el otro extremo: con 7 días y `flex-grow`, las barras se volvían losas. */
  flex: 1 0 28px;
  min-width: 28px;
  max-width: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tokens-serie__pista {
  width: 100%;
  height: 120px;
  display: flex;
  align-items: flex-end;
  background: #f2f2f4;
  border-radius: 3px;
}

.tokens-serie__barra {
  width: 100%;
  background: #1f1f24;
  border-radius: 3px;
  transition: height 0.15s ease-out;
}

.tokens-serie__dia {
  font-size: 0.625rem;
  color: #8a8a8f;
  margin-top: 0.25rem;
  white-space: nowrap;
}

.tokens-tabla th {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #8a8a8f;
  font-weight: 600;
  border-bottom-width: 1px;
}

.tokens-tabla td {
  font-size: 0.875rem;
}

.tokens-tabla__nota {
  font-size: 0.7rem;
  color: #8a8a8f;
}

/* Teléfono: las etiquetas de los días se saltean solas por el scroll, y las columnas se achican
   lo justo para que la serie siga siendo legible. */
@media (max-width: 575.98px) {
  .tokens-cifra__valor {
    font-size: 1.4rem;
  }

  .tokens-serie__pista {
    height: 90px;
  }
}
</style>
