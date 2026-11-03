<template>
  <!--
    El local (misión el-local, 3/11/2026). Marco oscuro propio (el admin no tiene modo oscuro):
    cabecera con el resumen, la escena y, en vertical, los botones de cámara. Los datos vienen de
    GET /local/escena cada 60 s (molde: views/Inicio.vue) y, si hay Pusher, antes: un mensaje de
    soporte o de un lead adelanta el refresco.
  -->
  <div ref="raiz" class="ell" :class="{ 'ell--vertical': vertical }">
    <header class="ell-cabecera">
      <div class="ell-marca">
        <svg viewBox="0 0 256 256" aria-hidden="true">
          <defs>
            <linearGradient id="ell-hg" x1="128" y1="8" x2="128" y2="248" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#0B84F8" />
              <stop offset="1" stop-color="#3A31FC" />
            </linearGradient>
          </defs>
          <g fill="none" stroke="url(#ell-hg)" stroke-width="33">
            <path d="M 61.79 49.1 A 103 103 0 0 1 187.08 43.62" />
            <path d="M 52.67 198.24 A 103 103 0 0 1 52.67 57.76" />
            <path d="M 217.2 179.5 A 103 103 0 0 1 61.79 206.9" />
          </g>
          <g fill="url(#ell-hg)">
            <rect x="75.5" y="140" width="28" height="52" rx="3" />
            <rect x="114" y="115" width="28" height="77" rx="3" />
            <rect x="152.5" y="93" width="28" height="99" rx="3" />
          </g>
          <path fill="#FA7E06" d="M 205 64 L 178.5 75 Q 193.5 76.4 195.5 92 Z" />
        </svg>
        <h1 class="ell-titulo">El local</h1>
        <small>ComercioCity</small>
      </div>

      <div class="ell-vivo" :class="'ell-vivo--' + conexion" role="status" aria-live="polite">
        <span class="ell-punto" aria-hidden="true" />
        <span>{{ texto_vivo }}</span>
      </div>

      <div class="ell-chips">
        <component
          :is="chip.accion ? 'button' : 'span'"
          v-for="chip in chips"
          :key="'ell-chip-' + chip.clave"
          :type="chip.accion ? 'button' : null"
          class="ell-chip"
          :class="{ 'ell-chip--accion': !!chip.accion }"
          :title="chip.titulo"
          @click="chip.accion ? on_abrir_bandeja() : null"
        >
          <i :style="{ background: chip.color }" aria-hidden="true" />
          <b>{{ chip.numero }}</b>
          <span>{{ chip.rotulo }}</span>
        </component>
      </div>
    </header>

    <!--
      Aviso cuando los datos no se pudieron traer. El caso esperable es la SPA nueva contra un admin
      todavía sin la ruta (404/405): se avisa y la escena queda quieta, nunca una pantalla en
      blanco ni un bucle de reintentos.
    -->
    <div v-if="aviso" class="ell-aviso" role="alert">
      <i class="bi bi-exclamation-triangle-fill" aria-hidden="true" />
      <span>{{ aviso }}</span>
    </div>

    <div ref="escenario" class="ell-escenario">
      <div
        class="ell-marco"
        :style="{ width: marco.w + 'px', height: marco.h + 'px' }"
      >
        <el-local-escena
          :estado="estado"
          :camara="camara_efectiva"
          :aspecto="aspecto"
          @bandeja="on_abrir_bandeja"
        />

        <div v-if="primera_carga" class="ell-cargando" role="status">
          <span class="spinner-border spinner-border-sm" aria-hidden="true" />
          <span>Abriendo el local…</span>
        </div>

        <!-- Lo que espera en la bandeja «Para Lucas», con link a su pantalla cuando la hay. -->
        <section v-if="mostrar_bandeja" class="ell-bandeja" aria-label="Para Lucas">
          <div class="ell-bandeja__cabecera">
            <span>Para Lucas <b>{{ bandeja.length }}</b></span>
            <button type="button" class="ell-bandeja__cerrar" aria-label="Cerrar" @click="mostrar_bandeja = false">
              <i class="bi bi-x-lg" aria-hidden="true" />
            </button>
          </div>
          <p v-if="bandeja.length === 0" class="ell-bandeja__vacia">No hay nada esperando.</p>
          <ul v-else class="ell-bandeja__lista">
            <li v-for="item in bandeja" :key="'ell-b-' + item.id" class="ell-bandeja__item">
              <span class="ell-bandeja__tipo" :style="{ background: item.color }">{{ item.tipo_texto }}</span>
              <router-link v-if="item.ruta" :to="item.ruta" class="ell-bandeja__titulo">{{ item.titulo }}</router-link>
              <span v-else class="ell-bandeja__titulo">{{ item.titulo }}</span>
              <span class="ell-bandeja__hace">{{ item.hace }}</span>
            </li>
          </ul>
        </section>
      </div>

      <nav v-if="vertical" ref="camaras" class="ell-camaras" aria-label="Cámara">
        <button
          v-for="cam in camaras"
          :key="'ell-cam-' + cam.id"
          type="button"
          :class="{ on: camara === cam.id }"
          :aria-pressed="camara === cam.id ? 'true' : 'false'"
          @click="on_camara(cam.id)"
        >
          {{ cam.texto }}
        </button>
      </nav>
    </div>
  </div>
