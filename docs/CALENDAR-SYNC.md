# Povezani kalendari: klasifikacija, Google dvosmjerni sync i duplikati

Odluka, oktobar 2026. Dopunjava PRD „Povezani kalendari i integracije“ i mijenja raniju odluku „Google Calendar API je Kasnije“. Ovdje je arhitektura i redoslijed; stavke za praćenje su u [ROADMAP.md](ROADMAP.md) (Etapa 10d).

## Zašto

Plan se stalno preračunava (replan), pa blokovi mijenjaju vrijeme. Da bi kalendar na telefonu bio pouzdan, promjena u Hoot-u mora se vidjeti u kalendaru za par sekundi, a promjena u kalendaru (pomjeren blok, novi sastanak) mora se vratiti u Hoot. ICS pretplata to ne može: Google osvježava pretplaćene kalendare tek svakih ~8–24 h i ne vraća izmjene. Uz to, korisnica često već ima predavanja i ispite u Google kalendaru, pa uvoz istih stvari kroz app pravi duplikate i troši vrijeme na onboarding.

Ciljevi:

1. App sam procijeni šta je zauzeto vrijeme, a šta rok, ispit ili predavanje.
2. Dvosmjerni sync sa Google kalendarom u sekundama.
3. Sve iz Hoot-a je u Google-u i sve iz izabranih Google kalendara je u Hoot-u, svaka stvar **tačno jednom** i povezana.
4. Iz Hoot događaja u Google kalendaru jednim tapom do sesije.

## Odluke

| Pitanje | Odluka |
| --- | --- |
| Provider | Google prvi. Outlook kasnije istim modelom (Microsoft Graph). |
| Apple iCloud | Isključen skroz. Nema API-ja sa push obavještenjima. CalDAV traži app-specific lozinku koja daje pristup cijelom iCloud kalendaru, a brzina je moguća samo pollingom. Postojeći iCloud linkovi rade dalje kao obični iCal, ali se Apple više ne nudi. |
| Klasifikacija | Prvo pravila u kodu, a AI samo za nejasne naslove. Rezultat je prijedlog jednim tapom, nikad automatski upis. |
| Hoot blok obrisan u Google-u | Isto kao „Preskoči“: blok je preskočen, gradivo ide u plan od sutra. |
| Hoot blok pomjeren u Google-u | Postaje ručni blok (`origin = 'user'`), kao pomjeranje u app-u; replan ga ne dira. |
| Ispit ili rok pomjeren u Google-u | Prijedlog „Promijenjeno u Google kalendaru“ jednim tapom; datum ispita se ne mijenja bez potvrde. |
| Duplikati | Prepoznaju se sami. Kartica nudi Spoji (default), Hoot zamjenjuje, Google zamjenjuje, Zadrži oba. |
| ICS izvoz plana (`calendar-feed`) | Zamijenjen Google dvosmjernim sync-om; ne pravi se. |

## Arhitektura

```
            Hoot app (browser)                       Supabase                              Google
 ┌──────────────────────────────┐        ┌─────────────────────────────────┐       ┌──────────────────┐
 │ ReplanRunner → replace_plan ─┼──────▶ │ plan_blocks, assessments,       │       │ kalendar „Hoot“  │
 │                              │        │ deadlines, timetable_entries    │       │ (Hoot upisuje)   │
 │                              │        │   │ trigger                     │       │                  │
 │                              │        │   ▼                             │ API   │                  │
 │                              │        │ calendar_outbox ─pg_net─▶ calendar-push ┼──────▶ insert/patch/ │
 │                              │        │                                 │       │ delete           │
 │ Realtime (external_events,   │ ◀──────┤ external_events, plan_blocks    │       │                  │
 │ plan_blocks) → refetch →     │        │   ▲                             │ push  │ izabrani         │
 │ replan za ~2 s               │        │   └── google-calendar-webhook ◀─┼───────┤ kalendari        │
 └──────────────────────────────┘        │        (syncToken, etag)        │       │ (zauzetost)      │
                                         │ pg_cron: sync 15 min, kanali    │       └──────────────────┘
                                         │ 1× dnevno, ICS feedovi 3 h      │
                                         └─────────────────────────────────┘
```

- **Jedan model događaja.** Izabrani Google kalendari su obični redovi u `calendar_feeds` (`source = 'google'`). Njihovi događaji idu u isti `external_events` kao iCal feedovi, pa zauzetost, „ignoriši“, klasifikacija i Moodle tok rade isto za oba izvora.
- **Plan ostaje deterministički kod** (`plan()`, `placeTimes()` u browseru). Server samo prenosi promjene; AI samo klasifikuje naslove.

