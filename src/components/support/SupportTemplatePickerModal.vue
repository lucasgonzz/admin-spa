<template>
  <base-modal
    :show="show"
    title="Mandar una plantilla"
    size="lg"
    @update:show="on_update_show"
    @close="close">

    <div v-if="loading" class="text-muted small d-flex align-items-center">
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      Cargando plantillas…
    </div>

    <div v-else-if="load_error" class="text-center py-3">
      <p class="text-danger small mb-2">{{ load_error }}</p>
      <button type="button" class="btn btn-sm btn-outline-secondary" @click="load_templates">
        Reintentar
      </button>
    </div>

    <!-- Vista previa: la plantilla elegida, con un campo por cada dato que le falta a Meta. -->
    <div v-else-if="selected_template">
      <div class="d-flex justify-content-between align-items-center mb-1">
        <small class="text-muted fw-semibold">Vista previa</small>
        <button type="button" class="btn btn-link btn-sm p-0 text-muted" @click="volver_a_la_lista">
          <i class="bi bi-x-lg" aria-hidden="true" /> Volver
        </button>
      </div>

      <div class="template-preview mb-3">{{ preview_text }}</div>

      <div v-if="variable_values.length" class="mb-3">
        <small class="text-muted fw-semibold d-block mb-2">Completá los datos de la plantilla:</small>
        <div v-for="variable in variable_values" :key="variable.placeholder" class="mb-2">
          <label class="form-label form-label-sm mb-1" :for="'support_tpl_var_' + variable.placeholder">
            {{ variable.label }}
          </label>
          <input
            :id="'support_tpl_var_' + variable.placeholder"
            v-model="variable.value"
            type="text"
            class="form-control form-control-sm"
            :placeholder="variable.placeholder"
            :disabled="enviando"
            maxlength="600" />
        </div>
      </div>

      <p v-if="send_error" class="text-danger small mb-2">{{ send_error }}</p>

      <button
        type="button"
        class="btn btn-success w-100"
        :disabled="enviando || hay_variables_vacias"
        @click="enviar">
        <span v-if="enviando" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        <i v-else class="bi bi-send me-2" aria-hidden="true" />
        Mandar plantilla
      </button>
    </div>

    <!-- Lista: buscador arriba y, sin texto escrito, los grupos por categoría. -->
    <div v-else>
      <p v-if="!templates.length" class="text-muted small mb-0">
        Todavía no hay plantillas de cliente cargadas.
      </p>
      <template v-else>
        <div class="mb-3">
          <div class="input-group input-group-sm">
            <span class="input-group-text bg-white border-end-0">
              <i class="bi bi-search text-muted" aria-hidden="true" />
            </span>
            <input
              v-model="search_text"
              type="text"
              class="form-control form-control-sm border-start-0"
              placeholder="Buscar plantilla..." />
          </div>
        </div>

        <!-- Con texto escrito los grupos estorban: el operador ya sabe qué está buscando. -->
        <div v-if="is_searching">
          <small class="text-muted fw-semibold d-block mb-2">
            {{ filtered_templates.length }} resultado(s)
          </small>
          <div
            v-for="tpl in filtered_templates"
            :key="tpl.id"
            class="template-item border rounded p-2 mb-2"
            @click="on_select(tpl)">
            <div class="fw-semibold small">{{ tpl.titulo || tpl.template_name }}</div>
            <div v-if="tpl.descripcion" class="text-muted template-item-descripcion">
              {{ tpl.descripcion }}
            </div>
            <div v-if="tpl.body_template" class="text-muted template-item-body">
              {{ tpl.body_template }}
            </div>
          </div>
        </div>

        <template v-else>
          <div v-for="grupo in grupos" :key="grupo.categoria" class="mb-2">
            <div
              class="group-header d-flex align-items-center justify-content-between py-1"
              @click="toggle_grupo(grupo.categoria)">
              <div class="d-flex align-items-center">
                <i
                  class="bi me-1 text-muted"
                  :class="grupo_abierto(grupo.categoria) ? 'bi-chevron-down' : 'bi-chevron-right'"
                  aria-hidden="true" />
                <small class="fw-semibold">{{ grupo.label }}</small>
              </div>
              <small class="text-muted">{{ grupo.templates.length }}</small>
            </div>

            <div v-if="grupo_abierto(grupo.categoria)" class="ps-1">
              <div
                v-for="tpl in grupo.templates"
                :key="tpl.id"
                class="template-item border rounded p-2 mb-2"
                @click="on_select(tpl)">
                <div class="fw-semibold small">{{ tpl.titulo || tpl.template_name }}</div>
                <div v-if="tpl.descripcion" class="text-muted template-item-descripcion">
                  {{ tpl.descripcion }}
                </div>
                <div v-if="tpl.body_template" class="text-muted template-item-body">
                  {{ tpl.body_template }}
                </div>
              </div>
            </div>
          </div>
        </template>
      </template>
    </div>
  </base-modal>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import BaseModal from '@/components/ui/BaseModal.vue'

