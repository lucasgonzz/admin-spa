<template>
  <div>
    <!-- ==================== LOG EN VIVO ==================== -->
    <div class="card border-secondary border-opacity-25 mb-3">
      <div
        class="card-header d-flex align-items-center gap-2 py-2"
        style="cursor: pointer; user-select: none"
        @click="log_expanded = !log_expanded"
      >
        <i class="bi bi-terminal text-secondary"></i>
        <span class="small fw-semibold">Log en vivo</span>
        <span
          v-if="installation.status === 'instalando'"
          class="spinner-border spinner-border-sm text-warning ms-1"
          role="status"
        ></span>
        <span v-if="log_lines.length" class="badge text-bg-secondary small ms-1">{{ log_lines.length }}</span>
        <i class="bi ms-auto" :class="log_expanded ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
      </div>
      <div v-if="log_expanded" class="card-body p-0">
        <div
          ref="log_container"
          class="deployment-log-panel border-0 rounded-bottom bg-dark text-light small p-2"
        >
          <div
            v-for="(entry, idx) in log_lines"
            :key="idx"
            class="deployment-log-line"
            :class="'text-' + log_level_class(entry.level)"
          >
            <span class="text-muted">[{{ entry.step }}]</span>
            {{ entry.line }}
          </div>
          <div v-if="!log_lines.length && installation.status === 'instalando'" class="text-muted">
            Esperando líneas de log…
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== INSTALACIÓN DEL SISTEMA ==================== -->
    <div class="card border-primary border-opacity-25">
      <div class="card-header d-flex align-items-center gap-2 bg-primary bg-opacity-10">
        <i class="bi bi-hdd-stack text-primary"></i>
        <h6 class="mb-0 fw-semibold">{{ is_esqueleto ? 'Esqueleto del subdominio' : 'Instalación del sistema' }}</h6>
      </div>
      <div class="card-body">
        <!--
          El checklist sale de checklist_items y no está escrito a mano: el esqueleto corre otras
          etapas, y una lista fija dejaría cuatro ítems en gris para siempre en cada esqueleto.
        -->
        <sub-task-item
          v-for="item in checklist_items"
          :key="item.key"
          :label="item.label"
          :status="get_step_status(item.key)"
        />
      </div>
    </div>
  </div>
</template>

<script>
import SubTaskItem from '@/components/update/extra-props/operations/SubTaskItem.vue'

/**
 * Orden real de las etapas del pipeline de instalación (ClientInstallation), calcado de
 * InstallationService::$steps en admin-api (prompt 396: sin run_user_setup).
 */
var LOG_STEPS_ORDER_COMPLETA = ['compile_spa', 'upload_spa', 'upload_api', 'write_env', 'finalize_api']

/**
 * Etapas del esqueleto, calcadas de InstallationService::$skeleton_steps. Son strings distintos
 * a propósito salvo write_env, que es literalmente la misma etapa reutilizada por el esqueleto.
 */
var LOG_STEPS_ORDER_ESQUELETO = ['prepare_dirs', 'upload_public', 'write_env', 'finalize_skeleton']

/**
 * Ítems del checklist de una instalación completa. install_composer no es una etapa del backend
 * (ver los marcadores de abajo), por eso está en esta lista y no en LOG_STEPS_ORDER_COMPLETA.
 */
var CHECKLIST_COMPLETA = [
  { key: 'compile_spa', label: 'Compilar SPA' },
  { key: 'upload_spa', label: 'Subir SPA al hosting' },
  { key: 'upload_api', label: 'Subir API al hosting' },
  { key: 'install_composer', label: 'Instalar composer' },
  { key: 'write_env', label: 'Escribir .env' },
  { key: 'finalize_api', label: 'Finalizar API' },
]

/**
 * Ítems del checklist del esqueleto. Sin "Instalar composer": el esqueleto no sube el código de
 * la API, así que no hay composer que correr.
 */
