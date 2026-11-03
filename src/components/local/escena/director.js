/**
 * Director de «El local» (misión el-local, 3/11/2026): aplica cada estado nuevo que llega de
 * `GET /api/admin/local/escena` (contrato B del plan) contra el anterior y lo traduce en lo que se
 * ve: quién entra y sale por la puerta, quién camina a qué estación, qué robot tipea o duerme, qué
 * nota lleva Soporte a la bandeja, qué mesa se arma en las oficinas y qué globos aparecen.
 *
 * Reglas:
 *   - La PRIMERA vez que llega un estado real, todo aparece en su lugar, sin caminatas ni globos.
 *     Recién del segundo en adelante se anima la diferencia.
 *   - Solo se leen los campos del contrato B. Todo campo es opcional: si falta, hay un default y la
 *     escena no se cae (SPA nueva contra un admin con otra versión del contrato).
 *   - Nada de lo que viene de la API entra a una plantilla sin `esc()` (lo hacen las piezas).
 */

import {
  C,
  ROBOT_Y,
  ESTACIONES,
  TRAY,
  PUERTA,
  PIZARRA,
  PLANIFICADOR,
  PUERTA_OFICINA,
  MESA_Y,
  FASES,
  ROLES,
  MAX_MESAS,
  MAX_AYUDANTES,
  LUGARES_SALON,
  LUGARES_BANCO,
  LUGARES_ENTRADA,
  ESCALA_BANCO,
  ESCALA_ENTRADA,
  lugarEnFila,
  columnasMesas,
  lugarAyudante,
  coloresDe,
  iniciales,
  esc,
  robotSVG,
  clienteSVG,
  cabezaCliente,
  pizarra,
  notasBandeja,
  badgePendientes,
  masN,
  mesa,
  plaquitaMesa,
  papel,
} from './piezas'
import { Actor } from './motor'
import { logo_cliente, clientes as INDICE_LOGOS } from '@/components/demo/clientes'

/** Estados válidos de un agente del mostrador (contrato B: `agentes[].estado`). */
const ESTADOS_AGENTE = ['trabajando', 'libre', 'apagado', 'sin_senal']

/** Texto de cada estado de agente para el tooltip. */
const TEXTO_ESTADO_AGENTE = {
  trabajando: 'trabajando',
  libre: 'libre',
  apagado: 'apagado',
  sin_senal: 'sin señal todavía',
}

/** Tope de tickets apilados sobre la estación de Soporte. */
const MAX_TICKETS = 5

/** Tope de globos de eventos por refresco (el resto se da por visto en silencio). */
const MAX_GLOBOS_EVENTOS = 12

/** En cuánto tiempo se reparten los globos de un refresco (que la escena se mueva todo el minuto). */
const VENTANA_EVENTOS_MS = 40000

/** Punto de paso para no atravesar la punta derecha del mostrador al ir o venir de la entrada. */
const PASO_ENTRADA = { x: 1356, y: 668 }

/* ---------------------------------------------------------------------------------------------
 * Logos de respaldo: el webp curado de src/assets/clients/ por slug
 * ------------------------------------------------------------------------------------------- */

/**
 * Normaliza un slug o un nombre para compararlo con el índice de logos (sin tildes, sin espacios,
 * sin guiones, en minúscula).
 *
 * @param {string} s
 * @returns {string}
 */
function clave(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Índice clave → id del archivo. Solo los logos que se muestran en la pared (`en_la_pared !== false`):
 * los que están marcados fuera muestran otra marca (ver la nota de `clientes.js`).
 */
const MAPA_LOGOS = (function () {
  const mapa = {}
  INDICE_LOGOS.forEach(function (c) {
    if (c.en_la_pared === false) {
      return
    }
    mapa[clave(c.id)] = c.id
    mapa[clave(c.nombre)] = c.id
  })
  return mapa
})()

/**
 * URL del webp curado de un negocio, o null si no hay uno que le corresponda.
 *
 * `logo_cliente()` indexa por el slug propio del archivo (no por el del admin), así que se busca
 * primero por el slug del negocio y después por su nombre, los dos normalizados.
 *
 * @param {{slug?:string, nombre?:string}} n
 * @returns {string|null}
 */
function webpDe(n) {
  const id = MAPA_LOGOS[clave(n.slug)] || MAPA_LOGOS[clave(n.nombre)]
  return id ? logo_cliente(id) : null
}

/**
 * Cadena de logos a probar en orden: `logo_url` de la API (si es una URL usable) y el webp curado.
 * Si los dos fallan (o no hay ninguno), la cabeza son las iniciales.
 *
 * @param {Object} n Negocio del contrato B.
 * @returns {string[]}
 */
function cadenaLogos(n) {
  const lista = []
  if (typeof n.logo_url === 'string' && /^(https?:\/\/|\/)/i.test(n.logo_url)) {
    lista.push(n.logo_url)
  }
  const webp = webpDe(n)
  if (webp) {
    lista.push(webp)
  }
  return lista
}

/* ---------------------------------------------------------------------------------------------
 * Ayudas
 * ------------------------------------------------------------------------------------------- */

/**
 * Completa un estado con defaults para que ningún campo faltante rompa la escena.
 *
 * @param {Object|null} e
 * @returns {Object}
 */
function completarEstado(e) {
  const base = e && typeof e === 'object' ? e : {}
  const oficina = base.oficina && typeof base.oficina === 'object' ? base.oficina : {}
  return {
    sinDatos: !e,
    resumen: base.resumen && typeof base.resumen === 'object' ? base.resumen : {},
    negocios: Array.isArray(base.negocios) ? base.negocios.filter(function (n) {
      return n && n.id !== undefined && n.id !== null
    }) : [],
    agentes: Array.isArray(base.agentes) ? base.agentes.filter(Boolean) : [],
    bandeja: Array.isArray(base.bandeja) ? base.bandeja.filter(Boolean) : [],
    oficina: {
      reporter: oficina.reporter && typeof oficina.reporter === 'object' ? oficina.reporter : { ok: false, last_seen_at: null, version: null },
      planificador: oficina.planificador && typeof oficina.planificador === 'object' ? oficina.planificador : { estado: 'libre' },
      slots: Array.isArray(oficina.slots) ? oficina.slots.filter(Boolean) : [],
    },
    eventos: Array.isArray(base.eventos) ? base.eventos.filter(Boolean) : [],
  }
}

/** Mapa id → estación. */
const ESTACION_POR_ID = (function () {
  const m = {}
  ESTACIONES.forEach(function (e) {
    m[e.id] = e
  })
  return m
})()

/**
 * Zona del local donde tiene que estar un negocio:
 *   - `estacion`: tiene `estacion` (está hablando con un agente), aunque su horario diga cerrado.
 *   - `salon`: abierto por horario o con actividad reciente.
 *   - `banco`: cerrado por horario y sin actividad (gris, en el banco).
 *   - `entrada`: sin horario y sin actividad (gris claro, cerca de la puerta).
 *
 * @param {Object} n
 * @returns {{zona:string, estacion:string|null}}
 */
function zonaDe(n) {
  if (n.estacion && ESTACION_POR_ID[n.estacion]) {
    return { zona: 'estacion', estacion: n.estacion }
  }
  if (n.estado === 'abierto' || n.activo_reciente === true) {
    return { zona: 'salon', estacion: null }
  }
  if (n.estado === 'cerrado') {
    return { zona: 'banco', estacion: null }
  }
  return { zona: 'entrada', estacion: null }
}

/**
 * Hora (HH:MM, Argentina) de una fecha ISO, o '' si no se puede leer.
 *
 * @param {string|null} iso
 * @returns {string}
 */
function horaDe(iso) {
  if (!iso) {
    return ''
  }
  const d = new Date(iso)
  if (isNaN(d.getTime())) {
    return ''
  }
  try {
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })
  } catch (e) {
    return ''
  }
}

