<template>
  <base-modal
    :show="show"
    title="Nuevo ticket de WhatsApp"
    size="md"
    @update:show="on_update_show"
    @close="close">
    <!-- Paso 1 y 2: buscador y resultados. Se colapsan enteros al elegir un contacto. -->
    <template v-if="!contacto_elegido">
      <div class="mb-2">
        <label class="form-label" for="support_create_ticket_search">Cliente o contacto</label>
        <input
          id="support_create_ticket_search"
          ref="search_input"
          v-model="search_text"
          type="text"
          class="form-control"
          autocomplete="off"
          placeholder="Buscá por nombre, empresa o teléfono…"
          :disabled="creating"
          @input="on_search_input" />
      </div>

      <div v-if="searching" class="text-muted small d-flex align-items-center py-2">
        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        Buscando…
      </div>
      <p v-else-if="busqueda_corta" class="text-muted small mb-0 py-2">
        Escribí al menos 2 letras para buscar.
      </p>
      <p v-else-if="search_error" class="text-danger small mb-0 py-2">{{ search_error }}</p>
      <p v-else-if="sin_resultados" class="text-muted small mb-0 py-2">
        No encontramos ningún contacto con "{{ searched_text }}". Verificá que el cliente esté
        activo y tenga el teléfono cargado en su ficha o como empleado.
      </p>
      <div v-else class="support-contact-results">
        <div v-for="grupo in grupos" :key="grupo.client_id" class="support-contact-group">
          <div class="support-contact-group-title text-muted text-uppercase">{{ grupo.titulo }}</div>
          <button
            v-for="contacto in grupo.contactos"
            :key="contacto_key(contacto)"
            type="button"
            class="support-contact-row"
            :disabled="creating"
            @click="elegir_contacto(contacto)">
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <span class="fw-semibold">{{ contacto.label }}</span>
              <span class="badge rounded-pill" :class="rol_badge_class(contacto)">
                {{ rol_badge_text(contacto) }}
              </span>
              <!-- Distintivo de ventana en tono suave: el del rol ya usa el verde fuerte y dos
                   verdes llenos uno al lado del otro se leen como el mismo dato. -->
              <span class="badge rounded-pill" :class="window_badge_class(contacto)">
                {{ window_badge_text(contacto) }}
              </span>
            </div>
            <small class="text-muted d-block">{{ contacto.phone }}</small>
          </button>
        </div>
        <p v-if="truncated" class="text-muted small mb-0 mt-2">
          Hay más resultados: afiná la búsqueda.
        </p>
      </div>
    </template>

    <!-- Paso 3: contacto elegido, aviso de ventana y primer mensaje. -->
    <template v-else>
      <div class="mb-3">
        <label class="form-label d-block">Contacto</label>
        <div class="support-contact-selected d-flex align-items-center justify-content-between gap-2">
          <div class="support-contact-selected-data">
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <span class="fw-semibold">{{ contacto_elegido.label }}</span>
              <span class="badge rounded-pill" :class="rol_badge_class(contacto_elegido)">
                {{ rol_badge_text(contacto_elegido) }}
              </span>
            </div>
            <small class="text-muted d-block">
              {{ grupo_titulo(contacto_elegido) }} — {{ contacto_elegido.phone }}
            </small>
          </div>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary flex-shrink-0"
            :disabled="creating"
            @click="cambiar_contacto">
            Cambiar
          </button>
        </div>
      </div>

      <!-- Aviso de ventana: el operador tiene que saber ANTES de mandar si su texto sale
           tal cual o metido dentro de la plantilla aprobada de Meta. -->
      <div class="alert py-2 px-3 small" :class="window_alert_class">
        {{ window_alert_text }}
      </div>

      <div v-if="ventana_abierta" class="mb-3">
        <label class="form-label" for="support_create_ticket_body">Mensaje</label>
        <textarea
          id="support_create_ticket_body"
          v-model="message_body"
          class="form-control"
          rows="4"
          :maxlength="body_max_length"
          :disabled="creating"
          placeholder="Escribí el primer mensaje…"></textarea>
        <div class="d-flex justify-content-end">
          <small class="text-muted">{{ message_body.length }}/{{ body_max_length }}</small>
        </div>
      </div>

      <!-- Ventana cerrada: Meta no deja texto libre, así que el primer mensaje sale del mismo
           selector de plantillas que ya usan las conversaciones existentes. -->
      <div v-else class="mb-3">
        <label class="form-label d-block">Mensaje</label>
        <button
          v-if="!plantilla_elegida"
          type="button"
          class="btn btn-sm btn-outline-primary"
          :disabled="creating"
          @click="picker_visible = true">
          Elegir plantilla
        </button>
        <div v-else class="support-template-chosen">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div class="fw-semibold small">{{ plantilla_elegida.titulo }}</div>
            <button
              type="button"
              class="btn btn-link btn-sm p-0 text-muted flex-shrink-0"
              :disabled="creating"
              @click="cambiar_plantilla">
              Cambiar plantilla
            </button>
          </div>
          <div class="support-template-chosen-preview">{{ plantilla_elegida.preview }}</div>
        </div>
      </div>
    </template>

    <p v-if="submit_error" class="text-danger small mb-2">{{ submit_error }}</p>
    <button
      type="button"
      class="btn btn-success w-100"
      :disabled="!can_submit"
      @click="submit">
      <span v-if="creating" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
      {{ submit_label }}
    </button>

    <support-template-picker-modal
      :show="picker_visible"
      :defer_send="true"
      :stack_level="1"
      @update:show="picker_visible = $event"
      @selected="on_template_selected" />
  </base-modal>
