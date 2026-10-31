<template>
  <!--
    Vista Día: la línea de tiempo vertical de Structured. A la izquierda los rótulos de hora
    (inicio arriba, fin abajo), en el medio el círculo (o la píldora, si dura más) del color de la
    tarea con su ícono, unido al siguiente por una línea del mismo color, después el horario y el
    título, y a la derecha el círculo de hecho. Entre dos tareas con 15 min o más de diferencia
    aparece "Tiempo libre. ¿Qué sigue?", que crea una tarea a esa hora.
    Toda la vista recibe tareas arrastradas (de la bandeja o de otro día); un hueco, además,
    las recibe a su hora.
  -->
  <div
    class="ag-dia"
    :class="{ 'ag-dia--telefono': es_telefono, 'ag-dia--sobre': sobre_vista }"
    @dragover.prevent="on_drag_over_vista"
    @dragleave="on_drag_leave_vista"
    @drop.prevent="on_drop_vista"
  >
    <!-- Estado vacío: ilustración armada con íconos (no la de Structured) y los dos textos -->
    <div v-if="!hay_tareas" class="ag-vacio">
      <div class="ag-vacio__ilustracion" aria-hidden="true">
        <div class="ag-vacio__circulos">
          <span v-for="n in 7" :key="'ag-vacio-c-' + n" class="ag-vacio__circulo" />
        </div>
        <div class="ag-vacio__escena">
          <div class="ag-vacio__riel">
            <span class="ag-vacio__pildora"><i class="bi bi-cart3" /></span>
            <span class="ag-vacio__punteado" />
            <span class="ag-vacio__pildora ag-vacio__pildora--inclinada"><i class="bi bi-mortarboard-fill" /></span>
          </div>
          <div class="ag-vacio__lineas">
            <span class="ag-vacio__barra ag-vacio__barra--larga" />
            <span class="ag-vacio__barra" />
            <span class="ag-vacio__tilde"><i class="bi bi-check-lg" /></span>
          </div>
          <span class="ag-vacio__persona"><i class="bi bi-person-raised-hand" /></span>
          <span class="ag-vacio__lapiz"><i class="bi bi-pencil-fill" /></span>
        </div>
      </div>
      <p class="ag-vacio__titulo">Planificá tu día y agregá una tarea para empezar</p>
      <p class="ag-vacio__texto">Dá el primer paso hacia un día productivo.</p>
    </div>

    <div v-else class="ag-dia__linea-tiempo">
      <template v-for="fila in filas" :key="fila.clave">
        <!-- Hueco entre tareas -->
        <div
          v-if="fila.tipo === 'hueco'"
          class="ag-dia__fila ag-dia__fila--hueco"
          :class="{ 'ag-dia__fila--sobre': hueco_sobre === fila.clave }"
          role="button"
          tabindex="0"
          :aria-label="'Tiempo libre desde las ' + fila.hora + '. Crear una tarea'"
          @click="on_click_hueco(fila)"
          @keydown.enter="on_click_hueco(fila)"
          @dragover.prevent.stop="on_drag_over_hueco(fila.clave, $event)"
          @dragleave="on_drag_leave_hueco(fila.clave)"
          @drop.prevent.stop="on_drop_hueco(fila)"
        >
          <div class="ag-dia__horas" />
          <div class="ag-dia__riel">
            <span class="ag-dia__linea ag-dia__linea--hueco" :style="{ backgroundColor: fila.color }" />
          </div>
          <div class="ag-dia__contenido ag-dia__hueco-texto">Tiempo libre. ¿Qué sigue?</div>
          <div />
        </div>

        <!-- Tarea (con horario o de todo el día) -->
        <div
          v-else
          class="ag-dia__fila"
          :class="{
            'ag-dia__fila--hecha': fila.tarea.completed,
            'ag-dia__fila--seleccionada': fila.seleccionada,
            'ag-dia__fila--arrastrada': clave_arrastrada === fila.clave,
          }"
          role="button"
          tabindex="0"
          :draggable="seleccion_activa ? 'false' : 'true'"
          :aria-label="fila.aria"
          @click="on_click_tarea(fila.tarea)"
          @keydown.enter="on_click_tarea(fila.tarea)"
          @dragstart="on_drag_start(fila, $event)"
          @dragend="on_drag_end"
        >
          <div class="ag-dia__horas" :style="{ height: fila.alto + 'px' }">
            <template v-if="fila.tipo === 'todo_el_dia'">
              <span v-if="fila.primera_todo_el_dia" class="ag-dia__hora">Todo el día</span>
            </template>
            <template v-else>
              <span class="ag-dia__hora">{{ fila.inicio }}</span>
              <span class="ag-dia__hora ag-dia__hora--fin">{{ fila.fin }}</span>
            </template>
          </div>

          <div class="ag-dia__riel">
            <span v-if="fila.con_linea" class="ag-dia__linea" :style="{ backgroundColor: fila.color, top: fila.alto / 2 + 'px' }" />
            <span
              class="ag-dia__pildora"
              :style="{ backgroundColor: fila.color, height: fila.alto + 'px', color: fila.color_icono }"
            >
              <i class="bi" :class="'bi-' + (fila.tarea.icon || 'check2-square')" aria-hidden="true" />
            </span>
            <span
              v-if="seleccion_activa"
              class="ag-casillero ag-dia__casillero"
              :class="{ 'ag-casillero--marcado': fila.seleccionada }"
              aria-hidden="true"
            >
              <i v-if="fila.seleccionada" class="bi bi-check-lg" />
            </span>
          </div>

          <div class="ag-dia__contenido">
            <div class="ag-dia__horario">{{ fila.horario }}</div>
            <div class="ag-dia__titulo">{{ fila.tarea.title }}</div>
            <button
              v-if="fila.tarea.subtasks_total > 0"
              type="button"
              class="ag-dia__subpasos-toggle"
              :aria-expanded="expandidas[fila.clave] ? 'true' : 'false'"
              :aria-label="'Subpasos: ' + fila.tarea.subtasks_done + ' de ' + fila.tarea.subtasks_total"
              @click.stop="alternar_expandida(fila.clave)"
            >
              <i class="bi bi-check-square-fill" aria-hidden="true" />
              {{ fila.tarea.subtasks_done }}/{{ fila.tarea.subtasks_total }}
              <i class="bi" :class="expandidas[fila.clave] ? 'bi-chevron-up' : 'bi-chevron-down'" aria-hidden="true" />
            </button>
            <ul v-if="expandidas[fila.clave] && fila.tarea.subtasks_total > 0" class="ag-dia__subpasos" @click.stop>
              <li v-for="subpaso in fila.tarea.subtasks" :key="'ag-dia-sp-' + subpaso.id">
                <button
                  type="button"
                  class="ag-dia__subpaso"
                  :class="{ 'ag-dia__subpaso--hecho': subpaso.done }"
                  :aria-pressed="subpaso.done ? 'true' : 'false'"
                  @click.stop="$emit('alternar-subpaso', fila.tarea, subpaso)"
                >
                  <span class="ag-check" :class="{ 'ag-check--marcado': subpaso.done }">
                    <i v-if="subpaso.done" class="bi bi-check-lg" aria-hidden="true" />
                  </span>
                  <span class="ag-dia__subpaso-texto">{{ subpaso.title }}</span>
                </button>
              </li>
            </ul>
          </div>

          <button
            type="button"
            class="ag-hecho ag-dia__hecho"
            :class="{ 'ag-hecho--marcado': fila.tarea.completed }"
            :style="{ borderColor: fila.color, backgroundColor: fila.tarea.completed ? fila.color : 'transparent', top: fila.alto / 2 - 11 + 'px' }"
            :aria-pressed="fila.tarea.completed ? 'true' : 'false'"
            :aria-label="fila.tarea.completed ? 'Marcar como no hecha' : 'Marcar como hecha'"
            @click.stop="$emit('alternar-hecha', fila.tarea)"
          >
            <i v-if="fila.tarea.completed" class="bi bi-check-lg" :style="{ color: fila.color_icono }" aria-hidden="true" />
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import {
  clave_ocurrencia,
  clave_seleccion,
  color_hex,
  es_color_claro,
  hora_de_minutos,
  inicio_de,
  fin_de,
  texto_horario,
} from './agenda_utils'

