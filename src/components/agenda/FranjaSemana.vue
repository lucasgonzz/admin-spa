<template>
  <!--
    Franja de días arriba de la superficie, sobre el fondo negro de la cabecera:
    - Día: los 7 días de la semana con las burbujas de íconos de las tareas de cada uno.
    - Semana / Varios días: los encabezados de las columnas de la grilla (sin burbujas).
    - Mes: solo los nombres de los días de la semana.
    El día elegido va en un círculo blanco; hoy, en salmón. Cada día recibe tareas arrastradas.
  -->
  <div
    class="ag-franja"
    :class="[
      'ag-franja--' + modo,
      { 'ag-franja--telefono': es_telefono, 'ag-franja--canaleta': con_canaleta },
    ]"
  >
    <template v-if="modo === 'mes'">
      <div v-for="(nombre, indice) in nombres_mes" :key="'ag-fr-mes-' + indice" class="ag-franja__nombre-mes">
        {{ nombre }}
      </div>
    </template>
    <template v-else>
      <button
        v-for="dia in dias_pintados"
        :key="'ag-fr-' + dia.fecha"
        type="button"
        class="ag-franja__dia"
        :class="{
          'ag-franja__dia--elegido': dia.elegido,
          'ag-franja__dia--hoy': dia.es_hoy,
          'ag-franja__dia--sobre': dia_sobre === dia.fecha,
        }"
        :aria-label="dia.aria"
        :aria-current="dia.elegido ? 'date' : null"
        @click="$emit('elegir-dia', dia.fecha)"
        @dragover.prevent="on_drag_over(dia.fecha, $event)"
        @dragleave="on_drag_leave(dia.fecha)"
        @drop.prevent="on_drop(dia.fecha)"
      >
        <span class="ag-franja__rotulo">
          <span class="ag-franja__nombre">{{ dia.nombre }}</span>
          <span class="ag-franja__numero">{{ dia.numero }}</span>
        </span>
        <span v-if="modo === 'dia'" class="ag-franja__burbujas" aria-hidden="true">
          <span
            v-for="(burbuja, indice) in dia.burbujas"
            :key="'ag-fr-b-' + dia.fecha + '-' + indice"
            class="ag-franja__burbuja"
            :class="{ 'ag-franja__burbuja--hecha': burbuja.hecha }"
            :style="{ backgroundColor: burbuja.color, zIndex: 10 - indice }"
          >
            <i class="bi" :class="'bi-' + burbuja.icono" />
          </span>
        </span>
      </button>
    </template>
  </div>
</template>

<script>
import {
  NOMBRES_DIAS_CORTOS,
  INICIALES_DIAS,
  nombre_dia_corto,
  numero_dia,
  fecha_corta,
  color_hex,
} from './agenda_utils'

/** Máximo de burbujas por día en la franja (las de más se esconden detrás). */
const MAX_BURBUJAS = 5

export default {
  name: 'AgendaFranjaSemana',
  props: {
    /** 'dia' | 'semana' | 'varios' | 'mes'. */
    modo: { type: String, required: true },
    /** Fechas a mostrar (`YYYY-MM-DD`). En 'mes' no se usan. */
    dias: { type: Array, default: function () { return [] } },
    /** Día elegido. */
    fecha_elegida: { type: String, required: true },
    /** Hoy. */
    hoy: { type: String, required: true },
    /** Ocurrencias visibles por fecha (`{ 'YYYY-MM-DD': [tarea…] }`), para las burbujas. */
    ocurrencias_por_dia: { type: Object, default: function () { return {} } },
    /** true mientras se arrastra una tarea: los días aceptan que la suelten encima. */
    arrastrando: { type: Boolean, default: false },
    /** true si deja la canaleta de las horas a la izquierda (alineada con la grilla de abajo). */
    con_canaleta: { type: Boolean, default: false },
    /** true en teléfono (iniciales en vez de nombres). */
    es_telefono: { type: Boolean, default: false },
  },
  emits: ['elegir-dia', 'soltar-en-dia'],
  data() {
    return {
      /** Día sobre el que está pasando una tarea arrastrada (se resalta). */
      dia_sobre: null,
    }
  },
  computed: {
    /**
     * Nombres de los días para la cabecera del mes.
     *
     * @returns {string[]}
     */
    nombres_mes() {
      return this.es_telefono ? INICIALES_DIAS : NOMBRES_DIAS_CORTOS
    },
    /**
     * Días listos para pintar: nombre, número, estado y burbujas.
     *
     * @returns {Array<Object>}
     */
    dias_pintados() {
      const self = this
      return self.dias.map(function (fecha) {
        const tareas = self.ocurrencias_por_dia[fecha] || []
        const burbujas = tareas.slice(0, MAX_BURBUJAS).map(function (tarea) {
          return {
            color: color_hex(tarea.color),
            icono: tarea.icon || 'check2-square',
            hecha: !!tarea.completed,
          }
        })
        return {
          fecha: fecha,
          nombre: self.es_telefono ? nombre_dia_corto(fecha).charAt(0) : nombre_dia_corto(fecha),
          numero: numero_dia(fecha),
          elegido: fecha === self.fecha_elegida,
          es_hoy: fecha === self.hoy,
          burbujas: burbujas,
          aria:
            fecha_corta(fecha) +
            (fecha === self.hoy ? ' (hoy)' : '') +
            (tareas.length ? ', ' + tareas.length + (tareas.length === 1 ? ' tarea' : ' tareas') : ''),
        }
      })
    },
  },
  watch: {
    /** Al terminar un arrastre se apaga el resaltado (el dragleave no siempre llega). */
    arrastrando(valor) {
      if (!valor) {
        this.dia_sobre = null
      }
    },
  },
  methods: {
    /**
     * Una tarea arrastrada pasa por encima de un día: se acepta el drop y se resalta.
     *
     * @param {string} fecha
     * @param {DragEvent} evento
     * @returns {void}
     */
    on_drag_over(fecha, evento) {
      if (!this.arrastrando) {
        return
      }
      if (evento.dataTransfer) {
        evento.dataTransfer.dropEffect = 'move'
      }
      this.dia_sobre = fecha
    },
    /**
     * La tarea arrastrada sale del día.
     *
     * @param {string} fecha
     * @returns {void}
     */
    on_drag_leave(fecha) {
      if (this.dia_sobre === fecha) {
        this.dia_sobre = null
      }
    },
    /**
     * Sueltan una tarea en un día: el orquestador le cambia la fecha.
     *
     * @param {string} fecha
     * @returns {void}
     */
    on_drop(fecha) {
      this.dia_sobre = null
      if (!this.arrastrando) {
        return
      }
      this.$emit('soltar-en-dia', fecha)
    },
  },
}
</script>

