"""Sample download, preprocessing and the time-series split of the srs-benchmark.

The dataset is gated: accept its terms on Hugging Face, then

    HF_TOKEN=hf_... uv run --group fsrs python -m hoot_ml.srsbench.data [--users 100] [--seed 42]

Revlogs land in `ml/fsrs/data/revlogs/user_id=<id>/data.parquet` (`data/` is gitignored).
"""

from __future__ import annotations

import argparse
import os
from collections.abc import Iterator
from pathlib import Path

import numpy as np
import pandas as pd

REPO = "open-spaced-repetition/anki-revlogs-10k"
DATA = Path(__file__).resolve().parents[2] / "fsrs" / "data"
MAX_SEQ_LEN = 64
N_SPLITS = 5

COLUMNS = ["card_id", "review_th", "rating", "delta_t", "i", "lapses", "y"]


def user_ids(seed: int, users: int) -> list[int]:
    """A fixed random sample of the collections that have a revlog file."""
    from huggingface_hub import HfApi

    files = HfApi().list_repo_files(REPO, repo_type="dataset")
    ids = sorted(
        int(f.split("user_id=")[1].split("/")[0]) for f in files if f.startswith("revlogs/")
    )
    rng = np.random.default_rng(seed)
    return sorted(rng.choice(ids, size=min(users, len(ids)), replace=False).tolist())


def download(ids: list[int], data: Path = DATA) -> None:
    from huggingface_hub import hf_hub_download

    token = os.environ.get("HF_TOKEN")
    if not token:
        raise SystemExit("HF_TOKEN is not set (the dataset is gated, accept its terms first)")
    for uid in ids:
        hf_hub_download(
            REPO,
            f"revlogs/user_id={uid}/data.parquet",
            repo_type="dataset",
            local_dir=data,
            token=token,
        )


def local_ids(data: Path = DATA) -> list[int]:
    return sorted(int(p.name.split("=")[1]) for p in (data / "revlogs").glob("user_id=*"))


def load(uid: int, data: Path = DATA) -> pd.DataFrame:
    return pd.read_parquet(data / "revlogs" / f"user_id={uid}" / "data.parquet")


def prepare(revlog: pd.DataFrame, max_seq_len: int = MAX_SEQ_LEN) -> pd.DataFrame:
    """Day-level card histories, "without same-day" as in the benchmark.

    `review_th` is the chronological order of the file. Cards whose history does not start with
    the first review (`elapsed_days` -1) are dropped, as are same-day reviews after it. Every row
    with `delta_t` > 0 is a prediction: recall (`y`, rating > Again) after `delta_t` days, given
    the earlier rows of the card; `i` counts the card's reviews including this one and `lapses`
    the earlier failed reviews. The benchmark's outlier filter (fsrs-optimizer) is not repeated.
    """
    df = revlog.reset_index(drop=True)
    df = df.assign(review_th=np.arange(1, len(df) + 1))
    df = df[df["rating"].between(1, 4)]
    df = df.sort_values(["card_id", "review_th"], kind="stable")
    first = df.groupby("card_id")["elapsed_days"].transform("first")
    df = df[(first == -1) & (df["elapsed_days"] != 0)]
    df = df.assign(delta_t=df["elapsed_days"].clip(lower=0).astype(int))
    df = df.assign(i=df.groupby("card_id").cumcount() + 1)
    df = df[df["i"] <= 2 * max_seq_len]
    lapse = ((df["rating"] == 1) & (df["delta_t"] > 0)).astype(int)
    df = df.assign(
        lapses=lapse.groupby(df["card_id"]).cumsum() - lapse,
        y=(df["rating"] > 1).astype(int),
    )
    return df[COLUMNS].reset_index(drop=True)


def predictions(frame: pd.DataFrame) -> np.ndarray:
    """Positions of the prediction rows in chronological order (the order of the split)."""
    rows = np.flatnonzero(frame["delta_t"].to_numpy() > 0)
    return rows[np.argsort(frame["review_th"].to_numpy()[rows], kind="stable")]


def time_series_splits(n: int, n_splits: int = N_SPLITS) -> Iterator[tuple[np.ndarray, np.ndarray]]:
    """sklearn's `TimeSeriesSplit`: n_splits test folds of n // (n_splits + 1) at the end, each
    trained on everything before it."""
    test_size = n // (n_splits + 1)
    if test_size == 0:
        return
    for start in range(n - n_splits * test_size, n, test_size):
        yield np.arange(start), np.arange(start, start + test_size)


def synthetic_revlog(cards: int = 200, days: int = 365, seed: int = 0) -> pd.DataFrame:
    """A revlog in the dataset's columns for tests: stability grows on success, shrinks on a
    lapse, intervals spread widely around S, recall is drawn from 0.9 ** (t / S), and every new
    card gets a same-day step."""
    rng = np.random.default_rng(seed)
    events = []
    for card in range(cards):
        day = int(rng.integers(0, days // 2))
        events.append((day, card, int(rng.choice([1, 3, 4], p=[0.3, 0.6, 0.1])), 0, -1))
        events.append((day, card, 3, 1, 0))
        s, last = float(rng.lognormal(1.0, 0.5)), day
        while True:
            day = last + max(1, round(s * rng.uniform(0.3, 4.0)))
            if day >= days:
                break
            t = day - last
            recalled = rng.random() < 0.9 ** (t / s)
            rating = int(rng.choice([2, 3, 4], p=[0.15, 0.75, 0.1])) if recalled else 1
            events.append((day, card, rating, 2 if recalled else 3, t))
            s = s * rng.uniform(1.8, 3.2) if recalled else max(0.5, s * 0.3)
            last = day
    frame = pd.DataFrame(
        events, columns=["day_offset", "card_id", "rating", "state", "elapsed_days"]
    )
    return frame.sort_values("day_offset", kind="stable").reset_index(drop=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--users", type=int, default=100)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--data", type=Path, default=DATA)
    args = parser.parse_args()
    ids = user_ids(args.seed, args.users)
    download(ids, args.data)
    print(f"{len(ids)} revlogs in {args.data / 'revlogs'}")


if __name__ == "__main__":
    main()
