<template>
  <!--
    Vista de implementaciones guiadas de clientes.
    Layout de dos paneles: izquierdo con listado, derecho con detalle completo.
    Sigue el mismo patrón estructural que Support.vue.
  -->
  <div class="implementations-view d-flex w-100">

    <!-- Panel izquierdo: listado de implementaciones -->
    <div class="impl-left d-flex flex-column min-h-0">

      <!-- Encabezado del panel izquierdo -->
      <div class="impl-left-top flex-shrink-0">
        <h6 class="mb-0 fw-semibold">Implementaciones</h6>
      </div>

      <!-- Lista con scroll propio -->
      <div class="impl-list flex-grow-1 overflow-auto">

        <!-- Estado: cargando lista -->
        <div v-if="list_loading" class="p-3 text-center text-muted small">
          Cargando...
        </div>

        <!-- Estado: lista vacía -->
        <div v-else-if="!implementations.length" class="p-3 text-center text-muted small">
          No hay implementaciones registradas.
        </div>

        <!-- Fila por implementación -->
        <div
          v-for="impl in implementations"
          :key="impl.id"
          class="impl-list-row"
          :class="{ 'impl-list-row--selected': selected_id == impl.id }"
          @click="select_implementation(impl.id)"
        >
          <!-- Nombre del cliente -->
          <div class="impl-list-row__client fw-semibold text-truncate">
            {{ client_display_name(impl) }}
          </div>

          <!-- Badge de etapa actual + nombre desde stages.config -->
          <div class="d-flex align-items-center gap-2 mt-1">
            <span class="badge" :class="stage_badge_class(impl)">
              Etapa {{ impl.current_stage }}
            </span>
            <span class="small text-muted text-truncate">{{ current_stage_name(impl) }}</span>
          </div>

          <!-- Días desde inicio -->
          <div class="small text-muted mt-1">
            {{ days_since_label(impl.started_at) }}
          </div>
        </div>

      </div>
    </div>

    <!-- Panel derecho: detalle de la implementación seleccionada -->
    <div class="impl-right d-flex flex-column min-h-0 flex-grow-1">

      <!-- Sin selección activa -->
      <div
        v-if="!selected_id"
        class="d-flex align-items-center justify-content-center flex-grow-1 text-muted"
      >
        Seleccioná una implementación para ver el detalle.
      </div>

      <!-- Cargando detalle -->
      <div
        v-else-if="detail_loading"
        class="d-flex align-items-center justify-content-center flex-grow-1 text-muted"
      >
        Cargando...
      </div>

      <!-- Detalle cargado -->
      <template v-else-if="selected_implementation">

        <!-- Header del panel derecho -->
        <div class="impl-right-top flex-shrink-0">
          <div class="d-flex align-items-start justify-content-between gap-2">
            <div>
              <!-- Nombre del cliente en grande -->
              <h5 class="mb-1">{{ client_display_name(selected_implementation) }}</h5>
              <!-- Badge de estado general de la implementación -->
              <span class="badge" :class="status_badge_class(selected_implementation.status)">
                {{ status_label(selected_implementation.status) }}
              </span>
            </div>

            <!--
              Botón avanzar etapa: solo visible si la implementación está activa
              y la etapa actual es menor a 7 (la última etapa cierra automáticamente).
            -->
            <button
              v-if="selected_implementation.status === 'in_progress' && selected_implementation.current_stage < 7"
              class="btn btn-primary btn-sm flex-shrink-0"
              :disabled="advancing_stage"
              @click="on_advance_stage"
            >
              {{ advancing_stage ? 'Avanzando...' : 'Avanzar etapa' }}
            </button>
          </div>
        </div>

        <!-- Cuerpo con scroll propio: etapas, datos y conversación -->
        <div class="impl-right-body flex-grow-1 overflow-auto">

          <!-- Sección: progreso visual de las 7 etapas -->
          <h6 class="impl-section-title">Etapas</h6>
          <div class="impl-stages mb-4">
            <div
              v-for="stage in selected_implementation.stages"
              :key="stage.id"
              class="impl-stage-row d-flex align-items-start gap-2"
            >
              <!-- Ícono emoji según estado de la etapa -->
              <span class="impl-stage-icon flex-shrink-0">{{ stage_icon(stage.status) }}</span>

              <div class="flex-grow-1">
                <!-- Número y nombre de la etapa desde config -->
                <span class="fw-semibold small">
                  Etapa {{ stage.stage_number }}
                  <span v-if="stage.config" class="text-muted fw-normal">— {{ stage.config.name }}</span>
                </span>

                <!--
                  Badge de recordatorios: visible solo si la etapa está en curso
                  y se enviaron uno o más recordatorios de alerta.
                -->
                <span
                  v-if="stage.status === 'in_progress' && stage.alert_count > 0"
                  class="badge bg-warning text-dark ms-2 small"
                >
                  {{ stage.alert_count }} recordatorio{{ stage.alert_count !== 1 ? 's' : '' }}
                </span>

                <!-- Fecha de completado para etapas cerradas -->
                <div v-if="stage.status === 'completed' && stage.completed_at" class="small text-muted">
                  Completada {{ format_date(stage.completed_at) }}
                </div>
              </div>
            </div>
          </div>

          <!-- Sección: datos recolectados en etapa 1 (si existen) -->
          <template v-if="stage_1_data">
            <h6 class="impl-section-title">Datos recolectados (Etapa 1)</h6>
            <div class="card mb-4">
              <div class="card-body">
                <dl class="row mb-0 small">

                  <!-- Nombre de empresa -->
                  <template v-if="stage_1_data.company_name != null">
                    <dt class="col-sm-4 text-muted">Empresa</dt>
                    <dd class="col-sm-8">{{ stage_1_data.company_name || '—' }}</dd>
                  </template>

                  <!-- Listas de precios: sí/no + detalle si aplica -->
                  <template v-if="stage_1_data.price_lists != null">
                    <dt class="col-sm-4 text-muted">Listas de precios</dt>
                    <dd class="col-sm-8">
                      <template v-if="is_truthy(stage_1_data.price_lists)">
                        Sí
                        <span v-if="stage_1_data.price_lists_detail" class="text-muted ms-1">
                          — {{ stage_1_data.price_lists_detail }}
                        </span>
                      </template>
                      <template v-else>No</template>
                    </dd>
                  </template>

                  <!-- Depósitos: sí/no + nombres si aplica -->
                  <template v-if="stage_1_data.deposits != null">
                    <dt class="col-sm-4 text-muted">Depósitos</dt>
                    <dd class="col-sm-8">
                      <template v-if="is_truthy(stage_1_data.deposits)">
                        Sí
                        <span v-if="stage_1_data.deposits_names" class="text-muted ms-1">
                          — {{ stage_1_data.deposits_names }}
                        </span>
                      </template>
                      <template v-else>No</template>
                    </dd>
                  </template>

                  <!-- Descuentos por método de pago -->
                  <template v-if="stage_1_data.payment_method_discounts != null">
                    <dt class="col-sm-4 text-muted">Descuentos por pago</dt>
                    <dd class="col-sm-8">{{ stage_1_data.payment_method_discounts || '—' }}</dd>
                  </template>

                  <!-- Empleados (texto libre) -->
                  <template v-if="stage_1_data.employees != null">
                    <dt class="col-sm-4 text-muted">Empleados</dt>
                    <dd class="col-sm-8">{{ stage_1_data.employees || '—' }}</dd>
                  </template>

                  <!-- Logo recibido: sí/no -->
                  <template v-if="stage_1_data.logo_received != null">
                    <dt class="col-sm-4 text-muted">Logo recibido</dt>
                    <dd class="col-sm-8">{{ is_truthy(stage_1_data.logo_received) ? 'Sí' : 'No' }}</dd>
                  </template>

                  <!-- Cantidad en venta: preguntar / 1 unidad -->
                  <template v-if="stage_1_data.sale_quantity != null">
                    <dt class="col-sm-4 text-muted">Cantidad en venta</dt>
                    <dd class="col-sm-8">{{ stage_1_data.sale_quantity || '—' }}</dd>
                  </template>

                  <!-- Cuenta corriente por defecto: sí/no -->
                  <template v-if="stage_1_data.default_current_account != null">
                    <dt class="col-sm-4 text-muted">Cuenta corriente</dt>
                    <dd class="col-sm-8">
                      {{ is_truthy(stage_1_data.default_current_account) ? 'Sí' : 'No' }}
                    </dd>
                  </template>

                </dl>
              </div>
            </div>
          </template>

          <!-- Sección: conversación de mensajes WhatsApp del flujo -->
          <h6 class="impl-section-title">Conversación</h6>

          <!-- Sin mensajes -->
          <div
            v-if="!selected_implementation.messages || !selected_implementation.messages.length"
            class="text-muted small mb-3"
          >
            Sin mensajes registrados.
          </div>

          <!-- Lista de burbujas con separadores por etapa -->
          <div v-else class="impl-messages">
            <template
              v-for="(message, index) in selected_implementation.messages"
              :key="message.id"
            >
              <!--
                Separador de etapa: se muestra la primera vez que aparece una etapa
                o cuando cambia respecto al mensaje anterior.
              -->
              <div
                v-if="index === 0 || selected_implementation.messages[index - 1].stage_number !== message.stage_number"
                class="impl-stage-separator text-center text-muted small"
              >
                — Etapa {{ message.stage_number }} —
              </div>

              <!-- Burbuja de mensaje: derecha = outbound, izquierda = inbound -->
              <div
                class="d-flex mb-2"
                :class="message.direction === 'outbound' ? 'justify-content-end' : 'justify-content-start'"
              >
                <div
                  class="impl-bubble"
                  :class="message.direction === 'outbound' ? 'impl-bubble--outbound' : 'impl-bubble--inbound'"
                >
                  <!-- Contenido del mensaje -->
                  <div class="impl-bubble__body">{{ message.body }}</div>
                  <!-- Timestamp del mensaje -->
                  <div class="impl-bubble__time">{{ format_date(message.sent_at) }}</div>
                </div>
              </div>
            </template>
          </div>

        </div>
      </template>

    </div>
  </div>
