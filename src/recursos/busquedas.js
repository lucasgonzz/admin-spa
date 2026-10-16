/**
 * Registro de las búsquedas del centro de recursos (misión busquedas-centro-recursos, contrato C-BUSQ-1).
 *
 * Para qué: Lucas quiere saber qué escriben los clientes en el buscador y no encuentran (o encuentran y no abren),
 * para afinar `sinonimos.js` con datos reales. Este módulo decide CUÁNDO y QUÉ se manda; el envío en sí
 * (`enviar_busqueda` de `api.js`) se le inyecta, así se prueba en Node sin red ni navegador.
 *
 * Reglas:
 * - Una búsqueda = un registro, no una tecla. Se manda una vez, cuando la persona deja de escribir (`espera_ms`),
 *   y otra vez —con el mismo `evento`— si abre un resultado. El servidor completa la fila por `evento`.
 * - Una consulta con datos personales (mail, link, teléfono, CUIT, DNI, tarjeta) ni sale de la página: la misma
 *   regla que aplica el servidor, para no mandar de más.
 * - Nada de lo que pase acá puede romper el buscador: ningún error del envío sube hasta quien llama.
 *
 * No depende de Vue ni del DOM.
 */

/** Cuánto hay que dejar de escribir para que la búsqueda se registre (milisegundos). */
export const ESPERA_POR_DEFECTO_MS = 1500

/** Largo máximo de la consulta que se manda (el servidor acepta hasta 500). */
const LARGO_MAXIMO_DE_CONSULTA = 500

/** Largo máximo de un código de video (el servidor acepta hasta 20). */
const LARGO_MAXIMO_DE_CODIGO = 20

/** Letras y números con los que se arma un id de búsqueda. */
const ALFABETO_DE_IDS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/** Largo del id de una búsqueda (el servidor pide entre 8 y 40). */
const LARGO_DE_ID = 24

/**
 * Texto en minúsculas, sin acentos y con los espacios colapsados.
 *
 * @param {string} texto
 * @returns {string}
 */
