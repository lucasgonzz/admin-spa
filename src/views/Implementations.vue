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
          :class="{
            'impl-list-row--selected': selected_id == impl.id,
            'impl-list-row--ready': check_ready_to_advance(impl),
          }"
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

          <!-- Badge de alerta cuando la conversación automática terminó y espera al admin -->
          <div v-if="check_ready_to_advance(impl)" class="mt-1">
            <span class="badge bg-danger">
              ⚠️ Lista para avanzar etapa
            </span>
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

        <!--
          Navegación del detalle: alterna entre resumen (etapas + datos)
          y conversación sin mezclar ambos en un único scroll largo.
        -->
        <div class="impl-right-nav flex-shrink-0">
          <div class="impl-detail-tab-bar" role="tablist">
            <button
              type="button"
              role="tab"
              class="impl-detail-tab-btn"
              :class="{ 'impl-detail-tab-btn--active': detail_panel_tab === 'summary' }"
              :aria-selected="detail_panel_tab === 'summary'"
              @click="set_detail_panel_tab('summary')"
            >
              Resumen
            </button>
            <button
              type="button"
              role="tab"
              class="impl-detail-tab-btn"
              :class="{ 'impl-detail-tab-btn--active': detail_panel_tab === 'conversation' }"
              :aria-selected="detail_panel_tab === 'conversation'"
              @click="set_detail_panel_tab('conversation')"
            >
              Conversación
            </button>
          </div>
        </div>

        <!-- Cuerpo con scroll propio: contenido según pestaña activa -->
        <div ref="impl_right_body" class="impl-right-body flex-grow-1 overflow-auto">

          <!-- Resumen: etapas y datos recolectados (sin conversación) -->
          <template v-if="detail_panel_tab === 'summary'">

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

                <!--
                  Subetapas de la Etapa 1: se muestran cuando la etapa 1
                  está en progreso o completada y tiene datos recolectados.
                  Cada subetapa indica con ✅/⬜ si su campo fue completado.
                -->
                <div
                  v-if="stage.stage_number === 1 && (stage.status === 'completed' || stage.status === 'in_progress') && stage.data"
                  class="impl-stage-1-substeps mt-1"
                >
                  <div
                    v-for="substep in stage_1_substeps_from(stage.data)"
                    :key="substep.key"
                    class="impl-stage-substep small"
                    :class="{ 'text-muted': !substep.done }"
                  >
                    {{ substep.done ? '✅' : '⬜' }} {{ substep.label }}
                  </div>
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
                  <template v-if="'company_name' in stage_1_data">
                    <dt class="col-sm-4 text-muted">Empresa</dt>
                    <dd class="col-sm-8">{{ stage_1_data.company_name || '—' }}</dd>
                  </template>

                  <!--
                    Listas de precios: sí/no según use_price_lists.
                    Si es verdadero y existe price_lists, se muestra el detalle debajo.
                  -->
                  <template v-if="'use_price_lists' in stage_1_data">
                    <dt class="col-sm-4 text-muted">Listas de precios</dt>
                    <dd class="col-sm-8">
                      {{ stage_1_data.use_price_lists ? 'Sí' : 'No' }}
                      <div v-if="stage_1_data.use_price_lists && stage_1_data.price_lists" class="text-muted small mt-1">
                        {{ stage_1_data.price_lists }}
                      </div>
                    </dd>
                  </template>

                  <!--
                    Depósitos/sucursales: sí/no según use_deposits.
                    Si es verdadero y existe deposit_names, se muestran los nombres debajo.
                  -->
                  <template v-if="'use_deposits' in stage_1_data">
                    <dt class="col-sm-4 text-muted">Depósitos/sucursales</dt>
                    <dd class="col-sm-8">
                      {{ stage_1_data.use_deposits ? 'Sí' : 'No' }}
                      <div v-if="stage_1_data.use_deposits && stage_1_data.deposit_names" class="text-muted small mt-1">
                        {{ stage_1_data.deposit_names }}
                      </div>
                    </dd>
                  </template>

                  <!--
                    Descuentos por método de pago: se muestra el texto tal cual
                    salvo que sea "no"/"No", en cuyo caso se muestra "No aplica".
                  -->
                  <template v-if="'payment_discounts' in stage_1_data">
                    <dt class="col-sm-4 text-muted">Descuentos por pago</dt>
                    <dd class="col-sm-8">{{ payment_discounts_label(stage_1_data.payment_discounts) }}</dd>
                  </template>

                  <!--
                    Empleados: texto libre separado por saltos de línea.
                    Se parsea y se muestra como lista de ítems con bullet, uno por línea.
                    Solo se muestra si el campo existe y no está vacío.
                  -->
                  <template v-if="'employees' in stage_1_data && stage_1_data.employees">
                    <dt class="col-sm-4 text-muted">Empleados</dt>
                    <dd class="col-sm-8">
                      <ul class="mb-0 ps-3">
                        <li v-for="(line, idx) in employees_lines(stage_1_data.employees)" :key="idx">{{ line }}</li>
                      </ul>
                    </dd>
                  </template>

                  <!-- Logo recibido: sí/no según logo_received === true -->
                  <template v-if="'logo_received' in stage_1_data">
                    <dt class="col-sm-4 text-muted">Logo recibido</dt>
                    <dd class="col-sm-8">{{ stage_1_data.logo_received === true ? 'Sí' : 'No' }}</dd>
                  </template>

                  <!--
                    Cantidad en venta: si true → "Preguntar cantidad";
                    si false → "Agregar 1 unidad automáticamente".
                  -->
                  <template v-if="'ask_amount_in_vender' in stage_1_data">
                    <dt class="col-sm-4 text-muted">Cantidad en venta</dt>
                    <dd class="col-sm-8">
                      {{ stage_1_data.ask_amount_in_vender === true ? 'Preguntar cantidad' : 'Agregar 1 unidad automáticamente' }}
                    </dd>
                  </template>

                  <!--
                    Cuenta corriente por defecto: si true → va a cc por defecto;
                    si false → indicar manualmente.
                  -->
                  <template v-if="'default_cuenta_corriente' in stage_1_data">
                    <dt class="col-sm-4 text-muted">Cuenta corriente</dt>
                    <dd class="col-sm-8">
                      {{ stage_1_data.default_cuenta_corriente === true ? 'Sí, va a cuenta corriente por defecto' : 'No, indicar manualmente' }}
                    </dd>
                  </template>

                </dl>
              </div>
            </div>
          </template>

          <!-- Sección: archivos recibidos en etapa 4 (si la etapa ya comenzó) -->
          <template v-if="show_stage_4_panel">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <h6 class="impl-section-title mb-0">Archivos recibidos (Etapa 4)</h6>
              <span
                v-if="stage_4_data && stage_4_data.files_confirmed_complete === true"
                class="badge bg-success"
              >
                ✅ Cliente confirmó todos los archivos
              </span>
              <span v-else class="badge bg-warning text-dark">
                ⏳ Esperando archivos
              </span>
            </div>
            <div class="card mb-4">
              <div class="card-body small">
                <details
                  v-for="category in stage_4_categories"
                  :key="category.key"
                  class="impl-stage4-category mb-3"
                  open
                >
                  <summary class="fw-semibold mb-2">{{ category.label }}</summary>

                  <!-- Estado de archivos por categoría -->
                  <div class="mb-2">
                    <span
                      v-if="stage_4_category_state(category.files_key) === 'skipped'"
                      class="badge bg-secondary"
                    >
                      Sin archivos
                    </span>
                    <span
                      v-else-if="stage_4_category_state(category.files_key) === 'pending'"
                      class="badge bg-secondary"
                    >
                      Pendiente
                    </span>

                    <!-- Tarjetas de archivo con ícono, nombre y botón de descarga -->
                    <template v-else>
                      <div
                        v-for="(file_item, file_idx) in stage_4_category_files_list(category.files_key)"
                        :key="file_idx"
                        class="impl-stage4-file-card d-flex align-items-center gap-2 mb-2 p-2 border rounded"
                      >
                        <!-- Ícono del tipo de archivo -->
                        <i
                          class="impl-stage4-file-icon bi flex-shrink-0"
                          :class="file_type_icon_class(file_item.filename)"
                          :style="{ color: file_type_color(file_item.filename), fontSize: '1.6rem' }"
                          aria-hidden="true"
                        />

                        <!-- Nombre y extensión -->
                        <div class="flex-grow-1 min-w-0">
                          <div class="text-truncate small fw-semibold" :title="file_item.filename || 'archivo'">
                            {{ file_item.filename || 'archivo' }}
                          </div>
                          <div class="text-muted" style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em;">
                            {{ file_ext(file_item.filename) }}
                          </div>
                        </div>

                        <!-- Badge de estado de importación -->
                        <span
                          v-if="stage_4_import_status_label(category.key)"
                          class="impl-stage4-import-badge flex-shrink-0"
                          :title="stage_4_import_error(category.key) || ''"
                        >
                          <span v-if="stage_4_import_status(category.key) === 'importing'" class="badge bg-warning text-dark">
                            <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                            Importando...
                          </span>
                          <span v-else-if="stage_4_import_status(category.key) === 'success'" class="badge bg-success">
                            ✅ Importado
                          </span>
                          <span v-else-if="stage_4_import_status(category.key) === 'failed'" class="badge bg-danger" :title="stage_4_import_error(category.key) || ''">
                            ❌ Error
                          </span>
                        </span>

                        <!-- Botón de descarga -->
                        <button
                          type="button"
                          class="btn btn-sm btn-outline-secondary flex-shrink-0 impl-stage4-download-btn"
                          :title="'Descargar ' + (file_item.filename || 'archivo')"
                          @click="download_stage4_file(category.key, file_idx, file_item.filename)"
                        >
                          <i class="bi bi-download" aria-hidden="true" />
                        </button>
                      </div>
                    </template>
                  </div>

                  <!-- Resultado del análisis IA si existe -->
                  <div
                    v-if="stage_4_analysis(category.key)"
                    class="text-muted impl-stage4-analysis"
                  >
                    <div>
                      Registros detectados:
                      <strong>{{ stage_4_analysis(category.key).record_count ?? '—' }}</strong>
                    </div>
                    <div v-if="stage_4_mapped_column_labels(category.key).length" class="mt-1">
                      Columnas mapeadas:
                      <ul class="mb-0 ps-3">
                        <li
                          v-for="(col_label, col_idx) in stage_4_mapped_column_labels(category.key)"
                          :key="col_idx"
                        >
                          {{ col_label }}
                        </li>
                      </ul>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </template>

          <!--
            Acción destructiva al pie del resumen: elimina la implementación
            y toda su información tras confirmación del operador.
          -->
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

          <!-- Conversación: mensajes WhatsApp (sin etapas ni datos recolectados) -->
          <template v-if="detail_panel_tab === 'conversation'">

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
                  <!-- Adjunto de archivo: misma tarjeta visual que en Archivos recibidos (Etapa 4) -->
                  <div v-if="message_file_attachments_by_id[message.id]" class="impl-bubble__attachment">
                    <div
                      class="impl-stage4-file-card impl-bubble-file-card d-flex align-items-center gap-2 p-2 border rounded"
                    >
                      <i
                        class="impl-stage4-file-icon bi flex-shrink-0"
                        :class="file_type_icon_class(message_file_attachments_by_id[message.id].filename)"
                        :style="{
                          color: file_type_color(message_file_attachments_by_id[message.id].filename),
                          fontSize: '1.6rem',
                        }"
                        aria-hidden="true"
                      />

                      <div class="flex-grow-1 min-w-0">
                        <div
                          class="text-truncate small fw-semibold"
                          :title="message_file_attachments_by_id[message.id].filename"
                        >
                          {{ message_file_attachments_by_id[message.id].filename }}
                        </div>
                        <div
                          class="text-muted"
                          style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em;"
                        >
                          {{ file_ext(message_file_attachments_by_id[message.id].filename) }}
                        </div>
                      </div>

                      <button
                        type="button"
                        class="btn btn-sm btn-outline-secondary flex-shrink-0 impl-stage4-download-btn"
                        :title="'Descargar ' + message_file_attachments_by_id[message.id].filename"
                        @click.stop="download_message_file(message)"
                      >
                        <i class="bi bi-download" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <!-- Texto plano para mensajes sin adjunto -->
                  <div v-else class="impl-bubble__body">{{ message.body }}</div>

                  <!-- Timestamp del mensaje -->
                  <div class="impl-bubble__time">{{ format_date(message.sent_at) }}</div>
                </div>
              </div>
            </template>
            <!-- Ancla al pie del hilo para scrollIntoView tras renderizar mensajes -->
            <div ref="conversation_scroll_end" class="impl-conversation-scroll-end" aria-hidden="true"></div>
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
 * Etiquetas en español de propiedades de sistema (mismo mapa que ImplementationImportService).
 */
