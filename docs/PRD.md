# Study Planner — PRD i tehnički plan

Oct 18, 2026 · @Uma Mahmutovic

## Pregled

Mobile-first web app (PWA) koja studentu pretvara rokove, literaturu i ispitna pitanja u dnevni plan učenja, i sama ga prilagođava kad se plan ne ispoštuje.

**Problem.** Student zna kad je ispit, ali ne zna koliko gradiva stvarno ima, koliko mu treba po stranici i šta da uči danas. Kad propusti dan, plan na papiru se raspada.

**Cilj.** Svaki dan app odgovara na pitanje “šta da učim danas i koliko”, i prognozira da li se stiže do ispita.

**Korisnik.** Za sada jedna osoba (autorica). Arhitektura je auth-ready: svaka tabela ima `user_id` i Row Level Security od prvog dana, pa je dodavanje drugih korisnika samo otvaranje registracije.

**Van scopea.** Upload cijelih PDF-ova, ugrađeni PDF reader, dijeljenje sa drugim studentima, native iOS/Android app. Read-only demo nalog za portfolio dolazi kasnije.

**Principi.**

- Malo unosa na početku: predmet = naziv + datum ispita; sve ostalo se dodaje kasnije.
- Računanje radi kod, AI objašnjava i predlaže. Satnicu računa deterministički algoritam, ne LLM.
- Procjene se uče iz stvarnih podataka (timer + ocjene), ne ostaju fiksne.
- Jedan tap gdje god može: ocjena 1–5, status jedinice, start timera.

## Features

Nema podjele na MVP i v2: sve ispod ulazi u prvu verziju. Redoslijed gradnje je u sekciji Roadmap.

| Oblast | Feature | Kriterij prihvatanja |
| --- | --- | --- |
| Predmeti | Predmet + ispiti | Predmet sa nazivom, bojom i 1..n ispita (preset: samo završni / parcijale + integralni / prilagođeno) za < 30 s |
| Predmeti | Rokovi | Seminarski, zadaće, vlastiti rok; opcionalna procjena sati ulazi u plan |
| Predmeti | Prioritet i režim | Prioritet 1–5 (5 = uslovni); režim redovno ili kampanja; start kampanje izračunat, ručno promjenjiv |
| Predmeti | Praćenje predavanja | Nakon termina “Dokle ste stigli?” jednim tapom; zaostatak u satima; prijedlog akcije kad pređe prag |
| Predmeti | Bodovi i skala ocjena | Ispit i rok nose bodove ili procente, opcionalni prag za prolaz i uslov za izlazak; popravni je vezan za ispit koji ponavlja; skala ocjena po predmetu (default 55/65/75/85/95) |
| Predmeti | Projekcija ocjene | “Imam X od Y”, koliko treba na preostalim ispitima za svaku ocjenu i za željenu ocjenu; rezultat se može poništiti (odricanje) |
| Raspored | Akademski kalendar | Periodi nastave, sedmice parcijalnih, ispitni rokovi (redovni/popravni), neradni dani; ručno ili AI uvoz; “7. sedmica nastave” na Danas |
| Uvoz | Uvoz sa pregledom | Tekst, slika ili PDF → akademski kalendar ili raspored ispita; pregled novo/izmijenjeno prije snimanja |
| Uvoz | Dokumenti i asistent | Dokumenti fakulteta sa pretragom (RAG, citat izvora); chat asistent predlaže izmjene kao kartice |
| Predmeti | Izvori više tipova | 0..n izvora: knjiga, skripta, pitanja, prezentacije, ostalo |
| Uvoz | Slikaj sadržaj | Slika sadržaja → jedinice sa stranicama, podjedinicama, težinom i temama; pregled prije snimanja |
| Uvoz | Ručni unos | Paste ili jedna linija po jedinici; isti parser |
| Uvoz | Ispitna pitanja | Slika ili paste → jedinice tipa pitanje, sa temama |
| Uvoz | Ponovni uvoz | Spajanje po oznaci; napredak, bilješke i sesije se ne gube |
| Uvoz | Obim ispita | Za svaki tip izvora: I / II / oba / ne ulazi; AI prijedlog, ručna izmjena zaključana |
| Uvoz | Teme | AI označi teme pri uvozu; ručno ispravljive; povezuju pitanja i poglavlja |
| Raspored | Raspored nastave | Ručno ili slikom; predavanja, vježbe, labovi, parne/neparne sedmice; automatski zauzeto |
| Raspored | Dostupnost | Sedmični slobodni termini + izuzeci za konkretne dane |
| Plan | “Danas” ekran | Fokus bar dana, kartica “Sljedeći blok”, lista blokova, 3 najranija ispita, “zašto ovo danas” |
| Plan | Kalendar | Mjesec, sedmica i dan: ispiti, rokovi, nastava i planirani dani |
| Plan | Satnica | Na zahtjev raspoređuje blokove u termine; keš preko `input_hash` |
| Plan | Replan | Propušteno se preraspodijeli od sutra; deficit sa 3 opcije |
| Plan | Ručni blokovi | Dodaj, izmijeni, obriši blok; ručni i izmijenjeni blokovi su zaključani od replana |
| Učenje | Timer dugme | Izbor: sljedeći blok (preporučeno), drugi blok danas, slobodna sesija; nastavak aktivne sesije |
| Učenje | Timer sesije | Segmenti u bazi, pauza, “Sad radim na”, režimi 25/5, 50/10, slobodno; radi offline |
| Učenje | Kraj sesije | Težina 1–5 po jedinici, fokus 1–3, refleksija |
| Učenje | Recall gate | Test iz ispitnih pitanja, bilješki, podnaslova, blurtinga, kartica ili općeg znanja |
| Učenje | Spaced repetition | FSRS po jedinici; ciljno zadržavanje po prioritetu predmeta |
| Učenje | Jačina znanja | Procjena “koliko se sjećaš danas” po jedinici, temi, predmetu i ispitu; provjera kad padne ispod cilja |
| Učenje | Notes i kartice | Markdown bilješke po jedinici; kartice pitanje–odgovor |
| Učenje | Kvizovi | AI pitanja iz bilješki ili slike stranice |
| Napredak | Progres | Po izvoru, ispitu, predmetu i temi |
| Napredak | Statistika | Sati vs plan, ispunjenost, fokus, efikasnost po dobu dana |
| Napredak | Prognoza spremnosti | “Ovim tempom pokrivaš X% do ispita”, svaki dan; procjena ocjene iz prognoze |
| Napredak | AI strategist | Sedmični pregled i najviše 3 akcije koje korisnik odobri |
| Opće | Notifikacije | Prvi blok dana, propušten blok, ponavljanje na redu |
| Opće | Jezik | Bosanski i engleski |
| Opće | Rezultat ispita | Bodovi (Etapa 5) + spremnost dan prije (Napredak); zatvara krug za prognozu |

## Ključni tokovi

**1. Novi predmet**

1. Naziv, boja, preset ispita (samo završni / parcijale + integralni / prilagođeno), datum i format svakog ispita. Ispit može biti “samo ako zatreba” (integralni, popravni) i imati okvirni datum.
2. Opcionalno, pod sklopljenim “Napredno”: prioritet (default 3) i režim (default redovno). Defaulti čuvaju kriterij < 30 s.
3. App nudi “Dodaj izvor”; može se preskočiti.
4. Bez izvora predmet ima samo rokove u kalendaru; satnica ga ignoriše.

**2. Dodavanje izvora**

1. Tip i naziv izvora.
2. Slika sadržaja (1–4 slike, smanjene na klijentu na 1600 px) ili ručni unos.
3. AI vraća JSON: jedinice, stranice, podjedinice, težina, teme, upozorenja.
4. Pregled: korisnik ispravlja, briše, dodaje; tek tad se snima.
5. Obim ispita: AI predlaže raspodjelu po parcijalama za sve izvore; korisnik mijenja.
6. Ponovni uvoz istog izvora spaja se sa postojećim jedinicama (vidi Model).

**3. Raspored nastave**

1. Slika rasporeda ili ručni unos; AI predloži termine i poveže ih s predmetima po nazivu.
2. Pregled i snimanje; termini su odmah zauzeti u planu.

**4. Sesija učenja**

1. Timer dugme: ako sesija traje, vraća je; inače izbor sljedećeg bloka, drugog bloka danas ili slobodne sesije.
2. Sesija: način učenja, pauza/nastavak, “Sad radim na”, notes i kartice.
3. Završi → težina po jedinici, fokus, refleksija.
4. Za jedinice označene “pročitano” nudi se recall gate; rezultat ide u spaced repetition.
5. Minute se raspodijele na jedinice; kalibracija i (ako treba) replan.

**5. Replan**

1. Pokreće se na događaje (vidi Timer i rekalibracija), nikad dok timer radi.
2. Neodrađeni prošli blokovi postaju “propušteno”.
3. Novi plan kreće od sutra; današnji se mijenja samo ako je postao nemoguć.
4. Deficit: app kaže koliko fali i nudi dodati sate, smanjiti obim ili prihvatiti rizik. Prijedlog smanjenja obima ide prvo na predmete nižeg prioriteta.

**6. Nakon predavanja**

1. Kad **predavanje** iz rasporeda završi, na “Danas” se pojavi kartica “Dokle ste stigli iz [predmet]?” (kasnije i notifikacija). Vježbe, labovi i ostalo ne pitaju; za njih postoji ručni unos (korak 4). Kartica stoji do kraja tog dana (granica dana), dok se ne unese ili preskoči.
2. Sheet: izbor izvora (tab po izvoru), tap na jedinicu do koje se stiglo (sve prije nje je “pređeno na predavanju”), opcionalna bilješka. Snimanje pravi po jedan unos za svaki izvor kojem je granica promijenjena.
3. “Nastava otkazana” oslobađa taj termin u planu za taj dan; “Preskoči” samo zatvara karticu za taj termin i dan.
4. Isti unos postoji na ekranu predmeta, sa izborom datuma, za predavanja koja nisu u rasporedu ili su propuštena.
5. Ako zaostatak pređe prag, pojavi se kartica prijedloga (vidi Praćenje predavanja).

**7. Ručna izmjena plana**

1. “+ Dodaj blok” na danu u Planu: predmet, tip, opcionalno jedinice, dan, trajanje, opcionalno vrijeme. Blok je ručni (`origin = 'user'`).
2. Izmjena bloka koji je napravila app (dan, vrijeme, trajanje, jedinice) ga pretvara u ručni i zaključava; app to kaže jednom rečenicom.
3. Brisanje bloka koji je napravila app otvara izbor: “Prebaci gradivo na druge dane” (jedinice se vraćaju u bazen, replan ih rasporedi od sutra) ili “Izbaci iz plana” (jedinice dobiju ručno “ne ulazi” za taj ispit). Brisanje ručnog bloka samo vraća njegovo gradivo u bazen.
4. Poslije svake izmjene: undo toast i replan (debounce 2 s). Replan nikad ne briše ni pomjera ručne blokove.

## Model izvora, jedinica i progresa

Predmet ima više izvora, izvor ima jedinice, a teme povezuju jedinice preko izvora. Progres se uvijek računa ponderisano procijenjenim vremenom, ne brojem stavki, jer kratko poglavlje ne smije vrijediti kao dugo.

**Hijerarhija.** Predmet → Izvor (tip) → Jedinica (poglavlje, lekcija ili pitanje; može imati podjedinice) ↔ Tema. Predmet ima i ispite, rokove i termine nastave.

**Nivoi savladanosti.** Jedinica ima `level` 0–3. Poglavlje: 0 nije početo, 1 pročitano, 2 razumijem, 3 ponovljeno. Pitanje koristi 0, 1 (djelimično) i 3 (znam), pa je “znam” uvijek 100%.

**Progres jedinice, izvora i predmeta** (m = procijenjene minute jedinice, w = težina izvora):

```latex
p_u = \frac{level_u}{3} \qquad P_{izvor} = \frac{\sum_u p_u \, m_u}{\sum_u m_u} \qquad P_{predmet} = \frac{\sum_s w_s \, P_s}{\sum_s w_s}
```

- Default w izvora = njegov udio u ukupnim minutama predmeta. Korisnik može ručno reći npr. “pitanja nose 50%”.
- Ako predmet ima samo skriptu, ukupni progres je progres skripte.
- Pokrivenost teme (v2) = ista formula nad svim jedinicama sa tom temom, kroz sve izvore.
- Podjedinice: progres roditelja je izveden iz djece; status se mijenja na listovima.

**Ispiti i obim gradiva.** Predmet ima 1..n ispita (`assessments`): parcijale, završni, integralni, popravni. Obim je varijabilan po predmetu:

