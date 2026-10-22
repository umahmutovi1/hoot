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
| Opće | Onboarding | Od imena do realne sedmice za ~3 min: uvoz (kalendar, raspored, povezani kalendari), ritam, dani i periodi, dnevni maksimum, predložak sesije, prvi predmet, pregled “stižeš li”; svaki korak preskočiv |
| Predmeti | Predmet + ispiti | Predmet sa nazivom, bojom i 1..n ispita (preset: samo završni / parcijale + integralni / prilagođeno) za < 30 s |
| Predmeti | Rokovi | Seminarski, zadaće, vlastiti rok; opcionalna procjena sati ulazi u plan |
| Predmeti | Prioritet i režim | Prioritet 1–5 (5 = uslovni); režim redovno ili kampanja; start kampanje izračunat, ručno promjenjiv |
| Predmeti | Praćenje predavanja | Nakon termina “Dokle ste stigli?” jednim tapom; zaostatak u satima; prijedlog akcije kad pređe prag |
| Predmeti | Bodovi i skala ocjena | Ispit i rok nose bodove ili procente, opcionalni prag za prolaz i uslov za izlazak; popravni je vezan za ispit koji ponavlja; skala ocjena po predmetu (default 55/65/75/85/95) |
| Predmeti | Projekcija ocjene | “Imam X od Y”, koliko treba na preostalim ispitima za svaku ocjenu i za željenu ocjenu; rezultat se može poništiti (odricanje) |
| Raspored | Akademski kalendar | Periodi nastave, sedmice parcijalnih, ispitni rokovi (redovni/popravni), neradni dani; ručno ili AI uvoz; “7. sedmica nastave” na Danas |
| Uvoz | Uvoz sa pregledom | Tekst, slika ili PDF → akademski kalendar ili raspored ispita; pregled novo/izmijenjeno prije snimanja |
| Uvoz | Dokumenti i sova (agent) | Dokumenti fakulteta sa pretragom (RAG, citat izvora); sova na dnu ekrana Danas je jedan ulaz za pitanja i dokumente, prijedlozi izmjena kao kartice |
| Predmeti | Izvori više tipova | 0..n izvora: knjiga, skripta, pitanja, prezentacije, ostalo |
| Uvoz | Slikaj sadržaj | Slika sadržaja → jedinice sa stranicama, podjedinicama, težinom i temama; pregled prije snimanja |
| Uvoz | Ručni unos | Paste ili jedna linija po jedinici; isti parser |
| Uvoz | Ispitna pitanja | Slika ili paste → jedinice tipa pitanje, sa temama |
| Uvoz | Ponovni uvoz | Spajanje po oznaci; napredak, bilješke i sesije se ne gube |
| Uvoz | Obim ispita | Za svaki tip izvora: I / II / oba / ne ulazi; AI prijedlog, ručna izmjena zaključana |
| Uvoz | Teme | AI označi teme pri uvozu; ručno ispravljive; povezuju pitanja i poglavlja |
| Raspored | Raspored nastave | Ručno ili slikom; predavanja, vježbe, labovi, parne/neparne sedmice; automatski zauzeto |
| Raspored | Dostupnost | Sedmični slobodni termini + izuzeci za konkretne dane |
| Raspored | Povezani kalendari | Google / Apple / Outlook iCal link → zauzeto u planu; Moodle iCal link → prijedlozi rokova sa pregledom |
| Plan | “Danas” ekran | Fokus bar dana, kartica “Sljedeći blok”, lista blokova, 3 najranija ispita, “zašto ovo danas”; najviše jedna kartica akcije iznad liste |
| Plan | Brze akcije dana | “Danas ne mogu” (dan zauzet + replan) i “Imam samo 30 min” (najvredniji komad za to vrijeme) |
| Plan | Kalendar | Mjesec i dan: ispiti, rokovi, nastava i planirani dani |
| Plan | Satnica | Svaki blok automatski dobije predloženo vrijeme i pauze po predlošku sesije; tab Satnica prikazuje i dozvoljava pomjeranje |
| Plan | Replan | Propušteno se preraspodijeli od sutra uz limit dnevnog rasta; deficit sa 3 opcije; “novi početak” |
| Plan | Izvoz u kalendar | ICS pretplata na ispite, rokove i blokove |
| Plan | Ručni blokovi | Dodaj, izmijeni, obriši blok; ručni i izmijenjeni blokovi su zaključani od replana |
| Učenje | Timer dugme | Izbor: sljedeći blok (preporučeno), drugi blok danas, slobodna sesija; nastavak aktivne sesije |
| Učenje | Timer sesije | Segmenti u bazi, pauza, “Sad radim na”, predlošci sesije (Standardno 50/15 default, Pomodoro 25/5 + duga pauza, Flowtime, vlastiti niz, slobodno); radi offline |
| Učenje | Kraj sesije | Težina 1–5 po jedinici, fokus 1–3 (uz opcionalne razloge kad je 1), refleksija |
| Učenje | Recall gate | Test iz ispitnih pitanja, bilješki, podnaslova, blurtinga, kartica ili općeg znanja |
| Učenje | Spaced repetition | FSRS po jedinici; ciljno zadržavanje po prioritetu predmeta |
| Učenje | Jačina znanja | Procjena “koliko se sjećaš danas” po jedinici, temi, predmetu i ispitu; provjera kad padne ispod cilja |
| Učenje | Notes i kartice | Markdown bilješke po jedinici; kartice pitanje–odgovor |
| Učenje | Kvizovi | Isti alat kao recall pitanja (`recall-questions`, način “kviz”: 5–10 pitanja iz bilješki ili slike stranice); odgovori idu u `review_logs`, pitanje se može spasiti kao kartica |
| Napredak | Progres | Po izvoru, ispitu, predmetu i temi |
| Napredak | Statistika | Sati vs plan, ispunjenost, fokus, efikasnost po dobu dana, poređenje predložaka sesije |
| Napredak | Termini učenja | App uči kad ti učenje ide (fokus, brzina, odrađeni blokovi) i predlaže izmjene dostupnosti; teško gradivo ide u najbolje termine |
| Napredak | Prognoza spremnosti | “Vjerovatno 75–90% · 70% šanse da stigneš obavezno”, svaki dan; procjena ocjene iz prognoze |
| Napredak | AI strategist | Sedmični pregled i najviše 3 akcije koje korisnik odobri |
| Opće | Notifikacije | Prvi blok dana, kraj pauze, propušten blok, ponavljanje na redu |
| Uvoz | Dijeljenje u Hoot | “Podijeli” PDF ili sliku iz druge aplikacije direktno sovi (PWA Web Share Target, Android) |
| Opće | Izvoz | Kartice kao CSV (Anki), svi podaci kao JSON |
| Opće | Jezik | Bosanski i engleski |
| Opće | Rezultat ispita | Bodovi (Etapa 5) + spremnost dan prije (Napredak); zatvara krug za prognozu |

## Ključni tokovi

**0. Onboarding** (detalji u sekciji Onboarding)

1. Ime i jezik; vremenska zona iz browsera.
2. Uvoz onoga što postoji: akademski kalendar, raspored nastave, povezani kalendari (iCal link). Prvo uvoz, pa dostupnost, da se zauzeto odmah vidi.
3. Ritam: kad ustaješ i liježeš, kad ti je najlakše učiti.
4. Dani i periodi učenja na vremenskoj osi (zauzeto šrafirano), pa dnevni maksimum.
5. Predložak sesije (default Standardno 50/15).
6. Prvi predmet sa ispitom i grubom veličinom gradiva (opcionalno), pa pregled “Tvoja sedmica”.

**1. Novi predmet**

1. Naziv, boja, preset ispita (samo završni / parcijale + integralni / prilagođeno), datum i format svakog ispita. Ispit može biti “samo ako zatreba” (integralni, popravni) i imati okvirni datum.
2. Opcionalno, pod sklopljenim “Napredno”: prioritet (default 3) i režim (default redovno). Defaulti čuvaju kriterij < 30 s.
3. App nudi “Dodaj izvor” ili **grubu veličinu gradiva** (“~300 str. skripte”, “~40 slajdova”, “~20 h”); oboje se može preskočiti.
4. Gruba veličina pravi privremeni izvor (`sources.is_rough = true`) sa N jednakih jedinica (oznake `~1`…`~N`, po ~10 str. ili ~1 h), pa predmet odmah ulazi u plan. Kad se doda pravi sadržaj, privremeni izvor se arhivira, a minute i sesije ostaju u historiji. Na predmetu stoji “Procjena je gruba · Dodaj sadržaj”.
5. Bez izvora i bez grube veličine predmet ima samo rokove u kalendaru; plan ga ignoriše i to kaže na predmetu (“Nije u planu: dodaj gradivo”).

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

**5. Lični faktor brzine (prior za nove izvore).** Novi izvor ne kreće od čiste heuristike tipa nego od heuristike × korisnikov faktor f, jer ko je sporiji na jednoj knjizi vjerovatno je sporiji i na sljedećoj. f je prosjek omjera `baza_izmjereno / baza_tip` po izvorima istog tipa (pa svih tipova kao fallback), ublažen brojem izvora j sa bar 3 mjerenja:

```latex
f = \frac{j}{j+2} \cdot \overline{\left(\frac{baza_{izmjereno}}{baza_{tip}}\right)} + \frac{2}{j+2} \cdot 1 \qquad baza_{tip}' = baza_{tip} \times f
```

`baza_{tip}'` zamjenjuje `baza_{tip}` u formuli iznad (i u priorima para izvor × način). f se računa iz istih podataka kao kalibracija (ne snima se zasebno) i ulazi u `input_hash` preko kalibrisanih brzina. Jezik izvora (`sources.language`, `bs` / `en` / ostalo) je opcionalni dodatni ključ grupisanja kad ima dovoljno izvora po jeziku (Kasnije).

**Podjela uloga.** Timer određuje koliko vremena treba (satnica). Ocjena određuje koliko je bilo teško shvatiti (prioritet ponavljanja i korekcija težine). Ne spajaju se u jedan broj.

**Način učenja.** Svaka sesija ima `mode` (čitanje, zadaci, ponavljanje, pitanja). Kalibracija se vodi po paru izvor × način: blok čitanja koristi izmjerenu brzinu čitanja, a blok ponavljanja onu iz ponavljanja. Dok par nema bar 3 mjerenja, koristi se vrijednost izvora za sve načine.

**Prije mjerenja (odluka, Etapa 7).** Dok izvor nema bar 3 završene sesije, app ne obećava obim: plan interno koristi heuristiku da rasporedi blokove, ali blok i sesija prikazuju samo predloženo trajanje (“predloženo 45 min”), a na kraju sesije korisnik upiše dokle je stigao. Od 3. sesije izvor prikazuje vlastitu procjenu obima (“str. 75–95”), a shrinkage iznad postepeno daje sve veću težinu mjerenjima.

- **Prvi prolaz ili ponavljanje** se ne bira nego čita iz statusa jedinice: jedinica koja još nije pređena = prvi prolaz, pređena ili “razumijem” = ponavljanje. Svaki ima svoju brzinu po izvoru (par izvor × način, uz fallback na izvor dok par nema 3 mjerenja). Na početku sesije može se ručno promijeniti.
- **Kraj sesije**: “do koje stranice” (stranica, slajd, pitanje ili jedinica; može i dio poglavlja), plus težina 1–5 po jedinici. Razlike između poglavlja dolaze iz izmjerenog vremena po poglavlju i ocjene težine, ne iz AI-ja.

