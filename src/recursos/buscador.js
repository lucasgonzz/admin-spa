/**
 * Buscador del centro de recursos: encuentra videos por LO QUE DICEN, no solo por cómo se llaman.
 *
 * Es un módulo PURO: no usa Vue ni el DOM y se puede importar desde Node (`node --test`, y el script
 * de evaluación de la misión). La página lo arma una vez con el catálogo (`crear_buscador`) y lo
 * consulta en cada tecla (`buscar`).
 *
 * Qué problema resuelve. Antes la búsqueda tomaba lo escrito como UNA frase y le hacía `indexOf` al
 * texto: "escanear factura" daba 0 resultados aunque el video T5.15 se llame "Escanear la factura o el
 * remito con la IA" (le sobra el "la"). Ahora:
 *
 * 1. La consulta se parte en palabras y cada una tiene que aparecer EN ALGÚN LADO del video (título,
 *    carpeta, "para qué", guion), en cualquier orden. Las palabras de relleno ("cómo", "una", "de"…) se
 *    ignoran. Si ningún video las tiene todas, se muestran los que tienen la mayoría y se avisa
 *    (`completo: false`).
 * 2. Cada palabra encuentra sus formas: sin acentos, plural, tiempos del verbo ("escanear" encuentra
 *    escaneo, escaneás, escaneala), la palabra a medio escribir ("escan"), sinónimos de la casa
 *    (`sinonimos.js`) y, SOLO si no encontró nada, un error de tipeo ("facutra").
 * 3. Los resultados salen ordenados por relevancia, no por el orden del guion (ver "El puntaje").
 *
 * El puntaje. Para cada palabra de la consulta y cada video se toma el mejor campo donde aparece:
 *
 *     peso del campo × lo rara que es la palabra EN ESE campo × qué tan directa es la coincidencia
 *
 * - Peso del campo (`PESO_DE_CAMPO`): título 10, "para qué" 3, carpeta y sección 1,5, guion 1.
 * - Rareza: `ln(1 + N / df)`, con `df` = en cuántos videos aparece la palabra en ese campo. Se mide POR
 *   CAMPO a propósito: "reportes" sale en el guion de 360 de los 364 videos (el arranque se repite), así
 *   que ahí pesa casi nada, pero en los títulos es rara y quien lo escribe quiere esos títulos.
 * - Qué tan directa (`PUNTOS`): la palabra exacta 1, otra forma de la misma palabra 0,85, un sinónimo
 *   0,6, "empieza igual" 0,55 y un error de tipeo 0,4.
 *
 * Después se le suma, por cada campo, un bonus por cercanía (que las palabras estén juntas) y un
 * pequeño premio por repetición (el video que habla mucho de algo). Nada de esto usa el servidor.
 */
import { normalizar } from './utiles.js'
import {
  PALABRAS_DE_RELLENO,
  GRUPOS_DE_SINONIMOS,
  FORMAS_DICHAS,
  NUMEROS_HASTA_30,
  NUMEROS_REDONDOS,
  RAICES_APARTE,
} from './sinonimos.js'

/** Índices de los campos en los que se busca. Siempre en este orden: título, carpeta+sección, "para qué", guion y "cuándo no". */
const CAMPO_TITULO = 0
const CAMPO_UBICACION = 1
const CAMPO_PARA_QUE = 2
const CAMPO_VOZ = 3
const CAMPO_NO_SIRVE = 4

/** Cantidad de campos. */
const CANTIDAD_CAMPOS = 5

/**
 * Cuánto vale una coincidencia en cada campo. "Título >> para qué / carpeta > guion". El de "cuándo no"
 * (lo que el video aclara que NO sirve para) casi no cuenta: un video que dice "para importar Excel usá
 * el otro video" no es sobre importar Excel, pero si es lo único que existe se muestra al final.
 *
 * @type {Array<number>}
 */
const PESO_DE_CAMPO = [10, 1.5, 3, 1, 0.35]

/**
 * Qué tan directa es una coincidencia. Se multiplica por el peso del campo y la rareza de la palabra.
 *
 * @type {{ directa: number, raiz: number, sinonimo: number, prefijo: number, numero: number, tipeo: number }}
 */
export const PUNTOS = {
  /** La palabra tal cual (sin acentos ni mayúsculas). */
  directa: 1,
  /** Otra forma de la misma palabra: plural, tiempo del verbo, "-ción" de un verbo. */
  raiz: 0.85,
  /** Un sinónimo de `sinonimos.js`. */
  sinonimo: 0.5,
  /** La consulta es el comienzo de la palabra del video ("escan" → escanear): se escribe a medias. */
  prefijo: 0.55,
  /** Un número escrito con cifras que el guion dice en letras ("21" → veintiuno). */
  numero: 0.8,
  /** Error de tipeo: una letra mal, de más, de menos o dos intercambiadas. Solo para lo que no encontró nada. */
  tipeo: 0.4,
}

/** Bonus por cercanía: qué parte de lo que valen las palabras juntas se suma cuando están pegadas. */
const FACTOR_CERCANIA = 0.5

/** Cuánto suma que una palabra aparezca también en los demás campos (además del mejor). */
const FACTOR_OTROS_CAMPOS = 0.1

/** Premio por repetición: cuánto sube el puntaje por cada vez que se repite la palabra en un campo (en escala logarítmica). */
const FACTOR_REPETICION = 0.2

/** Largo mínimo de una palabra para que valga como "empieza igual" y para corregirle el tipeo. */
const LARGO_MINIMO_PREFIJO = 3
const LARGO_MINIMO_TIPEO = 5

/** Largo mínimo para corregir una letra CAMBIADA por otra (más ambiguo que una de más, una de menos o dos intercambiadas). */
const LARGO_MINIMO_TIPEO_CON_LETRA_CAMBIADA = 6

/** En una búsqueda sin coincidencia completa, lo que se muestra como máximo y el piso de puntaje (respecto del mejor). */
const MAXIMO_PARCIALES = 40
const PISO_PARCIALES = 0.25

/**
 * Medidas del fragmento que se muestra debajo del título (caracteres). Entra en dos renglones de la
 * barra de carpetas: el comienzo del recorte queda `ANTES_DEL_FRAGMENTO` caracteres antes de la primera
 * palabra encontrada, para que lo que se buscó quede dentro de lo que se ve.
 */
