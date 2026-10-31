<template>
  <!--
    Barra flotante de la selección múltiple (capturas 16 y 17 de Structured): «N seleccionadas |
    Seleccionar todas», el grupo de acciones (Reprogramar ⌄, Fecha ⌄, Color ⌄, marcar hechas, borrar
    y ⋯ con Duplicar / Mover a la bandeja) y el botón salmón «Listo» que sale del modo.
    La barra solo avisa qué se eligió: las llamadas a la API (una por tarea, en paralelo) las hace
    el orquestador.
  -->
  <div ref="raiz" class="ag-barra" :class="{ 'ag-barra--telefono': es_telefono }" role="toolbar" aria-label="Selección múltiple">
    <div class="ag-barra__grupo ag-barra__grupo--cuenta">
      <span class="ag-barra__cuenta">{{ texto_cantidad }}</span>
      <span class="ag-barra__separador" aria-hidden="true" />
      <button type="button" class="ag-barra__boton" :disabled="ocupado" @click="$emit('seleccionar-todas')">
        {{ todas_elegidas ? 'Quitar selección' : 'Seleccionar todas' }}
      </button>
    </div>

    <div class="ag-barra__grupo">
      <!-- Reprogramar: correr la hora de todas -->
      <div ref="pop_reprogramar" class="ag-barra__zona">
        <button
          type="button"
          class="ag-barra__boton"
          :class="{ 'ag-barra__boton--abierto': popover === 'reprogramar' }"
          :disabled="sin_seleccion"
          :aria-expanded="popover === 'reprogramar' ? 'true' : 'false'"
          aria-label="Reprogramar"
          @click="alternar_popover('reprogramar')"
        >
          <i class="bi bi-calendar2-week" aria-hidden="true" />
          <span class="ag-barra__rotulo">Reprogramar</span>
          <i class="bi bi-chevron-down ag-barra__chevron" aria-hidden="true" />
        </button>
        <div v-if="popover === 'reprogramar'" class="ag-barra__pop ag-barra__pop--reprogramar" role="dialog" aria-label="Reprogramar">
          <div class="ag-barra__selects">
            <select v-model.number="desplazar_horas" class="ag-barra__select" aria-label="Horas">
              <option v-for="hora in opciones_horas" :key="'ag-br-h-' + hora" :value="hora">{{ hora }}h</option>
            </select>
            <select v-model.number="desplazar_minutos" class="ag-barra__select" aria-label="Minutos">
              <option v-for="minuto in opciones_minutos" :key="'ag-br-m-' + minuto" :value="minuto">{{ minuto }}m</option>
            </select>
            <select v-model="desplazar_sentido" class="ag-barra__select ag-barra__select--ancho" aria-label="Sentido">
              <option value="adelante">Adelante</option>
              <option value="atras">Atrás</option>
            </select>
          </div>
          <button type="button" class="ag-barra__mover" :disabled="desplazamiento === 0 || ocupado" @click="reprogramar">
            Mover tareas
          </button>
        </div>
      </div>
      <span class="ag-barra__separador" aria-hidden="true" />

      <!-- Fecha: cambiar el día manteniendo la hora -->
      <div ref="pop_fecha" class="ag-barra__zona">
        <button
          type="button"
          class="ag-barra__boton"
          :class="{ 'ag-barra__boton--abierto': popover === 'fecha' }"
          :disabled="sin_seleccion"
          :aria-expanded="popover === 'fecha' ? 'true' : 'false'"
          aria-label="Fecha"
          @click="alternar_popover('fecha')"
        >
          <i class="bi bi-calendar3" aria-hidden="true" />
          <span class="ag-barra__rotulo">Fecha</span>
          <i class="bi bi-chevron-down ag-barra__chevron" aria-hidden="true" />
        </button>
        <div v-if="popover === 'fecha'" class="ag-barra__pop ag-barra__pop--lista" role="menu">
          <button
            v-for="opcion in opciones_fecha"
            :key="'ag-br-f-' + opcion.fecha"
            type="button"
            class="ag-barra__item"
            role="menuitem"
            @click="cambiar_fecha(opcion.fecha)"
          >
            <span>{{ opcion.rotulo }}</span>
            <span class="ag-barra__item-extra">{{ opcion.detalle }}</span>
          </button>
          <label class="ag-barra__item ag-barra__item--fecha">
            <span>Elegir fecha…</span>
            <i class="bi bi-calendar-event" aria-hidden="true" />
            <input
              type="date"
              class="ag-barra__fecha-input"
              aria-label="Elegir fecha"
              @click="abrir_selector_fecha($event)"
              @change="cambiar_fecha($event.target.value)"
            />
          </label>
        </div>
      </div>
      <span class="ag-barra__separador" aria-hidden="true" />

      <!-- Color -->
      <div ref="pop_color" class="ag-barra__zona">
        <button
          type="button"
          class="ag-barra__boton"
          :class="{ 'ag-barra__boton--abierto': popover === 'color' }"
          :disabled="sin_seleccion"
          :aria-expanded="popover === 'color' ? 'true' : 'false'"
          aria-label="Color"
          @click="alternar_popover('color')"
        >
          <i class="bi bi-palette" aria-hidden="true" />
          <span class="ag-barra__rotulo">Color</span>
          <i class="bi bi-chevron-down ag-barra__chevron" aria-hidden="true" />
        </button>
        <div v-if="popover === 'color'" class="ag-barra__pop ag-barra__pop--color" role="radiogroup" aria-label="Color">
          <button
            v-for="opcion in paleta"
            :key="'ag-br-c-' + opcion.clave"
            type="button"
            class="ag-barra__color"
            :style="{ backgroundColor: opcion.hex }"
            :aria-label="opcion.nombre"
            :title="opcion.nombre"
            @click="cambiar_color(opcion.clave)"
          />
        </div>
      </div>
      <span class="ag-barra__separador" aria-hidden="true" />

      <!-- Marcar hechas -->
      <button
        type="button"
        class="ag-barra__boton ag-barra__boton--icono"
        :disabled="sin_seleccion || ocupado"
        aria-label="Marcar como hechas"
        title="Marcar como hechas"
        @click="accion('completar')"
      >
        <i class="bi bi-circle" aria-hidden="true" />
      </button>
      <span class="ag-barra__separador" aria-hidden="true" />

      <!-- Borrar -->
      <button
        type="button"
        class="ag-barra__boton ag-barra__boton--icono"
        :disabled="sin_seleccion || ocupado"
        aria-label="Borrar"
        title="Borrar"
        @click="accion('borrar')"
      >
        <i class="bi bi-trash3-fill" aria-hidden="true" />
      </button>
      <span class="ag-barra__separador" aria-hidden="true" />

      <!-- Más: Duplicar / Mover a la bandeja -->
      <div ref="pop_mas" class="ag-barra__zona">
        <button
          type="button"
          class="ag-barra__boton ag-barra__boton--icono"
          :disabled="sin_seleccion"
          :aria-expanded="popover === 'mas' ? 'true' : 'false'"
          aria-label="Más acciones"
          @click="alternar_popover('mas')"
        >
          <i class="bi bi-three-dots" aria-hidden="true" />
        </button>
        <div v-if="popover === 'mas'" class="ag-barra__pop ag-barra__pop--lista ag-barra__pop--derecha" role="menu">
          <button type="button" class="ag-barra__item" role="menuitem" :disabled="ocupado" @click="accion('duplicar')">
            <span><i class="bi bi-copy" aria-hidden="true" /> Duplicar</span>
          </button>
          <button type="button" class="ag-barra__item" role="menuitem" :disabled="ocupado" @click="accion('mover-bandeja')">
            <span><i class="bi bi-inbox" aria-hidden="true" /> Mover a la bandeja</span>
          </button>
        </div>
      </div>
    </div>

    <button type="button" class="ag-barra__listo" @click="$emit('listo')">
      <span v-if="ocupado" class="ag-barra__girando" aria-hidden="true" />
      Listo
    </button>
  </div>
