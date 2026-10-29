"""Block completion model, the same formulas as `src/lib/slots/completion.ts` (RESEARCH-ML 5.2).

    P(done) = sigmoid(x'beta + u_subject),  beta ~ N(m, diag(s^2)),  u_subject ~ N(0, tau^2)

The TS side runs the personal posterior (Laplace around the MAP); here we check parity, fit
tau_subject by the Laplace marginal likelihood and backtest with and without the subject effect.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

import numpy as np

PRIORS_PATH = Path(__file__).parents[2] / "src/lib/slots/priors.json"

PARTS = ["morning", "midday", "afternoon", "evening", "night"]
FEATURES = [
    "intercept",
    *PARTS,
    "weekend",
    "review",
    "questions",
    "recap",
    "deadline",
    "demand",
    "load",
    "goal",
    "prevLate",
    "energy",
]

NEWTON_MAX = 50
NEWTON_TOL = 1e-10


def load_priors(path: Path = PRIORS_PATH) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


@dataclass(frozen=True)
class Example:
    subject_id: str
    on_date: str
    label: str  # done | skipped | unconfirmed
    part: str
    weekend: bool
    kind: str
    demand: float
    day_load_min: float
    days_to_goal: float | None
    prev_late: bool
    day_energy: float | None = None

    @staticmethod
    def from_json(d: dict) -> Example:
        """From the camelCase rows of the simulator and the parity cases."""
        return Example(
            subject_id=d["subjectId"],
            on_date=d["onDate"],
            label=d["label"],
            part=d["part"],
            weekend=bool(d["weekend"]),
            kind=d["kind"],
            demand=float(d["demand"]),
            day_load_min=float(d["dayLoadMin"]),
            days_to_goal=None if d.get("daysToGoal") is None else float(d["daysToGoal"]),
            prev_late=bool(d["prevLate"]),
            day_energy=d.get("dayEnergy"),
        )


@dataclass
class Posterior:
    subjects: list[str]
    mean: np.ndarray
    cov: np.ndarray
    subject_sd: np.ndarray
    subject_weight: dict[str, float] = field(default_factory=dict)
    log_evidence: float = 0.0


def feature_vector(e: Example, p: dict) -> np.ndarray:
    x = np.zeros(len(FEATURES))
    x[0] = 1
    x[FEATURES.index(e.part)] = 1
    if e.weekend:
        x[FEATURES.index("weekend")] = 1
    if e.kind != "learn":
        x[FEATURES.index(e.kind)] = 1
    x[FEATURES.index("demand")] = e.demand - 1
    x[FEATURES.index("load")] = max(0.0, e.day_load_min - p["loadFreeMin"]) / 60
    cap = p["goalDaysMax"]
    days = min(max(0.0, cap if e.days_to_goal is None else e.days_to_goal), cap)
    x[FEATURES.index("goal")] = 1 - math.log1p(days) / math.log1p(cap)
    if e.prev_late:
        x[FEATURES.index("prevLate")] = 1
    x[FEATURES.index("energy")] = e.day_energy or 0
    return x


def prior_mean(preferred: list[str], p: dict) -> np.ndarray:
    return np.array(
        [
            p["mean"][f] + (p["preferredShift"] if f in PARTS and f in preferred else 0)
            for f in FEATURES
        ]
    )


def _days(a: str, b: str) -> int:
    return (date.fromisoformat(b) - date.fromisoformat(a)).days


def weight(e: Example, today: str, p: dict) -> float:
    age = max(0, _days(e.on_date, today))
    base = p["unconfirmedWeight"] if e.label == "unconfirmed" else 1.0
    return base * 0.5 ** (age / p["halfLifeDays"])


def sigmoid(z):
    return 1 / (1 + np.exp(-z))


def fit(
    examples: list[Example],
    today: str,
    preferred: list[str] | None = None,
    p: dict | None = None,
    subject_effect: bool = True,
) -> Posterior:
    """MAP by Newton, Laplace covariance; `subject_effect=False` is the model without subjects
    (the backtest's comparison)."""
    p = p or load_priors()
    subjects = sorted({e.subject_id for e in examples}) if subject_effect else []
    nf = len(FEATURES)
    dim = nf + len(subjects)
    m = np.concatenate([prior_mean(preferred or [], p), np.zeros(len(subjects))])
    prec = np.concatenate(
        [
            [1 / p["sd"][f] ** 2 for f in FEATURES],
            np.full(len(subjects), 1 / p["tauSubject"] ** 2),
        ]
    )
    x = np.zeros((len(examples), dim))
    for i, e in enumerate(examples):
        x[i, :nf] = feature_vector(e, p)
        if subject_effect:
            x[i, nf + subjects.index(e.subject_id)] = 1
    y = np.array([1.0 if e.label == "done" else 0.0 for e in examples])
    w = np.array([weight(e, today, p) for e in examples])
    theta = m.copy()
    h = np.diag(prec)
    for _ in range(NEWTON_MAX):
        q = sigmoid(x @ theta) if len(examples) else np.zeros(0)
        g = prec * (theta - m) + x.T @ (w * (q - y))
        h = np.diag(prec) + (x * (w * q * (1 - q))[:, None]).T @ x
        step = np.linalg.solve(h, g)
        theta = theta - step
        if np.max(np.abs(step)) < NEWTON_TOL:
            break
    cov = np.linalg.inv(h)
    # Laplace evidence: log p(y | MAP) + log prior(MAP) + dim/2 log 2pi - 1/2 log|H| (the 2pi
    # terms of the prior and of the Gaussian integral cancel).
    z = x @ theta
    loglik = float(np.sum(w * (y * z - np.logaddexp(0, z))))
    logprior = float(-0.5 * np.sum(prec * (theta - m) ** 2) + 0.5 * np.sum(np.log(prec)))
    _, logdet = np.linalg.slogdet(h)
    evidence = loglik + logprior - 0.5 * logdet
    sw: dict[str, float] = {}
    for e, wi in zip(examples, w, strict=True):
        sw[e.subject_id] = sw.get(e.subject_id, 0.0) + float(wi)
    return Posterior(
        subjects=subjects,
        mean=theta,
        cov=cov,
        subject_sd=np.array([1 / math.sqrt(h[nf + j, nf + j]) for j in range(len(subjects))]),
        subject_weight=sw,
        log_evidence=float(evidence),
    )


def probability(post: Posterior, e: Example, p: dict | None = None) -> float:
    """Posterior predictive P(done) (probit approximation), as `completionProbability()`."""
    p = p or load_priors()
    x = np.zeros(len(post.mean))
    nf = len(FEATURES)
    x[:nf] = feature_vector(e, p)
    if e.subject_id in post.subjects:
        x[nf + post.subjects.index(e.subject_id)] = 1
    mean = float(x @ post.mean)
    var = float(x @ post.cov @ x)
    return float(sigmoid(mean / math.sqrt(1 + math.pi * var / 8)))


def subject_effects(post: Posterior) -> list[dict]:
    nf = len(FEATURES)
    return [
        {
            "subjectId": s,
            "mean": float(post.mean[nf + j]),
            "sd": float(post.subject_sd[j]),
            "weight": post.subject_weight.get(s, 0.0),
        }
        for j, s in enumerate(post.subjects)
    ]