/**
 * Nombre corto para el rótulo de los pies (el completo va en el tooltip).
 *
 * @param {string} nombre
 * @returns {string}
 */
function nombreCorto(nombre) {
  const s = String(nombre || '').trim()
  return s.length > 12 ? s.slice(0, 11) + '…' : s
}

/**
 * Número entero o null.
 *
 * @param {*} v
 * @returns {number|null}
 */
function numero(v) {
  if (v === null || v === undefined || v === '') {
    return null
  }
  const n = parseInt(v, 10)
  return isNaN(n) ? null : n
}

/** Entero al azar entre a y b. */
function azar(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1))
}

/* ---------------------------------------------------------------------------------------------
 * Director
 * ------------------------------------------------------------------------------------------- */

export class Director {
  /**
   * @param {import('./motor').Motor} motor
   * @param {SVGSVGElement} svg Con las capas ya montadas.
   */
  constructor(motor, svg) {
    this.motor = motor
    this.svg = svg
    this.uid = 'ell' + Math.random().toString(36).slice(2, 7)
    this.primera = true
    this.cache = {}
    this.refs = {}
    const self = this
    ;['puerta', 'pizarra', 'tickets', 'escaner', 'bandeja', 'bandeja-notas', 'bandeja-badge', 'mesas', 'mesas-rotulos', 'banco-extra', 'entrada-extra', 'oficinas-extra', 'reloj-h', 'reloj-m'].forEach(function (r) {
      self.refs[r] = svg.querySelector('[data-ref="' + r + '"]')
    })
    this.refs.pend = {}
    this.refs.mon = {}
    ESTACIONES.forEach(function (e) {
      self.refs.pend[e.id] = svg.querySelector('[data-ref="pend-' + e.id + '"]')
      self.refs.mon[e.id] = svg.querySelector('[data-ref="mon-' + e.id + '"]')
    })

    /** Robots del mostrador, por id de estación. */
    this.robots = {}
    /** Estado (del contrato) de cada agente, por id. */
    this.agentes = {}
    ESTACIONES.forEach(function (e) {
      const r = new Actor(motor, {
        kind: 'robot',
        svg: robotSVG({ accent: e.accent, badge: e.badge }),
        capa: 'actoresAtras',
        x: e.x,
        y: ROBOT_Y,
        titulo: e.nombre,
      })
      r.estacion = e
      r.ocupado = false
      r.setFlag('sin-senal', true)
      self.robots[e.id] = r
      self.agentes[e.id] = 'sin_senal'
    })
    this.planificador = new Actor(motor, {
      kind: 'robot',
      svg: robotSVG({ accent: '#F59E0B', badge: 'bulb' }),
      capa: 'actoresAtras',
      x: PLANIFICADOR.x,
      y: PLANIFICADOR.y,
      titulo: 'Planificador',
    })
    this.planificadorTrabaja = false
    this.planificadorPresenta = false

    /** Negocios: id → registro { id, actor, zona, estacion, lugar, fila, oculto, datos }. */
    this.negocios = new Map()
    /** Lugares ocupados (índice → id de negocio) por zona. */
    this.ocupados = {
      salon: new Array(LUGARES_SALON.length).fill(null),
      banco: new Array(LUGARES_BANCO.length).fill(null),
      entrada: new Array(LUGARES_ENTRADA.length).fill(null),
    }

    /** Mesas: slot → { slot, datos, orq, ayudantes: Map, mision, fase, visible, mesaNueva, faseNueva }. */
    this.mesas = new Map()
    this.reporterOk = true

    this.bandejaIds = new Set()
    this.bandejaN = 0
    this.bandejaMostrada = 0
    this.eventosVistos = new Set()
    this.puertaHasta = 0
    this.escanerHasta = 0

    this.vida()
    this.relojTic()
  }

  /* -------------------------------------------------------------------------------------------
   * Entrada principal
   * ----------------------------------------------------------------------------------------- */

  /**
   * Aplica un estado (o null si todavía no hay datos).
   *
   * @param {Object|null} estado JSON del contrato B.
   */
  aplicar(estado) {
    const e = completarEstado(estado)
    const instantaneo = this.primera
    this.aplicarAgentes(e)
    this.aplicarNegocios(e, instantaneo)
    this.aplicarTickets(e, instantaneo)
    this.aplicarBandeja(e, instantaneo)
    this.aplicarOficina(e, instantaneo)
    this.aplicarEventos(e, instantaneo)
    // mientras no llega un estado real, la primera animación sigue pendiente: si no, el primer
    // estado bueno haría entrar a todos los negocios juntos por la puerta
    if (!e.sinDatos) {
      this.primera = false
    }
  }

  /**
   * Cambia el contenido de una parte viva solo si cambió (así los «pop» no se repiten en cada
   * refresco).
   *
   * @param {string} clave
   * @param {Element|null} el
   * @param {string} contenido
   */
  pintarRef(clave, el, contenido) {
    if (!el || this.cache[clave] === contenido) {
      return
    }
    this.cache[clave] = contenido
    el.innerHTML = contenido
  }

  /* -------------------------------------------------------------------------------------------
   * Agentes del mostrador
   * ----------------------------------------------------------------------------------------- */

