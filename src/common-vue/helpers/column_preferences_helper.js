import api from '@/utils/axios'

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
 * Resuelve qué columnas mostrar: preferencias guardadas del usuario o defaults de meta.
 * Si el usuario nunca guardó desde el modal de columnas, se usan los defaults.
 *
 * @param {string} model_name nombre del recurso (ej. lead, client).
 * @param {Array<Object>} meta_properties propiedades devueltas por meta/fetch_meta.
 * @returns {Promise<Array<Object>>}
 */
export function resolve_props_to_show(model_name, meta_properties) {
  const defaults = build_default_props_to_show_from_meta(meta_properties)

  return api
    .get('/column-preferences/' + model_name)
    .then(function (res) {
      const saved = (res.data && res.data.properties) || []
      if (saved && saved.length) {
        return saved
      }
      return defaults
    })
    .catch(function () {
      return defaults
    })
}
