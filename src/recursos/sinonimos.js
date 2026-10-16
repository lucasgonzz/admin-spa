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
 * ocupa ~46 kB y esto se baja en cada visita.
 *
 * Faltan a propósito "sistema", "reportes", "barra" e "izquierda": salen en casi todos los guiones (el
 * arranque "Al entrar al sistema estás en Reportes. Desplegá la barra de la izquierda…" se repite en
 * cada video), pero el buscador ya les da muy poco peso solo, porque calcula lo rara que es cada palabra
 * campo por campo. Y alguien que escribe "reportes" tiene que encontrar los videos de la carpeta
 * Reportes por su título: si fueran relleno, no encontraría nada.
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
    'porque pues que se segun sin sobre su sus tras u un una unas unos y ya ' +
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
    // "ayudame con…", "explicame…", "video de…": se pide un video, no se busca la palabra "video"
    'ayuda ayudame explica explicame muestra muestrame video videos tutorial tutoriales'
  ).split(' ')
)

/**
 * Grupos de palabras equivalentes. Si la consulta trae una, el buscador también acepta las otras del
 * grupo con menos puntaje (`PUNTOS.sinonimo`). Cada palabra se compara también por su raíz (forma
 * del verbo, plural), así que alcanza con anotar una forma: `borrar` cubre borra, borraste, borrarlo.
 *
 * Los comentarios dicen qué hay en el corpus: "N" es en cuántos de los 364 videos aparece la palabra
 * (título o guion), medido el 16/10/2026. Donde una palabra tiene 0, no es un error: es lo que la gente
 * ESCRIBE y los guiones no dicen, y es justo el caso que el grupo existe para resolver.
 *
 * @type {Array<Array<string>>}
 */
export const GRUPOS_DE_SINONIMOS = [
  // El organismo se llama ARCA desde 2024 y los guiones solo dicen "ARCA" (29 videos, "afip" 0); el dueño
  // todavía dice "AFIP" y es lo primero que escribe para buscar facturación electrónica.
  ['arca', 'afip'],
  // El sistema llama "artículo" a lo que todo el mundo llama "producto" (artículo 118, producto 51) y el
  // guion dice "mercadería" cuando habla del stock que entra (35).
  ['articulo', 'producto', 'mercaderia'],
  // Los guiones hablan de "plata" (51 videos, voz de la casa) y "efectivo" (26); la gente escribe
  // "dinero" (0 en los guiones).
  ['plata', 'dinero', 'efectivo'],
  // Borrar (32 con sus formas), eliminar (23) y quitar (2) se usan para la misma acción. "Sacar" (18) NO
  // entra: también es "sacar un reporte" o "sacar plata", y metería ruido.
  ['borrar', 'eliminar', 'quitar'],
  // El centro dice "imagen" (26) y "foto" (44) indistintamente; quien busca escribe una u otra.
  ['foto', 'imagen', 'fotografia'],
  // "Excel" (36) y "planilla" (6): el proveedor manda "una planilla" y el sistema importa "un Excel".
  ['excel', 'planilla'],
  // Contraseña (7) y clave (5) son lo mismo para quien no puede entrar; "password" se escribe aunque
  // ningún guion lo diga.
  ['contrasena', 'clave', 'password'],
  // Imprimir (22), impresora (11) e impresión (8) no comparten raíz y son el mismo tema (tickets y etiquetas).
  ['imprimir', 'impresora', 'impresion'],
  // "Ganancia" (18 videos) lo dice el sistema, "cuánto gano" / "utilidad" lo dice el dueño; "ganar" suma
  // las formas del verbo (ganaste 7, gana 6) que no comparten raíz con "ganancia".
  ['ganancia', 'ganar', 'utilidad', 'rentabilidad'],
  // Lo que un cliente "debe" (debe 20, debes 14, deben 7) es su "deuda" (21) o su "saldo" (32); "deudor" (4).
  ['deuda', 'saldo', 'debe', 'deben', 'deudor'],
  // "Fiado" (2 videos) es cómo el comercio llama a la cuenta corriente (72 videos dicen "corriente").
  ['fiado', 'corriente'],
  // Descuento (72 entre singular y plural) y bonificación (16): en compras la rebaja del proveedor se
  // llama "bonificación".
  ['descuento', 'bonificacion', 'rebaja'],
  // Las acciones de dar de alta: crear (71), cargar (57), agregar (29), registrar (16), alta (16). Los
  // títulos dicen "Dar de alta un cliente" y quien busca escribe "agregar cliente" o "cargar cliente".
  ['alta', 'crear', 'agregar', 'cargar', 'registrar'],
  // El stock (68) y el "inventario" (5, es también un módulo): quien cuenta mercadería dice cualquiera.
  ['stock', 'inventario', 'existencias'],
  // Comprobante (34), ticket (17) y recibo (2): lo que se le da al cliente. Factura y remito NO entran:
  // son documentos distintos con sus propios videos.
  ['comprobante', 'ticket', 'recibo', 'tiquet'],
  // Devolución (13 videos) y devolver (devolvés, devolviste: 14): la devolución de una compra se llama
  // "Devolverle mercadería a un proveedor" (T5.26) y quien busca escribe "devolución".
  ['devolucion', 'devolver'],
  // Cobro (28) y cobranza (4) no comparten raíz.
  ['cobro', 'cobranza'],
  // Los guiones dicen "IA" (15) y "inteligencia artificial"; quien busca escribe cualquiera de las dos.
  ['ia', 'inteligencia'],
  // WhatsApp (23 videos): las abreviaturas con las que se lo escribe a mano. Ningún guion las usa.
  ['whatsapp', 'wpp', 'wsp', 'wasap', 'whats'],
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
 * "corre" (17, "la lectura corre en segundo plano"); "tipo" (26, el tipo de factura) contra "tipear" (5).
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
}
