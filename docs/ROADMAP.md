# Hoot — Roadmap

Plan izvedbe od praznog foldera do `v1.0.0`. Specifikacija je u [PRD.md](PRD.md), dizajn u [design/](design/README.md). Etape 1–10 prate redoslijed iz PRD sekcije „Roadmap i odluke"; poslije svake etape app radi i deployan je.

## Konvencije

**Ime.** App se zove **Hoot**: repo `hoot`, PWA manifest `name: "Hoot"`, `<title>`, Cloudflare projekat `hoot` → `hoot.pages.dev`. Radni naziv `study-planner` iz PRD-a se ne koristi.

**Branching: `main` / `dev` / feature grane.**
- `main` = produkcija (Cloudflare production deploy). Zaštićen: samo PR iz `dev` (release) ili `hotfix/*`, CI mora proći, bez force pusha.
- `dev` = integracija (Cloudflare preview alias `dev.hoot.pages.dev`). Zaštićen: samo PR, CI mora proći. Default branch na GitHubu.
- Feature grane se granaju iz `dev` i vraćaju u `dev`: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>`. Squash merge, grana se briše.
- Release: na kraju etape PR `dev → main` (merge commit, ne squash), pa tag na `main`.
- Hotfix: `hotfix/<slug>` iz `main` → PR u `main`, zatim `main` mergeati nazad u `dev`.

**Commitovi i PR-ovi.** Na engleskom, Conventional Commits (`feat(subjects): add exam presets`), bez `Co-Authored-By` trailera. PR naslov u istom formatu, opis: Summary / Screenshots / Test plan.

**Verzije.** Tag `v0.<etapa>.0` nakon svake etape, `v1.0.0` nakon Etape 10. GitHub Release sa kratkim changelogom.

**Issues.** Jedan Milestone po etapi, issue po feature-u iz PRD tabele. Labeli: `feat`, `bug`, `chore`, `ai`, `db`, `design`.

**Okruženja.**
- Lokalno: `npx supabase start` + `npm run dev`.
- `dev` i feature grane: Cloudflare preview URL-ovi. Dijele produkcijski Supabase (free tier = 2 projekta), ili drugi projekat `hoot-staging` ako treba izolacija.
- Produkcija: `main` → `hoot.pages.dev`.

**Definition of Done (svaka etapa).**
- Lint, typecheck, testovi i build zeleni u CI.
- Nema hardkodiranog teksta; svi stringovi u `bs.json` i `en.json`.
- Ekrani odgovaraju mockupima na 390 px; preview provjeren na telefonu.
- Migracije primijenjene (`db push`), `src/types/database.ts` regenerisan.
- Release PR `dev → main` mergean i tag postavljen.

---

## Etapa 0 — Repo i alati

- [x] `git init`, `.gitignore` (node_modules, dist, `.env*`, `supabase/.temp`), `.editorconfig`, `.nvmrc` (Node 24 LTS), kratki `README.md` (EN)
- [x] Prvi commit na `main`: `docs/`, `CLAUDE.md` (jedini direktni commit na `main`)
- [x] GitHub repo `hoot` (privatan), push `main`
- [x] `git checkout -b dev`, push, `dev` kao default branch
- [x] Branch protection na `main` i `dev` (ruleset `protect-main-dev`: PR obavezan, bez force pusha i brisanja)
- [x] PR template (`.github/pull_request_template.md`), issue templates, labeli, Milestones 0–10
- [x] Nalozi: Supabase (projekat `hoot`, ref `lpyyatqzvrvqgcmwiqfr`, Frankfurt), Cloudflare
- [ ] **Anthropic: nedostaje kartica.** Treba dopuniti kredit, postaviti mjesečni limit i napraviti **workspace** API ključ (`sk-ant-api03-…`, ne `sk-ant-usr-…`). Blokira samo Etapu 8. Ključevi nikad u repou ni u chatu.

> **Lozinka baze** (Supabase DB password) čuva se samo u password manageru. Treba za `supabase link` / `db push` (CLI je pita) i kasnije kao GitHub secret `SUPABASE_DB_PASSWORD` za `backup.yml`. Nikad u repo ili `.env` fajl.

## Etapa 1 — Temelj (`feat/foundation`)

- [x] Kostur prema PRD „Kostur za prvi dan": Vite React-TS, Tailwind v4 (`@tailwindcss/vite`), shadcn/ui, React Router, TanStack Query, Zustand, RHF + Zod, date-fns
- [x] oxlint (Vite default) + Prettier, strict `tsconfig`, aliasi `@/` → `src/` i `@shared/` → `supabase/functions/_shared/`
- [x] Skripte `dev`, `build`, `lint`, `typecheck`, `test`, `format`, `db:types`
- [x] Dizajn tokeni iz `docs/design/README.md` u `src/index.css` `@theme` (boje, Outfit, radiusi)
- [x] `AppShell`: donja navigacija (Danas, Plan, Predmeti, Napredak; Satnica je tab unutar Plana), urez i plutajuće timer dugme; prazni tab ekrani
- [x] i18n: `react-i18next`, `src/locales/bs.json` + `en.json`, date-fns lokali, izbor jezika pamti `profiles.locale`
- [x] PWA: `vite-plugin-pwa`, manifest „Hoot", ikone, offline shell
- [x] Supabase: `supabase init`, `supabase/migrations/0001_init.sql` iz PRD-a + dopune (vidi „Otvorena pitanja"), `seed.sql`
- [ ] `supabase link`, `db push`, `gen types` → `src/types/database.ts`
- [x] Auth: ekran Prijava (`Prijava.dc.html`), magic link + unos koda iz emaila (za instaliranu PWA), `RequireAuth` guard, odjava u Postavkama
- [x] Maskota: `<Mascot pose size />` (`docs/design/MASCOT.md`) na Prijavi, praznom „Danas" (DanasPrazno) i praznoj Satnici
- [ ] Supabase email template „Magic Link" dopuniti sa `{{ .Token }}` da email sadrži i kod
- [x] CI `.github/workflows/ci.yml`: install → lint → format check → typecheck → vitest → build, na PR prema `dev`/`main` i push na `dev`/`main`
- [ ] CI kao obavezan status check u rulesetu `protect-main-dev`
- [x] `.github/workflows/keepalive.yml` — zove RPC `keepalive()` (anon nema pristup tabelama)
- [ ] GitHub Secrets za keepalive: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`
- [ ] Cloudflare Pages projekat `hoot`: production branch `main`, preview za ostale, env `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- [ ] Supabase Auth: Site URL `https://hoot.pages.dev`, redirecti za `dev.hoot.pages.dev`, preview URL-ove i `http://localhost:5173`
- [ ] Kreiran vlastiti nalog, pa isključene nove registracije
- **DoD:** login magic linkom radi na `hoot.pages.dev`, bs/en se mijenja i pamti, PWA se instalira kao „Hoot", CI zelen → `v0.1.0`

