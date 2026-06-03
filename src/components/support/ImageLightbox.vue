<template>
  <teleport to="body">
    <div
      v-if="show"
      class="support-image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Imagen ampliada"
      @click.self="close">
      <button
        type="button"
        class="support-image-lightbox-close"
        aria-label="Cerrar"
        title="Cerrar"
        @click="close">
        <i class="bi bi-x-lg"></i>
      </button>
      <img
        v-if="image_url"
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
  name: 'SupportImageLightbox',
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
  },
  emits: ['update:show', 'close'],
  data() {
    return {
      /** Desregistra Escape al cerrar o destruir. */
      unregister_escape: null,
    }
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
          if (this.unregister_escape) {
            this.unregister_escape()
          }
          this.unregister_escape = register_modal_escape(() => this.close())
        } else if (this.unregister_escape) {
          this.unregister_escape()
          this.unregister_escape = null
        }
      },
    },
  },
  beforeUnmount() {
    if (this.unregister_escape) {
      this.unregister_escape()
      this.unregister_escape = null
    }
  },
  methods: {
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
</style>
