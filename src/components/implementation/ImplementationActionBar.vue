<template>
  <!--
    Modal de acción manual de la implementación.

    Prompt 345: un modal de preview/edición/envío por acción del backend
    (ImplementationActionService::ACTIONS). Prompt 479: este componente deja de pintar
    la fila de botones (ahora la pinta el padre, repartida dentro de cada etapa) y
    queda como único dueño del modal, que el padre abre por ref con open(action, stage).
  -->
  <base-modal
    :show="show_modal"
    :title="current_action ? current_action.label : ''"
    size="lg"
    @close="close_modal"
  >
    <template v-if="preview">
        <!-- Línea de destinatario: a quién le va a llegar y su teléfono (no aplica a side_effect) -->
        <p v-if="current_action && current_action.kind !== 'side_effect'" class="mb-2">
          Le va a llegar a <strong>{{ preview.recipient_label }}</strong>
          <span v-if="preview.recipient_phone"> ({{ preview.recipient_phone }})</span>.
        </p>

        <!-- Aviso de ventana cerrada con plantilla disponible: neutro, se envía igual -->
        <div
          v-if="preview.window_open === false && preview.template_name"
          class="alert alert-secondary py-2 small mb-3"
        >
          Pasaron más de 24 h desde el último mensaje del cliente. Se va a enviar como
          plantilla aprobada (<code>{{ preview.template_name }}</code>), por eso el texto
          no se puede editar.
        </div>

        <!-- Aviso de ventana cerrada sin plantilla: bloquea el envío -->
        <div
          v-else-if="preview.window_open === false && !preview.template_name"
          class="alert alert-warning py-2 small mb-3"
        >
          La ventana de 24 h está cerrada y esta acción todavía no tiene plantilla
          aprobada. Esperá a que el cliente escriba, o mandale la presentación.
        </div>

        <!-- Selector de etapa: solo para la acción 'progreso' -->
        <div v-if="current_action && current_action.key === 'progreso'" class="mb-3">
          <label class="form-label small text-muted mb-1">Etapa a informar</label>
          <select
            v-model.number="preview_stage"
            class="form-select form-select-sm"
            :disabled="loading_preview"
            @change="load_preview"
          >
            <option v-for="opt in progreso_stage_options" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!--
          Re-aplicar 'user_setup' (is_reapply): confirmación fuerte.

          Re-aplicarlo corre un migrate:fresh en el sistema del cliente: le BORRA toda la base
          y la arma de nuevo con el formulario. Antes este aviso era un gris "no alarmista" que
          hablaba de "re-enviar la configuración" y no decía que se pierden los datos. Acá se
          dice lo que pasa de verdad, y el botón no se habilita hasta que la persona lo confirma
          (nombre del cliente y, si el sistema parece estar en uso, un checkbox explícito).
          Ver can_submit / reapply_confirmed.
        -->
        <div v-if="is_reapply" class="impl-action-bar__confirm-text">
          <div class="alert alert-danger mb-3" role="alert">
            <div class="fw-semibold">Esto vuelve a crear el sistema del cliente desde cero.</div>
            Va a borrar toda la base de datos de <strong>{{ reapply_name_text }}</strong>
            —artículos, clientes, proveedores, ventas, usuarios, todo lo que tenga cargado—
            y la arma de nuevo con los datos del formulario.
            <strong>No se puede deshacer.</strong>
          </div>

          <!-- Por qué el aplicado normal está frenado (solo si la API los manda: una API vieja no) -->
          <div v-if="reapply_reasons.length > 0" class="mb-3">
            <div class="small fw-semibold mb-1">Por qué no se aplica de la forma normal:</div>
            <ul class="small mb-0 ps-3">
              <li v-for="(reason, index) in reapply_reasons" :key="'reason-' + index">{{ reason }}</li>
            </ul>
          </div>

          <!--
            Sistema en uso: las señales (si las hay) y el checkbox que lo reconoce. También aparece
            cuando no hay ningún nombre que pedir: ahí es la única confirmación posible.
          -->
          <div v-if="reapply_needs_live_check" class="border border-danger rounded p-3 mb-3">
            <template v-if="reapply_live_reasons.length > 0">
              <div class="small fw-semibold mb-1">Hay señales de que el sistema está en uso:</div>
              <ul class="small ps-3 mb-3">
                <li v-for="(reason, index) in reapply_live_reasons" :key="'live-' + index">{{ reason }}</li>
              </ul>
            </template>

            <div class="impl-action-bar__live-check">
              <input
                :id="live_check_id"
                v-model="confirm_live_checked"
                type="checkbox"
                class="form-check-input"
              />
              <label class="form-check-label" :for="live_check_id">
                <template v-if="reapply_has_live_signals">
                  Entiendo que <strong>{{ reapply_name_text }}</strong> tiene un sistema en uso y que
                  se van a perder todos sus datos.
                </template>
                <template v-else>
                  Entiendo que se va a borrar toda la base de datos de
                  <strong>{{ reapply_name_text }}</strong> y que no se puede deshacer.
                </template>
              </label>
            </div>
          </div>
        </div>

        <!-- Acciones 'side_effect' ('user_setup' y 'crear_instalacion'): el body es descriptivo, no editable -->
        <pre v-if="current_action && current_action.kind === 'side_effect'" class="impl-action-bar__payload p-2 border rounded small mb-0">{{ preview.body }}</pre>

        <!-- Resto de acciones ('message'): texto editable (o solo lectura si va por plantilla) -->
        <textarea
          v-else
          v-model="edited_body"
          class="form-control"
          rows="12"
          :readonly="!preview.editable"
        />

        <!--
          Confirmar por nombre (re-aplicar): va pegado al botón "Aplicar de nuevo", después de los
          datos que se van a enviar, para que se confirme habiéndolos visto. Se compara recortado y
          sin distinguir mayúsculas (reapply_name_matches), igual que la API. Sin <form>: Enter no
          dispara nada, el envío es siempre un click consciente en el botón rojo.
        -->
        <div v-if="reapply_needs_name" class="impl-action-bar__confirm-text mt-3">
          <label :for="confirm_name_id" class="form-label mb-1">
            Para confirmar, escribí el nombre del cliente: <strong>{{ reapply_expected_name }}</strong>
          </label>
          <input
            :id="confirm_name_id"
            v-model="confirm_name_typed"
            type="text"
            class="form-control impl-action-bar__confirm-input"
            :class="{ 'is-valid': reapply_name_matches }"
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
          />
        </div>

        <!-- Motivo del error 422 (ej: ventana cerrada sin plantilla): visible dentro del modal -->
        <div v-if="error_message" ref="error_alert" class="alert alert-danger py-2 small mt-3 mb-0">
          {{ error_message }}
        </div>
      </template>

      <!-- Cargando el preview -->
      <div v-else class="text-center text-muted py-4">
        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
        Cargando preview…
      </div>

      <template #footer>
        <button type="button" class="btn btn-secondary" :disabled="sending" @click="close_modal">
          Cancelar
        </button>

        <!--
          Copiar: solo acciones de tipo 'message'. Únicamente portapapeles, no llama al
          backend ni marca la acción como enviada — por eso está disponible aunque la
          ventana de 24 h esté cerrada (a diferencia de "Enviar").
        -->
        <button
          v-if="current_action && current_action.kind === 'message'"
          type="button"
          class="btn btn-outline-secondary"
          :disabled="!preview"
          @click="copy_body"
        >
          {{ copied ? 'Copiado ✓' : 'Copiar' }}
        </button>

        <!-- Re-aplicar borra la base del cliente: el botón va en rojo (btn-danger), no en el azul de siempre -->
        <button
          type="button"
          class="btn"
          :class="is_reapply ? 'btn-danger' : 'btn-primary'"
          :disabled="!can_submit"
          @click="submit_action"
        >
          {{ submit_label }}
        </button>
      </template>
    </base-modal>
