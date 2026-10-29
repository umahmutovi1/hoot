import re
from pathlib import Path

import pandas as pd

from hoot_ml.export import FREE_TEXT, TABLES, clean, export, pages, reason_code

DATABASE_TS = Path(__file__).parents[2] / "src/types/database.ts"


def table_columns(table: str) -> set[str]:
    source = DATABASE_TS.read_text(encoding="utf-8")
    row = re.search(rf"\n      {table}: {{\n        Row: {{(.*?)\n        }}", source, re.S)
    assert row, table
    return set(re.findall(r"\n          (\w+)\??:", row.group(1)))


def test_no_free_text_leaves_the_database():
    for table, columns in TABLES.items():
        assert not FREE_TEXT & set(columns), table


def test_every_column_exists_in_the_schema():
    for table, columns in TABLES.items():
        assert set(columns) <= table_columns(table), (table, set(columns) - table_columns(table))


def test_reason_keeps_only_its_code():
    assert reason_code('{"code": "first_pass", "title": "Poglavlje 3"}') == "first_pass"
    assert reason_code("not json") is None
    assert reason_code(None) is None
    frame = clean("plan_blocks", [{"id": "b", "reason": '{"code": "review"}', "title": "x"}])
    assert "title" not in frame.columns
    assert frame.loc[0, "reason_code"] == "review"


def test_pages_until_a_short_page():
    rows = [{"id": f"{i:04}"} for i in range(5)]
    seen: list[str] = []

    def fetch(table, params, headers):
        start, end = map(int, headers["Range"].split("-"))
        seen.append(headers["Range"])
        assert params["order"] == "id"
        return rows[start : end + 1]

    got = [row for page in pages(fetch, "subjects", page=2) for row in page]
    assert got == rows
    assert seen == ["0-1", "2-3", "4-5"]


def test_export_writes_one_parquet_per_table(tmp_path):
    def fetch(table, params, headers):
        if table == "study_sessions" and headers["Range"].startswith("0-"):
            return [{"id": "s", "app_leaves": 2, "reflection": "private"}]
        return []

    counts = export(fetch, tmp_path)
    assert counts["study_sessions"] == 1
    assert {p.stem for p in tmp_path.glob("*.parquet")} == set(TABLES)
    sessions = pd.read_parquet(tmp_path / "study_sessions.parquet")
    assert "reflection" not in sessions.columns
    assert sessions.loc[0, "app_leaves"] == 2


def test_db_path_reads_only_the_whitelist_and_returns_api_types():
    import uuid
    from datetime import UTC, date, datetime
    from decimal import Decimal

    import pytest

    from hoot_ml.export import db_query, plain

    params = {"select": "id,on_date,demand", "order": "id"}
    query = db_query("plan_blocks", params, {"Range": "1000-1999"}).as_string(None)
    assert query == (
        'select "id", "on_date", "demand" from public."plan_blocks" order by "id" '
        "limit 1000 offset 1000"
    )
    with pytest.raises(ValueError):
        db_query("plan_blocks", {"select": "id,title", "order": "id"}, {"Range": "0-9"})
    with pytest.raises(ValueError):
        db_query("ai_runs", {"select": "id", "order": "id"}, {"Range": "0-9"})
    u = uuid.uuid4()
    assert plain(u) == str(u)
    assert plain(Decimal("1.25")) == 1.25
    assert plain(date(2026, 10, 29)) == "2026-10-29"
    stamp = datetime(2026, 10, 29, 9, tzinfo=UTC)
    assert plain(stamp) == "2026-10-29T09:00:00+00:00"
    assert plain({"a": 1}) == {"a": 1}
