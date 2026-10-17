<template>
  <div class="vp-row">
    <label class="vp-label">Agendar demo</label>

    <!-- Demo directa ({ahora: true}, misión demo-agendado-directo): no hay demo, fecha ni hora
         que elegir — la instancia libre la asigna el backend al aprobar y la demo arranca 10
         minutos después. Va ANTES del aviso de "sin demos disponibles" a propósito: esta forma
         no depende de la disponibilidad publicada, así que se ve igual aunque `demos` venga
         vacío. Tampoco aplica el aviso de "forzar horario": no hay slot que forzar. -->
    <div v-if="ahora_form" class="vp-ahora">
      <div class="vp-ahora-text">
        <i class="bi bi-lightning-charge-fill me-1" aria-hidden="true" />
        Demo para ahora mismo — la instancia libre se asigna al aprobar y arranca en 10 minutos.
      </div>
      <!-- Apagarlo desactiva la acción (value = null); volver a prenderlo la restituye. -->
      <div class="form-check form-switch vp-mail-toggle">
        <input
          id="vp_asignar_demo_ahora"
          class="form-check-input"
          type="checkbox"
          role="switch"
          :checked="is_ahora"
          :disabled="disabled"
          @change="on_toggle_ahora($event.target.checked)"
        />
        <label class="form-check-label vp-label" for="vp_asignar_demo_ahora">
          Asignar la demo al aprobar
        </label>
      </div>
    </div>

    <!-- Demo directa para un MOMENTO CONCRETO (tercera forma del paquete, 17/10/2026, misión
         flujo-lead-landing-closer): `{dia, hora, inicio_resuelto}`. Como en «ahora mismo», no
         hay demo ni slot que elegir: la instancia libre para toda la ventana la asigna el backend
         al aprobar. El texto sale de `inicio_resuelto` (lo escribe el servidor al normalizar,
         `Y-m-d H:i`), o de `dia` + `hora` si todavía no vino, o crudo si no se puede leer. -->
    <div v-else-if="momento_form" class="vp-ahora" :class="{ 'vp-ahora--ilegible': momento_ilegible }">
      <div class="vp-ahora-text">
        <i class="bi me-1" :class="momento_ilegible ? 'bi-exclamation-triangle-fill' : 'bi-calendar-event'" aria-hidden="true" />
        <!-- `inicio_ilegible: true`: el servidor no pudo leer el momento y ya decidió no asignar
             nada al aprobar; prometer la asignación acá sería mentirle al operador. -->
        <template v-if="momento_ilegible">
          Demo para {{ momento_texto }} — el sistema no pudo leer el momento; no se va a asignar
          ninguna demo al aprobar.
        </template>
        <template v-else>
          Demo para {{ momento_texto }} — la instancia libre se asigna al aprobar.
        </template>
      </div>
      <!-- Mismo switch que «ahora»: apagarlo saca la acción (value = null); prenderlo restituye el
           objeto TAL CUAL llegó. -->
      <div class="form-check form-switch vp-mail-toggle">
        <input
          id="vp_asignar_demo_momento"
          class="form-check-input"
          type="checkbox"
          role="switch"
          :checked="is_momento"
          :disabled="disabled"
          @change="on_toggle_momento($event.target.checked)"
        />
        <label class="form-check-label vp-label" for="vp_asignar_demo_momento">
          Asignar la demo al aprobar
        </label>
      </div>
    </div>

    <!-- Sin demos disponibles: control deshabilitado con aviso breve. -->
    <div v-else-if="!demos.length" class="vp-empty-hint">Sin demos disponibles.</div>

    <template v-else>
      <div class="vp-demo-grid">
        <select
          class="form-select form-select-sm vp-control"
          :value="demo_id"
          :disabled="disabled"
          @change="on_change_demo($event.target.value)"
        >
          <option value="">— sin demo —</option>
          <option v-for="d in demos" :key="d.demo_id" :value="d.demo_id">{{ d.label }}</option>
        </select>

        <select
          class="form-select form-select-sm vp-control"
          :value="demo_date"
          :disabled="disabled || !demo_id || !available_dates.length"
          @change="on_change_date($event.target.value)"
        >
          <option value="">— fecha —</option>
          <option v-for="fecha in available_dates" :key="fecha" :value="fecha">{{ fecha }}</option>
        </select>

        <select
          class="form-select form-select-sm vp-control"
          :value="demo_start_time"
          :disabled="disabled || !demo_date"
          @change="on_change_time($event.target.value)"
        >
          <option value="">— hora inicio —</option>
          <option v-for="hora in available_times" :key="hora" :value="hora">{{ hora }}</option>
        </select>

        <!-- La hora de fin la calcula el server (duración de la demo); no editable acá. -->
        <span class="vp-end-time-hint">Hora fin: la calcula el sistema</span>
      </div>

      <!-- Slot elegido fuera de la disponibilidad libre: ofrecer forzar horario con aviso. -->
      <div v-if="demo_id && demo_date && demo_start_time && !slot_is_available" class="vp-force-slot">
        <div class="form-check form-check-sm">
          <input
            id="vp_forzar_slot"
            class="form-check-input"
            type="checkbox"
            :checked="forzar_slot"
            :disabled="disabled"
            @change="$emit('update:forzar_slot', $event.target.checked)"
          />
          <label class="form-check-label vp-force-slot-label" for="vp_forzar_slot">
            El horario elegido no figura libre — forzar de todos modos
          </label>
        </div>
      </div>
    </template>

    <!-- Los tres toggles de abajo acompañan al control cuando está operativo: con demos
         publicadas (forma con horario) o con el paquete en alguna de las dos formas directas
         (ahora / momento concreto), que no dependen de la disponibilidad. Cuando no hay demos y
         el paquete no es directo, quedan ocultos junto con el resto (mismo comportamiento de
         siempre). -->
    <template v-if="ahora_form || momento_form || demos.length">
      <!-- Mail de acceso a la demo: solo tiene sentido si hay demo en el paquete (con horario o directa). -->
      <div v-if="has_demo_in_package" class="form-check form-switch vp-mail-toggle">
        <input
          id="vp_enviar_mail_demo"
          class="form-check-input"
          type="checkbox"
          role="switch"
          :checked="enviar_mail_demo"
          :disabled="disabled"
          @change="$emit('update:enviar_mail_demo', $event.target.checked)"
        />
        <label class="form-check-label vp-label" for="vp_enviar_mail_demo">
          Enviar el mail de acceso a la demo
        </label>
      </div>

      <!-- Cancelar/reagendar demo: independiente del resto del paquete. -->
      <div class="form-check form-switch vp-mail-toggle">
        <input
          id="vp_cancelar_demo"
          class="form-check-input"
          type="checkbox"
          role="switch"
          :checked="cancelar_demo"
          :disabled="disabled"
          @change="$emit('update:cancelar_demo', $event.target.checked)"
        />
        <label class="form-check-label vp-label" for="vp_cancelar_demo">
          Cancelar / reagendar demo existente
        </label>
      </div>

      <!-- Reenviar el mail de acceso: para leads con demo ya agendada que no lo recibieron. -->
      <div class="form-check form-switch vp-mail-toggle">
        <input
          id="vp_reenviar_mail_demo"
          class="form-check-input"
          type="checkbox"
          role="switch"
          :checked="reenviar_mail_demo"
          :disabled="disabled"
          @change="$emit('update:reenviar_mail_demo', $event.target.checked)"
        />
        <label class="form-check-label vp-label" for="vp_reenviar_mail_demo">
          Reenviar el mail de acceso (el lead dice que no le llegó)
        </label>
      </div>
    </template>
  </div>
