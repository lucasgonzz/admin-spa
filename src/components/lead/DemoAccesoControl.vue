<template>
  <!-- Bloque autocontenido de acceso directo a la demo (grupo 233, prompt 06). -->
  <div class="dac-wrap">
    <label class="dac-label">Acceso a la demo</label>

    <!-- Estado "sin_token": todavía no se generó ningún acceso para este lead. -->
    <div v-if="token_state === 'sin_token'" class="dac-row">
      <span class="dac-hint">Todavía no se generó el acceso.</span>
      <button
        type="button"
        class="btn btn-sm btn-primary"
        :disabled="loading_action !== ''"
        @click="on_reemitir"
      >
        <span v-if="loading_action === 'reemitir'" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
        Generar acceso
      </button>
    </div>

    <!-- Estado "vigente": el token está activo y sirve para entrar a la demo ahora mismo. -->
    <div v-else-if="token_state === 'vigente'" class="dac-row dac-row--vigente">
      <!-- Acción principal: la que Lucas va a usar más seguido, por eso es la más grande. -->
      <button
        type="button"
        class="btn btn-sm dac-copy-btn"
        :class="copied_feedback ? 'btn-success' : 'btn-outline-success'"
        @click="on_copy_link"
      >
        <i class="bi" :class="copied_feedback ? 'bi-check-lg' : 'bi-clipboard'" aria-hidden="true" />
        {{ copied_feedback ? 'Copiado' : 'Copiar link' }}
      </button>
      <span class="dac-expira-text">{{ expira_display }}</span>
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary"
        :disabled="loading_action !== ''"
        @click="confirming_action = 'reemitir'"
      >
        Reemitir
      </button>
      <button
        type="button"
        class="btn btn-sm btn-outline-danger"
        :disabled="loading_action !== ''"
        @click="confirming_action = 'revocar'"
      >
        Revocar
      </button>
    </div>

    <!-- Estado "revocado": el link fue cortado manualmente y ya no sirve. -->
    <div v-else-if="token_state === 'revocado'" class="dac-row">
      <span class="dac-hint dac-hint--danger">
        <i class="bi bi-slash-circle" aria-hidden="true" /> Acceso revocado.
      </span>
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary"
        :disabled="loading_action !== ''"
        @click="confirming_action = 'reemitir'"
      >
        Reemitir
      </button>
    </div>

    <!-- Estado "vencido": pasó la ventana de vigencia del turno; el link ya no anda. -->
    <div v-else-if="token_state === 'vencido'" class="dac-row">
      <span class="dac-hint dac-hint--muted">
        <i class="bi bi-clock-history" aria-hidden="true" /> {{ expira_display }}
      </span>
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary"
        :disabled="loading_action !== ''"
        @click="confirming_action = 'reemitir'"
      >
        Reemitir
      </button>
    </div>

    <!-- Panel de confirmación para reemitir: se pide confirmación porque invalida el link anterior. -->
    <div v-if="confirming_action === 'reemitir'" class="alert alert-light border dac-confirm mb-0 mt-2">
      <p class="mb-2 small">
        Se va a invalidar el link anterior. ¿Reemitir el acceso a la demo?
      </p>
      <div class="d-flex gap-2">
        <button
          type="button"
          class="btn btn-sm btn-primary"
          :disabled="loading_action !== ''"
          @click="on_reemitir"
        >
          <span v-if="loading_action === 'reemitir'" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
          {{ loading_action === 'reemitir' ? 'Reemitiendo...' : 'Confirmar' }}
        </button>
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          :disabled="loading_action !== ''"
          @click="confirming_action = ''"
        >
          Cancelar
        </button>
      </div>
    </div>

    <!-- Panel de confirmación para revocar: texto más fuerte porque corta una sesión en curso. -->
    <div v-if="confirming_action === 'revocar'" class="alert alert-light border dac-confirm mb-0 mt-2">
      <p class="mb-2 small text-danger">
        El lead pierde el acceso inmediatamente, incluso si está adentro de la demo ahora mismo.
      </p>
      <div class="d-flex gap-2">
        <button
          type="button"
          class="btn btn-sm btn-danger"
          :disabled="loading_action !== ''"
          @click="on_revocar"
        >
          <span v-if="loading_action === 'revocar'" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
          {{ loading_action === 'revocar' ? 'Revocando...' : 'Confirmar revocación' }}
        </button>
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          :disabled="loading_action !== ''"
          @click="confirming_action = ''"
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import moment from 'moment'
import { time_ago } from '@/utils/relative_time'
import { copy_text_to_clipboard } from '@/utils/version_notification_clipboard'

