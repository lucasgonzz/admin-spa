<template>
  <!--
    Panel de la tarea, el de la derecha de Structured (capturas 03, 07, 14 y 15): cabecera del
    color de la tarea con la píldora vertical del ícono (un cuadrado si está en la bandeja), el
    botón de paleta, el título editable, el círculo de hecho, ⋯ y ✕; en el cuerpo, fecha y "Todo el
    día", hora de inicio y fin (24 h) con la duración, Repetir, la caja de subpasos y notas; en el
    pie, el tacho y "Crear tarea" / "Guardar cambios". Cerrar con cambios sin guardar pregunta
    "¿Descartar cambios?". En teléfono ocupa toda la pantalla.

    El panel llama a la API por su cuenta (agenda_api.js) y avisa con `guardado` / `cambio` para que
    el orquestador refresque el rango visible.
  -->
  <div class="ag-panel-capa" :class="{ 'ag-panel-capa--telefono': es_telefono }">
    <div class="ag-panel-capa__fondo" aria-hidden="true" @mousedown="intentar_cerrar" />

    <section
      class="ag-panel"
      role="dialog"
      aria-modal="true"
      :aria-label="es_nueva ? 'Tarea nueva' : 'Tarea: ' + (form.title || '')"
      :style="{ '--ag-color-tarea': color_tarea, '--ag-tinta': tinta }"
    >
      <div class="ag-panel__caja">
        <!-- ===== Cabecera del color de la tarea ===== -->
        <header class="ag-panel__cabecera" :class="{ 'ag-panel__cabecera--bandeja': en_bandeja }" :style="{ backgroundColor: color_cabecera }">
          <div class="ag-panel__icono-zona">
            <template v-if="!en_bandeja">
              <span class="ag-panel__vecina ag-panel__vecina--arriba" aria-hidden="true" />
              <span class="ag-panel__vecina ag-panel__vecina--abajo" aria-hidden="true" />
            </template>
            <span class="ag-panel__pildora" :class="{ 'ag-panel__pildora--cuadrada': en_bandeja }">
              <i class="bi" :class="'bi-' + form.icon" aria-hidden="true" />
            </span>
            <div ref="pop_color" class="ag-panel__paleta-zona">
              <button
                type="button"
                class="ag-panel__paleta"
                aria-label="Color e ícono"
                title="Color e ícono"
                :aria-expanded="popover === 'color' ? 'true' : 'false'"
                @click="alternar_popover('color')"
              >
                <i class="bi bi-palette-fill" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div class="ag-panel__encabezado">
            <p class="ag-panel__etiqueta">{{ etiqueta_horario }}</p>
            <textarea
              ref="input_titulo"
              v-model="form.title"
              class="ag-panel__titulo"
              rows="1"
              maxlength="500"
              placeholder="Estructurá tu día"
              aria-label="Título de la tarea"
              @input="ajustar_alto($event.target)"
              @keydown.enter.exact.prevent="guardar"
            />
            <p v-if="form.subtasks.length > 0" class="ag-panel__contador">
              <i class="bi bi-check-square-fill" aria-hidden="true" />
              {{ subpasos_hechos }}/{{ form.subtasks.length }}
            </p>
          </div>

          <button
            type="button"
            class="ag-panel__hecho"
            :class="{ 'ag-panel__hecho--marcado': completada_visible }"
            :aria-pressed="completada_visible ? 'true' : 'false'"
            :aria-label="completada_visible ? 'Marcar como no hecha' : 'Marcar como hecha'"
            :disabled="ocupado"
            @click="alternar_completada"
          >
            <i v-if="completada_visible" class="bi bi-check-lg" aria-hidden="true" />
          </button>

          <div class="ag-panel__botones-arriba">
            <div v-if="!es_nueva" ref="pop_menu" class="ag-panel__menu-zona">
              <button
                type="button"
                class="ag-panel__boton-redondo"
                aria-label="Más acciones"
                :aria-expanded="popover === 'menu' ? 'true' : 'false'"
                @click="alternar_popover('menu')"
              >
                <i class="bi bi-three-dots" aria-hidden="true" />
              </button>
              <div v-if="popover === 'menu'" class="ag-panel__menu" role="menu">
                <button type="button" class="ag-panel__menu-item" role="menuitem" :disabled="ocupado" @click="duplicar">
                  <i class="bi bi-copy" aria-hidden="true" />
                  Duplicar
                </button>
                <button
                  v-if="!en_bandeja_original"
                  type="button"
                  class="ag-panel__menu-item"
                  role="menuitem"
                  :disabled="ocupado"
                  @click="mover_a_bandeja"
                >
                  <i class="bi bi-inbox" aria-hidden="true" />
                  Mover a la bandeja
                </button>
                <button
                  v-if="!en_bandeja_original && !original.all_day"
                  type="button"
                  class="ag-panel__menu-item"
                  role="menuitem"
                  :disabled="ocupado"
                  @click="pasar_a_todo_el_dia"
                >
                  <i class="bi bi-sun" aria-hidden="true" />
                  Pasar a todo el día
                </button>
                <span class="ag-panel__menu-divisor" />
                <button type="button" class="ag-panel__menu-item ag-panel__menu-item--peligro" role="menuitem" :disabled="ocupado" @click="pedir_borrar">
                  <i class="bi bi-trash3" aria-hidden="true" />
                  Borrar
                </button>
              </div>
            </div>
            <button type="button" class="ag-panel__boton-redondo" aria-label="Cerrar" @click="intentar_cerrar">
              <i class="bi bi-x-lg" aria-hidden="true" />
            </button>
          </div>
        </header>

        <!-- ===== Cuerpo ===== -->
        <div class="ag-panel__cuerpo">
          <!-- Con fecha: fecha + todo el día, hora de inicio y fin, duración -->
          <div v-if="!en_bandeja" class="ag-panel__tarjeta">
            <div class="ag-panel__fila">
              <i class="bi bi-calendar-event-fill ag-panel__fila-icono" aria-hidden="true" />
              <label class="ag-panel__fecha">
                <span>{{ fecha_texto }}</span>
                <input
                  ref="input_fecha"
                  type="date"
                  class="ag-panel__fecha-input"
                  :value="form.date"
                  aria-label="Fecha"
                  @click="abrir_selector_fecha($event)"
                  @change="on_cambiar_fecha($event.target.value)"
                />
              </label>
              <button
                type="button"
                class="ag-panel__todo-el-dia"
                role="checkbox"
                :aria-checked="form.all_day ? 'true' : 'false'"
                @click="alternar_todo_el_dia"
              >
                <span class="ag-check" :class="{ 'ag-check--marcado': form.all_day }">
                  <i v-if="form.all_day" class="bi bi-check-lg" aria-hidden="true" />
                </span>
                Todo el día
              </button>
            </div>
            <template v-if="!form.all_day">
              <div class="ag-panel__divisor" />
              <div class="ag-panel__fila">
                <i class="bi bi-clock-fill ag-panel__fila-icono" aria-hidden="true" />
                <selector-hora
                  :model-value="form.start_time"
                  etiqueta="Hora de inicio"
                  @update:model-value="on_cambiar_inicio"
                />
                <span class="ag-panel__guion">-</span>
                <selector-hora
                  :model-value="hora_fin"
                  :desde="form.start_time"
                  etiqueta="Hora de fin"
                  @update:model-value="on_cambiar_fin"
                />
              </div>
              <div class="ag-panel__duraciones" role="group" aria-label="Duración">
                <button
                  v-for="minutos in duraciones_rapidas"
                  :key="'ag-panel-dur-' + minutos"
                  type="button"
                  class="ag-chip"
                  :class="{ 'ag-chip--activo': form.duration_minutes === minutos }"
                  @click="form.duration_minutes = minutos"
                >
                  {{ duracion_corta(minutos) }}
                </button>
              </div>
            </template>
          </div>

          <!-- En la bandeja: duración, y botones para ponerle fecha u hora -->
          <template v-else>
            <label class="ag-panel__tarjeta ag-panel__tarjeta--pildora">
              <i class="bi bi-hourglass-split ag-panel__fila-icono" aria-hidden="true" />
              <select v-model.number="form.duration_minutes" class="ag-panel__select" aria-label="Duración">
                <option v-for="minutos in duraciones" :key="'ag-panel-sel-' + minutos" :value="minutos">
                  {{ duracion_corta(minutos) }}
                </option>
              </select>
            </label>
            <div class="ag-panel__acciones-fila">
              <label class="ag-boton-pildora">
                <i class="bi bi-calendar-event-fill" aria-hidden="true" />
                Fecha
                <input
                  type="date"
                  class="ag-panel__fecha-input"
                  aria-label="Ponerle fecha"
                  @click="abrir_selector_fecha($event)"
                  @change="on_poner_fecha($event.target.value)"
                />
              </label>
              <button type="button" class="ag-boton-pildora" @click="poner_hora">
                <i class="bi bi-clock-fill" aria-hidden="true" />
                Hora
              </button>
            </div>
          </template>

          <!-- Repetir (solo con fecha) -->
          <div v-if="!en_bandeja" ref="pop_repetir" class="ag-panel__repetir-zona">
            <button
              type="button"
              class="ag-boton-pildora"
              :class="{ 'ag-boton-pildora--activo': form.repeat !== 'none' }"
              :aria-expanded="popover === 'repetir' ? 'true' : 'false'"
              @click="alternar_popover('repetir')"
            >
              <i class="bi bi-repeat" aria-hidden="true" />
              {{ form.repeat === 'none' ? 'Repetir' : rotulo_repetir }}
            </button>
            <span v-if="form.repeat !== 'none'" class="ag-panel__hasta">
              hasta
              <label class="ag-panel__hasta-fecha">
                <span>{{ form.repeat_until ? fecha_corta_de(form.repeat_until) : 'siempre' }}</span>
                <input
                  type="date"
                  class="ag-panel__fecha-input"
                  :value="form.repeat_until || ''"
                  :min="form.date"
                  aria-label="Repetir hasta"
                  @click="abrir_selector_fecha($event)"
                  @change="form.repeat_until = $event.target.value || null"
                />
              </label>
              <button
                v-if="form.repeat_until"
                type="button"
                class="ag-panel__hasta-quitar"
                aria-label="Repetir siempre"
                title="Sin fecha de fin"
                @click="form.repeat_until = null"
              >
                <i class="bi bi-x" aria-hidden="true" />
              </button>
            </span>
            <div v-if="popover === 'repetir'" class="ag-panel__repetir" role="dialog" aria-label="Repetir">
              <p class="ag-panel__repetir-titulo">Repetir</p>
              <div class="ag-seg-chico" role="radiogroup">
                <button
                  v-for="opcion in opciones_repetir"
                  :key="'ag-panel-rep-' + opcion.clave"
                  type="button"
                  role="radio"
                  class="ag-seg-chico__btn"
                  :class="{ 'ag-seg-chico__btn--activo': form.repeat === opcion.clave }"
                  :aria-checked="form.repeat === opcion.clave ? 'true' : 'false'"
                  @click="elegir_repetir(opcion.clave)"
                >
                  {{ opcion.rotulo }}
                </button>
              </div>
            </div>
          </div>

          <!-- Subpasos y notas -->
          <div class="ag-panel__tarjeta ag-panel__notas">
            <div v-for="(subpaso, indice) in form.subtasks" :key="subpaso.clave" class="ag-panel__subpaso">
              <button
                type="button"
                class="ag-check ag-check--boton"
                :class="{ 'ag-check--marcado': subpaso.done }"
                role="checkbox"
                :aria-checked="subpaso.done ? 'true' : 'false'"
                :aria-label="'Marcar «' + subpaso.title + '»'"
                :disabled="ocupado"
                @click="alternar_subpaso(indice)"
              >
                <i v-if="subpaso.done" class="bi bi-check-lg" aria-hidden="true" />
              </button>
              <input
                v-model="subpaso.title"
                type="text"
                class="ag-panel__subpaso-input"
                :class="{ 'ag-panel__subpaso-input--hecho': subpaso.done }"
                maxlength="500"
                aria-label="Subpaso"
              />
              <button
                type="button"
                class="ag-panel__subpaso-quitar"
                :aria-label="'Quitar «' + subpaso.title + '»'"
                @click="quitar_subpaso(indice)"
              >
                <i class="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>
            <div class="ag-panel__subpaso ag-panel__subpaso--nuevo">
              <span class="ag-check" aria-hidden="true" />
              <input
                v-model="nuevo_subpaso"
                type="text"
                class="ag-panel__subpaso-input"
                maxlength="500"
                placeholder="Agregar subpaso"
                aria-label="Agregar subpaso"
                @keydown.enter.prevent="agregar_subpaso"
                @blur="agregar_subpaso"
              />
            </div>
            <textarea
              ref="input_notas"
              v-model="form.notes"
              class="ag-panel__notas-input"
              rows="2"
              placeholder="Agregá notas, links de reuniones o teléfonos…"
              aria-label="Notas"
              @input="ajustar_alto($event.target)"
            />
          </div>
        </div>

        <!-- ===== Pie ===== -->
        <footer class="ag-panel__pie">
          <button
            type="button"
            class="ag-panel__tacho"
            :aria-label="es_nueva ? 'Descartar la tarea' : 'Borrar la tarea'"
            :title="es_nueva ? 'Descartar' : 'Borrar'"
            :disabled="ocupado"
            @click="es_nueva ? intentar_cerrar() : pedir_borrar()"
          >
            <i class="bi bi-trash3-fill" aria-hidden="true" />
          </button>
          <button type="button" class="ag-panel__guardar" :disabled="!puede_guardar" @click="guardar">
            <span v-if="guardando" class="ag-panel__girando" aria-hidden="true" />
            {{ es_nueva ? 'Crear tarea' : 'Guardar cambios' }}
          </button>
        </footer>
      </div>

      <!-- Color e ícono: a la izquierda del panel en escritorio, adentro en pantallas chicas -->
      <div v-if="popover === 'color'" ref="pop_color_caja" class="ag-panel__selector">
        <selector-color-icono
          :color="form.color"
          :icono="form.icon"
          @elegir-color="form.color = $event"
          @elegir-icono="form.icon = $event"
          @cerrar="popover = null"
        />
      </div>
    </section>

    <dialogo-confirmar
      v-if="confirmar === 'descartar'"
      titulo="¿Descartar cambios?"
      texto="Tenés cambios sin guardar. Si salís ahora, se pierden."
      texto_cancelar="Seguir editando"
      texto_confirmar="Descartar cambios"
      @cancelar="confirmar = null"
      @confirmar="descartar"
    />
    <dialogo-confirmar
      v-if="confirmar === 'borrar'"
      titulo="¿Borrar la tarea?"
      :texto="texto_confirmar_borrar"
      texto_cancelar="Cancelar"
      texto_confirmar="Borrar"
      :ocupado="ocupado"
      @cancelar="confirmar = null"
      @confirmar="borrar"
    />
  </div>
