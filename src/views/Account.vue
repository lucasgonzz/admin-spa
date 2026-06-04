<template>
  <div class="account-page" v-if="admin">
    <h1 class="h4 mb-3">Cuenta</h1>
    <p class="text-muted small mb-4">{{ admin.name }} — {{ admin.email }}</p>

    <!-- Preferencias personales -->
    <section class="account-section account-section--narrow mb-4">
      <h2 class="h6 text-uppercase text-muted mb-3">Preferencias</h2>

      <div class="card mb-3">
        <div class="card-body">
          <h3 class="h6 card-title">Soporte</h3>
          <p class="text-muted small">
            Los tickets nuevos que se abren cuando un usuario escribe desde empresa se asignan al operador marcado
            como responsable por defecto. Solo puede haber uno a la vez.
          </p>
          <div class="form-check mt-2">
            <input
              class="form-check-input"
              type="checkbox"
              id="default_support_owner"
              :disabled="saving_support"
              :checked="!!admin.is_default_support_owner"
              @change="on_toggle_default_support"
            />
            <label class="form-check-label" for="default_support_owner">
              Responsable por defecto de los mensajes de soporte
            </label>
          </div>
          <p v-if="saving_support" class="text-muted small mt-2 mb-0">Guardando…</p>
          <p v-else-if="error_support" class="text-danger small mt-2 mb-0">{{ error_support }}</p>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <h3 class="h6 card-title">Tareas</h3>
          <p class="text-muted small">
            Al crear una nueva tarea, el operador marcado como asignatario por defecto se preselecciona
            automáticamente. Solo puede haber uno a la vez.
          </p>
          <div class="form-check mt-2">
            <input
              class="form-check-input"
              type="checkbox"
              id="default_task_assignee"
              :disabled="saving_tasks"
              :checked="!!admin.is_default_task_assignee"
              @change="on_toggle_default_task_assignee"
            />
            <label class="form-check-label" for="default_task_assignee">
              Asignatario por defecto de nuevas tareas
            </label>
          </div>
          <p v-if="saving_tasks" class="text-muted small mt-2 mb-0">Guardando…</p>
          <p v-else-if="error_tasks" class="text-danger small mt-2 mb-0">{{ error_tasks }}</p>
        </div>
      </div>
    </section>

    <!-- Configuraciones del sistema -->
    <section class="account-section mb-4">
      <h2 class="h6 text-uppercase text-muted mb-3">Configuración</h2>

      <div id="support-alert-settings" class="card mb-3 account-config-card">
        <div class="card-body">
          <h3 class="h6 card-title">Configuración de soporte</h3>
          <support-alert-settings-section />
        </div>
      </div>

      <div id="support-ai-settings" class="card mb-3 account-config-card">
        <div class="card-body">
          <h3 class="h6 card-title">IA de soporte</h3>
          <support-ai-settings-section />
        </div>
      </div>

      <div id="lead-whatsapp-onboarding" class="card mb-3 account-config-card">
        <div class="card-body">
          <h3 class="h6 card-title">Mensajes automáticos de leads (WhatsApp)</h3>
          <lead-whatsapp-onboarding-section ref="lead_whatsapp_onboarding_section" />
        </div>
      </div>

      <div id="followup-rules" class="card mb-3 account-config-card">
        <div class="card-body">
          <h3 class="h6 card-title">Reglas de seguimiento</h3>
          <p class="text-muted small mb-3">
            Tiempo máximo de inactividad del lead por estado antes de que el sistema sugiera un seguimiento
            automático vía IA.
          </p>
          <followup-rules-section />
        </div>
      </div>

      <div id="protocol-entries" class="card mb-3 account-config-card">
        <div class="card-body">
          <h3 class="h6 card-title">Protocolo de ventas</h3>
          <p class="text-muted small mb-3">
            Entradas del protocolo usadas por la IA para responder leads: etapas, seguimientos y situaciones
            frecuentes.
          </p>
          <protocol-entries-section />
        </div>
      </div>

      <div id="ai-system-prompt" class="card mb-3 account-config-card">
        <div class="card-body">
          <h3 class="h6 card-title">System Prompt IA</h3>
          <p class="text-muted small mb-3">
            Texto base enviado a Claude como system prompt. Las entradas de protocolo y la sección FAQ post-demo se
            generan automáticamente en el servidor.
          </p>
          <ai-system-prompt-section ref="ai_system_prompt_section" />
        </div>
      </div>

      <div id="task-templates" class="card mb-3 account-config-card">
        <div class="card-body">
          <h3 class="h6 card-title">Plantillas de tareas</h3>
          <p class="text-muted small mb-3">
            Se crean automáticamente al promover un lead a cliente. Podés filtrar por proceso, reordenar y activar o
            desactivar cada plantilla.
          </p>
          <task-templates-section />
        </div>
      </div>

      <div id="implementation-settings" class="card mb-3 account-config-card">
        <div class="card-body">
          <h3 class="h6 card-title">Implementaciones</h3>
          <implementation-settings-section />
        </div>
      </div>
    </section>
  </div>
</template>

