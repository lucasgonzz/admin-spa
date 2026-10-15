/**
 * Las etapas del flujo de implementación de un cliente, en un solo lugar.
 *
 * Hasta el 15/10/2026 eran ocho (la 6 era «Capacitación» y la 8 «Videollamada de capacitación»).
 * Desde ese día son SIETE (decisión de Lucas): la 6 pasó a ser «Catálogo: categorías, imágenes y
 * descripciones», la 7 —la vinculación con ARCA/AFIP— es la última y cierra la implementación, y
 * la 8 salió del flujo (el soporte es por WhatsApp; la videollamada existe solo si el cliente la
 * pide).
 *
 * Es el mismo número que `Implementation::ULTIMA_ETAPA` de admin-api. Las implementaciones
 * creadas antes del cambio todavía traen una fila de etapa 8 en `implementation_stages`: la API
 * la deja `pending` (o la marca `skipped` al cerrar) salvo en las que ya estaban en la 8. Estas
 * funciones son lo que evita que esa fila se muestre como una etapa más por hacer.
 */

/**
 * Última etapa del flujo: la 7, vinculación con ARCA/AFIP.
 */
export const ULTIMA_ETAPA = 7

/**
 * Nombre con el que se muestra una etapa posterior a la última (la 8 de las implementaciones
 * anteriores al flujo de siete etapas), sin importar cómo se llame en la configuración: la
 * config puede seguir diciendo «Videollamada de capacitación» o no existir.
 */
export const NOMBRE_DE_LA_ETAPA_HEREDADA = 'Seguimiento'

/**
 * Las etapas de una implementación que se muestran: las del flujo (1 a ULTIMA_ETAPA) y, si la
 * implementación es anterior al flujo de siete etapas, la fila 8 SOLO cuando llegó a arrancar o a
 * cerrarse (status distinto de pending y de skipped). Una fila 8 pendiente o salteada no es una
 * etapa por hacer —la 8 ya no existe—: mostrarla dejaría un «Etapa 8» fantasma al final de todas
 * las implementaciones viejas. Es la misma regla del bloque `etapas` de GET
 * claude/implementations/{id}.
 *
 * @param {Array<Object>|null|undefined} stages Etapas de la implementación (stage_number, status).
 * @returns {Array<Object>} Las que se muestran, en el mismo orden en que vinieron.
 */
export function etapas_visibles(stages) {
  return (stages || []).filter(function (stage) {
    if (stage.stage_number <= ULTIMA_ETAPA) {
      return true
    }

    return stage.status !== 'pending' && stage.status !== 'skipped'
  })
}

/**
 * Nombre a mostrar de una etapa: el de la configuración para las etapas 1 a ULTIMA_ETAPA, y
 * «Seguimiento» para una posterior (la 8 de las implementaciones anteriores).
 *
 * @param {Object|null} stage Etapa con stage_number y, si viene cargada, config.
 * @returns {string} El nombre, o '' si la etapa no tiene config cargada.
 */
export function nombre_de_la_etapa(stage) {
  if (!stage) {
    return ''
  }

  if (stage.stage_number > ULTIMA_ETAPA) {
    return NOMBRE_DE_LA_ETAPA_HEREDADA
  }

  return (stage.config && stage.config.name) || ''
}