</template>

<script>
import api from '@/utils/axios'
import BaseModal from '@/components/ui/BaseModal.vue'
import SupportTemplatePickerModal from '@/components/support/SupportTemplatePickerModal.vue'

/**
 * Espera entre la última tecla y la consulta. Sin esto cada letra tipeada es una búsqueda
 * contra la base de clientes, empleados y leads.
 */
const SEARCH_DEBOUNCE_MS = 300

/**
 * Mínimo de caracteres para buscar. Con una sola letra la respuesta sería media base y no le
 * sirve a nadie; el endpoint devuelve vacío igual, así que ni se lo molesta.
 */
const MIN_SEARCH_LENGTH = 2

/**
 * Modal para abrir un ticket de soporte por WhatsApp buscando a la persona con la que se va
 * a hablar.
 *
 * El buscador reemplaza al combo de clientes que había antes: aquel traía la base entera con
 * un GET /client y filtraba en el navegador, así que no se podía encontrar a un empleado ni
 * buscar por teléfono. Ahora la búsqueda la resuelve la API y devuelve contactos, no clientes.
 *
 * No hay selector de canal: todo ticket abierto desde el admin es de WhatsApp. El alta por ERP
 * sigue existiendo en la API para otros consumidores, pero esta pantalla no la ofrece más.
 */
