# Hoot — istraživanje: adaptivni scheduling i ML

25. okt 2026 · tokom Etape 10c. Nastavak sekcije 6 iz [RESEARCH-2026-10.md](RESEARCH-2026-10.md). Odluke su prenesene u [ROADMAP.md](ROADMAP.md) kao **Etapa 11a — ML temelj** i u [PRD.md](PRD.md) („Procjena težine i vremena“, „Termini učenja“, „Prognoza spremnosti“). PRD je izvor istine; ovdje ostaju obrazloženje i izvori.

## Sažetak

1. **Scheduling je već besplatan.** `plan()` i `placeTimes()` su deterministički TypeScript, a LLM se plaća samo za uvoz, objašnjenja i asistenta. Vlastiti model ne treba „da bi plan bio besplatan“. Treba za tačnije procjene, za kalibriranu prognozu i kao ML projekat za portfolio.
2. **Hoot već uči, ali ručno odabranim konstantama.** `k/(k+5)`, `n/(n+3)`, `j/(j+2)` i ρ sa `(n·m + 7·0.8)/(n+7)` su sve shrinkage prema prioru. To je ispravna ideja (empirical Bayes), samo su jačine priora pogođene, a ne naučene. Najveći dobitak je formalizovati to u hijerarhijski Bayesov model čije hiperparametre fituje Python.
3. **Najbolji kandidat za ML je P(blok bude odrađen).** Podaci se skupljaju sami (`plan_blocks.status`, termin, opterećenje dana, dani do ispita), ishod je binaran i čest, a rezultat direktno popravlja kapacitet, termine i prognozu.
4. **Procjena trajanja treba biti raspon, ne broj.** Log-normalni model daje P50 i P80. Planiranje po P80 za važne predmete je pametnija rezerva od fiksnog `RESERVE = 0.9`.
5. **FSRS radi na default težinama.** `profiles.fsrs_params` postoji, ali ga niko ne čita, a `review_logs` ne čuva polja koja optimizer treba (ocjena 1–4, stanje i težina prije ponavljanja). To treba popraviti odmah, jer se podaci skupljaju od danas.
6. **Diskretna matematika kao test, ne kao zamjena.** Tačan test izvodljivosti (EDF / max-flow, Horn 1974) kaže da li sav obavezni posao staje do rokova. Kao property test pokazaće gdje pohlepni waterfill i ALAP kampanja griješe. LP (HiGHS u WASM-u) tek ako taj test nađe stvarne propuste.
7. **Podaci: tri sloja.** Javni Anki dataset za FSRS, simulator studenta koji pokreće pravi `plan()` za poređenje politika, i hijerarhijski prior populacije pa lični posterior. Novi korisnik odmah dobija razumne procjene.
8. **Python trenira, TS izvršava.** Modeli su linearni i konjugatni, pa izlaz je mali JSON (koeficijenti, hiperparametri) u `src/lib/`. Nema ONNX-a, nema servera, sve radi offline i ulazi u `input_hash`.
9. **Fine-tune LLM-a se ne isplati.** Scheduling ga ne treba, a za `parse-document` je skupo i van obima.
10. **Radovi iz poruke daju ideje, ali ne metodu.**
    - IJRASET rad poziva Gemini da napravi plan.
    - Lingshetti 2025 predlaže Q-learning sa nagradom „dobitak − zamor“, bez stanja, podataka i koda.
    - Chauhan 2025 je pregled za građevinske projekte sa nedosljednim tabelama.
    - Awesome-lista samo potvrđuje smjer.
    - Reddit tema je najkorisnija: korisnici traže lanac dokument → raspored → replan, kakav Hoot već ima, i da app „ne izmišlja njihove brojeve“, što ulazi u model trajanja kao prior.

---

## 1. Šta su dali izvori iz zahtjeva

