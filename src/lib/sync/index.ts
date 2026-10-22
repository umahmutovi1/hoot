import Dexie, { type Table } from 'dexie'

/**
 * Offline queue (PRD "Offline"). Every write goes to IndexedDB first: the op is queued and the
 * row is mirrored locally, so the timer and the screens read it back after a closed tab or without
 * a network. `flush()` sends ops in order through a transport (Supabase in the app). IDs come from
 * the client, so sending an op twice is an idempotent upsert. A failed op stays in the queue with
 * its attempt count and blocks the ops behind it (a segment needs its session first); an op the
 * server rejects for good is parked as `failed` and skipped.
 */

export type Row = Record<string, unknown> & { id?: string }

export type Op =
  | { kind: 'upsert'; table: string; rows: Row[]; onConflict?: string }
  | { kind: 'update'; table: string; match: Record<string, unknown>; patch: Row }
  | { kind: 'delete'; table: string; match: Record<string, unknown> }
  /** A database function (e.g. `replace_plan`); `table` names what it writes, for the mirror. */
  | { kind: 'rpc'; table: string; fn: string; args: Record<string, unknown> }

export interface QueuedOp {
  seq?: number
  op: Op
  createdAt: number
  attempts: number
  nextAttemptAt: number
  failed: boolean
  lastError: string | null
}

export interface MirrorRow {
  /** `${table}:${id}` */
  key: string
  table: string
  id: string
  row: Row
  /** The local copy has changes that are not on the server yet. */
  pending: boolean
  /** Tombstone: deleted locally, the delete is not on the server yet. */
  deleted?: boolean
}

export class SyncDb extends Dexie {
  queue!: Table<QueuedOp, number>
  rows!: Table<MirrorRow, string>

  constructor(name = 'hoot') {
    super(name)
    this.version(1).stores({ queue: '++seq, nextAttemptAt', rows: 'key, table' })
  }
}

/** Thrown by a transport; `retry: false` = the server will never accept this op. */
export class SyncError extends Error {
  readonly retry: boolean

  constructor(message: string, retry: boolean) {
    super(message)
    this.retry = retry
  }
}

export interface Transport {
  send(op: Op): Promise<void>
}

/** 1 s, 2 s, 4 s … capped at 5 min. */
export function backoffMs(attempts: number): number {
  return Math.min(1000 * 2 ** Math.max(0, attempts - 1), 5 * 60_000)
}

function updatedAt(row: Row | undefined): number {
  const v = row?.updated_at
  return typeof v === 'string' ? Date.parse(v) : -Infinity
}

/**
 * Last-write-wins by `updated_at`: a local row with unsent changes always wins, otherwise the newer
 * of the two. Rows without `updated_at` (timer segments) are append-only: a closed copy beats an
 * open one, the earlier end wins.
 */
export function pickNewer(local: MirrorRow | undefined, remote: Row | undefined): Row | undefined {
  if (!local) return remote
  if (!remote || local.pending) return local.row
  if ('updated_at' in remote || 'updated_at' in local.row)
    return updatedAt(local.row) > updatedAt(remote) ? local.row : remote
  const a = local.row.ended_at as string | null | undefined
  const b = remote.ended_at as string | null | undefined
  if (!a) return remote
  if (!b) return local.row
  return Date.parse(a) <= Date.parse(b) ? local.row : remote
}

function matches(row: Row, match: Record<string, unknown>): boolean {
  return Object.entries(match).every(([k, v]) => row[k] === v)
}

export class SyncQueue {
  private flushing: Promise<void> | null = null
  private readonly listeners = new Set<() => void>()

  readonly db: SyncDb
  private readonly transport: Transport
  private readonly now: () => number

  constructor(db: SyncDb, transport: Transport, now: () => number = Date.now) {
    this.db = db
    this.transport = transport
    this.now = now
  }

  /** Called after every local change and every flush (screens re-read their queries). */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit() {
    for (const fn of this.listeners) fn()
  }

  /** Queues ops (in order) and applies them to the local mirror in one transaction. */
  async enqueue(...ops: Op[]): Promise<void> {
    const t = this.now()
    await this.db.transaction('rw', this.db.queue, this.db.rows, async () => {
      for (const op of ops) {
        await this.db.queue.add({
          op,
          createdAt: t,
          attempts: 0,
          nextAttemptAt: t,
          failed: false,
          lastError: null,
        })
        await this.applyLocal(op)
      }
    })
    this.emit()
  }

