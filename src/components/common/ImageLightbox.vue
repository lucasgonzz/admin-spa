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
      :aria-label="video_url ? 'Video ampliado' : 'Imagen ampliada'"
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
      <div v-if="zoom_enabled" class="support-image-lightbox-toolbar" role="group" aria-label="Zoom del adjunto">
        <button type="button" aria-label="Alejar" :disabled="zoom <= 1" @click="change_zoom(-0.5)">−</button>
        <span aria-live="polite">{{ Math.round(zoom * 100) }}%</span>
        <button type="button" aria-label="Acercar" :disabled="zoom >= 4" @click="change_zoom(0.5)">+</button>
        <button type="button" @click="reset_zoom">Ajustar</button>
      </div>
      <div v-if="zoom_enabled" ref="viewport" class="support-image-lightbox-viewport"
        @wheel.prevent="on_wheel" @touchstart="on_touch_change" @touchmove="on_touch_move"
        @touchend="on_touch_change" @touchcancel="on_touch_change"
        @pointerdown="on_mouse_down" @pointermove="on_mouse_move"
        @pointerup="mouse_drag = null" @pointercancel="mouse_drag = null" @pointerleave="mouse_drag = null">
        <div class="support-image-lightbox-canvas" @click.self="close">
          <video v-if="video_url" :src="video_url" class="support-image-lightbox-img support-image-lightbox-img--zoom"
            :style="image_style" controls playsinline preload="metadata"
            @loadedmetadata="on_media_load" @error="media_error = true" />
          <img v-else-if="image_url" :src="image_url" class="support-image-lightbox-img support-image-lightbox-img--zoom"
            :style="image_style" alt="Imagen ampliada" draggable="false"
            @load="on_media_load" @dblclick="toggle_zoom" @error="media_error = true" />
        </div>
        <p v-if="media_error" class="support-image-lightbox-error">
          No se pudo cargar el adjunto.
          <a :href="video_url || image_url" target="_blank" rel="noopener noreferrer">Abrir original</a>
        </p>
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
    video_url: { type: String, default: '' },
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
      media_error: false,
      pan_x: 0,
      pan_y: 0,
      touch_gesture: null,
      mouse_drag: null,
    }
  },
  computed: {
    fit() {
      if (!this.natural_width || !this.natural_height || !this.viewport_width || !this.viewport_height) return 0
      return Math.min(this.viewport_width / this.natural_width, this.viewport_height / this.natural_height, 1)
    },
    image_style() {
      if (!this.fit) return {}
      return {
        width: this.natural_width * this.fit + 'px',
        height: this.natural_height * this.fit + 'px',
        transform: 'translate(' + this.pan_x + 'px, ' + this.pan_y + 'px) scale(' + this.zoom + ')',
      }
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
          this.reset_zoom()
          this.natural_width = 0
          this.natural_height = 0
          this.touch_gesture = null
          this.mouse_drag = null
          this.media_error = false
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
      this.set_pan(this.pan_x, this.pan_y)
    },
    on_media_load(event) {
      this.natural_width = event.target.videoWidth || event.target.naturalWidth
      this.natural_height = event.target.videoHeight || event.target.naturalHeight
      this.measure_viewport()
    },
    set_pan(x, y) {
      const limit_x = Math.max(0, (this.natural_width * this.fit * this.zoom - this.viewport_width) / 2)
      const limit_y = Math.max(0, (this.natural_height * this.fit * this.zoom - this.viewport_height) / 2)
      this.pan_x = Math.max(-limit_x, Math.min(limit_x, x))
      this.pan_y = Math.max(-limit_y, Math.min(limit_y, y))
    },
    zoom_at(value, x, y, previous_x, previous_y) {
      const next = Math.max(1, Math.min(4, value))
      const ratio = next / this.zoom
      this.zoom = next
      this.set_pan(x - (previous_x - this.pan_x) * ratio, y - (previous_y - this.pan_y) * ratio)
    },
    change_zoom(delta) {
      this.zoom_at(this.zoom + delta, 0, 0, 0, 0)
    },
    reset_zoom() {
      this.zoom = 1
      this.pan_x = 0
      this.pan_y = 0
    },
    toggle_zoom() {
      if (this.zoom > 1) this.reset_zoom()
      else this.change_zoom(1)
    },
    on_wheel(event) {
      if (!event.deltaY) return
      const rect = this.$refs.viewport.getBoundingClientRect()
      const x = event.clientX - rect.left - rect.width / 2
      const y = event.clientY - rect.top - rect.height / 2
      this.zoom_at(this.zoom + (event.deltaY < 0 ? 0.25 : -0.25), x, y, x, y)
    },
    on_mouse_down(event) {
      if (event.pointerType !== 'mouse' || event.button !== 0 || this.zoom <= 1) return
      this.mouse_drag = { x: event.clientX, y: event.clientY }
    },
    on_mouse_move(event) {
      if (event.pointerType !== 'mouse' || !this.mouse_drag || !(event.buttons & 1)) return
      const dx = event.clientX - this.mouse_drag.x
      const dy = event.clientY - this.mouse_drag.y
      const viewport = this.$refs.viewport
      if (!viewport.hasPointerCapture(event.pointerId)) {
        if (Math.hypot(dx, dy) < 4) return
        viewport.setPointerCapture(event.pointerId)
      }
      this.set_pan(this.pan_x + dx, this.pan_y + dy)
      this.mouse_drag = { x: event.clientX, y: event.clientY }
    },
    touch_position(touches) {
      const first = touches[0]
      if (!first) return null
      const second = touches[1] || first
      const rect = this.$refs.viewport.getBoundingClientRect()
      return {
        x: (first.clientX + second.clientX) / 2 - rect.left - rect.width / 2,
        y: (first.clientY + second.clientY) / 2 - rect.top - rect.height / 2,
        distance: Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY),
        count: touches.length,
      }
    },
    on_touch_change(event) {
      this.touch_gesture = this.touch_position(event.touches)
    },
    on_touch_move(event) {
      const previous = this.touch_gesture
      const current = this.touch_position(event.touches)
      this.touch_gesture = current
      if (!previous || !current || previous.count !== current.count) return
      if (current.count > 1) {
        if (event.cancelable) event.preventDefault()
        if (previous.distance && current.distance) {
          this.zoom_at(this.zoom * current.distance / previous.distance, current.x, current.y, previous.x, previous.y)
        }
      } else if (this.zoom > 1) {
        if (event.cancelable) event.preventDefault()
        this.set_pan(this.pan_x + current.x - previous.x, this.pan_y + current.y - previous.y)
      }
    },
    on_keydown(event) {
      if (!this.zoom_enabled) return
      if (event.key === '+' || event.key === '=') { event.preventDefault(); this.change_zoom(0.5) }
      if (event.key === '-') { event.preventDefault(); this.change_zoom(-0.5) }
      if (event.key === '0') { event.preventDefault(); this.reset_zoom() }
      if (event.key === 'Tab') {
        const buttons = Array.from(this.$refs.dialog.querySelectorAll('button:not(:disabled), video[controls], a[href]'))
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
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: none;
}
body .support-image-lightbox-canvas {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}
body .support-image-lightbox-img--zoom {
  max-width: none;
  max-height: none;
  flex-shrink: 0;
  cursor: zoom-in;
}
body .support-image-lightbox-error { position: absolute; top: 0; width: 100%; color: white; text-align: center; }
body .support-image-lightbox-error a { color: #acd7ff; }
</style>
