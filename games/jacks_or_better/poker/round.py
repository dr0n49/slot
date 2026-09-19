"""Simulate one video-poker round: deal → optimal hold → draw → mandatory double-up."""

from __future__ import annotations

import random
from typing import Sequence

import numpy as np

from .combinadic import binomial_table, colex_unrank
from .constants import (
    CATEGORY_NAMES,
    DOUBLE_UP_MAX_CHAIN,
    HAND_SIZE,
    N_CARDS,
    N_DEALS,
)
from .evaluator import card_str, card_suit, evaluate_category, payout
from .solver import WAYS_BY_HELD, _split_hold

_STRATEGY: np.ndarray | None = None
_BINOM52 = None
_BINOM47 = None


def _binom52():
    global _BINOM52
    if _BINOM52 is None:
        _BINOM52 = binomial_table()
    return _BINOM52


def _binom47():
    global _BINOM47
    if _BINOM47 is None:
        _BINOM47 = binomial_table(n_max=47, k_max=5)
    return _BINOM47


def load_strategy(path: str) -> np.ndarray:
    global _STRATEGY
    strat = np.load(path)
    if strat.shape[0] != N_DEALS:
        raise ValueError(f"strategy length {strat.shape[0]} != {N_DEALS}")
    _STRATEGY = strat.astype(np.uint8)
    return _STRATEGY


def get_strategy() -> np.ndarray:
    if _STRATEGY is None:
        raise RuntimeError("strategy not loaded; call load_strategy() first")
    return _STRATEGY


def deal_from_sim(sim: int) -> tuple[int, ...]:
    return colex_unrank(sim, HAND_SIZE, _binom52(), n=N_CARDS)


def pick_draw(remaining: Sequence[int], n_draw: int, draw_idx: int) -> tuple[int, ...]:
    if n_draw == 0:
        return ()
    pos = colex_unrank(draw_idx, n_draw, _binom47(), n=len(remaining))
    return tuple(remaining[p] for p in pos)


def _survive_double_up(rng: random.Random) -> bool:
    """Two fair coin-flips → P=1/4 (mandatory n=2 chain)."""
    for _ in range(DOUBLE_UP_MAX_CHAIN):
        if rng.random() >= 0.5:
            return False
    return True


def _double_up_events(poker_win: float, survive: bool, rng: random.Random) -> tuple[float, list[dict]]:
    events: list[dict] = []
    if poker_win <= 0:
        return 0.0, events
    amount = poker_win
    for step in range(1, DOUBLE_UP_MAX_CHAIN + 1):
        card = rng.randint(0, N_CARDS - 1)
        colour = "red" if card_suit(card) in (1, 2) else "black"
        if survive:
            correct = True
            amount *= 2
        else:
            correct = False
            amount = 0.0
        events.append(
            {
                "step": step,
                "card": card_str(card),
                "colour": colour,
                "correct": correct,
                "amountAfter": int(round(amount * 100, 0)),
            }
        )
        if not survive:
            break
    return amount, events


def play_round(sim: int, rng: random.Random | None = None) -> dict:
    """Play one round for colex deal index `sim` in [0, N_DEALS).

    Draw index is deterministic (sim % n_ways) so books are reproducible.
    Double-up uses a separate seeded RNG (sim + offset) for fair 1/4 survival.
    """
    if rng is None:
        rng = random.Random(sim + 1)
    strategy = get_strategy()
    deal = deal_from_sim(sim)
    mask = int(strategy[sim])
    held, _disc = _split_hold(deal, mask)
    n_held = mask.bit_count()
    n_draw = HAND_SIZE - n_held
    remaining = [c for c in range(N_CARDS) if c not in deal]
    n_ways = WAYS_BY_HELD[n_held]

    draw_idx = sim % n_ways if n_draw else 0
    drawn = pick_draw(remaining, n_draw, draw_idx)
    final_hand = tuple(held) + drawn
    cat = evaluate_category(final_hand)
    poker_win = float(payout(final_hand))

    du_rng = random.Random(sim + 1_000_003)
    survive = _survive_double_up(du_rng) if poker_win > 0 else False
    final_win, du_events = _double_up_events(poker_win, survive, du_rng)

    return {
        "deal": deal,
        "holdMask": mask,
        "held": tuple(held),
        "drawn": drawn,
        "finalHand": final_hand,
        "category": CATEGORY_NAMES[cat],
        "pokerWin": poker_win,
        "finalWin": final_win,
        "doubleUp": du_events,
    }


def complete_live_round(
    deal: Sequence[int],
    remaining: Sequence[int],
    hold_mask: int,
    rng: random.Random,
) -> dict:
    """Finish a live round from a stored deal + remaining deck and a player hold.

    Uses the same evaluator (`payout` / `evaluate_category`) and the same
    `_survive_double_up` / `_double_up_events` path as `play_round`. Draw order
    is the stored remaining deck (not the frozen colex book draw).
    """
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

    cat = evaluate_category(final_hand)
    poker_win = float(payout(final_hand))
    survive = _survive_double_up(rng) if poker_win > 0 else False
    final_win, du_events = _double_up_events(poker_win, survive, rng)

    return {
        "deal": tuple(int(c) for c in deal),
        "holdMask": hold_mask,
        "held": tuple(held),
        "drawn": drawn,
        "finalHand": final_hand,
        "category": CATEGORY_NAMES[cat],
        "pokerWin": poker_win,
        "finalWin": final_win,
        "doubleUp": du_events,
    }
