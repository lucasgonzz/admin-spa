<template>
  <button type="button" class="btn btn-sm btn-outline-secondary" @click="abrir">
    <i class="bi bi-signpost-split me-1" aria-hidden="true"></i> Tours de Robotito
  </button>

  <base-modal v-model:show="abierto" title="Tours de Robotito" size="lg">
    <p v-if="cargando" class="text-muted mb-0" role="status">Cargando seguimiento…</p>
    <div v-else-if="error" role="status">
      <p class="text-danger mb-2">{{ error }}</p>
      <button type="button" class="btn btn-sm btn-outline-secondary" @click="cargar">Reintentar</button>
    </div>
    <p v-else-if="!disponible" class="text-muted mb-0">El sistema de este comercio todavía no ofrece el seguimiento de tours.</p>
    <p v-else-if="!tours.length" class="text-muted mb-0">Este ticket todavía no tiene tours ofrecidos.</p>
    <div v-else class="d-grid gap-3">
      <article v-for="tour in tours" :key="tour.uuid" class="border rounded p-3 recorrido">
        <div class="d-flex flex-wrap align-items-start gap-2 justify-content-between mb-2">
          <h3 class="fs-6 mb-0">{{ tour.titulo }}</h3>
          <span class="badge text-bg-secondary">{{ estado(tour) }}</span>
        </div>
        <dl class="recorrido-datos small mb-0">
          <div><dt>Ofrecido</dt><dd>{{ fecha(tour.offered_at) }} · {{ tour.source === 'whatsapp' ? 'WhatsApp' : 'Sistema' }}</dd></div>
          <div><dt>Aviso visto</dt><dd>{{ fecha(tour.shown_at) }}</dd></div>
          <div><dt>Aceptado</dt><dd>{{ fecha(tour.accepted_at) }}</dd></div>
          <div><dt>Pasos vistos</dt><dd>{{ tour.steps_shown.length }} de {{ tour.total_steps }}<span v-if="tour.steps_shown.length"> ({{ tour.steps_shown.join(', ') }})</span></dd></div>
          <div v-if="tour.finished_at"><dt>Finalizado</dt><dd>{{ fecha(tour.finished_at) }}</dd></div>
          <div v-if="tour.previous_uuid"><dt>Reformulación</dt><dd>Continúa el tour «{{ titulo_anterior(tour.previous_uuid) }}».</dd></div>
          <div v-if="tour.reformulated_at"><dt>Reformulado</dt><dd>{{ fecha(tour.reformulated_at) }}</dd></div>
        </dl>
        <div v-if="tour.question" class="small border-top mt-2 pt-2">
          <strong>Pregunta durante el recorrido<span v-if="tour.question_step">, paso {{ tour.question_step }}</span></strong>
          <p class="mb-1">{{ tour.question }}</p>
          <span class="text-muted">{{ fecha(tour.question_at) }} · {{ tour.question_delivered_at ? 'Recibida en soporte' : 'Pendiente de entrega' }}</span>
        </div>
        <div v-if="tour.feedback" class="small border-top mt-2 pt-2">
          <strong>{{ tour.feedback.liked ? 'Le gustó' : 'No le gustó' }}</strong>
          <p v-if="tour.feedback.reasons.length" class="mb-1">{{ motivos(tour.feedback.reasons) }}</p>
          <p v-if="tour.feedback.comment" class="mb-1">{{ tour.feedback.comment }}</p>
        </div>
        <p v-else-if="tour.state === 'completed'" class="small text-muted border-top mt-2 pt-2 mb-0">Sin valoración</p>
      </article>
    </div>
  </base-modal>
</template>

<script>
import BaseModal from '@/components/ui/BaseModal.vue'
import api from '@/utils/axios'

const ESTADOS = {
  pending: 'Pendiente',
  accepted: 'Empezado',
  completed: 'Completo',
  abandoned: 'Incompleto',
  dismissed: 'Descartado',
  reformulated: 'Reformulado',
}

const MOTIVOS = {
  claro: 'Explicación clara',
  facil: 'Fácil de seguir',
  ritmo: 'Buen ritmo',
  resolvio: 'Resolvió la consulta',
  confuso: 'Difícil de entender',
  lento: 'Demasiado lento',
  rapido: 'Demasiado rápido',
  rebuscado: 'Rebuscado',
  no_resolvio: 'No resolvió la consulta',
  problema_tecnico: 'Problema técnico',
}

const FECHA = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Argentina/Buenos_Aires',
})

export default {
  components: { BaseModal },
  props: { ticket_id: { type: [Number, String], required: true } },
  data() {
    return { abierto: false, cargando: false, disponible: true, tours: [], error: '', consulta: 0 }
  },
  methods: {
    abrir() {
      this.abierto = true
      this.cargar()
    },
    cargar() {
      const consulta = ++this.consulta
      this.cargando = true
      this.error = ''
      api.get(`/support-ticket/${this.ticket_id}/tours`).then(({ data }) => {
        if (consulta !== this.consulta) return
        this.disponible = data.available !== false
        this.tours = data.model
      }).catch(error => {
        if (consulta !== this.consulta) return
        if (error.response?.status === 404) {
          this.disponible = false
          this.tours = []
        } else {
          this.error = 'No pudimos consultar los tours de este ticket.'
        }
      }).finally(() => {
        if (consulta === this.consulta) this.cargando = false
      })
    },
    estado(tour) {
      return ESTADOS[tour.state] || 'Sin estado'
    },
    fecha(valor) {
      return valor ? FECHA.format(new Date(valor)) : '—'
    },
    titulo_anterior(uuid) {
      return this.tours.find(tour => tour.uuid === uuid)?.titulo || uuid
    },
    motivos(codigos) {
      return codigos.map(codigo => MOTIVOS[codigo] || codigo).join(' · ')
    },
  },
}
</script>

<style scoped>
.recorrido {
  overflow-wrap: anywhere;
}

.recorrido-datos {
  display: grid;
  gap: .5rem 1rem;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
}

.recorrido-datos dd {
  margin: 0;
}
</style>
