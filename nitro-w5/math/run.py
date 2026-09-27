"""Generate books, optimise the weights to the target RTP and publish RGS files.

    python games/nitro_vein/run.py                      # defaults from math_params.DEFAULT_SIMS
    python games/nitro_vein/run.py --base 50000 --bonus 10000 --no-opt
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from gamestate import GameState  # noqa: E402
from game_config import GameConfig  # noqa: E402
from game_optimization import OptimizationSetup  # noqa: E402
import math_params as P  # noqa: E402
from optimization_program.run_script import OptimizationExecution  # noqa: E402
from utils.game_analytics.run_analysis import create_stat_sheet  # noqa: E402
from utils.rgs_verification import execute_all_tests  # noqa: E402
from src.state.run_sims import create_books  # noqa: E402
from src.write_data.write_configs import generate_configs  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", type=int, default=P.DEFAULT_SIMS["base"])
    ap.add_argument("--bonus", type=int, default=P.DEFAULT_SIMS["bonus"])
    ap.add_argument("--threads", type=int, default=max(1, (os.cpu_count() or 2)))
    ap.add_argument("--batch", type=int, default=10_000)
    ap.add_argument("--modes", default="base,bonus", help="modes to optimise")
    ap.add_argument("--no-sims", action="store_true")
    ap.add_argument("--no-opt", action="store_true")
    ap.add_argument("--no-analysis", action="store_true")
    ap.add_argument("--no-checks", action="store_true")
    args = ap.parse_args()

    config = GameConfig()
    gamestate = GameState(config)
    OptimizationSetup(config)

    if not args.no_sims:
        create_books(
            gamestate,
            config,
            {"base": args.base, "bonus": args.bonus},
            args.batch,
            args.threads,
            True,
            False,
        )

    generate_configs(gamestate)

    if not args.no_opt:
        OptimizationExecution().run_all_modes(config, [m for m in args.modes.split(",") if m], args.threads)
        generate_configs(gamestate)

    if not args.no_analysis:
        create_stat_sheet(gamestate, custom_keys=[{"symbol": "scatter"}, {"symbol": "keg"}])

    if not args.no_checks:
        execute_all_tests(config)


if __name__ == "__main__":
    main()
