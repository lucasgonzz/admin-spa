import Recorder from 'opus-recorder'
import encoderPath from 'opus-recorder/dist/encoderWorker.min.js?url'

/*
  Tabla del CRC-32 de Ogg: polinomio 0x04c11db7, sin reflejar entrada ni salida, sin xor final.
  NO es el CRC-32 de zip/PNG -- ese va reflejado y con xor, y da otro número. Se arma una sola vez.
*/
let TABLA_CRC_OGG = null

/**
 * @returns {Uint32Array} tabla de 256 entradas del CRC-32 de Ogg.
 */
function tabla_crc_ogg() {
  if (TABLA_CRC_OGG) {
    return TABLA_CRC_OGG
  }
  const tabla = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let r = i << 24
    for (let j = 0; j < 8; j++) {
      r = (r & 0x80000000) !== 0 ? (r << 1) ^ 0x04c11db7 : r << 1
    }
    tabla[i] = r >>> 0
  }
  TABLA_CRC_OGG = tabla
  return tabla
}

/**
 * @param {Uint8Array} bytes
 * @returns {number} CRC-32 de Ogg de esos bytes, sin signo.
 */
function crc_ogg(bytes) {
  const tabla = tabla_crc_ogg()
  let crc = 0
  for (let i = 0; i < bytes.length; i++) {
    crc = ((crc << 8) ^ tabla[((crc >>> 24) & 0xff) ^ bytes[i]]) >>> 0
  }
  return crc >>> 0
}

/**
 * Marca la última página Ogg como fin de stream (bit 0x04 del byte 5 de la cabecera) y recalcula
 * su CRC, que vive en los bytes 22..25 en little-endian.
 *
 * POR QUÉ existe: cuando el encoder no confirma el cierre, el rescate arma el archivo con las
 * páginas que ya estaban guardadas. Esas páginas son un Ogg válido salvo por un detalle: ninguna
 * tiene el bit de fin de stream, porque ese bit lo pone el encoder recién en la página final que
 * nunca llegó. Un .ogg sin fin de stream es un archivo truncado, y Meta rechaza archivos que no
 * puede validar.
 *
 * POR QUÉ se auto-verifica antes de tocar nada: si el CRC que calculamos no reproduce el que la
 * página ya traía, entonces nuestra implementación del CRC está mal o el formato cambió, y en ese
 * caso lo correcto es devolver las páginas intactas -- un archivo sin fin de stream tiene chances
 * de reproducirse igual; uno con el CRC roto, ninguna.
 *
 * @param {Uint8Array} pagina última página del stream (se modifica en el lugar si se puede)
 * @returns {boolean} true si quedó marcada como fin de stream.
 */
function marcar_fin_de_stream(pagina) {
  if (!pagina || pagina.length < 27) {
    return false
  }
  if (pagina[0] !== 0x4f || pagina[1] !== 0x67 || pagina[2] !== 0x67 || pagina[3] !== 0x53) {
    /* no arranca con "OggS": no es una página Ogg, no se toca */
    return false
  }

  const crc_guardado =
    (pagina[22] | (pagina[23] << 8) | (pagina[24] << 16) | (pagina[25] << 24)) >>> 0

  /* El CRC se calcula sobre la página con su propio campo de CRC en cero. */
  pagina[22] = 0
  pagina[23] = 0
  pagina[24] = 0
  pagina[25] = 0
  const crc_recalculado = crc_ogg(pagina)

  if (crc_recalculado !== crc_guardado) {
    /* No sabemos calcular este CRC: se restaura el original y se deja la página como estaba. */
    pagina[22] = crc_guardado & 0xff
    pagina[23] = (crc_guardado >>> 8) & 0xff
    pagina[24] = (crc_guardado >>> 16) & 0xff
    pagina[25] = (crc_guardado >>> 24) & 0xff
    return false
  }

  pagina[5] = pagina[5] | 0x04
  const crc_final = crc_ogg(pagina)
  pagina[22] = crc_final & 0xff
  pagina[23] = (crc_final >>> 8) & 0xff
  pagina[24] = (crc_final >>> 16) & 0xff
  pagina[25] = (crc_final >>> 24) & 0xff
  return true
}

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
 * Máquina de estados propia (bug del 3/8/2026 en iPhone — ver prompt 01 del grupo 323):
 * 'idle' -> 'starting' -> 'recording' -> 'stopping' -> 'idle'. opus-recorder 8.0.5 ignora
 * cualquier stop() pedido mientras su propio estado interno es "loading" (la ventana entre que
 * arranca getUserMedia + la carga del WASM del encoder y que resuelve la promesa de start()) —
 * es un no-op silencioso. Si un stop() llega en ese momento, la intención queda anotada
 * (_stop_requested) y se ejecuta recién cuando el start() resuelve, en vez de perderse.
 *
 * Garantía dura: para todo start() que se llega a disparar, tarde o temprano sale exactamente
 * uno de los dos callbacks — onData (con el blob) u onError —, nunca ninguno de los dos y nunca
 * los dos. Eso es lo que evita que la interfaz quede colgada en "grabando" para siempre.
 *
 * Segunda garantía, agregada el 19/8/2026: **vencer el tope de cierre ya no pierde el audio**.
 * Ver _rescatar_lo_grabado().
 *
 * Uso:
 *   const recorder = new OggOpusRecorder({
 *     onData: (blob) => { ... },        // blob tipo 'audio/ogg', se llama una vez al detener
 *     onError: (err, fase) => { ... },  // fase es 'arranque' o 'cierre'
 *     minDurationMs: 700,               // duración mínima real de grabación antes de cerrar
 *     stopTimeoutMs: 2000,              // cuánto se espera la confirmación de cierre
 *   })
 *   recorder.start()  // DEBE llamarse desde un gesto de usuario (click/touch), si no falla en Safari
 *   recorder.stop()   // corta y guarda
 *   recorder.cancel() // corta y descarta -- nunca llama a onData
 */
