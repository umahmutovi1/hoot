// promptfoo provider: the same prompt and schema as the parse-document Edge Function.
// GEMINI_API_KEY set -> calls Gemini directly (LLM_MODEL, default gemini-2.5-flash).
// Otherwise HOOT_EVAL_URL + HOOT_EVAL_TOKEN -> calls the deployed function (counts toward
// that user's daily limit and needs the file uploaded, so text cases only).
import { readFileSync } from 'node:fs'
import { generate } from '../supabase/functions/_shared/llm.ts'
import { geminiProvider } from '../supabase/functions/_shared/providers/gemini.ts'
import { normalizeParse, parseRequest } from '../supabase/functions/_shared/prompts.ts'
import type { ImportKind, ParseDocumentRequest } from '../supabase/functions/_shared/schemas.ts'

const SUBJECTS = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Signali i sistemi' },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Matematika 2' },
  { id: '33333333-3333-4333-8333-333333333333', name: 'Baze podataka' },
]

interface Vars {
  kind: ImportKind
  fixture: string
}

export default class ParseDocumentProvider {
  id() {
    return 'hoot-parse-document'
  }

  async callApi(_prompt: string, context: { vars: Vars }) {
    const { kind, fixture } = context.vars
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
