<template>
  <div v-if="record && record.id" class="lead-pipeline-panel">

    <!-- Switch maestro: apaga toda la automatización del ciclo de demo para este lead -->
    <div class="card border-secondary border-opacity-25 mb-3">
      <div class="card-body py-2">
        <div class="form-check form-switch mb-0">
          <input
            id="lead_manual_mode_switch"
            class="form-check-input"
            type="checkbox"
            role="switch"
            :checked="manual_mode_active"
            :disabled="toggling_flag === 'automatizaciones_demo_activas'"
            @change="toggle_master_automation"
          />
          <label class="form-check-label small fw-semibold" for="lead_manual_mode_switch">
            Estoy manejando este lead — no automatizar
          </label>
        </div>
        <!-- Aclaración: qué apaga el master y qué sigue disponible -->
        <p class="text-muted small mb-0 mt-1">
          Si lo activás, se apaga todo el ciclo automático de este lead (recordatorio, checks, resumen); los botones manuales de cada etapa siguen disponibles.
        </p>
      </div>
    </div>

    <!-- Panel principal: pipeline visual de 8 etapas del funnel comercial -->
    <div class="card border-secondary border-opacity-25 mb-3">
      <div class="card-header d-flex align-items-center gap-2 bg-light py-2">
        <i class="bi bi-diagram-3 text-secondary"></i>
        <span class="small fw-semibold">Pipeline comercial</span>
        <!-- Badge de progreso: muestra cuántas etapas están completas -->
        <span class="badge text-bg-secondary ms-auto small">{{ completed_stages }}/{{ total_stages }}</span>
      </div>
      <div class="card-body py-2">
        <!-- Una fila por etapa del funnel -->
        <div
          v-for="stage in stages"
          :key="stage.id"
          class="pipeline-stage-row py-2"
          :class="{ 'border-bottom': stage.id < total_stages }"
        >
          <div class="d-flex align-items-start gap-2">
            <!-- Ícono de estado: completado / en curso / fallido / pendiente -->
            <div class="stage-icon flex-shrink-0 mt-1">
              <i v-if="stage.status === 'completed'" class="bi bi-check-circle-fill text-success"></i>
              <i v-else-if="stage.status === 'running'" class="bi bi-arrow-repeat text-warning rotating-icon"></i>
              <i v-else-if="stage.status === 'failed'" class="bi bi-x-circle-fill text-danger"></i>
              <i v-else class="bi bi-circle text-muted"></i>
            </div>
            <div class="flex-grow-1">
              <!-- Label de la etapa con color según estado -->
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <span
                  class="small fw-semibold"
                  :class="{
                    'text-success': stage.status === 'completed',
                    'text-warning': stage.status === 'running',
                    'text-danger':  stage.status === 'failed',
                    'text-muted':   stage.status === 'pending',
                  }"
                >{{ stage.label }}</span>
              </div>
              <!-- Última ejecución: fecha/hora y origen manual o automático -->
              <div v-if="stage.execution_at" class="small text-muted mt-1">
                Última ejecución: {{ stage.execution_at }}
                <span v-if="stage.execution_source"> — {{ stage.execution_source }}</span>
              </div>
              <!-- Detalle opcional: fecha de demo, error de setup, etc. -->
              <div v-if="stage.detail" class="small text-muted mt-1">{{ stage.detail }}</div>
              <!-- Resumen colapsable para la etapa 10 (demo summary generado por Claude) -->
              <div v-if="stage.id === 10 && record.demo_summary && summary_expanded" class="mt-2 p-2 bg-light rounded small" style="white-space: pre-line;">{{ record.demo_summary }}</div>
              <div v-if="stage.id === 10 && record.demo_summary" class="mt-1">
                <button
                  type="button"
                  class="btn btn-link btn-sm p-0 text-decoration-none small text-muted"
                  @click="summary_expanded = !summary_expanded"
                >
                  <i class="bi me-1" :class="summary_expanded ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
                  {{ summary_expanded ? 'Ocultar resumen' : 'Ver resumen' }}
                </button>
              </div>
              <!-- Fila de acciones de la etapa: botón manual (siempre disponible) + toggle de automático -->
              <div v-if="stage.action" class="mt-1 d-flex align-items-center gap-3 flex-wrap">
                <!-- Botón de acción manual: visible si la etapa permite repetir o aún no completó -->
                <button
                  v-if="stage.status !== 'running' && (stage.status !== 'completed' || stage.allow_repeat)"
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  :disabled="loading_stage === stage.id"
                  @click="run_stage_action(stage)"
                >
                  <span v-if="loading_stage === stage.id" class="spinner-border spinner-border-sm me-1"></span>
                  {{ stage_action_button_label(stage) }}
                </button>

                <!-- Toggle "Automático" por operación: apaga solo el disparo del scheduler, no el botón manual -->
                <div
                  v-if="stage.automation_flag"
                  class="form-check form-switch mb-0"
                  :class="{ 'opacity-50': manual_mode_active }"
                >
                  <input
                    :id="'stage_auto_' + stage.id"
                    class="form-check-input"
                    type="checkbox"
                    role="switch"
                    :checked="record[stage.automation_flag]"
                    :disabled="manual_mode_active || toggling_flag === stage.automation_flag"
                    title="Apaga solo el disparo automático de esta etapa; el botón manual sigue funcionando."
                    @change="toggle_automation_flag(stage.automation_flag)"
                  />
                  <label class="form-check-label small text-muted" :for="'stage_auto_' + stage.id">Automático</label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Acciones manuales: botones del flujo principal (mail demo, followup, promover, user setup) -->
    <div class="card border-secondary border-opacity-25 mb-3">
      <div class="card-header bg-light py-2">
        <span class="small fw-semibold">Acciones manuales</span>
      </div>
      <div class="card-body py-2">
        <div class="d-flex flex-wrap gap-2">
          <button
            type="button"
            class="btn btn-sm btn-primary"
            :disabled="loading_action !== ''"
            :title="demo_mail_validation_message || 'Enviar mail de acceso a la demo'"
            @click="send_demo_mail"
          >
            {{ loading_action === 'demo_mail' ? 'Enviando...' : 'Enviar mail 1 - DEMO' }}
          </button>
          <button
            type="button"
            class="btn btn-sm btn-outline-primary"
            :disabled="loading_action !== ''"
            @click="send_followup_mail"
          >
            {{ loading_action === 'followup' ? 'Enviando...' : 'Enviar Mail 2 - Propuesta' }}
          </button>
          <!-- Promover a cliente: crea el Client en admin-api y genera las tareas del equipo -->
          <button
            v-if="!record.promoted_client_id"
            type="button"
            class="btn btn-sm btn-success"
            :disabled="loading_action !== '' || !can_promote_to_client"
            @click="request_promote_to_client"
          >
            <i class="bi bi-person-check-fill me-1" />
            {{ loading_action === 'fetching_subdomain' ? 'Sugiriendo...' : 'Promover a cliente' }}
          </button>
          <button
            type="button"
            class="btn btn-sm btn-outline-success"
            :disabled="loading_action !== '' || !can_run_user_setup"
            @click="run_user_setup"
          >
            {{ loading_action === 'user_setup' ? 'Ejecutando...' : 'Correr user setup' }}
          </button>
        </div>

        <!-- Iniciar implementación: visible cuando el lead ya fue promovido y aún no tiene implementación activa -->
        <div v-if="can_start_implementation" class="mt-2">
          <button
            type="button"
            class="btn btn-sm btn-outline-primary"
            :disabled="loading_action !== ''"
            @click="start_implementation"
          >
            {{ loading_action === 'start_implementation' ? 'Iniciando...' : 'Iniciar implementación' }}
          </button>
          <p class="text-muted small mb-0 mt-1">
            Al presionar, se creará la implementación y se enviará automáticamente el primer mensaje de presentación al cliente por WhatsApp.
          </p>
        </div>

        <!-- Advertencia de campos faltantes para el mail de demo -->
        <div v-if="demo_mail_validation_message" class="alert alert-warning py-2 mt-2 mb-0 small">
          <strong>Mail 1 - DEMO:</strong> {{ demo_mail_validation_message }}
        </div>
      </div>
    </div>

    <!-- Estado de los correos comerciales (Mail 1 demo y Mail 2 seguimiento) -->
    <div class="card border-secondary border-opacity-25 mb-3">
      <div class="card-header bg-light py-2">
        <span class="small fw-semibold">Correos comerciales</span>
      </div>
      <div class="card-body py-2">
        <div class="row g-2">
          <div v-for="mail_status in mail_status_cards" :key="mail_status.key" class="col-md-6">
            <small class="text-muted d-block">{{ mail_status.title }}</small>
            <span class="badge" :class="mail_status.badge_class">{{ mail_status.status_text }}</span>
            <div class="small mt-1">
              <strong>{{ mail_status.time_label }}:</strong> {{ mail_status.last_sent_at_text }}
            </div>
            <div v-if="mail_status.last_error" class="small text-danger mt-1">
              <strong>Último error:</strong> {{ mail_status.last_error }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Estado del setup remoto: demo setup y user setup -->
    <div class="card border-secondary border-opacity-25 mb-3">
      <div class="card-header bg-light py-2">
        <span class="small fw-semibold">Setup remoto</span>
      </div>
      <div class="card-body py-2">
        <div class="row g-2">
          <div v-for="setup_row in setup_status_cards" :key="setup_row.key" class="col-md-6">
            <small class="text-muted d-block">{{ setup_row.title }}</small>
            <span class="badge" :class="setup_row.badge_class">{{ setup_row.status_text }}</span>
            <div class="small mt-1">
              <strong>{{ setup_row.time_label }}:</strong> {{ setup_row.last_sent_at_text }}
            </div>
            <div v-if="setup_row.last_error" class="small text-danger mt-1">
              <strong>Último error:</strong> {{ setup_row.last_error }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Confirmación de subdominio antes de promover a cliente -->
    <div v-if="showing_subdomain_confirm" class="alert alert-light border mb-3">
      <div class="mb-2">
        <strong>Subdominio sugerido</strong>
        <small class="text-muted ms-1">(podés editarlo antes de confirmar)</small>
      </div>
      <!-- Input editable: el operador puede cambiar el subdominio sugerido por Claude -->
      <div class="mb-3">
        <input
          type="text"
          class="form-control form-control-sm"
          v-model="subdomain_preview"
          maxlength="20"
          placeholder="ej: hb, lamartina, galvan"
        />
        <small class="text-muted">Solo letras, números y guiones. Máximo 20 caracteres.</small>
      </div>
      <!-- Preview de las URLs que se van a crear con el subdominio elegido -->
      <div v-if="subdomain_preview" class="small text-muted mb-3">
        <div class="mb-1"><strong>URLs a crear:</strong></div>
        <div>SPA 1: https://{{ subdomain_preview }}.comerciocity.com</div>
        <div>API 1: https://api-{{ subdomain_preview }}.comerciocity.com</div>
        <div>SPA 2: https://{{ subdomain_preview }}2.comerciocity.com</div>
        <div>API 2: https://api-{{ subdomain_preview }}2.comerciocity.com</div>
      </div>
      <div class="d-flex gap-2">
        <button
          type="button"
          class="btn btn-sm btn-success"
          :disabled="!subdomain_preview || loading_action !== ''"
          @click="confirm_promote_to_client"
        >
          <i class="bi bi-check-lg me-1" />
          {{ loading_action === 'promote_to_client' ? 'Promoviendo...' : 'Confirmar y promover' }}
        </button>
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          :disabled="loading_action !== ''"
          @click="cancel_subdomain_confirm"
        >
          Cancelar
        </button>
      </div>
    </div>

    <div v-if="!record.promoted_client_id" class="alert alert-info py-2 small mb-0">
      Usá <strong>Promover a cliente</strong> para crear el perfil del cliente y generar las tareas automáticas del equipo.
    </div>
    <div v-if="record.promoted_client_id && !client_production_api_url" class="alert alert-info py-2 small mb-0">
      Cargá la <strong>API URL</strong> en el perfil del cliente (Clientes) para habilitar «Correr user setup».
    </div>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'

/**
 * Panel de pipeline del lead en el tab Operaciones.
 *
 * Muestra las 8 etapas del funnel comercial con íconos de estado y botones de
 * acción manual para disparar jobs sin esperar los schedulers automáticos.
 * Mantiene las acciones existentes (mail demo, followup, promover, user setup).
 */
export default {
  name: 'LeadExtraProps',
  props: {
    /**
     * Lead en edición: en el modal CRUD es el borrador (`draft`) del ModelModal,
     * no la fila original de la tabla, para reflejar al instante mails y setups.
     */
    record: { type: Object, default: null },
  },
  emits: ['record-updated'],
  data() {
    return {
      /**
       * Acción del flujo principal actualmente en ejecución (bloquea botones de acciones manuales).
       */
      loading_action: '',
      /**
       * Id de etapa del pipeline con acción en ejecución (null = ninguna).
       */
      loading_stage: null,
      /**
       * Controla si el resumen del closer (etapa 7) está expandido en el panel.
       */
      summary_expanded: false,
      /**
       * URL candidata para promover un lead a cliente.
       */
      promotion_api_url: '',
      /**
       * Controla si se muestra el panel de confirmación de subdominio antes de promover.
       */
      showing_subdomain_confirm: false,
      /**
       * Subdominio sugerido por Claude o editado por el operador antes de confirmar la promoción.
       */
      subdomain_preview: '',
      /**
       * Nombre del flag de automatización con un PATCH en curso (null = ninguno).
       * Bloquea ese switch puntual mientras se espera la confirmación del backend.
       */
      toggling_flag: null,
    }
  },
  computed: {
    /**
     * Devuelve las 8 etapas del pipeline con estado dinámico calculado a partir del record.
     * Cada etapa incluye: id, label, status, timestamp, detail, action y action_label.
     * @returns {Array<Object>}
     */
    stages() {
      /* Lead actual: si no existe no se puede calcular el estado del pipeline. */
      var r = this.record
      if (!r) {
        return []
      }

      /*
       * Statuses que indican que el lead ya está calificado en el funnel.
       * Incluye los 4 estados nuevos del ciclo de demo (prompt 094) para que
       * la etapa "Lead calificado" se muestre como completada en todos esos estados.
       */
      var calificado_statuses = [
        'calificado',
        'demo_agendada',
        'ingresando_demo',
        'demo_en_curso',
        'demo_pendiente_de_ingreso',
        'demo_pendiente_de_terminar',
        'demo_realizada',
        'cerrado_ganado',
        'mail2_enviado',
        'cerrado_perdido',
      ]

      return [
        {
          id: 1,
          label: 'Nombre capturado',
          /* Completado automáticamente cuando el lead tiene nombre de contacto cargado. */
          status: (r.contact_name || '').trim() ? 'completed' : 'pending',
          timestamp: null,
          /* Detalle: muestra el nombre capturado como referencia visual. */
          detail: (r.contact_name || '').trim() || null,
          action: null,
          action_label: null,
        },
        {
          id: 2,
          label: 'Lead calificado',
          /* Completado cuando el status del lead avanzó más allá de "nuevo" / "contactado". */
          status: calificado_statuses.indexOf(r.status) !== -1 ? 'completed' : 'pending',
          timestamp: null,
          detail: null,
          action: null,
          action_label: null,
        },
        {
          id: 3,
          label: 'Demo agendada',
          /* Completado cuando se cargó una fecha de demo en el lead. */
          status: r.demo_date ? 'completed' : 'pending',
          timestamp: null,
          /* Detalle: muestra la fecha y hora acordada de la demo. */
          detail: r.demo_date
            ? (this.format_date(r.demo_date) + (r.demo_start_time ? ' a las ' + r.demo_start_time : ''))
            : null,
          action: null,
          action_label: null,
        },
        {
          id: 4,
          label: 'Demo setup corrido',
          /* El demo setup puede estar en tres estados intermedios además de pendiente. */
          status: r.demo_setup_status === 'exitoso'
            ? 'completed'
            : r.demo_setup_status === 'ejecutandose'
              ? 'running'
              : r.demo_setup_status === 'fallido'
                ? 'failed'
                : 'pending',
          /* Detalle: mensaje de error si el setup falló. */
          detail: r.demo_setup_last_error || null,
          action: 'run_demo_setup',
          action_label: 'Correr demo setup ahora',
          action_label_repeat: 'Volver a correr demo setup',
          allow_repeat: true,
          execution_at: r.demo_setup_last_run_at ? this.format_datetime(r.demo_setup_last_run_at) : null,
          execution_source: this.format_execution_source(r.demo_setup_last_run_manual),
        },
        {
          id: 5,
          label: 'Recordatorio enviado',
          /* Completado cuando el scheduler (o acción manual) envió el recordatorio pre-demo. */
          status: r.recordatorio_demo_enviado ? 'completed' : 'pending',
          detail: null,
          action: 'send_demo_reminder',
          action_label: 'Enviar recordatorio ahora',
          action_label_repeat: 'Volver a enviar recordatorio',
          allow_repeat: true,
          execution_at: r.recordatorio_demo_enviado_at ? this.format_datetime(r.recordatorio_demo_enviado_at) : null,
          execution_source: this.format_execution_source(r.recordatorio_demo_manual),
          /* Flag del lead que controla si el scheduler dispara este recordatorio solo. */
          automation_flag: 'auto_recordatorio_demo',
        },
        {
          id: 6,
          label: 'Check de ingreso enviado',
          /* Completado cuando se envió el check de ingreso post-demo al lead. */
          status: r.demo_check_ingreso_enviado ? 'completed' : 'pending',
          detail: null,
          action: 'check_demo_ingress',
          action_label: 'Enviar check ahora',
          action_label_repeat: 'Volver a enviar check',
          allow_repeat: true,
          execution_at: r.demo_check_ingreso_enviado_at ? this.format_datetime(r.demo_check_ingreso_enviado_at) : null,
          execution_source: this.format_execution_source(r.demo_check_ingreso_manual),
          /* Flag del lead que controla si el scheduler dispara este check solo. */
          automation_flag: 'auto_check_ingreso_demo',
        },
        {
          id: 7,
          label: 'Ingreso confirmado',
          /*
           * Solo lectura: Claude infiere la confirmación de ingreso del lead.
           * No se puede marcar/desmarcar manualmente; no tiene botón de acción.
           */
          status: r.demo_ingreso_confirmado ? 'completed' : 'pending',
          /* Muestra la hora de confirmación en formato HH:MM si ya fue confirmado. */
          detail: r.demo_ingreso_confirmado && r.demo_ingreso_confirmado_at
            ? 'Confirmado a las ' + this.format_time(r.demo_ingreso_confirmado_at)
            : null,
          action: null,
          action_label: null,
          allow_repeat: false,
          execution_at: null,
          execution_source: null,
        },
        {
          id: 8,
          label: 'Check de fin enviado',
          /* Completado cuando se envió el mensaje preguntando si el lead terminó la demo. */
          status: r.demo_fin_check_enviado ? 'completed' : 'pending',
          detail: null,
          action: 'check_demo_fin',
          action_label: 'Enviar check ahora',
          action_label_repeat: 'Volver a enviar check',
          allow_repeat: true,
          execution_at: null,
          execution_source: null,
          /* Flag del lead que controla si el scheduler dispara este check solo. */
          automation_flag: 'auto_check_fin_demo',
        },
        {
          id: 9,
          label: 'Demo terminada',
          /*
           * Solo lectura: Claude infiere que el lead confirmó el fin de la demo.
           * No se puede marcar/desmarcar manualmente; no tiene botón de acción.
           */
          status: r.demo_terminada_confirmada ? 'completed' : 'pending',
          /* Muestra la hora de confirmación en formato HH:MM si ya fue confirmada. */
          detail: r.demo_terminada_confirmada && r.demo_terminada_confirmada_at
            ? 'Confirmada a las ' + this.format_time(r.demo_terminada_confirmada_at)
            : null,
          action: null,
          action_label: null,
          allow_repeat: false,
          execution_at: null,
          execution_source: null,
        },
        {
          id: 10,
          label: 'Resumen para el closer generado',
          /* Completado cuando Claude generó el resumen del lead para el closer. */
          status: (r.demo_summary || '').trim() ? 'completed' : 'pending',
          detail: null,
          action: 'generate_demo_summary',
          action_label: 'Generar resumen ahora',
          action_label_repeat: 'Volver a generar resumen',
          allow_repeat: true,
          execution_at: r.demo_summary_generated_at
            ? this.format_datetime(r.demo_summary_generated_at)
            : null,
          execution_source: this.format_execution_source(r.demo_summary_manual),
          /* Flag del lead que controla si el scheduler dispara este resumen solo. */
          automation_flag: 'auto_resumen_closer',
        },
        {
          id: 11,
          label: 'Llamada del closer realizada',
          /* Completado cuando el closer marcó que realizó la llamada post-demo. */
          status: r.closer_called_at ? 'completed' : 'pending',
          /* Timestamp del momento de la llamada del closer. */
          execution_at: r.closer_called_at ? this.format_datetime(r.closer_called_at) : null,
          execution_source: null,
          detail: null,
          action: 'mark_closer_called',
          action_label: 'Marcar llamada realizada',
          action_label_repeat: null,
          allow_repeat: false,
        },
      ]
    },
    /**
     * Cantidad de etapas completadas en el pipeline.
     * @returns {number}
     */
    completed_stages() {
      return this.stages.filter(function (s) { return s.status === 'completed' }).length
    },
    /**
     * Total de etapas del pipeline (8 fijas).
     * @returns {number}
     */
    total_stages() {
      return this.stages.length
    },
    /**
     * Valida que el lead tenga todos los datos necesarios para enviar el mail de demo.
     * Devuelve un mensaje con los campos faltantes o null si todo está completo.
     * @returns {string|null}
     */
    demo_mail_validation_message() {
      if (!this.record) {
        return null
      }
      /* Campos faltantes para habilitar el envío del mail de demo. */
      var missing = []
      if (!(this.record.contact_name || '').trim())    { missing.push('nombre') }
      if (!(this.record.email || '').trim())            { missing.push('email') }
      if (!(this.record.doc_number || '').trim())       { missing.push('documento') }
      if (!this.record.demo_id)                         { missing.push('demo asignada') }
      if (!this.record.demo_date)                       { missing.push('fecha demo') }
      if (!(this.record.demo_start_time || '').trim())  { missing.push('hora inicio') }
      if (!(this.record.demo_end_time || '').trim())    { missing.push('hora fin') }
      if (missing.length === 0) {
        return null
      }
      return 'Faltan: ' + missing.join(', ') + '.'
    },
    /**
     * API URL del sistema productivo según el perfil Client vinculado (no el lead).
     * @returns {string}
     */
    client_production_api_url() {
      if (!this.record || !this.record.promoted_client) {
        return ''
      }
      return (this.record.promoted_client.api_url || '').trim()
    },
    /**
     * Habilita "Promover a cliente" si el lead aún no tiene Client vinculado.
     * @returns {boolean}
     */
    can_promote_to_client() {
      if (!this.record) {
        return false
      }
      return !this.record.promoted_client_id
    },
    /**
     * Habilita user setup cuando el lead está cerrado ganado, tiene Client vinculado
     * y ese Client tiene API URL cargada en su perfil.
     * @returns {boolean}
     */
    can_run_user_setup() {
      if (!this.record || this.record.status !== 'cerrado_ganado') {
        return false
      }
      if (!this.record.promoted_client_id) {
        return false
      }
      return this.client_production_api_url.length > 0
    },
    /**
     * Habilita "Iniciar implementación" cuando el lead tiene Client promovido sin implementación activa.
     * @returns {boolean}
     */
    can_start_implementation() {
      if (!this.record || !this.record.promoted_client_id) {
        return false
      }
      if (!this.record.promoted_client) {
        return false
      }
      return !this.record.promoted_client.implementation
    },
    /**
     * True cuando el switch maestro "Estoy manejando este lead" está activo, es decir
     * cuando `automatizaciones_demo_activas` vale false (el control se muestra invertido:
     * activarlo el operador significa "no automatizar nada del ciclo de demo").
     * @returns {boolean}
     */
    manual_mode_active() {
      if (!this.record) {
        return false
      }
      return this.record.automatizaciones_demo_activas === false
    },
    /**
     * Tarjetas de estado de los envíos de mail comercial (Mail 1 demo + Mail 2 seguimiento).
     * @returns {Array<Object>}
     */
    mail_status_cards() {
      if (!this.record) {
        return []
      }
      /* Arreglo de tarjetas a renderizar en la sección de correos. */
      var cards = []
      cards.push(
        this.build_mail_status_card(
          'mail_1_demo',
          'Mail 1 - DEMO',
          this.record.demo_mail_sent_at,
          this.record.demo_mail_last_error
        )
      )
      cards.push(
        this.build_mail_status_card(
          'mail_2_followup',
          'Mail 2 - Seguimiento',
          this.record.followup_mail_sent_at,
          this.record.followup_mail_last_error
        )
      )
      return cards
    },
    /**
     * Tarjetas de trazabilidad de demo-setup y user-setup (estado, última corrida, error).
     * @returns {Array<Object>}
     */
    setup_status_cards() {
      if (!this.record) {
        return []
      }
      /* Filas de UI alineadas al formato de mail_status_cards. */
      var rows = []
      rows.push(
        this.build_setup_status_card(
          'demo_setup_remote',
          'Demo setup (ERP demo)',
          this.record.demo_setup_status,
          this.record.demo_setup_last_run_at,
          this.record.demo_setup_last_error
        )
      )
      rows.push(
        this.build_setup_status_card(
          'user_setup_remote',
          'User setup (ERP productiva)',
          this.record.user_setup_status,
          this.record.user_setup_last_run_at,
          this.record.user_setup_last_error
        )
      )
      return rows
    },
  },
  watch: {
    /**
     * Mantiene el input de promoción alineado con api_url del lead tras guardar / recargar.
     */
    record: {
      deep: true,
      handler: function (new_record) {
        if (new_record && new_record.api_url) {
          this.promotion_api_url = new_record.api_url
        }
      },
    },
  },
  methods: {
    /**
     * Ejecuta la acción de una etapa del pipeline sin esperar el scheduler automático.
     * Despacha la acción del store correspondiente y sincroniza el modelo al terminar.
     * @param {Object} stage etapa del pipeline con action y id.
     * @returns {void}
     */
    run_stage_action(stage) {
      var self = this
      /* Si no hay acción o ya hay una etapa cargando, no hacer nada. */
      if (!stage.action || self.loading_stage !== null) {
        return
      }
      self.loading_stage = stage.id

      self.$store.dispatch('lead/' + stage.action, self.record.id)
        .then(function (model) {
          self.sync_model(model)
          self.open_feedback('Acción ejecutada.')
        })
        .catch(function (error) {
          /* Algunas acciones devuelven 422 con modelo actualizado en payload. */
          var payload = error && error.response && error.response.data ? error.response.data : null
          if (payload && payload.model) {
            self.sync_model(payload.model)
          }
          self.open_feedback(self.get_error_message(error))
        })
        .then(function () {
          self.loading_stage = null
        })
    },
    /**
     * Alterna el switch maestro de automatización del lead. Es un caso particular de
     * `toggle_automation_flag` sobre `automatizaciones_demo_activas` (invertido en la UI).
     * @returns {void}
     */
    toggle_master_automation() {
      this.toggle_automation_flag('automatizaciones_demo_activas')
    },
    /**
     * Alterna un flag booleano de automatización del lead (master o por etapa) con
     * actualización optimista en el draft y reversión si el backend rechaza el cambio.
     * Persiste vía `lead/update_lead_automations` (PATCH /lead/{id}/automations, prompt 321),
     * que acepta cambios parciales sin afectar los demás flags.
     * @param {string} flag_key nombre del flag en el lead (p. ej. 'auto_check_ingreso_demo').
     * @returns {void}
     */
    toggle_automation_flag(flag_key) {
      var self = this
      /* Evita disparar un segundo PATCH mientras el anterior sigue en vuelo. */
      if (!self.record || self.toggling_flag) {
        return
      }
      /* Valor previo para poder revertir si el guardado falla. */
      var previous_value = self.record[flag_key]
      var new_value = !previous_value
      self.toggling_flag = flag_key
      /* Actualización optimista: refleja el cambio antes de la confirmación del servidor. */
      self.record[flag_key] = new_value

      var changes = {}
      changes[flag_key] = new_value

      self.$store.dispatch('lead/update_lead_automations', { lead_id: self.record.id, changes: changes })
        .then(function (model) {
          self.sync_model(model)
        })
        .catch(function (error) {
          /* Revertir el valor local si el backend no aceptó el cambio. */
          self.record[flag_key] = previous_value
          self.open_feedback(self.get_error_message(error))
        })
        .then(function () {
          self.toggling_flag = null
        })
    },
    /**
     * Muestra un toast global si existe, con fallback a alert.
     * @param {string} message mensaje de feedback para el usuario.
     * @returns {void}
     */
    open_feedback(message) {
      if (this.$root && this.$root.$emit) {
        this.$root.$emit('open_toast', message)
        return
      }
      alert(message)
    },
    /**
     * Normaliza el mensaje de error de axios para mostrar en UI.
     * @param {any} error error capturado.
     * @returns {string}
     */
    get_error_message(error) {
      return resolve_error_message(error)
    },
    /**
     * Texto del botón de acción de una etapa: primera ejecución o re-ejecución.
     * @param {Object} stage etapa del pipeline.
     * @returns {string}
     */
    stage_action_button_label(stage) {
      if (!stage) {
        return ''
      }
      if (stage.status === 'completed' && stage.allow_repeat && stage.action_label_repeat) {
        return stage.action_label_repeat
      }
      return stage.action_label || ''
    },
    /**
     * Formatea el origen de ejecución (manual / automático) para mostrar en UI.
     * @param {boolean|null|undefined} is_manual true = manual, false = automático, null = desconocido.
     * @returns {string|null}
     */
    format_execution_source(is_manual) {
      if (is_manual === true) {
        return 'Manual'
      }
      if (is_manual === false) {
        return 'Automático'
      }
      return null
    },
    /**
     * Formatea un datetime ISO a solo hora (HH:MM) en timezone Argentina.
     * Usado para mostrar la hora de confirmación de ingreso y fin de demo.
     * @param {string|null} date_value datetime ISO recibido del backend.
     * @returns {string} hora en formato HH:MM, o cadena vacía si no hay valor.
     */
    format_time(date_value) {
      if (!date_value) {
        return ''
      }
      /* Instanciar Date para respetar el offset UTC del campo. */
      var local_date = new Date(date_value)
      if (isNaN(local_date.getTime())) {
        return date_value
      }
      /* Formatear solo la hora en timezone Argentina (es-AR, sin segundos). */
      return local_date.toLocaleTimeString('es-AR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Argentina/Buenos_Aires',
      })
    },
    /**
     * Formatea una fecha ISO a texto legible en español (solo fecha).
     * @param {string|null} date_value fecha recibida del backend.
     * @returns {string}
     */
    format_date(date_value) {
      if (!date_value) {
        return ''
      }
      /* Parsear la fecha como local para evitar desfase por zona horaria. */
      var parts = String(date_value).split('T')[0].split('-')
      if (parts.length === 3) {
        return parts[2] + '/' + parts[1] + '/' + parts[0]
      }
      return date_value
    },
    /**
     * Formatea una fecha/hora a texto legible en español.
     * @param {string|null} date_value fecha recibida del backend.
     * @returns {string}
     */
    format_datetime(date_value) {
      if (!date_value) {
        return 'Nunca'
      }
      /* Instancia Date para formatear la fecha local. */
      var local_date = new Date(date_value)
      if (isNaN(local_date.getTime())) {
        return date_value
      }
      return local_date.toLocaleString('es-AR')
    },
    /**
     * Construye una tarjeta de estado de envío para un mail del lead.
     * @param {string} key clave única para v-for.
     * @param {string} title título visible de la tarjeta.
     * @param {string|null} sent_at fecha de último envío exitoso.
     * @param {string|null} last_error último error registrado al enviar.
     * @returns {Object}
     */
    build_mail_status_card(key, title, sent_at, last_error) {
      /* Objeto base con información común del estado del mail. */
      var card = {
        key: key,
        title: title,
        status_text: 'Pendiente',
        badge_class: 'bg-secondary',
        last_sent_at_text: this.format_datetime(sent_at),
        last_error: last_error || '',
        time_label: 'Último envío',
      }
      /* Si hay error guardado, el último intento fue fallido. */
      if (card.last_error) {
        card.status_text = 'Fallido'
        card.badge_class = 'bg-danger'
        return card
      }
      /* Si no hay error y hay fecha de envío, el estado actual es exitoso. */
      if (sent_at) {
        card.status_text = 'Exitoso'
        card.badge_class = 'bg-success'
      }
      return card
    },
    /**
     * Construye tarjeta de estado para una corrida remota (demo setup / user setup).
     * @param {string} key clave única para v-for.
     * @param {string} title título visible.
     * @param {string|null} status valor persistido (pendiente, ejecutandose, exitoso, fallido).
     * @param {string|null} last_run_at fecha/hora de último intento registrado en servidor.
     * @param {string|null} last_error mensaje de fallo si existe.
     * @returns {Object}
     */
    build_setup_status_card(key, title, status, last_run_at, last_error) {
      /* Estado normalizado en minúsculas para comparar con valores del backend. */
      var normalized_status = (status || 'pendiente').toString().toLowerCase()
      /* Objeto de presentación homogéneo con mail_status_cards. */
      var card = {
        key: key,
        title: title,
        status_text: 'Pendiente',
        badge_class: 'bg-secondary',
        last_sent_at_text: this.format_datetime(last_run_at),
        last_error: last_error || '',
        time_label: 'Última corrida',
      }
      if (card.last_error) {
        card.status_text = 'Fallido'
        card.badge_class = 'bg-danger'
        return card
      }
      if (normalized_status === 'ejecutandose') {
        card.status_text = 'En ejecución'
        card.badge_class = 'bg-warning text-dark'
        return card
      }
      if (normalized_status === 'exitoso') {
        card.status_text = 'Exitoso'
        card.badge_class = 'bg-success'
        return card
      }
      if (normalized_status === 'fallido') {
        card.status_text = 'Fallido'
        card.badge_class = 'bg-danger'
        return card
      }
      return card
    },
    /**
     * Actualiza store y padre con el modelo devuelto por el backend.
     * @param {Object} model lead actualizado.
     * @returns {void}
     */
    sync_model(model) {
      this.$store.dispatch('lead/upsert_model_in_lists', model)
      this.$emit('record-updated', model)
    },
    /**
     * Ejecuta una acción remota del lead con manejo uniforme de estado/errores.
     * Usada por los botones del flujo principal (mail, promover, user setup).
     * @param {string} action_name nombre de acción para spinner.
     * @param {Function} callback función que retorna promise con modelo.
     * @param {string} success_message mensaje de éxito.
     * @returns {void}
     */
    run_action(action_name, callback, success_message) {
      var self = this
      self.loading_action = action_name
      callback()
        .then(function (model) {
          self.sync_model(model)
          self.open_feedback(success_message)
        })
        .catch(function (error) {
          /* Muchas acciones devuelven 422 con `model` actualizado (p. ej. mail fallido o setup fallido). */
          var payload = error && error.response && error.response.data ? error.response.data : null
          if (payload && payload.model) {
            self.sync_model(payload.model)
          }
          self.open_feedback(self.get_error_message(error))
        })
        .then(function () {
          self.loading_action = ''
        })
    },
    /**
     * Envía el "Mail 1 - DEMO" al prospecto con sus credenciales y horario de demo.
     * @returns {void}
     */
    send_demo_mail() {
      var self = this
      /* Validación local: interrumpir si faltan campos obligatorios. */
      var validation_message = self.demo_mail_validation_message
      if (validation_message) {
        self.open_feedback(validation_message)
        return
      }
      self.run_action(
        'demo_mail',
        function () {
          return self.$store.dispatch('lead/send_demo_mail', self.record.id)
        },
        'Mail 1 - DEMO enviado correctamente.'
      )
    },
    /**
     * Envía el mail de seguimiento del lead.
     * @returns {void}
     */
    send_followup_mail() {
      var self = this
      self.run_action(
        'followup',
        function () {
          return self.$store.dispatch('lead/send_followup_mail', self.record.id)
        },
        'Mail de seguimiento enviado.'
      )
    },
    /**
     * Primer paso de la promoción: pide subdominio sugerido a la API y muestra el panel de confirmación.
     * @returns {void}
     */
    request_promote_to_client() {
      var self = this
      if (!self.can_promote_to_client) {
        self.open_feedback('No se puede promover en este momento.')
        return
      }

      /* Nombre de empresa del lead para la sugerencia de subdominio. */
      var company_name = (self.record.company_name || self.record.contact_name || '').trim()

      /* Mostrar spinner mientras se consulta Claude. */
      self.loading_action = 'fetching_subdomain'

      api.post('/client/suggest-subdomain', { company_name: company_name })
        .then(function (res) {
          /* Claude respondió: mostrar su sugerencia en el input editable. */
          self.subdomain_preview = (res.data.subdomain || '').trim()
          self.showing_subdomain_confirm = true
        })
        .catch(function () {
          /* Si la API falla, usar un slug simple del nombre como fallback local. */
          var fallback = company_name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '')
            .substring(0, 20)
          self.subdomain_preview = fallback || 'cliente'
          self.showing_subdomain_confirm = true
        })
        .then(function () {
          self.loading_action = ''
        })
    },
    /**
     * Segundo paso de la promoción: confirma enviando el subdominio editado al backend.
     * @returns {void}
     */
    confirm_promote_to_client() {
      var self = this
      var subdomain = (self.subdomain_preview || '').trim()
      if (!subdomain) {
        self.open_feedback('El subdominio no puede estar vacío.')
        return
      }

      self.run_action(
        'promote_to_client',
        function () {
          return self.$store.dispatch('lead/promote_to_client', {
            lead_id:             self.record.id,
            suggested_subdomain: subdomain,
          })
        },
        'Lead promovido a cliente. Se crearon las tareas automáticas para el equipo.'
      )
      /* Ocultar el panel de confirmación al iniciar la acción. */
      self.showing_subdomain_confirm = false
    },
    /**
     * Cancela el panel de confirmación de subdominio y resetea el estado.
     * @returns {void}
     */
    cancel_subdomain_confirm() {
      this.showing_subdomain_confirm = false
      this.subdomain_preview = ''
    },
    /**
     * Ejecuta el user setup del sistema real.
     * @returns {void}
     */
    run_user_setup() {
      var self = this
      if (!self.can_run_user_setup) {
        if (!self.record.promoted_client_id) {
          self.open_feedback('Primero promové el lead a cliente.')
          return
        }
        self.open_feedback('Cargá la API URL en el perfil del cliente (Clientes) antes de ejecutar user setup.')
        return
      }
      self.run_action(
        'user_setup',
        function () {
          return self.$store.dispatch('lead/run_user_setup', self.record.id)
        },
        'User setup ejecutado.'
      )
    },
    /**
     * Inicia la implementación del cliente promovido y dispara la plantilla de bienvenida por WhatsApp.
     * @returns {void}
     */
    start_implementation() {
      var self = this
      if (!self.can_start_implementation) {
        return
      }
      self.loading_action = 'start_implementation'
      var client_id = self.record.promoted_client_id
      api.post('/client/' + client_id + '/implementation/start')
        .then(function (res) {
          var payload = res && res.data ? res.data : {}
          if (payload.model && self.record.promoted_client) {
            self.record.promoted_client.implementation = payload.model
          }
          self.$emit('record-updated', self.record)
          self.open_feedback('Implementación iniciada correctamente.')
        })
        .catch(function (err) {
          alert(resolve_error_message(err))
        })
        .then(function () {
          self.loading_action = ''
        })
    },
  },
}
</script>

<style scoped>
/* Ícono de estado "en ejecución" con animación de rotación continua */
.rotating-icon {
  display: inline-block;
  animation: spin 1.2s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
/* Contenedor del ícono de estado con ancho fijo para alinear las filas */
.stage-icon {
  width: 1rem;
  text-align: center;
  flex-shrink: 0;
}
/* Elimina el borde inferior de la última etapa del pipeline */
.pipeline-stage-row:last-child {
  border-bottom: none !important;
}
</style>
