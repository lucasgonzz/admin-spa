<template>
  <div class="p-3 imagenes-tab">
    <!-- Sin cliente guardado todavía: no hay a quién preguntarle -->
    <p v-if="!record || !record.id" class="text-muted small fst-italic mb-0">
      Guardá el cliente primero para ver sus consultas de imágenes.
    </p>

    <template v-else>
      <!-- ============================================================ -->
      <!-- Primera carga. Dice "consultando al sistema del cliente" y   -->
      <!-- no "cargando" a secas: acá no hay espejo local, se le        -->
      <!-- pregunta en vivo a su empresa-api y puede tardar unos        -->
      <!-- segundos. Que el texto lo diga evita el "se colgó".          -->
      <!-- ============================================================ -->
      <div v-if="cargando && !ya_respondio" class="text-center py-4">
        <span class="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true" />
        <p class="text-muted small mt-2 mb-0">Consultando al sistema del cliente...</p>
      </div>

      <!-- ============================================================ -->
      <!-- 🔴 Cliente con una versión anterior: es el caso MAYORITARIO  -->
      <!-- durante semanas después del deploy, y no es un error. Sin    -->
      <!-- este cartel, un cliente viejo se vería igual que uno que no  -->
      <!-- buscó ninguna imagen. No hay período ni tablas: no hay nada  -->
      <!-- que mirar hasta que se actualice.                            -->
      <!-- ============================================================ -->
      <div v-else-if="estado === 'no_soportado'" class="alert alert-warning small mb-0">
        Este cliente todavía no tiene la versión que registra las consultas de imágenes; aparece
        sola cuando se actualice.
      </div>

      <div v-else class="imagenes-cuerpo">
        <!-- ============================================================ -->
        <!-- Período. Los atajos llegan a 60 días y no a 90 como en       -->
        <!-- Tokens: el sistema del cliente acepta hasta 62 por consulta. -->
        <!-- ============================================================ -->
        <div class="mb-4">
          <div class="d-flex flex-wrap align-items-end gap-3">
            <div>
              <label class="form-label small text-muted mb-1 d-block">Período</label>
              <div class="btn-group btn-group-sm" role="group">
                <!-- Deshabilitados mientras hay un pedido en vuelo, igual que "Ver": cada toque es una
                     consulta en vivo al sistema del cliente, y apilar tres no hace que llegue antes. -->
                <button
                  v-for="opcion in atajos"
                  :key="opcion.dias"
                  type="button"
                  class="btn"
                  :class="dias_elegidos === opcion.dias ? 'btn-dark' : 'btn-outline-secondary'"
                  :disabled="cargando"
                  @click="elegir_atajo(opcion.dias)"
                >
                  {{ opcion.label }}
                </button>
              </div>
            </div>

            <div>
              <label class="form-label small text-muted mb-1" :for="'imagenes-desde-' + record.id">Desde</label>
              <input
                :id="'imagenes-desde-' + record.id"
                v-model="desde"
                type="date"
                class="form-control form-control-sm"
                @change="fechas_a_mano"
              />
            </div>

            <div>
              <label class="form-label small text-muted mb-1" :for="'imagenes-hasta-' + record.id">Hasta</label>
              <input
                :id="'imagenes-hasta-' + record.id"
                v-model="hasta"
                type="date"
                class="form-control form-control-sm"
                @change="fechas_a_mano"
              />
            </div>

            <button
              type="button"
              class="btn btn-outline-primary btn-sm"
              :disabled="cargando || problema_del_rango !== ''"
              @click="cargar_resumen"
            >
              <span v-if="cargando" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
              Ver
            </button>
          </div>

          <!-- Se avisa antes de pedir: el admin lo rechazaría igual con un 422, pero así el operador
               lo ve al lado de las fechas y sin esperar. -->
          <p v-if="problema_del_rango" class="small text-danger mt-2 mb-0">{{ problema_del_rango }}</p>
        </div>

        <div
          v-if="estado === 'error'"
          class="alert alert-danger py-2 small mb-4 d-flex flex-wrap align-items-center justify-content-between gap-2"
        >
          <span>{{ mensaje || 'No se pudo consultar al sistema del cliente.' }}</span>
          <button type="button" class="btn btn-outline-danger btn-sm" :disabled="cargando" @click="cargar_resumen">
            Reintentar
          </button>
        </div>

        <template v-if="datos">
          <resumen-cifras class="mb-4" :totales="datos.totales" @ver-errores="ver_solo_errores" />

          <tabla-por-dia class="mb-4" :dias="datos.dias" />

          <tabla-asignaciones
            class="mb-4"
            :asignaciones="datos.asignaciones"
            :asignacion_filtrada="filtros.asignacion"
            @elegir="filtrar_por_asignacion"
          />

          <registro-consultas
            ref="registro"
            :client_id="record.id"
            :desde="rango.desde"
            :hasta="rango.hasta"
            :asignaciones="datos.asignaciones"
            :filtros="filtros"
            :recarga="recarga"
            @update:filtros="actualizar_filtros"
          />
        </template>
      </div>
    </template>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import ResumenCifras from './ResumenCifras.vue'