</template>

<script>
import SelectorColorIcono from './SelectorColorIcono.vue'
import SelectorHora from './SelectorHora.vue'
import DialogoConfirmar from './DialogoConfirmar.vue'
import {
  crear_tarea,
  actualizar_tarea,
  borrar_tarea,
  completar_tarea,
  descompletar_tarea,
  duplicar_tarea,
  actualizar_subpaso,
} from './agenda_api'
import {
  COLOR_POR_DEFECTO,
  DURACION_POR_DEFECTO,
  DURACIONES,
  DURACIONES_RAPIDAS,
  ICONO_POR_DEFECTO,
  OPCIONES_REPETIR,
  color_hex,
  diferencia_dias,
  es_color_claro,
  fecha_corta,
  hora_de_minutos,
  minutos_de_hora,
  oscurecer,
  sumar_dias,
  texto_duracion,
  texto_duracion_corta,
  MINUTOS_DIA,
} from './agenda_utils'

/** Contador para las claves locales de los subpasos (los nuevos todavía no tienen id). */
let contador_subpasos = 0

/**
 * Normaliza una hora de la API ("10:30" o "10:30:00") a `HH:MM`, o null.
 *
 * @param {string|null|undefined} hora
 * @returns {string|null}
 */
function hora_corta(hora) {
  return hora ? String(hora).substring(0, 5) : null
}

