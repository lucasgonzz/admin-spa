<template>
  <header class="cabecera" :class="{ 'con-soporte': solo_lectura }">
    <!-- Marca: el logotipo de ComercioCity, siempre lo primero de la izquierda (misión
         centro-recursos-soporte-y-tema, 14/10/2026; antes era un cuadrado azul con "CC"). Va importado
         desde src/assets para que Vite lo compile con hash a `assets/`: en producción el sitio solo
         enlaza `index.html`, `assets/`, `favicon.svg` y `recursos-estado.json`, y un archivo suelto
         en `public/` no se serviría. -->
    <div class="marca">
      <img class="logo" :src="logo" alt="ComercioCity" width="121" height="28" />
      <b>Centro de recursos</b>
    </div>

    <!-- Solo en ≤ 860 px: abre el cajón de carpetas. -->
    <button
      type="button"
      class="abrir-carpetas"
      aria-label="Ver carpetas"
      :aria-expanded="estado.cajon ? 'true' : 'false'"
      @click="estado.cajon = !estado.cajon"
    >
      ☰ Carpetas
    </button>

    <!-- Modo soporte (login maestro, solo lectura): se ve el avance del dueño pero la página no guarda
         nada. La insignia lo deja a la vista todo el tiempo; la explicación completa va en el
         desplegable del usuario. -->
    <span v-if="solo_lectura" class="modo-soporte" role="status">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      Modo soporte · solo lectura
    </span>

    <!-- Con sesión: el avance total, en verde. -->
    <div v-if="estado.usuario" class="total">
      <div class="rotulo">
        <span>Tu avance en el centro</span>
        <span><b>{{ texto_porcentaje }} %</b> · {{ total.hechos }} de {{ total.n }} videos</span>
      </div>
      <div
        class="barra"
        role="progressbar"
        aria-label="Tu avance en el centro"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="Math.round(total.pct * 100)"
      >
        <i :style="{ width: (total.pct * 100).toFixed(1) + '%' }" />
      </div>
    </div>
    <!-- Sin sesión la cabecera no repite la línea de invitado: ya va debajo del título del video
         y en Preguntas. Queda el botón "Entrar" con la explicación. -->

    <!-- Interruptor de tema claro / oscuro (misión centro-recursos-soporte-y-tema, 14/10/2026). Con y sin
         sesión, y también en el teléfono (ahí se esconde el texto, no el control). El texto es su
         nombre accesible; `aria-checked` es "oscuro". -->
    <button
      type="button"
      class="tema"
      role="switch"
      title="Tema oscuro"
      :aria-checked="oscuro ? 'true' : 'false'"
      @click="alternar_tema"
    >
      <span class="tema-texto">Tema oscuro</span>
      <span class="pista" aria-hidden="true">
        <span class="perilla">
          <svg v-if="oscuro" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.3 5.3L7 7M17 17l1.7 1.7M18.7 5.3L17 7M7 17l-1.7 1.7" />
          </svg>
        </span>
      </span>
    </button>

    <!-- Con sesión: avatar, nombre y negocio (el negocio solo se lo ve el propio usuario). -->
    <div v-if="estado.usuario" ref="zona" class="usuario">
      <button
        type="button"
        class="boton-usuario"
        :aria-expanded="menu_abierto ? 'true' : 'false'"
        :aria-label="'Tu cuenta: ' + nombre_visible"
        @click="menu_abierto = !menu_abierto"
      >
        <span class="avatar" aria-hidden="true">{{ inicial_usuario }}</span>
        <span class="quien">
          <span>{{ nombre_visible }}</span>
          <small v-if="estado.usuario.negocio">{{ estado.usuario.negocio }}</small>
        </span>
      </button>
      <div v-if="menu_abierto" class="desplegable" role="dialog" aria-label="Tu cuenta">
        <p>
          <b>{{ estado.usuario.nombre || nombre_visible }}</b>
          <template v-if="estado.usuario.negocio"><br /><span class="suave">{{ estado.usuario.negocio }}</span></template>
        </p>
        <p v-if="solo_lectura" class="suave">
          <b>Modo soporte · solo lectura.</b> Estás viendo el avance de {{ estado.usuario.nombre || nombre_visible }}
          tal como está. No se guarda nada de lo que hagas acá: ni el avance, ni los votos, ni las preguntas, ni la encuesta.
        </p>
        <p v-else class="suave">Tu avance, tus votos y tus preguntas se guardan con tu usuario de ComercioCity.</p>
        <div class="pie">
          <button type="button" @click="cerrar_sesion">Salir</button>
        </div>
      </div>
    </div>

    <!-- Sin sesión: botón "Entrar" con la explicación (no hay formulario: se entra desde el sistema). -->
    <div v-else ref="zona" class="usuario solo">
      <button
        type="button"
        class="verde"
        :aria-expanded="menu_abierto ? 'true' : 'false'"
        @click="menu_abierto = !menu_abierto"
      >
        Entrar
      </button>
      <div v-if="menu_abierto" class="desplegable" role="dialog" aria-labelledby="titulo-entrar">
        <h2 id="titulo-entrar">Cómo entrar con tu usuario</h2>
        <ol>
          <li>Abrí tu sistema de ComercioCity e iniciá sesión como siempre.</li>
          <li>En el menú, tocá <b>Tutoriales</b>.</li>
        </ol>
        <p>Se abre esta misma página con tu nombre, y desde ahí se guarda tu avance, tus votos y tus preguntas.</p>
        <p class="suave">Si sos el dueño, también podés entrar con el link personal que te mandamos por mail.</p>
        <div class="pie">
          <button type="button" @click="menu_abierto = false">Entendido</button>
        </div>
      </div>
    </div>
  </header>
