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
- [x] Danas: kartica „Znaš li?“ — jedna istražena činjenica o učenju dnevno, sa izvorom (link)
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

- [ ] `supabase/functions/_shared/`: `llm.ts`, `providers/gemini.ts` (`responseSchema` iz `z.toJSONSchema()`), `providers/anthropic.ts` (`zodOutputFormat()` + `messages.parse()`), `schemas.ts` (bez rekurzivnih šema), `prices.ts`, `cors.ts`
- [ ] Logiranje u `ai_runs`, rate limit 30 poziva/dan, jedan retry na Zod grešku; `LLM_PROVIDER`, `LLM_MODEL`, `GEMINI_API_KEY` kao Supabase secrets
- [ ] Migracija `0008_ai_documents.sql` (pgvector, `documents`, `document_chunks`, novi `ai_task`), regenerisan `database.ts`
- [ ] `src/lib/image.ts` (1600 px, `browser-image-compression`), upload u `uploads/<user_id>/`; PDF ide direktno
- [ ] Ekran „Uvezi“: tekst / slika / PDF → `parse-academic-calendar` i `parse-exam-schedule` → pregled novo / izmijenjeno → snimanje; uparivanje predmeta (`fuse.js`)
- [ ] Dokumenti fakulteta: lista, upload, odlomci + embeddings (`gte-small`), RPC pretrage, `answer` sa citatima (dokument, stranica)
- [ ] `evals/` sa `promptfoo`: fiksni primjeri kalendara i rasporeda ispita
- [ ] AI dugmad onemogućena offline i bez ključa (poruka)
- **DoD** → `v0.6.0`

## Etapa 7 — Timer i sesije

- [ ] Maskota: `timer` 84 px u sheetu „Šta učiš sad?", `celebrating` 140 px na KrajSesije, `sleeping` 190 px u offline poruci
- [ ] Timer dugme → PokreniSesiju (preporučeni blok / drugi blok / slobodna sesija; nastavak aktivne)
- [ ] Sesija: segmenti u bazi, pauza/nastavak, „Sad radim na", režimi 25/5, 50/10, slobodno, način učenja
- [ ] KrajSesije: težina 1–5 po jedinici, fokus 1–3, refleksija; raspodjela minuta u `session_units`
- [ ] Zaboravljen timer (> 3 h) — ispravka kraja
- [ ] Offline: Dexie red u `src/lib/sync/`, klijentski UUID, upsert, retry, last-write-wins po `updated_at`
- [ ] Kalibracija (shrinkage, izvor × način, fallback ispod 3 mjerenja) + testovi
- **DoD:** timer preživi zaključan telefon, zatvoren tab i offline → `v0.7.0`

## Etapa 8 — Scheduler

