# FSRS-6 prema GRU na uzorku `anki-revlogs-10k`

Reprodukcija [srs-benchmarka](https://github.com/open-spaced-repetition/srs-benchmark) na 100 nasumičnih kolekcija (seed 42) iz [`anki-revlogs-10k`](https://huggingface.co/datasets/open-spaced-repetition/anki-revlogs-10k). Ovo je portfolio stavka iz [RESEARCH-ML-2026-10.md](../../docs/RESEARCH-ML-2026-10.md) 5.3 i ROADMAP-a (Etapa 11a). Hoot ništa od ovoga ne izvršava. Kod je u `hoot_ml/srsbench/`, a analiza u [`notebooks/fsrs_benchmark.ipynb`](../notebooks/fsrs_benchmark.ipynb).

## Pokretanje

Dataset je „gated“: prvo na Hugging Face-u prihvati uslove dataseta i napravi token sa pravom čitanja. Podaci idu u `ml/fsrs/data/`, koji je u `.gitignore` i nikad se ne commita.

```sh
cd ml
uv sync --group fsrs                                                    # fsrs-rs-python, torch, huggingface-hub
HF_TOKEN=hf_... uv run --group fsrs python -m hoot_ml.srsbench.data      # 100 korisnika, seed 42
uv run --group fsrs python -m hoot_ml.srsbench.bench                     # → fsrs/results/
```

`bench` piše `results/users.jsonl` (metrike po korisniku i modelu) i `results/summary.md`. Oba se commitaju jer sadrže samo metrike, ne podatke.

## Protokol

Prati benchmark u postavci „without same-day reviews“:

- Ocjene 1–4. Ponavljanja istog dana nakon prvog se izbacuju, a intervali su u danima. Kartica čija historija ne počinje prvim ponavljanjem (`elapsed_days` = −1) se izbacuje, kao i sve iza 128. ponavljanja kartice.
- Predviđa se svako ponavljanje sa intervalom > 0: zapamćeno (ocjena > Again) iz ranije historije kartice.
- Po korisniku `TimeSeriesSplit(5)` po hronološkom redu. Svaki model se trenira samo na redovima prije test dijela, a predviđanja svih pet test dijelova se spajaju.
- Metrike po korisniku su log-loss, RMSE(bins) i AUC. RMSE(bins) grupiše predviđanja po intervalu, broju ponavljanja i broju zaborava (iste formule kao `utils.rmse_matrix`), pa poredi udio zapamćenih sa prosječnim predviđanjem u grupi. Tabela daje prosjek po korisnicima ± 99 % CI i prosjek ponderisan brojem ponavljanja.

Modeli:

| model | šta je |
|---|---|
| `fsrs6` | FSRS-6 (21 parametar), lični parametri iz trening dijela preko fsrs-rs-python. To je isti Rust optimizer koji Hoot pokreće u browseru (`src/lib/srs/optimize.ts`). |
| `fsrs6_default` | FSRS-6 sa default težinama, kao Hoot prije ~100 ponavljanja |
| `fsrs6_3btn` | `fsrs6` sa Easy pročitanim kao Good, tj. skala Again/Hard/Good koju Hoot dobija iz 0/1/2 |
| `gru` | GRU iz benchmarka (`models/gru.py`, 503 parametra, mješavina dvije krive zaboravljanja) |

Razlike prema benchmarku, zbog kojih se brojevi ne poklapaju 1:1:

- **GRU bez pretreninga.** Benchmark GRU prvo pretrenira Reptile-om na 100 korisnika, pa ga dotrenira po korisniku. Ovdje GRU vidi samo trening dio jednog korisnika, iste podatke kao FSRS-6. Hiperparametri (Adam, lr 0,01, 8 epoha, 64 kartice po batch-u) su izabrani na sintetičkim podacima, ne na uzorku. GRU je zato ovdje slabiji nego u tabeli benchmarka.
- **Bez filtera outliera iz fsrs-optimizera.** fsrs-rs ima vlastiti filter u treningu, ali test redovi se ne filtriraju.
- **Uzorak od 100 od 10 000 kolekcija**, pa su intervali pouzdanosti širi.

## Rezultati

Uzorak je 100 kolekcija (seed 42) sa ukupno 4 070 535 predviđenih ponavljanja (medijan 12 395 po korisniku). Treba ~30 s po korisniku na Apple M5. Ispod je prosjek po korisnicima ± 99 % CI, sa benchmarkom (9 999 kolekcija) u zadnjoj koloni:

| model | log-loss ↓ | RMSE(bins) ↓ | AUC ↑ | benchmark (LL / RMSE / AUC) |
|---|---|---|---|---|
| `fsrs6` | 0,3494 ± 0,0455 | 0,0698 ± 0,0108 | 0,6932 ± 0,0262 | 0,3460 / 0,0653 / 0,7034 |
| `fsrs6_default` | 0,3686 ± 0,0438 | 0,1009 ± 0,0136 | 0,6846 ± 0,0269 | |
| `fsrs6_3btn` | 0,3510 ± 0,0455 | 0,0714 ± 0,0107 | 0,6862 ± 0,0275 | |
| `gru` | 0,3676 ± 0,0480 | 0,0779 ± 0,0119 | 0,6643 ± 0,0284 | 0,3328 / 0,0549 / 0,7324 |

Ponderisano brojem ponavljanja i udio korisnika kod kojih je GRU bolji: [`results/summary.md`](results/summary.md).

- **FSRS-6 se reprodukuje.** Sve tri metrike su unutar 99 % CI od tabele benchmarka.
- **GRU bez pretreninga je lošiji od FSRS-6.** Po log-lossu je bolji samo kod 24 % korisnika, jednako u manjoj i u većoj polovini po broju ponavljanja. Njegova prednost u benchmarku dolazi od pretreninga na mnogo korisnika, a ne od podataka jednog korisnika.
- **Lični parametri donose najviše.** Default težine su lošije za 0,019 log-lossa i 0,031 RMSE(bins).
- **Skala bez Easy skoro ništa ne košta:** 0,0015 log-lossa i 0,0016 RMSE(bins).

## Šta se prenosi na Hoot, a šta ne

- **Ocjene.** Anki ima četiri dugmeta, a Hoot tri samoprocjene (0 „Ne“, 1 „Djelimično“, 2 „Sjećam se“ → Again/Hard/Good) i nema Easy. `fsrs6_3btn` pokazuje koliko FSRS-6 izgubi kad nema Easy. Samo „zapamćeno“ (> Again) ulazi u metrike, pa je razlika mala ako je mala i ovdje. Ali „Djelimično“ nije Ankijev Hard: u Hootu znači da je dio poglavlja ostao, ne da je odgovor bio težak.
- **Jedinice.** Anki kartica je jedna činjenica. Hoot jedinica je poglavlje ili ispitno pitanje, a ocjena je prosjek više stavki (`combineRecall`). Takva jedinica se ne zaboravi odjednom, pa kriva i varijansa ishoda nisu kao kod kartice. Brojevi odavde ne govore koliko je FSRS-6 tačan na Hoot podacima. To mjeri `hoot_ml.monitor` (kalibracija po sedmici iz `review_logs`).
- **Količina podataka.** Prosječna Anki kolekcija ima desetine hiljada ponavljanja, a Hoot korisnik u semestru stotine. Ovo ide u prilog FSRS-6 (21 parametar, default težine kao razuman prior) u odnosu na neuronske modele. GRU sa 503 parametra bez pretreninga na stotinama ponavljanja nema od čega da uči.
- **Ponavljanja istog dana.** Hoot planira po danima, pa je postavka „without same-day“ ona koja odgovara.

Zaključak za Hoot: FSRS-6 sa ličnim parametrima od ~100 ponavljanja (Etapa 11a) ostaje izbor. Neuronski model bi imao smisla tek uz pretrening na mnogo korisnika, a i tada je preteži za browser.
