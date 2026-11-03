<template>
  <div class="p-3 prueba-tab">
    <!-- Sin registro guardado todavía: no hay id al que pedirle la prueba -->
    <p v-if="!record || !record.id" class="text-muted small fst-italic mb-0">
      Guardá el {{ sujeto_label }} primero para ver su prueba gratuita.
    </p>

    <div v-else-if="loading" class="text-center py-4">
      <span class="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true" />
      <p class="text-muted small mt-2 mb-0">Cargando...</p>
    </div>

    <div v-else-if="load_error" class="alert alert-danger py-2 small mb-0">
      {{ load_error }}
    </div>

    <!-- No es una prueba: lo decimos y listo (la solapa existe en toda ficha, no solo en las de prueba) -->
    <p v-else-if="!prueba || !prueba.en_prueba" class="text-muted small mb-0">
      Este {{ sujeto_label }} no tiene una prueba gratuita.
    </p>

    <div v-else>
      <!-- ============================================================ -->
      <!-- Estado de la prueba: badge, vencimiento, días restantes, URL  -->
      <!-- ============================================================ -->
      <div class="card mb-3">
        <div class="card-body">
          <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
            <span class="badge" :class="badge_class">{{ badge_label }}</span>
            <span class="small text-muted">{{ texto_vencimiento }}</span>
          </div>
          <div v-if="prueba.url" class="small">
            Sistema:
            <a :href="prueba.url" target="_blank" rel="noopener">{{ prueba.url }}</a>
          </div>
          <div v-if="prueba.instancia" class="small text-muted mt-1">
            Instancia <strong>{{ prueba.instancia.nombre }}</strong>
            · {{ prueba.instancia.estado }}{{ prueba.instancia.dormida ? ' (dormida)' : '' }}
            · versión {{ prueba.instancia.version || '?' }}
            <span v-if="prueba.instancia.error" class="text-danger d-block mt-1">{{ prueba.instancia.error }}</span>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- Los días de prueba, editables. Al guardar se recalcula el     -->
      <!-- vencimiento desde el inicio de la prueba y se le avisa al ERP -->
      <!-- (contrato C3). Un sistema viejo sin la ruta queda «a mano».   -->
      <!-- ============================================================ -->
      <div v-if="prueba.estado !== 'prueba_borrada'" class="card mb-3">
        <div class="card-body">
          <label class="form-label fw-semibold" :for="input_id">Días de prueba</label>
          <div class="row g-2 align-items-center">
            <div class="col-12 col-sm-4 col-md-3">
              <input
                :id="input_id"
                v-model.number="dias"
                type="number"
                class="form-control form-control-sm"
                min="1"
                :max="prueba.max_dias || 365"
              />
            </div>
            <div class="col-12 col-sm-8 col-md-9 small text-muted">
              Se cuentan desde el inicio de la prueba ({{ formatear_fecha(prueba.inicio_at) }}). Con más días, una prueba vencida vuelve a estar activa.
            </div>
          </div>

          <div v-if="save_error" class="alert alert-danger py-2 small mt-3 mb-0">
            {{ save_error }}
          </div>
          <div v-if="c3_texto" class="small mt-3 mb-0" :class="c3_estado === 'ok' ? 'text-success' : 'text-warning'">
            {{ c3_texto }}
          </div>

          <div class="d-flex justify-content-end mt-3">
            <button type="button" class="btn btn-primary btn-sm" :disabled="saving || !dias_validos" @click="guardar">
              {{ saving ? 'Guardando...' : 'Guardar días' }}
            </button>
          </div>
        </div>
      </div>

      <!-- M4: seguimiento -->
      <!-- Acá monta M4 (Martín e importación) su `PruebaSeguimiento.vue` — hitos, envíos y avisos a Tomás —
           debajo de los días y de la instancia, antes del pie. Esta es la ÚNICA solapa `prueba` del modal del
           lead y de la ficha del cliente: M4 no agrega otra, se engancha acá. -->

      <p class="text-muted small mb-0">
        Para contratar: «Promover a cliente» desde el lead. No se reinstala nada: esta instancia es su sistema definitivo.
        El pool completo está en <router-link to="/pruebas">Pruebas</router-link>.
      </p>
    </div>
  </div>
</template>

<script>
import api, { resolve_error_message } from '@/utils/axios'

/**
 * Solapa «Prueba» de la ficha del cliente y del modal del lead (programa «Prueba gratuita de 7
 * días», misión prueba-alta-instancia, 3/11/2026).
 *
 * Es la MISMA solapa para los dos: deduce el sujeto del `model_name` que le pasa el modal
 * (`client` o `lead`, como `SubjectPipelinesTab`) y le pega a `GET/PUT client/{id}/prueba` o a
 * `GET/PUT lead/{id}/prueba`. El PUT escribe `trial_days` y `trial_ends_at` en el admin y le avisa
 * al sistema del cliente (C3 `admin-sync/prueba/vencimiento`); el resultado de ese aviso se muestra
 * abajo del campo.
 */
