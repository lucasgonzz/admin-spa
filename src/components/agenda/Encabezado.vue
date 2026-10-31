<template>
  <!--
    Cabecera negra de la Agenda, como la de Structured: botón Bandeja, "Octubre 2026" con el
    selector de mes, ‹ | ›, el control segmentado Día / Varios días / Semana / Mes y la pastilla con
    Selección múltiple (tilde) y Configuración (engranaje).
  -->
  <header
    class="ag-enc"
    :class="{
      'ag-enc--telefono': es_telefono,
      'ag-enc--con-columna': bandeja_abierta && bandeja_en_columna,
    }"
  >
    <!-- Bandeja: abre/cierra la columna (o el cajón) de tareas sin fecha -->
    <div class="ag-enc__izq">
      <button
        type="button"
        class="ag-enc__bandeja"
        :class="{ 'ag-enc__bandeja--activa': bandeja_abierta }"
        :aria-pressed="bandeja_abierta ? 'true' : 'false'"
        aria-label="Bandeja"
        @click="$emit('alternar-bandeja')"
      >
        <i class="bi bi-inbox-fill" aria-hidden="true" />
        <span v-if="!es_telefono && !es_tablet">Bandeja</span>
        <span v-if="cantidad_bandeja > 0 && !bandeja_abierta" class="ag-enc__bandeja-cuenta">
          {{ cantidad_bandeja }}
        </span>
      </button>
    </div>

    <!-- Título del mes con su selector, y las flechas de navegación -->
    <div ref="pop_mes" class="ag-enc__centro">
      <button
        type="button"
        class="ag-enc__titulo"
        :aria-expanded="popover === 'mes' ? 'true' : 'false'"
        aria-label="Elegir mes"
        @click="alternar_popover('mes')"
      >
        <span class="ag-enc__mes">{{ nombre_mes }}</span>
        <span class="ag-enc__anio">{{ anio }}</span>
        <i class="bi bi-chevron-down ag-enc__chevron" aria-hidden="true" />
      </button>
      <div class="ag-enc__flechas">
        <button type="button" class="ag-enc__flecha" aria-label="Anterior" @click="$emit('anterior')">
          <i class="bi bi-chevron-left" aria-hidden="true" />
        </button>
        <span class="ag-enc__separador" aria-hidden="true" />
        <button type="button" class="ag-enc__flecha" aria-label="Siguiente" @click="$emit('siguiente')">
          <i class="bi bi-chevron-right" aria-hidden="true" />
        </button>
      </div>

      <!-- Selector de mes: año con flechas, los 12 meses y "Ir a hoy" -->
      <div v-if="popover === 'mes'" class="ag-pop ag-enc__pop-mes" role="dialog" aria-label="Elegir mes">
        <div class="ag-enc__pop-anio">
          <button type="button" class="ag-enc__flecha" aria-label="Año anterior" @click="anio_selector = anio_selector - 1">
            <i class="bi bi-chevron-left" aria-hidden="true" />
          </button>
          <span>{{ anio_selector }}</span>
          <button type="button" class="ag-enc__flecha" aria-label="Año siguiente" @click="anio_selector = anio_selector + 1">
            <i class="bi bi-chevron-right" aria-hidden="true" />
          </button>
        </div>
        <div class="ag-enc__pop-meses">
          <button
            v-for="(mes, indice) in meses_cortos"
            :key="'ag-mes-' + indice"
            type="button"
            class="ag-enc__pop-mes-btn"
            :class="{ 'ag-enc__pop-mes-btn--activo': es_mes_actual(indice) }"
            @click="elegir_mes(indice)"
          >
            {{ mes }}
          </button>
        </div>
        <button type="button" class="ag-enc__pop-hoy" @click="ir_a_hoy">Ir a hoy</button>
      </div>
    </div>

    <!-- Derecha: segmentado de vistas y pastilla de acciones -->
    <div class="ag-enc__der">
      <div class="ag-seg" role="tablist" aria-label="Vista de la agenda">
        <button
          v-for="opcion in opciones_vista"
          :key="'ag-vista-' + opcion.clave"
          type="button"
          role="tab"
          class="ag-seg__btn"
          :class="{ 'ag-seg__btn--activo': vista === opcion.clave }"
          :aria-selected="vista === opcion.clave ? 'true' : 'false'"
          :disabled="opcion.clave === 'mes' && seleccion_activa"
          @click="$emit('cambiar-vista', opcion.clave)"
        >
          {{ es_compacto ? opcion.corto : opcion.rotulo }}
        </button>
      </div>

      <div class="ag-enc__acciones">
        <button
          type="button"
          class="ag-enc__accion"
          :class="{ 'ag-enc__accion--activa': seleccion_activa }"
          :aria-pressed="seleccion_activa ? 'true' : 'false'"
          aria-label="Selección múltiple"
          title="Selección múltiple"
          @click="$emit('alternar-seleccion')"
        >
          <i class="bi" :class="seleccion_activa ? 'bi-check-square-fill' : 'bi-check-square'" aria-hidden="true" />
        </button>
        <span class="ag-enc__separador" aria-hidden="true" />
        <div ref="pop_ajustes" class="ag-enc__ajustes">
          <button
            type="button"
            class="ag-enc__accion"
            :class="{ 'ag-enc__accion--girando': cargando }"
            aria-label="Abrir configuración"
            title="Configuración"
            :aria-expanded="popover === 'ajustes' ? 'true' : 'false'"
            @click="alternar_popover('ajustes')"
          >
            <i class="bi bi-gear-fill" aria-hidden="true" />
          </button>

          <!-- Configuración: mostrar/ocultar completadas (se recuerda) y actualizar a mano -->
          <div v-if="popover === 'ajustes'" class="ag-pop ag-enc__pop-ajustes" role="menu">
            <label class="ag-enc__pop-item ag-enc__pop-item--switch">
              <span>
                <i class="bi bi-check2-circle" aria-hidden="true" />
                Mostrar completadas
              </span>
              <input
                type="checkbox"
                class="ag-switch"
                :checked="mostrar_completadas"
                @change="$emit('alternar-completadas')"
              />
            </label>
            <button type="button" class="ag-enc__pop-item" role="menuitem" @click="actualizar">
              <span>
                <i class="bi bi-arrow-clockwise" aria-hidden="true" />
                Actualizar ahora
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<script>
import { NOMBRES_MESES, NOMBRES_MESES_CORTOS, texto_a_fecha, dos_digitos } from './agenda_utils'

