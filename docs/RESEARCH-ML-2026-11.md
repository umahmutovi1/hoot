# Hoot — istraživanje: ML za više korisnika i personalizacija

2. nov 2026 · poslije `v0.10.6`. Nastavak [RESEARCH-ML-2026-10.md](RESEARCH-ML-2026-10.md). Odluke su prenesene u [ROADMAP.md](ROADMAP.md) kao **Etapa 11e — Personalizacija i ML za više korisnika** (dio pred drugog korisnika ide u „Otvaranje za više korisnika“ u Kasnije) i u [PRD.md](PRD.md) („Onboarding“ korak 3, „Dopune, 2. nov 2026“). PRD je izvor istine; ovdje ostaju obrazloženje i izvori.

## Sažetak

1. **Ručni blokovi su rupa u modelu termina.** Model odrađenosti uči samo iz AI blokova (`src/lib/slots/examples.ts:67`, `ml/hoot_ml/data.py:52`, `origin = 'ai'`). Ko uvijek ručno stavi blok u 6:00 i odradi ga, model nikad ne sazna da mu to vrijeme odgovara. Prijedlog: ručni blok sa vremenom ulazi kao primjer sa manjom težinom i oznakom `manual` (sekcija 2).
2. **Trajanje već uči iz ručnih blokova, i to je ispravno.** `ml/hoot_ml/duration_fit.py:47` i TS model čitaju sve sesije po jedinici, bez obzira ko je složio blok. Brzina čitanja jedinice ne zavisi od toga ko je odabrao termin, pa odluka glasi: ostaje tako, ali sada je zapisana (2.3).
3. **Simulator ima jednog studenta.** `scripts/sim/student.ts` (`DEFAULT_STUDENT`) i `baseline.json` mjere jednu osobu. Promjena koja pomogne jutarnjem tipu može naškoditi noćnom, a to se sada ne vidi. Prijedlog: populacija tipova, metrika hladnog starta, test pogrešnog priora i student koji ubacuje ručne blokove; `--check` poredi preko populacije (sekcija 3).
4. **Najviše koči planiranje i odgađanje, a ne znanje.** U anketama studenata vodeće prepreke su upravljanje vremenom i planiranje, pa odgađanje i stres (sekcija 4). To je tačno ono što Hoot rješava. Jedno kratko pitanje „Šta te najviše koči?“ u onboardingu daje prior za postojeće mehanizme, bez novih postavki (sekcija 5).
5. **Samoprocjena je prior, ne istina.** Ljudi loše procjenjuju vlastito ponašanje. Odgovor zato pomjeri prior, a podaci ga brzo nadjačaju (shrinkage kao i sve ostalo u Hoot-u). Napredak pokaže kad se ponašanje razlikuje od odgovora („Rekla si veče, a najviše odradiš ujutro“).
6. **Zajednički trening tek uz pristanak i desetak korisnika.** RLS po dizajnu ne dopušta čitanje tuđih redova. Treba izričit pristanak (opt-in), serverska agregacija dovoljnih statistika (ne sirovi redovi) i prag broja korisnika. Do tada je prior + lično učenje ispravno (sekcija 6).
7. **Monitor treba alarm, ne samo izvještaj.** `ml-monitor.yml` piše P80 pokrivenost i Brier u summary. Alarm otvara issue kad pokrivenost izađe iz 0,7–0,9 ili Brier postane lošiji od konstante (sekcija 7).

---

## 1. Gdje je Hoot danas

| Oblast | Danas | Rupa |
| --- | --- | --- |
| Odrađenost bloka (`src/lib/slots/`) | Bayesovska logistička regresija, prior iz `priors.json`, lični update u TS-u; `preferred_slots` iz onboardinga pomjeri prior (`preferredShift`) | Uči samo iz `origin = 'ai'` blokova |
| Trajanje (`src/lib/estimates/model.ts`) | Hijerarhijski log-normalni model, sve sesije po jedinici | Odluka o ručnim blokovima nije bila zapisana |
| Simulator (`scripts/sim/`) | Pravi `plan()` + jedan student iz literature, 100 seedova | Jedan tip studenta; nema metrike hladnog starta; nema ručnih blokova |
| Izvoz (`ml/hoot_ml/export.py`) | Kao korisnik (anon ključ + RLS), bez slobodnog teksta | Radi samo za jednog korisnika |
| Monitor (`ml/hoot_ml/monitor.py`) | P80 pokrivenost, Brier, FSRS kalibracija po sedmici u summary | Nema alarma |
| Onboarding (PRD „Onboarding“ korak 3) | „Kad ti je najlakše učiti?“ (jutro / podne / popodne / veče / noć) | Nema „ne znam / različito“; ništa o tome šta korisnika koči |

