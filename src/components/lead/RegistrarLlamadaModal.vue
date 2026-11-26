<template>
  <!--
    Registrar llamada (misión embudo-juan-pipeline, E1).

    Es lo que Juan completa apenas corta con un lead: si atendió, cómo terminó, lo que se cotizó y
    qué se habló. Un solo pedido (POST lead/{id}/llamadas) deja la llamada asentada, mueve la tarjeta
    del tablero a la columna que corresponde y cierra las tareas del embudo de ese lead. Esas
    consecuencias las decide la API: acá sólo se arma el formulario y se avisa de lo que falta antes
    de mandar (reglas en `utils/registrar_llamada.js`).

    Se abre desde la tarjeta del tablero, la ficha de la oportunidad y el encabezado de la conversación
    del lead (también con el perfil «Sólo Leads», que ve esa conversación en sólo lectura). Cada
    apertura se monta con una `key` nueva, así que no arrastra nada de la anterior.

    Grabación de la llamada (misión leads-referidos-compromisos, E3): Juan puede adjuntar el audio que grabó con el
    celular. PRIMERO se registra la llamada como siempre y, con el id que devuelve la API, se sube el archivo por partes de
    4 MB (`/grabacion`, `/grabacion/partes`, `/grabacion/completar`; reglas en `utils/grabacion_de_llamada.js`) con una barra de
    progreso y tres intentos por parte. El modal no se cierra hasta que termina la subida: si falla, la llamada YA está
    registrada (no se vuelve a mandar el formulario, se vuelve a intentar sólo la subida) y se puede cerrar igual. La
    transcripción la hace el servidor después y tarda unos minutos.
  -->
  <base-modal :show="show" title="Registrar llamada" size="lg" :stack_level="stack_level" @close="on_cancel">
    <form class="rl-form" novalidate @submit.prevent="on_submit">
      <p v-if="lead_name" class="rl-form__lead">{{ lead_name }}</p>

      <!-- ¿Atendió? -->
      <fieldset class="rl-form__group">
        <legend class="form-label mb-2">¿Atendió?<span class="rl-form__required" title="Obligatorio"> *</span></legend>
        <div class="rl-form__choices" role="radiogroup" aria-label="¿Atendió?">
          <button
            type="button"
            role="radio"
            class="rl-form__choice"
            :class="{ 'rl-form__choice--selected': form.atendio === true }"
            :aria-checked="form.atendio === true ? 'true' : 'false'"
            :disabled="saving"
            @click="elegir_atendio(true)"
          >
            <i class="bi bi-telephone-inbound" aria-hidden="true" />Sí, atendió
          </button>
          <button
            type="button"
            role="radio"
            class="rl-form__choice"
            :class="{ 'rl-form__choice--selected': form.atendio === false }"
            :aria-checked="form.atendio === false ? 'true' : 'false'"
            :disabled="saving"
            @click="elegir_atendio(false)"
          >
            <i class="bi bi-telephone-x" aria-hidden="true" />No atendió
          </button>
        </div>
        <div v-if="error_de('atendio')" class="invalid-feedback d-block">{{ error_de('atendio') }}</div>
      </fieldset>

      <!-- Cómo terminó (sólo si atendió) -->
      <fieldset v-if="form.atendio === true" class="rl-form__group">
        <legend class="form-label mb-2">¿Cómo terminó?<span class="rl-form__required" title="Obligatorio"> *</span></legend>
        <div class="rl-form__results" role="radiogroup" aria-label="Cómo terminó la llamada">
          <label
            v-for="resultado in resultados"
            :key="resultado.value"
            class="rl-form__result"
            :class="{ 'rl-form__result--selected': form.resultado === resultado.value }"
          >
            <input
              v-model="form.resultado"
              type="radio"
              name="rl-resultado"
              class="form-check-input"
              :value="resultado.value"
              :disabled="saving"
            />
            <span>{{ resultado.label }}</span>
          </label>
        </div>
        <div v-if="error_de('resultado')" class="invalid-feedback d-block">{{ error_de('resultado') }}</div>
      </fieldset>

      <!-- Motivo: sólo con «No le interesa»; sale de la lista de motivos de pérdida del pipeline -->
      <div v-if="pide_motivo" class="rl-form__group">
        <label class="form-label mb-1" for="rl-motivo">Motivo<span class="rl-form__required" title="Obligatorio"> *</span></label>
        <select
          id="rl-motivo"
          v-model="form.motivo"
          class="form-select"
          :class="{ 'is-invalid': !!error_de('motivo') }"
          :disabled="saving"
        >
          <option value="">Elegí un motivo</option>
          <option v-for="motivo in motivos" :key="motivo" :value="motivo">{{ motivo }}</option>
        </select>
        <div v-if="error_de('motivo')" class="invalid-feedback d-block">{{ error_de('motivo') }}</div>
      </div>

      <!--
        Paquetes (E2): con «Pagó la mitad» hay que decir qué implementación pagó. La API pausa la prueba del
        cliente (si ya tiene) y arranca la implementación de esos paquetes.
      -->
      <fieldset v-if="pide_paquetes" class="rl-form__group">
        <legend class="form-label mb-2">Qué pagó<span class="rl-form__required" title="Obligatorio"> *</span></legend>
        <div class="rl-form__results">
          <label
            v-for="paquete in paquetes_disponibles"
            :key="paquete.value"
            class="rl-form__result"
            :class="{ 'rl-form__result--selected': form.paquetes.indexOf(paquete.value) !== -1 }"
          >
            <input
              v-model="form.paquetes"
              type="checkbox"
              class="form-check-input"
              :value="paquete.value"
              :disabled="saving"
            />
            <span>{{ paquete.label }}</span>
          </label>
        </div>
        <div v-if="error_de('paquetes')" class="invalid-feedback d-block">{{ error_de('paquetes') }}</div>
      </fieldset>

      <!-- Fecha: obligatoria si no atendió o hay que volver a llamar; opcional con «Implementación acordada» -->
      <div v-if="pide_fecha" class="rl-form__group">
        <label class="form-label mb-1" for="rl-fecha">
          {{ fecha_obligatoria ? 'Volver a llamar el' : 'Retomar el (si no la ponés, en dos días)' }}
          <span v-if="fecha_obligatoria" class="rl-form__required" title="Obligatorio"> *</span>
        </label>
        <input
          id="rl-fecha"
          v-model="form.proxima_llamada_at"
          type="datetime-local"
          class="form-control"
          :class="{ 'is-invalid': !!error_de('proxima_llamada_at') }"
          :disabled="saving"
        />
        <div v-if="error_de('proxima_llamada_at')" class="invalid-feedback d-block">{{ error_de('proxima_llamada_at') }}</div>
      </div>

      <!-- Cotizado: queda en la tarjeta del tablero para ver de un vistazo qué precio se le pasó -->
      <div class="rl-form__group">
        <label class="form-label mb-1" for="rl-cotizado">Cotizado</label>
        <input
          id="rl-cotizado"
          v-model="form.cotizado"
          type="text"
          maxlength="255"
          class="form-control"
          :class="{ 'is-invalid': !!error_de('cotizado') }"
          placeholder="Ej.: Gestión $628.400, mitad $314.200"
          :disabled="saving"
        />
        <div v-if="error_de('cotizado')" class="invalid-feedback d-block">{{ error_de('cotizado') }}</div>
      </div>

      <!-- Notas: es lo que después leen Martín y Soporte para no volver a preguntarle lo mismo -->
      <div class="rl-form__group">
        <label class="form-label mb-1" for="rl-notas">Qué se habló</label>
        <textarea
          id="rl-notas"
          v-model="form.notas"
          rows="4"
          maxlength="5000"
          class="form-control"
          :class="{ 'is-invalid': !!error_de('notas') }"
          placeholder="Lo que contó del negocio, qué le interesó, qué quedó pendiente…"
          :disabled="saving"
        />
        <div v-if="error_de('notas')" class="invalid-feedback d-block">{{ error_de('notas') }}</div>
        <p class="rl-form__hint">Martín y Soporte leen estas notas para no volver a preguntarle lo que ya contó.</p>
      </div>

      <!-- Grabación de la llamada (E3): opcional; se sube DESPUÉS de registrar la llamada. -->
      <div class="rl-form__group">
        <label class="form-label mb-1" for="rl-grabacion">Grabación de la llamada (opcional)</label>
        <input
          id="rl-grabacion"
          ref="archivo_input"
          type="file"
          accept="audio/*,.m4a,.amr,.3gp"
          class="form-control"
          :class="{ 'is-invalid': !!archivo_error }"
          :disabled="saving || !!registro"
          @change="on_elegir_archivo"
        />
        <div v-if="archivo_error" class="invalid-feedback d-block">{{ archivo_error }}</div>
        <p v-else-if="archivo" class="rl-form__hint">{{ archivo.name }} · {{ tamano_del_archivo }}</p>
        <p v-else class="rl-form__hint">Si grabaste la llamada con el celular, subila acá: se transcribe y queda asentado lo que se habló.</p>

        <!-- Progreso de la subida -->
        <div v-if="subida.activa" class="rl-form__subida">
          <div class="progress" role="progressbar" aria-label="Subida de la grabación" :aria-valuenow="porcentaje_subido" aria-valuemin="0" aria-valuemax="100">
            <div class="progress-bar" :style="{ width: porcentaje_subido + '%' }" />
          </div>
          <p class="rl-form__hint">Subiendo la grabación: {{ subida.hechas }} de {{ subida.total }} partes. No cierres esta ventana.</p>
        </div>
      </div>

      <div v-if="server_message" class="alert alert-danger py-2 mb-0" role="alert">{{ server_message }}</div>
    </form>

    <template #footer>
      <button v-if="registro && !saving" type="button" class="btn btn-secondary" @click="cerrar_sin_la_grabacion">Cerrar sin la grabación</button>
      <button v-else type="button" class="btn btn-secondary" :disabled="saving" @click="on_cancel">Cancelar</button>
      <button type="button" class="btn btn-primary" :disabled="saving" @click="on_submit">
        {{ texto_del_boton }}
      </button>
    </template>
  </base-modal>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'
