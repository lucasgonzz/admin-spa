<template>
  <div class="support-ai-settings-section">
    <!--
      Va arriba de todo y no al final a propósito: este interruptor decide si el canal de soporte por
      WhatsApp EXISTE. Con esto apagado, nada de lo que viene abajo (sugerencias, demoras, régimen de
      verificación) llega a correr nunca, porque no hay ticket donde correr.
    -->
    <div class="support-ai-settings-section__canal mb-4">
      <h3 class="h6 mb-2">Canal de soporte por WhatsApp</h3>

      <div class="form-check mb-2">
        <input
          id="support_whatsapp_tickets_enabled"
          v-model="local_tickets_habilitados"
          class="form-check-input"
          type="checkbox"
          :disabled="loading || saving || load_failed" />
        <label class="form-check-label small" for="support_whatsapp_tickets_enabled">
          Abrir tickets de soporte por WhatsApp
        </label>
      </div>
      <p class="text-muted small mb-3">
        Prendido, el cliente que escribe al número de leads y clientes abre un ticket (o sigue el que ya tenía) y
        una persona lo lee. <strong>Apagado, su mensaje no abre ningún ticket</strong>: nadie se entera de que
        escribió, y lo único que recibe es el texto de abajo. Si ese texto está vacío, no recibe nada —
        queda esperando una respuesta que no va a llegar.
      </p>
      <p class="text-muted small mb-3">
        Esto vale para los clientes. Cuando el número del agente personal está listo (ver «Números de
        WhatsApp»), el dueño que le escribe a este número recibe un aviso con el número del asistente. Mientras
        ese número no esté listo, no cambia nada para nadie.
      </p>

      <div class="mb-2">
        <label class="form-label small fw-semibold" for="support_whatsapp_texto_desconectado">
          Qué se le contesta si está desconectado
        </label>
        <textarea
          id="support_whatsapp_texto_desconectado"
          v-model="local_texto_desconectado"
          class="form-control form-control-sm"
          rows="3"
          maxlength="1000"
          :disabled="loading || saving || load_failed"></textarea>
        <p class="form-text small text-muted mb-0">
          Es la única respuesta que recibe el cliente mientras el interruptor esté apagado.
          <strong>Vacío significa no contestar nada.</strong> Dejalo vacío solo si querés silencio total;
          si no, poné acá dónde escribir o a partir de cuándo se atiende.
        </p>
      </div>

      <p v-if="!loading && !load_failed && !canal_soportado" class="text-warning small mb-2">
        Esta versión de la API todavía no maneja el interruptor ni el texto: lo que ves son los valores por
        defecto, y guardarlos no va a tener efecto hasta que se despliegue la versión nueva del admin.
      </p>

      <div class="mb-2">
        <button type="button" class="btn btn-primary btn-sm" :disabled="loading || saving || !can_save" @click="on_save">
          {{ saving ? 'Guardando…' : 'Guardar' }}
        </button>
        <p class="form-text small text-muted mb-0">
          Es el mismo Guardar que el de abajo: la sección se guarda entera de una vez.
        </p>
      </div>
    </div>

    <h3 class="h6 mb-2">Respuestas automáticas de IA</h3>

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

    <p class="text-muted small mb-3">
      Los tickets nuevos siempre contestan automáticamente. Si querés revisar las respuestas de una
      conversación antes de enviarlas, activá "Con verificación" en el encabezado de ese ticket.
      Ese cambio se aplica solamente a esa conversación.
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
      salir. Los tickets nuevos siempre nacen para contestar solos; la verificación se activa solamente desde
      esa conversación.
    </p>

    <p v-if="loading" class="text-muted small mt-2 mb-0">Cargando…</p>
    <p v-else-if="saved_message" class="text-success small mt-2 mb-0">{{ saved_message }}</p>
    <p v-else-if="error_message" class="text-danger small mt-2 mb-0">{{ error_message }}</p>
  </div>
</template>

<script>
import api from '@/utils/axios'

