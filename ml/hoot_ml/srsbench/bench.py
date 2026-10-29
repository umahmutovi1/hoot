"""Run the benchmark on the downloaded sample and write per-user metrics and the summary.

    uv run --group fsrs python -m hoot_ml.srsbench.bench [--models fsrs6,gru] [--users N]

Models, each per user over the same `TimeSeriesSplit(5)` folds:
- `fsrs6`: personal FSRS-6 parameters fitted on the training fold (the benchmark's FSRS-6)
- `fsrs6_default`: the default parameters, what Hoot uses before ~100 reviews
- `fsrs6_3btn`: personal parameters with Easy read as Good, Hoot's Again/Hard/Good scale
- `gru`: the benchmark's GRU, trained from scratch on the training fold

Writes `ml/fsrs/results/users.jsonl` and `summary.md`.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np
import pandas as pd

from hoot_ml.srsbench.data import DATA, load, local_ids, predictions, prepare, time_series_splits
from hoot_ml.srsbench.metrics import evaluate, summary, wins

RESULTS = Path(__file__).resolve().parents[2] / "fsrs" / "results"
MODELS = ["fsrs6", "fsrs6_default", "fsrs6_3btn", "gru"]
MIN_ROWS = 6

# srs-benchmark README, "without same-day reviews" (9,999 collections), mean ± 99% CI.
REFERENCE = {
    "fsrs6": {"log_loss": 0.3460, "rmse_bins": 0.0653, "auc": 0.7034},
    "gru": {"log_loss": 0.3328, "rmse_bins": 0.0549, "auc": 0.7324},
}


def run_user(frame: pd.DataFrame, models: list[str]) -> dict[str, np.ndarray] | None:
    """Pooled test predictions of every model over the folds, and the scored rows."""
    rows = predictions(frame)
    if len(rows) < MIN_ROWS:
        return None
    out = {m: [] for m in models}
    scored = []
    histories, three = None, None
    if any(m.startswith("fsrs6") for m in models):
        from hoot_ml.srsbench import fsrs6

        histories = fsrs6.Histories(frame)
        if "fsrs6_3btn" in models:
            three = fsrs6.Histories(frame, np.minimum(frame["rating"].to_numpy(), 3))
    for train_idx, test_idx in time_series_splits(len(rows)):
        train, test = rows[train_idx], rows[test_idx]
        scored.append(test)
        for m in models:
            if m == "fsrs6":
                p = fsrs6.predict(fsrs6.fit(histories, train), histories, frame, test)
            elif m == "fsrs6_default":
                p = fsrs6.predict(list(fsrs6.DEFAULT_PARAMETERS), histories, frame, test)
            elif m == "fsrs6_3btn":
                p = fsrs6.predict(fsrs6.fit(three, train), three, frame, test)
            else:
                from hoot_ml.srsbench import gru

                p = gru.fit_predict(frame, train, test)
            out[m].append(p)
    result = {m: np.concatenate(ps) for m, ps in out.items()}
    result["rows"] = np.concatenate(scored)
    return result


def report(users: pd.DataFrame) -> str:
    table = summary(users)
    lines = [
        "| model | users | reviews | log loss | RMSE(bins) | AUC | benchmark (LL / RMSE / AUC) |",
        "|---|---|---|---|---|---|---|",
    ]
    for model, r in table.iterrows():
        ref = REFERENCE.get(model)
        bench = f"{ref['log_loss']:.4f} / {ref['rmse_bins']:.4f} / {ref['auc']:.4f}" if ref else ""
        lines.append(
            f"| {model} | {r['users']:.0f} | {r['reviews']:.0f} "
            f"| {r['log_loss']:.4f}±{r['log_loss_ci']:.4f} "
            f"| {r['rmse_bins']:.4f}±{r['rmse_bins_ci']:.4f} "
            f"| {r['auc']:.4f}±{r['auc_ci']:.4f} | {bench} |"
        )
    lines += ["", "Weighted by reviews:", ""]
    for model, r in table.iterrows():
        lines.append(
            f"- {model}: log loss {r['log_loss_weighted']:.4f}, "
            f"RMSE(bins) {r['rmse_bins_weighted']:.4f}, AUC {r['auc_weighted']:.4f}"
        )
    models = list(table.index)
    if "gru" in models and "fsrs6" in models:
        lines += ["", "Share of users where GRU is better than FSRS-6:", ""]
        for metric in ["log_loss", "rmse_bins", "auc"]:
            lines.append(f"- {metric}: {wins(users, 'gru', 'fsrs6', metric):.0%}")
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--data", type=Path, default=DATA)
    parser.add_argument("--out", type=Path, default=RESULTS)
    parser.add_argument("--models", default=",".join(MODELS))
    parser.add_argument("--users", type=int, default=None, help="only the first N local users")
    args = parser.parse_args()
    models = args.models.split(",")
    ids = local_ids(args.data)[: args.users]
    args.out.mkdir(parents=True, exist_ok=True)
    lines = []
    for n, uid in enumerate(ids, 1):
        started = time.monotonic()
        frame = prepare(load(uid, args.data))
        result = run_user(frame, models)
        if result is None:
            print(f"[{n}/{len(ids)}] user {uid}: too few reviews, skipped")
            continue
        scored = frame.iloc[result["rows"]]
        for m in models:
            lines.append({"user": uid, "model": m, **evaluate(scored, result[m])})
        print(
            f"[{n}/{len(ids)}] user {uid}: {len(scored)} reviews, {time.monotonic() - started:.0f}s"
        )
    users = pd.DataFrame(lines)
    with open(args.out / "users.jsonl", "w") as f:
        for line in lines:
            f.write(json.dumps(line) + "\n")
    text = report(users)
    (args.out / "summary.md").write_text(text)
    print(text)


if __name__ == "__main__":
    main()
