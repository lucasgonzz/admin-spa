<template>
  <div class="wa-message-stack wa-message-stack--out">
    <div class="wa-bubble-row wa-bubble-row--out">
      <div class="wa-bubble-shell wa-bubble-shell--out">
        <div
          class="wa-bubble wa-bubble--out"
          :class="{ 'wa-bubble--pending-error': status === 'error' }"
        >
          <div class="message-text">{{ content }}</div>
          <div class="wa-bubble-footer">
            <span
              v-if="status === 'sending'"
              class="wa-meta-sending"
              aria-label="Enviando"
            >
              <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
              Enviando…
            </span>
            <template v-else>
              <button
                type="button"
                class="btn btn-link p-0 wa-pending-action"
                title="Reintentar envío"
                aria-label="Reintentar envío"
                @click="$emit('retry')"
              >
                <i class="bi bi-arrow-clockwise" aria-hidden="true" />
              </button>
              <span class="wa-pending-error-text">No se pudo enviar</span>
              <button
                type="button"
                class="btn btn-link p-0 wa-pending-action"
                title="Descartar mensaje"
                aria-label="Descartar mensaje"
                @click="$emit('discard')"
              >
                <i class="bi bi-x-lg" aria-hidden="true" />
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * Burbuja de un mensaje saliente todavía no confirmado por el backend (envío optimista,
 * comportamiento tipo WhatsApp). Puramente presentacional: no hace ningún llamado a la API,
 * solo muestra el texto con un spinner mientras se envía, o un ícono de reintentar/descartar
 * si el POST falló. `LeadConversationView.vue` mantiene la lista de estos mensajes y decide
 * cuándo sacarlos (al confirmarse el envío, el mensaje real ya llega mezclado en
 * `sorted_messages` vía el store, y este componente deja de renderizarse para ese registro).
 */
export default {
  name: 'PendingOutgoingBubble',
  props: {
    /** Texto del mensaje tal cual lo escribió el admin. */
    content: {
      type: String,
      required: true,
    },
    /** 'sending' mientras el POST está en vuelo; 'error' si falló. */
    status: {
      type: String,
      required: true,
      validator: function (value) {
        return ['sending', 'error'].indexOf(value) !== -1
      },
    },
  },
  emits: ['retry', 'discard'],
}
</script>

<style scoped>
/*
  Copiado 1:1 de las clases equivalentes de MessageBubble.vue (ese archivo usa <style
  scoped>, así que sus reglas no se heredan a este componente). Si el estilo de las
  burbujas salientes cambia ahí, replicar el cambio acá también.
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
.wa-bubble--out::before {
  content: '';
  position: absolute;
  top: 0;
  right: -8px;
  width: 8px;
  height: 13px;
  background: linear-gradient(135deg, #d9fdd3 50%, transparent 50%);
}
.wa-bubble--pending-error {
  box-shadow: 0 1px 0.5px rgba(11, 20, 26, 0.13), inset 0 0 0 1px rgba(220, 53, 69, 0.35);
}
.message-text {
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: normal;
  padding-right: 0.15rem;
}
.wa-bubble-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: nowrap;
  gap: 3px;
  margin-top: 1px;
}
.wa-meta-sending {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.6875rem;
  font-style: italic;
  color: rgba(17, 27, 33, 0.45);
  animation: wa-sending-pulse 1.2s ease-in-out infinite;
}
@keyframes wa-sending-pulse {
  0%,
  100% {
    opacity: 0.45;
  }
  50% {
    opacity: 1;
  }
}
.wa-pending-error-text {
  font-size: 0.6875rem;
  color: #dc3545;
}
.wa-pending-action {
  font-size: 0.8rem;
  line-height: 1;
  color: #dc3545;
  text-decoration: none !important;
}
.wa-pending-action:hover {
  opacity: 0.75;
}
</style>