export class OggOpusRecorder {
  constructor(options) {
    const opts = options || {}
    this._on_data = opts.onData || function () {}
    this._on_error = opts.onError || function () {}
    this._min_duration_ms = typeof opts.minDurationMs === 'number' ? opts.minDurationMs : 700
    /*
      2000 ms y no 4000: con el rescate de _rescatar_lo_grabado(), vencer el tope dejó de
      significar perder la nota de voz, así que no hay ningún motivo para tener al usuario
      cuatro segundos mirando un botón que parece muerto. Un flush normal del encoder tarda
      milisegundos -- ya venía codificando durante toda la grabación.
    */
    this._stop_timeout_ms = typeof opts.stopTimeoutMs === 'number' ? opts.stopTimeoutMs : 2000

    this._recorder = null
    this._state = 'idle'
    this._stop_requested = false
    this._discard = false
    this._recording_since = 0
    this._min_duration_timer = null
    this._stop_timeout_timer = null
    this._sosten = null
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
   * Estado actual del grabador.
   *
   * @returns {'idle'|'starting'|'recording'|'stopping'}
   */
  get state() {
    return this._state
  }

  /**
   * @returns {boolean} true si hay una grabación en curso (en cualquiera de sus tres estados
   * no-idle) -- útil para decidir si un toque nuevo debe alternar o esperar.
   */
  is_active() {
    return this._state !== 'idle'
  }

  /**
   * Inicia una nueva grabación. Debe llamarse desde un gesto de usuario.
   *
   * @returns {Promise<void>}
   */
  start() {
    const self = this
    if (this._state !== 'idle') {
      return Promise.resolve()
    }
    this._state = 'starting'
    this._stop_requested = false
    this._discard = false

    const recorder = new Recorder({
      encoderPath: encoderPath,
      numberOfChannels: 1,
      encoderSampleRate: 16000, // igual a lo que ya usaba la conversion ffmpeg para notas de voz
      encoderApplication: 2048, // 2048 = optimizado para voz (vs 2049 audio general)
      encoderBitRate: 32000,
    })

    recorder.ondataavailable = function (typed_array) {
      // Guarda contra una confirmacion tardia: si el encoder tarda mas que
      // stopTimeoutMs en flushear, _force_release() ya corrio por el reloj de
      // seguridad y ya se entrego el rescate (o se aviso onError). Si ademas ya
      // hay un start() nuevo en curso, este "done" viejo no le pertenece -- sin
      // esto se colaria un onData de mas (violando la garantia de "nunca los
      // dos") o cerraria la grabacion siguiente por error.
      if (self._recorder !== recorder) {
        return
      }
      // El orden importa: el consumidor puede pedir una grabacion nueva desde
      // adentro de onData, y tiene que encontrar el wrapper en 'idle'. Por eso
      // se libera (cierra + vuelve a 'idle') ANTES de llamar a on_data.
      const era_descarte = self._discard
      self._force_release()
      if (!era_descarte) {
        const blob = new Blob([typed_array], { type: 'audio/ogg' })
        self._on_data(blob)
      }
    }

    this._recorder = recorder
    return recorder
      .start()
      .then(function () {
        // Aca opus-recorder ya esta en "recording" (lo pone el antes de resolver).
        self._recording_since = Date.now()
        if (self._stop_requested) {
          self._stop_requested = false
          self._begin_stop()
          return
        }
        self._state = 'recording'
      })
      .catch(function (err) {
        self._force_release()
        self._on_error(err, 'arranque')
        throw err
      })
  }

  /**
   * Detiene la grabación activa y guarda lo grabado. El blob llega de forma asíncrona vía
   * el callback onData. Si se llama mientras el grabador todavía está iniciando, el pedido
   * de corte queda anotado y se ejecuta apenas termine de iniciar -- nunca se pierde.
   *
   * @returns {void}
   */
  stop() {
    if (this._state === 'idle' || this._state === 'stopping') {
      return
    }
    if (this._state === 'starting') {
      /*
        NO llamar a this._recorder.stop() acá, y NO soltar la referencia.

        POR QUE (no "simplificar" esto de vuelta): opus-recorder 8.0.5 ignora stop() mientras su
        estado interno es "loading" -- la ventana entre que arranca getUserMedia + la carga del
        WASM del encoder y que resuelve la promesa de start(). Es un no-op silencioso: no tira,
        no avisa. Si ademas soltabamos this._recorder = null como se hacia antes, el wrapper
        quedaba creyendo que no habia nada activo y CUALQUIER stop() posterior salia por el guard
        de arriba, mientras el microfono seguia grabando para siempre. Eso es exactamente el bug
        del 3/8/2026 en iPhone: en tactil el stop llega ~100 ms despues del start, o sea siempre
        adentro de la ventana de loading, y despues no habia forma de cortar sin recargar.

        Lo correcto es dejar la intencion anotada y ejecutarla cuando el start() resuelva.
      */
      this._stop_requested = true
      return
    }
    this._begin_stop()
  }

  /**
   * Detiene la grabación activa y DESCARTA lo grabado -- nunca llama a onData. Ignora
   * minDurationMs (cancelar tiene que liberar el micrófono ya, no esperar el mínimo). Mismo
   * cuidado que stop() durante 'starting': no toca this._recorder ni suelta la referencia
   * hasta que start() resuelva.
   *
   * @returns {void}
   */
  cancel() {
    if (this._state === 'idle') {
      return
    }
    /*
      Ojo con el orden: _discard se marca ANTES de cualquier salida temprana.

      Si el cierre ya está en curso ('stopping'), no hay nada nuevo que pedirle a la librería
      -- pero sí hay que dejar anotado que esto es un descarte, porque el blob todavía no salió.
      Antes esta rama salía por el guard de arriba sin marcar nada: el usuario tocaba Cancelar,
      la interfaz se apagaba, y un rato después llegaba el ondataavailable y la nota se enviaba
      igual. Con el cierre pudiendo tardar segundos, esa ventana dejó de ser teórica.
    */
    this._discard = true
    if (this._state === 'stopping') {
      return
    }
    if (this._state === 'starting') {
      this._stop_requested = true
      return
    }
    this._begin_stop()
  }

  /**
   * Arranca el cierre: pasa a 'stopping' y, si no es un descarte y todavía falta para llegar
   * a minDurationMs, posterga el cierre real hasta cumplirlo (un toque corto no puede producir
   * un .ogg de milisegundos que Meta rechace).
   *
   * @returns {void}
   */
  _begin_stop() {
    const self = this
    this._state = 'stopping'

    if (this._discard) {
      this._do_stop()
      return
    }

    const transcurrido = Date.now() - this._recording_since
    const falta = this._min_duration_ms - transcurrido
    if (falta > 0) {
      this._min_duration_timer = setTimeout(function () {
        self._min_duration_timer = null
        self._do_stop()
      }, falta)
      return
    }
    this._do_stop()
  }

  /**
   * Pide el cierre real a la librería, con un reloj de seguridad: si la confirmación
   * (ondataavailable) no llega en stopTimeoutMs, se rescata lo que el encoder ya tenía
   * guardado y se entrega igual por onData. Solo si no hay ni una página que rescatar se
   * avisa por onError. Así la interfaz nunca queda colgada en "grabando" esperando algo que
   * no va a llegar, y el usuario no pierde la nota que acaba de grabar.
   *
   * @returns {void}
   */
  _do_stop() {
    const self = this
    const recorder = this._recorder
    if (!recorder) {
      return
    }

    this._sostener_contexto()

    this._stop_timeout_timer = setTimeout(function () {
      const era_descarte = self._discard
      const rescatado = era_descarte ? null : self._rescatar_lo_grabado()
      self._force_release()
      if (era_descarte) {
        return
      }
      if (rescatado) {
        self._on_data(rescatado)
        return
      }
      self._on_error(new Error('La grabación no se pudo cerrar. Volvé a intentar.'), 'cierre')
    }, this._stop_timeout_ms)

    try {
      recorder.stop()
    } catch (err) {
      const era_descarte = self._discard
      self._force_release()
      if (!era_descarte) {
        self._on_error(err, 'cierre')
      }
    }
  }

  /**
   * Enchufa un nodo mudo a la salida del AudioContext mientras se cierra la grabación, y lo
   * suelta en _force_release().
   *
   * POR QUÉ (no lo saques porque "no hace nada"): Recorder.prototype.stop() de opus-recorder
   * 8.0.5 hace tres cosas en el mismo renglón -- desconecta el monitorGainNode, que es el ÚNICO
   * nodo enchufado a destination; apaga los tracks del micrófono; y recién ahí le manda 'done'
   * al encoder. El encoder es un AudioWorkletNode creado con numberOfOutputs: 0, o sea que no
   * llega a destination por su cuenta, y su port.onmessage corre en el hilo de render del audio.
   * Si el grafo se queda sin fuente y sin salida, WebKit puede frenar ese hilo: el 'done' nunca
   * se procesa, ondataavailable nunca sale y la grabación queda colgada para siempre. El nodo
   * mudo (ganancia 0, inaudible) mantiene el grafo con una razón para seguir renderizando hasta
   * que el encoder termine de vaciar.
   *
   * @returns {void}
   */
  _sostener_contexto() {
    if (!this._recorder || this._sosten) {
      return
    }
    try {
      const ctx = this._recorder.audioContext
      if (!ctx || ctx.state === 'closed') {
        return
      }
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        /* Estamos adentro del gesto del usuario: es el mejor momento posible para resumir. */
        ctx.resume().catch(function () {
          /* si no se puede resumir, el tope de cierre y el rescate cubren el caso */
        })
      }
      const silencio = ctx.createGain()
      silencio.gain.value = 0
      const oscilador = ctx.createOscillator()
      oscilador.connect(silencio)
      silencio.connect(ctx.destination)
      oscilador.start()
      this._sosten = { oscilador: oscilador, silencio: silencio }
    } catch (err) {
      /* si no se pudo, seguimos igual: el rescate cubre el caso */
    }
  }

