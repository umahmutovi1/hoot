// promptfoo provider: the same prompts and schemas as the parse-document, parse-toc and
// parse-questions Edge Functions (var `task`, default parse-document).
// GEMINI_API_KEY set -> calls Gemini directly (LLM_MODEL, default gemini-2.5-flash).
// Otherwise HOOT_EVAL_URL + HOOT_EVAL_TOKEN -> calls the deployed function (counts toward
// that user's daily limit and needs the file uploaded, so text cases only).
import { readFileSync } from 'node:fs'
import { generate } from '../supabase/functions/_shared/llm.ts'
import { geminiProvider } from '../supabase/functions/_shared/providers/gemini.ts'
import {
  normalizeQuestions,
  normalizeToc,
  questionsRequest,
  tocRequest,
} from '../supabase/functions/_shared/contentPrompts.ts'
import { normalizeParse, parseRequest } from '../supabase/functions/_shared/prompts.ts'
import type {
  ImportKind,
  ParseDocumentRequest,
  ParseQuestionsRequest,
  ParseTocRequest,
} from '../supabase/functions/_shared/schemas.ts'

const SUBJECTS = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Signali i sistemi' },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Matematika 2' },
  { id: '33333333-3333-4333-8333-333333333333', name: 'Baze podataka' },
]

interface Vars {
  task?: 'parse-document' | 'parse-toc' | 'parse-questions'
  kind: ImportKind
  fixture: string
  subject?: string
  topics?: string[]
}

type Deps = Parameters<typeof generate>[0]

/** parse-toc and parse-questions straight against Gemini (images need the key anyway). */
async function contentCall(
  vars: Vars,
  deps: Deps,
  text: string | null,
  files: { mediaType: 'image/png'; base64: string }[],
) {
  const base = {
    subject: vars.subject ?? 'Signali i sistemi',
    locale: 'bs' as const,
    files: files.map(() => ({ path: 'eval/import/fixture.png', media_type: 'image/png' as const })),
    text,
    topics: vars.topics ?? [],
  }
  if (vars.task === 'parse-toc') {
    const req: ParseTocRequest = {
      ...base,
      source_kind: 'book',
      measure: 'pages',
      title: '',
      units: null,
    }
    const result = await generate(deps, tocRequest(req, files))
    return { output: normalizeToc(req, result.data), result }
  }
  const req: ParseQuestionsRequest = base
  const result = await generate(deps, questionsRequest(req, files))
  return { output: normalizeQuestions(req, result.data), result }
}

export default class ParseDocumentProvider {
  id() {
    return 'hoot-parse-document'
  }

  async callApi(_prompt: string, context: { vars: Vars }) {
    const vars = context.vars
    const { kind, fixture } = vars
    const path = new URL(`./fixtures/${fixture}`, import.meta.url)
    const isImage = fixture.endsWith('.png')
    const req: ParseDocumentRequest = {
      document_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      kind,
      locale: 'bs',
      today: '2026-10-20',
      text: isImage ? null : [{ page: 1, text: readFileSync(path, 'utf8') }],
      file: isImage ? { path: 'eval/fixture.png', media_type: 'image/png' } : null,
      subjects: SUBJECTS,
    }
    try {
      const key = process.env.GEMINI_API_KEY
      if (key && vars.task && vars.task !== 'parse-document') {
        const files = isImage
          ? [{ mediaType: 'image/png' as const, base64: readFileSync(path).toString('base64') }]
          : []
        const { output, result } = await contentCall(
          vars,
          {
            provider: geminiProvider({
              apiKey: key,
              model: process.env.LLM_MODEL ?? 'gemini-2.5-flash',
            }),
            countRecentRuns: async () => 0,
            logRun: async () => {},
          },
          isImage ? null : readFileSync(path, 'utf8'),
          files,
        )
        return {
          output,
          tokenUsage: { prompt: result.inputTokens, completion: result.outputTokens },
        }
      }
      if (vars.task && vars.task !== 'parse-document')
        return { error: 'parse-toc and parse-questions evals need GEMINI_API_KEY' }
      if (key) {
        const files = isImage
          ? [{ mediaType: 'image/png' as const, base64: readFileSync(path).toString('base64') }]
          : []
        const result = await generate(
          {
            provider: geminiProvider({
              apiKey: key,
              model: process.env.LLM_MODEL ?? 'gemini-2.5-flash',
            }),
            countRecentRuns: async () => 0,
            logRun: async () => {},
          },
          parseRequest(req, files),
        )
        return {
          output: normalizeParse(req, result.data),
          tokenUsage: { prompt: result.inputTokens, completion: result.outputTokens },
        }
      }
      const url = process.env.HOOT_EVAL_URL
      const token = process.env.HOOT_EVAL_TOKEN
      if (!url || !token)
        return { error: 'Set GEMINI_API_KEY (or HOOT_EVAL_URL + HOOT_EVAL_TOKEN)' }
      if (isImage) return { error: 'Image fixtures need GEMINI_API_KEY' }
      const res = await fetch(`${url}/functions/v1/parse-document`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
          apikey: process.env.HOOT_EVAL_ANON_KEY ?? '',
        },
        body: JSON.stringify(req),
      })
      const body = await res.json()
      return res.ok ? { output: body } : { error: JSON.stringify(body) }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) }
    }
  }
}
