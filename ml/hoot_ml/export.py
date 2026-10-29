"""Export the signed-in user's data to parquet (RESEARCH-ML 4).

Reads as the user, so RLS decides what comes back: no service-role key. Only listed columns
leave the database and none of them is free text (titles, names, notes, answers, reflections);
`plan_blocks.reason` is reduced to its code.

    HOOT_ACCESS_TOKEN=... uv run python -m hoot_ml.export [--out data]

`SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` fall back to the app's `VITE_*` values.

In CI (`train.yml`) there is no browser session: `--db` connects with `SUPABASE_DB_URL`, switches
to the `authenticated` role and sets the JWT claim `sub` to `HOOT_USER_ID`, so the same RLS
policies as in the app decide the rows, and the same column lists apply.

    SUPABASE_DB_URL=... HOOT_USER_ID=... uv run python -m hoot_ml.export --db
"""

from __future__ import annotations

import argparse
import json
import os
import re
from collections.abc import Callable, Iterator
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from uuid import UUID

import httpx
import pandas as pd

PAGE = 1000

FSRS = [
    "fsrs_stability",
    "fsrs_difficulty",
    "fsrs_state",
    "fsrs_reps",
    "fsrs_lapses",
    "last_review_at",
    "next_review_on",
    "review_streak",
]

# Table → exported columns. `profiles` has one row (the user's own).
TABLES: dict[str, list[str]] = {
    "plan_blocks": [
        "id",
        "subject_id",
        "assessment_id",
        "deadline_id",
        "on_date",
        "start_min",
        "plan_start_min",
        "planned_start",
        "planned_minutes",
        "kind",
        "status",
        "origin",
        "plan_run_id",
        "day_load_min",
        "days_to_goal",
        "demand",
        "skip_requested_at",
        "reason",
        "created_at",
        "updated_at",
    ],
    "plan_block_units": ["block_id", "unit_id", "page_from", "page_to", "planned_minutes"],
    "block_skips": [
        "id",
        "block_id",
        "subject_id",
        "kind",
        "reason",
        "skipped_at",
        "on_date",
        "start_min",
        "planned_minutes",
        "day_load_min",
        "days_to_goal",
        "demand",
    ],
    "review_logs": [
        "id",
        "unit_id",
        "card_id",
        "reviewed_at",
        "source",
        "recall",
        "rating",
        "was_scheduled",
        "elapsed_days",
        "interval_before",
        "interval_after",
        "state_before",
        "difficulty_before",
        "stability_before",
        "stability_after",
        "retrievability_before",
    ],
    "study_sessions": [
        "id",
        "subject_id",
        "block_id",
        "mode",
        "timer_mode",
        "origin",
        "planned_minutes",
        "started_at",
        "ended_at",
        "focus",
        "focus_reasons",
        "distractions",
        "app_leaves",
        "app_away_sec",
    ],
    "study_segments": ["id", "session_id", "unit_id", "started_at", "ended_at"],
    "session_units": [
        "session_id",
        "unit_id",
        "minutes",
        "amount_done",
        "difficulty",
        "level_before",
        "level_after",
        "recall_skipped",
    ],
    "units": [
        "id",
        "source_id",
        "parent_id",
        "kind",
        "position",
        "amount",
        "page_start",
        "page_end",
        "level",
        "est_minutes",
        "ai_difficulty",
        "user_difficulty",
        "confidence",
        "read_amount",
        *FSRS,
        "completed_at",
        "archived_at",
        "created_at",
    ],
    "cards": ["id", "unit_id", "origin", *FSRS, "created_at"],
    "sources": [
        "id",
        "subject_id",
        "kind",
        "measure",
        "is_rough",
        "weight",
        "base_min_per_unit",
        "learned_min_per_unit",
        "learned_samples",
        "measured_sessions",
        "archived_at",
    ],
    "subjects": [
        "id",
        "priority",
        "study_mode",
        "campaign_start_on",
        "priority_boost_until",
        "points_total",
        "archived",
    ],
    "assessments": [
        "id",
        "subject_id",
        "kind",
        "format",
        "at",
        "at_latest",
        "date_tentative",
        "eve_reserved",
        "points_max",
        "result_points",
        "result_max",
        "passed",
        "readiness_before",
        "archived_at",
    ],
    "deadlines": [
        "id",
        "subject_id",
        "kind",
        "due_at",
        "est_minutes",
        "done",
        "done_minutes",
        "points_max",
    ],
    "availability_days": ["id", "on_date", "cap_min", "slots"],
    "profiles": [
        "timezone",
        "day_start_min",
        "daily_cap_min",
        "preferred_slots",
        "min_block_minutes",
        "buffer_days",
        "review_cap_pct",
        "default_preset",
    ],
}

# Columns that hold what the user wrote; never exported (checked by the tests).
FREE_TEXT = {
    "title",
    "name",
    "notes",
    "note",
    "answer",
    "front",
    "back",
    "label",
    "reflection",
    "display_name",
    "author",
    "file_name",
    "external_url",
    "institution",
    "study_program",
}