  /**
   * @returns {void}
   */
  _soltar_sosten() {
    if (!this._sosten) {
      return
    }
    const sosten = this._sosten
    this._sosten = null
    try {
      sosten.oscilador.stop()
    } catch (err) {
      /* noop */
    }
    try {
      sosten.oscilador.disconnect()
    } catch (err) {
      /* noop */
    }
    try {
      sosten.silencio.disconnect()
    } catch (err) {
      /* noop */
    }
  }

  /**
   * Arma un blob con las páginas Ogg que el encoder ya tenía terminadas, para cuando la
   * confirmación de cierre nunca llega.
   *
   * opus-recorder va acumulando cada página cerrada en recorder.recordedPages (y su largo total
   * en recorder.totalLength) a medida que graba; el 'done' del final solo agrega la última página
   * incompleta. O sea que cuando el cierre se cuelga, el audio del usuario **ya está en memoria**:
   * lo único que se pierde son los últimos ≤800 ms (maxFramesPerPage 40 × encoderFrameSize 20 ms).
   *
   * Antes de esto, vencer el tope tiraba la grabación entera y mostraba un error. Perder el final
   * de una nota de voz es molesto; perderla entera después de hablar un minuto es inaceptable.
   *
   * @returns {Blob|null} el blob rescatado, o null si no había nada que rescatar.
   */
  _rescatar_lo_grabado() {
    try {
      const recorder = this._recorder
      if (!recorder || !recorder.recordedPages || !recorder.recordedPages.length) {
        return null
      }
      const paginas = recorder.recordedPages
      const total = recorder.totalLength || 0
      if (!total) {
        return null
      }

      /* Se copia cada página: marcar el fin de stream escribe sobre los bytes. */
      const salida = new Uint8Array(total)
      let posicion = 0
      let ultima_desde = 0
      for (let i = 0; i < paginas.length; i++) {
        ultima_desde = posicion
        salida.set(paginas[i], posicion)
        posicion += paginas[i].length
      }
      marcar_fin_de_stream(salida.subarray(ultima_desde, posicion))

      return new Blob([salida], { type: 'audio/ogg' })
    } catch (err) {
      return null
    }
  }

  /**
   * Libera todo incondicionalmente: cierra el recorder (apaga el micrófono de verdad --
   * close() corre clearStream() y detiene los tracks), suelta la referencia, vuelve a 'idle'
   * y limpia los dos timers. Es la ÚNICA forma de soltar this._recorder fuera del
   * ondataavailable normal.
   *
   * @returns {void}
   */
  _force_release() {
    this._soltar_sosten()
    if (this._recorder) {
      try {
        this._recorder.close()
      } catch (err) {
        /* noop */
      }
    }
    this._recorder = null
    this._state = 'idle'
    this._recording_since = 0
    this._clear_timers()
  }

  /**
   * @returns {void}
   */
  _clear_timers() {
    if (this._min_duration_timer) {
      clearTimeout(this._min_duration_timer)
      this._min_duration_timer = null
    }
    if (this._stop_timeout_timer) {
      clearTimeout(this._stop_timeout_timer)
      this._stop_timeout_timer = null
    }
  }
}

export default OggOpusRecorder
