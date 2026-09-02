<template>
  <div class="support-ai-settings-section">
    <div class="form-check mb-3">
      <input
        id="support_ai_suggestions_enabled"
        v-model="local_suggestions_enabled"
        class="form-check-input"
        type="checkbox"
        :disabled="loading || saving || load_failed" />
      <label class="form-check-label small" for="support_ai_suggestions_enabled">
        Activar sugerencias automáticas de IA para soporte
      </label>
    </div>
    <p class="text-muted small mb-3">
      Cuando está activado, cada mensaje nuevo de un cliente por WhatsApp puede generar una sugerencia de respuesta
      vía Claude tras la demora configurada. Si el cliente envía varios mensajes seguidos, el temporizador se reinicia
      con el último mensaje.
    </p>

    <div class="form-check mb-3">
      <input
        id="support_ai_require_verification"
        v-model="local_require_verification"
        class="form-check-input"
        type="checkbox"
        :disabled="loading || saving || load_failed" />
      <label class="form-check-label small" for="support_ai_require_verification">
        Los tickets nuevos arrancan pidiendo verificación humana
      </label>
    </div>
    <p class="text-muted small mb-2">
      Decide con qué régimen nace cada ticket nuevo. Tildado, toda respuesta que el agente escriba en un ticket nuevo
      queda esperando tu aprobación desde la conversación. Destildado, los tickets nuevos le contestan solos al cliente,
      tras el tiempo de espera que tengas configurado para el envío automático, y el escalado sigue siendo la red para
      lo que el agente no sabe responder. Mientras «Activar sugerencias automáticas de IA para soporte» esté apagado el
      agente no genera ninguna respuesta, así que este régimen recién se nota cuando lo prendas.
    </p>
    <p class="text-muted small mb-3">
      <strong>Cambiar esto no toca ningún ticket ya abierto.</strong> Cada conversación se queda con el régimen que
      tenía, y solo lo cambia una persona con el botón del encabezado.
    </p>

    <div v-if="local_suggestions_enabled" class="row g-2 align-items-end mb-2">
      <div class="col-sm-4">
        <label class="form-label small" for="support_ai_suggestion_delay">
          Demora antes de pedir sugerencia IA (segundos)
        </label>
        <input
          id="support_ai_suggestion_delay"
          v-model.number="local_suggestion_delay"
          type="number"
          min="0"
          max="3600"
          class="form-control form-control-sm"
          :disabled="loading || saving || load_failed" />
      </div>
      <div class="col-sm-4">
        <label class="form-label small" for="support_ai_auto_send_delay">
          Tiempo de espera antes de enviar (segundos)
        </label>
        <input
          id="support_ai_auto_send_delay"
          v-model.number="local_auto_send_delay"
          type="number"
          min="0"
          max="3600"
          class="form-control form-control-sm"
          :disabled="loading || saving || load_failed" />
      </div>
      <div class="col-auto">
        <button type="button" class="btn btn-primary btn-sm" :disabled="loading || saving || !can_save" @click="on_save">
          {{ saving ? 'Guardando…' : 'Guardar' }}
        </button>
      </div>
    </div>

    <div v-else class="mb-2">
      <button type="button" class="btn btn-primary btn-sm" :disabled="loading || saving || !can_save" @click="on_save">
        {{ saving ? 'Guardando…' : 'Guardar' }}
      </button>
    </div>

    <p v-if="local_suggestions_enabled" class="form-text small text-muted mb-2">
      La demora antes de pedir sugerencia IA evita consultar a Claude mientras el cliente sigue escribiendo. 0 = se
      consulta de inmediato tras el último mensaje.
    </p>
    <p v-if="local_suggestions_enabled" class="form-text small text-muted mb-2">
      Tiempo de espera antes de enviar: <strong>solo aplica a los tickets que tienen la verificación apagada</strong>.
      0 = el agente le contesta al cliente de inmediato. Mayor a 0 = ese tiempo para revisar y editar antes de que
      salga; si el operador responde a mano antes, se cancela el envío automático.
    </p>
    <p class="form-text small text-muted mb-2">
      «Activar sugerencias automáticas de IA para soporte» es el corte maestro: apagado, el agente no genera nada en
      ningún ticket. Prendido, cada conversación manda con sus dos botones propios, en el encabezado del ticket: uno
      prende o apaga el agente para ese cliente, y el otro decide si sus respuestas necesitan tu aprobación antes de
      salir. Los tickets nuevos nacen con el régimen que indique «Los tickets nuevos arrancan pidiendo verificación
      humana», y una vez abiertos no lo cambian solos.
    </p>

    <p v-if="loading" class="text-muted small mt-2 mb-0">Cargando…</p>
    <p v-else-if="saved_message" class="text-success small mt-2 mb-0">{{ saved_message }}</p>
    <p v-else-if="error_message" class="text-danger small mt-2 mb-0">{{ error_message }}</p>
  </div>