</template>

<script>
import api from '@/utils/axios'
import ElLocalEscena from './Escena.vue'

/** Cada cuánto se vuelve a pedir la escena (Lucas: «cada ~1 minuto, no segundo a segundo»). */
const POLL_MS = 60000

/** En el modo de prueba (solo desarrollo, ?mock=1) el estado cambia más seguido para ver la animación. */
const POLL_MOCK_MS = 12000

/** Un evento de Pusher adelanta el refresco, agrupando los que lleguen en estos milisegundos. */
const DEBOUNCE_VIVO_MS = 3000

/**
 * La API cachea la escena 20 s. Si el refresco adelantado devolvió un cálculo anterior al evento,
 * se pide otra vez cuando vence ese cache (con este margen).
 */
const CACHE_SERVIDOR_MS = 21000

/** Canales públicos (los mismos que usa el resto del admin) y eventos que adelantan el refresco. */
const SUSCRIPCIONES_VIVO = [
  ['support.admins', '.SupportMessageReceived'],
  ['support.admins', '.SupportTicketUpdated'],
  ['support.admins', '.SupportTicketEscalated'],
  ['leads.admins', '.LeadConversationUpdated'],
  ['leads.admins', '.LeadSuggestionCreated'],
]

/** Rótulo y color de cada tipo de ítem de la bandeja (contrato B: `bandeja[].tipo`). */
const TIPOS_BANDEJA = {
  caso_delegado: { texto: 'Caso', color: '#25D366' },
  revision: { texto: 'Revisión', color: '#8B5CF6' },
  mision_pendiente: { texto: 'Misión', color: '#3A31FC' },
  aprobacion: { texto: 'Aprobar', color: '#FA7E06' },
  tarea: { texto: 'Tarea', color: '#0B84F8' },
}

/** Botones de cámara (solo en vertical). */
const CAMARAS = [
  { id: 'mostrador', texto: 'Mostrador' },
  { id: 'oficinas', texto: 'Oficinas' },
  { id: 'entrada', texto: 'Entrada' },
  { id: 'todo', texto: 'Todo' },
]

/** Hoja de Geist (solo esta vista la usa; el admin va con Inter). */
const GEIST_HREF = 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&display=swap'

