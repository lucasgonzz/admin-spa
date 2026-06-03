<template>
  <!--
    Tarjeta individual de tarea.
    Muestra título, contenido, subtareas y datos del admin asignado.
    Es draggable para reordenamiento por drag & drop dentro de la columna.
    Emite eventos para editar, eliminar y cambiar estado de realización.
  -->
  <div
    class="task-card card shadow-sm mb-2"
    :class="{
      'task-card--done': task.is_done,
      'task-card--dragging': is_dragging,
      'task-card--drag-over': is_drag_over,
    }"
    draggable="true"
    @dragstart="$emit('dragstart', $event)"
    @dragend="$emit('dragend', $event)"
    @dragover.prevent="$emit('dragover', $event)"
    @drop.prevent="$emit('drop', $event)"
    @dragenter.prevent
  >
    <div class="card-body p-3">

      <!-- Cabecera: checkbox de realizada + título + acciones -->
      <div class="d-flex align-items-start gap-2 mb-1">
        <!-- Checkbox para marcar como realizada -->
        <div class="flex-shrink-0 pt-1">
          <input
            type="checkbox"
            class="form-check-input task-card__done-check"
            :checked="task.is_done"
            :title="task.is_done ? 'Marcar como pendiente' : 'Marcar como realizada'"
            @change="$emit('toggle-done', task)"
          />
        </div>

        <!-- Título de la tarea -->
        <div class="flex-grow-1 min-w-0">
          <p
            class="mb-0 fw-semibold task-card__title"
            :class="{ 'text-decoration-line-through text-muted': task.is_done }"
          >
            {{ task.title }}
          </p>
        </div>

        <!-- Indicador de arrastre -->
        <div class="flex-shrink-0 task-card__drag-handle text-muted" title="Arrastrar para reordenar">
          <i class="bi bi-grip-vertical" />
        </div>

        <!-- Botón editar -->
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary flex-shrink-0 task-card__action-btn"
          title="Editar tarea"
          @click="$emit('edit', task)"
        >
          <i class="bi bi-pencil" />
        </button>

        <!-- Botón eliminar -->
        <button
          type="button"
          class="btn btn-sm btn-outline-danger flex-shrink-0 task-card__action-btn"
          title="Eliminar tarea"
          @click="$emit('delete', task)"
        >
          <i class="bi bi-trash" />
        </button>
      </div>

      <!-- Contenido descriptivo (si existe) -->
      <p
        v-if="task.content"
        class="task-card__content text-secondary small mb-2 ms-4"
      >
        {{ task.content }}
      </p>

      <!-- Lista de subtareas (todos) -->
      <ul v-if="has_todos" class="list-unstyled mb-2 ms-4">
        <li
          v-for="(todo, index) in task.todos"
          :key="index"
          class="d-flex align-items-center gap-2 mb-1"
        >
          <input
            type="checkbox"
            class="form-check-input mt-0 flex-shrink-0"
            :checked="todo.done"
            @change="on_toggle_todo(index, $event)"
          />
          <span
            class="small"
            :class="{ 'text-decoration-line-through text-muted': todo.done }"
          >
            {{ todo.text }}
          </span>
        </li>
      </ul>

      <!-- Progreso de subtareas (si hay) -->
      <div v-if="has_todos" class="ms-4 mb-2">
        <div class="progress" style="height: 4px;">
          <div
            class="progress-bar"
            :style="{ width: todos_progress_pct + '%' }"
            :class="todos_progress_pct === 100 ? 'bg-success' : 'bg-primary'"
          />
        </div>
        <span class="text-muted" style="font-size: 0.7rem;">
          {{ todos_done_count }}/{{ task.todos.length }} subtareas
        </span>
      </div>

      <!-- Footer: admins y timestamp -->
      <div class="d-flex align-items-center justify-content-between ms-4 mt-1">
        <!-- Admin asignado -->
        <span v-if="task.assigned_admin" class="badge bg-secondary small">
          <i class="bi bi-person-fill me-1" />{{ task.assigned_admin.name }}
        </span>
        <span v-else class="text-muted small">Sin asignar</span>

        <!-- Admin que creó la tarea -->
        <span v-if="task.created_by_admin" class="text-muted small">
          Creado por {{ task.created_by_admin.name }}
        </span>
      </div>

    </div>
  </div>
