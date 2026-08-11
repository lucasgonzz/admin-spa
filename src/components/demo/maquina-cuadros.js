/**
 * La máquina de la escena hero, reproducida desde cuadros PRE-RENDERIZADOS (misión 12,
 * pieza 1). Reemplaza a `escena-maquina.js`, que la renderizaba en vivo con three.js y
 * se borró junto con esa dependencia.
 *
 * Por qué, textual de Lucas (7/8/2026): *"sigue andando bastante lento... lo que
 * quedaría hacer es o hacer que se precargue mientras estoy viendo los dolores, o
 * directamente montarlo como un video en loop o como un GIF"*, y *"no me importa
 * sacrificar el funcionamiento del scroll con tal de que fluya y se aprecie bien"*.
 *
 * Qué se gana y qué se pierde, sin adornos:
 *
 *  · **Se gana fluidez por construcción, no por optimización.** Dibujar una imagen ya
 *    decodificada en un canvas 2D es una copia de píxeles; lo que había antes era WebGL
 *    con antialias, cuatro luces direccionales, geometrías extruidas con
 *    `curveSegments: 22` y dos texturas, sesenta veces por segundo. No hay medición de
 *    fps acá porque no hace falta: son órdenes de magnitud distintos.
 *  · **Se pierde la reacción de la máquina al scroll** (`power` y `suck`). Los cuadros
 *    están renderizados con la máquina encendida y sin succión. Lo que SÍ se conserva
 *    es la escala y el resplandor del `core-glow`, que son CSS atados a `--power` y no
 *    dependían de esto.
 *
 * El formato es una secuencia de WebP con canal alfa, uno por cuadro, en
 * `public/demo/maquina/<perfil>/NNNN.webp`, con su `manifiesto.json`. Los genera
 * `scripts/generar-cuadros-maquina/generar.mjs`, que es el único lugar donde queda algo
 * de three. GIF quedó descartado de entrada: 256 colores y sin alfa parcial, sobre un
 * fondo con degradé.
 *
 * 🔴 SOBRE EL ENCUADRE: las tiras están renderizadas con el aspecto exacto en el que la
 * escena original dejaba de alejar la cámara (1,6531), así que dibujarlas con `contain`
 * reproduce el encuadre viejo en cualquier tamaño de pantalla. El porqué completo está
 * en el comentario ENCUADRE de `scripts/generar-cuadros-maquina/escena-determinista.js`.
 * Si alguien cambia el aspecto de las tiras sin leer eso, la máquina va a quedar de otro
 * tamaño respecto del resto de la escena y nada va a avisar.
 */

/** Dónde viven las tiras. Sin `import`: son assets de `public/`, no del bundle. */
const BASE = '/demo/maquina/'

/**
 * Cuántos cuadros se piden a la vez. La tira son 120 archivos chicos; pedirlos todos
 * de una satura la cola de red del navegador justo cuando el lead está scrolleando los
 * bloques de dolor, que es lo que esta precarga viene a NO estorbar.
 */
const CONCURRENCIA = 6

/**
 * La precarga en curso o ya resuelta, y cuántos reproductores la están usando. Vive a
 * nivel de módulo porque la piden dos componentes distintos (ScrollDolor, para que
 * arranque cuatro pantallas antes, y EscenaHero, por si el lead llegó directo) y tiene
 * que ser la misma descarga.
 */
let precarga = null
let usuarios = 0

/**
 * Perfil de tira según el ancho de la ventana. Mismo breakpoint que usa toda la página.
 *
 * @returns {string}
 */
function perfil_actual() {
  return typeof window !== 'undefined' && window.innerWidth <= 767.98 ? 'telefono' : 'escritorio'
}

/**
 * Pixel ratio con el que se dimensiona el canvas. Es el mismo criterio -- y los mismos
 * topes -- que usaba el renderer 3D (grupo 370, correctivo 8, prompt 04): 1,5 en
 * general, 1 en teléfonos de gama baja. Acá pesa menos que antes (una copia de píxeles
 * no es un render), pero el ancho de las tiras se eligió contra estos topes, así que
 * subirlo no daría más nitidez: daría escalado hacia arriba.
 *
 * @returns {number}
 */
