/**
 * Clausulas particulares reutilizables para el contrato de un lead.
 *
 * Se precargan en una fila editable de la pestana Contrato; el texto se puede ajustar antes de
 * guardar. Los saltos de linea se conservan en el PDF.
 */
export default [
  {
    key: 'produccion_automatica_al_vender',
    label: 'Desarrollo a medida — producción automática al vender',
    titulo: 'Desarrollo a medida: venta de productos elaborados con registro automático de producción',
    texto: `El PRESTADOR desarrollará e incorporará a la plataforma del CLIENTE, sin costo adicional al pago único establecido en la cláusula 3 ni a la mensualidad establecida en la cláusula 5, una funcionalidad a medida sobre el módulo de Producción, conforme al alcance que se detalla a continuación.

a) Funcionamiento estándar de la plataforma. El módulo de Producción permite dar de alta la receta de cada producto elaborado, con el detalle de los insumos que lo componen y las cantidades de cada uno. En el uso estándar, el CLIENTE debe registrar el movimiento de producción para que el sistema incremente el stock del producto elaborado y descuente el de los insumos utilizados; recién a partir de ese registro el producto elaborado queda disponible para la venta.

b) Objeto del desarrollo. El CLIENTE podrá vender un producto elaborado sin haber registrado previamente su fabricación. Al confirmarse la venta, el sistema interpretará que las unidades vendidas ya fueron fabricadas y generará automáticamente el movimiento de producción correspondiente a esas unidades, descontando los insumos conforme a la receta vigente del producto al momento de la venta. El CLIENTE conserva en todos los casos la posibilidad de registrar producciones de forma manual cuando así lo prefiera, sin que ello genere duplicación de movimientos ni de stock.

c) Trazabilidad. Los movimientos de producción generados automáticamente quedarán registrados y disponibles para consulta en el módulo de Producción, en las mismas condiciones que los registrados de forma manual, identificando el comprobante de venta que les dio origen.

d) Plazo de entrega. La funcionalidad estará disponible y operativa en el sistema del CLIENTE dentro de los treinta (30) días corridos contados desde la firma del presente contrato.

e) Propiedad intelectual. El desarrollo descrito en la presente cláusula integra la plataforma ComercioCity y queda alcanzado por lo dispuesto en la cláusula 7 en materia de propiedad intelectual, sin que su realización implique transferencia de derecho alguno al CLIENTE sobre el software o sus componentes.`,
  },
]
