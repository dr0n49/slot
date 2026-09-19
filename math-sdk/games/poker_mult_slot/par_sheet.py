#!/usr/bin/env python3
"""
Poker Mult Slot — 5×5 grid PAR sheet + Monte Carlo.

Board model (locked, mirrors grid_math.py / frontend engine.ts):
  - 25 cards dealt from ONE shuffled 52-card deck (all unique), index r*5+c.
  - 7 lines: 5 horizontal + 2 long diagonals. Each line is a 5-card poker
    hand evaluated on the frozen Jacks-or-Better paytable.
  - spinWin = Σ_lines handPay × max(1, Σ cell multipliers on the line),
    capped at 25 000×. Multipliers sum on the line, never add to hand pay.
  - FS: each line term additionally × max(1, bank); bank += bankAdd before
    the spin's factor. bankAdd is intensity × Σ of × sitting on a paying line.
  - During FS, 3 goldens retrigger +5 extra spins (cap MAX_FS).
  - Golden scatters are JOKER (bonus) cards: kind sampled first, then cells
    painted — exact trigger rates by construction. A joker is not a poker
    card: every line through a joker cell is dead (pays 0), jokers carry no
    multiplier and are placed BEFORE the deal so floors count live lines.
  - Floors: conditional deal with capped rerolls (job: ≥1 JoB+ line per FS /
    ante spin; flush ante: ≥1 Flush+ line; flush FS: ≥1 Flush+ line per
    10-spin package).

RTP calibration policy (product decision): wins ALWAYS pay the published
table — linePayScale = 1 and modeScale = 1 in every mode. The 96% is held
by the money-side knobs instead:
  cost_bonus       = E[bonus package]  / 0.96   (charged price)
  cost_job         = E[job package]    / 0.96
  cost_flush       = E[flush package]  / 0.96
  cost_ante_job    = E[ante job]       / 0.96
  cost_ante_flush  = E[ante flush]     / 0.96
  λ × (P_BONUS × E[bonus] + P_JOB × E[job] + P_FLUSH × E[flush])
      + E[base spin] = 1 × 0.96                (one λ scale on trigger chances)
Bought and base-triggered packages pay identically — no part scales. The
frontend reads the same mathConfig (triggers + priceUiX), so displayed wins
equal paid wins and charged prices match game_config.py BetMode costs.
"""

from __future__ import annotations

import argparse
import json
import math
import time
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np

# ---------------------------------------------------------------------------
# Constants / locked tables
# ---------------------------------------------------------------------------

MAX_WIN = 25_000.0
N_ROUNDS_DEFAULT = 1_000_000
UI_DISPLAY_RTP = 0.960
TARGET_RTP = 0.960
TARGET_RTP_LO = 0.955
TARGET_RTP_HI = 0.965
TARGET_RTP_MID = 0.960

#: Authored base trigger chances (start values). calibrate_grid rescales all
#: three by one λ so the base mode lands on TARGET_RTP.
P_FLUSH_BONUS = 1.0 / 1500.0
P_JOB_BONUS = 1.0 / 120.0
P_BONUS = 1.0 / 160.0
FS_COUNT = 10
P_RETRIGGER = 1.0 / 80.0
RETRIGGER_FS = 5
MAX_FS = 50

GRID_ROWS, GRID_COLS = 5, 5
N_CELLS = GRID_ROWS * GRID_COLS
LINES = np.array(
    [
        [0, 1, 2, 3, 4],
        [5, 6, 7, 8, 9],
        [10, 11, 12, 13, 14],
        [15, 16, 17, 18, 19],
        [20, 21, 22, 23, 24],
        [0, 6, 12, 18, 24],   # D0 ↘
        [4, 8, 12, 16, 20],   # D1 ↙
    ],
    dtype=np.int64,
)

HAND_NAMES = [
    "Nothing", "Jacks or Better", "Two Pair", "Three of a Kind", "Straight",
    "Flush", "Full House", "Four of a Kind", "Straight Flush", "Royal Flush",
]
#: Published per-line pays, paid as-is (linePayScale = 1 — no trim knob).
HAND_PAY = np.array(
    [0, 0.25, 0.5, 0.75, 1, 1.5, 2, 8, 20, 200], dtype=np.float64
)
LINE_PAY_SCALE = 1.0

MULT_VALUES = np.array([2, 3, 5, 10, 25, 50, 100, 250, 1000], dtype=np.float64)
# Mild 10–100× bump vs the 94% table; 250×/1000× stay rare so 25k cap hits
# do not dump 20–50pp into a 15k-row LUT.
MULT_WEIGHTS = np.array(
    [0.636, 0.242, 0.09, 0.023, 0.0062, 0.0018, 0.0005, 0.00012, 0.00003],
    dtype=np.float64,
)
MULT_WEIGHTS = MULT_WEIGHTS / MULT_WEIGHTS.sum()

JOB_MIN_IDX = 1
FLUSH_MIN_IDX = 5

#: Charged prices per mode — CATALOG, multiples of 5 (product decision).
#: Feature multiplier-chance knobs (not part scales, not prices) carry the
#: RTP: calibration tunes chance so E[part] = price × TARGET_RTP. Base is
#: closed by one λ on the trigger chances. game_config.py BetMode costs and
#: the frontend mathConfig priceUiX must match these.
CATALOG_PRICES = {
    "bonus": 25.0,
    "bonus_job": 35.0,
    "bonus_flush": 190.0,
    "ante_job": 5.0,
    "ante_flush": 15.0,
}
MODE_COST = {
    "base": 1.0,
    "bonus": 25.0,
    "bonus_job": 35.0,
    "bonus_flush": 190.0,
    "ante_job": 5.0,
    "ante_flush": 15.0,
}

#: Fair value / charged price per paid mode, filled by calibrate_grid.
#: priceX (fair EV) and priceUiX (charged) feed export_math_config.
PRICING: Dict[str, Dict[str, float]] = {}

