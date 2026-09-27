"""Math tests for NITRO VEIN.

Run from the math-sdk root:

    PYTHONPATH=. pytest games/nitro_vein/tests -q

The books-replay tests need the published books (`python games/nitro_vein/run.py`);
they are skipped when those have not been generated. They re-implement the ways
evaluator, the cascade rule and the Blast Ladder *independently* of the game code
and replay every sampled book, so a regression in either side is caught.
"""

import csv
import io
import json
import math
import os
import sys

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
GAME_DIR = os.path.dirname(HERE)
sys.path.insert(0, GAME_DIR)
import math_params as P  # noqa: E402

PUBLISH = os.path.join(GAME_DIR, "library", "publish_files")
REELS = os.path.join(GAME_DIR, "reels")
PADDED = P.NUM_ROWS + 2


# --------------------------------------------------------------------------- #
# parameters
# --------------------------------------------------------------------------- #
def test_paytable_is_monotonic_and_covers_every_paying_symbol():
    assert set(P.PAYTABLE) == set(P.PAYING_SYMBOLS)
    for sym, pays in P.PAYTABLE.items():
        assert sorted(pays) == [4, 5], sym
        assert 0 < pays[4] < pays[5], sym
    order = ["H1", "H2", "H3", "H4", "L1", "L2", "L3", "L4", "L5"]
    for a, b in zip(order, order[1:]):
        assert P.PAYTABLE[a][4] >= P.PAYTABLE[b][4], (a, b)


def test_ladders_are_strictly_increasing():
    """Both ladders climb; the free ladder starts above the base one."""
    assert P.LADDER["basegame"][0] == 1
    assert P.LADDER["freegame"][0] > P.LADDER["basegame"][0]
    for name, ladder in P.LADDER.items():
        assert all(b > a for a, b in zip(ladder, ladder[1:])), name


def test_win_levels_are_ascending_and_end_at_the_wincap():
    values = [v for _, v in sorted(P.WIN_LEVELS.items())]
    assert values == sorted(values)
    assert values[-1] == P.WINCAP


def test_distribution_quotas_add_up_to_one():
    q = P.BASE_MODE["quota"]
    assert sum(v for v in q.values() if v is not None) < 1.0
    assert P.BONUS_MODE["quota"] == {"freegame": None}
    assert P.WINCAP == 3000 and P.RTP == pytest.approx(0.96)
    # price derived from the feature's measured value: 94.52x / 0.96 = 98.46x
    assert P.BONUS_COST == pytest.approx(98.5)


def test_no_wincap_criteria_anywhere():
    """The max win has to be produced by the game, never by a forced criteria."""
    assert "wincap" not in P.BASE_MODE["quota"]
    assert "wincap" not in P.BASE_MODE["rtp_share"]
    assert "wincap" not in P.BONUS_MODE["quota"]
    assert "wincap" not in P.BONUS_MODE["rtp_share"]
    assert "FRWCAP" not in P.REEL_WEIGHTS
    assert not hasattr(P, "_WINCAP_WEIGHTS")
    assert not os.path.exists(os.path.join(REELS, "FRWCAP.csv"))


def test_scatters_only_live_on_reels_1_3_5():
    assert P.SCATTER_COUNTS == [3, 0, 2, 0, 2]
    assert len(P.SCATTER_COUNTS) == P.NUM_REELS
    for reel, count in enumerate(P.SCATTER_COUNTS):
        if reel in (1, 3):
            assert count == 0, f"reel {reel + 1} must not carry a scatter"
        else:
            assert count > 0, f"reel {reel + 1} must carry scatters"
    # and the weight tables must not reintroduce them
    for name, per_reel in P.REEL_WEIGHTS.items():
        for reel, weights in per_reel.items():
            assert P.SCATTER not in weights, f"{name} reel {reel} weights a scatter"


def test_paytable_has_no_scale_factor():
    """Payouts are read straight off the table; nothing multiplies them on the way in."""
    assert not hasattr(P, "PAYTABLE_SCALE")
    assert P.PAYOUT_STEP == 0.01


def test_free_spin_tables_only_describe_reachable_states():
    """The board can hold at most 3 scatters, so 4 / 5 entries would be dead weight."""
    assert P.FS_TRIGGER == {3: 10}
    assert P.FS_RETRIGGER == {3: 5}
    assert P.BASE_MODE["scatter_triggers"] == {3: 100}
    assert P.BONUS_MODE["scatter_triggers"] == {3: 100}
    assert not hasattr(P, "FS_MAX_SCATTER_COUNT")


