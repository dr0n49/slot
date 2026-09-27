"""Optimiser setup, derived from math_params.py."""

import os
import sys

from optimization_program.optimization_config import (
    ConstructConditions,
    ConstructFenceBias,
    ConstructParameters,
    ConstructScaling,
    verify_optimization_input,
)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import math_params as P  # noqa: E402


class OptimizationSetup:
    """Amends game_config.opt_params, which is required to setup the maths configuration file."""

    def __init__(self, game_config):
        self.game_config = game_config
        base_share = P.BASE_MODE["rtp_share"]
        base_hr = P.BASE_MODE["hit_rate"]
        basegame_rtp = round(P.RTP - base_share["freegame"] - base_share["0"], 5)
        bonus_rtp = P.RTP
        opt = P.OPTIMISER

        self.game_config.opt_params = {
            "base": {
                "conditions": {
                    "0": ConstructConditions(rtp=0, av_win=0, search_conditions=0).return_dict(),
                    "freegame": ConstructConditions(
                        rtp=base_share["freegame"], hr=base_hr["freegame"], search_conditions={"symbol": "scatter"}
                    ).return_dict(),
                    "basegame": ConstructConditions(hr=base_hr["basegame"], rtp=basegame_rtp).return_dict(),
                },
                # No hand-tuned scaling. The natural B + K-4 distribution already has the
                # shape we validated, so the optimiser is given the RTP shares and hit rates
                # and nothing else: every extra constraint can only pull it away from that
                # shape. (The four rules that used to live here were fitted to the previous
                # maths and the old 10 000x cap, and measurably distorted the profile.)
                "scaling": ConstructScaling([]).return_dict(),
                "parameters": ConstructParameters(
                    num_show=opt["num_show"],
                    num_per_fence=opt["num_per_fence"],
                    min_m2m=4,
                    max_m2m=8,
                    pmb_rtp=1.0,
                    sim_trials=opt["sim_trials"],
                    test_spins=[50, 100, 200],
                    test_weights=[0.3, 0.4, 0.3],
                    score_type="rtp",
                ).return_dict(),
                # No hand-tuned distribution bias either: the optimiser is left with the
                # agreed RTP shares and hit rates and nothing else.
            },
            "bonus": {
                "conditions": {
                    "freegame": ConstructConditions(rtp=bonus_rtp, hr="x").return_dict(),
                },
                # Same reasoning as the base mode: the two rules that used to live here were
                # fitted to the previous maths and the old 10 000x cap.
                "scaling": ConstructScaling([]).return_dict(),
                "parameters": ConstructParameters(
                    num_show=opt["num_show"],
                    num_per_fence=opt["num_per_fence"],
                    min_m2m=4,
                    max_m2m=8,
                    pmb_rtp=1.0,
                    sim_trials=opt["sim_trials"],
                    test_spins=[10, 20, 50],
                    test_weights=[0.6, 0.2, 0.2],
                    score_type="rtp",
                ).return_dict(),
            },
        }

        verify_optimization_input(self.game_config, self.game_config.opt_params)