/**
 * Selector de plantillas de CLIENTE para mandar desde un ticket de soporte.
 *
 * Son un juego aparte de las de lead (followup_templates): esas las levanta el motor de
 * seguimiento automático, y mezclarlas terminaría mandándole a un lead una plantilla pensada
 * para un cliente. Por eso lee de /client-template y no del store de followup_template.
 *
 * Se usa sobre todo con la ventana de 24hs vencida, que es cuando Meta no deja mandar texto
 * libre y una plantilla aprobada es la única forma de retomar la conversación.
 */
export default {
  name: 'SupportTemplatePickerModal',
  components: {
    BaseModal,
  },
  props: {
    /**
     * Visibilidad del modal (v-model:show).
     */
    show: {
      type: Boolean,
      default: false,
    },
    /**
     * Ticket al que se le manda la plantilla.
     */
    ticket_id: {
      type: [Number, String],
      default: null,
    },
  },
  emits: ['update:show', 'sent'],
  data() {
    return {
      /** Plantillas activas que devolvió la API. */
      templates: [],
      /** GET /client-template en curso. */
      loading: false,
      /** Error del GET; se muestra con un botón para reintentar. */
      load_error: '',
      /** Texto del buscador. Con contenido, la lista se aplana y se ignoran los grupos. */
      search_text: '',
      /** Grupos que el operador cerró a mano (clave = slug de categoría). */
      grupos_abiertos: {},
      /** Plantilla elegida; null muestra la lista. */
      selected_template: null,
      /** Datos a completar de la plantilla elegida, en el orden en que los espera Meta. */
      variable_values: [],
      /** POST de envío en curso. */
      enviando: false,
      /** Motivo por el que la plantilla no salió. */
      send_error: '',
    }
  },
  computed: {
    /**
     * @returns {boolean}
     */
    is_searching() {
      return this.search_text.trim().length > 0
    },
    /**
     * Plantillas que matchean el buscador por título, nombre de Meta, descripción o cuerpo.
     *
     * @returns {Array}
     */
    filtered_templates() {
      const query = this.search_text.trim().toLowerCase()
      if (!query) {
        return []
      }
      return this.templates.filter(function (tpl) {
        const campos = [tpl.titulo, tpl.template_name, tpl.descripcion, tpl.body_template]
        let matchea = false
        campos.forEach(function (campo) {
          if (String(campo || '').toLowerCase().indexOf(query) !== -1) {
            matchea = true
          }
        })
        return matchea
      })
    },
    /**
     * Plantillas agrupadas por categoría, en el orden que dictan categoria_orden y el nombre
     * del grupo. Es el mismo agrupado que el selector de leads, con los mismos tres campos.
     *
     * @returns {Array}
     */
    grupos() {
      const mapa = {}
      this.templates.forEach(function (tpl) {
        const clave = tpl.categoria || 'otras'
        if (!mapa[clave]) {
          mapa[clave] = {
            categoria: clave,
            label: tpl.categoria_label || 'Otras plantillas',
            orden: typeof tpl.categoria_orden === 'number' ? tpl.categoria_orden : 99,
            templates: [],
          }
        }
        mapa[clave].templates.push(tpl)
      })
      return Object.keys(mapa)
        .map(function (k) { return mapa[k] })
        .sort(function (a, b) {
          if (a.orden !== b.orden) { return a.orden - b.orden }
          return a.label.localeCompare(b.label, 'es')
        })
    },
    /**
     * Cuerpo de la plantilla con los datos ya cargados puestos en su lugar.
     *
     * Los que todavía están vacíos se dejan como {{n}} a la vista: es la forma más corta de
     * mostrar qué falta sin que el texto se desarme en el medio.
     *
     * @returns {string}
     */
    preview_text() {
      if (!this.selected_template || !this.selected_template.body_template) {
        return ''
      }
      let texto = String(this.selected_template.body_template)
      this.variable_values.forEach(function (variable) {
        const valor = String(variable.value || '').trim()
        if (valor !== '') {
          texto = texto.replaceAll(variable.placeholder, valor)
        }
      })
      return texto
    },
    /**
     * Meta rechaza la plantilla si falta un parámetro, así que el botón espera a que estén todos.
     *
     * @returns {boolean}
     */
    hay_variables_vacias() {
      return this.variable_values.some(function (variable) {
        return String(variable.value || '').trim() === ''
      })
    },
    /**
     * Valores en el orden de placeholder ({{1}}, {{2}}, …), que es como Meta los numera.
     *
     * @returns {string[]}
     */
    resolved_variables() {
      return this.variable_values.map(function (variable) {
        return String(variable.value || '').trim()
      })
    },
  },
  watch: {
    /**
     * Cada apertura arranca de cero: dejar la plantilla anterior elegida haría que el operador
     * mande la de otro ticket sin darse cuenta.
     *
     * @param {boolean} is_visible
     */
    show(is_visible) {
      if (is_visible) {
        this.reset_form()
        this.load_templates()
      }
    },
  },
  methods: {
    /**
     * Sincroniza v-model:show con el padre.
     *
     * @param {boolean} value
     * @returns {void}
     */
    on_update_show(value) {
      this.$emit('update:show', value)
    },
    /**
     * Cierra el modal.
     *
     * @returns {void}
     */
    close() {
      this.$emit('update:show', false)
    },
    /**
     * Limpia la selección y los errores previos.
     *
     * @returns {void}
     */
    reset_form() {
      this.search_text = ''
      this.selected_template = null
      this.variable_values = []
      this.enviando = false
      this.send_error = ''
      this.load_error = ''
    },
    /**
     * Trae las plantillas de cliente activas.
     *
     * @returns {void}
     */
    load_templates() {
      const self = this
      this.loading = true
      this.load_error = ''
      api
        .get('/client-template', { silent_error: true })
        .then(function (response) {
          const models = response.data && response.data.models
          self.templates = Array.isArray(models) ? models : []
        })
        .catch(function (error) {
          self.templates = []
          self.load_error = resolve_error_message(error)
        })
        .then(function () {
          self.loading = false
        })
    },
    /**
     * Los grupos arrancan abiertos porque son pocos y el operador está apurado; solo se guarda
     * el estado de los que cerró a mano, por eso "sin dato" es abierto.
     *
     * @param {string} categoria
     * @returns {boolean}
     */
    grupo_abierto(categoria) {
      return this.grupos_abiertos[categoria] !== false
    },
    /**
     * @param {string} categoria
     * @returns {void}
     */
    toggle_grupo(categoria) {
      this.grupos_abiertos[categoria] = !this.grupo_abierto(categoria)
    },
    /**
     * Elige una plantilla y arma un campo por cada dato que hay que completar.
     *
     * A diferencia del selector de leads, acá no hay de dónde resolver un valor solo: el ticket
     * no tiene una ficha con los campos de la plantilla, así que se piden todos.
     *
     * @param {Object} tpl
     * @returns {void}
     */
    on_select(tpl) {
      this.selected_template = tpl
      this.send_error = ''
      this.variable_values = this.build_variable_values(tpl)
    },
    /**
     * Vuelve a la lista sin mandar nada.
     *
     * @returns {void}
     */
    volver_a_la_lista() {
      this.selected_template = null
      this.variable_values = []
      this.send_error = ''
    },
    /**
     * Arma la lista de datos a completar de una plantilla.
     *
     * Si la fila no trae `variables` cargadas, los placeholders se sacan del propio cuerpo: Meta
     * necesita un parámetro por cada {{n}} y sin eso el envío se rechaza entero.
     *
     * @param {Object} tpl
     * @returns {Array<{placeholder: string, label: string, value: string}>}
     */
    build_variable_values(tpl) {
      const declaradas = Array.isArray(tpl.variables) ? tpl.variables : []
      const filas = []
      declaradas.forEach(function (variable) {
        const placeholder = String(variable.placeholder || '').trim()
        if (placeholder === '') {
          return
        }
        filas.push({
          placeholder: placeholder,
          label: variable.label || placeholder,
          value: '',
        })
      })
      if (filas.length) {
        return this.ordenar_por_numero(filas)
      }
      const cuerpo = String(tpl.body_template || '')
      const encontrados = cuerpo.match(/\{\{\s*\d+\s*\}\}/g) || []
      const vistos = {}
      encontrados.forEach(function (crudo) {
        const numero = crudo.replace(/\D+/g, '')
        if (numero === '' || vistos[numero]) {
          return
        }
        vistos[numero] = true
        filas.push({
          placeholder: '{{' + numero + '}}',
          label: 'Dato ' + numero,
          value: '',
        })
      })
      return this.ordenar_por_numero(filas)
    },
    /**
     * Ordena los datos por el número del placeholder.
     *
     * El array que se manda va posicional -el primer valor es {{1}}-, así que el orden en el que
     * vinieron cargados en la fila no puede decidir a qué parámetro entra cada cosa.
     *
     * @param {Array} filas
     * @returns {Array}
     */
    ordenar_por_numero(filas) {
      return filas.slice().sort(function (a, b) {
        const na = parseInt(String(a.placeholder).replace(/\D+/g, ''), 10)
        const nb = parseInt(String(b.placeholder).replace(/\D+/g, ''), 10)
        return (isNaN(na) ? 0 : na) - (isNaN(nb) ? 0 : nb)
      })
    },
    /**
     * Manda la plantilla al teléfono del ticket.
     *
     * Con delivery = failed el modal NO se cierra: el mensaje ya quedó en el hilo marcado como
     * no entregado, y el operador tiene que poder corregir un dato y volver a mandarla sin
     * tener que buscar la plantilla de nuevo.
     *
     * @returns {void}
     */
    enviar() {
      if (!this.selected_template || this.enviando) {
        return
      }
      if (this.ticket_id == null) {
        this.send_error = 'No hay ningún ticket abierto.'
        return
      }
      const self = this
      this.enviando = true
      this.send_error = ''
      api
        .post(
          '/support-ticket/' + this.ticket_id + '/send-client-template',
          {
            client_template_id: this.selected_template.id,
            variables: this.resolved_variables,
          },
          { silent_error: true }
        )
        .then(function (response) {
          const data = response.data || {}
          if (data.delivery === 'failed') {
            self.send_error = data.error || 'Meta rechazó la plantilla. Revisá que esté aprobada.'
            return
          }
          self.$emit('sent', data.model || null)
          self.close()
        })
        .catch(function (error) {
          self.send_error = resolve_error_message(error)
        })
        .then(function () {
          self.enviando = false
        })
    },
  },
}
</script>

<style scoped>
/* Cuerpo de la plantilla tal como le va a llegar al cliente. */
.template-preview {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.9rem;
  background: #d9fdd3;
  border: 1px solid #bfe9b7;
  border-radius: 8px;
  padding: 12px;
}

.template-item {
  cursor: pointer;
  transition: background-color 0.15s;
}

.template-item:hover {
  background-color: var(--bs-gray-100, #f8f9fa);
}

.template-item-descripcion {
  font-size: 0.75rem;
}

/* El cuerpo en la lista es una referencia, no el texto completo: se corta en un renglón. */
.template-item-body {
  font-size: 0.8rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-header {
  cursor: pointer;
}

.group-header:hover small.fw-semibold {
  color: var(--bs-primary);
}
</style>
