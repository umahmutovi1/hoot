# Hoot — ručna podešavanja servisa

Sve što se radi u dashboardima (Supabase, Cloudflare, Resend, Gemini, Anthropic), a ne u kodu. Tajne (lozinka baze, `re_…`, Gemini `AIza…`, `sk-ant-…`, `service_role`) idu samo u password manager i Supabase secrets — nikad u repo, `.env` fajl ili chat.

## Pregled

| Servis | Šta | Status |
| --- | --- | --- |
| Supabase | projekat `hoot`, ref `lpyyatqzvrvqgcmwiqfr`, Frankfurt | ✅ |
| Cloudflare Pages | projekat `hoot` → `hoot-5ig.pages.dev`, production branch `main` | ✅ |
| GitHub | repo `umahmutovi1/hoot`, ruleset `protect-main-dev`, secrets za keepalive | ✅ |
| Resend | SMTP za auth emailove (kod za prijavu), šablon u stilu appa | ✅ |
| Prijava | lozinka (min 8) i Google OAuth u Supabaseu (Sprint 16, vidi 3a) | ⏳ koraci u 3a |
| Gemini | API ključ (free tier) za AI dok nema Anthropic kartice | ⏳ treba za Sprint 6 |
| Anthropic | kredit, limit, workspace API ključ | ⏳ čeka karticu (opcionalno, Sprint 11) |
| `pg_cron` | sinhronizacija povezanih kalendara svaka 3 h (`sync-calendar`), Web Push svake minute (`notify`) | ✅ |
| Web Push | VAPID ključevi (secrets + Cloudflare Production i Preview), `notify` deployana, `pg_cron` svake minute | ✅ |
| Sigurnost u CI | CodeQL, Dependabot, `npm audit`, gitleaks, RLS testovi, CSP u `public/_headers` (Sprint 12, vidi 2a) | ⏳ koraci u 2a |
| ML trening | GitHub secrets `SUPABASE_DB_URL`, `HOOT_USER_ID`, `ML_PR_TOKEN` za `train.yml` i `ml-monitor.yml` (Sprint 15, vidi 5e) | ⏳ koraci u 5e |
| Domena | za emailove drugim korisnicima i vlastiti URL | kasnije |

---

## 1. Supabase

**Projekat.** supabase.com → New project → name `hoot`, region Central EU (Frankfurt), lozinka baze generisana i spremljena u password manager.

**Data API** (pri kreiranju projekta):
- Enable Data API: ✅
- Automatically expose new tables: ❌ (migracije same daju `grant` roli `authenticated`)
- Enable automatic RLS: ✅

**API ključevi.** Project Settings → API Keys → `sb_publishable_…` (javan, ide u `.env.local` i Cloudflare). `service_role` / secret key se nikad ne koristi u frontendu.

**CLI** (lokalni terminal, jednom po računaru):
```bash
npx supabase login
npx supabase link --project-ref lpyyatqzvrvqgcmwiqfr
npx supabase db push        # primijeni nove migracije
npm run db:types            # regeneriši src/types/database.ts
```
Lozinka baze ovdje ne treba (CLI koristi login); treba za `backup.yml` u Sprintu 23.

**Authentication → URL Configuration**
- Site URL: `https://hoot-5ig.pages.dev`
- Redirect URLs:
  - `https://hoot-5ig.pages.dev/**`
  - `https://*.hoot-5ig.pages.dev/**` (dev i preview grane)
  - `http://localhost:5173/**`

**Authentication → Sign In / Providers → Allow new users to sign up: isključeno** (nakon što je vlastiti nalog napravljen). Uključuje se tek kad se app otvori drugima (sekcija 5).

## 2. Cloudflare Pages

1. Workers & Pages → Create application → na dnu **„Looking to deploy Pages? Get started"** (ne Workers forma).
2. Import an existing Git repository → GitHub `umahmutovi1` → repo `hoot` → Begin setup.
3. Project name `hoot`, Production branch `main`, Framework preset `Vite`, Build command `npm run build`, Output `dist`, Root directory prazno.
4. Environment variables:
   - `VITE_SUPABASE_URL` = `https://lpyyatqzvrvqgcmwiqfr.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_…`
   - `NODE_VERSION` = `24`
   - `VITE_VAPID_PUBLIC_KEY` = javni VAPID ključ (Sprint 10, vidi 5b)
5. Rezultat: `main` → `hoot-5ig.pages.dev`, `dev` → `dev.hoot-5ig.pages.dev`, svaka druga grana dobija preview URL.

## 2a. Sigurnost u CI i GitHubu (Sprint 12)

U repou (ništa ručno): `ci.yml` ima `npm audit --audit-level=high`, job `secrets` (gitleaks preko cijele historije) i job `db` (lokalni Supabase u CI-ju: `supabase db lint` i RLS testovi iz `supabase/tests/database/rls.test.sql`); `codeql.yml` (CodeQL JS/TS, i sedmično); `.github/dependabot.yml` (npm i GitHub Actions, PR-ovi u `dev`); `public/_headers` (CSP i sigurnosna zaglavlja za Cloudflare). Lokalno: `npx supabase start` pa `npx supabase test db` (treba Docker).