  aplicarAgentes(e) {
    const self = this
    const porId = {}
    e.agentes.forEach(function (a) {
      if (a && a.id) {
        porId[a.id] = a
      }
    })
    ESTACIONES.forEach(function (est) {
      const a = porId[est.id] || {}
      const estado = ESTADOS_AGENTE.indexOf(a.estado) !== -1 ? a.estado : 'sin_senal'
      const r = self.robots[est.id]
      self.agentes[est.id] = estado
      if (!r.ocupado) {
        r.setEstado(estado === 'trabajando' ? 'typing' : 'idle')
      }
      r.setFlag('sin-senal', estado === 'sin_senal')
      r.setFlag('dormido', estado === 'apagado')
      const mon = self.refs.mon[est.id]
      if (mon) {
        mon.classList.toggle('apagado', estado === 'apagado' || estado === 'sin_senal')
      }
      const pendientes = numero(a.pendientes) || 0
      self.pintarRef('pend-' + est.id, self.refs.pend[est.id], badgePendientes(pendientes, est.accent))
      let titulo = est.nombre + ' · ' + TEXTO_ESTADO_AGENTE[estado]
      if (a.detalle) {
        titulo += ' — ' + a.detalle
      }
      if (pendientes > 0) {
        titulo += ' · ' + pendientes + ' pendiente' + (pendientes === 1 ? '' : 's')
      }
      if (a.ultimo_evento_at) {
        const h = horaDe(a.ultimo_evento_at)
        if (h) {
          titulo += ' · último movimiento ' + h
        }
      }
      r.setTitulo(titulo)
    })
    this.actualizarEscaner()
  }

  /** Prende el escáner si Facturas está trabajando o si hubo un escaneo hace instantes. */
  actualizarEscaner() {
    const el = this.refs.escaner
    if (!el) {
      return
    }
    el.classList.toggle('scan-on', this.agentes.facturas === 'trabajando' || this.motor.t < this.escanerHasta)
  }

  /* -------------------------------------------------------------------------------------------
   * Negocios
   * ----------------------------------------------------------------------------------------- */

  aplicarNegocios(e, instantaneo) {
    const self = this
    const porId = new Map()
    e.negocios.forEach(function (n) {
      porId.set(String(n.id), n)
    })

    // 1. los que ya no están (baja o dejaron de estar activos): salen por la puerta
    let retrasoSalida = 0
    Array.from(this.negocios.values()).forEach(function (reg) {
      if (porId.has(reg.id)) {
        return
      }
      self.liberar(reg)
      self.negocios.delete(reg.id)
      if (instantaneo) {
        reg.actor.quitar()
        return
      }
      self.salir(reg, retrasoSalida)
      retrasoSalida += 900
    })

    // 2. filas por estación, por orden de llegada
    const filas = {}
    e.negocios.forEach(function (n) {
      const z = zonaDe(n)
      if (z.zona === 'estacion') {
        if (!filas[z.estacion]) {
          filas[z.estacion] = []
        }
        filas[z.estacion].push(n)
      }
    })
    const indiceFila = new Map()
    Object.keys(filas).forEach(function (id) {
      filas[id].sort(function (a, b) {
        const ta = a.estacion_desde_at ? new Date(a.estacion_desde_at).getTime() : Infinity
        const tb = b.estacion_desde_at ? new Date(b.estacion_desde_at).getTime() : Infinity
        if (ta !== tb) {
          return (isNaN(ta) ? Infinity : ta) - (isNaN(tb) ? Infinity : tb)
        }
        return String(a.nombre || '').localeCompare(String(b.nombre || ''))
      })
      filas[id].forEach(function (n, i) {
        indiceFila.set(String(n.id), i)
      })
    })

    // 3. cada negocio: alta, o movimiento si cambió de zona, de estación o de lugar en la fila
    let retrasoEntrada = 0
    e.negocios.forEach(function (n) {
      const id = String(n.id)
      const z = zonaDe(n)
      const fila = z.zona === 'estacion' ? indiceFila.get(id) : null
      let reg = self.negocios.get(id)
      if (!reg) {
        reg = { id: id, actor: null, zona: null, estacion: null, lugar: null, fila: null, oculto: false, datos: n, logos: '' }
        self.negocios.set(id, reg)
        const destino = self.reservar(reg, z, fila)
        if (instantaneo) {
          reg.actor = self.crearNegocio(n, destino.x, destino.y, !destino.oculto)
          reg.actor.setEscala(destino.escala)
          self.banderasFinales(reg)
        } else {
          reg.actor = self.crearNegocio(n, PUERTA.x, PUERTA.afuera, false)
          self.entrar(reg, destino, retrasoEntrada)
          retrasoEntrada += 1100
        }
        return
      }
      reg.datos = n
      self.refrescarNegocio(reg, n)
      const cambio = reg.zona !== z.zona || reg.estacion !== z.estacion || (z.zona === 'estacion' && reg.fila !== fila)
      if (cambio) {
        const desde = { zona: reg.zona, estacion: reg.estacion }
        self.liberar(reg)
        const destino = self.reservar(reg, z, fila)
        self.mover(reg, destino, desde, instantaneo)
      }
    })

    // 4. si se liberó lugar en el banco o en la entrada, entran los que no cabían
    this.rellenar('banco', instantaneo)
    this.rellenar('entrada', instantaneo)
    this.pintarRef('banco-extra', this.refs['banco-extra'], masN(this.contarOcultos('banco')))
    this.pintarRef('entrada-extra', this.refs['entrada-extra'], masN(this.contarOcultos('entrada')))
  }

  /**
   * Crea el actor de un negocio.
   *
   * @param {Object} n
   * @param {number} x
   * @param {number} y
   * @param {boolean} visible
   * @returns {Actor}
   */
  crearNegocio(n, x, y, visible) {
    const col = coloresDe(n.nombre || String(n.id))
    const logos = cadenaLogos(n)
    const base = { ini: iniciales(n.nombre), color: col.color, clipId: this.uid + '-c' + clave(String(n.id)) }
    const a = new Actor(this.motor, {
      kind: 'client',
      svg: clienteSVG({ shirt: col.shirt, pants: col.pants, logo: logos[0] || null, ini: base.ini, color: base.color, clipId: base.clipId }),
      capa: 'actoresFrente',
      x: x,
      y: y,
      speed: 140,
      etiqueta: nombreCorto(n.nombre),
      titulo: this.tituloNegocio(n),
      visible: visible,
    })
    this.engancharLogo(a, logos, 0, base)
    const reg = this.negocios.get(String(n.id))
    if (reg) {
      reg.logos = logos.join('|')
    }
    return a
  }

  /**
   * Si la imagen del logo no carga, prueba el siguiente de la cadena y, al final, las iniciales.
   *
   * @param {Actor} a
   * @param {string[]} logos
   * @param {number} i Índice del logo que se está mostrando.
   * @param {{ini:string,color:string,clipId:string}} base
   */
  engancharLogo(a, logos, i, base) {
    const self = this
    const img = a.g.querySelector('.cabeza image')
    if (!img) {
      return
    }
    img.addEventListener(
      'error',
      function () {
        const cab = a.g.querySelector('.cabeza')
        if (!cab || !a.vivo) {
          return
        }
        const siguiente = logos[i + 1] || null
        cab.innerHTML = cabezaCliente({ logo: siguiente, ini: base.ini, color: base.color, clipId: base.clipId })
        if (siguiente) {
          self.engancharLogo(a, logos, i + 1, base)
        }
      },
      { once: true }
    )
  }

