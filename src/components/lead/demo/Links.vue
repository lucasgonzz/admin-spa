<template>
  <div v-if="draft" class="lead-demo-links">
    <!-- Los dos links, con el mismo bloque de copiar / abrir que dibujaba el form genérico. -->
    <div class="mb-3">
      <lead-demo-ingreso-link
        :record="draft"
        field_key="demo_experiencia_url"
        field_label="Link de ingreso a la página de experiencia"
      />
    </div>
    <div class="mb-3">
      <lead-demo-ingreso-link
        :record="draft"
        field_key="demo_ingreso_url"
        field_label="Link de ingreso a la demo"
      />
    </div>

    <!-- URL de Google Meet (`meet_url`): estaba readonly en el grupo Demo del meta y se había
         quedado afuera de la solapa nueva (hallazgo del chequeo, 17/10/2026). Solo cuando tiene
         valor: la escribe el backend al crear el evento del closer, acá no se edita. -->
    <div v-if="meet_url" class="mb-3">
      <label class="form-label mb-0" for="lead_demo_links_meet">URL Google Meet</label>
      <small class="form-text text-muted d-block mt-1 mb-2">
        El link de la videollamada con el closer, si ya se creó el evento. Solo lectura.
      </small>
      <div class="input-group">
        <input
          id="lead_demo_links_meet"
          :value="meet_url"
          type="text"
          class="form-control"
          readonly
          aria-label="URL Google Meet"
          @focus="on_focus"
        />
        <button
          type="button"
          class="btn"
          :class="copied_meet_feedback ? 'btn-success' : 'btn-outline-secondary'"
          :title="copied_meet_feedback ? 'Link copiado' : 'Copiar el link al portapapeles'"
          @click="on_copy_meet"
        >
          <i class="bi" :class="copied_meet_feedback ? 'bi-check-lg' : 'bi-clipboard'" aria-hidden="true" />
          {{ copied_meet_feedback ? 'Copiado' : 'Copiar' }}
        </button>
        <a :href="meet_url" target="_blank" rel="noopener" class="btn btn-outline-secondary" title="Abrir el Meet en una pestaña nueva">
          <i class="bi bi-box-arrow-up-right" aria-hidden="true" />
          Abrir
        </a>
      </div>
    </div>

    <!-- Token de ingreso: estado, vencimiento y las acciones rescatadas de DemoAccesoControl. -->
    <div class="lead-demo-links__token">
      <div class="d-flex align-items-center gap-2 flex-wrap mb-2">
        <label class="form-label mb-0" for="lead_demo_links_token">Token de ingreso</label>
        <span v-if="token_state === 'revocado'" class="badge bg-secondary">Revocado</span>
        <span v-else-if="token_state === 'vencido'" class="badge bg-light text-secondary border">Vencido</span>
        <span v-else-if="token_state === 'vigente'" class="badge bg-success">Vigente</span>
        <small v-if="expira_display" class="text-muted">{{ expira_display }}</small>
      </div>

      <p v-if="token_state === 'sin_token'" class="text-muted small mb-2">
        <i class="bi bi-dash-circle me-1" aria-hidden="true" />
        Todavía no se generó el acceso.
        <span v-if="!record.demo_id">Asigná una demo en Configuración y guardá para poder generarlo.</span>
      </p>
      <div v-else class="input-group mb-2">
        <!-- readonly y no disabled: readonly deja seleccionar y copiar el texto a mano. -->
        <input
          id="lead_demo_links_token"
          :value="record.demo_ingreso_token"
          type="text"
          class="form-control font-monospace"
          readonly
          aria-label="Token de ingreso"
          @focus="on_focus"
        />
        <button
          type="button"
          class="btn"
          :class="copied_feedback ? 'btn-success' : 'btn-outline-secondary'"
          :title="copied_feedback ? 'Token copiado' : 'Copiar el token al portapapeles'"
          @click="on_copy_token"
        >
          <i class="bi" :class="copied_feedback ? 'bi-check-lg' : 'bi-clipboard'" aria-hidden="true" />
          {{ copied_feedback ? 'Copiado' : 'Copiar' }}
        </button>
      </div>

      <div class="d-flex flex-wrap gap-2">
        <button
          v-if="record.demo_id"
          type="button"
          class="btn btn-sm"
          :class="token_state === 'sin_token' ? 'btn-primary' : 'btn-outline-secondary'"
          :disabled="loading_action !== '' || confirming_action !== ''"
          @click="pedir_reemitir"
        >
          <i class="bi bi-arrow-repeat me-1" aria-hidden="true" />
          {{ token_state === 'sin_token' ? 'Generar acceso' : 'Reemitir' }}
        </button>
        <button
          v-if="token_state === 'vigente'"
          type="button"
          class="btn btn-sm btn-outline-danger"
          :disabled="loading_action !== '' || confirming_action !== ''"
          @click="confirming_action = 'revocar'"
        >
          <i class="bi bi-slash-circle me-1" aria-hidden="true" />Revocar
        </button>
        <button
          v-if="record.demo_id"
          type="button"
          class="btn btn-sm btn-outline-primary"
          :disabled="loading_action !== ''"
          title="Vuelve a mandar la carta de acceso por mail (el backend valida que estén el mail, la demo y el turno)"
          @click="send_demo_mail"
        >
          <span v-if="loading_action === 'mail'" class="spinner-border spinner-border-sm me-1" aria-hidden="true" />
          <i v-else class="bi bi-envelope-paper me-1" aria-hidden="true" />
          Reenviar mail de acceso
        </button>
      </div>

      <!-- Confirmación inline para reemitir: invalida el link anterior. Mismo patrón que tenía
           DemoAccesoControl (alert-light con Confirmar / Cancelar), sin confirm() nativo. -->
      <div v-if="confirming_action === 'reemitir'" class="alert alert-light border mb-0 mt-2 py-2 px-3">
        <p class="mb-2 small">Se va a invalidar el link anterior. ¿Reemitir el acceso a la demo?</p>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-sm btn-primary" :disabled="loading_action !== ''" @click="on_reemitir">
            <span v-if="loading_action === 'reemitir'" class="spinner-border spinner-border-sm me-1" aria-hidden="true" />
            {{ loading_action === 'reemitir' ? 'Reemitiendo...' : 'Confirmar' }}
          </button>
          <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="loading_action !== ''" @click="confirming_action = ''">
            Cancelar
          </button>
        </div>
      </div>

      <!-- Confirmación para revocar: texto más fuerte porque corta una sesión en curso. -->
      <div v-if="confirming_action === 'revocar'" class="alert alert-light border mb-0 mt-2 py-2 px-3">
        <p class="mb-2 small text-danger">
          El lead pierde el acceso inmediatamente, incluso si está adentro de la demo ahora mismo.
        </p>
        <div class="d-flex gap-2">
          <button type="button" class="btn btn-sm btn-danger" :disabled="loading_action !== ''" @click="on_revocar">
            <span v-if="loading_action === 'revocar'" class="spinner-border spinner-border-sm me-1" aria-hidden="true" />
            {{ loading_action === 'revocar' ? 'Revocando...' : 'Confirmar revocación' }}
          </button>
          <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="loading_action !== ''" @click="confirming_action = ''">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import moment from 'moment'
