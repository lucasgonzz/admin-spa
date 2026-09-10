<template>
  <div class="wa-message-stack wa-message-stack--out">
    <div class="wa-bubble-row wa-bubble-row--out">
      <div class="wa-bubble-shell wa-bubble-shell--out">
        <div
          class="wa-bubble wa-bubble--out wa-bubble--scheduled"
          :class="{ 'wa-bubble--scheduled-error': is_error }"
        >

          <!-- Encabezado: deja claro de una que el mensaje TODAVÍA no salió -->
          <div class="wa-scheduled-head">
            <i
              v-if="is_sending"
              class="spinner-border spinner-border-sm wa-scheduled-head-spinner"
              role="status"
              aria-hidden="true"
            />
            <i
              v-else
              class="bi"
              :class="is_error ? 'bi-exclamation-triangle-fill' : 'bi-clock'"
              aria-hidden="true"
            />
            <span>{{ head_label }}</span>
          </div>

          <div class="message-text">{{ scheduled.content }}</div>

          <!-- Distintivos: plantilla usada y check de cancelación por respuesta del lead -->
          <div v-if="is_template || cancel_if_lead_replies" class="wa-scheduled-chips">
            <span v-if="is_template" class="wa-scheduled-chip">
              <i class="bi bi-file-earmark-text" aria-hidden="true" />
              {{ scheduled.template_name }}
            </span>
            <span v-if="cancel_if_lead_replies" class="wa-scheduled-chip">
              <i class="bi bi-slash-circle" aria-hidden="true" />
              Se cancela si el lead responde
            </span>
          </div>

          <!-- Texto del error del backend cuando el despacho falló -->
          <div v-if="is_error && scheduled.error_text" class="wa-scheduled-error-text">
            {{ scheduled.error_text }}
          </div>

          <!-- Aviso en vivo: el lead escribió después de que se programó este mensaje -->
          <div
            v-if="!is_error && lead_replied_after"
            class="wa-scheduled-notice"
            :class="cancel_if_lead_replies ? 'wa-scheduled-notice--cancel' : 'wa-scheduled-notice--warn'"
          >
            <i class="bi bi-info-circle" aria-hidden="true" />
            <span v-if="cancel_if_lead_replies">
              El lead escribió después de programarlo: este mensaje no se va a enviar.
            </span>
            <span v-else>
              El lead escribió después de programarlo y este mensaje igual va a salir.
            </span>
          </div>

          <!-- Pie: fecha programada a la izquierda, acciones a la derecha -->
          <div class="wa-scheduled-footer">
            <span class="wa-scheduled-when">
              <i class="bi bi-send-plus" aria-hidden="true" />
              {{ schedule_label }}
            </span>
            <span class="wa-scheduled-actions">
              <span
                v-if="busy"
                class="spinner-border spinner-border-sm wa-scheduled-spinner"
                role="status"
                aria-hidden="true"
              />
              <!-- Mientras se está mandando no se ofrece ni editar ni cancelar: el backend los
                   rechaza con 422 porque el envío ya está en vuelo, y un botón que sólo puede
                   fallar es peor que ningún botón. -->
              <template v-else-if="!is_sending">
                <!-- 🔴 En `error` TAMBIÉN se puede editar, y es el caso que más se va a usar: el
                     mensaje quedó sin salir porque se cerró la ventana, y lo natural es corregirle
                     la fecha o pasarlo a plantilla, no copiar el texto a mano y empezar de cero.
                     Al guardar vuelve a `pendiente` y el comando lo levanta como cualquier otro. -->
                <button
                  type="button"
                  class="btn btn-link p-0 wa-scheduled-action"
                  :title="is_error ? 'Corregir y volver a programar' : 'Editar el mensaje programado'"
                  :aria-label="is_error ? 'Corregir y volver a programar' : 'Editar el mensaje programado'"
                  @click="$emit('editar')"
                >
                  <i class="bi bi-pencil" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="btn btn-link p-0 wa-scheduled-action wa-scheduled-action--danger"
                  :title="is_error ? 'Descartar el mensaje programado' : 'Cancelar el envío programado'"
                  :aria-label="is_error ? 'Descartar el mensaje programado' : 'Cancelar el envío programado'"
                  @click="$emit('cancelar')"
                >
                  <i class="bi bi-x-lg" aria-hidden="true" />
                </button>
              </template>
            </span>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * Burbuja de un mensaje de WhatsApp PROGRAMADO para salir más adelante (tabla
 * `lead_scheduled_messages` de admin-api, expuesta en `lead.scheduled_messages`).
 *
 * Puramente presentacional, igual que `PendingOutgoingBubble.vue`: no hace ningún llamado
 * a la API, solo emite `editar` y `cancelar` para que `LeadConversationView.vue` resuelva.
 * Cuando el programado efectivamente sale, el backend lo saca de `scheduled_messages` y
 * crea el `LeadMessage` real, así que esta burbuja desaparece sola y en su lugar queda el
 * mensaje enviado normal — sin código extra de por medio.
 *
 * Se distingue a propósito de un mensaje ya enviado: borde punteado, fondo apagado y reloj.
 */

