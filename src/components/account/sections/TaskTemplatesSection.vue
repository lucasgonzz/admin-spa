<template>
  <!--
    Vista de plantillas de tareas automáticas.
    Muestra las plantillas agrupadas por proceso con CRUD completo,
    toggle de estado activo/inactivo y reordenamiento con flechas.
  -->
  <div class="task-templates-section">

    <!-- Barra de acciones (filtro y alta) -->
    <div class="d-flex align-items-center justify-content-end mb-3 flex-wrap gap-2">
      <div class="d-flex gap-2 align-items-center">
        <!-- Filtro por proceso -->
        <select v-model="filtro_proceso" class="form-select form-select-sm" style="min-width:180px">
          <option value="">Todos los procesos</option>
          <option v-for="p in procesos_disponibles" :key="p" :value="p">{{ p }}</option>
        </select>
        <button type="button" class="btn btn-primary btn-sm" @click="open_create_modal">
          <i class="bi bi-plus-lg me-1" /> Nueva plantilla
        </button>
      </div>
    </div>

    <!-- Spinner de carga inicial -->
    <div v-if="loading" class="text-center py-5 text-muted">
      <span class="spinner-border spinner-border-sm me-2" />
      Cargando plantillas…
    </div>

    <!-- Sin resultados -->
    <div v-else-if="grupos_filtrados.length === 0" class="text-center py-5 text-muted">
      <i class="bi bi-inbox fs-3 d-block mb-2" />
      No hay plantillas{{ filtro_proceso ? ' para este proceso' : '' }}.
    </div>

    <!-- Grupos por proceso -->
    <div v-else>
      <div
        v-for="grupo in grupos_filtrados"
        :key="grupo.proceso"
        class="mb-4"
      >
        <!-- Cabecera del grupo de proceso -->
        <div class="d-flex align-items-center mb-2 gap-2">
          <span class="badge bg-secondary fs-6">{{ grupo.proceso }}</span>
          <small class="text-muted">{{ grupo.templates.length }} plantilla{{ grupo.templates.length !== 1 ? 's' : '' }}</small>
        </div>

        <!-- Tabla de plantillas del proceso -->
        <div class="table-responsive">
          <table class="table table-bordered table-sm align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th style="width:48px" class="text-center">Orden</th>
                <th>Título</th>
                <th style="width:130px">Asignado a</th>
                <th style="width:80px" class="text-center">Prioridad</th>
                <th style="width:90px" class="text-center">Estado</th>
                <th style="width:110px" class="text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(template, idx) in grupo.templates" :key="template.id">
                <!-- Flechas de orden -->
                <td class="text-center">
                  <div class="d-flex flex-column align-items-center gap-1">
                    <button
                      type="button"
                      class="btn btn-outline-secondary btn-sm p-0 px-1"
                      :disabled="idx === 0 || action_loading === template.id"
                      @click="on_move_up(template)"
                      title="Subir"
                    >
                      <i class="bi bi-chevron-up" />
                    </button>
                    <small class="text-muted">{{ template.orden }}</small>
                    <button
                      type="button"
                      class="btn btn-outline-secondary btn-sm p-0 px-1"
                      :disabled="idx === grupo.templates.length - 1 || action_loading === template.id"
                      @click="on_move_down(template)"
                      title="Bajar"
                    >
                      <i class="bi bi-chevron-down" />
                    </button>
                  </div>
                </td>

                <!-- Título con descripción y checklist resumido -->
                <td>
                  <div class="fw-medium">{{ template.titulo }}</div>
                  <div v-if="template.descripcion" class="text-muted small mt-1">{{ template.descripcion }}</div>
                  <div v-if="template.checklist && template.checklist.length" class="mt-1">
                    <span
                      v-for="(item, i) in template.checklist"
                      :key="i"
                      class="badge bg-light text-dark border me-1 mt-1"
                      style="font-size:0.72rem"
                    >{{ item }}</span>
                  </div>
                </td>

                <!-- Admin asignado -->
                <td>
                  <span v-if="template_assigned_label(template)" class="badge bg-info text-dark">
                    {{ template_assigned_label(template) }}
                  </span>
                  <span v-else class="text-muted small">Sin asignar</span>
                </td>

                <!-- Prioridad -->
                <td class="text-center">
                  <span class="badge" :class="prioridad_badge_class(template.prioridad)">{{ template.prioridad }}</span>
                </td>

                <!-- Toggle activa/inactiva -->
                <td class="text-center">
                  <button
                    type="button"
                    class="btn btn-sm"
                    :class="template.activa ? 'btn-success' : 'btn-outline-secondary'"
                    :disabled="action_loading === template.id"
                    @click="on_toggle_active(template)"
                    :title="template.activa ? 'Activa — clic para desactivar' : 'Inactiva — clic para activar'"
                  >
                    <i :class="template.activa ? 'bi bi-check-circle-fill' : 'bi bi-circle'" />
                    {{ template.activa ? 'Activa' : 'Inactiva' }}
                  </button>
                </td>

                <!-- Acciones editar / eliminar -->
                <td class="text-center">
                  <div class="d-flex gap-1 justify-content-center">
                    <button
                      type="button"
                      class="btn btn-outline-primary btn-sm"
                      :disabled="action_loading === template.id"
                      @click="open_edit_modal(template)"
                      title="Editar"
                    >
                      <i class="bi bi-pencil" />
                    </button>
                    <button
                      type="button"
                      class="btn btn-outline-danger btn-sm"
                      :disabled="action_loading === template.id"
                      @click="on_delete(template)"
                      title="Eliminar"
                    >
                      <i class="bi bi-trash" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal de creación / edición -->
    <div v-if="show_modal" class="modal d-block" tabindex="-1" style="background:rgba(0,0,0,.4)">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ editing_template ? 'Editar plantilla' : 'Nueva plantilla' }}</h5>
            <button type="button" class="btn-close" @click="close_modal" />
          </div>

          <div class="modal-body">
            <div class="row g-3">
              <!-- Proceso -->
              <div class="col-md-6">
                <label class="form-label fw-medium">Proceso <span class="text-danger">*</span></label>
                <input
                  v-model="form.proceso"
                  type="text"
                  class="form-control"
                  placeholder="ej: lead_a_cliente"
                />
              </div>

              <!-- Asignado a: select de admins del panel -->
              <div class="col-md-6">
                <label class="form-label fw-medium">Asignado a</label>
                <select
                  v-model="form.assigned_admin_id"
                  class="form-select"
                  :disabled="admins_loading"
                >
                  <option :value="null">— Sin asignar —</option>
                  <option
                    v-for="admin in admins"
                    :key="admin.id"
                    :value="admin.id"
                  >
                    {{ admin.name }}
                  </option>
                </select>
                <div v-if="admins_loading" class="form-text">Cargando usuarios…</div>
              </div>

              <!-- Título -->
              <div class="col-12">
                <label class="form-label fw-medium">Título <span class="text-danger">*</span></label>
                <input
                  v-model="form.titulo"
                  type="text"
                  class="form-control"
                  placeholder="Título de la tarea"
                />
              </div>

              <!-- Descripción -->
              <div class="col-12">
                <label class="form-label fw-medium">Descripción</label>
                <textarea
                  v-model="form.descripcion"
                  class="form-control"
                  rows="3"
                  placeholder="Descripción opcional de la tarea"
                />
              </div>

              <!-- Checklist -->
              <div class="col-12">
                <label class="form-label fw-medium">Checklist</label>
                <div
                  v-for="(item, idx) in form.checklist"
                  :key="idx"
                  class="d-flex gap-2 mb-2"
                >
                  <input
                    v-model="form.checklist[idx]"
                    type="text"
                    class="form-control form-control-sm"
                    :placeholder="'Ítem ' + (idx + 1)"
                  />
                  <button
                    type="button"
                    class="btn btn-outline-danger btn-sm"
                    @click="remove_checklist_item(idx)"
                    title="Eliminar ítem"
                  >
                    <i class="bi bi-x" />
                  </button>
                </div>
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  @click="add_checklist_item"
                >
                  <i class="bi bi-plus me-1" /> Agregar ítem
                </button>
              </div>

              <!-- Prioridad y orden -->
              <div class="col-md-6">
                <label class="form-label fw-medium">Prioridad</label>
                <input
                  v-model.number="form.prioridad"
                  type="number"
                  class="form-control"
                  min="0"
                  placeholder="0"
                />
              </div>
              <div class="col-md-6">
                <label class="form-label fw-medium">Orden</label>
                <input
                  v-model.number="form.orden"
                  type="number"
                  class="form-control"
                  min="0"
                  placeholder="0"
                />
              </div>

              <!-- Activa -->
              <div class="col-12">
                <div class="form-check">
                  <input
                    id="form_activa"
                    v-model="form.activa"
                    type="checkbox"
                    class="form-check-input"
                  />
                  <label for="form_activa" class="form-check-label">
                    Plantilla activa (se usará al disparar el proceso)
                  </label>
                </div>
              </div>
            </div>

            <!-- Error de guardado -->
            <div v-if="form_error" class="alert alert-danger mt-3 mb-0 py-2 small">
              {{ form_error }}
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="close_modal">Cancelar</button>
            <button
              type="button"
              class="btn btn-primary"
              :disabled="saving"
              @click="save_form"
            >
              <span v-if="saving" class="spinner-border spinner-border-sm me-1" />
              {{ editing_template ? 'Guardar cambios' : 'Crear plantilla' }}
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script>
/**
 * Sección de cuenta: plantillas de tareas automáticas agrupadas por proceso.
 */