/** Alto del círculo de una tarea de 15 min o menos, en px (como en Structured). */
const ALTO_CIRCULO = 46

/** Tope de alto de la píldora de una tarea larga, en px. */
const ALTO_MAXIMO = 180

/** Px que crece la píldora por cada minuto pasados los primeros 15. */
const PX_POR_MINUTO = 0.6

/** Hueco mínimo entre dos tareas para ofrecer "Tiempo libre. ¿Qué sigue?", en minutos. */
const HUECO_MINIMO = 15

export default {
  name: 'AgendaVistaDia',
  props: {
    /** Fecha que se muestra (`YYYY-MM-DD`). */
    fecha: { type: String, required: true },
    /** Ocurrencias de ese día ya filtradas y ordenadas (todo-el-día primero, después por hora). */
    ocurrencias: { type: Array, default: function () { return [] } },
    /** true si la selección múltiple está activa: tocar una tarea la elige en vez de abrirla. */
    seleccion_activa: { type: Boolean, default: false },
    /** Claves de selección (`clave_seleccion`) de las tareas elegidas. */
    seleccionadas: { type: Array, default: function () { return [] } },
    /** true mientras se arrastra una tarea (de cualquier lado). */
    arrastrando: { type: Boolean, default: false },
    /** true en teléfono (columna de horas y círculos más angostos). */
    es_telefono: { type: Boolean, default: false },
  },
  emits: [
    'abrir',
    'alternar-hecha',
    'alternar-subpaso',
    'nueva-en',
    'alternar-seleccion',
    'iniciar-arrastre',
    'terminar-arrastre',
    'soltar',
  ],
  data() {
    return {
      /** Tareas con los subpasos desplegados (`{ clave_ocurrencia: true }`). */
      expandidas: {},
      /** Clave de la tarea que se está arrastrando desde esta vista (se ve apagada). */
      clave_arrastrada: null,
      /** Clave del hueco sobre el que pasa una tarea arrastrada. */
      hueco_sobre: null,
      /** true si una tarea arrastrada pasa por la vista (fuera de un hueco). */
      sobre_vista: false,
    }
  },
  computed: {
    /**
     * Indica si hay algo que mostrar (si no, va el estado vacío).
     *
     * @returns {boolean}
     */
    hay_tareas() {
      return this.ocurrencias.length > 0
    },
    /**
     * Filas de la línea de tiempo: tareas de todo el día arriba, después las de horario con los
     * huecos de "Tiempo libre" entre medio.
     *
     * @returns {Array<Object>}
     */
    filas() {
      const self = this
      const filas = []
      const todo_el_dia = []
      const con_horario = []
      self.ocurrencias.forEach(function (tarea) {
        if (inicio_de(tarea) === null) {
          todo_el_dia.push(tarea)
        } else {
          con_horario.push(tarea)
        }
      })

      todo_el_dia.forEach(function (tarea, indice) {
        const fila = self.armar_fila_tarea(tarea, 'todo_el_dia')
        fila.primera_todo_el_dia = indice === 0
        /* Las de todo el día se unen entre ellas, pero no con las de horario. */
        fila.con_linea = indice < todo_el_dia.length - 1
        filas.push(fila)
      })

      /* Fin más tardío visto hasta ahora: si dos tareas se pisan, el hueco se mide desde el que
         termina último, no desde la anterior en la lista. */
      let fin_maximo = null
      con_horario.forEach(function (tarea, indice) {
        const fila = self.armar_fila_tarea(tarea, 'tarea')
        fila.con_linea = indice < con_horario.length - 1
        filas.push(fila)
        const fin = fin_de(tarea)
        fin_maximo = fin_maximo === null ? fin : Math.max(fin_maximo, fin)
        const siguiente = con_horario[indice + 1]
        if (siguiente && inicio_de(siguiente) - fin_maximo >= HUECO_MINIMO) {
          filas.push({
            tipo: 'hueco',
            clave: 'hueco-' + fin_maximo,
            hora: hora_de_minutos(fin_maximo),
            color: color_hex(tarea.color),
          })
        }
      })
      return filas
    },
  },
  watch: {
    /** Al cambiar de día se cierran los subpasos desplegados. */
    fecha() {
      this.expandidas = {}
    },
    /** Al terminar un arrastre se apagan los resaltados. */
    arrastrando(valor) {
      if (!valor) {
        this.clave_arrastrada = null
        this.hueco_sobre = null
        this.sobre_vista = false
      }
    },
  },
  methods: {
    /**
     * Arma los datos de pintado de una fila de tarea.
     *
     * @param {Object} tarea Ocurrencia con la forma de la API.
     * @param {string} tipo 'tarea' | 'todo_el_dia'
     * @returns {Object}
     */
    armar_fila_tarea(tarea, tipo) {
      const color = color_hex(tarea.color)
      const duracion = parseInt(tarea.duration_minutes, 10) || 15
      /* En teléfono el círculo es de 40 px para que entre el título. */
      const alto_base = this.es_telefono ? 40 : ALTO_CIRCULO
      const alto =
        tipo === 'todo_el_dia'
          ? alto_base
          : Math.min(ALTO_MAXIMO, alto_base + Math.max(0, duracion - 15) * PX_POR_MINUTO)
      const inicio = inicio_de(tarea)
      const horario = texto_horario(tarea)
      return {
        tipo: tipo,
        clave: clave_ocurrencia(tarea),
        tarea: tarea,
        color: color,
        color_icono: es_color_claro(color) ? '#1c1c1e' : '#ffffff',
        alto: Math.round(alto),
        inicio: inicio === null ? '' : hora_de_minutos(inicio),
        fin: inicio === null ? '' : hora_de_minutos(fin_de(tarea)),
        horario: horario,
        seleccionada: this.seleccionadas.indexOf(clave_seleccion(tarea)) !== -1,
        aria: tarea.title + ', ' + horario + (tarea.completed ? ', hecha' : ''),
        con_linea: false,
        primera_todo_el_dia: false,
      }
    },
    /**
     * Toque sobre una tarea: con la selección múltiple la elige; si no, abre el panel.
     *
     * @param {Object} tarea
     * @returns {void}
     */
    on_click_tarea(tarea) {
      if (this.seleccion_activa) {
        this.$emit('alternar-seleccion', tarea)
        return
      }
      this.$emit('abrir', tarea)
    },
    /**
     * Toque sobre "Tiempo libre. ¿Qué sigue?": tarea nueva a esa hora. Con la selección múltiple
     * activa no hace nada (se está eligiendo, no creando).
     *
     * @param {Object} fila Fila del hueco.
     * @returns {void}
     */
    on_click_hueco(fila) {
      if (this.seleccion_activa) {
        return
      }
      this.$emit('nueva-en', { fecha: this.fecha, hora: fila.hora })
    },
    /**
     * Despliega o pliega los subpasos de una tarea.
     *
     * @param {string} clave
     * @returns {void}
     */
    alternar_expandida(clave) {
      const copia = Object.assign({}, this.expandidas)
      if (copia[clave]) {
        delete copia[clave]
      } else {
        copia[clave] = true
      }
      this.expandidas = copia
    },
    /**
     * Empieza a arrastrar una tarea (drag & drop nativo de HTML5).
     *
     * @param {Object} fila
     * @param {DragEvent} evento
     * @returns {void}
     */
    on_drag_start(fila, evento) {
      if (this.seleccion_activa) {
        evento.preventDefault()
        return
      }
      if (evento.dataTransfer) {
        evento.dataTransfer.effectAllowed = 'move'
        /* Firefox no arranca el arrastre si no se carga algún dato. */
        evento.dataTransfer.setData('text/plain', fila.tarea.title || '')
      }
      this.clave_arrastrada = fila.clave
      this.$emit('iniciar-arrastre', fila.tarea)
    },
    /**
     * Termina el arrastre (se haya soltado en un destino válido o no).
     *
     * @returns {void}
     */
    on_drag_end() {
      this.clave_arrastrada = null
      this.$emit('terminar-arrastre')
    },
    /**
     * Una tarea arrastrada pasa por la vista: se acepta como "a este día".
     *
     * @param {DragEvent} evento
     * @returns {void}
     */
    on_drag_over_vista(evento) {
      if (!this.arrastrando) {
        return
      }
      if (evento.dataTransfer) {
        evento.dataTransfer.dropEffect = 'move'
      }
      this.sobre_vista = true
    },
    /**
     * La tarea arrastrada sale de la vista.
     *
     * @param {DragEvent} evento
     * @returns {void}
     */
    on_drag_leave_vista(evento) {
      if (evento.currentTarget && evento.relatedTarget && evento.currentTarget.contains(evento.relatedTarget)) {
        return
      }
      this.sobre_vista = false
    },
    /**
     * Sueltan una tarea en la vista (fuera de un hueco): va a este día.
     *
     * @returns {void}
     */
    on_drop_vista() {
      this.sobre_vista = false
      if (!this.arrastrando) {
        return
      }
      this.$emit('soltar', { tipo: 'dia', fecha: this.fecha })
    },
    /**
     * Una tarea arrastrada pasa por un hueco libre.
     *
     * @param {string} clave
     * @param {DragEvent} evento
     * @returns {void}
     */
    on_drag_over_hueco(clave, evento) {
      if (!this.arrastrando) {
        return
      }
      if (evento.dataTransfer) {
        evento.dataTransfer.dropEffect = 'move'
      }
      this.sobre_vista = false
      this.hueco_sobre = clave
    },
    /**
     * La tarea arrastrada sale del hueco.
     *
     * @param {string} clave
     * @returns {void}
     */
    on_drag_leave_hueco(clave) {
      if (this.hueco_sobre === clave) {
        this.hueco_sobre = null
      }
    },
    /**
     * Sueltan una tarea en un hueco: va a este día, a la hora en que arranca el hueco.
     *
     * @param {Object} fila Fila del hueco.
     * @returns {void}
     */
    on_drop_hueco(fila) {
      this.hueco_sobre = null
      if (!this.arrastrando) {
        return
      }
      this.$emit('soltar', { tipo: 'hora', fecha: this.fecha, hora: fila.hora })
    },
  },
}
</script>

