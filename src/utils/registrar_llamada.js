/**
 * Lógica pura del modal «Registrar llamada» (misión embudo-juan-pipeline, E1).
 *
 * Juan (o Lucas) deja asentado qué habló en una llamada con un lead: `POST lead/{id}/llamadas`. La que
 * manda es la API (`LeadLlamadaService::registrar`, §2.1.3 del plan): acá se replican sus reglas SÓLO
 * para avisar en la pantalla antes de mandar y para armar el cuerpo del pedido. Si la API cambia una
 * regla, el 422 que devuelve sigue siendo la última palabra.
 *
 * Es JavaScript sin imports a propósito: `pruebas/tablero-juan.cjs` lo lee tal cual y lo ejecuta en
 * Node, así que no puede depender de Vue ni de axios (misma convención que `utils/solo_leads.js`).
 *
 * Forma del formulario que recibe cada función:
 *   {
 *     atendio: true | false | null,   // null = todavía no eligió
 *     resultado: string,              // clave de RESULTADOS; sólo cuenta si atendió
 *     motivo: string,                 // uno de los motivos de pérdida del pipeline; sólo con «no le interesa»
 *     proxima_llamada_at: string,     // valor de un <input type="datetime-local"> («2026-11-25T11:00»)
 *     cotizado: string,               // lo que se le cotizó (hasta 255 caracteres)
 *     notas: string,                  // qué se habló (hasta 5000 caracteres)
 *     paquetes: string[],             // E2: claves de PAQUETES; sólo cuentan con «Pagó la mitad»
 *   }
 */

/**
 * Resultados posibles de una llamada que sí se atendió, en el orden en que se muestran. La clave es la
 * que entiende la API; la etiqueta, la que lee el operador.
 *
 * @type {Array<{value: string, label: string}>}
 */
export const RESULTADOS = [
  { value: 'sigue_solo', label: 'Sigue solo con la prueba' },
  { value: 'implementacion_acordada', label: 'Implementación acordada' },
  { value: 'pago_la_mitad', label: 'Pagó la mitad' },
  { value: 'volver_a_llamar', label: 'Volver a llamar' },
  { value: 'no_le_interesa', label: 'No le interesa' },
  { value: 'ya_contrato', label: 'Ya contrató' },
]

/**
 * Paquetes de implementación que se pueden contratar (misión embudo-juan-pipeline, E2): las claves de
 * `PreciosVigentesSettings::implementaciones.items` de la API. Agentes Lite no tiene implementación, por
 * eso no figura. La ficha del cliente usa esta misma lista.
 *
 * @type {Array<{value: string, label: string}>}
 */
export const PAQUETES = [
  { value: 'gestion', label: 'Gestión' },
  { value: 'tienda', label: 'Tienda' },
  { value: 'agentes', label: 'Agentes' },
]

/** Largo máximo de las notas (igual que la API). */
const LARGO_MAXIMO_DE_NOTAS = 5000

/** Largo máximo de lo cotizado (igual que la API). */
const LARGO_MAXIMO_DE_COTIZADO = 255

/**
 * Indica si el formulario es de una llamada atendida.
 *
 * @param {Object} form Formulario.
 * @returns {boolean}
 */
function atendio_la_llamada(form) {
  return !!form && form.atendio === true
}

/**
 * Indica si la fecha de la próxima llamada es OBLIGATORIA: cuando no atendió (hay que volver a llamar)
 * y con el resultado «volver a llamar».
 *
 * @param {Object} form Formulario.
 * @returns {boolean}
 */
export function requiere_fecha(form) {
  if (!form) {
    return false
  }
  if (form.atendio === false) {
    return true
  }
  return atendio_la_llamada(form) && form.resultado === 'volver_a_llamar'
}

/**
 * Indica si el formulario muestra el campo de fecha: es obligatoria (`requiere_fecha`) o es opcional
 * porque con «implementación acordada» la fecha es cuándo se retoma (sin fecha, la API pone dos días).
 *
 * @param {Object} form Formulario.
 * @returns {boolean}
 */
export function admite_fecha(form) {
  if (requiere_fecha(form)) {
    return true
  }
  return atendio_la_llamada(form) && form.resultado === 'implementacion_acordada'
}

/**
 * Indica si hay que elegir un motivo de pérdida: sólo con «no le interesa» y habiendo atendido (si no
 * atendió, el resultado se ignora).
 *
 * @param {Object} form Formulario.
 * @returns {boolean}
 */
export function requiere_motivo(form) {
  return atendio_la_llamada(form) && form.resultado === 'no_le_interesa'
}

/**
 * Indica si hay que elegir los paquetes: sólo con «Pagó la mitad» habiendo atendido. Con ese resultado la API
 * pausa la prueba y arranca la implementación de lo que se contrató.
 *
 * @param {Object} form Formulario.
 * @returns {boolean}
 */
export function requiere_paquetes(form) {
  return atendio_la_llamada(form) && form.resultado === 'pago_la_mitad'
}

/**
 * Valida los paquetes de «Pagó la mitad»: al menos uno y todos de la lista de `PAQUETES`.
 *
 * Va APARTE de `validar()` a propósito: `validar()` es la de E1 y `pruebas/tablero-juan.cjs` fija que con
 * «Pagó la mitad» no mira los paquetes. El modal las suma: `Object.assign(validar(...), validar_paquetes(...))`.
 *
 * @param {Object} form Formulario.
 * @returns {Object<string, string>} `{paquetes: mensaje}` si falta o hay uno que no existe; vacío si está bien.
 */
