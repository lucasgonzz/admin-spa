<template>
  <!-- Barra superior: badge de estado del upgrade + botones de flujo y sincronización -->
  <div class="d-flex align-items-center gap-2 mb-3 flex-wrap">
    <span class="badge fs-6" :class="'bg-' + status_badge">{{ status_label }}</span>
    <div class="ms-auto d-flex gap-2 flex-wrap">
      <!-- Avanzar al siguiente estado del upgrade (pendiente → listo → actualizándose) -->
      <button
        v-if="next_status"
        type="button"
        class="btn btn-primary btn-sm"
        :disabled="loading"
        @click="$emit('advance-status')"
      >
        Avanzar a "{{ next_status_label }}"
      </button>
      <!-- Sincronizar versión al empresa-api del cliente -->
      <button
        v-if="can_sync"
        type="button"
        class="btn btn-success btn-sm"
        :disabled="loading || deploy_loading"
        @click="$emit('sync')"
      >
        <i class="bi bi-arrow-repeat me-1"></i>Sincronizar al cliente
      </button>
    </div>
  </div>
</template>

<script>
import { STATUS_FLOW, STATUS_LABELS, STATUS_BADGE } from '@/utils/update_status'

/**
 * Barra de acciones de estado: badge de estado del upgrade, avanzar al siguiente estado
 * y sincronizar versión al cliente.
 * Los botones de deployment (Comenzar actualización / Continuar) ahora viven en OperationsBoard.
 */
export default {
  name: 'UpdateStatusActions',
  props: {
    /** Modelo del upgrade con status y deployment_status. */
    update: { type: Object, required: true },
    /** Indica si hay una operación genérica en progreso. */
    loading: { type: Boolean, default: false },
    /** Indica si hay una operación de deployment en progreso. */
    deploy_loading: { type: Boolean, default: false },
  },
  emits: ['advance-status', 'sync'],
  computed: {
    /**
     * Etiqueta legible del estado del upgrade.
     * @returns {string}
     */
    status_label() {
      return STATUS_LABELS[this.update.status] || this.update.status
    },
    /**
     * Variante Bootstrap del badge de estado.
     * @returns {string}
     */
    status_badge() {
      return STATUS_BADGE[this.update.status] || 'secondary'
    },
    /**
     * Siguiente estado en el flujo, si existe.
     * @returns {string|null}
     */
    next_status() {
      return STATUS_FLOW[this.update.status] || null
    },
    /**
     * Etiqueta del siguiente estado para mostrar en el botón.
     * @returns {string}
     */
    next_status_label() {
      return this.next_status ? STATUS_LABELS[this.next_status] || this.next_status : ''
    },
    /**
     * Mostrar botón de sincronización solo en estados donde tiene sentido.
     * @returns {boolean}
     */
    can_sync() {
      return ['actualizandose', 'listo_para_actualizar', 'fallida'].includes(this.update.status)
    },
  },
}
</script>
