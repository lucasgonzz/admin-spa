/*
  Prueba del rescate de páginas Ogg de src/utils/oggOpusRecorder.js.

  Se corre con `node pruebas/rescate-ogg.cjs`. No necesita ninguna dependencia: `admin-spa` no
  tiene corredor de tests, y meter uno entero para esto era desproporcionado.

  Qué cubre y por qué: cuando el encoder no confirma el cierre, el grabador arma el .ogg con las
  páginas que ya tenía guardadas y le marca el fin de stream a la última, recalculando su CRC.
  Ese CRC es el CRC-32 de Ogg (polinomio 0x04c11db7, sin reflejar, sin xor final), que NO es el
  CRC-32 de zip. Un error ahí no se nota mirando el código: produce un archivo que parece bien y
  que ningún reproductor abre.

  Extrae las funciones del ARCHIVO REAL en vez de tener una copia pegada acá -- una copia se
  desincroniza y el test pasa a probar código que ya no existe -- y las contrasta contra un CRC
  calculado bit a bit, escrito aparte y sin tabla, que hace de oráculo independiente.
*/
const fs = require('fs')
const path = require('path')

const FUENTE = path.join(__dirname, '..', 'src', 'utils', 'oggOpusRecorder.js')
const texto = fs.readFileSync(FUENTE, 'utf8')

/* Se toma el tramo que va del inicio del archivo hasta antes del export de la clase. */
const corte = texto.indexOf('export class OggOpusRecorder')
if (corte === -1) { throw new Error('no encontré la clase en el archivo') }
let preludio = texto.slice(0, corte)
preludio = preludio.replace(/^import .*$/gm, '') // sacar los imports ESM

const modulo = {}
new Function('exports', preludio + '\nexports.crc_ogg = crc_ogg; exports.marcar_fin_de_stream = marcar_fin_de_stream; exports.pagina_con_audio = pagina_con_audio;')(modulo)
const { crc_ogg, marcar_fin_de_stream, pagina_con_audio } = modulo

/* ---- oráculo: CRC de Ogg bit a bit, sin tabla ---- */
function crc_oraculo(bytes) {
  let c = 0
  for (let i = 0; i < bytes.length; i++) {
    c = (c ^ (bytes[i] << 24)) >>> 0
    for (let j = 0; j < 8; j++) {
      c = ((c & 0x80000000) !== 0 ? ((c << 1) ^ 0x04c11db7) : (c << 1)) >>> 0
    }
  }
  return c >>> 0
}

/* ---- arma una página Ogg sintética con CRC correcto según el oráculo ---- */
function pagina_ogg(opciones) {
  const carga = opciones.carga
  const segmentos = Math.ceil(carga.length / 255) || 1
  const pagina = new Uint8Array(27 + segmentos + carga.length)
  pagina[0] = 0x4f; pagina[1] = 0x67; pagina[2] = 0x67; pagina[3] = 0x53 // "OggS"
  pagina[4] = 0                       // version
  pagina[5] = opciones.flags || 0     // header_type
  // 14..21: serial y numero de pagina, con datos cualquiera
  for (let i = 14; i < 22; i++) { pagina[i] = (i * 7) & 0xff }
  // 6..13: granule position, little-endian. 0 = pagina de cabecera, > 0 = pagina con audio.
  const granulo = opciones.granulo || 0
  for (let i = 0; i < 8; i++) { pagina[6 + i] = i < 4 ? (granulo >>> (8 * i)) & 0xff : 0 }
  pagina[22] = 0; pagina[23] = 0; pagina[24] = 0; pagina[25] = 0 // CRC en cero para calcular
  pagina[26] = segmentos
  let resto = carga.length
  for (let s = 0; s < segmentos; s++) {
    pagina[27 + s] = resto >= 255 ? 255 : resto
    resto -= 255
  }
  pagina.set(carga, 27 + segmentos)
  const crc = crc_oraculo(pagina)
  pagina[22] = crc & 0xff
  pagina[23] = (crc >>> 8) & 0xff
  pagina[24] = (crc >>> 16) & 0xff
  pagina[25] = (crc >>> 24) & 0xff
  return pagina
}

function carga_cualquiera(n, semilla) {
  const b = new Uint8Array(n)
  let x = semilla
  for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; b[i] = x & 0xff }
  return b
}

