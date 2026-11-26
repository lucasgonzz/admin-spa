/*
  Prueba de aceptación de la etapa E3 (grabación de la llamada de Juan) de la misión leads-referidos-compromisos, en el admin-spa.

  Se corre con `node pruebas/leads-referidos-compromisos-e3.cjs`. No necesita dependencias: `admin-spa` no tiene corredor de tests (misma
  convención que `pruebas/leads-referidos-compromisos.cjs` y `pruebas/tablero-juan.cjs`). La lógica pura se extrae del ARCHIVO REAL de
  `src/`, no de una copia, y los componentes se miran como texto, así que si el archivo cambia la prueba lo ve.

  Criterio CA22 del PLAN:
    1. `src/utils/grabacion_de_llamada.js` (lógica pura, sin imports). CONTRATO que fijan estos tests (el PLAN sólo nombra el archivo):
         - `EXTENSIONES`: las doce extensiones de audio que acepta la API (m4a, mp3, mp4, aac, ogg, opus, oga, wav, webm, flac, amr, 3gp).
         - `PARTE_BYTES` = 4 MB, `MAXIMO_BYTES` = 200 MB, `INTENTOS_POR_PARTE` = 3.
         - `validar_archivo(nombre, bytes)` → `{ ok, mensaje }`; el mensaje está en castellano y es '' cuando ok.
         - `partir_en_partes(bytes)` → `[{ indice, desde, hasta, bytes }]` (hasta es exclusivo; 10.485.760 bytes → 4 MB, 4 MB y 2 MB).
         - `etiqueta_de_estado(status)` → texto en castellano de cada estado de la grabación ('' si no lo conoce).
    2. `RegistrarLlamadaModal.vue`: input de archivo de audio (opcional), y DESPUÉS de registrar la llamada sube por partes
       (`/grabacion`, `/grabacion/partes`, `/grabacion/completar`) con reintento por parte y avisa que la transcripción tarda unos minutos.
    3. `GrabacionDeLlamada.vue` (estado, resumen, transcripción plegable, compromiso propuesto, «Reintentar») montado por
       `OpportunityModal.vue` en la lista de llamadas. Lo usa también Juan (perfil «Sólo Leads»): no se esconde con `es_solo_leads`.
       (El montaje de `CompromisoVigente` en la ficha y en la barra lateral ya lo prueba `leads-referidos-compromisos.cjs`, de E2.)

  La verificación visual (tres anchos, perfil de Juan y de Lucas) la hace el Coordinador en el navegador: acá no se levanta nada.
*/
const fs = require('fs')
const path = require('path')

const RAIZ = path.join(__dirname, '..')

let fallos = 0
let corridas = 0

/** Compara con igualdad estricta (por JSON) y cuenta el resultado. */
function igual(descripcion, obtenido, esperado) {
  corridas++
  const a = JSON.stringify(obtenido)
  const b = JSON.stringify(esperado)
  if (a !== b) {
    fallos++
    console.log('FALLA  ' + descripcion + '\n         obtenido: ' + a + '\n         esperado: ' + b)
  } else {
    console.log('ok     ' + descripcion)
  }
}

/** Afirma que una condición sea verdadera y cuenta el resultado. */
function cierto(descripcion, condicion) {
  igual(descripcion, !!condicion, true)
}

/** Lee un archivo del proyecto; devuelve null si no existe. */
function leer(...partes) {
  try {
    return fs.readFileSync(path.join(RAIZ, ...partes), 'utf8')
  } catch (error) {
    return null
  }
}

/**
 * Carga un módulo de lógica pura (sin imports) y devuelve los nombres pedidos. Saca el `export` de cada declaración porque Node no los
 * entiende dentro de un `new Function`. Devuelve null (y cuenta una falla) si el archivo no existe.
 */
function cargar_modulo(archivo, nombres) {
  let texto = leer(...archivo)
  if (texto === null) {
    console.log('FALLA  no existe ' + archivo.join('/'))
    fallos++
    corridas++
    return null
  }
  texto = texto.replace(/^export /gm, '')
  /* Un nombre que el archivo todavía no define queda undefined, y cada comprobación falla sola. */
  const devolver = nombres.map(function (nombre) {
    return nombre + ': (typeof ' + nombre + " === 'undefined' ? undefined : " + nombre + ')'
  })
  try {
    return new Function(texto + '\nreturn { ' + devolver.join(', ') + ' }')()
  } catch (error) {
    console.log('FALLA  ' + archivo.join('/') + ' no se puede evaluar: ' + error.message)
    fallos++
    corridas++
    return null
  }
}

