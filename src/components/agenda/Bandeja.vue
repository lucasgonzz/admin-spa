<template>
  <!--
    Bandeja (Inbox de Structured): las tareas sin fecha. Arriba el alta rápida ("Agregá una tarea
    a la bandeja…" + botón), abajo las tarjetas con duración, ícono y título, y un "+" que la
    programa en el día elegido. Las tarjetas se arrastran a un día de la franja, a una hora de la
    grilla o a una celda del mes; y una tarea con fecha soltada acá vuelve a la bandeja.
    En escritorio es una columna fija a la izquierda; en tablet y teléfono, un cajón superpuesto.
  -->
  <aside
    class="ag-bandeja"
    :class="{
      'ag-bandeja--flotante': flotante,
      'ag-bandeja--telefono': es_telefono,
      'ag-bandeja--sobre': sobre,
    }"
    aria-label="Bandeja"
    @dragover.prevent="on_drag_over"
    @dragleave="on_drag_leave"
    @drop.prevent="on_drop"
  >
    <div v-if="flotante" class="ag-bandeja__cabecera">
      <span class="ag-bandeja__titulo">Bandeja</span>
      <button type="button" class="ag-bandeja__cerrar" aria-label="Cerrar la bandeja" @click="$emit('cerrar')">
        <i class="bi bi-x-lg" aria-hidden="true" />
      </button>
    </div>

    <!-- Alta rápida -->
    <form class="ag-bandeja__alta" @submit.prevent="crear">
      <input
        ref="input_alta"
        v-model="titulo_nuevo"
        type="text"
        class="ag-bandeja__input"
        maxlength="500"
        placeholder="Agregá una tarea a la bandeja…"
        aria-label="Nueva tarea para la bandeja"
      />
      <button
        type="submit"
        class="ag-bandeja__agregar"
        :disabled="titulo_nuevo.trim() === '' || creando"
        aria-label="Agregar a la bandeja"
      >
        <i class="bi bi-plus-lg" aria-hidden="true" />
      </button>
    </form>

    <!-- Tarjetas -->
    <div class="ag-bandeja__lista">
      <p v-if="tareas.length === 0" class="ag-bandeja__vacia">
        La bandeja está vacía. Anotá acá lo que querés hacer sin ponerle fecha todavía.
      </p>
      <div
        v-for="tarea in tareas"
        :key="'ag-bandeja-' + tarea.id"
        class="ag-bandeja__tarjeta"
        :class="{
          'ag-bandeja__tarjeta--hecha': tarea.completed,
          'ag-bandeja__tarjeta--seleccionada': esta_seleccionada(tarea),
          'ag-bandeja__tarjeta--arrastrada': id_arrastrado === tarea.id,
        }"
        role="button"
        tabindex="0"
        :draggable="seleccion_activa ? 'false' : 'true'"
        :aria-label="tarea.title + ', ' + duracion_de(tarea)"
        @click="on_click_tarea(tarea)"
        @keydown.enter="on_click_tarea(tarea)"
        @dragstart="on_drag_start(tarea, $event)"
        @dragend="on_drag_end"
      >
        <span
          v-if="seleccion_activa"
          class="ag-casillero ag-bandeja__casillero"
          :class="{ 'ag-casillero--marcado': esta_seleccionada(tarea) }"
          aria-hidden="true"
        >
          <i v-if="esta_seleccionada(tarea)" class="bi bi-check-lg" />
        </span>
        <span class="ag-bandeja__icono" :style="{ color: color_de(tarea) }">
          <i class="bi" :class="'bi-' + (tarea.icon || 'check2-square')" aria-hidden="true" />
        </span>
        <span class="ag-bandeja__textos">
          <span class="ag-bandeja__duracion">{{ duracion_de(tarea) }}</span>
          <span class="ag-bandeja__nombre">{{ tarea.title }}</span>
        </span>
        <button
          v-if="!seleccion_activa"
          type="button"
          class="ag-bandeja__programar"
          :aria-label="'Programar «' + tarea.title + '» en el día elegido'"
          title="Programar en el día elegido"
          @click.stop="$emit('programar', tarea)"
        >
          <i class="bi bi-plus-lg" aria-hidden="true" />
        </button>
      </div>
    </div>
  </aside>
</template>

<script>
import { clave_seleccion, color_hex, texto_duracion } from './agenda_utils'

