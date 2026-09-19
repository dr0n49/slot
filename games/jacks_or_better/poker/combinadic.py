"""Colex combinadic indexing for k-subsets of 52 cards."""

from __future__ import annotations

import numpy as np

from .constants import N_CARDS


def binomial_table(n_max: int = N_CARDS, k_max: int = 5) -> np.ndarray:
    """C[n, k] for 0<=n<=n_max, 0<=k<=k_max. C[n,k]=0 when n<k."""
    table = np.zeros((n_max + 1, k_max + 1), dtype=np.int64)
    table[:, 0] = 1
    for n in range(1, n_max + 1):
        upper = n if n < k_max else k_max
        for k in range(1, upper + 1):
            table[n, k] = table[n - 1, k] + table[n - 1, k - 1]
    return table


def colex_index(cards, k: int, binom: np.ndarray) -> int:
    """Index of a sorted k-subset in colex order.

    Combination c0 < c1 < ... < c_{k-1} maps to sum_i C(c_i, i+1).
    """
    idx = 0
    for i in range(k):
        idx += int(binom[int(cards[i]), i + 1])
    return idx


def colex_unrank(index: int, k: int, binom: np.ndarray, n: int = N_CARDS) -> tuple[int, ...]:
    """Inverse of colex_index: k-subset of {0..n-1} with the given colex rank."""
    out = [0] * k
    x = int(index)
    for i in range(k, 0, -1):
        lo, hi, c = i - 1, n - 1, i - 1
        while lo <= hi:
            mid = (lo + hi) // 2
            if int(binom[mid, i]) <= x:
                c = mid
                lo = mid + 1
            else:
                hi = mid - 1
        out[i - 1] = c
        x -= int(binom[c, i])
    return tuple(out)