const LARGO_DEL_FRAGMENTO = 120
const ANTES_DEL_FRAGMENTO = 24
const ANCHO_DEL_GRUPO = 60

/**
 * Una letra o un número en cualquier idioma. Una palabra es una racha de estos caracteres
 * (`/[\p{L}\p{N}]+/gu`): los espacios, guiones, puntos y comas la separan.
 */
const RE_LETRA_O_NUMERO = /[\p{L}\p{N}]/u

/** Hasta qué código de carácter llega la tabla de abajo (el latino básico y el extendido: todo lo que el español usa). */
const LARGO_DE_LA_TABLA_DE_LETRAS = 0x250

/** Qué se sabe de cada uno de esos caracteres: 0 = no se calculó, 1 = es letra o número, 2 = no lo es. */
const TABLA_DE_LETRAS = new Uint8Array(LARGO_DE_LA_TABLA_DE_LETRAS)

/**
 * Indica si un carácter es una letra o un número, y lo recuerda en la tabla si es de los comunes.
 *
 * @param {number} codigo Código del carácter (`charCodeAt`).
 * @returns {boolean}
 */
function es_letra_o_numero(codigo) {
  /** Respuesta de la expresión regular. */
  const es = RE_LETRA_O_NUMERO.test(String.fromCharCode(codigo))
  if (codigo < LARGO_DE_LA_TABLA_DE_LETRAS) {
    TABLA_DE_LETRAS[codigo] = es ? 1 : 2
  }
  return es
}

/** Un código de video escrito a mano: "T5.15", "5.15", "t 5.15". */
const RE_CODIGO = /^[a-z]?\s*(\d+)\s*[.,]\s*(\d+)$/i

/** Vocales (ya sin acento): lo que se quita al final de una palabra para llegar a su raíz. */
const VOCALES = 'aeiou'

/**
 * Terminaciones que se pegan a un verbo: "escanear" + "la", "escanea" + "la". Se sacan solo si lo que
 * queda es un infinitivo, un gerundio o una forma del imperativo, y largo (≥ 4 letras), para no
 * partir palabras como "isla" o "nombre".
 */
const RE_PRONOMBRE_PEGADO = /^(.{4,}(?:ar|er|ir|ando|iendo|yendo|a|e|i))(?:lo|la|los|las|le|les|me|te|se|nos)$/

/** Terminaciones de verbo y de sustantivo derivado que se sacan para llegar a la raíz, de la más larga a la más corta. */
const TERMINACIONES = ['aciones', 'acion', 'iendo', 'yendo', 'ando', 'aste', 'iste', 'ado', 'ido', 'ada', 'ida', 'ar', 'er', 'ir']

/**
 * Inicio de cada secuencia dicha (`FORMAS_DICHAS`): primera palabra → secuencias que empiezan así.
 * Se arma una vez al cargar el módulo.
 *
 * @type {Map<string, Array<{ resto: Array<string>, destino: string }>>}
 */
const INICIOS_DE_FORMAS_DICHAS = new Map()
FORMAS_DICHAS.forEach(function (forma) {
  /** Las palabras que suenan, separadas. */
  const palabras = forma[0].split(' ')
  if (!INICIOS_DE_FORMAS_DICHAS.has(palabras[0])) {
    INICIOS_DE_FORMAS_DICHAS.set(palabras[0], [])
  }
  INICIOS_DE_FORMAS_DICHAS.get(palabras[0]).push({ resto: palabras.slice(1), destino: forma[1] })
})

/**
 * Detecta de un vistazo si un texto trae alguna palabra con la que empieza una secuencia dicha (la "pe"
 * de "pe de efe"): solo entonces `tokenizar` recorre las palabras buscando la secuencia completa.
 * `null` si no hay secuencias.
 *
 * @type {RegExp|null}
 */
const RE_COMIENZO_DE_SECUENCIA = INICIOS_DE_FORMAS_DICHAS.size
  ? new RegExp('\\b(?:' + Array.from(INICIOS_DE_FORMAS_DICHAS.keys()).join('|') + ')\\b', 'i')
  : null

/**
 * Raíz de una palabra ya normalizada: lo que comparten sus plurales y las formas de su verbo. Es un
 * quitador de terminaciones chico, hecho para este vocabulario y para el voseo ("escaneás" llega como
 * "escaneas"): "escanear", "escaneo", "escaneás", "escaneala" y "escáner" tienen la raíz "escan".
 *
 * No es lingüística: a veces junta dos palabras que no son parientes ("pase" y "pasar"), y a veces no
 * junta dos que sí ("vender" y "venta"). Lo primero es raro y se arregla con `RAICES_APARTE`; lo segundo
 * lo cubren los sinónimos y el "empieza igual".
 *
 * @param {string} palabra Palabra en minúsculas y sin acentos.
 * @returns {string}
 */
export function raiz(palabra) {
  if (RAICES_APARTE[palabra]) {
    return RAICES_APARTE[palabra]
  }
  /** Lo que va quedando de la palabra. */
  let r = palabra
  if (r.length <= 3) {
    return r
  }
  /** Pronombre pegado al final ("escanearla", "cargalo"). */
  const pegado = RE_PRONOMBRE_PEGADO.exec(r)
  if (pegado) {
    r = pegado[1]
  }
  // Plural: "-es" detrás de consonante ("dolares", "papeles") o "-s" ("cheques", "ventas").
  if (r.length > 4 && r.endsWith('es') && VOCALES.indexOf(r[r.length - 3]) === -1) {
    r = r.slice(0, -2)
  } else if (r.length > 3 && r.endsWith('s') && !r.endsWith('ss')) {
    r = r.slice(0, -1)
  }
  for (let i = 0; i < TERMINACIONES.length; i++) {
    /** Terminación que se prueba. */
    const t = TERMINACIONES[i]
    if (r.endsWith(t) && r.length - t.length >= 3) {
      r = r.slice(0, -t.length)
      break
    }
  }
  // Las vocales del final ("escane" → "escan"): así "escaneo" y "escanear" llegan al mismo lugar.
  while (r.length > 3 && VOCALES.indexOf(r[r.length - 1]) !== -1) {
    r = r.slice(0, -1)
  }
  return r
}

