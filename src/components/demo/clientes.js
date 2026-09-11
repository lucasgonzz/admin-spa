/**
 * Índice de logos de clientes reales de ComercioCity, para la sección de clientes de la
 * página de experiencia (SeccionClientes.vue).
 *
 * PORTADO de `comerciocity-web/src/data/clients.js` (10/9/2026). No es un import: los dos
 * repos no comparten nada, así que esto es una copia y hay que mantenerla a mano. Si Lucas
 * suma un cliente allá, acá no aparece solo.
 *
 * ⚠️ Los archivos NO son los mismos bytes que los de `comerciocity-web`. Allá pesan 8,9 MB
 * en total (Ferretotal solo son 1,9 MB, Chevrocar 1,4 MB). Esta página es pública y la
 * mayoría de los leads la abre del teléfono, así que entraron recomprimidos: lado largo a
 * 320 px y WebP calidad 82 → **283 KB los 38 juntos**. 320 px alcanza y sobra: el tile más
 * grande de la pared mide ~90 px de CSS, o sea 320 px cubre 2× de densidad de pantalla.
 * Los nombres también se normalizaron a slug (los originales traen espacios, mayúsculas y
 * el nombre del dueño: `"Truvari - Fernando bebidas cordoba.jpg"`).
 *
 * 🔴 Si hay que rehacerlos, se leen de `C:\wamp64\www\comerciocity-web\src\assets\clients\`
 * y se escriben acá. **Nunca al revés**: ese clon es donde Lucas trabaja a mano.
 */

/**
 * URL final del logo, resuelta por Vite. El literal de plantilla no es cosmético: Vite
 * necesita ver el patrón para armar el glob de `../../assets/clients/*.webp` en build --
 * con una variable armada por concatenación no emite ningún asset y en producción quedan
 * 35 imágenes rotas que en `npm run dev` se ven perfectas.
 *
 * @param {string} id Slug del cliente, que es también el nombre del archivo.
 * @returns {string}
 */
export function logo_cliente(id) {
  return new URL(`../../assets/clients/${id}.webp`, import.meta.url).href
}

/**
 * Los primeros 38 logos (índices 0 a 37), en el mismo orden que el índice de
 * `comerciocity-web`. De ahí en más (11/9/2026) sigue una segunda tanda con una fuente
 * distinta -- ver el bloque de comentario propio más abajo, antes de `servian`.
 *
 * **Los nombres NO son los del índice original.** Allá varios entran con el nombre de pila
 * del dueño ("Christian", "Ernesto", "Fernando", "Roberto") porque así llegó el archivo por
 * WhatsApp. Acá va el nombre del COMERCIO, leído del propio logo: es lo que se le lee a un
 * lector de pantalla (`alt`) y "Christian" no le dice nada a nadie.
 *
 * `en_la_pared: false` marca los tres archivos que no se muestran. Los tres se revisaron
 * uno por uno mirando la imagen, no el nombre del archivo -- por el nombre no se notaba
 * ninguno de los tres:
 *
 * - `fernando` es EXACTAMENTE el mismo logo que `panchito` (Despensa Panchito; Fernando es
 *   el dueño). En la pared aparecían dos veces las mismas letras, a diez casillas de
 *   distancia.
 * - `trama-luis` no es un logo: es una pieza de un sorteo de fin de año de Trama, con
 *   "SORTEO Fin de año" y las bases arriba. El logo de Trama es `trama`.
 * - `sr-imperio` muestra **CrediHogar**, no Sr. Imperio; y `sr-imperio-gerardo` sí muestra
 *   el logo de Sr. Imperio. Como el índice de origen los da a los dos como el mismo cliente
 *   (misma casa de electrodomésticos, dos marcas), va uno solo, y va el que dice el nombre
 *   con el que figura el cliente. ⚠️ Si Lucas confirma que CrediHogar es un comercio
 *   aparte, se le saca el `en_la_pared: false` y listo -- la grilla banca cualquier número.
 */
