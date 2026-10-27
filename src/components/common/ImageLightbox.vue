<template>
  <teleport to="body">
    <div
      v-if="show"
      class="support-image-lightbox"
      :class="{ 'support-image-lightbox--zoom': zoom_enabled }"
      ref="dialog"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-label="Imagen ampliada"
      @click.self="close"
      @keydown="on_keydown">
      <button
        type="button"
        class="support-image-lightbox-close"
        aria-label="Cerrar"
        title="Cerrar"
        @click="close">
        <i class="bi bi-x-lg"></i>
      </button>
      <div v-if="zoom_enabled" class="support-image-lightbox-toolbar" role="group" aria-label="Zoom de imagen">
        <button type="button" aria-label="Alejar imagen" :disabled="zoom <= 1" @click="change_zoom(-0.5)">−</button>
        <span aria-live="polite">{{ Math.round(zoom * 100) }}%</span>
        <button type="button" aria-label="Acercar imagen" :disabled="zoom >= 4" @click="change_zoom(0.5)">+</button>
        <button type="button" @click="reset_zoom">Ajustar</button>
      </div>
      <div v-if="zoom_enabled" ref="viewport" class="support-image-lightbox-viewport" @wheel.prevent="on_wheel" @click.self="close">
        <div class="support-image-lightbox-canvas" @click.self="close">
          <img v-if="image_url" :src="image_url" class="support-image-lightbox-img support-image-lightbox-img--zoom"
            :style="image_style" alt="Imagen ampliada" @load="on_image_load" @dblclick="toggle_zoom" @error="image_error = true" />
        </div>
        <p v-if="image_error" class="support-image-lightbox-error">No se pudo cargar la imagen. <a :href="image_url" target="_blank" rel="noopener noreferrer">Abrir original</a></p>
      </div>
      <img
        v-else-if="image_url"
        :src="image_url"
        class="support-image-lightbox-img"
        alt="Imagen ampliada"
        @click.stop />
    </div>
  </teleport>
</template>

<script>
import { register_modal_escape } from '@/utils/modal_escape'

/**
 * Visor de imagen a pantalla completa dentro de la misma página (sin nueva pestaña).
 */
