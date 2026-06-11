<template>
  <!--
    Vista de implementaciones de la tienda online (ecommerce).
    Layout de dos paneles: izquierdo con listado, derecho con detalle.
    Sigue el mismo patrón estructural que Implementations.vue.
  -->
  <div class="implementations-view d-flex w-100">

    <!-- Panel izquierdo: listado de implementaciones de ecommerce -->
    <div class="impl-left d-flex flex-column min-h-0">

      <div class="impl-left-top flex-shrink-0">
        <h6 class="mb-0 fw-semibold">Implementaciones de Ecommerce</h6>
      </div>

      <div class="impl-list flex-grow-1 overflow-auto">

        <div v-if="list_loading" class="p-3 text-center text-muted small">
          Cargando...
        </div>

        <div v-else-if="!implementations.length" class="p-3 text-center text-muted small">
          No hay implementaciones de ecommerce registradas.
        </div>

        <div
          v-for="impl in implementations"
          :key="impl.id"
          class="impl-list-row"
          :class="{
            'impl-list-row--selected': selected_id == impl.id,
            'impl-list-row--ready': check_ready_to_advance(impl),
          }"
          @click="select_implementation(impl.id)"
        >
          <div class="impl-list-row__client fw-semibold text-truncate">
            {{ client_display_name(impl) }}
          </div>

          <div class="d-flex align-items-center gap-2 mt-1">
            <span class="badge" :class="stage_badge_class(impl)">
              Etapa {{ impl.current_stage }}
            </span>
            <span class="small text-muted text-truncate">{{ current_stage_name(impl) }}</span>
          </div>

          <div v-if="check_ready_to_advance(impl)" class="mt-1">
            <span class="badge bg-danger">⚠️ Lista para avanzar etapa</span>
          </div>

          <div class="small text-muted mt-1">
            {{ days_since_label(impl.started_at) }}
          </div>
        </div>

      </div>
    </div>

    <!-- Panel derecho: detalle de la implementación seleccionada -->
    <div class="impl-right d-flex flex-column min-h-0 flex-grow-1">

      <div
        v-if="!selected_id"
        class="d-flex align-items-center justify-content-center flex-grow-1 text-muted"
      >
        Seleccioná una implementación para ver el detalle.
      </div>

      <div
        v-else-if="detail_loading"
        class="d-flex align-items-center justify-content-center flex-grow-1 text-muted"
      >
        Cargando...
      </div>

      <template v-else-if="selected_implementation">

        <!-- Header del panel derecho -->
        <div class="impl-right-top flex-shrink-0">
          <div class="d-flex align-items-start justify-content-between gap-2">
            <div>
              <h5 class="mb-1">{{ client_display_name(selected_implementation) }}</h5>
              <span class="badge" :class="status_badge_class(selected_implementation.status)">
                {{ status_label(selected_implementation.status) }}
              </span>
            </div>

            <button
              v-if="selected_implementation.status === 'in_progress' && selected_implementation.current_stage < total_stages"
              class="btn btn-primary btn-sm flex-shrink-0"
              :disabled="advancing_stage"
              @click="on_advance_stage"
            >
              {{ advancing_stage ? 'Avanzando...' : 'Avanzar etapa' }}
            </button>
          </div>
        </div>

        <!-- Tabs Resumen / Conversación -->
        <div class="impl-right-nav flex-shrink-0">
          <div class="impl-detail-tab-bar" role="tablist">
            <button
              type="button"
              role="tab"
              class="impl-detail-tab-btn"
              :class="{ 'impl-detail-tab-btn--active': detail_panel_tab === 'summary' }"
              :aria-selected="detail_panel_tab === 'summary'"
              @click="detail_panel_tab = 'summary'"
            >
              Resumen
            </button>
            <button
              type="button"
              role="tab"
              class="impl-detail-tab-btn"
              :class="{ 'impl-detail-tab-btn--active': detail_panel_tab === 'conversation' }"
              :aria-selected="detail_panel_tab === 'conversation'"
              @click="detail_panel_tab = 'conversation'"
            >
              Conversación
            </button>
          </div>
        </div>

        <!-- Cuerpo scrolleable -->
        <div class="impl-right-body flex-grow-1 overflow-auto">

          <!-- Resumen: etapas + datos de la tienda -->
          <template v-if="detail_panel_tab === 'summary'">

            <h6 class="impl-section-title">Etapas</h6>
            <div class="impl-stages mb-4">
              <div
                v-for="stage in selected_implementation.stages"
                :key="stage.id"
                class="impl-stage-row d-flex align-items-start gap-2"
              >
                <span class="impl-stage-icon flex-shrink-0">{{ stage_icon(stage.status) }}</span>
                <div class="flex-grow-1">
                  <span class="fw-semibold small">
                    Etapa {{ stage.stage_number }}
                    <span v-if="stage.config" class="text-muted fw-normal">— {{ stage.config.name }}</span>
                  </span>
                  <div v-if="stage.status === 'completed' && stage.completed_at" class="small text-muted">
                    Completada {{ format_date(stage.completed_at) }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Datos de la tienda (client_ecommerce) -->
            <template v-if="selected_implementation.client_ecommerce">
              <h6 class="impl-section-title">Tienda online</h6>
              <div class="card mb-4">
                <div class="card-body">
                  <dl class="row mb-0 small">
                    <dt class="col-sm-4 text-muted">Dominio</dt>
                    <dd class="col-sm-8">{{ selected_implementation.client_ecommerce.domain || '—' }}</dd>
                    <dt class="col-sm-4 text-muted">Estado</dt>
                    <dd class="col-sm-8">{{ ecommerce_status_label(selected_implementation.client_ecommerce.status) }}</dd>
                    <template v-if="selected_implementation.client_ecommerce.spa_url">
                      <dt class="col-sm-4 text-muted">URL tienda</dt>
                      <dd class="col-sm-8">
                        <a :href="selected_implementation.client_ecommerce.spa_url" target="_blank" rel="noopener">
                          {{ selected_implementation.client_ecommerce.spa_url }}
                        </a>
                      </dd>
                    </template>
                  </dl>
                </div>
              </div>
            </template>

            <!-- Configuración recolectada (Etapa 1) -->
            <template v-if="setup_entries.length">
              <h6 class="impl-section-title">Configuración de la tienda (Etapa 1)</h6>
              <div class="card mb-4">
                <div class="card-body">
                  <dl class="row mb-0 small">
                    <template v-for="entry in setup_entries" :key="entry.key">
                      <dt class="col-sm-5 text-muted">{{ entry.label }}</dt>
                      <dd class="col-sm-7">{{ entry.value }}</dd>
                    </template>
                  </dl>
                </div>
              </div>
            </template>

            <!-- Acción destructiva al pie -->
            <div class="impl-delete-section mt-4 pt-3 border-top">
              <button
                type="button"
                class="btn btn-outline-danger btn-sm"
                :disabled="deleting_implementation"
                @click="on_delete_implementation"
              >
                {{ deleting_implementation ? 'Eliminando...' : 'Eliminar implementación' }}
              </button>
              <p class="small text-muted mb-0 mt-2">
                Se borrarán etapas, mensajes y datos recolectados. Esta acción no se puede deshacer.
              </p>
            </div>

          </template>

          <!-- Conversación -->
          <template v-if="detail_panel_tab === 'conversation'">

            <h6 class="impl-section-title">Conversación</h6>

            <div
              v-if="!selected_implementation.messages || !selected_implementation.messages.length"
              class="text-muted small mb-3"
            >
              Sin mensajes registrados.
            </div>

            <div v-else class="impl-messages">
              <template
                v-for="(message, index) in selected_implementation.messages"
                :key="message.id"
              >
                <div
                  v-if="index === 0 || selected_implementation.messages[index - 1].stage_number !== message.stage_number"
                  class="impl-stage-separator text-center text-muted small"
                >
                  — Etapa {{ message.stage_number }} —
                </div>

                <div
                  class="d-flex mb-2"
                  :class="message.direction === 'outbound' ? 'justify-content-end' : 'justify-content-start'"
                >
                  <div
                    class="impl-bubble"
                    :class="message.direction === 'outbound' ? 'impl-bubble--outbound' : 'impl-bubble--inbound'"
                  >
                    <div class="impl-bubble__body">{{ message.body }}</div>
                    <div class="impl-bubble__time">{{ format_date(message.sent_at) }}</div>
                  </div>
                </div>
              </template>
            </div>

          </template>

        </div>
      </template>

    </div>
  </div>
</template>

<script>
import api from '@/utils/axios'

/**
 * Etiquetas legibles de los campos recolectados en la configuración de la tienda.
 */
const SETUP_LABELS = {
  domain: 'Dominio',
  online_price_type_id: 'Visibilidad de precios',
  register_to_buy: 'Registro para comprar',
  has_delivery: 'Entregas a domicilio',
  retiro_por_local: 'Retiro en el local',
  enviar_whatsapp_al_terminar_pedido: 'Aviso de pedido por WhatsApp',
  social_networks: 'Redes sociales',
  instagram: 'Instagram',
  facebook: 'Facebook',
  quienes_somos: 'Quiénes somos',
}

/**
 * Etiquetas de las opciones de visibilidad de precios online.
 */
const ONLINE_PRICE_TYPE_LABELS = {
  1: 'Cualquier persona',
  2: 'Solo usuarios registrados',
  3: 'Solo clientes cargados',
}

export default {
  name: 'ViewEcommerceImplementations',
  data() {
    return {
      // Listado de implementaciones de ecommerce.
      implementations: [],
      // Id de la implementación seleccionada en el panel derecho.
      selected_id: null,
      // Implementación cargada en detalle.
      selected_implementation: null,
      // Estados de carga / acción.
      list_loading: false,
      detail_loading: false,
      advancing_stage: false,
      deleting_implementation: false,
      // Pestaña activa del panel de detalle.
      detail_panel_tab: 'summary',
      // Cantidad total de etapas del flujo de ecommerce.
      total_stages: 5,
      // Canal Pusher suscrito (para teardown).
      _ecommerce_channel: null,
    }
  },
  computed: {
    /**
     * Lista clave/valor legible de la configuración recolectada (ecommerce_setup_data).
     *
     * @returns {Array<{key: string, label: string, value: string}>}
     */
    setup_entries() {
      const impl = this.selected_implementation
      if (!impl || !impl.client_ecommerce || !impl.client_ecommerce.ecommerce_setup_data) {
        return []
      }

      const data = impl.client_ecommerce.ecommerce_setup_data
      const entries = []

      Object.keys(SETUP_LABELS).forEach((key) => {
        if (!(key in data)) {
          return
        }
        const value = this.format_setup_value(key, data[key])
        if (value !== null) {
          entries.push({ key: key, label: SETUP_LABELS[key], value: value })
        }
      })

      return entries
    },
  },
  created() {
    this.load_list()
  },
  mounted() {
    this.setup_pusher()
  },
  beforeUnmount() {
    this.teardown_pusher()
  },
  methods: {
    /**
     * Carga el listado de implementaciones de ecommerce.
     *
     * @returns {void}
     */
    load_list() {
      const self = this
      this.list_loading = true
      api
        .get('/ecommerce-implementation')
        .then(function (res) {
          self.implementations = (res.data && res.data.models) || []
        })
        .finally(function () {
          self.list_loading = false
        })
    },
    /**
     * Selecciona una implementación y carga su detalle.
     *
     * @param {number} id Id de la implementación.
     * @returns {void}
     */
    select_implementation(id) {
      this.selected_id = id
      this.detail_panel_tab = 'summary'
      this.load_detail(id)
    },
    /**
     * Carga el detalle completo de una implementación.
     *
     * @param {number} id Id de la implementación.
     * @returns {void}
     */
    load_detail(id) {
      const self = this
      this.detail_loading = true
      this.selected_implementation = null
      api
        .get('/ecommerce-implementation/' + id)
        .then(function (res) {
          self.selected_implementation = (res.data && res.data.model) || null
        })
        .finally(function () {
          self.detail_loading = false
        })
    },
    /**
     * Avanza la implementación a la siguiente etapa.
     *
     * @returns {void}
     */
    on_advance_stage() {
      const self = this
      const id = this.selected_id
      if (!id) {
        return
      }
      this.advancing_stage = true
      api
        .post('/ecommerce-implementation/' + id + '/advance-stage')
        .then(function (res) {
          const model = (res.data && res.data.model) || null
          self.selected_implementation = model
          self.merge_into_list(model)
          self.$store.commit('ecommerce_implementation/decrement_ready_to_advance_count')
        })
        .finally(function () {
          self.advancing_stage = false
        })
    },
    /**
     * Elimina la implementación seleccionada tras confirmación.
     *
     * @returns {void}
     */
    on_delete_implementation() {
      const self = this
      const id = this.selected_id
      if (!id) {
        return
      }
      const client_name = this.client_display_name(this.selected_implementation)
      if (!window.confirm('¿Eliminar la implementación de ecommerce de ' + client_name + '? Esta acción no se puede deshacer.')) {
        return
      }
      this.deleting_implementation = true
      api
        .delete('/ecommerce-implementation/' + id)
        .then(function () {
          self.implementations = self.implementations.filter(function (i) {
            return i.id !== id
          })
          self.selected_id = null
          self.selected_implementation = null
        })
        .finally(function () {
          self.deleting_implementation = false
        })
    },
    /**
     * Reemplaza una implementación dentro del listado por su versión actualizada.
     *
     * @param {object|null} model Implementación actualizada.
     * @returns {void}
     */
    merge_into_list(model) {
      if (!model) {
        return
      }
      const idx = this.implementations.findIndex(function (i) {
        return i.id === model.id
      })
      if (idx !== -1) {
        this.implementations.splice(idx, 1, model)
      }
    },
    /**
     * Indica si una implementación está lista para avanzar (etapa activa completada).
     *
     * @param {object} impl Implementación con stages cargados.
     * @returns {boolean}
     */
    check_ready_to_advance(impl) {
      if (!impl || !impl.stages || impl.current_stage >= this.total_stages) {
        return false
      }
      let ready = false
      impl.stages.forEach(function (stage) {
        if (stage.stage_number == impl.current_stage && stage.status === 'completed') {
          ready = true
        }
      })
      return ready
    },
    /**
     * Nombre a mostrar del cliente asociado a una implementación.
     *
     * @param {object} impl Implementación con relación client cargada.
     * @returns {string}
     */
    client_display_name(impl) {
      if (!impl || !impl.client) {
        return 'Cliente desconocido'
      }
      return impl.client.company_name || impl.client.name || 'Sin nombre'
    },
    /**
     * Nombre de la etapa actual de una implementación.
     *
     * @param {object} impl Implementación con stages y stages.config cargados.
     * @returns {string}
     */
    current_stage_name(impl) {
      if (!impl || !impl.stages) {
        return ''
      }
      let name = ''
      impl.stages.forEach(function (stage) {
        if (stage.stage_number == impl.current_stage && stage.config) {
          name = stage.config.name || ''
        }
      })
      return name
    },
    /**
     * Clase del badge de etapa según el estado de la implementación.
     *
     * @param {object} impl Implementación.
     * @returns {string}
     */
    stage_badge_class(impl) {
      return this.status_badge_class(impl ? impl.status : '')
    },
    /**
     * Clase Bootstrap del badge de estado.
     *
     * @param {string} status Estado de la implementación.
     * @returns {string}
     */
    status_badge_class(status) {
      if (status === 'in_progress') return 'bg-primary'
      if (status === 'completed') return 'bg-success'
      return 'bg-secondary'
    },
    /**
     * Etiqueta legible del estado de una implementación.
     *
     * @param {string} status Estado raw.
     * @returns {string}
     */
    status_label(status) {
      if (status === 'in_progress') return 'En progreso'
      if (status === 'completed') return 'Completada'
      if (status === 'pending') return 'Pendiente'
      return status || '—'
    },
    /**
     * Etiqueta legible del estado de despliegue de la tienda.
     *
     * @param {string} status Estado del client_ecommerce.
     * @returns {string}
     */
    ecommerce_status_label(status) {
      if (status === 'active') return 'Activa'
      if (status === 'installing') return 'Instalando'
      if (status === 'pending') return 'Pendiente'
      return status || '—'
    },
    /**
     * Ícono emoji del estado de una etapa.
     *
     * @param {string} status Estado de la etapa.
     * @returns {string}
     */
    stage_icon(status) {
      if (status === 'completed') return '✅'
      if (status === 'in_progress') return '🔵'
      return '⬜'
    },
    /**
     * Formatea un valor de configuración a texto legible según su clave.
     *
     * @param {string} key Clave del campo.
     * @param {*} value Valor recolectado.
     * @returns {string|null} Texto legible, o null si no se debe mostrar.
     */
    format_setup_value(key, value) {
      if (key === 'online_price_type_id') {
        return ONLINE_PRICE_TYPE_LABELS[value] || String(value)
      }
      if (key === 'social_networks') {
        return value === 'none' ? 'No tiene / no comparte' : 'Sí'
      }
      if (key === 'quienes_somos') {
        return value ? String(value) : 'No agrega sección'
      }
      if (typeof value === 'boolean') {
        return value ? 'Sí' : 'No'
      }
      if (value === null || value === '') {
        return null
      }
      return String(value)
    },
    /**
     * Formatea una fecha ISO a string legible (es-AR) con hora.
     *
     * @param {string|null} date_string Fecha ISO o null.
     * @returns {string}
     */
    format_date(date_string) {
      if (!date_string) {
        return '—'
      }
      const date = new Date(date_string)
      if (isNaN(date.getTime())) {
        return '—'
      }
      return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    },
    /**
     * Días transcurridos desde el inicio en label legible.
     *
     * @param {string|null} started_at Fecha ISO de inicio.
     * @returns {string}
     */
    days_since_label(started_at) {
      if (!started_at) {
        return 'Sin iniciar'
      }
      const start = new Date(started_at)
      if (isNaN(start.getTime())) {
        return '—'
      }
      const days = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24))
      if (days === 0) return 'Inicio hoy'
      if (days === 1) return 'Hace 1 día'
      return 'Hace ' + days + ' días'
    },
    /**
     * Se suscribe al canal Pusher `admin-implementations` para refrescar en tiempo real
     * la lista cuando se completa una etapa o llega un mensaje de ecommerce.
     *
     * @returns {void}
     */
    setup_pusher() {
      const self = this
      const echo = window.admin_support_echo
      if (!echo) {
        return
      }
      this._ecommerce_channel = echo.channel('admin-implementations')

      // Al completarse una etapa de ecommerce: refrescar lista y detalle si corresponde.
      this._ecommerce_channel.listen('.ecommerce.implementation.stage.completed', function () {
        self.load_list()
        if (self.selected_id) {
          self.load_detail(self.selected_id)
        }
      })

      // Al llegar/enviarse un mensaje: refrescar el detalle abierto.
      this._ecommerce_channel.listen('.ecommerce.implementation.message.received', function (payload) {
        if (self.selected_id && payload && payload.ecommerce_implementation_id == self.selected_id) {
          self.load_detail(self.selected_id)
        }
      })
    },
    /**
     * Libera la suscripción Pusher.
     *
     * @returns {void}
     */
    teardown_pusher() {
      const echo = window.admin_support_echo
      if (echo && this._ecommerce_channel) {
        echo.leave('admin-implementations')
      }
      this._ecommerce_channel = null
    },
  },
}
</script>