## Etapa 2 — Predmeti, ispiti, rokovi, kalendar

- [ ] Predmeti (lista), NoviPredmet (naziv, boja, preset ispita, datum i format; < 30 s), Predmet (detalji)
- [ ] CRUD ispita i rokova (procjena sati opcionalna)
- [ ] Plan tab: FullCalendar mjesečni prikaz ispita i rokova
- [ ] Query hookovi po featureu (`src/features/subjects/api.ts`), optimistični update
- [ ] Testovi: Zod šeme formi, preset → lista ispita
- **DoD** → `v0.2.0`

## Etapa 3 — Izvori i jedinice ručno

- [ ] Izvor (tipovi knjiga/skripta/pitanja/prezentacije/ostalo), lista jedinica, podjedinice
- [ ] Ručni unos „jedna linija po jedinici" — parser u `src/lib/` + testovi (isti parser kasnije koristi AI uvoz)
- [ ] Jedinica: level, markdown bilješke, odgovor (pitanja), kartice, teme ručno
- [ ] `src/lib/progress/` — formule progresa jedinice, izvora, predmeta, ispita + testovi
- [ ] `src/lib/estimates/` — heuristika po tipu, AI množitelj težine, korekcija ocjenom + testovi
- [ ] ObimIspita ručno (`assessment_units`, `assigned_by = 'user'`)
- [ ] Arhivirane jedinice (prikaz i vraćanje)
- **DoD** → `v0.3.0`

