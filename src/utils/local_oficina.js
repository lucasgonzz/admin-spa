/**
 * Lógica pura de las oficinas de «El local» (misión el-local-linux, 25/11/2026).
 *
 * Todo lo que la SPA necesita saber de las misiones y de OpenClaw sin tocar el DOM: catálogos
 * (etapas, orígenes, columnas del Workboard, motivos de la cola), normalización del bloque
 * `oficina` del contrato B extendido, filtros y agrupaciones, y los textos cortos que leen la
 * escena y los paneles.
 *
 * Es un módulo SIN imports ni dependencias del navegador: lo importan `escena/piezas.js` (para los
 * colores), `escena/director.js`, los dos paneles y los tests de node (`tests/local/*.test.mjs`).
 */

/**
 * Las 6 etapas que ve Lucas, en orden. El color es el de la fase equivalente de `piezas.FASES`.
 *
 * @type {Array<{id:string, texto:string, color:string}>}
 */
export const ETAPAS = [
  { id: 'plan', texto: 'plan', color: '#0B84F8' },
  { id: 'construccion', texto: 'construcción', color: '#3A31FC' },
  { id: 'revision', texto: 'revisión', color: '#8B5CF6' },
  { id: 'tests', texto: 'tests', color: '#14B8A6' },
  { id: 'merge', texto: 'merge', color: '#FA7E06' },
  { id: 'cierre', texto: 'cierre', color: '#22C55E' },
]

/** Color de una etapa que todavía no llegó (segmentos pendientes de la barra). */
export const COLOR_ETAPA_PENDIENTE = '#CBD5E1'

/** Fase fina de la skill (contrato A v2: `fase`) → texto para mostrar. */
export const TEXTO_FASE = {
  contexto: 'contexto',
  plan: 'plan',
  'tests-rojo': 'tests en rojo',
  construccion: 'construcción',
  'revision-1': 'revisión 1',
  'revision-2': 'revisión 2',
  interfaz: 'interfaz',
  'merge-base': 'merge de la base',
  'suite-final': 'suite final',
  'revision-merge': 'revisión del merge',
  'merge-local': 'merge local',
  informe: 'informe',
  entregada: 'entregada',
}

/**
 * Origen de una misión (quién la orquesta): texto, color y letra de la insignia.
 *
 * @type {Object<string, {texto:string, color:string, letra:string}>}
 */
export const ORIGENES = {
  openclaw: { texto: 'OpenClaw', color: '#F97316', letra: 'O' },
  'claude-code': { texto: 'Claude Code', color: '#D97757', letra: 'C' },
  soporte: { texto: 'Soporte', color: '#22C55E', letra: 'S' },
  codex: { texto: 'Codex', color: '#0EA5E9', letra: 'X' },
  dots: { texto: 'Dots', color: '#A855F7', letra: 'D' },
  desconocido: { texto: 'Sin origen', color: '#94A3B8', letra: '?' },
}

/** Orden en que se listan los orígenes (filtro y conteos). */
export const ORDEN_ORIGENES = ['openclaw', 'claude-code', 'soporte', 'codex', 'dots', 'desconocido']

/** Estados de una misión (contrato A v2) → texto y color para el chip. */
export const ESTADOS_MISION = {
  trabajando: { texto: 'trabajando', color: '#22C55E' },
  esperando_lucas: { texto: 'esperando a Lucas', color: '#FA7E06' },
  trabada: { texto: 'trabada', color: '#EF4444' },
  terminada: { texto: 'terminada', color: '#64748B' },
}

/** Orden de las misiones por estado (el mismo que arma el admin). */
export const ORDEN_ESTADOS = ['trabajando', 'trabada', 'esperando_lucas', 'terminada']

/**
 * Columnas del Workboard de OpenClaw, en el orden en que se muestran. `triage` y `backlog`
 * comparten la columna «Sin clasificar».
 *
 * @type {Array<{id:string, titulo:string, estados:string[]}>}
 */
export const COLUMNAS_WORKBOARD = [
  { id: 'running', titulo: 'En curso', estados: ['running'] },
  { id: 'review', titulo: 'Para revisar', estados: ['review'] },
  { id: 'blocked', titulo: 'Trabadas', estados: ['blocked'] },
  { id: 'scheduled', titulo: 'Programadas', estados: ['scheduled'] },
  { id: 'ready', titulo: 'Listas', estados: ['ready'] },
  { id: 'todo', titulo: 'Por hacer', estados: ['todo'] },
  { id: 'triage', titulo: 'Sin clasificar', estados: ['triage', 'backlog'] },
  { id: 'done', titulo: 'Hechas', estados: ['done'] },
]

