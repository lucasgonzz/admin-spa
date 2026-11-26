<template>
  <!--
    Panel de OpenClaw de «El local» (misión el-local-linux, 25/11/2026): se abre al tocar el
    escritorio OPENCLAW de las oficinas (o el chip de la cabecera). Muestra la salud del gateway,
    el Workboard por columnas y las tareas programadas (cada cuánto corren, si usan modelo y qué
    agente, y cómo les fue la última vez). Todo viene del bloque `oficina.openclaw` de la escena.
    Escritorio y tablet: panel lateral de ~420 px; teléfono: hoja a ancho completo con las
    columnas del Workboard apiladas.
  -->
  <section class="ocp" role="dialog" aria-label="OpenClaw: Workboard y tareas programadas">
    <header class="ocp__cabecera">
      <div class="ocp__titulo">
        <b>OpenClaw</b>
        <span v-if="openclaw" class="ocp__gateway" :style="{ '--ocp-color': gateway.color }">
          <i aria-hidden="true" />{{ gateway.texto }}
        </span>
      </div>
      <button type="button" class="ocp__cerrar" aria-label="Cerrar el panel de OpenClaw" @click="$emit('cerrar')">
        <i class="bi bi-x-lg" aria-hidden="true" />
      </button>
    </header>

    <div class="ocp__cuerpo">
      <p v-if="!openclaw" class="ocp__vacio">El admin todavía no recibe datos de OpenClaw.</p>

      <template v-else>
        <p class="ocp__meta">
          <span v-if="openclaw.gateway.version">versión {{ openclaw.gateway.version }}</span>
          <span v-if="visto">visto {{ visto }}</span>
        </p>

        <!-- Workboard -->
        <h3 class="ocp__seccion">
          Workboard <small>{{ openclaw.workboard.total }} tarjetas</small>
        </h3>
        <p v-if="!openclaw.workboard.ok" class="ocp__vacio">No se pudo leer el Workboard en la PC.</p>
        <p v-if="openclaw.workboard.recortado" class="ocp__nota">Se muestran las más recientes; el número de cada columna es el real.</p>
        <div v-if="openclaw.workboard.ok" class="ocp__columnas">
          <section v-for="col in columnas" :key="'ocp-col-' + col.id" class="ocp__columna" :aria-label="col.titulo">
            <h4>
              {{ col.titulo }}
              <b>{{ cuenta_de(col) }}</b>
            </h4>
            <p v-if="col.tarjetas.length === 0" class="ocp__columna-vacia">Sin tarjetas</p>
            <ul v-else class="ocp__tarjetas">
              <li v-for="t in col.tarjetas" :key="'ocp-t-' + t.id" class="ocp__tarjeta">
                <div class="ocp__tarjeta-titulo">
                  <i
                    class="ocp__prioridad"
                    :style="{ background: prioridad_de(t).color }"
                    :title="'Prioridad ' + prioridad_de(t).texto"
                    aria-hidden="true"
                  />
                  <span>{{ t.titulo }}</span>
                </div>
                <div v-if="(t.etiquetas || []).length" class="ocp__etiquetas">
                  <span v-for="e in t.etiquetas.slice(0, 4)" :key="'ocp-e-' + t.id + e">{{ e }}</span>
                </div>
                <div class="ocp__tarjeta-pie">
                  <span v-if="t.agente">{{ t.agente }}</span>
                  <span v-if="t.actualizada_at">actualizada {{ hace(t.actualizada_at) }}</span>
                  <span v-if="t.vence_at" class="ocp__vence">vence {{ fecha(t.vence_at) }}</span>
                </div>
              </li>
            </ul>
          </section>
        </div>

        <!-- Tareas programadas -->
        <h3 class="ocp__seccion">
          Tareas programadas <small>{{ tareas.length }}</small>
        </h3>
        <p v-if="!openclaw.tareas.ok" class="ocp__vacio">No se pudo leer la lista de tareas de OpenClaw.</p>
        <p v-else-if="tareas.length === 0" class="ocp__vacio">No hay tareas programadas.</p>
        <ul v-else class="ocp__tareas">
          <li v-for="t in tareas" :key="'ocp-r-' + t.id" class="ocp__tarea" :class="{ 'ocp__tarea--pausa': !t.habilitada }">
            <div class="ocp__tarea-nombre">
              <b>{{ t.nombre }}</b>
              <span v-if="!t.habilitada" class="ocp__pausa">en pausa</span>
            </div>
            <div class="ocp__tarea-linea">{{ t.frecuencia || 'sin frecuencia' }}</div>
            <div class="ocp__tarea-linea" :class="{ 'ocp__tarea-linea--modelo': t.tipo === 'modelo' }">{{ describir(t) }}</div>
            <div class="ocp__tarea-linea">
              <template v-if="t.ultimo_resultado">
                última corrida:
                <b :style="{ color: resultado_de(t).color }">{{ resultado_de(t).texto }}</b>
                <span v-if="t.ultima_corrida_at"> · {{ hace(t.ultima_corrida_at) }}</span>
                <span v-if="t.errores_seguidos > 0" class="ocp__errores"> · {{ t.errores_seguidos }} errores seguidos</span>
              </template>
              <template v-else>todavía no corrió</template>
            </div>
            <div v-if="t.habilitada && t.proxima_corrida_at" class="ocp__tarea-linea ocp__tarea-linea--suave">próxima: {{ en(t.proxima_corrida_at) }}</div>
          </li>
        </ul>
      </template>
    </div>
  </section>
