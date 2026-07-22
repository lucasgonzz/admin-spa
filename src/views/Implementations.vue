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
      <div class="impl-left-top flex-shrink-0 d-flex align-items-center justify-content-between">
        <h6 class="mb-0 fw-semibold">Implementaciones</h6>

        <!-- Botón para dar de alta una nueva implementación eligiendo el cliente (Prompt 178-05) -->
        <button
          type="button"
          class="btn btn-sm impl-new-btn"
          @click="show_create_modal = true"
        >
          + Nueva implementación
        </button>
      </div>

      <!-- Lista con scroll propio -->
      <div class="impl-list flex-grow-1 overflow-auto">

        <!-- Estado: lista vacía -->
        <div v-if="!list_loading && !implementations.length" class="p-3 text-center text-muted small">
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

          <!-- Días desde inicio + botón directo a la conversación -->
          <div class="d-flex align-items-center justify-content-between mt-1">
            <span class="small text-muted">{{ days_since_label(impl.started_at) }}</span>
            <button
              type="button"
              class="btn btn-link btn-sm p-0 text-success"
              title="Ver conversación WhatsApp"
              @click.stop="go_to_conversation(impl.id)"
            >
              <i class="bi bi-whatsapp" aria-hidden="true" />
            </button>
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

      <!-- Detalle cargado -->
      <template v-else-if="selected_implementation && !detail_loading">

        <!-- Header del panel derecho -->
        <div class="impl-right-top flex-shrink-0">
          <div class="d-flex align-items-start justify-content-between gap-2">
            <div>
              <!-- Nombre del cliente en grande -->
              <h5 class="impl-client-name mb-2">{{ client_display_name(selected_implementation) }}</h5>
              <!-- Badge de estado general de la implementación -->
              <span class="badge impl-badge" :class="status_badge_class(selected_implementation.status)">
                {{ status_label(selected_implementation.status) }}
              </span>
              <!--
                Badge de modo automático: solo se muestra cuando la implementación
                responde y avanza sola (automation_mode === 'auto'). En modo manual
                (default) no se muestra nada, es el comportamiento esperado.
              -->
              <span
                v-if="selected_implementation.automation_mode === 'auto'"
                class="badge impl-badge bg-warning text-dark ms-2"
                title="Esta implementación responde y avanza sola"
              >
                Automática
              </span>
            </div>

            <!-- Acciones del header: botón conversación + botón avanzar etapa -->
            <div class="d-flex align-items-center gap-2 flex-shrink-0">

              <!--
                Botón de acceso directo a la conversación WhatsApp fullscreen.
                Navega a la vista ImplementationConversationView.
              -->
              <button
                v-if="selected_implementation"
                class="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1 flex-shrink-0"
                title="Ver conversación WhatsApp"
                @click="go_to_conversation(selected_implementation.id)"
              >
                <i class="bi bi-whatsapp" aria-hidden="true" />
                Conversación
              </button>

              <!--
                Botón avanzar etapa: solo visible si la implementación está activa
                y la etapa actual es menor a 8 (la última etapa cierra automáticamente).
              -->
              <button
                v-if="selected_implementation.status === 'in_progress' && selected_implementation.current_stage < 8"
                class="btn btn-primary btn-sm flex-shrink-0"
                :disabled="advancing_stage"
                @click="on_advance_stage"
              >
                {{ advancing_stage ? 'Avanzando...' : 'Avanzar etapa' }}
              </button>

            </div>
          </div>
        </div>

        <!-- Cuerpo con scroll propio: resumen de etapas y datos recolectados. -->
        <div
          ref="impl_right_body"
          class="impl-right-body flex-grow-1 overflow-auto"
        >

          <!-- Resumen: etapas y datos recolectados -->

          <!--
            Modal de acciones manuales (prompt 345, reorganizado en el 479): este componente
            ya no pinta ninguna fila de botones, solo es dueño del modal de preview/edición/
            envío. El padre lo abre por ref desde open_action() (Progreso arriba, o el botón
            de cada etapa).
          -->
          <implementation-action-bar
            v-if="selected_implementation"
            ref="action_modal"
            :implementation="selected_implementation"
            @updated="on_implementation_updated"
          />

          <!--
            Progreso: acción sin etapa fija (typical_stage null), siempre disponible
            arriba de todo, antes de "Etapas".
          -->
          <div v-if="progreso_action" class="mb-3">
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              @click="open_action(progreso_action)"
            >
              {{ progreso_action.label }}
            </button>
            <span v-if="progreso_action.last_executed_at" class="small text-muted ms-2">
              · enviado el {{ format_date(progreso_action.last_executed_at) }}
            </span>
          </div>

          <!-- Sección: progreso visual de las 8 etapas, como stepper vertical -->
          <h6 class="impl-section-title">Etapas</h6>
          <div class="impl-card impl-card--stages mb-4">
            <div
              v-for="stage in selected_implementation.stages"
              :key="stage.id"
              class="impl-stage-row d-flex align-items-start gap-3"
              :class="'impl-stage-row--' + stage.status"
            >
              <!--
                Columna del stepper: ícono de estado + línea conectora hacia la
                siguiente etapa. La línea se dibuja con ::after en CSS y se oculta
                en la última fila mediante :last-child.
              -->
              <div class="impl-stage-marker flex-shrink-0">
                <span class="impl-stage-icon">{{ stage_icon(stage.status) }}</span>
              </div>

              <div class="impl-stage-content flex-grow-1">
                <!-- Número y nombre de la etapa desde config -->
                <span class="impl-stage-name">
                  Etapa {{ stage.stage_number }}
                  <span v-if="stage.config" class="impl-stage-name__label">— {{ stage.config.name }}</span>
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
                  Subetapas de la etapa activa: se muestran para todas las etapas (1 a 8)
                  cuando están en progreso o completadas.
                  Cada subetapa indica con ✅/⬜ si su campo fue completado.
                  La nota opcional se muestra entre paréntesis si está presente.
                -->
                <div
                  v-if="stage.status === 'completed' || stage.status === 'in_progress'"
                  class="impl-stage-substeps mt-1"
                >
                  <div
                    v-for="substep in substeps_from_stage(stage, selected_implementation)"
                    :key="substep.key"
                    class="impl-stage-substep small"
                    :class="{ 'text-muted': !substep.done }"
                  >
                    {{ substep.done ? '✅' : '⬜' }} {{ substep.label }}
                    <span v-if="substep.note" class="text-muted ms-1">({{ substep.note }})</span>
                  </div>
                </div>

                <!-- Acciones de esta etapa: cada botón abre el modal para su acción -->
                <div
                  v-if="stage_actions(stage.stage_number).length > 0"
                  class="impl-stage-actions d-flex flex-wrap gap-2 mt-2"
                >
                  <div v-for="action in stage_actions(stage.stage_number)" :key="action.key">
                    <button
                      type="button"
                      class="btn btn-sm"
                      :class="action_button_class(action, stage)"
                      :disabled="action_button_disabled(action)"
                      @click="open_action(action)"
                    >
                      {{ action_button_label(action) }}
                    </button>

                    <!-- Motivo de bloqueo o último envío, en texto chico y gris -->
                    <div class="impl-stage-actions__meta small text-muted">
                      <span v-if="action.blocked && action.blocked_reason">{{ action.blocked_reason }}</span>
                      <span v-else-if="action.last_executed_at">· hecho el {{ format_date(action.last_executed_at) }}</span>
                      <span v-else-if="action.kind === 'message'">→ {{ action.recipient_label }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Sección: datos recolectados en el formulario de la etapa 1 -->
          <template v-if="form_summary_sections.length > 0">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <h6 class="impl-section-title mb-0">Datos recolectados (Etapa 1)</h6>

              <!-- Botón que abre el modo edición; oculto mientras ya se está editando -->
              <button
                v-if="!editing_form_data"
                type="button"
                class="btn btn-link btn-sm impl-form-edit-btn"
                @click="on_edit_form_data"
              >
                Editar
              </button>
            </div>

            <!-- Modo lectura: tabla label/valor agrupada por sección (Prompt 02) -->
            <div v-if="!editing_form_data" class="impl-card impl-card--form mb-3">
              <div
                v-for="section in form_summary_sections"
                :key="section.name"
                class="impl-form-section"
              >
                <!-- Encabezado de sección: nombre del grupo dentro del formulario -->
                <div class="impl-form-section__title">{{ section.name }}</div>

                <!-- Tabla label/valor de la sección, con divisores finos entre filas -->
                <table class="impl-form-table">
                  <tbody>
                    <tr v-for="(item, index) in section.items" :key="section.name + index">
                      <td class="impl-form-table__label">{{ item.label }}</td>
                      <td class="impl-form-table__value">{{ item.value }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!--
              Modo edición: reutiliza el mismo motor de campos del formulario público
              (FormularioSection + SECTIONS) sobre una copia de form_responses, no sobre
              el form_summary derivado (que es solo texto plano y no es reversible).
            -->
            <div v-else class="impl-card impl-card--form-edit mb-3">
              <!-- Aviso: guardar acá no re-empuja la configuración al ERP del cliente -->
              <p class="impl-form-edit-warning small text-muted">
                Estos cambios se guardan acá. Si la configuración del sistema ya se aplicó al cliente,
                volvé a aplicarla con "Re-aplicar configuración" para que impacten en su cuenta.
              </p>

              <formulario-section
                v-for="section in form_sections"
                :key="section.id"
                :section="section"
                :form_data="form_data_draft"
                :on_field_change="on_draft_field_change"
                :payment_method_options="payment_method_options_local"
              />

              <!-- Acciones del modo edición -->
              <div class="d-flex gap-2 mt-3 pt-3 impl-form-edit-actions">
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  :disabled="saving_form_data"
                  @click="on_save_form_data"
                >
                  {{ saving_form_data ? 'Guardando...' : 'Guardar' }}
                </button>
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  :disabled="saving_form_data"
                  @click="on_cancel_form_data_edit"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </template>

          <!-- Formulario todavía sin enviar -->
          <template v-else-if="selected_implementation">
            <h6 class="impl-section-title">Datos recolectados (Etapa 1)</h6>
            <div class="impl-card mb-3">
              <p class="text-muted small mb-0">
                El cliente todavía no envió el formulario.
              </p>
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
            <div class="impl-card impl-card--stage4 mb-4">
              <div class="small">
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

        </div>
      </template>

    </div>
  </div>

  <!-- Sidebar lateral de conversación WhatsApp (desktop), espeja LeadConversationSidebar -->
  <implementation-conversation-sidebar
    :implementation="sidebar_implementation"
    @close="on_sidebar_close"
    @record-updated="on_sidebar_record_updated"
  />

  <!-- Modal de alta de una nueva implementación eligiendo el cliente (Prompt 178-05) -->
  <create-implementation-modal
    :show="show_create_modal"
    :existing_client_ids="existing_implementation_client_ids"
    @update:show="show_create_modal = $event"
    @created="on_implementation_created"
  />
</template>

<script>
import api from '@/utils/axios'
import { set_global_loading_store } from '@/utils/global_loading'
import ImplementationActionBar from '@/components/implementation/ImplementationActionBar.vue'
/* Motor de campos del formulario público, reutilizado acá para editar form_responses (Prompt 178-03) */
import { SECTIONS } from '@/components/formulario/questions'
import FormularioSection from '@/components/formulario/FormularioSection.vue'
/* Sidebar lateral de conversación WhatsApp embebida (Prompt 178-04, espeja LeadConversationSidebar) */
import ImplementationConversationSidebar from '@/components/implementation/ImplementationConversationSidebar.vue'
/* Modal de alta de una nueva implementación con selector de cliente (Prompt 178-05) */
import CreateImplementationModal from '@/components/implementation/CreateImplementationModal.vue'

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

  components: { ImplementationActionBar, FormularioSection, ImplementationConversationSidebar, CreateImplementationModal },

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

      /**
       * Estado de las acciones manuales de la implementación abierta, devuelto por
       * GET /implementation/{id}/actions (prompt 479: antes lo cargaba y pintaba
       * ImplementationActionBar por su cuenta; ahora lo carga el padre para repartir
       * los botones dentro de cada etapa y dejar Progreso arriba de todo).
       */
      action_state: null,

      /**
       * True mientras el bloque "Datos recolectados" está en modo edición
       * (se reemplaza la tabla de solo lectura por el formulario editable).
       */
      editing_form_data: false,

      /**
       * Copia editable e independiente de implementation.form_responses, armada
       * al entrar en modo edición (clonado profundo, igual que build_fields_payload
       * en FormularioView). Se descarta al Cancelar; se envía tal cual al Guardar.
       */
      form_data_draft: null,

      /**
       * Indicador de guardado en curso del PATCH de form-responses.
       */
      saving_form_data: false,

      /**
       * Implementación actualmente abierta en el sidebar de conversación WhatsApp
       * (solo desktop). null = sidebar cerrado. Ver go_to_conversation (Prompt 178-04).
       */
      sidebar_implementation: null,

      /**
       * Visibilidad del modal de alta de una nueva implementación (Prompt 178-05).
       */
      show_create_modal: false,
    }
  },

  computed: {
    /**
     * Resumen del formulario de la etapa 1, agrupado por sección para el render.
     *
     * Consume implementation.form_summary (lista de { section, label, value } que
     * arma ImplementationFormMapper::build_summary en el backend). Preserva el orden
     * en que vino del backend, tanto de las secciones como de los ítems.
     *
     * @returns {Array<{name: string, items: Array<{label: string, value: string}>}>}
     */
    form_summary_sections() {
      const summary = (this.selected_implementation && this.selected_implementation.form_summary) || []
      const sections = []

      summary.forEach(function (item) {
        let section = sections.find(function (s) {
          return s.name === item.section
        })

        if (!section) {
          section = { name: item.section, items: [] }
          sections.push(section)
        }

        section.items.push({ label: item.label, value: item.value })
      })

      return sections
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
     * Acción "Progreso": no tiene etapa fija (`typical_stage === null`), se muestra
     * siempre arriba de todo, encima de la sección "Etapas".
     *
     * @returns {Object|null}
     */
    progreso_action() {
      const actions = (this.action_state && this.action_state.actions) || []

      return actions.find(function (action) {
        return action.typical_stage === null
      }) || null
    },

    /**
     * Definición de secciones del formulario público (questions.js), expuesta para
     * iterarla en el template del modo edición junto con FormularioSection.
     *
     * @returns {Array<Object>}
     */
    form_sections() {
      return SECTIONS
    },

    /**
     * Opciones de métodos de pago { key, label } para el select de descuentos/recargos
     * de FieldTablaDescuentos, agregadas al show() de implementación en el Prompt 178-01.
     *
     * @returns {Array<Object>}
     */
    payment_method_options_local() {
      return (this.selected_implementation && this.selected_implementation.payment_method_options) || []
    },

    /**
     * IDs de clientes que ya tienen una implementación (cualquier estado), a excluir
     * del buscador del modal de alta (Prompt 178-05).
     *
     * @returns {Array<number|string>}
     */
    existing_implementation_client_ids() {
      /** Lista de client_id a devolver, uno por implementación existente. */
      const ids = []

      this.implementations.forEach(function (impl) {
        if (impl.client_id != null) {
          ids.push(impl.client_id)
        }
      })

      return ids
    },

  },

  watch: {
    /**
     * Recarga el estado de acciones cuando cambia la implementación seleccionada o
     * su etapa actual: el gate/lock de 'user_setup' y la acción sugerida ('available')
     * dependen de ambos.
     */
    'selected_implementation.id': {
      handler() {
        this.load_action_state()
      },
    },
    'selected_implementation.current_stage'() {
      this.load_action_state()
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
     * @param {Function|null} on_loaded Callback opcional invocado al terminar (éxito o error),
     *   usado por on_implementation_created (Prompt 178-05) para seleccionar la implementación
     *   recién creada una vez que el listado ya se recargó.
     * @returns {void}
     */
    load_list(on_loaded) {
      const self = this
      this.list_loading = true
      set_global_loading_store(self.$store, true, 'Cargando implementaciones…')

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
          set_global_loading_store(self.$store, false)

          if (typeof on_loaded === 'function') {
            on_loaded()
          }
        })
    },

    /**
     * Maneja el evento `created` del modal de alta (Prompt 178-05): cierra el modal,
     * refresca el listado del panel izquierdo y, una vez recargado, deja seleccionada
     * la implementación recién creada en el panel derecho.
     *
     * @param {Object|null} model Implementación recién creada, devuelta por el backend.
     * @returns {void}
     */
    on_implementation_created(model) {
      this.show_create_modal = false

      const self = this
      /** ID de la implementación recién creada, si el backend lo devolvió. */
      const new_id = model && model.id

      this.load_list(function () {
        if (new_id) {
          self.select_implementation(new_id)
        }
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
      set_global_loading_store(self.$store, true, 'Cargando detalle de implementación…')

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
          set_global_loading_store(self.$store, false)
        })
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
     * Criterio: current_stage < 8 Y la etapa cuyo stage_number === current_stage
     * tiene status === 'completed' (la conversación automática terminó, falta el avance manual).
     *
     * @param {Object} impl Implementación con relación stages cargada.
     * @returns {boolean}
     */
    check_ready_to_advance(impl) {
      if (!impl || !impl.stages || impl.current_stage >= 8) {
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
     * Construye el listado de subetapas de cualquier etapa (1 a 8)
     * a partir del objeto `stage` y la implementación asociada.
     *
     * Recibe el stage completo (no solo `data`) para acceder a `stage.status`
     * y `stage.stage_number`. La Etapa 1 deriva sus subetapas del objeto
     * `implementation` (form_token, form_submitted_at), no de stage.data.
     *
     * @param {Object} stage            Etapa con stage_number, status y data.
     * @param {Object|null} implementation Implementación padre (form_token, form_submitted_at).
     * @returns {Array<{ key: string, label: string, done: boolean, note?: string }>}
     */
    substeps_from_stage(stage, implementation) {
      /* stage.data puede ser null si la etapa todavía no tiene datos recolectados */
      const data = stage.data || {}

      /* Número de etapa para elegir el mapa correspondiente */
      const num = stage.stage_number

      /**
       * Criterio de "done" para campos de archivos Excel:
       * el valor debe existir, no ser 'pending', y ser 'skipped' o un array con elementos.
       *
       * @param {*} val Valor del campo de archivos.
       * @returns {boolean}
       */
      var files_done = function (val) {
        return Boolean(val) && val !== 'pending' && (val === 'skipped' || (Array.isArray(val) && val.length > 0))
      }

      /* Acciones manuales ya ejecutadas en esta etapa (las registra ImplementationActionService). */
      const actions = Array.isArray(data.actions) ? data.actions : []

      /**
       * Indica si una acción manual ya fue ejecutada en esta etapa.
       *
       * @param {string} key Clave de la acción (ej: 'form_link').
       * @returns {boolean}
       */
      const action_done = function (key) {
        return actions.some(function (a) {
          return a.action === key
        })
      }

      /* ------------------------------------------------------------------ */
      /* Etapa 1 — Información de la empresa (formulario web)                */
      /* ------------------------------------------------------------------ */
      if (num === 1) {
        return [
          { key: 'presentacion',   label: 'Presentación enviada',           done: action_done('presentacion') },
          { key: 'form_sent',      label: 'Link del formulario enviado',    done: action_done('form_link') },
          { key: 'form_submitted', label: 'Cliente completó el formulario', done: Boolean(implementation && implementation.form_submitted_at != null) },
        ]
      }

      /* ------------------------------------------------------------------ */
      /* Etapa 2 — Instalación del sistema                                   */
      /* ------------------------------------------------------------------ */
      if (num === 2) {
        return [
          { key: 'installation', label: 'Sistema instalado',                     done: stage.status === 'completed' },
          { key: 'user_setup',   label: 'Configuración del formulario aplicada', done: action_done('user_setup') },
        ]
      }

      /* ------------------------------------------------------------------ */
      /* Etapa 3 — Recolección de archivos                                   */
      /* ------------------------------------------------------------------ */
      if (num === 3) {
        return [
          { key: 'files_requested', label: 'Archivos pedidos al cliente', done: action_done('pedir_archivos') },
          { key: 'articles_files',  label: 'Excel de artículos',    done: files_done(data.articles_files) },
          { key: 'clients_files',   label: 'Excel de clientes',     done: files_done(data.clients_files) },
          { key: 'suppliers_files', label: 'Excel de proveedores', done: files_done(data.suppliers_files) },
          { key: 'logo',            label: 'Logo de la empresa',    done: data.logo_received === true },
          { key: 'files_confirmed', label: 'Archivos confirmados',  done: data.files_confirmed_complete === true },
        ]
      }

      /* ------------------------------------------------------------------ */
      /* Etapa 4 — Migración de datos                                        */
      /* ------------------------------------------------------------------ */
      if (num === 4) {
        /* Acceso seguro al objeto import_status (puede no existir todavía) */
        const import_status = data.import_status || {}

        return [
          { key: 'analysis',          label: 'Análisis IA completado',  done: data.analysis_result != null },
          { key: 'mapping_confirmed', label: 'Mapeo confirmado',        done: data.completed === true },
          { key: 'import_articles',   label: 'Artículos importados',   done: import_status.articles && import_status.articles.status === 'success' },
          { key: 'import_clients',    label: 'Clientes importados',    done: import_status.clients && import_status.clients.status === 'success' },
          { key: 'import_suppliers',  label: 'Proveedores importados', done: import_status.suppliers && import_status.suppliers.status === 'success' },
        ]
      }

      /* ------------------------------------------------------------------ */
      /* Etapa 5 — Entrega del sistema                                       */
      /* ------------------------------------------------------------------ */
      if (num === 5) {
        return [
          { key: 'access_sent', label: 'Acceso enviado al cliente', done: action_done('entrega') || stage.status === 'completed' },
        ]
      }

      /* ------------------------------------------------------------------ */
      /* Etapa 6 — Capacitación                                              */
      /* ------------------------------------------------------------------ */
      if (num === 6) {
        return [
          {
            key: 'employees_notified',
            label: 'Credenciales enviadas a empleados',
            done: Array.isArray(data.employees_notified) && data.employees_notified.length > 0,
          },
          {
            key: 'resources_sent',
            label: 'Centro de recursos enviado',
            done: data.resources_sent === true,
          },
        ]
      }

      /* ------------------------------------------------------------------ */
      /* Etapa 7 — Vinculación ARCA/AFIP                                     */
      /* ------------------------------------------------------------------ */
      if (num === 7) {
        return [
          { key: 'afip_contact',    label: 'Responsable AFIP identificado', done: 'afip_contact_name' in data },
          { key: 'afip_steps_sent', label: 'Pasos AFIP enviados',           done: data.afip_steps_sent === true },
        ]
      }

      /* ------------------------------------------------------------------ */
      /* Etapa 8 — Videollamada de capacitación                               */
      /* ------------------------------------------------------------------ */
      if (num === 8) {
        return [
          {
            key: 'availability',
            label: 'Disponibilidad confirmada',
            done: 'availability' in data || data.skip_videocall === true,
          },
          {
            key: 'videocall_done',
            label: 'Videollamada realizada',
            done: stage.status === 'completed',
          },
        ]
      }

      /* Etapa fuera del rango conocido: sin subetapas */
      return []
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

    /**
     * Abre la conversación WhatsApp de una implementación.
     * En desktop (≥768px): abre el sidebar lateral sin navegar, igual que en leads.
     * En mobile (<768px): navega a la ruta de pantalla completa (comportamiento anterior).
     *
     * @param {number|string} impl_id ID de la implementación (fila del listado o header del detalle).
     * @returns {void}
     */
    go_to_conversation(impl_id) {
      if (window.innerWidth >= 768) {
        /* Resolver el objeto completo: si es la seleccionada, reusar selected_implementation
           (ya trae stages/messages/client); si no, buscarla en el listado. */
        if (this.selected_implementation && this.selected_implementation.id == impl_id) {
          this.sidebar_implementation = this.selected_implementation
          return
        }
        const impl = this.implementations.find(function (i) {
          return i.id == impl_id
        })
        this.sidebar_implementation = impl || null
        return
      }
      /* Mobile: mantener el comportamiento anterior de pantalla completa. */
      this.$router.push({
        name: 'implementation_conversation',
        params: { implementation_id: impl_id },
      })
    },

    /**
     * Cierra el sidebar lateral de conversación limpiando la implementación activa.
     *
     * @returns {void}
     */
    on_sidebar_close() {
      this.sidebar_implementation = null
    },

    /**
     * Propaga la actualización de implementación recibida desde el sidebar de conversación:
     * refresca la fila del listado y, si corresponde, el detalle seleccionado (reutilizando
     * on_implementation_updated) y la referencia local del sidebar.
     *
     * @param {Object} model Implementación actualizada.
     * @returns {void}
     */
    on_sidebar_record_updated(model) {
      if (!model || !model.id) {
        return
      }
      /* Si el modelo actualizado es el que está seleccionado en el detalle, refrescarlo también. */
      if (this.selected_implementation && this.selected_implementation.id === model.id) {
        this.on_implementation_updated(model)
      } else {
        const index = this.implementations.findIndex(function (i) {
          return i.id === model.id
        })
        if (index !== -1) {
          this.implementations.splice(index, 1, model)
        }
      }
      /* Actualizar la referencia del sidebar si el modelo coincide con la implementación activa. */
      if (this.sidebar_implementation && this.sidebar_implementation.id === model.id) {
        this.sidebar_implementation = model
      }
    },

    /**
     * Reemplaza la implementación seleccionada por la versión fresca que devuelve el backend
     * tras ejecutar una acción (etapas, checklists y mensajes ya vienen actualizados).
     *
     * @param {Object} updated
     * @returns {void}
     */
    on_implementation_updated(updated) {
      this.selected_implementation = updated

      const index = this.implementations.findIndex(function (i) {
        return i.id === updated.id
      })

      if (index !== -1) {
        this.implementations.splice(index, 1, updated)
      }

      /*
       * Recargar el estado de acciones: el gate/lock del UserSetup, el "hecho el…" y
       * los botones habilitados/deshabilitados cambian recién después de ejecutar.
       */
      this.load_action_state()
    },

    /**
     * Carga el estado de las acciones manuales de la implementación abierta desde
     * GET /implementation/{id}/actions (destinatario, ventana, última ejecución,
     * gate/lock de 'user_setup', typical_stage y kind por acción).
     *
     * @returns {void}
     */
    load_action_state() {
      if (!this.selected_implementation || !this.selected_implementation.id) {
        this.action_state = null
        return
      }

      const self = this
      const impl_id = this.selected_implementation.id

      api
        .get('/implementation/' + impl_id + '/actions')
        .then(function (res) {
          self.action_state = res.data
        })
        .catch(function () {
          /* El interceptor global de axios ya muestra el toast de error. */
          self.action_state = null
        })
    },

    /**
     * Acciones cuya `typical_stage` corresponde a la etapa indicada, para pintar
     * la botonera dentro de la tarjeta de esa etapa.
     *
     * @param {number} stage_number Número de etapa (stage.stage_number).
     * @returns {Array<Object>}
     */
    stage_actions(stage_number) {
      const actions = (this.action_state && this.action_state.actions) || []

      return actions.filter(function (action) {
        return action.typical_stage === stage_number
      })
    },

    /**
     * Abre el modal de la acción indicada (Progreso o una acción de etapa).
     * El modal (ImplementationActionBar) es dueño del preview/edición/envío.
     *
     * @param {Object} action Item de acción a abrir.
     * @returns {void}
     */
    open_action(action) {
      if (!this.selected_implementation) return
      this.$refs.action_modal.open(action, this.selected_implementation.current_stage)
    },

    /**
     * Deshabilita el botón de una acción: solo cuando el backend la marca `blocked`
     * y además no admite forzarla (`can_force`). El caso "ya aplicado pero se puede
     * forzar" (user_setup con can_force true) deja el botón habilitado a propósito.
     *
     * @param {Object} action
     * @returns {boolean}
     */
    action_button_disabled(action) {
      return action.blocked === true && action.can_force !== true
    },

    /**
     * Clase del botón de una acción: destacado (btn-primary) cuando es la acción
     * sugerida para la etapa actual, secundario (btn-outline-secondary) en el resto.
     * Sin cajas de colores adicionales, diseño sobrio.
     *
     * @param {Object} action
     * @param {Object} stage
     * @returns {string}
     */
    action_button_class(action, stage) {
      return action.available === true && stage.status === 'in_progress'
        ? 'btn-primary'
        : 'btn-outline-secondary'
    },

    /**
     * Etiqueta del botón de una acción: por defecto `action.label`; 'user_setup' ya
     * aplicado (can_force true) muestra "Re-aplicar configuración" para dejar claro
     * que ya se corrió antes.
     *
     * @param {Object} action
     * @returns {string}
     */
    action_button_label(action) {
      if (action.key === 'user_setup' && action.can_force === true) {
        return 'Re-aplicar configuración'
      }
      return action.label
    },

    // -------------------------------------------------------------------------
    // Edición inline de "Datos recolectados" (Prompt 178-03)
    // -------------------------------------------------------------------------

    /**
     * Entra en modo edición del bloque "Datos recolectados": clona en profundidad
     * implementation.form_responses (el objeto crudo del formulario, no el summary
     * derivado) a form_data_draft para editarlo de forma independiente.
     *
     * @returns {void}
     */
    on_edit_form_data() {
      if (!this.selected_implementation) {
        return
      }

      /** Respuestas crudas guardadas en la implementación (puede venir null/vacío). */
      const raw = this.selected_implementation.form_responses

      /* Clonado profundo (mismo patrón que build_fields_payload en FormularioView) para
         que editar el borrador no mute el objeto original hasta confirmar el guardado. */
      this.form_data_draft = raw && typeof raw === 'object' && !Array.isArray(raw)
        ? JSON.parse(JSON.stringify(raw))
        : {}

      this.editing_form_data = true
    },

    /**
     * Callback pasado a FormularioSection ante cada cambio de campo del borrador.
     * FormularioSection ya muta form_data_draft directamente (objeto reactivo
     * compartido); acá no hace falta autoguardar como en el formulario público,
     * el guardado en este panel es siempre explícito con el botón "Guardar".
     *
     * @param {string} key   Clave del campo modificado.
     * @param {*} value      Nuevo valor del campo.
     * @returns {void}
     */
    on_draft_field_change(key, value) {
      /* Sin acción adicional: se deja el método por claridad del contrato con FormularioSection. */
    },

    /**
     * Descarta el borrador y vuelve a la tabla de solo lectura sin guardar nada.
     *
     * @returns {void}
     */
    on_cancel_form_data_edit() {
      this.editing_form_data = false
      this.form_data_draft = null
    },

    /**
     * Guarda el borrador contra PATCH /implementation/{id}/form-responses (Prompt 178-01).
     * El backend reemplaza form_responses, re-corre ImplementationFormMapper::apply()
     * (sin disparar el UserSetup remoto) y devuelve el modelo fresco con form_summary
     * recalculado, que se usa para refrescar tanto el detalle como la fila del listado.
     *
     * @returns {void}
     */
    on_save_form_data() {
      if (!this.selected_implementation || this.saving_form_data) {
        return
      }

      const self = this

      /** ID de la implementación cuyo formulario se está editando. */
      const id = this.selected_implementation.id

      this.saving_form_data = true
      set_global_loading_store(self.$store, true, 'Guardando datos recolectados…')

      api
        .patch('/implementation/' + id + '/form-responses', { form_responses: this.form_data_draft })
        .then(function (res) {
          /** Modelo fresco devuelto por el backend (form_responses + form_summary recalculados). */
          const updated = res.data.model

          if (updated) {
            /* Reutiliza el mismo flujo de refresco que las acciones manuales: actualiza
               selected_implementation y la fila correspondiente en implementations. */
            self.on_implementation_updated(updated)
          }

          /* Volver a la tabla de solo lectura, ya repintada con los datos nuevos. */
          self.editing_form_data = false
          self.form_data_draft = null
        })
        .catch(function () {
          /* El interceptor global de axios ya muestra el toast de error.
             Se deja el formulario en modo edición para no perder lo tipeado. */
        })
        .then(function () {
          self.saving_form_data = false
          set_global_loading_store(self.$store, false)
        })
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

/*
  Botón "+ Nueva implementación" del encabezado del panel izquierdo (Prompt 178-05):
  sobrio, con el mismo acento azul del resto de acciones primarias de la vista.
*/
.impl-new-btn {
  color: #0d6efd;
  background-color: #e7f1ff;
  border: none;
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 0.78rem;
  font-weight: 500;
  white-space: nowrap;
}

.impl-new-btn:hover {
  background-color: #d7e8ff;
  color: #0d6efd;
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

/* Header del panel derecho: sobre blanco, separado del cuerpo con un borde sutil */
.impl-right-top {
  padding: 18px 20px;
  background-color: #fff;
  border-bottom: 1px solid #e9ecef;
}

/* Nombre del cliente: un poco más de aire respecto de los badges */
.impl-client-name {
  font-weight: 600;
  letter-spacing: -0.01em;
}

/* Badges del header: esquinas más suaves y algo de padding extra para que respiren */
.impl-badge {
  padding: 0.35em 0.7em;
  border-radius: 6px;
  font-weight: 500;
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

/*
  Cuerpo scrolleable del panel derecho: fondo gris neutro tipo Apple (#f5f5f7)
  para dar contraste contra las tarjetas blancas que cuelgan de cada sección.
*/
.impl-right-body {
  padding: 20px;
  background-color: #f5f5f7;
}

/* Modo conversación: sin padding para que el componente ocupe todo el espacio */
.impl-right-body--no-padding {
  padding: 0;
  background-color: #fff;
}

/*
  Título de sección: se mantiene como guía visual pero en sentence case y con
  algo más de peso que antes, sin mayúsculas agresivas (criterio Apple).
*/
.impl-section-title {
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: #6c757d;
  margin-bottom: 10px;
}

/*
  Tarjeta blanca genérica: envoltorio de cada bloque de contenido (etapas,
  datos recolectados, archivos). Esquinas redondeadas y sombra muy suave.
*/
.impl-card {
  background-color: #fff;
  border-radius: 14px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  padding: 16px 18px;
}

/* Tarjeta del stepper de etapas: el padding vertical lo maneja cada fila */
.impl-card--stages {
  padding: 8px 18px;
}

/* Fila individual de etapa dentro del stepper vertical */
.impl-stage-row {
  position: relative;
  padding: 10px 0;
}

/* Última fila: sin margen extra debajo */
.impl-stage-row:last-child {
  padding-bottom: 12px;
}

/*
  Columna del marcador: ícono de estado + línea conectora vertical hacia la
  fila siguiente. La línea se dibuja con ::after y se oculta en la última fila.
*/
.impl-stage-marker {
  position: relative;
  width: 1.6rem;
  display: flex;
  justify-content: center;
}

.impl-stage-row:not(:last-child) .impl-stage-marker::after {
  content: '';
  position: absolute;
  top: 1.6rem;
  bottom: -10px;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  background-color: #e5e5ea;
}

/* Ícono de estado de la etapa, centrado sobre la línea conectora */
.impl-stage-icon {
  font-size: 1rem;
  line-height: 1.5rem;
  text-align: center;
}

/* Nombre de la etapa: peso normal por defecto, se destaca en la etapa en curso */
.impl-stage-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1d1d1f;
}

.impl-stage-name__label {
  color: #6c757d;
  font-weight: 400;
}

/* Etapa en curso: es la que mira el admin, se destaca con acento azul */
.impl-stage-row--in_progress .impl-stage-name {
  color: #0d6efd;
}

/* Etapa completada: nombre en gris, ya no requiere atención */
.impl-stage-row--completed .impl-stage-name {
  color: #6c757d;
  font-weight: 500;
}

/* Etapa pendiente o saltada: atenuada */
.impl-stage-row--pending .impl-stage-name,
.impl-stage-row--skipped .impl-stage-name {
  color: #aeaeb2;
  font-weight: 500;
}

/* Contenedor de subetapas de cualquier etapa, indentado bajo el nombre de la etapa */
.impl-stage-substeps {
  padding-left: 0.1rem;
}

/* Ítem individual de subetapa con pequeño espaciado vertical */
.impl-stage-substep {
  line-height: 1.5;
}

/* Botonera de acciones dentro de una etapa (prompt 479) */
.impl-stage-actions {
  padding-left: 0.1rem;
}

/* Motivo de bloqueo o último envío debajo de cada botón de acción de etapa */
.impl-stage-actions__meta {
  margin-top: 2px;
  line-height: 1.3;
  max-width: 220px;
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

/* Tarjeta del bloque "Datos recolectados": cada sección va separada por su título */
.impl-card--form {
  padding: 6px 0;
}

/* Sección individual dentro de la tarjeta de datos recolectados */
.impl-form-section {
  padding: 12px 18px;
}

.impl-form-section:not(:last-child) {
  border-bottom: 1px solid #f1f1f3;
}

/* Encabezado de sección: nombre del grupo de campos del formulario */
.impl-form-section__title {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #86868b;
  margin-bottom: 6px;
}

/*
  Tabla label/valor: dos columnas, label suave a la izquierda y valor legible
  a la derecha, con zebra suave y divisores finos entre filas para escanear
  rápido. Se deja el markup ordenado para que el modo edición (prompt 03)
  pueda insertarse en la celda de valor sin pelear con el layout.
*/
.impl-form-table {
  width: 100%;
  border-collapse: collapse;
}

.impl-form-table tr:nth-child(even) {
  background-color: #fafafa;
}

.impl-form-table tr:not(:last-child) td {
  border-bottom: 1px solid #f1f1f3;
}

.impl-form-table td {
  padding: 7px 8px;
  font-size: 0.875rem;
  vertical-align: top;
}

.impl-form-table__label {
  color: #6c757d;
  width: 42%;
  white-space: normal;
}

.impl-form-table__value {
  color: #1d1d1f;
  word-break: break-word;
}

/* Botón "Editar" del bloque de datos recolectados: discreto, sin caja */
.impl-form-edit-btn {
  padding: 0;
  font-size: 0.8rem;
  text-decoration: none;
}

.impl-form-edit-btn:hover {
  text-decoration: underline;
}

/* Tarjeta del modo edición: mismo look que impl-card--form pero con padding propio */
.impl-card--form-edit {
  padding: 16px 18px;
}

/* Aviso sobre re-aplicar la configuración tras editar los datos */
.impl-form-edit-warning {
  background-color: #fff8e6;
  border: 1px solid #f5e3b3;
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 16px;
  line-height: 1.4;
}

/* Botonera Guardar/Cancelar del modo edición */
.impl-form-edit-actions {
  border-top: 1px solid #f1f1f3;
}

/* Tarjeta del panel de archivos de Etapa 4 */
.impl-card--stage4 {
  padding: 16px 18px;
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
