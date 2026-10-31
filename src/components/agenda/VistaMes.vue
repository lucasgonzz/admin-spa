<template>
  <!--
    Vista Mes: grilla de 6 semanas (de domingo a sábado) como la de Structured. En cada día, hasta
    3 tareas con su círculo, el título cortado y la hora a la derecha, unidas por la línea del
    color; si hay más, "N más…" lleva a la vista Día. Las hechas van tachadas. Hoy lleva el número
    en un círculo salmón y la celda teñida; el día elegido, la celda más clara.
    Cada celda recibe tareas arrastradas (cambia la fecha y mantiene la hora).
  -->
  <div class="ag-mes" :class="{ 'ag-mes--telefono': es_telefono }">
    <div
      v-for="celda in celdas"
      :key="'ag-mes-' + celda.fecha"
      class="ag-mes__celda"
      :class="{
        'ag-mes__celda--fuera': !celda.del_mes,
        'ag-mes__celda--hoy': celda.es_hoy,
        'ag-mes__celda--elegida': celda.elegida,
        'ag-mes__celda--sobre': celda_sobre === celda.fecha,
      }"
      role="button"
      tabindex="0"
      :aria-label="celda.aria"
      @click="$emit('elegir-dia', celda.fecha)"
      @dblclick="$emit('ver-dia', celda.fecha)"
      @keydown.enter="$emit('ver-dia', celda.fecha)"
      @dragover.prevent="on_drag_over(celda.fecha, $event)"
      @dragleave="on_drag_leave(celda.fecha, $event)"
      @drop.prevent="on_drop(celda.fecha)"
    >
      <button
        type="button"
        class="ag-mes__numero"
        :aria-label="'Ver el día ' + celda.numero"
        @click.stop="$emit('ver-dia', celda.fecha)"
      >
        {{ celda.numero }}
      </button>

      <!-- Escritorio y tablet: filas con círculo, título y hora -->
      <ul v-if="!es_telefono" class="ag-mes__tareas">
        <li
          v-for="(tarea, indice) in celda.visibles"
          :key="'ag-mes-t-' + celda.fecha + '-' + tarea.id"
          class="ag-mes__tarea"
          :class="{
            'ag-mes__tarea--hecha': tarea.completed,
            'ag-mes__tarea--arrastrada': clave_arrastrada === clave_de(tarea),
          }"
          draggable="true"
          :title="tarea.title"
          @click.stop="$emit('abrir', tarea)"
          @dragstart="on_drag_start(tarea, $event)"
          @dragend="on_drag_end"
        >
          <span class="ag-mes__circulo" :style="estilo_circulo(tarea)">
            <i class="bi" :class="'bi-' + (tarea.icon || 'check2-square')" aria-hidden="true" />
            <span
              v-if="indice < celda.visibles.length - 1"
              class="ag-mes__union"
              :style="{ backgroundColor: color_de(tarea) }"
              aria-hidden="true"
            />
          </span>
          <span class="ag-mes__titulo">{{ tarea.title }}</span>
          <span class="ag-mes__hora">{{ hora_corta(tarea) }}</span>
        </li>
      </ul>

      <!-- Teléfono: solo los círculos -->
      <div v-else class="ag-mes__puntos">
        <span
          v-for="tarea in celda.visibles"
          :key="'ag-mes-p-' + celda.fecha + '-' + tarea.id"
          class="ag-mes__punto"
          :class="{ 'ag-mes__punto--hecho': tarea.completed }"
          :style="estilo_circulo(tarea)"
          @click.stop="$emit('abrir', tarea)"
        >
          <i class="bi" :class="'bi-' + (tarea.icon || 'check2-square')" aria-hidden="true" />
        </span>
      </div>

      <button
        v-if="celda.restantes > 0"
        type="button"
        class="ag-mes__mas"
        @click.stop="$emit('ver-dia', celda.fecha)"
      >
        {{ es_telefono ? '+' + celda.restantes : celda.restantes + ' más…' }}
      </button>
    </div>
  </div>
</template>

<script>
import {
  clave_ocurrencia,
  color_hex,
  es_color_claro,
  grilla_mes,
  mismo_mes,
  numero_dia,
  fecha_corta,
  hora_de_minutos,
  inicio_de,
} from './agenda_utils'

