"""7/5 Jacks-or-Better paytable and card encoding.

Card encoding: card = suit * 13 + rank
  rank 0..12 = 2,3,4,5,6,7,8,9,T,J,Q,K,A
  suit 0..3  = C, D, H, S
"""

from enum import IntEnum

N_CARDS = 52
N_RANKS = 13
N_SUITS = 4
HAND_SIZE = 5
N_DEALS = 2_598_960  # C(52, 5)
N_HOLD_MASKS = 32

RANK_CHARS = "23456789TJQKA"
SUIT_CHARS = "CDHS"

# Jacks or better: pair ranks J,Q,K,A
HIGH_PAIR_RANK = 9  # Jack


class Category(IntEnum):
    NOTHING = 0
    JACKS_OR_BETTER = 1
    TWO_PAIR = 2
    THREE_OF_A_KIND = 3
    STRAIGHT = 4
    FLUSH = 5
    FULL_HOUSE = 6
    FOUR_OF_A_KIND = 7
    STRAIGHT_FLUSH = 8
    ROYAL_FLUSH = 9


CATEGORY_NAMES = {
    Category.NOTHING: "Nothing",
    Category.JACKS_OR_BETTER: "Jacks or Better",
    Category.TWO_PAIR: "Two Pair",
    Category.THREE_OF_A_KIND: "Three of a Kind",
    Category.STRAIGHT: "Straight",
    Category.FLUSH: "Flush",
    Category.FULL_HOUSE: "Full House",
    Category.FOUR_OF_A_KIND: "Four of a Kind",
    Category.STRAIGHT_FLUSH: "Straight Flush",
    Category.ROYAL_FLUSH: "Royal Flush",
}

# 7/5 Jacks or Better (Full House 7, Flush 5). Multipliers of 1x bet.
PAYTABLE_7_5 = {
    Category.ROYAL_FLUSH: 800,
    Category.STRAIGHT_FLUSH: 50,
    Category.FOUR_OF_A_KIND: 25,
    Category.FULL_HOUSE: 7,
    Category.FLUSH: 5,
    Category.STRAIGHT: 4,
    Category.THREE_OF_A_KIND: 3,
    Category.TWO_PAIR: 2,
    Category.JACKS_OR_BETTER: 1,
    Category.NOTHING: 0,
}

# Mandatory even-money red/black from a fresh 52-card deck.
DOUBLE_UP_P_WIN = (26, 52)  # exactly 1/2
DOUBLE_UP_MAX_CHAIN = 2
DOUBLE_UP_PAYOUT = 2  # even money on a correct colour
