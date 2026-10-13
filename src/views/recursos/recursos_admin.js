/**
 * Lo que comparten el panel "Centro de recursos" del admin y el hito de Implementaciones
 * (misión centro-de-recursos-clientes, §5.2 del plan): leer las respuestas de
 * `admin/recursos/*` y copiar el link personal del dueño.
 *
 * Las formas de esas respuestas no están fijadas campo por campo en el contrato (§3.6 dice qué
 * datos trae cada una, no con qué nombre). Por eso cada lectura pasa por `campo()`, que acepta
 * los nombres razonables de cada dato, y por `lista_de()`, que acepta la lista suelta o envuelta.
 */
import api, { resolve_error_message } from '@/utils/axios'
import { copy_text_to_clipboard } from '@/utils/version_notification_clipboard'

/**
 * Primer valor definido (y no null) entre varias rutas de un objeto. Cada ruta es un nombre o
 * una ruta con puntos ('usuario.nombre').
 *
 * @param {Object} objeto
 * @param {Array<string>} rutas
 * @param {*} [por_defecto]
 * @returns {*}
 */
export function campo(objeto, rutas, por_defecto) {
  for (let i = 0; i < rutas.length; i++) {
    /** Valor recorrido por la ruta. */
    let valor = objeto
    /** Partes de la ruta. */
    const partes = rutas[i].split('.')
    for (let j = 0; j < partes.length && valor != null; j++) {
      valor = valor[partes[j]]
    }
    if (valor !== undefined && valor !== null && typeof valor !== 'object') {
      return valor
    }
    if (valor && typeof valor === 'object' && partes.length === 1 && Array.isArray(valor)) {
      return valor
    }
  }
  return por_defecto === undefined ? null : por_defecto
}

/**
 * La lista de una respuesta: el array suelto, o el array que venga en alguna de las claves
 * dadas (o en `data`, si es un paginado de Laravel).
 *
 * @param {*} datos
 * @param {Array<string>} claves
 * @returns {Array<Object>}
 */
export function lista_de(datos, claves) {
  if (Array.isArray(datos)) {
    return datos
  }
  if (!datos || typeof datos !== 'object') {
    return []
  }
  /** Claves a probar, con `data` al final. */
  const todas = claves.concat(['data'])
  for (let i = 0; i < todas.length; i++) {
    if (Array.isArray(datos[todas[i]])) {
      return datos[todas[i]]
    }
  }
  return []
}

/**
 * Número de un dato que puede venir como string (los `decimal` de Laravel).
 *
 * @param {*} valor
 * @returns {number}
 */
export function numero(valor) {
  /** Valor como número. */
  const n = Number(valor)
  return isNaN(n) ? 0 : n
}

/**
 * Porcentaje para mostrar ("3 %", "42,5 %"). Recibe 0–100.
 *
 * @param {*} valor
 * @returns {string}
 */
export function porcentaje_texto(valor) {
  /** Valor redondeado a una décima. */
  const n = Math.round(numero(valor) * 10) / 10
  return String(n).replace('.', ',') + ' %'
}

/**
 * Fecha y hora cortas (dd/mm/aaaa hh:mm) en hora local, o '—'.
 *
 * @param {string|null} fecha
 * @returns {string}
 */
