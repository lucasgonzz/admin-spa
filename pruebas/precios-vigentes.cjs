/*
  Prueba de aceptación CA7 de la misión embudo-whatsapp-precios (etapa E1):
  pantalla «Precios vigentes» en Cuenta del admin-spa.

  Se corre con `node pruebas/precios-vigentes.cjs`. No necesita dependencias: `admin-spa` no tiene
  corredor de tests (misma convención que pruebas/support-media.cjs).

  Qué fija:
    1. La lógica pura de `src/utils/precios_vigentes.js` (se extrae del ARCHIVO REAL, no de una copia):
       - la mitad de una implementación (628400 -> 314200, 1574300 -> 787150);
       - el abono con descuento de bienvenida (55900 al 50 % -> 27950);
       - el encadenado de rangos de los planes: 0-200 / 201-600 / 601-∞ es válido y
         0-200 / 150-600 no lo es (el backend igual responde 422, pero la pantalla no deja guardar);
       - el formato de pesos («$628.400», «$89,56») y de dólares («USD 0,0618»).
       - AJUSTE «oferta simple» (21/11/2026): vista previa de la mensualidad de Agentes
         (30000 + 10 × 1675 = 46750; con 1700: 47000 / 81000 / 149000), de los tres juntos
         (1885200 → 1319640 con 30 %; 1413900 con 25 %), anticipo de los tres juntos (659820) y la
         validación espejo de los 422 del servidor, con las MISMAS claves.
    2. Que la pantalla exista y esté registrada: los seis componentes de la carpeta
       `precios-vigentes/` (con `Agentes.vue`), la sección en `account_sections.js` (grupo «Leads y ventas») y su
       montaje en `Account.vue`.

  La verificación visual (tablas con los valores de CA1, editar, guardar, rango inválido sin guardar)
  la hace el Coordinador en el navegador: acá no se levanta nada.
*/
const fs = require('fs')
const path = require('path')

const RAIZ = path.join(__dirname, '..')
const FUENTE = path.join(RAIZ, 'src', 'utils', 'precios_vigentes.js')

let fallos = 0
let corridas = 0

/** Compara con igualdad estricta y cuenta el resultado. */
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

/* ---- Existencia de la lógica pura: sin ella no hay nada que probar ---- */
let texto = null
try {
  texto = fs.readFileSync(FUENTE, 'utf8')
} catch (error) {
  console.log('FALLA  no existe src/utils/precios_vigentes.js (' + error.code + '): la pantalla «Precios vigentes» todavía no se construyó')
  fallos++
  corridas++
}