/**
 * Copia profunda simple de los datos del formulario (para el estado original).
 *
 * @param {Object} form
 * @returns {Object}
 */
function copiar_form(form) {
  return JSON.parse(JSON.stringify(form))
}

/**
 * Firma comparable del formulario: lo que cuenta como "cambio" (sin las claves locales).
 *
 * @param {Object} form
 * @returns {string}
 */
function firma(form) {
  return JSON.stringify({
    title: (form.title || '').trim(),
    notes: (form.notes || '').trim(),
    date: form.date || null,
    start_time: form.date && !form.all_day ? form.start_time : null,
    all_day: !!form.all_day,
    duration_minutes: form.duration_minutes,
    color: form.color,
    icon: form.icon,
    repeat: form.date ? form.repeat : 'none',
    repeat_until: form.date && form.repeat !== 'none' ? form.repeat_until || null : null,
    subtasks: form.subtasks.map(function (subpaso) {
      return { id: subpaso.id || null, title: (subpaso.title || '').trim(), done: !!subpaso.done }
    }),
  })
}

export default {
  name: 'AgendaPanelTarea',
  components: { SelectorColorIcono, SelectorHora, DialogoConfirmar },
  props: {
    /** Ocurrencia que se edita (forma de la API), o null para una tarea nueva. */
    tarea: { type: Object, default: null },
    /** Valores iniciales de una tarea nueva: `{ date, start_time, all_day, duration_minutes }`. */
    borrador: { type: Object, default: function () { return {} } },
    /** Hoy (`YYYY-MM-DD`). */
    hoy: { type: String, required: true },
    /** Día elegido en la agenda: es la fecha que toma una tarea de la bandeja al tocar "Hora". */
    fecha_por_defecto: { type: String, required: true },
    /** true en teléfono (panel a pantalla completa). */
    es_telefono: { type: Boolean, default: false },
  },
  emits: ['cerrar', 'guardado', 'cambio'],
  data() {
    const form = this.armar_form_inicial()
    return {
      /** Datos editables de la tarea. */
      form: form,
      /** Copia del formulario tal como se abrió (o como quedó después de una acción inmediata). */
      original: copiar_form(form),
      /** Si la ocurrencia está hecha (se marca al instante, no espera a "Guardar cambios"). */
      completada: !!(this.tarea && this.tarea.completed),
      /** Tarea nueva: marcarla hecha apenas se cree (se tocó el círculo antes de crearla). */
      completar_al_crear: false,
      /** Texto del campo "Agregar subpaso". */
      nuevo_subpaso: '',
      /** Popover abierto: null | 'color' | 'repetir' | 'menu'. */
      popover: null,
      /** Diálogo de confirmación abierto: null | 'descartar' | 'borrar'. */
      confirmar: null,
      /** true mientras se guarda (crear o editar). */
      guardando: false,
      /** true mientras corre una acción inmediata (hecha, subpaso, duplicar, mover, borrar). */
      ocupado_accion: false,
    }
  },
  computed: {
    /**
     * true si es una tarea nueva (todavía no existe en la API).
     *
     * @returns {boolean}
     */
    es_nueva() {
      return !this.tarea
    },
    /**
     * true si el formulario está en la bandeja (sin fecha).
     *
     * @returns {boolean}
     */
    en_bandeja() {
      return !this.form.date
    },
    /**
     * true si la tarea estaba en la bandeja cuando se abrió (para el menú ⋯).
     *
     * @returns {boolean}
     */
    en_bandeja_original() {
      return !this.original.date
    },
    /**
     * true si hay algo en vuelo (deshabilita botones).
     *
     * @returns {boolean}
     */
    ocupado() {
      return this.guardando || this.ocupado_accion
    },
    /**
     * Hex del color elegido.
     *
     * @returns {string}
     */
    color_tarea() {
      return color_hex(this.form.color)
    },
    /**
     * Color de la cabecera: el de la tarea, un poco apagado como en Structured.
     *
     * @returns {string}
     */
    color_cabecera() {
      return oscurecer(this.color_tarea, 0.87)
    },
    /**
     * Color del texto y los bordes sobre la cabecera (oscuro sobre blanco o amarillo).
     *
     * @returns {string}
     */
    tinta() {
      return es_color_claro(this.color_tarea) ? '#1c1c1e' : '#ffffff'
    },
    /**
     * Estado visible del círculo de hecho.
     *
     * @returns {boolean}
     */
    completada_visible() {
      return this.es_nueva ? this.completar_al_crear : this.completada
    },
    /**
     * Hora de fin `HH:MM` (inicio + duración; pasada la medianoche da la vuelta).
     *
     * @returns {string}
     */
    hora_fin() {
      const inicio = minutos_de_hora(this.form.start_time) || 0
      return hora_de_minutos(inicio + (this.form.duration_minutes || DURACION_POR_DEFECTO))
    },
    /**
     * Rótulo de arriba del título: "10:00 - 10:15 (15 min)", "Todo el día" o "15 min • Bandeja".
     *
     * @returns {string}
     */
    etiqueta_horario() {
      const duracion = this.form.duration_minutes || DURACION_POR_DEFECTO
      if (this.en_bandeja) {
        return texto_duracion(duracion) + ' • Bandeja'
      }
      if (this.form.all_day) {
        return 'Todo el día'
      }
      return this.form.start_time + ' - ' + this.hora_fin + ' (' + texto_duracion(duracion) + ')'
    },
    /**
     * Fecha del formulario en corto ("Jue, 29 oct").
     *
     * @returns {string}
     */
    fecha_texto() {
      return fecha_corta(this.form.date, this.hoy)
    },
    /**
     * Subpasos marcados.
     *
     * @returns {number}
     */
    subpasos_hechos() {
      return this.form.subtasks.filter(function (subpaso) {
        return subpaso.done
      }).length
    },
    /**
     * Duraciones del selector (bandeja), sumando la actual si no está en la lista.
     *
     * @returns {number[]}
     */
    duraciones() {
      const lista = DURACIONES.slice()
      if (lista.indexOf(this.form.duration_minutes) === -1) {
        lista.push(this.form.duration_minutes)
        lista.sort(function (a, b) {
          return a - b
        })
      }
      return lista
    },
    /**
     * Chips de duración rápida.
     *
     * @returns {number[]}
     */
    duraciones_rapidas() {
      return DURACIONES_RAPIDAS
    },
    /**
     * Opciones del segmentado de Repetir.
     *
     * @returns {Array<{clave: string, rotulo: string}>}
     */
    opciones_repetir() {
      return OPCIONES_REPETIR
    },
    /**
     * Rótulo de la repetición elegida ("Diaria").
     *
     * @returns {string}
     */
    rotulo_repetir() {
      const self = this
      let rotulo = 'Repetir'
      OPCIONES_REPETIR.forEach(function (opcion) {
        if (opcion.clave === self.form.repeat) {
          rotulo = opcion.rotulo
        }
      })
      return rotulo
    },
    /**
     * true si el formulario cambió respecto de como se abrió.
     *
     * @returns {boolean}
     */
    hay_cambios() {
      return firma(this.form) !== firma(this.original) || this.nuevo_subpaso.trim() !== ''
    },
    /**
     * true si se puede apretar "Crear tarea" / "Guardar cambios".
     *
     * @returns {boolean}
     */
    puede_guardar() {
      if (this.ocupado || this.form.title.trim() === '') {
        return false
      }
      return this.es_nueva || this.hay_cambios
    },
    /**
     * Texto del diálogo de borrar (avisa si es una serie).
     *
     * @returns {string}
     */
    texto_confirmar_borrar() {
      if (this.tarea && this.tarea.is_recurring) {
        return 'Es una tarea que se repite: se borra la serie entera, con sus subpasos.'
      }
      return 'Se borra con sus subpasos y no se puede deshacer.'
    },
  },
  mounted() {
    const self = this
    document.addEventListener('keydown', self.on_tecla)
    document.addEventListener('mousedown', self.on_click_documento, true)
    self.$nextTick(function () {
      if (self.$refs.input_titulo) {
        self.ajustar_alto(self.$refs.input_titulo)
        if (self.es_nueva) {
          self.$refs.input_titulo.focus()
        }
      }
      if (self.$refs.input_notas) {
        self.ajustar_alto(self.$refs.input_notas)
      }
    })
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.on_tecla)
    document.removeEventListener('mousedown', this.on_click_documento, true)
  },
  methods: {
    /**
     * Arma el formulario inicial desde la tarea (o desde el borrador si es nueva). En una
     * repetida la fecha que se muestra es la de la ocurrencia tocada, no la base de la serie.
     *
     * @returns {Object}
     */
    armar_form_inicial() {
      const tarea = this.tarea
      if (tarea) {
        return {
          title: tarea.title || '',
          notes: tarea.notes || '',
          date: tarea.occurrence_date || tarea.date || null,
          start_time: hora_corta(tarea.start_time) || '09:00',
          all_day: !!tarea.all_day,
          duration_minutes: parseInt(tarea.duration_minutes, 10) || DURACION_POR_DEFECTO,
          color: tarea.color || COLOR_POR_DEFECTO,
          icon: tarea.icon || ICONO_POR_DEFECTO,
          repeat: tarea.repeat || 'none',
          repeat_until: tarea.repeat_until || null,
          subtasks: (tarea.subtasks || []).map(function (subpaso) {
            contador_subpasos = contador_subpasos + 1
            return {
              id: subpaso.id,
              title: subpaso.title || '',
              done: !!subpaso.done,
              clave: 'sp-' + contador_subpasos,
            }
          }),
        }
      }
      const borrador = this.borrador || {}
      return {
        title: '',
        notes: '',
        date: borrador.date || null,
        start_time: hora_corta(borrador.start_time) || '09:00',
        all_day: !!borrador.all_day,
        duration_minutes: borrador.duration_minutes || DURACION_POR_DEFECTO,
        color: COLOR_POR_DEFECTO,
        icon: ICONO_POR_DEFECTO,
        repeat: 'none',
        repeat_until: null,
        subtasks: [],
      }
    },
    /**
     * Fecha que se manda a la API. En una repetida que sigue repitiéndose, mover la ocurrencia N
     * días corre la base de la serie esos mismos N días (mueve la serie entera, como dice el plan).
     *
     * @param {string|null} fecha Fecha elegida en el formulario.
     * @returns {string|null}
     */
    fecha_para_api(fecha) {
      if (!fecha) {
        return null
      }
      const tarea = this.tarea
      if (tarea && tarea.is_recurring && tarea.occurrence_date && tarea.date && this.form.repeat !== 'none') {
        return sumar_dias(tarea.date, diferencia_dias(tarea.occurrence_date, fecha))
      }
      return fecha
    },
    /**
     * Ajusta el alto de un textarea a su contenido (título y notas crecen solos).
     *
     * @param {HTMLTextAreaElement} elemento
     * @returns {void}
     */
    ajustar_alto(elemento) {
      if (!elemento) {
        return
      }
      elemento.style.height = 'auto'
      elemento.style.height = elemento.scrollHeight + 'px'
    },
    /**
     * Abre o cierra un popover del panel.
     *
     * @param {string} nombre 'color' | 'repetir' | 'menu'
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
      if (!this.popover || this.confirmar) {
        return
      }
      const zonas = {
        color: [this.$refs.pop_color, this.$refs.pop_color_caja],
        repetir: [this.$refs.pop_repetir],
        menu: [this.$refs.pop_menu],
      }[this.popover] || []
      const adentro = zonas.some(function (zona) {
        return zona && zona.contains(evento.target)
      })
      if (!adentro) {
        this.popover = null
      }
    },
    /**
     * Escape: cierra el popover abierto o, si no hay, intenta cerrar el panel.
     *
     * @param {KeyboardEvent} evento
     * @returns {void}
     */
    on_tecla(evento) {
      if (evento.key !== 'Escape' || this.confirmar) {
        return
      }
      if (this.popover) {
        this.popover = null
        return
      }
      this.intentar_cerrar()
    },
    /**
     * Abre el calendario nativo de un input de fecha (en los navegadores que lo permiten).
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
          /* Algunos navegadores lo rechazan fuera de un gesto directo: queda el comportamiento nativo. */
        }
      }
    },
    /**
     * Cambio de fecha desde el calendario.
     *
     * @param {string} valor `YYYY-MM-DD` ('' si se borró)
     * @returns {void}
     */
    on_cambiar_fecha(valor) {
      if (!valor) {
        return
      }
      this.form.date = valor
      if (this.form.repeat_until && this.form.repeat_until < valor) {
        this.form.repeat_until = null
      }
    },
    /**
     * Tarea de la bandeja: "Fecha" le pone la fecha elegida (con horario a las 9).
     *
     * @param {string} valor
     * @returns {void}
     */
    on_poner_fecha(valor) {
      if (!valor) {
        return
      }
      this.form.date = valor
      this.form.all_day = false
      if (!this.form.start_time) {
        this.form.start_time = '09:00'
      }
    },
    /**
     * Tarea de la bandeja: "Hora" la pasa al día elegido en la agenda y abre la hora de inicio.
     *
     * @returns {void}
     */
    poner_hora() {
      const self = this
      self.form.date = self.fecha_por_defecto || self.hoy
      self.form.all_day = false
      self.$nextTick(function () {
        const input = self.$el.querySelector('.ag-panel__fila .ag-hora__input')
        if (input) {
          input.focus()
        }
      })
    },
    /**
     * Cambio de la hora de inicio: la duración se mantiene (el fin se corre con el inicio).
     *
     * @param {string} valor `HH:MM`
     * @returns {void}
     */
    on_cambiar_inicio(valor) {
      this.form.start_time = valor
    },
    /**
     * Cambio de la hora de fin: se recalcula la duración (si el fin es anterior al inicio, se
     * entiende que termina al día siguiente), entre 5 min y 24 h.
     *
     * @param {string} valor `HH:MM`
     * @returns {void}
     */
    on_cambiar_fin(valor) {
      const inicio = minutos_de_hora(this.form.start_time) || 0
      const fin = minutos_de_hora(valor)
      if (fin === null) {
        return
      }
      let duracion = fin - inicio
      if (duracion <= 0) {
        duracion = duracion + MINUTOS_DIA
      }
      this.form.duration_minutes = Math.max(5, Math.min(MINUTOS_DIA, duracion))
    },
    /**
     * Prende o apaga "Todo el día" (al apagarlo, si no había hora, arranca a las 9).
     *
     * @returns {void}
     */
    alternar_todo_el_dia() {
      this.form.all_day = !this.form.all_day
      if (!this.form.all_day && !this.form.start_time) {
        this.form.start_time = '09:00'
      }
    },
    /**
     * Elige la repetición y cierra el popover.
     *
     * @param {string} clave 'none' | 'daily' | 'weekly' | 'monthly'
     * @returns {void}
     */
    elegir_repetir(clave) {
      this.form.repeat = clave
      if (clave === 'none') {
        this.form.repeat_until = null
      }
      this.popover = null
    },
    /**
     * Fecha corta para el "hasta" de la repetición.
     *
     * @param {string} fecha
     * @returns {string}
     */
    fecha_corta_de(fecha) {
      return fecha_corta(fecha, this.hoy)
    },
    /**
     * Duración compacta para chips y selector ("1h 30m").
     *
     * @param {number} minutos
     * @returns {string}
     */
    duracion_corta(minutos) {
      return texto_duracion_corta(minutos)
    },
    /**
     * Agrega el subpaso escrito en "Agregar subpaso" (se guarda con el resto del formulario).
     *
     * @returns {void}
     */
    agregar_subpaso() {
      const titulo = this.nuevo_subpaso.trim()
      if (titulo === '') {
        return
      }
      contador_subpasos = contador_subpasos + 1
      this.form.subtasks.push({ id: null, title: titulo, done: false, clave: 'sp-' + contador_subpasos })
      this.nuevo_subpaso = ''
    },
    /**
     * Quita un subpaso del formulario (se borra al guardar).
     *
     * @param {number} indice
     * @returns {void}
     */
    quitar_subpaso(indice) {
      this.form.subtasks.splice(indice, 1)
    },
    /**
     * Marca o desmarca un subpaso. Si ya existe en la API se guarda al instante (PUT del subpaso)
     * y no cuenta como cambio pendiente; si es nuevo, queda en el formulario.
     *
     * @param {number} indice
     * @returns {void}
     */
    alternar_subpaso(indice) {
      const self = this
      const subpaso = self.form.subtasks[indice]
      if (!subpaso) {
        return
      }
      const nuevo_valor = !subpaso.done
      if (self.es_nueva || !subpaso.id) {
        subpaso.done = nuevo_valor
        return
      }
      subpaso.done = nuevo_valor
      self.ocupado_accion = true
      actualizar_subpaso(self.tarea.id, subpaso.id, { done: nuevo_valor })
        .then(function () {
          self.original.subtasks.forEach(function (original) {
            if (original.id === subpaso.id) {
              original.done = nuevo_valor
            }
          })
          self.ocupado_accion = false
          self.$emit('cambio')
        })
        .catch(function () {
          subpaso.done = !nuevo_valor
          self.ocupado_accion = false
        })
    },
    /**
     * Toca el círculo de hecho. En una tarea existente se guarda al instante (en una repetida,
     * para ESTA ocurrencia); en una nueva queda anotado para marcarla apenas se cree.
     *
     * @returns {void}
     */
    alternar_completada() {
      const self = this
      if (self.es_nueva) {
        self.completar_al_crear = !self.completar_al_crear
        return
      }
      const marcar = !self.completada
      const llamada = marcar ? completar_tarea(self.tarea) : descompletar_tarea(self.tarea)
      self.completada = marcar
      self.ocupado_accion = true
      llamada
        .then(function () {
          self.ocupado_accion = false
          self.$emit('cambio')
        })
        .catch(function () {
          self.completada = !marcar
          self.ocupado_accion = false
        })
    },
    /**
     * Arma el body del POST de una tarea nueva.
     *
     * @returns {Object}
     */
    payload_nueva() {
      const form = this.form
      const con_fecha = !!form.date
      return {
        title: form.title.trim(),
        notes: form.notes.trim() === '' ? null : form.notes,
        date: con_fecha ? form.date : null,
        start_time: con_fecha && !form.all_day ? form.start_time : null,
        all_day: con_fecha ? !!form.all_day : false,
        duration_minutes: form.duration_minutes,
        color: form.color,
        icon: form.icon,
        repeat: con_fecha ? form.repeat : 'none',
        repeat_until: con_fecha && form.repeat !== 'none' ? form.repeat_until || null : null,
        subtasks: form.subtasks
          .filter(function (subpaso) {
            return subpaso.title.trim() !== ''
          })
          .map(function (subpaso) {
            return { title: subpaso.title.trim(), done: !!subpaso.done }
          }),
      }
    },
    /**
     * Arma el body del PUT con SOLO lo que cambió respecto de como se abrió.
     *
     * @returns {Object}
     */
    payload_cambios() {
      const form = this.form
      const original = this.original
      const cambios = {}
      if (form.title.trim() !== original.title.trim()) {
        cambios.title = form.title.trim()
      }
      if (form.notes.trim() !== (original.notes || '').trim()) {
        cambios.notes = form.notes.trim() === '' ? null : form.notes
      }
      const cambio_repetir = form.repeat !== original.repeat
      const cambio_horario =
        form.date !== original.date ||
        form.all_day !== original.all_day ||
        (!form.all_day && form.start_time !== original.start_time) ||
        /* Una repetida que deja de repetirse queda en la fecha que se está mirando. */
        (cambio_repetir && form.repeat === 'none' && this.tarea && this.tarea.is_recurring)
      if (cambio_horario) {
        cambios.date = this.fecha_para_api(form.date)
        if (form.date) {
          cambios.all_day = !!form.all_day
          if (!form.all_day) {
            cambios.start_time = form.start_time || '09:00'
          }
        }
      }
      if (form.duration_minutes !== original.duration_minutes) {
        cambios.duration_minutes = form.duration_minutes
      }
      if (form.color !== original.color) {
        cambios.color = form.color
      }
      if (form.icon !== original.icon) {
        cambios.icon = form.icon
      }
      if (form.date && (cambio_repetir || (form.repeat_until || null) !== (original.repeat_until || null))) {
        cambios.repeat = form.repeat
        cambios.repeat_until = form.repeat !== 'none' ? form.repeat_until || null : null
      }
      const firma_subpasos = function (lista) {
        return JSON.stringify(
          lista.map(function (subpaso) {
            return [subpaso.id || null, subpaso.title.trim(), !!subpaso.done]
          })
        )
      }
      if (firma_subpasos(form.subtasks) !== firma_subpasos(original.subtasks)) {
        cambios.subtasks = form.subtasks
          .filter(function (subpaso) {
            return subpaso.title.trim() !== ''
          })
          .map(function (subpaso) {
            const item = { title: subpaso.title.trim(), done: !!subpaso.done }
            if (subpaso.id) {
              item.id = subpaso.id
            }
            return item
          })
      }
      return cambios
    },
    /**
     * "Crear tarea" / "Guardar cambios". En una nueva hace el POST (y el complete si se tocó el
     * círculo antes); en una existente, el PUT con lo que cambió. Al terminar, avisa y se cierra.
     *
     * @returns {void}
     */
    guardar() {
      const self = this
      self.agregar_subpaso()
      if (!self.puede_guardar) {
        return
      }
      self.guardando = true
      if (self.es_nueva) {
        crear_tarea(self.payload_nueva())
          .then(function (respuesta) {
            const modelo = respuesta.data && respuesta.data.model ? respuesta.data.model : null
            if (self.completar_al_crear && modelo) {
              return completar_tarea(modelo)
            }
            return null
          })
          .then(function () {
            self.guardando = false
            self.$emit('guardado', { cerrar: true })
          })
          .catch(function () {
            /* El interceptor ya mostró el motivo (422 en criollo, red, etc.): el panel queda abierto. */
            self.guardando = false
            self.$emit('cambio')
          })
        return
      }
      const cambios = self.payload_cambios()
      if (Object.keys(cambios).length === 0) {
        self.guardando = false
        self.$emit('cerrar')
        return
      }
      actualizar_tarea(self.tarea.id, cambios)
        .then(function () {
          self.guardando = false
          self.$emit('guardado', { cerrar: true })
        })
        .catch(function () {
          self.guardando = false
          self.$emit('cambio')
        })
    },
    /**
     * Menú ⋯ → Duplicar.
     *
     * @returns {void}
     */
    duplicar() {
      const self = this
      self.popover = null
      self.ocupado_accion = true
      duplicar_tarea(self.tarea.id)
        .then(function () {
          self.ocupado_accion = false
          self.$emit('guardado', { cerrar: true })
        })
        .catch(function () {
          self.ocupado_accion = false
        })
    },
    /**
     * Menú ⋯ → Mover a la bandeja (`date: null`: la API limpia la hora y la repetición).
     *
     * @returns {void}
     */
    mover_a_bandeja() {
      const self = this
      self.popover = null
      self.ocupado_accion = true
      actualizar_tarea(self.tarea.id, { date: null })
        .then(function () {
          self.ocupado_accion = false
          self.$emit('guardado', { cerrar: true })
        })
        .catch(function () {
          self.ocupado_accion = false
        })
    },
    /**
     * Menú ⋯ → Pasar a todo el día. Se guarda al instante y el panel queda abierto (los demás
     * cambios sin guardar siguen pendientes).
     *
     * @returns {void}
     */
    pasar_a_todo_el_dia() {
      const self = this
      self.popover = null
      self.ocupado_accion = true
      actualizar_tarea(self.tarea.id, { date: self.fecha_para_api(self.original.date), all_day: true })
        .then(function () {
          self.form.all_day = true
          self.original.all_day = true
          self.ocupado_accion = false
          self.$emit('cambio')
        })
        .catch(function () {
          self.ocupado_accion = false
        })
    },
    /**
     * Abre la confirmación de borrar.
     *
     * @returns {void}
     */
    pedir_borrar() {
      this.popover = null
      this.confirmar = 'borrar'
    },
    /**
     * Borra la tarea (confirmado).
     *
     * @returns {void}
     */
    borrar() {
      const self = this
      self.ocupado_accion = true
      borrar_tarea(self.tarea.id)
        .then(function () {
          self.ocupado_accion = false
          self.confirmar = null
          self.$emit('guardado', { cerrar: true })
        })
        .catch(function () {
          self.ocupado_accion = false
          self.confirmar = null
        })
    },
    /**
     * Cerrar (✕, Escape, tocar afuera): si hay cambios sin guardar, pregunta antes.
     *
     * @returns {void}
     */
    intentar_cerrar() {
      if (this.guardando) {
        return
      }
      if (this.popover) {
        this.popover = null
      }
      if (this.hay_cambios) {
        this.confirmar = 'descartar'
        return
      }
      this.$emit('cerrar')
    },
    /**
     * "Descartar cambios": cierra sin guardar.
     *
     * @returns {void}
     */
    descartar() {
      this.confirmar = null
      this.$emit('cerrar')
    },
  },
}
</script>

