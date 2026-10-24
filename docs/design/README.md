# Dizajn · Liquid Glass (Lavanda magla)

Svaki `.dc.html` je jedan ekran (390 px, mobilni). Ovo su mockupi: prenesi raspored, boje, tekstove i tokove u React + Tailwind,
ne kopiraj HTML. `<script>` na dnu fajla je samo demo interakcija. Varijante istog ekrana (UrediBlok*, Provjera*, NoviPredmet*)
su jedna komponenta sa stanjem.

## Vizuelni sistem
- Font: SF Pro (sistemski na Apple uređajima), Geist kao zamjena: `-apple-system, BlinkMacSystemFont, "SF Pro Text", Geist, system-ui, sans-serif`
- Tekst: #14121C (primarni), #3F3B4E (sekundarni), #55516A, #6E6A80 (najtiši)
- Akcent: #6A64B8, tamni #4C4892, najtamniji #36336E
- Predmeti: roza #B66A8C, indigo #6A64B8, čelično plava #5F86B5
- Status: zelena #5E9C72, narandžasta (upozorenje) #8F6136 tekst / rgba(195,141,82,0.18) pozadina
- Pozadina ekrana: slojevi radial-gradient (lavanda, puder roza, magličasto plava) preko #ECE9F4 → #E8E5F1

## Staklo (tokeni)
- `glass`: rgba(255,255,255,0.36) + backdrop-filter: blur(28px) saturate(170%)
  + box-shadow: inset 0 0 0 0.5px rgba(255,255,255,.55), inset 0 1px 1px rgba(255,255,255,.85), inset 0 -1px 1px rgba(58,51,96,.05), 0 8px 28px rgba(58,51,96,.07)
  — BEZ border-a; rub je samo inset svjetlo.