---

## 2. Ručni blokovi kao signal

### 2.1 Problem

Primjer za model odrađenosti je AI blok sa vremenom (`plan_start_min`) i oznakom iz `blockLabel()` (odrađen / preskočen / nepotvrđen). Ručni blok (`plan_blocks.origin = 'user'`) se preskače. Razlog je bio ispravan: korisnik ručni blok bira jer tada namjerava učiti, pa je to pristrasan uzorak (selection bias). Ali posljedica je gora od pristrasnosti. Termin koji korisnik uvijek bira sam nikad ne dobije mjerenje, pa ga Hoot nikad ne predloži. Uz uvoz plana sa fiksiranim terminima (Etapa 11d) ovo postaje češće.

### 2.2 Prijedlog

- Ručni blok sa vremenom ulazi u primjere sa težinom `w_manual` (početno 0,5) i indikatorom `manual` kao dodatnim obilježjem. Težina smanjuje uticaj pristrasnog uzorka, a indikator upija razliku „ručno se češće odradi“, da ne ode u koeficijent dijela dana.
- Obje oznake se računaju: odrađen ručni blok je pozitivan signal za termin, preskočen je negativan. Bez toga bi model naučio „ručni termini su uvijek dobri“.
- Za ocjenu termina (`placeTimes()`) indikator `manual` je 0: pitamo „koliko je ovaj termin dobar za Hoot blok“, a efekat dijela dana je sada naučen i iz ručnih blokova.
- `w_manual` je hiperparametar u `src/lib/slots/priors.json` (verzija u `input_hash`), fituje ga `ml/` preko backtesta, a simulator provjerava da ne kvari ocjenu termina (3.4).
- Isti filter postoji na dva mjesta (`examples.ts` i `data.py`), pa se oba mijenjaju zajedno uz paritetni test (`completion.cases.json`).

### 2.3 Trajanje: ostaje kako jeste

Sesije na ručnim blokovima već ulaze u model trajanja. To je namjerno: model trajanja mjeri brzinu po jedinici i izvoru (`log rate = μ + b_korisnik + b_izvor + ε`) i ne zavisi od termina. Ako se kasnije pokaže da je brzina različita po dijelu dana, to je obilježje termina u modelu, a ne filter po porijeklu bloka.

---

## 3. Simulator za populaciju

### 3.1 Populacija umjesto jednog studenta

Svaki seed izvuče osobine iz raspodjele, umjesto fiksnog `DEFAULT_STUDENT`:

| Osobina | Raspodjela (početna, iz literature) |
| --- | --- |
| Hronotip | jutarnji 25% · srednji 50% · noćni 25%; `part` koeficijenti pomjereni prema tipu |
| Brzina | log-normalna oko procjene, `fallacy` ~ LN(ln 1,3, 0,2) |
| Izbjegavan predmet | 60% ima jedan, 15% dva, 25% nijedan |
| Kašnjenje starta | `delayMedianMin` 1–20 min |
| Nepravilan raspored | `cantTodayP` 0,02–0,15 |
| Ručni blokovi | 30% studenata ubacuje 1–3 sedmično u omiljeni termin |
| Šta te koči (odgovor) | izveden iz osobina uz šum (samoprocjena nije savršena), da se testira i prior iz odgovora |

Seed ostaje jedini izvor slučajnosti, pa je svaki run ponovljiv. Tipovi su imenovani (`morning_fast`, `night_avoider`, …), da izvještaj može pokazati metriku po tipu.

### 3.2 Metrike