/** Afirma que un archivo existe y contiene el patrón. */
function contiene(descripcion, archivo, patron) {
  const contenido = leer(...archivo)
  cierto(descripcion, contenido !== null && patron.test(contenido))
}

/** Afirma que un archivo existe y NO contiene el patrón. */
function no_contiene(descripcion, archivo, patron) {
  const contenido = leer(...archivo)
  cierto(descripcion, contenido !== null && !patron.test(contenido))
}

/* ================================================================================================
   1. Lógica pura de la grabación (src/utils/grabacion_de_llamada.js)
   ================================================================================================ */
const MB = 1048576
const grabacion = cargar_modulo(
  ['src', 'utils', 'grabacion_de_llamada.js'],
  ['EXTENSIONES', 'PARTE_BYTES', 'MAXIMO_BYTES', 'INTENTOS_POR_PARTE', 'validar_archivo', 'partir_en_partes', 'etiqueta_de_estado']
)

if (grabacion !== null) {
  const EXTENSIONES_DEL_PLAN = ['m4a', 'mp3', 'mp4', 'aac', 'ogg', 'opus', 'oga', 'wav', 'webm', 'flac', 'amr', '3gp']

  igual('EXTENSIONES son las doce de la API',
    Array.isArray(grabacion.EXTENSIONES) ? grabacion.EXTENSIONES.slice().sort() : grabacion.EXTENSIONES, EXTENSIONES_DEL_PLAN.slice().sort())
  igual('PARTE_BYTES es 4 MB', grabacion.PARTE_BYTES, 4194304)
  igual('MAXIMO_BYTES es 200 MB', grabacion.MAXIMO_BYTES, 209715200)
  igual('INTENTOS_POR_PARTE es 3', grabacion.INTENTOS_POR_PARTE, 3)

  /* ---- partir en partes de 4 MB ---- */
  if (typeof grabacion.partir_en_partes === 'function') {
    const partes = grabacion.partir_en_partes(10485760)
    igual('partir_en_partes(10.485.760) da tres partes de 4 MB, 4 MB y 2 MB',
      Array.isArray(partes) ? partes.map(function (p) { return p.bytes }) : partes, [4194304, 4194304, 2097152])
    igual('las partes llevan su índice 0, 1 y 2',
      Array.isArray(partes) ? partes.map(function (p) { return p.indice }) : partes, [0, 1, 2])
    igual('cada parte dice desde dónde hasta dónde se corta el archivo (hasta es exclusivo)',
      Array.isArray(partes) ? partes.map(function (p) { return [p.desde, p.hasta] }) : partes, [[0, 4194304], [4194304, 8388608], [8388608, 10485760]])
    igual('un archivo de 8 MB justos son dos partes', grabacion.partir_en_partes(8388608).map(function (p) { return p.bytes }), [4194304, 4194304])
    igual('un byte más que 4 MB deja una parte de un byte', grabacion.partir_en_partes(4194305).map(function (p) { return p.bytes }), [4194304, 1])
    igual('un archivo chico es una sola parte', grabacion.partir_en_partes(1000).map(function (p) { return p.bytes }), [1000])
    igual('un archivo vacío no tiene partes', grabacion.partir_en_partes(0), [])
  } else {
    cierto('partir_en_partes es una función', false)
  }

  /* ---- validar el archivo antes de subirlo ---- */
  if (typeof grabacion.validar_archivo === 'function') {
    EXTENSIONES_DEL_PLAN.forEach(function (extension) {
      const resultado = grabacion.validar_archivo('llamada.' + extension, 10485760)
      igual('acepta .' + extension, resultado && resultado.ok, true)
    })
    igual('acepta la extensión en mayúsculas (así la guardan algunos celulares)', (grabacion.validar_archivo('LLAMADA.M4A', 1000) || {}).ok, true)
    igual('acepta un nombre con puntos y espacios', (grabacion.validar_archivo('Llamada con Ro. 24-11.m4a', 1000) || {}).ok, true)
    igual('acepta justo 200 MB', (grabacion.validar_archivo('llamada.m4a', 209715200) || {}).ok, true)

    const pdf = grabacion.validar_archivo('llamada.pdf', 1000) || {}
    igual('rechaza un .pdf', pdf.ok, false)
    cierto('el rechazo del .pdf trae un mensaje en castellano que habla de audio', typeof pdf.mensaje === 'string' && /audio/i.test(pdf.mensaje))

    const pesado = grabacion.validar_archivo('llamada.m4a', 209715201) || {}
    igual('rechaza más de 200 MB', pesado.ok, false)
    cierto('el rechazo por tamaño trae un mensaje en castellano que nombra los 200 MB', typeof pesado.mensaje === 'string' && /200 MB/.test(pesado.mensaje))

    igual('rechaza un archivo vacío', (grabacion.validar_archivo('llamada.m4a', 0) || {}).ok, false)
    igual('rechaza un archivo sin extensión', (grabacion.validar_archivo('llamada', 1000) || {}).ok, false)
    igual('rechaza un ejecutable disfrazado', (grabacion.validar_archivo('llamada.m4a.exe', 1000) || {}).ok, false)
    igual('rechaza un nombre vacío', (grabacion.validar_archivo('', 1000) || {}).ok, false)
    igual('un archivo válido no trae mensaje de error', (grabacion.validar_archivo('llamada.m4a', 1000) || {}).mensaje, '')
  } else {
    cierto('validar_archivo es una función', false)
  }

  /* ---- los estados en castellano ---- */
  if (typeof grabacion.etiqueta_de_estado === 'function') {
    const estados = ['subiendo', 'pendiente', 'transcribiendo', 'lista', 'error']
    const etiquetas = estados.map(function (estado) { return grabacion.etiqueta_de_estado(estado) })
    cierto('cada estado de la grabación tiene su etiqueta, y son distintas entre sí',
      etiquetas.every(function (e) { return typeof e === 'string' && e.length > 0 }) && new Set(etiquetas).size === estados.length)
    igual('un estado desconocido no trae etiqueta', grabacion.etiqueta_de_estado('inventado'), '')
  } else {
    cierto('etiqueta_de_estado es una función', false)
  }
}

