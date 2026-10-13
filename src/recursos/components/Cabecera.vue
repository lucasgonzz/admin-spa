<template>
  <header class="cabecera">
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

    <div class="marca">
      <div class="logo" aria-hidden="true">CC</div>
      <div><b>Centro de recursos</b> <span>· ComercioCity</span></div>
    </div>

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
    <!-- Sin sesión: donde iría el avance va la línea que explica cómo guardarlo (§5.1). -->
    <div v-else class="total invitado">
      <p class="linea-invitado">{{ LINEA_INVITADO }}</p>
    </div>

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
        <p class="suave">Tu avance, tus votos y tus preguntas se guardan con tu usuario de ComercioCity.</p>
        <div class="pie">
          <button type="button" @click="cerrar_sesion">Salir</button>
        </div>
      </div>
    </div>

    <!-- Sin sesión: botón "Entrar" con la explicación (no hay formulario: se entra desde el sistema). -->
    <div v-else ref="zona" class="usuario">
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
          <li>En el menú, tocá <b>Centro de recursos</b>.</li>
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
import { estado, avance, salir } from '../estado'
import { inicial, LINEA_INVITADO } from '../utiles'

/**
 * Cabecera del centro: marca, avance total (o la línea de invitado) y el usuario (o "Entrar").
 */
export default {
  name: 'CabeceraCentro',
  data() {
    return {
      /** Estado compartido de la página. */
      estado: estado,
      /** Texto para invitados. */
      LINEA_INVITADO: LINEA_INVITADO,
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
