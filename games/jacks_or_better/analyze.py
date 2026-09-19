#!/usr/bin/env python3
"""Exact 7/5 Jacks-or-Better combinatorial analysis.

Computes optimal-strategy RTP, hit-rate, and Royal frequency for the base
hand and for the mandatory 2-chain red/black double-up. Does not generate
RGS books.

Usage (from repo root):
    .venv/bin/python games/jacks_or_better/analyze.py
"""

from __future__ import annotations

import json
import sys
import time
from fractions import Fraction
from pathlib import Path

GAME_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(GAME_DIR))

from poker.constants import (  # noqa: E402
    CATEGORY_NAMES,
    DOUBLE_UP_MAX_CHAIN,
    N_DEALS,
    PAYTABLE_7_5,
    Category,
)
from poker.contain_sums import build_contain_sums  # noqa: E402
from poker.double_up import combine_with_double_up  # noqa: E402
from poker.solver import (  # noqa: E402
    WAYS_BY_HELD,
    enumerate_optimal,
    hold_stats_brute,
    hold_stats_ie,
)


ANALYSIS_DIR = GAME_DIR / "analysis"


def _frac_str(numer: int, denom: int) -> str:
    f = Fraction(numer, denom)
    return f"{f.numerator} / {f.denominator}"


def _one_in(rate: float) -> str:
    if rate <= 0:
        return "never"
    return f"1 in {1.0 / rate:,.6f}"


def verify_ie_sample(tables, n_full_masks: int = 1) -> None:
    """Fail fast if inclusion-exclusion disagrees with brute-force draws."""
    binom, pay, royal, win, cat_tables = tables[:5]
    deals = [
        (0, 1, 2, 3, 4),
        (8, 9, 10, 11, 12),
        (0, 13, 26, 39, 51),
        (2, 15, 28, 40, 50),
    ]
    cheap = [m for m in range(32) if m.bit_count() >= 3]
    for deal in deals:
        for mask in cheap:
            ie = hold_stats_ie(deal, mask, binom, pay, royal, win, cat_tables)
            brute = hold_stats_brute(deal, mask)
            if ie[0] != brute[0] or ie[1] != brute[1] or ie[2] != brute[2]:
                raise AssertionError(f"IE != brute for deal={deal} mask={mask:05b}: {ie[:3]} vs {brute[:3]}")
    full_deal = (1, 6, 14, 22, 35)
    for mask in range(32):
        ie = hold_stats_ie(full_deal, mask, binom, pay, royal, win, cat_tables)
        brute = hold_stats_brute(full_deal, mask)
        if ie[0] != brute[0] or ie[1] != brute[1] or ie[2] != brute[2] or ie[4] != brute[4]:
            raise AssertionError(f"IE != brute (full) mask={mask:05b}: {ie} vs {brute}")
    print("IE vs brute-force: OK (4 deals × hold-size≥3, 1 deal × all 32 holds)")


