"""Game specific book events (in addition to the SDK's standard events)."""

from copy import deepcopy

from src.events.events import json_ready_sym

UPDATE_LADDER = "updateLadder"
KEG_BLAST = "kegBlast"


def _pad(pos: dict, gamestate) -> dict:
    """Book positions are relative to the padded board (row 0 = hidden top symbol)."""
    offset = 1 if gamestate.config.include_padding else 0
    return {"reel": pos["reel"], "row": pos["row"] + offset}


def _cents(value: float, cap: float) -> int:
    return int(round(min(value, cap) * 100, 0))


def _rung_breakdown(gamestate, rungs: list, total_cents: int) -> list:
    """Display split of a step's win across the rungs it passed (K-4).

    The paid amount is `round(base × Σ multipliers)`, so the per-rung amounts here are a
    presentation breakdown of that single number, not separate payouts: they are shared out
    in proportion to each rung's multiplier and the rounding remainder is given to the last
    rung, so they always add up to exactly what the step paid.
    """
    ladder = gamestate.config.ladder[gamestate.gametype]
    mults = [ladder[j] for j in rungs]
    total_mult = sum(mults)
    out, running = [], 0
    for n, (j, m) in enumerate(zip(rungs, mults)):
        if n == len(rungs) - 1:
            part = total_cents - running
        else:
            part = int(total_cents * m // total_mult)
            running += part
        out.append({"index": j, "multiplier": m, "win": part})
    return out


def win_info_ways_event(
    gamestate, win_data: dict, rungs: list, multiplier: int, kegs: int, next_index: int
) -> None:
    """One cascade step: every symbol that paid, its ways, and the ladder rungs it walked.

    `ladder.rungs` is the complete, contiguous list of rungs the step passed through, in
    order, with what each of them contributed. The presentation replays that list; it never
    works out a multiplier or an amount for itself.
    """
    cap = gamestate.config.wincap
    wins = []
    for win in win_data["wins"]:
        wins.append(
            {
                "symbol": win["symbol"],
                "kind": win["kind"],
                "win": _cents(win["win"], cap),
                "positions": [_pad(p, gamestate) for p in win["positions"]],
                "meta": {
                    "ways": win["meta"]["ways"],
                    "globalMult": multiplier,
                    "winWithoutMult": _cents(win["meta"]["winWithoutMult"], cap),
                },
            }
        )
    total_cents = _cents(win_data["totalWin"], cap)
    gamestate.book.add_event(
        {
            "index": len(gamestate.book.events),
            "type": "winInfo",
            "totalWin": total_cents,
            "wins": wins,
            "ladder": {
                "index": rungs[-1],
                "fromIndex": rungs[0],
                "nextIndex": next_index,
                "multiplier": multiplier,
                "kegs": kegs,
                "rungs": _rung_breakdown(gamestate, rungs, total_cents),
            },
        }
    )


def keg_blast_event(gamestate, positions: list, rungs: list, multiplier: int, next_index: int) -> None:
    """Nitro kegs detonate with a winning step and carry it up one rung each.

    The event names every rung the step walked, so the ladder animation can tick through
    them one by one and pay on each tick without deciding anything itself.
    """
    ladder = gamestate.config.ladder[gamestate.gametype]
    gamestate.book.add_event(
        {
            "index": len(gamestate.book.events),
            "type": KEG_BLAST,
            "positions": [_pad(p, gamestate) for p in positions],
            "fromIndex": rungs[0],
            "toIndex": rungs[-1],
            "nextIndex": next_index,
            "multiplier": multiplier,
            "rungs": [{"index": j, "multiplier": ladder[j]} for j in rungs],
        }
    )


def update_ladder_event(gamestate) -> None:
    """Announce the multiplier the NEXT winning cascade step will use."""
    ladder = gamestate.config.ladder[gamestate.gametype]
    idx = gamestate.ladder_index
    gamestate.book.add_event(
        {
            "index": len(gamestate.book.events),
            "type": UPDATE_LADDER,
            "ladderIndex": idx,
            "multiplier": ladder[idx],
            "steps": len(ladder),
        }
    )


def tumble_board_all_event(gamestate, exploding: list) -> None:
    """Every symbol removed this step (winning symbols + detonated kegs) and what falls in."""
    special_attributes = list(gamestate.config.special_symbols.keys())
    new_symbols = [[] for _ in range(gamestate.config.num_reels)]
    for reel, syms in enumerate(gamestate.new_symbols_from_tumble):
        if syms:
            new_symbols[reel] = [json_ready_sym(s, special_attributes) for s in syms]
    exploding_sorted = sorted(
        ({"reel": p["reel"], "row": p["row"] + (1 if gamestate.config.include_padding else 0)} for p in exploding),
        key=lambda p: (p["reel"], p["row"]),
    )
    gamestate.book.add_event(
        {
            "index": len(gamestate.book.events),
            "type": "tumbleBoard",
            "newSymbols": new_symbols,
            "explodingSymbols": deepcopy(exploding_sorted),
        }
    )
