// Tests de aceptación CA19, CA21 y CA28 de la misión el-local-linux (lógica pura de las oficinas).
// Se escriben ANTES que `src/utils/local_oficina.js`: tienen que fallar hasta que exista.
import test from 'node:test'
import assert from 'node:assert/strict'
import * as oficina from '../../src/utils/local_oficina.js'
import { estado_de_prueba } from '../../src/components/local/escena/fixture-dev.js'

const { completar_oficina, filtrar_misiones, contar_por_origen, indice_etapa, agrupar_tarjetas, describir_tarea } = oficina

/** Misión mínima para los tests: sólo lo que leen las funciones puras. */
function mision(id, origen, estado, extra) {
  return Object.assign({ id, titulo: 'Misión ' + id, origen, estado, etapa: 'plan' }, extra || {})
}

/** Pasos del fixture (0..3) ya normalizados por `completar_oficina`. */
function pasos_del_fixture() {
  return [0, 1, 2, 3].map((p) => ({ paso: p, estado: estado_de_prueba(p), oficina: completar_oficina(estado_de_prueba(p).oficina) }))
}

// ---------- CA19: lógica pura ----------

test('completar_oficina: sin datos y forma v1 caen en modo slots', () => {
  const vacia = completar_oficina(undefined)
  assert.equal(vacia.modo, 'slots')
  assert.deepEqual(vacia.misiones, [])
  assert.equal(vacia.openclaw, null)

  const v1 = completar_oficina({ reporter: { ok: true }, planificador: { estado: 'libre' }, slots: [] })
  assert.equal(v1.modo, 'slots')
  assert.deepEqual(v1.misiones, [])
  assert.equal(v1.openclaw, null)
  assert.deepEqual(v1.slots, [])
})

test('completar_oficina: la forma v2 pasa con sus valores', () => {
  const v2 = completar_oficina({
    modo: 'misiones', misiones: [mision('cc:a', 'soporte', 'trabajando')],
    por_origen: { soporte: 1 }, slots_en_uso: 3, openclaw: { gateway: { estado: 'ok' } },
  })
  assert.equal(v2.modo, 'misiones')
  assert.equal(v2.misiones.length, 1)
  assert.equal(v2.slots_en_uso, 3)
  assert.equal(v2.openclaw.gateway.estado, 'ok')
})

test('filtrar_misiones: por origen y «todas»', () => {
  const lista = [mision('1', 'soporte', 'trabajando'), mision('2', 'openclaw', 'trabajando'), mision('3', 'soporte', 'terminada')]
  assert.deepEqual(filtrar_misiones(lista, 'soporte').map((m) => m.id), ['1', '3'])
  assert.equal(filtrar_misiones(lista, 'todas').length, 3)
})

test('contar_por_origen: cuenta sólo las no terminadas', () => {
  const lista = [mision('1', 'soporte', 'trabajando'), mision('2', 'soporte', 'terminada'), mision('3', 'codex', 'trabada'), mision('4', 'claude-code', 'esperando_lucas')]
  const cuenta = contar_por_origen(lista)
  assert.equal(cuenta.soporte, 1)
  assert.equal(cuenta.codex, 1)
  assert.equal(cuenta['claude-code'], 1)
  assert.equal(cuenta.openclaw || 0, 0)
})

test('indice_etapa: posición en las 6 etapas y -1 sin etapa', () => {
  assert.equal(indice_etapa('plan'), 0)
  assert.equal(indice_etapa('tests'), 3)
  assert.equal(indice_etapa('cierre'), 5)
  assert.equal(indice_etapa(null), -1)
  assert.equal(oficina.ETAPAS.length, 6)
})

