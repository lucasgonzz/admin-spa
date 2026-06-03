<template>
  <!--
    Selector de operador asignado: una opción por admin (nombre legible).
  -->
  <select
    class="form-select form-select-sm ticket-assignee-select"
    :disabled="!has_ticket"
    :value="assignee_value_for_dom"
    @change="on_change">
    <option
      v-for="opt in normalized_options"
      :key="'admin-opt-' + String(opt.assigned_admin_id)"
      :value="String(opt.assigned_admin_id)">
      {{ opt.display_name }}
    </option>
  </select>
</template>

<script>
/**
 * Combo de reasignación: lista completa de admins (nombre + id estable en value).
 */
export default {
  name: 'TicketAssigneeSelect',
  props: {
    /**
     * Ticket abierto o null (deshabilita el select).
     */
    has_ticket: {
      type: Boolean,
      default: false,
    },
    /**
     * Id del admin asignado en UI (puede coincidir con null en servidor; el padre normaliza).
     */
    assigned_admin_id: {
      type: [Number, String],
      default: null,
    },
    /**
     * Filas tipo inbox_nav: { assigned_admin_id, display_name } solo operadores con id.
     */
    admin_rows: {
      type: Array,
      default: function () {
        return []
      },
    },
  },
  computed: {
    /**
     * Opciones con id numérico y etiqueta; deduplica por id.
     *
     * @returns {Array<{assigned_admin_id: number, display_name: string}>}
     */
    normalized_options() {
      const seen = {}
      const out = []
      const rows = Array.isArray(this.admin_rows) ? this.admin_rows : []
      rows.forEach(function (row) {
        if (!row || row.assigned_admin_id == null) {
          return
        }
        const aid = parseInt(row.assigned_admin_id, 10)
        if (isNaN(aid) || seen[aid]) {
          return
        }
        seen[aid] = true
        const label = row.display_name != null && String(row.display_name).trim() !== '' ? String(row.display_name) : 'Admin #' + aid
        out.push({
          assigned_admin_id: aid,
          display_name: label,
        })
      })
      const current = this.assigned_admin_id
      if (current != null && current !== '') {
        const cid = parseInt(current, 10)
        if (!isNaN(cid) && !seen[cid]) {
          out.push({
            assigned_admin_id: cid,
            display_name: 'Admin #' + cid,
          })
        }
      }
      out.sort(function (a, b) {
        return String(a.display_name).localeCompare(String(b.display_name), 'es', { sensitivity: 'base' })
      })
      return out
    },
    /**
     * Valor string para el select HTML (siempre string para consistencia con option :value).
     *
     * @returns {string}
     */
    assignee_value_for_dom() {
      const v = this.assigned_admin_id
      if (v == null || v === '') {
        return ''
      }
      return String(v)
    },
  },
  methods: {
    /**
     * Actualiza solo el borrador local (.sync); el PUT ocurre al guardar el header.
     *
     * @param {Event} event Change del select
     * @returns {void}
     */
    on_change(event) {
      const raw = event && event.target ? event.target.value : ''
      if (raw === '') {
        this.$emit('update:assigned_admin_id', null)
        return
      }
      const n = parseInt(raw, 10)
      this.$emit('update:assigned_admin_id', isNaN(n) ? null : n)
    },
  },
}
</script>

<style scoped>
.ticket-assignee-select {
  max-width: 260px;
}
</style>
