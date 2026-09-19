#!/usr/bin/env python3
"""Verify live-hold bonus-buy: combinatorics, Monte Carlo RTP, HTTP playthroughs."""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from live_wallet.bonus_deal import bonus_combinatorial_stats, simulate_bonus  # noqa: E402

BASE = "http://127.0.0.1:8787"
SESSION = "verify-bonus"
BET = 1_000_000


def post(path: str, body: dict) -> dict:
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps({"sessionID": SESSION, **body}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())


def playthrough_bonus1_job_only(max_tries: int = 500) -> dict | None:
    """Bonus 1 landing on JoB (sub-Flush, auto-settle)."""
    post("/wallet/authenticate", {})
    for _ in range(max_tries):
        play = post("/wallet/play", {"amount": BET, "mode": "liveHoldBonus1"})
        rnd = play["round"]
        assert not rnd.get("awaitingHold"), "bonus must skip hold"
        cat = next(e for e in rnd["state"] if e["type"] == "handResult")["category"]
        if cat == "Jacks or Better":
            assert not rnd.get("awaitingDoubleUp")
            assert rnd.get("payoutMultiplier", 0) == 100
            end = post("/wallet/end-round", {})
            return {"category": cat, "payoutMult": rnd["payoutMultiplier"], "balance": end["balance"]["amount"]}
        post("/wallet/end-round", {})
    return None


def playthrough_bonus1_higher(max_tries: int = 200) -> dict | None:
    """Bonus 1 landing Two Pair or better (still sub-Flush)."""
    post("/wallet/authenticate", {})
    for _ in range(max_tries):
        play = post("/wallet/play", {"amount": BET, "mode": "liveHoldBonus1"})
        rnd = play["round"]
        cat = next(e for e in rnd["state"] if e["type"] == "handResult")["category"]
        if cat == "Two Pair" and not rnd.get("awaitingDoubleUp"):
            end = post("/wallet/end-round", {})
            return {"category": cat, "payoutMult": rnd["payoutMultiplier"], "balance": end["balance"]["amount"]}
        if rnd.get("awaitingDoubleUp"):
            post("/bet/action", {"action": "DECISION", "meta": {"phase": "doubleUp", "choice": "collect"}})
        post("/wallet/end-round", {})
    return None


def playthrough_bonus2_double_up(max_tries: int = 500) -> dict | None:
    """Bonus 2 reaching double-up; player picks red."""
    post("/wallet/authenticate", {})
    for _ in range(max_tries):
        play = post("/wallet/play", {"amount": BET, "mode": "liveHoldBonus2"})
        rnd = play["round"]
        cat = next(e for e in rnd["state"] if e["type"] == "handResult")["category"]
        if rnd.get("awaitingDoubleUp"):
            du = post("/bet/action", {"action": "DECISION", "meta": {"phase": "doubleUp", "choice": "red"}})
            action = du["action"]
            du_ev = [e for e in action["state"] if e["type"] == "doubleUp"]
            end = post("/wallet/end-round", {})
            return {
                "category": cat,
                "choice": "red",
                "doubleUpEvents": du_ev,
                "finalPayoutMult": action.get("payoutMultiplier"),
                "balance": end["balance"]["amount"],
            }
        post("/wallet/end-round", {})
    return None


def simulate_http_bonus(mode: str, n: int, price_mult: int) -> dict:
    post("/wallet/authenticate", {})
    total_payout = 0
    for i in range(n):
        play = post("/wallet/play", {"amount": BET, "mode": mode})
        rnd = play["round"]
        if rnd.get("awaitingDoubleUp"):
            post("/bet/action", {"action": "DECISION", "meta": {"phase": "doubleUp", "choice": "collect"}})
            rnd = post("/bet/action", {})  # wrong - need to get from collect response
        # collect path
        if rnd.get("awaitingDoubleUp"):
            c = post("/bet/action", {"action": "DECISION", "meta": {"phase": "doubleUp", "choice": "collect"}})
            pm = c["action"].get("payoutMultiplier", 0)
        else:
            pm = rnd.get("payoutMultiplier", 0)
        total_payout += pm
        post("/wallet/end-round", {})
    avg = (total_payout / 100) / n
    rtp = avg / price_mult
    return {"trials": n, "avg_payout_mult": avg, "realized_rtp": rtp}