export default {
  name: 'AgendaEncabezado',
  props: {
    /** Vista activa: 'dia' | 'varios' | 'semana' | 'mes'. */
    vista: { type: String, required: true },
    /** Día elegido (`YYYY-MM-DD`); de acá sale el mes del título. */
    fecha_elegida: { type: String, required: true },
    /** Hoy (`YYYY-MM-DD`), para marcar el mes actual en el selector. */
    hoy: { type: String, required: true },
    /** true si la bandeja está abierta (botón en salmón). */
    bandeja_abierta: { type: Boolean, default: false },
    /** true si la bandeja abierta es una columna fija (escritorio): el título se corre a la derecha. */
    bandeja_en_columna: { type: Boolean, default: false },
    /** Cantidad de tareas en la bandeja (se muestra en el botón cuando está cerrada). */
    cantidad_bandeja: { type: Number, default: 0 },
    /** true si la selección múltiple está activa (tilde en salmón, Mes deshabilitado). */
    seleccion_activa: { type: Boolean, default: false },
    /** Preferencia de mostrar las tareas completadas. */
    mostrar_completadas: { type: Boolean, default: true },
    /** true en teléfono: cabecera en dos filas y rótulos cortos. */
    es_telefono: { type: Boolean, default: false },
    /** true en tablet: rótulos cortos en el segmentado para que entre en una fila. */
    es_tablet: { type: Boolean, default: false },
    /** true mientras se trae la agenda (el engranaje gira). */
    cargando: { type: Boolean, default: false },
  },
  emits: [
    'alternar-bandeja',
    'cambiar-vista',
    'anterior',
    'siguiente',
    'ir-a-fecha',
    'alternar-seleccion',
    'alternar-completadas',
    'actualizar',
  ],
  data() {
    return {
      /** Popover abierto: null | 'mes' | 'ajustes'. */
      popover: null,
      /** Año que se está mirando en el selector de mes (puede no ser el del título). */
      anio_selector: new Date().getFullYear(),
    }
  },
  computed: {
    /**
     * Opciones del segmentado, con el rótulo largo (escritorio) y el corto (tablet y teléfono).
     *
     * @returns {Array<{clave: string, rotulo: string, corto: string}>}
     */
    opciones_vista() {
      return [
        { clave: 'dia', rotulo: 'Día', corto: 'Día' },
        { clave: 'varios', rotulo: 'Varios días', corto: 'Varios' },
        { clave: 'semana', rotulo: 'Semana', corto: 'Semana' },
        { clave: 'mes', rotulo: 'Mes', corto: 'Mes' },
      ]
    },
    /**
     * true si el segmentado usa los rótulos cortos.
     *
     * @returns {boolean}
     */
    es_compacto() {
      return this.es_telefono || this.es_tablet
    },
    /**
     * Nombre del mes del título ("Octubre").
     *
     * @returns {string}
     */
    nombre_mes() {
      const fecha = texto_a_fecha(this.fecha_elegida)
      return fecha ? NOMBRES_MESES[fecha.getMonth()] : ''
    },
    /**
     * Año del título ("2026", va en salmón).
     *
     * @returns {number|string}
     */
    anio() {
      const fecha = texto_a_fecha(this.fecha_elegida)
      return fecha ? fecha.getFullYear() : ''
    },
    /**
     * Meses cortos con mayúscula para la grilla del selector ("Ene", "Feb"…).
     *
     * @returns {string[]}
     */
    meses_cortos() {
      return NOMBRES_MESES_CORTOS.map(function (mes) {
        return mes.charAt(0).toUpperCase() + mes.substring(1)
      })
    },
  },
  mounted() {
    /* Un solo listener para cerrar cualquier popover al tocar afuera (se saca en beforeUnmount). */
    document.addEventListener('mousedown', this.on_click_documento, true)
    document.addEventListener('keydown', this.on_tecla)
  },
  beforeUnmount() {
    document.removeEventListener('mousedown', this.on_click_documento, true)
    document.removeEventListener('keydown', this.on_tecla)
  },
  methods: {
    /**
     * Abre un popover (o lo cierra si ya estaba abierto). Al abrir el de mes, el año arranca en
     * el del título.
     *
     * @param {string} nombre 'mes' | 'ajustes'
     * @returns {void}
     */
    alternar_popover(nombre) {
      if (this.popover === nombre) {
        this.popover = null
        return
      }
      if (nombre === 'mes') {
        this.anio_selector = parseInt(this.anio, 10) || new Date().getFullYear()
      }
      this.popover = nombre
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
      const contenedor = this.popover === 'mes' ? this.$refs.pop_mes : this.$refs.pop_ajustes
      if (contenedor && contenedor.contains(evento.target)) {
        return
      }
      this.popover = null
    },
    /**
     * Escape cierra el popover abierto.
     *
     * @param {KeyboardEvent} evento
     * @returns {void}
     */
    on_tecla(evento) {
      if (evento.key === 'Escape' && this.popover) {
        this.popover = null
      }
    },
    /**
     * Indica si un mes de la grilla es el que se está mirando (se pinta en salmón).
     *
     * @param {number} indice 0..11
     * @returns {boolean}
     */
    es_mes_actual(indice) {
      const prefijo = this.anio_selector + '-' + dos_digitos(indice + 1)
      return this.fecha_elegida.substring(0, 7) === prefijo
    },
    /**
     * Va al mes elegido: al día de hoy si es el mes actual, y si no al día 1.
     *
     * @param {number} indice 0..11
     * @returns {void}
     */
    elegir_mes(indice) {
      const prefijo = this.anio_selector + '-' + dos_digitos(indice + 1)
      const destino = this.hoy.substring(0, 7) === prefijo ? this.hoy : prefijo + '-01'
      this.popover = null
      this.$emit('ir-a-fecha', destino)
    },
    /**
     * Vuelve a hoy desde el selector de mes.
     *
     * @returns {void}
     */
    ir_a_hoy() {
      this.popover = null
      this.$emit('ir-a-fecha', this.hoy)
    },
    /**
     * Actualizar a mano desde el menú de configuración.
     *
     * @returns {void}
     */
    actualizar() {
      this.popover = null
      this.$emit('actualizar')
    },
  },
}
</script>

