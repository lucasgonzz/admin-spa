<template>
  <!--
    Registrar llamada (misión embudo-juan-pipeline, E1).

    Es lo que Juan completa apenas corta con un lead: si atendió, cómo terminó, lo que se cotizó y
    qué se habló. Un solo pedido (POST lead/{id}/llamadas) deja la llamada asentada, mueve la tarjeta
    del tablero a la columna que corresponde y cierra las tareas del embudo de ese lead. Esas
    consecuencias las decide la API: acá sólo se arma el formulario y se avisa de lo que falta antes
    de mandar (reglas en `utils/registrar_llamada.js`).

    Se abre desde la tarjeta del tablero, la ficha de la oportunidad y el encabezado de la conversación
    del lead (también con el perfil «Sólo Leads», que ve esa conversación en sólo lectura). Cada
    apertura se monta con una `key` nueva, así que no arrastra nada de la anterior.
  -->
  <base-modal :show="show" title="Registrar llamada" size="lg" :stack_level="stack_level" @close="on_cancel">
    <form class="rl-form" novalidate @submit.prevent="on_submit">
      <p v-if="lead_name" class="rl-form__lead">{{ lead_name }}</p>

      <!-- ¿Atendió? -->
      <fieldset class="rl-form__group">
        <legend class="form-label mb-2">¿Atendió?<span class="rl-form__required" title="Obligatorio"> *</span></legend>
        <div class="rl-form__choices" role="radiogroup" aria-label="¿Atendió?">
          <button
            type="button"
            role="radio"
            class="rl-form__choice"
            :class="{ 'rl-form__choice--selected': form.atendio === true }"
            :aria-checked="form.atendio === true ? 'true' : 'false'"
            :disabled="saving"
            @click="elegir_atendio(true)"
          >
            <i class="bi bi-telephone-inbound" aria-hidden="true" />Sí, atendió
          </button>
          <button
            type="button"
            role="radio"
            class="rl-form__choice"
            :class="{ 'rl-form__choice--selected': form.atendio === false }"
            :aria-checked="form.atendio === false ? 'true' : 'false'"
            :disabled="saving"
            @click="elegir_atendio(false)"
          >
            <i class="bi bi-telephone-x" aria-hidden="true" />No atendió
          </button>
        </div>
        <div v-if="error_de('atendio')" class="invalid-feedback d-block">{{ error_de('atendio') }}</div>
      </fieldset>

      <!-- Cómo terminó (sólo si atendió) -->
      <fieldset v-if="form.atendio === true" class="rl-form__group">
        <legend class="form-label mb-2">¿Cómo terminó?<span class="rl-form__required" title="Obligatorio"> *</span></legend>
        <div class="rl-form__results" role="radiogroup" aria-label="Cómo terminó la llamada">
          <label
            v-for="resultado in resultados"
            :key="resultado.value"
            class="rl-form__result"
            :class="{ 'rl-form__result--selected': form.resultado === resultado.value }"
          >
            <input
              v-model="form.resultado"
              type="radio"
              name="rl-resultado"
              class="form-check-input"
              :value="resultado.value"
              :disabled="saving"
            />
            <span>{{ resultado.label }}</span>
          </label>
        </div>
        <div v-if="error_de('resultado')" class="invalid-feedback d-block">{{ error_de('resultado') }}</div>
      </fieldset>

      <!-- Motivo: sólo con «No le interesa»; sale de la lista de motivos de pérdida del pipeline -->
      <div v-if="pide_motivo" class="rl-form__group">
        <label class="form-label mb-1" for="rl-motivo">Motivo<span class="rl-form__required" title="Obligatorio"> *</span></label>
        <select
          id="rl-motivo"
          v-model="form.motivo"
          class="form-select"
          :class="{ 'is-invalid': !!error_de('motivo') }"
          :disabled="saving"
        >
          <option value="">Elegí un motivo</option>
          <option v-for="motivo in motivos" :key="motivo" :value="motivo">{{ motivo }}</option>
        </select>
        <div v-if="error_de('motivo')" class="invalid-feedback d-block">{{ error_de('motivo') }}</div>
      </div>

      <!-- Fecha: obligatoria si no atendió o hay que volver a llamar; opcional con «Implementación acordada» -->
      <div v-if="pide_fecha" class="rl-form__group">
        <label class="form-label mb-1" for="rl-fecha">
          {{ fecha_obligatoria ? 'Volver a llamar el' : 'Retomar el (si no la ponés, en dos días)' }}
          <span v-if="fecha_obligatoria" class="rl-form__required" title="Obligatorio"> *</span>
        </label>
        <input
          id="rl-fecha"
          v-model="form.proxima_llamada_at"
          type="datetime-local"
          class="form-control"
          :class="{ 'is-invalid': !!error_de('proxima_llamada_at') }"
          :disabled="saving"
        />
        <div v-if="error_de('proxima_llamada_at')" class="invalid-feedback d-block">{{ error_de('proxima_llamada_at') }}</div>
      </div>

      <!-- Cotizado: queda en la tarjeta del tablero para ver de un vistazo qué precio se le pasó -->
      <div class="rl-form__group">
        <label class="form-label mb-1" for="rl-cotizado">Cotizado</label>
        <input
          id="rl-cotizado"
          v-model="form.cotizado"
          type="text"
          maxlength="255"
          class="form-control"
          :class="{ 'is-invalid': !!error_de('cotizado') }"
          placeholder="Ej.: Gestión $628.400, mitad $314.200"
          :disabled="saving"
        />
        <div v-if="error_de('cotizado')" class="invalid-feedback d-block">{{ error_de('cotizado') }}</div>
      </div>

      <!-- Notas: es lo que después leen Martín y Soporte para no volver a preguntarle lo mismo -->
      <div class="rl-form__group">
        <label class="form-label mb-1" for="rl-notas">Qué se habló</label>
        <textarea
          id="rl-notas"
          v-model="form.notas"
          rows="4"
          maxlength="5000"
          class="form-control"
          :class="{ 'is-invalid': !!error_de('notas') }"
          placeholder="Lo que contó del negocio, qué le interesó, qué quedó pendiente…"
          :disabled="saving"
        />
        <div v-if="error_de('notas')" class="invalid-feedback d-block">{{ error_de('notas') }}</div>
        <p class="rl-form__hint">Martín y Soporte leen estas notas para no volver a preguntarle lo que ya contó.</p>
      </div>

      <div v-if="server_message" class="alert alert-danger py-2 mb-0" role="alert">{{ server_message }}</div>
    </form>

    <template #footer>
      <button type="button" class="btn btn-secondary" :disabled="saving" @click="on_cancel">Cancelar</button>
      <button type="button" class="btn btn-primary" :disabled="saving" @click="on_submit">
        {{ saving ? 'Registrando…' : 'Registrar llamada' }}
      </button>
    </template>
  </base-modal>