</template>

<script>
import api from '@/utils/axios'

export default {
  name: 'ViewImplementations',

  data() {
    return {
      /**
       * Lista completa de implementaciones cargada desde GET /implementation.
       */
      implementations: [],

      /**
       * ID de la implementación actualmente seleccionada en el panel izquierdo.
       */
      selected_id: null,

      /**
       * Detalle completo de la implementación activa (con stages, messages, etc.).
       */
      selected_implementation: null,

      /**
       * Indicador de carga mientras se obtiene el listado desde la API.
       */
      list_loading: false,

      /**
       * Indicador de carga mientras se obtiene el detalle de una implementación.
       */
      detail_loading: false,

      /**
       * Indicador de operación en curso al avanzar manualmente de etapa.
       */
      advancing_stage: false,

      /**
       * Referencia al canal Pusher suscrito (admin-implementations).
       * Se guarda para poder hacer leave() al desmontar la vista.
       */
      _pusher_channel: null,
    }
  },

  computed: {
    /**
     * Datos recolectados en la etapa 1 del detalle activo.
     *
     * Devuelve el campo `data` de la etapa con stage_number === 1
     * si existe y no es null. De lo contrario devuelve null.
     *
     * @returns {Object|null}
     */
    stage_1_data() {
      if (!this.selected_implementation || !this.selected_implementation.stages) {
        return null
      }

      /** Dato encontrado en la etapa 1. */
      let found = null

      this.selected_implementation.stages.forEach(function (stage) {
        if (stage.stage_number === 1 && stage.data != null) {
          found = stage.data
        }
      })

      return found
    },
  },

  created() {
    /* Cargar listado al montar la vista. */
    this.load_list()
  },

  mounted() {
    /* Suscribirse al canal Pusher para recibir eventos en tiempo real. */
    this.setup_pusher_subscription()
  },

  beforeUnmount() {
    /* Liberar el canal Pusher al desmontar para evitar listeners colgados. */
    this.teardown_pusher_subscription()
  },

  methods: {
    /**
     * Carga la lista de implementaciones desde GET /implementation.
     * Ordena y presenta en el panel izquierdo.
     *
     * @returns {void}
     */
    load_list() {
      const self = this
      this.list_loading = true

      api
        .get('/implementation')
        .then(function (res) {
          self.implementations = res.data.models || []

          /* Si la implementación seleccionada ya no existe en la nueva lista, limpiar panel derecho. */
          if (self.selected_id) {
            const still_exists = self.implementations.find(function (i) {
              return i.id == self.selected_id
            })
            if (!still_exists) {
              self.selected_id = null
              self.selected_implementation = null
            }
          }
        })
        .catch(function () {
          self.implementations = []
        })
        .then(function () {
          self.list_loading = false
        })
    },

    /**
     * Selecciona una implementación del listado y carga su detalle.
     * Si ya está seleccionada, no recarga.
     *
     * @param {number|string} id ID de la implementación a seleccionar.
     * @returns {void}
     */
    select_implementation(id) {
      if (this.selected_id == id) {
        return
      }

      this.selected_id = id
      this.selected_implementation = null
      this.load_detail(id)
    },

    /**
     * Carga el detalle de una implementación desde GET /implementation/{id}.
     *
     * @param {number|string} id ID de la implementación.
     * @returns {void}
     */
    load_detail(id) {
      const self = this
      this.detail_loading = true

      api
        .get('/implementation/' + id)
        .then(function (res) {
          self.selected_implementation = res.data.model || null
        })
        .catch(function () {
          self.selected_implementation = null
        })
        .then(function () {
          self.detail_loading = false
        })
    },

    /**
     * Solicita confirmación y avanza a la siguiente etapa de la implementación activa.
     *
     * Al confirmar, hace POST /implementation/{id}/advance-stage, actualiza el detalle
     * local con la respuesta y refresca el listado para sincronizar los badges.
     *
     * @returns {void}
     */
    on_advance_stage() {
      if (!this.selected_implementation || this.advancing_stage) {
        return
      }

      if (!window.confirm('¿Avanzar a la siguiente etapa?')) {
        return
      }

      const self = this

      /** ID de la implementación sobre la que se opera. */
      const id = this.selected_implementation.id

      this.advancing_stage = true

      api
        .post('/implementation/' + id + '/advance-stage')
        .then(function (res) {
          /* Actualizar panel derecho con el modelo fresco devuelto por la API. */
          self.selected_implementation = res.data.model || self.selected_implementation
          /* Refrescar listado para que el badge de etapa del panel izquierdo quede actualizado. */
          self.load_list()
        })
        .catch(function () {
          /* El interceptor global de axios ya muestra el toast de error; no es necesario manejo adicional. */
        })
        .then(function () {
          self.advancing_stage = false
        })
    },

    /**
     * Retorna el nombre a mostrar del cliente asociado a una implementación.
     *
     * Prefiere company_name sobre name como fallback.
     *
     * @param {Object} impl Implementación con relación client cargada.
     * @returns {string}
     */
    client_display_name(impl) {
      if (!impl || !impl.client) {
        return 'Cliente desconocido'
      }
      return impl.client.company_name || impl.client.name || 'Sin nombre'
    },

    /**
     * Retorna el nombre de la etapa actual de una implementación.
     *
     * Busca dentro de stages la que coincide con current_stage y lee config.name.
     *
     * @param {Object} impl Implementación con relación stages y stages.config cargadas.
     * @returns {string}
     */
    current_stage_name(impl) {
      if (!impl || !impl.stages) {
        return ''
      }

      /** Nombre encontrado en la etapa activa. */
      let name = ''

      impl.stages.forEach(function (stage) {
        if (stage.stage_number == impl.current_stage && stage.config) {
          name = stage.config.name || ''
        }
      })

      return name
    },

    /**
     * Clase Bootstrap del badge de etapa según el estado general de la implementación.
     *
     * @param {Object} impl Implementación.
     * @returns {string}
     */
    stage_badge_class(impl) {
      const status = impl ? impl.status : ''

      if (status === 'in_progress') return 'bg-primary'
      if (status === 'completed') return 'bg-success'
      if (status === 'paused') return 'bg-warning text-dark'

      return 'bg-secondary'
    },

    /**
     * Clase Bootstrap del badge de estado pasado como string.
     *
     * @param {string} status Estado de la implementación.
     * @returns {string}
     */
    status_badge_class(status) {
      if (status === 'in_progress') return 'bg-primary'
      if (status === 'completed') return 'bg-success'
      if (status === 'paused') return 'bg-warning text-dark'

      return 'bg-secondary'
    },

    /**
     * Etiqueta legible en español del estado de una implementación.
     *
     * @param {string} status Estado raw de la implementación.
     * @returns {string}
     */
    status_label(status) {
      if (status === 'in_progress') return 'En progreso'
      if (status === 'completed') return 'Completada'
      if (status === 'paused') return 'Pausada'
      if (status === 'pending') return 'Pendiente'

      return status || '—'
    },

    /**
     * Ícono emoji representativo del estado de una etapa individual.
     *
     * @param {string} status Estado de ImplementationStage (pending, in_progress, completed, skipped).
     * @returns {string}
     */
    stage_icon(status) {
      if (status === 'completed') return '✅'
      if (status === 'in_progress') return '🔵'
      if (status === 'skipped') return '⏭️'

      return '⬜'
    },

    /**
     * Formatea una fecha ISO a string legible en locale español (Argentina).
     * Incluye hora y minutos para mayor precisión.
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
     * Calcula los días transcurridos desde la fecha de inicio y devuelve un label legible.
     *
     * @param {string|null} started_at Fecha ISO de inicio de la implementación.
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

      /** Días completos desde el inicio. */
      const days = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24))

      if (days === 0) return 'Inicio hoy'
      if (days === 1) return 'Hace 1 día'

      return 'Hace ' + days + ' días'
    },

    // -------------------------------------------------------------------------
    // Pusher: suscripción al canal admin-implementations
    // -------------------------------------------------------------------------

    /**
     * Se suscribe al canal `admin-implementations` y registra el listener para
     * el evento `implementation.stage.completed`.
     *
     * Reutiliza la instancia global `window.admin_support_echo` creada en main.js.
     * Si Echo no está disponible (sin Pusher en .env), no hace nada.
     *
     * @returns {void}
     */
    setup_pusher_subscription() {
      const self = this
      const echo = window.admin_support_echo

      if (!echo) {
        return
      }

      /**
       * Canal compartido del panel admin donde se emiten los eventos de implementación.
       */
      const channel_name = 'admin-implementations'
      self._pusher_channel = echo.channel(channel_name)

      self._pusher_channel.listen('.implementation.stage.completed', function (event_data) {
        self.on_stage_completed(event_data)
      })
    },

    /**
     * Deja el canal `admin-implementations` y limpia la referencia local.
     *
     * @returns {void}
     */
    teardown_pusher_subscription() {
      const echo = window.admin_support_echo

      if (!echo || !this._pusher_channel) {
        return
      }

      echo.leave('admin-implementations')
      this._pusher_channel = null
    },

    /**
     * Maneja el evento `implementation.stage.completed` recibido vía Pusher.
     *
     * Acciones:
     * 1. Muestra un toast global con el nombre del cliente y la etapa completada.
     * 2. Si la implementación afectada está seleccionada → recarga el detalle automáticamente.
     * 3. Si no está seleccionada → recarga el listado para actualizar badges y orden.
     *
     * @param {Object} event_data Payload del evento: { implementation_id, stage_number, client_name }.
     * @returns {void}
     */
    on_stage_completed(event_data) {
      if (!event_data) {
        return
      }

      /** Nombre del cliente y etapa para el toast. */
      const client_name  = event_data.client_name || 'Un cliente'
      const stage_number = event_data.stage_number || ''
      const impl_id      = event_data.implementation_id

      /* Emitir toast global usando el mecanismo compartido del admin-spa. */
      window.dispatchEvent(
        new CustomEvent('admin-spa-toast', {
          detail: {
            message: '✅ ' + client_name + ' completó la Etapa ' + stage_number + '. Revisá la implementación.',
            variant: 'success',
          },
        })
      )

      if (this.selected_id && this.selected_id == impl_id) {
        /* Implementación actualmente abierta: recargar el detalle completo. */
        this.load_detail(impl_id)
      } else {
        /* Implementación no seleccionada: refrescar la lista para actualizar badges. */
        this.load_list()
      }
    },

    // -------------------------------------------------------------------------

    /**
     * Evalúa si un valor de campo de datos recolectados es equivalente a "sí/verdadero".
     *
     * Normaliza booleanos, strings "true"/"yes"/"1" y números distintos de cero.
     *
     * @param {*} value Valor del campo de datos.
     * @returns {boolean}
     */
    is_truthy(value) {
      if (value === true || value === 1) return true
      if (typeof value === 'string') {
        const normalized = value.toLowerCase().trim()
        return normalized === 'true' || normalized === 'yes' || normalized === '1' || normalized === 'sí' || normalized === 'si'
      }
      return false
    },
  },
}
</script>

