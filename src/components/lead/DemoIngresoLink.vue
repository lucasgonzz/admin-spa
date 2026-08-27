<template>
  <div>
    <label class="form-label mb-0">{{ field_label }}</label>
    <small class="form-text text-muted d-block mt-1 mb-2">
      {{ textos.ayuda }}
    </small>

    <!-- Sin link que mostrar se dice, en vez de dejar un input vacío que parezca un campo roto o
         un valor que todavía no cargó. -->
    <p v-if="!link_url" class="text-muted small mb-0">
      <i class="bi bi-dash-circle me-1" aria-hidden="true" />
      {{ textos.vacio }}
    </p>

    <div v-else class="input-group">
      <!-- readonly y no disabled: readonly deja seleccionar y copiar el texto a mano, disabled no. -->
      <input
        :value="link_url"
        type="text"
        class="form-control"
        readonly
        :aria-label="field_label"
        @focus="on_focus"
      />
      <button
        type="button"
        class="btn"
        :class="copied_feedback ? 'btn-success' : 'btn-outline-secondary'"
        :title="copied_feedback ? 'Link copiado' : 'Copiar el link al portapapeles'"
        @click="on_copy"
      >
        <i class="bi" :class="copied_feedback ? 'bi-check-lg' : 'bi-clipboard'" aria-hidden="true" />
        {{ copied_feedback ? 'Copiado' : 'Copiar' }}
      </button>
      <!-- rel="noopener": la página se abre en otra pestaña y no tiene por qué recibir una
           referencia al window del admin. -->
      <a
        :href="link_url"
        target="_blank"
        rel="noopener"
        class="btn btn-outline-secondary"
        :title="textos.abrir"
      >
        <i class="bi bi-box-arrow-up-right" aria-hidden="true" />
        Abrir
      </a>
    </div>
  </div>
</template>

<script>
import { copy_text_to_clipboard } from '@/utils/version_notification_clipboard'

/**
 * Textos que cambian según el campo que se esté renderizando.
 *
 * Vive fuera del `export default` porque es una tabla constante, no estado del componente: no
 * tiene por qué recrearse en cada instancia. La clave es la `key` del meta (`field_key`).
 */
const TEXTOS_POR_CAMPO = {
  demo_ingreso_url: {
    ayuda:
      'Es el link que abre la demo con la sesión ya iniciada y con el panel de tutoriales a la ' +
      'vista. Sin el token en la URL la demo se abre sin ese panel, así que este es el link que ' +
      'hay que mandarle al lead.',
    vacio: 'Todavía no hay link: el lead no tiene demo asignada o no se generó el acceso.',
    abrir: 'Abrir la demo en una pestaña nueva',
  },
  demo_experiencia_url: {
    ayuda:
      'Es la página que el lead recorre antes de entrar a la demo: responde el formulario de ' +
      'configuración, mira el video de introducción y desde ahí mismo accede. Es pública y no ' +
      'pide usuario ni contraseña, y el link es propio de este lead, así que se le puede mandar ' +
      'tal cual.',
    vacio: 'Todavía no hay link: revisá que el lead tenga uuid y que esté cargada la URL de admin-spa.',
    abrir: 'Abrir la página de experiencia en una pestaña nueva',
  },
}

