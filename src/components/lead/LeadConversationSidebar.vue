<template>
  <transition name="sidebar-slide">
    <div
      v-if="visible"
      class="lead-sidebar"
      :style="{ width: sidebar_width_px + 'px' }"
    >
      <!-- Handle de resize: franja izquierda arrastrable para cambiar el ancho del panel -->
      <div
        class="lead-sidebar__resize-handle"
        @mousedown="on_resize_mousedown"
      />

      <!-- Header del sidebar: nombre del lead + botón cerrar -->
      <div class="lead-sidebar__header border-bottom d-flex align-items-center justify-content-between px-3 py-2">
        <span class="fw-semibold text-truncate small">
          <i class="bi bi-whatsapp text-success me-2" aria-hidden="true" />
          {{ lead_name }}
        </span>
        <!-- Botón para cerrar el sidebar; emite 'close' al padre -->
        <button
          type="button"
          class="lead-sidebar__close-btn"
          title="Cerrar conversación"
          aria-label="Cerrar conversación"
          @click="$emit('close')"
        >
          <i class="bi bi-x-lg" aria-hidden="true" />
        </button>
      </div>

      <!-- Cuerpo: contiene la vista de conversación embebida -->
      <div class="lead-sidebar__body">
        <!-- LeadConversationView en modo embebido (lead_record_prop activa is_sidebar_mode) -->
        <lead-conversation-view
          v-if="lead"
          :lead_record_prop="lead"
          @record-updated="on_record_updated"
        />
      </div>
    </div>
  </transition>
</template>

<script>
import LeadConversationView from '@/views/LeadConversationView.vue'

/**
 * Panel lateral deslizable que muestra la conversación WhatsApp de un lead
 * sin abandonar la vista de tabla de leads (solo desktop).
 *
 * El ancho es ajustable mediante drag en el borde izquierdo y se persiste
 * en localStorage. No muestra overlay oscuro; la tabla sigue visible.
 *
 * Props:
 *   lead {Object|null} - Lead a mostrar. null cierra el sidebar.
 *
 * Eventos:
 *   close          - El usuario hizo clic en el botón ×.
 *   record-updated - LeadConversationView actualizó el lead; propaga el modelo.
 */
