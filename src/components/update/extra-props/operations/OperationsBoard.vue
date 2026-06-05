<template>
  <div>
    <!-- Tablero de dos columnas: tareas previas al cierre | tareas post-cierre -->

    <!-- ==================== LOG EN VIVO ==================== -->
    <div v-if="deployment_started" class="card border-secondary border-opacity-25 mb-3">
      <div
        class="card-header d-flex align-items-center gap-2 py-2"
        style="cursor: pointer; user-select: none"
        @click="log_expanded = !log_expanded"
      >
        <i class="bi bi-terminal text-secondary"></i>
        <span class="small fw-semibold">Log en vivo</span>
        <span v-if="deployment_loading" class="spinner-border spinner-border-sm text-warning ms-1" role="status"></span>
        <span v-if="deployment_logs.length" class="badge text-bg-secondary small ms-1">{{ deployment_logs.length }}</span>
        <i class="bi ms-auto" :class="log_expanded ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
      </div>
      <div v-if="log_expanded" class="card-body p-0">
        <div
          ref="log_container"
          class="deployment-log-panel border-0 rounded-bottom bg-dark text-light small p-2"
        >
          <div
            v-for="(log_line, log_index) in deployment_logs"
            :key="log_index"
            class="deployment-log-line"
            :class="'text-' + log_level_class(log_line.level)"
          >
            <span class="text-muted">[{{ log_line.step }}]</span>
            {{ log_line.line }}
          </div>
          <div v-if="!deployment_logs.length && deployment_loading" class="text-muted">
            Esperando líneas de log…
          </div>
        </div>
      </div>
    </div>


    
    <div class="row g-3 mb-3">

      <!-- ==================== COLUMNA IZQUIERDA: TAREAS PREVIAS AL CIERRE ==================== -->
      <div class="col-lg-6">
        <div class="card h-100 border-primary border-opacity-25">
          <div class="card-header d-flex align-items-center gap-2 bg-primary bg-opacity-10">
            <i class="bi bi-arrow-up-circle text-primary"></i>
            <h6 class="mb-0 fw-semibold">Tareas previas al cierre</h6>
          </div>
          <div class="card-body">

            <!-- === BLOQUE 1: ACTUALIZAR SISTEMAS (compile + upload SPA + upload API) === -->
            <div class="mb-3">
              <div class="d-flex align-items-center gap-2 mb-1">
                <!-- Ícono global del bloque según estado combinado -->
                <i
                  v-if="sistema_block_status === 'completed'"
                  class="bi bi-check-circle-fill text-success"
                ></i>
                <i
                  v-else-if="sistema_block_status === 'failed'"
                  class="bi bi-x-circle-fill text-danger"
                ></i>
                <i
                  v-else-if="sistema_block_status === 'running'"
                  class="bi bi-arrow-repeat text-warning rotating-icon"
                ></i>
                <i v-else class="bi bi-circle text-muted"></i>
                <span class="fw-semibold small">Actualizar sistemas</span>
              </div>

              <!-- Botón "Comenzar actualización" y descripción (solo cuando no se inició aún) -->
              <div v-if="!deployment_started" class="ms-4 mt-1">
                <p class="small text-muted mb-2">
                  Compila <strong>empresa-spa</strong> en el VPS, sube el
                  <code>dist/</code> al hosting del cliente y despliega <strong>empresa-api</strong>.
                  <template v-if="!update.target_client_api_id">
                    <br />
                    <span class="text-warning">
                      <i class="bi bi-exclamation-triangle me-1"></i>
                      Configurá la API destino en el grupo Básico antes de comenzar.
                    </span>
                  </template>
                </p>
                <button
                  type="button"
                  class="btn btn-warning btn-sm"
                  :disabled="loading || deploy_loading || !update.target_client_api_id"
                  @click="$emit('deploy-systems')"
                >
                  <i class="bi bi-cloud-upload me-1"></i>Comenzar actualización
                </button>
              </div>

              <!-- Sub-tareas del bloque sistema (visibles una vez iniciado el deployment) -->
              <div v-else class="ms-4 mt-1">
                <sub-task-item
                  label="Compilar SPA"
                  :status="get_step_status_cached('compile_spa')"
                />
                <sub-task-item
                  label="Subir SPA al hosting"
                  :status="get_step_status_cached('upload_spa')"
                />
                <sub-task-item
                  label="Subir API al hosting"
                  :status="get_step_status_cached('upload_api')"
                />
              </div>
            </div>

            <!-- === BLOQUE 2: EJECUTAR MIGRACIONES === -->
            <div class="mb-3" :class="{ 'opacity-50': !deployment_started }">
              <div class="d-flex align-items-center gap-2 mb-1">
                <i
                  v-if="migrations_status === 'completed'"
                  class="bi bi-check-circle-fill text-success"
                ></i>
                <i
                  v-else-if="migrations_status === 'failed'"
                  class="bi bi-x-circle-fill text-danger"
                ></i>
                <i
                  v-else-if="migrations_status === 'running'"
                  class="bi bi-arrow-repeat text-warning rotating-icon"
                ></i>
                <i v-else class="bi bi-circle text-muted"></i>
                <span class="fw-semibold small">Ejecutar migraciones</span>
              </div>
              <div class="ms-4">
                <sub-task-item
                  label="Migraciones de base de datos"
                  :status="migrations_status"
                />
              </div>
            </div>

          </div><!-- /card-body izquierda -->
        </div>
      </div>

      <!-- ==================== COLUMNA DERECHA: TAREAS POST-CIERRE DEL NEGOCIO ==================== -->
      <div class="col-lg-6">
        <div class="card h-100 border-warning border-opacity-25">
          <div class="card-header d-flex align-items-center gap-2 bg-warning bg-opacity-10">
            <i class="bi bi-moon-stars text-warning"></i>
            <h6 class="mb-0 fw-semibold">
              Tareas post-cierre del negocio
            </h6>
            <span class="badge text-bg-warning ms-auto small">Negocio cerrado</span>
          </div>
          <div class="card-body">

            <!-- === TAREA MANUAL: CRONS / SUPERVISOR (primera del cuadrante post-cierre) === -->
            <div
              class="mb-3 pb-3 border-bottom"
              :class="{ 'post-closure-locked-section': post_closure_locked }"
            >
              <div class="d-flex align-items-start gap-2">
                <div class="flex-shrink-0 mt-1">
                  <i
                    v-if="crons_done"
                    class="bi bi-check-circle-fill text-success"
                  ></i>
                  <i v-else-if="post_closure_locked" class="bi bi-lock text-muted"></i>
                  <i v-else class="bi bi-hand-index text-warning"></i>
                </div>
                <div class="flex-grow-1">
                  <div class="d-flex align-items-center gap-2 mb-1">
                    <span class="fw-semibold small">Configurar Crons / Supervisor</span>
                    <span class="badge text-bg-warning small">Manual</span>
                  </div>
                  <p class="small text-muted mb-2">
                    Configurar manualmente los Crons o Supervisor en el panel de hosting
                    (Hostinger / VPC) del cliente antes de continuar con la segunda etapa.
                  </p>
                  <div v-if="crons_done" class="small text-success mb-2">
                    <i class="bi bi-check me-1"></i>Marcado el {{ format_date(update.crons_supervisor_at) }}
                  </div>
                  <button
                    v-if="!crons_done"
                    type="button"
                    class="btn btn-sm btn-outline-warning"
                    :disabled="loading || post_closure_locked"
                    @click="$emit('mark-step', { step: 'crons_supervisor_at', unmark: false })"
                  >
                    Marcar como hecho
                  </button>
                  <button
                    v-if="crons_done"
                    type="button"
                    class="btn btn-sm btn-outline-secondary"
                    :disabled="loading || post_closure_locked"
                    @click="$emit('mark-step', { step: 'crons_supervisor_at', unmark: true })"
                  >
                    Desmarcar
                  </button>
                </div>
              </div>
            </div>

            <!-- Aviso: etapa pre-cierre pendiente (las tareas siguen visibles pero bloqueadas) -->
            <div v-if="post_closure_locked" class="alert alert-secondary py-2 mb-3 small">
              <i class="bi bi-lock me-1"></i>
              Completá la etapa pre-cierre (actualizar sistemas y migraciones) para habilitar estas tareas.
            </div>

            <!-- Aviso: faltan user_id del cliente para comandos/seeders per_user -->
            <div
              v-if="post_closure_needs_user_id && !deployment_client_user_id"
              class="alert alert-warning py-2 mb-3 small"
            >
              <i class="bi bi-exclamation-triangle me-1"></i>
              El cliente no tiene <strong>user_id</strong> ComercioCity configurado.
              Los seeders/comandos por usuario no podrán ejecutarse hasta completarlo en el perfil del cliente.
            </div>

            <!-- Botón para iniciar seeders y comandos (tras marcar crons) -->
            <div
              v-if="can_start_post_closure"
              class="alert alert-info py-2 mb-3 small"
            >
              <i class="bi bi-play-circle me-1"></i>
              Crons configurados. Confirmá que el negocio ya cerró e iniciá seeders y comandos.
              <div class="mt-2">
                <button
                  type="button"
                  class="btn btn-info btn-sm"
                  :disabled="loading || deploy_loading"
                  @click="$emit('start-post-closure')"
                >
                  <i class="bi bi-play-circle me-1"></i>Comenzar tareas post-cierre
                </button>
              </div>
            </div>

            <!-- Tareas automáticas post-cierre: siempre visibles; bloqueadas hasta terminar pre-cierre -->
            <div
              class="post-closure-tasks-list"
              :class="{ 'post-closure-locked-section': post_closure_locked || post_closure_automated_locked }"
            >

              <!-- === TAREA: SEEDERS EJECUTADOS === -->
              <div class="mb-3">
                <div class="d-flex align-items-center gap-2 mb-1">
                  <i
                    v-if="!post_closure_automated_locked && seeders_block_status === 'completed'"
                    class="bi bi-check-circle-fill text-success"
                  ></i>
                  <i
                    v-else-if="!post_closure_automated_locked && seeders_block_status === 'failed'"
                    class="bi bi-x-circle-fill text-danger"
                  ></i>
                  <i
                    v-else-if="!post_closure_automated_locked && seeders_block_status === 'running'"
                    class="bi bi-arrow-repeat text-warning rotating-icon"
                  ></i>
                  <i v-else class="bi bi-circle text-muted"></i>
                  <span class="fw-semibold small">Seeders ejecutados</span>
                  <!-- Badge de error si hay alguno fallido -->
                  <span
                    v-if="!post_closure_automated_locked && seeders_with_errors > 0"
                    class="badge text-bg-danger small ms-auto"
                  >{{ seeders_with_errors }} fallido{{ seeders_with_errors > 1 ? 's' : '' }}</span>
                </div>

                <!-- Sub-tareas: una por cada seeder del upgrade -->
                <div v-if="update_seeders.length" class="ms-4 mt-1">
                  <sub-task-item
                    v-for="seeder in update_seeders"
                    :key="seeder.id"
                    :label="seeder_label(seeder)"
                    :detail="seeder_class_label(seeder)"
                    :version_label="seeder_version_label(seeder)"
                    :status="post_closure_automated_locked ? 'pending' : seeder_item_status(seeder)"
                    :failure_notes="post_closure_automated_locked ? '' : seeder_failure_notes(seeder)"
                    :run_scope="seeder.version_seeder ? seeder.version_seeder.run_scope : null"
                    :console_logs="post_closure_automated_locked ? [] : seeder_console_logs(seeder)"
                    :is_skipped="seeder_is_skipped(seeder)"
                    :allow_skip_toggle="seeder_can_toggle_skip(seeder)"
                    @toggle-skip="$emit('toggle-skip-seeder', seeder)"
                  />
                </div>
                <div v-else class="ms-4 mt-1 small text-muted">Sin seeders para este upgrade</div>
              </div>

              <!-- === TAREA: COMANDOS EJECUTADOS === -->
              <div class="mb-3">
                <div class="d-flex align-items-center gap-2 mb-1">
                  <i
                    v-if="!post_closure_automated_locked && commands_block_status === 'completed'"
                    class="bi bi-check-circle-fill text-success"
                  ></i>
                  <i
                    v-else-if="!post_closure_automated_locked && commands_block_status === 'failed'"
                    class="bi bi-x-circle-fill text-danger"
                  ></i>
                  <i
                    v-else-if="!post_closure_automated_locked && commands_block_status === 'running'"
                    class="bi bi-arrow-repeat text-warning rotating-icon"
                  ></i>
                  <i v-else class="bi bi-circle text-muted"></i>
                  <span class="fw-semibold small">Comandos ejecutados</span>
                  <span
                    v-if="!post_closure_automated_locked && commands_manual_pending > 0"
                    class="badge text-bg-warning small ms-1"
                  >{{ commands_manual_pending }} manual{{ commands_manual_pending > 1 ? 'es' : '' }}</span>
                  <span
                    v-if="!post_closure_automated_locked && commands_with_errors > 0"
                    class="badge text-bg-danger small ms-auto"
                  >{{ commands_with_errors }} fallido{{ commands_with_errors > 1 ? 's' : '' }}</span>
                </div>

                <!-- Sub-tareas: una por cada comando del upgrade -->
                <div v-if="update_commands.length" class="ms-4 mt-1">
                  <sub-task-item
                    v-for="cmd in update_commands"
                    :key="cmd.id"
                    :label="command_label(cmd)"
                    :detail="command_text(cmd)"
                    :version_label="command_version_label(cmd)"
                    :status="post_closure_automated_locked ? 'pending' : command_item_status(cmd)"
                    :failure_notes="post_closure_automated_locked ? '' : command_failure_notes(cmd)"
                    :run_scope="cmd.version_command ? cmd.version_command.run_scope : null"
                    :is_manual="command_is_manual(cmd)"
                    :console_logs="post_closure_automated_locked ? [] : command_console_logs(cmd)"
                    :is_skipped="command_is_skipped(cmd)"
                    :allow_skip_toggle="command_can_toggle_skip(cmd)"
                    @toggle-skip="$emit('toggle-skip-command', cmd)"
                  />
                </div>
                <div v-else class="ms-4 mt-1 small text-muted">Sin comandos para este upgrade</div>

                <!-- Reintento de comandos automatizados fallidos -->
                <div
                  v-if="can_retry_commands"
                  class="alert alert-danger py-2 mt-2 mb-0 small"
                >
                  <i class="bi bi-exclamation-triangle me-1"></i>
                  Un comando automatizado falló. Los anteriores ya quedaron marcados como exitosos.
                  <div class="mt-2">
                    <button
                      type="button"
                      class="btn btn-danger btn-sm"
                      :disabled="loading || deploy_loading"
                      @click="$emit('retry-commands')"
                    >
                      <i class="bi bi-arrow-repeat me-1"></i>Reintentar desde el comando fallido
                    </button>
                  </div>
                </div>
              </div>

              <!-- === TAREA: SISTEMA CONFIGURADO (update_default_version) — botón manual === -->
              <div
                :class="{ 'post-closure-locked-section': sistema_configurado_locked }"
              >
                <div class="d-flex align-items-center gap-2 mb-1">
                  <i
                    v-if="!sistema_configurado_locked && sistema_configurado_status === 'completed'"
                    class="bi bi-check-circle-fill text-success"
                  ></i>
                  <i
                    v-else-if="!sistema_configurado_locked && sistema_configurado_status === 'failed'"
                    class="bi bi-x-circle-fill text-danger"
                  ></i>
                  <i
                    v-else-if="!sistema_configurado_locked && sistema_configurado_status === 'running'"
                    class="bi bi-arrow-repeat text-warning rotating-icon"
                  ></i>
                  <i v-else class="bi bi-circle text-muted"></i>
                  <span class="fw-semibold small">Sistema configurado</span>
                </div>
                <div class="ms-4">
                  <sub-task-item
                    label="Cambio de URL / versión por defecto"
                    :status="sistema_configurado_locked ? 'pending' : sistema_configurado_status"
                  />
                  <p v-if="can_configure_system" class="small text-muted mt-2 mb-2">
                    Aplicá el cambio de URL y versión por defecto en el cliente cuando seeders y comandos hayan finalizado.
                  </p>
                  <button
                    v-if="can_configure_system"
                    type="button"
                    class="btn btn-success btn-sm mt-1"
                    :disabled="loading || deploy_loading"
                    @click="$emit('configure-system')"
                  >
                    <i class="bi bi-gear me-1"></i>Configurar sistema (cambio de URL)
                  </button>
                </div>
              </div>

            </div><!-- /post-closure-tasks-list -->

          </div><!-- /card-body derecha -->
        </div>
      </div>

    </div><!-- /row tablero -->

  </div>
