<template>
  <div class="updates-timeline">
    <!-- Barra superior: crear actualización y slot para acciones extra (p. ej. toggle de vista) -->
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
      <button
        type="button"
        class="btn btn-primary"
        @click="$emit('request-create')"
      >
        <i class="bi bi-plus-lg me-1" aria-hidden="true" />
        Nueva actualización
      </button>
      <slot name="toolbar-right" />
    </div>

    <!-- Estado de carga inicial del store update -->
    <div v-if="loading" class="text-center py-5 text-muted">
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
      Cargando actualizaciones…
    </div>

    <!-- Sin registros -->
    <div
      v-else-if="!grouped.length"
      class="text-center py-5 text-muted border rounded bg-light"
    >
      <i class="bi bi-calendar3 d-block fs-3 mb-2" aria-hidden="true" />
      <p class="mb-1">Todavía no hay actualizaciones programadas.</p>
      <p class="small mb-0">Creá la primera con el botón «Nueva actualización».</p>
    </div>

    <!-- Cards agrupadas por mes y día -->
    <template v-else>
      <div
        v-for="month_group in grouped"
        :key="month_group.month_key"
        class="card mb-4"
      >
        <div class="card-header fw-semibold">
          <i class="bi bi-calendar3 me-2" aria-hidden="true" />
          {{ month_group.month_label }}
        </div>
        <div class="card-body">
          <section
            v-for="day_group in month_group.days"
            :key="day_group.date_key"
            class="updates-timeline__day mb-4"
          >
            <h6 class="text-muted mb-2">{{ day_group.day_label }}</h6>
            <div class="table-responsive">
              <table class="table table-sm table-bordered mb-0">
                <thead class="table-light">
                  <tr>
                    <th style="width: 56px">N°</th>
                    <th>Cliente</th>
                    <th style="width: 120px">A versión</th>
                    <th style="width: 160px">Estado</th>
                    <th style="width: 72px"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="update in day_group.updates"
                    :key="update.id"
                  >
                    <td class="align-middle">{{ update.id }}</td>
                    <td class="align-middle">
                      {{ update.client ? update.client.name : '—' }}
                    </td>
                    <td class="align-middle">
                      {{ format_target_version(update) }}
                    </td>
                    <td class="align-middle">
                      <span
                        class="badge"
                        :class="'bg-' + status_badge_for(update.status)"
                      >
                        {{ status_label_for(update.status) }}
                      </span>
                    </td>
                    <td class="align-middle text-center">
                      <button
                        type="button"
                        class="btn btn-link btn-sm p-0"
                        @click="$emit('request-open', update.id)"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import { STATUS_BADGE, STATUS_LABELS } from '@/utils/update_status'

/**
 * Vista timeline de actualizaciones agrupadas por mes y día según scheduled_date
 * (o created_at como fallback).
 */
export default {
  name: 'UpdatesTimeline',

  props: {
    /** Listado de ClientVersionUpgrade con relaciones client, from_version, to_version. */
    models: {
      type: Array,
      default: function () {
        return []
      },
    },
    /** Indica si el store update está cargando el listado inicial. */
    loading: {
      type: Boolean,
      default: false,
    },
  },

  emits: ['request-create', 'request-open'],

  computed: {
    /**
     * Agrupa actualizaciones por mes y día en orden descendente de fecha.
     *
     * @returns {Array<{ month_key: string, month_label: string, days: Array<Object> }>}
     */
    grouped() {
      const models = this.models || []
      if (!models.length) {
        return []
      }

      /** Pares { update, date_key } con fecha efectiva para agrupar. */
      const dated_items = []

      models.forEach(function (update) {
        /** Fecha programada; si falta, usar la fecha de creación (YYYY-MM-DD). */
        let date_key = update.scheduled_date
        if (!date_key && update.created_at) {
          date_key = String(update.created_at).substring(0, 10)
        }
        if (!date_key) {
          return
        }
        dated_items.push({
          update: update,
          date_key: date_key,
        })
      })

      if (!dated_items.length) {
        return []
      }

      /** Orden global: fecha descendente y, dentro del mismo día, id descendente. */
      dated_items.sort(function (a, b) {
        if (a.date_key !== b.date_key) {
          return a.date_key < b.date_key ? 1 : -1
        }
        const id_a = a.update && a.update.id ? Number(a.update.id) : 0
        const id_b = b.update && b.update.id ? Number(b.update.id) : 0
        return id_b - id_a
      })

      /** Mapa temporal month_key → grupo de mes con días anidados. */
      const month_map = {}
      /** Orden de aparición de meses (ya viene en orden descendente por fecha). */
      const month_order = []

      dated_items.forEach(function (item) {
        /** Parseo local evitando desfase por timezone en fechas sin hora. */
        const date_obj = new Date(item.date_key + 'T00:00:00')
        const month_key = item.date_key.substring(0, 7)
        const month_label = capitalize_first(
          new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(date_obj)
        )
        const day_label = capitalize_first(
          new Intl.DateTimeFormat('es-AR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          }).format(date_obj)
        )

        if (!month_map[month_key]) {
          month_map[month_key] = {
            month_key: month_key,
            month_label: month_label,
            days_map: {},
            day_order: [],
          }
          month_order.push(month_key)
        }

        const month_group = month_map[month_key]
        if (!month_group.days_map[item.date_key]) {
          month_group.days_map[item.date_key] = {
            date_key: item.date_key,
            day_label: day_label,
            updates: [],
          }
          month_group.day_order.push(item.date_key)
        }

        month_group.days_map[item.date_key].updates.push(item.update)
      })

      return month_order.map(function (month_key) {
        const month_group = month_map[month_key]
        const days = []

        month_group.day_order.forEach(function (date_key) {
          days.push(month_group.days_map[date_key])
        })

        return {
          month_key: month_group.month_key,
          month_label: month_group.month_label,
          days: days,
        }
      })
    },
  },

  methods: {
    /**
     * Etiqueta legible del estado del upgrade.
     *
     * @param {string|null} status
     * @returns {string}
     */
    status_label_for(status) {
      if (status && STATUS_LABELS[status]) {
        return STATUS_LABELS[status]
      }
      return status || '—'
    },

    /**
     * Variante Bootstrap del badge según estado.
     *
     * @param {string|null} status
     * @returns {string}
     */
    status_badge_for(status) {
      if (status && STATUS_BADGE[status]) {
        return STATUS_BADGE[status]
      }
      return 'secondary'
    },

    /**
     * Texto de versión destino con prefijo v cuando corresponde.
     *
     * @param {Object} update
     * @returns {string}
     */
    format_target_version(update) {
      if (!update || !update.to_version || !update.to_version.version) {
        return '—'
      }
      const version_text = String(update.to_version.version)
      if (version_text.charAt(0) === 'v') {
        return version_text
      }
      return 'v' + version_text
    },
  },
}

/**
 * Primera letra en mayúscula para etiquetas de Intl en es-AR.
 *
 * @param {string} text
 * @returns {string}
 */
function capitalize_first(text) {
  if (!text) {
    return text
  }
  return text.charAt(0).toUpperCase() + text.slice(1)
}
</script>
