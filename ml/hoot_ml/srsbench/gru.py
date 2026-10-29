"""The srs-benchmark GRU (`models/gru.py`, 503 parameters), trained per user from scratch.

The benchmark pretrains it with Reptile on 100 users before finetuning; here it only sees the
user's own training fold, the same data FSRS-6 gets. The GRU reads a card's reviews (log
interval, one-hot rating) and outputs a mixture of two power forgetting curves, so recall at
the next review is a curve evaluated at its interval. A card runs once per epoch and the loss
only counts the positions of training rows; the GRU is causal, so later rows never leak back.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import torch
from torch import nn

HIDDEN = 7
CURVES = 2
# Cards per batch and epochs: the smallest users still get a few hundred steps. Picked on
# `synthetic_revlog` (64/8 against 512/8 and 32/16), not on the sample.
EPOCHS = 8
BATCH = 64
LR = 1e-2


class Gru(nn.Module):
    def __init__(self):
        super().__init__()
        self.pre = nn.Sequential(nn.Linear(5, HIDDEN), nn.SiLU(), nn.LayerNorm(HIDDEN, bias=False))
        self.gru = nn.GRU(HIDDEN, HIDDEN, num_layers=1)
        self.post = nn.Sequential(
            nn.LayerNorm(HIDDEN, bias=False),
            nn.Linear(HIDDEN, HIDDEN),
            nn.SiLU(),
            nn.LayerNorm(HIDDEN, bias=False),
        )
        for name, param in self.gru.named_parameters():
            if name.startswith("weight"):
                nn.init.orthogonal_(param)
        with torch.no_grad():
            self.gru.bias_ih_l0[HIDDEN : 2 * HIDDEN].fill_(1.0)
        self.w = nn.Linear(HIDDEN, CURVES)
        self.s = nn.Linear(HIDDEN, CURVES)
        self.d = nn.Linear(HIDDEN, CURVES)

    def forward(self, x: torch.Tensor, t: torch.Tensor) -> torch.Tensor:
        """x [steps, cards, 5] → recall at the next review after t [steps, cards] days."""
        h = self.post(self.gru(self.pre(x))[0])
        w = torch.softmax(self.w(h), dim=-1)
        s = torch.exp(torch.clamp(self.s(h), -25, 25))
        d = torch.exp(torch.clamp(self.d(h), -25, 25))
        curve = (1 + t.unsqueeze(-1) / (1e-7 + s)) ** -d
        return (1 - 1e-7) * torch.sum(w * curve, dim=-1)


class Cards:
    """A user's cards as padded sequences; `row[k, c]` is the frame row the output at step k of
    card c predicts (the card's next review), -1 when there is none."""

    def __init__(self, frame: pd.DataFrame):
        cards = frame["card_id"].to_numpy()
        starts = np.r_[0, np.flatnonzero(cards[1:] != cards[:-1]) + 1]
        ends = np.r_[starts[1:], len(cards)]
        order = np.argsort(ends - starts, kind="stable")
        self.starts, self.ends = starts[order], ends[order]
        self.log_t = np.log(1e-5 + frame["delta_t"].to_numpy(dtype=np.float32))
        self.rating = frame["rating"].to_numpy()
        self.t = frame["delta_t"].to_numpy(dtype=np.float32)
        self.y = frame["y"].to_numpy(dtype=np.float32)

    def batches(self, mean: float, std: float):
        for b in range(0, len(self.starts), BATCH):
            starts, ends = self.starts[b : b + BATCH], self.ends[b : b + BATCH]
            steps = int((ends - starts).max())
            x = np.zeros((steps, len(starts), 5), dtype=np.float32)
            row = np.full((steps, len(starts)), -1)
            for c, (s, e) in enumerate(zip(starts, ends, strict=True)):
                x[: e - s, c, 0] = (self.log_t[s:e] - mean) / std
                x[np.arange(e - s), c, self.rating[s:e]] = 1.0
                row[: e - s - 1, c] = np.arange(s + 1, e)
            target = np.where(row >= 0, row, 0)
            yield torch.from_numpy(x), torch.from_numpy(self.t[target]), self.y[target], row


def fit_predict(frame: pd.DataFrame, train: np.ndarray, test: np.ndarray, seed: int = 42):
    """Train on the `train` rows, return recall for the `test` rows (positions in `frame`)."""
    torch.manual_seed(seed)
    cards = Cards(frame)
    history = np.isin(np.arange(len(frame)), train) | (frame["delta_t"].to_numpy() == 0)
    mean = float(cards.log_t[history].mean())
    std = float(cards.log_t[history].std()) or 1.0
    is_train = np.zeros(len(frame), dtype=bool)
    is_train[train] = True
    model = Gru()
    opt = torch.optim.Adam(model.parameters(), lr=LR)
    loss_fn = nn.BCELoss()
    batches = list(cards.batches(mean, std))
    rng = np.random.default_rng(seed)
    for _ in range(EPOCHS):
        for b in rng.permutation(len(batches)):
            x, t, y, row = batches[b]
            mask = torch.from_numpy((row >= 0) & is_train[np.where(row >= 0, row, 0)])
            if not mask.any():
                continue
            p = model(x, t)[mask]
            loss = loss_fn(p, torch.from_numpy(y)[mask])
            opt.zero_grad()
            loss.backward()
            opt.step()
    out = np.full(len(frame), np.nan)
    with torch.no_grad():
        for x, t, _, row in batches:
            p = model(x, t).numpy()
            keep = row >= 0
            out[row[keep]] = p[keep]
    return out[test]