if (texto !== null) {
  /* Sacar el `export` de cada declaración: Node no los entiende dentro de un `new Function`. */
  texto = texto.replace(/^export /gm, '')

  const nombres = [
    'calculate_down_payment', 'calculate_discounted_fee', 'validate_plan_ranges',
    'format_pesos', 'format_usd',
  ]
  const modulo = new Function(texto + '\nreturn { ' + nombres.join(', ') + ' }')()

  /* ---- La mitad de la implementación (anticipo 50 %) ---- */
  igual('mitad de 628400', modulo.calculate_down_payment(628400, 50), 314200)
  igual('mitad de 938600', modulo.calculate_down_payment(938600, 50), 469300)
  igual('mitad de 946800', modulo.calculate_down_payment(946800, 50), 473400)
  igual('mitad de 1254600', modulo.calculate_down_payment(1254600, 50), 627300)
  igual('mitad de 1574300', modulo.calculate_down_payment(1574300, 50), 787150)
  igual('la mitad redondea a 2 decimales', modulo.calculate_down_payment(1001.02, 50), 500.51)
  igual('con otro porcentaje de anticipo', modulo.calculate_down_payment(1000, 30), 300)

  /* ---- El abono con el descuento de bienvenida ---- */
  igual('Inicial con 50 % de descuento', modulo.calculate_discounted_fee(55900, 50), 27950)
  igual('Intermedio con 50 % de descuento', modulo.calculate_discounted_fee(85400, 50), 42700)
  igual('Empresa con 50 % de descuento', modulo.calculate_discounted_fee(263000, 50), 131500)
  igual('Intermedio a 86000 con 50 %', modulo.calculate_discounted_fee(86000, 50), 43000)
  igual('sin descuento (0 %) queda el abono entero', modulo.calculate_discounted_fee(60000, 0), 60000)

  /* ---- Rangos encadenados de los planes ---- */
  const planes_validos = [
    { clave: 'inicial', desde: 0, hasta: 200 },
    { clave: 'intermedio', desde: 201, hasta: 600 },
    { clave: 'empresa', desde: 601, hasta: null },
  ]
  igual('0-200 / 201-600 / 601-∞ es válido', modulo.validate_plan_ranges(planes_validos), [])

  const planes_superpuestos = [
    { clave: 'inicial', desde: 0, hasta: 200 },
    { clave: 'intermedio', desde: 150, hasta: 600 },
    { clave: 'empresa', desde: 601, hasta: null },
  ]
  const errores_superpuestos = modulo.validate_plan_ranges(planes_superpuestos)
  cierto('0-200 / 150-600 es inválido', errores_superpuestos.length > 0)
  igual('el error apunta al plan Intermedio y a su campo «desde»',
    [errores_superpuestos[0].clave, errores_superpuestos[0].campo], ['intermedio', 'desde'])
  cierto('el error trae un mensaje legible', typeof errores_superpuestos[0].mensaje === 'string' && errores_superpuestos[0].mensaje.length > 0)

  const planes_con_hueco = [
    { clave: 'inicial', desde: 0, hasta: 200 },
    { clave: 'intermedio', desde: 250, hasta: 600 },
    { clave: 'empresa', desde: 601, hasta: null },
  ]
  cierto('0-200 / 250-600 (queda un hueco) es inválido', modulo.validate_plan_ranges(planes_con_hueco).length > 0)

  const inicial_que_no_arranca_en_cero = [
    { clave: 'inicial', desde: 5, hasta: 200 },
    { clave: 'intermedio', desde: 201, hasta: 600 },
    { clave: 'empresa', desde: 601, hasta: null },
  ]
  cierto('Inicial tiene que arrancar en 0', modulo.validate_plan_ranges(inicial_que_no_arranca_en_cero).length > 0)

  const empresa_con_tope = [
    { clave: 'inicial', desde: 0, hasta: 200 },
    { clave: 'intermedio', desde: 201, hasta: 600 },
    { clave: 'empresa', desde: 601, hasta: 3000 },
  ]
  cierto('Empresa tiene que ser ilimitada (hasta null)', modulo.validate_plan_ranges(empresa_con_tope).length > 0)

  const hasta_menor_que_desde = [
    { clave: 'inicial', desde: 0, hasta: 200 },
    { clave: 'intermedio', desde: 201, hasta: 100 },
    { clave: 'empresa', desde: 101, hasta: null },
  ]
  cierto('un «hasta» menor que su «desde» es inválido', modulo.validate_plan_ranges(hasta_menor_que_desde).length > 0)

  const con_campo_vacio = [
    { clave: 'inicial', desde: 0, hasta: 200 },
    { clave: 'intermedio', desde: '', hasta: 600 },
    { clave: 'empresa', desde: 601, hasta: null },
  ]
  cierto('un campo vacío no deja guardar', modulo.validate_plan_ranges(con_campo_vacio).length > 0)

  /* ---- Formato de pesos y dólares (separador de miles «.», decimal «,») ---- */
  igual('pesos enteros sin decimales', modulo.format_pesos(628400), '$628.400')
  igual('pesos con millones', modulo.format_pesos(1574300), '$1.574.300')
  igual('pesos con centavos', modulo.format_pesos(89.56), '$89,56')
  igual('cero pesos', modulo.format_pesos(0), '$0')
  igual('dólares con 4 decimales', modulo.format_usd(0.0618), 'USD 0,0618')
  igual('dólares sin ceros de relleno', modulo.format_usd(0.026), 'USD 0,026')

  /* ---- Notación por «clave» y topes idénticos a los del servidor (corrección de la revisión de E1) ----
     El servidor arma las claves de `errors` con la `clave` del elemento (gestion.planes.inicial.usuarios),
     no con su posición. La pantalla valida y lee errores con esas mismas claves, y sus topes son los de
     PreciosVigentesSettings::validar() de admin-api. */
  const extra = new Function(texto + '\nreturn { validate_precios: typeof validate_precios === "function" ? validate_precios : undefined,'
    + ' resolve_server_errors: typeof resolve_server_errors === "function" ? resolve_server_errors : undefined }')()

  /** Contrato de partida: los DEFAULTS de la API (válidos). */
  function contrato_base() {
    return {
      version: 2,
      moneda: 'ARS',
      gestion: {
        planes: [
          { clave: 'inicial', nombre: 'Inicial', desde: 0, hasta: 200, usuarios: 1, abono: 55900, excedente: 760 },
          { clave: 'intermedio', nombre: 'Intermedio', desde: 201, hasta: 600, usuarios: 2, abono: 85400, excedente: 570 },
          { clave: 'empresa', nombre: 'Empresa', desde: 601, hasta: null, usuarios: 3, abono: 263000, excedente: null },
        ],
        usuario_extra: 30400,
        descuento_bienvenida: { porcentaje: 50, meses: 3 },
      },
      tienda: { mensualidad: 44900 },
      agentes: {
        incluye: 'Agente de WhatsApp con la migración o configuración inicial del número',
        uso_de_tokens: 'Hacerle preguntas y pedirle cosas a los agentes, y generar imágenes para el negocio',
        cotizacion_usd: { valor: 1675, referencia: 'Dólar blue, venta', fecha: '2026-11-20' },
        ganancia_por_paquete: 30000,
        aviso_consumo_porcentaje: 80,
        paquetes: [
          { clave: 'inicial', nombre: 'Inicial', tokens_usd: 10, mensualidad: 46750 },
          { clave: 'pro', nombre: 'Pro', tokens_usd: 30, mensualidad: 80250 },
          { clave: 'max', nombre: 'Max', tokens_usd: 70, mensualidad: 147250 },
        ],
      },
      implementaciones: {
        anticipo_porcentaje: 50,
        reembolsable: false,
        items: [
          { clave: 'gestion', nombre: 'Sistema de gestión', precio: 628400 },
          { clave: 'tienda', nombre: 'Tienda online', precio: 628400 },
          { clave: 'agentes', nombre: 'Agentes', precio: 628400 },
        ],
        tres_juntos: { descuento_porcentaje: 30, precio_lista: 1885200, precio: 1319640 },
      },
      costos_meta: {
        vigente_desde: '2026-10-01',
        mensajes_libres_gratis_por_mes: 1000,
        tarifas: [
          { clave: 'marketing', nombre: 'Plantilla de marketing', usd: 0.0618, ars: 89.56 },
          { clave: 'utilidad', nombre: 'Plantilla de utilidad', usd: 0.026, ars: 37.68 },
        ],
      },
    }
  }

  /** Claves de los errores locales de un contrato (o [] si la función todavía no existe). */
  function claves_de(contrato) {
    return typeof extra.validate_precios === 'function' ? Object.keys(extra.validate_precios(contrato)).sort() : ['(no existe validate_precios)']
  }

  igual('los DEFAULTS de la API son válidos en la pantalla', claves_de(contrato_base()), [])

  const rango_roto = contrato_base()
  rango_roto.gestion.planes[1].desde = 150
  igual('un rango inválido en Intermedio marca gestion.planes.intermedio.desde', claves_de(rango_roto), ['gestion.planes.intermedio.desde'])

  /* ---- Estructura de la oferta simple: 3 items, 3 paquetes, sin Lite/Full ---- */
  const estructura = contrato_base()
  igual('los items de implementación son exactamente gestion, tienda y agentes',
    estructura.implementaciones.items.map(function (i) { return i.clave }), ['gestion', 'tienda', 'agentes'])
  igual('los paquetes de Agentes son exactamente inicial, pro y max',
    estructura.agentes.paquetes.map(function (p) { return p.clave }), ['inicial', 'pro', 'max'])
  cierto('agentes no tiene claves lite ni full', estructura.agentes.lite === undefined && estructura.agentes.full === undefined)

  const mil_uno = contrato_base()
  mil_uno.gestion.planes[0].usuarios = 1001
  igual('1001 usuarios en Inicial es inválido con la clave gestion.planes.inicial.usuarios', claves_de(mil_uno), ['gestion.planes.inicial.usuarios'])

  const mil = contrato_base()
  mil.gestion.planes[0].usuarios = 1000
  igual('1000 usuarios en Inicial es válido (tope del servidor: 1..1000)', claves_de(mil), [])

  const cero_usuarios = contrato_base()
  cero_usuarios.gestion.planes[2].usuarios = 0
  igual('0 usuarios es inválido (mínimo del servidor: 1)', claves_de(cero_usuarios), ['gestion.planes.empresa.usuarios'])

  const usuarios_decimales = contrato_base()
  usuarios_decimales.gestion.planes[0].usuarios = 1.5
  igual('usuarios con decimales es inválido (entero)', claves_de(usuarios_decimales), ['gestion.planes.inicial.usuarios'])

  const item_roto = contrato_base()
  item_roto.implementaciones.items[0].precio = -1
  igual('un precio de implementación negativo marca implementaciones.items.gestion.precio', claves_de(item_roto), ['implementaciones.items.gestion.precio'])

  const tarifa_rota = contrato_base()
  tarifa_rota.costos_meta.tarifas[0].usd = 0.00001
  igual('una tarifa con 5 decimales en USD marca costos_meta.tarifas.marketing.usd', claves_de(tarifa_rota), ['costos_meta.tarifas.marketing.usd'])

  const ars_roto = contrato_base()
  ars_roto.costos_meta.tarifas[1].ars = 1.234
  igual('una tarifa con 3 decimales en pesos marca costos_meta.tarifas.utilidad.ars', claves_de(ars_roto), ['costos_meta.tarifas.utilidad.ars'])

  const desde_tope = contrato_base()
  desde_tope.gestion.planes[2].desde = 100000001
  cierto('un «desde» por encima de 100.000.000 es inválido',
    claves_de(desde_tope).indexOf('gestion.planes.empresa.desde') !== -1)

  const mensajes_tope = contrato_base()
  mensajes_tope.costos_meta.mensajes_libres_gratis_por_mes = 100000000
  igual('mensajes libres gratis: 100.000.000 es válido (tope del servidor)', claves_de(mensajes_tope), [])
  mensajes_tope.costos_meta.mensajes_libres_gratis_por_mes = 100000001
  igual('mensajes libres gratis: 100.000.001 es inválido', claves_de(mensajes_tope), ['costos_meta.mensajes_libres_gratis_por_mes'])

  const meses_roto = contrato_base()
  meses_roto.gestion.descuento_bienvenida.meses = 25
  igual('25 meses de descuento es inválido (tope 24)', claves_de(meses_roto), ['gestion.descuento_bienvenida.meses'])

  const fecha_rota = contrato_base()
  fecha_rota.costos_meta.vigente_desde = '2026-02-30'
  igual('una fecha inexistente marca costos_meta.vigente_desde', claves_de(fecha_rota), ['costos_meta.vigente_desde'])
  fecha_rota.costos_meta.vigente_desde = ''
  igual('una fecha vacía marca costos_meta.vigente_desde', claves_de(fecha_rota), ['costos_meta.vigente_desde'])
  fecha_rota.costos_meta.vigente_desde = '01/10/2026'
  igual('una fecha con otro formato marca costos_meta.vigente_desde', claves_de(fecha_rota), ['costos_meta.vigente_desde'])

  const inicial_sin_excedente = contrato_base()
  inicial_sin_excedente.gestion.planes[0].excedente = null
  igual('Inicial sin precio de excedente es inválido (el servidor lo exige)', claves_de(inicial_sin_excedente), ['gestion.planes.inicial.excedente'])

  /* ---- Validación espejo de los 422 de la oferta simple (mismas claves que el servidor) ---- */
  const cot_cero = contrato_base()
  cot_cero.agentes.cotizacion_usd.valor = 0
  igual('cotización en 0 es inválida: agentes.cotizacion_usd.valor', claves_de(cot_cero), ['agentes.cotizacion_usd.valor'])
  const cot_vacia = contrato_base()
  cot_vacia.agentes.cotizacion_usd.valor = ''
  igual('cotización vacía es inválida', claves_de(cot_vacia), ['agentes.cotizacion_usd.valor'])
  const cot_1700 = contrato_base()
  cot_1700.agentes.cotizacion_usd.valor = 1700
  igual('cotización 1700 es válida', claves_de(cot_1700), [])
  const cot_3_dec = contrato_base()
  cot_3_dec.agentes.cotizacion_usd.valor = 1675.123
  igual('cotización con 3 decimales es inválida (2 como máximo)', claves_de(cot_3_dec), ['agentes.cotizacion_usd.valor'])
  const cot_techo = contrato_base()
  cot_techo.agentes.cotizacion_usd.valor = 100000000
  igual('cotización por encima de 99.999.999 es inválida', claves_de(cot_techo), ['agentes.cotizacion_usd.valor'])
  const pro_negativo = contrato_base()
  pro_negativo.agentes.paquetes[1].tokens_usd = -1
  igual('tokens_usd = -1 en Pro es inválido: agentes.paquetes.pro.tokens_usd', claves_de(pro_negativo), ['agentes.paquetes.pro.tokens_usd'])
  const pro_cero = contrato_base()
  pro_cero.agentes.paquetes[1].tokens_usd = 0
  igual('tokens_usd = 0 es inválido (tiene que ser mayor que 0)', claves_de(pro_cero), ['agentes.paquetes.pro.tokens_usd'])
  const tokens_4_dec = contrato_base()
  tokens_4_dec.agentes.paquetes[0].tokens_usd = 2.5001
  igual('tokens_usd con 4 decimales es válido', claves_de(tokens_4_dec), [])
  tokens_4_dec.agentes.paquetes[0].tokens_usd = 2.50001
  igual('tokens_usd con 5 decimales es inválido', claves_de(tokens_4_dec), ['agentes.paquetes.inicial.tokens_usd'])
  const aviso_cero = contrato_base()
  aviso_cero.agentes.aviso_consumo_porcentaje = 0
  igual('aviso de consumo en 0 es inválido', claves_de(aviso_cero), ['agentes.aviso_consumo_porcentaje'])
  aviso_cero.agentes.aviso_consumo_porcentaje = 101
  igual('aviso de consumo en 101 es inválido', claves_de(aviso_cero), ['agentes.aviso_consumo_porcentaje'])
  aviso_cero.agentes.aviso_consumo_porcentaje = 100
  igual('aviso de consumo en 100 es válido', claves_de(aviso_cero), [])
  aviso_cero.agentes.aviso_consumo_porcentaje = 80.5
  igual('aviso de consumo con decimales es inválido (entero)', claves_de(aviso_cero), ['agentes.aviso_consumo_porcentaje'])
  const desc_120 = contrato_base()
  desc_120.implementaciones.tres_juntos.descuento_porcentaje = 120
  igual('descuento de los tres juntos en 120 es inválido', claves_de(desc_120), ['implementaciones.tres_juntos.descuento_porcentaje'])
  desc_120.implementaciones.tres_juntos.descuento_porcentaje = 0
  igual('descuento de los tres juntos en 0 es válido', claves_de(desc_120), [])
  const fecha_ayer = contrato_base()
  fecha_ayer.agentes.cotizacion_usd.fecha = 'ayer'
  igual('fecha de cotización «ayer» es inválida: agentes.cotizacion_usd.fecha', claves_de(fecha_ayer), ['agentes.cotizacion_usd.fecha'])
  const ganancia_neg = contrato_base()
  ganancia_neg.agentes.ganancia_por_paquete = -1
  igual('ganancia negativa es inválida', claves_de(ganancia_neg), ['agentes.ganancia_por_paquete'])
  const textos = contrato_base()
  textos.agentes.incluye = ''
  textos.agentes.uso_de_tokens = 'x'.repeat(301)
  textos.agentes.cotizacion_usd.referencia = 'x'.repeat(61)
  textos.agentes.paquetes[2].nombre = 'x'.repeat(41)
  igual('textos vacíos o demasiado largos se marcan con su clave', claves_de(textos),
    ['agentes.cotizacion_usd.referencia', 'agentes.incluye', 'agentes.paquetes.max.nombre', 'agentes.uso_de_tokens'])
  const textos_ok = contrato_base()
  textos_ok.agentes.uso_de_tokens = 'x'.repeat(300)
  textos_ok.agentes.paquetes[2].nombre = 'x'.repeat(40)
  igual('textos en el tope (300 y 40) son válidos', claves_de(textos_ok), [])

  /* ---- Vista previa con la MISMA fórmula que la API (redondeo a pesos enteros) ---- */
  const prev = new Function(texto + '\nreturn {'
    + ' calculate_package_fee: typeof calculate_package_fee === "function" ? calculate_package_fee : undefined,'
    + ' calculate_three_together_list_price: typeof calculate_three_together_list_price === "function" ? calculate_three_together_list_price : undefined,'
    + ' calculate_three_together_price: typeof calculate_three_together_price === "function" ? calculate_three_together_price : undefined,'
    + ' preview_agent_packages: typeof preview_agent_packages === "function" ? preview_agent_packages : undefined,'
    + ' preview_three_together: typeof preview_three_together === "function" ? preview_three_together : undefined }')()
  /** Llama a una función de vista previa o devuelve un marcador si todavía no existe. */
  function via(nombre, args) {
    return typeof prev[nombre] === 'function' ? prev[nombre].apply(null, args) : '(no existe ' + nombre + ')'
  }

  /** Fuerza lista: si la función todavía no existe, devuelve [] y la aserción falla en vez de romper el script. */
  function lista(valor) {
    return Array.isArray(valor) ? valor : []
  }

  igual('mensualidad Inicial: 30000 + 10 × 1675 = 46750', via('calculate_package_fee', [30000, 10, 1675]), 46750)
  igual('mensualidad Pro: 30000 + 30 × 1675 = 80250', via('calculate_package_fee', [30000, 30, 1675]), 80250)
  igual('mensualidad Max: 30000 + 70 × 1675 = 147250', via('calculate_package_fee', [30000, 70, 1675]), 147250)
  igual('con el blue en 1700: Inicial 47000', via('calculate_package_fee', [30000, 10, 1700]), 47000)
  igual('con el blue en 1700: Pro 81000', via('calculate_package_fee', [30000, 30, 1700]), 81000)
  igual('con el blue en 1700: Max 149000', via('calculate_package_fee', [30000, 70, 1700]), 149000)
  igual('la mensualidad se redondea a pesos enteros', via('calculate_package_fee', [30000, 2.5, 1675.5]), 34189)
  igual('los paquetes del contrato por defecto dan 46750 / 80250 / 147250',
    lista(via('preview_agent_packages', [contrato_base().agentes])).map(function (p) { return [p.clave, p.mensualidad] }),
    [['inicial', 46750], ['pro', 80250], ['max', 147250]])
  const agentes_1700 = contrato_base().agentes
  agentes_1700.cotizacion_usd.valor = 1700
  igual('los paquetes con la cotización en 1700 dan 47000 / 81000 / 149000',
    lista(via('preview_agent_packages', [agentes_1700])).map(function (p) { return p.mensualidad }), [47000, 81000, 149000])
  const agentes_incompletos = contrato_base().agentes
  agentes_incompletos.cotizacion_usd.valor = ''
  igual('con la cotización vacía la vista previa no inventa números',
    lista(via('preview_agent_packages', [agentes_incompletos])).map(function (p) { return p.mensualidad }), [null, null, null])

  igual('lista de los tres juntos: 3 × 628400 = 1885200',
    via('calculate_three_together_list_price', [contrato_base().implementaciones.items]), 1885200)
  igual('tres juntos con 30 %: 1885200 → 1319640', via('calculate_three_together_price', [1885200, 30]), 1319640)
  igual('tres juntos con 25 %: 1413900', via('calculate_three_together_price', [1885200, 25]), 1413900)
  igual('tres juntos con 0 %: queda el precio de lista', via('calculate_three_together_price', [1885200, 0]), 1885200)
  igual('tres juntos redondea a pesos enteros', via('calculate_three_together_price', [1000, 33.33]), 667)
  igual('vista previa de los tres juntos (contrato por defecto)',
    via('preview_three_together', [contrato_base().implementaciones]), { precio_lista: 1885200, precio: 1319640 })
  const impl_25 = contrato_base().implementaciones
  impl_25.tres_juntos.descuento_porcentaje = 25
  igual('vista previa de los tres juntos con 25 %', via('preview_three_together', [impl_25]), { precio_lista: 1885200, precio: 1413900 })
  igual('anticipo (50 %) de los tres juntos: 1319640 → 659820', modulo.calculate_down_payment(1319640, 50), 659820)
  igual('anticipo de los tres juntos desde la vista previa',
    modulo.calculate_down_payment(via('preview_three_together', [contrato_base().implementaciones]).precio, 50), 659820)

  /* ---- El objeto `errors` del servidor se resuelve al campo correcto ---- */
  const errores_servidor = {
    'gestion.planes.intermedio.desde': ['Los rangos de operaciones tienen que ser continuos.'],
    'gestion.planes.inicial.usuarios': ['Plan Inicial: los usuarios incluidos tiene que estar entre 1 y 1.000.'],
    'implementaciones.items.gestion.precio': ['El precio de la implementación «Sistema de gestión» tiene que estar entre 0 y 99.999.999.'],
    'costos_meta.tarifas.marketing.usd': ['La tarifa «Plantilla de marketing» en USD admite hasta 4 decimales.'],
    'costos_meta.vigente_desde': ['La fecha de vigencia tiene que tener el formato AAAA-MM-DD.'],
    'implementaciones.reembolsable': ['El dato «reembolsable» tiene que ser verdadero o falso.'],
    'agentes.paquetes.pro.mensualidad': ['La mensualidad del paquete Pro la calcula el servidor.'],
    'agentes.paquetes.pro.tokens_usd': ['Paquete Pro: los tokens en USD tienen que ser mayores que 0.'],
    'agentes.cotizacion_usd.valor': ['La cotización del dólar tiene que ser mayor que 0.'],
    'agentes.aviso_consumo_porcentaje': ['El aviso de consumo tiene que estar entre 1 y 100.'],
    'implementaciones.tres_juntos.descuento_porcentaje': ['El descuento de los tres juntos tiene que estar entre 0 y 100.'],
    'gestion.planes.inicial.nombre': ['El nombre del plan inicial tiene que ser un texto de 1 a 80 caracteres.'],
  }
  const resuelto = typeof extra.resolve_server_errors === 'function' ? extra.resolve_server_errors(errores_servidor, contrato_base()) : null
  cierto('existe resolve_server_errors', resuelto !== null)
  if (resuelto !== null) {
    igual('Intermedio «desde» queda en su campo', resuelto.por_campo['gestion.planes.intermedio.desde'], 'Los rangos de operaciones tienen que ser continuos.')
    ;['agentes.paquetes.pro.tokens_usd', 'agentes.cotizacion_usd.valor', 'agentes.aviso_consumo_porcentaje',
      'implementaciones.tres_juntos.descuento_porcentaje'].forEach(function (ruta) {
      igual('el error 422 de ' + ruta + ' queda en su campo', Object.keys(resuelto.por_campo).indexOf(ruta) !== -1, true)
    })
    igual('usuarios de Inicial queda en su campo', Object.keys(resuelto.por_campo).indexOf('gestion.planes.inicial.usuarios') !== -1, true)
    igual('el precio de «gestion» queda en su campo', Object.keys(resuelto.por_campo).indexOf('implementaciones.items.gestion.precio') !== -1, true)
    igual('la tarifa USD de marketing queda en su campo', Object.keys(resuelto.por_campo).indexOf('costos_meta.tarifas.marketing.usd') !== -1, true)
    igual('la fecha de vigencia queda en su campo', Object.keys(resuelto.por_campo).indexOf('costos_meta.vigente_desde') !== -1, true)
    igual('lo que no tiene campo visible va al resumen general', resuelto.generales.slice().sort(), [
      'El dato «reembolsable» tiene que ser verdadero o falso.',
      'El nombre del plan inicial tiene que ser un texto de 1 a 80 caracteres.',
      'La mensualidad del paquete Pro la calcula el servidor.',
    ].sort())
    igual('un mensaje suelto (string) también se acepta', extra.resolve_server_errors({ 'tienda.mensualidad': 'Mal' }, contrato_base()).por_campo['tienda.mensualidad'], 'Mal')
    igual('una clave de un plan que no existe en la pantalla va al resumen general',
      extra.resolve_server_errors({ 'gestion.planes.platino.usuarios': ['No'] }, contrato_base()).generales, ['No'])
  }

  /* ---- Ningún componente busca errores por posición, y la fecha de Meta es editable ---- */
  const carpeta_vistas = path.join(RAIZ, 'src', 'components', 'account', 'sections', 'precios-vigentes')
  ;['PlanesGestion.vue', 'Adicionales.vue', 'Implementaciones.vue', 'CostosMeta.vue', 'Agentes.vue'].forEach(function (archivo) {
    /* Si el archivo todavía no existe se lee como vacío: la falla la da la comprobación de existencia. */
    let contenido = ''
    try {
      contenido = fs.readFileSync(path.join(carpeta_vistas, archivo), 'utf8')
    } catch (error) {
      contenido = ''
    }
    cierto(archivo + ' existe y no arma claves de error con el índice', !/errors\['[a-z_.]+\.'\s*\+\s*index/.test(contenido))
  })
  cierto('CostosMeta.vue edita costos_meta.vigente_desde con un campo de fecha',
    /v-model="precios\.costos_meta\.vigente_desde"/.test(fs.readFileSync(path.join(carpeta_vistas, 'CostosMeta.vue'), 'utf8'))
    && /type="date"/.test(fs.readFileSync(path.join(carpeta_vistas, 'CostosMeta.vue'), 'utf8')))

  /* ---- La pantalla: sus archivos y su registro en Cuenta ---- */
  const carpeta = path.join(RAIZ, 'src', 'components', 'account', 'sections', 'precios-vigentes')
  ;['Index.vue', 'PlanesGestion.vue', 'Adicionales.vue', 'Agentes.vue', 'Implementaciones.vue', 'CostosMeta.vue']
    .forEach(function (archivo) {
      cierto('existe precios-vigentes/' + archivo, fs.existsSync(path.join(carpeta, archivo)))
    })

  /* ---- Oferta simple en la pantalla: sin Lite/Full, con la tabla de Agentes y la de tres juntos ---- */
  /** Lee un componente de la carpeta o '' si no existe (para que la falla sea una aserción, no un crash). */
  function leer_vista(archivo) {
    try {
      return fs.readFileSync(path.join(carpeta, archivo), 'utf8')
    } catch (error) {
      return ''
    }
  }
  const vista_adicionales = leer_vista('Adicionales.vue')
  cierto('Adicionales.vue ya no tiene Agentes Lite ni Full', vista_adicionales !== '' && !/Lite|Full|agentes\.(lite|full)/.test(vista_adicionales))
  const vista_agentes = leer_vista('Agentes.vue')
  cierto('Agentes.vue edita la cotización (valor, referencia y fecha)',
    /precios\.agentes\.cotizacion_usd\.valor/.test(vista_agentes) && /precios\.agentes\.cotizacion_usd\.referencia/.test(vista_agentes)
    && /precios\.agentes\.cotizacion_usd\.fecha/.test(vista_agentes) && /type="date"/.test(vista_agentes))
  cierto('Agentes.vue edita ganancia, aviso de consumo y los dos textos',
    /precios\.agentes\.ganancia_por_paquete/.test(vista_agentes) && /precios\.agentes\.aviso_consumo_porcentaje/.test(vista_agentes)
    && /precios\.agentes\.incluye/.test(vista_agentes) && /precios\.agentes\.uso_de_tokens/.test(vista_agentes))
  cierto('Agentes.vue edita nombre y USD de cada paquete y recorre precios.agentes.paquetes',
    /precios\.agentes\.paquetes/.test(vista_agentes) && /paquete\.tokens_usd/.test(vista_agentes) && /paquete\.nombre/.test(vista_agentes))
  cierto('Agentes.vue muestra la mensualidad calculada sólo de lectura (sin v-model)',
    /preview_agent_packages/.test(vista_agentes) && !/v-model[^>]*mensualidad/.test(vista_agentes))
  cierto('Agentes.vue marca los errores con la clave del paquete', /agentes\.paquetes\.'\s*\+\s*paquete\.clave/.test(vista_agentes))
  const vista_impl = leer_vista('Implementaciones.vue')
  cierto('Implementaciones.vue muestra el descuento de los tres juntos con precio de lista y con descuento',
    /tres_juntos\.descuento_porcentaje/.test(vista_impl) && /preview_three_together/.test(vista_impl))
  cierto('Implementaciones.vue ya no menciona Agentes Lite ni Full', vista_impl !== '' && !/Lite|Full/.test(vista_impl))
  const vista_index = leer_vista('Index.vue')
  cierto('Index.vue registra y monta Agentes.vue', /import Agentes from '\.\/Agentes\.vue'/.test(vista_index) && /<agentes\b/.test(vista_index))

  const secciones = fs.readFileSync(path.join(RAIZ, 'src', 'components', 'account', 'account_sections.js'), 'utf8')
  cierto('account_sections.js registra «precios-vigentes» en «Leads y ventas»',
    /id:\s*'precios-vigentes'[\s\S]*?group:\s*'Leads y ventas'/.test(secciones))

  const cuenta = fs.readFileSync(path.join(RAIZ, 'src', 'views', 'Account.vue'), 'utf8')
  cierto('Account.vue monta la sección «precios-vigentes»', /active_section === 'precios-vigentes'/.test(cuenta))

  /* `min-w-0` no existe en Bootstrap 5: sin `min-width: 0` propio, el contenido de Cuenta se estira hasta el
     ancho de la tabla más ancha y desborda el área principal en tablet (verificación en navegador, 900 px). */
  cierto('Account.vue define min-width: 0 para .account-page__content',
    /\.account-page__content\s*\{[^}]*min-width:\s*0\s*;/.test(cuenta))
}

console.log('\n' + corridas + ' comprobaciones, ' + fallos + ' fallas')
process.exit(fallos === 0 ? 0 : 1)
