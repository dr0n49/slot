from fractions import Fraction

from poker.constants import Category, PAYTABLE_7_5
from poker.exact_lut import (
    SURVIVE_PAYOUT_OF_CATEGORY,
    atom_masses,
    distribute_mass,
    survive_payout_multiplier,
    weighted_hit_fraction,
    weighted_maxwin_fraction,
    weighted_rtp_fraction,
    weights_for_payouts,
)


def test_distribute_mass_sums_exactly():
    assert distribute_mass(5, 11) == [3, 2, 2, 2, 2]
    assert sum(distribute_mass(16, 496_000_000)) == 496_000_000
    assert distribute_mass(3, 0) == [0, 0, 0]


def test_survive_payout_is_4x_in_cents():
    assert survive_payout_multiplier(1) == 400
    assert survive_payout_multiplier(800) == 320_000
    assert SURVIVE_PAYOUT_OF_CATEGORY[int(Category.ROYAL_FLUSH)] == 320_000
    assert SURVIVE_PAYOUT_OF_CATEGORY[int(Category.FLUSH)] == 2_000


def test_atom_masses_n2_identity():
    # 8 equally weighted deals: 5 nothing, 2 JoB, 1 two-pair. denom=8, hit=3
    cat_numer = [5, 2, 1, 0, 0, 0, 0, 0, 0, 0]
    masses = atom_masses(cat_numer, rtp_denom=8)
    assert masses[400] == 2
    assert masses[800] == 1
    assert masses[0] == 4 * 8 - 3
    assert sum(masses.values()) == 4 * 8


def test_lut_weights_match_exact_rtp_hit_maxwin_fractions():
    # denom=20: 10 nothing, 6 JoB, 3 two-pair, 1 royal
    cat_numer = [0] * 10
    cat_numer[int(Category.NOTHING)] = 10
    cat_numer[int(Category.JACKS_OR_BETTER)] = 6
    cat_numer[int(Category.TWO_PAIR)] = 3
    cat_numer[int(Category.ROYAL_FLUSH)] = 1
    rtp_denom = 20
    poker_rtp = Fraction(
        6 * PAYTABLE_7_5[Category.JACKS_OR_BETTER]
        + 3 * PAYTABLE_7_5[Category.TWO_PAIR]
        + 1 * PAYTABLE_7_5[Category.ROYAL_FLUSH],
        rtp_denom,
    )
    # Several books per atom so remainder-split is exercised.
    payouts = (
        [400] * 5
        + [800] * 4
        + [320000] * 3
        + [0] * 11
    )
    weights = weights_for_payouts(payouts, cat_numer, rtp_denom)
    assert sum(weights) == 4 * rtp_denom
    assert sum(w for p, w in zip(payouts, weights) if p == 400) == 6
    assert sum(w for p, w in zip(payouts, weights) if p == 800) == 3
    assert sum(w for p, w in zip(payouts, weights) if p == 320000) == 1
    assert all(w >= 0 for w in weights)

    rtp = weighted_rtp_fraction(payouts, weights)
    hit = weighted_hit_fraction(payouts, weights)
    mx = weighted_maxwin_fraction(payouts, weights, 320000)
    assert rtp == poker_rtp
    assert hit == Fraction(6 + 3 + 1, 4 * rtp_denom)
    assert mx == Fraction(1, 4 * rtp_denom)
