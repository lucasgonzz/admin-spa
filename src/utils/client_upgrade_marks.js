/**
 * Clientes que requieren actualización (misión martin-descripcion-y-actualizaciones, 25/11/2026).
 *
 * admin-api marca a un cliente cuando hay algo ya integrado (una corrección de soporte o una funcionalidad
 * mergeada) que todavía no tiene instalado. Contrato C6 del plan:
 *   GET   client-upgrade-marks?estado=abiertas|resueltas|todas&client_id=N   → {clients: [...], totales: {...}}
 *   PATCH client-upgrade-marks/{id}/resolve   {reason: 'manual'|'descartada', note?}
 *   GET   client                              → cada fila trae `requires_upgrade` (columna checkbox filtrable)
 *
 * Funciones puras (sin Vue ni red) para probarlas con `node --test`; el botón del listado y la pestaña de la
 * ficha sólo las usan.
 */

/** Clave de la columna del listado de clientes que refleja «hay marcas abiertas». */
export const UPGRADE_FILTER_KEY = 'requires_upgrade'

/** Evento de window que avisa que cambió alguna marca (lo escucha el botón para recontar). */
export const UPGRADE_MARKS_CHANGED_EVENT = 'client-upgrade-marks-changed'

/** Totales vacíos, con la forma que manda admin-api. */
function empty_totals() {
	return { clientes: 0, marcas: 0, lista_para_actualizar: 0, falta_release: 0, tienda_manual: 0 }
}

/** Texto legible de cada estado de una marca. */
const ESTADO_LABELS = {
	lista_para_actualizar: 'Lista para actualizar',
	falta_release: 'Falta sacar release',
	tienda_manual: 'Tienda: se actualiza a mano',
	resuelta: 'Resuelta',
}

/**
 * Texto de un estado de marca (si llega uno desconocido, se muestra tal cual para no esconderlo).
 *
 * @param {string} estado lista_para_actualizar | falta_release | tienda_manual | resuelta
 * @returns {string}
 */
export function estado_label(estado) {
	return Object.prototype.hasOwnProperty.call(ESTADO_LABELS, estado) ? ESTADO_LABELS[estado] : String(estado || '')
}

/**
 * Texto del botón del listado: «Requieren actualización (N)», con N = clientes marcados.
 *
 * @param {{clientes: number}|null} totales Totales del GET
 * @returns {string}
 */
export function chip_label(totales) {
	const n = totales && Number(totales.clientes) > 0 ? Number(totales.clientes) : 0
	return 'Requieren actualización (' + n + ')'
}

/**
 * El botón se muestra si hay clientes marcados, o si el filtro está puesto (para poder sacarlo aunque ya
 * no quede ninguno). Sin totales (el admin viejo contestó 404) no se muestra nunca.
 *
 * @param {{clientes: number}|null|undefined} totales Totales del GET; null si no está disponible
 * @param {boolean} filter_active Si el filtro de clientes está puesto
 * @returns {boolean}
 */
export function chip_visible(totales, filter_active) {
	if (!totales) {
		return false
	}
	return Number(totales.clientes) > 0 || !!filter_active
}

/**
 * Criterio de filtro que entiende `POST search/client/null/1` (mismo payload que arma el modal de columna).
 *
 * @returns {{type: string, key: string, checkbox: number}}
 */
export function upgrade_filter() {
	return { type: 'checkbox', key: UPGRADE_FILTER_KEY, checkbox: 1 }
}

/**
 * Si entre los filtros del listado está el de «requiere actualización» en Sí.
 *
 * @param {Array<Object>|undefined} filters Filtros del store de clientes
 * @returns {boolean}
 */
export function is_upgrade_filter_active(filters) {
	return (filters || []).some(function (f) {
		return f && f.key === UPGRADE_FILTER_KEY && Number(f.checkbox) === 1
	})
}

/**
 * Qué hacer al tocar el botón: si el filtro no está, lo agrega (adelante, como el store) y busca; si está,
 * lo saca y busca con los demás o, si no queda ninguno, vuelve al listado completo.
 *
 * @param {Array<Object>|undefined} filters Filtros actuales (no se modifica)
 * @returns {{filters: Array<Object>, action: string}} action: 'run' (buscar) | 'reset' (listado completo)
 */
export function toggle_upgrade_filter(filters) {
	const current = filters || []
	if (is_upgrade_filter_active(current)) {
		const rest = current.filter(function (f) {
			return !(f && f.key === UPGRADE_FILTER_KEY)
		})
		return { filters: rest, action: rest.length > 0 ? 'run' : 'reset' }
	}
	const others = current.filter(function (f) {
		return !(f && f.key === UPGRADE_FILTER_KEY)
	})
	return { filters: [upgrade_filter()].concat(others), action: 'run' }
}

/**
 * Normaliza la respuesta del GET: tolera campos ausentes para que la vista no rompa con un admin a medias.
 *
 * @param {Object|null} data Cuerpo de la respuesta
 * @returns {{clients: Array<Object>, totales: Object}}
 */
export function normalize_marks_response(data) {
	const body = data && typeof data === 'object' ? data : {}
	return {
		clients: Array.isArray(body.clients) ? body.clients : [],
		totales: Object.assign(empty_totals(), body.totales || {}),
	}
}

