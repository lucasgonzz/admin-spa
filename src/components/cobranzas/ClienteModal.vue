<template>
  <base-modal
    :show="show"
    :title="titulo"
    size="xl"
    :stack_level="0"
    @update:show="on_update_show"
    @close="$emit('close')"
  >
    <template v-if="cliente && cliente.id">
      <!-- Mismo nav segmentado que el modal genérico del cliente; acá con dos solapas nomás. -->
      <horizontal-nav
        class="mb-3"
        :items="pestanas"
        :selected_item_value="pestana_activa"
        @setSelected="on_nav_select"
      />

      <!--
        Montaje perezoso, copiado de common-vue/components/model/Index.vue: la pestaña existe en
        el DOM recién cuando se la abre (cada una dispara sus propios GET al montarse) y una vez
        abierta se queda montada con v-show, para no perder lo que el operador esté tipeando en
        un formulario inline si va y vuelve entre solapas.
      -->
      <div v-if="montadas.mensualidad" v-show="pestana_activa === 'mensualidad'">
        <mensualidad-tab :record="cliente" />
      </div>
      <div v-if="montadas.licencias" v-show="pestana_activa === 'licencias'">
        <licencias-tab :record="cliente" />
      </div>
    </template>

    <!-- Sin botón Guardar propio: cada pestaña guarda lo suyo. -->
    <template #footer>
      <button type="button" class="btn btn-secondary" @click="cerrar">Cerrar</button>
    </template>
  </base-modal>
</template>

<script>
import BaseModal from '@/components/ui/BaseModal.vue'
import HorizontalNav from '@/common-vue/components/horizontal-nav/Index.vue'
import MensualidadTab from '@/components/client/MensualidadTab.vue'
import LicenciasTab from '@/components/client/LicenciasTab.vue'

/**
 * Modal del cliente del módulo Cobranzas (misión modulo-cobranzas, 18/9/2026).
 *
 * Es "el modal del cliente pero solo con Mensualidad y Licencias", como lo pidió Lucas: las dos
 * pestañas son EXACTAMENTE los componentes que usa la ficha completa en Clientes
 * (`components/client/MensualidadTab.vue` y `LicenciasTab.vue`), así que lo que se hace acá y lo
 * que se hace desde Clientes es lo mismo, sin dos versiones que mantener.
 *
 * No usa el `ResourceView`/modal genérico porque ese exige el modelo completo con sus
 * propiedades y su formulario, y acá se quiere abrir desde una fila de la tabla con nada más
 * que `{id, name, company_name}`.
 */
export default {
  name: 'CobranzasClienteModal',
  components: { BaseModal, HorizontalNav, MensualidadTab, LicenciasTab },
  props: {
    /** Visibilidad, controlada por el padre (v-model:show). */
    show: { type: Boolean, default: false },
    /** Cliente a mostrar: `{id, name, company_name}`. */
    cliente: { type: Object, default: null },
    /** Pestaña con la que se abre: `mensualidad` (default) o `licencias`. */
    pestana_inicial: { type: String, default: 'mensualidad' },
  },
  emits: ['update:show', 'close'],
  data() {
    return {
      /** Pestañas del nav. */
      pestanas: [
        { key: 'mensualidad', label: 'Mensualidad' },
        { key: 'licencias', label: 'Licencias' },
      ],
      /** Clave de la pestaña visible. */
      pestana_activa: 'mensualidad',
      /** Pestañas que ya se abrieron en esta apertura del modal (ver montaje perezoso). */
      montadas: { mensualidad: false, licencias: false },
    }
  },
  computed: {
    /**
     * Título del modal: el nombre comercial, o el nombre a secas.
     * @returns {string}
     */
    titulo() {
      if (!this.cliente) {
        return ''
      }
      return this.cliente.company_name || this.cliente.name || 'Cliente #' + this.cliente.id
    },
  },
  watch: {
    /**
     * En cada apertura se arranca en la pestaña pedida y con las demás sin montar; al cerrar se
     * limpia para que la próxima apertura (otro cliente) no herede pestañas montadas.
     */
    show: {
      immediate: true,
      handler(visible) {
        if (visible) {
          this.pestana_activa = this.pestana_inicial === 'licencias' ? 'licencias' : 'mensualidad'
          this.montadas = { mensualidad: false, licencias: false }
          this.montadas[this.pestana_activa] = true
        } else {
          this.montadas = { mensualidad: false, licencias: false }
        }
      },
    },
  },
  methods: {
    /**
     * Cambio de pestaña desde el nav (que solo pinta y avisa).
     * @param {{key: string}} item
     */
    on_nav_select(item) {
      if (!item || !item.key) {
        return
      }
      this.pestana_activa = item.key
      this.montadas[item.key] = true
    },
    /**
     * Propaga el cierre pedido por el BaseModal (Escape, backdrop, X).
     * @param {boolean} visible
     */
    on_update_show(visible) {
      this.$emit('update:show', visible)
    },
    /**
     * Cierra desde el pie.
     */
    cerrar() {
      this.$emit('update:show', false)
      this.$emit('close')
    },
  },
}
</script>
