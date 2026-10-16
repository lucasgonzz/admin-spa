/**
 * Datos del buscador del centro de recursos (`buscador.js`): las palabras que se ignoran y las que
 * se tratan como equivalentes. Son DATOS, sin lógica, y están armados mirando el vocabulario real
 * de los 364 videos (títulos y guiones de voz, fotos de producción del 16/10/2026), no inventados:
 * cada grupo dice abajo qué vocabulario del corpus lo justifica.
 *
 * Todo va sin acentos ni mayúsculas, porque el buscador compara texto ya pasado por `normalizar`.
 * Para sumar un grupo: que haya al menos una palabra en el corpus (si no, no hay nada que encontrar)
 * y que la gente la diga o la escriba en lugar de la del sistema. Un sinónimo siempre vale menos
 * que la palabra directa (ver `PUNTOS` en `buscador.js`), así que un grupo de más no rompe un
 * orden: a lo sumo agrega resultados al final.
 */

/**
 * Palabras que no dicen nada sobre QUÉ se busca y que una pregunta en lenguaje natural trae de
 * relleno: artículos, preposiciones, conjunciones, pronombres, interrogativos y los verbos que se
 * usan para pedir ayuda ("cómo hago para…", "quiero…", "necesito…"). Con ellas fuera,
 * "cómo escanear una foto de la factura en una compra" anda igual que "escanear foto factura compra".
 *
 * Es una cadena separada por espacios (y no un arreglo) para que pese poco en el bundle: la página
 * ocupa ~62 kB y esto se baja en cada visita.
 *
 * Faltan a propósito "sistema", "reportes", "barra" e "izquierda": salen en casi todos los guiones (el
 * arranque "Al entrar al sistema estás en Reportes. Desplegá la barra de la izquierda…" se repite en
 * cada video), pero el buscador ya les da muy poco peso solo, porque calcula lo rara que es cada palabra
 * campo por campo. Y alguien que escribe "reportes" tiene que encontrar los videos de la carpeta
 * Reportes por su título: si fueran relleno, no encontraría nada.
 *
 * "Sin" NO está: es lo que distingue "ventas sin factura" de "ventas" y "vender sin internet" de "vender" (21
 * títulos, 184 guiones). Pesa poco por ser común, y la cercanía premia al video que dice justo "sin factura".
 * "No" sí está: se probó sacarlo y no cambió ningún resultado.
 *
 * Si TODAS las palabras de la consulta están acá, el buscador las busca tal cual (no se queda sin
 * nada que buscar: "para qué sirve" sigue buscando).
 *
 * @type {Set<string>}
 */
export const PALABRAS_DE_RELLENO = new Set(
  (
    // artículos, preposiciones y conjunciones
    'a al ante con contra de del desde e el en entre hacia hasta la las le les lo los o para pero por ' +
    'porque pues que se segun sobre su sus tras u un una unas unos y ya ' +
    // pronombres, demostrativos y posesivos
    'me mi mis nos te ti tu tus vos yo ella ello ellos esa ese eso esas esos esta este esto estas estos ' +
    'aquel aquella aquello algo alguien nada nadie ' +
    // interrogativos y adverbios sueltos
    'como cual cuales cuando cuanto cuanta cuantos cuantas donde quien quienes que si no mas muy tan ' +
    'tambien ademas aca aqui ahi alla asi aun todavia entonces ' +
    // todo/toda: "todos los clientes" no pide que aparezca la palabra "todos"
    'todo toda todos todas ' +
    // ser, estar, haber, tener, hacer, poder, querer, necesitar, saber: las formas con las que se pide ayuda
    'es son era fue ser soy sos estoy estas esta estan hay ha han he tengo tiene tienen tenes tener ' +
    'hago hace haces hacen hacer puedo puede pueden podes poder podria podrias quiero quiere quieren ' +
    'queres quisiera necesito necesita necesitan necesitas deberia voy va vas van ' +
    'sabes saber gustaria ' +
    // ver y usar: "cómo veo…", "dónde veo…", "cómo uso…" piden un tema, no la palabra "ver" ni "usar" (que
    // además abren casi todos los títulos y los "para qué": "Usalo cuando…", "Sirve para…")
    'ver veo ves vea usar uso usas sirve sirven ' +
    // "ayudame con…", "explicame…", "video de…": se pide un video, no se busca la palabra "video"
    'ayuda ayudame explica explicame muestra muestrame video videos tutorial tutoriales'
  ).split(' ')
)