</template>

<script>
import { get_step_status } from '@/utils/deployment_status'
import {
  extract_seeder_console_logs,
  extract_command_console_logs,
} from '@/utils/deployment_item_logs'
import {
  resolve_update_command_text,
  resolve_update_seeder_command_text,
} from '@/utils/deployment_run_command_resolver'
import SubTaskItem from './SubTaskItem.vue'

/**
 * Tablero de operaciones de un ClientVersionUpgrade.
 * Divide el proceso en dos columnas: tareas previas al cierre del negocio (izquierda)
 * y tareas post-cierre (derecha). El log en vivo se muestra debajo del tablero.
 */
export default {
  name: 'OperationsBoard',
  components: { SubTaskItem },
  props: {
    /** Modelo completo del upgrade (con seeders, comandos y timestamps de pasos). */
    update: { type: Object, required: true },
    /** Líneas de log del deployment en curso o último ejecutado. */
    deployment_logs: { type: Array, default: () => [] },
    /** Indica si hay una operación de deployment en progreso (POST start / confirm). */
    deploy_loading: { type: Boolean, default: false },
    /** Indica si hay una operación genérica en progreso (mark-step, etc.). */
    loading: { type: Boolean, default: false },
    /** Si el deployment está siendo monitoreado vía polling. */
    deployment_loading: { type: Boolean, default: false },
  },
  emits: [
    'deploy-systems',
    'start-post-closure',
    'configure-system',
    'mark-step',
    'retry-commands',
    /** Emitido al hacer toggle skip en un seeder; payload: objeto UpdateSeeder. */
    'toggle-skip-seeder',
    /** Emitido al hacer toggle skip en un comando; payload: objeto UpdateCommand. */
    'toggle-skip-command',
  ],
  data() {
    return {
      /** Controla si el panel de log está expandido o colapsado. */
      log_expanded: true,
    }
  },
  computed: {
    /**
     * Estado global del deployment.
     * @returns {string|null}
     */
    deployment_status() {
      return this.update.deployment_status || null
    },
    /**
     * El deployment fue iniciado al menos una vez (tiene logs o deployment_status no nulo).
     * @returns {boolean}
     */
    deployment_started() {
      return Boolean(this.deployment_status) || this.deployment_logs.length > 0
    },
    /**
     * El deployment está pausado tras pre-cierre (esperando crons + botón post-cierre).
     * @returns {boolean}
     */
    deployment_paused() {
      return this.deployment_status === 'paused'
    },
    /**
     * El deployment está pausado tras seeders/comandos (esperando configurar sistema).
     * @returns {boolean}
     */
    deployment_paused_post_tasks() {
      return this.deployment_status === 'paused_post_tasks'
    },
    /**
     * Cliente del upgrade (fuente de user_id ComercioCity).
     * @returns {Object|null}
     */
    deployment_client() {
      return this.update && this.update.client ? this.update.client : null
    },
    /**
     * user_id ComercioCity del cliente del upgrade (parámetro en seeders/comandos per_user).
     * @returns {number|null}
     */
    deployment_client_user_id() {
      if (!this.deployment_client || this.deployment_client.user_id == null) {
        return null
      }
      var parsed = parseInt(this.deployment_client.user_id, 10)
      if (isNaN(parsed) || parsed <= 0) {
        return null
      }
      return parsed
    },
    /**
     * Hay seeders o comandos que requieren user_id del cliente (per_user o placeholder).
     * @returns {boolean}
     */
    post_closure_needs_user_id() {
      var self = this
      var seeders_need = this.update_seeders.some(function (seeder) {
        return self.seeder_needs_user_id(seeder)
      })
      if (seeders_need) {
        return true
      }
      return this.update_commands.some(function (command) {
        return self.command_needs_user_id(command)
      })
    },
    /**
     * Lista de seeders del upgrade.
     * @returns {Array}
     */
    update_seeders() {
      return this.update.update_seeders || []
    },
    /**
     * Lista de comandos del upgrade.
     * @returns {Array}
     */
    update_commands() {
      return this.update.update_commands || []
    },
    /**
     * El campo crons_supervisor_at está marcado (manual).
     * @returns {boolean}
     */
    crons_done() {
      return Boolean(this.update.crons_supervisor_at)
    },
    /**
     * Estado combinado del bloque "Actualizar sistemas" (peor estado entre compile, upload_spa, upload_api).
     * @returns {string}
     */
    sistema_block_status() {
      var statuses = [
        this.get_step_status_cached('compile_spa'),
        this.get_step_status_cached('upload_spa'),
        this.get_step_status_cached('upload_api'),
      ]
      return this.combined_status(statuses)
    },
    /**
     * Estado del bloque "Ejecutar migraciones" (solo run_migrations).
     * @returns {string}
     */
    migrations_status() {
      return this.get_step_status_cached('run_migrations')
    },
    /**
     * La etapa pre-cierre terminó (sistemas subidos + migraciones corridas).
     * Habilita la interacción con las tareas post-cierre del cuadrante derecho.
     *
     * @returns {boolean}
     */
    pre_closure_complete() {
      if (this.migrations_status === 'completed') {
        return true
      }
      if (this.update.migraciones_corridas_at) {
        return true
      }
      if (this.deployment_status === 'paused' || this.deployment_status === 'paused_post_tasks' || this.deployment_status === 'completed') {
        return true
      }
      if (this.get_step_status_cached('run_seeders') !== 'pending') {
        return true
      }
      if (this.get_step_status_cached('run_commands') !== 'pending') {
        return true
      }
      if (this.get_step_status_cached('update_default_version') !== 'pending') {
        return true
      }
      return false
    },
    /**
     * Tareas post-cierre bloqueadas hasta completar pre-cierre (pero siempre visibles).
     *
     * @returns {boolean}
     */
    post_closure_locked() {
      return !this.pre_closure_complete
    },
    /**
     * Seeders y comandos aún no iniciados (bloqueados visualmente).
     *
     * @returns {boolean}
     */
    post_closure_automated_locked() {
      if (this.post_closure_locked) {
        return true
      }
      if (this.deployment_status === 'paused') {
        return true
      }
      if (this.deployment_status === 'running') {
        return false
      }
      if (this.deployment_status === 'paused_post_tasks' || this.deployment_status === 'completed') {
        return false
      }
      if (this.deployment_status === 'failed') {
        return false
      }
      return true
    },
    /**
     * Sistema configurado bloqueado hasta que seeders/comandos terminaron.
     *
     * @returns {boolean}
     */
    sistema_configurado_locked() {
      if (this.deployment_status === 'paused_post_tasks') {
        return false
      }
      if (this.deployment_status === 'completed') {
        return false
      }
      if (this.deployment_status === 'running' && this.update.comandos_ejecutados_at) {
        return false
      }
      return true
    },
    /**
     * Mostrar botón para iniciar seeders y comandos post-cierre.
     *
     * @returns {boolean}
     */
    can_start_post_closure() {
      return (
        !this.post_closure_locked &&
        this.crons_done &&
        this.deployment_status === 'paused'
      )
    },
    /**
     * Mostrar botón para configurar URL/versión por defecto.
     *
     * @returns {boolean}
     */
    can_configure_system() {
      return this.deployment_status === 'paused_post_tasks'
    },
    /**
     * Estado del bloque "Seeders ejecutados" (derivado de run_seeders o de los registros individuales).
     * Los ítems marcados como saltados (skipped + pendiente) se tratan como completados
     * para el propósito del estado global del bloque.
     * @returns {string}
     */
    seeders_block_status() {
      var seeders = this.update_seeders
      if (seeders.length > 0) {
        var any_running = false
        var any_failed = false
        var all_done = true
        var self = this

        seeders.forEach(function (seeder) {
          // Seeder saltado y aún pendiente: se cuenta como completado en el bloque.
          if (self.seeder_is_skipped(seeder) && seeder.status === 'pendiente') {
            return
          }
          var item_status = self.seeder_item_status(seeder)
          if (item_status === 'running') {
            any_running = true
          }
          if (item_status === 'failed') {
            any_failed = true
          }
          if (item_status !== 'completed') {
            all_done = false
          }
        })

        if (any_running) {
          return 'running'
        }
        if (any_failed) {
          return 'failed'
        }
        if (all_done) {
          return 'completed'
        }
      }

      return this.get_step_status_cached('run_seeders')
    },
    /**
     * Estado del bloque "Comandos ejecutados".
     * Los ítems marcados como saltados (skipped + pendiente) se tratan como completados
     * para el propósito del estado global del bloque.
     * @returns {string}
     */
    commands_block_status() {
      var automated_commands = this.automated_update_commands
      if (automated_commands.length > 0) {
        var any_running = false
        var any_failed = false
        var all_automated_done = true
        var self = this

        automated_commands.forEach(function (command) {
          // Comando saltado y aún pendiente: se cuenta como completado en el bloque.
          if (self.command_is_skipped(command) && command.status === 'pendiente') {
            return
          }
          var item_status = self.command_item_status(command)
          if (item_status === 'running') {
            any_running = true
          }
          if (item_status === 'failed') {
            any_failed = true
          }
          if (item_status !== 'completed') {
            all_automated_done = false
          }
        })

        if (any_running) {
          return 'running'
        }
        if (any_failed) {
          return 'failed'
        }
        if (all_automated_done) {
          return 'completed'
        }
      }

      return this.get_step_status_cached('run_commands')
    },
    /**
     * Estado de "Sistema configurado" (update_default_version).
     * @returns {string}
     */
    sistema_configurado_status() {
      return this.get_step_status_cached('update_default_version')
    },
    /**
     * Cantidad de seeders fallidos (excluye los saltados).
     * @returns {number}
     */
    seeders_with_errors() {
      var self = this
      return this.update_seeders.filter(function (seeder) {
        if (self.seeder_is_skipped(seeder)) {
          return false
        }
        return self.seeder_item_status(seeder) === 'failed'
      }).length
    },
    /**
     * Cantidad de comandos fallidos (excluye los saltados).
     * @returns {number}
     */
    commands_with_errors() {
      var self = this
      return this.automated_update_commands.filter(function (command) {
        if (self.command_is_skipped(command)) {
          return false
        }
        return self.command_item_status(command) === 'failed'
      }).length
    },
    /**
     * Comandos del upgrade que no están marcados como ejecución manual.
     *
     * @returns {Array}
     */
    automated_update_commands() {
      var self = this
      return this.update_commands.filter(function (command) {
        return !self.command_is_manual(command)
      })
    },
    /**
     * Comandos manuales aún pendientes de ejecución.
     *
     * @returns {number}
     */
    commands_manual_pending() {
      var self = this
      return this.update_commands.filter(function (command) {
        return self.command_is_manual(command) && command.status === 'pendiente'
      }).length
    },
    /**
     * Mostrar botón para reintentar comandos automatizados fallidos.
     *
     * @returns {boolean}
     */
    can_retry_commands() {
      if (this.post_closure_automated_locked) {
        return false
      }
      if (this.deployment_status === 'running') {
        return false
      }
      if (this.deployment_status !== 'failed') {
        return false
      }

      var self = this
      return this.automated_update_commands.some(function (command) {
        return command.status === 'fallido' || command.status === 'pendiente'
      })
    },
  },
  watch: {
    deployment_logs: {
      handler() {
        this.scroll_logs_to_bottom()
      },
      deep: true,
    },
  },
  methods: {
    /**
     * Wrapper del helper get_step_status con los datos actuales del componente.
     * Se usa como computed en el template para cada etapa.
     *
     * @param {string} step_name
     * @returns {string}
     */
    get_step_status_cached(step_name) {
      return get_step_status(step_name, this.deployment_logs, this.deployment_status)
    },
    /**
     * Determina el estado "combinado" de un conjunto de sub-pasos.
     * Prioridad: failed > running > pending > completed.
     *
     * @param {string[]} statuses
     * @returns {string}
     */
    combined_status(statuses) {
      if (statuses.indexOf('failed') !== -1) return 'failed'
      if (statuses.indexOf('running') !== -1) return 'running'
      if (statuses.indexOf('pending') !== -1) {
        /* Si todos son pending → pending; si algunos son completed y otros pending → running visual */
        var has_completed = statuses.indexOf('completed') !== -1
        return has_completed ? 'running' : 'pending'
      }
      return 'completed'
    },
    /**
     * Clase de color Bootstrap según nivel del log (info, success, error).
     *
     * @param {string} level
     * @returns {string}
     */
    log_level_class(level) {
      if (level === 'error') return 'danger'
      if (level === 'success') return 'success'
      return 'light'
    },
    /**
     * Mantiene visible la última línea del log al actualizar el polling.
     *
     * @returns {void}
     */
    scroll_logs_to_bottom() {
      var self = this
      self.$nextTick(function () {
        var el = self.$refs.log_container
        if (el) {
          el.scrollTop = el.scrollHeight
        }
      })
    },
    /**
     * Formatea una fecha como DD/MM/YYYY HH:MM.
     *
     * @param {string|null} val
     * @returns {string}
     */
    format_date(val) {
      if (!val) return ''
      var d = new Date(val)
      return (
        d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
        ' ' +
        d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
      )
    },
    /**
     * Etiqueta visible de un UpdateSeeder (descripción o clase abreviada).
     *
     * @param {Object} seeder
     * @returns {string}
     */
    seeder_label(seeder) {
      if (seeder.version_seeder && seeder.version_seeder.description) {
        return seeder.version_seeder.description
      }
      if (seeder.version_seeder && seeder.version_seeder.seeder_class) {
        var parts = seeder.version_seeder.seeder_class.split('\\')
        return parts[parts.length - 1] || seeder.version_seeder.seeder_class
      }
      return 'Seeder #' + seeder.id
    },
    /**
     * Clase completa del seeder para mostrar como detalle (monospace).
     *
     * @param {Object} seeder
     * @returns {string}
     */
    seeder_class_label(seeder) {
      return resolve_update_seeder_command_text(seeder, this.deployment_client)
        || (seeder.version_seeder ? seeder.version_seeder.seeder_class || '' : '')
    },
    /**
     * Versión del producto asociada al seeder.
     *
     * @param {Object} seeder
     * @returns {string}
     */
    seeder_version_label(seeder) {
      if (seeder.version_seeder && seeder.version_seeder.version && seeder.version_seeder.version.version) {
        return seeder.version_seeder.version.version
      }
      return ''
    },
    /**
     * Estado visual de un UpdateSeeder individual (DB + logs en vivo).
     *
     * @param {Object} seeder
     * @returns {string}
     */
    seeder_item_status(seeder) {
      if (seeder.status === 'exitoso') {
        return 'completed'
      }
      if (seeder.status === 'fallido') {
        return 'failed'
      }

      var log_status = this.seeder_status_from_logs(seeder)
      if (log_status) {
        return log_status
      }

      return 'pending'
    },
    /**
     * Notas de fallo de un seeder (DB o log reciente).
     *
     * @param {Object} seeder
     * @returns {string}
     */
    seeder_failure_notes(seeder) {
      if (seeder.failure_notes) {
        return seeder.failure_notes
      }
      return this.seeder_failure_from_logs(seeder)
    },
    /**
     * Deriva estado de un seeder desde las líneas de log del deployment.
     *
     * @param {Object} seeder
     * @returns {string|null}
     */
    seeder_status_from_logs(seeder) {
      var seeder_class = seeder.version_seeder ? seeder.version_seeder.seeder_class : ''
      if (!seeder_class) {
        return null
      }

      var step_logs = this.deployment_logs.filter(function (log_line) {
        return log_line.step === 'run_seeders'
      })
      var failed_prefix = 'Seeder fallido (' + seeder_class + ')'
      var completed_prefix = 'Seeder completado: ' + seeder_class
      var i
      var line

      for (i = step_logs.length - 1; i >= 0; i--) {
        line = step_logs[i].line || ''
        if (line.indexOf(failed_prefix) === 0) {
          return 'failed'
        }
        if (line.indexOf(completed_prefix) === 0) {
          return 'completed'
        }
      }

      for (i = step_logs.length - 1; i >= 0; i--) {
        line = step_logs[i].line || ''
        if (line.indexOf('Corriendo seeder:') === 0) {
          var running_command = line.replace('Corriendo seeder:', '').trim()
          if (running_command.indexOf(seeder_class) !== -1) {
            return 'running'
          }
          break
        }
      }

      return null
    },
    /**
     * Extrae mensaje de error de un seeder desde el log de deployment.
     *
     * @param {Object} seeder
     * @returns {string}
     */
    seeder_failure_from_logs(seeder) {
      var seeder_class = seeder.version_seeder ? seeder.version_seeder.seeder_class : ''
      if (!seeder_class) {
        return ''
      }

      var failed_prefix = 'Seeder fallido (' + seeder_class + '): '
      var step_logs = this.deployment_logs.filter(function (log_line) {
        return log_line.step === 'run_seeders'
      })
      var i

      for (i = step_logs.length - 1; i >= 0; i--) {
        var line = step_logs[i].line || ''
        if (line.indexOf(failed_prefix) === 0) {
          return line.substring(failed_prefix.length)
        }
      }

      return ''
    },
    /**
     * Líneas de consola asociadas a un UpdateSeeder concreto.
     *
     * @param {Object} seeder
     * @returns {Array}
     */
    seeder_console_logs(seeder) {
      return extract_seeder_console_logs(seeder, this.deployment_logs, this.deployment_client)
    },
    /**
     * Líneas de consola asociadas a un UpdateCommand concreto.
     *
     * @param {Object} cmd
     * @returns {Array}
     */
    command_console_logs(cmd) {
      return extract_command_console_logs(cmd, this.deployment_logs, this.deployment_client)
    },
    /**
     * Indica si un comando está configurado como ejecución manual en la versión.
     *
     * @param {Object} cmd
     * @returns {boolean}
     */
    command_is_manual(cmd) {
      return Boolean(cmd.version_command && cmd.version_command.run_manually)
    },
    /**
     * Etiqueta visible de un UpdateCommand.
     *
     * @param {Object} cmd
     * @returns {string}
     */
    command_label(cmd) {
      if (cmd.version_command && cmd.version_command.description) {
        return cmd.version_command.description
      }
      if (cmd.version_command && cmd.version_command.command) {
        return cmd.version_command.command
      }
      return 'Comando #' + cmd.id
    },
    /**
     * Texto del comando artisan para mostrar como detalle.
     *
     * @param {Object} cmd
     * @returns {string}
     */
    command_text(cmd) {
      return resolve_update_command_text(cmd, this.deployment_client)
    },
    /**
     * Versión del producto asociada al comando.
     *
     * @param {Object} cmd
     * @returns {string}
     */
    command_version_label(cmd) {
      if (cmd.version_command && cmd.version_command.version && cmd.version_command.version.version) {
        return cmd.version_command.version.version
      }
      return ''
    },
    /**
     * Estado visual de un UpdateCommand individual (DB + logs en vivo).
     *
     * @param {Object} cmd
     * @returns {string}
     */
    command_item_status(cmd) {
      if (cmd.status === 'exitoso') {
        return 'completed'
      }
      if (cmd.status === 'fallido') {
        return 'failed'
      }

      var log_status = this.command_status_from_logs(cmd)
      if (log_status) {
        return log_status
      }

      return 'pending'
    },
    /**
     * Notas de fallo de un comando (DB o log reciente).
     *
     * @param {Object} cmd
     * @returns {string}
     */
    command_failure_notes(cmd) {
      if (cmd.failure_notes) {
        return cmd.failure_notes
      }
      return this.command_failure_from_logs(cmd)
    },
    /**
     * Deriva estado de un comando desde las líneas de log del deployment.
     *
     * @param {Object} cmd
     * @returns {string|null}
     */
    command_status_from_logs(cmd) {
      var command_text = resolve_update_command_text(cmd, this.deployment_client)
      if (!command_text) {
        return null
      }

      var step_logs = this.deployment_logs.filter(function (log_line) {
        return log_line.step === 'run_commands'
      })
      var failed_prefix = 'Comando fallido (' + command_text + ')'
      var completed_prefix = 'Comando completado: ' + command_text
      var i
      var line

      for (i = step_logs.length - 1; i >= 0; i--) {
        line = step_logs[i].line || ''
        if (line.indexOf(failed_prefix) === 0) {
          return 'failed'
        }
        if (line.indexOf(completed_prefix) === 0) {
          return 'completed'
        }
      }

      for (i = step_logs.length - 1; i >= 0; i--) {
        line = step_logs[i].line || ''
        if (line.indexOf('Corriendo comando:') === 0) {
          var running_command = line.replace('Corriendo comando:', '').trim()
          if (running_command === command_text) {
            return 'running'
          }
          break
        }
      }

      return null
    },
    /**
     * Extrae mensaje de error de un comando desde el log de deployment.
     *
     * @param {Object} cmd
     * @returns {string}
     */
    command_failure_from_logs(cmd) {
      var command_text = resolve_update_command_text(cmd, this.deployment_client)
      if (!command_text) {
        return ''
      }

      var failed_prefix = 'Comando fallido (' + command_text + '): '
      var step_logs = this.deployment_logs.filter(function (log_line) {
        return log_line.step === 'run_commands'
      })
      var i

      for (i = step_logs.length - 1; i >= 0; i--) {
        var line = step_logs[i].line || ''
        if (line.indexOf(failed_prefix) === 0) {
          return line.substring(failed_prefix.length)
        }
      }

      return ''
    },

    /**
     * Indica si un seeder requiere user_id del cliente (per_user o placeholder en plantilla).
     *
     * @param {Object} seeder
     * @returns {boolean}
     */
    seeder_needs_user_id(seeder) {
      if (!seeder.version_seeder) {
        return false
      }
      if (seeder.version_seeder.run_scope === 'per_user') {
        return true
      }
      var shell_command = seeder.version_seeder.command
        || (seeder.version_seeder.seeder_class
          ? 'php artisan db:seed --class=' + seeder.version_seeder.seeder_class
          : '')
      return /\{user_id(\?)?\}/i.test(shell_command)
    },

    /**
     * Indica si un comando requiere user_id del cliente (per_user o placeholder en plantilla).
     *
     * @param {Object} cmd
     * @returns {boolean}
     */
    command_needs_user_id(cmd) {
      if (!cmd.version_command || !cmd.version_command.command) {
        return false
      }
      if (cmd.version_command.run_scope === 'per_user') {
        return true
      }
      return /\{user_id(\?)?\}/i.test(cmd.version_command.command)
    },

    /**
     * Indica si un seeder está marcado para ser saltado en el deployment.
     *
     * @param {Object} seeder  UpdateSeeder
     * @returns {boolean}
     */
    seeder_is_skipped(seeder) {
      return Boolean(seeder.skipped)
    },

    /**
     * Indica si un seeder puede mostrar el botón toggle skip.
     * Sólo se permite si el seeder aún no fue ejecutado.
     *
     * @param {Object} seeder  UpdateSeeder
     * @returns {boolean}
     */
    seeder_can_toggle_skip(seeder) {
      return seeder.status === 'pendiente'
    },

    /**
     * Indica si un comando está marcado para ser saltado en el deployment.
     *
     * @param {Object} cmd  UpdateCommand
     * @returns {boolean}
     */
    command_is_skipped(cmd) {
      return Boolean(cmd.skipped)
    },

    /**
     * Indica si un comando puede mostrar el botón toggle skip.
     * Sólo se permite si el comando aún no fue ejecutado.
     *
     * @param {Object} cmd  UpdateCommand
     * @returns {boolean}
     */
    command_can_toggle_skip(cmd) {
      return cmd.status === 'pendiente'
    },
  },
}
</script>

<style scoped>
/* Panel de log en vivo */
.deployment-log-panel {
  max-height: 260px;
  overflow-y: auto;
  font-family: ui-monospace, monospace;
  font-size: 0.75rem;
  line-height: 1.35;
  border-radius: 0 0 0.375rem 0.375rem;
}
.deployment-log-line {
  white-space: pre-wrap;
  word-break: break-word;
  margin-bottom: 0.15rem;
}

/* Animación del ícono "en curso" */
.rotating-icon {
  display: inline-block;
  animation: spin 1.2s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* Sección post-cierre visible pero no interactiva hasta terminar pre-cierre */
.post-closure-locked-section {
  opacity: 0.55;
  pointer-events: none;
  user-select: none;
}
.post-closure-tasks-list {
  margin-top: 0.75rem;
}
</style>