import BaseModal from '@/components/ui/BaseModal.vue'
import { first_error, show_toast, validation_errors } from '@/components/pipeline/pipeline_helpers'
import {
  PAQUETES,
  RESULTADOS,
  admite_fecha,
  payload,
  requiere_fecha,
  requiere_motivo,
  requiere_paquetes,
  validar,
  validar_paquetes,
} from '@/utils/registrar_llamada'
import {
  INTENTOS_POR_PARTE,
  partir_en_partes,
  tamano_en_palabras,
  validar_archivo,
} from '@/utils/grabacion_de_llamada'

/** Slug del pipeline de leads, del que salen los motivos de pérdida. */
const SLUG_DEL_PIPELINE_DE_LEADS = 'lead'

/**
 * Modal «Registrar llamada».
 */
export default {
  name: 'RegistrarLlamadaModal',
  components: { BaseModal },
  props: {
    /** Visibilidad del modal. */
    show: { type: Boolean, default: true },
    /** Lead al que se le registra la llamada. */
    lead_id: { type: [Number, String], required: true },
    /** Nombre del lead (contacto y empresa), sólo para que se vea a quién se llamó. */
    lead_name: { type: String, default: '' },
    /** Nivel de apilamiento (1 cuando se abre encima de la ficha de la oportunidad). */
    stack_level: { type: Number, default: 0 },
  },
  emits: ['close', 'registrada'],
  data() {
    return {
      /** Valores del formulario (ver `utils/registrar_llamada.js`). */
      form: {
        atendio: null,
        resultado: '',
        motivo: '',
        proxima_llamada_at: '',
        cotizado: '',
        notas: '',
        paquetes: [],
      },
      /** Errores por campo: los de la validación local y, después de mandar, los del 422 de la API. */
      errores: {},
      /** Mensaje general cuando la API rechaza por una regla que no es de un campo. */
      server_message: '',
      /** true mientras viaja el pedido: bloquea el doble clic. */
      saving: false,
      /** Resultados para los radios. */
      resultados: RESULTADOS,
      /** Paquetes de implementación para las casillas. */
      paquetes_disponibles: PAQUETES,
      /** Grabación elegida (File) o null; sólo si pasó `validar_archivo`. */
      archivo: null,
      /** Por qué se rechazó el archivo elegido ('' si está bien o no se eligió). */
      archivo_error: '',
      /**
       * Lo que devolvió la API al registrar la llamada (`{ llamada, oportunidad, duplicada }`). Mientras es null la llamada no está
       * registrada; cuando existe, el formulario ya no se vuelve a mandar (duplicaría la llamada): sólo se reintenta la subida.
       */
      registro: null,
      /** Estado de la subida por partes. */
      subida: { activa: false, hechas: 0, total: 0 },
    }
  },
  computed: {
    /**
     * Motivos de pérdida del pipeline de leads (los mismos que acepta la API en «No le interesa»).
     * @returns {Array<string>}
     */
    motivos() {
      const pipeline = this.$store.getters['pipeline/pipeline_by_id_or_slug'](SLUG_DEL_PIPELINE_DE_LEADS)
      const lista = pipeline && pipeline.lost_reasons
      return Array.isArray(lista) ? lista : []
    },
    /** @returns {boolean} true si hay que elegir el motivo. */
    pide_motivo() {
      return requiere_motivo(this.form)
    },
    /** @returns {boolean} true si hay que elegir los paquetes («Pagó la mitad»). */
    pide_paquetes() {
      return requiere_paquetes(this.form)
    },
    /** @returns {boolean} true si se muestra la fecha. */
    pide_fecha() {
      return admite_fecha(this.form)
    },
    /** @returns {boolean} true si la fecha es obligatoria. */
    fecha_obligatoria() {
      return requiere_fecha(this.form)
    },
    /** @returns {string} Tamaño del archivo elegido, para mostrar. */
    tamano_del_archivo() {
      return this.archivo ? tamano_en_palabras(this.archivo.size) : ''
    },
    /** @returns {number} Porcentaje de partes ya subidas (0 a 100). */
    porcentaje_subido() {
      return this.subida.total > 0 ? Math.round((this.subida.hechas / this.subida.total) * 100) : 0
    },
    /** @returns {string} Texto del botón principal según en qué paso está. */
    texto_del_boton() {
      if (this.saving) {
        return this.subida.activa ? 'Subiendo la grabación…' : 'Registrando…'
      }
      return this.registro ? 'Reintentar la subida' : 'Registrar llamada'
    },
  },
  created() {
    // Si el modal se abre desde la conversación del lead, la lista de pipelines puede no estar
    // cargada todavía: sin ella no hay motivos para «No le interesa».
    if (!this.$store.state.pipeline.pipelines_loaded) {
      this.$store.dispatch('pipeline/fetch_pipelines').catch(function () {
        return null
      })
    }
  },
  methods: {
    /**
     * Mensaje de error de un campo (el local o, si no hay, el que devolvió la API).
     *
     * @param {string} campo
     * @returns {string}
     */
    error_de(campo) {
      return first_error(this.errores, campo)
    },
    /**
     * Elige si atendió. Al cambiar de respuesta se limpia lo que dependía de la anterior (el resultado
     * y el motivo sólo existen si atendió; la fecha cambia de significado).
     *
     * @param {boolean} atendio
     */
    elegir_atendio(atendio) {
      if (this.form.atendio === atendio) {
        return
      }
      this.form.atendio = atendio
      this.form.resultado = ''
      this.form.motivo = ''
      this.form.paquetes = []
      this.form.proxima_llamada_at = ''
      this.errores = {}
    },
    /**
     * Valida y manda el pedido. Si la API confirma, avisa al padre con la llamada y la tarjeta ya
     * movida (la forma del tablero) para que la cambie de columna sin esperar la recarga.
     */
    on_submit() {
      const self = this
      if (this.saving) {
        return
      }
      this.server_message = ''
      // La llamada ya quedó registrada y lo que falló fue la subida del audio: se reintenta sólo eso.
      if (this.registro) {
        this.subir_la_grabacion(this.registro)
        return
      }
      this.errores = Object.assign(validar(this.form, { motivos: this.motivos }), validar_paquetes(this.form))
      if (Object.keys(this.errores).length > 0) {
        return
      }
      this.saving = true
      api
        .post('/lead/' + this.lead_id + '/llamadas', payload(this.form))
        .then(function (res) {
          const data = res.data || {}
          const columna = data.oportunidad && data.oportunidad.stage ? data.oportunidad.stage.name : ''
          show_toast(columna ? 'Llamada registrada. La tarjeta pasó a «' + columna + '».' : 'Llamada registrada.')
          self.registro = {
            llamada: data.llamada || null,
            oportunidad: data.oportunidad || null,
            duplicada: data.duplicada === true,
          }
          // Con una grabación elegida, el modal sigue abierto hasta que termine de subirla.
          if (self.archivo && self.registro.llamada && self.registro.llamada.id) {
            self.subir_la_grabacion(self.registro)
            return
          }
          self.saving = false
          self.$emit('registrada', self.registro)
        })
        .catch(function (error) {
          self.saving = false
          self.errores = validation_errors(error)
          // Un 422 sin `errors` (una regla de negocio) o cualquier otro error: se muestra el mensaje.
          if (Object.keys(self.errores).length === 0) {
            const respuesta = error && error.response && error.response.data
            self.server_message = respuesta && respuesta.message ? String(respuesta.message) : 'No se pudo registrar la llamada. Probá de nuevo.'
          }
        })
    },
    /**
     * Elige (o saca) la grabación. Se valida en el momento —extensión de audio, no vacío, hasta 200 MB— y un archivo que no sirve no se
     * guarda: el campo se vacía para que Juan elija otro.
     *
     * @param {Event} event Evento `change` del input de archivo.
     */
    on_elegir_archivo(event) {
      const elegido = event && event.target && event.target.files ? event.target.files[0] : null
      this.archivo = null
      this.archivo_error = ''
      if (!elegido) {
        return
      }
      const revision = validar_archivo(elegido.name, elegido.size)
      if (!revision.ok) {
        this.archivo_error = revision.mensaje
        event.target.value = ''
        return
      }
      this.archivo = elegido
    },
    /**
     * Sube la grabación de la llamada recién registrada: avisa qué archivo viene, manda las partes de 4 MB de a una (cada una con
     * hasta tres intentos) y completa para que el servidor la una y la transcriba. Cuando termina avisa al padre; si falla en
     * cualquier paso deja el motivo en pantalla y la llamada igual registrada.
     *
     * @param {{ llamada: Object, oportunidad: (Object|null), duplicada: boolean }} registro Lo que devolvió el POST de la llamada.
     */
    subir_la_grabacion(registro) {
      const self = this
      const archivo = this.archivo
      const partes = partir_en_partes(archivo.size)
      const base = '/lead/' + this.lead_id + '/llamadas/' + registro.llamada.id
      this.saving = true
      this.server_message = ''
      this.subida = { activa: true, hechas: 0, total: partes.length }
      api
        .post('/lead/' + this.lead_id + '/llamadas/' + registro.llamada.id + '/grabacion', {
          nombre: archivo.name,
          bytes: archivo.size,
          mime: archivo.type || '',
        }, { silent_error: true })
        .then(function () {
          return self.subir_las_partes(base + '/grabacion/partes', archivo, partes, 0)
        })
        .then(function () {
          return api.post('/lead/' + self.lead_id + '/llamadas/' + registro.llamada.id + '/grabacion/completar', {}, { silent_error: true })
        })
        .then(function () {
          self.saving = false
          self.subida.activa = false
          show_toast('Grabación subida. La transcripción tarda unos minutos.')
          self.$emit('registrada', registro)
        })
        .catch(function (error) {
          self.saving = false
          self.subida.activa = false
          const respuesta = error && error.response ? error.response.data : null
          // Un 409 con la grabación significa que ese audio ya estaba cargado: no es una falla, no hay nada más que subir.
          if (error && error.response && error.response.status === 409 && respuesta && respuesta.grabacion) {
            show_toast(respuesta.message || 'Esa grabación ya estaba cargada.')
            self.$emit('registrada', registro)
            return
          }
          self.server_message = 'La llamada quedó registrada, pero la grabación no se pudo subir: ' + resolve_error_message(error) + ' Tocá «Reintentar la subida» o cerrá y probá más tarde desde la ficha.'
        })
    },
    /**
     * Sube las partes en orden, de a una (así la barra avanza de verdad y el celular no manda cuatro pedidos de 4 MB juntos).
     *
     * @param {string} url Dirección de las partes.
     * @param {File} archivo Archivo elegido.
     * @param {Array<{ indice: number, desde: number, hasta: number, bytes: number }>} partes Salida de `partir_en_partes`.
     * @param {number} posicion Parte que toca subir.
     * @returns {Promise<void>}
     */
    subir_las_partes(url, archivo, partes, posicion) {
      const self = this
      if (posicion >= partes.length) {
        return Promise.resolve()
      }
      return this.mandar_la_parte(url, archivo, partes[posicion], 1).then(function () {
        self.subida.hechas = posicion + 1
        return self.subir_las_partes(url, archivo, partes, posicion + 1)
      })
    },
    /**
     * Manda UNA parte. Una mala señal del celular no tira la subida entera: se reintenta hasta `INTENTOS_POR_PARTE` veces, esperando un
     * poco más cada vez. Un error de validación (422) no se reintenta: repetirlo daría lo mismo.
     *
     * @param {string} url Dirección de las partes.
     * @param {File} archivo Archivo elegido.
     * @param {{ indice: number, desde: number, hasta: number }} parte La parte a mandar.
     * @param {number} intento Número de intento (desde 1).
     * @returns {Promise<void>}
     */
    mandar_la_parte(url, archivo, parte, intento) {
      const self = this
      const cuerpo = new FormData()
      cuerpo.append('indice', String(parte.indice))
      cuerpo.append('parte', archivo.slice(parte.desde, parte.hasta), 'parte.bin')
      return api
        .post(url, cuerpo, { headers: { 'Content-Type': 'multipart/form-data' }, silent_error: true })
        .then(function () {
          return null
        })
        .catch(function (error) {
          const status = error && error.response ? error.response.status : 0
          if (intento >= INTENTOS_POR_PARTE || status === 422) {
            throw error
          }
          return new Promise(function (resolve) {
            window.setTimeout(resolve, 1000 * intento)
          }).then(function () {
            return self.mandar_la_parte(url, archivo, parte, intento + 1)
          })
        })
    },
    /** Cierra el modal sin la grabación (la llamada ya estaba registrada): el padre se entera como si todo hubiera salido bien. */
    cerrar_sin_la_grabacion() {
      this.$emit('registrada', this.registro)
    },
    /** Cierra sin guardar (no mientras viaja el pedido). */
    on_cancel() {
      if (!this.saving) {
        this.$emit('close')
      }
    },
  },
}
</script>

