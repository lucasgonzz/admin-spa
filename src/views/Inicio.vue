<template>
  <!--
    Panel de inicio del administrador (misión inicio-y-entrada-por-rol, 13/10/2026): las tres
    cosas que esperan respuesta hoy, cada una con su deep link a la bandeja ya filtrada.
  -->
  <div class="inicio-view">

    <!-- Encabezado: título, antigüedad del dato y refresco a mano -->
    <div class="inicio-view__header d-flex align-items-start justify-content-between flex-wrap gap-2 mb-3">
      <div>
        <h1 class="h4 mb-0 fw-semibold">Inicio</h1>
        <p v-if="actualizado_label" class="text-muted small mb-0 mt-1">
          {{ actualizado_label }}
        </p>
      </div>
      <button
        type="button"
        class="btn btn-sm btn-outline-primary"
        :disabled="cargando"
        @click="on_refrescar"
      >
        <i class="bi bi-arrow-clockwise me-1" aria-hidden="true" />
        Actualizar
      </button>
    </div>

    <!--
      Aviso de que los números no se pudieron traer. Es el camino real de un SPA nuevo contra una
      API todavía no desplegada (404): se avisa y se muestran guiones, nunca una pantalla en
      blanco ni un bucle de reintentos.
    -->
    <div v-if="aviso" class="alert alert-warning d-flex align-items-start gap-2 py-2" role="alert">
      <i class="bi bi-exclamation-triangle-fill mt-1" aria-hidden="true" />
      <span>{{ aviso }}</span>
    </div>

    <!-- Estado vacío: los tres contadores en cero. Se destaca arriba de las tarjetas. -->
    <div
      v-if="nada_pendiente"
      class="inicio-view__nada-pendiente alert alert-success d-flex align-items-center gap-2 mb-3"
      role="status"
    >
      <i class="bi bi-check-circle-fill fs-4" aria-hidden="true" />
      <span>
        <span class="fw-semibold fs-5 d-block">Nada pendiente</span>
        <span class="small">No hay tickets ni leads esperando respuesta.</span>
      </span>
    </div>

    <!--
      Las tres tarjetas. Cada una es un <router-link> y no un @click con $router.push: así andan
      el clic del medio y "abrir en pestaña nueva", que es como el operador se arma el día.
      Siguen visibles en cero, apagadas, para que igual se pueda entrar a la bandeja.
    -->
    <div class="inicio-tarjetas">
      <router-link
        v-for="tarjeta in tarjetas"
        :key="'inicio-tarjeta-' + tarjeta.clave"
        :to="tarjeta.destino"
        class="inicio-tarjeta"
        :class="{ 'inicio-tarjeta--apagada': tarjeta.apagada }"
        :aria-label="tarjeta.aria_label"
      >
        <span class="inicio-tarjeta__numero">
          <span
            v-if="cargando && tarjeta.numero === null"
            class="spinner-border"
            role="status"
            aria-hidden="true"
          />
          <template v-else>{{ tarjeta.numero_texto }}</template>
        </span>
        <span class="inicio-tarjeta__rotulo">{{ tarjeta.rotulo }}</span>
        <span class="inicio-tarjeta__ver">
          Ver
          <i class="bi bi-arrow-right ms-1" aria-hidden="true" />
        </span>
      </router-link>
    </div>

    <!--
      Agenda embebida (misión agenda-admin, 31/10/2026): la vista tipo Structured completa y
      operable, debajo de las tres tarjetas. Tiene alto fijo y scroll interno para no estirar el
      Inicio; "Abrir agenda" lleva a la misma agenda a pantalla completa. Es independiente de las
      tarjetas: si la API de la agenda no está, avisa adentro y las tarjetas siguen igual.
    -->
    <section class="inicio-agenda" aria-label="Agenda">
      <div class="inicio-agenda__cabecera">
        <h2 class="h5 mb-0 fw-semibold">Agenda</h2>
        <router-link to="/agenda" class="inicio-agenda__abrir">
          Abrir agenda
          <i class="bi bi-arrow-right ms-1" aria-hidden="true" />
        </router-link>
      </div>
      <div class="inicio-agenda__marco">
        <agenda-index embebido />
      </div>
    </section>
  </div>