export default {
  name: 'CreateTicketModal',
  components: {
    BaseModal,
    SupportTemplatePickerModal,
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
     * Operador logueado. El alta por WhatsApp no lo manda -el backend le asigna el ticket a
     * quien lo abre-, pero la prop queda declarada porque la vista de soporte la sigue pasando
     * y sacarla la convertiría en un atributo suelto.
     */
    assigned_admin_id: {
      type: [Number, String],
      default: null,
    },
  },
  emits: ['update:show', 'created'],
  data() {
    return {
      /** Lo que el operador tiene escrito en el buscador. */
      search_text: '',
      /** setTimeout del debounce; se cancela con cada tecla. */
      search_timer: null,
      /** Token de la búsqueda en curso; una respuesta con token viejo se descarta. */
      search_token: 0,
      /** Hay un GET /support-ticket/contact-search en vuelo. */
      searching: false,
      /** El GET falló; distinto de "no hay contactos que coincidan". */
      search_error: '',
      /** Contactos devueltos por la API, en el orden en que vinieron. */
      results: [],
      /** La API recortó los resultados. */
      truncated: false,
      /** Texto con el que volvió la última respuesta; el input puede ir más adelante. */
      searched_text: '',
      /** Contacto con el que se va a abrir la conversación. */
      contacto_elegido: null,
      /** Texto del primer mensaje. */
      message_body: '',
      /** Tope del primer mensaje. Es el de la variable de plantilla, que es el más chico:
          un tope variable según el contacto dejaba texto ya escrito por encima del límite. */
      body_max_length: 600,
      /** POST /support-ticket en curso. */
      creating: false,
      /** Error de validación o API al abrir la conversación. */
      submit_error: '',
      /** Plantilla elegida para el primer mensaje cuando la ventana está cerrada. null = sin elegir. */
      plantilla_elegida: null,
      /** Selector de plantillas anidado (defer_send) abierto. */
      picker_visible: false,
    }
  },
  computed: {
    /**
     * El buscador todavía no tiene con qué buscar.
     *
     * @returns {boolean}
     */
    busqueda_corta() {
      return this.search_text.trim().length < MIN_SEARCH_LENGTH
    },
    /**
     * La búsqueda ya volvió y no coincidió con nadie.
     *
     * @returns {boolean}
     */
    sin_resultados() {
      if (this.searching || this.busqueda_corta || this.search_error) {
        return false
      }
      return this.searched_text !== '' && this.results.length === 0
    },
    /**
     * Resultados agrupados por cliente para poder poner un encabezado por empresa.
     *
     * Se recorre en el orden en que vino la respuesta y no se ordena nada: el backend ya
     * devuelve al dueño antes que a sus empleados, que es justo lo que pidió Lucas, y
     * reordenar acá lo rompería.
     *
     * @returns {Array<Object>}
     */
    grupos() {
      const self = this
      const grupos = []
      const posicion_por_cliente = {}
      this.results.forEach(function (contacto) {
        const clave = String(contacto.client_id)
        if (posicion_por_cliente[clave] === undefined) {
          posicion_por_cliente[clave] = grupos.length
          grupos.push({
            client_id: contacto.client_id,
            titulo: self.grupo_titulo(contacto),
            contactos: [],
          })
        }
        grupos[posicion_por_cliente[clave]].contactos.push(contacto)
      })
      return grupos
    },
    /**
     * Habilita el botón de enviar.
     *
     * Con la ventana cerrada no hay texto libre: lo que habilita el envío es tener una
     * plantilla elegida, no el textarea (que ni siquiera se muestra en ese caso).
     *
     * @returns {boolean}
     */
    can_submit() {
      if (this.creating || !this.contacto_elegido) {
        return false
      }
      if (this.ventana_abierta) {
        return this.message_body.trim().length > 0
      }
      return this.plantilla_elegida !== null
    },
    /**
     * Texto del botón de enviar.
     *
     * @returns {string}
     */
    submit_label() {
      return this.creating ? 'Enviando…' : 'Enviar y abrir'
    },
    /**
     * true si Meta todavía deja mandar texto libre a este contacto (no escribió hace más de
     * 24hs). Mismo criterio defensivo que ya usaban window_alert_class/window_alert_text: sin
     * el dato, se asume cerrada.
     *
     * @returns {boolean}
     */
    ventana_abierta() {
      const c = this.contacto_elegido
      return !!(c && c.window && c.window.open)
    },
    /**
     * Clase del cartel de ventana.
     *
     * @returns {string}
     */
    window_alert_class() {
      return this.ventana_abierta ? 'alert-success' : 'alert-warning'
    },
    /**
     * Texto del cartel de ventana.
     *
     * El buscador no devuelve el nombre de la plantilla de apertura y pedirlo aparte necesitaría
     * un client_id que recién se sabe al elegir el contacto. Se nombra sin el nombre técnico,
     * que al operador no le dice nada.
     *
     * @returns {string}
     */
    window_alert_text() {
      if (this.ventana_abierta) {
        return 'Escribió hace menos de 24hs: tu mensaje sale tal cual lo escribís.'
      }
      return 'Hace más de 24hs que no escribe, así que Meta no deja mandar texto libre: el primer mensaje tiene que ser una plantilla aprobada.'
    },
  },
  watch: {
    /**
     * Al abrir el modal se limpia todo y el foco queda en el buscador, que es lo único que hay
     * para hacer en ese momento.
     *
     * @param {boolean} is_visible
     */
    show(is_visible) {
      if (is_visible) {
        this.reset_form()
        this.focus_search()
        return
      }
      this.cancelar_busqueda_pendiente()
    },
  },
  beforeUnmount() {
    this.cancelar_busqueda_pendiente()
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
     * Cierra el modal y notifica al padre.
     *
     * @returns {void}
     */
    close() {
      this.$emit('update:show', false)
    },
    /**
     * Limpia búsqueda, contacto elegido, mensaje y errores.
     *
     * @returns {void}
     */
    reset_form() {
      this.cancelar_busqueda_pendiente()
      this.search_text = ''
      this.searching = false
      this.search_error = ''
      this.results = []
      this.truncated = false
      this.searched_text = ''
      this.contacto_elegido = null
      this.message_body = ''
      this.creating = false
      this.submit_error = ''
      this.plantilla_elegida = null
      this.picker_visible = false
    },
    /**
     * Pone el cursor en el buscador después de que el modal terminó de renderizar.
     *
     * @returns {void}
     */
    focus_search() {
      const self = this
      this.$nextTick(function () {
        if (self.$refs.search_input) {
          self.$refs.search_input.focus()
        }
      })
    },
    /**
     * Corta el debounce pendiente e invalida la búsqueda que ya salió.
     *
     * Subir el token es lo que hace que una respuesta que vuelve tarde no pise resultados más
     * nuevos: es el mismo cuidado que tenía el modal viejo comparando el client_id.
     *
     * @returns {void}
     */
    cancelar_busqueda_pendiente() {
      if (this.search_timer) {
        clearTimeout(this.search_timer)
        this.search_timer = null
      }
      this.search_token = this.search_token + 1
    },
    /**
     * Programa la búsqueda con el debounce.
     *
     * @param {Event} evento Evento input del buscador.
     * @returns {void}
     */
    on_search_input(evento) {
      const crudo = evento && evento.target ? String(evento.target.value) : String(this.search_text)
      const texto = crudo.trim()
      this.cancelar_busqueda_pendiente()
      if (texto.length < MIN_SEARCH_LENGTH) {
        // Si el operador borra hasta dejar una letra, los resultados de la búsqueda anterior
        // no pueden quedar a la vista: ya no son respuesta de nada.
        this.searching = false
        this.search_error = ''
        this.results = []
        this.truncated = false
        this.searched_text = ''
        return
      }
      const self = this
      this.search_timer = setTimeout(function () {
        self.search_timer = null
        self.run_search(texto)
      }, SEARCH_DEBOUNCE_MS)
    },
    /**
     * Busca contactos en la API.
     *
     * Mientras la respuesta viaja se dejan a la vista los resultados anteriores a propósito:
     * vaciarlos con cada tecla hace parpadear la lista entera.
     *
     * @param {string} texto Texto ya trimeado.
     * @returns {void}
     */
    run_search(texto) {
      const self = this
      const token = this.search_token + 1
      this.search_token = token
      this.searching = true
      this.search_error = ''
      api
        .get('/support-ticket/contact-search', { params: { q: texto } })
        .then(function (response) {
          if (self.search_token !== token) {
            return
          }
          const data = response.data || {}
          self.results = Array.isArray(data.results) ? data.results : []
          self.truncated = data.truncated === true
          self.searched_text = texto
        })
        .catch(function () {
          if (self.search_token !== token) {
            return
          }
          self.results = []
          self.truncated = false
          self.searched_text = texto
          self.search_error = 'No se pudo buscar. Probá de nuevo en un momento.'
        })
        .then(function () {
          if (self.search_token === token) {
            self.searching = false
          }
        })
    },
    /**
     * Clave estable de una fila. El mismo teléfono puede estar en dos clientes distintos, así
     * que solo el teléfono no alcanza.
     *
     * @param {Object} contacto
     * @returns {string}
     */
    contacto_key(contacto) {
      const empleado = contacto.client_employee_id == null ? '0' : String(contacto.client_employee_id)
      return String(contacto.client_id) + '-' + String(contacto.origin) + '-' + empleado + '-' + String(contacto.phone)
    },
    /**
     * Encabezado del grupo: la razón social, y si no hay, el nombre del dueño.
     *
     * @param {Object} contacto
     * @returns {string}
     */
    grupo_titulo(contacto) {
      if (!contacto) {
        return ''
      }
      const company_name = contacto.company_name ? String(contacto.company_name).trim() : ''
      if (company_name) {
        return company_name
      }
      const client_name = contacto.client_name ? String(contacto.client_name).trim() : ''
      if (client_name) {
        return client_name
      }
      return 'Cliente #' + contacto.client_id
    },
    /**
     * Texto del distintivo de rol.
     *
     * @param {Object} contacto
     * @returns {string}
     */
    rol_badge_text(contacto) {
      return contacto && contacto.is_owner ? 'Dueño' : 'Empleado'
    },
    /**
     * Clase del distintivo de rol.
     *
     * @param {Object} contacto
     * @returns {string}
     */
    rol_badge_class(contacto) {
      return contacto && contacto.is_owner ? 'text-bg-success' : 'text-bg-secondary'
    },
    /**
     * Texto del distintivo de ventana de 24hs.
     *
     * @param {Object} contacto
     * @returns {string}
     */
    window_badge_text(contacto) {
      return contacto && contacto.window && contacto.window.open ? 'Escribió hace poco' : 'Ventana cerrada'
    },
    /**
     * Clase del distintivo de ventana de 24hs.
     *
     * @param {Object} contacto
     * @returns {string}
     */
    window_badge_class(contacto) {
      if (contacto && contacto.window && contacto.window.open) {
        return 'bg-success-subtle text-success-emphasis'
      }
      return 'bg-warning-subtle text-warning-emphasis'
    },
    /**
     * Elige el contacto y pasa al paso del mensaje.
     *
     * @param {Object} contacto
     * @returns {void}
     */
    elegir_contacto(contacto) {
      this.cancelar_busqueda_pendiente()
      this.contacto_elegido = contacto
      this.submit_error = ''
      this.plantilla_elegida = null
    },
    /**
     * Vuelve al buscador conservando lo que ya se había escrito y los resultados.
     *
     * @returns {void}
     */
    cambiar_contacto() {
      this.contacto_elegido = null
      this.submit_error = ''
      this.plantilla_elegida = null
      this.focus_search()
    },
    /**
     * Limpia la plantilla elegida y vuelve a abrir el picker para elegir otra.
     *
     * @returns {void}
     */
    cambiar_plantilla() {
      this.plantilla_elegida = null
      this.picker_visible = true
    },
    /**
     * El picker anidado eligió una plantilla (modo defer_send: todavía no mandó nada).
     *
     * @param {Object} payload {client_template_id, template_name, titulo, preview, variables}
     * @returns {void}
     */
    on_template_selected(payload) {
      this.plantilla_elegida = payload
      this.picker_visible = false
      this.submit_error = ''
    },
    /**
     * Abre la conversación por WhatsApp y manda el primer mensaje.
     *
     * Si el envío falla el ticket igual queda creado, así que se abre el hilo lo mismo y el
     * error se muestra en la conversación, donde está el botón de reintentar.
     *
     * @returns {void}
     */
    submit() {
      if (this.creating) {
        return
      }
      const contacto = this.contacto_elegido
      if (!contacto || !contacto.phone) {
        return
      }
      const self = this
      this.submit_error = ''
      this.creating = true
      /* La ventana decide qué manda: texto libre de siempre, o -si Meta no lo permite- la
         plantilla que ya eligió el operador en el picker anidado. El store y la respuesta son
         los mismos en los dos casos, así que de acá para abajo no hay que distinguir nada. */
      const payload = this.ventana_abierta
        ? {
            client_id: Number(contacto.client_id),
            whatsapp_phone: contacto.phone,
            body: this.message_body.trim(),
          }
        : {
            client_id: Number(contacto.client_id),
            whatsapp_phone: contacto.phone,
            client_template_id: this.plantilla_elegida.client_template_id,
            variables: this.plantilla_elegida.variables,
          }
      this.$store
        .dispatch('support_ticket/store_whatsapp', payload)
        .then(function (data) {
          self.creating = false
          const model = data && data.model
          const whatsapp = (data && data.whatsapp) || {}
          if (!model || !model.id) {
            self.submit_error = 'No se pudo abrir la conversación.'
            return
          }
          /* 'partial' también entra acá. Desde que el mensaje de apertura se puede partir con el
             separador, el envío puede salir a medias, y tratar eso como éxito cerraría el modal
             sin que nadie se entere de que faltan mensajes por mandar. */
          if (whatsapp.delivery === 'failed' || whatsapp.delivery === 'partial') {
            self.submit_error = self.build_delivery_error(whatsapp)
            self.$emit('created', model.id)
            return
          }
          self.$emit('created', model.id)
          self.close()
        })
        .catch(function (error) {
          self.creating = false
          const respuesta = error && error.response
          const detalle = respuesta && respuesta.data && respuesta.data.error
          self.submit_error = detalle || 'Error al abrir la conversación. Revisá la consola o intentá de nuevo.'
        })
    },
    /**
     * Arma el aviso de envío fallido con el motivo que devolvió Meta.
     *
     * @param {Object} whatsapp Bloque whatsapp de la respuesta del alta.
     * @returns {string}
     */
    build_delivery_error(whatsapp) {
      /* El envío partido puede salir a medias: las primeras partes llegaron y las demás quedaron
         en el hilo para reintentar. Ahí "no salió" sería mentira y "salió" también, así que el
         parcial lleva su propio texto con la cuenta de lo que llegó. */
      if (whatsapp.delivery === 'partial') {
        let parcial = 'La conversación quedó abierta y el mensaje salió a medias'
        if (whatsapp.sent_parts && whatsapp.total_parts) {
          parcial += ': llegaron ' + whatsapp.sent_parts + ' de ' + whatsapp.total_parts + ' mensajes'
        }
        parcial += '. Los que faltan quedaron en el hilo, marcados como no enviados, para que los reintentes desde ahí.'
        if (whatsapp.error) {
          parcial += ' Motivo: ' + whatsapp.error
        }
        return parcial
      }

      let texto = 'La conversación quedó abierta, pero el mensaje no salió.'
      if (whatsapp.used_template) {
        texto += ' Se intentó con la plantilla' + (whatsapp.template_name ? ' ' + whatsapp.template_name : '') + '; revisá que esté aprobada en Meta.'
      }
      if (whatsapp.error) {
        texto += ' Motivo: ' + whatsapp.error
      }
      return texto
    },
  },
}
</script>

