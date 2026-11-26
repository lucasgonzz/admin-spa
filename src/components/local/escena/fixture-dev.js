/**
 * Fixture SOLO DE DESARROLLO de «El local» (misión el-local, 3/11/2026).
 *
 * Lo carga `components/local/Index.vue` únicamente con `import.meta.env.DEV` y `?mock=1` en la
 * URL (`npm run dev` → http://localhost:8195/local?mock=1). En el build de producción la rama que
 * lo importa desaparece y este archivo no se empaqueta.
 *
 * Devuelve estados con la forma EXACTA del contrato B del plan (`GET /api/admin/local/escena`),
 * alineada con lo que manda la API (rutas `/soporte/ticket/<id>`, `/leads/<id>/conversacion` y
 * `/tareas`; ids de bandeja `soporte-caso-<n>` / `soporte-mision-<n>`; `agente: null` en los
 * eventos de login/logout), y desde el 25/11/2026 con la oficina en la forma v2 (modo `misiones`:
 * misiones con origen, etapa y tiempo en la etapa, Workboard y tareas de OpenClaw, cola de espera y
 * recursos; sin slots), en un ciclo de cuatro pasos
 * pensado para ver todas las diferencias que anima el director:
 *   0 → base: 11 abiertos (dos con Soporte, uno con el Asistente), 18 cerrados (el banco se llena
 *       y sobra un «+2»), 3 sin horario, seis misiones de los cinco orígenes (una demorada, una
 *       trabada, una esperando a Lucas), OpenClaw en línea, cola vacía y una misión pendiente en
 *       la bandeja.
 *   1 → la puerta en uso: entra un negocio nuevo, uno se levanta del banco y otro de la espera de
 *       la entrada (los dos pasan por la puerta), uno va a Soporte (fila de tres) y otro a Facturas
 *       (escáner prendido). Caso nuevo para Lucas (Soporte lo lleva). La misión pendiente sale de
 *       la bandeja y aparece una misión nueva (siete en total: sobran «+2 mesas»); dos en espera
 *       en la cola.
 *   2 → la PC de Lucas deja de reportar (misiones sin señal, gateway sin datos), la misión de Claude
 *       Code pasa a revisión, uno cierra y va al banco, otro va al WhatsApp del negocio, uno se va
 *       por la puerta (baja), una tarea nueva (solo sube el contador), logout (sin globo).
 *   3 → Soporte apagado (dormido), Facturas trabajando, OpenClaw caído (planificador apagado), RAM
 *       crítica, todo lo demás vuelve hacia la base.
 *
 * Los nombres son de clientes reales (los mismos del índice de logos) solo para ejercitar el
 * respaldo de logos por slug; los números son inventados.
 */

import { contar_por_origen } from '../../../utils/local_oficina.js'

/**
 * Fecha ISO-8601 con zona de Argentina (-03:00), `minutos` atrás.
 *
 * @param {number} minutos
 * @returns {string}
 */
function iso(minutos) {
  const d = new Date(Date.now() - minutos * 60000 - 3 * 3600000)
  return d.toISOString().replace(/\.\d{3}Z$/, '-03:00')
}

