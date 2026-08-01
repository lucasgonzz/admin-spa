<template>
  <!-- Sin turno asignado: no se muestra ningún bloque (tabla de estados,
       demo_pagina.md §4 + contexto/demo_experiencia.md §3.14) -->
  <section v-if="estado !== 'sin_turno'" class="demo-boton-acceso">
    <!-- a) Antes del turno: hora reservada + cuenta regresiva + recordatorio de
         entrar desde una computadora. Texto de demo_pagina.md §4 a) -->
    <div v-if="estado === 'antes'" class="demo-boton-acceso__bloque">
      <p class="demo-boton-acceso__titulo">
        <strong>Tu demo está reservada para las {{ turno.hora_inicio }}.</strong>
      </p>
      <p v-if="cuenta_regresiva_texto" class="demo-boton-acceso__regresiva">
        {{ cuenta_regresiva_texto }}
      </p>
      <p class="demo-boton-acceso__nota">
        <em>Entrá desde una computadora: vas a usar el sistema con tus manos.</em>
      </p>
    </div>

    <!-- b) Durante el turno: botón activo con la hora hasta la que está reservada.
         Texto de demo_pagina.md §4 b). El link real de ingreso (demo_ingreso_token,
         grupo 233) no lo expone este endpoint público -- se cablea en otro prompt --
         así que por ahora queda deshabilitado con el aviso de "preparando tu acceso". -->
    <div v-else-if="estado === 'activo'" class="demo-boton-acceso__bloque">
      <button type="button" class="demo-boton-acceso__boton" disabled>
        Entrar a mi demo
      </button>
      <p class="demo-boton-acceso__nota">
        <em>Reservada hasta las {{ turno.hora_fin }}.</em>
      </p>
      <p class="demo-boton-acceso__aviso">Preparando tu acceso.</p>
    </div>

    <!-- c) Vencido, con la demo ya hecha (turno.ingreso === true). Tono amable,
         nada de urgencia fabricada. Texto de demo_pagina.md §4 c). -->
    <div v-else-if="estado === 'vencido' && turno.ingreso" class="demo-boton-acceso__bloque">
      <p class="demo-boton-acceso__titulo"><strong>Tu turno terminó.</strong></p>
      <p class="demo-boton-acceso__nota">
        Si querés volver a recorrerla, escribinos y te reservamos otro.
      </p>
    </div>

    <!-- d) Vencido, sin haber entrado nunca. El más delicado: ese lead sigue
         siendo recuperable, la instancia no es escasa (§3.16 D). Texto de
         demo_pagina.md §4 d). -->
    <div v-else-if="estado === 'vencido'" class="demo-boton-acceso__bloque">
      <p class="demo-boton-acceso__titulo"><strong>Tu turno venció.</strong></p>
      <p class="demo-boton-acceso__nota">
        Escribinos y coordinamos uno nuevo cuando te quede cómodo.
      </p>
    </div>
  </section>
</template>

<script>
/**
 * Botón de acceso a la demo (Grupo 300 · pagina-inmersiva-demo, prompt 05).
 * Cuatro estados, con los textos de contexto/demo_pagina.md §4 -- se
 * transcribe, no se reescribe.
 *
 * El estado SIEMPRE lo decide el backend (`turno.estado`, uno de
 * sin_turno|antes|activo|vencido, más `turno.ingreso` para distinguir los
 * dos casos de vencido). Este componente NUNCA calcula el estado con el
 * reloj del cliente -- solo usa la hora del cliente para la cuenta
 * regresiva visual del estado "antes", y al llegar a cero no habilita el
 * botón por su cuenta: vuelve a pedir el payload al backend (función
 * `refrescar` inyectada por el contenedor) y usa lo que responda.
 */