export const clientes = [
  { id: 'golonorte', nombre: 'Distribuidora Golonorte' },
  { id: 'fenix', nombre: 'Fenix Mayorista' },
  { id: '3dtisk', nombre: '3D Tisk' },
  { id: 'angeles-bad-girls', nombre: 'Bad Girls' },
  { id: 'arfren', nombre: 'Arfren Autopartes' },
  { id: 'chevrocar', nombre: 'Chevrocar' },
  { id: 'christian', nombre: 'Distribuidora CF' },
  { id: 'desire', nombre: 'Tienda Desire' },
  { id: 'ernesto', nombre: 'Ferretería San Cayetano' },
  { id: 'ferreteria-san-blas', nombre: 'Ferretería San Blas' },
  // Mismo logo que `panchito`, letra por letra.
  { id: 'fernando', nombre: 'Despensa Panchito', en_la_pared: false },
  { id: 'ferremas', nombre: 'Ferremas' },
  { id: 'ferretotal', nombre: 'Ferretotal Matheu' },
  { id: 'mza-group', nombre: 'MZA Group' },
  { id: 'sr-imperio-gerardo', nombre: 'Sr. Imperio' },
  { id: 'golden-breeze', nombre: 'Golden Breeze' },
  { id: 'hb-distribuciones', nombre: 'HB Distribuciones' },
  { id: 'hipermax', nombre: 'Hiper-Max' },
  { id: 'ht5', nombre: 'Hitotes' },
  { id: 'innovate', nombre: 'Innovate Materiales' },
  { id: 'la-martina', nombre: 'Despensa La Martina' },
  // No es un logo: es la pieza de un sorteo de fin de año de Trama.
  { id: 'trama-luis', nombre: 'Trama Ferretería', en_la_pared: false },
  { id: 'masquito', nombre: 'Masquito' },
  { id: 'matias-galvan', nombre: 'Matías Galván' },
  { id: 'mb-malizia', nombre: 'MB Malizia' },
  { id: 'golden-bike', nombre: 'Goldenbike Tandil' },
  { id: 'oliva', nombre: 'Ferretería Oliva' },
  { id: 'distri-creo', nombre: 'Creo Distribuidora' },
  { id: 'panchito', nombre: 'Despensa Panchito' },
  { id: 'racing-carts', nombre: '2R Racing Parts' },
  { id: 'renacer-joyas', nombre: 'Renacer Joyas' },
  { id: 'roberto', nombre: 'Ferretería Rober' },
  { id: 'ffperformance', nombre: 'FF Performance' },
  // La otra marca de Sr. Imperio; ver la nota de arriba.
  { id: 'sr-imperio', nombre: 'CrediHogar', en_la_pared: false },
  { id: 'trama', nombre: 'Trama Ferretería' },
  { id: 'truvari', nombre: 'Truvari' },
  { id: 'kiosco-verde', nombre: 'Kiosco Verde' },
  { id: 'servian', nombre: 'Servian Repuestos' },

  /**
   * TANDA DEL 11/9/2026 -- fuente distinta de la de arriba, ver punto 8 del plan
   * `experiencia-ajustes`. Estos 9 son clientes activos (medido contra `clients` +
   * `client_apis` del admin de producción, vía `GET claude/query`) que a esa fecha NO
   * tenían logo ni en este archivo ni en `comerciocity-web`: 13 candidatos en total, de los
   * que quedaron afuera 4 (no se fuerza un logo malo, mismo criterio que ya dejó `fernando`/
   * `trama-luis`/`sr-imperio` arriba):
   *   - `Distribuidora Pets` (client id 51): activo en el admin pero SIN una sola
   *     `client_api` -- no hay servidor al que conectarse, quedó promovido y nunca instalado
   *     (mismo caso que `mayorista-de-pesca`, que por eso tampoco entra a este archivo).
   *   - `Leudinox`, `Electro-Lacarra` y `DobleP Herrajes` SÍ tienen base propia, pero las
   *     tres apuntan al MISMO `image_url` roto (`api-demo.comerciocity.com/.../174292591094040.png`,
   *     HTTP 404): es el avatar por defecto que les quedó cuando nunca subieron uno propio,
   *     ya ni siquiera existe en el servidor. Ninguna tiene `online_configurations.logo_url`
   *     (corren una versión de `empresa-api` anterior a esa columna). Nada que mostrar.
   *
   * De dónde sale cada logo: NO es `comerciocity-web` (ahí no están). Se resolvió leyendo,
   * en la base física de CADA cliente (por SSH -- shared hosting o VPS según
   * `client_apis.hosting_type`, mismo patrón de conexión que `liberar-sesion.php` /
   * `auditar-extension.php` en el repo de conocimiento), dos campos que carga el propio
   * dueño desde su panel: `online_configurations.logo_url` ("Logo de la tienda", visible en
   * `empresa-spa` en Configuración > Tienda online) cuando estaba cargado, y si no
   * `users.image_url` (la imagen de perfil del dueño, `owner_id IS NULL`) como respaldo.
   * Ni `Client` (esa tabla en `empresa-api` es la CARTERA DE CLIENTES del propio comercio --
   * sus compradores -- no un dato del comercio en sí) ni ningún campo `web`/`sitio_web`
   * sirvieron: no existen en el schema real de `empresa-api` (se buscó en las migraciones).
   * Mismo procesamiento que el resto del archivo: lado largo 320px, WebP calidad ~82, sin
   * agrandar el que ya venía más chico (`pack-descartables` quedó en 295px nativos).
   */
  {
    id: 'securepoint',
    nombre: 'Secure Point',
    // image_url del dueño (no tenía logo_url: version vieja de empresa-api sin esa columna).
    // https://api-sistema.comerciocity.com/public/storage/174904540312127.png
  },
  {
    id: 'la-cava-de-don-juan',
    nombre: 'La Cava de Don Juan',
    // online_configurations.logo_url:
    // https://api-lacava.comerciocity.com/public/storage/178112516421146.webp
  },
  {
    id: 'punto-diet',
    nombre: 'Punto Diet',
    // image_url del dueño. Cliente de la base compartida vieja (u767360347_empresa, 51
    // dueños adentro): se identificó por company_name entre esos 51, no por owner_id solo.
    // https://api-empresa.comerciocity.com/public/storage/169342241618138.png
  },
  {
    id: 'grupolimp',
    nombre: 'Grupo Limp',
    // online_configurations.logo_url. Único de la tanda en VPS (los otros ocho, shared hosting).
    // https://api-grupolimp.comerciocity.com/public/storage/178682276210664.webp
  },
  {
    id: 'unicas',
    nombre: 'Unicas Distribuidora Capilar',
    // image_url del dueño. PNG con canal alfa (fondo transparente) -- se aplanó sobre blanco
    // antes de recomprimir, para quedar igual que el resto (ninguno de los otros 46 es
    // transparente).
    // https://api-unicas.comerciocity.com/public/storage/178515615168755.png
  },
  {
    id: 'tiju',
    nombre: 'Distribuidora Tiju',
    // online_configurations.logo_url. El nombre sale del logo ("DISTRIBUIDORA TIJU"): el
    // company_name del admin tiene una errata ("Tiju dustribuidora").
    // https://api-bellabianca2.comerciocity.com/public/storage/178485466369771.webp
  },
  {
    id: 'quino2',
    nombre: 'Grupo Quino2',
    // online_configurations.logo_url. El "2" es parte del logo mismo, no un artefacto de
    // carpeta: se mantiene en el id y en el nombre tal como lo muestra la marca.
    // https://api-quino2.comerciocity.com/public/storage/178817704974853.webp
  },
  {
    id: 'pack-descartables',
    nombre: 'Pack Descartables',
    // image_url del dueño. Nativo 295px de lado largo -- ya venía por debajo de 320 y no se
    // agrandó (la regla del pipeline es no perder calidad de más, no llegar siempre a 320).
    // https://api-pack-descartables.comerciocity.com/public/storage/172610521219797.png
  },
  {
    id: 'candyguay',
    nombre: 'Candyguay',
    // image_url del dueño. VPS, base propia (copia podada del 7/9/2026, ver CLAUDE.md raíz
    // "varios clientes comparten la misma base") -- NO comparte base con otros clientes pese
    // a que el admin todavía le marca shared_database_group_id=1 de su historia vieja.
    // https://api.comerciocity.com/public/storage/169876004418610.png
  },
]

