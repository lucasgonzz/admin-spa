/**
 * Genera las tiras de cuadros WebP de la máquina de la escena hero (misión 12, pieza 1).
 *
 * Se corre a mano, cuando cambia el diseño de la máquina, y su salida
 * (`public/demo/maquina/`) se versiona: la página NO renderiza nada en 3D, reproduce
 * estos cuadros. Ver `README.md` en esta misma carpeta para el cómo y el porqué.
 *
 *   node scripts/generar-cuadros-maquina/generar.mjs
 *
 * Cómo funciona, y por qué así: abre la escena en Chromium con Playwright y le fija el
 * reloj `t` A MANO de a pasos, llamando `renderer.render()` directo. NO deja correr el
 * bucle en tiempo real. `escena-determinista.js` no tiene más fuente de variación que
 * el tiempo, así que esto no necesita `requestAnimationFrame` ni que el navegador
 * componga cuadros -- que es justamente lo que el entorno donde esto se construyó no
 * podía hacer, y el motivo por el que la versión anterior de esta tarea (medir fps en
 * vivo) era imposible acá.
 *
 * La codificación a WebP la hace el propio Chromium (`canvas.toDataURL('image/webp')`),
 * que soporta canal alfa: no hace falta `sharp` ni `cwebp` ni ninguna otra dependencia
 * nativa.
 */
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = resolve(AQUI, '..', '..')
const SALIDA = join(RAIZ, 'public', 'demo', 'maquina')

/**
 * Duración del loop, en segundos. Es el parámetro que decide todo lo demás.
 *
 * 12 y no los 6 que proponía la misión: la escena tiene tres movimientos lentos del
 * cuerpo (períodos de 11, 21 y 29 segundos) y en un loop de 6s los dos más lentos
 * quedan por debajo del primer armónico, o sea que desaparecen y la máquina se queda
 * quieta. Con 12 el más rápido de los tres (el flotado vertical, 10,8s) queda casi
 * exacto y los otros dos se aceleran, que es la deuda declarada en el reporte.
 */
const DURACION_S = 12

/**
 * Calidad de la codificación WebP. 0,82 es donde el degradé de la pantalla todavía no
 * muestra bandas. El presupuesto de peso se ajusta bajando CUADROS POR SEGUNDO, no
 * calidad -- el movimiento es lento y tolera mejor menos cuadros que compresión sucia
 * (indicación explícita de la misión).
 */
const CALIDAD = 0.82

/** Se prueban en orden y gana el primero que entre en presupuesto. */
const FPS_CANDIDATOS = [10, 8, 6]

/**
 * Los dos perfiles de tira. El ancho sale de para qué tamaño hace falta:
 *
 *  · escritorio: la columna central de la escena mide ~340 CSS px de ancho en un
 *    viewport de 1440, y el renderer topeaba el pixel ratio en 1,5 -- o sea ~510 px
 *    reales. 640 cubre eso y además el caso de un viewport de 1920, donde la misma
 *    columna se va a ~695 px reales; a 512 la imagen se agrandaba un 35% y se veía
 *    blanda justo en las pantallas grandes, que es donde más se mira.
 *  · teléfono: la fila de la máquina es de 20vh y el marco entra en ~180 CSS px de
 *    ancho; con el mismo tope de 1,5 son ~270. 320 cubre eso.
 *
 * El alto se deriva del aspecto del encuadre (ver ENCUADRE en escena-determinista.js).
 * El presupuesto es el de la misión: 2 MB y 800 kB.
 */
const PERFILES = [
  { nombre: 'escritorio', ancho: 640, presupuesto_kb: 2048 },
  { nombre: 'telefono', ancho: 320, presupuesto_kb: 800 },
]

/**
 * Sirve la página de render y los módulos que necesita. Un server propio y no `vite`:
 * esto no tiene nada que ver con el build de la SPA y no tiene que arrastrarlo.
 *
 * @returns {Promise<{url: string, cerrar: function}>}
 */
