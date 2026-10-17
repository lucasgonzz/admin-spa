import { markRaw } from 'vue'
import LeadExtraProps from '@/components/lead/extra-props/Index.vue'
import LeadResumenTab from '@/components/lead/resumen/Index.vue'
import LeadContractTab from '@/components/lead/contract/Index.vue'
import LeadDemoTab from '@/components/lead/demo/Index.vue'
import SubjectPipelinesTab from '@/components/pipeline/SubjectPipelinesTab.vue'

/**
 * Definición compartida del modal del lead (misión flujo-lead-landing-closer, 17/10/2026).
 *
 * El `ModelModal` genérico del lead se monta en dos lugares —`views/Leads.vue` y
 * `views/CloserPanel.vue`— y los dos tienen que mostrar EL MISMO modal: las mismas pestañas extra,
 * en el mismo orden, y con el grupo "Demo" del meta oculto detrás de la solapa Demo propia. Hasta
 * hoy la definición vivía solo en `Leads.vue` y el closer montaba el modal pelado, así que desde el
 * panel del closer se veía el grupo Demo viejo (con depósitos y listas) y no la solapa nueva.
 *
 * Vive en un `.js` y no en un `.vue` porque no pinta nada: son datos y una función.
 */

/**
 * Pestañas extra del modal del lead. Fuera de cualquier `data()` para no recrear el array por
 * instancia. `markRaw` evita que Vue 3 envuelva la definición del componente en un Proxy (warning
 * en consola y `<component :is>` puede dejar de resolver bien, afectando el modal al guardar).
 *
 * @type {Array<{ key: string, label: string, component: Object }>}
 */
export const lead_model_extra_tabs = [
  {
    key: 'resumen',
    label: 'Resumen',
    component: markRaw(LeadResumenTab),
  },
  {
    key: 'extra',
    label: 'Operaciones',
    component: markRaw(LeadExtraProps),
  },
  {
    /* Solapa Demo propia: Configuración, Videos, Links y Formulario en sub-solapas. Reemplaza al
       grupo "Demo" del meta, que el form genérico dibujaba como una sola grilla de campos; ese
       grupo se oculta con `ocultar_grupo_demo_del_meta`. */
    key: 'demo',
    label: 'Demo',
    component: markRaw(LeadDemoTab),
  },
  {
    key: 'contract',
    label: 'Contrato',
    component: markRaw(LeadContractTab),
  },
  {
    /* Oportunidades del lead en los pipelines del CRM (misión pipelines-crm, 27/9/2026). La
       pestaña deduce que el sujeto es un lead del `model_name` que le pasa el modal. */
    key: 'pipelines',
    label: 'Pipelines',
    component: markRaw(SubjectPipelinesTab),
  },
]

/**
 * Orden de pestañas del modal de lead: extras intercalados con el grupo Basico del meta.
 * Pipelines va al final: es la mirada comercial de campañas, no el día a día del lead.
 *
 * @type {string[]}
 */
export const lead_model_properties_nav_order = [
  'extra:resumen',
  'extra:extra',
  'extra:demo',
  'group:Basico',
  'extra:contract',
  'extra:pipelines',
]

/**
 * Meta del lead para el modal, con el grupo "Demo" OCULTO.
 *
 * La solapa Demo es un componente propio (`extra:demo`), pero el meta sigue declarando el grupo
 * con sus campos, y el modal genérico pinta una pestaña por cada grupo con campos visibles: sin
 * esto habría dos pestañas "Demo", la nueva y la grilla vieja al final. Se les pone `show: false`
 * en vez de sacarlos del array a propósito: `build_draft()` recorre `all_properties` para
 * normalizar fechas (`demo_date` es `day`) y asegurar cada clave en el borrador, y eso tiene que
 * seguir pasando para que la solapa nueva escriba en `draft` y el Guardar del modal lo mande igual
 * que antes.
 *
 * Devuelve copias de las filas que cambia; las demás son las mismas referencias del store.
 *
 * @param {Array<Object>} props meta tal cual lo devuelve `meta/properties('lead')`
 * @returns {Array<Object>}
 */
export function ocultar_grupo_demo_del_meta(props) {
  let grupo_actual = null
  return (props || []).map(function (p) {
    if (!p) {
      return p
    }
    if (p.group_title && !p.key) {
      grupo_actual = p.group_title
      return p
    }
    if (grupo_actual === 'Demo' && p.show !== false) {
      return Object.assign({}, p, { show: false })
    }
    return p
  })
}