/**
 * Dos dígitos con cero adelante.
 *
 * @param {number} n
 * @returns {string}
 */
function pad_two(n) {
  return n < 10 ? '0' + n : String(n)
}

/**
 * Etiqueta legible en rioplatense de cuándo sale el mensaje ("Se envía mañana a las 16:00",
 * "Se envía el jueves 18/9 a las 09:30").
 *
 * Espeja el criterio de `src/mixins/lead_conversation_date_dividers.js` (Hoy / Ayer / nombre
 * del día dentro de la semana / fecha completa) pero mirando hacia ADELANTE, que es lo que
 * el mixin no cubre: ahí todas las fechas son pasadas. Si el criterio de los divisores del
 * hilo cambia, conviene replicarlo acá para que la conversación hable un solo idioma.
 *
 * @param {string} raw fecha ISO 8601 del envío programado
 * @param {number} now_ms momento actual en milisegundos
 * @returns {string}
 */
function build_schedule_label(raw, now_ms) {
  const at = new Date(raw)
  if (isNaN(at.getTime())) {
    return ''
  }

  /* Medianoche del día programado y del día de hoy, para contar días enteros de distancia. */
  const at_midnight = new Date(at.getTime())
  at_midnight.setHours(0, 0, 0, 0)
  const today = new Date(now_ms)
  today.setHours(0, 0, 0, 0)

  const diff_days = Math.round((at_midnight - today) / 86400000)
  const time = pad_two(at.getHours()) + ':' + pad_two(at.getMinutes())

  /* La hora ya pasó y el despacho todavía no corrió: decirlo, no fingir que está por salir. */
  if (at.getTime() <= now_ms) {
    if (diff_days === 0) {
      return 'Debía enviarse hoy a las ' + time
    }
    return 'Debía enviarse el ' + at.toLocaleDateString('es-AR') + ' a las ' + time
  }

  if (diff_days === 0) {
    return 'Se envía hoy a las ' + time
  }
  if (diff_days === 1) {
    return 'Se envía mañana a las ' + time
  }
  if (diff_days >= 2 && diff_days <= 6) {
    const name = at.toLocaleDateString('es-AR', { weekday: 'long' })
    return 'Se envía el ' + name + ' ' + at.getDate() + '/' + (at.getMonth() + 1) + ' a las ' + time
  }
  return 'Se envía el ' + at.toLocaleDateString('es-AR') + ' a las ' + time
}

