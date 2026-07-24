<template>
  <div class="vp-row">
    <label class="vp-label">Agendar demo</label>

    <!-- Sin demos disponibles: control deshabilitado con aviso breve. -->
    <div v-if="!demos.length" class="vp-empty-hint">Sin demos disponibles.</div>

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

      <!-- Mail 1 (acceso a la demo): solo tiene sentido si hay demo en el paquete. -->
      <div v-if="demo_id" class="form-check form-switch vp-mail-toggle">
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
          Enviar Mail 1 (acceso a la demo)
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

      <!-- Reenviar Mail 1: para leads con demo ya agendada que no recibieron el acceso. -->
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
          Reenviar Mail 1 (el lead dice que no le llegó)
        </label>
      </div>
    </template>
  </div>
</template>

<script>
/**
 * Control de agendamiento de demo dentro del panel de verificación (prompt 323).
 *
 * Selecciona demo (entorno) + fecha + hora de inicio a partir de la disponibilidad real
 * (`panel_availability_json`, prompt 321). La hora de fin no se edita acá: la calcula el
 * backend al aplicar el paquete. Si el slot elegido no está entre los libres, ofrece marcar
 * "forzar horario" para que el backend lo agende igual.
 */
export default {
  name: 'VerificationDemoScheduleControl',
  props: {
    /** Catálogo de demos disponibles: [{ demo_id, label }]. */
    demos: { type: Array, default: () => [] },
    /** Slots libres por demo: { [demo_id]: { 'Y-m-d': ['HH:MM', ...] } }. */
    slots: { type: Object, default: () => ({}) },
    /** Selección actual { demo_id, demo_date, demo_start_time } o null. */
    value: { type: Object, default: null },
    /** true si el admin marcó forzar el horario elegido aunque figure ocupado. */
    forzar_slot: { type: Boolean, default: false },
    /** true si se debe enviar el Mail 1 (acceso a la demo) al aprobar. */
    enviar_mail_demo: { type: Boolean, default: true },
    /** true si se debe reenviar el Mail 1 a un lead que ya tiene demo agendada. */
    reenviar_mail_demo: { type: Boolean, default: false },
    /** true si el paquete debe cancelar/reagendar una demo ya existente. */
    cancelar_demo: { type: Boolean, default: false },
    /** true mientras se envía el mensaje (bloquea todos los controles). */
    disabled: { type: Boolean, default: false },
  },
  emits: ['update:value', 'update:forzar_slot', 'update:enviar_mail_demo', 'update:reenviar_mail_demo', 'update:cancelar_demo'],
  computed: {
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
  methods: {
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
.vp-mail-toggle {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
</style>
