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
 * 1. La consulta se parte en palabras que pueden aparecer EN ALGÚN LADO del video (título, carpeta, "para
 *    qué", guion), en cualquier orden. Las palabras de relleno ("cómo", "una", "de"…) se ignoran.
 * 2. Cada palabra encuentra sus formas: sin acentos, plural, tiempos del verbo (cobrar: cobro, cobrás,
 *    cobraron, cobrado, cobrarlo; y los que cambian la raíz: muestra/mostrar, elige/elegir), la palabra a
 *    medio escribir ("escan"), sinónimos de la casa (`sinonimos.js`) y, SOLO si no encontró nada, un
 *    error de tipeo ("facutra").
 * 3. Un video entra si cubre bastante de la consulta (ver "La cobertura") y los resultados salen ordenados
 *    por relevancia, no por el orden del guion (ver "El puntaje").
 *
 * El puntaje. Para cada palabra de la consulta y cada video se toma el mejor campo donde aparece:
 *
 *     peso del campo × lo rara que es la palabra EN ESE campo × qué tan directa es la coincidencia
 *
 * - Peso del campo (`PESO_DE_CAMPO`): título 10, "para qué" 3, carpeta y sección 1,5, guion 1.
 * - Rareza: `ln(1 + N / df)`, con `df` = en cuántos videos aparece la palabra en ese campo. Se mide POR
 *   CAMPO a propósito: "reportes" sale en el guion de 360 de los 364 videos (el arranque se repite), así
 *   que ahí pesa casi nada, pero en los títulos es rara y quien lo escribe quiere esos títulos. Se mide
 *   por RAÍZ, no por forma suelta ("factura" y "facturarla" pesan igual), salvo la palabra tal cual se
 *   escribió, que conserva la suya ("cargaron", dicho en un solo video, lo encuentra por encima de los
 *   200 que dicen "cargar"). Y los sinónimos comparten la rareza de todo su grupo: "producto", que casi
 *   no se dice, no pesa más que "artículo", que es el mismo tema.
 * - Qué tan directa (`PUNTOS`): la palabra exacta 1, otra forma de la misma palabra 0,85, "empieza
 *   igual" 0,55, un sinónimo 0,5 y un error de tipeo 0,4.
 *
 * Después se le suma, por cada campo, un bonus por cercanía (que las palabras estén juntas) y un
 * pequeño premio por repetición en el guion (el video que habla mucho de algo). Nada de esto usa el
 * servidor.
 *
 * La cobertura. Cada palabra de la consulta pesa lo rara que es en todo el centro (`ln(1 + N / videos que
 * la tienen)`), y la cobertura de un video es el peso de las palabras que tiene sobre el peso de todas. Entran
 * los videos con cobertura de al menos 0,5 y el puntaje se multiplica por
 * `cobertura ^ EXPONENTE_DE_COBERTURA`: un video que cubre tres de cuatro palabras, la rara incluida y
 * con el título cerca, le gana a uno que tiene las cuatro sueltas en el guion. Si con 0,5 no se juntan
 * `CANDIDATOS_MINIMOS` videos (una pregunta larga en la que falta una palabra rara), el umbral baja de a
 * pasos (`UMBRALES_DE_COBERTURA`: 0,5 → 0,4 → 0,3 → 0,25) hasta juntarlos o llegar al último; el multiplicador
 * de cobertura sigue ordenando, así que bajar el umbral no pone arriba a los que dicen menos. `completo` es
 * true solo si el primero cubre todo: bajar el umbral no cambia lo que significa (ni cuándo se muestra el aviso).
 *
 * Las palabras que existen tal cual. Quien escribe una palabra que está dicha en algún video no la ve tapada
 * por una expansión: el tipeo y el "empieza igual" solo se aplican a lo que no existe, las otras formas de la
 * raíz exigen ser parientes de verdad (`son_parientes`: "arqueo" no es "arca" aunque una regla general les
 * haya dado la misma raíz) y los grupos de sinónimos se buscan por la raíz de cada palabra, nunca por la escrita.
 *
 * Lo que no se junta con nadie. Las palabras de relleno ("más", "esta", "tras", "uno"…) tienen su propia clase en el
 * vocabulario (`clase_de`): si no, "masa" (sin la vocal final, "mas") era lo mismo que "más" y quien escribía "en
 * masa" recibía 129 videos, y "estado" traía el catálogo entero por "esta" y "estas". Una letra suelta que no es un
 * dígito ("escanear f", mientras se escribe "factura") pesa como una palabra común, no como una rara. Un grupo de
 * sinónimos que aparece en más del 40 % de los videos ("alta / crear / agregar / cargar / registrar", 75 %) aporta
 * cada vez menos (`factor_de_amplitud`), y lo que vale en un solo sentido ("muchos" → "en masa", "electrónica" →
 * ARCA solo si se escribe también "factura") va en `EQUIVALENCIAS_DE_LA_CONSULTA`, no en un grupo.
 */
import { normalizar } from './utiles.js'
import {
  PALABRAS_DE_RELLENO,
  GRUPOS_DE_SINONIMOS,
  FORMAS_DICHAS,
  EQUIVALENCIAS_DE_LA_CONSULTA,
  NUMEROS_HASTA_30,
  NUMEROS_REDONDOS,
  RAICES_APARTE,
  RAICES_IRREGULARES,
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

/** Letras iniciales que tienen que compartir dos palabras de la misma raíz para ser parientes (ver `son_parientes`). */
const LARGO_MINIMO_DE_PARENTESCO = 3

/** Largo mínimo de una palabra para que valga como "empieza igual" (con menos letras trae medio vocabulario). */
const LARGO_MINIMO_PREFIJO = 3

/** Largo mínimo de una palabra para corregirle un error de tipeo (en las cortas, "gato" y "dato" se confunden). */
const LARGO_MINIMO_TIPEO = 5

/** Largo mínimo para corregir una letra CAMBIADA por otra (más ambiguo que una de más, una de menos o dos intercambiadas). */
const LARGO_MINIMO_TIPEO_CON_LETRA_CAMBIADA = 6

/** Cuántas palabras de la consulta se usan como máximo. */
const MAXIMO_DE_PALABRAS = 12

/** Hasta qué parte de los videos puede cubrir un grupo de sinónimos sin que sus sinónimos valgan menos. */
const AMPLITUD_SIN_DESCUENTO = 0.4

/** Lo menos que puede valer (como fracción) un sinónimo de un grupo que cubre casi todo. */
const FACTOR_MINIMO_DE_AMPLITUD = 0.1

/** Cuántos caracteres de la consulta se leen como máximo (más no cambian el resultado y cuestan al separar en palabras). */
const MAXIMO_DE_CARACTERES = 200

/**
 * Tope de lo rara y de lo pesada que puede ser una letra suelta que no es un dígito ("escanear f", "factura b"):
 * en un catálogo casi todas las letras sueltas aparecen en un par de videos ("F tres, F cuatro") y pesaban lo mismo
 * que la palabra que se quería. Con el tope pesan como una palabra común.
 */
const TOPE_DE_RAREZA_DE_UNA_LETRA = 1
const TOPE_DE_PESO_DE_UNA_LETRA = 1

/**
 * Coberturas mínimas para que un video entre en los resultados aunque le falten palabras de la consulta: el
 * peso de las palabras que tiene sobre el peso de todas (ver `buscar`). Se empieza por la primera (con 0,5, entre
 * dos palabras igual de raras alcanza con una; con tres, con dos) y se baja de a una si no se juntan
 * `CANDIDATOS_MINIMOS`.
 */
const UMBRALES_DE_COBERTURA = [0.5, 0.4, 0.3, 0.25]

/** Cuántos videos se buscan juntar bajando el umbral de cobertura, y cuántos resultados se garantizan si los hay. */
const CANDIDATOS_MINIMOS = 8

/**
 * El puntaje de un video se multiplica por `cobertura ^ EXPONENTE_DE_COBERTURA`: cubrir 3 de 4 palabras igual de
 * raras deja el 42 % del puntaje (con 3), 2 de 4 el 12 %. Medido con consultas hechas de 3 palabras del título más
 * una ajena (sube con exponente 1 o 2) y con palabras sueltas del guion (sube con 4 o más): 3 deja las dos bien.
 */
const EXPONENTE_DE_COBERTURA = 3

/**
 * Cuán pegadas tienen que estar las palabras de una consulta en un texto (palabras de la consulta sobre
 * largo de la ventana más corta que las tiene) para que la coincidencia no cuente como "de pasada": 0,4 es,
 * con dos palabras, a lo sumo tres entre medio ("hasta seis páginas").
 */
const CERCANIA_MINIMA = 0.4

/**
 * Cuánta información tienen que sumar las palabras de una consulta de dos o más para que un video que las
 * tiene solo de pasada en el guion cuente como respuesta completa. Cada palabra suma `ln(1 + N / videos que
 * la tienen)`: una palabra en 100 de los 364 videos suma 1,5; en 20, 2,9; en uno solo, 5,9. Con 7, dos
 * palabras de 15 videos cada una (3,3 + 3,3) no alcanzan, y una rara más una común (5,9 + 1,5) sí. No se
 * aplica si las palabras están pegadas en el guion (`CERCANIA_MINIMA`: "hasta seis páginas" es una frase, no
 * una coincidencia casual). Medido sobre 150 consultas de dos palabras de entre 8 y 150 videos que solo
 * coinciden de pasada en uno o dos guiones: 24 siguen "completas" (sin el piso, 92). Y no baja el acierto:
 * 233 de 246 consultas de dos palabras raras de una misma oración siguen "completas" con su video entre los
 * 3 primeros (sin piso, 234), y 164 de 239 frases de dos palabras medianas seguidas (sin piso, 165). El
 * costo: dos palabras medianas dichas lejos una de otra en un guion salen con el aviso de "se parecen" aunque
 * el video sea el bueno (189 de 322 "completas" en lugar de 248); igual se listan.
 */
const INFORMACION_MINIMA = 7

/** De los videos que no cubren todas las palabras: cuántos se muestran como máximo y el piso de puntaje (respecto del mejor). */
const MAXIMO_PARCIALES = 40
const PISO_PARCIALES = 0.25

/**
 * Medidas del fragmento que se muestra debajo del título (caracteres). Entra en dos renglones de la
 * barra de carpetas (unos 48 caracteres por renglón en el ancho de tablet): el recorte empieza
 * `ANTES_DEL_FRAGMENTO` caracteres antes de la primera palabra encontrada y las palabras de un mismo grupo
 * no se separan más de `ANCHO_DEL_GRUPO`, así lo que se buscó queda dentro de lo que se ve. Lo que
 * sobre lo corta el CSS con puntos suspensivos.
 */
const LARGO_DEL_FRAGMENTO = 104
const ANTES_DEL_FRAGMENTO = 22
const ANCHO_DEL_GRUPO = 56

/**
 * Una letra o un número en cualquier idioma. Una palabra es una racha de estos caracteres
 * (`/[\p{L}\p{N}\p{M}]+/gu`): los espacios, guiones, puntos y comas la separan. Incluye las marcas
 * combinables (`\p{M}`) para que una "ñ" escrita como "n" + tilde (así la mandan algunos teclados y
 * algunos editores) no parta la palabra en dos: `normalizar` después le saca el acento igual.
 */
const RE_LETRA_O_NUMERO = /[\p{L}\p{N}\p{M}]/u

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
 * Pronombre pegado a un infinitivo o a un gerundio: "abrirlo", "pasarla", "escaneandolos". Con "me" y "te"
 * solo si el infinitivo es largo y de -ar/-er ("llevarte", "quedarte"): "confirme" y "reparte" terminan igual
 * y no son "confirir" + "me" ni "reparar" + "te".
 */
const RE_INFINITIVO_CON_PRONOMBRE = /^(?:(.{3,}(?:ar|er|ir)|.{2,}(?:ando|iendo|yendo))(?:lo|la|los|las|le|les|se)|(.{4,}(?:ar|er))(?:me|te))$/

/**
 * Pronombre pegado a un imperativo: "cargalo", "guardala". Largo (≥ 5 letras antes del pronombre) para no
 * partir "isla", "nombre" ni "estilo". Es la regla más floja de todas: "cancela" o "escala" se parten mal.
 */
const RE_IMPERATIVO_CON_PRONOMBRE = /^(.{4,}[aei])(?:lo|la|los|las|le|les)$/

/**
 * Terminaciones de una forma conjugada que traen su propia "s" o "n": nosotros (cargamos, vendemos), ellos
 * en pretérito (cargaron, vendieron) y el imperfecto (cargaba, cargaban, vendían). Se sacan ANTES del
 * plural, que les arrancaría la "s". "-imos" también termina "últimos", "mínimos", "máximos" y
 * "próximos": esos cuatro están en `RAICES_APARTE`.
 */
const FORMAS_CONJUGADAS = ['ieron', 'aron', 'amos', 'emos', 'imos', 'abas', 'aban', 'aba', 'ian']

/**
 * Terminaciones de verbo y de sustantivo derivado que se sacan para llegar a la raíz, cada una con
 * cuántas letras tienen que quedar: infinitivo, participio, gerundio, pretérito de vos ("-aste") y la
 * tercera del plural ("venden", "cargan"). "orden" y "joven" terminan en "-en" y se arreglan en
 * `RAICES_APARTE`.
 */
const TERMINACIONES = [
  ['aciones', 3], ['acion', 3], ['iendo', 3], ['yendo', 3], ['ando', 3], ['aste', 3], ['iste', 3],
  ['ado', 3], ['ido', 3], ['ada', 3], ['ida', 3], ['ar', 3], ['er', 3], ['ir', 3], ['en', 3], ['an', 3],
]

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
 * Detecta de un vistazo si un texto trae alguna secuencia dicha completa ("pe de efe", "de una vez"): solo
 * entonces `tokenizar` recorre las palabras buscándola. Las palabras pueden ir separadas por espacios o
 * guiones ("pe-de-efe"). `null` si no hay secuencias.
 *
 * @type {RegExp|null}
 */
const RE_COMIENZO_DE_SECUENCIA = FORMAS_DICHAS.length
  ? new RegExp(
      '\\b(?:' +
        FORMAS_DICHAS.map(function (forma) {
          return forma[0].replace(/ /g, '[\\s-]+')
        }).join('|') +
        ')\\b',
      'i'
    )
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
  /** Raíz ya calculada antes, si estaba. */
  let hecha = RAICES_CALCULADAS.get(palabra)
  if (hecha === undefined) {
    hecha = calcular_raiz(palabra)
    if (RAICES_CALCULADAS.size >= LIMITE_DE_RAICES_CALCULADAS) {
      RAICES_CALCULADAS.clear()
    }
    RAICES_CALCULADAS.set(palabra, hecha)
  }
  return hecha
}

/**
 * Raíces ya calculadas (palabra → raíz). El vocabulario de la página casi no cambia entre el armado con el
 * catálogo y el rearmado con el índice, y calcular las ~3.500 raíces cuesta una buena parte del armado. Si
 * crece de más se vacía.
 *
 * @type {Map<string, string>}
 */
const RAICES_CALCULADAS = new Map()

/** Cuántas raíces guarda `RAICES_CALCULADAS` antes de vaciarse. */
const LIMITE_DE_RAICES_CALCULADAS = 30000

/** `RAICES_APARTE` como mapa: con un objeto, "constructor" o "toString" se tomarían por una raíz propia. */
const MAPA_DE_RAICES_APARTE = new Map(Object.entries(RAICES_APARTE))

/** `RAICES_IRREGULARES` como mapa. */
const MAPA_DE_RAICES_IRREGULARES = new Map(Object.entries(RAICES_IRREGULARES))

/**
 * Hace el trabajo de `raiz` (sin la memoria).
 *
 * @param {string} palabra Palabra en minúsculas y sin acentos.
 * @returns {string}
 */
function calcular_raiz(palabra) {
  /** La raíz que sale de las reglas generales. */
  const regular = calcular_raiz_regular(palabra)
  return MAPA_DE_RAICES_IRREGULARES.get(regular) || regular
}

/**
 * La raíz que sacan las reglas generales, antes de mirar la tabla de verbos irregulares.
 *
 * @param {string} palabra Palabra en minúsculas y sin acentos.
 * @returns {string}
 */
function calcular_raiz_regular(palabra) {
  if (MAPA_DE_RAICES_APARTE.has(palabra)) {
    return MAPA_DE_RAICES_APARTE.get(palabra)
  }
  /** Lo que va quedando de la palabra. */
  let r = palabra
  if (r.length <= 3) {
    return r
  }
  /** Lo que queda sin el pronombre pegado al final, si lo tiene. */
  const pegado = RE_INFINITIVO_CON_PRONOMBRE.exec(r) || RE_IMPERATIVO_CON_PRONOMBRE.exec(r)
  if (pegado) {
    r = pegado[1] || pegado[2]
  }
  /** true si la palabra terminaba en una forma conjugada con "s" o "n" propia, que ya se sacó. */
  let conjugada = false
  for (let i = 0; i < FORMAS_CONJUGADAS.length; i++) {
    /** Terminación que se prueba. */
    const f = FORMAS_CONJUGADAS[i]
    if (r.endsWith(f) && r.length - f.length >= 3) {
      r = r.slice(0, -f.length)
      conjugada = true
      break
    }
  }
  if (!conjugada) {
    // Plural: "-es" detrás de consonante ("dolares", "papeles") o "-s" ("cheques", "ventas").
    if (r.length > 4 && r.endsWith('es') && VOCALES.indexOf(r[r.length - 3]) === -1) {
      r = r.slice(0, -2)
    } else if (r.length > 3 && r.endsWith('s') && !r.endsWith('ss')) {
      r = r.slice(0, -1)
    }
    for (let i = 0; i < TERMINACIONES.length; i++) {
      /** Terminación que se prueba y cuántas letras tienen que quedar. */
      const t = TERMINACIONES[i][0]
      if (r.endsWith(t) && r.length - t.length >= TERMINACIONES[i][1]) {
        r = r.slice(0, -t.length)
        break
      }
    }
  }
  // Las vocales del final ("escane" → "escan"): así "escaneo" y "escanear" llegan al mismo lugar.
  while (r.length > 3 && VOCALES.indexOf(r[r.length - 1]) !== -1) {
    r = r.slice(0, -1)
  }
  // Ortografía: "busque" y "buscar", "empiece" y "empezar" tienen la misma raíz con otra letra al final. Con
  // raíces de 4 letras o más: "arqueo" (arq-) y "arca" (arc-) no son el mismo verbo, y con tres letras no hay forma
  // de saberlo. Los verbos cortos que sí cambian (tocar/toque, sacar/saque) están en `RAICES_IRREGULARES`.
  if (r.endsWith('q') && r.length > 3) {
    r = r.slice(0, -1) + 'c'
  } else if (r.endsWith('z') && r.length > 3) {
    r = r.slice(0, -1) + 'c'
  }
  return r
}

/**
 * A qué clase de formas pertenece una palabra en el vocabulario: su raíz, salvo las palabras de relleno, que no
 * se juntan con nadie. "estado" (30 videos, "Estado de resultados") tiene la misma raíz que "esta", "estas" y
 * "este" (relleno, dichas en 359 videos), y quien escribía "estado" recibía el catálogo entero; "masa" y "más",
 * "trae" y "tras", "uno" y "unos" eran lo mismo. Una palabra de relleno no cuenta para la rareza ni para las
 * formas de las demás.
 *
 * @param {string} palabra Palabra normalizada.
 * @returns {string}
 */
function clase_de(palabra) {
  return PALABRAS_DE_RELLENO.has(palabra) ? palabra + '#' : raiz(palabra)
}

/**
 * `EQUIVALENCIAS_DE_LA_CONSULTA` indexadas por la raíz de lo que se escribe: raíz → { a, con } con las raíces de
 * `con` ya calculadas (o `null` si valen siempre).
 */
const EQUIVALENCIAS_POR_RAIZ = new Map()
EQUIVALENCIAS_DE_LA_CONSULTA.forEach(function (equivalencia) {
  equivalencia.de.forEach(function (palabra) {
    /** Raíz de lo que se escribe. */
    const clave = raiz(palabra)
    if (!EQUIVALENCIAS_POR_RAIZ.has(clave)) {
      EQUIVALENCIAS_POR_RAIZ.set(clave, [])
    }
    EQUIVALENCIAS_POR_RAIZ.get(clave).push({ a: equivalencia.a, con: equivalencia.con ? equivalencia.con.map(raiz) : null })
  })
})

/**
 * Grupos de sinónimos indexados por la RAÍZ de cada palabra: raíz → números de grupo. Se arma una vez. Se busca
 * solo por raíz, nunca por la palabra escrita: si no, "cargara" (que tiene la raíz "cargar") caía en el grupo
 * de "cargar", e "inventar" en el de "inventario", porque esa raíz se escribe igual que la palabra de la lista.
 */
const GRUPOS_POR_CLAVE = new Map()
GRUPOS_DE_SINONIMOS.forEach(function (grupo, numero) {
  grupo.forEach(function (palabra) {
    /** Raíz de la palabra del grupo. */
    const clave = raiz(palabra)
    if (!GRUPOS_POR_CLAVE.has(clave)) {
      GRUPOS_POR_CLAVE.set(clave, [])
    }
    if (GRUPOS_POR_CLAVE.get(clave).indexOf(numero) === -1) {
      GRUPOS_POR_CLAVE.get(clave).push(numero)
    }
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
  /** Si la palabra en curso tiene alguna mayúscula ASCII, o alguna letra con acento (u otra no ASCII). */
  let mayuscula = false
  let acento = false
  // Se recorre carácter por carácter en lugar de usar una expresión regular: es lo mismo (letras y
  // números seguidos), pero arma las 75.000 palabras de los guiones en la mitad del tiempo. Y como la
  // gran mayoría ya viene en minúscula y sin acentos, esas ni pasan por la normalización; las que solo
  // tienen mayúsculas se resuelven con `toLowerCase` y solo las acentuadas con `normalizar`.
  for (let i = 0; i <= largo; i++) {
    /** Si el carácter es parte de una palabra (el carácter "de después del final" no lo es). */
    let dentro = false
    if (i < largo) {
      /** Carácter, y qué se sabe de él si es de los más comunes. */
      const c = texto.charCodeAt(i)
      /** Lo que dice la tabla: 0 = no se calculó todavía, 1 = es de palabra, 2 = no lo es. */
      const t = c < LARGO_DE_LA_TABLA_DE_LETRAS ? TABLA_DE_LETRAS[c] : 0
      dentro = t ? t === 1 : es_letra_o_numero(c)
      if (c > 127) {
        acento = true
      } else if (c < 97 && c > 57) {
        mayuscula = true
      }
    }
    if (dentro) {
      if (desde < 0) {
        desde = i
      }
    } else if (desde >= 0) {
      /** La palabra tal como está escrita, y normalizada. */
      const cruda = texto.slice(desde, i)
      const normal = acento ? normalizar_palabra(cruda) : mayuscula ? cruda.toLowerCase() : cruda
      // Una marca combinable suelta no es una palabra: normalizada queda vacía.
      if (normal) {
        pal.push(normal)
        ini[cuantas] = desde
        fin[cuantas++] = i
      }
      desde = -1
      mayuscula = false
      acento = false
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
 * Palabras ya separadas de los textos cortos (título, carpeta, "para qué", "cuándo no"): texto → resultado
 * de `tokenizar`. El buscador se arma dos veces seguidas (con el catálogo y después con el índice) y esos
 * textos no cambian entre una y otra: se separan una sola vez. El guion no entra: solo existe en el
 * segundo armado y es lo que más pesa en memoria. Si crece de más se vacía.
 *
 * @type {Map<string, { pal: Array<string>, ini: Int32Array, fin: Int32Array }>}
 */
const TEXTOS_SEPARADOS = new Map()

/** Cuántos textos guarda `TEXTOS_SEPARADOS` antes de vaciarse. */
const LIMITE_DE_TEXTOS_SEPARADOS = 6000

/**
 * `tokenizar` con la memoria de `TEXTOS_SEPARADOS`. El resultado se comparte entre buscadores, así que
 * quien lo recibe no puede modificarlo.
 *
 * @param {string} texto
 * @param {boolean} recordar false para no guardar el resultado (el guion).
 * @returns {{ pal: Array<string>, ini: Int32Array, fin: Int32Array }}
 */
function tokenizar_con_memoria(texto, recordar) {
  /** Resultado de una vez anterior, si hay. */
  let hecho = recordar ? TEXTOS_SEPARADOS.get(texto) : undefined
  if (hecho === undefined) {
    hecho = tokenizar(texto)
    if (recordar) {
      if (TEXTOS_SEPARADOS.size >= LIMITE_DE_TEXTOS_SEPARADOS) {
        TEXTOS_SEPARADOS.clear()
      }
      TEXTOS_SEPARADOS.set(texto, hecho)
    }
  }
  return hecho
}

/**
 * Indica si dos palabras difieren en una sola letra: una cambiada, una de más, una de menos o dos
 * intercambiadas de lugar. No acepta una letra inicial CAMBIADA por otra (los errores de tipeo casi nunca
 * están ahí; la excepción es la confusión b/v, que sí es frecuente) para no traer palabras sin parentesco.
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
  // Una letra cambiada en la primera posición casi nunca es un error de tipeo (salvo b/v); una de más o de
  // menos al principio sí ("estock").
  if (i === 0 && la === lb && !(a[0] + b[0] === 'bv' || a[0] + b[0] === 'vb')) {
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
 * @param {*} x
 * @returns {boolean} true si es un objeto (no `null`, no un texto ni un número).
 */
function es_un_objeto(x) {
  return x !== null && typeof x === 'object'
}

/**
 * @param {*} buscador Lo que se pasa como buscador.
 * @returns {boolean} true si tiene la forma de lo que devuelve `crear_buscador`.
 */
function es_un_buscador(buscador) {
  return (
    es_un_objeto(buscador) &&
    Array.isArray(buscador.docs) &&
    buscador.vocab instanceof Map &&
    buscador.por_raiz instanceof Map &&
    buscador.por_numero instanceof Map &&
    Array.isArray(buscador.amplitud)
  )
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
  /** Videos válidos (lo que no sea un objeto, un `null` por ejemplo, se salta). */
  const lista = (Array.isArray(videos) ? videos : []).filter(es_un_objeto)
  /** Nombre de cada carpeta por número. */
  const nombres_de_carpeta = {}
  ;(Array.isArray(carpetas) ? carpetas : []).filter(es_un_objeto).forEach(function (c) {
    nombres_de_carpeta[c.nro] = c.nombre
  })
  /** Vocabulario: palabra normalizada → { palabra, raiz, df, idf, idf_exacta, docs, masc, sello }. */
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
      const tk = textos[c] ? tokenizar_con_memoria(textos[c], c !== CAMPO_VOZ) : { pal: [], ini: [], fin: [] }
      doc.pal.push(tk.pal)
      doc.ini.push(tk.ini)
      doc.fin.push(tk.fin)
      for (let k = 0; k < tk.pal.length; k++) {
        /** Entrada del vocabulario, creada la primera vez que aparece la palabra. */
        let e = vocab.get(tk.pal[k])
        if (!e) {
          e = { palabra: tk.pal[k], raiz: clase_de(tk.pal[k]), df: [0, 0, 0, 0, 0], idf: null, idf_exacta: null, docs: [], masc: [], sello: -1 }
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
  /**
   * Lo rara que es una palabra que aparece en `d` videos de un campo: `ln(1 + N / d)`; 0 si no aparece.
   *
   * @param {number} d
   * @returns {number}
   */
  const rareza_de = function (d) {
    return d ? Math.log(1 + total / d) : 0
  }
  /** Qué parte de los videos cubre cada grupo de sinónimos (0 a 1), para `factor_de_amplitud`. */
  const amplitud = []
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
  // le ganaba a la palabra exacta que se escribió, que es la más común. La excepción es la palabra tal cual
  // se escribió: "cargaron" (dicha en un solo video) encuentra ese video por encima de los otros 200 que
  // dicen "cargar" o "carga", así que la forma exacta conserva su propia rareza (`idf_exacta`).
  /** Videos donde aparece alguna forma de la raíz, por campo (máscara de bits), para unir las formas. */
  const mascaras = new Uint8Array(total)
  por_raiz.forEach(function (entradas) {
    /** Videos con alguna forma, contados por campo. */
    let df = entradas[0].df
    if (entradas.length > 1) {
      df = [0, 0, 0, 0, 0]
      mascaras.fill(0)
      entradas.forEach(function (e) {
        for (let k = 0; k < e.docs.length; k++) {
          mascaras[e.docs[k]] |= e.masc[k]
        }
      })
      for (let d = 0; d < total; d++) {
        for (let c = 0; c < CANTIDAD_CAMPOS && mascaras[d]; c++) {
          if (mascaras[d] & (1 << c)) {
            df[c]++
          }
        }
      }
    }
    /** Rareza por campo, compartida por todas las formas de la raíz. */
    const idf = df.map(rareza_de)
    entradas.forEach(function (e) {
      e.idf = idf
      e.idf_exacta = e.df.map(rareza_de)
    })
  })
  // Los sinónimos comparten la rareza del grupo entero. Sin esto, "producto" (que solo dicen 2 títulos) pesaba el
  // doble que "artículo" (43 títulos) aunque sea el mismo tema, y "productos más vendidos" iba a "Agregar
  // productos con el lector" en lugar de al reporte de Artículos. El grupo cuenta los videos donde aparece
  // cualquiera de sus palabras; la rareza de una palabra nunca sube por pertenecer a un grupo.
  GRUPOS_DE_SINONIMOS.forEach(function (grupo, numero_de_grupo) {
    /** Entradas del vocabulario de todas las palabras del grupo. */
    const entradas = []
    grupo
      .map(raiz)
      .filter(function (r, i, todas) {
        return todas.indexOf(r) === i
      })
      .forEach(function (r) {
        entradas.push.apply(entradas, por_raiz.get(r) || [])
      })
    if (!entradas.length) {
      return
    }
    mascaras.fill(0)
    entradas.forEach(function (e) {
      for (let k = 0; k < e.docs.length; k++) {
        mascaras[e.docs[k]] |= e.masc[k]
      }
    })
    /** Videos del grupo por campo y rareza que sale de ahí. */
    const df = [0, 0, 0, 0, 0]
    /** En cuántos videos aparece alguna palabra del grupo. */
    let en_alguno = 0
    for (let d = 0; d < total; d++) {
      if (mascaras[d]) {
        en_alguno++
      }
      for (let c = 0; c < CANTIDAD_CAMPOS && mascaras[d]; c++) {
        if (mascaras[d] & (1 << c)) {
          df[c]++
        }
      }
    }
    amplitud[numero_de_grupo] = en_alguno / total
    /** Rareza del grupo por campo, y cada entrada se queda con la menor entre la suya y la del grupo. */
    const del_grupo = df.map(rareza_de)
    /**
     * @param {number} rareza La rareza propia de la entrada en un campo.
     * @param {number} c Campo.
     * @returns {number}
     */
    const tope = function (rareza, c) {
      return df[c] ? Math.min(rareza, del_grupo[c]) : rareza
    }
    entradas.forEach(function (e) {
      e.idf = e.idf.map(tope)
      e.idf_exacta = e.idf_exacta.map(tope)
    })
  })
  return { docs: docs, vocab: vocab, por_raiz: por_raiz, por_numero: por_numero, amplitud: amplitud }
}

/**
 * Cuánto vale un sinónimo según lo común que sea su grupo. Un grupo que está en pocos videos dice mucho (1). Uno
 * que aparece en más del `AMPLITUD_SIN_DESCUENTO` de los videos ("alta / crear / agregar / cargar / registrar":
 * 75 %) dice poco: el aporte baja hasta `FACTOR_MINIMO_DE_AMPLITUD`, sin llegar a cero.
 *
 * @param {number} cobertura Qué parte de los videos cubre el grupo (0 a 1).
 * @returns {number} Entre `FACTOR_MINIMO_DE_AMPLITUD` y 1.
 */
function factor_de_amplitud(cobertura) {
  if (cobertura <= AMPLITUD_SIN_DESCUENTO) {
    return 1
  }
  return Math.max(FACTOR_MINIMO_DE_AMPLITUD, (1 - cobertura) / (1 - AMPLITUD_SIN_DESCUENTO))
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
 * Lo rara que es la palabra de una entrada en un campo, para una coincidencia: la palabra tal cual se
 * escribió usa su propia rareza; las otras formas, los sinónimos y lo demás, la de su raíz o su grupo.
 *
 * @param {Object} entrada Entrada del vocabulario.
 * @param {number} campo Número de campo.
 * @param {number} puntos Qué tan directa es la coincidencia (`PUNTOS`).
 * @returns {number}
 */
function rareza_de_la_coincidencia(entrada, campo, puntos) {
  return (puntos >= PUNTOS.directa ? entrada.idf_exacta : entrada.idf)[campo]
}

/**
 * Indica si dos palabras que tienen la misma raíz son de verdad formas de lo mismo: empiezan igual en las tres
 * primeras letras, o alguna es de un verbo irregular (muestra y mostrar no empiezan igual y son parientes). Es
 * la defensa contra un parentesco falso de las reglas generales: "arqueo" y "arca" llegaron a tener la misma
 * raíz, y quien escribía "arqueo" encontraba antes los 4 videos de ARCA que los 3 que dicen "arqueo".
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function son_parientes(a, b) {
  /** Cuántas letras iniciales tienen en común. */
  let i = 0
  while (i < LARGO_MINIMO_DE_PARENTESCO && a[i] !== undefined && a[i] === b[i]) {
    i++
  }
  return (
    i >= LARGO_MINIMO_DE_PARENTESCO ||
    MAPA_DE_RAICES_IRREGULARES.has(calcular_raiz_regular(a)) ||
    MAPA_DE_RAICES_IRREGULARES.has(calcular_raiz_regular(b))
  )
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
      if (e !== exacta && son_parientes(palabra, e.palabra)) {
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
 * @param {Array<string>} consulta Todas las palabras que se buscan (para las equivalencias que valen en compañía).
 * @returns {Map<Object, number>} Entradas del vocabulario → qué tan directa es cada una. Vacío si no hay nada.
 */
function resolver_palabra(b, palabra, consulta) {
  /** Resultado. */
  const mapa = new Map()
  anotar_formas(b, mapa, palabra, PUNTOS.directa)

  // Cifras que el guion dice en letras.
  /** Cómo se dice el número, si es un número. */
  const dicho = numero_en_letras(palabra)
  if (dicho) {
    anotar_formas(b, mapa, dicho, PUNTOS.numero)
  }

  // Sinónimos: los de la palabra y los de su raíz. Pesan igual de raros que ella (ver `crear_buscador`). Un grupo
  // que cubre buena parte de los videos aporta menos (ver `factor_de_amplitud`).
  ;(GRUPOS_POR_CLAVE.get(raiz(palabra)) || []).forEach(function (numero) {
    /** Puntos de un sinónimo de este grupo. */
    const puntos = PUNTOS.sinonimo * factor_de_amplitud(b.amplitud[numero] || 0)
    GRUPOS_DE_SINONIMOS[numero].forEach(function (otra) {
      if (otra !== palabra && raiz(otra) !== raiz(palabra)) {
        anotar_formas(b, mapa, otra, puntos)
      }
    })
  })
  // Equivalencias de un solo sentido: lo escrito busca también lo que dicen los videos.
  ;(EQUIVALENCIAS_POR_RAIZ.get(raiz(palabra)) || []).forEach(function (equivalencia) {
    if (
      !equivalencia.con ||
      consulta.some(function (otra) {
        return otra !== palabra && equivalencia.con.indexOf(raiz(otra)) !== -1
      })
    ) {
      equivalencia.a.forEach(function (otra) {
        anotar_formas(b, mapa, otra, PUNTOS.sinonimo)
      })
    }
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
 * del "para qué", del guion o del "cuándo no" (a igual cantidad de palabras, gana el que más pesa: el
 * "para qué", que está escrito para leerse). El guion y el "cuándo no" son parte de la transcripción del
 * índice, así que se informan como `transcripcion`. Si la coincidencia fue solo en el título o en la
 * carpeta, muestra el comienzo del "para qué" sin marcas.
 *
 * @param {Object} doc Registro del video.
 * @param {Array<Array<{ k: number, i: number, valor: number }>>} eventos Coincidencias por campo.
 * @returns {{ partes: Array<{ texto: string, marca: boolean }>, de: string }}
 */
function elegir_fragmento(doc, eventos) {
  /** Mejor candidato: { campo, desde, hasta, palabras, valor }. */
  let mejor = null
  ;[CAMPO_PARA_QUE, CAMPO_VOZ, CAMPO_NO_SIRVE].forEach(function (c) {
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
    return { partes: partes, de: mejor.campo === CAMPO_PARA_QUE ? 'para_que' : 'transcripcion' }
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
 * - `completo: true`: el mejor resultado tiene TODAS las palabras de la consulta (o la consulta es un
 *   código de video), y lo que encontró no es solo una mención de pasada en el guion de palabras tan
 *   comunes que juntas dicen poco (ver `INFORMACION_MINIMA`). Los videos que también las tienen todas
 *   siempre se listan; los que cubren solo parte, si su puntaje no quedó lejos del mejor.
 * - `completo: false`: el mejor no cubre todo, o alguna palabra no existe en ningún video, o es una
 *   coincidencia floja. La página muestra el aviso "los que más se parecen". Los resultados son los que
 *   cubren la mayor parte de la consulta, con un máximo, y nunca menos de `CANDIDATOS_MINIMOS` si hay tantos
 *   que cubran algo (el umbral de cobertura baja de a pasos hasta juntarlos). Con una sola palabra: o hay videos
 *   o no hay nada.
 *
 * @param {Object} buscador Lo que devolvió `crear_buscador`.
 * @param {string} consulta Lo que escribió la persona.
 * @returns {{
 *   resultados: Array<{
 *     codigo: string,
 *     puntaje: number,
 *     titulo_partes: Array<{ texto: string, marca: boolean }>,
 *     ubicacion_partes: Array<{ texto: string, marca: boolean }>,
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
  if (!es_un_buscador(buscador) || !buscador.docs.length) {
    return vacio
  }
  /** Lo escrito, sin espacios de más y sin pasarse del largo que tiene sentido (alguien pega un párrafo o un archivo). */
  const texto = String(consulta == null ? '' : consulta)
    .trim()
    .slice(0, MAXIMO_DE_CARACTERES)
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
          ubicacion_partes: doc.textos[CAMPO_UBICACION] ? [{ texto: doc.textos[CAMPO_UBICACION], marca: false }] : [],
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
  /** Palabras ya vistas, para no repetirlas. */
  const vistas = new Set()
  /** Palabras sin repetir. */
  const distintas = escritas.filter(function (p) {
    if (vistas.has(p)) {
      return false
    }
    vistas.add(p)
    return true
  })
  /** Palabras sin el relleno; si todas lo son, se buscan tal cual. */
  const sin_relleno = distintas.filter(function (p) {
    return !PALABRAS_DE_RELLENO.has(p)
  })
  /** Palabras que se buscan (si alguien pega un párrafo se usan las primeras: más no cambian el resultado y cuestan). */
  const palabras = (sin_relleno.length ? sin_relleno : distintas).slice(0, MAXIMO_DE_PALABRAS)
  /** Cantidad de palabras y de videos. */
  const n = palabras.length
  const total = buscador.docs.length

  /** Para cada palabra, qué entradas del vocabulario le sirven y con cuántos puntos. */
  const mapas = palabras.map(function (p) {
    return resolver_palabra(buscador, p, palabras)
  })
  /** Tope de rareza de cada palabra: una letra suelta que no es un dígito no puede ser "rara". */
  const topes = palabras.map(function (p) {
    return p.length === 1 && !/\d/.test(p) ? TOPE_DE_RAREZA_DE_UNA_LETRA : Infinity
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
            const v = PESO_DE_CAMPO[c] * Math.min(rareza_de_la_coincidencia(e, c, puntos), topes[i]) * puntos
            if (v > valores[i * total + d]) {
              valores[i * total + d] = v
            }
          }
        }
      }
    })
  })
  // Cobertura ponderada por rareza. Cada palabra de la consulta pesa lo rara que es (`ln(1 + N / videos que la
  // tienen)`): cubrir "escanear" vale más que cubrir "compra". La cobertura de un video es el peso de las
  // palabras que tiene sobre el peso de todas. Una palabra que no está en NINGÚN video ("electrónica" en el
  // centro de recursos) no se puede exigir: no pesa, y la respuesta avisa que no todas estuvieron.
  /** Peso de cada palabra y suma de los pesos; las que no existen en ningún video pesan 0. */
  const pesos = new Float64Array(n)
  let suma_de_pesos = 0
  let buscables = 0
  for (let i = 0; i < n; i++) {
    /** En cuántos videos está la palabra (por cualquiera de sus formas). */
    let en_cuantos = 0
    for (let d = 0; d < total; d++) {
      if (valores[i * total + d] > 0) {
        en_cuantos++
      }
    }
    if (en_cuantos) {
      pesos[i] = Math.min(Math.log(1 + total / en_cuantos), topes[i] === Infinity ? Infinity : TOPE_DE_PESO_DE_UNA_LETRA)
      suma_de_pesos += pesos[i]
      buscables++
    }
  }
  if (!buscables) {
    return { resultados: [], completo: true, palabras: palabras }
  }
  /** Cobertura de cada video (0 a 1) y valor previo para quedarse con los mejores parciales. */
  const cobertura = new Float64Array(total)
  /** Valor previo de cada video: lo que suman sus palabras por el multiplicador de cobertura. */
  const previos = new Float64Array(total)
  for (let d = 0; d < total; d++) {
    let cubierto = 0
    let valor = 0
    for (let i = 0; i < n; i++) {
      if (valores[i * total + d] > 0) {
        cubierto += pesos[i]
        valor += valores[i * total + d]
      }
    }
    cobertura[d] = cubierto / suma_de_pesos
    previos[d] = valor * Math.pow(cobertura[d], EXPONENTE_DE_COBERTURA)
  }
  // Umbral adaptativo: con una pregunta larga en la que falta una palabra rara, el 0,5 deja casi vacío. Si con el
  // umbral actual no llegan a `CANDIDATOS_MINIMOS`, se baja de a pasos hasta juntarlos o llegar al último.
  /** Umbral de cobertura con el que se eligen los videos. */
  let umbral = UMBRALES_DE_COBERTURA[0]
  for (let u = 0; u < UMBRALES_DE_COBERTURA.length; u++) {
    umbral = UMBRALES_DE_COBERTURA[u]
    let cuantos = 0
    for (let d = 0; d < total && cuantos < CANDIDATOS_MINIMOS; d++) {
      if (cobertura[d] >= umbral - 1e-9) {
        cuantos++
      }
    }
    if (cuantos >= CANDIDATOS_MINIMOS) {
      break
    }
  }
  /** Videos que cubren todo y videos que cubren bastante pero no todo, con su valor previo. */
  const enteros = []
  const parciales = []
  for (let d = 0; d < total; d++) {
    if (cobertura[d] >= 1 - 1e-9) {
      enteros.push(d)
    } else if (cobertura[d] >= umbral - 1e-9) {
      parciales.push({ d: d, previo: previos[d] })
    }
  }
  // Los parciales son muchos cuando la consulta es larga: se leen los textos solo de los mejores.
  parciales.sort(function (a, b) {
    return b.previo - a.previo
  })
  /** Videos que se leen en la etapa 2. */
  const elegidos = enteros.concat(
    parciales.slice(0, MAXIMO_PARCIALES + 20).map(function (x) {
      return x.d
    })
  )
  if (!elegidos.length) {
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
          const valor = PESO_DE_CAMPO[c] * Math.min(rareza_de_la_coincidencia(sirve[s].e, c, sirve[s].puntos), topes[sirve[s].i]) * sirve[s].puntos
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
    /** true si en algún campo hay palabras de la consulta pegadas ("hasta seis páginas"), no desparramadas. */
    let junto = false
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
        junto = junto || presentes / ventana >= CERCANIA_MINIMA
      }
    }
    /** Fragmento y título marcados. */
    const fragmento = elegir_fragmento(doc, eventos)
    /** Título y carpeta con sección, completos, con las palabras encontradas marcadas. */
    const titulo = doc.textos[CAMPO_TITULO]
    const ubicacion = doc.textos[CAMPO_UBICACION]
    // Un video que cubre casi todo con la palabra rara en el título le gana a uno que cubre todo con menciones sueltas.
    puntaje *= Math.pow(cobertura[d], EXPONENTE_DE_COBERTURA)
    // Si alguna palabra está en el título, la carpeta o el "para qué" (y no solo "de pasada" en el guion).
    let fuerte = false
    for (let i = 0; i < n; i++) {
      fuerte =
        fuerte ||
        mejor_valor[i * CANTIDAD_CAMPOS + CAMPO_TITULO] > 0 ||
        mejor_valor[i * CANTIDAD_CAMPOS + CAMPO_UBICACION] > 0 ||
        mejor_valor[i * CANTIDAD_CAMPOS + CAMPO_PARA_QUE] > 0
    }
    resultados.push({
      codigo: doc.codigo,
      puntaje: Math.round(puntaje * 100) / 100,
      cobertura: cobertura[d],
      fuerte: fuerte,
      junto: junto,
      titulo_partes: partir_en_marcas(titulo, doc.ini[CAMPO_TITULO], doc.fin[CAMPO_TITULO], eventos[CAMPO_TITULO], 0, titulo.length),
      ubicacion_partes: partir_en_marcas(ubicacion, doc.ini[CAMPO_UBICACION], doc.fin[CAMPO_UBICACION], eventos[CAMPO_UBICACION], 0, ubicacion.length),
      fragmento_partes: fragmento.partes,
      fragmento_de: fragmento.de,
      orden: d,
    })
  })
  resultados.sort(function (a, b) {
    return b.puntaje - a.puntaje || a.orden - b.orden
  })
  // Piso de relevancia: con dos palabras o más, si lo que encontró el mejor video está solo de pasada en el guion
  // y las palabras son tan comunes que todas juntas dicen poco (suman menos de `INFORMACION_MINIMA`), no hay
  // un video sobre eso: se avisa como "los que más se parecen". Una palabra rara dicha solo en la voz
  // ("balanza" en un video) pesa más que ese mínimo y sigue siendo un resultado completo.
  const debil = n >= 2 && !resultados[0].fuerte && !resultados[0].junto && resultados[0].cobertura * suma_de_pesos < INFORMACION_MINIMA
  /** true si el mejor video cubre todas las palabras de la consulta, ninguna faltó en el centro entero y no es una coincidencia floja. */
  const completo = buscables === n && resultados[0].cobertura >= 1 - 1e-9 && !debil
  // Los videos que cubren todo se muestran siempre; los que cubren solo parte, si no quedaron lejos del mejor
  // (o si todavía no hay `CANDIDATOS_MINIMOS` en la lista) y hasta un máximo.
  /** Cuántos parciales entraron y cuántos resultados lleva la lista. */
  let parciales_mostrados = 0
  let en_lista = 0
  const lista = resultados.filter(function (x) {
    /** Si entra en la lista. */
    const entra =
      x.cobertura >= 1 - 1e-9 ||
      ((x.puntaje >= PISO_PARCIALES * resultados[0].puntaje || en_lista < CANDIDATOS_MINIMOS) && parciales_mostrados++ < MAXIMO_PARCIALES)
    if (entra) {
      en_lista++
    }
    return entra
  })
  lista.forEach(function (x) {
    delete x.orden
    delete x.cobertura
    delete x.fuerte
    delete x.junto
  })
  return { resultados: lista, completo: completo, palabras: palabras }
}
