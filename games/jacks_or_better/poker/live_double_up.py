"""Live-hold double-up helpers (NOT used by frozen books / mandatory n=2 chain).

Flush-or-better eligibility, fair red/black resolution on a fresh 52-card draw.
"""

from __future__ import annotations

import random

from .constants import DOUBLE_UP_MAX_CHAIN, Category, N_CARDS
from .evaluator import card_str, card_suit

LIVE_DOUBLE_UP_MAX_CHAIN = DOUBLE_UP_MAX_CHAIN  # keep n=2 cap (3,200× on royal)


def is_double_up_eligible(category: int) -> bool:
    """Offer double-up only for Flush or better."""
    return int(category) >= int(Category.FLUSH)


def card_colour(card: int) -> str:
    return "red" if card_suit(card) in (1, 2) else "black"


def resolve_colour_pick(rng: random.Random, choice: str) -> tuple[int, str, bool]:
    """Draw one card after the player's colour choice. choice is 'red' or 'black'."""
    if choice not in ("red", "black"):
        raise ValueError(f"invalid double-up choice: {choice!r}")
    card = rng.randint(0, N_CARDS - 1)
    colour = card_colour(card)
    return card, colour, choice == colour
