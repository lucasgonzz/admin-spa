/**
 * Sonido de aviso para las notificaciones in-app de tareas asignadas.
 * Generado con la Web Audio API (osciladores), sin agregar ningún archivo de audio al repo.
 */

/** Instancia perezosa de AudioContext, creada recién en el primer llamado y reutilizada después. */
let audio_context = null

/**
 * Devuelve (creando si hace falta) el AudioContext compartido.
 * Se crea de forma perezosa —no en el mounted global— porque instanciarlo antes de
 * cualquier interacción del usuario no aporta nada y algunos navegadores lo dejan
 * suspendido igual hasta esa primera interacción.
 *
 * @returns {AudioContext|null}  null si el navegador no soporta Web Audio API.
 */
function get_audio_context() {
  if (audio_context) {
    return audio_context
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) {
    return null
  }
  audio_context = new AudioContextClass()
  return audio_context
}

/**
 * Reproduce un tono simple (oscilador senoidal) con una envolvente de ganancia que
 * sube y baja de forma suave, para evitar el "clic" de encender/apagar el oscilador
 * en seco.
 *
 * @param {AudioContext} ctx          Contexto de audio activo.
 * @param {number}       frequency    Frecuencia del tono en Hz.
 * @param {number}       start_time   Momento de inicio (en el reloj del propio ctx).
 * @param {number}       duration     Duración del tono en segundos.
 * @returns {void}
 */
function play_tone(ctx, frequency, start_time, duration) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  oscillator.connect(gain)
  gain.connect(ctx.destination)

  // Envolvente de ganancia: sube rápido, se sostiene y baja suave (evita chasquidos).
  gain.gain.setValueAtTime(0, start_time)
  gain.gain.linearRampToValueAtTime(0.2, start_time + 0.01)
  gain.gain.linearRampToValueAtTime(0.2, start_time + duration - 0.02)
  gain.gain.linearRampToValueAtTime(0, start_time + duration)

  oscillator.start(start_time)
  oscillator.stop(start_time + duration)
}

/**
 * Reproduce el sonido de aviso de una notificación de tarea nueva: dos tonos breves
 * encadenados (880 Hz y 1320 Hz, ~120 ms cada uno).
 *
 * Limitación de autoplay del navegador: hasta que el usuario no interactúe al menos
 * una vez con la página, el navegador puede bloquear cualquier audio (incluido este).
 * Como el flujo típico arranca con el login (que ya es una interacción real del
 * usuario), en la práctica el sonido suena igual; de todos modos el aviso visual
 * (tarjeta persistente + título de la pestaña parpadeando) es la garantía real de que
 * el admin se entera — este sonido es solo un refuerzo. Por eso toda la función está
 * envuelta en try/catch: un fallo de audio nunca debe romper el render de la app.
 *
 * @returns {void}
 */
export function play_notification_sound() {
  try {
    const ctx = get_audio_context()
    if (!ctx) {
      return
    }
    // Si el contexto quedó suspendido (política de autoplay), intentar reanudarlo;
    // si falla, seguimos igual: el resume() es best-effort.
    if (ctx.state === 'suspended') {
      ctx.resume().catch(function () { return null })
    }
    const now = ctx.currentTime
    play_tone(ctx, 880, now, 0.12)
    play_tone(ctx, 1320, now + 0.12, 0.12)
  } catch (err) {
    console.warn('[notification_sound] No se pudo reproducir el sonido de notificación:', err)
  }
}