Ručno u GitHubu, ovim redom:

1. **Prije nego repo postane javan:** na PR-u „chore(security)“ job `secrets` (gitleaks) mora biti zelen: tada u historiji nema ključa. Ako nije zelen, javi; ključ se rotira i historija čisti prije objave.
2. Repo javan: **Settings → General → Danger Zone → Change repository visibility → Make public** (u docs/ ostaju ime i email autorice u PRD-u; po želji ih ukloni prije).
3. **Settings → Advanced Security** (ili „Code security“):
   - Dependabot alerts → **Enable**; Dependabot security updates → **Enable** (verzijska ažuriranja već vodi `.github/dependabot.yml`).
   - Secret Protection: **Secret scanning** i **Push protection** → Enable (besplatno za javne repoe).
   - Code scanning → **ne** uključivati „Default setup“: CodeQL radi preko `codeql.yml` (oba zajedno se sudaraju). Nakon prvog run-a rezultati su u **Security → Code scanning**.
   - Private vulnerability reporting → Enable (opcionalno).
4. **Settings → Rules → Rulesets → `protect-main-dev` → Edit → Require status checks to pass** → dodaj `check`, `secrets`, `db`, `analyze` (CodeQL) uz postojeće; Save.
5. Dependabot PR-ovi idu u `dev` kao i ostali (squash nakon zelenog CI-ja).

Cloudflare (ništa za podesiti): `_headers` se deploya sa buildom. Provjera poslije deploya:
`curl -sI https://dev.hoot-5ig.pages.dev | grep -i -E "content-security|x-frame|strict-transport"`. Ako se Supabase URL promijeni (vlastita domena), dodaj ga u `connect-src` i `img-src` u `public/_headers`.

## 3. Resend SMTP (kod za prijavu u emailu)

**Zašto.** Instalirana PWA na iPhoneu ima odvojenu memoriju od Safarija: link iz emaila prijavi Safari, a ne aplikaciju. Zato se u aplikaciji upisuje kod iz emaila. Supabase standardni email nema kod, a šablon se može mijenjati tek uz vlastiti SMTP.

**Ograničenje bez domene.** Sa `onboarding@resend.dev` Resend šalje samo na email vlasnika Resend naloga. Dovoljno za jednu osobu; za druge vidi sekciju 5.

