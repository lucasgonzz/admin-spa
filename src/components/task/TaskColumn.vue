<template>
  <!--
    Lista de tareas draggables (ocupa el ancho completo del contenedor padre).
    Muestra un header con el título y cantidad, y una grilla de TaskCard (3 por
    fila en desktop, 2 en tablet, 1 en mobile).
    Gestiona el drag & drop interno usando HTML5 nativo y emite 'reorder' con
    los IDs en el nuevo orden cuando el usuario suelta una tarjeta.
    Si `collapsible` es true, el encabezado es clickeable y el contenido solo
    se muestra cuando `collapsed` es false (estado controlado por el padre).
  -->
  <div class="task-column">

    <!-- Encabezado: clickeable solo si la lista es colapsable -->
    <div
      class="task-column__header d-flex align-items-center justify-content-between mb-3 px-1"
      :class="{ 'task-column__header--clickable': collapsible }"
      @click="collapsible ? $emit('toggle') : null"
    >
      <div class="d-flex align-items-center gap-2">
        <!-- Punto de color identificador de la lista -->
        <span class="task-column__dot" :class="header_dot_class" />
        <h6 class="mb-0 fw-semibold">{{ title }}</h6>
        <!-- El contador queda visible incluso colapsada, para saber cuántas hay sin desplegar -->
        <span class="badge rounded-pill bg-secondary">{{ tasks.length }}</span>
        <!-- Leyenda discreta cuando el drag & drop está deshabilitado por un filtro activo -->
        <span
          v-if="!draggable_enabled && disabled_hint"
          class="text-muted small fst-italic"
        >
          {{ disabled_hint }}
        </span>
      </div>
      <!-- Chevron indicador de estado de colapso -->
      <i
        v-if="collapsible"
        class="bi text-muted"
        :class="collapsed ? 'bi-chevron-right' : 'bi-chevron-down'"
      />
    </div>

    <!-- Contenido: grilla de tarjetas. Solo se renderiza si no está colapsada. -->
    <div
      v-if="!collapsible || !collapsed"
      class="task-column__grid"
      @dragover.prevent
    >
      <task-card
        v-for="task in tasks"
        :key="task.id"
        :task="task"
        :is_dragging="dragging_id === task.id"
        :is_drag_over="drag_over_id === task.id"
        :draggable_enabled="draggable_enabled"
        @dragstart="on_drag_start(task, $event)"
        @dragend="on_drag_end"
        @dragover="on_drag_over(task, $event)"
        @drop="on_drop(task)"
        @edit="$emit('edit', task)"
        @delete="$emit('delete', task)"
        @toggle-done="$emit('toggle-done', task)"
        @update-todos="$emit('update-todos', $event)"
      />

      <!-- Mensaje cuando la lista está vacía -->
      <div v-if="tasks.length === 0" class="task-column__empty text-muted text-center py-4 small">
        {{ empty_message }}
      </div>
    </div>

  </div>
</template>

<script>
import TaskCard from './TaskCard.vue'

/**
 * Columna de tareas con soporte para drag & drop nativo (HTML5).
 * El reordenamiento se realiza solo dentro de la misma columna.
 * Al soltar una tarjeta emite 'reorder' con el array de IDs en el nuevo orden.
 */