- [ ] `plan(state)` u `src/lib/scheduler/`: kapacitet, ponavljanja, preostali rad po cilju, buffer, hitnost, redoslijed, tipovi blokova, dijeljenje dugih jedinica, deficit, „zašto ovo danas"
- [ ] `placeTimes()` za Satnicu
- [ ] `plan()` dopune: težina prioriteta, ciljna pokrivenost (obavezno / opcionalno), ALAP start kampanje + margina, ručni override i „Počni odmah“, privremeno pojačanje prioriteta („Uzmi vrijeme od …“ sa izračunatom razlikom plana), meki rokovi predavanja (redovni režim), „samo ako zatreba“ ispiti, rezanje deficita od najnižeg prioriteta, kapacitet minus ručni blokovi, ciljna pokrivenost iz željene ocjene (PRD „Željena ocjena kao ulaz u plan“), novi razlozi „zašto ovo danas“
- [ ] Testovi: prazna dostupnost, dva ispita isti dan, deficit, propušten dan, buffer, više ispita po predmetu, idempotentnost, start kampanje, ručni start, dvije kampanje u istoj sedmici, rezanje po prioritetu, ciljna pokrivenost, meki rok predavanja, ručni blok preživi replan
- [ ] Property testovi (`fast-check`): kapacitet dana se nikad ne prekorači, ručni blokovi se ne mijenjaju, isti ulaz = isti plan
- [ ] Migracija `0009_manual_blocks.sql`; ručni blokovi: UrediBlok (dodaj / izmijeni / obriši), izmjena AI bloka ga zaključava, brisanje AI bloka pita „Prebaci“ / „Izbaci iz plana“ (`assessment_units.included = false`), undo toast, katanac u listi
- [ ] Kartice prijedloga (zaostatak sa „Uzmi vrijeme od“ / „Kreni ranije“ / „Dodaj X min dnevno“, deficit, željena ocjena nedostižna, najava kampanje 3 dana prije) na Danas i Predmetu; jedan tap mijenja ulaz → replan
- [ ] `input_hash`, upis u `plan_runs` / `plan_blocks` / `plan_block_units`
- [ ] Okidači replana (debounce 2 s, nikad dok timer radi, prvo otvaranje u danu → „propušteno")
- [ ] Replan sheet: deficit + 3 opcije
- [ ] Maskota: `sleeping` 190 px na DanasSlobodno (dan bez blokova), `sleeping-head` 76 px u Replan sheetu, `timer-head` u praznoj Satnici već postoji
- [ ] Danas ekran (fokus bar, Sljedeći blok, lista, 3 ispita, savjet) i Satnica tab
- **DoD** → `v0.8.0`

## Etapa 9 — Recall gate, provjera znanja i FSRS

- [ ] Maskota: `celebrating-head` uz potvrdu „Sjećam se", `celebrating` 120 px na sažetku ProvjeraZnanja
- [ ] RecallGate: ispitna pitanja, bilješke (bez AI za sad), podnaslovi, blurting, kartice; prikaz tačnog odgovora pa ocjena 0–2
- [ ] Status „Razumijem“ i „Ponovljeno“ (pitanja: „Znam“) samo kroz recall gate; do Etape 7 se biraju ručno
- [ ] Migracija `0010_fsrs.sql` (SM-2 kolone i `srs_multiplier` van), regenerisan `database.ts`
- [ ] `src/lib/srs/` sa `ts-fsrs`: recall 0/1/2 → Again/Hard/Good, ciljno zadržavanje po prioritetu, `next_review_on`, ograničenje na datum ispita, level 3 nakon 4 uspjeha + testovi
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
- [ ] `parse-toc` → DodajIzvor → Parsiranje (pregled: novo / izmijenjeno / arhivira se); slike sadržaja se brišu nakon parsiranja
- [ ] Merge po `label` + testovi (merge iz Etape 3 se koristi i za AI uvoz)
- [ ] Ručni unos: dugme „Procijeni težinu AI-jem“ u pregledu
- [ ] `parse-questions`, teme pri uvozu (postojeće teme u promptu, ručne se ne prepisuju)
- [ ] ObimIspita: AI prijedlog, ručna izmjena zaključana
- [ ] `parse-timetable` + „Uslikaj raspored“ (uparivanje predmeta preko `fuse.js`), `recall-questions`, `propose-answer`, `quiz`
- [ ] Chat asistent: pretraga dokumenata i bilješki, sažetak stanja, prijedlozi kao kartice sa pregledom (isti alati kao uvoz), historija razgovora
- **DoD** → `v0.10.0`

## Etapa 11 — Napredak

- [ ] Progres po izvoru, ispitu, predmetu i temi; jačina po temama (`recharts`)
- [ ] Statistika: sati vs plan, ispunjenost, fokus, efikasnost po dobu dana (SQL view / RPC)
- [ ] Prognoza spremnosti na Danas i Napredak; procjena ocjene iz prognoze (PRD „Projekcija ocjene“)
- [ ] Spremnost dan prije ispita (`readiness_before`, bodovi su iz Etape 5); `celebrating` 120 px u toastu/modalu za položen ispit
- [ ] Maskota: `reading-head` 52 px kao avatar strategista (Danas savjet, Napredak sedmični pregled)
- [ ] `strategist` edge funkcija (sedmično / na dugme), odobravanje akcija jednim tapom → replan; akcije `set_priority`, `boost_priority`, `set_mode`, `set_campaign_start`; zaostatak po predavanjima i jačina po temama u ulazu
- **DoD** → `v0.11.0`

## Etapa 12 — Notifikacije i dorada

- [ ] Web Push: service worker; ikone notifikacija `celebrating-head` / `timer-head`, `notify` edge funkcija, `pg_cron` (prvi blok, propušten blok, ponavljanje, „Dokle ste stigli?“ nakon termina, kampanja počinje za 3 dana)
- [ ] Postavke kompletne (plan, timer, jezik, potrošnja AI iz `ai_runs`)
- [ ] Pristupačnost: touch ≥ 44 px, kontrast, aria, fokus
- [ ] Playwright E2E: novi predmet, dodaj izvor, sesija, replan
- [ ] `.github/workflows/backup.yml` (sedmični `db dump`, DB lozinka u Secrets)
- [ ] Lighthouse PWA i performanse
- **DoD** → `v1.0.0`

## Kasnije

- Read-only demo nalog sa seed podacima za portfolio.
- MCP server (opcionalno): Hoot podaci i alati uvoza za vanjske AI klijente (npr. Claude Desktop). App ga ne treba; asistent koristi tool calling u edge funkciji.
- Lični FSRS parametri (`@open-spaced-repetition/binding` optimizer) kad bude ~100+ ponavljanja u `review_logs`.
- Prijedlog obima parcijale iz onoga što je pređeno na predavanjima do datuma parcijale.
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
- Font Outfit se servira lokalno (`@fontsource-variable/outfit`), radi offline.

## Prompt za Etapu 5 (sljedeći chat)

> Pročitaj docs/PRD.md (sekcija „Bodovi, skala ocjena i projekcija ocjene“), docs/ROADMAP.md (Etapa 5), docs/design/README.md, docs/design/BodoviOcjene.html (odobren mockup, 6 ekrana) i CLAUDE.md, pa uradi Etapu 5 — Bodovi i ocjene.
> Isti tok kao u Etapama 2–4: podijeli etapu na manje PR-ove u `dev` (prvo migracija `0007_grades.sql` i čista logika `src/lib/grades/` sa testovima i `fast-check`, pa ekrani), svaki PR mergeaj sam (squash) kad CI prođe, a release `dev → main` + tag `v0.5.0` tek kad potvrdim na previewu (dev.hoot-5ig.pages.dev). Ako se PRD i mockup ne slažu ili je PRD nejasan, pitaj s opcijama i preporukom, pa odluku upiši u PRD/ROADMAP.
> Napomene iz Etape 4:
> - Dugmad u bosanskom pišu „Spasi“ (nikad „Snimi“); svaki sheet ima × za zatvaranje (`BottomSheet`).
> - ExamSheet već ima „Kad je ispit?“ (tačan datum / u roku iz akademskog kalendara / okvirni raspon) i „Izvori za ovaj ispit“; polja bodova, praga i uslova za izlazak idu ispod toga, kao na mockupu (ekran 3).
> - Popravni se bira kao „Popravni za“ (`retake_of`) i prikazuje ugniježđen ispod ispita (ekran 2); integralni zamjenjuje parcijale; vrijedi zadnji izlazak; „Poništi rezultat“ = odricanje.
> - Rokovi (`deadlines`) dobijaju bodove kao ispiti (zadaće, seminarski).
> - Kalendar ima prikaze Mjesec i Dan (sedmica izbačena); nastava blokira tačno svoje vrijeme.
> - Napredak je još prazan: lista „Ocjene“ (ekran 6) je prvi sadržaj; avatar na Danas vodi u Postavke.
> - Gemini ključ: `LLM_MODEL=gemini-2.5-flash` (za Etapu 6).

## Prompt za početak etape (primjer)

> Pročitaj docs/PRD.md i docs/ROADMAP.md i uradi Etapu 1: kostur projekta, migraciju 0001_init.sql, login, i18n i deploy. Radi na grani `feat/foundation` iz `dev`, otvori PR u `dev` kad je DoD ispunjen.