**Izvor “Pitanja” (odluka, Etapa 7).** Pitanja se ne mjere vremenom nego uspjehom: koliko pitanja znaš odgovoriti (recall 0–2, FSRS jačina). Vrijeme po pitanju služi samo planu za kapacitet (heuristika pa prosjek iz sesija), ne prikazuje se kao procjena i ne kalibriše se po pitanju. Pitanja su vezana za poglavlja izvora (preko tema ili direktno); AI predloži veze (embeddings + `parse-questions`, Etapa 10), korisnik ih ispravi, a ručna veza se ne prepisuje. U sesiji, nakon čitanja ili ponavljanja poglavlja, app odmah ponudi pitanja iz te oblasti koja su unesena u app (recall gate, Etapa 9).

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

**Šta korisnik vidi (odluka nakon Etape 7).** Prioritet, željena ocjena, pojačanje i ciljna pokrivenost se u modelu preklapaju, pa UI pokazuje samo dva pojma u jednoj sekciji “Cilj” (na Predmetu i pod “Napredno” na NoviPredmet):

- **“Koliko ti je bitan”**: 5 imenovanih opcija bez brojeva (Lagano, Manje bitan, Standardno, Važan, Uslovni) sa opisom izabrane; čip na Predmetu prikazuje samo ime (“Važan”). Broj 1–5 ostaje samo u bazi i kodu.
- **“Željena ocjena”** (opcionalno, 6–10), pomjerena iz kartice “Bodovi i ocjena” u “Cilj”; kartica bodova je i dalje prikazuje kao istaknut red projekcije.
- **Usklađivanje na licu mjesta:** kad je željena ocjena ≥ 9, a bitnost ispod “Važan” (ili ocjena nedostižna), ispod polja stoji jedna rečenica sa dugmetom (“Za 9 obično treba ‘Važan’ · Promijeni”), umjesto zasebne kartice prijedloga. Kartica na Danas ostaje samo kad se stanje promijeni kasnije (rezultat ispita).
- **Nikad kao postavka:** težina hitnosti, ciljna pokrivenost, ciljno zadržavanje i buffer su posljedice izbora, ne polja. Vide se samo u “zašto ovo danas” i na Predmetu u sitnom tekstu ispod “Cilj” (“Plan pokriva 95% gradiva i ponavlja češće”).
- **Pojačanje** nije kontrola: nastaje samo iz prijedloga (“Uzmi vrijeme od …”) i na Predmetu se vidi kao privremeni čip (“+40 min dnevno do 28. okt”) sa ×.
- **Režim** ostaje zasebno pitanje (“Kad kreće učenje?”: od danas / kampanja pred ispit), jer opisuje kada, a ne koliko.

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

**Model.** Unos (`lecture_logs`) vezuje datum, predmet, opcionalno termin iz rasporeda, izvor i jedinicu “do ovdje” (`up_to_unit_id`). Pređenim jedinicama se smatraju sve nearhivirane jedinice tog izvora sa `position` do te jedinice (uključivo, sa podjedinicama). Novi unos za isti izvor pomjera granicu (vrijedi unos sa najkasnijim `on_date`, pa `created_at`); raniji unosi ostaju kao historija. `cancelled = true` znači da nastave nije bilo; to pravi izuzetak dostupnosti (`is_busy = false`, vrijeme termina, `lecture_log_id` na unos) koji oslobađa taj termin za taj dan. Brisanje unosa briše i taj izuzetak.

**Zaostatak** (`src/lib/pace/`, čista funkcija) = zbir minuta pređenih listova sa `level` 0. Minute su iste kao na ekranu izvora (`materialOf()` → `estimateUnits()`). Prikazuje se u mjeri izvora, ne u minutama: “Kasniš 15 str. (Oppenheim) · 4 pitanja”, a ispod sitno “~1h 40min učenja”. Mjera prati izvor (stranice, slajdovi, pitanja, jedinice; zbir `amount` pređenih listova sa `level` 0). Na predmetu: “Na predavanju: pogl. 5 · Ti: pogl. 3”, po jedan red za svaki izvor koji ima unos.

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

1. **Kapacitet.** Slobodne minute po danu = dostupnost − termini nastave (tačno vrijeme termina, osim otkazanih) − zauzeto iz povezanih kalendara − izuzeci − ručni blokovi. Kapacitet za plan = min(slobodno, dnevni maksimum) × ρ × rezerva:
   - **Faktor realizacije ρ** = odrađene / planirane minute AI blokova zadnjih 14 dana, ublažen prema 0.8: `ρ = (n·ρ_izmjereno + 7·0.8) / (n + 7)`, n = broj dana sa planom u tom prozoru; ograničen na [0.5, 1]. Dani “Danas ne mogu” i dani bez plana ne ulaze. Računa se u kodu (`src/lib/scheduler/`), ulazi u `input_hash`, a “zašto” ga imenuje (“planiram 80% jer zadnje 2 sedmice odradiš oko 80%”).
   - **Rezerva** = 0.9 (konstanta): i uz ρ = 1 jedan loš dan ne prevrne plan.
   - Kad ima dovoljno podataka (≥ 4 dana po danu u sedmici), ρ se računa i po danu u sedmici, uz shrinkage prema ukupnom ρ.
   - Pauze iz predloška sesije ne troše dnevni maksimum (on broji minute učenja), ali moraju stati u slobodne termine (vidi Lista vs satnica).
2. **Ponavljanja i provjere prvo.** Jedinice kojima je `next_review_on` danas ili ranije dobijaju blokove tipa `review` (vidi Spaced repetition), i za predmete u kampanji prije starta. Ponavljanja zauzimaju najviše `profiles.review_cap_pct` (default 40%) dnevnog kapaciteta; višak se slaže po bližem ispitu, pa po nižoj jačini, a ostatak prelazi na sljedeći dan. Uz uključen prekidač, dan sa predavanjem dobija blok `recap` od 15 min za taj predmet.
3. **Start kampanje.** Za predmete u kampanji izračuna se dan starta (vidi Prioritet i režim); prije njega njihove jedinice nisu u bazenu.
4. **Preostali rad po cilju.** Cilj je nepoložen, aktivan ispit (ne “samo ako zatreba” dok se ne aktivira) ili rok sa procjenom. Za jedinicu u obimu: level 0 → 100% minuta, level 1 → 40%, level 2+ → 0% (ide u ponavljanja). Pitanje: 0 → 100%, 1 → 50%. Jedinica pripada najranijem cilju koji je pokriva. Rad se dijeli na obavezan i opcionalan po ciljnoj pokrivenosti prioriteta. Planirane minute ručnih blokova za te jedinice oduzimaju se od preostalog rada.
5. **Meki rokovi s predavanja.** U redovnom režimu pređene jedinice dobijaju meki rok (vidi Praćenje predavanja).
6. **Buffer.** Zadnjih N dana prije ispita (postavke, +1 za prioritet 5) samo ponavljanje i pitanja iz obima.
7. **Hitnost.** u = preostali rad / kapacitet do cilja × težina prioriteta. Dan se raspodijeli proporcionalno hitnosti; najviše N predmeta dnevno, blok najmanje N minuta (postavke). Opcionalan rad ide tek kad obavezan stane. Dužina bloka teži višekratniku intervala učenja iz predloška sesije (50 + 50, ne 70), da se blok i podsjetnik na pauzu poklapaju.
   - **Mikro-blokovi.** Slobodni termini kraći od `min_block_minutes` (rupe između predavanja, 10–20 min) primaju samo `review` blokove i kartice; prvo učenje nikad.
   - **Limit rasta.** Planirane minute dana ne prelaze 1.25 × prosjek odrađenih minuta zadnjih 7 dana (najmanje 60 min, i nikad iznad kapaciteta). Ono što ne stane ide u deficit sa 3 opcije, a ne u sutrašnji dan. Ovo važi samo za AI blokove; ručni blokovi i buffer pred ispitom se ne režu.
8. **Redoslijed.** Redoslijed iz sadržaja; prednost dobijaju jedinice sa niskom sigurnošću i teme sa mnogo ispitnih pitanja.
9. **Tip bloka.** `learn` za prvo učenje, `questions` kad je cilj u buffer zoni ili su poglavlja pređena a pitanja nisu, `deadline` za rokove.
10. **Punjenje.** Duga jedinica se dijeli po stranicama na više blokova.
11. **Deficit.** Plan se napravi i kad ne stane, uz `deficit` po cilju (samo obavezan rad). Opcije smanjenja obima kreću od najnižeg prioriteta.
12. **Prijedlozi.** Pravila zaostatka (`src/lib/pace/`), deficit, ispitni rok, termini učenja i realizacija daju listu prijedloga (promjene ulaza), koje “Danas” i predmet prikazuju kao kartice. “Danas” iznad liste blokova prikazuje najviše jednu karticu akcije (najhitniju); ostale su pod “Još N prijedloga”.
   - **Ispitni rok:** kad počinje ispitni period iz akademskog kalendara, kartica “Ulaziš u ispitni rok — povećati maksimum na 6 h do [kraj roka]?” (izuzeci dostupnosti, jedan tap).
   - **San pred ispit:** dan prije ispita nema blokova poslije `profiles.exam_eve_end_min` (default 23:00, podesivo); `placeTimes()` to poštuje, a buffer ionako ima samo ponavljanje.
   - **Novi početak:** kad ima ≥ 2 propuštena dana zaredom ili deficit naraste, umjesto liste propuštenog jedna kartica “Krenimo ispočetka” sa istim 3 opcije kao deficit (rasporedi / smanji obim / prihvati rizik). Tekst je neutralan (bez “zaostaješ”, bez streakova).
13. **Zašto ovo danas.** Svaki blok dobije kratko objašnjenje iz pravila koje ga je stavilo (npr. “ispit za 9 dana, Signali kasne 3h”, “uslovni predmet”, “kampanja počinje danas”, “pređeno na predavanju 12. okt”, “jačina pala na 72%”). Ovo je kartica savjeta na “Danas” ekranu kad nema svježeg savjeta strategista.

**Više ispita po predmetu.** Koraci 1–6 rade po ispitu, ne po predmetu: preostali rad i kapacitet računaju se do datuma svakog ispita nad njegovim obimom. Tako I parcijala dobije prioritet prije završnog, a gradivo II parcijale kreće tek kad je to potrebno.

**Lista vs satnica.** Plan se pravi u dva sloja:

1. `plan()` raspodijeli rad po danima → “Danas” lista.
2. `placeTimes()` odmah poslije `plan()` (odluka nakon Etape 7: automatski, ne na zahtjev) smjesti blokove svakog dana u slobodne termine → popuni `start_min` i `planned_start`. Ručni blokovi sa zadatim vremenom su fiksni; ostali se slažu oko njih. Tab “Satnica” samo prikazuje dan i dozvoljava pomjeranje bloka (pomjeren blok postaje ručni, kao u toku 7).

`placeTimes()` pravila:

- **Pauze.** Između blokova i unutar dugog bloka ostavlja pauzu po zadanom predlošku sesije (Standardno: 15 min nakon 50 min učenja; Pomodoro: 5 min, duga pauza nakon 4 intervala). Blok + njegove pauze moraju stati u jedan slobodan termin; ako ne staju, blok se dijeli ili skraćuje na višekratnik intervala.
- **Termini učenja.** Svaki termin dana ima ocjenu (vidi Termini učenja). Prvo učenje i jedinice sa višom težinom idu u bolje ocijenjene termine; `review`, `recap`, prezentacije i kartice u slabije. Dok nema podataka, ocjena je prior iz onboardinga (“kad ti je najlakše učiti”).
- **San pred ispit** i granica dana se poštuju.
- Isti ulaz daje isto vrijeme (determinizam); Thompson uzorkovanje u Terminima učenja koristi seed iz `input_hash`.

