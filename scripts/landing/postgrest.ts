// A tiny in-memory PostgREST for the landing screenshots: enough of the query language that the
// real app (supabase-js) reads and writes against it as if it were the project. Writes stick, so
// the app's own `plan()` fills `plan_blocks` from the seeded subjects and sources.

export type Row = Record<string, unknown>

export interface Reply {
  status: number
  body: unknown
  headers?: Record<string, string>
}

const singular = (table: string) => table.replace(/s$/, '')

/** `a,b,child(x,y),alias:other!inner(*)` → top-level columns and embeds. */
function parseSelect(select: string): {
  columns: string[]
  embeds: { name: string; inner: string }[]
} {
  const columns: string[] = []
  const embeds: { name: string; inner: string }[] = []
  let depth = 0
  let start = 0
  const parts: string[] = []
  for (let i = 0; i <= select.length; i++) {
    const c = select[i]
    if (c === '(') depth++
    if (c === ')') depth--
    if ((c === ',' && depth === 0) || i === select.length) {
      parts.push(select.slice(start, i).trim())
      start = i + 1
    }
  }
  for (const p of parts) {
    const open = p.indexOf('(')
    if (open < 0) {
      if (p) columns.push(p)
      continue
    }
    const head = p.slice(0, open).split(':').pop()!.split('!')[0]!
    embeds.push({ name: head, inner: p.slice(open + 1, -1) })
  }
  return { columns, embeds }
}

function parseValue(raw: string): unknown {
  if (raw === 'null') return null
  if (raw === 'true') return true
  if (raw === 'false') return false
  return raw
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' || typeof b === 'number') return Number(a) - Number(b)
  return String(a).localeCompare(String(b))
}

const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** One `col=op.value` filter; unknown operators keep the row. */
function test(row: Row, col: string, expr: string): boolean {
  const negate = expr.startsWith('not.')
  if (negate) expr = expr.slice(4)
  const dot = expr.indexOf('.')
  const op = expr.slice(0, dot)
  // URLSearchParams already decoded it; a literal `%` (ilike) is not an escape.
  const raw = safeDecode(expr.slice(dot + 1))
  const v = row[col]
  let ok: boolean
  switch (op) {
    case 'eq':
      ok = String(v) === raw
      break
    case 'neq':
      ok = String(v) !== raw
      break
    case 'gt':
      ok = v !== null && v !== undefined && compare(v, raw) > 0
      break
    case 'gte':
      ok = v !== null && v !== undefined && compare(v, raw) >= 0
      break
    case 'lt':
      ok = v !== null && v !== undefined && compare(v, raw) < 0
      break
    case 'lte':
      ok = v !== null && v !== undefined && compare(v, raw) <= 0
      break
    case 'is':
      ok = raw === 'null' ? v === null || v === undefined : v === parseValue(raw)
      break
    case 'in': {
      const list = raw
        .replace(/^\(|\)$/g, '')
        .split(',')
        .map((x) => x.replace(/^"|"$/g, ''))
      ok = list.includes(String(v))
      break
    }
    default:
      ok = true
  }
  return negate ? !ok : ok
}

const RESERVED = new Set([
  'select',
  'order',
  'limit',
  'offset',
  'on_conflict',
  'columns',
  'or',
  'and',
])

export class PostgrestMock {
  readonly tables = new Map<string, Row[]>()

  private readonly userId: string
  private readonly now: () => string
  /** Column defaults of a new row (`defaults.ts`). */
  private readonly blank: (table: string) => Row
  /** Functions the app calls through `rpc/<name>`; unknown ones return null. */
  private readonly rpcs: Record<string, (db: PostgrestMock, args: Row) => unknown>

  constructor(
    seed: Record<string, Row[]>,
    userId: string,
    now: () => string,
    blank: (table: string) => Row = () => ({}),
    rpcs: Record<string, (db: PostgrestMock, args: Row) => unknown> = {},
  ) {
    this.userId = userId
    this.now = now
    this.blank = blank
    this.rpcs = rpcs
    for (const [t, rows] of Object.entries(seed))
      this.tables.set(
        t,
        rows.map((r) => ({ ...r })),
      )
  }

  rows(table: string): Row[] {
    let rows = this.tables.get(table)
    if (!rows) this.tables.set(table, (rows = []))
    return rows
  }

