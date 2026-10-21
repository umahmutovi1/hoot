# Hoot — istraživanje konkurencije, persona i pregled PRD-a

21. okt 2026 · nakon Etape 7 (`v0.7.0`). Odluke iz ovog fajla su prenesene u [PRD.md](PRD.md) i [ROADMAP.md](ROADMAP.md) (Etape 8–12); PRD je izvor istine. Ovdje ostaje obrazloženje i ono što još nije odlučeno (vidi „Otvorena pitanja“ na kraju).

## Sažetak (10 najvažnijih stvari)

1. **Onboarding fali, a scheduler (Etapa 8) bez njega laže.** Novi korisnik dobija dostupnost 06–24 svaki dan (`handle_new_user()`) i maksimum 3 h / 5 h. Prvi plan će stavljati učenje u 6:00, u vrijeme posla i treninga. Onboarding treba ući **prije** schedulera (prvi PR Etape 8).
2. **Plan je planiran na 100 % kapaciteta.** Studenti sistematski potcjenjuju vrijeme (planning fallacy), a heuristika 4 min/str. je početna pretpostavka. Treba deterministički **faktor realizacije** (koliko planiranog stvarno odradiš) i rezerva ~20 %, ne AI strategist koji to „predloži“.
3. **Pauze nisu dio plana.** Dnevni maksimum broji samo učenje, a `placeTimes()` nema pravilo za pauze između blokova. Ako se uvedu predlošci pauza (default 15 min, Pomodoro, vlastiti niz), satnica ih mora rezervisati.
4. **„Kad sam najproduktivnija“ treba biti statistika, ne LLM.** Već se skupljaju fokus 1–3 i segmenti. Rezultat po terminu dana (fokus, brzina u odnosu na kalibraciju, odrađeno/propušteno) sa shrinkage-om, kao kalibracija. LLM samo formuliše prijedlog („makni utorak 8–10?“).
5. **Signal „kašnjenje starta“ iz PRD-a ne postoji u praksi**: `planned_start` se puni samo kad korisnik generiše Satnicu. Bez toga nema učenja o terminima.
6. **Prognoza spremnosti treba biti raspon i vjerovatnoća, ne jedan broj.** Simulacija iz vlastite historije dnevnih minuta daje „68 % šanse da pokriješ obavezno do 12. nov“.
7. **Snježna gruda propuštenog.** Replan od sutra dijeli propušteno na preostale dane (isti problem kao Todait). Treba gornja granica dnevnog rasta i jasan „novi početak“ bez osjećaja krivice.
8. **Previše dugmadi za istu stvar**: prioritet (mijenja 5 stvari), željena ocjena, režim, ručni start, pojačanje, ciljna pokrivenost. Vrijedi pojednostaviti šta korisnik vidi.
9. **Uvoz Google/Apple kalendara (ICS)** je najjeftiniji način da „zauzeto“ bude tačno od prvog dana; konkurencija to ima, mi nemamo.
10. **Dokumentacija ima zastarjele dijelove** (PRD „Deploy i troškovi“, `toc-uploads`, `VITE_SUPABASE_ANON_KEY`, `LlmRequest.task`, `profiles.timer_mode`). Kandidati za brisanje ili prebacivanje u SETUP.md.

---

## 1. Konkurencija: šta rade, šta korisnicima smeta

| App | Šta dobro radi | Šta smeta korisnicima | Šta Hoot uzima / radi bolje |
| --- | --- | --- | --- |
| **Motion** | Automatski raspoređuje zadatke i preraspoređuje kad se dan pokvari | Nema pojma o energiji: zadaci padaju u bilo koji slobodan termin, ne kad radiš najbolje; povremeni gličevi pri preraspoređivanju; cijena i nagomilane funkcije; AI treba „štimati“ | Deterministički plan + učenje termina po fokusu (sekcija 6). Današnja lista se ne mijenja ispod tebe (već u PRD-u) |
| **Reclaim** | Rezerva između obaveza, navike koje se „brane“ u kalendaru, sinhronizacija s Google kalendarom | Za studente premalo: ne zna šta je ispit ni gradivo | Rezerva u kapacitetu, uvoz zauzetosti iz ICS-a |
| **Todait** | Stranice po danu iz roka; preraspodjela kad propustiš dan | Može biti „previše granularno“; preraspodjela podiže dnevno opterećenje (14 → 16 str.) i gomila se | Limit rasta dnevnog opterećenja, deficit sa opcijama (već u PRD-u), „novi početak“ |
| **Shovel** | Procjena sati po zadatku i stalna provjera „stižeš li“ | Procjene unosi korisnik ručno, pa nasljeđuje optimizam (planning fallacy) | Procjene se uče iz timera (već u PRD-u); prikazati „stižeš li“ odmah u onboardingu |
| **GoodPlans / Due Gooder / Knowunity** | Upload silabusa ili slika rasporeda puni kalendar; kratak upitnik na početku | Osnivač GoodPlansa: većina završi onboarding pa ne napravi ni jedan zadatak | Onboarding mora završiti **gotovim planom za danas**, ne praznim ekranom |
| **MyStudyLife, Power Planner** | Raspored sa rotacijama, zadaće, ocjene | Sve ručno; ne planira učenje | Imamo raspored + plan + ocjene u jednom |
| **Anki, RemNote** | FSRS, jako dobro pamćenje | Ponavljanja se gomilaju (posebno uz 90 % zadržavanja i nakon pauze), ne zna za datum ispita, odvojeno od plana dana | FSRS je dio plana sa limitom (`review_cap_pct`), ciljno zadržavanje po prioritetu, ograničenje na datum ispita |
| **StudyFetch, Quizlet AI** | Bilješke, kvizovi i sažeci iz materijala | Tačnost AI-ja, naplata i automatska obnova, gličevi, gubljenje sadržaja | AI nikad ne piše direktno, pregled prije spašavanja, offline red; bez pretplate |
| **Forest, Focusmate, Rize** | Fokus: gamifikacija, „body doubling“, automatski Focus Score | Rize mjeri samo desktop aplikacije; streakovi i „mrtva drva“ znaju izazvati krivicu | Fokus iz 1 tapa + pasivnih signala, bez streak-kazni |
| **Sunsama, Structured, Tiimo** | Dnevni ritual planiranja, upozorenje „previše si stavila“, vizuelna vremenska linija (ADHD) | Ručno planiranje svaki dan | Sedmični check-in od 2 min (sekcija 8) + vremenska osa koju već imamo |

