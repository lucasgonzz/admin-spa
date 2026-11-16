import test from 'node:test'
import assert from 'node:assert/strict'
import { mission_groups } from '../../src/utils/support_missions.js'

test('el contador conserva ambos tipos y no depende de que el ticket siga abierto', () => {
  const ticket = { status: 'closed', support_attention: {
    mission_counts: { bug: { total: 3, completed: 2 }, funcionalidad: { total: 2, completed: 1 } },
  } }
  assert.deepEqual(mission_groups(ticket).map(({ label, total, completed }) => ({ label, total, completed })), [
    { label: 'Correctivas', total: 3, completed: 2 }, { label: 'Funcionalidades', total: 2, completed: 1 },
  ])
})

test('un chat iniciado o finalizado sin integración acreditada no cuenta como misión terminada', () => {
  const groups = mission_groups({ support_attention: { missions: [
    { mission_type: 'bug', status: 'started' }, { mission_type: 'bug', status: 'completed' },
    { mission_type: 'funcionalidad', status: 'pending' },
  ] } })
  assert.equal(groups[0].total, 2)
  assert.equal(groups[0].completed, 1)
  assert.equal(groups[1].completed, 0)
})

test('API anterior conserva el aviso legado y colección vacía nueva lo limpia', () => {
  assert.equal(mission_groups({ support_attention: { mission: { status: 'started' } } }), null)
  assert.deepEqual(mission_groups({ support_attention: { mission: { status: 'started' }, missions: [] } }), [])
})

test('el resumen agregado prevalece sobre la colección parcial y descarta conteos inválidos', () => {
  const groups = mission_groups({ support_attention: {
    missions: [{ mission_type: 'bug', status: 'started' }],
    mission_counts: { bug: { total: 3, completed: 2 }, funcionalidad: { total: -1, completed: 5 } },
  } })
  assert.equal(groups.length, 1)
  assert.equal(groups[0].total, 3)
  assert.equal(groups[0].completed, 2)
})