/** Prioridad de una tarjeta → texto y color del punto. */
export const PRIORIDADES = {
  urgent: { texto: 'urgente', color: '#EF4444' },
  high: { texto: 'alta', color: '#F97316' },
  normal: { texto: 'normal', color: '#64748B' },
  low: { texto: 'baja', color: '#94A3B8' },
}

/** Motivo por el que la cola retuvo una misión → texto en castellano. */
export const TEXTO_MOTIVO_COLA = {
  memoria: 'poca memoria',
  swap: 'swap lleno',
  cpu: 'procesador ocupado',
  cupo: 'cupo de misiones lleno',
  pesados: 'tests/builds ocupados',
}

/** Estado de la salud del gateway de OpenClaw → texto y color. */
export const ESTADOS_GATEWAY = {
  ok: { texto: 'en línea', color: '#22C55E' },
  degradado: { texto: 'con problemas', color: '#F59E0B' },
  caido: { texto: 'apagado', color: '#EF4444' },
  desconocido: { texto: 'sin datos', color: '#94A3B8' },
}

/** Resultado de la última corrida de una tarea programada → texto y color. */
export const RESULTADOS_TAREA = {
  ok: { texto: 'bien', color: '#22C55E' },
  error: { texto: 'con error', color: '#EF4444' },
  omitida: { texto: 'omitida', color: '#94A3B8' },
  otro: { texto: 'sin resultado claro', color: '#94A3B8' },
}

/**
 * ¿Es un objeto plano (ni null ni array)?
 *
 * @param {*} valor
 * @returns {boolean}
 */
function es_objeto(valor) {
  return !!valor && typeof valor === 'object' && !Array.isArray(valor)
}

/**
 * Normaliza el bloque `oficina` del contrato B. Sin datos o con la forma v1 queda en modo
 * `slots` (la escena de siempre); con la v2 conserva lo que llegó y completa lo que falte.
 *
 * @param {Object|null|undefined} oficina Bloque `escena.oficina`.
 * @returns {{reporter:Object, planificador:Object, slots:Array, modo:string, misiones:Array,
 *   por_origen:Object, slots_en_uso:(number|null), openclaw:(Object|null), cola:(Object|null),
 *   umbrales_demora:Object}}
 */
export function completar_oficina(oficina) {
  const base = es_objeto(oficina) ? oficina : {}
  const openclaw = es_objeto(base.openclaw) ? base.openclaw : null
  return {
    reporter: es_objeto(base.reporter) ? base.reporter : { ok: false, last_seen_at: null, version: null },
    planificador: es_objeto(base.planificador) ? base.planificador : { estado: 'libre' },
    slots: Array.isArray(base.slots) ? base.slots.filter(Boolean) : [],
    modo: base.modo === 'misiones' ? 'misiones' : 'slots',
    misiones: Array.isArray(base.misiones) ? base.misiones.filter(Boolean) : [],
    por_origen: es_objeto(base.por_origen) ? base.por_origen : {},
    slots_en_uso: typeof base.slots_en_uso === 'number' ? base.slots_en_uso : null,
    openclaw: openclaw
      ? {
          reportado_at: openclaw.reportado_at || null,
          gateway: es_objeto(openclaw.gateway) ? openclaw.gateway : { estado: 'desconocido', version: null, verificado_at: null },
          workboard: completar_workboard(openclaw.workboard),
          tareas: completar_tareas(openclaw.tareas),
        }
      : null,
    cola: es_objeto(base.cola) ? completar_cola(base.cola) : null,
    umbrales_demora: es_objeto(base.umbrales_demora) ? base.umbrales_demora : {},
  }
}

/**
 * Completa el bloque `openclaw.workboard` con defaults (sin tarjetas, sin conteo).
 *
 * @param {Object|undefined} workboard
 * @returns {{ok:boolean, total:number, conteo:Object, recortado:boolean, tarjetas:Array}}
 */
function completar_workboard(workboard) {
  const w = es_objeto(workboard) ? workboard : {}
  return {
    ok: w.ok !== false && es_objeto(workboard),
    total: typeof w.total === 'number' ? w.total : 0,
    conteo: es_objeto(w.conteo) ? w.conteo : {},
    recortado: w.recortado === true,
    tarjetas: Array.isArray(w.tarjetas) ? w.tarjetas.filter(Boolean) : [],
  }
}

/**
 * Completa el bloque `openclaw.tareas` con defaults (sin tareas).
 *
 * @param {Object|undefined} tareas
 * @returns {{ok:boolean, items:Array}}
 */