/**
 * Bloque de link copiable del grupo Demo del modal del lead.
 *
 * Renderizado desde el meta declarativo (`LeadProperties.php`) vía `type: 'custom'` +
 * `custom_component: 'lead_demo_ingreso_link'`, con el mismo patrón que
 * `client_ecommerce_urls`: recibe `:record="form"`, o sea el borrador del modal.
 *
 * Sirve a los DOS campos de link del grupo Demo —`demo_ingreso_url` (link a la demo, con token) y
 * `demo_experiencia_url` (link público a la página de experiencia)—, resolviendo el valor y los
 * textos por `field_key`. Comparten renderizador a propósito: el bloque de copiar/abrir es
 * idéntico y duplicarlo duplicaría la lógica de portapapeles, que es justo la deuda que este
 * componente existe para no repetir.
 *
 * Los valores salen de los accesores `Lead::getDemoIngresoUrlAttribute()` y
 * `Lead::getDemoExperienciaUrlAttribute()` de admin-api, que
 * `LeadController::prepare_lead_for_detail_json()` inyecta en la respuesta del detalle. El
 * primero ya normaliza el esquema con `DemoUrlNormalizer` (misión del 17/8/2026), así que los
 * links que llegan acá son navegables tal cual y este componente no vuelve a tocarlos.
 *
 * No persiste nada: los campos están declarados `not_persisted_on_model` + `exclude_on_update`.
 *
 * Es un bloque distinto de `DemoAccesoControl.vue`, que vive en el panel lateral de WhatsApp:
 * aquel opera sobre el token (reemitir, revocar) y solo ofrece copiar; este muestra el link en
 * claro dentro del modal, que es lo que Lucas pidió el 25/8/2026. Y distinto también de
 * `DemoExperienciaControl.vue`, que elige la dinámica de demo (`actual`/`nueva`) y no muestra
 * ningún link.
 */
export default {
  name: 'DemoIngresoLink',

  props: {
    /** Borrador del formulario del lead (el `form` del ModelForm). */
    record: { type: Object, default: null },
    /** `key` del meta: decide qué campo del record se muestra y con qué textos. */
    field_key: { type: String, default: 'demo_ingreso_url' },
    /** Etiqueta declarada en el meta, para no duplicar el texto acá. */
    field_label: { type: String, default: 'Link de ingreso a la demo' },
  },

  data() {
    return {
      /** true mientras se muestra el feedback "Copiado" tras copiar el link. */
      copied_feedback: false,
      /** Id del setTimeout que apaga el feedback, para poder cancelarlo si se copia de nuevo. */
      copied_feedback_timer: null,
    }
  },

  computed: {
    /**
     * Textos del campo que se está renderizando. Ante una `field_key` desconocida cae en los del
     * link de ingreso a la demo, que es el default histórico del componente.
     *
     * @returns {Object}
     */
    textos() {
      return TEXTOS_POR_CAMPO[this.field_key] || TEXTOS_POR_CAMPO.demo_ingreso_url
    },

    /**
     * Link tal como vino del backend.
     *
     * A propósito NO se arma acá un fallback concatenando `record.demo.erp_spa_url` con el
     * token: esa fórmula ya vive en un solo lugar (el accesor del modelo, que además normaliza
     * el esquema), y una segunda copia en el front es exactamente la deuda que dejó anotada
     * `DemoAccesoControl.vue`. Si el campo no viene, se muestra el estado vacío.
     *
     * @returns {string}
     */
    link_url() {
      if (!this.record || !this.record[this.field_key]) {
        return ''
      }
      return String(this.record[this.field_key])
    },
  },

  beforeUnmount() {
    /* Limpiar el timer del feedback para no dejarlo apuntando a un componente muerto. */
    if (this.copied_feedback_timer) {
      clearTimeout(this.copied_feedback_timer)
    }
  },

  methods: {
    /**
     * Selecciona el link entero al enfocar el input, para que un Ctrl+C alcance.
     *
     * @param {FocusEvent} event
     * @returns {void}
     */
    on_focus(event) {
      if (event && event.target && event.target.select) {
        event.target.select()
      }
    },

    /**
     * Copia el link al portapapeles y muestra feedback por 2 segundos.
     * Reutiliza el mismo helper que usa `DemoAccesoControl.vue`.
     *
     * @returns {void}
     */
    on_copy() {
      var self = this
      if (!this.link_url) {
        return
      }
      copy_text_to_clipboard(this.link_url)
        .then(function () {
          self.copied_feedback = true
          if (self.copied_feedback_timer) {
            clearTimeout(self.copied_feedback_timer)
          }
          self.copied_feedback_timer = setTimeout(function () {
            self.copied_feedback = false
            self.copied_feedback_timer = null
          }, 2000)
        })
        .catch(function () {
          alert('No se pudo copiar el link al portapapeles.')
        })
    },
  },
}
</script>