</template>

<script>
import api from '@/utils/axios'
import BaseModal from '@/components/ui/BaseModal.vue'
import { first_error, show_toast, validation_errors } from '@/components/pipeline/pipeline_helpers'
import { RESULTADOS, admite_fecha, payload, requiere_fecha, requiere_motivo, validar } from '@/utils/registrar_llamada'

/** Slug del pipeline de leads, del que salen los motivos de pérdida. */
const SLUG_DEL_PIPELINE_DE_LEADS = 'lead'

/**
 * Modal «Registrar llamada».
 */
export default {
  name: 'RegistrarLlamadaModal',
  components: { BaseModal },
  props: {
    /** Visibilidad del modal. */
    show: { type: Boolean, default: true },
    /** Lead al que se le registra la llamada. */
    lead_id: { type: [Number, String], required: true },
    /** Nombre del lead (contacto y empresa), sólo para que se vea a quién se llamó. */
    lead_name: { type: String, default: '' },
    /** Nivel de apilamiento (1 cuando se abre encima de la ficha de la oportunidad). */
    stack_level: { type: Number, default: 0 },
  },
  emits: ['close', 'registrada'],
  data() {
    return {
      /** Valores del formulario (ver `utils/registrar_llamada.js`). */
      form: {
        atendio: null,
        resultado: '',
        motivo: '',
        proxima_llamada_at: '',
        cotizado: '',
        notas: '',
      },
      /** Errores por campo: los de la validación local y, después de mandar, los del 422 de la API. */
      errores: {},
      /** Mensaje general cuando la API rechaza por una regla que no es de un campo. */
      server_message: '',
      /** true mientras viaja el pedido: bloquea el doble clic. */
      saving: false,
      /** Resultados para los radios. */
      resultados: RESULTADOS,
    }
  },
  computed: {
    /**
     * Motivos de pérdida del pipeline de leads (los mismos que acepta la API en «No le interesa»).
     * @returns {Array<string>}
     */
    motivos() {
      const pipeline = this.$store.getters['pipeline/pipeline_by_id_or_slug'](SLUG_DEL_PIPELINE_DE_LEADS)
      const lista = pipeline && pipeline.lost_reasons
      return Array.isArray(lista) ? lista : []
    },
    /** @returns {boolean} true si hay que elegir el motivo. */
    pide_motivo() {
      return requiere_motivo(this.form)
    },
    /** @returns {boolean} true si se muestra la fecha. */
    pide_fecha() {
      return admite_fecha(this.form)
    },
    /** @returns {boolean} true si la fecha es obligatoria. */
    fecha_obligatoria() {
      return requiere_fecha(this.form)
    },
  },
  created() {
    // Si el modal se abre desde la conversación del lead, la lista de pipelines puede no estar
    // cargada todavía: sin ella no hay motivos para «No le interesa».
    if (!this.$store.state.pipeline.pipelines_loaded) {
      this.$store.dispatch('pipeline/fetch_pipelines').catch(function () {
        return null
      })
    }
  },
  methods: {
    /**
     * Mensaje de error de un campo (el local o, si no hay, el que devolvió la API).
     *
     * @param {string} campo
     * @returns {string}
     */
    error_de(campo) {
      return first_error(this.errores, campo)
    },
    /**
     * Elige si atendió. Al cambiar de respuesta se limpia lo que dependía de la anterior (el resultado
     * y el motivo sólo existen si atendió; la fecha cambia de significado).
     *
     * @param {boolean} atendio
     */
    elegir_atendio(atendio) {
      if (this.form.atendio === atendio) {
        return
      }
      this.form.atendio = atendio
      this.form.resultado = ''
      this.form.motivo = ''
      this.form.proxima_llamada_at = ''
      this.errores = {}
    },
    /**
     * Valida y manda el pedido. Si la API confirma, avisa al padre con la llamada y la tarjeta ya
     * movida (la forma del tablero) para que la cambie de columna sin esperar la recarga.
     */
    on_submit() {
      const self = this
      if (this.saving) {
        return
      }
      this.server_message = ''
      this.errores = validar(this.form, { motivos: this.motivos })
      if (Object.keys(this.errores).length > 0) {
        return
      }
      this.saving = true
      api
        .post('/lead/' + this.lead_id + '/llamadas', payload(this.form))
        .then(function (res) {
          const data = res.data || {}
          self.saving = false
          const columna = data.oportunidad && data.oportunidad.stage ? data.oportunidad.stage.name : ''
          show_toast(columna ? 'Llamada registrada. La tarjeta pasó a «' + columna + '».' : 'Llamada registrada.')
          self.$emit('registrada', {
            llamada: data.llamada || null,
            oportunidad: data.oportunidad || null,
            duplicada: data.duplicada === true,
          })
        })
        .catch(function (error) {
          self.saving = false
          self.errores = validation_errors(error)
          // Un 422 sin `errors` (una regla de negocio) o cualquier otro error: se muestra el mensaje.
          if (Object.keys(self.errores).length === 0) {
            const respuesta = error && error.response && error.response.data
            self.server_message = respuesta && respuesta.message ? String(respuesta.message) : 'No se pudo registrar la llamada. Probá de nuevo.'
          }
        })
    },
    /** Cierra sin guardar (no mientras viaja el pedido). */
    on_cancel() {
      if (!this.saving) {
        this.$emit('close')
      }
    },
  },
}
</script>

