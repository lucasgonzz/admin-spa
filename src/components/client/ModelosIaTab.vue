<template>
  <div class="p-3">
    <!-- Sin cliente guardado todavía: no hay id al que preguntarle -->
    <p v-if="!record || !record.id" class="text-muted small fst-italic mb-0">
      Guardá el cliente primero para elegir sus modelos de IA.
    </p>

    <!-- Carga en vivo contra el sistema del cliente -->
    <div v-else-if="loading" class="text-center py-4">
      <span class="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true" />
      <p class="text-muted small mt-2 mb-0">Preguntándole al sistema del cliente...</p>
    </div>

    <!-- El pedido al admin falló (red, sesión): no hay estado del cliente que mostrar -->
    <div v-else-if="load_error" class="alert alert-danger py-2 small mb-0">
      {{ load_error }}
    </div>

    <!-- Cliente con una versión anterior del sistema (404 del lado del cliente) -->
    <div v-else-if="estado === 'no_soportado'" class="alert alert-warning py-2 small mb-0">
      Este cliente tiene una versión anterior del sistema: se puede elegir después de actualizarlo.
    </div>

    <!-- El sistema del cliente no contestó bien (clave, USER_ID, caído, página del hosting) -->
    <div v-else-if="estado === 'failed' && !cargado" class="alert alert-danger py-2 small mb-0">
      <div>{{ mensaje || 'No se pudo leer la configuración de IA del cliente.' }}</div>
      <button type="button" class="btn btn-outline-danger btn-sm mt-2" @click="cargar">
        Volver a intentar
      </button>
    </div>

    <div v-else-if="cargado">
      <p class="text-muted small mb-3">
        Qué modelo de IA usa este cliente para cada tarea. Se lee y se guarda en vivo en su sistema:
        el admin no guarda copia. Si el modelo elegido es de un proveedor sin clave cargada en el
        cliente, igual queda elegido y corre el que sí tiene clave hasta que se cargue.
      </p>

      <!-- ============================================================ -->
      <!-- Una fila por tarea: el selector con las opciones que valen   -->
      <!-- para esa tarea, lo que corre de verdad y el aviso cuando lo  -->
      <!-- elegido no es lo que corre.                                  -->
      <!-- ============================================================ -->
      <div v-for="tarea in tareas_ordenadas" :key="tarea.key" class="card mb-2">
        <div class="card-body py-2">
          <div class="row g-2 align-items-start">
            <div class="col-12 col-md-4">
              <label :for="'modelo-ia-' + tarea.key" class="form-label fw-semibold small mb-0">
                {{ tarea.nombre }}
              </label>
              <div v-if="tarea.key === 'asistente'" class="text-muted small">
                El dueño también lo puede cambiar desde "Configurá tu asistente": vale el último cambio.
              </div>
            </div>

            <div class="col-12 col-md-8">
              <template v-if="tarea.datos">
                <select
                  :id="'modelo-ia-' + tarea.key"
                  v-model="seleccion[tarea.key]"
                  class="form-select form-select-sm"
                  :class="{ 'is-invalid': errores_de(tarea.key).length > 0 }"
                  :disabled="saving"
                >
                  <option v-for="opcion in opciones_de(tarea)" :key="opcion.id" :value="opcion.id">
                    {{ opcion.etiqueta }}
                  </option>
                </select>

                <!-- Errores que devolvió el sistema del cliente para esta tarea (422) -->
                <div v-for="(error, i) in errores_de(tarea.key)" :key="i" class="invalid-feedback d-block">
                  {{ error }}
                </div>

                <!-- Lo que corre de verdad según el propio cliente -->
                <div class="small mt-1">
                  <span class="text-muted me-1">Corre:</span>
                  <template v-if="tarea.datos.efectiva">
                    {{ nombre_efectiva(tarea.datos.efectiva) }}
                    <code class="ms-1">{{ tarea.datos.efectiva.modelo }}</code>
                  </template>
                  <span v-else class="text-danger">
                    nada: el cliente no tiene cargada ninguna clave de IA (DEEPSEEK_API_KEY ni
                    ANTHROPIC_API_KEY).
                  </span>
                </div>

                <!-- Lo elegido no es lo que corre (fallback por clave faltante) -->
                <div v-if="aviso_de(tarea)" class="alert alert-warning py-1 px-2 small mb-0 mt-1">
                  {{ aviso_de(tarea) }}
                </div>

                <!-- Cambio sin guardar -->
                <div v-if="cambio_pendiente(tarea.key)" class="small text-primary mt-1">
                  Sin guardar: se va a elegir {{ nombre_de_id(seleccion[tarea.key]) }}.
                </div>
              </template>

              <div v-else class="text-muted small fst-italic">
                El sistema del cliente no informó esta tarea.
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Error del guardado que no es de una tarea puntual (o el resumen del 422) -->
      <div v-if="save_error" class="alert alert-danger py-2 small mt-3 mb-0">
        {{ save_error }}
      </div>

      <div class="d-flex flex-wrap justify-content-end gap-2 mt-3">
        <button type="button" class="btn btn-outline-secondary btn-sm" :disabled="saving" @click="cargar">
          Recargar
        </button>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          :disabled="saving || cambios_pendientes.length === 0"
          @click="guardar"
        >
          <span v-if="saving" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
          {{ saving ? 'Guardando...' : 'Guardar' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import { nombre_opcion, nombre_proveedor } from '@/utils/ia'

/**
 * Las cuatro tareas del contrato `admin-sync/modelos-ia`, en el orden en que se muestran.
 *
 * 🔴 Las claves son las del contrato (las mismas que manda el PUT y que el cliente devuelve bajo
 * `tareas.<clave>`): renombrar una deja al otro lado sin enterarse del cambio.
 */
const TAREAS = [
  { key: 'asistente', nombre: 'Asistente del dueño' },
  { key: 'whatsapp', nombre: 'WhatsApp a clientes' },
  { key: 'imagenes', nombre: 'Verificación de imágenes' },
  { key: 'excel', nombre: 'Importación de Excel' },
]

/** Variable del `.env` del cliente que habilita cada proveedor, para decir qué falta cargar. */
const VARIABLE_DE_CLAVE = {
  deepseek: 'DEEPSEEK_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
}

/**
 * Pestaña "Inteligencia artificial" del detalle del cliente (misión modelos-ia-por-cliente,
 * 30/9/2026).
 *
 * Elige el modelo de IA de cuatro tareas del sistema del cliente: el asistente del dueño, el bot de
 * WhatsApp que atiende a sus clientes, la verificación de imágenes y la importación de Excel.
 *
 * 🔴 Todo es EN VIVO contra el sistema del cliente (GET/PUT admin/client/{id}/modelos-ia, que el
 * admin reenvía a `admin-sync/modelos-ia` sin guardar nada). Decisión de Lucas: "los dos, gana el
 * último" — el dueño sigue pudiendo cambiar su asistente desde su modal, así que lo que se ve acá es
 * siempre lo que quedó allá, y al guardar se mandan SOLO las tareas que se cambiaron en esta
 * pantalla: mandar las cuatro le pisaría al dueño un cambio que hizo después de que se abrió la
 * solapa.
 *
 * El catálogo de opciones y qué vale para cada tarea (DeepSeek Pro no ve imágenes) lo decide el
 * cliente: el selector muestra `opciones_validas` y, si igual algo no vale, el 422 del cliente se
 * muestra debajo de la fila.
 *
 * Mismo molde que `ClientCandadoSesionTab` / `TokensTab` (Options API, Bootstrap 5 crudo).
 */
export default {
  name: 'ClientModelosIaTab',
  props: {
    /** Cliente actualmente abierto en el modal de detalle de ResourceView. */
    record: { type: Object, default: null },
  },
  data() {
    return {
      // true mientras se le pregunta al cliente (GET).
      loading: false,
      // Error del pedido al admin mismo (red, sesión). null = sin error.
      load_error: null,
      // Estado del último resultado del cliente: success | no_soportado | failed | null.
      estado: null,
      // Motivo del cliente cuando no es success.
      mensaje: '',
      // true cuando ya hubo al menos un payload válido para dibujar las filas.
      cargado: false,
      // `datos.opciones` del cliente: el catálogo con proveedor, modelo, visión y disponibilidad.
      opciones: [],
      // `datos.tareas` del cliente: por tarea, la opción elegida, las válidas y la efectiva.
      tareas: {},
      // Opción elegida en cada selector (editable). Arranca en lo que devolvió el cliente.
      seleccion: { asistente: null, whatsapp: null, imagenes: null, excel: null },
      // true mientras se guarda (PUT).
      saving: false,
      // Motivo del último guardado fallido.
      save_error: null,
      // Errores del 422 del cliente, por tarea ({ imagenes: ['...'] }).
      errores_por_tarea: {},
    }
  },
  computed: {
    /**
     * Las cuatro tareas en orden, con su bloque del payload (o null si el cliente no la informó).
     * @returns {Array<{key: string, nombre: string, datos: Object|null}>}
     */
    tareas_ordenadas() {
      const self = this
      return TAREAS.map(function (tarea) {
        const datos = self.tareas && self.tareas[tarea.key] ? self.tareas[tarea.key] : null
        return { key: tarea.key, nombre: tarea.nombre, datos: datos }
      })
    },
    /**
     * Tareas cuyo selector difiere de lo que el cliente tiene elegido: son las únicas que viajan.
     * @returns {string[]}
     */
    cambios_pendientes() {
      const self = this
      return TAREAS.map(function (tarea) {
        return tarea.key
      }).filter(function (clave) {
        return self.cambio_pendiente(clave)
      })
    },
  },
  watch: {
    /** Si cambia el cliente abierto en el modal, vuelve a preguntar. */
    'record.id': function (nuevo_id, viejo_id) {
      if (nuevo_id && nuevo_id !== viejo_id) {
        this.cargado = false
        this.cargar()
      }
    },
  },
  mounted() {
    this.cargar()
  },
  methods: {
    /**
     * Le pregunta al sistema del cliente qué tiene elegido y qué corre
     * (GET admin/client/{id}/modelos-ia).
     * @returns {void}
     */
    cargar() {
      const self = this
      if (!this.record || !this.record.id) {
        return
      }
      self.loading = true
      self.load_error = null
      self.save_error = null
      self.errores_por_tarea = {}
      api
        .get('/client/' + this.record.id + '/modelos-ia', { silent_error: true })
        .then(function (res) {
          self.aplicar_resultado(res.data || {}, true)
          self.loading = false
        })
        .catch(function (error) {
          self.load_error = resolve_error_message(error)
          self.loading = false
        })
    },
    /**
     * Vuelca un resultado `{estado, mensaje, datos, errores}` del admin.
     *
     * Con `success` se pisan las filas y los selectores con lo que dijo el cliente (es la verdad:
     * "gana el último"). Con un fallo se conserva lo que ya se veía, para que un guardado rechazado
     * no borre la elección que el operador estaba haciendo.
     *
     * @param {Object} resultado
     * @param {boolean} es_carga - true si viene del GET (un fallo ahí reemplaza la pantalla).
     * @returns {void}
     */
    aplicar_resultado(resultado, es_carga) {
      const cuerpo = resultado || {}
      this.estado = cuerpo.estado || null
      this.mensaje = cuerpo.mensaje || ''

      if (this.estado === 'success' && cuerpo.datos) {
        this.opciones = Array.isArray(cuerpo.datos.opciones) ? cuerpo.datos.opciones : []
        this.tareas = cuerpo.datos.tareas && typeof cuerpo.datos.tareas === 'object' ? cuerpo.datos.tareas : {}
        const seleccion = {}
        const self = this
        TAREAS.forEach(function (tarea) {
          const datos = self.tareas[tarea.key]
          seleccion[tarea.key] = datos && datos.opcion ? datos.opcion : null
        })
        this.seleccion = seleccion
        this.cargado = true
        return
      }

      if (es_carga) {
        // Un GET que no trajo el payload deja la pantalla en su mensaje (no_soportado / failed).
        this.cargado = false
      }
    },
    /**
     * Opciones del selector de una tarea: las `opciones_validas` que mandó el cliente, con su
     * nombre y la marca de "sin clave" cuando el proveedor no está cargado en esa instalación.
     *
     * Si la opción elegida no estuviera entre las válidas (un dato viejo en la base del cliente),
     * se agrega igual para que el selector no la muestre en blanco ni la cambie por su cuenta.
     *
     * @param {{key: string, datos: Object}} tarea
     * @returns {Array<{id: string, etiqueta: string}>}
     */
    opciones_de(tarea) {
      const self = this
      const validas = tarea.datos && Array.isArray(tarea.datos.opciones_validas)
        ? tarea.datos.opciones_validas.slice()
        : self.opciones.map(function (opcion) {
          return opcion.id
        })
      const elegida = tarea.datos ? tarea.datos.opcion : null
      if (elegida && validas.indexOf(elegida) === -1) {
        validas.push(elegida)
      }
      return validas.map(function (id) {
        const opcion = self.opcion_por_id(id)
        let etiqueta = nombre_opcion(id, opcion ? opcion.nombre : null)
        if (opcion && opcion.disponible === false) {
          etiqueta += ' — sin clave en este cliente'
        }
        return { id: id, etiqueta: etiqueta }
      })
    },
    /**
     * Busca una opción del catálogo del cliente por id.
     * @param {string} id
     * @returns {Object|null}
     */
    opcion_por_id(id) {
      let encontrada = null
      this.opciones.forEach(function (opcion) {
        if (opcion && opcion.id === id) {
          encontrada = opcion
        }
      })
      return encontrada
    },
    /**
     * Nombre humano de una opción por id, con el nombre del cliente como respaldo.
     * @param {string} id
     * @returns {string}
     */
    nombre_de_id(id) {
      const opcion = this.opcion_por_id(id)
      return nombre_opcion(id, opcion ? opcion.nombre : null)
    },
    /**
     * Nombre de lo que corre de verdad. `efectiva.opcion` null significa que se cayó al modelo que
     * esa tarea usaba antes de esta configuración (no es una opción del catálogo): se nombra por
     * proveedor, y el id real del modelo va al lado.
     * @param {Object} efectiva
     * @returns {string}
     */
    nombre_efectiva(efectiva) {
      if (efectiva.opcion) {
        return this.nombre_de_id(efectiva.opcion)
      }
      return nombre_proveedor(efectiva.proveedor) + ', el modelo de antes de esta configuración'
    },
    /**
     * El aviso cuando lo elegido no es lo que corre, o null si coinciden.
     *
     * Ej.: "Elegido DeepSeek Flash · corre Claude Haiku: falta DEEPSEEK_API_KEY en este cliente."
     *
     * @param {{key: string, datos: Object}} tarea
     * @returns {string|null}
     */
    aviso_de(tarea) {
      const datos = tarea.datos
      if (!datos || !datos.opcion || !datos.efectiva) {
        return null
      }
      const efectiva = datos.efectiva
      if (!efectiva.fallback && efectiva.opcion === datos.opcion) {
        return null
      }
      const elegida = this.opcion_por_id(datos.opcion)
      let texto = 'Elegido ' + this.nombre_de_id(datos.opcion) + ' · corre ' + this.nombre_efectiva(efectiva)
      if (elegida && elegida.disponible === false && VARIABLE_DE_CLAVE[elegida.proveedor]) {
        texto += ': falta ' + VARIABLE_DE_CLAVE[elegida.proveedor] + ' en este cliente.'
      } else {
        texto += '.'
      }
      return texto
    },
    /**
     * Si el selector de una tarea difiere de lo que el cliente tiene elegido.
     * @param {string} clave
     * @returns {boolean}
     */
    cambio_pendiente(clave) {
      const datos = this.tareas ? this.tareas[clave] : null
      if (!datos) {
        return false
      }
      const elegida = this.seleccion[clave]
      return elegida !== null && elegida !== undefined && elegida !== datos.opcion
    },
    /**
     * Errores del 422 del cliente para una tarea.
     * @param {string} clave
     * @returns {string[]}
     */
    errores_de(clave) {
      const errores = this.errores_por_tarea ? this.errores_por_tarea[clave] : null
      return Array.isArray(errores) ? errores : []
    },
    /**
     * Guarda SOLO las tareas cambiadas (PUT admin/client/{id}/modelos-ia) y redibuja con lo que el
     * cliente dice que quedó.
     * @returns {void}
     */
    guardar() {
      const self = this
      if (!this.record || !this.record.id) {
        return
      }
      const cuerpo = {}
      this.cambios_pendientes.forEach(function (clave) {
        cuerpo[clave] = self.seleccion[clave]
      })
      if (Object.keys(cuerpo).length === 0) {
        return
      }
      self.saving = true
      self.save_error = null
      self.errores_por_tarea = {}
      api
        .put('/client/' + this.record.id + '/modelos-ia', cuerpo, { silent_error: true })
        .then(function (res) {
          const resultado = res.data || {}
          self.saving = false
          if (resultado.estado === 'success') {
            self.aplicar_resultado(resultado, false)
            window.dispatchEvent(new CustomEvent('admin-spa-toast', {
              detail: { message: 'Modelos de IA guardados en el sistema del cliente.', variant: 'success' },
            }))
            return
          }
          if (resultado.estado === 'no_soportado') {
            // El cliente se quedó sin el endpoint (se restauró una versión vieja): se dice arriba.
            self.aplicar_resultado(resultado, true)
            return
          }
          self.save_error = resultado.mensaje || 'No se pudo guardar en el sistema del cliente.'
          self.errores_por_tarea = resultado.errores && typeof resultado.errores === 'object' ? resultado.errores : {}
        })
        .catch(function (error) {
          self.saving = false
          self.save_error = resolve_error_message(error)
        })
    },
  },
}
</script>
