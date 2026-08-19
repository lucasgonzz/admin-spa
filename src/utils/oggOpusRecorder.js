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
 * ¿Esta página Ogg lleva audio, o es una de las dos cabeceras?
 *
 * La granule position son los bytes 6..13, little-endian. Vale 0 en las páginas de cabecera
 * (OpusHead y OpusTags) y la cantidad de muestras acumuladas en las de datos. Se recorren los ocho
 * bytes en vez de armar el número porque son 64 bits, que un entero de JavaScript no cubre exacto,
 * y acá solo hace falta saber si es distinto de cero.
 *
 * @param {Uint8Array} pagina
 * @returns {boolean}
 */
function pagina_con_audio(pagina) {
  if (!pagina || pagina.length < 27) {
    return false
  }
  if (pagina[0] !== 0x4f || pagina[1] !== 0x67 || pagina[2] !== 0x67 || pagina[3] !== 0x53) {
    return false
  }
  let acumulado = 0
  for (let i = 6; i <= 13; i++) {
    acumulado = acumulado | pagina[i]
  }
  return acumulado !== 0
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
 *     onData: (blob, origen) => { ... },  // origen es 'normal' o 'rescate' (nota truncada)
 *     onError: (err, fase) => { ... },    // fase es 'arranque' o 'cierre'
 *     minDurationMs: 700,                 // duración mínima real de grabación antes de cerrar
 *     stopTimeoutMs: 4000,                // cuánto se espera la confirmación de cierre
 *     startingTimeoutMs: 8000,            // cuánto se espera a que el micrófono arranque
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
      Se quedan los 4000 ms de siempre, y NO se bajan.

      La tentación es bajarlo ahora que el rescate entrega lo que haya: la espera se sentiría más
      corta. Pero el rescate NO es gratis -- siempre pierde la cola de la nota, hasta 800 ms, que
      es justo donde va el saludo del final. Bajar el tope a 2000 ms haría que un vaciado apenas
      lento (un iPhone viejo, el hilo principal trabado en una conversación larga) se lleve por
      delante un cierre que iba a terminar bien a los 2,5 s, y entregue truncado un audio que
      estaba entero. El rescate es el último recurso, no una carrera contra el encoder.

      Lo que sí cambió es que ahora la pantalla muestra "Cerrando…" durante esos segundos, así que
      la espera dejó de leerse como "el botón no anda", que era el motivo real de la queja.
    */
    this._stop_timeout_ms = typeof opts.stopTimeoutMs === 'number' ? opts.stopTimeoutMs : 4000
    /*
      Tope aparte para el arranque: si se pidió cortar mientras el grabador todavía cargaba y ese
      arranque nunca resuelve (una llamada entrante que se lleva el micrófono, otra app que lo
      tiene tomado, el WASM del encoder colgado con mala señal), el pedido de corte queda anotado
      esperando una promesa que no llega nunca y la interfaz no sale más de "grabando".
    */
    this._starting_timeout_ms =
      typeof opts.startingTimeoutMs === 'number' ? opts.startingTimeoutMs : 8000

    this._recorder = null
    this._state = 'idle'
    this._stop_requested = false
    this._discard = false
    this._recording_since = 0
    this._min_duration_timer = null
    this._stop_timeout_timer = null
    this._starting_timeout_timer = null
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

    /*
      El constructor va adentro de un try, y no es paranoia: `new Recorder()` corre
      initAudioContext(), que hace `new AudioContext()`, y Safari en iOS limita cuántos
      AudioContext puede tener viva una página. Como acá se crea uno por grabación, después de
      varias notas seguidas el constructor puede tirar SINCRÓNICAMENTE.

      Sin este try, esa excepción se escapa por afuera de la promesa -- o sea que el .catch() del
      consumidor nunca la ve --, sale disparada del handler del toque, y deja el wrapper en
      'starting' con audio_recording ya en true y sin ningún grabador atrás: la interfaz queda
      diciendo "grabando" para siempre y el botón de cortar no puede hacer nada, porque no hay
      nada que cortar. Es exactamente el síntoma que se está arreglando, por otra puerta.
    */
    let recorder = null
    try {
      recorder = new Recorder({
        encoderPath: encoderPath,
        numberOfChannels: 1,
        encoderSampleRate: 16000, // igual a lo que ya usaba la conversion ffmpeg para notas de voz
        encoderApplication: 2048, // 2048 = optimizado para voz (vs 2049 audio general)
        encoderBitRate: 32000,
      })
    } catch (err) {
      this._state = 'idle'
      this._on_error(err, 'arranque')
      return Promise.resolve()
    }

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
        self._on_data(blob, 'normal')
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
        /*
          Se consulta el descarte, igual que los otros tres caminos de error. Si el usuario ya tocó
          Cancelar --o si la vista se desmontó, que llama a cancel_audio_recording()-- mientras el
          micrófono todavía arrancaba, y recién después el arranque falla, avisarle "no se pudo
          acceder al micrófono" es hablarle de algo que ya había abandonado.

          Venía así desde antes de este arreglo; se cierra ahora porque es el único de los cuatro
          caminos de error del wrapper que no respetaba el descarte.
        */
        const era_descarte = self._discard
        self._force_release()
        if (!era_descarte) {
          self._on_error(err, 'arranque')
        }
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
      this._armar_tope_de_arranque()
      return
    }
    this._begin_stop()
  }

  /**
   * Arma el tope del estado 'starting': si el arranque no resuelve ni rechaza, el corte anotado
   * nunca se ejecuta y la interfaz queda en "grabando" para siempre. Este reloj es la única cosa
   * que puede sacarla de ahí, porque el resto de los topes se arman recién en _do_stop().
   *
   * No hay audio que rescatar en este caso: si el arranque no terminó, el micrófono nunca llegó
   * a capturar nada.
   *
   * @returns {void}
   */
  _armar_tope_de_arranque() {
    const self = this
    if (this._starting_timeout_timer) {
      return
    }
    this._starting_timeout_timer = setTimeout(function () {
      self._starting_timeout_timer = null
      if (self._state !== 'starting') {
        return
      }
      const era_descarte = self._discard
      self._force_release()
      if (!era_descarte) {
        self._on_error(
          new Error('El micrófono no llegó a arrancar. Probá de nuevo.'),
          'arranque'
        )
      }
    }, this._starting_timeout_ms)
  }

  /**
   * Detiene la grabación activa y DESCARTA lo grabado -- nunca llama a onData.
   *
   * Saltea la espera de minDurationMs cuando se cancela desde 'recording': ahí no tiene sentido
   * retener el micrófono para completar un mínimo de un audio que se va a tirar. Ojo con el otro
   * caso: si ya había un stop() esperando el temporizador del mínimo, cancel() solo marca el
   * descarte y sale, así que el micrófono se libera cuando ese temporizador vence -- hasta 700 ms
   * más tarde. Se respeta el descarte igual; lo que no se acorta es la espera.
   *
   * Mismo cuidado que stop() durante 'starting': no toca this._recorder ni suelta la referencia
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
      this._armar_tope_de_arranque()
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
      /*
        Hoy esto es inalcanzable: los tres llamadores (_begin_stop directo, el timer del mínimo de
        duración, y _begin_stop desde start().then()) llegan con el grabador puesto. Pero salir por
        acá en silencio dejaría el wrapper en 'stopping' sin ningún timer armado y sin llamar a
        ningún callback -- o sea, la interfaz colgada en "grabando" para siempre y sin una sola
        traza. Es exactamente el bug que este archivo existe para evitar, así que se cierra bien.
      */
      this._force_release()
      if (!this._discard) {
        this._on_error(new Error('La grabación se perdió antes de poder cerrarla.'), 'cierre')
      }
      return
    }

    /*
      El sostén va SINCRÓNICO acá, no adentro del setTimeout de abajo, porque incluye un
      audioContext.resume() y en Safari eso solo se concede adentro de un gesto de usuario real.

      Ojo: de los tres caminos que llegan a _do_stop(), solo uno viene del touchend. Los otros dos
      -- el timer del mínimo de duración y el corte diferido desde start().then() -- corren fuera
      de todo gesto, y ahí el resume() puede ser rechazado. No es un problema: en esos dos casos el
      contexto ya venía andando, porque el micrófono estaba capturando. El resume() está para el
      caso raro en que el sistema lo suspendió, y por eso conviene no desperdiciar el gesto cuando
      lo hay.
    */
    this._sostener_contexto()

    this._stop_timeout_timer = setTimeout(function () {
      self._cerrar_por_tope('El grabador no confirmó el cierre.')
    }, this._stop_timeout_ms)

    /*
      El pedido de cierre sale del gesto táctil, en su propia tarea.

      POR QUÉ: de los dos caminos de corte que tiene este wrapper, el único que se sabía que
      funcionaba en iPhone era el diferido -- el que se ejecuta desde el setTimeout del mínimo de
      duración cuando el corte llegó durante el arranque. El camino directo, que corría
      sincrónicamente adentro del touchend, era el que se colgaba. Poner los dos a correr desde su
      propia tarea los iguala, y no cuesta nada: son cuatro milisegundos y nada de lo que hace
      recorder.stop() (apagar los tracks, mandarle 'done' al encoder) necesita el gesto.
    */
    setTimeout(function () {
      if (self._recorder !== recorder) {
        /* se liberó entre medio: este cierre ya no le pertenece a nadie */
        return
      }
      try {
        recorder.stop()
      } catch (err) {
        /*
          También acá se intenta rescatar antes de dar la nota por perdida. Si stop() tira -- por
          ejemplo con el AudioContext ya cerrado por el sistema después de una interrupción de
          iOS --, las páginas siguen enteras en memoria: mandar a regrabar un minuto que estaba
          guardado es el mismo error que se acaba de arreglar en el camino del tope.
        */
        self._cerrar_por_tope(err && err.message ? err.message : 'No se pudo cerrar la grabación.')
      }
    }, 0)
  }

  /**
   * Cierre de último recurso: entrega lo que el encoder haya dejado guardado, o avisa el error si
   * no hay audio que valga la pena. Lo usan los dos caminos que pueden terminar mal -- el
   * vencimiento del tope y la excepción de recorder.stop() -- para que los dos se comporten igual.
   *
   * El blob rescatado se entrega con origen 'rescate'. Ese dato importa: sin él, una nota truncada
   * llega indistinguible de una entera, y si la causa de fondo del cuelgue no estuviera realmente
   * resuelta, el síntoma pasaría de ser un bug ruidoso a una degradación silenciosa permanente.
   *
   * @param {string} motivo
   * @returns {void}
   */
  _cerrar_por_tope(motivo) {
    const era_descarte = this._discard
    const rescatado = era_descarte ? null : this._rescatar_lo_grabado()
    this._force_release()
    if (era_descarte) {
      return
    }
    if (rescatado) {
      this._on_data(rescatado, 'rescate')
      return
    }
    this._on_error(new Error(motivo), 'cierre')
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

      /*
        🔴 No alcanza con "hay páginas": hay que exigir que haya AUDIO.

        Apenas el arranque resuelve, opus-recorder pide getHeaderPages y el encoder responde con
        dos páginas de cabecera (OpusHead y OpusTags) que entran a recordedPages igual que las de
        datos. O sea que después de cualquier arranque exitoso ya hay dos páginas y totalLength > 0
        SIN UN SOLO FRAME DE AUDIO. Si el cierre se cuelga antes de la primera página de datos --que
        es lo que pasa con una nota de menos de 800 ms, y también si el hilo de render nunca
        corrió-- un chequeo por cantidad de páginas daría por bueno un .ogg de cien bytes con puro
        encabezado, y se le mandaría al lead una nota de voz vacía sin un solo aviso. Es peor que el
        bug original: al menos ese se notaba.

        Las páginas de cabecera llevan granule position 0; las de datos, la cantidad de muestras
        decodificadas hasta ahí, que siempre es > 0. Por eso el corte se hace por granule position
        de la última página, y no por contarlas.
      */
      const HOJAS_DE_CABECERA = 2 // OpusHead + OpusTags, siempre dos
      if (paginas.length <= HOJAS_DE_CABECERA || !pagina_con_audio(paginas[paginas.length - 1])) {
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
    if (this._starting_timeout_timer) {
      clearTimeout(this._starting_timeout_timer)
      this._starting_timeout_timer = null
    }
  }
}

export default OggOpusRecorder