function completar_tareas(tareas) {
  const t = es_objeto(tareas) ? tareas : {}
  return {
    ok: t.ok !== false && es_objeto(tareas),
    items: Array.isArray(t.items) ? t.items.filter(Boolean) : [],
  }
}

/**
 * Completa el bloque `oficina.cola` (misiones en espera y último chequeo de recursos).
 *
 * @param {Object} cola
 * @returns {Object}
 */
function completar_cola(cola) {
  return Object.assign({}, cola, {
    ok: cola.ok !== false,
    sin_senal: cola.sin_senal === true,
    en_espera: Array.isArray(cola.en_espera) ? cola.en_espera.filter(Boolean) : [],
    fallidas: typeof cola.fallidas === 'number' ? cola.fallidas : 0,
    ultimo_chequeo: es_objeto(cola.ultimo_chequeo) ? cola.ultimo_chequeo : null,
    chequeos: Array.isArray(cola.chequeos) ? cola.chequeos.filter(Boolean) : [],
  })
}

/**
 * Deja sólo las misiones de un origen (`'todas'` o vacío las deja todas).
 *
 * @param {Array<Object>} misiones
 * @param {string} origen Clave de `ORIGENES` o `'todas'`.
 * @returns {Array<Object>}
 */
export function filtrar_misiones(misiones, origen) {
  const lista = Array.isArray(misiones) ? misiones : []
  if (!origen || origen === 'todas') {
    return lista
  }
  return lista.filter(function (m) {
    return m && m.origen === origen
  })
}

/**
 * Cuenta las misiones NO terminadas por origen. Los seis orígenes están siempre, con 0 si no hay.
 *
 * @param {Array<Object>} misiones
 * @returns {Object<string, number>}
 */
export function contar_por_origen(misiones) {
  const cuenta = {}
  ORDEN_ORIGENES.forEach(function (o) {
    cuenta[o] = 0
  })
  ;(Array.isArray(misiones) ? misiones : []).forEach(function (m) {
    if (!m || m.estado === 'terminada') {
      return
    }
    const origen = ORIGENES[m.origen] ? m.origen : 'desconocido'
    cuenta[origen] += 1
  })
  return cuenta
}

/**
 * Posición de una etapa entre las 6 (0 a 5), o -1 si no hay etapa o no se conoce.
 *
 * @param {string|null|undefined} etapa
 * @returns {number}
 */
export function indice_etapa(etapa) {
  let indice = -1
  ETAPAS.forEach(function (e, i) {
    if (e.id === etapa) {
      indice = i
    }
  })
  return indice
}

/**
 * Reparte las tarjetas del Workboard en las columnas de `COLUMNAS_WORKBOARD`, en ese orden. Una
 * tarjeta con un estado desconocido no se muestra.
 *
 * @param {Array<Object>} tarjetas
 * @returns {Array<{id:string, titulo:string, tarjetas:Array<Object>}>}
 */
export function agrupar_tarjetas(tarjetas) {
  const lista = Array.isArray(tarjetas) ? tarjetas : []
  return COLUMNAS_WORKBOARD.map(function (c) {
    return {
      id: c.id,
      titulo: c.titulo,
      tarjetas: lista.filter(function (t) {
        return t && c.estados.indexOf(t.estado) !== -1
      }),
    }
  })
}

/**
 * Descripción corta de una tarea programada: si usa modelo (y qué agente) o es un comando, y si
 * antes de llamar al modelo evalúa una condición.
 *
 * @param {{tipo:string, agente?:string, condicion?:boolean}} tarea
 * @returns {string}
 */
export function describir_tarea(tarea) {
  const t = tarea || {}
  let texto = 'tipo sin clasificar'
  if (t.tipo === 'modelo') {
    texto = 'con modelo' + (t.agente ? ' · ' + t.agente : '')
  } else if (t.tipo === 'comando') {
    texto = 'sin modelo (comando)'
  }
  if (t.condicion === true) {
    texto += ' · con condición'
  }
  return texto
}

/**
 * Recorta un texto a `n` letras, con «…» si hubo corte.
 *
 * @param {string} texto
 * @param {number} n
 * @returns {string}
 */
export function recortar(texto, n) {
  const s = String(texto === null || texto === undefined ? '' : texto)
  return s.length > n ? s.slice(0, Math.max(0, n - 1)) + '…' : s
}

/**
 * Duración legible a partir de minutos: «45 min», «1 h 5 min», «1 d 1 h».
 *
 * @param {number} minutos
 * @returns {string}
 */