test('agrupar_tarjetas: columnas en el orden del Workboard, con triage y backlog juntas', () => {
  const tarjetas = [
    { id: 'a', titulo: 'a', estado: 'done' }, { id: 'b', titulo: 'b', estado: 'running' },
    { id: 'c', titulo: 'c', estado: 'triage' }, { id: 'd', titulo: 'd', estado: 'backlog' },
    { id: 'e', titulo: 'e', estado: 'review' },
  ]
  const columnas = agrupar_tarjetas(tarjetas)
  assert.equal(columnas.length, oficina.COLUMNAS_WORKBOARD.length)
  assert.deepEqual(columnas.map((c) => c.titulo), ['En curso', 'Para revisar', 'Trabadas', 'Programadas', 'Listas', 'Por hacer', 'Sin clasificar', 'Hechas'])
  const sin_clasificar = columnas.find((c) => c.titulo === 'Sin clasificar')
  assert.deepEqual(sin_clasificar.tarjetas.map((t) => t.id).sort(), ['c', 'd'])
  assert.equal(columnas[0].tarjetas.length, 1)
})

test('describir_tarea: con modelo, sin modelo y con condición', () => {
  assert.equal(describir_tarea({ tipo: 'modelo', agente: 'main', condicion: false }), 'con modelo · main')
  assert.equal(describir_tarea({ tipo: 'comando', condicion: false }), 'sin modelo (comando)')
  assert.match(describir_tarea({ tipo: 'modelo', agente: 'main', condicion: true }), /con condición/)
})

// ---------- CA28: duraciones, motivos y recursos ----------

test('texto_duracion: minutos, horas y días', () => {
  assert.equal(oficina.texto_duracion(45), '45 min')
  assert.equal(oficina.texto_duracion(65), '1 h 5 min')
  assert.equal(oficina.texto_duracion(1500), '1 d 1 h')
})

test('TEXTO_MOTIVO_COLA: traduce los 5 motivos', () => {
  assert.deepEqual(
    ['memoria', 'swap', 'cpu', 'cupo', 'pesados'].map((m) => oficina.TEXTO_MOTIVO_COLA[m]),
    ['poca memoria', 'swap lleno', 'procesador ocupado', 'cupo de misiones lleno', 'tests/builds ocupados'],
  )
})

test('nivel_recursos: ok, justo y crítico', () => {
  const base = { ram_disponible_gib: 12.5, load1: 0.2, nproc: 24, umbral_ram_gib: 6, umbral_carga_por_nucleo: 0.8 }
  assert.equal(oficina.nivel_recursos(base), 'ok')
  assert.equal(oficina.nivel_recursos(Object.assign({}, base, { ram_disponible_gib: 7 })), 'justo')
  assert.equal(oficina.nivel_recursos(Object.assign({}, base, { ram_disponible_gib: 4 })), 'critico')
  assert.equal(oficina.nivel_recursos(Object.assign({}, base, { load1: 20 })), 'critico')
})

test('completar_oficina: sin cola ni umbrales_demora trae los defaults', () => {
  const o = completar_oficina({ modo: 'misiones', misiones: [] })
  assert.equal(o.cola, null)
  assert.deepEqual(o.umbrales_demora, {})
})

test('ORIGENES incluye dots y los 6 orígenes del contrato', () => {
  assert.ok(oficina.ORIGENES.dots)
  ;['openclaw', 'claude-code', 'soporte', 'codex', 'dots', 'desconocido'].forEach((o) => assert.ok(oficina.ORIGENES[o], o))
  assert.equal(oficina.ORIGENES.openclaw.color, '#F97316')
})

// ---------- CA21: fixture v2 completo ----------

