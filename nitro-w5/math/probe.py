"""Quick natural-RTP probe (no optimiser, single process).

    python games/nitro_vein/probe.py --mode base --criteria basegame --n 20000
Reports the mean payout and hit rate of the simulated books of one criteria — handy
to see where the reel weights / paytable put each criteria before optimising.
"""

import argparse
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from gamestate import GameState  # noqa: E402
from game_config import GameConfig  # noqa: E402


def probe(mode: str, criteria: str, n: int, seed_offset: int = 0) -> dict:
    config = GameConfig()
    gs = GameState(config)
    gs.betmode = mode
    for bm in config.bet_modes:
        if bm.get_name() == mode:
            gs.win_manager.max_allowed_win = bm.get_wincap()
    gs.criteria = criteria
    payouts = []
    events = 0
    t0 = time.time()
    for sim in range(seed_offset, seed_offset + n):
        gs.run_spin(sim, None)
        book = gs.library[sim + 1]
        payouts.append(book["payoutMultiplier"] / 100)
        events += len(book["events"])
    dt = time.time() - t0
    payouts.sort()
    return {
        "mean": sum(payouts) / n,
        "hit": sum(1 for p in payouts if p > 0) / n,
        "median": payouts[n // 2],
        "p99": payouts[int(n * 0.99)],
        "max": payouts[-1],
        "avg_events": events / n,
        "ms_per_sim": dt / n * 1000,
    }


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", default="base")
    ap.add_argument("--criteria", default="basegame")
    ap.add_argument("--n", type=int, default=5000)
    a = ap.parse_args()
    print(probe(a.mode, a.criteria, a.n))
