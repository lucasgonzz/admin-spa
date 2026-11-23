/*
  Prueba de aceptación CA26 de la misión embudo-whatsapp-precios (etapa E4, parte SPA) más la decisión de
  Lucas del 23/11/2026: el editor de contratos precarga los precios nuevos EN PESOS desde la fuente única
  (`GET admin/settings/precios-vigentes`).

  Se corre con `node pruebas/contract-precios-vigentes.cjs`. No necesita dependencias (misma convención que
  pruebas/precios-vigentes.cjs): la lógica pura se extrae del ARCHIVO REAL `src/utils/contract_precios.js`
  (que no importa nada, a propósito) y se ejecuta en Node. Cada escenario evalúa el archivo de nuevo para
  partir con el estado del módulo vacío.

  Qué fija:
    1. Contrato NUEVO con la fuente cargada: moneda ARS (licencia y mensualidad); licencia de cada sistema
       = implementaciones.items[clave].precio ($628.400); descuento conjunto = lista × porcentaje / 100
       ($565.560) que sólo se resta con los tres sistemas; mensualidad de gestión del plan, de tienda
       $44.900 y de agentes por paquete (Inicial por defecto; Pro $80.250; Max $147.250); todo editable.
    2. El select de plan lista los planes de la fuente con sus rangos (Inicial hasta 200, Intermedio de 201
       a 600, Empresa ilimitado); un contrato con `plus` (u otro plan que ya no se ofrece) lo muestra como
       opción deshabilitada, y el `inicial` histórico de $34.200 sigue siendo histórico.
    3. Un contrato ya guardado no se recalcula al abrirlo.
    4. GET caído, respuesta inválida o forma vieja: fallback a las constantes de hoy (USD, 0/800/800,
       55.900/20.000/30.000, sin descuento, planes de la política del 3/11).
    5. La fuente se pide una sola vez por sesión (axios-style: `res.data`).
    6. Los tres componentes del editor usan las funciones nuevas (el cableado).

  La verificación visual (select, selector de paquete, totales en pantalla) la hace el Coordinador en el
  navegador: acá no se levanta nada.
*/
const fs = require('fs')
const path = require('path')

const RAIZ = path.join(__dirname, '..')
const FUENTE = path.join(RAIZ, 'src', 'utils', 'contract_precios.js')

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

/** Lo que devuelve la API (contrato v2 de la oferta simple) con los valores del 21/11/2026. */
function fuente_de_la_oferta() {
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
      paquetes: [
        { clave: 'inicial', nombre: 'Inicial', tokens_usd: 10, mensualidad: 46750 },
        { clave: 'pro', nombre: 'Pro', tokens_usd: 30, mensualidad: 80250 },
        { clave: 'max', nombre: 'Max', tokens_usd: 70, mensualidad: 147250 },
      ],
    },
    implementaciones: {
      anticipo_porcentaje: 50,
      items: [
        { clave: 'gestion', nombre: 'Sistema de gestión', precio: 628400 },
        { clave: 'tienda', nombre: 'Tienda online', precio: 628400 },
        { clave: 'agentes', nombre: 'Agentes', precio: 628400 },
      ],
      tres_juntos: { descuento_porcentaje: 30, precio_lista: 1885200, precio: 1319640 },
    },
  }
}

/** Una fuente con otro descuento y otros precios, con `tres_juntos` calculado como lo hace la API (pesos enteros). */
function fuente_con(descuento, precios) {
  const f = fuente_de_la_oferta()
  f.implementaciones.items.forEach((item, i) => { item.precio = precios[i] })
  const lista = precios.reduce((a, b) => a + b, 0)
  f.implementaciones.tres_juntos = { descuento_porcentaje: descuento, precio_lista: lista, precio: Math.round(lista * (100 - descuento) / 100) }
  return f
}

const NOMBRES = [
  'fijar_precios_vigentes', 'precios_vigentes_cargados', 'cargar_precios_vigentes',
  'iniciar_precios_por_sistema', 'precargar_precios_si_es_nuevo', 'tiene_condiciones_guardadas',
  'elegir_plan_gestion', 'opciones_de_plan', 'opciones_de_paquete_agentes', 'paquete_agentes_del_contrato',
  'elegir_paquete_agentes', 'resumen_precios', 'actualizar_totales', 'plan_historico_del_contrato',
  'firma_de_condiciones', 'precargar_si_sigue_nuevo',
]

