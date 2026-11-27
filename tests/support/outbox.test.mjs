import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createStore } from 'vuex'
import * as ticks from '../../src/utils/support_ticks.js'
import * as outbox from '../../src/utils/support_outbox.js'
import { support_filter_tickets, support_summary } from '../../src/utils/support_summary.js'

globalThis.window = { dispatchEvent() {} }
globalThis.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options.detail } }
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const turn = () => new Promise((resolve) => setTimeout(resolve, 0))

/** Ejecuta las acciones reales de Vuex. Sólo reemplaza la red y el almacenamiento del audio. */
function harness() {
  const calls = [], gets = [], removed_audio = []
  const api = {
    post(url, data) { const request = deferred(); calls.push({ url, data, ...request }); return request.promise },
    get(url) { const request = deferred(); gets.push({ url, ...request }); return request.promise },
  }
  const source = readFileSync(new URL('../../src/store/support_message.js', import.meta.url), 'utf8')
    .replace(/^import .*\r?\n/gm, '').replace('export default', 'return')
  const names = ['api', ...Object.keys(ticks), ...Object.keys(outbox), 'remove_audio_draft']
  const values = [api, ...Object.values(ticks), ...Object.values(outbox), (id) => { removed_audio.push(id); return Promise.resolve() }]
  const message_module = new Function(...names, source)(...values)
  const store = createStore({
    state: { auth: { admin: { id: 9 } } },
    modules: {
      support_message: message_module,
      support_ticket: { namespaced: true, mutations: { patch_ticket_ai_pending() {} }, actions: { apply_ticket_from_message() {}, apply_ticket_row() {}, patch_ticket_unread_count() {}, schedule_unread_badges() {} } },
    },
  })
  const select = (id) => { store.commit('support_message/set_active_owner_id', store.state.auth.admin && store.state.auth.admin.id); store.commit('support_message/set_active_ticket_id', id); store.commit('support_message/set_models', []) }
  const visible = () => store.getters['support_message/visible_messages']
  const send = (text, ticket = 40, extra = {}) => store.dispatch('support_message/send_message', { ticket_id: ticket, client_message_id: 'mensaje-' + text, body: text, kind: 'text', ...extra })
  const acknowledge = (index, extra = {}) => {
    const call = calls[index]
    const model = { id: index + 100, support_ticket_id: Number(call.url.split('/')[2]), client_message_id: call.data.get('client_message_id'), body: call.data.get('body'), sender_type: 'admin', ...extra }
    call.resolve({ data: { model } })
    return model
  }
  return { store, calls, gets, select, visible, send, acknowledge, removed_audio }
}

test('tres Enter se aceptan al instante y los POST salen en FIFO, de a uno', async () => {
  const h = harness(); h.select(40)
  let accepted = 0
  const results = ['uno', 'dos', 'tres'].map((text) => h.send(text, 40, { on_queued() { accepted++ } }))
  assert.equal(accepted, 3)
  assert.deepEqual(h.visible().map((row) => row._queue_status), ['sending', 'queued', 'queued'])
  assert.equal(h.calls.length, 1)
  h.acknowledge(0); await turn()
  assert.equal(h.calls.length, 2)
  assert.equal(h.calls[1].data.get('body'), 'dos')
  h.acknowledge(1); await turn()
  assert.equal(h.calls.length, 3)
  h.acknowledge(2)
  assert.equal((await Promise.all(results)).length, 3)
  assert.deepEqual(h.visible().map((row) => row.body), ['uno', 'dos', 'tres'])
})

test('la latencia y las fechas del servidor no adelantan al tercero pendiente al confirmar los anteriores', async () => {
  const h = harness(); h.select(40)
  const results = ['primero', 'segundo', 'tercero'].map((text) => h.send(text))
  const order = () => assert.deepEqual(h.visible().map((row) => row.body), ['primero', 'segundo', 'tercero'])
  order()
  const later = new Date(Date.now() + 60000).toISOString()
  h.acknowledge(0, { created_at: later }); await turn()
  order()
  h.store.commit('support_message/add_model', {
    id: 101, support_ticket_id: 40, client_message_id: 'mensaje-segundo', body: 'segundo',
    sender_type: 'admin', created_at: later,
  })
  order()
  h.acknowledge(1, { created_at: later }); await turn()
  order()
  h.acknowledge(2, { created_at: later }); await Promise.all(results)
  order()
})