export function fecha_corta(fecha) {
  if (!fecha) {
    return '—'
  }
  /** Fecha parseada (acepta ISO y "AAAA-MM-DD HH:MM:SS"). */
  let d = new Date(fecha)
  if (isNaN(d.getTime())) {
    d = new Date(String(fecha).replace(' ', 'T'))
  }
  if (isNaN(d.getTime())) {
    return String(fecha)
  }
  /**
   * Dos dígitos.
   * @param {number} x
   * @returns {string}
   */
  const dos = function (x) {
    return String(x).padStart(2, '0')
  }
  return dos(d.getDate()) + '/' + dos(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + dos(d.getHours()) + ':' + dos(d.getMinutes())
}

/**
 * Resumen del avance de un cliente a partir de `GET admin/recursos/clientes/{client_id}`, para
 * la nota del hito en Implementaciones ("12 de 364 videos · 3 %").
 *
 * Lee `resumen` (`{usuarios, avance, videos_terminados, videos_activos}`): `avance` es el
 * promedio de los usuarios del cliente y `videos_terminados` la SUMA de lo que terminó cada uno
 * (con dos usuarios puede pasar el total de videos; por eso la nota de Implementaciones dice
 * "de N" solo cuando hay un usuario). Si no viniera el resumen, lo arma con los usuarios.
 *
 * @param {Object} datos Cuerpo de la respuesta.
 * @returns {{ terminados: number, total: number, porcentaje: number, usuarios: number }|null}
 *   null si el cliente no tiene a nadie en el centro.
 */
export function resumen_de_cliente(datos) {
  if (!datos || typeof datos !== 'object') {
    return null
  }
  /** Usuarios del cliente en el centro. */
  const usuarios = lista_de(datos, ['usuarios'])
  /** Total de videos activos del centro, si vino. */
  const total = numero(campo(datos, ['resumen.videos_activos', 'videos_activos', 'total_videos'], 0))
  /** Cantidad de usuarios del cliente en el centro. */
  const cantidad = numero(campo(datos, ['resumen.usuarios'], usuarios.length))
  if (!cantidad && !usuarios.length) {
    return null
  }
  /** Avance promedio, si vino. */
  let porcentaje = campo(datos, ['resumen.avance', 'resumen.avance_promedio', 'avance_promedio', 'avance'])
  /** Videos terminados, si vino. */
  let terminados = campo(datos, ['resumen.videos_terminados', 'videos_terminados', 'terminados'])
  if ((porcentaje === null || terminados === null) && usuarios.length) {
    /** Suma de avances, para el promedio. */
    let suma = 0
    /** Mayor cantidad de terminados. */
    let maximo = 0
    usuarios.forEach(function (u) {
      suma += numero(campo(u, ['avance', 'porcentaje', 'avance_promedio'], 0))
      maximo = Math.max(maximo, numero(campo(u, ['terminados', 'videos_terminados'], 0)))
    })
    if (porcentaje === null) {
      porcentaje = suma / usuarios.length
    }
    if (terminados === null) {
      terminados = maximo
    }
  }
  if (porcentaje === null && terminados === null) {
    return null
  }
  return { terminados: numero(terminados), total: total, porcentaje: numero(porcentaje), usuarios: cantidad || usuarios.length }
}

/**
 * Avisa con el toast global del admin.
 *
 * @param {string} mensaje
 * @param {'success'|'danger'|'warning'|'info'} variante
 * @returns {void}
 */
export function avisar(mensaje, variante) {
  window.dispatchEvent(new CustomEvent('admin-spa-toast', { detail: { message: mensaje, variant: variante } }))
}

/**
 * Crea (o reusa el vigente) el link personal del dueño de un cliente y lo copia al
 * portapapeles (`POST admin/recursos/clientes/{client_id}/link-dueno` → `{url, expires_at}`).
 * Si el portapapeles no deja copiar (pasa cuando el pedido tarda y el navegador ya no lo cuenta
 * como parte del clic), devuelve igual la URL para que la pantalla la muestre y se copie a mano.
 *
 * @param {number|string} client_id
 * @returns {Promise<{ url: string, expires_at: string|null, copiado: boolean }>}
 */
export function copiar_link_dueno(client_id) {
  return api
    .post('/recursos/clientes/' + encodeURIComponent(client_id) + '/link-dueno', {}, { silent_error: true })
    .then(function (res) {
      /** Datos de la respuesta. */
      const datos = res.data || {}
      /** URL del link personal. */
      const url = campo(datos, ['url', 'link.url'])
      /** Vencimiento. */
      const vence = campo(datos, ['expires_at', 'link.expires_at'])
      if (!url) {
        throw new Error('La respuesta no trajo el link.')
      }
      return copy_text_to_clipboard(url)
        .then(function () {
          avisar('Link del dueño copiado' + (vence ? ' (vence el ' + fecha_corta(vence).slice(0, 10) + ')' : '') + '.', 'success')
          return { url: url, expires_at: vence, copiado: true }
        })
        .catch(function () {
          avisar('No se pudo copiar solo: copialo del recuadro.', 'warning')
          return { url: url, expires_at: vence, copiado: false }
        })
    })
    .catch(function (error) {
      /** Mensaje para el toast. */
      const mensaje = error && error.response ? resolve_error_message(error) : (error && error.message) || 'No se pudo crear el link.'
      avisar('Link del dueño: ' + mensaje, 'danger')
      throw error
    })
}
