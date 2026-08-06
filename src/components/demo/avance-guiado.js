/**
 * Avance guiado de la página inmersiva de demo: un gesto, una sección (grupo 369,
 * prompt 02).
 *
 * POR QUÉ EXISTE. El grupo 355 (prompt 07) resolvió el encuadre con CSS scroll-snap y
 * con la rueda del mouse alcanza: cada muesca desplaza poco y el navegador engancha en
 * la sección siguiente. Pero scroll-snap NO limita la distancia -- un gesto de trackpad
 * o un swipe fuerte desplazan cientos de píxeles (más el momentum), el navegador los
 * aplica y recién después engancha en el punto más cercano a donde quedó: dos o tres
 * secciones más abajo. No existe un "snap de a uno" en CSS, así que el límite se pone
 * acá: se intercepta el gesto, se lo cuenta UNA vez y se hace el desplazamiento a mano.
 *
 * POR QUÉ NO ES UN COMPONENTE. No dibuja nada: es un controlador que se monta con la
 * página (ExperienciaDemo.vue) y se retira al salir. Vive en un módulo suelto para que
 * el botón del prompt 03 pueda disparar EL MISMO avance en vez de una implementación
 * paralela -- si algún día hay dos formas de avanzar en el código, está mal hecho.
 *
 * QUÉ NO TOCA. Mientras el lead está en una sección de scroll libre (hoy el interludio,
 * que se marca con la clase `demo-scroll-guiado--libre` sobre el scroller desde
 * FondoSeccionSticky), este controlador no intercepta nada: el scroll pasa derecho al
 * navegador. Se reusa esa señal en vez de escribir otra detección.
 */

/* Umbral de un swipe: por debajo de esto el dedo se movió, no gesticuló. */
const TOUCH_MINIMO_PX = 40

/* Umbral de la rueda, en PÍXELES. Sin esto, un gesto HORIZONTAL de trackpad con un poco
   de ruido vertical (deltaX 300, deltaY 4) contaba como gesto vertical y avanzaba una
   sección entera -- lo encontró el checker del prompt 02. Es el equivalente de
   TOUCH_MINIMO_PX para la rueda, que no tenía ninguno. */
const WHEEL_MINIMO_PX = 6

/* Cuánto vale una unidad de `deltaY` cuando el evento NO viene en píxeles. Chrome en
   Windows entrega la rueda en píxeles (deltaMode 0, 100px por muesca) pero Firefox la
   entrega en LÍNEAS (deltaMode 1, 3 por muesca): comparar ese 3 crudo contra un umbral de
   6px dejaba el avance guiado mudo con un mouse en Firefox -- lo encontró el re-check del
   prompt 02. 16px por línea es la altura de línea que usa el propio Firefox para
   convertir. */
const PX_POR_LINEA = 16

/* Los elementos que declaran un punto de enganche en el CSS. Es una sola lista porque
   dos preguntas distintas la necesitan: a dónde se puede ir (destinos) y si la sección
   donde estoy todavía tiene contenido sin ver (hay_contenido_sin_ver). */
const SELECTOR_DESTINOS = '.demo-fondo-seccion__snap, .demo-cierre, .demo-formulario'

/* Cerrojo por TIEMPO desde que arranca un avance. Cubre lo que dura el
   desplazamiento suave más un margen: mientras corre, todo gesto nuevo se ignora. */
const CERROJO_MS = 700

/* Cerrojo por SILENCIO. El momentum del trackpad sigue emitiendo `wheel` con deltaY
   decreciente casi un segundo después de que el dedo se levantó: sin esto, un solo
   gesto se contaría como veinte. Un gesto nuevo no se acepta hasta que pasó este
   intervalo sin ningún evento -- así un gesto largo y continuo cuenta una vez, y dos
   gestos separados de verdad cuentan dos. */
const SILENCIO_ENTRE_GESTOS_MS = 120