export default {
  name: 'ElLocalIndex',
  components: { ElLocalEscena },
  data() {
    return {
      /** Último JSON bueno de GET /local/escena (congelado: no hace falta que sea reactivo por dentro). */
      estado: null,
      /** true mientras el GET está en vuelo. */
      cargando: false,
      /** true hasta que vuelve (bien o mal) el primer pedido. */
      primera_carga: true,
      /** Texto del aviso ('' si todo bien). */
      aviso: '',
      /** 'ok' | 'error' | 'cargando': el color del punto «en vivo». */
      conexion: 'cargando',
      /** Momento con el que se calcula el «hace N s»; se refresca cada segundo. */
      ahora: Date.now(),
      /** Pantalla más alta que ancha: chips en dos columnas, marco 4:5 y cámaras. */
      vertical: false,
      /** Teléfono (menos de 768 px de ancho): arranca en la cámara del mostrador. */
      telefono: false,
      /** Cámara elegida en vertical. */
      camara: 'mostrador',
      /** true cuando el operador tocó un botón de cámara: desde ahí no se la cambia sola. */
      camara_elegida: false,
      /** Tamaño del marco de la escena, en píxeles. */
      marco: { w: 0, h: 0 },
      /** Lista de la bandeja abierta. */
      mostrar_bandeja: false,
    }
  },
  computed: {
    /**
     * Modo de prueba sin API: SOLO en desarrollo (`npm run dev`) y con `?mock=1`. En el build de
     * producción `import.meta.env.DEV` es false y el fixture ni siquiera se empaqueta.
     *
     * @returns {boolean}
     */
    modo_mock() {
      return !!(import.meta.env.DEV && this.$route && this.$route.query && this.$route.query.mock === '1')
    },
    /** En apaisado siempre se ve todo el local; las cámaras son para el teléfono. */
    camara_efectiva() {
      return this.vertical ? this.camara : 'todo'
    },
    /** Ancho / alto del marco. */
    aspecto() {
      if (!this.marco.w || !this.marco.h) {
        return 1.6
      }
      return this.marco.w / this.marco.h
    },
    camaras() {
      return CAMARAS
    },
    /** `resumen` de la escena (vacío si no hay datos). */
    resumen() {
      return (this.estado && this.estado.resumen) || {}
    },
    /**
     * Chips de la cabecera. Sin dato, guion: un 0 diría «no hay nada», que es justamente lo que
     * no se sabe.
     *
     * @returns {Array<Object>}
     */
    chips() {
      const r = this.resumen
      const n = function (v) {
        return typeof v === 'number' ? String(v) : '—'
      }
      const lista = [
        { clave: 'abiertos', numero: n(r.negocios_abiertos), rotulo: 'negocios abiertos', color: '#22C55E' },
        { clave: 'cerrados', numero: n(r.negocios_cerrados), rotulo: 'cerrados', color: '#64748B' },
      ]
      if (typeof r.negocios_sin_horario === 'number' && r.negocios_sin_horario > 0) {
        lista.push({ clave: 'sin-horario', numero: n(r.negocios_sin_horario), rotulo: 'sin horario', color: '#CBD5E1' })
      }
      lista.push({ clave: 'tickets', numero: n(r.tickets_abiertos), rotulo: 'tickets abiertos', color: '#25D366' })
      lista.push({ clave: 'lucas', numero: n(r.para_lucas), rotulo: 'para Lucas', color: '#FA7E06', accion: true, titulo: 'Ver lo que espera en la bandeja' })
      lista.push({ clave: 'misiones', numero: n(r.misiones_en_curso), rotulo: 'misiones en curso', color: '#3A31FC' })
      lista.push({
        clave: 'slots',
        numero: n(r.slots_libres),
        rotulo: 'slots libres',
        color: '#94A3B8',
        titulo: typeof r.slots_total === 'number' ? r.slots_libres + ' de ' + r.slots_total + ' slots libres' : null,
      })
      return lista
    },
    /**
     * «En vivo · actualizado hace N s» a partir de `calculado_en` (que puede venir del cache de
     * 20 s de la API, y eso también se le cuenta).
     *
     * @returns {string}
     */
    texto_vivo() {
      if (this.conexion === 'cargando' && !this.estado) {
        return 'Conectando…'
      }
      if (!this.estado) {
        return 'Sin datos'
      }
      const calculado = new Date(this.estado.calculado_en).getTime()
      let base = 'En vivo'
      if (this.conexion === 'error') {
        base = 'Sin conexión'
      }
      if (isNaN(calculado)) {
        return base
      }
      const s = Math.max(0, Math.floor((this.ahora - calculado) / 1000))
      if (s < 60) {
        return base + ' · actualizado hace ' + s + ' s'
      }
      const m = Math.floor(s / 60)
      if (m < 60) {
        return base + ' · actualizado hace ' + m + ' min'
      }
      return base + ' · actualizado a las ' + new Date(calculado).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    },
    /** Ítems de la bandeja, listos para la lista. */
    bandeja() {
      const lista = (this.estado && Array.isArray(this.estado.bandeja) && this.estado.bandeja) || []
      const ahora = this.ahora
      return lista.filter(Boolean).map(function (b) {
        const tipo = TIPOS_BANDEJA[b.tipo] || { texto: 'Otro', color: '#64748B' }
        const t = new Date(b.creado_at).getTime()
        let hace = ''
        if (!isNaN(t)) {
          const min = Math.max(0, Math.floor((ahora - t) / 60000))
          hace = min < 1 ? 'recién' : min < 60 ? 'hace ' + min + ' min' : min < 1440 ? 'hace ' + Math.floor(min / 60) + ' h' : 'hace ' + Math.floor(min / 1440) + ' d'
        }
        return {
          id: b.id,
          titulo: b.titulo || 'Sin título',
          tipo_texto: tipo.texto,
          color: tipo.color,
          ruta: typeof b.ruta === 'string' && b.ruta.charAt(0) === '/' ? b.ruta : null,
          hace: hace,
        }
      })
    },
  },
  watch: {
    camara() {
      this.$nextTick(this.medir)
    },
    vertical() {
      this.$nextTick(this.medir)
    },
  },
  mounted() {
    this.montado = true
    this.cargar_geist()
    this.leer_pantalla(true)
    this.medir()

    /* El marco se ajusta al lugar que queda (cambia con el menú, la ventana, la rotación). */
    if (typeof ResizeObserver !== 'undefined') {
      this.observador = new ResizeObserver(this.programar_medir)
      this.observador.observe(this.$refs.escenario)
    }
    window.addEventListener('resize', this.on_resize)

    this.cargar()
    this.poll_id = window.setInterval(this.cargar, this.modo_mock ? POLL_MOCK_MS : POLL_MS)
    this.tic_id = window.setInterval(this.on_tic, 1000)
    /* Volver a la pestaña es cuando de verdad se mira: ahí se refresca sin esperar el minuto. */
    document.addEventListener('visibilitychange', this.on_visibility_change)
    this.suscribir_vivo()
  },
  beforeUnmount() {
    /* 🔴 Todo se limpia acá: un setInterval o un listener que sobrevive al desmontaje sigue
       pidiendo el endpoint para siempre (ya pasó en este proyecto). */
    this.montado = false
    if (this.poll_id) {
      window.clearInterval(this.poll_id)
      this.poll_id = null
    }
    if (this.tic_id) {
      window.clearInterval(this.tic_id)
      this.tic_id = null
    }
    if (this.debounce_id) {
      window.clearTimeout(this.debounce_id)
      this.debounce_id = null
    }
    if (this.reintento_id) {
      window.clearTimeout(this.reintento_id)
      this.reintento_id = null
    }
    if (this.raf_medir) {
      window.cancelAnimationFrame(this.raf_medir)
      this.raf_medir = null
    }
    if (this.observador) {
      this.observador.disconnect()
      this.observador = null
    }
    window.removeEventListener('resize', this.on_resize)
    document.removeEventListener('visibilitychange', this.on_visibility_change)
    this.desuscribir_vivo()
  },
  methods: {
    /* ---------------------------------------------------------------- datos */

    /**
     * Pide la escena a la API (o al fixture en el modo de prueba).
     *
     * `silent_error: true`: el aviso se muestra en la vista; sin esto el interceptor tiraría un
     * toast por minuto, y el caso más probable (SPA nueva contra API vieja, 404) no es un
     * problema del operador.
     *
     * @returns {Promise<void>|undefined}
     */
    cargar() {
      if (this.cargando || !this.montado) {
        return
      }
      const self = this
      self.cargando = true
      if (!self.estado) {
        self.conexion = 'cargando'
      }
      const pedido = self.modo_mock
        ? self.cargar_mock()
        : api.get('/local/escena', { silent_error: true }).then(function (r) {
            return r.data
          })
      return pedido
        .then(function (data) {
          if (!self.montado) {
            return
          }
          /* Un 200 que no es la escena (p. ej. el index.html de un servidor mal apuntado) se
             trata como error: la escena no se toca. */
          if (!data || typeof data !== 'object' || !Array.isArray(data.negocios)) {
            throw new Error('respuesta sin la forma de la escena')
          }
          self.estado = Object.freeze(data)
          self.aviso = ''
          self.conexion = 'ok'
          self.ahora = Date.now()
          self.programar_reintento_por_cache(data)
        })
        .catch(function (error) {
          if (!self.montado) {
            return
          }
          const status = error && error.response ? error.response.status : null
          self.conexion = 'error'
          if (status === 404 || status === 405) {
            self.aviso =
              'Todavía no se puede ver El local: esta pantalla es más nueva que el servidor. ' +
              'Se arregla en la próxima actualización del admin.'
          } else if (self.estado) {
            self.aviso = 'No se pudo actualizar El local; se ve lo último que llegó. Se vuelve a intentar solo.'
          } else {
            self.aviso = 'No se pudo traer El local. Se vuelve a intentar en un minuto.'
          }
        })
        .finally(function () {
          self.cargando = false
          self.primera_carga = false
        })
    },
    /**
     * Modo de prueba: un estado del fixture, que avanza un paso en cada refresco para que se vean
     * las entradas, salidas, caminatas y la mesa nueva. El `import()` está adentro del `if` de
     * DEV a propósito: en el build de producción la rama desaparece y el fixture no se empaqueta.
     *
     * @returns {Promise<Object>}
     */
    cargar_mock() {
      const self = this
      if (import.meta.env.DEV) {
        return import('./escena/fixture-dev.js').then(function (m) {
          const paso = self.paso_mock || 0
          self.paso_mock = paso + 1
          return m.estado_de_prueba(paso)
        })
      }
      return Promise.reject(new Error('el modo de prueba es solo de desarrollo'))
    },
    /**
     * Si el refresco adelantado por Pusher devolvió un cálculo anterior al evento (cache de 20 s
     * de la API), se pide otra vez cuando ese cache vence. Una sola vez por evento.
     *
     * @param {Object} data
     * @returns {void}
     */
    programar_reintento_por_cache(data) {
      if (!this.evento_vivo_ms) {
        return
      }
      const calculado = new Date(data.calculado_en).getTime()
      const evento = this.evento_vivo_ms
      this.evento_vivo_ms = null
      if (isNaN(calculado) || calculado >= evento) {
        return
      }
      const espera = Math.min(CACHE_SERVIDOR_MS + 4000, Math.max(1000, calculado + CACHE_SERVIDOR_MS - Date.now()))
      if (this.reintento_id) {
        window.clearTimeout(this.reintento_id)
      }
      const self = this
      this.reintento_id = window.setTimeout(function () {
        self.reintento_id = null
        self.cargar()
      }, espera)
    },

    /* ---------------------------------------------------------------- Pusher (opcional) */

    /**
     * Escucha los canales públicos de soporte y leads para adelantar el refresco. `window.admin_support_echo`
     * es null si el admin no tiene Pusher configurado: entonces queda solo el poleo.
     *
     * 🔴 Se usa `stopListening(evento, callback)` al salir, NUNCA `echo.leave(canal)`: esos
     * canales los usan también el menú y la bandeja de soporte, y dejarlos los apagaría para todo
     * el admin.
     *
     * @returns {void}
     */
    suscribir_vivo() {
      const echo = window.admin_support_echo
      if (!echo || this.modo_mock) {
        return
      }
      const self = this
      this.suscripciones = []
      SUSCRIPCIONES_VIVO.forEach(function (par) {
        try {
          echo.channel(par[0]).listen(par[1], self.on_evento_vivo)
          self.suscripciones.push(par)
        } catch (e) {
          /* sin canal: queda el poleo */
        }
      })
    },
    desuscribir_vivo() {
      const echo = window.admin_support_echo
      if (!echo || !this.suscripciones) {
        return
      }
      const self = this
      this.suscripciones.forEach(function (par) {
        try {
          echo.channel(par[0]).stopListening(par[1], self.on_evento_vivo)
        } catch (e) {
          /* nada que limpiar */
        }
      })
      this.suscripciones = null
    },
    /**
     * Algo se movió en soporte o en leads: refresco anticipado, agrupando los eventos que lleguen
     * en los próximos 3 s (con tope: una ráfaga larga no posterga el refresco para siempre).
     *
     * @returns {void}
     */
    on_evento_vivo() {
      if (!this.evento_vivo_ms) {
        this.evento_vivo_ms = Date.now()
      }
      if (this.debounce_id) {
        return
      }
      const self = this
      this.debounce_id = window.setTimeout(function () {
        self.debounce_id = null
        self.cargar()
      }, DEBOUNCE_VIVO_MS)
    },

    /* ---------------------------------------------------------------- pantalla y cámara */

    /** Agrega la hoja de Geist si todavía no está. */
    cargar_geist() {
      if (document.querySelector('link[href="' + GEIST_HREF + '"]')) {
        return
      }
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = GEIST_HREF
      document.head.appendChild(link)
    },
    /**
     * Lee la forma de la pantalla. En vertical, mientras el operador no haya elegido una cámara,
     * arranca en el mostrador en el teléfono y en «todo» en la tablet.
     *
     * @param {boolean} inicial
     */
    leer_pantalla(inicial) {
      const vertical = window.innerWidth < window.innerHeight
      const telefono = window.innerWidth < 768
      if (vertical && (inicial || !this.camara_elegida)) {
        this.camara = telefono ? 'mostrador' : 'todo'
      }
      this.vertical = vertical
      this.telefono = telefono
    },
    on_resize() {
      this.leer_pantalla(false)
      this.programar_medir()
    },
    programar_medir() {
      if (this.raf_medir) {
        return
      }
      const self = this
      this.raf_medir = window.requestAnimationFrame(function () {
        self.raf_medir = null
        self.medir()
      })
    },
    /**
     * Tamaño del marco: en apaisado, el 16:10 más grande que entra; en vertical, todo el ancho y
     * 4:5 para una zona (16:10 si se mira todo), sin pasarse del alto disponible.
     *
     * @returns {void}
     */
    medir() {
      const el = this.$refs.escenario
      if (!el) {
        return
      }
      /* clientWidth/clientHeight incluyen el padding del escenario: se descuenta. */
      const estilo = window.getComputedStyle(el)
      const aw = Math.max(0, el.clientWidth - (parseFloat(estilo.paddingLeft) || 0) - (parseFloat(estilo.paddingRight) || 0))
      let ah = Math.max(0, el.clientHeight - (parseFloat(estilo.paddingTop) || 0) - (parseFloat(estilo.paddingBottom) || 0))
      if (this.vertical) {
        const nav = this.$refs.camaras
        ah -= (nav ? nav.offsetHeight : 52) + 8
        const r = this.camara === 'todo' ? 0.625 : 1.2
        const h = Math.max(220, Math.min(ah, aw * r))
        this.marco = { w: Math.floor(aw), h: Math.floor(h) }
        return
      }
      const s = Math.min(aw / 1600, ah / 1000)
      this.marco = { w: Math.floor(1600 * s), h: Math.floor(1000 * s) }
    },
    on_camara(id) {
      this.camara = id
      this.camara_elegida = true
    },

    /* ---------------------------------------------------------------- varios */

    on_tic() {
      this.ahora = Date.now()
    },
    on_visibility_change() {
      if (document.visibilityState !== 'visible') {
        return
      }
      this.cargar()
    },
    on_abrir_bandeja() {
      this.mostrar_bandeja = !this.mostrar_bandeja
    },
  },
}
</script>

