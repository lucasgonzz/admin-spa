<template>
  <teleport to="body">
    <div
      v-if="show"
      class="modal fade show d-block"
      tabindex="-1"
      role="dialog"
      :style="{ zIndex: modal_z_index }"
      @click.self="close"
    >
      <div class="modal-dialog" :class="size_class" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">{{ title }}</h5>
            <button type="button" class="btn-close" aria-label="Close" @click="close"></button>
          </div>
          <div class="modal-body">
            <slot />
          </div>
          <div class="modal-footer">
            <slot name="footer">
              <button type="button" class="btn btn-secondary" @click="close">Cerrar</button>
            </slot>
          </div>
        </div>
      </div>
    </div>
    <div
      v-if="show"
      class="modal-backdrop fade show"
      :style="{ zIndex: backdrop_z_index }"
    ></div>
  </teleport>
</template>

<script>
import { register_modal_escape } from '@/utils/modal_escape'

/**
 * Modal base sin dependencias externas.
 * Cierra con Escape, click en backdrop o botón cerrar.
 */
export default {
  name: 'BaseModal',
  props: {
    show: {
      type: Boolean,
      default: false,
    },
    title: {
      type: String,
      default: '',
    },
    size: {
      type: String,
      default: 'md',
    },
    /**
     * Nivel de apilamiento para modales anidados (0 = base, 1+ = encima del padre).
     */
    stack_level: {
      type: Number,
      default: 0,
    },
  },
  emits: ['update:show', 'close'],
  data() {
    return {
      /** Desregistra el handler de Escape al cerrar o destruir el componente. */
      unregister_escape: null,
    }
  },
  watch: {
    /**
     * Registra o quita el cierre por Escape según visibilidad del modal.
     *
     * @param {boolean} is_visible
     */
    show: {
      immediate: true,
      handler(is_visible) {
        if (is_visible) {
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
  computed: {
    /**
     * z-index base Bootstrap modal (1055) + incremento por nivel anidado.
     * @returns {number}
     */
    modal_z_index() {
      return 1055 + this.stack_level * 10
    },
    /**
     * z-index del backdrop, siempre debajo del diálogo del mismo nivel.
     * @returns {number}
     */
    backdrop_z_index() {
      return this.modal_z_index - 5
    },
    /**
     * Tamaño del diálogo: sm, md, lg, xl, fullscreen (o full).
     * @returns {string}
     */
    size_class() {
      if (this.size === 'sm') {
        return 'modal-sm'
      }
      if (this.size === 'lg') {
        return 'modal-lg'
      }
      if (this.size === 'xl') {
        return 'modal-xl'
      }
      if (this.size === 'fullscreen' || this.size === 'full') {
        return 'modal-fullscreen'
      }
      return ''
    },
  },
  methods: {
    close() {
      this.$emit('update:show', false)
      this.$emit('close')
    },
  },
}
</script>