export default {
  name: 'BotonAcceso',

  props: {
    /** { fecha, hora_inicio, hora_fin, estado, ingreso } del turno, tal como llega del payload. */
    turno: {
      type: Object,
      default: function () {
        return {}
      },
    },
    /**
     * Función inyectada por el contenedor (ExperienciaDemo.vue) que vuelve a
     * pedir el payload completo al backend -- se usa cuando la cuenta
     * regresiva local llega a cero, para que el estado real (que puede
     * cambiar por gracia post-turno, etc.) lo siga dictando siempre el
     * servidor. Firma: refrescar() -> void.
     */
    refrescar: {
      type: Function,
      default: function () {},
    },
  },

  data() {
    return {
      /** Reloj local, solo para la cuenta regresiva visual. Se actualiza cada minuto. */
      ahora: new Date(),
      /** Id del setInterval que actualiza `ahora`, para poder limpiarlo al desmontar. */
      interval_id: null,
      /**
       * true una vez que ya se disparó `refrescar()` para el turno actual, para
       * no reintentar en cada tick mientras el backend todavía no actualizó el
       * estado. Se resetea cada vez que cambia el prop `turno` (ver watch).
       */
      ya_refresco: false,
    }
  },

  computed: {
    /**
     * Estado del turno tal como lo decide el backend. 'sin_turno' si el prop
     * todavía no llegó o no trae estado.
     *
     * @returns {string}
     */
    estado() {
      return (this.turno && this.turno.estado) || 'sin_turno'
    },

    /**
     * Fecha/hora de inicio del turno como objeto Date, fijada en la zona
     * horaria de referencia del backend (America/Argentina/Buenos_Aires,
     * offset fijo -03:00 -- el país no aplica horario de verano). Se arma
     * así, con el offset explícito en el ISO string, y no con
     * `new Date(fecha + ' ' + hora)`, para no depender de la zona horaria
     * del navegador del lead. Null si falta fecha u hora.
     *
     * @returns {Date|null}
     */
    fecha_hora_inicio() {
      if (!this.turno || !this.turno.fecha || !this.turno.hora_inicio) {
        return null
      }
      const iso = this.turno.fecha + 'T' + this.turno.hora_inicio + ':00-03:00'
      const parsed = new Date(iso)
      return isNaN(parsed.getTime()) ? null : parsed
    },

    /**
     * Milisegundos restantes hasta el inicio del turno, según el reloj local
     * (`ahora`). Null si no se pudo calcular `fecha_hora_inicio`.
     *
     * @returns {number|null}
     */
    milisegundos_restantes() {
      if (!this.fecha_hora_inicio) {
        return null
      }
      return this.fecha_hora_inicio.getTime() - this.ahora.getTime()
    },

    /**
     * Texto de la cuenta regresiva ("Faltan 2 h 14 min" / "Faltan 14 min"),
     * solo para el estado "antes". Cadena vacía si no se pudo calcular.
     *
     * @returns {string}
     */
    cuenta_regresiva_texto() {
      const ms = this.milisegundos_restantes
      if (ms === null) {
        return ''
      }
      const total_minutos = Math.max(0, Math.floor(ms / 60000))
      const horas = Math.floor(total_minutos / 60)
      const minutos = total_minutos % 60
      if (horas > 0) {
        return 'Faltan ' + horas + ' h ' + minutos + ' min'
      }
      return 'Faltan ' + minutos + ' min'
    },
  },

  watch: {
    /**
     * Cuando el contenedor refresca `turno` (por ejemplo, después de que este
     * mismo componente pidió el refresco al llegar la cuenta a cero), se
     * habilita de nuevo la posibilidad de disparar `refrescar()` si hiciera
     * falta otra vez más adelante.
     */
    turno: {
      deep: true,
      handler: function () {
        this.ya_refresco = false
      },
    },
  },

  mounted() {
    /* Primer chequeo inmediato (por si la página se abre ya con la cuenta en
       cero) y luego un tick por minuto -- la cuenta regresiva "se actualiza
       sola cada minuto" (criterio de éxito 5 del prompt). */
    this.tick()
    this.interval_id = setInterval(this.tick, 60000)
  },

  beforeUnmount() {
    if (this.interval_id) {
      clearInterval(this.interval_id)
    }
  },

  methods: {
    /**
     * Refresca el reloj local y chequea si la cuenta regresiva llegó a cero.
     *
     * @returns {void}
     */
    tick: function () {
      this.ahora = new Date()
      this.verificar_vencimiento()
    },

    /**
     * Si el estado es "antes" y la cuenta regresiva local ya llegó a cero,
     * pide el payload de nuevo al backend en vez de habilitar el botón por
     * su cuenta -- el estado siempre lo dicta el servidor.
     *
     * @returns {void}
     */
    verificar_vencimiento: function () {
      if (this.estado !== 'antes' || this.ya_refresco) {
        return
      }
      const ms = this.milisegundos_restantes
      if (ms !== null && ms <= 0) {
        this.ya_refresco = true
        this.refrescar()
      }
    },
  },
}
</script>

<style scoped>
.demo-boton-acceso {
  max-width: 480px;
  margin: 0 auto;
  padding: 0 20px 64px;
  text-align: center;
}

.demo-boton-acceso__bloque {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.demo-boton-acceso__titulo {
  font-size: 1.2rem;
  margin: 0;
}

.demo-boton-acceso__regresiva {
  font-size: clamp(1.4rem, 3vw, 1.8rem);
  font-weight: 700;
  background: var(--demo-gradient-marca);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin: 0;
}

.demo-boton-acceso__nota {
  color: var(--demo-color-texto-suave);
  font-size: 0.95rem;
  margin: 0;
}

.demo-boton-acceso__boton {
  min-height: 56px;
  min-width: 220px;
  padding: 14px 32px;
  border-radius: 14px;
  border: none;
  background: var(--demo-gradient-marca);
  color: #fff;
  font-family: inherit;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: not-allowed;
}

.demo-boton-acceso__boton:disabled {
  opacity: 0.7;
}

.demo-boton-acceso__aviso {
  color: var(--demo-color-texto-suave);
  font-size: 0.85rem;
  margin: 0;
}
</style>
