<template>
  <div class="lead-demo-tab">
    <!--
      Sub-solapas de la Demo (misión flujo-lead-landing-closer, 17/10/2026). Mismo nav segmentado
      que usa el modal para sus pestañas, un escalón más adentro. Quién es la activa lo decide este
      componente; el nav solo pinta y avisa.
    -->
    <horizontal-nav
      class="mb-3"
      :items="items"
      :selected_item_value="activa"
      @setSelected="on_select"
    />

    <!--
      Montaje perezoso, igual que las pestañas extra del modal: una sub-solapa entra al DOM la
      primera vez que se abre y después se queda (v-show), porque Formulario guarda lo que se está
      editando en su propio estado y desmontarla al cambiar de sub-solapa lo borraría.
    -->
    <template v-for="item in items" :key="'demo-sub-' + item.key">
      <div v-if="montadas[item.key]" v-show="activa === item.key">
        <component
          :is="item.component"
          :draft="draft"
          :record="record"
          :all_properties="all_properties"
          @record-updated="$emit('record-updated', $event)"
        />
      </div>
    </template>
  </div>
</template>

<script>
import { markRaw } from 'vue'
import HorizontalNav from '@/common-vue/components/horizontal-nav/Index.vue'
import Configuracion from './Configuracion.vue'
import Videos from './Videos.vue'
import Links from './Links.vue'
import Formulario from './Formulario.vue'
import Chat from './Chat.vue'

/** Sub-solapas, fuera de `data()` para no recrear el array por instancia (ver `Leads.vue`). */
const SUB_SOLAPAS = [
  { key: 'chat', label: 'Conversación', component: markRaw(Chat) },
  { key: 'configuracion', label: 'Configuración', component: markRaw(Configuracion) },
  { key: 'videos', label: 'Videos personalizados', component: markRaw(Videos) },
  { key: 'links', label: 'Links', component: markRaw(Links) },
  { key: 'formulario', label: 'Formulario', component: markRaw(Formulario) },
]

/**
 * Solapa "Demo" del modal del lead, como pestaña extra propia (misión flujo-lead-landing-closer,
 * 17/10/2026). Reemplaza al grupo "Demo" del meta, que el form genérico dibujaba como una sola
 * grilla de campos sueltos; ese grupo queda oculto desde `Leads.vue` (`lead_modal_properties`).
 *
 * Recibe lo mismo que cualquier pestaña extra (`extra_tab_scope` del modal): `draft` es el
 * borrador que edita el formulario y que manda el Guardar del modal, `record` el lead efectivo
 * (el mismo borrador cuando hay id), `all_properties` el meta. Los campos de Configuración
 * escriben en `draft`; las acciones (setup, hora de fin, token, mail) pegan a la API y devuelven
 * el lead con `record-updated`, que el modal vuelca al borrador.
 *
 * Sin "Usa depósitos / Sucursal 1-3" ni "Usa listas de precios / Lista 1-3" (decisión de Lucas).
 */
export default {
  name: 'LeadDemoTab',
  components: { HorizontalNav },
  props: {
    /** Borrador del modal (lo que edita el formulario y manda el Guardar). */
    draft: { type: Object, default: null },
    /** Lead efectivo: el borrador cuando tiene id, si no la fila original. */
    record: { type: Object, default: null },
    /** Meta del modelo lead. */
    all_properties: { type: Array, default: () => [] },
    /** Nombre del modelo, lo pasa el modal; acá no se usa pero se declara para no caer en $attrs. */
    model_name: { type: String, default: 'lead' },
    /** Pestaña activa del modal padre; idem. */
    parent_active_tab: { type: String, default: null },
  },
  emits: ['record-updated'],
  data() {
    return {
      items: SUB_SOLAPAS,
      /** Sub-solapa visible. */
      activa: 'configuracion',
      /** Sub-solapas que ya se abrieron en esta apertura del modal (`{ key: true }`). */
      montadas: { configuracion: true },
    }
  },
  methods: {
    /**
     * @param {{ key: string }} item
     */
    on_select(item) {
      if (!item || !item.key) {
        return
      }
      this.activa = item.key
      this.montadas[item.key] = true
    },
  },
}
</script>
