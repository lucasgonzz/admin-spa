import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createStore } from 'vuex'
import * as ticks from '../../src/utils/support_ticks.js'

const { es_ticket_de_ensayo } = ticks

/**
 * Los tickets de un cliente de ensayo no entran a la bandeja de Soporte (misión soporte-ocultar-tickets-ensayo,
 * 16/11/2026). Se ejercita el módulo REAL de Vuex (`src/store/support_ticket.js`): solo se reemplazan la red, el
 * deduplicador de requests y la fábrica base, que es de common-vue y arrastra dependencias del navegador.
 */

const turn = () => new Promise((resolve) => setImmediate(resolve))

/** Lo mínimo de `__base_store` que usa el módulo: `models`, `loading` y sus dos mutaciones. */
function base_store(options) {
  return {
    namespaced: true,
    state: () => Object.assign({ models: [], loading: false }, options.state),
    mutations: Object.assign({
      set_models(state, value) { state.models = value ? value : [] },
      set_loading(state, value) { state.loading = value },
    }, options.mutations),
    actions: options.actions,
  }
}

function harness() {
  const gets = []
  let respuesta_del_listado = { models: [] }
  const api = {
    get(url) { gets.push(url); return Promise.resolve({ data: respuesta_del_listado }) },
  }
  const run_once = (clave, runner) => Promise.resolve(runner(() => true))
  const source = readFileSync(new URL('../../src/store/support_ticket.js', import.meta.url), 'utf8')
    .replace(/^import .*\r?\n/gm, '').replace('export default', 'return')
  const names = ['__base_store', 'api', 'run_once', ...Object.keys(ticks)]
  const values = [base_store, api, run_once, ...Object.values(ticks)]
  const ticket_module = new Function(...names, source)(...values)
  const store = createStore({ modules: { support_ticket: ticket_module } })
  return {
    store,
    gets,
    ids: () => store.state.support_ticket.models.map((ticket) => ticket.id),
    listado: (data) => { respuesta_del_listado = data },
    listados_pedidos: () => gets.filter((url) => url.indexOf('/support-ticket?') === 0).length,
  }
}

const comun = (id, extra = {}) => ({ id, status: 'open', updated_at: '2026-11-16T10:00:00Z', es_ensayo: false, client: { id: 1, es_ensayo: false }, ...extra })
const ensayo_por_fila = (id, extra = {}) => ({ id, status: 'open', updated_at: '2026-11-16T11:00:00Z', es_ensayo: true, ...extra })
const ensayo_por_cliente = (id, extra = {}) => ({ id, status: 'open', updated_at: '2026-11-16T11:00:00Z', client: { id: 2, es_ensayo: true }, ...extra })

test('el helper reconoce la marca en la fila o en el cliente embebido', () => {
  assert.equal(es_ticket_de_ensayo({ id: 1, es_ensayo: true }), true)
  assert.equal(es_ticket_de_ensayo({ id: 1, es_ensayo: 1 }), true)
  assert.equal(es_ticket_de_ensayo({ id: 1, client: { es_ensayo: true } }), true)
  assert.equal(es_ticket_de_ensayo({ id: 1, client: { es_ensayo: 1 } }), true)
  /* La API vieja no manda `es_ensayo` en la fila: alcanza con el cliente. */
  assert.equal(es_ticket_de_ensayo({ id: 1, es_ensayo: undefined, client: { es_ensayo: true } }), true)
})

