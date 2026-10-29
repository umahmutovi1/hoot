"""Duration model, the same formulas as `src/lib/estimates/model.ts` (RESEARCH-ML 5.1).

    log rate = mu + t_source + eps,  t_source = b_user + b_source,  eps ~ N(0, sigma^2)

The TS side runs the personal posterior; here we check parity, fit sigma and the taus by
marginal likelihood and backtest against the old blend.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field, replace
from pathlib import Path

PRIORS_PATH = Path(__file__).parents[2] / "src/lib/estimates/priors.json"
USER_MIN_SAMPLES = 3


@dataclass(frozen=True)
class Priors:
    version: int
    sigma: float
    tauSource: float  # noqa: N815 (same keys as priors.json)
    tauUser: float  # noqa: N815
    tauGiven: float  # noqa: N815
    optimismShrink: float  # noqa: N815
    difficultyShrink: float  # noqa: N815
    z80: float
    fittedFrom: str = ""  # noqa: N815


def load_priors(path: Path = PRIORS_PATH) -> Priors:
    return Priors(**json.loads(path.read_text(encoding="utf-8")))


@dataclass(frozen=True)
class Source:
    id: str
    kind: str = "book"
    base: float = 4.0
    learned: float | None = None
    samples: int = 0
    given: float | None = None


@dataclass(frozen=True)
class Normal:
    mean: float
    variance: float


@dataclass(frozen=True)
class Rate:
    mean: float
    p50: float
    p80: float
    unit_p80: float = field(default=0.0)
    variance: float = field(default=0.0)


def _mu(base: float, p: Priors) -> float:
    return math.log(base) - p.sigma**2 / 2


def _log_measured(rate: float, p: Priors, n: float = math.inf) -> float:
    # log of a mean of n log-normal samples: E[log] = log E - sigma^2/2 + (e^sigma^2 - 1)/2n
    return math.log(rate) - p.sigma**2 / 2 + (math.exp(p.sigma**2) - 1) / (2 * n)


def _update(prior: Normal, residual: float, n: int, p: Priors) -> Normal:
    if n <= 0:
        return prior
    precision = 1 / prior.variance + n / p.sigma**2
    mean = (prior.mean / prior.variance + n * residual / p.sigma**2) / precision
    return Normal(mean, 1 / precision)


def user_effect(sources: list[Source], kind: str, except_id: str | None, p: Priors) -> Normal:
    measured = [
        s
        for s in sources
        if s.id != except_id
        and s.learned is not None
        and s.samples >= USER_MIN_SAMPLES
        and s.base > 0
    ]
    same = [s for s in measured if s.kind == kind]
    group = same or measured
    precision = 1 / p.tauUser**2
    weighted = 0.0
    for s in group:
        v = p.tauSource**2 + p.sigma**2 / s.samples
        precision += 1 / v
        weighted += (_log_measured(s.learned, p, s.samples) - _mu(s.base, p)) / v
    return Normal(weighted / precision, 1 / precision)


def optimism(sources: list[Source], except_id: str | None, p: Priors) -> float:
    both = [
        s
        for s in sources
        if s.id != except_id and s.given is not None and s.learned is not None and s.samples > 0
    ]
    if not both:
        return 0.0
    mean = sum(math.log(s.learned / s.given) for s in both) / len(both)
    return len(both) / (len(both) + p.optimismShrink) * mean


def source_effect(source: Source, others: list[Source], p: Priors) -> Normal:
    mu = _mu(source.base, p)
    if source.given is not None and source.given > 0:
        prior = Normal(
            _log_measured(source.given, p) + optimism(others, source.id, p) - mu, p.tauGiven**2
        )
    else:
        user = user_effect(others, source.kind, source.id, p)
        prior = Normal(user.mean, user.variance + p.tauSource**2)
    if source.learned is None or source.samples <= 0:
        return prior
    return _update(prior, _log_measured(source.learned, p, source.samples) - mu, source.samples, p)


def source_rate(
    source: Source, others: list[Source] | None = None, p: Priors | None = None
) -> Rate:
    p = p or load_priors()
    t = source_effect(source, others or [], p)
    m = _mu(source.base, p) + t.mean
    half = p.sigma**2 / 2
    return Rate(
        mean=math.exp(m + half),
        p50=math.exp(m),
        p80=math.exp(m + half + p.z80 * math.sqrt(t.variance)),
        unit_p80=math.exp(m + p.z80 * math.sqrt(t.variance + p.sigma**2)),
        variance=t.variance,
    )


def old_blend(base: float, learned: float | None, samples: int) -> float:
    """The rate before the model: k/(k+5) · measured + 5/(k+5) · heuristic."""
    if learned is None or samples <= 0:
        return base
    return samples / (samples + 5) * learned + 5 / (samples + 5) * base


def with_scales(p: Priors, sigma: float, tau_source: float, tau_user: float) -> Priors:
    return replace(p, sigma=sigma, tauSource=tau_source, tauUser=tau_user)
