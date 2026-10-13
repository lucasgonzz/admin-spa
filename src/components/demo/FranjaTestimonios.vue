<template>
  <!-- v-if en la RAÍZ, mismo contrato que SeccionResenas.vue: si no queda ninguna reseña
       con negocio, este componente no pinta un solo píxel y la página pasa de la sección
       anterior a la siguiente como si no existiera. No hay estado vacío ni relleno. -->
  <section v-if="hay_testimonios" class="demo-testimonios">
    <div class="demo-testimonios__caja">
      <p class="demo-testimonios__rotulo">Lo que dicen los que ya trabajan así</p>

      <ul class="demo-testimonios__lista">
        <li
          v-for="(testimonio, indice) in testimonios"
          :key="indice"
          class="demo-testimonios__tarjeta"
        >
          <p class="demo-testimonios__frase">{{ testimonio.frase }}</p>

          <!-- El negocio va sólo cuando agrega algo, misma regla que SeccionResenas.vue: si
               el autor de la reseña ES el negocio (Innovate Materiales firma como Innovate
               Materiales), repetirlo abajo es leer dos veces lo mismo. -->
          <p class="demo-testimonios__autor">
            <span class="demo-testimonios__autor-nombre">{{ testimonio.autor }}</span>
            <span
              v-if="testimonio.negocio && testimonio.negocio !== testimonio.autor"
              class="demo-testimonios__autor-negocio"
            >{{ testimonio.negocio }}</span>
          </p>
        </li>
      </ul>
    </div>
  </section>
</template>

<script>
/**
 * 🔴 LOS TESTIMONIOS NO SE INVENTAN, Y ESTE ARCHIVO NO ES SU FUENTE.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * La fuente es `RESENAS` de SeccionResenas.vue, que a su vez es una copia a mano de la
 * ficha real de Google Business de ComercioCity (la cargó Lucas el 11/9/2026, misión
 * experiencia-landing). De ahí sale TODO lo de abajo:
 *
 * - `frase` es un recorte LITERAL de `texto`, cortado en el punto de la primera oración.
 *   No se reescribe, no se corrige la ortografía, no se le agregan ni se le sacan signos.
 *   La franja pide una frase donde la sección vieja mostraba la reseña entera: lo único
 *   que se hace es cortar, nunca redactar.
 * - `autor` y `negocio` van TAL COMO ESTÁN ESCRITOS ahí, con sus guiones y sus espacios.
 *
 * 🔴 Y la regla que decide QUIÉNES entran: sólo las reseñas cuyo `negocio` no es `null`.
 * De las cuatro reseñas con texto de la ficha, dos no dicen de qué negocio son (Elkri
 * ticon y Sergio Srebernich) y por eso NO están acá -- deducirles un rubro a ojo sería
 * fabricar el dato que les falta. Quedan dos, y dos es lo que se muestra: si algún día la
 * ficha trae una tercera con negocio, se agrega acá a mano (y se refresca SeccionResenas
 * en la misma pasada, que es la fuente).
 *
 * Por qué una copia y no un import de `RESENAS`: lo que se muestra es un RECORTE, y un
 * recorte automático sobre un texto escrito por otra persona corta donde no debe. La
 * referencia cruzada se sostiene a mano, igual que la ficha de Google.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * @type {Array<{autor: string, negocio: string|null, frase: string}>}
 */
const TESTIMONIOS = [
  {
    autor: 'Innovate Materiales',
    negocio: 'Innovate Materiales',
    frase: 'Excelente el programa, súper completo y la atención de Lucas un 10!',
  },
  {
    autor: 'Secure Point - Del Viso -',
    negocio: 'Secure Point',
    frase: 'Muy buen sistema de gestión financiera, muy sencillo de entender y usar !',
  },
]

