"""NITRO VEIN — single source of truth for every tunable math parameter.

Nothing in the frontend, the reel builder, the game-state code or the tests
hard-codes a math value: they all read this module (directly, or through the
generated `config_fe_nitro_vein.json`). To retune the game edit values here,
then run:

    python games/nitro_vein/build_reels.py      # rebuild reel strips from weights
    python games/nitro_vein/run.py              # simulate + optimise + publish

RTP is hit by the SDK optimiser, which re-weights the simulated books per
criteria (`CRITERIA` below). The paytable / reel weights only need to keep the
*natural* RTP of each criteria in the neighbourhood of its target share.
"""

GAME_ID = "nitro_vein"
GAME_NAME = "Nitro Vein"
PROVIDER_NUMBER = 0

# --------------------------------------------------------------------------- #
# Headline numbers
# --------------------------------------------------------------------------- #
RTP = 0.96  # target RTP of every bet mode
# Max win, in multiples of the total bet. This is the game's own ceiling: it is produced by
# the real reels and the real ladder, not by a forced simulation criteria. Measured natural
# ceiling of this model is ~2 500x over 100M rounds, so 3000x is reachable, not decorative.
WINCAP = 3000
# Bonus-buy price, in multiples of the bet. Derived from the feature's own value:
#   E[feature] = 94.52x (measured on production: every feature is 10 spins)
#   fair price = 94.52 / 0.96 = 98.46x  ->  98.5x
BONUS_COST = 98.5

# --------------------------------------------------------------------------- #
# Board
# --------------------------------------------------------------------------- #
NUM_REELS = 5
NUM_ROWS = 6
STRIP_LENGTH = 100  # rows per reel-strip csv

# --------------------------------------------------------------------------- #
# Symbols
#   L* = low gems, H* = high relics, W = wild (reels 2-5), S = scatter (dynamite),
#   K = nitro keg (special: detonates on any winning cascade and boosts the ladder)
# --------------------------------------------------------------------------- #
PAYING_SYMBOLS = ["H1", "H2", "H3", "H4", "L1", "L2", "L3", "L4", "L5"]
WILD = "W"
SCATTER = "S"
KEG = "K"
ROCK = "R"  # bedrock: never pays, never removed - it only takes up space (and falls with gravity)

# Ways pay: multiples of the total bet PER WAY, for 4 and 5 reels in a row.
# These are the final numbers the game pays — there is no scale factor in front of them, so
# a line's value can be read straight off this table and checked by hand.
PAYTABLE = {
    "H1": {4: 0.1125, 5: 0.3500},
    "H2": {4: 0.0850, 5: 0.2800},
    "H3": {4: 0.0560, 5: 0.1830},
    "H4": {4: 0.0420, 5: 0.1270},
    "L1": {4: 0.0200, 5: 0.0560},
    "L2": {4: 0.0155, 5: 0.0450},
    "L3": {4: 0.0125, 5: 0.0350},
    "L4": {4: 0.0100, 5: 0.0280},
    "L5": {4: 0.0085, 5: 0.0225},
}

# Payouts are quantised to this step (the RGS book carries payoutMultiplier in hundredths,
# so 0.01x is the finest the protocol allows). There is no minimum-win floor.
PAYOUT_STEP = 0.01

# Blast Ladder: the multiplier a cascade step pays with.
#
# K-4 rule: a step passes through rungs `i … min(i + kegs, top)` and pays ONCE PER RUNG
# PASSED, so the step's multiplier is the SUM over those rungs and the next cascade starts
# on `min(i + kegs + 1, top)`. A rung can therefore never be skipped — not as a state and
# not as a paying rung.
#
# The ladder resets at the start of every spin, in the base game and in free spins alike.
LADDER = {
    "basegame": [1, 2, 3, 5, 10, 20, 50],
    "freegame": [2, 4, 8, 16, 35, 80, 200],
}

# --------------------------------------------------------------------------- #
# Free spins ("Deep Vein")
#   number of scatters on the board after the cascade sequence -> spins awarded
# --------------------------------------------------------------------------- #
# Scatters sit on reels 1 / 3 / 5 and are spaced 8 strip cells apart, while the board window
# is 6 rows, so two scatters can never share a reel: the board holds exactly 3 at most and a
# feature is always entered with 3. Measured over 250k natural rounds: 100% of entries and
# 100% of retriggers were 3-scatter. The tables therefore have one reachable entry each -
# there is deliberately no 4 / 5 row, because no board can produce one.
FS_TRIGGER = {3: 10}
FS_RETRIGGER = {3: 5}
ANTICIPATION_AT_SCATTERS = {"basegame": 2, "freegame": 2}

