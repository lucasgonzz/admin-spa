<template>
  <!--
    La escena de «El local» (misión el-local, 3/11/2026): un único <svg viewBox="0 0 1600 1000">.
    Vue solo pone el elemento; el contenido lo arman las piezas y lo mueven el motor y el director
    (ver escena/*.js). Por eso los estilos de adentro van con :deep(): los nodos se insertan por
    JS y no llevan el atributo de scope.
  -->
  <svg
    ref="svg"
    class="ell-svg"
    viewBox="0 0 1600 1000"
    preserveAspectRatio="xMidYMid meet"
    role="group"
    tabindex="0"
    aria-label="Plano de El local. Usá más y menos para el zoom, las flechas para moverlo y cero para restablecer la vista."
    @wheel.prevent="on_rueda"
    @pointerdown="on_puntero_abajo"
    @pointermove="on_puntero_mover"
    @pointerup="on_puntero_fin"
    @pointercancel="on_puntero_fin"
    @lostpointercapture="on_puntero_fin"
    @click.capture="on_clic_plano"
    @keydown.self="on_tecla_plano"
  />
</template>

<script>
import { NS, defs, capaAtras, capaMedio, capaAdelante, CAMARAS } from './escena/piezas'
import { Motor } from './escena/motor'
import { Director } from './escena/director'

export default {
  name: 'ElLocalEscena',
  props: {
    /** JSON de GET /local/escena (contrato B), o null si todavía no hay datos. */
    estado: { type: Object, default: null },
    /** Cámara: 'todo' | 'mostrador' | 'oficinas' | 'entrada'. */
    camara: { type: String, default: 'todo' },
    /** Ancho / alto del marco donde se muestra la escena (para ajustar la cámara). */
    aspecto: { type: Number, default: 1.6 },
  },
  emits: ['bandeja'],
  watch: {
    estado(nuevo) {
      if (this.director) {
        this.director.aplicar(nuevo)
      }
    },
    camara() {
      this.ajustar_camara(true)
    },
    aspecto() {
      this.ajustar_camara(false)
    },
  },
  mounted() {
    const svg = this.$refs.svg
    this.punteros = new Map()
    svg.insertAdjacentHTML('beforeend', defs())
    /* Capas, de atrás hacia adelante: escenografía; robots detrás del mostrador y de los
       escritorios; mostrador y escritorios (tapan los pies de quien está detrás); los que andan
       por el piso (ordenados por profundidad); plantas y vidrios; lo que vuela. */
    const capas = {}
    ;['atras', 'actoresAtras', 'medio', 'actoresFrente', 'adelante', 'fx'].forEach(function (nombre) {
      const g = document.createElementNS(NS, 'g')
      g.setAttribute('class', 'capa-' + nombre)
      svg.appendChild(g)
      capas[nombre] = g
    })
    capas.atras.innerHTML = capaAtras()
    capas.medio.innerHTML = capaMedio()
    capas.adelante.innerHTML = capaAdelante()

    /* Motor y director no son reactivos a propósito: Vue no tiene nada que observar ahí adentro
       y envolverlos en proxies solo agregaría costo a cada cuadro. */
    this.motor = new Motor(svg, capas)
    this.director = new Director(this.motor, svg)
    this.director.aplicar(this.estado)
    this.motor.iniciar()
    this.ajustar_camara(false)

    const bandeja = svg.querySelector('[data-ref="bandeja"]')
    if (bandeja) {
      this.bandeja_el = bandeja
      bandeja.addEventListener('click', this.on_bandeja)
      bandeja.addEventListener('keydown', this.on_bandeja_tecla)
    }
  },
  beforeUnmount() {
    /* 🔴 El loop de requestAnimationFrame y los temporizadores de la escena viven en el motor:
       sin esto, seguirían corriendo después de salir de la vista. */
    if (this.motor) {
      this.motor.detener()
      this.motor = null
    }
    this.director = null
    if (this.bandeja_el) {
      this.bandeja_el.removeEventListener('click', this.on_bandeja)
      this.bandeja_el.removeEventListener('keydown', this.on_bandeja_tecla)
      this.bandeja_el = null
    }
  },
  methods: {
    /**
     * Encuadra la cámara elegida al aspecto actual del marco.
     *
     * @param {boolean} animar
     * @returns {void}
     */
    ajustar_camara(animar) {
      if (!this.motor) {
        return
      }
      const rect = CAMARAS[this.camara] || CAMARAS.todo
      this.motor.setCam(rect, this.aspecto, animar)
    },
    centro_plano() {
      const { left, top, width, height } = this.$refs.svg.getBoundingClientRect()
      return { x: left + width / 2, y: top + height / 2 }
    },
    zoom_centrado(factor) {
      const centro = this.centro_plano()
      this.motor.mover_camara(centro, centro, factor)
    },
    on_rueda(ev) {
      const punto = { x: ev.clientX, y: ev.clientY }
      const delta = ev.deltaY * (ev.deltaMode === 0 ? 1 : 16)
      const factor = Math.exp(Math.max(-0.35, Math.min(0.35, delta * 0.002)))
      this.motor.mover_camara(punto, punto, factor)
    },
    on_puntero_abajo(ev) {
      if (ev.button !== 0) {
        return
      }
      const punto = { x: ev.clientX, y: ev.clientY }
      if (!this.punteros.size) {
        this.origen_puntero = punto
        this.movio_puntero = false
      } else {
        this.movio_puntero = true
      }
      this.punteros.set(ev.pointerId, punto)
      // Capturar en el nodo tocado mantiene el clic de la bandeja si el puntero no se arrastra.
      ev.target.setPointerCapture(ev.pointerId)
    },
    gesto_actual() {
      const [a, b] = this.punteros.values()
      if (!b) {
        return { centro: a, distancia: 0 }
      }
      return {
        centro: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        distancia: Math.hypot(a.x - b.x, a.y - b.y),
      }
    },
    on_puntero_mover(ev) {
      if (!this.punteros.has(ev.pointerId)) {
        return
      }
      const antes = this.gesto_actual()
      this.punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
      const ahora = this.gesto_actual()
      let origen = antes.centro
      if (!this.movio_puntero) {
        origen = this.origen_puntero
        if (Math.hypot(ahora.centro.x - origen.x, ahora.centro.y - origen.y) < 5) {
          return
        }
        this.movio_puntero = true
      }
      const factor = antes.distancia > 0 && ahora.distancia > 0 ? antes.distancia / ahora.distancia : 1
      this.motor.mover_camara(origen, ahora.centro, factor)
    },
    on_puntero_fin(ev) {
      this.punteros.delete(ev.pointerId)
    },
    on_clic_plano(ev) {
      if (this.movio_puntero && ev.detail > 0) {
        ev.preventDefault()
        ev.stopPropagation()
      }
    },
    on_tecla_plano(ev) {
      const paso = 48
      const direcciones = { ArrowUp: [0, paso], ArrowDown: [0, -paso], ArrowLeft: [paso, 0], ArrowRight: [-paso, 0] }
      const direccion = direcciones[ev.key]
      if (direccion) {
        const centro = this.centro_plano()
        this.motor.mover_camara(centro, { x: centro.x + direccion[0], y: centro.y + direccion[1] })
      } else if (ev.key === '+' || ev.key === '=') {
        this.zoom_centrado(0.8)
      } else if (ev.key === '-') {
        this.zoom_centrado(1.25)
      } else if (ev.key === '0') {
        this.ajustar_camara(true)
      } else {
        return
      }
      ev.preventDefault()
    },
    /** Tocar la bandeja «Para Lucas» abre la lista de lo que espera. */
    on_bandeja() {
      this.$emit('bandeja')
    },
    /** La bandeja es un botón también con teclado. */
    on_bandeja_tecla(ev) {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault()
        this.$emit('bandeja')
      }
    },
  },
}
</script>

