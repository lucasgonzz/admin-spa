// Tests de aceptación CA20 y CA29 de la misión el-local-linux (piezas SVG de las oficinas).
// Se escriben ANTES que las piezas nuevas de `escena/piezas.js`: tienen que fallar hasta que existan.
import test from 'node:test'
import assert from 'node:assert/strict'
import * as piezas from '../../src/components/local/escena/piezas.js'

/** Color del origen «soporte» según el plan (§2.A, ORIGENES). */
const COLOR_SOPORTE = '#22C55E'

/** Cuenta las apariciones de un texto o regex dentro del SVG. */
function contar(svg, patron) {
  return (svg.match(patron) || []).length
}

// ---------- CA20 ----------

test('barraEtapas: 6 segmentos y el tercero con el color de revisión', () => {
  const svg = piezas.barraEtapas(0, 0, 120, 2)
  assert.equal(contar(svg, /<rect\b/g), 6)
  const colores = svg.match(/<rect\b[^>]*fill="([^"]+)"/g).map((r) => r.match(/fill="([^"]+)"/)[1])
  assert.equal(colores[2].toUpperCase(), '#8B5CF6')
})

test('insigniaOrigen: pinta el color del origen y escapa el texto', () => {
  const svg = piezas.insigniaOrigen(0, 0, 'soporte')
  assert.ok(svg.toUpperCase().includes(COLOR_SOPORTE))
  const raro = piezas.insigniaOrigen(0, 0, '<script>alert(1)</script>')
  assert.ok(!raro.includes('<script>'))
})

test('pizarra: líneas v2 muestran rótulo y etapa; las v1 siguen con s<N> · misión', () => {
  const v2 = piezas.pizarra([{ rotulo: 'El local conectado', color: '#3A31FC', etapa_texto: 'construcción' }], false, false)
  assert.ok(v2.includes('El local conectado'))
  assert.ok(v2.includes('construcción'))
  const v1 = piezas.pizarra([{ slot: 3, mision: 'arreglo', proyecto: null, fase: { texto: 'plan', color: '#0B84F8' } }], false, false)
  assert.ok(v1.includes('s3 · arreglo'))
})

test('pizarra: un título con HTML sale escapado', () => {
  const svg = piezas.pizarra([{ rotulo: '<script>alert(1)</script>', color: '#3A31FC', etapa_texto: 'plan' }], false, false)
  assert.ok(!svg.includes('<script>'))
})

test('capaMedio: el escritorio es de OPENCLAW y se puede tocar', () => {
  const svg = piezas.capaMedio()
  assert.ok(svg.includes('OPENCLAW'))
  assert.ok(svg.includes('data-ref="openclaw"'))
  assert.ok(!svg.includes('PLANIFICADOR'))
})

test('ROLES suma arquitecto, programador, operador y explorador sin sacar los viejos', () => {
  ;['arquitecto', 'programador', 'operador', 'explorador'].forEach((r) => assert.ok(piezas.ROLES[r], r))
  assert.ok(piezas.ROLES.coordinador)
})

// ---------- CA29 ----------

test('filaEspera: carpetas apiladas, tope 4 y texto «N en espera»', () => {
  const tres = piezas.filaEspera(3)
  assert.equal(contar(tres, /data-carpeta/g), 3)
  assert.ok(tres.includes('3 en espera'))
  assert.ok(tres.includes('data-ref="fila-espera"'))
  assert.equal(piezas.filaEspera(0), '')
  const nueve = piezas.filaEspera(9)
  assert.equal(contar(nueve, /data-carpeta/g), 4)
  assert.ok(nueve.includes('9 en espera'))
})

test('mesa demorada: chip «demorada» y clase mesa-demorada', () => {
  const col = { x: 100, w: 200 }
  const demorada = piezas.mesa(col, 600, 'MISIÓN', null, { demorada: true })
  assert.ok(demorada.includes('demorada'))
  assert.ok(demorada.includes('mesa-demorada'))
  const normal = piezas.mesa(col, 600, 'MISIÓN', null, {})
  assert.ok(!normal.includes('mesa-demorada'))
})

// ---------- Ronda 2 (R8): «esperando a Lucas» se distingue de «demorada» ----------

test('R8 mesa esperando a Lucas: chip «te espera», clase mesa-espera y nada del rojo de demora', () => {
  const col = { x: 100, w: 200 }
  const espera = piezas.mesa(col, 600, 'MISIÓN', null, { esperando: true })
  assert.ok(espera.includes('te espera'))
  assert.ok(espera.includes('mesa-espera'))
  assert.ok(!espera.includes('mesa-demorada'))
  assert.ok(!espera.includes('#EF4444'))
  assert.ok(!espera.includes('demorada'))
})

test('R8 pizarra: la línea de una misión esperando a Lucas dice «te espera»', () => {
  const svg = piezas.pizarra([{ rotulo: 'Cupones', color: '#FA7E06', etapa_texto: 'plan', espera: true }], false, false)
  assert.ok(svg.includes('te espera'))
  const normal = piezas.pizarra([{ rotulo: 'Cupones', color: '#3A31FC', etapa_texto: 'plan' }], false, false)
  assert.ok(!normal.includes('te espera'))
})