#: Starting grid knobs per spin class. chance gates the multiplier draw;
#: nProbs sits over counts 1..len(nProbs). Knobs are authored (frozen from
#: mathConfig on rerun) — RTP compensation lives in prices + trigger λ.
DEFAULT_KNOBS: Dict[str, Dict[str, object]] = {
    "base":       {"chance": 0.18, "nProbs": [0.70, 0.24, 0.06]},
    "bonus":      {"chance": 0.20, "nProbs": [0.70, 0.24, 0.06]},
    "job":        {"chance": 0.32, "nProbs": [0.67, 0.23, 0.10]},
    "flush":      {"chance": 0.16, "nProbs": [0.08, 0.32, 0.40, 0.20]},
    "ante_job":   {"chance": 1.00, "nProbs": [0.0, 0.0, 0.0, 0.01, 0.02, 0.03, 0.05, 0.08, 0.11, 0.14, 0.15, 0.14, 0.11, 0.08, 0.05, 0.03]},
    "ante_flush": {"chance": 1.00, "nProbs": [0.0, 0.0, 0.0, 0.01, 0.02, 0.03, 0.05, 0.08, 0.11, 0.14, 0.15, 0.14, 0.11, 0.08, 0.05, 0.03]},
}
DEFAULT_FLOOR_REROLLS = {"job": 25, "flush": 800, "flush_package": 50}
DEFAULT_INTENSITY = {
    "base": 1.0,
    "bonus": 1.0,
    "job": 1.0,
    "flush": 1.0,
    "ante_job": 1.0,
    "ante_flush": 1.0,
}


@dataclass
class GridParams:
    line_pay_scale: float = LINE_PAY_SCALE
    chance: Dict[str, float] = field(default_factory=lambda: {k: v["chance"] for k, v in DEFAULT_KNOBS.items()})  # type: ignore[misc]
    n_probs: Dict[str, List[float]] = field(default_factory=lambda: {k: list(v["nProbs"]) for k, v in DEFAULT_KNOBS.items()})  # type: ignore[misc]
    intensity: Dict[str, float] = field(default_factory=lambda: dict(DEFAULT_INTENSITY))
    floor_rerolls: Dict[str, int] = field(default_factory=lambda: dict(DEFAULT_FLOOR_REROLLS))
    mode_scale: Dict[str, float] = field(
        default_factory=lambda: {m: 1.0 for m in MODE_COST}
    )


def _norm(p: np.ndarray) -> np.ndarray:
    return p / p.sum()


# ---------------------------------------------------------------------------
# Vectorized board sampler
# ---------------------------------------------------------------------------

def _deal(rng: np.random.Generator, n: int) -> Tuple[np.ndarray, np.ndarray]:
    """Deal n boards: 25 unique cards each from one shuffled 52-card deck."""
    ids = np.argsort(rng.random((n, 52)), axis=1, kind="stable")[:, :N_CELLS]
    return ids // 4 + 2, ids % 4  # ranks 2..14, suits 0..3


_RANK_VALS = np.arange(2, 15, dtype=np.int64)

#: True = jokers are separate bonus cards and kill the lines they sit on
#: (current product). False reproduces the previous model, where a golden
#: cell was still an ordinary card in every hand — kept for A/B reports.
JOKERS_DEAD = True


def _eval_lines(
    ranks: np.ndarray, suits: np.ndarray, gmask: Optional[np.ndarray] = None
) -> np.ndarray:
    """Evaluate the 7 lines of each board → hand indices (n, 7).

    ``gmask`` (n, 25) marks joker cells; lines through one are dead (0).
    """
    h = _eval_lines_raw(ranks, suits)
    if gmask is not None and JOKERS_DEAD:
        h = np.where(gmask[:, LINES].any(axis=2), 0, h)
    return h


def _eval_lines_raw(ranks: np.ndarray, suits: np.ndarray) -> np.ndarray:
    lr = ranks[:, LINES]              # (n, 7, 5)
    ls = suits[:, LINES]
    cnt = (lr[..., None] == _RANK_VALS).sum(axis=2)  # (n, 7, 13)

    is_flush = (ls == ls[:, :, :1]).all(axis=2)
    srt = np.sort(lr, axis=2)
    uniq5 = (np.diff(srt, axis=2) > 0).all(axis=2)
    wheel = (srt[..., 0] == 2) & (srt[..., 1] == 3) & (srt[..., 2] == 4) & (
        srt[..., 3] == 5) & (srt[..., 4] == 14)
    straight = uniq5 & (((srt[..., 4] - srt[..., 0]) == 4) | wheel)
    sf = straight & is_flush
    royal = sf & (srt[..., 0] == 10)

    quads = (cnt == 4).any(axis=2)
    trips = (cnt == 3).sum(axis=2)
    pairs = (cnt == 2).sum(axis=2)
    pair_rank = ((cnt == 2) * _RANK_VALS).sum(axis=2)

    return np.select(
        [royal, sf, quads, (trips >= 1) & (pairs >= 1), is_flush, straight,
         trips >= 1, pairs >= 2, (pairs == 1) & (pair_rank >= 11)],
        [9, 8, 7, 6, 5, 4, 3, 2, 1],
        default=0,
    )


def _apply_floor(
    rng: np.random.Generator,
    ranks: np.ndarray,
    suits: np.ndarray,
    h: np.ndarray,
    min_idx: int,
    cap: int,
    gmask: Optional[np.ndarray] = None,
) -> None:
    """Redeal failing boards in place until ≥1 live line reaches min_idx (cap)."""
    ok = (h >= min_idx).any(axis=1)
    for _ in range(cap):
        bad = np.flatnonzero(~ok)
        if bad.size == 0:
            return
        r2, s2 = _deal(rng, bad.size)
        h2 = _eval_lines(r2, s2, None if gmask is None else gmask[bad])
        ranks[bad] = r2
        suits[bad] = s2
        h[bad] = h2
        ok[bad] = (h2 >= min_idx).any(axis=1)


