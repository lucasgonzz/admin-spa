<template>
  <!--
    Agenda del admin (misión agenda-admin, 31/10/2026): copia de la interfaz de Structured
    (https://web.structured.app/) con las tareas personales de cada admin. Es el orquestador:
    tiene el estado (vista, día elegido, ocurrencias del rango visible, bandeja, selección
    múltiple, arrastre), habla con la API (agenda_api.js) y reparte a los subcomponentes.

    Todo el tema oscuro vive bajo la clase raíz `.agenda` (los tokens de color son variables CSS
    que heredan los hijos); el resto del admin, que es claro, no se toca.

    Se usa a pantalla completa en /agenda (views/Agenda.vue) y embebida en el Inicio (prop
    `embebido`, con el alto que le da el contenedor).
  -->
  <div
    class="agenda"
    :class="{
      'agenda--embebida': embebido,
      'agenda--telefono': es_telefono,
      'agenda--tablet': es_tablet,
    }"
  >
    <encabezado
      :vista="vista"
      :fecha_elegida="fecha_elegida"
      :hoy="hoy"
      :bandeja_abierta="bandeja_abierta"
      :bandeja_en_columna="bandeja_en_columna"
      :cantidad_bandeja="bandeja_visible.length"
      :seleccion_activa="seleccion_activa"
      :mostrar_completadas="mostrar_completadas"
      :es_telefono="es_telefono"
      :es_tablet="es_tablet"
      :cargando="cargando"
      @alternar-bandeja="alternar_bandeja"
      @cambiar-vista="cambiar_vista"
      @anterior="navegar(-1)"
      @siguiente="navegar(1)"
      @ir-a-fecha="ir_a_fecha"
      @alternar-seleccion="alternar_modo_seleccion"
      @alternar-completadas="alternar_completadas"
      @actualizar="cargar"
    />

    <!--
      Aviso de que la agenda no se pudo traer. El caso más probable es un SPA nuevo contra una
      API todavía sin desplegar (404/405): se avisa y la pantalla sigue entera, sin bucles.
    -->
    <div v-if="aviso" class="agenda__aviso" role="alert">
      <i class="bi bi-exclamation-triangle-fill" aria-hidden="true" />
      <span>{{ aviso }}</span>
      <button v-if="!api_no_disponible" type="button" class="agenda__aviso-boton" @click="cargar">
        Reintentar
      </button>
    </div>

    <div class="agenda__cuerpo">
      <!-- Bandeja como columna fija (escritorio) -->
      <bandeja
        v-if="bandeja_abierta && bandeja_en_columna"
        :tareas="bandeja_visible"
        :seleccion_activa="seleccion_activa"
        :seleccionadas="seleccionadas"
        :arrastrando="!!arrastre"
        :creando="creando_en_bandeja"
        :es_telefono="es_telefono"
        @crear="crear_en_bandeja"
        @abrir="abrir_tarea"
        @programar="programar_desde_bandeja"
        @alternar-seleccion="alternar_seleccion"
        @iniciar-arrastre="iniciar_arrastre"
        @terminar-arrastre="terminar_arrastre"
        @soltar="soltar"
      />

      <div class="agenda__principal">
        <franja-semana
          :modo="modo_franja"
          :dias="dias_franja"
          :fecha_elegida="fecha_elegida"
          :hoy="hoy"
          :ocurrencias_por_dia="ocurrencias_por_dia"
          :arrastrando="!!arrastre"
          :con_canaleta="vista === 'semana' || vista === 'varios'"
          :es_telefono="es_telefono"
          @elegir-dia="elegir_dia"
          @soltar-en-dia="soltar({ tipo: 'dia', fecha: $event })"
        />

        <div
          ref="superficie"
          class="agenda__superficie"
          :class="{ 'agenda__superficie--mes': vista === 'mes' }"
          data-ag-scroll
        >
          <div v-if="cargando && !cargado_una_vez" class="agenda__cargando" role="status">
            <span class="agenda__girando" aria-hidden="true" />
            <span class="visually-hidden">Cargando la agenda…</span>
          </div>

          <vista-dia
            v-else-if="vista === 'dia'"
            :fecha="fecha_elegida"
            :ocurrencias="ocurrencias_del_dia"
            :seleccion_activa="seleccion_activa"
            :seleccionadas="seleccionadas"
            :arrastrando="!!arrastre"
            :es_telefono="es_telefono"
            @abrir="abrir_tarea"
            @alternar-hecha="alternar_hecha"
            @alternar-subpaso="alternar_subpaso"
            @nueva-en="nueva_en"
            @alternar-seleccion="alternar_seleccion"
            @iniciar-arrastre="iniciar_arrastre"
            @terminar-arrastre="terminar_arrastre"
            @soltar="soltar"
          />

          <vista-varios-dias
            v-else-if="vista === 'varios'"
            :dias="dias_varios"
            :ocurrencias_por_dia="ocurrencias_por_dia"
            :fecha_elegida="fecha_elegida"
            :seleccion_activa="seleccion_activa"
            :seleccionadas="seleccionadas"
            :arrastrando="!!arrastre"
            :es_telefono="es_telefono"
            @abrir="abrir_tarea"
            @alternar-seleccion="alternar_seleccion"
            @nueva-en="nueva_en"
            @iniciar-arrastre="iniciar_arrastre"
            @terminar-arrastre="terminar_arrastre"
            @soltar="soltar"
          />

          <vista-semana
            v-else-if="vista === 'semana'"
            :dias="dias_semana"
            :ocurrencias_por_dia="ocurrencias_por_dia"
            :fecha_elegida="fecha_elegida"
            :seleccion_activa="seleccion_activa"
            :seleccionadas="seleccionadas"
            :arrastrando="!!arrastre"
            :es_telefono="es_telefono"
            @abrir="abrir_tarea"
            @alternar-seleccion="alternar_seleccion"
            @nueva-en="nueva_en"
            @iniciar-arrastre="iniciar_arrastre"
            @terminar-arrastre="terminar_arrastre"
            @soltar="soltar"
          />

          <vista-mes
            v-else
            :fecha_elegida="fecha_elegida"
            :hoy="hoy"
            :ocurrencias_por_dia="ocurrencias_por_dia"
            :arrastrando="!!arrastre"
            :es_telefono="es_telefono"
            @elegir-dia="elegir_dia"
            @ver-dia="ver_dia"
            @abrir="abrir_tarea"
            @soltar="soltar"
            @iniciar-arrastre="iniciar_arrastre"
            @terminar-arrastre="terminar_arrastre"
          />
        </div>

        <!-- Botón flotante "+": tarea nueva en el día elegido, a continuación de la última -->
        <button
          v-if="!seleccion_activa"
          type="button"
          class="agenda__fab"
          aria-label="Nueva tarea"
          title="Nueva tarea"
          :disabled="api_no_disponible"
          @click="nueva_desde_boton"
        >
          <i class="bi bi-plus-lg" aria-hidden="true" />
        </button>

        <barra-seleccion
          v-if="seleccion_activa"
          :cantidad="seleccionadas.length"
          :todas_elegidas="todas_elegidas"
          :ocupado="ocupado_masivo"
          :hoy="hoy"
          :es_telefono="es_telefono"
          @seleccionar-todas="seleccionar_todas"
          @reprogramar="reprogramar_seleccion"
          @cambiar-fecha="cambiar_fecha_seleccion"
          @cambiar-color="cambiar_color_seleccion"
          @completar="completar_seleccion"
          @borrar="confirmar_borrado_masivo = true"
          @duplicar="duplicar_seleccion"
          @mover-bandeja="mover_seleccion_a_bandeja"
          @listo="alternar_modo_seleccion"
        />
      </div>
    </div>

    <!--
      Bandeja como cajón superpuesto (tablet y teléfono). Mientras se arrastra una tarjeta desde
      el cajón, el cajón y el velo se corren fuera de la vista (no se desmontan: si el nodo
      arrastrado desaparece, el navegador no avisa el fin del arrastre) para dejar ver dónde
      soltarla.
    -->
    <template v-if="bandeja_abierta && !bandeja_en_columna">
      <div
        class="agenda__velo"
        :class="{ 'agenda__velo--escondido': cajon_escondido }"
        aria-hidden="true"
        @click="bandeja_abierta = false"
      />
      <bandeja
        flotante
        :class="{ 'agenda__cajon--escondido': cajon_escondido }"
        :tareas="bandeja_visible"
        :seleccion_activa="seleccion_activa"
        :seleccionadas="seleccionadas"
        :arrastrando="!!arrastre"
        :creando="creando_en_bandeja"
        :es_telefono="es_telefono"
        @crear="crear_en_bandeja"
        @abrir="abrir_tarea"
        @programar="programar_desde_bandeja"
        @alternar-seleccion="alternar_seleccion"
        @iniciar-arrastre="iniciar_arrastre_desde_cajon"
        @terminar-arrastre="terminar_arrastre"
        @soltar="soltar"
        @cerrar="bandeja_abierta = false"
      />
    </template>

    <panel-tarea
      v-if="panel"
      :key="panel.clave"
      :tarea="panel.tarea"
      :borrador="panel.borrador"
      :hoy="hoy"
      :fecha_por_defecto="fecha_elegida"
      :es_telefono="es_telefono"
      @cerrar="panel = null"
      @guardado="on_panel_guardado"
      @cambio="cargar"
    />

    <dialogo-confirmar
      v-if="confirmar_borrado_masivo"
      :titulo="seleccionadas.length === 1 ? '¿Borrar la tarea elegida?' : '¿Borrar las ' + seleccionadas.length + ' tareas elegidas?'"
      :texto="texto_borrado_masivo"
      texto_cancelar="Cancelar"
      texto_confirmar="Borrar"
      :ocupado="ocupado_masivo"
      @cancelar="confirmar_borrado_masivo = false"
      @confirmar="borrar_seleccion"
    />
  </div>
