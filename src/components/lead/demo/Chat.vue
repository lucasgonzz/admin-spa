<template>
  <section class="demo-chat-operador" aria-label="Conversación de la demo">
    <header class="demo-chat-operador__cabecera">
      <div class="demo-chat-operador__identidad">
        <span class="demo-chat-operador__orbe" aria-hidden="true">✦</span>
        <div><strong>Asistente de la demo</strong><small>{{ estado_texto }}</small></div>
      </div>
      <label class="demo-chat-operador__switch">
        <input type="checkbox" :checked="automatico" :disabled="ocupado || !lead_id" @change="configurar($event.target.checked)" />
        <span>Respuesta automática</span>
      </label>
    </header>
    <form class="demo-chat-operador__espera" @submit.prevent="guardar_espera">
      <label :for="'demo-espera-' + lead_id">Espera antes de responder (segundos)</label>
      <input :id="'demo-espera-' + lead_id" v-model="espera" type="number" min="0" max="120" step="1" required :disabled="ocupado || !lead_id" :aria-describedby="'demo-espera-ayuda-' + lead_id" />
      <button type="submit" :disabled="ocupado || !lead_id">Guardar espera</button>
      <small :id="'demo-espera-ayuda-' + lead_id">De 0 a 120 s desde el último mensaje. Se aplica también a la espera pendiente; si ya está pensando, rige para la próxima respuesta.</small>
      <span role="status" aria-live="polite">{{ espera_aviso }}</span>
    </form>

    <p class="demo-chat-operador__nota">Los mensajes que mandes aparecen como respuestas del asistente. Podés corregirlos o eliminarlos sin avisos en la demo.</p>
    <div v-if="error" class="demo-chat-operador__error" role="alert">{{ error }}</div>
    <div v-if="snapshot.conversacion.ultimo_error" class="demo-chat-operador__error" role="status">{{ snapshot.conversacion.ultimo_error }}</div>

    <div ref="hilo" class="demo-chat-operador__hilo" aria-live="polite" aria-relevant="additions">
      <div v-if="!snapshot.mensajes.length" class="demo-chat-operador__vacio">
        <span aria-hidden="true">✧</span><strong>{{ cargando ? 'Cargando conversación…' : 'El recorrido empieza acá' }}</strong>
        <p>Cuando el lead entre a la demo, vas a ver sus preguntas, los videos y las respuestas en este hilo.</p>
      </div>
      <article v-for="mensaje in snapshot.mensajes" :key="mensaje.id" class="demo-chat-operador__mensaje"
        :class="{ 'demo-chat-operador__mensaje--lead': mensaje.rol === 'lead', 'demo-chat-operador__mensaje--borrador': mensaje.estado === 'borrador' }">
        <div class="demo-chat-operador__autor">
          <strong>{{ mensaje.rol === 'lead' ? nombre_lead : 'Asistente' }}</strong>
          <span v-if="mensaje.estado === 'borrador'" class="demo-chat-operador__etiqueta">Borrador · sin enviar</span>
          <time :datetime="mensaje.creado_at">{{ hora(mensaje.creado_at) }}</time>
        </div>
        <p>{{ mensaje.contenido }}</p>
        <div v-for="video in mensaje.videos" :key="video.clave" class="demo-chat-operador__video">
          <video controls preload="none" :src="video.url" :poster="video.miniatura_url || undefined" :aria-label="video.titulo"></video>
          <strong>{{ video.titulo }}</strong>
          <div class="demo-chat-operador__progreso"><i :style="{ width: video.porcentaje + '%' }"></i></div>
          <small>{{ video.completado ? '✓ Completado' : video.omitido ? 'Salteado' : video.porcentaje + '% visto' }} · {{ video.origen === 'recurso' ? 'Centro de recursos' : 'Demo' }}</small>
        </div>
        <div class="demo-chat-operador__acciones">
          <button v-if="mensaje.estado === 'borrador'" type="button" class="demo-chat-operador__publicar" :disabled="ocupado" @click="accion('post', '/mensajes/' + mensaje.id + '/enviar')">Enviar respuesta</button>
          <button type="button" :disabled="ocupado" @click="editar(mensaje)" :aria-label="'Editar mensaje de ' + (mensaje.rol === 'lead' ? nombre_lead : 'asistente')">Editar</button>
          <button type="button" :disabled="ocupado" @click="accion('delete', '/mensajes/' + mensaje.id)">Eliminar</button>
        </div>
      </article>
      <div v-if="procesando" class="demo-chat-operador__pensando" role="status"><span class="demo-chat-operador__orbita" aria-hidden="true"></span>{{ snapshot.conversacion.estado === 'esperando' ? 'Agrupando los mensajes del lead…' : 'Preparando una respuesta…' }}</div>
    </div>

    <form class="demo-chat-operador__compositor" @submit.prevent="enviar">
      <div class="demo-chat-operador__barra">
        <span>{{ editando ? 'Editando mensaje' : automatico ? 'Intervenir en la conversación' : 'Modo manual · vos decidís qué se envía' }}</span>
        <button v-if="editando" type="button" @click="cancelar_edicion">Cancelar edición</button>
        <button v-else type="button" :disabled="ocupado || procesando || !lead_id" @click="accion('post', '/sugerir')">✦ Sugerir respuesta</button>
      </div>
      <div class="demo-chat-operador__entrada">
        <textarea v-model="texto" rows="2" maxlength="4000" aria-label="Mensaje del asistente de la demo" placeholder="Escribí como el asistente…" :disabled="ocupado || !lead_id" @keydown.enter.exact.prevent="enviar"></textarea>
        <button type="submit" :disabled="ocupado || !texto.trim() || !lead_id" :aria-label="editando ? 'Guardar mensaje' : 'Enviar mensaje'">{{ ocupado ? '…' : editando ? 'Guardar' : 'Enviar ↑' }}</button>
      </div>
    </form>
  </section>