<style scoped>
/* Capa que cubre la agenda: fondo oscurecido + panel a la derecha. */
.ag-panel-capa {
  position: absolute;
  inset: 0;
  z-index: 50;
}

.ag-panel-capa__fondo {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
}

.ag-panel {
  --ag-color-tarea: #f88e87;
  --ag-tinta: #fff;
  position: absolute;
  top: 22px;
  right: 22px;
  bottom: 22px;
  width: min(480px, calc(100% - 44px));
  color: var(--ag-texto);
}

.ag-panel__caja {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  border-radius: 22px;
  background: var(--ag-superficie);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.6);
}

/* ---------- Cabecera ---------- */
.ag-panel__cabecera {
  position: relative;
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 16px;
  min-height: 202px;
  padding: 26px 70px 26px 50px;
  color: var(--ag-tinta);
}

.ag-panel__cabecera--bandeja {
  min-height: 165px;
  padding-left: 44px;
}

.ag-panel__icono-zona {
  position: relative;
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 60px;
  align-self: stretch;
}

/* Las "vecinas": medio círculo arriba y abajo de la píldora, las tareas de antes y después. */
.ag-panel__vecina {
  position: absolute;
  left: 50%;
  width: 52px;
  height: 52px;
  margin-left: -26px;
  border-radius: 50%;
  background: var(--ag-color-tarea);
  opacity: 0.75;
}