<style scoped>
.rl-form {
  min-width: 0;
}

.rl-form__lead {
  margin: 0 0 1rem;
  font-weight: 600;
  word-break: break-word;
}

.rl-form__group {
  margin: 0 0 1rem;
  padding: 0;
  border: 0;
  min-width: 0;
}

.rl-form__group legend {
  float: none;
  width: auto;
  padding: 0;
  font-size: 1rem;
}

.rl-form__required {
  color: var(--bs-danger, #dc3545);
}

.rl-form__choices {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.rl-form__choice {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  flex: 1 1 10rem;
  justify-content: center;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--color-text-primary);
  font-size: 0.9rem;
}

.rl-form__choice:hover:not(:disabled) {
  background: var(--bg-hover);
}

.rl-form__choice--selected,
.rl-form__choice--selected:hover:not(:disabled) {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--form-focus-ring);
  font-weight: 600;
}

.rl-form__results {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 0.5rem;
}

.rl-form__result {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  background: var(--bg-card);
  font-size: 0.9rem;
  cursor: pointer;
}

.rl-form__result--selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--form-focus-ring);
  font-weight: 600;
}

.rl-form__result .form-check-input {
  flex: 0 0 auto;
  margin: 0;
}

.rl-form__hint {
  margin: 0.35rem 0 0;
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}
</style>
