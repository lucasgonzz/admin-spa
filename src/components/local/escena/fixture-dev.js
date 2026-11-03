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
 * eventos de login/logout; contadores de slots en null sin reporter), en un ciclo de cuatro pasos
 * pensado para ver todas las diferencias que anima el director:
 *   0 → base: 11 abiertos (dos con Soporte, uno con el Asistente), 18 cerrados (el banco se llena
 *       y sobra un «+2»), 3 sin horario, tres mesas (construcción, plan, colgado sin nadie) y una
 *       misión pendiente en la bandeja.
 *   1 → la puerta en uso: entra un negocio nuevo, uno se levanta del banco y otro de la espera de
 *       la entrada (los dos pasan por la puerta), uno va a Soporte (fila de tres) y otro a Facturas
 *       (escáner prendido). Caso nuevo para Lucas (Soporte lo lleva). La misión pendiente sale de
 *       la bandeja y aparece s15: vuela la carpeta.
 *   2 → cinco mesas (aparece s12 huérfano, sin vuelo y sin nadie sentado), la PC de Lucas deja de
 *       reportar (contadores de slots en null), uno cierra y va al banco, otro va al WhatsApp del
 *       negocio, uno se va por la puerta (baja), una tarea nueva (solo sube el contador), logout
 *       (sin globo).
 *   3 → Soporte apagado (dormido), Facturas trabajando, todo lo demás vuelve hacia la base.
 *
 * Los nombres son de clientes reales (los mismos del índice de logos) solo para ejercitar el
 * respaldo de logos por slug; los números son inventados.
 */

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

/** Los 35 slots: los libres en null/[] y los que se pasan, con datos. */
function slots(conMision) {
  const lista = []
  let i = 1
  for (i = 1; i <= 35; i = i + 1) {
    const s = conMision[i]
    const proyecto = i % 3 === 1 ? 'empresa' : i % 3 === 2 ? 'admin' : 'tienda'
    lista.push(
      Object.assign(
        {
          slot: i,
          proyecto: proyecto,
          estado: 'libre',
          rama: null,
          mision: null,
          fase: null,
          claim_iniciado_at: null,
          ultima_actividad_at: null,
          sucios: 0,
          agentes: [],
          reportado_at: iso(0.3),
        },
        s || {}
      )
    )
  }
  return lista
}

/** Agente de una mesa. */
function ag(rol, runtime, estado, nombre) {
  return { rol: rol, runtime: runtime, estado: estado, desde_at: iso(4), nombre: nombre || null }
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

  const conMision = {
    2: {
      proyecto: 'empresa',
      estado: 'trabajando',
      rama: 'recargos-cc',
      mision: 'recargos-cc',
      fase: p >= 2 ? 'revision' : 'construccion',
      claim_iniciado_at: iso(95),
      ultima_actividad_at: iso(1),
      sucios: 4,
      agentes:
        p >= 2
          ? [ag('orquestador', 'claude', 'busy'), ag('constructor', 'claude', 'activo', 'empresa-spa'), ag('revisor', 'claude', 'activo')]
          : [ag('orquestador', 'claude', 'busy'), ag('constructor', 'codex', 'activo', 'empresa-api'), ag('constructor', 'claude', 'activo', 'empresa-spa')],
    },
    6: { proyecto: 'admin', estado: 'trabajando', rama: 'agenda-repetir', mision: 'agenda-repetir', fase: 'plan', claim_iniciado_at: iso(20), ultima_actividad_at: iso(2), agentes: [ag('orquestador', 'claude', 'busy')] },
    // colgado y sin nadie: mesa con su chip, sin orquestador sentado
    9: { proyecto: 'tienda', estado: 'colgado', rama: 'tienda-cupones', mision: 'tienda-cupones', fase: 'tests', claim_iniciado_at: iso(900), ultima_actividad_at: iso(800), agentes: [] },
  }
  if (p === 1 || p === 2) {
    conMision[15] = {
      proyecto: 'admin',
      estado: 'trabajando',
      rama: p === 1 ? null : 'el-local',
      mision: 'el-local',
      fase: p === 1 ? 'tomado' : 'plan',
      claim_iniciado_at: iso(1),
      ultima_actividad_at: iso(0.5),
      agentes: [ag('orquestador', 'claude', 'busy'), ag('planificador', 'claude', 'activo')],
    }
  }
  if (p === 2) {
    // huérfano (rama de trabajo sin claim) y sin agentes: aparece sin vuelo y sin nadie sentado
    conMision[12] = { proyecto: 'tienda', estado: 'huerfano', rama: 'arreglo-cupon', mision: 'arreglo-cupon', fase: null, claim_iniciado_at: null, ultima_actividad_at: iso(300), agentes: [] }
  }
  const listaSlots = slots(conMision)
  const trabajando = listaSlots.filter(function (s) {
    return s.estado === 'trabajando'
  }).length
  const libres = listaSlots.filter(function (s) {
    return s.estado === 'libre'
  }).length
  // sin reporter (paso 2) la API manda los contadores de slots en null
  const reporterOk = p !== 2

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
      misiones_en_curso: reporterOk ? trabajando : null,
      slots_libres: reporterOk ? libres : null,
      slots_total: reporterOk ? listaSlots.length : null,
    },
    negocios: negocios,
    agentes: agentes,
    bandeja: bandeja,
    oficina: {
      reporter: { ok: reporterOk, last_seen_at: reporterOk ? iso(0.4) : iso(9), version: '1.0.0' },
      planificador: { estado: p === 1 || p === 2 ? 'trabajando' : 'libre' },
      slots: listaSlots,
    },
    eventos: eventos,
  }
}