function pixel_ratio() {
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1
  const memoria = typeof navigator !== 'undefined' ? navigator.deviceMemory : undefined
  const nucleos = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined
  const gama_baja = !!((memoria && memoria <= 4) || (nucleos && nucleos <= 4))
  if (typeof window !== 'undefined' && window.innerWidth <= 767.98 && gama_baja) {
    return Math.min(dpr, 1)
  }
  return Math.min(dpr, 1.5)
}

/**
 * Baja y decodifica un cuadro.
 *
 * 🔴 Decodifica a ImageBitmap, no alcanza con precargar el `<img>`: un `<img>` cargado
 * sigue teniendo que decodificarse la primera vez que se dibuja, y esa primera vez cae
 * justo cuando el lead llega a la escena -- que es el tirón que esta precarga viene a
 * sacar. `createImageBitmap` decodifica ahora y deja los píxeles listos.
 *
 * @param {string} url
 * @returns {Promise<ImageBitmap>}
 */
function bajar_cuadro(url) {
  return window
    .fetch(url, { credentials: 'omit' })
    .then(function (respuesta) {
      if (!respuesta.ok) {
        throw new Error('cuadro ' + url + ': ' + respuesta.status)
      }
      return respuesta.blob()
    })
    .then(function (blob) {
      return window.createImageBitmap(blob)
    })
}

/**
 * Corre `tarea` sobre cada elemento de `lista` con un tope de tareas en paralelo.
 *
 * @param {Array} lista
 * @param {number} tope
 * @param {function} tarea
 * @returns {Promise<Array>}
 */
function en_tandas(lista, tope, tarea) {
  const resultados = new Array(lista.length)
  let siguiente = 0

  /**
   * @returns {Promise<void>}
   */
  function trabajador() {
    if (siguiente >= lista.length) {
      return Promise.resolve()
    }
    const indice = siguiente
    siguiente += 1
    return tarea(lista[indice], indice).then(function (valor) {
      resultados[indice] = valor
      return trabajador()
    })
  }

  const trabajadores = []
  let i = 0
  for (i = 0; i < Math.min(tope, lista.length); i += 1) {
    trabajadores.push(trabajador())
  }
  return Promise.all(trabajadores).then(function () {
    return resultados
  })
}

/**
 * Baja y decodifica la tira entera. Idempotente: la primera llamada arranca el trabajo
 * y las siguientes devuelven la misma promesa.
 *
 * La llama ScrollDolor cuando el lead entra al primer bloque de dolor -- cuatro
 * pantallas antes de la escena, que es todo el punto -- y también EscenaHero al
 * acercarse, por si el lead entró con la escena ya a la vista.
 *
 * Nunca rechaza: si algo falla devuelve lo que haya podido decodificar (o null), y el
 * reproductor decide. Una página pública no puede quedarse con un hueco porque un
 * archivo dio 404.
 *
 * @returns {Promise<{cuadros: Array, fps: number, duracion_s: number, completa: boolean}|null>}
 */
export function precargar_cuadros() {
  if (precarga) {
    return precarga
  }
  if (typeof window === 'undefined' || !window.fetch || !window.createImageBitmap) {
    precarga = Promise.resolve(null)
    return precarga
  }

  const perfil = perfil_actual()

  precarga = window
    .fetch(BASE + 'manifiesto.json', { credentials: 'omit' })
    .then(function (respuesta) {
      return respuesta.json()
    })
    .then(function (manifiesto) {
      const datos = manifiesto.perfiles.filter(function (p) {
        return p.nombre === perfil
      })[0]
      if (!datos) {
        return null
      }
      const urls = []
      let i = 0
      for (i = 0; i < datos.cuadros; i += 1) {
        urls.push(BASE + perfil + '/' + String(i).padStart(4, '0') + '.webp')
      }
      return en_tandas(urls, CONCURRENCIA, function (url) {
        /* Un cuadro que falla no tira abajo la tira entera: se marca null y el
           reproductor pasa a cuadro fijo si faltó alguno. */
        return bajar_cuadro(url).catch(function () {
          return null
        })
      }).then(function (bitmaps) {
        const buenos = bitmaps.filter(Boolean)
        if (!buenos.length) {
          return null
        }
        return {
          cuadros: buenos,
          fps: datos.fps,
          duracion_s: manifiesto.duracion_s,
          completa: buenos.length === bitmaps.length,
        }
      })
    })
    .catch(function () {
      return null
    })

  return precarga
}