<style scoped>
.ag-enc {
  display: flex;
  flex-wrap: wrap;
  /* Sin esto, en el teléfono la columna flex de la agenda la achicaba a una sola fila y la
     franja de días tapaba el segmentado de la segunda (medido a 375 px). */
  flex-shrink: 0;
  align-items: center;
  gap: 10px 16px;
  min-height: 64px;
  padding: 12px 30px;
  background: var(--ag-negro);
  color: var(--ag-texto);
}

.ag-enc__izq {
  flex: 0 0 auto;
  transition: flex-basis 0.2s ease;
}

/* Con la bandeja como columna, el título arranca donde arranca el contenido (como en Structured). */
.ag-enc--con-columna .ag-enc__izq {
  flex-basis: calc(var(--ag-ancho-bandeja) - 14px);
}

.ag-enc__bandeja {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 16px;
  border: 0;
  border-radius: 18px;
  background: var(--ag-segmentado);
  color: #b4b4b6;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.ag-enc__bandeja:hover {
  color: var(--ag-texto);
}

.ag-enc__bandeja--activa {
  background: var(--ag-salmon);
  color: var(--ag-texto);
  font-weight: 600;
}

.ag-enc__bandeja .bi {
  font-size: 13px;
}

.ag-enc__bandeja-cuenta {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--ag-salmon);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
}