.ag-panel__vecina--arriba {
  top: -58px;
}

.ag-panel__vecina--abajo {
  bottom: -58px;
}

.ag-panel__pildora {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 58px;
  height: 120px;
  border: 3px solid var(--ag-tinta);
  border-radius: 29px;
  background: var(--ag-color-tarea);
  color: var(--ag-tinta);
  font-size: 22px;
}

.ag-panel__pildora--cuadrada {
  width: 62px;
  height: 62px;
  border-radius: 16px;
}

.ag-panel__paleta-zona {
  position: absolute;
  bottom: 8px;
  left: -14px;
  z-index: 2;
}

.ag-panel__cabecera--bandeja .ag-panel__paleta-zona {
  bottom: auto;
  top: calc(50% + 12px);
}

.ag-panel__paleta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 50%;
  background: #3a3a3c;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.ag-panel__encabezado {
  flex: 1 1 auto;
  min-width: 0;
}

.ag-panel__etiqueta {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 400;
  opacity: 0.9;
}

.ag-panel__titulo {
  display: block;
  width: 100%;
  max-height: 140px;
  padding: 0 0 6px;
  overflow-y: auto;
  border: 0;
  border-bottom: 1px solid currentColor;
  border-bottom-color: rgba(255, 255, 255, 0.35);
  background: transparent;
  color: var(--ag-tinta);
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
  resize: none;
  outline: none;
}

