<template>
  <div>
    <!-- ============================================================ -->
    <!-- Las cuatro cifras del período. Sin colores ni iconos: el     -->
    <!-- dato es el dato (mismo criterio que la solapa Tokens).       -->
    <!--                                                              -->
    <!-- En el teléfono el costo y los tokens van a todo el ancho y   -->
    <!-- búsquedas + validaciones de a pares: el costo es el que      -->
    <!-- carga notas y a media columna se partiría en cinco renglones.-->
    <!-- ============================================================ -->
    <div class="row g-3">
      <div class="col-12 col-md-6 col-xl-3">
        <div class="card h-100 border-0 imagenes-cifra">
          <div class="card-body">
            <p class="imagenes-cifra__rotulo mb-1">Costo estimado</p>
            <p class="imagenes-cifra__valor mb-0">{{ costo_visible(totales.costo_usd) }}</p>
            <!-- En dos renglones y no separados por un punto: a 360px la línea única se parte a
                 la mitad de un importe. -->
            <p class="imagenes-cifra__pie mb-0">
              <span class="d-block">Búsquedas {{ costo_visible(totales.costo_busquedas_usd) }}</span>
              <span class="d-block">IA {{ costo_visible(totales.costo_ia_usd) }}</span>
            </p>
            <p v-for="nota in notas_del_costo" :key="nota" class="imagenes-cifra__nota mb-0">
              {{ nota }}
            </p>
            <!-- La IA de las validaciones se cuenta acá Y en la solapa Tokens (es la misma plata, vista
                 desde el circuito de imágenes): se aclara para que nadie sume las dos solapas. Solo
                 cuando hubo validaciones: sin ellas, el costo es solo de búsquedas. -->
            <p v-if="hubo_validaciones" class="imagenes-cifra__nota mb-0">
              Incluye la validación con IA, que también figura en la solapa Tokens.
            </p>
          </div>
        </div>
      </div>

      <div class="col-6 col-md-6 col-xl-3">
        <div class="card h-100 border-0 imagenes-cifra">
          <div class="card-body">
            <p class="imagenes-cifra__rotulo mb-1">Búsquedas</p>
            <p class="imagenes-cifra__valor mb-0">{{ numero(totales.busquedas) }}</p>
            <p class="imagenes-cifra__pie mb-0">
              <span v-for="fila in busquedas_por_proveedor" :key="fila.proveedor" class="d-block">
                {{ numero(fila.cantidad) }} de {{ fila.nombre }}
              </span>
              <span v-if="busquedas_no_cobradas > 0" class="d-block">
                {{ numero(busquedas_no_cobradas) }} {{ busquedas_no_cobradas === 1 ? 'no cobrada' : 'no cobradas' }}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div class="col-6 col-md-6 col-xl-3">
        <div class="card h-100 border-0 imagenes-cifra">
          <div class="card-body">
            <p class="imagenes-cifra__rotulo mb-1">Validaciones con IA</p>
            <p class="imagenes-cifra__valor mb-0">{{ numero(totales.validaciones_ia) }}</p>
            <p v-if="validaciones_no_cobradas > 0" class="imagenes-cifra__pie mb-0">
              {{ numero(validaciones_no_cobradas) }} {{ validaciones_no_cobradas === 1 ? 'no cobrada' : 'no cobradas' }}
            </p>
          </div>
        </div>
      </div>

      <div class="col-12 col-md-6 col-xl-3">
        <div class="card h-100 border-0 imagenes-cifra">
          <div class="card-body">
            <p class="imagenes-cifra__rotulo mb-1">Tokens de IA</p>
            <p class="imagenes-cifra__valor mb-0">{{ numero(totales.tokens) }}</p>
            <!-- Las cuatro puntas, para que las partes sumen el total; las de caché solo si hubo,
                 porque casi siempre son cero y dos renglones en cero son ruido. -->
            <p class="imagenes-cifra__pie mb-0">
              <span class="d-block">{{ numero(totales.tokens_entrada) }} de entrada</span>
              <span class="d-block">{{ numero(totales.tokens_salida) }} de salida</span>
              <span v-if="Number(totales.tokens_cache_escritura || 0) > 0" class="d-block">
                {{ numero(totales.tokens_cache_escritura) }} escritos en caché
              </span>
              <span v-if="Number(totales.tokens_cache_lectura || 0) > 0" class="d-block">
                {{ numero(totales.tokens_cache_lectura) }} leídos de caché
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Los errores del período no tienen tarjeta propia (son la excepción, no la cifra), pero se
         nombran y llevan directo a verlos: es lo primero que alguien quiere mirar si los hay. -->
    <p v-if="errores > 0" class="imagenes-errores mt-3 mb-0">
      {{ numero(errores) }} {{ errores === 1 ? 'consulta terminó' : 'consultas terminaron' }} en error en este período.
      <button type="button" class="btn btn-link btn-sm p-0 align-baseline" @click="$emit('ver-errores')">
        Ver solo esas
      </button>
    </p>
  </div>
