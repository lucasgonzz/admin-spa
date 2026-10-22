<template>
  <div
    class="lead-chat-row"
    :class="{
      'lead-chat-row--active': active,
      'lead-chat-row--rojo': row.atencion === 'rojo',
      'lead-chat-row--amarillo': row.atencion === 'amarillo',
      'lead-chat-row--unread': row.manually_marked_unread,
    }"
    role="listitem"
    tabindex="0"
    :aria-label="aria_label"
    @click="on_click"
    @keydown.enter.prevent="$emit('open', row)"
    @contextmenu.prevent="on_contextmenu"
    @touchstart.passive="on_touchstart"
    @touchend="on_touchend"
    @touchmove.passive="cancelar_long_press"
    @touchcancel="cancelar_long_press"
  >
    <!-- Semáforo en el borde izquierdo: rojo (error de envío o mensaje esperando confirmación),
         amarillo (el lead escribió y nadie le contestó), nada si está al día. -->
    <span class="lead-chat-row__atencion" :title="atencion_title" aria-hidden="true" />

    <!-- Avatar con la inicial, en el color del estado del pipeline. -->
    <span class="lead-chat-row__avatar" :style="avatar_style" aria-hidden="true">{{ inicial }}</span>

    <div class="lead-chat-row__body">
      <div class="lead-chat-row__line">
        <!-- El nombre es un botón aparte: abre la ficha (modal), no la conversación. stopPropagation
             para que el clic no llegue a la fila. -->
        <button
          type="button"
          class="lead-chat-row__name"
          :title="'Abrir la ficha de ' + nombre"
          @click.stop="on_name_click"
        >{{ nombre }}</button>
        <i
          v-if="row.pinned_at"
          class="bi bi-pin-angle-fill lead-chat-row__pin"
          title="Chat fijado"
          aria-label="Chat fijado"
        />
        <span class="lead-chat-row__time" :title="hora_completa">{{ hora }}</span>
      </div>
      <div class="lead-chat-row__line">
        <span class="lead-chat-row__preview" :class="{ 'lead-chat-row__preview--muted': !ultimo_mensaje }">
          <i v-if="tick" class="bi lead-chat-tick" :class="tick.clase" :title="tick.titulo" :aria-label="tick.titulo" />
          <span class="lead-chat-row__preview-text">{{ preview }}</span>
        </span>
        <span class="lead-chat-row__meta">
          <span
            v-if="row.manually_marked_unread"
            class="unread-dot-badge"
            title="Marcado como no leído"
            aria-label="Marcado como no leído"
          />
          <span class="lead-badge lead-chat-row__badge" :style="badge_style" :title="'Estado: ' + estado_texto">
            {{ estado_texto }}
          </span>
        </span>
      </div>
    </div>
  </div>
</template>

<script>
import moment from 'moment'

/** Gris de fallback cuando el catálogo no trae color para el estado (el mismo de las tarjetas). */
const COLOR_FALLBACK = '#ced4da'

/** Milisegundos que hay que mantener apretado para abrir el menú contextual en touch. */
const LONG_PRESS_MS = 500

/** Ventana en la que se ignora el clic de eco que sigue a un long-press; después se olvida. */
const IGNORAR_CLICK_ECO_MS = 700

/**
 * Texto legible (negro o blanco) sobre un fondo hex, por luminancia. Es la misma cuenta que hace
 * el renderizador `pipeline_status` de la grilla (`table/body/cell/Index.vue`), que no la exporta.
 *
 * @param {string} hex
 * @returns {string}
 */