.ag-enc__centro {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.ag-enc__titulo {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ag-texto);
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.01em;
  white-space: nowrap;
  cursor: pointer;
}

.ag-enc__anio {
  color: var(--ag-salmon);
}

.ag-enc__chevron {
  align-self: center;
  color: var(--ag-salmon);
  font-size: 13px;
  -webkit-text-stroke: 1px;
}

.ag-enc__flechas {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.ag-enc__flecha {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--ag-apagado);
  font-size: 16px;
  cursor: pointer;
}

.ag-enc__flecha:hover {
  color: var(--ag-texto);
  background: rgba(255, 255, 255, 0.06);
}

.ag-enc__separador {
  display: inline-block;
  width: 1px;
  height: 16px;
  background: #4a4a4c;
}

.ag-enc__der {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-left: auto;
}

/* Control segmentado: fondo #3a3a3c, 40 px de alto, radio 20; el activo en salmón. */
.ag-seg {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 40px;
  padding: 0 5px;
  border-radius: 20px;
  background: var(--ag-segmentado);
}

.ag-seg__btn {
  min-width: 64px;
  height: 30px;
  padding: 0 18px;
  border: 0;
  border-radius: 15px;
  background: transparent;
  color: #b4b4b6;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.ag-seg__btn:hover:not(:disabled) {
  color: var(--ag-texto);
}

.ag-seg__btn--activo {
  background: var(--ag-salmon);
  color: var(--ag-texto);
}

.ag-seg__btn:disabled {
  color: #5c5c5e;
  cursor: not-allowed;
}

.ag-enc__acciones {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 36px;
  padding: 0 6px;
  border-radius: 18px;
  background: var(--ag-segmentado);
}

.ag-enc__accion {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #b4b4b6;
  font-size: 17px;
  cursor: pointer;
}

.ag-enc__accion:hover {
  color: var(--ag-texto);
}

.ag-enc__accion--activa,
.ag-enc__accion--activa:hover {
  color: var(--ag-salmon);
}

.ag-enc__accion--girando .bi {
  animation: ag-girar 1s linear infinite;
}

@keyframes ag-girar {
  to {
    transform: rotate(360deg);
  }
}

.ag-enc__ajustes {
  position: relative;
}

/* Popovers de la cabecera (comparten la clase ag-pop con el resto de la agenda). */
.ag-pop {
  position: absolute;
  z-index: 40;
  padding: 10px;
  border: 1px solid var(--ag-borde);
  border-radius: 16px;
  background: var(--ag-elevado);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
}

.ag-enc__pop-mes {
  top: calc(100% + 10px);
  left: 0;
  width: 270px;
}

.ag-enc__pop-anio {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 4px 8px;
  font-size: 15px;
  font-weight: 700;
}

