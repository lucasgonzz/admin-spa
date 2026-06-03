<template>
  <div>
    <p v-if="!items.length" class="text-muted">
      Ninguna versión del rango tiene notificaciones configuradas.
    </p>
    <template v-else>
      <p class="text-muted mb-3">
        <small>
          Estas notificaciones se enviarán al cliente al sincronizar (incluye versiones intermedias del salto).
        </small>
      </p>
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
/** Pestaña "Notificaciones": notificaciones del rango de versiones con sus lecturas del cliente. */
export default {
  name: 'TabNotifications',
  props: {
    items: { type: Array, default: () => [] },
  },
  methods: {
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
