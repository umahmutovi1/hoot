import math

import numpy as np
import pandas as pd
import pytest

from hoot_ml.srsbench.data import predictions, prepare, synthetic_revlog, time_series_splits
from hoot_ml.srsbench.metrics import auc, log_loss, rmse_bins, summary, wins


def revlog(rows):
    return pd.DataFrame(rows, columns=["card_id", "rating", "elapsed_days"])


def test_prepare_drops_same_day_and_counts_lapses():
    frame = prepare(
        revlog(
            [
                (1, 1, -1),  # first review
                (2, 3, -1),
                (1, 3, 0),  # same-day step, dropped
                (1, 1, 3),  # lapse
                (2, 0, 4),  # manual rescheduling, dropped
                (1, 3, 1),
                (3, 3, 5),  # history without its first review, dropped
            ]
        )
    )
    card = frame[frame["card_id"] == 1]
    assert list(card["review_th"]) == [1, 4, 6]
    assert list(card["delta_t"]) == [0, 3, 1]
    assert list(card["i"]) == [1, 2, 3]
    assert list(card["lapses"]) == [0, 0, 1]
    assert list(card["y"]) == [0, 0, 1]
    assert set(frame["card_id"]) == {1, 2}
    # Prediction rows in file order.
    assert list(frame["review_th"].to_numpy()[predictions(frame)]) == [4, 6]


def test_time_series_splits_match_sklearn():
    splits = list(time_series_splits(14, 5))
    assert len(splits) == 5
    assert [len(train) for train, _ in splits] == [4, 6, 8, 10, 12]
    assert all(len(test) == 2 for _, test in splits)
    assert list(splits[-1][1]) == [12, 13]
    assert list(time_series_splits(5, 5)) == []


def test_metrics():
    y = np.array([1, 0, 1, 1])
    p = np.array([0.9, 0.2, 0.6, 0.6])
    expected = -(math.log(0.9) + math.log(0.8) + 2 * math.log(0.6)) / 4
    assert abs(log_loss(y, p) - expected) < 1e-12
    assert auc(y, p) == 1.0
    assert auc(np.array([1, 0, 1]), np.array([0.5, 0.5, 0.4])) == 0.25
    assert auc(np.ones(3), np.array([0.1, 0.2, 0.3])) is None


def test_rmse_bins_groups_interval_review_and_lapses():
    y = np.array([1, 0, 1, 1])
    p = np.array([0.9, 0.7, 0.8, 0.5])
    # Intervals 1 and 2 share a bin (2.48 * 3.62^0), 30 is its own; lapses 1 vs 0 split.
    delta_t, i, lapses = [1, 2, 30, 1], [2, 2, 2, 2], [0, 0, 0, 1]
    first = 0.5 - 0.8
    expected = math.sqrt((2 * first**2 + 0.2**2 + 0.5**2) / 4)
    assert abs(rmse_bins(y, p, delta_t, i, lapses) - expected) < 1e-12


def test_summary_and_wins():
    cols = ["user", "model", "size", "log_loss", "rmse_bins", "auc"]
    users = pd.DataFrame(
        [
            (1, "fsrs6", 100, 0.4, 0.1, 0.6),
            (2, "fsrs6", 300, 0.2, 0.05, 0.7),
            (1, "gru", 100, 0.3, 0.12, 0.65),
            (2, "gru", 300, 0.1, 0.04, None),
        ],
        columns=cols,
    )
    table = summary(users)
    assert table.loc["fsrs6", "log_loss"] == pytest.approx(0.3)
    assert table.loc["fsrs6", "log_loss_weighted"] == pytest.approx(0.25)
    assert table.loc["gru", "auc"] == pytest.approx(0.65)
    assert wins(users, "gru", "fsrs6", "log_loss") == 1.0
    assert wins(users, "gru", "fsrs6", "rmse_bins") == 0.5


def test_fsrs6_beats_chance_on_synthetic():
    pytest.importorskip("fsrs_rs_python")
    from hoot_ml.srsbench.bench import run_user

    frame = prepare(synthetic_revlog(cards=150, seed=1))
    result = run_user(frame, ["fsrs6", "fsrs6_default", "fsrs6_3btn"])
    y = frame["y"].to_numpy()[result["rows"]]
    for model in ["fsrs6", "fsrs6_default", "fsrs6_3btn"]:
        p = result[model]
        assert len(p) == len(y) and np.all((p > 0) & (p < 1))
        assert auc(y, p) > 0.5


def test_gru_predicts_every_test_row():
    pytest.importorskip("torch")
    from hoot_ml.srsbench import gru

    frame = prepare(synthetic_revlog(cards=80, seed=2))
    rows = predictions(frame)
    train, test = next(time_series_splits(len(rows)))
    p = gru.fit_predict(frame, rows[train], rows[test])
    assert len(p) == len(test) and np.all(np.isfinite(p)) and np.all((p > 0) & (p < 1))
