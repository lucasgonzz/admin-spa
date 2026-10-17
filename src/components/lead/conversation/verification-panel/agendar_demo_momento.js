/**
 * LA definición de «el paquete `agendar_demo` viene en la forma momento concreto», y la única
 * (misión flujo-lead-landing-closer, 17/10/2026).
 *
 * La demo directa para un momento concreto llega como `{dia, hora, inicio_resuelto}` (y, si el
 * servidor no pudo leer el momento, `inicio_ilegible: true` en vez de `inicio_resuelto`). No es
 * ni `{ahora: true}` ni la forma de grilla (`demo_id`). La usan el control que la dibuja
 * (`DemoScheduleControl.vue`) y el mixin que arma el paquete final
 * (`verification_actions_panel_mixin.js`): estaba escrita dos veces y las dos tenían que decir
 * lo mismo, así que vive acá.
 *
 * @param {Object|null|undefined} obj valor de `agendar_demo`
 * @returns {boolean}
 */
export function es_agendar_demo_momento(obj) {
  if (!obj || typeof obj !== 'object' || obj.ahora || obj.demo_id != null) {
    return false
  }
  return obj.dia != null
    || obj.hora != null
    || obj.inicio_resuelto != null
    || obj.inicio_ilegible === true
}