/* Tolerancia para decidir "en qué punto estoy parado". Chrome redondea el offset de
   scroll a píxeles de dispositivo, así que después de un enganche el scrollTop queda a
   una fracción de píxel del punto (medido en el grupo 355: residuo máximo 0,44px a dpr
   1,25). Sin tolerancia, "el próximo punto hacia abajo" podría ser el punto en el que
   ya estoy. */
const TOLERANCIA_PX = 2

/**
 * El `deltaY` de un evento de rueda, en píxeles, sea cual sea la unidad en la que el
 * navegador lo entregó (`deltaMode`: 0 píxeles, 1 líneas, 2 páginas).
 *
 * @param {WheelEvent} evento
 * @returns {number}
 */
function delta_en_px(evento) {
  if (evento.deltaMode === 1) {
    return evento.deltaY * PX_POR_LINEA
  }
  if (evento.deltaMode === 2) {
    return evento.deltaY * (window.innerHeight || 800)
  }
  return evento.deltaY
}

/**
 * Teclas que recorren la página. Se interceptan para que avancen DE A UNA sección --
 * nunca para bloquearlas (criterio 7 del prompt).
 */
const TECLAS_AVANCE = {
  PageDown: 1,
  PageUp: -1,
  ArrowDown: 1,
  ArrowUp: -1,
  ' ': 1,
}

/**
 * true si el evento nació dentro de algo con el que se interactúa. Ahí las flechas y el
 * espacio le pertenecen a ese elemento, no a la página:
 *  - campos y editables: el formulario de configuración vive en esta misma página y
 *    tiene nueve preguntas;
 *  - botones y enlaces: el espacio y el Enter los ACTIVAN, así que interceptarlos
 *    dejaría al botón de avance del prompt 03 sin poder pulsarse con teclado, que es
 *    justo uno de sus criterios.
 *
 * Home y End no están en la lista de teclas interceptadas a propósito: son las dos que
 * el lead usa para ir a los extremos REALES del documento (el final del formulario está
 * más abajo que el último punto de enganche), y el `scroll-snap` de CSS ya reencuadra
 * después. Interceptarlas sólo agregaba una forma de quedarse encerrado.
 *
 * @param {EventTarget} destino
 * @returns {boolean}
 */
function es_elemento_interactivo(destino) {
  if (!destino || !destino.closest) {
    return false
  }
  /* `closest` y no el `tagName` del target exacto, que es lo que había: un evento nacido
     en el <svg> o el <path> de adentro de un botón tenía el svg como target y se
     interceptaba igual (lo marcó el checker del prompt 03, que además logró disparar un
     avance con el svg como target). Hoy eso es difícil de alcanzar por teclado, pero
     preguntar por el ancestro es la pregunta correcta y cuesta lo mismo. */
  if (destino.closest('input, textarea, select, button, a, [role="button"], [contenteditable]')) {
    return true
  }
  return !!destino.isContentEditable
}

/**
 * Crea el controlador de avance guiado sobre `scroller` (el contenedor con scroll real,
 * que en este admin es <main class="app-main-scroll">; lo encuentra el llamador con la
 * misma lógica que FondoSeccionSticky.encontrar_ancestro_scroll(), sin hardcodear el
 * selector).
 *
 * @param {Element} scroller
 * @returns {{avanzar: function, destruir: function, hay_siguiente: function}}
 */