import TablaPorDia from './TablaPorDia.vue'
import TablaAsignaciones from './TablaAsignaciones.vue'
import RegistroConsultas from './RegistroConsultas.vue'

/**
 * Techo de días por consulta: el mismo 62 que valida el admin-api y el endpoint del cliente.
 * Se chequea también acá para avisarlo al lado de las fechas, sin ir a la red.
 */
const MAX_DIAS = 62

/**
 * Solapa "Imágenes" de la ficha del cliente (admin-spa), misión imagenes-catalogo-completo §12.3.
 *
 * El pedido de Lucas: *"que quede registro de todas las consultas que se hacen tanto a esta nueva
 * API para obtener las imágenes como a la IA para chequear si la imagen pertenece al artículo, y
 * poder verlo desde el admin en cada cliente"*. Esta solapa es ese "verlo":
 *
 *   - las cifras del período (búsquedas por proveedor, validaciones con IA, tokens y el costo
 *     estimado en dólares),
 *   - la tabla por día,
 *   - las asignaciones del período (tocar una filtra el registro por ella),
 *   - y el registro de consultas, fila por fila, paginado y con filtros.
 *
 * Es el orquestador: pide el resumen, guarda el período aplicado y los filtros del registro (que
 * comparten la tabla de asignaciones, el aviso de errores y el registro), y reparte. El registro
 * pide sus propias páginas.
 *
 * Tres decisiones, las tres a propósito:
 *
 *  1. 🔴 **Nada se calcula en el front.** El costo viaja ya aplicado desde el admin-api, con null
 *     cuando no hay precio: si cambia la tabla de precios, cambia en un solo lugar.
 *  2. **El registro se pide DESPUÉS del resumen, no en paralelo.** Si el cliente tiene una versión
 *     vieja, el resumen ya lo dice (`no_soportado`) y no tiene sentido pegarle una segunda vez para
 *     enterarse de lo mismo: con cuarenta y cinco clientes y casi todos viejos las primeras semanas,
 *     eso es la mitad de los pedidos al pedo.
 *  3. **Mismo lenguaje visual que la solapa Tokens** (tarjetas tenues, paneles con borde fino,
 *     encabezados en versalitas grises): son dos solapas de plata de la misma ficha y se tienen que
 *     leer igual. El admin no tiene modo oscuro (ver `src/sass/_tokens.sass`), así que no hay una
 *     segunda paleta.
 */
