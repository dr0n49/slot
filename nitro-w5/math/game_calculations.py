"""Ways evaluation with the Blast Ladder multiplier."""

from src.executables.executables import Executables


class GameCalculations(Executables):
    """Pure calculations: no events are emitted from here."""

    def ladder_values(self) -> list:
        return self.config.ladder[self.gametype]

    def ladder_multiplier(self, index: int) -> int:
        values = self.ladder_values()
        return values[min(max(index, 0), len(values) - 1)]

    def clamp_ladder(self, index: int) -> int:
        return min(max(index, 0), len(self.ladder_values()) - 1)

    def k4_rungs(self, index: int, kegs: int) -> list:
        """K-4: the rungs a cascade step passes through, from `index` up.

        Every detonating keg carries the step one rung further. The returned list is always
        a contiguous, non-empty run of rung indices ending at the ladder top at the latest,
        so no rung can be skipped and none is visited twice.
        """
        lo = self.clamp_ladder(index)
        hi = self.clamp_ladder(index + max(kegs, 0))
        return list(range(lo, hi + 1))

    def k4_multiplier(self, rungs: list) -> int:
        """The step's multiplier: every passed rung pays exactly once."""
        return sum(self.ladder_multiplier(j) for j in rungs)

    def k4_next_index(self, rungs: list) -> int:
        """Where the next cascade starts: one rung above the last one passed (or the top)."""
        return self.clamp_ladder(rungs[-1] + 1)

    def keg_positions(self) -> list:
        keg_names = self.config.special_symbols["keg"]
        return [
            {"reel": reel, "row": row}
            for reel, column in enumerate(self.board)
            for row, sym in enumerate(column)
            if sym.name in keg_names
        ]

    def get_ways_wins(self, multiplier: int = 1) -> dict:
        """Left-to-right ways win for every paying symbol on the reel-1 column.

        Wilds substitute for any paying symbol (never for scatter / keg). Winning
        symbols (wilds included) are flagged `explode` so the tumble removes them.
        """
        wild_names = set(self.config.special_symbols["wild"])
        paying = {sym for (_, sym) in self.config.paytable}
        return_data = {"totalWin": 0.0, "wins": []}
        first_reel_symbols = []
        for sym in self.board[0]:
            if sym.name in paying and sym.name not in first_reel_symbols:
                first_reel_symbols.append(sym.name)

        exploded = []
        for name in first_reel_symbols:
            positions, ways, kind = [], 1, 0
            for reel, column in enumerate(self.board):
                matches = [
                    {"reel": reel, "row": row}
                    for row, sym in enumerate(column)
                    if sym.name == name or sym.name in wild_names
                ]
                if not matches:
                    break
                kind += 1
                ways *= len(matches)
                positions += matches
            pay = self.config.paytable.get((kind, name))
            if pay is None:
                continue
            base_win = round(pay * ways, 4)
            # Books carry payoutMultiplier in hundredths, so 0.01x is the payout resolution.
            # There is no minimum-win floor: a line pays exactly what the table says.
            step = self.config.payout_step
            win = round(round(base_win * multiplier / step + 1e-9) * step, 2)
            return_data["wins"].append(
                {
                    "symbol": name,
                    "kind": kind,
                    "win": win,
                    "positions": positions,
                    "meta": {"ways": ways, "globalMult": multiplier, "winWithoutMult": base_win},
                }
            )
            return_data["totalWin"] = round(return_data["totalWin"] + win, 2)
            exploded += positions

        for pos in exploded:
            self.board[pos["reel"]][pos["row"]].explode = True
        return return_data