</template>

<script>
import moment from 'moment'
import { es_agendar_demo_momento } from '@/components/lead/conversation/verification-panel/agendar_demo_momento'

/**
 * Nombres legibles de los valores de `dia` que admite el paquete `agendar_demo` con momento
 * concreto (`resolve_dia_solicitado()` en admin-api). `<dia>_proximo` y `+N` se resuelven aparte.
 */
const DIAS_LEGIBLES = {
  hoy: 'hoy',
  manana: 'mañana',
  pasado_manana: 'pasado mañana',
  lunes: 'el lunes',
  martes: 'el martes',
  miercoles: 'el miércoles',
  jueves: 'el jueves',
  viernes: 'el viernes',
  sabado: 'el sábado',
  domingo: 'el domingo',
}

/** Días de la semana para leer `inicio_resuelto` sin tocar el locale global de moment. */
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/**
 * Control de agendamiento de demo dentro del panel de verificación (prompt 323).
 *
 * Selecciona demo (entorno) + fecha + hora de inicio a partir de la disponibilidad real
 * (`panel_availability_json`, prompt 321). La hora de fin no se edita acá: la calcula el
 * backend al aplicar el paquete. Si el slot elegido no está entre los libres, ofrece marcar
 * "forzar horario" para que el backend lo agende igual.
 *
 * Desde la misión demo-agendado-directo el paquete tiene una segunda forma, `{ahora: true}`
 * (demo directa): no hay demo, fecha ni hora que elegir, la instancia libre la asigna el backend
 * al aprobar y la demo arranca 10 minutos después. En esa forma los tres selects se reemplazan
 * por un bloque compacto con un único switch que prende/apaga la acción.
 *
 * Desde la misión flujo-lead-landing-closer (17/10/2026) hay una TERCERA forma, la demo directa
 * para un momento concreto: `{dia, hora, inicio_resuelto}` (`inicio_resuelto` la escribe el
 * servidor al normalizar, `Y-m-d H:i`). Se muestra como la de «ahora», con el momento legible.
 * 🔴 Al emitirla se devuelve el objeto TAL CUAL llegó, sin agregarle `ahora` ni pisarle nada: el
 * servidor preserva `dia`/`hora`/`inicio_resuelto` solo si el panel no manda `ahora` ni fecha de
 * grilla. Por eso el switch alterna entre `null` y la referencia original, nunca arma un objeto.
 */
