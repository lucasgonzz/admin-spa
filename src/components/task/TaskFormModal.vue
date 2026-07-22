<template>
  <!--
    Modal para crear o editar una tarea.
    Muestra un formulario con título, contenido, admin asignado y subtareas (todos).
    Emite 'save' con el payload validado o 'cancel' al cerrar sin guardar.
  -->
  <div class="modal fade show d-block task-modal-backdrop" tabindex="-1" @mousedown.self="on_backdrop_click">
    <div class="modal-dialog modal-lg modal-dialog-scrollable">
      <div class="modal-content">

        <!-- Cabecera -->
        <div class="modal-header">
          <h5 class="modal-title">
            {{ is_edit ? 'Editar tarea' : 'Nueva tarea' }}
          </h5>
          <button type="button" class="btn-close" :disabled="saving" @click="$emit('cancel')" />
        </div>

        <!-- Cuerpo del formulario -->
        <div class="modal-body">

          <!-- Título -->
          <div class="mb-3">
            <label class="form-label fw-semibold">Título <span class="text-danger">*</span></label>
            <input
              v-model="form.title"
              type="text"
              class="form-control"
              :class="{ 'is-invalid': errors.title }"
              placeholder="Título de la tarea"
              maxlength="500"
              autofocus
            />
            <div v-if="errors.title" class="invalid-feedback">{{ errors.title }}</div>
          </div>

          <!-- Contenido -->
          <div class="mb-3">
            <label class="form-label fw-semibold">Contenido</label>
            <textarea
              v-model="form.content"
              class="form-control"
              rows="4"
              placeholder="Descripción o detalle de la tarea..."
            />
          </div>

          <!-- Responsables: selección múltiple mediante checkboxes (mejor que <select multiple> en mobile) -->
          <div class="mb-3">
            <label class="form-label fw-semibold">Responsables</label>
            <div class="form-text mb-2">
              Si no seleccionás a nadie, la tarea queda disponible para que la tome cualquiera.
            </div>
            <div
              v-for="admin in admins"
              :key="admin.id"
              class="form-check"
            >
              <input
                type="checkbox"
                class="form-check-input"
                :id="'task-form-admin-' + admin.id"
                :checked="is_admin_selected(admin.id)"
                @change="toggle_admin(admin.id)"
              />
              <label class="form-check-label" :for="'task-form-admin-' + admin.id">
                {{ admin.name }}
              </label>
            </div>
          </div>

          <!-- Subtareas (todos) -->
          <div class="mb-2">
            <label class="form-label fw-semibold">Subtareas</label>
            <div
              v-for="(todo, index) in form.todos"
              :key="index"
              class="d-flex align-items-center gap-2 mb-2"
            >
              <!-- Checkbox de estado de la subtarea -->
              <input
                type="checkbox"
                class="form-check-input mt-0 flex-shrink-0"
                :checked="todo.done"
                @change="toggle_todo_done(index, $event)"
              />
              <!-- Texto editable de la subtarea -->
              <input
                v-model="todo.text"
                type="text"
                class="form-control form-control-sm"
                placeholder="Descripción de la subtarea"
                maxlength="500"
              />
              <!-- Botón eliminar subtarea -->
              <button
                type="button"
                class="btn btn-sm btn-outline-danger flex-shrink-0"
                title="Eliminar subtarea"
                @click="remove_todo(index)"
              >
                <i class="bi bi-x" />
              </button>
            </div>

            <!-- Botón agregar nueva subtarea -->
            <button type="button" class="btn btn-sm btn-outline-secondary mt-1 ms-3" @click="add_todo">
              <i class="bi bi-plus" /> Agregar subtarea
            </button>
          </div>

        </div>

        <!-- Pie de página -->
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" :disabled="saving" @click="$emit('cancel')">
            Cancelar
          </button>
          <button type="button" class="btn btn-primary" :disabled="saving" @click="on_save">
            <span v-if="saving">
              <span class="spinner-border spinner-border-sm me-1" />
              Guardando…
            </span>
            <span v-else>{{ is_edit ? 'Guardar cambios' : 'Crear tarea' }}</span>
          </button>
        </div>

      </div>
    </div>
  </div>
</template>

<script>
import { register_modal_escape } from '@/utils/modal_escape'

/**
 * Modal de formulario para crear y editar tareas internas.
 * Si recibe la prop `task`, opera en modo edición precargando los datos.
 * Emite 'save' con el payload validado.
 */
