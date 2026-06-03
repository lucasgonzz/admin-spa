/** Etiquetas de deployment_status en ClientVersionUpgrade. */
export const DEPLOYMENT_STATUS_LABELS = {
  running: 'En curso',
  paused: 'Pausado (post-cierre)',
  paused_post_tasks: 'Pausado (configurar sistema)',
  completed: 'Completado',
  failed: 'Fallido',
}

/** Badge Bootstrap para deployment_status. */
export const DEPLOYMENT_STATUS_BADGE = {
  running: 'warning',
  paused: 'info',
  paused_post_tasks: 'info',
  completed: 'success',
  failed: 'danger',
}

/** Estados en los que no se puede iniciar otro deploy. */
export const DEPLOYMENT_ACTIVE_STATUSES = ['running', 'paused', 'paused_post_tasks']

/**
 * Orden canónico de las etapas del pipeline de deployment.
 * Se usa para derivar el estado de cada etapa a partir de los logs existentes.
 */
export const DEPLOYMENT_STEP_ORDER = [
  'compile_spa',
  'upload_spa',
  'upload_api',
  'run_migrations',
  'pause_for_crons',
  'run_seeders',
  'run_commands',
  'pause_for_post_tasks',
  'update_default_version',
  'complete',
]

/**
 * Deriva el estado visual de una etapa del deployment basándose en los logs y el estado global.
 * Posibles valores: 'pending' | 'running' | 'completed' | 'failed'
 *
 * @param {string} step_name - Nombre de la etapa (ej: 'compile_spa', 'upload_api')
 * @param {Array} deployment_logs - Array de líneas de log ({ step, line, level })
 * @param {string|null} deployment_status - Estado global del deployment
 * @returns {string}
 */
export function get_step_status(step_name, deployment_logs, deployment_status) {
  /* Conjunto de etapas que tienen al menos una línea de log. */
  var steps_with_logs = {}
  deployment_logs.forEach(function (log_line) {
    steps_with_logs[log_line.step] = true
  })

  /* Sin logs para esta etapa → aún no empezó. */
  if (!steps_with_logs[step_name]) {
    return 'pending'
  }

  /* Si el deployment terminó correctamente, toda etapa con logs está completada. */
  if (deployment_status === 'completed') {
    return 'completed'
  }

  /* Pausa tras seeders/comandos: etapas previas a update_default_version están completadas. */
  if (deployment_status === 'paused_post_tasks') {
    var config_step_index = DEPLOYMENT_STEP_ORDER.indexOf('update_default_version')
    var current_step_index = DEPLOYMENT_STEP_ORDER.indexOf(step_name)
    if (current_step_index >= 0 && current_step_index < config_step_index) {
      return 'completed'
    }
    if (step_name === 'update_default_version') {
      return steps_with_logs[step_name] ? 'completed' : 'pending'
    }
  }

  /* Si hay logs de alguna etapa posterior en el orden → esta etapa se completó. */
  var step_index = DEPLOYMENT_STEP_ORDER.indexOf(step_name)
  var has_later_logs = false
  for (var i = step_index + 1; i < DEPLOYMENT_STEP_ORDER.length; i++) {
    if (steps_with_logs[DEPLOYMENT_STEP_ORDER[i]]) {
      has_later_logs = true
      break
    }
  }
  if (has_later_logs) {
    return 'completed'
  }

  /* Si el deployment falló y no hay etapas posteriores, esta etapa falló. */
  if (deployment_status === 'failed') {
    return 'failed'
  }

  /* Deployment activo (running) y esta es la última etapa con logs → en curso. */
  if (deployment_status === 'running') {
    return 'running'
  }

  /* Pausa pre-cierre: run_seeders/comandos aún no iniciados → pending si no hay logs posteriores. */
  if (deployment_status === 'paused') {
    var seeders_index = DEPLOYMENT_STEP_ORDER.indexOf('run_seeders')
    var step_idx = DEPLOYMENT_STEP_ORDER.indexOf(step_name)
    if (step_idx >= seeders_index) {
      return 'pending'
    }
  }

  /* Tiene logs, no hay etapas posteriores, no está activo ni falló → se considera completado. */
  return 'completed'
}
