<template>
  <tbody>
    <tr>
      <td>
        <small class="text-muted">{{ version_label }}</small>
      </td>
      <td>
        <div class="input-group input-group-sm">
          <input
            :id="input_id"
            type="text"
            class="form-control form-control-sm font-monospace"
            :value="command_text"
            readonly
          />
          <button
            type="button"
            class="btn btn-sm"
            :class="copied ? 'btn-success' : 'btn-outline-secondary'"
            title="Copiar y marcar como ejecutado"
            :disabled="loading"
            @click="copy_and_mark"
          >
            {{ copied ? 'Copiado' : 'Copiar' }}
          </button>
        </div>
      </td>
      <td>
        <small class="text-muted">{{ item.version_command ? item.version_command.description : '—' }}</small>
        <span
          v-if="item.version_command && item.version_command.run_manually"
          class="badge text-bg-warning ms-1"
          title="Ejecución manual: no corre por deployment automatizado"
        >Manual</span>
        <!-- Badge que indica si el comando se ejecuta una vez por BD o una vez por usuario/tenant -->
        <span
          v-if="item.version_command && item.version_command.run_scope"
          class="badge ms-1"
          :class="run_scope_badge_class"
          :title="run_scope_title"
        >{{ run_scope_label }}</span>
      </td>
      <td class="text-center">
        <span class="badge" :class="status_badge_class">{{ item.status }}</span>
      </td>
      <td>
        <small>{{ item.executed_at ? format_date(item.executed_at) : '—' }}</small>
        <div v-if="item.failure_notes">
          <small class="text-danger">{{ item.failure_notes }}</small>
        </div>
      </td>
      <td class="text-end text-nowrap">
        <template v-if="item.status !== 'fallido'">
          <button
            type="button"
            class="btn btn-sm btn-outline-danger"
            :disabled="loading"
            @click="show_fail_form = !show_fail_form"
          >
            Marcar fallido
          </button>
        </template>
        <template v-else>
          <button
            type="button"
            class="btn btn-sm btn-outline-success me-1"
            :disabled="loading"
            @click="$emit('mark', { id: item.id, status: 'exitoso' })"
          >
            Marcar exitoso
          </button>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            :disabled="loading"
            @click="$emit('mark', { id: item.id, status: 'pendiente' })"
          >
            Pendiente
          </button>
        </template>
      </td>
    </tr>
    <tr v-if="show_fail_form">
      <td colspan="6" class="bg-light py-2">
        <div class="d-flex gap-2 align-items-center flex-wrap">
          <input
            v-model="fail_notes"
            type="text"
            class="form-control form-control-sm"
            style="max-width: 350px"
            placeholder="Motivo del fallo (opcional)"
          />
          <button
            type="button"
            class="btn btn-sm btn-danger"
            :disabled="loading"
            @click="confirm_fail"
          >
            Confirmar fallo
          </button>
          <button type="button" class="btn btn-sm btn-link text-muted" @click="show_fail_form = false">
            Cancelar
          </button>
        </div>
      </td>
    </tr>
  </tbody>
</template>

<script>
import { resolve_update_command_text } from '@/utils/deployment_run_command_resolver'

/**
 * Fila de un UpdateCommand: muestra el comando Artisan, permite copiar
 * al portapapeles y marcar como exitoso, o marcar fallido/pendiente.
 */
export default {
  name: 'CommandRow',
  props: {
    item: { type: Object, required: true },
    /** Cliente del upgrade (user_id ComercioCity para resolver placeholders). */
    client: { type: Object, default: null },
    loading: { type: Boolean, default: false },
  },
  emits: ['mark'],
  data() {
    return {
      copied: false,
      show_fail_form: false,
      fail_notes: '',
    }
  },
  computed: {
    input_id() {
      return 'upd-command-' + this.item.id
    },
    command_text() {
      return resolve_update_command_text(this.item, this.client)
    },
    version_label() {
      return this.item.version_command && this.item.version_command.version
        ? this.item.version_command.version.version
        : '—'
    },
    status_badge_class() {
      if (this.item.status === 'exitoso') return 'bg-success'
      if (this.item.status === 'fallido') return 'bg-danger'
      return 'bg-secondary'
    },
    /**
     * Clase Bootstrap del badge de run_scope.
     * per_user → azul (la mayoría); per_database → gris (excepción).
     * @returns {string}
     */
    run_scope_badge_class() {
      const scope = this.item.version_command && this.item.version_command.run_scope
      if (scope === 'per_database') return 'text-bg-secondary'
      return 'text-bg-info'
    },
    /**
     * Etiqueta corta del run_scope para mostrar en el badge.
     * @returns {string}
     */
    run_scope_label() {
      const scope = this.item.version_command && this.item.version_command.run_scope
      if (scope === 'per_database') return 'Por BD'
      if (scope === 'per_user') return 'Por usuario'
      return scope || ''
    },
    /**
     * Texto descriptivo del run_scope para el tooltip del badge.
     * @returns {string}
     */
    run_scope_title() {
      const scope = this.item.version_command && this.item.version_command.run_scope
      if (scope === 'per_database') return 'Se ejecuta una sola vez por base de datos'
      if (scope === 'per_user') return 'Se debe ejecutar una vez por cada usuario/tenant'
      return ''
    },
  },
  methods: {
    format_date(val) {
      if (!val) return ''
      const d = new Date(val)
      return (
        d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
        ' ' +
        d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
      )
    },
    copy_and_mark() {
      const el = document.getElementById(this.input_id)
      if (!el || !el.value) return
      const self = this
      const on_copied = function () {
        self.copied = true
        setTimeout(function () {
          self.copied = false
        }, 1500)
        self.$emit('mark', { id: self.item.id, status: 'exitoso' })
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(el.value).then(on_copied).catch(function () {
          self.fallback_copy(el)
          on_copied()
        })
      } else {
        self.fallback_copy(el)
        on_copied()
      }
    },
    fallback_copy(el) {
      el.focus()
      el.select()
      el.setSelectionRange(0, 99999)
      try {
        document.execCommand('copy')
      } catch (e) {}
    },
    confirm_fail() {
      this.$emit('mark', { id: this.item.id, status: 'fallido', failure_notes: this.fail_notes })
      this.show_fail_form = false
      this.fail_notes = ''
    },
  },
}
</script>