test('fixture v2 completo', () => {
  const pasos = pasos_del_fixture()
  pasos.forEach((p) => assert.equal(p.oficina.modo, 'misiones', 'paso ' + p.paso))

  const misiones = [].concat(...pasos.map((p) => p.oficina.misiones))
  ;['openclaw', 'claude-code', 'soporte', 'codex', 'dots'].forEach((o) => assert.ok(misiones.some((m) => m.origen === o), 'origen ' + o))
  ;['plan', 'construccion', 'revision', 'tests', 'merge', 'cierre'].forEach((e) => assert.ok(misiones.some((m) => m.etapa === e), 'etapa ' + e))
  assert.ok(misiones.some((m) => m.estado === 'trabada'))
  assert.ok(misiones.some((m) => m.estado === 'esperando_lucas'))

  // tarjetas en las 8 columnas del Workboard
  const tarjetas = [].concat(...pasos.map((p) => (p.oficina.openclaw ? p.oficina.openclaw.workboard.tarjetas : [])))
  const columnas = agrupar_tarjetas(tarjetas)
  assert.equal(columnas.length, 8)
  columnas.forEach((c) => assert.ok(c.tarjetas.length > 0, 'columna vacía: ' + c.titulo))

  // tareas programadas con y sin modelo, y una con condición
  const tareas = [].concat(...pasos.map((p) => (p.oficina.openclaw ? p.oficina.openclaw.tareas.items : [])))
  assert.ok(tareas.some((t) => t.tipo === 'modelo'))
  assert.ok(tareas.some((t) => t.tipo === 'comando'))
  assert.ok(tareas.some((t) => t.condicion === true))

  assert.equal(pasos[3].oficina.openclaw.gateway.estado, 'caido')
})

test('fixture v2 completo: cola, chequeo y misión demorada con fases', () => {
  const pasos = pasos_del_fixture()
  assert.ok(pasos.some((p) => p.oficina.cola && p.oficina.cola.en_espera.length === 2), 'dos misiones en espera en algún paso')
  assert.ok(pasos.some((p) => p.oficina.cola && p.oficina.cola.ultimo_chequeo), 'último chequeo')
  const demoradas = [].concat(...pasos.map((p) => p.oficina.misiones)).filter((m) => m.demorada)
  assert.ok(demoradas.length > 0, 'al menos una misión demorada')
  assert.ok(demoradas.some((m) => new Set((m.fases || []).map((f) => f.etapa)).size > 1), 'fases de más de una etapa')
})

// ---------- Ronda 2 (R8 de .mision/REVISION-1.md): recorte visible y «esperando a Lucas» ----------

test('R8 completar_oficina: misiones_recorte ausente o null se tolera (admin viejo)', () => {
  assert.deepEqual(completar_oficina(undefined).misiones_recorte, { recortado: false, omitidas: 0 })
  assert.deepEqual(completar_oficina({ modo: 'misiones', misiones: [] }).misiones_recorte, { recortado: false, omitidas: 0 })
  assert.deepEqual(completar_oficina({ misiones_recorte: null }).misiones_recorte, { recortado: false, omitidas: 0 })
})

test('R8 completar_oficina: misiones_recorte pasa con sus valores', () => {
  const o = completar_oficina({ misiones_recorte: { recortado: true, omitidas: 4 } })
  assert.deepEqual(o.misiones_recorte, { recortado: true, omitidas: 4 })
})

test('R8 texto_recorte: «N misiones no entran» sólo si hay recorte', () => {
  assert.equal(typeof oficina.texto_recorte, 'function')
  assert.equal(oficina.texto_recorte({ recortado: false, omitidas: 0 }), '')
  assert.equal(oficina.texto_recorte(null), '')
  assert.equal(oficina.texto_recorte({ recortado: true, omitidas: 3 }), '3 misiones no entran')
  assert.equal(oficina.texto_recorte({ recortado: true, omitidas: 1 }), '1 misión no entra')
})

test('R8 fixture: un paso con recorte y una misión esperando a Lucas que NO es demorada', () => {
  const pasos = pasos_del_fixture()
  assert.ok(pasos.some((p) => p.oficina.misiones_recorte.recortado && p.oficina.misiones_recorte.omitidas > 0), 'algún paso recortado')
  assert.ok(pasos.some((p) => !p.oficina.misiones_recorte.recortado), 'algún paso sin recorte')
  const todas = [].concat(...pasos.map((p) => p.oficina.misiones))
  assert.ok(todas.some((m) => m.estado === 'esperando_lucas'), 'hay una esperando_lucas')
  assert.ok(todas.filter((m) => m.estado !== 'trabajando').every((m) => !m.demorada), 'sólo las trabajando pueden ser demoradas')
  assert.ok(todas.filter((m) => m.estado === 'esperando_lucas').some((m) => m.minutos_en_etapa > m.umbral_min), 'una esperando_lucas pasó el umbral y aun así no es demorada')
})