Oba koraka su kod, ne AI, pa su besplatni. Prije računanja pravi se `input_hash` (jedinice, nivoi, procjene, FSRS stanje, ispiti, obim, dostupnost, raspored, zauzeto iz povezanih kalendara, unosi predavanja, prioriteti, režimi, ručni start kampanje, ručni blokovi, faktor realizacije, ocjene termina, zadani predložak sesije, postavke); ako je isti kao u zadnjem `plan_runs`, koristi se postojeći plan i ništa se ne računa. AI se zove samo za strategist, i to ručno ili sedmično.

**Ista jedinica u danu.** Dijelovi iste duge jedinice (podjela po stranicama) smiju biti isti dan samo u istom ili susjednom bloku; ponavljanje (`review`) iste jedinice je najviše jednom dnevno.

**Brze akcije dana.**

- **“Danas ne mogu”** (Danas, jedan tap + undo): napravi `availability_days` za danas sa `slots = []`, današnji AI blokovi postaju `skipped` (ne “propušteno”), replan od sutra. Ne ulazi u ρ.
- **“Imam samo 30 min”** (Danas i PokreniSesiju; trajanje 15/30/45/60): čista funkcija `pickForTime(state, minutes)` izabere najvredniji komad (ponavljanje koje danas ističe sa najnižim R, pa najhitnija jedinica iz današnjeg plana, pa sljedeća po hitnosti), pa odmah ponudi start sesije. Ne mijenja plan; sesija se veže za blok ako ga pokrije.

**Ručni blokovi.** Blok sa `plan_blocks.origin = 'user'` napravio je ili izmijenio korisnik (vidi tok 7). Nema `plan_run_id`, troši kapacitet svog dana i njegove jedinice se računaju kao planirane. Replan ga nikad ne briše ni pomjera; kad prođe, postaje odrađen ili propušten kao svaki drugi blok.

**Replan je idempotentan.** Brišu se samo budući nezapočeti blokovi sa `origin = 'ai'`; odrađeni, propušteni i ručni ostaju. Isti ulaz uvijek daje isti plan, pa se može pokretati koliko god puta.

**Spaced repetition (FSRS).** Ponavljanja raspoređuje FSRS (biblioteka `ts-fsrs`, FSRS v6), algoritam koji koristi i Anki. Svaka jedinica u ponavljanju ima memorijsko stanje (stabilnost, težina); iz njega se za svaki dan računa **jačina znanja** R = vjerovatnoća da se jedinice sjećaš danas. Jačina opada iz dana u dan i nikad se ne snima, nego računa (kao progres).

- **Ulaz u ponavljanje.** Jedinica ulazi u FSRS prvim testom: recall gate pri “pročitano” ili, ako je gate preskočen, **provjerom pročitanog** koja se zakaže 2 dana nakon “pročitano” (`next_review_on`). Tako i pročitano-a-netestirano gradivo slabi i traži provjeru.
- **Ocjena.** `recall` 0–2 se mapira na FSRS ocjene: 0 → Again, 1 → Hard, 2 → Good.
- **Ishod.** 2 na provjeri pročitanog ili recall gate-u → level 2. 0 na jedinici level 2+ → level 1, pa se vraća u učenje (40% minuta u koraku 4). 0 na provjeri pročitanog → ostaje level 1 i dobija novi `learn` blok.
- **Kada je provjera na redu.** `next_review_on` = dan kad R padne ispod ciljnog zadržavanja predmeta (0.80–0.90 po prioritetu).
- **Rotacija.** Predmet u kampanji prije starta ima samo ponavljanja već naučenog, bez novog učenja; jedinica koju ne pokriva nijedan aktivan nadolazeći ispit ne dobija ponavljanja.
- Datum ponavljanja nikad ne prelazi ispit: ako bi pao iza, zamijeni se ponavljanjem u buffer danu.
- **Cilj je jačina na dan ispita.** Za svaku jedinicu u obimu ispita računa se predviđeni R(datum ispita) iz trenutnog FSRS stanja. Ako je ispod ciljnog zadržavanja, a sljedeće ponavljanje ne bi palo prije ispita, zakaže se ponavljanje u bufferu ili zadnjem danu prije buffera. Prognoza spremnosti i procjena ocjene koriste R na dan ispita, ne današnji.
- **Poglavlje nije kartica.** FSRS default parametri su naučeni na kratkim karticama. Za poglavlja (`unit_kind = 'chapter'`) ocjena dolazi iz najpreciznijeg dostupnog testa (podnaslovi: % objašnjenih → 0/1/2; ostalo 0–2), a ciljno zadržavanje je za 0.03 više od tabele prioriteta (najviše 0.93). Pitanja (`unit_kind = 'question'`) i **kartice** su zasebni FSRS objekti: kartice dobijaju iste FSRS kolone kao jedinice (`0017_fsrs.sql`) i svoje ponavljanje u `review` blokovima, a jačina jedinice uključuje i njene kartice (ponderisano kao jedna jedinica).
- Nakon 4 uspješna ponavljanja (`fsrs_reps`, bez lapsa u međuvremenu) jedinica prelazi na level 3 (“Ponovljeno”).
- **Jačina na ekranima.** Jedinica: R. Tema, izvor, predmet, ispit: prosjek R ponderisan minutama jedinica (ista logika kao progres), samo nad jedinicama koje su ušle u ponavljanje. Prikazuje se uz progres, ne umjesto njega. Skala u UI: 85%+ Jako, 75–84% Dobro, 60–74% Slabi, ispod 60% Zaboravlja se.
- **Provjera znanja.** `review` blok se radi kao niz recall gate-ova (ekran “Provjera znanja”), sa sažetkom promjene jačine na kraju.
- Svako ponavljanje se bilježi u `review_logs` (izvor pitanja, ishod, proteklo dana, stabilnost prije i poslije). Iz toga se kasnije mogu optimizovati lični FSRS parametri (`profiles.fsrs_params`, optimizer `@open-spaced-repetition/binding`), bez gubitka historije. Dok toga nema, koriste se default parametri.

**AI strategist**

- Pokreće se sedmično (nedjelja, pri prvom otvaranju) ili na dugme. Ulaz je kompaktan JSON sažetak (\~1–2k tokena): ciljevi, prioriteti i režimi, progres, jačina po temama, deficit, zaostatak po predavanjima, propušteni blokovi, faktor realizacije, ocjene termina, slabe teme, refleksije zadnjih 7 dana.
- **Pravila predlažu, LLM bira i objašnjava.** Kandidate akcija pravi kod (`src/lib/strategist/`: pravila zaostatka, deficita, gužve ispita, realizacije, termina, “čitanje bez testa”), svaki sa unaprijed izračunatim efektom (razlika plana). LLM dobija kandidate, bira najviše 3 i piše sažetak, rizike i obrazloženje na jeziku korisnika; ne može izmisliti akciju koje nema među kandidatima (Zod: `candidate_id` iz liste).
- Izlaz je strukturiran JSON: sažetak, rizici i najviše 3 prijedloga sa tipom akcije (`reprioritize_unit`, `add_hours`, `drop_unit`, `change_buffer`, `avoid_slot`, `add_slot`, `set_priority`, `boost_priority`, `set_mode`, `set_campaign_start`).
- **Privatnost.** Dok je provajder Gemini free tier (Google može koristiti podatke), refleksije i razlozi niskog fokusa ne idu u prompt; šalju se samo agregati. Sa plaćenim provajderom idu uz prekidač u Postavkama (default uključeno).
- **Sedmični check-in** (nedjelja, isti ulaz kao strategist, ~2 min): potvrdi izuzetke za sljedeću sedmicu (put, rođendan, “ove sedmice radim više”), pogledaj prognozu, odobri do 3 akcije. Radi i bez AI-ja (samo kandidati iz pravila).
- Korisnik odobri prijedlog jednim tapom; kod ga primijeni i pokrene replan. AI nikad direktno ne piše blokove.
- Na “Danas” se prikazuje zadnji savjet strategista dok je svjež (do 3 dana), inače “zašto ovo danas” iz scheduler-a.

**Testovi.** `plan()` je glavni kandidat za unit testove (Vitest): prazna dostupnost, dva ispita isti dan, deficit, propušten dan, start kampanje, ručni start, dvije kampanje u istoj sedmici, ručni blok preživi replan, rezanje po prioritetu, ciljna pokrivenost, meki rok predavanja, limit ponavljanja, faktor realizacije i rezerva, limit rasta nakon propuštenog, “Danas ne mogu”, mikro-blokovi, pauze u satnici, san pred ispit, zauzetost iz povezanih kalendara. Invarijante (kapacitet se nikad ne prekorači, učenje + pauze stanu u slobodne termine, ručni blokovi se ne mijenjaju, isti ulaz = isti plan i ista satnica) provjeravaju se property testovima (`fast-check`). To je i dobar portfolio detalj.

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

**Odluke (Etapa 7)**

- **Režimi 25/5 i 50/10 su samo podsjetnik.** Značka odbrojava do pauze („pauza za 1:19“); kad istekne, piše „Vrijeme je za pauzu“ (uz vibraciju ako je ekran otvoren). Pauzu korisnik tapne sam; timer nikad sam ne zatvara ni ne otvara segment, jer browser u pozadini ne radi pouzdano. Tokom pauze značka odbrojava do kraja pauze. „Slobodno“ nema podsjetnik. (Etapa 8 zamjenjuje fiksne režime predlošcima, pravilo podsjetnika ostaje.)

**Predlošci sesije (odluka nakon Etape 7).** Režim timera postaje predložak: niz intervala učenja i pauze koji se ponavlja, sa opcionalnom dugom pauzom. Istraživanja ne daju jednog pobjednika (Pomodoro je kod [Smits i sar. 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12292963/) dao brži rast umora uz istu produktivnost kao pauze koje student bira sam), pa app nudi više predložaka i mjeri koji tebi daje bolji fokus i brzinu.

| Predložak | Učenje / pauza | Duga pauza |
| --- | --- | --- |
| **Standardno** (default) | 50 / 15 | — |
| Pomodoro | 25 / 5 | 20 min nakon 4 intervala |
| Flowtime | učiš dok hoćeš; pauza = učenje / 5 (najmanje 5, najviše 20 min), predložena kad tapneš pauzu | — |
| Vlastiti | niz koraka koji korisnik složi (npr. 45 → 10 → 45 → 20, ponovi), spašen pod imenom | opcionalno |
| Slobodno | bez podsjetnika | — |