  /** Actualiza nombre, tooltip y logo de un negocio que ya está en escena. */
  refrescarNegocio(reg, n) {
    const a = reg.actor
    a.setEtiqueta(nombreCorto(n.nombre))
    a.setTitulo(this.tituloNegocio(n))
    const logos = cadenaLogos(n)
    const firma = logos.join('|')
    if (firma !== reg.logos) {
      reg.logos = firma
      const col = coloresDe(n.nombre || String(n.id))
      const base = { ini: iniciales(n.nombre), color: col.color, clipId: this.uid + '-c' + clave(String(n.id)) }
      const cab = a.g.querySelector('.cabeza')
      if (cab) {
        cab.innerHTML = cabezaCliente({ logo: logos[0] || null, ini: base.ini, color: base.color, clipId: base.clipId })
        this.engancharLogo(a, logos, 0, base)
      }
    }
  }

  /** Tooltip de un negocio: nombre, situación y última actividad. */
  tituloNegocio(n) {
    let t = String(n.nombre || 'Negocio ' + n.id)
    const z = zonaDe(n)
    if (z.zona === 'estacion') {
      t += ' — con ' + ESTACION_POR_ID[z.estacion].nombre
      if (n.estacion_detalle) {
        t += ' (' + n.estacion_detalle + ')'
      }
    } else if (n.estado === 'abierto') {
      t += ' — abierto'
    } else if (n.estado === 'cerrado') {
      t += n.activo_reciente ? ' — cerrado por horario, pero con actividad' : ' — cerrado por hoy'
    } else {
      t += n.activo_reciente ? ' — sin horario, con actividad' : ' — sin horario cargado'
    }
    const h = horaDe(n.ultima_actividad_at)
    if (h) {
      t += ' · última actividad ' + h
    }
    return t
  }

  /**
   * Reserva el lugar de destino de un negocio en su zona nueva.
   *
   * @param {Object} reg
   * @param {{zona:string, estacion:string|null}} z
   * @param {number|null} fila
   * @returns {{x:number,y:number,escala:number,oculto:boolean}}
   */
  reservar(reg, z, fila) {
    reg.zona = z.zona
    reg.estacion = z.estacion
    reg.fila = fila
    reg.lugar = null
    reg.oculto = false
    if (z.zona === 'estacion') {
      const p = lugarEnFila(ESTACION_POR_ID[z.estacion].x, fila || 0)
      return { x: p.x, y: p.y, escala: 1, oculto: false }
    }
    if (z.zona === 'salon') {
      const i = this.lugarLibre('salon', true)
      reg.lugar = i
      this.ocupados.salon[i] = reg.id
      const p = LUGARES_SALON[i]
      // si el salón está lleno se comparte lugar: un poco corrido para que no se tapen del todo
      const lleno = this.ocupados.salon.filter(function (v) {
        return v !== null
      }).length >= LUGARES_SALON.length
      return { x: p.x + (lleno ? azar(-18, 18) : 0), y: p.y + (lleno ? azar(-8, 8) : 0), escala: 1, oculto: false }
    }
    const lugares = z.zona === 'banco' ? LUGARES_BANCO : LUGARES_ENTRADA
    const escala = z.zona === 'banco' ? ESCALA_BANCO : ESCALA_ENTRADA
    const i = this.lugarLibre(z.zona, false)
    if (i === -1) {
      // no entra: queda oculto al final del banco (o de la entrada) y cuenta en el «+N»
      reg.oculto = true
      const ultimo = lugares[lugares.length - 1]
      return { x: ultimo.x, y: ultimo.y, escala: escala, oculto: true }
    }
    reg.lugar = i
    this.ocupados[z.zona][i] = reg.id
    return { x: lugares[i].x, y: lugares[i].y, escala: escala, oculto: false }
  }

  /**
   * Índice de un lugar libre de la zona: al azar en el salón (se ve más natural), el primero en
   * el banco y la entrada. En el salón, si no queda ninguno, uno cualquiera.
   *
   * @param {string} zona
   * @param {boolean} alAzar
   * @returns {number}
   */
  lugarLibre(zona, alAzar) {
    const libres = []
    this.ocupados[zona].forEach(function (v, i) {
      if (v === null) {
        libres.push(i)
      }
    })
    if (libres.length === 0) {
      return zona === 'salon' ? azar(0, this.ocupados.salon.length - 1) : -1
    }
    return alAzar ? libres[azar(0, libres.length - 1)] : libres[0]
  }

  /** Libera el lugar que ocupaba un negocio. */
  liberar(reg) {
    if (reg.lugar !== null && reg.zona && this.ocupados[reg.zona] && this.ocupados[reg.zona][reg.lugar] === reg.id) {
      this.ocupados[reg.zona][reg.lugar] = null
    }
    reg.lugar = null
  }

  /** Cuántos negocios de una zona no entraron (van en el «+N»). */
  contarOcultos(zona) {
    let n = 0
    this.negocios.forEach(function (reg) {
      if (reg.zona === zona && reg.oculto) {
        n += 1
      }
    })
    return n
  }

  /** Si hay lugar libre en el banco o en la entrada, lo ocupan los que estaban ocultos. */
  rellenar(zona, instantaneo) {
    const self = this
    const lugares = zona === 'banco' ? LUGARES_BANCO : LUGARES_ENTRADA
    this.negocios.forEach(function (reg) {
      if (reg.zona !== zona || !reg.oculto) {
        return
      }
      const i = self.lugarLibre(zona, false)
      if (i === -1) {
        return
      }
      reg.oculto = false
      reg.lugar = i
      self.ocupados[zona][i] = reg.id
      reg.actor.teletransportar(lugares[i].x, lugares[i].y)
      reg.actor.fundir(1, instantaneo ? 0 : 500)
    })
  }

  /** Banderas visuales según la zona en la que quedó (gris, gris claro, aro verde). */
  banderasFinales(reg) {
    const a = reg.actor
    a.setFlag('cerrado', reg.zona === 'banco')
    a.setFlag('sin-horario', reg.zona === 'entrada')
    a.setFlag('presente', reg.zona === 'salon' || reg.zona === 'estacion')
    if (reg.oculto) {
      a.fundir(0, 0)
    }
  }

  /**
   * Lleva a un actor por el piso hasta `destino`, pasando por el costado del mostrador si va o
   * viene de la entrada.
   *
   * @param {Actor} a
   * @param {{x:number,y:number}} destino
   * @param {Function} [alLlegar]
   */
  caminar(a, destino, alLlegar) {
    const enEntrada = function (p) {
      return p.x > 1330 && p.y < 690
    }
    if (enEntrada({ x: a.x, y: a.y }) !== enEntrada(destino)) {
      a.goTo(PASO_ENTRADA.x + azar(-10, 10), PASO_ENTRADA.y + azar(-6, 6))
    }
    a.goTo(destino.x, destino.y, alLlegar || null)
  }

