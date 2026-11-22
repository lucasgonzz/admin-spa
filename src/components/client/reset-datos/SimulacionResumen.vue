<template>
  <div class="reset-resumen">
    <!-- Encabezado: base y total de filas que se vaciarían -->
    <div class="row g-2 mb-3">
      <div class="col-12 col-md-6">
        <div class="reset-resumen__caja">
          <div class="reset-resumen__etiqueta">Base de datos</div>
          <div class="reset-resumen__valor text-break">{{ simulacion.base }}</div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="reset-resumen__caja">
          <div class="reset-resumen__etiqueta">Filas a borrar</div>
          <div class="reset-resumen__valor">{{ formatear_numero(simulacion.total_filas) }}</div>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="reset-resumen__caja">
          <div class="reset-resumen__etiqueta">Respaldo estimado</div>
          <div class="reset-resumen__valor">{{ formatear_bytes(simulacion.respaldo_estimado_bytes) }}</div>
        </div>
      </div>
    </div>

    <!-- Bloqueos: cada uno con su texto; si es levantable, ofrece el checkbox -->
    <div v-if="bloqueos.length > 0" class="mb-3">
      <div
        v-for="bloqueo in bloqueos"
        :key="bloqueo.codigo"
        class="alert alert-warning py-2 small mb-2"
      >
        <div class="fw-semibold">{{ titulo_del_bloqueo(bloqueo) }}</div>
        <div>{{ bloqueo.mensaje }}</div>
        <div v-if="detalle_del_bloqueo(bloqueo)" class="text-muted mt-1">
          {{ detalle_del_bloqueo(bloqueo) }}
        </div>
      </div>
    </div>

    <!-- Checkboxes para levantar los frenos que se pueden levantar a propósito -->
    <div v-if="hay_frenos_levantables" class="card mb-3">
      <div class="card-body py-2 small">
        <div v-if="tiene_bloqueo('comprobantes_con_cae') || incluir_comprobantes_con_cae" class="form-check mb-2">
          <input
            id="reset-incluir-cae"
            class="form-check-input"
            type="checkbox"
            :checked="incluir_comprobantes_con_cae"
            :disabled="deshabilitado"
            @change="$emit('update:incluir_comprobantes_con_cae', $event.target.checked)"
          />
          <label class="form-check-label" for="reset-incluir-cae">
            Incluir también los comprobantes con CAE (facturas ya emitidas en ARCA). Se borran del
            sistema aunque ARCA los conserve.
          </label>
        </div>
        <div v-if="tiene_bloqueo('integraciones_conectadas') || incluir_integraciones_conectadas" class="form-check mb-2">
          <input
            id="reset-incluir-integraciones"
            class="form-check-input"
            type="checkbox"
            :checked="incluir_integraciones_conectadas"
            :disabled="deshabilitado"
            @change="$emit('update:incluir_integraciones_conectadas', $event.target.checked)"
          />
          <label class="form-check-label" for="reset-incluir-integraciones">
            Seguir aunque haya integraciones conectadas (Tienda Nube, Mercado Libre). Después del
            reinicio hay que revisarlas a mano.
          </label>
        </div>
        <button
          type="button"
          class="btn btn-outline-primary btn-sm"
          :disabled="deshabilitado"
          @click="$emit('resimular')"
        >
          Volver a simular
        </button>
      </div>
    </div>

    <!-- Advertencias que pueda traer la simulación -->
    <div v-if="advertencias.length > 0" class="alert alert-info py-2 small mb-3">
      <div v-for="(aviso, indice) in advertencias" :key="indice">{{ aviso }}</div>
    </div>

    <!-- Tabla de conteos, colapsable, con scroll propio para que no desborde la página -->
    <div class="mb-3">
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary mb-2"
        :aria-expanded="tabla_abierta ? 'true' : 'false'"
        @click="tabla_abierta = !tabla_abierta"
      >
        <i :class="tabla_abierta ? 'bi bi-chevron-up' : 'bi bi-chevron-down'" aria-hidden="true"></i>
        {{ tabla_abierta ? 'Ocultar' : 'Ver' }} el detalle por tabla ({{ filas_con_datos.length }}
        con datos)
      </button>
      <div v-if="tabla_abierta" class="reset-resumen__scroll">
        <table class="table table-sm table-striped mb-0 reset-resumen__tabla">
          <thead>
            <tr>
              <th>Tabla</th>
              <th class="text-end text-nowrap">Filas</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="fila in filas_con_datos" :key="fila.tabla">
              <td class="text-break">{{ fila.tabla }}</td>
              <td class="text-end text-nowrap">{{ formatear_numero(fila.filas) }}</td>
            </tr>
            <tr v-if="filas_con_datos.length === 0">
              <td colspan="2" class="text-muted fst-italic">No hay datos de negocio para borrar.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Ajustes de coherencia y carpetas de archivos que se mueven -->
    <div class="row g-3">
      <div class="col-12 col-lg-6">
        <h6 class="reset-resumen__subtitulo">Ajustes previstos</h6>
        <ul v-if="ajustes.length > 0" class="small ps-3 mb-0">
          <li v-for="ajuste in ajustes" :key="ajuste.clave">
            <span class="text-break">{{ ajuste.clave }}</span>: {{ ajuste.valor }}
          </li>
        </ul>
        <p v-else class="text-muted small fst-italic mb-0">Sin ajustes.</p>
      </div>
      <div class="col-12 col-lg-6">
        <h6 class="reset-resumen__subtitulo">Archivos que se mueven al respaldo</h6>
        <p class="small mb-1">
          Imágenes de artículos: <strong>{{ formatear_numero(cantidad_de_imagenes) }}</strong>
        </p>
        <ul v-if="carpetas.length > 0" class="small ps-3 mb-0">
          <li v-for="carpeta in carpetas" :key="carpeta.ruta">
            <span class="text-break">{{ carpeta.ruta }}</span>
            <span class="text-muted">{{ carpeta.existe ? '' : ' (no existe, se saltea)' }}</span>
          </li>
        </ul>
        <p v-else class="text-muted small fst-italic mb-0">Sin carpetas.</p>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * Resultado de la simulación del reinicio de datos (paso 1 de la solapa "Reiniciar datos").
 *
 * Es de solo lectura: muestra el cuerpo del contrato C1 que devolvió el endpoint de simulación
 * (base, total de filas, conteos por tabla, ajustes, carpetas, bloqueos) y deja tildar los dos
 * frenos que se pueden levantar a propósito. No llama a la API: avisa al orquestador con eventos.
 */