/**
 * Los que efectivamente van a la pared de logos: hoy **44** (35 de la tanda de
 * `comerciocity-web` + 9 de la tanda del 11/9/2026, ninguno de estos nueve con
 * `en_la_pared: false`).
 *
 * El número no está atado a la grilla y no hace falta que sea "redondo": la pared es un
 * flex con `justify-content: center`, así que la última fila queda centrada aunque esté
 * incompleta. Se puede agregar o sacar un logo sin tocar una sola regla de CSS.
 */
export const logos_clientes = clientes
  .filter((cliente) => cliente.en_la_pared !== false)
  .map((cliente) => ({
    id: cliente.id,
    nombre: cliente.nombre,
    logo: logo_cliente(cliente.id),
  }))

/**
 * Clientes con tienda online real: los primeros ocho portados del índice de
 * `comerciocity-web`, los demás sumados el 11/9/2026 (misión experiencia-landing).
 *
 * 🔴 `plataforma` no está en el original y se agregó acá a propósito: no todas las tiendas
 * las hicimos nosotros. Las de `'comerciocity'` son nuestra tienda (`tienda-spa`, sobre la
 * misma base que el sistema); las de `'tiendanube'` son tiendas de **Tienda Nube**
 * conectadas al sistema por la integración (el catálogo y el stock salen de acá, la
 * vidriera es de ellos).
 *
 * Hasta el 11/9/2026 la sección mostraba SOLO las de `'comerciocity'`, para no decir
 * "tiendas hechas con esta plataforma" de una que no hicimos. Ese día Lucas cambió la
 * decisión: las de Tienda Nube también se muestran, porque están integradas al sistema y
 * eso es exactamente lo que se le vende al lead ("vendé en todos lados"). Lo que evita la
 * afirmación falsa ya no es esconderlas: es la etiqueta por plataforma que cada tarjeta
 * lleva en SeccionClientes.vue ("Tienda ComercioCity" / "Tienda Nube"). Por eso el campo
 * tiene que ser VERDADERO tienda por tienda -- se mira el HTML de la tienda, no el nombre
 * del cliente (ver la nota de `trama`).
 *
 * `activa: false` saca una tienda de la página sin borrar su entrada: es para las que hoy
 * no se pueden abrir. El número que se muestra sale de `tiendas_de_clientes`, nunca
 * escrito a mano.
 */
