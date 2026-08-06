/**
 * La máquina 3D del centro de la escena hero (grupo 369, prompt 05).
 *
 * Viene del export autocontenido que armó Lucas el 5/8/2026 y que vive desempaquetado
 * en `marca/animacion-hero/machine.js` del repo de conocimiento. La geometría, los
 * materiales, las luces y la coreografía interna se transcriben tal cual -- son decisión
 * de diseño de Lucas, no se "mejoran" desde acá. Lo que SÍ cambia respecto del export,
 * y es todo el trabajo de este módulo:
 *
 *  1. **Se puede apagar.** El export corría un `requestAnimationFrame` infinito sin
 *     cancelación y agregaba un `resize` que nunca retiraba, porque venía de un HTML que
 *     no se desmontaba nunca. Acá la página es una SPA: sin `destruir()` quedan un bucle
 *     girando, un listener colgado y -- lo peor -- un contexto WebGL vivo por cada
 *     entrada a la página. El navegador tiene un tope de contextos por pestaña y cuando
 *     lo pasa empieza a matar los viejos a la fuerza.
 *  2. **Nada de estado a nivel de módulo.** En el export, `renderer`, `scene`, `mats`,
 *     `gears` y compañía eran variables del módulo, o sea singletons compartidos: dos
 *     instancias (o una remontada después de un `destruir()`) se pisaban entre sí y la
 *     segunda se encontraba con materiales ya liberados. Todo eso vive adentro de la
 *     fábrica.
 *  3. **Nada de `window.CCMachine`.** El export lo necesitaba para que dos archivos
 *     sueltos se hablaran; acá el que la crea se queda con la referencia.
 *
 * 🔴 `three` entra al bundle POR ACÁ, y a propósito: este módulo se carga con un
 * `import()` dinámico desde EscenaHero.vue, así que Vite se lleva three a un chunk
 * aparte y la primera pantalla de la página pública -- que la mayoría de los leads abre
 * desde el teléfono -- no paga esos cientos de KB. Cualquier import estático de este
 * archivo desde un componente lo arrastra de vuelta al bundle inicial.
 */
import * as THREE from 'three'

const BLUE = 0x1b6ff5
const INDIGO = 0x3a31fc
const ORANGE = 0xfa7e06
const D2R = Math.PI / 180

/**
 * @param {number} v
 * @returns {number}
 */
function clamp01(v) {
  return v < 0 ? 0 : (v > 1 ? 1 : v)
}

/**
 * @param {number} v
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function range(v, a, b) {
  return clamp01((v - a) / (b - a))
}

/**
 * @param {number} t
 * @returns {number}
 */
function smooth(t) {
  return t * t * (3 - 2 * t)
}

/**
 * Pixel ratio del render. El export usaba `min(dpr, 2)` a secas; acá se baja a 1.5 en
 * pantallas de teléfono (decisión pedida por el prompt): a dpr 3, que es lo normal en un
 * teléfono, renderizar a 2x son 1,8 veces más píxeles que a 1.5x para una escena que
 * ocupa media pantalla y está en movimiento, y en gama baja eso es la diferencia entre
 * 60 y 25 fps. En desktop se deja el 2 del export.
 *
 * @returns {number}
 */
function pixel_ratio() {
  const dpr = window.devicePixelRatio || 1
  if (window.innerWidth <= 767.98) {
    return Math.min(dpr, 1.5)
  }
  return Math.min(dpr, 2)
}

/**
 * true si el navegador puede crear un contexto WebGL. Sobre un canvas descartable: ver el
 * comentario de crear_maquina().
 *
 * @returns {boolean}
 */
function hay_webgl() {
  try {
    const prueba = document.createElement('canvas')
    return !!(prueba.getContext('webgl2') || prueba.getContext('webgl'))
  } catch (error) {
    return false
  }
}

/**
 * Crea la escena 3D sobre `canvas`.
 *
 * @param {HTMLCanvasElement} canvas
 * @returns {{set_progreso: function, relayout: function, destruir: function}|null}
 *          null si no se pudo crear el contexto WebGL -- el llamador muestra el estado
 *          estático y no hay error en consola.
 */