def _gold_counts(rng: np.random.Generator, n: int) -> np.ndarray:
    """Unconditional golden-count mixture over base spins.

    0=tease, 1=standard bonus (3), 2=job (4), 3=flush (5).
    """
    u = rng.random(n)
    kind = np.zeros(n, dtype=np.int64)
    kind[u < P_FLUSH_BONUS] = 3
    kind[(u >= P_FLUSH_BONUS) & (u < P_FLUSH_BONUS + P_JOB_BONUS)] = 2
    kind[
        (u >= P_FLUSH_BONUS + P_JOB_BONUS)
        & (u < P_FLUSH_BONUS + P_JOB_BONUS + P_BONUS)
    ] = 1
    cnt = np.zeros(n, dtype=np.int64)
    tu = rng.random(n)
    tease = kind == 0
    cnt[tease & (tu >= 0.92)] = 2
    cnt[tease & (tu >= 0.72) & (tu < 0.92)] = 1
    cnt[kind == 1] = 3
    cnt[kind == 2] = 4
    cnt[kind == 3] = 5
    return cnt


def _gold_mask(rng: np.random.Generator, n: int) -> np.ndarray:
    """Paint goldens, at most one per column."""
    return _paint_gold(rng, n, _gold_counts(rng, n))


def _fs_gold_mask(rng: np.random.Generator, n: int) -> Tuple[np.ndarray, np.ndarray]:
    """FS goldens: 3 = retrigger (p), else tease 0–2. Returns (mask, counts)."""
    u = rng.random(n)
    cnt = np.zeros(n, dtype=np.int64)
    cnt[u < P_RETRIGGER] = 3
    tease = u >= P_RETRIGGER
    tu = rng.random(n)
    cnt[tease & (tu >= 0.92)] = 2
    cnt[tease & (tu >= 0.72) & (tu < 0.92)] = 1
    return _paint_gold(rng, n, cnt), cnt


def _paint_gold(rng: np.random.Generator, n: int, cnt: np.ndarray) -> np.ndarray:
    col_order = np.argsort(rng.random((n, GRID_COLS)), axis=1)
    row_pick = rng.integers(0, GRID_ROWS, size=(n, GRID_COLS))
    mask = np.zeros((n, N_CELLS), dtype=bool)
    for g in range(GRID_COLS):
        take = np.flatnonzero(cnt > g)
        if take.size == 0:
            continue
        cols = col_order[take, g]
        rows = row_pick[take, cols]
        mask[take, rows * GRID_COLS + cols] = True
    return mask


def _place_mults(
    rng: np.random.Generator,
    n: int,
    chance: float,
    n_probs: List[float],
    intensity: float,
    forbidden: Optional[np.ndarray] = None,
) -> Tuple[np.ndarray, np.ndarray]:
    """Per-cell multiplier faces (n, 25) and bankAdd (n,)."""
    mult = np.zeros((n, N_CELLS), dtype=np.float64)
    trig = rng.random(n) < chance
    idxs = np.flatnonzero(trig)
    if idxs.size == 0:
        return mult, np.zeros(n)
    k = len(n_probs)
    ndraw = rng.choice(np.arange(1, k + 1), size=idxs.size, p=_norm(np.asarray(n_probs, dtype=np.float64)))
    keys = rng.random((n, N_CELLS))
    if forbidden is not None:
        keys = keys + np.where(forbidden, 1e9, 0.0)
    order = np.argsort(keys, axis=1)
    for j in range(int(ndraw.max())):
        sel = idxs[ndraw > j]
        if sel.size == 0:
            break
        cells = order[sel, j]
        vals = rng.choice(MULT_VALUES, size=sel.size, p=MULT_WEIGHTS)
        mult[sel, cells] = vals
    return mult, np.round(intensity * mult.sum(axis=1))


def _paying_bank(mult: np.ndarray, h: np.ndarray, intensity: float) -> np.ndarray:
    """Bank only × sitting on a line that paid a poker hand."""
    paying = HAND_PAY[h] > 0
    mask = np.zeros(mult.shape, dtype=bool)
    for li in range(LINES.shape[0]):
        rows = np.flatnonzero(paying[:, li])
        if rows.size:
            mask[np.ix_(rows, LINES[li])] = True
    return np.round(intensity * (mult * mask).sum(axis=1))


