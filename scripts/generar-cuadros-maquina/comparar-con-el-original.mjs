/**
 * Mide cuánto se aparta la máquina pre-renderizada de la que se renderizaba en vivo.
 *
 *   node scripts/generar-cuadros-maquina/comparar-con-el-original.mjs
 *
 * Por qué hace falta un script y no alcanza con mirar: la escena vieja
 * (`src/components/demo/escena-maquina.js`) se borró en la misión 12, pieza 2, así que
 * "comparar contra la versión anterior" no puede ser abrir las dos y mirarlas. Lo que
 * sí se puede, y es más exacto, es aislar la ÚNICA diferencia introducida.
 *
 * Geometría, materiales, luces y cámara están transcritos literalmente de aquel archivo
 * -- comprobable con `git show <commit>:src/components/demo/escena-maquina.js` y un
 * diff. Lo único que cambió es:
 *
 *   1. `power` y `suck` congelados en 1 y 0 (decisión, no aproximación: la máquina dejó
 *      de reaccionar al scroll).
 *   2. Las frecuencias cuantizadas para que el loop cierre.
 *
 * Este script renderiza la misma escena con y sin (2), en tres instantes fijos del
 * loop, y reporta cuántos píxeles difieren y cuánto se corrió la máquina en pantalla.
 * Es la medición de lo que la cuantización le costó a la imagen.
 */
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const AQUI = dirname(fileURLToPath(import.meta.url))
const DURACION_S = 12
const ANCHO = 640
const PUNTOS = [0, 4, 8]

const server = createServer(function (req, res) {
  const ruta = (req.url || '/').split('?')[0]
  if (ruta === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(HTML)
    return
  }
  const destino =
    ruta === '/escena-determinista.js'
      ? join(AQUI, 'escena-determinista.js')
      : ruta.startsWith('/three/')
        ? join(AQUI, 'node_modules', 'three', 'build', ruta.replace('/three/', ''))
        : null
  if (!destino) {
    res.statusCode = 404
    res.end('no')
    return
  }
  readFile(destino)
    .then(function (c) {
      res.setHeader('Content-Type', 'text/javascript; charset=utf-8')
      res.end(c)
    })
    .catch(function () {
      res.statusCode = 404
      res.end('no')
    })
})

const HTML = `<!doctype html>
<html><head><meta charset="utf-8"></head><body>
<script type="importmap">{"imports":{"three":"/three/three.module.js","three/":"/three/"}}</script>
<script type="module">
import * as THREE from 'three'
import { crear_escena_determinista, ASPECTO } from '/escena-determinista.js'

window.__pixeles_en = function (t, sin_cuantizar, ancho) {
  const alto = Math.round(ancho / ASPECTO)
  const lienzo = document.createElement('canvas')
  lienzo.width = ancho
  lienzo.height = alto
  const escena = crear_escena_determinista(THREE, lienzo, {
    ancho: ancho, alto: alto, duracion: ${DURACION_S}, sin_cuantizar: sin_cuantizar
  })
  escena.render_en(t)
  const aux = document.createElement('canvas')
  aux.width = ancho
  aux.height = alto
  const g = aux.getContext('2d')
  g.drawImage(lienzo, 0, 0)
  return Array.from(g.getImageData(0, 0, ancho, alto).data)
}
window.__listo = true
</script></body></html>`

/**
 * @param {Array<number>} datos
 * @param {number} ancho
 * @returns {object}
 */
function caja(datos, ancho) {
  const alto = datos.length / 4 / ancho
  let min_x = ancho
  let max_x = -1
  let min_y = alto
  let max_y = -1
  let x = 0
  let y = 0
  for (y = 0; y < alto; y += 1) {
    for (x = 0; x < ancho; x += 1) {
      if (datos[(y * ancho + x) * 4 + 3] > 8) {
        if (x < min_x) { min_x = x }
        if (x > max_x) { max_x = x }
        if (y < min_y) { min_y = y }
        if (y > max_y) { max_y = y }
      }
    }
  }
  return { x: min_x, y: min_y, ancho: max_x - min_x + 1, alto: max_y - min_y + 1 }
}

/**
 * @param {Array<number>} a
 * @param {Array<number>} b
 * @returns {object}
 */
function diff(a, b) {
  const total = a.length / 4
  let distintos = 0
  let suma = 0
  let i = 0
  for (i = 0; i < a.length; i += 4) {
    const d = Math.max(
      Math.abs(a[i] - b[i]),
      Math.abs(a[i + 1] - b[i + 1]),
      Math.abs(a[i + 2] - b[i + 2]),
      Math.abs(a[i + 3] - b[i + 3])
    )
    suma += d
    if (d > 2) {
      distintos += 1
    }
  }
  return {
    porcentaje_distinto: Number(((distintos / total) * 100).toFixed(2)),
    diferencia_media_por_pixel: Number((suma / total).toFixed(2)),
  }
}

await new Promise(function (r) {
  server.listen(0, '127.0.0.1', r)
})
const url = 'http://127.0.0.1:' + server.address().port + '/'
const navegador = await chromium.launch()
const pagina = await navegador.newPage()
await pagina.goto(url)
await pagina.waitForFunction('window.__listo === true')

const filas = []
let i = 0
for (i = 0; i < PUNTOS.length; i += 1) {
  const t = PUNTOS[i]
  const original = await pagina.evaluate(function (a) { return window.__pixeles_en(a[0], true, a[1]) }, [t, ANCHO])
  const nueva = await pagina.evaluate(function (a) { return window.__pixeles_en(a[0], false, a[1]) }, [t, ANCHO])
  const c_original = caja(original, ANCHO)
  const c_nueva = caja(nueva, ANCHO)
  filas.push({
    t: t,
    diff: diff(original, nueva),
    caja_original: c_original.ancho + 'x' + c_original.alto + ' en (' + c_original.x + ',' + c_original.y + ')',
    caja_nueva: c_nueva.ancho + 'x' + c_nueva.alto + ' en (' + c_nueva.x + ',' + c_nueva.y + ')',
    corrimiento_px: { x: c_nueva.x - c_original.x, y: c_nueva.y - c_original.y },
    cambio_de_tamano_px: { ancho: c_nueva.ancho - c_original.ancho, alto: c_nueva.alto - c_original.alto },
  })
}

console.log(JSON.stringify({ ancho: ANCHO, duracion_s: DURACION_S, puntos: filas }, null, 1))

await navegador.close()
await new Promise(function (r) {
  server.close(r)
})
