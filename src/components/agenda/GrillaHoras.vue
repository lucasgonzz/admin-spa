<template>
  <!--
    Grilla horaria compartida por Semana (7 columnas, solo círculos con ícono) y Varios días
    (4 columnas en escritorio, 2 en teléfono, círculo + horario + título).

    Como en Structured, las horas son ELÁSTICAS: una hora vacía mide poco y una hora con varias
    tareas apiladas crece lo necesario para que los círculos no se pisen (por eso "10" y "11"
    quedan más separadas que "11" y "12" cuando a las 10 hay cuatro tareas). La hora que cae bajo
    el puntero se calcula con esas mismas medidas y se redondea a 15 min: es lo que usan el clic
    en un lugar vacío (tarea nueva a esa hora) y el drag & drop (mover a otra columna y hora).
  -->
  <div
    class="ag-grilla"
    :class="['ag-grilla--' + modo, { 'ag-grilla--telefono': es_telefono }]"
    :style="{ '--ag-circulo': circulo + 'px' }"
  >
    <!-- Franja de "todo el día", arriba de la línea -->
    <div class="ag-grilla__todo-el-dia">
      <div class="ag-grilla__canaleta-rotulo">
        <span v-if="hay_todo_el_dia">Todo el día</span>
      </div>
      <div
        v-for="dia in dias"
        :key="'ag-gr-te-' + dia"
        class="ag-grilla__te-celda"
        :class="{ 'ag-grilla__te-celda--sobre': te_sobre === dia }"
        @dragover.prevent="on_drag_over_te(dia, $event)"
        @dragleave="on_drag_leave_te(dia)"
        @drop.prevent="on_drop_te(dia)"
      >
        <div
          v-for="tarea in todo_el_dia_de(dia)"
          :key="'ag-gr-te-t-' + clave_de(tarea)"
          class="ag-grilla__te-tarea"
          :class="{
            'ag-grilla__tarea--hecha': tarea.completed,
            'ag-grilla__tarea--seleccionada': esta_seleccionada(tarea),
          }"
          role="button"
          tabindex="0"
          :title="tarea.title"
          :draggable="seleccion_activa ? 'false' : 'true'"
          @click.stop="on_click_tarea(tarea)"
          @keydown.enter="on_click_tarea(tarea)"
          @dragstart="on_drag_start(tarea, $event)"
          @dragend="on_drag_end"
        >
          <span class="ag-grilla__te-circulo" :style="estilo_circulo(tarea)">
            <i class="bi" :class="'bi-' + (tarea.icon || 'check2-square')" aria-hidden="true" />
          </span>
          <span v-if="modo === 'varios'" class="ag-grilla__te-titulo">{{ tarea.title }}</span>
          <span
            v-if="seleccion_activa"
            class="ag-casillero ag-grilla__casillero"
            :class="{ 'ag-casillero--marcado': esta_seleccionada(tarea) }"
            aria-hidden="true"
          >
            <i v-if="esta_seleccionada(tarea)" class="bi bi-check-lg" />
          </span>
        </div>
      </div>
    </div>

    <!-- Cuerpo: rótulos de hora a la izquierda y columnas por día -->
    <div ref="cuerpo" class="ag-grilla__cuerpo" :style="{ height: disposicion.alto_total + 'px' }">
      <div
        v-for="fila in disposicion.filas"
        :key="'ag-gr-h-' + fila.hora"
        class="ag-grilla__hora"
        :style="{ top: fila.top + 'px' }"
      >
        {{ fila.rotulo }}
      </div>

      <div class="ag-grilla__columnas">
        <div
          v-for="(dia, indice) in dias"
          :key="'ag-gr-c-' + dia"
          class="ag-grilla__columna"
          :class="{ 'ag-grilla__columna--elegida': dia === fecha_elegida && modo === 'semana' }"
          @click="on_click_columna(dia, $event)"
          @dragover.prevent="on_drag_over_columna(dia, $event)"
          @dragleave="on_drag_leave_columna(dia, $event)"
          @drop.prevent="on_drop_columna(dia, $event)"
        >
          <!-- Líneas que unen tareas seguidas de la misma columna -->
          <span
            v-for="union in disposicion.uniones[indice]"
            :key="'ag-gr-u-' + union.clave"
            class="ag-grilla__union"
            :style="{ top: union.top + 'px', height: union.alto + 'px', backgroundColor: union.color }"
          />

          <!-- Tareas con horario -->
          <div
            v-for="item in disposicion.items[indice]"
            :key="'ag-gr-t-' + item.clave"
            class="ag-grilla__tarea"
            :class="{
              'ag-grilla__tarea--hecha': item.tarea.completed,
              'ag-grilla__tarea--seleccionada': item.seleccionada,
              'ag-grilla__tarea--arrastrada': clave_arrastrada === item.clave,
            }"
            :style="{ top: item.top + 'px' }"
            role="button"
            tabindex="0"
            :title="item.tarea.title + ' · ' + item.horario"
            :aria-label="item.tarea.title + ', ' + item.horario"
            :draggable="seleccion_activa ? 'false' : 'true'"
            @click.stop="on_click_tarea(item.tarea)"
            @keydown.enter="on_click_tarea(item.tarea)"
            @dragstart="on_drag_start(item.tarea, $event)"
            @dragend="on_drag_end"
          >
            <span class="ag-grilla__circulo" :style="Object.assign({ height: item.alto + 'px' }, estilo_circulo(item.tarea))">
              <i class="bi" :class="'bi-' + (item.tarea.icon || 'check2-square')" aria-hidden="true" />
              <i v-if="item.tarea.completed" class="bi bi-check-circle-fill ag-grilla__tilde" aria-hidden="true" />
            </span>
            <span v-if="modo === 'varios'" class="ag-grilla__texto">
              <span class="ag-grilla__horario">{{ item.horario }}</span>
              <span class="ag-grilla__titulo">{{ item.tarea.title }}</span>
            </span>
            <span
              v-if="seleccion_activa"
              class="ag-casillero ag-grilla__casillero"
              :class="{ 'ag-casillero--marcado': item.seleccionada }"
              aria-hidden="true"
            >
              <i v-if="item.seleccionada" class="bi bi-check-lg" />
            </span>
          </div>

          <!-- Indicador de a qué hora cae la tarea arrastrada -->
          <div v-if="indicador && indicador.fecha === dia" class="ag-grilla__indicador" :style="{ top: indicador.top + 'px' }">
            <span class="ag-grilla__indicador-hora">{{ indicador.hora }}</span>
          </div>
        </div>
      </div>
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
  MINUTOS_DIA,
} from './agenda_utils'