- `glass-strong` (navigacija, input): rgba(255,255,255,0.52), blur(32px) saturate(190%), sjena 0 12px 36px rgba(58,51,96,.12)
- `glass-sheet` (bottom sheetovi): rgba(250,249,253,0.80), blur(36px)
- `glass-tint` (kartica "Sljedeće"): linear-gradient(160deg, rgba(110,103,190,.90), rgba(76,72,146,.94)) + blur
- `btn-primary`: linear-gradient(160deg, #6E67BE, #4C4892), bijeli tekst
- Zaobljenja: kartice 24–28, liste 26, dugmad/čipovi pune pilule
- Performanse: u kodu napravi `glass` kao jednu klasu/Tailwind komponentu; ako uređaj ne podržava backdrop-filter
  ili je uključeno "smanji prozirnost", padaj na rgba(255,255,255,0.85) bez blura.

## Navigacija
**Odluka nakon v0.7.2 (mockup `NavMeni.html`):** donje kapsule više nema (u Safariju je bila nepouzdana i sporija). Prvi red svakog taba:
avatar (Postavke) → AI iskra odmah desno (otvara Chat) → ☰ u desnom uglu; AI i ☰ su samo ikone, a red nema pozadinu. **Odluka nakon 8b:** umjesto avatara je logo sove (`owl-pwa-icons/logo.svg`, prozirna pozadina, boja teksta) koji vodi na Danas; Postavke su u meniju. „✦ AI“ ima vrlo prozirnu staklenu pilulu da se vidi da je dugme; zatvaranje chata preko AI zatvara i meni. Sekcije menija se otvaraju nezavisno (otvaranje jedne ne zatvara drugu). Ispod su zaglavlje taba
i sadržaj do dna ekrana. ☰ otvara panel u staklu sheetova preko ekrana (isti prvi red, ☰ postaje ×): Danas, Plan, Predmeti, Napredak, Postavke;
stavke sa podstranicama su harmonika (otvorena je sekcija trenutne stranice), a na dnu je samo „Odjavi se“. Podstranice: Plan → Kalendar,
Dostupnost, Raspored nastave; Predmeti → aktivni predmeti, Svi predmeti; Napredak → Pregled, Sesije; Postavke → Sve postavke,
Akademski kalendar, Dokumenti (+ Povezani kalendari i Predlošci sesije kad stignu). Historija razgovora je u chatu. **Mrvice (odluka nakon 8b):** svaki ekran osim onboardinga, sesije u toku i forme kraja sesije ima isti prvi red (logo, AI, ☰). Ispod glavnih ekrana (Danas, Plan, Predmeti, Napredak, Chat) je drugi red: ‹ (nazad odakle si došla, bez historije jedan nivo gore) i putanja po mjestu u appu, npr. „Predmeti › Signali › Knjiga“; svaka mrvica iznad ekrana je link. Ekrani više nemaju svoje ‹ dugme. Sesija se pokreće iz kartice
"Sljedeće" (dugme Počni) ili iz chata.

## Ekrani po toku
- Onboarding (8 koraka, jedna komponenta sa stanjem `step`; svaki fajl je isti ekran na drugom koraku):
  Onboarding (ime, jezik) → OnboardingUvoz (akademski kalendar, raspored, iCal, "nemam ništa") → OnboardingRitam
  → OnboardingDani (sedmica sa vremenskom osom, šrafirana nastava) → OnboardingMaksimum (klizači, "To je 17h sedmično")
  → OnboardingPauze (predložak sesije, Standardno 50/15) → OnboardingPredmet (gruba veličina gradiva) → OnboardingSedmica.
  Svaki korak se preskače; preskočeni ostaju kao checklist na DanasPrazno.
- Danas i asistent: Danas (sedmica nastave, brze akcije, jedna kartica akcije + "Još N prijedloga", "Zašto ovako danas"),
  DanasNeMogu (toast Poništi), ImamSamo (15/30/45/60 min), Chat, ChatDokumenti (odgovor sa citatom, prijedlog uvoza),
  ChatPrilog (Daj dokument: uslikaj, slika, PDF, tekst), DanasPrazno (checklist), DanasSlobodno, KrenimoIspocetka
- Sesija: PokreniSesiju (koliko vremena imaš, predložak) → Sesija ("Ometena sam", + Kartica) → KrajSesije
  ("Do koje stranice", status jedinice se tapom mijenja) / KrajSesijeFokus (razlozi kad je fokus Slab) → RecallGate;
  ProvjeraZnanja → ProvjeraSazetak; Sesije (historija po danima, "ručno") → SesijaDetalj (segmenti, uredi ocjene, obriši)
- Plan (**odluka nakon 8b:** Kalendar i Satnica su jedan kalendar sa pogledima Dan, default i lijevo, i Mjesec; Dan je vremenska osa Satnice sa nastavom, zauzetošću i blokovima, „Vrati predloženo“ i „Dodaj blok“): Plan (Mjesec), PlanDan (Dan: pilule dana, vremenska osa, nastava i Google zauzetost šrafirano),
  PlanDanTermin (detalji termina nastave), Satnica (vremena automatski, pomjeren blok = ručni), Replan, Dostupnost, Raspored,
  UrediBlokNovi / Uredi / Obrisi. Zaglavlje Plana ima Dostupnost i Raspored.
- Predmeti: Predmeti, Predmet (Cilj: koliko ti je bitan, željena ocjena, kad kreće učenje, pojačanje ×; zaostatak u jedinici
  izvora; Bodovi i ocjena; popravni ugniježđen ispod ispita; Sesije), PredmetKampanja, NoviPredmet / NoviPredmetNapredno
  (imena umjesto brojeva prioriteta, nudge "Za 9 obično treba Važan", "Datum nije objavljen", gruba veličina gradiva),
  IspitSheet (tip, rok umjesto datuma, bodovi, prag, uslov za izlazak, samo ako zatreba, popravni),
  BodoviOcjena (imam / najviše moguće / za ocjenu 6–10), SkalaOcjena (za sve predmete / samo ovaj), Izvor, Jedinica, DokleSmoStigli
- Akademski kalendar i uvoz: AkademskiKalendar (Nastava, Ispitni periodi, Neradni dani), UvozPregled (novo / izmijenjeno /
  ostaje, preskoči po stavci), DodajIzvor → Parsiranje → ObimIspita
- Napredak i integracije: Napredak (sati po danu, prognoza kao raspon + šansa, procjena ocjene, bodovi po predmetima,
  "Kad ti učenje ide" mapa termina + prijedlog avoid_slot, poređenje predložaka, strategist, jačina po temama),
  Checkin (sedmični check-in), Postavke (granica dana, akademski kalendar, povezani kalendari, skala, predlošci,
  notifikacije, privatnost refleksija, izvoz CSV za Anki / JSON / ICS), PovezaniKalendari, DodajKalendar, Prijava

## Bez maskote
Nema maskote ni ilustracija na njenom mjestu: prazna stanja (DanasPrazno, DanasSlobodno) su samo tekst i dugme.
Male staklene indigo pločice sa bijelom linijskom ikonom ostaju samo kao ikone uz naslove kartica (strategist, kraj sesije).

## Odluke pri implementaciji redizajna (v0.7.2)
- Redizajn mijenja izgled postojećih ekrana. Elementi za funkcije koje još ne postoje (pretraga i notifikacije u zaglavlju Danas,
  plan i satnica u chatu, „Zašto ovako danas", prognoza, mapa termina, check-in…) dolaze u etapi kojoj pripadaju; pretraga je od oktobra 2026 u PRD-u (Etapa 10b).
- Do schedulera (Etapa 8b) kartica „Sljedeće" na Danas nudi slobodnu sesiju (Počni → PokreniSesiju); dok sesija traje, ista kartica
  pokazuje sesiju u toku i vraća u nju.
- **Nakon 8b:** dan bez bloka više nije poseban prazan ekran (DanasSlobodno): Danas zadržava fokus traku, a kartica „Sljedeće“ kaže „Danas nema plana“, sljedeći blok (sutra ili kasnije) i nudi slobodnu sesiju (uz „Predmeti“ kad plan nema gradiva). Tako se ekran ne mijenja dok se plan učitava. Kartice ispita imaju „za X dana“ ispod datuma (od Etape 10b u redu datuma, vidi ispod); PokreniSesiju uz čipove nudi „+ Predmet“ i „+ Izvor“.
- Ekrani preko cijelog ekrana i dalje imaju ljepljivo zaglavlje sa `env(safe-area-inset-top)`, a svaki sheet ima ×.

## Odluke nakon v0.10.0 (oktobar 2026, Etapa 10b)
PRD „Navigacija, pretraga, teme i geste“. Vodeći princip: manje odluka (default → jedan tap → tek onda postavka).
- **Prvi red je ljepljiv** na svim ekranima sa prvim redom: `sticky top-0` + `env(safe-area-inset-top)`. **Izmjena (oktobar 2026):** umjesto
  gradijenta platna sadržaj ispod reda se zamuti kao na iOS-u: `backdrop-filter: blur(20px) saturate(180%)` uz vrlo blag sloj boje platna
  (0.55), a donja ivica se gasi maskom (`mask-image: linear-gradient(to bottom, #000 75%, transparent)`), pa nema oštre linije. Logo, AI i
  ☰ ostaju oštri iznad zamućenja. Bez podrške za `backdrop-filter` ili uz „smanji prozirnost“: platno 0.92 bez blura. Mrvice skrolaju.
  Red: logo · AI · razmak · [pretraga ☰]. Pretraga i ☰ dijele jednu široku pilulu (88 × 44, ista pozadina kao isključeno AI dugme:
  `bg-white/30` + inset svjetlo), ikone ostaju boje teksta.
- **AI dugme** je samo ikona iskre u krugu 44 px, bez labela „AI“ i bez podvlake. Isključeno: `bg-white/30` + inset svjetlo, ikona
  `brand-accent`. Uključeno (u chatu): pozadina `glass-tint` (ista ljubičasta kao kartica „Sljedeće“ / sesija), ikona bijela.
  Boje pozadine i ikone zamijene mjesta; `aria-pressed` i `aria-label` „AI asistent“.
- **Meni:** naziv sekcije je link na glavnu stranicu sekcije, chevron desno je zasebno dugme 44 px koje otvara podstranice;
  podstranice se otvaraju animirano (visina, 200 ms), ne iskaču.
- **Motion sheetova:** BottomSheet je shadcn Drawer (`vaul`): ulazi odozdo krivom `cubic-bezier(0.32, 0.72, 0, 1)` ~400 ms
  (izlaz ~250 ms), ručka gore se može povući nadolje i zatvara sheet, scrim se gasi zajedno sa povlačenjem.
  `prefers-reduced-motion` → samo fade 150 ms.
- **Fokus kartica na Danas:** dva prstena kao u mockupu (80 px, debljina 9, track bijeli 0.6): vanjski r 32 plan danas (`brand-accent`),
  unutrašnji r 20 sedmica (pink deep); pored 2×2 statistika (Plan danas, Sedmica, Sljedeći ispit, Spremnost).
- **Kartice ispita:** hijerarhija iz mockupa u 4 reda sa jednakim razmakom 8 px: (1) datum, velika slova, boja predmeta, a desno u istom
  redu dani do ispita sitno sekundarno („5 d“, „sutra“, „danas“), (2) ime predmeta 14/600 (jedan red, `truncate`), (3) % 22/600,
  (4) traka 5 px, radijus 3 px, track 0.65. % i traka uvijek postoje (bez izvora „—“ i prazna traka), pa su sve tri kartice istog oblika i visine.
- **Swipe ulijevo** na redu liste: crveno „Obriši“ / sivo-ljubičasto „Arhiviraj“ / „Preskoči“ dugmad 72 px se otkrivaju ispod reda,
  red prati prst (otpor poslije širine dugmadi), puni swipe izvrši prvu akciju; uvijek toast Poništi. Ne počinje s lijeve ivice (iOS nazad).
- **Blok na Danas:** tap otvara mali sheet „Započeti sesiju sada?“ (predmet, gradivo, trajanje, predložak; Počni kao `btn-primary`,
  ispod Uredi · Preskoči · Obriši). Nazad u sesiji otvara sheet sa 4 opcije (Nastavi, Izađi a timer radi, Završi ranije, Odbaci crveno).
- **Plan kalendar kao iOS (oktobar 2026):** Dan je default i nema tabova Dan/Mjesec. Iznad pilula dana je pilula „‹ Oktobar 2026“ (crni tekst, lijevo,
  strelice sedmice desno) koja otvara Mjesec; tap na dan u Mjesecu vraća na Dan (nazad iz Mjeseca isto). Vremenska osa Dana je cijeli dan
  00–24 i otvara se na sada (danas), prvom bloku ili 08:00. Prazan dan nema napomenu „Nema nastave ovaj dan“.
- **Pretraga:** polje u `glass-sheet` panelu odozgo (kao meni), rezultati grupisani (Ekrani, Postavke, Predmeti, Izvori, Jedinice,
  Dokumenti), ikona grupe lijevo; prazno polje: nedavne pretrage.
- **Teme:** samo tokeni se mijenjaju po `[data-theme]` na `<html>` (brand, brand-strong, brand-accent, `glass-tint`, `btn-primary`,
  magla, platno, `theme-color`). Lavanda (default, sadašnje boje), Grafit (topla siva, akcent #4A4A55), Pijesak (bež, akcent #8A6A45),
  Kadulja (zelena, akcent #4F7A62), Okean (plava, akcent #3F6590); tačne vrijednosti se biraju u mockupu „Izgled“ uz kontrast ≥ 4.5:1.
  Boje predmeta ostaju iste u svim temama.
- Mockupi za Pretragu, Izgled (teme), sheet „Započeti sesiju sada?“, Podsjetnike i pregled plana i programa rade se na početku
  etape kojoj pripadaju (10b / 10c), u istom stilu kao postojeći `.dc.html`.
- Mockupi Etape 10b: `Pretraga.dc.html` (panel, nedavne, grupe, bez rezultata), `Izgled.dc.html` (Postavke → Opće → Izgled, 5 tema sa
  tačnim tokenima i izračunatim kontrastom) i `StartSesije.dc.html` (sheet „Započeti sesiju sada?“, „+ Dodaj blok“, BlockSheet
  „Zadrži ovo vrijeme“ / „Vrati planu“, nazad iz sesije). Statični su (bez `support.js`), više stanja na jednoj tabli kao `NavMeni.html`.
- **Odluke uz mockupe (oktobar 2026):** (1) Lavanda: svijetli kraj `glass-tint` je #645DB4 umjesto #6E67BE (bijeli tekst 4.09 → 4.64:1),
  sve ostalo ostaje; vrijednosti ostalih tema su u `Izgled.dc.html`. (2) Pretraga ima i grupu „Akcije“ (prva; otvara sheet: Više vremena
  ovaj dan, Imam još vremena) uz Ekrane, Postavke, Predmete, Ispite, Izvore, Jedinice i Dokumente. (3) Na AI bloku start sheet ima
  „Izbaci iz plana“, koje otvara postojeće pitanje „Obriši blok?“ iz Plana (kao u PRD-u).
