import { secciones_de_cuenta, seccion_de_cuenta_por_defecto } from '@/utils/solo_leads'

/**
 * Definición de secciones navegables en la vista Cuenta.
 * Cada ítem tiene id (hash en URL), etiqueta visible y grupo opcional para agrupar en la barra lateral.
 */
export const ACCOUNT_SECTIONS = [
  {
    id: 'preferences',
    label: 'Preferencias',
    group: null,
  },
  {
    id: 'pwa-install',
    label: 'Instalar aplicación',
    group: null,
  },
  {
    id: 'push-notifications',
    label: 'Notificaciones push',
    group: null,
  },
  /*
   * Va en su propio grupo y no dentro de «Soporte» porque gobierna los DOS números: el principal, del
   * que dependen tanto los leads como el soporte, y el del asistente de los dueños. Queda pegada a
   * Soporte a propósito: el interruptor que decide si un WhatsApp abre ticket vive en «IA de soporte»,
   * dos ítems más abajo.
   */
  {
    id: 'whatsapp-numeros',
    label: 'Números de WhatsApp',
    group: 'WhatsApp',
  },
  {
    id: 'support-alert-settings',
    label: 'Alertas de soporte',
    group: 'Soporte',
  },
  {
    id: 'support-ai-settings',
    label: 'IA de soporte',
    group: 'Soporte',
  },
  {
    id: 'agent-identity',
    label: 'Identidad del agente',
    group: 'Leads y ventas',
  },
  {
    id: 'lead-demo-settings',
    label: 'Configuración de demos',
    group: 'Leads y ventas',
  },
  {
    id: 'lead-whatsapp-onboarding',
    label: 'WhatsApp leads',
    group: 'Leads y ventas',
  },
  {
    id: 'followup-rules',
    label: 'Reglas de seguimiento',
    group: 'Leads y ventas',
  },
  {
    id: 'followup-templates',
    label: 'Plantillas de seguimiento WhatsApp',
    group: 'Leads y ventas',
  },
  {
    id: 'protocol-entries',
    label: 'Protocolo de ventas',
    group: 'Leads y ventas',
  },
  {
    id: 'ai-system-prompt',
    label: 'System Prompt IA',
    group: 'Leads y ventas',
  },
  {
    id: 'agent-prompt-sync',
    label: 'Prompts desde GitHub',
    group: 'Leads y ventas',
  },
  {
    id: 'contract-signature',
    label: 'Firma del contrato',
    group: 'Leads y ventas',
  },
  {
    id: 'cotizador-settings',
    label: 'Cotizador de sistemas',
    group: 'Leads y ventas',
  },
  {
    id: 'precios-vigentes',
    label: 'Precios vigentes',
    group: 'Leads y ventas',
  },
  {
    id: 'task-templates',
    label: 'Plantillas de tareas',
    group: 'Operaciones',
  },
  {
    id: 'implementation-settings',
    label: 'Implementaciones',
    group: 'Operaciones',
  },
]

/**
 * Ids válidos para /cuenta#... (compatibilidad con rutas antiguas y navegación interna).
 *
 * @type {string[]}
 */
export const ACCOUNT_SECTION_IDS = ACCOUNT_SECTIONS.map(function (section) {
  return section.id
})

/**
 * Sección por defecto cuando la URL no trae hash o el hash no es reconocido.
 *
 * @type {string}
 */
export const ACCOUNT_DEFAULT_SECTION_ID = 'preferences'

/**
 * Resuelve un id de sección desde el hash de la ruta.
 *
 * El perfil «Sólo Leads» (misión embudo-whatsapp-precios, E5) sólo tiene dos secciones: un hash que
 * apunta a otra (o ninguno) cae en la sección por defecto de su perfil, no en «Preferencias».
 *
 * @param {string|null|undefined} hash Hash de vue-router (con o sin # inicial).
 * @param {Object|null|undefined} admin Perfil admin (opcional); sin él se asume un admin normal.
 * @returns {string} Id de sección válido o el default.
 */
export function resolve_account_section_from_hash(hash, admin) {
  const raw = (hash || '').replace(/^#/, '')
  /** Ids de las secciones que este admin puede ver. */
  const ids_visibles = secciones_de_cuenta(admin, ACCOUNT_SECTIONS).map(function (section) {
    return section.id
  })
  if (raw && ids_visibles.indexOf(raw) !== -1) {
    return raw
  }
  return seccion_de_cuenta_por_defecto(admin)
}
