const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const fuente = fs.readFileSync(path.join(__dirname, '../src/views/Support.vue'), 'utf8')
function metodo(nombre, siguiente, api) {
  const inicio = fuente.indexOf('    ' + nombre + '(')
  const fin = fuente.indexOf('    ' + siguiente + '(', inicio)
  const bloque = fuente.slice(inicio, fin).replace(/,\s*\/\*\*[\s\S]*$/, '')
  return new Function('api', 'return ({' + bloque + '}).' + nombre)(api)
}
const turno = () => new Promise(resolve => setImmediate(resolve))
;(async function () {
  const commits = [], llamadas = [], errores = [], refrescos = []
  let completar
  const api = { patch(url, body) { llamadas.push({ url, body }); return new Promise(r => { completar = r }) } }
  const vm = { selected_ticket_id: 34, selected_ticket: { id: 34, support_attention: { needs_human: true } }, saving_agent_controls: false,
    $store: { commit(...args) { commits.push(args) }, dispatch(...args) { refrescos.push(args) } }, mostrar_error_de_borrador(...args) { errores.push(args) } }
  const toggle = metodo('toggle_attention', 'post_agent_toggle', api)
  toggle.call(vm)
  assert.deepEqual(llamadas, [{ url: '/support-ticket/34/attention', body: { needs_human: false } }])
  assert.equal(vm.selected_ticket.support_attention.needs_human, true, 'no reconoce la alerta antes de confirmar guardado')
  toggle.call(vm)
  assert.equal(llamadas.length, 1, 'un doble toque no duplica el cambio')
  vm.selected_ticket_id = 27
  completar({ data: { model: { id: 34, support_attention: { needs_human: false, mission: { status: 'started' } } } } })
  await turno()
  assert.equal(commits[0][1].id, 34, 'el resultado actualiza el ticket original aunque se cambió de chat')
  assert.equal(commits[0][1].support_attention.mission.status, 'started')
  assert.equal(vm.saving_agent_controls, false)
  const fallo = metodo('toggle_attention', 'post_agent_toggle', { patch() { return Promise.reject(new Error('sin red')) } })
  fallo.call(vm); await turno()
  assert.equal(errores.length, 1, 'el operador ve que no se pudo apagar el aviso')
  assert.equal(commits.length, 1, 'un fallo no borra la alerta local')
  let aprobar
  const envio = metodo('on_send_draft', 'on_discard_draft', { post() { return new Promise(r => { aprobar = r }) } })
  vm.selected_ticket_id = 34; vm.draft_busy = false
  envio.call(vm, { message: { id: 100, support_ticket_id: 34 }, body: null })
  vm.selected_ticket_id = 27
  aprobar({ data: { model: { id: 100 }, ticket: { id: 34 } } }); await turno()
  const pendiente = commits.find(c => c[0] === 'support_ticket/patch_ticket_ai_pending')
  assert.equal(pendiente[1].ticket_id, 34, 'aprobar nunca borra el pendiente de otro chat')
  console.log('9 comprobaciones de alerta y aprobación por ticket correctas')
})().catch(error => { console.error(error); process.exitCode = 1 })