function normalizar(texto) {
  return String(texto == null ? '' : texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Indica si una consulta se puede registrar: false si parece traer datos personales o si quedó demasiado corta.
 * Es la misma regla que aplica el servidor (que descarta antes de guardar): mail (`@`), link (`http`, `www.`), una
 * corrida de 5 o más dígitos, un dominio, una clave larga (20 o más caracteres con letras y números), 7 o más dígitos en total (teléfonos con espacios o guiones, CUIT, DNI, tarjetas) o
 * menos de 2 caracteres alfanuméricos.
 *
 * @param {string} texto Lo que escribió la persona.
 * @returns {boolean}
 */
export function es_consulta_registrable(texto) {
  /** Consulta normalizada. */
  const t = normalizar(texto)
  // El `＠` y el `﹫` (arroba de ancho completo y chica) también cuentan: se pasan a `@` con NFKC.
  if (/[＠﹫]/.test(t) || normalizar(String(texto == null ? '' : texto).normalize('NFKC')).indexOf('@') !== -1) {
    return false
  }
  if (t.indexOf('@') !== -1 || t.indexOf('http') !== -1 || t.indexOf('www.') !== -1) {
    return false
  }
  // Un dominio ("mi-sitio.com.ar/xxx") o una clave larga con letras y números ("clave_api_4ec39hq…").
  if (/[a-z0-9-]+\.(com|net|org|ar|info|edu|gob|io|me|app|shop|store)(?![a-z0-9])/.test(t)) {
    return false
  }
  if ((t.match(/[a-z0-9_-]{20,}/g) || []).some(function (palabra) { return /\d/.test(palabra) && /[a-z]/.test(palabra) })) {
    return false
  }
  if (/\d{5,}/.test(t)) {
    return false
  }
  /** Dígitos de toda la consulta, estén donde estén. */
  const digitos = t.match(/\d/g)
  if (digitos && digitos.length >= 7) {
    return false
  }
  /** Letras y números de la consulta. */
  const alfanumericos = t.match(/[\p{L}\p{N}]/gu)
  return !!alfanumericos && alfanumericos.length >= 2
}

/**
 * Crea un id aleatorio de 24 letras y números. Usa `crypto.getRandomValues` si el navegador lo tiene y, si no,
 * `Math.random` (el id solo identifica una búsqueda, no protege nada).
 *
 * @returns {string}
 */
export function crear_id_de_busqueda() {
  /** Posiciones elegidas del alfabeto. */
  const posiciones = []
  /** Generador criptográfico, si existe. */
  const cripto = typeof globalThis !== 'undefined' ? globalThis.crypto : null
  if (cripto && typeof cripto.getRandomValues === 'function') {
    /** Bytes al azar. */
    const bytes = cripto.getRandomValues(new Uint8Array(LARGO_DE_ID))
    for (let i = 0; i < LARGO_DE_ID; i++) {
      posiciones.push(bytes[i] % ALFABETO_DE_IDS.length)
    }
  } else {
    for (let i = 0; i < LARGO_DE_ID; i++) {
      posiciones.push(Math.floor(Math.random() * ALFABETO_DE_IDS.length))
    }
  }
  return posiciones
    .map(function (p) {
      return ALFABETO_DE_IDS.charAt(p)
    })
    .join('')
}

/**
 * Crea el registro de búsquedas de una visita a la página.
 *
 * @param {Object} opciones
 * @param {Function} opciones.enviar Recibe el payload del contrato C-BUSQ-1 (`{ evento, consulta, resultados,
 *   primero, completo, abrio?, posicion? }`). Puede devolver una promesa; si falla o lanza, se ignora.
 * @param {number} [opciones.espera_ms] Cuánto esperar sin cambios antes de mandar (por defecto 1500).
 * @param {Function} [opciones.crear_id] Devuelve el id de una búsqueda nueva (por defecto, uno al azar).
 * @param {Function} [opciones.programar] Como `setTimeout(funcion, ms)`: devuelve algo que entiende `cancelar`.
 * @param {Function} [opciones.cancelar] Como `clearTimeout(manija)`.
 * @returns {{
 *   buscado: function({ consulta: string, resultados: number, primero: (string|null), completo: boolean }): void,
 *   abrio: function(string, number): void,
 *   cancelar: function(): void
 * }}
 */
export function crear_registro_de_busquedas(opciones) {
  /** Opciones con valores por defecto. */
  const op = opciones || {}
  /** Cómo se manda un payload. */
  const enviar = typeof op.enviar === 'function' ? op.enviar : function () {}
  /** Espera sin cambios antes de mandar. */
  const espera_ms = typeof op.espera_ms === 'number' ? op.espera_ms : ESPERA_POR_DEFECTO_MS
  /** Cómo se crea el id de una búsqueda. */
  const crear_id = typeof op.crear_id === 'function' ? op.crear_id : crear_id_de_busqueda
  /** Cómo se programa algo para más tarde. */
  const programar =
    typeof op.programar === 'function'
      ? op.programar
      : function (funcion, ms) {
          return globalThis.setTimeout(funcion, ms)
        }
  /** Cómo se cancela algo programado. */
  const cancelar_programado =
    typeof op.cancelar === 'function'
      ? op.cancelar
      : function (manija) {
          globalThis.clearTimeout(manija)
        }

  /**
   * La búsqueda en curso, o null si no hay (nada escrito, o una consulta que no se registra).
   * `consulta`: lo escrito, sin espacios de los costados. `datos`: lo último que informó el buscador.
   * `manija`: el reloj del envío pendiente (null si ya salió o se canceló). `clic`: el primer resultado abierto.
   *
   * @type {null|{
   *   id: string,
   *   consulta: string,
   *   datos: { resultados: number, primero: (string|null), completo: boolean },
   *   manija: *,
   *   clic: (null|{ codigo: string, posicion: (number|null) })
   * }}
   */
  let actual = null

  /**
   * Arma el payload de una búsqueda con los nombres exactos del contrato.
   *
   * @param {Object} busqueda Una búsqueda como la que guarda `actual`.
   * @returns {Object}
   */
  function armar_payload(busqueda) {
    /** Lo que se manda siempre. */
    const payload = {
      evento: busqueda.id,
      consulta: busqueda.consulta.slice(0, LARGO_MAXIMO_DE_CONSULTA),
      resultados: busqueda.datos.resultados,
      primero: busqueda.datos.primero,
      completo: busqueda.datos.completo,
    }
    if (busqueda.clic) {
      payload.abrio = busqueda.clic.codigo
      if (busqueda.clic.posicion !== null) {
        payload.posicion = busqueda.clic.posicion
      }
    }
    return payload
  }

  /**
   * Manda un payload sin que nada de lo que pase afuera suba hasta quien llama.
   *
   * @param {Object} payload
   * @returns {void}
   */
  function mandar(payload) {
    try {
      /** Lo que devolvió el envío (una promesa, normalmente). */
      const resultado = enviar(payload)
      if (resultado && typeof resultado.catch === 'function') {
        resultado.catch(function () {})
      }
    } catch (e) {
      /* El registro de búsquedas es accesorio: si falla, la página sigue igual. */
    }
  }

  /**
   * Apaga el reloj del envío pendiente de una búsqueda.
   *
   * @param {Object} busqueda
   * @returns {void}
   */
  function apagar_reloj(busqueda) {
    if (busqueda.manija !== null) {
      cancelar_programado(busqueda.manija)
      busqueda.manija = null
    }
  }

  /**
   * Deja de seguir la búsqueda en curso. Lo que no salió, no sale.
   *
   * @returns {void}
   */
  function cancelar() {
    if (actual) {
      apagar_reloj(actual)
      actual = null
    }
  }

  /**
   * Lo que informó el buscador, con los tipos que pide el contrato.
   *
   * @param {Object} info
   * @returns {{ resultados: number, primero: (string|null), completo: boolean }}
   */
  function datos_de(info) {
    /** Cantidad de resultados. */
    const resultados = Math.max(0, Math.floor(Number(info.resultados) || 0))
    return {
      resultados: resultados,
      primero: resultados > 0 && info.primero ? String(info.primero).slice(0, LARGO_MAXIMO_DE_CODIGO) : null,
      completo: !!info.completo,
    }
  }

  /**
   * El buscador informa qué encontró para lo que hay escrito. Con la misma consulta que la búsqueda en curso solo
   * actualiza lo que se va a mandar (no reinicia el reloj ni reenvía lo que ya salió). Con otra consulta, la
   * anterior era una consulta a medio escribir: se descarta y arranca una búsqueda nueva. Una consulta vacía o que no
   * se registra cancela todo.
   *
   * @param {{ consulta: string, resultados: number, primero: (string|null), completo: boolean }} info
   * @returns {void}
   */
  function buscado(info) {
    /** Consulta sin los espacios de los costados. */
    const consulta = String((info && info.consulta) || '').trim()
    if (!consulta || !es_consulta_registrable(consulta)) {
      cancelar()
      return
    }
    if (actual && actual.consulta === consulta) {
      actual.datos = datos_de(info)
      return
    }
    cancelar()
    /** La búsqueda nueva. */
    const busqueda = { id: crear_id(), consulta: consulta, datos: datos_de(info), manija: null, clic: null }
    actual = busqueda
    busqueda.manija = programar(function () {
      busqueda.manija = null
      if (actual !== busqueda) {
        return
      }
      mandar(armar_payload(busqueda))
    }, espera_ms)
  }

  /**
   * La persona abrió un resultado de la búsqueda en curso. Solo cuenta el primer clic de cada búsqueda: manda el
   * payload completo con `abrio` y `posicion` (aunque el evento sin clic ya haya salido: el servidor completa la
   * fila por `evento`) y apaga el reloj. Sin búsqueda en curso no hace nada.
   *
   * @param {string} codigo Código del video abierto.
   * @param {number} posicion Lugar del video en la lista, empezando en 1.
   * @returns {void}
   */
  function abrio(codigo, posicion) {
    if (!actual || actual.clic || !codigo) {
      return
    }
    /** Lugar en la lista, si es un entero válido. */
    const lugar = Math.floor(Number(posicion))
    actual.clic = {
      codigo: String(codigo).slice(0, LARGO_MAXIMO_DE_CODIGO),
      posicion: lugar >= 1 ? lugar : null,
    }
    apagar_reloj(actual)
    mandar(armar_payload(actual))
  }

  return { buscado: buscado, abrio: abrio, cancelar: cancelar }
}
