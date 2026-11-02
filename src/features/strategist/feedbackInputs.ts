import type { Feedback } from './feedback'

export function feedbackAction(row: Feedback): Record<string, unknown> | null {
  const payload = row.payload
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const action = payload.action
  return action && typeof action === 'object' && !Array.isArray(action) ? action : null
}
/** Latest decision wins, including a later rejection or 'not useful'. */
export function activeDecisions(rows: Feedback[]) {
  const latest = new Map<string, Feedback>()
  for (const row of [...rows].sort(
    (a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
  )) {
    const key = row.insight_id ?? row.candidate_id!
    if (!latest.has(key)) latest.set(key, row)
  }
  return [...latest.values()].filter((r) => r.status === 'accepted')
}

export function acceptedThisWeek(rows: Feedback[], week: string) {
  const keys = new Set<string>()
  for (const row of rows) {
    const p = row.payload
    if (
      row.status === 'accepted' &&
      p &&
      typeof p === 'object' &&
      !Array.isArray(p) &&
      p.week === week &&
      feedbackAction(row)
    )
      keys.add(row.insight_id ?? row.candidate_id!)
  }
  return keys.size
}
