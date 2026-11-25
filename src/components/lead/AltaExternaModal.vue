<template>
  <!--
    Nuevo lead de otro medio (misión leads-referidos-compromisos, E1).

    Sirve para dar de alta a alguien que NO llegó por un anuncio ni por la web: un referido, una persona que le
    escribió a Lucas por su WhatsApp personal o que ya habló por teléfono. Se carga de dónde vino, quién lo
    recomendó y lo que ya se habló, y desde ahí sigue el mismo camino que cualquier lead: Martín le explica los
    paquetes sin presentarle ComercioCity de cero ni repetirle preguntas, y si quiere probar aparece en el
    tablero de Juan. Dar de alta NO manda ningún WhatsApp por sí solo; el primer contacto por plantilla es opcional.

    Un solo pedido (POST /lead/externo). Si el teléfono ya tiene lead, la API responde 409 y acá se ofrece
    «Completar el lead #N» (reenvía lo mismo con `completar_existente`). Al terminar navega a la conversación.
    Lo usan Lucas y Juan (perfil «Sólo Leads»): Juan no puede buscar clientes, así que ve sólo el campo de texto
    para anotar quién lo refirió. Las reglas de la pantalla están en `utils/alta_externa.js`.
  -->
  <base-modal :show="show" title="Nuevo lead de otro medio" size="lg" :stack_level="stack_level" @close="on_cancel">
    <form class="ae-form" novalidate @submit.prevent="on_submit(false)">
      <!-- ¿Por qué medio llegó? -->
      <div class="ae-form__group">
        <label class="form-label mb-1" for="ae-origen">¿Cómo llegó?<span class="ae-form__required" title="Obligatorio"> *</span></label>
        <select id="ae-origen" v-model="form.origen" class="form-select" :class="{ 'is-invalid': !!error_de('origen') }" :disabled="saving">
          <option v-for="origen in origenes" :key="origen.value" :value="origen.value">{{ origen.label }}</option>
        </select>
        <div v-if="error_de('origen')" class="invalid-feedback d-block">{{ error_de('origen') }}</div>
      </div>

      <!-- Nombre y teléfono -->
      <div class="ae-form__row">
        <div class="ae-form__group">
          <label class="form-label mb-1" for="ae-nombre">Nombre<span class="ae-form__required" title="Obligatorio"> *</span></label>
          <input id="ae-nombre" v-model="form.contact_name" type="text" class="form-control" :class="{ 'is-invalid': !!error_de('contact_name') }" maxlength="150" autocomplete="off" :disabled="saving" />
          <div v-if="error_de('contact_name')" class="invalid-feedback d-block">{{ error_de('contact_name') }}</div>
        </div>
        <div class="ae-form__group">
          <label class="form-label mb-1" for="ae-telefono">Teléfono<span class="ae-form__required" title="Obligatorio"> *</span></label>
          <input id="ae-telefono" v-model="form.phone" type="tel" class="form-control" :class="{ 'is-invalid': !!error_de('phone') }" placeholder="+54 9 351 123-4567" autocomplete="off" :disabled="saving" />
          <div v-if="error_de('phone')" class="invalid-feedback d-block">{{ error_de('phone') }}</div>
        </div>
      </div>

      <!-- Empresa, rubro y mail -->
      <div class="ae-form__row">
        <div class="ae-form__group">
          <label class="form-label mb-1" for="ae-empresa">Empresa</label>
          <input id="ae-empresa" v-model="form.company_name" type="text" class="form-control" :class="{ 'is-invalid': !!error_de('company_name') }" maxlength="150" :disabled="saving" />
          <div v-if="error_de('company_name')" class="invalid-feedback d-block">{{ error_de('company_name') }}</div>
        </div>
        <div class="ae-form__group">
          <label class="form-label mb-1" for="ae-rubro">Rubro</label>
          <input id="ae-rubro" v-model="form.business_type" type="text" class="form-control" :class="{ 'is-invalid': !!error_de('business_type') }" maxlength="80" :disabled="saving" />
          <div v-if="error_de('business_type')" class="invalid-feedback d-block">{{ error_de('business_type') }}</div>
        </div>
      </div>
      <div class="ae-form__group">
        <label class="form-label mb-1" for="ae-mail">Mail</label>
        <input id="ae-mail" v-model="form.email" type="email" class="form-control" :class="{ 'is-invalid': !!error_de('email') }" maxlength="150" :disabled="saving" />
        <div v-if="error_de('email')" class="invalid-feedback d-block">{{ error_de('email') }}</div>
      </div>

      <!-- Quién lo refirió: un cliente de ComercioCity (si el perfil puede buscarlos) o texto libre -->
      <div v-if="puede_buscar_clientes" class="ae-form__group">
        <label class="form-label mb-1" for="ae-cliente-busqueda">Cliente que lo recomendó</label>
        <input id="ae-cliente-busqueda" v-model="busqueda_cliente" type="search" class="form-control mb-2" placeholder="Buscar por nombre o empresa" autocomplete="off" :disabled="saving" />
        <select v-model="form.referido_por_client_id" class="form-select" aria-label="Cliente que lo recomendó" :disabled="saving">
          <option :value="null">Ninguno</option>
          <option v-for="cliente in clientes_filtrados" :key="cliente.id" :value="cliente.id">{{ nombre_del_cliente(cliente) }}</option>
        </select>
        <div v-if="error_de('referido_por_client_id')" class="invalid-feedback d-block">{{ error_de('referido_por_client_id') }}</div>
      </div>
      <div class="ae-form__group">
        <label class="form-label mb-1" for="ae-referido-texto">{{ puede_buscar_clientes ? 'O quién lo recomendó (si no es cliente)' : 'Quién lo recomendó' }}</label>
        <input id="ae-referido-texto" v-model="form.referido_por_texto" type="text" class="form-control" :class="{ 'is-invalid': !!error_de('referido_por_texto') }" maxlength="120" :disabled="saving" />
        <div v-if="error_de('referido_por_texto')" class="invalid-feedback d-block">{{ error_de('referido_por_texto') }}</div>
      </div>

      <!-- Lo que ya se habló: Martín lo lee en cada turno -->
      <div class="ae-form__group">
        <label class="form-label mb-1" for="ae-contexto">Lo que ya se habló</label>
        <textarea id="ae-contexto" v-model="form.contexto_previo" class="form-control" :class="{ 'is-invalid': !!error_de('contexto_previo') }" rows="5" placeholder="Qué negocio tiene, qué usa hoy, qué le interesa, qué se le dijo…" :disabled="saving" />
        <div class="form-text">Martín lo lee antes de contestarle, para no repetirle preguntas.</div>
        <div v-if="error_de('contexto_previo')" class="invalid-feedback d-block">{{ error_de('contexto_previo') }}</div>
      </div>

      <!-- Estado inicial -->
      <div class="ae-form__group">
        <label class="form-label mb-1" for="ae-estado">Estado inicial</label>
        <select id="ae-estado" v-model="form.estado_inicial" class="form-select" :class="{ 'is-invalid': !!error_de('estado_inicial') }" :disabled="saving">
          <option v-for="estado in estados" :key="estado.value" :value="estado.value">{{ estado.label }}</option>
        </select>
        <div v-if="error_de('estado_inicial')" class="invalid-feedback d-block">{{ error_de('estado_inicial') }}</div>
      </div>

      <!-- Opciones -->
      <div class="form-check mb-2">
        <input id="ae-tablero" v-model="form.entrar_al_tablero" type="checkbox" class="form-check-input" :disabled="saving || entra_solo_al_tablero" />
        <label class="form-check-label" for="ae-tablero">Que entre al tablero de Juan{{ entra_solo_al_tablero ? ' (ya entra por estar en «Quiere probar»)' : '' }}</label>
      </div>
      <!-- El primer WhatsApp no se le ofrece a Juan (Sólo Leads): su perfil no le escribe al lead y la API lo rechaza. -->
      <div v-if="puede_escribirle_al_lead" class="form-check mb-3">
        <input id="ae-primer-contacto" v-model="manda_primer_contacto" type="checkbox" class="form-check-input" :disabled="saving" />
        <label class="form-check-label" for="ae-primer-contacto">Escribirle ahora con la plantilla de referido</label>
        <div class="form-text">Sólo sale si la plantilla está aprobada en Meta; si no, el lead se crea igual y te avisamos por qué no salió.</div>
      </div>

      <!-- Teléfono repetido: se ofrece completar el lead que ya existía -->
      <div v-if="lead_existente_id" class="alert alert-warning ae-form__aviso" role="alert">
        <p class="mb-2">Ya hay un lead con ese teléfono. Podés completarlo con lo que cargaste (no se crea otro ni se cambia su estado).</p>
        <button type="button" class="btn btn-sm btn-warning" :disabled="saving" @click="on_submit(true)">Completar el lead #{{ lead_existente_id }}</button>
      </div>

      <div v-if="server_message" class="alert alert-danger ae-form__aviso" role="alert">{{ server_message }}</div>
      <div v-if="aviso_primer_contacto" class="alert alert-info ae-form__aviso" role="status">{{ aviso_primer_contacto }}</div>

      <div class="ae-form__actions">
        <button type="button" class="btn btn-outline-secondary" :disabled="saving" @click="on_cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? 'Guardando…' : 'Dar de alta' }}</button>
      </div>
    </form>
  </base-modal>