function levantar_server() {
  const server = createServer(function (req, res) {
    const ruta = (req.url || '/').split('?')[0]

    if (ruta === '/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(HTML)
      return
    }

    const archivos = {
      '/escena-determinista.js': join(AQUI, 'escena-determinista.js'),
    }
    let destino = archivos[ruta]
    if (!destino && ruta.startsWith('/cuadros/')) {
      /* Los WebP ya escritos, para poder medirlos desde la página (ver
         `__medir_archivos`): no alcanza con comparar renders en memoria. */
      const relativo = ruta.replace('/cuadros/', '').split('/')
      destino = join(SALIDA, relativo[0], relativo[1])
      readFile(destino)
        .then(function (contenido) {
          res.setHeader('Content-Type', 'image/webp')
          res.end(contenido)
        })
        .catch(function () {
          res.statusCode = 404
          res.end('no')
        })
      return
    }
    if (!destino && ruta.startsWith('/three/')) {
      /* three.module.js importa ./three.core.js, así que hay que servir la carpeta
         entera, no un archivo suelto. Y sale de las dependencias de ESTA carpeta, no de
         las de la SPA: `three` se borró del proyecto en la pieza 2 y no vuelve. */
      destino = join(AQUI, 'node_modules', 'three', 'build', ruta.replace('/three/', ''))
    }
    if (!destino) {
      res.statusCode = 404
      res.end('no')
      return
    }

    readFile(destino)
      .then(function (contenido) {
        res.setHeader('Content-Type', 'text/javascript; charset=utf-8')
        res.end(contenido)
      })
      .catch(function () {
        res.statusCode = 404
        res.end('no')
      })
  })

  return new Promise(function (resolver) {
    server.listen(0, '127.0.0.1', function () {
      const puerto = server.address().port
      resolver({
        url: 'http://127.0.0.1:' + puerto + '/',
        cerrar: function () {
          return new Promise(function (r) {
            server.close(r)
          })
        },
      })
    })
  })
}

const HTML = `<!doctype html>
<html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}</style></head>
<body>
<canvas id="lienzo"></canvas>
<script type="importmap">{"imports":{"three":"/three/three.module.js","three/":"/three/"}}</script>
<script type="module">
import * as THREE from 'three'
import { crear_escena_determinista, ASPECTO } from '/escena-determinista.js'

window.__aspecto = ASPECTO

window.__preparar = function (ancho, alto, duracion) {
  const lienzo = document.getElementById('lienzo')
  lienzo.width = ancho
  lienzo.height = alto
  const escena = crear_escena_determinista(THREE, lienzo, { ancho: ancho, alto: alto, duracion: duracion })
  window.__escena = escena
  window.__lienzo = lienzo
  return escena.frecuencias
}

window.__cuadro = function (t, calidad) {
  window.__escena.render_en(t)
  return window.__lienzo.toDataURL('image/webp', calidad)
}

/* Los píxeles crudos de un instante, para el diff del cierre del loop. Pasa por un
   canvas 2D porque getImageData no existe sobre un contexto WebGL, y se compara el
   resultado ya compuesto -- que es lo que el lead ve -- en vez del framebuffer. */
window.__pixeles = function (t) {
  window.__escena.render_en(t)
  const c = document.createElement('canvas')
  c.width = window.__lienzo.width
  c.height = window.__lienzo.height
  const g = c.getContext('2d')
  g.drawImage(window.__lienzo, 0, 0)
  return Array.from(g.getImageData(0, 0, c.width, c.height).data)
}

/* Decodifica los archivos YA ESCRITOS y mide el salto de cada par consecutivo más el
   del cierre (0119 -> 0000). Es distinto -- y más honesto -- que comparar dos renders
   crudos: mide lo que el navegador realmente reproduce, con la compresión WebP en el
   medio. */
window.__medir_archivos = function (base, cuadros, ancho, alto) {
  const urls = []
  let i = 0
  for (i = 0; i < cuadros; i++) {
    urls.push(base + String(i).padStart(4, '0') + '.webp')
  }
  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  const g = lienzo.getContext('2d')

  function pixeles(url) {
    return fetch(url)
      .then(function (r) { return r.blob() })
      .then(function (b) { return createImageBitmap(b) })
      .then(function (bmp) {
        g.clearRect(0, 0, ancho, alto)
        g.drawImage(bmp, 0, 0)
        bmp.close()
        return g.getImageData(0, 0, ancho, alto).data
      })
  }

  function diff(a, b) {
    let distintos = 0
    let k = 0
    for (k = 0; k < a.length; k += 4) {
      const d = Math.max(
        Math.abs(a[k] - b[k]), Math.abs(a[k+1] - b[k+1]),
        Math.abs(a[k+2] - b[k+2]), Math.abs(a[k+3] - b[k+3])
      )
      if (d > 2) { distintos += 1 }
    }
    return (distintos / (a.length / 4)) * 100
  }

  const saltos = []
  let primero = null
  let anterior = null

  function paso(indice) {
    if (indice >= urls.length) {
      return diff(anterior, primero)
    }
    return pixeles(urls[indice]).then(function (actual) {
      if (indice === 0) { primero = actual } else { saltos.push(diff(anterior, actual)) }
      anterior = actual
      return paso(indice + 1)
    })
  }

  return paso(0).then(function (cierre) {
    const ordenados = saltos.slice().sort(function (a, b) { return a - b })
    const menores = saltos.filter(function (s) { return s < cierre }).length
    return {
      cierre: Number(cierre.toFixed(2)),
      consecutivos_min: Number(ordenados[0].toFixed(2)),
      consecutivos_mediana: Number(ordenados[Math.floor(ordenados.length / 2)].toFixed(2)),
      consecutivos_max: Number(ordenados[ordenados.length - 1].toFixed(2)),
      percentil_del_cierre: Math.round((menores / saltos.length) * 100),
      pares_medidos: saltos.length,
    }
  })
}

window.__listo = true
</script>
</body></html>`

