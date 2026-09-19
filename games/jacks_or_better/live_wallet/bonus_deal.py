"""Live-hold bonus-buy dealing: JoB+ and Flush+ conditional distributions."""

from __future__ import annotations

import random
from typing import Literal

import numpy as np

from poker.constants import N_DEALS, PAYTABLE_7_5, Category
from poker.contain_sums import all_five_card_combos, evaluate_all
from poker.evaluator import evaluate_category, payout

BonusKind = Literal["job", "flush"]

_BONUS_TABLES: dict | None = None


def _load_tables() -> dict:
    global _BONUS_TABLES
    if _BONUS_TABLES is not None:
        return _BONUS_TABLES
    combos = all_five_card_combos()
    cats = evaluate_all(combos).astype(np.int16)
    pays = np.array([PAYTABLE_7_5[Category(int(c))] for c in cats], dtype=np.float64)

    job_mask = cats >= int(Category.JACKS_OR_BETTER)
    flush_mask = cats >= int(Category.FLUSH)

    job_idx = np.flatnonzero(job_mask)
    flush_idx = np.flatnonzero(flush_mask)

    job_counts = np.bincount(cats[job_mask], minlength=10)
    flush_counts = np.bincount(cats[flush_mask], minlength=10)

    _BONUS_TABLES = {
        "combos": combos,
        "cats": cats,
        "pays": pays,
        "job_idx": job_idx,
        "flush_idx": flush_idx,
        "job_count": int(job_idx.size),
        "flush_count": int(flush_idx.size),
        "job_freq": job_idx.size / N_DEALS,
        "flush_freq": flush_idx.size / N_DEALS,
        "job_ev": float(pays[job_mask].sum() / job_idx.size),
        "flush_ev": float(pays[flush_mask].sum() / flush_idx.size),
        "job_counts_by_cat": job_counts,
        "flush_counts_by_cat": flush_counts,
    }
    return _BONUS_TABLES


def bonus_combinatorial_stats() -> dict:
    """Exact frequencies and conditional EV from full C(52,5) enumeration."""
    t = _load_tables()
    job_ev = t["job_ev"]
    flush_ev = t["flush_ev"]
    return {
        "job_qualify_rate": t["job_freq"],
        "flush_qualify_rate": t["flush_freq"],
        "job_qualifying_hands": t["job_count"],
        "flush_qualifying_hands": t["flush_count"],
        "job_conditional_ev": job_ev,
        "flush_conditional_ev": flush_ev,
        "bonus1_price_mult": 2,
        "bonus2_price_mult": 10,
        "bonus1_rtp_at_price": job_ev / 2,
        "bonus2_rtp_at_price": flush_ev / 10,
        "job_rejection_expected_attempts": 1 / t["job_freq"],
    }


def sample_job_or_better_rejection(rng: random.Random) -> tuple[int, ...]:
    """Uniform over qualifying JoB+ hands via rejection (~20.6% hit rate)."""
    t = _load_tables()
    combos = t["combos"]
    cats = t["cats"]
    while True:
        i = rng.randrange(N_DEALS)
        if cats[i] >= int(Category.JACKS_OR_BETTER):
            return tuple(int(c) for c in combos[i])


def sample_flush_or_better_direct(rng: random.Random) -> tuple[int, ...]:
    """Uniform over qualifying Flush+ hands via precomputed index table."""
    t = _load_tables()
    idx = t["flush_idx"]
    pick = int(idx[rng.randrange(idx.size)])
    return tuple(int(c) for c in t["combos"][pick])


def sample_bonus_hand(kind: BonusKind, rng: random.Random) -> tuple[int, ...]:
    if kind == "job":
        return sample_job_or_better_rejection(rng)
    return sample_flush_or_better_direct(rng)


def evaluate_bonus_hand(hand: tuple[int, ...]) -> dict:
    cat_id = int(evaluate_category(hand))
    poker_win = float(payout(hand))
    from poker.constants import CATEGORY_NAMES

    return {
        "finalHand": hand,
        "categoryId": cat_id,
        "category": CATEGORY_NAMES[cat_id],
        "pokerWin": poker_win,
    }


def simulate_bonus(kind: BonusKind, n: int, seed: int = 0) -> dict:
    """Monte Carlo: sample hands, assume instant collect (no double-up chain)."""
    rng = random.Random(seed)
    price_mult = 2 if kind == "job" else 10
    total_payout_mult = 0.0
    cat_hist: dict[str, int] = {}
    for _ in range(n):
        hand = sample_bonus_hand(kind, rng)
        ev = evaluate_bonus_hand(hand)
        total_payout_mult += ev["pokerWin"]
        cat_hist[ev["category"]] = cat_hist.get(ev["category"], 0) + 1
    avg_payout = total_payout_mult / n
    rtp = avg_payout / price_mult
    return {
        "kind": kind,
        "trials": n,
        "avg_payout_mult": avg_payout,
        "realized_rtp": rtp,
        "category_histogram": cat_hist,
    }