  /** Cambio suave de escala (al sentarse en el banco o levantarse). */
  escalar(a, hasta, instantaneo) {
    const desde = a.escala
    if (desde === hasta) {
      return
    }
    if (instantaneo) {
      a.setEscala(hasta)
      return
    }
    this.motor.interpolar(450, function (k) {
      a.setEscala(desde + (hasta - desde) * k)
    })
  }

  /**
   * Un negocio nuevo entra por la puerta y camina a su lugar.
   *
   * @param {Object} reg
   * @param {{x:number,y:number,escala:number,oculto:boolean}} destino
   * @param {number} retraso
   */
  entrar(reg, destino, retraso) {
    const self = this
    const a = reg.actor
    this.motor.despues(retraso, function () {
      if (!a.vivo || self.negocios.get(reg.id) !== reg) {
        return
      }
      self.abrirPuerta(1400)
      a.setFlag('presente', true)
      a.fundir(1, 300)
      a.goTo(PUERTA.x, PUERTA.adentro)
      self.escalar(a, destino.escala, false)
      self.caminar(a, destino, function () {
        self.alLlegar(reg)
      })
    })
  }

  /**
   * Un negocio que ya está en escena cambia de zona, de estación o de lugar en la fila.
   *
   * @param {Object} reg
   * @param {{x:number,y:number,escala:number,oculto:boolean}} destino
   * @param {{zona:string|null, estacion:string|null}} desde
   * @param {boolean} instantaneo
   */
  mover(reg, destino, desde, instantaneo) {
    const self = this
    const a = reg.actor
    // al levantarse del banco (o de la entrada) recupera el color enseguida
    a.setFlag('cerrado', false)
    a.setFlag('sin-horario', false)
    a.setFlag('presente', reg.zona === 'salon' || reg.zona === 'estacion')
    if (a.opacidad < 1 && !destino.oculto) {
      a.fundir(1, instantaneo ? 0 : 300)
    }
    if (instantaneo) {
      a.teletransportar(destino.x, destino.y)
      a.setEscala(destino.escala)
      this.banderasFinales(reg)
      return
    }
    a.limpiar()
    this.escalar(a, destino.escala, false)
    this.caminar(a, destino, function () {
      self.alLlegar(reg, desde)
    })
  }

  /** Lo que pasa cuando un negocio llega a su lugar. */
  alLlegar(reg, desde) {
    if (this.negocios.get(reg.id) !== reg) {
      return
    }
    this.banderasFinales(reg)
    if (reg.oculto) {
      reg.actor.fundir(0, 300)
      return
    }
    if (reg.zona === 'estacion') {
      const est = ESTACION_POR_ID[reg.estacion]
      // solo saluda si recién llega a la estación (no si avanzó un lugar en la fila)
      if (!desde || desde.estacion !== reg.estacion) {
        reg.actor.globo(est.globo, 3000)
      }
      reg.actor.dir = reg.actor.x > est.x ? -1 : 1
    }
  }

  /** Un negocio que se fue de la lista sale por la puerta y desaparece. */
  salir(reg, retraso) {
    const self = this
    const a = reg.actor
    this.motor.despues(retraso, function () {
      if (!a.vivo) {
        return
      }
      a.limpiar()
      a.setFlag('cerrado', false)
      a.setFlag('sin-horario', false)
      if (a.opacidad < 1) {
        a.fundir(1, 200)
      }
      self.escalar(a, 1, false)
      self.caminar(a, { x: PUERTA.x, y: PUERTA.adentro }, function () {
        self.abrirPuerta(1400)
      })
      a.goTo(PUERTA.x, PUERTA.afuera, function () {
        a.fundir(0, 300, function () {
          a.quitar()
        })
      })
    })
  }

  /** Abre la puerta de entrada un rato. */
  abrirPuerta(ms) {
    const el = this.refs.puerta
    if (!el) {
      return
    }
    const self = this
    el.classList.add('open')
    this.puertaHasta = Math.max(this.puertaHasta, this.motor.t + ms)
    this.motor.despues(ms + 20, function () {
      if (self.motor.t >= self.puertaHasta) {
        el.classList.remove('open')
      }
    })
  }

  /* -------------------------------------------------------------------------------------------
   * Tickets sobre la estación de Soporte
   * ----------------------------------------------------------------------------------------- */

  aplicarTickets(e, instantaneo) {
    let enSoporte = 0
    this.negocios.forEach(function (reg) {
      if (reg.zona === 'estacion' && reg.estacion === 'soporte') {
        enSoporte += 1
      }
    })
    const abiertos = numero(e.resumen.tickets_abiertos) || 0
    const n = Math.min(MAX_TICKETS, Math.max(abiertos, enSoporte))
    const antes = this.ticketsN || 0
    this.ticketsN = n
    let s = ''
    let i = 0
    for (i = 0; i < n; i = i + 1) {
      s += papel(700 + 30 + i * 8, C.railY - 10 - i * 3, -8 + i * 6, '#25D366', !instantaneo && i >= antes)
    }
    this.pintarRef('tickets', this.refs.tickets, s)
  }

  /* -------------------------------------------------------------------------------------------
   * Bandeja «Para Lucas»
   * ----------------------------------------------------------------------------------------- */

  aplicarBandeja(e, instantaneo) {
    const self = this
    const ids = new Set()
    e.bandeja.forEach(function (b) {
      if (b && b.id !== undefined && b.id !== null) {
        ids.add(String(b.id))
      }
    })
    const total = numero(e.resumen.para_lucas)
    const n = total !== null ? total : e.bandeja.length
    let hayNuevos = false
    ids.forEach(function (id) {
      if (!self.bandejaIds.has(id)) {
        hayNuevos = true
      }
    })
    this.bandejaIds = ids
    this.bandejaN = n
    const r = this.robots.soporte
    if (instantaneo || !hayNuevos || n <= this.bandejaMostrada || this.agentes.soporte === 'apagado' || this.motor.reducido) {
      if (!r.ocupado) {
        this.mostrarBandeja(n, !instantaneo && n > this.bandejaMostrada)
      }
      return
    }
    if (r.ocupado) {
      // ya va en camino con una nota: al llegar deja el número nuevo
      return
    }
    // Soporte lleva la nota caminando por detrás del mostrador hasta la bandeja y vuelve
    r.ocupado = true
    r.limpiar()
    r.setFlag('carry', true)
    r.setEstado('idle')
    r.pause(500).goTo(TRAY.x - 32, ROBOT_Y, function () {
      r.setFlag('carry', false)
      r.globo('note', 1200)
      self.mostrarBandeja(self.bandejaN, true)
    })
    r.pause(600).goTo(r.estacion.x, ROBOT_Y, function () {
      r.ocupado = false
      r.dir = 1
      r.setEstado(self.agentes.soporte === 'trabajando' ? 'typing' : 'idle')
      // si mientras caminaba llegó otro número, se muestra ahora
      self.mostrarBandeja(self.bandejaN, self.bandejaN > self.bandejaMostrada)
    })
  }

