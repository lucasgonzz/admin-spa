/**
 * Piezas SVG de «El local» (misión el-local, 3/11/2026).
 *
 * PORTADO del prototipo que aprobó Lucas (`_cruzado/misiones/20261103-el-local/prototipo/index.html`):
 * misma geometría (viewBox 1600×1000), misma paleta y mismos personajes. Acá viven SOLO plantillas
 * (strings de SVG) y las constantes de posición; quien las monta y las mueve es `motor.js`, y quien
 * decide qué se mueve según el estado real es `director.js`.
 *
 * 🔴 Tres trampas que ya se pagaron en el prototipo y siguen valiendo acá:
 *   1. `transform-box: fill-box` + una animación CSS PISA el atributo `transform` del SVG: todo grupo
 *      animado (globos, chips de fase) va adentro de otro `<g>` que lleva el translate.
 *   2. La plantilla etiquetada `html` tiene que concatenar los valores interpolados (no es lit-html).
 *   3. Los ids de `<defs>` son globales del documento: van todos con prefijo `ell-` para no chocar
 *      con otro SVG del admin.
 *
 * 🔴 Todo texto que viene de la API (nombre de un negocio, slug de una misión, título de la bandeja)
 * pasa por `esc()` antes de entrar a una plantilla: se inserta con innerHTML.
 */

/** Ancho y alto del mundo (unidades del viewBox). */
export const W = 1600
export const H = 1000

/** Espacio de nombres SVG para `createElementNS`. */
export const NS = 'http://www.w3.org/2000/svg'

/**
 * Plantilla etiquetada: concatena los trozos literales con los valores interpolados.
 * `undefined` y `null` no escriben nada (así un `${cond ? x : ''}` queda limpio).
 *
 * @param {TemplateStringsArray} s
 * @param {...*} v
 * @returns {string}
 */
export function html(s, ...v) {
  return s.reduce(function (acc, chunk, i) {
    const valor = v[i]
    return acc + chunk + (valor === undefined || valor === null ? '' : valor)
  }, '')
}

/**
 * Escapa un texto para meterlo en una plantilla SVG (contenido o atributo).
 *
 * @param {*} texto
 * @returns {string}
 */