/**
 * Compara dos tiras de píxeles RGBA y devuelve cuántos difieren más que el umbral.
 *
 * Umbral de 2 sobre 255 por canal: el pipeline de WebGL con antialias no es
 * bit-a-bit reproducible entre dos llamadas a render() ni siquiera con el mismo
 * estado, así que exigir igualdad exacta mediría el ruido del rasterizador y no el
 * salto del loop. Un salto real mueve píxeles decenas de niveles, no dos.
 *
 * @param {Array<number>} a
 * @param {Array<number>} b
 * @returns {{distintos: number, total: number, porcentaje: number, maxima: number}}
 */
function diff_pixeles(a, b) {
  const total = a.length / 4
  let distintos = 0
  let maxima = 0
  let i = 0
  for (i = 0; i < a.length; i += 4) {
    const d = Math.max(
      Math.abs(a[i] - b[i]),
      Math.abs(a[i + 1] - b[i + 1]),
      Math.abs(a[i + 2] - b[i + 2]),
      Math.abs(a[i + 3] - b[i + 3])
    )
    if (d > maxima) {
      maxima = d
    }
    if (d > 2) {
      distintos += 1
    }
  }
  return {
    distintos: distintos,
    total: total,
    porcentaje: Number(((distintos / total) * 100).toFixed(4)),
    maxima: maxima,
  }
}

/**
 * @param {string} data_url
 * @returns {Buffer}
 */
function a_buffer(data_url) {
  return Buffer.from(data_url.slice(data_url.indexOf(',') + 1), 'base64')
}

const server = await levantar_server()
const navegador = await chromium.launch()
const pagina = await navegador.newPage()
await pagina.goto(server.url)
await pagina.waitForFunction('window.__listo === true')

const aspecto = await pagina.evaluate('window.__aspecto')
const reporte = { duracion_s: DURACION_S, calidad: CALIDAD, aspecto: Number(aspecto.toFixed(5)), perfiles: [] }

