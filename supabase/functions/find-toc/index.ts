// find-toc (Sprint 19, PRD "Izvor bez PDF-a: sadržaj s interneta"): a web search (through the LLM
// wrapper, like find-academic-info) for a book's table of contents; only the title, author and
// edition the user typed go into it. One call per title: the result, also an empty one, is kept
// in `toc_searches` and returned again without an AI call. The contents are kept only when their
// page is on a site the search returned and opens. Nothing is written to the source here: the app
// shows the chapters for review and saves them like any other import.
import { json } from '../_shared/cors.ts'
import { llmDeps, readJson, serve } from '../_shared/edge.ts'
import { opens } from '../_shared/linkCheck.ts'
import { generate } from '../_shared/llm.ts'
import { findTocRequestSchema } from '../_shared/schemas.ts'
import type { FindTocResponse, FoundToc } from '../_shared/schemas.ts'
import { keepToc, tocSearchKey, tocSearchRequest } from '../_shared/tocSearch.ts'

Deno.serve(
  serve(Deno.env, async (req, ctx) => {
    if (req.method !== 'POST') return json({ error: 'bad_request' }, 405)
    const parsed = findTocRequestSchema.safeParse(await readJson(req))
    if (!parsed.success) return json({ error: 'bad_request' }, 400)
    const body = parsed.data
    const key = tocSearchKey(body)

    const { data: saved, error } = await ctx.db
      .from('toc_searches')
      .select('result')
      .eq('key', key)
      .maybeSingle()
    if (error) return json({ error: 'failed' }, 500)
    if (saved) {
      const res: FindTocResponse = { toc: saved.result as FoundToc | null, cached: true }
      return json(res)
    }

    const deps = await llmDeps(ctx)
    const result = await generate(deps, tocSearchRequest(body))
    const candidate = keepToc(result.data, result.sources)
    const toc = candidate && (await opens(candidate.source_url)) ? candidate : null
    await ctx.db
      .from('toc_searches')
      .upsert({ user_id: ctx.userId, key, result: toc }, { onConflict: 'user_id,key' })
    const res: FindTocResponse = { toc, cached: false }
    return json(res)
  }),
)