**Zaključak.** Svaka od ovih aplikacija radi jedan dio lanca: ispit → gradivo → izmjereno vrijeme → ponavljanje → plan dana → prognoza. Hoot ih spaja, i to je pravo diferenciranje. Ponavljaju se tri žalbe: (a) AI ne zna kad korisnik dobro radi, (b) plan se raspadne i gomila nakon propuštenog dana, (c) unos na početku je dosadan pa korisnik odustane. Na sve tri PRD ima djelimičan odgovor, ali ne potpun.

---

## 2. Persona

**Lejla, 21, 3. godina ETF Sarajevo (Telekomunikacije)**

- **Semestar:** 6 predmeta. Signali i sistemi je uslovni (prioritet 5, pala ga je prošle godine). Vjerovatnoća ima dvije parcijale u 8. i 15. sedmici; Digitalna obrada slike ima projekat i usmeni.
- **Sedmica:** nastava pon–pet, često 9–15, sa rupama od 1–2 h. Tramvajem putuje 35 min u jednom smjeru. Utorkom i četvrtkom 17–20 drži privatne časove (posao). Trening ponedjeljkom i srijedom 19–20:30.
- **Ritam:** noćna ptica. Najbolje radi 21–01 h, ujutro je spora. Vikendom spava do 10.
- **Gradivo:** knjiga Oppenheim (engleski, ~600 str.), profesorova skripta (PDF), prezentacije, lista od ~80 ispitnih pitanja za usmeni.
- **Navike:** planove pravi u Notionu na početku semestra i napusti ih do 3. sedmice. Uči u kampanjama 10 dana pred ispit. Na telefonu je stalno, Google kalendar koristi za posao.
- **Bolne tačke:** „Ne znam koliko mi treba po stranici Oppenheima.“ „Kad propustim dva dana, plan mi postane nemoguć, pa ga bacim.“ „Ujutro se natjeram, a ništa ne uđe.“
- **Uspjeh za nju:** položiti Signale, prosjek iznad 8, bez noćnih maratona u ispitnom roku.

---

## 3. End-to-end prolaz (Lejla, PRD do Etape 12)

Oznake: 🔴 blokira povjerenje u plan · 🟠 bitno · 🟡 dorada.

**Dan 0: instalacija i prvi ulazak**

1. Magic link / kod, pa „Kako da te zovem?“. Brzo, OK.
2. 🔴 **Danas je prazan, a onboardinga nema.** Dostupnost je već 06–24 svaki dan, maksimum 3 h / 5 h. Lejla to ne zna dok ne otvori Plan → Dostupnost. Satnica će joj kasnije predložiti 07:00 u utorak.
3. 🟠 **Redoslijed zavisnosti nije objašnjen.** Raspored traži period nastave iz akademskog kalendara. Lejla prvo želi uslikati raspored (Etapa 10), a app traži kalendar. Treba inline pitanje „Kad počinje i završava semestar?“ (2 datuma), a ne cijeli akademski kalendar.
4. 🟠 **Vremenska zona** je default `Europe/Sarajevo`; uzeti `Intl.DateTimeFormat().resolvedOptions().timeZone` pri prvom ulasku (Erasmus, putovanja).
5. 🟠 **Posao i trening** nisu nastava, pa ih mora ručno brisati iz dostupnosti, i to kao „svaki utorak“. Uvoz Google kalendara (ICS) bi to riješio jednim linkom.

**Dan 0: predmeti i gradivo**

6. NoviPredmet za < 30 s: odlično. „Datumi još nisu poznati?“ iz akademskog kalendara: odlično.
7. 🔴 **Predmet bez izvora satnica ignoriše.** Do Etape 10 (uslikaj sadržaj) Lejla mora ručno kucati sadržaj Oppenheima. Dva od šest predmeta će ostati bez izvora, pa plan za njih ne postoji, a ona misli da ih app „ima“. Prijedlog: **gruba procjena obima** pri dodavanju predmeta („~300 str. skripte“ ili „~20 h“) pravi privremeni izvor sa N jednakih jedinica, kasnije zamjenjiv pravim sadržajem (merge po `label` već postoji).
8. 🟠 **Heuristika 4 min/str. za Oppenheim na engleskom** je vjerovatno preoptimistična. Prvi plan obeća previše. Vidi sekciju 6.1 (lični faktor brzine) i 6.2 (faktor realizacije).
9. 🟡 Prioritet, režim, željena ocjena: tri pojma sa preklapajućim efektima (sekcija 7).

**Sedmica 1: prvi plan**

10. 🟠 **Kapacitet = 100 % slobodnog.** Ako je u ponedjeljak slobodno tačno 3 h, plan stavi 3 h. Nema mjesta za kašnjenje, umor ni nepredviđeno.
11. 🟠 **Rupe između predavanja (1–2 h) i tramvaj (35 min)** su idealne za ponavljanja i kartice, ali `min_block_minutes = 25` i blokovi učenja ih ne koriste dobro. Prijedlog: tip „mikro-blok“ (10–20 min) samo za `review` i kartice.
12. 🟡 **Danas ekran je pretrpan karticama**: sljedeći blok, lista, 3 ispita, „zašto ovo danas“ ili strategist, „Dokle ste stigli?“, prijedlozi zaostatka, deficit, najava kampanje, „Znaš li?“, traka sove. Treba pravilo: najviše jedna kartica akcije iznad lista blokova, ostale u „Još 2 prijedloga“.

