// A proposed answer to an exam question that has none, from the notes of the chapters it is
// linked to (directly or through topics) plus general knowledge. The app shows it marked
// "provjeri" and saves it only when the user accepts (answer_origin = 'ai').
import { json } from '../_shared/cors.ts'
import { llmDeps, readJson, serve } from '../_shared/edge.ts'
import { generate } from '../_shared/llm.ts'
import { proposeAnswerRequest, tidyMarkdown } from '../_shared/recallPrompts.ts'
import { proposeAnswerRequestSchema } from '../_shared/schemas.ts'
import type { ProposeAnswerOutput } from '../_shared/schemas.ts'

const MAX_CHAPTERS = 4

Deno.serve(
  serve(Deno.env, async (req, ctx) => {
    if (req.method !== 'POST') return json({ error: 'bad_request' }, 405)
    const parsed = proposeAnswerRequestSchema.safeParse(await readJson(req))
    if (!parsed.success) return json({ error: 'bad_request' }, 400)
    const { question_id, locale } = parsed.data

    const { data: question } = await ctx.db
      .from('units')
      .select('id, title, kind, sources(subject_id, subjects(name))')
      .eq('id', question_id)
      .maybeSingle()
    if (!question || question.kind !== 'question') return json({ error: 'bad_request' }, 404)

    // Linked chapters: direct links, then chapters sharing a topic; a rejected link never counts.
    const { data: direct } = await ctx.db
      .from('question_links')
      .select('unit_id, linked')
      .eq('question_id', question_id)
    const rejected = new Set((direct ?? []).filter((l) => !l.linked).map((l) => l.unit_id))
    const ids = (direct ?? []).filter((l) => l.linked).map((l) => l.unit_id)
    const { data: own } = await ctx.db
      .from('unit_topics')
      .select('topic_id')
      .eq('unit_id', question_id)
    const topicIds = (own ?? []).map((t) => t.topic_id)
    if (topicIds.length > 0) {
      const { data: shared } = await ctx.db
        .from('unit_topics')
        .select('unit_id')
        .in('topic_id', topicIds)
      for (const s of shared ?? []) if (!ids.includes(s.unit_id)) ids.push(s.unit_id)
    }
    const { data: chapters } = ids.length
      ? await ctx.db
          .from('units')
          .select('id, title, notes, kind, archived_at')
          .in('id', ids)
          .eq('kind', 'chapter')
          .is('archived_at', null)
      : { data: [] }
    const picked = (chapters ?? [])
      .filter((c) => !rejected.has(c.id))
      .sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
      .slice(0, MAX_CHAPTERS)

    const source = question.sources as { subjects?: { name?: string } } | null
    const deps = await llmDeps(ctx)
    const result = await generate(
      deps,
      proposeAnswerRequest(
        {
          subject: source?.subjects?.name ?? '',
          question: question.title,
          chapters: picked.map((c) => ({ title: c.title, notes: c.notes })),
        },
        locale,
      ),
    )
    return json({ answer: tidyMarkdown(result.data.answer) } satisfies ProposeAnswerOutput)
  }),
)