<style scoped>
/* La lista scrollea adentro del modal: con muchos contactos el diálogo crecía hasta tapar la
   pantalla en un teléfono y el botón de enviar quedaba abajo de todo. */
.support-contact-results {
  max-height: 320px;
  overflow-y: auto;
  margin: 0 -4px;
  padding: 0 4px;
}

.support-contact-group + .support-contact-group {
  margin-top: 10px;
}

.support-contact-group-title {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 4px 2px;
  border-bottom: 1px solid #e9ecef;
}

.support-contact-row {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: 0;
  border-bottom: 1px solid #f1f3f5;
  padding: 8px 6px;
  cursor: pointer;
  transition: background 0.12s ease;
}

.support-contact-row:hover:not(:disabled),
.support-contact-row:focus-visible {
  background: #f1f3f5;
}

.support-contact-row:disabled {
  cursor: default;
  opacity: 0.6;
}

.support-contact-selected {
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  padding: 8px 10px;
}

/* Sin esto un nombre largo empuja al botón Cambiar fuera del modal en pantallas angostas. */
.support-contact-selected-data {
  min-width: 0;
}

/* Resumen de la plantilla elegida. El picker tiene su propio .template-preview pero es
   scoped y no cruza, así que acá va una versión chica propia. */
.support-template-chosen {
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  padding: 8px 10px;
}

.support-template-chosen-preview {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.85rem;
  color: #495057;
  margin-top: 4px;
}
</style>
