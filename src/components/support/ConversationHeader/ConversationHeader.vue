<template>
  <!--
    Cabecera del panel: nombre, asignación, estado, Guardar (API) y Salir.
  -->
  <div class="support-conversation-header d-flex align-items-center flex-wrap gap-2 flex-shrink-0 w-100">
    <ticket-source-badge
      v-if="has_ticket"
      :ticket_source="selected_ticket.source || 'erp'" />
    <ticket-name-field
      :has_ticket="has_ticket"
      :ticket_name_draft="ticket_name_draft"
      :ticket_has_name="ticket_has_stored_name"
      @update:ticket_name_draft="on_update_draft" />
    <ticket-assignee-select
      :has_ticket="has_ticket"
      :assigned_admin_id="assigned_admin_id"
      :admin_rows="admin_rows"
      @update:assigned_admin_id="on_update_assignee" />
    <ticket-status-select
      :has_ticket="has_ticket"
      :ticket_status_draft="ticket_status_draft"
      @update:ticket_status_draft="on_update_status" />
    <div class="ms-auto d-flex align-items-center gap-2 flex-shrink-0 ticket-header-actions-end">
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary flex-shrink-0"
        title="Base de conocimiento para sugerencias IA"
        @click="$emit('toggle-knowledge-panel')">
        Base de conocimiento
      </button>
      <button
        type="button"
        class="btn btn-sm btn-primary flex-shrink-0"
        :disabled="!save_button_enabled"
        @click="$emit('save-header')">
        <span v-if="saving_header" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        <span v-else>Guardar</span>
      </button>
      <ticket-conversation-actions :has_ticket="has_ticket" @exit-ticket="$emit('exit-ticket')" />
    </div>
  </div>
</template>

<script>
import TicketNameField from './TicketNameField.vue'
import TicketSourceBadge from './TicketSourceBadge.vue'
import TicketAssigneeSelect from './TicketAssigneeSelect.vue'
import TicketStatusSelect from './TicketStatusSelect.vue'
import TicketConversationActions from './TicketConversationActions.vue'

/**
 * Agrupa controles del hilo y un único guardado HTTP para nombre, asignado y estado.
 */
export default {
  name: 'ConversationHeader',
  components: {
    TicketNameField,
    TicketSourceBadge,
    TicketAssigneeSelect,
    TicketStatusSelect,
    TicketConversationActions,
  },
  /**
   * Vue 3: v-model:prop requiere emitir update:prop; se declara para evitar fallos de two-way.
   */
  emits: [
    'update:ticket_name_draft',
    'update:assigned_admin_id',
    'update:ticket_status_draft',
    'save-header',
    'exit-ticket',
    'toggle-knowledge-panel',
  ],
  props: {
    /**
     * Ticket actual o null.
     */
    selected_ticket: {
      type: Object,
      default: null,
    },
    /**
     * Borrador del nombre en el input.
     */
    ticket_name_draft: {
      type: String,
      default: '',
    },
    /**
     * Id seleccionado en el combo de asignación.
     */
    assigned_admin_id: {
      type: [Number, String],
      default: null,
    },
    /**
     * Estado local open | closed antes del PUT.
     */
    ticket_status_draft: {
      type: String,
      default: 'open',
    },
    /**
     * Lista de admins para el select (desde inbox_nav filtrado).
     */
    admin_rows: {
      type: Array,
      default: function () {
        return []
      },
    },
    /**
     * true mientras corre update_ticket del header.
     */
    saving_header: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    /**
     * Id del operador logueado (misma fuente que Support.vue al abrir el ticket).
     *
     * @returns {number|string|null}
     */
    current_admin_id() {
      const a = this.$store.state.auth && this.$store.state.auth.admin
      return a ? a.id : null
    },
    /**
     * Atajo para condicionar hijos.
     *
     * @returns {boolean}
     */
    has_ticket() {
      return !!this.selected_ticket
    },
    /**
     * true si el ticket en servidor ya tiene nombre (no vacío).
     *
     * @returns {boolean}
     */
    ticket_has_stored_name() {
      const t = this.selected_ticket
      if (!t) {
        return true
      }
      const stored = t.name == null || t.name === undefined ? '' : String(t.name)
      return String(stored).trim() !== ''
    },
    /**
     * Id efectivo almacenado (null en ticket → se muestra operador actual).
     *
     * @returns {number|null}
     */
    effective_stored_assign() {
      const t = this.selected_ticket
      if (!t) {
        return null
      }
      if (t.assigned_admin_id != null && t.assigned_admin_id !== '') {
        return Number(t.assigned_admin_id)
      }
      return this.current_admin_id != null && this.current_admin_id !== '' ? Number(this.current_admin_id) : null
    },
    /**
     * Id efectivo de los controles (misma regla que al abrir el ticket en Support.vue).
     *
     * @returns {number|null}
     */
    effective_draft_assign() {
      if (this.assigned_admin_id != null && this.assigned_admin_id !== '') {
        return Number(this.assigned_admin_id)
      }
      return this.current_admin_id != null && this.current_admin_id !== '' ? Number(this.current_admin_id) : null
    },
    /**
     * Diferencia en nombre respecto al modelo.
     *
     * @returns {boolean}
     */
    name_is_changed() {
      const t = this.selected_ticket
      if (!t) {
        return false
      }
      const stored = t.name == null || t.name === undefined ? '' : String(t.name)
      return String(this.ticket_name_draft).trim() !== String(stored).trim()
    },
    /**
     * Diferencia en asignatario.
     *
     * @returns {boolean}
     */
    assign_is_changed() {
      if (!this.selected_ticket) {
        return false
      }
      const a = this.effective_stored_assign
      const b = this.effective_draft_assign
      if (a == null && b == null) {
        return false
      }
      return String(a) !== String(b)
    },
    /**
     * Diferencia de estado open/closed.
     *
     * @returns {boolean}
     */
    status_is_changed() {
      if (!this.selected_ticket) {
        return false
      }
      const stored = this.selected_ticket.status === 'closed' ? 'closed' : 'open'
      const draft = this.ticket_status_draft === 'closed' ? 'closed' : 'open'
      return stored !== draft
    },
    /**
     * Habilita Guardar: reactivo a borradores locales (evita depender de un prop del padre).
     *
     * @returns {boolean}
     */
    save_button_enabled() {
      if (!this.selected_ticket || this.saving_header) {
        return false
      }
      return this.name_is_changed || this.assign_is_changed || this.status_is_changed
    },
  },
  methods: {
    /**
     * Sincroniza borrador de nombre hacia el padre.
     *
     * @param {string} value Texto del input
     * @returns {void}
     */
    on_update_draft(value) {
      this.$emit('update:ticket_name_draft', value)
    },
    /**
     * Sincroniza admin asignado (v-model:assigned_admin_id hacia abajo).
     *
     * @param {number|null} admin_id Id de operador
     * @returns {void}
     */
    on_update_assignee(admin_id) {
      this.$emit('update:assigned_admin_id', admin_id)
    },
    /**
     * Sincroniza estado del ticket (v-model:ticket_status_draft hacia abajo).
     *
     * @param {string} status open o closed
     * @returns {void}
     */
    on_update_status(status) {
      this.$emit('update:ticket_status_draft', status)
    },
  },
}
</script>
