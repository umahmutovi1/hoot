// Suggests the chapters an exam question belongs to: embeddings narrow each question to its
// nearest chapters (RPC question_candidates, no LLM), one AI call picks 0–2 of them. Nothing is
// written; the app shows the suggestions for review.
import { json } from '../_shared/cors.ts'
import { linkRequest, normalizeLinks } from '../_shared/contentPrompts.ts'
import type { LinkPromptQuestion } from '../_shared/contentPrompts.ts'
import { llmDeps, readJson, serve } from '../_shared/edge.ts'
import { generate } from '../_shared/llm.ts'
import { LINK_CANDIDATES, linkQuestionsRequestSchema } from '../_shared/schemas.ts'
import type { LinkQuestionsResponse } from '../_shared/schemas.ts'

// Candidates this far from a question are not worth a token.
const MIN_SIMILARITY = 0.7

interface Candidate {
  question_id: string
  unit_id: string
  similarity: number
}

Deno.serve(
  serve(Deno.env, async (req, ctx) => {
    if (req.method !== 'POST') return json({ error: 'bad_request' }, 405)
    const parsed = linkQuestionsRequestSchema.safeParse(await readJson(req))
    if (!parsed.success) return json({ error: 'bad_request' }, 400)
    const { question_ids, locale } = parsed.data

    const { data: found, error } = await ctx.db.rpc('question_candidates', {
      question_ids,
      match_count: LINK_CANDIDATES,
    })
    if (error) throw error
    const candidates = ((found ?? []) as Candidate[]).filter((c) => c.similarity >= MIN_SIMILARITY)
    if (candidates.length === 0) return json({ links: [] } satisfies LinkQuestionsResponse)

    const unitIds = [...new Set([...candidates.map((c) => c.unit_id), ...question_ids])]
    const { data: units, error: uError } = await ctx.db
      .from('units')
      .select('id, label, title, sources(subjects(name))')
      .in('id', unitIds)
    if (uError) throw uError
    type Row = { id: string; label: string | null; title: string; sources: unknown }
    const byId = new Map((units as Row[]).map((u) => [u.id, u]))
    const questions: LinkPromptQuestion[] = question_ids.flatMap((id) => {
      const q = byId.get(id)
      const offered = candidates
        .filter((c) => c.question_id === id && byId.has(c.unit_id))
        .sort((a, b) => b.similarity - a.similarity)
        .map((c) => ({ ...byId.get(c.unit_id)!, similarity: c.similarity }))
      return q && offered.length > 0 ? [{ id, text: q.title, candidates: offered }] : []
    })
    if (questions.length === 0) return json({ links: [] } satisfies LinkQuestionsResponse)
    const first = byId.get(questions[0]!.id)?.sources as { subjects?: { name?: string } } | null
    const subject = first?.subjects?.name ?? ''

    const deps = await llmDeps(ctx)
    const { request, chapters } = linkRequest(subject, locale, questions)
    const result = await generate(deps, request)
    const response: LinkQuestionsResponse = {
      links: normalizeLinks(result.data, questions, chapters),
    }
    return json(response)
  }),
)