<style scoped>
/*
  Layout principal: ocupa el alto visible del viewport menos el padding de main
  (igual que support-view en Support.vue).
*/
.implementations-view {
  height: calc(100dvh - 2.5rem);
  max-height: calc(100dvh - 2.5rem);
  min-height: 0;
  box-sizing: border-box;
  overflow: hidden;
}

/* Panel izquierdo: ancho fijo con borde derecho */
.impl-left {
  width: 30%;
  border-right: 1px solid #e9ecef;
  min-width: 280px;
}

/* Encabezado del panel izquierdo */
.impl-left-top {
  padding: 10px 12px;
  border-bottom: 1px solid #e9ecef;
}

/* Fila individual del listado */
.impl-list-row {
  padding: 10px 12px;
  border-bottom: 1px solid #f1f3f5;
  cursor: pointer;
  transition: background-color 0.1s ease;
}

.impl-list-row:hover {
  background-color: #f8f9fa;
}

/* Fila activa / seleccionada */
.impl-list-row--selected {
  background-color: #e7f1ff;
}

/* Nombre del cliente en la fila */
.impl-list-row__client {
  font-size: 0.9rem;
}

/* Panel derecho: ocupa el espacio restante */
.impl-right {
  min-width: 0;
  flex: 1 1 0;
}

