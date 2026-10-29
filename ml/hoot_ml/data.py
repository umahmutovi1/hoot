"""Model-ready frames from the exported parquet files."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from hoot_ml.labels import block_label

# Parts of the day, as `PART_RANGES` in `src/lib/schedule/rhythm.ts` (minutes after midnight).
PARTS = [("morning", 0), ("midday", 720), ("afternoon", 900), ("evening", 1140), ("night", 1380)]


def part_of(minute: float | None) -> str | None:
    if minute is None or pd.isna(minute):
        return None
    minute = minute % 1440
    return next(name for name, start in reversed(PARTS) if minute >= start)


def load(data: Path) -> dict[str, pd.DataFrame]:
    return {p.stem: pd.read_parquet(p) for p in sorted(data.glob("*.parquet"))}


def block_examples(tables: dict[str, pd.DataFrame], today: str) -> pd.DataFrame:
    """One row per labelled AI block slot: the block's final outcome, plus one explicit
    "skipped" row per "Preskoči" (the slot it left). Open blocks are left out."""
    blocks = tables["plan_blocks"]
    blocks = blocks[blocks["origin"] == "ai"]
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
    skips = tables["block_skips"].assign(label="skipped", source="skip")
    columns = [
        "subject_id",
        "kind",
        "on_date",
        "start_min",
        "planned_minutes",
        "day_load_min",
        "days_to_goal",
        "demand",
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
