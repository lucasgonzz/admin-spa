<template>
  <!--
    Panel de misiones de «El local» (misión el-local-linux, 25/11/2026): todas las misiones que
    ve el reporter de la PC (OpenClaw, Claude Code, Soporte, Codex y Dots), con filtro por
    origen, la barra de las 6 etapas, el tiempo en la etapa actual (y la marca «demorada»), los
    slots (worktrees) con sus archivos sin commitear, los agentes por rol, la línea de tiempo de
    fases, la fila de espera de la cola y el detalle de los recursos de la PC. Escritorio y
    tablet: panel lateral de ~420 px; teléfono: hoja a ancho completo.
  -->
  <section class="pm" role="dialog" aria-label="Misiones en curso">
    <header class="pm__cabecera">
      <b class="pm__titulo">Misiones</b>
      <button type="button" class="pm__cerrar" aria-label="Cerrar el panel de misiones" @click="$emit('cerrar')">
        <i class="bi bi-x-lg" aria-hidden="true" />
      </button>
    </header>

    <!-- Filtro por origen: una fila con scroll propio (no de la página) -->
    <div class="pm__filtro" role="group" aria-label="Filtrar por origen">
      <button
        v-for="op in opciones"
        :key="'pm-f-' + op.id"
        type="button"
        class="pm__opcion"
        :class="{ 'pm__opcion--on': filtro === op.id }"
        :aria-pressed="filtro === op.id ? 'true' : 'false'"
        @click="$emit('update:filtro', op.id)"
      >
        <i v-if="op.color" :style="{ background: op.color }" aria-hidden="true" />
        {{ op.texto }} <b>{{ op.cuenta }}</b>
      </button>
    </div>

    <div ref="cuerpo" class="pm__cuerpo">
      <p v-if="!hay_datos" class="pm__vacio">
        Todavía no llegan misiones de la PC de Lucas. Cuando el reporter de Linux se conecte, van a aparecer acá.
      </p>
      <p v-else-if="visibles.length === 0" class="pm__vacio">No hay misiones de este origen.</p>
      <p v-if="texto_recorte" class="pm__recorte" role="status">
        <i class="bi bi-exclamation-circle" aria-hidden="true" />
        {{ texto_recorte }} en este panel: el reporte de la PC es demasiado grande.
      </p>

      <ul v-if="visibles.length" class="pm__lista">
        <li
          v-for="m in visibles"
          :key="'pm-m-' + m.id"
          class="pm__mision"
          :class="{ 'pm__mision--demorada': m.demorada, 'pm__mision--espera': m.estado === 'esperando_lucas' && !m.demorada, 'pm__mision--foco': foco === m.id }"
          :data-mision-id="m.id"
        >
          <div class="pm__fila">
            <span class="pm__insignia" :style="{ background: origen_de(m).color }" :title="origen_de(m).texto">{{ origen_de(m).letra }}</span>
            <div class="pm__datos">
              <div class="pm__nombre">{{ m.titulo || m.slug || m.id }}</div>
              <div class="pm__chips">
                <span class="pm__chip" :style="{ '--pm-color': origen_de(m).color }">{{ origen_de(m).texto }}</span>
                <span class="pm__chip" :style="{ '--pm-color': estado_de(m).color }">{{ estado_de(m).texto }}</span>
                <span v-if="m.demorada" class="pm__chip pm__chip--demorada">demorada</span>
                <span v-else-if="m.estado === 'esperando_lucas'" class="pm__chip pm__chip--espera" title="Está parada esperando una decisión o acción tuya; no está demorada">te espera</span>
                <span v-if="m.sin_senal" class="pm__chip pm__chip--suave" title="Hace más de 5 minutos que la PC no reporta">sin señal</span>
              </div>
            </div>
          </div>

          <!-- Barra de las 6 etapas -->
          <div class="pm__etapas" role="img" :aria-label="'Etapa: ' + etapa_texto(m)">
            <span
              v-for="(e, i) in etapas"
              :key="'pm-e-' + m.id + e.id"
              class="pm__etapa"
              :class="{ 'pm__etapa--actual': i === indice(m) }"
              :style="{ background: color_etapa(m, i, e) }"
              :title="e.texto"
            />
          </div>
          <div class="pm__etapa-texto">
            <span>{{ etapa_texto(m) }}</span>
            <span v-if="en_etapa(m)" :class="{ 'pm__rojo': m.demorada }">{{ en_etapa(m) }}<template v-if="m.demorada"> (pasó los {{ duracion(m.umbral_min) }})</template></span>
          </div>

          <!-- Slots (worktrees) -->
          <ul v-if="(m.worktrees || []).length" class="pm__slots" aria-label="Slots en uso">
            <li v-for="w in m.worktrees" :key="'pm-w-' + m.id + w.carpeta">
              <i class="bi bi-folder2-open" aria-hidden="true" />
              <span>{{ w.repo }}</span>
              <small v-if="w.sucios > 0" class="pm__sucios">{{ w.sucios }} sin commitear</small>
              <small v-else>limpio</small>
            </li>
          </ul>

          <!-- Agentes por rol -->
          <div v-if="agentes_texto(m)" class="pm__agentes">
            <i class="bi bi-robot" aria-hidden="true" />
            {{ agentes_texto(m) }}
          </div>

          <div class="pm__pie">
            <span v-if="m.desde_at">empezó {{ hace(m.desde_at) }}</span>
            <span v-if="m.ultima_actividad_at">última actividad {{ hace(m.ultima_actividad_at) }}</span>
            <router-link v-if="m.ruta" :to="m.ruta" class="pm__ticket">Ver ticket</router-link>
          </div>

          <!-- Línea de tiempo de fases -->
          <details v-if="(m.fases || []).length" class="pm__fases" :open="foco === m.id">
            <summary>Línea de tiempo ({{ m.fases.length }} {{ m.fases.length === 1 ? 'fase' : 'fases' }})</summary>
            <ol>
              <li v-for="(f, i) in m.fases" :key="'pm-p-' + m.id + i">
                <i :style="{ background: color_de_etapa(f.etapa) }" aria-hidden="true" />
                <span class="pm__fase-nombre">{{ texto_fase(f.fase) }}</span>
                <span class="pm__fase-tiempo">{{ f.inferida ? '≈ ' : '' }}{{ duracion_fase(f) }}</span>
              </li>
            </ol>
          </details>
        </li>
      </ul>

      <!-- Cola de misiones en espera -->
      <section v-if="cola" ref="espera" class="pm__seccion" :class="{ 'pm__seccion--foco': foco === 'espera' }">
        <h3>En espera <small>{{ cola.en_espera.length }}</small></h3>
        <p v-if="!cola.ok" class="pm__vacio">No se pudo leer la cola de misiones en la PC.</p>
        <p v-else-if="cola.en_espera.length === 0" class="pm__vacio">No hay misiones esperando recursos.</p>
        <ul v-else class="pm__espera">
          <li v-for="e in cola.en_espera" :key="'pm-q-' + e.slug">
            <div class="pm__nombre">{{ e.titulo || e.slug }}</div>
            <div class="pm__chips">
              <span v-if="e.prioridad" class="pm__chip" :style="{ '--pm-color': prioridad_de(e).color }">{{ prioridad_de(e).texto }}</span>
              <span v-if="origen_de(e).texto && e.origen" class="pm__chip" :style="{ '--pm-color': origen_de(e).color }">{{ origen_de(e).texto }}</span>
              <span v-if="typeof e.espera_min === 'number'" class="pm__chip pm__chip--suave">espera hace {{ duracion(e.espera_min) }}</span>
            </div>
            <div v-if="(e.motivos || []).length" class="pm__motivos">Retenida por: {{ motivos(e.motivos) }}</div>
          </li>
        </ul>
        <p v-if="cola.fallidas > 0" class="pm__vacio">{{ cola.fallidas }} {{ cola.fallidas === 1 ? 'misión fallida' : 'misiones fallidas' }} al lanzarse.</p>
      </section>

      <!-- Recursos de la PC -->
      <section v-if="chequeo" class="pm__seccion">
        <h3>
          Recursos de la PC
          <small :style="{ color: nivel.color }">{{ nivel.texto }}</small>
        </h3>
        <dl class="pm__recursos">
          <div>
            <dt>RAM disponible</dt>
            <dd>{{ numero(chequeo.ram_disponible_gib) }} de {{ numero(chequeo.ram_total_gib) }} GB</dd>
          </div>
          <div>
            <dt>Swap libre</dt>
            <dd>{{ numero(chequeo.swap_libre_gib) }} de {{ numero(chequeo.swap_total_gib) }} GB</dd>
          </div>
          <div>
            <dt>Carga 1 / 5 min</dt>
            <dd>{{ numero(chequeo.load1) }} / {{ numero(chequeo.load5) }} sobre {{ chequeo.nproc }} núcleos</dd>
          </div>
          <div>
            <dt>Sesiones activas</dt>
            <dd>{{ chequeo.activas_total }} ({{ chequeo.activas_sin_pantalla }} sin pantalla)</dd>
          </div>
          <div>
            <dt>Tests y builds pesados</dt>
            <dd>{{ chequeo.pesados_ocupados }} de {{ chequeo.pesados_cupos }} cupos</dd>
          </div>
          <div>
            <dt>Último chequeo</dt>
            <dd>
              {{ hace(chequeo.at) }}<template v-if="(chequeo.lanzadas || []).length"> · lanzó {{ chequeo.lanzadas.join(', ') }}</template
              ><template v-else-if="chequeo.retenidas > 0"> · retuvo {{ chequeo.retenidas }}</template>
            </dd>
          </div>
          <div v-if="typeof chequeo.umbral_ram_gib === 'number'">
            <dt>Umbrales</dt>
            <dd>RAM mínima {{ numero(chequeo.umbral_ram_gib) }} GB · carga máxima {{ numero(chequeo.umbral_carga_por_nucleo) }} por núcleo</dd>
          </div>
        </dl>
      </section>
    </div>
  </section>