/** Grupos de sinónimos indexados por palabra y por raíz: clave → números de grupo. Se arma una vez. */
const GRUPOS_POR_CLAVE = new Map()
GRUPOS_DE_SINONIMOS.forEach(function (grupo, numero) {
  grupo.forEach(function (palabra) {
    ;[palabra, raiz(palabra)].forEach(function (clave) {
      if (!GRUPOS_POR_CLAVE.has(clave)) {
        GRUPOS_POR_CLAVE.set(clave, [])
      }
      if (GRUPOS_POR_CLAVE.get(clave).indexOf(numero) === -1) {
        GRUPOS_POR_CLAVE.get(clave).push(numero)
      }
    })
  })
})

/**
 * Palabras ya normalizadas: palabra tal como está escrita → normalizada. Normalizar (minúsculas, `NFD` y
 * sacar acentos) es lo más caro de armar el buscador, y los guiones repiten las mismas ~4.500 formas
 * 75.000 veces; con la memoria se normaliza cada forma una sola vez, y las palabras que salen de acá ya
 * traen calculado su hash, que `Map` usa enseguida al indexarlas. Si crece de más (alguien escribiendo
 * mucho en el buscador) se vacía.
 *
 * @type {Map<string, string>}
 */
const PALABRAS_NORMALIZADAS = new Map()

/** Cuántas formas guarda `PALABRAS_NORMALIZADAS` antes de vaciarse. */
const LIMITE_DE_PALABRAS_NORMALIZADAS = 40000

/**
 * Pasa una palabra a minúsculas y sin acentos (con la memoria de arriba).
 *
 * @param {string} cruda Palabra tal como está escrita.
 * @returns {string}
 */
function normalizar_palabra(cruda) {
  /** Ya normalizada antes, si estaba. */
  let p = PALABRAS_NORMALIZADAS.get(cruda)
  if (p === undefined) {
    p = normalizar(cruda)
    if (PALABRAS_NORMALIZADAS.size >= LIMITE_DE_PALABRAS_NORMALIZADAS) {
      PALABRAS_NORMALIZADAS.clear()
    }
    PALABRAS_NORMALIZADAS.set(cruda, p)
  }
  return p
}

/**
 * Borradores donde `tokenizar` anota dónde empieza y termina cada palabra antes de copiarlas al tamaño justo
 * (así no se van agrandando arreglos de a poco, que era lo más caro de armar el buscador). Se reusan en cada
 * llamada: el resultado de `tokenizar` nunca los comparte.
 *
 * @type {Int32Array}
 */
let borrador_de_inicios = new Int32Array(0)
let borrador_de_finales = new Int32Array(0)

/**
 * Parte un texto en palabras. Para cada una guarda su forma normalizada y dónde empieza y termina en el
 * texto ORIGINAL: el resaltado y el fragmento se arman con esas posiciones, así que conservan los
 * acentos, la ñ y las mayúsculas (se tokeniza el texto original y se normaliza palabra por palabra:
 * normalizar el texto entero cambiaría su largo, porque la "á" pasa a ser dos caracteres). Antes de
 * devolver junta las secuencias que se dicen distinto de como se escriben ("pe de efe" / "pe-de-efe" →
 * "pdf", con el mismo comienzo y fin que el texto completo).
 *
 * @param {string} texto
 * @returns {{ pal: Array<string>, ini: Int32Array, fin: Int32Array }}
 */
export function tokenizar(texto) {
  /** Largo del texto y comienzo de la palabra en curso (-1 = no hay una). */
  const largo = texto.length
  let desde = -1
  /** Palabras normalizadas. */
  const pal = []
  /** Dónde empieza y dónde termina cada una en el texto original (en los borradores compartidos; al final se copian al tamaño justo). */
  if (borrador_de_inicios.length < (largo >> 1) + 1) {
    borrador_de_inicios = new Int32Array((largo >> 1) + 1)
    borrador_de_finales = new Int32Array((largo >> 1) + 1)
  }
  const ini = borrador_de_inicios
  const fin = borrador_de_finales
  /** Cuántas palabras van. */
  let cuantas = 0
  /** true si la palabra en curso tiene algo que no sea minúscula ASCII o cifra: mayúsculas o acentos, que hay que normalizar. */
  let especial = false
  // Se recorre carácter por carácter en lugar de usar `RE_PALABRA.exec`: es lo mismo (letras y números
  // seguidos), pero arma las 75.000 palabras de los guiones en la mitad del tiempo. Y como la gran
  // mayoría ya viene en minúscula y sin acentos, esas ni pasan por la normalización.
  for (let i = 0; i <= largo; i++) {
    /** Si el carácter es parte de una palabra (el carácter "de después del final" no lo es). */
    let dentro = false
    if (i < largo) {
      /** Carácter, y qué se sabe de él si es de los más comunes. */
      const c = texto.charCodeAt(i)
      /** Lo que dice la tabla: 0 = no se calculó todavía, 1 = es de palabra, 2 = no lo es. */
      const t = c < LARGO_DE_LA_TABLA_DE_LETRAS ? TABLA_DE_LETRAS[c] : 0
      dentro = t ? t === 1 : es_letra_o_numero(c)
      if (dentro && (c > 122 || (c < 97 && (c < 48 || c > 57)))) {
        especial = true
      }
    }
    if (dentro) {
      if (desde < 0) {
        desde = i
      }
    } else if (desde >= 0) {
      /** La palabra tal como está escrita. */
      const cruda = texto.slice(desde, i)
      pal.push(especial ? normalizar_palabra(cruda) : cruda)
      ini[cuantas] = desde
      fin[cuantas++] = i
      desde = -1
      especial = false
    }
  }
  // Casi ningún texto trae una secuencia dicha: se mira antes, de un vistazo, para no recorrer todo otra vez.
  if (!RE_COMIENZO_DE_SECUENCIA || !RE_COMIENZO_DE_SECUENCIA.test(texto)) {
    return { pal: pal, ini: ini.slice(0, cuantas), fin: fin.slice(0, cuantas) }
  }
  /** Resultado con las secuencias ya juntas. */
  const salida = { pal: [], ini: [], fin: [] }
  for (let k = 0; k < pal.length; k++) {
    /** Secuencias que empiezan con esta palabra. */
    const candidatas = INICIOS_DE_FORMAS_DICHAS.get(pal[k])
    /** Cuántas palabras ocupa la secuencia encontrada (0 = ninguna) y por cuál se reemplaza. */
    let ocupa = 0
    let destino = ''
    for (let c = 0; candidatas && c < candidatas.length && !ocupa; c++) {
      /** Palabras que siguen a la primera. */
      const resto = candidatas[c].resto
      let coincide = k + resto.length < pal.length
      for (let j = 0; coincide && j < resto.length; j++) {
        coincide = pal[k + 1 + j] === resto[j]
      }
      if (coincide) {
        ocupa = resto.length + 1
        destino = candidatas[c].destino
      }
    }
    if (ocupa) {
      salida.pal.push(destino)
      salida.ini.push(ini[k])
      salida.fin.push(fin[k + ocupa - 1])
      k += ocupa - 1
    } else {
      salida.pal.push(pal[k])
      salida.ini.push(ini[k])
      salida.fin.push(fin[k])
    }
  }
  return { pal: salida.pal, ini: Int32Array.from(salida.ini), fin: Int32Array.from(salida.fin) }
}

