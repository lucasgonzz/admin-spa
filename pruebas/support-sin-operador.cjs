/*
  Prueba de src/utils/support_ticks.js (ticks de WhatsApp, nombre del cliente, contador de no
  leídos y mezcla de eventos de estado/reacción de la bandeja de soporte sin operador).

  Se corre con `node pruebas/support-sin-operador.cjs`. No necesita dependencias: `admin-spa` no
  tiene corredor de tests (misma convención que pruebas/support-media.cjs).

  Extrae las funciones del ARCHIVO REAL en vez de tener una copia pegada acá: una copia se
  desincroniza y la prueba pasa a probar código que ya no existe. Lo único que se hace es sacar el
  `export`, que Node no entiende dentro de un `new Function`.
*/
const fs = require('fs')
const path = require('path')

const FUENTE = path.join(__dirname, '..', 'src', 'utils', 'support_ticks.js')
let texto = fs.readFileSync(FUENTE, 'utf8')
texto = texto.replace(/^export /gm, '')

const nombres = [
  'TICK_SENT', 'TICK_DELIVERED', 'TICK_READ', 'TICK_FAILED', 'REACTION_EMOJIS',
  'is_outgoing_message', 'ticks_state', 'ticks_title', 'client_display_name',
  'agent_is_off_on_open_ticket', 'last_message_author', 'unread_total_from_response',
  'merge_status_payload', 'keep_best_delivery', 'payload_matches_message', 'admin_reaction_of', 'same_emoji',
  'emoji_to_send', 'can_react_to_message',
]
const m = new Function(texto + '\nreturn { ' + nombres.join(', ') + ' }')()

let fallos = 0
let corridas = 0

/** Compara con igualdad estricta (objetos por JSON) y cuenta el resultado. */
function igual(descripcion, obtenido, esperado) {
  corridas++
  const a = JSON.stringify(obtenido)
  const b = JSON.stringify(esperado)
  if (a !== b) {
    fallos++
    console.log('FALLA  ' + descripcion + '\n         obtenido: ' + a + '\n         esperado: ' + b)
  } else {
    console.log('ok     ' + descripcion)
  }
}

const wa = { source: 'whatsapp' }
const erp = { source: 'erp' }
const saliente = { sender_type: 'admin', whatsapp_message_id: 'wamid.X' }

/* ---- ticks_state ---- */
igual('saliente WhatsApp sin estado -> un check', m.ticks_state(saliente, wa), 'sent')
igual('entregado -> dos checks grises', m.ticks_state(Object.assign({}, saliente, { whatsapp_delivery_status: 'entregado' }), wa), 'delivered')
igual('leido -> dos checks azules', m.ticks_state(Object.assign({}, saliente, { whatsapp_delivery_status: 'leido' }), wa), 'read')
igual('fallido -> icono rojo', m.ticks_state(Object.assign({}, saliente, { whatsapp_delivery_status: 'fallido' }), wa), 'failed')
igual('estado desconocido cae a un check', m.ticks_state(Object.assign({}, saliente, { whatsapp_delivery_status: 'raro' }), wa), 'sent')
igual('estado en mayúsculas se normaliza', m.ticks_state(Object.assign({}, saliente, { whatsapp_delivery_status: 'LEIDO' }), wa), 'read')
igual('ticket del ERP -> nada', m.ticks_state(saliente, erp), null)
igual('sin ticket -> nada', m.ticks_state(saliente, null), null)
igual('sin whatsapp_message_id -> nada', m.ticks_state({ sender_type: 'admin' }, wa), null)
igual('whatsapp_message_id vacío -> nada', m.ticks_state({ sender_type: 'admin', whatsapp_message_id: '  ' }, wa), null)
igual('mensaje del cliente -> nada', m.ticks_state({ sender_type: 'user', whatsapp_message_id: 'w' }, wa), null)
igual('borrador del agente sin aprobar -> nada', m.ticks_state(Object.assign({}, saliente, { is_ai_suggestion_draft: true }), wa), null)
igual('fila optimista (sin wamid) -> nada', m.ticks_state({ sender_type: 'admin', _client_pending: 'c1' }, wa), null)
igual('mensaje nulo -> nada', m.ticks_state(null, wa), null)
igual('el mensaje del agente (sender_type admin) también cuenta', m.ticks_state({ sender_type: 'admin', sender_admin_id: null, whatsapp_message_id: 'w' }, wa), 'sent')

/* ---- ticks_title ---- */
igual('title leído', m.ticks_title('read', {}), 'Leído por el cliente')
igual('title fallido con motivo', m.ticks_title('failed', { last_send_error: 'Ventana cerrada' }), 'No se pudo entregar: Ventana cerrada')
igual('title fallido sin motivo', m.ticks_title('failed', {}), 'WhatsApp no pudo entregar el mensaje')
igual('title sin estado', m.ticks_title(null, {}), '')