/**
 * Suelta la tira cuando NADIE llegó a montar un reproductor con ella.
 *
 * 🔴 Este es el agujero que `destruir()` no puede tapar, porque ahí nunca hubo nada que
 * destruir. `usuarios` se incrementa recién dentro de `crear_reproductor()`, así que si
 * la tira se pide y nadie llega a montar un reproductor, los 120 ImageBitmap terminan de
 * decodificarse contra una página que ya no existe y se quedan vivos en la caché del
 * módulo. Son ~120 MB. Hay dos caminos, los dos alcanzables:
 *
 *  1. El lead entra al primer bloque de dolor -- ahí arranca la descarga -- y se va antes
 *     de llegar a la escena.
 *  2. El lead **envía el formulario** con la descarga todavía en vuelo. Este es el peor,
 *     porque es el camino de conversión y no un caso raro: el recorrido entero se
 *     desmonta por `v-if` (ExperienciaDemo.vue), y cuando la promesa resuelve, el `.then`
 *     de `EscenaHero.arrancar()` corta por `desmontado` sin llamar a `crear_reproductor`.
 *
 * Idempotente y segura de llamar con la descarga a mitad de camino: lo que todavía no
 * se decodificó se cierra cuando resuelva.
 *
 * @returns {void}
 */
export function soltar_cuadros() {
  if (usuarios > 0 || !precarga) {
    return
  }
  const pendiente = precarga
  precarga = null
  pendiente.then(function (tira) {
    if (!tira) {
      return
    }
    tira.cuadros.forEach(function (bitmap) {
      if (bitmap && bitmap.close) {
        bitmap.close()
      }
    })
  })
}

/**
 * Monta el reproductor sobre `canvas`.
 *
 * Devuelve la MISMA interfaz que devolvía `crear_maquina()`, para que EscenaHero y la
 * coreografía no tengan que saber que atrás cambió todo: `set_progreso` sigue existiendo
 * (aunque ya no haga nada), y `pausar`/`reanudar`/`relayout`/`destruir` siguen
 * significando lo mismo.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object|null} tira Lo que resolvió precargar_cuadros().
 * @returns {{set_progreso: function, relayout: function, pausar: function, reanudar: function, destruir: function}|null}
 *          null si no hay con qué dibujar -- el llamador muestra el isotipo estático.
 */
