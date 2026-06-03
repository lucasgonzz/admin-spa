<template>
  <div>
    <p v-if="!items.length" class="text-muted">Esta versión no tiene seeders asociados.</p>
    <div v-else class="table-responsive">
      <table class="table table-sm table-bordered align-middle">
        <thead>
          <tr>
            <th style="width: 110px">Versión</th>
            <th>Seeder</th>
            <th>Descripción</th>
            <th class="text-center" style="width: 90px">Estado</th>
            <th style="width: 140px">Ejecutado</th>
            <th style="width: 180px"></th>
          </tr>
        </thead>
        <seeder-row
          v-for="item in items"
          :key="item.id"
          :item="item"
          :client="client"
          :loading="loading"
          @mark="$emit('mark-seeder', $event)"
        />
      </table>
    </div>
  </div>
</template>

<script>
import SeederRow from '../items/SeederRow.vue'

/**
 * Pestaña "Seeders": lista los UpdateSeeders de la actualización.
 * SeederRow se inserta como <tbody> para poder incluir la fila de fallo colapsable.
 */
export default {
  name: 'TabSeeders',
  components: { SeederRow },
  props: {
    items: { type: Array, default: () => [] },
    client: { type: Object, default: null },
    loading: { type: Boolean, default: false },
  },
  emits: ['mark-seeder'],
}
</script>
