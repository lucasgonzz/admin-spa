<template>
  <teleport to="body">
    <div
      v-if="visible && row"
      class="lead-chat-menu-layer"
      :class="{ 'lead-chat-menu-layer--sheet': es_hoja }"
      @pointerdown.self="$emit('close')"
    >
      <div
        ref="menu"
        class="lead-chat-menu"
        :class="{ 'lead-chat-menu--sheet': es_hoja }"
        :style="estilo_posicion"
        role="menu"
        :aria-label="'Acciones sobre ' + nombre"
      >
        <!-- En la hoja de teléfono se repite el nombre: el dedo tapa la fila que se apretó. -->
        <div v-if="es_hoja" class="lead-chat-menu__title">{{ nombre }}</div>
        <button type="button" class="lead-chat-menu__item" role="menuitem" @click="$emit('pin', row)">
          <i class="bi" :class="row.pinned_at ? 'bi-pin-angle' : 'bi-pin-angle-fill'" aria-hidden="true" />
          {{ row.pinned_at ? 'Desfijar' : 'Fijar' }}
        </button>
        <!--
          «Marcar como leído» (22/10/2026): solo en los chats con un mensaje del lead sin responder
          (los del borde amarillo). Da el mensaje por atendido, o sea que deja de estar amarillo y de
          contar en «sin responder», hasta que el lead escriba de nuevo. En esos chats reemplaza al
          «no leído» manual de abajo: los dos se llamarían igual y este también limpia aquella marca.
        -->
        <button
          v-if="puede_marcar_leido"
          type="button"
          class="lead-chat-menu__item"
          role="menuitem"
          title="Da por atendido el último mensaje del lead, sin mandarle nada. Vale para todos los admins y la IA deja de sugerir respuesta a ese mensaje. Se deshace desde la conversación."
          @click="$emit('leido', row)"
        >
          <i class="bi bi-check2-all" aria-hidden="true" />
          Marcar como leído
        </button>
        <button v-else type="button" class="lead-chat-menu__item" role="menuitem" @click="$emit('unread', row)">
          <i class="bi" :class="row.manually_marked_unread ? 'bi-envelope-open' : 'bi-envelope'" aria-hidden="true" />
          {{ row.manually_marked_unread ? 'Marcar como leído' : 'Marcar como no leído' }}
        </button>
        <button type="button" class="lead-chat-menu__item" role="menuitem" @click="$emit('perfil', row)">
          <i class="bi bi-person-lines-fill" aria-hidden="true" />
          Ver perfil
        </button>
        <button v-if="es_hoja" type="button" class="lead-chat-menu__item lead-chat-menu__item--cancel" role="menuitem" @click="$emit('close')">
          Cancelar
        </button>
      </div>
    </div>
  </teleport>
</template>

<script>
/** Debajo de este ancho el menú sale como hoja al pie, como los menús de WhatsApp en el teléfono. */
const ANCHO_HOJA = 576

/**
 * Menú contextual de una fila de chat (misión flujo-lead-landing-closer, 17/10/2026): Fijar /
 * Desfijar, Marcar como no leído / leído y Ver perfil. Lo abre el clic derecho o mantener apretado
 * (ver `ChatRow.vue`); se cierra con Escape, tocando afuera, al scrollear o al redimensionar.
 *
 * Solo pinta y avisa: las acciones las ejecuta el padre (`chats/Index.vue`), que es el que tiene el
 * store y sabe cerrar el menú después.
 *
 * En escritorio es un menú flotante anclado al puntero, acotado al viewport; en teléfono (<576 px)
 * es una hoja al pie con un telón, porque un menú de 10 rem pegado al dedo queda tapado por la
 * mano y es fácil tocar la fila de al lado al soltar.
 */
