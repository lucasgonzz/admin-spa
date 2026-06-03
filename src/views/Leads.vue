<template>
  <div>
    <resource-view
      model_name="lead"
      :model_extra_tabs="model_extra_tabs"
      @extra-record-updated="on_record_updated"
    >
      <template #right>
        <button type="button" class="btn btn-outline-primary btn-sm" @click="on_open_demo_modal">
          <i class="bi bi-window-sidebar me-1" /> Gestionar demos
        </button>
      </template>
    </resource-view>

    <base-modal
      :show="show_demo_modal"
      title="Gestión de demos"
      size="xl"
      @update:show="on_update_demo_modal"
      @close="on_close_demo_modal"
    >
      <resource-view model_name="demo" />
      <template #footer>
        <button type="button" class="btn btn-secondary" @click="on_close_demo_modal">Cerrar</button>
      </template>
    </base-modal>
  </div>
</template>

<script>
import { markRaw } from 'vue'
import ResourceView from '@/common-vue/components/view/Index.vue'
import LeadExtraProps from '@/components/lead/extra-props/Index.vue'
import LeadConversationTab from '@/components/lead/conversation/Index.vue'
import BaseModal from '@/components/ui/BaseModal.vue'

/**
 * Definición de pestaña extra fuera de `data()` para no recrear el array por instancia.
 * `markRaw` evita que Vue 3 envuelva la definición del componente en un Proxy (warning en consola
 * y `<component :is>` puede dejar de resolver bien, afectando el modal al guardar).
 */
const lead_model_extra_tabs = [
  {
    key: 'extra',
    label: 'Operaciones',
    component: markRaw(LeadExtraProps),
  },
  {
    key: 'conversation',
    label: 'Conversación WhatsApp',
    component: markRaw(LeadConversationTab),
  },
]

export default {
  name: 'ViewLeads',
  components: { ResourceView, LeadExtraProps, LeadConversationTab, BaseModal },
  data() {
    return {
      /** Controla visibilidad del modal para gestionar catálogo de demos. */
      show_demo_modal: false,
      /** Pestañas extra del modal de leads usando la API nueva `model_extra_tabs`. */
      model_extra_tabs: lead_model_extra_tabs,
    }
  },
  methods: {
    /**
     * Abre modal fullscreen con el CRUD de demos.
     * @returns {void}
     */
    on_open_demo_modal() {
      this.show_demo_modal = true
    },
    /**
     * Sincroniza el estado show del modal de demos.
     * @param {boolean} value nuevo estado de visibilidad.
     * @returns {void}
     */
    on_update_demo_modal(value) {
      this.show_demo_modal = value
    },
    /**
     * Cierra modal de demos.
     * @returns {void}
     */
    on_close_demo_modal() {
      this.show_demo_modal = false
    },
    /**
     * Sincroniza en la tabla los cambios recibidos desde acciones extra del modal.
     * @param {Object} model lead actualizado en backend.
     * @returns {void}
     */
    on_record_updated(model) {
      this.$store.dispatch('lead/upsert_model_in_lists', model)
      const conv = this.$store.state.lead.lead_en_conversacion
      if (conv && model && model.id && conv.id == model.id) {
        this.$store.commit('lead/update_lead_en_conversacion', model)
      }
    },
  },
}
</script>
