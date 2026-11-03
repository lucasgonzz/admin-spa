/**
 * Fixture SOLO DE DESARROLLO de «El local» (misión el-local, 3/11/2026).
 *
 * Lo carga `components/local/Index.vue` únicamente con `import.meta.env.DEV` y `?mock=1` en la
 * URL (`npm run dev` → http://localhost:8195/local?mock=1). En el build de producción la rama que
 * lo importa desaparece y este archivo no se empaqueta.
 *
 * Devuelve estados con la forma EXACTA del contrato B del plan (`GET /api/admin/local/escena`),
 * en un ciclo de cuatro pasos pensado para ver todas las diferencias que anima el director:
 *   0 → base: 11 abiertos (dos con Soporte, uno con el Asistente), 18 cerrados (el banco se llena
 *       y sobra un «+2»), 3 sin horario, tres mesas (construcción, plan, colgado).
 *   1 → entra un negocio nuevo, otro se levanta del banco, un tercero va a Soporte (fila de tres),
 *       una nota nueva para Lucas (Soporte la lleva), misión nueva en s15 (vuela la carpeta),
 *       eventos de todo tipo.
 *   2 → uno se va por la puerta (baja), otro cierra y va al banco, cambian estaciones, cambia una
 *       fase, se va un constructor y entra un revisor, la PC de Lucas deja de reportar.
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
    extras[35] = { estado: 'abierto', activo_reciente: true, ultima_actividad_at: iso(0.2) }
    nuevos.push(negocio([60, 'Golden Bike', 'golden-bike', 'abierto'], { activo_reciente: true, ultima_actividad_at: iso(0.1) }))
  }
  if (p === 2) {
    extras[19] = { estacion: null, activo_reciente: true }
    extras[33] = { estacion: 'asistente', estacion_desde_at: iso(0.4), activo_reciente: true }
    extras[23] = { estado: 'cerrado', activo_reciente: false, estacion: null }
    extras[31] = { estacion: 'soporte', estacion_desde_at: iso(1.5), estacion_detalle: 'ticket #77', activo_reciente: true }
    extras[35] = { estado: 'abierto', activo_reciente: true }
    nuevos.push(negocio([60, 'Golden Bike', 'golden-bike', 'abierto'], { activo_reciente: true }))
    quitar[44] = true
  }
  if (p === 3) {
    extras[23] = { estado: 'cerrado', activo_reciente: false, estacion: null }
    extras[8] = { estacion: 'asistente', estacion_desde_at: iso(0.2), activo_reciente: true }
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
    agente('facturas', p === 3 ? 'trabajando' : 'sin_senal', p === 3 ? { atendiendo: [8], ultimo_evento_at: iso(0.5) } : {}),
    agente('negocio', 'sin_senal'),
    agente('asistente', 'trabajando', { atendiendo: [p === 2 ? 33 : 19], pendientes: 1, detalle: p === 1 ? 'generando una imagen' : null, ultimo_evento_at: iso(2) }),
    agente('informes', 'libre'),
    agente('comercial', p === 2 ? 'libre' : 'trabajando', { pendientes: 3, ultimo_evento_at: iso(4) }),
  ]

  const bandeja = [
    { id: 'soporte-caso-45', tipo: 'caso_delegado', titulo: 'Ticket #45 · Ferre Total: recargos consolidados', client_id: 12, creado_at: iso(42), ruta: '/soporte/ticket/0b9c7a52-0000-4000-8000-000000000045' },
    { id: 'mision-pendiente-9', tipo: 'mision_pendiente', titulo: 'Misión · Masquito: medidas masivas sin datos en 31 artículos', client_id: 19, creado_at: iso(130), ruta: null },
    { id: 'lead-msg-311', tipo: 'aprobacion', titulo: 'Mensaje a lead Distribuidora Sur', client_id: null, creado_at: iso(15), ruta: null },
  ]
  if (p >= 1) {
    bandeja.unshift({ id: 'soporte-caso-77', tipo: 'caso_delegado', titulo: 'Ticket #77 · Mayorista de Pesca: el agente no responde', client_id: 31, creado_at: iso(0.5), ruta: '/soporte/ticket/0b9c7a52-0000-4000-8000-000000000077' })
  }
  if (p === 3) {
    bandeja.splice(2, 1)
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
  const listaSlots = slots(conMision)
  const trabajando = listaSlots.filter(function (s) {
    return s.estado === 'trabajando'
  }).length
  const libres = listaSlots.filter(function (s) {
    return s.estado === 'libre'
  }).length

  const eventos = [
    { id: 'sm-9101', tipo: 'ticket_mensaje', agente: 'soporte', client_id: 12, ocurrido_at: iso(6), detalle: 'ticket #45' },
    { id: 'cam-551', tipo: 'asistente_mensaje', agente: 'asistente', client_id: 19, ocurrido_at: iso(2), detalle: null },
  ]
  if (p === 1) {
    eventos.push({ id: 'sm-9123', tipo: 'ticket_mensaje', agente: 'soporte', client_id: 31, ocurrido_at: iso(0.6), detalle: 'ticket #77' })
    eventos.push({ id: 'esc-77', tipo: 'delegado', agente: 'soporte', client_id: 31, ocurrido_at: iso(0.5), detalle: 'ticket #77' })
    eventos.push({ id: 'img-88', tipo: 'imagen_pedido', agente: 'asistente', client_id: 19, ocurrido_at: iso(0.4), detalle: null })
    eventos.push({ id: 'lm-4410', tipo: 'lead_mensaje', agente: 'comercial', client_id: null, ocurrido_at: iso(0.3), detalle: null })
    eventos.push({ id: 'act-301', tipo: 'actividad', agente: 'facturas', client_id: 8, ocurrido_at: iso(0.2), detalle: 'escaneo' })
  }
  if (p === 2) {
    eventos.push({ id: 'sm-9130', tipo: 'ticket_respuesta', agente: 'soporte', client_id: 12, ocurrido_at: iso(0.5), detalle: 'ticket #45' })
    eventos.push({ id: 'cam-560', tipo: 'asistente_mensaje', agente: 'asistente', client_id: 33, ocurrido_at: iso(0.3), detalle: null })
    eventos.push({ id: 'cam-561', tipo: 'asistente_respuesta', agente: 'asistente', client_id: 19, ocurrido_at: iso(0.2), detalle: null })
  }
  if (p === 3) {
    eventos.push({ id: 'act-302', tipo: 'actividad', agente: 'facturas', client_id: 8, ocurrido_at: iso(0.4), detalle: 'escaneo' })
    eventos.push({ id: 'lm-4420', tipo: 'lead_respuesta', agente: 'comercial', client_id: null, ocurrido_at: iso(0.2), detalle: null })
    eventos.push({ id: 'act-303', tipo: 'actividad', agente: 'negocio', client_id: 33, ocurrido_at: iso(0.1), detalle: 'login' })
  }

  return {
    calculado_en: iso(0),
    resumen: {
      negocios_abiertos: abiertos,
      negocios_cerrados: cerrados,
      negocios_sin_horario: sinHorario,
      tickets_abiertos: enSoporte.length,
      para_lucas: bandeja.length,
      misiones_en_curso: trabajando,
      slots_libres: libres,
      slots_total: listaSlots.length,
    },
    negocios: negocios,
    agentes: agentes,
    bandeja: bandeja,
    oficina: {
      reporter: { ok: p !== 2, last_seen_at: p === 2 ? iso(9) : iso(0.4), version: '1.0.0' },
      planificador: { estado: p === 1 || p === 2 ? 'trabajando' : 'libre' },
      slots: listaSlots,
    },
    eventos: eventos,
  }
}
