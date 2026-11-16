/** Los contadores vienen del servidor: terminar un chat no acredita un merge. */
export function mission_groups(ticket) {
  const attention = ticket && ticket.support_attention
  const counts = (attention && attention.mission_counts) || (ticket && ticket.mission_counts)
  const missions = attention && attention.missions
  if (!counts && !Array.isArray(missions)) return null
  return [
    { type: 'bug', label: 'Correctivas' },
    { type: 'funcionalidad', label: 'Funcionalidades' },
  ].map((group) => {
    const rows = Array.isArray(missions) ? missions.filter((mission) => mission.mission_type === group.type) : []
    const count = counts && counts[group.type]
    const total = count ? valid_count(count.total) : rows.length
    const completed = count ? valid_count(count.completed) : rows.filter((mission) => mission.status === 'completed').length
    return { ...group, total, completed: Math.min(total, completed) }
  }).filter((group) => group.total > 0)
}

function valid_count(value) {
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= 0 ? number : 0
}

export function mission_count_title(group) {
  return group.total + ' creadas; ' + group.completed + ' terminadas con integración verificada.'
}

export function mission_status_label(mission) {
  return { pending: 'Por iniciar', started: 'En curso', completed: 'Terminada' }[mission.status] || 'Pendiente'
}