## 1. Temelj (PR 1, ovaj dokument)

- Sync pri otvaranju app-a i pri povratku u app (`visibilitychange`), najviše jednom u 30 min, za **svaki** feed. Ranije su se pri otvaranju sinhronizovali samo feedovi zauzetosti, pa je samo-Moodle korisnik čekao cron.
- Realtime na `external_events` i `plan_blocks` (migracija `0029_calendar_realtime.sql`). Upis sa servera (cron, kasnije webhook) se u otvorenom app-u vidi za < 1 s, a `ReplanRunner` preračuna plan (debounce 2 s).
- Vrsta feeda se pogađa iz linka (`src/lib/calendar/feedKind.ts`): Moodle izvoz (`/calendar/export_execute.php`, `authtoken`) su rokovi, ostalo je zauzetost. Novi feed ništa ne pita; vrsta se može promijeniti na feedu.
- Servisi u „Dodaj kalendar“: Google, Outlook, Moodle.

## 2. Klasifikacija događaja (PR 2)

`external_events.kind`: `busy` | `lecture` | `exam` | `deadline` | `free`, uz `kind_by` (pravilo / AI / korisnica). Ne dira se u upsertu sinhronizacije, pa preživljava sync; izmjenu korisnice AI nikad ne prepisuje.

**Pravila** (`src/lib/calendar/classify.ts`, čista logika, testovi). Prvo pravilo koje važi odlučuje:

1. Moodle feed → `deadline`.
2. Vremenski događaj bez trajanja ili kraći od 5 min → `deadline`.
3. Ključne riječi (bs/en, bez dijakritika):
   - `ispit`, `kolokvij`, `parcijal`, `integral`, `exam`, `midterm` → `exam`;
   - `rok`, `predaja`, `zadaca`, `seminarski`, `deadline`, `due` → `deadline`.
4. Sedmična serija u periodu nastave, sa naslovom koji liči na predmet (`fuse.js`) ili sadrži `predavanje`, `vjezbe`, `lab`, `seminar` → `lecture`.
5. Bez naslova (feed „samo zauzeto“) → `busy`.
6. Ostalo → AI.

**AI za nejasne.**
- Edge funkcija `classify-events` kroz `_shared/llm.ts`, sa Zod šemom u `_shared/schemas.ts` (`{ id, kind, confidence }[]`).
- Šalje samo naslov, trajanje i dan u sedmici, najviše 50 događaja po pozivu, samo neklasifikovane.
- Svaki poziv ide u `ai_runs` (`classify_events`) i u AI limit. Feed „samo zauzeto“ se nikad ne šalje.

**Uticaj na plan.**
- `eventBlocks()` blokira `busy`, `lecture` i `exam`. `deadline` i `free` ne blokiraju. `kind` ulazi u `input_hash`.
- `deadline` i `exam` (i `lecture` serije) se nude kroz postojeći pregled novo / izmijenjeno / preskačem (`DeadlinesImportPage`, uparivanje predmeta kao Moodle).

## 3. Google dvosmjerni sync (PR 3)

### OAuth

- Authorization code flow na serveru (edge funkcija `google-calendar`: `auth_url`, `callback`, `calendars`, `disconnect`), `access_type=offline`.
- Refresh token je u `calendar_accounts.refresh_token`, bez granta za `authenticated` (kao `calendar_feeds.url`), i nikad se ne loguje.
- Scope-ovi (najuži koji pokrivaju potrebe):
  - `calendar.app.created`: Hoot pravi svoj kalendar „Hoot“ i upisuje samo u njega;
  - `calendar.calendarlist.readonly`: lista kalendara da korisnica izabere šta je zauzetost;
  - `calendar.events.owned`: čitanje i `events.watch` na njenim kalendarima, i brisanje Google kopije kod „Hoot zamjenjuje“.
