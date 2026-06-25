<template>
  <div class="container-fluid px-0 py-4">
    <div class="d-flex align-items-center mb-4 gap-3">
      <h2 class="h4 mb-0">Plantilla base .env</h2>
      <!-- Botón para desplegar el formulario de nueva variable -->
      <button
        type="button"
        class="btn btn-outline-primary ms-auto"
        @click="show_new_var_form = !show_new_var_form"
      >
        <i class="bi bi-plus-circle me-1" />
        Agregar variable
      </button>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="saving"
        @click="save"
      >
        {{ saving ? 'Guardando...' : 'Guardar' }}
      </button>
    </div>

    <!-- Indicador de carga inicial -->
    <div v-if="loading" class="text-center py-5">
      <span class="spinner-border text-primary" role="status" aria-hidden="true" />
      <p class="text-muted mt-2">Cargando variables...</p>
    </div>

    <!-- Error de carga -->
    <div v-else-if="load_error" class="alert alert-danger">
      {{ load_error }}
    </div>

    <!-- Formulario colapsable para crear una nueva variable -->
    <div v-if="show_new_var_form" class="card mb-4 border-primary">
      <div class="card-header fw-semibold text-primary d-flex align-items-center">
        <i class="bi bi-plus-circle me-2" />
        Nueva variable
        <button
          type="button"
          class="btn-close ms-auto"
          @click="show_new_var_form = false"
        />
      </div>
      <div class="card-body">
        <!-- Mensaje de error de validación del backend -->
        <div v-if="new_var_error" class="alert alert-danger py-2 small mb-3">
          {{ new_var_error }}
        </div>

        <div class="row g-3">
          <!-- Nombre de la variable: se convierte a mayúsculas automáticamente -->
          <div class="col-md-4">
            <label class="form-label small mb-1 fw-semibold">
              Nombre de la variable <span class="text-danger">*</span>
            </label>
            <input
              v-model="new_var_form.key"
              type="text"
              class="form-control form-control-sm font-monospace text-uppercase"
              placeholder="NOMBRE_VARIABLE"
              @input="new_var_form.key = new_var_form.key.toUpperCase().replace(/\s/g, '_')"
            />
            <div class="form-text">Se convierte automáticamente a mayúsculas.</div>
          </div>

          <!-- Grupo: select de existentes o campo libre para grupo nuevo -->
          <div class="col-md-3">
            <label class="form-label small mb-1 fw-semibold">
              Grupo <span class="text-danger">*</span>
            </label>
            <!-- Select de grupos existentes más opción "Nuevo grupo" -->
            <select
              v-if="!new_var_custom_group"
              v-model="new_var_form.group"
              class="form-select form-select-sm"
              @change="if (new_var_form.group === '__new__') { new_var_custom_group = true; new_var_form.group = '' }"
            >
              <option value="" disabled>Seleccionar grupo...</option>
              <option v-for="g in group_names" :key="g" :value="g">{{ group_label(g) }} ({{ g }})</option>
              <option value="__new__">+ Nuevo grupo...</option>
            </select>
            <!-- Input libre para nombre de grupo personalizado -->
            <div v-else class="input-group input-group-sm">
              <input
                v-model="new_var_form.group"
                type="text"
                class="form-control form-control-sm"
                placeholder="nombre_grupo"
                @input="new_var_form.group = new_var_form.group.toLowerCase().replace(/\s/g, '_')"
              />
              <!-- Botón para volver al select de grupos existentes -->
              <button
                type="button"
                class="btn btn-outline-secondary"
                title="Volver a grupos existentes"
                @click="new_var_custom_group = false; new_var_form.group = group_names[0] || 'misc'"
              >
                &#8592;
              </button>
            </div>
            <div v-if="new_var_custom_group" class="form-text">
              Se creará un nuevo grupo con este nombre.
            </div>
          </div>

          <!-- Valor del template (opcional) -->
          <div class="col-md-5">
            <label class="form-label small mb-1 fw-semibold">Valor</label>
            <input
              v-model="new_var_form.value"
              type="text"
              class="form-control form-control-sm"
              placeholder="Dejar vacío si se completará manualmente"
            />
          </div>

          <!-- Checkboxes: is_common e is_manual_on_create -->
          <div class="col-md-3 d-flex flex-column gap-2">
            <div class="form-check">
              <input
                v-model="new_var_form.is_common"
                type="checkbox"
                class="form-check-input"
                id="new-var-common"
              />
              <label class="form-check-label small" for="new-var-common">
                Común <span class="text-muted">(se contrasta al actualizar)</span>
              </label>
            </div>
            <div class="form-check">
              <input
                v-model="new_var_form.is_manual_on_create"
                type="checkbox"
                class="form-check-input"
                id="new-var-manual"
              />
              <label class="form-check-label small" for="new-var-manual">
                Manual al crear <span class="text-muted">(recordatorio en alta)</span>
              </label>
            </div>
          </div>

          <!-- Orden dentro del grupo -->
          <div class="col-md-2">
            <label class="form-label small mb-1 fw-semibold">Orden</label>
            <input
              v-model.number="new_var_form.sort_order"
              type="number"
              class="form-control form-control-sm"
              min="1"
            />
          </div>

          <!-- Notas internas del operador -->
          <div class="col-md-7">
            <label class="form-label small mb-1 fw-semibold">Notas</label>
            <input
              v-model="new_var_form.notes"
              type="text"
              class="form-control form-control-sm"
              placeholder="Descripción opcional para el operador"
            />
          </div>

          <!-- Botones de acción del formulario -->
          <div class="col-12 d-flex gap-2 align-items-center">
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="!new_var_form.key || !new_var_form.group || new_var_saving"
              @click="save_new_var"
            >
              {{ new_var_saving ? 'Guardando...' : 'Crear variable' }}
            </button>
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm"
              @click="cancel_new_var"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Contenido principal: grupos de variables -->
    <template v-else>
      <!-- Itera por grupo: app, db, mail, pusher, misc -->
      <div
        v-for="group_name in group_names"
        :key="group_name"
        class="card mb-4"
      >
        <div class="card-header fw-semibold text-capitalize">
          {{ group_label(group_name) }}
        </div>
        <div class="card-body p-0">
          <table class="table table-sm mb-0">
            <thead class="table-light">
              <tr>
                <th style="width: 200px">Variable</th>
                <th>Valor (template)</th>
                <th style="width: 130px" class="text-center">Común</th>
                <th style="width: 160px" class="text-center">Manual al crear</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="tpl in vars_by_group[group_name]"
                :key="tpl.id"
              >
                <!-- Nombre de la variable (solo lectura) -->
                <td class="align-middle">
                  <code class="small">{{ tpl.key }}</code>
                </td>

                <!-- Campo de texto para el valor del template -->
                <td class="align-middle">
                  <input
                    v-model="drafts[tpl.id].value"
                    type="text"
                    class="form-control form-control-sm"
                    :placeholder="tpl.key === 'APP_KEY' ? 'Se genera por sistema' : ''"
                  />
                </td>

                <!-- Checkbox: es variable común (se contrasta al actualizar) -->
                <td class="align-middle text-center">
                  <div class="form-check d-flex justify-content-center mb-0">
                    <input
                      v-model="drafts[tpl.id].is_common"
                      type="checkbox"
                      class="form-check-input"
                      :id="'common-' + tpl.id"
                      :title="'Contraste al actualizar clientes: ' + tpl.key"
                    />
                  </div>
                </td>

                <!-- Checkbox: es manual al crear (recordatorio en alta de sistema) -->
                <td class="align-middle text-center">
                  <div class="form-check d-flex justify-content-center mb-0">
                    <input
                      v-model="drafts[tpl.id].is_manual_on_create"
                      type="checkbox"
                      class="form-check-input"
                      :id="'manual-' + tpl.id"
                      :title="'Recordatorio al dar de alta un sistema nuevo: ' + tpl.key"
                    />
                  </div>
                </td>

                <!-- Textarea para notas internas del operador -->
                <td class="align-middle">
                  <textarea
                    v-model="drafts[tpl.id].notes"
                    class="form-control form-control-sm"
                    rows="1"
                    :placeholder="'Notas para ' + tpl.key"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Sección colapsable: recordatorio para sistemas nuevos -->
      <div class="card mt-4">
        <div class="card-header">
          <button
            type="button"
            class="btn btn-link p-0 text-decoration-none fw-semibold text-dark"
            @click="show_manual_reminder = !show_manual_reminder"
          >
            <i
              class="bi me-2"
              :class="show_manual_reminder ? 'bi-chevron-up' : 'bi-chevron-down'"
            />
            Recordatorio para sistemas nuevos
            <span class="badge bg-secondary ms-2">{{ manual_vars.length }}</span>
          </button>
        </div>
        <div v-if="show_manual_reminder" class="card-body">
          <p class="text-muted small mb-3">
            Al dar de alta un sistema nuevo, recordar configurar manualmente las siguientes variables:
          </p>
          <ul class="list-group list-group-flush">
            <li
              v-for="tpl in manual_vars"
              :key="'manual-reminder-' + tpl.id"
              class="list-group-item px-0"
            >
              <div class="d-flex align-items-start gap-3">
                <code class="fw-bold">{{ tpl.key }}</code>
                <span v-if="drafts[tpl.id] && drafts[tpl.id].notes" class="text-muted small">
                  {{ drafts[tpl.id].notes }}
                </span>
              </div>
            </li>
          </ul>
          <p v-if="manual_vars.length === 0" class="text-muted small mb-0">
            No hay variables marcadas como "Manual al crear" todavía.
          </p>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import api from '@/utils/axios'