**Sesija**

13. Timer iz segmenata, offline: odlično i rijetko kod konkurencije.
14. 🟠 **Pauze**: samo 25/5 i 50/10 kao podsjetnik. Lejla hoće 50 min učenja i 15 min pauze, a za usmeni 90/20. Nema vlastitog niza ni duge pauze nakon 4 pomodora (sekcija 5).
15. 🟠 **Kraj pauze se ne javlja kad je ekran zaključan** (iOS PWA ne izvršava JS u pozadini). Rješenje dolazi tek sa Web Push-om (Etapa 12): ulazak u pauzu zakaže server push za kraj pauze.
16. 🟡 **Fokus 1–3** je dobar i jeftin. Kad je fokus 1, opcionalni čipovi razloga (umorna, telefon, buka, teško gradivo, loše spavala) razdvajaju „loš termin“ od „teško gradivo“, što je ključ za učenje termina.

**Sedmice 2–4: život**

17. 🔴 **Propuštena dva dana** (prehlada). Replan od sutra rasporedi propušteno, dnevni plan naraste, ispod 70 % ispunjenosti Lejla opet odustaje. Nedostaje: „Danas ne mogu“ jednim tapom (cijeli dan zauzet + replan), limit dnevnog rasta i ponuda „novi početak“ (prihvati rizik / smanji obim) **prije** nego plan postane nerealan.
18. 🟠 **Uči u 23:30–01:00**, a satnica (ako je generisana) predlaže popodne. Bez `planned_start` nema signala, pa app nikad ne nauči. Sekcija 6.3.
19. 🟠 **Kampanja Signala** kreće ALAP + 20 % margine. Dobro, ali ako je faktor realizacije 0.7, start je prekasno. Faktor realizacije mora ući u ALAP računicu.

**Ispitni rok**

20. 🟠 **Ispitni rok je poznat iz akademskog kalendara**, ali dnevni maksimum ostaje 3 h. Prijedlog kartice: „Ulaziš u ispitni rok — povećati maksimum na 6 h do 14. feb?“ (izuzeci dostupnosti, jedan tap).
21. 🟡 **Dan pred ispit**: buffer radi samo ponavljanje, dobro. Dodati pravilo spavanja: noć prije ispita bez blokova poslije npr. 23:00 (podesivo).
22. 🟠 **Prognoza „pokrivaš 87 %“** je jedan broj, bez nesigurnosti; Lejla ne zna koliko da mu vjeruje.
23. Rezultat ispita i `readiness_before` zatvaraju krug: odlično. S 10–12 ispita po godini to je premalo podataka za učenje ocjene; prikazivati kao grub raspon.

---

## 4. Onboarding (prijedlog toka)

Cilj: za 2–3 minute od „Kako da te zovem?“ do **plana za danas** ili bar do realne sedmice. Svaki korak se može preskočiti, a preskočeni ostaju kao checklist na DanasPrazno („Još 2 koraka do tačnog plana“). Napredak se pamti (`profiles.onboarding_step`), pa se može nastaviti kasnije.

**Redoslijed: prvo uvoz, pa dostupnost**, kako si predložila: kad Lejla stigne do dostupnosti, nastava i ostale obaveze su već šrafirane, pa bira samo slobodno.

| # | Korak | Šta pita | Šta upiše | Napomena |
| --- | --- | --- | --- | --- |
| 1 | Ime i jezik | postoji | `display_name`, `locale`, `timezone` iz browsera | |
| 2 | „Šta već imaš?“ | Kartice: akademski kalendar (PDF/slika/tekst), raspored nastave (slika od Etape 10, ručno do tad), Google/Apple kalendar (ICS link), „Nemam ništa sad“ | `academic_periods`, `timetable_entries`, novi izvor zauzetosti | Uvoz kroz isti pregled (novo / izmijenjeno). Raspored bez kalendara pita samo 2 datuma semestra |
| 3 | Ritam | „Kad obično ustaješ i liježeš?“ (radni dan / vikend) i „Kad ti je najlakše učiti?“ (jutro / podne / popodne / veče / kasno noću, više izbora) | prozor dana (zamjenjuje 06–24), `day_start_min` (npr. 2 h poslije uobičajenog lijeganja, najmanje 04:00), prior za termine | Prior za učenje termina (sekcija 6.3) |
| 4 | Dani i periodi | Sedmica sa vremenskom osom: nastava i kalendar šrafirani, predloženi slobodni periodi iz koraka 3. Tap uključi ili isključi dan, čipovi „jutro / popodne / veče“ ili prevlačenje | `availability_rules` | Ista komponenta kao ekran Dostupnost, samo vođena |
| 5 | Koliko najviše | Klizač po grupi dana (radni / vikend), uz tekst: „Plan ostavlja rezervu, pa je bolje reći realno nego idealno“ | `daily_cap_min` | Prikazati sedmični zbir: „To je 17 h sedmično“ |
| 6 | Pauze | Predložak: Standardno (default, pauza 15 min), Pomodoro 25/5 + duga pauza, vlastiti niz | predložak timera | Sekcija 5 |
| 7 | Prvi predmet (opcionalno) | Naziv + ispit + datum + **gruba veličina gradiva** | predmet, ispit, privremeni izvor | Bez ovoga plan je prazan |
| 8 | „Tvoja sedmica“ | Pregled: slobodno X h, potrebno Y h do prvog ispita, „stižeš / fali 6 h“ (kao Shovel) i današnji prvi blok | | Vrijednost odmah, prije prvog unosa sadržaja |

**Tehnički.** Okidač `handle_new_user()` i dalje pravi default (sigurnosna mreža); onboarding ga zamjenjuje. Nova polja: `profiles.onboarded_at`, `onboarding_step`, `wake_min[]`, `sleep_min[]`, `preferred_windows` (prior za termine). Migracija + `grant` po CLAUDE.md. Dizajn: novi mockup (`Onboarding.dc.html`) prije implementacije.