/** Negocios de base: [id, nombre, slug, estado]. */
const BASE = [
  [12, 'Ferre Total', 'ferretotal', 'abierto'],
  [19, 'Masquito', 'masquito', 'abierto'],
  [23, 'Doblep', 'doblep', 'abierto'],
  [31, 'Mayorista de Pesca', 'pesca', 'abierto'],
  [33, 'Candyguay', 'candyguay', 'abierto'],
  [7, 'Golonorte', 'golonorte', 'abierto'],
  [8, 'Fenix Mayorista', 'fenix', 'abierto'],
  [41, 'Truvari', 'truvari', 'abierto'],
  [9, 'Chevrocar', 'chevrocar', 'abierto'],
  [44, 'Kiosco Verde', 'kiosco-verde', 'abierto'],
  [45, 'Punto Diet', 'punto-diet', 'abierto'],
  [14, 'Innovate', 'innovate', 'cerrado'],
  [52, 'Plazoleta', 'plazoleta', 'cerrado'],
  [16, 'Servian', 'servian', 'cerrado'],
  [17, 'Hiper-Max', 'hipermax', 'cerrado'],
  [18, 'Trama Ferretería', 'trama', 'cerrado'],
  [21, 'Grupo Limp', 'grupolimp', 'cerrado'],
  [22, 'Unicas', 'unicas', 'cerrado'],
  [24, 'Distribuidora Tiju', 'tiju', 'cerrado'],
  [25, 'Grupo Quino2', 'quino2', 'cerrado'],
  [26, 'Pack Descartables', 'pack-descartables', 'cerrado'],
  [27, 'Secure Point', 'securepoint', 'cerrado'],
  [28, 'La Cava de Don Juan', 'la-cava-de-don-juan', 'cerrado'],
  [29, 'Renacer Joyas', 'renacer-joyas', 'cerrado'],
  [30, 'Ferremas', 'ferremas', 'cerrado'],
  [32, 'MZA Group', 'mza-group', 'cerrado'],
  [34, 'Golden Breeze', 'golden-breeze', 'cerrado'],
  [35, 'Arfren Autopartes', 'arfren', 'cerrado'],
  [36, 'Racing Parts', 'racing-carts', 'cerrado'],
  [47, 'Leudinox', 'leudinox', 'sin_horario'],
  [48, 'Electro Lacarra', 'electro-lacarra', 'sin_horario'],
  [51, 'Distribuidora Pets', 'distribuidora-pets', 'sin_horario'],
]

/**
 * Negocio con todos los campos del contrato.
 *
 * @returns {Object}
 */
function negocio(fila, extra) {
  const n = {
    id: fila[0],
    nombre: fila[1],
    slug: fila[2],
    logo_url: null,
    estado: fila[3],
    activo_reciente: fila[3] === 'abierto' && fila[0] % 3 === 0,
    ultima_actividad_at: fila[3] === 'abierto' ? iso(fila[0] % 25) : null,
    estacion: null,
    estacion_desde_at: null,
    estacion_detalle: null,
  }
  return Object.assign(n, extra || {})
}

/** Un agente del mostrador con todos los campos. */
function agente(id, estado, extra) {
  return Object.assign({ id: id, estado: estado, atendiendo: [], pendientes: 0, ultimo_evento_at: null, detalle: null }, extra || {})
}

/** Agente de una misión (contrato A v2: rol, runtime, estado activo/idle). */
function ag(rol, runtime, estado) {
  return { rol: rol, runtime: runtime, estado: estado, desde_at: iso(4) }
}

/** Umbrales de demora por etapa, en minutos (los mismos de `config/el_local.php` del admin). */
const UMBRALES_DEMORA = { plan: 120, construccion: 240, revision: 120, tests: 120, merge: 60, cierre: 120 }

/**
 * Una misión de las oficinas con todos los campos del contrato B extendido.
 *
 * @param {Object} o `id`, `titulo`, `origen`, `estado`, `etapa`, `fase`, `minutos` (en la etapa
 *   actual), `previas` (fases anteriores: `[fase, etapa, minutos]`), `repos`, `sucios`, `agentes`.
 * @returns {Object}
 */
