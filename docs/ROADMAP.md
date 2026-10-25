# Hoot — Roadmap

Plan izvedbe od praznog foldera do `v1.0.0`. Specifikacija je u [PRD.md](PRD.md), dizajn u [design/](design/README.md), ručna podešavanja servisa u [SETUP.md](SETUP.md). Etape 1–12 prate redoslijed iz PRD sekcije „Roadmap i odluke" (10b i 10c su dodane nakon Etape 10, tag `v0.10.1` / `v0.10.2`); poslije svake etape app radi i deployan je.

## Konvencije

**Ime.** App se zove **Hoot**: repo `hoot`, PWA manifest `name: "Hoot"`, `<title>`, Cloudflare projekat `hoot` → `hoot-5ig.pages.dev`. Radni naziv `study-planner` iz PRD-a se ne koristi.

**Branching: `main` / `dev` / feature grane.**
- `main` = produkcija (Cloudflare production deploy). Zaštićen: samo PR iz `dev` (release) ili `hotfix/*`, CI mora proći, bez force pusha.
- `dev` = integracija (Cloudflare preview alias `dev.hoot-5ig.pages.dev`). Zaštićen: samo PR, CI mora proći. Default branch na GitHubu.
- Feature grane se granaju iz `dev` i vraćaju u `dev`: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>`. Squash merge, grana se briše.
- Release: na kraju etape PR `dev → main` (merge commit, ne squash), pa tag na `main`.
- Hotfix: `hotfix/<slug>` iz `main` → PR u `main`, zatim `main` mergeati nazad u `dev`.

**Commitovi i PR-ovi.** Na engleskom, Conventional Commits (`feat(subjects): add exam presets`), bez `Co-Authored-By` trailera. PR naslov u istom formatu, opis: Summary / Screenshots / Test plan.

**Verzije.** Tag `v0.<etapa>.0` nakon svake etape, `v1.0.0` nakon Etape 12. GitHub Release sa kratkim changelogom.

**Issues.** Jedan Milestone po etapi, issue po feature-u iz PRD tabele. Labeli: `feat`, `bug`, `chore`, `ai`, `db`, `design`.

**Okruženja.**
- Lokalno: `npx supabase start` + `npm run dev`.
- `dev` i feature grane: Cloudflare preview URL-ovi. Dijele produkcijski Supabase (free tier = 2 projekta), ili drugi projekat `hoot-staging` ako treba izolacija.
- Produkcija: `main` → `hoot-5ig.pages.dev`.

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
- [ ] **Anthropic: nedostaje kartica.** Treba dopuniti kredit, postaviti mjesečni limit i napraviti **workspace** API ključ (`sk-ant-api03-…`, ne `sk-ant-usr-…`). Za sad se koristi Gemini free tier (Etapa 6); Anthropic tek kad bude kartice. Ključevi nikad u repou ni u chatu.

> **Lozinka baze** (Supabase DB password) čuva se samo u password manageru. CLI je za `link` / `db push` ne traži (koristi `supabase login`); treba kasnije kao GitHub secret `SUPABASE_DB_PASSWORD` za `backup.yml`. Nikad u repo ili `.env` fajl.

## Etapa 1 — Temelj (`feat/foundation`)

- [x] Kostur prema PRD „Kostur za prvi dan": Vite React-TS, Tailwind v4 (`@tailwindcss/vite`), shadcn/ui, React Router, TanStack Query, Zustand, RHF + Zod, date-fns
- [x] oxlint (Vite default) + Prettier, strict `tsconfig`, aliasi `@/` → `src/` i `@shared/` → `supabase/functions/_shared/`
- [x] Skripte `dev`, `build`, `lint`, `typecheck`, `test`, `format`, `db:types`
- [x] Dizajn tokeni iz `docs/design/README.md` u `src/index.css` `@theme` (boje, Outfit, radiusi)
- [x] `AppShell`: donja navigacija (Danas, Plan, Predmeti, Napredak; Satnica je tab unutar Plana), urez i plutajuće timer dugme; prazni tab ekrani
- [x] i18n: `react-i18next`, `src/locales/bs.json` + `en.json`, date-fns lokali, izbor jezika pamti `profiles.locale`
- [x] PWA: `vite-plugin-pwa`, manifest „Hoot", ikone, offline shell
- [x] Supabase: `supabase init`, `supabase/migrations/0001_init.sql` iz PRD-a + dopune (vidi „Otvorena pitanja"), `seed.sql`
- [x] `supabase link`, `db push`, `gen types` → `src/types/database.ts`
- [x] Auth: ekran Prijava (`Prijava.dc.html`), magic link + unos koda iz emaila (za instaliranu PWA), `RequireAuth` guard, odjava u Postavkama
- [x] Maskota: `<Mascot pose size />` (`docs/design/MASCOT.md`) na Prijavi, praznom „Danas" (DanasPrazno) i praznoj Satnici
- [x] CI `.github/workflows/ci.yml`: install → lint → format check → typecheck → vitest → build, na PR prema `dev`/`main` i push na `dev`/`main`
- [x] CI kao obavezan status check u rulesetu `protect-main-dev`
- [x] `.github/workflows/keepalive.yml` — zove RPC `keepalive()` (anon nema pristup tabelama)
- [x] GitHub Secrets za keepalive: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`
- [x] Cloudflare Pages projekat `hoot`: production branch `main`, preview za ostale, env `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- [x] Supabase Auth URL Configuration (vidi [SETUP.md](SETUP.md#1-supabase))
- [x] Kreiran vlastiti nalog, pa isključene nove registracije
- **DoD:** login magic linkom radi na `hoot-5ig.pages.dev` (u browseru; login u instaliranoj PWA dolazi sa Resend SMTP-om u Etapi 2), bs/en se mijenja i pamti, PWA se instalira kao „Hoot", CI zelen → `v0.1.0`

## Etapa 2 — Predmeti, ispiti, rokovi, kalendar

- [x] Resend SMTP + šablon emaila sa kodom, da login radi u instaliranoj PWA ([SETUP.md](SETUP.md#3-resend-smtp-kod-za-prijavu-u-emailu))
- [x] Ime korisnika: `profiles.display_name` se sad uzima iz dijela emaila prije `@`. Dodati pitanje „Kako da te zovem?" pri prvom ulasku i izmjenu imena u Postavkama (profilna kartica)
- [x] Predmeti (lista), NoviPredmet (naziv, boja, preset ispita, datum i format; < 30 s), Predmet (detalji)
- [x] Migracija `0002_subjects_and_profile.sql` (prioritet, režim, „samo ako zatreba“, okvirni datum, `profiles.name_confirmed_at`), regenerisan `database.ts`
- [x] Prioritet 1–5 i režim redovno/kampanja: sklopljeno „Napredno“ na NoviPredmet (defaulti 3 / redovno), čipovi + izmjena na Predmetu, ručni start kampanje. Efekat na plan dolazi u Etapi 8
- [x] CRUD ispita i rokova (procjena sati opcionalna); ispit „samo ako zatreba“ i „okvirni datum“
- [x] Okvirni datum kao raspon (najranije – najkasnije, migracija `0003_exam_date_range.sql`); plan cilja najraniji dan, kalendar označava raspon
- [x] Plan tab: mjesečni kalendar ispita i rokova (vlastita mreža sa date-fns, kao mockup; FullCalendar izbačen iz stacka) + rokovi bez predmeta
- [x] Query hookovi po featureu (`src/features/subjects/api.ts`), optimistični update
- [x] Testovi: Zod šeme formi (uključujući prioritet, režim, okvirni datum), preset → lista ispita (integralni i popravni su „samo ako zatreba“)
- **DoD** ✓ → `v0.2.0`

## Etapa 3 — Izvori i jedinice ručno

- [x] Izvor (tipovi knjiga/skripta/pitanja/prezentacije/ostalo), lista jedinica, podjedinice
- [x] Ručni unos „jedna linija po jedinici" — parser u `src/lib/` + testovi (isti parser kasnije koristi AI uvoz)
- [x] Jedinica: level, markdown bilješke (`react-markdown` + `remark-math` + `rehype-katex`), odgovor (pitanja), kartice, teme ručno
- [x] `src/lib/progress/` — formule progresa jedinice, izvora, predmeta, ispita + testovi
- [x] `src/lib/estimates/` — heuristika po tipu, AI množitelj težine, korekcija ocjenom + testovi
- [x] ObimIspita ručno (`assessment_units`, `assigned_by = 'user'`)
- [x] Arhivirane jedinice (prikaz i vraćanje)
- [x] Migracija `0004_sources_and_scope.sql` (`sources.measure`, `assessment_units.included` pomjeren iz Etape 6), regenerisan `database.ts`
- [x] Danas: kartica „Znaš li?“ — jedna istražena činjenica o učenju dnevno, sa izvorom (link). Isključena nakon Etape 7 (`SHOW_FACT_CARD` u `TodayPage.tsx`) da Danas ne bude pretrpan; kod i činjenice ostaju
- **DoD** → `v0.3.0`

Odluke Etape 3: statusi 0–3 se do Etape 7 biraju ručno; „Uredi sadržaj“ koristi isti parser i merge po `label` kao kasniji AI uvoz; tip „Ostalo“ mjeri stranice (kao knjiga) ili jedinice sa minutama po jedinici koje korisnik upiše; obim ispita nudi svaki ispit bez „cijelo gradivo“, „Sve“ i „Ne ulazi“.

## Etapa 4 — Akademski kalendar, raspored nastave i dostupnost

- [x] Migracija `0005_calendar_and_lectures.sql` (`academic_periods`, `lecture_logs`, `profiles.lecture_pace_days`, `availability_exceptions.lecture_log_id`, `timetable_entries.period_id`, `assessments.exam_period_id`), regenerisan `database.ts`
- [x] `src/lib/day.ts`: granica dana (04:00, timezone), lokalni datumi + testovi; `factOfDay()` koristi lokalni dan iz `day.ts`
- [x] `src/lib/schedule/`: period na datum, sedmica nastave, termini po datumu (period nastave, parne/neparne sedmice od početka nastave, bez neradnih dana), zauzeto ±15 min, neto dostupnost dana i sedmice + testovi
- [x] Akademski kalendar (ručno): periodi nastave, sedmice parcijalnih, ispitni rokovi (redovni/popravni), neradni dani; ulaz iz Postavki i Rasporeda
- [x] Danas: „7. sedmica nastave“ / „Sedmica parcijalnih“ / „Ispitni rok · …“ / „Neradni dan · …“ ispod datuma
- [x] ExamSheet: „Datum još nije objavljen“ → izbor roka iz akademskog kalendara (raspon roka = raspon ispita, prijedlog po tipu ispita); na NoviPredmet „Datumi još nisu poznati?“ uzme rokove za sve ispite bez datuma
- [x] Raspored: ručni unos termina (sheet), tipovi, parne/neparne sedmice, period nastave iz akademskog kalendara; „Uslikaj raspored“ tek u Etapi 10
- [x] Dostupnost: sedmična pravila + izuzeci po danu (zauzeta cijeli dan / od–do, dodatno slobodno), snimanje odmah; ulaz iz Plana i Postavki
- [x] Kalendar: Mjesec / Dan (sedmica izbačena nakon pregleda); nastava u listi dana i na vremenskoj osi (dnevni prikaz po inspiraciji: traka dana + vremenska osa)
- [x] DokleSmoStigli sheet: tab po izvoru, jedinica „do ovdje“, bilješka, „Nastava otkazana“ (pravi izuzetak dostupnosti), „Preskoči“
- [x] Kartica „Dokle ste stigli?“ na Danas nakon završenog predavanja (do kraja dana); ručni unos sa datumom na Predmetu
- [x] `src/lib/pace/`: pređene jedinice, zaostatak u minutama, pravila prijedloga (prag > 2 predavanja ili > 4 h) + testovi
- [x] Kartica „Predavanja“ na Predmetu (na predavanju / ti / kasniš) + upozorenje sa akcijama koje ne traže scheduler
- [x] Dorada nakon prvog pregleda: migracija `0006_availability_days.sql` (ispitni periodi sa podtipom `partial`, default dostupnost 06–24, `profiles.daily_cap_min`, `availability_days`, `availability_rules.over_classes`)
- [x] Dostupnost: sedmica sa datumima + vremenska osa, šablon i dnevni maksimum po danu u sedmici, izmjena „samo ovaj dan“ / „svaki“, upozorenje i „Učim umjesto nastave“
- [x] Kalendar: tačkice aktivnosti u traci dana, detalji termina na tap, dugme „Raspored“ u Planu, `?date=` prečice
- [x] Zaostatak u mjeri izvora (str., pitanja…) sa vremenom sitno; bolji tok između ekrana (predmet ↔ termini ↔ kalendar ↔ akademski kalendar)
- **DoD** ✓ → `v0.4.0`

Odluke Etape 4: raspored važi za jedan period nastave iz akademskog kalendara, 1. sedmica nastave je neparna; akademski kalendar nema datume konkretnih ispita (oni dolaze uvozom u Etapi 6); neradni dan znači samo da nema nastave; „Dokle ste stigli?“ samo nakon predavanja, kartica do kraja dana; nastava nema tačkice u mjesečnoj mreži; nastava blokira tačno svoje vrijeme (bez ±15 min); dostupnost se snima odmah (dugme „Sačuvaj i preračunaj“ iz mockupa otpada dok nema schedulera).

## Etapa 5 — Bodovi i ocjene

Specifikacija: PRD „Bodovi, skala ocjena i projekcija ocjene“.

- [x] Mockup [`design/BodoviOcjene.html`](design/BodoviOcjene.html) (6 ekrana: kartica „Bodovi i ocjena“, ispiti sa rezultatom i popravnim, polja bodova u ExamSheetu, sheet Rezultat, sheet Skala ocjena, Napredak → Ocjene) — odobren
- [x] Migracija `0007_grades.sql` (`assessments.points_max` umjesto `weight_pct`, `points_unit`, `pass_min_pct`, `entry_min_points`, `retake_of`, `result_annulled`; bodovi na `deadlines`; `subjects.points_total`, `grade_scale`, `target_grade`), regenerisan `database.ts`
- [x] `src/lib/grades/`: doprinos stavke, zadnji izlazak, popravni i integralni, pragovi (stavka, ukupno, uslov za izlazak), skala, projekcija „imam / treba / nedostižno“ + testovi (i `fast-check`: doprinos nikad ne prelazi maksimum)
- [x] ExamSheet i DeadlineSheet: bodovi ili %, prag, uslov za izlazak; popravni vezan za ispit i ugniježđen ispod njega
- [x] Sheet Rezultat: unos u bodovima ili %, automatski `passed`, „Poništi rezultat“ (odricanje) aktivira popravni
- [x] Kartica „Bodovi i ocjena“ na Predmetu + sheet Skala ocjena + željena ocjena
- [x] Napredak: kratak pregled bodova i ocjena po predmetima
- **DoD** ✓ → `v0.5.0`

## Etapa 6 — AI temelj, uvoz i dokumenti

Specifikacija: PRD „AI uvoz, dokumenti i asistent“. Provajder za sad: Gemini free tier ([SETUP.md](SETUP.md#4-gemini-ai-za-sad)).

- [x] Mockup [`design/SovaAgent.html`](design/SovaAgent.html) (traka sa sovom na Danas, razgovor sa citatom, „Daj sovi dokument“, prijedlog uvoza kao kartica, offline, prazno stanje; varijanta za sve tabove za kasnije) — odobren
- [x] Historija razgovora u bazi (`0010_owl_chats.sql`), novi razgovor na svaki ulaz sa Danas, ekran Historija; prompt caching (redoslijed za implicitni cache, eksplicitni `cachedContents` / `cache_control` gdje je dostupan, `ai_runs.cached_tokens`)
- [x] Sova na Danas: traka na dnu (prijedlozi; oblačić sa savjetom tek sa strategistom u Etapi 11), razgovor preko cijelog ekrana, + → „Daj sovi dokument“; uvoz i pitanja o dokumentima idu kroz nju. Plutajuća sova na ostalim tabovima (7B) kasnije

- [x] `supabase/functions/_shared/`: `llm.ts`, `providers/gemini.ts` (`responseJsonSchema` iz `z.toJSONSchema()`), `providers/anthropic.ts` (`zodOutputFormat()` + `messages.parse()`), `schemas.ts` (bez rekurzivnih šema), `prices.ts`, `cors.ts`
- [x] Logiranje u `ai_runs`, rate limit 30 poziva/dan, jedan retry na Zod grešku; `LLM_PROVIDER`, `LLM_MODEL` (`gemini-3.5-flash-lite`), `LLM_FALLBACK_MODEL` (`gemini-2.5-flash`), `GEMINI_API_KEY` kao Supabase secrets; Gemini 503 se ponovi jednom, 429/503 prelazi na rezervni model
- [x] Migracija `0008_ai_documents.sql` (pgvector, `documents`, `document_chunks`, novi `ai_task`), regenerisan `database.ts`
- [x] `src/lib/image.ts` (1600 px, `browser-image-compression`), upload u `uploads/<user_id>/`; PDF ide direktno
- [x] Ekran „Uvezi“ (pregled iz razgovora sa sovom): tekst / slika / PDF → `parse-document` (jedan poziv i za „Pogodi sama“) → pregled novo / izmijenjeno → spašavanje; uparivanje predmeta (`fuse.js`)
- [x] Dokumenti fakulteta (Postavke → Dokumenti): lista, upload kroz sovu, odlomci + embeddings (`gte-small`), RPC pretrage, `answer` sa citatima (dokument, stranica)
- [x] `evals/` sa `promptfoo`: fiksni primjeri kalendara i rasporeda ispita
- [x] AI dugmad onemogućena offline i bez ključa (poruka)
- **DoD** ✓ → `v0.6.0`

## Etapa 7 — Timer i sesije

- [x] Maskota: `timer` 84 px u sheetu „Šta učiš sad?", `celebrating` 140 px na KrajSesije, `sleeping` 190 px u offline poruci
- [x] Timer dugme → PokreniSesiju (preporučeni blok / drugi blok / slobodna sesija; nastavak aktivne)
- [x] Sesija: segmenti u bazi, pauza/nastavak, „Sad radim na", režimi 25/5, 50/10, slobodno, način učenja
- [x] KrajSesije: težina 1–5 po jedinici, fokus 1–3, refleksija; raspodjela minuta u `session_units`
- [x] Zaboravljen timer (> 3 h) — ispravka kraja
- [x] Migracija `0012_sessions.sql` (`timer_mode`, `planned_minutes`, `sources.measured_sessions`), regenerisan `database.ts`
- [x] Offline: Dexie red u `src/lib/sync/`, klijentski UUID, upsert, retry, last-write-wins po `updated_at`
- [x] Kalibracija (shrinkage, izvor × način, fallback ispod 3 mjerenja) + testovi
- [x] Prije 3 sesije po izvoru: samo predloženo trajanje bloka/sesije, kraj sesije pita „do koje stranice“; prvi prolaz vs ponavljanje iz statusa jedinice (PRD „Prije mjerenja“)
- Odluke (PRD „Timer, pauza i rekalibracija“ → Odluke): 25/5 i 50/10 samo podsjetnik; zaboravljen timer „Da, nastavi“ / „Završila sam u …“; KrajSesije samo „Spasi“ do Etape 9; status jedinice automatski „Pročitano“ uz izmjenu tapom
- Ostali upisi (predmeti, ispiti) i dalje idu direktno u Supabase; kroz offline red idu sesije, segmenti, `session_units`, statusi jedinica i kalibracija (premještanje ostalih nije jednostavno jer svaki ekran čita svoj keš, pa ostaje za kasnije)
- [x] Historija sesija: ekran „Sesije“ (Napredak, Predmet), detalj sa izmjenom segmenata, „Uredi ocjene“, brisanje, naknadni unos (`0013_session_origin.sql`, ne ulazi u kalibraciju); kalibracija se preračunava iz svih sesija
- [x] **DoD:** timer preživi zaključan telefon, zatvoren tab i offline → `v0.7.0` (browser e2e: zatvoren tab, vrijeme dok je app zatvorena, offline reload i ponovno otvaranje, sinhronizacija po povratku mreže)

## Redizajn — Liquid Glass (između Etape 7 i 8)

Novi mockupi u [design/](design/README.md) zamjenjuju stari vizuelni sistem (Outfit, bijele kartice, sova). Redizajn mijenja izgled postojećih ekrana; elementi iz mockupa za funkcije koje još ne postoje (pretraga i notifikacije u zaglavlju, plan i satnica u chatu, prognoza, mapa termina…) dolaze u svojoj etapi.

- [x] Mockupi (Liquid Glass) u `docs/design/`, README, CLAUDE.md
- [x] Tokeni u `src/index.css`: boje, font (SF Pro na Apple uređajima, Geist lokalno kao zamjena), pozadina sa gradijentima, `glass` / `glass-strong` / `glass-sheet` / `glass-tint` / `btn-primary` sa padom na neprozirnu karticu bez `backdrop-filter` i uz „smanji prozirnost"
- [x] Navigacija: plutajuća staklena kapsula sa 5 mjesta i oznakama (Danas, Plan, AI, Predmeti, Napredak); timer dugme uklonjeno
- [x] Do schedulera: kartica „Sljedeće" na Danas nudi slobodnu sesiju (Počni → PokreniSesiju), a dok sesija traje vraća u nju; sa Etapom 8b prikazuje sljedeći blok
- [x] Bez maskote: `Mascot` i `public/mascot/` uklonjeni, prazna stanja su tekst i dugme
- [x] Asistent: traka sove na Danas → AI tab (Chat), „sova" → „asistent" u tekstovima
- [x] Ekrani po mockupima: Prijava, Danas i prazna stanja, Chat / Dokumenti / Prilog / Pregled uvoza, Plan (Mjesec, Dan, termin), Dostupnost, Raspored, Akademski kalendar, Predmeti, Predmet, NoviPredmet, IspitSheet, Bodovi i skala, Izvor, Jedinica, DokleSmoStigli, DodajIzvor → Parsiranje → ObimIspita, PokreniSesiju → Sesija → KrajSesije, Sesije, SesijaDetalj, Napredak, Postavke
- [x] **DoD:** svi postojeći ekrani u novom stilu na 390 px (provjereno sa privremenim test korisnikom) → `v0.7.2`
- Napomena: postojeći ekrani su prešli na novi stil kroz tokene i klase; dijelovi mockupa za funkcije iz kasnijih etapa (onboarding, plan i satnica, „Cilj“, prognoza, check-in, notifikacije, izvozi u Postavkama) rade se u tim etapama po istim mockupima.

## Etapa 8 — Onboarding i scheduler

Specifikacija: PRD „Onboarding“, „Povezani kalendari i integracije“, „Timer, pauza i rekalibracija“ → Predlošci sesije, „Scheduler, replan i AI strategist“. Istraživanje i obrazloženje: [RESEARCH-2026-10.md](RESEARCH-2026-10.md).

**8a — Prije schedulera** (plan bez ovoga radi nad netačnom dostupnošću)

- [x] Mockupi `design/Onboarding*.dc.html` (8 koraka kao stanja jedne komponente, checklist na DanasPrazno), `design/PovezaniKalendari.dc.html` i `design/DodajKalendar.dc.html`, sekcija „Cilj“ na `design/Predmet.dc.html` (dio Liquid Glass mockupa)
- [x] Migracija `0014_onboarding_and_presets.sql` (onboarding polja, ritam, `preferred_slots`, predlošci sesije, `exam_eve_end_min`, `ics_token`, `break_ends_at`, `focus_reasons`, `distractions`, `sources.is_rough`), regenerisan `database.ts`
- [x] Predlošci sesije: Zod šema u `_shared/`, logika značke za niz intervala, dugu pauzu i Flowtime u `src/lib/session/timer.ts` + testovi; izbor u PokreniSesiju, default u Postavkama; Standardno 50/15 default
- [x] KrajSesije: čipovi razloga kad je fokus 1; dugme „Ometena sam“ u sesiji
- [x] Onboarding: koraci 1–8, nastavak sa `onboarding_step`, „Završi kasnije“, checklist na DanasPrazno; zona iz browsera; prijedlog `day_start_min` iz vremena lijeganja; default dostupnost zamijenjena izborom
- [x] Gruba veličina gradiva na NoviPredmet i u onboardingu → privremeni izvor (`is_rough`), zamjena pravim sadržajem arhivira privremeni
- [x] Migracija `0015_calendar_feeds.sql` (`calendar_feeds`, `external_events`), regenerisan `database.ts`
- [x] `sync-calendar` edge funkcija (`ical.js`, RRULE/EXDATE, horizont 120 dana, upsert po `uid`), okidač na otvaranje (≤ 1× u 30 min) i `pg_cron` svaka 3 h; fiksni `.ics` primjeri kao testovi (Google, Outlook, iCloud, Moodle)
- [x] Povezani kalendari: Postavke + korak 2 onboardinga; vrsta „Zauzetost“; cjelodnevni, slobodni i otkazani događaji ne blokiraju; „ignoriši“; „Spremaj samo zauzeto“
- [x] `src/lib/schedule/`: zauzetost iz feedova u neto dostupnosti (kao nastava, „Učim umjesto ovoga“) + testovi; šrafirano na Dostupnosti i u kalendaru sa oznakom izvora
- [x] [SETUP.md](SETUP.md): `pg_cron` za `sync-calendar`

**8b — Scheduler**

- [x] `plan(state)` u `src/lib/scheduler/`: kapacitet (minus nastava, povezani kalendari, izuzeci, ručni blokovi), faktor realizacije ρ i rezerva 0.9, ponavljanja, preostali rad po cilju, buffer, hitnost, limit rasta 1.25×, redoslijed, tipovi blokova, mikro-blokovi za `review`, dijeljenje dugih jedinica, deficit, „zašto ovo danas“
- [x] `placeTimes()` automatski poslije `plan()`: pauze po zadanom predlošku, dužina bloka kao višekratnik intervala, san pred ispit, prior termina iz onboardinga (ocjene termina dolaze u Etapi 11), uvijek popunjen `planned_start`; Satnica samo prikazuje i pomjera (pomjeren blok postaje ručni)
- [x] `plan()` dopune: težina prioriteta, ciljna pokrivenost (obavezno / opcionalno), ALAP start kampanje + margina (uz ρ), ručni override i „Počni odmah“, privremeno pojačanje prioriteta („Uzmi vrijeme od …“ sa izračunatom razlikom plana), meki rokovi predavanja (redovni režim), „samo ako zatreba“ ispiti, rezanje deficita od najnižeg prioriteta, kapacitet minus ručni blokovi, ciljna pokrivenost iz željene ocjene (PRD „Željena ocjena kao ulaz u plan“), lični faktor brzine u procjenama (PRD „Procjena težine i vremena“ → 5), novi razlozi „zašto ovo danas“
- [x] Testovi: prazna dostupnost, dva ispita isti dan, deficit, propušten dan, buffer, više ispita po predmetu, idempotentnost, start kampanje, ručni start, dvije kampanje u istoj sedmici, rezanje po prioritetu, ciljna pokrivenost, meki rok predavanja, ručni blok preživi replan, faktor realizacije, limit rasta, „Danas ne mogu“, mikro-blokovi, pauze, san pred ispit, zauzetost iz kalendara
- [x] Property testovi (`fast-check`): kapacitet dana se nikad ne prekorači, učenje + pauze stanu u slobodne termine, ručni blokovi se ne mijenjaju, isti ulaz = isti plan i ista satnica
- [x] Migracija `0016_manual_blocks.sql`; ručni blokovi: UrediBlok (dodaj / izmijeni / obriši), izmjena AI bloka ga zaključava, brisanje AI bloka pita „Prebaci“ (vrijeme bloka postaje zauzeto, `availability_exceptions`) / „Izbaci iz plana“ (`assessment_units.included = false`), undo toast, katanac u listi
- [x] Kartice prijedloga (zaostatak sa „Uzmi vrijeme od“ / „Kreni ranije“ / „Dodaj X min dnevno“, deficit, željena ocjena nedostižna, najava kampanje 3 dana prije, ispitni rok → veći maksimum, „Krenimo ispočetka“) na Danas i Predmetu; najviše jedna iznad liste, ostale pod „Još N prijedloga“; jedan tap mijenja ulaz → replan
- [x] Brze akcije: „Danas ne mogu“ (dan zauzet, blokovi `skipped`, undo) i „Imam samo 30 min“ (`pickForTime()` + testovi) na Danas i u PokreniSesiju
- [x] `input_hash` (uz povezane kalendare, ρ i zadani predložak), upis u `plan_runs` / `plan_blocks` / `plan_block_units`
- [x] Okidači replana (debounce 2 s, nikad dok timer radi, prvo otvaranje u danu → „propušteno“, sinhronizacija kalendara)
- [x] Replan sheet: deficit + 3 opcije
- [x] Sekcija „Cilj“ na Predmetu i NoviPredmet → Napredno (PRD „Prioritet i režim učenja“ → Šta korisnik vidi): „Koliko ti je bitan“ sa imenima bez brojeva, željena ocjena premještena iz kartice bodova, usklađivanje na licu mjesta, sitan opis posljedica, čip pojačanja sa ×; „Kad kreće učenje?“ za režim
- [x] Danas ekran (fokus bar, Sljedeći blok, lista, 3 ispita, savjet) i Satnica tab
- [x] Plan u chatu (`design/Chat.dc.html`): pozdrav sa današnjim vremenom, kartice „Danas“ (Počni na sljedećem bloku) i „Uskoro“ iz spašenih blokova, bez AI poziva
- [x] Korak 8 onboardinga: prvi blok za danas iz plana („Pokreni prvi blok“), bez bloka ostaje slobodna sesija
- [x] Dorada poslije e2e (odluke u PRD-u i design README-u): logo sove umjesto avatara, nove ikone i favicon, AI dugme sa staklenom pilulom, AI zatvara i meni, sekcije menija nezavisne (#119); Danas bez treptanja kad nema plana, sljedeći blok i „za X dana“ na ispitima, „+ Predmet“ / „+ Izvor“ u PokreniSesiju (#120); prvi red i mrvice sa ‹ na svim ekranima (#121); jedan kalendar Dan / Mjesec umjesto Kalendar + Satnica (#122); planirana vs slobodna pauza (#123); potvrda ranijeg kraja, „Nastavi ovu sesiju“ / „Počni iznova“ / „Odbaci“ (#124); kašnjenje pomjera ostatak dana (#125); „Imam još vremena“ (#126); dnevna osa skroluje do „sada“ (#128); san pred ispit pri pomjeranju (#129); „Preskoči“ sa „kreni odmah“ i prednošću preskočenog gradiva (#130–#133)
- [x] **DoD** (uz opći DoD): novi korisnik prođe onboarding na telefonu za ~3 min i dobije plan koji poštuje nastavu, povezani Google kalendar i izabrane periode → `v0.8.0` (browser e2e na previewu sa privremenim korisnikom, 390 px: raspored nastave, iCal feed sa zauzetošću (ponavljanje, cjelodnevni i slobodni događaj, prelaz na zimsko vrijeme), periodi jutro + veče bez nedjelje, predmet sa grubom veličinom → plan bez preklapanja sa nastavom i zauzetošću, u periodima i ispod maksimuma; „Danas ne mogu“ + Poništi, „Imam samo“, UrediBlok (izmjena zaključava, novi ručni blok, Prebaci), Replan sheet „Smanji obim“ i plan u chatu na pravoj bazi. Popravke iz testa: #114, #115, #116, #117)

## Etapa 9 — Recall gate, provjera znanja, FSRS i osnovni push

- [x] Web Push temelj: service worker, pretplata, `notify` edge funkcija, `pg_cron`; prvi blok dana i kraj pauze (`break_ends_at`) ([SETUP.md](SETUP.md): VAPID ključevi)
- [x] Nakon čitanja/ponavljanja poglavlja u sesiji odmah ponuditi povezana ispitna pitanja; izvor „Pitanja“ se mjeri uspjehom, ne vremenom (PRD „Izvor Pitanja“)
- [x] RecallGate: ispitna pitanja, bilješke (bez AI za sad), podnaslovi, blurting, kartice; prikaz tačnog odgovora pa ocjena 0–2 (AI izvori dolaze u Etapi 10; svih 7 izvora je u v1)
- [x] Status „Razumijem“ i „Ponovljeno“ (pitanja: „Znam“) samo kroz recall gate; do Etape 7 se biraju ručno
- [x] Migracija `0017_fsrs.sql` (samo aditivno: FSRS kolone na `units` i `cards`, `review_streak`, `review_logs.card_id` + proteklo dana i stabilnost, `review_cap_pct`, `session_units.recall_skipped`) i `0018_push.sql` (`push_subscriptions`, `push_jobs`, prekidači notifikacija), regenerisan `database.ts`
- [x] Poslije release-a `v0.9.0`: `0019_drop_sm2.sql` briše SM-2 kolone (`units.srs_ease`, `srs_interval_days`, `srs_success_count`, `profiles.srs_multiplier`); v0.8.0 ih još čita na dijeljenoj bazi, kod ih od Etape 9 ne koristi
- [x] `src/lib/srs/` sa `ts-fsrs`: recall 0/1/2 → Again/Hard/Good, ciljno zadržavanje po prioritetu (+0.03 za poglavlja), `next_review_on`, ograničenje na datum ispita, R na dan ispita ≥ cilj (ponavljanje u bufferu), level 3 nakon 4 uspjeha + testovi
- [x] Kartice kao zasebni FSRS objekti u `review` blokovima; jačina jedinice uključuje kartice
- [x] Jačina znanja R(t) po jedinici, temi, izvoru, predmetu, ispitu (računa se, ne snima) + testovi
- [x] Provjera pročitanog: preskočen gate → provjera za 2 dana; neuspjeh vraća jedinicu u učenje
- [x] `review_logs` (proteklo dana, stabilnost prije/poslije), prelaz na level 2/3, review i recap blokovi u scheduleru, dnevni limit ponavljanja (`review_cap_pct`), prije starta kampanje samo ponavljanja već naučenog
- [x] ProvjeraZnanja: review blok kao niz recall gate-ova + sažetak promjene jačine; kartica „Znanje slabi“ na Danas; kartica „Jačina znanja“ na Predmetu
- [x] Dorada poslije e2e: „Dalje“ zaključan kad se onboarding otvori na kasnijem koraku (#146); sažetak provjere sa oznakom jačine i „provjera za N dana“ umjesto procenata (#147, #149); datum i dani do ispita na Danas po granici dana (#148); povezana ispitna pitanja nude se i tokom sesije (#150)
- [x] **DoD** (uz opći DoD): poglavlje pročitano u sesiji prolazi recall gate i dobija level 2, FSRS stanje i `next_review_on`, review blok se pojavi u planu i radi se kao Provjera znanja, push stiže na telefon → `v0.9.0` (browser e2e na previewu sa privremenim korisnikom, 390 px: onboarding sa grubom veličinom + ručni sadržaj sa ispitnim pitanjima, temom i karticom → sesija → „Spasi i testiraj se“ → gate (ispitno pitanje, bilješke, kartica) → u bazi level 2 / „Znam“, FSRS kolone, `review_logs` sa proteklim danima i stabilnošću; provjera na redu → review blok u planu i kartica „Provjera znanja“ na Danas → Provjera znanja → sažetak, sesija u modu `review`; push pretplata i probno obavještenje poslano kroz `notify` + `pg_cron`. Popravke iz testa: #146, #147, #148, #149, #150; uz to `CRON_SECRET` i vault tajna su usklađeni, pa i `sync-calendar` cron sad prolazi)

## Etapa 10 — AI sadržaj i asistent

Wrapper, `ai_runs`, rate limit, `image.ts` i pgvector su iz Etape 6.

- [ ] Anthropic: kartica, workspace ključ, `LLM_PROVIDER=anthropic`, prompt caching za sistemske promptove (ako je kartica dodana)
  - Odluka (početak Etape 10): Anthropic nalog još nema karticu, pa sve ide kroz Gemini (`LLM_PROVIDER=gemini`); stavka ostaje otvorena i ne blokira etapu
- [x] Embeddings (`gte-small`) za jedinice, bilješke, kartice, pitanja i teme; prijedlog veza pitanje ↔ poglavlje i dedupe tema bez LLM poziva
  - Migracije `0020_ai_content.sql` + `0021_embedding_tables.sql`: vektori u `unit_embeddings`, `card_embeddings`, `topic_embeddings` (triger briše zastarjeli vektor; ne u samim tabelama, da ih `select('*')` ne vuče), `question_links` (direktna veza, odluka Etape 10), `timetable_entries.note`, RPC `question_candidates` i `match_notes`; prijedlog obima za poglavlja je pravilo bez LLM-a (PRD „Obim ispita“). `0023_fix_stale_embedding_trigger.sql`: triger iz 0021 je rušio svaki update `units`/`cards`/`topics` (nađeno u e2e, popravljeno uz OK)
- [x] `evals/`: fiksne slike sadržaja i rasporeda nastave, provjera Zod šeme i očekivanog broja jedinica
  - Slike sadržaja knjige, liste pitanja i rasporeda nastave (render iz HTML-a) + tekst skripte; `npm run eval` traži `GEMINI_API_KEY` u terminalu (SETUP 4.6) — isti slučajevi su prošli kroz deployane funkcije u e2e
- [x] `parse-toc` → DodajIzvor → Parsiranje (pregled: novo / izmijenjeno / arhivira se); slike sadržaja se brišu nakon parsiranja; zamjena privremenog izvora (gruba veličina) pravim sadržajem
- [x] Merge po `label` + testovi (merge iz Etape 3 se koristi i za AI uvoz)
- [x] Ručni unos: dugme „Procijeni težinu AI-jem“ u pregledu
- [x] `parse-questions`, teme pri uvozu (postojeće teme u promptu, ručne se ne prepisuju)
  - Teme se dedupliraju bez LLM-a (isto ime, pa gte-small sličnost ≥ 0.93); poslije uvoza pitanja ekran „Veze s poglavljima“ (AI prijedlog → pregled → Spasi; „Preskoči“ ostaje kao odbijena veza)
- [x] ObimIspita: AI prijedlog, ručna izmjena zaključana (prijedlog je pravilo bez LLM-a: poglavlja po redu i minutama po parcijalama, pitanja prate povezana poglavlja; samo za jedinice bez reda)
- [x] `parse-timetable` + „Uslikaj raspored“ i vrsta „Raspored nastave“ u „Daj sovi dokument“ (tekst ili slika sa „pon: od 9 do 10:30 (farma)“, napomene uz termin; uparivanje predmeta preko `fuse.js`), `propose-answer`
  - Odluka (Etapa 10): `parse_timetable` je vrsta „Raspored nastave“ u istom pipelineu kao `parse-document` (dokument se čuva u Dokumentima kao „Ostalo“, slika/PDF/tekst, poruka uz dokument sužava grupu); pregled novo / izmijenjeno / preskačem, termini idu u trenutni period nastave (bez njega poruka „Prvo dodaj semestar“)
- [x] `recall-questions` (`count` 3 za recall gate, 5–10 za kviz): AI pitanja iz bilješki, slika stranice (slika se briše), opće znanje (oznaka „može se razlikovati od predavanja“, računa se samo uz još jedan izvor); kviz sa Jedinice i iz sesije, ocjene u `review_logs` + FSRS, „Spasi kao karticu“. Zaseban `quiz` alat ne postoji (PRD „Testiranje bez sadržaja literature“)
  - AI pitanja se traže dugmetom (gate: 3, kviz: 6 odmah), opće znanje samo ne podiže poglavlje na „Razumijem“ (FSRS i `review_logs` se ipak upisuju); „Predloži odgovor“ (`propose-answer`) u gate-u i na Jedinici pitanja, spašen prijedlog nosi `answer_origin = 'ai'` i oznaku „AI prijedlog · provjeri“
- [x] Sova dobija ostale alate: pretraga bilješki, recall, raspored nastave i sadržaj kroz isti razgovor (osnova je iz Etape 6); uvoz iz razgovora („ubaci mi ovo“ za već dat dokument) kao kartica za pregled. Do tad sova iz razgovora ništa ne mijenja i to kaže (odluka iz Etape 6)
  - Odluka (Etapa 10): `answer` vraća jednu akciju (`search_notes`, `quiz`, `add_timetable`, `add_contents`, `import_document`), app je izvrši i prikaže karticu; pretraga bilješki je vektor + leksička provjera bez LLM-a, pa tekst bilješki ne ide u prompt; „ubaci mi ovo“ ponovo čita zadnji dokument iz razgovora kao izabranu vrstu i daje prijedlog za pregled
- [x] Povezani kalendari, vrsta „Rokovi“ (Moodle): kartica „N novih rokova iz Moodlea“ → pregled novo / izmijenjeno / preskačem → `deadlines`, uparivanje predmeta (`fuse.js`)
  - Migracija `0022_event_category.sql` (`external_events.category` iz ICS `CATEGORIES`, Moodle tu piše predmet); `sync-calendar` sinhronizuje i feedove „Rokovi“ (ne blokiraju vrijeme), pomjeren datum zadržava vezu na rok i „preskačem“; kartica je jedna od kartica akcije na Danas, pregled na `/today/moodle`
- [x] Web Share Target u manifestu (Android): podijeljen PDF/slika otvara „Daj sovi dokument“ sa prilogom
- [x] Kartice: izvoz CSV (Anki), uvoz teksta „pojam ⇥ definicija“
  - Uz Anki CSV i „Kartice za Quizlet · Kopiraj“ (tab / nova linija za Quizlet → Uvezi); uvoz na Jedinici prima tab ili crticu s razmakom (Quizletov izvoz)
- [x] Dorada poslije e2e: veze s poglavljima čekaju spašena pitanja i šire teme (#168), triger embeddinga (#169), ispitno pitanje testirano samo sebe u gate-u (#170), liste u prijedlogu odgovora (#171), favicon na iOS-u (#166)
- [x] **DoD** (uz opći DoD): uvoz sadržaja slikom i pitanja tekstom kroz AI s pregledom, merge po oznaci, teme i veze pitanje ↔ poglavlje; AI pitanja i kviz idu u `review_logs` i FSRS; asistent koristi alate bez direktnog pisanja; Moodle rokovi i raspored nastave kroz pregled → `v0.10.0` (browser e2e na previewu sa privremenim korisnikom, 390 px: slika sadržaja → 18 jedinica sa težinom, izvedenim stranicama i temama, slika obrisana; zalijepljena pitanja → „Veze s poglavljima“ 6/6 tačno → ObimIspita sa AI redovima; kviz iz bilješki → level 2, FSRS i `review_logs.source = notes`, „Spasi kao karticu“; ispitno pitanje → „Predloži odgovor“ → `answer_origin = 'ai'`, „Znam“; chat „gdje sam pisala o …“ → kartica bilješki, raspored nastave iz teksta → 2 termina u periodu nastave; Moodle feed → rok upisan i uparen, preskočen događaj ignorisan, pomjeren datum → „izmijenjeno“ → ažuriran; uvoz kartica, Anki CSV i Quizlet tekst. Web Share Target je u manifestu i service workeru, a dijeljenje s Android telefona ostaje za ručnu provjeru. 18 AI poziva ukupno; korisnik, fajlovi i lokalni ključevi obrisani)

## Etapa 10b — UX dorada i sigurnost

Odluke iz pregleda nakon Etape 10 (oktobar 2026): PRD „Navigacija, pretraga, teme i geste“, „Pregled“ (vodeći princip: manje odluka), design README „Odluke nakon v0.10.0“. Mockupi za Pretragu i Izgled (teme) prvo.

- [x] AI dugme samo ikona: bez labela i podvlake; isključeno `bg-white/30` + ikona `brand-accent`, uključeno `glass-tint` + bijela ikona; `aria-label` „AI asistent“
- [x] Sticky gornji red (`TopBar` u `AppShell`): `sticky top-0` + safe-area, sadržaj ispod se zamuti (`backdrop-filter` blur, maska za meku donju ivicu), fallback platno 0.92
- [x] Meni: naziv sekcije je link na glavnu stranicu (Plan, Predmeti, Napredak, Postavke), chevron je zasebno dugme 44 px; animirano otvaranje podstranica
- [x] Sheetovi: `BottomSheet` na shadcn Drawer (`vaul`), povlačenje nadolje zatvara, kriva `cubic-bezier(0.32, 0.72, 0, 1)` ~400 ms, `prefers-reduced-motion` → fade
  - Povlači se samo ručka (`handleOnly`): forme, označavanje teksta i scroll unutar sheeta ostaju kao prije; tastatura ide preko `--vv-bottom` (vaul `repositionInputs` isključen)
- [x] Exam kartice na Danas po mockupu: datum → ime → % → traka; dani do ispita desno u redu datuma; % i traka uvijek (bez izvora „—“), jednaka visina; traka 3 px radijus, track 0.65
- [x] Swipe ulijevo na listama (sesije, termini nastave, blokovi, izvori, predmeti, rokovi, dokumenti): arhiviraj / obriši / preskoči, toast Poništi, iste akcije u „⋯“ / dugom pritisku
  - Odluka (Etapa 10b): izvor dobija arhiviranje (`sources.archived_at`, migracija `0025_source_archive.sql`): arhiviran izvor ispada iz plana, napretka i obima, jedinice i historija ostaju; „Arhivirani izvori“ na predmetu ga vraćaju. Brisanje koje se ne može vratiti poslije (sesija, termin, rok, dokument) sakrije red odmah, a briše se tek kad toast Poništi istekne. Iste radnje: dugi pritisak, desni klik i skriveno dugme „Radnje“ (tastatura)
- [x] Pretraga: ikona u gornjem redu, indeks ekrana i postavki sa sinonimima + podaci iz keša, `fuse.js`, offline, nedavne
- [x] Teme boja: tokeni po `[data-theme]` (brand, `glass-tint`, `btn-primary`, magla, `theme-color`), bez hardkodirane rgba u utility-jima; Lavanda, Grafit, Pijesak, Kadulja, Okean; Postavke → Izgled; migracija `profiles.theme`
- [x] „Više vremena ovaj dan“ na Plan → Dan i u pretrazi (model `availability_days` postoji)
  - Jedan tap podiže maksimum tog dana (`availability_days.cap_min`: +30 min / +1 h / +2 h / +3 h) uz Poništi; ako je maksimum već koliko i slobodnog vremena, sheet upućuje na Dostupnost
- [x] Fokus kartica na Danas sa dva prstena po mockupu (`Danas.dc.html:35-46`): vanjski plan danas (`brand-accent`), unutrašnji sedmica (pink), 80 px; sada je jedan prsten u `FocusBar.tsx`
- [x] Blok na listi Danas: tap otvara “Započeti sesiju sada?” (Počni, Uredi, Preskoči, Obriši / Izbaci iz plana); “+ Dodaj blok” na listi; “Počni” na kartici Sljedeće ostaje direktan; “Odradila sam bez timera” (ručna sesija vezana za blok) i “Drugi predmet u ovo vrijeme” u “Obriši blok?”; postavka “Početak dana” se zove “Granica dana”
  - Granica dana nije red u Postavkama (predlaže je onboarding iz vremena lijeganja), pa nema šta preimenovati u appu; naslov sheeta nazad iz sesije je “Završi sesiju?” (odluka korisnice)
- [x] Nazad dok sesija radi (strelica, browser, Android gest): sheet Nastavi / Izađi, timer radi dalje / Završi ranije / Odbaci sesiju
- [x] BlockSheet: prekidač “Zadrži ovo vrijeme” (default uključen = ručni blok; isključen = AI blok koji replan smije presložiti) + “Vrati planu” na pojedinačnom ručnom bloku
- [x] Današnji dan se preslaže: današnji slobodni termini u `input_hash`, promjena dostupnosti / nastave / zauzetosti ponovo smjesti današnje nezapočete AI blokove od sada (toast + Poništi); više slobodnog vremena → kartica “Imaš X min više danas”; testovi u `state.ts` / `plan()`
  - Odluka (Etapa 10b): na svaku promjenu današnjih termina (ne samo kad blok više ne stane) današnji nezapočeti AI blokovi dobiju nova vremena; potpis termina je u `plan_runs.today_slots` (migracija `0024_theme_and_today_slots.sql`, uz `profiles.theme`), pa svaki uređaj zna šta se promijenilo. Danas se pri tome ne dodaje posao (kapacitet 0); dobijeno vrijeme nudi kartica
- [x] Sigurnost u CI: CodeQL, Dependabot, `npm audit --audit-level=high`, gitleaks, `supabase db lint` / advisors; RLS testovi (drugi korisnik i `anon`); `public/_headers` sa CSP-om
  - Odluka (Etapa 10b): repo postaje javan (CodeQL na privatnom ličnom repou ne radi bez plaćenog Code Security); prije toga gitleaks preko cijele historije mora biti zelen. RLS testovi su pgTAP (`supabase/tests/database/rls.test.sql`) u CI jobu `db` sa lokalnim Supabaseom (`auto_expose_new_tables = false` kao na hostovanom projektu). GitHub koraci u SETUP.md 2a
- [x] Dorada poslije pregleda na previewu: nazad iz sesije bez pitanja i „Završi“ uvijek sa sheetom, „Dodaj blok“ sa prijedlogom plana (spojeno „Imam još vremena“) i „Započeti odmah?“, djelimično pročitane jedinice (`units.read_amount`), arhiviranje ispita i popravni skriven dok ne zatreba (`0026`), Raspored sa zauzetošću iz kalendara i stvarnim vremenom odrađenih blokova, kvadratne kartice ispita, kalendar 00–24 sa pilulom mjeseca, teme i za sheetove i meni, sheetovi skrolaju na dodir (#179–#198)
- [x] **DoD** (uz opći DoD): svaka stavka provjerena na 390 px na telefonu, sigurnosni koraci zeleni u CI → `v0.10.1` (pregled na previewu potvrdila korisnica; CI: check, db, secrets, CodeQL zeleni; migracije 0024–0026 primijenjene)

## Etapa 10c — Akademska struktura, materijali i podsjetnici

PRD „Akademska godina i semestar“, „AI uvoz“ (plan i program, fakultet s interneta, raspored predavanja/vjezbi), „Povezani kalendari i integracije“ (materijali), „Scheduler“ (dan pred ispit), „Podsjetnici i notifikacije“, „Onboarding“ (1b, 6).

- [x] Mockupi: `AkademskaGodina`, `PlanIProgram`, `Materijali`, `DanPredIspit`, `Podsjetnici` (`.dc.html`, design README „Etapa 10c“)
  - Odluke uz mockupe: Predmeti po semestru; Drive folder = jedan izvor, PDF = jedinica; „Kasniš 15 min“ bez prekidača

- [x] Migracija: `academic_years`, `academic_periods.academic_year_id`, `subjects.academic_year_id` + `semester_no`, `profiles.institution` / `study_program` / `year_of_study` / `reminder_offsets_min`, `assessments.eve_reserved`, `sources.file_name` / `drive_file_id` / `external_url`, nove vrste `push_jobs` i `ai_task`; regenerisan `database.ts`
  - `0027_academic_structure_reminders.sql`; uz plan još `profiles.academic_search` (zadnja pretraga fakulteta čeka pregled), `plan_blocks.skip_requested_at` (Preskoči iz notifikacije bilježi server, app primijeni `skipBlock()` pri otvaranju) i `push_jobs.block_id` / `action_token_hash` / `action_used_at`
- [x] Predmeti grupisani po godini i semestru (trenutni otvoren, ostali sklopljeni, „prenesen“ za nepoložene), default semestar za novi predmet, kartica „Nova akademska godina“
  - `src/lib/academic/` (godina od 1. oktobra, semestar iz perioda nastave godine ili mjeseca, grupe, „prenesen“, ponuda nove godine); Postavke → Fakultet i godina (`/settings/academic`): podaci, akademske godine. Prva akademska godina uzme aktivne predmete bez godine (trenutni semestar); istekla godina nije trenutna, pa se njeni semestri sklope ispod „Ranije“ dok se ne doda nova
- [x] Onboarding korak 1b „Fakultet i godina“ (preskočiv) i podsjetnici u koraku 6
- [x] `find-academic-info`: web search kroz wrapper (Gemini grounding / Anthropic web search), lista dokumenata → `parse-document` pregled sa linkom na izvor
- [x] Plan i program (`syllabus`) u `parse-document`: literatura → izvori, sedmične teme → teme i tempo predavanja, bodovanje → ispiti i bodovi; pregled po predmetu
  - `_shared/academicSearch.ts`, `find-academic-info` (`search` / `fetch`), web search u `_shared/llm.ts` (Gemini grounding, Anthropic `web_search_20250305`), `src/lib/import/syllabus.ts` (prijedlog po predmetu, uparivanje knjiga po naslovu i autoru, „Upari sa…“), ekran „Nađeno na internetu“ (`/settings/academic/found`), kartica u onboardingu, pretraga poslije spašavanja fakulteta; promptfoo eval `syllabus.txt`
- [x] PDF s uređaja: outline + broj stranica preko `pdf.js` → pregled kao `parse-toc`; AI samo za stranice sadržaja kad nema outline-a
- [x] Google Drive Picker (`drive.file`): fajl ili folder → isti tok, izvor pamti `drive_file_id` i link; SETUP.md
  - `src/lib/outline/pdf.ts` (outline → jedinice preko istog parsera kao `parse-toc`, pomak iz oznaka stranica, stranice sadržaja, fajl = jedinica), `pdfRead.ts` (pdf.js), `drive.ts` (GIS token + Picker, preuzimanje u browser). Odluka: u Pickeru se biraju PDF-ovi (više odjednom, folder se otvori i označe svi), jer `drive.file` za izabran folder ne daje pouzdano pristup fajlovima u njemu; više fajlova = jedan izvor, fajl = jedinica. Prezentacije: svaki PDF je jedna jedinica sa brojem slajdova. CSP dozvoljava samo Google prijavu, Picker i Drive API
- [x] Dan pred ispit: kartica 3 dana prije, prekidač u ExamSheetu, `plan()` pravilo (samo taj predmet, ponavljanja drugih se pomjeraju, dva ispita zaredom → bliži), `input_hash` + testovi i property test (rezervisan dan nema blok drugog predmeta)
  - `src/lib/scheduler/eve.ts` (`reservedDays`, `eveCandidate`): zadnji dan sa slobodnim vremenom prije ispita, najviše 7 dana unazad; rezervisan dan ponavlja cijeli obim (i već ponovljeno), slabije jedinice prve; kartica „Dan pred ispit“ na Danas, prekidač u ExamSheetu, traka sa „Ukloni“ u Plan → Dan
- [x] Podsjetnici prije svakog bloka (pomaci, preskok samo iza započetog bloka, tihi sati), „kasniš 15 min“, akcije Započni (deep link) i Preskoči (`push-action`, jednokratni token); zamjenjuje `first_block` 10 min
  - Onboarding ima 9 koraka (1b je drugi; podsjetnici u koraku 7 „Pauze i podsjetnici“). Migracija `0028_push_job_actions.sql` (`push_jobs.actions`: tekstovi dugmadi i „Preskočeno“ na jeziku korisnika). `notify` prije slanja provjeri blok (nije započet, preskočen ni u toku prethodni), pa napravi jednokratni token (čuva se hash); `push-action` upiše `skip_requested_at`, a `PendingSkipRunner` u appu primijeni `skipBlock()`. Započni / tap: `/?block=<id>` otvara „Započeti sesiju sada?“
- **DoD** (uz opći DoD): plan i program sa interneta ili PDF-a → izvori, teme i bodovi kroz pregled; PDF sa outline-om → jedinice bez AI poziva; rezervisan dan pred ispit u planu; podsjetnik i Preskoči iz notifikacije na Androidu → `v0.10.2`

## Etapa 11a — ML temelj

Istraživanje i obrazloženje: [RESEARCH-ML-2026-10.md](RESEARCH-ML-2026-10.md). Python (`ml/`) trenira, TS (`src/lib/`) izvršava; artefakti su JSON sa `version` u `input_hash`. Higijena podataka ide prva, jer se podaci skupljaju od danas.

- [x] Istraživanje: adaptivni scheduling, ML i diskretna optimizacija (`docs/RESEARCH-ML-2026-10.md`)
- [ ] Migracija `ml_signals`: `review_logs.rating` (1–4), `state_before`, `difficulty_before`, `retrievability_before`; `plan_blocks` snimak featura pri planu (`day_load_min`, `days_to_goal`, `demand`, dio dana) i opcionalni `skip_reason`; `study_sessions.app_leaves` / `app_away_sec` (pomjereno iz Etape 11); upis u `review/apply.ts` i pri kreiranju blokova; `db:types`
- [ ] `ml/` (uv, numpy, pandas, scipy, scikit-learn, NumPyro, jupyter): izvoz podataka kao korisnik (RLS, parquet, bez slobodnog teksta), EDA notebook
- [ ] Simulator `scripts/sim/` (TS): pravi `plan()` + `placeTimes()` i model studenta (log-normalno trajanje uz planning fallacy, odrađenost po terminu i opterećenju, FSRS zaboravljanje, „Danas ne mogu“), seed; baseline metrike (R na ispitu × bodovi, deficit, propušteni blokovi, promjena plana, varijansa opterećenja)
- [ ] `src/lib/scheduler/feasibility.ts`: EDF / max-flow test izvodljivosti + property test „izvodljivo ⇒ `plan()` bez deficita“; LP (HiGHS wasm) samo ako test nađe propuste
- [ ] Model trajanja: hijerarhijski log-normalni (`src/lib/estimates/model.ts`, `priors.json`) umjesto `k/(k+5)`, `n/(n+3)`, `j/(j+2)`; P50/P80, plan po P80 za prioritet 4–5; backtest notebook (MAE log-minuta, pokrivenost P80) + test TS = Python
- [ ] Model odrađenosti bloka: Bayesovska logistička regresija (`src/lib/slots/`, prior iz Pythona, lični Laplace update); kapacitet po terminu umjesto jednog ρ; ulaz u ocjene termina i Thompson (Etapa 11) sa sigurnim istraživanjem (ε od najboljeg, ≤ 1 istraživački blok sedmično)
- [ ] Lični FSRS parametri (`@open-spaced-repetition/binding`, spike COOP/COEP; rezerva `fsrs-browser` ili `ml/`) od ~100 ponavljanja → `profiles.fsrs_params` → `srs/index.ts` i `input_hash`
- [ ] Ponavljanja ciljana na ispit: izbor po `ΔR(dan ispita) × bodovi` po minuti umjesto „bliži ispit, pa niži R“; simulator ne smije pokazati pad
- [ ] `ml/fsrs/`: reprodukcija srs-benchmarka na uzorku `anki-revlogs-10k` (portfolio)
- **DoD:** svaki model ima backtest u `ml/notebooks/`, test TS = Python i metrike simulatora u odnosu na baseline bez pogoršanja → `v0.10.3`

## Etapa 11 — Napredak

- [ ] Progres po izvoru, ispitu, predmetu i temi; jačina po temama (`recharts`)
- [ ] Statistika: sati vs plan, ispunjenost i ρ, fokus, efikasnost po dobu dana, poređenje predložaka sesije (SQL view / RPC)
- [ ] `src/lib/slots/`: signali po terminu (fokus uz razloge, brzina normalizovana težinom, odrađenost Beta, kašnjenje starta, ometanja), ocjena termina sa shrinkage-om i polu-životom 6 sedmica, Thompson uzorkovanje sa seedom + testovi; ulaz u `placeTimes()` i `input_hash`
- [ ] Kartice `avoid_slot` / `add_slot` (≥ 6 mjerenja), mapa termina na Napretku („Uči se… još N sesija“)
- [ ] `forecast()` Monte Carlo (uzorci iz posteriora trajanja i odrađenosti bloka iz Etape 11a; bootstrap dnevnih minuta dok modela nema, seed) + testovi; prognoza spremnosti kao raspon + vjerovatnoća na Danas i Napredak; procjena ocjene iz prognoze × R na dan ispita (PRD „Prognoza spremnosti“, „Projekcija ocjene“)
- [ ] Spremnost dan prije ispita (`readiness_before`, bodovi su iz Etape 5), signal precjenjivanja; `celebrating` 120 px u toastu/modalu za položen ispit
- [ ] `src/lib/strategist/`: kandidati akcija iz pravila sa izračunatim efektom + testovi
- [ ] `strategist` edge funkcija (sedmično / na dugme): bira najviše 3 kandidata i objašnjava (Zod: `candidate_id`), bez refleksija dok je Gemini free tier; odobravanje akcija jednim tapom → replan; akcije `set_priority`, `boost_priority`, `set_mode`, `set_campaign_start`, `avoid_slot`, `add_slot`; zaostatak po predavanjima i jačina po temama u ulazu
- [ ] Sedmični check-in (nedjelja): izuzeci za sljedeću sedmicu, prognoza, do 3 akcije; radi i bez AI-ja
- [ ] Uvidi na Napretku (PRD „Termini učenja“ → Uvidi): najproduktivniji termini, ometanja (`visibilitychange` + „Ometena sam“; kolone `app_leaves` / `app_away_sec` iz Etape 11a), ritam sesije, savjeti iz tabele Tehnike; svaki uvid sa jednom akcijom
- [ ] Ritam sesije (PRD „Timer, pauza i rekalibracija“): medijan do prve pauze, stvarne pauze, rano završene sesije → kartica „prebaci na 40/10?“ + testovi
- **DoD** → `v0.11.0`

## Etapa 12 — Notifikacije i dorada

- [ ] Ostale notifikacije (Web Push temelj je iz Etape 9, podsjetnici prije bloka i kašnjenje iz Etape 10c): propušten blok, ponavljanje, „Dokle ste stigli?“ nakon termina, kampanja počinje za 3 dana
- [ ] ICS izvoz plana: `calendar-feed` edge funkcija, `ics_token` (uključi / obnovi u Postavkama), ispiti, rokovi i opcionalno blokovi uz napomenu o kašnjenju Google-a
- [ ] Izvoz podataka (JSON) u Postavkama
- [ ] Postavke kompletne (plan, timer i predlošci, povezani kalendari, jezik, potrošnja AI iz `ai_runs`)
- [ ] Pristupačnost: touch ≥ 44 px, kontrast, aria, fokus
- [ ] Playwright E2E: onboarding, novi predmet, dodaj izvor, sesija, replan
- [ ] Eval suite (PRD „AI integracija“ → Eval suite): sve AI funkcije, Zod stopa, rubrike, budžet cijene/latencije, red-team prompt injection; CI na PR-ovima koji diraju `supabase/functions/**` ili `evals/**`, puni skup noćno
- [ ] `.github/workflows/backup.yml` (sedmični `db dump`, DB lozinka u Secrets)
- [ ] Lighthouse PWA i performanse
- **DoD** → `v1.0.0`

## Kasnije

- **v2 (odluka, oktobar 2026):** prstenovi i izazovi kao Apple Fitness, bez streaka koji puca (PRD „Tehnike učenja“); social (poslije otvaranja za više korisnika, traži dijeljenje mimo owner-only RLS-a).
- Tamni režim (teme iz Etape 10b su svijetle).
- Puni sadržaj materijala za asistenta, opt-in po izvoru (PRD „Materijali“, faza 3).
- Read-only demo nalog sa seed podacima za portfolio.
- MCP server (opcionalno): Hoot podaci i alati uvoza za vanjske AI klijente (npr. Claude Desktop). App ga ne treba; asistent koristi tool calling u edge funkciji.
- Prijedlog obima parcijale iz onoga što je pređeno na predavanjima do datuma parcijale.
- Google Calendar API (upis blokova odmah, OAuth; traži Google verifikaciju jer Testing režim daje token od 7 dana) kad se app otvori za više korisnika.
- Notion javna integracija (baza rokova → `deadlines`) samo ako paste kroz sovu ne bude dovoljan.
- Lični faktor brzine po jeziku izvora (`sources.language`).
- Opcionalno mjesto bloka („biblioteka“, „kuća“) uz predloženo vrijeme (namjera „kad i gdje“).
- Strategist kroz Message Batches API (−50%) kad bude više korisnika.
- Admin pregled (read-only): oznaka `role: admin` u `app_metadata`, funkcija `is_admin()` i dodatna `select` RLS politika po tabeli, ekran `/admin`.
- Otvaranje za više korisnika: domena, Resend domena, uključena registracija, odluka o AI troškovima ([SETUP.md](SETUP.md#6-otvaranje-aplikacije-za-više-korisnika)).

---

## Odluke iz Etape 1 (odstupanja od PRD-a)

- `0001_init.sql` dodaje: triger `set_updated_at` za sve tabele sa `updated_at`, triger koji pravi `profiles` red za novog korisnika, `created_at` na `deadlines`, `updated_at` na `source_mode_rates`, `timetable_entries`, `availability_*`, `plan_blocks`, `cards`, `profiles.display_name`, indekse po `user_id`/FK.
- Data API ne izlaže nove tabele automatski: migracija daje `grant` samo roli `authenticated`; `anon` nema pristup tabelama. `ai_runs` korisnik samo čita, a piše ga Edge Function preko service role. **Svaka nova migracija mora sadržavati i `grant` za nove tabele.**
- Bucket se zove `uploads` svuda (pravi ga migracija, sa politikom vlastitog foldera).
- Zod šeme dijeljene sa Edge Functions žive u `supabase/functions/_shared/` (alias `@shared/`).
- `LlmRequest.task` koristi enum `ai_task` iz baze.
- Supabase API ključ je novi „publishable" (`sb_publishable_…`), env `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Linter je oxlint (Vite 8 default) umjesto ESLinta.
- Font Outfit se servirao lokalno (`@fontsource-variable/outfit`); od redizajna (Liquid Glass) je to Geist (`@fontsource-variable/geist`) iza sistemskog SF Pro.

## Prompt za Etapu 9 (sljedeći chat)

> Pročitaj CLAUDE.md, docs/PRD.md (sekcije „Scheduler, replan i AI strategist“ → „Spaced repetition (FSRS)“ cijela, „Model izvora, jedinica i progresa“ → „Izvor Pitanja“, „Tehnike učenja ugrađene u app“ (recall gate, blurting, pitanja kao glavni put), „Testiranje bez sadržaja literature“ (sedam izvora testiranja i odluka nakon Etape 7), „Timer, pauza i rekalibracija“ (kraj pauze, `break_ends_at`, dvije vrste pauze), „Podaci za strategista“ (`review_logs`), „Šema baze podataka“ → „Kasnije migracije“ (`0017_fsrs.sql`)), docs/ROADMAP.md (Etapa 9), docs/design/README.md (Liquid Glass, Navigacija i mrvice, odluke nakon 8b) i mockupe RecallGate, ProvjeraZnanja, ProvjeraSazetak, KrajSesije, Jedinica, Predmet (kartica „Jačina znanja“), Danas (kartica „Znanje slabi“) i Napredak (jačina po temama samo kao referenca, ekran je Etapa 11). Mockupi trebaju support.js koji nije u repou, pa tekstove i demo podatke čitaj iz HTML-a i `<script>` bloka. Onda uradi Etapu 9 — Recall gate, provjera znanja, FSRS i osnovni push.
> Isti tok kao do sad: mali PR-ovi u `dev`, svaki mergeaj sam (squash) kad CI prođe; release `dev → main` + tag `v0.9.0` tek kad potvrdim na previewu (dev.hoot-5ig.pages.dev). Prije release-a označi stavke i DoD u ROADMAP-u. Ako se PRD i mockup ne slažu ili je PRD nejasan, pitaj s opcijama i preporukom, pa odluku upiši u PRD/ROADMAP. Za `npx supabase db push` mi treba eksplicitno OK uz `--dry-run` ispis. Ako treba nešto u dashboardu (VAPID ključevi, secrets, `pg_cron`), napiši mi tačne korake i ažuriraj SETUP.md.
> Redoslijed:
> 1. **Čista logika:** `src/lib/srs/` sa `ts-fsrs` (FSRS v6): recall 0/1/2 → Again/Hard/Good, ciljno zadržavanje po prioritetu (+0.03 za poglavlja, najviše 0.93), `next_review_on` (nikad poslije ispita; ako bi pao iza, ponavljanje u bufferu), R(t) i R na dan ispita, level 2 na uspjeh i level 3 nakon 4 uzastopna uspjeha, pad levela na 0; jačina po jedinici/temi/izvoru/predmetu/ispitu ponderisana minutama (računa se, ne snima), kartice kao zasebni FSRS objekti koji ulaze u jačinu jedinice. Unit testovi + `fast-check` gdje ima invarijanti (R opada sa vremenom, datum ponavljanja ≤ ispit).
> 2. **Migracija `0017_fsrs.sql` samo aditivno:** FSRS kolone na `units` i `cards`, `review_logs.card_id` (+ šta još treba), regenerisan `database.ts`. Dev i prod dijele istu bazu, a v0.8.0 još čita SM-2 kolone (`srs_ease`, `srs_interval_days`, `sources.srs_multiplier` u `src/features/sources/api.ts`), pa se one NE brišu u 0017: prestani ih koristiti u kodu, a brisanje ide u posebnu migraciju poslije release-a v0.9.0 (zapiši to u ROADMAP).
> 3. **Ekrani:** RecallGate nakon „Pročitano“ u KrajSesije (ispitna pitanja povezana preko tema, bilješke bez AI-ja, podnaslovi, blurting, kartice; tačan odgovor pa ocjena 0–2; preskočen gate → provjera pročitanog za 2 dana), u sesiji nakon čitanja poglavlja ponudi povezana pitanja; „Razumijem“/„Ponovljeno“ (pitanja: „Znam“) samo kroz gate; ProvjeraZnanja (review blok kao niz gate-ova) → ProvjeraSazetak (promjena jačine); kartica „Znanje slabi“ na Danas (pazi na pravilo: najviše jedna kartica akcije iznad liste) i „Jačina znanja“ na Predmetu i Jedinici.
> 4. **Scheduler:** `review` blokovi iz pravog `next_review_on` (logika postoji u `plan()` od 8b, testirana sa ručno postavljenim datumima), `review_cap_pct`, prije starta kampanje samo ponavljanja već naučenog, R na dan ispita ≥ cilj; `review_logs` upis (proteklo dana, stabilnost prije/poslije). Sve novo ulazi u `input_hash`.
> 5. **Web Push temelj:** service worker (vite-plugin-pwa, injectManifest ako treba), pretplata u Postavkama, `notify` edge funkcija + `pg_cron`; obavještenja: prvi blok dana i kraj planirane pauze (`break_ends_at`; slobodna pauza nema push). Otkazivanje pri izlasku iz pauze. iOS radi samo za instaliranu PWA, pa to napiši u UI i SETUP.md.
> 6. **End-to-end na previewu** sa privremenim test korisnikom: onboarding sa grubom veličinom ili ručnim sadržajem i par pitanja, sesija → Pročitano → recall gate → ocjena → `next_review_on` i level u bazi, review blok u planu, ProvjeraZnanja, push pretplata. Na kraju obriši korisnika zajedno sa fajlovima u storageu.
> Napomene:
> - FSRS i raspoređivanje su deterministički kod u `src/lib/`, nikad LLM; AI izvori pitanja (`recall-questions`, slika stranice, opće znanje) su Etapa 10, ovdje ih nema i ne troši Gemini kvotu.
> - Jačina znanja i progres se računaju iz `units`/`cards`/`review_logs`, nikad se ne snimaju. UI skala: 85%+ Jako, 75–84 Dobro, 60–74 Slabi, ispod 60 Zaboravlja se.
> - Tekst neutralan, bez streakova i kazni; dugmad „Spasi“; svaki tekst u `bs.json` i `en.json` (ključevi su tipizirani).
> - Navigacija od 8b: logo/AI/☰ red i mrvice na svim ekranima osim onboardinga i sesije; nova ruta mora dobiti mrvicu u `crumbsFor()` (`src/app/crumbs.ts`) + test. Back samo kroz mrvice/`goBack()`. Plan je jedan kalendar (Dan/Mjesec). Ekrani sesije su u `PlainLayout` (ima Toast).
> - Postojeće brze akcije (Preskoči, kašnjenje, Imam samo, Imam još vremena, Danas ne mogu) ne smiju se pokvariti: review blokovi idu kroz isti `useStartBlock`/`pickForTime()`, a „Imam još vremena“ već bira provjeru koja je na redu prije novog gradiva.
> - oxlint `--deny-warnings`: hookovi i pomoćne funkcije ne u istom fajlu sa komponentama, bez setState u effectu. Lokalni harness (`preview.html` + `src/preview.tsx`, nisu u gitu) sam montira `ReplanRunner`; parametri `path`, `click`, `delay`, `start=1`, `noreplan=1`; prije svakog chrome pokretanja `pkill -f remote-debugging-pipe`. Service role nema grant na korisničke tabele: podatke test korisnika čitaj kao taj korisnik (anon ključ + lozinka) preko RLS-a.
> - U commitima i PR-ovima nema AI potpisa.

## Prompt za početak etape (primjer)

> Pročitaj docs/PRD.md i docs/ROADMAP.md i uradi Etapu 1: kostur projekta, migraciju 0001_init.sql, login, i18n i deploy. Radi na grani `feat/foundation` iz `dev`, otvori PR u `dev` kad je DoD ispunjen.
