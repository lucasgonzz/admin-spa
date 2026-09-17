import { cached_get, MAX_AGE_SESION } from './request_cache_helper'

/**
 * Construye la configuración inicial de columnas visibles desde meta (ModelProperties).
 * Solo incluye columnas marcadas como visibles por defecto en el backend.
 *
 * @param {Array<Object>} meta_properties propiedades devueltas por meta/fetch_meta.
 * @returns {Array<Object>}
 */
export function build_default_props_to_show_from_meta(meta_properties) {
  const props = meta_properties || []
  return props.filter(function (p) {
    return p.show && !p.not_show_on_table && !(p.group_title && !p.key)
  })
}

/**
 * Copia superficial de cada fila guardada.
 *
 * El array cacheado se entrega a más de un consumidor y termina adentro del store, donde Vue lo
 * envuelve en un proxy reactivo: sin esta copia, el modal de columnas editando una fila estaría
 * escribiendo sobre lo que el caché le va a devolver al próximo que pregunte.
 *
 * @param {Array<Object>} rows
 * @returns {Array<Object>}
 */
function clone_rows(rows) {
  return rows.map(function (row) {
    return Object.assign({}, row)
  })
}

/**
 * Resuelve qué columnas mostrar: preferencias guardadas del usuario o defaults de meta.
 * Si el usuario nunca guardó desde el modal de columnas, se usan los defaults.
 *
 * Las preferencias se piden una sola vez por modelo y por sesión: son del operador logueado y
 * solo cambian cuando él mismo las guarda, y ese `PUT /column-preferences/{model}` invalida la
 * entrada por el interceptor de `request_cache_helper`. Antes salía una request por cada montaje
 * de cada listado, siempre con la misma respuesta.
 *
 * @param {string} model_name nombre del recurso (ej. lead, client).
 * @param {Array<Object>} meta_properties propiedades devueltas por meta/fetch_meta.
 * @returns {Promise<Array<Object>>}
 */
export function resolve_props_to_show(model_name, meta_properties) {
  const defaults = build_default_props_to_show_from_meta(meta_properties)

  return cached_get('/column-preferences/' + model_name, { max_age_ms: MAX_AGE_SESION })
    .then(function (data) {
      const saved = (data && data.properties) || []
      if (saved && saved.length) {
        return clone_rows(saved)
      }
      return defaults
    })
    .catch(function () {
      return defaults
    })
}