.ag-panel__titulo::placeholder {
  color: var(--ag-tinta);
  opacity: 0.5;
}

.ag-panel__contador {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 8px 0 0;
  font-size: 12px;
  opacity: 0.9;
}

.ag-panel__hecho {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-right: -32px;
  padding: 0;
  border: 2px solid var(--ag-tinta);
  border-radius: 50%;
  background: transparent;
  color: var(--ag-color-tarea);
  font-size: 15px;
  cursor: pointer;
}

.ag-panel__hecho--marcado {
  background: var(--ag-tinta);
}

.ag-panel__botones-arriba {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  gap: 8px;
}

.ag-panel__menu-zona {
  position: relative;
}

.ag-panel__boton-redondo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgba(28, 28, 30, 0.88);
  color: #fff;
  font-size: 13px;
  cursor: pointer;
}

.ag-panel__menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  width: 200px;
  padding: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  background: rgba(58, 44, 44, 0.96);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
}

.ag-panel__menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #fff;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.ag-panel__menu-item:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}

.ag-panel__menu-item--peligro {
  color: #ff8a80;
}

.ag-panel__menu-divisor {
  height: 1px;
  margin: 4px 6px;
  background: rgba(255, 255, 255, 0.12);
}

/* ---------- Cuerpo ---------- */
.ag-panel__cuerpo {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  padding: 22px 22px 12px;
  overflow-y: auto;
  scrollbar-width: thin;
}