</template>

<script>
import { PALETA, sumar_dias, fecha_corta, dia_semana } from './agenda_utils'

export default {
  name: 'AgendaBarraSeleccion',
  props: {
    /** Cuántas tareas hay elegidas. */
    cantidad: { type: Number, default: 0 },
    /** true si ya están elegidas todas las visibles (el botón pasa a "Quitar selección"). */
    todas_elegidas: { type: Boolean, default: false },
    /** true mientras corren las llamadas de una acción masiva. */
    ocupado: { type: Boolean, default: false },
    /** Hoy (`YYYY-MM-DD`), para los atajos de fecha. */
    hoy: { type: String, required: true },
    /** true en teléfono (solo íconos, en dos filas). */
    es_telefono: { type: Boolean, default: false },
  },
  emits: [
    'seleccionar-todas',
    'reprogramar',
    'cambiar-fecha',
    'cambiar-color',
    'completar',
    'borrar',
    'duplicar',
    'mover-bandeja',
    'listo',
  ],
  data() {
    return {
      /** Popover abierto: null | 'reprogramar' | 'fecha' | 'color' | 'mas'. */
      popover: null,
      /** Horas a correr en Reprogramar. */
      desplazar_horas: 0,
      /** Minutos a correr en Reprogramar. */
      desplazar_minutos: 0,
      /** Sentido del corrimiento: 'adelante' | 'atras'. */
      desplazar_sentido: 'adelante',
    }
  },
  computed: {
    /**
     * "1 seleccionada" / "3 seleccionadas".
     *
     * @returns {string}
     */
    texto_cantidad() {
      return this.cantidad === 1 ? '1 seleccionada' : this.cantidad + ' seleccionadas'
    },
    /**
     * true si no hay nada elegido (las acciones se apagan).
     *
     * @returns {boolean}
     */
    sin_seleccion() {
      return this.cantidad === 0
    },
    /**
     * Opciones de horas (0 a 23).
     *
     * @returns {number[]}
     */
    opciones_horas() {
      const lista = []
      for (let hora = 0; hora < 24; hora++) {
        lista.push(hora)
      }
      return lista
    },
    /**
     * Opciones de minutos (de 5 en 5).
     *
     * @returns {number[]}
     */
    opciones_minutos() {
      const lista = []
      for (let minuto = 0; minuto < 60; minuto = minuto + 5) {
        lista.push(minuto)
      }
      return lista
    },
    /**
     * Corrimiento total en minutos, con signo.
     *
     * @returns {number}
     */
    desplazamiento() {
      const total = this.desplazar_horas * 60 + this.desplazar_minutos
      return this.desplazar_sentido === 'atras' ? -total : total
    },
    /**
     * Atajos de fecha: hoy, mañana y el lunes que viene.
     *
     * @returns {Array<{rotulo: string, fecha: string, detalle: string}>}
     */
    opciones_fecha() {
      const manana = sumar_dias(this.hoy, 1)
      const dias_al_lunes = ((8 - dia_semana(this.hoy)) % 7) || 7
      const lunes = sumar_dias(this.hoy, dias_al_lunes)
      return [
        { rotulo: 'Hoy', fecha: this.hoy, detalle: fecha_corta(this.hoy) },
        { rotulo: 'Mañana', fecha: manana, detalle: fecha_corta(manana) },
        { rotulo: 'La semana que viene', fecha: lunes, detalle: fecha_corta(lunes) },
      ]
    },
    /**
     * Paleta de colores.
     *
     * @returns {Array<Object>}
     */
    paleta() {
      return PALETA
    },
  },
  mounted() {
    document.addEventListener('mousedown', this.on_click_documento, true)
  },
  beforeUnmount() {
    document.removeEventListener('mousedown', this.on_click_documento, true)
  },
  methods: {
    /**
     * Abre o cierra un popover de la barra.
     *
     * @param {string} nombre
     * @returns {void}
     */
    alternar_popover(nombre) {
      this.popover = this.popover === nombre ? null : nombre
    },
    /**
     * Cierra el popover abierto si el clic cayó fuera de él y de su botón.
     *
     * @param {MouseEvent} evento
     * @returns {void}
     */
    on_click_documento(evento) {
      if (!this.popover) {
        return
      }
      const zona = this.$refs['pop_' + this.popover]
      if (zona && zona.contains(evento.target)) {
        return
      }
      this.popover = null
    },
    /**
     * Abre el calendario nativo del input de fecha.
     *
     * @param {MouseEvent} evento
     * @returns {void}
     */
    abrir_selector_fecha(evento) {
      const input = evento.target
      if (input && typeof input.showPicker === 'function') {
        try {
          input.showPicker()
        } catch (error) {
          /* Fuera de un gesto directo algunos navegadores lo rechazan: queda el nativo. */
        }
      }
    },
    /**
     * Reprogramar → "Mover tareas": avisa el corrimiento y vuelve los selects a cero.
     *
     * @returns {void}
     */
    reprogramar() {
      if (this.desplazamiento === 0) {
        return
      }
      this.$emit('reprogramar', this.desplazamiento)
      this.popover = null
      this.desplazar_horas = 0
      this.desplazar_minutos = 0
      this.desplazar_sentido = 'adelante'
    },
    /**
     * Fecha elegida (atajo o calendario).
     *
     * @param {string} fecha `YYYY-MM-DD`
     * @returns {void}
     */
    cambiar_fecha(fecha) {
      if (!fecha) {
        return
      }
      this.popover = null
      this.$emit('cambiar-fecha', fecha)
    },
    /**
     * Color elegido.
     *
     * @param {string} clave
     * @returns {void}
     */
    cambiar_color(clave) {
      this.popover = null
      this.$emit('cambiar-color', clave)
    },
    /**
     * Acciones sin parámetros (completar, borrar, duplicar, mover a la bandeja).
     *
     * @param {string} nombre Nombre del evento.
     * @returns {void}
     */
    accion(nombre) {
      this.popover = null
      this.$emit(nombre)
    },
  },
}
</script>

