import json
from pathlib import Path

import numpy as np
import pytest

from hoot_ml.completion import FEATURES, Example, fit, probability, subject_effects
from hoot_ml.completion_fit import backtest, fit_tau
from hoot_ml.completion_fit import synthetic_examples as draw

CASES = json.loads(
    (Path(__file__).parents[2] / "src/lib/slots/completion.cases.json").read_text(encoding="utf-8")
)


def query(q: dict) -> Example:
    return Example.from_json(
        {**q, "subjectId": q["subjectId"] or "-", "onDate": CASES["today"], "label": "done"}
    )


def test_same_numbers_as_typescript():
    for case in CASES["cases"]:
        examples = [Example.from_json(e) for e in case["examples"]]
        post = fit(examples, CASES["today"], case["preferred"])
        expected = case["expected"]
        assert post.mean == pytest.approx(np.array(expected["mean"]), rel=1e-7, abs=1e-9)
        for got, want in zip(subject_effects(post), expected["subjects"], strict=True):
            assert got["subjectId"] == want["subjectId"]
            assert got["mean"] == pytest.approx(want["mean"], rel=1e-7, abs=1e-9)
            assert got["sd"] == pytest.approx(want["sd"], rel=1e-7)
        for q, want in zip(CASES["queries"], expected["probabilities"], strict=True):
            assert probability(post, query(q)) == pytest.approx(want, rel=1e-7)


def test_finds_the_avoided_subject():
    effects = {e["subjectId"]: e for e in subject_effects(fit(draw(1, 300), "2026-12-01"))}
    assert effects["a"]["mean"] + 1.645 * effects["a"]["sd"] < 0
    for s in "bc":
        assert abs(effects[s]["mean"]) < 2 * effects[s]["sd"] + 0.1


def test_backtest_with_subject_is_not_worse():
    runs = [backtest(draw(seed, 240)) for seed in range(4)]
    with_s = np.mean([r.log_loss for r in runs])
    without = np.mean([r.log_loss_no_subject for r in runs])
    assert with_s <= without + 1e-3
    assert np.mean([r.brier for r in runs]) <= np.mean([r.brier_no_subject for r in runs]) + 1e-3
    # Without an avoided subject, the subject effect costs (almost) nothing.
    flat = [backtest(draw(seed, 240, avoided=0)) for seed in range(4)]
    assert (
        np.mean([r.log_loss for r in flat]) <= np.mean([r.log_loss_no_subject for r in flat]) + 0.01
    )


def test_evidence_prefers_a_wider_tau_for_a_strong_effect():
    assert fit_tau(draw(2, 400, avoided=-2.0), "2026-12-01") >= 0.75


def test_features_match_the_app():
    assert FEATURES[:6] == ["intercept", "morning", "midday", "afternoon", "evening", "night"]
