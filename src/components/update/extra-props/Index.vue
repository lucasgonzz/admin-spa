<template>
  <div>
    <!-- Spinner de carga inicial -->
    <div v-if="loading && !local_update.id" class="d-flex justify-content-center py-4">
      <div class="spinner-border text-primary" role="status"></div>
    </div>

    <template v-else-if="local_update.id">

      <!-- Barra de estado y acciones de flujo (avanzar estado, sincronizar) -->
      <!-- <update-status-actions
        :update="local_update"
        :loading="loading"
        :deploy_loading="deploy_loading"
        @advance-status="advance_status"
        @sync="sync_to_client"
      /> -->

      <!-- Información del upgrade (cliente, versiones, fechas) -->
      <update-info-card :update="local_update" />

      <!-- Tablero principal de operaciones (dos columnas: pre/post cierre) -->
      <operations-board
        :update="local_update"
        :deployment_logs="deployment_logs"
        :deploy_loading="deploy_loading"
        :loading="loading"
        :deployment_loading="deploy_loading || deployment_poll_active"
        @deploy-systems="start_deploy_systems"
        @start-post-closure="start_post_closure"
        @configure-system="configure_system"
        @mark-step="on_mark_step"
        @retry-commands="retry_commands"
        @toggle-skip-seeder="on_toggle_skip_seeder"
        @toggle-skip-command="on_toggle_skip_command"
      />

      <!-- Pestañas secundarias: tareas manuales de versiones y notificaciones -->
      <update-tab-nav
        :tabs="secondary_tabs"
        :active_tab="active_tab"
        @change="active_tab = $event"
      />
      <div class="tab-content p-3 bg-white border border-top-0 rounded-bottom mb-3">
        <tab-manual-tasks
          v-if="active_tab === 'tasks'"
          :items="extra_data.manual_tasks"
        />
        <tab-notifications
          v-else-if="active_tab === 'notifications'"
          :items="extra_data.notifications"
        />
      </div>

    </template>
  </div>
</template>

<script>
import api from '@/utils/axios'
import UpdateStatusActions from './StatusActions.vue'
import UpdateInfoCard from './InfoCard.vue'
import UpdateTabNav from './tabs/Index.vue'
import TabManualTasks from './tabs/ManualTasks.vue'
import TabNotifications from './tabs/Notifications.vue'
import OperationsBoard from './operations/OperationsBoard.vue'

/**
 * Extra-props de una actualización (ClientVersionUpgrade).
 * Se monta dentro del modal de la vista Updates.
 * Carga la versión completa del registro (con seeders, comandos, relaciones)
 * y los datos agregados (notificaciones, tareas manuales) en paralelo.
 * Coordina todas las acciones del tablero de operaciones.
 */
