"""Exact hold EV via inclusion-exclusion on precomputed contain-sums."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from itertools import combinations
from math import comb, lcm
from multiprocessing import get_context
from typing import Sequence

import numpy as np

from .combinadic import colex_index
from .constants import (
    HAND_SIZE,
    N_CARDS,
    N_DEALS,
    N_HOLD_MASKS,
    PAYTABLE_7_5,
    Category,
)
from .evaluator import evaluate_category

# C(47, n_draw) indexed by n_held = 0..5  (n_draw = 5 - n_held)
WAYS_BY_HELD = tuple(comb(47, 5 - h) for h in range(6))
WAYS_LCM = lcm(*WAYS_BY_HELD)


def _popcount(x: int) -> int:
    return x.bit_count()


def _split_hold(deal: Sequence[int], mask: int) -> tuple[list[int], list[int]]:
    held: list[int] = []
    discarded: list[int] = []
    for i in range(HAND_SIZE):
        if mask & (1 << i):
            held.append(int(deal[i]))
        else:
            discarded.append(int(deal[i]))
    return held, discarded


def hold_stats_ie(
    deal: Sequence[int],
    mask: int,
    binom: np.ndarray,
    contain_pay: list[np.ndarray],
    contain_royal: list[np.ndarray],
    contain_win: list[np.ndarray],
    contain_cat: list[list[np.ndarray]] | None = None,
) -> tuple[int, int, int, int, list[int] | None]:
    """Return (pay_sum, royal_sum, win_sum, n_ways, cat_counts_or_None).

    pay_sum / n_ways is the exact EV of this hold.
    Inclusion-exclusion: sum_{T ⊆ discarded} (-1)^|T| contain[held ∪ T].
    """
    held, discarded = _split_hold(deal, mask)
    n_held = len(held)
    n_disc = len(discarded)
    n_ways = WAYS_BY_HELD[n_held]

    pay_sum = 0
    royal_sum = 0
    win_sum = 0
    cat_counts = [0] * 10 if contain_cat is not None else None

    n_t = 1 << n_disc
    buf = [0] * 5
    for t_mask in range(n_t):
        k = n_held
        for i in range(n_held):
            buf[i] = held[i]
        for i in range(n_disc):
            if t_mask & (1 << i):
                buf[k] = discarded[i]
                k += 1
        if k > 5:
            continue
        # held and discarded are sorted (subsequences of a sorted deal);
        # the union of two sorted lists selected this way is not merged.
        subset = buf[:k]
        subset.sort()
        idx = colex_index(subset, k, binom) if k else 0
        sign = -1 if _popcount(t_mask) & 1 else 1
        pay_sum += sign * int(contain_pay[k][idx])
        royal_sum += sign * int(contain_royal[k][idx])
        win_sum += sign * int(contain_win[k][idx])
        if cat_counts is not None:
            for cat in range(10):
                cat_counts[cat] += sign * int(contain_cat[cat][k][idx])

    return pay_sum, royal_sum, win_sum, n_ways, cat_counts


def hold_stats_brute(
    deal: Sequence[int],
    mask: int,
    paytable: dict[Category, int] | None = None,
) -> tuple[int, int, int, int, list[int]]:
    """Enumerate remaining draws. Source of truth for unit tests."""
    if paytable is None:
        paytable = PAYTABLE_7_5
    held, _discarded = _split_hold(deal, mask)
    n_held = len(held)
    n_draw = 5 - n_held
    deal_set = set(deal)
    remaining = [c for c in range(N_CARDS) if c not in deal_set]
    cat_counts = [0] * 10
    pay_sum = 0
    royal_sum = 0
    win_sum = 0

    if n_draw == 0:
        cat = int(evaluate_category(held))
        p = int(paytable[Category(cat)])
        cat_counts[cat] = 1
        return p, int(cat == int(Category.ROYAL_FLUSH)), int(p > 0), 1, cat_counts

    for draw in combinations(remaining, n_draw):
        hand = held + list(draw)
        cat = int(evaluate_category(hand))
        p = int(paytable[Category(cat)])
        pay_sum += p
        if cat == int(Category.ROYAL_FLUSH):
            royal_sum += 1
        if p > 0:
            win_sum += 1
        cat_counts[cat] += 1

    n_ways = WAYS_BY_HELD[n_held]
    return pay_sum, royal_sum, win_sum, n_ways, cat_counts


def best_hold(
    deal: Sequence[int],
    binom: np.ndarray,
    contain_pay,
    contain_royal,
    contain_win,
    contain_cat=None,
) -> tuple[int, int, int, int, int, list[int] | None]:
    """Pick the max-EV hold. Ties: more cards held, then smaller mask.

    Category counts are computed only for the winning hold.
    Returns (mask, pay_sum, royal_sum, win_sum, n_ways, cat_counts).
    """
    best = None
    for mask in range(N_HOLD_MASKS):
        pay_sum, royal_sum, win_sum, n_ways, _ = hold_stats_ie(
            deal, mask, binom, contain_pay, contain_royal, contain_win, None
        )
        ev_num = pay_sum * (WAYS_LCM // n_ways)
        n_held = _popcount(mask)
        key = (ev_num, n_held, -mask)
        if best is None or key > best[0]:
            best = (key, mask, pay_sum, royal_sum, win_sum, n_ways)
    _, mask, pay_sum, royal_sum, win_sum, n_ways = best
    cat_counts = None
    if contain_cat is not None:
        _, _, _, _, cat_counts = hold_stats_ie(
            deal, mask, binom, contain_pay, contain_royal, contain_win, contain_cat
        )
    return mask, pay_sum, royal_sum, win_sum, n_ways, cat_counts


_WORKER: dict = {}


def _enum_chunk(start_end: tuple[int, int]):
    start, end = start_end
    binom = _WORKER["binom"]
    contain_pay = _WORKER["contain_pay"]
    contain_royal = _WORKER["contain_royal"]
    contain_win = _WORKER["contain_win"]
    contain_cat = _WORKER["contain_cat"]
    combos = _WORKER["combos"]
    pay_arr = _WORKER["pay_arr"]
    denom_one = _WORKER["denom_one"]
    store_strategy = _WORKER["store_strategy"]

    rtp_numer = 0
    hit_numer = 0
    royal_numer = 0
    cat_numer = [0] * 10
    cat_pay_numer = [0] * 10
    hold_size_counts = [0] * 6
    strat_idx = []
    strat_mask = []

    for i in range(start, end):
        cards = combos[i]
        mask, pay_sum, royal_sum, win_sum, n_ways, cat_counts = best_hold(
            cards, binom, contain_pay, contain_royal, contain_win, contain_cat
        )
        weight = denom_one // n_ways
        rtp_numer += pay_sum * weight
        hit_numer += win_sum * weight
        royal_numer += royal_sum * weight
        for cat in range(10):
            c = cat_counts[cat]
            cat_numer[cat] += c * weight
            cat_pay_numer[cat] += c * pay_arr[cat] * weight
        hold_size_counts[_popcount(mask)] += 1
        if store_strategy:
            strat_idx.append(colex_index(cards, HAND_SIZE, binom))
            strat_mask.append(mask)
    return (
        rtp_numer,
        hit_numer,
        royal_numer,
        cat_numer,
        cat_pay_numer,
        hold_size_counts,
        strat_idx,
        strat_mask,
    )


@dataclass
class EnumerationResult:
    n_deals: int
    paytable: dict
    # Exact: rtp = rtp_numer / rtp_denom
    rtp_numer: int
    rtp_denom: int
    hit_numer: int
    royal_numer: int
    cat_numer: list[int] = field(default_factory=lambda: [0] * 10)
    cat_pay_numer: list[int] = field(default_factory=lambda: [0] * 10)
    hold_size_counts: list[int] = field(default_factory=lambda: [0] * 6)
    strategy: np.ndarray | None = None  # uint8 hold mask per colex deal index

    @property
    def rtp(self) -> float:
        return self.rtp_numer / self.rtp_denom

    @property
    def hit_rate(self) -> float:
        return self.hit_numer / self.rtp_denom

    @property
    def royal_rate(self) -> float:
        return self.royal_numer / self.rtp_denom

    def category_rate(self, cat: int) -> float:
        return self.cat_numer[cat] / self.rtp_denom

    def category_rtp(self, cat: int) -> float:
        return self.cat_pay_numer[cat] / self.rtp_denom


def enumerate_optimal(
    binom: np.ndarray,
    contain_pay,
    contain_royal,
    contain_win,
    contain_cat,
    paytable: dict | None = None,
    store_strategy: bool = True,
    progress_every: int = 100_000,
    combos: np.ndarray | None = None,
    n_workers: int | None = None,
) -> EnumerationResult:
    """Exact combinatorial pass over all C(52,5) deals under optimal holds."""
    if paytable is None:
        paytable = PAYTABLE_7_5
    pay_arr = [paytable[Category(i)] for i in range(10)]
    denom_one = WAYS_LCM
    if combos is None:
        from .contain_sums import all_five_card_combos

        combos = all_five_card_combos()
    if combos.shape[0] != N_DEALS:
        raise RuntimeError(f"combos length {combos.shape[0]} != {N_DEALS}")

    n_workers = os.cpu_count() or 1 if n_workers is None else n_workers
    n_workers = max(1, min(int(n_workers), N_DEALS))
    strategy = np.zeros(N_DEALS, dtype=np.uint8) if store_strategy else None

    if n_workers == 1:
        rtp_numer = 0
        hit_numer = 0
        royal_numer = 0
        cat_numer = [0] * 10
        cat_pay_numer = [0] * 10
        hold_size_counts = [0] * 6
        for deal_i in range(N_DEALS):
            cards = combos[deal_i]
            mask, pay_sum, royal_sum, win_sum, n_ways, cat_counts = best_hold(
                cards, binom, contain_pay, contain_royal, contain_win, contain_cat
            )
            weight = denom_one // n_ways
            rtp_numer += pay_sum * weight
            hit_numer += win_sum * weight
            royal_numer += royal_sum * weight
            for cat in range(10):
                c = cat_counts[cat]
                cat_numer[cat] += c * weight
                cat_pay_numer[cat] += c * pay_arr[cat] * weight
            hold_size_counts[_popcount(mask)] += 1
            if strategy is not None:
                strategy[colex_index(cards, HAND_SIZE, binom)] = mask
            if progress_every and (deal_i + 1) % progress_every == 0:
                print(f"  enumerated {deal_i + 1:,} / {N_DEALS:,} deals", flush=True)
    else:
        print(f"  using {n_workers} processes", flush=True)
        _WORKER["binom"] = binom
        _WORKER["contain_pay"] = contain_pay
        _WORKER["contain_royal"] = contain_royal
        _WORKER["contain_win"] = contain_win
        _WORKER["contain_cat"] = contain_cat
        _WORKER["combos"] = combos
        _WORKER["pay_arr"] = pay_arr
        _WORKER["denom_one"] = denom_one
        _WORKER["store_strategy"] = store_strategy
        chunk = (N_DEALS + n_workers - 1) // n_workers
        ranges = []
        for w in range(n_workers):
            start = w * chunk
            end = min(N_DEALS, start + chunk)
            if start < end:
                ranges.append((start, end))
        ctx = get_context("fork")
        with ctx.Pool(len(ranges)) as pool:
            parts = pool.map(_enum_chunk, ranges)
        rtp_numer = 0
        hit_numer = 0
        royal_numer = 0
        cat_numer = [0] * 10
        cat_pay_numer = [0] * 10
        hold_size_counts = [0] * 6
        for part in parts:
            rtp_numer += part[0]
            hit_numer += part[1]
            royal_numer += part[2]
            for cat in range(10):
                cat_numer[cat] += part[3][cat]
                cat_pay_numer[cat] += part[4][cat]
            for h in range(6):
                hold_size_counts[h] += part[5][h]
            if strategy is not None:
                for idx, mask in zip(part[6], part[7]):
                    strategy[idx] = mask

    return EnumerationResult(
        n_deals=N_DEALS,
        paytable=dict(paytable),
        rtp_numer=rtp_numer,
        rtp_denom=N_DEALS * WAYS_LCM,
        hit_numer=hit_numer,
        royal_numer=royal_numer,
        cat_numer=cat_numer,
        cat_pay_numer=cat_pay_numer,
        hold_size_counts=hold_size_counts,
        strategy=strategy,
    )
