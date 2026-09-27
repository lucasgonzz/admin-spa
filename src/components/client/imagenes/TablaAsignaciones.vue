<template>
  <div class="card border-0 imagenes-panel">
    <div class="card-body">
      <p class="imagenes-panel__titulo mb-1">Asignaciones del período</p>
      <p class="imagenes-tabla__nota mb-3">
        Tocá una asignación para ver solo sus consultas en el registro de abajo.
      </p>

      <p v-if="asignaciones.length === 0" class="text-muted small fst-italic mb-0">
        Ninguna asignación en este período.
      </p>

      <div v-else class="table-responsive">
        <table class="table table-sm align-middle mb-0 imagenes-tabla imagenes-tabla--clickeable">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Origen</th>
              <th>Estado</th>
              <th class="text-end">Artículos</th>
              <th>Resultado</th>
              <!-- "cobradas" porque el contador de la asignación suma solo las búsquedas que el
                   proveedor respondió bien: el registro de abajo, filtrado por la asignación, trae
                   también las que fallaron, y sin la aclaración los dos números no se entienden. -->
              <th class="text-end">Búsquedas cobradas</th>
              <th class="text-end">Validaciones</th>
              <th class="text-end"><span class="visually-hidden">Acción</span></th>
            </tr>
          </thead>
          <tbody>
            <!-- La fila entera es clickeable por comodidad, pero el que manda es el botón del final:
                 es el que se alcanza con el teclado y el que dice qué va a pasar. -->
            <tr
              v-for="asignacion in asignaciones"
              :key="asignacion.id"
              :class="{ 'imagenes-tabla__fila--activa': es_la_filtrada(asignacion) }"
              @click="elegir(asignacion)"
            >
              <td class="text-nowrap" :title="fecha_hora_completa(asignacion.created_at)">
                {{ fecha_hora_corta(asignacion.created_at) }}
                <span class="imagenes-tabla__nota d-block">#{{ asignacion.id }}</span>
              </td>
              <td>{{ etiqueta(origenes, asignacion.origen) }}</td>
              <td>{{ etiqueta(estados, asignacion.status) }}</td>
              <td class="text-end">{{ numero(asignacion.total_articulos) }}</td>
              <td class="imagenes-tabla__resultado">
                {{ numero(asignacion.asignadas) }} asignadas ·
                {{ numero(asignacion.a_revisar) }} a revisar ·
                {{ numero(asignacion.no_asignadas) }} no asignadas
              </td>
              <td class="text-end">{{ numero(asignacion.busquedas) }}</td>
              <td class="text-end">{{ numero(asignacion.validaciones_ia) }}</td>
              <td class="text-end text-nowrap">
                <button
                  type="button"
                  class="btn btn-sm"
                  :class="es_la_filtrada(asignacion) ? 'btn-dark' : 'btn-outline-secondary'"
                  :aria-pressed="es_la_filtrada(asignacion) ? 'true' : 'false'"
                  @click.stop="elegir(asignacion)"
                >
                  {{ es_la_filtrada(asignacion) ? 'Quitar filtro' : 'Ver consultas' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- El sistema del cliente manda como máximo las 100 más nuevas del rango: si llegaron 100,
           puede haber más, y se dice en vez de dejar que la tabla parezca completa. -->
      <p v-if="asignaciones.length >= 100" class="imagenes-tabla__nota mb-0 mt-2">
        Se muestran las 100 asignaciones más nuevas del período. Achicá el período para ver las anteriores.
      </p>
    </div>
  </div>
</template>

<script>
import {
  numero,
  etiqueta,
  fecha_hora_corta,
  fecha_hora_completa,
  ETIQUETAS_DE_ORIGEN_DE_ASIGNACION,
  ETIQUETAS_DE_ESTADO_DE_ASIGNACION,
} from './formato'

/**
 * Tabla de las asignaciones de imágenes creadas en el período (catálogo completo, selección o
 * asistente), con lo que dio cada una y cuántas búsquedas y validaciones gastó.
 *
 * Tocar una fila (o su botón) filtra el registro de consultas por esa asignación; tocar la misma
 * otra vez saca el filtro. El filtro lo guarda el orquestador (`Index.vue`), no esta tabla: lo
 * comparten la tabla (para resaltar la fila) y el registro (para pedir sus consultas).
 */
export default {
  name: 'ClientImagenesTablaAsignaciones',
  emits: ['elegir'],
  props: {
    /** Bloque `asignaciones` del resumen: las creadas en el rango, más nuevas primero, hasta 100. */
    asignaciones: { type: Array, default: () => [] },
    /** Id de la asignación por la que está filtrado el registro, o null. */
    asignacion_filtrada: { type: Number, default: null },
  },
  data() {
    return {
      // Mapas de etiquetas, expuestos al template.
      origenes: ETIQUETAS_DE_ORIGEN_DE_ASIGNACION,
      estados: ETIQUETAS_DE_ESTADO_DE_ASIGNACION,
    }
  },
  methods: {
    /**
     * true si el registro está filtrado por esta asignación.
     * @param {Object} asignacion
     * @returns {boolean}
     */
    es_la_filtrada(asignacion) {
      return this.asignacion_filtrada !== null && Number(asignacion.id) === Number(this.asignacion_filtrada)
    },
    /**
     * Pide filtrar el registro por esta asignación, o sacar el filtro si ya era la filtrada.
     * @param {Object} asignacion
     * @returns {void}
     */
    elegir(asignacion) {
      this.$emit('elegir', this.es_la_filtrada(asignacion) ? null : Number(asignacion.id))
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
     * Día, mes y hora, expuesto para el template.
     * @param {string} valor
     * @returns {string}
     */
    fecha_hora_corta(valor) {
      return fecha_hora_corta(valor)
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
