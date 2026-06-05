<template>
  <div class="account-page" v-if="admin">
    <header class="account-page__header mb-3 mb-md-4">
      <h1 class="h4 mb-1">Cuenta</h1>
      <p class="text-muted small mb-0">{{ admin.name }} — {{ admin.email }}</p>
    </header>

    <div class="account-page__layout d-flex flex-column flex-md-row gap-3 gap-md-4">
      <aside class="account-page__nav flex-shrink-0">
        <account-section-nav
          :active_section="active_section"
          @select="on_select_section"
        />
      </aside>

      <div class="account-page__content flex-grow-1 min-w-0">
        <!-- Preferencias personales -->
        <section
          v-show="active_section === 'preferences'"
          id="preferences"
          class="account-section account-section--narrow"
        >
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

        <!-- Configuración de soporte: alertas -->
        <section
          v-show="active_section === 'support-alert-settings'"
          id="support-alert-settings"
          class="account-section"
        >
          <div class="card account-config-card">
            <div class="card-body">
              <h2 class="h6 card-title">Configuración de soporte</h2>
              <support-alert-settings-section />
            </div>
          </div>
        </section>

        <!-- Configuración de soporte: IA -->
        <section
          v-show="active_section === 'support-ai-settings'"
          id="support-ai-settings"
          class="account-section"
        >
          <div class="card account-config-card">
            <div class="card-body">
              <h2 class="h6 card-title">IA de soporte</h2>
              <support-ai-settings-section />
            </div>
          </div>
        </section>

        <!-- Leads: WhatsApp onboarding -->
        <section
          v-show="active_section === 'lead-whatsapp-onboarding'"
          id="lead-whatsapp-onboarding"
          class="account-section"
        >
          <div class="card account-config-card">
            <div class="card-body">
              <h2 class="h6 card-title">Mensajes automáticos de leads (WhatsApp)</h2>
              <lead-whatsapp-onboarding-section ref="lead_whatsapp_onboarding_section" />
            </div>
          </div>
        </section>

        <!-- Leads: reglas de seguimiento -->
        <section
          v-show="active_section === 'followup-rules'"
          id="followup-rules"
          class="account-section"
        >
          <div class="card account-config-card">
            <div class="card-body">
              <h2 class="h6 card-title">Reglas de seguimiento</h2>
              <p class="text-muted small mb-3">
                Tiempo máximo de inactividad del lead por estado antes de que el sistema sugiera un seguimiento
                automático vía IA.
              </p>
              <followup-rules-section />
            </div>
          </div>
        </section>

        <!-- Leads: protocolo de ventas -->
        <section
          v-show="active_section === 'protocol-entries'"
          id="protocol-entries"
          class="account-section"
        >
          <div class="card account-config-card">
            <div class="card-body">
              <h2 class="h6 card-title">Protocolo de ventas</h2>
              <p class="text-muted small mb-3">
                Entradas del protocolo usadas por la IA para responder leads: etapas, seguimientos y situaciones
                frecuentes.
              </p>
              <protocol-entries-section />
            </div>
          </div>
        </section>

        <!-- Leads: system prompt -->
        <section
          v-show="active_section === 'ai-system-prompt'"
          id="ai-system-prompt"
          class="account-section"
        >
          <div class="card account-config-card">
            <div class="card-body">
              <h2 class="h6 card-title">System Prompt IA</h2>
              <p class="text-muted small mb-3">
                Texto base enviado a Claude como system prompt. Las entradas de protocolo y la sección FAQ post-demo se
                generan automáticamente en el servidor.
              </p>
              <ai-system-prompt-section ref="ai_system_prompt_section" />
            </div>
          </div>
        </section>

        <!-- Operaciones: plantillas de tareas -->
        <section
          v-show="active_section === 'task-templates'"
          id="task-templates"
          class="account-section"
        >
          <div class="card account-config-card">
            <div class="card-body">
              <h2 class="h6 card-title">Plantillas de tareas</h2>
              <p class="text-muted small mb-3">
                Se crean automáticamente al promover un lead a cliente. Podés filtrar por proceso, reordenar y activar o
                desactivar cada plantilla.
              </p>
              <task-templates-section />
            </div>
          </div>
        </section>

        <!-- Operaciones: implementaciones -->
        <section
          v-show="active_section === 'implementation-settings'"
          id="implementation-settings"
          class="account-section"
        >
          <div class="card account-config-card">
            <div class="card-body">
              <h2 class="h6 card-title">Implementaciones</h2>
              <implementation-settings-section />
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script>
import AccountSectionNav from '@/components/account/AccountSectionNav.vue'
import {
  resolve_account_section_from_hash,
  ACCOUNT_DEFAULT_SECTION_ID,
} from '@/components/account/account_sections'
import FollowupRulesSection from '@/components/account/sections/FollowupRulesSection.vue'
import SupportAlertSettingsSection from '@/components/account/sections/SupportAlertSettingsSection.vue'
import SupportAiSettingsSection from '@/components/account/sections/SupportAiSettingsSection.vue'
import ProtocolEntriesSection from '@/components/account/sections/ProtocolEntriesSection.vue'
import AiSystemPromptSection from '@/components/account/sections/AiSystemPromptSection.vue'
import TaskTemplatesSection from '@/components/account/sections/TaskTemplatesSection.vue'
import LeadWhatsappOnboardingSection from '@/components/account/sections/LeadWhatsappOnboardingSection.vue'
import ImplementationSettingsSection from '@/components/account/sections/ImplementationSettingsSection.vue'

/**
 * Vista de cuenta: preferencias del operador y configuraciones del sistema en secciones navegables.
 */
export default {
  name: 'ViewAccount',
  components: {
    AccountSectionNav,
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
      /** Sección visible según hash de URL o selección en la barra lateral. */
      active_section: ACCOUNT_DEFAULT_SECTION_ID,
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
    this.sync_active_section_from_route()
    this.$nextTick(function () {
      self.ensure_route_hash_matches_section()
    })
  },
  watch: {
    /**
     * Cambia la sección visible cuando el hash de la URL cambia (redirects antiguos o navegación del browser).
     */
    '$route.hash'() {
      this.sync_active_section_from_route()
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
     * Actualiza active_section leyendo el hash actual de vue-router.
     *
     * @returns {void}
     */
    sync_active_section_from_route() {
      this.active_section = resolve_account_section_from_hash(this.$route.hash)
    },

    /**
     * Si la URL no tiene hash, lo normaliza al id de la sección activa (p. ej. #preferences).
     *
     * @returns {void}
     */
    ensure_route_hash_matches_section() {
      const expected_hash = '#' + this.active_section
      if (this.$route.hash === expected_hash) {
        return
      }
      this.$router.replace({ hash: expected_hash }).catch(function () {})
    },

    /**
     * Cambia la sección visible y sincroniza el hash para bookmarks y redirects antiguos.
     *
     * @param {string} section_id Id de sección (sin #).
     * @returns {void}
     */
    on_select_section(section_id) {
      if (this.active_section === section_id) {
        return
      }
      this.active_section = section_id
      const next_hash = '#' + section_id
      if (this.$route.hash !== next_hash) {
        this.$router.push({ hash: next_hash }).catch(function () {})
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

@media (min-width: 768px) {
  .account-page__nav {
    width: 14rem;
  }
}

@media (max-width: 767.98px) {
  .account-page__nav {
    overflow-x: auto;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid #dee2e6;
  }
}
</style>