/**
 * Indica si dos palabras difieren en una sola letra: una cambiada, una de más, una de menos o dos
 * intercambiadas de lugar. Exige la misma letra inicial (los errores de tipeo casi nunca están en la
 * primera letra; la excepción es la confusión b/v, que sí es frecuente) para no traer palabras sin parentesco.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function difieren_en_una_letra(a, b) {
  /** Largos de las dos palabras. */
  const la = a.length
  const lb = b.length
  if (Math.abs(la - lb) > 1) {
    return false
  }
  /** Primera posición donde las palabras son distintas. */
  let i = 0
  while (i < la && i < lb && a[i] === b[i]) {
    i++
  }
  if (i === la && i === lb) {
    return false
  }
  if (i === 0 && !(la === lb && (a[0] + b[0] === 'bv' || a[0] + b[0] === 'vb'))) {
    return false
  }
  if (la === lb) {
    // Dos letras pegadas intercambiadas ("facutra").
    if (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2)) {
      return true
    }
    // Una letra cambiada: en palabras cortas es ambiguo ("pizza" y "pieza" son otra cosa), así que pide más largo.
    return la >= LARGO_MINIMO_TIPEO_CON_LETRA_CAMBIADA && a.slice(i + 1) === b.slice(i + 1)
  }
  // Una letra de más en la más larga.
  return la > lb ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i)
}

/**
 * Arma los cinco textos de un video en los que se busca, en el orden de los `CAMPO_*`. Si llegó la
 * transcripción, se parte en lo que el catálogo ya trae: la de `buscar-indice` es el "para qué", el
 * guion de voz y el "cuándo no" pegados, así que si empieza con el "para qué" y termina con el "cuándo
 * no" se los saca del guion (no se cuentan dos veces ni el guion hace de "para qué"). Si no coincide
 * (otro formato), todo el texto queda como guion.
 *
 * @param {Object} video Video del catálogo.
 * @param {Object<number, string>} nombres_de_carpeta Nombre de cada carpeta por número.
 * @param {string|null|undefined} transcripcion Texto crudo del índice para este video.
 * @returns {Array<string>}
 */
function textos_del_video(video, nombres_de_carpeta, transcripcion) {
  /** "Para qué" y "cuándo no" del catálogo. */
  const para_que = String(video.para_que || '')
  const cuando_no = String(video.cuando_no || '')
  /** Sección sin la letra de orden ("B · Las compras" → "Las compras"). */
  const seccion = String(video.seccion || '').replace(/^[A-Za-z0-9]{1,3}\s*·\s*/, '')
  /** Carpeta y sección, para buscar por tema. */
  const ubicacion = [nombres_de_carpeta[video.carpeta] || '', seccion].filter(Boolean).join(' · ')
  /** Guion de voz. */
  let voz = ''
  if (typeof transcripcion === 'string' && transcripcion) {
    /** Dónde empieza y dónde termina el guion dentro del texto del índice. */
    let desde = 0
    let hasta = transcripcion.length
    if (para_que && transcripcion.startsWith(para_que)) {
      desde = para_que.length
    }
    if (cuando_no && hasta - desde > cuando_no.length && transcripcion.endsWith(cuando_no)) {
      hasta -= cuando_no.length
    }
    voz = transcripcion.slice(desde, hasta)
  }
  return [String(video.titulo || ''), ubicacion, para_que, voz, cuando_no]
}

/**
 * Arma el buscador. Hay que volver a armarlo cuando llega el índice de transcripciones; con
 * `transcripciones` en `null` busca igual por título, carpeta, sección, "para qué" y "cuándo no".
 *
 * @param {Array<Object>} videos Videos del catálogo (`codigo`, `titulo`, `carpeta`, `seccion`, `para_que`, `cuando_no`, `duracion`…), en el orden en que se muestran.
 * @param {Array<{ nro: number, nombre: string }>} carpetas Carpetas del catálogo.
 * @param {Object<string, string>|null} transcripciones Texto crudo por código (con acentos y mayúsculas), o null si todavía no llegó.
 * @returns {Object} El buscador: una estructura opaca para pasar a `buscar`.
 */
