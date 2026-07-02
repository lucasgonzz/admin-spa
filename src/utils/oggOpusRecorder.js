import Recorder from 'opus-recorder'
import encoderPath from 'opus-recorder/dist/encoderWorker.min.js?url'

/**
 * Graba audio directamente a Ogg/Opus real usando WebAssembly (librería opus-recorder),
 * en lugar de depender de qué formato soporte el MediaRecorder nativo de cada navegador.
 *
 * Por qué existe: Chrome no soporta grabar en audio/ogg nativamente (graba webm), y Safari/iOS
 * graba en fMP4. El backend históricamente re-etiquetaba esos archivos como "audio/ogg" sin
 * convertir el contenedor real, lo cual Meta rechaza con el error 131053 ("mimetype ogg pero
 * el contenido no es ogg"). Con esta librería, el archivo que sale del navegador ya es un
 * .ogg válido byte por byte, sin importar el navegador — no hace falta ninguna conversión
 * server-side.
 *
 * Uso:
 *   const recorder = new OggOpusRecorder({
 *     onData: (blob) => { ... },   // blob tipo 'audio/ogg', se llama una vez al detener
 *     onError: (err) => { ... },   // permiso denegado u otro error al iniciar
 *   })
 *   recorder.start() // DEBE llamarse desde un gesto de usuario (click/touch), si no falla en Safari
 *   recorder.stop()
 */
export class OggOpusRecorder {
  constructor(options) {
    const opts = options || {}
    this._on_data = opts.onData || function () {}
    this._on_error = opts.onError || function () {}
    this._recorder = null
  }

  /**
   * @returns {boolean} true si el navegador puede grabar con esta librería.
   */
  static isSupported() {
    try {
      return !!Recorder.isRecordingSupported()
    } catch (err) {
      return false
    }
  }

  /**
   * Inicia una nueva grabación. Debe llamarse desde un gesto de usuario.
   *
   * @returns {Promise<void>}
   */
  start() {
    const self = this
    if (this._recorder) {
      return Promise.resolve()
    }
    const recorder = new Recorder({
      encoderPath: encoderPath,
      numberOfChannels: 1,
      encoderSampleRate: 16000, // igual a lo que ya usaba la conversión ffmpeg para notas de voz
      encoderApplication: 2048, // 2048 = optimizado para voz (vs 2049 audio general)
      encoderBitRate: 32000,
    })
    recorder.ondataavailable = function (typed_array) {
      const blob = new Blob([typed_array], { type: 'audio/ogg' })
      self._on_data(blob)
      try {
        recorder.close()
      } catch (err) {
        /* noop */
      }
    }
    this._recorder = recorder
    return recorder.start().catch(function (err) {
      self._recorder = null
      self._on_error(err)
      throw err
    })
  }

  /**
   * Detiene la grabación activa. El blob llega de forma asíncrona vía el callback onData.
   *
   * @returns {void}
   */
  stop() {
    if (!this._recorder) {
      return
    }
    try {
      this._recorder.stop()
    } catch (err) {
      /* noop */
    }
    this._recorder = null
  }
}

export default OggOpusRecorder
