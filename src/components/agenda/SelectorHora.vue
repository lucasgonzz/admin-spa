<template>
  <!--
    Campo de hora en 24 h para el panel de la tarea. No se usa <input type="time"> porque el
    navegador lo muestra según su idioma (en un Chrome en inglés sale "10:00 AM") y el pedido es
    24 h siempre. Se escribe a mano ("930", "9:30", "21.15") o se elige de la lista de cuartos de
    hora que se abre al enfocarlo. Con `desde` (el campo de fin) la lista arranca después del
    inicio y muestra cuánto dura cada opción, como en Google Calendar.
  -->
  <div ref="raiz" class="ag-hora">
    <input
      ref="input"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      class="ag-hora__input"
      maxlength="5"
      :value="texto"
      :aria-label="etiqueta"
      :aria-expanded="abierto ? 'true' : 'false'"
      role="combobox"
      @focus="abrir"
      @click="abrir"
      @input="texto = $event.target.value"
      @keydown.enter.prevent="confirmar_texto(true)"
      @keydown.esc.stop.prevent="cancelar"
      @keydown.tab="confirmar_texto(false)"
      @blur="confirmar_texto(false)"
    />
    <ul v-if="abierto" ref="lista" class="ag-hora__lista" role="listbox" :aria-label="etiqueta">
      <li
        v-for="opcion in opciones"
        :key="'ag-hora-' + opcion.minutos"
        role="option"
        class="ag-hora__opcion"
        :class="{ 'ag-hora__opcion--activa': opcion.valor === modelValue }"
        :aria-selected="opcion.valor === modelValue ? 'true' : 'false'"
        :data-activa="opcion.valor === modelValue ? '1' : null"
        @mousedown.prevent="elegir(opcion.valor)"
      >
        <span>{{ opcion.valor }}</span>
        <span v-if="opcion.extra" class="ag-hora__extra">{{ opcion.extra }}</span>
      </li>
    </ul>
  </div>
</template>

<script>
import { hora_de_minutos, minutos_de_hora, texto_duracion, MINUTOS_DIA } from './agenda_utils'

/** Paso de la lista de horas, en minutos. */
const PASO_LISTA = 15

