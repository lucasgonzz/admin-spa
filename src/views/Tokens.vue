<template>
  <div class="container-fluid px-0 py-4 tokens-vista">
    <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
      <h2 class="h4 mb-0">Tokens</h2>

      <div class="d-flex flex-wrap align-items-end gap-3">
        <div>
          <label class="form-label small text-muted mb-1 d-block">Período</label>
          <div class="btn-group btn-group-sm" role="group">
            <button
              v-for="opcion in atajos"
              :key="opcion.dias"
              type="button"
              class="btn"
              :class="dias_elegidos === opcion.dias ? 'btn-dark' : 'btn-outline-secondary'"
              @click="elegir_atajo(opcion.dias)"
            >
              {{ opcion.label }}
            </button>
          </div>
        </div>

        <div>
          <label class="form-label small text-muted mb-1">Desde</label>
          <input v-model="desde" type="date" class="form-control form-control-sm" @change="fechas_a_mano" />
        </div>

        <div>
          <label class="form-label small text-muted mb-1">Hasta</label>
          <input v-model="hasta" type="date" class="form-control form-control-sm" @change="fechas_a_mano" />
        </div>

        <button type="button" class="btn btn-outline-primary btn-sm" :disabled="loading" @click="cargar">
          <span
            v-if="loading"
            class="spinner-border spinner-border-sm me-1"
            role="status"
            aria-hidden="true"
          />
          Ver
        </button>
      </div>
    </div>

    <!-- Carga inicial -->
    <div v-if="loading && !cargado_alguna_vez" class="text-center py-5">
      <span class="spinner-border text-primary" role="status" aria-hidden="true" />
      <p class="text-muted mt-2">Cargando consumo...</p>
    </div>

    <!-- Error de carga -->
    <div v-else-if="load_error" class="alert alert-danger">
      {{ load_error }}
    </div>

    <div v-else class="tokens-cuerpo">
      <!-- Las tres cifras del período, para todos los clientes juntos. -->
      <div class="row g-3 mb-4">
        <div class="col-12 col-md-4">
          <div class="card h-100 border-0 tokens-cifra">
            <div class="card-body">
              <p class="tokens-cifra__rotulo mb-1">Costo estimado</p>
              <p class="tokens-cifra__valor mb-0">{{ costo_visible(totales.costo_usd) }}</p>
              <p v-if="hay_sin_precio" class="tokens-cifra__pie mb-0">
                No incluye {{ modelos_sin_precio_texto }}: sin precio cargado.
              </p>
            </div>
          </div>
        </div>

        <div class="col-6 col-md-4">
          <div class="card h-100 border-0 tokens-cifra">
            <div class="card-body">
              <p class="tokens-cifra__rotulo mb-1">Tokens</p>
              <p class="tokens-cifra__valor mb-0">{{ numero(totales.tokens) }}</p>
              <p class="tokens-cifra__pie mb-0">{{ por_cliente.length }} clientes con consumo</p>
            </div>
          </div>
        </div>

        <div class="col-6 col-md-4">
          <div class="card h-100 border-0 tokens-cifra">
            <div class="card-body">
              <p class="tokens-cifra__rotulo mb-1">Llamadas</p>
              <p class="tokens-cifra__valor mb-0">{{ numero(totales.llamadas) }}</p>
              <p class="tokens-cifra__pie mb-0">{{ dias_del_rango.length }} días</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Serie por día de toda la plataforma. -->
      <div class="card border-0 tokens-panel mb-4">
        <div class="card-body">
          <p class="tokens-panel__titulo mb-3">Por día</p>

          <p v-if="!hay_consumo" class="text-muted small fst-italic mb-0">
            Sin consumo registrado en este período.
          </p>

          <div v-else class="tokens-serie">
            <div
              v-for="dia in dias_del_rango"
              :key="dia.fecha"
              class="tokens-serie__col"
              :title="titulo_del_dia(dia)"
            >
              <div class="tokens-serie__pista">
                <div class="tokens-serie__barra" :style="{ height: alto_de(dia) }" />
              </div>
              <span class="tokens-serie__dia">{{ dia_corto(dia.fecha) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="row g-3 mb-4">
        <!-- ========================================================== -->
        <!-- El ranking, que es el dato operativo de esta pantalla: con -->
        <!-- cuarenta y cinco clientes el gasto no se reparte parejo, y -->
        <!-- saber quién lo empujó es lo que permite ir a mirar SU      -->
        <!-- pestaña.                                                   -->
        <!-- ========================================================== -->
        <div class="col-12 col-lg-7">
          <div class="card border-0 tokens-panel h-100">
            <div class="card-body">
              <p class="tokens-panel__titulo mb-3">Por cliente</p>

              <p v-if="por_cliente.length === 0" class="text-muted small fst-italic mb-0">
                Ningún cliente registró consumo en este período.
              </p>

              <div v-else class="table-responsive">
                <table class="table table-sm align-middle mb-0 tokens-tabla">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th class="text-end">Llamadas</th>
                      <th class="text-end">Tokens</th>
                      <th class="text-end">Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    <!-- Sin @click ni cursor de mano: el modal de la ficha es del ResourceView
                         genérico y no se puede abrir por URL, así que lo único que podía hacer un
                         clic acá era llevar al listado. Una fila que se ve clickeable y te deja en
                         otro lado es peor que una fila que no promete nada. -->
                    <tr v-for="fila in por_cliente" :key="fila.client_id">
                      <td>
                        {{ fila.cliente || 'Cliente #' + fila.client_id }}
                        <span v-if="!fila.cliente" class="tokens-tabla__nota d-block">
                          ya no existe en el admin
                        </span>
                      </td>
                      <td class="text-end">{{ numero(fila.llamadas) }}</td>
                      <td class="text-end">{{ numero(fila.tokens) }}</td>
                      <td class="text-end">{{ costo_visible(fila.costo_usd) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Desglose por acción, sumado entre todos los clientes. -->
        <div class="col-12 col-lg-5">
          <div class="card border-0 tokens-panel h-100">
            <div class="card-body">
              <p class="tokens-panel__titulo mb-3">Por acción</p>

              <p v-if="por_proceso.length === 0" class="text-muted small fst-italic mb-0">
                Sin datos.
              </p>

              <div v-else class="table-responsive">
                <table class="table table-sm align-middle mb-0 tokens-tabla">
                  <thead>
                    <tr>
                      <th>Acción</th>
                      <th class="text-end">Tokens</th>
                      <th class="text-end">Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="fila in por_proceso" :key="fila.proceso">
                      <td>{{ fila.proceso || '(sin acción)' }}</td>
                      <td class="text-end">{{ numero(fila.tokens) }}</td>
                      <td class="text-end">{{ costo_visible(fila.costo_usd) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Los dos paneles de proveedores-ia-deepseek (22/9/2026): en   -->
      <!-- qué modelo se va la plata de toda la plataforma, y cuántos   -->
      <!-- clientes eligieron cada inteligencia. Con un admin-api       -->
      <!-- anterior las dos claves no vienen y los paneles quedan en    -->
      <!-- "sin datos", sin romper nada.                                -->
      <!-- ============================================================ -->
      <div class="row g-3">
        <div class="col-12 col-lg-7">
          <div class="card border-0 tokens-panel h-100">
            <div class="card-body">
              <p class="tokens-panel__titulo mb-3">Por modelo</p>

              <p v-if="por_modelo.length === 0" class="text-muted small fst-italic mb-0">
                Sin datos.
              </p>

              <div v-else class="table-responsive">
                <table class="table table-sm align-middle mb-0 tokens-tabla">
                  <thead>
                    <tr>
                      <th>Modelo</th>
                      <th class="text-end">Llamadas</th>
                      <th class="text-end">Tokens</th>
                      <th class="text-end">Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="fila in por_modelo" :key="fila.modelo + '|' + fila.proveedor">
                      <td>
                        <!-- Proveedor y modelo en dos renglones: a 360px un id como
                             `deepseek-v4-pro` al lado del nombre del proveedor no entra. -->
                        <span class="tokens-tabla__nota d-block">{{ nombre_proveedor(fila.proveedor) }}</span>
                        <code class="tokens-tabla__modelo">{{ fila.modelo || '(sin modelo)' }}</code>
                      </td>
                      <td class="text-end">{{ numero(fila.llamadas) }}</td>
                      <td class="text-end">{{ numero(fila.tokens) }}</td>
                      <td class="text-end">
                        <span v-if="fila.tiene_precio">{{ costo_visible(fila.costo_usd) }}</span>
                        <span v-else class="tokens-tabla__nota">sin precio cargado</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Cuántos clientes ACTIVOS eligieron cada proveedor, según lo que informó cada uno
             en su última recolección. "Sin informar" son los que todavía corren una versión
             que no manda la configuración: NO es "eligieron Claude". -->
        <div class="col-12 col-lg-5">
          <div class="card border-0 tokens-panel h-100">
            <div class="card-body">
              <p class="tokens-panel__titulo mb-3">Clientes por proveedor</p>

              <div class="row g-2">
                <div class="col-4">
                  <p class="tokens-cifra__rotulo mb-1">Claude</p>
                  <p class="tokens-proveedor__valor mb-0">{{ numero(clientes_claude) }}</p>
                </div>
                <div class="col-4">
                  <p class="tokens-cifra__rotulo mb-1">DeepSeek</p>
                  <p class="tokens-proveedor__valor mb-0">{{ numero(clientes_deepseek) }}</p>
                </div>
                <div class="col-4">
                  <p class="tokens-cifra__rotulo mb-1">Sin informar</p>
                  <p class="tokens-proveedor__valor mb-0">{{ numero(clientes_sin_informar) }}</p>
                </div>
              </div>

              <p v-if="clientes_otros.length > 0" class="tokens-tabla__nota mb-0 mt-2">
                Además: {{ clientes_otros_texto }}.
              </p>

              <p class="tokens-tabla__nota mb-0 mt-3">
                Solo clientes activos. "Sin informar" es el que todavía corre una versión que no
                manda qué modelo usa; no es que eligió Claude.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import { nombre_proveedor } from '@/utils/ia'

/**
 * Pantalla "Tokens": el consumo de IA de TODOS los clientes juntos.
 *
 * Es la otra mitad de lo que pidió Lucas: la pestaña de la ficha contesta "cuánto gastó este
 * cliente" y esto contesta "cuánto estamos gastando, y quién se lo lleva". Desde la misión
 * proveedores-ia-deepseek (22/9/2026) también contesta "en qué modelo se va" y "cuántos clientes
 * eligieron cada proveedor".
 *
 * Lee de `GET admin/tokens/resumen`, que sale del espejo local del admin: no le pega a ninguna
 * instancia de cliente, así que abrir esta pantalla no depende de que los cuarenta y cinco
 * sistemas estén arriba.
 *
 * ⚠️ Las filas del ranking NO son clickeables, y es a propósito. La ficha de un cliente es un
 * modal del `ResourceView` genérico y hoy no se puede abrir por URL; darle esa capacidad es tocar
 * un componente compartido por todos los módulos del admin y no entra en esta misión. Antes que
 * una fila con cursor de mano que te deja en el listado —prometiendo algo que no hace—, el nombre
 * del cliente se lee y se lo busca en Clientes.
 */
export default {
  name: 'ViewTokens',
  data() {
    return {
      // true mientras se consulta el resumen.
      loading: false,
      // true una vez que se cargó al menos una vez (para no tapar la pantalla en cada recarga).
      cargado_alguna_vez: false,
      // Mensaje de error de la carga (null = sin error).
      load_error: null,
      // Extremos del rango, en AAAA-MM-DD.
      desde: '',
      hasta: '',
      // Atajo activo, o null cuando las fechas se tocaron a mano.
      dias_elegidos: 30,
      // Totales del período.
      totales: {
        llamadas: 0,
        tokens: 0,
        costo_usd: 0,
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        modelos_sin_precio: [],
      },
      // Serie por día de toda la plataforma.
      por_dia: [],
      // Ranking de clientes, ya ordenado por costo desde el backend.
      por_cliente: [],
      // Desglose por acción, ya ordenado por costo desde el backend.
      por_proceso: [],
      // Desglose por modelo de toda la plataforma, con `tiene_precio` resuelto por el backend.
      por_modelo: [],
      /*
       * Cuántos clientes activos eligieron cada proveedor: [{ proveedor, clientes }], con
       * `proveedor: null` para los que todavía no informan (versión anterior del sistema).
       */
      clientes_por_proveedor: [],
      atajos: [
        { dias: 7, label: '7 días' },
        { dias: 30, label: '30 días' },
        { dias: 90, label: '90 días' },
      ],
    }
  },
  computed: {
    /**
     * Días del rango completo, con los que no tuvieron consumo rellenados en cero.
     * @returns {Array<Object>}
     */
    dias_del_rango() {
      if (!this.desde || !this.hasta) {
        return []
      }
      const por_fecha = {}
      this.por_dia.forEach(function (fila) {
        por_fecha[String(fila.fecha || '').slice(0, 10)] = fila
      })

      const dias = []
      const cursor = new Date(this.desde + 'T00:00:00')
      const fin = new Date(this.hasta + 'T00:00:00')
      /* Red de seguridad, no un recorte real: el backend rechaza con 422 cualquier rango de más
         de 366 días, así que este bucle nunca llega a 400 vueltas con una respuesta legítima. Está
         para que un `desde`/`hasta` corrupto en el estado local no cuelgue el navegador. Si algún
         día sube el techo del backend, este número tiene que subir con él o la tarjeta de "N días"
         empieza a mentir. */
      let vueltas = 0
      while (cursor <= fin && vueltas < 400) {
        const clave =
          cursor.getFullYear() +
          '-' +
          String(cursor.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(cursor.getDate()).padStart(2, '0')
        dias.push(por_fecha[clave] || { fecha: clave, llamadas: 0, tokens: 0, costo_usd: 0 })
        cursor.setDate(cursor.getDate() + 1)
        vueltas++
      }
      return dias
    },
    /**
     * El día más alto de la serie, que define el 100% de las barras.
     * @returns {number}
     */
    pico_de_la_serie() {
      let pico = 0
      this.dias_del_rango.forEach(function (dia) {
        if (Number(dia.tokens || 0) > pico) {
          pico = Number(dia.tokens || 0)
        }
      })
      return pico
    },
    /**
     * true si hubo algún consumo en el período.
     * @returns {boolean}
     */
    hay_consumo() {
      return this.pico_de_la_serie > 0
    },
    /**
     * true si el total dejó afuera algún modelo por no tener precio cargado.
     * @returns {boolean}
     */
    hay_sin_precio() {
      return Array.isArray(this.totales.modelos_sin_precio) && this.totales.modelos_sin_precio.length > 0
    },
    /**
     * Los modelos sin precio, listos para meter en una frase.
     *
     * Una fila con el `modelo` vacío es un caso real —el cliente no informó con qué modelo gastó—
     * y llega como cadena vacía. Sin esto, la frase queda "No incluye : sin precio cargado.", que
     * se lee como un error de la pantalla en vez de como el dato que es.
     * @returns {string}
     */
    modelos_sin_precio_texto() {
      const lista = Array.isArray(this.totales.modelos_sin_precio)
        ? this.totales.modelos_sin_precio
        : []
      return lista
        .map(function (modelo) {
          return String(modelo || '').trim() === '' ? '(sin modelo)' : String(modelo)
        })
        .join(', ')
    },
    /**
     * Clientes que eligieron Claude (proveedor `anthropic`).
     * @returns {number}
     */
    clientes_claude() {
      return this.clientes_de('anthropic')
    },
    /**
     * Clientes que eligieron DeepSeek.
     * @returns {number}
     */
    clientes_deepseek() {
      return this.clientes_de('deepseek')
    },
    /**
     * Clientes que todavía no informan qué modelo usan (proveedor null).
     * @returns {number}
     */
    clientes_sin_informar() {
      return this.clientes_de(null)
    },
    /**
     * Proveedores que no son ninguno de los tres esperados, si el backend informara alguno. No
     * debería pasar, pero si pasa se muestra en vez de perderse: un total que no cierra sin
     * explicación es peor que un renglón de más.
     * @returns {Array<Object>}
     */
    clientes_otros() {
      return this.clientes_por_proveedor.filter(function (fila) {
        return fila.proveedor !== null && fila.proveedor !== 'anthropic' && fila.proveedor !== 'deepseek'
      })
    },
    /**
     * Los proveedores inesperados, listos para meter en una frase.
     * @returns {string}
     */
    clientes_otros_texto() {
      const self = this
      return this.clientes_otros
        .map(function (fila) {
          return self.numero(fila.clientes) + ' con ' + self.nombre_proveedor(fila.proveedor)
        })
        .join(', ')
    },
  },
  mounted() {
    this.elegir_atajo(30)
  },
  methods: {
    /**
     * Fija el rango a los últimos N días y recarga.
     * @param {number} dias
     * @returns {void}
     */
    elegir_atajo(dias) {
      this.dias_elegidos = dias
      const hoy = new Date()
      const inicio = new Date()
      inicio.setDate(inicio.getDate() - (dias - 1))
      this.hasta = this.a_iso(hoy)
      this.desde = this.a_iso(inicio)
      this.cargar()
    },
    /**
     * Marca que las fechas se tocaron a mano (apaga el resaltado del atajo).
     * @returns {void}
     */
    fechas_a_mano() {
      this.dias_elegidos = null
    },
    /**
     * Fecha de un objeto Date en AAAA-MM-DD, en hora local (no UTC: `toISOString()` corre el día
     * para cualquiera que esté al oeste de Greenwich, que es todo el país).
     * @param {Date} fecha
     * @returns {string}
     */
    a_iso(fecha) {
      return (
        fecha.getFullYear() +
        '-' +
        String(fecha.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(fecha.getDate()).padStart(2, '0')
      )
    },
    /**
     * Trae el resumen global del período (GET admin/tokens/resumen).
     * @returns {void}
     */
    cargar() {
      const self = this
      self.loading = true
      self.load_error = null
      api
        .get('/tokens/resumen', {
          params: { desde: this.desde, hasta: this.hasta },
          silent_error: true,
        })
        .then(function (res) {
          const cuerpo = res.data || {}
          if (cuerpo.desde) {
            self.desde = String(cuerpo.desde)
          }
          if (cuerpo.hasta) {
            self.hasta = String(cuerpo.hasta)
          }
          if (cuerpo.totales) {
            self.totales = cuerpo.totales
          }
          self.por_dia = Array.isArray(cuerpo.por_dia) ? cuerpo.por_dia : []
          self.por_cliente = Array.isArray(cuerpo.por_cliente) ? cuerpo.por_cliente : []
          self.por_proceso = Array.isArray(cuerpo.por_proceso) ? cuerpo.por_proceso : []
          /* Las dos claves de proveedores-ia-deepseek. Un admin-api anterior no las manda: los
             paneles quedan en "sin datos" y en cero, sin romper nada. */
          self.por_modelo = Array.isArray(cuerpo.por_modelo) ? cuerpo.por_modelo : []
          self.clientes_por_proveedor = Array.isArray(cuerpo.clientes_por_proveedor)
            ? cuerpo.clientes_por_proveedor
            : []
          self.loading = false
          self.cargado_alguna_vez = true
        })
        .catch(function (error) {
          self.load_error = resolve_error_message(error)
          self.loading = false
        })
    },
    /**
     * Cuántos clientes informaron un proveedor dado (null = los que no informan). Suma por si el
     * backend mandara la misma clave dos veces, que no debería, pero sumar es más honesto que
     * quedarse con la primera.
     * @param {string|null} proveedor
     * @returns {number}
     */
    clientes_de(proveedor) {
      let total = 0
      this.clientes_por_proveedor.forEach(function (fila) {
        if (fila.proveedor === proveedor) {
          total += Number(fila.clientes || 0)
        }
      })
      return total
    },
    /**
     * Nombre humano de un proveedor: el mapa compartido de `@/utils/ia`, expuesto como método
     * para que el template lo pueda llamar. Es el mismo que usa la solapa de la ficha.
     * @param {string} proveedor
     * @returns {string}
     */
    nombre_proveedor(proveedor) {
      return nombre_proveedor(proveedor)
    },
    /**
     * Alto de la barra de un día, como porcentaje del día más alto de la serie.
     * @param {Object} dia
     * @returns {string}
     */
    alto_de(dia) {
      if (this.pico_de_la_serie <= 0) {
        return '0%'
      }
      const proporcion = Number(dia.tokens || 0) / this.pico_de_la_serie
      /* Un día con consumo pero chiquito tiene que verse: por debajo del 2% la barra desaparece y
       * se lee como "ese día no gastó nada", que es otra cosa. */
      if (proporcion > 0 && proporcion < 0.02) {
        return '2%'
      }
      return Math.round(proporcion * 100) + '%'
    },
    /**
     * Texto del tooltip de un día de la serie.
     * @param {Object} dia
     * @returns {string}
     */
    titulo_del_dia(dia) {
      return (
        this.fecha_larga(dia.fecha) +
        ': ' +
        this.numero(dia.tokens) +
        ' tokens · ' +
        this.costo_visible(dia.costo_usd)
      )
    },
    /**
     * Día y mes de una fecha ISO, para el pie de la barra.
     * @param {string} fecha
     * @returns {string}
     */
    dia_corto(fecha) {
      const partes = String(fecha || '').slice(0, 10).split('-')
      if (partes.length !== 3) {
        return ''
      }
      return partes[2] + '/' + partes[1]
    },
    /**
     * Fecha ISO en formato largo local.
     * @param {string} fecha
     * @returns {string}
     */
    fecha_larga(fecha) {
      const partes = String(fecha || '').slice(0, 10).split('-')
      if (partes.length !== 3) {
        return String(fecha || '')
      }
      return partes[2] + '/' + partes[1] + '/' + partes[0]
    },
    /**
     * Número entero con separadores de miles.
     * @param {number} valor
     * @returns {string}
     */
    numero(valor) {
      return Number(valor || 0).toLocaleString('es-AR')
    },
    /**
     * Costo en dólares, listo para mostrar.
     *
     * 🔴 `null` NO se muestra como cero: se muestra como un guion. Cero significa "no costó nada" y
     * null significa "no sé cuánto costó".
     * @param {number|null} valor
     * @returns {string}
     */
    costo_visible(valor) {
      if (valor === null || valor === undefined) {
        return '—'
      }
      const numero = Number(valor)
      if (numero > 0 && numero < 0.01) {
        return (
          'US$ ' + numero.toLocaleString('es-AR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
        )
      }
      return (
        'US$ ' + numero.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      )
    },
  },
}
</script>

<style scoped>

/* 🔴 Los `.row` de Bootstrap traen margen horizontal NEGATIVO (-.5rem por lado con `g-3`) para
   compensar el padding que sus columnas ponen por dentro. Adentro de un contenedor sin padding
   horizontal ese margen no lo compensa nadie y la fila se sale 8px por la derecha: medido, 1360
   contra 1352. No tapa nada ni genera scroll de página, pero es ancho fantasma y se ve.

   Se le devuelve al contenedor el padding que el gutter espera —la mitad de `--bs-gutter-x` de
   `g-3`, o sea 8px—, que además es lo que deja el contenido de las columnas alineado con el de
   los paneles que NO están en una fila. */
.tokens-cuerpo {
  padding-left: 0.5rem;
  padding-right: 0.5rem;
}
.tokens-cifra {
  background: #f7f7f8;
  border-radius: 0.75rem;
}

.tokens-cifra__rotulo {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #6c757d;
}

.tokens-cifra__valor {
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.tokens-cifra__pie {
  font-size: 0.75rem;
  color: #6c757d;
  margin-top: 0.25rem;
}

.tokens-panel {
  background: #ffffff;
  border: 1px solid #ededf0;
  border-radius: 0.75rem;
}

.tokens-panel__titulo {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #6c757d;
  font-weight: 600;
}

/* Serie por día: una columna por día, con scroll horizontal cuando no entran. Nunca se achica la
   tipografía para que entre: se desplaza. */
.tokens-serie {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.tokens-serie__col {
  /* 🔴 28px y no 14px: "19/08" necesita 25px a 0.625rem (medido), y con la columna más angosta la
     etiqueta se sale de su caja y se pisa con la de al lado — a 820px la columna daba 21px y a
     360px, 14px. Una fecha cortada a la mitad es lo peor de los dos mundos: ni se lee ni se sabe
     que falta. Si con eso no entran todos los días, la serie scrollea, que es el patrón que ya
     usa el resto de la pantalla para lo ancho.
     El techo es para el otro extremo: con 7 días y `flex-grow`, las barras se volvían losas. */
  flex: 1 0 28px;
  min-width: 28px;
  max-width: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tokens-serie__pista {
  width: 100%;
  height: 140px;
  display: flex;
  align-items: flex-end;
  background: #f2f2f4;
  border-radius: 3px;
}

.tokens-serie__barra {
  width: 100%;
  background: #1f1f24;
  border-radius: 3px;
  transition: height 0.15s ease-out;
}

.tokens-serie__dia {
  font-size: 0.625rem;
  color: #8a8a8f;
  margin-top: 0.25rem;
  white-space: nowrap;
}

.tokens-tabla th {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #8a8a8f;
  font-weight: 600;
  border-bottom-width: 1px;
}

.tokens-tabla td {
  font-size: 0.875rem;
}

.tokens-tabla__nota {
  font-size: 0.7rem;
  color: #8a8a8f;
}

/* El id del modelo en `code`: es un identificador, no una palabra, y así se distingue del nombre
   humano del proveedor que va arriba. Mismo tono que en la pestaña del cliente. */
.tokens-tabla__modelo {
  font-size: 0.8em;
  color: #1f1f24;
  background: #f2f2f4;
  border-radius: 3px;
  padding: 0.05rem 0.3rem;
}

/* Las tres cifras de "Clientes por proveedor": más chicas que las tarjetas del total (son un
   conteo, no la plata) pero con el mismo peso, para que se lean de un vistazo. */
.tokens-proveedor__valor {
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

@media (max-width: 575.98px) {
  .tokens-cifra__valor {
    font-size: 1.4rem;
  }

  .tokens-proveedor__valor {
    font-size: 1.25rem;
  }

  .tokens-serie__pista {
    height: 100px;
  }
}
</style>
