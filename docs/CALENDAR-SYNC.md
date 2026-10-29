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
| Hoot blok pomjeren u Google-u | Postaje Fiksni blok (`origin = 'user'`, zaključan), kao zadani izbor pri pomjeranju u app-u; vraća se na Automatski u BlockSheetu. |
| Ispit ili rok pomjeren u Google-u | Prijedlog „Promijenjeno u Google kalendaru“ jednim tapom; datum ispita se ne mijenja bez potvrde. |
| Duplikati | Prepoznaju se sami. Kartica nudi Spoji (default), Hoot zamjenjuje, Google zamjenjuje, Zadrži oba. |
| ICS izvoz plana (`calendar-feed`) | Zamijenjen Google dvosmjernim sync-om; ne pravi se. |

## Arhitektura

```
         Hoot app (browser)                          Supabase                           Google
 ┌───────────────────────────────┐       ┌──────────────────────────────────┐     ┌─────────────────┐
 │ plan() → replace_plan         │       │                                  │     │                 │
 │ GooglePush: plan, nastava,    │ upsert│ calendar_items (šta treba biti   │     │ kalendar „Hoot“ │
 │ ispiti, rokovi → stavke ──────┼──────▶│ u Google-u)                      │ API │ (Hoot upisuje)  │
 │                         {push}┼──────▶│ google-calendar → reconcile ─────┼────▶│ insert/patch/   │
 │                               │       │ calendar_links (događaj ↔ stavka)│     │ delete          │
 │ Realtime (external_events,    │◀──────┤ external_events, plan_blocks     │     │                 │
 │ plan_blocks, calendar_links)  │       │   ▲                              │push │ izabrani        │
 │ → refetch → replan za ~2 s    │       │   └─ google-calendar-sync ◀──────┼─────┤ kalendari       │
 └───────────────────────────────┘       │ pg_cron 15 min: kanali, pull,    │     │ (zauzetost)     │
                                         │ push zaostalog; ICS feedovi 3 h  │     └─────────────────┘
                                         └──────────────────────────────────┘
```

- **Jedan model događaja.** Izabrani Google kalendari su obični redovi u `calendar_feeds` (`source = 'google'`). Njihovi događaji idu u isti `external_events` kao iCal feedovi, pa zauzetost, „ignoriši“, klasifikacija i Moodle tok rade isto za oba izvora.
- **Plan ostaje deterministički kod** (`plan()`, `placeTimes()` u browseru). Server samo prenosi promjene; AI samo klasifikuje naslove.

## 1. Temelj (PR 1, ovaj dokument)

- Sync pri otvaranju app-a i pri povratku u app (`visibilitychange`), najviše jednom u 30 min, za **svaki** feed. Ranije su se pri otvaranju sinhronizovali samo feedovi zauzetosti, pa je samo-Moodle korisnik čekao cron.
- Realtime na `external_events` i `plan_blocks` (migracija `0029_calendar_realtime.sql`). Upis sa servera (cron, kasnije webhook) se u otvorenom app-u vidi za < 1 s, a `ReplanRunner` preračuna plan (debounce 2 s).
- Vrsta feeda se pogađa iz linka (`src/lib/calendar/feedKind.ts`): Moodle izvoz (`/calendar/export_execute.php`, `authtoken`) su rokovi, ostalo je zauzetost. Novi feed ništa ne pita; vrsta se može promijeniti na feedu.
- Servisi u „Dodaj kalendar“: Google, Outlook, Moodle.

## 2. Klasifikacija događaja (PR 2)

`external_events.kind`: `busy` | `lecture` | `exam` | `deadline` | `free`, uz `kind_by` (`ai` / `user`), migracija `0031_event_kind.sql`. Ne dira se u upsertu sinhronizacije, pa preživljava sync; izmjenu korisnice AI nikad ne prepisuje.