export const clientes_ecommerce = [
  {
    id: 'ferretotal',
    nombre: 'Ferretotal',
    rubro: 'Ferretería',
    url: 'https://ferretotalmatheu.com.ar/',
    plataforma: 'comerciocity',
  },
  {
    id: 'hb-distribuciones',
    nombre: 'HB Distribuciones',
    rubro: 'Ferretería',
    url: 'https://hb-distribuciones.com.ar/',
    plataforma: 'comerciocity',
  },
  {
    id: 'trama',
    nombre: 'Trama',
    rubro: 'Ferretería',
    url: 'https://tramaferreteria.com.ar/',
    // Venía como 'comerciocity' del índice de la web, y NO lo es: medido el 11/9/2026, el
    // HTML de tramaferreteria.com.ar es una vidriera de Tienda Nube
    // (`LS.store.url = "tramaferreteria.mitiendanube.com"`, `custom_url` el dominio propio),
    // sin rastro de tienda-spa. Con la etiqueta por plataforma en la tarjeta, dejarlo como
    // estaba le pondría "Tienda ComercioCity" a una tienda que no hicimos.
    plataforma: 'tiendanube',
  },
  {
    id: 'truvari',
    nombre: 'Truvari',
    rubro: 'Distribuidora de bebidas',
    url: 'https://truvaribebidas.com.ar/',
    plataforma: 'comerciocity',
  },
  {
    id: 'fenix',
    nombre: 'Fenix',
    rubro: 'Juguetería mayorista',
    url: 'https://fenix-mayorista.com.ar/',
    plataforma: 'comerciocity',
  },
  {
    id: 'golonorte',
    nombre: 'Golonorte',
    rubro: 'Distribuidora',
    url: 'https://golonorte.com.ar/',
    plataforma: 'comerciocity',
  },
  {
    id: 'matias-galvan',
    nombre: 'Galván Mayorista',
    rubro: 'Distribuidora',
    url: 'https://galvanmayorista.com.ar/',
    plataforma: 'comerciocity',
  },
  {
    id: 'racing-carts',
    nombre: 'Racing Parts',
    rubro: 'Importadora',
    url: 'https://dosrracingparts.mitiendanube.com/',
    plataforma: 'tiendanube',
    // Tienda suspendida al 11/9/2026: la URL responde "La tienda fue momentáneamente
    // suspendida" (título de la página, medido ese día). Se vuelve a prender cuando Lucas
    // pase otra URL, o la misma si la reactivan -- la entrada queda para no perder el dato.
    activa: false,
  },

  /* ── Sumadas el 11/9/2026 (misión experiencia-landing). URLs verificadas ese día
     (HTTP 200) y plataforma confirmada mirando el HTML de cada una: las tres de
     `'comerciocity'` sirven la shell de tienda-spa; las tres de `'tiendanube'` traen la
     vidriera de Tienda Nube. El rubro sale de lo que la propia tienda dice de sí misma
     cuando el plan no lo traía (Golden Breeze: "arenas para gato, alimentos húmedos";
     3DTisk: "venta de impresoras 3D, insumos, repuestos"). ── */
  {
    id: 'tiju',
    nombre: 'Tiju Distribuidora',
    rubro: 'Distribuidora',
    url: 'https://tijudistribuidora.com.ar/',
    plataforma: 'comerciocity',
  },
  {
    id: 'grupolimp',
    nombre: 'Grupo Limp',
    rubro: 'Limpieza',
    url: 'https://grupolimp.com.ar/',
    plataforma: 'comerciocity',
  },
  {
    id: 'quino2',
    nombre: 'Quino2',
    rubro: 'Distribuidora',
    url: 'https://quino2.com.ar/',
    plataforma: 'comerciocity',
  },
  {
    id: 'unicas',
    nombre: 'Unicas',
    rubro: 'Productos capilares',
    url: 'https://unicas.com.ar/',
    plataforma: 'comerciocity',
    // 🔴 Apagada a propósito, y es distinto de lo que decía el plan del 11/9/2026 (que la
    // traía como tienda activa). Medido ese mismo día: unicas.com.ar responde 200 pero es
    // un sitio institucional estático (Bootstrap, hecho por xentsoft.com) que sólo enlaza
    // a WhatsApp, Facebook e Instagram -- no hay carrito ni catálogo, no es una tienda. En
    // el admin de producción tampoco hay un `client_ecommerce` de Unicas (sí lo hay para
    // tiju, grupolimp y quino2), y ni tienda.unicas.com.ar ni api.unicas.com.ar resuelven.
    // Mostrarla bajo "también venden por internet" sería falso. Si Lucas pasa la URL de
    // una tienda real, se cambia `url` y se saca esta línea.
    activa: false,
  },
  {
    id: 'golden-breeze',
    nombre: 'Golden Breeze',
    rubro: 'Mascotas',
    url: 'https://goldenbreeze.mitiendanube.com/',
    plataforma: 'tiendanube',
  },
  {
    id: 'innovate',
    nombre: 'Innovate Materiales',
    rubro: 'Materiales de construcción',
    url: 'https://www.innovatemateriales.com.ar/',
    plataforma: 'tiendanube',
  },
  {
    id: '3dtisk',
    nombre: '3DTisk',
    rubro: 'Impresión 3D',
    url: 'https://3dtisk.com.ar/',
    plataforma: 'tiendanube',
  },
].map((cliente) => ({
  ...cliente,
  logo: logo_cliente(cliente.id),
}))

/**
 * Las tiendas que la página muestra: las activas, de las DOS plataformas (decisión de
 * Lucas del 11/9/2026, ver el comentario de `clientes_ecommerce`). Reemplaza a
 * `tiendas_comerciocity`, que filtraba por `plataforma === 'comerciocity'` y ya no la
 * importa nadie.
 */
export const tiendas_de_clientes = clientes_ecommerce.filter((cliente) => cliente.activa !== false)