## Etapa 4 — Raspored nastave i dostupnost

- [ ] Raspored: ručni unos termina, tipovi, parne/neparne sedmice, period važenja
- [ ] Dostupnost: sedmična pravila + izuzeci po danu
- [ ] Termini nastave u kalendaru
- [ ] `src/lib/day.ts`: granica dana (04:00, timezone), lokalni datumi + testovi
- **DoD** → `v0.4.0`

## Etapa 5 — Timer i sesije

- [ ] Maskota: `timer` 84 px u sheetu „Šta učiš sad?", `celebrating` 140 px na KrajSesije, `sleeping` 190 px u offline poruci
- [ ] Timer dugme → PokreniSesiju (preporučeni blok / drugi blok / slobodna sesija; nastavak aktivne)
- [ ] Sesija: segmenti u bazi, pauza/nastavak, „Sad radim na", režimi 25/5, 50/10, slobodno, način učenja
- [ ] KrajSesije: težina 1–5 po jedinici, fokus 1–3, refleksija; raspodjela minuta u `session_units`
- [ ] Zaboravljen timer (> 3 h) — ispravka kraja
- [ ] Offline: Dexie red u `src/lib/sync/`, klijentski UUID, upsert, retry, last-write-wins po `updated_at`
- [ ] Kalibracija (shrinkage, izvor × način, fallback ispod 3 mjerenja) + testovi
- **DoD:** timer preživi zaključan telefon, zatvoren tab i offline → `v0.5.0`

## Etapa 6 — Scheduler