export default {
  name: 'ClientImagenesTab',
  components: { ResumenCifras, TablaPorDia, TablaAsignaciones, RegistroConsultas },
  /*
   * El modal le pasa a toda solapa extra el borrador, las propiedades y el nombre del modelo
   * (`extra_tab_scope`). Esta solapa solo usa `record`: sin esto, el resto terminaría como
   * atributos HTML del div raíz (`all_properties="[object Object]"`).
   */
  inheritAttrs: false,
  props: {
    /** Cliente abierto en el modal de detalle de ResourceView. */
    record: { type: Object, default: null },
  },
  data() {
    return {
      // true mientras hay un pedido del resumen en vuelo.
      cargando: false,
      // true después de la primera respuesta (buena o mala): separa "primera carga" de "recarga".
      ya_respondio: false,
      // Desenlace del último resumen: null, ok, no_soportado o error.
      estado: null,
      // Motivo cuando no es ok.
      mensaje: '',
      // Datos del último resumen bueno (totales, dias, modelos, asignaciones), o null.
      datos: null,
      // Fechas de los inputs, en AAAA-MM-DD. Se aplican recién con "Ver" o con un atajo.
      desde: '',
      hasta: '',
      // Atajo activo, o null cuando las fechas se tocaron a mano.
      dias_elegidos: 30,
      /*
       * Período APLICADO: el del último resumen bueno. Es el que usa el registro, así sus filas
       * siempre corresponden a las cifras de arriba aunque el operador esté tocando las fechas.
       */
      rango: { desde: '', hasta: '' },
      // Filtros del registro. Viven acá porque los cambian tres componentes distintos.
      filtros: { tipo: '', solo_errores: false, asignacion: null },
      // Sube con cada resumen bueno: le avisa al registro que refresque aunque nada más cambie.
      recarga: 0,
      // Número del último pedido del resumen (una respuesta vieja no pisa a una nueva).
      pedido_actual: 0,
      // Atajos de período: hasta 60 días, adentro del techo de 62 del sistema del cliente.
      atajos: [
        { dias: 7, label: '7 días' },
        { dias: 30, label: '30 días' },
        { dias: 60, label: '60 días' },
      ],
    }
  },
  computed: {
    /**
     * Cuántos días abarcan las fechas de los inputs (contando los dos extremos), o 0 si falta alguna.
     * @returns {number}
     */
    dias_del_rango_elegido() {
      if (!this.desde || !this.hasta) {
        return 0
      }
      const inicio = new Date(this.desde + 'T00:00:00')
      const fin = new Date(this.hasta + 'T00:00:00')
      if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
        return 0
      }
      // Math.round y no floor: un día con cambio de hora dura 23 o 25 horas.
      return Math.round((fin.getTime() - inicio.getTime()) / 86400000) + 1
    },
    /**
     * Qué tiene de malo el período elegido, o vacío si está bien.
     * @returns {string}
     */
    problema_del_rango() {
      if (!this.desde || !this.hasta) {
        return 'Elegí las dos fechas.'
      }
      if (this.desde > this.hasta) {
        return 'La fecha "desde" no puede ser posterior a "hasta".'
      }
      if (this.dias_del_rango_elegido > MAX_DIAS) {
        // "por vez" y no "por consulta": en esta solapa una consulta es una fila del registro (una
        // búsqueda o una validación), no el pedido al sistema del cliente.
        return 'El sistema del cliente acepta hasta ' + MAX_DIAS + ' días por vez. Achicá el período.'
      }
      return ''
    },
  },
  watch: {
    /**
     * Si cambia el cliente abierto en el modal, arranca de cero con el mismo atajo.
     *
     * 🔴 Limpia TODO lo del cliente anterior antes de pedir: sin esto, mientras llega la respuesta
     * del nuevo, la solapa seguiría mostrando las cifras, las asignaciones y el registro del cliente
     * anterior bajo el nombre del nuevo (y `ya_respondio` en true saltearía el "Consultando…").
     */
    'record.id': function (nuevo_id, viejo_id) {
      if (nuevo_id && nuevo_id !== viejo_id) {
        this.datos = null
        this.estado = null
        this.mensaje = ''
        this.ya_respondio = false
        this.rango = { desde: '', hasta: '' }
        this.filtros = { tipo: '', solo_errores: false, asignacion: null }
        this.elegir_atajo(this.dias_elegidos || 30)
      }
    },
  },
  mounted() {
    this.elegir_atajo(30)
  },
  methods: {
    /**
     * Fija el período a los últimos N días (contando hoy) y lo aplica.
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
      this.cargar_resumen()
    },
    /**
     * Marca que las fechas se tocaron a mano (apaga el resaltado del atajo). No pide nada: el
     * período se aplica con "Ver".
     * @returns {void}
     */
    fechas_a_mano() {
      this.dias_elegidos = null
    },
    /**
     * Fecha de un objeto Date en AAAA-MM-DD, en hora local (`toISOString()` usa UTC y correría el
     * día a partir de las 21 h en todo el país).
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
     * Pide el resumen del período elegido (GET admin/client/{id}/imagenes/resumen).
     *
     * Con `ok` se aplica el período (y con él se recarga el registro). Con `no_soportado` se
     * muestra el cartel y nada más. Con un error se limpia lo que había: dejar las cifras del
     * período anterior al lado de las fechas nuevas sería mostrar un número que no corresponde.
     * @returns {void}
     */
    cargar_resumen() {
      const self = this
      if (!this.record || !this.record.id || this.problema_del_rango !== '') {
        return
      }

      self.pedido_actual++
      const este_pedido = self.pedido_actual
      const desde = this.desde
      const hasta = this.hasta
      self.cargando = true

      api
        .get('/client/' + this.record.id + '/imagenes/resumen', {
          params: { desde: desde, hasta: hasta },
          silent_error: true,
        })
        .then(function (res) {
          if (este_pedido !== self.pedido_actual) {
            return
          }
          const cuerpo = res.data || {}
          self.estado = cuerpo.estado || 'error'
          self.mensaje = cuerpo.mensaje || ''

          if (cuerpo.estado === 'ok' && cuerpo.datos) {
            self.aplicar_datos(cuerpo.datos, desde, hasta)
          } else {
            self.datos = null
          }

          self.cargando = false
          self.ya_respondio = true
        })
        .catch(function (error) {
          if (este_pedido !== self.pedido_actual) {
            return
          }
          self.estado = 'error'
          self.mensaje = resolve_error_message(error)
          self.datos = null
          self.cargando = false
          self.ya_respondio = true
        })
    },
    /**
     * Vuelca un resumen bueno: normaliza los bloques (un cliente con una versión intermedia podría
     * no mandar alguno), aplica el período y suelta el filtro de asignación si esa asignación ya no
     * es del período nuevo.
     *
     * 🔴 Ese es el ÚNICO criterio para una asignación que no está en la lista del período: se saca
     * el filtro, acá. El registro (`RegistroConsultas.vue`) no contempla una filtrada fuera de la
     * lista, justamente porque esto garantiza que no la va a recibir: con los dos criterios a la vez
     * (uno la sacaba y el otro la mostraba) la pantalla dependía de cuál corría primero.
     * @param {Object} datos Bloque `datos` de la respuesta.
     * @param {string} desde Período pedido.
     * @param {string} hasta
     * @returns {void}
     */
    aplicar_datos(datos, desde, hasta) {
      const normalizados = {
        totales: datos.totales || {},
        dias: Array.isArray(datos.dias) ? datos.dias : [],
        modelos: Array.isArray(datos.modelos) ? datos.modelos : [],
        asignaciones: Array.isArray(datos.asignaciones) ? datos.asignaciones : [],
      }

      const filtrada = this.filtros.asignacion
      if (filtrada) {
        const sigue = normalizados.asignaciones.some(function (asignacion) {
          return Number(asignacion.id) === Number(filtrada)
        })
        if (!sigue) {
          this.filtros = Object.assign({}, this.filtros, { asignacion: null })
        }
      }

      this.datos = normalizados
      this.rango = { desde: desde, hasta: hasta }
      this.recarga++
    },
    /**
     * Filtra el registro por una asignación (o saca el filtro con null) y lo trae a la vista.
     * @param {number|null} asignacion_id
     * @returns {void}
     */
    filtrar_por_asignacion(asignacion_id) {
      this.filtros = Object.assign({}, this.filtros, { asignacion: asignacion_id })
      if (asignacion_id) {
        this.llevar_al_registro()
      }
    },
    /**
     * "Ver solo esas" del aviso de errores: todos los errores del período, sin otro filtro.
     * @returns {void}
     */
    ver_solo_errores() {
      this.filtros = { tipo: '', solo_errores: true, asignacion: null }
      this.llevar_al_registro()
    },
    /**
     * Los filtros que cambió el propio registro.
     * @param {Object} nuevos
     * @returns {void}
     */
    actualizar_filtros(nuevos) {
      this.filtros = Object.assign({ tipo: '', solo_errores: false, asignacion: null }, nuevos || {})
    },
    /**
     * Desplaza el modal hasta el registro, después de que Vue pinte el cambio.
     * @returns {void}
     */
    llevar_al_registro() {
      const self = this
      this.$nextTick(function () {
        const registro = self.$refs.registro
        if (registro && registro.$el && typeof registro.$el.scrollIntoView === 'function') {
          registro.$el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      })
    },
  },
}
</script>