Odluka pri implementaciji: pravila se ne spremaju, nego se računaju u app-u (`src/features/calendars/kinds.ts`, u `useScheduleData`), pa novo pravilo odmah važi za stare događaje. U bazi su samo odgovor AI-ja i izbor korisnice. Dok AI ne odgovori, nejasan događaj se računa kao zauzet, što je sigurno za plan.

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

**Gdje se mijenja.** Tap na zauzet događaj (Plan → Dan, Dostupnost) otvara „Šta je ovo?“: Zauzeto / Nastava / Ispit / Rok / Slobodno. `EventClassifier` šalje AI-ju samo događaje u sljedećih 60 dana, svaki jednom po pokretanju app-a; kad AI limit istekne, staje do sljedećeg pokretanja.

**Uticaj na plan.**
- `eventBlocks()` blokira `busy`, `lecture` i `exam`. `deadline` i `free` ne blokiraju.
- `deadline` iz bilo kojeg kalendara se nudi kroz postojeći pregled novo / izmijenjeno / preskačem (`DeadlinesImportPage`, „Rokovi iz kalendara“, uparivanje predmeta kao Moodle).
- `exam` i `lecture` serije se nude uz duplikate (isti pregled i povezivanje, da ispit ili predavanje ne postoji dvaput).
- `kind` mijenja slobodno vrijeme, a slobodno vrijeme je već u `input_hash`, pa promjena vrste pokreće replan.

## 3. Google dvosmjerni sync (PR 3)

### OAuth

