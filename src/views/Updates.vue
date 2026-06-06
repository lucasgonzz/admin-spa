<template>
  <div>
  <resource-view
    model_name="update"
    :model_extra_tabs="model_extra_tabs"
    :before_create_hook="before_create_hook"
    @extra-record-updated="on_record_updated"
  />

  <!-- Modal: variables .env con valores distintos al template base -->
  <base-modal
    :show="show_env_diff_modal"
    title="Variables de .env con valores distintos al template"
    size="lg"
    :stack_level="1"
    @update:show="on_env_diff_modal_show_update"
    @close="on_env_diff_modal_cancelled"
  >
    <p class="text-muted small mb-3">
      Las siguientes variables del cliente tienen valores distintos al template base.
      ¿Querés actualizarlas con los valores del template antes de continuar?
    </p>

    <!-- Tabla de diferencias -->
    <table class="table table-sm mb-3">
      <thead class="table-light">
        <tr>
          <th style="width: 40px"></th>
          <th>Variable</th>
          <th>Template</th>
          <th>Cliente actual</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="diff in env_diffs"
          :key="diff.key"
        >
          <!-- Checkbox para seleccionar cuáles actualizar -->
          <td class="align-middle text-center">
            <input
              v-model="env_diff_selected_keys[diff.key]"
              type="checkbox"
              class="form-check-input"
              :id="'env-diff-key-' + diff.key"
            />
          </td>
          <td class="align-middle">
            <code>{{ diff.key }}</code>
          </td>
          <!-- Valor en el template base -->
          <td class="align-middle">
            <span v-if="diff.template_value" class="text-success small font-monospace">
              {{ diff.template_value }}
            </span>
            <span v-else class="text-muted small fst-italic">(vacío)</span>
          </td>
          <!-- Valor actual en el cliente -->
          <td class="align-middle">
            <span v-if="diff.client_value" class="text-danger small font-monospace">
              {{ diff.client_value }}
            </span>
            <span v-else class="text-muted small fst-italic">(no existe)</span>
          </td>
        </tr>
      </tbody>
    </table>

    <template #footer>
      <div class="d-flex w-100 gap-2 flex-wrap align-items-center">
        <!-- Botón: omitir correcciones y continuar con la creación del upgrade -->
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="applying_env_diff"
          @click="on_env_diff_skip"
        >
          Omitir y continuar
        </button>
        <div class="ms-auto d-flex gap-2">
          <!-- Botón: cancelar la creación del upgrade -->
          <button
            type="button"
            class="btn btn-outline-secondary"
            :disabled="applying_env_diff"
            @click="on_env_diff_modal_cancelled"
          >
            Cancelar
          </button>
          <!-- Botón: aplicar variables seleccionadas y luego crear el upgrade -->
          <button
            type="button"
            class="btn btn-primary"
            :disabled="applying_env_diff || selected_diff_keys.length === 0"
            @click="on_env_diff_apply"
          >
            {{ applying_env_diff ? 'Actualizando...' : 'Actualizar seleccionadas y continuar' }}
          </button>
        </div>
      </div>
    </template>
  </base-modal>
  </div>
</template>

<script>
import { markRaw } from 'vue'
import ResourceView from '@/common-vue/components/view/Index.vue'
import UpdateExtraProps from '@/components/update/extra-props/Index.vue'
import BaseModal from '@/components/ui/BaseModal.vue'
import api from '@/utils/axios'

/**
 * Pestaña extra del modal de actualizaciones (pasos, seeders, comandos, etc.).
 */
const update_model_extra_tabs = [
  {
    key: 'operations',
    label: 'Operaciones',
    component: markRaw(UpdateExtraProps),
  },
]