/**
 * Sección en Cuenta: el interruptor del canal de soporte por WhatsApp (si un mensaje abre ticket y qué se contesta
 * mientras esté apagado) y, debajo, las sugerencias IA automáticas, el debounce previo a Claude, la demora de envío
 * para los tickets sin verificación. La aprobación se elige en cada conversación.
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
       * Interruptor maestro del canal: si un cliente que escribe por WhatsApp abre ticket de soporte.
       *
       * Arranca en false porque acá el estado seguro es el
       * apagado: si la carga falla o la API no manda la clave, mostrarlo prendido haría creer que los
       * mensajes de los clientes se están leyendo cuando puede que caigan en silencio.
       */
      local_tickets_habilitados: false,
      /** Texto único que recibe el cliente mientras el canal esté apagado. Vacío = no contestar nada. */
      local_texto_desconectado: '',
      /**
       * La API que contestó el GET maneja las dos claves del canal.
       *
       * `admin-api` y `admin-spa` no llegan a producción al mismo tiempo, así que esta pantalla puede
       * estrenarse contra la API vieja, que no tiene estos dos campos. Con esto en false la pantalla lo
       * dice en lugar de mostrar un interruptor que no gobierna nada.
       */
      canal_soportado: false,
      /** Valores persistidos en servidor. */
      stored_suggestions_enabled: false,
      stored_suggestion_delay: 0,
      stored_auto_send_delay: 0,
      stored_tickets_habilitados: false,
      stored_texto_desconectado: '',
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
      // Las dos claves del canal se chequean primero y no se condicionan por `local_suggestions_enabled`:
      // gobiernan si el ticket existe, así que se tienen que poder cambiar con las sugerencias apagadas.
      if (
        this.local_tickets_habilitados !== this.stored_tickets_habilitados ||
        this.local_texto_desconectado !== this.stored_texto_desconectado
      ) {
        if (!this.local_suggestions_enabled) {
          return true
        }
        return this.is_suggestion_delay_valid() && this.is_auto_send_delay_valid()
      }
      if (this.local_suggestions_enabled !== this.stored_suggestions_enabled) {
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
          // Si la API todavía no manda las claves del canal se asume apagado y sin texto, que es el estado
          // real desde el 16/9 y además el que no miente: con esto apagado los mensajes de los clientes no
          // abren ticket, y mostrarlo prendido haría creer que alguien los está leyendo.
          const canal_soportado = data.tickets_habilitados !== undefined
          const tickets_habilitados = !!data.tickets_habilitados
          const texto_desconectado =
            data.texto_desconectado === undefined || data.texto_desconectado === null
              ? ''
              : String(data.texto_desconectado)
          self.load_failed = false
          self.canal_soportado = canal_soportado
          self.local_suggestions_enabled = enabled
          self.stored_suggestions_enabled = enabled
          self.local_tickets_habilitados = tickets_habilitados
          self.stored_tickets_habilitados = tickets_habilitados
          self.local_texto_desconectado = texto_desconectado
          self.stored_texto_desconectado = texto_desconectado
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
      // Cada clave opcional viaja solo si el operador la cambió, para no pisar cambios de otra pestaña.
      // La verificación se configura únicamente desde cada ticket.
      const payload = {
        suggestions_enabled: self.local_suggestions_enabled,
      }
      // Tampoco se condicionan por `local_suggestions_enabled`: el canal es anterior a la IA.
      if (self.local_tickets_habilitados !== self.stored_tickets_habilitados) {
        payload.tickets_habilitados = self.local_tickets_habilitados
      }
      if (self.local_texto_desconectado !== self.stored_texto_desconectado) {
        payload.texto_desconectado = self.local_texto_desconectado
      }
      /** El PUT llevaba alguna de las dos claves del canal, para poder denunciar si la API las ignoró. */
      const pidio_canal =
        payload.tickets_habilitados !== undefined || payload.texto_desconectado !== undefined
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
          // Mismo criterio que el GET: sin la clave en la respuesta, la pantalla vuelve a lo que el
          // servidor sí tiene. Dejar el interruptor como lo dejó el operador lo haría irse creyendo que
          // los clientes ya abren ticket cuando siguen cayendo en silencio.
          if (data.tickets_habilitados === undefined) {
            self.canal_soportado = false
            self.local_tickets_habilitados = self.stored_tickets_habilitados
            self.local_texto_desconectado = self.stored_texto_desconectado
          } else {
            self.canal_soportado = true
            self.local_tickets_habilitados = !!data.tickets_habilitados
            self.stored_tickets_habilitados = self.local_tickets_habilitados
            const saved_texto =
              data.texto_desconectado === undefined || data.texto_desconectado === null
                ? ''
                : String(data.texto_desconectado)
            self.local_texto_desconectado = saved_texto
            self.stored_texto_desconectado = saved_texto
          }
          if (pidio_canal && data.tickets_habilitados === undefined) {
            self.error_message =
              'Se guardó el resto, pero esta versión de la API todavía no maneja el interruptor de tickets ' +
              'de soporte ni su texto: esos dos quedaron como estaban.'
          } else {
            self.saved_message = 'Configuración guardada.'
          }
        })
        .catch(function (err) {
          const msg =
            (err.response && err.response.data && err.response.data.message) ||
            'No se pudo guardar.'
          self.error_message = msg
          // Y por el mismo motivo, el interruptor del canal: la mentira peligrosa es mostrarlo prendido
          // cuando en el servidor los mensajes de los clientes no abren ticket.
          self.local_tickets_habilitados = self.stored_tickets_habilitados
          self.local_texto_desconectado = self.stored_texto_desconectado
        })
        .then(function () {
          self.saving = false
        })
    },
  },
}
</script>