<style scoped>
/* Reutiliza los mismos tokens visuales que Implementations.vue. */
.implementations-view {
  height: calc(100dvh - 2.5rem);
  max-height: calc(100dvh - 2.5rem);
  min-height: 0;
  box-sizing: border-box;
  overflow: hidden;
}

.impl-left {
  width: 30%;
  border-right: 1px solid #e9ecef;
  min-width: 280px;
}

.impl-left-top {
  padding: 10px 12px;
  border-bottom: 1px solid #e9ecef;
}

.impl-list-row {
  padding: 10px 12px;
  border-bottom: 1px solid #f1f3f5;
  cursor: pointer;
  transition: background-color 0.1s ease;
}

.impl-list-row:hover {
  background-color: #f8f9fa;
}

.impl-list-row--selected {
  background-color: #e7f1ff;
}

.impl-list-row--ready {
  background-color: #fee2e2;
  border-left: 5px solid #dc3545;
  animation: impl-ready-pulse 2.4s ease-in-out infinite;
}

.impl-list-row--ready:hover {
  background-color: #fecaca;
  animation: none;
}

@keyframes impl-ready-pulse {
  0%, 100% { background-color: #fee2e2; }
  50%      { background-color: #fecaca; }
}

.impl-list-row__client {
  font-size: 0.9rem;
}

.impl-right {
  min-width: 0;
  flex: 1 1 0;
}

.impl-right-top {
  padding: 12px 16px;
  border-bottom: 1px solid #e9ecef;
}

.impl-right-nav {
  padding: 10px 16px 12px;
  background-color: #fff;
  border-bottom: 1px solid #e9ecef;
}

.impl-detail-tab-bar {
  display: flex;
  gap: 6px;
  padding: 4px;
  background-color: #f1f3f5;
  border-radius: 8px;
}

.impl-detail-tab-btn {
  flex: 1 1 0;
  border: none;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.25;
  color: #6c757d;
  background-color: transparent;
  transition: color 0.12s ease, background-color 0.12s ease, box-shadow 0.12s ease;
}

.impl-detail-tab-btn:hover:not(.impl-detail-tab-btn--active) {
  color: #0d6efd;
  background-color: #e7f1ff;
}

.impl-detail-tab-btn--active {
  color: #fff;
  background-color: #0d6efd;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(13, 110, 253, 0.28);
}

.impl-detail-tab-btn--active:hover {
  color: #fff;
  background-color: #0b5ed7;
}

.impl-right-body {
  padding: 16px;
}

.impl-section-title {
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.05em;
  color: #6c757d;
  margin-bottom: 8px;
}

.impl-stage-row {
  padding: 4px 0;
  margin-bottom: 4px;
}

.impl-stage-icon {
  font-size: 1rem;
  width: 1.4rem;
  text-align: center;
}

.impl-stage-separator {
  font-size: 0.75rem;
  color: #6c757d;
  border-top: 1px solid #e9ecef;
  padding-top: 6px;
  margin: 8px 0 4px;
}

.impl-bubble {
  max-width: 70%;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 0.875rem;
}

.impl-bubble--outbound {
  background-color: #0d6efd;
  color: white;
  border-bottom-right-radius: 2px;
}

.impl-bubble--inbound {
  background-color: #e9ecef;
  color: #212529;
  border-bottom-left-radius: 2px;
}

.impl-bubble__body {
  white-space: pre-wrap;
  word-break: break-word;
}

.impl-bubble__time {
  font-size: 0.7rem;
  margin-top: 3px;
  opacity: 0.7;
  text-align: right;
}

.impl-delete-section {
  max-width: 320px;
}
</style>