.ag-panel__tarjeta {
  border: 1px solid var(--ag-borde);
  border-radius: 14px;
  background: var(--ag-elevado);
}

.ag-panel__fila {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  padding: 0 12px 0 14px;
}

.ag-panel__fila-icono {
  flex: 0 0 auto;
  color: var(--ag-salmon);
  font-size: 15px;
}

.ag-panel__divisor {
  height: 1px;
  background: var(--ag-borde);
}

.ag-panel__fecha {
  position: relative;
  flex: 1 1 auto;
  margin: 0;
  color: var(--ag-texto);
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
}

/* El input de fecha nativo va invisible encima del texto: el clic abre el calendario. */
.ag-panel__fecha-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  color-scheme: dark;
}

.ag-panel__todo-el-dia {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: var(--ag-texto);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
}

.ag-panel__guion {
  color: var(--ag-apagado);
}

.ag-panel__duraciones {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 12px 12px 40px;
}

.ag-chip {
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--ag-borde);
  border-radius: 13px;
  background: transparent;
  color: #c8c8ca;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.ag-chip:hover {
  color: var(--ag-texto);
}

.ag-chip--activo,
.ag-chip--activo:hover {
  border-color: var(--ag-salmon);
  background: var(--ag-salmon);
  color: #fff;
}

