/**
 * Motor de «El local» (misión el-local, 3/11/2026): actores que caminan, el loop de animación,
 * el orden por profundidad, los temporizadores de la escena y la cámara.
 *
 * PORTADO del prototipo aprobado (`Actor`, `frame`, `fly`, `setCam`), con tres cambios:
 *   - Todo el tiempo de la escena es «tiempo de motor»: los globos que se borran, las esperas y los
 *     vuelos avanzan con el loop y no con `setTimeout`. Así, si la pestaña estuvo en segundo plano
 *     (el navegador frena los cuadros), el cuadro siguiente recupera lo que tenía que pasar en
 *     sub-pasos de 50 ms, y al desmontar la vista alcanza con `detener()` para que no quede nada vivo.
 *   - Los atributos del DOM se escriben una vez por cuadro y solo si cambiaron (antes, en cada paso).
 *   - `prefers-reduced-motion`: sin caminatas; quien tiene que ir a un lugar aparece ahí.
 *
 * No sabe nada del contrato de la API: eso es del director.
 */

import { html, esc, NS, W, H, globo, ICONOS_GLOBO } from './piezas'

/**
 * Indica si el sistema pide menos movimiento.
 *
 * @returns {boolean}
 */
export function prefiereMenosMovimiento() {
  try {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  } catch (e) {
    return false
  }
}

/** Paso máximo de simulación, en milisegundos. */
const PASO_MS = 50

/** Lo máximo que se recupera de golpe después de un tiempo en segundo plano. */
const RECUPERO_MAX_MS = 20000

/**
 * Personaje de la escena (robot o negocio).
 */
export class Actor {
  /**
   * @param {Motor} motor
   * @param {Object} o
   * @param {string} o.kind 'robot' | 'client'
   * @param {string} o.svg Cuerpo (de `robotSVG` o `clienteSVG`).
   * @param {string} o.capa Nombre de la capa del motor ('actoresAtras' | 'actoresFrente').
   * @param {number} [o.x]
   * @param {number} [o.y]
   * @param {number} [o.dir] 1 mira a la derecha, -1 a la izquierda.
   * @param {number} [o.speed] Unidades del mundo por segundo.
   * @param {number} [o.escala]
   * @param {string} [o.etiqueta] Rótulo debajo de los pies.
   * @param {string} [o.titulo] Tooltip.
   * @param {string} [o.estado] 'idle' | 'walk' | 'typing' | 'present' | 'carry'
   * @param {boolean} [o.visible]
   */
  constructor(motor, o) {
    this.motor = motor
    this.kind = o.kind || 'robot'
    this.x = o.x || 0
    this.y = o.y || 0
    this.dir = o.dir || 1
    this.speed = o.speed || 150
    this.escala = o.escala || 1
    this.estadoBase = o.estado || 'idle'
    this.estado = this.estadoBase
    this.flags = {}
    this.vivo = true
    this.opacidad = o.visible === false ? 0 : 1
    this.fade = null
    this.cola = []
    this.objetivo = null
    this.espera = 0
    this.capa = motor.capas[o.capa] || motor.capas.actoresFrente
    this.g = document.createElementNS(NS, 'g')
    this.g.innerHTML =
      html`<title>${esc(o.titulo || '')}</title><g class="flip">${o.svg}</g>` +
      (o.etiqueta ? html`<text class="lbl" y="20" text-anchor="middle" font-size="12" font-weight="600" fill="#2B3A52">${esc(o.etiqueta)}</text>` : '')
    this.titulo = this.g.firstElementChild
    this.flip = this.g.querySelector('.flip')
    // el logo no se espeja al caminar hacia la izquierda
    this.head = this.g.querySelector('.head')
    this.lbl = this.g.querySelector('.lbl')
    this.capa.appendChild(this.g)
    this.pintado = { t: '', d: 0, o: -1, c: '' }
    this.aplicarClase()
    this.pintar()
    motor.actores.push(this)
  }

  /** Clase del grupo: tipo, estado y banderas (cerrado, dormido, sin-senal, carry…). */
  aplicarClase() {
    const partes = ['actor', this.kind, this.estado]
    const flags = this.flags
    Object.keys(flags).forEach(function (k) {
      if (flags[k]) {
        partes.push(k)
      }
    })
    const c = partes.join(' ')
    if (c !== this.pintado.c) {
      this.g.setAttribute('class', c)
      this.pintado.c = c
    }
  }

  /**
   * Estado de reposo (lo que hace cuando no camina): 'idle', 'typing' o 'present'.
   *
   * @param {string} s
   */
  setEstado(s) {
    this.estadoBase = s
    if (this.estado !== 'walk') {
      this.estado = s
      this.aplicarClase()
    }
  }

