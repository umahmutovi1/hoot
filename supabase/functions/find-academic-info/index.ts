// find-academic-info (Stage 10c, PRD "Fakultet s interneta"). `search`: a web search (Gemini
// Google Search grounding / Anthropic web search through the LLM wrapper) for the faculty's
// academic calendar and syllabus; only the faculty, programme and year go into it. One call per
// change: the same search returns the saved result without an AI call. Links are kept only when
// they come from a site the search returned and open. `fetch`: downloads one of those links for
// parse-document (the browser cannot, CORS). Nothing is written to the plan here.
import { json } from '../_shared/cors.ts'
import {
  academicSearchRequest,
  htmlToPages,
  isPublicHttps,
  keepFound,
  normalizeYear,
  searchKey,
} from '../_shared/academicSearch.ts'
import { llmDeps, readJson, serve } from '../_shared/edge.ts'
import { generate } from '../_shared/llm.ts'
import { findAcademicInfoRequestSchema } from '../_shared/schemas.ts'
import type { AcademicSearch, FoundDocument } from '../_shared/schemas.ts'

const CHECK_TIMEOUT_MS = 6000
const FETCH_TIMEOUT_MS = 20000
const MAX_FILE_BYTES = 15 * 1024 * 1024

async function opens(url: string): Promise<boolean> {
  const attempt = async (method: 'HEAD' | 'GET') => {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      headers: method === 'GET' ? { range: 'bytes=0-1023' } : {},
    })
    await res.body?.cancel()
    return res.status < 400
  }
  try {
    return (await attempt('HEAD')) || (await attempt('GET'))
  } catch {
    return false
  }
}

Deno.serve(
  serve(Deno.env, async (req, ctx) => {
    if (req.method !== 'POST') return json({ error: 'bad_request' }, 405)
    const parsed = findAcademicInfoRequestSchema.safeParse(await readJson(req))
    if (!parsed.success) return json({ error: 'bad_request' }, 400)
    const body = parsed.data

    const { data: profile, error } = await ctx.db
      .from('profiles')
      .select('academic_search')
      .eq('id', ctx.userId)
      .maybeSingle()
    if (error) return json({ error: 'failed' }, 500)
    const saved = (profile?.academic_search ?? null) as AcademicSearch | null

    if (body.op === 'search') {
      const key = searchKey(body)
      if (saved?.key === key) return json({ documents: saved.documents, cached: true })
      const deps = await llmDeps(ctx)
      const result = await generate(deps, academicSearchRequest(body))
      const candidates = keepFound(result.data.documents, result.sources)
      const checked = await Promise.all(candidates.map((d) => opens(d.url)))
      const documents: FoundDocument[] = candidates
        .filter((_, i) => checked[i])
        .map((d) => ({ ...d, academic_year: normalizeYear(d.academic_year) }))
      const search: AcademicSearch = { key, searched_at: new Date().toISOString(), documents }
      await ctx.db.from('profiles').update({ academic_search: search }).eq('id', ctx.userId)
      return json({ documents, cached: false })
    }

    // fetch: only a link from the last search, never an arbitrary URL.
    const found = saved?.documents.find((d) => d.url === body.url)
    if (!found || !isPublicHttps(found.url)) return json({ error: 'bad_request' }, 400)
    let res: Response
    try {
      res = await fetch(found.url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
    } catch {
      return json({ error: 'failed' }, 502)
    }
    if (!res.ok) return json({ error: 'failed' }, 502)
    const length = Number(res.headers.get('content-length') ?? 0)
    if (length > MAX_FILE_BYTES) return json({ error: 'bad_request' }, 413)
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.byteLength > MAX_FILE_BYTES) return json({ error: 'bad_request' }, 413)
    const type = res.headers.get('content-type') ?? ''
    const isPdf = type.includes('pdf') || String.fromCharCode(...bytes.slice(0, 4)) === '%PDF'
    if (isPdf) {
      const path = `${ctx.userId}/documents/${crypto.randomUUID()}.pdf`
      const { error: upError } = await ctx.db.storage
        .from('uploads')
        .upload(path, bytes, { contentType: 'application/pdf' })
      if (upError) return json({ error: 'failed' }, 500)
      return json({ kind: 'file', path, media_type: 'application/pdf', title: found.title })
    }
    const pages = htmlToPages(new TextDecoder().decode(bytes))
    if (pages.length === 0) return json({ error: 'bad_request' }, 422)
    return json({ kind: 'text', pages, title: found.title })
  }),
)