</template>

<script>
import {
  ETAPAS,
  ORIGENES,
  ORDEN_ORIGENES,
  ESTADOS_MISION,
  PRIORIDADES,
  NIVELES_RECURSOS,
  COLOR_ETAPA_PENDIENTE,
  TEXTO_FASE,
  indice_etapa,
  nivel_recursos,
  numero_es,
  texto_duracion,
  texto_en_etapa,
  texto_hace,
  texto_motivos,
  texto_recorte,
  texto_segundos,
} from '@/utils/local_oficina'

export default {
  name: 'ElLocalPanelMisiones',
  props: {
    /** `oficina.misiones` completas (el filtro se aplica acá, con los conteos sin filtrar). */
    misiones: { type: Array, default: () => [] },
    /** `oficina.por_origen`: no terminadas por origen. */
    por_origen: { type: Object, default: () => ({}) },
    /** `oficina.misiones_recorte` ya normalizado (ausente en un admin viejo). */
    recorte: { type: Object, default: null },
    /** Origen elegido en el filtro: una clave de `ORIGENES` o `'todas'`. */
    filtro: { type: String, default: 'todas' },
    /** `oficina.cola` ya normalizada, o null si la PC no la reporta. */
    cola: { type: Object, default: null },
    /** Milisegundos de «ahora» para los «hace N min». */
    ahora: { type: Number, default: 0 },
    /** Pedido de enfocar algo: `{ id: <id de misión | 'espera'>, vez: <contador> }`. */
    enfocar: { type: Object, default: null },
  },
  emits: ['cerrar', 'update:filtro'],
  data() {
    return {
      /** Misión (o 'espera') resaltada porque Lucas tocó su mesa o la fila de espera. */
      foco: null,
    }
  },
  computed: {
    etapas() {
      return ETAPAS
    },
    /** «N misiones no entran» si el servidor recortó el reporte (vacío si no). */
    texto_recorte() {
      return texto_recorte(this.recorte)
    },
    /** ¿La PC mandó alguna misión o la cola? */
    hay_datos() {
      return this.misiones.length > 0
    },
    /** Opciones del filtro con su cuenta (las no terminadas; «todas» las suma). */
    opciones() {
      const self = this
      let total = 0
      const lista = ORDEN_ORIGENES.map(function (id) {
        const cuenta = typeof self.por_origen[id] === 'number' ? self.por_origen[id] : 0
        total += cuenta
        return { id: id, texto: ORIGENES[id].texto, color: ORIGENES[id].color, cuenta: cuenta }
      })
      // «Sin origen» sólo si hay alguna misión así (no ensucia el filtro)
      const visibles = lista.filter(function (o) {
        return o.id !== 'desconocido' || o.cuenta > 0 || self.filtro === 'desconocido'
      })
      return [{ id: 'todas', texto: 'Todas', color: null, cuenta: total }].concat(visibles)
    },
    /** Misiones del origen elegido. */
    visibles() {
      const self = this
      return this.misiones.filter(function (m) {
        return self.filtro === 'todas' || m.origen === self.filtro
      })
    },
    /** Último chequeo de recursos de la cola. */
    chequeo() {
      return this.cola ? this.cola.ultimo_chequeo : null
    },
    /** Nivel de los recursos (ok, justo, crítico) con su texto y color. */
    nivel() {
      return NIVELES_RECURSOS[nivel_recursos(this.chequeo)]
    },
  },
  watch: {
    /** Tocar una mesa o la fila de espera en el plano enfoca esa parte del panel. */
    enfocar() {
      this.aplicar_foco()
    },
  },
  mounted() {
    this.aplicar_foco()
  },
  beforeUnmount() {
    if (this.foco_id) {
      window.clearTimeout(this.foco_id)
      this.foco_id = null
    }
  },
  methods: {
    /** Resalta y lleva a la vista la misión (o la sección «En espera») pedida. */
    aplicar_foco() {
      if (!this.enfocar || !this.enfocar.id) {
        return
      }
      const self = this
      const id = this.enfocar.id
      this.foco = id
      this.$nextTick(function () {
        const cuerpo = self.$refs.cuerpo
        let nodo = null
        if (id === 'espera') {
          nodo = self.$refs.espera || null
        } else if (cuerpo) {
          nodo = Array.prototype.filter.call(cuerpo.querySelectorAll('[data-mision-id]'), function (n) {
            return n.getAttribute('data-mision-id') === id
          })[0]
        }
        if (nodo && typeof nodo.scrollIntoView === 'function') {
          nodo.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }
      })
      if (this.foco_id) {
        window.clearTimeout(this.foco_id)
      }
      this.foco_id = window.setTimeout(function () {
        self.foco = null
        self.foco_id = null
      }, 6000)
    },
    /** Datos del origen de una misión o de una entrada de la cola (sin origen conocido: gris). */
    origen_de(item) {
      return ORIGENES[item.origen] || ORIGENES.desconocido
    },
    /** Datos del estado de una misión. */
    estado_de(mision) {
      return ESTADOS_MISION[mision.estado] || ESTADOS_MISION.trabajando
    },
    /** Datos de la prioridad de una entrada de la cola. */
    prioridad_de(item) {
      return PRIORIDADES[item.prioridad] || PRIORIDADES.normal
    },
    /** Posición de la etapa de la misión (0 a 5, -1 sin etapa). */
    indice(mision) {
      return indice_etapa(mision.etapa)
    },
    /** Color de un segmento de la barra: pasado atenuado, actual pleno, futuro gris. */
    color_etapa(mision, i, etapa) {
      const actual = this.indice(mision)
      if (actual < 0 || i > actual) {
        return COLOR_ETAPA_PENDIENTE
      }
      return i === actual ? etapa.color : etapa.color + '73'
    },
    /** Color de la etapa de una fase de la línea de tiempo. */
    color_de_etapa(etapa) {
      const i = indice_etapa(etapa)
      return i < 0 ? COLOR_ETAPA_PENDIENTE : ETAPAS[i].color
    },
    /** «construcción · construcción 1» → la fase fina con «≈» si se infirió. */
    etapa_texto(mision) {
      const etapa = ETAPAS[this.indice(mision)]
      const fase = mision.fase ? TEXTO_FASE[mision.fase] || mision.fase : ''
      const base = etapa ? etapa.texto : 'sin etapa'
      if (fase && fase !== base) {
        return base + ' · ' + fase + (mision.fase_inferida ? ' ≈' : '')
      }
      return base + (mision.fase_inferida ? ' ≈' : '')
    },
    /** «lleva 2 h 10 min en tests». */
    en_etapa(mision) {
      return texto_en_etapa(mision)
    },
    /** Texto de una fase fina. */
    texto_fase(fase) {
      return TEXTO_FASE[fase] || fase
    },
    /** Duración de una fase del historial; la que sigue abierta cuenta hasta «ahora». */
    duracion_fase(fase) {
      if (fase.segundos !== null && fase.segundos !== undefined) {
        return texto_segundos(fase.segundos)
      }
      const desde = fase.desde ? new Date(fase.desde).getTime() : NaN
      if (isNaN(desde)) {
        return 'en curso'
      }
      return 'en curso · ' + texto_duracion(Math.max(0, ((this.ahora || Date.now()) - desde) / 60000))
    },
    /** «programador ×2, revisor» a partir de los agentes de la misión. */
    agentes_texto(mision) {
      const cuenta = {}
      const orden = []
      ;(mision.agentes || []).forEach(function (a) {
        const clave = a.rol + (a.runtime ? ' (' + a.runtime + ')' : '')
        if (!cuenta[clave]) {
          cuenta[clave] = 0
          orden.push(clave)
        }
        cuenta[clave] += 1
      })
      return orden
        .map(function (clave) {
          return clave + (cuenta[clave] > 1 ? ' ×' + cuenta[clave] : '')
        })
        .join(' · ')
    },
    /** «hace N min» respecto de «ahora». */
    hace(iso) {
      return texto_hace(iso, this.ahora || Date.now())
    },
    /** Duración en minutos, legible. */
    duracion(minutos) {
      return texto_duracion(minutos)
    },
    /** Motivos de retención de la cola, en castellano. */
    motivos(lista) {
      return texto_motivos(lista)
    },
    /** Número con coma decimal; guion si no hay dato. */
    numero(valor) {
      return typeof valor === 'number' ? numero_es(valor) : '—'
    },
  },
}
</script>

