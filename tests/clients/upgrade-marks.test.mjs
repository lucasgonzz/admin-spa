import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as marks from '../../src/utils/client_upgrade_marks.js'

/**
 * CA13 de la misión martin-descripcion-y-actualizaciones (25/11/2026): clientes que requieren actualización.
 * Contrato C6 del plan (GET/PATCH api/admin/client-upgrade-marks). La lógica es pura y vive en
 * `src/utils/client_upgrade_marks.js`; los .vue (botón del listado, pestaña de la ficha) sólo la usan.
 */

/** Respuesta de ejemplo del GET (§5b C6), con dos clientes y tres marcas. */
function respuesta() {
	return {
		clients: [
			{
				client_id: 12, name: 'Ferretería Sur', company_name: 'Sur SRL', current_version: '4.3.84',
				recomendacion: 'mixta', version_objetivo: '4.3.86',
				marks: [
					{
						id: 5, kind: 'bug', target: 'sistema', source: 'soporte', title: 'No facturaba con ARCA', detail: null,
						support_ticket_id: 177, support_codex_mission_id: 45, external_key: 'mission:45',
						commits: { 'empresa-api': 'a'.repeat(40) }, merged_at: '2026-11-24T10:00:00Z',
						available_version: '4.3.86', available_by: 'tag', estado: 'lista_para_actualizar',
						resolved_at: null, resolved_version: null, resolved_reason: null, created_at: '2026-11-24T10:00:00Z',
					},
					{
						id: 6, kind: 'funcionalidad', target: 'sistema', source: 'claude_code', title: 'Etiquetas por lote', detail: null,
						support_ticket_id: null, support_codex_mission_id: null, external_key: 'cc:etiquetas',
						commits: {}, merged_at: '2026-11-25T10:00:00Z', available_version: null, available_by: null,
						estado: 'falta_release', resolved_at: null, resolved_version: null, resolved_reason: null, created_at: '2026-11-25T10:00:00Z',
					},
				],
			},
			{
				client_id: 30, name: 'Kiosco Norte', company_name: null, current_version: '4.3.80',
				recomendacion: 'tienda_manual', version_objetivo: null,
				marks: [
					{
						id: 9, kind: 'bug', target: 'tienda', source: 'manual', title: 'Carrito sin envío', detail: 'Detalle', support_ticket_id: 150,
						support_codex_mission_id: null, external_key: null, commits: {}, merged_at: '2026-11-20T10:00:00Z',
						available_version: null, available_by: null, estado: 'tienda_manual', resolved_at: null,
						resolved_version: null, resolved_reason: null, created_at: '2026-11-20T10:00:00Z',
					},
				],
			},
		],
		totales: { clientes: 2, marcas: 3, lista_para_actualizar: 1, falta_release: 1, tienda_manual: 1 },
	}
}

// ---------------------------------------------------------------------------------------------------------
// Botón «Requieren actualización (N)» y su filtro
// ---------------------------------------------------------------------------------------------------------

test('CA13: el botón dice «Requieren actualización (N)» con N = totales.clientes', () => {
	assert.equal(marks.chip_label(respuesta().totales), 'Requieren actualización (2)')
	assert.equal(marks.chip_label({ clientes: 1 }), 'Requieren actualización (1)')
})

test('CA13: el botón se ve con clientes marcados, o con el filtro puesto (para poder sacarlo); si no, no', () => {
	assert.equal(marks.chip_visible({ clientes: 2 }, false), true)
	assert.equal(marks.chip_visible({ clientes: 0 }, false), false)
	assert.equal(marks.chip_visible({ clientes: 0 }, true), true)
	assert.equal(marks.chip_visible(null, false), false, 'GET 404: sin totales no aparece')
	assert.equal(marks.chip_visible(undefined, true), false, 'GET 404: ni siquiera con el filtro')
})

test('CA13: el filtro es el checkbox de la columna real requires_upgrade en 1', () => {
	assert.deepEqual(marks.upgrade_filter(), { type: 'checkbox', key: 'requires_upgrade', checkbox: 1 })
	assert.equal(marks.UPGRADE_FILTER_KEY, 'requires_upgrade')
})