- Prije implementacije u Cloud Console potvrditi klasifikaciju scope-ova (sensitive / non-sensitive).
- **Režim consent screena.**
  - U „Testing“ refresh token ističe za 7 dana, što bi ugasilo sync.
  - Dok je jedan korisnik: „In production“ bez verifikacije (ekran „Google hasn't verified this app“). Prvi korak implementacije je provjeriti da token važi i poslije 7 dana.
  - Verifikacija (privacy policy, domena, demo video) prije otvaranja za više korisnika ([SETUP.md](SETUP.md)).

### Tabele

| Tabela | Svrha |
| --- | --- |
| `calendar_accounts` | povezan Google račun: email, `hoot_calendar_id`, status (`active` / `reconnect`), `last_error` (kod), `refresh_token` (samo service role) |
| `calendar_feeds` + `source`, `account_id`, `google_calendar_id` | izabrani Google kalendari kao feedovi; `url` obavezan samo za `source = 'ics'` |
| `calendar_channels` | push kanali: `channel_id`, `resource_id`, `token`, `expires_at`, `sync_token` (samo service role) |
| `calendar_links` | Hoot stavka ↔ Google događaj: `kind` (`block`, `assessment`, `deadline`, `timetable_entry`), `ref_id`, `google_event_id`, `owner` (`hoot` / `google`), `etag`, `pushed_hash`, odluka `distinct` (Zadrži oba) |
| `calendar_outbox` | stavke koje treba upisati u Google (puni ga trigger) |
| `external_events` + `assessment_id`, `timetable_entry_id` | veza događaja sa Hoot stavkom, uz postojeći `deadline_id` |

### Hoot → Google

- Trigger na `plan_blocks`, `assessments`, `deadlines` i `timetable_entries` upisuje red u `calendar_outbox` i odmah zove `calendar-push` preko `pg_net`. Pali se samo kad korisnica ima aktivan Google račun.
- `calendar-push` uzme sve redove korisnice odjednom, pa `replace_plan` sa 40 izmjena postaje jedan poziv; zaključavanje po korisnici (`pg_try_advisory_lock`).
- Za svaku stavku poredi `pushed_hash` i radi `insert` / `patch` / `delete` samo u kalendaru „Hoot“.
- Šta se upisuje:
  - blokovi sa vremenom, danas do +14 dana. Odrađen blok dobija „✓“ i stvarno vrijeme; preskočen i propušten se brišu;
  - ispiti i rokovi;
  - termini nastave kao ponavljajući događaji (`RRULE:FREQ=WEEKLY`, `INTERVAL=2` za parne/neparne sedmice, `UNTIL` = kraj perioda nastave, `EXDATE` za otkazane i neradne dane).
- Stavka povezana sa postojećim Google događajem (`owner = 'google'`) se **ne** upisuje: već je u kalendaru.
- Svaki događaj ima `extendedProperties.private.hootRef = <kind>:<id>`; spremljen `etag` prepoznaje vlastite upise.
- Boja je `colorId` najbliži boji predmeta.

### Link „Započni“ u događaju

- `source: { title: 'Hoot', url }`: Google Calendar prikaže klikabilan izvor na događaju.
- Prvi red opisa: „▶ Započni u Hoot-u: <url>“, ispod gradivo bloka (jedinice, stranice).
- Blok: `<APP_URL>/?block=<id>`. Taj deep link već postoji (podsjetnici, Etapa 10c) i otvara „Započeti sesiju sada?“ sa „Počni“. Ispit i rok: `<APP_URL>/subjects/<id>`.
- Na Androidu instalirana PWA otvara linkove iz svog scope-a direktno. Na iOS-u se link otvara u Safariju; prijava važi ako je Hoot otvaran u Safariju.

### Google → Hoot

- `events.watch` na kalendar „Hoot“ i na svaki izabrani kalendar zauzetosti.
- Webhook `google-calendar-webhook` (`verify_jwt = false`) provjeri `X-Goog-Channel-Token`, vrati 200 i uradi inkrementalni `events.list` sa `syncToken`. Kod `410 Gone` ide puni resync (7 dana nazad, 120 naprijed, kao ICS).
- Kalendari zauzetosti: isti upsert kao ICS (zajednički kod u `_shared/externalEvents.ts`).
- Kalendar „Hoot“, događaj čiji se `etag` razlikuje od spremljenog (promjena korisnice):
  - pomjeren blok → ručni blok sa novim vremenom;
  - obrisan blok → preskočen;
  - pomjeren ispit ili rok → prijedlog u app-u, a događaj se vraća dok korisnica ne potvrdi;
  - događaj koji je korisnica sama dodala u kalendar „Hoot“ se ignoriše.
- **Bez petlje (odjeka):**
  - naš upis vrati webhook sa našim `etag`-om, koji se ignoriše;
  - replan ne pomjera ručne blokove;
  - `pushed_hash` sprječava upis iste stvari dvaput.

### Duplikati i uvoz iz Google-a

Prepoznavanje je u `src/lib/calendar/match.ts` (čista logika, testovi). Kandidat za duplikat je par Hoot stavka ↔ Google događaj kad važi oboje:

- vrijeme se poklapa:
  - termin nastave: isti dan u sedmici i početak ±15 min kroz više sedmica;
  - ispit i rok: isti dan;
- naslov liči na predmet, ili je događaj klasifikovan kao ista vrsta.

Kartica „Isto u Google kalendaru i u Hoot-u“ nudi:

| Akcija | Šta se desi |
| --- | --- |
| **Spoji** (default) | Jedna stavka, povezana (`owner = 'google'`). Hoot stavka ostaje za plan, Google događaj ostaje kakav jeste i ne kopira se u kalendar „Hoot“; zauzetost se ne računa dvaput. |
| Hoot zamjenjuje | Google kopija se briše, Hoot upiše svoju u kalendar „Hoot“. |
| Google zamjenjuje | Hoot stavka se arhivira (gdje postoji `archived_at`) ili briše; podaci se uzimaju iz Google događaja i ostaju povezani. |
| Zadrži oba | Par se pamti kao `distinct` i više se ne pita. |

- Ništa se ne spaja ni briše bez tapa.
- Google događaji bez para se nude kao uvoz kroz pregled novo / izmijenjeno / preskačem:
  - serija predavanja → termin u rasporedu;
  - ispit → ispit;
  - rok → rok.
  Uvezena stavka je odmah povezana, pa nema duplikata.
- Kasniji uvoz rasporeda ili ispita (slika, PDF, AI) prolazi kroz isto prepoznavanje: postojeće je „već imaš“.
- Promjena povezanog događaja (novo vrijeme, otkazano) → prijedlog jednim tapom; ručne izmjene (`assigned_by = 'user'`) se ne prepisuju.
- Isto važi za iCal feedove.

### Onboarding (korak 2 „Šta već imaš?“)

- Prva kartica je „Poveži Google kalendar“. Poslije sinhronizacije: „U tvom kalendaru već su: 8 predavanja, 2 ispita, 3 roka“, sa „Uvezi povezano“ (jedan tap) i pregledom.
- Ako su raspored i rokovi nađeni, kartice „Raspored nastave“ i ispiti su „Već imaš iz Google kalendara“ i preskaču se; ostaje „Dodaj još“.
- Pitanje „Imaš li raspored i rokove već u Google kalendaru?“ ide samo kad prepoznavanje ne nađe ništa, a kalendar ima ponavljajuće događaje.
- iCal link ostaje kao „Drugi kalendar (link)“.

### Pouzdanost

Google kaže da push obavještenja nisu potpuno pouzdana i da se poneka izgube. Zato:

- `pg_cron` svakih 15 min radi inkrementalni sync (jeftin sa `syncToken`) i prazni zaostali outbox;
- jednom dnevno obnavlja kanale kojima rok ističe za manje od 48 h;
- greška upisuje kod u `calendar_accounts.last_error`. `invalid_grant` daje status `reconnect` i karticu „Ponovo poveži Google kalendar“.

### Latencija

| Smjer | Očekivano |
| --- | --- |
| Hoot → Google | par sekundi poslije `replace_plan` |
| Google → baza | sekunde (webhook), najviše 15 min (cron) |
| Preslagivanje ostalih blokova | odmah ako je app otvoren (Realtime → replan); inače pri sljedećem otvaranju, jer se `plan()` računa u browseru |

### UI

- Plan (zaglavlje): badge stanja, „Google ✓ prije 1 min“, „Google · čeka 3“ (outbox nije prazan) ili „Google nije povezan“; tap vodi na Povezane kalendare. Stanje dolazi iz `calendar_accounts` i `calendar_outbox`, pa se badge pravi tek sa ovim PR-om (bez lažnog stanja ranije).
- Plan → Dan, svaki Hoot blok, ispit i rok: mala oznaka „u Google-u“ (veza postoji i `pushed_hash` je aktuelan) ili „čeka“; događaj iz Google kalendara ima oznaku „iz Google kalendara“ (već postoji za iCal feedove).
- Postavke → Povezani kalendari:
  - „Poveži Google kalendar“;
  - lista Google kalendara sa prekidačem „zauzeto“ (default: primarni);
  - status, „Prikaži plan u Google kalendaru“ (default uključeno);
  - „Prekini vezu“ (pita da li obrisati kalendar „Hoot“, opoziva token).

## Kasnije

- **Outlook** preko Microsoft Graph, istim modelom: `Calendars.ReadWrite` i subscriptions (webhook). Pretplata na događaje traje najviše 10 080 min (stariji izvori: 4 230), pa je cron obnavlja.
- **Replan na serveru:** `plan()` je čist TS i može u Deno edge funkciju, da se ostali blokovi preslože i kad je app zatvoren.

## Izvori

- [Google Calendar API: scope-ovi](https://developers.google.com/workspace/calendar/api/auth)
- [Google Calendar API: push obavještenja](https://developers.google.com/workspace/calendar/api/guides/push)
- [Google OAuth: verifikacija sensitive scope-ova](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
- [Microsoft Graph: subscription (trajanje pretplate)](https://learn.microsoft.com/graph/api/resources/subscription)
