<template>
  <div class="ecommerce-version-select">
    <label class="form-label small mb-1" :for="select_id">Versión de ecommerce</label>

    <div v-if="loading" class="text-muted small">Cargando versiones publicadas…</div>

    <!-- Sin ninguna versión publicada: la corrida va a fallar al arrancar (sin tocar servidores). -->
    <div v-else-if="versions.length === 0" class="alert alert-warning py-2 small mb-0">
      No hay ninguna versión de ecommerce publicada. La corrida se va a crear igual, pero va a
      <strong>fallar al arrancar</strong> (sin tocar ningún servidor). Publicá una en
      <router-link to="/versiones/ecommerce">Versiones ecommerce</router-link> antes de seguir.
    </div>

    <template v-else>
      <select
        :id="select_id"
        class="form-select form-select-sm"
        :value="modelValue"
        :disabled="disabled"
        @change="on_change"
      >
        <option
          v-for="version in versions"
          :key="version.id"
          :value="version.id"
        >
          {{ option_label(version) }}
        </option>
      </select>
      <p class="text-muted small mb-0 mt-1">
        Se bajan los artefactos del release <code>v{{ selected_code }}</code> de tienda-spa y
        tienda-api: no se compila nada en el VPS.
      </p>
    </template>
  </div>
</template>

<script>
/** Contador para ids únicos de los <label for> cuando hay más de un selector en pantalla. */
let instance_counter = 0

/**
 * Selector de la versión de ecommerce que despliega una instalación o actualización de tienda
 * (misión cruzada `versiones-tienda`, 1/10/2026).
 *
 * Trae las versiones PUBLICADAS (`ecommerce_version/fetch_published`) y elige por defecto la última
 * publicada por orden semántico —la misma que usa el backend si no se manda ninguna—. Si no hay
 * ninguna, lo avisa en pantalla y emite `null` (el backend crea la corrida igual y falla al arrancar
 * con el mensaje de cómo publicar).
 *
 * v-model: `modelValue` es el `ecommerce_version_id` elegido (o null).
 */
export default {
  name: 'EcommerceVersionSelect',

  props: {
    /** Id de la versión elegida (v-model). */
    modelValue: {
      type: Number,
      default: null,
    },
    /** Deshabilita el select (por ejemplo, mientras se dispara la corrida). */
    disabled: {
      type: Boolean,
      default: false,
    },
  },

  emits: ['update:modelValue', 'loaded'],

  data() {
    instance_counter += 1
    return {
      /** Versiones publicadas, de la más nueva a la más vieja. */
      versions: [],
      /** true mientras se piden las versiones. */
      loading: false,
      /** id del <select>, único por instancia. */
      select_id: 'ecommerce-version-select-' + instance_counter,
    }
  },

  computed: {
    /**
     * Código de la versión elegida, para la ayuda de abajo del select.
     *
     * @returns {string}
     */
    selected_code() {
      const self = this
      const elegida = this.versions.find(function (version) {
        return version.id === self.modelValue
      })
      return elegida ? elegida.version : ''
    },
  },

  created() {
    this.load_versions()
  },

  methods: {
    /**
     * Pide las versiones publicadas y deja elegida la última (si el padre no eligió ya una válida).
     *
     * @returns {void}
     */
    load_versions() {
      const self = this
      self.loading = true
      self.$store.dispatch('ecommerce_version/fetch_published')
        .then(function (result) {
          self.versions = result.models
          const actual_es_valida = self.versions.some(function (version) {
            return version.id === self.modelValue
          })
          if (!actual_es_valida) {
            const ultima = result.ultima_publicada || (self.versions.length ? self.versions[0] : null)
            self.$emit('update:modelValue', ultima ? ultima.id : null)
          }
          self.$emit('loaded', self.versions)
        })
        .catch(function () {
          /* El interceptor de axios ya muestra el toast de error. */
          self.versions = []
          self.$emit('update:modelValue', null)
        })
        .finally(function () {
          self.loading = false
        })
    },

    /**
     * Propaga la versión elegida al padre (el value del <option> llega como string).
     *
     * @param {Event} event
     * @returns {void}
     */
    on_change(event) {
      const value = event.target.value
      this.$emit('update:modelValue', value === '' ? null : Number(value))
    },

    /**
     * Texto de cada opción: código, título si tiene, y "(última)" en la más nueva.
     *
     * @param {Object} version
     * @returns {string}
     */
    option_label(version) {
      let label = version.version
      if (version.title) {
        label += ' — ' + version.title
      }
      if (this.versions.length && this.versions[0].id === version.id) {
        label += ' (última)'
      }
      return label
    },
  },
}
</script>
