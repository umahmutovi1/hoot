// AI recall questions for one chapter (recall gate: 3, quiz: 5–10) from the student's notes, a
// photo of a page (deleted after the call) or general knowledge from the title. The unit is read
// as the user (RLS). Nothing is written: ratings go through the app's review flow.
import { json } from '../_shared/cors.ts'
import { llmDeps, readJson, serve, withUploads } from '../_shared/edge.ts'
import { generate } from '../_shared/llm.ts'
import { normalizeRecall, recallRequest } from '../_shared/recallPrompts.ts'
import { recallQuestionsRequestSchema } from '../_shared/schemas.ts'
import type { RecallQuestionsResponse } from '../_shared/schemas.ts'

interface UnitRow {
  id: string
  label: string | null
  title: string
  notes: string | null
  sources: { subjects: { name: string } | null } | null
}

Deno.serve(
  serve(Deno.env, async (req, ctx) => {
    if (req.method !== 'POST') return json({ error: 'bad_request' }, 405)
    const parsed = recallQuestionsRequestSchema.safeParse(await readJson(req))
    if (!parsed.success) return json({ error: 'bad_request' }, 400)
    const body = parsed.data

    return await withUploads(ctx, body.files, 'recall', async (files) => {
      const { data: unit } = await ctx.db
        .from('units')
        .select('id, label, title, notes, sources(subjects(name))')
        .eq('id', body.unit_id)
        .maybeSingle<UnitRow>()
      if (!unit) return json({ error: 'bad_request' }, 404)
      const { data: children } = await ctx.db
        .from('units')
        .select('label, title, notes')
        .eq('parent_id', unit.id)
        .is('archived_at', null)
        .order('position')
      const subs = (children ?? []) as {
        label: string | null
        title: string
        notes: string | null
      }[]
      const notes = [unit.notes, ...subs.map((c) => c.notes)]
        .map((n) => n?.trim())
        .filter(Boolean)
        .join('\n\n')
      if (body.source === 'notes' && !notes) return json({ error: 'bad_request' }, 400)

      const deps = await llmDeps(ctx)
      const result = await generate(
        deps,
        recallRequest(
          {
            subject: unit.sources?.subjects?.name ?? '',
            title: unit.title,
            label: unit.label,
            subheadings: subs.map((c) => [c.label, c.title].filter(Boolean).join(' ')),
            notes: notes || null,
          },
          body.source,
          body.count,
          body.locale,
          files,
        ),
      )
      const response: RecallQuestionsResponse = {
        source: body.source,
        questions: normalizeRecall(result.data, body.count),
      }
      return json(response)
    })
  }),
)