export function crear_maquina(canvas) {
  /* 🔴 Se SONDEA el soporte antes de construir el renderer, y el sondeo va sobre un canvas
     descartable. Con el try/catch a secas el criterio de "consola limpia" no se cumplía:
     WebGLRenderer escribe `console.error: THREE.WebGLRenderer: Error creating WebGL
     context.` ANTES de lanzar la excepción, así que atraparla no evitaba el error en
     consola -- lo midió el checker del prompt 05, en una página pública. El canvas del
     sondeo es otro para no dejarle al de la escena un contexto ya creado con opciones
     distintas de las que pide three. */
  if (!hay_webgl()) {
    return null
  }

  let renderer = null
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      /* El export lo traía en true. Se saca: duplica la memoria del framebuffer y sólo
         hace falta para poder leer el canvas después de dibujar (captura de pantalla),
         que acá no se usa. */
      preserveDrawingBuffer: false,
    })
  } catch (error) {
    /* Equipo viejo, driver bloqueado o WebGL deshabilitado. No es un caso excepcional en
       una página pública: se devuelve null y el componente muestra el isotipo estático. */
    return null
  }

  renderer.setPixelRatio(pixel_ratio())
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
  camera.position.set(0.1, 0.45, 8.4)
  camera.lookAt(0, 0, 0)

  const gears = []
  const leds = []
  let intake_ring = null
  let output_ring = null
  let screen_mat = null
  let power = 0
  let suck = 0
  let raf_id = null
  let destruido = false

  /**
   * @param {string} name
   * @param {object} o
   * @returns {THREE.MeshStandardMaterial}
   */
  function M(name, o) {
    const m = new THREE.MeshStandardMaterial(o)
    m.name = name
    return m
  }

  const mats = {
    cuerpo: M('cuerpo_blanco', { color: 0xf6f8fb, roughness: 0.36, metalness: 0.04 }),
    cuerpoLado: M('cuerpo_gris', { color: 0xe3e8ef, roughness: 0.42, metalness: 0.05 }),
    bisel: M('bisel', { color: 0x0d1521, roughness: 0.34, metalness: 0.3 }),
    aluminio: M('aluminio', { color: 0xc3cbd6, roughness: 0.26, metalness: 0.88 }),
    azul: M('luz_azul', { color: 0x1b6ff5, emissive: BLUE, emissiveIntensity: 0.8, roughness: 0.3, metalness: 0.1 }),
    indigo: M('luz_indigo', { color: 0x3a31fc, emissive: INDIGO, emissiveIntensity: 0.7, roughness: 0.32, metalness: 0.1 }),
    naranja: M('naranja', { color: 0xfa7e06, emissive: ORANGE, emissiveIntensity: 0.45, roughness: 0.34, metalness: 0.15 }),
    logoBlanco: M('logo_blanco', { color: 0xffffff, roughness: 0.22, metalness: 0.05 }),
  }

  /**
   * Textura de la pantalla: un degradé pintado en un canvas 2D. UNA sola, aunque la use
   * como `map` y como `emissiveMap` -- el export creaba dos idénticas.
   *
   * @returns {THREE.CanvasTexture}
   */
  function screen_texture() {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 360
    const g = c.getContext('2d')
    const grad = g.createLinearGradient(0, 0, 512, 360)
    grad.addColorStop(0, '#0E6BFA')
    grad.addColorStop(0.55, '#2A56F8')
    grad.addColorStop(1, '#3A31FC')
    g.fillStyle = grad
    g.fillRect(0, 0, 512, 360)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }

  /**
   * @param {number} w
   * @param {number} h
   * @param {number} r
   * @returns {THREE.Shape}
   */
  function rounded_rect(w, h, r) {
    const s = new THREE.Shape()
    const x = -w / 2
    const y = -h / 2
    s.moveTo(x + r, y)
    s.lineTo(x + w - r, y)
    s.quadraticCurveTo(x + w, y, x + w, y + r)
    s.lineTo(x + w, y + h - r)
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    s.lineTo(x + r, y + h)
    s.quadraticCurveTo(x, y + h, x, y + h - r)
    s.lineTo(x, y + r)
    s.quadraticCurveTo(x, y, x + r, y)
    return s
  }

  /**
   * @param {number} w
   * @param {number} h
   * @param {number} d
   * @param {number} r
   * @param {number} bevel
   * @returns {THREE.ExtrudeGeometry}
   */
  function slab(w, h, d, r, bevel) {
    const b = typeof bevel === 'number' ? bevel : 0.02
    const g = new THREE.ExtrudeGeometry(rounded_rect(w, h, r), {
      depth: Math.max(d - b * 2, 0.01),
      bevelEnabled: true,
      bevelSize: b,
      bevelThickness: b,
      bevelSegments: 3,
      curveSegments: 14,
    })
    g.center()
    return g
  }

  /**
   * @param {string} name
   * @param {THREE.BufferGeometry} geom
   * @param {THREE.Material} material
   * @returns {THREE.Mesh}
   */
  function mesh(name, geom, material) {
    const m = new THREE.Mesh(geom, material)
    m.name = name
    return m
  }

  /**
   * @param {number} r
   * @param {number} teeth
   * @param {number} tooth
   * @param {number} hole
   * @returns {THREE.ExtrudeGeometry}
   */
  function gear_geom(r, teeth, tooth, hole) {
    const s = new THREE.Shape()
    const step = (Math.PI * 2) / teeth
    let i = 0
    for (i = 0; i < teeth; i++) {
      const a = i * step
      const puntos = [
        [a + step * 0.03, r],
        [a + step * 0.17, r + tooth],
        [a + step * 0.33, r + tooth],
        [a + step * 0.47, r],
        [a + step * 0.75, r],
      ]
      puntos.forEach(function (par, k) {
        const x = Math.cos(par[0]) * par[1]
        const y = Math.sin(par[0]) * par[1]
        if (i === 0 && k === 0) {
          s.moveTo(x, y)
        } else {
          s.lineTo(x, y)
        }
      })
    }
    s.closePath()
    s.holes.push(new THREE.Path().absarc(0, 0, hole, 0, Math.PI * 2, true))
    const g = new THREE.ExtrudeGeometry(s, {
      depth: 0.08,
      bevelEnabled: true,
      bevelSize: 0.01,
      bevelThickness: 0.01,
      bevelSegments: 2,
      curveSegments: 22,
    })
    g.center()
    return g
  }

  /**
   * El isotipo de ComercioCity construido en 3D: los tres arcos, las tres barras y la
   * flecha naranja. Mismas proporciones que `src/assets/isotipo-comerciocity.svg`.
   *
   * @param {number} R
   * @returns {THREE.Group}
   */
  function build_logo(R) {
    const g = new THREE.Group()
    g.name = 'isotipo_comerciocity'
    const tube = R * 0.16

    const arcs = [
      ['arco_superior', 55, 130],
      ['arco_izquierdo', 137, 223],
      ['arco_inferior', 230, 330],
    ]
    arcs.forEach(function (arco) {
      const span = (arco[2] - arco[1]) * D2R
      const m = mesh(arco[0], new THREE.TorusGeometry(R, tube, 12, 64, span), mats.logoBlanco)
      m.rotation.z = arco[1] * D2R
      g.add(m)
    })

    const s = R / 103
    const barras = [
      ['barra_1', -38.5, -38, 52],
      ['barra_2', 0, -25.5, 77],
      ['barra_3', 38.5, -14.5, 99],
    ]
    barras.forEach(function (barra) {
      const b = mesh(barra[0], slab(28 * s, barra[3] * s, tube * 1.6, 3 * s, 0.006), mats.logoBlanco)
      b.position.set(barra[1] * s, barra[2] * s, 0)
      g.add(b)
    })

    const tri = new THREE.Shape()
    tri.moveTo((12 * R) / 103, (-13 * R) / 103)
    tri.lineTo((-14.5 * R) / 103, (-2 * R) / 103)
    tri.lineTo((2.5 * R) / 103, (15 * R) / 103)
    tri.closePath()
    const ag = new THREE.ExtrudeGeometry(tri, {
      depth: tube * 1.4,
      bevelEnabled: true,
      bevelSize: 0.008,
      bevelThickness: 0.008,
      bevelSegments: 2,
    })
    ag.center()
    const arrow = mesh('flecha_marca', ag, mats.naranja)
    arrow.position.set(65 * s, 51 * s, 0)
    g.add(arrow)

    return g
  }

  /**
   * @returns {THREE.Group}
   */
  function build_machine() {
    const g = new THREE.Group()
    g.name = 'plataforma_comerciocity'
    const W = 2.7
    const H = 2.0
    const D = 1.05

    g.add(mesh('carcasa', slab(W, H, D, 0.24, 0.05), mats.cuerpo))

    const back = mesh('carcasa_trasera', slab(W - 0.16, H - 0.16, 0.1, 0.2, 0.02), mats.cuerpoLado)
    back.position.z = -(D / 2 + 0.03)
    g.add(back)

    const bezel = mesh('bisel_pantalla', slab(2.3, 1.62, 0.1, 0.18, 0.02), mats.bisel)
    bezel.position.z = D / 2 + 0.02
    g.add(bezel)

    const textura = screen_texture()
    screen_mat = new THREE.MeshStandardMaterial({
      map: textura,
      emissiveMap: textura,
      emissive: 0xffffff,
      emissiveIntensity: 0.3,
      roughness: 0.1,
      metalness: 0.0,
    })
    screen_mat.name = 'pantalla'
    const screen = mesh('pantalla', slab(2.06, 1.38, 0.05, 0.12, 0.012), screen_mat)
    screen.position.z = D / 2 + 0.075
    g.add(screen)

    const logo_group = build_logo(0.5)
    logo_group.position.set(0, 0.02, D / 2 + 0.12)
    g.add(logo_group)

    /* LEDs del borde inferior */
    let i = 0
    for (i = 0; i < 7; i++) {
      const led = mesh(
        'led_' + (i + 1),
        new THREE.SphereGeometry(0.036, 18, 14),
        i === 3 ? mats.naranja : mats.azul
      )
      led.position.set(-0.54 + i * 0.18, -(H / 2 - 0.11), D / 2 + 0.04)
      led.userData.phase = i * 0.55
      leds.push(led)
      g.add(led)
    }

    /* Engranajes semiocultos en la cara superior */
    const engranajes = [
      ['engranaje_mayor', 0.34, 16, 0.07, 0.09, -0.72, 0.62],
      ['engranaje_menor', 0.24, 12, 0.06, 0.07, 0.68, -0.78],
    ]
    engranajes.forEach(function (e) {
      const m = mesh(e[0], gear_geom(e[1], e[2], e[3], e[4]), mats.aluminio)
      m.rotation.x = Math.PI / 2
      m.position.set(e[5], H / 2 + 0.05, 0.02)
      m.userData.spd = e[6]
      gears.push(m)
      g.add(m)
    })

    /* Entrada, a la izquierda */
    const funnel = mesh(
      'boca_entrada',
      new THREE.CylinderGeometry(0.66, 0.32, 0.72, 40, 1, true),
      mats.aluminio
    )
    funnel.rotation.z = Math.PI / 2
    funnel.position.x = -(W / 2 + 0.3)
    /* DoubleSide sobre el material compartido: el embudo es un cilindro abierto y sin
       esto se le ve el interior transparente. Lo hereda todo lo de aluminio, igual que
       en el export. */
    mats.aluminio.side = THREE.DoubleSide
    g.add(funnel)

    intake_ring = mesh('aro_entrada', new THREE.TorusGeometry(0.66, 0.05, 16, 44), mats.azul)
    intake_ring.rotation.y = Math.PI / 2
    intake_ring.position.x = -(W / 2 + 0.65)
    g.add(intake_ring)

    const throat = mesh('garganta', new THREE.CylinderGeometry(0.3, 0.3, 0.24, 28), mats.cuerpoLado)
    throat.rotation.z = Math.PI / 2
    throat.position.x = -(W / 2 + 0.01)
    g.add(throat)

    /* Salida, a la derecha */
    const out_pipe = mesh('boca_salida', new THREE.CylinderGeometry(0.3, 0.44, 0.6, 36), mats.aluminio)
    out_pipe.rotation.z = -Math.PI / 2
    out_pipe.position.x = W / 2 + 0.28
    g.add(out_pipe)

    output_ring = mesh('aro_salida', new THREE.TorusGeometry(0.44, 0.045, 16, 40), mats.indigo)
    output_ring.rotation.y = Math.PI / 2
    output_ring.position.x = W / 2 + 0.58
    g.add(output_ring)

    const patas = [[-0.9, -0.36], [0.9, -0.36], [-0.9, 0.36], [0.9, 0.36]]
    patas.forEach(function (p, i2) {
      const foot = mesh(
        'pata_' + (i2 + 1),
        new THREE.CylinderGeometry(0.1, 0.13, 0.2, 20),
        mats.cuerpoLado
      )
      foot.position.set(p[0], -(H / 2 + 0.08), p[1])
      g.add(foot)
    })

    return g
  }

  /**
   * @returns {void}
   */
  function lights() {
    scene.add(new THREE.HemisphereLight(0xffffff, 0xcbd6e8, 1.05))
    const key = new THREE.DirectionalLight(0xffffff, 2.3)
    key.position.set(3.2, 4.4, 5.4)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0xbfd4ff, 1.5)
    rim.position.set(-5, 1.8, -3)
    scene.add(rim)
    const fill = new THREE.DirectionalLight(0xe8ecf6, 1.1)
    fill.position.set(-3.4, -2.2, 3)
    scene.add(fill)
  }

  lights()
  const root = build_machine()
  scene.add(root)
  /* El export usaba `new THREE.Clock()`, que en three 0.184 está deprecado y escribe un
     warning en consola por cada escena creada (medido por el checker del prompt 05: uno
     por montaje, en una página pública). No se cambia por THREE.Timer, que tiene otra
     API: lo único que se le pedía al Clock era el tiempo transcurrido en segundos, y eso
     es una resta. */
  const arranque_ms = window.performance.now()

  /**
   * @returns {void}
   */
  function resize() {
    if (destruido || !canvas) {
      return
    }
    const w = canvas.clientWidth || 1
    const h = canvas.clientHeight || 1
    renderer.setSize(w, h, false)
    const a = w / h
    camera.aspect = a
    camera.fov = 34
    camera.position.z = Math.max(8.1 / a, 4.9) * 1.04
    camera.updateProjectionMatrix()
  }

  /**
   * Un frame. Idéntico al del export salvo que guarda el id para poder cancelarlo.
   *
   * @returns {void}
   */
  function tick() {
    if (destruido) {
      return
    }
    const t = (window.performance.now() - arranque_ms) / 1000
    const spin = 0.5 + suck * 5
    gears.forEach(function (m) {
      m.rotation.z += m.userData.spd * spin * 0.016
    })

    const base = 0.25 + power * 0.75
    mats.azul.emissiveIntensity = base * (1 + suck * 1.1) + Math.sin(t * 2.4) * 0.08 * power
    mats.indigo.emissiveIntensity = base * 0.85
    mats.naranja.emissiveIntensity = 0.2 + power * 0.5
    if (screen_mat) {
      screen_mat.emissiveIntensity = 0.22 + power * 0.34
    }

    leds.forEach(function (l, i) {
      l.scale.setScalar(0.8 + power * (0.2 + Math.sin(t * 4 + (l.userData.phase || i)) * 0.2))
    })
    intake_ring.scale.setScalar(1 + suck * 0.1 + Math.sin(t * 5) * 0.025 * suck)
    output_ring.scale.setScalar(1 + Math.sin(t * 4.2) * 0.03 * power)

    root.rotation.y = Math.sin(t * 0.3) * 0.2 + (1 - power) * 0.28
    root.rotation.x = -0.05 + Math.sin(t * 0.22) * 0.04
    root.position.y = Math.sin(t * 0.58) * 0.045
    root.scale.setScalar(0.84 + power * 0.16)

    renderer.render(scene, camera)
    raf_id = window.requestAnimationFrame(tick)
  }

  resize()
  window.addEventListener('resize', resize, { passive: true })
  raf_id = window.requestAnimationFrame(tick)

  return {
    /**
     * @param {number} p Progreso [0,1] de la escena.
     * @returns {void}
     */
    set_progreso(p) {
      power = smooth(range(p, 0.02, 0.2))
      suck = smooth(range(p, 0.56, 0.7)) * (1 - smooth(range(p, 0.88, 0.98)) * 0.7)
    },

    relayout: resize,

    /**
     * Apaga la escena y suelta la GPU. Sin esto, cada entrada a la página deja un
     * contexto WebGL vivo: el navegador tiene un tope por pestaña y cuando lo pasa mata
     * los viejos a la fuerza, así que la escena se rompe sola después de unas cuantas
     * visitas.
     *
     * @returns {void}
     */
    destruir() {
      destruido = true
      if (raf_id !== null) {
        window.cancelAnimationFrame(raf_id)
        raf_id = null
      }
      window.removeEventListener('resize', resize)

      /* Se recorre la escena en vez de llevar una lista a mano: así no hay forma de
         olvidarse de liberar algo que se agregue mañana. */
      scene.traverse(function (obj) {
        if (obj.geometry) {
          obj.geometry.dispose()
        }
        const materiales = Array.isArray(obj.material) ? obj.material : [obj.material]
        materiales.forEach(function (mat) {
          if (!mat) {
            return
          }
          if (mat.map) {
            mat.map.dispose()
          }
          if (mat.emissiveMap && mat.emissiveMap !== mat.map) {
            mat.emissiveMap.dispose()
          }
          mat.dispose()
        })
      })
      scene.clear()
      renderer.dispose()
      /* dispose() libera los recursos pero NO el contexto: para eso está esta extensión,
         que es la única forma de devolverlo antes de que el recolector pase. */
      const perder = renderer.getContext().getExtension('WEBGL_lose_context')
      if (perder) {
        perder.loseContext()
      }
    },
  }
}
