"""Model-ready frames from the exported parquet files."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from hoot_ml.labels import block_label

# A block started more than this after its planned start was late (`LATE_AFTER_MIN` in the app).
LATE_AFTER_MIN = 5

# Parts of the day, as `PART_RANGES` in `src/lib/schedule/rhythm.ts` (minutes after midnight).
PARTS = [("morning", 0), ("midday", 720), ("afternoon", 900), ("evening", 1140), ("night", 1380)]


def part_of(minute: float | None) -> str | None:
    """As `partOf()` in the app: after midnight (before the day boundary) is still the night."""
    if minute is None or pd.isna(minute):
        return None
    if minute >= 1440:
        return "night"
    return next(name for name, start in reversed(PARTS) if minute >= start)


def load(data: Path) -> dict[str, pd.DataFrame]:
    return {p.stem: pd.read_parquet(p) for p in sorted(data.glob("*.parquet"))}


def late_blocks(tables: dict[str, pd.DataFrame]) -> set:
    """Blocks whose first session started more than LATE_AFTER_MIN after the planned start."""
    sessions = tables["study_sessions"].dropna(subset=["block_id"])
    blocks = tables["plan_blocks"]
    if "started_at" not in sessions or "planned_start" not in blocks:
        return set()
    first = pd.to_datetime(sessions["started_at"], utc=True).groupby(sessions["block_id"]).min()
    planned = pd.to_datetime(blocks.set_index("id")["planned_start"], utc=True)
    delay = (first - planned.reindex(first.index)).dt.total_seconds() / 60
    return set(delay[delay > LATE_AFTER_MIN].index)


def block_examples(tables: dict[str, pd.DataFrame], today: str) -> pd.DataFrame:
    """One row per labelled AI block slot: the block's final outcome, plus one explicit
    "skipped" row per "Preskoči" (the slot it left). Open blocks are left out. `prev_late`: the
    block before it that day (by planned start) was late, as `completionExamples()` in the app."""
    blocks = tables["plan_blocks"]
    blocks = blocks[blocks["origin"] == "ai"].sort_values(["on_date", "plan_start_min"])
    late = late_blocks(tables)
    previous = blocks.groupby("on_date")["id"].shift(1)
    blocks = blocks.assign(prev_late=previous.isin(late).to_numpy())
    with_session = set(tables["study_sessions"]["block_id"].dropna())
    labels = [
        block_label(b.status, str(b.on_date), b.id in with_session, today)
        for b in blocks.itertuples()
    ]
    outcomes = blocks.assign(
        label=labels,
        start_min=blocks["plan_start_min"],
        source="block",
    )
    skips = tables["block_skips"].assign(label="skipped", source="skip", prev_late=False)
    columns = [
        "subject_id",
        "kind",
        "on_date",
        "start_min",
        "planned_minutes",
        "day_load_min",
        "days_to_goal",
        "demand",
        "prev_late",
        "label",
        "source",
    ]
    frame = pd.concat([outcomes[columns], skips[columns]], ignore_index=True)
    frame = frame[frame["label"].notna()].copy()
    frame["part"] = frame["start_min"].map(part_of)
    frame["weekday"] = pd.to_datetime(frame["on_date"]).dt.day_of_week
    return frame.reset_index(drop=True)


def session_minutes(tables: dict[str, pd.DataFrame]) -> pd.Series:
    """Active minutes per session from segment timestamps (open segments are left out)."""
    seg = tables["study_segments"].dropna(subset=["ended_at"])
    span = pd.to_datetime(seg["ended_at"], utc=True) - pd.to_datetime(seg["started_at"], utc=True)
    return (span.dt.total_seconds() / 60).groupby(seg["session_id"]).sum()