def test_the_board_can_never_show_more_than_three_scatters():
    """Reels 1/3/5 only, spaced MIN_SPACING apart, in a NUM_ROWS window."""
    assert P.MIN_SPACING[P.SCATTER] > P.NUM_ROWS, "two scatters could share a reel"
    reachable = sum(1 for c in P.SCATTER_COUNTS if c > 0)
    assert reachable == 3
    for name in P.REEL_WEIGHTS:
        cols = _strip(name)
        # reels stop independently, so the board maximum is the sum of the per-reel maxima
        per_reel = []
        for col in cols:
            pos = [i for i, sym in enumerate(col) if sym == P.SCATTER]
            per_reel.append(
                max(
                    (sum(1 for p in pos if (p - start) % P.STRIP_LENGTH < P.NUM_ROWS) for start in range(P.STRIP_LENGTH)),
                    default=0,
                )
            )
        assert all(v <= 1 for v in per_reel), f"{name}: a reel can show two scatters {per_reel}"
        assert sum(per_reel) == 3, f"{name}: a board could show {sum(per_reel)} scatters"


# --------------------------------------------------------------------------- #
# reel strips
# --------------------------------------------------------------------------- #
def _strip(name):
    with open(os.path.join(REELS, f"{name}.csv")) as f:
        rows = list(csv.reader(f))
    return [[r[c] for r in rows] for c in range(P.NUM_REELS)]


@pytest.mark.parametrize("name", list(P.REEL_WEIGHTS))
def test_reel_strips_match_the_declared_shape(name):
    cols = _strip(name)
    assert len(cols) == P.NUM_REELS
    known = set(P.PAYING_SYMBOLS) | {P.WILD, P.SCATTER, P.KEG, P.ROCK}
    for reel, col in enumerate(cols):
        assert len(col) == P.STRIP_LENGTH
        assert set(col) <= known
        if reel == 0:
            assert P.WILD not in col, "wilds never land on reel 1"


@pytest.mark.parametrize("name", list(P.REEL_WEIGHTS))
def test_scatter_distribution_on_the_built_strips(name):
    """Every strip carries exactly the declared number of scatters, on reels 1 / 3 / 5 only."""
    cols = _strip(name)
    for reel, col in enumerate(cols):
        assert col.count(P.SCATTER) == P.SCATTER_COUNTS[reel], f"{name} reel {reel + 1}"
    assert sum(col.count(P.SCATTER) for col in cols) == sum(P.SCATTER_COUNTS)


def test_strips_are_reproducible():
    import build_reels

    fresh = build_reels.build_all(write=False)
    for name in P.REEL_WEIGHTS:
        assert fresh[name] == _strip(name), f"{name} differs from build_reels output - rerun build_reels.py"


# --------------------------------------------------------------------------- #
# independent evaluator + book replay
# --------------------------------------------------------------------------- #
def ways(board):
    """board: 5 columns of PADDED symbol names -> {symbol: (kind, ways)} (independent of the SDK)."""
    out = {}
    for sym in P.PAYING_SYMBOLS:
        counts = []
        for reel in range(P.NUM_REELS):
            c = sum(1 for r in range(1, P.NUM_ROWS + 1) if board[reel][r] in (sym, P.WILD))
            if c == 0:
                break
            counts.append(c)
        if len(counts) >= 4:
            out[sym] = (len(counts), math.prod(counts))
    return out


def tumble(board, new_symbols, exploding):
    gone = {(p["reel"], p["row"]) for p in exploding}
    out = []
    for reel in range(P.NUM_REELS):
        kept = [s for row, s in enumerate(board[reel]) if (reel, row) not in gone]
        out.append([s["name"] for s in new_symbols[reel]] + kept)
    return out


def _books(mode, limit):
    path = os.path.join(PUBLISH, f"books_{mode}.jsonl.zst")
    if not os.path.exists(path):
        pytest.skip("books not generated - run games/nitro_vein/run.py")
    zstandard = pytest.importorskip("zstandard")
    n = 0
    with open(path, "rb") as f:
        reader = io.TextIOWrapper(zstandard.ZstdDecompressor().stream_reader(f), encoding="utf-8")
        for line in reader:
            yield json.loads(line)
            n += 1
            if n >= limit:
                return