/* Header del panel derecho */
.impl-right-top {
  padding: 12px 16px;
  border-bottom: 1px solid #e9ecef;
}

/* Cuerpo scrolleable del panel derecho */
.impl-right-body {
  padding: 16px;
}

/* Título de sección dentro del panel derecho */
.impl-section-title {
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.05em;
  color: #6c757d;
  margin-bottom: 8px;
}

/* Fila individual de etapa en el progreso */
.impl-stage-row {
  padding: 4px 0;
  margin-bottom: 4px;
}

/* Espacio fijo del ícono de estado de etapa */
.impl-stage-icon {
  font-size: 1rem;
  width: 1.4rem;
  text-align: center;
}

/* Separador visual de etapa entre grupos de mensajes */
.impl-stage-separator {
  font-size: 0.75rem;
  color: #6c757d;
  border-top: 1px solid #e9ecef;
  padding-top: 6px;
  margin: 8px 0 4px;
}

/* Burbuja de mensaje genérica */
.impl-bubble {
  max-width: 70%;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 0.875rem;
}

/* Burbuja outbound (enviado por el sistema): azul primario, alineada a la derecha */
.impl-bubble--outbound {
  background-color: #0d6efd;
  color: white;
  border-bottom-right-radius: 2px;
}

/* Burbuja inbound (recibida del cliente): gris claro, alineada a la izquierda */
.impl-bubble--inbound {
  background-color: #e9ecef;
  color: #212529;
  border-bottom-left-radius: 2px;
}

/* Texto del mensaje dentro de la burbuja */
.impl-bubble__body {
  white-space: pre-wrap;
  word-break: break-word;
}

/* Timestamp debajo del mensaje, alineado a la derecha dentro de la burbuja */
.impl-bubble__time {
  font-size: 0.7rem;
  margin-top: 3px;
  opacity: 0.7;
  text-align: right;
}
</style>
