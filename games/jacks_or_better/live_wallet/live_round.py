"""Live-hold hold/draw completion — no mandatory double-up (frozen path unchanged)."""

from __future__ import annotations

from typing import Sequence

from poker.constants import CATEGORY_NAMES, HAND_SIZE
from poker.evaluator import evaluate_category, payout
from poker.solver import _split_hold


def complete_hold_draw(
    deal: Sequence[int],
    remaining: Sequence[int],
    hold_mask: int,
) -> dict:
    if hold_mask < 0 or hold_mask > 31:
        raise ValueError(f"hold_mask out of range: {hold_mask}")
    if len(deal) != HAND_SIZE:
        raise ValueError(f"deal must have {HAND_SIZE} cards")

    held, _disc = _split_hold(deal, hold_mask)
    n_draw = HAND_SIZE - len(held)
    if n_draw > len(remaining):
        raise ValueError("remaining deck shorter than draw count")
    drawn = tuple(int(c) for c in remaining[:n_draw])

    draw_i = 0
    final_hand_list: list[int] = []
    for i in range(HAND_SIZE):
        if hold_mask & (1 << i):
            final_hand_list.append(int(deal[i]))
        else:
            final_hand_list.append(drawn[draw_i])
            draw_i += 1
    final_hand = tuple(final_hand_list)

    cat = int(evaluate_category(final_hand))
    poker_win = float(payout(final_hand))

    return {
        "deal": tuple(int(c) for c in deal),
        "holdMask": hold_mask,
        "held": tuple(held),
        "drawn": drawn,
        "finalHand": final_hand,
        "category": CATEGORY_NAMES[cat],
        "categoryId": cat,
        "pokerWin": poker_win,
    }
