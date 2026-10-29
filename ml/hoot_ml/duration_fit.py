"""Fit and backtest of the duration model (RESEARCH-ML 5.1, ROADMAP 11a).

Samples are timer measurements: minutes per unit of measure at difficulty 3, one per studied unit
(`session_units` × `units` × `sources`, as `sampleRate()` in `src/lib/estimates/calibration.ts`).
With one user b_user is not identifiable apart from the bases, so the fit moves sigma and
tauSource; tauUser stays until there are several users.
"""

from __future__ import annotations

import json
import math
from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd

from hoot_ml.duration import (
    PRIORS_PATH,
    Priors,
    Source,
    load_priors,
    old_blend,
    source_rate,
    with_scales,
)

MULTIPLIER = [0.6, 0.8, 1.0, 1.3, 1.7]
MIN_FIT_SESSIONS = 30


def difficulty_multiplier(d: float) -> float:
    x = min(5.0, max(1.0, d)) - 1
    lo = math.floor(x)
    hi = min(4, lo + 1)
    return MULTIPLIER[lo] + (MULTIPLIER[hi] - MULTIPLIER[lo]) * (x - lo)


def samples_from_export(tables: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """One row per measured unit: session, source, kind, base, time and rate (d = 3)."""
    su = tables["session_units"]
    su = su[(su["minutes"] > 0) & (su["amount_done"].fillna(0) > 0)]
    units = tables["units"][["id", "source_id"]].rename(columns={"id": "unit_id"})
    sources = tables["sources"][["id", "kind", "base_min_per_unit"]].rename(
        columns={"id": "source_id", "base_min_per_unit": "base"}
    )
    sessions = tables["study_sessions"][["id", "started_at"]].rename(columns={"id": "session_id"})
    frame = su.merge(units, on="unit_id").merge(sources, on="source_id").merge(sessions)
    mult = frame["difficulty"].fillna(3).map(difficulty_multiplier)
    frame["rate"] = frame["minutes"] / (frame["amount_done"] * mult)
    frame["at"] = pd.to_datetime(frame["started_at"], utc=True)
    return frame[["session_id", "source_id", "kind", "base", "rate", "at"]].sort_values("at")


def log_likelihood(
    samples: pd.DataFrame, sigma: float, tau_source: float, tau_user: float
) -> float:
    """Marginal log likelihood of all log rates (b_user and every b_source integrated out)."""
    y = np.log(samples["rate"].to_numpy()) - (np.log(samples["base"].to_numpy()) - sigma**2 / 2)
    same = samples["source_id"].to_numpy()
    cov = sigma**2 * np.eye(len(y)) + tau_source**2 * (same[:, None] == same[None, :])
    cov += tau_user**2
    chol = np.linalg.cholesky(cov)
    z = np.linalg.solve(chol, y)
    logdet = 2 * np.log(np.diag(chol)).sum()
    return float(-0.5 * (z @ z + logdet + len(y) * math.log(2 * math.pi)))


def fit(samples: pd.DataFrame, p: Priors | None = None) -> Priors:
    """sigma and tauSource by maximum marginal likelihood (log scale, bounded)."""
    from scipy.optimize import minimize

    p = p or load_priors()

    def loss(x: np.ndarray) -> float:
        return -log_likelihood(samples, math.exp(x[0]), math.exp(x[1]), p.tauUser)

    start = np.log([p.sigma, p.tauSource])
    result = minimize(loss, start, method="L-BFGS-B", bounds=[(-3, 0.7), (-4, 0)])
    sigma, tau = np.exp(result.x)
    return with_scales(p, float(sigma), float(tau), p.tauUser)


def write_priors(p: Priors, fitted_from: str, path=PRIORS_PATH) -> Priors:
    """A new artefact version (it goes into input_hash through the app)."""
    old = load_priors(path)
    new = Priors(**{**asdict(p), "version": old.version + 1, "fittedFrom": fitted_from})
    data = asdict(new)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return new


@dataclass
class Backtest:
    n: int
    mae_model: float
    mae_old: float
    coverage_p80: float


def backtest(samples: pd.DataFrame, p: Priors | None = None) -> Backtest:
    """Time-ordered: each sample is predicted from the samples before it (its source's mean and
    count, the user's other sources), by the model and by the old k/(k+5) blend."""
    p = p or load_priors()
    seen: dict[str, list[float]] = {}
    meta: dict[str, tuple[str, float]] = {}
    err_model: list[float] = []
    err_old: list[float] = []
    covered: list[bool] = []
    for row in samples.itertuples():
        meta[row.source_id] = (row.kind, row.base)

        def stats(sid: str) -> Source:
            rates = seen.get(sid, [])
            kind, base = meta[sid]
            learned = sum(rates) / len(rates) if rates else None
            return Source(sid, kind, base, learned, len(rates))

        own = stats(row.source_id)
        others = [stats(sid) for sid in meta if sid != row.source_id]
        rate = source_rate(own, others, p)
        actual = math.log(row.rate)
        # The log-scale point estimate is the median.
        err_model.append(abs(actual - math.log(rate.p50)))
        err_old.append(abs(actual - math.log(old_blend(row.base, own.learned, own.samples))))
        covered.append(row.rate <= rate.unit_p80)
        seen.setdefault(row.source_id, []).append(row.rate)
    n = len(err_model)
    return Backtest(
        n=n,
        mae_model=float(np.mean(err_model)) if n else math.nan,
        mae_old=float(np.mean(err_old)) if n else math.nan,
        coverage_p80=float(np.mean(covered)) if n else math.nan,
    )


def synthetic_samples(
    seed: int,
    sources: int = 6,
    per_source: int = 15,
    sigma: float = 0.45,
    tau_source: float = 0.2,
    user: float = 0.25,
) -> pd.DataFrame:
    """Samples drawn from the model itself (for tests and the notebook without real data)."""
    rng = np.random.default_rng(seed)
    rows = []
    t = pd.Timestamp("2026-11-01", tz="UTC")
    for s in range(sources):
        kind, base = ("book", 4.0) if s % 2 == 0 else ("slides", 1.5)
        b = rng.normal(0, tau_source)
        for _ in range(per_source):
            log_rate = math.log(base) - sigma**2 / 2 + user + b + rng.normal(0, sigma)
            t += pd.Timedelta(hours=float(rng.uniform(2, 30)))
            rows.append(
                {
                    "session_id": f"x{len(rows)}",
                    "source_id": f"s{s}",
                    "kind": kind,
                    "base": base,
                    "rate": math.exp(log_rate),
                    "at": t,
                }
            )
    return pd.DataFrame(rows).sort_values("at").reset_index(drop=True)