export default {
  name: 'TaskFormModal',

  props: {
    /**
     * Tarea a editar. Si es null, el modal opera en modo creación.
     */
    task: {
      type: Object,
      default: null,
    },
    /**
     * Lista de admins disponibles para el selector de asignación.
     */
    admins: {
      type: Array,
      default: function () { return [] },
    },
    /**
     * Indica que el guardado está en proceso (deshabilita botones).
     */
    saving: {
      type: Boolean,
      default: false,
    },
  },

  emits: ['save', 'cancel'],

  data() {
    return {
      /**
       * Datos del formulario reactivo.
       * Se inicializa a partir de la prop `task` si existe (modo edición).
       */
      form: {
        title: '',
        content: '',
        /** Array de ids (number) de admins responsables de la tarea. */
        assigned_admin_ids: [],
        /** Array de subtareas { text, done }. */
        todos: [],
      },
      /**
       * Errores de validación por campo para mostrar inline.
       */
      errors: {
        title: null,
      },
      /** Desregistra el handler de Escape al destruir el componente. */
      unregister_escape: null,
    }
  },

  computed: {
    /**
     * True si hay una tarea para editar; false si es modo creación.
     */
    is_edit() {
      return !!this.task
    },
  },

  created() {
    this.init_form()
  },

  mounted() {
    /** Cierra con Escape salvo durante guardado (misma regla que el backdrop). */
    this.unregister_escape = register_modal_escape(() => {
      if (!this.saving) {
        this.$emit('cancel')
      }
    })
  },

  beforeUnmount() {
    if (this.unregister_escape) {
      this.unregister_escape()
      this.unregister_escape = null
    }
  },

  methods: {
    /**
     * Inicializa el formulario a partir de la prop `task` (edición)
     * o con valores vacíos (creación, con asignación por defecto si existe).
     */
    init_form() {
      if (this.task) {
        // Modo edición: clonar datos de la tarea para no mutar la prop.
        this.form.title = this.task.title || ''
        this.form.content = this.task.content || ''

        // Inicializar responsables desde lo guardado, respetando exactamente lo que
        // tiene la tarea (nunca aplicar la preselección por defecto al editar).
        if (Array.isArray(this.task.assigned_admins)) {
          this.form.assigned_admin_ids = this.task.assigned_admins.map(function (a) { return a.id })
          // Si vino vacío pero existe el legacy singular, usarlo como fallback.
          if (this.form.assigned_admin_ids.length === 0 && this.task.assigned_admin_id) {
            this.form.assigned_admin_ids = [this.task.assigned_admin_id]
          }
        } else if (this.task.assigned_admin_id) {
          // Defensivo: caché vieja sin assigned_admins, solo existe el campo legacy.
          this.form.assigned_admin_ids = [this.task.assigned_admin_id]
        } else {
          this.form.assigned_admin_ids = []
        }

        this.form.todos = Array.isArray(this.task.todos)
          ? this.task.todos.map(function (t) { return { text: t.text, done: !!t.done } })
          : []
      } else {
        // Modo creación: preseleccionar los admins con is_default_task_assignee.
        this.form.assigned_admin_ids = this.admins
          .filter(function (a) { return a.is_default_task_assignee })
          .map(function (a) { return a.id })
      }
    },

    /**
     * Indica si el admin está actualmente seleccionado como responsable.
     *
     * @param   {number} admin_id
     * @returns {boolean}
     */
    is_admin_selected(admin_id) {
      return this.form.assigned_admin_ids.indexOf(admin_id) !== -1
    },

    /**
     * Agrega o quita un admin de la lista de responsables seleccionados.
     *
     * @param {number} admin_id
     */
    toggle_admin(admin_id) {
      const idx = this.form.assigned_admin_ids.indexOf(admin_id)
      if (idx === -1) {
        this.form.assigned_admin_ids.push(admin_id)
      } else {
        this.form.assigned_admin_ids.splice(idx, 1)
      }
    },

    /**
     * Agrega una nueva subtarea vacía al final de la lista.
     */
    add_todo() {
      this.form.todos.push({ text: '', done: false })
    },

    /**
     * Elimina la subtarea en la posición indicada.
     *
     * @param {number} index Posición de la subtarea en el array.
     */
    remove_todo(index) {
      this.form.todos.splice(index, 1)
    },

    /**
     * Alterna el estado 'done' de la subtarea en la posición indicada.
     *
     * @param {number} index  Posición de la subtarea.
     * @param {Event}  event  Evento change del checkbox.
     */
    toggle_todo_done(index, event) {
      this.form.todos[index].done = event.target.checked
    },

    /**
     * Valida el formulario y emite 'save' si es válido.
     * Filtra subtareas vacías antes de enviar.
     */
    on_save() {
      // Resetear errores previos.
      this.errors.title = null

      // Validar título obligatorio.
      if (!this.form.title.trim()) {
        this.errors.title = 'El título es obligatorio.'
        return
      }

      // Filtrar subtareas sin texto (vacías por error del usuario).
      const todos_clean = this.form.todos.filter(function (t) { return t.text.trim() !== '' })

      const payload = {
        title: this.form.title.trim(),
        content: this.form.content.trim() || null,
        // Array de ids de responsables (formato nuevo); reemplaza assigned_admin_id.
        assigned_admin_ids: this.form.assigned_admin_ids.slice(),
        todos: todos_clean.length > 0 ? todos_clean : null,
      }

      // En modo edición, incluir el id para que el store sepa qué actualizar.
      if (this.task) {
        payload.id = this.task.id
      }

      this.$emit('save', payload)
    },

    /**
     * Cierra el modal si el usuario hace click en el backdrop (fuera del modal).
     */
    on_backdrop_click() {
      if (!this.saving) {
        this.$emit('cancel')
      }
    },
  },
}
</script>

<style scoped>
/* Overlay oscuro detrás del modal. */
.task-modal-backdrop {
  background: rgba(0, 0, 0, 0.5);
  z-index: 1050;
}
</style>
