<template>
  <!-- Bloque autocontenido: dinámica de demo asignada a este lead (grupo 293, prompt 04). -->
  <div class="dec-wrap">
    <label class="dec-label">Dinámica de demo</label>

    <div class="dec-row">
      <!-- Etiqueta corta de la dinámica vigente del lead, con fallback a 'actual' si viene null/vacía. -->
      <span class="dec-current" :class="{ 'dec-current--nueva': experiencia_actual === 'nueva' }">
        {{ experiencia_label(experiencia_actual) }}
      </span>

      <!-- Selector para elegir la otra dinámica; no aplica hasta confirmar. -->
      <select
        v-model="selected_experiencia"
        class="form-select form-select-sm dec-select"
        :disabled="loading_action !== ''"
      >
        <option value="actual">Actual</option>
        <option value="nueva">Nueva (en pruebas)</option>
      </select>

      <button
        type="button"
        class="btn btn-sm btn-outline-secondary"
        :disabled="loading_action !== '' || selected_experiencia === experiencia_actual"
        @click="confirming = true"
      >
        Cambiar
      </button>
    </div>

    <!-- Panel de confirmación: cambiar la dinámica le cambia el guion completo al agente
         para este lead, no es un toggle inocuo. -->
    <div v-if="confirming" class="alert alert-light border dec-confirm mb-0 mt-2">
      <p class="mb-2 small">
        Se va a cambiar la dinámica de demo de este lead de
        "{{ experiencia_label(experiencia_actual) }}" a "{{ experiencia_label(selected_experiencia) }}".
        ¿Confirmar?
      </p>
      <div class="d-flex gap-2">
        <button
          type="button"
          class="btn btn-sm btn-primary"
          :disabled="loading_action !== ''"
          @click="on_confirmar"
        >
          <span v-if="loading_action === 'cambiar'" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
          {{ loading_action === 'cambiar' ? 'Aplicando...' : 'Confirmar' }}
        </button>
        <button
          type="button"
          class="btn btn-sm btn-outline-secondary"
          :disabled="loading_action !== ''"
          @click="on_cancelar"
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * Control autocontenido de la dinámica de demo asignada a un lead (grupo 293, prompt 04).
 *
 * Es un control distinto del selector global de `LeadDemoSettingsSection.vue`: aquel decide
 * con qué dinámica nacen los leads nuevos; este decide la dinámica de ESTE lead puntual, y es
 * lo que permite pilotear la experiencia nueva con unos pocos leads elegidos a mano.
 *
 * Calca la forma de `DemoAccesoControl.vue`: prop `lead` requerida, `emits: ['record-updated']`,
 * `loading_action` para deshabilitar mientras hay un request en vuelo, y confirmación inline
 * (alert + botones Confirmar/Cancelar) antes de aplicar el cambio, porque cambiar la dinámica
 * le cambia el guion completo con el que el agente le habla al lead.
 *
 * A diferencia de `DemoAccesoControl` (que solo se monta si el lead tiene demo asignada), este
 * control se monta con `v-if="lead"` a secas: la dinámica se decide ANTES de agendar demo, así
 * que los leads sin demo son justamente los candidatos a piloto.
 *
 * Props:
 *   lead {Object} - Lead con el campo demo_experiencia ('actual' | 'nueva' | null | '').
 *
 * Eventos:
 *   record-updated - Se emite con el lead ya refrescado luego de aplicar el cambio, para que
 *                    el padre actualice su copia (mismo contrato que DemoAccesoControl).
 */
export default {
  name: 'DemoExperienciaControl',

  props: {
    /**
     * Lead sobre el que se opera.
     * @type {Object}
     */
    lead: {
      type: Object,
      required: true,
    },
  },

  emits: ['record-updated'],

  data() {
    return {
      /** Acción en curso contra el backend: '' | 'cambiar'. Deshabilita los controles. */
      loading_action: '',
      /** true mientras se muestra el panel de confirmación antes de aplicar el cambio. */
      confirming: false,
      /**
       * Valor elegido en el <select> (todavía no confirmado). Se inicializa con la dinámica
       * vigente del lead y se resetea a ella si el usuario cancela.
       */
      selected_experiencia: this.normalize_experiencia(this.lead && this.lead.demo_experiencia),
    }
  },

  computed: {
    /**
     * Dinámica vigente del lead, con 'actual' como fallback si el campo viene null o vacío
     * (misma regla de seguridad que aplica el backend al resolver la variante del protocolo).
     * @returns {string} 'actual' | 'nueva'
     */
    experiencia_actual() {
      return this.normalize_experiencia(this.lead && this.lead.demo_experiencia)
    },
  },

  watch: {
    /**
     * Si el lead cambia (navegación entre leads en el sidebar) o se refresca desde otro lado,
     * sincronizar el valor seleccionado del select con la dinámica real del lead y cerrar
     * cualquier confirmación que hubiera quedado abierta.
     */
    'lead.demo_experiencia': function () {
      this.selected_experiencia = this.experiencia_actual
      this.confirming = false
    },
    'lead.id': function () {
      this.selected_experiencia = this.experiencia_actual
      this.confirming = false
    },
  },

  methods: {
    /**
     * Normaliza el valor crudo del backend aplicando el fallback a 'actual' cuando viene
     * null, undefined o vacío.
     * @param {string|null|undefined} value
     * @returns {string} 'actual' | 'nueva'
     */
    normalize_experiencia(value) {
      return value === 'nueva' ? 'nueva' : 'actual'
    },

    /**
     * Etiqueta corta y sin jerga para mostrar cada valor de dinámica.
     * El sufijo "(en pruebas)" en 'nueva' es intencional: recuerda que el lead queda metido
     * en algo que se está construyendo.
     * @param {string} value 'actual' | 'nueva'
     * @returns {string}
     */
    experiencia_label(value) {
      return value === 'nueva' ? 'Nueva (en pruebas)' : 'Actual'
    },

    /**
     * Aplica el cambio confirmado: despacha la acción del store y emite record-updated con
     * el modelo que devuelve el backend. Cierra el panel de confirmación al terminar, con
     * éxito o con error.
     * @returns {void}
     */
    on_confirmar() {
      var self = this
      if (this.loading_action !== '') {
        return
      }
      this.loading_action = 'cambiar'
      this.$store
        .dispatch('lead/set_demo_experiencia', {
          lead_id: this.lead.id,
          demo_experiencia: this.selected_experiencia,
        })
        .then(function (model) {
          self.confirming = false
          self.$emit('record-updated', model)
        })
        .catch(function () {
          // El toast de error global (interceptor de axios) ya avisa; acá solo cerramos el loading.
        })
        .then(function () {
          self.loading_action = ''
        })
    },

    /**
     * Cancela el cambio propuesto: cierra el panel de confirmación y revierte el <select>
     * a la dinámica vigente del lead.
     * @returns {void}
     */
    on_cancelar() {
      this.confirming = false
      this.selected_experiencia = this.experiencia_actual
    },
  },
}
</script>

<style scoped>
.dec-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--bs-border-color);
  background: var(--bs-body-bg);
}
.dec-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: rgba(17, 27, 33, 0.55);
  margin: 0;
}
.dec-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
.dec-current {
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(17, 27, 33, 0.7);
}
.dec-current--nueva {
  color: var(--bs-warning-text-emphasis, #997404);
}
.dec-select {
  width: auto;
  max-width: 160px;
}
.dec-confirm {
  padding: 0.6rem 0.75rem;
}
</style>
