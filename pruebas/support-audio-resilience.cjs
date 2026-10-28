/* Regresiones del código real: recursos asincrónicos, audio efectivo y borrador hasta el ack. */
const fs = require('fs')
const path = require('path')
const assert = require('assert/strict')
const vm = require('vm')
let checks = 0
function ok(value, message) { assert.ok(value, message); checks++; console.log('ok  ' + message) }
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }

function harness(options = {}) {
  let now = 1000, next = 1
  const timers = new Map(), instances = []
  function schedule(fn, delay, interval) { const id = next++; timers.set(id, { fn, at: now + delay, interval }); return id }
  class FakeRecorder {
    static isRecordingSupported() { return true }
    constructor() {
      instances.push(this)
      this.recordedPages = []; this.totalLength = 0; this.state = 'inactive'
      this.context_closed = 0; this.tracks_stopped = 0; this.worker_closed = 0
      this.audioContext = { state: 'running', close: () => { this.context_closed++; this.audioContext.state = 'closed'; return Promise.resolve() } }
      this.encoder = { terminate: () => { this.worker_closed++ } }
      this.start_promise = new Promise((resolve, reject) => { this.resolve_start = resolve; this.reject_start = reject })
    }
    start() { if (options.throw_start) throw new Error('arranque síncrono'); this.state = 'loading'; return this.start_promise }
    storePage(page) { this.recordedPages.push(page); this.totalLength += page.length }
    clearStream() { this.tracks_stopped++ }
    close() { if (options.throw_close) throw new Error('nodo ya cerrado'); this.clearStream(); return this.audioContext.close() }
    stop() { this.state = 'inactive'; if (options.normal_stop) this.ondataavailable(new Uint8Array([1, 2, 3])) }
  }
  const events = []
  const context = { Blob, Uint8Array, Uint32Array, Promise, console, Recorder: FakeRecorder, encoderPath: 'worker',
    Date: { now: () => now }, setTimeout: (fn, ms) => schedule(fn, ms, 0), clearTimeout: (id) => timers.delete(id),
    setInterval: (fn, ms) => schedule(fn, ms, ms), clearInterval: (id) => timers.delete(id) }
  const source = fs.readFileSync(path.join(__dirname, '../src/utils/oggOpusRecorder.js'), 'utf8')
    .replace(/^import .*$/gm, '').replace('export class OggOpusRecorder', 'class OggOpusRecorder').replace('export default OggOpusRecorder', 'globalThis.Wrapper = OggOpusRecorder')
  vm.runInNewContext(source, context)
  const wrapper = new context.Wrapper({ minDurationMs: 0,
    onReady: () => events.push('ready'), onData: (blob, origin) => events.push(['data', origin, blob.size]),
    onError: (error, phase) => events.push(['error', phase]), onProgress: (blob) => events.push(['progress', blob.size]) })
  function page(audio) { const p = new Uint8Array(28); p.set([79, 103, 103, 83]); p[6] = audio ? 1 : 0; return p }
  function audio() { const r = instances[instances.length - 1]; r.storePage(page(false)); r.storePage(page(false)); r.storePage(page(true)) }
  async function tick(ms) {
    const target = now + ms
    while (true) {
      let chosen = null
      for (const [id, timer] of timers) if (timer.at <= target && (!chosen || timer.at < chosen[1].at)) chosen = [id, timer]
      if (!chosen) break
      now = chosen[1].at; timers.delete(chosen[0])
      if (chosen[1].interval) timers.set(chosen[0], { ...chosen[1], at: now + chosen[1].interval })
      chosen[1].fn(); await flush()
    }
    now = target; await flush()
  }
  return { wrapper, instances, events, audio, tick, timers, context }
}

