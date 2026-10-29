"""Weekly monitoring of the Stage 11a models (PRD "Dopune" → MLOps, `ml-monitor.yml`).

Per ISO week, from the export: P80 coverage of the duration model (target ~0.8), Brier score
of block completion (model, and the done share so far as the bar), and FSRS calibration from
`review_logs` (mean retrievability before a review against the share recalled, rating > Again).
Every prediction uses only data from before it, as the backtests.

    uv run python -m hoot_ml.monitor [--data data] [--weeks 8] [--report monitor.md]
"""

from __future__ import annotations

import argparse
from datetime import date
from pathlib import Path

import pandas as pd

from hoot_ml import completion_fit, duration_fit
from hoot_ml.data import block_examples, load


def _week(values: pd.Series) -> pd.Series:
    stamp = pd.to_datetime(values, utc=True).dt.tz_localize(None)
    return stamp.dt.to_period("W-SUN").dt.start_time.dt.date.astype(str)


def duration_weeks(tables) -> pd.DataFrame:
    samples = duration_fit.samples_from_export(tables)
    pred = duration_fit.predictions(samples)
    if pred.empty:
        return pd.DataFrame(columns=["p80_n", "p80_coverage"])
    return pred.groupby(_week(pred["at"])).agg(
        p80_n=("covered", "size"), p80_coverage=("covered", "mean")
    )


def completion_weeks(tables, today: str) -> pd.DataFrame:
    examples = completion_fit.examples_from_frame(block_examples(tables, today))
    pred = completion_fit.predictions(examples)
    if pred.empty:
        return pd.DataFrame(columns=["blocks_n", "brier", "brier_constant"])
    pred = pred.assign(
        se=(pred["model"] - pred["y"]) ** 2, se_constant=(pred["constant"] - pred["y"]) ** 2
    )
    return pred.groupby(_week(pred["on_date"])).agg(
        blocks_n=("y", "size"), brier=("se", "mean"), brier_constant=("se_constant", "mean")
    )


def fsrs_weeks(tables) -> pd.DataFrame:
    logs = tables["review_logs"].dropna(subset=["retrievability_before"])
    if logs.empty:
        return pd.DataFrame(columns=["reviews_n", "fsrs_r", "fsrs_recalled", "fsrs_brier"])
    recalled = (logs["recall"] >= 1).astype(float)
    r = logs["retrievability_before"].astype(float)
    frame = pd.DataFrame({"r": r, "y": recalled, "se": (r - recalled) ** 2})
    return frame.groupby(_week(logs["reviewed_at"])).agg(
        reviews_n=("y", "size"),
        fsrs_r=("r", "mean"),
        fsrs_recalled=("y", "mean"),
        fsrs_brier=("se", "mean"),
    )


def weekly(tables, today: str, weeks: int = 8) -> pd.DataFrame:
    frame = pd.concat(
        [duration_weeks(tables), completion_weeks(tables, today), fsrs_weeks(tables)], axis=1
    ).sort_index()
    frame.index.name = "week"
    return frame.tail(weeks)


def markdown(frame: pd.DataFrame) -> str:
    """Counts (`*_n`) as integers, the rest with 3 decimals, missing as a dash."""

    def cell(column: str, v) -> str:
        if pd.isna(v):
            return "–"
        return str(int(v)) if column.endswith("_n") else f"{v:.3f}"

    head = ["week", *frame.columns]
    lines = ["| " + " | ".join(head) + " |", "|" + " --- |" * len(head)]
    for index, row in frame.iterrows():
        cells = [cell(c, row[c]) for c in frame.columns]
        lines.append("| " + " | ".join([str(index), *cells]) + " |")
    return "\n".join(lines)


def report(frame: pd.DataFrame) -> str:
    if frame.empty:
        return "## Praćenje modela\n\nJoš nema podataka.\n"
    return "## Praćenje modela (po sedmici)\n\n" + markdown(frame) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--data", type=Path, default=Path(__file__).parents[1] / "data")
    parser.add_argument("--weeks", type=int, default=8)
    parser.add_argument("--report", type=Path, default=None)
    parser.add_argument("--today", default=date.today().isoformat())
    args = parser.parse_args()
    text = report(weekly(load(args.data), args.today, args.weeks))
    if args.report:
        args.report.write_text(text, encoding="utf-8")
    print(text)


if __name__ == "__main__":
    main()