### 3.1 Resend nalog i ključ
1. resend.com → Sign up **istim emailom kojim se prijavljuješ u Hoot**.
2. API Keys → Create API Key → name `hoot-supabase-smtp`, permission **Sending access** (onboarding ekran „Send your first email" se može preskočiti).
3. Ključ `re_…` spremi u password manager.

### 3.2 Supabase SMTP
Authentication → Emails → **Set up SMTP** (ili SMTP Settings) → Enable custom SMTP:

| Polje | Vrijednost |
| --- | --- |
| Sender email | `onboarding@resend.dev` |
| Sender name | `Hoot` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | `re_…` ključ |

Save.

### 3.3 Šablon „Magic link or OTP"
Authentication → Emails → Magic link or OTP.

Subject:
```
Hoot: kod za prijavu / sign-in code
```

Body (Source): cijeli sadržaj fajla [`supabase/templates/magic_link.html`](../supabase/templates/magic_link.html) (Liquid Glass od Sprinta 16: lavanda gradijent, staklena kartica, dugme u gradijentu appa). Kad se fajl promijeni, ponovo ga zalijepi ovdje. Isti fajl koristi lokalni Supabase (`supabase/config.toml` → `[auth.email.template.magic_link]`).

Email-safe tabele i inline stilovi u bojama appa, bez `backdrop-filter` (email klijenti ga ne podržavaju): staklo je poluprozirna bijela kartica, a gdje klijent izbaci gradijent ostaje `bgcolor`. Ikonica je PNG sa produkcije (WebP ne podržavaju svi klijenti), font je sistemski (SF Pro / Segoe UI / Arial).

### 3.4 Test
1. Otvori Hoot sa početnog ekrana telefona → email → „Pošalji link za prijavu".
2. App prelazi na „Provjeri email" sa poljem za kod.
3. Prepiši kod iz emaila (ne otvaraj link) → „Prijavi se kodom".
4. Ako email ne stigne: Resend → Emails / Logs.

## 3a. Prijava lozinkom i Googleom (Sprint 16)

Kod iz emaila ostaje za prvu prijavu i zaboravljenu lozinku. Poslije prve prijave kodom app jednom ponudi „Postavi lozinku“ (uz „Preskoči“); kasnije je to u Postavke → Lozinka. Apple prijava dolazi uz Capacitor (nema Apple Developer Programa), passkey uz vlastitu domenu (Relying Party ID je domena: promjena domene poništava sve passkeyeve).

**Lozinka.** Authentication → Sign In / Providers → **Email**:
- Enable Email provider: ✅ (već uključeno zbog koda)
- Minimum password length: **8** (isto kao u appu)
- Password requirements: bez dodatnih (dovoljno je 8 znakova)
- Secure password change: ❌ (inače promjena lozinke u Postavkama traži ponovnu prijavu ako je zadnja starija od 24 h)

**Google.**
1. console.cloud.google.com → projekat `hoot` → Google Auth Platform → **Clients** → Create client → **Web application**, ime `hoot-supabase-auth` (odvojeno od klijenta za Calendar/Drive, da se scope-ovi ne miješaju).
   - Authorized JavaScript origins: `https://hoot-5ig.pages.dev`, `https://dev.hoot-5ig.pages.dev`, `http://localhost:5173`
   - Authorized redirect URIs: `https://lpyyatqzvrvqgcmwiqfr.supabase.co/auth/v1/callback`
   - Create → kopiraj Client ID i Client secret (secret u password manager).
2. Data Access: dovoljni su osnovni scope-ovi `openid`, `email`, `profile` (nisu sensitive, ne traže verifikaciju).
3. Supabase → Authentication → Sign In / Providers → **Google** → Enable → Client ID i Client Secret iz koraka 1 → Save. Callback URL koji Supabase pokaže mora biti isti kao u koraku 1.
4. Redirect URLs (sekcija 1) već pokrivaju `https://hoot-5ig.pages.dev/**` i preview grane; app šalje `redirectTo` = svoj origin.
5. Novi korisnici su i dalje zatvoreni (Allow new users to sign up ❌): Google prijava radi samo za email koji već ima nalog, a Supabase Google identitet sam poveže sa postojećim nalogom istog (potvrđenog) emaila.

**Test na iPhoneu (instalirana PWA).**
1. Odjavi se → otvori Hoot sa početnog ekrana → „Nastavi s Googleom“.
2. Google ekran se otvori unutar appa (traka sa „Gotovo“), ne u posebnom Safariju; poslije izbora naloga app se vrati na Danas, prijavljen.
3. Ako završi u Safariju ili se vrati odjavljen: javi, prelazimo na kod/lozinku kao jedini put u PWA i Google samo u pregledniku.
4. Lozinka: Postavke → Lozinka → Postavi → odjava → prijava emailom i lozinkom.

## 4. Gemini (AI za sad)

Dok Anthropic nalog nema karticu, AI ide preko Gemini free tiera, iza istog LLM wrappera. Prelazak na Haiku je samo promjena secrets (korak 4 u sekciji 5).

> Na free tieru Google može koristiti poslane podatke za poboljšanje proizvoda. Ne šalji lične dokumente koje ne želiš dijeliti; za njih sačekaj Anthropic ili plaćeni Gemini tier.

**1. Ključ**
1. Otvori aistudio.google.com i prijavi se Google nalogom.
2. Lijevo **Get API key** → **Create API key** → izaberi ili napravi Google Cloud projekat (npr. `hoot`). Kartica nije potrebna.
3. Kopiraj ključ (`AIza…`) direktno u password manager. Ne u chat, repo ili `.env` fajl.
4. U AI Studio pogledaj listu modela i zapiši ime trenutnog **Flash** modela (npr. `gemini-2.5-flash`). Ime ide u `LLM_MODEL`, pa novi model ne traži promjenu koda.

**2. Provjera ključa** (lokalni terminal; ključ se upisuje samo ovdje):
```bash
read -s GEMINI_API_KEY && export GEMINI_API_KEY   # zalijepi ključ, Enter (ne vidi se)
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY" | head -20
```
Lista modela = ključ radi. `API_KEY_INVALID` = pogrešno kopiran ključ.

**3. Supabase secrets** (isti terminal):
```bash
npx supabase secrets set GEMINI_API_KEY="$GEMINI_API_KEY" LLM_PROVIDER=gemini LLM_MODEL=gemini-3.5-flash-lite LLM_FALLBACK_MODEL=gemini-2.5-flash
npx supabase secrets list      # vidi se ime, ne vrijednost
unset GEMINI_API_KEY
```

> **Modeli i limiti (stanje 20. 10. 2026).** Free tier ima limit po modelu: Gemini 2.5 Flash samo 5 zahtjeva u minuti i 20 dnevno, a `gemini-2.5-flash-lite` više nije dostupan novim nalozima (404). Zato je `LLM_MODEL=gemini-3.5-flash-lite`, a `LLM_FALLBACK_MODEL=gemini-2.5-flash` se koristi kad prvi vrati 429 ili 503 (kvote su po modelu). Trenutne limite vidiš u AI Studio → Rate Limit. Antigravity iz te liste je Googleov agent, ne model za API. Promjena modela je samo `secrets set`, bez deploya.

**Lanac besplatnih AI-eva i privatni zadaci (Sprint 16).** Javni zadaci (uvoz akademskog kalendara, rasporeda ispita, rasporeda, plana i programa, sadržaja knjige, web pretraga; lista `PUBLIC_TASKS` u `supabase/functions/_shared/chain.ts`) idu redom kroz `LLM_CHAIN`, a na 429 / kvotu prelaze na sljedeći model; iscrpljen model se preskače do reseta (Gemini ponoć po pacifičkom vremenu, ostali ponoć UTC; kratki 429 samo minut), što se čita iz `ai_runs`. Privatni zadaci (bilješke, pitanja, odgovori, dokumenti, chat, provjere, tekst iz knjige) nikad ne idu na lanac: samo `LLM_PROVIDER`, i to samo kad je plaćen (Anthropic) ili kad je `LLM_PRIVATE_FREE=allow`.
```bash
npx supabase secrets set LLM_PRIVATE_FREE=allow   # dok nema Anthropic ključa; bez ovoga privatni AI vraća „needs_paid“
npx supabase secrets set LLM_CHAIN="gemini:gemini-3.5-flash-lite,gemini:gemini-2.5-flash"
```
Kad dođe Anthropic (sekcija 5): `LLM_PROVIDER=anthropic`, pa `npx supabase secrets unset LLM_PRIVATE_FREE`.

**Deploy poslije Sprinta 16** (`_shared/llm.ts` se promijenio, pa sve AI funkcije): prvo `LLM_PRIVATE_FREE=allow` (gore), pa
```bash
for f in ai-status parse-document documents answer parse-toc parse-questions link-questions recall-questions propose-answer find-academic-info classify-events; do npx supabase functions deploy $f; done
```

Groq i OpenRouter (opcionalno, besplatni nalozi): console.groq.com → API Keys → Create; openrouter.ai → Keys → Create (modeli sa `:free`). Ključeve `npx supabase secrets set GROQ_API_KEY=… OPENROUTER_API_KEY=…` (preko `read -rs` kao u 5d). Model ide u `LLM_CHAIN` tek kad prođe eval (`EVAL_MODEL=groq:llama-3.3-70b-versatile GROQ_API_KEY=… npm run eval`) i kad je dodan u `EVALUATED_MODELS` u `chain.ts` (PR); model iz lanca koji nije na toj listi se preskače. Groq/OpenRouter ne primaju PDF ni web pretragu: takav poziv ide sljedećem modelu u lancu.

**4. Edge funkcije** (Sprint 6: `parse-document`, `documents`, `answer`, `ai-status`; Sprint 11: `embed`, vektori jedinica, kartica i tema bez LLM-a; `parse-toc`, `parse-questions`, `link-questions`, `recall-questions`, `propose-answer`; slike sadržaja i stranica se brišu iz `uploads/<user_id>/import/` i `…/recall/` odmah poslije poziva):
```bash
for f in ai-status parse-document documents answer embed parse-toc parse-questions link-questions recall-questions propose-answer; do npx supabase functions deploy $f; done
```
- `supabase/config.toml` za svaku ima `verify_jwt = false` (funkcija sama provjerava token preko `auth.getUser`, što radi i sa novim JWT ključevima) i `import_map = "./functions/deno.json"`. Bez `import_map` deploy pada sa „Relative import path \"@supabase/supabase-js\"“.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` i `SUPABASE_SERVICE_ROLE_KEY` Supabase sam daje funkcijama; ne postavljaju se ručno.
- pgvector se uključuje migracijom `0008` (nije potreban klik u dashboardu); `0009` daje `service_role` pravo da piše `ai_runs`.
- Lokalni `functions serve` traži Docker, pa se testira na pravom projektu.

**5. Testiranje**
1. `dev.hoot-5ig.pages.dev` → Danas → + na traci sove → „Zalijepi tekst“ → kratak tekst akademskog kalendara → u razgovoru se pojavi kartica novo / izmijenjeno → „Spasi N“.
2. Pitaj sovu nešto iz tog teksta: odgovor ima čip sa nazivom dokumenta i stranicom.
3. Supabase → Table Editor → `ai_runs`: red sa `provider = gemini`, tokenima, `cost_usd` (cijena po cjenovniku; free tier se ne naplaćuje) i `ok = true`. Greške su u Edge Functions → Logs.
4. Limiti free tiera (zahtjevi po minuti i danu) vide se u AI Studio → Usage; app ionako ima limit 30 poziva u 24 sata.

**6. Evali promptova** (prije promjene prompta ili modela), lokalno:
```bash
read -s GEMINI_API_KEY && export GEMINI_API_KEY
npm run eval          # evals/promptfooconfig.yaml: kalendar, raspored ispita, sadržaj knjige i skripte, ispitna pitanja
unset GEMINI_API_KEY
```

## 5. Anthropic (opcionalno, Sprint 11)

1. console.anthropic.com → Billing → Add credits (najmanji iznos), Auto-reload isključen.
2. Settings → Limits → mjesečni spend limit (npr. $5).
3. **Workspace** ključ: Settings → Workspaces → Default → API keys → Create → `sk-ant-api03-…`. Ne `sk-ant-usr-…` (korisnički ključ traži `anthropic-workspace-id` header).
4. Ključ se unosi samo u terminal: `npx supabase secrets set ANTHROPIC_API_KEY=… LLM_PROVIDER=anthropic LLM_MODEL=claude-haiku-5-5`.

## 5a. Povezani kalendari: `sync-calendar` i `pg_cron` (Sprint 9)

`sync-calendar` povlači iCal linkove (Google, Outlook, iCloud, a od Sprinta 11 i Moodle „Rokovi“) u `external_events`. App je zove pri otvaranju i povratku u app (najviše jednom u 30 min, za svaki feed); `pg_cron` je zove svaka 3 h da plan ima svježu zauzetost i kad app nije otvoren. Bez LLM-a, ne troši AI limit. Tajni iCal link se nikad ne loguje; u `calendar_feeds.last_error` ide samo kod greške.

**Realtime (Sprint 14).** Migracija `0029_calendar_realtime.sql` dodaje `external_events` i `plan_blocks` u publikaciju `supabase_realtime`, pa upis sa servera stiže u otvoren app bez reloada. Provjera: Database → Publications → `supabase_realtime` sadrži obje tabele. Ništa se ne podešava ručno; Google Calendar API (OAuth klijent, scope-ovi, režim consent screena) dolazi uz PR 3 iz [CALENDAR-SYNC.md](CALENDAR-SYNC.md).

1. **Tajna za cron** (terminal, vrijednost ne ide u repo ni chat):
   ```sh
   CRON_SECRET=$(openssl rand -hex 32)
   npx supabase secrets set CRON_SECRET=$CRON_SECRET
   echo $CRON_SECRET   # kopiraj za korak 4, pa zatvori terminal
   ```
2. **Deploy:** `npx supabase functions deploy sync-calendar` (u `config.toml` ima `verify_jwt = false`; funkcija sama provjerava korisnika ili `x-cron-secret`).
3. **Ekstenzije:** Supabase dashboard → Database → Extensions → uključi `pg_cron` i `pg_net` (schema `extensions` / default).
4. **Vault + raspored:** SQL Editor → New query → zalijepi, zamijeni `<CRON_SECRET>` vrijednošću iz koraka 1 i pokreni:
   ```sql
   select vault.create_secret('<CRON_SECRET>', 'sync_calendar_cron_secret');

   select cron.schedule(
     'sync-calendar',
     '17 */3 * * *',
     $$
     select net.http_post(
       url := 'https://lpyyatqzvrvqgcmwiqfr.supabase.co/functions/v1/sync-calendar',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets
                           where name = 'sync_calendar_cron_secret')
       ),
       body := '{}'::jsonb,
       timeout_milliseconds := 60000
     );
     $$
   );
   ```
5. **Provjera:** Integrations → Cron → posao `sync-calendar` → History poslije prvog pokretanja (svaka 3 h u :17); odgovor funkcije je `{"synced": N, "failed": M}`. Edge Functions → `sync-calendar` → Logs ne smiju sadržavati link.
6. **Promjena tajne:** novi `secrets set`, pa `select vault.update_secret((select id from vault.secrets where name = 'sync_calendar_cron_secret'), '<novi>');`. **Gašenje:** `select cron.unschedule('sync-calendar');`.


## 5d. Google Calendar dvosmjerno (Sprint 14)

Detalji u [CALENDAR-SYNC.md](CALENDAR-SYNC.md). Koristi isti OAuth Web client kao Google Drive (5c).

1. **Cloud Console:** APIs & Services → Library → **Google Calendar API** → Enable. Google Auth Platform → Data Access → scope-ovi `calendar.app.created`, `calendar.calendarlist.readonly`, `calendar.events.owned` (sensitive).
2. **Client:** Clients → postojeći Web client → Authorized redirect URIs → `https://lpyyatqzvrvqgcmwiqfr.supabase.co/functions/v1/google-calendar`. Client secret: ako stari nije sačuvan, **Add secret**. Picker ga ne koristi, pa novi secret ništa ne kvari.
3. **Audience:** dok je „Testing“, svoj Gmail dodaj u **Test users**. Token tada ističe za 7 dana, pa app traži „Poveži Google ponovo“. Za „In production“ trebaju Branding podaci (naziv, support email, homepage, privacy policy), a za druge korisnike i verifikacija sensitive scope-a.
4. **Secrets** (terminal; u zsh-u bez `<` `>` u komandi, vrijednosti se ne vide i ne ostaju u historiji):
   ```sh
   read -r "GCID?Client ID: "; read -rs "GCS?Client secret: "; echo
   npx supabase secrets set GOOGLE_CLIENT_ID="$GCID" GOOGLE_CLIENT_SECRET="$GCS"
   unset GCID GCS
   ```
5. **Baza i deploy:** `npx supabase db push` (0029–0033), `npx supabase functions deploy classify-events` (klasifikacija, AI), pa `npx supabase functions deploy google-calendar` i `npx supabase functions deploy google-calendar-sync` (obje imaju `verify_jwt = false` u `config.toml`: callback dolazi od Google-a bez JWT-a, webhook takođe; funkcije same provjeravaju korisnika, potpisan `state`, token kanala ili `x-cron-secret`).
6. **Raspored** (SQL Editor; `pg_cron`, `pg_net` i vault tajna su iz 5a):
   ```sql
   select cron.schedule(
     'google-calendar-sync',
     '*/15 * * * *',
     $$
     select net.http_post(
       url := 'https://lpyyatqzvrvqgcmwiqfr.supabase.co/functions/v1/google-calendar-sync',
       headers := jsonb_build_object(
         'content-type', 'application/json',
         'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets
                           where name = 'sync_calendar_cron_secret')
       ),
       body := '{}'::jsonb
     );
     $$
   );
   ```
7. **Provjera:**
   - Postavke → Povezani kalendari → „Poveži Google kalendar“ → Google → povratak sa „Google kalendar je povezan“;
   - u Google Calendaru postoji kalendar „Hoot“ sa blokovima, ispitima i nastavom;
   - pomjeri blok u Google-u: za par sekundi je u Planu ručni blok;
   - Edge Functions → Logs ne smiju sadržavati token.
   Cron History: `{"synced": N, "failed": 0}`. **Gašenje:** `select cron.unschedule('google-calendar-sync');`.

## 5b. Web Push: `notify` i `pg_cron` (Sprint 10)

App sama upisuje kad je obavještenje na redu (`push_jobs`: podsjetnik prije bloka i „Kasniš 15 min“ od Sprinta 13, kraj planirane pauze, probno), a `notify` svake minute šalje dospjela na sve uređaje korisnika preko standardnog Web Push-a (VAPID, bez vanjskog servisa). Tekstovi i adrese uređaja se ne loguju.

**iPhone / iPad:** obavještenja rade samo kad je Hoot dodan na početni ekran (Safari → Dijeli → Dodaj na početni ekran, iOS 16.4+) i otvoren odatle; tek tad Postavke → Notifikacije → „Uključi obavještenja na ovom uređaju“ pita za dozvolu. Na Androidu i desktopu radi i u browseru.

1. **VAPID ključevi** (terminal, jednom; privatni ključ ide samo u password manager i Supabase secrets):
   ```sh
   npx -y web-push generate-vapid-keys
   ```
2. **Secrets** (zamijeni vrijednosti; `VAPID_SUBJECT` je kontakt za push servise):
   ```sh
   npx supabase secrets set VAPID_PUBLIC_KEY=<public> VAPID_PRIVATE_KEY=<private> VAPID_SUBJECT=mailto:<tvoj email>
   ```
3. **Cloudflare Pages** → `hoot` → Settings → Variables and Secrets: dodaj `VITE_VAPID_PUBLIC_KEY` = javni ključ za **Production i Preview**, pa novi deploy (svaki push na granu ga pravi). Lokalno isti red u `.env.local`.
4. **Deploy:** `npx supabase functions deploy notify` (u `config.toml` je `verify_jwt = false`; funkcija traži `x-cron-secret`). `CRON_SECRET` je isti kao za `sync-calendar` (5a, korak 1).
5. **Raspored** (SQL Editor; ekstenzije `pg_cron` i `pg_net` i vault tajna `sync_calendar_cron_secret` su iz 5a):
   ```sql
   select cron.schedule(
     'notify',
     '* * * * *',
     $$
     select net.http_post(
       url := 'https://lpyyatqzvrvqgcmwiqfr.supabase.co/functions/v1/notify',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets
                           where name = 'sync_calendar_cron_secret')
       ),
       body := '{}'::jsonb,
       timeout_milliseconds := 30000
     );
     $$
   );
   ```
6. **Provjera:** Postavke → Notifikacije → uključi na uređaju → „Pošalji probno obavještenje“ stiže za najviše minut. Integrations → Cron → `notify` → History; odgovor je `{"jobs": N, "sent": N, "failed": 0, "stale": 0, "gone": 0}`. Posao koji kasni više od 30 min se odbaci, ne šalje.
7. **Podsjetnici i Preskoči (Sprint 13):** od Sprinta 13 app piše podsjetnike prije svakog bloka i „Kasniš 15 min“ (umjesto prvog bloka dana), a notifikacija ima Započni / Preskoči. Poslije mergea: `npx supabase functions deploy notify` i `npx supabase functions deploy push-action` (`verify_jwt = false`, ključ je jednokratni token iz notifikacije; bez novih secreta). Provjera na Androidu: podsjetnik stiže sa dva dugmeta; Preskoči zamijeni notifikaciju sa „Preskočeno: …“, a blok se pomjeri kad se app otvori. Na iPhoneu dugmadi nema (tap otvara blok).
8. **Gašenje:** `select cron.unschedule('notify');`. **Novi ključevi:** ponovi 1–3; stare pretplate tad više ne rade, pa svaki uređaj ponovo uključi obavještenja.

## 5c. Google Drive Picker (Sprint 13)

> **Trenutno isključeno** (`DRIVE_ENABLED = false` u `src/features/sources/drive.ts`): `drive.file` ne daje pristup fajlovima u izabranom folderu, a `drive.readonly` traži Google-ovu sigurnosnu procjenu. Opcija „Google Drive“ se ne nudi dok se to ne odluči; podešavanje ispod ostaje za kasnije.

Uvoz sadržaja iz PDF-a na Drive-u. Scope je samo `drive.file` (app vidi fajlove koje korisnik izabere), pa Google ne traži sigurnosnu procjenu, a token se ne čuva.

1. console.cloud.google.com → isti projekat kao Gemini ključ (`hoot`) → APIs & Services → Library → uključi **Google Drive API** i **Google Picker API**.
2. OAuth consent screen → External → ime „Hoot“, email podrške; scope `.../auth/drive.file`; Test users: svoj Gmail. Testing režim je dovoljan dok je app za jednu osobu.
3. Credentials → Create credentials → **OAuth client ID** → Web application → Authorized JavaScript origins: `https://hoot-5ig.pages.dev`, `https://dev.hoot-5ig.pages.dev`, `http://localhost:5173`.
4. Credentials → Create credentials → **API key** → Restrict key: HTTP referrers (isti originsi) i API restrictions: samo Google Picker API.
5. Cloudflare Pages → `hoot` → Settings → Environment variables (Production i Preview): `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_PICKER_API_KEY`, `VITE_GOOGLE_APP_ID` (broj projekta). Javni su po dizajnu (kao `VITE_SUPABASE_PUBLISHABLE_KEY`), ograničeni originom.
6. Prije otvaranja za više korisnika: consent screen → Publish app (za `drive.file` bez verifikacije osim brendiranja).
7. Bez sve tri varijable app ne nudi opciju „Google Drive“ (ostaju PDF s uređaja, slika i kucanje). CSP u `public/_headers` već dozvoljava `apis.google.com`, `accounts.google.com/gsi`, `docs.google.com` (Picker iframe) i `www.googleapis.com` (preuzimanje); poslije dodavanja varijabli treba novi deploy (Retry deployment ili novi commit), jer Vite ih ugrađuje pri buildu.
8. Provjera: Predmet → + Izvor → Google Drive → izaberi PDF → „Pregledaj jedinice“; na izvoru je „Otvori u Drive-u“.

**Web pretraga za „Fakultet s interneta“ (Sprint 13).** Poslije mergea: `npx supabase functions deploy find-academic-info` i ponovo `parse-document` (nova vrsta „Plan i program“); novih secreta nema, koristi `LLM_PROVIDER` / `LLM_MODEL` / ključ kao ostale AI funkcije. Eval za plan i program: `GEMINI_API_KEY=... npm run eval` (slučaj „syllabus of a programme“). Bez novog ključa: na Gemini-ju je Google Search grounding (na free tieru ima dnevni limit, provjeriti u AI Studio → Usage), na Anthropicu web search tool (plaća se po pretrazi uz tokene). Jedan poziv po promjeni fakulteta.

## 5e. ML trening i praćenje: `train.yml`, `ml-monitor.yml` (Sprint 15)

`train.yml` (ručno i 1. u mjesecu) izvozi tvoje podatke, trenira, pokreće backtest i simulator i otvara PR u `dev` sa novim `priors.json` samo kad nema pogoršanja; inače ostaje samo izvještaj u Actions → run → Summary. `ml-monitor.yml` (ponedjeljkom) u Summary piše sedmične metrike (pokrivenost P80, Brier odrađenosti, kalibracija FSRS-a). Izvoz čita bazu kao ti (RLS kao u appu: uloga `authenticated`, JWT `sub` = tvoj id), iste kolone kao ručni izvoz, bez slobodnog teksta; podaci ne napuštaju runner.

GitHub → repo → Settings → Secrets and variables → Actions → **New repository secret**:

1. **`SUPABASE_DB_URL`**: Supabase → Project → **Connect** → **Session pooler** (port 5432) → URI, sa lozinkom baze umjesto `[YOUR-PASSWORD]`. Session pooler, ne Direct connection (GitHub runneri nemaju IPv6) i ne Transaction pooler (port 6543 ne čuva `set role` između upita). Lozinka je ista kao za `db push`; kad je promijeniš (Database → Settings → Reset database password), ažuriraj i ovaj secret.
2. **`HOOT_USER_ID`**: Supabase → Authentication → Users → tvoj red → **User UID** (uuid).
3. **`ML_PR_TOKEN`**: github.com → Settings (profil) → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token: ime `hoot-ml-train`, Expiration 1 godina (kalendar podsjetnik za obnovu), Repository access → **Only select repositories** → `umahmutovi1/hoot`, Permissions → Repository → **Contents: Read and write** i **Pull requests: Read and write** (Metadata: Read se doda sam). Generate → kopiraj token u secret. PAT umjesto `GITHUB_TOKEN`, jer PR koji otvori `GITHUB_TOKEN` ne pokreće CI.
4. Provjera: Actions → **train** → Run workflow (grana `dev`). Sa malo podataka izvještaj kaže „prior stays“ i PR-a nema; Actions → **ml-monitor** → Run workflow pokazuje tabelu po sedmici.

**Vraćanje modela:** revert PR-a „chore(ml): retrain … priors“ (ili `git revert` njegovog commita u `dev` kroz PR). Artefakt je samo `priors.json` + primjeri TS = Python; nova `version` ide u `input_hash`, pa app odmah planira sa vraćenim priorom.

## 6. Otvaranje aplikacije za više korisnika

Kod i baza su već spremni (svaka tabela ima `user_id` + RLS, profil se pravi automatski). Treba samo email sa vlastite domene.

1. **Domena.** Kupi domenu (npr. preko Cloudflare Registrar, `.com` ~10 USD/god).
2. **Resend.** Domains → Add domain → dodaj ponuđene DNS zapise (SPF, DKIM) u Cloudflare DNS → Verify.
3. **Supabase SMTP.** Sender email promijeni u npr. `prijava@<domena>`.
4. **Cloudflare Pages** (opcionalno). Projekat `hoot` → Custom domains → dodaj `<domena>` ili `app.<domena>`.
5. **Supabase URL Configuration.** Site URL i Redirect URLs dopuni novom domenom.
6. **Rate limits.** Authentication → Rate Limits → provjeri „emails sent per hour" (sa custom SMTP-om je podesivo).
7. **Registracija.** Allow new users to sign up → uključeno.
   - **Anonimna prijava (Sprint 21, „Prvo plan, pa prijava“).** Authentication → Sign In / Providers → **Allow anonymous sign-ins** → uključeno; **Allow manual linking** → uključeno (treba za „Spasi svoj plan“ preko Googlea, `linkIdentity`). Lokalno isto u `supabase/config.toml` (`enable_anonymous_sign_ins`, `enable_manual_linking`). Provjeri da registracija (korak 7) mora biti uključena da anonimna prijava radi.
   - **CAPTCHA.** Cloudflare → Turnstile → Add widget (domena app-a, mode Managed) → site key ide u `VITE_TURNSTILE_SITE_KEY` (Cloudflare Pages env), secret u Supabase → Authentication → Attack Protection → Enable CAPTCHA protection → Turnstile. Važi za sve prijave, pa i forma za email/lozinku šalje token.
   - **Rate limit anonimnih prijava.** Authentication → Rate Limits → „anonymous sign-ins per hour“ (default 30 po IP-u) ostaje dok nema problema.
   - **Čišćenje.** `pg_cron` posao iz migracije Sprinta 21 (sedmično, anonimni nalozi bez aktivnosti 30 dana); provjeri u Database → Cron Jobs da je aktivan.
8. **Prije toga odlučiti:** AI troškovi drugih korisnika (limit 30 poziva/dan/korisniku je u Sprintu 6); anonimno najviše 5 poziva ukupno, samo uvoz (PRD „Prvo plan, pa prijava“), napomena o privatnosti (admin pregled i zajednički ML trening uz pristanak, PRD „Dopune, 2. nov 2026“ → Zajednički trening), demo nalog.

Besplatna alternativa bez domene: Gmail SMTP sa app passwordom (radi za bilo koji email, ~500 dnevno, ali šalje sa lične Gmail adrese).

## 7. Troškovi

| Servis | Besplatno do | Plaća se kad |
| --- | --- | --- |
| Supabase | 50.000 MAU, 500 MB baza, 1 GB storage, 5 GB egress | baza > 500 MB (Pro 25 USD/mj) |
| Cloudflare Pages | neograničen saobraćaj, 500 buildova/mj | praktično nikad |
| Resend | 3.000 emailova/mj, 100/dan, 1 domena | preko toga (20 USD/mj) |
| GitHub | privatni repo, Actions | — |
| Domena | — | ~10 USD/god (kad se otvori za druge) |
| Gemini | free tier (dnevni limiti, podaci se mogu koristiti) | plaćeni tier po korištenju |
| Anthropic | — | po korištenju, ~$0.001 po parsiranju |