/**
 * Grupos de palabras equivalentes. Si la consulta trae una, el buscador también acepta las otras del
 * grupo con menos puntaje (`PUNTOS.sinonimo`). Cada palabra se compara también por su raíz (forma
 * del verbo, plural), así que alcanza con anotar una forma: `borrar` cubre borra, borraste, borrarlo.
 *
 * Los comentarios dicen qué hay en el corpus: "N" es en cuántos de los 364 videos aparece la palabra o
 * alguna de sus formas (plural, verbo) en el título, el "para qué" o el guion, medido el 16/10/2026. Donde
 * una palabra tiene 0, no es un error: es lo que la gente ESCRIBE y los guiones no dicen, y es justo el
 * caso que el grupo existe para resolver.
 *
 * @type {Array<Array<string>>}
 */
export const GRUPOS_DE_SINONIMOS = [
  // El organismo se llama ARCA desde 2024 y los guiones solo dicen "ARCA" (29 videos; "afip" 0): el dueño
  // todavía dice "AFIP". ("Factura electrónica", que también es ARCA, está en `EQUIVALENCIAS_DE_LA_CONSULTA`:
  // "electrónica" suelta no es ARCA, "balanza electrónica" no tiene nada que ver.)
  ['arca', 'afip'],
  // El sistema llama "artículo" (171 videos) a lo que todo el mundo llama "producto" (70), y el guion dice
  // "mercadería" (35) cuando habla del stock que entra.
  ['articulo', 'producto', 'mercaderia'],
  // Los guiones hablan de "plata" (51, voz de la casa) y "efectivo" (26); la gente escribe "dinero" (0).
  ['plata', 'dinero', 'efectivo'],
  // Borrar (35), eliminar (18), quitar (5) y anular (6: "anularlo", un presupuesto) se usan para la misma
  // acción. "Sacar" (18) NO entra: también es "sacar un reporte" o "sacar plata", y metería ruido.
  ['borrar', 'eliminar', 'quitar', 'anular'],
  // "Subir los precios" es el "aumentar" (5) del título T1.44 ("aumentar, bajar o fijar un valor"); subir
  // (53) también es "subir una imagen", pero ahí la palabra directa gana por mucho.
  ['aumentar', 'subir', 'incrementar'],
  // El centro dice "foto" (35) e "imagen" (18) indistintamente; quien busca escribe una u otra.
  ['foto', 'imagen', 'fotografia'],
  // "Excel" (36) y "planilla" (6): el proveedor manda "una planilla" y el sistema importa "un Excel".
  ['excel', 'planilla'],
  // Contraseña (7) y clave (8) son lo mismo para quien no puede entrar; "password" (0) se escribe aunque
  // ningún guion lo diga.
  ['contrasena', 'clave', 'password'],
  // Imprimir (29), impresora (11) e impresión (8) no comparten raíz y son el mismo tema (tickets y etiquetas).
  ['imprimir', 'impresora', 'impresion'],
  // "Ganancia" (19) lo dice el sistema, "cuánto gano" y "utilidad" (1) lo dice el dueño; "ganar" suma las
  // formas del verbo (gana, ganaste: 17 videos) que no comparten raíz con "ganancia".
  ['ganancia', 'ganar', 'utilidad', 'rentabilidad'],
  // Lo que un cliente "debe" (debe 33, deben 7) es su "deuda" (23) o su "saldo" (36); "deudor" (3).
  ['deuda', 'saldo', 'debe', 'deben', 'deudor'],
  // "Fiado" (6 videos: "fiarle", "fiar", "vendiste fiado") es cómo el comercio llama a la cuenta corriente
  // (72 videos dicen "corriente"); "fiar" y "fiarle" no comparten raíz con "fiado".
  ['fiado', 'fiar', 'fiarle', 'fiando', 'corriente'],
  // "En masa" (T1.44, T1.45, T1.47, 3 videos), "masiva" (actualización o disponibilidad masiva, 16) y "de una
  // vez" (arriba). "Muchos" (23) y "varios" (17) NO están acá: son palabras comunes y, dentro del grupo, le bajaban
  // la rareza a "masa" (ver `EQUIVALENCIAS_DE_LA_CONSULTA`).
  ['masa', 'masiva', 'lote'],
  // Lo que la tarjeta "liquida" (T6.2 "a liquidar", 6 videos) y "acredita" (T6.13 "días de acreditación", 6): cuándo
  // le llega la plata a quien cobra con tarjeta.
  ['liquidar', 'liquida', 'acreditar'],
  // Descuento (76) y bonificación (12): en compras la rebaja del proveedor se llama "bonificación".
  ['descuento', 'bonificacion', 'rebaja'],
  // Las acciones de dar de alta: crear (90), cargar (202), agregar (44), registrar (52), alta (22). Los
  // títulos dicen "Dar de alta un cliente" y quien busca escribe "agregar cliente" o "cargar cliente".
  ['alta', 'crear', 'agregar', 'cargar', 'registrar'],
  // El stock (68) y el "inventario" (5, es también un módulo): quien cuenta mercadería dice cualquiera.
  ['stock', 'inventario', 'existencias'],
  // Comprobante (43), ticket (19) y recibo (2 videos con la palabra tal cual; su raíz arrastra "recibir" y
  // "recibido", 32): lo que se le da al cliente. Factura y remito NO entran: son documentos distintos con
  // sus propios videos.
  ['comprobante', 'ticket', 'recibo', 'tiquet'],
  // Devolución (13 videos) y devolver (11: devolvés, devolviste): la devolución de una compra se llama
  // "Devolverle mercadería a un proveedor" (T5.26) y quien busca escribe "devolución".
  ['devolucion', 'devolver'],
  // Cobro (88 con sus formas: cobrar, cobré) y cobranza (4) no comparten raíz.
  ['cobro', 'cobranza'],
  // Los guiones dicen "IA" (15) y "inteligencia artificial" (21); quien busca escribe cualquiera de las dos.
  ['ia', 'inteligencia'],
  // WhatsApp (23): las abreviaturas con las que se lo escribe a mano (0): ningún guion las usa.
  ['whatsapp', 'wpp', 'wsp', 'wasap', 'whats'],
]