export default {
  name: 'LeadConversationSidebar',

  components: { LeadConversationView },

  props: {
    /**
     * Lead actualmente abierto en el sidebar.
     * Si es null o undefined, el panel no se renderiza.
     * @type {Object|null}
     */
    lead: {
      type: Object,
      default: null,
    },
  },

  emits: ['close', 'record-updated'],

  data() {
    /* Leer el ancho persistido en localStorage; si no existe o no es válido, usar 440px. */
    var saved = parseInt(localStorage.getItem('lead_sidebar_width'), 10)
    return {
      /** Ancho actual del panel en píxeles (mín 300, máx 75vw). */
      sidebar_width_px: (!isNaN(saved) && saved >= 300) ? saved : 440,
      /** true mientras el usuario está arrastrando el handle de resize. */
      is_resizing: false,
      /** Posición X inicial del mouse cuando comenzó el drag de resize. */
      resize_start_x: 0,
      /** Ancho del panel al comenzar el drag de resize. */
      resize_start_width: 440,
    }
  },

  computed: {
    /**
     * Controla si el sidebar es visible.
     * El panel se renderiza solo cuando hay un lead asignado.
     * @returns {boolean}
     */
    visible() {
      return this.lead !== null && this.lead !== undefined
    },

    /**
     * Nombre a mostrar en el header del sidebar.
     * Prioriza contact_name; si está vacío, usa "Lead #ID".
     * @returns {string}
     */
    lead_name() {
      if (!this.lead) {
        return ''
      }
      var name = (this.lead.contact_name || '').trim()
      return name || 'Lead #' + this.lead.id
    },
  },

  mounted() {
    /* Registrar listeners de mousemove/mouseup en el document para capturar drag fuera del handle. */
    this._on_mousemove = this.on_resize_mousemove.bind(this)
    this._on_mouseup = this.on_resize_mouseup.bind(this)
    document.addEventListener('mousemove', this._on_mousemove)
    document.addEventListener('mouseup', this._on_mouseup)
  },

  beforeUnmount() {
    /* Limpiar listeners globales al desmontar para evitar memory leaks. */
    document.removeEventListener('mousemove', this._on_mousemove)
    document.removeEventListener('mouseup', this._on_mouseup)
  },

  methods: {
    /**
     * Inicia el drag de resize al presionar el handle izquierdo.
     * Guarda posición inicial y ancho de referencia para calcular el delta.
     * @param {MouseEvent} e Evento mousedown sobre el handle.
     * @returns {void}
     */
    on_resize_mousedown(e) {
      this.is_resizing = true
      this.resize_start_x = e.clientX
      this.resize_start_width = this.sidebar_width_px
      /* Cambiar cursor global durante el drag para feedback visual. */
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },

    /**
     * Actualiza el ancho del sidebar mientras el usuario arrastra el handle.
     * El sidebar está anclado a la derecha: mover el mouse a la izquierda aumenta el ancho.
     * @param {MouseEvent} e Evento mousemove del document.
     * @returns {void}
     */
    on_resize_mousemove(e) {
      if (!this.is_resizing) {
        return
      }
      /* Delta positivo cuando se mueve a la izquierda (agrandando el panel). */
      var delta = this.resize_start_x - e.clientX
      /* Ancho máximo: 75% del viewport. Mínimo: 300px. */
      var max_width = Math.floor(window.innerWidth * 0.75)
      var new_width = Math.min(Math.max(this.resize_start_width + delta, 300), max_width)
      this.sidebar_width_px = new_width
    },

    /**
     * Finaliza el drag de resize al soltar el mouse.
     * Restaura cursor global y persiste el ancho elegido en localStorage.
     * @returns {void}
     */
    on_resize_mouseup() {
      if (!this.is_resizing) {
        return
      }
      this.is_resizing = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      /* Persistir el ancho final para recordarlo entre sesiones. */
      localStorage.setItem('lead_sidebar_width', String(this.sidebar_width_px))
    },

    /**
     * Propaga el evento record-updated emitido por LeadConversationView al componente padre.
     * @param {Object} model Lead actualizado recibido desde la vista embebida.
     * @returns {void}
     */
    on_record_updated(model) {
      this.$emit('record-updated', model)
    },
  },
}
</script>

<style scoped>
/* Panel lateral fijo sobre el borde derecho de la pantalla */
.lead-sidebar {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  z-index: 1030;
  background: var(--bs-body-bg);
  border-left: 1px solid var(--bs-border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.10);
}

/* Handle de resize: franja izquierda invisible que se ilumina al hover */
.lead-sidebar__resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
  background: transparent;
  transition: background 0.15s;
}
.lead-sidebar__resize-handle:hover {
  background: rgba(var(--bs-primary-rgb), 0.15);
}

/* Header: fila superior con nombre del lead y botón cerrar */
.lead-sidebar__header {
  flex-shrink: 0;
  background: var(--bs-body-bg);
  min-height: 3rem;
}

/* Botón cerrar: círculo con ícono × */
.lead-sidebar__close-btn {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: none;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--bs-secondary-color);
  flex-shrink: 0;
  transition: background 0.15s;
}
.lead-sidebar__close-btn:hover {
  background: var(--bs-secondary-bg);
}

/* Cuerpo: ocupa el espacio restante debajo del header */
.lead-sidebar__body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Animación de entrada desde la derecha y salida hacia la derecha */
.sidebar-slide-enter-active,
.sidebar-slide-leave-active {
  transition: transform 0.22s ease;
}
.sidebar-slide-enter-from,
.sidebar-slide-leave-to {
  transform: translateX(100%);
}
</style>
