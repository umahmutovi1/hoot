// AI tutor (PRD "AI tutor", Sprint 18): explain from the source text with a quoted page, grade an
// answer in "Ispitaj me" / "Usmeni" (the student decides the rating; the app writes it to FSRS),
// find the gaps in a Feynman explanation, and write questions from the text to fill a round.
// The book text is private, so this needs the paid model (or the beta switch LLM_PRIVATE_FREE).
// Nothing is written here; ratings go through the app's review flow.
import { json } from '../_shared/cors.ts'
import { llmDeps, readJson, serve } from '../_shared/edge.ts'
import { generate } from '../_shared/llm.ts'
import { tutorRequestSchema } from '../_shared/schemas.ts'
import {
  explainRequest,
  feynmanRequest,
  gradeRequest,
  normalizeExplain,
  normalizeFeynman,
  normalizeGrade,
  normalizeQuestions,
  questionsRequest,
} from '../_shared/tutorPrompts.ts'
import { loadUnitText } from '../_shared/unitText.ts'

Deno.serve(
  serve(Deno.env, async (req, ctx) => {
    if (req.method !== 'POST') return json({ error: 'bad_request' }, 405)
    const parsed = tutorRequestSchema.safeParse(await readJson(req))
    if (!parsed.success) return json({ error: 'bad_request' }, 400)
    const body = parsed.data

    const material = await loadUnitText(ctx.db, body.unit_id)
    if (!material) return json({ error: 'bad_request' }, 404)
    // Explaining, Feynman and new questions need the book; grading a saved answer does not.
    const needsText = body.op !== 'grade' || body.reference === null
    if (needsText && !material.text) return json({ error: 'no_text' }, 409)

    const deps = await llmDeps(ctx)
    switch (body.op) {
      case 'explain': {
        const r = await generate(deps, explainRequest(material, body))
        return json(normalizeExplain(r.data, material.text))
      }
      case 'grade': {
        const r = await generate(deps, gradeRequest(material, body))
        return json(normalizeGrade(r.data, material.text))
      }
      case 'feynman': {
        const r = await generate(deps, feynmanRequest(material, body))
        return json(normalizeFeynman(r.data, material.text))
      }
      case 'questions': {
        const r = await generate(deps, questionsRequest(material, body))
        return json(normalizeQuestions(r.data, material.text, body.count, body.avoid))
      }
    }
  }),
)
