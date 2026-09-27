"""Base game + free spins flow for NITRO VEIN (ways, cascading, Blast Ladder)."""

from game_override import GameStateOverride
from game_events import update_ladder_event


class GameState(GameStateOverride):
    def run_spin(self, sim: int, simulation_seed=None) -> None:
        self.reset_seed(sim)
        self.repeat = True
        while self.repeat:
            self.reset_book()
            self.draw_board(emit_event=True)

            self.run_cascade_sequence()
            self.set_end_tumble_event()
            self.win_manager.update_gametype_wins(self.gametype)

            if self.check_fs_condition() and self.check_freespin_entry():
                self.run_freespin_from_base()

            self.evaluate_finalwin()
            self.check_repeat()

        self.imprint_wins()

    def run_freespin(self) -> None:
        self.reset_fs_spin()
        update_ladder_event(self)
        while self.fs < self.tot_fs and not self.wincap_triggered:
            self.update_freespin()
            # The ladder is per spin here too: no value is carried between free spins.
            self.ladder_index = 0
            update_ladder_event(self)
            self.draw_board(emit_event=True)

            self.run_cascade_sequence()
            self.set_end_tumble_event()

            if self.check_fs_condition() and not self.wincap_triggered:
                self.update_fs_retrigger_amt()

            self.win_manager.update_gametype_wins(self.gametype)
        self.end_freespin()
