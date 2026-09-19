"""Mandatory even-money red/black double-up on a fresh 52-card deck.

After every paying poker hand the book always enters double-or-nothing.
A correct colour (26/52) doubles the current win; a miss pays 0.
Successes chain until the first miss or DOUBLE_UP_MAX_CHAIN successes (n=2:
survive both → 4×, else 0).

Because the coin is fair, E[final | poker win W] = W, so overall RTP is
identical to the base-game RTP. Hit rate is base_hit / 4 when n=2.
"""

from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction

from .constants import DOUBLE_UP_MAX_CHAIN, PAYTABLE_7_5, Category
from .solver import EnumerationResult


@dataclass(frozen=True)
class DoubleUpModel:
    p_win: Fraction
    max_chain: int
    payout_on_win: int

    @property
    def p_survive_full_chain(self) -> Fraction:
        return self.p_win**self.max_chain

    @property
    def max_win_multiplier(self) -> int:
        royal = PAYTABLE_7_5[Category.ROYAL_FLUSH]
        return royal * (self.payout_on_win**self.max_chain)

    def ev_multiplier(self) -> Fraction:
        """E[final / W] given W>0 and mandatory chain-until-loss-or-cap.

        Lose at any step → 0. Survive all `max_chain` doubles → W * 2^max_chain.
        E = (2^n) * (1/2)^n * W = W.
        """
        return (self.payout_on_win**self.max_chain) * self.p_survive_full_chain


DEFAULT_DOUBLE_UP = DoubleUpModel(
    p_win=Fraction(26, 52),
    max_chain=DOUBLE_UP_MAX_CHAIN,
    payout_on_win=2,
)


@dataclass
class CombinedResult:
    base: EnumerationResult
    model: DoubleUpModel
    rtp_numer: int
    rtp_denom: int
    hit_numer: int
    royal_made_numer: int  # made a royal on the poker hand (before double-up)
    max_win_numer: int  # collected the capped 4× royal (800 × 4 = 3200×)

    @property
    def rtp(self) -> float:
        return self.rtp_numer / self.rtp_denom

    @property
    def hit_rate(self) -> float:
        return self.hit_numer / self.rtp_denom

    @property
    def royal_made_rate(self) -> float:
        return self.royal_made_numer / self.rtp_denom

    @property
    def max_win_rate(self) -> float:
        return self.max_win_numer / self.rtp_denom

    @property
    def max_win_multiplier(self) -> int:
        return self.model.max_win_multiplier


def combine_with_double_up(
    base: EnumerationResult,
    model: DoubleUpModel = DEFAULT_DOUBLE_UP,
) -> CombinedResult:
    """Map base-game exact counts through the mandatory double-up chain.

    RTP numer/denom copied from base (EV identity). Hit/max-win counts are
    multiplied by the exact survival probability (1/2)^max_chain, represented
    by scaling the shared denominator.
    """
    ev = model.ev_multiplier()
    if ev != 1:
        raise AssertionError(f"double-up EV identity failed: E[final/W]={ev} != 1")

    survive = model.p_survive_full_chain  # (1/2)^n
    # Scale denom by survive.denominator so hit_numer stays integer.
    extra = survive.denominator
    return CombinedResult(
        base=base,
        model=model,
        rtp_numer=base.rtp_numer * extra,
        rtp_denom=base.rtp_denom * extra,
        hit_numer=base.hit_numer * survive.numerator * (extra // survive.denominator),
        royal_made_numer=base.royal_numer * extra,
        max_win_numer=base.royal_numer * survive.numerator * (extra // survive.denominator),
    )
