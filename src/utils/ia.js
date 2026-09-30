/**
 * Nombres humanos de la IA que informa cada cliente (misión proveedores-ia-deepseek, 22/9/2026).
 *
 * Es UN solo mapa para las dos pantallas que lo muestran —la solapa Tokens de la ficha del
 * cliente y la vista global /tokens— para que las dos digan lo mismo y que sumar un proveedor sea
 * tocar una línea, no dos. Los ids son los que viajan en el contrato del `empresa-api`
 * (`anthropic`, `deepseek`, `openai`; `agil`, `equilibrado`, `profundo`): acá se traducen, nunca
 * se corrigen.
 */

/** Nombre con el que se muestra cada proveedor. `anthropic` se muestra como el producto, "Claude". */
export const NOMBRES_DE_PROVEEDOR = {
  anthropic: 'Claude',
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
}

/** Nombre con el que se muestra cada nivel de pensamiento del asistente. */
export const NOMBRES_DE_PENSAMIENTO = {
  agil: 'Ágil',
  equilibrado: 'Equilibrado',
  profundo: 'Profundo',
}

/**
 * Nombre con el que se muestra cada opción de modelo del catálogo del `empresa-api` (misión
 * modelos-ia-por-cliente, 30/9/2026). Los ids son los del contrato de `admin-sync/modelos-ia`
 * (`opciones[].id`, `tareas.<tarea>.opcion`). El cliente también manda su propio `nombre` por
 * opción: este mapa manda cuando conoce el id, para que el admin diga lo mismo en todas las
 * pantallas aunque el texto del cliente cambie de una versión a otra.
 */
export const NOMBRES_DE_OPCION = {
  deepseek_flash: 'DeepSeek Flash',
  deepseek_pro: 'DeepSeek Pro',
  claude_haiku: 'Claude Haiku',
  claude_sonnet: 'Claude Sonnet',
  claude_opus: 'Claude Opus',
}

/**
 * Nombre humano de una opción de modelo. Una opción que no está en el mapa se muestra con el
 * nombre que mandó el cliente, y si tampoco hay, tal cual llegó el id (mismo criterio que
 * `nombre_proveedor`: nunca esconderla ni inventarle un nombre).
 *
 * @param {string|null} opcion - Id de la opción tal como lo informó el cliente.
 * @param {string|null} [nombre_del_cliente] - `opciones[].nombre` del payload, si vino.
 * @returns {string}
 */
export function nombre_opcion(opcion, nombre_del_cliente) {
  const clave = String(opcion || '')
  if (NOMBRES_DE_OPCION[clave]) {
    return NOMBRES_DE_OPCION[clave]
  }
  if (nombre_del_cliente) {
    return String(nombre_del_cliente)
  }
  return clave
}

/**
 * Nombre humano de un proveedor. Un proveedor que no está en el mapa se muestra tal cual llegó:
 * es más honesto que esconderlo o que inventarle un nombre, y el id sigue siendo legible.
 *
 * @param {string|null} proveedor - Id del proveedor tal como lo informó el cliente.
 * @returns {string}
 */
export function nombre_proveedor(proveedor) {
  const clave = String(proveedor || '')
  return NOMBRES_DE_PROVEEDOR[clave] || clave
}

/**
 * Nombre humano de un nivel de pensamiento, con el mismo criterio para lo desconocido.
 *
 * @param {string|null} pensamiento - Id del nivel tal como lo informó el cliente.
 * @returns {string}
 */
export function nombre_pensamiento(pensamiento) {
  const clave = String(pensamiento || '')
  return NOMBRES_DE_PENSAMIENTO[clave] || clave
}