- [ ] `plan(state)` u `src/lib/scheduler/`: kapacitet, ponavljanja, preostali rad po cilju, buffer, hitnost, redoslijed, tipovi blokova, dijeljenje dugih jedinica, deficit, „zašto ovo danas"
- [ ] `placeTimes()` za Satnicu
- [ ] Testovi: prazna dostupnost, dva ispita isti dan, deficit, propušten dan, buffer, više ispita po predmetu, idempotentnost
- [ ] `input_hash`, upis u `plan_runs` / `plan_blocks` / `plan_block_units`
- [ ] Okidači replana (debounce 2 s, nikad dok timer radi, prvo otvaranje u danu → „propušteno")
- [ ] Replan sheet: deficit + 3 opcije
- [ ] Maskota: `sleeping` 190 px na DanasSlobodno (dan bez blokova), `sleeping-head` 76 px u Replan sheetu, `timer-head` u praznoj Satnici već postoji
- [ ] Danas ekran (fokus bar, Sljedeći blok, lista, 3 ispita, savjet) i Satnica tab
- **DoD** → `v0.6.0`

## Etapa 7 — Recall gate i spaced repetition

- [ ] Maskota: `celebrating-head` uz potvrdu „Sjećam se"
- [ ] RecallGate: ispitna pitanja, bilješke (bez AI za sad), podnaslovi, blurting, kartice; prikaz tačnog odgovora pa ocjena 0–2
- [ ] `src/lib/srs/`: SM-2 varijanta, lični množitelj, ograničenje na datum ispita + testovi
- [ ] `review_logs`, prelaz na level 2/3, review i recap blokovi u scheduleru
- **DoD** → `v0.7.0`

## Etapa 8 — AI

- [ ] `supabase/functions/_shared/`: `llm.ts`, `providers/anthropic.ts` (tool use), `schemas.ts`, `prices.ts`, `cors.ts`
- [ ] Logiranje u `ai_runs`, rate limit 30 poziva/dan, jedan retry na Zod grešku
- [ ] `ANTHROPIC_API_KEY`, `LLM_PROVIDER`, `LLM_MODEL` kao Supabase secrets
- [ ] `src/lib/image.ts` (1600 px), privatni bucket `uploads` + politika vlastitog foldera, brisanje nakon parsiranja
- [ ] `parse-toc` → DodajIzvor → Parsiranje (pregled: novo / izmijenjeno / arhivira se)
- [ ] Merge po `label` + testovi
- [ ] `parse-questions`, teme pri uvozu (postojeće teme u promptu, ručne se ne prepisuju)
- [ ] ObimIspita: AI prijedlog, ručna izmjena zaključana
- [ ] `parse-timetable`, `recall-questions`, `propose-answer`, `quiz`
- [ ] AI dugmad onemogućena offline
- **DoD** → `v0.8.0`

## Etapa 9 — Napredak

- [ ] Progres po izvoru, ispitu, predmetu i temi
- [ ] Statistika: sati vs plan, ispunjenost, fokus, efikasnost po dobu dana (SQL view / RPC)
- [ ] Prognoza spremnosti na Danas i Napredak
- [ ] Rezultat ispita + spremnost dan prije; `celebrating` 120 px u toastu/modalu za položen ispit
- [ ] Maskota: `reading-head` 52 px kao avatar strategista (Danas savjet, Napredak sedmični pregled)
- [ ] `strategist` edge funkcija (sedmično / na dugme), odobravanje akcija jednim tapom → replan
- **DoD** → `v0.9.0`

## Etapa 10 — Notifikacije i dorada

- [ ] Web Push: service worker; ikone notifikacija `celebrating-head` / `timer-head`, `notify` edge funkcija, `pg_cron` (prvi blok, propušten blok, ponavljanje)
- [ ] Postavke kompletne (plan, timer, jezik, potrošnja AI iz `ai_runs`)
- [ ] Pristupačnost: touch ≥ 44 px, kontrast, aria, fokus
- [ ] Playwright E2E: novi predmet, dodaj izvor, sesija, replan
- [ ] `.github/workflows/backup.yml` (sedmični `db dump`, DB lozinka u Secrets)
- [ ] Lighthouse PWA i performanse
- **DoD** → `v1.0.0`

## Kasnije

- Read-only demo nalog sa seed podacima za portfolio.

---

## Odluke iz Etape 1 (odstupanja od PRD-a)

- `0001_init.sql` dodaje: triger `set_updated_at` za sve tabele sa `updated_at`, triger koji pravi `profiles` red za novog korisnika, `created_at` na `deadlines`, `updated_at` na `source_mode_rates`, `timetable_entries`, `availability_*`, `plan_blocks`, `cards`, `profiles.display_name`, indekse po `user_id`/FK.
- Data API ne izlaže nove tabele automatski: migracija daje `grant` samo roli `authenticated`; `anon` nema pristup tabelama. `ai_runs` korisnik samo čita, a piše ga Edge Function preko service role. **Svaka nova migracija mora sadržavati i `grant` za nove tabele.**
- Bucket se zove `uploads` svuda (pravi ga migracija, sa politikom vlastitog foldera).
- Zod šeme dijeljene sa Edge Functions žive u `supabase/functions/_shared/` (alias `@shared/`).
- `LlmRequest.task` koristi enum `ai_task` iz baze.
- Supabase API ključ je novi „publishable" (`sb_publishable_…`), env `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Linter je oxlint (Vite 8 default) umjesto ESLinta.
- Font Outfit se servira lokalno (`@fontsource-variable/outfit`), radi offline.

## Prompt za početak etape (primjer)

> Pročitaj docs/PRD.md i docs/ROADMAP.md i uradi Etapu 1: kostur projekta, migraciju 0001_init.sql, login, i18n i deploy. Radi na grani `feat/foundation` iz `dev`, otvori PR u `dev` kad je DoD ispunjen.