<style scoped>
.ag-dia {
  min-height: 100%;
  padding: 56px 24px 120px;
  transition: background 0.15s ease;
}

.ag-dia--sobre {
  background: rgba(248, 142, 135, 0.05);
}

.ag-dia__linea-tiempo {
  max-width: 800px;
  margin: 0 auto;
}

/* Cada fila: horas | riel (círculo y línea) | contenido | círculo de hecho. */
.ag-dia__fila {
  position: relative;
  display: grid;
  grid-template-columns: 64px 46px minmax(0, 1fr) 44px;
  column-gap: 22px;
  padding: 13px 16px;
  margin-bottom: 2px;
  border-radius: 16px;
  cursor: pointer;
  outline: none;
  transition: background 0.15s ease, opacity 0.15s ease;
}

.ag-dia__fila:focus-visible {
  box-shadow: inset 0 0 0 2px rgba(248, 142, 135, 0.6);
}

.ag-dia__fila--seleccionada {
  background: var(--ag-elevado);
}

.ag-dia__fila--arrastrada {
  opacity: 0.4;
}

.ag-dia__horas {
  position: relative;
  min-height: 46px;
}

.ag-dia__hora {
  position: absolute;
  top: 3px;
  right: 0;
  color: var(--ag-apagado);
  font-size: 10px;
  line-height: 1;
  white-space: nowrap;
}

