/**
 * 🔴 OBSOLETO desde el 31/8/2026 -- NO USAR PARA GENERAR LA TIRA QUE SE SHIPPEA.
 *
 * Los tres números que fija este archivo quedaron desactualizados por la animación
 * corregida de Claude Design: `DURACION_S = 12` (el loop real ahora es 24,75s, ver
 * `LOOP_T` en `./machine.js`), las frecuencias cuantizadas de FRECUENCIAS más abajo (el
 * `machine.js` nuevo ya las trae cuantizadas de fábrica, con otro loop) y `ASPECTO =
 * 8,1/4,9 = 1,65306` (el asset que se shippea hoy viene a 1,5 -- decisión de Lucas,
 * documentada en `marca/animacion-hero/README.md` del repo de conocimiento). Usar este
 * archivo tal cual generaría una máquina DISTINTA de la que se ve en pantalla, sin que
 * nada avise.
 *
 * Por qué sigue acá en vez de borrarse: `machine.js` (copia textual del repo de
 * conocimiento, en esta misma carpeta) ya trae `initStatic()` + `renderAt()` con las
 * frecuencias correctas y podría reemplazar a este archivo entero -- pero verificar que
 * `generar.mjs` repuntado a esa fuente reproduce bytes a byte los cuadros que Lucas ya
 * aprobó (594 PNG a 1200x800/600x400, fuera de este repo, ver el README de esta carpeta)
 * quedó fuera del alcance de esta misión por tiempo. La tira que se shippeó en
 * `public/demo/maquina/` sale de re-encodear esos PNG directo a WebP animado con
 * `ffmpeg`, no de este generador. Repuntar `generar.mjs` a `machine.js` y borrar este
 * archivo es el trabajo que queda pendiente -- ver la sección correspondiente del
 * README.
 *
 * La máquina de la escena hero, en versión DETERMINISTA y sin bucle: se le pide un
 * cuadro para un instante `t` y lo dibuja. Era la fuente de los WebP pre-renderizados
 * que reproducía `src/components/demo/maquina-cuadros.js` en la página -- ese módulo se
 * borró junto con este diseño (ver la cabecera de obsolescencia de arriba); hoy la
 * máquina se reproduce con `src/components/demo/maquina-animacion.js`.
 *
 * 🔴 ESTE ARCHIVO ES LA ÚLTIMA COPIA VIVA DE LA GEOMETRÍA. El módulo que la
 * renderizaba en vivo (`src/components/demo/escena-maquina.js`) se borró en la misión
 * 12, pieza 2, junto con la dependencia `three` de la SPA. El diseño original sigue
 * documentado en `marca/animacion-hero/machine.js` del repo de conocimiento
 * (`lucasgonzz/claude-comerciocity`), que es de donde salió todo esto y donde hay que
 * ir si algún día se rehace. Acá la geometría, los materiales y las luces se
 * transcriben tal cual: son decisión de diseño de Lucas, no se "mejoran" desde acá.
 *
 * Qué cambia respecto de la versión en vivo, y por qué cada cosa:
 *
 *  1. **El tiempo entra por parámetro.** No hay `requestAnimationFrame` ni
 *     `performance.now()`: `render_en(t)` fija el estado para ese `t` y llama a
 *     `renderer.render()` una vez. Es lo que hace que la generación no dependa de que
 *     el navegador componga cuadros en tiempo real -- que es justamente lo que este
 *     entorno no puede hacer.
 *
 *  2. **`power` y `suck` son fijos.** Eran la reacción al scroll, y la máquina
 *     pre-renderizada dejó de reaccionar al scroll (decisión de Lucas, 7/8/2026:
 *     "no me importa sacrificar el funcionamiento del scroll con tal de que fluya").
 *     `power = 1` es el estado encendido, que es el que el lead veía durante casi
 *     todo el recorrido (`power` llegaba a 1 al 20% del progreso). `suck = 0` porque
 *     la succión era un pico corto atado a las tarjetas entrando a la máquina, y sin
 *     tarjetas que succionar no tiene qué representar.
 *
 *  3. **Las frecuencias se cuantizan para que el loop CIERRE.** Es el punto delicado
 *     de todo esto y está explicado abajo, en FRECUENCIAS.
 *
 *  4. **`preserveDrawingBuffer: true`.** La versión en vivo lo apagaba a propósito
 *     (duplica la memoria del framebuffer y no hacía falta). Acá hace falta exactamente
 *     para lo que aquella no lo necesitaba: leer el canvas después de dibujar.
 *
 *  5. **Cámara con aspecto fijo.** Ver ENCUADRE.
 *
 * ---------------------------------------------------------------------------
 * FRECUENCIAS -- por qué el cuadro 120 no empalmaba con el 1
 * ---------------------------------------------------------------------------
 *
 * La escena original mezcla senos de frecuencias que no son múltiplos entre sí
 * (`sin(t*0.3)`, `sin(t*0.22)`, `sin(t*0.58)`, LEDs en `sin(t*4)`, aro de salida en
 * `sin(t*4.2)`, luz azul en `sin(t*2.4)`) y engranajes que ACUMULAN rotación. Con eso,
 * el estado en `t = T` no es el estado en `t = 0` para ningún `T` razonable, y el loop
 * salta.
 *
 * Cada término se lleva al armónico entero de `1/T` más cercano, con dos reglas:
 *
 *  · **Nunca a cero.** Los tres términos lentos del cuerpo tienen períodos de 11 a 29
 *    segundos; en un loop de 12s el armónico más cercano de los dos más lentos sería
 *    el 0, o sea que el vaivén desaparecería y la máquina quedaría clavada. Se los
 *    sube al armónico 1: se mueven más rápido que antes, y esa es la deuda que este
 *    enfoque paga. Está declarada en el reporte, con los números.
 *  · **Cuando dos términos caen en el mismo armónico, se les da una fase distinta.**
 *    En el original tenían frecuencias distintas y se cruzaban entre sí; si quedaran
 *    todos en fase, el cuerpo entero subiría, rotaría e inclinaría al mismo tiempo, y
 *    se leería como UN movimiento en vez de tres. Las fases no afectan al cierre del
 *    loop: un seno de período T empalma consigo mismo con cualquier fase.
 *
 * Los engranajes son otro caso: no son senos, acumulan. Su velocidad se ajusta para
 * que en `T` completen un número ENTERO de pasos de diente (2π/dientes), que es la
 * simetría real de la pieza -- no hace falta una vuelta entera.
 *
 * ---------------------------------------------------------------------------
 * ENCUADRE -- por qué el aspecto 1,6531 y no cualquiera
 * ---------------------------------------------------------------------------
 *
 * La versión en vivo alejaba la cámara según el aspecto del canvas:
 * `z = max(8.1 / a, 4.9) * 1.04`. La consecuencia, que es lo que hace posible
 * reemplazarla por una imagen: mientras `a < 8.1/4.9 = 1,6531`, el ANCHO del mundo
 * visible es constante (2 * 8,1 * 1,04 * tan(17°) = 5,151 unidades) y lo único que
 * cambia es cuánto espacio vacío sobra arriba y abajo.
 *
 * O sea que el encuadre original, para cualquier aspecto, es exactamente un
 * `object-fit: contain` de un rectángulo de 5,151 x 3,116 unidades -- aspecto 1,6531.
 * Pre-renderizando en ese aspecto y dibujando con contain, la máquina queda del mismo
 * tamaño y en el mismo lugar que antes en TODOS los tamaños de pantalla, sin más
 * cuentas en el reproductor. El punto de quiebre se calcula acá abajo en vez de
 * escribirlo a mano, así que si alguien toca la fórmula de la cámara, el aspecto lo
 * sigue solo.
 */