- Postojeće metrike (R×bodovi na dan ispita, deficit, propušteni blokovi, promjena plana, varijansa opterećenja) kao **prosjek i najgori decil po tipu**. Promjena koja popravi prosjek, a pokvari jedan tip za više od praga, ne prolazi.
- **Hladni start:** iste metrike samo za prve 2 sedmice (prvih 14 dana od početka simulacije). Tu odlučuje zajednički prior.
- **Brzina oporavka od pogrešnog priora:** broj dana dok greška Brier-a odrađenosti po tipu ne padne ispod 1,1 × greške tačnog modela.

### 3.3 Test „pogrešan prior“

Simulator pokrene populaciju u kojoj je prior namjerno pogrešan za jedan tip (npr. prior kaže „jutro je dobro“, a student je noćni). Test prolazi ako se lični model ispravi za najviše 3 sedmice i ako hladni start tog tipa nije gori od plana bez modela termina (`--slots off`). Ovo je pojačanje postojećeg gate-a u `train.yml`: novi prior ne smije biti gori za nove ljude.

### 3.4 Ručni blokovi u simulatoru

Student koji ubacuje ručne blokove u omiljeni termin. Provjera: sa `w_manual > 0` ocjena termina za njegov omiljeni dio dana raste, a ocjena ostalih termina se ne kvari (Brier na AI blokovima nije gori nego bez ručnih primjera).

### 3.5 Baseline

`scripts/sim/baseline.json` prelazi na populaciju: čuva metrike po tipu i za hladni start. `--check` pada kad je bilo koji tip gori od praga, ne samo prosjek. Simulator ostaje glavni alat, jer na pravim korisnicima nije bezbjedno testirati promjene.

---

## 4. Šta najviše koči ljude koji uče

### 4.1 Nalazi

