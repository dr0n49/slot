"""Grid math tests for the 5×5 Lightning Poker conversion.

Covers: evaluate5 paytable port, the 7 exact line index sets, a fixture
board with a known multi-line win, golden/multiplier placement invariants,
trigger rates, floor behavior, and scalar-vs-vector sampler parity.
"""

from __future__ import annotations

import json
import random
import sys
from pathlib import Path

GAME_DIR = Path(__file__).resolve().parents[1]
SDK_ROOT = GAME_DIR.parent.parent
for p in (str(GAME_DIR), str(SDK_ROOT)):
    if p not in sys.path:
        sys.path.insert(0, p)

import numpy as np  # noqa: E402

import grid_math  # noqa: E402
import par_sheet  # noqa: E402

CFG = json.loads((GAME_DIR / "frontend" / "src" / "mathConfig.json").read_text())


def card(rank: int, suit: int) -> int:
    """Card id 0..51 from rank 2..14 and suit 0..3 (S, H, D, C)."""
    return (rank - 2) * 4 + suit


# ---------------------------------------------------------------------------
# evaluate5 — paytable port (must mirror frontend evaluateHand)
# ---------------------------------------------------------------------------

def test_evaluate5_paytable_categories():
    s, h, d, c = 0, 1, 2, 3
    assert grid_math.evaluate5([card(10, s), card(11, s), card(12, s), card(13, s), card(14, s)]) == 9
    assert grid_math.evaluate5([card(9, h), card(10, h), card(11, h), card(12, h), card(13, h)]) == 8
    assert grid_math.evaluate5([card(2, h), card(3, d), card(4, s), card(5, c), card(14, s)]) == 4  # wheel
    assert grid_math.evaluate5([card(2, h), card(3, h), card(4, h), card(5, h), card(14, h)]) == 8  # wheel SF
    assert grid_math.evaluate5([card(5, s), card(5, h), card(5, d), card(5, c), card(9, s)]) == 7
    assert grid_math.evaluate5([card(5, s), card(5, h), card(5, d), card(9, c), card(9, s)]) == 6
    assert grid_math.evaluate5([card(2, h), card(4, h), card(6, h), card(8, h), card(13, h)]) == 5
    assert grid_math.evaluate5([card(3, s), card(4, d), card(5, s), card(6, h), card(7, c)]) == 4
    assert grid_math.evaluate5([card(8, s), card(8, h), card(8, d), card(2, c), card(9, s)]) == 3
    assert grid_math.evaluate5([card(8, s), card(8, h), card(6, d), card(6, c), card(9, s)]) == 2
    assert grid_math.evaluate5([card(11, s), card(11, h), card(2, d), card(5, c), card(9, s)]) == 1
    assert grid_math.evaluate5([card(10, s), card(10, h), card(2, d), card(5, c), card(9, s)]) == 0  # tens don't pay
    assert grid_math.evaluate5([card(2, s), card(5, h), card(7, d), card(9, c), card(11, s)]) == 0


def test_evaluate5_rejects_wrong_length():
    assert grid_math.evaluate5([0, 1, 2, 3]) == 0
    assert grid_math.evaluate5(list(range(6))) == 0


def test_line_index_sets_match_brief():
    expected = [
        (0, 1, 2, 3, 4),
        (5, 6, 7, 8, 9),
        (10, 11, 12, 13, 14),
        (15, 16, 17, 18, 19),
        (20, 21, 22, 23, 24),
        (0, 6, 12, 18, 24),   # D0 ↘
        (4, 8, 12, 16, 20),   # D1 ↙
    ]
    assert [tuple(l) for l in grid_math.LINES] == list(expected)
    assert par_sheet.LINES.tolist() == [list(e) for e in expected]
    cfg_lines = [CFG["lines"][k] for k in ("H0", "H1", "H2", "H3", "H4", "D0", "D1")]
    assert cfg_lines == [list(e) for e in expected]


# ---------------------------------------------------------------------------
# Fixture board: royal flush on D0 + pair of aces on H1 sharing cell 6
# ---------------------------------------------------------------------------

FIXTURE_BOARD = [
    card(14, 0), card(2, 3), card(3, 2), card(5, 1), card(6, 0),   # H0
    card(14, 1), card(13, 0), card(14, 2), card(3, 3), card(8, 1),  # H1 (A♥ K♠ A♦ 3♣ 8♥)
    card(4, 0), card(9, 1), card(12, 0), card(10, 2), card(7, 3),   # H2
    card(2, 2), card(6, 1), card(9, 3), card(11, 0), card(10, 1),   # H3
    card(5, 3), card(2, 1), card(8, 2), card(9, 2), card(10, 0),    # H4
]