def print_report(base, combined) -> None:
    pt = PAYTABLE_7_5
    print("\n" + "=" * 72)
    print("7/5 JACKS OR BETTER — exact combinatorial results")
    print("=" * 72)
    print(f"Deals enumerated: {N_DEALS:,}  (C(52,5))")
    print(f"Holds per deal:   32  (optimal = max EV, then more cards held, then smaller mask)")
    print()
    print("Paytable (multipliers of 1× bet)")
    print(f"{'Hand':<22} {'Pays':>8}")
    print("-" * 32)
    for cat in reversed(list(Category)):
        if cat is Category.NOTHING:
            continue
        print(f"{CATEGORY_NAMES[cat]:<22} {pt[cat]:>8}")
    print(f"{'Nothing':<22} {0:>8}")

    print("\n--- Base game (poker hand only, optimal strategy) ---")
    print(f"RTP          {_frac_str(base.rtp_numer, base.rtp_denom)}")
    print(f"             {base.rtp * 100:.10f}%")
    print(f"Hit rate     {_frac_str(base.hit_numer, base.rtp_denom)}")
    print(f"             {base.hit_rate * 100:.10f}%   ({_one_in(base.hit_rate)})")
    print(f"Royal made   {_frac_str(base.royal_numer, base.rtp_denom)}")
    print(f"             {base.royal_rate * 100:.10f}%   ({_one_in(base.royal_rate)})")

    print(f"\n{'Category':<22} {'Freq %':>14} {'1 in':>14} {'RTP %':>14}")
    print("-" * 66)
    for cat in reversed(list(Category)):
        name = CATEGORY_NAMES[cat]
        freq = base.category_rate(int(cat))
        rtp = base.category_rtp(int(cat))
        one = f"{1.0 / freq:,.4f}" if freq else "—"
        print(f"{name:<22} {freq * 100:14.8f} {one:>14} {rtp * 100:14.8f}")

    print("\n--- Double-up (Option B) ---")
    print("Model: mandatory red/black on a fresh 52-card deck after every paying hand.")
    print("       P(correct colour) = 26/52 = 1/2 exactly; even money (2×).")
    print(f"       Chain until first miss or {DOUBLE_UP_MAX_CHAIN} successes.")
    print("       Lose any step → 0. Survive both → 4× the poker win.")
    print(f"       E[final | poker win W] = 4W × 1/4 = W  (RTP identity).")
    print()
    print(f"Combined RTP        {_frac_str(combined.rtp_numer, combined.rtp_denom)}")
    print(f"                    {combined.rtp * 100:.10f}%")
    print(f"RTP drift vs base   {abs(combined.rtp - base.rtp):.3e}  (must be 0)")
    print(f"Combined hit rate   {combined.hit_rate * 100:.10f}%   ({_one_in(combined.hit_rate)})")
    print(f"Royal made (poker)  {combined.royal_made_rate * 100:.10f}%   ({_one_in(combined.royal_made_rate)})")
    print(
        f"Max win {combined.max_win_multiplier}×   "
        f"{combined.max_win_rate * 100:.10f}%   ({_one_in(combined.max_win_rate)})"
    )

    print("\n--- Stake approval checks ---")
    rtp_ok = 0.90 <= base.rtp <= 0.98
    hit_ok = base.hit_rate >= 1 / 20
    royal_ok = base.royal_rate >= 1 / 10_000_000
    combined_rtp_ok = 0.90 <= combined.rtp <= 0.98
    combined_hit_ok = combined.hit_rate >= 1 / 20
    maxwin_ok = combined.max_win_rate >= 1 / 10_000_000
    print(f"Base RTP in [90%, 98%]                 {'PASS' if rtp_ok else 'FAIL'}  ({base.rtp * 100:.6f}%)")
    print(f"Base hit rate ≥ 1 in 20                {'PASS' if hit_ok else 'FAIL'}  ({_one_in(base.hit_rate)})")
    print(f"Base Royal freq ≥ 1 in 10,000,000      {'PASS' if royal_ok else 'FAIL'}  ({_one_in(base.royal_rate)})")
    print(f"Combined RTP in [90%, 98%]             {'PASS' if combined_rtp_ok else 'FAIL'}  ({combined.rtp * 100:.6f}%)")
    print(
        f"Combined hit rate ≥ 1 in 20            "
        f"{'PASS' if combined_hit_ok else 'FAIL'}  ({_one_in(combined.hit_rate)})"
    )
    print(
        f"Max-win {combined.max_win_multiplier}× freq ≥ 1 in 10,000,000 "
        f"{'PASS' if maxwin_ok else 'FAIL'}  ({_one_in(combined.max_win_rate)})"
    )
    if not combined_hit_ok:
        print()
        print("FLAG: combined hit rate below 1-in-20 floor.")
    print("=" * 72)


def results_dict(base, combined) -> dict:
    cats = {}
    for cat in Category:
        cats[CATEGORY_NAMES[cat]] = {
            "frequency": base.category_rate(int(cat)),
            "rtp_contribution": base.category_rtp(int(cat)),
            "pays": int(PAYTABLE_7_5[cat]),
        }
    return {
        "paytable": {CATEGORY_NAMES[c]: int(PAYTABLE_7_5[c]) for c in Category if c is not Category.NOTHING},
        "n_deals": N_DEALS,
        "base": {
            "rtp": base.rtp,
            "rtp_fraction": [base.rtp_numer, base.rtp_denom],
            "hit_rate": base.hit_rate,
            "royal_rate": base.royal_rate,
            "categories": cats,
            "hold_size_counts": base.hold_size_counts,
        },
        "double_up": {
            "model": f"mandatory_red_black_fresh_deck_chain_until_loss_or_{DOUBLE_UP_MAX_CHAIN}",
            "p_win": [26, 52],
            "max_chain": DOUBLE_UP_MAX_CHAIN,
            "combined_rtp": combined.rtp,
            "combined_hit_rate": combined.hit_rate,
            "royal_made_rate": combined.royal_made_rate,
            "max_win_multiplier": combined.max_win_multiplier,
            "max_win_rate": combined.max_win_rate,
            "rtp_drift": abs(combined.rtp - base.rtp),
        },
        "ways_by_held": list(WAYS_BY_HELD),
    }


def main() -> int:
    ANALYSIS_DIR.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    print("Building contain-sum tables over all C(52,5) hands...")
    tables = build_contain_sums()
    print(f"  contain-sums ready in {time.time() - t0:.1f}s")
    print("Self-check: inclusion-exclusion vs brute-force draws...")
    verify_ie_sample(tables)
    print("Enumerating optimal holds for every deal...")
    t1 = time.time()
    binom, pay, royal, win, cat_tables, combos, _cats = tables
    base = enumerate_optimal(binom, pay, royal, win, cat_tables, combos=combos)
    print(f"  enumeration ready in {time.time() - t1:.1f}s")
    combined = combine_with_double_up(base)
    if abs(combined.rtp - base.rtp) != 0:
        raise AssertionError(f"RTP drifted: base={base.rtp} combined={combined.rtp}")
    print_report(base, combined)

    payload = results_dict(base, combined)
    results_path = ANALYSIS_DIR / "results.json"
    results_path.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"\nWrote {results_path}")
    if base.strategy is not None:
        strat_path = ANALYSIS_DIR / "strategy_7_5.npy"
        import numpy as np

        np.save(strat_path, base.strategy)
        print(f"Wrote {strat_path}  ({base.strategy.size:,} hold masks)")
    print(f"Total wall time {time.time() - t0:.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
