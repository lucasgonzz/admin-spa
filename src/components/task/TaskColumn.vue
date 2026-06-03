<template>
  <!--
    Columna de tareas draggables.
    Muestra un header con el título y cantidad, y la lista vertical de TaskCard.
    Gestiona el drag & drop interno usando HTML5 nativo y emite 'reorder' con
    los IDs en el nuevo orden cuando el usuario suelta una tarjeta.
  -->
  <div class="task-column d-flex flex-column h-100">

    <!-- Encabezado de columna -->
    <div class="task-column__header d-flex align-items-center justify-content-between mb-3 px-1">
      <div class="d-flex align-items-center gap-2">
        <!-- Punto de color identificador de la columna -->
        <span class="task-column__dot" :class="header_dot_class" />
        <h6 class="mb-0 fw-semibold">{{ title }}</h6>
        <span class="badge rounded-pill bg-secondary">{{ tasks.length }}</span>
      </div>
    </div>

    <!-- Lista de tarjetas -->
    <div
      class="task-column__list flex-grow-1 overflow-y-auto pe-1"
      @dragover.prevent
    >
      <task-card
        v-for="task in tasks"
        :key="task.id"
        :task="task"
        :is_dragging="dragging_id === task.id"
        :is_drag_over="drag_over_id === task.id"
        @dragstart="on_drag_start(task, $event)"
        @dragend="on_drag_end"
        @dragover="on_drag_over(task, $event)"
        @drop="on_drop(task)"
        @edit="$emit('edit', task)"
        @delete="$emit('delete', task)"
        @toggle-done="$emit('toggle-done', task)"
        @update-todos="$emit('update-todos', $event)"
      />

      <!-- Mensaje cuando la columna está vacía -->
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
  },

  emits: ['edit', 'delete', 'toggle-done', 'update-todos', 'reorder'],

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
/* Columna con scroll interno para listas largas. */
.task-column {
  min-height: 0;
}

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

/* Lista scrollable. */
.task-column__list {
  overflow-y: auto;
}

/* Mensaje vacío centrado. */
.task-column__empty {
  border: 2px dashed #dee2e6;
  border-radius: 0.5rem;
}
</style>
