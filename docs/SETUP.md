# Hoot — ručna podešavanja servisa

Sve što se radi u dashboardima (Supabase, Cloudflare, Resend, Gemini, Anthropic), a ne u kodu. Tajne (lozinka baze, `re_…`, Gemini `AIza…`, `sk-ant-…`, `service_role`) idu samo u password manager i Supabase secrets — nikad u repo, `.env` fajl ili chat.

## Pregled

| Servis | Šta | Status |
| --- | --- | --- |
| Supabase | projekat `hoot`, ref `lpyyatqzvrvqgcmwiqfr`, Frankfurt | ✅ |
| Cloudflare Pages | projekat `hoot` → `hoot-5ig.pages.dev`, production branch `main` | ✅ |
| GitHub | repo `umahmutovi1/hoot`, ruleset `protect-main-dev`, secrets za keepalive | ✅ |
| Resend | SMTP za auth emailove (kod za prijavu), šablon u stilu appa | ✅ |
| Gemini | API ključ (free tier) za AI dok nema Anthropic kartice | ⏳ treba za Etapu 6 |
| Anthropic | kredit, limit, workspace API ključ | ⏳ čeka karticu (opcionalno, Etapa 10) |
| `pg_cron` | sinhronizacija povezanih kalendara svaka 3 h (`sync-calendar`) | ⏳ Etapa 8 |
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
Lozinka baze ovdje ne treba (CLI koristi login); treba za `backup.yml` u Etapi 11.

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
5. Rezultat: `main` → `hoot-5ig.pages.dev`, `dev` → `dev.hoot-5ig.pages.dev`, svaka druga grana dobija preview URL.

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

Body (Source):
```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1EFF7;padding:32px 16px;font-family:'Outfit',Arial,Helvetica,sans-serif;color:#1D1A2B">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:420px;background:#FFFFFF;border-radius:28px">
        <tr>
          <td style="padding:32px 28px 8px">
            <img src="https://hoot-5ig.pages.dev/pwa-192x192.png" width="56" height="56" alt="Hoot" style="display:block;border-radius:16px">
            <h1 style="margin:20px 0 6px;font-size:26px;line-height:1.2;font-weight:700;color:#1D1A2B">Prijava u Hoot</h1>
            <p style="margin:0;font-size:15px;line-height:1.45;color:#5B5670">Upiši ovaj kod u aplikaciju:</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px">
            <div style="background:#E9E4FB;border-radius:18px;padding:18px 0;text-align:center;font-size:34px;font-weight:700;letter-spacing:8px;color:#4B3B8F">{{ .Token }}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:4px 28px 8px">
            <p style="margin:0 0 14px;font-size:14px;color:#5B5670">Ili otvori link na ovom uređaju:</p>
            <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#1D1A2B;color:#FFFFFF;text-decoration:none;font-size:16px;font-weight:600;padding:16px 28px;border-radius:28px">Prijavi se</a>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 28px">
            <p style="margin:0 0 16px;font-size:13px;line-height:1.45;color:#5B5670">Kod i link vrijede kratko i mogu se iskoristiti samo jednom. Ako nisi tražila prijavu, ignoriši ovaj email.</p>
            <p style="margin:0;padding-top:16px;border-top:1px solid #DCD7EA;font-size:13px;line-height:1.45;color:#5B5670">Your Hoot sign-in code is <strong style="color:#4B3B8F">{{ .Token }}</strong>. Enter it in the app or use the button above.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
```

Email-safe tabele i inline stilovi u bojama appa; ikonica je PNG sa produkcije (WebP ne podržavaju svi klijenti), Outfit pada na Arial gdje nije dostupan.

### 3.4 Test
1. Otvori Hoot sa početnog ekrana telefona → email → „Pošalji link za prijavu".
2. App prelazi na „Provjeri email" sa poljem za kod.
3. Prepiši kod iz emaila (ne otvaraj link) → „Prijavi se kodom".
4. Ako email ne stigne: Resend → Emails / Logs.

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

**4. Edge funkcije** (Etapa 6: `parse-document`, `documents`, `answer`, `ai-status`):
```bash
for f in ai-status parse-document documents answer; do npx supabase functions deploy $f; done
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
npm run eval          # evals/promptfooconfig.yaml, 5 fiksnih primjera
unset GEMINI_API_KEY
```

## 5. Anthropic (opcionalno, Etapa 10)

1. console.anthropic.com → Billing → Add credits (najmanji iznos), Auto-reload isključen.
2. Settings → Limits → mjesečni spend limit (npr. $5).
3. **Workspace** ključ: Settings → Workspaces → Default → API keys → Create → `sk-ant-api03-…`. Ne `sk-ant-usr-…` (korisnički ključ traži `anthropic-workspace-id` header).
4. Ključ se unosi samo u terminal: `npx supabase secrets set ANTHROPIC_API_KEY=… LLM_PROVIDER=anthropic LLM_MODEL=claude-haiku-5-5`.

## 5a. Povezani kalendari: `sync-calendar` i `pg_cron` (Etapa 8)

`sync-calendar` povlači iCal linkove (Google, Outlook, iCloud) u `external_events`. App je zove pri otvaranju (najviše jednom u 30 min); `pg_cron` je zove svaka 3 h da plan ima svježu zauzetost i kad app nije otvoren. Bez LLM-a, ne troši AI limit. Tajni iCal link se nikad ne loguje; u `calendar_feeds.last_error` ide samo kod greške.

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

## 6. Otvaranje aplikacije za više korisnika

Kod i baza su već spremni (svaka tabela ima `user_id` + RLS, profil se pravi automatski). Treba samo email sa vlastite domene.

1. **Domena.** Kupi domenu (npr. preko Cloudflare Registrar, `.com` ~10 USD/god).
2. **Resend.** Domains → Add domain → dodaj ponuđene DNS zapise (SPF, DKIM) u Cloudflare DNS → Verify.
3. **Supabase SMTP.** Sender email promijeni u npr. `prijava@<domena>`.
4. **Cloudflare Pages** (opcionalno). Projekat `hoot` → Custom domains → dodaj `<domena>` ili `app.<domena>`.
5. **Supabase URL Configuration.** Site URL i Redirect URLs dopuni novom domenom.
6. **Rate limits.** Authentication → Rate Limits → provjeri „emails sent per hour" (sa custom SMTP-om je podesivo).
7. **Registracija.** Allow new users to sign up → uključeno.
8. **Prije toga odlučiti:** AI troškovi drugih korisnika (limit 30 poziva/dan/korisniku je u Etapi 6), napomena o privatnosti ako postoji admin pregled, demo nalog.

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