/* ---- client_display_name ---- */
igual('empresa del cliente primero', m.client_display_name({ id: 9, client: { company_name: ' Ferretotal ', name: 'Juan' }, client_user_name: 'Pepe' }), 'Ferretotal')
igual('nombre del cliente si no hay empresa', m.client_display_name({ id: 9, client: { name: 'Juan' } }), 'Juan')
igual('usuario remoto si no hay cliente', m.client_display_name({ id: 9, client_user_name: 'Pepe' }), 'Pepe')
igual('empleado si no hay usuario', m.client_display_name({ id: 9, client_employee: { name: 'Ana' } }), 'Ana')
igual('Cliente #client_id de último recurso', m.client_display_name({ id: 9, client_id: 44 }), 'Cliente #44')
igual('Cliente #id del cliente embebido sin nombre', m.client_display_name({ id: 9, client: { id: 7 } }), 'Cliente #7')
igual('sin nada usa el id del ticket', m.client_display_name({ id: 9 }), 'Cliente #9')

/* ---- agent_is_off_on_open_ticket ---- */
igual('agente apagado y abierto -> chip', m.agent_is_off_on_open_ticket({ status: 'open', claude_auto_reply: false }), true)
igual('agente apagado con 0 -> chip', m.agent_is_off_on_open_ticket({ status: 'open', claude_auto_reply: 0 }), true)
igual('agente apagado pero cerrado -> sin chip', m.agent_is_off_on_open_ticket({ status: 'closed', claude_auto_reply: false }), false)
igual('cerrado por closed_at -> sin chip', m.agent_is_off_on_open_ticket({ closed_at: '2026-10-01', claude_auto_reply: false }), false)
igual('agente prendido -> sin chip', m.agent_is_off_on_open_ticket({ status: 'open', claude_auto_reply: true }), false)
igual('campo ausente (API vieja) -> sin chip', m.agent_is_off_on_open_ticket({ status: 'open' }), false)

/* ---- last_message_author ---- */
igual('cliente', m.last_message_author({ sender_type: 'user' }, 3, 'Ferretotal'), 'Ferretotal')
igual('Vos', m.last_message_author({ sender_type: 'admin', sender_admin_id: 3 }, 3, 'X'), 'Vos')
igual('Vos con id string', m.last_message_author({ sender_type: 'admin', sender_admin: { id: 3, name: 'Lucas' } }, '3', 'X'), 'Vos')
igual('otro operador', m.last_message_author({ sender_type: 'admin', sender_admin_id: 5, sender_admin: { id: 5, name: 'Martín' } }, 3, 'X'), 'Martín')
igual('agente (sin operador)', m.last_message_author({ sender_type: 'admin', sender_admin_id: null }, 3, 'X'), 'Agente')
igual('operador sin nombre', m.last_message_author({ sender_type: 'admin', sender_admin_id: 5 }, 3, 'X'), 'Operador')
igual('sin último mensaje', m.last_message_author(null, 3, 'X'), '')

/* ---- unread_total_from_response ---- */
igual('unread_total directo', m.unread_total_from_response({ unread_total: 7, unread_totals: { mine: 1, others: 1 } }), 7)
igual('unread_total como texto', m.unread_total_from_response({ unread_total: '12' }), 12)
igual('API vieja suma mine + others', m.unread_total_from_response({ unread_totals: { mine: 2, others: 5 } }), 7)
igual('API vieja con un lado roto', m.unread_total_from_response({ unread_totals: { mine: 'x', others: 5 } }), 5)
igual('unread_total en 0 no cae al viejo', m.unread_total_from_response({ unread_total: 0, unread_totals: { mine: 4, others: 4 } }), 0)
igual('sin ningún dato', m.unread_total_from_response({}), null)
igual('respuesta nula', m.unread_total_from_response(null), null)

