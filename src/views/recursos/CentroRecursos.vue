<template>
  <div class="centro-recursos-view container-fluid px-0 py-4">
    <div class="mb-3">
      <h4 class="mb-0">Centro de recursos</h4>
      <p class="text-muted small mb-0 mt-1">
        Los videos del centro que ven los clientes en
        <a :href="URL_PAGINA" target="_blank" rel="noopener">recursos.comerciocity.com</a>: sus preguntas, cómo
        puntúan cada video y cuánto avanzó cada cliente.
      </p>
    </div>

    <!-- Pestañas. flex-wrap: en teléfono no entran las tres en una línea. -->
    <ul class="nav nav-tabs flex-wrap mb-3" role="tablist" aria-label="Centro de recursos">
      <li v-for="tab in tabs" :key="tab.key" class="nav-item" role="presentation">
        <button
          :id="'recursos-solapa-' + tab.key"
          type="button"
          class="nav-link py-2"
          :class="{ active: active_tab === tab.key }"
          role="tab"
          :aria-selected="active_tab === tab.key ? 'true' : 'false'"
          :aria-controls="'recursos-panel-' + tab.key"
          :data-solapa="tab.key"
          @click="active_tab = tab.key"
        >
          {{ tab.label }}
        </button>
      </li>
    </ul>

    <!-- v-if y no v-show: cada solapa pide lo suyo recién cuando se la mira. El contenedor es el
         tabpanel de la solapa activa (role + aria-labelledby): además de la accesibilidad, deja
         buscar la solapa sin chocar con el ítem "Clientes" del menú del admin. -->
    <div
      :id="'recursos-panel-' + active_tab"
      role="tabpanel"
      :aria-labelledby="'recursos-solapa-' + active_tab"
    >
      <panel-preguntas v-if="active_tab === 'preguntas'" />
      <panel-videos v-else-if="active_tab === 'videos'" />
      <panel-clientes v-else />
    </div>
  </div>
</template>

<script>
import PanelPreguntas from './PanelPreguntas.vue'
import PanelVideos from './PanelVideos.vue'
import PanelClientes from './PanelClientes.vue'

/**
 * "Centro de recursos" del admin (misión centro-de-recursos-clientes, 13/10/2026, §5.2 del
 * plan): tres solapas.
 *
 * - Preguntas: pendientes primero; "Proponer respuesta" llena la caja con el borrador de la IA;
 *   Responder / Ocultar.
 * - Videos: los peor puntuados primero, con los "qué mejorar" desplegables.
 * - Clientes: avance por cliente, detalle por usuario y "Copiar link del dueño".
 */
export default {
  name: 'ViewCentroRecursos',

  components: { PanelPreguntas, PanelVideos, PanelClientes },

  data() {
    return {
      /** Dirección pública de la página del centro. */
      URL_PAGINA: 'https://recursos.comerciocity.com',
      /** Solapa visible. */
      active_tab: 'preguntas',
      /** Definición de las solapas. */
      tabs: [
        { key: 'preguntas', label: 'Preguntas' },
        { key: 'videos', label: 'Videos' },
        { key: 'clientes', label: 'Clientes' },
      ],
    }
  },
}
</script>