</template>

<script>
import api from '@/utils/axios'

/**
 * Sección en Cuenta: sugerencias IA automáticas, debounce previo a Claude, demora de envío y régimen con el que nacen
 * los tickets nuevos en soporte WhatsApp.
 */
export default {
  name: 'SupportAiSettingsSection',
  data() {
    return {
      /** Checkbox: sugerencias automáticas activas. */
      local_suggestions_enabled: false,
      /** Segundos de inactividad del cliente antes de consultar a Claude. */
      local_suggestion_delay: 0,
      /** Segundos antes del envío automático de la sugerencia generada (0 = inmediato). */
      local_auto_send_delay: 0,
      /**
       * Checkbox: régimen con el que nacen los tickets nuevos.
       *
       * Arranca en true y no en false porque este valor se muestra antes de que vuelva el GET: si la carga falla, el
       * operador ve el estado seguro (todo espera aprobación) y no el que le manda respuestas al cliente sin leerlas.
       */
      local_require_verification: true,
      /** Valores persistidos en servidor. */
      stored_suggestions_enabled: false,
      stored_suggestion_delay: 0,
      stored_auto_send_delay: 0,
      stored_require_verification: true,
      /** Carga inicial GET settings. */
      loading: true,
      /**
       * La carga inicial falló.
       *
       * Deshabilita los controles y bloquea el guardado. Sin respuesta del servidor, los `stored_` son los valores de
       * arranque del data() y no lo que hay guardado: un PUT desde ese estado mandaría claves que el operador nunca
       * vio, y una de ellas apaga el agente para todos los clientes. Los controles van grises y no solo muertos para
       * que nadie mueva un check, vea que Guardar no responde y se vaya sin saber si quedó guardado.
       */
      load_failed: false,
      /** PUT en curso. */
      saving: false,
      /** Mensaje de éxito tras guardar. */
      saved_message: '',
      /** Error de validación o API. */
      error_message: '',
    }
  },
  computed: {
    /**
     * Habilita guardar solo si hubo cambios y los delays están en rango cuando aplica.
     *
     * @returns {boolean}
     */
    can_save() {
      // Sin carga válida no hay con qué comparar: los `stored_` serían los defaults del data() y no lo que hay en el
      // servidor, así que cualquier guardado sería a ciegas sobre valores que el operador nunca llegó a ver.
      if (this.load_failed) {
        return false
      }
      if (this.local_suggestions_enabled !== this.stored_suggestions_enabled) {
        if (!this.local_suggestions_enabled) {
          return true
        }
        return this.is_suggestion_delay_valid() && this.is_auto_send_delay_valid()
      }
      // Se chequea antes del `return false` de abajo: con las sugerencias apagadas ese return deja el botón Guardar
      // muerto, y entonces el régimen de nacimiento no se podría cambiar nunca sin prender el corte maestro.
      if (this.local_require_verification !== this.stored_require_verification) {
        if (!this.local_suggestions_enabled) {
          return true
        }
        return this.is_suggestion_delay_valid() && this.is_auto_send_delay_valid()
      }
      if (!this.local_suggestions_enabled) {
        return false
      }
      if (
        this.local_suggestion_delay !== this.stored_suggestion_delay ||
        this.local_auto_send_delay !== this.stored_auto_send_delay
      ) {
        return this.is_suggestion_delay_valid() && this.is_auto_send_delay_valid()
      }
      return false
    },
  },
  mounted() {
    this.load_setting()
  },
  methods: {
    /**
     * Valida demora previa a Claude entre 0 y 3600.
     *
     * @returns {boolean}
     */
    is_suggestion_delay_valid() {
      const value = parseInt(this.local_suggestion_delay, 10)
      return !isNaN(value) && value >= 0 && value <= 3600
    },
    /**
     * Valida delay de auto-envío entre 0 y 3600.
     *
     * @returns {boolean}
     */
    is_auto_send_delay_valid() {
      const value = parseInt(this.local_auto_send_delay, 10)
      return !isNaN(value) && value >= 0 && value <= 3600
    },
    /**
     * GET /settings/support-ai.
     *
     * @returns {void}
     */
    load_setting() {
      const self = this
      self.loading = true
      self.error_message = ''
      api
        .get('/settings/support-ai')
        .then(function (res) {
          const data = res.data || {}
          const enabled = !!data.suggestions_enabled
          const suggestion_delay = parseInt(data.suggestion_delay, 10)
          const auto_send_delay = parseInt(data.auto_send_delay, 10)
          // Si la API todavía no manda el campo, se asume prendido: mostrarlo apagado y que el operador guarde sin
          // querer daría vuelta el régimen de todos los tickets nuevos.
          const require_verification = data.require_verification === undefined ? true : !!data.require_verification
          self.load_failed = false
          self.local_suggestions_enabled = enabled
          self.stored_suggestions_enabled = enabled
          self.local_require_verification = require_verification
          self.stored_require_verification = require_verification
          if (!isNaN(suggestion_delay)) {
            self.local_suggestion_delay = suggestion_delay
            self.stored_suggestion_delay = suggestion_delay
          }
          if (!isNaN(auto_send_delay)) {
            self.local_auto_send_delay = auto_send_delay
            self.stored_auto_send_delay = auto_send_delay
          }
        })
        .catch(function () {
          self.error_message = 'No se pudo cargar la configuración.'
          self.load_failed = true
        })
        .then(function () {
          self.loading = false
        })
    },
    /**
     * PUT /settings/support-ai.
     *
     * @returns {void}
     */
    on_save() {
      const self = this
      const suggestion_delay = parseInt(self.local_suggestion_delay, 10)
      const auto_send_delay = parseInt(self.local_auto_send_delay, 10)
      if (self.local_suggestions_enabled && !self.is_suggestion_delay_valid()) {
        self.error_message = 'La demora antes de pedir sugerencia IA debe estar entre 0 y 3600 segundos.'
        return
      }
      if (self.local_suggestions_enabled && !self.is_auto_send_delay_valid()) {
        self.error_message = 'El tiempo de espera antes de enviar debe estar entre 0 y 3600 segundos.'
        return
      }
      self.saving = true
      self.saved_message = ''
      self.error_message = ''
      // La regla es una sola y pareja: cada clave viaja solo si el operador la cambió. Las tres son `nullable` del
      // lado de la API y, si no vienen, caen en lo que ya está guardado, así que este PUT no puede pisar lo que otro
      // operador acabe de configurar desde otra pestaña —ni una demora que el corte maestro esconde, ni el régimen de
      // nacimiento, que es justo el que decide si el agente le escribe solo a un cliente—. La única excepción es
      // `suggestions_enabled`, que va siempre porque la API lo pide `required`: no agregar más excepciones.
      const payload = {
        suggestions_enabled: self.local_suggestions_enabled,
      }
      // No se condiciona por `local_suggestions_enabled`, a diferencia de las demoras: el régimen de nacimiento es una
      // perilla aparte y se tiene que poder cambiar con el corte maestro apagado.
      if (self.local_require_verification !== self.stored_require_verification) {
        payload.require_verification = self.local_require_verification
      }
      if (self.local_suggestions_enabled && suggestion_delay !== self.stored_suggestion_delay) {
        payload.suggestion_delay = suggestion_delay
      }
      if (self.local_suggestions_enabled && auto_send_delay !== self.stored_auto_send_delay) {
        payload.auto_send_delay = auto_send_delay
      }
      api
        .put('/settings/support-ai', payload)
        .then(function (res) {
          const data = res.data || {}
          self.local_suggestions_enabled = !!data.suggestions_enabled
          self.stored_suggestions_enabled = self.local_suggestions_enabled
          self.local_require_verification =
            data.require_verification === undefined ? true : !!data.require_verification
          self.stored_require_verification = self.local_require_verification
          const saved_suggestion_delay = parseInt(data.suggestion_delay, 10)
          const saved_auto_send_delay = parseInt(data.auto_send_delay, 10)
          if (!isNaN(saved_suggestion_delay)) {
            self.local_suggestion_delay = saved_suggestion_delay
            self.stored_suggestion_delay = saved_suggestion_delay
          }
          if (!isNaN(saved_auto_send_delay)) {
            self.local_auto_send_delay = saved_auto_send_delay
            self.stored_auto_send_delay = saved_auto_send_delay
          }
          self.saved_message = 'Configuración guardada.'
        })
        .catch(function (err) {
          const msg =
            (err.response && err.response.data && err.response.data.message) ||
            'No se pudo guardar.'
          self.error_message = msg
          // La pantalla vuelve a mostrar lo que hay en el servidor. Dejar el check como lo dejó el operador lo haría
          // irse creyendo que los tickets nuevos ya esperan su aprobación cuando en el servidor siguen contestando
          // solos: de todas las formas de fallar, esa es la única que miente hacia el lado peligroso.
          self.local_require_verification = self.stored_require_verification
        })
        .then(function () {
          self.saving = false
        })
    },
  },
}
</script>