const BLUE = 0x1b6ff5
const INDIGO = 0x3a31fc
const ORANGE = 0xfa7e06
const D2R = Math.PI / 180

/** Estado encendido de la máquina: ver el punto 2 del comentario de arriba. */
const POWER = 1
const SUCK = 0

/**
 * Cuadros por segundo que asumía la versión en vivo para los engranajes. No es un
 * parámetro nuevo: el original hacía `rotation.z += spd * spin * 0.016` UNA VEZ POR
 * CUADRO, o sea que su velocidad real dependía de a cuántos cuadros por segundo
 * corriera el navegador. A 60 -- lo que el bucle pedía -- eso son `spd * spin * 0.96`
 * radianes por segundo. Acá la velocidad pasa a estar en radianes por segundo de
 * verdad, y este número es lo que traduce una cosa en la otra.
 */
const FPS_DEL_ORIGINAL = 60

/**
 * Aspecto del encuadre = el punto donde `8.1 / a` deja de mandar sobre el mínimo de
 * 4.9 en la fórmula de la cámara. Ver ENCUADRE.
 *
 * @type {number}
 */
export const ASPECTO = 8.1 / 4.9

/**
 * Lleva `omega` al múltiplo entero de la frecuencia fundamental del loop más cercano,
 * sin dejarlo nunca en cero (ver FRECUENCIAS).
 *
 * @param {number} omega Frecuencia angular original, en radianes por segundo.
 * @param {number} duracion Duración del loop, en segundos.
 * @returns {number} La frecuencia cuantizada, en radianes por segundo.
 */
