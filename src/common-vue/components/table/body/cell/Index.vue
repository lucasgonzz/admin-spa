<template>
  <span
    v-if="prop.type === 'checkbox'"
    :class="raw ? 'text-success' : 'text-muted'"
  >{{ raw ? 'Sí' : 'No' }}</span>
  <span v-else-if="prop.type === 'alert_badge'">
    <span
      v-if="raw"
      class="badge bg-warning text-dark"
      :title="'Seguimientos sin revisar' + (followup_count > 0 ? ': ' + followup_count + ' enviados' : '')"
    >
      <i class="bi bi-clock-history me-1" aria-hidden="true" />
      Seg. <template v-if="followup_count > 0">({{ followup_count }})</template>
    </span>
    <span
      v-else-if="followup_count > 0"
      class="badge bg-secondary"
      :title="followup_count + ' seguimiento(s) enviado(s), ya revisados'"
    >
      <i class="bi bi-clock-history me-1" aria-hidden="true" />
      {{ followup_count }}
    </span>
    <span v-else class="text-muted"></span>
  </span>
  <!-- Badge numérico de mensajes sin leer per-usuario: rojo cuando hay no leídos, guión si no -->
  <span v-else-if="prop.type === 'unread_badge'">
    <span
      v-if="raw_unread_count > 0"
      class="badge bg-danger"
      style="font-size: 0.75em;"
      :title="'Mensajes sin leer: ' + raw_unread_count"
    >{{ raw_unread_count }}</span>
    <span v-else class="text-muted"></span>
  </span>
  <span v-else-if="prop.type === 'pipeline_status'">
    <span
      v-if="pipeline_status_label"
      class="badge pipeline-status-badge"
      :style="pipeline_status_badge_style"
    >{{ pipeline_status_label }}</span>
    <span v-else class="text-muted"></span>
  </span>
  <span v-else-if="link_text !== null" class="text-break">{{ link_text }}</span>
  <span v-else class="text-break">{{ text }}</span>
</template>

<script>
import generals from '@/common-vue/mixins/generals'

/**
 * Render de celda: fechas, FK con etiqueta si viene la relación en el row.
 */
export default {
  name: 'CellRenderer',
  mixins: [generals],
  props: {
    prop: { type: Object, required: true },
    row: { type: Object, required: true },
  },
  computed: {
    raw() {
      return this.row[this.prop.key]
    },
    /**
     * Valor numérico de unread_count para el badge per-usuario.
     * Retorna 0 si el valor es nulo, vacío o no numérico.
     *
     * @returns {number}
     */
    raw_unread_count() {
      const n = parseInt(this.row[this.prop.key], 10)
      return isNaN(n) ? 0 : n
    },
    /**
     * Cantidad de seguimientos enviados para el badge de alerta.
     * Lee la clave declarada en `prop.badge_count_key` del row; 0 si no aplica o no es numérico.
     *
     * @returns {number}
     */
    followup_count() {
      if (!this.prop.badge_count_key) return 0
      const n = parseInt(this.row[this.prop.badge_count_key], 10)
      return isNaN(n) ? 0 : n
    },
    link_text() {
      const k = this.prop.key
      if (k == 'client_id' && this.row.client) {
        return this.row.client.name
      }
      if (k == 'current_version_id' && this.row.current_version) {
        return this.row.current_version.version
      }
      if (k == 'to_version_id' && this.row.to_version) {
        return this.row.to_version.version
      }
      if (k == 'from_version_id' && this.row.from_version) {
        return this.row.from_version ? this.row.from_version.version : '—'
      }
      if (k == 'created_by_admin_id' && this.row.created_by_admin) {
        return this.row.created_by_admin.name
      }
      if (k == 'active_client_api_id' && this.row.active_client_api) {
        return this.row.active_client_api.url
      }
      return null
    },
    text() {
      if (this.raw == null || this.raw === '') {
        return '—'
      }
      // `is_date` viene declarado en ModelProperties del backend (mismo criterio que empresa-spa).
      if (this.prop.is_date) {
        if (this.prop.show_full_date) {
          return this.date(this.raw, true)
        }
        return this.date(this.raw)
      }
      if (this.prop.type === 'date' && this.raw) {
        return this.date(this.raw)
      }
      return this.raw
    },
    /**
     * Opción del catálogo de estados que coincide con el slug del lead.
     * @returns {Object|null}
     */
    pipeline_status_option() {
      if (this.prop.type !== 'pipeline_status' || this.raw == null || this.raw === '') {
        return null
      }
      const slug = String(this.raw)
      const options = this.prop.options || []
      let i = 0
      for (i = 0; i < options.length; i++) {
        if (String(options[i].value) === slug) {
          return options[i]
        }
      }
      return { value: slug, text: slug, color: '#ced4da' }
    },
    /**
     * Etiqueta legible del estado del pipeline.
     * @returns {string}
     */
    pipeline_status_label() {
      const opt = this.pipeline_status_option
      if (!opt) {
        return ''
      }
      return (opt.text || opt.value || '') + ''
    },
    /**
     * Estilos inline del badge según color del catálogo.
     * @returns {Object}
     */
    pipeline_status_badge_style() {
      const opt = this.pipeline_status_option
      const bg = opt && opt.color ? String(opt.color) : '#ced4da'
      return {
        backgroundColor: bg,
        color: contrast_text_for_hex(bg),
      }
    },
  },
}

/**
 * Texto legible sobre fondo hex (negro o blanco según luminancia).
 * @param {string} hex
 * @returns {string}
 */
function contrast_text_for_hex(hex) {
  const raw = (hex || '').replace('#', '').trim()
  if (raw.length !== 6) {
    return '#212529'
  }
  const r = parseInt(raw.substring(0, 2), 16)
  const g = parseInt(raw.substring(2, 4), 16)
  const b = parseInt(raw.substring(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return '#212529'
  }
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#212529' : '#ffffff'
}
</script>

<style scoped>
.pipeline-status-badge {
  font-size: 0.8rem;
  font-weight: 500;
  padding: 0.2em 0.5em;
  white-space: nowrap;
}
</style>
