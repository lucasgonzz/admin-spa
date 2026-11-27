// Test de aceptación CA23 de la misión dotin-misiones-admin: el seguimiento de misiones que publica la Gamer en el Admin
// (estado real, vigencia, último avance, qué falta y la pregunta con sus opciones) en el panel de misiones de «El local».
// Se escribe ANTES de la implementación: falla hasta que existan `describir_seguimiento`, `puede_responder`,
// `cuerpo_de_respuesta` y `PreguntaDeMision.vue`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import * as oficina from '../../src/utils/local_oficina.js'

/** Raíz de los componentes de la vista. */
const RAIZ_COMPONENTES = new URL('../../src/components/local/', import.meta.url)

/** Seguimiento mínimo como lo arma el admin (`MissionTrackingService::serializar`); `extra` pisa lo que haga falta. */
function seguimiento(estado, extra) {
  return Object.assign(
    {
      fuente: 'admin', estado: estado, estado_visible: estado, vigencia: 'al_dia', minutos_sin_reporte: 2, minutos_sin_actividad: 3,
      ultimo_avance: null, pendiente: null, motivo: null, proximo_paso: null, pregunta: null,
    },
    extra || {},
  )
}

/** Pregunta como la arma el admin dentro de `seguimiento.pregunta`. */
function pregunta(extra) {
  return Object.assign(
    {
      question_uid: '8c1f0b7e-2d4a-4b8e-9d57-3a1e6f0c9a11', revision: 2, tipo: 'ordinaria', estado: 'abierta', pregunta: '¿Seguimos?',
      opciones: [
        { clave: 'A', texto: 'Sí, seguí', impacto: 'La misión sigue sola' },
        { clave: 'B', texto: 'No, frená', impacto: 'La misión queda detenida' },
      ],
      recomendada: 'A', puede_responder: true, respuesta: null,
    },
    extra || {},
  )
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// ---------- Los siete estados ----------

test('ESTADOS_SEGUIMIENTO: los siete estados con su texto y su color', () => {
  assert.equal(typeof oficina.ESTADOS_SEGUIMIENTO, 'object', 'falta ESTADOS_SEGUIMIENTO')
  const esperados = {
    en_cola: ['en cola', '#64748B'],
    activa: ['activa', '#22C55E'],
    activa_sin_senal: ['activa sin señal', '#F59E0B'],
    pausada_tecnica: ['pausada por un problema técnico', '#F59E0B'],
    esperando_decision: ['esperando tu decisión', '#FA7E06'],
    terminada: ['terminada', '#64748B'],
    detenida: ['detenida', '#EF4444'],
  }
  assert.deepEqual(Object.keys(oficina.ESTADOS_SEGUIMIENTO).sort(), Object.keys(esperados).sort())
  Object.keys(esperados).forEach((id) => {
    assert.equal(oficina.ESTADOS_SEGUIMIENTO[id].texto, esperados[id][0], id)
    assert.equal(oficina.ESTADOS_SEGUIMIENTO[id].color, esperados[id][1], id)
  })
})

test('describir_seguimiento: cada estado visible da su texto y su color', () => {
  assert.equal(typeof oficina.describir_seguimiento, 'function', 'falta describir_seguimiento')
  const esperados = {
    en_cola: ['en cola', '#64748B'],
    activa: ['activa', '#22C55E'],
    activa_sin_senal: ['activa sin señal', '#F59E0B'],
    pausada_tecnica: ['pausada por un problema técnico', '#F59E0B'],
    esperando_decision: ['esperando tu decisión', '#FA7E06'],
    terminada: ['terminada', '#64748B'],
    detenida: ['detenida', '#EF4444'],
  }
  Object.keys(esperados).forEach((estado) => {
    const d = oficina.describir_seguimiento(seguimiento(estado))
    assert.equal(d.texto, esperados[estado][0], estado)
    assert.equal(d.color, esperados[estado][1], estado)
  })
})

test('describir_seguimiento: manda el estado visible; sin él usa el estado', () => {
  const sin_senal = oficina.describir_seguimiento(seguimiento('activa', { estado_visible: 'activa_sin_senal' }))
  assert.equal(sin_senal.texto, 'activa sin señal')

  const sin_visible = seguimiento('detenida')
  delete sin_visible.estado_visible
  assert.equal(oficina.describir_seguimiento(sin_visible).texto, 'detenida')
})

test('describir_seguimiento: sin seguimiento (o algo que no es un objeto) da null', () => {
  assert.equal(oficina.describir_seguimiento(null), null)
  assert.equal(oficina.describir_seguimiento(undefined), null)
  assert.equal(oficina.describir_seguimiento('activa'), null)
  assert.equal(oficina.describir_seguimiento([]), null)
})

// ---------- Vigencia ----------

test('describir_seguimiento: la vigencia al día no dice nada; la desactualizada y la sin señal dicen cuánto', () => {
  assert.equal(oficina.describir_seguimiento(seguimiento('activa', { vigencia: 'al_dia' })).vigencia_texto, null)

  const vieja = oficina.describir_seguimiento(seguimiento('activa', { vigencia: 'desactualizada', minutos_sin_reporte: 16 }))
  assert.equal(vieja.vigencia_texto, 'desactualizada: la PC no reporta hace 16 min')

  const muda = oficina.describir_seguimiento(seguimiento('activa', { vigencia: 'sin_senal', minutos_sin_reporte: 125 }))
  assert.equal(muda.vigencia_texto, 'sin señal de la PC hace 2 h 5 min')
})

// ---------- Qué avanzó y qué falta ----------

test('describir_seguimiento: trae el último avance, lo que falta, el motivo y el próximo paso', () => {
  const d = oficina.describir_seguimiento(
    seguimiento('detenida', { ultimo_avance: 'Terminó la unidad 2', pendiente: 'Falta la unidad 3', motivo: 'reintentos_agotados:senal_9', proximo_paso: 'Reanudar con misiones_cc.py' }),
  )
  assert.equal(d.avance, 'Terminó la unidad 2')
  assert.equal(d.pendiente, 'Falta la unidad 3')
  assert.equal(d.motivo, 'reintentos_agotados:senal_9')
  assert.equal(d.proximo_paso, 'Reanudar con misiones_cc.py')

  const vacio = oficina.describir_seguimiento(seguimiento('activa'))
  assert.equal(vacio.avance, null)
  assert.equal(vacio.pendiente, null)
  assert.equal(vacio.motivo, null)
  assert.equal(vacio.proximo_paso, null)
})

// ---------- Poder responder ----------

test('puede_responder: sólo una ordinaria abierta; la sensible, la ya respondida y lo que no hay, no', () => {
  assert.equal(typeof oficina.puede_responder, 'function', 'falta puede_responder')
  assert.equal(oficina.puede_responder(pregunta()), true)

  assert.equal(oficina.puede_responder(pregunta({ tipo: 'sensible' })), false, 'una sensible nunca se responde acá')
  assert.equal(oficina.puede_responder(pregunta({ estado: 'respondida' })), false)
  assert.equal(oficina.puede_responder(pregunta({ estado: 'aplicada' })), false)
  assert.equal(oficina.puede_responder(pregunta({ estado: 'cerrada' })), false)
  assert.equal(oficina.puede_responder(pregunta({ estado: 'reemplazada' })), false)
  assert.equal(oficina.puede_responder(pregunta({ puede_responder: false })), false, 'si el admin dice que no, no')
  assert.equal(oficina.puede_responder(null), false)
  assert.equal(oficina.puede_responder(undefined), false)
})

// ---------- Cuerpo de la respuesta ----------

test('cuerpo_de_respuesta: revisión de la pregunta, opción, texto y un answer_uid nuevo por intento', () => {
  assert.equal(typeof oficina.cuerpo_de_respuesta, 'function', 'falta cuerpo_de_respuesta')

  const a = oficina.cuerpo_de_respuesta(pregunta(), 'A', '  Dale  ')
  assert.deepEqual(Object.keys(a).sort(), ['answer_uid', 'opcion', 'revision', 'texto'])
  assert.equal(a.revision, 2)
  assert.equal(a.opcion, 'A')
  assert.equal(a.texto, 'Dale', 'el texto va sin espacios de más')
  assert.match(a.answer_uid, UUID)

  // Sin texto o sin opción van null (no cadenas vacías).
  const b = oficina.cuerpo_de_respuesta(pregunta(), null, '')
  assert.equal(b.opcion, null)
  assert.equal(b.texto, null)

  // Dos intentos distintos, dos uuid distintos.
  assert.notEqual(oficina.cuerpo_de_respuesta(pregunta(), 'A', '').answer_uid, oficina.cuerpo_de_respuesta(pregunta(), 'A', '').answer_uid)
})

test('cuerpo_de_respuesta: un reintento conserva el answer_uid que se le pasa', () => {
  const primero = oficina.cuerpo_de_respuesta(pregunta(), 'B', '')
  const reintento = oficina.cuerpo_de_respuesta(pregunta(), 'B', '', primero.answer_uid)
  assert.equal(reintento.answer_uid, primero.answer_uid)
  assert.equal(reintento.opcion, 'B')
})

test('cuerpo_de_respuesta: el texto se corta en 1000 caracteres (el límite del admin)', () => {
  const largo = 'x'.repeat(1500)
  assert.equal(oficina.cuerpo_de_respuesta(pregunta(), 'A', largo).texto.length, 1000)
})

// ---------- Los componentes ----------

test('PreguntaDeMision.vue: existe, responde por la ruta del admin y no ofrece botones en una sensible', () => {
  const ruta = new URL('PreguntaDeMision.vue', RAIZ_COMPONENTES)
  assert.ok(existsSync(ruta), 'falta src/components/local/PreguntaDeMision.vue')
  const fuente = readFileSync(ruta, 'utf8')

  assert.match(fuente, /\/local\/missions\//, 'tiene que usar POST /local/missions/{slug}/questions/{uid}/answer')
  assert.match(fuente, /questions\//)
  assert.match(fuente, /\/answer/)
  assert.match(fuente, /Respuesta registrada: la misión se retoma sola/)
  assert.match(fuente, /Necesita tu OK personal por Slack o Telegram/)
  assert.match(fuente, /puede_responder/, 'decide con puede_responder de local_oficina')
  assert.match(fuente, /cuerpo_de_respuesta/, 'arma el cuerpo con cuerpo_de_respuesta (answer_uid por intento)')
  assert.match(fuente, /impacto/, 'muestra el impacto de cada opción')
  assert.match(fuente, /recomendada/i, 'marca la opción recomendada')
  assert.match(fuente, /emit.*respondida|'respondida'/, 'avisa con el evento respondida')
})

test('PanelMisiones.vue: muestra el seguimiento sólo si la misión lo trae y monta la pregunta', () => {
  const fuente = readFileSync(new URL('PanelMisiones.vue', RAIZ_COMPONENTES), 'utf8')

  assert.match(fuente, /describir_seguimiento/)
  assert.match(fuente, /PreguntaDeMision/)
  assert.match(fuente, /m\.seguimiento/, 'todo lo nuevo cuelga de m.seguimiento: sin él la misión se ve igual que hoy')
  assert.match(fuente, /Último avance/)
  assert.match(fuente, /Qué falta/)
  assert.match(fuente, /vigencia_texto/)
  assert.match(fuente, /proximo_paso/)
  assert.match(fuente, /respondida/, 're-emite respondida para que la vista refresque')
})

test('los chips de hoy no cambian: ESTADOS_MISION y ORDEN_ESTADOS siguen siendo los cuatro de siempre', () => {
  assert.deepEqual(Object.keys(oficina.ESTADOS_MISION), ['trabajando', 'esperando_lucas', 'trabada', 'terminada'])
  assert.deepEqual(oficina.ORDEN_ESTADOS, ['trabajando', 'trabada', 'esperando_lucas', 'terminada'])
})