- Samo završni: jedan ispit sa `scope_all = true`, obim je cijelo gradivo.
- Parcijale: svaka parcijala ima svoje jedinice (npr. I = poglavlja 1–5, II = 6–10); bira se na ekranu izvora oznakom raspona ili čekiranjem.
- Integralni / popravni: obično `scope_all = true`.
- Označiš ispit kao položen (`passed`): njegove jedinice ispadaju iz plana, osim ako ih pokriva neki drugi nadolazeći ispit.
- “Samo ako zatreba” (`contingent`, tipično integralni i popravni): ispit je u kalendaru, ali ne ulazi u plan dok neki raniji ispit istog predmeta nije unesen kao nepoložen (rezultat unesen, `passed = false`) ili ga korisnik ručno ne aktivira.
- Okvirni datum (`date_tentative`): datum još nije objavljen, pa se unosi raspon u kojem ispit može biti: najraniji dan (`at`) i najkasniji dan (`at_latest`). Gradivo mora biti spremno do **najranijeg** dana: plan, buffer i start kampanje računaju se prema `at`, kao da je ispit tog dana. Kalendar označava cijeli raspon kao “mogući ispit”. Kad datum bude objavljen, korisnik isključi “Datum još nije objavljen” i unese tačan datum; plan se preračuna.
- “Ne ulazi” (`assessment_units.included = false`, uvijek `assigned_by = 'user'`): jedinica je isključena iz obima tog ispita i kad je `scope_all = true`.

**Rok jedinice** = datum najranijeg nepoloženog nadolazećeg ispita koji je pokriva. Jedinica koju ne pokriva nijedan nadolazeći ispit ne ulazi u plan. Progres se prikazuje i po ispitu (ista formula nad njegovim obimom).

**Teme.** Pri svakom uvozu AI dodijeli jedinicama 1–3 teme iz zajedničkog skupa tema predmeta (postojeće teme se šalju u prompt da se ne dupliraju). Korisnik ih ispravlja u pregledu ili na ekranu jedinice; ručna oznaka se ne prepisuje. Teme povezuju pitanja i poglavlja (recall gate, “povezana pitanja”), daju prijedlog obima ispita za pitanja i pokrivenost po temama.

**Ponovni uvoz (merge).** Novi rezultat parsiranja se spaja sa postojećim jedinicama izvora, ne zamjenjuje ih:

- Ista oznaka (`label`) → ažuriraju se naslov, stranice i podjedinice; nivo, ocjene, bilješke, sesije i obim ostaju.
- Nova oznaka → nova jedinica.
- Oznaka koje više nema → jedinica se arhivira (`archived_at`), ne briše; vidljiva u “Arhivirane” i može se vratiti.
- Pregled prije snimanja označi svaku promjenu: novo / izmijenjeno / arhivira se.

**Rokovi u planu.** Rok (seminarski, zadaća) može imati procjenu sati. Tada ga scheduler tretira kao mali ispit sa jednim zadatkom tog trajanja i pravi blokove tipa `deadline`. Rok bez procjene se samo prikazuje.

## Procjena težine i vremena

Procjena minuta po jedinici kreće od heuristike i AI težine, a zatim je tvoje ocjene i timer postepeno preuzimaju. Umjesto fiksnih faza koristi se “shrinkage”: što više podataka, to više vjeruješ podacima.

**1. Heuristika (početne vrijednosti, podešljive u postavkama)**

| Tip izvora | Jedinica mjere | Početno min po jedinici mjere |
| --- | --- | --- |
| Knjiga | stranica | 4 |
| Skripta | stranica | 6 |
| Prezentacije | slajd | 1.5 |
| Pitanja | pitanje | 8 |
| Ostalo | stranica, ili jedinica | 4 po stranici; za jedinice korisnik upiše minute po jedinici pri dodavanju izvora (default 30) |

Ovo su pretpostavke za start, ne izmjereni podaci; kalibracija ih brzo zamijeni. Kalibracija je uvijek po pojedinačnom izvoru (dva izvora tipa “Ostalo” uče svoje brzine odvojeno). Mjera izvora je u `sources.measure` (`pages`, `slides`, `questions`, `items`).

**Ručni unos (“jedna linija po jedinici”).** Parser u `src/lib/outline/` (isti izlaz kao AI uvoz): `<oznaka> <naslov> <stranice>`, npr. `2.1 Konvolucija 75` ili `4 Fourierova transformacija 284-355`. Oznaka je opcionalna; tačke u oznaci prave podjedinice (najviše 3 nivoa). Jedan broj je početna stranica, a kraj je početak sljedeće jedinice − 1; `a-b` je raspon. Kod prezentacija jedan broj je broj slajdova. Kod pitanja i jedinica (“Ostalo”) cijela linija je naslov. Jedinica bez poznatog obima dobije prosjek ostalih i upozorenje. Pregled prije snimanja prikazuje težinu kao 5 tačkica (default 3, tap mijenja); ta početna težina se snima u `ai_difficulty` i koriguje ocjenama isto kao AI težina. U Etapi 10 ručni unos dobija i dugme “Procijeni težinu AI-jem”.

**2. AI težina iz naslova.** Pri uvozu AI dodijeli svakoj jedinici `ai_difficulty` 1–5 na osnovu naslova, predmeta i konteksta susjednih poglavlja. Množitelj: 1 → 0.6, 2 → 0.8, 3 → 1.0, 4 → 1.3, 5 → 1.7.

```latex
m_{prior} = obim \times baza_{tip} \times mult(d)
```

**3. Tvoja ocjena 1–5.** Nakon svake završene jedinice. Prosječna razlika (tvoja − AI) na jedinicama izvora koriguje težinu preostalih jedinica, ublažena brojem ocjena n:

```latex
d_{adj} = d_{ai} + \frac{n}{n+3} \cdot \overline{(d_{tvoja} - d_{ai})}
```

**4. Timer (kalibracija).** Za svaki izvor računa se stvarno vrijeme po jedinici mjere iz završenih jedinica i miješa sa heuristikom:

```latex
baza_{izvor} = \frac{k}{k+5} \cdot baza_{izmjereno} + \frac{5}{k+5} \cdot baza_{tip}
```

k = broj jedinica sa zabilježenim vremenom. Nakon 5 jedinica izmjereno i heuristika vrijede pola-pola; nakon 20, mjerenje nosi 80%.

**Podjela uloga.** Timer određuje koliko vremena treba (satnica). Ocjena određuje koliko je bilo teško shvatiti (prioritet ponavljanja i korekcija težine). Ne spajaju se u jedan broj.

**Način učenja.** Svaka sesija ima `mode` (čitanje, zadaci, ponavljanje, pitanja). Kalibracija se vodi po paru izvor × način: blok čitanja koristi izmjerenu brzinu čitanja, a blok ponavljanja onu iz ponavljanja. Dok par nema bar 3 mjerenja, koristi se vrijednost izvora za sve načine.

**Web pretraga** težine konkretne knjige nije default; može doći kao opcionalno dugme u v2.

## Prioritet i režim učenja

Nisu svi predmeti jednako važni ni jednako teški. Prioritet kaže koliko je predmet bitan, a režim kada kreće učenje. Oba su ulazi u `plan()`; AI ih može samo predložiti.

**Prioritet 1–5** (`subjects.priority`, default 3). 5 je za uslovne predmete koji se moraju položiti, 1 za predmete gdje je dovoljno proći. Nazivi u UI: 1 Lagano (“dovoljno je proći”), 2 Manje bitan (“bez velikih ambicija”), 3 Standardno, 4 Važan (“želim dobru ocjenu”), 5 Uslovni (“mora se položiti”). Prioritet mijenja četiri stvari:

| Prioritet | Težina hitnosti | Rezanje kod deficita | Buffer dana | Ciljno zadržavanje (FSRS) | Ciljna pokrivenost |
| --- | --- | --- | --- | --- | --- |
| 1 | 0.7 | prvi | postavke | 0.80 | 70% |
| 2 | 0.85 | drugi | postavke | 0.80 | 80% |
| 3 | 1.0 | treći | postavke | 0.85 | 90% |
| 4 | 1.2 | četvrti | postavke | 0.90 | 95% |
| 5 | 1.5 | zadnji | postavke + 1 | 0.90 | 100% |

- **Težina hitnosti** množi hitnost u koraku raspodjele dana, pa važniji predmet dobija veći dio vremena kad se predmeti takmiče.
- **Rezanje kod deficita**: kad ne stane sve, opcija “Smanji obim” u Replan sheetu nudi jedinice predmeta najnižeg prioriteta.
- **Ciljna pokrivenost**: jedinice u obimu se rangiraju po važnosti (broj ispitnih pitanja preko tema, pa težina, pa redoslijed). Jedinice iznad granice su obavezne, a ostatak je “opcionalan”: planira se samo ako ostane kapaciteta i nikad ne pravi deficit. Prognoza spremnosti računa se prema ciljnoj pokrivenosti i prema cijelom obimu.
- Vrijednosti u tabeli su početne konstante u kodu (`src/lib/scheduler/`), ne korisničke postavke.
- **Privremeno pojačanje** (`subjects.priority_boost_until`): dok traje, težina hitnosti predmeta se množi sa 1.3, i kad je prioritet već 5. Vrijeme se time prirodno uzima od predmeta nižeg prioriteta. Pojačanje ističe samo od sebe; koristi ga prijedlog “Uzmi vrijeme od [predmet]” (vidi Praćenje predavanja).

**Režim** (`subjects.study_mode`):

- **Redovno** (default): predmet je u rotaciji od danas. Ako postoji praćenje predavanja, plan drži korak s nastavom (vidi Praćenje predavanja).
- **Kampanja**: predmet ulazi u rotaciju tek na dan starta kampanje. Prije toga nema blokova novog učenja, ali već naučeno (jedinice u ponavljanju) i dalje dobija provjere kad jačina padne, da se ne zaboravi do kampanje. Slobodna sesija je i dalje moguća i ulazi u kalibraciju. “Počni odmah” postavlja ručni start na danas.

**Start kampanje** računa `plan()`, ne AI. Za svaki nepoložen ispit predmeta u kampanji ide ALAP prolaz unazad od (datum ispita − buffer): dan po dan oduzima se kapacitet koji ostane poslije ručnih blokova, ponavljanja, redovnih predmeta i kampanja sa ranijim ispitima, dok preostali rad (prema ciljnoj pokrivenosti) ne stane. Na dobijeni dan dodaje se margina od 20% rada (najmanje 2 dana). Start predmeta = najraniji start njegovih ispita.

- Ručni start (`subjects.campaign_start_on`) ima prednost i ne mijenja se replanom. Ako ručni start ne daje dovoljno vremena, plan pravi deficit i nudi “Kreni ranije: [izračunat dan]”.
- Izračunat start se ne snima u predmet; dio je izlaza `plan_runs` i prikazuje se na predmetu (“Kampanja kreće 2. dec”).
- 3 dana prije starta “Danas” pokaže najavu; na dan starta “zašto ovo danas” kaže “kampanja počinje danas”.
- Ispit sa okvirnim datumom računa start prema najranijem mogućem danu raspona.

## Praćenje predavanja

Korisnik bilježi dokle se stiglo na nastavi, pa app zna koliko zaostaje i može držati korak s predavanjima.

**Model.** Unos (`lecture_logs`) vezuje datum, predmet, opcionalno termin iz rasporeda, izvor i jedinicu “do ovdje” (`up_to_unit_id`). Pređenim jedinicama se smatraju sve nearhivirane jedinice tog izvora sa `position` do te jedinice (uključivo, sa podjedinicama). Novi unos za isti izvor pomjera granicu (vrijedi unos sa najkasnijim `on_date`, pa `created_at`); raniji unosi ostaju kao historija. `cancelled = true` znači da nastave nije bilo; to pravi izuzetak dostupnosti (`is_busy = false`, termin ±15 min, `lecture_log_id` na unos) koji oslobađa taj termin za taj dan. Brisanje unosa briše i taj izuzetak.

**Zaostatak** (`src/lib/pace/`, čista funkcija) = zbir minuta pređenih listova sa `level` 0. Minute su iste kao na ekranu izvora (`materialOf()` → `estimateUnits()`). Prikazuje se na predmetu kao “Na predavanju: pogl. 5 · Ti: pogl. 3 · kasniš ~4h 20min”, po jedan red za svaki izvor koji ima unos.

- “Na predavanju” = vršna jedinica (bez roditelja) koja sadrži granicu zadnjeg unosa.
- “Ti” = zadnja vršna jedinica čiji su svi listovi `level` ≥ 1, gledano redom od početka bez praznina.
- Broj predavanja u zaostatku = unosi (nisu otkazani) iza kojih je u pređenom dijelu ostala bar jedna jedinica sa `level` 0.

**Meki rok (samo redovni režim).** Jedinica pređena na predavanju dobija meki rok `on_date + profiles.lecture_pace_days` (default 7) i ulazi u plan kao pseudo-cilj ispred ispita. Meki rok nikad ne pravi deficit: ako ne stane, ostaje vezan za ispit. Jedinice koje još nisu pređene na predavanju ne guraju se unaprijed, osim ako ispit to traži. U kampanji se predavanja samo bilježe i prikazuju.

**Recap nakon predavanja.** Ako je unos napravljen istog dana, recap blok od 15 min cilja upravo pređene jedinice; inače je opći recap predmeta.