<style scoped>
/* ---------- Marco oscuro propio de la vista (el admin no tiene modo oscuro) ---------- */
.ell {
  --ell-azul: #0b84f8;
  --ell-violeta: #3a31fc;
  --ell-naranja: #fa7e06;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #0b1220;
  color: #fff;
  border-radius: 14px;
  padding: 0 16px 12px;
  font-family: Geist, Inter, system-ui, sans-serif;
  overflow: hidden;
}

/* ---------- Cabecera ---------- */
.ell-cabecera {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 12px 2px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  flex-shrink: 0;
}
.ell-marca {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.ell-marca svg {
  width: 28px;
  height: 28px;
}
.ell-titulo {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: #fff;
}
.ell-marca small {
  font-weight: 500;
  color: #8fa0b8;
  font-size: 13px;
  margin-left: 2px;
}
.ell-vivo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #b9c4d6;
  white-space: nowrap;
}
.ell-punto {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  animation: ping 1.6s infinite;
  flex-shrink: 0;
}
.ell-vivo--cargando .ell-punto {
  background: #94a3b8;
  animation: none;
}
.ell-vivo--error .ell-punto {
  background: #f59e0b;
  animation: none;
}
@keyframes ping {
  0% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.55);
  }
  100% {
    box-shadow: 0 0 0 10px rgba(34, 197, 94, 0);
  }
}
.ell-chips {
  margin-left: auto;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
  min-width: 0;
}
.ell-chip {
  padding: 6px 11px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.07);
  border: 0;
  font: inherit;
  font-size: 12.5px;
  color: #dce4f0;
  display: flex;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
  min-width: 0;
}
.ell-chip b {
  color: #fff;
  font-weight: 600;
}
.ell-chip i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.ell-chip span {
  overflow: hidden;
  text-overflow: ellipsis;
}
.ell-chip--accion {
  cursor: pointer;
}
.ell-chip--accion:hover {
  background: rgba(250, 126, 6, 0.18);
}
.ell-chip--accion:focus-visible {
  outline: 2px solid var(--ell-naranja);
  outline-offset: 2px;
}