- Model: `profiles.session_presets` (jsonb, vlastiti predlošci; ugrađeni su u kodu), `profiles.default_preset` (default `standard`), `study_sessions.timer_mode` = id predloška. Zod šema u `_shared/schemas.ts`; čista logika značke u `src/lib/session/timer.ts`.
- Izbor po sesiji u PokreniSesiju (zadnji korišten je predložen), default u Postavkama i onboardingu.
- **Kraj pauze sa zaključanim ekranom:** ulazak u pauzu upiše `break_ends_at` i zakaže Web Push za taj trenutak (edge funkcija `notify`); izlazak iz pauze ga otkaže. Do Web Push-a samo značka.
- Plan zna za pauze: `placeTimes()` ih rezerviše po zadanom predlošku (vidi Scheduler → Lista vs satnica).
- Statistika (Etapa 11) poredi predloške po fokusu i brzini (normalizovanoj težinom) i nakon bar 5 sesija po predlošku može predložiti promjenu defaulta.
- **Zaboravljen timer** se okida kad aktivni segment radi duže od 3 h (provjera pri otvaranju app-a i na ekranu sesije). Pitanje „Jesi li učila do sad?“ nudi „Da, nastavi“ (pitanje se zatvara) i „Ne, završila sam u HH:MM“ (default: početak segmenta + 25 min, između početka segmenta i sada): sesija se završi u to vrijeme i otvara se KrajSesije.
- **Kraj sesije** ima samo dugme „Spasi“ dok recall gate ne dođe u Etapi 9; tad se vraća par „Spasi i testiraj se“ / „Samo spasi“ iz mockupa.
- **Status jedinice na kraju sesije:** jedinica do čijeg je kraja korisnik stigao („do koje stranice“) dobije „Pročitano“ ako je bila nepočeta; čip uz jedinicu se tapom mijenja (Nije gotovo / Pročitano / Razumijem / Ponovljeno). Djelimično pređena jedinica zadržava status.
- **„Do koje stranice“ se pita na kraju svake sesije** (prije i poslije 3. sesije), predloženo do kraja zadnje jedinice na kojoj se radilo; od 3. sesije prijedlog dolazi iz plana bloka (Etapa 8).
- **Raspodjela minuta:** segment vezan za jedinicu pokriva tu jedinicu i pređene jedinice istog izvora iza nje do sljedeće jedinice koja ima svoj segment; minute se dijele srazmjerno procijenjenom vremenu pređenog dijela. Segmenti bez jedinice dijele se na sve pređene jedinice. Jedinica sa segmentom a bez pređenog obima zadrži minute, ali ne ulazi u kalibraciju.
- **Brzina izmjerena po jedinici** = minute / (pređeni obim × množitelj težine), pa se razlika u težini ne prelije u brzinu izvora. Kalibracija izvora i para izvor × način je prosjek tih brzina (k = broj jedinica sa zabilježenim vremenom); par se koristi tek od 3 mjerenja.
- **Slobodna sesija** do Etape 8: bira se predmet, opcionalno izvor i jedinica; preporučeni blok je prazan slot („Preporuka dolazi s planom“).
- **Historija sesija (odluka nakon Etape 7).** Ekran „Sesije“: lista po danima (granica dana), filter po predmetu, „+ Dodaj sesiju“. Ulazi: kartica „Sesije“ na Napretku (broj i minute ove sedmice) i red „Sesije“ na Predmetu (filtrirano na predmet).
- **Detalj sesije:** segmenti (od–do, jedinica) se mijenjaju, brišu i dodaju; početak i kraj sesije prate prvi i zadnji segment, a minute po jedinici se ponovo raspodijele uz isti pređeni obim. „Uredi ocjene“ otvara obrazac KrajSesije popunjen spašenim podacima (dokle si stigla, težina, status, fokus, refleksija). „Obriši sesiju“ briše sesiju sa segmentima; statusi jedinica se ne vraćaju sami.
- **Naknadno dodata sesija** (`study_sessions.origin = 'manual'`): predmet, datum, od–do, način; jedan segment, pa obrazac KrajSesije. Računa se u minute, napredak i status jedinica, ali ne u kalibraciju brzine (ručna vremena su gruba); u listi ima oznaku „ručno“.
- **Kalibracija se preračunava iz svih sesija.** Brzina izvora, par izvor × način i broj završenih sesija (`measured_sessions`) računaju se iznova iz svih spašenih `session_units` sesija sa timerom, nakon svakog kraja, izmjene ili brisanja sesije (kad je red prazan i ima mreže). Spašene kolone su keš tog izračuna.


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

**Granica dana.** “Dan” počinje u 04:00 po korisnikovoj vremenskoj zoni (`profiles.day_start_min`, `profiles.timezone`). Onboarding predlaže granicu iz uobičajenog vremena lijeganja (2 h poslije, najmanje 04:00), a zonu uzima iz browsera (`Intl.DateTimeFormat().resolvedOptions().timeZone`); kad se zona browsera razlikuje od spašene, Postavke pitaju da li je promijeniti. Učenje u 01:30 pripada prethodnom danu, a “prvo otvaranje novog dana” se računa od te granice. Sva polja `on_date` su lokalni datumi izračunati na ovaj način; timestampovi ostaju u UTC-u.

## Podaci za strategista

Strategist najviše dobija od podataka koje timer skuplja sam, plus dva tapa po sesiji i rezultata ispita koji zatvara krug. Ništa od ovoga ne traži dodatni AI poziv; agregati se računaju SQL-om i šalju strategistu kao kompaktan sažetak.

| Signal | Izvor | Unos | Šta strategist radi s tim |
| --- | --- | --- | --- |
| Efikasnost po dobu dana i danu u sedmici | segmenti (min po jedinici mjere) | pasivno | ulaz u ocjene termina (kod, vidi Termini učenja); strategist samo objašnjava |
| Pad efikasnosti kroz sesiju | segmenti | pasivno | predlaže predložak sesije |
| Pauze (broj, trajanje) | segmenti | pasivno | signal fokusa |
| Kašnjenje starta | `planned_start` bloka (uvijek popunjen, `placeTimes()` je automatski) vs stvarni start | pasivno | ocjene termina; prijedlog `avoid_slot` |
| Ispunjenost plana | blokovi done/missed | pasivno | faktor realizacije ρ u `plan()` (kod); strategist samo objašnjava |
| Razlog niskog fokusa | čipovi na kraju sesije kad je fokus 1 (umorna, telefon, buka, teško gradivo, loše spavala) | opcionalno, 1 tap | razdvaja “loš termin” od “teško gradivo” u ocjenama termina |
| Ometanja | dugme “Ometena sam” u sesiji (broj tapova) | 1 tap | signal fokusa po terminu |
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

Polja `mode`, `focus`, `planned_start`, rezultat ispita i tabela `review_logs` su u konsolidovanoj migraciji; `focus_reasons` i `distractions` dolaze u `0014`.

## Termini učenja (kad ti učenje ide)

App uči u kojim terminima ti učenje stvarno ide i koristi to u satnici i u prijedlozima dostupnosti. Sve je kod u `src/lib/slots/` (čista funkcija, testovi); LLM samo formuliše prijedlog. Efekat je stvaran: poklapanje zahtjevnog, analitičkog rada sa vrhom budnosti daje bolji učinak, posebno kod izraženih jutarnjih i večernjih tipova ([pregled](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2022.851502/full)).

**Termin** = dio dana × vrsta dana: jutro (do 12), podne (12–15), popodne (15–19), veče (19–23), noć (23–granica dana) × radni dan / vikend. Ispitni rok (iz akademskog kalendara) se računa odvojeno, jer mijenja ritam.

**Signali po terminu** (iz sesija sa timerom i AI blokova sa vremenom):

| Signal | Mjera | Napomena |
| --- | --- | --- |
| Fokus | prosjek 1–3 | sesije sa razlogom “teško gradivo” imaju pola težine |
| Brzina | izmjerena / očekivana brzina za to gradivo (kalibracija, uz težinu) | > 1 = sporije nego inače |
| Odrađenost | odrađen / planiran blok u tom terminu | Beta(α, β), prior Beta(4, 1) za termine iz onboardinga, Beta(2, 2) za ostale |
| Kašnjenje starta | minute od `planned_start` do prvog segmenta | > 30 min = djelimičan neuspjeh |

**Ocjena termina** = ponderisan zbir standardizovanih signala, svaki ublažen prema prioru brojem mjerenja (`k/(k+6)`, isti obrazac kao kalibracija). Prior dolazi iz onboardinga (“kad ti je najlakše učiti”). Za odrađenost se pri slaganju satnice uzorkuje iz Beta raspodjele (Thompson sampling sa seedom iz `input_hash`), da app povremeno isproba i termine koje ne bi izabrala, umjesto da zauvijek ostane u prvim izborima.

**Upotreba.**

- `placeTimes()`: teško gradivo i prvo učenje u bolje termine, ponavljanja i lakši sadržaj u slabije (vidi Lista vs satnica).
- Kartice prijedloga (promjene ulaza, jedan tap → replan), tek kad termin ima ≥ 6 mjerenja i jasnu razliku:
  - `avoid_slot`: “Utorkom ujutro ti propadne 4 od 5 blokova. Maknuti utorak 08–10 iz dostupnosti?”
  - `add_slot`: “Navečer ti je fokus 2.7/3. Dodati srijedu 21–23?”
- Napredak → Statistika: mapa termina (fokus i odrađenost), dok nema podataka “Uči se… (još N sesija)”.

**Zamke.** Brzina je normalizovana težinom (teško gradivo navečer ne smije izgledati kao loš termin); stari podaci slabe (polu-život 6 sedmica), jer se ritam mijenja kroz semestar.

## Prognoza spremnosti

Prognoza je raspon i vjerovatnoća, ne jedan broj. Čista funkcija `forecast()` u `src/lib/progress/` radi Monte Carlo simulaciju (1000 prolaza, seed iz `input_hash`, u browseru):

1. Za svaki preostali dan do ispita uzorkuje se odrađeni rad iz vlastite historije (bootstrap dnevnih odrađenih minuta zadnjih 28 dana, po radnom danu / vikendu; dok nema 7 dana historije, kapacitet × ρ uz ±30% šuma).
2. Rad se troši redom iz plana (isti redoslijed kao `plan()`).
3. Rezultat po ispitu: raspon pokrivenosti (10.–90. percentil) i P(obavezan rad pokriven do ispita).

Prikaz: “Vjerovatno 75–90% · 70% šanse da stigneš obavezno”. Procjena ocjene (vidi Projekcija ocjene) koristi istu simulaciju × R na dan ispita i prikazuje se kao raspon ocjena; `readiness_before` i rezultati pokazuju da li se korisnik sistematski precjenjuje (“obično se procijeniš za 1 ocjenu više”).

## Onboarding

Cilj: za ~3 minute od “Kako da te zovem?” do realne sedmice i, ako je unesen predmet, prvog bloka za danas. Iskustvo konkurencije je da korisnik koji završi onboarding na praznom ekranu često ništa ne unese, pa onboarding završava pregledom sedmice, ne praznim Danas.

- Svaki korak se može preskočiti; preskočeni ostaju kao checklist na DanasPrazno (“Još 2 koraka do tačnog plana”). Napredak se pamti (`profiles.onboarding_step`), pa se može nastaviti kasnije; `profiles.onboarded_at` se postavi na kraju ili na “Završi kasnije”.
- Redoslijed: prvo uvoz, pa dostupnost, da su nastava i ostale obaveze već šrafirane kad korisnik bira slobodne periode.
- Okidač `handle_new_user()` i dalje pravi default dostupnost (06–24) kao sigurnosnu mrežu; korak 4 je zamjenjuje.