def reason_code(raw: str | None) -> str | None:
    """`plan_blocks.reason` is JSON ("zašto ovo danas"); only its code is kept."""
    if not raw:
        return None
    try:
        value = json.loads(raw)
    except ValueError:
        return None
    code = value.get("code") if isinstance(value, dict) else None
    return code if isinstance(code, str) else None


def clean(table: str, rows: list[dict]) -> pd.DataFrame:
    """Rows → a frame with exactly the listed columns; JSON values become strings."""
    frame = pd.DataFrame(rows, columns=TABLES[table])
    if table == "plan_blocks":
        frame = frame.rename(columns={"reason": "reason_code"})
        frame["reason_code"] = frame["reason_code"].map(reason_code)
    if table == "availability_days":
        frame["slots"] = frame["slots"].map(lambda v: None if v is None else json.dumps(v))
    return frame


Fetch = Callable[[str, dict[str, str], dict[str, str]], list[dict]]


def pages(fetch: Fetch, table: str, page: int = PAGE) -> Iterator[list[dict]]:
    """All rows of a table, `page` at a time, in a stable order."""
    order = "id" if "id" in TABLES[table] else ",".join(TABLES[table][:2])
    offset = 0
    while True:
        params = {"select": ",".join(TABLES[table]), "order": order}
        rows = fetch(table, params, {"Range": f"{offset}-{offset + page - 1}"})
        yield rows
        if len(rows) < page:
            return
        offset += page


def http_fetch(url: str, key: str, token: str) -> Fetch:
    client = httpx.Client(
        base_url=f"{url.rstrip('/')}/rest/v1",
        headers={"apikey": key, "Authorization": f"Bearer {token}", "Range-Unit": "items"},
        timeout=30,
    )

    def fetch(table: str, params: dict[str, str], headers: dict[str, str]) -> list[dict]:
        response = client.get(f"/{table}", params=params, headers=headers)
        response.raise_for_status()
        return response.json()

    return fetch


def plain(value):
    """A database value as the Data API returns it (JSON types), so both paths give the same
    frames: ids and dates as strings, numerics as floats."""
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime | date):
        return value.isoformat()
    return value


def db_query(table: str, params: dict[str, str], headers: dict[str, str]):
    """The SQL for one Data API page request (only whitelisted tables and columns)."""
    from psycopg import sql

    columns = params["select"].split(",")
    if table not in TABLES or any(c not in TABLES[table] for c in columns):
        raise ValueError(f"{table}: not in the export whitelist")
    order = params["order"].split(",")
    first, last = (int(x) for x in re.fullmatch(r"(\d+)-(\d+)", headers["Range"]).groups())
    return sql.SQL("select {} from public.{} order by {} limit {} offset {}").format(
        sql.SQL(", ").join(map(sql.Identifier, columns)),
        sql.Identifier(table),
        sql.SQL(", ").join(map(sql.Identifier, order)),
        sql.Literal(last - first + 1),
        sql.Literal(first),
    )


def db_fetch(db_url: str, user_id: str) -> Fetch:
    """Postgres as the user: role `authenticated` and JWT claims with `sub`, as PostgREST does."""
    import psycopg

    UUID(user_id)  # fail early on a wrong secret
    conn = psycopg.connect(db_url, autocommit=True)
    conn.execute("set role authenticated")
    claims = json.dumps({"sub": user_id, "role": "authenticated"})
    conn.execute("select set_config('request.jwt.claims', %s, false)", (claims,))
    conn.execute("select set_config('request.jwt.claim.sub', %s, false)", (user_id,))

    def fetch(table: str, params: dict[str, str], headers: dict[str, str]) -> list[dict]:
        cur = conn.execute(db_query(table, params, headers))
        names = [d.name for d in cur.description]
        return [{n: plain(v) for n, v in zip(names, row, strict=True)} for row in cur]

    return fetch


def export(fetch: Fetch, out: Path) -> dict[str, int]:
    out.mkdir(parents=True, exist_ok=True)
    counts: dict[str, int] = {}
    for table in TABLES:
        rows = [row for page in pages(fetch, table) for row in page]
        clean(table, rows).to_parquet(out / f"{table}.parquet", index=False)
        counts[table] = len(rows)
    return counts


def env(*names: str) -> str:
    for name in names:
        if value := os.environ.get(name):
            return value
    raise SystemExit(f"Missing {' / '.join(names)}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--out", type=Path, default=Path(__file__).parents[1] / "data")
    parser.add_argument("--db", action="store_true", help="SUPABASE_DB_URL + HOOT_USER_ID (CI)")
    args = parser.parse_args()
    if args.db:
        fetch = db_fetch(env("SUPABASE_DB_URL"), env("HOOT_USER_ID"))
    else:
        fetch = http_fetch(
            env("SUPABASE_URL", "VITE_SUPABASE_URL"),
            env("SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"),
            env("HOOT_ACCESS_TOKEN"),
        )
    for table, n in export(fetch, args.out).items():
        print(f"{table:20} {n:6}")


if __name__ == "__main__":
    main()