</template>

<script>
import api from '@/utils/axios'

const vacio = () => ({ conversacion: { auto_responder: true, espera_segundos: 10, estado: 'inactivo', revision: -1 }, mensajes: [] })

export default {
  name: 'LeadDemoChat',
  props: { draft: { type: Object, default: null }, record: { type: Object, default: null }, all_properties: { type: Array, default: () => [] } },
  data() { return { snapshot: vacio(), espera: 10, espera_aviso: '', texto: '', editando: null, error: '', cargando: false, ocupado: false, intervalo: null, montado: false, vista: 0 } },
  computed: {
    lead_id() { return (this.draft || this.record || {}).id || null },
    nombre_lead() { return (this.draft || this.record || {}).contact_name || 'Lead' },
    automatico() { return this.snapshot.conversacion.auto_responder },
    procesando() { return ['esperando', 'pensando'].includes(this.snapshot.conversacion.estado) },
    estado_texto() { return ({ inactivo: 'Conversación en vivo', esperando: 'Agrupando mensajes · ' + (this.snapshot.conversacion.espera_segundos ?? 10) + ' s', pensando: 'Pensando la respuesta', listo: 'Borrador listo para revisar', error: 'Necesita tu atención' })[this.snapshot.conversacion.estado] || 'Conversación en vivo' },
  },
  watch: { lead_id() { this.vista++; this.espera = 10; this.espera_aviso = ''; this.snapshot = vacio(); this.cancelar_edicion(); this.error = ''; this.cargando = false; this.ocupado = false; this.cargar() } },
  mounted() {
    this.montado = true
    this.cargar()
    this.intervalo = window.setInterval(() => { if (this.$el && this.$el.offsetParent !== null) this.cargar() }, 4000)
  },
  beforeUnmount() { this.montado = false; window.clearInterval(this.intervalo) },
  methods: {
    vigente(lead, vista) { return this.montado && lead === this.lead_id && vista === this.vista },
    hora(fecha) { return new Date(fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) },
    aplicar(datos, lead) {
      if (!this.montado || lead !== this.lead_id || !datos || !Array.isArray(datos.mensajes)) return
      if (datos.conversacion.revision < this.snapshot.conversacion.revision) return
      const hilo = this.$refs.hilo
      const al_final = !hilo || hilo.scrollHeight - hilo.scrollTop - hilo.clientHeight < 100
      const anterior = this.snapshot.conversacion.espera_segundos ?? 10
      if (Number(this.espera) === anterior || this.snapshot.conversacion.revision === -1) this.espera = datos.conversacion.espera_segundos ?? 10
      this.snapshot = datos
      if (al_final) this.$nextTick(() => { if (this.$refs.hilo) this.$refs.hilo.scrollTop = this.$refs.hilo.scrollHeight })
    },
    cargar() {
      if (!this.lead_id || this.cargando || this.ocupado) return
      const lead = this.lead_id
      const vista = this.vista
      this.cargando = true
      api.get('/lead/' + lead + '/demo-chat', { silent_error: true }).then(r => { if (this.vigente(lead, vista)) { this.error = ''; this.aplicar(r.data, lead) } })
        .catch(e => { if (this.vigente(lead, vista)) this.error = e.response && e.response.status === 404 ? 'La conversación estará disponible cuando se actualice el admin.' : 'No se pudo actualizar el chat. Reintentamos en unos segundos.' })
        .finally(() => { if (this.vigente(lead, vista)) this.cargando = false })
    },
    accion(metodo, sufijo, datos = {}) {
      if (this.ocupado || !this.lead_id) return Promise.resolve(false)
      const lead = this.lead_id
      const vista = this.vista
      this.ocupado = true; this.error = ''
      return api.request({ method: metodo, url: '/lead/' + lead + '/demo-chat' + sufijo, data: datos })
        .then(r => { if (!this.vigente(lead, vista)) return false; this.aplicar(r.data, lead); return true })
        .catch(e => { if (this.vigente(lead, vista)) this.error = (e.response && e.response.data && e.response.data.message) || 'No se pudo guardar. Tu texto sigue acá para reintentar.'; return false })
        .finally(() => { if (this.vigente(lead, vista)) this.ocupado = false })
    },
    guardar_espera() {
      const segundos = Number(this.espera)
      if (this.espera === '' || !Number.isInteger(segundos) || segundos < 0 || segundos > 120) { this.error = 'Elegí una cantidad entera entre 0 y 120 segundos.'; return }
      this.espera_aviso = ''
      this.accion('put', '/configuracion', { espera_segundos: segundos }).then(ok => { if (ok) this.espera_aviso = 'Espera guardada: ' + segundos + ' s.' })
    },
    configurar(valor) { this.accion('put', '/configuracion', { auto_responder: valor }) },
    editar(mensaje) { this.editando = mensaje.id; this.texto = mensaje.contenido },
    cancelar_edicion() { this.editando = null; this.texto = '' },
    enviar() {
      if (!this.texto.trim() || this.ocupado) return
      const id = this.editando
      this.accion(id ? 'put' : 'post', '/mensajes' + (id ? '/' + id : ''), { contenido: this.texto.trim() })
        .then(ok => { if (ok) this.cancelar_edicion() })
    },
  },
}
</script>