function mision(o) {
  const minutos = o.minutos
  // historial: las fases previas hacia atrás desde el inicio de la actual, y la actual abierta
  const fases = []
  let hasta = minutos
  ;(o.previas || []).slice().reverse().forEach(function (f) {
    const desde = hasta + f[2]
    fases.unshift({ fase: f[0], etapa: f[1], desde: iso(desde), hasta: iso(hasta), segundos: f[2] * 60, inferida: !!o.inferida })
    hasta = desde
  })
  fases.push({ fase: o.fase, etapa: o.etapa, desde: iso(minutos), hasta: null, segundos: null, inferida: !!o.inferida })
  const worktrees = (o.repos || []).map(function (repo, i) {
    return { repo: repo, carpeta: repo + '-' + o.id.replace(/^[a-z]+:/, ''), rama: o.id.replace(/^[a-z]+:/, ''), sucios: i === 0 ? o.sucios || 0 : 0, ultima_actividad_at: iso(o.actividad === undefined ? 1 : o.actividad) }
  })
  return {
    id: o.id,
    titulo: o.titulo,
    origen: o.origen,
    estado: o.estado,
    etapa: o.etapa,
    fase: o.fase,
    fase_inferida: !!o.inferida,
    slug: o.id.replace(/^[a-z]+:/, ''),
    tarjeta_id: o.tarjeta_id || null,
    ticket: o.ticket || null,
    repos: o.repos || [],
    worktrees: worktrees,
    agentes: o.agentes || [],
    desde_at: iso(minutos + 120),
    ultima_actividad_at: iso(o.actividad === undefined ? 1 : o.actividad),
    fase_desde: iso(minutos),
    fase_historial: fases,
    etapa_desde: iso(minutos),
    minutos_en_etapa: minutos,
    umbral_min: UMBRALES_DEMORA[o.etapa],
    // igual que el servidor: sólo una misión `trabajando` puede estar demorada (esperando a Lucas o
    // trabada se ven con su propio estado, aunque hayan pasado el umbral de la etapa)
    demorada: o.estado === 'trabajando' && minutos > UMBRALES_DEMORA[o.etapa],
    fases: fases,
    ruta: o.ticket ? '/soporte/ticket/' + o.ticket : null,
    sin_senal: !!o.sin_senal,
  }
}

/** Tarjeta del Workboard de OpenClaw con todos los campos del contrato. */
function tarjeta(id, titulo, estado, prioridad, etiquetas, agenteId, minutos, extra) {
  return Object.assign(
    { id: id, titulo: titulo, estado: estado, prioridad: prioridad, etiquetas: etiquetas, agente: agenteId, actualizada_at: iso(minutos), vence_at: null, mision_id: null },
    extra || {}
  )
}

/** Tarea programada de OpenClaw con todos los campos del contrato. */
function tarea(id, nombre, frecuencia, tipo, agenteId, condicion, resultado, extra) {
  return Object.assign(
    {
      id: id,
      nombre: nombre,
      habilitada: true,
      tipo: tipo,
      agente: tipo === 'modelo' ? agenteId : null,
      condicion: condicion,
      frecuencia: frecuencia,
      expresion: null,
      ultimo_resultado: resultado,
      ultima_corrida_at: resultado ? iso(7) : null,
      ultima_condicion_at: condicion ? iso(2) : null,
      proxima_corrida_at: iso(-12),
      errores_seguidos: resultado === 'error' ? 2 : 0,
    },
    extra || {}
  )
}

/** Evento con todos los campos. */
function evento(id, tipo, agenteId, clientId, minutos, detalle) {
  return { id: id, tipo: tipo, agente: agenteId, client_id: clientId, ocurrido_at: iso(minutos), detalle: detalle }
}

/**
 * Estado del paso `paso` (cíclico, de a cuatro).
 *
 * @param {number} paso
 * @returns {Object} JSON con la forma del contrato B.
 */