</template>

<script>
import {
  ESTADOS_GATEWAY,
  PRIORIDADES,
  RESULTADOS_TAREA,
  agrupar_tarjetas,
  contar_columna,
  describir_tarea,
  texto_en,
  texto_fecha_hora,
  texto_hace,
} from '@/utils/local_oficina'

export default {
  name: 'ElLocalPanelOpenclaw',
  props: {
    /** Bloque `oficina.openclaw` ya normalizado por `completar_oficina`, o null sin datos. */
    openclaw: { type: Object, default: null },
    /** Milisegundos de «ahora» (la vista lo refresca cada segundo) para los «hace N min». */
    ahora: { type: Number, default: 0 },
  },
  emits: ['cerrar'],
  computed: {
    /** Texto y color de la salud del gateway. */
    gateway() {
      const estado = this.openclaw && this.openclaw.gateway ? this.openclaw.gateway.estado : 'desconocido'
      return ESTADOS_GATEWAY[estado] || ESTADOS_GATEWAY.desconocido
    },
    /** «hace 2 min» desde la última verificación del gateway. */
    visto() {
      const gateway = this.openclaw && this.openclaw.gateway
      return this.hace((gateway && gateway.verificado_at) || (this.openclaw && this.openclaw.reportado_at))
    },
    /** Columnas del Workboard en su orden. */
    columnas() {
      return agrupar_tarjetas(this.openclaw ? this.openclaw.workboard.tarjetas : [])
    },
    /** Tareas programadas: las que están activas primero. */
    tareas() {
      const lista = this.openclaw ? this.openclaw.tareas.items.slice() : []
      return lista.sort(function (a, b) {
        return (b.habilitada ? 1 : 0) - (a.habilitada ? 1 : 0)
      })
    },
  },
  methods: {
    /** Cantidad real de una columna (la del conteo del reporter). */
    cuenta_de(col) {
      return contar_columna(col, this.openclaw.workboard.conteo)
    },
    /** Texto y color de la prioridad de una tarjeta. */
    prioridad_de(tarjeta) {
      return PRIORIDADES[tarjeta.prioridad] || PRIORIDADES.normal
    },
    /** Texto y color del último resultado de una tarea. */
    resultado_de(tarea) {
      return RESULTADOS_TAREA[tarea.ultimo_resultado] || RESULTADOS_TAREA.otro
    },
    /** «con modelo · main», «sin modelo (comando)», «con condición». */
    describir(tarea) {
      return describir_tarea(tarea)
    },
    /** «hace N min» respecto de «ahora». */
    hace(iso) {
      return texto_hace(iso, this.ahora || Date.now())
    },
    /** «en N min» respecto de «ahora». */
    en(iso) {
      return texto_en(iso, this.ahora || Date.now())
    },
    /** «26/11 00:00». */
    fecha(iso) {
      return texto_fecha_hora(iso)
    },
  },
}
</script>