</template>

<script>
import api from '@/utils/axios'
import BaseModal from '@/components/ui/BaseModal.vue'

/**
 * Deja una lista de textos de la API lista para pintar: solo strings, sin espacios en las
 * puntas y sin vacíos.
 *
 * La usan las razones del bloqueo (`force_reasons`) y las señales de uso (`live_system_reasons`).
 * Una API vieja no manda esas claves, y una respuesta rara (null, un objeto) tampoco tiene que
 * romper el modal: en todos esos casos devuelve una lista vacía.
 *
 * @param {*} value Lo que vino en la respuesta (se espera un array de strings).
 * @returns {string[]}
 */
function clean_text_list(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter(function (item) {
      return typeof item === 'string'
    })
    .map(function (item) {
      return item.trim()
    })
    .filter(function (item) {
      return item !== ''
    })
}

export default {
  name: 'ImplementationActionBar',

  components: { BaseModal },

  props: {
    /**
     * Implementación activa en el panel de detalle. Se espera que tenga
     * `id`, `current_stage` y `stages` (con `config.name`) cargados.
     */
    implementation: { type: Object, required: true },
  },

  emits: ['updated'],

  data() {
    return {
      /** Acción actualmente abierta en el modal (item de `actions` con key, kind, blocked, can_force, etc.), o null. */
      current_action: null,

      /**
       * Preview devuelto por el backend para la acción abierta:
       * { action, body, recipient_label, recipient_phone, window_open, requires_template, editable, template_name }.
       */
      preview: null,

      /** Indicador de carga del preview (mientras se pide o se recalcula por cambio de etapa). */
      loading_preview: false,

      /** Etapa elegida para la acción 'progreso' (default: implementation.current_stage). */
      preview_stage: 1,

      /** Texto editable del modal, prellenado con preview.body. */
      edited_body: '',

      /** Indicador de envío en curso (evita doble click). */
      sending: false,

      /** Motivo del error 422 al ejecutar (ej: ventana cerrada sin plantilla), visible en el modal. */
      error_message: '',

      /** Visibilidad del modal de preview/envío. */
      show_modal: false,

      /**
       * true cuando el modal abierto es un re-aplicar de 'user_setup' (ya se había
       * aplicado antes, action.can_force === true al abrir). Determina el aviso de
       * peligro, la confirmación y la etiqueta "Aplicar de nuevo", y viaja como `force`
       * en el POST.
       */
      is_reapply: false,

      /**
       * Lo que la persona escribió en "escribí el nombre del cliente" (re-aplicar). Se manda
       * tal cual como `confirm_client_name`: la API lo recorta y lo compara ella.
       */
      confirm_name_typed: '',

      /** Checkbox "Entiendo que … tiene un sistema en uso" (re-aplicar). Viaja como `confirm_live_system`. */
      confirm_live_checked: false,

      /**
       * true si la API contestó 422 `falta_confirmar_sistema_en_uso` en esta apertura. Hace
       * aparecer el checkbox aunque el estado de acciones que cargó el panel dijera que el
       * sistema NO estaba en uso (ver submit_action).
       */
      live_check_required_by_api: false,

      /** Feedback visual de "Copiado ✓" tras copy_body(), se resetea solo a los 2s. */
      copied: false,
    }
  },

  computed: {
    /**
     * Opciones del selector de etapa para la acción 'progreso': una por cada
     * stage cargado en la implementación, con su nombre desde stages.config.
     *
     * @returns {Array<{value: number, label: string}>}
     */
    progreso_stage_options() {
      const stages = (this.implementation && this.implementation.stages) || []

      /** Copia ordenada por número de etapa para el selector. */
      const sorted = stages.slice().sort(function (a, b) {
        return (a.stage_number || 0) - (b.stage_number || 0)
      })

      return sorted.map(function (stage) {
        const name = stage.config && stage.config.name ? stage.config.name : ''
        return {
          value: stage.stage_number,
          label: 'Etapa ' + stage.stage_number + (name ? ' — ' + name : ''),
        }
      })
    },

    /**
     * Etiqueta del botón de envío según la acción abierta: distingue 'user_setup'
     * (Aplicar / Aplicar de nuevo si es_reaply), 'crear_instalacion' (Crear instalación)
     * y el resto de acciones de mensaje (Enviar).
     *
     * @returns {string}
     */
    submit_label() {
      const key = this.current_action ? this.current_action.key : null

      if (key === 'user_setup') {
        if (this.sending) {
          return 'Aplicando...'
        }
        return this.is_reapply ? 'Aplicar de nuevo' : 'Aplicar configuración'
      }

      if (key === 'crear_instalacion') {
        return this.sending ? 'Creando...' : 'Crear instalación'
      }

      return this.sending ? 'Enviando...' : 'Enviar'
    },

    /**
     * Habilita el botón de envío: hace falta preview cargado, no estar enviando,
     * que la ventana no esté cerrada sin plantilla disponible (requires_template) y,
     * en un re-aplicar, que la confirmación fuerte esté completa (reapply_confirmed).
     *
     * @returns {boolean}
     */
    can_submit() {
      if (!this.preview || this.sending || this.loading_preview) {
        return false
      }
      if (this.preview.requires_template) {
        return false
      }
      return this.reapply_confirmed
    },

    /**
     * Nombre que hay que escribir para confirmar el re-aplicar ('' si no hay ninguno).
     *
     * 1) `force_confirm_name` de la API: es exactamente contra lo que ella compara el
     *    `confirm_client_name`, así que es la fuente que manda.
     * 2) Respaldo para una API VIEJA (sin esa clave, con este SPA ya desplegado): el nombre
     *    visible del cliente de la implementación, con la misma regla del backend
     *    (`Client::resolve_display_name()`: company_name y, si está vacío, name). Esa API
     *    vieja ni mira lo que se escribe, pero la confirmación se pide igual: el freno de la
     *    pantalla no puede depender de que el backend ya esté actualizado.
     * 3) Ninguno: no hay campo de texto y alcanza con el checkbox (reapply_needs_live_check).
     *
     * @returns {string}
     */
    reapply_expected_name() {
      const action = this.current_action
      const from_api = action && typeof action.force_confirm_name === 'string'
        ? action.force_confirm_name.trim()
        : ''

      if (from_api !== '') {
        return from_api
      }

      const client = this.implementation ? this.implementation.client : null
      if (!client) {
        return ''
      }

      const company_name = typeof client.company_name === 'string' ? client.company_name.trim() : ''
      if (company_name !== '') {
        return company_name
      }

      return typeof client.name === 'string' ? client.name.trim() : ''
    },

    /**
     * Cómo se nombra al cliente en los textos del aviso: su nombre o, si no hay ninguno
     * disponible, "este cliente".
     *
     * @returns {string}
     */
    reapply_name_text() {
      return this.reapply_expected_name !== '' ? this.reapply_expected_name : 'este cliente'
    },

    /**
     * true si el re-aplicar pide escribir el nombre (o sea, hay un nombre que pedir).
     *
     * @returns {boolean}
     */
    reapply_needs_name() {
      return this.is_reapply && this.reapply_expected_name !== ''
    },

    /**
     * true cuando lo escrito coincide con el nombre esperado.
     *
     * Se recorta y no distingue mayúsculas/minúsculas, igual que la API
     * (`mb_strtolower(trim())`): que la pantalla acepte lo mismo que acepta el backend, ni
     * más (habilitaría un botón que después da 422) ni menos (trabaría a quien sí acierta).
     * No se normaliza nada más (acentos, espacios internos) a propósito, por la misma razón.
     * Un nombre esperado vacío nunca coincide.
     *
     * @returns {boolean}
     */
    reapply_name_matches() {
      const expected = this.reapply_expected_name.trim().toLowerCase()
      return expected !== '' && this.confirm_name_typed.trim().toLowerCase() === expected
    },

    /**
     * Razones por las que el aplicado normal está frenado (`force_reasons`). Lista vacía
     * con una API vieja, que no las manda.
     *
     * Según el contrato, las señales de uso (`live_system_reasons`) viajan TAMBIÉN dentro de
     * `force_reasons` (son algunas de las razones que frenan el aplicado normal). Como esas ya
     * se muestran en el recuadro rojo, se sacan de esta lista para que ninguna línea aparezca
     * dos veces. Solo se filtra cuando el recuadro está a la vista: si no lo está, esas razones
     * no se muestran en ningún otro lado y sacarlas las haría desaparecer.
     *
     * @returns {string[]}
     */
    reapply_reasons() {
      const reasons = clean_text_list(this.current_action ? this.current_action.force_reasons : null)

      if (!this.reapply_needs_live_check) {
        return reasons
      }

      const shown_in_live_box = this.reapply_live_reasons

      return reasons.filter(function (reason) {
        return shown_in_live_box.indexOf(reason) === -1
      })
    },

    /**
     * Señales de que el sistema del cliente está en uso (`live_system_reasons`). Lista vacía
     * con una API vieja, que no las manda.
     *
     * @returns {string[]}
     */
    reapply_live_reasons() {
      return clean_text_list(this.current_action ? this.current_action.live_system_reasons : null)
    },

    /**
     * true si hay señales de que el sistema está en uso: lo dijo la API al cargar las
     * acciones (`live_system`) o lo acaba de decir al rechazar un envío (live_check_required_by_api).
     *
     * @returns {boolean}
     */
    reapply_has_live_signals() {
      const action = this.current_action
      const api_says_live = action ? action.live_system === true : false

      return api_says_live || this.live_check_required_by_api
    },

    /**
     * true si el re-aplicar muestra (y exige) el checkbox de sistema en uso.
     *
     * Aparece cuando hay señales de uso. Y también cuando NO hay ningún nombre que pedir
     * (una API vieja con un cliente sin nombre cargado): sin campo de texto, el checkbox es
     * la única confirmación que le queda a la persona, y no se puede dejar pasar un
     * borrado sin ninguna.
     *
     * @returns {boolean}
     */
    reapply_needs_live_check() {
      if (!this.is_reapply) {
        return false
      }

      return this.reapply_has_live_signals || this.reapply_expected_name === ''
    },

    /**
     * true cuando la confirmación fuerte del re-aplicar está completa: el nombre coincide
     * (si se pide) y el checkbox está tildado (si se muestra). Fuera de un re-aplicar no hay
     * nada que confirmar y siempre es true, así el resto de las acciones no cambian.
     *
     * Es el freno de la pantalla; el real lo pone la API, que vuelve a validar todo.
     *
     * @returns {boolean}
     */
    reapply_confirmed() {
      if (!this.is_reapply) {
        return true
      }
      if (this.reapply_needs_name && !this.reapply_name_matches) {
        return false
      }
      if (this.reapply_needs_live_check && !this.confirm_live_checked) {
        return false
      }

      return true
    },

    /**
     * id del campo del nombre, único por implementación, para asociarlo a su <label>.
     *
     * @returns {string}
     */
    confirm_name_id() {
      return 'impl-reapply-name-' + (this.implementation ? this.implementation.id : '')
    },

    /**
     * id del checkbox de sistema en uso, único por implementación, para asociarlo a su <label>.
     *
     * @returns {string}
     */
    live_check_id() {
      return 'impl-reapply-live-' + (this.implementation ? this.implementation.id : '')
    },
  },

  methods: {
    /**
     * Abre el modal para una acción (invocado por el padre vía $refs.action_modal.open(...)).
     *
     * Recibe el item completo de `actions` (key, kind, blocked, can_force, label, etc., tal
     * como lo arma el padre desde GET /implementation/{id}/actions) y la etapa actual de la
     * implementación, y deja todo listo para pedir el preview: resetea edición/error/copiado,
     * fija la etapa por defecto del selector de 'progreso', y calcula si es un re-aplicar de
     * 'user_setup' (ya se había aplicado antes).
     *
     * @param {Object} action Item de `actions` a abrir.
     * @param {number} [stage] Etapa actual de la implementación (default para 'progreso').
     * @returns {void}
     */
    open(action, stage) {
      this.current_action = action
      this.preview = null
      this.error_message = ''
      this.copied = false
      this.preview_stage = stage != null ? stage : (this.implementation ? this.implementation.current_stage : 1)

      /* 'user_setup' ya aplicado (can_force true): esta apertura es un re-aplicar. */
      this.is_reapply = action && action.key === 'user_setup' && action.can_force === true

      /*
       * La confirmación arranca SIEMPRE vacía. Este es el punto que garantiza que ni el nombre
       * escrito ni el checkbox pasen de una apertura a la otra (aunque la anterior se haya
       * cerrado por un camino que no limpia): cada re-aplicar se confirma de cero, y lo
       * tipeado para un cliente jamás deja habilitado el botón de otro.
       */
      this.reset_reapply_confirmation()

      this.show_modal = true
      this.load_preview()
    },

    /**
     * Borra la confirmación fuerte del re-aplicar: el nombre escrito, el checkbox de sistema
     * en uso y la marca de "la API pidió el checkbox". Se llama al abrir y al cerrar el modal
     * y tras un envío exitoso. Tras un error NO se llama: ahí la limpieza es parcial y depende
     * de qué falló (ver el catch de submit_action).
     *
     * @returns {void}
     */
    reset_reapply_confirmation() {
      this.confirm_name_typed = ''
      this.confirm_live_checked = false
      this.live_check_required_by_api = false
    },

    /**
     * Pide el preview de la acción abierta (con `stage` en la query si es 'progreso').
     *
     * @returns {void}
     */
    load_preview() {
      if (!this.current_action || !this.implementation) {
        return
      }

      const self = this
      const action_key = this.current_action.key

      /** Query params: solo 'progreso' manda `stage`. */
      const params = action_key === 'progreso' ? { stage: this.preview_stage } : {}

      this.loading_preview = true
      this.error_message = ''

      api
        .get('/implementation/' + this.implementation.id + '/actions/' + action_key + '/preview', { params })
        .then(function (res) {
          self.preview = res.data
          self.edited_body = res.data.body || ''
        })
        .catch(function () {
          /* El interceptor global de axios ya muestra el toast de error. */
          self.preview = null
        })
        .then(function () {
          self.loading_preview = false
        })
    },

    /**
     * Copia al portapapeles el texto del mensaje (solo acciones de tipo 'message').
     *
     * No envía nada ni registra la acción: es un atajo para mandarlo a mano fuera de
     * la ventana de 24 h. Por eso no depende del estado de la ventana ni del backend.
     *
     * @returns {void}
     */
    copy_body() {
      const self = this

      if (!navigator.clipboard) {
        // Sin API de portapapeles disponible: no rompemos, simplemente no confirmamos copiado.
        return
      }

      navigator.clipboard.writeText(self.edited_body).then(function () {
        self.copied = true
        setTimeout(function () { self.copied = false }, 2000)
      }).catch(function () {
        self.copied = false
      })
    },

    /**
     * Ejecuta la acción abierta: POST /implementation/{id}/actions/{action}.
     *
     * Con éxito cierra el modal y emite `updated` con el modelo fresco (el padre recarga
     * el estado de acciones desde ese handler). Con 422 muestra el motivo dentro del modal
     * sin cerrarlo, preservando el texto editado por el admin.
     *
     * @returns {void}
     */
    submit_action() {
      if (!this.can_submit || !this.current_action || !this.implementation) {
        return
      }

      const self = this
      const action_key = this.current_action.key
      const kind = this.current_action.kind

      /**
       * Payload por tipo de acción:
       * - 'message' (presentacion, form_link, progreso, pedir_archivos, entrega): manda `content` editado.
       * - 'user_setup' (side_effect): no manda `content`, manda `force` (re-aplicar el lock) y, SOLO si es
       *   un re-aplicar, la confirmación fuerte: `confirm_client_name` (lo escrito) y
       *   `confirm_live_system` (el checkbox). Fuera del re-aplicar el cuerpo es el de siempre,
       *   `{stage, force: false}`, ni un campo más.
       * - 'crear_instalacion' (side_effect): no manda `content` ni `force`.
       */
      const payload = { stage: this.preview_stage }
      if (kind === 'message') {
        payload.content = this.edited_body
      }
      if (action_key === 'user_setup') {
        payload.force = this.is_reapply
        if (this.is_reapply) {
          /*
           * Los dos viajan SIEMPRE que se re-aplica, aunque la pantalla ya los haya chequeado
           * para habilitar el botón: una API nueva los vuelve a validar y ese es el freno real
           * (el único que cubre una pestaña vieja o una llamada directa). Una API vieja ignora
           * las claves de más y aplica igual: ahí el único freno es esta pantalla.
           */
          payload.confirm_client_name = this.confirm_name_typed
          payload.confirm_live_system = this.confirm_live_checked === true
        }
      }

      this.sending = true
      this.error_message = ''

      /** Mensaje del indicador global de carga según la acción. */
      let loading_message = 'Enviando mensaje'
      if (action_key === 'user_setup') {
        loading_message = 'Aplicando configuración'
      } else if (action_key === 'crear_instalacion') {
        loading_message = 'Creando instalación'
      }

      this.$store.commit('auth/setMessage', loading_message)
      this.$store.commit('auth/setLoading', true)

      api
        .post('/implementation/' + this.implementation.id + '/actions/' + action_key, payload)
        .then(function (res) {
          self.show_modal = false
          self.preview = null
          self.current_action = null
          self.reset_reapply_confirmation()
          self.$emit('updated', res.data.model)
        })
        .catch(function (error) {
          /*
           * El interceptor global ya muestra el toast; acá además dejamos el motivo
           * visible dentro del modal (sin cerrarlo) para que Martín no pierda el texto.
           */
          const response_data = error && error.response ? error.response.data : null
          self.error_message = (response_data && response_data.message)
            ? response_data.message
            : 'No se pudo ejecutar la acción.'

          /** Código con el que la API distingue los rechazos de la confirmación (solo en los 422 nuevos). */
          const codigo = response_data && response_data.codigo ? response_data.codigo : null

          /*
           * La API pide reconocer que el sistema está en uso, pero este modal se abrió con un
           * estado de acciones que no lo decía (el panel carga ese estado al elegir la
           * implementación y pudo quedar viejo: por ejemplo, mientras tanto se creó un upgrade
           * del cliente). Sin esto no habría dónde reconocerlo y la persona quedaría trabada
           * con un mensaje que no puede atender hasta recargar todo el panel. Se muestra el
           * checkbox, destildado: lo tiene que tildar ella.
           */
          if (codigo === 'falta_confirmar_sistema_en_uso') {
            self.live_check_required_by_api = true
          }

          /*
           * Una confirmación vale para UN envío. Si el envío falló por algo que NO es la
           * confirmación misma (el setup remoto dio error, se cortó la red o venció el tiempo:
           * el panel corta a los 15 s y el setup pudo haber corrido igual), no se deja el botón
           * rojo listo para un segundo click a ciegas que volvería a borrar la base: se vuelve a
           * pedir el nombre y el checkbox. Los dos códigos de confirmación sí conservan lo
           * escrito, porque ahí lo que hay que hacer es corregirlo, no repetirlo. La marca
           * `live_check_required_by_api` no se toca: lo que la API ya dijo del sistema sigue valiendo.
           */
          if (self.is_reapply && codigo !== 'confirmacion_requerida' && codigo !== 'falta_confirmar_sistema_en_uso') {
            self.confirm_name_typed = ''
            self.confirm_live_checked = false

            /* Se dice por qué: sin esto se ve el error y un campo vacío, y parece que se perdió lo escrito por un defecto. */
            self.error_message = self.error_message + ' Por seguridad, la confirmación se borró: para volver a intentarlo hay que confirmar de nuevo.'
          }

          /*
           * Que el error SE VEA. El mensaje va al final del cuerpo del modal y, si la confirmación lo hizo crecer (por ejemplo, el 422 de
           * "sistema en uso" suma el recuadro con el checkbox), queda debajo del pliegue junto con el botón: en un notebook de 768 px de alto o
           * en un teléfono la persona veía aparecer el checkbox sin ver por qué ni dónde apretar. Se lo lleva al centro del área visible; el
           * scroll del modal alcanza para dejar a la vista el mensaje y el botón. Va en $nextTick porque el aviso recién existe después de
           * que Vue vuelve a pintar.
           */
          self.$nextTick(function () {
            const alerta = self.$refs.error_alert

            if (alerta && typeof alerta.scrollIntoView === 'function') {
              alerta.scrollIntoView({ block: 'center' })
            }
          })
        })
        .then(function () {
          self.sending = false
          self.$store.commit('auth/setLoading', false)
          self.$store.commit('auth/setMessage', '')
        })
    },

    /**
     * Cierra el modal y limpia el estado de edición.
     *
     * @returns {void}
     */
    close_modal() {
      if (this.sending) {
        return
      }
      this.show_modal = false
      this.preview = null
      this.current_action = null
      this.edited_body = ''
      this.error_message = ''
      this.copied = false
      this.is_reapply = false
      this.reset_reapply_confirmation()
    },

    /**
     * Formatea una fecha ISO a string legible en locale español (Argentina).
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
  },
}
</script>

<style scoped>
/* Payload de acciones 'side_effect' (user_setup, crear_instalacion): monoespaciado con scroll propio */
.impl-action-bar__payload {
  max-height: 320px;
  overflow: auto;
  background-color: #f8f9fa;
  white-space: pre-wrap;
  word-break: break-word;
}

/*
 * Confirmación fuerte del re-aplicar de 'user_setup'. Sus textos traen datos que no controlamos
 * (el nombre del cliente, las razones que arma la API): una palabra larga sin espacios (un
 * dominio, un mail) no puede ensanchar el modal y dar scroll horizontal en el teléfono, así que
 * se parte donde haga falta.
 */
.impl-action-bar__confirm-text {
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* Campo del nombre: 44px de alto (el mínimo para tocarlo con el dedo) en vez de los 38px de Bootstrap */
.impl-action-bar__confirm-input {
  min-height: 2.75rem;
}

/*
 * Checkbox de sistema en uso: fila con el cuadrado a la izquierda y el texto al lado, y el
 * cuadrado más grande que el de Bootstrap (20px). Lo que se toca con el dedo es todo el
 * texto (el label asociado), no solo el cuadrado.
 */
.impl-action-bar__live-check {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.impl-action-bar__live-check .form-check-input {
  flex: 0 0 auto;
  width: 1.25rem;
  height: 1.25rem;
  margin-top: 0.125rem;
}

.impl-action-bar__live-check .form-check-label {
  flex: 1 1 auto;
  /* Sin esto un hijo flex no se achica por debajo de su contenido y un texto largo ensancharía el modal */
  min-width: 0;
}
</style>