var CHECKLIST_ESQUELETO = [
  { key: 'prepare_dirs', label: 'Preparar directorios' },
  { key: 'upload_public', label: 'Subir public/' },
  { key: 'write_env', label: 'Escribir .env' },
  { key: 'finalize_skeleton', label: 'Verificar el esqueleto' },
]

/**
 * Las cuatro etapas de aprovisionamiento que van ADELANTE del pipeline de siempre, y las dos que
 * van al final. Calcadas de InstallationProvisioningSteps::build_steps_con_aprovisionamiento() en
 * admin-api, que arma exactamente esto:
 *
 *   completa  → check, sites, dns, db + [compile_spa … finalize_api] + cron, ssl
 *   esqueleto → check, sites, dns, db + [prepare_dirs … finalize_skeleton]
 *
 * 🔴 El orden no es cosmético y las dos listas no se pueden fusionar en una sola: get_step_status()
 * decide "completado" mirando si el paso SIGUIENTE del array ya tiene logs, así que un array
 * desalineado del backend deja etapas en gris para siempre. Y el cron y el certificado van al
 * final, después de finalize_api, no al principio con los otros cuatro: el cron necesita el
 * Kernel.php que recién sube upload_api, y Let's Encrypt necesita que el A record haya propagado
 * (los ~15 minutos de compile_spa + uploads son esa espera, gratis).
 *
 * 🔴 ESTE ARRAY ES LA MITAD DE UN CONTRATO Y LA OTRA MITAD ESTÁ EN admin-api. Si cambiás el orden
 * acá, cambialo también allá; si cambia allá, este archivo tiene que seguirlo. El candado del lado
 * que sí tiene tests es
 * `tests/Feature/AprovisionamientoDeHostingDelClienteTest::test_el_orden_de_los_pasos_es_el_contrato_con_el_operations_panel_del_spa()`,
 * que fija el array exacto en las cuatro combinaciones (real/esqueleto × con/sin aprovisionamiento)
 * y nombra este archivo. Acá no hay tests: esta mitad se rompe en silencio, y por eso el candado
 * está del otro lado.
 */
var PASOS_APROVISIONAMIENTO_INICIO = ['provision_check', 'provision_sites', 'provision_dns', 'provision_db']
var PASOS_APROVISIONAMIENTO_FINAL = ['provision_cron', 'provision_ssl']

/** Ítems de checklist de los cuatro pasos de aprovisionamiento iniciales. */
var CHECKLIST_APROVISIONAMIENTO_INICIO = [
  { key: 'provision_check', label: 'Verificar el hosting' },
  { key: 'provision_sites', label: 'Crear los subdominios' },
  { key: 'provision_dns', label: 'Apuntar el DNS' },
  { key: 'provision_db', label: 'Crear la base de datos' },
]

/** Ítems de checklist de los dos pasos finales (solo en la fila con instalación real). */
var CHECKLIST_APROVISIONAMIENTO_FINAL = [
  { key: 'provision_cron', label: 'Crear el cron' },
  { key: 'provision_ssl', label: 'Emitir el certificado' },
]

/**
 * "Instalar composer" no es una etapa propia del backend: ocurre dentro del tag upload_api.
 * Se detecta por estos dos marcadores de texto, verificados contra InstallationService.php
 * (líneas donde se loguean con tag 'upload_api').
 */
var COMPOSER_START_MARKER = 'Corriendo composer install en hosting'
var COMPOSER_DONE_MARKER = 'API lista en el hosting'

/**
 * Panel de operaciones de una instalación: log en vivo (colapsable, auto-scroll) +
 * checklist de las etapas visibles del pipeline que corresponde al kind de la fila y a si
 * aprovisiona el hosting (6 en una instalación completa, 4 en un esqueleto; +4 al principio y +2
 * al final con aprovisionamiento) vía SubTaskItem, con estado derivado
 * directamente del campo `step` de cada deployment_log (sin parsear texto con regex,
 * a diferencia del panel equivalente de actualización de la demo).
 */