  /**
   * Prende o apaga una bandera visual (se vuelve clase del grupo).
   *
   * @param {string} nombre
   * @param {boolean} valor
   */
  setFlag(nombre, valor) {
    if (!!this.flags[nombre] === !!valor) {
      return
    }
    this.flags[nombre] = !!valor
    this.aplicarClase()
  }

  /** @param {string} texto */
  setTitulo(texto) {
    const t = String(texto || '')
    if (this.titulo.textContent !== t) {
      this.titulo.textContent = t
    }
  }

  /** @param {string} texto */
  setEtiqueta(texto) {
    if (this.lbl && this.lbl.textContent !== texto) {
      this.lbl.textContent = texto
    }
  }

  /** Cambia la escala (el banco y la entrada usan personajes más chicos). */
  setEscala(e) {
    this.escala = e
  }

  /**
   * Fundido de opacidad en tiempo de motor.
   *
   * @param {number} hasta 0..1
   * @param {number} ms
   * @param {Function} [cb]
   */
  fundir(hasta, ms, cb) {
    if (this.motor.reducido || ms <= 0) {
      this.opacidad = hasta
      this.fade = null
      if (cb) {
        cb(this)
      }
      return
    }
    this.fade = { desde: this.opacidad, hasta: hasta, ms: ms, t: 0, cb: cb || null }
  }

  /** Corta lo que estaba haciendo (cola, destino y espera). */
  limpiar() {
    this.cola = []
    this.objetivo = null
    this.espera = 0
    if (this.estado === 'walk') {
      this.estado = this.estadoBase
      this.aplicarClase()
    }
    return this
  }

  /** Aparece en un lugar sin caminar. */
  teletransportar(x, y) {
    this.limpiar()
    this.x = x
    this.y = y
    return this
  }

  /** Encola una caminata hasta (x, y); `cb` corre al llegar. */
  goTo(x, y, cb) {
    this.cola.push({ x: x, y: y, cb: cb || null })
    return this
  }

  /** Encola una función. */
  then(cb) {
    this.cola.push({ cb: cb })
    return this
  }

  /** Encola una espera. */
  pause(ms) {
    this.cola.push({ wait: ms })
    return this
  }

  /** true si no tiene nada pendiente (ni caminata ni cola). */
  quieto() {
    return !this.objetivo && this.cola.length === 0 && this.espera <= 0
  }

  /**
   * Un paso de simulación.
   *
   * @param {number} dt ms
   */
  paso(dt) {
    if (this.fade) {
      const f = this.fade
      f.t += dt
      const k = Math.min(1, f.t / f.ms)
      this.opacidad = f.desde + (f.hasta - f.desde) * k
      if (k >= 1) {
        this.fade = null
        if (f.cb) {
          f.cb(this)
        }
      }
    }
    if (this.espera > 0) {
      this.espera -= dt
    } else if (!this.objetivo && this.cola.length) {
      const q = this.cola.shift()
      if (q.wait) {
        this.espera = q.wait
      } else if (q.x === undefined) {
        if (q.cb) {
          q.cb(this)
        }
      } else {
        this.objetivo = q
        this.estado = 'walk'
        this.aplicarClase()
      }
    }
    if (this.objetivo && this.espera <= 0) {
      const dx = this.objetivo.x - this.x
      const dy = this.objetivo.y - this.y
      const d = Math.hypot(dx, dy)
      const step = (this.speed * dt) / 1000
      if (this.motor.reducido || d <= step) {
        this.x = this.objetivo.x
        this.y = this.objetivo.y
        const cb = this.objetivo.cb
        this.objetivo = null
        if (this.cola.length === 0 || this.cola[0].x === undefined) {
          this.estado = this.estadoBase
          this.aplicarClase()
        }
        if (cb) {
          cb(this)
        }
      } else {
        this.x += (dx / d) * step
        this.y += (dy / d) * step
        if (Math.abs(dx) > 1) {
          this.dir = dx < 0 ? -1 : 1
        }
      }
    }
  }

  /** Escribe en el DOM lo que cambió desde el cuadro anterior. */
  pintar() {
    const t = 'translate(' + this.x.toFixed(1) + ',' + this.y.toFixed(1) + ')' + (this.escala !== 1 ? ' scale(' + this.escala + ')' : '')
    if (t !== this.pintado.t) {
      this.g.setAttribute('transform', t)
      this.pintado.t = t
    }
    if (this.dir !== this.pintado.d) {
      this.flip.setAttribute('transform', 'scale(' + this.dir + ',1)')
      if (this.head) {
        this.head.setAttribute('transform', 'scale(' + this.dir + ',1)')
      }
      this.pintado.d = this.dir
    }
    const o = Math.round(this.opacidad * 100) / 100
    if (o !== this.pintado.o) {
      this.g.style.opacity = String(o)
      this.pintado.o = o
    }
  }