<style scoped>
/* Panel lateral: lo posiciona la vista (Index.vue) dentro del escenario; acá sólo el aspecto. */
.pm {
  position: absolute;
  top: 12px;
  right: 0;
  bottom: 0;
  width: min(420px, 100%);
  display: flex;
  flex-direction: column;
  background: rgba(16, 28, 40, 0.97);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
  color: #dce4f0;
  font-size: 13px;
  z-index: 5;
  min-height: 0;
}
.pm__cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 8px 4px 14px;
  flex-shrink: 0;
}
.pm__titulo {
  font-size: 15px;
  color: #fff;
}
.pm__cerrar {
  min-width: 40px;
  min-height: 40px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #b9c4d6;
}
.pm__cerrar:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}
.pm__cerrar:focus-visible {
  outline: 2px solid #fff;
  outline-offset: -2px;
}

/* ---------- Filtro por origen ---------- */
.pm__filtro {
  display: flex;
  gap: 6px;
  padding: 2px 14px 10px;
  overflow-x: auto;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  scrollbar-width: thin;
}
.pm__opcion {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  color: #dce4f0;
  font: inherit;
  font-size: 12.5px;
  white-space: nowrap;
  flex-shrink: 0;
}
.pm__opcion i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.pm__opcion b {
  color: #fff;
}
.pm__opcion--on {
  background: linear-gradient(90deg, #0b84f8, #3a31fc);
  border-color: transparent;
  color: #fff;
}
.pm__opcion:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}