.ag-panel__tarjeta--pildora {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 42px;
  margin: 0;
  padding: 0 14px;
  border-radius: 21px;
}

.ag-panel__select {
  flex: 1 1 auto;
  border: 0;
  background: transparent;
  color: var(--ag-texto);
  font-size: 16px;
  font-weight: 500;
  outline: none;
  color-scheme: dark;
  cursor: pointer;
}

.ag-panel__select option {
  background: #2c2c2e;
}

.ag-panel__acciones-fila {
  display: flex;
  gap: 8px;
}

/* Botón pastilla: "Repetir", "Fecha", "Hora". */
.ag-boton-pildora {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  margin: 0;
  padding: 0 14px;
  border: 1px solid var(--ag-borde);
  border-radius: 19px;
  background: var(--ag-elevado);
  color: var(--ag-texto);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.ag-boton-pildora .bi {
  color: var(--ag-salmon);
}

.ag-boton-pildora--activo {
  border-color: rgba(248, 142, 135, 0.6);
  background: rgba(248, 142, 135, 0.14);
}

.ag-panel__repetir-zona {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.ag-panel__hasta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ag-apagado);
  font-size: 13px;
}

.ag-panel__hasta-fecha {
  position: relative;
  margin: 0;
  padding: 3px 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--ag-texto);
  cursor: pointer;
}

.ag-panel__hasta-quitar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--ag-apagado);
  font-size: 16px;
  cursor: pointer;
}

.ag-panel__repetir {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 20;
  width: 300px;
  max-width: 100%;
  padding: 12px;
  border: 1px solid var(--ag-borde);
  border-radius: 14px;
  background: var(--ag-elevado);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
}

.ag-panel__repetir-titulo {
  margin: 0 0 10px;
  font-size: 16px;
  font-weight: 600;
}

.ag-seg-chico {
  display: flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--ag-borde);
  border-radius: 18px;
  background: #242426;
}

.ag-seg-chico__btn {
  flex: 1 1 0;
  height: 28px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: #b4b4b6;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.ag-seg-chico__btn--activo {
  background: var(--ag-salmon);
  color: #fff;
}

/* Caja de subpasos + notas. */
.ag-panel__notas {
  display: flex;
  flex-direction: column;
}

.ag-panel__subpaso {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  margin: 0 0 0 14px;
  padding-right: 10px;
  border-bottom: 1px solid var(--ag-borde);
}

.ag-check {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 1.5px solid #6a6a6c;
  border-radius: 4px;
  background: transparent;
  color: #fff;
  font-size: 12px;
}

.ag-check--boton {
  cursor: pointer;
}

.ag-check--marcado {
  border-color: var(--ag-salmon);
  background: var(--ag-salmon);
}

.ag-panel__subpaso-input {
  flex: 1 1 auto;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--ag-texto);
  font-size: 14px;
  font-weight: 500;
  outline: none;
}

.ag-panel__subpaso-input::placeholder {
  color: var(--ag-apagado);
  font-weight: 400;
}

.ag-panel__subpaso-input--hecho {
  color: var(--ag-apagado);
  text-decoration: line-through;
}

.ag-panel__subpaso-quitar {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--ag-apagado);
  font-size: 12px;
  cursor: pointer;
}

.ag-panel__subpaso-quitar:hover {
  color: var(--ag-texto);
}

.ag-panel__notas-input {
  min-height: 66px;
  padding: 14px 20px;
  border: 0;
  background: transparent;
  color: var(--ag-texto);
  font-size: 15px;
  line-height: 1.45;
  resize: none;
  outline: none;
}

.ag-panel__notas-input::placeholder {
  color: var(--ag-apagado);
}

/* ---------- Pie ---------- */
.ag-panel__pie {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  padding: 14px 22px 22px;
}

.ag-panel__tacho {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #3a3a3c;
  color: #a8a8aa;
  font-size: 14px;
  cursor: pointer;
}

.ag-panel__tacho:hover:not(:disabled) {
  color: #ff8a80;
}

.ag-panel__guardar {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 20px;
  border: 0;
  border-radius: 19px;
  background: var(--ag-salmon);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.ag-panel__guardar:disabled {
  background: #3a3a3c;
  color: #6e6e70;
  cursor: default;
}

.ag-panel__girando {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: ag-panel-girar 0.8s linear infinite;
}

@keyframes ag-panel-girar {
  to {
    transform: rotate(360deg);
  }
}

/* ---------- Color e ícono ---------- */
.ag-panel__selector {
  position: absolute;
  top: 64px;
  left: 50%;
  z-index: 30;
  transform: translateX(-50%);
}

/* En escritorio, el selector va a la izquierda del panel, como en Structured. */
@media (min-width: 1200px) {
  .ag-panel__selector {
    top: 136px;
    right: calc(100% - 24px);
    left: auto;
    transform: none;
  }
}

/* ---------- Teléfono: pantalla completa ---------- */
.ag-panel-capa--telefono {
  position: fixed;
  z-index: 1050;
}

.ag-panel-capa--telefono .ag-panel {
  inset: 0;
  width: 100%;
}

.ag-panel-capa--telefono .ag-panel__caja {
  border-radius: 0;
}

.ag-panel-capa--telefono .ag-panel__cabecera {
  min-height: 170px;
  padding: 50px 54px 20px 34px;
}

.ag-panel-capa--telefono .ag-panel__titulo {
  font-size: 21px;
}

.ag-panel-capa--telefono .ag-panel__pildora {
  width: 50px;
  height: 100px;
}

.ag-panel-capa--telefono .ag-panel__pildora--cuadrada {
  width: 54px;
  height: 54px;
}

.ag-panel-capa--telefono .ag-panel__hecho {
  margin-right: -24px;
}

.ag-panel-capa--telefono .ag-panel__cuerpo {
  padding: 16px 14px 10px;
}

.ag-panel-capa--telefono .ag-panel__pie {
  padding: 12px 14px calc(16px + env(safe-area-inset-bottom, 0px));
}

.ag-panel-capa--telefono .ag-panel__selector {
  top: 56px;
}
</style>