export default function crear_avance_guiado(scroller) {
  const reduced_motion = !!(
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  let ultimo_evento_ts = 0
  let bloqueado_hasta = 0
  let touch_y_inicial = null
  let destruido = false
  /* Cola de UNO (ver pedir_avance). 1, -1 o 0 si no hay nada esperando. */
  let pendiente = 0
  let timer_pendiente = null

  /**
   * Los destinos, en orden de documento y con su posición calculada en el momento --
   * nunca cacheados: las secciones miden en vh y una rotación de teléfono los mueve
   * todos.
   *
   * La lista NO se hardcodea ni se cuenta a mano. Sale de los mismos elementos que ya
   * declaran el enganche en CSS:
   *   - `.demo-fondo-seccion__snap`, el div que cada FondoSeccionSticky planta a
   *     `snap_progreso` de su alto pinneable (ver el comentario en ese archivo: el
   *     punto NO está en el borde de la sección, está donde la entrada ya terminó).
   *   - `.demo-cierre` y `.demo-formulario`, que reciben su `scroll-snap-align` en
   *     demo-experiencia.scss porque no viven dentro de un pin.
   * Si mañana aparece otra sección con enganche, entra sola por acá.
   *
   * Y el modo de alineación se LEE del CSS (`scroll-snap-align` + `scroll-margin-top`)
   * en vez de replicarse acá: el cierre alinea centrado y el formulario alinea al
   * comienzo con un margen. Duplicar esos valores en JS los desincroniza en el primer
   * ajuste de estilos que alguien haga.
   *
   * @returns {Array<number>} Posiciones de scroll, ordenadas.
   */
  function destinos() {
    const nodos = scroller.querySelectorAll(SELECTOR_DESTINOS)
    const base = scroller.getBoundingClientRect().top - scroller.scrollTop
    const alto_visible = scroller.clientHeight
    const posiciones = []

    nodos.forEach(function (nodo) {
      const rect = nodo.getBoundingClientRect()
      const estilo = window.getComputedStyle(nodo)
      const arriba = rect.top - base
      const margen = parseFloat(estilo.scrollMarginTop) || 0
      /* scroll-snap-align acepta uno o dos valores (bloque e inline); el que manda acá
         es el de bloque, que es el primero. */
      const alineacion = (estilo.scrollSnapAlign || 'start').trim().split(/\s+/)[0]

      let destino = arriba - margen
      if (alineacion === 'center') {
        destino = arriba - Math.max(0, (alto_visible - rect.height) / 2)
      } else if (alineacion === 'end') {
        destino = arriba - Math.max(0, alto_visible - rect.height)
      }
      posiciones.push(Math.max(0, Math.round(destino)))
    })

    posiciones.sort(function (a, b) {
      return a - b
    })
    return posiciones
  }

  /**
   * El próximo destino en el sentido `direccion`, o null si no hay. Se resuelve por
   * POSICIÓN y no por índice: si el lead viene de un tramo de scroll libre (el
   * interludio) no está parado en ningún punto, y un índice no querría decir nada.
   *
   * @param {number} direccion 1 hacia abajo, -1 hacia arriba.
   * @returns {number|null}
   */
  function siguiente_destino(direccion) {
    const actual = scroller.scrollTop
    const lista = destinos()
    let i = 0

    if (direccion > 0) {
      for (i = 0; i < lista.length; i++) {
        if (lista[i] > actual + TOLERANCIA_PX) {
          return lista[i]
        }
      }
      return null
    }

    for (i = lista.length - 1; i >= 0; i--) {
      if (lista[i] < actual - TOLERANCIA_PX) {
        return lista[i]
      }
    }
    return null
  }

  /**
   * true mientras el scroll tiene que pasar derecho al navegador: la sección que ocupa
   * la pantalla declaró `punto_snap: false` (hoy el interludio) y FondoSeccionSticky
   * puso la clase que suspende el enganche.
   *
   * @returns {boolean}
   */
  function scroll_libre() {
    return !!(scroller.classList && scroller.classList.contains('demo-scroll-guiado--libre'))
  }

  /**
   * true si en el documento hay al menos un destino de avance.
   *
   * 🔴 Es la condición que evita el peor modo de falla posible de este controlador: una
   * página que no scrollea. Interceptar con preventDefault y después no tener a dónde ir
   * deja al lead encerrado. Pasa de verdad en la vista POSTERIOR al formulario
   * (confirmación + video + botón de acceso), que no tiene ninguna sección con
   * enganche: ahí el scroll tiene que ser el del navegador y nada más. El contenedor
   * además crea y destruye este controlador según qué vista está montada -- esto es la
   * red, no el mecanismo principal.
   *
   * @returns {boolean}
   */
  function hay_recorrido() {
    return !!scroller.querySelector(SELECTOR_DESTINOS)
  }

  /**
   * true si la sección donde está parado el lead TODAVÍA tiene contenido sin ver en ese
   * sentido.
   *
   * 🔴 Esta es la segunda mitad de la trampa de scroll, y la encontró el checker del
   * prompt 02 después de que la primera (no interceptar cuando no hay sección vecina) ya
   * estaba cerrada. El caso: una sección MÁS ALTA que la pantalla. `.demo-cierre` mide
   * 1153px en un teléfono de 390x780 -- 373px por debajo del pliegue, que es casi todo el
   * marco con la pieza multimedia --, su punto de enganche es su tope, y el destino
   * siguiente es el puente, que está más abajo que su fondo. Con `preventDefault()` puesto
   * no queda ninguna posición de reposo en el medio, así que la parte de abajo del cierre
   * no se podía ver ni bajando ni subiendo. Y era una REGRESIÓN: con `scroll-snap-type: y
   * mandatory` a secas, una snap area más alta que el snapport deja válida cualquier
   * posición interna (lo pide la especificación), así que antes de este control el cierre
   * se recorría. Encima es justo el contenido que Lucas pidió poder leer entero en el
   * grupo 355, prompt 06 ("no quiero que haya un scroll dentro de esa tarjeta").
   *
   * Cuando hay contenido sin ver, el scroll es del navegador: él sabe recorrerlo, y el
   * enganche vuelve a actuar en cuanto no queda nada abajo. Los marcadores de las
   * secciones pinneadas no entran nunca por acá porque miden 1px: lo que se pinnea siempre
   * ocupa exactamente una pantalla.
   *
   * @param {number} direccion
   * @returns {boolean}
   */
  function hay_contenido_sin_ver(direccion) {
    const alto_visible = scroller.clientHeight
    const base = scroller.getBoundingClientRect().top
    let sin_ver = false

    scroller.querySelectorAll(SELECTOR_DESTINOS).forEach(function (nodo) {
      if (sin_ver) {
        return
      }
      const rect = nodo.getBoundingClientRect()
      if (rect.height <= alto_visible + TOLERANCIA_PX) {
        return
      }
      const arriba = rect.top - base
      const abajo = rect.bottom - base
      if (direccion > 0 && arriba <= TOLERANCIA_PX && abajo > alto_visible + TOLERANCIA_PX) {
        sin_ver = true
      }
      if (direccion < 0 && abajo >= alto_visible - TOLERANCIA_PX && arriba < -TOLERANCIA_PX) {
        sin_ver = true
      }
    })
    return sin_ver
  }

  /**
   * true si el gesto ocurrió sobre algo que tiene su propio scroll (una tarjeta con
   * overflow, un textarea largo): ahí el gesto es de ese elemento.
   *
   * @param {EventTarget} destino
   * @returns {boolean}
   */
  function dentro_de_scroll_propio(destino) {
    let nodo = destino
    while (nodo && nodo !== scroller && nodo.nodeType === 1) {
      const estilo = window.getComputedStyle(nodo)
      const desborda = nodo.scrollHeight > nodo.clientHeight + 1
      if (desborda && (estilo.overflowY === 'auto' || estilo.overflowY === 'scroll')) {
        return true
      }
      nodo = nodo.parentElement
    }
    return false
  }

  /**
   * Mueve hasta el destino vecino y pone el cerrojo. Privado: todo el mundo entra por
   * pedir_avance(), que es el que decide si se mueve ahora o se encola.
   *
   * @param {number} direccion 1 hacia abajo, -1 hacia arriba.
   * @returns {boolean} true si efectivamente se movió.
   */
  function mover_a(direccion) {
    if (destruido) {
      return false
    }
    const destino = siguiente_destino(direccion)
    if (destino === null) {
      return false
    }
    bloqueado_hasta = window.performance.now() + CERROJO_MS
    scroller.scrollTo({ top: destino, behavior: reduced_motion ? 'auto' : 'smooth' })
    return true
  }

  /**
   * Ejecuta el gesto que quedó esperando, o vuelve a esperar si el cerrojo se corrió.
   *
   * @returns {void}
   */
  function correr_pendiente() {
    timer_pendiente = null
    if (!pendiente || destruido) {
      pendiente = 0
      return
    }

    /* 🔴 El estado del mundo cambió entre que el gesto se encoló y ahora: el
       desplazamiento anterior lo llevó a otra parte. Si aterrizó en un tramo de scroll
       libre, el pendiente se descarta.
       Lo encontró el checker del prompt 02, medido con un scroll suave de 400ms de
       verdad (no instantáneo): dos muescas separadas 200ms al entrar al interludio se
       llevaban al lead hasta el cierre, o sea 2223px de coreografía que nunca se veían.
       El handler de la rueda ya consultaba scroll_libre(), pero la cola no, y el gesto
       encolado se ejecutaba igual un rato después. Mismo motivo para revisar que siga
       habiendo a dónde ir. */
    if (scroll_libre() || !hay_a_donde_ir(pendiente)) {
      pendiente = 0
      return
    }

    const ahora = window.performance.now()
    if (ahora < bloqueado_hasta) {
      timer_pendiente = window.setTimeout(correr_pendiente, bloqueado_hasta - ahora)
      return
    }
    const direccion = pendiente
    pendiente = 0
    mover_a(direccion)
  }

  /**
   * Pide un avance. Es el ÚNICO camino por el que la página avanza -- lo llaman el
   * gesto, el teclado y el botón del prompt 03.
   *
   * 🔴 Un gesto que llega con el cerrojo puesto NO se descarta: se encola, y la cola
   * tiene lugar para UNO. Descartarlo era lo primero que escribí y está mal: el
   * criterio 4 del prompt pide que gestos rápidos y seguidos avancen de a uno "no se
   * acumulan ni se pierden", y con un cerrojo de 700ms que descarta, dos muescas de
   * rueda a 300ms una de otra avanzaban UNA sola sección -- la segunda desaparecía.
   * Con la cola de uno: la primera se mueve, la segunda espera a que el cerrojo se
   * suelte y se mueve entonces (no se pierde), y diez gestos seguidos avanzan dos
   * secciones y no diez (no se acumulan). Si llega otro mientras hay uno esperando,
   * gana el último: es el sentido en el que el lead está yendo ahora.
   *
   * @param {number} direccion 1 hacia abajo, -1 hacia arriba.
   * @returns {void}
   */
  /**
   * true si hay una sección vecina en ese sentido.
   *
   * 🔴 Es la condición que decide si se intercepta o no, y no es la misma pregunta que
   * `hay_recorrido()`. Sin esto, la última sección era una trampa: el punto de enganche
   * del formulario está en su comienzo y el formulario mide bastante más de una
   * pantalla (nueve preguntas más el botón de enviar), así que un `preventDefault()` sin
   * nada hacia donde avanzar dejaba al lead sin poder bajar a las últimas preguntas ni
   * con la rueda, ni con el dedo, ni con PageDown. Cuando no hay a dónde ir, el scroll
   * es del navegador: es él el que sabe llevar al lead al final de la página.
   *
   * @param {number} direccion
   * @returns {boolean}
   */
  function hay_a_donde_ir(direccion) {
    if (!direccion) {
      return false
    }
    if (hay_contenido_sin_ver(direccion)) {
      return false
    }
    return siguiente_destino(direccion) !== null
  }

  function pedir_avance(direccion) {
    if (destruido || !direccion) {
      return
    }
    const ahora = window.performance.now()
    if (ahora >= bloqueado_hasta) {
      mover_a(direccion)
      return
    }
    pendiente = direccion
    if (timer_pendiente === null) {
      timer_pendiente = window.setTimeout(correr_pendiente, bloqueado_hasta - ahora)
    }
  }

  /**
   * ¿Empieza acá un gesto NUEVO? Es la pregunta del silencio, no la del cerrojo: el
   * momentum del trackpad sigue emitiendo eventos con deltaY decreciente durante casi
   * un segundo después de que el dedo se levantó, y todos esos son el MISMO gesto. Un
   * gesto largo y continuo cuenta una vez; dos gestos separados de verdad cuentan dos.
   *
   * @param {number} ahora
   * @returns {boolean}
   */
  function es_gesto_nuevo(ahora) {
    return ahora - ultimo_evento_ts >= SILENCIO_ENTRE_GESTOS_MS
  }

  /**
   * @param {WheelEvent} evento
   * @returns {void}
   */
  function on_wheel(evento) {
    /* Gesto de zoom del navegador (ctrl + rueda, o pinch en trackpad, que Chrome
       entrega como wheel con ctrlKey): no es un scroll y no se toca. */
    if (
      evento.ctrlKey ||
      scroll_libre() ||
      !hay_recorrido() ||
      dentro_de_scroll_propio(evento.target)
    ) {
      return
    }

    /* Umbral: un gesto horizontal de trackpad con ruido vertical no es un gesto
       vertical. Ver WHEEL_MINIMO_PX -- y ojo que el delta hay que llevarlo a píxeles
       antes de comparar, ver PX_POR_LINEA. */
    if (Math.abs(delta_en_px(evento)) < WHEEL_MINIMO_PX) {
      return
    }
    const direccion = evento.deltaY > 0 ? 1 : -1
    if (!hay_a_donde_ir(direccion)) {
      return
    }

    /* preventDefault SIEMPRE que estemos interceptando, incluso cuando el gesto se va a
       ignorar por venir del momentum: si se deja pasar al navegador, el desplazamiento
       nativo corre en paralelo al nuestro y se pierde el encuadre. Por eso el listener
       va con { passive: false }. */
    evento.preventDefault()

    const ahora = window.performance.now()
    const nuevo = es_gesto_nuevo(ahora)
    ultimo_evento_ts = ahora

    if (!nuevo) {
      return
    }
    pedir_avance(direccion)
  }

  /**
   * @param {TouchEvent} evento
   * @returns {void}
   */
  function on_touchstart(evento) {
    if (scroll_libre() || !hay_recorrido() || dentro_de_scroll_propio(evento.target)) {
      touch_y_inicial = null
      return
    }
    touch_y_inicial = evento.touches.length ? evento.touches[0].clientY : null
  }

  /**
   * El desplazamiento nativo del dedo se corta acá y no en touchend: un swipe brusco
   * ya desplazó cientos de píxeles antes de que el dedo se levante, y el enganche
   * después lo lleva dos secciones más abajo -- que es exactamente el bug.
   *
   * @param {TouchEvent} evento
   * @returns {void}
   */
  function on_touchmove(evento) {
    if (touch_y_inicial === null) {
      return
    }
    /* Un solo dedo o nada. Dos dedos es un zoom o un arrastre, no un swipe: se abandona
       el gesto -- y hay que abandonarlo de verdad, poniendo el inicial en null, porque si
       no el touchend posterior contaba el recorrido de un dedo y avanzaba una sección
       ADEMÁS del desplazamiento nativo (lo encontró el checker del prompt 02). Y cero
       dedos no debería llegar nunca de un navegador real, pero la comparación exacta
       cuesta lo mismo que la desigualdad y evita leer `touches[0]` de una lista vacía. */
    if (evento.touches.length !== 1) {
      touch_y_inicial = null
      return
    }
    /* El dedo sube => el contenido baja => se avanza. Si en ese sentido no hay sección
       vecina, el desplazamiento es del navegador: ver hay_a_donde_ir(). */
    const recorrido = touch_y_inicial - evento.touches[0].clientY
    const direccion = recorrido > 0 ? 1 : (recorrido < 0 ? -1 : 0)
    if (!hay_a_donde_ir(direccion)) {
      return
    }
    evento.preventDefault()
  }

  /**
   * @param {TouchEvent} evento
   * @returns {void}
   */
  function on_touchend(evento) {
    if (touch_y_inicial === null) {
      return
    }
    const punto = evento.changedTouches && evento.changedTouches.length
      ? evento.changedTouches[0]
      : null
    const inicial = touch_y_inicial
    touch_y_inicial = null

    if (!punto) {
      return
    }
    /* El dedo sube => el contenido baja => se avanza. */
    const recorrido = inicial - punto.clientY
    if (Math.abs(recorrido) < TOUCH_MINIMO_PX) {
      return
    }
    const ahora = window.performance.now()
    const nuevo = es_gesto_nuevo(ahora)
    ultimo_evento_ts = ahora
    if (!nuevo) {
      return
    }
    const direccion = recorrido > 0 ? 1 : -1
    /* 🔴 La MISMA condición que consultan la rueda, el touchmove y el teclado, y que acá
       faltaba: lo encontró el re-check del prompt 02. Mientras `hay_a_donde_ir` sólo
       quería decir "hay sección vecina", omitirla era inofensivo -- si no había vecina,
       `mover_a` tampoco se movía. Desde que también quiere decir "esta sección todavía
       tiene contenido sin ver", omitirla dejaba la mitad de la trampa abierta justo en
       el teléfono: un swipe en el tope del cierre hacía el desplazamiento nativo Y
       después saltaba al puente, así que los 373px de abajo del cierre seguían
       inalcanzables. */
    if (!hay_a_donde_ir(direccion)) {
      return
    }
    pedir_avance(direccion)
  }

  /**
   * @param {KeyboardEvent} evento
   * @returns {void}
   */
  function on_keydown(evento) {
    if (scroll_libre() || !hay_recorrido() || es_elemento_interactivo(evento.target)) {
      return
    }

    const direccion = TECLAS_AVANCE[evento.key]
    if (!direccion) {
      return
    }
    /* Shift + espacio es "página arriba" desde siempre. */
    const signo = evento.key === ' ' && evento.shiftKey ? -1 : direccion
    if (!hay_a_donde_ir(signo)) {
      return
    }
    /* El teclado no tiene momentum: cada pulsación es un gesto, y si el cerrojo está
       puesto se encola como cualquier otra. Se intercepta cuando hay sección vecina --
       dejarlo pasar haría que el navegador scrollee una pantalla entera y rompa el
       encuadre; interceptarlo cuando no hay a dónde ir dejaría al lead encerrado. */
    evento.preventDefault()
    ultimo_evento_ts = window.performance.now()
    pedir_avance(signo)
  }

  scroller.addEventListener('wheel', on_wheel, { passive: false })
  scroller.addEventListener('touchstart', on_touchstart, { passive: true })
  scroller.addEventListener('touchmove', on_touchmove, { passive: false })
  scroller.addEventListener('touchend', on_touchend, { passive: true })
  /* El teclado se escucha en el documento y no en el scroller: el foco puede estar en
     el <body> y ahí los eventos de tecla no pasan por el contenedor. */
  document.addEventListener('keydown', on_keydown)

  return {
    /* El botón del prompt 03 entra por acá, o sea por el mismo cerrojo y la misma cola
       que un gesto: pulsarlo diez veces no salta diez secciones. */
    avanzar: pedir_avance,

    /**
     * true si hay una sección siguiente hacia abajo. Lo usa el botón del prompt 03
     * para no mostrarse en la última.
     *
     * @returns {boolean}
     */
    hay_siguiente: function () {
      return siguiente_destino(1) !== null
    },

    /**
     * Retira todos los listeners. Sin esto el resto del admin se queda con el scroll
     * secuestrado, que es la peor herencia posible de esta página.
     *
     * @returns {void}
     */
    destruir: function () {
      destruido = true
      pendiente = 0
      if (timer_pendiente !== null) {
        window.clearTimeout(timer_pendiente)
        timer_pendiente = null
      }
      scroller.removeEventListener('wheel', on_wheel)
      scroller.removeEventListener('touchstart', on_touchstart)
      scroller.removeEventListener('touchmove', on_touchmove)
      scroller.removeEventListener('touchend', on_touchend)
      document.removeEventListener('keydown', on_keydown)
    },
  }
}
