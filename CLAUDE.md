# Hoot

Hoot is a mobile-first PWA (working name in the PRD: "Study Planner"; always use "Hoot" in code, UI and docs) that turns exam dates, study sources and exam questions into a daily study plan and re-plans automatically.
Single user for now, but auth-ready: every table has `user_id` + RLS.

## Source of truth
- Specification: `docs/PRD.md` (Bosnian). Read the relevant section before implementing a feature.
- Screen designs: `docs/design/` — see `docs/design/README.md` for the visual system and screen flows.
- Build order and Definition of Done: `docs/ROADMAP.md`. Work on one stage at a time.
- The designs are mockups: port layout, colors and copy into React + Tailwind. Do NOT copy the HTML or the demo `<script>` logic.
- If the PRD and the code disagree, or the PRD is ambiguous, ask instead of guessing.

## Language rules
- Code, identifiers, comments, commit messages, PR titles/descriptions, issues, branch names: English.
- UI copy: never hardcoded. Use `react-i18next` keys; add every string to both `src/locales/bs.json` and `src/locales/en.json`. Bosnian copy comes from the mockups.
- AI prompts receive the user's `locale`; source titles stay as written in the book.

## Stack
React + TypeScript (strict) + Vite · Tailwind v4 + shadcn/ui · React Router · TanStack Query (server state) · Zustand (UI state) · React Hook Form + Zod · date-fns · FullCalendar · Dexie (offline queue) · vite-plugin-pwa · Supabase (Postgres + RLS, Auth, Storage, Edge Functions/Deno) · Claude Haiku 5.5 via LLM wrapper · Vitest (+ Playwright later) · Cloudflare Pages · GitHub Actions.

## Layout
- `src/app/` router, layout, providers, i18n setup
- `src/features/<feature>/` screens, components and query hooks per feature (today, plan, schedule, subjects, sources, session, progress, settings)
- `src/lib/` pure logic: `scheduler/`, `estimates/`, `srs/`, `progress/`, `day.ts`, `sync/`, `supabase.ts`, `image.ts`
- `src/types/database.ts` generated — never edit by hand
- `supabase/migrations/` SQL migrations; `supabase/functions/_shared/` Zod schemas, `llm.ts`, prices, cors (imported by the frontend via `@shared/`)

## Commands
- `npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm test`
- `npx supabase start` (local DB) · `npx supabase db push` · `npx supabase gen types typescript --linked > src/types/database.ts`
- `npx supabase functions serve` / `npx supabase functions deploy <name>`

## Architectural rules
- Scheduling is deterministic code (`plan()`, `placeTimes()` in `src/lib/scheduler/`), never an LLM. AI only explains and proposes input changes.
- Pure logic in `src/lib/` has no React/Supabase imports and is unit-tested (scheduler, estimates, srs, progress, day boundary, merge).
- Timer time is computed from segment timestamps, never from `setInterval` ticks. One active session per user.
- "Day" starts at `profiles.day_start_min` in `profiles.timezone`; all `on_date` columns are local dates via `src/lib/day.ts`. Timestamps stay UTC.
- IDs are generated on the client (`crypto.randomUUID()`); writes are idempotent upserts through the offline queue.
- Progress is computed from `units`, never stored.
- Re-import merges by `label`; missing units are archived (`archived_at`), never deleted.
- Manual user edits (`assigned_by = 'user'`) are never overwritten by AI.
- AI calls only through Edge Functions using `_shared/llm.ts`; output validated with Zod before saving; every call logged in `ai_runs`. No API keys in the client.

## Database
- Schema changes = new migration file (`0002_*.sql`, ...). Never edit an applied migration.
- Every new table: `user_id uuid not null default auth.uid()`, RLS enabled, owner-only policy. Synced tables get `updated_at` + trigger.
- Regenerate `src/types/database.ts` after every migration.

## Design implementation
- Tokens (colors, Outfit font, radii) live in `src/index.css` `@theme`; use token classes, not raw hex values.
- Target 390 px width first; touch targets ≥ 44 px; stroke icons 1.8 px.
- Prefer shadcn/ui primitives (Dialog, Sheet, Tabs) styled to match the mockups.

## Git workflow
- Branches: `main` = production, `dev` = integration (default). Never commit directly to either.
- Branch `feat/…`, `fix/…`, `chore/…`, `docs/…` off `dev`; open the PR into `dev`; squash merge after CI passes.
- Release = PR `dev → main` (merge commit) at the end of a stage, then tag `v0.<stage>.0`.
- Hotfix = `hotfix/…` off `main` → PR into `main`, then merge `main` back into `dev`.
- Conventional Commits (`feat(session): add pause segments`). Small focused commits.
- No `Co-Authored-By` or other AI attribution trailers in commits or PRs.
- Never commit `.env*` files or secrets. `VITE_SUPABASE_ANON_KEY` is public by design; service-role and Anthropic keys live only in Supabase secrets.

## Before finishing a task
- `npm run lint && npm run typecheck && npm test && npm run build` pass.
- New strings exist in both locale files.
- Check the screen against its mockup at 390 px.
- Update `docs/ROADMAP.md` checkboxes if a stage item is done.