**Prijedlozi kod zaostatka.** Kad zaostatak pređe prag (više od 2 predavanja sa nepređenim gradivom ili više od 4 h), pravilo u kodu (bez AI-ja) pokaže karticu na “Danas” i na predmetu sa najviše 3 akcije, redom koji ima smisla za taj predmet:

- “Podigni prioritet na N+1” (ako je prioritet < 5)
- “Uzmi vrijeme od [predmet]”: privremeno pojačanje do sljedećeg ispita predmeta. Naziv predmeta i minute u potvrdi (“Signali dobijaju 40 min dnevno od Vjerovatnoće do 28. okt.”) dolaze iz razlike plana sa i bez pojačanja, koju `plan()` izračuna unaprijed.
- “Prebaci na redovno” (ako je predmet u kampanji, a zaostatak raste)
- “Kreni ranije” (kampanja: start na izračunat raniji dan)
- “Dodaj X min dnevno” (izuzeci dostupnosti do sljedećeg ispita predmeta)

Jedan tap mijenja ulaz i pokreće replan; “Kasnije” sakriva karticu 3 dana. Strategist dobija zaostatak u svom ulazu i može predložiti iste akcije u sedmičnom pregledu.

Pravila (prag i lista akcija) su u `src/lib/pace/` od Etape 4. Dok nema schedulera, kartica na predmetu nudi samo akcije koje ne traže `plan()` (“Podigni prioritet”, “Prebaci na redovno”) i “Kasnije”; “Uzmi vrijeme od”, “Kreni ranije” i “Dodaj X min dnevno” dolaze sa schedulerom (Etapa 8).

## Scheduler, replan i AI strategist

Satnicu pravi čista TypeScript funkcija `plan(state) → blocks`, bez AI-ja: brza je, besplatna, testabilna i daje isti rezultat za iste ulaze. AI strategist samo predlaže promjene ulaza (prioriteti, režim, sati, obim), a funkcija ponovo računa plan.

**Algoritam**

1. **Kapacitet.** Slobodne minute po danu = dostupnost − termini nastave (±15 min, osim otkazanih) − izuzeci − ručni blokovi.
2. **Ponavljanja i provjere prvo.** Jedinice kojima je `next_review_on` danas ili ranije dobijaju blokove tipa `review` (vidi Spaced repetition), i za predmete u kampanji prije starta. Ponavljanja zauzimaju najviše `profiles.review_cap_pct` (default 40%) dnevnog kapaciteta; višak se slaže po bližem ispitu, pa po nižoj jačini, a ostatak prelazi na sljedeći dan. Uz uključen prekidač, dan sa predavanjem dobija blok `recap` od 15 min za taj predmet.
3. **Start kampanje.** Za predmete u kampanji izračuna se dan starta (vidi Prioritet i režim); prije njega njihove jedinice nisu u bazenu.
4. **Preostali rad po cilju.** Cilj je nepoložen, aktivan ispit (ne “samo ako zatreba” dok se ne aktivira) ili rok sa procjenom. Za jedinicu u obimu: level 0 → 100% minuta, level 1 → 40%, level 2+ → 0% (ide u ponavljanja). Pitanje: 0 → 100%, 1 → 50%. Jedinica pripada najranijem cilju koji je pokriva. Rad se dijeli na obavezan i opcionalan po ciljnoj pokrivenosti prioriteta. Planirane minute ručnih blokova za te jedinice oduzimaju se od preostalog rada.
5. **Meki rokovi s predavanja.** U redovnom režimu pređene jedinice dobijaju meki rok (vidi Praćenje predavanja).
6. **Buffer.** Zadnjih N dana prije ispita (postavke, +1 za prioritet 5) samo ponavljanje i pitanja iz obima.
7. **Hitnost.** u = preostali rad / kapacitet do cilja × težina prioriteta. Dan se raspodijeli proporcionalno hitnosti; najviše N predmeta dnevno, blok najmanje N minuta (postavke). Opcionalan rad ide tek kad obavezan stane.
8. **Redoslijed.** Redoslijed iz sadržaja; prednost dobijaju jedinice sa niskom sigurnošću i teme sa mnogo ispitnih pitanja.
9. **Tip bloka.** `learn` za prvo učenje, `questions` kad je cilj u buffer zoni ili su poglavlja pređena a pitanja nisu, `deadline` za rokove.
10. **Punjenje.** Duga jedinica se dijeli po stranicama na više blokova.
11. **Deficit.** Plan se napravi i kad ne stane, uz `deficit` po cilju (samo obavezan rad). Opcije smanjenja obima kreću od najnižeg prioriteta.
12. **Prijedlozi.** Pravila zaostatka (`src/lib/pace/`) i deficit daju listu prijedloga (promjene ulaza), koje “Danas” i predmet prikazuju kao kartice.
13. **Zašto ovo danas.** Svaki blok dobije kratko objašnjenje iz pravila koje ga je stavilo (npr. “ispit za 9 dana, Signali kasne 3h”, “uslovni predmet”, “kampanja počinje danas”, “pređeno na predavanju 12. okt”, “jačina pala na 72%”). Ovo je kartica savjeta na “Danas” ekranu kad nema svježeg savjeta strategista.

**Više ispita po predmetu.** Koraci 1–6 rade po ispitu, ne po predmetu: preostali rad i kapacitet računaju se do datuma svakog ispita nad njegovim obimom. Tako I parcijala dobije prioritet prije završnog, a gradivo II parcijale kreće tek kad je to potrebno.

**Lista vs satnica.** Plan se pravi u dva sloja:

1. `plan()` raspodijeli rad po danima → “Danas” lista (blokovi bez `start_min`). Ovo se računa automatski pri replanu.
2. `placeTimes()` na zahtjev (tab “Satnica”) smjesti blokove u slobodne termine tog dana → popuni `start_min`. Ručni blokovi sa zadatim vremenom su fiksni; ostali se slažu oko njih.

Oba koraka su kod, ne AI, pa su besplatni. Prije računanja pravi se `input_hash` (jedinice, nivoi, procjene, FSRS stanje, ispiti, obim, dostupnost, raspored, unosi predavanja, prioriteti, režimi, ručni start kampanje, ručni blokovi, postavke); ako je isti kao u zadnjem `plan_runs`, koristi se postojeći plan i ništa se ne računa. AI se zove samo za strategist, i to ručno ili sedmično.

**Ručni blokovi.** Blok sa `plan_blocks.origin = 'user'` napravio je ili izmijenio korisnik (vidi tok 7). Nema `plan_run_id`, troši kapacitet svog dana i njegove jedinice se računaju kao planirane. Replan ga nikad ne briše ni pomjera; kad prođe, postaje odrađen ili propušten kao svaki drugi blok.

**Replan je idempotentan.** Brišu se samo budući nezapočeti blokovi sa `origin = 'ai'`; odrađeni, propušteni i ručni ostaju. Isti ulaz uvijek daje isti plan, pa se može pokretati koliko god puta.

**Spaced repetition (FSRS).** Ponavljanja raspoređuje FSRS (biblioteka `ts-fsrs`, FSRS v6), algoritam koji koristi i Anki. Svaka jedinica u ponavljanju ima memorijsko stanje (stabilnost, težina); iz njega se za svaki dan računa **jačina znanja** R = vjerovatnoća da se jedinice sjećaš danas. Jačina opada iz dana u dan i nikad se ne snima, nego računa (kao progres).

- **Ulaz u ponavljanje.** Jedinica ulazi u FSRS prvim testom: recall gate pri “pročitano” ili, ako je gate preskočen, **provjerom pročitanog** koja se zakaže 2 dana nakon “pročitano” (`next_review_on`). Tako i pročitano-a-netestirano gradivo slabi i traži provjeru.
- **Ocjena.** `recall` 0–2 se mapira na FSRS ocjene: 0 → Again, 1 → Hard, 2 → Good.
- **Ishod.** 2 na provjeri pročitanog ili recall gate-u → level 2. 0 na jedinici level 2+ → level 1, pa se vraća u učenje (40% minuta u koraku 4). 0 na provjeri pročitanog → ostaje level 1 i dobija novi `learn` blok.
- **Kada je provjera na redu.** `next_review_on` = dan kad R padne ispod ciljnog zadržavanja predmeta (0.80–0.90 po prioritetu).
- **Rotacija.** Predmet u kampanji prije starta ima samo ponavljanja već naučenog, bez novog učenja; jedinica koju ne pokriva nijedan aktivan nadolazeći ispit ne dobija ponavljanja.
- Datum ponavljanja nikad ne prelazi ispit: ako bi pao iza, zamijeni se ponavljanjem u buffer danu.
- Nakon 4 uspješna ponavljanja (`fsrs_reps`, bez lapsa u međuvremenu) jedinica prelazi na level 3 (“Ponovljeno”).
- **Jačina na ekranima.** Jedinica: R. Tema, izvor, predmet, ispit: prosjek R ponderisan minutama jedinica (ista logika kao progres), samo nad jedinicama koje su ušle u ponavljanje. Prikazuje se uz progres, ne umjesto njega. Skala u UI: 85%+ Jako, 75–84% Dobro, 60–74% Slabi, ispod 60% Zaboravlja se.
- **Provjera znanja.** `review` blok se radi kao niz recall gate-ova (ekran “Provjera znanja”), sa sažetkom promjene jačine na kraju.
- Svako ponavljanje se bilježi u `review_logs` (izvor pitanja, ishod, proteklo dana, stabilnost prije i poslije). Iz toga se kasnije mogu optimizovati lični FSRS parametri (`profiles.fsrs_params`, optimizer `@open-spaced-repetition/binding`), bez gubitka historije. Dok toga nema, koriste se default parametri.

**AI strategist**

- Pokreće se sedmično (nedjelja, pri prvom otvaranju) ili na dugme. Ulaz je kompaktan JSON sažetak (\~1–2k tokena): ciljevi, prioriteti i režimi, progres, jačina po temama, deficit, zaostatak po predavanjima, propušteni blokovi, efikasnost po dobu dana, slabe teme, refleksije zadnjih 7 dana.
- Izlaz je strukturiran JSON: sažetak, rizici i najviše 3 prijedloga sa tipom akcije (`reprioritize_unit`, `add_hours`, `drop_unit`, `change_buffer`, `avoid_slot`, `set_priority`, `boost_priority`, `set_mode`, `set_campaign_start`).
- Korisnik odobri prijedlog jednim tapom; kod ga primijeni i pokrene replan. AI nikad direktno ne piše blokove.
- Na “Danas” se prikazuje zadnji savjet strategista dok je svjež (do 3 dana), inače “zašto ovo danas” iz scheduler-a.

**Testovi.** `plan()` je glavni kandidat za unit testove (Vitest): prazna dostupnost, dva ispita isti dan, deficit, propušten dan, start kampanje, ručni start, dvije kampanje u istoj sedmici, ručni blok preživi replan, rezanje po prioritetu, ciljna pokrivenost, meki rok predavanja, limit ponavljanja. Invarijante (kapacitet se nikad ne prekorači, ručni blokovi se ne mijenjaju, isti ulaz = isti plan) provjeravaju se property testovima (`fast-check`). To je i dobar portfolio detalj.

## Timer, pauza i rekalibracija

Timer je zapis segmenata u bazi, a ne brojač u memoriji, pa preživi zaključan telefon, zatvoren tab i prelazak na drugi uređaj. Procjene se preračunavaju samo kad sesija završi, a plan samo na određene događaje, i to iza `input_hash` provjere.

**Stanja timera**

| Stanje | Akcija | Šta se dešava u bazi |
| --- | --- | --- |
| Mirovanje | Start (iz bloka ili slobodno) | nova `study_sessions` + prvi segment |
| Radi | Pauza | trenutni segment dobije `ended_at` |
| Pauzirano | Nastavi | novi segment |
| Radi | “Sad radim na X” | segment se zatvori, novi počinje sa drugom jedinicom |
| Radi / pauzirano | Završi | sesija dobije `ended_at` → ekran za ocjenu i refleksiju |
| Radi / pauzirano | Odbaci | sesija se briše, ništa se ne kalibriše |

**Pravila**

- Vrijeme se računa iz timestampova (`now() − started_at`), nikad sabiranjem `setInterval` tikova. Mobilni browseri guše JS u pozadini, pa bi brojač lažno kasnio.
- Jedna aktivna sesija po korisniku (parcijalni unique indeks). Otvoriš app na laptopu i vidiš isti timer.
- Zaboravljen timer: ako segment radi duže od 3 h ili se app otvori nakon dužeg prekida, prikaže se pitanje “Jesi li učila do sad?” sa mogućnošću da se kraj ispravi.
- Minute po jedinici = zbir segmenata te jedinice; iz toga se puni `session_units.minutes`.
- Pauze ne ulaze u kalibraciju. Ukupno trajanje pauza se ipak pamti (razlika od prvog starta do kraja), što strategist može koristiti.

Tabela `study_segments` i indeks jedne aktivne sesije su u konsolidovanoj migraciji (sekcija Šema baze podataka).