</template>

<script>
import api from '@/utils/axios'
import AgendaIndex from '@/components/agenda/Index.vue'

/** Cada cuánto se vuelven a pedir los tres números, en milisegundos. */
const INICIO_POLL_MS = 60000

/**
 * Las tres tarjetas, en el orden en que se muestran: la clave que manda la API, el rótulo que ve
 * el operador y el destino con el filtro ya puesto.
 */
const DEFINICION_TARJETAS = [
  {
    clave: 'tickets_sin_responder',
    rotulo: 'Tickets sin responder',
    destino: { path: '/soporte', query: { filtro: 'sin-responder' } },
  },
  {
    clave: 'tickets_abiertos_hoy',
    rotulo: 'Tickets abiertos hoy',
    destino: { path: '/soporte', query: { filtro: 'hoy' } },
  },
  {
    clave: 'leads_sin_responder',
    rotulo: 'Leads sin responder',
    destino: { path: '/leads', query: { filtro: 'sin-responder' } },
  },
]

export default {
  name: 'ViewInicio',
  components: { AgendaIndex },
  data() {
    return {
      /**
       * Los tres contadores que vienen de GET /inicio/tarjetas. `null` significa "no se sabe":
       * o todavía no volvió la primera carga, o falló y se muestran guiones.
       */
      contadores: {
        tickets_sin_responder: null,
        tickets_abiertos_hoy: null,
        leads_sin_responder: null,
      },
      /** `calculado_en` de la respuesta (ISO8601), para decir qué tan viejo es el dato. */
      calculado_en: null,
      /** true mientras el GET está en vuelo. */
      cargando: true,
      /** Texto del aviso cuando los números no se pudieron traer ('' si todo bien). */
      aviso: '',
      /** Momento con el que se calcula el "hace N min"; se refresca en cada tick del poleo. */
      ahora: Date.now(),
      /** Referencia al setInterval del poleo (se limpia en beforeUnmount). */
      poll_interval_id: null,
    }
  },
  computed: {
    /**
     * Las tres tarjetas listas para pintar: número, rótulo, destino y si va apagada.
     *
     * @returns {Array<Object>}
     */
    tarjetas() {
      const self = this
      return DEFINICION_TARJETAS.map(function (def) {
        const numero = self.contadores[def.clave]
        const es_numero = typeof numero === 'number'
        return {
          clave: def.clave,
          rotulo: def.rotulo,
          destino: def.destino,
          numero: es_numero ? numero : null,
          /* Sin dato (API vieja, error de red): un guión, que es honesto; un 0 mentiría. */
          numero_texto: es_numero ? String(numero) : '—',
          apagada: es_numero && numero === 0,
          aria_label: def.rotulo + ': ' + (es_numero ? String(numero) : 'sin dato') + '. Ver',
        }
      })
    },
    /**
     * Indica si los tres contadores llegaron y los tres están en cero.
     *
     * @returns {boolean}
     */
    nada_pendiente() {
      const self = this
      let todos_cero = true
      DEFINICION_TARJETAS.forEach(function (def) {
        const numero = self.contadores[def.clave]
        if (typeof numero !== 'number' || numero !== 0) {
          todos_cero = false
        }
      })
      return todos_cero
    },
    /**
     * Antigüedad del dato en palabras, para que el operador sepa si está mirando algo viejo.
     *
     * @returns {string}
     */
    actualizado_label() {
      if (!this.calculado_en) {
        return ''
      }
      const calculado_ms = new Date(this.calculado_en).getTime()
      if (isNaN(calculado_ms)) {
        return ''
      }
      const minutos = Math.floor((this.ahora - calculado_ms) / 60000)
      if (minutos <= 0) {
        return 'Actualizado hace menos de un minuto'
      }
      if (minutos === 1) {
        return 'Actualizado hace 1 minuto'
      }
      if (minutos < 60) {
        return 'Actualizado hace ' + minutos + ' minutos'
      }
      /* Más de una hora: la hora exacta dice más que "hace 97 minutos". */
      return 'Actualizado a las ' + this.hora_de(calculado_ms)
    },
  },
  mounted() {
    const self = this
    self.cargar_tarjetas()
    self.poll_interval_id = window.setInterval(function () {
      self.ahora = Date.now()
      self.cargar_tarjetas()
    }, INICIO_POLL_MS)
    /* Volver a la pestaña es cuando el operador de verdad mira estos números: ahí se refrescan
       sin esperar el próximo tick de los 60 segundos. */
    document.addEventListener('visibilitychange', self.on_visibility_change)
  },
  beforeUnmount() {
    /* 🔴 Los dos se limpian acá: en este proyecto ya hubo fugas de listeners, y un setInterval
       que sobrevive al desmontaje sigue pidiendo el endpoint para siempre. */
    if (this.poll_interval_id) {
      window.clearInterval(this.poll_interval_id)
      this.poll_interval_id = null
    }
    document.removeEventListener('visibilitychange', this.on_visibility_change)
  },
  methods: {
    /**
     * Pide los tres contadores a la API.
     *
     * `silent_error: true`: el aviso se muestra en la vista, con los números en guiones. Sin esto
     * el interceptor de axios tiraría una toast en cada tick del poleo, una vez por minuto, y el
     * caso más probable (SPA nuevo contra API vieja, 404) no es un problema del operador.
     *
     * @returns {Promise<void>}
     */
    cargar_tarjetas() {
      const self = this
      self.cargando = true
      return api
        .get('/inicio/tarjetas', { silent_error: true })
        .then(function (response) {
          const data = response.data || {}
          self.contadores = {
            tickets_sin_responder: self.numero_de(data.tickets_sin_responder),
            tickets_abiertos_hoy: self.numero_de(data.tickets_abiertos_hoy),
            leads_sin_responder: self.numero_de(data.leads_sin_responder),
          }
          self.calculado_en = data.calculado_en || null
          self.ahora = Date.now()
          self.aviso = ''
          self.cargando = false
        })
        .catch(function (error) {
          const status = error && error.response ? error.response.status : null
          if (status === 404 || status === 405) {
            self.aviso =
              'Todavía no se pueden contar los pendientes: esta pantalla es más nueva que el ' +
              'servidor. Se arregla en la próxima actualización del admin.'
          } else {
            self.aviso = 'No se pudieron traer los pendientes. Probá con Actualizar en un momento.'
          }
          /* Los contadores quedan en null (guiones): un 0 acá diría "no hay nada", que es
             justamente lo contrario de lo que se sabe. */
          self.contadores = {
            tickets_sin_responder: null,
            tickets_abiertos_hoy: null,
            leads_sin_responder: null,
          }
          self.calculado_en = null
          self.cargando = false
        })
    },
    /**
     * Refresca cuando la pestaña vuelve a estar visible.
     *
     * @returns {void}
     */
    on_visibility_change() {
      if (document.visibilityState !== 'visible') {
        return
      }
      this.cargar_tarjetas()
    },
    /**
     * Refresco a mano desde el botón del encabezado.
     *
     * @returns {void}
     */
    on_refrescar() {
      if (this.cargando) {
        return
      }
      this.cargar_tarjetas()
    },
    /**
     * Normaliza un contador de la respuesta a número, o null si no vino usable.
     *
     * @param {*} valor Valor crudo de la respuesta.
     * @returns {number|null}
     */
    numero_de(valor) {
      if (valor === null || valor === undefined || valor === '') {
        return null
      }
      const numero = parseInt(valor, 10)
      return isNaN(numero) ? null : numero
    },
    /**
     * Hora (HH:MM) de un momento dado en milisegundos.
     *
     * @param {number} ms
     * @returns {string}
     */
    hora_de(ms) {
      const fecha = new Date(ms)
      const hh = String(fecha.getHours())
      const mm = String(fecha.getMinutes())
      return (hh.length === 1 ? '0' + hh : hh) + ':' + (mm.length === 1 ? '0' + mm : mm)
    },
  },
}
</script>

