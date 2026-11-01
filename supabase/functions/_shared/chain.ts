// Rotation of free AI tiers (PRD "Dopune, 29. okt 2026" → Rotacija besplatnih AI-eva). Pure, so
// it is unit-tested; `llm.ts` and `edge.ts` wire it to providers and `ai_runs`.
//
// LLM_CHAIN = "gemini:gemini-2.5-flash,groq:llama-3.3-70b-versatile,openrouter:<model>:free"
// Only public tasks use the chain; private ones go to the paid model (LLM_PROVIDER) or wait.
import type { AiTask } from './llm.ts'

export const CHAIN_PROVIDERS = ['gemini', 'groq', 'openrouter'] as const
export type ChainProvider = (typeof CHAIN_PROVIDERS)[number]

export interface ChainEntry {
  provider: ChainProvider
  model: string
}

/**
 * Tasks whose input is public (calendars, timetables, plans and programmes, tables of contents,
 * the web). Everything else carries what the user wrote or the book's text: never on a free tier.
 */
export const PUBLIC_TASKS: ReadonlySet<AiTask> = new Set<AiTask>([
  'parse_academic_calendar',
  'parse_exam_schedule',
  'parse_timetable',
  'parse_syllabus',
  'parse_study_program',
  'parse_toc',
  'find_academic_info',
])

/**
 * Chain models that passed `npm run eval` (PRD: every model is evaluated before it is turned
 * on). A model in LLM_CHAIN but not here is skipped; add it here in the PR with the eval result.
 */
export const EVALUATED_MODELS: ReadonlySet<string> = new Set([
  // The models in use since October 2026 (SETUP 4: LLM_MODEL and LLM_FALLBACK_MODEL).
  'gemini:gemini-3.5-flash-lite',
  'gemini:gemini-2.5-flash',
])

export const keyOf = (e: { provider: string; model: string }) => `${e.provider}:${e.model}`

/** "provider:model" entries (the model may contain ':' itself, e.g. OpenRouter's ":free"). */
export function parseChain(raw: string | undefined): ChainEntry[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const at = s.indexOf(':')
      return { provider: s.slice(0, at), model: s.slice(at + 1) }
    })
    .filter(
      (e): e is ChainEntry =>
        (CHAIN_PROVIDERS as readonly string[]).includes(e.provider) && e.model.length > 0,
    )
}

/** A failed run in `ai_runs` (error = "<code>: <message>"). */
export interface FailedRun {
  provider: string
  model: string
  error: string | null
  created_at: string
}

/** A per-minute limit or an overload: skip the model this long. */
export const BUSY_SKIP_MS = 60_000

/**
 * When a free quota comes back: Gemini at midnight Pacific time, the others at midnight UTC.
 * DST is approximated by the offset at `at` (Intl), enough for a daily quota.
 */
export function nextReset(provider: string, at: Date): Date {
  if (provider !== 'gemini') {
    const d = new Date(at)
    d.setUTCHours(24, 0, 0, 0)
    return d
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at)
  const n = (t: string) =>
    Number(parts.find((p) => p.type === t)!.value) % (t === 'hour' ? 24 : 1e9)
  const local = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'))
  const offset = local - Math.floor(at.getTime() / 1000) * 1000
  const midnight = Date.UTC(n('year'), n('month') - 1, n('day') + 1)
  return new Date(midnight - offset)
}

/** Until when each model is left out, from its failed runs (quota: next reset; busy: a minute). */
export function exhausted(runs: FailedRun[]): Map<string, Date> {
  const out = new Map<string, Date>()
  for (const r of runs) {
    const at = new Date(r.created_at)
    const until = r.error?.startsWith('quota_exhausted')
      ? nextReset(r.provider, at)
      : r.error?.startsWith('provider_busy')
        ? new Date(at.getTime() + BUSY_SKIP_MS)
        : null
    if (!until) continue
    const key = keyOf(r)
    const prev = out.get(key)
    if (!prev || until > prev) out.set(key, until)
  }
  return out
}

/** The chain to try now: evaluated models that are not exhausted, in order. */
export function availableChain(chain: ChainEntry[], runs: FailedRun[], now: Date): ChainEntry[] {
  const out = exhausted(runs)
  return chain.filter((e) => {
    const key = keyOf(e)
    const until = out.get(key)
    return EVALUATED_MODELS.has(key) && (!until || until <= now)
  })
}