export default {
  name: 'PruebaTab',
  props: {
    record: { type: Object, default: null },
    model_name: { type: String, default: 'client' },
  },
  data() {
    return {
      loading: false,
      load_error: null,
      save_error: null,
      saving: false,
      prueba: null,
      dias: null,
      c3_estado: null,
      c3_texto: '',
    }
  },
  computed: {
    es_lead() {
      return this.model_name === 'lead'
    },
    sujeto_label() {
      return this.es_lead ? 'lead' : 'cliente'
    },
    ruta() {
      return (this.es_lead ? '/lead/' : '/client/') + this.record.id + '/prueba'
    },
    input_id() {
      return 'prueba-dias-' + this.model_name + '-' + (this.record && this.record.id ? this.record.id : 'nuevo')
    },
    dias_validos() {
      const max = this.prueba && this.prueba.max_dias ? this.prueba.max_dias : 365
      return Number.isInteger(this.dias) && this.dias >= 1 && this.dias <= max
    },
    badge_label() {
      if (!this.prueba) {
        return ''
      }
      if (this.prueba.estado === 'prueba_vencida') {
        return 'Prueba vencida'
      }
      if (this.prueba.estado === 'prueba_borrada') {
        return 'Prueba borrada'
      }
      return 'Prueba activa'
    },
    badge_class() {
      if (!this.prueba) {
        return 'bg-secondary'
      }
      if (this.prueba.estado === 'prueba_vencida') {
        return 'bg-warning text-dark'
      }
      if (this.prueba.estado === 'prueba_borrada') {
        return 'bg-secondary'
      }
      return 'bg-success'
    },
    texto_vencimiento() {
      if (!this.prueba || !this.prueba.trial_ends_at) {
        return 'Sin fecha de vencimiento.'
      }
      const fecha = this.formatear_fecha(this.prueba.trial_ends_at)
      if (this.prueba.dias_restantes === 0) {
        return 'Venció el ' + fecha + '.'
      }
      const restantes = this.prueba.dias_restantes
      return 'Vence el ' + fecha + ' (' + restantes + (restantes === 1 ? ' día' : ' días') + ').'
    },
  },
  watch: {
    'record.id': function (nuevo_id, viejo_id) {
      if (nuevo_id && nuevo_id !== viejo_id) {
        this.cargar()
      }
    },
  },
  mounted() {
    this.cargar()
  },
  methods: {
    cargar() {
      const self = this
      if (!this.record || !this.record.id) {
        return
      }
      self.loading = true
      self.load_error = null
      api
        .get(this.ruta, { silent_error: true })
        .then(function (res) {
          self.aplicar(res.data || {})
          self.loading = false
        })
        .catch(function (error) {
          self.load_error = resolve_error_message(error)
          self.loading = false
        })
    },
    aplicar(payload) {
      this.prueba = payload || null
      this.dias = this.prueba && this.prueba.trial_days ? this.prueba.trial_days : null
      if (payload && payload.c3) {
        this.c3_estado = payload.c3.estado || null
        this.c3_texto = this.texto_de_c3(payload.c3)
      }
    },
    texto_de_c3(c3) {
      if (!c3 || !c3.estado) {
        return ''
      }
      if (c3.estado === 'ok') {
        return 'El sistema del cliente ya tiene el vencimiento nuevo.'
      }
      if (c3.estado === 'sin_ruta') {
        return 'Guardado en el admin. El sistema del cliente todavía no tiene la ruta del vencimiento: lo toma al actualizarse.'
      }
      return 'Guardado en el admin, pero no se le pudo avisar al sistema del cliente: ' + (c3.mensaje || c3.estado) + '.'
    },
    guardar() {
      const self = this
      if (!this.record || !this.record.id || !this.dias_validos) {
        return
      }
      self.saving = true
      self.save_error = null
      self.c3_texto = ''
      api
        .put(this.ruta, { trial_days: this.dias }, { silent_error: true })
        .then(function (res) {
          self.aplicar(res.data || {})
          self.saving = false
          window.dispatchEvent(new CustomEvent('admin-spa-toast', {
            detail: { message: 'Días de prueba guardados.', variant: 'success' },
          }))
        })
        .catch(function (error) {
          self.save_error = resolve_error_message(error)
          self.saving = false
        })
    },
    formatear_fecha(valor) {
      if (!valor) {
        return '—'
      }
      const fecha = new Date(valor)
      if (Number.isNaN(fecha.getTime())) {
        return String(valor)
      }
      return fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        + ' ' + fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    },
  },
}
</script>

<style scoped>
.prueba-tab .card {
  border-color: rgba(0, 0, 0, 0.1);
}
</style>
