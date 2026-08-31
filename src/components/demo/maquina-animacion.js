/**
 * La máquina de la escena hero, reproducida como un WebP animado con alfa (misión de la
 * animación corregida, 31/8/2026). Reemplaza a `maquina-cuadros.js`, que reproducía una
 * tira de 120 cuadros WebP sueltos sobre un canvas 2D.
 *
 * Por qué el cambio: el export corregido de Claude Design cerró el loop de la máquina a
 * 24,75s (antes 12s). A la densidad de cuadro que usaba el esquema anterior, esa duración
 * no entra en el presupuesto de la página sin bajar a 6 cuadros por segundo -- y en
 * teléfono ni así entra (ver `scripts/generar-cuadros-maquina/README.md`). Un WebP animado
 * tiene compresión ENTRE cuadros, así que el mismo loop entero entra en unos pocos MB sin
 * recortar el frame rate.
 *
 * Qué se gana, además del peso: desaparece toda la maquinaria que existía solo para
 * reproducir una tira a mano -- `createImageBitmap`, el `canvas` 2D, el `requestAnimationFrame`
 * propio, el cálculo de qué cuadro toca dibujar, y los ~120 MB de `ImageBitmap` crudos en
 * memoria que obligaban a `soltar_cuadros()`. Un `<img>` con un WebP animado hace todo eso
 * solo, con alfa soportada en cualquier navegador evergreen (Chrome 32+, Firefox 65+,
 * Safari 14+).
 *
 * Qué se pierde: la pausa EXACTA del loop de la máquina cuando la escena sale de pantalla.
 * Un `<img>` no tiene `pause()`/`play()`; la única forma imperativa de cortarlo -- sacar y
 * reponer el `src` -- reinicia el loop desde el primer cuadro, que es peor que dejarlo
 * correr. Por eso `pausar()`/`reanudar()` acá son no-ops documentadas: el control de
 * `revisar_pausa()` en `EscenaHero.vue` sigue pausando la coreografía (que es donde está
 * el gasto real de CPU: trece elementos con `transform` reescrito 60 veces por segundo),
 * y el navegador ya frena solo la decodificación de una imagen fuera de viewport o con la
 * pestaña oculta.
 */

/** Dónde vive el manifiesto y los WebP. Sin `import`: son assets de `public/`, no del bundle. */
const BASE = '/demo/maquina/'

/**
 * La precarga en curso o ya resuelta, y cuántos reproductores la están usando. Vive a
 * nivel de módulo porque la piden dos componentes distintos (ScrollDolor, para que
 * arranque cuatro pantallas antes, y EscenaHero, por si el lead llegó directo) y tiene
 * que ser la misma descarga.
 */
let precarga = null
let usuarios = 0

/**
 * Perfil de tira según el ancho de la ventana. Mismo breakpoint que usa toda la página.
 *
 * @returns {string}
 */
function perfil_actual() {
  return typeof window !== 'undefined' && window.innerWidth <= 767.98 ? 'telefono' : 'escritorio'
}

/**
 * Precarga y decodifica el WebP animado del perfil actual.
 *
 * Nunca rechaza: si algo falla devuelve `null`, y el reproductor decide (muestra el
 * isotipo estático). Una página pública no puede quedarse con un hueco porque un archivo
 * dio 404.
 *
 * Idempotente: la primera llamada arranca el trabajo y las siguientes devuelven la misma
 * promesa.
 *
 * @returns {Promise<{url: string, aspecto: number, fraccion_borde: number}|null>}
 */
export function precargar_maquina() {
  if (precarga) {
    return precarga
  }
  if (typeof window === 'undefined' || !window.fetch || !window.Image) {
    precarga = Promise.resolve(null)
    return precarga
  }

  const perfil = perfil_actual()

  precarga = window
    .fetch(BASE + 'manifiesto.json', { credentials: 'omit' })
    .then(function (respuesta) {
      return respuesta.json()
    })
    .then(function (manifiesto) {
      const datos = manifiesto.perfiles.filter(function (p) {
        return p.nombre === perfil
      })[0]
      if (!datos) {
        return null
      }
      const url = BASE + datos.archivo
      const img = new window.Image()
      img.src = url
      /* `decode()` deja los píxeles listos antes de mostrar la imagen -- si sólo se
         precargara el `<img>` original, la primera pintura en pantalla igual tendría que
         decodificar, que es justo el tirón que esta precarga viene a sacar. Si el
         navegador no soporta `decode()` (muy viejo), se sigue igual: el `<img>` que
         crea `crear_reproductor()` decodifica al pintarse, como haría de todas formas. */
      const decodificado = img.decode ? img.decode().catch(function () {}) : Promise.resolve()
      return decodificado.then(function () {
        return {
          url: url,
          aspecto: manifiesto.aspecto,
          fraccion_borde: manifiesto.fraccion_borde,
        }
      })
    })
    .catch(function () {
      return null
    })

  return precarga
}