.ag-dia__hora--fin {
  top: auto;
  bottom: 3px;
}

.ag-dia__riel {
  position: relative;
}

/* Línea que une el círculo con el de la fila de abajo (cruza el padding y el margen). */
.ag-dia__linea {
  position: absolute;
  bottom: -28px;
  left: 50%;
  width: 2px;
  margin-left: -1px;
}

.ag-dia__linea--hueco {
  top: -13px;
  opacity: 0.9;
}

.ag-dia__pildora {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  min-height: 46px;
  border-radius: 23px;
  font-size: 18px;
  transition: opacity 0.15s ease;
}

.ag-dia__fila--hecha .ag-dia__pildora {
  opacity: 0.55;
}

/* Casillero chico de la selección múltiple, arriba a la izquierda del círculo. */
.ag-casillero {
  position: absolute;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 1.5px solid #8e8e90;
  border-radius: 5px;
  background: var(--ag-superficie);
  color: #fff;
  font-size: 13px;
}

.ag-casillero--marcado {
  border-color: var(--ag-salmon);
  background: var(--ag-salmon);
}

.ag-dia__casillero {
  top: -6px;
  left: -14px;
}

.ag-dia__contenido {
  min-width: 0;
  padding-top: 3px;
}

.ag-dia__horario {
  color: var(--ag-apagado);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
}

