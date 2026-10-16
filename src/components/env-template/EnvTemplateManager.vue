<template>
  <div class="container-fluid px-0 py-4">
    <div class="d-flex align-items-center mb-4 gap-3">
      <h2 class="h4 mb-0">{{ title }}</h2>
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
            <!--
              Si el nombre tipeado matchea la regla de variable sensible (KEY, SECRET, TOKEN...),
              el input pasa a type="password": lo que se escribe no queda a la vista. La regla acá
              es un espejo solo para decidir el tipo de input; el servidor la revalida.
            -->
            <input
              v-model="new_var_form.value"
              :type="new_var_es_sensible ? 'password' : 'text'"
              :autocomplete="new_var_es_sensible ? 'new-password' : 'off'"
              class="form-control form-control-sm"
              placeholder="Dejar vacío si se completará manualmente"
            />
            <div v-if="new_var_es_sensible" class="form-text">
              <i class="bi bi-lock-fill me-1" />
              Variable secreta: se guarda cifrada y después no se puede volver a ver.
            </div>
          </div>

          <!--
            Checkboxes: is_common e is_manual_on_create.
            "Manual al crear" solo aplica al scope empresa: en tienda ninguna variable
            usa ese flujo de recordatorio (el seeder las siembra todas en false).
          -->
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
            <div v-if="scope === 'empresa'" class="form-check">
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
          <!--
            table-responsive: en tablet y teléfono la tabla scrollea dentro de la card y no
            ensancha la página entera.
          -->
          <div class="table-responsive">
          <table class="table table-sm mb-0">
            <thead class="table-light">
              <tr>
                <th style="width: 200px">Variable</th>
                <th style="min-width: 260px">Valor (template)</th>
                <th style="width: 130px" class="text-center">Común</th>
                <!-- Columna "Manual al crear": no aplica al scope tienda -->
                <th v-if="scope === 'empresa'" style="width: 160px" class="text-center">Manual al crear</th>
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
                  <!-- Etiqueta de variable secreta: el servidor nunca manda su valor -->
                  <span
                    v-if="es_sensible(tpl)"
                    class="badge bg-secondary-subtle text-secondary-emphasis ms-1"
                    title="Variable secreta: se guarda cifrada y no se puede volver a ver"
                  >
                    <i class="bi bi-lock-fill me-1" />secreta
                  </span>
                </td>

                <!--
                  Campo de texto para el valor del template.
                  En scope tienda, si la variable no es común (is_common = false), la
                  completa sola la instalación (a partir del dominio o del .env de
                  empresa del cliente): se muestra un badge informativo y el placeholder
                  pasa a ser la nota de la variable, sin deshabilitar el input.
                -->
                <td class="align-middle">
                  <span
                    v-if="scope === 'tienda' && !drafts[tpl.id].is_common"
                    class="badge bg-secondary-subtle text-secondary-emphasis mb-1 d-inline-block"
                  >
                    La completa la instalación
                  </span>
                  <!--
                    Fila secreta: el input arranca vacío (el servidor no manda el valor) y es
                    type="password". Solo se manda `value` al guardar si se escribió algo; vacío
                    significa "no tocar". "Borrar" marca la variable para vaciarse al guardar.
                  -->
                  <div v-if="es_sensible(tpl)">
                    <div class="d-flex flex-wrap gap-1">
                      <input
                        v-model="drafts[tpl.id].value"
                        type="password"
                        autocomplete="new-password"
                        class="form-control form-control-sm flex-grow-1"
                        style="min-width: 160px; width: auto"
                        :disabled="drafts[tpl.id].clear_value"
                        :placeholder="value_placeholder(tpl)"
                      />
                      <!-- Borrar: solo si hay un valor cargado; se aplica recién al guardar -->
                      <button
                        v-if="tpl.value_set"
                        type="button"
                        class="btn btn-sm"
                        :class="drafts[tpl.id].clear_value ? 'btn-danger' : 'btn-outline-danger'"
                        :title="drafts[tpl.id].clear_value ? 'Deshacer el borrado' : 'Borrar el valor al guardar'"
                        @click="toggle_clear_value(tpl)"
                      >
                        <i class="bi bi-trash me-1" />{{ drafts[tpl.id].clear_value ? 'Se borra al guardar' : 'Borrar' }}
                      </button>
                      <!-- Probar: solo ANTHROPIC_API_KEY del scope empresa; prueba la clave GUARDADA -->
                      <button
                        v-if="can_probe(tpl)"
                        type="button"
                        class="btn btn-sm btn-outline-primary"
                        :disabled="probes[tpl.id] && probes[tpl.id].loading"
                        @click="probar_clave(tpl)"
                      >
                        <span
                          v-if="probes[tpl.id] && probes[tpl.id].loading"
                          class="spinner-border spinner-border-sm me-1"
                          role="status"
                          aria-hidden="true"
                        />
                        <i v-else class="bi bi-shield-check me-1" />
                        {{ probes[tpl.id] && probes[tpl.id].loading ? 'Probando...' : 'Probar' }}
                      </button>
                    </div>
                    <!-- Aviso: lo escrito y sin guardar no se prueba -->
                    <div
                      v-if="can_probe(tpl) && drafts[tpl.id].value"
                      class="form-text text-warning-emphasis"
                    >
                      Probar usa la clave guardada, no la que escribiste: guardá primero para probar la nueva.
                    </div>
                    <!-- Resultado de la última prueba -->
                    <div
                      v-if="probes[tpl.id] && probes[tpl.id].result"
                      class="small mt-1 text-break"
                      :class="'text-' + probe_color(probes[tpl.id].result.estado)"
                    >
                      <strong>{{ probe_label(probes[tpl.id].result.estado) }}</strong>
                      <span v-if="probes[tpl.id].result.mensaje"> — {{ probes[tpl.id].result.mensaje }}</span>
                    </div>
                  </div>
                  <!-- Fila común: se edita el valor tal cual, como siempre -->
                  <input
                    v-else
                    v-model="drafts[tpl.id].value"
                    type="text"
                    class="form-control form-control-sm"
                    :placeholder="value_placeholder(tpl)"
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

                <!-- Checkbox: es manual al crear (recordatorio en alta de sistema); no aplica a tienda -->
                <td v-if="scope === 'empresa'" class="align-middle text-center">
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
      </div>

      <!-- Sección colapsable: recordatorio para sistemas nuevos (solo scope empresa) -->
      <div v-if="scope === 'empresa'" class="card mt-4">
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
 * Componente reutilizable de gestión de la plantilla base .env de un sistema.
 *
 * Extraído de la ex vista única `views/EnvTemplate/Index.vue` (Grupo 190, Prompt 02)
 * para soportar dos scopes: `empresa` (plantilla de empresa-api, comportamiento
 * original sin cambios) y `tienda` (plantilla de tienda-api, con diferencias de UI:
 * sin columna/checkbox "Manual al crear" ni sección de recordatorio, y con badge
 * informativo en las variables que completa sola la instalación).
 *
 * Muestra las variables agrupadas por grupo funcional (app, db, mail, pusher, misc).
 * Permite editar el valor, marcado de is_common (y is_manual_on_create en empresa), y notas.
 * El botón "Guardar" llama a POST /env-template/bulk-update con todos los drafts.
 *
 * Variables secretas (claves, tokens, contraseñas): el servidor NO manda su valor; manda
 * `value_sensitive`, `value_set` y `value_tail` (últimos 4 caracteres, si es largo). El input
 * arranca vacío y solo se manda `value` si el operador escribió algo (vacío = "no tocar");
 * `clear_value: true` vacía la variable a propósito. ANTHROPIC_API_KEY (scope empresa) tiene
 * además un botón "Probar" que valida la clave guardada contra el proveedor.
 */