<style scoped>
.ag-barra {
  position: absolute;
  bottom: 22px;
  left: 50%;
  z-index: 25;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: calc(100% - 24px);
  transform: translateX(-50%);
  white-space: nowrap;
}

.ag-barra__grupo {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 40px;
  padding: 0 8px;
  border: 1px solid var(--ag-borde);
  border-radius: 20px;
  background: rgba(28, 28, 30, 0.96);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
}

.ag-barra__cuenta {
  padding: 0 6px;
  color: var(--ag-salmon);
  font-size: 12px;
  font-weight: 600;
}

.ag-barra__separador {
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: #48484a;
}

.ag-barra__zona {
  position: relative;
}

.ag-barra__boton {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 8px;
  border: 0;
  border-radius: 15px;
  background: transparent;
  color: #c8c8ca;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.ag-barra__boton:hover:not(:disabled),
.ag-barra__boton--abierto {
  background: rgba(255, 255, 255, 0.08);
  color: var(--ag-texto);
}

.ag-barra__boton:disabled {
  color: #5c5c5e;
  cursor: default;
}

.ag-barra__boton--icono {
  width: 32px;
  justify-content: center;
  padding: 0;
  font-size: 14px;
}

.ag-barra__chevron {
  font-size: 10px;
}

.ag-barra__listo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 26px;
  border: 0;
  border-radius: 20px;
  background: var(--ag-salmon);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
}

