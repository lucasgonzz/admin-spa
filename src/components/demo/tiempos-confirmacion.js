/**
 * Tiempos de la secuencia de confirmación de la página inmersiva de demo.
 *
 * 🔴 POR QUÉ VIVEN ACÁ Y NO EN CADA COMPONENTE (grupo 370, correctivo 8, prompt 06):
 * es UNA sola secuencia partida en dos archivos -- la invitación la muestra
 * ConfirmacionArmandoDemo.vue y el scroll al video lo dispara ExperienciaDemo.vue --,
 * y los dos momentos se cuentan desde el mismo instante. Mientras cada archivo
 * declaraba su propio número, la relación entre ellos vivía en un comentario que decía
 * "si se cambia allá, cambiar acá también", que es exactamente la clase de acuerdo que
 * se rompe en el primer ajuste: el 6/8/2026 el retraso de la invitación ya se había
 * movido a 3s y el del scroll seguía en 5s, así que entre una cosa y la otra pasaban
 * 2 segundos y no los 3 que Lucas creía haber pedido.
 *
 * Acá no se pueden desincronizar: hay un solo lugar donde está el número, y el segundo
 * se DERIVA del primero.
 */

/**
 * Cuánto tarda en aparecer la invitación al video desde que la pantalla de
 * confirmación se ve (grupo 355, prompt 10). Antes eran 900ms y las dos cosas se
 * leían como un solo momento: "durante los primeros tres segundos lo único que se
 * vea en la pantalla sea ese título" (Lucas, 5/8/2026).
 *
 * @type {number}
 */
export const RETRASO_INVITACION_MS = 3000

/**
 * Cuánto se le da al lead para leer la invitación antes de moverle la página
 * (grupo 370, correctivo 8, prompt 06). Es el pedido textual de Lucas del 6/8/2026:
 * "quiero que desde que aparece ese segundo subtítulo transcurran al menos 3 segundos
 * antes de que se haga el scroll hacia el video".
 *
 * @type {number}
 */
export const LECTURA_INVITACION_MS = 3000

/**
 * Momento del scroll automático al video, contado desde el mismo instante que la
 * invitación. Derivado, no declarado: mover RETRASO_INVITACION_MS arrastra este
 * número solo y los 3 segundos de lectura se mantienen.
 *
 * @type {number}
 */
export const RETRASO_SCROLL_VIDEO_MS = RETRASO_INVITACION_MS + LECTURA_INVITACION_MS