test('el helper no esconde lo que no está marcado ni lo que no trae cliente', () => {
  assert.equal(es_ticket_de_ensayo(null), false)
  assert.equal(es_ticket_de_ensayo(undefined), false)
  assert.equal(es_ticket_de_ensayo({}), false)
  assert.equal(es_ticket_de_ensayo({ id: 1 }), false)
  assert.equal(es_ticket_de_ensayo({ id: 1, es_ensayo: false }), false)
  assert.equal(es_ticket_de_ensayo({ id: 1, es_ensayo: 0, client: { es_ensayo: 0 } }), false)
  assert.equal(es_ticket_de_ensayo({ id: 1, client: null }), false)
  assert.equal(es_ticket_de_ensayo({ id: 1, client: { es_ensayo: false } }), false)
  /* Un cliente en prueba gratuita real no es un ensayo. */
  assert.equal(es_ticket_de_ensayo({ id: 1, es_prueba: true, client: { estado: 'prueba', es_ensayo: false } }), false)
  /* El payload de las alertas de hoy: sin cliente ni marca. */
  assert.equal(es_ticket_de_ensayo({ ticket_id: 7, ticket_name: 'Ticket #7', client_name: 'Marcela', minutos_sin_respuesta: 40 }), false)
})

test('upsert_from_broadcast no inserta un ticket de ensayo y sigue insertando los comunes', () => {
  const { store, ids } = harness()
  store.commit('support_ticket/upsert_from_broadcast', comun(1))
  store.commit('support_ticket/upsert_from_broadcast', ensayo_por_fila(2))
  store.commit('support_ticket/upsert_from_broadcast', ensayo_por_cliente(3))
  assert.deepEqual(ids(), [1])
})

test('upsert_from_broadcast saca de la lista un ticket que pasó a ser de ensayo', () => {
  const { store, ids } = harness()
  store.commit('support_ticket/set_models', [comun(1), comun(2)])
  store.commit('support_ticket/upsert_from_broadcast', ensayo_por_cliente(2))
  assert.deepEqual(ids(), [1])
  /* Un ensayo que no estaba no toca la lista. */
  const antes = store.state.support_ticket.models
  store.commit('support_ticket/upsert_from_broadcast', ensayo_por_fila(9))
  assert.equal(store.state.support_ticket.models, antes)
})

test('get_models filtra los tickets de ensayo que mande una API vieja', async () => {
  const { store, ids, listado } = harness()
  listado({ models: [comun(1), ensayo_por_cliente(2), comun(3, { es_prueba: true, client: { id: 4, estado: 'prueba', es_ensayo: false } }), ensayo_por_fila(5)], unread_total: 1 })
  await store.dispatch('support_ticket/get_models')
  assert.deepEqual(ids(), [1, 3])
  assert.equal(store.state.support_ticket.unread_total, 1)
})

test('un mensaje en vivo de un ensayo no entra a la bandeja ni programa el refresco de la lista', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { store, ids, listados_pedidos } = harness()
  store.commit('support_ticket/set_models', [comun(1)])

  await store.dispatch('support_ticket/apply_ticket_from_message', {
    id: 50, support_ticket_id: 2, body: 'Hola', kind: 'text', sender_type: 'user', ticket: ensayo_por_cliente(2),
  })
  await store.dispatch('support_ticket/apply_ticket_row', ensayo_por_fila(3))
  assert.deepEqual(ids(), [1])
  t.mock.timers.tick(60000)
  await turn()
  assert.equal(listados_pedidos(), 0, 'Un ticket de ensayo programó un GET de la bandeja.')

  /* Control: el mismo mensaje de un ticket común sí entra y sí programa el refresco. */
  await store.dispatch('support_ticket/apply_ticket_from_message', {
    id: 51, support_ticket_id: 4, body: 'Hola', kind: 'text', sender_type: 'user', ticket: comun(4, { updated_at: '2026-11-16T12:00:00Z' }),
  })
  assert.deepEqual(ids(), [4, 1])
  assert.equal(store.state.support_ticket.models[0].last_message.id, 51)
  t.mock.timers.tick(60000)
  await turn()
  assert.equal(listados_pedidos(), 1)
})

test('la respuesta de una acción sobre un ticket de ensayo tampoco lo mete en la bandeja', async () => {
  const { store, ids } = harness()
  store.commit('support_ticket/set_models', [comun(1)])
  /* Lo que devuelven store/update/attention de la API nueva: la fila con `es_ensayo: true`. */
  await store.dispatch('support_ticket/apply_ticket_row', ensayo_por_fila(8, { support_attention: { needs_human: false, mission: null } }))
  assert.deepEqual(ids(), [1])
})
