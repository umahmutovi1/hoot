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
Plutajuća staklena kapsula, 5 mjesta: Danas · Plan · **AI** · Predmeti · Napredak. AI u sredini je ista ikona kao ostale,
bez pozadine, samo obojena akcentom #6A64B8 (iskra); otvara Chat.dc.html. Aktivni tab ima svjetliju staklenu pilulu. Sesija se pokreće iz kartice "Sljedeće"
(dugme Počni) ili iz chata, ne iz nava.

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
- Plan: Plan (Mjesec), PlanDan (Dan: pilule dana, vremenska osa, nastava i Google zauzetost šrafirano),
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
  plan i satnica u chatu, „Zašto ovako danas", prognoza, mapa termina, check-in…) dolaze u etapi kojoj pripadaju; pretraga nije u PRD-u.
- Do schedulera (Etapa 8b) kartica „Sljedeće" na Danas nudi slobodnu sesiju (Počni → PokreniSesiju); dok sesija traje, ista kartica
  pokazuje sesiju u toku i vraća u nju.
- Ekrani preko cijelog ekrana i dalje imaju ljepljivo zaglavlje sa `env(safe-area-inset-top)`, a svaki sheet ima ×.
