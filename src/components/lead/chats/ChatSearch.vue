<template>
  <div class="lead-chat-search">
    <i class="bi bi-search lead-chat-search__icon" aria-hidden="true" />
    <input
      :value="texto"
      type="search"
      class="form-control lead-chat-search__input"
      placeholder="Buscar por nombre, teléfono o negocio"
      aria-label="Buscar chats por nombre, teléfono o negocio"
      autocomplete="off"
      enterkeyhint="search"
      @input="on_input"
      @keydown.enter.prevent="disparar_ahora"
      @keydown.esc="limpiar"
    />
    <button
      v-if="texto"
      type="button"
      class="lead-chat-search__clear"
      title="Limpiar la búsqueda"
      aria-label="Limpiar la búsqueda"
      @click="limpiar"
    >
      <i class="bi bi-x-lg" aria-hidden="true" />
    </button>
  </div>
</template>

<script>
/**
 * Buscador de la lista de chats de leads (misión flujo-lead-landing-closer, 17/10/2026).
 *
 * Busca por nombre, teléfono o negocio: el servidor hace el `LIKE` sobre las tres columnas
 * (GET /lead/chats?q=), acá solo se junta lo tipeado y se avisa con un debounce de 400 ms, el
 * mismo que usa el buscador de chats de clientes en empresa-spa. Enter dispara al toque y Escape
 * limpia.
 *
 * `v-model` controlado desde afuera: si el padre resetea el texto (volver a Leads desde el menú),
 * el input lo refleja sin que haya que tocar nada acá.
 */
export default {
  name: 'LeadChatSearch',
  props: {
    /** Texto buscado (v-model). */
    modelValue: { type: String, default: '' },
    /** Espera entre la última tecla y el aviso al padre. */
    debounce_ms: { type: Number, default: 400 },
  },
  emits: ['update:modelValue', 'search'],
  data() {
    return {
      /** Copia local de lo tipeado: el v-model se emite recién al vencer el debounce. */
      texto: this.modelValue || '',
      /** Timer del debounce. */
      timer: null,
    }
  },
  watch: {
    /**
     * El padre cambió el valor por su cuenta (reset de filtros): se refleja sin disparar búsqueda.
     * @param {string} nuevo
     */
    modelValue(nuevo) {
      if ((nuevo || '') !== this.texto) {
        this.texto = nuevo || ''
      }
    },
  },
  beforeUnmount() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  },
  methods: {
    /**
     * Cada tecla reprograma el debounce.
     * @param {Event} event
     */
    on_input(event) {
      this.texto = event && event.target ? event.target.value : ''
      if (this.timer) {
        clearTimeout(this.timer)
      }
      var self = this
      this.timer = setTimeout(function () {
        self.timer = null
        self.emitir()
      }, this.debounce_ms)
    },
    /**
     * Enter: no espera el debounce.
     */
    disparar_ahora() {
      if (this.timer) {
        clearTimeout(this.timer)
        this.timer = null
      }
      this.emitir()
    },
    /**
     * La cruz y Escape vacían el texto y avisan al toque.
     */
    limpiar() {
      if (this.timer) {
        clearTimeout(this.timer)
        this.timer = null
      }
      this.texto = ''
      this.emitir()
    },
    /**
     * Avisa al padre con el texto ya recortado. `update:modelValue` para el v-model y `search`
     * para el que quiera enganchar la carga sin mirar el valor.
     */
    emitir() {
      var valor = (this.texto || '').trim()
      this.$emit('update:modelValue', valor)
      this.$emit('search', valor)
    },
  },
}
</script>

<style scoped>
.lead-chat-search {
  position: relative;
  display: flex;
  align-items: center;
}

.lead-chat-search__icon {
  position: absolute;
  left: 0.75rem;
  color: var(--bs-secondary-color);
  pointer-events: none;
  font-size: 0.9rem;
}

/* Pastilla redondeada estilo WhatsApp; el padding izquierdo deja lugar a la lupa y el derecho a la cruz. */
.lead-chat-search__input {
  padding-left: 2.2rem;
  padding-right: 2.2rem;
  border-radius: 999px;
  background-color: var(--bs-tertiary-bg, #f0f2f5);
  border-color: transparent;
}

.lead-chat-search__input:focus {
  background-color: #fff;
  border-color: rgba(13, 110, 253, 0.45);
  box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.12);
}

/* El navegador ya dibuja su propia cruz en type="search"; se saca para no tener dos. */
.lead-chat-search__input::-webkit-search-cancel-button {
  -webkit-appearance: none;
  appearance: none;
}

.lead-chat-search__clear {
  position: absolute;
  right: 0.35rem;
  width: 1.7rem;
  height: 1.7rem;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--bs-secondary-color);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.8rem;
}

.lead-chat-search__clear:hover {
  background: var(--bs-secondary-bg);
}
</style>
