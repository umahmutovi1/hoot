"""Block labels, the same rules as `src/lib/ml/labels.ts` (RESEARCH-ML 1.2).

Done only when confirmed (a session on the block or its status), skipped only when explicit,
otherwise unconfirmed once the day is over; elapsed time never makes a block done.
"""

from __future__ import annotations

from typing import Literal

BlockLabel = Literal["done", "skipped", "unconfirmed"]


def block_label(status: str, on_date: str, has_session: bool, today: str) -> BlockLabel | None:
    if status == "done" or has_session:
        return "done"
    if status == "skipped":
        return "skipped"
    return "unconfirmed" if on_date < today else None