export function crear_buscador(videos, carpetas, transcripciones) {
  /** Videos válidos. */
  const lista = Array.isArray(videos) ? videos : []
  /** Nombre de cada carpeta por número. */
  const nombres_de_carpeta = {}
  ;(Array.isArray(carpetas) ? carpetas : []).forEach(function (c) {
    nombres_de_carpeta[c.nro] = c.nombre
  })
  /** Vocabulario: palabra normalizada → { palabra, raiz, df, idf, docs, masc, sello }. */
  const vocab = new Map()
  /** Un registro por video con sus textos ya partidos en palabras. */
  const docs = []
  /** Video por número visible ("5.15"), para las búsquedas por código. */
  const por_numero = new Map()

  lista.forEach(function (video, i) {
    /** Textos de este video, uno por campo. */
    const textos = textos_del_video(video, nombres_de_carpeta, transcripciones ? transcripciones[video.codigo] : null)
    /** Registro del video: textos originales y, por campo, palabras y posiciones. */
    const doc = { codigo: video.codigo, video: video, textos: textos, pal: [], ini: [], fin: [] }
    for (let c = 0; c < CANTIDAD_CAMPOS; c++) {
      /** Palabras del campo. */
      const tk = textos[c] ? tokenizar(textos[c]) : { pal: [], ini: [], fin: [] }
      doc.pal.push(tk.pal)
      doc.ini.push(tk.ini)
      doc.fin.push(tk.fin)
      for (let k = 0; k < tk.pal.length; k++) {
        /** Entrada del vocabulario, creada la primera vez que aparece la palabra. */
        let e = vocab.get(tk.pal[k])
        if (!e) {
          e = { palabra: tk.pal[k], raiz: raiz(tk.pal[k]), df: [0, 0, 0, 0, 0], idf: null, docs: [], masc: [], sello: -1 }
          vocab.set(tk.pal[k], e)
        }
        // Todos los videos comparten la misma palabra del vocabulario en lugar de una copia cada uno.
        tk.pal[k] = e.palabra
        /** Marca única de este video y este campo: la palabra se cuenta una vez por campo, aunque se repita. */
        const sello = i * 8 + c
        if (e.sello !== sello) {
          e.sello = sello
          e.df[c]++
          /** Cantidad de videos ya anotados en la entrada. */
          const n = e.docs.length
          if (n && e.docs[n - 1] === i) {
            e.masc[n - 1] |= 1 << c
          } else {
            e.docs.push(i)
            e.masc.push(1 << c)
          }
        }
      }
    }
    docs.push(doc)
    por_numero.set(String(video.codigo || '').replace(/^[A-Za-z]+/, ''), i)
  })

  /** Videos en total. */
  const total = docs.length
  /** Entradas del vocabulario agrupadas por raíz. */
  const por_raiz = new Map()
  vocab.forEach(function (e) {
    if (!por_raiz.has(e.raiz)) {
      por_raiz.set(e.raiz, [])
    }
    por_raiz.get(e.raiz).push(e)
  })
  // Lo rara que es una palabra se mide por su RAÍZ, no por la forma suelta: "factura" y "facturarla" son
  // el mismo tema y tienen que pesar lo mismo. Si no, la forma más rara ("facturarla", en un solo título)
  // le ganaba a la palabra exacta que se escribió, que es la más común.
  /** Videos donde aparece alguna forma de la raíz, por campo (máscara de bits), para unir las formas. */
  const mascaras = new Uint8Array(total)
  por_raiz.forEach(function (entradas) {
    /** Videos con alguna forma, contados por campo. */
    const df = entradas[0].df
    if (entradas.length > 1) {
      mascaras.fill(0)
      entradas.forEach(function (e) {
        for (let k = 0; k < e.docs.length; k++) {
          mascaras[e.docs[k]] |= e.masc[k]
        }
      })
      df.fill(0)
      for (let d = 0; d < total; d++) {
        for (let c = 0; c < CANTIDAD_CAMPOS && mascaras[d]; c++) {
          if (mascaras[d] & (1 << c)) {
            df[c]++
          }
        }
      }
    }
    /** Rareza por campo, compartida por todas las formas de la raíz. */
    const idf = df.map(function (d) {
      return d ? Math.log(1 + total / d) : 0
    })
    entradas.forEach(function (e) {
      e.idf = idf
    })
  })
  return { docs: docs, vocab: vocab, por_raiz: por_raiz, por_numero: por_numero }
}

/**
 * Suma una entrada del vocabulario al mapa de una palabra con ese puntaje, si es mejor que el que ya tenía.
 *
 * @param {Map<Object, number>} mapa Entradas del vocabulario que valen para la palabra → qué tan directas son.
 * @param {Object} entrada Entrada del vocabulario.
 * @param {number} puntos Qué tan directa es la coincidencia (`PUNTOS`).
 * @returns {void}
 */
function anotar(mapa, entrada, puntos) {
  if ((mapa.get(entrada) || 0) < puntos) {
    mapa.set(entrada, puntos)
  }
}

/**
 * Suma al mapa la palabra tal cual y las otras formas de su raíz (plural, verbo), si existen en el corpus.
 *
 * @param {Object} b Buscador.
 * @param {Map<Object, number>} mapa
 * @param {string} palabra Palabra normalizada.
 * @param {number} base Puntos de una coincidencia exacta; las otras formas valen `PUNTOS.raiz` de eso.
 * @returns {boolean} true si encontró algo.
 */
function anotar_formas(b, mapa, palabra, base) {
  /** Si encontró alguna. */
  let hallo = false
  /** La palabra misma. */
  const exacta = b.vocab.get(palabra)
  if (exacta) {
    anotar(mapa, exacta, base)
    hallo = true
  }
  /** Las que comparten su raíz. */
  const hermanas = b.por_raiz.get(raiz(palabra))
  if (hermanas) {
    hermanas.forEach(function (e) {
      if (e !== exacta) {
        anotar(mapa, e, base * PUNTOS.raiz)
        hallo = true
      }
    })
  }
  return hallo
}

/**
 * Palabra con la que un guion dice un número escrito con cifras ("21" → "veintiuno"), o '' si no hay.
 *
 * @param {string} palabra
 * @returns {string}
 */
function numero_en_letras(palabra) {
  if (!/^\d+$/.test(palabra)) {
    return ''
  }
  /** El número, sin ceros a la izquierda. */
  const n = Number(palabra)
  return n <= 30 ? NUMEROS_HASTA_30[n] : NUMEROS_REDONDOS[n] || ''
}

/**
 * Busca en el vocabulario todo lo que puede querer decir una palabra de la consulta.
 *
 * El orden importa: lo directo y las otras formas siempre se buscan; "empieza igual" solo si la palabra
 * no existe tal cual en ningún video (si "venta" existe, "ventana" no es lo que se quiso decir); y el
 * error de tipeo solo si, con todo lo anterior, no se encontró nada.
 *
 * @param {Object} b Buscador.
 * @param {string} palabra Palabra de la consulta, normalizada.
 * @returns {Map<Object, number>} Entradas del vocabulario → qué tan directa es cada una. Vacío si no hay nada.
 */