<style scoped>
.rl-form {
  min-width: 0;
}

.rl-form__lead {
  margin: 0 0 1rem;
  font-weight: 600;
  word-break: break-word;
}

.rl-form__group {
  margin: 0 0 1rem;
  padding: 0;
  border: 0;
  min-width: 0;
}

.rl-form__group legend {
  float: none;
  width: auto;
  padding: 0;
  font-size: 1rem;
}

.rl-form__required {
  color: var(--bs-danger, #dc3545);
}

.rl-form__choices {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.rl-form__choice {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  flex: 1 1 10rem;
  justify-content: center;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--color-text-primary);
  font-size: 0.9rem;
}

.rl-form__choice:hover:not(:disabled) {
  background: var(--bg-hover);
}

.rl-form__choice--selected,
.rl-form__choice--selected:hover:not(:disabled) {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--form-focus-ring);
  font-weight: 600;
}

.rl-form__results {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 0.5rem;
}

.rl-form__result {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--color-border-secondary);
  border-radius: 10px;
  background: var(--bg-card);
  font-size: 0.9rem;
  cursor: pointer;
}

.rl-form__result--selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--form-focus-ring);
  font-weight: 600;
}

.rl-form__result .form-check-input {
  flex: 0 0 auto;
  margin: 0;
}

.rl-form__hint {
  margin: 0.35rem 0 0;
  font-size: 0.78rem;
  color: var(--color-text-secondary);
}

.rl-form__subida {
  margin-top: 0.6rem;
}

.rl-form__subida .progress {
  height: 0.5rem;
}
</style>
