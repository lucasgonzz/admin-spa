<template>
  <div class="card p-3 mb-3">
    <div class="row g-2">
      <div class="col-md-3">
        <small class="text-muted d-block">Cliente</small>
        <span>{{ update.client ? update.client.name : '—' }}</span>
        <small
          v-if="update.client && update.client.user_id"
          class="text-muted d-block"
          title="user_id ComercioCity usado en seeders/comandos per_user"
        >
          user_id: {{ update.client.user_id }}
        </small>
      </div>
      <div class="col-md-2">
        <small class="text-muted d-block">Versión origen</small>
        <span>{{ update.from_version ? update.from_version.version : '—' }}</span>
      </div>
      <div class="col-md-2">
        <small class="text-muted d-block">Versión destino</small>
        <span class="fw-semibold">{{ update.to_version ? update.to_version.version : '—' }}</span>
      </div>
      <div class="col-md-2">
        <small class="text-muted d-block">Sincronizado</small>
        <span>{{ update.synced_at ? format_date(update.synced_at) : '—' }}</span>
      </div>
      <div class="col-md-3">
        <small class="text-muted d-block">Creada por</small>
        <span>{{ update.created_by_admin ? update.created_by_admin.name : '—' }}</span>
        <small class="text-muted d-block">{{ update.created_at ? format_date(update.created_at) : '' }}</small>
      </div>
    </div>
    <template v-if="update.notes">
      <hr class="my-2" />
      <small class="text-muted d-block">Notas</small>
      <div>{{ update.notes }}</div>
    </template>
  </div>
</template>

<script>
/** Tarjeta de información rápida de la actualización: cliente, versiones, fechas, notas. */
export default {
  name: 'UpdateInfoCard',
  props: {
    update: { type: Object, required: true },
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