export default {
  name: 'LeadChatContextMenu',
  props: {
    visible: { type: Boolean, default: false },
    /** Coordenadas del puntero (clientX / clientY) donde se pidió el menú. */
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    /** Fila sobre la que se opera. */
    row: { type: Object, default: null },
  },
  emits: ['close', 'pin', 'unread', 'leido', 'perfil'],
  data() {
    return {
      /** Posición ya acotada al viewport (se recalcula al abrir, midiendo el menú real). */
      left_px: 0,
      top_px: 0,
      /** true = hoja al pie (teléfono). Se decide al abrir, no en cada render. */
      es_hoja: false,
    }
  },
  computed: {
    /**
     * true si el chat tiene un mensaje del lead sin responder que «Marcar como leído» puede dar por
     * atendido. Usa `mensaje_sin_responder` del servidor; con un admin-api anterior al 22/10/2026
     * (sin esa clave) cae al amarillo de la fila.
     *
     * @returns {boolean}
     */
    puede_marcar_leido() {
      const r = this.row || {}
      if (typeof r.mensaje_sin_responder === 'boolean') {
        return r.mensaje_sin_responder
      }
      return r.atencion === 'amarillo' && r.atencion_motivo === 'sin_responder'
    },
    /**
     * @returns {string}
     */
    nombre() {
      const r = this.row || {}
      return (r.contact_name || r.company_name || r.phone || ('Lead #' + r.id) || '').toString().trim()
    },
    /**
     * @returns {Object}
     */
    estilo_posicion() {
      if (this.es_hoja) {
        return {}
      }
      return { left: this.left_px + 'px', top: this.top_px + 'px' }
    },
  },
  watch: {
    /**
     * Al abrir se engancha a document y se acomoda; al cerrar se suelta todo.
     * @param {boolean} abierto
     */
    visible(abierto) {
      if (abierto) {
        this.abrir()
      } else {
        this.soltar_listeners()
      }
    },
  },
  mounted() {
    if (this.visible) {
      this.abrir()
    }
  },
  beforeUnmount() {
    this.soltar_listeners()
  },
  methods: {
    /**
     * Decide hoja o flotante, posiciona y escucha Escape, scroll y resize del documento.
     */
    abrir() {
      this.es_hoja = typeof window !== 'undefined' && window.innerWidth < ANCHO_HOJA
      this.left_px = this.x
      this.top_px = this.y
      const self = this
      this.$nextTick(function () {
        self.acotar_al_viewport()
        self.enfocar_primer_item()
      })
      this._on_keydown = function (e) {
        if (e.key === 'Escape') {
          self.$emit('close')
        }
      }
      this._on_cerrar = function () {
        self.$emit('close')
      }
      document.addEventListener('keydown', this._on_keydown)
      /* `true` (captura): el scroll de un contenedor interno no burbujea hasta document. */
      document.addEventListener('scroll', this._on_cerrar, true)
      window.addEventListener('resize', this._on_cerrar)
    },
    /**
     * Suelta los listeners globales (al cerrar y al desmontar).
     */
    soltar_listeners() {
      if (this._on_keydown) {
        document.removeEventListener('keydown', this._on_keydown)
        this._on_keydown = null
      }
      if (this._on_cerrar) {
        document.removeEventListener('scroll', this._on_cerrar, true)
        window.removeEventListener('resize', this._on_cerrar)
        this._on_cerrar = null
      }
    },
    /**
     * El menú flotante no se sale de la pantalla: si no entra a la derecha o abajo del puntero, se
     * corre para adentro con 8 px de margen.
     */
    acotar_al_viewport() {
      if (this.es_hoja) {
        return
      }
      const el = this.$refs.menu
      if (!el) {
        return
      }
      const ancho = el.offsetWidth || 180
      const alto = el.offsetHeight || 120
      const margen = 8
      this.left_px = Math.max(margen, Math.min(this.x, window.innerWidth - ancho - margen))
      this.top_px = Math.max(margen, Math.min(this.y, window.innerHeight - alto - margen))
    },
    /**
     * Teclado: el foco entra al primer ítem para que Tab y Enter sirvan sin el mouse.
     */
    enfocar_primer_item() {
      const el = this.$refs.menu
      if (!el) {
        return
      }
      const primero = el.querySelector('.lead-chat-menu__item')
      if (primero && typeof primero.focus === 'function') {
        primero.focus({ preventScroll: true })
      }
    },
  },
}
</script>

<style scoped>
/* Capa que cubre la pantalla para capturar el "tocar afuera". Transparente en escritorio: el menú
   flota sobre la lista sin oscurecer nada, como el menú nativo del navegador. */
.lead-chat-menu-layer {
  position: fixed;
  inset: 0;
  z-index: 1045;
  background: transparent;
}

.lead-chat-menu {
  position: fixed;
  min-width: 11.5rem;
  padding: 0.3rem;
  border-radius: 0.6rem;
  background: #fff;
  border: 1px solid var(--bs-border-color);
  box-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.16);
  display: flex;
  flex-direction: column;
}

.lead-chat-menu__item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 0.45rem;
  background: transparent;
  color: var(--bs-body-color);
  font-size: 0.9rem;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
}

.lead-chat-menu__item .bi {
  width: 1.1rem;
  text-align: center;
  color: var(--bs-secondary-color);
}

.lead-chat-menu__item:hover,
.lead-chat-menu__item:focus-visible {
  background: var(--bs-tertiary-bg, #f0f2f5);
  outline: none;
}

/* Hoja al pie (teléfono): telón oscuro, ancho completo, ítems más altos para el dedo. */
.lead-chat-menu-layer--sheet {
  background: rgba(0, 0, 0, 0.35);
}

.lead-chat-menu--sheet {
  left: 0;
  right: 0;
  bottom: 0;
  min-width: 0;
  border-radius: 1rem 1rem 0 0;
  border: none;
  padding: 0.5rem 0.75rem calc(0.75rem + env(safe-area-inset-bottom, 0px));
  animation: lead-chat-menu-subir 0.18s ease-out;
}

.lead-chat-menu--sheet .lead-chat-menu__item {
  padding: 0.85rem 0.75rem;
  font-size: 1rem;
}

.lead-chat-menu__title {
  padding: 0.35rem 0.75rem 0.5rem;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--bs-secondary-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-bottom: 1px solid var(--bs-border-color-translucent, rgba(0, 0, 0, 0.08));
  margin-bottom: 0.25rem;
}

.lead-chat-menu__item--cancel {
  justify-content: center;
  margin-top: 0.25rem;
  color: var(--bs-secondary-color);
  border-top: 1px solid var(--bs-border-color-translucent, rgba(0, 0, 0, 0.08));
  border-radius: 0;
}

@keyframes lead-chat-menu-subir {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}
</style>