export default {
  name: 'AgendaBandeja',
  props: {
    /** Tareas de la bandeja (ya filtradas por "mostrar completadas"), ordenadas por la API. */
    tareas: { type: Array, default: function () { return [] } },
    /** true si la selección múltiple está activa. */
    seleccion_activa: { type: Boolean, default: false },
    /** Claves de selección de las tareas elegidas. */
    seleccionadas: { type: Array, default: function () { return [] } },
    /** true mientras se arrastra una tarea (de cualquier lado). */
    arrastrando: { type: Boolean, default: false },
    /** true si es el cajón superpuesto (tablet y teléfono) en vez de la columna fija. */
    flotante: { type: Boolean, default: false },
    /** true en teléfono. */
    es_telefono: { type: Boolean, default: false },
    /** true mientras el orquestador está creando la tarea de la bandeja (evita dobles altas). */
    creando: { type: Boolean, default: false },
  },
  emits: [
    'crear',
    'abrir',
    'programar',
    'alternar-seleccion',
    'iniciar-arrastre',
    'terminar-arrastre',
    'soltar',
    'cerrar',
  ],
  data() {
    return {
      /** Texto del alta rápida. */
      titulo_nuevo: '',
      /** Id de la tarea que se está arrastrando desde la bandeja. */
      id_arrastrado: null,
      /** true si pasa por encima una tarea arrastrada desde otra vista. */
      sobre: false,
    }
  },
  watch: {
    /** Al terminar un arrastre se apagan los resaltados. */
    arrastrando(valor) {
      if (!valor) {
        this.id_arrastrado = null
        this.sobre = false
      }
    },
  },
  methods: {
    /**
     * Alta rápida: avisa el título al orquestador y limpia el campo (el foco queda ahí para
     * seguir anotando).
     *
     * @returns {void}
     */
    crear() {
      const titulo = this.titulo_nuevo.trim()
      if (titulo === '' || this.creando) {
        return
      }
      this.$emit('crear', titulo)
      this.titulo_nuevo = ''
    },
    /**
     * Pone el foco en el alta rápida (lo usa el orquestador al abrir la bandeja vacía).
     *
     * @returns {void}
     */
    enfocar() {
      if (this.$refs.input_alta) {
        this.$refs.input_alta.focus()
      }
    },
    /**
     * Toque sobre una tarjeta: con la selección múltiple la elige; si no, abre el panel.
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
     * Indica si una tarea está elegida en la selección múltiple.
     *
     * @param {Object} tarea
     * @returns {boolean}
     */
    esta_seleccionada(tarea) {
      return this.seleccionadas.indexOf(clave_seleccion(tarea)) !== -1
    },
    /**
     * Hex del color de la tarea (el ícono de la tarjeta va de ese color).
     *
     * @param {Object} tarea
     * @returns {string}
     */
    color_de(tarea) {
      return color_hex(tarea.color)
    },
    /**
     * Duración en palabras ("15 min").
     *
     * @param {Object} tarea
     * @returns {string}
     */
    duracion_de(tarea) {
      return texto_duracion(tarea.duration_minutes || 15)
    },
    /**
     * Empieza a arrastrar una tarjeta.
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
      this.id_arrastrado = tarea.id
      this.$emit('iniciar-arrastre', tarea)
    },
    /**
     * Termina el arrastre.
     *
     * @returns {void}
     */
    on_drag_end() {
      this.id_arrastrado = null
      this.$emit('terminar-arrastre')
    },
    /**
     * Una tarea arrastrada pasa por la bandeja (solo se resalta si viene de afuera).
     *
     * @param {DragEvent} evento
     * @returns {void}
     */
    on_drag_over(evento) {
      if (!this.arrastrando || this.id_arrastrado !== null) {
        return
      }
      if (evento.dataTransfer) {
        evento.dataTransfer.dropEffect = 'move'
      }
      this.sobre = true
    },
    /**
     * La tarea arrastrada sale de la bandeja (ignorando el paso por sus hijos).
     *
     * @param {DragEvent} evento
     * @returns {void}
     */
    on_drag_leave(evento) {
      if (evento.currentTarget && evento.relatedTarget && evento.currentTarget.contains(evento.relatedTarget)) {
        return
      }
      this.sobre = false
    },
    /**
     * Sueltan en la bandeja una tarea con fecha: vuelve a la bandeja.
     *
     * @returns {void}
     */
    on_drop() {
      const venia_de_afuera = this.id_arrastrado === null
      this.sobre = false
      if (!this.arrastrando || !venia_de_afuera) {
        return
      }
      this.$emit('soltar', { tipo: 'bandeja' })
    },
  },
}
</script>

