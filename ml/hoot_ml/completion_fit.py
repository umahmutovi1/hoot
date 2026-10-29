"""Fit and backtest of the block completion model (RESEARCH-ML 5.2, ROADMAP 11a).

Examples are labelled AI blocks (`data.block_examples()` from the export, or the simulator's
`ml/data/sim_blocks.json`). With one user the coefficient means stay heuristic: fitting them on
the same blocks the app then updates on would count the data twice. The fit moves tau_subject
(Laplace marginal likelihood); the means move once there are several users.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from hoot_ml.completion import PRIORS_PATH, Example, fit, load_priors, probability

MIN_FIT_BLOCKS = 200


def examples_from_frame(frame: pd.DataFrame) -> list[Example]:
    """From `data.block_examples()` rows (snake_case export columns)."""
    out = []
    for r in frame.itertuples():
        if r.part is None or pd.isna(r.part):
            continue
        out.append(
            Example(
                subject_id=str(r.subject_id),
                on_date=str(r.on_date)[:10],
                label=r.label,
                part=r.part,
                weekend=pd.Timestamp(r.on_date).day_of_week >= 5,
                kind=r.kind,
                demand=1.0 if pd.isna(r.demand) else float(r.demand),
                day_load_min=0.0 if pd.isna(r.day_load_min) else float(r.day_load_min),
                days_to_goal=None if pd.isna(r.days_to_goal) else float(r.days_to_goal),
                prev_late=bool(r.prev_late),
            )
        )
    return out


def sim_examples(path: Path, run: int | None = None) -> list[Example]:
    rows = json.loads(path.read_text(encoding="utf-8"))
    return [Example.from_json(r) for r in rows if run is None or r["run"] == run]


def fit_tau(examples: list[Example], today: str, grid=(0.25, 0.5, 0.75, 1, 1.5, 2)) -> float:
    """tau_subject with the highest Laplace evidence."""
    p = load_priors()
    scores = {tau: fit(examples, today, p={**p, "tauSubject": tau}).log_evidence for tau in grid}
    return max(scores, key=scores.get)


def write_priors(changes: dict, fitted_from: str, path: Path = PRIORS_PATH) -> dict:
    """A new artefact version (it goes into input_hash through the app)."""
    old = load_priors(path)
    new = {**old, **changes, "version": old["version"] + 1, "fittedFrom": fitted_from}
    path.write_text(json.dumps(new, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return new


@dataclass
class Backtest:
    n: int
    brier: float
    log_loss: float
    brier_no_subject: float
    log_loss_no_subject: float
    brier_constant: float


def predictions(
    examples: list[Example], min_history: int = 20, p: dict | None = None
) -> pd.DataFrame:
    """Time-ordered: every day's blocks are predicted from the blocks of earlier days, by the
    model, the model without subjects and a constant (the done share so far). Outcome: done = 1,
    anything else 0. One row per predicted block."""
    p = p or load_priors()
    rows = []
    for day in sorted({e.on_date for e in examples}):
        seen = [e for e in examples if e.on_date < day]
        if len(seen) < min_history:
            continue
        with_s = fit(seen, day, p=p)
        without = fit(seen, day, p=p, subject_effect=False)
        rate = sum(e.label == "done" for e in seen) / len(seen)
        for e in (e for e in examples if e.on_date == day):
            rows.append(
                {
                    "on_date": day,
                    "y": 1.0 if e.label == "done" else 0.0,
                    "model": probability(with_s, e, p),
                    "no_subject": probability(without, e, p),
                    "constant": rate,
                }
            )
    return pd.DataFrame(rows, columns=["on_date", "y", "model", "no_subject", "constant"])


def brier(pred: pd.DataFrame, column: str = "model") -> float:
    return float(np.mean((pred[column] - pred["y"]) ** 2))


def log_loss(pred: pd.DataFrame, column: str = "model") -> float:
    q = np.clip(pred[column].to_numpy(), 1e-9, 1 - 1e-9)
    y = pred["y"].to_numpy()
    return float(-np.mean(y * np.log(q) + (1 - y) * np.log(1 - q)))


def backtest(examples: list[Example], min_history: int = 20, p: dict | None = None) -> Backtest:
    pred = predictions(examples, min_history, p)
    if pred.empty:
        nan = math.nan
        return Backtest(0, nan, nan, nan, nan, nan)
    return Backtest(
        n=len(pred),
        brier=brier(pred),
        log_loss=log_loss(pred),
        brier_no_subject=brier(pred, "no_subject"),
        log_loss_no_subject=log_loss(pred, "no_subject"),
        brier_constant=brier(pred, "constant"),
    )


def synthetic_examples(seed: int, n: int = 240, avoided: float = -1.2) -> list[Example]:
    """Blocks from a known truth (for tests and the notebook without data): subject "a" is
    avoided by `avoided` logits, mornings go better than evenings."""
    rng = np.random.default_rng(seed)
    out = []
    for i in range(n):
        subject = "abc"[i % 3]
        part = str(rng.choice(["morning", "afternoon", "evening"]))
        z = 1.2 + {"morning": 0.3, "afternoon": 0, "evening": -0.5}[part]
        z += avoided if subject == "a" else 0
        done = rng.random() < 1 / (1 + np.exp(-z))
        label = "done" if done else ("skipped" if rng.random() < 0.4 else "unconfirmed")
        day = f"2026-11-{1 + (i // 8) % 28:02d}"
        out.append(Example(subject, day, label, part, False, "learn", 1.0, 120.0, None, False))
    return out