</template>

<script>
import { estado, avance, salir, es_solo_lectura } from '../estado'
import { estado_tema, alternar_tema } from '../tema'
import { inicial } from '../utiles'
/** Logotipo con la palabra en BLANCO: va sobre el panel oscuro. */
import LOGO_PARA_OSCURO from '../../assets/logotipo-comerciocity.png'
/** Logotipo con la palabra en azul oscuro: va sobre el panel claro (el nombre del archivo habla del texto, no del fondo). */
import LOGO_PARA_CLARO from '../../assets/logotipo-comerciocity-oscuro.png'

/**
 * Cabecera del centro: logotipo, avance total, interruptor de tema y el usuario; sin sesión, el
 * logotipo, el interruptor y "Entrar".
 */
export default {
  name: 'CabeceraCentro',
  data() {
    return {
      /** Estado compartido de la página. */
      estado: estado,
      /** true con el desplegable del usuario (o la explicación de "Entrar") abierto. */
      menu_abierto: false,
    }
  },
  computed: {
    /**
     * Avance de todo el catálogo.
     * @returns {{ pct: number, hechos: number, n: number }}
     */
    total() {
      return avance(this.estado.videos)
    },
    /**
     * Porcentaje para el rótulo ("menos de 1" en vez de un 0 engañoso, como el prototipo).
     * @returns {string|number}
     */
    texto_porcentaje() {
      return this.total.pct > 0 && this.total.pct < 0.01 ? 'menos de 1' : Math.round(this.total.pct * 100)
    },
    /**
     * Nombre que se muestra arriba: el de pila si vino, si no el completo.
     * @returns {string}
     */
    nombre_visible() {
      /** Usuario de la sesión. */
      const u = this.estado.usuario || {}
      return u.nombre_pila || u.nombre || ''
    },
    /**
     * Letra del avatar.
     * @returns {string}
     */
    inicial_usuario() {
      return inicial(this.nombre_visible)
    },
    /**
     * true si la sesión es de soporte (login maestro): solo lectura.
     * @returns {boolean}
     */
    solo_lectura() {
      return es_solo_lectura()
    },
    /**
     * true con el tema oscuro puesto.
     * @returns {boolean}
     */
    oscuro() {
      return estado_tema.tema === 'dark'
    },
    /**
     * Logotipo del tema vigente.
     * @returns {string}
     */
    logo() {
      return this.oscuro ? LOGO_PARA_OSCURO : LOGO_PARA_CLARO
    },
  },
  watch: {
    /** Al entrar o salir se cierra el desplegable que estuviera abierto. */
    'estado.usuario'() {
      this.menu_abierto = false
    },
  },
  mounted() {
    document.addEventListener('click', this.al_clic_afuera)
    document.addEventListener('keydown', this.al_tocar_tecla)
  },
  beforeUnmount() {
    document.removeEventListener('click', this.al_clic_afuera)
    document.removeEventListener('keydown', this.al_tocar_tecla)
  },
  methods: {
    alternar_tema: alternar_tema,
    /**
     * Cierra el desplegable con un clic fuera de él.
     * @param {MouseEvent} ev
     * @returns {void}
     */
    al_clic_afuera(ev) {
      if (this.menu_abierto && this.$refs.zona && !this.$refs.zona.contains(ev.target)) {
        this.menu_abierto = false
      }
    },
    /**
     * Cierra el desplegable con Escape.
     * @param {KeyboardEvent} ev
     * @returns {void}
     */
    al_tocar_tecla(ev) {
      if (ev.key === 'Escape' && this.menu_abierto) {
        this.menu_abierto = false
      }
    },
    /**
     * Sale de la sesión del centro en este navegador.
     * @returns {void}
     */
    cerrar_sesion() {
      this.menu_abierto = false
      salir()
    },
  },
}
</script>
