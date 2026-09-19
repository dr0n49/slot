"""Lightning Poker — Stake Engine GameConfig (bet modes + caps)."""

from src.config.config import BetMode, Config
from src.config.distributions import Distribution


def _main_dist(criteria: str = "basegame") -> Distribution:
    return Distribution(
        criteria=criteria,
        quota=1.0,
        conditions={
            "reel_weights": {},
            "force_wincap": False,
            "force_freegame": False,
        },
    )


def _wincap_dist(wincap: float, n: int = 1) -> Distribution:
    """Do NOT attach to bet_modes.

    Equal-weight cap rows in the LUT pollute measured RTP: one 25k hit in
    15k bonus_job books at cost 25× is +6.7pp RTP, and pass-2 then crushes
    the live scale. Max win stays declared on BetMode.max_win; natural 25k
    hits (if any) already appear in the books.
    """
    return Distribution(
        criteria="wincap",
        fixed_amt=n,
        win_criteria=wincap,
        conditions={
            "reel_weights": {},
            "force_wincap": True,
            "force_freegame": False,
        },
    )


class GameConfig(Config):
    def __init__(self):
        super().__init__()
        self.game_id = "poker_mult_slot"
        self.provider_number = 0
        self.working_name = "lightning_poker"
        self.wincap = 25_000.0
        self.win_type = "other"
        self.rtp = 0.96
        self.construct_paths()

        # Video-poker (no reels) — keep empty board dims
        self.num_reels = 0
        self.num_rows = []
        self.paytable = {}
        self.include_padding = False
        self.special_symbols = {"wild": [], "scatter": [], "multiplier": []}
        self.freespin_triggers = {self.basegame_type: {}, self.freegame_type: {}}
        self.anticipation_triggers = {self.basegame_type: 0, self.freegame_type: 0}

        # Mode costs MUST match frontend mathConfig priceUiX (calibrated to
        # 96% RTP with published line pays — see par_sheet.py calibrate_grid).
        self.bet_modes = [
            BetMode(
                name="base",
                cost=1.0,
                rtp=self.rtp,
                max_win=self.wincap,
                auto_close_disabled=False,
                is_feature=False,
                is_buybonus=False,
                distributions=[_main_dist("basegame")],
            ),
            BetMode(
                name="bonus",
                cost=25.0,
                rtp=self.rtp,
                max_win=self.wincap,
                auto_close_disabled=False,
                is_feature=True,
                is_buybonus=True,
                distributions=[_main_dist("freegame")],
            ),
            BetMode(
                name="bonus_job",
                cost=35.0,
                rtp=self.rtp,
                max_win=self.wincap,
                auto_close_disabled=False,
                is_feature=True,
                is_buybonus=True,
                distributions=[_main_dist("freegame")],
            ),
            BetMode(
                name="bonus_flush",
                cost=190.0,
                rtp=self.rtp,
                max_win=self.wincap,
                auto_close_disabled=False,
                is_feature=True,
                is_buybonus=True,
                distributions=[_main_dist("freegame")],
            ),
            BetMode(
                name="ante_job",
                cost=5.0,
                rtp=self.rtp,
                max_win=self.wincap,
                auto_close_disabled=False,
                is_feature=True,
                is_buybonus=False,
                distributions=[_main_dist("basegame")],
            ),
            BetMode(
                name="ante_flush",
                cost=15.0,
                rtp=self.rtp,
                max_win=self.wincap,
                auto_close_disabled=False,
                is_feature=True,
                is_buybonus=False,
                distributions=[_main_dist("basegame")],
            ),
        ]