export function crear_reproductor(canvas, tira) {
  if (!canvas || !tira || !tira.cuadros.length) {
    return null
  }

  const contexto = canvas.getContext('2d')
  if (!contexto) {
    return null
  }

  const reduced_motion = !!(
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  /* Un cuadro y nada más: sin animación bajo reduced-motion, y también si la tira quedó
     incompleta -- una tira con huecos se reproduce a los saltos, y un cuadro quieto es
     mejor que un tartamudeo. */
  const fijo = reduced_motion || !tira.completa

  usuarios += 1

  let raf_id = null
  let destruido = false
  let arranque_ms = window.performance.now()
  /* Cuál es el cuadro que ya está dibujado. Sirve para no repintar: la tira corre a 10
     cuadros por segundo y la pantalla refresca a 60, así que cinco de cada seis vueltas
     del bucle no tienen nada nuevo que mostrar. */
  let dibujado = -1

  /**
   * Ajusta el tamaño real del canvas al que ocupa en pantalla.
   *
   * @returns {void}
   */
  function relayout() {
    if (destruido || !canvas) {
      return
    }
    const ratio = pixel_ratio()
    const ancho = Math.max(1, Math.round((canvas.clientWidth || 1) * ratio))
    const alto = Math.max(1, Math.round((canvas.clientHeight || 1) * ratio))
    if (canvas.width !== ancho || canvas.height !== alto) {
      canvas.width = ancho
      canvas.height = alto
      /* Cambiar el tamaño del canvas lo deja en blanco, así que el cuadro que estaba
         dibujado ya no está: hay que volver a pintarlo aunque el índice no cambie. */
      dibujado = -1
      pintar(indice_para(window.performance.now()))
    }
  }

  /**
   * @param {number} ahora_ms
   * @returns {number} Índice del cuadro que corresponde a este instante.
   */
  function indice_para(ahora_ms) {
    if (fijo) {
      return 0
    }
    const transcurrido = (ahora_ms - arranque_ms) / 1000
    const vuelta = transcurrido % tira.duracion_s
    const indice = Math.floor(vuelta * tira.fps)
    return indice % tira.cuadros.length
  }

  /**
   * Dibuja el cuadro `indice` con `contain`: la imagen entra entera, centrada, sin
   * deformarse ni recortarse. Ver el comentario del ENCUADRE arriba -- esto es lo que
   * hace que la máquina quede donde estaba.
   *
   * @param {number} indice
   * @returns {void}
   */
  function pintar(indice) {
    if (destruido || indice === dibujado) {
      return
    }
    const bitmap = tira.cuadros[indice]
    if (!bitmap) {
      return
    }
    const escala = Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height)
    const ancho = bitmap.width * escala
    const alto = bitmap.height * escala
    contexto.clearRect(0, 0, canvas.width, canvas.height)
    contexto.drawImage(bitmap, (canvas.width - ancho) / 2, (canvas.height - alto) / 2, ancho, alto)
    dibujado = indice
  }

  /**
   * 🔴 requestAnimationFrame + performance.now(), NO setInterval. Un intervalo sigue
   * disparando con la pestaña oculta (throttleado y descoordinado del refresco de la
   * pantalla) y acumula deriva; rAF se sincroniza con el compositor y el navegador lo
   * frena solo cuando la pestaña no se está viendo. El índice se calcula del reloj, no
   * de un contador, así que un cuadro perdido no desfasa la reproducción.
   *
   * @returns {void}
   */
  function tick() {
    if (destruido) {
      return
    }
    pintar(indice_para(window.performance.now()))
    raf_id = window.requestAnimationFrame(tick)
  }

  relayout()
  pintar(0)
  window.addEventListener('resize', relayout, { passive: true })
  if (!fijo) {
    raf_id = window.requestAnimationFrame(tick)
  }

  return {
    /**
     * Existe para no romperle el contrato a la coreografía, que la llama en cada cuadro
     * de scroll. La máquina pre-renderizada no reacciona al progreso: eso es lo que se
     * cambió a propósito. El resto de la escena sigue reaccionando igual, incluido el
     * resplandor del centro, que es CSS atado a `--power`.
     *
     * @returns {void}
     */
    set_progreso() {},

    relayout: relayout,

    /**
     * @returns {void}
     */
    pausar() {
      if (raf_id !== null) {
        window.cancelAnimationFrame(raf_id)
        raf_id = null
      }
    },

    /**
     * Reanuda donde había quedado, no donde estaría si el reloj no hubiera parado: se
     * corre el origen del tiempo por lo que duró la pausa. Sin esto, volver después de
     * un rato fuera de pantalla mostraría un salto -- el mismo detalle que la versión
     * en vivo documentaba y no podía resolver, porque su reloj era absoluto.
     *
     * @returns {void}
     */
    reanudar() {
      if (raf_id !== null || destruido || fijo) {
        return
      }
      const cuadro_actual = dibujado < 0 ? 0 : dibujado
      arranque_ms = window.performance.now() - (cuadro_actual / tira.fps) * 1000
      raf_id = window.requestAnimationFrame(tick)
    },

    /**
     * Apaga el bucle y suelta los bitmaps si nadie más los está usando. Los ImageBitmap
     * son píxeles crudos en memoria (una tira de 120 cuadros de 640x387 son ~120 MB si
     * se los deja vivos), así que esto no es prolijidad: es la diferencia entre salir de
     * la página y dejarla limpia o dejarla ocupada.
     *
     * @returns {void}
     */
    destruir() {
      destruido = true
      if (raf_id !== null) {
        window.cancelAnimationFrame(raf_id)
        raf_id = null
      }
      window.removeEventListener('resize', relayout)
      usuarios -= 1
      if (usuarios <= 0) {
        usuarios = 0
        tira.cuadros.forEach(function (bitmap) {
          if (bitmap && bitmap.close) {
            bitmap.close()
          }
        })
        /* Y se olvida la precarga: la próxima entrada vuelve a pedir los archivos, que
           para entonces están en la caché del navegador -- se paga la decodificación de
           nuevo, no la descarga. */
        precarga = null
      }
    },
  }
}
