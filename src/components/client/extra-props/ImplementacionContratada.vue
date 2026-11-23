<template>
  <!--
    Implementación contratada (misión embudo-juan-pipeline, E2): lo que el cliente contrató de implementación.
    De esto depende qué hace Soporte: con «Pagó la mitad» o «Pagó completa» importa desde Soporte (los
    artículos los carga Lucas) y la prueba queda pausada hasta la entrega; con «Sin implementación» Soporte no
    importa y le ofrece contratarla.

    Estados (`implementacion_contratada`):
      - no: sin implementación (lo que escribe toda prueba nueva);
      - mitad: pagó la mitad;
      - completa: pagó entera;
      - incluida: contrato anterior, mantiene «importación cuando lo necesite» (el default de los clientes que ya existían).

    Las reglas y los efectos (pausar la prueba, arrancar la implementación, tareas, lead y tarjeta) los decide la
    API: este bloque sólo guarda el estado y los paquetes y dispara las dos acciones manuales. Contra un admin-api que
    todavía no manda el campo `implementacion_contratada` el bloque no se muestra (el SPA y la API no llegan juntos).
  -->
  <div v-if="visible" class="ic-bloque">
    <small class="text-muted d-block mb-2">Implementación contratada</small>

    <div class="ic-bloque__fila">
      <div class="ic-bloque__campo">
        <label class="form-label mb-1" :for="'ic-estado-' + record.id">Estado</label>
        <select
          :id="'ic-estado-' + record.id"
          v-model="form.estado"
          class="form-select form-select-sm"
          :disabled="loading_action !== ''"
        >
          <option v-for="estado in estados" :key="estado.value" :value="estado.value">{{ estado.label }}</option>
        </select>
      </div>

      <fieldset v-if="pide_paquetes" class="ic-bloque__campo ic-bloque__paquetes">
        <legend class="form-label mb-1">Paquetes</legend>
        <label v-for="paquete in paquetes_disponibles" :key="paquete.value" class="ic-bloque__paquete">
          <input
            v-model="form.paquetes"
            type="checkbox"
            class="form-check-input"
            :value="paquete.value"
            :disabled="loading_action !== ''"
          />
          <span>{{ paquete.label }}</span>
        </label>
      </fieldset>
    </div>

    <p v-if="error_de_formulario" class="small text-danger mb-2">{{ error_de_formulario }}</p>

    <div class="d-flex flex-wrap gap-2 mb-3">
      <button
        type="button"
        class="btn btn-sm btn-primary"
        :disabled="loading_action !== '' || !hay_cambios"
        @click="guardar"
      >
        {{ loading_action === 'guardar' ? 'Guardando...' : 'Guardar' }}
      </button>
      <button
        v-if="importa_lucas"
        type="button"
        class="btn btn-sm btn-outline-success"
        :disabled="loading_action !== '' || !!record.implementacion_articulos_ok_at"
        :title="record.implementacion_articulos_ok_at ? 'Ya está marcado' : 'Avisa que los artículos ya están cargados'"
        @click="articulos_importados"
      >
        {{ loading_action === 'articulos' ? 'Marcando...' : 'Artículos importados OK' }}
      </button>
      <button
        v-if="esta_pausada"
        type="button"
        class="btn btn-sm btn-outline-warning"
        :disabled="loading_action !== ''"
        title="Corrige una pausa por error: la prueba vuelve a correr 7 días desde hoy"
        @click="reanudar"
      >
        {{ loading_action === 'reanudar' ? 'Reanudando...' : 'Reanudar prueba (7 días desde hoy)' }}
      </button>
    </div>

    <!-- Fechas: sólo lectura, las pone el sistema -->
    <dl class="ic-bloque__fechas">
      <div v-for="fecha in fechas" :key="fecha.clave" class="ic-bloque__fecha">
        <dt>{{ fecha.etiqueta }}</dt>
        <dd>{{ fecha.texto }}</dd>
      </div>
    </dl>
  </div>
</template>

<script>
import api from '@/utils/axios'
import { route_string } from '@/utils/route_string'
import { PAQUETES } from '@/utils/registrar_llamada'
import { show_toast } from '@/components/pipeline/pipeline_helpers'
import { format_datetime } from '@/utils/pipeline_dates'

/**
 * Estados de la implementación contratada, en el orden en que se muestran. La clave es la del contrato con la API.
 */