/**
 * Pantalla de gestión de la plantilla base .env del sistema.
 *
 * Muestra las variables agrupadas por grupo funcional (app, db, mail, pusher, misc).
 * Permite editar el valor, marcado de is_common e is_manual_on_create, y notas de cada variable.
 * El botón "Guardar" llama a POST /env-template/bulk-update con todos los drafts.
 * Al pie, sección colapsable con las variables marcadas como is_manual_on_create.
 */
export default {
  name: 'ViewEnvTemplate',

  data() {
    return {
      /** Lista completa de variables cargadas desde el backend. */
      templates: [],

      /**
       * Drafts editables indexados por ID de variable.
       * Cada draft tiene: value, is_common, is_manual_on_create, notes, group, sort_order.
       */
      drafts: {},

      /** true mientras se carga la lista inicial desde el backend. */
      loading: false,

      /** Mensaje de error si falla la carga inicial. */
      load_error: null,

      /** true mientras se ejecuta el guardado masivo. */
      saving: false,

      /** Controla la visibilidad de la sección colapsable de recordatorios. */
      show_manual_reminder: false,

      /** Orden fijo de grupos para presentación consistente en la UI. */
      group_order: ['app', 'db', 'mail', 'pusher', 'misc'],

      /** Controla la visibilidad del formulario para agregar una nueva variable. */
      show_new_var_form: false,

      /** true cuando el admin eligió crear un grupo nuevo en lugar de usar uno existente. */
      new_var_custom_group: false,

      /** true mientras se está enviando la solicitud de creación al backend. */
      new_var_saving: false,

      /** Mensaje de error del backend para el formulario de nueva variable (null = sin error). */
      new_var_error: null,

      /** Campos del formulario de nueva variable con valores por defecto. */
      new_var_form: {
        key:                  '',
        group:                '',
        value:                '',
        is_common:            false,
        is_manual_on_create:  false,
        notes:                '',
        sort_order:           99,
      },
    }
  },

  computed: {
    /**
     * Lista de grupos presentes en los templates, respetando el orden definido.
     * Si hay grupos no previstos en group_order, se agregan al final.
     *
     * @returns {string[]}
     */
    group_names() {
      const present = new Set()
      this.templates.forEach(function (tpl) {
        if (tpl.group) {
          present.add(tpl.group)
        }
      })
      const ordered = []
      this.group_order.forEach(function (g) {
        if (present.has(g)) {
          ordered.push(g)
        }
      })
      present.forEach(function (g) {
        if (!ordered.includes(g)) {
          ordered.push(g)
        }
      })
      return ordered
    },

    /**
     * Variables agrupadas por nombre de grupo, en el orden de sort_order original.
     *
     * @returns {Record<string, Array>}
     */
    vars_by_group() {
      const groups = {}
      this.templates.forEach(function (tpl) {
        const g = tpl.group || 'misc'
        if (!groups[g]) {
          groups[g] = []
        }
        groups[g].push(tpl)
      })
      return groups
    },

    /**
     * Variables marcadas como is_manual_on_create (usando el draft actualizado).
     *
     * @returns {Array}
     */
    manual_vars() {
      const self = this
      return this.templates.filter(function (tpl) {
        const draft = self.drafts[tpl.id]
        return draft && draft.is_manual_on_create
      })
    },
  },

  mounted() {
    this.load_templates()
  },

  methods: {
    /**
     * Carga la lista de variables del template desde el backend.
     *
     * @returns {void}
     */
    load_templates() {
      const self = this
      self.loading = true
      self.load_error = null

      api.get('/env-template').then(function (res) {
        const templates = res.data.models || []
        self.templates = templates
        /* Inicializa drafts editables por ID para que Vue pueda rastrear los cambios. */
        const drafts = {}
        templates.forEach(function (tpl) {
          drafts[tpl.id] = {
            id:                   tpl.id,
            value:                tpl.value || '',
            is_common:            !!tpl.is_common,
            is_manual_on_create:  !!tpl.is_manual_on_create,
            notes:                tpl.notes || '',
            group:                tpl.group || '',
            sort_order:           tpl.sort_order || 0,
          }
        })
        self.drafts = drafts
        self.loading = false
      }).catch(function () {
        self.load_error = 'No se pudo cargar la plantilla. Intentá de nuevo.'
        self.loading = false
      })
    },

    /**
     * Envía todos los drafts al backend para actualización masiva.
     *
     * @returns {void}
     */
    save() {
      const self = this
      self.saving = true

      /* Construye el array de items a enviar desde los drafts. */
      const items = Object.values(self.drafts)

      api.post('/env-template/bulk-update', { items: items }).then(function (res) {
        const templates = res.data.models || []
        self.templates = templates

        /* Actualiza los drafts con los valores confirmados por el backend. */
        const drafts = {}
        templates.forEach(function (tpl) {
          drafts[tpl.id] = {
            id:                   tpl.id,
            value:                tpl.value || '',
            is_common:            !!tpl.is_common,
            is_manual_on_create:  !!tpl.is_manual_on_create,
            notes:                tpl.notes || '',
            group:                tpl.group || '',
            sort_order:           tpl.sort_order || 0,
          }
        })
        self.drafts = drafts
        self.saving = false

        /* Notifica al usuario con toast de éxito. */
        window.dispatchEvent(new CustomEvent('admin-spa-toast', {
          detail: { message: 'Plantilla .env guardada correctamente.', variant: 'success' },
        }))
      }).catch(function () {
        self.saving = false
      })
    },

    /**
     * Devuelve un label legible para cada grupo funcional.
     *
     * @param {string} group_name  Clave interna del grupo.
     * @returns {string}  Etiqueta para mostrar en el header de la card.
     */
    group_label(group_name) {
      const labels = {
        app:    'App (configuración base)',
        db:     'Base de datos',
        mail:   'Correo (Mail)',
        pusher: 'Pusher (WebSockets)',
        misc:   'Misc (queue, caché, sesión)',
      }
      return labels[group_name] || group_name
    },

    /**
     * Envía el formulario de nueva variable al backend vía POST /env-template.
     *
     * En caso de éxito, recarga la lista completa de templates (el backend la devuelve),
     * reconstruye los drafts, cierra el formulario y muestra un toast de éxito.
     * En caso de error 422 (validación), muestra el primer mensaje del backend en el formulario.
     *
     * @returns {void}
     */
    save_new_var() {
      const self = this
      self.new_var_error = null
      self.new_var_saving = true

      api.post('/env-template', self.new_var_form).then(function (res) {
        /* Actualiza la lista de templates con la respuesta del backend. */
        const templates = res.data.models || []
        self.templates = templates

        /* Reconstruye los drafts con la lista actualizada (incluye la nueva variable). */
        const drafts = {}
        templates.forEach(function (tpl) {
          drafts[tpl.id] = {
            id:                   tpl.id,
            value:                tpl.value || '',
            is_common:            !!tpl.is_common,
            is_manual_on_create:  !!tpl.is_manual_on_create,
            notes:                tpl.notes || '',
            group:                tpl.group || '',
            sort_order:           tpl.sort_order || 0,
          }
        })
        self.drafts = drafts

        self.cancel_new_var()
        self.new_var_saving = false

        window.dispatchEvent(new CustomEvent('admin-spa-toast', {
          detail: { message: 'Variable creada correctamente.', variant: 'success' },
        }))
      }).catch(function (err) {
        self.new_var_saving = false

        /* Extrae el primer mensaje de error de validación (422) o muestra error genérico. */
        const errors = err && err.response && err.response.data && err.response.data.errors
        if (errors) {
          const first_key = Object.keys(errors)[0]
          self.new_var_error = errors[first_key][0]
        } else {
          self.new_var_error = 'No se pudo crear la variable. Intentá de nuevo.'
        }
      })
    },

    /**
     * Cancela el formulario de nueva variable y resetea todos sus campos al estado inicial.
     *
     * @returns {void}
     */
    cancel_new_var() {
      const self = this
      self.show_new_var_form = false
      self.new_var_custom_group = false
      self.new_var_error = null
      self.new_var_form = {
        key:                  '',
        group:                '',
        value:                '',
        is_common:            false,
        is_manual_on_create:  false,
        notes:                '',
        sort_order:           99,
      }
    },
  },
}
</script>