export function cuantizar(omega, duracion) {
  const fundamental = (Math.PI * 2) / duracion
  const armonico = Math.max(1, Math.round(Math.abs(omega) / fundamental))
  return Math.sign(omega) * armonico * fundamental
}

/**
 * Velocidad de un engranaje, ajustada para que en `duracion` complete un número entero
 * de pasos de diente.
 *
 * @param {number} spd Velocidad relativa del engranaje, tal cual la declara la escena.
 * @param {number} dientes Cantidad de dientes de la pieza.
 * @param {number} duracion Duración del loop, en segundos.
 * @returns {number} Radianes por segundo.
 */
export function velocidad_engranaje(spd, dientes, duracion) {
  const spin = 0.5 + SUCK * 5
  const cruda = spd * spin * 0.016 * FPS_DEL_ORIGINAL
  const paso = (Math.PI * 2) / dientes
  const pasos = Math.round((cruda * duracion) / paso)
  /* Un engranaje que quedara en cero pasos se vería clavado, que es peor que uno un
     poco más rápido: se le da al menos un paso, conservando el sentido de giro. */
  const enteros = pasos === 0 ? Math.sign(cruda) : pasos
  return (enteros * paso) / duracion
}

/**
 * Arma la escena sobre `canvas` y devuelve con qué dibujarla.
 *
 * @param {object} THREE El módulo de three ya importado.
 * @param {HTMLCanvasElement} canvas
 * @param {{ancho: number, alto: number, duracion: number, sin_cuantizar: boolean}} opciones
 *        `sin_cuantizar` deja las frecuencias y las velocidades EXACTAS de la escena
 *        original, con las fases en cero: el loop no cierra, así que no sirve para
 *        generar la tira. Existe para `comparar-con-el-original.mjs`, que mide cuánto
 *        se aparta el pre-render de lo que había antes -- y esa comparación no valdría
 *        nada si el modo "original" no fuera exactamente el original.
 * @returns {{render_en: function(number): void, frecuencias: object}}
 */