/** Tareas que entran en una celda antes de "N más…". */
const MAX_POR_CELDA = 3

export default {
  name: 'AgendaVistaMes',
  props: {
    /** Día elegido: define el mes que se muestra. */
    fecha_elegida: { type: String, required: true },
    /** Hoy. */
    hoy: { type: String, required: true },
    /** Ocurrencias visibles por fecha. */
    ocurrencias_por_dia: { type: Object, default: function () { return {} } },
    /** true mientras se arrastra una tarea. */
    arrastrando: { type: Boolean, default: false },
    /** true en teléfono (solo círculos). */
    es_telefono: { type: Boolean, default: false },
  },
  emits: ['elegir-dia', 'ver-dia', 'abrir', 'soltar', 'iniciar-arrastre', 'terminar-arrastre'],
  data() {
    return {
      /** Celda sobre la que pasa una tarea arrastrada. */
      celda_sobre: null,
      /** Clave de la tarea que se está arrastrando desde el mes. */
      clave_arrastrada: null,
    }
  },
  computed: {
    /**
     * Las 42 celdas listas para pintar.
     *
     * @returns {Array<Object>}
     */
    celdas() {
      const self = this
      return grilla_mes(self.fecha_elegida).map(function (fecha) {
        const tareas = self.ocurrencias_por_dia[fecha] || []
        return {
          fecha: fecha,
          numero: numero_dia(fecha),
          del_mes: mismo_mes(fecha, self.fecha_elegida),
          es_hoy: fecha === self.hoy,
          elegida: fecha === self.fecha_elegida,
          visibles: tareas.slice(0, MAX_POR_CELDA),
          restantes: Math.max(0, tareas.length - MAX_POR_CELDA),
          aria:
            fecha_corta(fecha) +
            (tareas.length ? ', ' + tareas.length + (tareas.length === 1 ? ' tarea' : ' tareas') : ', sin tareas'),
        }
      })
    },
  },
  watch: {
    /** Al terminar un arrastre se apagan los resaltados. */
    arrastrando(valor) {
      if (!valor) {
        this.celda_sobre = null
        this.clave_arrastrada = null
      }
    },
  },
  methods: {
    /**
     * Clave de ocurrencia (para los `:key` y el arrastre).
     *
     * @param {Object} tarea
     * @returns {string}
     */
    clave_de(tarea) {
      return clave_ocurrencia(tarea)
    },
    /**
     * Hex del color de una tarea.
     *
     * @param {Object} tarea
     * @returns {string}
     */
    color_de(tarea) {
      return color_hex(tarea.color)
    },
    /**
     * Colores del círculo (fondo del color, ícono blanco u oscuro).
     *
     * @param {Object} tarea
     * @returns {Object}
     */
    estilo_circulo(tarea) {
      const color = color_hex(tarea.color)
      return { backgroundColor: color, color: es_color_claro(color) ? '#1c1c1e' : '#ffffff' }
    },
    /**
     * Hora de inicio para la celda ("9:45"); vacío si es de todo el día.
     *
     * @param {Object} tarea
     * @returns {string}
     */
    hora_corta(tarea) {
      const inicio = inicio_de(tarea)
      if (inicio === null) {
        return ''
      }
      const texto = hora_de_minutos(inicio)
      return texto.charAt(0) === '0' ? texto.substring(1) : texto
    },
    /**
     * Empieza a arrastrar una tarea desde el mes.
     *
     * @param {Object} tarea
     * @param {DragEvent} evento
     * @returns {void}
     */
    on_drag_start(tarea, evento) {
      if (evento.dataTransfer) {
        evento.dataTransfer.effectAllowed = 'move'
        evento.dataTransfer.setData('text/plain', tarea.title || '')
      }
      this.clave_arrastrada = clave_ocurrencia(tarea)
      this.$emit('iniciar-arrastre', tarea)
    },
    /**
     * Termina el arrastre.
     *
     * @returns {void}
     */
    on_drag_end() {
      this.clave_arrastrada = null
      this.$emit('terminar-arrastre')
    },
    /**
     * Una tarea arrastrada pasa por una celda.
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
      this.celda_sobre = fecha
    },
    /**
     * La tarea arrastrada sale de la celda (ignorando el paso por sus hijos).
     *
     * @param {string} fecha
     * @param {DragEvent} evento
     * @returns {void}
     */
    on_drag_leave(fecha, evento) {
      if (evento.currentTarget && evento.relatedTarget && evento.currentTarget.contains(evento.relatedTarget)) {
        return
      }
      if (this.celda_sobre === fecha) {
        this.celda_sobre = null
      }
    },
    /**
     * Sueltan una tarea en una celda: va a ese día con la misma hora.
     *
     * @param {string} fecha
     * @returns {void}
     */
    on_drop(fecha) {
      this.celda_sobre = null
      if (!this.arrastrando) {
        return
      }
      this.$emit('soltar', { tipo: 'dia', fecha: fecha })
    },
  },
}
</script>