/* ---------- Aviso ---------- */
.ell-aviso {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(245, 158, 11, 0.14);
  border: 1px solid rgba(245, 158, 11, 0.35);
  color: #fde7b0;
  font-size: 13px;
  flex-shrink: 0;
}
.ell-aviso .bi {
  color: #f59e0b;
  margin-top: 1px;
}

/* ---------- Escena ---------- */
.ell-escenario {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 12px;
  overflow: hidden;
}
.ell-marco {
  position: relative;
  border-radius: 18px;
  overflow: hidden;
  box-shadow:
    0 30px 80px rgba(0, 0, 0, 0.55),
    0 0 0 1px rgba(255, 255, 255, 0.07);
  background: #e9eff8;
  flex-shrink: 0;
  max-width: 100%;
}
.ell-cargando {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(11, 18, 32, 0.35);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
}

/* ---------- Bandeja «Para Lucas» ---------- */
.ell-bandeja {
  position: absolute;
  top: 12px;
  right: 12px;
  width: min(380px, calc(100% - 24px));
  max-height: calc(100% - 24px);
  display: flex;
  flex-direction: column;
  background: rgba(16, 28, 40, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
  color: #dce4f0;
  font-size: 13px;
}
.ell-bandeja__cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-weight: 600;
  color: #fff;
}
.ell-bandeja__cabecera b {
  color: var(--ell-naranja);
  margin-left: 4px;
}
.ell-bandeja__cerrar {
  border: 0;
  background: transparent;
  color: #b9c4d6;
  padding: 2px 6px;
  border-radius: 8px;
}
.ell-bandeja__cerrar:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}
.ell-bandeja__vacia {
  margin: 0;
  padding: 14px 12px;
  color: #8fa0b8;
}
.ell-bandeja__lista {
  list-style: none;
  margin: 0;
  padding: 6px;
  overflow-y: auto;
}
.ell-bandeja__item {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px 8px;
  padding: 8px 6px;
  border-radius: 10px;
}
.ell-bandeja__item + .ell-bandeja__item {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}
.ell-bandeja__tipo {
  grid-row: span 2;
  align-self: start;
  font-size: 10.5px;
  font-weight: 700;
  color: #fff;
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}
.ell-bandeja__titulo {
  color: #fff;
  text-decoration: none;
  overflow-wrap: anywhere;
  min-width: 0;
}
a.ell-bandeja__titulo:hover {
  text-decoration: underline;
}
.ell-bandeja__hace {
  color: #8fa0b8;
  font-size: 11.5px;
}