def test_fixture_board_multiline_win():
    idxs = grid_math.eval_board(FIXTURE_BOARD)
    assert idxs == [0, 1, 0, 0, 0, 9, 0]  # JoB on H1 + Royal Flush on D0
    # shared cell 6 (K♠) belongs to both winners
    assert 6 in grid_math.LINES[1] and 6 in grid_math.LINES[5]


def test_paying_line_bank_only_counts_winning_line_mults():
    pays = [float(x) for x in CFG["hands"]["pays"]]
    lps = float(CFG["params"]["linePayScale"])
    cell = [0.0] * 25
    cell[6] = 3.0  # shared by paying H1 + D0
    cell[2] = 500.0  # H0 does not pay
    idxs = grid_math.eval_board(FIXTURE_BOARD)
    add = grid_math.paying_line_bank_add(cell, idxs, 1.0, pays, lps)
    assert add == 3.0
    cell[6] = 0.0
    assert grid_math.paying_line_bank_add(cell, idxs, 1.0, pays, lps) == 0.0


def test_fs_gold_count_is_retrigger_or_tease():
    rng = random.Random(1)
    n = 40_000
    counts = [grid_math.sample_fs_gold_count(rng) for _ in range(n)]
    assert set(counts) <= {0, 1, 2, 3}
    assert abs(counts.count(3) / n - 1 / 80) < 0.004
    assert max(counts) == 3


def test_fixture_board_line_payouts():
    pays = [float(x) for x in CFG["hands"]["pays"]]
    lps = float(CFG["params"]["linePayScale"])
    cell_mults = [0.0] * 25
    cell_mults[6] = 3.0  # shared by H1 and D0
    win, winners = grid_math.board_spin_win(pays, grid_math.eval_board(FIXTURE_BOARD), cell_mults, lps)
    assert {w[0] for w in winners} == {1, 5}
    royal_pay = pays[9] * lps * 3.0
    job_pay = pays[1] * lps * 3.0
    assert abs(win - (royal_pay + job_pay)) < 1e-9
    # a multiplier that sits on no winning line never pays
    cell_mults[6] = 0.0
    cell_mults[2] = 500.0
    win2, _ = grid_math.board_spin_win(pays, grid_math.eval_board(FIXTURE_BOARD), cell_mults, lps)
    assert abs(win2 - (pays[9] + pays[1]) * lps) < 1e-9


def test_cap_is_applied_to_round_totals_elsewhere():
    pays = [float(x) for x in CFG["hands"]["pays"]]
    win, _ = grid_math.board_spin_win(pays, grid_math.eval_board(FIXTURE_BOARD), [0.0] * 25, 1_000.0)
    assert win > grid_math.MAX_WIN  # raw may exceed; books/FE cap the round total


# ---------------------------------------------------------------------------
# Placement invariants
# ---------------------------------------------------------------------------

def test_golden_and_multiplier_disjoint():
    rng = random.Random(4)
    for _ in range(500):
        kind = grid_math.sample_bonus_kind(rng)
        count = grid_math.sample_gold_count(rng, kind)
        gold = grid_math.sample_golden_cells(rng, count)
        mults, _bank = grid_math.place_multipliers(
            rng, gold, 1.0, [1.0], CFG["multipliers"]["values"], CFG["multipliers"]["weights"]
        )
        for cell in gold:
            assert mults[cell] == 0.0, "golden cell carries a multiplier"


def test_trigger_rates_exact():
    rng = random.Random(12)
    n = 300_000
    flush = job = bonus = 0
    for _ in range(n):
        kind = grid_math.sample_bonus_kind(rng)
        if kind == "flush":
            flush += 1
        elif kind == "job":
            job += 1
        elif kind == "bonus":
            bonus += 1
    assert abs(flush / n - 1 / 1500) < 1 / 1500 * 0.1
    assert abs(job / n - 1 / 120) < 1 / 120 * 0.05
    assert abs(bonus / n - 1 / 160) < 1 / 160 * 0.12


def test_golden_counts_match_policy():
    rng = random.Random(5)
    assert all(grid_math.sample_gold_count(rng, "bonus") == 3 for _ in range(1000))
    assert all(grid_math.sample_gold_count(rng, "job") == 4 for _ in range(1000))
    assert all(grid_math.sample_gold_count(rng, "flush") == 5 for _ in range(1000))
    teases = [grid_math.sample_gold_count(rng, None) for _ in range(5000)]
    assert set(teases) <= {0, 1, 2}


def test_golden_at_most_one_per_column():
    rng = random.Random(9)
    for count in range(6):
        for _ in range(200):
            cells = grid_math.sample_golden_cells(rng, count)
            assert len(cells) == min(count, 5)
            cols = [c % 5 for c in cells]
            assert len(cols) == len(set(cols))