<style scoped>
.ag-franja {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  padding: 4px 0 14px;
  background: var(--ag-negro);
}

/* Semana y Varios días dejan a la izquierda el ancho de la columna de horas de la grilla. */
.ag-franja--canaleta {
  padding-left: var(--ag-canaleta);
}

.ag-franja__dia {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 6px 2px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: var(--ag-texto);
  cursor: pointer;
  transition: background 0.15s ease;
}

.ag-franja__dia:hover {
  background: rgba(255, 255, 255, 0.04);
}

.ag-franja--varios .ag-franja__dia {
  align-items: flex-start;
  padding-left: 8px;
}

.ag-franja__dia--sobre {
  background: rgba(248, 142, 135, 0.18);
  box-shadow: inset 0 0 0 1px var(--ag-salmon);
}

.ag-franja__rotulo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 26px;
  white-space: nowrap;
}

.ag-franja__nombre {
  color: #b4b4b6;
  font-size: 14px;
  font-weight: 500;
}

.ag-franja__numero {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 26px;
  margin-left: -4px;
  padding: 0 4px;
  border-radius: 13px;
  color: var(--ag-texto);
  font-size: 14px;
  font-weight: 700;
}

.ag-franja__dia--hoy .ag-franja__numero {
  color: var(--ag-salmon);
}

.ag-franja__dia--elegido .ag-franja__numero {
  background: var(--ag-texto);
  color: #000;
}

.ag-franja__dia--elegido.ag-franja__dia--hoy .ag-franja__numero {
  background: var(--ag-salmon);
  color: var(--ag-texto);
}

/* Burbujas: círculos de 18 px del color de cada tarea, montados uno sobre otro. */
.ag-franja__burbujas {
  display: inline-flex;
  align-items: center;
  height: 18px;
}

.ag-franja__burbuja {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-left: -6px;
  border: 1.5px solid var(--ag-negro);
  border-radius: 50%;
  color: #fff;
  font-size: 8px;
}

.ag-franja__burbuja:first-child {
  margin-left: 0;
}

.ag-franja__burbuja--hecha {
  opacity: 0.5;
}

.ag-franja__nombre-mes {
  padding: 10px 0 4px;
  color: #b4b4b6;
  font-size: 14px;
  font-weight: 500;
  text-align: center;
}

.ag-franja--semana,
.ag-franja--varios {
  padding-bottom: 8px;
}

.ag-franja--mes {
  padding-bottom: 10px;
}

/* Teléfono: la inicial del día arriba y el número abajo, todo un poco más chico. */
.ag-franja--telefono .ag-franja__rotulo {
  flex-direction: column;
  gap: 2px;
  height: auto;
}

.ag-franja--telefono .ag-franja__nombre {
  font-size: 11px;
}

.ag-franja--telefono .ag-franja__numero {
  margin-left: 0;
  min-width: 24px;
  height: 24px;
  font-size: 13px;
}

.ag-franja--telefono .ag-franja__dia {
  gap: 4px;
  padding: 4px 0;
}

.ag-franja--telefono.ag-franja--varios .ag-franja__dia {
  align-items: center;
  padding-left: 0;
}

.ag-franja--telefono .ag-franja__burbuja {
  width: 14px;
  height: 14px;
  margin-left: -8px;
  font-size: 6px;
}

.ag-franja--telefono .ag-franja__burbuja:first-child {
  margin-left: 0;
}

.ag-franja--telefono .ag-franja__nombre-mes {
  font-size: 12px;
}
</style>