export default {
  name: 'EnvTemplateManager',

  props: {
    /** Scope de la plantilla a gestionar: 'empresa' (sistema) o 'tienda' (ecommerce). */
    scope: {
      type: String,
      required: true,
      validator: function (value) {
        return value === 'empresa' || value === 'tienda'
      },
    },
    /** Título mostrado en el encabezado de la pantalla. */
    title: {
      type: String,
      required: true,
    },
  },

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

      /**
       * Estado de las pruebas de clave por ID de variable:
       * { [id]: { loading: bool, result: { estado, mensaje, http } | null } }.
       */
      probes: {},

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
     * true si el nombre tipeado en el alta de variable nueva matchea la regla de variable
     * sensible. Solo decide el tipo del input de valor.
     *
     * @returns {boolean}
     */
    new_var_es_sensible() {
      return this.nombre_es_sensible(this.new_var_form.key)
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
     * Solo tiene sentido en scope empresa; en tienda no se usa (la sección está oculta).
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
     * Regla espejo de "variable sensible" del servidor: el nombre contiene KEY, SECRET,
     * PASSWORD, PASS, TOKEN, DSN o CREDENTIAL, o es uno de los nombres exactos listados.
     * Solo se usa para decidir el tipo de input del alta nueva; el servidor la revalida.
     *
     * @param {string} key  Nombre de la variable (se compara sin distinguir mayúsculas).
     * @returns {boolean}
     */
    nombre_es_sensible(key) {
      const nombre = String(key || '').toUpperCase()
      if (nombre === '') {
        return false
      }
      const nombres_exactos = ['DATABASE_URL', 'DB_URL', 'REDIS_URL', 'MAIL_URL', 'QUEUE_URL', 'MAIL_USERNAME']
      if (nombres_exactos.indexOf(nombre) !== -1) {
        return true
      }
      const fragmentos = ['KEY', 'SECRET', 'PASSWORD', 'PASS', 'TOKEN', 'DSN', 'CREDENTIAL']
      return fragmentos.some(function (fragmento) {
        return nombre.indexOf(fragmento) !== -1
      })
    },

    /**
     * ¿La fila es secreta? Lo dice el servidor con `value_sensitive` (la SPA no decide).
     *
     * @param {Object} tpl Variable de template.
     * @returns {boolean}
     */
    es_sensible(tpl) {
      return !!(tpl && tpl.value_sensitive)
    },

    /**
     * Arma el draft editable de una variable a partir de lo que devolvió el servidor.
     *
     * Para una fila secreta el valor SIEMPRE arranca vacío ('' = "no tocar"): el servidor no
     * manda `value` y no hay nada que mostrar. `clear_value` queda en false hasta que el
     * operador toque "Borrar".
     *
     * @param {Object} tpl Variable de template devuelta por el backend.
     * @returns {Object}
     */
    build_draft(tpl) {
      return {
        id:                   tpl.id,
        value:                tpl.value_sensitive ? '' : (tpl.value || ''),
        clear_value:          false,
        is_common:            !!tpl.is_common,
        is_manual_on_create:  !!tpl.is_manual_on_create,
        notes:                tpl.notes || '',
        group:                tpl.group || '',
        sort_order:           tpl.sort_order || 0,
      }
    },

    /**
     * Arma el mapa de drafts por ID desde la lista de variables del backend.
     * Único punto que reconstruye drafts (carga, guardado masivo y alta de variable).
     *
     * @param {Array} templates Variables devueltas por el backend.
     * @returns {Record<number, Object>}
     */
    build_drafts(templates) {
      const self = this
      const drafts = {}
      templates.forEach(function (tpl) {
        drafts[tpl.id] = self.build_draft(tpl)
      })
      return drafts
    },

    /**
     * Arma los items de POST /env-template/bulk-update desde los drafts.
     *
     * Reglas para una fila secreta (según el estado del servidor, no del draft):
     *  - "Borrar" marcado: manda `clear_value: true` y NO manda `value`.
     *  - Escribió algo: manda `value` con lo escrito, tal cual.
     *  - No escribió nada: omite `value` (el servidor lo toma como "no tocar").
     * Una fila común manda `value` como siempre.
     *
     * @returns {Array<Object>}
     */
    build_items() {
      const self = this
      return self.templates.map(function (tpl) {
        const draft = self.drafts[tpl.id]
        const item = {
          id:                   draft.id,
          is_common:            draft.is_common,
          is_manual_on_create:  draft.is_manual_on_create,
          notes:                draft.notes,
          group:                draft.group,
          sort_order:           draft.sort_order,
        }
        if (!self.es_sensible(tpl)) {
          item.value = draft.value
        } else if (draft.clear_value) {
          item.clear_value = true
        } else if (draft.value && draft.value.trim() !== '') {
          item.value = draft.value
        }
        return item
      })
    },

    /**
     * Marca o desmarca "Borrar" en una fila secreta. Al marcar se descarta lo escrito.
     * El borrado recién se aplica al presionar "Guardar".
     *
     * @param {Object} tpl Variable de template.
     * @returns {void}
     */
    toggle_clear_value(tpl) {
      const draft = this.drafts[tpl.id]
      draft.clear_value = !draft.clear_value
      if (draft.clear_value) {
        draft.value = ''
      }
    },

    /**
     * ¿Esta fila tiene botón "Probar"? Hoy solo ANTHROPIC_API_KEY del scope empresa.
     *
     * @param {Object} tpl Variable de template.
     * @returns {boolean}
     */
    can_probe(tpl) {
      return this.scope === 'empresa' && tpl.key === 'ANTHROPIC_API_KEY'
    },

    /**
     * Prueba la clave GUARDADA de una variable contra el proveedor
     * (POST /env-template/probar-clave) y deja el resultado en `probes`.
     * Nunca se manda la clave: solo el nombre y el scope.
     *
     * @param {Object} tpl Variable de template.
     * @returns {void}
     */
    probar_clave(tpl) {
      const self = this
      self.probes = Object.assign({}, self.probes, { [tpl.id]: { loading: true, result: null } })

      api.post('/env-template/probar-clave', { key: tpl.key, scope: self.scope }).then(function (res) {
        self.probes = Object.assign({}, self.probes, { [tpl.id]: { loading: false, result: res.data } })
      }).catch(function (err) {
        /* Error de red o del servidor: se muestra como prueba no concluyente, sin datos sensibles. */
        const mensaje = err && err.response && err.response.data && err.response.data.message
        self.probes = Object.assign({}, self.probes, {
          [tpl.id]: {
            loading: false,
            result: { estado: 'no_concluyente', mensaje: mensaje || 'No se pudo hacer la prueba. Intentá de nuevo.' },
          },
        })
      })
    },

    /**
     * Color de Bootstrap (text-*) para el estado devuelto por probar-clave.
     *
     * @param {string} estado valida | rechazada | no_concluyente | no_soportada | sin_valor
     * @returns {string}
     */
    probe_color(estado) {
      const colores = {
        valida:         'success',
        rechazada:      'danger',
        no_concluyente: 'warning-emphasis',
        no_soportada:   'secondary',
        sin_valor:      'secondary',
      }
      return colores[estado] || 'secondary'
    },

    /**
     * Etiqueta legible para el estado devuelto por probar-clave.
     *
     * @param {string} estado valida | rechazada | no_concluyente | no_soportada | sin_valor
     * @returns {string}
     */
    probe_label(estado) {
      const etiquetas = {
        valida:         'Válida',
        rechazada:      'Rechazada',
        no_concluyente: 'No concluyente',
        no_soportada:   'Sin prueba disponible',
        sin_valor:      'Sin valor cargado',
      }
      return etiquetas[estado] || estado
    },

    /**
     * Carga la lista de variables del template desde el backend, filtradas por scope.
     *
     * @returns {void}
     */
    load_templates() {
      const self = this
      self.loading = true
      self.load_error = null

      api.get('/env-template', { params: { scope: self.scope } }).then(function (res) {
        const templates = res.data.models || []
        self.templates = templates
        /* Inicializa drafts editables por ID para que Vue pueda rastrear los cambios. */
        self.drafts = self.build_drafts(templates)
        self.probes = {}
        self.loading = false
      }).catch(function () {
        self.load_error = 'No se pudo cargar la plantilla. Intentá de nuevo.'
        self.loading = false
      })
    },

    /**
     * Envía todos los drafts al backend para actualización masiva, junto con el scope.
     *
     * @returns {void}
     */
    save() {
      const self = this
      self.saving = true

      /* Construye el array de items a enviar desde los drafts (ver build_items). */
      const items = self.build_items()

      api.post('/env-template/bulk-update', { items: items, scope: self.scope }).then(function (res) {
        const templates = res.data.models || []
        self.templates = templates

        /* Actualiza los drafts con lo confirmado por el backend (las secretas vuelven vacías). */
        self.drafts = self.build_drafts(templates)
        self.probes = {}
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
     * Placeholder del input de valor de una variable.
     *
     * En scope empresa se conserva el caso especial de APP_KEY (se genera por sistema).
     * En scope tienda, las variables no comunes (is_common = false) las completa sola
     * la instalación: el placeholder pasa a ser la nota de la variable, para orientar
     * al operador sobre qué se va a completar ahí.
     *
     * @param {Object} tpl Variable de template.
     * @returns {string}
     */
    value_placeholder(tpl) {
      /* Fila secreta: el placeholder cuenta el estado del valor guardado (que nunca se muestra). */
      if (this.es_sensible(tpl)) {
        if (this.drafts[tpl.id].clear_value) {
          return 'Se borrará al guardar'
        }
        if (tpl.value_set) {
          return tpl.value_tail ? 'Cargada, termina en ••••' + tpl.value_tail : 'Cargada'
        }
        return 'Sin cargar'
      }
      if (this.scope === 'tienda' && !this.drafts[tpl.id].is_common) {
        return this.drafts[tpl.id].notes || ''
      }
      if (tpl.key === 'APP_KEY') {
        return 'Se genera por sistema'
      }
      return ''
    },

    /**
     * Envía el formulario de nueva variable al backend vía POST /env-template, con el scope actual.
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

      const payload = Object.assign({}, self.new_var_form, { scope: self.scope })

      /*
        Variable secreta sin valor: no se manda `value` (el servidor la guarda sin valor);
        nunca viaja un '' que pueda interpretarse como pisar algo.
      */
      if (self.nombre_es_sensible(payload.key) && !payload.value) {
        delete payload.value
      }

      api.post('/env-template', payload).then(function (res) {
        /* Actualiza la lista de templates con la respuesta del backend. */
        const templates = res.data.models || []
        self.templates = templates

        /* Reconstruye los drafts con la lista actualizada (incluye la nueva variable). */
        self.drafts = self.build_drafts(templates)
        self.probes = {}

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