export default {
  name: 'ScheduledMessageBubble',

  props: {
    /** Fila de `lead.scheduled_messages` tal cual la devuelve admin-api. */
    scheduled: {
      type: Object,
      required: true,
    },
    /**
     * Id del último mensaje del lead que hay en el hilo. Se compara contra
     * `baseline_lead_message_id` para avisar en vivo que el lead ya escribió después de
     * programar. Por id y no por fecha: `created_at` no tiene fracción de segundo y un
     * empate da el resultado al revés.
     */
    last_lead_message_id: {
      type: Number,
      default: 0,
    },
    /** true mientras corre la cancelación de este programado (bloquea los botones). */
    busy: {
      type: Boolean,
      default: false,
    },
    /**
     * Momento actual en milisegundos, provisto por la vista para que la etiqueta de fecha
     * se refresque con el paso del tiempo sin montar otro reloj acá. 0 = usar Date.now().
     */
    now_ms: {
      type: Number,
      default: 0,
    },
  },

  emits: ['editar', 'cancelar'],

  computed: {
    /**
     * true si el despacho ya falló: el mensaje no se va a enviar.
     *
     * @returns {boolean}
     */
    is_error() {
      return this.scheduled.status === 'error'
    },

    /**
     * true si una corrida del despacho lo tomó y lo está mandando en este momento.
     *
     * Es un estado de segundos, pero se muestra: es lo que explica por qué desaparecieron los
     * botones de editar y cancelar, que en ese momento el backend rechaza.
     *
     * @returns {boolean}
     */
    is_sending() {
      return this.scheduled.status === 'enviando'
    },

    /**
     * Encabezado de la burbuja según el estado.
     *
     * @returns {string}
     */
    head_label() {
      if (this.is_error) {
        return 'No se pudo enviar'
      }
      if (this.is_sending) {
        return 'Enviándose ahora…'
      }
      return 'Programado — todavía no se envió'
    },

    /**
     * true si el envío programado usa una plantilla aprobada de Meta.
     *
     * @returns {boolean}
     */
    is_template() {
      return this.scheduled.mode === 'plantilla' && Boolean(this.scheduled.template_name)
    },

    /**
     * true si el programado tiene prendido el check "cancelar si el lead responde antes".
     *
     * @returns {boolean}
     */
    cancel_if_lead_replies() {
      return Boolean(this.scheduled.cancel_if_lead_replies)
    },

    /**
     * true si el lead escribió algún mensaje después de que se programó éste.
     *
     * @returns {boolean}
     */
    lead_replied_after() {
      const baseline = parseInt(this.scheduled.baseline_lead_message_id, 10)
      const last = parseInt(this.last_lead_message_id, 10)
      if (isNaN(last) || last <= 0) {
        return false
      }
      /* Sin baseline no había ningún mensaje del lead al programar: cualquiera es posterior. */
      return isNaN(baseline) ? true : last > baseline
    },

    /**
     * Texto de cuándo sale el mensaje.
     *
     * @returns {string}
     */
    schedule_label() {
      return build_schedule_label(
        this.scheduled.scheduled_send_at,
        this.now_ms ? this.now_ms : Date.now()
      )
    },
  },
}
</script>

<style scoped>
/*
  Estructura y burbuja saliente copiadas de PendingOutgoingBubble.vue, que a su vez las copió
  1:1 de MessageBubble.vue (los tres usan <style scoped>, así que las reglas no se heredan).
  Si el estilo de las burbujas salientes cambia en MessageBubble.vue, hay que replicarlo acá.
  Lo propio de este componente son las clases wa-bubble--scheduled y wa-scheduled-*.
*/
.wa-message-stack {
  display: flex;
  flex-direction: column;
  max-width: 80%;
  width: fit-content;
}
.wa-message-stack--out {
  align-self: flex-end;
  align-items: flex-end;
}
.wa-bubble-row {
  display: flex;
  flex-direction: column;
  max-width: 100%;
  width: fit-content;
}
.wa-bubble-row--out {
  align-self: flex-end;
  align-items: flex-end;
}
.wa-bubble-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  width: fit-content;
  max-width: 100%;
}
.wa-bubble-shell--out {
  align-items: flex-end;
}
.wa-bubble {
  position: relative;
  display: inline-block;
  vertical-align: top;
  width: auto;
  max-width: 100%;
  font-size: 0.9375rem;
  line-height: 1.35;
  padding: 0.35rem 0.45rem 0.2rem 0.55rem;
  border: none;
  box-shadow: 0 1px 0.5px rgba(11, 20, 26, 0.13);
  color: #111b21;
}
.wa-bubble--out {
  background: #d9fdd3;
  border-radius: 7.5px 0 7.5px 7.5px;
}