def simulate_http_bonus_fixed(mode: str, n: int, price_mult: int) -> dict:
    post("/wallet/authenticate", {})
    total_payout_mult = 0.0
    for _ in range(n):
        play = post("/wallet/play", {"amount": BET, "mode": mode})
        rnd = play["round"]
        if rnd.get("awaitingDoubleUp"):
            c = post("/bet/action", {"action": "DECISION", "meta": {"phase": "doubleUp", "choice": "collect"}})
            pm = c["action"].get("payoutMultiplier", 0) / 100
        else:
            pm = rnd.get("payoutMultiplier", 0) / 100
        total_payout_mult += pm
        post("/wallet/end-round", {})
    avg = total_payout_mult / n
    return {"trials": n, "avg_payout_mult": avg, "realized_rtp": avg / price_mult}


def main() -> None:
    stats = bonus_combinatorial_stats()
    print("=== INDEPENDENT COMBINATORIAL VERIFICATION ===")
    print(f"JoB+ qualifying rate:     {stats['job_qualify_rate']*100:.4f}% ({stats['job_qualifying_hands']:,} / 2,598,960)")
    print(f"Flush+ qualifying rate:   {stats['flush_qualify_rate']*100:.4f}% ({stats['flush_qualifying_hands']:,} / 2,598,960)")
    print(f"Bonus 1 conditional EV:     {stats['job_conditional_ev']:.6f}x")
    print(f"Bonus 2 conditional EV:     {stats['flush_conditional_ev']:.6f}x")
    print(f"Bonus 1 RTP @ 2x price:     {stats['bonus1_rtp_at_price']*100:.4f}%")
    print(f"Bonus 2 RTP @ 10x price:    {stats['bonus2_rtp_at_price']*100:.4f}%")
    print(f"Rejection E[attempts] B1:   {stats['job_rejection_expected_attempts']:.4f}")

    print("\n=== MONTE CARLO (hand sample only, instant collect) ===")
    for kind, mult, label in [("job", 2, "Bonus 1"), ("flush", 10, "Bonus 2")]:
        sim = simulate_bonus(kind, 10_000, seed=7)
        print(f"{label} 10k: avg={sim['avg_payout_mult']:.6f}x RTP={sim['realized_rtp']*100:.4f}%")

    try:
        print("\n=== HTTP WALLET SIMULATION (10,000 each, collect at double-up) ===")
        h1 = simulate_http_bonus_fixed("liveHoldBonus1", 10_000, 2)
        h2 = simulate_http_bonus_fixed("liveHoldBonus2", 10_000, 10)
        print(f"Bonus 1 HTTP 10k: avg={h1['avg_payout_mult']:.6f}x RTP={h1['realized_rtp']*100:.4f}%")
        print(f"Bonus 2 HTTP 10k: avg={h2['avg_payout_mult']:.6f}x RTP={h2['realized_rtp']*100:.4f}%")

        print("\n=== PLAYTHROUGHS ===")
        p1 = playthrough_bonus1_job_only()
        print(f"Bonus 1 → JoB:           {p1}")
        p2 = playthrough_bonus1_higher()
        print(f"Bonus 1 → Two Pair+:     {p2}")
        p3 = playthrough_bonus2_double_up()
        print(f"Bonus 2 → Flush+ DU red: {p3}")
    except urllib.error.URLError as exc:
        print(f"\nSKIP HTTP tests — wallet not running: {exc}")

    print("\nDone.")


if __name__ == "__main__":
    main()