test('un fallo conserva File y cita; reintentar usa la misma identidad sin duplicar la fila', async () => {
  const h = harness(); h.select(40)
  const file = new Blob(['audio'], { type: 'audio/ogg' }); file.name = 'nota.ogg'
  const result = h.send('', 40, { kind: 'audio', client_message_id: 'audio-original', attachment: file, reply_to_message_id: 7, reply_to_message: { id: 7, body: 'Consulta' } })
  h.calls[0].reject(new Error('Conexión cortada'))
  assert.equal(await result, null)
  const failed = h.visible()[0]
  assert.equal(failed._delivery_error, 'not_sent')
  assert.equal(failed.reply_to_message.id, 7)
  assert.equal(failed._retry_attachment, file)
  const retry = h.store.dispatch('support_message/retry_send_message', failed)
  assert.equal(h.visible().length, 1)
  assert.equal(h.calls[1].data.get('client_message_id'), 'audio-original')
  assert.equal(h.calls[1].data.get('reply_to_message_id'), '7')
  h.acknowledge(1, { attachments: [{ id: 1, public_url: '/nota.ogg' }] })
  assert.ok(await retry)
  assert.deepEqual(h.removed_audio, ['audio-original'])
})

test('el eco de Pusher antes de un timeout confirma una sola burbuja', async () => {
  const h = harness(); h.select(40)
  const result = h.send('eco')
  const echo = { id: 300, support_ticket_id: 40, client_message_id: 'mensaje-eco', sender_type: 'admin', body: 'eco' }
  h.store.commit('support_message/add_model', echo)
  h.calls[0].reject(new Error('Timeout después de guardar'))
  assert.equal((await result).id, 300)
  assert.equal(h.visible().length, 1)
  assert.equal(h.visible()[0]._delivery_error, undefined)
  assert.equal(h.calls.length, 1)
})

test('un GET tardío conserva eco y pendientes; cambiar de hilo no mezcla adjuntos ni mensajes', async () => {
  const h = harness()
  const loading = h.store.dispatch('support_message/load_ticket_messages', 40)
  const first = h.send('pendiente')
  h.store.commit('support_message/add_model', { id: 9, support_ticket_id: 40, body: 'En vivo', sender_type: 'admin' })
  h.gets[0].resolve({ data: { model: { id: 40, messages: [] } } }); await loading
  assert.deepEqual(h.visible().map((row) => row.body), ['En vivo', 'pendiente'])
  h.select(41)
  assert.deepEqual(h.visible(), [])
  h.acknowledge(0); await first
  assert.deepEqual(h.visible(), [])
  h.select(40)
  assert.equal(h.visible()[0].body, 'pendiente')
})

test('la respuesta de un GET anterior al volver al mismo ticket no pisa la carga vigente', async () => {
  const h = harness()
  const old = h.store.dispatch('support_message/load_ticket_messages', 40)
  h.select(41)
  const current = h.store.dispatch('support_message/load_ticket_messages', 40)
  h.gets[1].resolve({ data: { model: { id: 40, messages: [{ id: 7, support_ticket_id: 40, body: 'Nuevo' }] } } }); await current
  h.gets[0].resolve({ data: { model: { id: 40, messages: [{ id: 5, support_ticket_id: 40, body: 'Viejo' }] } } }); await old
  assert.deepEqual(h.visible().map((row) => row.body), ['Nuevo'])
})

test('otra cuenta no ve ni envía la cola del operador anterior', async () => {
  const h = harness(); h.select(40)
  const a = h.send('primero'), b = h.send('segundo')
  h.store.state.auth.admin = { id: 10 }
  assert.deepEqual(h.visible(), [])
  h.acknowledge(0); await Promise.all([a, b])
  assert.equal(h.calls.length, 1)
  h.store.state.auth.admin = { id: 9 }
  assert.equal(h.visible()[1]._delivery_error, 'session_changed')
})

test('Pusher de un hilo bajo otra cuenta no confirma el buzón del operador anterior', async () => {
  const h = harness(); h.select(40)
  const result = h.send('del operador anterior')
  h.store.state.auth.admin = { id: 10 }; h.select(40)
  h.store.commit('support_message/add_model', { id: 309, support_ticket_id: 40, client_message_id: 'mensaje-del operador anterior', sender_type: 'admin' })
  assert.equal(h.store.state.support_message.outbox[0].model, null)
  h.calls[0].reject(new Error('Sesión anterior cerrada'))
  assert.equal(await result, null)
  h.store.state.auth.admin = { id: 9 }; h.select(40)
  assert.equal(h.visible()[0]._delivery_error, 'session_changed')
})

test('dos mensajes con igual texto siguen siendo dos envíos, por su client_message_id', async () => {
  const h = harness(); h.select(40)
  const a = h.send('sí', 40, { client_message_id: 'primera-identidad' })
  const b = h.send('sí', 40, { client_message_id: 'segunda-identidad' })
  h.acknowledge(0); await turn(); h.acknowledge(1); await Promise.all([a, b])
  assert.equal(h.visible().length, 2)
})