</template>

<script>
import { costo_visible, numero, etiqueta, NOMBRES_DE_PROVEEDOR_DE_BUSQUEDA } from './formato'

/**
 * Las cuatro tarjetas del resumen de la solapa "Imágenes": costo estimado, búsquedas,
 * validaciones con IA y tokens, más la línea de errores del período.
 *
 * No calcula ninguna plata: el costo viaja ya aplicado desde el admin-api (con `null` cuando no se
 * sabe). Lo único que hace es decir, en castellano, qué quedó afuera del número y por qué.
 */
export default {
  name: 'ClientImagenesResumenCifras',
  emits: ['ver-errores'],
  props: {
    /** Bloque `totales` del resumen, ya costeado por el admin-api. */
    totales: { type: Object, required: true },
  },
  computed: {
    /**
     * Búsquedas por proveedor, solo los que buscaron algo, el más usado primero.
     * @returns {Array<{proveedor: string, nombre: string, cantidad: number}>}
     */
    busquedas_por_proveedor() {
      const mapa = this.totales.busquedas_por_proveedor || {}
      const filas = []
      Object.keys(mapa).forEach(function (proveedor) {
        const cantidad = Number(mapa[proveedor] || 0)
        if (cantidad > 0) {
          filas.push({
            proveedor: proveedor,
            nombre: etiqueta(NOMBRES_DE_PROVEEDOR_DE_BUSQUEDA, proveedor),
            cantidad: cantidad,
          })
        }
      })
      filas.sort(function (a, b) {
        return b.cantidad - a.cantidad
      })
      return filas
    },
    /**
     * Búsquedas que el proveedor rechazó: se hicieron pero no se pagaron.
     * @returns {number}
     */
    busquedas_no_cobradas() {
      return Math.max(0, Number(this.totales.busquedas || 0) - Number(this.totales.busquedas_cobradas || 0))
    },
    /**
     * Validaciones que no llegaron a cobrarse (la IA no respondió).
     * @returns {number}
     */
    validaciones_no_cobradas() {
      return Math.max(
        0,
        Number(this.totales.validaciones_ia || 0) - Number(this.totales.validaciones_ia_cobradas || 0)
      )
    },
    /**
     * true si en el período hubo validaciones con IA: dispara la aclaración de que esa plata también
     * figura en la solapa Tokens.
     * @returns {boolean}
     */
    hubo_validaciones() {
      return Number(this.totales.validaciones_ia || 0) > 0
    },
    /**
     * Consultas del período que terminaron en error (búsquedas y validaciones).
     * @returns {number}
     */
    errores() {
      return Number(this.totales.errores || 0)
    },
    /**
     * Qué no está adentro del costo, o por qué es un techo. Cada nota es una frase corta.
     *
     * 🔴 Un costo que deja algo afuera tiene que decirlo al lado: un número corto que parece
     * completo es el total que miente que el admin-api se cuida de no armar.
     * @returns {Array<string>}
     */
    notas_del_costo() {
      const notas = []

      const faltantes = []
      const proveedores = Array.isArray(this.totales.proveedores_sin_precio) ? this.totales.proveedores_sin_precio : []
      const modelos = Array.isArray(this.totales.modelos_sin_precio) ? this.totales.modelos_sin_precio : []
      proveedores.forEach(function (proveedor) {
        faltantes.push(
          String(proveedor || '').trim() === ''
            ? 'búsquedas sin proveedor'
            : 'búsquedas de ' + etiqueta(NOMBRES_DE_PROVEEDOR_DE_BUSQUEDA, proveedor)
        )
      })
      modelos.forEach(function (modelo) {
        faltantes.push(String(modelo || '').trim() === '' ? '(sin modelo)' : String(modelo))
      })
      if (faltantes.length > 0) {
        notas.push('No incluye ' + faltantes.join(', ') + ': sin precio cargado.')
      }

      /* "El costo de las búsquedas" y no "las búsquedas": la cantidad es exacta, lo que no se sabe
         exacto es la plata. "Búsquedas" en esta solapa son solo las consultas al buscador. */
      if (this.totales.costo_busquedas_es_techo === true) {
        notas.push('El costo de las búsquedas es un techo: hubo rechazos y no se sabe de qué proveedor eran.')
      }

      const de_google = Number((this.totales.busquedas_por_proveedor || {}).google || 0)
      if (de_google > 0) {
        notas.push('Google va a precio pago: las primeras 100 búsquedas por día son gratis.')
      }

      return notas
    },
  },
  methods: {
    /**
     * Costo en dólares (del módulo de formatos), expuesto para el template.
     * @param {number|null} valor
     * @returns {string}
     */
    costo_visible(valor) {
      return costo_visible(valor)
    },
    /**
     * Número con separadores de miles, expuesto para el template.
     * @param {number|null} valor
     * @returns {string}
     */
    numero(valor) {
      return numero(valor)
    },
  },
}
</script>
