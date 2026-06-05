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
 * @param {string|null|undefined} hash Hash de vue-router (con o sin # inicial).
 * @returns {string} Id de sección válido o el default.
 */
export function resolve_account_section_from_hash(hash) {
  const raw = (hash || '').replace(/^#/, '')
  if (raw && ACCOUNT_SECTION_IDS.indexOf(raw) !== -1) {
    return raw
  }
  return ACCOUNT_DEFAULT_SECTION_ID
}