</template>

<script>
import Encabezado from './Encabezado.vue'
import FranjaSemana from './FranjaSemana.vue'
import VistaDia from './VistaDia.vue'
import VistaVariosDias from './VistaVariosDias.vue'
import VistaSemana from './VistaSemana.vue'
import VistaMes from './VistaMes.vue'
import Bandeja from './Bandeja.vue'
import PanelTarea from './PanelTarea.vue'
import BarraSeleccion from './BarraSeleccion.vue'
import DialogoConfirmar from './DialogoConfirmar.vue'
import {
  listar_agenda,
  crear_tarea,
  actualizar_tarea,
  borrar_tarea,
  completar_tarea,
  descompletar_tarea,
  duplicar_tarea,
  actualizar_subpaso,
  es_api_no_disponible,
  status_de,
} from './agenda_api'
import {
  MINUTOS_DIA,
  clave_ocurrencia,
  clave_seleccion,
  diferencia_dias,
  dias_desde,
  fin_de,
  grilla_mes,
  hoy_texto,
  hora_de_minutos,
  inicio_de,
  inicio_semana,
  mismo_mes,
  ordenar_ocurrencias,
  redondear_a_cuarto,
  sumar_dias,
  sumar_meses,
} from './agenda_utils'

/** Clave de localStorage con las preferencias de la agenda (vista y mostrar completadas). */
const CLAVE_PREFERENCIAS = 'agenda_admin_preferencias'

/** Cada cuánto se vuelve a pedir el rango visible (las tareas que crea Claude por la API). */
const AGENDA_POLL_MS = 60000

/** Vistas válidas. */
const VISTAS = ['dia', 'varios', 'semana', 'mes']

/**
 * Lee las preferencias guardadas en el navegador. Si el almacenamiento no está disponible
 * (ventana privada, bloqueado) devuelve un objeto vacío y la agenda arranca con los defaults.
 *
 * @returns {Object}
 */
function leer_preferencias() {
  try {
    const crudo = window.localStorage.getItem(CLAVE_PREFERENCIAS)
    const datos = crudo ? JSON.parse(crudo) : {}
    return datos && typeof datos === 'object' ? datos : {}
  } catch (error) {
    return {}
  }
}

/**
 * Guarda las preferencias en el navegador (si se puede; si no, se ignora en silencio).
 *
 * @param {Object} datos
 * @returns {void}
 */
function guardar_preferencias(datos) {
  try {
    window.localStorage.setItem(CLAVE_PREFERENCIAS, JSON.stringify(datos))
  } catch (error) {
    /* Sin almacenamiento la preferencia dura lo que dura la pantalla: no es un error del operador. */
  }
}

/**
 * Muestra una toast con el mecanismo global del admin (App.vue escucha este evento).
 *
 * @param {string} mensaje
 * @param {string} variante 'warning' | 'danger' | 'success' | 'info'
 * @returns {void}
 */
function avisar(mensaje, variante) {
  window.dispatchEvent(
    new CustomEvent('admin-spa-toast', { detail: { message: mensaje, variant: variante || 'warning' } })
  )
}

/**
 * Fecha visible de una ocurrencia (la de esa ocurrencia; la base si no vino expandida).
 *
 * @param {Object} tarea
 * @returns {string|null}
 */
function fecha_de(tarea) {
  return tarea.occurrence_date || tarea.date || null
}

