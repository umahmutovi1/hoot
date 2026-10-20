// The only way Edge Functions talk to an LLM. Provider and model come from the
// LLM_PROVIDER / LLM_MODEL secrets, so switching Gemini -> Haiku is `supabase secrets set`.
// Shared work lives here: rate limit, Zod validation with one retry, cost and the ai_runs log.
import type { z } from 'zod'
import type { AiErrorCode } from './schemas.ts'
import { costUsd } from './prices.ts'

export type AiTask = 'parse_academic_calendar' | 'parse_exam_schedule' | 'parse_document' | 'answer'

export type LlmMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'

export interface LlmFile {
  mediaType: LlmMediaType
  base64: string
}

export interface LlmRequest<T> {
  task: AiTask
  system: string
  text: string
  files?: LlmFile[]
  schema: z.ZodType<T>
  maxTokens: number
}

/** What a provider returns: the raw JSON (validated by the wrapper) and token usage. */
export interface LlmRawResult {
  json: unknown
  inputTokens: number
  outputTokens: number
  /** The model that answered when a provider fell back to another one. */
  model?: string
}

export interface LlmProvider {
  name: string
  model: string
  generate(req: LlmRequest<unknown>): Promise<LlmRawResult>
}

export interface LlmResult<T> {
  data: T
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number | null
}

export interface AiRunLog {
  task: AiTask
  provider: string
  model: string
  input_tokens: number
  output_tokens: number
  cost_usd: number | null
  ok: boolean
  error: string | null
}

export interface LlmDeps {
  provider: LlmProvider
  /** AI calls already made in the rate-limit window. */
  countRecentRuns: () => Promise<number>
  logRun: (run: AiRunLog) => Promise<void>
}

export const DAILY_AI_LIMIT = 30

export class LlmError extends Error {
  readonly code: AiErrorCode
  constructor(code: AiErrorCode, message?: string) {
    super(message ?? code)
    this.code = code
  }
}

/** Thrown by providers for errors worth a different user message (429 / overloaded). */
export class ProviderBusyError extends LlmError {
  constructor(message?: string) {
    super('provider_busy', message)
  }
}

export async function generate<T>(deps: LlmDeps, req: LlmRequest<T>): Promise<LlmResult<T>> {
  const used = await deps.countRecentRuns()
  if (used >= DAILY_AI_LIMIT) throw new LlmError('rate_limited')

  const { provider } = deps
  let inputTokens = 0
  let outputTokens = 0
  let model = provider.model
  let lastError: unknown = null

  // One retry, only when the output does not pass the Zod schema.
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: LlmRawResult
    try {
      raw = await provider.generate(req as LlmRequest<unknown>)
    } catch (err) {
      lastError = err
      break
    }
    inputTokens += raw.inputTokens
    outputTokens += raw.outputTokens
    model = raw.model ?? provider.model
    const parsed = req.schema.safeParse(raw.json)
    if (parsed.success) {
      const cost = costUsd(model, inputTokens, outputTokens)
      await deps.logRun({
        task: req.task,
        provider: provider.name,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: cost,
        ok: true,
        error: null,
      })
      return {
        data: parsed.data,
        provider: provider.name,
        model,
        inputTokens,
        outputTokens,
        costUsd: cost,
      }
    }
    lastError = new LlmError('invalid_output', parsed.error.message.slice(0, 500))
  }

  const error =
    lastError instanceof LlmError ? lastError : new LlmError('failed', errorMessage(lastError))
  await deps.logRun({
    task: req.task,
    provider: provider.name,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: costUsd(model, inputTokens, outputTokens),
    ok: false,
    error: `${error.code}: ${error.message}`.slice(0, 1000),
  })
  throw error
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export interface LlmEnv {
  get(key: string): string | undefined
}

/** Reads LLM_PROVIDER / LLM_MODEL and the matching key; null when AI is not configured. */
export async function getProvider(env: LlmEnv): Promise<LlmProvider | null> {
  const name = env.get('LLM_PROVIDER') ?? 'gemini'
  if (name === 'gemini') {
    const key = env.get('GEMINI_API_KEY')
    if (!key) return null
    const { geminiProvider } = await import('./providers/gemini.ts')
    return geminiProvider({
      apiKey: key,
      model: env.get('LLM_MODEL') ?? 'gemini-2.5-flash',
      fallbackModel: env.get('LLM_FALLBACK_MODEL') ?? null,
    })
  }
  if (name === 'anthropic') {
    const key = env.get('ANTHROPIC_API_KEY')
    if (!key) return null
    const { anthropicProvider } = await import('./providers/anthropic.ts')
    return anthropicProvider({ apiKey: key, model: env.get('LLM_MODEL') ?? 'claude-haiku-5-5' })
  }
  return null
}

export function isAiConfigured(env: LlmEnv): boolean {
  const name = env.get('LLM_PROVIDER') ?? 'gemini'
  if (name === 'gemini') return Boolean(env.get('GEMINI_API_KEY'))
  if (name === 'anthropic') return Boolean(env.get('ANTHROPIC_API_KEY'))
  return false
}