<style scoped>
.ag-bandeja {
  display: flex;
  flex-direction: column;
  gap: 26px;
  flex: 0 0 auto;
  width: var(--ag-ancho-bandeja);
  min-height: 0;
  /* 28 px a la izquierda y 30 de aire hasta la superficie, como en Structured. */
  padding: 16px 30px 0 28px;
  background: var(--ag-negro);
  transition: background 0.15s ease;
}

.ag-bandeja--sobre {
  background: #1a1010;
}

.ag-bandeja__cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ag-bandeja__titulo {
  color: var(--ag-texto);
  font-size: 20px;
  font-weight: 700;
}

.ag-bandeja__cerrar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: var(--ag-segmentado);
  color: var(--ag-texto);
  font-size: 13px;
  cursor: pointer;
}

/* Alta rápida: pastilla con el botón "+" adentro, a la derecha. */
.ag-bandeja__alta {
  display: flex;
  align-items: center;
  height: 50px;
  padding: 0 6px 0 18px;
  border: 1px solid var(--ag-borde);
  border-radius: 25px;
  background: #2a2a2c;
}

.ag-bandeja__input {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  border: 0;
  background: transparent;
  color: var(--ag-texto);
  font-size: 14px;
  outline: none;
}

.ag-bandeja__input::placeholder {
  color: var(--ag-apagado);
}

.ag-bandeja__agregar {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 36px;
  border: 0;
  border-radius: 18px;
  background: #5a3836;
  color: var(--ag-salmon);
  font-size: 16px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.ag-bandeja__agregar:not(:disabled):hover {
  background: var(--ag-salmon);
  color: #fff;
}

.ag-bandeja__agregar:disabled {
  cursor: default;
  opacity: 0.75;
}

.ag-bandeja__lista {
  display: flex;
  flex-direction: column;
  gap: 15px;
  min-height: 0;
  margin-left: -6px;
  padding: 6px 2px 120px 6px;
  overflow-y: auto;
  scrollbar-width: thin;
}

.ag-bandeja__vacia {
  margin: 0;
  padding: 0 6px;
  color: var(--ag-apagado);
  font-size: 13px;
  line-height: 1.5;
}

.ag-bandeja__tarjeta {
  position: relative;
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 12px;
  height: 56px;
  padding: 0 12px 0 14px;
  border-radius: 14px;
  background: var(--ag-fondo);
  cursor: pointer;
  outline: none;
  transition: background 0.15s ease;
}

.ag-bandeja__tarjeta:hover,
.ag-bandeja__tarjeta:focus-visible {
  background: var(--ag-elevado);
}

.ag-bandeja__tarjeta--seleccionada {
  background: var(--ag-elevado);
  box-shadow: inset 0 0 0 1px #5a5a5c;
}

.ag-bandeja__tarjeta--arrastrada {
  opacity: 0.4;
}

.ag-bandeja__icono {
  flex: 0 0 auto;
  width: 22px;
  font-size: 20px;
  text-align: center;
}

.ag-bandeja__textos {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

.ag-bandeja__duracion {
  color: var(--ag-apagado);
  font-size: 12px;
  line-height: 1.3;
}

.ag-bandeja__nombre {
  overflow: hidden;
  color: var(--ag-texto);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ag-bandeja__tarjeta--hecha .ag-bandeja__nombre {
  color: var(--ag-apagado);
  text-decoration: line-through;
}

.ag-bandeja__programar {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--ag-salmon);
  font-size: 16px;
  cursor: pointer;
}

.ag-bandeja__programar:hover {
  background: rgba(248, 142, 135, 0.15);
}

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

.ag-bandeja__casillero {
  top: -6px;
  left: -6px;
}

/* Cajón superpuesto (tablet y teléfono): sobre la agenda, con sombra. */
.ag-bandeja--flotante {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 30;
  width: min(340px, 88%);
  gap: 18px;
  padding: 16px 16px 0 20px;
  box-shadow: 12px 0 40px rgba(0, 0, 0, 0.6);
}

.ag-bandeja--flotante .ag-bandeja__lista {
  padding-bottom: 24px;
}
</style>
