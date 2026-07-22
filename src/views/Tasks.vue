<template>
  <!--
    Vista de tareas internas del panel administrativo.
    Muestra dos listas apiladas a lo ancho completo: pendientes (no realizadas,
    siempre visible) y realizadas (colapsable, arranca cerrada).
    Permite crear, editar, eliminar y reordenar tareas por drag & drop.
    Las tareas nuevas aparecen siempre al inicio de la lista de pendientes.
  -->
  <div class="tasks-view">

    <!-- Barra de acciones superior -->
    <div class="d-flex align-items-center justify-content-between mb-4">
      <h1 class="h4 mb-0">Tareas</h1>
      <button type="button" class="btn btn-primary" @click="open_create_modal">
        <i class="bi bi-plus-lg me-1" /> Nueva tarea
      </button>
    </div>

    <!-- Spinner de carga inicial -->
    <div v-if="loading" class="text-center py-5 text-muted">
      <span class="spinner-border spinner-border-sm me-2" />
      Cargando tareas…
    </div>

    <!-- Layout de listas apiladas a lo ancho completo (antes eran dos columnas de media pantalla) -->
    <div v-else class="tasks-view__lists d-flex flex-column gap-4">

      <!-- Lista: Pendientes (siempre expandida, ocupa todo el ancho) -->
      <task-column
        title="Pendientes"
        header_dot_class="bg-primary"
        empty_message="No hay tareas pendientes."
        :tasks="pending_tasks"
        @edit="open_edit_modal"
        @delete="on_delete_task"
        @toggle-done="on_toggle_done"
        @update-todos="on_update_todos"
        @reorder="on_reorder_pending"
      />

      <!-- Lista: Realizadas (colapsable, arranca colapsada) -->
      <task-column
        title="Realizadas"
        header_dot_class="bg-success"
        empty_message="No hay tareas realizadas aún."
        :tasks="done_tasks"
        :collapsible="true"
        :collapsed="!show_done"
        @toggle="show_done = !show_done"
        @edit="open_edit_modal"
        @delete="on_delete_task"
        @toggle-done="on_toggle_done"
        @update-todos="on_update_todos"
        @reorder="on_reorder_done"
      />

    </div>

    <!-- Modal de formulario (crear / editar) -->
    <task-form-modal
      v-if="show_modal"
      :task="editing_task"
      :admins="admins"
      :saving="modal_saving"
      @save="on_modal_save"
      @cancel="close_modal"
    />

  </div>
</template>

<script>
import TaskColumn from '@/components/task/TaskColumn.vue'
import TaskFormModal from '@/components/task/TaskFormModal.vue'

/**
 * Vista principal del módulo de tareas.
 * Carga tareas y admins al montar, y orquesta todas las operaciones de CRUD
 * y reordenamiento delegando al store de Vuex.
 */