/**
 * Control autocontenido de acceso directo a la demo (grupo 233, prompt 06).
 *
 * Muestra el estado del token de ingreso de un lead (sin generar / vigente / revocado /
 * vencido) y permite copiar el link, reemitirlo o revocarlo sin salir de la conversación.
 * Calca el patrón de confirmación inline usado en otros controles del panel del lead
 * (ver `components/lead/extra-props/Index.vue`, bloque "Confirmación de subdominio"):
 * un `alert alert-light border` con botones Confirmar/Cancelar, en vez de un modal o el
 * `confirm()` nativo del navegador.
 *
 * Solo debe montarse cuando el lead tiene demo asignada (`lead.demo_id`); el padre es
 * responsable de ese v-if, este componente no se autooculta para dejar esa decisión
 * explícita en el lugar donde se monta.
 *
 * Props:
 *   lead {Object} - Lead con los campos demo_ingreso_token, demo_ingreso_token_expira_at,
 *                   demo_ingreso_token_revocado_at, demo_ingreso_url (accesor) y demo_id.
 *
 * Eventos:
 *   record-updated - Se emite con el lead ya refrescado luego de reemitir o revocar,
 *                    para que el padre actualice su copia (mismo contrato que usan
 *                    otros controles del panel, ej. LeadResumenTab).
 */
