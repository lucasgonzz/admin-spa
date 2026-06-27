<template>
  <span
    v-if="prop.type === 'checkbox'"
    :class="raw ? 'text-success' : 'text-muted'"
  >{{ raw ? 'Sí' : 'No' }}</span>
  <span v-else-if="prop.type === 'alert_badge'">
    <span
      v-if="raw"
      class="badge lead-badge bg-warning text-dark"
      :title="'Seguimientos sin revisar' + (followup_count > 0 ? ': ' + followup_count + ' enviados' : '')"
    >
      <i class="bi bi-clock-history me-1" aria-hidden="true" />
      Seg. <template v-if="followup_count > 0">({{ followup_count }})</template>
    </span>
    <span
      v-else-if="followup_count > 0"
      class="badge lead-badge bg-secondary"
      :title="followup_count + ' seguimiento(s) enviado(s), ya revisados'"
    >
      <i class="bi bi-clock-history me-1" aria-hidden="true" />
      {{ followup_count }}
    </span>
    <span v-else class="text-muted"></span>
  </span>
  <!-- Doble badge per-usuario: rojo = mensajes del lead sin leer; gris = actividad total no vista -->
  <span v-else-if="prop.type === 'unread_badge'" class="d-flex gap-1 align-items-center">
    <!-- Badge rojo: solo mensajes recibidos del lead sin leer por el admin -->
    <span
      v-if="raw_unread_count > 0"
      class="badge lead-badge bg-danger"
      style="font-size: 0.75em;"
      :title="'Mensajes del lead sin leer: ' + raw_unread_count"
    >{{ raw_unread_count }}</span>
    <!-- Badge gris: actividad total no vista (cualquier emisor) que supera los del lead -->
    <span
      v-if="raw_unseen_count > raw_unread_count"
      class="badge lead-badge bg-secondary"
      style="font-size: 0.75em;"
      :title="'Actividad no vista (total): ' + raw_unseen_count"
    >{{ raw_unseen_count }}</span>
    <!-- Sin actividad pendiente -->
    <span v-if="raw_unread_count === 0 && raw_unseen_count === 0" class="text-muted"></span>
  </span>
  <span v-else-if="prop.type === 'pipeline_status'">
    <span
      v-if="pipeline_status_label"
      class="badge lead-badge pipeline-status-badge"
      :style="pipeline_status_badge_style"
    >{{ pipeline_status_label }}</span>
    <span v-else class="text-muted"></span>
  </span>
  <!-- Botón ícono que navega a una ruta interna (router-link): usado p. ej. para ir a la conversación WhatsApp -->
  <span v-else-if="prop.type === 'router_link_btn'">
    <router-link
      v-if="row.id"
      :to="resolve_router_link(prop, row)"
      class="btn btn-sm btn-outline-success icon-cell-btn"
      :title="prop.btn_title || ''"
      @click.stop
    >
      <i :class="'bi ' + (prop.btn_icon || 'bi-link')" aria-hidden="true" />
    </router-link>
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
     * Cantidad de mensajes de cualquier emisor sin "seen" por el admin logueado.
     * Alimenta el badge gris de actividad total no vista.
     * Retorna 0 si la prop no define unseen_count_key o el valor no es numérico.
     *
     * @returns {number}
     */
    raw_unseen_count() {
      if (!this.prop.unseen_count_key) return 0
      const n = parseInt(this.row[this.prop.unseen_count_key], 10)
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
        return this.row.from_version ? this.row.from_version.version : ''
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
        return ''
      }
      // Tipo `day`: fecha corta con día de la semana (p. ej. demo_date en leads).
      if (this.prop.type === 'day') {
        return this.date_with_weekday(this.raw)
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
      const text_color = contrast_text_for_hex(bg)
      const border_alpha = text_color === '#ffffff' ? '0.22' : '0.12'
      return {
        backgroundColor: bg,
        color: text_color,
        borderColor: text_color === '#ffffff'
          ? 'rgba(255, 255, 255, ' + border_alpha + ')'
          : 'rgba(0, 0, 0, ' + border_alpha + ')',
      }
    },
  },
  methods: {
    /**
     * Construye el objeto de ruta para `router-link` a partir de los metadatos de la prop.
     * Permite configurar la ruta y sus params desde ModelProperties (ej. LeadProperties)
     * sin tocar el CellRenderer.
     *
     * @param {Object} prop Definición de propiedad con route_name, route_param_key, route_param_value_key.
     * @param {Object} row Fila de la tabla.
     * @returns {Object} Objeto de ruta compatible con vue-router ({ name, params }).
     */
    resolve_router_link(prop, row) {
      if (!prop.route_name) {
        return '/'
      }
      /* Construir los params dinámicos: la clave del param se toma de `route_param_key`
         y su valor se lee de la columna `route_param_value_key` en la fila. */
      const params = {}
      if (prop.route_param_key && prop.route_param_value_key) {
        params[prop.route_param_key] = row[prop.route_param_value_key]
      }
      return { name: prop.route_name, params: params }
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
/* Fallback mínimo fuera de `.lead-module` (p. ej. otras tablas con router_link_btn). */
.icon-cell-btn {
  width: 1.9rem;
  height: 1.9rem;
  padding: 0;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>
