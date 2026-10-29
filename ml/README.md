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

## Oznake bloka

Pravilo je isto kao u `src/lib/ml/labels.ts`, a oba testa čitaju iste primjere iz `src/lib/ml/labels.cases.json` (test TS = Python):

- **odrađen:** sesija na bloku ili status `done`
- **preskočen:** „Danas ne mogu“ (status `skipped`) i svaki red u `block_skips` („Preskoči“ za termin koji je blok napustio)
- **nepotvrđen:** dan je prošao, a ništa nije označeno. `missed` spada ovdje i ne znači neuspjeh. Proteklo vrijeme nikad ne daje „odrađen“.

## Notebooks

`notebooks/eda.ipynb`: oznake po dijelu dana, opterećenju i danu u sedmici, stvarno trajanje prema planiranom, ometanja i kalibracija R prije ponavljanja.

```sh
uv run jupyter lab notebooks/
```
