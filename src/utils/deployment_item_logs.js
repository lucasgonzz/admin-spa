/**
 * Utilidades para extraer líneas de consola de deployment_logs
 * asociadas a un seeder o comando concreto del upgrade.
 */
import {
  resolve_update_command_text,
  resolve_update_seeder_command_text,
} from '@/utils/deployment_run_command_resolver'

/**
 * Filtra logs de un paso del deployment.
 *
 * @param {Array} deployment_logs
 * @param {string} step_name
 * @returns {Array}
 */
function filter_step_logs(deployment_logs, step_name) {
  return deployment_logs.filter(function (log_line) {
    return log_line.step === step_name
  })
}

/**
 * Indica si una línea corresponde al inicio de otro seeder distinto al buscado.
 *
 * @param {string} line
 * @param {string} seeder_class
 * @param {string} custom_command
 * @param {string} resolved_command
 * @returns {boolean}
 */
function is_other_seeder_start_line(line, seeder_class, custom_command, resolved_command) {
  if (line.indexOf('Corriendo seeder:') !== 0) {
    return false
  }
  if (resolved_command) {
    var running_seeder = line.replace('Corriendo seeder:', '').trim()
    if (running_seeder === resolved_command) {
      return false
    }
  }
  if (seeder_class && line.indexOf(seeder_class) !== -1) {
    return false
  }
  if (custom_command && line.indexOf(custom_command) !== -1) {
    return false
  }
  return true
}

/**
 * Indica si una línea marca el fin del bloque de un seeder concreto.
 *
 * @param {string} line
 * @param {string} seeder_class
 * @returns {boolean}
 */
function is_seeder_end_line(line, seeder_class) {
  if (!seeder_class) {
    return false
  }
  if (line.indexOf('Seeder completado: ' + seeder_class) === 0) {
    return true
  }
  if (line.indexOf('Seeder fallido (' + seeder_class + ')') === 0) {
    return true
  }
  return false
}

/**
 * Indica si una línea corresponde al inicio de otro comando distinto al buscado.
 *
 * @param {string} line
 * @param {string} command_text
 * @returns {boolean}
 */
function is_other_command_start_line(line, command_text) {
  if (line.indexOf('Corriendo comando:') !== 0) {
    return false
  }
  var running_command = line.replace('Corriendo comando:', '').trim()
  return running_command !== command_text
}

/**
 * Indica si una línea marca el fin del bloque de un comando concreto.
 *
 * @param {string} line
 * @param {string} command_text
 * @returns {boolean}
 */
function is_command_end_line(line, command_text) {
  if (!command_text) {
    return false
  }
  if (line.indexOf('Comando completado: ' + command_text) === 0) {
    return true
  }
  if (line.indexOf('Comando fallido (' + command_text + ')') === 0) {
    return true
  }
  return false
}

/**
 * Extrae el bloque de logs de consola de un UpdateSeeder desde deployment_logs.
 * Incluye la línea de inicio, el comando remoto, la salida stdout/stderr y el cierre.
 *
 * @param {Object} seeder UpdateSeeder con relación version_seeder cargada
 * @param {Array} deployment_logs
 * @param {Object|null|undefined} client Cliente del upgrade (para emparejar comando resuelto).
 * @returns {Array<{step: string, line: string, level: string}>}
 */
export function extract_seeder_console_logs(seeder, deployment_logs, client) {
  var version_seeder = seeder && seeder.version_seeder ? seeder.version_seeder : null
  var seeder_class = version_seeder ? version_seeder.seeder_class || '' : ''
  var resolved_command = resolve_update_seeder_command_text(seeder, client)
  var custom_command = version_seeder && version_seeder.command ? version_seeder.command : ''
  var step_logs = filter_step_logs(deployment_logs, 'run_seeders')
  var start_index = -1
  var end_index = -1
  var i
  var line

  for (i = 0; i < step_logs.length; i++) {
    line = step_logs[i].line || ''
    if (line.indexOf('Corriendo seeder:') !== 0) {
      continue
    }
    if (seeder_class && line.indexOf(seeder_class) !== -1) {
      start_index = i
      break
    }
    if (resolved_command && line.indexOf('Corriendo seeder:') === 0) {
      var running_seeder = line.replace('Corriendo seeder:', '').trim()
      if (running_seeder === resolved_command) {
        start_index = i
        break
      }
    }
    if (custom_command && line.indexOf(custom_command) !== -1) {
      start_index = i
      break
    }
  }

  if (start_index === -1) {
    for (i = 0; i < step_logs.length; i++) {
      line = step_logs[i].line || ''
      if (is_seeder_end_line(line, seeder_class)) {
        return [step_logs[i]]
      }
    }
    return []
  }

  end_index = step_logs.length - 1
  for (i = start_index + 1; i < step_logs.length; i++) {
    line = step_logs[i].line || ''
    if (is_other_seeder_start_line(line, seeder_class, custom_command, resolved_command)) {
      end_index = i - 1
      break
    }
    if (is_seeder_end_line(line, seeder_class)) {
      end_index = i
      break
    }
    if (line === 'Seeders completados') {
      end_index = i - 1
      break
    }
  }

  return step_logs.slice(start_index, end_index + 1)
}

/**
 * Extrae el bloque de logs de consola de un UpdateCommand desde deployment_logs.
 *
 * @param {Object} command UpdateCommand con relación version_command cargada
 * @param {Array} deployment_logs
 * @param {Object|null|undefined} client Cliente del upgrade (para emparejar comando resuelto).
 * @returns {Array<{step: string, line: string, level: string}>}
 */
export function extract_command_console_logs(command, deployment_logs, client) {
  var command_text = resolve_update_command_text(command, client)
  var template_command = command && command.version_command ? command.version_command.command || '' : ''
  var step_logs = filter_step_logs(deployment_logs, 'run_commands')
  var start_index = -1
  var end_index = -1
  var i
  var line

  if (!command_text && !template_command) {
    return []
  }

  for (i = 0; i < step_logs.length; i++) {
    line = step_logs[i].line || ''
    if (line.indexOf('Corriendo comando:') !== 0) {
      continue
    }
    var running_command = line.replace('Corriendo comando:', '').trim()
    if (command_text && running_command === command_text) {
      start_index = i
      break
    }
    if (!command_text && template_command && running_command === template_command) {
      start_index = i
      break
    }
  }

  if (start_index === -1) {
    for (i = 0; i < step_logs.length; i++) {
      line = step_logs[i].line || ''
      if (is_command_end_line(line, command_text || template_command)) {
        return [step_logs[i]]
      }
    }
    return []
  }

  end_index = step_logs.length - 1
  var match_command = command_text || template_command
  for (i = start_index + 1; i < step_logs.length; i++) {
    line = step_logs[i].line || ''
    if (is_other_command_start_line(line, match_command)) {
      end_index = i - 1
      break
    }
    if (is_command_end_line(line, match_command)) {
      end_index = i
      break
    }
    if (line === 'Comandos completados') {
      end_index = i - 1
      break
    }
  }

  return step_logs.slice(start_index, end_index + 1)
}

/**
 * Clase Bootstrap de color según nivel del log.
 *
 * @param {string} level
 * @returns {string}
 */
export function deployment_log_level_class(level) {
  if (level === 'error') {
    return 'danger'
  }
  if (level === 'success') {
    return 'success'
  }
  return 'light'
}
