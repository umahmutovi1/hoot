"""Reproduction of the srs-benchmark on a sample of anki-revlogs-10k (RESEARCH-ML 5.3, portfolio).

FSRS-6 (fsrs-rs, the same optimizer Hoot runs in the browser) against a GRU baseline, per user
with a time-series split, scored by log loss, RMSE(bins) and AUC as in
https://github.com/open-spaced-repetition/srs-benchmark ("without same-day" setting). Results
and notes: `ml/fsrs/README.md`. The data is never committed.
"""