.ag-enc__pop-meses {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.ag-enc__pop-mes-btn {
  height: 34px;
  border: 0;
  border-radius: 17px;
  background: transparent;
  color: var(--ag-texto);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.ag-enc__pop-mes-btn:hover {
  background: rgba(255, 255, 255, 0.07);
}

.ag-enc__pop-mes-btn--activo,
.ag-enc__pop-mes-btn--activo:hover {
  background: var(--ag-salmon);
}

.ag-enc__pop-hoy {
  width: 100%;
  height: 34px;
  margin-top: 8px;
  border: 1px solid var(--ag-borde);
  border-radius: 17px;
  background: transparent;
  color: var(--ag-salmon);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.ag-enc__pop-ajustes {
  top: calc(100% + 12px);
  right: -6px;
  width: 240px;
  padding: 6px;
}

.ag-enc__pop-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-height: 38px;
  margin: 0;
  padding: 6px 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--ag-texto);
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}

.ag-enc__pop-item:hover {
  background: rgba(255, 255, 255, 0.07);
}

.ag-enc__pop-item .bi {
  margin-right: 6px;
  color: var(--ag-salmon);
}

/* Interruptor chico en salmón, sin depender de los estilos claros de Bootstrap. */
.ag-switch {
  appearance: none;
  -webkit-appearance: none;
  position: relative;
  flex: 0 0 auto;
  width: 34px;
  height: 20px;
  margin: 0;
  border-radius: 10px;
  background: #5a5a5c;
  cursor: pointer;
  transition: background 0.15s ease;
}

.ag-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.15s ease;
}

.ag-switch:checked {
  background: var(--ag-salmon);
}

.ag-switch:checked::after {
  transform: translateX(14px);
}

/* Tablet: un poco más apretado para que entre en una sola fila. */
@media (max-width: 1199.98px) {
  .ag-enc {
    gap: 12px;
    padding: 12px 18px;
  }

  .ag-enc__titulo {
    font-size: 21px;
  }

  .ag-enc__der {
    gap: 10px;
  }

  .ag-seg__btn {
    min-width: 0;
    padding: 0 12px;
  }
}

/* Tablet: la bandeja solo con el ícono, para que todo entre en una fila (si no entra, el
   grupo de la derecha baja a una segunda fila gracias al flex-wrap). */
@media (min-width: 768px) and (max-width: 1199.98px) {
  .ag-enc__bandeja {
    width: 36px;
    padding: 0;
    justify-content: center;
  }

  .ag-enc__bandeja-cuenta {
    position: absolute;
    top: -5px;
    right: -6px;
  }
}

/*
  Teléfono: dos filas. Arriba bandeja + título + flechas; abajo el segmentado (que se estira) y
  la pastilla de acciones. Las bases de flex fuerzan el corte: título (200) + segmentado (180) no
  entran en 360 px, así que el segmentado y las acciones bajan juntos.
*/
.ag-enc--telefono {
  gap: 10px 8px;
  padding: 10px 12px;
}

.ag-enc--telefono .ag-enc__bandeja {
  width: 36px;
  padding: 0;
  justify-content: center;
}

.ag-enc--telefono .ag-enc__bandeja-cuenta {
  position: absolute;
  top: -5px;
  right: -6px;
}

.ag-enc--telefono .ag-enc__centro {
  flex: 1 1 200px;
  gap: 4px;
}

.ag-enc--telefono .ag-enc__titulo {
  font-size: 18px;
  gap: 4px;
}

.ag-enc--telefono .ag-enc__flecha {
  width: 22px;
}

.ag-enc--telefono .ag-enc__der {
  display: contents;
}

.ag-enc--telefono .ag-seg {
  order: 2;
  flex: 1 1 180px;
  min-width: 0;
  padding: 0 3px;
}

.ag-enc--telefono .ag-enc__acciones {
  order: 3;
  flex: 0 0 auto;
}

.ag-enc--telefono .ag-seg__btn {
  flex: 1 1 0;
  min-width: 0;
  padding: 0 4px;
}

.ag-enc--telefono .ag-enc__pop-mes {
  left: -44px;
  width: min(270px, calc(100vw - 32px));
}
</style>
