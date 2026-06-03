/**
 * Resuelve placeholders de seeders/comandos con datos del cliente del upgrade.
 * Sustituye {user_id?} por clients.user_id y prefija USER_ID= en tareas per_user.
 */

/**
 * Indica si el comando necesita user_id del cliente.
 *
 * @param {string} command
 * @param {string|null|undefined} run_scope
 * @returns {boolean}
 */
function command_requires_user_id(command, run_scope) {
  if (run_scope === 'per_user') {
    return true
  }
  return /\{user_id(\?)?\}/i.test(command)
}

/**
 * Prefija USER_ID= cuando el comando per_user no incluye ya el id como argumento.
 *
 * @param {string} command
 * @param {number} client_user_id
 * @returns {string}
 */
function maybe_prefix_user_id_env(command, client_user_id) {
  if (/^USER_ID=/i.test(command)) {
    return command
  }
  var user_id_pattern = new RegExp('\\s' + client_user_id + '(\\s|$)')
  if (user_id_pattern.test(command)) {
    return command
  }
  return 'USER_ID=' + client_user_id + ' ' + command
}

/**
 * Resuelve un comando plantilla para el cliente indicado.
 *
 * @param {string} command
 * @param {string|null|undefined} run_scope
 * @param {Object|null|undefined} client Cliente con user_id e id.
 * @returns {string}
 */
export function resolve_client_run_command(command, run_scope, client) {
  var resolved = (command || '').trim()
  if (!resolved) {
    return resolved
  }

  var client_user_id = client && client.user_id != null ? parseInt(client.user_id, 10) : null
  var client_id = client && client.id != null ? parseInt(client.id, 10) : null

  if (command_requires_user_id(resolved, run_scope) && (client_user_id === null || isNaN(client_user_id))) {
    return resolved
  }

  if (client_user_id !== null && !isNaN(client_user_id)) {
    resolved = resolved.split('{user_id?}').join(String(client_user_id))
    resolved = resolved.split('{user_id}').join(String(client_user_id))
  }

  if (client_id !== null && !isNaN(client_id)) {
    resolved = resolved.split('{client_id?}').join(String(client_id))
    resolved = resolved.split('{client_id}').join(String(client_id))
  }

  resolved = resolved.replace(/\s*\{[a-z0-9_]+\?\}/gi, '')
  resolved = resolved.replace(/\s+/g, ' ').trim()

  if (run_scope === 'per_user' && client_user_id !== null && !isNaN(client_user_id)) {
    resolved = maybe_prefix_user_id_env(resolved, client_user_id)
  }

  return resolved
}

/**
 * Comando shell de un VersionSeeder (custom command o db:seed por defecto).
 *
 * @param {Object|null|undefined} version_seeder
 * @returns {string}
 */
export function get_seeder_shell_command(version_seeder) {
  if (!version_seeder) {
    return ''
  }
  if (version_seeder.command) {
    return version_seeder.command
  }
  if (!version_seeder.seeder_class) {
    return ''
  }
  return 'php artisan db:seed --class=' + version_seeder.seeder_class + ' --force'
}

/**
 * Resuelve el comando de un UpdateCommand para el cliente del upgrade.
 *
 * @param {Object} update_command
 * @param {Object|null|undefined} client
 * @returns {string}
 */
export function resolve_update_command_text(update_command, client) {
  var version_command = update_command && update_command.version_command
    ? update_command.version_command
    : null
  if (!version_command || !version_command.command) {
    return ''
  }
  return resolve_client_run_command(
    version_command.command,
    version_command.run_scope || null,
    client
  )
}

/**
 * Resuelve el comando de un UpdateSeeder para el cliente del upgrade.
 *
 * @param {Object} update_seeder
 * @param {Object|null|undefined} client
 * @returns {string}
 */
export function resolve_update_seeder_command_text(update_seeder, client) {
  var version_seeder = update_seeder && update_seeder.version_seeder
    ? update_seeder.version_seeder
    : null
  var shell_command = get_seeder_shell_command(version_seeder)
  if (!shell_command) {
    return ''
  }
  return resolve_client_run_command(
    shell_command,
    version_seeder ? version_seeder.run_scope || null : null,
    client
  )
}
