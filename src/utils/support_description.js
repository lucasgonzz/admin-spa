/**
 * Descripción del ticket de soporte y línea de intervención (misión martin-descripcion-y-actualizaciones,
 * 25/11/2026).
 *
 * La descripción es `support_tickets.summary`: Martín la reescribe en cada respuesta y en el header se ve como
 * texto, con el label «Descripción»; sólo se convierte en textarea si Lucas le hace clic. Debajo, cuando el
 * ticket necesita a Lucas (`support_attention.needs_human`), va una línea en rojo con el motivo.
 *
 * Funciones puras (sin Vue ni red) para poder probarlas con `node --test`; los componentes sólo las pintan.
 */

import { ticket_summary } from './support_ticket_title.js'

/** Label visible del campo (antes sólo tenía aria-label). */
export const DESCRIPTION_LABEL = 'Descripción'

/** Texto gris que se ve cuando el ticket todavía no tiene descripción. */
export const DESCRIPTION_PLACEHOLDER = 'Sin descripción todavía'

/** Prefijo de la línea roja; el motivo (si hay) va después de los dos puntos. */
export const INTERVENTION_PREFIX = 'Necesita tu intervención'

/**
 * Descripción guardada del ticket, sin espacios sobrantes; vacía si no tiene.
 *
 * @param {Object|null} ticket Ticket del panel (`summary`)
 * @returns {string}
 */
export function description_text(ticket) {
	return ticket_summary(ticket)
}

/**
 * Qué mostrar en modo lectura: el texto del borrador o, si está vacío, el placeholder.
 *
 * @param {string|null} draft Borrador actual (el padre lo mantiene igual al guardado hasta que Lucas edita)
 * @returns {{text: string, is_placeholder: boolean}}
 */
export function description_display(draft) {
	const text = draft == null ? '' : String(draft)
	if (text.trim() === '') {
		return { text: DESCRIPTION_PLACEHOLDER, is_placeholder: true }
	}
	return { text: text, is_placeholder: false }
}

/**
 * Transición del campo entre lectura y edición.
 *
 * - `click` / `enter`: abre la edición (con foco) salvo que esté deshabilitado (sin ticket).
 * - `escape`: vuelve a lectura y descarta el borrador al valor guardado (`draft_changed` avisa al padre).
 * - `blur`: sin cambios vuelve a lectura; con cambios queda abierto para que Lucas pueda tocar Guardar
 *   (al tocarlo el textarea pierde el foco y, si se cerrara solo, el clic podría caer fuera del botón).
 *
 * @param {{editing: boolean, draft: string, saved: string, disabled?: boolean}} state Estado actual
 * @param {string} event click | enter | escape | blur
 * @returns {{editing: boolean, draft: string, focus: boolean, draft_changed: boolean}}
 */
export function edit_transition(state, event) {
	const draft = state.draft == null ? '' : String(state.draft)
	const saved = state.saved == null ? '' : String(state.saved)
	const unchanged = draft.trim() === saved.trim()
	const keep = { editing: !!state.editing, draft: draft, focus: false, draft_changed: false }

	if (event === 'click' || event === 'enter') {
		if (state.disabled || state.editing) {
			return keep
		}
		return { editing: true, draft: draft, focus: true, draft_changed: false }
	}
	if (event === 'escape') {
		if (!state.editing) {
			return keep
		}
		return { editing: false, draft: saved, focus: false, draft_changed: draft !== saved }
	}
	if (event === 'blur') {
		if (state.editing && unchanged) {
			return { editing: false, draft: draft, focus: false, draft_changed: false }
		}
		return keep
	}
	return keep
}

/**
 * Línea roja del header: «Necesita tu intervención: <motivo>». Vacía si el ticket no necesita a Lucas.
 * `needs_human` tiene que ser `true` estricto (lo calcula admin-api; un valor raro no enciende el rojo).
 *
 * @param {Object|null} ticket Ticket del panel (`support_attention.{needs_human, reason}`)
 * @returns {string}
 */
export function intervention_line(ticket) {
	const attention = ticket && ticket.support_attention ? ticket.support_attention : null
	if (!attention || attention.needs_human !== true) {
		return ''
	}
	const reason = attention.reason == null ? '' : String(attention.reason).trim()
	return reason === '' ? INTERVENTION_PREFIX : INTERVENTION_PREFIX + ': ' + reason
}