- **Upravljanje vremenom i planiranje.** U anketi studenata u Jordanu (2025) o samoregulaciji 70,3% odgovora o preprekama odnosi se na upravljanje vremenom, a 60,4% na nemogućnost planiranja. U online kursevima (SAD, N = 1 216) upravljanje vremenom je najčešće navedena teškoća u obje tačke mjerenja. Obje brojke su iz sažetaka pretrage, pa ih treba provjeriti u originalu prije citiranja ([Frontiers in Psychology 2025](https://public-pages-files-2025.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1562980/text), [odgađanje kroz model samoregulacije, PMC7760344](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7760344/)).
- **Odgađanje.** Procjene su da 80–95% studenata odgađa. Najjači prediktori su averzija prema zadatku, impulsivnost, ometanja i niska samoefikasnost ([Steel 2007, meta-analiza, 691 korelacija](https://prism.ucalgary.ca/handle/1880/47914)). Samoregulacija i upravljanje vremenom su negativno povezani sa odgađanjem ([Springer, Metacognition and Learning](https://link.springer.com/10.1007/s11409-017-9174-1)).
- **Stres.** Studenti sebe vide najmanje sposobnim u upravljanju stresom i odgađanjem ([VU Vilnius](https://epublications.vu.lt/object/elaba:103880100/index.html)).
- **Hronotip.** Jutarnji tip je umjereno povezan sa boljim uspjehom, ali efekat slabi na fakultetu i nestaje kad je ispit kasnije u danu. Noćni tipovi nisu manje sposobni, nego rade u „pogrešno“ vrijeme ([Preckel 2011](https://gwern.net/doc/melatonin/2012-preckel.pdf), [Randler, 31 studija, N = 27 309](https://www.ph-heidelberg.de/uploads/media/phhd201510_%E2%80%9EEulen%E2%80%9C_benachteiligt_01.pdf)). Za Hoot: prior termina iz odgovora ima smisla, ali ga stvarni podaci moraju brzo nadjačati.
- **Šta pomaže kod odgađanja.** Namjera „kad i gdje“ (implementation intention, „ako je 18:00, onda otvaram poglavlje 3“) ima srednji do veliki efekat na ostvarenje cilja (d = 0,65, 94 testa; nadogradnja 642 testa, jači efekat uz „ako-onda“ oblik) ([Gollwitzer i Sheeran 2006](https://kops.uni-konstanz.de/handle/123456789/69905)). Hoot to već radi kad predloži blok sa vremenom. Mali prvi korak umanjuje averziju prema zadatku (Steel).

Ograničenje: većina anketa su mali, prigodni uzorci iz različitih zemalja. Ne daju pouzdan postotak, ali svi pokazuju isti redoslijed: planiranje i vrijeme, pa odgađanje, pa stres.

### 4.2 Kratak upitnik, ne test ličnosti

Studije uvođenja korisnika u sisteme preporuka pokazuju da upitnik mora biti kratak, jer duži smanjuje broj onih koji ga završe ([Wikipedia, ICWSM](https://arxiv.org/pdf/1904.03889), [GroupLens](https://grouplens.org/blog/onboarding-new-users-in-recommender-systems/)). Odgovori se onda provjeravaju prema kasnijem ponašanju, a ne uzimaju kao istina. Zato: jedno pitanje sa čipovima, najviše 3 izbora, preskočivo, bez skala ličnosti.

---

## 5. „Šta te najviše koči?“: prijedlog

U onboarding koraku 3 (Ritam), ispod „Kad ti je najlakše učiti?“, koje dobija i čip „Različito / ne znam“ (bez pomaka priora). Do 3 izbora. Svaki odgovor je **prior za mehanizam koji već postoji**, ne nova postavka (princip proizvoda):

| Odgovor | Šta Hoot radi drugačije (default, ne pitanje) | Mehanizam |
| --- | --- | --- |
| Previše gradiva, ne znam odakle početi | Danas pokazuje samo prvi blok istaknuto; prvi blok predmeta je kraći; ranija kartica deficita | Danas, `plan()` prvi prolaz |
| Odgađam | Prvi blok dana 25/5; „kad i gdje“ podsjetnik prije bloka uključen; strategist kandidat `first_step` sa većim priorom | predložak sesije, podsjetnici, `strategist/` |
| Loše procijenim koliko traje | Jači prior optimizma (planning fallacy) dok nema mjerenja | `estimates/` faktor optimizma |
| Ometanja (telefon, društvene mreže) | Mjerenje ometanja i uvid ranije; prijedlog fokusa u sesiji | `app_leaves`, Uvidi |
| Izbjegavam jedan predmet | Šira nesigurnost efekta predmeta (brže otkrije), `first_step` za taj predmet | efekat predmeta u modelu odrađenosti |
| Stres pred ispit | Dan pred ispit rezervisan po defaultu; prognoza spremnosti vidljivija | `eve_reserved`, prognoza |
| Zaboravljam naučeno | Viši ciljni R za prioritet 1–3; ranija prva provjera | FSRS ciljni R |
| Nemam stalan raspored | Niži prior ρ (više rezerve); sedmični check-in ističe izuzetke | realizacija ρ, check-in |
| Ništa posebno | Ništa | — |

- Spremanje: `profiles.study_barriers text[]` (vrijednosti iz fiksne liste) i `preferred_slots` dobija vrijednost bez pomaka. Odgovor ulazi u `input_hash` samo preko priora koje mijenja.
- Snaga: svaki pomak je prior jačine nekoliko mjerenja (kao `preferredShift`), pa podaci nadjačaju odgovor za 1–2 sedmice.
- Povratna sprega: Napredak pokaže kad ponašanje odstupa od odgovora („Rekla si veče, a najviše odradiš ujutro · Prebaciti?“), jednim tapom. Postavke → Ritam mijenja odgovore.
- ML: odgovori su obilježja korisnika za populacijski prior (prior po tipu umjesto jednog za sve), tek uz zajednički trening (sekcija 6).
- Simulator testira da prior iz odgovora pomaže u hladnom startu i da pogrešan odgovor ne šteti duže od 3 sedmice (3.3).

---

## 6. Prije drugog korisnika

1. **Pristanak i privatnost.** Zajednički trening znači čitati tuđe podatke, pa je to pravna odluka i odluka o povjerenju, ne samo tehnička. Izričit pristanak (opt-in) u Postavkama i pri registraciji, isključen po defaultu, `profiles.ml_consent_at`; napomena o privatnosti (šta se koristi, šta ne, kako se povlači). Izvoz već izbacuje slobodan tekst. Povlačenje pristanka isključuje korisnika iz sljedećeg treninga.
2. **Izvoz za više korisnika.** RLS ne dopušta čitanje tuđih redova i tako treba ostati. Umjesto sirovog izvoza: serverska agregacija (SQL funkcija sa `security definer` ili edge funkcija sa service ključem, poziva je samo `train.yml`) vraća **dovoljne statistike po korisniku** (suma i suma kvadrata log brzine po tipu izvora, brojevi odrađenih po dijelu dana, …), bez ID-eva redova, datuma i teksta, samo za korisnike sa pristankom i najmanje N mjerenja. Hijerarhijski model treba upravo te statistike.
3. **Prag.** Zajednički prior se trenira tek kad ima najmanje ~10 korisnika sa dovoljno podataka; ispod toga agregacija vraća ništa. Differential privacy na ovako malom broju korisnika jako kvari tačnost ([pregled DP u federativnom učenju](https://arxiv.org/pdf/2402.02230)), pa je prag + agregat + pristanak bolji izbor za sada.
4. **Gate.** Novi prior prolazi samo ako je na populacijskom simulatoru i backtestu bolji ili jednak za svaki tip, uključujući hladni start (3.2).

---

## 7. Stabilnost u produkciji

- **Alarm u `ml-monitor.yml`:** kad je sedmična P80 pokrivenost van 0,7–0,9 (uz najmanje 20 mjerenja) ili Brier odrađenosti gori od konstante dvije sedmice zaredom, posao otvori issue (`gh issue create`, labela `ml-alert`, jedan otvoren po metrici). Danas to samo piše u summary.
- **Zaštita od lošeg priora:** gate iz 6.4, plus vraćanje jednim revertom (već postoji).
- **Pokretanje uz dovoljno korisnika:** prag iz 6.3.

---

## Odluke (2. nov 2026)

1. Ručni blokovi ulaze u model odrađenosti sa težinom i indikatorom `manual`; trajanje ih već koristi i ostaje tako.
2. Simulator prelazi na populaciju tipova sa metrikom po tipu, hladnim startom i testom pogrešnog priora; baseline i `--check` po tipu.
3. „Šta te najviše koči?“ u onboarding koraku 3, do 3 izbora, svaki odgovor je prior postojećeg mehanizma; „Kad ti je najlakše učiti?“ dobija „Različito / ne znam“.
4. Etapa 11e: tačke 1–3, alarm u monitoru. Pristanak, agregirani izvoz i zajednički trening idu u „Otvaranje za više korisnika“, prije drugog korisnika.

## Otvorena pitanja

- Tačne raspodjele osobina populacije: početne iz literature, fit na stvarne logove kad ih bude više.
- Pravni tekst napomene o privatnosti (GDPR, BiH zakon o zaštiti ličnih podataka) prije otvaranja.

## Izvori

- [Frontiers in Psychology 2025, samoregulacija i prepreke](https://public-pages-files-2025.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1562980/text)
- [Procrastination through the lens of SRL, PMC7760344](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7760344/)
- [Steel 2007, The nature of procrastination](https://prism.ucalgary.ca/handle/1880/47914)
- [Metacognition and Learning, s11409-017-9174-1](https://link.springer.com/10.1007/s11409-017-9174-1)
- [VU Vilnius, spremnost za održivo učenje](https://epublications.vu.lt/object/elaba:103880100/index.html)
- [Preckel et al., hronotip i uspjeh](https://gwern.net/doc/melatonin/2012-preckel.pdf)
- [PH Heidelberg, Randler meta-analiza](https://www.ph-heidelberg.de/uploads/media/phhd201510_%E2%80%9EEulen%E2%80%9C_benachteiligt_01.pdf)
- [Gollwitzer i Sheeran, implementation intentions](https://kops.uni-konstanz.de/handle/123456789/69905)
- [Eliciting new Wikipedia users' interests, ICWSM](https://arxiv.org/pdf/1904.03889)
- [GroupLens, onboarding new users](https://grouplens.org/blog/onboarding-new-users-in-recommender-systems/)
- [Federated Learning with Differential Privacy](https://arxiv.org/pdf/2402.02230)
