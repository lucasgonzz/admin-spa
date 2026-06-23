/**
 * Bloquea zoom por gestos (pinch) en iOS Safari y PWA standalone.
 * Complementa el meta viewport con user-scalable=no.
 *
 * @returns {void}
 */
export function init_mobile_viewport_lock() {
  /**
   * Eventos gesture* solo existen en WebKit (iOS); preventDefault evita el zoom.
   */
  document.addEventListener(
    'gesturestart',
    function (event) {
      event.preventDefault()
    },
    { passive: false }
  )
  document.addEventListener(
    'gesturechange',
    function (event) {
      event.preventDefault()
    },
    { passive: false }
  )
  document.addEventListener(
    'gestureend',
    function (event) {
      event.preventDefault()
    },
    { passive: false }
  )

  /**
   * Segundo dedo en touchmove = pinza; se cancela para no escalar la vista.
   */
  document.addEventListener(
    'touchmove',
    function (event) {
      if (event.touches && event.touches.length > 1) {
        event.preventDefault()
      }
    },
    { passive: false }
  )
}