/* ---- merge_status_payload ---- */
const base = { id: 1, body: 'hola', whatsapp_message_id: 'w', admin_reaction_emoji: '👍' }
const mezclado = m.merge_status_payload(base, { id: 1, whatsapp_delivery_status: 'entregado', whatsapp_delivered_at: '2026-10-26T10:00:00Z' })
igual('mezcla el estado y conserva el cuerpo', [mezclado.body, mezclado.whatsapp_delivery_status, mezclado.whatsapp_delivered_at], ['hola', 'entregado', '2026-10-26T10:00:00Z'])
igual('un evento sin reacción no borra la reacción', mezclado.admin_reaction_emoji, '👍')
igual('una reacción quitada (null) sí se aplica', m.merge_status_payload(base, { id: 1, admin_reaction_emoji: null }).admin_reaction_emoji, null)
igual('no muta el original', base.whatsapp_delivery_status, undefined)
igual('no retrocede leido a entregado', m.merge_status_payload({ id: 1, whatsapp_delivery_status: 'leido' }, { id: 1, whatsapp_delivery_status: 'entregado' }).whatsapp_delivery_status, 'leido')
igual('entregado -> leido avanza', m.merge_status_payload({ id: 1, whatsapp_delivery_status: 'entregado' }, { id: 1, whatsapp_delivery_status: 'leido' }).whatsapp_delivery_status, 'leido')
igual('un snapshot viejo (estado null) no resetea el estado', m.merge_status_payload({ id: 1, whatsapp_delivery_status: 'entregado', whatsapp_delivered_at: 'A' }, { id: 1, whatsapp_delivery_status: null, whatsapp_delivered_at: null }).whatsapp_delivery_status, 'entregado')
igual('una fecha vacía no borra la que había', m.merge_status_payload({ id: 1, whatsapp_delivered_at: 'A' }, { id: 1, whatsapp_delivered_at: null }).whatsapp_delivered_at, 'A')
igual('desde sin estado avanza a entregado', m.merge_status_payload({ id: 1 }, { id: 1, whatsapp_delivery_status: 'entregado' }).whatsapp_delivery_status, 'entregado')
igual('payload nulo devuelve copia', m.merge_status_payload(base, null), base)

/* ---- keep_best_delivery ---- */
const kb = m.keep_best_delivery({ id: 1, body: 'x', whatsapp_delivery_status: null }, { id: 1, whatsapp_delivery_status: 'leido', whatsapp_delivered_at: 'D', whatsapp_seen_at: 'S' })
igual('un snapshot viejo conserva el leido que ya había', [kb.body, kb.whatsapp_delivery_status, kb.whatsapp_delivered_at, kb.whatsapp_seen_at], ['x', 'leido', 'D', 'S'])
igual('un snapshot más nuevo gana', m.keep_best_delivery({ id: 1, whatsapp_delivery_status: 'leido' }, { id: 1, whatsapp_delivery_status: 'entregado' }).whatsapp_delivery_status, 'leido')
igual('sin previo devuelve copia', m.keep_best_delivery({ id: 1 }, null), { id: 1 })

/* ---- payload_matches_message ---- */
igual('mismo id (número vs texto)', m.payload_matches_message({ id: 5 }, { id: '5' }), true)
igual('otro id', m.payload_matches_message({ id: 5 }, { id: 6 }), false)
igual('sin id', m.payload_matches_message({}, { id: 6 }), false)

/* ---- reacciones ---- */
igual('reacción puesta', m.admin_reaction_of({ admin_reaction_emoji: '❤️' }), '❤️')
igual('sin reacción', m.admin_reaction_of({ admin_reaction_emoji: null }), '')
igual('mismo emoji con y sin selector', m.same_emoji('❤', '❤️'), true)
igual('emojis distintos', m.same_emoji('👍', '🙏'), false)
igual('vacío no es igual a vacío', m.same_emoji('', ''), false)
igual('elegir el mismo quita (null)', m.emoji_to_send('👍', '👍'), null)
igual('elegir otro reemplaza', m.emoji_to_send('👍', '🙏'), '🙏')
igual('sin reacción previa manda el emoji', m.emoji_to_send('', '😮'), '😮')
igual('la barra tiene los seis emojis', m.REACTION_EMOJIS.length, 6)

const entrante = { id: 8, sender_type: 'user', whatsapp_message_id: 'wamid.IN' }
igual('se puede reaccionar al mensaje del cliente en WhatsApp', m.can_react_to_message(entrante, 'whatsapp'), true)
igual('no en un ticket del ERP', m.can_react_to_message(entrante, 'erp'), false)
igual('no a un mensaje propio', m.can_react_to_message({ id: 8, sender_type: 'admin', whatsapp_message_id: 'w' }, 'whatsapp'), false)
igual('no si el cliente no tiene wamid', m.can_react_to_message({ id: 8, sender_type: 'user' }, 'whatsapp'), false)
igual('no si el ticket no informa el origen', m.can_react_to_message(entrante, null), false)

/* ---- guarda del preview de la lista ----
   Un commit perdió la barra de /\s+/g y el preview se comía las «s» del mensaje (26/10/2026). El componente
   no se puede importar desde Node, así que se vigila el texto del fuente. */
const fuente_lista = require('fs').readFileSync(require('path').join(__dirname, '..', 'src/components/support/TicketList.vue'), 'utf8')
igual('el preview colapsa espacios con \\s+ (no con s+)', fuente_lista.indexOf("replace(/\\s+/g, ' ')") >= 0, true)
igual('ningún replace(/s+/g) suelto en la lista', fuente_lista.indexOf('replace(/s+/g') >= 0, false)

console.log('\n' + (corridas - fallos) + '/' + corridas + ' pruebas ok')
if (fallos > 0) {
  console.log(fallos + ' FALLARON')
  process.exit(1)
}
