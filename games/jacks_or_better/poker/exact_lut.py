"""Exact LUT weights from combinatorial category masses + n=2 double-up.

Books stay one visual per deal; the LUT no longer weights them equally.
Each (poker-category × double-up-survival) atom has an exact integer mass
from the optimal-hold enumeration. That mass is split across the books
whose payoutMultiplier realizes the atom (quotient + remainder), so
weighted RTP/hit/max-win match the combinatorial fractions exactly.
"""

from __future__ import annotations

from collections import defaultdict
from fractions import Fraction
from typing import Iterable, Sequence

from .constants import (
    DOUBLE_UP_MAX_CHAIN,
    DOUBLE_UP_PAYOUT,
    PAYTABLE_7_5,
    Category,
)

# Survive both even-money doubles: 2^n = 4 when n=2.
DU_SURVIVE_MULT = DOUBLE_UP_PAYOUT**DOUBLE_UP_MAX_CHAIN  # 4
# Integer split of a fair n=2 chain: 1 survive : 3 fail, total 4.
DU_DENOM = DU_SURVIVE_MULT


def survive_payout_multiplier(poker_pay: int) -> int:
    """RGS payoutMultiplier for a paying hand that survives the n=2 chain."""
    return int(poker_pay) * DU_SURVIVE_MULT * 100


# paying category → LUT payoutMultiplier after a successful n=2 chain
SURVIVE_PAYOUT_OF_CATEGORY: dict[int, int] = {
    int(cat): survive_payout_multiplier(pay) for cat, pay in PAYTABLE_7_5.items() if pay > 0
}
CATEGORY_OF_SURVIVE_PAYOUT: dict[int, int] = {v: k for k, v in SURVIVE_PAYOUT_OF_CATEGORY.items()}


def distribute_mass(n_items: int, mass: int) -> list[int]:
    """Integer weights of length n_items that sum exactly to mass."""
    if n_items <= 0:
        raise ValueError("n_items must be positive")
    if mass < 0:
        raise ValueError("mass must be non-negative")
    q, r = divmod(mass, n_items)
    return [q + (1 if i < r else 0) for i in range(n_items)]


def atom_masses(cat_numer: Sequence[int], rtp_denom: int) -> dict[int, int]:
    """Exact integer mass per LUT payoutMultiplier after mandatory n=2 double-up.

    Survive-both atom for category c (pay W): mass = cat_numer[c], payout = 4W.
    All other probability (nothing + failed doubles) sits at payout 0.
    Total mass = 4 * rtp_denom.
    """
    if len(cat_numer) != 10:
        raise ValueError("cat_numer must have 10 category counts")
    hit_numer = sum(int(cat_numer[c]) for c in range(10) if PAYTABLE_7_5[Category(c)] > 0)
    total = DU_DENOM * rtp_denom
    masses: dict[int, int] = {0: total - hit_numer}
    for cat, pay_mult in SURVIVE_PAYOUT_OF_CATEGORY.items():
        masses[pay_mult] = int(cat_numer[cat])
    if masses[0] < 0:
        raise ValueError("hit_numer exceeds 4 * rtp_denom")
    return masses


def weights_for_payouts(
    payouts: Sequence[int],
    cat_numer: Sequence[int],
    rtp_denom: int,
) -> list[int]:
    """Per-book integer LUT weights. Sum per payout class equals the atom mass."""
    masses = atom_masses(cat_numer, rtp_denom)
    buckets: dict[int, list[int]] = defaultdict(list)
    for i, p in enumerate(payouts):
        buckets[int(p)].append(i)

    unexpected = set(buckets) - set(masses)
    if unexpected:
        raise ValueError(f"LUT has payouts with no combinatorial atom: {sorted(unexpected)}")

    weights = [0] * len(payouts)
    for payout, idxs in buckets.items():
        mass = masses[payout]
        if mass > 0 and not idxs:
            raise ValueError(f"combinatorial mass {mass} for payout {payout} has no books")
        if not idxs:
            continue
        for i, w in zip(idxs, distribute_mass(len(idxs), mass)):
            weights[i] = w
    # Atoms with mass but no books already raised. Atoms with no books and mass 0 are fine.
    for payout, mass in masses.items():
        if mass > 0 and payout not in buckets:
            raise ValueError(f"missing books for payout {payout} (mass {mass})")
    return weights


def weighted_rtp_fraction(payouts: Sequence[int], weights: Sequence[int]) -> Fraction:
    """Exact RTP as Fraction from LUT columns (payoutMultiplier, weight)."""
    total_w = sum(weights)
    if total_w == 0:
        raise ValueError("empty weights")
    # payoutMultiplier is 100 × win; bet cost = 1
    numer = sum(int(p) * int(w) for p, w in zip(payouts, weights))
    return Fraction(numer, 100 * total_w)


def weighted_hit_fraction(payouts: Sequence[int], weights: Sequence[int]) -> Fraction:
    total_w = sum(weights)
    hit_w = sum(int(w) for p, w in zip(payouts, weights) if int(p) > 0)
    return Fraction(hit_w, total_w)


def weighted_maxwin_fraction(payouts: Sequence[int], weights: Sequence[int], max_payout: int) -> Fraction:
    total_w = sum(weights)
    max_w = sum(int(w) for p, w in zip(payouts, weights) if int(p) == max_payout)
    return Fraction(max_w, total_w)


def write_weighted_lut(path: str, ids: Iterable[int], weights: Sequence[int], payouts: Sequence[int]) -> None:
    with open(path, "w", encoding="UTF-8") as f:
        for i, w, p in zip(ids, weights, payouts):
            f.write(f"{int(i)},{int(w)},{int(p)}\n")


def read_lut(path: str) -> tuple[list[int], list[int], list[int]]:
    ids, weights, payouts = [], [], []
    with open(path, encoding="UTF-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            i, w, p = line.split(",")
            ids.append(int(i))
            weights.append(int(w))
            payouts.append(int(p))
    return ids, weights, payouts