/**
 * Equivalencias que valen en UN solo sentido: lo que la persona escribe (`de`) también busca lo que dicen los
 * videos (`a`), pero no al revés. Sirven para dos casos que un grupo de sinónimos hace mal:
 * - Palabras comunes que apuntan a una rara: quien escribe "muchos" o "varios" quiere el "en masa" / "masiva",
 *   pero quien escribe "masa" no quiere todos los videos que dicen "varios". Dentro de un grupo, además, las
 *   comunes le bajan la rareza a la rara.
 * - Palabras que solo equivalen en compañía (`con`, si está): "electrónica" es ARCA cuando se escribe "factura
 *   electrónica" o "boleta electrónica" (así lo dice mucha gente; ningún video dice "boleta"); "balanza
 *   electrónica" no tiene nada que ver con ARCA. Una palabra de `con` tiene que estar también en la consulta (por
 *   su raíz). "Ticket" y "recibo" no habilitan: en el sistema son otro documento.
 *
 * @type {Array<{ de: Array<string>, a: Array<string>, con?: Array<string> }>}
 */
export const EQUIVALENCIAS_DE_LA_CONSULTA = [
  { de: ['electronica'], con: ['factura', 'facturacion', 'facturar', 'comprobante', 'boleta'], a: ['arca', 'afip'] },
  { de: ['muchos', 'varios'], a: ['masa', 'masiva', 'lote'] },
]

/**
 * Secuencias de palabras que se escriben distinto de como se DICEN. Los guiones son texto para locutar,
 * y la voz de la casa deletrea las siglas: "pe-de-efe" (5 videos, 19 dicen "pdf"), "ticket dos punto
 * cero". Cada entrada es `[palabras que suenan, palabra que se busca]`. El buscador las junta en una
 * sola palabra tanto en los textos como en lo que se escribe, así "pdf" encuentra "pe-de-efe" y
 * marca todo el "pe-de-efe" en el resaltado.
 *
 * @type {Array<[string, string]>}
 */
export const FORMAS_DICHAS = [
  ['pe de efe', 'pdf'],
  // "Actualizar en masa" (T1.44), "disponibilidad masiva" (T1.27) y "ponerle foto a muchos artículos de una
  // vez" (T1.33) son lo mismo que dice la gente con "de una vez", "de una sola vez" o "de un saque" (20 videos).
  ['de una vez', 'masa'],
  ['de una sola vez', 'masa'],
  ['de un saque', 'masa'],
  // "Sacar plata de la caja" es el "retiro" de T6.8 ("Un retiro, un ajuste o un ingreso suelto"); la voz dice
  // "retiro" (5 videos) y solo una vez "sacar plata". Con "sacar" suelto no se puede, por eso va como frase.
  ['sacar plata', 'retiro'],
  ['sacar dinero', 'retiro'],
  ['sacar efectivo', 'retiro'],
]

/**
 * Palabras con las que los guiones dicen los números (el corpus casi no tiene dígitos: 4 videos, y
 * "veintiuno" por el IVA, "diez", "cinco", "cien" y "mil" por todos lados). Sirve para que escribir
 * "iva 21", "ticket 2.0" o "10 por ciento" encuentre lo que el video dice en letras. Índice = número,
 * del 0 al 30.
 *
 * @type {Array<string>}
 */
