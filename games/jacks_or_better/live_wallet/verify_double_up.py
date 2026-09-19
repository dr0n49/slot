#!/usr/bin/env python3
"""Verify live-hold health + double-up scenarios (local dev wallet only)."""

from __future__ import annotations

import json
import random
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from poker.constants import Category, HAND_SIZE, N_CARDS  # noqa: E402
from poker.evaluator import evaluate_category, payout  # noqa: E402
from poker.live_double_up import LIVE_DOUBLE_UP_MAX_CHAIN, is_double_up_eligible, resolve_colour_pick  # noqa: E402
from poker.solver import _split_hold  # noqa: E402

from live_wallet import server  # noqa: E402
from live_wallet.live_round import complete_hold_draw  # noqa: E402

BASE = "http://127.0.0.1:8787"
SESSION = "verify-script"


def _post(path: str, body: dict) -> dict:
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps({"sessionID": SESSION, **body}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read())


def _get(path: str) -> dict:
    with urllib.request.urlopen(f"{BASE}{path}", timeout=5) as resp:
        return json.loads(resp.read())


def find_flush_round() -> tuple[tuple[int, ...], list[int], int]:
    """Return deal, remaining, hold_mask that completes to Flush+."""
    rng = random.Random(42)
    for _ in range(5000):
        deck = list(range(N_CARDS))
        rng.shuffle(deck)
        deal = tuple(deck[:HAND_SIZE])
        remaining = deck[HAND_SIZE:]
        for mask in range(32):
            result = complete_hold_draw(deal, remaining, mask)
            if result["pokerWin"] > 0 and is_double_up_eligible(result["categoryId"]):
                if result["category"] == "Flush":
                    return deal, remaining, mask
    raise RuntimeError("could not find flush round in 5000 tries")


def seed_session_flush(deal, remaining, hold_mask, du_seed: int) -> None:
    sess = server._session(SESSION)
    sess["balance"] = server.STARTING_BALANCE
    deal_event = {"index": 0, "type": "deal", "cards": server._cards_payload(deal)}
    public = {
        "roundID": 1,
        "amount": server.DEFAULT_BET,
        "payout": 0,
        "payoutMultiplier": 0,
        "active": True,
        "mode": "liveHold",
        "event": "0",
        "state": [deal_event],
        "awaitingHold": True,
        "awaitingDoubleUp": False,
    }
    sess["round"] = {
        "deal": deal,
        "remaining": remaining,
        "du_seed": du_seed,
        "amount": server.DEFAULT_BET,
        "awaitingHold": True,
        "awaitingDoubleUp": False,
        "events": [deal_event],
        "eventIndex": 1,
        "currentWin": 0.0,
        "duStep": 0,
        "public": public,
    }


def pick_choice_for_outcome(du_seed: int, want_win: bool) -> str:
    rng = random.Random(du_seed)
    for choice in ("red", "black"):
        card, colour, correct = resolve_colour_pick(rng, choice)
        if correct == want_win:
            return choice
    return "red"


def run_double_up_chain(
    label: str,
    choices: list[str],
) -> dict:
    deal, remaining, mask = find_flush_round()
    du_seed = 12345
    seed_session_flush(deal, remaining, mask, du_seed)
    hold_resp = server.handle_action({"sessionID": SESSION, "action": "DECISION", "meta": {"phase": "hold", "holdMask": mask}})
    assert hold_resp["action"]["awaitingDoubleUp"], f"{label}: expected double-up offer"
    base_win = hold_resp["debug"]["playerPokerWin"]
    amount_at_risk = hold_resp["action"]["doubleUpOffer"]["amountAtRisk"]
    print(f"\n[{label}] Flush base win {base_win}× ({amount_at_risk} cents at risk)")

    for i, choice in enumerate(choices):
        resp = server.handle_action(
            {"sessionID": SESSION, "action": "DECISION", "meta": {"phase": "doubleUp", "choice": choice}}
        )
        action = resp["action"]
        if choice == "collect":
            assert action.get("payoutMultiplier", 0) == int(round(base_win * 100)), f"{label}: collect mismatch"
            print(f"  collect → locked {action['payoutMultiplier']} cents")
            return resp
        du_events = [e for e in action["state"] if e["type"] == "doubleUp"]
        last = du_events[-1]
        print(f"  stage {last['step']}: picked {choice} → card {last['card']} ({last['colour']}) correct={last['correct']}")
        if not last["correct"]:
            assert action.get("payoutMultiplier", 0) == 0
            return resp
        base_win = last["amountAfter"] / 100
        if action.get("awaitingDoubleUp"):
            continue
        assert action.get("payoutMultiplier", 0) == last["amountAfter"]
        print(f"  chain complete → locked {action['payoutMultiplier']} cents")
        return resp
    return resp


def test_health_immediate() -> None:
    health = _get("/health")
    assert health.get("readyForPlay") is True, health
    assert health.get("status") == "ready", health
    print("GET /health → readyForPlay=true (immediate after bind)")


def test_play_immediate() -> None:
    _post("/wallet/authenticate", {})
    play = _post("/wallet/play", {"amount": server.DEFAULT_BET, "mode": "liveHold"})
    assert play.get("round", {}).get("awaitingHold"), play
    print("POST /wallet/play → awaitingHold (immediate after bind)")


def main() -> None:
    print("=== HTTP smoke (wallet must be running) ===")
    try:
        test_health_immediate()
        test_play_immediate()
    except urllib.error.URLError as exc:
        print(f"SKIP HTTP smoke — wallet not running: {exc}")
        print("Start: cd games/jacks_or_better && ../../.venv/bin/python live_wallet/server.py")

    print("\n=== In-process double-up scenarios ===")
    run_double_up_chain("Flush → collect immediately", ["collect"])
    win_choice = pick_choice_for_outcome(12345, True)
    run_double_up_chain("Flush → win stage 1 → collect", [win_choice, "collect"])
    win1 = pick_choice_for_outcome(12345, True)
    # After one win, du_rng advanced — re-seed for stage 2 from fresh hold
    deal, remaining, mask = find_flush_round()
    seed_session_flush(deal, remaining, mask, 99991)
    server.handle_action({"sessionID": SESSION, "action": "DECISION", "meta": {"phase": "hold", "holdMask": mask}})
    w1 = pick_choice_for_outcome(99991, True)
    resp1 = server.handle_action({"sessionID": SESSION, "action": "DECISION", "meta": {"phase": "doubleUp", "choice": w1}})
    assert resp1["action"]["awaitingDoubleUp"]
    w2 = pick_choice_for_outcome(99991, True)  # rng already consumed one draw; need current du_rng state
    # Use server's stored rng after first win
    rnd = server._session(SESSION)["round"]
    du_rng = rnd["du_rng"]
    # brute force winning choice for next stage
    w2 = None
    for c in ("red", "black"):
        probe = random.Random()
        probe.setstate(du_rng.getstate())
        _, _, ok = resolve_colour_pick(probe, c)
        if ok:
            w2 = c
            break
    assert w2
    resp2 = server.handle_action({"sessionID": SESSION, "action": "DECISION", "meta": {"phase": "doubleUp", "choice": w2}})
    assert resp2["action"].get("payoutMultiplier", 0) > 0
    du = [e for e in resp2["action"]["state"] if e["type"] == "doubleUp"]
    print(f"\n[Flush → win both stages (n={LIVE_DOUBLE_UP_MAX_CHAIN})] locked {resp2['action']['payoutMultiplier']} cents after {len(du)} stages")

    print("\nAll verification scenarios passed.")


if __name__ == "__main__":
    main()