.ag-dia__titulo {
  display: -webkit-box;
  overflow: hidden;
  color: var(--ag-texto);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
  word-break: break-word;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.ag-dia__fila--hecha .ag-dia__titulo {
  color: var(--ag-apagado);
  text-decoration: line-through;
}

.ag-dia__subpasos-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 4px;
  padding: 2px 6px 2px 0;
  border: 0;
  background: transparent;
  color: var(--ag-apagado);
  font-size: 12px;
  cursor: pointer;
}

.ag-dia__subpasos-toggle .bi-check-square-fill {
  font-size: 12px;
}

.ag-dia__subpasos-toggle .bi-chevron-down,
.ag-dia__subpasos-toggle .bi-chevron-up {
  font-size: 10px;
}

.ag-dia__subpasos {
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}

.ag-dia__subpaso {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 5px 0;
  border: 0;
  background: transparent;
  color: var(--ag-texto);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.ag-dia__subpaso--hecho .ag-dia__subpaso-texto {
  color: var(--ag-apagado);
  text-decoration: line-through;
}

/* Casilla cuadrada de los subpasos (la misma que en el panel). */
.ag-check {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-top: 2px;
  border: 1.5px solid #6a6a6c;
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
}

.ag-check--marcado {
  border-color: var(--ag-salmon);
  background: var(--ag-salmon);
}

/* Círculo de hecho: vacío con borde del color de la tarea; al marcar, relleno con tilde. */
.ag-hecho {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 2px solid var(--ag-salmon);
  border-radius: 50%;
  background: transparent;
  font-size: 13px;
  cursor: pointer;
  transition: transform 0.1s ease;
}

.ag-hecho:hover {
  transform: scale(1.12);
}

.ag-dia__hecho {
  position: relative;
  justify-self: center;
}

.ag-dia__fila--hueco {
  cursor: pointer;
}

.ag-dia__fila--hueco:hover .ag-dia__hueco-texto,
.ag-dia__fila--sobre .ag-dia__hueco-texto {
  color: var(--ag-salmon);
}

.ag-dia__fila--sobre {
  background: rgba(248, 142, 135, 0.12);
}

.ag-dia__hueco-texto {
  padding: 8px 0;
  color: var(--ag-apagado);
  font-size: 14px;
  transition: color 0.15s ease;
}

/* ---------- Estado vacío ---------- */
.ag-vacio {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 40px;
  text-align: center;
}

.ag-vacio__ilustracion {
  position: relative;
  width: 280px;
  height: 330px;
}

.ag-vacio__circulos {
  display: flex;
  justify-content: space-between;
  width: 260px;
  margin: 0 auto;
}

.ag-vacio__circulo {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #f6d6d3;
}

.ag-vacio__escena {
  position: relative;
  height: 290px;
}

.ag-vacio__riel {
  position: absolute;
  top: 24px;
  left: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.ag-vacio__pildora {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 60px;
  border-radius: 19px;
  background: #6f8fbf;
  color: #e9f0fb;
  font-size: 18px;
}

.ag-vacio__pildora--inclinada {
  transform: rotate(-18deg) translateX(6px);
}

.ag-vacio__punteado {
  width: 38px;
  height: 60px;
  border: 2.5px dotted #6f8fbf;
  border-radius: 19px;
}

.ag-vacio__lineas {
  position: absolute;
  top: 44px;
  left: 58px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.ag-vacio__barra {
  width: 36px;
  height: 7px;
  border-radius: 4px;
  background: #6f8fbf;
}

.ag-vacio__barra--larga {
  width: 68px;
}

.ag-vacio__tilde {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  margin-left: 42px;
  border-radius: 50%;
  background: #6f8fbf;
  color: #fff;
  font-size: 15px;
}

.ag-vacio__persona {
  position: absolute;
  right: 26px;
  bottom: 0;
  color: #f3c9c4;
  font-size: 170px;
  line-height: 1;
}

.ag-vacio__lapiz {
  position: absolute;
  top: 96px;
  right: 30px;
  color: #f5ebe9;
  font-size: 30px;
  transform: rotate(10deg);
}

.ag-vacio__titulo {
  margin: 28px 0 6px;
  color: var(--ag-texto);
  font-size: 16px;
  font-weight: 600;
}

.ag-vacio__texto {
  margin: 0;
  color: var(--ag-apagado);
  font-size: 14px;
}

/* ---------- Teléfono ---------- */
.ag-dia--telefono {
  padding: 24px 6px 110px;
}

.ag-dia--telefono .ag-dia__fila {
  grid-template-columns: 34px 40px minmax(0, 1fr) 30px;
  column-gap: 10px;
  padding: 13px 8px;
}

.ag-dia--telefono .ag-dia__pildora {
  width: 40px;
  min-height: 40px;
  font-size: 16px;
}

.ag-dia--telefono .ag-dia__titulo {
  font-size: 15px;
}

.ag-dia--telefono .ag-dia__casillero {
  left: -10px;
}

.ag-dia--telefono .ag-vacio__ilustracion {
  transform: scale(0.82);
  transform-origin: top center;
  height: 280px;
}
</style>