let perfil_i = 0
for (perfil_i = 0; perfil_i < PERFILES.length; perfil_i += 1) {
  const perfil = PERFILES[perfil_i]
  const alto = Math.round(perfil.ancho / aspecto)
  let elegido = null
  let candidato_i = 0

  for (candidato_i = 0; candidato_i < FPS_CANDIDATOS.length && !elegido; candidato_i += 1) {
    const fps = FPS_CANDIDATOS[candidato_i]
    const cuadros = Math.round(DURACION_S * fps)
    const frecuencias = await pagina.evaluate(
      function (args) {
        return window.__preparar(args[0], args[1], args[2])
      },
      [perfil.ancho, alto, DURACION_S]
    )

    const buffers = []
    let i = 0
    for (i = 0; i < cuadros; i += 1) {
      const t = (i * DURACION_S) / cuadros
      const url = await pagina.evaluate(
        function (args) {
          return window.__cuadro(args[0], args[1])
        },
        [t, CALIDAD]
      )
      buffers.push(a_buffer(url))
    }

    const peso_kb = Math.round(buffers.reduce(function (acc, b) { return acc + b.length }, 0) / 1024)
    console.log(
      '  ' + perfil.nombre + ' @ ' + fps + ' fps: ' + cuadros + ' cuadros, ' + peso_kb +
      ' kB (presupuesto ' + perfil.presupuesto_kb + ')'
    )

    if (peso_kb <= perfil.presupuesto_kb) {
      elegido = { fps: fps, cuadros: cuadros, buffers: buffers, peso_kb: peso_kb, frecuencias: frecuencias }
    }
  }

  if (!elegido) {
    throw new Error('el perfil ' + perfil.nombre + ' no entra en presupuesto ni al fps más bajo')
  }

  /* El cierre del loop se mide contra el cuadro que vendría DESPUÉS del último, o sea
     t = DURACION_S, que es el mismo instante que t = 0 si las frecuencias cerraron
     bien. Ese cuadro no se guarda: si se guardara, se vería dos veces el mismo. */
  const primero = await pagina.evaluate(function (t) { return window.__pixeles(t) }, 0)
  const vuelta = await pagina.evaluate(function (t) { return window.__pixeles(t) }, DURACION_S)
  const cierre = diff_pixeles(primero, vuelta)

  /* Control, y no es adorno: un diff que da 0 puede ser un loop que cierra o una
     medición que compara dos veces lo mismo. Contra la mitad del loop, donde la
     máquina está en la otra punta del vaivén, el mismo diff tiene que dar un número
     grande. Si el control diera 0, lo que está roto es la medición. */
  const mitad = await pagina.evaluate(function (t) { return window.__pixeles(t) }, DURACION_S / 2)
  const control = diff_pixeles(primero, mitad)
  console.log(
    '  ' + perfil.nombre + ' cierre del loop: ' + cierre.porcentaje + '% de píxeles distintos, ' +
    'diferencia máxima ' + cierre.maxima + '/255 · control contra la mitad del loop: ' +
    control.porcentaje + '%, máxima ' + control.maxima + '/255'
  )
  cierre.control_media_vuelta = control

  const carpeta = join(SALIDA, perfil.nombre)
  await rm(carpeta, { recursive: true, force: true })
  await mkdir(carpeta, { recursive: true })
  let j = 0
  for (j = 0; j < elegido.buffers.length; j += 1) {
    await writeFile(join(carpeta, String(j).padStart(4, '0') + '.webp'), elegido.buffers[j])
  }

  /* Y la medición que importa de verdad: sobre los ARCHIVOS ya escritos, decodificados
     como los va a decodificar el navegador. El diff de arriba compara dos renders en
     memoria y por eso da cero exacto -- prueba que la cuantización cierra, que no es
     poco, pero no dice nada de lo que se ve. Con la compresión WebP en el medio, dos
     cuadros consecutivos cualesquiera difieren en un 18-23 % de los píxeles; lo que hay
     que mirar es si el salto del cierre sobresale de esa distribución o se confunde con
     ella. */
  const en_archivos = await pagina.evaluate(
    function (a) {
      return window.__medir_archivos(a[0], a[1], a[2], a[3])
    },
    ['/cuadros/' + perfil.nombre + '/', elegido.cuadros, perfil.ancho, alto]
  )
  console.log(
    '  ' + perfil.nombre + ' sobre los archivos: salto del cierre ' + en_archivos.cierre +
    '% · consecutivos ' + en_archivos.consecutivos_min + '-' + en_archivos.consecutivos_max +
    '% (mediana ' + en_archivos.consecutivos_mediana + '%) · el cierre está en el percentil ' +
    en_archivos.percentil_del_cierre
  )

  reporte.perfiles.push({
    nombre: perfil.nombre,
    ancho: perfil.ancho,
    alto: alto,
    fps: elegido.fps,
    cuadros: elegido.cuadros,
    peso_kb: elegido.peso_kb,
    presupuesto_kb: perfil.presupuesto_kb,
    cierre_en_el_render: cierre,
    cierre_en_los_archivos: en_archivos,
    frecuencias: elegido.frecuencias,
  })
}

/**
 * El manifiesto es lo que lee el reproductor: sin esto tendría que traer los números
 * hardcodeados y quedarían desincronizados con la tira la primera vez que se
 * regenere con otro fps.
 */
await writeFile(
  join(SALIDA, 'manifiesto.json'),
  JSON.stringify(
    {
      generado_por: 'scripts/generar-cuadros-maquina/generar.mjs',
      duracion_s: DURACION_S,
      aspecto: reporte.aspecto,
      perfiles: reporte.perfiles.map(function (p) {
        return { nombre: p.nombre, ancho: p.ancho, alto: p.alto, fps: p.fps, cuadros: p.cuadros }
      }),
    },
    null,
    2
  ) + '\n'
)

await writeFile(join(AQUI, 'ultimo-reporte.json'), JSON.stringify(reporte, null, 2) + '\n')
console.log(JSON.stringify(reporte.perfiles.map(function (p) {
  return {
    perfil: p.nombre,
    fps: p.fps,
    cuadros: p.cuadros,
    peso_kb: p.peso_kb,
    cierre_en_el_render: p.cierre_en_el_render.porcentaje + '%',
    cierre_en_los_archivos: p.cierre_en_los_archivos.cierre + '% (percentil ' + p.cierre_en_los_archivos.percentil_del_cierre + ' de los saltos normales)',
  }
}), null, 1))

await navegador.close()
await server.cerrar()
