"""Precompute contain-sums: for every k-set K, sum of 5-card superhand stats.

contain[k][colex(K)] = sum of f(S) over all 5-card S that contain K.

Built by evaluating every deal in numpy, then scatter-adding each deal's
stats onto all 32 subsets via colex indices.
"""

from __future__ import annotations

from itertools import combinations

import numpy as np

from .combinadic import binomial_table
from .constants import Category, N_CARDS, N_DEALS, PAYTABLE_7_5

K_MAX = 5


def all_five_card_combos() -> np.ndarray:
    """(C(52,5), 5) uint8 array in itertools.combinations order."""
    return np.fromiter(
        (c for combo in combinations(range(N_CARDS), 5) for c in combo),
        dtype=np.uint8,
        count=N_DEALS * 5,
    ).reshape(N_DEALS, 5)


def evaluate_all(combos: np.ndarray) -> np.ndarray:
    """Vectorized JoB category for an (N, 5) card array. Returns int8 in 0..9."""
    n = combos.shape[0]
    ranks = combos % 13
    suits = combos // 13
    is_flush = suits.min(axis=1) == suits.max(axis=1)

    counts = np.zeros((n, 13), dtype=np.uint8)
    rows = np.arange(n)
    for i in range(5):
        counts[rows, ranks[:, i]] += 1

    n_unique = (counts > 0).sum(axis=1)
    cmax = counts.max(axis=1)
    counts_wo_max = counts.copy()
    counts_wo_max[rows, counts.argmax(axis=1)] = 0
    csecond = counts_wo_max.max(axis=1)

    pair_rank = np.where(counts == 2, np.arange(13, dtype=np.int16), np.int16(-1)).max(axis=1)

    rank_idx = np.arange(13, dtype=np.int16)
    present = counts > 0
    rank_min = np.where(present, rank_idx, np.int16(99)).min(axis=1)
    rank_max = np.where(present, rank_idx, np.int16(-1)).max(axis=1)
    is_straight = (n_unique == 5) & (rank_max - rank_min == 4)
    wheel = (
        (n_unique == 5)
        & (counts[:, 12] == 1)
        & (counts[:, 0] == 1)
        & (counts[:, 1] == 1)
        & (counts[:, 2] == 1)
        & (counts[:, 3] == 1)
    )
    is_straight = is_straight | wheel

    is_royal = (
        is_flush
        & is_straight
        & (counts[:, 8] == 1)
        & (counts[:, 9] == 1)
        & (counts[:, 10] == 1)
        & (counts[:, 11] == 1)
        & (counts[:, 12] == 1)
    )

    return np.select(
        [
            is_royal.astype(bool),
            (is_flush & is_straight).astype(bool),
            (cmax == 4),
            (cmax == 3) & (csecond == 2),
            is_flush.astype(bool),
            is_straight.astype(bool),
            (cmax == 3),
            (cmax == 2) & (csecond == 2),
            (cmax == 2) & (pair_rank >= 9),
        ],
        [
            int(Category.ROYAL_FLUSH),
            int(Category.STRAIGHT_FLUSH),
            int(Category.FOUR_OF_A_KIND),
            int(Category.FULL_HOUSE),
            int(Category.FLUSH),
            int(Category.STRAIGHT),
            int(Category.THREE_OF_A_KIND),
            int(Category.TWO_PAIR),
            int(Category.JACKS_OR_BETTER),
        ],
        default=int(Category.NOTHING),
    ).astype(np.int8)


def _empty_tables(binom: np.ndarray) -> list[np.ndarray]:
    return [np.zeros(int(binom[N_CARDS, k]), dtype=np.int64) for k in range(K_MAX + 1)]


def _colex_indices(subset_sorted: np.ndarray, k: int, binom: np.ndarray) -> np.ndarray:
    idx = np.zeros(subset_sorted.shape[0], dtype=np.int64)
    for i in range(k):
        idx += binom[subset_sorted[:, i], i + 1]
    return idx


def build_contain_sums(paytable: dict[Category, int] | None = None):
    """Return (binom, pay, royal, win, category_counts, combos, cat)."""
    if paytable is None:
        paytable = PAYTABLE_7_5
    pay_arr = np.zeros(10, dtype=np.int64)
    for cat, amount in paytable.items():
        pay_arr[int(cat)] = amount

    binom = binomial_table()
    combos = all_five_card_combos()
    if combos.shape[0] != N_DEALS:
        raise RuntimeError(f"Expected {N_DEALS} deals, built {combos.shape[0]}")
    cat = evaluate_all(combos)
    pay5 = pay_arr[cat]
    royal5 = (cat == int(Category.ROYAL_FLUSH)).astype(np.int64)
    win5 = (pay5 > 0).astype(np.int64)

    pay = _empty_tables(binom)
    royal = _empty_tables(binom)
    win = _empty_tables(binom)
    cat_tables = [_empty_tables(binom) for _ in range(10)]

    for mask in range(32):
        bits = [i for i in range(5) if mask & (1 << i)]
        k = len(bits)
        if k == 0:
            pay[0][0] += int(pay5.sum())
            royal[0][0] += int(royal5.sum())
            win[0][0] += int(win5.sum())
            for c in range(10):
                cat_tables[c][0][0] += int((cat == c).sum())
            continue
        subset = np.sort(combos[:, bits], axis=1)
        idx = _colex_indices(subset, k, binom)
        np.add.at(pay[k], idx, pay5)
        np.add.at(royal[k], idx, royal5)
        np.add.at(win[k], idx, win5)
        for c in range(10):
            np.add.at(cat_tables[c][k], idx, (cat == c).astype(np.int64))

    return binom, pay, royal, win, cat_tables, combos, cat