<style scoped>
/* ---------- El lienzo ---------- */
.ell-svg {
  width: 100%;
  height: 100%;
  display: block;
  font-family: Geist, Inter, system-ui, sans-serif;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  cursor: grab;
}
.ell-svg:active {
  cursor: grabbing;
}
.ell-svg:focus-visible {
  outline: 2px solid #0b84f8;
  outline-offset: -3px;
}

/* ---------- Animación de los personajes (portada tal cual del prototipo) ---------- */
.ell-svg :deep(.limb) {
  transform-box: fill-box;
  transform-origin: 50% 0;
}
.ell-svg :deep(.torso) {
  transform-box: fill-box;
  transform-origin: 50% 100%;
}
.ell-svg :deep(.walk .legL) {
  animation: legL 0.44s ease-in-out infinite alternate;
}
.ell-svg :deep(.walk .legR) {
  animation: legR 0.44s ease-in-out infinite alternate;
}
.ell-svg :deep(.walk .armL) {
  animation: legR 0.44s ease-in-out infinite alternate;
}
.ell-svg :deep(.walk .armR) {
  animation: legL 0.44s ease-in-out infinite alternate;
}
.ell-svg :deep(.walk .torso) {
  animation: bob 0.44s ease-in-out infinite alternate;
}
@keyframes legL {
  from {
    transform: rotate(-26deg);
  }
  to {
    transform: rotate(26deg);
  }
}
@keyframes legR {
  from {
    transform: rotate(26deg);
  }
  to {
    transform: rotate(-26deg);
  }
}
@keyframes bob {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-3px);
  }
}
.ell-svg :deep(.idle .torso),
.ell-svg :deep(.typing .torso),
.ell-svg :deep(.present .torso) {
  animation: breath 2.6s ease-in-out infinite alternate;
}
@keyframes breath {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-2px);
  }
}
.ell-svg :deep(.typing .armL) {
  animation: typeL 0.2s ease-in-out infinite alternate;
}
.ell-svg :deep(.typing .armR) {
  animation: typeR 0.2s ease-in-out infinite alternate;
}
@keyframes typeL {
  from {
    transform: rotate(-58deg);
  }
  to {
    transform: rotate(-66deg);
  }
}
@keyframes typeR {
  from {
    transform: rotate(66deg);
  }
  to {
    transform: rotate(58deg);
  }
}
.ell-svg :deep(.present .armR) {
  transform: rotate(150deg);
}
.ell-svg :deep(.carry .armL) {
  transform: rotate(-70deg);
}
.ell-svg :deep(.carry .armR) {
  transform: rotate(70deg);
}
.ell-svg :deep(.nota) {
  display: none;
}
.ell-svg :deep(.carry .nota) {
  display: inline;
}
.ell-svg :deep(.eye) {
  transform-box: fill-box;
  transform-origin: 50% 50%;
  animation: blink 4.2s infinite;
}
@keyframes blink {
  0%,
  91%,
  100% {
    transform: scaleY(1);
  }
  94% {
    transform: scaleY(0.08);
  }
}
.ell-svg :deep(.antena) {
  animation: pulse 1.1s ease-in-out infinite alternate;
}
@keyframes pulse {
  from {
    opacity: 0.45;
  }
  to {
    opacity: 1;
  }
}