</template>

<script>
import api from '@/utils/axios'
import BaseModal from '@/components/ui/BaseModal.vue'
import { first_error, show_toast, validation_errors } from '@/components/pipeline/pipeline_helpers'
import { es_solo_leads } from '@/utils/solo_leads'
import { ESTADOS, ORIGENES, payload, validar } from '@/utils/alta_externa'

/**
 * Modal «Nuevo lead de otro medio».
 */
export default {
  name: 'AltaExternaModal',
  components: { BaseModal },
  props: {
    /** Visibilidad del modal. */
    show: { type: Boolean, default: true },
    /** Nivel de apilamiento del modal. */
    stack_level: { type: Number, default: 0 },
  },
  emits: ['close', 'creado'],
  data() {
    return {
      /** Valores del formulario (ver `utils/alta_externa.js`). */
      form: {
        origen: 'referido',
        contact_name: '',
        phone: '',
        company_name: '',
        business_type: '',
        email: '',
        referido_por_client_id: null,
        referido_por_texto: '',
        contexto_previo: '',
        estado_inicial: 'nuevo',
        entrar_al_tablero: false,
        primer_contacto: 'ninguno',
      },
      /** Casilla «escribirle ahora con la plantilla de referido» (se traduce a `primer_contacto`). */
      manda_primer_contacto: false,
      /** Errores por campo: los de la validación local y, después de mandar, los del 422 de la API. */
      errores: {},
      /** Mensaje general cuando la API rechaza por algo que no es de un campo. */
      server_message: '',
      /** Id del lead que ya tenía ese teléfono (409): habilita «Completar el lead #N». */
      lead_existente_id: null,
      /** Qué pasó con el primer contacto, para avisarlo cuando no salió. */
      aviso_primer_contacto: '',
      /** true mientras viaja el pedido: bloquea el doble clic. */
      saving: false,
      /** Orígenes para el select. */
      origenes: ORIGENES,
      /** Estados iniciales para el select. */
      estados: ESTADOS,
      /** Clientes de ComercioCity para elegir quién lo refirió (se cargan al abrir si el perfil puede). */
      clientes: [],
      /** Texto con el que se filtra la lista de clientes. */
      busqueda_cliente: '',
    }
  },
  computed: {
    /**
     * Juan (perfil «Sólo Leads») no puede listar clientes: para él sólo existe el campo de texto.
     * @returns {boolean}
     */
    puede_buscar_clientes() {
      return !es_solo_leads(this.$store.state.auth.admin)
    },
    /**
     * El primer WhatsApp por plantilla sólo se ofrece a quien puede escribirle al lead: el perfil «Sólo Leads» no.
     * @returns {boolean}
     */
    puede_escribirle_al_lead() {
      return !es_solo_leads(this.$store.state.auth.admin)
    },
    /**
     * Un lead que nace en «Quiere probar» entra solo al tablero: la casilla queda tildada y fija.
     * @returns {boolean}
     */
    entra_solo_al_tablero() {
      return this.form.estado_inicial === 'link_enviado'
    },
    /**
     * Clientes que coinciden con la búsqueda (siempre incluye al elegido para que el select no lo pierda).
     * @returns {Array<Object>}
     */
    clientes_filtrados() {
      const self = this
      const buscado = this.busqueda_cliente.trim().toLowerCase()
      if (buscado === '') {
        return this.clientes
      }
      return this.clientes.filter(function (cliente) {
        const elegido = cliente.id === self.form.referido_por_client_id
        return elegido || self.nombre_del_cliente(cliente).toLowerCase().indexOf(buscado) !== -1
      })
    },
  },
  watch: {
    /** Tildar o destildar la casilla del primer contacto cambia el valor que viaja. */
    manda_primer_contacto(valor) {
      this.form.primer_contacto = valor ? 'plantilla_referido' : 'ninguno'
    },
  },
  created() {
    this.cargar_clientes()
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
     * Etiqueta de un cliente en el select: «Nombre (Empresa)».
     *
     * @param {Object} cliente
     * @returns {string}
     */
    nombre_del_cliente(cliente) {
      const nombre = cliente.name || ''
      const empresa = cliente.company_name || ''
      return empresa && empresa !== nombre ? nombre + ' (' + empresa + ')' : nombre
    },
    /** Carga los clientes para el select (no para «Sólo Leads», que no tiene permiso). Un fallo deja sólo el texto. */
    cargar_clientes() {
      const self = this
      if (!this.puede_buscar_clientes) {
        return
      }
      api
        .get('/client')
        .then(function (res) {
          self.clientes = (res.data && res.data.models) || []
        })
        .catch(function () {
          // El interceptor de axios ya avisa; sin la lista se puede anotar a quien lo refirió en el texto.
          self.clientes = []
        })
    },
    /**
     * Valida y manda el alta. Con 409 deja a mano «Completar el lead #N»; con 200/201 navega a la conversación.
     *
     * @param {boolean} completar_existente true = reenvía pidiendo completar el lead que ya existía.
     */
    on_submit(completar_existente) {
      const self = this
      if (this.saving) {
        return
      }
      this.server_message = ''
      this.aviso_primer_contacto = ''
      this.errores = validar(this.form)
      if (Object.keys(this.errores).length > 0) {
        return
      }
      const cuerpo = payload(this.form)
      if (completar_existente === true) {
        cuerpo.completar_existente = true
      }
      this.saving = true
      api
        .post('/lead/externo', cuerpo)
        .then(function (res) {
          const data = res.data || {}
          self.saving = false
          const lead = data.model || {}
          const primer = data.primer_contacto || {}
          show_toast(completar_existente === true ? 'Lead completado.' : 'Lead dado de alta.')
          if (primer.estado === 'no_enviado') {
            show_toast('El primer mensaje no salió (' + self.motivo_legible(primer.motivo) + '). El lead quedó cargado igual.')
          }
          self.$emit('creado', lead)
          // Se limpia el formulario y se cierra ANTES de navegar: si no, el modal quedaba abierto encima de la conversación.
          self.reiniciar_formulario()
          self.$emit('close')
          if (lead.id) {
            self.$router.push({ name: 'lead_conversation', params: { lead_id: lead.id } })
          }
        })
        .catch(function (error) {
          self.saving = false
          const respuesta = error && error.response && error.response.data
          if (error && error.response && error.response.status === 409 && respuesta && respuesta.code === 'lead_existente') {
            self.lead_existente_id = respuesta.lead_id
            return
          }
          self.errores = validation_errors(error)
          if (Object.keys(self.errores).length === 0) {
            self.server_message = respuesta && respuesta.message ? String(respuesta.message) : 'No se pudo dar de alta el lead. Probá de nuevo.'
          }
        })
    },
    /** Deja el formulario y los avisos como al abrir (después de un alta o de completar un lead existente). */
    reiniciar_formulario() {
      this.form = {
        origen: 'referido',
        contact_name: '',
        phone: '',
        company_name: '',
        business_type: '',
        email: '',
        referido_por_client_id: null,
        referido_por_texto: '',
        contexto_previo: '',
        estado_inicial: 'nuevo',
        entrar_al_tablero: false,
        primer_contacto: 'ninguno',
      }
      this.manda_primer_contacto = false
      this.errores = {}
      this.server_message = ''
      this.lead_existente_id = null
      this.aviso_primer_contacto = ''
      this.busqueda_cliente = ''
    },
    /**
     * Motivo por el que el primer contacto no salió, en castellano.
     *
     * @param {string} motivo Código que devuelve la API.
     * @returns {string}
     */
    motivo_legible(motivo) {
      const motivos = {
        nombre_vacio: 'falta cargar el nombre de la plantilla en Cuenta',
        plantilla_no_registrada: 'la plantilla no está registrada',
        plantilla_inactiva: 'la plantilla está inactiva',
        plantilla_no_aprobada: 'Meta todavía no aprobó la plantilla',
        sin_referente: 'falta quién lo refirió',
        envio_fallido: 'falló el envío',
        no_recibe_mensajes: 'esa persona pidió no recibir mensajes',
        ya_es_cliente: 'ya es cliente',
        primer_contacto_ya_enviado: 'ya se le mandó el primer mensaje',
        lead_existente: 'ya existía un lead con ese teléfono',
      }
      return motivos[motivo] || 'motivo desconocido'
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
.ae-form {
  min-width: 0;
}

.ae-form__group {
  margin: 0 0 1rem;
  min-width: 0;
}

/* Dos columnas en pantallas anchas; una sola en el teléfono. */
.ae-form__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 1rem;
}

.ae-form__required {
  color: var(--bs-danger, #dc3545);
}

.ae-form__aviso {
  margin-bottom: 1rem;
}

.ae-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

@media (max-width: 575.98px) {
  .ae-form__row {
    grid-template-columns: 1fr;
  }

  .ae-form__actions .btn {
    flex: 1 1 0;
  }
}
</style>