/**
 * La franja de testimonios de la página de experiencia (13/10/2026, misión
 * demo-dos-horas-y-experiencia).
 *
 * REEMPLAZA a <seccion-resenas>, que contaba lo mismo pero largo: cuatro reseñas enteras,
 * el promedio y la cantidad de la ficha de Google, y tres testimonios en video de Mariel.
 * La página pasó a tener UN solo mensaje ("nos encargamos de todo, te lo entregamos
 * andando") y esta franja es su prueba social, dicha en dos frases y puesta al lado del
 * formulario. SeccionResenas.vue NO se borró: dejó de montarse en ScrollDolor.vue y sigue
 * siendo la fuente de estos textos.
 *
 * 🔴 Va SUELTA en el scroll, no dentro de un <fondo-seccion-sticky>, y eso tiene dos
 * consecuencias que hay que mantener juntas:
 *   · su punto de enganche es ELLA MISMA, así que `.demo-testimonios` tiene que estar en
 *     `SELECTOR_DESTINOS` de avance-guiado.js y recibir `scroll-snap-align: center` de
 *     demo-experiencia.scss -- exactamente lo que tenían `.demo-hitos`, `.demo-nueva-era` y
 *     `.demo-resenas`, las tres secciones en flujo que esta misión retiró del recorrido. Si
 *     falta cualquiera de las dos cosas, el gesto guiado la saltea sin que nada falle: no
 *     hay error, no hay log.
 *   · no hay progreso de sección del que colgar una coreografía, igual que pasaba con
 *     `.demo-hitos`. La franja es estática a propósito: dos frases cortas no necesitan
 *     entrada animada, y esta página se define por restricción.
 */
export default {
  name: 'FranjaTestimonios',

  computed: {
    /* Por `computed` y no por `data`, mismo criterio que SeccionClientes.vue y
       SeccionResenas.vue: lo que entra a data() lo vuelve Vue un proxy reactivo, y esto es
       una constante de módulo. */

    /** @returns {Array} */
    testimonios() {
      return TESTIMONIOS
    },

    /** @returns {boolean} */
    hay_testimonios() {
      return TESTIMONIOS.length > 0
    },
  },
}
</script>

<style scoped>
/* La sección ocupa como MÍNIMO una pantalla, igual que `.demo-hitos` (ver el comentario
   largo de esa regla en demo-experiencia.scss): con `scroll-snap-type: y mandatory` en el
   scroller, una sección más baja que el viewport deja ver un resto de la sección anterior
   arriba y de la siguiente abajo cuando el gesto la centra. min-height y no height: con dos
   tarjetas no hace falta, pero una tercera en teléfono crece y acá no tiene techo.

   100dvh preferido con 100vh de fallback, mismo orden que el resto de la página: un
   navegador sin soporte de dvh ignora esa declaración entera y se queda con la de arriba. */
.demo-testimonios {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12vh 20px;
  box-sizing: border-box;
  min-height: 100vh;
  min-height: 100dvh;
}

.demo-testimonios__caja {
  width: 100%;
  max-width: 980px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(24px, 4vh, 44px);
}

/* Rótulo, no titular: el titular de la página es el de la apertura y esta franja es una
   nota al pie de ese mensaje. Mismo tratamiento que `.demo-resenas__rotulo`. */
.demo-testimonios__rotulo {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--demo-color-texto-suave);
  text-align: center;
}

.demo-testimonios__lista {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
  display: grid;
  /* `auto-fit` + `minmax` y no `repeat(2, 1fr)`: con dos tarjetas quedan lado a lado en
     escritorio y tablet, y en teléfono caen a una columna solas -- sin media query, y sin
     romperse si algún día entra una tercera. */
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: clamp(16px, 2.4vw, 28px);
}

/* La piel de la tarjeta sale de la que ya usan `.demo-hitos__tarjeta`,
   `.demo-nueva-era__pilar` y `.demo-resenas__tarjeta`: la superficie de la paleta oscura,
   no un gris inventado para acá. */
.demo-testimonios__tarjeta {
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: var(--demo-color-superficie);
  border: 1px solid var(--demo-color-borde-superficie);
  box-shadow: 0 24px 60px -32px rgba(0, 0, 0, 0.45);
  border-radius: 20px;
  padding: clamp(20px, 3vw, 32px);
  box-sizing: border-box;
}

.demo-testimonios__frase {
  margin: 0;
  font-size: clamp(1.05rem, 2vw, 1.3rem);
  line-height: 1.45;
  font-weight: 600;
  color: var(--demo-color-texto);
}

.demo-testimonios__autor {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.92rem;
}

.demo-testimonios__autor-nombre {
  font-weight: 600;
  color: var(--demo-color-texto);
}

.demo-testimonios__autor-negocio {
  color: var(--demo-color-texto-suave);
}
</style>