function crc_de(pagina) {
  const copia = pagina.slice()
  copia[22] = 0; copia[23] = 0; copia[24] = 0; copia[25] = 0
  return crc_oraculo(copia)
}

function crc_guardado_en(pagina) {
  return (pagina[22] | (pagina[23] << 8) | (pagina[24] << 16) | (pagina[25] << 24)) >>> 0
}

let ok = 0
let mal = 0
function comprobar(nombre, condicion, detalle) {
  if (condicion) { ok++; console.log('  ok   ' + nombre) }
  else { mal++; console.log('  MAL  ' + nombre + (detalle ? ' -- ' + detalle : '')) }
}

console.log('\n1. crc_ogg del archivo contra el oráculo bit a bit')
for (let n = 0; n < 5; n++) {
  const b = carga_cualquiera(1 + n * 137, n + 1)
  comprobar('largo ' + b.length, crc_ogg(b) === crc_oraculo(b),
    '0x' + crc_ogg(b).toString(16) + ' vs 0x' + crc_oraculo(b).toString(16))
}

console.log('\n2. marcar_fin_de_stream sobre una página válida')
{
  const p = pagina_ogg({ carga: carga_cualquiera(600, 9), flags: 0 })
  comprobar('la página sintética arranca con CRC coherente', crc_de(p) === crc_guardado_en(p))
  const marcada = marcar_fin_de_stream(p)
  comprobar('devuelve true', marcada === true)
  comprobar('prendió el bit 0x04 del byte 5', (p[5] & 0x04) === 0x04, 'byte5=' + p[5])
  comprobar('el CRC nuevo verifica con el oráculo', crc_de(p) === crc_guardado_en(p),
    'calculado 0x' + crc_de(p).toString(16) + ' guardado 0x' + crc_guardado_en(p).toString(16))
}

console.log('\n3. página que ya venía marcada como fin de stream')
{
  const p = pagina_ogg({ carga: carga_cualquiera(300, 3), flags: 0x04 })
  const antes = p.slice()
  comprobar('devuelve true', marcar_fin_de_stream(p) === true)
  comprobar('sigue con el bit prendido', (p[5] & 0x04) === 0x04)
  comprobar('no cambió nada', Buffer.compare(Buffer.from(antes), Buffer.from(p)) === 0)
}

console.log('\n4. página con el CRC roto: NO se toca')
{
  const p = pagina_ogg({ carga: carga_cualquiera(200, 4), flags: 0 })
  p[23] = p[23] ^ 0xff // rompo el CRC guardado
  const antes = p.slice()
  comprobar('devuelve false', marcar_fin_de_stream(p) === false)
  comprobar('la página quedó byte por byte como estaba',
    Buffer.compare(Buffer.from(antes), Buffer.from(p)) === 0)
}

console.log('\n5. basura que no es una página Ogg')
{
  const p = new Uint8Array(60)
  for (let i = 0; i < p.length; i++) { p[i] = i }
  const antes = p.slice()
  comprobar('devuelve false', marcar_fin_de_stream(p) === false)
  comprobar('no la tocó', Buffer.compare(Buffer.from(antes), Buffer.from(p)) === 0)
  comprobar('página más corta que una cabecera: false', marcar_fin_de_stream(new Uint8Array(10)) === false)
  comprobar('null: false', marcar_fin_de_stream(null) === false)
}