async function wrapper_tests() {
  let h = harness()
  h.wrapper.start()
  ok(h.events.length === 0, 'pedir permiso no anuncia grabación')
  h.instances[0].resolve_start(); await flush()
  ok(h.events.length === 0, 'start resuelto sin muestras tampoco anuncia grabación')
  h.audio()
  ok(h.events.filter((e) => e === 'ready').length === 1, 'primera página de audio confirma captura una sola vez')
  await h.tick(2000)
  ok(h.events.some((e) => e[0] === 'progress'), 'checkpoint entrega audio recuperable mientras graba')
  h.wrapper.stop(); await h.tick(4001)
  ok(h.events.some((e) => e[0] === 'data' && e[1] === 'rescate'), 'cierre sin respuesta rescata páginas ya capturadas')
  ok(h.instances[0].tracks_stopped > 0 && h.instances[0].context_closed > 0 && h.instances[0].worker_closed > 0, 'rescate suelta tracks, contexto y worker')
  h.instances[0].ondataavailable(new Uint8Array([4])); await flush()
  ok(h.events.filter((e) => e[0] === 'data').length === 1, 'callback tardío no entrega ni cierra una segunda nota')

  h = harness(); h.wrapper.start(); await h.tick(8001)
  ok(h.events.filter((e) => e[0] === 'error').length === 1 && h.wrapper.state === 'idle', 'arranque colgado tiene timeout sin esperar un stop')
  h.instances[0].resolve_start(); await flush()
  ok(h.wrapper.state === 'idle' && h.events.length === 1, 'permiso tardío no revive grabación vencida')

  h = harness({ throw_start: true, throw_close: true }); await h.wrapper.start()
  ok(h.wrapper.state === 'idle' && h.events[0][0] === 'error', 'excepción síncrona start sale por el error controlado')
  ok(h.instances[0].context_closed === 1 && h.instances[0].tracks_stopped > 0, 'si close falla igual cierra el contexto y los tracks')

  h = harness(); h.wrapper.start(); h.wrapper.cancel(); h.instances[0].resolve_start(); await flush(); await h.tick(4001)
  ok(!h.events.some((e) => e[0] === 'data' || e[0] === 'error'), 'cancelación durante arranque no entrega audio ni error abandonado')
  h = harness(); h.wrapper.start(); h.instances[0].resolve_start(); await flush(); h.audio(); await h.tick(12001)
  ok(h.events.some((e) => e[0] === 'data' && e[1] === 'rescate'), 'si dejan de llegar muestras conserva la grabación anterior')
  h = harness(); h.wrapper.start(); h.instances[0].resolve_start(); await flush(); h.audio()
  h.instances[0].ondataavailable(new Uint8Array(0))
  ok(h.events.some((e) => e[0] === 'data' && e[1] === 'rescate' && e[2] > 0), 'done vacío no pisa checkpoint con voz: entrega rescate')
  h = harness(); h.wrapper.start(); h.instances[0].resolve_start(); await flush()
  h.instances[0].ondataavailable(new Uint8Array(27))
  ok(!h.events.some((e) => e[0] === 'data') && h.events.some((e) => e[0] === 'error'), 'done sin páginas de audio no confirma una nota vacía')
}

function input_harness() {
  const saved = new Map(), emitted = []
  const source = fs.readFileSync(path.join(__dirname, '../src/components/support/MessageInput.vue'), 'utf8')
    .split('<script>')[1].split('</script>')[0].replace(/^import .*$/gm, '').replace('export default', 'return')
  const component = new Function('ImageAnnotationEditor', 'OggOpusRecorder', 'audio_recorder_button', 'extension_of',
    'new_audio_id', 'check_audio_storage', 'save_audio_draft', 'load_audio_drafts', 'remove_audio_draft', source)(
    {}, {}, {}, () => '', () => 'draft_12345678', () => Promise.resolve(),
    async (draft) => saved.set(draft.id, draft), async () => [...saved.values()], async (id) => saved.delete(id))
  const input = { ...component.data(), ticket_id: 7, can_send: true, audio_recording: false, audio_starting: false, audio_closing: false,
    $store: { state: { auth: { admin: { id: 5 } } } }, $refs: { file_input: { value: '' } },
    $nextTick: () => {}, $emit: (name, payload) => emitted.push(payload) }
  for (const [name, method] of Object.entries(component.methods)) input[name] = method.bind(input)
  for (const [name, getter] of Object.entries(component.computed)) Object.defineProperty(input, name, { get: getter.bind(input) })
  input.attachment = new Blob(['audio conservado'], { type: 'audio/mp3' }); input.attachment.name = 'nota.mp3'
  input.body = 'comentario'; input.audio_draft_id = 'draft_12345678'; input.audio_draft_partial = true
  return { input, saved, emitted }
}