| Izvor | Šta je | Upotrebljivo |
| --- | --- | --- |
| [IJRASET 2026, „AI Powered Smart Study Planner“](https://www.ijraset.com/best-journal/ai-powered-smart-study-planner-309) | React + Django + Gemini API koji generiše plan i kvizove | Ne. Nema algoritma, dataseta ni evaluacije; „Results“ su screenshotovi. Potvrđuje samo da je LLM kao planer uobičajen, i zato je deterministički `plan()` diferencijacija |
| [Lingshetti i dr. 2025, IJSRSET 12(3)](https://www.researchgate.net/publication/391661197_AI-Powered_Smart_Study_Planner_Enhancing_Personalized_Learning_Through_Intelligent_Scheduling) | Q-learning scheduler sa nagradom `R(t) = α·P(t) − β·C(t) + γ·M(t)` (dobitak znanja, zamor, motivacija); decision tree / SVM za „tip učenika“, Bayesian Knowledge Tracing, collaborative filtering; 30 studenata, 4 sedmice, +24 % prema +8,9 % u kontrolnoj grupi | Ideja da. Oblik nagrade (dobitak − trošak zamora) je isti kao naš kriterij `ΔR(dan ispita) × bodovi` po minuti (5.3), a zamor već pokrivaju predlošci sesije. Metoda ne: Q-learning nema definisano stanje ni akcije, nema podataka ni koda, a 30 korisnika kroz 4 sedmice je premalo za RL. Rezultat nije ponovljiv (nema randomizacije ni veličine efekta). BKT je zamijenjen FSRS-om, koji je bolje izmjeren (srs-benchmark) |
| [Chauhan 2025, IJETMR 12(5)](https://www.researchgate.net/publication/392703149_ADAPTIVE_SCHEDULING_APPLYING_AI_AND_MACHINE_LEARNING_TO_OPTIMIZE_PROJECT_TIMELINES_AND_RESOURCE) | Pregled ML-a u upravljanju građevinskim projektima: stabla odlučivanja i neuronske mreže za trajanje zadataka; tabele za 5 projekata (−10 % trajanja, +20 % „tačnosti“ procjene) | Samo potvrda smjera. Metodologija spominje 10 pa 12 projekata, a tabele 5; „tačnost“ nije definisana; dio referenci se ne može naći. Korisno je samo podsjećanje na PERT (vjerovatnosna trajanja), što podržava P50/P80 iz 5.1 |
| [awesome-time-tracking: AI predictive scheduling](https://github.com/ever-works/awesome-time-tracking/blob/develop/details/ai-predictive-scheduling-algorithms.md) | Pregled: predikcija trajanja, energija po dobu dana, optimizacija kalendara, adaptivni replan; Motion, Reclaim, SkedPal | Smjer da, model ne. Bez arhitektura, featura i referenci |
| [Reddit r/ProductivityApps](https://www.reddit.com/r/ProductivityApps/comments/1vbwi6a/is_there_an_ai_calendar_that_can_turn_a_study/) | Studentica za board ispit traži app koji 15 str. plana (moduli u „danima“) pretvori u raspored | Da, vidi 1.1 |

### 1.1 Šta Reddit tema kaže o potrebama

Lista želja iz posta: (1) uvoz dokumenta „bez reinterpretacije mojih brojeva“, (2) vlastita dostupnost umjesto 9–17, (3) automatski replan kad kasni, (4) vremenski budžet po zadatku unutar modula, da se ne zaglavi, (5) Google Calendar sync, (6) boje po projektu. Odgovori su skoro jednoglasni: nijedan alat ne radi cijeli lanac. Savjetuju da se razdvoje ekstrakcija (LLM → tabela) i scheduling (Motion, Reclaim, TurboHog, Kairos, Increment), a da konverziju „dan → sati“ korisnik uradi sam množiteljem.

Šta to znači za Hoot:

- **Hoot pokriva tačke 1–4 i 6** u jednom lancu (uvoz s pregledom, dostupnost, replan, minute po jedinici, boje predmeta). Tačka 5 je ICS izvoz u Etapi 12, a upis u Google Calendar je pod „Kasnije“. To je diferencijacija koju vrijedi pokazati u portfoliju.
- **„Ne izmišljaj moje brojeve“ je ML zahtjev.** Kad dokument nosi trajanja („modul 2 dana“), to je najjači prior za taj izvor. U modelu 5.1 korisnikov broj ulazi kao prior sa vlastitom varijansom, koriguje se ličnim planning-fallacy faktorom i nikad se ne prepisuje (`assigned_by = 'user'`). „Koliko sati je jedan dan“ je upravo `b_korisnik`: naučen, a ne pitanje u postavkama.
- **„Budžet po zadatku unutar modula“** je raspodjela budžeta modula na jedinice po težini i obimu. To `estimates` već radi za stranice; ostaje da uvoz zna za trajanje na nivou modula. Prijedlog za `parse-document` šemu, van ove etape.

---

## 2. Gdje je Hoot danas

| Oblast | Danas | Ograničenje |
| --- | --- | --- |
| Trajanje (`src/lib/estimates/`) | `rate = k/(k+5)·izmjereno + 5/(k+5)·baza`, korekcija težine `n/(n+3)`, faktor brzine `j/(j+2)` | Jačine priora (5, 3, 2) su pogođene. Rezultat je jedan broj, bez nesigurnosti. Brzina ne zavisi od termina ni načina rada osim preko para izvor × način |
| Realizacija ρ (`scheduler/realization.ts`) | Jedan ρ za 14 dana, shrinkage prema 0.8 | Isti ρ za jutro i veče, radni dan i vikend, lak i težak blok |
| Termini (`scheduler/place.ts:92`) | 1 u željenom dijelu dana, inače 0.6 | Placeholder do Etape 11 |
| FSRS (`src/lib/srs/`) | ts-fsrs v6, default težine, ciljni R po prioritetu, klamp na datum ispita | Bez ličnih parametara. `review_logs` nema ocjenu 1–4, stanje, težinu ni R prije ponavljanja. Redoslijed ponavljanja je heuristika (bliži ispit, pa niži R) |
| Raspodjela minuta (`scheduler/plan.ts`) | Pohlepno po danima: hitnost, waterfill, ALAP za kampanje, deficit | Nema dokaza da je raspodjela izvodljiva kad jeste. Property testovi provjeravaju kapacitet i determinizam, ali ne optimalnost |
| Prognoza | Planiran Monte Carlo iz bootstrapa dnevnih minuta (Etapa 11) | Bootstrap ne zna da je ispitni rok drugačiji od semestra i ne koristi nesigurnost trajanja |

---

## 3. Odluka o podacima

Problem: jedan korisnik, desetine sesija, a kasnije više korisnika. Razmotrene opcije:

| Opcija | Za | Protiv |
| --- | --- | --- |
| Samo tvoji podaci | Tačno tvoje ponašanje | Premalo za bilo šta osim konjugatnih modela; nema načina da se uporede politike („šta da je plan bio drugačiji“) |
| Javni dataseti | Velik obim (Anki: ~727M ponavljanja, 10k korisnika) | Postoje samo za pamćenje (FSRS). Za trajanje učenja i odrađenost blokova nema javnog dataseta sličnog Hootu |
| Simulator | Neograničeno, kontrolisano, kontrafaktualno | Model studenta je pretpostavka; mora se kalibrisati na stvarne logove |

**Odluka: sva tri, svaki za ono za šta je dobar.**

1. **Javni podaci gdje postoje.** [srs-benchmark](https://github.com/open-spaced-repetition/srs-benchmark) i dataset `open-spaced-repetition/anki-revlogs-10k` na Hugging Faceu za reprodukciju benchmarka FSRS-a i priora pamćenja.
2. **Simulator za evaluaciju politika.** Stvarni logovi nikad ne kažu šta bi bilo uz drugi plan. Simulator to kaže, ali samo ako pokreće pravi kod, pa je pisan u TS-u i poziva `plan()` i `placeTimes()`. Model studenta: trajanje log-normalno oko procjene uz planning fallacy, odrađenost bloka po terminu i opterećenju, zaboravljanje preko FSRS-a, „Danas ne mogu“ dani. Parametri iz literature, kasnije fit na stvarne logove.
3. **Hijerarhijski Bayes.** Prior populacije, pa lični posterior. Python fituje hiperparametre: sad iz simulatora i tvojih podataka, kasnije iz svih korisnika (anonimno, agregat). TS radi zatvorene online update-e po korisniku. Ovo je formalna verzija `k/(k+c)` obrasca koji Hoot već koristi ([partial pooling](https://www.huber.embl.de/users/kaspar/teaching/bayes-r/tutorial-partial-pooling.html), [empirical Bayes za cold start, Amazon](https://cdn.amazon.science/b5/2f/a9d9581d4f8eab473a4ab4a8ad35/addressing-cold-start-in-product-search-via-empirical-bayes.pdf), [IntelligentPooling](https://arxiv.org/pdf/2008.01571)).

Kad se app otvori za više korisnika, sloj 3 prirodno raste: isti kod, samo prior populacije postaje tačniji. Ništa se ne preprojektuje.

---

## 4. Arhitektura

```
ml/ (Python, uv)                      src/lib/ (TS, čista logika)
  export/   podaci kao korisnik  ─┐     estimates/priors.json ─┐
  notebooks/ EDA, fit, backtest   ├─▶   slots/priors.json      ├─▶ plan(), placeTimes(), forecast()
  fsrs/     srs-benchmark         │     (version u input_hash) ┘
scripts/sim/ (TS, node)           │
  pravi plan() + model studenta ──┘ logovi u obliku baze → Python fit i poređenje politika
```

- **`ml/`:** numpy, pandas, scipy, scikit-learn, NumPyro, jupyter, matplotlib, upravljano sa `uv`. Izvoz čita podatke kao korisnik (anon ključ + RLS, kao lokalni harness), u parquet, bez slobodnog teksta (refleksije, naslovi).
- **Artefakt:** mali JSON sa poljem `version`. Linearni i konjugatni modeli se izvršavaju u nekoliko linija TS-a, pa [ONNX Runtime Web](https://npmjs.com/package/onnxruntime-web) nije potreban. TS test provjerava da inference daje iste brojeve kao Python na fiksnim primjerima.
- **Determinizam:** lični parametri i verzija artefakta su ulazi schedulera i ulaze u `input_hash`. Thompson uzorkovanje koristi postojeći `seededRandom` iz `scheduler/hash.ts`.
- **Metrike politika u simulatoru** (fiksni seedovi, N studenata × M semestara): R na dan ispita ponderisan bodovima, deficit u minutama, propušteni blokovi, promjena plana između replana, varijansa dnevnog opterećenja. Svaka promjena schedulera prijavljuje ih u odnosu na baseline.

---

## 5. Modeli po oblastima

### 5.1 Trajanje: hijerarhijski log-normalni model

```
log(min po jedinici mjere) = μ[kind, measure] + b_korisnik + b_izvor + β_mode + β_d·(d − 3) + ε
b_korisnik ~ N(0, τ_k²) · b_izvor ~ N(0, τ_i²) · ε ~ N(0, σ²)
```

- **Zašto log:** trajanja su pozitivna i desno nakrivljena. Ljudi sistematski potcjenjuju duže zadatke ([planning fallacy](https://en.wikipedia.org/wiki/Planning_fallacy)), pa greške rastu multiplikativno.
- **Veza sa sadašnjim kodom:** posterior srednje vrijednosti efekta izvora je tačno `k/(k + σ²/τ_i²) · izmjereno + …`. Konstanta 5 u `k/(k+5)` postaje omjer `σ²/τ_i²` koji se fituje (marginalni likelihood). Isto važi za `j/(j+2)` (nivo korisnika) i `n/(n+3)` (težina).
- **Izlaz:** posterior prediktivna raspodjela daje P50 i P80. Plan koristi P50, a za prioritet 4–5 P75–P80. To je rezerva svjesna nesigurnosti: kad izvor ima 20 mjerenja, rezerva se smanji sama.
- **Korisnikov broj je prior, ne zamjena:** kad korisnik ili uvezeni dokument da trajanje, ono ulazi kao prior izvora sa vlastitom varijansom, uz lični faktor optimizma. Mjerenja ga postepeno preuzimaju, a sam broj ostaje sačuvan (`assigned_by = 'user'`), kao u 1.1.
- **Online u TS-u:** Normal-Normal konjugat, update u zatvorenom obliku po sesiji. Python samo fituje `μ`, `β`, `τ`, `σ`.
- **Evaluacija:** vremenski backtest (fit do dana t, predikcija poslije), MAE na log-minutama, pokrivenost P80 intervala (cilj ~80 %), poređenje sa sadašnjim blendom.

### 5.2 Odrađenost bloka: Bayesovska logistička regresija

```
P(done) = σ(β₀ + β_dio_dana + β_vikend + β_kind + β_demand·demand + β_load·opterećenje_dana
            + β_ispit·log(1 + dani_do_ispita) + β_kasni·prethodni_blok_kasnio + u_korisnik)
```

- **Zašto ovo:** ishod je binaran, čest (svaki blok) i dolazi bez truda korisnika. Direktno popravlja tri stvari:
  - **Kapacitet:** umjesto jednog ρ, očekivani rad u terminu je `Σ P(done)·minute`.
  - **Ocjena termina:** odrađenost je jedan od signala iz PRD „Termini učenja“ (Beta po terminu postaje poseban slučaj ovog modela).
  - **Prognoza:** `forecast()` uzorkuje odrađenost po bloku, a ne dnevne minute.
- **Interpretabilnost:** koeficijenti se prevode u rečenice („navečer ti propadne 40 % blokova“), u skladu sa „Uvidi“ u PRD-u.
- **Lični update:** Laplaceova aproksimacija oko priora iz Pythona, update po bloku u TS-u. Gradient boosting tek kad bude podataka od više korisnika, i samo ako backtest pokaže dobitak (log loss, Brier, kalibracijska kriva).
- **Thompson za termine:** ostaje kako je planirano u Etapi 11, uz sigurno istraživanje: uzorkuje se samo među terminima unutar ε od najboljeg, najviše jedan istraživački blok sedmično. Izvor obrasca: kontekstualni banditi u mobilnim intervencijama ([Drink Less, Thompson sampling](https://arxiv.org/abs/2311.14359v1)).

### 5.3 FSRS

- **Higijena podataka (odmah):** `review_logs` dobija `rating` (1–4), `state_before`, `difficulty_before`, `retrievability_before`. Bez toga optimizer nema šta da uči.
- **Lični parametri:** [`@open-spaced-repetition/binding`](https://github.com/open-spaced-repetition/ts-fsrs/tree/main/packages/binding) (`computeParameters`, WASI build za browser u Workeru) kad korisnik ima ≥100 ponavljanja; upis u `profiles.fsrs_params`, `srs/index.ts` ga čita i šalje u `input_hash`.
  - **Rizik:** README preporučuje `Cross-Origin-Opener-Policy` i `Cross-Origin-Embedder-Policy` headere, što može smetati Google Drive pickeru i OAuth popupima. Prvo spike sa threadless buildom; rezerva je [`fsrs-browser`](https://www.npmjs.com/package/fsrs-browser) ili trening u `ml/` dok je jedan korisnik.
- **Ponavljanja ciljana na ispit:** cilj nije R danas nego R na dan ispita (već zapisano u RESEARCH-2026-10, 6.4). Uz ograničen budžet ponavljanja, birati jedinicu sa najvećim `ΔR(dan ispita) × bodovi` po minuti. Pohlepni izbor po marginalnom dobitku je standardan pristup za ovakve probleme sa opadajućim prinosom. Teorijska pozadina: optimalno raspoređivanje ponavljanja kao stohastička kontrola ([MEMORIZE, PNAS 2019](https://www.pnas.org/doi/10.1073/pnas.1815156116)) i stochastic shortest path ([SSP-MMC, KDD 2022](https://dl.acm.org/doi/pdf/10.1145/3534678.3539081)). Za Hoot je dovoljna pohlepna verzija sa fiksnim horizontom (datum ispita).
- **Python (portfolio):** reprodukcija srs-benchmarka na uzorku (FSRS-6 prema GRU/LSTM; RWKV vodi tabelu, ali je preteško za browser). Upozorenje: Hoot jedinice su poglavlja i pitanja, ocjene su 0/1/2, pa rezultati sa Anki kartica ne prenose se direktno.

### 5.4 Scheduler: test izvodljivosti

- **Problem raspodjele minuta po danima je transportni problem:** dani su ponuda (kapacitet), ciljevi su potražnja sa rokom. Za jednu „mašinu“ sa prekidima, EDF (najraniji rok prvi) je optimalan za izvodljivost, a za opšti slučaj postoji tačna formulacija kao max-flow ([Horn 1974](https://ideas.repec.org/a/wly/navlog/v21y1974i1p177-185.html), [generalizacija preko mreža, 2024](https://www.citedrive.com/en/discovery/generalizing-horns-conditions-for-preemptive-scheduling-on-identical-parallel-machines-via-network-flow-techniques)).
- **Upotreba:** `src/lib/scheduler/feasibility.ts` kao oracle. Property test: ako oracle kaže „sve staje“, `plan()` nema deficit. Svaki kontraprimjer koji fast-check nađe je stvarna greška pohlepnog algoritma (npr. kampanja koja krene prekasno jer je drugi cilj pojeo kapacitet).
- **LP samo ako treba:** ako oracle pokaže propuste, raspodjela minuta postaje LP (min max dnevnog opterećenja uz rokove) preko [HiGHS u WASM-u](https://npmjs.org/package/highs). `placeTimes()` ostaje pohlepan; Hungarian algoritam za blokove po terminima ne treba za ≤6 blokova dnevno.

### 5.5 Prognoza i strateg

- `forecast()` uzorkuje iz posteriora trajanja (5.1) i odrađenosti (5.2) umjesto bootstrapa dnevnih minuta. Daje kalibriranu P(obavezno pokriveno do ispita). Mjera nakon ispita: Brier score.
- Predikcija ocjene ostaje na pravilima; ispita je premalo po korisniku. `readiness_before` i rezultati se skupljaju za kasnije.
- Strateg i dalje bira među kandidatima iz pravila; ML modeli mu daju brojeve za objašnjenje, ne nove akcije.

---

## 6. Šta se ne preporučuje

- **Neuronske mreže na podacima jednog korisnika.** Premalo podataka; konjugatni modeli daju istu tačnost i objašnjivi su.
- **LLM kao planer** (pristup IJRASET rada). Nedeterministički, skup, ne može se testirati property testovima.
- **Reinforcement learning za cijeli plan.** Bez simulatora visoke vjernosti uči artefakte simulatora. Bandit za termine je dovoljan oblik RL-a.
- **Fine-tune malog LLM-a.** Nema veze sa schedulingom; za `parse-document` je trošak održavanja veći od uštede.

---

## Odluke (25. okt 2026)

1. Podaci u tri sloja: javni Anki dataset za FSRS, TS simulator sa pravim `plan()`, hijerarhijski prior populacije pa lični posterior.
2. Python (`ml/`) trenira, TS (`src/lib/`) izvršava; artefakti su JSON sa verzijom u `input_hash`.
3. Redoslijed: higijena podataka → `ml/` i simulator i test izvodljivosti → model trajanja → odrađenost bloka i termini → lični FSRS i ponavljanja ciljana na ispit → forecast iz posteriora. Etapa 11a u ROADMAP-u.
4. LP i Hungarian samo ako test izvodljivosti, odnosno simulator, pokažu potrebu.

## Otvorena pitanja

- Trajanja na nivou modula iz uvezenog dokumenta (1.1): proširiti šemu `parse-document` i koristiti ih kao prior. Odluka van Etape 11a.
- COOP/COEP za FSRS optimizer u browseru: odlučiti nakon spike-a (5.3).

## Izvori

- Pamćenje: [srs-benchmark](https://github.com/open-spaced-repetition/srs-benchmark) · [ts-fsrs binding (optimizer)](https://github.com/open-spaced-repetition/ts-fsrs/tree/main/packages/binding) · [fsrs-browser](https://www.npmjs.com/package/fsrs-browser) · [fsrs4anki](https://github.com/Expertium/fsrs4anki) · [Tabibian i dr., MEMORIZE, PNAS 2019](https://www.pnas.org/doi/10.1073/pnas.1815156116) · [Ye i dr., SSP-MMC, KDD 2022](https://dl.acm.org/doi/pdf/10.1145/3534678.3539081) · [DAS3H](https://arxiv.org/pdf/1905.06873)
- Bayes i personalizacija: [partial pooling tutorial](https://www.huber.embl.de/users/kaspar/teaching/bayes-r/tutorial-partial-pooling.html) · [Amazon, empirical Bayes za cold start](https://cdn.amazon.science/b5/2f/a9d9581d4f8eab473a4ab4a8ad35/addressing-cold-start-in-product-search-via-empirical-bayes.pdf) · [IntelligentPooling](https://arxiv.org/pdf/2008.01571) · [Thompson sampling, Drink Less](https://arxiv.org/abs/2311.14359v1)
- Procjena vremena i ponašanje: [Planning fallacy](https://en.wikipedia.org/wiki/Planning_fallacy) · [Hawkes procesi za prokrastinaciju studenata](https://arxiv.org/pdf/2102.00089) · [Procrastination modeling, UW](https://digital.lib.washington.edu/researchworks/items/d6010a9b-56d5-4739-8712-f5809f5f3f6e)
- Raspoređivanje: [Horn 1974, Some simple scheduling algorithms](https://ideas.repec.org/a/wly/navlog/v21y1974i1p177-185.html) · [Shioura, Strusevich, Shakhlevich 2024](https://www.citedrive.com/en/discovery/generalizing-horns-conditions-for-preemptive-scheduling-on-identical-parallel-machines-via-network-flow-techniques) · [highs-js (HiGHS u WASM-u)](https://github.com/coder0xff/highs-js) · [Making the most of your day: online learning for time allocation](https://arxiv.org/pdf/2102.08087)
- Iz zahtjeva: [IJRASET 2026](https://www.ijraset.com/best-journal/ai-powered-smart-study-planner-309) · [Lingshetti i dr. 2025, doi 10.32628/IJSRSET2512320](https://doi.org/10.32628/IJSRSET2512320) · [Chauhan 2025, doi 10.29121/ijetmr.v12.i5.2025.1631](https://doi.org/10.29121/ijetmr.v12.i5.2025.1631) · [Reddit r/ProductivityApps](https://www.reddit.com/r/ProductivityApps/comments/1vbwi6a/is_there_an_ai_calendar_that_can_turn_a_study/) · [awesome-time-tracking](https://github.com/ever-works/awesome-time-tracking/blob/develop/details/ai-predictive-scheduling-algorithms.md)
