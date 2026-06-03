/**
 * Log solo en entorno no producción.
 */
const is_dev = import.meta.env.DEV

export function log_debug() {
  if (is_dev && console && console.log) {
    console.log.apply(console, arguments)
  }
}