  /**
   * Muestra un globo arriba de la cabeza durante `ms` (tiempo de motor).
   *
   * @param {string} tipo
   * @param {number} [ms]
   * @param {number} [dy]
   */
  globo(tipo, ms, dy) {
    if (!this.vivo || !ICONOS_GLOBO[tipo]) {
      return null
    }
    // un globo a la vez por personaje: el nuevo reemplaza al anterior
    const previo = this.g.querySelector(':scope > .globo')
    if (previo) {
      previo.remove()
    }
    this.g.insertAdjacentHTML('beforeend', globo(tipo, dy === undefined ? (this.kind === 'robot' ? -146 : -150) : dy))
    const el = this.g.lastElementChild
    const duracion = ms === undefined ? 2600 : ms
    if (duracion > 0) {
      this.motor.despues(duracion, function () {
        el.remove()
      })
    }
    return el
  }

  /** Saca al actor de la escena. */
  quitar() {
    this.vivo = false
    this.cola = []
    this.objetivo = null
    if (this.g.parentNode) {
      this.g.parentNode.removeChild(this.g)
    }
    const i = this.motor.actores.indexOf(this)
    if (i !== -1) {
      this.motor.actores.splice(i, 1)
    }
  }
}

/**
 * Loop de la escena: mueve a los actores, corre los temporizadores y los vuelos, y ordena por
 * profundidad la capa de los que andan por el piso.
 */
export class Motor {
  /**
   * @param {SVGSVGElement} svg
   * @param {Object<string, SVGGElement>} capas Grupos ya montados: atras, actoresAtras, medio,
   *   actoresFrente, adelante, fx.
   */
  constructor(svg, capas) {
    this.svg = svg
    this.capas = capas
    this.actores = []
    this.timers = []
    this.tweens = []
    this.t = 0
    this.raf = null
    this.ultimo = null
    this.reducido = prefiereMenosMovimiento()
    this.vb = [0, 0, W, H]
    this.cuadro = this.cuadro.bind(this)
  }

  iniciar() {
    if (this.raf) {
      return
    }
    this.ultimo = performance.now()
    this.raf = requestAnimationFrame(this.cuadro)
  }

  /** Para el loop y descarta todo lo pendiente (al desmontar la vista). */
  detener() {
    if (this.raf) {
      cancelAnimationFrame(this.raf)
      this.raf = null
    }
    this.timers = []
    this.tweens = []
    this.actores.slice().forEach(function (a) {
      a.quitar()
    })
  }

  /**
   * Corre `fn` dentro de `ms` milisegundos de tiempo de motor.
   *
   * @param {number} ms
   * @param {Function} fn
   * @returns {{cancelado:boolean}} Para cancelarlo: `t.cancelado = true`.
   */
  despues(ms, fn) {
    const t = { en: this.t + Math.max(0, ms), fn: fn, cancelado: false }
    this.timers.push(t)
    return t
  }

  /**
   * Interpolación genérica en tiempo de motor (vuelos, cámara).
   *
   * @param {number} ms
   * @param {Function} alPaso Recibe k (0..1, ya con easing).
   * @param {Function} [alFin]
   * @returns {{cancelado:boolean}}
   */
  interpolar(ms, alPaso, alFin) {
    if (this.reducido || ms <= 0) {
      alPaso(1)
      if (alFin) {
        alFin()
      }
      return { cancelado: true }
    }
    const tw = { ms: ms, t: 0, alPaso: alPaso, alFin: alFin || null, cancelado: false }
    this.tweens.push(tw)
    return tw
  }

