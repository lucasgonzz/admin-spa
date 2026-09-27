<template>
  <div class="card border-0 imagenes-panel">
    <div class="card-body">
      <div class="d-flex flex-wrap align-items-baseline justify-content-between gap-2 mb-3">
        <p class="imagenes-panel__titulo mb-0">Registro de consultas</p>
        <p v-if="estado === 'ok'" class="imagenes-tabla__nota mb-0">
          {{ numero(total) }} {{ total === 1 ? 'consulta' : 'consultas' }}
        </p>
      </div>

      <!-- ============================================================ -->
      <!-- Filtros. Los tres viven en el orquestador (Index.vue) y      -->
      <!-- bajan por prop: la tabla de asignaciones y el aviso de       -->
      <!-- errores del resumen también los cambian.                     -->
      <!-- ============================================================ -->
      <!-- Con la nota del filtro por asignación abajo, la fila se le arrima (mb-2): la nota es de
           los filtros, no un párrafo aparte. -->
      <div class="d-flex flex-wrap align-items-center gap-2 gap-md-3" :class="filtros.asignacion ? 'mb-2' : 'mb-3'">
        <div class="btn-group btn-group-sm" role="group" aria-label="Tipo de consulta">
          <button
            v-for="opcion in tipos"
            :key="opcion.valor"
            type="button"
            class="btn"
            :class="(filtros.tipo || '') === opcion.valor ? 'btn-dark' : 'btn-outline-secondary'"
            @click="cambiar('tipo', opcion.valor)"
          >
            {{ opcion.label }}
          </button>
        </div>

        <select
          class="form-select form-select-sm imagenes-registro__asignacion"
          aria-label="Asignación"
          :value="filtros.asignacion ? String(filtros.asignacion) : ''"
          @change="cambiar('asignacion', $event.target.value ? Number($event.target.value) : null)"
        >
          <option value="">Todas las asignaciones</option>
          <option v-for="opcion in opciones_de_asignacion" :key="opcion.id" :value="String(opcion.id)">
            {{ opcion.label }}
          </option>
        </select>

        <div class="form-check form-switch mb-0">
          <input
            :id="id_solo_errores"
            class="form-check-input"
            type="checkbox"
            role="switch"
            :checked="!!filtros.solo_errores"
            @change="cambiar('solo_errores', $event.target.checked)"
          />
          <label class="form-check-label small" :for="id_solo_errores">Solo errores</label>
        </div>

        <span
          v-if="cargando && estado !== null"
          class="spinner-border spinner-border-sm text-secondary"
          role="status"
          aria-label="Cargando consultas"
        />
      </div>

      <!-- Con el filtro por asignación, los números de acá y los de la tabla de asignaciones no
           coinciden por dos motivos legítimos, y se dicen: el registro se corta en el período
           elegido (una asignación larga puede seguir antes o después) y trae también las consultas
           que fallaron, que la asignación no cuenta. -->
      <p v-if="filtros.asignacion" class="imagenes-tabla__nota mb-3">
        Dentro del período elegido; incluye las consultas que fallaron (la tabla de asignaciones
        cuenta solo las cobradas).
      </p>

      <!-- Primera carga del registro -->
      <div v-if="estado === null" class="text-muted small py-2">
        <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
        Cargando consultas...
      </div>

      <!-- El mismo texto que el cartel del orquestador (el del plan), y no el `mensaje` del
           admin-api, que nombra la ruta técnica: para quien mira la ficha es un solo hecho. -->
      <div v-else-if="estado === 'no_soportado'" class="alert alert-warning py-2 small mb-0">
        Este cliente todavía no tiene la versión que registra las consultas de imágenes; aparece
        sola cuando se actualice.
      </div>

      <div
        v-else-if="estado === 'error'"
        class="alert alert-danger py-2 small mb-0 d-flex flex-wrap align-items-center justify-content-between gap-2"
      >
        <span>{{ mensaje || 'No se pudo traer el registro del sistema del cliente.' }}</span>
        <button type="button" class="btn btn-outline-danger btn-sm" :disabled="cargando" @click="cargar(pagina)">
          Reintentar
        </button>
      </div>

      <p v-else-if="filas.length === 0" class="text-muted small fst-italic mb-0">
        {{ hay_filtros ? 'Ninguna consulta coincide con los filtros.' : 'Sin consultas en este período.' }}
      </p>

      <template v-else>
        <!-- La tabla scrollea sola cuando no entra (teléfono, tablet angosta): nunca se achica la
             letra para que entre. Mientras carga otra página, lo que está queda atenuado en vez
             de desaparecer: así no salta el alto del modal. -->
        <div class="table-responsive" :class="{ 'imagenes-registro--cargando': cargando }">
          <table class="table table-sm align-middle mb-0 imagenes-tabla imagenes-registro">
            <thead>
              <tr>
                <th>Cuándo</th>
                <th>Qué</th>
                <th>Artículo</th>
                <th>Consulta</th>
                <th>Resultado</th>
                <th class="text-end" title="Tokens de entrada / de salida">Tokens</th>
                <th class="text-end">Costo</th>
                <th class="text-end">Duración</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="fila in filas" :key="fila.id">
                <td class="text-nowrap" :title="fecha_hora_completa(fila.created_at)">
                  {{ fecha_hora_con_segundos(fila.created_at) }}
                </td>
                <td>
                  <span class="d-block text-nowrap">{{ etiqueta(etiquetas_de_tipo, fila.tipo) }}</span>
                  <code v-if="fila.tipo === 'validacion_ia' && fila.modelo" class="imagenes-registro__modelo">{{ fila.modelo }}</code>
                  <span v-else class="imagenes-tabla__nota d-block">{{ proveedor_visible(fila) }}</span>
                </td>
                <td class="imagenes-registro__articulo">
                  <span class="d-block">{{ articulo_visible(fila) }}</span>
                  <span v-if="detalle_del_articulo(fila)" class="imagenes-tabla__nota d-block">
                    {{ detalle_del_articulo(fila) }}
                  </span>
                </td>
                <td class="imagenes-registro__consulta" :title="fila.consulta || ''">{{ fila.consulta || '—' }}</td>
                <td class="imagenes-registro__resultado">
                  <span v-if="es_error(fila)" class="text-danger">{{ texto_de_error(fila) }}</span>
                  <span v-else>{{ resultado_visible(fila) }}</span>
                </td>
                <td class="text-end text-nowrap" :title="titulo_de_tokens(fila)">{{ tokens_visibles(fila) }}</td>
                <td class="text-end text-nowrap">
                  <!-- Tres casos que no se pueden parecer: no se cobró (cero sabido), no hay
                       precio cargado (no sé) y el importe. -->
                  <span v-if="no_cobrada(fila)" class="imagenes-tabla__nota">no cobrada</span>
                  <span v-else-if="fila.costo_usd === null || fila.costo_usd === undefined" class="imagenes-tabla__nota">
                    sin precio cargado
                  </span>
                  <span v-else>{{ costo_visible(fila.costo_usd) }}</span>
                </td>
                <td class="text-end text-nowrap">{{ duracion_visible(fila.duracion_ms) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <view-pagination
          :page="pagina"
          :total_pages="ultima_pagina"
          :total_results="total"
          :per_page="por_pagina_mostrada"
          :loading="cargando"
          @paginate="ir_a_pagina"
        />
      </template>
    </div>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import { nombre_proveedor } from '@/utils/ia'
import ViewPagination from '@/common-vue/components/view/Pagination.vue'
import {
  numero,
  costo_visible,
  etiqueta,
  duracion_visible,
  fecha_hora_con_segundos,
  fecha_hora_completa,
  fecha_hora_corta,
  ETIQUETAS_DE_TIPO,
  ETIQUETAS_DE_CRITERIO,
  ETIQUETAS_DE_ORIGEN_DE_ASIGNACION,
  NOMBRES_DE_PROVEEDOR_DE_BUSQUEDA,
} from './formato'

/**
 * Filas que se piden por página. Es el default del contrato (§12.1 del plan: `per_page=50`): con
 * menos, un catálogo de miles de consultas son cientos de páginas; con más, la tabla se vuelve un
 * muro en el teléfono.
 */
const POR_PAGINA = 50

/**
 * Registro de consultas de imágenes del cliente, consulta por consulta: cada búsqueda en Serper o
 * Google y cada validación con IA, con qué se buscó, qué devolvió, cuántos tokens gastó, cuánto
 * costó, cuánto tardó y, si falló, por qué.
 *
 * Es la parte del pedido de Lucas que no entra en ningún total: *"que quede registro de TODAS las
 * consultas"*. Le pregunta en vivo al sistema del cliente a través del admin-api
 * (`GET client/{id}/imagenes/consultas`), paginado en el servidor. Los filtros no son suyos: bajan
 * del orquestador y los cambia emitiendo `update:filtros`.
 *
 * No calcula plata: cada fila llega con `costo_usd` (null = sin precio cargado) desde el admin-api.
 */
export default {
  name: 'ClientImagenesRegistroConsultas',
  components: { ViewPagination },
  emits: ['update:filtros'],
  props: {
    /** Id del cliente abierto en el modal. */
    client_id: { type: [Number, String], required: true },
    /** Primer día del período aplicado, AAAA-MM-DD. */
    desde: { type: String, required: true },
    /** Último día del período aplicado, AAAA-MM-DD. */
    hasta: { type: String, required: true },
    /** Asignaciones del período (del resumen), para el selector. */
    asignaciones: { type: Array, default: () => [] },
    /** Filtros: `{ tipo: ''|'busqueda'|'validacion_ia', solo_errores: bool, asignacion: id|null }`. */
    filtros: { type: Object, required: true },
    /**
     * Contador que el orquestador sube con cada resumen bueno. Existe para que "Ver" (o
     * "Reintentar") con el MISMO período refresque también el registro: sin él, las cifras de
     * arriba se actualizan y las filas de abajo quedan viejas, porque ni el período ni los
     * filtros cambiaron.
     */
    recarga: { type: Number, default: 0 },
  },
  data() {
    return {
      // true mientras hay un pedido en vuelo.
      cargando: false,
      // Desenlace del último pedido: null (nunca respondió), ok, no_soportado o error.
      estado: null,
      // Motivo cuando no es ok.
      mensaje: '',
      // Filas de la página actual, cada una con `costo_usd` y `tiene_precio`.
      filas: [],
      // Página actual y última, según el paginador del cliente.
      pagina: 1,
      ultima_pagina: 1,
      // Total de consultas que cumplen los filtros.
      total: 0,
      // Filas por página que informó el servidor (para la leyenda del paginador).
      por_pagina_mostrada: POR_PAGINA,
      /*
       * Número del último pedido lanzado. Si el operador cambia de filtro dos veces rápido, la
       * primera respuesta puede llegar DESPUÉS de la segunda: sin esto, la tabla terminaría
       * mostrando el filtro viejo con el selector en el nuevo.
       */
      pedido_actual: 0,
      // Mapa de etiquetas del tipo, expuesto al template.
      etiquetas_de_tipo: ETIQUETAS_DE_TIPO,
      // Las tres opciones del filtro de tipo (vacío = todas).
      tipos: [
        { valor: '', label: 'Todas' },
        { valor: 'busqueda', label: 'Búsquedas' },
        { valor: 'validacion_ia', label: 'Validaciones con IA' },
      ],
    }
  },
  computed: {
    /**
     * Una sola clave con todo lo que define qué se pide. Mirarla a ella (y no a cada prop por
     * separado) hace que un cambio de período que además limpia la asignación dispare UN pedido,
     * no dos.
     * @returns {string}
     */
    clave_de_consulta() {
      return [
        this.client_id,
        this.desde,
        this.hasta,
        this.filtros.tipo || '',
        this.filtros.solo_errores ? 1 : 0,
        this.filtros.asignacion || '',
        this.recarga,
      ].join('|')
    },
    /**
     * true si hay algún filtro puesto: cambia el texto de la tabla vacía.
     * @returns {boolean}
     */
    hay_filtros() {
      return !!(this.filtros.tipo || this.filtros.solo_errores || this.filtros.asignacion)
    },
    /**
     * Opciones del selector de asignación: las asignaciones del período, y ninguna más.
     *
     * 🔴 Un solo criterio para una asignación que no está en la lista del período, y lo aplica el
     * orquestador (`Index.vue`, `aplicar_datos()`): al cambiar el período, si la asignación filtrada
     * ya no está en la lista, SACA el filtro. Por eso acá no hace falta contemplar una filtrada
     * que no esté entre las opciones: no puede pasar.
     * @returns {Array<{id: number, label: string}>}
     */
    opciones_de_asignacion() {
      const opciones = []
      this.asignaciones.forEach(function (asignacion) {
        const id = Number(asignacion.id)
        opciones.push({
          id: id,
          label:
            '#' + id + ' · ' + etiqueta(ETIQUETAS_DE_ORIGEN_DE_ASIGNACION, asignacion.origen) +
            ' · ' + fecha_hora_corta(asignacion.created_at),
        })
      })
      return opciones
    },
    /**
     * Id único del interruptor "Solo errores" (el label lo necesita para ser clickeable).
     * @returns {string}
     */
    id_solo_errores() {
      return 'imagenes-solo-errores-' + this.client_id
    },
  },
  watch: {
    /** Cualquier cambio de período o de filtro vuelve a la primera página. */
    clave_de_consulta() {
      this.cargar(1)
    },
  },
  mounted() {
    this.cargar(1)
  },
  methods: {
    /**
     * Trae una página del registro (GET admin/client/{id}/imagenes/consultas).
     * @param {number} pagina Página a traer (1-based).
     * @returns {void}
     */
    cargar(pagina) {
      const self = this
      if (!this.client_id || !this.desde || !this.hasta) {
        return
      }

      self.pedido_actual++
      const este_pedido = self.pedido_actual
      self.cargando = true

      const params = {
        desde: this.desde,
        hasta: this.hasta,
        page: pagina || 1,
        per_page: POR_PAGINA,
        solo_errores: this.filtros.solo_errores ? 1 : 0,
      }
      if (this.filtros.tipo) {
        params.tipo = this.filtros.tipo
      }
      if (this.filtros.asignacion) {
        params.asignacion = this.filtros.asignacion
      }

      api
        .get('/client/' + this.client_id + '/imagenes/consultas', { params: params, silent_error: true })
        .then(function (res) {
          if (este_pedido !== self.pedido_actual) {
            return
          }
          const cuerpo = res.data || {}
          self.estado = cuerpo.estado || 'error'
          self.mensaje = cuerpo.mensaje || ''

          const paginador = cuerpo.estado === 'ok' && cuerpo.datos && cuerpo.datos.models ? cuerpo.datos.models : null
          self.filas = paginador && Array.isArray(paginador.data) ? paginador.data : []
          self.pagina = paginador ? Number(paginador.current_page || 1) : 1
          self.ultima_pagina = paginador ? Number(paginador.last_page || 1) : 1
          self.total = paginador ? Number(paginador.total || self.filas.length) : 0
          self.por_pagina_mostrada = paginador && paginador.per_page ? Number(paginador.per_page) : POR_PAGINA
          self.cargando = false
        })
        .catch(function (error) {
          if (este_pedido !== self.pedido_actual) {
            return
          }
          self.estado = 'error'
          self.mensaje = resolve_error_message(error)
          self.filas = []
          self.cargando = false
        })
    },
    /**
     * Cambio de página desde el paginador: trae la página y sube la vista al principio del
     * registro (el paginador queda abajo de cincuenta filas; sin esto, la página nueva arranca
     * fuera de la vista).
     * @param {number} pagina
     * @returns {void}
     */
    ir_a_pagina(pagina) {
      this.cargar(pagina)
      if (this.$el && typeof this.$el.scrollIntoView === 'function') {
        this.$el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    },
    /**
     * Cambia un filtro: no lo toca acá, le pide al orquestador que lo cambie.
     * @param {string} clave tipo | solo_errores | asignacion
     * @param {*} valor
     * @returns {void}
     */
    cambiar(clave, valor) {
      const nuevos = Object.assign({}, this.filtros)
      nuevos[clave] = valor
      this.$emit('update:filtros', nuevos)
    },
    /**
     * true si la consulta terminó en error (el proveedor o la IA no respondieron bien).
     * @param {Object} fila
     * @returns {boolean}
     */
    es_error(fila) {
      return fila.ok === false || fila.ok === 0 || (!!fila.error && String(fila.error).trim() !== '')
    },
    /**
     * El error de una consulta, con el código HTTP cuando lo hubo.
     * @param {Object} fila
     * @returns {string}
     */
    texto_de_error(fila) {
      const texto = fila.error && String(fila.error).trim() !== '' ? String(fila.error) : 'Error sin detalle'
      return fila.http_status ? texto + ' (HTTP ' + fila.http_status + ')' : texto
    },
    /**
     * Qué devolvió la consulta: el `resumen` legible que arma el cliente ("10 resultados",
     * "2 sí, 1 no, 1 dudosa"), o lo que se pueda decir con los contadores si no vino.
     * @param {Object} fila
     * @returns {string}
     */
    resultado_visible(fila) {
      if (fila.resumen && String(fila.resumen).trim() !== '') {
        return String(fila.resumen)
      }
      if (fila.resultados !== null && fila.resultados !== undefined) {
        return numero(fila.resultados) + (Number(fila.resultados) === 1 ? ' resultado' : ' resultados')
      }
      if (fila.candidatas !== null && fila.candidatas !== undefined) {
        return numero(fila.candidatas) + (Number(fila.candidatas) === 1 ? ' candidata' : ' candidatas')
      }
      return '—'
    },
    /**
     * Proveedor de una búsqueda ("Serper", "Google") o de una validación sin modelo ("Claude").
     * @param {Object} fila
     * @returns {string}
     */
    proveedor_visible(fila) {
      if (fila.tipo === 'busqueda') {
        return etiqueta(NOMBRES_DE_PROVEEDOR_DE_BUSQUEDA, fila.proveedor)
      }
      return nombre_proveedor(fila.proveedor)
    },
    /**
     * Nombre del artículo, o su número si el cliente no lo informó, o un guion.
     * @param {Object} fila
     * @returns {string}
     */
    articulo_visible(fila) {
      if (fila.article_name && String(fila.article_name).trim() !== '') {
        return String(fila.article_name)
      }
      if (fila.article_id) {
        return 'Artículo #' + fila.article_id
      }
      return '—'
    },
    /**
     * La línea chica de abajo del artículo: con qué criterio se buscó y de dónde vino la consulta
     * (una asignación, con su número, o una validación suelta del asistente).
     * @param {Object} fila
     * @returns {string}
     */
    detalle_del_articulo(fila) {
      const partes = []
      if (fila.criterio) {
        partes.push(etiqueta(ETIQUETAS_DE_CRITERIO, fila.criterio))
      }
      if (fila.run_id) {
        partes.push('asignación #' + fila.run_id)
      } else if (fila.origen === 'validacion_individual') {
        partes.push('validación suelta')
      }
      return partes.join(' · ')
    },
    /**
     * Tokens de una validación con IA ("3.000 / 150": entrada / salida), o un guion para una
     * búsqueda (que no gasta tokens).
     * @param {Object} fila
     * @returns {string}
     */
    tokens_visibles(fila) {
      if (fila.tipo !== 'validacion_ia') {
        return '—'
      }
      const entrada = Number(fila.tokens_entrada || 0)
      const salida = Number(fila.tokens_salida || 0)
      if (entrada === 0 && salida === 0) {
        return '—'
      }
      return numero(entrada) + ' / ' + numero(salida)
    },
    /**
     * El detalle completo de tokens, con la caché, para el `title` de la celda.
     * @param {Object} fila
     * @returns {string}
     */
    titulo_de_tokens(fila) {
      if (fila.tipo !== 'validacion_ia') {
        return ''
      }
      return (
        numero(fila.tokens_entrada) + ' de entrada · ' +
        numero(fila.tokens_salida) + ' de salida · ' +
        numero(fila.tokens_cache_escritura) + ' escritos en caché · ' +
        numero(fila.tokens_cache_lectura) + ' leídos de caché'
      )
    },
    /**
     * true si la consulta no se cobró (el proveedor o la IA rechazaron): cero sabido, no "sin precio".
     * @param {Object} fila
     * @returns {boolean}
     */
    no_cobrada(fila) {
      return fila.cobrada === false || fila.cobrada === 0
    },
    /**
     * Traducción de un id con un mapa de etiquetas, expuesta para el template.
     * @param {Object<string, string>} mapa
     * @param {string} clave
     * @returns {string}
     */
    etiqueta(mapa, clave) {
      return etiqueta(mapa, clave)
    },
    /**
     * Número con separadores de miles, expuesto para el template.
     * @param {number|null} valor
     * @returns {string}
     */
    numero(valor) {
      return numero(valor)
    },
    /**
     * Costo en dólares, expuesto para el template.
     * @param {number|null} valor
     * @returns {string}
     */
    costo_visible(valor) {
      return costo_visible(valor)
    },
    /**
     * Duración legible, expuesta para el template.
     * @param {number|null} ms
     * @returns {string}
     */
    duracion_visible(ms) {
      return duracion_visible(ms)
    },
    /**
     * Fecha y hora con segundos, expuesta para el template.
     * @param {string} valor
     * @returns {string}
     */
    fecha_hora_con_segundos(valor) {
      return fecha_hora_con_segundos(valor)
    },
    /**
     * Fecha y hora completas, para el `title`.
     * @param {string} valor
     * @returns {string}
     */
    fecha_hora_completa(valor) {
      return fecha_hora_completa(valor)
    },
  },
}
</script>
