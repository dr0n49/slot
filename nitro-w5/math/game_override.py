"""Overrides of universal state behaviour."""

from game_executables import GameExecutables


class GameStateOverride(GameExecutables):
    def reset_book(self):
        super().reset_book()
        self.ladder_index = 0

    def assign_special_sym_function(self):
        # No symbol carries per-instance attributes in this game.
        self.special_symbol_functions = {}

    def check_game_repeat(self):
        """Verify final win matches the betmode criteria."""
        if self.repeat is False:
            win_criteria = self.get_current_betmode_distributions().get_win_criteria()
            if win_criteria is not None and self.final_win != win_criteria:
                self.repeat = True
