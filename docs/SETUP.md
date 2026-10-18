# Hoot — ručna podešavanja servisa

Sve što se radi u dashboardima (Supabase, Cloudflare, Resend, Anthropic), a ne u kodu. Tajne (lozinka baze, `re_…`, `sk-ant-…`, `service_role`) idu samo u password manager i Supabase secrets — nikad u repo, `.env` fajl ili chat.

## Pregled

| Servis | Šta | Status |
| --- | --- | --- |
| Supabase | projekat `hoot`, ref `lpyyatqzvrvqgcmwiqfr`, Frankfurt | ✅ |
| Cloudflare Pages | projekat `hoot` → `hoot-5ig.pages.dev`, production branch `main` | ✅ |
| GitHub | repo `umahmutovi1/hoot`, ruleset `protect-main-dev`, secrets za keepalive | ✅ |
| Resend | SMTP za auth emailove (kod za prijavu) | ⏳ |
| Anthropic | kredit, limit, workspace API ključ | ⏳ čeka karticu (treba tek u Etapi 8) |
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
Lozinka baze ovdje ne treba (CLI koristi login); treba za `backup.yml` u Etapi 10.

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
2. API Keys → Create API Key → name `hoot-supabase-smtp`, permission **Sending access**.
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
<div style="font-family:Arial,sans-serif;color:#1D1A2B;max-width:420px">
  <h2 style="color:#4B3B8F;margin:0 0 12px">Prijava u Hoot</h2>
  <p style="margin:0 0 8px">Tvoj kod za prijavu:</p>
  <p style="font-size:30px;font-weight:bold;letter-spacing:6px;margin:0 0 16px">{{ .Token }}</p>
  <p style="margin:0 0 16px">Upiši ga u aplikaciju ili <a href="{{ .ConfirmationURL }}" style="color:#4B3B8F">otvori link za prijavu</a>.</p>
  <p style="font-size:13px;color:#5B5670;margin:0 0 24px">Kod i link vrijede kratko i mogu se iskoristiti samo jednom.</p>
  <hr style="border:none;border-top:1px solid #DCD7EA">
  <p style="font-size:13px;color:#5B5670">Your Hoot sign-in code is <strong>{{ .Token }}</strong>. Enter it in the app or use the link above.</p>
</div>
```

### 3.4 Test
1. Otvori Hoot sa početnog ekrana telefona → email → „Pošalji link za prijavu".
2. App prelazi na „Provjeri email" sa poljem za kod.
3. Prepiši kod iz emaila (ne otvaraj link) → „Prijavi se kodom".
4. Ako email ne stigne: Resend → Emails / Logs.

## 4. Anthropic (Etapa 8)

1. console.anthropic.com → Billing → Add credits (najmanji iznos), Auto-reload isključen.
2. Settings → Limits → mjesečni spend limit (npr. $5).
3. **Workspace** ključ: Settings → Workspaces → Default → API keys → Create → `sk-ant-api03-…`. Ne `sk-ant-usr-…` (korisnički ključ traži `anthropic-workspace-id` header).
4. Ključ se unosi samo u terminal: `npx supabase secrets set ANTHROPIC_API_KEY=…`.

## 5. Otvaranje aplikacije za više korisnika

Kod i baza su već spremni (svaka tabela ima `user_id` + RLS, profil se pravi automatski). Treba samo email sa vlastite domene.

1. **Domena.** Kupi domenu (npr. preko Cloudflare Registrar, `.com` ~10 USD/god).
2. **Resend.** Domains → Add domain → dodaj ponuđene DNS zapise (SPF, DKIM) u Cloudflare DNS → Verify.
3. **Supabase SMTP.** Sender email promijeni u npr. `prijava@<domena>`.
4. **Cloudflare Pages** (opcionalno). Projekat `hoot` → Custom domains → dodaj `<domena>` ili `app.<domena>`.
5. **Supabase URL Configuration.** Site URL i Redirect URLs dopuni novom domenom.
6. **Rate limits.** Authentication → Rate Limits → provjeri „emails sent per hour" (sa custom SMTP-om je podesivo).
7. **Registracija.** Allow new users to sign up → uključeno.
8. **Prije toga odlučiti:** AI troškovi drugih korisnika (limit 30 poziva/dan/korisniku je u Etapi 8), napomena o privatnosti ako postoji admin pregled, demo nalog.

Besplatna alternativa bez domene: Gmail SMTP sa app passwordom (radi za bilo koji email, ~500 dnevno, ali šalje sa lične Gmail adrese).

## 6. Troškovi

| Servis | Besplatno do | Plaća se kad |
| --- | --- | --- |
| Supabase | 50.000 MAU, 500 MB baza, 1 GB storage, 5 GB egress | baza > 500 MB (Pro 25 USD/mj) |
| Cloudflare Pages | neograničen saobraćaj, 500 buildova/mj | praktično nikad |
| Resend | 3.000 emailova/mj, 100/dan, 1 domena | preko toga (20 USD/mj) |
| GitHub | privatni repo, Actions | — |
| Domena | — | ~10 USD/god (kad se otvori za druge) |
| Anthropic | — | po korištenju, ~$0.001 po parsiranju |