export default {
  name: 'VerificationDemoScheduleControl',
  props: {
    /** Catálogo de demos disponibles: [{ demo_id, label }]. */
    demos: { type: Array, default: () => [] },
    /** Slots libres por demo: { [demo_id]: { 'Y-m-d': ['HH:MM', ...] } }. */
    slots: { type: Object, default: () => ({}) },
    /**
     * Selección actual: { demo_id, demo_date, demo_start_time } (con horario), { ahora: true }
     * (demo directa ya), { dia, hora, inicio_resuelto } (demo directa para un momento concreto) o
     * null (acción desactivada).
     */
    value: { type: Object, default: null },
    /** true si el admin marcó forzar el horario elegido aunque figure ocupado. */
    forzar_slot: { type: Boolean, default: false },
    /** true si se debe enviar el mail de acceso a la demo al aprobar. */
    enviar_mail_demo: { type: Boolean, default: true },
    /** true si se debe reenviar el mail de acceso a un lead que ya tiene demo agendada. */
    reenviar_mail_demo: { type: Boolean, default: false },
    /** true si el paquete debe cancelar/reagendar una demo ya existente. */
    cancelar_demo: { type: Boolean, default: false },
    /** true mientras se envía el mensaje (bloquea todos los controles). */
    disabled: { type: Boolean, default: false },
  },
  emits: ['update:value', 'update:forzar_slot', 'update:enviar_mail_demo', 'update:reenviar_mail_demo', 'update:cancelar_demo'],
  data() {
    return {
      /**
       * true una vez que el paquete llegó en la forma directa `{ahora: true}`. Se recuerda acá
       * porque apagar el switch emite `null` (la acción se desactiva) y, si el bloque dependiera
       * solo de `value.ahora`, desaparecería con el switch apagado y el operador no tendría cómo
       * volver a prenderlo. Un `value` con `demo_id` la vuelve a apagar: el paquete cambió de forma.
       */
      ahora_form: false,
      /**
       * true una vez que el paquete llegó con un momento concreto (`dia`/`hora`/`inicio_resuelto`).
       * Misma razón que `ahora_form`: el switch apagado emite `null` y el bloque tiene que seguir
       * visible para poder volver a prenderlo.
       */
      momento_form: false,
      /**
       * El objeto del momento concreto tal cual llegó. Es lo que se vuelve a emitir al prender el
       * switch: no se reconstruye, para que `dia`, `hora` e `inicio_resuelto` lleguen al servidor
       * exactamente como los mandó el agente (17/10/2026).
       * @type {Object|null}
       */
      momento_original: null,
    }
  },
  computed: {
    /** true si la acción de demo directa está activa (value = { ahora: true }). */
    is_ahora() {
      return Boolean(this.value && this.value.ahora)
    },
    /** true si la acción de demo directa para un momento concreto está activa. */
    is_momento() {
      return this.es_forma_momento(this.value)
    },
    /**
     * true si el servidor marcó el momento como ilegible (`inicio_ilegible: true`): no hay
     * `inicio_resuelto` y al aprobar no se asigna ninguna demo. Se lee del valor activo o del
     * original guardado, para que la nota siga con el switch apagado.
     * @returns {boolean}
     */
    momento_ilegible() {
      const v = this.value || this.momento_original
      return Boolean(v && v.inicio_ilegible === true)
    },
    /**
     * Momento legible para el bloque: «el domingo 18/10 a las 10:00» desde `inicio_resuelto`;
     * si falta o no se puede leer, «mañana a las 10:00» desde `dia` + `hora`; y si tampoco, el
     * JSON crudo, que es mejor que un bloque mudo.
     * @returns {string}
     */
    momento_texto() {
      const v = this.value || this.momento_original
      if (!v) {
        return ''
      }
      /* El servidor escribe `inicio_resuelto` como `Y-m-d H:i` (`format('Y-m-d H:i')` al
         normalizar); se acepta también con segundos por si algún día los trae. Estricto, para
         que un valor raro caiga a `dia` + `hora` y no a un "Invalid date". */
      const resuelto = v.inicio_resuelto
        ? moment(String(v.inicio_resuelto), ['YYYY-MM-DD HH:mm', 'YYYY-MM-DD HH:mm:ss'], true)
        : null
      if (resuelto && resuelto.isValid()) {
        return 'el ' + DIAS_SEMANA[resuelto.day()] + ' ' + resuelto.format('DD/MM') + ' a las ' + resuelto.format('HH:mm')
      }
      const dia_texto = this.texto_dia(v.dia)
      const hora_texto = v.hora != null && String(v.hora).trim() !== '' ? String(v.hora).trim() : ''
      if (dia_texto && hora_texto) {
        return dia_texto + ' a las ' + hora_texto
      }
      if (dia_texto) {
        return dia_texto
      }
      if (hora_texto) {
        return 'las ' + hora_texto
      }
      return JSON.stringify(v)
    },
    /** true si hay demo en el paquete, en cualquiera de sus formas (demo_id elegido, ahora o momento). */
    has_demo_in_package() {
      return Boolean(this.demo_id) || this.is_ahora || this.is_momento
    },
    /** Id de demo actualmente elegido (string para <select>, '' si ninguno). */
    demo_id() {
      return this.value && this.value.demo_id != null ? String(this.value.demo_id) : ''
    },
    /** Fecha elegida (Y-m-d) o ''. */
    demo_date() {
      return (this.value && this.value.demo_date) || ''
    },
    /** Hora de inicio elegida (HH:MM) o ''. */
    demo_start_time() {
      return (this.value && this.value.demo_start_time) || ''
    },
    /** Fechas con slots publicados para la demo elegida. */
    available_dates() {
      if (!this.demo_id || !this.slots[this.demo_id]) {
        return []
      }
      return Object.keys(this.slots[this.demo_id])
    },
    /** Horarios libres para la fecha elegida dentro de la demo actual. */
    available_times() {
      if (!this.demo_id || !this.demo_date) {
        return []
      }
      var by_demo = this.slots[this.demo_id] || {}
      return by_demo[this.demo_date] || []
    },
    /** true si el horario elegido está entre los libres devueltos por el backend. */
    slot_is_available() {
      return this.available_times.indexOf(this.demo_start_time) !== -1
    },
  },
  watch: {
    /**
     * Mantiene la memoria de la forma del paquete. `null` no la toca a propósito: es lo que
     * emite el switch al apagarse, y ahí el bloque tiene que seguir visible.
     */
    value: {
      immediate: true,
      handler(value) {
        if (value && value.ahora) {
          this.ahora_form = true
          this.momento_form = false
        } else if (this.es_forma_momento(value)) {
          this.momento_form = true
          this.momento_original = value
          this.ahora_form = false
        } else if (value && value.demo_id != null) {
          this.ahora_form = false
          this.momento_form = false
        }
      },
    },
  },
  methods: {
    /**
     * true si el valor es la forma «momento concreto». La definición es una sola y vive en
     * `agendar_demo_momento.js`, compartida con el mixin que arma el paquete final.
     * @param {Object|null} value
     * @returns {boolean}
     */
    es_forma_momento(value) {
      return es_agendar_demo_momento(value)
    },
    /**
     * Texto legible de `dia`: los nombres fijos de la tabla, `<dia>_proximo` → «el lunes que
     * viene», `+N` → «en N días». Vacío si no hay nada que leer.
     * @param {string|null|undefined} dia
     * @returns {string}
     */
    texto_dia(dia) {
      if (dia == null || String(dia).trim() === '') {
        return ''
      }
      const clave = String(dia).trim().toLowerCase()
      if (DIAS_LEGIBLES[clave]) {
        return DIAS_LEGIBLES[clave]
      }
      const proximo = clave.match(/^([a-z]+)_proximo$/)
      if (proximo && DIAS_LEGIBLES[proximo[1]]) {
        return DIAS_LEGIBLES[proximo[1]] + ' que viene'
      }
      const mas = clave.match(/^\+(\d+)$/)
      if (mas) {
        return mas[1] === '1' ? 'en 1 día' : 'en ' + mas[1] + ' días'
      }
      return clave
    },
    /**
     * Prende o apaga la demo directa. Apagarla emite `null` (la acción se desactiva en el
     * paquete final); volver a prenderla restituye `{ ahora: true }`.
     * @param {boolean} checked estado nuevo del switch.
     * @returns {void}
     */
    on_toggle_ahora(checked) {
      this.$emit('update:value', checked ? { ahora: true } : null)
    },
    /**
     * Prende o apaga la demo directa para un momento concreto. Apagarla emite `null`; volver a
     * prenderla restituye EL MISMO objeto que llegó (`momento_original`), sin tocarlo.
     * @param {boolean} checked estado nuevo del switch.
     * @returns {void}
     */
    on_toggle_momento(checked) {
      this.$emit('update:value', checked ? this.momento_original : null)
    },
    /**
     * Cambia la demo elegida; resetea fecha/hora porque pertenecían a la demo anterior.
     * @param {string} raw_value id de demo elegido (string del <select>, '' = ninguna).
     * @returns {void}
     */
    on_change_demo(raw_value) {
      if (!raw_value) {
        this.$emit('update:value', null)
        return
      }
      this.$emit('update:value', { demo_id: parseInt(raw_value, 10), demo_date: '', demo_start_time: '' })
    },
    /**
     * Cambia la fecha elegida; resetea la hora porque pertenecía a la fecha anterior.
     * @param {string} raw_value fecha Y-m-d elegida.
     * @returns {void}
     */
    on_change_date(raw_value) {
      this.$emit('update:value', {
        demo_id: this.value && this.value.demo_id != null ? this.value.demo_id : null,
        demo_date: raw_value,
        demo_start_time: '',
      })
    },
    /**
     * Cambia la hora de inicio elegida.
     * @param {string} raw_value hora HH:MM elegida.
     * @returns {void}
     */
    on_change_time(raw_value) {
      this.$emit('update:value', {
        demo_id: this.value && this.value.demo_id != null ? this.value.demo_id : null,
        demo_date: this.demo_date,
        demo_start_time: raw_value,
      })
    },
  },
}
</script>