import LeadDemoIngresoLink from '@/components/lead/DemoIngresoLink.vue'
import { time_ago } from '@/utils/relative_time'
import { copy_text_to_clipboard } from '@/utils/version_notification_clipboard'
import { resolve_error_message } from '@/utils/axios'

/**
 * Sub-solapa Links de la Demo (misión flujo-lead-landing-closer, 17/10/2026): el link de la página
 * de experiencia y el de ingreso a la demo (`DemoIngresoLink`, tal cual), y debajo el token con su
 * vencimiento, la píldora "Revocado" y los botones Reemitir / Revocar, que hasta hoy vivían en
 * `DemoAccesoControl.vue` sin que nadie lo importara (se sacó del sidebar el 8/9/2026). Más
 * "Reenviar mail de acceso", que estaba en Acciones manuales de Operaciones.
 *
 * El estado del token se calcula igual que allá: `sin_token` → `revocado` → `vencido` → `vigente`,
 * con un tick por minuto para que un token vigente pase a vencido con el modal abierto.
 */
export default {
  name: 'LeadDemoLinks',
  components: { LeadDemoIngresoLink },
  props: {
    draft: { type: Object, default: null },
    record: { type: Object, default: null },
    all_properties: { type: Array, default: () => [] },
  },
  emits: ['record-updated'],
  data() {
    return {
      /** '' | 'reemitir' | 'revocar' | 'mail': acción en vuelo. */
      loading_action: '',
      /** '' | 'reemitir' | 'revocar': panel de confirmación abierto. */
      confirming_action: '',
      copied_feedback: false,
      copied_feedback_timer: null,
      /** Feedback «Copiado» del link de Meet, independiente del del token. */
      copied_meet_feedback: false,
      copied_meet_timer: null,
      /** Se incrementa cada minuto para que `token_state` y `expira_display` se recalculen. */
      now_tick: 0,
      now_tick_interval: null,
    }
  },
  computed: {
    /**
     * URL de Google Meet del lead, o '' si todavía no hay evento.
     * @returns {string}
     */
    meet_url() {
      const r = this.record
      return r && r.meet_url ? String(r.meet_url).trim() : ''
    },
    /**
     * 'sin_token' | 'vigente' | 'revocado' | 'vencido'
     * @returns {string}
     */
    token_state() {
      void this.now_tick
      const r = this.record
      if (!r || !r.demo_ingreso_token) {
        return 'sin_token'
      }
      if (r.demo_ingreso_token_revocado_at) {
        return 'revocado'
      }
      const expira_at = r.demo_ingreso_token_expira_at
      if (expira_at && moment(expira_at).isBefore(moment())) {
        return 'vencido'
      }
      return 'vigente'
    },
    /**
     * "Vence hoy a las 16:30" / "Vence el 30/07 a las 10:00" / "Venció hace 2 h".
     * @returns {string}
     */
    expira_display() {
      void this.now_tick
      const expira_at = this.record && this.record.demo_ingreso_token_expira_at
      if (!expira_at || this.token_state === 'sin_token') {
        return ''
      }
      const m = moment(expira_at)
      if (!m.isValid()) {
        return ''
      }
      if (this.token_state === 'revocado') {
        const rev = moment(this.record.demo_ingreso_token_revocado_at)
        return rev.isValid() ? 'Revocado el ' + rev.format('DD/MM HH:mm') : ''
      }
      if (this.token_state === 'vencido') {
        return 'Venció ' + time_ago(expira_at)
      }
      const dia = m.isSame(moment(), 'day') ? 'hoy' : 'el ' + m.format('DD/MM')
      return 'Vence ' + dia + ' a las ' + m.format('HH:mm')
    },
  },
  mounted() {
    const self = this
    this.now_tick_interval = setInterval(function () {
      self.now_tick = self.now_tick + 1
    }, 60000)
  },
  beforeUnmount() {
    if (this.now_tick_interval) {
      clearInterval(this.now_tick_interval)
    }
    if (this.copied_feedback_timer) {
      clearTimeout(this.copied_feedback_timer)
    }
    if (this.copied_meet_timer) {
      clearTimeout(this.copied_meet_timer)
    }
  },
  methods: {
    /**
     * Copia el link de Meet al portapapeles con feedback de 2 segundos.
     */
    on_copy_meet() {
      if (!this.meet_url) {
        return
      }
      const self = this
      copy_text_to_clipboard(this.meet_url)
        .then(function () {
          self.copied_meet_feedback = true
          if (self.copied_meet_timer) {
            clearTimeout(self.copied_meet_timer)
          }
          self.copied_meet_timer = setTimeout(function () {
            self.copied_meet_feedback = false
            self.copied_meet_timer = null
          }, 2000)
        })
        .catch(function () {
          self.toast('No se pudo copiar el link al portapapeles.')
        })
    },
    /**
     * @param {FocusEvent} event
     */
    on_focus(event) {
      if (event && event.target && event.target.select) {
        event.target.select()
      }
    },
    on_copy_token() {
      const token = this.record ? this.record.demo_ingreso_token : ''
      if (!token) {
        return
      }
      const self = this
      copy_text_to_clipboard(String(token))
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
          self.toast('No se pudo copiar el token al portapapeles.')
        })
    },
    /**
     * Sin token no hay nada que invalidar: se genera directo. Con token, se pide confirmación.
     */
    pedir_reemitir() {
      if (this.token_state === 'sin_token') {
        this.on_reemitir()
        return
      }
      this.confirming_action = 'reemitir'
    },
    on_reemitir() {
      if (this.loading_action !== '' || !this.record || !this.record.id) {
        return
      }
      const self = this
      this.loading_action = 'reemitir'
      this.$store.dispatch('lead/reemitir_demo_token', this.record.id)
        .then(function (model) {
          self.confirming_action = ''
          self.$emit('record-updated', model)
        })
        .catch(function () {
          /* El toast de error global (interceptor de axios) ya avisa. */
        })
        .then(function () {
          self.loading_action = ''
        })
    },
    on_revocar() {
      if (this.loading_action !== '' || !this.record || !this.record.id) {
        return
      }
      const self = this
      this.loading_action = 'revocar'
      this.$store.dispatch('lead/revocar_demo_token', this.record.id)
        .then(function (model) {
          self.confirming_action = ''
          self.$emit('record-updated', model)
        })
        .catch(function () {
          /* Idem: el interceptor ya avisó. */
        })
        .then(function () {
          self.loading_action = ''
        })
    },
    /**
     * POST /lead/{id}/send-demo-mail. La validación de campos obligatorios la hace el backend y el
     * 422 llega con su motivo; acá no se duplica la lista.
     */
    send_demo_mail() {
      if (this.loading_action !== '' || !this.record || !this.record.id) {
        return
      }
      const self = this
      this.loading_action = 'mail'
      this.$store.dispatch('lead/send_demo_mail', this.record.id)
        .then(function (model) {
          self.$emit('record-updated', model)
          self.toast('Mail de acceso a la demo enviado.')
        })
        .catch(function (error) {
          self.toast(resolve_error_message(error))
        })
        .then(function () {
          self.loading_action = ''
        })
    },
    /**
     * @param {string} mensaje
     */
    toast(mensaje) {
      if (this.$root && this.$root.$emit) {
        this.$root.$emit('open_toast', mensaje)
      }
    },
  },
}
</script>

<style scoped>
.lead-demo-links__token {
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--bs-border-color);
  border-radius: 0.5rem;
  background: var(--bs-tertiary-bg, #f8f9fa);
}
</style>