test('CA13: se detecta el filtro activo entre otros y no se confunde con checkbox en -1 ni 0', () => {
	const otros = [{ type: 'text', key: 'name', que_contenga: 'sur' }]
	assert.equal(marks.is_upgrade_filter_active(otros), false)
	assert.equal(marks.is_upgrade_filter_active(otros.concat([marks.upgrade_filter()])), true)
	assert.equal(marks.is_upgrade_filter_active([{ type: 'checkbox', key: 'requires_upgrade', checkbox: -1 }]), false)
	assert.equal(marks.is_upgrade_filter_active([{ type: 'checkbox', key: 'requires_upgrade', checkbox: 0 }]), false)
	assert.equal(marks.is_upgrade_filter_active(undefined), false)
})

test('CA13: tocar el botón agrega el filtro y corre la búsqueda, sin pisar los demás filtros', () => {
	const otros = [{ type: 'text', key: 'name', que_contenga: 'sur' }]
	const plan = marks.toggle_upgrade_filter(otros)
	assert.equal(plan.action, 'run')
	assert.equal(plan.filters.length, 2)
	assert.equal(plan.filters[0].key, 'requires_upgrade')
	assert.deepEqual(plan.filters[1], otros[0])
	assert.notEqual(plan.filters, otros, 'no muta el arreglo recibido')
	assert.equal(otros.length, 1)
})

test('CA13: tocarlo de nuevo saca el filtro y, si no queda ninguno, vuelve al listado completo', () => {
	const plan = marks.toggle_upgrade_filter([marks.upgrade_filter()])
	assert.equal(plan.action, 'reset')
	assert.deepEqual(plan.filters, [])
})

test('CA13: tocarlo de nuevo con otros filtros activos los conserva y vuelve a buscar', () => {
	const otros = [{ type: 'text', key: 'name', que_contenga: 'sur' }]
	const plan = marks.toggle_upgrade_filter([marks.upgrade_filter()].concat(otros))
	assert.equal(plan.action, 'run')
	assert.deepEqual(plan.filters, otros)
})

// ---------------------------------------------------------------------------------------------------------
// Respuesta del GET
// ---------------------------------------------------------------------------------------------------------

test('CA13: se normaliza la respuesta del GET y tolera campos ausentes', () => {
	const ok = marks.normalize_marks_response(respuesta())
	assert.equal(ok.clients.length, 2)
	assert.equal(ok.totales.clientes, 2)
	const vacia = marks.normalize_marks_response({})
	assert.deepEqual(vacia.clients, [])
	assert.deepEqual(vacia.totales, { clientes: 0, marcas: 0, lista_para_actualizar: 0, falta_release: 0, tienda_manual: 0 })
	assert.deepEqual(marks.normalize_marks_response(null).clients, [])
})

test('CA13: un 404 del admin viejo se reconoce como «no disponible»', () => {
	assert.equal(marks.is_unavailable_error({ response: { status: 404 } }), true)
	assert.equal(marks.is_unavailable_error({ response: { status: 500 } }), false)
	assert.equal(marks.is_unavailable_error(new Error('red')), false)
})

// ---------------------------------------------------------------------------------------------------------
// Pestaña «Actualización» de la ficha
// ---------------------------------------------------------------------------------------------------------

test('CA13: las filas de la pestaña traen motivo, ticket, estado legible y versión objetivo', () => {
	const rows = marks.rows_for_client(respuesta(), 12)
	assert.equal(rows.length, 2)
	assert.deepEqual(
		{ id: rows[0].id, title: rows[0].title, ticket: rows[0].ticket_label, ticket_id: rows[0].support_ticket_id, estado: rows[0].estado, estado_label: rows[0].estado_label, kind_label: rows[0].kind_label, version: rows[0].version_label },
		{ id: 5, title: 'No facturaba con ARCA', ticket: 'Ticket #177', ticket_id: 177, estado: 'lista_para_actualizar', estado_label: 'Lista para actualizar', kind_label: 'Corrección', version: 'Versión 4.3.86' }
	)
	assert.equal(rows[1].estado_label, 'Falta sacar release')
	assert.equal(rows[1].kind_label, 'Funcionalidad')
	assert.equal(rows[1].ticket_label, '')
	assert.equal(rows[1].support_ticket_id, null)
	assert.equal(rows[1].version_label, '')
})