function resolver_palabra(b, palabra) {
  /** Resultado. */
  const mapa = new Map()
  anotar_formas(b, mapa, palabra, PUNTOS.directa)

  // Cifras que el guion dice en letras.
  /** Cómo se dice el número, si es un número. */
  const dicho = numero_en_letras(palabra)
  if (dicho) {
    anotar_formas(b, mapa, dicho, PUNTOS.numero)
  }

  // Sinónimos: los de la palabra y los de su raíz.
  ;[palabra, raiz(palabra)].forEach(function (clave) {
    ;(GRUPOS_POR_CLAVE.get(clave) || []).forEach(function (numero) {
      GRUPOS_DE_SINONIMOS[numero].forEach(function (otra) {
        if (otra !== palabra && raiz(otra) !== raiz(palabra)) {
          anotar_formas(b, mapa, otra, PUNTOS.sinonimo)
        }
      })
    })
  })

  // La palabra a medio escribir: solo si no existe tal cual.
  if (!b.vocab.has(palabra) && palabra.length >= LARGO_MINIMO_PREFIJO) {
    b.vocab.forEach(function (e) {
      if (e.palabra.startsWith(palabra)) {
        anotar(mapa, e, PUNTOS.prefijo)
      }
    })
  }

  // Error de tipeo: solo si todo lo anterior no encontró nada.
  if (!mapa.size && palabra.length >= LARGO_MINIMO_TIPEO) {
    b.vocab.forEach(function (e) {
      if (difieren_en_una_letra(palabra, e.palabra)) {
        anotar(mapa, e, PUNTOS.tipeo)
        ;(b.por_raiz.get(e.raiz) || []).forEach(function (hermana) {
          anotar(mapa, hermana, PUNTOS.tipeo * PUNTOS.raiz)
        })
      }
    })
  }
  return mapa
}

/**
 * Menor cantidad de palabras seguidas del texto que alcanza para tener todas las palabras de la
 * consulta que aparecen en él (para el bonus por cercanía).
 *
 * @param {Array<{ k: number, i: number }>} eventos Coincidencias del campo en orden de posición: `k` es el lugar de la palabra en el texto, `i` cuál palabra de la consulta es.
 * @param {number} distintas Cuántas palabras distintas de la consulta aparecen en el campo.
 * @param {number} cantidad Cuántas palabras tiene la consulta.
 * @returns {number} El largo de esa ventana; `Infinity` si no hay.
 */
function ventana_minima(eventos, distintas, cantidad) {
  /** Cuántas veces está cada palabra de la consulta dentro de la ventana. */
  const cuentas = new Int16Array(cantidad)
  /** Cuántas palabras distintas hay dentro de la ventana. */
  let tiene = 0
  /** Mejor largo encontrado. */
  let mejor = Infinity
  /** Borde izquierdo de la ventana. */
  let izq = 0
  for (let der = 0; der < eventos.length; der++) {
    if (cuentas[eventos[der].i]++ === 0) {
      tiene++
    }
    while (tiene === distintas) {
      mejor = Math.min(mejor, eventos[der].k - eventos[izq].k + 1)
      if (--cuentas[eventos[izq].i] === 0) {
        tiene--
      }
      izq++
    }
  }
  return mejor
}

/**
 * Recorta un texto largo alrededor de un grupo de palabras encontradas: empieza un poco antes (en el
 * comienzo de la oración si hay uno cerca, si no en el comienzo de una palabra) y termina en un límite
 * de palabra. Devuelve posiciones del texto original.
 *
 * @param {string} texto
 * @param {number} desde Comienzo de la primera palabra encontrada.
 * @param {number} hasta Fin de la última palabra encontrada.
 * @returns {[number, number]}
 */
function recortar_alrededor(texto, desde, hasta) {
  /** Comienzo del recorte. */
  let s = Math.max(0, desde - ANTES_DEL_FRAGMENTO)
  if (s > 0) {
    /** Lo que hay entre el comienzo tentativo y la primera palabra encontrada. */
    const tramo = texto.slice(s, desde)
    /** Último fin de oración dentro de ese tramo. */
    const oracion = Math.max(tramo.lastIndexOf('. '), tramo.lastIndexOf(': '), tramo.lastIndexOf('; '), tramo.lastIndexOf('? '), tramo.lastIndexOf('! '))
    if (oracion !== -1) {
      s += oracion + 2
    } else {
      /** Próximo espacio: el recorte arranca en una palabra entera. */
      const espacio = texto.indexOf(' ', s)
      if (espacio !== -1 && espacio < desde) {
        s = espacio + 1
      }
    }
  }
  /** Fin del recorte. */
  let e = Math.min(texto.length, Math.max(hasta, s + LARGO_DEL_FRAGMENTO))
  if (e < texto.length) {
    /** Último espacio antes del corte, para no partir una palabra. */
    const espacio = texto.lastIndexOf(' ', e)
    if (espacio > hasta) {
      e = espacio
    }
  }
  return [s, e]
}

/**
 * Parte un texto en pedazos marcados / no marcados según las palabras encontradas. Los pedazos son
 * cortes del texto ORIGINAL (conservan acentos, ñ y mayúsculas) y, juntos, lo reconstruyen exacto.
 *
 * @param {string} texto Texto original del campo.
 * @param {Array<number>} ini Dónde empieza cada palabra del campo.
 * @param {Array<number>} fin Dónde termina cada palabra del campo.
 * @param {Array<{ k: number }>} eventos Palabras encontradas (índices en `ini`/`fin`), en orden.
 * @param {number} s Desde dónde se muestra.
 * @param {number} e Hasta dónde se muestra.
 * @returns {Array<{ texto: string, marca: boolean }>}
 */
function partir_en_marcas(texto, ini, fin, eventos, s, e) {
  /** Pedazos resultantes. */
  const partes = []
  /** Hasta dónde se cubrió. */
  let cursor = s
  for (let j = 0; j < eventos.length; j++) {
    /** Posición de la palabra encontrada. */
    const a = ini[eventos[j].k]
    const z = fin[eventos[j].k]
    // Una palabra puede coincidir con dos palabras de la consulta: se marca una sola vez.
    if (a < cursor || z > e) {
      continue
    }
    if (a > cursor) {
      partes.push({ texto: texto.slice(cursor, a), marca: false })
    }
    partes.push({ texto: texto.slice(a, z), marca: true })
    cursor = z
  }
  if (cursor < e) {
    partes.push({ texto: texto.slice(cursor, e), marca: false })
  }
  return partes
}

/**
 * Elige el fragmento que se muestra debajo del título: el grupo de palabras encontradas más completo
 * del "para qué" o del guion (a igual cantidad de palabras, el "para qué", que está escrito para leerse).
 * Si la coincidencia fue solo en el título o en la carpeta, muestra el comienzo del "para qué" sin marcas.
 *
 * @param {Object} doc Registro del video.
 * @param {Array<Array<{ k: number, i: number, valor: number }>>} eventos Coincidencias por campo.
 * @returns {{ partes: Array<{ texto: string, marca: boolean }>, de: string }}
 */