<style scoped>
.vp-row {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.vp-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: rgba(17, 27, 33, 0.55);
  margin: 0;
}
.vp-empty-hint {
  font-size: 0.75rem;
  color: rgba(17, 27, 33, 0.45);
  font-style: italic;
}
.vp-demo-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}
.vp-control {
  font-size: 0.8rem;
  min-width: 8.5rem;
  flex: 1 1 8.5rem;
}
.vp-end-time-hint {
  font-size: 0.72rem;
  color: rgba(17, 27, 33, 0.45);
  font-style: italic;
  white-space: nowrap;
}
.vp-force-slot {
  padding: 0.3rem 0.4rem;
  background: rgba(255, 193, 7, 0.12);
  border-radius: 6px;
}
.vp-force-slot-label {
  font-size: 0.75rem;
  color: #7a5c00;
}
/* Bloque compacto de la demo directa: reemplaza a la grilla de selects. */
.vp-ahora {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.3rem 0.4rem;
  background: rgba(37, 211, 102, 0.12);
  border-radius: 6px;
}
.vp-ahora-text {
  font-size: 0.75rem;
  color: rgba(17, 27, 33, 0.7);
}
/* Momento ilegible: el bloque pasa a ámbar (mismo tono que "forzar horario") porque avisa, no promete. */
.vp-ahora--ilegible {
  background: rgba(255, 193, 7, 0.12);
}
.vp-ahora--ilegible .vp-ahora-text {
  color: #7a5c00;
}
.vp-mail-toggle {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
</style>
