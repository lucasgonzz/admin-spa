/**
 * Llamadas de la Agenda a admin-api (misión agenda-admin, 31/10/2026).
 *
 * Una función por ruta del contrato del panel (plan de la misión, "Contrato del panel"), todas
 * sobre el cliente `api` del proyecto (base `/api/admin`, token Sanctum). Cada una devuelve la
 * promesa de axios tal cual: el que llama decide qué hacer con `response.data`.
 *
 * Sobre los errores: el interceptor de `utils/axios.js` tira una toast con el mensaje de la API
 * (los 422 vienen en criollo desde el servidor). Las funciones aceptan `opciones` para pasarle
 * `silent_error` / `silent_error_statuses` cuando el que llama prefiere avisar él: el listado
 * (que se repite solo) y las operaciones masivas de la selección múltiple, que avisan una sola
 * vez cuántas fallaron en vez de tirar una toast por tarea.
 */
import api from '@/utils/axios'

/**
 * Arma la config de axios con las opciones de silencio que pidió el que llama.
 *
 * @param {Object} [opciones] `{ silent_error?: boolean, silent_error_statuses?: number[] }`
 * @returns {Object} Config para axios.
 */
function config_con(opciones) {
  const config = {}
  if (opciones && opciones.silent_error) {
    config.silent_error = true
  }
  if (opciones && Array.isArray(opciones.silent_error_statuses)) {
    config.silent_error_statuses = opciones.silent_error_statuses
  }
  return config
}

/**
 * Trae las ocurrencias de un rango de fechas y la bandeja.
 *
 * GET agenda?desde=&hasta= → `{ desde, hasta, hoy, ocurrencias: [tarea…], bandeja: [tarea…] }`.
 * El rango no puede pasar de 100 días (la API responde 422).
 *
 * @param {string} desde `YYYY-MM-DD`
 * @param {string} hasta `YYYY-MM-DD`
 * @param {Object} [opciones]
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export function listar_agenda(desde, hasta, opciones) {
  const config = config_con(opciones)
  config.params = { desde: desde, hasta: hasta }
  return api.get('/agenda', config)
}

/**
 * Trae una tarea sola, sin expandir (su `occurrence_date` es su `date` base).
 *
 * GET agenda/{id} → `{ model }`.
 *
 * @param {number} id
 * @param {Object} [opciones]
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export function obtener_tarea(id, opciones) {
  return api.get('/agenda/' + id, config_con(opciones))
}

/**
 * Crea una tarea.
 *
 * POST agenda → 201 `{ model }`. Body: `title` (obligatorio), `notes`, `date` (o null = bandeja),
 * `start_time`, `all_day`, `duration_minutes`, `color`, `icon`, `repeat`, `repeat_until`,
 * `subtasks` (array de `{ title, done }`).
 *
 * @param {Object} datos
 * @param {Object} [opciones]
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export function crear_tarea(datos, opciones) {
  return api.post('/agenda', datos, config_con(opciones))
}

/**
 * Edita una tarea (parcial: solo viajan los campos que cambian). Mover de fecha u hora, pasar a la
 * bandeja (`date: null`) y reemplazar los subpasos (`subtasks` con `{ id?, title, done }`) son
 * todos este mismo PUT. En una repetida edita la serie entera.
 *
 * PUT agenda/{id} → `{ model }`.
 *
 * @param {number} id
 * @param {Object} datos
 * @param {Object} [opciones]
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export function actualizar_tarea(id, datos, opciones) {
  return api.put('/agenda/' + id, datos, config_con(opciones))
}

/**
 * Borra una tarea con sus subpasos (en una repetida, la serie entera).
 *
 * DELETE agenda/{id} → `{ deleted: true, id }`.
 *
 * @param {number} id
 * @param {Object} [opciones]
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export function borrar_tarea(id, opciones) {
  return api.delete('/agenda/' + id, config_con(opciones))
}

/**
 * Arma el body de completar / descompletar: la fecha de la ocurrencia viaja solo en las
 * repetidas (ahí es obligatoria; en una simple no hace falta).
 *
 * @param {Object} tarea Tarea u ocurrencia con la forma de la API.
 * @returns {Object}
 */
function body_de_ocurrencia(tarea) {
  if (tarea.is_recurring && tarea.occurrence_date) {
    return { date: tarea.occurrence_date }
  }
  return {}
}

/**
 * Marca hecha una tarea (o una ocurrencia de una repetida). Idempotente.
 *
 * POST agenda/{id}/complete `{ date? }` → `{ model }`.
 *
 * @param {Object} tarea Tarea u ocurrencia (se usan `id`, `is_recurring` y `occurrence_date`).
 * @param {Object} [opciones]
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export function completar_tarea(tarea, opciones) {
  return api.post('/agenda/' + tarea.id + '/complete', body_de_ocurrencia(tarea), config_con(opciones))
}

/**
 * Desmarca una tarea (o una ocurrencia). Idempotente.
 *
 * POST agenda/{id}/uncomplete `{ date? }` → `{ model }`.
 *
 * @param {Object} tarea
 * @param {Object} [opciones]
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export function descompletar_tarea(tarea, opciones) {
  return api.post(
    '/agenda/' + tarea.id + '/uncomplete',
    body_de_ocurrencia(tarea),
    config_con(opciones)
  )
}

/**
 * Duplica una tarea (mismo título, subpasos sin marcar, no hecha).
 *
 * POST agenda/{id}/duplicate → 201 `{ model }`.
 *
 * @param {number} id
 * @param {Object} [opciones]
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export function duplicar_tarea(id, opciones) {
  return api.post('/agenda/' + id + '/duplicate', {}, config_con(opciones))
}

/**
 * Edita un subpaso suelto (en la práctica, marcarlo / desmarcarlo sin tocar el resto).
 *
 * PUT agenda/{id}/subtasks/{subtask_id} `{ title?, done? }` → `{ model: tarea }`.
 *
 * @param {number} id Id de la tarea.
 * @param {number} subtask_id Id del subpaso.
 * @param {Object} datos
 * @param {Object} [opciones]
 * @returns {Promise<import('axios').AxiosResponse>}
 */
export function actualizar_subpaso(id, subtask_id, datos, opciones) {
  return api.put('/agenda/' + id + '/subtasks/' + subtask_id, datos, config_con(opciones))
}

/**
 * Indica si un error de axios es el de "esta ruta no existe en el servidor" (SPA nuevo contra API
 * vieja, sin desplegar): 404 o 405 en una ruta de la agenda.
 *
 * Ojo: un 404 de `agenda/{id}` también es "la tarea es de otro admin o se borró"; por eso el que
 * llama solo lo trata como API vieja cuando falla el LISTADO (que no tiene id).
 *
 * @param {*} error
 * @returns {boolean}
 */
export function es_api_no_disponible(error) {
  const status = error && error.response ? error.response.status : null
  return status === 404 || status === 405
}

/**
 * Status HTTP de un error de axios (null si no hubo respuesta).
 *
 * @param {*} error
 * @returns {number|null}
 */
export function status_de(error) {
  return error && error.response ? error.response.status : null
}