  /**
   * Pinta las notitas y el contador de la bandeja.
   *
   * @param {number} n
   * @param {boolean} animar
   */
  mostrarBandeja(n, animar) {
    this.bandejaMostrada = n
    this.pintarRef('bandeja-notas', this.refs['bandeja-notas'], notasBandeja(n))
    const badge = this.refs['bandeja-badge']
    if (!badge) {
      return
    }
    const texto = n > 99 ? '99+' : String(n)
    const contenido =
      n > 0
        ? '<g class="' + (animar ? 'tag' : '') + '"><circle r="12" fill="#FA7E06" stroke="#fff" stroke-width="3"/><text y="4.5" text-anchor="middle" font-size="' + (texto.length > 2 ? 9.5 : 13) + '" font-weight="800" fill="#fff">' + esc(texto) + '</text></g>'
        : ''
    if (animar) {
      // forzar que el «pop» se vea aunque el número sea el mismo string
      this.cache['bandeja-badge'] = null
    }
    this.pintarRef('bandeja-badge', badge, contenido)
  }

  /* -------------------------------------------------------------------------------------------
   * Oficinas: planificador, pizarra y una mesa por slot con misión
   * ----------------------------------------------------------------------------------------- */

  aplicarOficina(e, instantaneo) {
    const self = this
    const of = e.oficina
    this.reporterOk = !e.sinDatos && of.reporter && of.reporter.ok === true
    const sinSenal = !e.sinDatos && !this.reporterOk

    const trabajando = of.slots
      .filter(function (s) {
        return s && numero(s.slot) !== null && s.estado && s.estado !== 'libre'
      })
      .sort(function (a, b) {
        return numero(a.slot) - numero(b.slot)
      })
    const visibles = trabajando.slice(0, MAX_MESAS)
    const cols = columnasMesas(visibles.length)
    const vigentes = new Set()
    let retrasoMision = 0

    visibles.forEach(function (s, i) {
      const slot = numero(s.slot)
      vigentes.add(slot)
      const col = cols[i]
      const fase = s.fase && FASES[s.fase] ? FASES[s.fase] : null
      let m = self.mesas.get(slot)
      const misionNueva = !m || (s.mision && m.mision !== s.mision)
      if (!m) {
        m = { slot: slot, orq: null, ayudantes: new Map(), mision: null, fase: null, visible: false, mesaNueva: false, faseNueva: false, col: col }
        self.mesas.set(slot, m)
      }
      m.datos = s
      m.col = col
      if (m.fase !== (fase ? s.fase : null) && m.visible) {
        m.faseNueva = !instantaneo
      }
      m.fase = fase ? s.fase : null
      m.mision = s.mision || null
      if (!m.orq) {
        m.orq = new Actor(self.motor, {
          kind: 'robot',
          svg: robotSVG({ accent: '#3A31FC', badge: 'gear' }),
          capa: 'actoresAtras',
          x: col.x + col.w / 2,
          y: MESA_Y - 4,
          visible: false,
        })
      } else {
        m.orq.teletransportar(col.x + col.w / 2, MESA_Y - 4)
      }
      self.aplicarOrquestador(m, s)
      if (instantaneo || m.visible) {
        m.visible = true
        m.orq.fundir(1, 0)
        self.aplicarAyudantes(m, s, instantaneo)
      } else if (misionNueva) {
        // misión nueva: la carpeta vuela de la bandeja a la pizarra, el planificador «presenta» y
        // recién ahí se arma la mesa
        self.presentarMision(m, s, retrasoMision)
        retrasoMision += 2600
      }
    })

    // mesas que ya no están (slot libre otra vez): se van los ayudantes y se levanta la mesa
    Array.from(this.mesas.keys()).forEach(function (slot) {
      if (vigentes.has(slot)) {
        return
      }
      const m = self.mesas.get(slot)
      self.mesas.delete(slot)
      m.ayudantes.forEach(function (a) {
        self.retirarAyudante(a, instantaneo)
      })
      m.ayudantes.clear()
      if (m.orq) {
        const orq = m.orq
        orq.fundir(0, instantaneo ? 0 : 500, function () {
          orq.quitar()
        })
      }
    })

    this.dibujarMesas()
    this.pintarRef('oficinas-extra', this.refs['oficinas-extra'], masN(trabajando.length - visibles.length, 'mesas'))

    // pizarra: las misiones en curso con su fase, y el cartel si la PC de Lucas no reporta
    const lineas = trabajando.map(function (s) {
      return { slot: numero(s.slot), mision: s.mision || null, proyecto: s.proyecto || null, fase: s.fase && FASES[s.fase] ? FASES[s.fase] : null }
    })
    this.pintarRef('pizarra', this.refs.pizarra, pizarra(lineas, sinSenal, e.sinDatos))

    // planificador
    this.planificadorTrabaja = !e.sinDatos && of.planificador && of.planificador.estado === 'trabajando'
    this.planificador.setFlag('sin-senal', sinSenal || e.sinDatos)
    if (!this.planificadorPresenta) {
      this.planificador.setEstado(this.planificadorTrabaja ? 'present' : 'idle')
    }
    this.planificador.setTitulo('Planificador · ' + (this.planificadorTrabaja ? 'planificando' : 'libre') + (sinSenal ? ' · sin señal de la PC de Lucas' : ''))
  }

  /**
   * Estado del orquestador de una mesa: tipea si su sesión está activa, duerme si el slot quedó
   * colgado, antena apagada si la PC de Lucas no reporta.
   */
  aplicarOrquestador(m, s) {
    const agentes = Array.isArray(s.agentes) ? s.agentes : []
    const orqAgente = agentes.filter(function (a) {
      return a && a.rol === 'orquestador'
    })[0]
    const activo = orqAgente && (orqAgente.estado === 'busy' || orqAgente.estado === 'activo')
    const colgado = s.estado === 'colgado'
    m.orq.setEstado(activo && !colgado ? 'typing' : 'idle')
    m.orq.setFlag('dormido', colgado)
    m.orq.setFlag('sin-senal', !this.reporterOk)
    let t = 'Orquestador de s' + m.slot
    if (orqAgente && orqAgente.runtime) {
      t += ' (' + orqAgente.runtime + ')'
    }
    t += colgado ? ' · colgado' : activo ? ' · trabajando' : ' · esperando'
    m.orq.setTitulo(t)
  }