/* ---------- Robots sin señal (antena apagada) y apagados (dormidos, con «zzz») ---------- */
.ell-svg :deep(.sin-senal .antena),
.ell-svg :deep(.dormido .antena) {
  animation: none;
  fill: #94a3b8;
  opacity: 0.4;
}
.ell-svg :deep(.zzz) {
  display: none;
}
.ell-svg :deep(.dormido .zzz) {
  display: inline;
}
.ell-svg :deep(.dormido .zzz text) {
  animation: zzz 2.4s ease-in-out infinite;
  opacity: 0;
}
.ell-svg :deep(.dormido .zzz .z2) {
  animation-delay: 0.6s;
}
.ell-svg :deep(.dormido .zzz .z3) {
  animation-delay: 1.2s;
}
@keyframes zzz {
  0% {
    opacity: 0;
    transform: translate(0, 4px);
  }
  30% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(6px, -8px);
  }
}
.ell-svg :deep(.dormido .eye) {
  animation: none;
  transform: scaleY(0.15);
}
.ell-svg :deep(.dormido .torso) {
  animation: breath 3.6s ease-in-out infinite alternate;
}

/* ---------- Negocios: aro verde si está en el local; gris en el banco; gris claro sin horario ---------- */
.ell-svg :deep(.client .ring) {
  stroke: #94a3b8;
}
.ell-svg :deep(.client.presente .ring) {
  stroke: #22c55e;
}
/* La opacidad del actor la maneja el motor (fundidos) en el grupo de afuera: el gris va adentro. */
.ell-svg :deep(.cerrado > .flip),
.ell-svg :deep(.cerrado > .lbl) {
  filter: grayscale(1);
  opacity: 0.42;
}
.ell-svg :deep(.sin-horario > .flip),
.ell-svg :deep(.sin-horario > .lbl) {
  filter: grayscale(0.85);
  opacity: 0.68;
}
/* En el banco y en la entrada son muchos y muy juntos: el nombre se pisaría con el del vecino.
   Queda la cabeza (logo o iniciales) y el nombre en el tooltip. */