def test_deck_deal_unique():
    rng = random.Random(6)
    for _ in range(200):
        board = grid_math.deal_board(rng)
        assert len(board) == 25 and len(set(board)) == 25
        assert all(0 <= c < 52 for c in board)


# ---------------------------------------------------------------------------
# Floors
# ---------------------------------------------------------------------------

def test_job_floor_guarantees_a_job_line():
    rng = random.Random(7)
    for _ in range(300):
        board, rerolls = grid_math.deal_with_floor(rng, grid_math.JOB_MIN_IDX, 25)
        assert max(grid_math.eval_board(board)) >= 1
        assert 0 <= rerolls <= 25


def test_flush_fs_floor_guarantees_a_flush_line_each_spin():
    rng = random.Random(8)
    for _ in range(40):
        board, rerolls = grid_math.deal_with_floor(rng, grid_math.FLUSH_MIN_IDX, 300)
        assert max(grid_math.eval_board(board)) >= 5
        assert 0 <= rerolls <= 300


# ---------------------------------------------------------------------------
# Scalar vs vector sampler parity (gamestate reference vs par_sheet MC)
# ---------------------------------------------------------------------------

def test_scalar_vs_vector_eval_parity():
    rng_np = np.random.default_rng(11)
    rng_py = random.Random(11)
    for _ in range(1000):
        board = grid_math.deal_board(rng_py)
        hv = par_sheet._eval_lines(
            np.asarray([[c // 4 + 2 for c in board]]),
            np.asarray([[c % 4 for c in board]]),
        )[0].tolist()
        assert grid_math.eval_board(board) == hv


def test_vector_honest_deck_frequencies():
    """Dealt-5 poker frequencies on honest boards (no floor) ≈ theory."""
    rng = np.random.default_rng(13)
    ranks, suits = par_sheet._deal(rng, 40_000)
    h = par_sheet._eval_lines(ranks, suits)
    freq = np.bincount(h.ravel(), minlength=10) / h.size
    job_plus = 1.0 - freq[0]
    assert 0.195 < job_plus < 0.215          # theory ≈ 20.6% per line
    assert 0.0015 < freq[5] < 0.0025         # flush ≈ 0.197%
    assert freq[9] < 2e-6                    # royal ≈ 1.5e-6
    any_flush = float((h >= 5).any(axis=1).mean())
    assert 0.015 < any_flush < 0.045         # ≥1 flush+ line per board


def test_base_mode_rtp_smoke():
    import gamestate as gs

    wins = [gs._raw_parts(random.Random(10_000 + i), "base")[0] for i in range(4000)]
    mean = sum(wins) / len(wins)
    assert 0.70 < mean < 1.20  # coarse smoke band around the 96% target


# ---------------------------------------------------------------------------
# Joker (bonus card) rules: not a poker card, lines through it pay 0
# ---------------------------------------------------------------------------

def _royal_row0() -> list[int]:
    """Board whose row 0 is a royal flush of spades; the rest is filler."""
    row = [card(r, 0) for r in (10, 11, 12, 13, 14)]
    rest = [c for c in range(52) if c not in row][:20]
    return row + rest


def test_joker_kills_every_line_it_sits_on():
    board = _royal_row0()
    base = grid_math.eval_board(board)
    assert base[0] == 9
    # cell 2 (row 0, col 2) belongs to H0 only -> only H0 dies
    hands = grid_math.eval_board(board, jokers=(2,))
    assert hands[0] == 0
    assert hands[1:] == base[1:]
    # cell 12 is the centre: on H2 and both diagonals
    hands = grid_math.eval_board(board, jokers=(12,))
    for idx, line in enumerate(grid_math.LINES):
        if 12 in line:
            assert hands[idx] == 0
    assert hands[0] == 9          # row 0 untouched


def test_floor_never_counts_dead_lines():
    rng = random.Random(7)
    jokers = (0, 6, 12, 18, 24, 4, 20)   # every row and both diagonals hit
    for _ in range(50):
        board, _r = grid_math.deal_with_floor(rng, 1, 30, jokers)
        assert max(grid_math.eval_board(board, jokers)) == 0


def test_vector_joker_mask_matches_scalar():
    rng = np.random.default_rng(3)
    ranks, suits = par_sheet._deal(rng, 400)
    gmask = np.zeros((400, 25), dtype=bool)
    for i in range(400):
        for cell in rng.choice(25, size=int(rng.integers(0, 4)), replace=False):
            gmask[i, cell] = True
    vec = par_sheet._eval_lines(ranks, suits, gmask)
    for i in range(400):
        cards = [int((ranks[i, j] - 2) * 4 + suits[i, j]) for j in range(25)]
        jokers = tuple(int(j) for j in np.flatnonzero(gmask[i]))
        assert list(vec[i]) == grid_math.eval_board(cards, jokers)