export function esc(texto) {
  return String(texto === null || texto === undefined ? '' : texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/* ---------------------------------------------------------------------------------------------
 * Geometría fija del local (la misma del prototipo)
 * ------------------------------------------------------------------------------------------- */

/** Mostrador: media caja abierta hacia el público, arriba al centro. */
export const C = { x: 640, w: 660, y: 380, railY: 520 }

/** Altura (y de los pies) de los robots parados detrás del mostrador. */
export const ROBOT_Y = C.railY - 6

/** Altura de los pies del primer cliente de la fila de una estación (adelante del mostrador). */
export const STATION_Y = 636

/**
 * Las seis estaciones del mostrador, una por agente de IA. El `id` es el del contrato B
 * (`agentes[].id` y `negocios[].estacion`); `globo` es el ícono que muestra el negocio al llegar.
 */
export const ESTACIONES = [
  { id: 'soporte', x: 700, nombre: 'Soporte', sub: 'tickets · WhatsApp', accent: '#25D366', badge: 'headset', globo: 'wa' },
  { id: 'facturas', x: 792, nombre: 'Facturas', sub: 'escaneo de compras', accent: '#FA7E06', badge: 'doc', globo: 'doc' },
  { id: 'negocio', x: 884, nombre: 'WhatsApp', sub: 'clientes del negocio', accent: '#3A31FC', badge: 'chat', globo: 'chat' },
  { id: 'asistente', x: 976, nombre: 'Asistente', sub: 'agente personal', accent: '#0B84F8', badge: 'star', globo: 'star' },
  { id: 'informes', x: 1068, nombre: 'Mostrador', sub: 'informes diarios', accent: '#14B8A6', badge: 'chart', globo: 'chat' },
  { id: 'comercial', x: 1160, nombre: 'Comercial', sub: 'leads · demos', accent: '#EC4899', badge: 'hand', globo: 'chat' },
]

/** Bandeja «Para Lucas», en la punta derecha del mostrador. */
export const TRAY = { x: 1246, y: C.railY - 6 }

/** Puerta de entrada: afuera (detrás del vidrio, invisible) y adentro (sobre el felpudo). */
export const PUERTA = { x: 1460, afuera: 392, adentro: 470 }

/** Pizarra de las oficinas y el escritorio del planificador. */
export const PIZARRA = { x: 205, y: 250 }
export const PLANIFICADOR = { x: 150, y: 446 }

/** Puerta del tabique de vidrio de las oficinas (hueco entre x 470 y 540). */
export const PUERTA_OFICINA = { x: 505, afuera: 770, adentro: 700 }

/** Fila de las mesas por slot. */
export const MESA_Y = 600

/**
 * Cámaras por zona (rectángulo del mundo a mostrar). En vertical se ajusta al aspecto del marco
 * sin salirse del mundo; en apaisado siempre se ve «todo».
 */
export const CAMARAS = {
  todo: [0, 0, 1600, 1000],
  mostrador: [610, 300, 720, 440],
  oficinas: [0, 150, 640, 620],
  entrada: [1240, 80, 360, 520],
}

/**
 * Color del chip de cada fase de una misión (contrato A/B: `fase`).
 * El texto lleva tilde; la clave es la del contrato.
 */
export const FASES = {
  tomado: { texto: 'tomado', color: '#64748B' },
  plan: { texto: 'plan', color: '#0B84F8' },
  construccion: { texto: 'construcción', color: '#3A31FC' },
  revision: { texto: 'revisión', color: '#8B5CF6' },
  tests: { texto: 'tests', color: '#14B8A6' },
  merge: { texto: 'merge', color: '#FA7E06' },
  informe: { texto: 'informe', color: '#0EA5E9' },
  novedad: { texto: 'novedad', color: '#EC4899' },
  cierre: { texto: 'cierre', color: '#22C55E' },
}

/** Rol de un agente de una mesa → insignia, color y rótulo (contrato A: `agentes[].rol`). */
export const ROLES = {
  planificador: { badge: 'bulb', accent: '#F59E0B', rotulo: 'planificador' },
  constructor: { badge: 'hammer', accent: '#6B7F99', rotulo: 'constructor' },
  revisor: { badge: 'lupa', accent: '#8B5CF6', rotulo: 'revisor' },
  verificador: { badge: 'check', accent: '#14B8A6', rotulo: 'verificador' },
  redactor: { badge: 'doc', accent: '#F59E0B', rotulo: 'redactor' },
  otro: { badge: 'gear', accent: '#94A3B8', rotulo: 'ayudante' },
}

/* ---------------------------------------------------------------------------------------------
 * Lugares del piso para los negocios
 * ------------------------------------------------------------------------------------------- */

/**
 * Lugar de la fila `i` frente a una estación: el primero pegado al mostrador y los siguientes en
 * zigzag hacia atrás («varios en fila»).
 *
 * @param {number} x Centro de la estación.
 * @param {number} i Posición en la fila (0 = el que está hablando).
 * @returns {{x:number,y:number}}
 */
export function lugarEnFila(x, i) {
  const k = Math.min(i, 4)
  return { x: x - 14 + (k % 2) * 56 + (i > 4 ? (i - 4) * 6 : 0), y: STATION_Y + k * 40 }
}

/**
 * Lugares del salón (el piso del local) para los que están adentro sin hablar con nadie. Quedan a
 * la izquierda del banco de los cerrados (x < 1240) para no mezclarse con ellos; la segunda fila
 * pasa por detrás de la mesa de exhibición («mirando la mercadería»).
 */
export const LUGARES_SALON = (function () {
  const lugares = []
  // un poco de desorden en la altura para que no parezca una grilla
  const desorden = [0, 8, -4, 6, -6, 4, 0]
  ;[690, 768, 846, 924, 1002, 1080, 1158].forEach(function (x, i) {
    lugares.push({ x: x, y: 762 + desorden[i] })
  })
  ;[728, 806, 884, 962, 1040, 1118, 1190].forEach(function (x, i) {
    lugares.push({ x: x, y: 834 - desorden[i] })
  })
  lugares.push({ x: 680, y: 905 })
  lugares.push({ x: 1060, y: 905 })
  lugares.push({ x: 1135, y: 910 })
  lugares.push({ x: 1290, y: 700 })
  return lugares
})()

/** Escala de los negocios sentados en el banco: van más chicos para que entren más. */
export const ESCALA_BANCO = 0.78

/** Lugares en los dos bancos de «cerrados por hoy» (abajo a la derecha). */
export const LUGARES_BANCO = (function () {
  const lugares = []
  let i = 0
  for (i = 0; i < 8; i = i + 1) {
    lugares.push({ x: 1262 + i * 40, y: 846 })
  }
  for (i = 0; i < 8; i = i + 1) {
    lugares.push({ x: 1262 + i * 40, y: 928 })
  }
  return lugares
})()

/** Escala de los que esperan cerca de la entrada sin horario cargado. */
export const ESCALA_ENTRADA = 0.85

/** Lugares cerca de la entrada para los negocios sin horario y sin actividad («gris claro»). */
export const LUGARES_ENTRADA = (function () {
  const lugares = []
  const ys = [528, 592, 656]
  ys.forEach(function (y) {
    ;[1398, 1448, 1498, 1548].forEach(function (x) {
      lugares.push({ x: x, y: y })
    })
  })
  return lugares
})()

/**
 * Columnas de las mesas de los slots según cuántas hay: hasta tres, anchas (como el prototipo);
 * cuatro o cinco, angostas. Más de cinco no entran: se muestran cinco y un «+N».
 *
 * @param {number} n
 * @returns {Array<{x:number,w:number}>}
 */
export function columnasMesas(n) {
  if (n <= 3) {
    // anchas: con margen a la izquierda para que el rótulo del primer ayudante no se corte contra
    // el borde, y a la derecha para no meterse en el tabique de vidrio (x 610)
    return [
      { x: 50, w: 150 },
      { x: 235, w: 150 },
      { x: 420, w: 150 },
    ]
  }
  return [
    { x: 24, w: 104 },
    { x: 138, w: 104 },
    { x: 252, w: 104 },
    { x: 366, w: 104 },
    { x: 480, w: 104 },
  ]
}

/** Tope de mesas visibles en las oficinas. */
export const MAX_MESAS = 5

/** Tope de ayudantes (constructores, revisores…) de una mesa ancha. */
export const MAX_AYUDANTES = 4

/** Tope de ayudantes de una mesa angosta (con 4 o 5 mesas no entran más sin taparse). */
export const MAX_AYUDANTES_ANGOSTA = 2

/**
 * Lugar del ayudante `k` de una mesa.
 *
 * - Mesa ancha (hasta 3 mesas): los dos primeros parados a los costados, adelante, como el
 *   prototipo; el tercero y el cuarto detrás de la mesa, a los lados del orquestador.
 * - Mesa angosta (4 o 5 mesas): todos detrás de la mesa, a los lados del orquestador. Adelante
 *   tapaban la plaquita de la mesa y sus rótulos se pisaban con los de la mesa de al lado (o se
 *   cortaban contra el borde izquierdo).
 *
 * `atras: true` → va en la capa de atrás (la mesa le tapa las piernas) y sin rótulo.
 *
 * @param {{x:number,w:number}} col
 * @param {number} k
 * @returns {{x:number,y:number,atras:boolean}}
 */
export function lugarAyudante(col, k) {
  const angosta = col.w < 130
  if (!angosta && k === 0) {
    return { x: col.x + 6, y: 690, atras: false }
  }
  if (!angosta && k === 1) {
    return { x: col.x + col.w - 6, y: 690, atras: false }
  }
  const margen = angosta ? 16 : 30
  const izquierda = angosta ? k === 0 : k === 2
  return { x: izquierda ? col.x + margen : col.x + col.w - margen, y: MESA_Y - 1, atras: true }
}

/* ---------------------------------------------------------------------------------------------
 * Colores derivados de un nombre (iniciales y ropa de los negocios sin logo)
 * ------------------------------------------------------------------------------------------- */

const PALETA_INICIALES = ['#E11D48', '#F59E0B', '#0EA5E9', '#16A34A', '#D946EF', '#0891B2', '#7C3AED', '#B45309', '#DC2626', '#2563EB', '#059669', '#C026D3']
const PALETA_CAMISAS = ['#3B4A5E', '#5B7A99', '#8B5E3C', '#4A6C8C', '#6B5B95', '#5E6B4A', '#7A4A5E']
const PALETA_PANTALONES = ['#2B3645', '#3A3A48', '#2F3B2F']

/**
 * Hash chico y estable de un texto (para elegir colores sin que cambien entre refrescos).
 *
 * @param {string} texto
 * @returns {number}
 */
export function hashTexto(texto) {
  const s = String(texto || '')
  let h = 0
  let i = 0
  for (i = 0; i < s.length; i = i + 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/**
 * Dos letras para la cabeza de un negocio sin logo: la primera de las dos primeras palabras, o las
 * dos primeras letras si es una sola palabra.
 *
 * @param {string} nombre
 * @returns {string}
 */
export function iniciales(nombre) {
  const limpio = String(nombre || '').trim().replace(/[^\p{L}\p{N}\s]/gu, ' ')
  const palabras = limpio.split(/\s+/).filter(Boolean)
  if (palabras.length === 0) {
    return '?'
  }
  if (palabras.length === 1) {
    return palabras[0].slice(0, 2).toUpperCase()
  }
  return (palabras[0][0] + palabras[1][0]).toUpperCase()
}

/**
 * Colores de un negocio (cabeza sin logo, camisa y pantalón) derivados de su nombre.
 *
 * @param {string} nombre
 * @returns {{color:string, shirt:string, pants:string}}
 */
export function coloresDe(nombre) {
  const h = hashTexto(nombre)
  return {
    color: PALETA_INICIALES[h % PALETA_INICIALES.length],
    shirt: PALETA_CAMISAS[(h >> 3) % PALETA_CAMISAS.length],
    pants: PALETA_PANTALONES[(h >> 6) % PALETA_PANTALONES.length],
  }
}

/* ---------------------------------------------------------------------------------------------
 * defs: gradientes, patrones, filtros e isotipo
 * ------------------------------------------------------------------------------------------- */

/**
 * @returns {string}
 */
export function defs() {
  return html`<defs>
	<linearGradient id="ell-gWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E6EDF8"/><stop offset="1" stop-color="#F7F9FD"/></linearGradient>
	<linearGradient id="ell-gFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7F3EC"/><stop offset="1" stop-color="#EAE2D5"/></linearGradient>
	<linearGradient id="ell-gCarpet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E3E9F4"/><stop offset="1" stop-color="#D5DEEE"/></linearGradient>
	<linearGradient id="ell-gBrand" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0B84F8"/><stop offset="1" stop-color="#3A31FC"/></linearGradient>
	<linearGradient id="ell-gBrandV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B84F8"/><stop offset="1" stop-color="#3A31FC"/></linearGradient>
	<linearGradient id="ell-gCounter" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22324D"/><stop offset="1" stop-color="#111C2C"/></linearGradient>
	<linearGradient id="ell-gGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#BFE0FF" stop-opacity=".55"/><stop offset=".5" stop-color="#E8F3FF" stop-opacity=".25"/><stop offset="1" stop-color="#BFE0FF" stop-opacity=".5"/></linearGradient>
	<linearGradient id="ell-gScreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1D3B63"/><stop offset="1" stop-color="#0F1F36"/></linearGradient>
	<linearGradient id="ell-gWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E2C59C"/><stop offset="1" stop-color="#CFAE82"/></linearGradient>
	<pattern id="ell-tiles" width="90" height="90" patternUnits="userSpaceOnUse"><path d="M90 0H0V90" fill="none" stroke="#000" stroke-opacity=".05" stroke-width="1.5"/></pattern>
	<filter id="ell-shadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#0B1220" flood-opacity=".22"/></filter>
	<filter id="ell-soft" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#0B1220" flood-opacity=".18"/></filter>
	<filter id="ell-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
	<symbol id="ell-isotipo" viewBox="0 0 256 256"><g fill="none" stroke="url(#ell-gBrandV)" stroke-width="33"><path d="M 61.79 49.1 A 103 103 0 0 1 187.08 43.62"/><path d="M 52.67 198.24 A 103 103 0 0 1 52.67 57.76"/><path d="M 217.2 179.5 A 103 103 0 0 1 61.79 206.9"/></g><g fill="url(#ell-gBrandV)"><rect x="75.5" y="140" width="28" height="52" rx="3"/><rect x="114" y="115" width="28" height="77" rx="3"/><rect x="152.5" y="93" width="28" height="99" rx="3"/></g><path fill="#FA7E06" d="M 205 64 L 178.5 75 Q 193.5 76.4 195.5 92 Z"/></symbol>
</defs>`
}

/* ---------------------------------------------------------------------------------------------
 * Piezas chicas reutilizables
 * ------------------------------------------------------------------------------------------- */

/**
 * Monitor sobre el mostrador o un escritorio. `ref` lo deja ubicable para prenderlo/apagarlo.
 *
 * @param {number} x
 * @param {number} y
 * @param {string} [ref]
 * @returns {string}
 */
export function monitor(x, y, ref) {
  return html`<g transform="translate(${x},${y})" filter="url(#ell-soft)" ${ref ? 'data-ref="' + ref + '"' : ''} class="monitor">
	<rect x="-3" y="0" width="6" height="10" fill="#8FA0B8"/><rect x="-14" y="8" width="28" height="4" rx="2" fill="#8FA0B8"/>
	<rect x="-22" y="-30" width="44" height="30" rx="4" fill="#101C28"/>
	<rect class="pantalla screen-on" x="-19" y="-27" width="38" height="24" rx="3" fill="url(#ell-gScreen)"/>
	<g class="lineas" fill="#7CE0FF" opacity=".8"><rect x="-15" y="-22" width="18" height="2.5" rx="1"/><rect x="-15" y="-16" width="26" height="2.5" rx="1"/><rect x="-15" y="-10" width="12" height="2.5" rx="1"/></g>
</g>`
}

/** @returns {string} */
export function teclado(x, y) {
  return html`<rect x="${x - 16}" y="${y}" width="32" height="8" rx="2" fill="#C9D3E3"/>`
}

/** @returns {string} */
export function planta(x, y, s) {
  return html`<g transform="translate(${x},${y}) scale(${s || 1})"><ellipse cx="0" cy="4" rx="22" ry="6" fill="#000" opacity=".12"/><rect x="-18" y="-22" width="36" height="24" rx="5" fill="#B48A5C"/><ellipse cx="-12" cy="-38" rx="13" ry="20" fill="#3FA06A"/><ellipse cx="10" cy="-46" rx="13" ry="26" fill="#2F8A58"/><ellipse cx="0" cy="-30" rx="11" ry="15" fill="#58B87E"/></g>`
}

/**
 * Papel de ticket apoyado sobre el mostrador.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} rot
 * @param {string} color
 * @param {boolean} nuevo Si es nuevo, entra con el «pop».
 * @returns {string}
 */
export function papel(x, y, rot, color, nuevo) {
  return html`<g transform="translate(${x},${y}) rotate(${rot})"><g class="${nuevo ? 'tag' : ''}" filter="url(#ell-soft)"><rect x="-11" y="-14" width="22" height="28" rx="2" fill="#fff"/><rect x="-11" y="-14" width="22" height="5" rx="2" fill="${color}"/><g fill="#C9D3E3"><rect x="-7" y="-5" width="14" height="2"/><rect x="-7" y="0" width="10" height="2"/><rect x="-7" y="5" width="12" height="2"/></g></g></g>`
}

/* ---------------------------------------------------------------------------------------------
 * Escenografía: lo fijo del local, en tres capas (atrás, medio, adelante)
 * ------------------------------------------------------------------------------------------- */

/**
 * Lo que va en la capa de atrás: pared, piso, cartel, oficinas (alfombra, pizarra), puerta,
 * banco y los carteles colgantes de las estaciones.
 *
 * Partes vivas (las toca el director, por `data-ref`): `puerta`, `pizarra`, `pend-<estación>`,
 * `banco-extra`, `entrada-extra`.
 *
 * @returns {string}
 */
export function capaAtras() {
  let s = ''
  // pared y piso
  s += html`<rect x="0" y="0" width="${W}" height="400" fill="url(#ell-gWall)"/>`
  s += html`<rect x="0" y="400" width="${W}" height="${H - 400}" fill="url(#ell-gFloor)"/>`
  s += html`<rect x="0" y="400" width="${W}" height="${H - 400}" fill="url(#ell-tiles)"/>`
  s += html`<rect x="0" y="392" width="${W}" height="10" fill="#C9D3E3"/>`
  s += html`<rect x="0" y="402" width="${W}" height="3" fill="#000" opacity=".06"/>`
  // cartel de ComercioCity en la pared, arriba del mostrador
  s += html`<g transform="translate(930,120)">
	<rect x="-250" y="-62" width="500" height="124" rx="22" fill="#fff" filter="url(#ell-shadow)"/>
	<use href="#ell-isotipo" x="-225" y="-44" width="88" height="88"/>
	<text x="-120" y="-2" font-size="48" font-weight="800" fill="#101C28" letter-spacing="-1">ComercioCity</text>
	<text x="-118" y="34" font-size="16" font-weight="600" fill="#6B7A90" letter-spacing="4">EL LOCAL</text>
</g>`
  // reloj y cuadro
  s += html`<g transform="translate(1270,96)"><circle r="30" fill="#fff" stroke="#C9D3E3" stroke-width="4"/><line data-ref="reloj-h" x1="0" y1="0" x2="0" y2="-14" stroke="#101C28" stroke-width="3.5" stroke-linecap="round"/><line data-ref="reloj-m" x1="0" y1="0" x2="0" y2="-20" stroke="#101C28" stroke-width="2.5" stroke-linecap="round"/><circle r="2.5" fill="#FA7E06"/></g>`
  s += html`<g transform="translate(470,245)"><rect x="-70" y="-50" width="140" height="100" rx="8" fill="#fff" stroke="#C9D3E3" stroke-width="4"/><rect x="-54" y="-34" width="108" height="68" rx="4" fill="url(#ell-gBrand)" opacity=".9"/><path d="M-40 20 L-10 -6 L10 8 L38 -22" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g>`
  // estante con cajas y plantita, detrás del mostrador
  s += html`<g transform="translate(1100,255)">
	<rect x="-120" y="40" width="240" height="8" rx="3" fill="#C9D3E3"/>
	<rect x="-110" y="2" width="36" height="38" rx="4" fill="#0B84F8"/><rect x="-66" y="12" width="44" height="28" rx="4" fill="#3A31FC"/>
	<rect x="-10" y="18" width="30" height="22" rx="4" fill="#FA7E06"/>
	<g transform="translate(70,40)"><rect x="-14" y="-14" width="28" height="14" rx="3" fill="#B48A5C"/><ellipse cx="-8" cy="-22" rx="9" ry="12" fill="#3FA06A"/><ellipse cx="6" cy="-26" rx="9" ry="14" fill="#2F8A58"/><ellipse cx="0" cy="-18" rx="7" ry="9" fill="#58B87E"/></g>
</g>`
  // oficinas: alfombra, rótulo y pizarra (el contenido de la pizarra es vivo)
  s += html`<rect x="0" y="400" width="610" height="320" fill="url(#ell-gCarpet)"/>`
  s += html`<text x="592" y="426" text-anchor="end" font-size="12" font-weight="700" fill="#6B7A90" letter-spacing="3">OFICINAS · SOLO PERSONAL</text>`
  s += html`<g transform="translate(${PIZARRA.x},${PIZARRA.y})">
	<rect x="-130" y="-78" width="260" height="156" rx="10" fill="#fff" stroke="#C9D3E3" stroke-width="5" filter="url(#ell-soft)"/>
	<g data-ref="pizarra"></g>
</g>`
  s += html`<g transform="translate(560,470)"><rect x="-16" y="-18" width="32" height="18" rx="4" fill="#B48A5C"/><ellipse cx="-10" cy="-30" rx="11" ry="16" fill="#3FA06A"/><ellipse cx="8" cy="-36" rx="11" ry="20" fill="#2F8A58"/><ellipse cx="0" cy="-24" rx="9" ry="12" fill="#58B87E"/></g>`
  // entrada: puerta doble de vidrio, cartel, neón y felpudo
  s += html`<g data-ref="puerta" class="door" transform="translate(${PUERTA.x},285)">
	<rect x="-92" y="-118" width="184" height="236" rx="8" fill="#24344F"/>
	<rect x="-84" y="-110" width="80" height="222" rx="4" fill="url(#ell-gGlass)" stroke="#9FB3D1" stroke-width="2"/>
	<rect class="paneR" x="4" y="-110" width="80" height="222" rx="4" fill="url(#ell-gGlass)" stroke="#9FB3D1" stroke-width="2"/>
	<rect x="-14" y="-10" width="6" height="34" rx="3" fill="#C9D3E3"/><rect x="8" y="-10" width="6" height="34" rx="3" fill="#C9D3E3"/>
	<rect x="-92" y="118" width="184" height="6" fill="#1B2A44"/>
</g>`
  s += html`<g transform="translate(${PUERTA.x},138)"><rect x="-70" y="-18" width="140" height="36" rx="18" fill="#101C28"/><text x="0" y="6" text-anchor="middle" font-size="15" font-weight="700" fill="#fff" letter-spacing="3">ENTRADA</text></g>`
  // cartelito «ABIERTO» colgado del vidrio izquierdo: plaquita oscura y verde claro con brillo
  // (antes era verde oscuro sobre el vidrio oscuro y casi no se leía)
  s += html`<g transform="translate(1418,214)"><rect x="-34" y="-11" width="68" height="20" rx="10" fill="#0B1220" opacity=".9"/><text class="neon" y="3.6" text-anchor="middle" font-size="10" font-weight="700" fill="#86EFAC" letter-spacing="1.6">ABIERTO</text></g>`
  s += html`<path d="M1385 408 L1535 408 L1550 448 L1370 448 Z" fill="#8A6A4E" opacity=".9"/><path d="M1393 416 L1527 416 L1538 440 L1382 440 Z" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>`
  // los que esperan sin horario cerca de la entrada: el «+N» si no entran
  s += html`<g data-ref="entrada-extra" transform="translate(1560,470)"></g>`
  // bancos de los cerrados (abajo a la derecha): dos bancos y el rótulo
  s += html`<g transform="translate(1400,842)">
	<rect x="-160" y="-14" width="320" height="18" rx="6" fill="#B48A5C"/><rect x="-150" y="4" width="10" height="26" fill="#8A6A4E"/><rect x="140" y="4" width="10" height="26" fill="#8A6A4E"/>
</g>`
  s += html`<g transform="translate(1400,924)">
	<rect x="-160" y="-14" width="320" height="18" rx="6" fill="#B48A5C"/><rect x="-150" y="4" width="10" height="26" fill="#8A6A4E"/><rect x="140" y="4" width="10" height="26" fill="#8A6A4E"/>
</g>`
  s += html`<text x="1400" y="988" text-anchor="middle" font-size="13" font-weight="600" fill="#8FA0B8" letter-spacing="2">CERRADOS POR HOY</text>`
  s += html`<g data-ref="banco-extra" transform="translate(1575,900)"></g>`
  // carteles colgantes de las estaciones (como en un banco), con el contador de pendientes
  ESTACIONES.forEach(function (e) {
    s += html`<g transform="translate(${e.x},340)"><rect x="-44" y="-19" width="88" height="38" rx="10" fill="#101C28" filter="url(#ell-soft)"/><rect x="-44" y="-19" width="88" height="4" rx="2" fill="${e.accent}"/><text y="-1" text-anchor="middle" font-size="11.5" font-weight="700" fill="#fff" letter-spacing="1.2">${e.nombre.toUpperCase()}</text><text y="12" text-anchor="middle" font-size="8.5" font-weight="500" fill="#AEBBCF">${e.sub}</text><g data-ref="pend-${e.id}" transform="translate(40,-18)"></g></g>`
  })
  return s
}

/**
 * Capa del medio: el mostrador, monitores y teclados de cada estación, el escáner, la bandeja,
 * los tickets y el escritorio del planificador. Las mesas de los slots van en su propio grupo vivo.
 *
 * Partes vivas: `mon-<estación>`, `escaner`, `tickets`, `bandeja`, `bandeja-notas`,
 * `bandeja-badge`, `bandeja-cuenta`, `mesas`.
 *
 * @returns {string}
 */
export function capaMedio() {
  let s = ''
  s += html`<g filter="url(#ell-shadow)">
	<rect x="${C.x}" y="${C.y}" width="30" height="${C.railY - C.y + 40}" rx="6" fill="url(#ell-gCounter)"/>
	<rect x="${C.x + C.w - 30}" y="${C.y}" width="30" height="${C.railY - C.y + 40}" rx="6" fill="url(#ell-gCounter)"/>
	<rect x="${C.x}" y="${C.railY + 12}" width="${C.w}" height="48" rx="8" fill="url(#ell-gCounter)"/>
	<rect x="${C.x}" y="${C.railY}" width="${C.w}" height="16" rx="6" fill="#EEF2F8"/>
	<rect x="${C.x}" y="${C.railY + 52}" width="${C.w}" height="8" rx="4" fill="url(#ell-gBrand)"/>
	<use href="#ell-isotipo" x="${C.x + C.w / 2 - 20}" y="${C.railY + 16}" width="40" height="40"/>
</g>`
  ESTACIONES.forEach(function (e) {
    s += monitor(e.x - 26, C.railY - 8, 'mon-' + e.id)
    s += teclado(e.x + 6, C.railY + 3)
  })
  // tickets apoyados en la estación de Soporte (vivo)
  s += html`<g data-ref="tickets"></g>`
  // escáner de facturas sobre el mostrador (estación Facturas)
  s += html`<g data-ref="escaner" transform="translate(${792 + 34},${C.railY - 2})"><rect x="-18" y="-10" width="36" height="12" rx="3" fill="#2B3A52"/><rect class="scan-papel" x="-14" y="-28" width="28" height="20" rx="2" fill="#fff"/><rect class="beam" x="-16" y="-28" width="32" height="4" fill="#FA7E06"/></g>`
  // bandeja «Para Lucas» en la punta derecha del mostrador
  s += html`<g data-ref="bandeja" class="bandeja" transform="translate(${TRAY.x},${TRAY.y})" role="button" tabindex="0" aria-label="Bandeja para Lucas">
	<rect x="-40" y="-48" width="80" height="104" fill="transparent"/>
	<g filter="url(#ell-soft)"><rect x="-26" y="-6" width="52" height="12" rx="3" fill="#FA7E06"/><rect x="-26" y="-20" width="5" height="16" rx="2" fill="#FA7E06"/><rect x="21" y="-20" width="5" height="16" rx="2" fill="#FA7E06"/></g>
	<g data-ref="bandeja-notas"></g>
	<g data-ref="bandeja-badge" transform="translate(28,-30)"><g class="badge-pop"><circle r="12" fill="#FA7E06" stroke="#fff" stroke-width="3"/><text data-ref="bandeja-cuenta" y="4.5" text-anchor="middle" font-size="13" font-weight="800" fill="#fff">0</text></g></g>
	<text x="0" y="36" text-anchor="middle" font-size="12" font-weight="700" fill="#fff" letter-spacing="1.5">PARA LUCAS</text>
	<text x="0" y="49" text-anchor="middle" font-size="9.5" fill="#8FA0B8">casos delegados · misiones</text>
</g>`
  // escritorio del planificador (fijo) y las mesas de los slots (vivas)
  s += mesa({ x: 120, w: 200 }, 452, 'PLANIFICADOR', null)
  s += monitor(220, 448)
  s += html`<g data-ref="mesas"></g>`
  return s
}

/**
 * Capa de adelante: el tabique de vidrio de las oficinas, plantas y la mesa de exhibición.
 * Parte viva: `oficinas-extra` (el «+N mesas» si hay más slots trabajando que mesas).
 *
 * @returns {string}
 */
export function capaAdelante() {
  let s = ''
  s += html`<g>
	<rect x="610" y="200" width="10" height="520" rx="3" fill="#2B3A52"/>
	<rect x="612" y="206" width="6" height="508" fill="url(#ell-gGlass)"/>
	<rect x="0" y="716" width="470" height="10" rx="3" fill="#2B3A52"/>
	<rect x="540" y="716" width="80" height="10" rx="3" fill="#2B3A52"/>
	<rect x="470" y="716" width="70" height="10" rx="3" fill="#9FB3D1" opacity=".7"/>
	<rect x="0" y="570" width="470" height="146" fill="url(#ell-gGlass)" opacity=".5"/>
	<text x="505" y="748" text-anchor="middle" font-size="11" font-weight="700" fill="#6B7A90" letter-spacing="2">OFICINAS</text>
</g>`
  s += html`<g data-ref="mesas-rotulos"></g>`
  s += html`<g data-ref="oficinas-extra" transform="translate(300,760)"></g>`
  s += planta(600, 760, 1.1)
  // en el prototipo esta planta iba en x 1330 y tapaba cabezas del banco: corrida a la izquierda
  s += planta(1222, 772, 1.1)
  s += planta(60, 940, 1.2)
  // mesa de exhibición en el medio del local (el negocio también vende)
  s += html`<g transform="translate(880,880)" filter="url(#ell-shadow)">
	<rect x="-130" y="-16" width="260" height="16" rx="5" fill="url(#ell-gWood)"/><rect x="-130" y="0" width="260" height="22" rx="5" fill="#B48A5C"/>
	<rect x="-120" y="22" width="10" height="18" fill="#8A6A4E"/><rect x="110" y="22" width="10" height="18" fill="#8A6A4E"/>
	<rect x="-110" y="-46" width="40" height="30" rx="4" fill="#0B84F8"/><rect x="-62" y="-40" width="34" height="24" rx="4" fill="#3A31FC"/><rect x="-20" y="-52" width="46" height="36" rx="4" fill="#FA7E06"/><rect x="36" y="-38" width="30" height="22" rx="4" fill="#14B8A6"/><rect x="74" y="-48" width="38" height="32" rx="4" fill="#EC4899"/>
	<g transform="translate(0,-62) rotate(-8)"><rect x="-22" y="-10" width="44" height="20" rx="4" fill="#FFE27A"/><text y="4" text-anchor="middle" font-size="10" font-weight="800" fill="#7A5A00">OFERTA</text></g>
</g>`
  return s
}

/* ---------------------------------------------------------------------------------------------
 * Partes vivas: mesas, pizarra, bandeja, carteles
 * ------------------------------------------------------------------------------------------- */

/**
 * Escritorio de las oficinas (el del planificador o el de un slot), con chip de fase opcional.
 *
 * @param {{x:number,w:number}} col
 * @param {number} y
 * @param {string} rotulo Texto ya escapado.
 * @param {{texto:string,color:string}|null} fase
 * @param {{mesaNueva?:boolean, faseNueva?:boolean, titulo?:string}} [op] `mesaNueva` la hace
 *   aparecer con un fundido; `faseNueva` hace entrar el chip con «pop»; `titulo` (ya escapado)
 *   es el tooltip.
 * @returns {string}
 */
export function mesa(col, y, rotulo, fase, op) {
  const o = op || {}
  const w = col.w
  const fs = w < 130 ? 10.5 : 12
  return html`<g transform="translate(${col.x},${y})" class="${o.mesaNueva ? 'mesa-nueva' : ''}">${o.titulo ? '<title>' + o.titulo + '</title>' : ''}<g filter="url(#ell-shadow)">
	<rect x="0" y="0" width="${w}" height="14" rx="4" fill="url(#ell-gWood)"/><rect x="0" y="14" width="${w}" height="26" rx="4" fill="#B48A5C"/>
	<rect x="8" y="40" width="10" height="16" fill="#8A6A4E"/><rect x="${w - 18}" y="40" width="10" height="16" fill="#8A6A4E"/>
	${rotulo ? html`<text x="${w / 2}" y="33" text-anchor="middle" font-size="${fs}" font-weight="700" fill="#fff" letter-spacing="${w < 130 ? 0.3 : 1}">${rotulo}</text>` : ''}
</g>${fase ? chipFase(w / 2, -66, fase, w, o.faseNueva || o.mesaNueva) : ''}</g>`
}

/**
 * Plaquita con el `s<N> · proyecto` de una mesa de slot. Va en la capa de adelante y no escrita
 * en la mesa: con cuatro o cinco mesas angostas, los ayudantes parados al costado tapaban el texto.
 *
 * @param {{x:number,w:number}} col
 * @param {number} y Altura de la mesa.
 * @param {string} rotulo Texto ya escapado.
 * @param {boolean} [nueva] Aparece con un fundido.
 * @returns {string}
 */
export function plaquitaMesa(col, y, rotulo, nueva) {
  const fs = col.w < 130 ? 10.5 : 11.5
  const ancho = Math.min(col.w - 8, 18 + rotulo.length * fs * 0.58)
  return html`<g transform="translate(${col.x + col.w / 2},${y + 27})" class="${nueva ? 'mesa-nueva' : ''}"><rect x="${-ancho / 2}" y="-10" width="${ancho}" height="19" rx="9.5" fill="#5E4630" opacity=".92"/><text y="3.8" text-anchor="middle" font-size="${fs}" font-weight="700" fill="#fff" letter-spacing=".3">${rotulo}</text></g>`
}

/**
 * Chip de fase arriba de una mesa.
 *
 * @param {number} x
 * @param {number} y
 * @param {{texto:string,color:string}} fase
 * @param {number} anchoMesa
 * @param {boolean} [animar] Entra con «pop» (solo cuando la fase es nueva).
 * @returns {string}
 */
export function chipFase(x, y, fase, anchoMesa, animar) {
  const ancho = Math.min(104, Math.max(70, anchoMesa - 10))
  return html`<g transform="translate(${x},${y})"><g class="${animar ? 'tag' : ''}"><rect x="${-ancho / 2}" y="-13" width="${ancho}" height="24" rx="12" fill="${fase.color}"/><text y="4" text-anchor="middle" font-size="11.5" font-weight="700" fill="#fff" letter-spacing=".5">${esc(fase.texto)}</text></g></g>`
}

/**
 * Contenido de la pizarra de las oficinas: las misiones en curso con el color de su fase y, si la
 * PC de Lucas no reporta, el cartel chico de «sin señal».
 *
 * @param {Array<{slot:number, mision:string|null, proyecto:string|null, fase:{texto:string,color:string}|null}>} lineas
 * @param {boolean} sinSenal
 * @param {boolean} sinDatos La escena todavía no tiene ningún estado (API vieja o caída).
 * @returns {string}
 */
export function pizarra(lineas, sinSenal, sinDatos) {
  let s = ''
  let titulo = 'PLAN · sin misiones'
  if (sinDatos) {
    titulo = 'PLAN · sin datos'
  } else if (lineas.length === 1) {
    titulo = 'PLAN · misión en curso'
  } else if (lineas.length > 1) {
    titulo = 'PLAN · ' + lineas.length + ' misiones'
  }
  s += html`<text x="-112" y="-46" font-size="18" font-weight="800" fill="#101C28">${esc(titulo)}</text>`
  s += html`<rect x="-112" y="-32" width="150" height="5" rx="2.5" fill="#0B84F8"/>`
  if (lineas.length === 0) {
    // sin misiones: las rayitas del prototipo, para que la pizarra no quede vacía
    s += html`<g fill="#C9D3E3"><rect x="-112" y="-14" width="110" height="5" rx="2.5"/><rect x="-112" y="2" width="140" height="5" rx="2.5"/><rect x="-112" y="18" width="90" height="5" rx="2.5"/><rect x="-112" y="34" width="120" height="5" rx="2.5"/></g>`
  }
  lineas.slice(0, 5).forEach(function (l, i) {
    const y = -12 + i * 19
    const color = l.fase ? l.fase.color : '#94A3B8'
    const texto = 's' + l.slot + ' · ' + (l.mision || l.proyecto || 'sin misión')
    const recorte = texto.length > 22 ? texto.slice(0, 21) + '…' : texto
    s += html`<rect x="-112" y="${y - 9}" width="8" height="12" rx="2" fill="${color}"/>`
    s += html`<text x="-98" y="${y + 1}" font-size="12.5" font-weight="600" fill="#2B3A52">${esc(recorte)}</text>`
    s += html`<text x="118" y="${y + 1}" text-anchor="end" font-size="10.5" font-weight="700" fill="${color}">${esc(l.fase ? l.fase.texto : '')}</text>`
  })
  if (sinSenal) {
    // colgado del borde de arriba de la pizarra, para no tapar el título ni las misiones
    s += html`<g transform="translate(36,-80)"><g class="tag"><rect x="-88" y="-11" width="176" height="22" rx="11" fill="#FEE2E2" stroke="#FCA5A5" stroke-width="1.5"/><circle cx="-74" cy="0" r="4" fill="#EF4444"/><text x="6" y="4" text-anchor="middle" font-size="10.5" font-weight="700" fill="#B91C1C">sin señal de la PC de Lucas</text></g></g>`
  }
  return s
}

/**
 * Notitas apiladas en la bandeja (hasta cuatro, aunque haya más).
 *
 * @param {number} n
 * @returns {string}
 */
export function notasBandeja(n) {
  const k = Math.min(4, Math.max(0, n))
  let s = ''
  const colores = ['#FFE27A', '#FFF3B0', '#FFE27A', '#FFF3B0']
  let i = 0
  for (i = 0; i < k; i = i + 1) {
    s += html`<rect x="${-18 + (i % 2) * 2}" y="${-13 - i * 4}" width="30" height="8" rx="1" fill="${colores[i]}" transform="rotate(${i % 2 === 0 ? -4 : 3})"/>`
  }
  return s
}

/**
 * Contador de pendientes en el cartel de una estación (vacío si es 0).
 *
 * @param {number} n
 * @param {string} accent
 * @returns {string}
 */
export function badgePendientes(n, accent) {
  if (!n || n <= 0) {
    return ''
  }
  const texto = n > 99 ? '99+' : String(n)
  const r = texto.length > 2 ? 11 : 9
  return html`<g class="tag"><circle r="${r}" fill="${accent}" stroke="#fff" stroke-width="2.5"/><text y="3.8" text-anchor="middle" font-size="${texto.length > 2 ? 8.5 : 10.5}" font-weight="800" fill="#fff">${texto}</text></g>`
}

/**
 * Cartelito «+N» para lo que no entra en un lugar (banco lleno, mesas de más).
 *
 * @param {number} n
 * @param {string} [sufijo]
 * @returns {string}
 */
export function masN(n, sufijo) {
  if (!n || n <= 0) {
    return ''
  }
  const texto = '+' + n + (sufijo ? ' ' + sufijo : '')
  const ancho = 16 + texto.length * 7
  return html`<g class="tag"><rect x="${-ancho / 2}" y="-12" width="${ancho}" height="24" rx="12" fill="#101C28" opacity=".85"/><text y="4.5" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">${esc(texto)}</text></g>`
}

/* ---------------------------------------------------------------------------------------------
 * Personajes
 * ------------------------------------------------------------------------------------------- */

/** Insignias del pecho de los robots (y de la cabeza del icono de rol). */
export const INSIGNIAS = {
  headset: html`<path d="M-6 1 a6 6 0 0 1 12 0" fill="none" stroke="#fff" stroke-width="2.2"/><rect x="-7" y="0" width="3" height="5" rx="1" fill="#fff"/><rect x="4" y="0" width="3" height="5" rx="1" fill="#fff"/>`,
  doc: html`<rect x="-4.5" y="-6" width="9" height="12" rx="1.5" fill="#fff"/><g fill="#FA7E06"><rect x="-2.5" y="-3" width="5" height="1.5"/><rect x="-2.5" y="0" width="5" height="1.5"/><rect x="-2.5" y="3" width="3" height="1.5"/></g>`,
  chat: html`<path d="M-6 -4 h12 a2 2 0 0 1 2 2 v5 a2 2 0 0 1 -2 2 h-5 l-4 3 v-3 h-3 a2 2 0 0 1 -2 -2 v-5 a2 2 0 0 1 2 -2z" fill="#fff"/>`,
  star: html`<path d="M0 -6.5 L1.9 -2.1 L6.6 -1.7 L3 1.4 L4.1 6 L0 3.6 L-4.1 6 L-3 1.4 L-6.6 -1.7 L-1.9 -2.1 Z" fill="#fff"/>`,
  chart: html`<g fill="#fff"><rect x="-6" y="0" width="3" height="6" rx=".8"/><rect x="-1.5" y="-3" width="3" height="9" rx=".8"/><rect x="3" y="-6" width="3" height="12" rx=".8"/></g>`,
  hand: html`<path d="M-6 0 l4 -4 l4 2 l4 -2 l1 6 l-6 4 l-6 -3z" fill="#fff"/>`,
  bulb: html`<circle cy="-1.5" r="4.5" fill="#fff"/><rect x="-2.5" y="3" width="5" height="3" rx="1" fill="#fff"/>`,
  gear: html`<circle r="5" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="2.6 1.6"/><circle r="1.6" fill="#fff"/>`,
  hammer: html`<rect x="-1.2" y="-2" width="2.4" height="9" rx="1" fill="#fff"/><rect x="-6" y="-6" width="12" height="5" rx="1.5" fill="#fff"/>`,
  lupa: html`<circle cx="-1.5" cy="-1.5" r="4" fill="none" stroke="#fff" stroke-width="2.2"/><rect x="1.5" y="1.5" width="2.6" height="6" rx="1" fill="#fff" transform="rotate(-45 2.8 4.5)"/>`,
  check: html`<path d="M-5 0 l3.5 3.5 l6.5 -7" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
}

/**
 * Robot: cabeza-pantalla, antena, cuerpo con insignia, brazos y piernas. Igual al prototipo, más
 * el «zzz» de dormido (se ve solo con la clase `dormido`).
 *
 * @param {{accent:string, badge:string}} a
 * @returns {string}
 */
export function robotSVG(a) {
  return html`
	<ellipse cx="0" cy="2" rx="20" ry="6" fill="#000" opacity=".16"/>
	<g class="limb legL"><rect x="-14" y="-32" width="11" height="30" rx="5" fill="#C9D3E3"/><rect x="-16" y="-6" width="15" height="7" rx="3" fill="${a.accent}"/></g>
	<g class="limb legR"><rect x="3" y="-32" width="11" height="30" rx="5" fill="#C9D3E3"/><rect x="1" y="-6" width="15" height="7" rx="3" fill="${a.accent}"/></g>
	<g class="torso">
		<g class="limb armL"><rect x="-30" y="-72" width="10" height="32" rx="5" fill="#DDE5F0"/><circle cx="-25" cy="-40" r="6" fill="${a.accent}"/></g>
		<g class="limb armR"><rect x="20" y="-72" width="10" height="32" rx="5" fill="#DDE5F0"/><circle cx="25" cy="-40" r="6" fill="${a.accent}"/><g class="nota"><rect x="16" y="-52" width="24" height="22" rx="2" fill="#FFE27A" transform="rotate(-8 28 -41)"/></g></g>
		<rect x="-21" y="-76" width="42" height="46" rx="12" fill="#F4F7FB" stroke="#D3DCE9" stroke-width="2"/>
		<rect x="-21" y="-50" width="42" height="8" fill="${a.accent}" opacity=".9"/>
		<circle cx="0" cy="-60" r="10" fill="${a.accent}"/><g transform="translate(0,-60)">${INSIGNIAS[a.badge] || ''}</g>
		<rect x="-6" y="-83" width="12" height="9" rx="3" fill="#C9D3E3"/>
		<rect x="-24" y="-118" width="48" height="38" rx="13" fill="#F4F7FB" stroke="#D3DCE9" stroke-width="2"/>
		<rect x="-28" y="-106" width="6" height="14" rx="3" fill="${a.accent}"/><rect x="22" y="-106" width="6" height="14" rx="3" fill="${a.accent}"/>
		<rect x="-18" y="-112" width="36" height="25" rx="7" fill="#101C28"/>
		<rect class="eye" x="-12" y="-105" width="8" height="10" rx="3" fill="#7CE0FF"/><rect class="eye" x="4" y="-105" width="8" height="10" rx="3" fill="#7CE0FF"/>
		<rect x="-5" y="-92" width="10" height="2.5" rx="1.2" fill="#7CE0FF" opacity=".8"/>
		<line x1="0" y1="-118" x2="0" y2="-128" stroke="#C9D3E3" stroke-width="3"/><circle class="antena" cx="0" cy="-131" r="4.5" fill="${a.accent}"/>
		<g class="zzz" fill="#6B7A90" font-weight="800"><text class="z1" x="20" y="-124" font-size="13">z</text><text class="z2" x="30" y="-138" font-size="11">z</text><text class="z3" x="38" y="-150" font-size="9">z</text></g>
	</g>`
}

/**
 * Cabeza de un negocio: su logo recortado en círculo o, si no hay, las iniciales sobre su color.
 * Va aparte porque el director la reescribe cuando un logo no carga (logo → webp → iniciales).
 *
 * @param {{logo:string|null, ini:string, color:string, clipId:string}} a
 * @returns {string}
 */
export function cabezaCliente(a) {
  if (a.logo) {
    return html`<circle cx="0" cy="-104" r="22" fill="#fff"/><clipPath id="${a.clipId}"><circle cx="0" cy="-104" r="22"/></clipPath><image href="${esc(a.logo)}" x="-22" y="-126" width="44" height="44" preserveAspectRatio="xMidYMid slice" clip-path="url(#${a.clipId})"/>`
  }
  return html`<circle cx="0" cy="-104" r="22" fill="${a.color}"/><text y="-98" text-anchor="middle" font-size="16" font-weight="800" fill="#fff">${esc(a.ini)}</text>`
}

/**
 * Negocio cliente: cuerpo de persona con el logo del negocio como cabeza.
 *
 * @param {{shirt:string, pants:string, logo:string|null, ini:string, color:string, clipId:string}} a
 * @returns {string}
 */
export function clienteSVG(a) {
  return html`
	<ellipse cx="0" cy="2" rx="18" ry="6" fill="#000" opacity=".16"/>
	<g class="limb legL"><rect x="-13" y="-32" width="11" height="30" rx="5" fill="${a.pants}"/><rect x="-15" y="-5" width="14" height="6" rx="3" fill="#2B3A52"/></g>
	<g class="limb legR"><rect x="2" y="-32" width="11" height="30" rx="5" fill="${a.pants}"/><rect x="1" y="-5" width="14" height="6" rx="3" fill="#2B3A52"/></g>
	<g class="torso">
		<g class="limb armL"><rect x="-27" y="-72" width="9" height="30" rx="4.5" fill="${a.shirt}"/><circle cx="-22.5" cy="-42" r="5" fill="#F1C9A8"/></g>
		<g class="limb armR"><rect x="18" y="-72" width="9" height="30" rx="4.5" fill="${a.shirt}"/><circle cx="22.5" cy="-42" r="5" fill="#F1C9A8"/></g>
		<rect x="-19" y="-76" width="38" height="46" rx="11" fill="${a.shirt}"/>
		<rect x="-5" y="-82" width="10" height="8" rx="3" fill="#F1C9A8"/>
		<g class="head">
			<circle cx="0" cy="-104" r="25" fill="#fff"/>
			<g class="cabeza">${cabezaCliente(a)}</g>
			<circle class="ring" cx="0" cy="-104" r="24" fill="none" stroke-width="3"/>
		</g>
	</g>`
}

/* ---------------------------------------------------------------------------------------------
 * Globos
 * ------------------------------------------------------------------------------------------- */

/** Íconos de los globos de diálogo. */
export const ICONOS_GLOBO = {
  wa: html`<circle r="9" fill="#25D366"/><path d="M-4.5 -3 h9 a1.5 1.5 0 0 1 1.5 1.5 v4 a1.5 1.5 0 0 1 -1.5 1.5 h-4 l-3 2.4 v-2.4 h-2 a1.5 1.5 0 0 1 -1.5 -1.5 v-4 a1.5 1.5 0 0 1 1.5 -1.5z" fill="#fff"/>`,
  doc: html`<rect x="-7" y="-9" width="14" height="18" rx="2" fill="#fff" stroke="#FA7E06" stroke-width="2"/><g fill="#FA7E06"><rect x="-4" y="-4" width="8" height="2"/><rect x="-4" y="0" width="8" height="2"/><rect x="-4" y="4" width="5" height="2"/></g>`,
  star: html`<path d="M0 -9 L2.7 -3 L9 -2.4 L4.2 1.9 L5.6 8.3 L0 5 L-5.6 8.3 L-4.2 1.9 L-9 -2.4 L-2.7 -3 Z" fill="#0B84F8"/>`,
  chat: html`<path d="M-8 -6 h16 a2 2 0 0 1 2 2 v7 a2 2 0 0 1 -2 2 h-7 l-5 4 v-4 h-4 a2 2 0 0 1 -2 -2 v-7 a2 2 0 0 1 2 -2z" fill="#3A31FC"/>`,
  dots: html`<g class="tdots" fill="#2B3A52"><circle cx="-8" r="3"/><circle cx="0" r="3"/><circle cx="8" r="3"/></g>`,
  ok: html`<circle r="9" fill="#22C55E"/><path d="M-4 0 l3 3 l6 -6" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`,
  note: html`<rect x="-9" y="-9" width="18" height="18" rx="2" fill="#FFE27A"/><rect x="-5" y="-4" width="10" height="2" fill="#B98A00"/><rect x="-5" y="1" width="7" height="2" fill="#B98A00"/>`,
  img: html`<rect x="-9" y="-8" width="18" height="16" rx="3" fill="#0B84F8"/><circle cx="-3.5" cy="-3" r="2.2" fill="#fff"/><path d="M-8 6 l5 -6 l4 4 l3 -3 l5 5z" fill="#fff"/>`,
  hola: html`<circle r="9" fill="#FA7E06"/><path d="M-3.5 4 v-7 m3.5 7 v-8 m3.5 8 v-6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
  carpeta: html`<path d="M-11 -7 h7 l3 3 h12 v13 h-22z" fill="#FA7E06"/><rect x="-11" y="-3" width="22" height="12" rx="1.5" fill="#FFB24D"/>`,
}

/**
 * Etiqueta flotante con el nombre de un negocio (y su situación), la que aparece al tocarlo. La
 * punta queda en (0, 0); el fondo se ajusta al texto después de insertarla (ver el director).
 *
 * @param {string} nombre Ya escapado.
 * @param {string} detalle Ya escapado ('' si no hay).
 * @returns {string}
 */
export function etiquetaFlotante(nombre, detalle) {
  const alto = detalle ? 36 : 22
  return html`<g class="etiqueta-flotante" pointer-events="none"><rect class="fondo" x="-60" y="${-6 - alto}" width="120" height="${alto}" rx="9" fill="#101C28" opacity=".94"/><path d="M-6 -6.5 L0 0 L6 -6.5 Z" fill="#101C28" opacity=".94"/><text class="t1" y="${detalle ? -26 : -13}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">${nombre}</text>${detalle ? html`<text class="t2" y="-12" text-anchor="middle" font-size="10" font-weight="500" fill="#B9C4D6">${detalle}</text>` : ''}</g>`
}

/**
 * Globo de diálogo (el grupo animado va adentro del que lleva el translate).
 *
 * @param {string} tipo Clave de ICONOS_GLOBO.
 * @param {number} dy Altura del globo sobre los pies del personaje.
 * @returns {string}
 */
export function globo(tipo, dy) {
  return html`<g class="globo" transform="translate(0,${dy})"><g class="bubble"><path d="M-22 -18 h44 a8 8 0 0 1 8 8 v18 a8 8 0 0 1 -8 8 h-14 l-8 8 l-8 -8 h-14 a8 8 0 0 1 -8 -8 v-18 a8 8 0 0 1 8 -8z" fill="#fff" filter="url(#ell-soft)"/><g transform="translate(0,-1)">${ICONOS_GLOBO[tipo] || ''}</g></g></g>`
}