export default {
  name: 'ImageLightbox',
  props: {
    /** Controla si el visor está visible. */
    show: {
      type: Boolean,
      default: false,
    },
    /** URL de la imagen a mostrar ampliada. */
    image_url: {
      type: String,
      default: '',
    },
    /** Soporte habilita zoom; los consumidores anteriores conservan su visor. */
    zoom_enabled: { type: Boolean, default: false },
  },
  emits: ['update:show', 'close'],
  data() {
    return {
      /** Desregistra Escape al cerrar o destruir. */
      unregister_escape: null,
      zoom: 1,
      natural_width: 0,
      natural_height: 0,
      viewport_width: 0,
      viewport_height: 0,
      previous_focus: null,
      image_error: false,
    }
  },
  computed: {
    image_style() {
      if (!this.natural_width || !this.viewport_width) return {}
      const fit = Math.min(this.viewport_width / this.natural_width, this.viewport_height / this.natural_height, 1)
      return { width: this.natural_width * fit * this.zoom + 'px', height: this.natural_height * fit * this.zoom + 'px' }
    },
  },
  watch: {
    /**
     * Registra Escape cuando el visor se abre.
     *
     * @param {boolean} visible
     */
    show: {
      immediate: true,
      handler(visible) {
        if (visible) {
          this.zoom = 1
          this.image_error = false
          if (this.zoom_enabled) {
            this.previous_focus = document.activeElement
            window.addEventListener('resize', this.measure_viewport)
            this.$nextTick(() => {
              this.measure_viewport()
              if (this.$refs.dialog) this.$refs.dialog.focus()
            })
          }
          if (this.unregister_escape) {
            this.unregister_escape()
          }
          this.unregister_escape = register_modal_escape(() => this.close())
        } else {
          if (this.unregister_escape) this.unregister_escape()
          this.unregister_escape = null
          this.restore_focus()
        }
      },
    },
  },
  beforeUnmount() {
    this.restore_focus()
    if (this.unregister_escape) {
      this.unregister_escape()
      this.unregister_escape = null
    }
  },
  methods: {
    restore_focus() {
      window.removeEventListener('resize', this.measure_viewport)
      if (this.previous_focus && this.previous_focus.isConnected) this.previous_focus.focus()
      this.previous_focus = null
    },
    measure_viewport() {
      const viewport = this.$refs.viewport
      if (!viewport) return
      this.viewport_width = viewport.clientWidth
      this.viewport_height = viewport.clientHeight
    },
    on_image_load(event) {
      this.natural_width = event.target.naturalWidth
      this.natural_height = event.target.naturalHeight
      this.measure_viewport()
    },
    change_zoom(delta) {
      this.zoom = Math.max(1, Math.min(4, this.zoom + delta))
    },
    reset_zoom() {
      this.zoom = 1
      this.$nextTick(() => {
        if (this.$refs.viewport) this.$refs.viewport.scrollTo(0, 0)
      })
    },
    toggle_zoom() {
      if (this.zoom > 1) this.reset_zoom()
      else this.change_zoom(1)
    },
    on_wheel(event) {
      // Con la imagen ampliada se conserva el desplazamiento para recorrer todos sus bordes.
      if (event.ctrlKey || event.metaKey) this.change_zoom(event.deltaY < 0 ? 0.5 : -0.5)
      else if (this.$refs.viewport) this.$refs.viewport.scrollBy(event.deltaX, event.deltaY)
    },
    on_keydown(event) {
      if (!this.zoom_enabled) return
      if (event.key === '+' || event.key === '=') { event.preventDefault(); this.change_zoom(0.5) }
      if (event.key === '-') { event.preventDefault(); this.change_zoom(-0.5) }
      if (event.key === '0') { event.preventDefault(); this.reset_zoom() }
      if (event.key === 'Tab') {
        const buttons = Array.from(this.$refs.dialog.querySelectorAll('button:not(:disabled), a[href]'))
        const current = buttons.indexOf(document.activeElement)
        const next = event.shiftKey ? (current <= 0 ? buttons.length - 1 : current - 1) : (current + 1) % buttons.length
        event.preventDefault()
        if (buttons[next]) buttons[next].focus()
      }
    },
    /**
     * Cierra el visor y notifica al padre.
     */
    close() {
      this.$emit('update:show', false)
      this.$emit('close')
    },
  },
}
</script>

<style>
/* Por encima del panel de soporte y del editor de anotaciones */
body .support-image-lightbox {
  position: fixed;
  inset: 0;
  z-index: 1110;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.88);
}

body .support-image-lightbox-close {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 2;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

body .support-image-lightbox-close:hover {
  background: rgba(255, 255, 255, 0.28);
}

body .support-image-lightbox-img {
  display: block;
  max-width: min(96vw, 1400px);
  max-height: 92vh;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
}

body .support-image-lightbox--zoom {
  display: block;
  padding: 76px 12px 12px;
}
body .support-image-lightbox-toolbar {
  position: absolute;
  top: 16px;
  left: 12px;
  right: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: white;
}
body .support-image-lightbox-toolbar button {
  min-width: 40px;
  min-height: 44px;
  border: 1px solid #777;
  border-radius: 6px;
  background: #292929;
  color: white;
  padding: 4px 8px;
}
body .support-image-lightbox-toolbar button:disabled { opacity: 0.4; }
body .support-image-lightbox-toolbar span { min-width: 44px; text-align: center; }
body .support-image-lightbox-viewport {
  width: 100%;
  height: 100%;
  overflow: auto;
  overscroll-behavior: contain;
  touch-action: pan-x pan-y pinch-zoom;
}
/* El lienzo crece en lugar de transformar la imagen: el scroll alcanza también sus bordes. */
body .support-image-lightbox-canvas {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 100%;
  min-height: 100%;
  width: max-content;
}
body .support-image-lightbox-img--zoom {
  max-width: none;
  max-height: none;
  flex-shrink: 0;
  cursor: zoom-in;
}
body .support-image-lightbox-error { color: white; text-align: center; }
body .support-image-lightbox-error a { color: #acd7ff; }
</style>
