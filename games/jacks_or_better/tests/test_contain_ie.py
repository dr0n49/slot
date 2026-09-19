"""Compare inclusion-exclusion hold stats to brute-force enumeration."""

import pytest

from poker.contain_sums import build_contain_sums
from poker.solver import hold_stats_brute, hold_stats_ie


def _ie_vs_brute(deal, mask, tables) -> None:
    binom, pay, royal, win, cat_tables = tables[:5]
    ie = hold_stats_ie(deal, mask, binom, pay, royal, win, cat_tables)
    brute = hold_stats_brute(deal, mask)
    assert ie[0] == brute[0], (deal, mask, "pay", ie[0], brute[0])
    assert ie[1] == brute[1], (deal, mask, "royal", ie[1], brute[1])
    assert ie[2] == brute[2], (deal, mask, "win", ie[2], brute[2])
    assert ie[3] == brute[3]
    assert ie[4] == brute[4]


@pytest.mark.slow
def test_ie_matches_brute_on_sample_hands():
    """Rebuild contain-sums (slow-ish) and check several hold sizes.

    Hold-0/1 are expensive to brute-force; those are checked for a single deal.
    """
    tables = build_contain_sums()
    deals = [
        (0, 1, 2, 3, 4),
        (0, 13, 26, 39, 12),  # four 2s + ace
        (8, 9, 10, 11, 12),  # T-A mixed suits (likely not flush)
        (47, 48, 49, 50, 51),
    ]
    cheap_masks = [m for m in range(32) if m.bit_count() >= 3]
    for deal in deals:
        for mask in cheap_masks:
            _ie_vs_brute(deal, mask, tables)

    # One full 32-mask check including discard-all / hold-one.
    full_deal = (1, 5, 10, 20, 40)
    for mask in range(32):
        _ie_vs_brute(full_deal, mask, tables)