/** Alto de una hora sin tareas, en px. */
const ALTO_HORA_BASE = 48

/** Separación vertical entre dos círculos apilados, en px. */
const SEPARACION = 10

/** Si entre el fin de una tarea y el inicio de la siguiente hay hasta estos minutos, se unen con línea. */
const UNIR_HASTA_MINUTOS = 30

/** Hora a la que se lleva la vista si el día no tiene tareas. */
const HORA_POR_DEFECTO = 8

export default {
  name: 'AgendaGrillaHoras',
  props: {
    /** 'semana' (solo círculos) | 'varios' (círculo + horario + título). */
    modo: { type: String, required: true },
    /** Fechas de las columnas (`YYYY-MM-DD`). */
    dias: { type: Array, required: true },
    /** Ocurrencias visibles por fecha. */
    ocurrencias_por_dia: { type: Object, default: function () { return {} } },
    /** Día elegido (se destaca su columna en Semana). */
    fecha_elegida: { type: String, required: true },
    /** true si la selección múltiple está activa. */
    seleccion_activa: { type: Boolean, default: false },
    /** Claves de selección de las tareas elegidas. */
    seleccionadas: { type: Array, default: function () { return [] } },
    /** true mientras se arrastra una tarea. */
    arrastrando: { type: Boolean, default: false },
    /** true en teléfono (círculos más chicos). */
    es_telefono: { type: Boolean, default: false },
  },
  emits: [
    'abrir',
    'alternar-seleccion',
    'nueva-en',
    'iniciar-arrastre',
    'terminar-arrastre',
    'soltar',
  ],
  data() {
    return {
      /** Clave de la tarea que se está arrastrando desde esta grilla. */
      clave_arrastrada: null,
      /** `{ fecha, top, hora }` del lugar donde caería la tarea arrastrada (null si no hay). */
      indicador: null,
      /** Día de la franja "todo el día" sobre el que pasa una tarea arrastrada. */
      te_sobre: null,
      /** true cuando ya se llevó el scroll a la primera tarea de este rango (no se repite en cada refresco). */
      ya_desplazo_con_datos: false,
    }
  },
  computed: {
    /**
     * Diámetro del círculo de una tarea, en px.
     *
     * @returns {number}
     */
    circulo() {
      if (this.es_telefono) {
        return this.modo === 'semana' ? 30 : 40
      }
      return 46
    },
    /**
     * Ocurrencias con horario por columna, ordenadas por hora.
     *
     * @returns {Array<Object[]>}
     */
    con_horario_por_columna() {
      const self = this
      return self.dias.map(function (dia) {
        return (self.ocurrencias_por_dia[dia] || []).filter(function (tarea) {
          return inicio_de(tarea) !== null
        })
      })
    },
    /**
     * true si alguna columna tiene tareas de todo el día (para el rótulo de la canaleta).
     *
     * @returns {boolean}
     */
    hay_todo_el_dia() {
      const self = this
      return self.dias.some(function (dia) {
        return self.todo_el_dia_de(dia).length > 0
      })
    },
    /**
     * Medidas de la grilla: alto y posición de cada hora, posición de cada tarea y de cada línea
     * de unión, y el alto total.
     *
     * @returns {{filas: Object[], items: Object[][], uniones: Object[][], alto_total: number}}
     */
    disposicion() {
      const self = this
      const paso = self.circulo + SEPARACION
      /* 1) Alto de cada hora: lo que pida la columna con más tareas arrancando en esa hora. */
      const altos = []
      for (let hora = 0; hora < 24; hora++) {
        let maximo = 0
        self.con_horario_por_columna.forEach(function (tareas) {
          let cantidad = 0
          tareas.forEach(function (tarea) {
            const inicio = inicio_de(tarea)
            if (inicio >= hora * 60 && inicio < hora * 60 + 60) {
              cantidad = cantidad + 1
            }
          })
          maximo = Math.max(maximo, cantidad)
        })
        altos.push(Math.max(ALTO_HORA_BASE, maximo * paso + (maximo > 0 ? SEPARACION : 0)))
      }
      const filas = []
      let acumulado = 8
      for (let hora = 0; hora < 24; hora++) {
        filas.push({ hora: hora, top: acumulado, alto: altos[hora], rotulo: hora + ':00' })
        acumulado = acumulado + altos[hora]
      }
      const y_de = function (minutos) {
        return self.y_de_minutos(filas, minutos)
      }

      /* 2) Posición de cada tarea: a su hora, o justo debajo de la anterior si se pisarían. */
      const items = []
      const uniones = []
      self.con_horario_por_columna.forEach(function (tareas) {
        const items_columna = []
        const uniones_columna = []
        let fondo_anterior = -Infinity
        let anterior = null
        tareas.forEach(function (tarea) {
          const inicio = inicio_de(tarea)
          const fin = Math.min(fin_de(tarea), MINUTOS_DIA)
          const top = Math.max(y_de(inicio), fondo_anterior + SEPARACION)
          const alto = Math.max(self.circulo, Math.round(y_de(fin) - y_de(inicio)))
          const item = {
            clave: clave_ocurrencia(tarea),
            tarea: tarea,
            top: Math.round(top),
            alto: alto,
            horario: texto_horario(tarea),
            seleccionada: self.esta_seleccionada(tarea),
          }
          if (anterior && inicio - anterior.fin <= UNIR_HASTA_MINUTOS) {
            uniones_columna.push({
              clave: anterior.item.clave + '>' + item.clave,
              top: anterior.item.top + anterior.item.alto,
              alto: Math.max(0, item.top - (anterior.item.top + anterior.item.alto)),
              color: color_hex(anterior.item.tarea.color),
            })
          }
          items_columna.push(item)
          fondo_anterior = top + alto
          anterior = { item: item, fin: fin_de(tarea) }
        })
        items.push(items_columna)
        uniones.push(uniones_columna)
      })
      const ultimo_fondo = items.reduce(function (maximo, columna) {
        return columna.reduce(function (m, item) {
          return Math.max(m, item.top + item.alto)
        }, maximo)
      }, 0)
      return {
        filas: filas,
        items: items,
        uniones: uniones,
        alto_total: Math.max(acumulado, ultimo_fondo) + 24,
      }
    },
    /**
     * Las fechas de las columnas como un solo texto (lo que se vigila para el scroll).
     *
     * @returns {string}
     */
    clave_dias() {
      return this.dias.join(',')
    },
    /**
     * Primera hora con tareas en todo el rango (o la hora por defecto), para llevar el scroll ahí.
     *
     * @returns {number}
     */
    primera_hora() {
      let primera = null
      this.con_horario_por_columna.forEach(function (tareas) {
        tareas.forEach(function (tarea) {
          const hora = Math.floor(inicio_de(tarea) / 60)
          primera = primera === null ? hora : Math.min(primera, hora)
        })
      })
      return primera
    },
  },
  watch: {
    /**
     * Al cambiar el rango de días se vuelve a llevar el scroll a la primera tarea. Se vigila el
     * texto y no el array: el orquestador arma un array nuevo cada vez que cambia el día elegido,
     * aunque sea de la misma semana, y eso no tiene que mover el scroll.
     */
    clave_dias() {
      this.ya_desplazo_con_datos = false
      this.desplazar_a_primera_hora()
    },
    /** Cuando llegan los datos del rango, una sola vez, el scroll va a la primera tarea. */
    primera_hora(valor) {
      if (valor !== null && !this.ya_desplazo_con_datos) {
        this.desplazar_a_primera_hora()
      }
    },
    /** Al terminar un arrastre se apagan los indicadores. */
    arrastrando(valor) {
      if (!valor) {
        this.clave_arrastrada = null
        this.indicador = null
        this.te_sobre = null
      }
    },
  },
  mounted() {
    this.desplazar_a_primera_hora()
  },
  methods: {
    /**
     * Posición vertical (px, dentro del cuerpo) de un momento del día.
     *
     * @param {Object[]} filas Filas de hora con `top` y `alto`.
     * @param {number} minutos Minutos desde la medianoche.
     * @returns {number}
     */
    y_de_minutos(filas, minutos) {
      if (minutos >= MINUTOS_DIA) {
        const ultima = filas[filas.length - 1]
        return ultima.top + ultima.alto
      }
      const hora = Math.max(0, Math.min(23, Math.floor(minutos / 60)))
      const fila = filas[hora]
      return fila.top + ((minutos - hora * 60) / 60) * fila.alto
    },
    /**
     * Momento del día (minutos, redondeado HACIA ABAJO al cuarto de hora) de una posición vertical.
     *
     * @param {number} y Px dentro del cuerpo.
     * @returns {number}
     */
    minutos_de_y(y) {
      const filas = this.disposicion.filas
      let minutos = 0
      if (y >= filas[23].top + filas[23].alto) {
        return MINUTOS_DIA - 15
      }
      filas.forEach(function (fila) {
        if (y >= fila.top && y < fila.top + fila.alto) {
          minutos = fila.hora * 60 + ((y - fila.top) / fila.alto) * 60
        }
      })
      return Math.max(0, Math.min(MINUTOS_DIA - 15, Math.floor(minutos / 15) * 15))
    },
    /**
     * Lleva el scroll de la superficie a media hora antes de la primera tarea (o a las 8).
     *
     * @returns {void}
     */
    desplazar_a_primera_hora() {
      const self = this
      self.$nextTick(function () {
        if (!self.$refs.cuerpo) {
          return
        }
        /* Se busca desde la ref del cuerpo y no desde $el: con el comentario de la raíz, en
           desarrollo $el es un nodo de texto del fragmento y no tiene closest(). */
        const contenedor = self.$refs.cuerpo.closest('[data-ag-scroll]')
        if (!contenedor) {
          return
        }
        const hora = self.primera_hora === null ? HORA_POR_DEFECTO : Math.min(self.primera_hora, HORA_POR_DEFECTO + 4)
        if (self.primera_hora !== null) {
          self.ya_desplazo_con_datos = true
        }
        const fila = self.disposicion.filas[Math.max(0, hora)]
        const desplazamiento_cuerpo = self.$refs.cuerpo.offsetTop
        contenedor.scrollTop = Math.max(0, desplazamiento_cuerpo + fila.top - 24)
      })
    },
    /**
     * Tareas de todo el día de una columna.
     *
     * @param {string} dia
     * @returns {Object[]}
     */
    todo_el_dia_de(dia) {
      return (this.ocurrencias_por_dia[dia] || []).filter(function (tarea) {
        return inicio_de(tarea) === null
      })
    },
    /**
     * Clave de ocurrencia (para los `:key`).
     *
     * @param {Object} tarea
     * @returns {string}
     */
    clave_de(tarea) {
      return clave_ocurrencia(tarea)
    },
    /**
     * Indica si una tarea está elegida en la selección múltiple.
     *
     * @param {Object} tarea
     * @returns {boolean}
     */
    esta_seleccionada(tarea) {
      return this.seleccionadas.indexOf(clave_seleccion(tarea)) !== -1
    },
    /**
     * Colores del círculo de una tarea (fondo del color, ícono blanco u oscuro según el fondo).
     *
     * @param {Object} tarea
     * @returns {Object}
     */
    estilo_circulo(tarea) {
      const color = color_hex(tarea.color)
      return { backgroundColor: color, color: es_color_claro(color) ? '#1c1c1e' : '#ffffff' }
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
     * Clic en un lugar vacío de una columna: tarea nueva en ese día a esa hora (redondeada a 15 min).
     *
     * @param {string} dia
     * @param {MouseEvent} evento
     * @returns {void}
     */
    on_click_columna(dia, evento) {
      if (this.seleccion_activa) {
        return
      }
      const y = evento.clientY - evento.currentTarget.getBoundingClientRect().top
      this.$emit('nueva-en', { fecha: dia, hora: hora_de_minutos(this.minutos_de_y(y)) })
    },
    /**
     * Empieza a arrastrar una tarea.
     *
     * @param {Object} tarea
     * @param {DragEvent} evento
     * @returns {void}
     */
    on_drag_start(tarea, evento) {
      if (this.seleccion_activa) {
        evento.preventDefault()
        return
      }
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
      this.indicador = null
      this.$emit('terminar-arrastre')
    },
    /**
     * Una tarea arrastrada pasa por una columna: se calcula la hora (snap de 15 min) y se dibuja
     * el indicador.
     *
     * @param {string} dia
     * @param {DragEvent} evento
     * @returns {void}
     */
    on_drag_over_columna(dia, evento) {
      if (!this.arrastrando) {
        return
      }
      if (evento.dataTransfer) {
        evento.dataTransfer.dropEffect = 'move'
      }
      const y = evento.clientY - evento.currentTarget.getBoundingClientRect().top
      const minutos = this.minutos_de_y(y)
      const top = Math.round(this.y_de_minutos(this.disposicion.filas, minutos))
      if (!this.indicador || this.indicador.fecha !== dia || this.indicador.top !== top) {
        this.indicador = { fecha: dia, top: top, hora: hora_de_minutos(minutos) }
      }
    },
    /**
     * La tarea arrastrada sale de la columna (los hijos también disparan dragleave: se ignora
     * si el puntero sigue adentro).
     *
     * @param {string} dia
     * @param {DragEvent} evento
     * @returns {void}
     */
    on_drag_leave_columna(dia, evento) {
      if (evento.currentTarget && evento.relatedTarget && evento.currentTarget.contains(evento.relatedTarget)) {
        return
      }
      if (this.indicador && this.indicador.fecha === dia) {
        this.indicador = null
      }
    },
    /**
     * Sueltan una tarea en una columna: va a ese día y a esa hora.
     *
     * @param {string} dia
     * @param {DragEvent} evento
     * @returns {void}
     */
    on_drop_columna(dia, evento) {
      const y = evento.clientY - evento.currentTarget.getBoundingClientRect().top
      const hora = hora_de_minutos(this.minutos_de_y(y))
      this.indicador = null
      if (!this.arrastrando) {
        return
      }
      this.$emit('soltar', { tipo: 'hora', fecha: dia, hora: hora })
    },
    /**
     * Una tarea arrastrada pasa por la franja de todo el día.
     *
     * @param {string} dia
     * @param {DragEvent} evento
     * @returns {void}
     */
    on_drag_over_te(dia, evento) {
      if (!this.arrastrando) {
        return
      }
      if (evento.dataTransfer) {
        evento.dataTransfer.dropEffect = 'move'
      }
      this.te_sobre = dia
    },
    /**
     * La tarea arrastrada sale de la franja de todo el día.
     *
     * @param {string} dia
     * @returns {void}
     */
    on_drag_leave_te(dia) {
      if (this.te_sobre === dia) {
        this.te_sobre = null
      }
    },
    /**
     * Sueltan una tarea en la franja de todo el día: pasa a ser de todo el día en esa fecha.
     *
     * @param {string} dia
     * @returns {void}
     */
    on_drop_te(dia) {
      this.te_sobre = null
      if (!this.arrastrando) {
        return
      }
      this.$emit('soltar', { tipo: 'todo_el_dia', fecha: dia })
    },
  },
}
</script>

<style scoped>
.ag-grilla {
  --ag-circulo: 46px;
  position: relative;
  min-height: 100%;
  padding-bottom: 96px;
}

/* Franja de todo el día: el espacio vacío arriba de la línea en las capturas de Structured. */
.ag-grilla__todo-el-dia {
  display: grid;
  grid-auto-flow: column;
  grid-template-columns: var(--ag-canaleta);
  grid-auto-columns: minmax(0, 1fr);
  min-height: 66px;
  border-bottom: 1px solid #48484a;
}

.ag-grilla__canaleta-rotulo {
  display: flex;
  align-items: flex-end;
  padding: 0 0 8px 8px;
  color: var(--ag-apagado);
  font-size: 10px;
  line-height: 1.1;
}

.ag-grilla__te-celda {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 10px 6px;
  transition: background 0.15s ease;
}

.ag-grilla__te-celda--sobre {
  background: rgba(248, 142, 135, 0.14);
}

.ag-grilla--semana .ag-grilla__te-celda {
  flex-flow: row wrap;
  justify-content: center;
}

.ag-grilla__te-tarea {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  cursor: pointer;
}

.ag-grilla__te-circulo {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  font-size: 12px;
}

.ag-grilla__te-titulo {
  overflow: hidden;
  color: var(--ag-texto);
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-grilla__cuerpo {
  position: relative;
}

.ag-grilla__hora {
  position: absolute;
  left: 8px;
  color: var(--ag-apagado);
  font-size: 10px;
  line-height: 1;
  transform: translateY(-50%);
  pointer-events: none;
}

.ag-grilla__columnas {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: var(--ag-canaleta);
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
}

.ag-grilla__columna {
  position: relative;
  min-width: 0;
  cursor: copy;
}

.ag-grilla__columna:hover {
  background: rgba(255, 255, 255, 0.015);
}

.ag-grilla__columna--elegida {
  background: rgba(255, 255, 255, 0.025);
}

.ag-grilla__union {
  position: absolute;
  left: calc(50% - 1.5px);
  width: 3px;
}

.ag-grilla--varios .ag-grilla__union {
  left: calc(8px + var(--ag-circulo) / 2 - 1.5px);
}

.ag-grilla__tarea {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  cursor: pointer;
  outline: none;
}

.ag-grilla--varios .ag-grilla__tarea {
  justify-content: flex-start;
  align-items: flex-start;
  gap: 14px;
  padding: 0 8px;
}

.ag-grilla__tarea--arrastrada {
  opacity: 0.35;
}

.ag-grilla__circulo {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: var(--ag-circulo);
  min-height: var(--ag-circulo);
  border-radius: calc(var(--ag-circulo) / 2);
  font-size: 18px;
  transition: box-shadow 0.15s ease, transform 0.1s ease;
}

.ag-grilla__tarea:hover .ag-grilla__circulo,
.ag-grilla__tarea:focus-visible .ag-grilla__circulo {
  transform: scale(1.05);
}

.ag-grilla__tarea--seleccionada .ag-grilla__circulo,
.ag-grilla__tarea--seleccionada .ag-grilla__te-circulo {
  box-shadow: 0 0 0 3px var(--ag-superficie), 0 0 0 5px rgba(255, 255, 255, 0.7);
}

.ag-grilla__tarea--hecha .ag-grilla__circulo,
.ag-grilla__tarea--hecha .ag-grilla__te-circulo {
  opacity: 0.5;
}

.ag-grilla__tilde {
  position: absolute;
  right: -4px;
  bottom: -2px;
  color: #fff;
  font-size: 13px;
}

.ag-grilla__texto {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding-top: 4px;
}

.ag-grilla__horario {
  overflow: hidden;
  color: var(--ag-apagado);
  font-size: 12px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-grilla__titulo {
  overflow: hidden;
  color: var(--ag-texto);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-grilla__tarea--hecha .ag-grilla__titulo,
.ag-grilla__tarea--hecha .ag-grilla__te-titulo {
  color: var(--ag-apagado);
  text-decoration: line-through;
}

.ag-casillero {
  position: absolute;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 1.5px solid #8e8e90;
  border-radius: 5px;
  background: var(--ag-superficie);
  color: #fff;
  font-size: 12px;
}

.ag-casillero--marcado {
  border-color: var(--ag-salmon);
  background: var(--ag-salmon);
}

.ag-grilla__casillero {
  top: -6px;
  left: calc(50% - var(--ag-circulo) / 2 - 10px);
}

.ag-grilla--varios .ag-grilla__casillero {
  left: 0;
}

.ag-grilla__te-tarea .ag-grilla__casillero {
  top: -6px;
  left: -6px;
}

/* Indicador del arrastre: línea salmón con la hora a la que caería la tarea. */
.ag-grilla__indicador {
  position: absolute;
  left: 4px;
  right: 4px;
  z-index: 5;
  height: 2px;
  background: var(--ag-salmon);
  pointer-events: none;
}

.ag-grilla__indicador-hora {
  position: absolute;
  top: -9px;
  left: 0;
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--ag-salmon);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
}

/* Teléfono: los íconos acompañan el círculo más chico. */
.ag-grilla--telefono .ag-grilla__circulo {
  font-size: 14px;
}

.ag-grilla--telefono.ag-grilla--varios .ag-grilla__tarea {
  gap: 8px;
  padding: 0 4px;
}

.ag-grilla--telefono .ag-grilla__hora {
  left: 4px;
  font-size: 9px;
}
</style>