async function input_tests() {
  let h = input_harness()
  await h.input.emit_send()
  ok(h.input.attachment && h.saved.size === 1, 'emitir conserva adjunto y copia durable hasta confirmar servidor')
  ok(h.saved.values().next().value.name === 'nota.mp3', 'borrador conserva nombre y contenedor original del adjunto')
  ok(h.saved.values().next().value.partial === true, 'reintento conserva advertencia de audio recuperado parcial')
  await h.emitted[0].on_result(null)
  ok(h.input.attachment && h.saved.size === 1 && !h.input.draft_sending, 'fallo de red permite reintentar sin borrar audio')
  await h.input.emit_send()
  ok(h.emitted[0].client_message_id === h.emitted[1].client_message_id, 'todos los reintentos conservan la misma identidad')
  await h.emitted[1].on_result({ id: 12, attachments: [] })
  ok(h.saved.size === 1 && h.input.attachment, 'un modelo sin adjunto no confirma audio')
  await h.emitted[1].on_result({ id: 12, attachments: [{ id: 4 }], remote_delivery_status: 'not_received' })
  ok(h.saved.size === 0 && !h.input.attachment, 'sólo modelo con archivo durable confirma y limpia borrador')
  ok(h.input.audio_notice.includes('Reintentar'), 'fallo remoto mantiene indicación de reintento del mensaje guardado')
  h.input.audio_draft_id = 'nota_nueva'; h.input.attachment = new Blob(['otra nota'])
  await h.emitted[1].on_result(null)
  ok(h.input.audio_draft_id === 'nota_nueva' && h.input.attachment, 'ack duplicado tardío no modifica una nota nueva')
  h = input_harness(); const original = h.input.attachment; h.input.attachment = null
  h.input.restore_audio({ id: 'otro', scope: '9:7', blob: original, name: 'audio.mp3' })
  ok(h.input.attachment === null, 'no restaura audio de otro usuario aunque comparta ticket')
  h = input_harness()
  await h.input.persist_audio(h.input.attachment, false)
  const confirmed = h.input.confirm_recovered_audio({ id: 12, attachments: [{ id: 4 }] }, h.input.audio_draft_id)
  ok(h.input.draft_sending === true, 'ack de reintento externo mantiene bloqueado el input mientras limpia')
  await confirmed
  ok(!h.input.attachment && h.saved.size === 0, 'reintento desde la fila también limpia un borrador recuperado sin handler previo')
  h = input_harness(); h.input.audio_owner_scope = '5:7'; h.input.$store.state.auth.admin = { id: 6 }
  await h.input.persist_audio(h.input.attachment, true)
  ok(h.saved.values().next().value.scope === '5:7', 'callback tardío conserva dueño original tras cambiar sesión')
}

async function mixin_tests() {
  const { reactive, markRaw, isProxy } = require('vue')
  const instances = []
  class Recording {
    static isSupported() { return true }
    constructor(options) { this.options = options; instances.push(this) }
    start() { return Promise.resolve() }
    stop() { this.options.onData(new Blob(['nota']), 'normal') }
    cancel() {}
  }
  const source = fs.readFileSync(path.join(__dirname, '../src/mixins/audio_recorder_button.js'), 'utf8')
    .replace(/^import .*$/gm, '').replace('export default', 'return')
  const mixin = new Function('OggOpusRecorder', 'markRaw', source)(Recording, markRaw)
  const input = reactive({ ...mixin.data(), on_audio_blob() {}, can_record_audio() { return true } })
  for (const [name, method] of Object.entries(mixin.methods)) input[name] = method.bind(input)
  mixin.created.call(input)
  input.start_audio_recording()
  ok(input.audio_starting && !input.audio_recording && input.audio_elapsed_seconds === 0, 'Vue real muestra preparación sin cronómetro antes de muestras')
  ok(!isProxy(input.audio_recorder), 'el grabador conserva identidad real dentro del estado reactivo Vue3')
  input.start_audio_recording()
  ok(instances.length === 1, 'doble toque mientras arranca no abre otro micrófono')
  instances[0].options.onReady()
  ok(input.audio_recording && !input.audio_starting, 'callback de captura efectiva en Vue real habilita cronómetro')
  input.stop_and_send_audio()
  ok(!input.audio_recording && !input.audio_recorder && !input.audio_closing, 'cierre confirmado limpia estado y temporizadores')
  input.start_audio_recording(); input.stop_and_send_audio()
  // Simular captura que termina de abrirse después de pedir el corte, sin callback de datos todavía.
  input.audio_closing = true; input.audio_starting = true; input.audio_recorder = instances[1]
  instances[1].options.onReady()
  ok(!input.audio_recording && input.audio_closing, 'captura tardía durante cierre no vuelve a mostrar grabando')
  input.cancel_audio_recording()
}

;(async function () { await wrapper_tests(); await input_tests(); await mixin_tests(); console.log('\n' + checks + ' comprobaciones de resiliencia en verde') })().catch((err) => { console.error(err); process.exitCode = 1 })
