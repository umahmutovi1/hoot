import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Column defaults as the database would fill them, read from `supabase/migrations/` (create table
// and `add column`), plus every column of `src/types/database.ts` as null. The mock's rows then
// look like real rows (`not null default …` columns are never missing).

type Value = unknown | ((ctx: { userId: string; now: string }) => unknown)

const STRIP_CAST = /::[\w[\]. ]+$/

function literal(raw: string, type: string): Value | undefined {
  const v = raw.trim().replace(STRIP_CAST, '').trim()
  if (/^now\(\)$/i.test(v)) return (c: { now: string }) => c.now
  if (/^gen_random_uuid\(\)$/i.test(v)) return () => crypto.randomUUID()
  if (/^auth\.uid\(\)$/i.test(v)) return (c: { userId: string }) => c.userId
  if (/^(true|false)$/i.test(v)) return v.toLowerCase() === 'true'
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v)
  if (/^null$/i.test(v)) return null
  const quoted = /^'((?:[^']|'')*)'$/.exec(v)
  if (quoted) {
    const text = quoted[1]!.replace(/''/g, "'")
    if (/json/.test(type) || /::jsonb?/.test(raw)) return JSON.parse(text)
    // Postgres arrays: '{15,60}'::int[]
    if ((type.endsWith('[]') || /::\w+\[\]/.test(raw)) && text.startsWith('{'))
      return text
        .slice(1, -1)
        .split(',')
        .filter(Boolean)
        .map((x) => (/^-?\d+(\.\d+)?$/.test(x) ? Number(x) : x))
    return text
  }
  return undefined
}

/** `default <expr>` up to the next constraint keyword, comma or comment. */
const DEFAULT = /\bdefault\s+((?:'(?:[^']|'')*'|\([^)]*\)|[^,\s()]+(?:\(\))?)(?:::[\w[\]. ]+)?)/i

function scan(sql: string, out: Map<string, Map<string, Value>>) {
  const set = (table: string, col: string, type: string, def: string) => {
    const v = literal(def, type)
    if (v === undefined) return
    if (!out.has(table)) out.set(table, new Map())
    out.get(table)!.set(col, v)
  }
  for (const m of sql.matchAll(
    /create table (?:if not exists )?(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/gi,
  )) {
    for (const line of m[2]!.split('\n')) {
      const head = /^\s*(\w+)\s+([\w[\]]+)/.exec(line)
      const d = DEFAULT.exec(line)
      if (head && d) set(m[1]!, head[1]!, head[2]!, d[1]!)
    }
  }
  for (const m of sql.matchAll(/alter table (?:only )?(?:public\.)?(\w+)([\s\S]*?);/gi)) {
    for (const a of m[2]!.matchAll(/add column (?:if not exists )?(\w+)\s+([^\n]*)/gi)) {
      const d = DEFAULT.exec(a[2]!)
      if (d) set(m[1]!, a[1]!, /^[\w[\]]+/.exec(a[2]!)?.[0] ?? '', d[1]!)
    }
    for (const a of m[2]!.matchAll(/alter column (\w+) set default ([^\n,;]+)/gi))
      set(m[1]!, a[1]!, '', a[2]!)
  }
}

function columnsFromTypes(types: string): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const m of types.matchAll(/\n {6}(\w+): \{\n {8}Row: \{\n([\s\S]*?)\n {8}\}/g))
    out.set(
      m[1]!,
      m[2]!.split('\n').map((l) => l.trim().split(':')[0]!.replace(/\?$/, '')),
    )
  return out
}

export function loadDefaults(root: string) {
  const dir = join(root, 'supabase/migrations')
  const defaults = new Map<string, Map<string, Value>>()
  for (const f of readdirSync(dir).sort()) scan(readFileSync(join(dir, f), 'utf8'), defaults)
  const columns = columnsFromTypes(readFileSync(join(root, 'src/types/database.ts'), 'utf8'))
  return (table: string, ctx: { userId: string; now: string }) => {
    const row: Record<string, unknown> = {}
    for (const c of columns.get(table) ?? []) row[c] = null
    for (const [c, v] of defaults.get(table) ?? [])
      row[c] = typeof v === 'function' ? (v as (x: typeof ctx) => unknown)(ctx) : structuredClone(v)
    return row
  }
}