| # | Korak | Pita | Upisuje |
| --- | --- | --- | --- |
| 1 | Ime i jezik | postoji (“Kako da te zovem?”) + jezik | `display_name`, `locale`, `timezone` iz browsera |
| 2 | “Šta već imaš?” | Kartice: akademski kalendar (PDF/slika/tekst kroz `parse-document`), raspored nastave (ručno; slikom od Etape 10), povezani kalendar (iCal link), “Nemam ništa sad” | `academic_periods`, `timetable_entries`, `calendar_feeds`. Raspored bez akademskog kalendara pita samo “Kad počinje i završava semestar?” i pravi period nastave |
| 3 | Ritam | “Kad obično ustaješ i liježeš?” (radni dan / vikend), “Kad ti je najlakše učiti?” (jutro / podne / popodne / veče / noć, više izbora) | `profiles.wake_min`, `sleep_min` (po 2: radni, vikend), `preferred_slots` (prior termina), prijedlog `day_start_min` |
| 4 | Dani i periodi | Sedmica sa vremenskom osom: zauzeto šrafirano, predloženi periodi (budan − zauzeto, naglašeni najlakši termini). Tap uključi ili isključi dan; čipovi jutro / popodne / veče ili prevlačenje | `availability_rules` (zamjenjuju default) |
| 5 | Koliko najviše | Klizač po grupi dana (radni / vikend), uz sedmični zbir (“To je 17 h sedmično”) i tekst “Plan ostavlja rezervu, bolje realno nego idealno” | `daily_cap_min` |
| 6 | Pauze | Predložak sesije (Standardno 50/15 označeno) | `default_preset` |
| 7 | Prvi predmet | Naziv, ispit i datum (ili rok iz kalendara), gruba veličina gradiva | predmet, ispit, privremeni izvor |
| 8 | “Tvoja sedmica” | Pregled: slobodno X h sedmično, potrebno Y h do prvog ispita, “stižeš” ili “fali 6 h” + prvi blok za danas | — |

Mockupi `design/Onboarding.dc.html` … `design/OnboardingSedmica.dc.html` (svi koraci kao stanja jedne komponente), bez maskote.

**Gruba veličina gradiva (odluke, Etapa 8a).** Malo / Srednje / Puno = ~10 / 25 / 45 h, kao privremeni izvor (`sources.is_rough`, vrsta „Ostalo“) od dijelova od po 1 h. Dodavanje pravog izvora arhivira njegove dijelove. **Obim po ispitima (odluka za 8b):** dijelovi privremenog izvora se dijele redom po parcijalama predmeta koje nisu „samo ako zatreba“ (sa dvije parcijale: prva polovina I parcijali, druga II), a završni i integralni obuhvataju sve; ručna izmjena obima i dalje ima prednost. Postojeći korisnici (sa potvrđenim imenom) se pri migraciji `0014` računaju kao da su prošli onboarding.

## Povezani kalendari i integracije

Google, Apple iCloud, Outlook i Moodle izvoze kalendar kao iCal (ICS) link, pa jedan mehanizam pokriva sva četiri izvora bez OAuth-a.

**Uvoz (`calendar_feeds`).** Korisnik zalijepi tajni iCal link i izabere vrstu:

- **Zauzetost** (`busy`): Google (Postavke kalendara → “Tajna adresa u iCal formatu”), Outlook (“Objavi kalendar” → ICS), iCloud (javni link). Događaji su zauzeto vrijeme u planu, kao nastava.
- **Rokovi** (`deadlines`): Moodle (Kalendar → Izvoz → “Dobij URL kalendara”; link sadrži `authtoken` i radi bez prijave, [Moodle docs](https://docs.moodle.org/403/en/Calendar_export)). Događaji ne prave zauzetost nego karticu “3 nova roka iz Moodlea” sa pregledom novo / izmijenjeno / preskačem → `deadlines`; predmet se uparuje preko `fuse.js` kao kod uvoza rasporeda, jer Moodle URL ne može biti ograničen na jedan predmet.

**Sinhronizacija.** Edge funkcija `sync-calendar` (browser ne može povući feed zbog CORS-a): povuče feed, parsira, raširi ponavljanja (RRULE, EXDATE, RECURRENCE-ID) za horizont od 120 dana i upsert po `uid` + početku u `external_events`; nestali događaji se brišu. Okidači: otvaranje app-a (najviše jednom u 30 min) i `pg_cron` svaka 3 h. Greška se upiše u `last_error` i prikaže na feedu; plan koristi zadnje uspješno stanje. Bez LLM poziva; ne broji se u AI limit.

**Pravila.**

- Cjelodnevni događaji (rođendani, praznici) po defaultu nisu zauzeti, samo se prikazuju; prekidač po feedu.
- Događaji označeni kao slobodni (`TRANSP:TRANSPARENT`) i otkazani (`STATUS:CANCELLED`) ne blokiraju.
- Pojedinačan događaj se može označiti “ignoriši” (`external_events.ignored`); ponovna sinhronizacija to čuva.
- Prekidač “Spremaj samo zauzeto” po feedu: naslov i lokacija se ne spremaju (privatnost).
- Tajni link je lozinka: čuva se samo u `calendar_feeds.url` (RLS), nikad u logovima, `ai_runs` ni klijentskom kešu osim maskiranog prikaza.

**Plan.** Zauzetost iz feedova ulazi u neto dostupnost u `src/lib/schedule/` kao nastava (isto upozorenje kod preklapanja i “Učim umjesto ovoga”), pa i u `input_hash`; promjena nakon sinhronizacije pokreće replan (debounce 2 s). Na vremenskoj osi Dostupnosti i u kalendaru događaji su šrafirani sa oznakom izvora (“iz Google kalendara”).

**UI.** Postavke → “Povezani kalendari” (lista, dodaj, vrsta, boja, zadnja sinhronizacija, prekidači, ukloni) i korak 2 onboardinga. Uz polje za link kratko uputstvo po servisu.

**Izvoz plana (ICS pretplata).** Edge funkcija `calendar-feed` servira ICS sa tajnim tokenom (`profiles.ics_token`, može se obnoviti): ispiti, rokovi i (prekidač) blokovi plana. Google osvježava pretplaćene kalendare tek svakih ~8–24 h, pa blokovi tamo kasne; app to kaže uz prekidač. Upis blokova odmah (Google Calendar API, OAuth) je “Kasnije”: u Testing režimu Google refresh token ističe za 7 dana, a produkcija traži verifikaciju.

**Ostale integracije.**

| Integracija | Odluka |
| --- | --- |
| Web Share Target (PWA) | “Podijeli” PDF ili sliku iz Vibera, WhatsAppa, Moodle app-a ili Gmaila → “Daj sovi dokument” sa prilogom. Radi na Androidu (Chrome); iOS PWA ga ne podržava, tamo ostaje +. Etapa 10 |
| Notion | Bez integracije u v1: stranica se kopira i zalijepi sovi (tekst kroz `parse-document`). Javna Notion integracija (baza rokova) Kasnije, samo ako zatreba |
| Anki / Quizlet | Izvoz kartica kao CSV (Anki ga uvozi); uvoz teksta “pojam ⇥ definicija” kao kartice. Bez API-ja (Quizlet ga nema, AnkiConnect radi samo lokalno). Etapa 10 |
| Microsoft Teams, Google Classroom | Ne: traže školski račun i često saglasnost admina. Rokovi iz Teamsa/Outlooka idu kroz Outlook ICS |
| Zamger i drugi fakultetski sistemi | Ne: nema javnog API-ja. Rezultati se unose ručno ili kroz sovu (slika, paste) |

## Tehnike učenja ugrađene u app

Dvije tehnike sa najjačim dokazima su samotestiranje i raspoređeno učenje; app ih ne nudi kao opciju nego ih ugrađuje u tok. Ostale (pauze, miješanje tema) su opcionalne jer su dokazi miješani.

| Tehnika | Dokazi | Kako u app-u |
| --- | --- | --- |
| Samotestiranje (active recall) | Najviša ocjena u pregledu 10 tehnika ([Dunlosky et al. 2013](https://www.psychologicalscience.org/news/releases/which-study-strategies-make-the-grade.html)); u RCT-u sa specijalizantima ponovljeno testiranje dalo je bolje pamćenje nakon 6 mjeseci od ponovljenog čitanja ([Larsen et al. 2009](https://www.learningscientists.org/learning-scientists-podcast/2018/5/16/episode-19-bite-size-research-on-benefits-of-retrieval-with-medical-residents)) | Jedinica ne može na level 2 (“razumijem”) samo čitanjem: traži se kratki test (vidi “Recall gate”) |
| Raspoređeno učenje + spaced repetition | Takođe najviša ocjena kod Dunloskog; kod studenata medicine dnevna upotreba Anki-ja povezana sa višim Step 1 rezultatima ([Wothe et al. 2023](https://doaj.org/article/7aaf357db5d54ad39fea3f672ad5aae4)), ali to su korelacijske studije | Scheduler ne stavlja istu jedinicu više od jednom dnevno; ponavljanja iz `review_logs` |
| Feedback nakon testa | Testiranje sa korektivnim feedbackom daje najbolje učenje ([pregled](https://texasldcenter.org/?p=346)) | Nakon odgovora odmah se prikaže tačan odgovor ili notes, pa korisnik ocijeni recall 0–2 |
| Sistemske pauze (Pomodoro) | Unaprijed zadane pauze dale su bolju koncentraciju i motivaciju i sličan učinak za kraće vrijeme ([Biwer et al. 2023](https://nufind.nu.edu.sa/EdsRecord/eric,EJ1386535)); novija studija našla je brži rast umora uz Pomodoro, bez razlike na kraju ([Behavioral Sciences 2025](https://www.mdpi.com/2076-328X/15/7/861)) | Predlošci sesije: Standardno 50/15 (default), Pomodoro, Flowtime, vlastiti, slobodno; pauze su u satnici. App mjeri koji predložak tebi daje bolju efikasnost i fokus |
| Namjera “kad i gdje” (implementation intentions) | Plan sa konkretnim vremenom i mjestom povećava šansu da se namjera izvrši (Gollwitzer) | Svaki blok ima predloženo vrijeme; opcionalno mjesto (Kasnije) |
| Novi početak (fresh start) | Početak sedmice ili nakon pauze je prirodan trenutak za novi pokušaj (Dai, Milkman, Riis 2014) | Kartica “Krenimo ispočetka” umjesto liste propuštenog; bez streakova i kazni |
| Miješanje tema (interleaving) | Miješani dokazi u medicini: kod EKG-a je na odgođenom testu blokirana vježba bila bolja od miješane ([Monteiro et al. 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5542896)) | Samo u blokovima ponavljanja i pitanja, nikad pri prvom učenju; default isključeno, uključuje se samo u Postavkama |
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

**Odluka nakon Etape 7:** svih sedam izvora testiranja iz tabele ulazi u v1 (ništa se ne izbacuje). Ispitna pitanja, bilješke bez AI-ja, podnaslovi, blurting i kartice dolaze u Etapi 9; AI pitanja iz bilješki, slika stranice i opće znanje u Etapi 10 kroz `recall-questions`. **Kviz nije zaseban alat:** to je `recall-questions` sa više pitanja (5–10) nad bilješkama ili slikom stranice, pokrenut sa Jedinice ili iz sesije; ocjena svakog odgovora ide u `review_logs` (`source` = `notes` ili `page_photo`) i FSRS kao kod recall gate-a, a pitanje se jednim tapom spašava kao kartica. AI zadatak `quiz` ostaje u enumu `ai_task` (vrijednost enuma se ne briše), ali se ne koristi.

`review_logs.source`, `units.answer` i tabela `cards` su u konsolidovanoj migraciji.

## Raspored nastave

Korisnik unosi predavanja, vježbe i labove (ručno ili slikom rasporeda, isti AI pipeline kao za sadržaj). Ovo je MVP jer bez toga dostupnost ručno dupla raspored.

- Termini nastave su automatski zauzeti, tačno u svom vremenu (bez margine za dolazak i odlazak, odluka nakon prvog pregleda); dostupnost ih ne mora ponavljati.
- Prikazuju se u kalendaru i satnici kao “iz rasporeda nastave”.
- Opcija “kratko ponavljanje nakon predavanja”: 15 min istog dana za taj predmet, prvi korak raspoređenog učenja.
- Nakon svakog termina app pita “Dokle ste stigli?” (vidi Praćenje predavanja); otkazan termin se oslobađa za učenje.
- Podržane parne/neparne sedmice (lab) i period važenja (semestar).

**Semestar.** Raspored važi za jedan period nastave iz akademskog kalendara (vidi ispod). Termin pamti period (`period_id`), a njegovi datumi se upisuju u `valid_from` / `valid_to` svakog termina (i ažuriraju kad se period promijeni). Parnost sedmica se broji od početka perioda nastave: sedmica (pon–ned) u kojoj nastava počinje je 1. (neparna). Na neradni dan termini se ne održavaju.

**Dostupnost.** Dvije stvari, obje sa sedmičnim šablonom i izmjenom za konkretan datum:

- **Kad možeš učiti** (termini). Default je uvijek osim 00:00–06:00 (06–24 svaki dan); novi korisnik ga dobija automatski kao sigurnosnu mrežu, a onboarding ga zamjenjuje stvarnim periodima (vidi Onboarding). Zauzetost iz povezanih kalendara se oduzima kao nastava. Termini nastave (tačno vrijeme termina) se oduzimaju sami, pa šablon ne treba prilagođavati rasporedu.
- **Koliko najviše dnevno** (dnevni maksimum učenja, `profiles.daily_cap_min`, po danu u sedmici). Default 3 h radnim danima, 5 h vikendom. Plan nikad ne prelazi ni slobodne termine ni maksimum.
- **Konkretan datum** (`availability_days`): termini i/ili maksimum samo za taj dan zamjenjuju šablon (npr. jedan ponedjeljak manje vremena, “zauzeta cijeli dan” = dan bez termina). Pri izmjeni app pita “Samo ovaj dan” ili “Svaki [ponedjeljak]”, kao kod ponavljajućih događaja u kalendaru.
- **Preko nastave**: termin dostupnosti smije preklapati nastavu, uz upozorenje “U ovom terminu imaš Signali · predavanje 09:00–11:00” i prekidač “Učim umjesto nastave”. Bez prekidača nastava i dalje blokira taj dio; sa njim se taj dio računa kao slobodan.
- **Ekran**: sedmica sa datumima (traka dana, strelice) i vremenska osa izabranog dana: termini dostupnosti, nastava (šrafirano, “iz rasporeda”), slobodno i maksimum tog dana; ispod šablon po danu u sedmici i lista datuma sa izmjenama. Izmjene se spašavaju odmah; replan na izmjenu dolazi sa schedulerom.
- “Nastava otkazana” i dalje pravi izuzetak (`availability_exceptions`, `lecture_log_id`) koji oslobađa vrijeme termina.

**Kalendar.** Plan ima dva prikaza: Mjesec (postojeća mreža) i Dan (sedmični prikaz je izbačen nakon pregleda). U mjesečnoj mreži nastava nema tačkice (bila bi na skoro svakom danu); termini nastave su u listi izabranog dana, otkazani precrtani. Dan: traka dana kao pilule (izabrani dan taman) i vremenska osa sa karticama u boji predmeta (nastava, kasnije blokovi plana). Tačkice aktivnosti (ispiti, mogući ispiti, rokovi, kasnije planirano učenje) su pod danom u oba prikaza. Tap na termin nastave otvara detalje: predmet (link), tip, vrijeme, sala, sedmice, “Dokle ste stigli?”, “Otkaži za ovaj dan” / “Vrati termin”, “Uredi u rasporedu”. Zaglavlje Plana ima dva dugmeta: Dostupnost i Raspored. Kalendar prima `?date=` i `?view=`, pa drugi ekrani vode direktno na dan (npr. ispit na predmetu → “Prikaži u kalendaru”).

Kartica “Uslikaj raspored” se prikazuje tek sa AI uvozom rasporeda (Etapa 10). Tabela `timetable_entries` je u konsolidovanoj migraciji; AI zadatak `parse_timetable` koristi isti pipeline kao uvoz sadržaja.

## Akademski kalendar

Fakultet objavi akademski kalendar prije semestra: kad traje nastava, kad su ispitni rokovi i sedmice parcijalnih, i koji su dani neradni. Datume konkretnih ispita kalendar nema; oni dolaze kasnije (raspored parcijala, uvoz ispita).

**Model** (`academic_periods`): vrsta, naziv, od–do (lokalni datumi). Sedmice parcijalnih i ispitni rokovi su jedan tip (“Ispitni period”) sa podtipom, pa akademski kalendar ima tri sekcije: Nastava, Ispitni periodi, Neradni dani.

| Vrsta (`kind`) | Primjer | Šta radi |
| --- | --- | --- |
| `teaching` | Zimski semestar, 6. okt – 23. jan | Period važenja rasporeda i parnost sedmica; “7. sedmica nastave” na Danas |
| `exam` + `exam_session`: `partial` / `regular` / `makeup` | Sedmica parcijalnih, Januarsko-februarski rok, Popravni rok | Raspon za ispit sa nepoznatim datumom (parcijala → `partial`, završni/integralni → `regular`, popravni → `makeup`); nastava u sedmici parcijalnih teče po rasporedu osim neradnih dana |
| `holiday` | Nova godina, 1.–2. jan | Nema nastave (termini se ne računaju, “Dokle ste stigli?” ne pita); dostupnost za učenje ostaje |

- **Unos:** ručno na ekranu “Akademski kalendar” (Postavke, i iz Rasporeda) od Etape 4; AI uvoz iz slike, PDF-a ili teksta sa pregledom od Etape 6.
- **Ispit u roku:** u ExamSheetu, uz “Datum još nije objavljen”, bira se rok (`assessments.exam_period_id`). Raspon ispita (`at` – `at_latest`) = raspon roka; plan cilja najraniji dan (isto pravilo kao okvirni datum). Prijedlog po tipu: parcijala → ispitni period `partial`, završni/integralni → `regular`, popravni → `makeup`. Promjena datuma roka pomjera i povezane okvirne ispite. Na NoviPredmet dugme “Datumi još nisu poznati?” to radi za sve ispite bez datuma odjednom: n-ta parcijala dobija n-tu sedmicu parcijalnih, ostali odgovarajući rok.
- **Sedmica na Danas:** ispod datuma “7. sedmica nastave” (u periodu nastave), “[naziv ispitnog perioda] · 2. sedmica” ili “Neradni dan · [naziv]”; van svih perioda ništa. Tap vodi na akademski kalendar.

## AI uvoz, dokumenti i asistent

AI pomaže da se podaci unesu brže i da se nađe odgovor u dokumentima, ali nikad ne piše direktno: svaki prijedlog prolazi pregled (novo / izmijenjeno / ostaje) i potvrdu.

**Provajder.** Sve ide kroz LLM wrapper (`_shared/llm.ts`). Dok Anthropic nalog nema karticu, `LLM_PROVIDER=gemini` (Gemini 3.5 Flash-Lite free tier, uz `LLM_FALLBACK_MODEL` kad je prvi model zauzet ili bez kvote; structured output preko `responseJsonSchema` iz `z.toJSONSchema()`); prebacivanje na Haiku je promjena secrets, bez koda. Na free tieru Google može koristiti podatke za poboljšanje proizvoda, pa se šalju samo podaci koji su za to potrebni. Koraci za ključ su u [SETUP.md](SETUP.md).

**Sova (agent) na Danas (Etapa 6).** Na dnu ekrana Danas, iznad tab bara, stoji traka sa sovom („Pitaj sovu…“ i dugme +). To je jedan ulaz za sve AI radnje: pitanje (odgovor iz dokumenata sa citatom ili iz sažetka stanja), dodavanje dokumenta (uslikaj, slika, PDF, zalijepi tekst) i prijedlozi izmjena kao kartice sa pregledom. Tap na traku otvara razgovor preko cijelog ekrana. Iznad trake je današnji savjet strategista (oblačić, × ga skloni do sutra) i prijedlozi pitanja. Offline ili bez ključa traka je onemogućena. Za sad je samo na Danas; kasnije najvjerovatnije plutajuća sova (krug dole desno) na ostalim tabovima, varijanta 7B u mockupu. Oblačić sa savjetom dolazi sa strategistom (Etapa 11); do tad iznad trake stoje samo prijedlozi. Mockup: `design/SovaAgent.html`.

**Redizajn (Liquid Glass, nakon Etape 7).** Traka sa sovom na Danas je zamijenjena AI tabom u sredini navigacije (ekran Chat, mockup `design/Chat.dc.html`), a u tekstovima je „asistent“ umjesto „sova“; maskote više nema. Sve ostalo iz ovog pasusa (dokumenti, citati, prilog, prijedlozi kao kartice) vrijedi i dalje. Timer dugme je uklonjeno iz navigacije: sesija se pokreće iz kartice „Sljedeće“ na Danas (do schedulera nudi slobodnu sesiju) ili iz chata. **Odluka nakon v0.7.2:** donja navigacija je zamijenjena prvim redom na vrhu (avatar, AI, ☰) i menijem koji se otvara odozgo (`design/NavMeni.html`, design README → Navigacija).

**Uvoz sa pregledom (Etapa 6).** Kroz sovu (dugme +) ili ekran “Uvezi”: zalijepi se tekst ili doda slika/PDF i bira šta je unutra (ili sova pogodi).

- Akademski kalendar → periodi (nastava, rokovi, sedmice parcijalnih, neradni dani).
- Raspored ispita (npr. raspored parcijala) → ispiti sa datumima, upareni sa predmetima (`fuse.js` + AI), uz prijedlog izmjene postojećeg ispita (okvirni → tačan datum) umjesto duplikata.
- Isti pregled kasnije koriste raspored nastave i sadržaj knjige (Etapa 10).
- Prije slanja korisnik potvrdi prilog i može dodati poruku sovi (“samo II godina, grupa B”); poruka ide u prompt i sužava šta se izvlači, ali nikad ne zamjenjuje datume iz dokumenta.
- **Odluke (Etapa 6):** “Pogodi sama” je jedan AI poziv (`parse-document`): isti poziv prepozna vrstu i izvuče periode ili ispite; izabran tip daje užu šemu. Dat dokument se odmah sprema u Dokumente (fajl + odlomci; briše se tamo), jer je davanje dokumenta već potvrda. Potvrdu traže samo izmjene plana (periodi, ispiti) kroz karticu novo / izmijenjeno / preskačem.

**Dokumenti i RAG.** Korpus su tri stvari:

1. **Dokumenti fakulteta** (`documents`: akademski kalendar, pravilnik, silabus, obavještenje). Za razliku od slika sadržaja, dokument se čuva u bucketu `uploads` dok ga korisnik ne obriše. Tekst se dijeli na odlomke (`document_chunks`) sa embeddingom (`gte-small`, pgvector, 384 dimenzije). Pretraga je RPC sa RLS-om (samo vlastiti dokumenti). Odgovor uvijek navodi dokument i stranicu.
2. **Bilješke i jedinice**: naslovi jedinica, bilješke, kartice i ispitna pitanja dobijaju embedding (isti model). Služe recall pitanjima, vezi pitanje ↔ poglavlje i pretrazi “gdje sam pisala o …” (Etapa 10).
3. **Stanje plana**: nije vektorska pretraga nego kompaktan JSON sažetak (predmeti, ispiti, bodovi, napredak, zaostatak), isti kao ulaz strategista.

**Asistent (chat).** Razgovor sa sovom postoji od Etape 6 (dokumenti, sažetak stanja, prijedlozi uvoza). Etapa 10 dodaje ostale alate. Razgovor nad istim alatima: pretraga dokumenata i bilješki, sažetak stanja i isti prijedlozi kao uvoz (“dodaj sve parcijale iz ovoga”), koji se prikazuju kao kartice sa pregledom. Historija razgovora i trošak se bilježe; isti rate limit kao ostali AI pozivi. Od Etape 6 razgovori se čuvaju u bazi (`owl_conversations`, `owl_messages`): svaki ulaz sa Danas (traka, prijedlog, +) počinje novi razgovor, a stari su u Historiji (sat u zaglavlju razgovora; tap nastavlja razgovor, kanta ga briše). Svako pitanje šalje zadnjih 6 poruka razgovora, odlomke i sažetak stanja; model ništa ne pamti između poziva. **Prompt caching:** stalni dio ide prvi (uputa, pa sažetak stanja), pa razgovor, odlomci i pitanje. Gemini to implicitno kešira (`ai_runs.cached_tokens`); eksplicitni cache (`cachedContents`, TTL 10 min, po razgovoru) se pokušava kad je prefiks dovoljno dug, a free tier ga odbija, pa se odbijanje pamti sat vremena i poziv ide bez njega. Anthropic adapter stavlja `cache_control` na uputu i sažetak.

## Bodovi, skala ocjena i projekcija ocjene

Uz spremnost za ispit app zna i koliko bodova nosi svaki ispit i rok, koliko ih je osvojeno i šta treba za željenu ocjenu. Sve se računa čistim kodom u `src/lib/grades/` (testovi), ništa se ne snima osim unosa.

**Bodovi.** Ispit (`assessments`) i rok (`deadlines`) mogu nositi bodove (`points_max`, npr. I parcijala 40, II parcijala 40, zadaće 20). Jedinica se bira po stavci (`points_unit`): bodovi, ili procenti ukupne ocjene. Ukupno predmeta (`subjects.points_total`, default 100) je osnova za procente i skalu: stavka od 20% nosi 20% od `points_total`. Stavka bez `points_max` ne ulazi u bodove (samo u plan). U sheetu se to bira kao “bez bodova” (još ne znaš koliko nosi), a prag kao “bez praga” (odluka, Etapa 5). Popravni i integralni (kad postoje parcijale) ne unose bodove: prikazuju naslijeđene.

**Rezultat.** Unosi se kad izađe, kao bodovi (`result_points` od `result_max`, default `result_max` = bodovi stavke) ili kao procenat (`result_max` = 100). Doprinos stavke = bodovi stavke × `result_points` / `result_max`, pa test bodovan od 50 može nositi 40 bodova.

- **Poništi rezultat** (odricanje, `result_annulled`): rezultat ostaje vidljiv precrtan, ne ulazi u zbir, ispit nije položen, pa se aktivira njegov popravni (“samo ako zatreba”).
- **Položeno** (`passed`) app postavi pri unosu rezultata: rezultat se računa i, ako ispit ima prag, procenat ≥ `pass_min_pct`. Korisnik ga može ručno promijeniti (kao i do sad).
- **Ispod praga** (odluka, Etapa 5): rezultat koji nije položen ne ulazi u “imam”; bodovi te stavke se vraćaju u preostale (dobijaju se na popravnom ili integralnom). Prikazuje se kao “12/40 ✗”. Rok nema `passed` kolonu: položen je kad je procenat ≥ `pass_min_pct` (ili nema praga).

**Popravni i integralni.**

- Popravni (`kind = 'makeup'`) je uvijek vezan za ispit koji ponavlja (`retake_of`), pa se na predmetu prikazuje ispod njega (“Popravni I parcijale”) i odmah se zna šta zamjenjuje. Nosi iste bodove kao taj ispit. Popravni integralnog je takođe moguć.
- Integralni (`kind = 'integral'`) zamjenjuje sve parcijale predmeta (sa njihovim popravnim) i nosi zbir njihovih bodova.
- Računa se **zadnji izlazak**: za svaku stavku vrijedi rezultat najkasnijeg pokušaja (stavka ili njen popravni) koji ima rezultat i nije poništen. Ako je zadnji pokušaj u grupi parcijala integralni, on daje bodove za sve parcijale zajedno; inače svaka parcijala svoje.

**Uslovi za prolaz.**

- **Prag po stavci** (`pass_min_pct`, opcionalno, unos u bodovima ili % i snima se kao %): ispod praga stavka nije položena.
- **Prag ukupno**: zbir mora dostići prag ocjene 6 iz skale.
- **Uslov za izlazak** (`entry_min_points` na ispitu, opcionalno): zbir bodova sa stavki koje su prije tog ispita mora biti bar toliki (npr. 20 bodova iz zadaća i seminarskog za završni). Ako nije ispunjen, ispit i projekcija to pokažu.

**Skala ocjena** (`subjects.grade_scale`, `null` = default): pragovi u procentima od `points_total`, snimljeni kao niz od 5 brojeva za ocjene 6–10 (`[55,65,75,85,95]`). Default bosanska skala: 0–54 → 5, 55–64 → 6, 65–74 → 7, 75–84 → 8, 85–94 → 9, 95–100 → 10. Pragovi strogo rastući (Zod). Sheet “Skala ocjena” ima i polje “Ukupno bodova” (`points_total`); pragovi se unose i prikazuju u % (odluka, Etapa 5).

**Zajednička skala** (odluka nakon Etape 6, migracija `0011_global_grade_scale.sql`): skala i ukupno bodova su obično isti za sve predmete, pa žive na profilu (`profiles.points_total`, `profiles.grade_scale`) i važe za svaki predmet. Predmet ima svoju samo kad je `subjects.custom_scale = true` (tada važe `subjects.points_total` / `grade_scale`). Sheet “Skala ocjena” na predmetu bira “Za sve predmete” (mijenja zajedničku) ili “Samo ovaj predmet”; Postavke → “Bodovi i ocjene” otvara zajedničku. Željena ocjena ostaje po predmetu.

**Projekcija ocjene** (`src/lib/grades/`):

- **Imam**: zbir doprinosa uračunatih rezultata, uz maksimum do sad (“32 od 40”).
- **Najviše moguće**: imam + bodovi preostalih stavki.
- **Za ocjenu N treba**: max(prag N − imam, zbir pragova preostalih stavki) od preostalih bodova, i kao prosječan procenat na preostalim stavkama. Pragovi po stavci su donja granica (odluka, Etapa 5): uz II parcijalu od 40 sa pragom 50% treba najmanje 20, i kad je za 6 dovoljno 9 bodova (mockup prikazuje 9). Za svaku ocjenu 6–10: osigurano / treba X (Y%) / nedostižno.
- **Željena ocjena** (`subjects.target_grade`, 6–10, opcionalno) je istaknut red projekcije.
- **Procjena ocjene iz spremnosti** (Napredak, uz prognozu spremnosti): očekivani procenat na preostalom ispitu = prognozirana pokrivenost obima do datuma ispita (Monte Carlo, vidi Prognoza spremnosti) × jačina znanja na dan ispita; daje vjerovatnu ocjenu i raspon (10.–90. percentil). Rezultati i `readiness_before` je kalibrišu.

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
| Kalendari (ICS) | `ical.js` u edge funkciji `sync-calendar` (parsiranje, RRULE/EXDATE); izvoz ICS-a generiše se ručno (mali format) | Jedan uvoz za Google, Apple, Outlook i Moodle, bez OAuth-a |
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
  kind text not null check (kind in ('teaching','partial_exams','exam','holiday')),  -- 0006 spaja partial_exams u exam
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

-- 0006_availability_days.sql (Etapa 4, dorada)
update academic_periods set kind = 'exam', exam_session = 'partial' where kind = 'partial_exams';
-- kind: ('teaching','exam','holiday'); exam_session: ('partial','regular','makeup')
alter table availability_rules add column over_classes boolean not null default false;  -- "Učim umjesto nastave"
alter table profiles add column daily_cap_min smallint[] not null
  default '{180,180,180,180,180,300,300}';                  -- pon..ned, minute
create table availability_days (                            -- izmjena za konkretan datum
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  on_date date not null,
  slots jsonb,                                              -- [{start_min,end_min,over_classes}], null = šablon
  cap_min smallint,                                         -- null = maksimum iz šablona
  updated_at timestamptz not null default now(),
  unique (user_id, on_date)
);
-- + RLS, grant, triger; default šablon 06–24 za postojeće korisnike i u handle_new_user()

-- 0007_grades.sql (Etapa 5, primijenjena; + checkovi: retake_of samo za makeup, result_points između 0 i result_max)
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

-- 0008_ai_documents.sql (Etapa 6)
create extension if not exists vector;
alter type ai_task add value 'parse_academic_calendar';
alter type ai_task add value 'parse_exam_schedule';
alter type ai_task add value 'parse_document';
alter type ai_task add value 'answer';
create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  subject_id uuid references subjects on delete set null,      -- null = opći (kalendar, pravilnik)
  kind text not null check (kind in ('academic_calendar','rules','syllabus','exam_schedule','notice','other')),
  title text not null,
  storage_path text,                                           -- uploads/<user_id>/documents/...
  media_type text,                                             -- null = zalijepljen tekst
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

-- 0009_ai_runs_writer.sql (Etapa 6): grant select, insert on ai_runs to service_role (Edge Functions logiraju AI pozive)

-- 0010_owl_chats.sql (Etapa 6): owl_conversations (naslov, zadnja poruka, cache_name/cache_key/cache_expires_at), owl_messages (role, type, payload jsonb), RLS; ai_runs.cached_tokens

-- 0011_global_grade_scale.sql (Etapa 6, dorada): profiles.points_total, profiles.grade_scale; subjects.custom_scale

-- 0012_sessions.sql (Etapa 7)
alter table study_sessions
  add column timer_mode text not null default 'pomodoro25'
    check (timer_mode in ('pomodoro25','pomodoro50','free')),   -- 25/5, 50/10 su samo podsjetnik
  add column planned_minutes smallint,                -- dužina bloka; null = slobodna sesija
  add column created_at timestamptz not null default now();
alter table study_segments add check (ended_at is null or ended_at >= started_at);
alter table sources add column measured_sessions int not null default 0;   -- "Prije mjerenja": < 3

-- 0013_session_origin.sql (Etapa 7, dorada)
alter table study_sessions
  add column origin text not null default 'timer' check (origin in ('timer','manual'));

-- 0014_onboarding_and_presets.sql (Etapa 8)
alter table profiles
  add column onboarded_at timestamptz,                 -- null = onboarding nije završen
  add column onboarding_step smallint not null default 0,
  add column wake_min smallint[],                      -- {radni, vikend}, minute od ponoći
  add column sleep_min smallint[],                     -- {radni, vikend}
  add column preferred_slots text[] not null default '{}',   -- 'morning','midday','afternoon','evening','night'
  add column session_presets jsonb not null default '[]',    -- vlastiti predlošci (Zod u _shared)
  add column default_preset text not null default 'standard',
  add column exam_eve_end_min smallint not null default 1380,  -- 23:00, san pred ispit
  add column ics_token text;                           -- izvoz plana; null = isključeno
alter table study_sessions
  drop constraint study_sessions_timer_mode_check,     -- timer_mode = id predloška (ugrađen ili vlastiti)
  add column break_ends_at timestamptz,                -- Web Push za kraj pauze
  add column focus_reasons text[],                     -- uz fokus 1: 'tired','phone','noise','hard','sleep'
  add column distractions smallint not null default 0;
-- stare vrijednosti 'pomodoro25' / 'pomodoro50' / 'free' ostaju važeće za historiju (ugrađeni legacy predlošci)
alter table sources
  add column is_rough boolean not null default false;  -- privremeni izvor iz grube veličine gradiva

-- 0015_calendar_feeds.sql (Etapa 8)
create table calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  url text not null,                                   -- tajna; nikad u logove
  kind text not null check (kind in ('busy','deadlines')),
  color text,
  all_day_busy boolean not null default false,
  busy_only boolean not null default false,            -- ne spremaj naslov i lokaciju
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table external_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  feed_id uuid not null references calendar_feeds on delete cascade,
  uid text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at >= starts_at),
  all_day boolean not null default false,
  title text,
  location text,
  ignored boolean not null default false,
  deadline_id uuid references deadlines on delete set null,   -- Moodle rok koji je uvezen
  updated_at timestamptz not null default now(),
  unique (feed_id, uid, starts_at)
);
-- + RLS owner_all, grant, set_updated_at triger, indeks (user_id, starts_at); ai_task se ne mijenja (bez LLM-a)

-- 0016_manual_blocks.sql (Etapa 8)
alter table plan_blocks
  add column origin assigned_by not null default 'ai',   -- 'user' = zaključan od replana
  add column title text,
  alter column plan_run_id drop not null;
alter table subjects
  add column priority_boost_until date;                -- privremeno pojačanje prioriteta

-- 0017_fsrs.sql (Etapa 9); SM-2 kolone još nisu korištene; iste FSRS kolone dobijaju i cards
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
  add column stability_after numeric,
  add column card_id uuid references cards on delete cascade;   -- ponavljanje kartice (unit_id = njena jedinica)
alter table cards
  add column fsrs_stability numeric,
  add column fsrs_difficulty numeric,
  add column fsrs_state smallint,
  add column fsrs_reps smallint not null default 0,
  add column fsrs_lapses smallint not null default 0,
  add column last_review_at timestamptz,
  add column next_review_on date,
  add column updated_at timestamptz not null default now();     -- + set_updated_at triger
```

## AI integracija

Edge funkcije, sve sa strukturiranim JSON izlazom koji se validira Zod šemom prije snimanja. Uz Claude Haiku 5.5 jedno parsiranje košta otprilike desetinku centa.

| Edge funkcija | Ulaz | Izlaz |
| --- | --- | --- |
| `parse-toc` | 1–4 slike ili tekst, tip izvora, predmet, postojeće teme | jedinice, stranice, podjedinice, `ai_difficulty`, teme, upozorenja |
| `parse-questions` | slika ili tekst liste pitanja, postojeće teme i poglavlja | pitanja, teme, prijedlog ispita |
| `parse-timetable` | slika rasporeda, nazivi predmeta | termini (dan, vrijeme, tip, sala, parnost), veza na predmet |
| `parse-document` | tekst (zalijepljen ili tekst iz PDF-a po stranicama), slika ili skenirani PDF; vrsta (`auto` / akademski kalendar / raspored ispita / dokument); predmeti i postojeći ispiti | vrsta i naslov dokumenta, periodi (nastava, ispitni periodi, neradni dani) ili ispiti sa datumom i vezom na predmet, prepis po stranicama kad tekst nije dat. `ai_task`: `parse_academic_calendar`, `parse_exam_schedule` ili `parse_document` |
| `documents` | odlomci dokumenta (najviše 16 po pozivu) | embedding (`gte-small`) i upis odlomaka, bez LLM poziva |
| `answer` | pitanje + najrelevantniji odlomci + sažetak stanja | odgovor sa citatima (dokument, stranica) |
| `ai-status` | — | da li je AI podešen i koliko je poziva ostalo (traka sove) |
| `recall-questions` | bilješke ili slika stranice ili naslov + podnaslovi; `count` (3 za recall gate, 5–10 za kviz) | pitanja sa odgovorima i oznakom izvora |
| `propose-answer` | ispitno pitanje + bilješke povezanih jedinica | prijedlog odgovora, označen “provjeri” |
| `strategist` | JSON sažetak stanja + kandidati akcija iz pravila | sažetak, rizici, najviše 3 izabrana kandidata sa obrazloženjem |
| `sync-calendar` | `calendar_feeds` korisnika (ili jedan feed) | upsert `external_events`, `last_synced_at` / `last_error`; bez LLM-a |
| `calendar-feed` | `ics_token` u URL-u | ICS sa ispitima, rokovima i (opcionalno) blokovima; bez LLM-a, bez JWT-a (token je ključ) |
| `notify` | `pg_cron` / zakazani push (prvi blok, kraj pauze, …) | Web Push |

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
- Rate limit u edge funkciji: max 30 AI poziva u zadnja 24 sata po korisniku, provjera preko `ai_runs` (embeddings se ne broje).
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
  task: AiTask;              // enum ai_task iz baze (database.ts), npr. 'parse_document', 'answer', 'strategist'
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
│  │  ├─ progress/      # formule progresa, forecast() (Monte Carlo)
│  │  ├─ slots/         # termini učenja: signali, ocjene, Thompson + testovi
│  │  ├─ strategist/    # kandidati akcija iz pravila + testovi
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
│     ├─ recall-questions/  propose-answer/
│     ├─ strategist/
│     ├─ sync-calendar/  calendar-feed/
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

Koraci podešavanja (Supabase, Cloudflare Pages, Resend, AI ključevi, keepalive, backup) su u [SETUP.md](SETUP.md), koji se ažurira sa svakom promjenom u dashboardu. Ovdje se ne ponavljaju, da ne zastare.

## Roadmap i odluke

Sve je u prvoj verziji; ovo je samo redoslijed gradnje, tako da poslije svakog koraka imaš nešto što radi.

1. **Temelj.** Kostur, migracija, login, i18n, deploy, CI.
2. **Predmeti, ispiti, rokovi, kalendar.** Uključujući prioritet, režim, “samo ako zatreba” i okvirni datum (polja i UI).
3. **Izvori i jedinice ručno.** Statusi, notes, kartice, progres, teme ručno, obim ispita.
4. **Akademski kalendar, raspored nastave i dostupnost.** Plus praćenje predavanja, zaostatak, granica dana i dnevni prikaz kalendara.
5. **Bodovi i ocjene.** Bodovi ispita i rokova, pragovi, popravni/integralni, skala ocjena, rezultat i poništavanje, projekcija ocjene.
6. **AI temelj, uvoz i dokumenti.** LLM wrapper (Gemini za sad), `ai_runs`, uvoz akademskog kalendara i rasporeda ispita sa pregledom, dokumenti fakulteta i RAG.
7. **Timer i sesije.** Timer dugme, segmenti, offline red, kraj sesije, kalibracija.
   - **Redizajn (Liquid Glass) → v0.7.2.** Novi vizuelni sistem i navigacija sa AI tabom za sve postojeće ekrane (docs/design/README.md).
8. **Onboarding i scheduler.** Onboarding, predlošci sesije, povezani kalendari (ICS uvoz), gruba veličina gradiva; `plan()`, automatski `placeTimes()` sa pauzama, faktor realizacije i rezerva, limit rasta, replan, deficit, prioritet, kampanja, meki rokovi predavanja, ručni blokovi, željena ocjena, brze akcije dana, “Danas” ekran.
9. **Recall gate, provjera znanja i FSRS.** Plus osnovni Web Push (prvi blok, kraj pauze), R na dan ispita, kartice kao FSRS objekti.
10. **AI sadržaj i asistent.** Uvoz sadržaja, pitanja i rasporeda nastave, merge pri ponovnom uvozu, recall pitanja, embeddings bilješki, chat asistent, Moodle rokovi, Web Share Target, CSV kartica.
11. **Napredak.** Statistika, termini učenja, Monte Carlo prognoza spremnosti i procjena ocjene, spremnost dan prije ispita, strategist (pravila + LLM), sedmični check-in.
12. **Notifikacije i dorada.** Ostale notifikacije, ICS izvoz plana, izvoz podataka, pristupačnost, testovi end-to-end.

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
| Prioritet i režim | Prioritet 1–5 mijenja udio vremena, rezanje kod deficita, buffer, ciljno zadržavanje i ciljnu pokrivenost; režim redovno / kampanja. UI: sekcija “Cilj” sa “Koliko ti je bitan” (imena, bez brojeva) i željenom ocjenom; ostalo nikad kao postavka |
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
| Kalendar prikazi | Mjesec / Dan; nastava samo u listi dana i na vremenskoj osi, ne kao tačkica u mjesecu; tačkice aktivnosti u oba prikaza; tap na termin = detalji |
| Dostupnost | Default 06–24 + dnevni maksimum (3 h radnim, 5 h vikendom); šablon po danu u sedmici i izmjena po datumu (“samo ovaj dan” / “svaki”); preko nastave uz upozorenje i “Učim umjesto nastave” |
| Ispitni periodi | Sedmice parcijalnih i ispitni rokovi su jedan tip sa podtipom (parcijale / redovni / popravni) |
| Zaostatak | U mjeri izvora (str., slajdovi, pitanja), vrijeme sitno ispod |
| “Dokle ste stigli?” | Samo nakon predavanja; kartica do kraja dana; ostalo ručno na predmetu |
| Bodovi | Bodovi ili procenti po stavci; zadnji izlazak vrijedi; popravni vezan za ispit, integralni zamjenjuje parcijale; poništavanje = odricanje |
| Željena ocjena | Podiže ciljnu pokrivenost u `plan()`; prioritet se samo predlaže |
| Akademski kalendar | Periodi nastave, sedmice parcijalnih, ispitni rokovi, neradni dani; ručno (Etapa 4) i AI uvoz (Etapa 6); bez datuma konkretnih ispita |
| Ispit bez datuma | Bira se rok iz akademskog kalendara; raspon roka = okvirni raspon ispita |
| AI provajder za sad | Gemini Flash free tier iza wrappera dok Anthropic nema karticu |
| Uvoz i asistent | Sova na Danas kao jedan ulaz od Etape 6 (uvoz sa pregledom, pitanja o dokumentima); bilješke, recall i ostali alati u Etapi 10; AI nikad ne piše direktno |
| RAG | Dokumenti fakulteta (čuvaju se) + bilješke i jedinice (embeddings `gte-small`) + sažetak stanja plana |
| Onboarding | Prije schedulera (Etapa 8); prvo uvoz, pa dostupnost; svaki korak preskočiv uz checklist na DanasPrazno; završava pregledom “Tvoja sedmica” |
| Predlošci sesije | Standardno 50/15 default; Pomodoro 25/5 + 20 nakon 4, Flowtime, vlastiti niz, slobodno; podsjetnik, ne automatski segment; kraj pauze kroz Web Push |
| Satnica | `placeTimes()` automatski poslije `plan()`; svaki blok ima predloženo vrijeme i pauze; tab samo prikazuje i pomjera |
| Realizacija | Faktor realizacije ρ i rezerva 0.9 u `plan()` (kod, `input_hash`), ne prijedlog strategista; limit dnevnog rasta 1.25× |
| Termini učenja | Statistika po terminu (fokus, brzina, odrađenost, kašnjenje) sa shrinkage-om i Thompson uzorkovanjem; LLM samo formuliše prijedloge dostupnosti |
| Prognoza | Monte Carlo iz vlastite historije: raspon + vjerovatnoća |
| Strategist | Pravila prave kandidate akcija, LLM bira najviše 3 i objašnjava; privatni tekst ne ide na Gemini free tier |
| Povezani kalendari | ICS uvoz u v1 (Google, Apple, Outlook = zauzetost; Moodle = rokovi), edge funkcija `sync-calendar`; ICS izvoz plana; Google Calendar API, Notion i Teams kasnije ili nikad |