<style>
/*
 * Estilos de TODA la carpeta `client/imagenes/`, sin `scoped` a propósito: los cinco componentes
 * comparten el mismo lenguaje (tarjetas, paneles, tablas) y con `scoped` habría que copiarlo en
 * cada uno. Todo va colgado de `.imagenes-tab`, la clase del div raíz de este orquestador, así que
 * no se escapa a ninguna otra pantalla.
 *
 * Los valores son los de `TokensTab.vue` (tarjeta #f7f7f8, borde #ededf0, grises #6c757d/#8a8a8f):
 * son las dos solapas de plata de la ficha y se tienen que leer igual. Donde hay un token de
 * `_tokens.sass` se usa, con el valor de Tokens como respaldo.
 */

/* 🔴 Los `.row` de Bootstrap traen margen horizontal negativo para compensar el padding de sus
   columnas: adentro de un contenedor sin padding horizontal la fila se sale 8px por la derecha
   (medido en Tokens). Se le devuelve al contenedor la mitad del gutter de `g-3`. */
.imagenes-tab .imagenes-cuerpo {
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}

/* Tarjetas de cifra: fondo tenue, sin borde y sin sombra. El número es lo único que pesa. */
.imagenes-tab .imagenes-cifra {
  background: #f7f7f8;
  border-radius: 0.75rem;
}