export function estado_de_prueba(paso) {
  const p = ((paso % 4) + 4) % 4
  const extras = {}
  const quitar = {}
  const nuevos = []

  // estaciones y cambios de estado de cada paso
  extras[12] = { logo_url: '/logo-que-no-existe.png', estacion: 'soporte', estacion_desde_at: iso(6), estacion_detalle: 'ticket #45', activo_reciente: true }
  extras[23] = { estacion: 'soporte', estacion_desde_at: iso(3), estacion_detalle: 'ticket #51', activo_reciente: true }
  extras[19] = { estacion: 'asistente', estacion_desde_at: iso(2), estacion_detalle: null, activo_reciente: true }
  if (p === 1) {
    extras[31] = { estacion: 'soporte', estacion_desde_at: iso(0.5), estacion_detalle: 'ticket #77', activo_reciente: true }
    extras[8] = { estacion: 'facturas', estacion_desde_at: iso(0.3), estacion_detalle: 'factura de compra', activo_reciente: true }
    // del banco y de la espera de la entrada al local: los dos pasan por la puerta
    extras[35] = { estado: 'abierto', activo_reciente: true, ultima_actividad_at: iso(0.2) }
    extras[47] = { activo_reciente: true, ultima_actividad_at: iso(0.2) }
    nuevos.push(negocio([60, 'Golden Bike', 'golden-bike', 'abierto'], { activo_reciente: true, ultima_actividad_at: iso(0.1) }))
  }
  if (p === 2) {
    extras[19] = { estacion: null, activo_reciente: true }
    extras[33] = { estacion: 'asistente', estacion_desde_at: iso(0.4), activo_reciente: true }
    extras[23] = { estado: 'cerrado', activo_reciente: false, estacion: null }
    extras[31] = { estacion: 'soporte', estacion_desde_at: iso(1.5), estacion_detalle: 'ticket #77', activo_reciente: true }
    extras[9] = { estacion: 'negocio', estacion_desde_at: iso(0.3), estacion_detalle: null, activo_reciente: true }
    extras[35] = { estado: 'abierto', activo_reciente: true }
    extras[47] = { activo_reciente: true }
    nuevos.push(negocio([60, 'Golden Bike', 'golden-bike', 'abierto'], { activo_reciente: true }))
    quitar[44] = true
  }
  if (p === 3) {
    extras[23] = { estado: 'cerrado', activo_reciente: false, estacion: null }
    extras[8] = { estacion: 'asistente', estacion_desde_at: iso(0.2), activo_reciente: true }
    extras[7] = { estacion: 'facturas', estacion_desde_at: iso(0.4), estacion_detalle: 'factura de compra', activo_reciente: true }
    quitar[44] = true
  }

  const negocios = BASE.filter(function (f) {
    return !quitar[f[0]]
  })
    .map(function (f) {
      return negocio(f, extras[f[0]])
    })
    .concat(nuevos)
    .sort(function (a, b) {
      return a.nombre.localeCompare(b.nombre)
    })

  const abiertos = negocios.filter(function (n) {
    return n.estado === 'abierto'
  }).length
  const cerrados = negocios.filter(function (n) {
    return n.estado === 'cerrado'
  }).length
  const sinHorario = negocios.filter(function (n) {
    return n.estado === 'sin_horario'
  }).length
  const enSoporte = negocios.filter(function (n) {
    return n.estacion === 'soporte'
  })

  const agentes = [
    agente('soporte', p === 3 ? 'apagado' : 'trabajando', {
      atendiendo: enSoporte.map(function (n) {
        return n.id
      }),
      pendientes: enSoporte.length,
      ultimo_evento_at: iso(1),
      detalle: p === 3 ? null : 'Martín atendiendo ' + enSoporte.length + ' tickets',
    }),
    agente('facturas', p === 1 || p === 3 ? 'trabajando' : 'sin_senal', p === 1 ? { atendiendo: [8], ultimo_evento_at: iso(0.3) } : p === 3 ? { atendiendo: [7], ultimo_evento_at: iso(0.4) } : {}),
    agente('negocio', p === 2 ? 'trabajando' : 'sin_senal', p === 2 ? { atendiendo: [9], ultimo_evento_at: iso(0.3) } : {}),
    agente('asistente', 'trabajando', { atendiendo: [p === 2 ? 33 : 19], pendientes: 1, detalle: p === 1 ? 'generando una imagen' : null, ultimo_evento_at: iso(2) }),
    agente('informes', 'libre'),
    agente('comercial', p === 2 ? 'libre' : 'trabajando', { pendientes: 3, ultimo_evento_at: iso(4) }),
  ]

  const bandeja = []
  if (p >= 1) {
    bandeja.push({ id: 'soporte-caso-77', tipo: 'caso_delegado', titulo: 'Ticket #77 · Mayorista de Pesca: el agente no responde', client_id: 31, creado_at: iso(0.5), ruta: '/soporte/ticket/77' })
  }
  if (p === 2) {
    bandeja.push({ id: 'tarea-12', tipo: 'tarea', titulo: 'Revisar el informe de la tanda de actualización', client_id: null, creado_at: iso(0.4), ruta: '/tareas' })
  }
  bandeja.push({ id: 'soporte-caso-45', tipo: 'caso_delegado', titulo: 'Ticket #45 · Ferre Total: recargos consolidados', client_id: 12, creado_at: iso(42), ruta: '/soporte/ticket/45' })
  // la misión pendiente: sale de la bandeja en el paso 1 (Lucas la inicia y aparece s15)
  if (p === 0 || p === 3) {
    bandeja.push({ id: 'soporte-mision-9', tipo: 'mision_pendiente', titulo: 'Misión · Masquito: medidas masivas sin datos en 31 artículos', client_id: 19, creado_at: iso(130), ruta: '/soporte/ticket/52' })
  }
  if (p !== 3) {
    bandeja.push({ id: 'lead-mensaje-311', tipo: 'aprobacion', titulo: 'Mensaje a lead Distribuidora Sur', client_id: null, creado_at: iso(15), ruta: '/leads/88/conversacion' })
  }

  // sin reporter (paso 2) las misiones llegan marcadas «sin señal» y OpenClaw sin datos
  const reporterOk = p !== 2
  const ss = !reporterOk

  // misiones de las oficinas: una por origen, las seis etapas en el ciclo, una demorada, una
  // trabada y una esperando a Lucas
  const todas = [
    mision({
      id: 'cc:el-local-linux', titulo: 'El local conectado a OpenClaw', origen: 'claude-code', estado: 'trabajando', sin_senal: ss,
      etapa: p >= 2 ? 'revision' : 'construccion', fase: p >= 2 ? 'revision-1' : 'construccion', minutos: p >= 2 ? 12 : 95 + p,
      previas: p >= 2 ? [['plan', 'plan', 40], ['construccion', 'construccion', 130]] : [['plan', 'plan', 40]],
      repos: ['admin-api', 'admin-spa'], sucios: 4, tarjeta_id: 'c3a1d5e0-1', actividad: 0.5,
      agentes: p >= 2
        ? [ag('coordinador', 'claude', 'activo'), ag('revisor', 'claude', 'activo')]
        : [ag('coordinador', 'claude', 'activo'), ag('programador', 'claude', 'activo'), ag('programador', 'codex', 'activo')],
    }),
    mision({
      id: 'oc:9fc7c3e2', titulo: 'Recargos consolidados en empresa', origen: 'openclaw', estado: 'trabajando', sin_senal: ss, inferida: true,
      etapa: p === 3 ? 'merge' : 'tests', fase: p === 3 ? 'merge-local' : 'suite-final', minutos: p === 3 ? 8 : 35 + p,
      previas: p === 3 ? [['plan', 'plan', 30], ['construccion', 'construccion', 90], ['suite-final', 'tests', 45]] : [['plan', 'plan', 30], ['construccion', 'construccion', 90]],
      repos: ['empresa-api', 'empresa-spa'], sucios: 0, tarjeta_id: '9fc7c3e2', actividad: 2,
      agentes: [ag('coordinador', 'openclaw', 'activo'), ag('revisor', 'openclaw', 'idle')],
    }),
    mision({
      id: 'cc:martin-ticket-177', titulo: 'Ticket #177: el agente no responde', origen: 'soporte', estado: 'trabajando', sin_senal: ss,
      etapa: 'tests', fase: 'suite-final', minutos: 250 + p, ticket: 177,
      previas: [['plan', 'plan', 40], ['construccion', 'construccion', 120], ['revision-1', 'revision', 55]],
      repos: ['empresa-api'], sucios: 1, actividad: 6,
      agentes: [ag('coordinador', 'claude', 'activo'), ag('operador', 'claude', 'idle')],
    }),
    mision({
      id: 'codex:0198a4', titulo: 'Mejora de listados de Compras', origen: 'codex', estado: 'esperando_lucas', sin_senal: ss,
      etapa: 'plan', fase: 'plan', minutos: 200 + p, previas: [['contexto', 'plan', 15]],
      repos: ['empresa-spa'], sucios: 0, actividad: 20,
      agentes: [ag('coordinador', 'codex', 'idle'), ag('arquitecto', 'codex', 'idle')],
    }),
    mision({
      id: 'wt:tienda-cupones', titulo: 'Cupones en la tienda', origen: 'openclaw', estado: 'trabada', sin_senal: ss, inferida: true,
      etapa: 'construccion', fase: 'construccion', minutos: 900, previas: [['plan', 'plan', 50]],
      repos: ['tienda-api', 'tienda-spa'], sucios: 7, actividad: 800, agentes: [],
    }),
    mision({
      id: 'dots:7aa1e2', titulo: 'Informe de ventas por voz', origen: 'dots', estado: p >= 2 ? 'terminada' : 'trabajando', sin_senal: ss,
      etapa: p >= 2 ? 'cierre' : 'merge', fase: p >= 2 ? 'entregada' : 'revision-merge', minutos: p >= 2 ? 25 : 18,
      previas: p >= 2 ? [['plan', 'plan', 20], ['merge-local', 'merge', 18]] : [['plan', 'plan', 20], ['construccion', 'construccion', 60]],
      repos: ['admin-api'], sucios: 0, actividad: p >= 2 ? 25 : 3, agentes: p >= 2 ? [] : [ag('coordinador', 'claude', 'activo')],
    }),
  ]
  if (p >= 1) {
    todas.push(
      mision({
        id: 'oc:aa11bb22', titulo: 'Actualizar demo3 y Ferretotal', origen: 'openclaw', estado: 'trabajando', sin_senal: ss,
        etapa: 'plan', fase: 'plan', minutos: 5, repos: ['admin-api'], sucios: 0, actividad: 0.3,
        agentes: [ag('coordinador', 'openclaw', 'activo'), ag('arquitecto', 'openclaw', 'activo')],
      })
    )
  }
  if (p === 0 || p === 1 || p === 2) {
    todas.push(
      mision({
        id: 'cc:agenda-repetir', titulo: 'Agenda: repetir tareas', origen: 'claude-code', estado: 'terminada', sin_senal: ss,
        etapa: 'cierre', fase: 'entregada', minutos: 30, previas: [['merge-local', 'merge', 12]],
        repos: ['admin-spa'], sucios: 0, actividad: 30, agentes: [],
      })
    )
  }
  // la trabada se resuelve en el último paso
  const misiones = todas
    .filter(function (m) {
      return !(p === 3 && m.id === 'wt:tienda-cupones')
    })
    .sort(function (a, b) {
      const orden = ['trabajando', 'trabada', 'esperando_lucas', 'terminada']
      return orden.indexOf(a.estado) - orden.indexOf(b.estado)
    })
  const en_curso = misiones.filter(function (m) {
    return m.estado !== 'terminada'
  })
  const carpetas = {}
  en_curso.forEach(function (m) {
    m.worktrees.forEach(function (w) {
      carpetas[w.carpeta] = true
    })
  })
  const slots_en_uso = Object.keys(carpetas).length

  // Workboard: una columna por estado (las 8 representadas en cada paso)
  const tarjetas = [
    tarjeta('wb-01', 'Recargos consolidados en empresa', 'running', 'high', ['mision', 'empresa'], 'main', 3, { mision_id: 'oc:9fc7c3e2' }),
    tarjeta('wb-02', 'Revisar los tickets abiertos de la mañana', 'running', 'normal', ['soporte'], 'main', 11),
    tarjeta('wb-03', 'Misión del Ticket #177', 'review', 'urgent', ['mision', 'claude-code', 'soporte'], 'main', 25, { mision_id: 'cc:martin-ticket-177' }),
    tarjeta('wb-04', 'Cupones en la tienda', 'blocked', 'normal', ['mision', 'tienda'], 'main', 800, { mision_id: 'wt:tienda-cupones' }),
    tarjeta('wb-05', 'Actualizar demo3, SanBlas y Ferretotal', 'scheduled', 'normal', ['actualizacion', 'demo3'], 'operador', 60, { vence_at: iso(-420) }),
    tarjeta('wb-06', 'Preparar el release de empresa', 'ready', 'high', ['release', 'empresa'], 'operador', 90),
    tarjeta('wb-07', 'Pasar las fotos de Plazoleta', 'todo', 'low', ['plazoleta'], null, 600),
    tarjeta('wb-08', 'Idea: avisos por WhatsApp de cumpleaños', 'triage', 'normal', ['idea'], null, 1500),
    tarjeta('wb-09', 'Ordenar el material de marca', 'backlog', 'low', ['marca'], null, 4000),
    tarjeta('wb-10', 'Agenda: repetir tareas', 'done', 'normal', ['mision', 'claude-code', 'admin'], 'main', 45, { mision_id: 'cc:agenda-repetir' }),
    tarjeta('wb-11', 'Informe semanal de Soporte', 'done', 'normal', ['informe'], 'comercial', 300),
  ]

  // tareas programadas: con y sin modelo, una con condición, una con error, una apagada
  const tareas = [
    tarea('cr-01', 'WhatsApp personal', 'cada 5 min, de 8 a 21 h', 'modelo', 'main', true, 'ok'),
    tarea('cr-02', 'Revisión de tickets', 'todos los días a las 9:00 y 19:00', 'modelo', 'main', false, 'ok'),
    tarea('cr-03', 'Respaldo de la base de conocimiento', 'cada 15 min', 'comando', null, false, 'ok'),
    tarea('cr-04', 'Análisis diario de agentes', 'todos los días a las 3:00', 'modelo', 'operador', false, 'error'),
    tarea('cr-05', 'Chequeo de leads', 'los domingos a las 21:37', 'modelo', 'comercial', true, null, { habilitada: false }),
  ]

  // cola de misiones por recursos y su último chequeo (la RAM baja con los pasos)
  const ram = [12.5, 12.5, 7.2, 4.8][p]
  const en_espera = [
    { slug: 'cupones-vencidos', titulo: 'Cupones vencidos en la tienda', prioridad: 'high', origen: 'openclaw', encolada_at: iso(35), espera_min: 35, motivos: ['memoria', 'pesados'], intentos: 4, primera_retencion_at: iso(33) },
    { slug: 'importar-precios', titulo: 'Importador de precios de proveedores', prioridad: 'normal', origen: 'claude-code', encolada_at: iso(12), espera_min: 12, motivos: ['cupo'], intentos: 1, primera_retencion_at: iso(11) },
  ].slice(0, p === 0 ? 0 : p === 3 ? 1 : 2)
  const cola = {
    reportado_at: iso(0.4),
    sin_senal: ss,
    ok: true,
    en_espera: en_espera,
    fallidas: p === 3 ? 1 : 0,
    ultimo_chequeo: {
      at: iso(0.5), ram_disponible_gib: ram, ram_total_gib: 29.99, swap_libre_gib: p === 3 ? 0.01 : 6.5, swap_total_gib: 8, load1: p === 3 ? 22 : 0.2, load5: 0.3,
      nproc: 24, activas_total: en_curso.length, activas_sin_pantalla: 1, largo_cola: en_espera.length, pesados_ocupados: p === 3 ? 2 : 1, pesados_cupos: 2,
      lanzadas: p === 1 ? ['actualizar-demo3'] : [], retenidas: en_espera.length, umbral_ram_gib: 6, umbral_carga_por_nucleo: 0.8,
    },
    chequeos: [0, 1, 2, 3].map(function (k) {
      return { at: iso(0.5 + k), ram_disponible_gib: ram, swap_libre_gib: 6.5, load1: 0.2, activas_total: en_curso.length, largo_cola: en_espera.length }
    }),
  }

  const eventos = [evento('sm-9101', 'ticket_mensaje', 'soporte', 12, 6, 'ticket #45'), evento('cam-551', 'asistente_mensaje', 'asistente', 19, 2, null)]
  if (p === 1) {
    eventos.push(evento('sm-9123', 'ticket_mensaje', 'soporte', 31, 0.6, 'ticket #77'))
    eventos.push(evento('esc-77', 'delegado', 'soporte', 31, 0.5, 'ticket #77'))
    eventos.push(evento('img-88', 'imagen_pedido', 'asistente', 19, 0.4, null))
    eventos.push(evento('lm-4410', 'lead_mensaje', 'comercial', null, 0.3, null))
    eventos.push(evento('act-301', 'actividad', 'facturas', 8, 0.2, 'escaneo'))
    eventos.push(evento('act-302', 'actividad', null, 35, 0.15, 'login'))
  }
  if (p === 2) {
    eventos.push(evento('sm-9130', 'ticket_respuesta', 'soporte', 12, 0.5, 'ticket #45'))
    eventos.push(evento('cam-560', 'asistente_mensaje', 'asistente', 33, 0.3, null))
    eventos.push(evento('act-310', 'actividad', null, 23, 0.25, 'logout'))
    eventos.push(evento('act-311', 'actividad', 'negocio', 9, 0.2, 'agente_negocio'))
    eventos.push(evento('cam-561', 'asistente_respuesta', 'asistente', 19, 0.1, null))
  }
  if (p === 3) {
    eventos.push(evento('act-320', 'actividad', 'facturas', 7, 0.4, 'escaneo'))
    eventos.push(evento('lm-4420', 'lead_respuesta', 'comercial', null, 0.2, null))
    eventos.push(evento('act-321', 'actividad', null, 33, 0.1, 'login'))
  }

  return {
    calculado_en: iso(0),
    resumen: {
      negocios_abiertos: abiertos,
      negocios_cerrados: cerrados,
      negocios_sin_horario: sinHorario,
      tickets_abiertos: enSoporte.length,
      para_lucas: bandeja.length,
      misiones_en_curso: en_curso.length,
      slots_libres: null,
      slots_total: slots_en_uso,
    },
    negocios: negocios,
    agentes: agentes,
    bandeja: bandeja,
    oficina: {
      reporter: { ok: reporterOk, last_seen_at: reporterOk ? iso(0.4) : iso(9), version: '2.0.0' },
      planificador: { estado: p === 3 ? 'apagado' : p === 2 ? 'libre' : 'trabajando' },
      slots: [],
      modo: 'misiones',
      misiones: misiones,
      por_origen: contar_por_origen(misiones),
      // el paso 1 simula el reporte recortado por tamaño (3 misiones no entran); el resto, completo
      misiones_recorte: p === 1 ? { recortado: true, omitidas: 3 } : { recortado: false, omitidas: 0 },
      slots_en_uso: slots_en_uso,
      openclaw: {
        reportado_at: iso(reporterOk ? 0.4 : 9),
        gateway: { estado: p === 3 ? 'caido' : p === 2 ? 'desconocido' : 'ok', version: '2026.11.5', verificado_at: iso(reporterOk ? 0.4 : 9) },
        workboard: { ok: true, total: 117, conteo: { running: 45, review: 15, blocked: 16, scheduled: 1, ready: 3, todo: 8, triage: 6, backlog: 3, done: 40 }, recortado: false, tarjetas: tarjetas },
        tareas: { ok: true, items: tareas },
      },
      cola: cola,
      umbrales_demora: UMBRALES_DEMORA,
    },
    eventos: eventos,
  }
}
