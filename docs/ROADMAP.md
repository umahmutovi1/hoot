# Hoot — Roadmap

Plan izvedbe od praznog foldera do `v1.0.0`. Specifikacija je u [PRD.md](PRD.md), dizajn u [design/](design/README.md), ručna podešavanja servisa u [SETUP.md](SETUP.md). Etape 1–12 prate redoslijed iz PRD sekcije „Roadmap i odluke"; poslije svake etape app radi i deployan je.

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
- [x] **DoD** (uz opći DoD): novi korisnik prođe onboarding na telefonu za ~3 min i dobije plan koji poštuje nastavu, povezani Google kalendar i izabrane periode → `v0.8.0` (browser e2e na previewu sa privremenim korisnikom, 390 px: raspored nastave, iCal feed sa zauzetošću (ponavljanje, cjelodnevni i slobodni događaj, prelaz na zimsko vrijeme), periodi jutro + veče bez nedjelje, predmet sa grubom veličinom → plan bez preklapanja sa nastavom i zauzetošću, u periodima i ispod maksimuma; „Danas ne mogu“ + Poništi, „Imam samo“, UrediBlok (izmjena zaključava, novi ručni blok, Prebaci), Replan sheet „Smanji obim“ i plan u chatu na pravoj bazi. Popravke iz testa: #114, #115, #116, #117)

## Etapa 9 — Recall gate, provjera znanja, FSRS i osnovni push

- [ ] Web Push temelj: service worker, pretplata, `notify` edge funkcija, `pg_cron`; prvi blok dana i kraj pauze (`break_ends_at`) ([SETUP.md](SETUP.md): VAPID ključevi)
- [ ] Nakon čitanja/ponavljanja poglavlja u sesiji odmah ponuditi povezana ispitna pitanja; izvor „Pitanja“ se mjeri uspjehom, ne vremenom (PRD „Izvor Pitanja“)
- [ ] RecallGate: ispitna pitanja, bilješke (bez AI za sad), podnaslovi, blurting, kartice; prikaz tačnog odgovora pa ocjena 0–2 (AI izvori dolaze u Etapi 10; svih 7 izvora je u v1)
- [ ] Status „Razumijem“ i „Ponovljeno“ (pitanja: „Znam“) samo kroz recall gate; do Etape 7 se biraju ručno
- [ ] Migracija `0017_fsrs.sql` (SM-2 kolone i `srs_multiplier` van, FSRS kolone i na `cards`, `review_logs.card_id`), regenerisan `database.ts`
- [ ] `src/lib/srs/` sa `ts-fsrs`: recall 0/1/2 → Again/Hard/Good, ciljno zadržavanje po prioritetu (+0.03 za poglavlja), `next_review_on`, ograničenje na datum ispita, R na dan ispita ≥ cilj (ponavljanje u bufferu), level 3 nakon 4 uspjeha + testovi
- [ ] Kartice kao zasebni FSRS objekti u `review` blokovima; jačina jedinice uključuje kartice
- [ ] Jačina znanja R(t) po jedinici, temi, izvoru, predmetu, ispitu (računa se, ne snima) + testovi
- [ ] Provjera pročitanog: preskočen gate → provjera za 2 dana; neuspjeh vraća jedinicu u učenje
- [ ] `review_logs` (proteklo dana, stabilnost prije/poslije), prelaz na level 2/3, review i recap blokovi u scheduleru, dnevni limit ponavljanja (`review_cap_pct`), prije starta kampanje samo ponavljanja već naučenog
- [ ] ProvjeraZnanja: review blok kao niz recall gate-ova + sažetak promjene jačine; kartica „Znanje slabi“ na Danas; kartica „Jačina znanja“ na Predmetu
- **DoD** → `v0.9.0`

## Etapa 10 — AI sadržaj i asistent

Wrapper, `ai_runs`, rate limit, `image.ts` i pgvector su iz Etape 6.

- [ ] Anthropic: kartica, workspace ključ, `LLM_PROVIDER=anthropic`, prompt caching za sistemske promptove (ako je kartica dodana)
- [ ] Embeddings (`gte-small`) za jedinice, bilješke, kartice, pitanja i teme; prijedlog veza pitanje ↔ poglavlje i dedupe tema bez LLM poziva
- [ ] `evals/`: fiksne slike sadržaja i rasporeda nastave, provjera Zod šeme i očekivanog broja jedinica
- [ ] `parse-toc` → DodajIzvor → Parsiranje (pregled: novo / izmijenjeno / arhivira se); slike sadržaja se brišu nakon parsiranja; zamjena privremenog izvora (gruba veličina) pravim sadržajem
- [ ] Merge po `label` + testovi (merge iz Etape 3 se koristi i za AI uvoz)
- [ ] Ručni unos: dugme „Procijeni težinu AI-jem“ u pregledu
- [ ] `parse-questions`, teme pri uvozu (postojeće teme u promptu, ručne se ne prepisuju)
- [ ] ObimIspita: AI prijedlog, ručna izmjena zaključana
- [ ] `parse-timetable` + „Uslikaj raspored“ i vrsta „Raspored nastave“ u „Daj sovi dokument“ (tekst ili slika sa „pon: od 9 do 10:30 (farma)“, napomene uz termin; uparivanje predmeta preko `fuse.js`), `propose-answer`
- [ ] `recall-questions` (`count` 3 za recall gate, 5–10 za kviz): AI pitanja iz bilješki, slika stranice (slika se briše), opće znanje (oznaka „može se razlikovati od predavanja“, računa se samo uz još jedan izvor); kviz sa Jedinice i iz sesije, ocjene u `review_logs` + FSRS, „Spasi kao karticu“. Zaseban `quiz` alat ne postoji (PRD „Testiranje bez sadržaja literature“)
- [ ] Sova dobija ostale alate: pretraga bilješki, recall, raspored nastave i sadržaj kroz isti razgovor (osnova je iz Etape 6); uvoz iz razgovora („ubaci mi ovo“ za već dat dokument) kao kartica za pregled. Do tad sova iz razgovora ništa ne mijenja i to kaže (odluka iz Etape 6)
- [ ] Povezani kalendari, vrsta „Rokovi“ (Moodle): kartica „N novih rokova iz Moodlea“ → pregled novo / izmijenjeno / preskačem → `deadlines`, uparivanje predmeta (`fuse.js`)
- [ ] Web Share Target u manifestu (Android): podijeljen PDF/slika otvara „Daj sovi dokument“ sa prilogom
- [ ] Kartice: izvoz CSV (Anki), uvoz teksta „pojam ⇥ definicija“
- **DoD** → `v0.10.0`

## Etapa 11 — Napredak

- [ ] Progres po izvoru, ispitu, predmetu i temi; jačina po temama (`recharts`)
- [ ] Statistika: sati vs plan, ispunjenost i ρ, fokus, efikasnost po dobu dana, poređenje predložaka sesije (SQL view / RPC)
- [ ] `src/lib/slots/`: signali po terminu (fokus uz razloge, brzina normalizovana težinom, odrađenost Beta, kašnjenje starta, ometanja), ocjena termina sa shrinkage-om i polu-životom 6 sedmica, Thompson uzorkovanje sa seedom + testovi; ulaz u `placeTimes()` i `input_hash`
- [ ] Kartice `avoid_slot` / `add_slot` (≥ 6 mjerenja), mapa termina na Napretku („Uči se… još N sesija“)
- [ ] `forecast()` Monte Carlo (bootstrap dnevnih minuta, seed) + testovi; prognoza spremnosti kao raspon + vjerovatnoća na Danas i Napredak; procjena ocjene iz prognoze × R na dan ispita (PRD „Prognoza spremnosti“, „Projekcija ocjene“)
- [ ] Spremnost dan prije ispita (`readiness_before`, bodovi su iz Etape 5), signal precjenjivanja; `celebrating` 120 px u toastu/modalu za položen ispit
- [ ] `src/lib/strategist/`: kandidati akcija iz pravila sa izračunatim efektom + testovi
- [ ] `strategist` edge funkcija (sedmično / na dugme): bira najviše 3 kandidata i objašnjava (Zod: `candidate_id`), bez refleksija dok je Gemini free tier; odobravanje akcija jednim tapom → replan; akcije `set_priority`, `boost_priority`, `set_mode`, `set_campaign_start`, `avoid_slot`, `add_slot`; zaostatak po predavanjima i jačina po temama u ulazu
- [ ] Sedmični check-in (nedjelja): izuzeci za sljedeću sedmicu, prognoza, do 3 akcije; radi i bez AI-ja
- **DoD** → `v0.11.0`

## Etapa 12 — Notifikacije i dorada

- [ ] Ostale notifikacije (Web Push temelj je iz Etape 9): propušten blok, ponavljanje, „Dokle ste stigli?“ nakon termina, kampanja počinje za 3 dana
- [ ] ICS izvoz plana: `calendar-feed` edge funkcija, `ics_token` (uključi / obnovi u Postavkama), ispiti, rokovi i opcionalno blokovi uz napomenu o kašnjenju Google-a
- [ ] Izvoz podataka (JSON) u Postavkama
- [ ] Postavke kompletne (plan, timer i predlošci, povezani kalendari, jezik, potrošnja AI iz `ai_runs`)
- [ ] Pristupačnost: touch ≥ 44 px, kontrast, aria, fokus
- [ ] Playwright E2E: onboarding, novi predmet, dodaj izvor, sesija, replan
- [ ] `.github/workflows/backup.yml` (sedmični `db dump`, DB lozinka u Secrets)
- [ ] Lighthouse PWA i performanse
- **DoD** → `v1.0.0`

## Kasnije

- Read-only demo nalog sa seed podacima za portfolio.
- MCP server (opcionalno): Hoot podaci i alati uvoza za vanjske AI klijente (npr. Claude Desktop). App ga ne treba; asistent koristi tool calling u edge funkciji.
- Lični FSRS parametri (`@open-spaced-repetition/binding` optimizer) kad bude ~100+ ponavljanja u `review_logs`.
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

## Prompt za Etapu 8 (sljedeći chat)

> Pročitaj CLAUDE.md, docs/PRD.md (sekcije „Onboarding“, „Povezani kalendari i integracije“, „Scheduler, replan i AI strategist“, „Prioritet i režim učenja“ uključujući „Šta korisnik vidi“, „Praćenje predavanja“, „Timer, pauza i rekalibracija“ → „Predlošci sesije“, „Procjena težine i vremena“ → 5, „Termini učenja“ (samo prior iz onboardinga; ocjene termina su Etapa 11), „Raspored nastave“ → „Dostupnost“, „Akademski kalendar“, „Željena ocjena kao ulaz u plan“, „AI uvoz, dokumenti i asistent“ → „Redizajn“, „Šema baze podataka“ → migracije 0014–0016), docs/ROADMAP.md (Etapa 8), docs/RESEARCH-2026-10.md (obrazloženje), docs/design/README.md (Liquid Glass, odluke pri implementaciji redizajna) i mockupe Onboarding* (8 koraka), DanasPrazno (checklist), Danas, DanasSlobodno, DanasNeMogu, ImamSamo, KrenimoIspocetka, Chat (plan u chatu), Plan, PlanDan, Satnica, Replan, UrediBlokNovi/Uredi/Obrisi, Predmet (sekcija „Cilj“), PredmetKampanja, NoviPredmet/NoviPredmetNapredno, Dostupnost, PokreniSesiju, Sesija („Ometena sam“), KrajSesijeFokus, Postavke, PovezaniKalendari i DodajKalendar, pa uradi Etapu 8 — Onboarding i scheduler.
> Isti tok kao u Etapama 2–7: podijeli etapu na manje PR-ove u `dev`, svaki PR mergeaj sam (squash) kad CI prođe, a release `dev → main` + tag `v0.8.0` tek kad potvrdim na previewu (dev.hoot-5ig.pages.dev). Prije release-a označi DoD u ROADMAP-u. Ako se PRD i mockup ne slažu ili je PRD nejasan, pitaj s opcijama i preporukom, pa odluku upiši u PRD/ROADMAP. Ako treba nešto u dashboardu (npr. `pg_cron`), napiši mi tačne korake i ažuriraj SETUP.md.
> Redoslijed:
> 1. **8a logika i baza:** predlošci sesije u `src/lib/session/timer.ts` + Zod u `_shared/` + testovi; migracija `0014_onboarding_and_presets.sql`; neto dostupnost sa zauzetošću iz feedova u `src/lib/schedule/` + testovi; migracija `0015_calendar_feeds.sql`; `sync-calendar` edge funkcija sa fiksnim `.ics` primjerima (Google, Outlook, iCloud, Moodle; RRULE, EXDATE, RECURRENCE-ID, cjelodnevni, TRANSPARENT, CANCELLED) kao testovima.
> 2. **8a ekrani** (mockupi su gotovi, Liquid Glass): predlošci u PokreniSesiju/Postavkama, čipovi razloga (KrajSesijeFokus) i „Ometena sam“, onboarding (Onboarding → OnboardingSedmica, checklist na DanasPrazno), gruba veličina gradiva, Povezani kalendari i DodajKalendar. Javi mi kad je 8a na previewu, da prođem onboarding na telefonu prije schedulera.
> 3. **8b čista logika:** `plan()`, `placeTimes()`, `pickForTime()`, faktor realizacije, limit rasta i `input_hash` u `src/lib/scheduler/` sa unit testovima iz ROADMAP-a i property testovima (`fast-check`); tek onda migracija `0016_manual_blocks.sql`, upis planova, okidači replana i ekrani (Danas sa pravom karticom „Sljedeće“ i „Rasporedom“, DanasNeMogu, ImamSamo, PlanDan, Satnica, Replan, UrediBlok, kartice prijedloga, sekcija „Cilj“, plan u chatu).
> Napomene:
> - Dizajn je Liquid Glass: koristi `glass`, `glass-strong`, `glass-sheet`, `glass-bar`, `glass-tint`, `btn-primary`, `icon-tile` i tokene iz `src/index.css`, ne raw hex ni inline `backdrop-filter`. Bez maskote; asistent je „AI“ / „asistent“, nikad „sova“. Zaglavlja tabova preko `PageTitle actions`.
> - Kartica „Sljedeće“ na Danas (`src/features/today/NextCard.tsx`) do schedulera nudi slobodnu sesiju; u 8b pokazuje sljedeći blok (Počni → sesija tog bloka), a slobodna sesija ostaje u PokreniSesiju. Timer dugmeta u navu nema.
> - Scheduler je deterministički kod, nikad LLM; ova etapa nema novih AI poziva. Onboarding uvoz akademskog kalendara koristi postojeći `parse-document` (Gemini free tier, ~500 zahtjeva dnevno, ne troši ga u testovima). `sync-calendar` i `pickForTime()` nemaju LLM.
> - Isti ulaz = isti plan i ista satnica: svaka nasumičnost ima seed iz `input_hash`, a u hash ide svaki ulaz (povezani kalendari, ρ, zadani predložak, prioriteti, ručni blokovi…).
> - Replan nikad dok timer radi; današnja lista se ne mijenja ispod korisnika osim kad je dan postao nemoguć; ručni blokovi (`origin = 'user'`) se nikad ne brišu ni pomjeraju.
> - Tajni iCal link je lozinka: nikad u logove, `ai_runs`, poruke grešaka ni klijentski keš osim maskiranog prikaza.
> - Danas iznad liste blokova ima najviše jednu karticu akcije; „Znaš li?“ ostaje isključena (`SHOW_FACT_CARD`).
> - Prioritet u UI je „Koliko ti je bitan“ sa imenima bez brojeva; ciljna pokrivenost, zadržavanje i buffer nikad nisu polja.
> - Tekst prijedloga je neutralan (bez „zaostaješ“, bez streakova); „Danas ne mogu“ pravi blokove `skipped`, ne „propušteno“.
> - Back dugmad samo preko `goBack()` iz `src/app/navigation.ts`; ekrani preko cijelog ekrana imaju ljepljivo zaglavlje sa `env(safe-area-inset-top)`; svaki sheet ima ×. Dugmad u bosanskom pišu „Spasi“ (nikad „Snimi“); svaki tekst u `bs.json` i `en.json`.
> - Za end-to-end test koristi privremenog test korisnika (service key samo u varijabli shell-a, npr. iz `npx supabase projects api-keys --reveal`), screenshotove na 390 px kroz instalirani Chrome (`playwright-core` u scratchpadu, `channel: 'chrome'`), prođi onboarding od nule i obriši korisnika na kraju zajedno sa fajlovima u storageu.
> - Recall gate, FSRS i Web Push su Etapa 9: ovdje `review` blokovi i mikro-blokovi postoje u `plan()` (testovi sa ručno postavljenim `next_review_on`), ali bez ekrana provjere.

## Prompt za početak etape (primjer)

> Pročitaj docs/PRD.md i docs/ROADMAP.md i uradi Etapu 1: kostur projekta, migraciju 0001_init.sql, login, i18n i deploy. Radi na grani `feat/foundation` iz `dev`, otvori PR u `dev` kad je DoD ispunjen.
