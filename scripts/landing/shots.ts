import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium, type Page } from 'playwright'
import { createServer } from 'vite'
import { loadDefaults } from './defaults'
import { PostgrestMock, type Row } from './postgrest'
import { NOW, USER_ID, seed, session } from './seed'

// `npm run landing:shots`: the real app on a Vite dev server, Supabase answered by an in-memory
// mock (nothing leaves the machine), Danas photographed at 390 px for each locale into
// `public/landing/today-<locale>.jpg` (LandingPage.tsx).

const ROOT = resolve(import.meta.dirname, '../..')
const OUT = join(ROOT, 'public/landing')
const SUPABASE = 'https://demo.supabase.co'
const LOCALES = ['bs', 'en'] as const

process.env.VITE_SUPABASE_URL = SUPABASE
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_demo'

async function mock(page: Page, locale: (typeof LOCALES)[number]) {
  const defaults = loadDefaults(ROOT)
  let clock = new Date(NOW).getTime()
  const now = () => new Date((clock += 1000)).toISOString()
  const filled: Record<string, Row[]> = {}
  for (const [table, rows] of Object.entries(seed(locale)))
    filled[table] = rows.map((r) => ({ ...defaults(table, { userId: USER_ID, now: now() }), ...r }))
  const db = new PostgrestMock(
    filled,
    USER_ID,
    now,
    (table) => defaults(table, { userId: USER_ID, now: now() }),
    { replace_plan: replacePlan },
  )
  const { user } = session()

  await page.route(`${SUPABASE}/**`, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
      route.fulfill({
        status,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
          ...headers,
        },
        body: body === null && status === 204 ? '' : JSON.stringify(body),
      })
    if (req.method() === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': '*',
        },
      })
    if (url.pathname.startsWith('/auth/v1/user')) return json(200, user)
    if (url.pathname.startsWith('/auth/v1/')) return json(200, {})
    if (url.pathname.startsWith('/functions/v1/')) return json(200, {})
    if (url.pathname.startsWith('/storage/v1/')) return json(200, [])
    if (url.pathname.startsWith('/rest/v1/')) {
      let body: unknown = null
      try {
        body = req.postDataJSON()
      } catch {
        // no body
      }
      const r = db.handle(req.method(), url, body, req.headers())
      return json(r.status, r.body, r.headers)
    }
    return route.abort()
  })
  await page.routeWebSocket(/demo\.supabase\.co/, () => {})
}

/** `replace_plan` (supabase/migrations/0035_ml_signals.sql) on the mock's tables. */
function replacePlan(db: PostgrestMock, a: Row) {
  for (const b of db.rows('plan_blocks'))
    if (String(b.on_date) < String(a.p_today) && b.status === 'planned') b.status = 'missed'
  if (db.rows('plan_runs').some((r) => r.id === a.p_run_id)) return
  db.insert('plan_runs', [
    { id: a.p_run_id, input_hash: a.p_input_hash, with_times: true, deficit: a.p_deficit },
  ])
  db.tables.set(
    'plan_blocks',
    db
      .rows('plan_blocks')
      .filter(
        (b) =>
          !(b.origin === 'ai' && b.status === 'planned' && String(b.on_date) >= String(a.p_from)),
      ),
  )
  db.insert(
    'plan_blocks',
    (a.p_blocks as Row[]).map((b) => ({
      ...b,
      plan_run_id: a.p_run_id,
      plan_start_min: b.start_min,
    })),
  )
  db.insert('plan_block_units', a.p_units as Row[])
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const server = await createServer({
    root: ROOT,
    server: { port: 5199, strictPort: true },
    logLevel: 'error',
  })
  await server.listen()
  const browser = await chromium.launch()
  try {
    for (const locale of LOCALES) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        locale: locale === 'bs' ? 'bs-BA' : 'en-GB',
        timezoneId: 'Europe/Sarajevo',
        reducedMotion: 'reduce',
      })
      const page = await context.newPage()
      page.on('pageerror', (e) => console.error(`[${locale}] page error:`, e.message))
      await page.clock.setFixedTime(new Date(NOW))
      await mock(page, locale)
      const { session: s } = session()
      await page.addInitScript(
        ([key, value, loc]) => {
          localStorage.setItem(key!, value!)
          localStorage.setItem('hoot.locale', loc!)
        },
        ['sb-demo-auth-token', JSON.stringify(s), locale],
      )
      await page.goto('http://localhost:5199/')
      // The app plans itself (ReplanRunner) and then shows the blocks.
      await page.getByText(T_NEXT[locale]).first().waitFor({ timeout: 30_000 })
      await page.waitForTimeout(2500)
      const file = join(OUT, `today-${locale}.jpg`)
      await page.screenshot({ path: file, type: 'jpeg', quality: 85 })
      console.log('wrote', file)
      await context.close()
    }
  } finally {
    await browser.close()
    await server.close()
  }
}

/** Text that appears once Danas has its plan ("Sljedeće" card). */
const T_NEXT = { bs: /Sljedeće/i, en: /Next/i }

void main().catch((e) => {
  console.error(e)
  process.exit(1)
})