- Authorization code flow na serveru. Edge funkcija `google-calendar` ima GET callback (redirect URI) i POST `auth_url`, `calendars`, `select`, `push`, `sync`, `disconnect`. Koristi `access_type=offline`, `prompt=consent` i `state` potpisan HMAC-om (korisnik, adresa app-a, rok 10 min).
- OAuth client je isti Web client kao za Google Drive Picker, uz redirect URI `https://<projekat>.supabase.co/functions/v1/google-calendar` i secrets `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- Refresh token je u `calendar_accounts.refresh_token`, bez granta za `authenticated` (kao `calendar_feeds.url`), i nikad se ne loguje.
- Scope-ovi (najuži koji pokrivaju potrebe):
  - `calendar.app.created`: Hoot pravi svoj kalendar „Hoot“ i upisuje samo u njega;
  - `calendar.calendarlist.readonly`: lista kalendara da korisnica izabere šta je zauzetost;
  - `calendar.events.owned`: čitanje i `events.watch` na njenim kalendarima, i brisanje Google kopije kod „Hoot zamjenjuje“.
- Cloud Console (oktobar 2026): `calendar.events.owned` je sensitive.
- **Režim consent screena.**
  - U „Testing“ refresh token ističe za 7 dana, što bi ugasilo sync.
  - Odluka (oktobar 2026): ostaje „Testing“ (korisnica je test user) dok se ne urade Branding podaci (homepage, privacy policy). App tada svakih 7 dana traži „Poveži ponovo“ (status `reconnect`). Publish na kraju.
  - Verifikacija (privacy policy, domena, demo video) prije otvaranja za više korisnika ([SETUP.md](SETUP.md)).

### Tabele (`0030_google_calendar.sql`)

| Tabela | Svrha |
| --- | --- |
| `calendar_accounts` | povezan Google račun: email, `hoot_calendar_id`, `app_origin` (za link), `push_enabled`, status (`active` / `reconnect`), `last_error` (kod), zaključavanje push-a; tokeni samo za service role |
| `calendar_feeds` + `source`, `account_id`, `google_calendar_id` | izabrani Google kalendari kao feedovi; `url` obavezan samo za `source = 'ics'` |
| `calendar_channels` | push kanali: `channel_id`, `resource_id`, `token`, `expires_at` (samo service role) |
| `calendar_items` | šta Hoot želi u svom Google kalendaru; računa ih app (`src/lib/calendar/items.ts`), ključ `block:<id>`, `exam:<id>`, `deadline:<id>`, `class:<id>:<datum>`, uz `hash` |
| `calendar_links` | Google događaj ↔ stavka: `google_event_id`, `item_key`, `pushed_hash`, `pushed_start`, `etag`, `state` (`ok` / `deleted`); app ih čita za „u Google-u“ |

Uz duplikate (sljedeći PR) dolaze `external_events.assessment_id` / `timetable_entry_id` i odluka „Zadrži oba“.

### Hoot → Google

Odluka pri implementaciji: app računa šta treba biti u Google-u, a server samo poredi i upisuje. Razlog je `replace_plan`, koji pri svakom replanu briše buduće AI blokove i ubacuje nove sa novim ID-jevima. Trigger po redu bi zato brisao i ponovo pravio sve događaje. Sve izmjene ionako nastaju u app-u, pa trigger, `pg_net` i vault nisu potrebni.

- `GooglePush` (`src/features/calendars/GooglePush.tsx`, montiran kad je Google povezan) iz istih podataka koje ekrani imaju pravi stavke:
  - blokovi sa vremenom, danas do +14 dana (odrađen dobija „✓“ i stvarno vrijeme; preskočen i propušten nestaju);
  - termini nastave kao pojedinačni događaji za 14 dana (otkazani i neradni dani se ne upisuju; bez RRULE-a, pa nema pravila o parnim sedmicama u Google-u);
  - ispiti (cijeli dan, okvirni datum kao raspon) i otvoreni rokovi.
- Poslije 2 s mira upiše promijenjene stavke u `calendar_items`, obriše nestale (prošle ostaju kao historija) i pozove `google-calendar` `{op: 'push'}`.
- Server (`_shared/googleSync.ts`, `pushWithLock`): jedan push po računu u isto vrijeme; zahtjev koji stigne usred push-a se izvrši odmah poslije.
- `reconcile()` (`_shared/calendarSync.ts`) poredi stavke i linkove:
  - isti `hash` → ništa;
  - promijenjen → `patch`;
  - nova → `insert`;
  - nestala → `delete`.
  Događaj bloka koji je nestao se **ponovo koristi** za novi blok istog dana (najbliži početak), pa replan znači nekoliko patch-eva umjesto brisanja i pravljenja svega.
- Svaki događaj ima `extendedProperties.private.hootKey`; spremljen `etag` prepoznaje vlastite upise. Boja je najbliži Google `colorId` boji predmeta. Blok nema Google podsjetnike (Hoot šalje svoje); rok je „slobodan“ (ne blokira).

### Link „Započni“ u događaju

- `source: { title: 'Hoot', url }`: Google Calendar prikaže klikabilan izvor na događaju.
- Prvi red opisa: „▶ Započni u Hoot-u: <url>“, ispod gradivo bloka (jedinice, stranice).
- Blok: `<origin>/?block=<id>` (`origin` je adresa app-a sa koje je Google povezan, `calendar_accounts.app_origin`). Taj deep link već postoji (podsjetnici, Etapa 10c) i otvara „Započeti sesiju sada?“ sa „Počni“. Ispit i rok: `<origin>/subjects/<id>`.
- Na Androidu instalirana PWA otvara linkove iz svog scope-a direktno. Na iOS-u se link otvara u Safariju; prijava važi ako je Hoot otvaran u Safariju.

### Google → Hoot

- `events.watch` na kalendar „Hoot“ i na svaki izabrani kalendar zauzetosti (kanal 7 dana, obnova 2 dana prije isteka).
- Webhook `google-calendar-sync` (`verify_jwt = false`) provjeri `X-Goog-Channel-Token`, odmah vrati 204 i posao uradi poslije odgovora (`EdgeRuntime.waitUntil`): pročita taj kalendar u prozoru 7 dana nazad / 120 naprijed. Odluka pri implementaciji: prozor umjesto `syncToken`-a. `syncToken` ne radi zajedno sa `timeMin`/`timeMax`, a cijela historija kalendara bez prozora može biti ogromna. Prozor je par poziva po promjeni, što je daleko ispod Google kvote.
- Kalendari zauzetosti: isti upis kao iCal (`_shared/externalEvents.ts`, `replaceFeedEvents`).
- Kalendar „Hoot“, događaj čiji se `etag` razlikuje od spremljenog (promjena korisnice):
  - pomjeren blok → **Fiksni** blok (`origin = 'user'`, zaključan: replan ga ne pomjera) sa novim danom i vremenom, kao zadani izbor pri pomjeranju u app-u. AI blok dobija `edited`, pa radi „Vrati predloženo“, a u BlockSheetu se bilo kad vraća na **Automatski**;
  - obrisan blok → `skip_requested_at`, isti put kao „Preskoči“ iz notifikacije: app primijeni `skipBlock()`, a link je `deleted`, pa se događaj ne vraća;
  - ispit, rok, nastava ili promijenjen naslov → Hoot-ova verzija se upiše nazad pri sljedećem push-u. Prijedlog „Datum ispita promijenjen u Google-u?“ dolazi uz duplikate;
  - događaj koji je korisnica sama dodala u kalendar „Hoot“ se ignoriše.
- **Bez petlje (odjeka):**
  - naš upis vrati webhook sa našim `etag`-om, koji se ignoriše;
  - replan ne pomjera ručne blokove;
  - isti `hash` ne pravi poziv.

### Duplikati i uvoz iz kalendara

Odluka pri implementaciji (`0032_calendar_matches.sql`): odluka se pamti po **seriji predavanja** (ključ `series:<naslov>|<dan>|<početak>`) ili po **ispitu** (ključ `event:<uid>`, pa pomjeren ispit ostaje isti ispit), u `calendar_matches` (`linked`, `distinct`, `skipped`, `hoot`, `seen_start`). Ne pamti se po redu u `external_events`, jer nove sedmice serije dolaze kao novi redovi.

Prepoznavanje (`src/lib/calendar/match.ts`, čista logika, testovi), samo za buduće događaje:

- **Predavanje:** događaj vrste `lecture` u sedmičnoj seriji. Isto je kao termin u rasporedu sa istim danom, početkom ±15 min i istim predmetom (ili bez predmeta). Predmet se čita iz naslova (cijelo ime, prva duža riječ, pa `fuse.js`), a vrsta iz riječi (vježbe, lab).
- **Ispit:** događaj vrste `exam`. Isto je kao ispit u Hoot-u istog dana (i istog predmeta kad je poznat). Spojeni ispit čiji se početak u kalendaru promijenio je „Promijenjeno u kalendaru“.

Ekran „Iz kalendara“ (`/today/calendar`, kartica „Iz tvog kalendara“ na Danas):

| Stanje | Akcije (prva je zadana) |
| --- | --- |
| Novo | **Dodaj u Hoot** (termin u tekući period nastave ili ispit, odmah povezano) · Preskoči |
| Već imaš u Hoot-u | **Spoji** · Google zamjenjuje (Hoot uzima vrijeme iz kalendara) · Hoot zamjenjuje (samo Google: događaj, i cijela serija, se briše iz tvog kalendara; ostaje Hoot-ov) · Zadrži oba |
| Promijenjeno u kalendaru | **Uzmi novi datum** · Zadrži stari |

- Ništa se ne spašava ni briše prije „Primijeni“. iCal linkovi su samo za čitanje, pa kod njih nema „Hoot zamjenjuje“.
- Spojeno predavanje se ne računa dvaput kao zauzetost (događaj postaje „slobodan“, termin rasporeda drži vrijeme).
- Spojena stavka iz tvog Google kalendara se ne upisuje u kalendar „Hoot“ (`inGoogleAlready`), pa svaka stvar postoji tačno jednom.
- Rokovi idu kao i ranije kroz „Rokovi iz kalendara“ (`external_events.deadline_id`).
- Uvoz rasporeda i ispita iz slike ili PDF-a već uparuje postojeće termine i ispite (`existingId`). Ono što je uvezeno iz kalendara je zato „izmijenjeno / već imaš“ u PDF uvozu, a ono što prvo dođe iz PDF-a, „Iz kalendara“ nudi kao Spoji.
- Ulaz: kartica na Danas, onboarding i „Predavanja i ispiti iz kalendara“ na Google kartici u Postavkama.

### Onboarding (korak 2 „Šta već imaš?“)

- Prva kartica je „Poveži Google kalendar“. Poslije Google-a (`state.path = /onboarding`) se app vraća na isti korak.
- Kad prepoznavanje nađe predavanja ili ispite: „U kalendaru već imaš: 6 predavanja · 2 ispita · pregledaj“ → „Iz kalendara“ → nazad na korak.
- Kartica „Raspored nastave“ bez termina, a sa predavanjima u Google-u: „Već u Google kalendaru: N predavanja · uvezi“ (isti pregled, ne ručni unos).
- iCal je „Drugi kalendar (link)“ za Outlook i Moodle.
- Sedmična serija koju ni pravila ni AI nisu prepoznali kao predavanje („Mat A2“) dobija „Je li predavanje?“ na ekranu „Iz kalendara“: Predavanje je (svi događaji serije postaju `lecture`, vrsta korisnice, pa se nude kao predavanje) / Nije (pamti se). U onboardingu se kartica rasporeda poziva na to samo kad ništa drugo nije nađeno.

### Pouzdanost

Google kaže da push obavještenja nisu potpuno pouzdana i da se poneka izgube. Zato `pg_cron` svakih 15 min zove `google-calendar-sync` (`x-cron-secret`), koji:

- obnavlja kanale;
- čita sve kalendare;
- pusha stavke koje app nije stigao poslati (offline).

Greška upisuje samo kod u `calendar_accounts.last_error`. `invalid_grant` (u „Testing“ režimu svakih 7 dana) daje status `reconnect`, karticu „Google kalendar treba ponovo povezati“ i badge „Poveži Google ponovo“.

### Latencija

| Smjer | Očekivano |
| --- | --- |
| Hoot → Google | ~2–5 s poslije izmjene u app-u (2 s mira + push) |
| Google → baza | sekunde (webhook), najviše 15 min (cron) |
| Preslagivanje ostalih blokova | odmah ako je app otvoren (Realtime → replan); inače pri sljedećem otvaranju, jer se `plan()` računa u browseru |

### UI

- Plan: tag odmah do naslova, samo tekst: „Sinhronizovano sa Google-om“ i „Šaljem u Google…“ (blijedo ljubičast, `brand-soft`), „Nije sinhronizovano sa Google-om“ i „Google treba ponovo povezati“ (`warning-soft`); tap vodi na Povezane kalendare.
- Plan → Dan: blok ima „u Google-u“ ili „čeka Google“ (veza postoji i `pushed_hash` je aktuelan); događaj iz Google kalendara ima „iz Google kalendara · <kalendar>“.
- Postavke → Povezani kalendari (`GoogleCalendarCard`):
  - „Poveži Google kalendar“ (bez linka);
  - lista Google kalendara sa prekidačem zauzetosti (default: glavni);
  - „Plan u Google kalendaru“ (default uključeno), „Sinhronizuj“;
  - „Prekini vezu“ (sa ili bez brisanja kalendara „Hoot“; token se opoziva).
- iCal linkovi (Outlook, Moodle) su ispod, kao ranije.

## Kasnije

- **Outlook** preko Microsoft Graph, istim modelom: `Calendars.ReadWrite` i subscriptions (webhook). Pretplata na događaje traje najviše 10 080 min (stariji izvori: 4 230), pa je cron obnavlja.
- **Replan na serveru:** `plan()` je čist TS i može u Deno edge funkciju, da se ostali blokovi preslože i kad je app zatvoren.

## Izvori

- [Google Calendar API: scope-ovi](https://developers.google.com/workspace/calendar/api/auth)
- [Google Calendar API: push obavještenja](https://developers.google.com/workspace/calendar/api/guides/push)
- [Google OAuth: verifikacija sensitive scope-ova](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
- [Microsoft Graph: subscription (trajanje pretplate)](https://learn.microsoft.com/graph/api/resources/subscription)