---

## 5. Pauze i predlošci sesije

**Šta kažu istraživanja.** Prema [Smits i sar. 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12292963/) (94 studenta, 2 h učenja), uz Pomodoro umor raste brže, a uz Pomodoro i Flowtime motivacija brže pada nego uz pauze koje student sam bira. Produktivnost i završenost zadataka bile su iste. PRD citira [Biwer 2023](https://nufind.nu.edu.sa/EdsRecord/eric,EJ1386535) u korist sistemskih pauza. Zaključak: nijedan režim nije pobjednik za sve, pa je PRD-ova ideja „app mjeri koji režim tebi daje bolju efikasnost i fokus“ prava stvar. Treba više režima, a ne jedan „najbolji“.

**Prijedlog modela.** Predložak (`timer_presets`, jsonb na profilu, Zod šema u `_shared/`) je niz intervala koji se ponavlja:

```json
{ "id": "standard", "steps": [{ "kind": "work", "min": 50 }, { "kind": "break", "min": 15 }], "long_break": null }
{ "id": "pomodoro", "steps": [{ "kind": "work", "min": 25 }, { "kind": "break", "min": 5 }], "long_break": { "every": 4, "min": 20 } }
{ "id": "flow", "flow_ratio": 5 }   // Flowtime: pauza = učenje / 5, kraj učenja biraš sama
{ "id": "free" }
```

- **Default (odlučeno):** „Standardno“ 50 min učenja / 15 min pauze.
- **Vlastiti niz:** editor intervala („45 učenje → 10 pauza → 45 → 20 → ponovi“), spašen kao imenovani predložak; izbor po sesiji u PokreniSesiju, default u Postavkama.
- **Ostaje odluka iz Etape 7:** timer nikad sam ne otvara ni zatvara segment. Značka odbrojava, a pauza je tap. Kraj pauze sa zaključanim ekranom javlja Web Push (Etapa 12): ulazak u pauzu zakaže `notify` za `break_end_at`.
- **Plan mora znati za pauze** (trenutno ne zna):
  - `placeTimes()` slaže blokove sa pauzom po predlošku između i unutar dugih blokova; dnevni maksimum ostaje „minute učenja“, a slobodni termini moraju primiti učenje + pauze.
  - Dužina bloka teži višekratniku intervala učenja (50 + 50, ne 70), pa se podsjetnik i blok poklapaju.
- **Mjerenje:** `study_sessions.timer_mode` postaje id predloška; statistika poredi brzinu i fokus po predlošku (Etapa 11) i nakon dovoljno sesija predloži „uz 50/15 ti je fokus bolji nego uz 25/5“.

---

## 6. AI i ML dio: šta je dobro, šta fali

Opće pravilo, u skladu s PRD-om: **brojeve računa kod, LLM samo objašnjava.** Malo podataka (jedan korisnik, desetine sesija) znači jednostavne Bayesove modele sa shrinkage-om, ne neuronske mreže. Isti obrazac `k/(k+c)` već postoji u kalibraciji i treba ga ponoviti svuda.

### 6.1 Procjene vremena (`src/lib/estimates/`)

- ✅ Shrinkage po izvoru i paru izvor × način, težina odvojena od brzine. Dobro.
- ➕ **Lični faktor brzine** (hijerarhijski prior): novi izvor ne počinje od čiste heuristike, nego od heuristike × korisnikov faktor (prosječan omjer izmjereno/heuristika na drugim izvorima istog tipa, opet uz shrinkage). Ako je Lejla 1.6× sporija na Oppenheimu, i nova knjiga je vjerovatno sporija. Jeftino i najveći dobitak za prve sedmice novog semestra.
- ➕ **Jezik izvora** (bs/en) kao faktor priora: engleska literatura je za mnoge sporija.
- ➕ **Termin dana i umor** ne treba miješati u brzinu izvora, ali brzinu po segmentu treba spremiti za 6.3 (ostati samo u `session_units` nije dovoljno).
- 🟡 Onboarding pitanje „Koliko ti otprilike treba za stranicu udžbenika?“ samo ako nema drugih podataka. Ljudi su tu loši procjenitelji, pa slaba težina priora.

### 6.2 Kapacitet i realizacija (scheduler)

- 🔴 **Faktor realizacije** `ρ` = odrađene / planirane minute, klizno zadnjih 14 dana, shrinkage prema 0.8 (`n/(n+7)`). Kapacitet za plan = min(slobodno, maksimum) × ρ. PRD to daje strategistu kao AI prijedlog („smanjuje kapacitet ako je plan stalno preoptimističan“); to je pravilo, ne mišljenje, pa pripada `plan()` i `input_hash`. AI ostaje za objašnjenje.
- ➕ **Rezerva**: i uz ρ = 1, planira se najviše ~85–90 % (konstanta), tako da jedan loš dan ne prevrne plan.
- ➕ **Limit rasta poslije propuštenog**: dnevni plan ne smije narasti više od npr. 25 % iznad prosjeka zadnje sedmice; ostatak ide u deficit sa 3 opcije, a ne u sutrašnji dan.
- ➕ **Faktor realizacije po danu u sedmici** (utorkom radi pa uči manje) kad bude dovoljno podataka.

### 6.3 Učenje termina („kad sam najproduktivnija“)

Podaci koji već postoje ili se lako dodaju, po terminu (npr. 5 dijelova dana × radni/vikend):

| Signal | Izvor | Napomena |
| --- | --- | --- |
| Fokus 1–3 | kraj sesije | ima |
| Brzina / očekivana brzina (uz težinu) | segmenti + kalibracija | >1 znači sporije nego inače za to gradivo |
| Odrađeno vs propušteno | blokovi sa terminom | traži `planned_start` (vidi ispod) |
| Kašnjenje starta | `planned_start` vs prvi segment | traži `planned_start` |
| Pauze i prebacivanja po satu | segmenti | pasivno |
| Razlog niskog fokusa (opcionalno) | čipovi na kraju sesije | odvaja „loš termin“ od „teško gradivo“ |

- **Model:** ocjena termina = kombinacija standardizovanih signala, svaki uz shrinkage prema prioru iz onboardinga („najlakše mi je navečer“). Za „hoću li stvarno odraditi blok u ovom terminu“ dovoljan je Beta-Bernoulli po terminu; Thompson sampling daje malo istraživanja, pa app ne zaglavi samo u terminima koje je jednom izabrala. Pristupi za personalizaciju sa malo podataka: [IntelligentPooling](https://arxiv.org/pdf/2008.01571).
- **Upotreba (sve kod):** `placeTimes()` stavlja teške jedinice i prvo učenje u najbolje termine, a ponavljanja, prezentacije i kartice u slabije (synchrony efekat je najjači za zahtjevne, analitičke zadatke — [pregled](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2022.851502/full)). Kartica prijedloga, kad termin ima dovoljno podataka i jasno je loš: „Utorkom ujutro ti propadne 4 od 5 blokova. Maknuti utorak 08–10 iz dostupnosti?“ ili „Navečer ti je fokus 2.7/3. Dodati srijedu 21–23?“. Jedan tap mijenja dostupnost, pa replan. To su promjene ulaza, u skladu s arhitekturom.
- **Prag:** ništa se ne predlaže prije npr. 6 sesija u terminu; prikaz „uči se…“ dok nema podataka.
- **Zamke:** (a) teško gradivo navečer izgleda kao loš termin, pa brzina mora biti normalizovana težinom; (b) povratna petlja; (c) ispitni rok mijenja ritam, pa ga posmatrati odvojeno ili sa većim zaboravljanjem starih podataka.
- 🔴 **Preduslov za Etapu 8:** blok mora imati planirani termin i kad Satnica nije otvorena. Ili `placeTimes()` radi automatski (Satnica samo prikazuje), ili blok dobije „predloženi prozor“. Inače signali „kašnjenje starta“ i „termini koje preskačeš“ iz PRD-a ostaju prazni. Podatke treba skupljati od Etape 8, da ih Etapa 11 ima.

### 6.4 Spaced repetition (FSRS)

- ✅ Ciljno zadržavanje po prioritetu, limit ponavljanja, ograničenje na datum ispita, logovi za kasniju optimizaciju. Bolje od Anki-ja za ispite.
- 🟠 **Cilj nije R danas nego R na dan ispita.** Dodati pravilo: za svaku jedinicu u obimu, predviđeni R(datum ispita) ≥ cilj, inače zakazati ponavljanje u bufferu. Prognoza spremnosti treba koristiti R na dan ispita, a ne današnji.
- 🟠 **Jedinica nije kartica.** FSRS default parametri su naučeni na kratkim karticama, a jedinica je poglavlje od 30 str. Ocjena 0–2 za cijelo poglavlje je gruba, pa stabilnost vjerovatno ispadne previsoka. Prijedlozi: kartice i ispitna pitanja kao zasebni FSRS objekti (pitanje je ionako jedinica tipa `question`); za poglavlja konzervativniji ciljni R ili ocjena iz skeleton recall-a (% podnaslova) umjesto 0–2.
- 🟡 Lični parametri nakon ~100+ ponavljanja: već u planu, OK.

### 6.5 Prognoza spremnosti i ocjene

- ➕ **Monte Carlo**: 1000 simulacija preostalih dana, gdje je dnevni odrađeni rad uzorkovan iz vlastite historije (bootstrap, uz ρ), daju P(pokrivenost obaveznog ≥ cilj do ispita) i raspon. Prikaz: „Vjerovatno 75–90 % · 70 % šanse da stigneš obavezno“. Jeftino, u browseru, testabilno.
- 🟠 **Procjena ocjene** (pokrivenost × jačina) je razumna heuristika, ali s ~10 ispita godišnje kalibracija iz rezultata je spora. Prikaz kao raspon ocjena, uz `readiness_before` kao signal precjenjivanja („obično se precijeniš za 1 ocjenu“).

### 6.6 LLM dijelovi

- ✅ Structured outputs + Zod, pregled prije spašavanja, `ai_runs`, evali. Bolje od konkurencije, gdje je tačnost glavna žalba.
- 🟠 **Strategist** — većina njegovih akcija su pravila (zaostatak, deficit, gužva ispita, faktor realizacije, termini). Prijedlog: pravila u kodu generišu kandidate, LLM bira najviše 3 i piše objašnjenje na jeziku korisnika. Jeftinije, testabilno, bez izmišljenih akcija.
- 🟠 **Privatnost:** refleksije i razlozi niskog fokusa su lični tekst. Dok je Gemini free tier (Google može koristiti podatke), ne slati ih strategistu ili tražiti izričit pristanak.
- 🟡 **„Opće znanje (AI)“ recall** je najrizičniji izvor (halucinacije) — već je označen. Zadržati iza ostalih.
- 🟡 **Ekstrakcija iz refleksije** („nije mi jasna konvolucija“ → spusti sigurnost jedinice): korisno, ali kao prijedlog sa potvrdom, ne direktno.

---

## 7. Rupe i nedosljednosti u dokumentaciji

| Gdje | Problem | Prijedlog |
| --- | --- | --- |
| PRD „Podaci za strategista“ | „Efikasnost po dobu dana → strategist stavlja teške jedinice u najbolje termine u satnici“: satnicu pravi kod, strategist ne smije pisati blokove | Ocjena termina u `placeTimes()` (6.3) |
| PRD isto | „Ispunjenost plana → strategist smanjuje kapacitet“ | Faktor realizacije u `plan()` (6.2) |
| PRD „Kašnjenje starta“ | `planned_start` postoji samo uz generisanu Satnicu | Planirani termin za svaki blok (6.3) |
| PRD „Tehnike učenja“, spaced | „Scheduler ne stavlja istu jedinicu više od jednom dnevno“ vs „duga jedinica se dijeli na više blokova“ | Pojasniti: dijelovi iste jedinice smiju isti dan? |
| PRD interleaving | „Isključivo u postavkama“ nejasno | „Uključuje se samo u postavkama, default isključeno“ |
| PRD „Dostupnost“ | Default 06–24 je planski neprihvatljiv bez onboardinga | Onboarding (sekcija 4) |
| PRD „Deploy i troškovi“ | Bucket `toc-uploads` (stvarno `uploads`), `VITE_SUPABASE_ANON_KEY` (stvarno `PUBLISHABLE_KEY`), keepalive curl na tabelu (stvarno RPC) | Obrisati sekciju iz PRD-a, ostaviti link na SETUP.md |
| PRD „AI integracija“ | `LlmRequest.task` lista zastarjela (enum iz baze je širi); „Haiku kao default“ dok je stvarno Gemini | Uskladiti sa `_shared/llm.ts` |
| PRD šema 0001 | `profiles.timer_mode` `'25/5'` vs `study_sessions.timer_mode` `'pomodoro25'` iz 0012 | Uskladiti pri uvođenju predložaka |
| PRD „Granica dana“ | 04:00 fiksno u tekstu, a noćne ptice uče do 4:30 | Predložiti iz onboardinga (vrijeme lijeganja) |
| PRD prioritet | Tabela od 5 efekata prioriteta + željena ocjena + ciljna pokrivenost + pojačanje: korisnik ne vidi zašto se nešto desilo | U UI prikazivati jedan pojam „Koliko ti je bitan“ + željenu ocjenu, a „zašto ovo danas“ neka imenuje efekat |
| ROADMAP | Notifikacije tek u Etapi 12, a bez njih nema podsjetnika na prvi blok ni kraja pauze | Osnovni push (prvi blok, kraj pauze) premjestiti odmah iza Etape 8 ili 9 |
| ROADMAP | Onboarding ne postoji ni u jednoj etapi | Prvi PR Etape 8 |

---

## 8. Šta bi se moglo izbaciti ili odgoditi

- **Kartica „Znaš li?“ na Danas**: šarmantna, ali gura stvarne akcije ispod. Premjestiti u prazna stanja ili splash.
- **Šest načina testiranja** (ispitna pitanja, bilješke-AI, skeleton, blurting, kartice, slika stranice, opće znanje): za v1 tri (ispitna pitanja, skeleton/podnaslovi, kartice), ostalo kasnije.
- **Kvizovi** (`quiz`) se preklapaju s recall pitanjima iz bilješki: jedan alat.
- **Sedmični AI strategist kao poseban LLM** dok pravila ne postoje: prvo pravila (sekcija 6.6), LLM tek za objašnjenje.
- **Satnica „na zahtjev“** kao jedini izvor termina: ili automatska, ili blok ima prozor (6.3). „Generiši“ dugme kao ritual je višak.

## 9. Nove ideje (šire)

- **„Danas ne mogu“ / „Imam samo 30 min“** na Danas: prvo zauzme dan i pokrene replan; drugo izabere najvredniji komad za 30 min (ponavljanje koje ističe, pa najhitnije gradivo).
- **Sedmični check-in (nedjelja, 2 min)**: potvrdi izuzetke za sljedeću sedmicu (rođendan, put), pogledaj prognozu i, opcionalno, savjet. Plan se tako popravi unaprijed, a ne kad propadne. Ide uz strategista.
- **ICS uvoz i izvoz**: zauzetost iz Google/Apple kalendara (read-only URL) i plan kao pretplata kalendara, da se blokovi vide u kalendaru koji Lejla ionako gleda.
- **Mikro-blokovi** (10–20 min) za ponavljanja i kartice u rupama između predavanja i u prevozu.
- **Ispitni rok kao režim**: iz akademskog kalendara app zna da počinje rok i nudi veći maksimum, simulaciju ispita (pitanja na vrijeme) i zaštitu sna noć prije ispita.
- **„Novi početak“** na početku sedmice ili nakon pauze: neodrađeno se ne prikazuje kao lista krivice nego kao jedna odluka (rasporedi / smanji obim / prihvati rizik). Fresh start efekat (Dai, Milkman, Riis 2014) i bez streak-kazni.
- **Namjera „kad i gdje“** (implementation intentions, Gollwitzer): opcionalno mjesto bloka (biblioteka, kuća). Termin + mjesto povećava šansu da se blok stvarno odradi.
- **Brojač ometanja u sesiji** („ometena sam“, jedan tap): pasivan signal fokusa bez upitnika.
- **Izvoz podataka** (JSON/CSV): povjerenje, i portfolio detalj.

---

## 10. Prijedlog redoslijeda

| Kad | Šta |
| --- | --- |
| Etapa 7 dorada (prije Etape 8) | Predlošci pauza (model + PokreniSesiju + Postavke), čipovi razloga za fokus 1, brzina po segmentu za kasniju statistiku |
| Etapa 8, prvi PR-ovi | Onboarding (mockup → migracija → ekrani), timezone iz browsera, gruba veličina gradiva (privremeni izvor) |
| Etapa 8, scheduler | Faktor realizacije + rezerva, limit rasta nakon propuštenog, „Danas ne mogu“, pauze u `placeTimes()`, planirani termin za svaki blok, mikro-blokovi za ponavljanja |
| Odmah iza 8/9 | Osnovni Web Push (prvi blok, kraj pauze) |
| Etapa 9 | R na dan ispita, kartice i pitanja kao zasebni FSRS objekti |
| Etapa 11 | Ocjena termina + kartice prijedloga dostupnosti, poređenje predložaka timera, Monte Carlo prognoza, strategist = pravila + LLM tekst, sedmični check-in |
| Etapa 8 (uz onboarding) | ICS uvoz zauzetosti (sekcija 11), jer je scheduler ulaz |
| Etapa 10–12 | Moodle feed rokova, ICS izvoz plana, Web Share Target, CSV izvoz kartica |
| Kasnije | Google Calendar API (upis blokova), Notion baza rokova, lični faktor brzine po jeziku izvora, izvoz podataka |

---

## 11. Integracije

Princip: **jedan generički mehanizam pokriva najviše izvora.** ICS (iCalendar) feed izvoze Google, Apple iCloud, Outlook i Moodle, pa jedan uvoz ICS-a zamjenjuje četiri posebne integracije bez OAuth-a.

| Integracija | Šta donosi | Kako | Trošak / rizik | Preporuka |
| --- | --- | --- | --- | --- |
| **Google / Apple / Outlook kalendar → Hoot** (zauzetost) | Posao, trening, doktor: zauzeto bez ručnog unosa | Korisnik zalijepi tajni iCal link (Google: Postavke kalendara → „Tajna adresa u iCal formatu“; Outlook: „Objavi kalendar“ → ICS; iCloud: javni link). Edge funkcija `sync-calendar` povlači feed (browser ne može zbog CORS-a) | Nizak. Mi biramo koliko često povlačimo (npr. na otvaranje app-a + `pg_cron` svakih 1–3 h). Tajni link je lozinka: čuvati samo u bazi, nikad u logovima | **v1 (odlučeno)**, Etapa 8 |
| **Moodle → Hoot** (rokovi) | Zadaće, kvizovi i rokovi predmeta | Moodle „Kalendar → Izvoz → Dobij URL kalendara“ daje URL sa `authtoken` koji radi bez prijave ([Moodle docs](https://docs.moodle.org/403/en/Calendar_export)). Isti `sync-calendar`, ali feed tipa „rokovi“ | Nizak; URL ne može biti ograničen na jedan predmet, pa se događaji uparuju sa predmetima kroz `fuse.js` kao kod uvoza rasporeda | v1, Etapa 10 (uvoz kao kartica novo / izmijenjeno → `deadlines`) |
| **Hoot → kalendar** (izvoz plana) | Blokovi i ispiti vidljivi u kalendaru koji korisnik ionako gleda | Edge funkcija servira ICS sa tajnim tokenom; korisnik se pretplati | Google osvježava pretplaćene kalendare tek svakih ~8–24 h ([izvor](https://knowledge.cheqroom.com/helpcenter/how-often-does-google-update-its-calendar-feeds)), pa dnevne izmjene kasne. Za ispite i rokove OK, za blokove ne. Apple osvježava češće | v1 samo ispiti, rokovi i (uz napomenu) blokovi; Etapa 12 |
| **Google Calendar API** (upis blokova odmah) | Plan se odmah vidi u Google kalendaru | OAuth, scope za događaje | U „Testing“ režimu refresh token ističe za 7 dana ([izvor](https://www.unipile.com/google-oauth-refresh-token/)); za produkciju treba verifikacija Google-a. Za jednu korisnicu to je sedmično ponovno povezivanje | Kasnije, uz otvaranje za više korisnika |
| **Web Share Target** (PWA) | „Podijeli“ PDF ili sliku iz Vibera, WhatsAppa, Moodle app-a, Gmaila direktno sovi (raspored u grupi godine, obavještenje) | `share_target` u manifestu → ekran „Daj sovi dokument“ sa prilogom | Bez OAuth-a. Radi na Androidu (Chrome); iOS PWA ga ne podržava | v1, Etapa 10 (jeftino, velika ušteda koraka na Androidu) |
| **Notion** | Studenti tamo drže bilješke i liste rokova | (a) Već sad: kopiraj stranicu iz Notiona i zalijepi sovi (tekst ide kroz `parse-document`). (b) Javna integracija (OAuth), korisnik izabere bazu, mapiramo polje datuma u rokove | (b) ~3 zahtjeva/s, sadržaj je stablo blokova koje treba rekurzivno čitati ([pregled](https://truto.one/blog/how-to-integrate-with-the-notion-api-architecture-guide-for-b2b-saas.md)); integracija vidi samo ono što korisnik podijeli. Notion nema ICS izvoz baze | (a) odmah, bez koda. (b) Kasnije, samo ako se pokaže potreba |
| **Anki / Quizlet** | Kartice | Izvoz kartica kao CSV (Anki ga uvozi); uvoz „pojam ⇥ definicija“ teksta | Quizlet više nema javni API; AnkiConnect radi samo lokalno na desktopu, pa nije za PWA | CSV izvoz i uvoz teksta, Etapa 10 |
| **Microsoft Teams / Google Classroom** | Zadaće sa rokovima | Graph / Classroom API | Classroom traži Workspace for Education domenu; školski računi često traže saglasnost admina. Previše za jednu korisnicu | Ne. Teams/Outlook rokovi idu kroz Outlook ICS |
| **Zamger i drugi fakultetski sistemi** | Ocjene, prijave ispita | Nema javnog API-ja koji sam našla; scraping krši pravila i puca | Visok | Ne. Rezultati se unose ručno ili kroz sovu (slika ili paste) |

**ICS uvoz: dizajn.**

- **Tabela `calendar_feeds`:** naziv, URL (tajna), vrsta (`busy` = zauzetost; `deadlines` = Moodle → prijedlozi rokova), boja, `last_synced_at`, `last_error`. Plus `external_events`: `feed_id`, `uid`, `starts_at`, `ends_at`, `all_day`, naslov (opcionalno; prekidač „spremaj samo zauzeto“ za privatnost). RLS, `grant`, `updated_at` triger po CLAUDE.md.
- **`sync-calendar` edge funkcija:** povuče feed, parsira (`ical.js` ili slično u Deno), raširi ponavljanja (RRULE, EXDATE) za horizont od npr. 120 dana, pa upsert po `uid` + početku. Događaji koji nestanu se brišu. Okidač: otvaranje app-a (najviše jednom u 30 min) i `pg_cron`.
- **Pravila:**
  - Cjelodnevni događaji (rođendani, praznici) po defaultu nisu zauzeti, samo se prikazuju. Može se uključiti po feedu.
  - Pojedinačan događaj se može označiti „ignoriši“.
  - Događaji tipa „slobodan“ (TRANSP:TRANSPARENT) ne blokiraju.
- **Scheduler:** zauzetost iz feedova ulazi u neto dostupnost (`src/lib/schedule/`) kao nastava, pa je i u `input_hash`. Promjena feeda pokreće replan (debounce).
- **UI:**
  - Postavke → „Povezani kalendari“ i korak 2 onboardinga.
  - Na vremenskoj osi Dostupnosti i u kalendaru događaji su šrafirani sa oznakom izvora („iz Google kalendara“).
  - Kod preklapanja sa dostupnošću ide isto upozorenje kao za nastavu, uz „Učim umjesto ovoga“.
- **Moodle feed** ne pravi zauzetost nego karticu „3 nova roka iz Moodlea“ (novo / izmijenjeno / preskačem → `deadlines`), isti pregled kao uvoz ispita.

## Odluke (21. okt 2026)

1. **Predlošci sesije:** Standardno 50/15 default; Pomodoro 25/5 + duga pauza, Flowtime, vlastiti niz, slobodno.
2. **Satnica:** `placeTimes()` automatski poslije `plan()`; svaki blok ima predloženo vrijeme; tab samo prikazuje i pomjera.
3. **Faktor realizacije i rezerva** su u `plan()` (kod, `input_hash`), ne prijedlog strategista.
4. **ICS uvoz** ulazi u v1 (Etapa 8 zauzetost, Etapa 10 Moodle rokovi); ICS izvoz u Etapi 12.
5. **Onboarding** u Etapi 8 prije schedulera, svaki korak preskočiv uz checklist.
6. Ostali prijedlozi iz sekcija 3, 6 i 9 (limit rasta, „Danas ne mogu“, „Imam samo 30 min“, mikro-blokovi, termini učenja, Monte Carlo prognoza, R na dan ispita, kartice kao FSRS objekti, strategist = pravila + LLM, sedmični check-in, Web Share Target, CSV kartica, izvoz podataka) su u PRD-u i ROADMAP-u.

## Otvorena pitanja

1. **Pojednostaviti prioritet + željenu ocjenu u UI?** Ili ostaje kako je.
2. **Šta izbaciti ili odgoditi** (sekcija 8): kartica „Znaš li?“ sa Danas, broj načina testiranja za v1 (prijedlog: ispitna pitanja, podnaslovi, kartice), spajanje `quiz` sa recall pitanjima.

## Izvori

- [Smits, Wenzel, de Bruin 2025 — self-regulated vs Pomodoro vs Flowtime pauze](https://pmc.ncbi.nlm.nih.gov/articles/PMC12292963/)
- [Planning fallacy (Buehler, Griffin, Ross 1994 i dalje)](https://en.wikipedia.org/wiki/Planning_fallacy) · [Frontiers 2022, procjene vremena studenata](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2022.925812/pdf) · [Lund, studenti prvog semestra](https://www.lunduniversity.lu.se/lup/publication/0bb4fa94-0926-45b5-b6f7-6a788c122dd7)
- [Synchrony efekat, pregled (Frontiers 2022)](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2022.851502/full)
- [IntelligentPooling: Thompson sampling za personalizaciju sa malo podataka](https://arxiv.org/pdf/2008.01571)
- Motion: [Ellie review](https://ellieplanner.com/comparisons/motion-app-review), [Morgen review](https://www.morgen.so/blog-posts/motion-review), [Capterra](https://www.capterra.com/p/214264/Motion/reviews/)
- Todait: [App Store opis](https://mwm.ai/apps/todait-adaptive-study-planner/6764323822), [Product Hunt](https://www.producthunt.com/p/todait/todait)
- Shovel: [Purdue pregled](https://purdue.edu/teaching-learning/programs/sst/assets/Shovel%20-%20Overview.pdf), [App Store](https://apps.apple.com/app/id1467742357)
- GoodPlans: [Product Hunt](https://www.producthunt.com/p/goodplans/goodplans-2-0) · Due Gooder: [screensdesign](https://screensdesign.com/showcase/due-gooder) · [Appcues, mobile onboarding](https://appcues.com/blog/mobile-onboarding-best-practices)
- StudyFetch: [tldv review](https://tldv.io/blog/studyfetch-review/), [Trustpilot](https://uk.trustpilot.com/review/studyfetch.com?page=6)
- Anki/FSRS: [forum, nagomilana ponavljanja](https://forums.ankiweb.net/t/failed-exams-used-sm-2-plan-to-retake-in-a-year-but-use-fsrs-how-to-handle-piled-reviews/55319), [Expected Knowledge Gain diskusija](https://forums.ankiweb.net/t/expected-knowledge-gain-and-anki-vs-questions-dilemma/67322)
- Rize: [Focus Score](https://rize.io/features/productivity)
- Integracije: [Moodle calendar export](https://docs.moodle.org/403/en/Calendar_export), [Moodle MDL-68845 (export token web servis)](https://tracker-old.moodle.org/browse/MDL-68845), [Google osvježavanje pretplaćenih feedova](https://knowledge.cheqroom.com/helpcenter/how-often-does-google-update-its-calendar-feeds), [Google OAuth 7-dnevni refresh token u Testing režimu](https://www.unipile.com/google-oauth-refresh-token/), [Notion API arhitektura i limiti](https://truto.one/blog/how-to-integrate-with-the-notion-api-architecture-guide-for-b2b-saas.md), [Google Classroom API](https://developers.google.cn/classroom/guides/key-concepts/api-structure)