/**
 * Suelta la precarga cuando NADIE llegó a montar un reproductor con ella. Idempotente y
 * segura de llamar con la descarga a mitad de camino.
 *
 * @returns {void}
 */
export function soltar_maquina() {
  if (usuarios > 0 || !precarga) {
    return
  }
  precarga = null
}

/**
 * Monta el reproductor sobre `img_el` (el `<img>` del template).
 *
 * @param {HTMLImageElement} img_el
 * @param {object|null} datos Lo que resolvió precargar_maquina().
 * @returns {{set_progreso: function, relayout: function, pausar: function, reanudar: function, destruir: function, fraccion_borde_inferior: function}|null}
 *          null si no hay con qué mostrar -- el llamador muestra el isotipo estático.
 */
export function crear_reproductor(img_el, datos) {
  if (!img_el || !datos || !datos.url) {
    return null
  }

  usuarios += 1
  img_el.src = datos.url

  const aspecto = datos.aspecto || 1
  const fraccion_borde = typeof datos.fraccion_borde === 'number' ? datos.fraccion_borde : 0.578

  return {
    /**
     * Existe para no romperle el contrato a la coreografía, que la llama en cada cuadro
     * de scroll. El WebP animado no reacciona al progreso -- eso ya lo perdió la versión
     * de cuadros pre-renderizados en la misión 12. El resto de la escena sigue
     * reaccionando igual, incluido el resplandor del centro, que es CSS atado a `--power`.
     *
     * @returns {void}
     */
    set_progreso() {},

    /**
     * No hace falta recalcular nada propio: `object-fit: contain` en CSS hace todo el
     * trabajo de encuadre, y `fraccion_borde_inferior()` lee la caja actual en cada
     * llamada, no una cacheada.
     *
     * @returns {void}
     */
    relayout() {},

    /**
     * No-op documentada -- ver el docblock de cabecera de este módulo. Existe para que
     * `revisar_pausa()` en `EscenaHero.vue` tenga algo que llamar sin romper el contrato
     * que ya tenía con `maquina-cuadros.js`.
     *
     * @returns {void}
     */
    pausar() {},

    /**
     * @returns {void}
     */
    reanudar() {},

    /**
     * Dónde termina la máquina dibujada, como fracción de la altura de la CAJA que la
     * contiene (`.hero-escena__core-anchor`), medida desde arriba -- es lo que
     * `escena-coreografia.js` necesita para ubicar al comerciante asentado justo debajo.
     *
     * El WebP tiene su propio aspecto intrínseco (1,5) distinto del de la caja que lo
     * contiene, y se dibuja con `contain`: sobra margen arriba y abajo (si la caja es más
     * angosta que 1,5) o a los costados (si es más ancha). `fraccion_borde` viene medido
     * sobre los PÍXELES del asset (dónde termina el alfa, ver
     * `scripts/generar-cuadros-maquina/README.md`); acá se convierte ese número de
     * espacio-imagen a espacio-caja.
     *
     * 🔴 Si la caja todavía no tiene layout (`clientWidth`/`clientHeight` en 0 -- pasa si
     * el `<img>` disparó `@error` y Vue lo sacó del DOM antes de que esto se llame de
     * nuevo), NO se devuelve `fraccion_borde` crudo: ese número está en espacio-IMAGEN
     * (0,905) y quien llama lo trata como espacio-caja. Se devuelve el mismo fallback de
     * reposo (0,578) que usa `escena-coreografia.js` cuando no hay máquina en absoluto,
     * para no aterrizar el bloque asentado un cuarto de la caja más abajo de lo que
     * corresponde.
     *
     * @returns {number}
     */
    fraccion_borde_inferior() {
      const ancho_caja = img_el.clientWidth
      const alto_caja = img_el.clientHeight
      if (!ancho_caja || !alto_caja) {
        return 0.578
      }
      const alto_dibujado = Math.min(alto_caja, ancho_caja / aspecto)
      const margen_superior = (alto_caja - alto_dibujado) / 2
      return (margen_superior + fraccion_borde * alto_dibujado) / alto_caja
    },

    /**
     * @returns {void}
     */
    destruir() {
      usuarios -= 1
      if (usuarios <= 0) {
        usuarios = 0
        precarga = null
      }
    },
  }
}