function elegir_fragmento(doc, eventos) {
  /** Mejor candidato: { campo, desde, hasta, palabras, valor }. */
  let mejor = null
  ;[CAMPO_PARA_QUE, CAMPO_VOZ].forEach(function (c) {
    /** Coincidencias de este campo. */
    const evs = eventos[c]
    /** Posiciones de cada palabra del campo. */
    const ini = doc.ini[c]
    const fin = doc.fin[c]
    for (let j = 0; j < evs.length; j++) {
      /** Palabras distintas del grupo que arranca en `j` y lo que suman. */
      const vistas = {}
      let palabras = 0
      let valor = 0
      let hasta = fin[evs[j].k]
      for (let r = j; r < evs.length && fin[evs[r].k] - ini[evs[j].k] <= ANCHO_DEL_GRUPO; r++) {
        if (!vistas[evs[r].i]) {
          vistas[evs[r].i] = evs[r].valor
          palabras++
          valor += evs[r].valor
        }
        hasta = fin[evs[r].k]
      }
      if (!mejor || palabras > mejor.palabras || (palabras === mejor.palabras && valor > mejor.valor)) {
        mejor = { campo: c, desde: ini[evs[j].k], hasta: hasta, palabras: palabras, valor: valor }
      }
    }
  })
  if (mejor) {
    /** Texto del campo elegido. */
    const texto = doc.textos[mejor.campo]
    /** Recorte alrededor del grupo. */
    const corte = recortar_alrededor(texto, mejor.desde, mejor.hasta)
    /** Pedazos marcados. */
    const partes = partir_en_marcas(texto, doc.ini[mejor.campo], doc.fin[mejor.campo], eventos[mejor.campo], corte[0], corte[1])
    if (corte[0] > 0) {
      partes.unshift({ texto: '…', marca: false })
    }
    if (corte[1] < texto.length) {
      partes.push({ texto: '…', marca: false })
    }
    return { partes: partes, de: mejor.campo === CAMPO_VOZ ? 'transcripcion' : 'para_que' }
  }
  /** Sin coincidencias en el cuerpo: el comienzo del "para qué", si hay. */
  const para_que = doc.textos[CAMPO_PARA_QUE]
  if (!para_que) {
    return { partes: [], de: '' }
  }
  /** Comienzo cortado en un límite de palabra. */
  let fin = Math.min(para_que.length, LARGO_DEL_FRAGMENTO)
  if (fin < para_que.length && para_que.lastIndexOf(' ', fin) > 0) {
    fin = para_que.lastIndexOf(' ', fin)
  }
  return {
    partes: [{ texto: para_que.slice(0, fin) + (fin < para_que.length ? '…' : ''), marca: false }],
    de: 'para_que',
  }
}

/**
 * Busca videos. Devuelve los resultados ordenados por relevancia.
 *
 * - `completo: true`: todos los resultados tienen TODAS las palabras de la consulta (o la consulta es
 *   un código de video).
 * - `completo: false`: ningún video las tiene todas; se devuelven los que tienen la mayoría (solo si la
 *   consulta tiene 3 palabras o más; con 1 o 2, o está todo o no hay nada) y la página lo avisa.
 *
 * @param {Object} buscador Lo que devolvió `crear_buscador`.
 * @param {string} consulta Lo que escribió la persona.
 * @returns {{
 *   resultados: Array<{
 *     codigo: string,
 *     puntaje: number,
 *     titulo_partes: Array<{ texto: string, marca: boolean }>,
 *     fragmento_partes: Array<{ texto: string, marca: boolean }>,
 *     fragmento_de: ('transcripcion'|'para_que'|'')
 *   }>,
 *   completo: boolean,
 *   palabras: Array<string>
 * }}
 */