export default {
  name: 'ResetDatosSimulacionResumen',
  props: {
    /** Cuerpo de la simulación (C1 + client_id y frente). */
    simulacion: { type: Object, required: true },
    /** Si se tildó "incluir comprobantes con CAE". */
    incluir_comprobantes_con_cae: { type: Boolean, default: false },
    /** Si se tildó "seguir aunque haya integraciones conectadas". */
    incluir_integraciones_conectadas: { type: Boolean, default: false },
    /** true mientras hay un pedido en curso: bloquea los controles. */
    deshabilitado: { type: Boolean, default: false },
  },
  emits: [
    'update:incluir_comprobantes_con_cae',
    'update:incluir_integraciones_conectadas',
    'resimular',
  ],
  data() {
    return {
      // true cuando la tabla de conteos por tabla está desplegada (arranca colapsada).
      tabla_abierta: false,
    }
  },
  computed: {
    /**
     * Lista de bloqueos de la simulación (siempre un arreglo).
     * @returns {Array<Object>}
     */
    bloqueos() {
      return Array.isArray(this.simulacion.bloqueos) ? this.simulacion.bloqueos : []
    },
    /**
     * Advertencias de la simulación (arreglo de textos, si el backend las manda).
     * @returns {Array<string>}
     */
    advertencias() {
      return Array.isArray(this.simulacion.advertencias) ? this.simulacion.advertencias : []
    },
    /**
     * true si hay algún freno que el usuario puede levantar con un checkbox (o ya lo levantó).
     * @returns {boolean}
     */
    hay_frenos_levantables() {
      return (
        this.tiene_bloqueo('comprobantes_con_cae') ||
        this.tiene_bloqueo('integraciones_conectadas') ||
        this.incluir_comprobantes_con_cae ||
        this.incluir_integraciones_conectadas
      )
    },
    /**
     * Conteos por tabla (a_vaciar) con filas > 0, ordenados de mayor a menor.
     * @returns {Array<{tabla: string, filas: number}>}
     */
    filas_con_datos() {
      const conteos = this.simulacion.a_vaciar || {}
      const resultado = []
      Object.keys(conteos).forEach(function (tabla) {
        const filas = Number(conteos[tabla]) || 0
        if (filas > 0) {
          resultado.push({ tabla: tabla, filas: filas })
        }
      })
      resultado.sort(function (a, b) {
        return b.filas - a.filas
      })
      return resultado
    },
    /**
     * Ajustes previstos como pares clave/valor legibles.
     * @returns {Array<{clave: string, valor: string}>}
     */
    ajustes() {
      const previstos = this.simulacion.ajustes_previstos || {}
      const resultado = []
      Object.keys(previstos).forEach(function (clave) {
        const valor = previstos[clave]
        resultado.push({
          clave: clave,
          valor: valor !== null && typeof valor === 'object' ? JSON.stringify(valor) : String(valor),
        })
      })
      return resultado
    },
    /**
     * Cantidad de imágenes de artículos que se moverían.
     * @returns {number}
     */
    cantidad_de_imagenes() {
      const archivos = this.simulacion.archivos_previstos || {}
      return Number(archivos.imagenes) || 0
    },
    /**
     * Carpetas de archivos previstas ({ruta: existe}) como arreglo.
     * @returns {Array<{ruta: string, existe: boolean}>}
     */
    carpetas() {
      const archivos = this.simulacion.archivos_previstos || {}
      const mapa = archivos.carpetas || {}
      const resultado = []
      Object.keys(mapa).forEach(function (ruta) {
        resultado.push({ ruta: ruta, existe: Boolean(mapa[ruta]) })
      })
      return resultado
    },
  },
  methods: {
    /**
     * Dice si la simulación trae un bloqueo con ese código.
     * @param {string} codigo
     * @returns {boolean}
     */
    tiene_bloqueo(codigo) {
      return this.bloqueos.some(function (bloqueo) {
        return bloqueo.codigo === codigo
      })
    },
    /**
     * Título corto y claro para cada código de bloqueo conocido.
     * @param {Object} bloqueo
     * @returns {string}
     */
    titulo_del_bloqueo(bloqueo) {
      const titulos = {
        comprobantes_con_cae: 'Hay comprobantes con CAE de producción',
        integraciones_conectadas: 'Hay integraciones conectadas',
        en_curso: 'Hay otro proceso en curso en el sistema del cliente',
        varios_duenos: 'El sistema tiene más de un dueño',
        tablas_sin_clasificar: 'Hay tablas que el reinicio no conoce',
        sin_espacio_para_respaldo: 'No alcanza el espacio para el respaldo',
      }
      return titulos[bloqueo.codigo] || 'No se puede reiniciar'
    },
    /**
     * Línea de detalle opcional del bloqueo (cantidad, plataformas, tablas).
     * @param {Object} bloqueo
     * @returns {string}
     */
    detalle_del_bloqueo(bloqueo) {
      const detalle = bloqueo.detalle || {}
      if (detalle.cantidad !== undefined) {
        return 'Comprobantes: ' + detalle.cantidad
      }
      if (Array.isArray(detalle.plataformas) && detalle.plataformas.length > 0) {
        return 'Plataformas: ' + detalle.plataformas.join(', ')
      }
      if (Array.isArray(detalle.tablas) && detalle.tablas.length > 0) {
        return 'Tablas: ' + detalle.tablas.join(', ')
      }
      return ''
    },
    /**
     * Formatea un entero con separador de miles en es-AR.
     * @param {number} valor
     * @returns {string}
     */
    formatear_numero(valor) {
      return (Number(valor) || 0).toLocaleString('es-AR')
    },
    /**
     * Formatea bytes en B / KB / MB / GB.
     * @param {number} bytes
     * @returns {string}
     */
    formatear_bytes(bytes) {
      let valor = Number(bytes) || 0
      const unidades = ['B', 'KB', 'MB', 'GB']
      let indice = 0
      while (valor >= 1024 && indice < unidades.length - 1) {
        valor = valor / 1024
        indice++
      }
      return (indice === 0 ? valor : valor.toFixed(1)) + ' ' + unidades[indice]
    },
  },
}
</script>

<style scoped lang="scss">
.reset-resumen__caja {
	background: #f7f7f8;
	border-radius: 0.5rem;
	padding: 0.6rem 0.8rem;
	height: 100%;
}

.reset-resumen__etiqueta {
	font-size: 0.7rem;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: #6c757d;
}

.reset-resumen__valor {
	font-size: 1.05rem;
	font-weight: 600;
}

.reset-resumen__subtitulo {
	font-size: 0.75rem;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: #6c757d;
}

/* Ancho mínimo para que las columnas no se achiquen a unos pocos píxeles en pantallas chicas;
   si no entra, el contenedor scrollea en horizontal. Sin partir palabras ni números. */
.reset-resumen__tabla {
	min-width: 20rem;
	overflow-wrap: normal;
	word-break: normal;
}

/* La tabla larga scrollea dentro de su caja: la página nunca se desborda. */
.reset-resumen__scroll {
	max-height: 18rem;
	overflow: auto;
	max-width: 100%;
	border: 1px solid var(--bs-border-color, #dee2e6);
	border-radius: 0.5rem;
}
</style>
