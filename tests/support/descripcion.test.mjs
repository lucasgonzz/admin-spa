import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as descripcion from '../../src/utils/support_description.js'

/**
 * CA11 y CA12 de la misión martin-descripcion-y-actualizaciones (25/11/2026): la descripción del ticket se
 * ve como texto con el label «Descripción», se edita sólo al hacer clic, y debajo —en rojo, y sólo si hace
 * falta— va el motivo por el que se necesita a Lucas. La lógica vive en `src/utils/support_description.js`
 * (funciones puras); los .vue sólo la pintan, y el último bloque fija ese cableado leyendo el fuente.
 */

const RESUMEN = 'Error al facturar con ARCA desde ayer. Se le pidió reiniciar el certificado.'
const MOTIVO = 'Necesito que cargues el certificado nuevo del cliente porque sólo lo tiene Lucas.'

// ---------------------------------------------------------------------------------------------------------
// CA11: label, texto y placeholder
// ---------------------------------------------------------------------------------------------------------

test('CA11: el label del campo es «Descripción»', () => {
	assert.equal(descripcion.DESCRIPTION_LABEL, 'Descripción')
})

test('CA11: el texto de lectura es el resumen guardado, sin espacios sobrantes', () => {
	assert.equal(descripcion.description_text({ id: 1, summary: '  ' + RESUMEN + '\n ' }), RESUMEN)
})

test('CA11: sin resumen (null, vacío, sólo espacios o sin ticket) no hay texto', () => {
	assert.equal(descripcion.description_text({ id: 1, summary: null }), '')
	assert.equal(descripcion.description_text({ id: 1, summary: '   ' }), '')
	assert.equal(descripcion.description_text({ id: 1 }), '')
	assert.equal(descripcion.description_text(null), '')
})

test('CA11: el borrador vacío muestra «Sin descripción todavía» y el lleno su texto', () => {
	assert.deepEqual(descripcion.description_display(''), { text: 'Sin descripción todavía', is_placeholder: true })
	assert.deepEqual(descripcion.description_display('   '), { text: 'Sin descripción todavía', is_placeholder: true })
	assert.deepEqual(descripcion.description_display(RESUMEN), { text: RESUMEN, is_placeholder: false })
	assert.deepEqual(descripcion.description_display(null), { text: 'Sin descripción todavía', is_placeholder: true })
})

// ---------------------------------------------------------------------------------------------------------
// CA11: lectura -> edición -> lectura
// ---------------------------------------------------------------------------------------------------------

test('CA11: el clic y Enter abren la edición con el mismo texto y foco', () => {
	for (const event of ['click', 'enter']) {
		const next = descripcion.edit_transition({ editing: false, draft: RESUMEN, saved: RESUMEN }, event)
		assert.equal(next.editing, true, event)
		assert.equal(next.draft, RESUMEN, event)
		assert.equal(next.focus, true, event)
	}
})

test('CA11: sin ticket no se puede abrir la edición', () => {
	const next = descripcion.edit_transition({ editing: false, draft: '', saved: '', disabled: true }, 'click')
	assert.equal(next.editing, false)
})

test('CA11: Escape vuelve a lectura y descarta el borrador al valor guardado', () => {
	const next = descripcion.edit_transition({ editing: true, draft: RESUMEN + ' Cambio a medias', saved: RESUMEN }, 'escape')
	assert.equal(next.editing, false)
	assert.equal(next.draft, RESUMEN)
	assert.equal(next.draft_changed, true, 'avisa al padre que el borrador volvió al guardado')
})

test('CA11: blur sin cambios vuelve a lectura', () => {
	const next = descripcion.edit_transition({ editing: true, draft: RESUMEN, saved: RESUMEN }, 'blur')
	assert.equal(next.editing, false)
	assert.equal(next.draft, RESUMEN)
})

test('CA11: blur con cambios deja abierto el textarea para poder tocar Guardar', () => {
	const next = descripcion.edit_transition({ editing: true, draft: RESUMEN + ' Editado', saved: RESUMEN }, 'blur')
	assert.equal(next.editing, true)
	assert.equal(next.draft, RESUMEN + ' Editado')
})

test('CA11: lo guardado se compara sin espacios sobrantes (no cuenta como cambio)', () => {
	const next = descripcion.edit_transition({ editing: true, draft: RESUMEN + '  \n', saved: RESUMEN }, 'blur')
	assert.equal(next.editing, false)
})

test('CA11: un evento desconocido no cambia nada', () => {
	const estado = { editing: true, draft: 'a', saved: 'b' }
	const next = descripcion.edit_transition(estado, 'otra_cosa')
	assert.equal(next.editing, true)
	assert.equal(next.draft, 'a')
})

// ---------------------------------------------------------------------------------------------------------
// CA12: línea de intervención
// ---------------------------------------------------------------------------------------------------------

test('CA12: con needs_human y motivo la línea es «Necesita tu intervención: <motivo>»', () => {
	const ticket = { id: 1, support_attention: { needs_human: true, reason: MOTIVO } }
	assert.equal(descripcion.intervention_line(ticket), 'Necesita tu intervención: ' + MOTIVO)
})

test('CA12: con needs_human sin motivo la línea es sólo «Necesita tu intervención»', () => {
	assert.equal(descripcion.intervention_line({ support_attention: { needs_human: true, reason: '  ' } }), 'Necesita tu intervención')
	assert.equal(descripcion.intervention_line({ support_attention: { needs_human: true } }), 'Necesita tu intervención')
})

test('CA12: con needs_human en false, ausente o sin ticket no se ve nada', () => {
	assert.equal(descripcion.intervention_line({ support_attention: { needs_human: false, reason: MOTIVO } }), '')
	assert.equal(descripcion.intervention_line({ support_attention: null }), '')
	assert.equal(descripcion.intervention_line({}), '')
	assert.equal(descripcion.intervention_line(null), '')
})

test('CA12: needs_human tiene que ser true estricto (un "false" o 0 no enciende el rojo)', () => {
	assert.equal(descripcion.intervention_line({ support_attention: { needs_human: 'false', reason: MOTIVO } }), '')
	assert.equal(descripcion.intervention_line({ support_attention: { needs_human: 0, reason: MOTIVO } }), '')
})

// ---------------------------------------------------------------------------------------------------------
// Cableado de los .vue (leídos como texto: node no compila SFC)
// ---------------------------------------------------------------------------------------------------------

const campo = readFileSync(new URL('../../src/components/support/ConversationHeader/TicketSummaryField.vue', import.meta.url), 'utf8')
const header = readFileSync(new URL('../../src/components/support/ConversationHeader/ConversationHeader.vue', import.meta.url), 'utf8')

test('CA11 (fuente): el campo usa el label, el modo lectura accesible y el textarea sólo al editar', () => {
	assert.match(campo, /<label[^>]*support-ticket-description-label/)
	assert.match(campo, /DESCRIPTION_LABEL/)
	assert.match(campo, /role="button"/)
	assert.match(campo, /tabindex="0"/)
	assert.match(campo, /v-if="editing"/)
	assert.match(campo, /@keydown\.esc/)
	assert.match(campo, /edit_transition/)
	assert.doesNotMatch(campo, /text-danger/, 'el rojo no va en el campo: es de la línea de intervención')
})

test('CA12 (fuente): el header pinta la línea de intervención en text-danger y nada más lleva ese rojo', () => {
	assert.match(header, /intervention_line/)
	const con_rojo = header.split('\n').filter((l) => /text-danger/.test(l))
	assert.ok(con_rojo.length >= 1)
	con_rojo.forEach((l) => assert.match(l, /intervention|support-conversation-intervention/))
})
