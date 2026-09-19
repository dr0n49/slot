"""Shared scalar grid math for the 5×5 Lightning Poker board.

Single reference implementation of the honest-board model that both
``gamestate.py`` (books) and the frontend ``engine.ts`` must reproduce.
``par_sheet.py`` carries a vectorized mirror of this logic; the pytest
suite cross-checks the two so they cannot drift.

Model (locked):
  - Board: 25 cards dealt from ONE shuffled 52-card deck (all unique),
    index ``i = r * 5 + c``, row-major.
  - Lines: 5 horizontal rows + 2 long diagonals, exactly 7. No verticals,
    no zigzags, no ways, no clusters.
  - ``handPay(line) = HAND_PAYS[evaluate5(cards of line)] * linePayScale``
    (paytable structure is frozen; linePayScale is the one global knob).
  - ``lineFactor(line) = max(1, sum of cell multipliers on that line)``.
    Multipliers sum on the line and multiply the hand pay — they never add
    to it. Golden cells never carry a multiplier.
  - ``spinWin = min(Σ line terms, 25 000)``. In free spins each line term is
    additionally × ``max(1, bank)`` where ``bank += bankAdd`` BEFORE the
    spin's factor (this spin's multipliers count immediately).
  - ``bankAdd = round(intensity × Σ face values of multipliers that sit on
    at least one paying line)``. Off-line × still multiply nothing and do
    not feed the bank.
  - Golden scatters are JOKER cards (bonus cards): at most one per column.
    A joker is NOT a poker card — it cannot take part in any hand. Every
    line that runs through a joker cell is dead (pays 0), and jokers never
    carry a multiplier. Jokers are placed BEFORE the deal/floor check, so
    floors ("≥1 Jacks-or-Better line", "≥1 Flush line") are satisfied by
    live lines only. Kind sampled first
    (flush 1/1500 → 5 goldens, job 1/120 → 4, standard bonus 1/160 → 3,
    else tease 0–2) then painted — exact trigger rates by construction.
  - During free spins, 3 goldens retrigger +5 extra FS (same 1/80 rate;
    tease 0–2 otherwise). Cap ``MAX_FS``.
  - Bonus floors (conditional deal with capped rerolls):
      job   modes: redeal until ≥1 line is Jacks-or-Better or better,
      flush modes: redeal until ≥1 line is Flush or better.
    FS flush floors every spin to ≥1 Flush+ line (same as ANTE FLUSH).
"""

from __future__ import annotations

import random
from typing import Dict, List, Optional, Sequence, Tuple

# ---------------------------------------------------------------------------
# Locked board geometry
# ---------------------------------------------------------------------------

GRID_ROWS = 5
GRID_COLS = 5
N_CELLS = GRID_ROWS * GRID_COLS

#: The 7 paylines, row-major cell indices. Only these. No verticals.
LINES: Tuple[Tuple[int, ...], ...] = (
    (0, 1, 2, 3, 4),      # H0
    (5, 6, 7, 8, 9),      # H1
    (10, 11, 12, 13, 14),  # H2
    (15, 16, 17, 18, 19),  # H3
    (20, 21, 22, 23, 24),  # H4
    (0, 6, 12, 18, 24),   # D0 main ↘
    (4, 8, 12, 16, 20),   # D1 main ↙
)

#: Hand indices for the floors.
JOB_MIN_IDX = 1   # Jacks or Better or better
FLUSH_MIN_IDX = 5  # Flush or better

MAX_WIN = 25_000.0
#: Base-round bonus trigger chances. Authored by par_sheet calibration and
#: refined by run.py passes — together with buy/ante prices they hold the
#: 96% RTP now that wins pay the published table (no scale trims).
TRIGGERS: Dict[str, float] = {
    "bonus": 1.0 / 160.0,         # 3 goldens — standard 10 FS + multiplier bank
    "job": 1.0 / 120.0,           # 4 goldens — JOB
    "flush": 1.0 / 1500.0,        # 5 goldens — Flush
}
#: Read-only mirrors of TRIGGERS (kept for older imports/doc strings).
P_BONUS = TRIGGERS["bonus"]
P_JOB_BONUS = TRIGGERS["job"]
P_FLUSH_BONUS = TRIGGERS["flush"]
P_RETRIGGER = 1.0 / 80.0      # 3 goldens during FS → +RETRIGGER_FS
RETRIGGER_FS = 5
MAX_FS = 50


def set_bonus_triggers(bonus: float, job: float, flush: float) -> None:
    """Install calibrated trigger chances (mutates module state)."""
    global P_BONUS, P_JOB_BONUS, P_FLUSH_BONUS
    TRIGGERS["bonus"] = float(bonus)
    TRIGGERS["job"] = float(job)
    TRIGGERS["flush"] = float(flush)
    P_BONUS = TRIGGERS["bonus"]
    P_JOB_BONUS = TRIGGERS["job"]
    P_FLUSH_BONUS = TRIGGERS["flush"]