<style scoped>
/* Panel lateral: lo posiciona la vista (Index.vue) dentro del escenario; acá sólo el aspecto. */
.ocp {
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
.ocp__cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 8px 8px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}
.ocp__titulo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  color: #fff;
  min-width: 0;
}
.ocp__gateway {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.07);
  font-size: 12px;
  color: #dce4f0;
  white-space: nowrap;
}
.ocp__gateway i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ocp-color);
}
.ocp__cerrar {
  min-width: 40px;
  min-height: 40px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #b9c4d6;
  flex-shrink: 0;
}
.ocp__cerrar:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}
.ocp__cerrar:focus-visible {
  outline: 2px solid #fff;
  outline-offset: -2px;
}
.ocp__cuerpo {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 14px 16px;
  overscroll-behavior: contain;
}
.ocp__vacio,
.ocp__nota {
  margin: 10px 0;
  color: #8fa0b8;
}
.ocp__nota {
  font-size: 11.5px;
  margin-top: 0;
}
.ocp__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin: 10px 0 0;
  color: #8fa0b8;
  font-size: 12px;
}
.ocp__seccion {
  margin: 16px 0 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #fff;
}
.ocp__seccion small {
  margin-left: 6px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  color: #8fa0b8;
}

/* ---------- Workboard ---------- */
.ocp__columnas {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 8px;
  scroll-snap-type: x proximity;
}
.ocp__columna {
  flex: 0 0 206px;
  scroll-snap-align: start;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  padding: 8px;
  max-height: 380px;
  overflow-y: auto;
}
.ocp__columna h4 {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
}
.ocp__columna h4 b {
  min-width: 22px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  font-size: 11px;
  text-align: center;
}
.ocp__columna-vacia {
  margin: 0;
  font-size: 11.5px;
  color: #70829b;
}
.ocp__tarjetas {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}
.ocp__tarjeta {
  padding: 7px 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
}
.ocp__tarjeta-titulo {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  color: #fff;
  font-weight: 600;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.ocp__prioridad {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-top: 5px;
  flex-shrink: 0;
}
.ocp__etiquetas {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 5px;
}
.ocp__etiquetas span {
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(11, 132, 248, 0.2);
  color: #a9d2ff;
  font-size: 10.5px;
}
.ocp__tarjeta-pie {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 8px;
  margin-top: 5px;
  color: #8fa0b8;
  font-size: 11px;
}
.ocp__vence {
  color: #fdba74;
}

/* ---------- Tareas programadas ---------- */
.ocp__tareas {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
.ocp__tarea {
  padding: 9px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  display: grid;
  gap: 2px;
}
.ocp__tarea--pausa {
  opacity: 0.6;
}
.ocp__tarea-nombre {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
}
.ocp__pausa {
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.25);
  font-size: 10.5px;
}
.ocp__tarea-linea {
  color: #b9c4d6;
  font-size: 12px;
}
.ocp__tarea-linea--modelo {
  color: #a9d2ff;
}
.ocp__tarea-linea--suave {
  color: #8fa0b8;
}
.ocp__errores {
  color: #fca5a5;
}

/* ---------- Teléfono: hoja a ancho completo, columnas apiladas ---------- */
@media (max-width: 599px) {
  .ocp {
    top: 6px;
    border-radius: 12px;
  }
  .ocp__columnas {
    display: grid;
    overflow-x: visible;
    gap: 8px;
  }
  .ocp__columna {
    flex: none;
    max-height: none;
  }
}
</style>
