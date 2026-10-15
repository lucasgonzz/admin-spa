/**
 * Tema claro / oscuro del centro de recursos (misión centro-recursos-soporte-y-tema, 14/10/2026).
 *
 * El tema es el atributo `data-tema="light|dark"` de `<html>`: las variables de color de
 * `estilos.css` cuelgan de `:root[data-tema="dark"]`. Lo resuelve ANTES del primer pintado un
 * `<script>` inline de `recursos.html` (así no hay destello); este módulo toma el resultado, lo
 * expone como estado reactivo (el logo y el interruptor de la cabecera lo leen) y se ocupa de lo
 * que el script inline no puede: el interruptor y seguir al navegador en vivo.
 *
 * Prioridad (la misma del script inline, que se repite acá por si el HTML llegó sin él):
 * 1) `?tema=dark|light` de la URL — lo manda el sistema del cliente al abrir «Tutoriales» con el
 *    tema que el usuario tiene en su gestión — y se GUARDA como preferencia;
 * 2) lo guardado en `localStorage` (`cc-recursos-tema`): la última elección, la haya hecho en el
 *    sistema o con el interruptor de acá;
 * 3) el tema del navegador (`prefers-color-scheme`). Mientras no haya nada guardado, si el
 *    navegador cambia de tema la página lo acompaña.
 *
 * Todo acceso a `localStorage` va en try/catch: sin storage (ventana privada, sitio bloqueado) la
 * página anda igual y el interruptor sigue valiendo hasta que se cierra la pestaña.
 */
import { reactive } from 'vue'

/** Clave de `localStorage` donde queda el tema elegido. */
export const CLAVE_TEMA = 'cc-recursos-tema'

/** Color de la barra del navegador (`<meta name="theme-color">`) por tema: el del panel de la cabecera. */
const COLOR_BARRA = { light: '#ffffff', dark: '#1b1e24' }

/** Tema vigente. Lo lee la cabecera (logo e interruptor). */
export const estado_tema = reactive({
  /** 'light' | 'dark'. */
  tema: 'light',
})

/** true si el visitante eligió con el interruptor en esta pestaña (aunque no se haya podido guardar). */
let eligio = false

/**
 * Indica si un valor es uno de los dos temas válidos.
 *
 * @param {any} valor
 * @returns {boolean}
 */
function es_tema(valor) {
  return valor === 'light' || valor === 'dark'
}

/**
 * Tema guardado en `localStorage`, o null si no hay (o no se puede leer).
 *
 * @returns {'light'|'dark'|null}
 */
function leer_guardado() {
  try {
    /** Valor guardado. */
    const valor = window.localStorage.getItem(CLAVE_TEMA)
    return es_tema(valor) ? valor : null
  } catch (e) {
    return null
  }
}

/**
 * Guarda el tema elegido. Sin storage no pasa nada: es una comodidad.
 *
 * @param {'light'|'dark'} tema
 * @returns {void}
 */
function guardar(tema) {
  try {
    window.localStorage.setItem(CLAVE_TEMA, tema)
  } catch (e) {
    /* Sin localStorage el tema vale solo en esta pestaña. */
  }
}

/**
 * Tema que pide el navegador.
 *
 * @returns {'light'|'dark'}
 */
function del_navegador() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Tema que vino en `?tema=` (solo si es válido), o null.
 *
 * @returns {'light'|'dark'|null}
 */
function de_la_url() {
  try {
    /** Valor del parámetro. */
    const valor = new URLSearchParams(window.location.search).get('tema')
    return es_tema(valor) ? valor : null
  } catch (e) {
    return null
  }
}

/**
 * Deja puesto el tema: atributo de `<html>`, `color-scheme` (controles nativos, barras de
 * desplazamiento y el reproductor), color de la barra del navegador y el estado reactivo.
 *
 * @param {'light'|'dark'} tema
 * @returns {void}
 */
export function aplicar_tema(tema) {
  /** Raíz del documento. */
  const raiz = document.documentElement
  raiz.setAttribute('data-tema', tema)
  raiz.style.colorScheme = tema
  /** Meta de la barra del navegador. */
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', COLOR_BARRA[tema])
  }
  estado_tema.tema = tema
}

/**
 * Arranque: toma el tema que dejó el script inline (o lo resuelve si no corrió) y se queda
 * escuchando al navegador. Se llama una vez, antes de montar la página.
 *
 * @returns {void}
 */
export function iniciar_tema() {
  /** Tema que dejó el script inline de `recursos.html`. */
  let tema = document.documentElement.getAttribute('data-tema')
  if (!es_tema(tema)) {
    /** Tema pedido por la URL, si vino. */
    const pedido = de_la_url()
    if (pedido) {
      guardar(pedido)
    }
    tema = pedido || leer_guardado() || del_navegador()
  }
  aplicar_tema(tema)

  if (window.matchMedia) {
    /** Consulta del tema del navegador. */
    const consulta = window.matchMedia('(prefers-color-scheme: dark)')
    /**
     * Acompaña al navegador solo mientras nadie haya elegido.
     * @param {MediaQueryListEvent} ev
     * @returns {void}
     */
    const al_cambiar = function (ev) {
      if (!eligio && !leer_guardado()) {
        aplicar_tema(ev.matches ? 'dark' : 'light')
      }
    }
    if (consulta.addEventListener) {
      consulta.addEventListener('change', al_cambiar)
    } else if (consulta.addListener) {
      consulta.addListener(al_cambiar)
    }
  }
}

/**
 * Cambia entre claro y oscuro (el interruptor de la cabecera) y lo recuerda.
 *
 * @returns {void}
 */
export function alternar_tema() {
  /** Tema al que se pasa. */
  const nuevo = estado_tema.tema === 'dark' ? 'light' : 'dark'
  eligio = true
  guardar(nuevo)
  aplicar_tema(nuevo)
}
