# Hoot ML (`ml/`)

Python trenira i radi backtest, a TS (`src/lib/`) izvršava. Artefakti su JSON sa `version`, koji ide u `input_hash`. Obrazloženje je u [RESEARCH-ML-2026-10.md](../docs/RESEARCH-ML-2026-10.md), a stavke u [ROADMAP.md](../docs/ROADMAP.md) (Etapa 11a).

## Postavljanje

```sh
cd ml
uv sync          # dev + models (NumPyro, scikit-learn, SciPy) + notebooks
uv run pytest
uv run ruff check . && uv run ruff format --check .
```

## Izvoz podataka

Izvoz čita Data API kao ti, pa RLS odlučuje šta se vraća. Service-role ključ ne treba. Izlaze samo kolone iz `TABLES` u `hoot_ml/export.py`, bez slobodnog teksta: naslova, imena, bilješki, odgovora i refleksija. Od `plan_blocks.reason` ostaje samo kod.

1. Otvori Hoot u browseru i prijavi se.
2. DevTools → Application → Local Storage → `sb-<ref>-auth-token` → kopiraj `access_token`. Token važi oko sat vremena.
3. Pokreni:

```sh
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # isti kao VITE_SUPABASE_PUBLISHABLE_KEY
HOOT_ACCESS_TOKEN=<access_token> uv run python -m hoot_ml.export
```

Parquet fajlovi idu u `ml/data/`, koji je u `.gitignore` i nikad se ne commita.

U CI-ju (`train.yml`, `ml-monitor.yml`) nema sesije iz browsera: `--db` se spaja sa `SUPABASE_DB_URL`, prelazi u ulogu `authenticated` i postavlja JWT claim `sub` = `HOOT_USER_ID`, pa iste RLS politike kao u appu biraju redove, a iste kolone iz `TABLES` izlaze (podešavanje: `docs/SETUP.md` 5e).

```sh
SUPABASE_DB_URL=... HOOT_USER_ID=... uv run python -m hoot_ml.export --db
```

## Trening i praćenje (MLOps)

- `uv run python -m hoot_ml.train [--write]`: fit model trajanja (σ, τ_izvor; od 30 sesija) i modela odrađenosti (τ_predmet; od 200 blokova) + backtest sa trenutnim i novim priorom. Novi `priors.json` (nova `version`) samo uz `--write`, kad ima dovoljno podataka, kad se fit pomjerio (≥ 0,02) i kad backtest nije lošiji. Bez `--write` samo izvještaj.
- `npm run ml:cases`: osvježi očekivane brojeve u primjerima TS = Python iz trenutnih priora (ulazi ostaju).
- `npm run sim -- --seeds 100 --check --report sim.md`: izlaz 1 kad je neka metrika lošija od `scripts/sim/baseline.json` preko tolerancije.
- `uv run python -m hoot_ml.monitor`: po sedmici pokrivenost P80 trajanja, Brier odrađenosti (i konstanta kao mjera) i kalibracija FSRS-a iz `review_logs` (prosječni R prije ponavljanja prema udjelu zapamćenih).

`train.yml` (ručno i mjesečno): izvoz → `train --write` → `ml:cases` → testovi TS = Python → simulator (`--check` + DoD testovi) → PR u `dev` samo bez pogoršanja, inače samo izvještaj. Vraćanje: revert PR-a sa artefaktom.

## Oznake bloka

Pravilo je isto kao u `src/lib/ml/labels.ts`, a oba testa čitaju iste primjere iz `src/lib/ml/labels.cases.json` (test TS = Python):

- **odrađen:** sesija na bloku ili status `done`
- **preskočen:** „Danas ne mogu“ (status `skipped`) i svaki red u `block_skips` („Preskoči“ za termin koji je blok napustio)
- **nepotvrđen:** dan je prošao, a ništa nije označeno. `missed` spada ovdje i ne znači neuspjeh. Proteklo vrijeme nikad ne daje „odrađen“.

`prev_late`: prethodni AI blok tog dana (po planiranom početku) je počeo više od 5 min nakon `planned_start` (prva sesija na njemu), kao `completionExamples()` u `src/lib/slots/examples.ts`.

## Notebooks

`notebooks/eda.ipynb`: oznake po dijelu dana, opterećenju i danu u sedmici, stvarno trajanje prema planiranom, ometanja i kalibracija R prije ponavljanja.

`notebooks/duration_backtest.ipynb`: model trajanja prema starom blendu (MAE log-minuta, pokrivenost P80).

`notebooks/completion_backtest.ipynb`: model odrađenosti bloka sa predmetom, bez predmeta i konstanta (Brier, log-loss), efekti predmeta. Bez izvoza radi na primjerima simulatora (`npm run sim -- --seeds 30 --examples ml/data/sim_blocks.json`) ili sintetičkim primjerima. Primjeri TS = Python: `src/lib/slots/completion.cases.json`.

`notebooks/fsrs_benchmark.ipynb`: FSRS-6 prema GRU na uzorku `anki-revlogs-10k` (portfolio, RESEARCH-ML 5.3). Čita samo metrike iz `fsrs/results/`. Pokretanje, protokol i šta se (ne) prenosi na Hoot: [`fsrs/README.md`](fsrs/README.md). Treba grupu `fsrs` (`uv sync --group fsrs`: torch, fsrs-rs-python), koja nije u default grupama.

```sh
uv run jupyter lab notebooks/
```
