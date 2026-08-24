/**
 * Utilidades del link de Google Meet del panel del closer.
 */

/**
 * Agrega `authuser` al link de Meet para forzar la cuenta de Google con la que se creó el evento.
 *
 * 🔴 El motivo: el evento (y por lo tanto el Meet) se crea con la cuenta que el closer tiene
 * conectada en el admin, así que esa cuenta es la anfitriona de la llamada y entra derecho. Pero
 * el link se abre en el navegador del closer, que casi nunca está logueado con esa cuenta — y
 * Google Meet, si la sesión activa es otra, lo trata como un invitado cualquiera y le muestra
 * "esperando que el anfitrión te deje entrar". Con `authuser` Google cambia a la cuenta correcta
 * si la tiene disponible en el navegador, y el closer entra sin que nadie lo admita.
 *
 * Si no hay cuenta conectada (o el link viene vacío), devuelve el link tal cual: no se rompe nada,
 * simplemente se pierde el atajo.
 *
 * @param {string|null|undefined} meet_url Link de Meet de la llamada.
 * @param {string|null|undefined} account Mail de la cuenta de Google conectada del closer.
 * @returns {string} Link listo para abrir en una pestaña nueva.
 */
export function with_authuser(meet_url, account) {
  const url = (meet_url || '').trim()
  if (!url) {
    return ''
  }
  const email = (account || '').trim()
  if (!email) {
    return url
  }
  /* Si el link ya trae authuser, se respeta el que vino y no se duplica el parámetro. */
  if (url.indexOf('authuser=') !== -1) {
    return url
  }
  const separator = url.indexOf('?') === -1 ? '?' : '&'
  return url + separator + 'authuser=' + encodeURIComponent(email)
}
