"""Prove a live holdMask changes poker win vs the optimal hold on the same remaining deck."""

from __future__ import annotations

import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from poker.constants import HAND_SIZE, N_CARDS
from poker.evaluator import hand_str
from poker.round import complete_live_round

from live_wallet.server import _best_hold_mask, _poker_win_same_deck


def _deal_with_jacks_pair(rng: random.Random) -> tuple[tuple[int, ...], list[int]]:
    # JC=9, JD=22 (rank 9 jack, suits 0 and 1)
    jc, jd = 9, 22
    junk = [0, 1, 2]  # 2C 3C 4C
    deal = (jc, jd, *junk)
    remaining = [c for c in range(N_CARDS) if c not in deal]
    rng.shuffle(remaining)
    return deal, remaining


def main() -> None:
    rng = random.Random(7)
    deal, remaining = _deal_with_jacks_pair(rng)
    optimal = _best_hold_mask(deal)
    # Suboptimal: hold nothing (discard the paying pair).
    player = 0
    player_cat, player_poker = _poker_win_same_deck(deal, remaining, player)
    opt_cat, opt_poker = _poker_win_same_deck(deal, remaining, optimal)
    live = complete_live_round(deal, remaining, player, random.Random(99))
    print("deal", hand_str(deal))
    print("playerHoldMask", player, "poker", player_cat, player_poker, "final", live["finalWin"])
    print("optimalHoldMask", optimal, "poker", opt_cat, opt_poker)
    print("choiceChangedPokerWin", player_poker != opt_poker)
    if player_poker == opt_poker:
        raise SystemExit("expected suboptimal hold-none to differ from optimal on this jack-pair deal")
    print("PASS: live hold changed the poker win vs optimal on the same remaining deck")


if __name__ == "__main__":
    main()
