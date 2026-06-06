<template>
  <div class="container-fluid py-4">
    <div class="d-flex align-items-center mb-4 gap-3">
      <h2 class="h4 mb-0">Plantilla base .env</h2>
      <button
        type="button"
        class="btn btn-primary ms-auto"
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
  },
}
</script>