  /**
   * Un ícono que vuela de un punto a otro en arco (la carpeta de una misión que pasa de la bandeja
   * a la pizarra).
   *
   * @param {{x:number,y:number}} desde
   * @param {{x:number,y:number}} hasta
   * @param {string} tipo Clave de ICONOS_GLOBO.
   * @param {number} ms
   * @param {Function} [cb]
   */
  volar(desde, hasta, tipo, ms, cb) {
    if (this.reducido) {
      if (cb) {
        cb()
      }
      return
    }
    const fx = this.capas.fx
    fx.insertAdjacentHTML('beforeend', html`<g>${ICONOS_GLOBO[tipo] || ''}</g>`)
    const g = fx.lastElementChild
    this.interpolar(
      ms,
      function (k) {
        const e = k < 0.5 ? 2 * k * k : -1 + (4 - 2 * k) * k
        const x = desde.x + (hasta.x - desde.x) * e
        const y = desde.y + (hasta.y - desde.y) * e - Math.sin(k * Math.PI) * 120
        g.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') scale(' + (1.6 - k * 0.5).toFixed(2) + ')')
      },
      function () {
        g.remove()
        if (cb) {
          cb()
        }
      }
    )
  }

  /**
   * Un cuadro: simula en sub-pasos de 50 ms todo el tiempo real que pasó (con tope), y pinta.
   *
   * @param {number} t
   */
  cuadro(t) {
    let dt = Math.min(RECUPERO_MAX_MS, Math.max(0, t - this.ultimo))
    this.ultimo = t
    while (dt > 0) {
      const paso = Math.min(dt, PASO_MS)
      this.t += paso
      const actores = this.actores.slice()
      let i = 0
      for (i = 0; i < actores.length; i = i + 1) {
        if (actores[i].vivo) {
          actores[i].paso(paso)
        }
      }
      this.correrTimers()
      this.correrTweens(paso)
      dt -= paso
    }
    this.actores.forEach(function (a) {
      a.pintar()
    })
    this.ordenar()
    this.raf = requestAnimationFrame(this.cuadro)
  }

  correrTimers() {
    if (this.timers.length === 0) {
      return
    }
    const ahora = this.t
    const vencidos = []
    this.timers = this.timers.filter(function (tm) {
      if (tm.cancelado) {
        return false
      }
      if (tm.en <= ahora) {
        vencidos.push(tm)
        return false
      }
      return true
    })
    vencidos.sort(function (a, b) {
      return a.en - b.en
    })
    vencidos.forEach(function (tm) {
      tm.fn()
    })
  }

  correrTweens(dt) {
    if (this.tweens.length === 0) {
      return
    }
    const terminados = []
    this.tweens = this.tweens.filter(function (tw) {
      if (tw.cancelado) {
        return false
      }
      tw.t += dt
      const k = Math.min(1, tw.t / tw.ms)
      tw.alPaso(k)
      if (k >= 1) {
        terminados.push(tw)
        return false
      }
      return true
    })
    terminados.forEach(function (tw) {
      if (tw.alFin) {
        tw.alFin()
      }
    })
  }

  /**
   * Orden por profundidad: en la capa del piso, el que está más abajo tapa al que está más
   * arriba. Solo se re-insertan los nodos si el orden cambió.
   */
  ordenar() {
    const capa = this.capas.actoresFrente
    const piso = this.actores
      .filter(function (a) {
        return a.capa === capa
      })
      .sort(function (a, b) {
        return a.y - b.y
      })
    const actual = capa.children
    let distinto = piso.length !== actual.length
    let i = 0
    for (i = 0; !distinto && i < piso.length; i = i + 1) {
      if (actual[i] !== piso[i].g) {
        distinto = true
      }
    }
    if (distinto) {
      piso.forEach(function (a) {
        capa.appendChild(a.g)
      })
    }
  }

  /**
   * Cámara: muestra el rectángulo `rect` del mundo ajustado al aspecto del marco, sin salirse del
   * mundo cuando la zona es más chica que el local.
   *
   * @param {number[]} rect [x, y, w, h]
   * @param {number} aspecto Ancho / alto del marco.
   * @param {boolean} animar
   */
  setCam(rect, aspecto, animar) {
    let x = rect[0]
    let y = rect[1]
    let w = rect[2]
    let h = rect[3]
    const ar = aspecto > 0 ? aspecto : W / H
    if (w / h > ar) {
      const nh = w / ar
      y -= (nh - h) / 2
      h = nh
    } else {
      const nw = h * ar
      x -= (nw - w) / 2
      w = nw
    }
    if (w <= W) {
      x = Math.max(0, Math.min(W - w, x))
    }
    if (h <= H) {
      y = Math.max(0, Math.min(H - h, y))
    }
    const destino = [x, y, w, h]
    const svg = this.svg
    const self = this
    const aplicar = function (vb) {
      self.vb = vb
      svg.setAttribute('viewBox', vb.map(function (n) {
        return n.toFixed(1)
      }).join(' '))
    }
    if (this.camTween) {
      this.camTween.cancelado = true
      this.camTween = null
    }
    if (!animar || this.reducido || !this.raf) {
      aplicar(destino)
      return
    }
    const origen = this.vb.slice()
    this.camTween = this.interpolar(380, function (k) {
      const e = 1 - Math.pow(1 - k, 3)
      aplicar(origen.map(function (v, i) {
        return v + (destino[i] - v) * e
      }))
    })
  }
}
