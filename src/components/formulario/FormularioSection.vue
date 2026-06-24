<template>
  <!-- Contenedor de una sección del formulario: muestra título, preguntas y sus campos -->
  <transition name="formulario-fade">
    <div class="formulario-section">
      <!-- Título de la sección -->
      <h2 class="formulario-section__title">{{ section.title }}</h2>

      <!-- Iteración sobre preguntas de la sección; respeta lógica condicional show_if -->
      <div
        v-for="question in visible_questions"
        :key="question.key"
        class="formulario-section__question"
      >
        <!-- Label con indicador de obligatorio -->
        <label class="formulario-section__label">
          {{ question.label }}
          <span v-if="question.required" class="formulario-section__required" title="Obligatorio"> *</span>
        </label>

        <!-- Hint / descripción adicional -->
        <p v-if="question.hint" class="formulario-section__hint">{{ question.hint }}</p>

        <!-- Campo correspondiente al tipo de pregunta -->
        <field-opcion
          v-if="question.type === 'opcion'"
          :question="question"
          :value="form_data[question.key] || null"
          @update:value="on_update(question.key, $event)"
        />

        <field-texto
          v-else-if="question.type === 'texto'"
          :question="question"
          :value="form_data[question.key] || ''"
          @update:value="on_update(question.key, $event)"
        />

        <field-texto-largo
          v-else-if="question.type === 'texto_largo'"
          :question="question"
          :value="form_data[question.key] || ''"
          @update:value="on_update(question.key, $event)"
        />

        <field-tabla-empleados
          v-else-if="question.type === 'tabla_empleados'"
          :question="question"
          :value="form_data[question.key] || []"
          @update:value="on_update(question.key, $event)"
        />

        <field-tabla-listas
          v-else-if="question.type === 'tabla_listas'"
          :question="question"
          :value="form_data[question.key] || []"
          @update:value="on_update(question.key, $event)"
        />

        <field-tabla-sucursales
          v-else-if="question.type === 'tabla_sucursales'"
          :question="question"
          :value="form_data[question.key] || []"
          @update:value="on_update(question.key, $event)"
        />

        <field-tabla-descuentos
          v-else-if="question.type === 'tabla_descuentos'"
          :question="question"
          :value="form_data[question.key] || []"
          @update:value="on_update(question.key, $event)"
        />

        <field-select-empleado
          v-else-if="question.type === 'select_empleado'"
          :question="question"
          :value="form_data[question.key] || 'yo_mismo'"
          :employees="form_data['employees'] || []"
          @update:value="on_update(question.key, $event)"
        />
      </div>
    </div>
  </transition>
</template>

<script>
import FieldOpcion          from './fields/FieldOpcion.vue'
import FieldTexto           from './fields/FieldTexto.vue'
import FieldTextoLargo      from './fields/FieldTextoLargo.vue'
import FieldTablaEmpleados  from './fields/FieldTablaEmpleados.vue'
import FieldTablaListas     from './fields/FieldTablaListas.vue'
import FieldTablaSucursales from './fields/FieldTablaSucursales.vue'
import FieldTablaDescuentos from './fields/FieldTablaDescuentos.vue'
import FieldSelectEmpleado  from './fields/FieldSelectEmpleado.vue'

/**
 * Contenedor de una sección del formulario.
 * Recibe la definición de sección y el mapa global de respuestas.
 * Aplica lógica condicional `show_if` para mostrar u ocultar preguntas.
 * Emite cambios individuales al padre mediante el evento `update:form_data`.
 *
 * @prop {object} section - Definición de la sección (de questions.js).
 * @prop {object} form_data - Mapa global de respuestas del formulario.
 * @emits update:form_data - Emite { key, value } para actualizar una respuesta puntual.
 */
export default {
  name: 'FormularioSection',

  components: {
    FieldOpcion,
    FieldTexto,
    FieldTextoLargo,
    FieldTablaEmpleados,
    FieldTablaListas,
    FieldTablaSucursales,
    FieldTablaDescuentos,
    FieldSelectEmpleado,
  },

  props: {
    /**
     * Definición de la sección actual (id, title, questions).
     */
    section: {
      type: Object,
      required: true,
    },

    /**
     * Mapa completo de respuestas del formulario { [key]: value }.
     */
    form_data: {
      type: Object,
      required: true,
    },
  },

  computed: {
    /**
     * Preguntas visibles de la sección: filtra las que tienen `show_if`
     * cuya condición no se cumple en el estado actual de form_data.
     *
     * @returns {Array}
     */
    visible_questions() {
      const self = this
      return self.section.questions.filter(function (q) {
        if (!q.show_if) {
          return true
        }
        /* Solo muestra la pregunta si la respuesta de la clave referenciada coincide */
        return self.form_data[q.show_if.key] === q.show_if.value
      })
    },
  },

  methods: {
    /**
     * Emite la actualización de una respuesta individual al componente padre.
     *
     * @param {string} key - Clave de la pregunta actualizada.
     * @param {*} value - Nuevo valor de la respuesta.
     * @returns {void}
     */
    on_update(key, value) {
      this.$emit('update:form_data', { key, value })
    },
  },
}
</script>

<style scoped>
.formulario-section {
  width: 100%;
}

/* Título de la sección */
.formulario-section__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #212529;
  margin-bottom: 28px;
}

/* Bloque de una pregunta con espaciado generoso */
.formulario-section__question {
  margin-bottom: 28px;
}

/* Label de la pregunta */
.formulario-section__label {
  display: block;
  font-size: 1rem;
  font-weight: 600;
  color: #343a40;
  margin-bottom: 6px;
}

/* Indicador de campo obligatorio */
.formulario-section__required {
  color: var(--bs-primary);
  font-size: 0.9rem;
}

/* Texto de ayuda debajo del label */
.formulario-section__hint {
  font-size: 0.85rem;
  color: #6c757d;
  margin-bottom: 10px;
  line-height: 1.5;
}

/* Animación fade al cambiar de sección */
.formulario-fade-enter-active,
.formulario-fade-leave-active {
  transition: opacity 0.2s ease;
}

.formulario-fade-enter,
.formulario-fade-leave-to {
  opacity: 0;
}
</style>