<style scoped>
/* Grilla de las tarjetas: apiladas en teléfono, dos columnas en tablet, tres en escritorio. */
.inicio-tarjetas {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 576px) {
  .inicio-tarjetas {
    grid-template-columns: 1fr 1fr;
  }

  /* Con dos columnas sobra una celda: la tercera tarjeta la ocupa entera en vez de dejar hueco. */
  .inicio-tarjeta:last-child {
    grid-column: 1 / -1;
  }
}

@media (min-width: 992px) {
  .inicio-tarjetas {
    grid-template-columns: repeat(3, 1fr);
  }

  .inicio-tarjeta:last-child {
    grid-column: auto;
  }
}

/* Tarjeta: es un <a>, así que se le saca la decoración de link y se le da cuerpo de tarjeta. */
.inicio-tarjeta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
  padding: 1.25rem 1.25rem 1rem;
  min-width: 0;
  border: 1px solid #e5e4e7;
  border-radius: 0.75rem;
  background-color: #fff;
  color: #1f2937;
  text-decoration: none;
  cursor: pointer;
  transition:
    box-shadow 0.15s ease,
    transform 0.15s ease,
    border-color 0.15s ease;
}

.inicio-tarjeta:hover {
  border-color: #0d6efd;
  box-shadow: 0 0.5rem 1rem rgba(13, 110, 253, 0.12);
  transform: translateY(-2px);
  color: #1f2937;
}