<style scoped>
.demo-chat-operador { --dc-texto: #e8eafa; --dc-tenue: #9aabc7; color: var(--dc-texto); background: #0c1220; border: 1px solid #374968; border-radius: 22px; overflow: hidden; box-shadow: 0 18px 50px #02071420; }
.demo-chat-operador__cabecera { padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; background: radial-gradient(ellipse at 10% 0%, #5854b53b, transparent 60%); border-bottom: 1px solid #ffffff12; }
.demo-chat-operador__identidad { display: flex; align-items: center; gap: 12px; min-width: 0; }
.demo-chat-operador__identidad strong { display: block; font-size: 16px; }
.demo-chat-operador__identidad small { display: block; color: var(--dc-tenue); font-size: 12px; margin-top: 3px; }
.demo-chat-operador__orbe { background: linear-gradient(130deg,#80e5f8,#9d87fa); color: #111a37; width: 42px; height: 42px; border-radius: 14px; display: grid; place-items: center; font-size: 25px; flex-shrink: 0; box-shadow: 0 0 24px #8475ff45; }
.demo-chat-operador__switch { display: flex; gap: 8px; align-items: center; font-size: 12px; cursor: pointer; }
.demo-chat-operador__switch input { accent-color: #a291ff; width: 17px; height: 17px; }
.demo-chat-operador__espera { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 12px 24px; font-size: 12px; }
.demo-chat-operador__espera input { width: 75px; padding: 6px; color: var(--dc-texto); background: #172136; border: 1px solid #7785b3; border-radius: 6px; }
.demo-chat-operador__espera small { flex-basis: 100%; color: var(--dc-tenue); }
.demo-chat-operador__nota { padding: 12px 24px 0; color: var(--dc-tenue); font-size: 12px; line-height: 1.5; }
.demo-chat-operador__error { color: #ffd7b7; border: 1px solid #e6a36550; background: #78521e30; padding: 10px 15px; margin: 12px 20px; border-radius: 10px; font-size: 13px; }
.demo-chat-operador__hilo { min-height: 300px; height: min(58vh, 610px); overflow: auto; padding: 18px 24px; display: flex; flex-direction: column; gap: 18px; scroll-behavior: smooth; }
.demo-chat-operador__vacio { margin: auto; max-width: 340px; text-align: center; color: var(--dc-tenue); font-size: 14px; }
.demo-chat-operador__vacio > span { display: block; font-size: 46px; color: #a69afa; margin-bottom: 12px; }
.demo-chat-operador__vacio strong { display: block; color: var(--dc-texto); margin-bottom: 8px; }
.demo-chat-operador__mensaje { width: min(88%, 660px); padding: 15px 17px 10px; background: #172136; border: 1px solid #6c79ad24; border-radius: 4px 18px 18px; }
.demo-chat-operador__mensaje--lead { align-self: flex-end; background: #272548; border-color: #9886ea35; border-radius: 18px 4px 18px 18px; }
.demo-chat-operador__mensaje--borrador { border: 1px dashed #ad9ef5; background: #23213b; }
.demo-chat-operador__autor { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 11px; color: var(--dc-tenue); margin-bottom: 7px; }
.demo-chat-operador__autor strong { color: #b8c6ef; }
.demo-chat-operador__autor time { margin-left: auto; }
.demo-chat-operador__mensaje p { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 14px; line-height: 1.6; margin: 0; }
.demo-chat-operador__etiqueta { color: #d1bcff; }
.demo-chat-operador__acciones { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 12px; }
.demo-chat-operador button { border: 0; background: none; color: #afbde0; font-size: 12px; padding: 4px 0; cursor: pointer; }
.demo-chat-operador button:disabled { opacity: .4; cursor: default; }
.demo-chat-operador button:focus-visible, .demo-chat-operador input:focus-visible { outline: 2px solid #9beaff; outline-offset: 4px; }
.demo-chat-operador button.demo-chat-operador__publicar { color: #c8baff; font-weight: 700; }
.demo-chat-operador__video { background: #0d1527; padding: 8px; border-radius: 12px; margin-top: 12px; }
.demo-chat-operador__video video { width: 100%; max-height: 260px; display: block; border-radius: 8px; background: #060b13; }
.demo-chat-operador__video strong { display: block; font-size: 13px; margin: 8px 3px; }
.demo-chat-operador__video small { color: var(--dc-tenue); margin: 0 3px; font-size: 11px; }
.demo-chat-operador__progreso { height: 3px; border-radius: 6px; background: #27314d; margin: 8px 3px; overflow: hidden; }
.demo-chat-operador__progreso i { display: block; height: 100%; background: linear-gradient(90deg,#8c89ff,#70e2d6); transition: width .3s; }
.demo-chat-operador__pensando { display: flex; align-items: center; gap: 10px; color: #c3c6ef; font-size: 12px; }
.demo-chat-operador__orbita { width: 18px; height: 18px; border-radius: 6px; background: conic-gradient(#9d85ff,transparent,#7ff5e3,transparent,#9d85ff); animation: demo-orbita 2s linear infinite; }
.demo-chat-operador__compositor { padding: 12px 24px 20px; background: #0e1728; border-top: 1px solid #ffffff12; }
.demo-chat-operador__barra { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; color: var(--dc-tenue); font-size: 11px; margin-bottom: 9px; }
.demo-chat-operador__barra button { color: #b8a6ff; }
.demo-chat-operador__entrada { display: flex; align-items: flex-end; gap: 12px; border: 1px solid #7760c080; border-radius: 14px; padding: 10px 12px; background: #151e32; }
.demo-chat-operador__entrada:focus-within { border-color: #a995ff; box-shadow: 0 0 0 3px #9f80ff15; }
.demo-chat-operador__entrada textarea { flex: 1; width: 0; color: var(--dc-texto); border: 0; outline: 0; background: transparent; resize: vertical; min-height: 44px; max-height: 160px; font-size: 14px; }
.demo-chat-operador__entrada textarea::placeholder { color: #8090ad; }
.demo-chat-operador__entrada button { padding: 9px 13px; background: #a998f5; border-radius: 9px; color: #11172c; font-weight: 700; flex-shrink: 0; }
@keyframes demo-orbita { to { transform: rotate(360deg); } }
@media (max-width: 600px) { .demo-chat-operador__cabecera { flex-direction: column; align-items: flex-start; padding: 16px; } .demo-chat-operador__hilo { padding: 14px; } .demo-chat-operador__mensaje { width: 96%; } .demo-chat-operador__compositor { padding: 12px 14px; } .demo-chat-operador__espera { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 12px 24px; font-size: 12px; }
.demo-chat-operador__espera input { width: 75px; padding: 6px; color: var(--dc-texto); background: #172136; border: 1px solid #7785b3; border-radius: 6px; }
.demo-chat-operador__espera small { flex-basis: 100%; color: var(--dc-tenue); }
.demo-chat-operador__nota { padding-left: 16px; padding-right: 16px; } }
@media (prefers-reduced-motion: reduce) { .demo-chat-operador__orbita { animation: none; } .demo-chat-operador__hilo { scroll-behavior: auto; } }
</style>