**Kada se šta preračunava**

| Događaj | Rekalibracija procjena | Replan |
| --- | --- | --- |
| Završena sesija | Da, samo izvori iz sesije | Samo ako je odstupanje značajno (ispod) |
| Prvo otvaranje app-a u novom danu | Ne | Da: neodrađeni blokovi postaju “propušteno” |
| Promjena ispita, obima, jedinica, dostupnosti, izuzetka, “položeno” | Ne (osim novih jedinica) | Da, odmah, debounce 2 s za serije izmjena |
| Promjena prioriteta, režima, ručnog starta kampanje | Ne | Da, odmah, debounce 2 s |
| Unos predavanja (“dokle ste stigli”, otkazano) | Ne | Da, odmah, debounce 2 s |
| Ručni blok: dodan, izmijenjen, obrisan | Ne | Da, odmah, debounce 2 s |
| Ishod ponavljanja ili provjere | Ne (FSRS stanje jedinice da) | Ne odmah; ulazi u sljedeći replan, osim kad jedinica padne na level 1 |
| Promjena statusa jedinice van sesije | Ne | Ne odmah; ulazi u sljedeći replan |
| Dugme “Preračunaj” | Da | Da |
| Timer radi | Nikad | Nikad |

**Značajno odstupanje** nakon sesije: nova `est_minutes` za predmet se promijenila za više od 10%, ili je pređeno manje od 70% / više od 130% planiranog obima bloka. Inače se blok samo označi kao odrađen i plan ostaje isti.

**Stabilnost plana.** Današnja lista se ne mijenja ispod tebe: replan tokom dana kreće od sutra, osim ako je današnji plan postao nemoguć (npr. dodala si izuzetak “zauzeta danas”). Djelimično odrađen blok vraća preostale minute u bazen za sljedeće dane.

**Satnica** (tab) se računa samo kad otvoriš tab i kažeš “Generiši”; kešira se dok se `plan_run` ili današnja dostupnost ne promijene.

**Offline.** Timer nikad ne zavisi od mreže. Sesije, segmenti, ocjene i ponavljanja prvo se snimaju u lokalni red u IndexedDB (Dexie), a zatim sinhronizuju sa Supabase-om kad je mreža dostupna.

- ID-jevi se generišu na klijentu (`crypto.randomUUID()`), pa je slanje idempotentno: isti zapis poslan dvaput je `upsert` bez duplikata.
- Red se prazni pri povratku mreže, pri otvaranju app-a i nakon svake akcije; neuspjeh ostaje u redu sa brojem pokušaja.
- Replan i kalibracija se računaju lokalno nad lokalnim podacima, pa rade i offline; rezultat se sinhronizuje kao novi `plan_run`.
- AI pozivi traže mrežu; offline je dugme onemogućeno uz poruku.
- Konflikt (isti zapis izmijenjen na dva uređaja): pobjeđuje noviji `updated_at`, osim segmenata timera, koji se samo dodaju.

**Granica dana.** “Dan” počinje u 04:00 po korisnikovoj vremenskoj zoni (`profiles.day_start_min`, `profiles.timezone`). Učenje u 01:30 pripada prethodnom danu, a “prvo otvaranje novog dana” se računa od te granice. Sva polja `on_date` su lokalni datumi izračunati na ovaj način; timestampovi ostaju u UTC-u.

## Podaci za strategista

Strategist najviše dobija od podataka koje timer skuplja sam, plus dva tapa po sesiji i rezultata ispita koji zatvara krug. Ništa od ovoga ne traži dodatni AI poziv; agregati se računaju SQL-om i šalju strategistu kao kompaktan sažetak.

| Signal | Izvor | Unos | Šta strategist radi s tim |
| --- | --- | --- | --- |
| Efikasnost po dobu dana i danu u sedmici | segmenti (min po jedinici mjere) | pasivno | teške jedinice u najbolje termine u satnici |
| Pad efikasnosti kroz sesiju | segmenti | pasivno | predlaže dužinu bloka i pauze |
| Pauze (broj, trajanje) | segmenti | pasivno | signal fokusa |
| Kašnjenje starta | `planned_start` bloka vs stvarni start | pasivno | prepoznaje termine koje redovno preskočiš i prestaje ih planirati |
| Ispunjenost plana | blokovi done/missed po sedmici | pasivno | smanjuje kapacitet ako je plan stalno preoptimističan |
| Prebacivanja jedinica | broj segmenata po sesiji | pasivno | signal rascjepkanosti |
| Način učenja | `mode`: čitanje, zadaci, ponavljanje, pitanja | 1 tap na startu | odvojena kalibracija po načinu |
| Fokus 1–3 | kraj sesije | 1 tap | razdvaja “teško gradivo” od “loš dan” |
| Rezultat ispita + spremnost dan prije | `assessments` | nakon ispita | kalibriše prognozu spremnosti i samoprocjenu |
| Šta je došlo na ispitu | označavanje pitanja i tema | nakon ispita | prioriteti za popravni i sljedeću generaciju |
| Ishod ponavljanja | `review_logs`: sjećam se / djelimično / ne | 1 tap | jačina po temama; kasnije lični FSRS parametri |
| Zaostatak za predavanjima | `lecture_logs` + nivoi jedinica | 1 tap nakon termina | predlaže prioritet, režim ili raniji start |
| Refleksije | tekst nakon sesije | opcionalno | AI izvuče teme koje nisu jasne i spusti sigurnost tih jedinica |

**Ponašanja strategista**

- Režim pred ispit: 3–5 dana prije prebacuje plan na pitanja i slabe teme.
- Upozorenje na gužvu: dva ispita u istoj sedmici, pa ranije kretanje (za kampanje: `set_campaign_start`).
- Zaostatak i prioritet: kad predmet nižeg prioriteta stalno kasni, predloži `set_priority` ili `set_mode`.
- “Zašto ovo danas”: jedna rečenica uz svaki blok, generisana iz pravila scheduler-a (bez AI-ja).
- Sedmični retro: najviše 3 konkretne akcije.

Polja `mode`, `focus`, `planned_start`, rezultat ispita i tabela `review_logs` su u konsolidovanoj migraciji.

## Tehnike učenja ugrađene u app

Dvije tehnike sa najjačim dokazima su samotestiranje i raspoređeno učenje; app ih ne nudi kao opciju nego ih ugrađuje u tok. Ostale (pauze, miješanje tema) su opcionalne jer su dokazi miješani.