/* Foco visible por teclado: la tarjeta es un control y se tiene que ver cuál está elegida. */
.inicio-tarjeta:focus-visible {
  outline: 3px solid #0d6efd;
  outline-offset: 2px;
}

/* En cero la tarjeta se apaga, pero sigue entrando: el operador igual puede abrir la bandeja. */
.inicio-tarjeta--apagada {
  opacity: 0.6;
}

.inicio-tarjeta__numero {
  font-size: 2.75rem;
  font-weight: 700;
  line-height: 1.1;
  color: #111827;
}

.inicio-tarjeta__rotulo {
  font-size: 1rem;
  font-weight: 600;
}

.inicio-tarjeta__ver {
  display: inline-flex;
  align-items: center;
  margin-top: 0.25rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #0d6efd;
}

/* El spinner de la primera carga ocupa el lugar del número para que la tarjeta no salte. */
.inicio-tarjeta__numero .spinner-border {
  width: 2rem;
  height: 2rem;
  border-width: 0.2rem;
}

/* Teléfono (360-390px): números un poco más chicos y menos padding, sin scroll horizontal. */
@media (max-width: 575.98px) {
  .inicio-tarjeta {
    padding: 1rem;
  }

  .inicio-tarjeta__numero {
    font-size: 2.25rem;
  }
}

/* Agenda embebida debajo de las tarjetas: título con el link y un marco de alto fijo. */
.inicio-agenda {
  margin-top: 1.5rem;
}

.inicio-agenda__cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.inicio-agenda__abrir {
  display: inline-flex;
  align-items: center;
  font-size: 0.9rem;
  font-weight: 600;
  color: #0d6efd;
  text-decoration: none;
}

.inicio-agenda__abrir:hover {
  text-decoration: underline;
}

/* El alto lo pone este marco; la agenda scrollea por dentro. */
.inicio-agenda__marco {
  height: 760px;
}

@media (max-width: 575.98px) {
  .inicio-agenda__marco {
    height: 640px;
  }
}
</style>
