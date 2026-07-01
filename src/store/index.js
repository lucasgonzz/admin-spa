import { createStore } from 'vuex'
import auth from './auth'
import meta from './meta'
import general from './general'
import version from './version'
import client from './client'
import update from './update'
import lead from './lead'
import demo from './demo'
import followup_rule from './followup_rule'
import followup_template from './followup_template'
import protocol_entry from './protocol_entry'
import ai_system_prompt from './ai_system_prompt'
import support_ticket from './support_ticket'
import support_message from './support_message'
import task from './task'
import task_template from './task_template'
// Conteo de implementaciones listas para avanzar (badge Nav).
import implementation from './implementation'
// Conteo de implementaciones de ecommerce listas para avanzar (badge Nav).
import ecommerce_implementation from './ecommerce_implementation'
// Actualizaciones de demo: pipeline SPA + API sobre demos en hosting.
import demo_update from './demo_update'
// Panel operativo del closer (tres secciones de leads).
import closer from './closer'
// Módulo Agente: variantes A/B de mensajes de onboarding.
import agente from './agente'
// Grupos de BD compartida entre clientes (asignación desde panel de cliente).
import shared_database_group from './shared_database_group'

export default createStore({
  modules: {
    auth,
    meta,
    general,
    version,
    client,
    update,
    lead,
    demo,
    followup_rule,
    // Plantillas de seguimiento de WhatsApp (Meta) por estado y día.
    followup_template,
    protocol_entry,
    ai_system_prompt,
    support_ticket,
    support_message,
    task,
    // Plantillas de tareas automáticas para procesos internos.
    task_template,
    // Estado global de implementaciones (badge "listas para avanzar" en el Nav).
    implementation,
    // Estado global de implementaciones de ecommerce (badge en el Nav).
    ecommerce_implementation,
    // Actualizaciones de demo (pipeline SPA + API).
    demo_update,
    // Panel del closer: en curso, agendadas y seguimiento.
    closer,
    // Variantes de mensajes y métricas del módulo Agente.
    agente,
    // Grupos de BD compartida (endpoints JSON dedicados).
    shared_database_group,
  },
})