export function validar_paquetes(form) {
  const errores = {}
  if (!requiere_paquetes(form)) {
    return errores
  }
  const elegidos = Array.isArray(form.paquetes) ? form.paquetes : []
  const claves = PAQUETES.map(function (paquete) {
    return paquete.value
  })
  const invalidos = elegidos.filter(function (clave) {
    return claves.indexOf(clave) === -1
  })
  if (elegidos.length === 0) {
    errores.paquetes = 'Elegí al menos un paquete.'
  } else if (invalidos.length > 0) {
    errores.paquetes = 'Elegí sólo paquetes de la lista.'
  }
  return errores
}

/**
 * Convierte el valor de un `datetime-local` en una fecha local.
 *
 * @param {string|null|undefined} valor «2026-11-25T11:00» (también acepta «2026-11-25 11:00»).
 * @returns {Date|null} null si está vacío o no se puede leer.
 */
function leer_fecha(valor) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(valor || '').trim())
  if (!partes) {
    return null
  }
  const fecha = new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]), Number(partes[4]), Number(partes[5]), 0)
  return isNaN(fecha.getTime()) ? null : fecha
}

/**
 * Pasa el valor de un `datetime-local` al formato que espera la API (`Y-m-d H:i`).
 *
 * @param {string|null|undefined} valor «2026-11-25T11:00».
 * @returns {string|null} «2026-11-25 11:00», o null si está vacío o no se puede leer.
 */
function fecha_para_la_api(valor) {
  const partes = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(String(valor || '').trim())
  return partes ? partes[1] + ' ' + partes[2] : null
}

/**
 * Valida el formulario con las mismas reglas que la API.
 *
 * - Hay que decir si atendió.
 * - Si NO atendió: la fecha de la próxima llamada es obligatoria y tiene que ser futura; el resultado
 *   se ignora (aunque haya quedado uno a medio elegir).
 * - Si atendió: el resultado tiene que ser uno de `RESULTADOS`; «volver a llamar» exige fecha futura;
 *   «no le interesa» exige un motivo de la lista del pipeline.
 * - Las notas llegan a 5000 caracteres y lo cotizado a 255.
 *
 * @param {Object} form Formulario.
 * @param {{ahora?: Date, motivos?: string[]}} [opciones] `ahora` fija la hora de la comparación (por
 *   defecto, la actual); `motivos` es la lista de motivos de pérdida del pipeline (si viene vacía no se
 *   comprueba el motivo contra la lista: el motivo sólo tiene que estar).
 * @returns {Object<string, string>} Mensaje por campo con error; objeto vacío si todo está bien.
 */
export function validar(form, opciones) {
  const errores = {}
  const config = opciones || {}
  const ahora = config.ahora instanceof Date ? config.ahora : new Date()
  const motivos = Array.isArray(config.motivos) ? config.motivos : []
  const datos = form || {}

  if (datos.atendio !== true && datos.atendio !== false) {
    errores.atendio = 'Indicá si atendió.'
  }

  if (atendio_la_llamada(datos)) {
    const claves = RESULTADOS.map(function (resultado) {
      return resultado.value
    })
    if (claves.indexOf(datos.resultado) === -1) {
      errores.resultado = 'Elegí cómo terminó la llamada.'
    }
  }

  if (requiere_fecha(datos)) {
    const fecha = leer_fecha(datos.proxima_llamada_at)
    if (!fecha) {
      errores.proxima_llamada_at = 'Indicá cuándo volver a llamar.'
    } else if (fecha.getTime() <= ahora.getTime()) {
      errores.proxima_llamada_at = 'La fecha para volver a llamar tiene que ser futura.'
    }
  }

  if (requiere_motivo(datos)) {
    const motivo = String(datos.motivo || '').trim()
    if (motivo === '') {
      errores.motivo = 'Elegí por qué no le interesa.'
    } else if (motivos.length > 0 && motivos.indexOf(motivo) === -1) {
      errores.motivo = 'Elegí uno de los motivos de la lista.'
    }
  }

  if (String(datos.notas || '').length > LARGO_MAXIMO_DE_NOTAS) {
    errores.notas = 'Las notas llegan hasta ' + LARGO_MAXIMO_DE_NOTAS + ' caracteres.'
  }
  if (String(datos.cotizado || '').length > LARGO_MAXIMO_DE_COTIZADO) {
    errores.cotizado = 'Lo cotizado llega hasta ' + LARGO_MAXIMO_DE_COTIZADO + ' caracteres.'
  }

  return errores
}

/**
 * Cuerpo del `POST lead/{id}/llamadas`. Sólo manda lo que corresponde al caso (no arrastra un resultado
 * o un motivo que quedaron a medio elegir) y recorta los textos; lo vacío no viaja.
 *
 * @param {Object} form Formulario ya validado.
 * @returns {Object} Cuerpo del pedido.
 */
export function payload(form) {
  const datos = form || {}
  const cuerpo = { atendio: datos.atendio === true }

  if (cuerpo.atendio) {
    cuerpo.resultado = datos.resultado
  }
  if (requiere_motivo(datos)) {
    cuerpo.motivo = String(datos.motivo || '').trim()
  }
  if (admite_fecha(datos)) {
    const fecha = fecha_para_la_api(datos.proxima_llamada_at)
    if (fecha) {
      cuerpo.proxima_llamada_at = fecha
    }
  }

  if (requiere_paquetes(datos) && Array.isArray(datos.paquetes) && datos.paquetes.length > 0) {
    cuerpo.paquetes = datos.paquetes.slice()
  }

  const cotizado = String(datos.cotizado || '').trim()
  if (cotizado !== '') {
    cuerpo.cotizado = cotizado
  }
  const notas = String(datos.notas || '').trim()
  if (notas !== '') {
    cuerpo.notas = notas
  }
  return cuerpo
}
