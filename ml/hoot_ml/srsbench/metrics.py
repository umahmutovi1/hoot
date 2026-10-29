"""Benchmark metrics (srs-benchmark `utils.evaluate`) and the aggregate over users, numpy only."""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

EPS = 1e-7
Z99 = 2.5758


def log_loss(y: np.ndarray, p: np.ndarray) -> float:
    p = np.clip(p, EPS, 1 - EPS)
    return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))


def auc(y: np.ndarray, p: np.ndarray) -> float | None:
    """Mann-Whitney with average ranks for ties; None with one class, as the benchmark."""
    pos = int(np.sum(y))
    neg = len(y) - pos
    if pos == 0 or neg == 0:
        return None
    ranks = pd.Series(p).rank(method="average").to_numpy()
    return float((ranks[y == 1].sum() - pos * (pos + 1) / 2) / (pos * neg))


def _bin(values: np.ndarray, base: float, scale: float, digits: int) -> np.ndarray:
    return np.round(scale * np.power(base, np.floor(np.log(values) / np.log(base))), digits)


def rmse_bins(y: np.ndarray, p: np.ndarray, delta_t, i, lapses) -> float:
    """RMSE over bins of (interval, review number, lapses), weighted by reviews per bin."""
    delta_t = np.maximum(np.asarray(delta_t, dtype=float), 1e-6)
    lapses = np.asarray(lapses, dtype=float)
    frame = pd.DataFrame(
        {
            "delta_t": _bin(delta_t, 3.62, 2.48, 2),
            "i": _bin(np.asarray(i, dtype=float), 1.89, 1.99, 0),
            "lapses": np.where(lapses > 0, _bin(np.maximum(lapses, 1), 1.73, 1.65, 0), 0),
            "y": y,
            "p": p,
        }
    )
    bins = frame.groupby(["delta_t", "i", "lapses"]).agg(
        y=("y", "mean"), p=("p", "mean"), n=("y", "size")
    )
    return float(math.sqrt(np.average((bins["y"] - bins["p"]) ** 2, weights=bins["n"])))


def evaluate(frame: pd.DataFrame, p: np.ndarray) -> dict:
    """`frame` holds the scored rows (y, delta_t, i, lapses) aligned with `p`."""
    y = frame["y"].to_numpy()
    return {
        "size": len(y),
        "log_loss": log_loss(y, p),
        "rmse_bins": rmse_bins(y, p, frame["delta_t"], frame["i"], frame["lapses"]),
        "auc": auc(y, p),
    }


def summary(users: pd.DataFrame) -> pd.DataFrame:
    """Per model and metric: mean ± 99% CI over users, and the mean weighted by reviews."""
    rows = []
    for model, group in users.groupby("model", sort=False):
        row = {"model": model, "users": len(group), "reviews": int(group["size"].sum())}
        for metric in ["log_loss", "rmse_bins", "auc"]:
            values = group[[metric, "size"]].dropna()
            x = values[metric].to_numpy(dtype=float)
            row[metric] = float(x.mean())
            row[f"{metric}_ci"] = (
                float(Z99 * x.std(ddof=1) / math.sqrt(len(x))) if len(x) > 1 else 0.0
            )
            row[f"{metric}_weighted"] = float(np.average(x, weights=values["size"]))
        rows.append(row)
    return pd.DataFrame(rows).set_index("model")


def wins(users: pd.DataFrame, model: str, against: str, metric: str) -> float:
    """Share of users where `model` is better than `against` (lower, AUC higher)."""
    pivot = users.pivot(index="user", columns="model", values=metric).dropna()
    better = pivot[model] > pivot[against] if metric == "auc" else pivot[model] < pivot[against]
    return float(better.mean())