.ag-barra__girando {
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: ag-barra-girar 0.8s linear infinite;
}

@keyframes ag-barra-girar {
  to {
    transform: rotate(360deg);
  }
}

/* Popovers: arriba de la barra. */
.ag-barra__pop {
  position: absolute;
  bottom: calc(100% + 14px);
  left: 0;
  z-index: 30;
  padding: 10px;
  border: 1px solid var(--ag-borde);
  border-radius: 16px;
  background: var(--ag-superficie);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
  white-space: normal;
}

.ag-barra__pop--derecha {
  right: 0;
  left: auto;
}

.ag-barra__pop--reprogramar {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  width: 250px;
  left: -60px;
  padding: 12px;
}

.ag-barra__selects {
  display: flex;
  gap: 8px;
  width: 100%;
}

.ag-barra__select {
  flex: 1 1 0;
  min-width: 0;
  height: 32px;
  padding: 0 8px;
  border: 1px solid #48484a;
  border-radius: 16px;
  background: #2c2c2e;
  color: var(--ag-texto);
  font-size: 12px;
  font-weight: 500;
  color-scheme: dark;
  cursor: pointer;
}

.ag-barra__select--ancho {
  flex-grow: 1.6;
}

.ag-barra__mover {
  height: 30px;
  padding: 0 14px;
  border: 0;
  border-radius: 15px;
  background: var(--ag-salmon);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.ag-barra__mover:disabled {
  background: #5a3836;
  color: #a77;
  cursor: default;
}

.ag-barra__pop--lista {
  display: flex;
  flex-direction: column;
  width: 240px;
  padding: 6px;
}

.ag-barra__item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0;
  padding: 8px 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--ag-texto);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.ag-barra__item:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
}

.ag-barra__item .bi {
  color: var(--ag-salmon);
}

.ag-barra__item-extra {
  color: var(--ag-apagado);
  font-size: 12px;
}

.ag-barra__fecha-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  color-scheme: dark;
}

.ag-barra__pop--color {
  display: grid;
  grid-template-columns: repeat(5, 30px);
  gap: 8px;
}

.ag-barra__color {
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.1s ease;
}

.ag-barra__color:hover {
  transform: scale(1.12);
}

/* Teléfono: dos filas (cuenta arriba, acciones y Listo abajo), solo íconos. */
.ag-barra--telefono {
  bottom: 12px;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  width: calc(100% - 16px);
}

.ag-barra--telefono .ag-barra__rotulo,
.ag-barra--telefono .ag-barra__chevron {
  display: none;
}

.ag-barra--telefono .ag-barra__grupo {
  padding: 0 4px;
}

.ag-barra--telefono .ag-barra__separador {
  margin: 0 1px;
}

.ag-barra--telefono .ag-barra__boton:not(.ag-barra__boton--icono) {
  padding: 0 7px;
}

.ag-barra--telefono .ag-barra__listo {
  padding: 0 16px;
}

.ag-barra--telefono .ag-barra__pop--reprogramar {
  left: -10px;
}
</style>