export default {
  name: 'AgendaSelectorHora',
  props: {
    /** Hora elegida `HH:MM` (v-model). */
    modelValue: { type: String, default: '09:00' },
    /** Hora de inicio `HH:MM` si este es el campo de fin (la lista muestra duraciones). */
    desde: { type: String, default: null },
    /** Texto para lectores de pantalla ("Hora de inicio"). */
    etiqueta: { type: String, default: 'Hora' },
  },
  emits: ['update:modelValue'],
  data() {
    return {
      /** Lo que está escrito en el campo (puede no ser una hora válida mientras se tipea). */
      texto: this.modelValue || '',
      /** true si la lista está desplegada. */
      abierto: false,
    }
  },
  computed: {
    /**
     * Opciones de la lista: todo el día de 15 en 15, o (campo de fin) de 15 min a 12 h después
     * del inicio, con la duración al lado.
     *
     * @returns {Array<{minutos: number, valor: string, extra: string}>}
     */
    opciones() {
      const opciones = []
      if (this.desde) {
        const inicio = minutos_de_hora(this.desde) || 0
        for (let duracion = PASO_LISTA; duracion <= 12 * 60; duracion = duracion + PASO_LISTA) {
          opciones.push({
            minutos: inicio + duracion,
            valor: hora_de_minutos(inicio + duracion),
            extra: '(' + texto_duracion(duracion) + ')',
          })
        }
        return opciones
      }
      for (let minutos = 0; minutos < MINUTOS_DIA; minutos = minutos + PASO_LISTA) {
        opciones.push({ minutos: minutos, valor: hora_de_minutos(minutos), extra: '' })
      }
      return opciones
    },
  },
  watch: {
    /** Si la hora cambia desde afuera (otro campo, un chip de duración), se refleja en el texto. */
    modelValue(valor) {
      this.texto = valor || ''
    },
  },
  beforeUnmount() {
    this.abierto = false
  },
  methods: {
    /**
     * Abre la lista y la lleva a la opción elegida.
     *
     * @returns {void}
     */
    abrir() {
      const self = this
      if (self.abierto) {
        return
      }
      self.abierto = true
      self.$nextTick(function () {
        const lista = self.$refs.lista
        if (!lista) {
          return
        }
        const activa = lista.querySelector('[data-activa="1"]')
        if (activa) {
          lista.scrollTop = activa.offsetTop - lista.clientHeight / 2 + activa.clientHeight / 2
        }
      })
    },
    /**
     * Elige una opción de la lista.
     *
     * @param {string} valor `HH:MM`
     * @returns {void}
     */
    elegir(valor) {
      this.texto = valor
      this.abierto = false
      this.$emit('update:modelValue', valor)
      if (this.$refs.input) {
        this.$refs.input.blur()
      }
    },
    /**
     * Interpreta lo escrito ("930" → 09:30, "21.15" → 21:15, "9" → 09:00). Si no es una hora, vuelve
     * al valor anterior.
     *
     * @param {boolean} sacar_foco true para soltar el foco (Enter).
     * @returns {void}
     */
    confirmar_texto(sacar_foco) {
      if (!this.abierto && this.texto === this.modelValue) {
        return
      }
      this.abierto = false
      const valor = this.interpretar(this.texto)
      if (valor === null) {
        this.texto = this.modelValue || ''
      } else {
        this.texto = valor
        if (valor !== this.modelValue) {
          this.$emit('update:modelValue', valor)
        }
      }
      if (sacar_foco && this.$refs.input) {
        this.$refs.input.blur()
      }
    },
    /**
     * Escape: cierra la lista y deja el valor como estaba.
     *
     * @returns {void}
     */
    cancelar() {
      this.abierto = false
      this.texto = this.modelValue || ''
      if (this.$refs.input) {
        this.$refs.input.blur()
      }
    },
    /**
     * Convierte un texto tipeado en `HH:MM` (o null si no es una hora válida).
     *
     * @param {string} texto
     * @returns {string|null}
     */
    interpretar(texto) {
      const limpio = String(texto || '').trim().replace(/[.,h\s]/g, ':')
      let horas = null
      let minutos = 0
      if (/^\d{1,2}:\d{1,2}$/.test(limpio)) {
        const partes = limpio.split(':')
        horas = parseInt(partes[0], 10)
        minutos = parseInt(partes[1].length === 1 ? partes[1] + '0' : partes[1], 10)
      } else if (/^\d{1,2}:?$/.test(limpio)) {
        horas = parseInt(limpio, 10)
      } else if (/^\d{3,4}$/.test(limpio)) {
        horas = parseInt(limpio.substring(0, limpio.length - 2), 10)
        minutos = parseInt(limpio.substring(limpio.length - 2), 10)
      }
      if (horas === null || isNaN(horas) || isNaN(minutos) || horas > 23 || minutos > 59) {
        return null
      }
      return hora_de_minutos(horas * 60 + minutos)
    },
  },
}
</script>

<style scoped>
.ag-hora {
  position: relative;
  display: inline-block;
}

.ag-hora__input {
  width: 62px;
  padding: 2px 4px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ag-texto);
  font-size: 16px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  outline: none;
}

.ag-hora__input:hover,
.ag-hora__input:focus {
  background: rgba(255, 255, 255, 0.07);
}

.ag-hora__lista {
  position: absolute;
  top: calc(100% + 6px);
  left: -8px;
  z-index: 60;
  width: 170px;
  max-height: 232px;
  margin: 0;
  padding: 6px;
  overflow-y: auto;
  list-style: none;
  border: 1px solid var(--ag-borde);
  border-radius: 12px;
  background: var(--ag-elevado);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
  scrollbar-width: thin;
}

.ag-hora__opcion {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  color: var(--ag-texto);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}

.ag-hora__opcion:hover {
  background: rgba(255, 255, 255, 0.08);
}

.ag-hora__opcion--activa,
.ag-hora__opcion--activa:hover {
  background: var(--ag-salmon);
}

.ag-hora__extra {
  color: var(--ag-apagado);
  font-size: 12px;
}

.ag-hora__opcion--activa .ag-hora__extra {
  color: rgba(255, 255, 255, 0.85);
}
</style>