<style scoped>
.ag-mes {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  grid-template-rows: repeat(6, minmax(132px, 1fr));
  min-height: 100%;
}

.ag-mes__celda {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 8px 6px 6px;
  border-right: 1px solid #333335;
  border-bottom: 1px solid #333335;
  cursor: pointer;
  outline: none;
  transition: background 0.15s ease;
}

.ag-mes__celda:nth-child(7n) {
  border-right: 0;
}

.ag-mes__celda:hover {
  background: rgba(255, 255, 255, 0.02);
}

.ag-mes__celda:focus-visible {
  box-shadow: inset 0 0 0 2px rgba(248, 142, 135, 0.6);
}

.ag-mes__celda--hoy {
  background: rgba(248, 142, 135, 0.09);
}

.ag-mes__celda--elegida {
  background: var(--ag-elevado);
  box-shadow: inset 0 0 0 1px #4a4a4c;
}

.ag-mes__celda--sobre {
  background: rgba(248, 142, 135, 0.18);
  box-shadow: inset 0 0 0 1px var(--ag-salmon);
}

.ag-mes__numero {
  align-self: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 26px;
  margin-bottom: 6px;
  padding: 0 4px;
  border: 0;
  border-radius: 13px;
  background: transparent;
  color: var(--ag-texto);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.ag-mes__celda--fuera .ag-mes__numero {
  color: #6a6a6c;
}

.ag-mes__celda--hoy .ag-mes__numero {
  background: var(--ag-salmon);
  color: #fff;
}

.ag-mes__tareas {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ag-mes__tarea {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  cursor: pointer;
}

.ag-mes__tarea--arrastrada {
  opacity: 0.35;
}

.ag-mes__circulo {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 10px;
}

.ag-mes__union {
  position: absolute;
  top: 100%;
  left: calc(50% - 1px);
  width: 2px;
  height: 8px;
}

.ag-mes__titulo {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--ag-texto);
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-mes__hora {
  flex: 0 0 auto;
  color: var(--ag-apagado);
  font-size: 10px;
}

.ag-mes__tarea--hecha .ag-mes__titulo {
  color: var(--ag-apagado);
  text-decoration: line-through;
}

.ag-mes__tarea--hecha .ag-mes__circulo {
  opacity: 0.6;
}

.ag-mes__mas {
  align-self: flex-start;
  margin-top: 6px;
  margin-left: 28px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ag-apagado);
  font-size: 11px;
  cursor: pointer;
}

.ag-mes__mas:hover {
  color: var(--ag-texto);
}

/* ---------- Teléfono: celdas bajas y solo círculos ---------- */
.ag-mes--telefono {
  grid-template-rows: repeat(6, minmax(76px, 1fr));
}

.ag-mes--telefono .ag-mes__celda {
  align-items: center;
  padding: 4px 2px;
}

.ag-mes--telefono .ag-mes__numero {
  min-width: 22px;
  height: 22px;
  margin-bottom: 4px;
  font-size: 12px;
}

.ag-mes__puntos {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2px;
}

.ag-mes__punto {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  font-size: 8px;
}

.ag-mes__punto--hecho {
  opacity: 0.5;
}

.ag-mes--telefono .ag-mes__mas {
  align-self: center;
  margin: 2px 0 0;
  font-size: 10px;
}
</style>