  /**
   * Ayudantes de una mesa (todo agente que no es el orquestador): entran por la puerta de las
   * oficinas, se paran al costado y se van cuando terminan.
   *
   * @param {Object} m
   * @param {Object} s
   * @param {boolean} instantaneo
   */
  aplicarAyudantes(m, s, instantaneo) {
    const self = this
    const agentes = (Array.isArray(s.agentes) ? s.agentes : []).filter(function (a) {
      return a && a.rol && a.rol !== 'orquestador'
    })
    const repetidos = {}
    const deseados = []
    agentes.slice(0, MAX_AYUDANTES).forEach(function (a) {
      const base = a.rol + '|' + (a.runtime || '') + '|' + (a.nombre || '')
      repetidos[base] = (repetidos[base] || 0) + 1
      deseados.push({ clave: base + '|' + repetidos[base], a: a })
    })
    const claves = new Set(deseados.map(function (d) {
      return d.clave
    }))
    // los que ya no están se van
    Array.from(m.ayudantes.keys()).forEach(function (k) {
      if (!claves.has(k)) {
        self.retirarAyudante(m.ayudantes.get(k), instantaneo)
        m.ayudantes.delete(k)
      }
    })
    deseados.forEach(function (d, k) {
      const rol = ROLES[d.a.rol] || ROLES.otro
      const p = lugarAyudante(m.col, k)
      const activo = d.a.estado === 'busy' || d.a.estado === 'activo'
      let actor = m.ayudantes.get(d.clave)
      const titulo = rol.rotulo.charAt(0).toUpperCase() + rol.rotulo.slice(1) + (d.a.nombre ? ' · ' + d.a.nombre : '') + (d.a.runtime ? ' (' + d.a.runtime + ')' : '') + ' · s' + m.slot
      if (!actor) {
        actor = new Actor(self.motor, {
          kind: 'robot',
          svg: robotSVG({ accent: rol.accent, badge: rol.badge }),
          capa: 'actoresFrente',
          x: instantaneo ? p.x : PUERTA_OFICINA.x,
          y: instantaneo ? p.y : PUERTA_OFICINA.afuera,
          speed: 120,
          etiqueta: rol.rotulo,
          titulo: titulo,
          visible: instantaneo,
          dir: p.x < m.col.x + m.col.w / 2 ? 1 : -1,
        })
        m.ayudantes.set(d.clave, actor)
        if (!instantaneo) {
          actor.fundir(1, 300)
          actor.goTo(PUERTA_OFICINA.x, PUERTA_OFICINA.adentro)
          actor.goTo(p.x, p.y, function (yo) {
            yo.dir = p.x < m.col.x + m.col.w / 2 ? 1 : -1
          })
        }
      } else if (Math.abs(actor.x - p.x) > 1 || Math.abs(actor.y - p.y) > 1) {
        if (instantaneo) {
          actor.teletransportar(p.x, p.y)
        } else if (actor.quieto()) {
          actor.goTo(p.x, p.y, function (yo) {
            yo.dir = p.x < m.col.x + m.col.w / 2 ? 1 : -1
          })
        }
      }
      actor.setTitulo(titulo)
      actor.setEstado(activo ? 'typing' : 'idle')
      actor.setFlag('sin-senal', !self.reporterOk)
    })
  }

  /** Un ayudante que terminó sale por la puerta de las oficinas. */
  retirarAyudante(a, instantaneo) {
    if (!a || !a.vivo) {
      return
    }
    if (instantaneo || this.motor.reducido) {
      a.quitar()
      return
    }
    a.limpiar()
    a.goTo(PUERTA_OFICINA.x, PUERTA_OFICINA.adentro)
    a.goTo(PUERTA_OFICINA.x, PUERTA_OFICINA.afuera, function () {
      a.fundir(0, 300, function () {
        a.quitar()
      })
    })
  }

  /**
   * Misión nueva: la carpeta vuela de la bandeja a la pizarra, el planificador la presenta y
   * después aparece la mesa del slot con su orquestador y sus ayudantes.
   */
  presentarMision(m, s, retraso) {
    const self = this
    m.esperando = true
    this.motor.despues(retraso, function () {
      if (self.mesas.get(m.slot) !== m) {
        return
      }
      self.motor.volar({ x: TRAY.x, y: TRAY.y - 24 }, { x: PIZARRA.x + 20, y: PIZARRA.y + 60 }, 'carpeta', 1800, function () {
        if (self.mesas.get(m.slot) !== m) {
          return
        }
        self.planificadorPresenta = true
        self.planificador.setEstado('present')
        self.planificador.globo('carpeta', 1600)
        self.motor.despues(1500, function () {
          if (self.mesas.get(m.slot) === m) {
            m.visible = true
            m.mesaNueva = true
            m.esperando = false
            m.orq.fundir(1, 400)
            self.dibujarMesas()
            self.aplicarAyudantes(m, m.datos, false)
          }
        })
        self.motor.despues(3200, function () {
          self.planificadorPresenta = false
          self.planificador.setEstado(self.planificadorTrabaja ? 'present' : 'idle')
        })
      })
    })
  }

  /** Dibuja las mesas visibles con su rótulo `s<N> · proyecto` y el chip de fase. */
  dibujarMesas() {
    let s = ''
    let rotulos = ''
    this.mesas.forEach(function (m) {
      if (!m.visible) {
        return
      }
      const d = m.datos || {}
      const fase = m.fase && FASES[m.fase] ? FASES[m.fase] : null
      let chip = fase
      if (d.estado === 'colgado') {
        chip = { texto: 'colgado', color: '#94A3B8' }
      } else if (d.estado === 'huerfano') {
        chip = { texto: 'huérfano', color: '#B45309' }
      } else if (!chip) {
        chip = { texto: 'sin fase', color: '#94A3B8' }
      }
      const rotulo = 's' + m.slot + (d.proyecto ? ' · ' + d.proyecto : '')
      let titulo = rotulo + (d.mision ? ' — ' + d.mision : '') + (fase ? ' · ' + fase.texto : '')
      if (d.rama) {
        titulo += ' · rama ' + d.rama
      }
      const sucios = numero(d.sucios)
      if (sucios) {
        titulo += ' · ' + sucios + ' sin commitear'
      }
      const h = horaDe(d.ultima_actividad_at)
      if (h) {
        titulo += ' · última actividad ' + h
      }
      s += mesa(m.col, MESA_Y, null, chip, { mesaNueva: m.mesaNueva, faseNueva: m.faseNueva, titulo: esc(titulo) })
      rotulos += plaquitaMesa(m.col, MESA_Y, esc(rotulo), m.mesaNueva)
      // los monitores de cada mesa van con la mesa
      s += '<g transform="translate(' + (m.col.x + m.col.w / 2) + ',' + (MESA_Y - 4) + ')" class="monitor ' + (d.estado === 'colgado' ? 'apagado' : '') + '" filter="url(#ell-soft)"><rect x="-3" y="0" width="6" height="10" fill="#8FA0B8"/><rect x="-14" y="8" width="28" height="4" rx="2" fill="#8FA0B8"/><rect x="-22" y="-30" width="44" height="30" rx="4" fill="#101C28"/><rect class="pantalla screen-on" x="-19" y="-27" width="38" height="24" rx="3" fill="url(#ell-gScreen)"/><g class="lineas" fill="#7CE0FF" opacity=".8"><rect x="-15" y="-22" width="18" height="2.5" rx="1"/><rect x="-15" y="-16" width="26" height="2.5" rx="1"/><rect x="-15" y="-10" width="12" height="2.5" rx="1"/></g></g>'
      m.mesaNueva = false
      m.faseNueva = false
    })
    this.pintarRef('mesas', this.refs.mesas, s)
    this.pintarRef('mesas-rotulos', this.refs['mesas-rotulos'], rotulos)
  }