export default {
  name: 'TaskColumn',

  components: { TaskCard },

  props: {
    /**
     * Título visible de la columna (ej: "Pendientes", "Realizadas").
     */
    title: {
      type: String,
      required: true,
    },
    /**
     * Array de tareas a mostrar en esta columna.
     */
    tasks: {
      type: Array,
      default: function () { return [] },
    },
    /**
     * Clase CSS para el punto de color del header (ej: 'bg-primary', 'bg-success').
     */
    header_dot_class: {
      type: String,
      default: 'bg-secondary',
    },
    /**
     * Mensaje cuando no hay tareas en la columna.
     */
    empty_message: {
      type: String,
      default: 'No hay tareas.',
    },
    /**
     * Si es true, el encabezado se vuelve clickeable para desplegar/colapsar
     * la lista (usado para la lista de "Realizadas").
     */
    collapsible: {
      type: Boolean,
      default: false,
    },
    /**
     * Estado de colapso actual, controlado por el componente padre.
     * Solo tiene efecto visual si `collapsible` es true.
     */
    collapsed: {
      type: Boolean,
      default: false,
    },
    /**
     * Si es false, deshabilita el drag & drop en esta columna (usado cuando hay
     * un filtro de responsable activo, para no corromper el orden global de las
     * tareas que quedan fuera del subconjunto filtrado).
     */
    draggable_enabled: {
      type: Boolean,
      default: true,
    },
    /**
     * Leyenda discreta a mostrar en el header cuando `draggable_enabled` es false
     * (ej. "Para reordenar, volvé a 'Todos'"). Se pasa solo desde la columna de
     * Pendientes; si viene vacío, no se muestra nada.
     */
    disabled_hint: {
      type: String,
      default: '',
    },
  },

  emits: ['edit', 'delete', 'toggle-done', 'update-todos', 'reorder', 'toggle'],

  data() {
    return {
      /**
       * ID de la tarea que está siendo arrastrada actualmente.
       */
      dragging_id: null,
      /**
       * ID de la tarea sobre la que está pasando el cursor mientras se arrastra.
       */
      drag_over_id: null,
    }
  },

  methods: {
    /**
     * Registra qué tarea empieza a arrastrarse.
     * Almacena el ID en el evento dataTransfer para compatibilidad cross-component.
     *
     * @param {Object} task   Tarea que inicia el drag.
     * @param {DragEvent} event
     */
    on_drag_start(task, event) {
      // Con un filtro activo el drag & drop está deshabilitado: ignorar el inicio.
      if (!this.draggable_enabled) {
        return
      }
      this.dragging_id = task.id
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', String(task.id))
    },

    /**
     * Limpia los estados de drag al terminar (soltar o cancelar).
     */
    on_drag_end() {
      this.dragging_id = null
      this.drag_over_id = null
    },

    /**
     * Actualiza el indicador visual de dónde se soltará la tarjeta.
     *
     * @param {Object}   over_task  Tarea sobre la que pasa el cursor.
     * @param {DragEvent} event
     */
    on_drag_over(over_task, event) {
      if (!this.draggable_enabled) {
        return
      }
      event.preventDefault()
      if (this.dragging_id !== over_task.id) {
        this.drag_over_id = over_task.id
      }
    },

    /**
     * Calcula el nuevo orden tras soltar la tarjeta arrastrada sobre `target_task`.
     * Emite 'reorder' con el array de IDs en el nuevo orden para que el padre
     * lo persista en el backend.
     *
     * @param {Object} target_task  Tarea donde se soltó la arrastrada.
     */
    on_drop(target_task) {
      // Con un filtro activo el drag & drop está deshabilitado: no procesar el drop.
      if (!this.draggable_enabled) {
        return
      }
      const source_id = this.dragging_id
      this.dragging_id = null
      this.drag_over_id = null

      // Si se suelta sobre sí misma, no hay cambio.
      if (!source_id || source_id === target_task.id) {
        return
      }

      // Construir nuevo orden: mover la tarea source antes de la target.
      const ids = this.tasks.map(function (t) { return t.id })
      const from_idx = ids.indexOf(source_id)
      const to_idx = ids.indexOf(target_task.id)

      if (from_idx === -1 || to_idx === -1) {
        return
      }

      // Quitar la tarea de su posición original e insertarla en la nueva posición.
      ids.splice(from_idx, 1)
      ids.splice(to_idx, 0, source_id)

      this.$emit('reorder', ids)
    },
  },
}
</script>

<style scoped>
/* Punto de color en el header. */
.task-column__dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

/* Separador sutil bajo el encabezado. */
.task-column__header {
  border-bottom: 2px solid #e9ecef;
  padding-bottom: 0.5rem;
}

/* Encabezado clickeable (lista colapsable, ej. "Realizadas"). */
.task-column__header--clickable {
  cursor: pointer;
  user-select: none;
}

/* Grilla de tarjetas: 3 columnas en desktop, con caída responsive. */
.task-column__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

/* Tablet: 2 columnas. */
@media (max-width: 1199px) {
  .task-column__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* Mobile: 1 columna. */
@media (max-width: 767px) {
  .task-column__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* Mensaje vacío centrado, ocupando el ancho completo de la grilla. */
.task-column__empty {
  grid-column: 1 / -1;
  border: 2px dashed #dee2e6;
  border-radius: 0.5rem;
}
</style>