test('CA13: una marca de tienda se muestra como «Tienda: se actualiza a mano»', () => {
	const rows = marks.rows_for_client(respuesta(), 30)
	assert.equal(rows[0].estado_label, 'Tienda: se actualiza a mano')
})

test('CA13: un cliente sin marcas (o desconocido) da una lista vacía', () => {
	assert.deepEqual(marks.rows_for_client(respuesta(), 999), [])
	assert.deepEqual(marks.rows_for_client(null, 12), [])
})

test('CA13: el resumen del cliente dice versión actual y la recomendación', () => {
	const resumen = marks.client_summary(respuesta(), 12)
	assert.equal(resumen.current_version, '4.3.84')
	assert.equal(resumen.version_objetivo, '4.3.86')
	assert.equal(resumen.recomendacion_label, 'Actualizar a la 4.3.86 (y falta sacar un release)')
	assert.equal(marks.client_summary(respuesta(), 30).recomendacion_label, 'Actualizar a mano en la tienda')
	assert.equal(marks.client_summary(respuesta(), 999), null)
})

test('CA13: «Marcar resuelta» arma el PATCH manual y saca la marca de la lista', () => {
	const req = marks.resolve_request(5)
	assert.deepEqual(req, { url: 'client-upgrade-marks/5/resolve', body: { reason: 'manual' } })
	const antes = respuesta()
	const despues = marks.without_mark(antes, 5)
	assert.deepEqual(marks.rows_for_client(despues, 12).map((r) => r.id), [6])
	assert.equal(despues.totales.marcas, 2)
	assert.equal(despues.totales.lista_para_actualizar, 0)
	assert.equal(despues.totales.clientes, 2)
	assert.equal(marks.rows_for_client(antes, 12).length, 2, 'no muta la respuesta original')
})

test('CA13: al resolver la última marca de un cliente, el cliente sale del conteo', () => {
	const despues = marks.without_mark(respuesta(), 9)
	assert.equal(marks.rows_for_client(despues, 30).length, 0)
	assert.equal(despues.totales.clientes, 1)
	assert.equal(despues.totales.tienda_manual, 0)
	assert.equal(despues.clients.some((c) => c.client_id === 30), false)
})

// ---------------------------------------------------------------------------------------------------------
// Cableado de los .vue (leídos como texto)
// ---------------------------------------------------------------------------------------------------------

const clients_view = readFileSync(new URL('../../src/views/Clients.vue', import.meta.url), 'utf8')
const chip = readFileSync(new URL('../../src/components/client/upgrade-marks/ToolbarChip.vue', import.meta.url), 'utf8')
const tab = readFileSync(new URL('../../src/components/client/upgrade-marks/Index.vue', import.meta.url), 'utf8')

test('CA13 (fuente): Clients.vue monta el botón en #toolbar-right y la pestaña «Actualización»', () => {
	assert.match(clients_view, /#toolbar-right/)
	assert.match(clients_view, /upgrade-marks-toolbar-chip|UpgradeMarksToolbarChip/)
	assert.match(clients_view, /key: 'actualizacion'/)
	assert.match(clients_view, /label: 'Actualización'/)
})

test('CA13 (fuente): el botón usa el store del cliente (filtros y búsqueda) y el GET con silent_error', () => {
	assert.match(chip, /toggle_upgrade_filter/)
	assert.match(chip, /client\/(set_filters|run_filter)|'client'/)
	assert.match(chip, /silent_error/)
	assert.match(chip, /client-upgrade-marks/)
})

test('CA13 (fuente): la pestaña hace el PATCH con resolve_request', () => {
	assert.match(tab, /resolve_request/)
	assert.match(tab, /Marcar resuelta/)
	assert.match(tab, /api\.patch/)
})
