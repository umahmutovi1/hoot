// find-academic-info (Sprint 13, PRD "Fakultet s interneta"). `search`: a web search (Gemini
// Google Search grounding / Anthropic web search through the LLM wrapper) for the faculty's
// academic calendar and syllabus; only the faculty, programme and year go into it. One call per
// change: the same search returns the saved result without an AI call. Links are kept only when
// they come from a site the search returned and open. `fetch`: downloads a found link, or any
// public link the user pasted, for parse-document (the browser cannot, CORS): a PDF or an image
// as a file, a web page as text. Nothing is written to the plan here. Every download is logged in
// ai_runs (`fetch_document`) and limited to FETCH_DAILY_LIMIT a day; it is not one of the 30 AI
// calls.
import { json } from '../_shared/cors.ts'
import {
  academicSearchRequest,
  htmlToPages,
  keepFound,
  normalizeYear,
  searchKey,
  titleFromUrl,
} from '../_shared/academicSearch.ts'
import { FETCH_DAILY_LIMIT } from '../_shared/chain.ts'
import { countRecentFetches, llmDeps, logFetch, readJson, serve } from '../_shared/edge.ts'
import type { EdgeContext } from '../_shared/edge.ts'
import { fetchPublic, opens } from '../_shared/linkCheck.ts'
import { generate } from '../_shared/llm.ts'
import { findAcademicInfoRequestSchema } from '../_shared/schemas.ts'
import type { AcademicSearch, FoundDocument } from '../_shared/schemas.ts'

const FETCH_TIMEOUT_MS = 20000
const MAX_FILE_BYTES = 15 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

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

    // fetch: a link from the last search (it has a title and a kind) or one the user pasted.
    if ((await countRecentFetches(ctx)) >= FETCH_DAILY_LIMIT)
      return json({ error: 'fetch_limited' }, 429)
    const found = saved?.documents.find((d) => d.url === body.url)
    const res = await download(ctx, found?.url ?? body.url, found?.title)
    await logFetch(ctx, res.ok, res.ok ? null : `${res.status}: ${res.error}`)
    return json(res.ok ? res.body : { error: res.error }, res.ok ? 200 : res.status)
  }),
)

type Downloaded =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: number; error: 'bad_request' | 'failed' }

const fail = (status: number, error: 'bad_request' | 'failed'): Downloaded => ({
  ok: false,
  status,
  error,
})

/** Downloads a link: a PDF or an image into Storage for parse-document, a web page as text. */
async function download(ctx: EdgeContext, url: string, foundTitle?: string): Promise<Downloaded> {
  const title = foundTitle ?? titleFromUrl(url)
  let res: Response | null
  try {
    res = await fetchPublic(url, {
      timeoutMs: FETCH_TIMEOUT_MS,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; Hoot)' },
    })
  } catch {
    return fail(502, 'failed')
  }
  if (!res) return fail(400, 'bad_request')
  if (!res.ok) return fail(502, 'failed')
  const length = Number(res.headers.get('content-length') ?? 0)
  if (length > MAX_FILE_BYTES) return fail(413, 'bad_request')
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.byteLength > MAX_FILE_BYTES) return fail(413, 'bad_request')
  const type = (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase()
  const isPdf = type.includes('pdf') || String.fromCharCode(...bytes.slice(0, 4)) === '%PDF'
  const image = IMAGE_TYPES.find((t) => t === type)
  if (isPdf || image) {
    const mediaType = isPdf ? 'application/pdf' : image!
    const ext = isPdf ? 'pdf' : mediaType.split('/')[1]
    const path = `${ctx.userId}/documents/${crypto.randomUUID()}.${ext}`
    const { error: upError } = await ctx.db.storage
      .from('uploads')
      .upload(path, bytes, { contentType: mediaType })
    if (upError) return fail(500, 'failed')
    return { ok: true, body: { kind: 'file', path, media_type: mediaType, title } }
  }
  if (type && !type.startsWith('text/') && !type.includes('html') && !type.includes('xml'))
    return fail(415, 'bad_request')
  const pages = htmlToPages(new TextDecoder().decode(bytes))
  if (pages.length === 0) return fail(422, 'bad_request')
  return { ok: true, body: { kind: 'text', pages, title } }
}
