"""FSRS-6 through fsrs-rs-python: the Rust optimizer behind `@open-spaced-repetition/binding`,
which Hoot runs in the browser for personal parameters (`src/lib/srs/optimize.ts`)."""

from __future__ import annotations

import numpy as np
import pandas as pd
from fsrs_rs_python import DEFAULT_PARAMETERS, FSRS, FSRSItem, FSRSReview


class Histories:
    """Each row as an FSRSItem: its earlier reviews (`before`) or with itself (`with_`)."""

    def __init__(self, frame: pd.DataFrame, ratings: np.ndarray | None = None):
        ratings = frame["rating"].to_numpy() if ratings is None else ratings
        delta_t = frame["delta_t"].to_numpy()
        cards = frame["card_id"].to_numpy()
        self.reviews = [FSRSReview(int(r), int(t)) for r, t in zip(ratings, delta_t, strict=True)]
        # Rows are grouped by card, so a card's history ends at the row itself.
        starts = np.r_[0, np.flatnonzero(cards[1:] != cards[:-1]) + 1]
        self.start = np.repeat(starts, np.diff(np.r_[starts, len(cards)]))

    def before(self, row: int) -> FSRSItem:
        return FSRSItem(self.reviews[self.start[row] : row])

    def with_(self, row: int) -> FSRSItem:
        return FSRSItem(self.reviews[self.start[row] : row + 1])


def fit(histories: Histories, rows: np.ndarray) -> list[float]:
    items = [histories.with_(int(r)) for r in rows]
    try:
        return list(FSRS(DEFAULT_PARAMETERS).compute_parameters(items, enable_short_term=False))
    except Exception:
        # Too few reviews to train: fsrs-rs refuses, the app keeps the defaults.
        return list(DEFAULT_PARAMETERS)


def predict(params: list[float], histories: Histories, frame: pd.DataFrame, rows: np.ndarray):
    states = FSRS(params).memory_state_batch([histories.before(int(r)) for r in rows])
    stability = np.array([s.stability for s in states])
    decay = params[20]
    factor = 0.9 ** (-1 / decay) - 1
    t = frame["delta_t"].to_numpy()[rows]
    return (1 + factor * t / stability) ** -decay