console.log('\n6. el rescate concatena y marca SOLO la última página')
{
  /* Réplica del armado de _rescatar_lo_grabado(), para chequear que el subarray apunta bien. */
  const paginas = [
    pagina_ogg({ carga: carga_cualquiera(19, 11), flags: 0x02, granulo: 0 }), // OpusHead
    pagina_ogg({ carga: carga_cualquiera(40, 12), flags: 0, granulo: 0 }),    // OpusTags
    pagina_ogg({ carga: carga_cualquiera(900, 13), flags: 0, granulo: 12800 }),
    pagina_ogg({ carga: carga_cualquiera(800, 14), flags: 0, granulo: 25600 }),
  ]
  const total = paginas.reduce(function (a, p) { return a + p.length }, 0)
  const salida = new Uint8Array(total)
  let pos = 0
  let ultima_desde = 0
  for (let i = 0; i < paginas.length; i++) {
    ultima_desde = pos
    salida.set(paginas[i], pos)
    pos += paginas[i].length
  }
  const marcada = marcar_fin_de_stream(salida.subarray(ultima_desde, pos))

  comprobar('devuelve true', marcada === true)
  comprobar('ultima_desde apunta al arranque de la 4ta página',
    ultima_desde === total - paginas[3].length, 'ultima_desde=' + ultima_desde)
  comprobar('la última página del blob tiene el bit de fin', (salida[ultima_desde + 5] & 0x04) === 0x04)

  /* Ninguna de las tres primeras se tocó, y todas siguen verificando el CRC. */
  let arranque = 0
  for (let i = 0; i < paginas.length; i++) {
    const tramo = salida.slice(arranque, arranque + paginas[i].length)
    const coherente = crc_de(tramo) === crc_guardado_en(tramo)
    comprobar('página ' + (i + 1) + ' con CRC coherente en el blob final', coherente)
    if (i < 3) {
      comprobar('página ' + (i + 1) + ' idéntica a la original',
        Buffer.compare(Buffer.from(tramo), Buffer.from(paginas[i])) === 0)
    }
    arranque += paginas[i].length
  }
  comprobar('el blob mide lo que suman las páginas', salida.length === total)
}

console.log('\n' + '7. pagina_con_audio: distingue cabecera de datos')
{
  const cabecera_head = pagina_ogg({ carga: carga_cualquiera(19, 21), flags: 0x02, granulo: 0 })
  const cabecera_tags = pagina_ogg({ carga: carga_cualquiera(40, 22), flags: 0, granulo: 0 })
  const datos = pagina_ogg({ carga: carga_cualquiera(700, 23), flags: 0, granulo: 12800 })

  comprobar('OpusHead (granulo 0): false', pagina_con_audio(cabecera_head) === false)
  comprobar('OpusTags (granulo 0): false', pagina_con_audio(cabecera_tags) === false)
  comprobar('pagina de datos (granulo 12800): true', pagina_con_audio(datos) === true)
  comprobar('granulo 1, el minimo posible: true',
    pagina_con_audio(pagina_ogg({ carga: carga_cualquiera(10, 24), granulo: 1 })) === true)
  comprobar('basura que no es Ogg: false', pagina_con_audio(new Uint8Array(60)) === false)
  comprobar('mas corta que una cabecera: false', pagina_con_audio(new Uint8Array(10)) === false)
  comprobar('null: false', pagina_con_audio(null) === false)
}

console.log('\n' + '8. el rescate se niega cuando solo hay cabeceras (nota de cero segundos)')
{
  /*
    Es el caso peligroso. Apenas arranca la grabacion, opus-recorder pide getHeaderPages y el
    encoder deja DOS paginas de cabecera en recordedPages, sin un solo frame de audio. Un rescate
    que solo mire "hay paginas?" armaria un .ogg de cien bytes vacio y se lo mandaria al lead como
    si fuera una nota de voz. Es peor que el bug original: ese al menos se notaba.
  */
  const HOJAS_DE_CABECERA = 2
  function rescate_sirve(paginas) {
    return paginas.length > HOJAS_DE_CABECERA && pagina_con_audio(paginas[paginas.length - 1])
  }

  const solo_cabeceras = [
    pagina_ogg({ carga: carga_cualquiera(19, 31), flags: 0x02, granulo: 0 }),
    pagina_ogg({ carga: carga_cualquiera(40, 32), flags: 0, granulo: 0 }),
  ]
  comprobar('con solo las dos cabeceras NO se rescata', rescate_sirve(solo_cabeceras) === false)

  const con_datos = solo_cabeceras.concat([
    pagina_ogg({ carga: carga_cualquiera(900, 33), flags: 0, granulo: 12800 }),
  ])
  comprobar('con una pagina de datos SI se rescata', rescate_sirve(con_datos) === true)

  const tres_pero_sin_audio = solo_cabeceras.concat([
    pagina_ogg({ carga: carga_cualquiera(50, 34), flags: 0, granulo: 0 }),
  ])
  comprobar('tres paginas pero la ultima sin granulo: NO se rescata',
    rescate_sirve(tres_pero_sin_audio) === false)
}

console.log('\n' + (mal === 0 ? 'TODO VERDE' : 'HAY ' + mal + ' EN ROJO') + ' — ' + ok + ' comprobaciones ok, ' + mal + ' mal\n')
process.exit(mal === 0 ? 0 : 1)