.imagenes-tab .imagenes-cifra__rotulo {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-secondary, #6c757d);
}

.imagenes-tab .imagenes-cifra__valor {
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.imagenes-tab .imagenes-cifra__pie {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #6c757d);
  margin-top: 0.25rem;
}

/* Las notas del costo ("no incluye…", "techo…"): más chicas y más claras que el pie, para que
   se lean como la letra chica que son y no compitan con el número. */
.imagenes-tab .imagenes-cifra__nota {
  font-size: 0.7rem;
  line-height: 1.35;
  color: #8a8a8f;
  margin-top: 0.4rem;
}

.imagenes-tab .imagenes-errores {
  font-size: 0.8rem;
  color: var(--bs-danger, #dc3545);
}

.imagenes-tab .imagenes-panel {
  background: var(--bg-card, #ffffff);
  border: 1px solid #ededf0;
  border-radius: 0.75rem;
}

.imagenes-tab .imagenes-panel__titulo {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-secondary, #6c757d);
  font-weight: 600;
}

.imagenes-tab .imagenes-tabla th {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #8a8a8f;
  font-weight: 600;
  border-bottom-width: 1px;
  white-space: nowrap;
}

.imagenes-tab .imagenes-tabla td {
  font-size: 0.875rem;
}

.imagenes-tab .imagenes-tabla__nota {
  font-size: 0.7rem;
  color: #8a8a8f;
}

.imagenes-tab .imagenes-tabla__error {
  color: var(--bs-danger, #dc3545);
}

/* Filas de asignaciones: toda la fila responde al mouse, y la filtrada queda marcada con el mismo
   celeste del nav activo del admin. Se usan las variables de estado de celda de Bootstrap 5.3
   (`--bs-table-bg-state`) y no un `background` a mano: Bootstrap pinta las celdas con un
   box-shadow interno que taparía cualquier fondo puesto directo. */
.imagenes-tab .imagenes-tabla--clickeable tbody tr {
  cursor: pointer;
}

.imagenes-tab .imagenes-tabla--clickeable tbody tr:hover > td {
  --bs-table-bg-state: var(--bg-hover, #f1f3f5);
}

.imagenes-tab .imagenes-tabla--clickeable tbody tr.imagenes-tabla__fila--activa > td {
  --bs-table-bg-state: var(--bg-nav-hover, #e7f1ff);
}

/* El resultado de una asignación son tres cifras con texto: se deja envolver, con un mínimo para
   que no se parta en una palabra por renglón. */
.imagenes-tab .imagenes-tabla__resultado {
  min-width: 13rem;
}

/* Registro: un ancho mínimo para que las ocho columnas se lean. En el teléfono y en la tablet
   angosta la tabla scrollea adentro de su panel (nunca la página, nunca con letra más chica). */
.imagenes-tab .imagenes-registro {
  min-width: 900px;
}

.imagenes-tab .imagenes-registro__articulo {
  min-width: 10rem;
  max-width: 16rem;
}

/* La consulta puede ser un nombre largo: una línea, cortada con puntos suspensivos, y entera al
   pasar el mouse (el `title` de la celda). */
.imagenes-tab .imagenes-registro__consulta {
  max-width: 14rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.imagenes-tab .imagenes-registro__resultado {
  min-width: 9rem;
  max-width: 18rem;
}

/* El id del modelo va como código (es un identificador, no una palabra), igual que en Tokens. */
.imagenes-tab .imagenes-registro__modelo {
  font-size: 0.7rem;
  color: #1f1f24;
  background: #f2f2f4;
  border-radius: 3px;
  padding: 0.05rem 0.3rem;
  white-space: nowrap;
}

/* Mientras llega otra página: lo que está queda atenuado en vez de desaparecer (no salta el alto). */
.imagenes-tab .imagenes-registro--cargando {
  opacity: 0.55;
  transition: opacity 0.15s ease-out;
}

.imagenes-tab .imagenes-registro__asignacion {
  width: auto;
  max-width: 100%;
}

/* Teléfono: el número grande un poco más chico, como en Tokens, para que "US$ 1.234,56" entre en
   media columna sin partirse. */
@media (max-width: 575.98px) {
  .imagenes-tab .imagenes-cifra__valor {
    font-size: 1.4rem;
  }
}
</style>