.ell-svg :deep(.cerrado > .lbl),
.ell-svg :deep(.sin-horario > .lbl),
.ell-svg :deep(.sin-rotulo > .lbl) {
  display: none;
}
/* Tocar a un negocio muestra su nombre (ver Director.mostrarNombre). */
.ell-svg :deep(.client) {
  cursor: pointer;
}
/* Los que esperan quietos no respiran: son muchos y no hace falta repintarlos en cada cuadro. */
.ell-svg :deep(.cerrado .torso),
.ell-svg :deep(.sin-horario .torso) {
  animation: none;
}

/* ---------- Globos, chips, escáner, puerta, pantallas ---------- */
.ell-svg :deep(.bubble) {
  transform-box: fill-box;
  transform-origin: 50% 100%;
  animation: pop 0.38s cubic-bezier(0.2, 1.5, 0.4, 1) both;
}
@keyframes pop {
  from {
    transform: scale(0);
  }
  to {
    transform: scale(1);
  }
}
.ell-svg :deep(.tdots circle) {
  animation: tdot 1s infinite;
}
.ell-svg :deep(.tdots circle:nth-child(2)) {
  animation-delay: 0.15s;
}
.ell-svg :deep(.tdots circle:nth-child(3)) {
  animation-delay: 0.3s;
}
@keyframes tdot {
  0%,
  60%,
  100% {
    opacity: 0.25;
  }
  30% {
    opacity: 1;
  }
}
.ell-svg :deep(.tag) {
  transform-box: fill-box;
  transform-origin: 50% 100%;
  animation: pop 0.4s cubic-bezier(0.2, 1.5, 0.4, 1) both;
}
.ell-svg :deep(.mesa-nueva) {
  animation: aparecer 0.6s ease-out both;
}
@keyframes aparecer {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.ell-svg :deep(.beam),
.ell-svg :deep(.scan-papel) {
  opacity: 0;
  transition: opacity 0.3s ease;
}
.ell-svg :deep(.scan-on .scan-papel) {
  opacity: 1;
}
.ell-svg :deep(.scan-on .beam) {
  opacity: 0.75;
  animation: sweep 0.9s linear infinite;
}
@keyframes sweep {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(22px);
  }
}
.ell-svg :deep(.door .paneR) {
  transform-box: fill-box;
  transform-origin: 100% 50%;
  transition: transform 0.6s ease;
}
.ell-svg :deep(.door.open .paneR) {
  transform: scaleX(0.12);
}
.ell-svg :deep(.neon) {
  filter: url(#ell-glow);
}
.ell-svg :deep(.screen-on) {
  animation: screen 3s ease-in-out infinite alternate;
}
@keyframes screen {
  from {
    opacity: 0.75;
  }
  to {
    opacity: 1;
  }
}
/* Monitor de un agente sin señal o apagado: pantalla negra, sin renglones. */
.ell-svg :deep(.monitor.apagado .pantalla) {
  animation: none;
  fill: #0f1724;
  opacity: 1;
}
.ell-svg :deep(.monitor.apagado .lineas) {
  display: none;
}
.ell-svg :deep(.bandeja) {
  cursor: pointer;
  outline: none;
}
.ell-svg :deep(.bandeja:focus-visible) {
  outline: 3px solid #fa7e06;
  outline-offset: 4px;
}

/* Quien pidió menos movimiento: nada se anima (y el motor tampoco hace caminar a nadie). */
@media (prefers-reduced-motion: reduce) {
  .ell-svg :deep(*) {
    animation: none !important;
    transition: none !important;
  }
  /* sin animación, el «zzz» quedaría invisible (arranca en opacidad 0) */
  .ell-svg :deep(.dormido .zzz text) {
    opacity: 1;
  }
}
</style>
