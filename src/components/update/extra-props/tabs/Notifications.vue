<template>
  <div>
    <p v-if="!items.length" class="text-muted">
      Ninguna versión del rango tiene notificaciones configuradas.
    </p>
    <template v-else>
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <p class="text-muted mb-0">
          <small>
            Estas notificaciones se enviarán al cliente al sincronizar (incluye versiones intermedias del salto).
          </small>
        </p>
        <button
          v-if="copyable_notifications_count > 0"
          type="button"
          class="btn btn-sm btn-outline-primary"
          :disabled="copy_loading"
          @click="copy_all_notifications"
        >
          <i class="bi me-1" :class="copy_feedback ? 'bi-check-lg' : 'bi-clipboard'"></i>
          {{ copy_feedback ? 'Copiado' : 'Copiar mensaje para el cliente' }}
        </button>
      </div>
      <div class="table-responsive">
        <table class="table table-sm table-bordered align-middle">
          <thead>
            <tr>
              <th style="width: 110px">Versión</th>
              <th style="width: 60px">Orden</th>
              <th>Título</th>
              <th>Cuerpo</th>
              <th class="text-center" style="width: 80px">Activa</th>
              <th>Lecturas</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="notif in items" :key="notif.id">
              <td>
                <small class="text-muted">{{ notif.version ? notif.version.version : '—' }}</small>
              </td>
              <td>{{ notif.sort_order }}</td>
              <td>{{ notif.title }}</td>
              <td><small class="text-muted">{{ notif.body }}</small></td>
              <td class="text-center">
                <span v-if="notif.is_active" class="badge bg-success">Sí</span>
                <span v-else class="badge bg-secondary">No</span>
              </td>
              <td>
                <template v-if="!notif.reads || !notif.reads.length">
                  <small class="text-muted">—</small>
                </template>
                <ul v-else class="list-unstyled mb-0 small">
                  <li v-for="(read, idx) in notif.reads" :key="idx">
                    {{ read.client_user_name || read.client_user_email || ('Usuario #' + read.client_user_id) }}
                    <span v-if="read.read_at" class="text-muted">· {{ format_date(read.read_at) }}</span>
                  </li>
                </ul>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script>
import {
  format_notifications_for_clipboard,
  copy_text_to_clipboard,
} from '@/utils/version_notification_clipboard'

/** Pestaña "Notificaciones": notificaciones del rango de versiones con sus lecturas del cliente. */
export default {
  name: 'TabNotifications',
  props: {
    items: { type: Array, default: () => [] },
    /** Upgrade completo (cliente y API destino para el mensaje al copiar). */
    update: { type: Object, default: null },
  },
  data() {
    return {
      /** Indica si hay una copia al portapapeles en curso. */
      copy_loading: false,
      /** Feedback visual breve tras copiar con éxito. */
      copy_feedback: false,
      /** Timer para resetear el estado de feedback del botón. */
      copy_feedback_timer: null,
    }
  },
  computed: {
    /**
     * Cantidad de notificaciones activas que se incluirán al copiar el mensaje.
     *
     * @returns {number}
     */
    copyable_notifications_count() {
      var self = this
      return this.items.filter(function (notif) {
        return notif && notif.is_active !== false
      }).length
    },
  },
  beforeUnmount() {
    if (this.copy_feedback_timer) {
      clearTimeout(this.copy_feedback_timer)
      this.copy_feedback_timer = null
    }
  },
  methods: {
    /**
     * Formatea y copia al portapapeles todas las notificaciones activas del upgrade.
     *
     * @returns {void}
     */
    copy_all_notifications() {
      var self = this
      var message = format_notifications_for_clipboard(self.items, {
        only_active: true,
        update: self.update,
      })

      if (!message) {
        return
      }

      self.copy_loading = true
      copy_text_to_clipboard(message)
        .then(function () {
          self.copy_feedback = true
          if (self.copy_feedback_timer) {
            clearTimeout(self.copy_feedback_timer)
          }
          self.copy_feedback_timer = setTimeout(function () {
            self.copy_feedback = false
            self.copy_feedback_timer = null
          }, 2000)
        })
        .catch(function () {
          alert('No se pudo copiar el mensaje al portapapeles.')
        })
        .then(function () {
          self.copy_loading = false
        })
    },
    /**
     * Formatea una fecha/hora para mostrar en la tabla de lecturas.
     *
     * @param {string|null} val
     * @returns {string}
     */
    format_date(val) {
      if (!val) return ''
      const d = new Date(val)
      return (
        d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
        ' ' +
        d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
      )
    },
  },
}
</script>