# --------------------------------------------------------------------------- #
# Reel strip weights (relative weights per strip of STRIP_LENGTH cells).
# Per-reel overrides allow e.g. "no wild on reel 1". Keys are symbol names.
# The strip builder turns these into exact integer counts.
# --------------------------------------------------------------------------- #
#
# Scatters are NOT weighted: their count per strip is fixed below, because the feature rate
# has to be a calibrated number rather than whatever a weight happens to round to.
_BASE_WEIGHTS = {
    "H1": 4, "H2": 5, "H3": 7, "H4": 9,
    "L1": 11, "L2": 12, "L3": 13, "L4": 14, "L5": 15,
    "W": 3, "K": 3, "R": 22,
}

_FREE_WEIGHTS = {
    "H1": 4, "H2": 5, "H3": 7, "H4": 9,
    "L1": 11, "L2": 12, "L3": 13, "L4": 14, "L5": 15,
    "W": 5, "K": 5, "R": 10,
}

REEL_WEIGHTS = {
    # strip name -> {reel index -> {symbol: weight}}
    "BR0": {r: dict(_BASE_WEIGHTS) for r in range(NUM_REELS)},
    "FR0": {r: dict(_FREE_WEIGHTS) for r in range(NUM_REELS)},
}
# Wilds never land on the first reel (a ways win must start with a real symbol).
for _strip in REEL_WEIGHTS.values():
    _strip[0]["W"] = 0

# Exact number of scatters per strip, by reel index. Scatters live on reels 1 / 3 / 5 only;
# the cells they occupy are taken out of the bedrock budget of that strip.
SCATTER_COUNTS = [3, 0, 2, 0, 2]

# Minimum distance (in strip rows) between two symbols of the same "rare" kind.
MIN_SPACING = {"S": 8, "K": 4, "W": 3}

# --------------------------------------------------------------------------- #
# Win levels (thresholds in x bet, lower bound inclusive). The book carries the
# level integer; the frontend maps it to normal / big / mega / massive / max.
# --------------------------------------------------------------------------- #
WIN_LEVELS = {
    1: 0.0,
    2: 0.5,
    3: 2.0,
    4: 5.0,
    5: 10.0,
    6: 20.0,  # BIG
    7: 50.0,  # MEGA
    8: 200.0,  # MASSIVE
    9: 1000.0,  # MASSIVE (jackpot flourish)
    10: WINCAP,  # MAX WIN
}

# --------------------------------------------------------------------------- #
# Simulation criteria -> quotas / forced conditions and optimiser targets.
# rtp shares must add up to RTP (checked by the SDK).
# --------------------------------------------------------------------------- #
# There is no `wincap` criteria: the max win is not manufactured on a special strip, it is
# whatever the real reels produce (see WINCAP above).
# `scatter_triggers` is a SIMULATION-HARNESS setting: it says how many scatters to force onto
# the OPENING board of a forced-feature book. Scatters sit on reels 1 / 3 / 5 and are spaced
# 8 strip cells apart, so a 6-row window can never show two on one reel: the opening board
# holds at most 3. Forcing 4 or 5 is impossible and hangs the generator, hence 3 only. The
# game itself can still reach 4 and 5 — scatters are never removed, so a cascade can bring
# another one down, and FS_TRIGGER keeps its 4 / 5 entries for that.
BASE_MODE = {
    "quota": {"freegame": 0.1, "0": 0.4, "basegame": None},  # None = remainder
    "scatter_triggers": {3: 100},
    # Share of the 96% RTP each criteria must carry. A criteria is a class of BOOKS, so the
    # freegame figure is the contribution of whole feature ROUNDS, the triggering base spin
    # included. Measured naturally on production over 300k rounds: feature rounds carry
    # 53.30 pp of a 95.46% total, i.e. 0.536 once normalised to 0.96.
    "rtp_share": {"freegame": 0.535, "0": 0.0, "basegame": None},  # None = remainder
    # 1 in N spins. Measured naturally on production: base-game wins 1 / 1.621, feature
    # 1 / 180. Together that is the 62.26% overall hit rate of the validated model.
    "hit_rate": {"freegame": 180, "basegame": 1.621},
}
BONUS_MODE = {
    "quota": {"freegame": None},
    "scatter_triggers": {3: 100},
    "rtp_share": {"freegame": None},
}

# Optimiser search parameters (see SDK docs). Larger = slower but smoother.
OPTIMISER = {"num_show": 5000, "num_per_fence": 10000, "sim_trials": 5000}

# Default simulation sizes used by run.py (override on the CLI).
DEFAULT_SIMS = {"base": 200_000, "bonus": 40_000}