test('el saliente confirmado sin Pusher queda antes del siguiente entrante', async () => {
  const h = harness(); h.select(40)
  const sent = h.send('Ya lo resolvimos')
  h.acknowledge(0); await sent
  h.store.commit('support_message/add_model', { id: 101, support_ticket_id: 40, body: 'Gracias', sender_type: 'user' })
  assert.deepEqual(h.visible().map((row) => row.body), ['Ya lo resolvimos', 'Gracias'])
})

test('una confirmación sin archivo no borra el audio y un cambio de sesión durante el checkpoint no lo envía', async () => {
  const h = harness(); h.select(40)
  const file = new Blob(['voz'], { type: 'audio/ogg' }); file.name = 'nota.ogg'
  const first = h.send('', 40, { kind: 'audio', attachment: file, client_message_id: 'audio-sin-archivo' })
  h.acknowledge(0, { attachments: [] }); assert.equal(await first, null)
  assert.equal(h.visible()[0]._retry_attachment, file)
  assert.deepEqual(h.removed_audio, [])

  const checkpoint = deferred()
  const pending = h.send('', 40, { kind: 'audio', attachment: file, client_message_id: 'audio-con-checkpoint', prepared: checkpoint.promise })
  h.store.state.auth.admin = { id: 10 }
  checkpoint.resolve(); assert.equal(await pending, null)
  assert.equal(h.calls.length, 1)
})

test('borradores de texto, cita y File quedan separados por operador y ticket', () => {
  const h = harness()
  const file = new Blob(['foto'])
  h.store.commit('support_message/set_composer_draft', { scope: '9:40', draft: { body: 'Pendiente', attachment: file, reply_to: { id: 3 } } })
  h.store.commit('support_message/set_composer_draft', { scope: '9:41', draft: { body: 'Otro ticket' } })
  assert.equal(h.store.state.support_message.composer_drafts['9:40'].attachment, file)
  assert.equal(h.store.state.support_message.composer_drafts['9:40'].reply_to.id, 3)
  assert.equal(h.store.state.support_message.composer_drafts['10:40'], undefined)
})

test('cada tarjeta cuenta exactamente su lista, incluidos cerrados de hoy; API vieja queda explícita', () => {
  const tickets = [
    { id: 1, status: 'open', abierto_hoy: true, sin_responder: true },
    { id: 2, status: 'closed', abierto_hoy: true, sin_responder: false },
    { id: 3, status: 'open', abierto_hoy: false, sin_responder: false },
  ]
  for (const card of support_summary(tickets)) assert.equal(card.count, support_filter_tickets(tickets, card.key).length)
  assert.deepEqual(support_summary(tickets).map((row) => row.count), [2, 2, 1, null])
  const old = [{ id: 4, status: 'open' }]
  assert.deepEqual(support_summary(old).map((row) => row.count), [null, 1, null, null])
  assert.deepEqual(support_filter_tickets(old, 'sin-responder'), old)
})

test('el evento de adjunto privado refresca las tarjetas por HTTP autenticado, en una sola tanda', async () => {
  const source = readFileSync(new URL('../../src/store/support_ticket.js', import.meta.url), 'utf8')
    .replace(/^import .*\r?\n/gm, '').replace('export default', 'return')
  const pending = new Map(), requests = []
  let timer = 0
  const api = { get(url) {
    requests.push(url)
    return Promise.resolve({ data: { models: [{ id: 40, status: 'open', sin_responder: false, abierto_hoy: true }] } })
  } }
  const base = (options) => ({ ...options, namespaced: true, state: { models: [], ...options.state }, mutations: {
    set_loading() {}, set_models(state, rows) { state.models = rows }, ...options.mutations,
  } })
  const names = ['api', '__base_store', 'run_once', ...Object.keys(ticks), 'setTimeout', 'clearTimeout']
  const values = [api, base, (key, runner) => runner(() => true), ...Object.values(ticks),
    (callback) => { pending.set(++timer, callback); return timer }, (id) => pending.delete(id)]
  const module = new Function(...names, source)(...values)
  const store = createStore({ modules: { support_ticket: module } })
  store.commit('support_ticket/set_models', [{ id: 40, status: 'open', sin_responder: true, abierto_hoy: true }])
  const event = { id: 91, support_ticket_id: 40, sender_type: 'admin', private_attachments_pending: true }
  await store.dispatch('support_ticket/apply_ticket_from_message', event)
  await store.dispatch('support_ticket/apply_ticket_from_message', event)
  assert.equal(pending.size, 1)
  assert.equal(support_summary(store.state.support_ticket.models)[2].count, 1)
  pending.values().next().value(); await turn()
  assert.deepEqual(requests, ['/support-ticket?assigned_filter=all'])
  assert.equal(support_summary(store.state.support_ticket.models)[2].count, 0)
})