export function buscar(buscador, consulta) {
  /** Respuesta de "no hay nada que buscar". */
  const vacio = { resultados: [], completo: true, palabras: [] }
  if (!buscador || !buscador.docs.length) {
    return vacio
  }
  /** Lo escrito, sin espacios de más. */
  const texto = String(consulta == null ? '' : consulta).trim()
  if (!texto) {
    return vacio
  }

  // Un código de video escrito a mano ("T5.15", "5.15") lleva directo a ese video.
  /** Coincidencia con la forma de un código. */
  const como_codigo = RE_CODIGO.exec(texto)
  if (como_codigo && buscador.por_numero.has(como_codigo[1] + '.' + como_codigo[2])) {
    /** Registro del video. */
    const doc = buscador.docs[buscador.por_numero.get(como_codigo[1] + '.' + como_codigo[2])]
    /** Fragmento: el comienzo del "para qué". */
    const fragmento = elegir_fragmento(doc, [[], [], [], [], []])
    return {
      resultados: [
        {
          codigo: doc.codigo,
          puntaje: 1000,
          titulo_partes: doc.textos[CAMPO_TITULO] ? [{ texto: doc.textos[CAMPO_TITULO], marca: false }] : [],
          fragmento_partes: fragmento.partes,
          fragmento_de: fragmento.de,
        },
      ],
      completo: true,
      palabras: [texto],
    }
  }

  /** Palabras de lo escrito. */
  const escritas = tokenizar(texto).pal
  if (!escritas.length) {
    return vacio
  }
  /** Palabras sin repetir. */
  const distintas = escritas.filter(function (p, k) {
    return escritas.indexOf(p) === k
  })
  /** Palabras sin el relleno; si todas lo son, se buscan tal cual. */
  const sin_relleno = distintas.filter(function (p) {
    return !PALABRAS_DE_RELLENO.has(p)
  })
  /** Palabras que se buscan. */
  const palabras = sin_relleno.length ? sin_relleno : distintas
  /** Cantidad de palabras y de videos. */
  const n = palabras.length
  const total = buscador.docs.length

  /** Para cada palabra, qué entradas del vocabulario le sirven y con cuántos puntos. */
  const mapas = palabras.map(function (p) {
    return resolver_palabra(buscador, p)
  })

  // Etapa 1: qué palabras tiene cada video y cuánto valen (usando solo el índice invertido, sin leer los textos).
  /** Mejor valor de cada palabra en cada video: posición `i * total + video`. */
  const valores = new Float64Array(n * total)
  mapas.forEach(function (mapa, i) {
    mapa.forEach(function (puntos, e) {
      for (let k = 0; k < e.docs.length; k++) {
        /** Video y campos donde está la palabra. */
        const d = e.docs[k]
        const mascara = e.masc[k]
        for (let c = 0; c < CANTIDAD_CAMPOS; c++) {
          if (mascara & (1 << c)) {
            /** Valor de esta coincidencia. */
            const v = PESO_DE_CAMPO[c] * e.idf[c] * puntos
            if (v > valores[i * total + d]) {
              valores[i * total + d] = v
            }
          }
        }
      }
    })
  })
  /** Videos con todas las palabras y videos con la mayoría. */
  const completos = []
  const parciales = []
  /** Mínimo de palabras para la lista de "los que más se parecen" (más de la mitad; solo con 3 o más). */
  const minimo = Math.floor(n / 2) + 1
  for (let d = 0; d < total; d++) {
    /** Cuántas palabras de la consulta tiene el video. */
    let tiene = 0
    for (let i = 0; i < n; i++) {
      if (valores[i * total + d] > 0) {
        tiene++
      }
    }
    if (tiene === n) {
      completos.push(d)
    } else if (n >= 3 && tiene >= minimo) {
      parciales.push(d)
    }
  }
  /** true si hay videos con todas las palabras. */
  const completo = completos.length > 0
  /** Videos que se muestran. */
  const elegidos = completo ? completos : parciales
  if (!elegidos.length) {
    // Sin resultados no hay nada que avisar sobre "los que más se parecen": cuenta como completo.
    return { resultados: [], completo: true, palabras: palabras }
  }

  // Etapa 2: leer los textos de los videos elegidos para medir cercanía, repetición, resaltado y fragmento.
  /** Palabra del texto → a qué palabras de la consulta sirve, con su entrada del vocabulario y sus puntos. */
  const por_palabra = new Map()
  mapas.forEach(function (mapa, i) {
    mapa.forEach(function (puntos, e) {
      if (!por_palabra.has(e.palabra)) {
        por_palabra.set(e.palabra, [])
      }
      por_palabra.get(e.palabra).push({ i: i, puntos: puntos, e: e })
    })
  })
  /** Resultados sin ordenar. */
  const resultados = []
  /** Mejor valor y repeticiones de cada palabra en cada campo (posición `i * CANTIDAD_CAMPOS + campo`). */
  const mejor_valor = new Float64Array(n * CANTIDAD_CAMPOS)
  const repeticiones = new Uint16Array(n * CANTIDAD_CAMPOS)
  elegidos.forEach(function (d) {
    /** Registro del video. */
    const doc = buscador.docs[d]
    mejor_valor.fill(0)
    repeticiones.fill(0)
    /** Coincidencias por campo, en orden de posición. */
    const eventos = []
    for (let c = 0; c < CANTIDAD_CAMPOS; c++) {
      /** Coincidencias de este campo. */
      const evs = []
      /** Palabras del campo. */
      const pal = doc.pal[c]
      for (let k = 0; k < pal.length; k++) {
        /** Palabras de la consulta a las que sirve esta palabra del texto. */
        const sirve = por_palabra.get(pal[k])
        if (!sirve) {
          continue
        }
        for (let s = 0; s < sirve.length; s++) {
          /** Valor de esta coincidencia. */
          const valor = PESO_DE_CAMPO[c] * sirve[s].e.idf[c] * sirve[s].puntos
          evs.push({ k: k, i: sirve[s].i, valor: valor })
          /** Posición en las tablas de mejores valores. */
          const pos = sirve[s].i * CANTIDAD_CAMPOS + c
          repeticiones[pos]++
          if (valor > mejor_valor[pos]) {
            mejor_valor[pos] = valor
          }
        }
      }
      eventos.push(evs)
    }
    /** Puntaje del video. */
    let puntaje = 0
    for (let i = 0; i < n; i++) {
      /** El mejor campo de la palabra y lo que suman los demás. */
      let mayor = 0
      let resto = 0
      for (let c = 0; c < CANTIDAD_CAMPOS; c++) {
        /** Valor; en el guion, con el premio por repetición (en el título repetir una palabra es casualidad, no tema). */
        const v =
          mejor_valor[i * CANTIDAD_CAMPOS + c] *
          (c === CAMPO_VOZ ? 1 + FACTOR_REPETICION * Math.log(Math.min(6, repeticiones[i * CANTIDAD_CAMPOS + c]) || 1) : 1)
        if (v > mayor) {
          resto += mayor
          mayor = v
        } else {
          resto += v
        }
      }
      puntaje += mayor + FACTOR_OTROS_CAMPOS * resto
    }
    // Cercanía: por cada campo, cuánto más juntas están las palabras, más suman.
    for (let c = 0; c < CANTIDAD_CAMPOS; c++) {
      /** Cuántas palabras distintas de la consulta hay en el campo y cuánto valen. */
      let presentes = 0
      let suma = 0
      for (let i = 0; i < n; i++) {
        if (mejor_valor[i * CANTIDAD_CAMPOS + c] > 0) {
          presentes++
          suma += mejor_valor[i * CANTIDAD_CAMPOS + c]
        }
      }
      if (presentes >= 2) {
        /** Largo de la ventana más corta que tiene a todas. */
        const ventana = ventana_minima(eventos[c], presentes, n)
        puntaje += FACTOR_CERCANIA * suma * Math.min(1, presentes / ventana)
      }
    }
    /** Fragmento y título marcados. */
    const fragmento = elegir_fragmento(doc, eventos)
    /** Título completo, con las palabras encontradas marcadas. */
    const titulo = doc.textos[CAMPO_TITULO]
    resultados.push({
      codigo: doc.codigo,
      puntaje: Math.round(puntaje * 100) / 100,
      titulo_partes: partir_en_marcas(titulo, doc.ini[CAMPO_TITULO], doc.fin[CAMPO_TITULO], eventos[CAMPO_TITULO], 0, titulo.length),
      fragmento_partes: fragmento.partes,
      fragmento_de: fragmento.de,
      orden: d,
    })
  })
  resultados.sort(function (a, b) {
    return b.puntaje - a.puntaje || a.orden - b.orden
  })
  /** Con la lista de "los que más se parecen" se corta lo que quedó lejos del mejor. */
  const lista = completo
    ? resultados
    : resultados
        .filter(function (r) {
          return r.puntaje >= PISO_PARCIALES * resultados[0].puntaje
        })
        .slice(0, MAXIMO_PARCIALES)
  lista.forEach(function (r) {
    delete r.orden
  })
  return { resultados: lista, completo: completo, palabras: palabras }
}
