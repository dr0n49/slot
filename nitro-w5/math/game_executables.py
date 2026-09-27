"""Cascade / free-spin flow shared by base game and free spins."""

from game_calculations import GameCalculations
from game_events import (
    keg_blast_event,
    tumble_board_all_event,
    update_ladder_event,
    win_info_ways_event,
)
from src.events.events import (
    set_total_event,
    set_win_event,
    update_freespin_event,
    update_tumble_win_event,
)


class GameExecutables(GameCalculations):
    """Executable steps of a spin."""

    # ---- cascade sequence ------------------------------------------------ #
    def run_cascade_sequence(self) -> None:
        """Evaluate -> (detonate kegs) -> pay -> tumble, until a board has no win.

        The ladder index only changes here, which keeps the multiplier logic in exactly one
        place. K-4: the step walks rungs `i … i + kegs` and pays once per rung passed, so
        `multiplier` is the sum over those rungs and the next step starts one rung higher.
        """
        while not self.wincap_triggered:
            kegs = self.keg_positions()
            from_index = self.ladder_index
            rungs = self.k4_rungs(from_index, len(kegs))
            multiplier = self.k4_multiplier(rungs)
            next_index = self.k4_next_index(rungs)
            pay_index = rungs[-1]

            win_data = self.get_ways_wins(multiplier)
            if win_data["totalWin"] <= 0:
                break

            self.win_data = win_data
            for pos in kegs:
                self.board[pos["reel"]][pos["row"]].explode = True

            self._record_step(win_data, len(kegs), pay_index)
            self.win_manager.tumble_win = win_data["totalWin"]
            self.win_manager.update_spinwin(win_data["totalWin"])

            win_info_ways_event(self, win_data, rungs, multiplier, len(kegs), next_index)
            if kegs:
                keg_blast_event(self, kegs, rungs, multiplier, next_index)
            update_tumble_win_event(self)
            self.evaluate_wincap()

            self.ladder_index = next_index
            if self.wincap_triggered:
                break

            exploding = [
                {"reel": reel, "row": row}
                for reel, column in enumerate(self.board)
                for row, sym in enumerate(column)
                if sym.explode
            ]
            self.tumble_board()
            tumble_board_all_event(self, exploding)
            update_ladder_event(self)

    def _record_step(self, win_data: dict, keg_count: int, pay_index: int) -> None:
        for win in win_data["wins"]:
            self.record({"kind": win["kind"], "symbol": win["symbol"], "gametype": self.gametype})
        if keg_count:
            self.record({"kind": keg_count, "symbol": "keg", "gametype": self.gametype})
        self.record({"ladder": pay_index, "gametype": self.gametype})

    def set_end_tumble_event(self) -> None:
        """Close the spin: final spin win + running total."""
        if self.win_manager.spin_win > 0:
            set_win_event(self)
        set_total_event(self)

    # ---- free spins ------------------------------------------------------ #
    def update_freespin(self) -> None:
        """Called before a new reveal during freegame; fs is 1-based in the event."""
        self.fs += 1
        update_freespin_event(self)
        self.win_manager.reset_spin_win()
        self.win_data = {}

    def reset_fs_spin(self) -> None:
        super().reset_fs_spin()
        # The free game has its own ladder table and, like the base game, starts every
        # single spin from its bottom rung. Nothing is carried between spins.
        self.ladder_index = 0
