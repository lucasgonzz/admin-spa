/**
 * Subida de la grabación de una llamada YA registrada (misión leads-referidos-compromisos, E3, ronda 2).
 *
 * La usa la ficha de la llamada («Subir la grabación»): sube el audio a ESA llamada, reusando las rutas de E3, sin registrar otra
 * llamada (una segunda llamada mueve la tarjeta y cumple el compromiso). Hace lo mismo que «Registrar llamada» —avisar qué archivo
 * viene, mandar las partes de 4 MB de a una con hasta tres intentos cada una y completar—, y manda el id de la grabación en las
 * partes y en «completar» para no mezclarse con otra subida de la misma llamada. Reglas del archivo y partes: `grabacion_de_llamada.js`.
 */
import api from '@/utils/axios'
import { INTENTOS_POR_PARTE, partir_en_partes, validar_archivo } from '@/utils/grabacion_de_llamada'

/**
 * Manda UNA parte, con reintentos (una mala señal del celular no tira la subida entera). Un 422 no se reintenta.
 *
 * @param {string} url Dirección de las partes.
 * @param {number} grabacion_id Grabación a la que pertenece la subida.
 * @param {File} archivo Archivo elegido.
 * @param {{ indice: number, desde: number, hasta: number }} parte La parte a mandar.
 * @param {number} intento Número de intento (desde 1).
 * @returns {Promise<void>}
 */
function mandar_la_parte(url, grabacion_id, archivo, parte, intento) {
  const cuerpo = new FormData()
  cuerpo.append('indice', String(parte.indice))
  cuerpo.append('grabacion_id', String(grabacion_id))
  cuerpo.append('parte', archivo.slice(parte.desde, parte.hasta), 'parte.bin')
  return api
    .post(url, cuerpo, { headers: { 'Content-Type': 'multipart/form-data' }, silent_error: true })
    .then(function () {
      return null
    })
    .catch(function (error) {
      const status = error && error.response ? error.response.status : 0
      if (intento >= INTENTOS_POR_PARTE || status === 422 || status === 404) {
        throw error
      }
      return new Promise(function (resolve) {
        window.setTimeout(resolve, 1000 * intento)
      }).then(function () {
        return mandar_la_parte(url, grabacion_id, archivo, parte, intento + 1)
      })
    })
}

/**
 * Sube las partes en orden, de a una.
 *
 * @param {string} url Dirección de las partes.
 * @param {number} grabacion_id
 * @param {File} archivo
 * @param {Array<Object>} partes Salida de `partir_en_partes`.
 * @param {number} posicion Parte que toca.
 * @param {function(number, number): void} al_avanzar Se llama con (hechas, total).
 * @returns {Promise<void>}
 */
function subir_las_partes(url, grabacion_id, archivo, partes, posicion, al_avanzar) {
  if (posicion >= partes.length) {
    return Promise.resolve()
  }
  return mandar_la_parte(url, grabacion_id, archivo, partes[posicion], 1).then(function () {
    al_avanzar(posicion + 1, partes.length)
    return subir_las_partes(url, grabacion_id, archivo, partes, posicion + 1, al_avanzar)
  })
}

/**
 * Sube la grabación a una llamada existente. Si la llamada ya tenía una subida a medias (o con error) la reemplaza.
 *
 * @param {{ lead_id: (number|string), llamada_id: (number|string), archivo: File, al_avanzar: function(number, number): void }} datos
 * @returns {Promise<Object>} La grabación en `pendiente`. Rechaza con el error de axios; un 409 con `response.data.grabacion` significa
 *          que ese audio (o esa llamada) ya tenía grabación.
 */
export function subir_grabacion(datos) {
  const revision = validar_archivo(datos.archivo.name, datos.archivo.size)
  if (!revision.ok) {
    return Promise.reject(new Error(revision.mensaje))
  }
  const partes = partir_en_partes(datos.archivo.size)
  const base = '/lead/' + datos.lead_id + '/llamadas/' + datos.llamada_id
  let grabacion_id = 0
  datos.al_avanzar(0, partes.length)
  return api
    .post('/lead/' + datos.lead_id + '/llamadas/' + datos.llamada_id + '/grabacion', { nombre: datos.archivo.name, bytes: datos.archivo.size, mime: datos.archivo.type || '' }, { silent_error: true })
    .then(function (res) {
      grabacion_id = res.data.grabacion.id
      return subir_las_partes(base + '/grabacion/partes', grabacion_id, datos.archivo, partes, 0, datos.al_avanzar)
    })
    .then(function () {
      return api.post(base + '/grabacion/completar', { grabacion_id: grabacion_id }, { silent_error: true })
    })
    .then(function (res) {
      return res.data.grabacion
    })
}
