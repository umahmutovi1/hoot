import type { OutlineUnit } from './parse'

/**
 * Re-import merge (PRD "Ponovni uvoz"): a new outline is merged into the source's units by
 * `label`. Same label → structure is updated, while level, ratings, notes and sessions stay
 * (they are columns the merge never writes). New label → new unit. Missing label → archived,
 * never deleted. An archived unit whose label comes back is restored.
 */

export interface StoredUnit {
  id: string
  label: string | null
  title: string
  parentId: string | null
  pageStart: number | null
  pageEnd: number | null
  amount: number
  difficulty: number | null
  archived: boolean
}

export type MergeStatus = 'new' | 'changed' | 'unchanged' | 'restored'

export interface MergedUnit {
  id: string
  label: string
  title: string
  parentId: string | null
  position: number
  pageStart: number | null
  pageEnd: number | null
  amount: number
  difficulty: number | null
  status: MergeStatus
}

export interface MergeResult {
  /** Every unit of the new outline, in order; `position` is the index. */
  units: MergedUnit[]
  /** Active units whose label is gone; they get `archived_at`. */
  archive: StoredUnit[]
}

export function mergeOutline(
  existing: StoredUnit[],
  incoming: OutlineUnit[],
  newId: () => string,
): MergeResult {
  const byLabel = new Map(existing.filter((u) => u.label !== null).map((u) => [u.label!, u]))
  const ids = new Map<string, string>()
  for (const u of incoming) ids.set(u.label, byLabel.get(u.label)?.id ?? newId())

  const units = incoming.map((u, position): MergedUnit => {
    const old = byLabel.get(u.label)
    const parentId = u.parentLabel ? (ids.get(u.parentLabel) ?? null) : null
    const next = {
      id: ids.get(u.label)!,
      label: u.label,
      title: u.title,
      parentId,
      position,
      pageStart: u.pageStart,
      pageEnd: u.pageEnd,
      amount: u.amount,
      difficulty: u.difficulty,
    }
    let status: MergeStatus = 'new'
    if (old) {
      const changed =
        old.title !== next.title ||
        old.parentId !== next.parentId ||
        old.pageStart !== next.pageStart ||
        old.pageEnd !== next.pageEnd ||
        old.amount !== next.amount ||
        old.difficulty !== next.difficulty
      status = old.archived ? 'restored' : changed ? 'changed' : 'unchanged'
    }
    return { ...next, status }
  })

  const kept = new Set(incoming.map((u) => u.label))
  const archive = existing.filter((u) => !u.archived && (u.label === null || !kept.has(u.label)))
  return { units, archive }
}
