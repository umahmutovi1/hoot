import pandas as pd

from hoot_ml.data import block_examples, part_of, session_minutes


def test_parts_match_the_app():
    assert part_of(0) == "morning"
    assert part_of(719) == "morning"
    assert part_of(720) == "midday"
    assert part_of(900) == "afternoon"
    assert part_of(1140) == "evening"
    assert part_of(1380) == "night"
    # After midnight but before the day starts (minutes past 1440) is the morning again.
    assert part_of(1440 + 30) == "morning"
    assert part_of(None) is None


def block(id, status, on_date, origin="ai", start=600):
    return {
        "id": id,
        "subject_id": "s",
        "kind": "learn",
        "on_date": on_date,
        "plan_start_min": start,
        "planned_minutes": 50,
        "day_load_min": 120,
        "days_to_goal": 5,
        "demand": 1.3,
        "status": status,
        "origin": origin,
    }


def test_block_examples_labels_and_skips():
    tables = {
        "plan_blocks": pd.DataFrame(
            [
                block("a", "done", "2026-10-27"),
                block("b", "missed", "2026-10-27", start=1200),
                block("c", "missed", "2026-10-27"),  # a session on it: done
                block("d", "planned", "2026-10-29"),  # open: no label
                block("m", "missed", "2026-10-27", origin="user"),  # manual: not a plan example
            ]
        ),
        "study_sessions": pd.DataFrame([{"id": "x", "block_id": "c"}]),
        "block_skips": pd.DataFrame(
            [
                {
                    "subject_id": "s",
                    "kind": "learn",
                    "on_date": "2026-10-28",
                    "start_min": 960,
                    "planned_minutes": 50,
                    "day_load_min": 100,
                    "days_to_goal": 4,
                    "demand": 1.0,
                }
            ]
        ),
    }
    frame = block_examples(tables, "2026-10-29")
    assert list(frame["label"]) == ["done", "unconfirmed", "done", "skipped"]
    assert list(frame["part"]) == ["morning", "evening", "morning", "afternoon"]
    assert list(frame["source"]) == ["block", "block", "block", "skip"]


def test_session_minutes_from_segments():
    segments = pd.DataFrame(
        [
            {
                "session_id": "s",
                "started_at": "2026-10-28T10:00:00Z",
                "ended_at": "2026-10-28T10:25:00Z",
            },
            {
                "session_id": "s",
                "started_at": "2026-10-28T10:30:00Z",
                "ended_at": "2026-10-28T10:50:00Z",
            },
            {"session_id": "s", "started_at": "2026-10-28T11:00:00Z", "ended_at": None},
        ]
    )
    assert session_minutes({"study_segments": segments})["s"] == 45