| Tehnika | Dokazi | Kako u app-u |
| --- | --- | --- |
| Samotestiranje (active recall) | Najviša ocjena u pregledu 10 tehnika ([Dunlosky et al. 2013](https://www.psychologicalscience.org/news/releases/which-study-strategies-make-the-grade.html)); u RCT-u sa specijalizantima ponovljeno testiranje dalo je bolje pamćenje nakon 6 mjeseci od ponovljenog čitanja ([Larsen et al. 2009](https://www.learningscientists.org/learning-scientists-podcast/2018/5/16/episode-19-bite-size-research-on-benefits-of-retrieval-with-medical-residents)) | Jedinica ne može na level 2 (“razumijem”) samo čitanjem: traži se kratki test (vidi “Recall gate”) |
| Raspoređeno učenje + spaced repetition | Takođe najviša ocjena kod Dunloskog; kod studenata medicine dnevna upotreba Anki-ja povezana sa višim Step 1 rezultatima ([Wothe et al. 2023](https://doaj.org/article/7aaf357db5d54ad39fea3f672ad5aae4)), ali to su korelacijske studije | Scheduler ne stavlja istu jedinicu više od jednom dnevno; ponavljanja iz `review_logs` |
| Feedback nakon testa | Testiranje sa korektivnim feedbackom daje najbolje učenje ([pregled](https://texasldcenter.org/?p=346)) | Nakon odgovora odmah se prikaže tačan odgovor ili notes, pa korisnik ocijeni recall 0–2 |
| Sistemske pauze (Pomodoro) | Unaprijed zadane pauze dale su bolju koncentraciju i motivaciju i sličan učinak za kraće vrijeme ([Biwer et al. 2023](https://nufind.nu.edu.sa/EdsRecord/eric,EJ1386535)); novija studija našla je brži rast umora uz Pomodoro, bez razlike na kraju ([Behavioral Sciences 2025](https://www.mdpi.com/2076-328X/15/7/861)) | Opcionalni režimi timera: 25/5, 50/10, slobodno. App mjeri koji režim tebi daje bolju efikasnost i fokus |
| Miješanje tema (interleaving) | Miješani dokazi u medicini: kod EKG-a je na odgođenom testu blokirana vježba bila bolja od miješane ([Monteiro et al. 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5542896)) | Samo u blokovima ponavljanja i pitanja, nikad pri prvom učenju; isključivo u postavkama |
| Čitanje, podvlačenje, sažimanje | Niska korisnost kod Dunloskog ([sažetak](https://www.mylifetime.com.hk/?p=2062)) | Strategist upozori kad jedinica ima više čitanja a level ostaje 1, i predloži test umjesto novog čitanja |

**Recall gate (blurting).** Kad označiš poglavlje kao pročitano, app ponudi jedan od dva brza testa:

1. **Blurting:** 3–5 min pišeš sve čega se sjećaš bez gledanja, pa uporediš sa notes-ima.
2. **AI pitanja:** 3 kratka pitanja iz tvojih notes-a za tu jedinicu (jeftin Haiku poziv), odgovor pa tačan odgovor.

Rezultat (0–2) ide u `review_logs` i pokreće FSRS stanje jedinice; tek sa 2 jedinica prelazi na level 2. Gate se može preskočiti, ali se to bilježi, i tada se za 2 dana zakaže provjera pročitanog (vidi Spaced repetition).

**Pitanja kao glavni put.** Za predmete sa ispitnim pitanjima, nakon prvog prolaza kroz poglavlje plan prelazi na pitanja povezana preko tema umjesto ponovnog čitanja. To je samotestiranje + raspoređivanje u jednom.

## Testiranje bez sadržaja literature

App neće imati tekst knjige, pa test pamćenja koristi ono što stvarno postoji. Izvori su poredani po pouzdanosti; ekran testa nudi samo one koji postoje za tu jedinicu.

| Izvor pitanja | Šta treba | Odgovor | Računa se za “Razumijem” |
| --- | --- | --- | --- |
| Ispitna pitanja | pitanja povezana s jedinicom preko teme | obično ga nema: samoocjena uz bilješke; korisnik može jednom upisati odgovor, AI može predložiti odgovor označen “provjeri” | da |
| Bilješke jedinice | notes polje | AI generiše 3 pitanja i odgovore strogo iz teksta bilješki | da |
| Podnaslovi (skeleton recall) | podjedinice iz uslikanog sadržaja | korisnik za svaki podnaslov označi da li ga je mogao objasniti; ≥80% = sjećam se | da |
| Blurting | samo naslov | poređenje sa bilješkama i podnaslovima | da |
| Ručne kartice | pitanje i odgovor koje korisnik napiše tokom sesije | korisnikov | da |
| Slika 1–2 stranice (opcionalno) | npr. sažetak kraja poglavlja | AI pitanja iz te slike, slika se briše | da |
| Opće znanje (AI) | naslov poglavlja + predmet | AI odgovor, uvijek označen “može se razlikovati od predavanja” | samo uz još jedan izvor |

`review_logs.source`, `units.answer` i tabela `cards` su u konsolidovanoj migraciji.

## Raspored nastave

Korisnik unosi predavanja, vježbe i labove (ručno ili slikom rasporeda, isti AI pipeline kao za sadržaj). Ovo je MVP jer bez toga dostupnost ručno dupla raspored.

- Termini nastave (+15 min prije i poslije) automatski su zauzeti; dostupnost ih ne mora ponavljati.
- Prikazuju se u kalendaru i satnici kao “iz rasporeda nastave”.
- Opcija “kratko ponavljanje nakon predavanja”: 15 min istog dana za taj predmet, prvi korak raspoređenog učenja.
- Nakon svakog termina app pita “Dokle ste stigli?” (vidi Praćenje predavanja); otkazan termin se oslobađa za učenje.
- Podržane parne/neparne sedmice (lab) i period važenja (semestar).

**Semestar.** Raspored važi za jedan period nastave iz akademskog kalendara (vidi ispod). Termin pamti period (`period_id`), a njegovi datumi se upisuju u `valid_from` / `valid_to` svakog termina (i ažuriraju kad se period promijeni). Parnost sedmica se broji od početka perioda nastave: sedmica (pon–ned) u kojoj nastava počinje je 1. (neparna). Na neradni dan termini se ne održavaju.

**Dostupnost.** Sedmična pravila (dan, od–do) + izuzeci po danu: zauzeta cijeli dan, zauzeta od–do, dodatno slobodno od–do. Termini nastave (±15 min) se oduzimaju automatski, pa pravila smiju preklapati nastavu. “Ukupno Xh sedmično” je neto za tekuću sedmicu (pravila − nastava). Izmjene se snimaju odmah, bez dugmeta “Sačuvaj”; replan na izmjenu dolazi sa schedulerom.

**Kalendar.** Plan ima tri prikaza: Mjesec (postojeća mreža), Sedmica i Dan. U mjesečnoj mreži nastava nema tačkice (bila bi na skoro svakom danu); termini nastave su u listi izabranog dana, otkazani precrtani. Dan: traka dana kao pilule (izabrani dan taman) i vremenska osa sa karticama u boji predmeta (nastava, kasnije blokovi plana). Sedmica: ista traka i vremenska osa sa 7 uskih kolona.

Kartica “Uslikaj raspored” se prikazuje tek sa AI uvozom rasporeda (Etapa 10). Tabela `timetable_entries` je u konsolidovanoj migraciji; AI zadatak `parse_timetable` koristi isti pipeline kao uvoz sadržaja.

## Akademski kalendar

Fakultet objavi akademski kalendar prije semestra: kad traje nastava, kad su ispitni rokovi i sedmice parcijalnih, i koji su dani neradni. Datume konkretnih ispita kalendar nema; oni dolaze kasnije (raspored parcijala, uvoz ispita).

**Model** (`academic_periods`): vrsta, naziv, od–do (lokalni datumi).

| Vrsta (`kind`) | Primjer | Šta radi |
| --- | --- | --- |
| `teaching` | Zimski semestar, 6. okt – 23. jan | Period važenja rasporeda i parnost sedmica; “7. sedmica nastave” na Danas |
| `partial_exams` | Sedmica parcijalnih, 24.–28. nov | Rok za parcijale sa nepoznatim datumom; nastava teče po rasporedu osim ako je dan i neradni |
| `exam` (+ `exam_session`: `regular` / `makeup`) | Januarsko-februarski redovni rok | Rok za završni, integralni i popravni sa nepoznatim datumom |
| `holiday` | Nova godina, 1.–2. jan | Nema nastave (termini se ne računaju, “Dokle ste stigli?” ne pita); dostupnost za učenje ostaje |

- **Unos:** ručno na ekranu “Akademski kalendar” (Postavke, i iz Rasporeda) od Etape 4; AI uvoz iz slike, PDF-a ili teksta sa pregledom od Etape 6.
- **Ispit u roku:** u ExamSheetu, uz “Datum još nije objavljen”, bira se rok (`assessments.exam_period_id`). Raspon ispita (`at` – `at_latest`) = raspon roka; plan cilja najraniji dan (isto pravilo kao okvirni datum). Prijedlog po tipu: parcijala → sedmica parcijalnih, završni/integralni → redovni rok, popravni → popravni rok. Promjena datuma roka pomjera i povezane okvirne ispite. Na NoviPredmet dugme “Datumi još nisu poznati?” to radi za sve ispite bez datuma odjednom: n-ta parcijala dobija n-tu sedmicu parcijalnih, ostali odgovarajući rok.
- **Sedmica na Danas:** ispod datuma “7. sedmica nastave” (u periodu nastave), “Sedmica parcijalnih”, “Ispitni rok · [naziv]” ili “Neradni dan · [naziv]”; van svih perioda ništa.

## AI uvoz, dokumenti i asistent

AI pomaže da se podaci unesu brže i da se nađe odgovor u dokumentima, ali nikad ne piše direktno: svaki prijedlog prolazi pregled (novo / izmijenjeno / ostaje) i potvrdu.

**Provajder.** Sve ide kroz LLM wrapper (`_shared/llm.ts`). Dok Anthropic nalog nema karticu, `LLM_PROVIDER=gemini` (Gemini Flash free tier, structured output preko `responseSchema` iz `z.toJSONSchema()`); prebacivanje na Haiku je promjena secrets, bez koda. Na free tieru Google može koristiti podatke za poboljšanje proizvoda, pa se šalju samo podaci koji su za to potrebni. Koraci za ključ su u [SETUP.md](SETUP.md).

**Uvoz sa pregledom (Etapa 6).** Ekran “Uvezi”: zalijepi se tekst ili doda slika/PDF i bira šta je unutra.

- Akademski kalendar → periodi (nastava, rokovi, sedmice parcijalnih, neradni dani).
- Raspored ispita (npr. raspored parcijala) → ispiti sa datumima, upareni sa predmetima (`fuse.js` + AI), uz prijedlog izmjene postojećeg ispita (okvirni → tačan datum) umjesto duplikata.
- Isti pregled kasnije koriste raspored nastave i sadržaj knjige (Etapa 10).

**Dokumenti i RAG.** Korpus su tri stvari:

1. **Dokumenti fakulteta** (`documents`: akademski kalendar, pravilnik, silabus, obavještenje). Za razliku od slika sadržaja, dokument se čuva u bucketu `uploads` dok ga korisnik ne obriše. Tekst se dijeli na odlomke (`document_chunks`) sa embeddingom (`gte-small`, pgvector, 384 dimenzije). Pretraga je RPC sa RLS-om (samo vlastiti dokumenti). Odgovor uvijek navodi dokument i stranicu.
2. **Bilješke i jedinice**: naslovi jedinica, bilješke, kartice i ispitna pitanja dobijaju embedding (isti model). Služe recall pitanjima, vezi pitanje ↔ poglavlje i pretrazi “gdje sam pisala o …” (Etapa 10).
3. **Stanje plana**: nije vektorska pretraga nego kompaktan JSON sažetak (predmeti, ispiti, bodovi, napredak, zaostatak), isti kao ulaz strategista.

**Asistent (chat, Etapa 10).** Razgovor nad istim alatima: pretraga dokumenata i bilješki, sažetak stanja i isti prijedlozi kao uvoz (“dodaj sve parcijale iz ovoga”), koji se prikazuju kao kartice sa pregledom. Historija razgovora i trošak se bilježe; isti rate limit kao ostali AI pozivi.

## Bodovi, skala ocjena i projekcija ocjene

Uz spremnost za ispit app zna i koliko bodova nosi svaki ispit i rok, koliko ih je osvojeno i šta treba za željenu ocjenu. Sve se računa čistim kodom u `src/lib/grades/` (testovi), ništa se ne snima osim unosa.

**Bodovi.** Ispit (`assessments`) i rok (`deadlines`) mogu nositi bodove (`points_max`, npr. I parcijala 40, II parcijala 40, zadaće 20). Jedinica se bira po stavci (`points_unit`): bodovi, ili procenti ukupne ocjene. Ukupno predmeta (`subjects.points_total`, default 100) je osnova za procente i skalu: stavka od 20% nosi 20% od `points_total`. Stavka bez `points_max` ne ulazi u bodove (samo u plan).

**Rezultat.** Unosi se kad izađe, kao bodovi (`result_points` od `result_max`, default `result_max` = bodovi stavke) ili kao procenat (`result_max` = 100). Doprinos stavke = bodovi stavke × `result_points` / `result_max`, pa test bodovan od 50 može nositi 40 bodova.

- **Poništi rezultat** (odricanje, `result_annulled`): rezultat ostaje vidljiv precrtan, ne ulazi u zbir, ispit nije položen, pa se aktivira njegov popravni (“samo ako zatreba”).
- **Položeno** (`passed`) app postavi pri unosu rezultata: rezultat se računa i, ako ispit ima prag, procenat ≥ `pass_min_pct`. Korisnik ga može ručno promijeniti (kao i do sad).

**Popravni i integralni.**

- Popravni (`kind = 'makeup'`) je uvijek vezan za ispit koji ponavlja (`retake_of`), pa se na predmetu prikazuje ispod njega (“Popravni I parcijale”) i odmah se zna šta zamjenjuje. Nosi iste bodove kao taj ispit. Popravni integralnog je takođe moguć.
- Integralni (`kind = 'integral'`) zamjenjuje sve parcijale predmeta (sa njihovim popravnim) i nosi zbir njihovih bodova.
- Računa se **zadnji izlazak**: za svaku stavku vrijedi rezultat najkasnijeg pokušaja (stavka ili njen popravni) koji ima rezultat i nije poništen. Ako je zadnji pokušaj u grupi parcijala integralni, on daje bodove za sve parcijale zajedno; inače svaka parcijala svoje.

**Uslovi za prolaz.**

- **Prag po stavci** (`pass_min_pct`, opcionalno, unos u bodovima ili % i snima se kao %): ispod praga stavka nije položena.
- **Prag ukupno**: zbir mora dostići prag ocjene 6 iz skale.
- **Uslov za izlazak** (`entry_min_points` na ispitu, opcionalno): zbir bodova sa stavki koje su prije tog ispita mora biti bar toliki (npr. 20 bodova iz zadaća i seminarskog za završni). Ako nije ispunjen, ispit i projekcija to pokažu.

**Skala ocjena** (`subjects.grade_scale`, `null` = default): pragovi u procentima od `points_total`. Default bosanska skala: 0–54 → 5, 55–64 → 6, 65–74 → 7, 75–84 → 8, 85–94 → 9, 95–100 → 10. Mijenja se po predmetu (pragovi strogo rastući, Zod).

**Projekcija ocjene** (`src/lib/grades/`):

- **Imam**: zbir doprinosa uračunatih rezultata, uz maksimum do sad (“32 od 40”).
- **Najviše moguće**: imam + bodovi preostalih stavki.
- **Za ocjenu N treba**: max(0, prag N − imam) od preostalih bodova, i kao prosječan procenat na preostalim stavkama; uz pragove po stavci. Za svaku ocjenu 6–10: osigurano / treba X (Y%) / nedostižno.
- **Željena ocjena** (`subjects.target_grade`, 6–10, opcionalno) je istaknut red projekcije.
- **Procjena ocjene iz spremnosti** (Napredak, uz prognozu spremnosti): očekivani procenat na preostalom ispitu = prognozirana pokrivenost obima do datuma ispita × jačina znanja; daje vjerovatnu ocjenu i raspon. Rezultati i `readiness_before` je kalibrišu.

**Željena ocjena kao ulaz u plan** (scheduler, Etapa 8): iz potrebnog prosjeka r na preostalim ispitima predmeta ciljna pokrivenost postaje max(pokrivenost iz prioriteta, min(100%, r + 10 p.p.)). Prioritet ostaje ručan; kad je cilj nedostižan ili r > 90% uz prioritet < 4, kartica prijedloga nudi “Podigni prioritet”. `target_grade` i bodovi ulaze u `input_hash`.

**Gdje se vidi.** Polja bodova, praga i uslova u ExamSheet i DeadlineSheet; popravni ugniježđen ispod svog ispita; sheet “Rezultat” (bodovi ili %, poništi); kartica “Bodovi i ocjena” na Predmetu (imam / treba za željenu ocjenu / skala ocjena ›); kratak pregled po predmetima na Napretku. Mockup predlaže app u stilu postojećih ekrana, prije implementacije.

## Obim ispita: svi izvori i ručne izmjene

Obim se bira za svaki tip izvora (knjiga, skripta, pitanja, prezentacije, ostalo), jer `assessment_units` već vezuje bilo koju jedinicu. AI predlaže raspodjelu (za pitanja preko tema), a korisnik svaku stavku može prebaciti na jedan od ispita bez “cijelo gradivo” (I, II, …), na sve njih (“Sve”, kad ih je bar dva) ili na “ne ulazi”. Ispiti sa `scope_all` (integralni, završni) uvijek obuhvataju sve osim “ne ulazi”. Red na roditelju važi i za podjedinice. Ručna izmjena je zaključana: ponovno AI parsiranje je ne mijenja. “Ne ulazi” je red sa `included = false`, pa radi i za ispit sa `scope_all = true` (isto koristi “Izbaci iz plana” pri brisanju bloka).

Kolona `assessment_units.assigned_by` je u konsolidovanoj migraciji.

## Timer dugme u navigaciji

Tap otvara kratki izbor umjesto da odmah pokrene nešto nepredvidivo:

1. Ako sesija već traje, dugme je samo vraća (bez izbora).
2. Inače je označen sljedeći neodrađeni blok iz današnjeg plana (“Preporučeno”); ostali današnji blokovi su ispod.
3. “Slobodna sesija”: bira se samo predmet, jedinica u sesiji. Vrijeme ulazi u kalibraciju, ali ne zatvara nijedan planirani blok.

## Tech stack

React SPA kao PWA na Cloudflare Pages, Supabase za bazu, auth i storage, a AI pozivi idu kroz Supabase Edge Functions da API ključ nikad ne dođe do browsera. Sve je u stacku koji već znaš, pa nema učenja novog frameworka.

| Sloj | Izbor | Zašto |
| --- | --- | --- |
| Frontend | React + TypeScript + Vite | Poznat stack, brz dev server |
| Stil | Tailwind + shadcn/ui | Gotove pristupačne komponente (dialog, sheet, tabs) |
| PWA | vite-plugin-pwa | Instalacija na početni ekran telefona, offline shell |
| Routing | React Router | Standard za SPA |
| Server state | TanStack Query | Keširanje, optimistični update statusa jedinica |
| Lokalni state | Zustand | UI state (aktivna sesija, filteri) |
| Forme + validacija | React Hook Form + Zod | Isti Zod šeme validiraju i AI JSON izlaz |
| Kalendar | Vlastita mreža (date-fns) | Mockup je jednostavna mjesečna mreža; bez ~100 KB biblioteke i prepisivanja njenog CSS-a |
| Datumi | date-fns | Male, tree-shakable funkcije |
| Baza | Supabase Postgres | RLS po `user_id`, SQL koji znaš |
| Auth | Supabase Auth (magic link ili Google) | Bez lozinki za jednog korisnika, auth-ready za više |
| Storage | Supabase Storage | Slike sadržaja (privremeno, brišu se nakon parsiranja) |
| AI backend | Supabase Edge Functions (Deno) | Ključ ostaje na serveru; nema zasebnog backenda |
| AI model | Claude Haiku 5.5 (`claude-haiku-5-5`) | Vision + jeftin; alternativa Gemini Flash free tier |
| Tipovi iz baze | `supabase gen types typescript` | Tipizirani upiti end-to-end |
| Spaced repetition | `ts-fsrs` (FSRS v6) | Isti algoritam kao Anki; jačina znanja R(t) bez vlastite matematike |
| Bilješke | `react-markdown` + `remark-math` + `rehype-katex` | Markdown i formule u bilješkama |
| Grafikoni | `recharts` | Statistika i jačina po temama na Napretku |
| Slike | `browser-image-compression` | Smanjenje na 1600 px u web workeru prije uploada |
| Fuzzy uparivanje | `fuse.js` | Nazivi predmeta iz rasporeda ↔ postojeći predmeti |
| Embeddings | pgvector + ugrađeni `gte-small` u Edge Functions (`Supabase.ai.Session`) | Povezivanje pitanja i poglavlja, dedupe tema, bez LLM poziva |
| Testovi | Vitest + `fast-check` (+ Playwright kasnije) | Scheduler, formule progresa, property testovi invarijanti plana |
| AI evali | `promptfoo` | Regresijski testovi promptova na fiksnim slikama prije promjene prompta ili modela |
| CI/CD | GitHub Actions + Cloudflare Pages Git integracija | Lint/test na PR, auto deploy na `main` |
| Hosting | Cloudflare Pages | Besplatno, preview deploy po grani |

Zašto ne FastAPI/Express backend: za ovaj obim bi samo dodao server koji treba hostati i koji na free tieru spava. Ako kasnije zatreba (npr. teži batch poslovi), Edge Functions se mogu zamijeniti bez promjene baze.

**Backend ukratko.** Nema zasebnog servera; backend je Supabase:

- **Postgres + PostgREST:** frontend preko `supabase-js` direktno čita i piše tabele (CRUD predmeta, jedinica, sesija). Sigurnost daje RLS u bazi, ne kod u API-ju.
- **Supabase Auth:** login i JWT koji RLS koristi (`auth.uid()`).
- **Supabase Storage:** privremene slike sadržaja.
- **Edge Functions (Deno, TypeScript):** sve što traži tajni ključ ili više koraka na serveru, tj. AI pozivi. Tu živi LLM wrapper.
- **Scheduler** (`plan()`, `placeTimes()`) radi u browseru jer je čista funkcija nad podacima koje klijent već ima; rezultat se snima u `plan_runs` / `plan_blocks`. Ako kasnije zatreba (npr. noćni replan bez otvaranja app-a), ista funkcija se prebaci u edge funkciju + `pg_cron`.

**Dva jezika (bs/en).** `react-i18next` sa `src/locales/bs.json` i `en.json`, `date-fns` lokali za datume, `profiles.locale` pamti izbor. Ključevi prevoda od prvog dana, bez hardkodiranog teksta u komponentama. AI dobija `locale` u promptu: objašnjenja strategista su na izabranom jeziku, a naslovi poglavlja ostaju kako piše u knjizi.

**Offline sloj.** `dexie` za lokalni red i keš podataka u IndexedDB; mali sync modul (`src/lib/sync/`) šalje red kroz `supabase-js` upsert. Notifikacije: Web Push iz PWA (service worker) sa edge funkcijom koja se zove iz `pg_cron` rasporeda.

## Šema baze podataka

Jedna konsolidovana migracija `supabase/migrations/0001_init.sql` sa svim tabelama iz ovog dokumenta. Svaka tabela ima `user_id default auth.uid()` i RLS “vlasnik vidi samo svoje”. ID-jevi se mogu generisati na klijentu (offline), pa je `default gen_random_uuid()` samo rezerva.

| Tabela | Šta čuva |
| --- | --- |
| `profiles` | jezik, zona, granica dana, postavke plana, režim timera, lični SR množitelj |
| `subjects` | predmet i boja |
| `assessments`, `assessment_units` | ispiti i njihov obim (bilo koji izvor), AI ili ručno |
| `deadlines` | rokovi, opcionalna procjena sati |
| `sources`, `units` | izvori i jedinice; nivo, ocjene, notes, odgovor, SR stanje, arhiva |
| `source_mode_rates` | kalibrisana brzina po izvoru × načinu učenja |
| `topics`, `unit_topics` | teme i veza na jedinice (AI ili ručno) |
| `timetable_entries` | raspored nastave |
| `availability_rules`, `availability_exceptions` | slobodni termini i izuzeci |
| `plan_runs`, `plan_blocks`, `plan_block_units` | generisani plan |
| `study_sessions`, `study_segments`, `session_units` | stvarno učenje |
| `review_logs`, `cards` | ponavljanja i kartice |
| `ai_runs` | log AI poziva i troška |

```sql
-- 0001_init.sql
create extension if not exists "pgcrypto";

create type exam_format as enum ('written','oral','combined','project','other');
create type assessment_kind as enum ('partial','final','integral','makeup','other');
create type deadline_kind as enum ('assignment','custom');
create type source_kind as enum ('book','script','questions','slides','other');
create type unit_kind as enum ('chapter','question');
create type study_mode as enum ('reading','problems','review','questions');
create type block_status as enum ('planned','in_progress','done','missed','skipped');
create type block_kind as enum ('learn','review','questions','recap','deadline');
create type class_kind as enum ('lecture','exercise','lab','other');
create type recall_source as enum ('exam_question','notes','outline','blurt','card','page_photo','general');
create type assigned_by as enum ('ai','user');
create type ai_task as enum ('parse_toc','parse_questions','parse_timetable','recall_questions','propose_answer','quiz','strategist');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  locale text not null default 'bs' check (locale in ('bs','en')),
  timezone text not null default 'Europe/Sarajevo',
  day_start_min smallint not null default 240,          -- 04:00
  buffer_days smallint not null default 1,
  max_subjects_per_day smallint not null default 3,
  min_block_minutes smallint not null default 25,
  timer_mode text not null default '25/5' check (timer_mode in ('25/5','50/10','free')),
  recap_after_lecture boolean not null default true,
  srs_multiplier numeric not null default 1.0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  color text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid not null references subjects on delete cascade,
  kind assessment_kind not null default 'final',
  title text not null,
  at timestamptz not null,
  format exam_format not null default 'written',
  weight_pct numeric,
  scope_all boolean not null default true,
  passed boolean not null default false,
  readiness_before smallint check (readiness_before between 1 and 5),
  result_points numeric,
  result_max numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table deadlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid references subjects on delete cascade,
  title text not null,
  kind deadline_kind not null default 'custom',
  due_at timestamptz not null,
  est_minutes numeric,                 -- null = samo prikaz
  done_minutes numeric not null default 0,
  notes text,
  done boolean not null default false,
  updated_at timestamptz not null default now()
);

create table sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid not null references subjects on delete cascade,
  kind source_kind not null,
  title text not null,
  author text,
  weight numeric,                      -- null = udio u minutama
  base_min_per_unit numeric not null,  -- heuristika po tipu
  learned_min_per_unit numeric,        -- svi načini zajedno
  learned_samples int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table source_mode_rates (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  source_id uuid not null references sources on delete cascade,
  mode study_mode not null,
  min_per_unit numeric not null,
  samples int not null default 0,
  primary key (source_id, mode)
);

create table units (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  source_id uuid not null references sources on delete cascade,
  parent_id uuid references units on delete cascade,
  kind unit_kind not null default 'chapter',
  position int not null,
  label text,                          -- ključ za merge pri ponovnom uvozu
  title text not null,
  page_start int,
  page_end int,
  amount numeric not null default 1,
  ai_difficulty smallint check (ai_difficulty between 1 and 5),
  user_difficulty smallint check (user_difficulty between 1 and 5),
  est_minutes numeric,
  level smallint not null default 0 check (level between 0 and 3),
  confidence smallint check (confidence between 1 and 5),
  notes text,
  answer text,                         -- za pitanja
  answer_origin assigned_by,
  completed_at timestamptz,
  srs_ease numeric not null default 2.5,
  srs_interval_days numeric,
  srs_success_count smallint not null default 0,
  next_review_on date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, label)
);
create index on units (source_id, position);
create index on units (user_id, next_review_on) where archived_at is null;

create table assessment_units (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  assessment_id uuid not null references assessments on delete cascade,
  unit_id uuid not null references units on delete cascade,
  assigned_by assigned_by not null default 'ai',
  primary key (assessment_id, unit_id)
);

create table topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid not null references subjects on delete cascade,
  name text not null,
  unique (subject_id, name)
);

create table unit_topics (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  unit_id uuid not null references units on delete cascade,
  topic_id uuid not null references topics on delete cascade,
  assigned_by assigned_by not null default 'ai',
  primary key (unit_id, topic_id)
);

create table timetable_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid references subjects on delete cascade,
  kind class_kind not null,
  weekday smallint not null check (weekday between 0 and 6),   -- 0 = ponedjeljak
  start_min smallint not null,
  end_min smallint not null check (end_min > start_min),
  location text,
  week_parity text check (week_parity in ('odd','even')),
  valid_from date not null,
  valid_to date not null
);

create table availability_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_min smallint not null,
  end_min smallint not null check (end_min > start_min)
);

create table availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  on_date date not null,
  start_min smallint,
  end_min smallint,
  is_busy boolean not null default true
);

create table plan_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  input_hash text not null,
  with_times boolean not null default false,
  deficit jsonb,
  created_at timestamptz not null default now()
);

create table plan_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid not null references subjects on delete cascade,
  assessment_id uuid references assessments on delete cascade,
  deadline_id uuid references deadlines on delete cascade,
  on_date date not null,                -- lokalni dan (granica dana)
  start_min smallint,                   -- null dok satnica nije generisana
  planned_start timestamptz,
  planned_minutes smallint not null,
  kind block_kind not null default 'learn',
  status block_status not null default 'planned',
  reason text,                          -- "zašto ovo danas"
  plan_run_id uuid not null references plan_runs on delete cascade,
  created_at timestamptz not null default now()
);
create index on plan_blocks (user_id, on_date);

create table plan_block_units (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  block_id uuid not null references plan_blocks on delete cascade,
  unit_id uuid not null references units on delete cascade,
  page_from int,
  page_to int,
  planned_minutes smallint not null,
  primary key (block_id, unit_id)
);

create table study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid not null references subjects on delete cascade,
  block_id uuid references plan_blocks on delete set null,   -- null = slobodna sesija
  mode study_mode,
  started_at timestamptz not null,
  ended_at timestamptz,
  focus smallint check (focus between 1 and 3),
  reflection text,
  updated_at timestamptz not null default now()
);
create unique index one_active_session on study_sessions (user_id) where ended_at is null;

create table study_segments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  session_id uuid not null references study_sessions on delete cascade,
  unit_id uuid references units on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz
);

create table session_units (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  session_id uuid not null references study_sessions on delete cascade,
  unit_id uuid not null references units on delete cascade,
  minutes numeric not null,
  amount_done numeric,
  level_before smallint,
  level_after smallint,
  difficulty smallint check (difficulty between 1 and 5),
  primary key (session_id, unit_id)
);

create table review_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  unit_id uuid not null references units on delete cascade,
  reviewed_at timestamptz not null default now(),
  source recall_source not null,
  recall smallint not null check (recall between 0 and 2),
  was_scheduled boolean not null default false,   -- za ličnu kalibraciju
  interval_before numeric,
  interval_after numeric
);

create table cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  unit_id uuid not null references units on delete cascade,
  front text not null,
  back text not null,
  origin assigned_by not null default 'user',
  created_at timestamptz not null default now()
);

create table ai_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  task ai_task not null,
  provider text not null,
  model text not null,
  input_tokens int,
  output_tokens int,
  cost_usd numeric(10,6),
  ok boolean not null,
  error text,
  created_at timestamptz not null default now()
);

-- RLS: vlasnik vidi i mijenja samo svoje redove
do $$
declare t text;
begin
  foreach t in array array['subjects','assessments','assessment_units','deadlines','sources',
    'source_mode_rates','units','topics','unit_topics','timetable_entries',
    'availability_rules','availability_exceptions','plan_runs','plan_blocks','plan_block_units',
    'study_sessions','study_segments','session_units','review_logs','cards','ai_runs']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy owner_all on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

alter table profiles enable row level security;
create policy own_profile on profiles for all using (id = auth.uid()) with check (id = auth.uid());
```

Napomene:

- Progres se ne snima, nego računa iz `units` (klijent ili view), pa ne može pobjeći od stvarnog stanja.
- `updated_at` na tabelama koje se mijenjaju sa više uređaja služi za rješavanje konflikata pri sinhronizaciji; postavlja se trigerom.
- Arhivirane jedinice (`archived_at`) ne ulaze u plan ni progres, ali zadržavaju historiju.
- Slike sadržaja i rasporeda idu u privatni bucket `uploads` i brišu se nakon uspješnog parsiranja.
- Jačina znanja (FSRS R) se ne snima, nego računa iz FSRS stanja jedinice i današnjeg datuma.

### Kasnije migracije

`0001_init.sql` je primijenjen i ne mijenja se. Svaka izmjena šeme je nova migracija u etapi kojoj treba (vidi ROADMAP). Nove tabele dobijaju `user_id default auth.uid()`, RLS `owner_all ... to authenticated`, `grant select, insert, update, delete ... to authenticated`, a sinhronizovane i `updated_at` + triger `set_updated_at`. Skica:

```sql
-- 0002_subjects_and_profile.sql (Etapa 2, primijenjena)
alter table subjects
  add column priority smallint not null default 3 check (priority between 1 and 5),
  add column study_mode text not null default 'regular' check (study_mode in ('regular','campaign')),
  add column campaign_start_on date;                  -- null = izračunat
alter table assessments
  add column contingent boolean not null default false,       -- "samo ako zatreba"
  add column date_tentative boolean not null default false;   -- okvirni datum
alter table profiles
  add column name_confirmed_at timestamptz;                   -- null = pitaj "Kako da te zovem?"

-- 0003_exam_date_range.sql (Etapa 2, primijenjena)
alter table assessments
  add column at_latest timestamptz,                   -- najkasniji mogući dan okvirnog ispita
  add constraint assessments_at_latest_check
    check (at_latest is null or (date_tentative and at_latest >= at));

-- 0004_sources_and_scope.sql (Etapa 3)
alter table sources
  add column measure text not null default 'pages'
    check (measure in ('pages','slides','questions','items'));
alter table assessment_units
  add column included boolean not null default true,   -- false = "ne ulazi"
  add constraint assessment_units_excluded_by_user check (included or assigned_by = 'user');

-- 0005_calendar_and_lectures.sql (Etapa 4)
create table academic_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('teaching','partial_exams','exam','holiday')),
  exam_session text check (exam_session in ('regular','makeup')),   -- samo za kind = 'exam'
  title text not null,
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  updated_at timestamptz not null default now(),
  check ((kind = 'exam') = (exam_session is not null))
);
-- + RLS owner_all, grant, set_updated_at triger, indeks (user_id, starts_on)
alter table timetable_entries
  add column period_id uuid references academic_periods on delete set null;
alter table assessments
  add column exam_period_id uuid references academic_periods on delete set null;  -- "ispit u roku"

create table lecture_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid not null references subjects on delete cascade,
  timetable_entry_id uuid references timetable_entries on delete set null,
  on_date date not null,                               -- lokalni dan
  source_id uuid references sources on delete cascade,
  up_to_unit_id uuid references units on delete set null,
  cancelled boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cancelled or up_to_unit_id is not null)
);
-- + RLS owner_all, grant, set_updated_at triger, indeks (user_id, subject_id, on_date)
alter table profiles add column lecture_pace_days smallint not null default 7;
alter table availability_exceptions
  add column lecture_log_id uuid references lecture_logs on delete cascade;  -- "Nastava otkazana"

-- 0006_grades.sql (Etapa 5)
alter table assessments rename column weight_pct to points_max;   -- nije korištena
alter table assessments
  add column points_unit text not null default 'points' check (points_unit in ('points','percent')),
  add column pass_min_pct numeric check (pass_min_pct between 0 and 100),
  add column entry_min_points numeric check (entry_min_points >= 0),
  add column retake_of uuid references assessments on delete cascade,   -- popravni → ispit
  add column result_annulled boolean not null default false;          -- odricanje
alter table deadlines
  add column points_max numeric check (points_max > 0),
  add column points_unit text not null default 'points' check (points_unit in ('points','percent')),
  add column pass_min_pct numeric check (pass_min_pct between 0 and 100),
  add column result_points numeric,
  add column result_max numeric;
alter table subjects
  add column points_total numeric not null default 100 check (points_total > 0),
  add column grade_scale jsonb,                        -- null = default skala
  add column target_grade smallint check (target_grade between 6 and 10);

-- 0007_ai_documents.sql (Etapa 6)
create extension if not exists vector;
alter type ai_task add value 'parse_academic_calendar';
alter type ai_task add value 'parse_exam_schedule';
alter type ai_task add value 'answer';
create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid references subjects on delete set null,      -- null = opći (kalendar, pravilnik)
  kind text not null check (kind in ('academic_calendar','rules','syllabus','exam_schedule','notice','other')),
  title text not null,
  storage_path text,                                           -- uploads/<user_id>/...
  pages int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  document_id uuid not null references documents on delete cascade,
  page int,
  position int not null,
  content text not null,
  embedding vector(384)
);
-- + RLS owner_all, grant, HNSW indeks nad embedding, RPC match_document_chunks(query_embedding, k)

-- 0008_manual_blocks.sql (Etapa 8)
alter table plan_blocks
  add column origin assigned_by not null default 'ai',   -- 'user' = zaključan od replana
  add column title text,
  alter column plan_run_id drop not null;
alter table subjects
  add column priority_boost_until date;                -- privremeno pojačanje prioriteta

-- 0009_fsrs.sql (Etapa 9); SM-2 kolone još nisu korištene
alter table units
  drop column srs_ease, drop column srs_interval_days, drop column srs_success_count,
  add column fsrs_stability numeric,
  add column fsrs_difficulty numeric,
  add column fsrs_state smallint,                     -- ts-fsrs State: 0 new, 1 learning, 2 review, 3 relearning
  add column fsrs_reps smallint not null default 0,
  add column fsrs_lapses smallint not null default 0,
  add column last_review_at timestamptz;             -- next_review_on ostaje
alter table profiles
  drop column srs_multiplier,
  add column review_cap_pct smallint not null default 40 check (review_cap_pct between 10 and 100),
  add column fsrs_params jsonb;                       -- null = default parametri
alter table review_logs
  add column elapsed_days numeric,
  add column stability_before numeric,
  add column stability_after numeric;
```

## AI integracija

Edge funkcije, sve sa strukturiranim JSON izlazom koji se validira Zod šemom prije snimanja. Uz Claude Haiku 5.5 jedno parsiranje košta otprilike desetinku centa.

| Edge funkcija | Ulaz | Izlaz |
| --- | --- | --- |
| `parse-toc` | 1–4 slike ili tekst, tip izvora, predmet, postojeće teme | jedinice, stranice, podjedinice, `ai_difficulty`, teme, upozorenja |
| `parse-questions` | slika ili tekst liste pitanja, postojeće teme i poglavlja | pitanja, teme, prijedlog ispita |
| `parse-timetable` | slika rasporeda, nazivi predmeta | termini (dan, vrijeme, tip, sala, parnost), veza na predmet |
| `parse-academic-calendar` | tekst, slika ili PDF kalendara | periodi: nastava, sedmice parcijalnih, rokovi (redovni/popravni), neradni dani |
| `parse-exam-schedule` | tekst, slika ili PDF rasporeda ispita, predmeti i postojeći ispiti | ispiti sa datumom, veza na predmet i postojeći ispit |
| `documents` | PDF/slika/tekst dokumenta | odlomci sa embeddingom (`gte-small`), bez LLM poziva |
| `answer` | pitanje + najrelevantniji odlomci + sažetak stanja | odgovor sa citatima (dokument, stranica) |
| `recall-questions` | bilješke ili slika stranice ili naslov + podnaslovi | 3 pitanja sa odgovorima i oznakom izvora |
| `propose-answer` | ispitno pitanje + bilješke povezanih jedinica | prijedlog odgovora, označen “provjeri” |
| `quiz` | bilješke jedinice | 5–10 pitanja za kviz ili kartice |
| `strategist` | JSON sažetak stanja | sažetak, rizici, najviše 3 akcije |

**Kako dobiti pouzdan JSON.** Koristi structured outputs (`output_config.format` sa `type: "json_schema"`, GA i podržano za `claude-haiku-5-5`): odgovor je garantovano po šemi. Šema se piše samo jednom, Zod-om u `supabase/functions/_shared/schemas.ts`; Anthropic adapter je pretvori helperom `zodOutputFormat()` (`@anthropic-ai/sdk/helpers/zod`) i zove `messages.parse()`, koji vraća validiran `parsed_output`. Gemini adapter koristi `z.toJSONSchema()`. Isti Zod validira i na klijentu.

Ograničenja šema za structured outputs:

- **Bez rekurzije.** Šema jedinica je fiksne dubine (poglavlje → podpoglavlje → pod-podpoglavlje), ne `z.lazy`. Dublji nivoi se spljošte u najdublji podržani.
- `minimum`/`maximum`, `minLength`/`maxLength` API ne provodi; SDK ih prebaci u opis polja i provjeri lokalno, a Zod ih ionako provjerava.
- Šeme ostaju male i ravne (limit je oko 24 opcionalna polja po zahtjevu); opcionalno polje radije `nullable` nego izostavljeno.

```json
{
  "units": [
    {
      "label": "4",
      "title": "Fourierova transformacija",
      "page_start": 112,
      "page_end": 158,
      "ai_difficulty": 4,
      "children": [
        { "label": "4.1", "title": "Definicija i osobine", "page_start": 112, "page_end": 125, "ai_difficulty": 3 }
      ]
    }
  ],
  "warnings": ["Stranica za 4.3 nije čitljiva"]
}
```

**Sistemski prompt za `parse-toc` (skica).** “Izvlačiš sadržaj udžbenika sa fotografije. Vrati samo ono što vidiš; ne izmišljaj stranice. Ako krajnja stranica nije navedena, uzmi početnu stranicu sljedećeg poglavlja minus 1. Težina 1–5 je relativna unutar ovog predmeta za studenta \[smjer\]. Nesigurnosti stavi u `warnings`.”

**Smanjenje troška i grešaka**

- Slika se smanjuje na klijentu na max 1600 px duže strane prije uploada.
- `max_tokens` ograničen (npr. 4000 za parse, 1500 za strategist).
- Rate limit u edge funkciji: npr. max 30 AI poziva dnevno po korisniku, provjera preko `ai_runs`.
- Svaki poziv se logira u `ai_runs` sa tokenima i cijenom, pa u postavkama vidiš potrošnju.

**Procjena troška (Haiku 5.5: $0.10 / 1M ulaznih, $0.50 / 1M izlaznih tokena do 100k tokena prompta)**

| Poziv | Ulaz | Izlaz | Cijena po pozivu |
| --- | --- | --- | --- |
| Parse sadržaja (1 slika) | \~3k | \~1.5k | \~$0.001 |
| Strategist | \~2k | \~0.8k | \~$0.0006 |

Tokeni su gruba procjena; stvarni broj vidiš u `ai_runs` nakon prvih poziva.

**Alternativa: Gemini Flash free tier.** Besplatan uz dnevne limite, ali na free tieru Google može koristiti podatke za poboljšanje proizvoda. Ako ga uzmeš, napravi tanki `llm` adapter u edge funkciji da možeš mijenjati provajdera jednom env varijablom.

**LLM wrapper (odlučeno: Haiku 5.5 kao default).** Edge funkcije nikad ne zovu SDK direktno, nego jedan interfejs u `supabase/functions/_shared/llm.ts`. Provajder i model se biraju env varijablama `LLM_PROVIDER` i `LLM_MODEL`, pa promjena znači `supabase secrets set`, bez izmjene koda.

```ts
export interface LlmRequest<T> {
  task: 'parse_toc' | 'parse_questions' | 'strategist' | 'quiz';
  system: string;
  text?: string;
  images?: { mediaType: 'image/jpeg' | 'image/png'; base64: string }[];
  schema: z.ZodType<T>;      // isti Zod kao na klijentu; JSON Schema se izvodi iz njega
  maxTokens: number;
}

export interface LlmResult<T> {
  data: T;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface LlmProvider {
  generate<T>(req: LlmRequest<T>): Promise<LlmResult<T>>;
}

// providers/anthropic.ts  → structured outputs: zodOutputFormat(schema) + messages.parse()
// providers/gemini.ts     → responseSchema iz z.toJSONSchema(schema)
export function getProvider(): LlmProvider { /* čita LLM_PROVIDER */ }
```

Wrapper radi i zajedničke stvari: Zod validaciju izlaza (jedan retry ako padne), računanje cijene iz tabele cijena po modelu i upis u `ai_runs`. Dugi sistemski promptovi koriste prompt caching. Sedmični strategist nije hitan, pa može ići kroz Message Batches API (50% jeftinije) kad bude više korisnika.

**Embeddings bez LLM-a.** Edge funkcije imaju ugrađen model `gte-small` (`new Supabase.ai.Session('gte-small')`, plaća se samo CPU). Jedinice, pitanja i teme dobijaju vektor (pgvector, 384 dimenzije) pri uvozu. Tako se bez dodatnog AI poziva predlažu veze pitanje ↔ poglavlje, prepoznaju duple teme i daje kontekst za `parse-questions` i obim ispita. AI i dalje odlučuje o temama; embedding samo sužava kandidate.

**Evali promptova.** `evals/` sa `promptfoo` konfiguracijom i 5–10 fiksnih slika sadržaja i rasporeda: prije promjene prompta ili modela provjeri se da izlaz prolazi Zod šemu i da se broj jedinica i stranice poklapaju sa očekivanim.

## Struktura projekta

Jedan repo, bez monorepo alata: Vite app u korijenu i `supabase/` folder pored. Zod šeme koje koriste i frontend i edge funkcije žive u `supabase/functions/_shared/` i frontend ih uvozi preko aliasa.

```
study-planner/
├─ src/
│  ├─ app/              # router, layout, providers, i18n
│  ├─ features/
│  │  ├─ today/         # "Danas", fokus bar, sljedeći blok
│  │  ├─ plan/          # kalendar, satnica, replan sheet
│  │  ├─ schedule/      # raspored nastave, dostupnost
│  │  ├─ subjects/      # predmeti, ispiti, rokovi
│  │  ├─ sources/       # izvori, uvoz, pregled, obim ispita, jedinica
│  │  ├─ session/       # timer dugme, timer, kraj sesije, recall gate
│  │  ├─ progress/      # statistika, strategist
│  │  └─ settings/
│  ├─ lib/
│  │  ├─ scheduler/     # plan(), placeTimes() + testovi
│  │  ├─ estimates/     # heuristika, shrinkage, kalibracija po načinu
│  │  ├─ srs/           # FSRS (ts-fsrs), jačina znanja + testovi
│  │  ├─ pace/          # praćenje predavanja, zaostatak, prijedlozi + testovi
│  │  ├─ progress/      # formule progresa
│  │  ├─ day.ts         # granica dana, lokalni datumi
│  │  ├─ sync/          # Dexie red, upsert, konflikti
│  │  ├─ supabase.ts
│  │  └─ image.ts
│  ├─ locales/          # bs.json, en.json
│  └─ types/database.ts
├─ supabase/
│  ├─ migrations/0001_init.sql
│  ├─ seed.sql
│  └─ functions/
│     ├─ _shared/        # schemas.ts, llm.ts, prices.ts, cors.ts
│     ├─ parse-toc/  parse-questions/  parse-timetable/
│     ├─ recall-questions/  propose-answer/  quiz/
│     ├─ strategist/
│     └─ notify/         # web push, poziva ga pg_cron
├─ .github/workflows/   # ci.yml, keepalive.yml, backup.yml
├─ public/
└─ .env.example
```

**Kostur za prvi dan**

```bash
npm create vite@latest study-planner -- --template react-ts
cd study-planner
npm i @supabase/supabase-js @tanstack/react-query react-router-dom zustand zod react-hook-form @hookform/resolvers date-fns
npm i -D tailwindcss @tailwindcss/vite vite-plugin-pwa vitest supabase
npx shadcn@latest init
npx supabase init
```

## Deploy i troškovi

Cijeli setup radi na besplatnim planovima; jedini trošak je dopuna Anthropic API kredita, od koje ćeš za jednog korisnika potrošiti centove. Glavna zamka je Supabase pauza nakon 7 dana bez aktivnosti, što rješava mali GitHub Action.

| Servis | Plan | Limiti koji su bitni | Cijena |
| --- | --- | --- | --- |
| [Cloudflare Pages](https://developers.cloudflare.com/pages/platform/limits) | Free | 500 buildova mjesečno po računu, 1 build istovremeno | $0 |
| [Supabase](https://automationatlas.io/answers/supabase-free-tier-limits-2026/) | Free | 500 MB baza, 1 GB storage, 5 GB egress, 2 aktivna projekta, pauza nakon 7 dana neaktivnosti, bez backupa | $0 |
| [Anthropic API](https://techenclave.com/news/items/claude-haiku-5-5-launches-with-0-10-input-pricing-for-shorter-prompts) | Pay-as-you-go | Haiku 5.5: $0.10 / $0.50 po 1M tokena | centi po semestru + minimalna dopuna kredita |
| GitHub | Free | Actions za CI i keep-alive | $0 |
| Domena | opcionalno | `*.pages.dev` je besplatna | $0 |

**1. Supabase**

1. Na supabase.com napravi projekat, regija Frankfurt (eu-central-1), najbliža Sarajevu.
2. Lokalno: `npx supabase login`, pa `npx supabase link --project-ref <ref>`.
3. `npx supabase db push` primijeni `0001_init.sql`.
4. `npx supabase gen types typescript --linked > src/types/database.ts`.
5. Authentication → URL Configuration: Site URL = tvoja `*.pages.dev` adresa; Redirect URLs dodaj i `http://localhost:5173`.
6. Napravi svoj nalog (magic link), pa u Auth postavkama **isključi nove registracije**. Tako niko drugi ne troši tvoje AI kredite.
7. Storage: privatni bucket `toc-uploads` + politika da svako vidi samo svoj folder:

```sql
create policy "own folder" on storage.objects for all
using (bucket_id = 'toc-uploads' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'toc-uploads' and (storage.foldername(name))[1] = auth.uid()::text);
```

**2. AI ključ i edge funkcije**

1. Na console.anthropic.com dopuni kredit i odmah postavi mjesečni limit potrošnje.
2. `npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
3. `npx supabase functions deploy parse-toc` (i ostale). JWT provjera ostaje uključena, pa funkciju može pozvati samo prijavljen korisnik.

**3. Cloudflare Pages**

1. Push repo na GitHub.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
3. Framework preset: Vite. Build command `npm run build`, output `dist`.
4. Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (anon ključ je javan po dizajnu; zaštitu daje RLS).
5. Ne dodaji `404.html`: bez njega Pages tretira projekat kao SPA i sve rute vraćaju `index.html`.
6. Svaki push na `main` = produkcijski deploy; svaka grana = preview URL.

**4. Keep-alive protiv Supabase pauze** (`.github/workflows/keepalive.yml`; URL i anon ključ u GitHub Secrets):

```yaml
name: keepalive
on:
  schedule:
    - cron: "0 6 */3 * *"
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS "$SUPABASE_URL/rest/v1/subjects?select=id&limit=1" \
            -H "apikey: $SUPABASE_ANON_KEY" -o /dev/null
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

**5. Backup.** Free tier nema backup retenciju, a projekat koji predugo stoji pauziran može biti obrisan. Jednom sedmično pokreni `npx supabase db dump --linked -f backup.sql` (ručno ili kao drugi GitHub Action sa DB lozinkom u Secrets) i čuvaj fajl van repoa.

## Roadmap i odluke

Sve je u prvoj verziji; ovo je samo redoslijed gradnje, tako da poslije svakog koraka imaš nešto što radi.

1. **Temelj.** Kostur, migracija, login, i18n, deploy, CI.
2. **Predmeti, ispiti, rokovi, kalendar.** Uključujući prioritet, režim, “samo ako zatreba” i okvirni datum (polja i UI).
3. **Izvori i jedinice ručno.** Statusi, notes, kartice, progres, teme ručno, obim ispita.
4. **Akademski kalendar, raspored nastave i dostupnost.** Plus praćenje predavanja, zaostatak, granica dana i sedmični/dnevni kalendar.
5. **Bodovi i ocjene.** Bodovi ispita i rokova, pragovi, popravni/integralni, skala ocjena, rezultat i poništavanje, projekcija ocjene.
6. **AI temelj, uvoz i dokumenti.** LLM wrapper (Gemini za sad), `ai_runs`, uvoz akademskog kalendara i rasporeda ispita sa pregledom, dokumenti fakulteta i RAG.
7. **Timer i sesije.** Timer dugme, segmenti, offline red, kraj sesije, kalibracija.
8. **Scheduler.** `plan()`, `placeTimes()`, replan, deficit, prioritet, kampanja, meki rokovi predavanja, ručni blokovi, željena ocjena, “Danas” ekran.
9. **Recall gate, provjera znanja i FSRS.**
10. **AI sadržaj i asistent.** Uvoz sadržaja, pitanja i rasporeda nastave, merge pri ponovnom uvozu, recall pitanja, embeddings bilješki, chat asistent.
11. **Napredak.** Statistika, prognoza spremnosti i procjena ocjene, spremnost dan prije ispita, strategist.
12. **Notifikacije i dorada.** Web Push, pristupačnost, testovi end-to-end.

Kasnije: read-only demo nalog sa seed podacima za portfolio.

**Odluke**

| Pitanje | Odluka |
| --- | --- |
| Ime app-a | Hoot (radni naziv `study-planner` se ne koristi) |
| Scope | Bez MVP/v2 podjele; sve u prvoj verziji, demo nalog kasnije |
| “Danas” i satnica | “Danas” je lista; satnica poseban tab na zahtjev, keš preko `input_hash` |
| Parcijale | 1..n ispita po predmetu, svaki sa svojim obimom iz bilo kojeg izvora |
| Jezik | Bosanski i engleski (`react-i18next`) |
| AI provajder | Claude Haiku 5.5 iza LLM wrappera (Gemini podržan) |
| Backend | Supabase (Postgres + RLS, Auth, Storage, Edge Functions) |
| Teme | Uvijek: AI oznake pri uvozu, ručno ispravljive |
| Spaced repetition | FSRS (`ts-fsrs`) umjesto SM-2; ciljno zadržavanje po prioritetu; provjera i pročitanih jedinica; lični parametri kasnije iz `review_logs` |
| Prioritet i režim | Prioritet 1–5 mijenja udio vremena, rezanje kod deficita, buffer, ciljno zadržavanje i ciljnu pokrivenost; režim redovno / kampanja |
| Start kampanje | Računa ga `plan()` (ALAP unazad od ispita + margina), ručno promjenjiv i zaključan |
| Ručni blokovi | Dodaj, izmijeni, obriši; `origin = 'user'` zaključan od replana; brisanje AI bloka pita “prebaci” ili “izbaci iz plana” |
| Praćenje predavanja | “Dokle ste stigli?” nakon termina; meki rok u redovnom režimu; prijedlog po pravilu odmah, strategist sedmično |
| AI JSON | Structured outputs + `zodOutputFormat()`; šeme bez rekurzije |
| Rokovi | Sa procjenom sati ulaze u plan kao blokovi `deadline` |
| Ponovni uvoz | Merge po `label`; nestale jedinice se arhiviraju |
| Offline | Lokalni red u IndexedDB, klijentski UUID-ovi, idempotentni upsert |
| Kalendar | Vlastita mjesečna mreža (date-fns) umjesto FullCalendar-a, kao u mockupu |
| Kalibracija | Po izvoru × načinu učenja, uz povratak na vrijednost izvora dok nema 3 mjerenja |
| Granica dana | 04:00 po zoni korisnika, podesivo |
| Savjet na “Danas” | Svjež savjet strategista, inače “zašto ovo danas” iz scheduler-a |
| Timer dugme | Izbor sesije; nastavak ako sesija traje |
| Raspored nastave | Ručno ili slikom; automatski zauzeto; opcionalni recap 15 min; jedan semestar, parnost od početka semestra |
| Kalendar prikazi | Mjesec / Sedmica / Dan; nastava samo u listi dana i na vremenskoj osi, ne kao tačkica u mjesecu |
| “Dokle ste stigli?” | Samo nakon predavanja; kartica do kraja dana; ostalo ručno na predmetu |
| Bodovi | Bodovi ili procenti po stavci; zadnji izlazak vrijedi; popravni vezan za ispit, integralni zamjenjuje parcijale; poništavanje = odricanje |
| Željena ocjena | Podiže ciljnu pokrivenost u `plan()`; prioritet se samo predlaže |
| Akademski kalendar | Periodi nastave, sedmice parcijalnih, ispitni rokovi, neradni dani; ručno (Etapa 4) i AI uvoz (Etapa 6); bez datuma konkretnih ispita |
| Ispit bez datuma | Bira se rok iz akademskog kalendara; raspon roka = okvirni raspon ispita |
| AI provajder za sad | Gemini Flash free tier iza wrappera dok Anthropic nema karticu |
| Uvoz i asistent | Prvo uvoz sa pregledom (Etapa 6), chat asistent na istim alatima kasnije (Etapa 10); AI nikad ne piše direktno |
| RAG | Dokumenti fakulteta (čuvaju se) + bilješke i jedinice (embeddings `gte-small`) + sažetak stanja plana |