def _spin(
    rng: np.random.Generator,
    n: int,
    params: GridParams,
    klass: str,
    floor_idx: Optional[int] = None,
    goldens: bool = False,
    gmask: Optional[np.ndarray] = None,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """One board spin per row → (line wins, bankAdd, hand idxs (n,7))."""
    if gmask is None and goldens:
        gmask = _gold_mask(rng, n)
    ranks, suits = _deal(rng, n)
    h = _eval_lines(ranks, suits, gmask)
    if floor_idx is not None:
        _apply_floor(
            rng, ranks, suits, h, floor_idx,
            params.floor_rerolls["job" if floor_idx == JOB_MIN_IDX else "flush"], gmask,
        )
    mult, _placed = _place_mults(
        rng, n, params.chance[klass], params.n_probs[klass], params.intensity[klass], gmask
    )
    factor = np.maximum(1.0, mult[:, LINES].sum(axis=2))
    win = (HAND_PAY[h] * params.line_pay_scale * factor).sum(axis=1)
    bank = _paying_bank(mult, h, params.intensity[klass])
    return win, bank, h


def _fs_loop(
    rng: np.random.Generator,
    m: int,
    params: GridParams,
    klass: str,
    floor_idx: Optional[int] = None,
) -> np.ndarray:
    """FS package with retriggers: 3 goldens → +5 extra spins (capped)."""
    bank = np.zeros(m)
    total = np.zeros(m)
    remaining = np.full(m, FS_COUNT, dtype=np.int64)
    played = np.zeros(m, dtype=np.int64)
    for _ in range(MAX_FS):
        active = remaining > 0
        if not np.any(active):
            break
        gmask, cnt = _fs_gold_mask(rng, m)
        w, badd, _h = _spin(rng, m, params, klass, floor_idx=floor_idx, gmask=gmask)
        w = np.where(active, w, 0.0)
        badd = np.where(active, badd, 0.0)
        remaining = remaining - active.astype(np.int64)
        played = played + active.astype(np.int64)
        extra = np.where(active & (cnt >= 3), RETRIGGER_FS, 0)
        room = np.maximum(0, MAX_FS - played - remaining)
        remaining = remaining + np.minimum(extra, room)
        bank = bank + badd
        total = total + w * np.maximum(1.0, bank)
    return total


def _packages_no_floor(
    rng: np.random.Generator, m: int, params: GridParams, klass: str
) -> np.ndarray:
    """FS package with no hand floor (standard BONUS)."""
    return _fs_loop(rng, m, params, klass)


def _packages_per_spin_floor(
    rng: np.random.Generator, m: int, params: GridParams, klass: str, floor_idx: int
) -> np.ndarray:
    """FS package where every spin is floored (job: ≥1 JoB+ line per spin)."""
    return _fs_loop(rng, m, params, klass, floor_idx=floor_idx)


def _packages_package_floor(
    rng: np.random.Generator, m: int, params: GridParams, klass: str, floor_idx: int
) -> np.ndarray:
    """FS package floored as a whole: ≥1 Flush+ line somewhere in the first 10 spins.

    Retrigger extras beyond those 10 are plain deals (no extra flush floor).
    """
    cap = params.floor_rerolls["flush_package"]
    chunk = max(1, min(m, 20_000))
    total = np.zeros(m)
    for start in range(0, m, chunk):
        end = min(m, start + chunk)
        n = end - start
        ranks = np.zeros((n, FS_COUNT, N_CELLS), dtype=np.int64)
        suits = np.zeros((n, FS_COUNT, N_CELLS), dtype=np.int64)
        sat = np.zeros(n, dtype=bool)
        gm_all = np.zeros((n, FS_COUNT, N_CELLS), dtype=bool)
        cn_all = np.zeros((n, FS_COUNT), dtype=np.int64)
        for s in range(FS_COUNT):
            gm_all[:, s], cn_all[:, s] = _fs_gold_mask(rng, n)
        for attempt in range(cap + 1):
            need = np.flatnonzero(~sat)
            if need.size == 0:
                break
            for s in range(FS_COUNT):
                r2, s2 = _deal(rng, need.size)
                ranks[need, s] = r2
                suits[need, s] = s2
            flat_h = _eval_lines(
                ranks[need].reshape(-1, N_CELLS),
                suits[need].reshape(-1, N_CELLS),
                gm_all[need].reshape(-1, N_CELLS),
            )
            sat[need] = (flat_h >= floor_idx).any(axis=1).reshape(-1, FS_COUNT).any(axis=1)
        bank = np.zeros(n)
        pkg = np.zeros(n)
        remaining = np.full(n, FS_COUNT, dtype=np.int64)
        played = np.zeros(n, dtype=np.int64)
        for s in range(FS_COUNT):
            gmask, cnt = gm_all[:, s], cn_all[:, s]
            h = _eval_lines(ranks[:, s], suits[:, s], gmask)
            mult, _placed = _place_mults(
                rng, n, params.chance[klass], params.n_probs[klass], params.intensity[klass], gmask
            )
            factor = np.maximum(1.0, mult[:, LINES].sum(axis=2))
            win = (HAND_PAY[h] * params.line_pay_scale * factor).sum(axis=1)
            badd = _paying_bank(mult, h, params.intensity[klass])
            remaining -= 1
            played += 1
            extra = np.where(cnt >= 3, RETRIGGER_FS, 0)
            room = np.maximum(0, MAX_FS - played - remaining)
            remaining = remaining + np.minimum(extra, room)
            bank += badd
            pkg += win * np.maximum(1.0, bank)
        for _ in range(MAX_FS - FS_COUNT):
            active = remaining > 0
            if not np.any(active):
                break
            gmask, cnt = _fs_gold_mask(rng, n)
            w, badd, _h = _spin(rng, n, params, klass, gmask=gmask)
            w = np.where(active, w, 0.0)
            badd = np.where(active, badd, 0.0)
            remaining = remaining - active.astype(np.int64)
            played = played + active.astype(np.int64)
            extra = np.where(active & (cnt >= 3), RETRIGGER_FS, 0)
            room = np.maximum(0, MAX_FS - played - remaining)
            remaining = remaining + np.minimum(extra, room)
            bank = bank + badd
            pkg = pkg + w * np.maximum(1.0, bank)
        total[start:end] = pkg
    return total


# ---------------------------------------------------------------------------
# Calibration
# ---------------------------------------------------------------------------

def probe_parts(
    n_spin: int, n_pkg: int, params: GridParams, seed: int = 1234
) -> Dict[str, float]:
    """Raw (scale-free) part means at the params' current knobs.

    linePayScale is forced to 1.0 for probing; callers rescale.
    """
    probe = GridParams(
        line_pay_scale=1.0,
        chance=params.chance,
        n_probs=params.n_probs,
        intensity=params.intensity,
        floor_rerolls=params.floor_rerolls,
    )
    rng = np.random.default_rng(seed)
    s, _, _ = _spin(rng, n_spin, probe, "base", goldens=True)
    b = _packages_no_floor(rng, n_pkg, probe, "bonus")
    j = _packages_per_spin_floor(rng, n_pkg, probe, "job", JOB_MIN_IDX)
    f = _packages_per_spin_floor(rng, n_pkg, probe, "flush", FLUSH_MIN_IDX)
    aj, _, _ = _spin(rng, n_spin, probe, "ante_job", floor_idx=JOB_MIN_IDX)
    af, _, _ = _spin(rng, min(n_spin, 200_000), probe, "ante_flush", floor_idx=FLUSH_MIN_IDX)
    return {
        "S": float(s.mean()),
        "B": float(b.mean()),
        "J": float(j.mean()),
        "F": float(f.mean()),
        "AJ": float(aj.mean()),
        "AF": float(af.mean()),
    }


def calibrate_grid(
    verbose: bool = True, frozen: Optional[GridParams] = None
) -> Tuple[GridParams, Dict[str, float]]:
    """Catalog (multiple-of-5) prices; feature chance knobs + trigger λ hold 96%.

    linePayScale = 1 and modeScale = 1 — every win is the declared ladder.
    Charged prices are the CATALOG_PRICES. For each paid mode the multiplier
    chance knob is tuned so E[part] = price × TARGET_RTP (EV scales ~linearly
    with chance). Base: one λ on the authored trigger chances solves
    E[spin] + λ·Σ p_k·E[part_k] = TARGET_RTP.
    """
    global P_BONUS, P_JOB_BONUS, P_FLUSH_BONUS
    params = frozen if frozen is not None else GridParams()
    params.line_pay_scale = LINE_PAY_SCALE
    params.mode_scale = {m: 1.0 for m in MODE_COST}

    # Tune each paid mode's chance so its probe EV hits price × 0.96.
    targets = {
        "B": ("bonus", "bonus", CATALOG_PRICES["bonus"] * TARGET_RTP),
        "J": ("bonus_job", "job", CATALOG_PRICES["bonus_job"] * TARGET_RTP),
        "F": ("bonus_flush", "flush", CATALOG_PRICES["bonus_flush"] * TARGET_RTP),
        "AJ": ("ante_job", "ante_job", CATALOG_PRICES["ante_job"] * TARGET_RTP),
        "AF": ("ante_flush", "ante_flush", CATALOG_PRICES["ante_flush"] * TARGET_RTP),
    }
    parts: Dict[str, float] = {}
    for _round in range(3):
        parts = probe_parts(80_000, 6_000, params)
        worst = 0.0
        for key, (_mode, klass, want) in targets.items():
            ev = parts[key]
            worst = max(worst, abs(ev / want - 1.0))
            params.chance[klass] = float(
                np.clip(params.chance[klass] * want / max(ev, 1e-9), 0.01, 1.0)
            )
        if worst < 0.02:
            break
    parts = probe_parts(120_000, 10_000, params)

    # Prices stay catalog; record the fair EVs.
    MODE_COST.update({m: CATALOG_PRICES[m] for m in CATALOG_PRICES})
    PRICING.clear()
    for key, (mode, _klass, _want) in targets.items():
        PRICING[mode] = {"ev": round(parts[key], 4), "price": CATALOG_PRICES[mode]}

    # One λ scale on trigger chances closes the base identity.
    spin = parts["S"]
    feat = (
        P_BONUS * parts["B"]
        + P_JOB_BONUS * parts["J"]
        + P_FLUSH_BONUS * parts["F"]
    )
    if spin >= TARGET_RTP:
        raise RuntimeError(
            f"base spin EV {spin:.3f} already ≥ {TARGET_RTP} — cannot price triggers down"
        )
    lam = (TARGET_RTP - spin) / feat
    if not 0.05 <= lam <= 1.5:
        raise RuntimeError(f"trigger scale λ={lam:.3f} outside sane band [0.05, 1.5]")
    P_BONUS *= lam
    P_JOB_BONUS *= lam
    P_FLUSH_BONUS *= lam
    PRICING["_lambda"] = {"ev": feat, "price": lam}

    if verbose:
        print("=== Grid calibration (5×5, 7 lines, honest deck) ===")
        print("  published pays, linePayScale = modeScale = 1 (no trims)")
        for k in ("base", "bonus", "job", "flush", "ante_job", "ante_flush"):
            print(
                f"  mult[{k:10}] chance={params.chance[k]:.3f} "
                f"nProbs={np.round(params.n_probs[k], 3).tolist()}"
            )
        print(f"  parts vs catalog targets  = "
              f"{ {k: round(parts[k], 2) for k in parts} }")
        print(f"  trigger λ                 = {lam:.4f}")
        print(
            f"  triggers: bonus 1/{1 / P_BONUS:,.0f}  job 1/{1 / P_JOB_BONUS:,.0f}  "
            f"flush 1/{1 / P_FLUSH_BONUS:,.0f}"
        )
        print(f"  catalog prices: {dict(MODE_COST)}")
        print()
    return params, parts


# ---------------------------------------------------------------------------
# Monte Carlo per mode
# ---------------------------------------------------------------------------

@dataclass
class _ModeAcc:
    n: float = 0.0
    sum_unc: float = 0.0
    sum_cap: float = 0.0
    sum_sq: float = 0.0
    n_max: float = 0.0
    n_ge5k: float = 0.0
    n_ge10k: float = 0.0
    max_obs: float = 0.0
    tops: List[np.ndarray] = field(default_factory=list)

    def add(self, uncapped: np.ndarray) -> None:
        capped = np.minimum(uncapped, MAX_WIN)
        k = max(1, int(math.ceil(0.001 * capped.size)))
        self.tops.append(np.partition(capped, -k)[-k:])
        self.n += capped.size
        self.sum_unc += float(uncapped.sum())
        self.sum_cap += float(capped.sum())
        self.sum_sq += float(np.square(capped).sum())
        self.n_max += float((capped >= MAX_WIN - 1e-9).sum())
        self.n_ge5k += float((capped >= 5000).sum())
        self.n_ge10k += float((capped >= 10000).sum())
        self.max_obs = max(self.max_obs, float(capped.max()))


def _mc_chunk(args: Tuple) -> Dict[str, object]:
    n, seed, params = args
    rng = np.random.default_rng(seed)
    sc = params.mode_scale
    out: Dict[str, object] = {m: _ModeAcc() for m in MODE_COST}
    base_spin_acc = _ModeAcc()

    # --- base rounds (spin + triggered package) ---
    sw, _, _ = _spin(rng, n, params, "base", goldens=True)
    base_spin_acc.add(sw * sc["base"])
    base_win = sw * sc["base"]
    u = rng.random(n)
    is_flush = u < P_FLUSH_BONUS
    is_job = (~is_flush) & (u < P_FLUSH_BONUS + P_JOB_BONUS)
    is_bonus = (~is_flush) & (~is_job) & (u < P_FLUSH_BONUS + P_JOB_BONUS + P_BONUS)
    n_job = int(is_job.sum())
    n_flush = int(is_flush.sum())
    n_bonus = int(is_bonus.sum())
    if n_job:
        pkg = _packages_per_spin_floor(rng, n_job, params, "job", JOB_MIN_IDX)
        base_win[is_job] += pkg * sc["bonus_job"]
    if n_flush:
        pkg = _packages_per_spin_floor(rng, n_flush, params, "flush", FLUSH_MIN_IDX)
        base_win[is_flush] += pkg * sc["bonus_flush"]
    if n_bonus:
        pkg = _packages_no_floor(rng, n_bonus, params, "bonus")
        base_win[is_bonus] += pkg * sc.get("bonus", 1.0)
    out["base"].add(base_win)  # type: ignore[union-attr]
    out["baseSpin"] = base_spin_acc

    # --- standalone modes ---
    out["bonus"].add(  # type: ignore[union-attr]
        _packages_no_floor(rng, n, params, "bonus") * sc["bonus"]
    )
    out["bonus_job"].add(  # type: ignore[union-attr]
        _packages_per_spin_floor(rng, n, params, "job", JOB_MIN_IDX) * sc["bonus_job"]
    )
    out["bonus_flush"].add(  # type: ignore[union-attr]
        _packages_per_spin_floor(rng, max(1, n // 2), params, "flush", FLUSH_MIN_IDX) * sc["bonus_flush"]
    )
    aj, _, _ = _spin(rng, n, params, "ante_job", floor_idx=JOB_MIN_IDX)
    out["ante_job"].add(aj * sc["ante_job"])  # type: ignore[union-attr]
    af_n = max(1, n // 8)
    af, _, _ = _spin(rng, af_n, params, "ante_flush", floor_idx=FLUSH_MIN_IDX)
    out["ante_flush"].add(af * sc["ante_flush"])  # type: ignore[union-attr]
    return out


def _merge_mode(accs: List[_ModeAcc]) -> Dict[str, float]:
    acc = _ModeAcc()
    for src in accs:
        acc.n += src.n
        acc.sum_unc += src.sum_unc
        acc.sum_cap += src.sum_cap
        acc.sum_sq += src.sum_sq
        acc.n_max += src.n_max
        acc.n_ge5k += src.n_ge5k
        acc.n_ge10k += src.n_ge10k
        acc.max_obs = max(acc.max_obs, src.max_obs)
        acc.tops.extend(src.tops)
    mean = acc.sum_cap / acc.n
    all_top = np.concatenate(acc.tops) if acc.tops else np.array([0.0])
    k = max(1, int(math.ceil(0.001 * all_top.size)))
    cvar = float(np.partition(all_top, -k)[-k:].mean())
    return {
        "n": acc.n,
        "meanCapped": mean,
        "rtpUncapped": acc.sum_unc / acc.n,
        "rtpCapped": mean,
        "std": math.sqrt(max(0.0, acc.sum_sq / acc.n - mean * mean)),
        "nMaxWin": acc.n_max,
        "tail5k": acc.n_ge5k / acc.n,
        "tail10k": acc.n_ge10k / acc.n,
        "maxObs": acc.max_obs,
        "cvar": cvar,
    }


def run_mode_monte_carlo(
    n_rounds: int, params: GridParams, workers: int = 0, seed: int = 42
) -> Dict[str, Dict[str, float]]:
    if workers <= 0:
        import os

        workers = max(1, min(8, os.cpu_count() or 4))
    chunk = 100_000
    jobs = []
    left = n_rounds
    i = 0
    while left > 0:
        sz = min(chunk, left)
        jobs.append((sz, seed + i * 10007, params))
        left -= sz
        i += 1

    t0 = time.time()
    if workers == 1:
        parts = [_mc_chunk(j) for j in jobs]
    else:
        with ProcessPoolExecutor(max_workers=workers) as ex:
            parts = list(ex.map(_mc_chunk, jobs, chunksize=1))
    elapsed = time.time() - t0

    merged: Dict[str, Dict[str, float]] = {}
    for mode in list(MODE_COST) + ["baseSpin"]:
        stats = _merge_mode([p[mode] for p in parts])  # type: ignore[literal-required]
        if mode in MODE_COST:
            cost = MODE_COST[mode]
            stats["rtpUncapped"] /= cost
            stats["rtpCapped"] /= cost
        merged[mode] = stats
    merged["_elapsed"] = {"sec": elapsed, "workers": workers}  # type: ignore[assignment]
    return merged


# ---------------------------------------------------------------------------
# Reporting / export
# ---------------------------------------------------------------------------

def print_report(params: GridParams, mc: Dict[str, Dict[str, float]]) -> None:
    print("=" * 72)
    print(" PAR SHEET — Poker Mult Slot (5×5 grid · 7 lines × multipliers)")
    print("=" * 72)
    print()
    print("--- Per-mode RTP (MC, capped) ---")
    print(f"  {'mode':<14} {'RTP':>9} {'uncapped':>9} {'std':>8} {'P≥5k':>9} {'P≥10k':>9} {'maxObs':>10}")
    for mode in MODE_COST:
        s = mc[mode]
        print(
            f"  {mode:<14} {100*s['rtpCapped']:>8.3f}% {100*s['rtpUncapped']:>8.3f}% "
            f"{s['std']:>8.2f} {100*s['tail5k']:>8.4f}% {100*s['tail10k']:>8.4f}% {s['maxObs']:>10,.1f}"
        )
    rtps = [mc[m]["rtpCapped"] for m in MODE_COST]
    band_ok = all(0.90 <= r <= 0.967 for r in rtps)
    spread_ok = (max(rtps) - min(rtps)) <= 0.005
    print()
    print(f"  Stake band [90%, 96.7%]: {'PASS' if band_ok else 'FAIL'}")
    print(f"  Cross-mode spread ≤0.50%: {'PASS' if spread_ok else 'FAIL'}"
          f"  (spread = {100 * (max(rtps) - min(rtps)):.4f}%)")
    print()

    b = mc["base"]
    rows = [
        ("Max Payout Multiplier", b["maxObs"], 25_000.0, b["maxObs"] <= 25_000.0 + 1e-6),
        ("Tail P(≥5,000x)", b["tail5k"], 0.0100, b["tail5k"] <= 0.0100),
        ("Tail P(≥10,000x)", b["tail10k"], 0.0050, b["tail10k"] <= 0.0050),
        ("Base Volatility (Std Dev)", b["std"], 50.0, b["std"] <= 50.0),
        ("Risk Limit (CVaR abs 0.1%)", b["cvar"], 20_000.0, b["cvar"] <= 20_000.0),
    ]
    print("--- Compliance Matrix (base mode, 2 Star) ---")
    all_pass = True
    for name, val, lim, ok in rows:
        all_pass &= ok
        if "Tail" in name:
            v_s, l_s = f"{100*val:.4f}%", f"{100*lim:.2f}%"
        elif "Max Payout" in name:
            v_s, l_s = f"{val:,.1f}x", f"{lim:,.0f}x"
        else:
            v_s, l_s = f"{val:,.2f}", f"{lim:,.1f}"
        print(f"  {name:<32} {v_s:>14} {l_s:>12} {'PASS' if ok else 'FAIL':>8}")
    print()
    print(f"  Overall 2★: {'PASS' if all_pass else 'FAIL'}")
    print()
    print(f"MC base rounds={int(mc['base']['n']):,}  elapsed={mc['_elapsed']['sec']:.1f}s  "
          f"workers={int(mc['_elapsed']['workers'])}")
    print("=" * 72)


def _config_doc() -> Dict[str, str]:
    return {
        "board": "5 rows × 5 cols = 25 cards, index r*5+c (row-major), dealt from ONE shuffled 52-card deck — all 25 cards unique.",
        "lines": "Exactly 7 paylines: H0–H4 horizontal rows plus long diagonals D0=0,6,12,18,24 and D1=4,8,12,16,20. No verticals, no zigzags, no ways, no clusters.",
        "winRule": "spinWin = Σ over 7 lines of handPay(line) × max(1, Σ cell multipliers on that line), capped at maxWin. Multipliers SUM on the line and multiply the hand pay — they never add to it. Golden cells never carry a multiplier.",
        "freeSpins": "Each line term additionally × max(1, bonusBank). bankAdd is the sum of × that sit on a paying line, added BEFORE this spin's factor. During FS, 3 goldens retrigger +5 extra spins (cap maxFs).",
        "goldens": "Bonus kind is sampled first (flush 1/1500 → 5 goldens, job 1/120 → 4, standard bonus 1/160 → 3, else tease 0–2). During free spins 3 goldens retrigger +5 FS (1/80). At most one golden per column.",
        "floorPolicy": "Conditional deal with capped rerolls. job modes (JOB free spins, SPIN JOB): redeal until ≥1 line is Jacks-or-Better or better (cap floorRerolls.job). flush modes (FLUSH free spins, SPIN FLUSH): redeal until ≥1 line is Flush or better (cap floorRerolls.flush). If a cap is exhausted the last board is accepted as-is.",
        "linePayScale": "1 — hands.pays ARE the published per-line table (0.25 / 0.5 / 0.75 / 1 / 1.5 / 2 / 8 / 20 / 200), paid as-is. No scale trims: 96% RTP is held by trigger chances (triggers block) and buy/ante prices (bonusBuy/anteSpin priceUiX).",
        "modeScale": "All 1 — displayed wins equal the published paytable in every mode. Never reintroduce part scales; retune prices/triggers instead.",
        "pricing": "priceUiX = ceil(E[part]/0.96, 2dp) is the charged price and must equal game_config.py BetMode.cost. priceX is the fair EV. Base triggers share one λ scale solved from E[spin] + λ·Σ p·E[part] = 0.96.",
    }


def export_math_config(
    path: Path,
    params: GridParams,
    mc: Optional[Dict[str, Dict[str, float]]] = None,
) -> None:
    payload = {
        "gameId": "poker-mult-slot",
        "_doc": _config_doc(),
        "uiDisplayRtp": UI_DISPLAY_RTP,
        "mathRtpTarget": TARGET_RTP_MID,
        "maxWin": MAX_WIN,
        "fsCount": FS_COUNT,
        "retrigger": {
            "goldens": 3,
            "extraFs": RETRIGGER_FS,
            "p": P_RETRIGGER,
            "maxFs": MAX_FS,
        },
        "grid": {"rows": GRID_ROWS, "cols": GRID_COLS},
        "lines": {
            "H0": [0, 1, 2, 3, 4],
            "H1": [5, 6, 7, 8, 9],
            "H2": [10, 11, 12, 13, 14],
            "H3": [15, 16, 17, 18, 19],
            "H4": [20, 21, 22, 23, 24],
            "D0": [0, 6, 12, 18, 24],
            "D1": [4, 8, 12, 16, 20],
        },
        "params": {
            "linePayScale": round(params.line_pay_scale, 6),
            "modeScale": {k: round(v, 6) for k, v in params.mode_scale.items()},
            "floorRerolls": params.floor_rerolls,
        },
        "triggers": {"bonus": P_BONUS, "job": P_JOB_BONUS, "flush": P_FLUSH_BONUS},
        "hands": {"names": HAND_NAMES, "pays": HAND_PAY.tolist()},
        "multipliers": {
            "values": MULT_VALUES.tolist(),
            "weights": np.round(MULT_WEIGHTS, 8).tolist(),
            "nProbs": {k: [round(x, 4) for x in v] for k, v in params.n_probs.items()},
            "chance": {k: round(v, 4) for k, v in params.chance.items()},
            "intensity": params.intensity,
        },
        "floorPolicy": {
            "job": {"minHandIndex": JOB_MIN_IDX, "scope": "perSpin"},
            "flush": {"minHandIndex": FLUSH_MIN_IDX, "scope": "perSpin"},
            "flushPackage": {"minHandIndex": FLUSH_MIN_IDX, "scope": "perSpin"},
        },
        "bonusBuy": {
            "bonus": {
                "priceX": 0.0,
                "priceUiX": float(MODE_COST["bonus"]),
                "label": "BONUS",
                "description": "10 Free Spins · Paying-line × add into one Bonus Bank · 3 goldens retrigger +5",
            },
            "job": {
                "priceX": 0.0,
                "priceUiX": float(MODE_COST["bonus_job"]),
                "label": "JOB BONUS",
                "description": "10 Free Spins · Min Jacks or Better line each spin · Paying-line × add into one Bonus Bank · 3 goldens retrigger +5",
                "guarantee": "JACKS OR BETTER",
            },
            "flush": {
                "priceX": 0.0,
                "priceUiX": float(MODE_COST["bonus_flush"]),
                "label": "FLUSH BONUS",
                "badge": "SUPER BONUS",
                "description": "10 Free Spins · Min Flush-or-better line each spin · Paying-line × add into one Bonus Bank · 3 goldens retrigger +5",
                "guarantee": "FLUSH LINE",
            },
        },
        "anteSpin": {
            "job": {
                "evX": 0.0,
                "priceX": 0.0,
                "priceUiX": float(MODE_COST["ante_job"]),
                "label": "SPIN JOB",
                "guarantee": "JACKS OR BETTER LINE",
            },
            "flush": {
                "evX": 0.0,
                "priceX": 0.0,
                "priceUiX": float(MODE_COST["ante_flush"]),
                "label": "SPIN FLUSH",
                "guarantee": "FLUSH LINE",
            },
        },
        "mc": None
        if mc is None
        else {
            "rounds": int(mc["base"]["n"]),
            "rtpCapped": mc["base"]["rtpCapped"],
            "perModeRtp": {m: mc[m]["rtpCapped"] for m in MODE_COST},
            "shares": {
                "base": mc["base"]["rtpCapped"] * MODE_COST["base"],
                "bonus": P_BONUS * MODE_COST["bonus"] * TARGET_RTP,
                "job": P_JOB_BONUS * MODE_COST["bonus_job"] * TARGET_RTP,
                "flush": P_FLUSH_BONUS * MODE_COST["bonus_flush"] * TARGET_RTP,
            },
            "maxObs": mc["base"]["maxObs"],
            "nMaxWin": int(mc["base"]["nMaxWin"]),
            "std": mc["base"]["std"],
            "tail5k": mc["base"]["tail5k"],
            "tail10k": mc["base"]["tail10k"],
        },
    }
    # priceX = fair EV of the part (charged priceUiX ≈ EV / TARGET_RTP).
    # PRICING is filled by calibrate_grid; fall back to 0.96×price for
    # pure re-exports of a frozen config.
    for mode, key in (("bonus", "bonus"), ("bonus_job", "job"), ("bonus_flush", "flush")):
        payload["bonusBuy"][key]["priceX"] = round(
            PRICING.get(mode, {}).get("ev", MODE_COST[mode] * TARGET_RTP), 3
        )
    for mode, key in (("ante_job", "job"), ("ante_flush", "flush")):
        ev = PRICING.get(mode, {}).get("ev", MODE_COST[mode] * TARGET_RTP)
        payload["anteSpin"][key]["evX"] = round(ev, 3)
        payload["anteSpin"][key]["priceX"] = round(ev, 3)

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote math config → {path}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _load_frozen(path: Path) -> Optional[GridParams]:
    """Load previously exported knobs so re-exports never drift."""
    if not path.exists():
        return None
    try:
        cfg = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if "multipliers" not in cfg or "ante_job" not in cfg["multipliers"].get("chance", {}):
        return None  # pre-grid config
    p = GridParams()
    p.line_pay_scale = float(cfg["params"]["linePayScale"])
    p.chance = {k: float(v) for k, v in cfg["multipliers"]["chance"].items()}
    p.n_probs = {k: [float(x) for x in v] for k, v in cfg["multipliers"]["nProbs"].items()}
    p.intensity = {k: float(v) for k, v in cfg["multipliers"]["intensity"].items()}
    p.floor_rerolls = {k: int(v) for k, v in cfg["params"]["floorRerolls"].items()}
    if "modeScale" in cfg["params"]:
        p.mode_scale = {k: float(v) for k, v in cfg["params"]["modeScale"].items()}
    return p


def main() -> None:
    ap = argparse.ArgumentParser(description="Poker Mult Slot 5×5 grid PAR + Monte Carlo")
    ap.add_argument("--rounds", type=int, default=N_ROUNDS_DEFAULT)
    ap.add_argument("--workers", type=int, default=0)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--theory-only", action="store_true", help="Calibrate + export, skip final MC")
    ap.add_argument("--frozen", action="store_true", help="Reuse knobs from existing mathConfig.json")
    ap.add_argument("--export", type=str, default="")
    ap.add_argument("--write-config", action="store_true")
    args = ap.parse_args()

    default_out = Path(__file__).parent / "frontend" / "src" / "mathConfig.json"
    frozen = _load_frozen(default_out) if args.frozen else None
    params, parts = calibrate_grid(verbose=True, frozen=frozen)

    print("=== Raw part means (declared pays, untrimmed) ===")
    for k, v in parts.items():
        print(f"  {k:3} = {v:10.4f}× ")
    print()

    # Verification MC only — no scale corrections: prices + trigger λ (set in
    # calibrate_grid) hold the RTP. Books-side refinement lives in run.py.
    mc = None
    if not args.theory_only:
        print(f"=== Monte Carlo: {args.rounds:,} base rounds (all modes) ===")
        mc = run_mode_monte_carlo(args.rounds, params, workers=args.workers, seed=args.seed)
        print_report(params, mc)

    if args.write_config or args.export:
        out = Path(args.export) if args.export else default_out
        export_math_config(out, params, mc)


if __name__ == "__main__":
    main()
