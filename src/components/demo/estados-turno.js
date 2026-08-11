/**
 * Qué estados de turno hacen que BotonAcceso muestre algo.
 *
 * 🔴 POR QUÉ VIVE ACÁ Y NO EN CADA COMPONENTE (misión 12, tras la verificación): la
 * regla la necesitan DOS archivos y por motivos distintos. `BotonAcceso.vue` la usa para
 * decidir si renderiza su bloque; `ExperienciaDemo.vue` la usa para decidir si le achica
 * el video para dejarle lugar. Mientras cada uno tenía su copia -- las dos escritas como
 * `estado !== 'sin_turno'` -- coincidían por casualidad, no por construcción.
 *
 * Lo que rompía: un estado que el backend agregue mañana y que `BotonAcceso` no
 * contemple. `!== 'sin_turno'` daba true, así que el video se achicaba... para dejarle
 * lugar a un bloque que no renderizaba ninguno de sus cuatro casos. Medido: el video
 * bajaba de 553 a 430 px y debajo quedaba un hueco en blanco.
 *
 * Es el mismo criterio que `tiempos-confirmacion.js`: si un número o una regla la
 * necesitan dos archivos, no se copia — se comparte, y no se pueden desincronizar.
 */

/**
 * Los estados para los que BotonAcceso tiene algo que mostrar. `sin_turno` no está, y
 * cualquier valor que el backend invente tampoco: no mostrar nada es el respaldo
 * correcto para un estado que este front no sabe interpretar.
 *
 * @type {Array<string>}
 */
export const ESTADOS_CON_BLOQUE = ['antes', 'activo', 'vencido']

/**
 * @param {object} turno El turno tal como llega del payload.
 * @returns {boolean} true si BotonAcceso va a renderizar algo para este turno.
 */
export function hay_bloque_de_turno(turno) {
  const estado = (turno && turno.estado) || 'sin_turno'
  return ESTADOS_CON_BLOQUE.indexOf(estado) !== -1
}