/* ================================================================================================
   2. «Registrar llamada»: el archivo de audio y la subida por partes
   ================================================================================================ */
const REGISTRAR = ['src', 'components', 'lead', 'RegistrarLlamadaModal.vue']
contiene('RegistrarLlamadaModal.vue tiene el texto «Grabación de la llamada (opcional)»', REGISTRAR, /Grabación de la llamada \(opcional\)/)
contiene('RegistrarLlamadaModal.vue tiene un input de archivo de audio (audio/*, .m4a, .amr y .3gp)',
  REGISTRAR, /<input[^>]*type="file"[^>]*accept="[^"]*audio\/\*[^"]*\.m4a[^"]*\.amr[^"]*\.3gp[^"]*"|<input[^>]*accept="[^"]*audio\/\*[^"]*\.m4a[^"]*\.amr[^"]*\.3gp[^"]*"[^>]*type="file"/)
contiene('RegistrarLlamadaModal.vue usa la lógica de grabacion_de_llamada.js', REGISTRAR, /@\/utils\/grabacion_de_llamada/)
contiene('RegistrarLlamadaModal.vue valida el archivo con validar_archivo y lo parte con partir_en_partes', REGISTRAR, /validar_archivo[\s\S]*partir_en_partes|partir_en_partes[\s\S]*validar_archivo/)
contiene('RegistrarLlamadaModal.vue inicia la subida (POST …/grabacion)', REGISTRAR, /\/grabacion['"`]/)
contiene('RegistrarLlamadaModal.vue sube cada parte (POST …/grabacion/partes) con FormData (indice y parte)',
  REGISTRAR, /\/grabacion\/partes['"`]/)
contiene('RegistrarLlamadaModal.vue arma el FormData con `indice` y `parte`', REGISTRAR, /new FormData\(\)[\s\S]*append\(\s*['"]indice['"][\s\S]*append\(\s*['"]parte['"]|new FormData\(\)[\s\S]*append\(\s*['"]parte['"][\s\S]*append\(\s*['"]indice['"]/)
contiene('RegistrarLlamadaModal.vue completa la subida (POST …/grabacion/completar)', REGISTRAR, /\/grabacion\/completar['"`]/)
contiene('RegistrarLlamadaModal.vue reintenta cada parte (INTENTOS_POR_PARTE)', REGISTRAR, /INTENTOS_POR_PARTE/)
contiene('RegistrarLlamadaModal.vue muestra el progreso de la subida', REGISTRAR, /progress/i)
contiene('RegistrarLlamadaModal.vue avisa «La transcripción tarda unos minutos»', REGISTRAR, /La transcripción tarda unos minutos/)
no_contiene('RegistrarLlamadaModal.vue no esconde la subida al perfil «Sólo Leads» (Juan es quien la usa)', REGISTRAR, /es_solo_leads|solo_leads/)

/* La subida va DESPUÉS de registrar la llamada: sale del `.then` del POST a /llamadas, con el id de la llamada que devolvió la API. */
const texto_del_registrar = leer(...REGISTRAR) || ''
const inicio_del_registro = texto_del_registrar.search(/\.post\(\s*['"]\/lead\/['"]\s*\+\s*this\.lead_id\s*\+\s*['"]\/llamadas['"]/)
const desde_el_registro = inicio_del_registro === -1 ? '' : texto_del_registrar.slice(inicio_del_registro)
const fin_del_then = desde_el_registro.search(/\.catch\(/)
const bloque_del_then = fin_del_then === -1 ? '' : desde_el_registro.slice(0, fin_del_then)
cierto('RegistrarLlamadaModal.vue: el `.then` del POST /llamadas llama a subir_la_grabacion con la llamada recién registrada',
  /\.then\([\s\S]*(self|this)\.subir_la_grabacion\(/.test(bloque_del_then))
contiene('RegistrarLlamadaModal.vue define el método subir_la_grabacion', REGISTRAR, /\n\s+subir_la_grabacion\(/)

/* ================================================================================================
   3. La grabación en la ficha de la llamada (GrabacionDeLlamada.vue) y su montaje
   ================================================================================================ */
const GRABACION = ['src', 'components', 'lead', 'GrabacionDeLlamada.vue']
cierto('existe src/components/lead/GrabacionDeLlamada.vue', leer(...GRABACION) !== null)
contiene('GrabacionDeLlamada.vue muestra el estado con etiqueta_de_estado', GRABACION, /etiqueta_de_estado/)
contiene('GrabacionDeLlamada.vue muestra el resumen', GRABACION, /resumen/)
contiene('GrabacionDeLlamada.vue muestra la transcripción plegada («Ver la transcripción»)', GRABACION, /Ver la transcripción/)
contiene('GrabacionDeLlamada.vue muestra el compromiso propuesto', GRABACION, /compromiso_propuesto/)
contiene('GrabacionDeLlamada.vue tiene el botón «Reintentar»', GRABACION, /Reintentar/)
contiene('GrabacionDeLlamada.vue reintenta con POST …/grabacion/reintentar', GRABACION, /\.post\(\s*[`'"][\s\S]{0,120}\/grabacion\/reintentar/)
contiene('GrabacionDeLlamada.vue lee el estado con GET …/grabacion', GRABACION, /\.get\(\s*[`'"][\s\S]{0,120}\/grabacion[`'"]/)
contiene('GrabacionDeLlamada.vue muestra el error cuando falló (error_text)', GRABACION, /error_text/)
no_contiene('GrabacionDeLlamada.vue NO se esconde para el perfil «Sólo Leads» (Juan la ve y reintenta)', GRABACION, /es_solo_leads|solo_leads/)

const FICHA = ['src', 'components', 'pipeline', 'OpportunityModal.vue']
contiene('OpportunityModal.vue importa GrabacionDeLlamada', FICHA, /import\s+GrabacionDeLlamada\s+from\s+['"]@\/components\/lead\/GrabacionDeLlamada\.vue['"]/)
contiene('OpportunityModal.vue lo registra como componente', FICHA, /components:\s*\{[^}]*GrabacionDeLlamada/)

const texto_de_la_ficha = leer(...FICHA) || ''
const inicio_de_la_lista = texto_de_la_ficha.search(/<li[^>]*v-for="llamada in llamadas"/)
const lista_de_llamadas = inicio_de_la_lista === -1 ? '' : texto_de_la_ficha.slice(inicio_de_la_lista, texto_de_la_ficha.indexOf('</li>', inicio_de_la_lista))
cierto('OpportunityModal.vue monta <grabacion-de-llamada> dentro de cada llamada de la lista', /<grabacion-de-llamada|<GrabacionDeLlamada/.test(lista_de_llamadas))
cierto('OpportunityModal.vue le pasa la llamada y el lead a la grabación',
  /<grabacion-de-llamada[^>]*:llamada[^>]*>|<GrabacionDeLlamada[^>]*:llamada[^>]*>/.test(lista_de_llamadas) &&
  /<grabacion-de-llamada[^>]*:lead[_-]id|<GrabacionDeLlamada[^>]*:lead[_-]id/.test(lista_de_llamadas))

console.log('\n' + corridas + ' comprobaciones, ' + fallos + ' fallas')
process.exit(fallos === 0 ? 0 : 1)