let texto = null
try {
  texto = fs.readFileSync(FUENTE, 'utf8')
} catch (error) {
  console.log('FALLA  no se puede leer src/utils/contract_precios.js (' + error.code + ')')
  fallos++
  corridas++
}

/** Un módulo nuevo (estado vacío) con las funciones que se prueban; las que no existen quedan undefined. */
function modulo_nuevo() {
  const sin_exports = texto.replace(/^export /gm, '')
  const lista = NOMBRES.map(n => 'typeof ' + n + " === 'undefined' ? undefined : " + n)
  return new Function(sin_exports + '\nreturn [' + lista.join(', ') + ']')()
}

/** Arma el objeto con nombres a partir de la lista que devuelve `modulo_nuevo`. */
function cargar() {
  const valores = modulo_nuevo()
  const m = {}
  NOMBRES.forEach((n, i) => { m[n] = valores[i] })
  return m
}

if (texto !== null) {
  /* ---- Existencia: sin estas funciones no hay nada que probar ---- */
  const base = cargar()
  const faltan = NOMBRES.filter(n => typeof base[n] !== 'function')
  igual('contract_precios.js exporta las funciones de la precarga desde la fuente', faltan, [])

  /* Control (verde hoy y después): sin fuente, el contrato nuevo conserva las constantes de siempre. */
  const control = {}
  base.iniciar_precios_por_sistema(control)
  igual('control: sin fuente un contrato nuevo arranca en USD con licencias 0 / 800 / 800',
    [control.contract_currency, ['gestion', 'ecommerce', 'agentes'].map(k => control.contract_precios_sistemas[k].licencia)], ['USD', [0, 800, 800]])
  cierto('control: un contrato con precios guardados se reconoce como guardado',
    base.tiene_condiciones_guardadas({ contract_plan_gestion: 'plus' }) === true)

  if (faltan.length === 0) {
    /* ================= 1. Contrato nuevo con la fuente cargada ================= */
    const m = cargar()
    cierto('la fuente válida se acepta', m.fijar_precios_vigentes(fuente_de_la_oferta()) === true)
    cierto('queda marcada como cargada', m.precios_vigentes_cargados() === true)

    const nuevo = {}
    cierto('un contrato vacío es nuevo: se precarga', m.precargar_precios_si_es_nuevo(nuevo) === true)
    /* El operador tilda los tres sistemas (la precarga cubre siempre los tres precios). */
    nuevo.contract_sistemas = ['gestion', 'ecommerce', 'agentes']
    m.actualizar_totales(nuevo)
    igual('moneda de la licencia ARS', nuevo.contract_currency, 'ARS')
    igual('moneda de la mensualidad ARS', nuevo.contract_mensualidad_moneda, 'ARS')
    igual('licencias de $628.400 en los tres (gestión ya no es 0)',
      ['gestion', 'ecommerce', 'agentes'].map(k => nuevo.contract_precios_sistemas[k].licencia), [628400, 628400, 628400])
    igual('mensualidad de gestión: la del plan Inicial', nuevo.contract_precios_sistemas.gestion.mensualidad, 55900)
    igual('mensualidad de tienda: $44.900', nuevo.contract_precios_sistemas.ecommerce.mensualidad, 44900)
    igual('mensualidad de agentes: paquete Inicial $46.750', nuevo.contract_precios_sistemas.agentes.mensualidad, 46750)
    igual('descuento conjunto: 30 % de 1.885.200 = 565.560', nuevo.contract_descuento_conjunto, 565560)
    igual('el contrato nuevo arranca con el plan Inicial elegido (la API le saca la foto al guardar)', nuevo.contract_plan_gestion, 'inicial')
    igual('y se ve con el rango de la fuente (vista previa de la foto: hasta 200)', [nuevo.contract_plan_gestion_foto.clave, nuevo.contract_plan_gestion_foto.hasta, nuevo.contract_plan_gestion_foto.abono_lista], ['inicial', 200, 55900])
    igual('el select del contrato nuevo marca Inicial con el rango de la fuente', m.opciones_de_plan(nuevo)[0].texto, 'Inicial — hasta 200 operaciones por mes')
    igual('con los tres, total de licencia = 1.319.640', m.resumen_precios(nuevo).total, 1319640)
    igual('contract_precio_licencia guarda el total', nuevo.contract_precio_licencia, '1319640')
    igual('contract_mensualidad_base suma las tres mensualidades', nuevo.contract_mensualidad_base, String(55900 + 44900 + 46750))
    igual('el abono mensual es editable a mano: el descuento y las licencias son números comunes', typeof nuevo.contract_descuento_conjunto, 'number')

    /* El descuento sólo vale con los tres sistemas. */
    const dos = JSON.parse(JSON.stringify(nuevo))
    dos.contract_sistemas = ['gestion', 'ecommerce']
    const r2 = m.resumen_precios(dos)
    igual('con dos sistemas no hay descuento', [r2.tres, r2.descuento, r2.total], [false, 0, 1256800])
    const uno = JSON.parse(JSON.stringify(nuevo))
    uno.contract_sistemas = ['gestion']
    igual('con un sistema el total es la licencia sola', m.resumen_precios(uno).total, 628400)

    /* Un contrato nuevo que arranca con sólo Gestión (el default de hoy). */
    const solo_gestion = {}
    m.precargar_precios_si_es_nuevo(solo_gestion)
    igual('sin sistemas elegidos arranca con Gestión', solo_gestion.contract_sistemas, ['gestion'])
    igual('con sólo Gestión: total $628.400 y abono $55.900', [solo_gestion.contract_precio_licencia, solo_gestion.contract_mensualidad_base], ['628400', '55900'])

    /* Plan de gestión: la mensualidad sale de la fuente. */
    m.elegir_plan_gestion(nuevo, 'intermedio')
    igual('elegir Intermedio precarga $85.400', [nuevo.contract_plan_gestion, nuevo.contract_precios_sistemas.gestion.mensualidad], ['intermedio', 85400])
    m.elegir_plan_gestion(nuevo, 'empresa')
    igual('elegir Empresa precarga $263.000', [nuevo.contract_plan_gestion, nuevo.contract_precios_sistemas.gestion.mensualidad], ['empresa', 263000])
    igual('el abono base se recalcula al elegir plan', nuevo.contract_mensualidad_base, String(263000 + 44900 + 46750))
    m.elegir_plan_gestion(nuevo, 'plus')
    igual('un plan que la fuente no ofrece (plus) no se puede elegir', nuevo.contract_plan_gestion, 'empresa')
    igual('elegir otro plan cambia la vista previa de la foto', nuevo.contract_plan_gestion_foto.clave, 'empresa')
    m.elegir_plan_gestion(nuevo, '')
    igual('la opción «Sin plan» sigue disponible: quita el plan y la foto sin tocar el importe', [nuevo.contract_plan_gestion, nuevo.contract_plan_gestion_foto, nuevo.contract_precios_sistemas.gestion.mensualidad], [null, null, 263000])

    /* Paquete de agentes. */
    igual('el selector de paquetes lista Inicial, Pro y Max',
      m.opciones_de_paquete_agentes().map(o => [o.clave, o.mensualidad]), [['inicial', 46750], ['pro', 80250], ['max', 147250]])
    igual('por defecto el contrato nuevo está en el paquete Inicial', m.paquete_agentes_del_contrato(nuevo), 'inicial')
    m.elegir_paquete_agentes(nuevo, 'pro')
    igual('elegir Pro pone $80.250', nuevo.contract_precios_sistemas.agentes.mensualidad, 80250)
    igual('y se ve como Pro', m.paquete_agentes_del_contrato(nuevo), 'pro')
    igual('el abono base suma el paquete Pro', nuevo.contract_mensualidad_base, String(263000 + 44900 + 80250))
    m.elegir_paquete_agentes(nuevo, 'max')
    igual('elegir Max pone $147.250', nuevo.contract_precios_sistemas.agentes.mensualidad, 147250)
    nuevo.contract_precios_sistemas.agentes.mensualidad = 50000
    igual('un importe cargado a mano no es ningún paquete', m.paquete_agentes_del_contrato(nuevo), '')
    m.elegir_paquete_agentes(nuevo, 'inexistente')
    igual('un paquete inexistente no toca el importe', nuevo.contract_precios_sistemas.agentes.mensualidad, 50000)

    /* El descuento es EXACTAMENTE lista − precio de `tres_juntos` (la fórmula única de la API, en pesos enteros). */
    const m25 = cargar()
    const f25 = fuente_con(25.55, [628400, 628400, 628400])
    m25.fijar_precios_vigentes(f25)
    const c25 = {}
    m25.precargar_precios_si_es_nuevo(c25)
    igual('descuento con 25,55 % = precio_lista − precio de la fuente (1.885.200 − 1.403.531)', c25.contract_descuento_conjunto, 481669)
    c25.contract_sistemas = ['gestion', 'ecommerce', 'agentes']
    igual('y el total de los tres coincide con el precio de la API', m25.resumen_precios(c25).total, f25.implementaciones.tres_juntos.precio)

    const m_raro = cargar()
    const f_raro = fuente_con(30, [628401, 628402, 628403])
    m_raro.fijar_precios_vigentes(f_raro)
    const c_raro = {}
    m_raro.precargar_precios_si_es_nuevo(c_raro)
    c_raro.contract_sistemas = ['gestion', 'ecommerce', 'agentes']
    m_raro.actualizar_totales(c_raro)
    igual('con items que no son múltiplos de 100 el descuento sigue siendo lista − precio', c_raro.contract_descuento_conjunto, f_raro.implementaciones.tres_juntos.precio_lista - f_raro.implementaciones.tres_juntos.precio)
    igual('y el total guardado es el precio de la API', c_raro.contract_precio_licencia, String(f_raro.implementaciones.tres_juntos.precio))

    /* ================= 2. El select de plan ================= */
    igual('el select de un contrato nuevo: los tres planes vigentes con sus rangos y ninguno deshabilitado',
      m.opciones_de_plan({ contract_plan_gestion: null, contract_precios_sistemas: nuevo.contract_precios_sistemas }).map(o => [o.clave, o.texto, !!o.disabled]),
      [['inicial', 'Inicial — hasta 200 operaciones por mes', false],
        ['intermedio', 'Intermedio — de 201 a 600 operaciones por mes', false],
        ['empresa', 'Empresa — operaciones ilimitadas', false]])

    const con_plus = { contract_plan_gestion: 'plus', contract_precios_sistemas: { gestion: { licencia: 0, mensualidad: 199400 } } }
    const opciones_plus = m.opciones_de_plan(con_plus)
    const plus = opciones_plus.find(o => o.clave === 'plus')
    cierto('un contrato con Plus lo muestra', !!plus)
    cierto('Plus aparece deshabilitado', plus && plus.disabled === true)
    cierto('Plus conserva su rango de la política anterior en el texto', plus && /^Plus — de 251 a 500 operaciones por mes/.test(plus.texto))
    igual('los vigentes siguen habilitados junto al Plus', opciones_plus.filter(o => o.clave !== 'plus').map(o => !!o.disabled), [false, false, false])
    cierto('a_medida guardado también se muestra deshabilitado',
      (m.opciones_de_plan({ contract_plan_gestion: 'a_medida', contract_precios_sistemas: { gestion: { licencia: 0, mensualidad: 400000 } } }).find(o => o.clave === 'a_medida') || {}).disabled === true)

    const historico = { contract_plan_gestion: 'inicial', contract_precios_sistemas: { gestion: { licencia: 0, mensualidad: 34200 } } }
    cierto('el inicial de $34.200 sigue siendo el histórico por ventas', m.plan_historico_del_contrato(historico) !== null)
    const opciones_hist = m.opciones_de_plan(historico).filter(o => o.clave === 'inicial')
    igual('del histórico: una opción por ventas y el Inicial vigente, las dos deshabilitadas',
      opciones_hist.map(o => !!o.disabled), [true, true])
    cierto('el texto del histórico dice 300 ventas', opciones_hist.some(o => /hasta 300 ventas por mes/.test(o.texto)))

    /* El rango del plan guardado es el que dice el PDF: con foto, el de la foto; sin foto, el de la política 3/11. */
    const foto_200 = { clave: 'inicial', nombre: 'Inicial', desde: 0, hasta: 200, usuarios: 1, excedente: 760, abono_lista: 55900, politica: '2026-11-21' }
    const guardado_con_foto = { contract_plan_gestion: 'inicial', contract_plan_gestion_foto: foto_200, contract_precios_sistemas: { gestion: { licencia: 628400, mensualidad: 55900 } } }
    igual('un contrato guardado con foto de 200 se reabre diciendo hasta 200', m.opciones_de_plan(guardado_con_foto)[0].texto, 'Inicial — hasta 200 operaciones por mes')
    const guardado_sin_foto = { contract_plan_gestion: 'inicial', contract_plan_gestion_foto: null, contract_precios_sistemas: { gestion: { licencia: 0, mensualidad: 55900 } } }
    const op_sin_foto = m.opciones_de_plan(guardado_sin_foto)
    igual('un plan vigente guardado SIN foto dice el rango de la política 3/11 (como el PDF): hasta 100', op_sin_foto[0].texto, 'Inicial — hasta 100 operaciones por mes')
    igual('las demás opciones salen de la fuente', op_sin_foto.slice(1).map(o => o.texto), ['Intermedio — de 201 a 600 operaciones por mes', 'Empresa — operaciones ilimitadas'])
    const f_150 = fuente_de_la_oferta()
    f_150.gestion.planes[0].hasta = 150
    f_150.gestion.planes[1].desde = 151
    const m_150 = cargar()
    m_150.fijar_precios_vigentes(f_150)
    igual('con la fuente editada a 150, el contrato con foto de 200 sigue diciendo 200 y las otras opciones siguen la fuente',
      m_150.opciones_de_plan(guardado_con_foto).map(o => o.texto).slice(0, 2), ['Inicial — hasta 200 operaciones por mes', 'Intermedio — de 151 a 600 operaciones por mes'])

    /* Si la fuente cambia el rango, el select lo sigue. */
    const f_otra = fuente_de_la_oferta()
    f_otra.gestion.planes[0].hasta = 150
    f_otra.gestion.planes[0].abono = 60000
    f_otra.gestion.planes[1].desde = 151
    const m_otra = cargar()
    m_otra.fijar_precios_vigentes(f_otra)
    igual('el select sigue lo que diga la fuente', m_otra.opciones_de_plan({}).map(o => o.texto).slice(0, 2),
      ['Inicial — hasta 150 operaciones por mes', 'Intermedio — de 151 a 600 operaciones por mes'])
    const c_otra = {}
    m_otra.precargar_precios_si_es_nuevo(c_otra)
    igual('y la mensualidad de gestión por defecto es el abono del plan Inicial de la fuente', c_otra.contract_precios_sistemas.gestion.mensualidad, 60000)

    /* ================= 3. Un contrato guardado no se recalcula ================= */
    const guardado = {
      contract_currency: 'USD',
      contract_precio_licencia: '1500',
      contract_mensualidad_base: '106100',
      contract_modalidad: 'licencia',
      contract_sistemas: ['gestion', 'ecommerce'],
      contract_plan_gestion: 'intermedio',
      contract_descuento_conjunto: 300,
      contract_precios_sistemas: {
        gestion: { licencia: 0, mensualidad: 85400 },
        ecommerce: { licencia: 800, mensualidad: 20000 },
        agentes: { licencia: 800, mensualidad: 30000 },
      },
    }
    const copia = JSON.parse(JSON.stringify(guardado))
    cierto('un contrato con precios guardados no es nuevo', m.precargar_precios_si_es_nuevo(guardado) === false)
    igual('y no cambia ni un campo al abrirlo', guardado, copia)

    const viejo_sin_desglose = { contract_client_name: 'Comercio Viejo', contract_currency: 'USD', contract_precio_licencia: '800' }
    const copia_vieja = JSON.parse(JSON.stringify(viejo_sin_desglose))
    cierto('un contrato viejo sin desglose pero con condiciones cargadas tampoco se precarga', m.precargar_precios_si_es_nuevo(viejo_sin_desglose) === false)
    igual('y queda igual', viejo_sin_desglose, copia_vieja)

    /* ================= 4. GET caído o inválido: fallback a las constantes de hoy ================= */
    const caido = cargar()
    let resultado_caida = 'sin resolver'
    const promesa_caida = caido.cargar_precios_vigentes(() => Promise.reject(new Error('Network Error'))).then(function (valor) {
      resultado_caida = valor
    })

    /* ================= 5. Un pedido por apertura (sin repetir los simultáneos), con timeout ================= */
    const por_apertura = cargar()
    let pedidos = 0
    const pedir = () => { pedidos++; return Promise.resolve({ data: fuente_de_la_oferta() }) }
    const promesa_una_vez = Promise.all([por_apertura.cargar_precios_vigentes(pedir), por_apertura.cargar_precios_vigentes(pedir)])
      .then(function () {
        igual('dos aperturas simultáneas comparten un solo pedido', pedidos, 1)
        cierto('y quedó cargada (res.data)', por_apertura.precios_vigentes_cargados() === true)
        return por_apertura.cargar_precios_vigentes(pedir)
      })
      .then(function () {
        igual('una apertura posterior vuelve a pedir la fuente (precios frescos)', pedidos, 2)
        const c = {}
        por_apertura.precargar_precios_si_es_nuevo(c)
        igual('con la fuente pedida por la red, el contrato nuevo sale en ARS', c.contract_currency, 'ARS')
        return por_apertura.cargar_precios_vigentes(() => Promise.reject(new Error('Network Error')))
      })
      .then(function () {
        cierto('si el pedido de la apertura falla, rige el fallback aunque antes hubiera llegado', por_apertura.precios_vigentes_cargados() === false)
        const inicio = Date.now()
        return por_apertura.cargar_precios_vigentes(() => new Promise(function () {}), 30).then(function () {
          cierto('un GET colgado se corta por timeout y se resuelve sin error', Date.now() - inicio < 1500)
          cierto('y rige el fallback', por_apertura.precios_vigentes_cargados() === false)
        })
      })

    /* ================= 5b. GET tardío: no pisa un contrato ya tocado o guardado ================= */
    const tardia = cargar()
    tardia.fijar_precios_vigentes(fuente_de_la_oferta())
    const sin_tocar = { contract_sistemas: [] }
    const firma_limpia = tardia.firma_de_condiciones(sin_tocar)
    sin_tocar.contract_sistemas = ['gestion', 'ecommerce']
    cierto('un contrato nuevo que sigue igual (los sistemas de la cotización no cuentan) recibe la precarga tardía', tardia.precargar_si_sigue_nuevo(sin_tocar, firma_limpia) === true)
    igual('y queda en ARS con el plan Inicial', [sin_tocar.contract_currency, sin_tocar.contract_plan_gestion], ['ARS', 'inicial'])

    const tocado = {}
    const firma_tocado = tardia.firma_de_condiciones(tocado)
    tocado.contract_client_name = 'Escribió el operador mientras esperaba'
    cierto('si el operador cargó una condición antes de que llegara la fuente, no se precarga', tardia.precargar_si_sigue_nuevo(tocado, firma_tocado) === false)
    cierto('y no se le inventó un desglose', !tocado.contract_precios_sistemas)

    const ya_con_precios = {}
    const firma_precios = tardia.firma_de_condiciones(ya_con_precios)
    ya_con_precios.contract_precios_sistemas = { gestion: { licencia: 1, mensualidad: 2 }, ecommerce: { licencia: 3, mensualidad: 4 }, agentes: { licencia: 5, mensualidad: 6 } }
    const copia_precios = JSON.parse(JSON.stringify(ya_con_precios))
    cierto('si el operador ya cargó los precios a mano, no se pisan', tardia.precargar_si_sigue_nuevo(ya_con_precios, firma_precios) === false)
    igual('y quedan como estaban', ya_con_precios, copia_precios)

    const guardado_tarde = JSON.parse(JSON.stringify(guardado))
    const firma_guardado = tardia.firma_de_condiciones({})
    cierto('un contrato guardado que se abrió sin desglose y trae condiciones no se precarga', tardia.precargar_si_sigue_nuevo({ contract_client_name: 'Viejo', contract_currency: 'USD' }, firma_guardado) === false)
    igual('el guardado completo no cambia', guardado_tarde, guardado)

    Promise.all([promesa_caida, promesa_una_vez]).then(function () {
      igual('GET caído: la promesa se resuelve sin error', resultado_caida === 'sin resolver', false)
      cierto('GET caído: la fuente no queda cargada', caido.precios_vigentes_cargados() === false)
      const c = {}
      cierto('GET caído: igual se precarga un contrato nuevo', caido.precargar_precios_si_es_nuevo(c) === true)
      igual('GET caído: moneda USD y mensualidad ARS como hoy', [c.contract_currency, c.contract_mensualidad_moneda], ['USD', 'ARS'])
      igual('GET caído: licencias 0 / 800 / 800 como hoy',
        ['gestion', 'ecommerce', 'agentes'].map(k => c.contract_precios_sistemas[k].licencia), [0, 800, 800])
      igual('GET caído: mensualidades 55.900 / 20.000 / 30.000 como hoy',
        ['gestion', 'ecommerce', 'agentes'].map(k => c.contract_precios_sistemas[k].mensualidad), [55900, 20000, 30000])
      igual('GET caído: sin descuento conjunto', c.contract_descuento_conjunto, 0)
      igual('GET caído: el select vuelve a la política del 3/11 con los cinco planes',
        caido.opciones_de_plan({}).map(o => [o.clave, !!o.disabled]),
        [['inicial', false], ['intermedio', false], ['plus', false], ['empresa', false], ['a_medida', false]])
      igual('GET caído: Inicial dice hasta 100 operaciones', caido.opciones_de_plan({})[0].texto, 'Inicial — hasta 100 operaciones por mes')
      caido.elegir_plan_gestion(c, 'plus')
      igual('GET caído: se puede elegir Plus y precarga $199.400', [c.contract_plan_gestion, c.contract_precios_sistemas.gestion.mensualidad], ['plus', 199400])
      igual('GET caído: sin paquetes de agentes', caido.opciones_de_paquete_agentes(), [])

      /* Respuestas que no son un contrato v2 usable: se ignoran. */
      const invalidas = {
        'objeto vacío': {},
        'forma vieja sin paquetes ni implementaciones': { version: 1, gestion: { planes: fuente_de_la_oferta().gestion.planes }, tienda: { mensualidad: 44900 }, agentes: { lite: {}, full: {} } },
        'sin planes': Object.assign(fuente_de_la_oferta(), { gestion: { planes: [] } }),
        'abono que no es número': (function () { const f = fuente_de_la_oferta(); f.gestion.planes[0].abono = 'mucho'; return f })(),
        'sin la mensualidad de tienda': Object.assign(fuente_de_la_oferta(), { tienda: {} }),
        'tres juntos sin precio': (function () { const f = fuente_de_la_oferta(); delete f.implementaciones.tres_juntos.precio; return f })(),
        'null': null,
      }
      Object.keys(invalidas).forEach(function (nombre) {
        const mm = cargar()
        cierto('fuente inválida (' + nombre + ') se rechaza', mm.fijar_precios_vigentes(invalidas[nombre]) === false)
        cierto('fuente inválida (' + nombre + ') deja el fallback', mm.precios_vigentes_cargados() === false)
      })

      /* ================= 6. Cableado en los componentes ================= */
      const leer = ruta => { try { return fs.readFileSync(path.join(RAIZ, ruta), 'utf8') } catch (e) { return '' } }
      const vista_precios = leer('src/components/lead/contract/PreciosPorSistema.vue')
      cierto('PreciosPorSistema.vue arma el select con opciones_de_plan', /opciones_de_plan/.test(vista_precios))
      cierto('PreciosPorSistema.vue tiene el selector de paquete de agentes', /elegir_paquete_agentes/.test(vista_precios) && /opciones_de_paquete_agentes/.test(vista_precios))
      const editor_lead = leer('src/components/lead/contract/Index.vue')
      cierto('el editor del lead pide la fuente y precarga con precargar_precios_si_es_nuevo',
        /cargar_precios_vigentes/.test(editor_lead) && /precargar_precios_si_es_nuevo/.test(editor_lead))
      cierto('el editor del lead ya no precarga con iniciar_precios_por_sistema a mano', !/iniciar_precios_por_sistema\(this\.record\)/.test(editor_lead))
      const editor_cliente = leer('src/components/client/ContratoTab.vue')
      cierto('la pestaña del cliente pide la fuente y precarga con precargar_precios_si_es_nuevo',
        /cargar_precios_vigentes/.test(editor_cliente) && /precargar_precios_si_es_nuevo/.test(editor_cliente))
      cierto('PreciosPorSistema.vue recibe la versión de la fuente para recalcular el select cuando llega', /version_fuente/.test(vista_precios))
      cierto('el editor del lead pide la fuente en cada apertura y avisa a PreciosPorSistema', /version_fuente/.test(editor_lead) && /precargar_si_sigue_nuevo/.test(editor_lead))
      cierto('la pestaña del cliente pide la fuente en cada apertura y avisa a PreciosPorSistema', /version_fuente/.test(editor_cliente) && /precargar_si_sigue_nuevo/.test(editor_cliente))
      cierto('el módulo no usa async/await (regla del repo)', !/\basync\b|\bawait\b/.test(texto))

      console.log('\n' + corridas + ' comprobaciones, ' + fallos + ' fallas')
      process.exit(fallos === 0 ? 0 : 1)
    })
  } else {
    console.log('\n' + corridas + ' comprobaciones, ' + fallos + ' fallas')
    process.exit(1)
  }
} else {
  console.log('\n' + corridas + ' comprobaciones, ' + fallos + ' fallas')
  process.exit(1)
}