def replay(book):
    """Replay one book with the independent rules. Returns a list of problems."""
    problems = []
    events = book["events"]
    if events[0]["type"] != "reveal" or events[-1]["type"] != "finalWin":
        return ["book does not open with reveal / close with finalWin"]
    if any(e["type"] == "wincap" for e in events):
        return []  # the cap truncates the sequence on purpose
    if events[-1]["amount"] != book["payoutMultiplier"]:
        problems.append("finalWin != payoutMultiplier")
    if book["payoutMultiplier"] > P.WINCAP * 100:
        problems.append("payout above the wincap")

    board = None
    game = None
    idx = 0
    running = 0
    for e in events:
        t = e["type"]
        if t == "reveal":
            board = [[s["name"] for s in col] for col in e["board"]]
            idx = 0  # the ladder resets at the start of every spin, base and free alike
            game = e["gameType"]
        elif t == "winInfo":
            expected = ways(board)
            got = {w["symbol"]: (w["kind"], w["meta"]["ways"]) for w in e["wins"]}
            if expected != got:
                problems.append(f"winInfo {got} != independent evaluator {expected}")
                return problems
            kegs = sum(col[r] == P.KEG for col in board for r in range(1, P.NUM_ROWS + 1))  # visible rows only
            table = P.LADDER["freegame" if game == "freegame" else "basegame"]
            top = len(table) - 1
            # K-4: the step walks rungs idx .. min(idx + kegs, top) and pays once per rung
            rungs = list(range(min(idx, top), min(idx + kegs, top) + 1))
            mult = sum(table[j] for j in rungs)
            lad = e["ladder"]
            if lad["multiplier"] != mult or lad["kegs"] != kegs:
                problems.append(f"ladder {lad} != expected mult {mult} kegs {kegs} (idx {idx})")
                return problems
            if [r["index"] for r in lad["rungs"]] != rungs:
                problems.append(f"rung sequence {lad['rungs']} != {rungs}")
                return problems
            if lad["fromIndex"] != rungs[0] or lad["index"] != rungs[-1]:
                problems.append(f"rung bounds {lad['fromIndex']}..{lad['index']} != {rungs[0]}..{rungs[-1]}")
            if sum(r["win"] for r in lad["rungs"]) != e["totalWin"]:
                problems.append("rung breakdown does not add up to the step total")
            if lad["nextIndex"] != min(rungs[-1] + 1, top):
                problems.append(f"nextIndex {lad['nextIndex']} != {min(rungs[-1] + 1, top)}")
            step_total = 0
            for w in e["wins"]:
                per_way = P.PAYTABLE[w["symbol"]][w["kind"]]
                base = round(per_way * w["meta"]["ways"] * 100)
                if abs(w["meta"]["winWithoutMult"] - base) > 1:
                    problems.append(f"winWithoutMult {w['meta']['winWithoutMult']} != {base}")
                step_total += w["win"]
            if abs(step_total - e["totalWin"]) > 0:
                problems.append("winInfo.totalWin != sum(wins)")
            running += e["totalWin"]
            idx = min(rungs[-1] + 1, top)
        elif t == "tumbleBoard":
            board = tumble(board, e["newSymbols"], e["explodingSymbols"])
            if any(len(col) != PADDED for col in board):
                problems.append("tumble left a column with the wrong height")
                return problems
        elif t == "updateTumbleWin":
            if e["amount"] < 0:
                problems.append("negative running win")
    return problems


@pytest.mark.parametrize("mode,limit", [("base", 6000), ("bonus", 1500)])
def test_books_replay_against_the_independent_rules(mode, limit):
    bad = []
    for book in _books(mode, limit):
        problems = replay(book)
        if problems:
            bad.append((book["id"], problems[0]))
    assert not bad, f"{len(bad)} books failed, first: {bad[:5]}"


def test_no_book_ends_with_a_winning_board():
    """Cascades must run until the board has no ways win left."""
    bad = []
    for book in _books("base", 3000):
        board = None
        for e in book["events"]:
            if e["type"] == "reveal":
                board = [[s["name"] for s in col] for col in e["board"]]
                # the board settles below; checked when the next reveal / the end arrives
            elif e["type"] == "tumbleBoard":
                board = tumble(board, e["newSymbols"], e["explodingSymbols"])
        if any(e["type"] == "wincap" for e in book["events"]):
            continue
        if board is not None and ways(board):
            bad.append(book["id"])
    assert not bad, f"books left with a winning board: {bad[:10]}"


