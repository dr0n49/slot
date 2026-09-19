"""Unit tests for 5-card Jacks-or-Better evaluation."""

from itertools import combinations

import numpy as np

from poker.constants import Category, PAYTABLE_7_5
from poker.evaluator import evaluate_category, parse_hand, payout


def cat(text: str) -> Category:
    return evaluate_category(parse_hand(text))


def test_royal_flush():
    assert cat("AH KH QH JH TH") == Category.ROYAL_FLUSH
    assert payout(parse_hand("AS KS QS JS TS")) == 800


def test_straight_flush_and_wheel_sf():
    assert cat("9H 8H 7H 6H 5H") == Category.STRAIGHT_FLUSH
    assert cat("AH 2H 3H 4H 5H") == Category.STRAIGHT_FLUSH
    assert payout(parse_hand("9C 8C 7C 6C 5C")) == 50


def test_four_of_a_kind():
    assert cat("AC AD AH AS KH") == Category.FOUR_OF_A_KIND
    assert payout(parse_hand("AC AD AH AS KH")) == 25


def test_full_house():
    assert cat("AC AD AH KC KD") == Category.FULL_HOUSE
    assert payout(parse_hand("AC AD AH KC KD")) == 7


def test_flush_not_straight():
    assert cat("AH 9H 7H 3H 2H") == Category.FLUSH
    assert payout(parse_hand("AH 9H 7H 3H 2H")) == 5


def test_straight_and_wheel():
    assert cat("AH KS QC JD TH") == Category.STRAIGHT
    assert cat("AH 2C 3D 4S 5H") == Category.STRAIGHT
    assert payout(parse_hand("9C 8D 7S 6H 5C")) == 4


def test_trips_two_pair_job_and_nothing():
    assert cat("AC AD AH 9C 7D") == Category.THREE_OF_A_KIND
    assert cat("AC AD 9C 9D 7H") == Category.TWO_PAIR
    assert cat("JC JD 9C 8D 7H") == Category.JACKS_OR_BETTER
    assert cat("TC TD 9C 8D 7H") == Category.NOTHING  # tens are not JoB
    assert cat("2C 2D 9C 8D 7H") == Category.NOTHING
    assert cat("AH KC QD 9S 7H") == Category.NOTHING
    assert payout(parse_hand("JC JD 2C 3D 4H")) == 1
    assert payout(parse_hand("TC TD 2C 3D 4H")) == 0


def test_paytable_cells():
    assert PAYTABLE_7_5[Category.FULL_HOUSE] == 7
    assert PAYTABLE_7_5[Category.FLUSH] == 5
    assert PAYTABLE_7_5[Category.ROYAL_FLUSH] == 800


def test_vectorized_eval_matches_scalar_sample():
    from poker.contain_sums import evaluate_all

    sample = []
    for i, cards in enumerate(combinations(range(52), 5)):
        if i % 791 == 0:
            sample.append(cards)
        if len(sample) >= 400:
            break
    # Force a few known shapes into the sample.
    sample.extend(
        [
            parse_hand("AH KH QH JH TH"),
            parse_hand("AH 2H 3H 4H 5H"),
            parse_hand("AC AD AH AS KH"),
            parse_hand("JC JD 9C 8D 7H"),
            parse_hand("TC TD 9C 8D 7H"),
        ]
    )
    arr = np.array(sample, dtype=np.uint8)
    vec = evaluate_all(arr)
    for row, pred in zip(arr, vec):
        assert int(evaluate_category(row)) == int(pred)