export default {
  name: 'TaskTemplatesSection',

  data() {
    return {
      /**
       * Proceso seleccionado para filtrar el listado.
       * String vacío = todos los procesos.
       */
      filtro_proceso: '',

      /**
       * ID de la plantilla con acción en curso (toggle, move, delete).
       * Bloquea botones individuales para evitar doble clic.
       */
      action_loading: null,

      /**
       * Controla la visibilidad del modal de creación / edición.
       */
      show_modal: false,

      /**
       * Plantilla en edición. Null cuando se está creando una nueva.
       */
      editing_template: null,

      /**
       * Indicador de guardado en curso dentro del modal.
       */
      saving: false,

      /**
       * Mensaje de error del formulario para mostrar al usuario.
       */
      form_error: '',

      /**
       * Datos del formulario de creación / edición.
       */
      form: {
        proceso: '',
        titulo: '',
        descripcion: '',
        checklist: [],
        /** ID del admin asignado; null = sin asignar. */
        assigned_admin_id: null,
        prioridad: 0,
        orden: 0,
        activa: true,
      },
    }
  },

  computed: {
    /**
     * Indica si las plantillas están cargándose por primera vez.
     * @returns {boolean}
     */
    loading() {
      return this.$store.state.task_template.loading
    },

    /**
     * Lista completa de plantillas del store.
     * @returns {Array}
     */
    templates() {
      return this.$store.state.task_template.models || []
    },

    /**
     * Lista de admins para el selector de asignación.
     * @returns {Array}
     */
    admins() {
      return this.$store.state.task_template.admins || []
    },

    /**
     * Indica si los admins del select están cargándose.
     * @returns {boolean}
     */
    admins_loading() {
      return this.$store.state.task_template.admins_loading
    },

    /**
     * Lista de procesos únicos para el selector de filtro.
     * Se extrae dinámicamente de las plantillas cargadas.
     * @returns {Array<string>}
     */
    procesos_disponibles() {
      /** Set para deduplicar valores de proceso. */
      var set = {}
      this.templates.forEach(function (t) {
        if (t.proceso) {
          set[t.proceso] = true
        }
      })
      return Object.keys(set).sort()
    },

    /**
     * Plantillas agrupadas por proceso con filtro aplicado.
     * Cada grupo tiene { proceso, templates[] } ordenado por campo `orden`.
     * @returns {Array<{proceso: string, templates: Array}>}
     */
    grupos_filtrados() {
      /** Plantillas tras aplicar el filtro de proceso. */
      var filtered = this.templates.filter(function (t) {
        return true
      })

      // Aplicar filtro si hay un proceso seleccionado.
      if (this.filtro_proceso) {
        var filtro = this.filtro_proceso
        filtered = filtered.filter(function (t) {
          return t.proceso === filtro
        })
      }

      // Agrupar por proceso y ordenar dentro de cada grupo por `orden`.
      /** Mapa proceso → array de plantillas. */
      var grupos_map = {}
      filtered.forEach(function (t) {
        if (!grupos_map[t.proceso]) {
          grupos_map[t.proceso] = []
        }
        grupos_map[t.proceso].push(t)
      })

      /** Resultado final: array de grupos ordenado por nombre de proceso. */
      var resultado = []
      Object.keys(grupos_map)
        .sort()
        .forEach(function (proceso) {
          // Ordenar las plantillas del grupo por campo orden ascendente.
          var sorted = grupos_map[proceso].slice().sort(function (a, b) {
            return a.orden - b.orden
          })
          resultado.push({ proceso: proceso, templates: sorted })
        })

      return resultado
    },
  },

  created() {
    /**
     * Cargar plantillas y admins para el select de asignación.
     */
    this.$store.dispatch('task_template/get_models')
    this.$store.dispatch('task_template/fetch_admins')
  },

  methods: {
    /**
     * Etiqueta visible del admin asignado en la tabla (relación o nombre legacy).
     *
     * @param {Object} template
     * @returns {string}
     */
    template_assigned_label(template) {
      if (template.assigned_admin && template.assigned_admin.name) {
        return template.assigned_admin.name
      }
      return (template.asignado_a || '').trim()
    },

    /**
     * Devuelve la clase del badge según el valor de prioridad de la plantilla.
     * @param {number} prioridad Valor de prioridad.
     * @returns {string}
     */
    prioridad_badge_class(prioridad) {
      if (prioridad >= 2) {
        return 'bg-danger'
      }
      if (prioridad === 1) {
        return 'bg-warning text-dark'
      }
      return 'bg-secondary'
    },

    /**
     * Busca el id de admin por nombre (plantillas legacy con solo asignado_a).
     *
     * @param {string|null} name
     * @returns {number|null}
     */
    resolve_admin_id_from_name(name) {
      const normalized = (name || '').trim()
      if (!normalized) {
        return null
      }
      const found = this.admins.find(function (a) {
        return a.name === normalized
      })
      return found ? found.id : null
    },

    /**
     * Muestra un feedback rápido al usuario; usa toast global si está disponible.
     * @param {string} message Mensaje a mostrar.
     * @returns {void}
     */
    show_feedback(message) {
      if (this.$root && this.$root.$emit) {
        this.$root.$emit('open_toast', message)
        return
      }
      alert(message)
    },

    /**
     * Normaliza el mensaje de error de axios.
     * @param {any} error Error capturado.
     * @returns {string}
     */
    get_error_message(error) {
      if (error && error.response && error.response.data && error.response.data.message) {
        return error.response.data.message
      }
      return 'Ocurrió un error inesperado.'
    },

    /**
     * Abre el modal para crear una nueva plantilla con el formulario en blanco.
     * @returns {void}
     */
    open_create_modal() {
      this.editing_template = null
      this.form_error = ''
      this.form = {
        proceso: '',
        titulo: '',
        descripcion: '',
        checklist: [],
        assigned_admin_id: null,
        prioridad: 0,
        orden: 0,
        activa: true,
      }
      this.show_modal = true
    },

    /**
     * Abre el modal para editar la plantilla recibida, pre-cargando sus datos en el formulario.
     * @param {Object} template Plantilla a editar.
     * @returns {void}
     */
    open_edit_modal(template) {
      this.editing_template = template
      this.form_error = ''
      this.form = {
        proceso:     template.proceso || '',
        titulo:      template.titulo || '',
        descripcion: template.descripcion || '',
        // Clonar el checklist para no mutar el store directamente.
        checklist:   template.checklist ? template.checklist.slice() : [],
        assigned_admin_id: template.assigned_admin_id || this.resolve_admin_id_from_name(template.asignado_a),
        prioridad:   template.prioridad || 0,
        orden:       template.orden || 0,
        activa:      template.activa !== false,
      }
      this.show_modal = true
    },

    /**
     * Cierra el modal y limpia el estado del formulario.
     * @returns {void}
     */
    close_modal() {
      this.show_modal = false
      this.editing_template = null
      this.form_error = ''
    },

    /**
     * Agrega un ítem vacío al checklist del formulario.
     * @returns {void}
     */
    add_checklist_item() {
      this.form.checklist.push('')
    },

    /**
     * Elimina un ítem del checklist del formulario por índice.
     * @param {number} idx Índice del ítem a eliminar.
     * @returns {void}
     */
    remove_checklist_item(idx) {
      this.form.checklist.splice(idx, 1)
    },

    /**
     * Guarda la plantilla (crea o actualiza según editing_template).
     * Valida campos obligatorios antes de llamar al store.
     * @returns {void}
     */
    save_form() {
      const self = this

      // Validación mínima del formulario.
      if (!(self.form.proceso || '').trim()) {
        self.form_error = 'El proceso es obligatorio.'
        return
      }
      if (!(self.form.titulo || '').trim()) {
        self.form_error = 'El título es obligatorio.'
        return
      }

      self.form_error = ''
      self.saving = true

      // Armar payload limpiando ítems vacíos del checklist.
      /** Checklist sin strings vacíos. */
      var clean_checklist = self.form.checklist.filter(function (item) {
        return (item || '').trim() !== ''
      })

      var payload = {
        proceso:     self.form.proceso.trim(),
        titulo:      self.form.titulo.trim(),
        descripcion: self.form.descripcion || null,
        checklist:   clean_checklist.length > 0 ? clean_checklist : null,
        assigned_admin_id: self.form.assigned_admin_id || null,
        prioridad:   self.form.prioridad || 0,
        orden:       self.form.orden || 0,
        activa:      self.form.activa,
      }

      /** Acción del store según si se está editando o creando. */
      var action_promise

      if (self.editing_template) {
        // Edición: incluir el id en el payload.
        payload.id = self.editing_template.id
        action_promise = self.$store.dispatch('task_template/update_template', payload)
      } else {
        // Creación nueva.
        action_promise = self.$store.dispatch('task_template/create_template', payload)
      }

      action_promise
        .then(function () {
          self.saving = false
          self.close_modal()
          self.show_feedback(self.editing_template ? 'Plantilla actualizada.' : 'Plantilla creada.')
        })
        .catch(function (error) {
          self.saving = false
          self.form_error = self.get_error_message(error)
        })
    },

    /**
     * Elimina una plantilla tras confirmación del usuario.
     * @param {Object} template Plantilla a eliminar.
     * @returns {void}
     */
    on_delete(template) {
      const self = this
      if (!confirm('¿Eliminar la plantilla "' + template.titulo + '"?')) {
        return
      }
      self.action_loading = template.id
      self.$store.dispatch('task_template/delete_template', template.id)
        .then(function () {
          self.action_loading = null
          self.show_feedback('Plantilla eliminada.')
        })
        .catch(function (error) {
          self.action_loading = null
          self.show_feedback(self.get_error_message(error))
        })
    },

    /**
     * Alterna el estado activa/inactiva de una plantilla.
     * @param {Object} template Plantilla a alternar.
     * @returns {void}
     */
    on_toggle_active(template) {
      const self = this
      self.action_loading = template.id
      self.$store.dispatch('task_template/toggle_active', template.id)
        .then(function () {
          self.action_loading = null
        })
        .catch(function (error) {
          self.action_loading = null
          self.show_feedback(self.get_error_message(error))
        })
    },

    /**
     * Mueve la plantilla un lugar hacia arriba dentro de su proceso.
     * @param {Object} template Plantilla a mover.
     * @returns {void}
     */
    on_move_up(template) {
      const self = this
      self.action_loading = template.id
      self.$store.dispatch('task_template/move_up', template.id)
        .then(function () {
          self.action_loading = null
        })
        .catch(function (error) {
          self.action_loading = null
          self.show_feedback(self.get_error_message(error))
        })
    },

    /**
     * Mueve la plantilla un lugar hacia abajo dentro de su proceso.
     * @param {Object} template Plantilla a mover.
     * @returns {void}
     */
    on_move_down(template) {
      const self = this
      self.action_loading = template.id
      self.$store.dispatch('task_template/move_down', template.id)
        .then(function () {
          self.action_loading = null
        })
        .catch(function (error) {
          self.action_loading = null
          self.show_feedback(self.get_error_message(error))
        })
    },
  },
}
</script>
