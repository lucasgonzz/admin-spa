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
import protocol_entry from './protocol_entry'
import ai_system_prompt from './ai_system_prompt'
import support_ticket from './support_ticket'
import support_message from './support_message'
import task from './task'
import task_template from './task_template'
// Conteo de implementaciones listas para avanzar (badge Nav).
import implementation from './implementation'

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
    protocol_entry,
    ai_system_prompt,
    support_ticket,
    support_message,
    task,
    // Plantillas de tareas automáticas para procesos internos.
    task_template,
    // Estado global de implementaciones (badge "listas para avanzar" en el Nav).
    implementation,
  },
})