export default {
  name: 'AgendaIndex',
  components: {
    Encabezado,
    FranjaSemana,
    VistaDia,
    VistaVariosDias,
    VistaSemana,
    VistaMes,
    Bandeja,
    PanelTarea,
    BarraSeleccion,
    DialogoConfirmar,
  },
  props: {
    /**
     * true cuando va dentro del Inicio (alto fijo que da el contenedor, bordes redondeados); false
     * a pantalla completa en /agenda.
     */
    embebido: { type: Boolean, default: false },
  },
  data() {
    const preferencias = leer_preferencias()
    const hoy = hoy_texto()
    return {
      /** Vista activa: 'dia' | 'varios' | 'semana' | 'mes' (se recuerda en el navegador). */
      vista: VISTAS.indexOf(preferencias.vista) !== -1 ? preferencias.vista : 'dia',
      /** Día elegido (`YYYY-MM-DD`): define el rango visible y dónde se crean las tareas. */
      fecha_elegida: hoy,
      /** Hoy (`YYYY-MM-DD`); al primer GET se toma el `hoy` del servidor. */
      hoy: hoy,
      /** Ocurrencias del rango visible tal como las devuelve la API (incluidas las hechas). */
      ocurrencias: [],
      /** Tareas de la bandeja (sin fecha). */
      bandeja: [],
      /** true mientras hay un GET del rango en vuelo. */
      cargando: false,
      /** true después de la primera respuesta (buena o mala): deja de mostrarse el spinner grande. */
      cargado_una_vez: false,
      /** Número del último GET pedido; las respuestas de pedidos viejos se descartan. */
      numero_pedido: 0,
      /** Texto del aviso de error ('' si todo bien). */
      aviso: '',
      /** true si la API respondió 404/405 al listado (SPA nuevo contra API vieja). */
      api_no_disponible: false,
      /** Mostrar las tareas completadas (se recuerda; se cambia desde el engranaje). */
      mostrar_completadas: preferencias.mostrar_completadas !== false,
      /** true si la bandeja está abierta. */
      bandeja_abierta: false,
      /** true mientras se crea una tarea desde el alta rápida de la bandeja. */
      creando_en_bandeja: false,
      /** Panel de la tarea abierto: null | `{ clave, tarea, borrador }`. */
      panel: null,
      /** true con la selección múltiple activa. */
      seleccion_activa: false,
      /** Claves de selección (`clave_seleccion`) de las tareas elegidas. */
      seleccionadas: [],
      /** true mientras corren las llamadas de una acción masiva. */
      ocupado_masivo: false,
      /** true con el diálogo de borrar las elegidas abierto. */
      confirmar_borrado_masivo: false,
      /** Arrastre en curso: null | `{ tarea, desde_cajon? }` (la ocurrencia que se agarró). */
      arrastre: null,
      /** true mientras se arrastra desde el cajón de la bandeja: el cajón se corre fuera de la vista. */
      cajon_escondido: false,
      /** true en teléfono (< 768 px). */
      es_telefono: false,
      /** true en tablet (768 a 1199 px). */
      es_tablet: false,
      /** MediaQueryList de teléfono (para sacar el listener al desmontar). */
      consulta_telefono: null,
      /** MediaQueryList de tablet. */
      consulta_tablet: null,
      /** Referencia al setInterval del poleo (se limpia en beforeUnmount). */
      poll_id: null,
    }
  },
  computed: {
    /**
     * true si la bandeja abierta va como columna fija (escritorio, ≥ 1200 px).
     *
     * @returns {boolean}
     */
    bandeja_en_columna() {
      return !this.es_telefono && !this.es_tablet
    },
    /**
     * Cuántos días muestra "Varios días": 4 (2 en teléfono, donde 4 columnas no entran).
     *
     * @returns {number}
     */
    cantidad_varios() {
      return this.es_telefono ? 2 : 4
    },
    /**
     * Días de la semana del día elegido (domingo a sábado).
     *
     * @returns {string[]}
     */
    dias_semana() {
      return dias_desde(inicio_semana(this.fecha_elegida), 7)
    },
    /**
     * Días de "Varios días" (desde el elegido).
     *
     * @returns {string[]}
     */
    dias_varios() {
      return dias_desde(this.fecha_elegida, this.cantidad_varios)
    },
    /**
     * Rango que se le pide a la API según la vista.
     *
     * @returns {{desde: string, hasta: string}}
     */
    rango_visible() {
      if (this.vista === 'mes') {
        const grilla = grilla_mes(this.fecha_elegida)
        return { desde: grilla[0], hasta: grilla[grilla.length - 1] }
      }
      if (this.vista === 'varios') {
        return { desde: this.dias_varios[0], hasta: this.dias_varios[this.dias_varios.length - 1] }
      }
      return { desde: this.dias_semana[0], hasta: this.dias_semana[6] }
    },
    /**
     * Clave del rango (lo que se vigila para volver a pedir).
     *
     * @returns {string}
     */
    clave_rango() {
      return this.rango_visible.desde + '|' + this.rango_visible.hasta
    },
    /**
     * Ocurrencias que se muestran (sin las hechas si se ocultan).
     *
     * @returns {Object[]}
     */
    ocurrencias_visibles() {
      if (this.mostrar_completadas) {
        return this.ocurrencias
      }
      return this.ocurrencias.filter(function (tarea) {
        return !tarea.completed
      })
    },
    /**
     * Ocurrencias visibles agrupadas por fecha, en el orden de la API.
     *
     * @returns {Object<string, Object[]>}
     */
    ocurrencias_por_dia() {
      const por_dia = {}
      this.ocurrencias_visibles.forEach(function (tarea) {
        const fecha = fecha_de(tarea)
        if (!fecha) {
          return
        }
        if (!por_dia[fecha]) {
          por_dia[fecha] = []
        }
        por_dia[fecha].push(tarea)
      })
      return por_dia
    },
    /**
     * Ocurrencias del día elegido (vista Día).
     *
     * @returns {Object[]}
     */
    ocurrencias_del_dia() {
      return this.ocurrencias_por_dia[this.fecha_elegida] || []
    },
    /**
     * Tareas de la bandeja que se muestran.
     *
     * @returns {Object[]}
     */
    bandeja_visible() {
      if (this.mostrar_completadas) {
        return this.bandeja
      }
      return this.bandeja.filter(function (tarea) {
        return !tarea.completed
      })
    },
    /**
     * Modo de la franja de días según la vista.
     *
     * @returns {string}
     */
    modo_franja() {
      return this.vista
    },
    /**
     * Días de la franja según la vista.
     *
     * @returns {string[]}
     */
    dias_franja() {
      if (this.vista === 'varios') {
        return this.dias_varios
      }
      if (this.vista === 'mes') {
        return []
      }
      return this.dias_semana
    },
    /**
     * Tareas que se ven en la vista actual (para "Seleccionar todas"), más la bandeja si está
     * abierta.
     *
     * @returns {Object[]}
     */
    tareas_de_la_vista() {
      const self = this
      let dias = self.dias_semana
      if (self.vista === 'dia') {
        dias = [self.fecha_elegida]
      } else if (self.vista === 'varios') {
        dias = self.dias_varios
      }
      let lista = []
      dias.forEach(function (dia) {
        lista = lista.concat(self.ocurrencias_por_dia[dia] || [])
      })
      if (self.bandeja_abierta) {
        lista = lista.concat(self.bandeja_visible)
      }
      return lista
    },
    /**
     * true si todas las tareas de la vista están elegidas.
     *
     * @returns {boolean}
     */
    todas_elegidas() {
      const self = this
      const lista = self.tareas_de_la_vista
      return (
        lista.length > 0 &&
        lista.every(function (tarea) {
          return self.seleccionadas.indexOf(clave_seleccion(tarea)) !== -1
        })
      )
    },
    /**
     * Tareas (ocurrencias o de la bandeja) que corresponden a las claves elegidas.
     *
     * @returns {Object[]}
     */
    tareas_seleccionadas() {
      const self = this
      const encontradas = []
      const vistas = {}
      self.ocurrencias.concat(self.bandeja).forEach(function (tarea) {
        const clave = clave_seleccion(tarea)
        if (self.seleccionadas.indexOf(clave) !== -1 && !vistas[clave]) {
          vistas[clave] = true
          encontradas.push(tarea)
        }
      })
      return encontradas
    },
    /**
     * Texto del diálogo de borrar las elegidas (avisa si hay series).
     *
     * @returns {string}
     */
    texto_borrado_masivo() {
      const hay_series = this.tareas_seleccionadas.some(function (tarea) {
        return tarea.is_recurring
      })
      if (hay_series) {
        return 'Hay tareas que se repiten: de esas se borra la serie entera. No se puede deshacer.'
      }
      return 'Se borran con sus subpasos y no se puede deshacer.'
    },
  },
  watch: {
    /** Cada vez que cambia el rango visible se vuelve a pedir. */
    clave_rango() {
      this.cargar()
    },
  },
  mounted() {
    const self = this
    self.instalar_consultas_de_ancho()
    self.cargar()
    self.poll_id = window.setInterval(function () {
      /* No se refresca mientras se edita, se arrastra o corre una acción masiva: un refresco en
         el medio movería las tareas debajo del puntero. */
      if (self.panel || self.arrastre || self.ocupado_masivo || document.visibilityState !== 'visible') {
        return
      }
      self.cargar()
    }, AGENDA_POLL_MS)
    document.addEventListener('visibilitychange', self.on_visibility_change)
  },
  beforeUnmount() {
    /* 🔴 Todo lo que se instaló en mounted se saca acá: el admin ya tuvo fugas de listeners. */
    if (this.poll_id) {
      window.clearInterval(this.poll_id)
      this.poll_id = null
    }
    document.removeEventListener('visibilitychange', this.on_visibility_change)
    if (this.consulta_telefono) {
      this.consulta_telefono.removeEventListener('change', this.actualizar_anchos)
    }
    if (this.consulta_tablet) {
      this.consulta_tablet.removeEventListener('change', this.actualizar_anchos)
    }
  },
  methods: {
    /* ==================== Ancho de pantalla ==================== */

    /**
     * Instala las media queries de teléfono y tablet y toma el ancho actual.
     *
     * @returns {void}
     */
    instalar_consultas_de_ancho() {
      if (typeof window.matchMedia !== 'function') {
        return
      }
      this.consulta_telefono = window.matchMedia('(max-width: 767.98px)')
      this.consulta_tablet = window.matchMedia('(min-width: 768px) and (max-width: 1199.98px)')
      this.consulta_telefono.addEventListener('change', this.actualizar_anchos)
      this.consulta_tablet.addEventListener('change', this.actualizar_anchos)
      this.actualizar_anchos()
    },
    /**
     * Relee las media queries (al rotar o redimensionar).
     *
     * @returns {void}
     */
    actualizar_anchos() {
      this.es_telefono = !!(this.consulta_telefono && this.consulta_telefono.matches)
      this.es_tablet = !!(this.consulta_tablet && this.consulta_tablet.matches)
    },

    /* ==================== Carga ==================== */

    /**
     * Pide a la API las ocurrencias del rango visible y la bandeja.
     *
     * `silent_error: true`: el error se muestra en el aviso de la agenda y no como toast, porque
     * este pedido se repite solo (poleo, volver a la pestaña) y el caso más probable (SPA nuevo
     * contra API vieja, 404) no es un problema del operador.
     *
     * @returns {Promise<void>}
     */
    cargar() {
      const self = this
      const rango = self.rango_visible
      self.numero_pedido = self.numero_pedido + 1
      const numero = self.numero_pedido
      self.cargando = true
      return listar_agenda(rango.desde, rango.hasta, { silent_error: true })
        .then(function (respuesta) {
          if (numero !== self.numero_pedido) {
            return
          }
          const datos = respuesta.data || {}
          self.ocurrencias = ordenar_ocurrencias(Array.isArray(datos.ocurrencias) ? datos.ocurrencias : [])
          self.bandeja = Array.isArray(datos.bandeja) ? datos.bandeja : []
          if (typeof datos.hoy === 'string' && datos.hoy.length >= 10) {
            self.hoy = datos.hoy.substring(0, 10)
          }
          self.aviso = ''
          self.api_no_disponible = false
          self.cargando = false
          self.cargado_una_vez = true
          self.podar_seleccion()
        })
        .catch(function (error) {
          if (numero !== self.numero_pedido) {
            return
          }
          self.cargando = false
          self.cargado_una_vez = true
          const status = status_de(error)
          if (es_api_no_disponible(error)) {
            self.api_no_disponible = true
            self.ocurrencias = []
            self.bandeja = []
            self.aviso =
              'La agenda todavía no está disponible: esta pantalla es más nueva que el servidor. ' +
              'Se arregla en la próxima actualización del admin.'
            return
          }
          if (status === 401) {
            /* Sesión vencida: el guard de rutas se ocupa; no hace falta otro aviso. */
            return
          }
          /* Otro error (red, 500): se conservan los datos que ya había y se avisa. */
          self.aviso = 'No se pudo traer la agenda. Probá de nuevo en un momento.'
        })
    },
    /**
     * Al volver a la pestaña se refresca (Claude pudo haber creado o movido tareas).
     *
     * @returns {void}
     */
    on_visibility_change() {
      if (document.visibilityState !== 'visible' || this.panel || this.arrastre) {
        return
      }
      this.cargar()
    },
    /**
     * Ejecuta una escritura y refresca el rango al terminar, salga bien o mal (si salió mal, el
     * interceptor ya mostró el motivo y el refresco deshace lo optimista).
     *
     * @param {Promise} promesa
     * @returns {Promise<void>}
     */
    escribir_y_refrescar(promesa) {
      const self = this
      return promesa
        .then(function () {
          return self.cargar()
        })
        .catch(function () {
          return self.cargar()
        })
    },

    /* ==================== Navegación ==================== */

    /**
     * Cambia la vista (Mes no se puede con la selección múltiple activa, como en Structured).
     *
     * @param {string} vista
     * @returns {void}
     */
    cambiar_vista(vista) {
      if (VISTAS.indexOf(vista) === -1 || (vista === 'mes' && this.seleccion_activa)) {
        return
      }
      const self = this
      self.vista = vista
      self.guardar_preferencias()
      /* La superficie es UN solo contenedor de scroll para las cuatro vistas: sin esto, Día y Mes
         heredaban el scroll de la grilla horaria (venir de Semana dejaba la primera tarea del día
         escondida arriba). Semana y Varios días se ubican solas en la primera tarea al montarse. */
      if (vista === 'dia' || vista === 'mes') {
        self.$nextTick(function () {
          if (self.$refs.superficie) {
            self.$refs.superficie.scrollTop = 0
          }
        })
      }
    },
    /**
     * ‹ / ›: una semana en Día y Semana, los días visibles en Varios días, un mes en Mes.
     *
     * @param {number} sentido -1 | 1
     * @returns {void}
     */
    navegar(sentido) {
      if (this.vista === 'mes') {
        const destino = sumar_meses(this.fecha_elegida, sentido)
        this.fecha_elegida = mismo_mes(destino, this.hoy) ? this.hoy : destino
        return
      }
      const paso = this.vista === 'varios' ? this.cantidad_varios : 7
      this.fecha_elegida = sumar_dias(this.fecha_elegida, sentido * paso)
    },
    /**
     * Va a una fecha (selector de mes, "Ir a hoy").
     *
     * @param {string} fecha
     * @returns {void}
     */
    ir_a_fecha(fecha) {
      this.fecha_elegida = fecha
    },
    /**
     * Elige un día (franja, celda del mes).
     *
     * @param {string} fecha
     * @returns {void}
     */
    elegir_dia(fecha) {
      this.fecha_elegida = fecha
    },
    /**
     * Abre un día en la vista Día (número de la celda, "N más…").
     *
     * @param {string} fecha
     * @returns {void}
     */
    ver_dia(fecha) {
      this.fecha_elegida = fecha
      this.vista = 'dia'
      this.guardar_preferencias()
    },
    /**
     * Prende o apaga "Mostrar completadas" (engranaje) y lo recuerda.
     *
     * @returns {void}
     */
    alternar_completadas() {
      this.mostrar_completadas = !this.mostrar_completadas
      this.guardar_preferencias()
      this.podar_seleccion()
    },
    /**
     * Guarda vista y "mostrar completadas" en el navegador.
     *
     * @returns {void}
     */
    guardar_preferencias() {
      guardar_preferencias({ vista: this.vista, mostrar_completadas: this.mostrar_completadas })
    },
    /**
     * Abre o cierra la bandeja.
     *
     * @returns {void}
     */
    alternar_bandeja() {
      this.bandeja_abierta = !this.bandeja_abierta
    },

    /* ==================== Crear y abrir ==================== */

    /**
     * Hora libre para una tarea nueva en un día: a continuación de la última que tiene; si no
     * tiene ninguna, la próxima del cuarto de hora si es hoy, o las 9.
     *
     * @param {string} fecha
     * @returns {string} `HH:MM`
     */
    proxima_hora_libre(fecha) {
      let fin_maximo = null
      this.ocurrencias.forEach(function (tarea) {
        if (fecha_de(tarea) !== fecha || inicio_de(tarea) === null) {
          return
        }
        const fin = fin_de(tarea)
        fin_maximo = fin_maximo === null ? fin : Math.max(fin_maximo, fin)
      })
      const ultima_posible = MINUTOS_DIA - 15
      if (fin_maximo !== null) {
        return hora_de_minutos(Math.min(fin_maximo, ultima_posible))
      }
      if (fecha === this.hoy) {
        const ahora = new Date()
        const minutos = redondear_a_cuarto(ahora.getHours() * 60 + ahora.getMinutes())
        return hora_de_minutos(Math.min(minutos, ultima_posible))
      }
      return '09:00'
    },
    /**
     * Abre el panel de una tarea existente.
     *
     * @param {Object} tarea
     * @returns {void}
     */
    abrir_tarea(tarea) {
      if (this.api_no_disponible) {
        return
      }
      if (!this.bandeja_en_columna) {
        this.bandeja_abierta = false
      }
      this.panel = { clave: 'editar-' + clave_ocurrencia(tarea) + '-' + Date.now(), tarea: tarea, borrador: null }
    },
    /**
     * Abre el panel de una tarea nueva con valores iniciales.
     *
     * @param {Object} borrador `{ date, start_time, all_day, duration_minutes }`
     * @returns {void}
     */
    abrir_nueva(borrador) {
      if (this.api_no_disponible) {
        return
      }
      this.panel = { clave: 'nueva-' + Date.now(), tarea: null, borrador: borrador }
    },
    /**
     * Botón "+": tarea nueva en el día elegido, a continuación de la última, de 15 min.
     *
     * @returns {void}
     */
    nueva_desde_boton() {
      const fecha = this.fecha_elegida
      this.abrir_nueva({
        date: fecha,
        start_time: this.proxima_hora_libre(fecha),
        all_day: false,
        duration_minutes: 15,
      })
    },
    /**
     * Tarea nueva en un día y hora puntuales ("Tiempo libre. ¿Qué sigue?", clic en la grilla).
     *
     * @param {{fecha: string, hora: string}} lugar
     * @returns {void}
     */
    nueva_en(lugar) {
      this.abrir_nueva({ date: lugar.fecha, start_time: lugar.hora, all_day: false, duration_minutes: 15 })
    },
    /**
     * El panel guardó algo: se refresca y, si corresponde, se cierra.
     *
     * @param {{cerrar: boolean}} datos
     * @returns {void}
     */
    on_panel_guardado(datos) {
      if (!datos || datos.cerrar !== false) {
        this.panel = null
      }
      this.cargar()
    },
    /**
     * Alta rápida en la bandeja: POST con solo el título (`date: null`).
     *
     * @param {string} titulo
     * @returns {void}
     */
    crear_en_bandeja(titulo) {
      const self = this
      self.creando_en_bandeja = true
      crear_tarea({ title: titulo, date: null })
        .then(function () {
          self.creando_en_bandeja = false
          return self.cargar()
        })
        .catch(function () {
          self.creando_en_bandeja = false
        })
    },
    /**
     * "+" de una tarjeta de la bandeja: la programa en el día elegido, después de la última tarea.
     *
     * @param {Object} tarea
     * @returns {void}
     */
    programar_desde_bandeja(tarea) {
      const fecha = this.fecha_elegida
      const cambios = { date: fecha, all_day: false, start_time: this.proxima_hora_libre(fecha) }
      this.mover_local(tarea, cambios)
      this.escribir_y_refrescar(actualizar_tarea(tarea.id, cambios))
    },

    /* ==================== Hecha y subpasos desde la línea de tiempo ==================== */

    /**
     * Marca o desmarca una tarea desde su círculo (en una repetida, solo esa ocurrencia). Se pinta
     * enseguida y el refresco confirma.
     *
     * @param {Object} tarea
     * @returns {void}
     */
    alternar_hecha(tarea) {
      const marcar = !tarea.completed
      tarea.completed = marcar
      const llamada = marcar ? completar_tarea(tarea) : descompletar_tarea(tarea)
      this.escribir_y_refrescar(llamada)
    },
    /**
     * Marca o desmarca un subpaso desde la línea de tiempo.
     *
     * @param {Object} tarea
     * @param {Object} subpaso
     * @returns {void}
     */
    alternar_subpaso(tarea, subpaso) {
      const valor = !subpaso.done
      subpaso.done = valor
      tarea.subtasks_done = Math.max(0, (tarea.subtasks_done || 0) + (valor ? 1 : -1))
      this.escribir_y_refrescar(actualizar_subpaso(tarea.id, subpaso.id, { done: valor }))
    },

    /* ==================== Drag & drop ==================== */

    /**
     * Fecha base que hay que mandar para que una ocurrencia caiga en `nueva_fecha`. En una
     * repetida se corre la base de la serie la misma cantidad de días (se mueve la serie entera).
     *
     * @param {Object} tarea
     * @param {string} nueva_fecha
     * @returns {string}
     */
    fecha_base_para(tarea, nueva_fecha) {
      if (tarea.is_recurring && tarea.occurrence_date && tarea.date) {
        return sumar_dias(tarea.date, diferencia_dias(tarea.occurrence_date, nueva_fecha))
      }
      return nueva_fecha
    },
    /**
     * Empieza un arrastre.
     *
     * @param {Object} tarea
     * @returns {void}
     */
    iniciar_arrastre(tarea) {
      this.arrastre = { tarea: tarea }
    },
    /**
     * Empieza un arrastre desde el cajón de la bandeja (tablet): el cajón se cierra para dejar ver
     * la agenda donde se va a soltar.
     *
     * @param {Object} tarea
     * @returns {void}
     */
    iniciar_arrastre_desde_cajon(tarea) {
      const self = this
      self.arrastre = { tarea: tarea, desde_cajon: true }
      /* Se esconde en el tick siguiente: el navegador saca la "foto" de lo que se arrastra justo
         después del dragstart, y si el cajón ya se corrió la foto sale vacía. */
      window.setTimeout(function () {
        if (self.arrastre) {
          self.cajon_escondido = true
        }
      }, 0)
    },
    /**
     * Termina un arrastre (dragend llega después del drop). Si se soltó fuera de un destino, el
     * cajón de la bandeja vuelve a aparecer como estaba.
     *
     * @returns {void}
     */
    terminar_arrastre() {
      this.arrastre = null
      this.cajon_escondido = false
    },
    /**
     * Sueltan la tarea arrastrada en un destino. Arma el PUT según el destino:
     * - `hora` (columna de Semana / Varios días, hueco del Día): fecha + hora, deja de ser de todo el día.
     * - `todo_el_dia` (franja de arriba de la grilla): fecha + todo el día.
     * - `dia` (día de la franja, celda del mes, vista Día): cambia la fecha y mantiene la hora; una
     *   de la bandeja va a continuación de la última tarea de ese día.
     * - `bandeja`: vuelve a la bandeja (`date: null`).
     *
     * @param {{tipo: string, fecha?: string, hora?: string}} destino
     * @returns {void}
     */
    soltar(destino) {
      const tarea = this.arrastre ? this.arrastre.tarea : null
      const desde_cajon = !!(this.arrastre && this.arrastre.desde_cajon)
      this.arrastre = null
      this.cajon_escondido = false
      if (desde_cajon && destino && destino.tipo !== 'bandeja') {
        /* Se soltó en la agenda una tarjeta que venía del cajón: el cajón queda cerrado. */
        this.bandeja_abierta = false
      }
      if (!tarea || !destino) {
        return
      }
      const en_bandeja = !tarea.date
      const fecha_actual = fecha_de(tarea)
      let cambios = null
      if (destino.tipo === 'bandeja') {
        if (en_bandeja) {
          return
        }
        cambios = { date: null }
      } else if (destino.tipo === 'hora') {
        const misma_hora = inicio_de(tarea) !== null && hora_de_minutos(inicio_de(tarea)) === destino.hora
        if (!en_bandeja && fecha_actual === destino.fecha && misma_hora) {
          return
        }
        cambios = { date: this.fecha_base_para(tarea, destino.fecha), start_time: destino.hora, all_day: false }
      } else if (destino.tipo === 'todo_el_dia') {
        if (!en_bandeja && fecha_actual === destino.fecha && tarea.all_day) {
          return
        }
        cambios = { date: this.fecha_base_para(tarea, destino.fecha), all_day: true }
      } else {
        if (en_bandeja) {
          cambios = { date: destino.fecha, all_day: false, start_time: this.proxima_hora_libre(destino.fecha) }
        } else {
          if (fecha_actual === destino.fecha) {
            return
          }
          cambios = { date: this.fecha_base_para(tarea, destino.fecha) }
        }
      }
      this.mover_local(tarea, cambios)
      this.escribir_y_refrescar(actualizar_tarea(tarea.id, cambios))
    },
    /**
     * Movimiento optimista de una tarea NO repetida: se la pinta enseguida en su lugar nuevo
     * mientras viaja el PUT (las repetidas esperan al refresco, porque mover la serie mueve
     * varias ocurrencias a la vez).
     *
     * @param {Object} tarea
     * @param {Object} cambios Lo que se manda en el PUT.
     * @returns {void}
     */
    mover_local(tarea, cambios) {
      if (tarea.is_recurring) {
        return
      }
      const copia = Object.assign({}, tarea)
      if (Object.prototype.hasOwnProperty.call(cambios, 'date')) {
        copia.date = cambios.date
        copia.occurrence_date = cambios.date
      }
      if (cambios.date === null) {
        copia.start_time = null
        copia.end_time = null
        copia.all_day = false
      } else {
        if (Object.prototype.hasOwnProperty.call(cambios, 'all_day')) {
          copia.all_day = cambios.all_day
        }
        if (cambios.start_time) {
          copia.start_time = cambios.start_time
        }
        if (copia.all_day) {
          copia.start_time = null
          copia.end_time = null
        } else if (copia.start_time) {
          const inicio = inicio_de(copia)
          copia.end_time = hora_de_minutos(inicio + (copia.duration_minutes || 15))
        }
      }
      const sin_ella = function (lista) {
        return lista.filter(function (item) {
          return item.id !== tarea.id
        })
      }
      this.ocurrencias = sin_ella(this.ocurrencias)
      this.bandeja = sin_ella(this.bandeja)
      if (copia.date) {
        this.ocurrencias = ordenar_ocurrencias(this.ocurrencias.concat([copia]))
      } else {
        this.bandeja = this.bandeja.concat([copia])
      }
    },

    /* ==================== Selección múltiple ==================== */

    /**
     * Prende o apaga la selección múltiple (tilde de la cabecera, "Listo"). Al prenderla desde Mes
     * se pasa a Día, porque en Mes no está disponible.
     *
     * @returns {void}
     */
    alternar_modo_seleccion() {
      this.seleccion_activa = !this.seleccion_activa
      this.seleccionadas = []
      this.confirmar_borrado_masivo = false
      if (this.seleccion_activa) {
        this.panel = null
        if (this.vista === 'mes') {
          this.vista = 'dia'
        }
      }
    },
    /**
     * Elige o suelta una tarea.
     *
     * @param {Object} tarea
     * @returns {void}
     */
    alternar_seleccion(tarea) {
      const clave = clave_seleccion(tarea)
      const indice = this.seleccionadas.indexOf(clave)
      if (indice === -1) {
        this.seleccionadas = this.seleccionadas.concat([clave])
      } else {
        this.seleccionadas = this.seleccionadas.filter(function (item) {
          return item !== clave
        })
      }
    },
    /**
     * "Seleccionar todas" (o "Quitar selección" si ya estaban todas).
     *
     * @returns {void}
     */
    seleccionar_todas() {
      if (this.todas_elegidas) {
        this.seleccionadas = []
        return
      }
      const claves = []
      this.tareas_de_la_vista.forEach(function (tarea) {
        const clave = clave_seleccion(tarea)
        if (claves.indexOf(clave) === -1) {
          claves.push(clave)
        }
      })
      this.seleccionadas = claves
    },
    /**
     * Saca de la selección las tareas que ya no están (borradas, ocultas, fuera del rango).
     *
     * @returns {void}
     */
    podar_seleccion() {
      if (!this.seleccionadas.length) {
        return
      }
      const presentes = {}
      const lista = this.mostrar_completadas
        ? this.ocurrencias.concat(this.bandeja)
        : this.ocurrencias_visibles.concat(this.bandeja_visible)
      lista.forEach(function (tarea) {
        presentes[clave_seleccion(tarea)] = true
      })
      this.seleccionadas = this.seleccionadas.filter(function (clave) {
        return !!presentes[clave]
      })
    },
    /**
     * Una tarea por id (una serie con varias ocurrencias elegidas se toca una sola vez).
     *
     * @param {Object[]} tareas
     * @returns {Object[]}
     */
    unicas_por_id(tareas) {
      const vistos = {}
      return tareas.filter(function (tarea) {
        if (vistos[tarea.id]) {
          return false
        }
        vistos[tarea.id] = true
        return true
      })
    },
    /**
     * Aplica una llamada a la API por tarea, todas en paralelo; al terminar refresca y, si alguna
     * falló, avisa una sola vez cuántas no se aplicaron. Las llamadas van con `silent_error` para
     * no tirar una toast por tarea.
     *
     * @param {Object[]} tareas
     * @param {Function} crear_llamada `(tarea, opciones) => Promise|null` (null = no aplica a esa tarea).
     * @param {string} [texto_omitidas] Aviso para las tareas a las que no se les aplica ("no tenían horario").
     * @returns {Promise<number>} Cantidad de fallas.
     */
    aplicar_en_lote(tareas, crear_llamada, texto_omitidas) {
      const self = this
      const opciones = { silent_error: true }
      let fallas = 0
      let omitidas = 0
      let api_vieja = false
      self.ocupado_masivo = true
      const promesas = tareas.map(function (tarea) {
        const llamada = crear_llamada(tarea, opciones)
        if (!llamada) {
          omitidas = omitidas + 1
          return Promise.resolve()
        }
        return llamada.catch(function (error) {
          fallas = fallas + 1
          if (es_api_no_disponible(error)) {
            api_vieja = true
          }
        })
      })
      return Promise.all(promesas).then(function () {
        self.ocupado_masivo = false
        const intentadas = tareas.length - omitidas
        if (fallas > 0) {
          avisar(
            fallas === intentadas
              ? 'No se pudo aplicar el cambio a ninguna de las ' + intentadas + ' tareas.'
              : 'No se pudo aplicar el cambio a ' + fallas + ' de ' + intentadas + ' tareas.',
            'warning'
          )
        }
        if (omitidas > 0 && texto_omitidas) {
          avisar(omitidas + (omitidas === 1 ? ' tarea ' : ' tareas ') + texto_omitidas, 'info')
        }
        if (api_vieja && fallas === intentadas) {
          self.api_no_disponible = true
        }
        return self.cargar().then(function () {
          return fallas
        })
      })
    },
    /**
     * Reprogramar: corre la hora de las elegidas (con signo). Si se pasa de la medianoche cambia de
     * día. Las de todo el día y las de la bandeja no tienen hora: se dejan como están.
     *
     * @param {number} minutos
     * @returns {void}
     */
    reprogramar_seleccion(minutos) {
      const self = this
      self.aplicar_en_lote(
        self.unicas_por_id(self.tareas_seleccionadas),
        function (tarea, opciones) {
          const inicio = inicio_de(tarea)
          if (inicio === null || !fecha_de(tarea)) {
            return null
          }
          const total = inicio + minutos
          const dias = Math.floor(total / MINUTOS_DIA)
          const nueva_fecha = sumar_dias(fecha_de(tarea), dias)
          return actualizar_tarea(
            tarea.id,
            {
              date: self.fecha_base_para(tarea, nueva_fecha),
              start_time: hora_de_minutos(total - dias * MINUTOS_DIA),
              all_day: false,
            },
            opciones
          )
        },
        'sin horario (de todo el día o de la bandeja) no se movieron.'
      )
    },
    /**
     * Fecha: les cambia el día a las elegidas manteniendo la hora (las de la bandeja salen de la
     * bandeja a ese día).
     *
     * @param {string} fecha
     * @returns {void}
     */
    cambiar_fecha_seleccion(fecha) {
      const self = this
      self.aplicar_en_lote(self.unicas_por_id(self.tareas_seleccionadas), function (tarea, opciones) {
        if (!tarea.date) {
          return actualizar_tarea(
            tarea.id,
            { date: fecha, all_day: false, start_time: self.proxima_hora_libre(fecha) },
            opciones
          )
        }
        if (fecha_de(tarea) === fecha) {
          return Promise.resolve()
        }
        return actualizar_tarea(tarea.id, { date: self.fecha_base_para(tarea, fecha) }, opciones)
      })
    },
    /**
     * Color: se lo cambia a todas las elegidas.
     *
     * @param {string} color
     * @returns {void}
     */
    cambiar_color_seleccion(color) {
      this.aplicar_en_lote(this.unicas_por_id(this.tareas_seleccionadas), function (tarea, opciones) {
        if (tarea.color === color) {
          return Promise.resolve()
        }
        return actualizar_tarea(tarea.id, { color: color }, opciones)
      })
    },
    /**
     * Marcar hechas (por ocurrencia). Si ya estaban todas hechas, las desmarca.
     *
     * @returns {void}
     */
    completar_seleccion() {
      const elegidas = this.tareas_seleccionadas
      const todas_hechas =
        elegidas.length > 0 &&
        elegidas.every(function (tarea) {
          return tarea.completed
        })
      this.aplicar_en_lote(elegidas, function (tarea, opciones) {
        if (todas_hechas) {
          return descompletar_tarea(tarea, opciones)
        }
        if (tarea.completed) {
          return Promise.resolve()
        }
        return completar_tarea(tarea, opciones)
      })
    },
    /**
     * Borrar las elegidas (confirmado). Una serie se borra entera.
     *
     * @returns {void}
     */
    borrar_seleccion() {
      const self = this
      self.aplicar_en_lote(self.unicas_por_id(self.tareas_seleccionadas), function (tarea, opciones) {
        return borrar_tarea(tarea.id, opciones)
      }).then(function () {
        self.confirmar_borrado_masivo = false
        self.podar_seleccion()
      })
    },
    /**
     * Duplicar las elegidas.
     *
     * @returns {void}
     */
    duplicar_seleccion() {
      this.aplicar_en_lote(this.unicas_por_id(this.tareas_seleccionadas), function (tarea, opciones) {
        return duplicar_tarea(tarea.id, opciones)
      })
    },
    /**
     * Mover a la bandeja las elegidas (`date: null`).
     *
     * @returns {void}
     */
    mover_seleccion_a_bandeja() {
      this.aplicar_en_lote(this.unicas_por_id(this.tareas_seleccionadas), function (tarea, opciones) {
        if (!tarea.date) {
          return Promise.resolve()
        }
        return actualizar_tarea(tarea.id, { date: null }, opciones)
      })
    },
  },
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

/*
  Tema oscuro de Structured, encapsulado: los tokens viven en la raíz y los heredan todos los
  subcomponentes (sus estilos scoped usan var(--ag-…)). Medidas tomadas de su página.
*/
.agenda {
  --ag-negro: #000000;
  --ag-fondo: #242424;
  --ag-superficie: #1c1c1e;
  --ag-elevado: #2c2c2e;
  --ag-borde: #3a3a3c;
  --ag-segmentado: #3a3a3c;
  --ag-salmon: #f88e87;
  --ag-apagado: #858585;
  --ag-texto: #ffffff;
  --ag-canaleta: 48px;
  --ag-ancho-bandeja: 360px;
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 520px;
  overflow: hidden;
  border-radius: 18px;
  background: var(--ag-negro);
  color: var(--ag-texto);
  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px;
  line-height: 1.4;
  color-scheme: dark;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Los textos de Bootstrap (p, ul) traen márgenes y colores claros: adentro de la agenda no. */
.agenda :deep(p) {
  color: inherit;
}

.agenda :deep(button) {
  font-family: inherit;
}

.agenda :deep(input),
.agenda :deep(textarea),
.agenda :deep(select) {
  font-family: inherit;
}

.agenda__aviso {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
  margin: 0 30px 12px;
  padding: 10px 14px;
  border: 1px solid #6b5a2a;
  border-radius: 12px;
  background: #3a3218;
  color: #f7dc8a;
  font-size: 13px;
}

.agenda__aviso-boton {
  margin-left: auto;
  padding: 4px 12px;
  border: 1px solid #7d6a33;
  border-radius: 14px;
  background: transparent;
  color: #f7dc8a;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.agenda__cuerpo {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}

.agenda__principal {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

/* Superficie de la línea de tiempo: #1c1c1e con las esquinas de arriba bien redondeadas. */
.agenda__superficie {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  border-radius: 28px 28px 0 0;
  background: var(--ag-superficie);
  scrollbar-color: #3a3a3c transparent;
  scrollbar-width: thin;
}

.agenda__cargando {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 240px;
}

.agenda__girando {
  width: 34px;
  height: 34px;
  border: 3px solid var(--ag-salmon);
  border-right-color: transparent;
  border-radius: 50%;
  animation: agenda-girar 0.8s linear infinite;
}

@keyframes agenda-girar {
  to {
    transform: rotate(360deg);
  }
}

/* Botón flotante "+" salmón, abajo a la derecha. */
.agenda__fab {
  position: absolute;
  right: 30px;
  bottom: 30px;
  z-index: 20;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--ag-salmon);
  color: #fff;
  font-size: 22px;
  cursor: pointer;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
  transition: transform 0.12s ease, filter 0.12s ease;
}

.agenda__fab:hover:not(:disabled) {
  filter: brightness(1.05);
  transform: scale(1.05);
}

.agenda__fab:disabled {
  background: #5a3836;
  color: #a77;
  cursor: not-allowed;
}

/* Velo detrás del cajón de la bandeja (tablet y teléfono). */
.agenda__velo {
  position: absolute;
  inset: 0;
  z-index: 29;
  background: rgba(0, 0, 0, 0.5);
  transition: opacity 0.15s ease;
}

/* Durante un arrastre desde el cajón, velo y cajón se corren para dejar ver la agenda. */
.agenda__velo--escondido {
  opacity: 0;
  pointer-events: none;
}

.agenda__cajon--escondido {
  opacity: 0;
  pointer-events: none;
  transform: translateX(-105%);
  transition: transform 0.15s ease, opacity 0.15s ease;
}

/* Embebida en el Inicio: misma cara, el alto lo pone el contenedor. */
.agenda--embebida {
  min-height: 0;
}

/* Tablet: canaleta de horas más angosta. */
.agenda--tablet {
  --ag-canaleta: 44px;
}

/* Teléfono: canaleta angosta, superficie con radio menor y "+" más cerca del borde. */
.agenda--telefono {
  --ag-canaleta: 32px;
  min-height: 0;
  border-radius: 14px;
}

.agenda--telefono .agenda__superficie {
  border-radius: 20px 20px 0 0;
}

.agenda--telefono .agenda__fab {
  right: 16px;
  bottom: 16px;
}

.agenda--telefono .agenda__aviso {
  margin: 0 12px 10px;
}
</style>