export function texto_duracion(minutos) {
  const total = Math.max(0, Math.round(Number(minutos) || 0))
  if (total < 60) {
    return total + ' min'
  }
  if (total < 1440) {
    const h = Math.floor(total / 60)
    const m = total % 60
    return h + ' h' + (m ? ' ' + m + ' min' : '')
  }
  const d = Math.floor(total / 1440)
  const h = Math.floor((total % 1440) / 60)
  return d + ' d' + (h ? ' ' + h + ' h' : '')
}

/**
 * Duración legible a partir de segundos (para la línea de tiempo de fases).
 *
 * @param {number|null} segundos
 * @returns {string} Vacío si no hay dato (fase en curso).
 */
export function texto_segundos(segundos) {
  if (segundos === null || segundos === undefined || isNaN(Number(segundos))) {
    return ''
  }
  return texto_duracion(Math.round(Number(segundos) / 60))
}

/**
 * «hace N min» a partir de una fecha ISO.
 *
 * @param {string|null} iso
 * @param {number} [ahora] Milisegundos de «ahora» (para los tests).
 * @returns {string} Vacío si la fecha no se entiende.
 */
export function texto_hace(iso, ahora) {
  const t = iso ? new Date(iso).getTime() : NaN
  if (isNaN(t)) {
    return ''
  }
  const minutos = Math.max(0, Math.floor(((ahora === undefined ? Date.now() : ahora) - t) / 60000))
  return minutos < 1 ? 'recién' : 'hace ' + texto_duracion(minutos)
}

/**
 * Nivel de los recursos de la PC según el último chequeo de la cola.
 *   - `critico`: la RAM disponible bajó del umbral o la carga por núcleo lo pasó.
 *   - `justo`: a menos de 2 GiB del umbral de RAM o al 80 % del de carga.
 *   - `ok`: el resto. Sin datos de umbral usa 6 GiB y 0,8 por núcleo.
 *
 * @param {Object|null} chequeo `cola.ultimo_chequeo`.
 * @returns {('ok'|'justo'|'critico')}
 */
export function nivel_recursos(chequeo) {
  const c = chequeo || {}
  const umbral_ram = typeof c.umbral_ram_gib === 'number' ? c.umbral_ram_gib : 6
  const umbral_carga = typeof c.umbral_carga_por_nucleo === 'number' ? c.umbral_carga_por_nucleo : 0.8
  const nucleos = typeof c.nproc === 'number' && c.nproc > 0 ? c.nproc : 1
  const carga = typeof c.load1 === 'number' ? c.load1 / nucleos : 0
  const ram = typeof c.ram_disponible_gib === 'number' ? c.ram_disponible_gib : null
  if ((ram !== null && ram < umbral_ram) || carga > umbral_carga) {
    return 'critico'
  }
  if ((ram !== null && ram < umbral_ram + 2) || carga > umbral_carga * 0.8) {
    return 'justo'
  }
  return 'ok'
}

/**
 * Número con coma decimal (estilo argentino) y un decimal como mucho.
 *
 * @param {number} valor
 * @returns {string}
 */
export function numero_es(valor) {
  const redondeado = Math.round(Number(valor) * 10) / 10
  return String(redondeado).replace('.', ',')
}

/**
 * Texto del chip de recursos: «RAM 12,5 GB · carga 0,2». Vacío si no hay chequeo.
 *
 * @param {Object|null} chequeo
 * @returns {string}
 */
export function texto_recursos(chequeo) {
  if (!chequeo || typeof chequeo.ram_disponible_gib !== 'number') {
    return ''
  }
  let texto = 'RAM ' + numero_es(chequeo.ram_disponible_gib) + ' GB'
  if (typeof chequeo.load1 === 'number') {
    texto += ' · carga ' + numero_es(chequeo.load1)
  }
  return texto
}

/**
 * Texto de los motivos de una retención de la cola: «poca memoria, swap lleno».
 *
 * @param {Array<string>} motivos
 * @returns {string}
 */
export function texto_motivos(motivos) {
  return (Array.isArray(motivos) ? motivos : [])
    .map(function (m) {
      return TEXTO_MOTIVO_COLA[m] || String(m)
    })
    .join(', ')
}

/**
 * Texto «lleva 2 h 10 min en tests» de una misión (vacío si no hay dato o ya terminó).
 *
 * @param {Object} mision
 * @returns {string}
 */
export function texto_en_etapa(mision) {
  const m = mision || {}
  if (m.estado === 'terminada' || typeof m.minutos_en_etapa !== 'number') {
    return ''
  }
  const etapa = ETAPAS[indice_etapa(m.etapa)]
  return 'lleva ' + texto_duracion(m.minutos_en_etapa) + (etapa ? ' en ' + etapa.texto : '')
}
