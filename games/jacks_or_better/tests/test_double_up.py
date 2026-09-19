from fractions import Fraction

from poker.constants import DOUBLE_UP_MAX_CHAIN, PAYTABLE_7_5, Category
from poker.double_up import DEFAULT_DOUBLE_UP, DoubleUpModel, combine_with_double_up
from poker.solver import EnumerationResult


def test_fair_coin_and_cap():
    assert DEFAULT_DOUBLE_UP.p_win == Fraction(1, 2)
    assert DEFAULT_DOUBLE_UP.max_chain == DOUBLE_UP_MAX_CHAIN == 2
    assert DEFAULT_DOUBLE_UP.payout_on_win == 2


def test_ev_identity_is_exactly_one():
    assert DEFAULT_DOUBLE_UP.ev_multiplier() == 1
    assert DEFAULT_DOUBLE_UP.p_survive_full_chain == Fraction(1, 4)


def test_max_win_is_royal_times_4():
    assert DEFAULT_DOUBLE_UP.max_win_multiplier == 800 * 4 == 3_200


def test_combined_rtp_matches_base_and_hit_rate_scales():
    # Tiny synthetic base: 2 equally likely deals, EVs 1 and 0 → RTP 0.5, hit 0.5,
    # royal rate 0.25 so we can see scaling.
    base = EnumerationResult(
        n_deals=2,
        paytable=dict(PAYTABLE_7_5),
        rtp_numer=1,
        rtp_denom=2,
        hit_numer=1,
        royal_numer=1,  # 0.5 royal rate in this toy model
    )
    combined = combine_with_double_up(base)
    assert combined.rtp == base.rtp == 0.5
    assert combined.hit_rate == base.hit_rate / 4
    assert combined.royal_made_rate == base.royal_rate
    assert combined.max_win_rate == base.royal_rate / 4
    assert combined.max_win_multiplier == 3_200


def test_unfair_coin_would_fail_identity():
    biased = DoubleUpModel(p_win=Fraction(25, 52), max_chain=2, payout_on_win=2)
    assert biased.ev_multiplier() != 1