  private async applyLocal(op: Op) {
    if (op.kind === 'upsert') {
      for (const row of op.rows) {
        if (typeof row.id !== 'string') continue
        const key = `${op.table}:${row.id}`
        const prev = await this.db.rows.get(key)
        await this.db.rows.put({
          key,
          table: op.table,
          id: row.id,
          row: { ...prev?.row, ...row },
          pending: true,
        })
      }
      return
    }
    if (op.kind === 'rpc') return
    const rows = (await this.db.rows.where('table').equals(op.table).toArray()).filter((r) =>
      matches(r.row, op.match),
    )
    for (const r of rows) {
      if (op.kind === 'delete') await this.db.rows.put({ ...r, pending: true, deleted: true })
      else await this.db.rows.put({ ...r, row: { ...r.row, ...op.patch }, pending: true })
    }
    // A row deleted by id that was never mirrored still needs a tombstone, or the server copy
    // would come back in `merge()` until the delete is sent.
    const id = op.match.id
    if (op.kind === 'delete' && rows.length === 0 && typeof id === 'string')
      await this.db.rows.put({
        key: `${op.table}:${id}`,
        table: op.table,
        id,
        row: { id },
        pending: true,
        deleted: true,
      })
  }

  /** Local copies of one table, optionally filtered by equal fields. */
  async local(table: string, match: Record<string, unknown> = {}): Promise<MirrorRow[]> {
    const rows = await this.db.rows.where('table').equals(table).toArray()
    return rows.filter((r) => !r.deleted && matches(r.row, match))
  }

  /**
   * Server rows merged with the local mirror (last-write-wins), then filtered by `match`: a row the
   * server still has as open but this device already ended locally drops out of an "open" query.
   * Local rows with unsent changes are added.
   */
  async merge(table: string, remote: Row[], match: Record<string, unknown> = {}): Promise<Row[]> {
    const all = await this.db.rows.where('table').equals(table).toArray()
    const gone = new Set(all.filter((r) => r.deleted).map((r) => r.id))
    const local = new Map(all.filter((r) => !r.deleted).map((r) => [r.id, r]))
    const out: Row[] = []
    for (const r of remote) {
      const id = r.id as string
      if (gone.has(id)) continue
      const pick = pickNewer(local.get(id), r)
      local.delete(id)
      if (pick && matches(pick, match)) out.push(pick)
    }
    for (const r of local.values()) if (r.pending && matches(r.row, match)) out.push(r.row)
    return out
  }

  /**
   * Keeps server rows in the mirror, so a screen opened offline later (after a closed tab) still
   * has them. Rows with unsent local changes are left alone.
   */
  async remember(table: string, rows: Row[]): Promise<void> {
    await this.db.transaction('rw', this.db.rows, async () => {
      for (const row of rows) {
        if (typeof row.id !== 'string') continue
        const key = `${table}:${row.id}`
        const prev = await this.db.rows.get(key)
        if (prev?.pending) continue
        await this.db.rows.put({ key, table, id: row.id, row, pending: false })
      }
    })
  }

  /** When the next waiting op may be sent (null = nothing waits). */
  async nextAttemptAt(): Promise<number | null> {
    const next = (await this.db.queue.orderBy('seq').toArray()).find((q) => !q.failed)
    return next ? next.nextAttemptAt : null
  }

  /** Ops waiting to be sent (not counting parked failures). */
  async pendingCount(): Promise<number> {
    return (await this.db.queue.toArray()).filter((q) => !q.failed).length
  }

  /** Sends due ops in order; concurrent calls share one run. */
  flush(): Promise<void> {
    this.flushing ??= this.run().finally(() => {
      this.flushing = null
    })
    return this.flushing
  }

  private async run() {
    const sent = new Set<string>()
    for (;;) {
      const next = (await this.db.queue.orderBy('seq').toArray()).find((q) => !q.failed)
      if (!next) break
      if (next.nextAttemptAt > this.now()) break
      try {
        await this.transport.send(next.op)
        await this.db.queue.delete(next.seq!)
        for (const id of rowIds(next.op)) sent.add(`${next.op.table}:${id}`)
      } catch (e) {
        const retry = !(e instanceof SyncError) || e.retry
        const attempts = next.attempts + 1
        await this.db.queue.update(next.seq!, {
          attempts,
          failed: !retry,
          lastError: e instanceof Error ? e.message : String(e),
          nextAttemptAt: this.now() + backoffMs(attempts),
        })
        if (retry) break
      }
    }
    await this.settle(sent)
    this.emit()
  }

  /** Mirror rows with no op left in the queue are on the server now. */
  private async settle(sent: Set<string>) {
    const left = (await this.db.queue.toArray()).filter((q) => !q.failed)
    const queued = new Set<string>()
    for (const q of left) for (const id of rowIds(q.op)) queued.add(`${q.op.table}:${id}`)
    // An empty queue settles everything, also rows changed by ops that matched other fields.
    const keys =
      left.length === 0 ? await this.db.rows.filter((r) => r.pending).primaryKeys() : [...sent]
    for (const key of keys) {
      if (queued.has(key)) continue
      const row = await this.db.rows.get(key)
      if (!row) continue
      if (row.deleted) await this.db.rows.delete(key)
      else await this.db.rows.put({ ...row, pending: false })
    }
  }
}

function rowIds(op: Op): string[] {
  if (op.kind === 'rpc') return []
  if (op.kind === 'upsert') return op.rows.map((r) => r.id).filter((id) => typeof id === 'string')
  const id = op.match.id
  return typeof id === 'string' ? [id] : []
}