  /* -------------------------------------------------------------------------------------------
   * Eventos → globos
   * ----------------------------------------------------------------------------------------- */

  aplicarEventos(e, instantaneo) {
    const self = this
    const nuevos = []
    e.eventos.forEach(function (ev) {
      if (!ev || ev.id === undefined || ev.id === null) {
        return
      }
      const id = String(ev.id)
      if (!self.eventosVistos.has(id)) {
        self.eventosVistos.add(id)
        nuevos.push(ev)
      }
    })
    // la ventana de eventos es de 10 minutos: lo que ya no viene no vuelve, se puede olvidar
    if (this.eventosVistos.size > 600) {
      this.eventosVistos = new Set(e.eventos.map(function (ev) {
        return String(ev.id)
      }))
    }
    if (instantaneo || e.sinDatos || nuevos.length === 0) {
      return
    }
    const lista = nuevos.slice(-MAX_GLOBOS_EVENTOS)
    const espacio = Math.min(6000, VENTANA_EVENTOS_MS / lista.length)
    lista.forEach(function (ev, i) {
      self.motor.despues(600 + i * espacio, function () {
        self.mostrarEvento(ev)
      })
    })
  }

  /**
   * Globo corto para un evento: sobre el negocio si se sabe quién es y está a la vista, si no
   * sobre el robot del agente.
   *
   * @param {Object} ev
   */
  mostrarEvento(ev) {
    const reg = ev.client_id !== undefined && ev.client_id !== null ? this.negocios.get(String(ev.client_id)) : null
    const negocio = reg && reg.actor && reg.actor.vivo && !reg.oculto && reg.actor.opacidad > 0.5 ? reg.actor : null
    const robot = function (id) {
      return this.robots[id] || null
    }.bind(this)
    const agente = robot(ev.agente)
    const decir = function (actor, tipo) {
      if (actor) {
        actor.globo(tipo, 2600)
      }
    }
    switch (ev.tipo) {
      case 'ticket_mensaje':
        decir(negocio || robot('soporte'), 'wa')
        break
      case 'ticket_respuesta':
        decir(robot('soporte'), 'ok')
        break
      case 'delegado':
        decir(robot('soporte'), 'note')
        break
      case 'asistente_mensaje':
        decir(negocio || robot('asistente'), 'star')
        break
      case 'asistente_respuesta':
        decir(robot('asistente'), 'ok')
        break
      case 'imagen_pedido':
        decir(robot('asistente'), 'img')
        break
      case 'lead_mensaje':
        decir(robot('comercial'), 'chat')
        break
      case 'lead_respuesta':
        decir(robot('comercial'), 'ok')
        break
      case 'actividad':
        if (ev.detalle === 'escaneo') {
          decir(negocio || robot('facturas'), 'doc')
          this.escanerHasta = this.motor.t + 4200
          this.actualizarEscaner()
          this.motor.despues(4300, this.actualizarEscaner.bind(this))
        } else if (ev.detalle === 'agente_negocio') {
          decir(robot('negocio'), 'chat')
        } else if (ev.detalle === 'login') {
          decir(negocio, 'hola')
        } else if (ev.detalle === 'asistente') {
          decir(negocio || robot('asistente'), 'star')
        } else {
          decir(negocio, 'ok')
        }
        break
      default:
        decir(agente, 'dots')
    }
  }

  /* -------------------------------------------------------------------------------------------
   * Vida de fondo: que la escena no esté quieta entre un refresco y otro
   * ----------------------------------------------------------------------------------------- */

  vida() {
    const self = this
    this.motor.despues(azar(6000, 11000), function () {
      self.vidaPaso()
      self.vida()
    })
  }

  vidaPaso() {
    // un robot que está trabajando muestra los «...» de que está escribiendo
    const tipeando = []
    ESTACIONES.forEach(function (est) {
      const r = this.robots[est.id]
      if (this.agentes[est.id] === 'trabajando' && !r.ocupado) {
        tipeando.push(r)
      }
    }, this)
    this.mesas.forEach(function (m) {
      if (m.visible && m.orq && m.orq.estado === 'typing') {
        tipeando.push(m.orq)
      }
    })
    if (tipeando.length) {
      tipeando[azar(0, tipeando.length - 1)].globo('dots', 1800)
    }
    // el planificador alterna entre presentar y escribir mientras planifica
    if (this.planificadorTrabaja && !this.planificadorPresenta) {
      this.planificador.setEstado(this.planificador.estado === 'present' ? 'typing' : 'present')
    }
    // alguien del salón se da una vuelta por el local
    if (!this.motor.reducido && Math.random() < 0.6) {
      const quietos = []
      this.negocios.forEach(function (reg) {
        if (reg.zona === 'salon' && reg.actor.quieto() && reg.actor.opacidad > 0.9) {
          quietos.push(reg)
        }
      })
      if (quietos.length) {
        const reg = quietos[azar(0, quietos.length - 1)]
        const i = this.lugarLibre('salon', true)
        if (this.ocupados.salon[i] === null) {
          this.liberar(reg)
          reg.lugar = i
          this.ocupados.salon[i] = reg.id
          reg.actor.goTo(LUGARES_SALON[i].x, LUGARES_SALON[i].y)
        }
      }
    }
    this.relojTic()
  }

  /** Mueve las agujas del reloj de la pared a la hora de Argentina. */
  relojTic() {
    const h = this.refs['reloj-h']
    const mi = this.refs['reloj-m']
    if (!h || !mi) {
      return
    }
    let horas = 0
    let minutos = 0
    try {
      const partes = new Intl.DateTimeFormat('es-AR', { hour: 'numeric', minute: 'numeric', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' }).formatToParts(new Date())
      partes.forEach(function (p) {
        if (p.type === 'hour') {
          horas = parseInt(p.value, 10) || 0
        }
        if (p.type === 'minute') {
          minutos = parseInt(p.value, 10) || 0
        }
      })
    } catch (err) {
      const d = new Date()
      horas = d.getHours()
      minutos = d.getMinutes()
    }
    h.setAttribute('transform', 'rotate(' + (((horas % 12) + minutos / 60) * 30).toFixed(1) + ')')
    mi.setAttribute('transform', 'rotate(' + (minutos * 6) + ')')
  }
}
