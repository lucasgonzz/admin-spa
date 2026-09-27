<template>
  <div class="card border-0 imagenes-panel">
    <div class="card-body">
      <p class="imagenes-panel__titulo mb-3">Por día</p>

      <p v-if="dias_con_consultas.length === 0" class="text-muted small fst-italic mb-0">
        Sin consultas en este período.
      </p>

      <div v-else class="table-responsive">
        <table class="table table-sm align-middle mb-0 imagenes-tabla">
          <thead>
            <tr>
              <th>Día</th>
              <th class="text-end">Búsquedas</th>
              <th class="text-end">Validaciones con IA</th>
              <th class="text-end">Errores</th>
              <th class="text-end">Costo búsquedas</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="dia in dias_con_consultas" :key="dia.fecha">
              <td :title="fecha_larga(dia.fecha)">{{ dia_y_mes(dia.fecha) }}</td>
              <td class="text-end">
                {{ numero(dia.busquedas) }}
                <span v-if="reparto_de(dia)" class="imagenes-tabla__nota d-block">{{ reparto_de(dia) }}</span>
              </td>
              <td class="text-end">{{ numero(dia.validaciones_ia) }}</td>
              <td class="text-end" :class="{ 'imagenes-tabla__error': Number(dia.errores || 0) > 0 }">
                {{ numero(dia.errores) }}
              </td>
              <td class="text-end">
                {{ costo_visible(dia.costo_busquedas_usd) }}
                <span v-if="dia.costo_busquedas_es_techo" class="imagenes-tabla__nota d-block">techo</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- El costo de la IA no se abre por día: el sistema del cliente informa los tokens por
           modelo del período entero, y sin el modelo de cada día no hay precio que aplicar. Se
           dice para que la columna no se lea como "el costo del día". -->
      <p v-if="dias_con_consultas.length > 0" class="imagenes-tabla__nota mb-0 mt-2">
        Solo los días con consultas. El costo por día es el de las búsquedas; el de la IA está en el
        total del período.
      </p>
    </div>
  </div>
</template>

<script>
import { costo_visible, numero, dia_y_mes, fecha_larga, etiqueta, NOMBRES_DE_PROVEEDOR_DE_BUSQUEDA } from './formato'

/**
 * Tabla "Por día" de la solapa "Imágenes": búsquedas, validaciones, errores y costo de las
 * búsquedas de cada día del período.
 *
 * Muestra solo los días que tuvieron alguna consulta, el más reciente arriba. Treinta renglones
 * con ceros esconderían los cinco que importan; el período se lee arriba, en el selector.
 */
export default {
  name: 'ClientImagenesTablaPorDia',
  props: {
    /** Bloque `dias` del resumen, ya costeado por el admin-api. */
    dias: { type: Array, default: () => [] },
  },
  computed: {
    /**
     * Los días con al menos una búsqueda, una validación o un error, del más nuevo al más viejo.
     * @returns {Array<Object>}
     */
    dias_con_consultas() {
      const con_algo = this.dias.filter(function (dia) {
        return (
          Number(dia.busquedas || 0) > 0 ||
          Number(dia.validaciones_ia || 0) > 0 ||
          Number(dia.errores || 0) > 0
        )
      })
      con_algo.sort(function (a, b) {
        return String(b.fecha || '').localeCompare(String(a.fecha || ''))
      })
      return con_algo
    },
  },
  methods: {
    /**
     * Cómo se repartieron las búsquedas del día entre proveedores ("30 Serper · 2 Google"), o
     * vacío si no hubo búsquedas.
     *
     * El contrato abre cada proveedor como `busquedas_<proveedor>`. Se recorren los proveedores
     * CONOCIDOS (los del mapa de nombres) y no cualquier clave que empiece con `busquedas_`: una
     * clave nueva del contrato (`busquedas_cobradas` ya existe) se leería como un proveedor más.
     * Sumar un proveedor es sumarlo al mapa, una línea.
     * @param {Object} dia
     * @returns {string}
     */
    reparto_de(dia) {
      const partes = []
      Object.keys(NOMBRES_DE_PROVEEDOR_DE_BUSQUEDA).forEach(function (proveedor) {
        const cantidad = Number(dia['busquedas_' + proveedor] || 0)
        if (cantidad > 0) {
          partes.push(numero(cantidad) + ' ' + etiqueta(NOMBRES_DE_PROVEEDOR_DE_BUSQUEDA, proveedor))
        }
      })
      return partes.join(' · ')
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
     * Número con separadores de miles, expuesto para el template.
     * @param {number|null} valor
     * @returns {string}
     */
    numero(valor) {
      return numero(valor)
    },
    /**
     * Día y mes de una fecha AAAA-MM-DD, expuesto para el template.
     * @param {string} fecha
     * @returns {string}
     */
    dia_y_mes(fecha) {
      return dia_y_mes(fecha)
    },
    /**
     * Fecha completa, para el `title` de la celda.
     * @param {string} fecha
     * @returns {string}
     */
    fecha_larga(fecha) {
      return fecha_larga(fecha)
    },
  },
}
</script>
