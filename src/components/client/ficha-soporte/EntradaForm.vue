<template>
  <!--
    Formulario de una entrada de la ficha: lo usa «Agregar» (sin `entrada`) y «Editar» (con
    `entrada`). Editar NO pisa la entrada: admin-api crea una nueva vigente que reemplaza a la
    vieja (queda como «reemplazada» en el historial), igual que cuando lo hace Martín.
  -->
  <form class="ficha-form" @submit.prevent="enviar">
    <div class="row g-2">
      <div class="col-12 col-sm-6 col-lg-4">
        <label class="form-label small mb-1" :for="id_base + '-categoria'">Categoría</label>
        <select
          :id="id_base + '-categoria'"
          v-model="categoria"
          class="form-select form-select-sm"
          :disabled="guardando">
          <option v-for="c in categorias" :key="c.key" :value="c.key">{{ c.singular }}</option>
        </select>
      </div>
      <div class="col-12 col-sm-6 col-lg-4">
        <label class="form-label small mb-1" :for="id_base + '-vence'">
          Vigente hasta <span class="text-muted">(opcional)</span>
        </label>
        <input
          :id="id_base + '-vence'"
          v-model="vigente_hasta"
          type="date"
          class="form-control form-control-sm"
          :disabled="guardando">
      </div>
      <div class="col-12">
        <label class="form-label small mb-1" :for="id_base + '-texto'">Texto</label>
        <textarea
          :id="id_base + '-texto'"
          ref="texto"
          v-model="texto"
          class="form-control form-control-sm"
          rows="3"
          :maxlength="texto_max"
          :disabled="guardando"
          placeholder="Una idea por entrada, en tercera persona. Ej.: «Arrancamos la carga de artículos el lunes 17»."></textarea>
        <div class="d-flex justify-content-between gap-2 mt-1">
          <small class="text-muted ficha-form__ayuda">{{ ayuda }}</small>
          <small class="text-muted flex-shrink-0" :class="{ 'text-danger': texto.length >= texto_max }">
            {{ texto.length }}/{{ texto_max }}
          </small>
        </div>
      </div>
    </div>
    <div v-if="error" class="alert alert-danger py-2 px-2 small mt-2 mb-0">{{ error }}</div>
    <div class="d-flex flex-wrap justify-content-end gap-2 mt-2">
      <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="guardando" @click="$emit('cancelar')">
        Cancelar
      </button>
      <button type="submit" class="btn btn-sm btn-primary" :disabled="!puede_enviar">
        <span v-if="guardando" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
        {{ entrada ? 'Guardar cambios' : 'Agregar a la ficha' }}
      </button>
    </div>
  </form>
</template>

<script>
import { CATEGORIAS, TEXTO_MAX, categoria_de, fecha_para_input } from './categorias'

/**
 * Formulario de alta / edición de una entrada de la ficha de soporte.
 *
 * No habla con la API: emite `enviar` con `{categoria, texto, vigente_hasta}` y el padre hace el
 * POST (agregar) o el PUT (reemplazar). El padre le devuelve `guardando` y `error`.
 *
 * Eventos:
 *   enviar   - {categoria, texto, vigente_hasta|null}
 *   cancelar - cierra el formulario sin guardar
 */
export default {
  name: 'FichaSoporteEntradaForm',
  emits: ['enviar', 'cancelar'],
  props: {
    /** Entrada a editar; null para una nueva. */
    entrada: { type: Object, default: null },
    /** Categoría con la que arranca una entrada nueva. */
    categoria_inicial: { type: String, default: 'decision' },
    /** true mientras el padre guarda. */
    guardando: { type: Boolean, default: false },
    /** Mensaje de error del guardado (tal cual lo devuelve admin-api). */
    error: { type: String, default: '' },
  },
  data() {
    const e = this.entrada
    return {
      categorias: CATEGORIAS,
      texto_max: TEXTO_MAX,
      categoria: e ? categoria_de(e.categoria).key : this.categoria_inicial,
      texto: e ? String(e.texto || '') : '',
      vigente_hasta: e ? fecha_para_input(e.vigente_hasta) : '',
      // Prefijo de ids para que los label apunten a su campo aunque haya varios formularios abiertos.
      id_base: 'ficha-form-' + (e ? e.id : 'nueva') + '-' + Math.random().toString(36).slice(2, 7),
    }
  },
  computed: {
    /** Texto de ayuda de la categoría elegida. */
    ayuda() {
      return categoria_de(this.categoria).ayuda
    },
    /** Hay texto y, si es una edición, algo cambió. */
    puede_enviar() {
      if (this.guardando || this.texto.trim() === '') {
        return false
      }
      if (!this.entrada) {
        return true
      }
      return this.texto.trim() !== String(this.entrada.texto || '').trim()
        || this.categoria !== this.entrada.categoria
        || this.vigente_hasta !== fecha_para_input(this.entrada.vigente_hasta)
    },
  },
  mounted() {
    if (this.$refs.texto) {
      this.$refs.texto.focus()
    }
  },
  methods: {
    /** Emite el cuerpo listo para la API. */
    enviar() {
      if (!this.puede_enviar) {
        return
      }
      this.$emit('enviar', {
        categoria: this.categoria,
        texto: this.texto.trim(),
        vigente_hasta: this.vigente_hasta ? this.vigente_hasta : null,
      })
    },
  },
}
</script>

<style scoped lang="scss">
.ficha-form {
	background: #fff;
	border: 1px solid var(--bs-border-color);
	border-radius: 0.5rem;
	padding: 0.75rem;
}

.ficha-form__ayuda {
	min-width: 0;
}
</style>