def test_lookup_tables_match_the_books():
    for mode in ("base", "bonus"):
        lut = os.path.join(PUBLISH, f"lookUpTable_{mode}_0.csv")
        if not os.path.exists(lut):
            pytest.skip("LUT not generated")
        with open(lut) as f:
            rows = [tuple(map(int, r)) for r in csv.reader(f)]
        payouts = {}
        for book in _books(mode, 10**9 if mode == "bonus" else 20000):
            payouts[book["id"]] = book["payoutMultiplier"]
        for i, weight, payout in rows:
            if i in payouts:
                assert payouts[i] == payout, (mode, i)
            assert weight >= 0


# --------------------------------------------------------------------------- #
# K-4 on the production code path
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="module")
def calc():
    """A real GameState, so the rule is tested where the game actually executes it."""
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    sys.path.insert(0, os.path.abspath(os.path.join(GAME_DIR, "..", "..")))
    from game_config import GameConfig
    from gamestate import GameState

    config = GameConfig()
    gs = GameState(config)
    gs.gametype = config.basegame_type
    return gs


def _k4(gs, index, kegs):
    rungs = gs.k4_rungs(index, kegs)
    return rungs, gs.k4_multiplier(rungs), gs.k4_next_index(rungs)


def test_k4_zero_kegs_pays_one_rung_and_moves_one(calc):
    table = P.LADDER["basegame"]
    for i in range(len(table)):
        rungs, mult, nxt = _k4(calc, i, 0)
        assert rungs == [i]
        assert mult == table[i]
        assert nxt == min(i + 1, len(table) - 1)


@pytest.mark.parametrize("kegs", [1, 2, 3])
def test_k4_small_keg_counts(calc, kegs):
    table = P.LADDER["basegame"]
    rungs, mult, nxt = _k4(calc, 0, kegs)
    assert rungs == list(range(0, kegs + 1))
    assert mult == sum(table[j] for j in rungs)
    assert nxt == kegs + 1


def test_k4_named_example_from_the_brief(calc):
    """Start on x2 with 2 kegs -> the step walks x2, x3, x5 and pays 2 + 3 + 5."""
    rungs, mult, nxt = _k4(calc, 1, 2)
    assert [P.LADDER["basegame"][j] for j in rungs] == [2, 3, 5]
    assert mult == 10
    assert P.LADDER["basegame"][nxt] == 10


def test_k4_never_skips_and_never_pays_a_rung_twice(calc):
    for gametype in ("basegame", "freegame"):
        calc.gametype = gametype
        table = P.LADDER[gametype]
        top = len(table) - 1
        for i in range(len(table)):
            for kegs in range(0, 31):
                rungs, mult, nxt = _k4(calc, i, kegs)
                assert rungs, (gametype, i, kegs)
                assert len(set(rungs)) == len(rungs), "a rung was paid twice"
                assert rungs == list(range(rungs[0], rungs[-1] + 1)), "a rung was skipped"
                assert rungs[0] == min(i, top)
                assert rungs[-1] == min(i + kegs, top)
                assert mult == sum(table[j] for j in rungs)
                assert nxt == min(rungs[-1] + 1, top)
                assert nxt >= rungs[0], "the ladder moved backwards"
    calc.gametype = "basegame"


def test_k4_respects_the_ladder_cap(calc):
    table = P.LADDER["basegame"]
    top = len(table) - 1
    # a board can hold at most NUM_REELS * NUM_ROWS kegs
    max_kegs = P.NUM_REELS * P.NUM_ROWS
    assert max_kegs == 30
    rungs, mult, nxt = _k4(calc, 0, max_kegs)
    assert rungs == list(range(0, top + 1)), "30 kegs must walk the whole ladder, once each"
    assert mult == sum(table)
    assert nxt == top
    # from the top rung the step pays the top rung once, whatever the keg count
    for kegs in (0, 1, 5, 30):
        rungs, mult, nxt = _k4(calc, top, kegs)
        assert rungs == [top]
        assert mult == table[top]
        assert nxt == top


def test_k4_multiplier_is_the_sum_not_the_top_rung(calc):
    """The whole point of K-4: passing rungs pays for each of them, not just the last."""
    table = P.LADDER["basegame"]
    rungs, mult, _ = _k4(calc, 0, 3)
    assert mult == table[0] + table[1] + table[2] + table[3]
    assert mult > table[3], "a step that walked four rungs must pay more than the top one alone"
