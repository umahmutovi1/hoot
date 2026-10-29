import pandas as pd

from hoot_ml.monitor import fsrs_weeks, report
from hoot_ml.train import report as train_report
from hoot_ml.train import train_completion


def test_fsrs_calibration_per_week():
    logs = pd.DataFrame(
        [
            {"reviewed_at": "2026-10-26T10:00:00Z", "recall": 2, "retrievability_before": 0.9},
            {"reviewed_at": "2026-10-27T10:00:00Z", "recall": 0, "retrievability_before": 0.7},
            {"reviewed_at": "2026-11-03T10:00:00Z", "recall": 1, "retrievability_before": 0.8},
            {"reviewed_at": "2026-11-03T11:00:00Z", "recall": 2, "retrievability_before": None},
        ]
    )
    weeks = fsrs_weeks({"review_logs": logs})
    assert list(weeks.index) == ["2026-10-26", "2026-11-02"]
    first = weeks.loc["2026-10-26"]
    assert first["reviews_n"] == 2
    assert first["fsrs_r"] == 0.8
    assert first["fsrs_recalled"] == 0.5
    assert abs(first["fsrs_brier"] - (0.1**2 + 0.7**2) / 2) < 1e-12
    text = report(weeks)
    assert "| week | reviews_n" in text and "| 2026-11-02 | 1 |" in text


def empty_tables():
    blocks = ["id", "subject_id", "kind", "on_date", "plan_start_min", "planned_minutes"]
    blocks += ["day_load_min", "days_to_goal", "demand", "status", "origin", "planned_start"]
    skips = ["subject_id", "kind", "on_date", "start_min", "planned_minutes"]
    skips += ["day_load_min", "days_to_goal", "demand"]
    return {
        "plan_blocks": pd.DataFrame(columns=blocks),
        "study_sessions": pd.DataFrame(columns=["id", "block_id", "started_at"]),
        "block_skips": pd.DataFrame(columns=skips),
    }


def test_too_few_blocks_keep_the_prior():
    result = train_completion(empty_tables(), "2026-10-29")
    assert result["changed"] is False and result["ok"] is True
    assert "prior stays" in result["note"]
    assert "completion: bez promjene" in train_report([result])
