/**
 * Qué hace que BotonAcceso muestre algo.
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
 *
 * MISIÓN 46: el turno dejó de ser lo único que gobierna el bloque. Ahora `puede_ingresar`
 * —que lo calcula el backend— puede habilitar el botón aunque el estado del turno no sea
 * `activo`, así que la respuesta depende de las dos cosas.
 */

/**
 * Los estados de turno para los que BotonAcceso tiene algo que mostrar. `sin_turno` no está, y
 * cualquier valor que el backend invente tampoco: no mostrar nada es el respaldo correcto para un
 * estado que este front no sabe interpretar.
 *
 * @type {Array<string>}
 */
export const ESTADOS_CON_BLOQUE = ['antes', 'activo', 'vencido']

/**
 * @param {object} turno El turno tal como llega del payload.
 * @param {boolean} [puede_ingresar] El flag del payload, calculado por el backend. Si es true hay
 *   bloque sí o sí: el botón de entrar tiene que existir aunque el estado del turno sea uno que
 *   este front no interprete — el backend ya dijo que se puede entrar y no le corresponde a la
 *   página contradecirlo.
 * @returns {boolean} true si BotonAcceso va a renderizar algo.
 */
export function hay_bloque_de_turno(turno, puede_ingresar) {
  if (puede_ingresar === true) {
    return true
  }
  const estado = (turno && turno.estado) || 'sin_turno'
  return ESTADOS_CON_BLOQUE.indexOf(estado) !== -1
}
