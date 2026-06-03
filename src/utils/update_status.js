/** Transiciones de estado válidas para ClientVersionUpgrade. */
export const STATUS_FLOW = {
  pendiente: 'listo_para_actualizar',
  listo_para_actualizar: 'actualizandose',
  actualizandose: null,
  terminada: null,
  fallida: null,
}

export const STATUS_LABELS = {
  pendiente: 'Pendiente',
  listo_para_actualizar: 'Listo para actualizar',
  actualizandose: 'Actualizándose',
  terminada: 'Terminada',
  fallida: 'Fallida',
}

/** Variante de Bootstrap 5 para el badge de estado. */
export const STATUS_BADGE = {
  pendiente: 'secondary',
  listo_para_actualizar: 'info',
  actualizandose: 'warning',
  terminada: 'success',
  fallida: 'danger',
}

/** Pasos del proceso de actualización, con grupo pre/post cierre del negocio. */
export const STEPS = [
  {
    key: 'sistema_actualizado_at',
    label: 'Sistema actualizado',
    group: 'pre',
    hint: 'Compilar y subir SPA + API del cliente',
  },
  {
    key: 'migraciones_corridas_at',
    label: 'Migraciones corridas',
    group: 'pre',
    hint: 'Ejecutar las migraciones pendientes',
  },
  {
    key: 'crons_supervisor_at',
    label: 'Crons / Supervisor configurados',
    group: 'post',
    hint: 'Realizar después del cierre del negocio',
  },
  {
    key: 'seeders_ejecutados_at',
    label: 'Seeders ejecutados',
    group: 'post',
    hint: 'Ver tab Seeders para detalle',
  },
  {
    key: 'comandos_ejecutados_at',
    label: 'Comandos ejecutados',
    group: 'post',
    hint: 'Ver tab Comandos para detalle',
  },
  {
    key: 'sistema_configurado_at',
    label: 'Sistema configurado',
    group: 'post',
    hint: 'Cambio de URL / versión por defecto. Disparar sincronización al cliente desde el botón superior.',
  },
]
