import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { backoffMs, pickNewer, SyncDb, SyncError, SyncQueue, type Op, type Row } from '.'

/** In-memory server: upsert by id, update/delete by match; can be switched offline. */
class FakeServer {
  tables = new Map<string, Map<string, Row>>()
  offline = false
  reject: ((op: Op) => boolean) | null = null
  sent: Op[] = []

  table(name: string) {
    let t = this.tables.get(name)
    if (!t) this.tables.set(name, (t = new Map()))
    return t
  }

  async send(op: Op) {
    if (this.offline) throw new TypeError('Failed to fetch')
    if (this.reject?.(op)) throw new SyncError('violates check constraint', false)
    this.sent.push(op)
    const t = this.table(op.table)
    if (op.kind === 'upsert') for (const r of op.rows) t.set(r.id!, { ...t.get(r.id!), ...r })
    else
      for (const [id, r] of t)
        if (Object.entries(op.match).every(([k, v]) => r[k] === v)) {
          if (op.kind === 'delete') t.delete(id)
          else t.set(id, { ...r, ...op.patch })
        }
  }
}

let db: SyncDb
let server: FakeServer
let clock: number
let queue: SyncQueue

beforeEach(() => {
  db = new SyncDb(`test-${crypto.randomUUID()}`)
  server = new FakeServer()
  clock = 1_000_000
  queue = new SyncQueue(db, server, () => clock)
})

afterEach(async () => {
  db.close()
  await db.delete()
})

const session = (id: string, extra: Row = {}): Op => ({
  kind: 'upsert',
  table: 'study_sessions',
  rows: [{ id, subject_id: 's', started_at: '2026-10-21T08:00:00Z', ended_at: null, ...extra }],
})

describe('SyncQueue', () => {
  it('mirrors a write locally before it is sent', async () => {
    server.offline = true
    await queue.enqueue(session('a'))
    await queue.flush()
    expect((await queue.local('study_sessions')).map((r) => r.id)).toEqual(['a'])
    expect(await queue.pendingCount()).toBe(1)
    expect(server.table('study_sessions').size).toBe(0)
  })

  it('sends in order once the network is back and settles the mirror', async () => {
    server.offline = true
    await queue.enqueue(session('a'), {
      kind: 'upsert',
      table: 'study_segments',
      rows: [{ id: 'g1', session_id: 'a', started_at: '2026-10-21T08:00:00Z', ended_at: null }],
    })
    await queue.flush()
    server.offline = false
    clock += backoffMs(1)
    await queue.flush()
    expect(server.sent.map((o) => o.table)).toEqual(['study_sessions', 'study_segments'])
    expect(await queue.pendingCount()).toBe(0)
    expect((await queue.local('study_sessions'))[0]!.pending).toBe(false)
  })

  it('is idempotent: the same op sent twice leaves one row', async () => {
    await queue.enqueue(session('a'), session('a', { focus: 2 }))
    await queue.flush()
    expect([...server.table('study_sessions').values()]).toHaveLength(1)
    expect(server.table('study_sessions').get('a')!.focus).toBe(2)
  })

  it('waits for the backoff before retrying', async () => {
    server.offline = true
    await queue.enqueue(session('a'))
    await queue.flush()
    server.offline = false
    await queue.flush()
    expect(server.sent).toHaveLength(0)
    clock += backoffMs(1)
    await queue.flush()
    expect(server.sent).toHaveLength(1)
  })

  it('counts attempts and keeps the error', async () => {
    server.offline = true
    await queue.enqueue(session('a'))
    for (let i = 0; i < 3; i++) {
      await queue.flush()
      clock += backoffMs(i + 1)
    }
    const [q] = await db.queue.toArray()
    expect(q!.attempts).toBe(3)
    expect(q!.lastError).toBe('Failed to fetch')
  })

  it('parks an op the server rejects for good and goes on', async () => {
    server.reject = (op) => op.kind === 'upsert' && op.rows[0]!.id === 'bad'
    await queue.enqueue(session('bad'), session('good'))
    await queue.flush()
    expect([...server.table('study_sessions').keys()]).toEqual(['good'])
    expect(await queue.pendingCount()).toBe(0)
    expect((await db.queue.toArray())[0]!.failed).toBe(true)
  })

  it('applies updates and deletes to the mirror', async () => {
    server.offline = true
    await queue.enqueue(session('a'), {
      kind: 'update',
      table: 'study_sessions',
      match: { id: 'a' },
      patch: { ended_at: '2026-10-21T09:00:00Z' },
    })
    expect((await queue.local('study_sessions'))[0]!.row.ended_at).toBe('2026-10-21T09:00:00Z')
    await queue.enqueue({ kind: 'delete', table: 'study_sessions', match: { id: 'a' } })
    expect(await queue.local('study_sessions')).toEqual([])
  })

  it('notifies subscribers on change', async () => {
    let calls = 0
    queue.subscribe(() => calls++)
    await queue.enqueue(session('a'))
    await queue.flush()
    expect(calls).toBe(2)
  })
})

describe('merge', () => {
  it('adds local rows the server does not have yet', async () => {
    server.offline = true
    await queue.enqueue(session('a'))
    const rows = await queue.merge('study_sessions', [{ id: 'b', ended_at: null }])
    expect(rows.map((r) => r.id).sort()).toEqual(['a', 'b'])
  })

  it('hides a row deleted locally until the delete is sent', async () => {
    server.offline = true
    await queue.enqueue({ kind: 'delete', table: 'study_sessions', match: { id: 'a' } })
    expect(await queue.merge('study_sessions', [{ id: 'a' }])).toEqual([])
    server.offline = false
    clock += backoffMs(1)
    await queue.flush()
    expect(await db.rows.count()).toBe(0)
  })

  it('filters by match', async () => {
    await queue.enqueue(session('a', { subject_id: 'x' }), session('b', { subject_id: 'y' }))
    const rows = await queue.merge('study_sessions', [], { subject_id: 'x' })
    expect(rows.map((r) => r.id)).toEqual(['a'])
  })
})

describe('pickNewer', () => {
  const mirror = (row: Row, pending = false) => ({ key: 'k', table: 't', id: 'a', row, pending })

  it('unsent local changes win', () => {
    const local = mirror({ id: 'a', updated_at: '2026-01-01T00:00:00Z', v: 1 }, true)
    expect(pickNewer(local, { id: 'a', updated_at: '2026-02-01T00:00:00Z', v: 2 })).toBe(local.row)
  })

  it('otherwise the newer updated_at wins', () => {
    const local = mirror({ id: 'a', updated_at: '2026-01-01T00:00:00Z', v: 1 })
    const remote = { id: 'a', updated_at: '2026-02-01T00:00:00Z', v: 2 }
    expect(pickNewer(local, remote)).toBe(remote)
    expect(pickNewer(mirror({ ...local.row, updated_at: '2026-03-01T00:00:00Z' }), remote)!.v).toBe(
      1,
    )
  })

  it('segments are append-only: the earlier end wins', () => {
    const open = mirror({ id: 'a', ended_at: null })
    const closed = { id: 'a', ended_at: '2026-10-21T09:00:00Z' }
    expect(pickNewer(open, closed)).toBe(closed)
    const earlier = mirror({ id: 'a', ended_at: '2026-10-21T08:30:00Z' })
    expect(pickNewer(earlier, closed)).toBe(earlier.row)
  })
})

describe('backoffMs', () => {
  it('doubles from 1 s and caps at 5 min', () => {
    expect([1, 2, 3].map(backoffMs)).toEqual([1000, 2000, 4000])
    expect(backoffMs(30)).toBe(300_000)
  })
})