/**
 * El admin todavía no tiene las rutas de marcas (404): el botón no aparece y la pestaña avisa «No disponible».
 *
 * @param {Object} error Error de axios
 * @returns {boolean}
 */
export function is_unavailable_error(error) {
	return !!(error && error.response && error.response.status === 404)
}

/**
 * Cliente de la respuesta por id.
 *
 * @param {Object|null} data Respuesta normalizada o cruda
 * @param {number} client_id Id del cliente
 * @returns {Object|null}
 */
function find_client(data, client_id) {
	const list = normalize_marks_response(data).clients
	const found = list.filter(function (c) {
		return Number(c.client_id) === Number(client_id)
	})
	return found.length ? found[0] : null
}

/**
 * Filas de la pestaña «Actualización» de un cliente: motivo, ticket, estado y versión objetivo.
 *
 * @param {Object|null} data Respuesta del GET
 * @param {number} client_id Id del cliente
 * @returns {Array<Object>}
 */
export function rows_for_client(data, client_id) {
	const client = find_client(data, client_id)
	if (!client || !Array.isArray(client.marks)) {
		return []
	}
	return client.marks.map(function (m) {
		const ticket_id = m.support_ticket_id == null ? null : Number(m.support_ticket_id)
		return {
			id: m.id,
			title: m.title,
			detail: m.detail || '',
			kind_label: m.kind === 'bug' ? 'Corrección' : 'Funcionalidad',
			support_ticket_id: ticket_id,
			ticket_label: ticket_id ? 'Ticket #' + ticket_id : '',
			estado: m.estado,
			estado_label: estado_label(m.estado),
			version_label: m.available_version ? 'Versión ' + m.available_version : '',
		}
	})
}

/**
 * Recomendación en una frase para la cabecera de la pestaña.
 *
 * @param {string} recomendacion actualizar | falta_release | mixta | tienda_manual
 * @param {string|null} version_objetivo Última versión publicada que cubre las marcas listas
 * @returns {string}
 */
function recommendation_label(recomendacion, version_objetivo) {
	const target = version_objetivo ? ' a la ' + version_objetivo : ''
	if (recomendacion === 'actualizar') {
		return 'Actualizar' + target
	}
	if (recomendacion === 'mixta') {
		return 'Actualizar' + target + ' (y falta sacar un release)'
	}
	if (recomendacion === 'falta_release') {
		return 'Falta sacar un release'
	}
	if (recomendacion === 'tienda_manual') {
		return 'Actualizar a mano en la tienda'
	}
	return ''
}

/**
 * Cabecera de la pestaña: versión instalada, versión objetivo y recomendación.
 *
 * @param {Object|null} data Respuesta del GET
 * @param {number} client_id Id del cliente
 * @returns {{current_version: string, version_objetivo: string, recomendacion_label: string}|null} null si el
 *   cliente no tiene marcas abiertas
 */
export function client_summary(data, client_id) {
	const client = find_client(data, client_id)
	if (!client) {
		return null
	}
	return {
		current_version: client.current_version || '',
		version_objetivo: client.version_objetivo || '',
		recomendacion_label: recommendation_label(client.recomendacion, client.version_objetivo),
	}
}

/**
 * Pedido de «Marcar resuelta»: PATCH manual (el criterio automático es instalar la versión).
 *
 * @param {number} mark_id Id de la marca
 * @returns {{url: string, body: {reason: string}}}
 */
export function resolve_request(mark_id) {
	return { url: 'client-upgrade-marks/' + mark_id + '/resolve', body: { reason: 'manual' } }
}

/**
 * Recomendación de un cliente según las marcas que le quedan (mismas reglas que admin-api).
 *
 * @param {Array<Object>} marks Marcas abiertas restantes
 * @returns {string}
 */
function recommendation_from_marks(marks) {
	const has_ready = marks.some(function (m) { return m.estado === 'lista_para_actualizar' })
	const has_missing = marks.some(function (m) { return m.estado === 'falta_release' })
	if (has_ready && has_missing) {
		return 'mixta'
	}
	if (has_ready) {
		return 'actualizar'
	}
	if (has_missing) {
		return 'falta_release'
	}
	return 'tienda_manual'
}

/**
 * Respuesta del GET sin una marca (después de resolverla), con totales y recomendación recalculados.
 * No modifica la original.
 *
 * @param {Object|null} data Respuesta del GET
 * @param {number} mark_id Id de la marca resuelta
 * @returns {{clients: Array<Object>, totales: Object}}
 */
export function without_mark(data, mark_id) {
	const base = normalize_marks_response(data)
	const clients = []
	base.clients.forEach(function (client) {
		const marks = (client.marks || []).filter(function (m) {
			return Number(m.id) !== Number(mark_id)
		})
		if (marks.length === 0) {
			return
		}
		const ready = marks.some(function (m) { return m.estado === 'lista_para_actualizar' })
		clients.push(Object.assign({}, client, {
			marks: marks,
			recomendacion: recommendation_from_marks(marks),
			version_objetivo: ready ? client.version_objetivo || null : null,
		}))
	})
	const totales = empty_totals()
	totales.clientes = clients.length
	clients.forEach(function (client) {
		client.marks.forEach(function (m) {
			totales.marcas += 1
			if (Object.prototype.hasOwnProperty.call(totales, m.estado)) {
				totales[m.estado] += 1
			}
		})
	})
	return { clients: clients, totales: totales }
}