function contraste_para_hex(hex) {
  const raw = String(hex || '').replace('#', '').trim()
  if (raw.length !== 6) {
    return '#212529'
  }
  const r = parseInt(raw.substring(0, 2), 16)
  const g = parseInt(raw.substring(2, 4), 16)
  const b = parseInt(raw.substring(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return '#212529'
  }
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminancia > 0.6 ? '#212529' : '#ffffff'
}

/**
 * Una fila de la lista de chats de leads, como en WhatsApp (misión flujo-lead-landing-closer,
 * 17/10/2026): avatar con inicial, nombre en negrita, hora, último mensaje con las tildes de
 * entrega si es nuestro, badge chico del estado, semáforo de atención, pin y punto de no leído
 * manual. SIN contador de no leídos (decisión de Lucas).
 *
 * No calcula nada que ya venga del servidor: `atencion`, `status_color`, `status_text` y el texto
 * del último mensaje llegan resueltos en la fila de GET /lead/chats (plan §4.1).
 *
 * Eventos:
 *   open        - clic o Enter sobre la fila: abrir la conversación.
 *   open-modal  - clic sobre el nombre: abrir la ficha del lead.
 *   context     - clic derecho o mantener apretado: `{ row, x, y }` para el menú contextual.
 */
export default {
  name: 'LeadChatRow',
  props: {
    /** Fila tal cual la devuelve GET /lead/chats. */
    row: { type: Object, required: true },
    /** true si es la conversación abierta en el sidebar: se resalta. */
    active: { type: Boolean, default: false },
  },
  emits: ['open', 'open-modal', 'context'],
  data() {
    return {
      /** Timer del long-press en touch. */
      long_press_timer: null,
      /** true cuando el long-press ya abrió el menú: el clic que sigue al soltar se ignora. */
      ignorar_proximo_click: false,
      /**
       * Timer que apaga `ignorar_proximo_click` solo (~700 ms). El clic de eco del long-press
       * casi siempre cae sobre la capa fija del menú (teleportada a body) y no sobre la fila,
       * así que la bandera no se consumiría nunca y el siguiente toque legítimo sobre esta fila
       * se perdería (hallazgo del chequeo, 17/10/2026). Se vuelve a limpiar también en touchstart.
       */
      ignorar_click_timer: null,
    }
  },
  computed: {
    /**
     * Nombre visible: contacto, o empresa, o teléfono, o el id.
     * @returns {string}
     */
    nombre() {
      const r = this.row
      const nombre = (r.contact_name || '').trim()
      if (nombre) {
        return nombre
      }
      const empresa = (r.company_name || '').trim()
      if (empresa) {
        return empresa
      }
      const telefono = (r.phone || '').trim()
      if (telefono) {
        return telefono
      }
      return 'Lead #' + r.id
    },
    /**
     * Inicial del avatar. Un teléfono o un nombre que arranca con número muestra "#".
     * @returns {string}
     */
    inicial() {
      const primera = this.nombre.trim().charAt(0)
      if (!primera || /\d/.test(primera)) {
        return '#'
      }
      return primera.toUpperCase()
    },
    /**
     * Color del estado del pipeline, del catálogo, con el gris de fallback.
     * @returns {string}
     */
    color() {
      return (this.row.status_color || '').trim() || COLOR_FALLBACK
    },
    /**
     * @returns {Object}
     */
    avatar_style() {
      return {
        backgroundColor: this.color,
        color: contraste_para_hex(this.color),
      }
    },
    /**
     * Mismo estilo que el badge `pipeline_status` de la grilla vieja: fondo del catálogo y texto
     * negro o blanco según luminancia.
     * @returns {Object}
     */
    badge_style() {
      const texto = contraste_para_hex(this.color)
      const alfa = texto === '#ffffff' ? '0.22' : '0.12'
      return {
        backgroundColor: this.color,
        color: texto,
        borderColor: texto === '#ffffff' ? 'rgba(255, 255, 255, ' + alfa + ')' : 'rgba(0, 0, 0, ' + alfa + ')',
      }
    },
    /**
     * @returns {string}
     */
    estado_texto() {
      return (this.row.status_text || this.row.status || '').toString()
    },
    /**
     * @returns {Object|null}
     */
    ultimo_mensaje() {
      return this.row.ultimo_mensaje || null
    },
    /**
     * Momento del último mensaje: el de la fila, o el del mensaje si la fila no lo trae.
     * @returns {string|null}
     */
    last_message_at() {
      if (this.row.last_message_at) {
        return this.row.last_message_at
      }
      if (this.ultimo_mensaje && this.ultimo_mensaje.created_at) {
        return this.ultimo_mensaje.created_at
      }
      return null
    },
    /**
     * Hora a la derecha, como WhatsApp: HH:mm si es de hoy, "ayer", DD/MM el resto (con el año
     * si no es el actual).
     * @returns {string}
     */
    hora() {
      if (!this.last_message_at) {
        return ''
      }
      const m = moment(this.last_message_at)
      if (!m.isValid()) {
        return ''
      }
      const ahora = moment()
      if (m.isSame(ahora, 'day')) {
        return m.format('HH:mm')
      }
      if (m.isSame(ahora.clone().subtract(1, 'day'), 'day')) {
        return 'ayer'
      }
      if (m.isSame(ahora, 'year')) {
        return m.format('DD/MM')
      }
      return m.format('DD/MM/YY')
    },
    /**
     * Tooltip de la hora con la fecha completa.
     * @returns {string}
     */
    hora_completa() {
      if (!this.last_message_at) {
        return ''
      }
      const m = moment(this.last_message_at)
      return m.isValid() ? m.format('DD/MM/YYYY HH:mm') : ''
    },
    /**
     * Segunda línea: el texto del último mensaje (ya recortado por el servidor a 120 caracteres,
     * con "📷 Foto" / "🎤 Audio" / "📄 Documento" si era un adjunto sin texto).
     * @returns {string}
     */
    preview() {
      if (!this.ultimo_mensaje) {
        return 'Sin mensajes todavía'
      }
      const texto = (this.ultimo_mensaje.texto || '').trim()
      return texto || '…'
    },
    /**
     * Tilde adelante del último mensaje, SOLO si es nuestro. Para los del lead no hay tilde.
     *
     * Misma lectura que `MessageBubble::whatsapp_check_state`: ✓ enviado, ✓✓ gris entregado,
     * ✓✓ azul leído, ⚠ fallido. Y además ⏳ para un `sugerido`: es un mensaje de la IA esperando
     * que alguien lo confirme, que es justo lo que el admin tiene que ver en la lista.
     *
     * 🔴 Dos cosas que NO se miran acá, a propósito (chequeo de la API, 17/10/2026):
     * - `ultimo_mensaje.is_error`: viene siempre `false`, porque los errores son eventos de estado
     *   y la lista los excluye del último mensaje. El rojo de la fila sale solo de `atencion`.
     * - `ultimo_mensaje.kind`: el servidor ya pone la etiqueta del adjunto adelante del `texto`
     *   («📷 Foto», «🎤 Audio …», «📄 Documento», «🎥 Video»), también cuando además hay texto;
     *   dibujar otro ícono acá a partir de `kind` lo mostraría doble.
     *
     * 🔴 El `fallido` de una campaña masiva NO va en rojo (misión campana-masiva-sin-rojo, 22/10/2026).
     * La API manda `ultimo_mensaje.entrega_fallida_cuenta`: en `false` es un rechazo de Meta de una
     * plantilla con `no_marca_error_de_entrega` (leads fríos, esperable, nada que hacer), y ahí va un
     * ícono neutro gris, igual que ya no lo pintan el badge ni `atencion`. Se compara con `=== false`
     * estricto a propósito: contra una API vieja el campo no viene (`undefined`) y tiene que quedar el
     * rojo de siempre. El banner y el tick rojos de adentro de la conversación (`MessageBubble`) siguen
     * igual: informan la entrega real con el hilo abierto y traen la acción «ya no recibe mensajes».
     *
     * @returns {{ clase: string, titulo: string }|null}
     */
    tick() {
      const m = this.ultimo_mensaje
      if (!m || m.sender === 'lead') {
        return null
      }
      if (m.status === 'sugerido') {
        return { clase: 'bi-hourglass-split lead-chat-tick--pendiente', titulo: 'Esperando confirmación' }
      }
      if (m.whatsapp_delivery_status === 'fallido') {
        if (m.entrega_fallida_cuenta === false) {
          return { clase: 'bi-dash-circle lead-chat-tick--enviado', titulo: 'No se entregó (envío masivo)' }
        }
        return { clase: 'bi-exclamation-circle lead-chat-tick--fallido', titulo: 'Falló el envío' }
      }
      if (m.whatsapp_delivery_status === 'leido') {
        return { clase: 'bi-check2-all lead-chat-tick--leido', titulo: 'Leído' }
      }
      if (m.whatsapp_delivery_status === 'entregado') {
        return { clase: 'bi-check2-all lead-chat-tick--entregado', titulo: 'Entregado' }
      }
      return { clase: 'bi-check2 lead-chat-tick--enviado', titulo: 'Enviado' }
    },
    /**
     * @returns {string}
     */
    atencion_title() {
      const motivo = this.row.atencion_motivo
      if (motivo === 'error_envio') {
        return 'Error de envío: hay un mensaje que no salió'
      }
      if (motivo === 'esperando_confirmacion') {
        return 'Hay un mensaje de la IA esperando tu confirmación'
      }
      if (motivo === 'sin_responder') {
        return 'El lead escribió y todavía no se le respondió'
      }
      return ''
    },
    /**
     * Para lectores de pantalla: nombre, estado y qué pasa con la fila.
     * @returns {string}
     */
    aria_label() {
      const partes = [this.nombre, this.estado_texto]
      if (this.atencion_title) {
        partes.push(this.atencion_title)
      }
      if (this.row.pinned_at) {
        partes.push('fijado')
      }
      return partes.join(', ')
    },
  },
  beforeUnmount() {
    this.cancelar_long_press()
    this.limpiar_ignorar_click()
  },
  methods: {
    /**
     * Apaga la bandera del clic de eco y su timer.
     */
    limpiar_ignorar_click() {
      this.ignorar_proximo_click = false
      if (this.ignorar_click_timer) {
        clearTimeout(this.ignorar_click_timer)
        this.ignorar_click_timer = null
      }
    },
    /**
     * Clic sobre la fila: abre la conversación, salvo que venga de soltar un long-press (en ese
     * caso el menú ya está abierto y el clic es el eco del touchend).
     */
    on_click() {
      if (this.ignorar_proximo_click) {
        this.limpiar_ignorar_click()
        return
      }
      this.$emit('open', this.row)
    },
    /**
     * Clic sobre el nombre: abre la ficha. El touchstart del long-press se escucha en la fila (el
     * evento burbujea desde el botón), así que si el dedo quedó apretado sobre el nombre el menú ya
     * se abrió y este clic es su eco: se consume la bandera y no se abre nada más.
     */
    on_name_click() {
      if (this.ignorar_proximo_click) {
        this.limpiar_ignorar_click()
        return
      }
      this.$emit('open-modal', this.row)
    },
    /**
     * Clic derecho (escritorio).
     * @param {MouseEvent} event
     */
    on_contextmenu(event) {
      this.$emit('context', { row: this.row, x: event.clientX, y: event.clientY })
    },
    /**
     * Arranca el reloj del long-press. Se cancela si el dedo se mueve (scroll) o se levanta antes.
     * @param {TouchEvent} event
     */
    on_touchstart(event) {
      this.cancelar_long_press()
      /* Un toque nuevo arranca limpio: si quedó una bandera de un long-press anterior cuyo eco
         nunca llegó a la fila, no tiene que comerse este toque. */
      this.limpiar_ignorar_click()
      const touch = event.touches && event.touches[0]
      if (!touch) {
        return
      }
      const x = touch.clientX
      const y = touch.clientY
      const self = this
      this.long_press_timer = setTimeout(function () {
        self.long_press_timer = null
        self.ignorar_proximo_click = true
        /* Y si el eco no cae acá (lo normal: cae sobre la capa del menú), la bandera se apaga
           sola enseguida. */
        self.ignorar_click_timer = setTimeout(function () {
          self.ignorar_proximo_click = false
          self.ignorar_click_timer = null
        }, IGNORAR_CLICK_ECO_MS)
        self.$emit('context', { row: self.row, x: x, y: y })
      }, LONG_PRESS_MS)
    },
    /**
     * Soltar antes de los 500 ms: no es long-press, el clic sigue su curso normal.
     */
    on_touchend() {
      if (this.long_press_timer) {
        this.cancelar_long_press()
      }
    },
    /**
     * Mover el dedo o cancelar el toque corta el long-press.
     */
    cancelar_long_press() {
      if (this.long_press_timer) {
        clearTimeout(this.long_press_timer)
        this.long_press_timer = null
      }
    },
  },
}
</script>

<style scoped>
.lead-chat-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem 0.6rem 0.9rem;
  border-bottom: 1px solid var(--bs-border-color-translucent, rgba(0, 0, 0, 0.08));
  background: #fff;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  transition: background-color 0.12s ease;
}