<script>
import FollowupRulesSection from '@/components/account/sections/FollowupRulesSection.vue'
import SupportAlertSettingsSection from '@/components/account/sections/SupportAlertSettingsSection.vue'
import SupportAiSettingsSection from '@/components/account/sections/SupportAiSettingsSection.vue'
import ProtocolEntriesSection from '@/components/account/sections/ProtocolEntriesSection.vue'
import AiSystemPromptSection from '@/components/account/sections/AiSystemPromptSection.vue'
import TaskTemplatesSection from '@/components/account/sections/TaskTemplatesSection.vue'
import LeadWhatsappOnboardingSection from '@/components/account/sections/LeadWhatsappOnboardingSection.vue'
import ImplementationSettingsSection from '@/components/account/sections/ImplementationSettingsSection.vue'

/** Anclas de sección admitidas en /cuenta#... (compatibilidad con rutas antiguas). */
const ACCOUNT_SECTION_HASHES = [
  'support-alert-settings',
  'support-ai-settings',
  'lead-whatsapp-onboarding',
  'followup-rules',
  'protocol-entries',
  'ai-system-prompt',
  'task-templates',
  'implementation-settings',
]

/**
 * Vista de cuenta: preferencias del operador y configuraciones del sistema agrupadas en secciones.
 */
export default {
  name: 'ViewAccount',
  components: {
    FollowupRulesSection,
    SupportAlertSettingsSection,
    SupportAiSettingsSection,
    ProtocolEntriesSection,
    AiSystemPromptSection,
    TaskTemplatesSection,
    LeadWhatsappOnboardingSection,
    ImplementationSettingsSection,
  },
  data() {
    return {
      /** Indica request PUT /me en curso para la sección de soporte. */
      saving_support: false,
      /** Último error de soporte para mostrar bajo su checkbox. */
      error_support: null,
      /** Indica request PUT /me en curso para la sección de tareas. */
      saving_tasks: false,
      /** Último error de tareas para mostrar bajo su checkbox. */
      error_tasks: null,
    }
  },
  computed: {
    admin() {
      return this.$store.state.auth.admin
    },
  },
  mounted() {
    const self = this
    // Refresca perfil para traer flags actualizados si el token es antiguo.
    this.$store.dispatch('auth/me').catch(function () {})
    this.$nextTick(function () {
      self.scroll_to_hash_section()
    })
  },
  watch: {
    /**
     * Desplaza al ancla cuando cambia el hash estando ya en Cuenta.
     */
    '$route.hash'() {
      this.scroll_to_hash_section()
    },
  },
  beforeRouteLeave(to, from, next) {
    const ai_section = this.$refs.ai_system_prompt_section
    if (ai_section && ai_section.has_unsaved_changes) {
      if (window.confirm('¿Salir sin guardar los cambios del System Prompt IA?')) {
        next()
      } else {
        next(false)
      }
      return
    }
    const whatsapp_section = this.$refs.lead_whatsapp_onboarding_section
    if (whatsapp_section && whatsapp_section.has_unsaved_changes) {
      if (window.confirm('¿Salir sin guardar los cambios de los mensajes automáticos de WhatsApp?')) {
        next()
      } else {
        next(false)
      }
      return
    }
    next()
  },
  methods: {
    /**
     * Desplaza suavemente a la sección indicada en el hash de la URL (#followup-rules, etc.).
     *
     * @returns {void}
     */
    scroll_to_hash_section() {
      const raw = (this.$route.hash || '').replace(/^#/, '')
      if (!raw || ACCOUNT_SECTION_HASHES.indexOf(raw) === -1) {
        return
      }
      const el = document.getElementById(raw)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    },

    /**
     * Alterna el flag is_default_support_owner del admin autenticado.
     *
     * @param {Event} event Evento change del checkbox.
     */
    on_toggle_default_support(event) {
      const input = event.target
      const is_default_support_owner = input.checked
      const self = this
      self.saving_support = true
      self.error_support = null
      this.$store
        .dispatch('auth/update_profile', { is_default_support_owner: is_default_support_owner })
        .then(function () {
          self.saving_support = false
        })
        .catch(function (err) {
          self.saving_support = false
          input.checked = !is_default_support_owner
          const msg =
            (err.response && err.response.data && (err.response.data.message || err.response.data.error)) ||
            'No se pudo guardar. Probá de nuevo.'
          self.error_support = typeof msg === 'string' ? msg : 'Error al guardar.'
        })
    },

    /**
     * Alterna el flag is_default_task_assignee del admin autenticado.
     *
     * @param {Event} event Evento change del checkbox.
     */
    on_toggle_default_task_assignee(event) {
      const input = event.target
      const is_default_task_assignee = input.checked
      const self = this
      self.saving_tasks = true
      self.error_tasks = null
      this.$store
        .dispatch('auth/update_profile', { is_default_task_assignee: is_default_task_assignee })
        .then(function () {
          self.saving_tasks = false
        })
        .catch(function (err) {
          self.saving_tasks = false
          input.checked = !is_default_task_assignee
          const msg =
            (err.response && err.response.data && (err.response.data.message || err.response.data.error)) ||
            'No se pudo guardar. Probá de nuevo.'
          self.error_tasks = typeof msg === 'string' ? msg : 'Error al guardar.'
        })
    },
  },
}
</script>

<style scoped>
.account-section--narrow {
  max-width: 36rem;
}

.account-config-card {
  scroll-margin-top: 1rem;
}
</style>
