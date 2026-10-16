<template>
  <div class="recursos-busquedas">
    <p class="text-body-secondary small mb-3">
      Lo que los clientes escriben en el buscador de la página y no encuentran, o encuentran y no abren. Sirve para afinar
      los sinónimos del buscador con búsquedas reales. Las consultas se guardan 90 días, sin mails, links ni números largos.
    </p>

    <!-- Período. -->
    <form class="row g-2 align-items-end mb-3" @submit.prevent="cargar">
      <div class="col-6 col-md-auto">
        <label class="form-label small text-body-secondary mb-1" for="busquedas-desde">Desde</label>
        <input id="busquedas-desde" v-model="desde" type="date" class="form-control form-control-sm" :max="hasta || null" />
      </div>
      <div class="col-6 col-md-auto">
        <label class="form-label small text-body-secondary mb-1" for="busquedas-hasta">Hasta</label>
        <input id="busquedas-hasta" v-model="hasta" type="date" class="form-control form-control-sm" :min="desde || null" />
      </div>
      <div class="col-12 col-md-auto">
        <button type="submit" class="btn btn-outline-primary btn-sm w-100" :disabled="cargando || !periodo_valido">
          <span v-if="cargando" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
          Actualizar
        </button>
      </div>
      <div v-if="!periodo_valido" class="col-12">
        <small class="text-danger">La fecha «desde» no puede ser posterior a «hasta».</small>
      </div>
    </form>

    <div v-if="error" class="alert alert-danger d-flex flex-wrap align-items-center justify-content-between gap-2" role="alert">
      <span>{{ error }}</span>
      <button type="button" class="btn btn-outline-danger btn-sm" @click="cargar">Reintentar</button>
    </div>

    <div v-else-if="cargando && !cargado" class="text-center py-5 text-body-secondary">
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
      Cargando búsquedas...
    </div>

    <p v-else-if="cargado && !totales.busquedas" class="text-body-secondary fst-italic">
      No hay búsquedas registradas en este período. Si todavía no se ve ninguna, es que la página con el registro aún no se desplegó; si ya se desplegó, probá con un período más largo.
    </p>

    <template v-else-if="cargado">
      <!-- Totales. -->
      <div class="row g-2 mb-3">
        <div v-for="t in tarjetas" :key="t.clave" class="col-6 col-lg-3">
          <div class="card h-100 recursos-busquedas__tarjeta">
            <div class="card-body py-2 px-3">
              <div class="recursos-busquedas__numero">{{ t.valor }}</div>
              <div class="fw-semibold small">{{ t.titulo }}</div>
              <div v-if="t.detalle" class="small text-body-secondary">{{ t.detalle }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <span class="small text-body-secondary">Período: {{ periodo_texto }}</span>
        <button type="button" class="btn btn-primary btn-sm" @click="copiar_para_claude">Copiar para Claude</button>
      </div>

      <!-- Si el portapapeles no dejó copiar, el texto queda a mano para copiarlo a mano. -->
      <div v-if="texto_a_mano" class="mb-3">
        <label class="form-label small text-body-secondary mb-1" for="busquedas-texto-a-mano">
          No se pudo copiar solo: seleccioná el texto y copialo.
        </label>
        <textarea
          id="busquedas-texto-a-mano"
          ref="texto_a_mano_campo"
          class="form-control form-control-sm recursos-busquedas__texto"
          rows="10"
          readonly
          :value="texto_a_mano"
          @focus="$event.target.select()"
        />
      </div>

      <div class="card recursos-busquedas__panel mb-3">
        <div class="card-body">
          <h5 class="h6 mb-0">No encontraron nada, o encontraron algo que no calza</h5>
          <p class="small text-body-secondary mb-2">
            Consultas que no dieron resultados, o cuyo mejor resultado no tenía todo lo que buscaban. Las más repetidas
            primero.
          </p>
          <tabla-consultas :filas="sin_encontrar" vacio="Ninguna consulta quedó sin respuesta en este período." />
        </div>
      </div>

      <div class="card recursos-busquedas__panel mb-3">
        <div class="card-body">
          <h5 class="h6 mb-0">Nadie abrió ningún resultado</h5>
          <p class="small text-body-secondary mb-2">
            Consultas que sí devolvieron videos, pero nadie abrió ninguno: puede que el primero no fuera el que buscaban.
          </p>
          <tabla-consultas :filas="sin_clic" vacio="Todas las consultas con resultados terminaron en un video abierto." />
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import { copy_text_to_clipboard } from '@/utils/version_notification_clipboard'
import { campo, numero, avisar } from './recursos_admin'
import { texto_para_claude } from './busquedas_texto'
import TablaConsultas from './TablaConsultas.vue'

/** Cuántos días hacia atrás llega el período por defecto (hoy incluido: 30 días). */
const DIAS_POR_DEFECTO = 30

/**
 * Fecha como «AAAA-MM-DD» en hora local (`toISOString` la daría en UTC y de noche correría un día).
 *
 * @param {Date} fecha
 * @returns {string}
 */
function ymd(fecha) {
  /**
   * Dos dígitos.
   * @param {number} x
   * @returns {string}
   */
  const dos = function (x) {
    return String(x).padStart(2, '0')
  }
  return fecha.getFullYear() + '-' + dos(fecha.getMonth() + 1) + '-' + dos(fecha.getDate())
}

/**
 * Solapa «Búsquedas» del Centro de recursos (misión busquedas-centro-recursos, contrato C-BUSQ-2): lo que los
 * clientes buscan en recursos.comerciocity.com y no encuentran, o encuentran y no abren, en un período. Pide
 * `GET admin/recursos/busquedas?desde&hasta`. «Copiar para Claude» arma un texto para pegarle a una sesión y afinar
 * `src/recursos/sinonimos.js` con búsquedas reales.
 */
export default {
  name: 'PanelBusquedasRecursos',
  components: { TablaConsultas },
  data() {
    /** Hoy, y 29 días antes (30 días en total). */
    const hoy = new Date()
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - (DIAS_POR_DEFECTO - 1))
    return {
      /** Inicio del período (`AAAA-MM-DD`). */
      desde: ymd(inicio),
      /** Fin del período (`AAAA-MM-DD`). */
      hasta: ymd(hoy),
      /** Período de la respuesta que se está mostrando (puede diferir de los campos si se editaron sin actualizar). */
      periodo: { desde: '', hasta: '' },
      /** Totales de la respuesta. */
      totales: { busquedas: 0, sin_resultados: 0, incompletas: 0, sin_clic: 0, con_clic: 0 },
      /** Consultas que no encontraron nada o no calzaron. */
      sin_encontrar: [],
      /** Consultas con resultados que nadie abrió. */
      sin_clic: [],
      /** true cuando ya llegó al menos una respuesta. */
      cargado: false,
      /** true mientras se pide. */
      cargando: false,
      /** Error de carga, o null. */
      error: null,
      /** Texto para copiar a mano cuando el portapapeles no dejó, o ''. */
      texto_a_mano: '',
      /** Número del último pedido: una respuesta vieja que llega tarde no pisa a una más nueva. */
      numero_de_pedido: 0,
    }
  },
  computed: {
    /**
     * false si «desde» es posterior a «hasta» (el servidor lo rechazaría).
     * @returns {boolean}
     */
    periodo_valido() {
      return !this.desde || !this.hasta || this.desde <= this.hasta
    },
    /**
     * El período de la respuesta, para leer: «17/09/2026 al 16/10/2026».
     * @returns {string}
     */
    periodo_texto() {
      /**
       * «AAAA-MM-DD» como «dd/mm/aaaa».
       * @param {string} f
       * @returns {string}
       */
      const largo = function (f) {
        /** Partes. */
        const p = String(f || '').split('-')
        return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(f || '')
      }
      return largo(this.periodo.desde) + ' al ' + largo(this.periodo.hasta)
    },
    /**
     * Las cuatro tarjetas de totales.
     * @returns {Array<{ clave: string, titulo: string, valor: number, detalle: string }>}
     */
    tarjetas() {
      /** Total de búsquedas, para sacar porcentajes. */
      const total = this.totales.busquedas
      /**
       * «12 % de las búsquedas» (vacío si no hay búsquedas).
       * @param {number} n
       * @returns {string}
       */
      const parte = function (n) {
        return total ? Math.round((n / total) * 100) + ' % de las búsquedas' : ''
      }
      return [
        { clave: 'busquedas', titulo: 'Búsquedas', valor: total, detalle: this.totales.con_clic + ' con un video abierto' },
        { clave: 'sin_resultados', titulo: 'Sin resultados', valor: this.totales.sin_resultados, detalle: parte(this.totales.sin_resultados) },
        {
          clave: 'incompletas',
          titulo: 'Sin lo que buscaban',
          valor: this.totales.incompletas,
          detalle: 'Con resultados, pero ninguno tenía todas las palabras',
        },
        { clave: 'sin_clic', titulo: 'Sin clic', valor: this.totales.sin_clic, detalle: 'Con resultados, pero nadie abrió ninguno' },
      ]
    },
  },
  created() {
    this.cargar()
  },
  methods: {
    /**
     * Normaliza una fila de consulta del backend.
     * @param {Object} f
     * @returns {Object}
     */
    normalizar(f) {
      return {
        consulta: String(campo(f, ['consulta'], '')),
        veces: numero(campo(f, ['veces'], 0)),
        resultados_max: numero(campo(f, ['resultados_max'], 0)),
        sin_resultados: numero(campo(f, ['sin_resultados'], 0)),
        primero_codigo: campo(f, ['primero_codigo'], null),
        primero_titulo: campo(f, ['primero_titulo'], null),
        ultima: campo(f, ['ultima'], null),
      }
    },
    /**
     * Trae las búsquedas del período.
     * @returns {void}
     */
    cargar() {
      if (!this.periodo_valido) {
        return
      }
      const self = this
      /** Número de este pedido. */
      const mio = ++self.numero_de_pedido
      /** Parámetros: solo los que están completos (sin ellos el servidor usa los últimos 30 días). */
      const params = {}
      if (self.desde) {
        params.desde = self.desde
      }
      if (self.hasta) {
        params.hasta = self.hasta
      }
      self.cargando = true
      self.error = null
      api
        .get('/recursos/busquedas', { params: params, silent_error: true })
        .then(function (res) {
          if (mio !== self.numero_de_pedido) {
            return
          }
          /** Cuerpo de la respuesta. */
          const datos = res.data || {}
          /** Totales con ceros donde falte algo. */
          const t = datos.totales || {}
          self.totales = {
            busquedas: numero(t.busquedas),
            sin_resultados: numero(t.sin_resultados),
            incompletas: numero(t.incompletas),
            sin_clic: numero(t.sin_clic),
            con_clic: numero(t.con_clic),
          }
          self.sin_encontrar = (Array.isArray(datos.sin_encontrar) ? datos.sin_encontrar : []).map(self.normalizar)
          self.sin_clic = (Array.isArray(datos.sin_clic) ? datos.sin_clic : []).map(self.normalizar)
          self.periodo = { desde: campo(datos, ['desde'], self.desde), hasta: campo(datos, ['hasta'], self.hasta) }
          self.texto_a_mano = ''
          self.cargado = true
        })
        .catch(function (error) {
          if (mio !== self.numero_de_pedido) {
            return
          }
          self.error = resolve_error_message(error)
        })
        .then(function () {
          if (mio === self.numero_de_pedido) {
            self.cargando = false
          }
        })
    },
    /**
     * Copia al portapapeles el texto para pegarle a Claude. Si el navegador no deja, lo muestra en un recuadro para
     * copiarlo a mano.
     * @returns {void}
     */
    copiar_para_claude() {
      const self = this
      /** Texto armado con lo que se está viendo. */
      const texto = texto_para_claude(
        { totales: self.totales, sin_encontrar: self.sin_encontrar, sin_clic: self.sin_clic, desde: self.periodo.desde, hasta: self.periodo.hasta },
        self.periodo.desde,
        self.periodo.hasta
      )
      copy_text_to_clipboard(texto)
        .then(function () {
          self.texto_a_mano = ''
          avisar('Texto copiado: pegalo en una sesión de Claude.', 'success')
        })
        .catch(function () {
          self.texto_a_mano = texto
          avisar('No se pudo copiar solo: copialo del recuadro.', 'warning')
        })
    },
  },
}
</script>

<style scoped>
.recursos-busquedas__numero {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.1;
}
.recursos-busquedas__tarjeta,
.recursos-busquedas__panel {
  border: 1px solid var(--bs-border-color, #dee2e6);
  border-radius: 0.75rem;
}
.recursos-busquedas__texto {
  font-family: var(--bs-font-monospace, monospace);
  font-size: 0.8rem;
}
</style>