.lead-chat-row:hover {
  background: var(--bs-tertiary-bg, #f5f6f6);
}

.lead-chat-row:focus-visible {
  outline: 2px solid var(--bs-primary);
  outline-offset: -2px;
}

/* La conversación abierta en el sidebar: mismo verde suave que tenía la fila de la grilla. */
.lead-chat-row--active {
  background: var(--bs-success-bg-subtle);
}

.lead-chat-row--active:hover {
  background: var(--bs-success-border-subtle);
}

/* Semáforo: una franja en el borde izquierdo, visible sin tapar el avatar. */
.lead-chat-row__atencion {
  position: absolute;
  left: 0;
  top: 0.5rem;
  bottom: 0.5rem;
  width: 4px;
  border-radius: 0 3px 3px 0;
  background: transparent;
}

.lead-chat-row--rojo .lead-chat-row__atencion {
  background: #dc3545;
}

.lead-chat-row--amarillo .lead-chat-row__atencion {
  background: #f1b400;
}

.lead-chat-row__avatar {
  flex: 0 0 auto;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 0;
}

.lead-chat-row__body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.lead-chat-row__line {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

/* El nombre es un botón sin cromo: se ve como texto en negrita y se trunca antes que la hora. */
.lead-chat-row__name {
  flex: 0 1 auto;
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--bs-body-color);
  font-weight: 600;
  font-size: 0.95rem;
  line-height: 1.25;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.lead-chat-row__name:hover {
  color: var(--bs-primary);
  text-decoration: underline;
}

.lead-chat-row__name:focus-visible {
  outline: 2px solid var(--bs-primary);
  outline-offset: 2px;
  border-radius: 2px;
}

.lead-chat-row__pin {
  flex: 0 0 auto;
  color: var(--bs-secondary-color);
  font-size: 0.8rem;
}

.lead-chat-row__time {
  flex: 0 0 auto;
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--bs-secondary-color);
  white-space: nowrap;
}

.lead-chat-row--unread .lead-chat-row__time,
.lead-chat-row--amarillo .lead-chat-row__time {
  color: #1fa855;
  font-weight: 600;
}

.lead-chat-row__preview {
  flex: 1 1 auto;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.85rem;
  color: var(--bs-secondary-color);
}

.lead-chat-row__preview--muted {
  font-style: italic;
}

.lead-chat-row__preview-text {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lead-chat-row__meta {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

/* Badge chico: más corto que el de la grilla, para que entre al lado del texto en 360px. */
.lead-chat-row__badge {
  font-size: 0.66rem;
  min-height: 1.25rem;
  padding: 0.22em 0.5em;
  max-width: 9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
  line-height: 1.25;
}

/* Tildes: los mismos colores que las burbujas de la conversación. */
.lead-chat-tick {
  flex: 0 0 auto;
  font-size: 0.95rem;
  line-height: 1;
}

.lead-chat-tick--enviado,
.lead-chat-tick--entregado {
  color: #8696a0;
}

.lead-chat-tick--leido {
  color: #53bdeb;
}

.lead-chat-tick--fallido {
  color: #dc3545;
}

.lead-chat-tick--pendiente {
  color: #e67e22;
  font-size: 0.8rem;
}

@media (max-width: 575.98px) {
  .lead-chat-row {
    padding: 0.55rem 0.6rem 0.55rem 0.8rem;
    gap: 0.6rem;
  }

  .lead-chat-row__avatar {
    width: 2.5rem;
    height: 2.5rem;
    font-size: 1rem;
  }

  .lead-chat-row__badge {
    max-width: 6.5rem;
  }
}
</style>
