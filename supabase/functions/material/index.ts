// Summary and proposed cards from a unit's source text (PRD "Tekst izvora, sažetak i kartice",
// Sprint 18). Book text is private, so both tasks need the paid model (or the beta switch
// LLM_PRIVATE_FREE). Units and passages are read as the user (RLS). A summary is kept in
// `unit_summaries` while its passages are the same; proposed cards are only returned: the app
// saves the ones the user keeps.
import { json } from '../_shared/cors.ts'
import { llmDeps, readJson, serve } from '../_shared/edge.ts'
import { generate } from '../_shared/llm.ts'
import {
  cardsRequest,
  hashInput,
  materialText,
  normalizeCards,
  normalizeSummary,
  summaryRequest,
  summaryWords,
  type Passage,
} from '../_shared/materialPrompts.ts'
import { materialRequestSchema } from '../_shared/schemas.ts'
import type {
  MaterialCardsResponse,
  SummaryContent,
  SummaryResponse,
  SummaryScope,
} from '../_shared/schemas.ts'

interface UnitRow {
  id: string
  parent_id: string | null
  source_id: string
  position: number
  label: string | null
  title: string
  notes: string | null
}

interface SummaryRow {
  id: string
  unit_id: string
  scope: SummaryScope
  text_hash: string
  content: SummaryContent
  words: number
  created_at: string
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** The unit, then its descendants depth-first in outline order. */
function chapterUnits(root: UnitRow, all: UnitRow[]): UnitRow[] {
  const children = new Map<string, UnitRow[]>()
  for (const u of all)
    if (u.parent_id) children.set(u.parent_id, [...(children.get(u.parent_id) ?? []), u])
  const out: UnitRow[] = []
  const walk = (u: UnitRow) => {
    out.push(u)
    for (const c of (children.get(u.id) ?? []).sort((a, b) => a.position - b.position)) walk(c)
  }
  walk(root)
  return out
}

Deno.serve(
  serve(Deno.env, async (req, ctx) => {
    if (req.method !== 'POST') return json({ error: 'bad_request' }, 405)
    const parsed = materialRequestSchema.safeParse(await readJson(req))
    if (!parsed.success) return json({ error: 'bad_request' }, 400)
    const body = parsed.data

    const { data: unit } = await ctx.db
      .from('units')
      .select('id, parent_id, source_id, position, label, title, notes, sources(subjects(name))')
      .eq('id', body.unit_id)
      .maybeSingle<UnitRow & { sources: { subjects: { name: string } | null } | null }>()
    if (!unit) return json({ error: 'bad_request' }, 404)
    const meta = {
      subject: unit.sources?.subjects?.name ?? '',
      title: unit.title,
      label: unit.label,
    }

    // Summary and cards from the text use the unit with its sub-units (a chapter's text lives in
    // its leaves); the "unit" scope of a summary is the same set unless the unit is a leaf.
    const { data: siblings } = await ctx.db
      .from('units')
      .select('id, parent_id, source_id, position, label, title, notes')
      .eq('source_id', unit.source_id)
      .is('archived_at', null)
    const family = chapterUnits(unit, (siblings ?? []) as UnitRow[])
    const ids = family.map((u) => u.id)

    const loadPassages = async (unitIds: string[]): Promise<Passage[]> => {
      const { data, error } = await ctx.db
        .from('source_chunks')
        .select('unit_id, page, position, content')
        .in('unit_id', unitIds)
        .order('position')
      if (error) throw error
      return (data ?? []) as Passage[]
    }

    if (body.op === 'summary') {
      // "Cijelo poglavlje" of a sub-unit is its parent with all of the parent's sub-units.
      let units = family
      let target: UnitRow = unit
      if (body.scope === 'chapter' && unit.parent_id) {
        const parent = ((siblings ?? []) as UnitRow[]).find((u) => u.id === unit.parent_id)
        if (parent) {
          units = chapterUnits(parent, (siblings ?? []) as UnitRow[])
          target = parent
        }
      }
      const passages = await loadPassages(units.map((u) => u.id))
      if (passages.length === 0) return json({ error: 'no_text' }, 409)
      const text = materialText(
        passages,
        units.map((u) => u.id),
      )
      const hash = await sha256(hashInput(text, body.scope, body.locale))

      const { data: cached } = await ctx.db
        .from('unit_summaries')
        .select('id, unit_id, scope, text_hash, content, words, created_at')
        .eq('unit_id', unit.id)
        .eq('scope', body.scope)
        .maybeSingle<SummaryRow>()
      if (cached && cached.text_hash === hash && !body.refresh) {
        const response: SummaryResponse = { ...cached, fresh: false }
        return json(response)
      }

      const deps = await llmDeps(ctx)
      const result = await generate(
        deps,
        summaryRequest({ ...meta, title: target.title, label: target.label }, text, body.locale),
      )
      const content = normalizeSummary(result.data, new Set(passages.map((p) => p.page)))
      if (content.points.length === 0) return json({ error: 'invalid_output' }, 502)
      const { data: saved, error } = await ctx.db
        .from('unit_summaries')
        .upsert(
          {
            unit_id: unit.id,
            scope: body.scope,
            text_hash: hash,
            content,
            words: summaryWords(content),
            created_at: new Date().toISOString(),
          },
          { onConflict: 'unit_id,scope' },
        )
        .select('id, unit_id, scope, text_hash, content, words, created_at')
        .single<SummaryRow>()
      if (error) throw error
      const response: SummaryResponse = { ...saved, fresh: true }
      return json(response)
    }

    // Cards.
    let material = ''
    let pages = new Set<number>()
    if (body.from === 'text') {
      const passages = await loadPassages(ids)
      if (passages.length === 0) return json({ error: 'no_text' }, 409)
      material = materialText(passages, ids)
      pages = new Set(passages.map((p) => p.page))
    } else if (body.from === 'notes') {
      material = family
        .map((u) => u.notes?.trim())
        .filter(Boolean)
        .join('\n\n')
      if (!material) return json({ error: 'bad_request' }, 400)
    } else {
      material = body.text ?? ''
      pages = new Set([...material.matchAll(/\[p\. (\d+)\]/g)].map((m) => Number(m[1])))
    }
    const deps = await llmDeps(ctx)
    const result = await generate(deps, cardsRequest(meta, body.from, material, body.locale))
    const response: MaterialCardsResponse = { cards: normalizeCards(result.data, pages) }
    return json(response)
  }),
)
