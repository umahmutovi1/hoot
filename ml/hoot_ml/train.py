"""Monthly training (PRD "Dopune" → MLOps, `.github/workflows/train.yml`).

Export → fit → backtest. A model's prior changes only when it has enough data and its backtest
is not worse than with the current prior; the new artefact gets a new `version` (→ input_hash).
The simulator gate runs after this, in the workflow. Writes a Markdown report and a JSON summary.

    uv run python -m hoot_ml.train [--data data] [--report report.md] [--today 2026-10-29] [--write]

Without `--write` it only reports what it would change.
"""

from __future__ import annotations

import argparse
import json
import math
from dataclasses import asdict
from datetime import date
from pathlib import Path

from hoot_ml import completion_fit, duration_fit
from hoot_ml.completion import load_priors as load_completion
from hoot_ml.data import block_examples, load
from hoot_ml.duration import load_priors as load_duration

# A refit closer than this to the current scale is not a new artefact (no churn of input_hash).
MIN_CHANGE = 0.02
# The P80 bound must stay an 80% bound.
COVERAGE = (0.7, 0.9)


def train_duration(tables, write: bool = False) -> dict:
    current = load_duration()
    samples = duration_fit.samples_from_export(tables)
    sessions = samples["session_id"].nunique() if len(samples) else 0
    out = {"model": "duration", "sessions": int(sessions), "changed": False, "ok": True}
    if sessions < duration_fit.MIN_FIT_SESSIONS:
        out["note"] = f"{sessions} < {duration_fit.MIN_FIT_SESSIONS} sessions: prior stays"
        return out
    fitted = duration_fit.fit(samples, current)
    before = duration_fit.backtest(samples, current)
    after = duration_fit.backtest(samples, fitted)
    out |= {"before": asdict(before), "after": asdict(after)}
    moved = max(abs(fitted.sigma - current.sigma), abs(fitted.tauSource - current.tauSource))
    if moved < MIN_CHANGE:
        out["note"] = "the refit matches the current prior"
        return out
    out["ok"] = after.mae_model <= before.mae_model + 1e-9 and (
        COVERAGE[0] <= after.coverage_p80 <= COVERAGE[1]
    )
    if out["ok"]:
        if write:
            duration_fit.write_priors(
                fitted, f"ml/ train: {sessions} sessions, {len(samples)} samples"
            )
        out["changed"] = True
    else:
        out["note"] = "the refit backtests worse: prior stays"
    return out


def train_completion(tables, today: str, write: bool = False) -> dict:
    current = load_completion()
    examples = completion_fit.examples_from_frame(block_examples(tables, today))
    out = {"model": "completion", "blocks": len(examples), "changed": False, "ok": True}
    if len(examples) < completion_fit.MIN_FIT_BLOCKS:
        out["note"] = f"{len(examples)} < {completion_fit.MIN_FIT_BLOCKS} blocks: prior stays"
        return out
    tau = completion_fit.fit_tau(examples, today)
    before = completion_fit.backtest(examples, p=current)
    after = completion_fit.backtest(examples, p={**current, "tauSubject": tau})
    out |= {"tauSubject": tau, "before": asdict(before), "after": asdict(after)}
    if abs(tau - current["tauSubject"]) < MIN_CHANGE:
        out["note"] = "the refit matches the current prior"
        return out
    out["ok"] = after.log_loss <= before.log_loss + 1e-9
    if out["ok"]:
        if write:
            completion_fit.write_priors(
                {"tauSubject": tau}, f"ml/ train: {len(examples)} blocks, tau by Laplace evidence"
            )
        out["changed"] = True
    else:
        out["note"] = "the refit backtests worse: prior stays"
    return out


def fmt(x) -> str:
    if isinstance(x, float):
        return "–" if math.isnan(x) else f"{x:.4f}"
    return str(x)


def report(results: list[dict]) -> str:
    lines = ["## Trening modela", ""]
    for r in results:
        state = (
            "novi artefakt" if r["changed"] else ("pogoršanje" if not r["ok"] else "bez promjene")
        )
        lines.append(f"### {r['model']}: {state}")
        if note := r.get("note"):
            lines.append(f"- {note}")
        if "before" in r:
            lines += ["", "| metrika | trenutni prior | novi fit |", "| --- | --- | --- |"]
            for k, v in r["before"].items():
                lines.append(f"| {k} | {fmt(v)} | {fmt(r['after'][k])} |")
        lines.append("")
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--data", type=Path, default=Path(__file__).parents[1] / "data")
    parser.add_argument("--report", type=Path, default=None)
    parser.add_argument("--today", default=date.today().isoformat())
    parser.add_argument("--write", action="store_true", help="write the new priors.json files")
    args = parser.parse_args()
    tables = load(args.data)
    results = [
        train_duration(tables, args.write),
        train_completion(tables, args.today, args.write),
    ]
    text = report(results)
    if args.report:
        args.report.write_text(text, encoding="utf-8")
    print(text)
    summary = {
        "changed": [r["model"] for r in results if r["changed"]],
        "ok": all(r["ok"] for r in results),
    }
    print(json.dumps(summary))


if __name__ == "__main__":
    main()
