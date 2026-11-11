/**
 * Categorías de la ficha de soporte del cliente (misión ficha-del-cliente, 11/11/2026).
 *
 * El orden es el mismo con el que admin-api arma el bloque `ficha_cliente` que le llega a Martín:
 * compromisos y decisiones primero (lo que no se puede olvidar), después problemas, preferencias,
 * implementación, negocio y otro. Las claves son las de la columna
 * `client_support_memory_entries.categoria`.
 */
import moment from 'moment'
import { resolve_error_message } from '@/utils/axios'

export const CATEGORIAS = [
	{ key: 'compromiso', label: 'Compromisos', singular: 'Compromiso', icon: 'calendar-check', ayuda: 'Algo con fecha: «el lunes 17 arrancamos la carga». Poné el vencimiento.' },
	{ key: 'decision', label: 'Decisiones', singular: 'Decisión', icon: 'signpost-split', ayuda: 'Un acuerdo: «los precios van a la lista Mayorista».' },
	{ key: 'problema', label: 'Problemas', singular: 'Problema', icon: 'bug', ayuda: 'Qué pasó, la causa y la solución, en una línea.' },
	{ key: 'preferencia', label: 'Preferencias', singular: 'Preferencia', icon: 'heart', ayuda: 'Cómo quiere que lo atiendan: «los avisos al número de Gastón».' },
	{ key: 'implementacion', label: 'Implementación', singular: 'Implementación', icon: 'gear', ayuda: 'Algo de la implementación que no está en el admin.' },
	{ key: 'negocio', label: 'Negocio', singular: 'Negocio', icon: 'shop', ayuda: 'Cómo trabaja: fía, factura A, tiene dos sucursales.' },
	{ key: 'otro', label: 'Otro', singular: 'Otro', icon: 'three-dots', ayuda: 'Lo que no entra en las otras.' },
]

/** Tope de entradas vigentes por cliente (la 61 la rechaza admin-api con `ficha_llena`). */
export const TOPE_VIGENTES = 60

/** Largo máximo del texto de una entrada (columna string(600)). */
export const TEXTO_MAX = 600

/** Largo máximo del motivo de baja (columna archived_reason string(300)). */
export const MOTIVO_MAX = 300

/**
 * Datos de una categoría por su clave; una clave desconocida cae en «Otro».
 *
 * @param {string} key
 * @returns {{key: string, label: string, singular: string, icon: string, ayuda: string}}
 */
export function categoria_de(key) {
	const encontrada = CATEGORIAS.find(function (c) {
		return c.key === key
	})
	return encontrada || CATEGORIAS[CATEGORIAS.length - 1]
}

/**
 * Quién escribió la entrada: Martín (el agente de soporte) o Lucas (desde el panel o la API).
 * Si el backend manda el nombre del admin, se usa ese.
 *
 * @param {Object} entrada
 * @returns {string}
 */
export function autor_de(entrada) {
	if (!entrada) {
		return ''
	}
	if (entrada.source === 'martin') {
		return 'Martín'
	}
	const admin = entrada.admin || null
	const nombre_admin = entrada.admin_name || (admin && admin.name) || ''
	if (String(nombre_admin).trim() !== '') {
		return String(nombre_admin).trim()
	}
	return 'Lucas'
}

/**
 * Fecha corta dd/mm/aaaa; vacío si no hay fecha válida.
 *
 * @param {string|null} valor
 * @returns {string}
 */
export function fecha_corta(valor) {
	if (!valor) {
		return ''
	}
	const m = moment(valor)
	return m.isValid() ? m.format('DD/MM/YYYY') : ''
}

/**
 * Fecha y hora dd/mm/aaaa hh:mm; vacío si no hay fecha válida.
 *
 * @param {string|null} valor
 * @returns {string}
 */
export function fecha_hora(valor) {
	if (!valor) {
		return ''
	}
	const m = moment(valor)
	return m.isValid() ? m.format('DD/MM/YYYY HH:mm') : ''
}

/**
 * true si la entrada tiene vencimiento y ya pasó. Respeta el `vencida` que calcula admin-api
 * cuando viene; si no viene, lo calcula contra el día de hoy.
 *
 * @param {Object} entrada
 * @returns {boolean}
 */
export function esta_vencida(entrada) {
	if (!entrada || !entrada.vigente_hasta) {
		return false
	}
	if (entrada.vencida === true || entrada.vencida === false) {
		return entrada.vencida
	}
	return moment(fecha_para_input(entrada.vigente_hasta), 'YYYY-MM-DD').isBefore(moment(), 'day')
}

/**
 * Una fecha sin hora (`vigente_hasta`) en dd/mm/aaaa. Se lee solo AAAA-MM-DD: Laravel la manda
 * como medianoche UTC y, pasada a la hora de Argentina, caería el día anterior.
 *
 * @param {string|null} valor
 * @returns {string}
 */
export function fecha_sin_hora(valor) {
	const dia = fecha_para_input(valor)
	if (!dia) {
		return ''
	}
	const m = moment(dia, 'YYYY-MM-DD')
	return m.isValid() ? m.format('DD/MM/YYYY') : ''
}

/**
 * Solo la parte AAAA-MM-DD de una fecha, para el input type=date.
 *
 * @param {string|null} valor
 * @returns {string}
 */
export function fecha_para_input(valor) {
	if (!valor) {
		return ''
	}
	return String(valor).substring(0, 10)
}

/**
 * Mensaje de error para mostrar en la ficha. Los rechazos propios de la ficha llegan como
 * `{error: "dato_sensible", message: "dato_sensible: El texto…"}`: el código es para Martín, así
 * que acá se saca del principio y queda solo la explicación.
 *
 * @param {Error} err
 * @returns {string}
 */
export function error_legible(err) {
	const mensaje = resolve_error_message(err)
	const cuerpo = err && err.response && err.response.data ? err.response.data : {}
	const codigo = typeof cuerpo.error === 'string' ? cuerpo.error : ''
	if (codigo !== '' && mensaje.indexOf(codigo + ': ') === 0) {
		return mensaje.slice(codigo.length + 2)
	}
	return mensaje
}