  private filter(table: string, params: URLSearchParams): Row[] {
    return this.rows(table).filter((row) => {
      for (const [k, v] of params)
        if (!RESERVED.has(k) && !k.includes('.') && !test(row, k, v)) return false
      return true
    })
  }

  private embed(table: string, rows: Row[], select: string): Row[] {
    const { columns, embeds } = parseSelect(select)
    return rows.map((row) => {
      const out: Row =
        columns.length === 0 || columns.includes('*')
          ? { ...row }
          : Object.fromEntries(columns.map((c) => [c, row[c] ?? null]))
      if (!columns.includes('id') && columns.length > 0 && !columns.includes('*')) out.id = row.id
      for (const e of embeds) {
        const children = this.rows(e.name)
        const fks = [`${singular(table)}_id`, `${singular(table.split('_').pop()!)}_id`]
        const fk = fks.find((k) => children.some((c) => k in c))
        if (fk) {
          out[e.name] = this.embed(
            e.name,
            children.filter((c) => c[fk] === row.id),
            e.inner,
          )
          continue
        }
        const own = `${singular(e.name)}_id`
        const parent = children.find((c) => c.id === row[own])
        out[e.name] = parent ? this.embed(e.name, [parent], e.inner)[0]! : null
      }
      return out
    })
  }

  /** Inserts rows as the database would (defaults, owner, timestamps). */
  insert(table: string, rows: Row[]) {
    for (const r of rows) this.rows(table).push(this.withDefaults(table, r))
  }

  private withDefaults(table: string, row: Row): Row {
    const at = this.now()
    return {
      ...this.blank(table),
      id: crypto.randomUUID(),
      user_id: this.userId,
      created_at: at,
      ...row,
      updated_at: at,
    }
  }

  handle(method: string, url: URL, body: unknown, headers: Record<string, string>): Reply {
    const path = url.pathname.replace(/^\/rest\/v1\//, '')
    if (path.startsWith('rpc/')) {
      const fn = this.rpcs[path.slice(4)]
      return { status: 200, body: fn ? (fn(this, (body ?? {}) as Row) ?? null) : null }
    }
    const table = path
    const params = url.searchParams
    const single = (headers['accept'] ?? '').includes('vnd.pgrst.object')
    const wantRows = (headers['prefer'] ?? '').includes('return=representation')

    const respond = (rows: Row[]): Reply => {
      const shaped = this.embed(table, rows, params.get('select') ?? '*')
      if (single) {
        if (shaped.length !== 1)
          return {
            status: 406,
            body: { code: 'PGRST116', message: 'no rows', details: '', hint: null },
          }
        return { status: 200, body: shaped[0] }
      }
      return { status: 200, body: shaped, headers: { 'content-range': `0-${shaped.length}/*` } }
    }

    if (method === 'GET' || method === 'HEAD') {
      let rows = this.filter(table, params)
      const order = params.get('order')
      if (order)
        for (const part of order.split(',').reverse()) {
          const [col, dir] = part.split('.')
          rows = [...rows].sort((a, b) => compare(a[col!], b[col!]) * (dir === 'desc' ? -1 : 1))
        }
      const offset = Number(params.get('offset') ?? 0)
      const limit = params.get('limit')
      rows = rows.slice(offset, limit ? offset + Number(limit) : undefined)
      return respond(rows)
    }

    if (method === 'POST') {
      const list = (Array.isArray(body) ? body : [body]) as Row[]
      const keys = (params.get('on_conflict') ?? 'id').split(',')
      const all = this.rows(table)
      const out: Row[] = []
      for (const r of list) {
        const at = all.findIndex((x) => keys.every((k) => r[k] !== undefined && x[k] === r[k]))
        if (at >= 0) all[at] = { ...all[at], ...r, updated_at: this.now() }
        else all.push(this.withDefaults(table, r))
        out.push(all[at >= 0 ? at : all.length - 1]!)
      }
      return wantRows ? respond(out) : { status: 201, body: null }
    }

    if (method === 'PATCH') {
      const hit = this.filter(table, params)
      for (const r of hit) Object.assign(r, body as Row, { updated_at: this.now() })
      return wantRows ? respond(hit) : { status: 204, body: null }
    }

    if (method === 'DELETE') {
      const hit = new Set(this.filter(table, params))
      this.tables.set(
        table,
        this.rows(table).filter((r) => !hit.has(r)),
      )
      return wantRows ? respond([...hit]) : { status: 204, body: null }
    }

    return { status: 405, body: null }
  }
}