export const NUMEROS_HASTA_30 = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce',
  'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno',
  'veintidos', 'veintitres', 'veinticuatro', 'veinticinco', 'veintiseis', 'veintisiete', 'veintiocho',
  'veintinueve', 'treinta',
]

/**
 * Las decenas redondas, la centena y el millar con los que los guiones dicen los demás números.
 *
 * @type {Object<string, string>}
 */
export const NUMEROS_REDONDOS = {
  40: 'cuarenta',
  50: 'cincuenta',
  60: 'sesenta',
  70: 'setenta',
  80: 'ochenta',
  90: 'noventa',
  100: 'cien',
  1000: 'mil',
}

/**
 * Raíces que el buscador NO debe juntar aunque terminen igual. El quitador de terminaciones de
 * `buscador.js` junta "importar", "importa", "importe"…: sirve para los verbos, pero en estos pares el
 * sustantivo es otra cosa y traería videos que no son. Medido en el corpus: "importe" (23 videos, el
 * monto de un gasto o de un pago) contra "importar" (18, cargar un Excel); "correo" (16, el mail) contra
 * "corre" (17, "la lectura corre en segundo plano"); "tipo" (26, el tipo de factura) contra "tipear" (5); "bloque"
 * (43, los "bloques" del guion) contra "bloquear"; "listo" (28, "queda listo") contra "lista" y "listado"; "orden" (19) contra "ordenar", porque la
 * terminación de la tercera del plural ("-en") le dejaría la raíz "ord"; y "últimos", "mínimos", "máximos" y
 * "próximos", que terminan como "vendimos" y perderían su singular; y "masa" (20 videos, "actualizar en masa"),
 * que sin la vocal final se escribe como "más" (129 videos, relleno).
 * Cada palabra se queda con su propia raíz.
 *
 * @type {Object<string, string>}
 */
export const RAICES_APARTE = {
  importe: 'importe',
  importes: 'importe',
  correo: 'correo',
  correos: 'correo',
  tipo: 'tipo',
  tipos: 'tipo',
  orden: 'orden',
  ordenes: 'orden',
  ultimos: 'ultim',
  minimos: 'minim',
  maximos: 'maxim',
  proximos: 'proxim',
  bloque: 'bloque',
  bloques: 'bloque',
  masa: 'masa',
  masas: 'masa',
  listo: 'listo',
  listos: 'listo',
}

/**
 * Verbos que cambian la raíz al conjugarse (e → ie, o → ue, e → i): el buscador sabe juntar "cobro" con
 * "cobrar", pero no "muestra" con "mostrar" ni "elige" con "elegir". Cada entrada es `raíz de la forma
 * irregular: raíz del infinitivo`, y está acá porque las dos aparecen en los videos (medido el 16/10/2026,
 * videos con cualquier forma de cada una: elegir 154 y elige 25; cerrar 125 y cierra 43; volver 55 y
 * vuelve 52; seguir 29 y sigue 45; mostrar 20 y muestra 65; pedir 76 y pide 62; corregir 43 y corrige 13;
 * encontrar 28 y encuentra 15; mover 19 y mueve 26; devolver 17 y devuelve 9; empezar 32 y empieza 7;
 * repetir 12 y repite 11; costar 73 y cuesta 6; resolver 4 y resuelve 9; perder 14 y pierde 5; entender 15
 * y entiende 2; desplegar 329 y despliega 6; probar 5 y prueba 11). Quedan afuera los que juntarían
 * palabras que no son parientes: "ficha" y "fecha", "cuenta" y "contar", "dice" y "decir". "toq" y "saq"
 * (toque y tocar; saque y sacar) son los únicos de tres letras: la regla general de "-que" → "-car" pide
 * cuatro para no juntar "arqueo" (3 videos) con "arca" (29).
 *
 * @type {Object<string, string>}
 */
export const RAICES_IRREGULARES = {
  toq: 'toc',
  saq: 'sac',
  muestr: 'mostr',
  pid: 'ped',
  vuelv: 'volv',
  elij: 'eleg',
  elig: 'eleg',
  sig: 'seg',
  cierr: 'cerr',
  muev: 'mov',
  encuentr: 'encontr',
  corrig: 'correg',
  corrij: 'correg',
  repit: 'repet',
  devuelv: 'devolv',
  empiec: 'empec',
  resuelv: 'resolv',
  prueb: 'prob',
  cuest: 'cost',
  pierd: 'perd',
  entiend: 'entend',
  desplieg: 'despleg',
}
