<template>
  <div>
    <p v-if="!items.length" class="text-muted">Ninguna versión del rango tiene tareas manuales.</p>
    <div v-else class="table-responsive">
      <table class="table table-sm table-bordered align-middle">
        <thead>
          <tr>
            <th style="width: 110px">Versión</th>
            <th style="width: 60px">Orden</th>
            <th>Título</th>
            <th>Descripción</th>
            <th class="text-center" style="width: 90px">Requerida</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="task in items" :key="task.id">
            <td><small class="text-muted">{{ task.version ? task.version.version : '—' }}</small></td>
            <td>{{ task.execution_order }}</td>
            <td>{{ task.title }}</td>
            <td><small class="text-muted">{{ task.description }}</small></td>
            <td class="text-center">
              <span v-if="task.is_required" class="badge bg-warning text-dark">Sí</span>
              <span v-else class="text-muted">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
/** Pestaña "Tareas manuales": lectura de tareas de las versiones del rango. */
export default {
  name: 'TabManualTasks',
  props: {
    items: { type: Array, default: () => [] },
  },
}
</script>