const STAGE_4_PROPERTY_LABELS = {
  nombre: 'Nombre',
  codigo_de_barras: 'Código',
  codigo_de_proveedor: 'Código de proveedor',
  sku: 'SKU',
  precio: 'Precio',
  costo: 'Costo',
  stock_actual: 'Stock',
  descripcion: 'Descripción',
  categoria: 'Categoría',
  marca: 'Marca',
}

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
       * Indicador de operación en curso al eliminar la implementación activa.
       */
      deleting_implementation: false,

      /**
       * Sección visible en el panel derecho del detalle: summary (etapas + datos)
       * o conversation (mensajes WhatsApp).
       */
      detail_panel_tab: 'summary',

      /**
       * Referencia al canal Pusher suscrito (admin-implementations).
       * Se guarda para poder hacer leave() al desmontar la vista.
       */
      _pusher_channel: null,

      /**
       * Categorías de archivos de la Etapa 4 para el panel de resumen.
       */
      stage_4_categories: [
        { key: 'articles', label: 'Artículos', files_key: 'articles_files' },
        { key: 'clients', label: 'Clientes', files_key: 'clients_files' },
        { key: 'suppliers', label: 'Proveedores', files_key: 'suppliers_files' },
      ],
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

    /**
     * Etapa 4 del detalle activo (in_progress o completed), si existe.
     *
     * @returns {Object|null}
     */
    stage_4_stage() {
      if (!this.selected_implementation || !this.selected_implementation.stages) {
        return null
      }

      let found = null

      this.selected_implementation.stages.forEach(function (stage) {
        if (stage.stage_number === 4 && stage.status !== 'pending') {
          found = stage
        }
      })

      return found
    },

    /**
     * Data JSON de la etapa 4 para el panel de archivos.
     *
     * @returns {Object|null}
     */
    stage_4_data() {
      if (!this.stage_4_stage || this.stage_4_stage.data == null) {
        return null
      }

      return this.stage_4_stage.data
    },

    /**
     * Muestra el bloque de archivos de etapa 4 cuando la etapa ya comenzó.
     *
     * @returns {boolean}
     */
    show_stage_4_panel() {
      return this.stage_4_stage !== null
    },

    /**
     * Mapa message_id → metadata de adjunto para renderizar tarjetas en la conversación
     * sin re-parsear el body en cada binding del template.
     *
     * @returns {Object.<string, { filename: string, message_id: number|string }>}
     */
    message_file_attachments_by_id() {
      /** Índice de adjuntos detectados por id de mensaje. */
      const map = {}
      const self = this

      if (!this.selected_implementation || !this.selected_implementation.messages) {
        return map
      }

      this.selected_implementation.messages.forEach(function (message) {
        const attachment = self.parse_message_file_attachment(message)

        if (attachment) {
          map[message.id] = attachment
        }
      })

      return map
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
      /* Al cambiar de implementación, mostrar primero el resumen de etapas. */
      this.detail_panel_tab = 'summary'
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

          /*
           * Si el detalle se recargó estando en Conversación, bajar el scroll
           * al último mensaje una vez visible el panel.
           */
          if (self.detail_panel_tab === 'conversation') {
            self.schedule_scroll_conversation_to_bottom()
          }
        })
    },

    /**
     * Cambia la pestaña del detalle (resumen o conversación).
     * En conversación, desplaza el scroll al último mensaje tras pintar el DOM.
     *
     * @param {string} tab Clave de pestaña: 'summary' | 'conversation'.
     * @returns {void}
     */
    set_detail_panel_tab(tab) {
      this.detail_panel_tab = tab

      if (tab === 'conversation') {
        this.schedule_scroll_conversation_to_bottom()
      }
    },

    /**
     * Programa el scroll al pie del hilo: nextTick + doble rAF por layout tardío.
     *
     * @returns {void}
     */
    schedule_scroll_conversation_to_bottom() {
      const self = this

      this.$nextTick(function () {
        self.scroll_conversation_to_bottom()

        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            self.scroll_conversation_to_bottom()
          })
        })
      })
    },

    /**
     * Desplaza el contenedor del detalle y el ancla al último mensaje visible.
     *
     * @returns {void}
     */
    scroll_conversation_to_bottom() {
      if (this.detail_panel_tab !== 'conversation') {
        return
      }

      /** Contenedor con overflow del panel derecho. */
      const container = this.$refs.impl_right_body

      if (container) {
        container.scrollTop = container.scrollHeight
      }

      /** Marcador al final de la lista de burbujas. */
      const anchor = this.$refs.conversation_scroll_end

      if (anchor && typeof anchor.scrollIntoView === 'function') {
        anchor.scrollIntoView({ block: 'end', inline: 'nearest' })
      }
    },

    /**
     * Solicita confirmación y elimina la implementación seleccionada con todo su detalle.
     *
     * Tras éxito limpia la selección y recarga el listado del panel izquierdo.
     *
     * @returns {void}
     */
    on_delete_implementation() {
      if (!this.selected_implementation || this.deleting_implementation) {
        return
      }

      /** Nombre del cliente para el mensaje de confirmación. */
      const client_name = this.client_display_name(this.selected_implementation)

      if (
        !window.confirm(
          '¿Eliminar la implementación de "' +
            client_name +
            '" y toda su información (etapas, mensajes y datos)? Esta acción no se puede deshacer.'
        )
      ) {
        return
      }

      const self = this

      /** ID de la implementación que se eliminará en el servidor. */
      const id = this.selected_implementation.id

      this.deleting_implementation = true

      api
        .delete('/implementation/' + id)
        .then(function () {
          self.selected_id = null
          self.selected_implementation = null
          self.load_list()
        })
        .catch(function () {
          /* El interceptor global de axios ya muestra el toast de error. */
        })
        .then(function () {
          self.deleting_implementation = false
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
          /*
           * Reducir el badge global del Nav: esta implementación ya fue avanzada y
           * ya no está esperando al admin. Previene sobreconteo hasta el próximo refresh.
           */
          self.$store.commit('implementation/decrement_ready_to_advance_count')
        })
        .catch(function () {
          /* El interceptor global de axios ya muestra el toast de error; no es necesario manejo adicional. */
        })
        .then(function () {
          self.advancing_stage = false
        })
    },

    /**
     * Retorna la clase de Bootstrap Icon correspondiente a la extensión del archivo.
     *
     * @param {string} filename Nombre del archivo con extensión.
     * @returns {string} Clase CSS del ícono bi-*.
     */
    file_type_icon_class(filename) {
      /* Extensión en minúsculas para normalizar la comparación. */
      const ext = String(filename || '').split('.').pop().toLowerCase()

      if (ext === 'pdf') {
        return 'bi-file-earmark-pdf-fill'
      }
      if (ext === 'xlsx' || ext === 'xls') {
        return 'bi-file-earmark-spreadsheet-fill'
      }
      if (ext === 'csv') {
        return 'bi-file-earmark-text-fill'
      }
      if (ext === 'doc' || ext === 'docx') {
        return 'bi-file-earmark-word-fill'
      }
      if (ext === 'zip' || ext === 'rar' || ext === '7z') {
        return 'bi-file-earmark-zip-fill'
      }
      if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif' || ext === 'webp') {
        return 'bi-file-earmark-image-fill'
      }
      if (ext === 'txt') {
        return 'bi-file-earmark-text-fill'
      }

      return 'bi-file-earmark-fill'
    },

    /**
     * Color del ícono de archivo según la extensión, imitando los colores del software nativo.
     *
     * @param {string} filename Nombre del archivo.
     * @returns {string} Color CSS.
     */
    file_type_color(filename) {
      const ext = String(filename || '').split('.').pop().toLowerCase()

      if (ext === 'pdf') {
        return '#e53935'
      }
      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        return '#1d6f42'
      }
      if (ext === 'doc' || ext === 'docx') {
        return '#2b579a'
      }
      if (ext === 'zip' || ext === 'rar' || ext === '7z') {
        return '#f59e0b'
      }
      if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif' || ext === 'webp') {
        return '#7c3aed'
      }

      return '#6c757d'
    },

    /**
     * Devuelve la extensión en mayúsculas para mostrar debajo del nombre.
     *
     * @param {string} filename Nombre del archivo.
     * @returns {string}
     */
    file_ext(filename) {
      if (!filename) {
        return ''
      }
      const ext = String(filename).split('.').pop()
      return ext ? ext.toUpperCase() : ''
    },

    /**
     * Detecta si un mensaje de conversación contiene un adjunto de archivo (formato Kapso).
     *
     * El body guardado por el webhook tiene el patrón:
     *   [Document attached (archivo.xlsx)]
     *   [Size: … | Type: …]
     *   URL: https://…
     *
     * @param {Object} message Mensaje de implementation_messages.
     * @returns {{ filename: string, message_id: number|string }|null}
     */
    parse_message_file_attachment(message) {
      if (!message || !message.body) {
        return null
      }

      /** Texto completo del mensaje persistido en la base. */
      const body = String(message.body)

      // Solo mensajes con patrón de adjunto multimedia.
      if (!/\b(document|image|video|audio)\s+attached\b/i.test(body)) {
        return null
      }

      /** Nombre extraído del patrón "Document attached (nombre.ext)". */
      let filename = 'archivo'
      const name_match = body.match(/(?:document|image|video|audio)\s+attached\s*\(([^)]+)\)/i)

      if (name_match && name_match[1]) {
        filename = name_match[1].trim()
      }

      // Requiere URL de Kapso para poder descargar vía proxy del backend.
      const url_match = body.match(/URL:\s*(https?:\/\/\S+)/i)

      if (!url_match || !url_match[1]) {
        return null
      }

      return {
        filename: filename,
        message_id: message.id,
      }
    },

    /**
     * Descarga el adjunto de un mensaje de conversación vía proxy del backend.
     *
     * @param {Object} message Mensaje con adjunto detectado por parse_message_file_attachment.
     * @returns {void}
     */
    download_message_file(message) {
      const attachment = this.parse_message_file_attachment(message)

      if (!attachment || !this.selected_implementation) {
        return
      }

      /** ID de la implementación activa y del mensaje con el adjunto. */
      const impl_id = this.selected_implementation.id
      const message_id = attachment.message_id
      const filename = attachment.filename

      api
        .get('/implementation/' + impl_id + '/message-file-download/' + message_id, {
          responseType: 'blob',
        })
        .then(function (res) {
          const blob_url = window.URL.createObjectURL(new Blob([res.data]))
          const link = document.createElement('a')
          link.href = blob_url
          link.setAttribute('download', filename || 'archivo')
          document.body.appendChild(link)
          link.click()
          link.parentNode.removeChild(link)
          window.URL.revokeObjectURL(blob_url)
        })
        .catch(function () {
          /* El interceptor global de axios ya muestra el toast de error. */
        })
    },

    /**
     * Descarga un archivo de la Etapa 4 a través del endpoint proxy del backend.
     *
     * Usa axios con responseType 'blob' para manejar el auth token en el header
     * y desencadena la descarga creando un object URL temporal.
     *
     * @param {string} category articles | clients | suppliers
     * @param {number} index    Índice del archivo en el array de la categoría.
     * @param {string} filename Nombre original del archivo para el atributo download.
     * @returns {void}
     */
    download_stage4_file(category, index, filename) {
      if (!this.selected_implementation) {
        return
      }

      /** ID de la implementación activa en el panel de detalle. */
      const impl_id = this.selected_implementation.id

      api
        .get('/implementation/' + impl_id + '/stage4-file-download', {
          params: { category: category, index: index },
          responseType: 'blob',
        })
        .then(function (res) {
          /* Crear un object URL temporal a partir del blob recibido. */
          const blob_url = window.URL.createObjectURL(new Blob([res.data]))

          /* Crear un enlace invisible, simularlo clickeado y luego destruirlo. */
          const link = document.createElement('a')
          link.href = blob_url
          link.setAttribute('download', filename || 'archivo')
          document.body.appendChild(link)
          link.click()
          link.parentNode.removeChild(link)

          /* Liberar el object URL para evitar memory leaks. */
          window.URL.revokeObjectURL(blob_url)
        })
        .catch(function () {
          /* El interceptor global de axios ya muestra el toast de error. */
        })
    },

    /**
     * Determina si una implementación del listado está lista para avanzar de etapa.
     *
     * Computa el estado directamente desde las `stages` cargadas en la fila,
     * sin depender del campo virtual `ready_to_advance` del backend (que puede llegar
     * con race condition cuando el listado se recarga justo al recibir el evento Pusher).
     *
     * Criterio: current_stage < 7 Y la etapa cuyo stage_number === current_stage
     * tiene status === 'completed' (la conversación automática terminó, falta el avance manual).
     *
     * @param {Object} impl Implementación con relación stages cargada.
     * @returns {boolean}
     */
    check_ready_to_advance(impl) {
      if (!impl || !impl.stages || impl.current_stage >= 7) {
        return false
      }

      /** Indicador de etapa lista encontrada. */
      let ready = false

      impl.stages.forEach(function (stage) {
        if (stage.stage_number == impl.current_stage && stage.status === 'completed') {
          ready = true
        }
      })

      return ready
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

      self._pusher_channel.listen('.implementation.import.status_updated', function (event_data) {
        self.on_import_status_updated(event_data)
      })

      self._pusher_channel.listen('.implementation.message.received', function (event_data) {
        self.on_message_received(event_data)
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
    /**
     * Refresca el detalle cuando cambia import_status de la implementación abierta.
     *
     * @param {Object} event_data Payload: { implementation_id, category, status, error }.
     * @returns {void}
     */
    on_import_status_updated(event_data) {
      if (!event_data || !this.selected_id) {
        return
      }

      if (this.selected_id == event_data.implementation_id) {
        this.load_detail(this.selected_id)
      }
    },

    /**
     * Agrega un mensaje al hilo si la implementación afectada está cargada en el detalle.
     *
     * Evita duplicados por id (re-emisión o recarga concurrente) y hace scroll al pie
     * cuando la pestaña Conversación está activa.
     *
     * @param {Object} event_data Payload: { implementation_id, message }.
     * @returns {void}
     */
    on_message_received(event_data) {
      if (!event_data || !event_data.message || !event_data.implementation_id) {
        return
      }

      if (!this.selected_id || this.selected_id != event_data.implementation_id) {
        return
      }

      if (!this.selected_implementation) {
        return
      }

      /** Mensaje recién persistido en el backend. */
      const message = event_data.message

      if (!this.selected_implementation.messages) {
        this.selected_implementation.messages = []
      }

      /** Indica si el mensaje ya está en el hilo local. */
      let already_exists = false

      this.selected_implementation.messages.forEach(function (existing_message) {
        if (existing_message.id == message.id) {
          already_exists = true
        }
      })

      if (already_exists) {
        return
      }

      this.selected_implementation.messages.push(message)

      if (this.detail_panel_tab === 'conversation') {
        this.schedule_scroll_conversation_to_bottom()
      }
    },

    /**
     * Estado de archivos de una categoría: skipped | pending | files.
     *
     * @param {string} files_key articles_files | clients_files | suppliers_files.
     * @returns {string}
     */
    stage_4_category_state(files_key) {
      if (!this.stage_4_data) {
        return 'pending'
      }

      const value = this.stage_4_data[files_key]

      if (value === 'skipped') {
        return 'skipped'
      }

      if (!value || !Array.isArray(value) || value.length === 0) {
        return 'pending'
      }

      return 'files'
    },

    /**
     * Lista de archivos de una categoría (array de objetos con filename).
     *
     * @param {string} files_key Clave en stage.data.
     * @returns {Array}
     */
    stage_4_category_files_list(files_key) {
      if (!this.stage_4_data) {
        return []
      }

      const value = this.stage_4_data[files_key]

      if (!Array.isArray(value)) {
        return []
      }

      return value
    },

    /**
     * Status de importación de una categoría desde import_status.
     *
     * @param {string} category articles | clients | suppliers.
     * @returns {string|null}
     */
    stage_4_import_status(category) {
      if (!this.stage_4_data || !this.stage_4_data.import_status) {
        return null
      }

      const entry = this.stage_4_data.import_status[category]

      if (!entry || !entry.status) {
        return null
      }

      return entry.status
    },

    /**
     * Etiqueta visible del estado de importación (solo importing, success, failed).
     *
     * @param {string} category articles | clients | suppliers.
     * @returns {boolean}
     */
    stage_4_import_status_label(category) {
      const status = this.stage_4_import_status(category)

      return status === 'importing' || status === 'success' || status === 'failed'
    },

    /**
     * Mensaje de error de importación de una categoría.
     *
     * @param {string} category articles | clients | suppliers.
     * @returns {string|null}
     */
    stage_4_import_error(category) {
      if (!this.stage_4_data || !this.stage_4_data.import_status) {
        return null
      }

      const entry = this.stage_4_data.import_status[category]

      if (!entry || !entry.error) {
        return null
      }

      return entry.error
    },

    /**
     * Bloque analysis_result de una categoría.
     *
     * @param {string} category articles | clients | suppliers.
     * @returns {Object|null}
     */
    stage_4_analysis(category) {
      if (!this.stage_4_data || !this.stage_4_data.analysis_result) {
        return null
      }

      const result = this.stage_4_data.analysis_result[category]

      if (!result) {
        return null
      }

      return result
    },

    /**
     * Etiqueta en español de una system_property del mapeo.
     *
     * @param {string} property_key Clave de propiedad en empresa-api.
     * @returns {string}
     */
    stage_4_system_property_label(property_key) {
      if (STAGE_4_PROPERTY_LABELS[property_key]) {
        return STAGE_4_PROPERTY_LABELS[property_key]
      }

      return property_key.replace(/_/g, ' ')
    },

    /**
     * Lista de etiquetas de columnas mapeadas para mostrar en el panel.
     *
     * @param {string} category articles | clients | suppliers.
     * @returns {Array<string>}
     */
    stage_4_mapped_column_labels(category) {
      const analysis = this.stage_4_analysis(category)

      if (!analysis || !Array.isArray(analysis.column_mapping)) {
        return []
      }

      const labels = []
      const seen = {}

      analysis.column_mapping.forEach(function (mapping_item) {
        if (!mapping_item || !mapping_item.system_property) {
          return
        }

        const key = mapping_item.system_property

        if (seen[key]) {
          return
        }

        seen[key] = true
        labels.push(this.stage_4_system_property_label(key))
      }.bind(this))

      return labels
    },

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

      const self = this

      /*
       * Esperar 600ms antes de recargar para que el commit del DB llegue antes que la
       * consulta API (el evento Pusher puede llegar antes de que la transacción cierre).
       * Siempre refrescar el listado para que las stages reflejen el nuevo status.
       */
      setTimeout(function () {
        self.load_list()

        if (self.selected_id && self.selected_id == impl_id) {
          /* Implementación actualmente abierta: también recargar el detalle completo. */
          self.load_detail(impl_id)
        }
      }, 600)
    },

    // -------------------------------------------------------------------------

    /**
     * Construye el listado de subetapas de la Etapa 1 a partir de los datos recolectados.
     *
     * Cada subetapa indica si fue completada según la presencia o valor de su clave en `data`.
     *
     * @param {Object} data Objeto `stage.data` del stage con stage_number === 1.
     * @returns {Array<{ key: string, label: string, done: boolean }>}
     */
    stage_1_substeps_from(data) {
      if (!data) {
        return []
      }

      return [
        /* Listas de precios: completada si la clave existe en data */
        { key: 'use_price_lists',        label: 'Listas de precios',       done: 'use_price_lists' in data },
        /* Depósitos/sucursales: completada si la clave existe en data */
        { key: 'use_deposits',           label: 'Depósitos/sucursales',    done: 'use_deposits' in data },
        /* Método de pago: completada si la clave existe en data */
        { key: 'payment_discounts',      label: 'Método de pago',          done: 'payment_discounts' in data },
        /* Nombre de empresa: completada si la clave existe en data */
        { key: 'company_name',           label: 'Nombre de empresa',       done: 'company_name' in data },
        /* Empleados: completada si la clave existe y el valor no es vacío */
        { key: 'employees',              label: 'Empleados',               done: 'employees' in data && data.employees !== null && data.employees !== '' },
        /* Logo: completada solo si logo_received === true */
        { key: 'logo_received',          label: 'Logo',                    done: data.logo_received === true },
        /* Cantidad en venta: completada si la clave existe en data */
        { key: 'ask_amount_in_vender',   label: 'Cantidad en venta',       done: 'ask_amount_in_vender' in data },
        /* Cuenta corriente: completada si la clave existe en data */
        { key: 'default_cuenta_corriente', label: 'Cuenta corriente',      done: 'default_cuenta_corriente' in data },
      ]
    },

    /**
     * Formatea el valor del campo `payment_discounts` para mostrar en la UI.
     *
     * Si el valor es "no" o "No" (en cualquier capitalización), devuelve "No aplica".
     * De lo contrario devuelve el texto tal cual.
     *
     * @param {string|null} value Valor del campo payment_discounts.
     * @returns {string}
     */
    payment_discounts_label(value) {
      if (!value) {
        return '—'
      }

      /** Versión normalizada para comparar sin distinción de mayúsculas. */
      const normalized = String(value).toLowerCase().trim()

      if (normalized === 'no') {
        return 'No aplica'
      }

      return value
    },

    /**
     * Separa el texto libre de empleados en líneas individuales para renderizado como lista.
     *
     * Divide por salto de línea y filtra líneas vacías para evitar ítems en blanco.
     *
     * @param {string} employees_text Texto libre con los empleados, separados por \n.
     * @returns {string[]}
     */
    employees_lines(employees_text) {
      if (!employees_text) {
        return []
      }

      return String(employees_text).split('\n').filter(function (line) {
        return line.trim() !== ''
      })
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

/* Fila con etapa lista para avanzar: rojo llamativo + borde izquierdo grueso + pulso */
.impl-list-row--ready {
  background-color: #fee2e2;
  border-left: 5px solid #dc3545;
  animation: impl-ready-pulse 2.4s ease-in-out infinite;
}

.impl-list-row--ready:hover {
  background-color: #fecaca;
  animation: none;
}

/* Pulso: alterna entre rojo suave y rojo más intenso */
@keyframes impl-ready-pulse {
  0%, 100% { background-color: #fee2e2; }
  50%       { background-color: #fecaca; }
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

/*
  Barra Resumen / Conversación: control segmentado plano, mismo azul que
  btn-primary, badge "En progreso" y fila seleccionada del listado (#e7f1ff).
*/
.impl-right-nav {
  padding: 10px 16px 12px;
  background-color: #fff;
  border-bottom: 1px solid #e9ecef;
}

/* Pista gris donde se deslizan las dos opciones (estilo pill, sin bordes de carpeta) */
.impl-detail-tab-bar {
  display: flex;
  gap: 6px;
  padding: 4px;
  background-color: #f1f3f5;
  border-radius: 8px;
}

/* Botón de pestaña: inactivo en gris secundario como los títulos de sección */
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

.impl-detail-tab-btn:focus,
.impl-detail-tab-btn:focus-visible {
  box-shadow: none;
  outline: none;
}

.impl-detail-tab-btn:focus-visible {
  outline: 2px solid #0d6efd;
  outline-offset: 2px;
}

/* Activo: mismo relleno azul sólido que el botón Avanzar etapa y el badge de estado */
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

/* Contenedor de subetapas de la Etapa 1, indentado bajo el nombre de la etapa */
.impl-stage-1-substeps {
  padding-left: 1.2rem;
}

/* Ítem individual de subetapa con pequeño espaciado vertical */
.impl-stage-substep {
  line-height: 1.5;
}

/* Marcador cero altura al final del hilo; scrollIntoView alinea al último mensaje */
.impl-conversation-scroll-end {
  height: 0;
  width: 0;
  overflow: hidden;
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

/* Tarjeta de archivo dentro de una burbuja de conversación */
.impl-bubble__attachment {
  min-width: 220px;
  max-width: 300px;
}

.impl-bubble-file-card {
  background-color: #fff;
  border-color: #dee2e6 !important;
}

.impl-bubble--outbound .impl-bubble-file-card {
  background-color: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.35) !important;
}

.impl-bubble--outbound .impl-bubble-file-card .text-muted {
  color: rgba(255, 255, 255, 0.75) !important;
}

.impl-bubble--outbound .impl-bubble-file-card .fw-semibold {
  color: #fff;
}

.impl-bubble--outbound .impl-stage4-download-btn {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.5);
}

/* Timestamp debajo del mensaje, alineado a la derecha dentro de la burbuja */
.impl-bubble__time {
  font-size: 0.7rem;
  margin-top: 3px;
  opacity: 0.7;
  text-align: right;
}

/* Bloque de categoría en panel Etapa 4 */
.impl-stage4-category summary {
  cursor: pointer;
}

/* Tarjeta de archivo: reemplaza el badge de texto anterior */
.impl-stage4-file-card {
  background-color: #f8f9fa;
  transition: background-color 0.1s ease;
  max-width: 420px;
}

.impl-stage4-file-card:hover {
  background-color: #e9ecef;
}

/* Ícono del tipo de archivo */
.impl-stage4-file-icon {
  line-height: 1;
}

/* Botón de descarga: tamaño compacto, solo visible en hover */
.impl-stage4-download-btn {
  font-size: 0.8rem;
  padding: 0.2rem 0.45rem;
}

.impl-stage4-import-badge {
  font-size: 0.75rem;
}

.impl-stage4-analysis {
  border-top: 1px solid #e9ecef;
  padding-top: 8px;
}

/* Zona de eliminación al pie del panel Resumen */
.impl-delete-section {
  max-width: 320px;
}
</style>