export default {
  name: 'UpdateExtraProps',
  components: {
    UpdateStatusActions,
    UpdateInfoCard,
    UpdateTabNav,
    TabManualTasks,
    TabNotifications,
    OperationsBoard,
  },
  props: {
    /** Borrador del modal (misma referencia que el formulario Básico). */
    draft: { type: Object, default: null },
    /** Fila original de la tabla; fallback si aún no hay draft con id. */
    record: { type: Object, default: null },
  },
  emits: ['record-updated'],
  data() {
    return {
      local_update: this.effective_record_source()
        ? Object.assign({}, this.effective_record_source())
        : {},
      loading: false,
      /* Pestaña secundaria activa (tareas manuales o notificaciones). */
      active_tab: 'tasks',
      extra_data: {
        notifications: [],
        manual_tasks: [],
      },
      /** Carga del POST deploy/start o confirm-crons. */
      deploy_loading: false,
      /** Líneas de log del deployment en curso o último ejecutado. */
      deployment_logs: [],
      /** Intervalo de polling mientras deployment_status === running. */
      deployment_poll_timer: null,
    }
  },
  computed: {
    /**
     * Hay polling activo de logs (deployment en curso en backend).
     *
     * @returns {boolean}
     */
    deployment_poll_active() {
      return this.local_update.deployment_status === 'running'
    },
    /**
     * Pestañas secundarias: tareas manuales de versiones y notificaciones.
     * Seeders, comandos y pasos ya se muestran en el tablero de operaciones.
     *
     * @returns {Array}
     */
    secondary_tabs() {
      return [
        {
          id: 'tasks',
          label: 'Tareas manuales',
          count: this.extra_data.manual_tasks.length,
          has_error: false,
        },
        {
          id: 'notifications',
          label: 'Notificaciones',
          count: this.extra_data.notifications.length,
          has_error: false,
        },
      ]
    },
  },
  watch: {
    draft(val) {
      if (val && val.id) {
        this.local_update = Object.assign({}, val)
        this.load_full_update()
      }
    },
    record(val) {
      if (val && val.id && (!this.draft || !this.draft.id)) {
        this.local_update = Object.assign({}, val)
        this.load_full_update()
      }
    },
  },
  mounted() {
    const src = this.effective_record_source()
    if (src && src.id) {
      this.load_full_update()
    }
  },
  beforeUnmount() {
    this.stop_deployment_poll()
  },
  methods: {
    /**
     * Registro efectivo para cargar operaciones: prioriza el borrador del modal.
     * @returns {Object|null}
     */
    effective_record_source() {
      if (this.draft && this.draft.id) {
        return this.draft
      }
      if (this.record && this.record.id) {
        return this.record
      }
      return null
    },
    /**
     * Carga la versión completa del update (con todas las relaciones) y los datos extra en paralelo.
     * @returns {void}
     */
    load_full_update() {
      const self = this
      const id = self.local_update.id
      self.loading = true
      Promise.all([
        api.get('/update/' + id),
        api.get('/update/' + id + '/extra-data'),
      ])
        .then(function (results) {
          self.local_update = results[0].data.model
          self.extra_data = results[1].data
          self.sync_deployment_logs_from_model(self.local_update)
          self.sync_deployment_poll_from_status()
        })
        .catch(function () {})
        .then(function () {
          self.loading = false
        })
    },
    /**
     * Copia deployment_logs del modelo si vienen en la respuesta fullModel.
     *
     * @param {Object} model
     * @returns {void}
     */
    sync_deployment_logs_from_model(model) {
      if (model && Array.isArray(model.deployment_logs)) {
        this.deployment_logs = model.deployment_logs
      }
    },
    /**
     * Inicia o detiene el polling según deployment_status del upgrade.
     *
     * @returns {void}
     */
    sync_deployment_poll_from_status() {
      if (this.local_update.deployment_status === 'running') {
        this.start_deployment_poll()
      } else {
        this.stop_deployment_poll()
      }
    },
    /**
     * Polling de logs y estado mientras el job corre en admin-api.
     *
     * @returns {void}
     */
    start_deployment_poll() {
      const self = this
      if (self.deployment_poll_timer) {
        return
      }
      self.refresh_deployment_state()
      self.deployment_poll_timer = setInterval(function () {
        self.refresh_deployment_state()
      }, 4000)
    },
    /**
     * Detiene el intervalo de polling de deployment.
     *
     * @returns {void}
     */
    stop_deployment_poll() {
      if (this.deployment_poll_timer) {
        clearInterval(this.deployment_poll_timer)
        this.deployment_poll_timer = null
      }
    },
    /**
     * Actualiza modelo del upgrade y líneas de log del deployment.
     *
     * @returns {void}
     */
    refresh_deployment_state() {
      const self = this
      const id = self.local_update.id
      if (!id) {
        return
      }
      Promise.all([
        api.get('/update/' + id + '/deploy/logs'),
        api.get('/update/' + id),
      ])
        .then(function (results) {
          const logs_payload = results[0].data
          const model_payload = results[1].data
          if (logs_payload && Array.isArray(logs_payload.models)) {
            self.deployment_logs = logs_payload.models
          }
          if (model_payload && model_payload.model) {
            const previous_status = self.local_update.deployment_status
            self.local_update = model_payload.model
            self.sync_deployment_logs_from_model(self.local_update)
            self.$emit('record-updated', model_payload.model)
            if (
              previous_status === 'running' &&
              self.local_update.deployment_status !== 'running'
            ) {
              self.stop_deployment_poll()
              self.deploy_loading = false
            }
          }
        })
        .catch(function () {})
    },
    /**
     * Dispara el pipeline de deployment (SPA build en VPS + subida API/SPA al hosting).
     *
     * @returns {void}
     */
    start_deploy_systems() {
      const self = this
      const version_label = self.local_update.to_version
        ? self.local_update.to_version.version
        : ''
      const message =
        '¿Iniciar actualización de sistemas?\n\n' +
        'Se compilará empresa-spa (tag v' +
        version_label +
        ') en el VPS, se subirá al hosting de la API destino, ' +
        'y se desplegará empresa-api con migraciones, seeders y comandos del upgrade.\n\n' +
        'Requiere credenciales SSH y cola de trabajos configuradas en admin-api.'
      if (!confirm(message)) {
        return
      }
      self.deploy_loading = true
      api
        .post('/update/' + self.local_update.id + '/deploy/start')
        .then(function (res) {
          self.local_update = res.data.model
          self.sync_deployment_logs_from_model(self.local_update)
          self.$emit('record-updated', res.data.model)
          self.sync_deployment_poll_from_status()
        })
        .catch(function (err) {
          const msg =
            err.response && err.response.data && err.response.data.message
              ? err.response.data.message
              : 'No se pudo iniciar el deployment.'
          alert(msg)
        })
        .then(function () {
          if (self.local_update.deployment_status !== 'running') {
            self.deploy_loading = false
          }
        })
    },
    /**
     * Inicia seeders y comandos post-cierre (requiere crons marcados).
     *
     * @returns {void}
     */
    start_post_closure() {
      const self = this
      if (
        !confirm(
          '¿Confirmás que el negocio ya está cerrado?\n\n' +
            'Se ejecutarán los seeders y comandos del upgrade. ' +
            'El cambio de URL/versión por defecto se hará en un paso aparte.'
        )
      ) {
        return
      }
      self.deploy_loading = true
      api
        .post('/update/' + self.local_update.id + '/deploy/start-post-closure')
        .then(function (res) {
          self.local_update = res.data.model
          self.sync_deployment_logs_from_model(self.local_update)
          self.$emit('record-updated', res.data.model)
          self.sync_deployment_poll_from_status()
        })
        .catch(function (err) {
          const msg =
            err.response && err.response.data && err.response.data.message
              ? err.response.data.message
              : 'No se pudieron iniciar las tareas post-cierre.'
          alert(msg)
        })
        .then(function () {
          if (self.local_update.deployment_status !== 'running') {
            self.deploy_loading = false
          }
        })
    },
    /**
     * Ejecuta cambio de URL / versión por defecto (última etapa post-cierre).
     *
     * @returns {void}
     */
    configure_system() {
      const self = this
      if (
        !confirm(
          '¿Configurar el sistema ahora?\n\n' +
            'Se actualizará la URL y la versión por defecto en el cliente.'
        )
      ) {
        return
      }
      self.deploy_loading = true
      api
        .post('/update/' + self.local_update.id + '/deploy/configure-system')
        .then(function (res) {
          self.local_update = res.data.model
          self.sync_deployment_logs_from_model(self.local_update)
          self.$emit('record-updated', res.data.model)
          self.sync_deployment_poll_from_status()
        })
        .catch(function (err) {
          const msg =
            err.response && err.response.data && err.response.data.message
              ? err.response.data.message
              : 'No se pudo configurar el sistema.'
          alert(msg)
        })
        .then(function () {
          if (self.local_update.deployment_status !== 'running') {
            self.deploy_loading = false
          }
        })
    },
    /**
     * Reintenta comandos automatizados desde el fallido (omite exitosos y manuales).
     *
     * @returns {void}
     */
    retry_commands() {
      const self = this
      if (
        !confirm(
          '¿Reintentar los comandos automatizados?\n\n' +
            'Se omitirán los ya exitosos y los marcados como ejecución manual. ' +
            'El reintento arranca desde el primer comando fallido o pendiente.'
        )
      ) {
        return
      }
      self.deploy_loading = true
      api
        .post('/update/' + self.local_update.id + '/deploy/retry-commands')
        .then(function (res) {
          self.local_update = res.data.model
          self.sync_deployment_logs_from_model(self.local_update)
          self.$emit('record-updated', res.data.model)
          self.sync_deployment_poll_from_status()
        })
        .catch(function (err) {
          const msg =
            err.response && err.response.data && err.response.data.message
              ? err.response.data.message
              : 'No se pudo reintentar los comandos.'
          alert(msg)
        })
        .then(function () {
          if (self.local_update.deployment_status !== 'running') {
            self.deploy_loading = false
          }
        })
    },
    /**
     * Avanza el estado del update al siguiente en el flujo definido.
     * @returns {void}
     */
    advance_status() {
      const self = this
      self.loading = true
      api
        .post('/update/' + self.local_update.id + '/advance-status')
        .then(function (res) {
          self.local_update = res.data.model
          self.$emit('record-updated', res.data.model)
        })
        .catch(function () {})
        .then(function () {
          self.loading = false
        })
    },
    /**
     * Llama al endpoint de sincronización con confirmación previa del usuario.
     * @returns {void}
     */
    sync_to_client() {
      if (!confirm('¿Sincronizar la versión al cliente ahora?')) return
      const self = this
      self.loading = true
      api
        .post('/update/' + self.local_update.id + '/sync')
        .then(function (res) {
          self.local_update = res.data.model
          self.$emit('record-updated', res.data.model)
        })
        .catch(function (err) {
          const msg =
            err.response && err.response.data && err.response.data.message
              ? err.response.data.message
              : 'Error al sincronizar.'
          alert(msg)
          if (err.response && err.response.data && err.response.data.model) {
            self.local_update = err.response.data.model
            self.$emit('record-updated', err.response.data.model)
          }
        })
        .then(function () {
          self.loading = false
        })
    },
    /**
     * Marca o desmarca un paso del proceso de actualización.
     * @param {{ step: string, unmark: boolean }} payload
     * @returns {void}
     */
    on_mark_step(payload) {
      const self = this
      self.loading = true
      api
        .post('/update/' + self.local_update.id + '/mark-step', payload)
        .then(function (res) {
          self.local_update = res.data.model
          self.$emit('record-updated', res.data.model)
        })
        .catch(function () {})
        .then(function () {
          self.loading = false
        })
    },

    /**
     * Alterna el flag `skipped` de un UpdateSeeder.
     * Se puede invocar incluso cuando la sección post-cierre está bloqueada,
     * de modo que el operador puede preparar los saltos antes de habilitarla.
     *
     * @param {Object} seeder  UpdateSeeder completo (con id)
     * @returns {void}
     */
    on_toggle_skip_seeder(seeder) {
      const self = this
      self.loading = true
      self.$store.commit('auth/setMessage', 'Actualizando seeder...')
      self.$store.commit('auth/setLoading', true)
      api
        .post('/update/' + self.local_update.id + '/seeders/' + seeder.id + '/toggle-skip')
        .then(function (res) {
          self.local_update = res.data.model
          self.$emit('record-updated', res.data.model)
        })
        .catch(function (err) {
          const msg =
            err.response && err.response.data && err.response.data.message
              ? err.response.data.message
              : 'No se pudo actualizar el seeder.'
          alert(msg)
        })
        .then(function () {
          self.loading = false
          self.$store.commit('auth/setLoading', false)
          self.$store.commit('auth/setMessage', '')
        })
    },

    /**
     * Alterna el flag `skipped` de un UpdateCommand.
     * Se puede invocar incluso cuando la sección post-cierre está bloqueada.
     *
     * @param {Object} cmd  UpdateCommand completo (con id)
     * @returns {void}
     */
    on_toggle_skip_command(cmd) {
      const self = this
      self.loading = true
      self.$store.commit('auth/setMessage', 'Actualizando comando...')
      self.$store.commit('auth/setLoading', true)
      api
        .post('/update/' + self.local_update.id + '/commands/' + cmd.id + '/toggle-skip')
        .then(function (res) {
          self.local_update = res.data.model
          self.$emit('record-updated', res.data.model)
        })
        .catch(function (err) {
          const msg =
            err.response && err.response.data && err.response.data.message
              ? err.response.data.message
              : 'No se pudo actualizar el comando.'
          alert(msg)
        })
        .then(function () {
          self.loading = false
          self.$store.commit('auth/setLoading', false)
          self.$store.commit('auth/setMessage', '')
        })
    },
  },
}
</script>