/* ---------- Cámaras (solo en vertical) ---------- */
.ell-camaras {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
  padding: 12px 0 2px;
  flex-shrink: 0;
}
.ell-camaras button {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: #dce4f0;
  padding: 8px 14px;
  border-radius: 999px;
  font: 500 13px Geist, system-ui, sans-serif;
}
.ell-camaras button.on {
  background: linear-gradient(90deg, var(--ell-azul), var(--ell-violeta));
  border-color: transparent;
  color: #fff;
}
.ell-camaras button:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

/* ---------- Vertical: chips en dos columnas, marco arriba ---------- */
.ell--vertical {
  padding: 0 12px 10px;
}
.ell--vertical .ell-cabecera {
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 0;
}
.ell--vertical .ell-titulo {
  font-size: 16px;
}
.ell--vertical .ell-marca small {
  display: none;
}
.ell--vertical .ell-vivo {
  font-size: 12px;
  min-width: 0;
}
.ell--vertical .ell-vivo span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
}
.ell--vertical .ell-chips {
  order: 3;
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-left: 0;
}
.ell--vertical .ell-chip {
  font-size: 12px;
  padding: 6px 9px;
}
/* Si quedan impares, el último ocupa la fila entera en vez de dejar un hueco. */
.ell--vertical .ell-chip:last-child:nth-child(odd) {
  grid-column: 1 / -1;
}
.ell--vertical .ell-escenario {
  justify-content: flex-start;
  padding-top: 10px;
}
.ell--vertical .ell-marco {
  border-radius: 14px;
}

@media (prefers-reduced-motion: reduce) {
  .ell-punto {
    animation: none;
  }
}
</style>
