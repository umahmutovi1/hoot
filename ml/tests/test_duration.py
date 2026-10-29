import json
from pathlib import Path

import pandas as pd
import pytest

from hoot_ml.duration import Source, load_priors, old_blend, source_rate
from hoot_ml.duration_fit import (
    backtest,
    difficulty_multiplier,
    log_likelihood,
    samples_from_export,
    synthetic_samples,
)

CASES = json.loads(
    (Path(__file__).parents[2] / "src/lib/estimates/model.cases.json").read_text(encoding="utf-8")
)


def source(d: dict) -> Source:
    return Source(d["id"], d["kind"], d["base"], d["learned"], d["samples"], d["given"])


def test_same_numbers_as_typescript():
    for case in CASES["cases"]:
        rate = source_rate(source(case["source"]), [source(o) for o in case["others"]])
        expected = case["expected"]
        assert rate.mean == pytest.approx(expected["mean"], rel=1e-9)
        assert rate.p50 == pytest.approx(expected["p50"], rel=1e-9)
        assert rate.p80 == pytest.approx(expected["p80"], rel=1e-9)
        assert rate.unit_p80 == pytest.approx(expected["unitP80"], rel=1e-9)


def test_difficulty_multiplier_matches_the_app():
    assert [difficulty_multiplier(d) for d in [1, 2, 3, 4, 5]] == [0.6, 0.8, 1.0, 1.3, 1.7]
    assert difficulty_multiplier(3.5) == pytest.approx(1.15)


def test_old_blend():
    assert old_blend(4, None, 0) == 4
    assert old_blend(4, 8, 5) == 6


def test_backtest_beats_the_old_blend_and_covers_p80():
    runs = [backtest(synthetic_samples(seed)) for seed in range(8)]
    mae_model = sum(r.mae_model for r in runs) / len(runs)
    mae_old = sum(r.mae_old for r in runs) / len(runs)
    coverage = sum(r.coverage_p80 for r in runs) / len(runs)
    # Point accuracy as the old blend (100 seeds: +0.003 log MAE with a slow user, -0.0065 with
    # one at the base); the gain is the calibrated P80.
    assert mae_model <= mae_old + 0.01
    assert 0.70 <= coverage <= 0.88


def test_likelihood_prefers_the_true_scales():
    samples = pd.concat([synthetic_samples(seed, sources=8) for seed in range(3)])
    p = load_priors()
    true = log_likelihood(samples, 0.45, 0.2, p.tauUser)
    assert true > log_likelihood(samples, 0.15, 0.2, p.tauUser)
    assert true > log_likelihood(samples, 1.2, 0.2, p.tauUser)


def test_fit_recovers_sigma():
    pytest.importorskip("scipy")
    from hoot_ml.duration_fit import fit

    samples = synthetic_samples(1, sources=10, per_source=30, sigma=0.6)
    assert fit(samples).sigma == pytest.approx(0.6, abs=0.08)


def test_samples_from_export():
    tables = {
        "session_units": pd.DataFrame(
            [
                {
                    "session_id": "s1",
                    "unit_id": "u1",
                    "minutes": 40,
                    "amount_done": 10,
                    "difficulty": 4,
                },
                {
                    "session_id": "s1",
                    "unit_id": "u2",
                    "minutes": 0,
                    "amount_done": 3,
                    "difficulty": 3,
                },
            ]
        ),
        "units": pd.DataFrame([{"id": "u1", "source_id": "a"}, {"id": "u2", "source_id": "a"}]),
        "sources": pd.DataFrame([{"id": "a", "kind": "book", "base_min_per_unit": 4}]),
        "study_sessions": pd.DataFrame([{"id": "s1", "started_at": "2026-11-01T10:00:00Z"}]),
    }
    frame = samples_from_export(tables)
    assert len(frame) == 1
    assert frame.iloc[0]["rate"] == pytest.approx(40 / (10 * 1.3))