const ESTADOS = [
  { value: 'no', label: 'Sin implementación' },
  { value: 'mitad', label: 'Pagó la mitad' },
  { value: 'completa', label: 'Pagó completa' },
  { value: 'incluida', label: 'Incluida (contrato anterior)' },
]

/** Estados que llevan paquetes: los otros dos no tienen nada que implementar. */
const ESTADOS_CON_PAQUETES = ['mitad', 'completa']

/** Campos que devuelve la API y que se copian al cliente en edición después de cada acción. */
const CAMPOS_DEL_CLIENTE = [
  'implementacion_contratada',
  'implementacion_paquetes',
  'implementacion_mitad_pagada_at',
  'implementacion_articulos_recibidos_at',
  'implementacion_articulos_ok_at',
  'prueba_pausada_at',
  'prueba_reanudada_at',
]

/**
 * Bloque «Implementación contratada» de la ficha del cliente.
 */
export default {
  name: 'ClientImplementacionContratada',
  props: {
    /** Cliente en edición (en el modal CRUD es el borrador). */
    record: { type: Object, default: null },
  },
  emits: ['record-updated'],
  data() {
    return {
      /** Estado y paquetes elegidos, todavía sin guardar. */
      form: { estado: 'incluida', paquetes: [] },
      /** Acción en curso (`guardar`, `articulos` o `reanudar`): bloquea los botones. */
      loading_action: '',
      /** Mensaje cuando falta algo antes de guardar. */
      error_de_formulario: '',
      estados: ESTADOS,
      paquetes_disponibles: PAQUETES,
    }
  },
  computed: {
    /**
     * Se muestra sólo si el cliente ya existe y la API manda el campo (compatibilidad con un admin-api viejo).
     * @returns {boolean}
     */
    visible() {
      return !!this.record && !!this.record.id && this.record.implementacion_contratada !== undefined
    },
    /** @returns {boolean} true si el estado elegido lleva paquetes. */
    pide_paquetes() {
      return ESTADOS_CON_PAQUETES.indexOf(this.form.estado) !== -1
    },
    /** @returns {boolean} true si el estado guardado es «mitad» o «completa» (los artículos los carga Lucas). */
    importa_lucas() {
      return ESTADOS_CON_PAQUETES.indexOf(this.record.implementacion_contratada) !== -1
    },
    /** @returns {boolean} true si la prueba está pausada (hay fecha de pausa y todavía no de reanudación). */
    esta_pausada() {
      return !!this.record.prueba_pausada_at && !this.record.prueba_reanudada_at
    },
    /** @returns {Array<string>} Paquetes guardados del cliente. */
    paquetes_guardados() {
      return Array.isArray(this.record.implementacion_paquetes) ? this.record.implementacion_paquetes : []
    },
    /** @returns {Array<string>} Los paquetes que se van a mandar (ninguno si el estado no los lleva). */
    paquetes_a_mandar() {
      return this.pide_paquetes ? this.form.paquetes.slice() : []
    },
    /** @returns {boolean} true si lo elegido difiere de lo guardado. */
    hay_cambios() {
      const guardados = this.paquetes_guardados.slice().sort().join(',')
      const elegidos = this.paquetes_a_mandar.sort().join(',')
      const guardado_con_paquetes = ESTADOS_CON_PAQUETES.indexOf(this.record.implementacion_contratada) !== -1
      return this.form.estado !== this.record.implementacion_contratada || (guardado_con_paquetes && guardados !== elegidos)
    },
    /**
     * Fechas en sólo lectura, con «—» cuando no hay.
     * @returns {Array<{clave: string, etiqueta: string, texto: string}>}
     */
    fechas() {
      const record = this.record
      return [
        { clave: 'implementacion_mitad_pagada_at', etiqueta: 'Mitad pagada' },
        { clave: 'implementacion_articulos_recibidos_at', etiqueta: 'Artículos recibidos' },
        { clave: 'implementacion_articulos_ok_at', etiqueta: 'Artículos importados OK' },
        { clave: 'prueba_pausada_at', etiqueta: 'Prueba pausada' },
        { clave: 'prueba_reanudada_at', etiqueta: 'Prueba reanudada' },
      ].map(function (fecha) {
        return Object.assign({}, fecha, { texto: format_datetime(record[fecha.clave]) || '—' })
      })
    },
  },
  watch: {
    /** Si el cliente cambia (otro registro, o la API devolvió valores nuevos) el formulario vuelve a lo guardado. */
    'record.id': function () {
      this.sincronizar()
    },
    'record.implementacion_contratada': function () {
      this.sincronizar()
    },
    'record.implementacion_paquetes': function () {
      this.sincronizar()
    },
  },
  created() {
    this.sincronizar()
  },
  methods: {
    /** Lleva el formulario a lo que tiene guardado el cliente. */
    sincronizar() {
      if (!this.record) {
        return
      }
      this.form = {
        estado: this.record.implementacion_contratada || 'incluida',
        paquetes: this.paquetes_guardados.slice(),
      }
      this.error_de_formulario = ''
    },

    /**
     * Copia al cliente en edición lo que devolvió la API y avisa al modal.
     *
     * @param {Object|null} model Cliente con los campos nuevos.
     */
    aplicar_cliente(model) {
      const self = this
      if (!model) {
        return
      }
      CAMPOS_DEL_CLIENTE.forEach(function (campo) {
        if (model[campo] !== undefined) {
          self.record[campo] = model[campo]
        }
      })
      this.sincronizar()
      this.$emit('record-updated', this.record)
    },

    /**
     * Ejecuta un pedido de la ficha con el mismo manejo de estado y errores. El aviso de error lo da el
     * interceptor de axios (un 422 o un 409 traen su mensaje), así que acá sólo se libera el botón.
     *
     * @param {string} accion Nombre de la acción en curso.
     * @param {Function} pedido Función que devuelve la promesa de axios.
     * @param {string} mensaje Aviso cuando sale bien.
     */
    ejecutar(accion, pedido, mensaje) {
      const self = this
      this.loading_action = accion
      pedido()
        .then(function (res) {
          const data = res && res.data ? res.data : {}
          self.loading_action = ''
          self.aplicar_cliente(data.model)
          show_toast(mensaje)
        })
        .catch(function () {
          self.loading_action = ''
        })
    },

    /**
     * Guarda el estado y los paquetes: PUT client/{id}/implementacion-contratada. Pasar a «mitad» o «completa»
     * pausa la prueba y arranca la implementación, así que antes se confirma.
     */
    guardar() {
      const self = this
      this.error_de_formulario = ''
      if (this.pide_paquetes && this.form.paquetes.length === 0) {
        this.error_de_formulario = 'Elegí al menos un paquete.'
        return
      }
      const pasa_a_pagada = this.pide_paquetes && !this.importa_lucas
      if (pasa_a_pagada && !window.confirm('Si el cliente está en prueba, se pausa y arranca la implementación. ¿Confirmás?')) {
        return
      }
      this.ejecutar(
        'guardar',
        function () {
          return api.put(route_string('client/' + self.record.id + '/implementacion-contratada'), {
            estado: self.form.estado,
            paquetes: self.paquetes_a_mandar,
          })
        },
        'Implementación contratada guardada.'
      )
    },

    /** «Artículos importados OK»: POST client/{id}/implementacion/articulos-importados (deja la tarea de seguir con /implementar). */
    articulos_importados() {
      const self = this
      this.ejecutar(
        'articulos',
        function () {
          return api.post(route_string('client/' + self.record.id + '/implementacion/articulos-importados'))
        },
        'Artículos marcados como importados.'
      )
    },

    /** «Reanudar prueba»: POST client/{id}/prueba/reanudar, con confirmación porque corre 7 días desde hoy. */
    reanudar() {
      const self = this
      if (!window.confirm('Reanuda la prueba: corre 7 días desde hoy. ¿Confirmás?')) {
        return
      }
      this.ejecutar(
        'reanudar',
        function () {
          return api.post(route_string('client/' + self.record.id + '/prueba/reanudar'))
        },
        'Prueba reanudada.'
      )
    },
  },
}
</script>

<style scoped>
.ic-bloque {
  min-width: 0;
}

.ic-bloque__fila {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  margin-bottom: 0.75rem;
}

.ic-bloque__campo {
  flex: 1 1 12rem;
  min-width: 0;
  max-width: 20rem;
  margin: 0;
  padding: 0;
  border: 0;
}

.ic-bloque__paquetes legend {
  float: none;
  width: auto;
  padding: 0;
  font-size: 1rem;
}

.ic-bloque__paquete {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-right: 1rem;
  font-size: 0.875rem;
}

.ic-bloque__fechas {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: 0.5rem 1rem;
  margin: 0;
}

.ic-bloque__fecha {
  min-width: 0;
}

.ic-bloque__fecha dt {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.ic-bloque__fecha dd {
  margin: 0;
  font-size: 0.85rem;
  word-break: break-word;
}
</style>