.pm__cuerpo {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 10px 16px;
  overscroll-behavior: contain;
}
.pm__vacio {
  margin: 10px 4px;
  color: #8fa0b8;
}
.pm__recorte {
  margin: 10px 4px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(250, 126, 6, 0.14);
  color: #fdba74;
  font-weight: 600;
}

/* ---------- Una misión ---------- */
.pm__lista {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
.pm__mision {
  padding: 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid transparent;
  display: grid;
  gap: 8px;
}
.pm__mision--demorada {
  border-color: rgba(239, 68, 68, 0.55);
}
.pm__mision--espera {
  border-color: rgba(250, 126, 6, 0.5);
}
.pm__mision--foco {
  background: rgba(11, 132, 248, 0.16);
  border-color: rgba(11, 132, 248, 0.7);
}
.pm__fila {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.pm__insignia {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 800;
  font-size: 13px;
  flex-shrink: 0;
  border: 2px solid rgba(255, 255, 255, 0.85);
}
.pm__datos {
  min-width: 0;
  flex: 1;
}
.pm__nombre {
  color: #fff;
  font-weight: 600;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.pm__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 5px;
}
.pm__chip {
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--pm-color, #dce4f0);
  font-size: 11px;
  font-weight: 600;
}
.pm__chip--demorada {
  background: #ef4444;
  color: #fff;
  font-weight: 800;
}
.pm__chip--espera {
  background: #fa7e06;
  color: #fff;
  font-weight: 800;
}
.pm__chip--suave {
  color: #aab9cf;
  font-weight: 500;
}

/* ---------- Barra de etapas ---------- */
.pm__etapas {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 3px;
}
.pm__etapa {
  height: 7px;
  border-radius: 3px;
}
.pm__etapa--actual {
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.55);
}
.pm__etapa-texto {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 2px 10px;
  font-size: 12px;
  color: #b9c4d6;
}
.pm__rojo {
  color: #fca5a5;
  font-weight: 700;
}

/* ---------- Slots, agentes y pie ---------- */
.pm__slots {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 12px;
}
.pm__slots li {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.pm__slots small {
  color: #8fa0b8;
}
.pm__slots .pm__sucios {
  color: #fdba74;
  font-weight: 600;
}
.pm__agentes {
  color: #b9c4d6;
  font-size: 12px;
}
.pm__agentes i {
  margin-right: 4px;
  color: #8fa0b8;
}
.pm__pie {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 12px;
  color: #8fa0b8;
  font-size: 11.5px;
}
.pm__ticket {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  padding: 0 10px;
  border: 1px solid #50647d;
  border-radius: 8px;
  color: #e5edf8;
  text-decoration: none;
}
.pm__ticket:hover {
  background: #304156;
  color: #fff;
}

/* ---------- Línea de tiempo de fases ---------- */
.pm__fases summary {
  cursor: pointer;
  min-height: 28px;
  color: #a9d2ff;
  font-size: 12px;
}
.pm__fases ol {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
  display: grid;
  gap: 4px;
}
.pm__fases li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.pm__fases li i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.pm__fase-nombre {
  flex: 1;
  color: #dce4f0;
}
.pm__fase-tiempo {
  color: #8fa0b8;
  white-space: nowrap;
}

/* ---------- En espera y recursos ---------- */
.pm__seccion {
  margin-top: 14px;
  padding: 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid transparent;
}
.pm__seccion--foco {
  background: rgba(250, 126, 6, 0.14);
  border-color: rgba(250, 126, 6, 0.6);
}
.pm__seccion h3 {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #fff;
}
.pm__seccion h3 small {
  margin-left: 6px;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
  color: #8fa0b8;
}
.pm__espera {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
.pm__motivos {
  margin-top: 4px;
  color: #fdba74;
  font-size: 12px;
}
.pm__recursos {
  margin: 0;
  display: grid;
  gap: 6px;
}
.pm__recursos div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.pm__recursos dt {
  color: #8fa0b8;
  font-weight: 500;
}
.pm__recursos dd {
  margin: 0;
  text-align: right;
  color: #fff;
}

/* ---------- Teléfono: hoja a ancho completo ---------- */
@media (max-width: 599px) {
  .pm {
    top: 6px;
    border-radius: 12px;
  }
}
</style>