export default {
  name: 'ViewTasks',

  components: { TaskColumn, TaskFormModal },

  data() {
    return {
      /**
       * Controla la visibilidad del modal de formulario.
       */
      show_modal: false,
      /**
       * Tarea que se está editando. Null indica modo creación.
       */
      editing_task: null,
      /**
       * True mientras el modal está esperando respuesta del servidor.
       */
      modal_saving: false,
      /**
       * Controla si la lista de "Realizadas" está desplegada. Arranca colapsada
       * en cada carga de la vista para no saturar la pantalla con tareas ya hechas.
       */
      show_done: false,
    }
  },

  computed: {
    /**
     * Estado de carga del store (GET /task inicial).
     */
    loading() {
      return this.$store.state.task.loading
    },

    /**
     * Todas las tareas cargadas en el store, ordenadas por sort_order.
     */
    all_tasks() {
      return this.$store.state.task.models
    },

    /**
     * Tareas no realizadas, respetando el orden de prioridad (sort_order).
     */
    pending_tasks() {
      return this.all_tasks.filter(function (t) { return !t.is_done })
    },

    /**
     * Tareas realizadas, respetando el orden de sort_order.
     */
    done_tasks() {
      return this.all_tasks.filter(function (t) { return t.is_done })
    },

    /**
     * Lista de admins para el selector del modal de formulario.
     */
    admins() {
      return this.$store.state.task.admins
    },
  },

  created() {
    // Cargar tareas y admins en paralelo al montar la vista.
    this.$store.dispatch('task/get_models')
    this.$store.dispatch('task/fetch_admins')
  },

  methods: {
    /**
     * Abre el modal en modo creación (sin tarea preseleccionada).
     */
    open_create_modal() {
      this.editing_task = null
      this.show_modal = true
    },

    /**
     * Abre el modal en modo edición con los datos de la tarea recibida.
     *
     * @param {Object} task  Tarea a editar.
     */
    open_edit_modal(task) {
      this.editing_task = task
      this.show_modal = true
    },

    /**
     * Cierra el modal y limpia el estado de edición.
     */
    close_modal() {
      this.show_modal = false
      this.editing_task = null
      this.modal_saving = false
    },

    /**
     * Guarda la tarea (crear o actualizar) según el payload del modal.
     * Determina el modo por la presencia de payload.id.
     *
     * @param {Object} payload  Datos del formulario validados por TaskFormModal.
     */
    on_modal_save(payload) {
      const self = this
      self.modal_saving = true

      // Si hay id, es edición; si no, es creación.
      const action = payload.id ? 'task/update_task' : 'task/create_task'

      this.$store
        .dispatch(action, payload)
        .then(function () {
          self.close_modal()
        })
        .catch(function () {
          self.modal_saving = false
        })
    },

    /**
     * Alterna el estado is_done de una tarea mediante el store.
     *
     * @param {Object} task  Tarea a cambiar.
     */
    on_toggle_done(task) {
      this.$store.dispatch('task/toggle_done', task)
    },

    /**
     * Confirma y elimina una tarea por su ID.
     *
     * @param {Object} task  Tarea a eliminar.
     */
    on_delete_task(task) {
      if (!window.confirm('¿Eliminar la tarea "' + task.title + '"?')) {
        return
      }
      this.$store.dispatch('task/delete_task', task.id)
    },

    /**
     * Actualiza las subtareas (todos) de una tarea vía update_task.
     * Recibe el evento emitido por TaskCard con { task, todos }.
     *
     * @param {Object} payload  { task: Object, todos: Array }
     */
    on_update_todos(payload) {
      this.$store.dispatch('task/update_task', {
        id: payload.task.id,
        todos: payload.todos,
      })
    },

    /**
     * Reordena las tareas pendientes según el array de IDs recibido desde TaskColumn.
     * Mezcla el nuevo orden de pendientes con el orden actual de las realizadas.
     *
     * @param {Array} pending_ids  IDs de tareas pendientes en el nuevo orden.
     */
    on_reorder_pending(pending_ids) {
      // Construir array completo: pendientes reordenadas + realizadas en su orden actual.
      const done_ids = this.done_tasks.map(function (t) { return t.id })
      this.$store.dispatch('task/reorder_tasks', { ids: pending_ids.concat(done_ids) })
    },

    /**
     * Reordena las tareas realizadas según el array de IDs recibido desde TaskColumn.
     * Mezcla el orden actual de pendientes con el nuevo orden de realizadas.
     *
     * @param {Array} done_ids  IDs de tareas realizadas en el nuevo orden.
     */
    on_reorder_done(done_ids) {
      // Construir array completo: pendientes en su orden actual + realizadas reordenadas.
      const pending_ids = this.pending_tasks.map(function (t) { return t.id })
      this.$store.dispatch('task/reorder_tasks', { ids: pending_ids.concat(done_ids) })
    },
  },
}
</script>

<style scoped>
/* Altura mínima para que la vista llene el viewport disponible. */
.tasks-view {
  min-height: 100%;
}

/* Las listas ocupan todo el ancho y se apilan verticalmente; el scroll ahora
   es el de la página (ya no hay altura fija ni scroll interno por columna). */
</style>
