<template>
  <base-modal
    :show="show"
    title="Cotizar el sistema"
    size="lg"
    :stack_level="stack_level"
    @update:show="on_update_show"
    @close="cerrar"
  >
    <!-- Estado: trayendo los precios por defecto y si Mercado Pago está configurado -->
    <p v-if="cargando_settings" class="text-muted small mb-0">Cargando los precios…</p>

    <div v-else-if="settings_error" class="alert alert-danger py-2 px-3 small mb-0" role="alert">
      {{ settings_error }}
    </div>

    <template v-else>
      <!-- 🔴 El motivo se muestra ACÁ, apenas abre el modal, y no recién al apretar el botón:
           sin la credencial cargada el link no se puede generar, y descubrirlo después de tipear
           toda la cotización es la peor forma de enterarse. -->
      <div
        v-if="!settings.mercado_pago_configurado"
        class="alert alert-warning py-2 px-3 small mb-3"
        role="alert"
      >
        <strong>No se puede generar el link de pago.</strong>
        Falta configurar la credencial de Mercado Pago (<code>MP_ADMIN_ACCESS_TOKEN</code>) en el
        <code>.env</code> del admin. La cotización se calcula igual, pero el botón de generar el
        link queda deshabilitado hasta que la credencial esté cargada.
      </div>

      <!-- ===================== Sistemas a cotizar ===================== -->
      <h6 class="text-primary mb-2">Sistemas a cotizar</h6>
      <div class="alert alert-light border mb-3">
        <p class="text-muted small mb-2">
          Marcá los sistemas que entran en la cotización. Los precios vienen de la configuración y
          se pueden cambiar acá para este lead puntual, sin tocar el valor por defecto de todos.
        </p>

        <div
          v-for="fila in filas"
          :key="fila.key"
          class="row g-2 align-items-center mb-2"
        >
          <!-- En teléfono la casilla ocupa el ancho entero y el precio baja abajo; de tablet
               para arriba van uno al lado del otro. -->
          <div class="col-12 col-md-7">
            <div class="form-check mb-0">
              <input
                :id="checkbox_id(fila.key)"
                v-model="fila.incluir"
                class="form-check-input"
                type="checkbox"
              />
              <label class="form-check-label" :for="checkbox_id(fila.key)">
                {{ fila.label }}
              </label>
            </div>
          </div>
          <div class="col-12 col-md-5">
            <div class="input-group input-group-sm">
              <span class="input-group-text">USD</span>
              <input
                v-model="fila.precio_usd"
                type="number"
                min="0"
                :max="MAX_PRECIO_USD"
                step="0.01"
                class="form-control"
                :disabled="!fila.incluir"
                :aria-label="'Precio en dólares de ' + fila.label"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- ===================== Valor del dólar ===================== -->
      <h6 class="text-primary mb-2">Valor del dólar</h6>
      <div class="alert alert-light border mb-3">
        <div class="row g-2">
          <div class="col-12 col-md-6">
            <label class="form-label small mb-1" :for="dolar_input_id">
              Cotización del dólar en pesos
            </label>
            <div class="input-group">
              <span class="input-group-text">$</span>
              <input
                :id="dolar_input_id"
                v-model="dolar"
                type="number"
                min="0"
                :max="MAX_DOLAR"
                step="0.01"
                class="form-control"
                placeholder="1450.50"
              />
            </div>
            <p class="text-muted small mb-0 mt-1">
              Se carga a mano: el sistema no consulta ninguna cotización automática.
            </p>
          </div>
        </div>
      </div>

      <!-- ===================== Resumen ===================== -->
      <h6 class="text-primary mb-2">
        {{ mostrando_servidor ? 'Cotización generada' : 'Resumen de la cotización' }}
      </h6>
      <div
        class="alert border mb-3"
        :class="mostrando_servidor ? 'alert-success' : 'alert-light'"
      >
        <p v-if="mostrando_servidor" class="small mb-2">
          Estos son los números que devolvió el servidor: son exactamente los que va a pagar el
          lead con el link de abajo.
        </p>

        <template v-if="numeros.items.length">
          <!-- Detalle por sistema: es lo que el usuario mira si el total no le cuadra, así que
               tiene que cerrar exactamente con el total de abajo. -->
          <div
            v-for="item in numeros.items"
            :key="'detalle-' + item.key"
            class="d-flex justify-content-between align-items-start gap-2 small border-bottom py-1"
          >
            <span>{{ item.label }}</span>
            <span class="text-end text-nowrap">
              {{ format_monto_con_moneda(item.precio_usd, 'USD') }}
              <span class="text-muted d-block d-sm-inline">
                <span class="d-none d-sm-inline">· </span>{{ format_monto_con_moneda(item.precio_ars, 'ARS') }}
              </span>
            </span>
          </div>

          <!-- Totales: en teléfono uno arriba del otro, de tablet para arriba lado a lado. -->
          <div class="row g-2 mt-2">
            <div class="col-12 col-md-6">
              <div class="border rounded bg-white p-2 h-100">
                <div class="text-muted small">Total en dólares</div>
                <div class="fw-semibold text-break">{{ format_monto_con_moneda(numeros.total_usd, 'USD') }}</div>
              </div>
            </div>
            <div class="col-12 col-md-6">
              <div class="border rounded bg-white p-2 h-100">
                <div class="text-muted small">Total en pesos</div>
                <div class="fw-semibold text-break">{{ format_monto_con_moneda(numeros.total_ars, 'ARS') }}</div>
              </div>
            </div>
          </div>

          <!-- Frase textual de Lucas: la cuenta de Mercado Pago tiene las cuotas sin interés
               habilitadas, así que se anuncian como tales. -->
          <p class="fw-semibold mt-3 mb-0 text-break">
            {{ numeros.cuotas }} cuotas sin interés de {{ format_pesos(numeros.cuota_ars) }}
          </p>

          <!-- Transferencia directa: el descuento se muestra en las DOS monedas porque el lead
               puede transferir en cualquiera de las dos. -->
          <div class="mt-3">
            <div class="small fw-semibold mb-1">
              Pagando por transferencia directa ({{ numeros.descuento_transferencia }}% de descuento)
            </div>
            <div class="row g-2">
              <div class="col-12 col-md-6">
                <div class="border rounded bg-white p-2 h-100">
                  <div class="text-muted small">En dólares</div>
                  <div class="fw-semibold text-break">
                    {{ format_monto_con_moneda(numeros.transferencia_usd, 'USD') }}
                  </div>
                </div>
              </div>
              <div class="col-12 col-md-6">
                <div class="border rounded bg-white p-2 h-100">
                  <div class="text-muted small">En pesos</div>
                  <div class="fw-semibold text-break">
                    {{ format_monto_con_moneda(numeros.transferencia_ars, 'ARS') }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <p v-else class="text-muted small mb-0">
          Elegí al menos un sistema y cargá el valor del dólar para ver la cotización.
        </p>
      </div>

      <!-- ===================== Link de pago generado ===================== -->
      <template v-if="cotizacion">
        <h6 class="text-primary mb-2">Link de pago</h6>
        <div class="alert alert-light border mb-3">
          <!-- 🔴 Si después de generar el link se tocó algún valor, el link ya NO corresponde a
               los números que están en pantalla. Se avisa en vez de esconderlo: el link viejo
               sigue sirviendo si ya se mandó, pero no es lo que se está mostrando arriba. -->
          <div
            v-if="form_tocado_despues_de_generar"
            class="alert alert-warning py-2 px-3 small"
            role="alert"
          >
            Cambiaste valores después de generar este link. El link de abajo sigue cobrando
            <strong>{{ format_monto_con_moneda(cotizacion.total_ars, 'ARS') }}</strong>, que no es
            lo que muestra el resumen de arriba. Generá uno nuevo si querés cobrar el importe nuevo.
          </div>

          <label class="form-label small mb-1" :for="link_input_id">
            Link para mandarle al lead
          </label>
          <div class="input-group">
            <input
              :id="link_input_id"
              :value="cotizacion.link_pago"
              type="text"
              class="form-control"
              readonly
            />
            <button
              type="button"
              class="btn btn-outline-primary"
              :title="copiado ? 'Copiado' : 'Copiar el link'"
              @click="copiar_link"
            >
              {{ copiado ? 'Copiado' : 'Copiar' }}
            </button>
          </div>
          <p v-if="vence_texto" class="text-muted small mb-0 mt-1">
            El link vence el {{ vence_texto }}.
          </p>
        </div>
      </template>

      <!-- Error del backend (422): se muestra acá adentro y el modal NO se cierra -->
      <div v-if="error_message" class="alert alert-danger py-2 px-3 small mb-0" role="alert">
        {{ error_message }}
      </div>
    </template>

    <template #footer>
      <!-- El motivo por el que no se puede generar va SIEMPRE visible al lado del botón, no
           escondido en un title: un botón gris sin explicación es un callejón sin salida. -->
      <span v-if="motivo_deshabilitado" class="text-muted small me-auto text-start">
        {{ motivo_deshabilitado }}
      </span>
      <button type="button" class="btn btn-secondary" :disabled="generando" @click="cerrar">
        Cerrar
      </button>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="generando || !puede_generar"
        @click="generar_link"
      >
        <span v-if="generando" class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
        {{ generando ? 'Generando...' : 'Generar link de pago' }}
      </button>
    </template>
  </base-modal>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import BaseModal from '@/components/ui/BaseModal.vue'
import { format_monto_con_moneda } from '@/components/cobranzas/plata'

/** Techo de precio por sistema que valida el backend (plan, §4 decisión 1). */
const MAX_PRECIO_USD = 100000

/** Techo del valor del dólar que valida el backend (plan, §4 decisión 1). */
const MAX_DOLAR = 1000000

/**
 * Redondeo a N decimales con el mismo criterio que `round()` de PHP: la media unidad se aleja
 * siempre del cero, después de limpiar la basura binaria del punto flotante.
 *
 * 🔴 NO es un `Math.round(x * 100) / 100`, y la diferencia no es teórica. Medido el 22/9/2026
 * con valores que este cotizador puede tener perfectamente: con `precio_usd = 500.01` y
 * `dolar = 1056.5`, el producto da `528260.565`; `Math.round(528260.565 * 100) / 100` devuelve
 * `528260.56` porque el `* 100` cae en `52826056.49999999`, mientras el `round()` de PHP del
 * backend devuelve `528260.57`. Un centavo de diferencia entre el número que ve el operador en
 * el preview y el que termina cobrando el link es exactamente lo que el plan (§11) manda
 * evitar. El `toPrecision(15)` recorta esa basura binaria antes de redondear.
 *
 * @param {number|string|null|undefined} valor
 * @param {number} decimales
 * @returns {number}
 */
function redondear(valor, decimales) {
  const n = Number(valor)
  if (!isFinite(n)) {
    return 0
  }
  const factor = Math.pow(10, decimales)
  /* El signo se saca antes porque `Math.round(-0.5)` da -0 (redondea hacia +infinito) y
     `round()` de PHP da -1. Hoy los valores son todos positivos por validación, pero la
     función no tiene por qué depender de eso para coincidir con el servidor. */
  const signo = n < 0 ? -1 : 1
  const escalado = Number((Math.abs(n) * factor).toPrecision(15))
  return (signo * Math.round(escalado)) / factor
}

/**
 * Modal del cotizador del sistema, apilado sobre el modal del lead (misión
 * cotizador-lead-mercado-pago, 22/9/2026).
 *
 * Calcula la cotización en vivo mientras el operador tipea —total en dólares y en pesos, el
 * valor de cada cuota sin interés y el precio con descuento por transferencia en las dos
 * monedas— y genera el link de pago de Mercado Pago con el importe ya cotizado.
 *
 * 🔴 Las seis fórmulas de `numeros_preview` están copiadas del apéndice §11 del plan y son
 * idénticas a las del backend, incluido el detalle de que `total_ars` se suma a partir de los
 * `precio_ars` YA REDONDEADOS y no de `total_usd * dolar`. Si las dos cuentas no dan igual, el
 * operador ve un número y el lead paga otro. **No las toques de un lado solo.**
 *
 * Una vez generado el link, lo que se muestra son los números que devolvió el SERVIDOR, no los
 * del preview: el servidor recalcula todo y es el único que sabe con qué importe quedó armada
 * la preferencia de Mercado Pago.
 */
export default {
  name: 'CotizadorModal',
  components: { BaseModal },
  props: {
    /** Visibilidad, controlada por el padre (v-model:show). */
    show: { type: Boolean, default: false },
    /** Lead que se está cotizando; necesita `id`. */
    lead: { type: Object, default: null },
    /** Nivel de apilamiento del BaseModal: 1 porque se abre desde adentro del modal del lead. */
    stack_level: { type: Number, default: 1 },
  },
  emits: ['update:show', 'close', 'generada'],
  data() {
    return {
      /** Techos del backend, expuestos al template para los `max` de los inputs. */
      MAX_PRECIO_USD: MAX_PRECIO_USD,
      /** Ídem para el valor del dólar. */
      MAX_DOLAR: MAX_DOLAR,
      /** true mientras corre el GET de la configuración del cotizador. */
      cargando_settings: false,
      /** Error del GET de configuración; si está, no se muestra el formulario. */
      settings_error: '',
      /** Configuración del cotizador que devuelve el servidor (defaults, descuento, cuotas). */
      settings: {
        /** Precio por defecto de ComercioCity Gestión, en dólares. */
        precio_gestion: 0,
        /** Precio por defecto de ComercioCity E-Commerce, en dólares. */
        precio_ecommerce: 0,
        /** Precio por defecto de ComercioCity Agentes, en dólares. */
        precio_agentes: 0,
        /** Porcentaje de descuento por pagar con transferencia directa. */
        descuento_transferencia: 0,
        /** Días que tarda en vencer el link de pago. */
        link_vence_dias: 0,
        /** En cuántas cuotas sin interés se financia el total. */
        cuotas: 3,
        /** Derivado del servidor: si el access token de Mercado Pago está cargado. */
        mercado_pago_configurado: false,
        /** Sistemas cotizables con su etiqueta y precio por defecto; única fuente de los nombres. */
        sistemas: [],
      },
      /** Filas editables del formulario: `{key, label, incluir, precio_usd}`. */
      filas: [],
      /** Valor del dólar tipeado a mano; vacío hasta que el operador lo carga. */
      dolar: '',
      /** true mientras corre el POST que genera el link. */
      generando: false,
      /** Mensaje de error del backend (422), mostrado adentro del modal. */
      error_message: '',
      /** Cotización que devolvió el servidor; null hasta que se genera el primer link. */
      cotizacion: null,
      /**
       * true si se tocó algún valor del formulario después de generar el link. Mientras sea
       * false, la pantalla muestra los números del servidor; cuando se vuelve true, vuelve a
       * mostrar el preview y el link queda marcado como "de la cotización anterior".
       */
      form_tocado_despues_de_generar: false,
      /** Feedback efímero del botón de copiar el link. */
      copiado: false,
    }
  },
  computed: {
    /**
     * Las seis fórmulas del apéndice §11 del plan, calculadas sobre lo que hay en el formulario.
     * Es el preview que se ve mientras el operador tipea.
     *
     * @returns {Object} items, total_usd, total_ars, cuotas, cuota_ars, descuento_transferencia,
     *                   transferencia_usd, transferencia_ars
     */
    numeros_preview() {
      /** Valor del dólar tipeado, como número. */
      const dolar = Number(this.dolar || 0)
      /** Detalle por sistema elegido, con el precio ya pasado a pesos. */
      const items = []
      /** Acumulador del total en dólares. */
      let suma_usd = 0
      /** Acumulador del total en pesos, sumando los `precio_ars` YA redondeados. */
      let suma_ars = 0

      this.filas.forEach(function (fila) {
        if (!fila.incluir) {
          return
        }
        /** Precio del sistema en dólares, tal como quedó en el input. */
        const precio_usd = Number(fila.precio_usd || 0)
        /* Fórmula 1: precio_ars(item) = round(precio_usd * dolar, 2) */
        const precio_ars = redondear(precio_usd * dolar, 2)
        items.push({
          key: fila.key,
          label: fila.label,
          precio_usd: precio_usd,
          precio_ars: precio_ars,
        })
        suma_usd += precio_usd
        suma_ars += precio_ars
      })

      /* Fórmula 2: total_usd = round(suma de precio_usd, 2) */
      const total_usd = redondear(suma_usd, 2)
      /* Fórmula 3: total_ars = round(suma de precio_ars, 2) — suma de los YA redondeados, no
         de total_usd * dolar, para que el detalle de arriba cierre con el total. */
      const total_ars = redondear(suma_ars, 2)

      /** Cantidad de cuotas sin interés; sale de la configuración del servidor. */
      const cuotas = Number(this.settings.cuotas || 0)
      /* Fórmula 4: cuota_ars = round(total_ars / cuotas, 2) */
      const cuota_ars = cuotas > 0 ? redondear(total_ars / cuotas, 2) : 0

      /** Porcentaje de descuento por transferencia directa. */
      const descuento = Number(this.settings.descuento_transferencia || 0)
      /* Fórmula 5: transferencia_usd = round(total_usd * (1 - descuento/100), 2) */
      const transferencia_usd = redondear(total_usd * (1 - descuento / 100), 2)
      /* Fórmula 6: transferencia_ars = round(total_ars * (1 - descuento/100), 2) */
      const transferencia_ars = redondear(total_ars * (1 - descuento / 100), 2)

      return {
        items: items,
        total_usd: total_usd,
        total_ars: total_ars,
        cuotas: cuotas,
        cuota_ars: cuota_ars,
        descuento_transferencia: descuento,
        transferencia_usd: transferencia_usd,
        transferencia_ars: transferencia_ars,
      }
    },
    /**
     * true si en pantalla se están mostrando los números que devolvió el servidor (y no el
     * preview): hay cotización generada y nadie tocó el formulario desde entonces.
     *
     * @returns {boolean}
     */
    mostrando_servidor() {
      return Boolean(this.cotizacion) && !this.form_tocado_despues_de_generar
    },
    /**
     * Los números que efectivamente se muestran: los del servidor si la cotización está fresca,
     * los del preview en cualquier otro caso.
     *
     * @returns {Object} mismo shape que `numeros_preview`
     */
    numeros() {
      if (!this.mostrando_servidor) {
        return this.numeros_preview
      }
      return {
        items: this.cotizacion.items || [],
        total_usd: this.cotizacion.total_usd,
        total_ars: this.cotizacion.total_ars,
        cuotas: this.cotizacion.cuotas,
        cuota_ars: this.cotizacion.cuota_ars,
        descuento_transferencia: this.cotizacion.descuento_transferencia,
        transferencia_usd: this.cotizacion.transferencia_usd,
        transferencia_ars: this.cotizacion.transferencia_ars,
      }
    },
    /**
     * Filas marcadas para incluir en la cotización.
     *
     * @returns {Array<Object>}
     */
    filas_elegidas() {
      return this.filas.filter(function (fila) {
        return fila.incluir
      })
    },
    /**
     * Motivo por el que el botón de generar está deshabilitado, o cadena vacía si se puede
     * generar. Se muestra en pantalla: el operador no tiene que adivinar por qué está gris.
     *
     * @returns {string}
     */
    motivo_deshabilitado() {
      if (this.cargando_settings || this.settings_error) {
        return ''
      }
      if (!this.settings.mercado_pago_configurado) {
        return 'Falta la credencial de Mercado Pago en el .env del admin.'
      }
      if (!this.lead || !this.lead.id) {
        return 'No hay un lead abierto.'
      }
      if (this.filas_elegidas.length === 0) {
        return 'Elegí al menos un sistema para cotizar.'
      }
      /* Los mismos techos que valida el backend, chequeados acá para no gastar un ida y vuelta
         que vuelve con "The given data was invalid." sin decir qué campo. */
      let precio_invalido = ''
      this.filas_elegidas.forEach(function (fila) {
        const precio = Number(fila.precio_usd)
        if (!isFinite(precio) || precio <= 0) {
          precio_invalido = 'El precio de ' + fila.label + ' tiene que ser mayor a cero.'
        } else if (precio > MAX_PRECIO_USD) {
          precio_invalido =
            'El precio de ' + fila.label + ' no puede superar los ' + MAX_PRECIO_USD + ' USD.'
        }
      })
      if (precio_invalido) {
        return precio_invalido
      }
      const dolar = Number(this.dolar)
      if (!this.dolar || !isFinite(dolar) || dolar <= 0) {
        return 'Cargá el valor del dólar.'
      }
      if (dolar > MAX_DOLAR) {
        return 'El valor del dólar no puede superar los ' + MAX_DOLAR + '.'
      }
      return ''
    },
    /**
     * true si el formulario está completo y la credencial está cargada.
     *
     * @returns {boolean}
     */
    puede_generar() {
      return !this.cargando_settings && !this.settings_error && this.motivo_deshabilitado === ''
    },
    /**
     * Id del input del dólar, atado al lead: dos modales con el mismo `for` en el DOM hacen que
     * el click en una etiqueta enfoque el input del otro (mismo criterio que Index.vue).
     *
     * @returns {string}
     */
    dolar_input_id() {
      return 'cotizador_dolar_' + this.lead_id_seguro
    },
    /**
     * Id del input del link generado.
     *
     * @returns {string}
     */
    link_input_id() {
      return 'cotizador_link_' + this.lead_id_seguro
    },
    /**
     * Id del lead, o 0 si todavía no hay ninguno. Solo se usa para armar ids del DOM.
     *
     * @returns {number|string}
     */
    lead_id_seguro() {
      return this.lead && this.lead.id ? this.lead.id : 0
    },
    /**
     * Fecha de vencimiento del link, legible. Cadena vacía si el servidor no la mandó.
     *
     * @returns {string}
     */
    vence_texto() {
      if (!this.cotizacion || !this.cotizacion.vence_at) {
        return ''
      }
      const fecha = new Date(this.cotizacion.vence_at)
      if (isNaN(fecha.getTime())) {
        return ''
      }
      return fecha.toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    },
  },
  watch: {
    /**
     * Al abrir se rearma todo y se piden los precios por defecto. Si se hiciera en `mounted`
     * quedaría con los valores de la primera apertura para siempre, porque el componente vive
     * mientras vive la pestaña del contrato.
     *
     * @param {boolean} visible
     * @returns {void}
     */
    show(visible) {
      if (visible) {
        this.reset()
        this.cargar_settings()
      }
    },
    /**
     * Cualquier cambio en los sistemas elegidos o en sus precios invalida la cotización que ya
     * se generó: los números de pantalla vuelven a ser los del preview.
     *
     * @returns {void}
     */
    filas: {
      deep: true,
      handler: function () {
        this.marcar_form_tocado()
      },
    },
    /**
     * Ídem para el valor del dólar.
     *
     * @returns {void}
     */
    dolar() {
      this.marcar_form_tocado()
    },
  },
  methods: {
    format_monto_con_moneda,
    /**
     * Importe en pesos con el signo adelante: `$1.015.350`, `$1.015.350,33`.
     *
     * Se apoya en `format_monto_con_moneda` de cobranzas para no tener dos criterios de
     * separador de miles y de centavos en la misma pantalla, y solo le cambia la etiqueta
     * `ARS ` por `$`: la frase de las cuotas es textual de Lucas ("3 cuotas sin interés de $X")
     * y ahí la moneda ya está dicha por el contexto.
     *
     * @param {number|string|null|undefined} valor
     * @returns {string}
     */
    format_pesos(valor) {
      return '$' + format_monto_con_moneda(valor, 'ARS').replace(/^ARS\s*/, '')
    },
    /**
     * Id del checkbox de un sistema, atado al lead por el mismo motivo que `dolar_input_id`.
     *
     * @param {string} key clave del sistema (gestion, ecommerce, agentes)
     * @returns {string}
     */
    checkbox_id(key) {
      return 'cotizador_' + key + '_' + this.lead_id_seguro
    },
    /**
     * Deja el modal como recién abierto.
     *
     * @returns {void}
     */
    reset() {
      this.filas = []
      this.dolar = ''
      this.generando = false
      this.error_message = ''
      this.cotizacion = null
      this.form_tocado_despues_de_generar = false
      this.copiado = false
      this.settings_error = ''
    },
    /**
     * Marca que el formulario cambió después de generar el link. No hace nada si todavía no se
     * generó ninguno: sin cotización no hay nada que invalidar.
     *
     * @returns {void}
     */
    marcar_form_tocado() {
      if (this.cotizacion) {
        this.form_tocado_despues_de_generar = true
      }
    },
    /**
     * GET /settings/cotizador — precios por defecto, descuento, cuotas y si Mercado Pago está
     * configurado. Sin caché a propósito: `mercado_pago_configurado` cambia en cuanto Lucas
     * carga la credencial en el `.env`, y un valor cacheado dejaría el botón gris sin motivo.
     *
     * @returns {void}
     */
    cargar_settings() {
      const self = this
      self.cargando_settings = true
      self.settings_error = ''
      api
        .get('/settings/cotizador')
        .then(function (response) {
          /** Payload de configuración; si viene vacío se usan los defaults locales. */
          const data = response.data || {}
          Object.keys(self.settings).forEach(function (key) {
            if (data[key] !== undefined) {
              self.settings[key] = data[key]
            }
          })
          self.construir_filas()
          /* El dólar se prellena con el de la última cotización de este lead, si la hubo: es el
             único valor que el operador tiene que salir a buscar afuera, y repetirlo a mano
             entre dos cotizaciones del mismo lead es puro trabajo manual. */
          if (self.lead && self.lead.contract_cotizacion_dolar) {
            self.dolar = String(self.lead.contract_cotizacion_dolar)
          }
          /* Prellenar el dólar cuenta como "tocar el formulario"; como todavía no hay cotización
             generada, `marcar_form_tocado` no hace nada, pero se deja explícito. */
          self.form_tocado_despues_de_generar = false
        })
        .catch(function (error) {
          self.settings_error = resolve_error_message(error)
        })
        .then(function () {
          self.cargando_settings = false
        })
    },
    /**
     * Arma las filas editables a partir de los sistemas que devolvió el servidor. Las etiquetas
     * y las claves salen de ahí y no de una lista local: el backend es la única fuente de los
     * nombres de los sistemas.
     *
     * Arranca con solo Gestión marcado: es el producto base, y los otros dos son adicionales que
     * conviene sumar a propósito y no por venir marcados de fábrica.
     *
     * @returns {void}
     */
    construir_filas() {
      /** Sistemas cotizables tal como los devolvió el servidor. */
      const sistemas = Array.isArray(this.settings.sistemas) ? this.settings.sistemas : []
      this.filas = sistemas.map(function (sistema) {
        return {
          key: sistema.key,
          label: sistema.label,
          precio_usd: sistema.precio_usd,
          incluir: sistema.key === 'gestion',
        }
      })
    },
    /**
     * Propaga el cierre pedido por el BaseModal (Escape, backdrop, X).
     *
     * @param {boolean} visible
     * @returns {void}
     */
    on_update_show(visible) {
      this.$emit('update:show', visible)
    },
    /**
     * Cierra el modal. No corta el POST en vuelo: mientras se está generando el link, el botón
     * de cerrar está deshabilitado.
     *
     * @returns {void}
     */
    cerrar() {
      if (this.generando) {
        return
      }
      this.$emit('update:show', false)
      this.$emit('close')
    },
    /**
     * POST /lead/{id}/cotizacion/link-pago — el servidor revalida, recalcula el total con las
     * mismas seis fórmulas, pide la preferencia a Mercado Pago y persiste la foto de la
     * cotización en el lead.
     *
     * El total NO se manda: lo recalcula el servidor a partir de los sistemas y el dólar. Un
     * total que viajara desde el navegador sería justamente el agujero que se cerró en la tienda
     * el 16/9/2026.
     *
     * @returns {void}
     */
    generar_link() {
      const self = this
      if (!self.puede_generar || self.generando) {
        return
      }
      self.generando = true
      self.error_message = ''
      api
        .post(
          '/lead/' + self.lead.id + '/cotizacion/link-pago',
          {
            dolar: Number(self.dolar),
            sistemas: self.filas_elegidas.map(function (fila) {
              return { key: fila.key, precio_usd: Number(fila.precio_usd) }
            }),
          },
          /* El error se muestra adentro del modal (incluido el motivo textual de la credencial
             faltante); sin esto el interceptor global sacaría además una toast con el mismo
             texto. */
          { silent_error: true }
        )
        .then(function (response) {
          /** Respuesta del servidor: `{model, cotizacion}`. */
          const data = response.data || {}
          self.cotizacion = data.cotizacion || null
          self.form_tocado_despues_de_generar = false
          self.copiado = false
          self.$emit('generada', data)
        })
        .catch(function (error) {
          self.error_message = resolve_error_message(error)
        })
        .then(function () {
          self.generando = false
        })
    },
    /**
     * Copia el link al portapapeles, con el mismo respaldo que usa CommandRow.vue para los
     * navegadores sin `navigator.clipboard`.
     *
     * @returns {void}
     */
    copiar_link() {
      const self = this
      /** Input de solo lectura que tiene el link; también sirve para el respaldo por selección. */
      const el = document.getElementById(self.link_input_id)
      if (!el || !el.value) {
        return
      }
      /** Marca el feedback del botón y lo apaga solo. */
      const on_copiado = function () {
        self.copiado = true
        setTimeout(function () {
          self.copiado = false
        }, 1500)
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(el.value)
          .then(on_copiado)
          .catch(function () {
            self.copiar_por_seleccion(el)
            on_copiado()
          })
        return
      }
      self.copiar_por_seleccion(el)
      on_copiado()
    },
    /**
     * Respaldo de copiado por selección + `execCommand`, para navegadores sin portapapeles.
     *
     * @param {HTMLInputElement} el
     * @returns {void}
     */
    copiar_por_seleccion(el) {
      el.focus()
      el.select()
      el.setSelectionRange(0, 99999)
      try {
        document.execCommand('copy')
      } catch (e) {
        /* Sin portapapeles no hay nada más que hacer: el link queda visible para copiarlo a mano. */
      }
    },
  },
}
</script>