# Card encoding: card id 0..51 → rank = id // 4 + 2 (2..14), suit = id % 4.
N_RANKS = 13


# ---------------------------------------------------------------------------
# Hand evaluation (exact port of frontend evaluateHand semantics)
# ---------------------------------------------------------------------------

def evaluate5(cards: Sequence[int]) -> int:
    """Evaluate a 5-card hand → paytable index 0..9 (Jacks-or-Better rules).

    ``cards`` are card ids 0..51. Mirrors frontend ``evaluateHand``:
    wheel A-2-3-4-5 is a straight, pairs pay only from Jacks up.
    """
    if len(cards) != 5:
        return 0
    ranks = sorted((c // 4) + 2 for c in cards)
    flush = all((c % 4) == (cards[0] % 4) for c in cards)

    uniq = sorted(set(ranks))
    straight = False
    if len(uniq) == 5:
        if ranks[4] - ranks[0] == 4:
            straight = True
        if ranks == [2, 3, 4, 5, 14]:  # wheel
            straight = True

    if straight and flush:
        return 9 if ranks[0] == 10 else 8

    counts: Dict[int, int] = {}
    for r in ranks:
        counts[r] = counts.get(r, 0) + 1
    # Sorted by count desc, then rank desc — same tiebreak as the TS port.
    groups = sorted(counts.items(), key=lambda kv: (-kv[1], -kv[0]))

    if groups[0][1] == 4:
        return 7
    if groups[0][1] == 3 and groups[1][1] == 2:
        return 6
    if flush:
        return 5
    if straight:
        return 4
    if groups[0][1] == 3:
        return 3
    if groups[0][1] == 2 and groups[1][1] == 2:
        return 2
    if groups[0][1] == 2 and groups[0][0] >= 11:
        return 1
    return 0


def eval_board(cards: Sequence[int], jokers: Sequence[int] = ()) -> List[int]:
    """Evaluate all 7 lines of a 25-card board → list of hand indices.

    ``jokers`` are the cell indices holding a bonus (joker) card. A joker is
    not a poker card, so any line through one is dead → hand index 0.
    """
    dead = set(jokers)
    out: List[int] = []
    for line in LINES:
        if dead and any(i in dead for i in line):
            out.append(0)
        else:
            out.append(evaluate5([cards[i] for i in line]))
    return out


# ---------------------------------------------------------------------------
# Deck / board sampling
# ---------------------------------------------------------------------------

def deal_board(rng: random.Random) -> List[int]:
    """Deal 25 unique cards from one shuffled 52-card deck."""
    return rng.sample(range(52), N_CELLS)


# ---------------------------------------------------------------------------
# Golden scatters (exact-rate kind sampling → cell painting)
# ---------------------------------------------------------------------------

def sample_gold_count(rng: random.Random, bonus_kind: Optional[str]) -> int:
    """Golden cell count for a base spin given the sampled bonus kind.

    flush → 5; job → 4; bonus → 3; tease → 0/1/2 (72/20/8%).
    """
    if bonus_kind == "flush":
        return 5
    if bonus_kind == "job":
        return 4
    if bonus_kind == "bonus":
        return 3
    u = rng.random()
    if u < 0.72:
        return 0
    if u < 0.92:
        return 1
    return 2


def sample_golden_cells(rng: random.Random, count: int) -> List[int]:
    """Paint ``count`` golden cells, at most one per column."""
    n = max(0, min(GRID_COLS, int(count)))
    if n <= 0:
        return []
    cols = rng.sample(range(GRID_COLS), n)
    return [rng.randrange(GRID_ROWS) * GRID_COLS + c for c in cols]


def sample_bonus_kind(rng: random.Random) -> Optional[str]:
    """Base-round bonus trigger: flush, job, standard bonus, else None."""
    u = rng.random()
    if u < TRIGGERS["flush"]:
        return "flush"
    if u < TRIGGERS["flush"] + TRIGGERS["job"]:
        return "job"
    if u < TRIGGERS["flush"] + TRIGGERS["job"] + TRIGGERS["bonus"]:
        return "bonus"
    return None


def sample_fs_gold_count(rng: random.Random) -> int:
    """Golden count during free spins: 3 = retrigger, else tease 0/1/2."""
    if rng.random() < P_RETRIGGER:
        return 3
    u = rng.random()
    if u < 0.72:
        return 0
    if u < 0.92:
        return 1
    return 2


# ---------------------------------------------------------------------------
# Multiplier placement
# ---------------------------------------------------------------------------

def _choice_index(rng: random.Random, probs: Sequence[float]) -> int:
    u = rng.random()
    c = 0.0
    for i, p in enumerate(probs):
        c += p
        if u <= c:
            return i
    return len(probs) - 1


def place_multipliers(
    rng: random.Random,
    golden_cells: Sequence[int],
    chance: float,
    n_probs: Sequence[float],
    values: Sequence[float],
    weights: Sequence[float],
    intensity: float = 1.0,
) -> Tuple[List[float], float]:
    """Place per-cell multipliers on non-golden cells.

    Returns ``(cell_values, bank_add)`` where ``cell_values`` is a list of
    25 face values (0.0 = no chip) and ``bank_add`` is the round(intensity×Σ)
    bank contribution of this spin.
    """
    cells = [0.0] * N_CELLS
    if rng.random() >= chance:
        return cells, 0.0
    n = 1 + _choice_index(rng, list(n_probs))
    n = min(n, N_CELLS - len(set(golden_cells)))
    if n <= 0:
        return cells, 0.0
    forbidden = set(golden_cells)
    pool = [i for i in range(N_CELLS) if i not in forbidden]
    chosen = rng.sample(pool, n)
    total = 0.0
    for cell in chosen:
        v = float(values[_choice_index(rng, list(weights))])
        cells[cell] = v
        total += v
    return cells, round(intensity * total)


def paying_line_bank_add(
    cell_mults: Sequence[float],
    hand_idxs: Sequence[int],
    intensity: float,
    pays: Sequence[float],
    line_pay_scale: float,
) -> float:
    """Bank only × that sit on a line that actually paid a poker hand."""
    cells: set[int] = set()
    for li, line in enumerate(LINES):
        hi = hand_idxs[li]
        if (pays[hi] if hi < len(pays) else 0) * line_pay_scale <= 0:
            continue
        for i in line:
            if cell_mults[i] > 0:
                cells.add(i)
    return round(intensity * sum(cell_mults[i] for i in cells))


# ---------------------------------------------------------------------------
# Line wins
# ---------------------------------------------------------------------------

def line_factors(
    cell_mults: Sequence[float],
) -> List[Tuple[int, float]]:
    """Per-line (sum_of_mults, factor=max(1, sum)) — golden cells carry 0."""
    out: List[Tuple[int, float]] = []
    for li, line in enumerate(LINES):
        s = sum(cell_mults[i] for i in line)
        out.append((li, max(1.0, s)))
    return out


def board_spin_win(
    pays: Sequence[float],
    hand_idxs: Sequence[int],
    cell_mults: Sequence[float],
    line_pay_scale: float,
    bank_factor: float = 1.0,
) -> Tuple[float, List[Tuple[int, int, float, float, float]]]:
    """Sum hand pay × line factor (× bank factor in FS) over winning lines.

    Returns ``(spin_win, winning_lines)`` with winning lines as
    ``(line_id, hand_index, hand_pay, mult_factor, line_win)`` tuples
    (hand_pay already includes linePayScale; line_win excludes the bank
    factor so callers can show raw line values — FS applies ``bank_factor``
    to the total).
    """
    total = 0.0
    winners: List[Tuple[int, int, float, float, float]] = []
    for li, line in enumerate(LINES):
        hi = hand_idxs[li]
        hp = pays[hi] * line_pay_scale
        if hp <= 0:
            continue
        factor = max(1.0, sum(cell_mults[i] for i in line))
        line_win = hp * factor
        total += line_win
        winners.append((li, hi, hp, factor, line_win))
    return total * bank_factor, winners


# ---------------------------------------------------------------------------
# Floors (conditional deal, capped rerolls)
# ---------------------------------------------------------------------------

def deal_with_floor(
    rng: random.Random,
    min_hand_idx: int,
    max_rerolls: int,
    jokers: Sequence[int] = (),
) -> Tuple[List[int], int]:
    """Deal a board; redeal until ≥1 LIVE line reaches ``min_hand_idx``.

    Lines through a joker cell are dead and never satisfy the floor.
    Returns ``(board, rerolls_used)``. If the reroll cap is exhausted the
    last board is accepted as-is (documented acceptance rule; the cap is a
    calibration knob, not a guarantee break).
    """
    board = deal_board(rng)
    idxs = eval_board(board, jokers)
    rerolls = 0
    while max(idxs) < min_hand_idx and rerolls < max_rerolls:
        board = deal_board(rng)
        idxs = eval_board(board, jokers)
        rerolls += 1
    return board, rerolls


def deal_package_with_floor(
    rng: random.Random,
    fs_count: int,
    min_hand_idx: int,
    max_rerolls: int,
) -> Tuple[List[List[int]], int]:
    """Deal an FS package; redeal the whole package until ≥1 flush+ line.

    Package floor for FLUSH free spins: cheap (P≈14% per package) and keeps
    the "guaranteed Flush line" promise without 7-guaranteed-flush overpay.
    """
    for attempt in range(max_rerolls + 1):
        boards = [deal_board(rng) for _ in range(fs_count)]
        if any(max(eval_board(b)) >= min_hand_idx for b in boards):
            return boards, attempt
    return boards, max_rerolls
