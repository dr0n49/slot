"""Strategy and brute-force EV tests that do not need contain-sum tables."""

from itertools import combinations

from poker.constants import Category, N_HOLD_MASKS, PAYTABLE_7_5
from poker.evaluator import evaluate_category, parse_hand, payout
from poker.solver import WAYS_BY_HELD, hold_stats_brute


def _mask_holding(deal, held_cards) -> int:
    held = set(held_cards)
    mask = 0
    for i, c in enumerate(deal):
        if c in held:
            mask |= 1 << i
    return mask


def test_dealt_royal_hold_all():
    deal = parse_hand("AH KH QH JH TH")
    mask_all = 0b11111
    pay_sum, royal_sum, win_sum, n_ways, cats = hold_stats_brute(deal, mask_all)
    assert n_ways == 1
    assert pay_sum == 800
    assert royal_sum == 1
    assert win_sum == 1
    assert cats[int(Category.ROYAL_FLUSH)] == 1

    # Discarding any one royal card cannot be better than 800.
    for i in range(5):
        mask = mask_all ^ (1 << i)
        p, *_ = hold_stats_brute(deal, mask)
        ev = p / WAYS_BY_HELD[4]
        assert ev < 800


def test_two_pair_drawing_beats_standing():
    deal = parse_hand("AC AD 9C 9D KH")
    four = _mask_holding(deal, (deal[0], deal[1], deal[2], deal[3]))
    mask_all = 0b11111
    p_draw, _, _, w_draw, _ = hold_stats_brute(deal, four)
    p_stand, _, _, w_stand, _ = hold_stats_brute(deal, mask_all)
    assert p_stand / w_stand == 2
    assert p_draw / w_draw > 2  # one-card draw can make a full house


def test_jacks_pair_beats_discarding_the_pair():
    deal = parse_hand("JC JD 9C 8D 7H")
    pair = _mask_holding(deal, (deal[0], deal[1]))
    p_pair, _, win_pair, w_pair, cats = hold_stats_brute(deal, pair)
    assert cats[int(Category.JACKS_OR_BETTER)] > 0
    assert p_pair / w_pair >= 1.0  # already a paying pair; draws can only help
    # Discard-all should be worse than holding the high pair.
    p_none, _, _, w_none, _ = hold_stats_brute(deal, 0)
    assert p_pair / w_pair > p_none / w_none


def test_tens_are_not_a_paying_pair():
    deal = parse_hand("TC TD 9C 8D 7H")
    pair = _mask_holding(deal, (deal[0], deal[1]))
    p_pair, _, win_pair, w_pair, cats = hold_stats_brute(deal, pair)
    # Holding tens: current hand pays 0; some draws make trips/two pair/etc.
    assert cats[int(Category.JACKS_OR_BETTER)] == 0  # tens stay tens unless improved
    assert p_pair / w_pair < 2.0  # low pair EV is well below high-pair EV


def test_brute_ways_match_binomial():
    deal = parse_hand("AH 9C 7D 3S 2C")
    for mask in (0b11111, 0b01111, 0b00111, 0b00011, 0b00001, 0b00000):
        n_held = mask.bit_count()
        _, _, _, n_ways, _ = hold_stats_brute(deal, mask)
        assert n_ways == WAYS_BY_HELD[n_held]


def test_all_32_masks_on_representative_hand_hold4_and_hold5():
    """All 32 holds are valid; fully enumerate cheap holds (k>=4)."""
    deal = parse_hand("AH KH QD JC 9S")
    evs = []
    for mask in range(N_HOLD_MASKS):
        n_held = mask.bit_count()
        if n_held < 4:
            continue
        pay_sum, _, _, n_ways, _ = hold_stats_brute(deal, mask)
        evs.append((mask, pay_sum / n_ways))
    assert len(evs) == 1 + 5  # hold 5 + five hold-4
    hold_all_ev = [e for m, e in evs if m == 0b11111][0]
    assert hold_all_ev == 0  # AKQJ9 offsuit is nothing