</template>

<script>
/**
 * Tarjeta visual de una tarea individual.
 * Soporta drag & drop delegando los eventos al componente padre (TaskColumn).
 * Las subtareas se actualizan emitiendo 'update-todos' con el array modificado.
 */
export default {
  name: 'TaskCard',

  props: {
    /**
     * Objeto tarea con todos los campos: title, content, todos, is_done,
     * created_by_admin, assigned_admin, etc.
     */
    task: {
      type: Object,
      required: true,
    },
    /**
     * True cuando esta tarjeta está siendo arrastrada.
     */
    is_dragging: {
      type: Boolean,
      default: false,
    },
    /**
     * True cuando otra tarjeta está sobre esta durante un drag.
     */
    is_drag_over: {
      type: Boolean,
      default: false,
    },
  },

  emits: ['edit', 'delete', 'toggle-done', 'update-todos', 'dragstart', 'dragend', 'dragover', 'drop'],

  computed: {
    /**
     * True si la tarea tiene al menos una subtarea.
     */
    has_todos() {
      return Array.isArray(this.task.todos) && this.task.todos.length > 0
    },

    /**
     * Cantidad de subtareas marcadas como done.
     */
    todos_done_count() {
      if (!this.has_todos) return 0
      return this.task.todos.filter(function (t) { return t.done }).length
    },

    /**
     * Porcentaje de avance de subtareas (0–100).
     */
    todos_progress_pct() {
      if (!this.has_todos) return 0
      return Math.round((this.todos_done_count / this.task.todos.length) * 100)
    },
  },

  methods: {
    /**
     * Alterna el estado 'done' de una subtarea individual y emite 'update-todos'
     * con el array actualizado para que el padre lo persista.
     *
     * @param {number} index  Posición de la subtarea en el array.
     * @param {Event}  event  Evento change del checkbox.
     */
    on_toggle_todo(index, event) {
      // Clonar para no mutar la prop directamente.
      const updated_todos = this.task.todos.map(function (t, i) {
        return i === index ? { text: t.text, done: event.target.checked } : { text: t.text, done: t.done }
      })
      this.$emit('update-todos', { task: this.task, todos: updated_todos })
    },
  },
}
</script>

<style scoped>
/* Cursor de arrastre sobre la tarjeta completa. */
.task-card {
  cursor: grab;
  transition: opacity 0.15s, box-shadow 0.15s, transform 0.1s;
  border-left: 3px solid transparent;
}

/* Estilo mientras se arrastra esta tarjeta. */
.task-card--dragging {
  opacity: 0.45;
  cursor: grabbing;
}

/* Indicador visual cuando otra tarjeta pasa por encima. */
.task-card--drag-over {
  border-left-color: #0d6efd;
  box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.25);
}

/* Tareas realizadas: aspecto atenuado. */
.task-card--done {
  background: #f8f9fa;
  border-left-color: #6c757d;
}

/* Icono de agarre: solo visible en hover para no saturar el diseño. */
.task-card__drag-handle {
  opacity: 0;
  cursor: grab;
  transition: opacity 0.15s;
}

.task-card:hover .task-card__drag-handle {
  opacity: 1;
}

/* Botones de acción: solo visibles en hover. */
.task-card__action-btn {
  opacity: 0;
  transition: opacity 0.15s;
  padding: 0.15rem 0.35rem;
  font-size: 0.75rem;
}

.task-card:hover .task-card__action-btn {
  opacity: 1;
}

/* Título con truncado de texto largo. */
.task-card__title {
  word-break: break-word;
}

/* Contenido descriptivo con máximo de líneas visible. */
.task-card__content {
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 4.5rem;
  overflow: hidden;
}
</style>