export function crear_escena_determinista(THREE, canvas, opciones) {
  const ancho = opciones.ancho
  const alto = opciones.alto
  const duracion = opciones.duracion
  const sin_cuantizar = !!opciones.sin_cuantizar

  const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
    /* Al revés que en la versión en vivo, y por el motivo exacto por el que allá se
       apagaba: acá SÍ hay que poder leer el canvas después de dibujar. */
    preserveDrawingBuffer: true,
  })
  renderer.setPixelRatio(1)
  renderer.setSize(ancho, alto, false)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
  camera.position.set(0.1, 0.45, 8.4)
  camera.lookAt(0, 0, 0)

  /* Misma cuenta que el `resize()` de la versión en vivo, y en el mismo orden: el
     lookAt de arriba fija la orientación DESDE la posición inicial y después solo se
     mueve z, sin volver a mirar al origen. Copiarlo tal cual importa: rehacer el
     lookAt acá inclinaría la cámara distinto y el encuadre no sería el mismo. */
  const a = ancho / alto
  camera.aspect = a
  camera.fov = 34
  camera.position.z = Math.max(8.1 / a, 4.9) * 1.04
  camera.updateProjectionMatrix()

  const gears = []
  const leds = []
  let intake_ring = null
  let output_ring = null
  let screen_mat = null

  /**
   * @param {string} name
   * @param {object} o
   * @returns {object}
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
   * Textura de la pantalla: un degradé pintado en un canvas 2D.
   *
   * @returns {object}
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
   * @returns {object}
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
   * @returns {object}
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
   * @param {object} geom
   * @param {object} material
   * @returns {object}
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
   * @returns {object}
   */
  function gear_geom(r, teeth, tooth, hole) {
    const s = new THREE.Shape()
    const step = (Math.PI * 2) / teeth
    let i = 0
    for (i = 0; i < teeth; i++) {
      const ang = i * step
      const puntos = [
        [ang + step * 0.03, r],
        [ang + step * 0.17, r + tooth],
        [ang + step * 0.33, r + tooth],
        [ang + step * 0.47, r],
        [ang + step * 0.75, r],
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
   * El isotipo de ComercioCity en 3D.
   *
   * @param {number} R
   * @returns {object}
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
   * @returns {object}
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
      /* Radianes por segundo ya cuantizados, en vez de un incremento por cuadro. */
      m.userData.omega = sin_cuantizar
        ? e[6] * (0.5 + SUCK * 5) * 0.016 * FPS_DEL_ORIGINAL
        : velocidad_engranaje(e[6], e[2], duracion)
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

  /* Las tres frecuencias del cuerpo caen todas en el armónico 1 de un loop de 12s, así
     que van con fases distintas para no moverse como un bloque (ver FRECUENCIAS). Los
     valores son un tercio de vuelta entre sí: lo único que se busca es que no coincidan
     los máximos. */
  /**
   * @param {number} omega
   * @returns {number}
   */
  function frecuencia(omega) {
    return sin_cuantizar ? omega : cuantizar(omega, duracion)
  }

  const frecuencias = {
    rotacion_y: frecuencia(0.3),
    rotacion_x: frecuencia(0.22),
    posicion_y: frecuencia(0.58),
    leds: frecuencia(4),
    aro_salida: frecuencia(4.2),
    luz_azul: frecuencia(2.4),
    engranajes: gears.map(function (g) {
      return g.userData.omega
    }),
  }
  const FASE_ROTACION_X = sin_cuantizar ? 0 : (Math.PI * 2) / 3
  const FASE_POSICION_Y = sin_cuantizar ? 0 : (Math.PI * 4) / 3

  /**
   * Deja la escena en el estado que le corresponde a `t` y dibuja un cuadro.
   *
   * @param {number} t Segundos dentro del loop.
   * @returns {void}
   */
  function render_en(t) {
    gears.forEach(function (m) {
      m.rotation.z = m.userData.omega * t
    })

    /* Con power = 1 y suck = 0, varias de estas cuentas dan una constante. Se dejan
       escritas igual, con la misma forma que en la escena original, para que la
       comparación entre los dos archivos sea directa y se vea qué se congeló. */
    const base = 0.25 + POWER * 0.75
    mats.azul.emissiveIntensity =
      base * (1 + SUCK * 1.1) + Math.sin(t * frecuencias.luz_azul) * 0.08 * POWER
    mats.indigo.emissiveIntensity = base * 0.85
    mats.naranja.emissiveIntensity = 0.2 + POWER * 0.5
    if (screen_mat) {
      screen_mat.emissiveIntensity = 0.22 + POWER * 0.34
    }

    leds.forEach(function (l, i) {
      l.scale.setScalar(
        0.8 + POWER * (0.2 + Math.sin(t * frecuencias.leds + (l.userData.phase || i)) * 0.2)
      )
    })
    intake_ring.scale.setScalar(1 + SUCK * 0.1)
    output_ring.scale.setScalar(1 + Math.sin(t * frecuencias.aro_salida) * 0.03 * POWER)

    root.rotation.y = Math.sin(t * frecuencias.rotacion_y) * 0.2 + (1 - POWER) * 0.28
    root.rotation.x = -0.05 + Math.sin(t * frecuencias.rotacion_x + FASE_ROTACION_X) * 0.04
    root.position.y = Math.sin(t * frecuencias.posicion_y + FASE_POSICION_Y) * 0.045
    root.scale.setScalar(0.84 + POWER * 0.16)

    renderer.render(scene, camera)
  }

  return {
    render_en: render_en,
    frecuencias: frecuencias,
  }
}