export default {
  name: 'DemoAccesoControl',

  props: {
    /**
     * Lead sobre el que se opera. Se espera que ya tenga demo asignada.
     * @type {Object}
     */
    lead: {
      type: Object,
      required: true,
    },
  },

  emits: ['record-updated'],

  data() {
    return {
      /** Acción en curso contra el backend: '' | 'reemitir' | 'revocar'. Deshabilita los botones. */
      loading_action: '',
      /** Qué panel de confirmación está abierto: '' | 'reemitir' | 'revocar'. */
      confirming_action: '',
      /** true mientras se muestra el feedback "Copiado" tras copiar el link. */
      copied_feedback: false,
      /** Id del setTimeout que apaga el feedback "Copiado", para poder cancelarlo si se copia de nuevo. */
      copied_feedback_timer: null,
      /** Contador que se incrementa cada minuto solo para forzar el recálculo de expira_display
       *  (el token puede vencer mientras el panel sigue abierto, sin que el usuario haga nada). */
      now_tick: 0,
      /** Id del setInterval que actualiza now_tick. */
      now_tick_interval: null,
    }
  },

  computed: {
    /**
     * Estado del token de ingreso, calculado a partir de los campos del lead.
     * 'sin_token' | 'vigente' | 'revocado' | 'vencido'.
     * @returns {string}
     */
    token_state() {
      // Forzar dependencia de now_tick para que el estado se recalcule con el paso del tiempo.
      void this.now_tick
      if (!this.lead || !this.lead.demo_ingreso_token) {
        return 'sin_token'
      }
      if (this.lead.demo_ingreso_token_revocado_at) {
        return 'revocado'
      }
      var expira_at = this.lead.demo_ingreso_token_expira_at
      if (expira_at && moment(expira_at).isBefore(moment())) {
        return 'vencido'
      }
      return 'vigente'
    },

    /**
     * URL de ingreso directo a la demo. Usa el accesor `demo_ingreso_url` del backend si vino
     * en la respuesta; si no, lo arma acá con la misma fórmula que usa el backend:
     * `demo.erp_spa_url` + '/demo/ingreso?t=' + token.
     *
     * 🔴 El fallback SIGUE HACIENDO FALTA, y conviene ser preciso sobre por qué, porque desde el
     * 25/8/2026 la mitad de la frase vieja quedó vencida: `demo_ingreso_url` ahora sí viaja, pero
     * **solo en el detalle** (`GET /lead/{id}`, vía `prepare_lead_for_detail_json`), no en el
     * listado ni en los payloads públicos. Este control se monta con el lead del listado, así que
     * es justo el caso en el que el campo no viene. No se agregó a un `$appends` de clase a
     * propósito: el accesor lee la relación `demo` y el modelo se serializa entero en lugares que
     * no deberían llevar el token, entre ellos un canal público de Pusher.
     * @returns {string}
     */
    demo_ingreso_url() {
      if (!this.lead) {
        return ''
      }
      if (this.lead.demo_ingreso_url) {
        return this.lead.demo_ingreso_url
      }
      if (!this.lead.demo_ingreso_token || !this.lead.demo || !this.lead.demo.erp_spa_url) {
        return ''
      }
      var base = String(this.lead.demo.erp_spa_url).replace(/\/+$/, '')
      if (!base) {
        return ''
      }
      return base + '/demo/ingreso?t=' + this.lead.demo_ingreso_token
    },

    /**
     * Texto humano de la expiración del token, en la zona horaria del navegador del admin.
     * Vigente: "vence hoy a las 16:30" / "vence el 30/07 a las 10:00".
     * Vencido: "venció hace 2 horas" (reutiliza el helper time_ago del proyecto).
     * @returns {string}
     */
    expira_display() {
      void this.now_tick
      var expira_at = this.lead && this.lead.demo_ingreso_token_expira_at
      if (!expira_at) {
        return ''
      }
      var m = moment(expira_at)
      if (!m.isValid()) {
        return ''
      }
      if (this.token_state === 'vencido') {
        return 'Venció ' + time_ago(expira_at)
      }
      var dia = m.isSame(moment(), 'day') ? 'hoy' : 'el ' + m.format('DD/MM')
      return 'Vence ' + dia + ' a las ' + m.format('HH:mm')
    },
  },

  mounted() {
    /* Refrescar cada minuto: un token "vigente" puede pasar a "vencido" con el panel abierto. */
    var self = this
    this.now_tick_interval = setInterval(function () {
      self.now_tick++
    }, 60000)
  },

  beforeUnmount() {
    /* Limpiar timers para evitar fugas de memoria al desmontar el componente. */
    if (this.now_tick_interval) {
      clearInterval(this.now_tick_interval)
    }
    if (this.copied_feedback_timer) {
      clearTimeout(this.copied_feedback_timer)
    }
  },

  methods: {
    /**
     * Copia el link de ingreso al portapapeles y muestra feedback visual por 2 segundos.
     * Reutiliza el helper genérico del proyecto (`copy_text_to_clipboard`), el mismo que usa
     * la exportación de notas de versión.
     * @returns {void}
     */
    on_copy_link() {
      var self = this
      if (!this.demo_ingreso_url) {
        return
      }
      copy_text_to_clipboard(this.demo_ingreso_url)
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

    /**
     * Reemite el token de ingreso (o lo genera por primera vez si el lead todavía no tenía).
     * Cierra el panel de confirmación al terminar, con éxito o con error.
     * @returns {void}
     */
    on_reemitir() {
      var self = this
      if (this.loading_action !== '') {
        return
      }
      this.loading_action = 'reemitir'
      this.$store.dispatch('lead/reemitir_demo_token', this.lead.id)
        .then(function (model) {
          self.confirming_action = ''
          self.$emit('record-updated', model)
        })
        .catch(function () {
          // El toast de error global (interceptor de axios) ya avisa; acá solo cerramos el loading.
        })
        .then(function () {
          self.loading_action = ''
        })
    },

    /**
     * Revoca el token de ingreso vigente. Cierra el panel de confirmación al terminar,
     * con éxito o con error.
     * @returns {void}
     */
    on_revocar() {
      var self = this
      if (this.loading_action !== '') {
        return
      }
      this.loading_action = 'revocar'
      this.$store.dispatch('lead/revocar_demo_token', this.lead.id)
        .then(function (model) {
          self.confirming_action = ''
          self.$emit('record-updated', model)
        })
        .catch(function () {
          // El toast de error global (interceptor de axios) ya avisa; acá solo cerramos el loading.
        })
        .then(function () {
          self.loading_action = ''
        })
    },
  },
}
</script>

<style scoped>
.dac-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--bs-border-color);
  background: var(--bs-body-bg);
}
.dac-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: rgba(17, 27, 33, 0.55);
  margin: 0;
}
.dac-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
.dac-row--vigente .dac-copy-btn {
  font-weight: 600;
}
.dac-hint {
  font-size: 0.8rem;
  color: rgba(17, 27, 33, 0.6);
}
.dac-hint--danger {
  color: var(--bs-danger);
}
.dac-hint--muted {
  color: rgba(17, 27, 33, 0.5);
  font-style: italic;
}
.dac-expira-text {
  font-size: 0.75rem;
  color: rgba(17, 27, 33, 0.55);
  white-space: nowrap;
}
.dac-confirm {
  padding: 0.6rem 0.75rem;
}
</style>