/*
  Un programado NO es un mensaje enviado: el verde va apagado, el borde es punteado y no
  lleva la colita de la burbuja saliente (por eso no se copia la regla ::before de
  MessageBubble/PendingOutgoingBubble). De un vistazo tiene que leerse como "esto todavía
  no salió", sin necesidad de leer el texto del pie.
*/
.wa-bubble--scheduled {
  background: rgba(217, 253, 211, 0.45);
  border: 1px dashed rgba(17, 27, 33, 0.35);
  border-radius: 7.5px;
  box-shadow: none;
  padding: 0.4rem 0.55rem 0.3rem 0.55rem;
  min-width: 13rem;
}
.wa-bubble--scheduled-error {
  background: rgba(220, 53, 69, 0.06);
  border-color: rgba(220, 53, 69, 0.5);
}

/* Encabezado con el reloj: la primera lectura de la burbuja */
.wa-scheduled-head {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: rgba(17, 27, 33, 0.55);
  margin-bottom: 0.2rem;
}
.wa-bubble--scheduled-error .wa-scheduled-head {
  color: #dc3545;
}

.message-text {
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: normal;
  padding-right: 0.15rem;
  color: rgba(17, 27, 33, 0.75);
}

/* Chips de plantilla y de cancelación automática */
.wa-scheduled-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.3rem;
}
.wa-scheduled-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.6875rem;
  line-height: 1.2;
  padding: 0.1rem 0.4rem;
  border-radius: 2rem;
  background: rgba(17, 27, 33, 0.07);
  color: rgba(17, 27, 33, 0.6);
}

.wa-scheduled-error-text {
  margin-top: 0.3rem;
  font-size: 0.75rem;
  color: #dc3545;
  white-space: pre-wrap;
  overflow-wrap: break-word;
}

/* Aviso de que el lead escribió después de programar */
.wa-scheduled-notice {
  display: flex;
  align-items: flex-start;
  gap: 0.3rem;
  margin-top: 0.35rem;
  font-size: 0.7rem;
  line-height: 1.25;
  padding: 0.25rem 0.4rem;
  border-radius: 0.3rem;
}
.wa-scheduled-notice--warn {
  background: rgba(255, 193, 7, 0.18);
  color: #7a5b00;
}
.wa-scheduled-notice--cancel {
  background: rgba(17, 27, 33, 0.07);
  color: rgba(17, 27, 33, 0.6);
}

/* Pie: cuándo sale + acciones */
.wa-scheduled-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-top: 0.3rem;
}
.wa-scheduled-when {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: rgba(17, 27, 33, 0.55);
}
.wa-bubble--scheduled-error .wa-scheduled-when {
  color: #dc3545;
}
.wa-scheduled-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}
.wa-scheduled-action {
  font-size: 0.8rem;
  line-height: 1;
  color: rgba(17, 27, 33, 0.55);
  text-decoration: none !important;
}
.wa-scheduled-action:hover {
  color: #111b21;
}
.wa-scheduled-action--danger {
  color: #dc3545;
}
.wa-scheduled-action--danger:hover {
  color: #a71d2a;
}
.wa-scheduled-spinner {
  width: 0.8rem;
  height: 0.8rem;
  color: rgba(17, 27, 33, 0.55);
}
</style>