export default {
  name: 'InstallationOperationsPanel',
  components: { SubTaskItem },
  props: {
    /** Objeto completo de la ClientInstallation (status, deployment_logs, etc). */
    installation: { type: Object, required: true },
  },
  data() {
    return {
      /** Controla si el panel de log está expandido o colapsado. */
      log_expanded: this.installation.status === 'instalando',
    }
  },
  computed: {
    /**
     * Líneas de deployment_logs de la instalación. Ya vienen estructuradas como
     * { step, line, level } desde el backend, no hace falta parsear texto plano.
     *
     * @returns {Array<{step: string, line: string, level: string}>}
     */
    log_lines() {
      return this.installation.deployment_logs || []
    },

    /**
     * ¿Esta fila es un esqueleto? El fallback es 'completa' porque las filas creadas antes de
     * que existiera el campo kind son todas completas.
     *
     * @returns {boolean}
     */
    is_esqueleto() {
      return this.installation.kind === 'esqueleto'
    },

    /**
     * ¿Esta fila aprovisiona el hosting antes de instalar?
     *
     * Se pregunta por el valor y no por un booleano porque en el backend la columna es una sola y
     * nullable: null = no aprovisionar (el comportamiento de siempre), 'shared_hosting' o 'vps' =
     * correr el bloque. Una fila vieja, o una creada por un SPA que todavía no manda el campo, lo
     * lee undefined y cae al pipeline de siempre, que es lo que corresponde.
     *
     * @returns {boolean}
     */
    aprovisiona_hosting() {
      return String(this.installation.provision_hosting_type || '').trim() !== ''
    },

    /**
     * Orden de las etapas del pipeline que corresponde a esta fila.
     *
     * @returns {Array<string>}
     */
    steps_order() {
      var base = this.is_esqueleto ? LOG_STEPS_ORDER_ESQUELETO : LOG_STEPS_ORDER_COMPLETA
      if (!this.aprovisiona_hosting) {
        return base
      }
      var order = PASOS_APROVISIONAMIENTO_INICIO.concat(base)
      /* El cron y el certificado son solo de la fila real: el esqueleto no tiene vendor/ ni
         sistema, y el backend ni siquiera agrega esas dos etapas a su pipeline. */
      return this.is_esqueleto ? order : order.concat(PASOS_APROVISIONAMIENTO_FINAL)
    },

    /**
     * Ítems del checklist que corresponden a esta fila.
     *
     * @returns {Array<{key: string, label: string}>}
     */
    checklist_items() {
      var base = this.is_esqueleto ? CHECKLIST_ESQUELETO : CHECKLIST_COMPLETA
      if (!this.aprovisiona_hosting) {
        return base
      }
      var items = CHECKLIST_APROVISIONAMIENTO_INICIO.concat(base)
      return this.is_esqueleto ? items : items.concat(CHECKLIST_APROVISIONAMIENTO_FINAL)
    },
  },
  watch: {
    /**
     * Abre el log automáticamente cuando la instalación pasa a 'instalando'.
     * @param {string} new_status
     * @returns {void}
     */
    'installation.status'(new_status) {
      if (new_status === 'instalando') {
        this.log_expanded = true
      }
    },
    /**
     * Hace scroll al final del log cada vez que llegan líneas nuevas (polling cada 3s
     * reemplaza installation.deployment_logs por un array nuevo, lo que dispara este watcher).
     * @returns {void}
     */
    log_lines() {
      if (this.log_expanded) {
        this.scroll_log_to_bottom()
      }
    },
  },
  methods: {
    /**
     * Indica si una etapa (tag de log) tiene al menos una línea registrada.
     * @param {string} step
     * @returns {boolean}
     */
    has_logs_for(step) {
      return this.log_lines.some(function (l) { return l.step === step })
    },
    /**
     * Líneas de log pertenecientes al tag upload_api (donde corre composer install).
     * @returns {Array}
     */
    upload_api_lines() {
      return this.log_lines.filter(function (l) { return l.step === 'upload_api' })
    },
    /**
     * Indica si el log ya contiene el marcador de inicio de composer install.
     * @returns {boolean}
     */
    composer_started() {
      return this.upload_api_lines().some(function (l) {
        return l.line.indexOf(COMPOSER_START_MARKER) !== -1
      })
    },
    /**
     * Indica si el log ya contiene el marcador de fin de composer install.
     * @returns {boolean}
     */
    composer_done() {
      return this.upload_api_lines().some(function (l) {
        return l.line.indexOf(COMPOSER_DONE_MARKER) !== -1
      })
    },
    /**
     * Determina el estado visual de un ítem del checklist a partir de los deployment_logs.
     *
     * @param {string} key - una key de CHECKLIST_COMPLETA o de CHECKLIST_ESQUELETO
     * @returns {string} - 'pending' | 'running' | 'completed' | 'failed'
     */
    get_step_status(key) {
      // Instalación completada: todas las etapas quedan en verde sin importar el detalle del log.
      if (this.installation.status === 'completada') {
        return 'completed'
      }

      // "Instalar composer" es un sub-paso derivado dentro de upload_api (ver marcadores arriba).
      // Solo existe en una instalación completa: el esqueleto no sube el código de la API.
      if (key === 'install_composer') {
        if (this.composer_done()) return 'completed'
        if (this.composer_started()) {
          return this.installation.status === 'fallida' ? 'failed' : 'running'
        }
        return 'pending'
      }

      // upload_api se da por completado en cuanto arrancó composer, porque eso es
      // lo último que hace ese step antes de pasar a escribir el .env.
      if (key === 'upload_api') {
        if (this.composer_started()) return 'completed'
        if (this.has_logs_for('upload_api')) {
          return this.installation.status === 'fallida' ? 'failed' : 'running'
        }
        return 'pending'
      }

      // El resto de las etapas se completa cuando el siguiente tag del pipeline ya tiene logs
      // propios (señal de que el step actual terminó bien).
      //
      // La última etapa (finalize_api en una completa, finalize_skeleton en un esqueleto) no
      // tiene un step siguiente que la confirme, así que cae sola en 'running'/'failed': el
      // early-return de 'completada' de arriba es el que cubre su caso feliz. Por eso el
      // recorrido es genérico y no hay un case por nombre de última etapa.
      var order = this.steps_order
      var idx = order.indexOf(key)
      var next = idx !== -1 ? order[idx + 1] : null
      var next_has_logs = next ? this.has_logs_for(next) : false
      if (!this.has_logs_for(key)) return 'pending'
      if (next_has_logs) return 'completed'
      return this.installation.status === 'fallida' ? 'failed' : 'running'
    },
    /**
     * Clase de color Bootstrap según nivel del log (info, success, warning, error).
     *
     * 🔴 'warning' se mapea a propósito y no es cosmético: hasta acá caía en el `return 'light'` y
     * se leía exactamente igual que un 'info'. El aprovisionamiento emite warnings que cambian lo
     * que hay que hacer después —"el sitio ya existía y no tengo su contraseña", "el .env no se
     * tocó"—, y un aviso de esos perdido entre cien líneas blancas no lo ve nadie.
     *
     * @param {string} level
     * @returns {string}
     */
    log_level_class(level) {
      if (level === 'error') return 'danger'
      if (level === 'warning') return 'warning'
      if (level === 'success') return 'success'
      return 'light'
    },
    /**
     * Mantiene visible la última línea del log al actualizar el polling.
     *
     * @returns {void}
     */
    scroll_log_to_bottom() {
      var self = this
      self.$nextTick(function () {
        var el = self.$refs.log_container
        if (el) {
          el.scrollTop = el.scrollHeight
        }
      })
    },
  },
}
</script>

<style scoped>
/* Panel de log en vivo, calcado del equivalente en demo_update/extra-props/OperationsPanel.vue */
.deployment-log-panel {
  max-height: 260px;
  overflow-y: auto;
  font-family: ui-monospace, monospace;
  font-size: 0.75rem;
  line-height: 1.35;
  border-radius: 0 0 0.375rem 0.375rem;
}
.deployment-log-line {
  white-space: pre-wrap;
  word-break: break-word;
  margin-bottom: 0.15rem;
}
</style>