export default {
  name: 'ViewUpdates',
  components: { ResourceView, UpdateExtraProps, BaseModal },
  data() {
    return {
      /** Pestañas del modal CRUD además del grupo Básico del meta. */
      model_extra_tabs: update_model_extra_tabs,

      /** Controla la visibilidad del modal de diferencias .env. */
      show_env_diff_modal: false,

      /** Lista de diferencias detectadas entre el template y el .env del cliente. */
      env_diffs: [],

      /**
       * Estado de selección de cada key en el modal de diff.
       * Estructura: { KEY: true|false }
       */
      env_diff_selected_keys: {},

      /** true mientras se ejecuta el apply_diff al backend. */
      applying_env_diff: false,

      /**
       * Resolver de la Promise del hook before_create.
       * Al llamarlo, se permite continuar con la creación del upgrade.
       *
       * @type {Function|null}
       */
      env_diff_resolve: null,

      /**
       * Rejecter de la Promise del hook before_create.
       * Al llamarlo, se cancela la creación del upgrade.
       *
       * @type {Function|null}
       */
      env_diff_reject: null,

      /**
       * Datos del draft del update en curso (necesarios para apply_diff).
       * Se asigna al ejecutar el hook before_create.
       *
       * @type {Object|null}
       */
      env_diff_pending_draft: null,
    }
  },
  computed: {
    /**
     * Lista de keys seleccionadas para actualizar en el .env del cliente.
     *
     * @returns {string[]}
     */
    selected_diff_keys() {
      const keys = []
      const selected = this.env_diff_selected_keys
      Object.keys(selected).forEach(function (key) {
        if (selected[key]) {
          keys.push(key)
        }
      })
      return keys
    },
  },
  methods: {
    /**
     * Sincroniza en la tabla los cambios devueltos por acciones de la pestaña Operaciones.
     *
     * @param {Object} model  ClientVersionUpgrade actualizado en backend.
     * @returns {void}
     */
    on_record_updated(model) {
      this.$store.dispatch('update/upsert_model_in_lists', model)
    },

    /**
     * Hook before_create para el ResourceView/ModelModal de updates.
     *
     * Se ejecuta antes de crear un ClientVersionUpgrade (POST /update).
     * Verifica si hay variables .env del cliente que difieren del template base.
     *
     * Flujo:
     * 1. Si no hay client_id o target_client_api_id → resuelve inmediatamente.
     * 2. Llama al backend para detectar diffs SSH.
     * 3. Si hay error SSH → muestra warning toast y resuelve (no bloqueante).
     * 4. Si hay diffs → muestra modal con opciones.
     * 5. Si no hay diffs → resuelve inmediatamente.
     *
     * @param {Object} payload  Datos del formulario del upgrade (draft serializado).
     * @returns {Promise<void>}
     */
    before_create_hook(payload) {
      const self = this

      /* Sin client_id o target_client_api_id, no hay nada que comparar. */
      const client_id     = payload.client_id
      const client_api_id = payload.target_client_api_id

      if (!client_id || !client_api_id) {
        return Promise.resolve()
      }

      return new Promise(function (resolve, reject) {
        /* Llama al backend para detectar diferencias entre el template y el .env del cliente. */
        api.post('/env-template/check-diff/' + client_id, { client_api_id: client_api_id })
          .then(function (res) {
            const data = res.data

            /* Si hay error SSH: mostrar warning y dejar continuar sin bloquear. */
            if (data.error) {
              window.dispatchEvent(new CustomEvent('admin-spa-toast', {
                detail: {
                  message: 'No se pudo leer el .env del cliente: ' + data.error + '. Podés crear la actualización igual.',
                  variant: 'warning',
                },
              }))
              resolve()
              return
            }

            /* Sin diferencias: continuar directamente con la creación. */
            if (!data.diffs || data.diffs.length === 0) {
              resolve()
              return
            }

            /* Hay diferencias: mostrar modal para que el operador decida qué actualizar. */
            self.env_diffs = data.diffs

            /* Por defecto, todas las keys están seleccionadas. */
            const selected = {}
            data.diffs.forEach(function (d) {
              selected[d.key] = true
            })
            self.env_diff_selected_keys = selected

            /* Guarda el draft para usarlo en apply_diff (necesita client_id y client_api_id). */
            self.env_diff_pending_draft = payload

            /* Guarda los callbacks para resolver/rechazar desde los botones del modal. */
            self.env_diff_resolve = resolve
            self.env_diff_reject  = reject

            /* Abre el modal de diferencias. */
            self.show_env_diff_modal = true
          })
          .catch(function () {
            /* Error de red inesperado: continuar sin bloquear (el interceptor ya mostró toast). */
            resolve()
          })
      })
    },

    /**
     * Maneja la actualización del v-model del show del modal de diff.
     * Si el modal se cierra sin decisión explícita, cancela la creación.
     *
     * @param {boolean} val  Nuevo valor de visibilidad.
     * @returns {void}
     */
    on_env_diff_modal_show_update(val) {
      if (!val) {
        this.on_env_diff_modal_cancelled()
      }
    },

    /**
     * El operador cerró el modal sin confirmar: cancela la creación del upgrade.
     *
     * @returns {void}
     */
    on_env_diff_modal_cancelled() {
      if (typeof this.env_diff_reject === 'function') {
        this.env_diff_reject()
      }
      this.close_env_diff_modal()
    },

    /**
     * "Omitir y continuar": crea el upgrade sin modificar el .env del cliente.
     *
     * @returns {void}
     */
    on_env_diff_skip() {
      if (typeof this.env_diff_resolve === 'function') {
        this.env_diff_resolve()
      }
      this.close_env_diff_modal()
    },

    /**
     * "Actualizar seleccionadas y continuar": aplica las keys seleccionadas al .env
     * del cliente vía SSH y luego resuelve el hook para continuar con la creación.
     *
     * @returns {void}
     */
    on_env_diff_apply() {
      const self = this
      const keys_to_update = this.selected_diff_keys

      if (keys_to_update.length === 0) {
        return
      }

      const client_id     = this.env_diff_pending_draft && this.env_diff_pending_draft.client_id
      const client_api_id = this.env_diff_pending_draft && this.env_diff_pending_draft.target_client_api_id

      if (!client_id || !client_api_id) {
        if (typeof self.env_diff_resolve === 'function') {
          self.env_diff_resolve()
        }
        self.close_env_diff_modal()
        return
      }

      self.applying_env_diff = true

      /* Llama al backend para aplicar las variables seleccionadas al .env del cliente. */
      api.post('/env-template/apply-diff/' + client_id, {
        client_api_id: client_api_id,
        keys:          keys_to_update,
      }).then(function () {
        self.applying_env_diff = false

        window.dispatchEvent(new CustomEvent('admin-spa-toast', {
          detail: {
            message: 'Variables .env actualizadas correctamente en el cliente.',
            variant: 'success',
          },
        }))

        if (typeof self.env_diff_resolve === 'function') {
          self.env_diff_resolve()
        }
        self.close_env_diff_modal()
      }).catch(function () {
        /* Error en apply_diff: el interceptor de axios ya mostró el toast de error. */
        self.applying_env_diff = false
      })
    },

    /**
     * Limpia el estado del modal de diff y lo cierra.
     *
     * @returns {void}
     */
    close_env_diff_modal() {
      this.show_env_diff_modal     = false
      this.env_diffs               = []
      this.env_diff_selected_keys  = {}
      this.env_diff_resolve        = null
      this.env_diff_reject         = null
      this.env_diff_pending_draft  = null
      this.applying_env_diff       = false
    },
  },
}
</script>
