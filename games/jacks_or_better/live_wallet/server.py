"""Local NON-PRODUCTION / NON-ENGINE stateful wallet for live-hold learning.

Start:  python live_wallet/server.py
Default: http://127.0.0.1:8787
"""

from __future__ import annotations

import json
import os
import random
import sys
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from poker.constants import CATEGORY_NAMES, HAND_SIZE, N_CARDS, PAYTABLE_7_5, Category  # noqa: E402
from poker.contain_sums import build_contain_sums  # noqa: E402
from poker.evaluator import card_str, evaluate_category, payout  # noqa: E402
from poker.live_double_up import (  # noqa: E402
    LIVE_DOUBLE_UP_MAX_CHAIN,
    is_double_up_eligible,
    resolve_colour_pick,
)
from poker.solver import _split_hold, best_hold  # noqa: E402

from live_wallet.bonus_deal import evaluate_bonus_hand, sample_bonus_hand  # noqa: E402
from live_wallet.live_round import complete_hold_draw  # noqa: E402

BONUS_MODES = {
    "liveHoldBonus1": ("job", 2),
    "liveHoldBonus2": ("flush", 10),
}

HOST = "127.0.0.1"
PORT = 8787
API_AMOUNT_MULTIPLIER = 1_000_000
STARTING_BALANCE = 1_000 * API_AMOUNT_MULTIPLIER
DEFAULT_BET = 1 * API_AMOUNT_MULTIPLIER

_lock = threading.Lock()
_ie_lock = threading.Lock()
_sessions: dict[str, dict[str, Any]] = {}
_ready: dict[str, Any] = {
    "startedAt": time.time(),
    "pid": os.getpid(),
    "listening": False,
    "tablesReady": False,
    "tablesError": None,
}
_IE_TABLES: tuple | None = None


def _log(msg: str) -> None:
    sys.stderr.write(f"[live-wallet pid={os.getpid()}] {msg}\n")
    sys.stderr.flush()


def _cards_payload(cards) -> list[dict]:
    return [{"card": card_str(c)} for c in cards]


def _ie_tables() -> tuple:
    global _IE_TABLES
    if _IE_TABLES is not None:
        return _IE_TABLES
    with _ie_lock:
        if _IE_TABLES is None:
            _log("building contain-sum tables (debug optimal-hold)...")
            binom, pay, royal, win, *_rest = build_contain_sums()
            _IE_TABLES = (binom, pay, royal, win)
            _ready["tablesReady"] = True
            _log("contain-sum tables ready")
    return _IE_TABLES


def _warm_tables_background() -> None:
    try:
        _ie_tables()
    except Exception as exc:
        _ready["tablesError"] = repr(exc)
        _log(f"FATAL: contain-sum table build failed: {exc}\n{traceback.format_exc()}")


def _best_hold_mask(deal: tuple[int, ...]) -> int:
    binom, pay, royal, win = _ie_tables()
    mask, *_ = best_hold(deal, binom, pay, royal, win, None)
    return int(mask)


def _poker_win_same_deck(deal: tuple[int, ...], remaining: list[int], mask: int) -> tuple[str, float]:
    held, _disc = _split_hold(deal, mask)
    n_draw = HAND_SIZE - len(held)
    drawn = remaining[:n_draw]
    draw_i = 0
    final: list[int] = []
    for i in range(HAND_SIZE):
        if mask & (1 << i):
            final.append(int(deal[i]))
        else:
            final.append(int(drawn[draw_i]))
            draw_i += 1
    cat = evaluate_category(final)
    return CATEGORY_NAMES[int(cat)], float(payout(final))


def _base_events_from_hold(result: dict, start_index: int = 1) -> tuple[list[dict], int]:
    events: list[dict] = []
    idx = start_index
    events.append(
        {
            "index": idx,
            "type": "hold",
            "holdMask": result["holdMask"],
            "held": _cards_payload(result["held"]),
        }
    )
    idx += 1
    events.append(
        {
            "index": idx,
            "type": "draw",
            "drawn": _cards_payload(result["drawn"]),
            "finalHand": _cards_payload(result["finalHand"]),
        }
    )
    idx += 1
    events.append(
        {
            "index": idx,
            "type": "handResult",
            "category": result["category"],
            "amount": int(round(result["pokerWin"] * 100, 0)),
        }
    )
    idx += 1
    return events, idx


def _append_settle(events: list[dict], idx: int, final_win: float) -> int:
    amount = int(round(final_win * 100, 0))
    events.append({"index": idx, "type": "setTotalWin", "amount": amount})
    idx += 1
    events.append({"index": idx, "type": "finalWin", "amount": amount})
    return idx + 1


def _session(session_id: str) -> dict[str, Any]:
    if session_id not in _sessions:
        _sessions[session_id] = {
            "balance": STARTING_BALANCE,
            "round": None,
        }
    return _sessions[session_id]


def _paytable_rows() -> list[dict[str, Any]]:
    """Paytable rows from the configured evaluator table (same source as payout())."""
    rows: list[dict[str, Any]] = []
    for cat in reversed(Category):
        if cat == Category.NOTHING:
            continue
        rows.append({"name": CATEGORY_NAMES[cat], "multiplier": int(PAYTABLE_7_5[cat])})
    return rows


def handle_paytable() -> dict:
    return {"paytable": _paytable_rows(), "devWallet": True}


def handle_health() -> dict:
    uptime_ms = int((time.time() - _ready["startedAt"]) * 1000)
    listening = bool(_ready.get("listening"))
    return {
        "status": "ready" if listening else "starting",
        "readyForPlay": listening,
        "readyForDecision": listening,
        "tablesReady": bool(_ready.get("tablesReady")),
        "tablesError": _ready.get("tablesError"),
        "bonusBuySupported": True,
        "bonusModes": list(BONUS_MODES.keys()),
        "pid": os.getpid(),
        "uptimeMs": uptime_ms,
        "devWallet": True,
    }


def handle_authenticate(body: dict) -> dict:
    sid = body.get("sessionID") or "live-dev"
    if body.get("resetBalance"):
        _sessions.pop(sid, None)
    sess = _session(sid)
    round_obj = sess["round"]["public"] if sess.get("round") else None
    return {
        "balance": {"amount": sess["balance"], "currency": "USD"},
        "config": {
            "minBet": 100_000,
            "maxBet": 1_000_000_000,
            "stepBet": 10_000,
            "defaultBetLevel": DEFAULT_BET,
            "betLevels": [DEFAULT_BET],
        },
        "paytable": _paytable_rows(),
        "round": round_obj,
        "devWallet": True,
        "warning": "LOCAL DEV WALLET — not Stake Engine, not RGS-compliant, not approval-ready.",
    }


def handle_play(body: dict) -> dict:
    sid = body.get("sessionID") or "live-dev"
    mode = body.get("mode") or "liveHold"
    base_amount = int(body.get("amount") or DEFAULT_BET)

    if str(mode).startswith("liveHoldBonus") and mode not in BONUS_MODES:
        return {
            "error": "ERR_VAL",
            "status": {
                "statusCode": "ERR_VAL",
                "statusMessage": f"unknown bonus mode {mode!r} — restart live_wallet/server.py",
            },
        }

    if mode in BONUS_MODES:
        bonus_kind, price_mult = BONUS_MODES[mode]
        return _handle_play_bonus(sid, base_amount, bonus_kind, price_mult, mode)

    amount = base_amount
    sess = _session(sid)
    if sess["balance"] < amount:
        return {"error": "ERR_IPB", "status": {"statusCode": "ERR_IPB"}}
    rnd = sess.get("round")
    if rnd and rnd.get("locked"):
        return {
            "error": "ERR_BE",
            "status": {"statusCode": "ERR_BE", "statusMessage": "round still open — end-round first"},
        }
    if rnd and (rnd.get("awaitingHold") or rnd.get("awaitingDoubleUp")):
        sess["balance"] += int(rnd.get("charge") or rnd["amount"])
        sess["round"] = None

    sess["balance"] -= amount
    rng = random.Random()
    deck = list(range(N_CARDS))
    rng.shuffle(deck)
    deal = tuple(deck[:HAND_SIZE])
    remaining = deck[HAND_SIZE:]
    du_seed = rng.randrange(2**62)

    deal_event = {"index": 0, "type": "deal", "cards": _cards_payload(deal)}
    public = {
        "roundID": rng.randrange(1, 10**9),
        "amount": amount,
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
        "amount": amount,
        "awaitingHold": True,
        "awaitingDoubleUp": False,
        "events": [deal_event],
        "eventIndex": 1,
        "currentWin": 0.0,
        "duStep": 0,
        "public": public,
    }
    return {
        "balance": {"amount": sess["balance"], "currency": "USD"},
        "round": public,
        "devWallet": True,
    }


def _handle_play_bonus(
    sid: str,
    base_amount: int,
    bonus_kind: str,
    price_mult: int,
    mode: str,
) -> dict:
    """Bonus buy: debit charge = price_mult × base_amount upfront; wins use base_amount × paytable."""
    charge = base_amount * price_mult
    sess = _session(sid)
    if sess["balance"] < charge:
        return {"error": "ERR_IPB", "status": {"statusCode": "ERR_IPB"}}
    rnd = sess.get("round")
    if rnd and rnd.get("locked"):
        return {
            "error": "ERR_BE",
            "status": {"statusCode": "ERR_BE", "statusMessage": "round still open — end-round first"},
        }
    if rnd and (rnd.get("awaitingHold") or rnd.get("awaitingDoubleUp")):
        sess["balance"] += int(rnd.get("charge") or rnd["amount"])
        sess["round"] = None

    sess["balance"] -= charge
    rng = random.Random()
    final_hand = sample_bonus_hand(bonus_kind, rng)
    result = evaluate_bonus_hand(final_hand)
    cat_id = result["categoryId"]
    poker_win = result["pokerWin"]
    cat_name = result["category"]

    deal_event = {"index": 0, "type": "deal", "cards": _cards_payload(final_hand)}
    events: list[dict] = [deal_event]
    idx = 1
    events.append(
        {
            "index": idx,
            "type": "handResult",
            "category": cat_name,
            "amount": int(round(poker_win * 100, 0)),
        }
    )
    idx += 1

    public = {
        "roundID": rng.randrange(1, 10**9),
        "amount": base_amount,
        "charge": charge,
        "payout": 0,
        "payoutMultiplier": 0,
        "active": True,
        "mode": mode,
        "bonusBuy": bonus_kind,
        "event": "0",
        "state": events,
        "awaitingHold": False,
        "awaitingDoubleUp": False,
    }
    rnd = {
        "deal": final_hand,
        "remaining": [],
        "du_seed": rng.randrange(2**62),
        "amount": base_amount,
        "charge": charge,
        "bonusBuy": bonus_kind,
        "awaitingHold": False,
        "awaitingDoubleUp": False,
        "events": events,
        "eventIndex": idx,
        "currentWin": 0.0,
        "duStep": 0,
        "public": public,
        "locked": False,
    }

    if poker_win > 0 and is_double_up_eligible(cat_id):
        public = _offer_double_up(rnd, events, poker_win, cat_name)
    else:
        _append_settle(events, idx, poker_win)
        public = _lock_round_public(rnd, events, poker_win)

    sess["round"] = rnd
    return {
        "balance": {"amount": sess["balance"], "currency": "USD"},
        "round": public,
        "devWallet": True,
    }


def _lock_round_public(rnd: dict, events: list[dict], final_win: float) -> dict:
    payout_mult = int(round(final_win * 100, 0))
    public = {
        **rnd["public"],
        "payout": int(rnd["amount"] * final_win),
        "payoutMultiplier": payout_mult,
        "active": True,
        "state": events,
        "awaitingHold": False,
        "awaitingDoubleUp": False,
    }
    rnd["public"] = public
    rnd["events"] = events
    rnd["awaitingHold"] = False
    rnd["awaitingDoubleUp"] = False
    rnd["locked"] = True
    rnd["currentWin"] = final_win
    return public


def _offer_double_up(rnd: dict, events: list[dict], poker_win: float, category: str) -> dict:
    rnd["awaitingHold"] = False
    rnd["awaitingDoubleUp"] = True
    rnd["currentWin"] = poker_win
    rnd["duStep"] = 1
    rnd["events"] = events
    rnd["du_rng"] = random.Random(rnd["du_seed"])
    public = {
        **rnd["public"],
        "payout": 0,
        "payoutMultiplier": 0,
        "active": True,
        "state": events,
        "awaitingHold": False,
        "awaitingDoubleUp": True,
        "doubleUpOffer": {
            "step": 1,
            "maxSteps": LIVE_DOUBLE_UP_MAX_CHAIN,
            "amountAtRisk": int(round(poker_win * 100, 0)),
            "category": category,
        },
    }
    rnd["public"] = public
    return public


def handle_action_hold(sess: dict, rnd: dict, meta: dict) -> dict:
    if meta.get("auto"):
        hold_mask = _best_hold_mask(rnd["deal"])
    else:
        hold_mask = int(meta.get("holdMask", 0))
    result = complete_hold_draw(rnd["deal"], rnd["remaining"], hold_mask)
    optimal_mask = _best_hold_mask(rnd["deal"])
    opt_cat, opt_poker = _poker_win_same_deck(rnd["deal"], rnd["remaining"], optimal_mask)

    events, idx = _base_events_from_hold(result, start_index=1)
    base_events = [rnd["public"]["state"][0], *events]

    if result["pokerWin"] > 0 and is_double_up_eligible(result["categoryId"]):
        public = _offer_double_up(rnd, base_events, result["pokerWin"], result["category"])
        return {
            "status": {"statusCode": "SUCCESS"},
            "balance": {"amount": sess["balance"], "currency": "USD"},
            "action": public,
            "devWallet": True,
            "debug": {
                "playerHoldMask": hold_mask,
                "playerCategory": result["category"],
                "playerPokerWin": result["pokerWin"],
                "optimalHoldMask": optimal_mask,
                "optimalCategorySameDeck": opt_cat,
                "optimalPokerWinSameDeck": opt_poker,
                "choiceChangedPokerWin": result["pokerWin"] != opt_poker,
                "doubleUpOffered": True,
            },
        }

    _append_settle(base_events, idx, result["pokerWin"])
    public = _lock_round_public(rnd, base_events, result["pokerWin"])
    return {
        "status": {"statusCode": "SUCCESS"},
        "balance": {"amount": sess["balance"], "currency": "USD"},
        "action": public,
        "devWallet": True,
        "debug": {
            "playerHoldMask": hold_mask,
            "playerCategory": result["category"],
            "playerPokerWin": result["pokerWin"],
            "optimalHoldMask": optimal_mask,
            "optimalCategorySameDeck": opt_cat,
            "optimalPokerWinSameDeck": opt_poker,
            "choiceChangedPokerWin": result["pokerWin"] != opt_poker,
            "doubleUpOffered": False,
        },
    }


def handle_action_double_up(sess: dict, rnd: dict, meta: dict) -> dict:
    choice = meta.get("choice")
    if choice not in ("collect", "red", "black"):
        return {"error": "ERR_VAL", "status": {"statusCode": "ERR_VAL", "statusMessage": "choice must be collect|red|black"}}

    events = list(rnd["events"])
    idx = max(e["index"] for e in events) + 1
    step = int(rnd["duStep"])
    current = float(rnd["currentWin"])

    if choice == "collect":
        _append_settle(events, idx, current)
        public = _lock_round_public(rnd, events, current)
        return {
            "status": {"statusCode": "SUCCESS"},
            "balance": {"amount": sess["balance"], "currency": "USD"},
            "action": public,
            "devWallet": True,
            "debug": {"doubleUpCollected": True, "finalWin": current},
        }

    du_rng: random.Random = rnd["du_rng"]
    card, colour, correct = resolve_colour_pick(du_rng, choice)
    amount_after = current * 2 if correct else 0.0
    events.append(
        {
            "index": idx,
            "type": "doubleUp",
            "step": step,
            "card": card_str(card),
            "colour": colour,
            "correct": correct,
            "amountAfter": int(round(amount_after * 100, 0)),
        }
    )
    idx += 1

    if not correct:
        _append_settle(events, idx, 0.0)
        public = _lock_round_public(rnd, events, 0.0)
        return {
            "status": {"statusCode": "SUCCESS"},
            "balance": {"amount": sess["balance"], "currency": "USD"},
            "action": public,
            "devWallet": True,
            "debug": {"doubleUpMiss": True, "playerChoice": choice, "cardColour": colour},
        }

    if step >= LIVE_DOUBLE_UP_MAX_CHAIN:
        _append_settle(events, idx, amount_after)
        public = _lock_round_public(rnd, events, amount_after)
        return {
            "status": {"statusCode": "SUCCESS"},
            "balance": {"amount": sess["balance"], "currency": "USD"},
            "action": public,
            "devWallet": True,
            "debug": {"doubleUpChainComplete": True, "finalWin": amount_after},
        }

    rnd["awaitingDoubleUp"] = True
    rnd["currentWin"] = amount_after
    rnd["duStep"] = step + 1
    rnd["events"] = events
    public = {
        **rnd["public"],
        "payout": 0,
        "payoutMultiplier": 0,
        "active": True,
        "state": events,
        "awaitingDoubleUp": True,
        "doubleUpOffer": {
            "step": step + 1,
            "maxSteps": LIVE_DOUBLE_UP_MAX_CHAIN,
            "amountAtRisk": int(round(amount_after * 100, 0)),
        },
    }
    rnd["public"] = public
    return {
        "status": {"statusCode": "SUCCESS"},
        "balance": {"amount": sess["balance"], "currency": "USD"},
        "action": public,
        "devWallet": True,
        "debug": {"doubleUpSurvived": True, "playerChoice": choice, "cardColour": colour, "amountAfter": amount_after},
    }


def handle_action(body: dict) -> dict:
    sid = body.get("sessionID") or "live-dev"
    action = body.get("action")
    meta = body.get("meta") or {}
    sess = _session(sid)
    rnd = sess.get("round")
    if action != "DECISION":
        return {"error": "ERR_VAL", "status": {"statusCode": "ERR_VAL", "statusMessage": "live wallet only accepts DECISION"}}

    phase = meta.get("phase", "hold")
    if phase == "hold":
        if not rnd or not rnd.get("awaitingHold"):
            return {"error": "ERR_BNF", "status": {"statusCode": "ERR_BNF", "statusMessage": "no awaitingHold round"}}
        return handle_action_hold(sess, rnd, meta)

    if phase == "doubleUp":
        if not rnd or not rnd.get("awaitingDoubleUp"):
            return {"error": "ERR_BNF", "status": {"statusCode": "ERR_BNF", "statusMessage": "no awaitingDoubleUp round"}}
        return handle_action_double_up(sess, rnd, meta)

    return {"error": "ERR_VAL", "status": {"statusCode": "ERR_VAL", "statusMessage": f"unknown phase {phase!r}"}}


def handle_end_round(body: dict) -> dict:
    sid = body.get("sessionID") or "live-dev"
    sess = _session(sid)
    rnd = sess.get("round")
    if not rnd or not rnd.get("locked"):
        sess["round"] = None
        return {"balance": {"amount": sess["balance"], "currency": "USD"}}
    credit = int(rnd["public"]["payout"])
    sess["balance"] += credit
    sess["round"] = None
    return {"balance": {"amount": sess["balance"], "currency": "USD"}, "devWallet": True}


def handle_dev_reset(body: dict) -> dict:
    sid = body.get("sessionID") or "live-dev"
    _sessions.pop(sid, None)
    sess = _session(sid)
    return {
        "balance": {"amount": sess["balance"], "currency": "USD"},
        "devWallet": True,
    }


GET_ROUTES = {"/health": handle_health, "/paytable": handle_paytable}
POST_ROUTES = {
    "/wallet/authenticate": handle_authenticate,
    "/wallet/dev-reset": handle_dev_reset,
    "/wallet/play": handle_play,
    "/bet/action": handle_action,
    "/wallet/end-round": handle_end_round,
}


class Handler(BaseHTTPRequestHandler):
    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "content-type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        handler = GET_ROUTES.get(path)
        if handler is None:
            self.send_response(404)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"error":"not found","devWallet":true}')
            return
        try:
            with _lock:
                payload = handler()
            data = json.dumps(payload).encode()
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(data)
        except Exception as exc:
            _log(f"GET {path} crashed: {exc}\n{traceback.format_exc()}")
            self.send_response(500)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "ERR_INTERNAL", "detail": repr(exc), "devWallet": True}).encode())

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw.decode() or "{}")
        except json.JSONDecodeError:
            body = {}
        handler = POST_ROUTES.get(path)
        if handler is None:
            self.send_response(404)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"error":"not found","devWallet":true}')
            return
        try:
            with _lock:
                payload = handler(body)
            data = json.dumps(payload).encode()
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(data)
        except Exception as exc:
            _log(f"POST {path} crashed: {exc}\n{traceback.format_exc()}")
            self.send_response(500)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "ERR_INTERNAL", "detail": repr(exc), "devWallet": True}).encode())

    def log_message(self, fmt: str, *args) -> None:
        _log(fmt % args)


def main() -> None:
    _ready["pid"] = os.getpid()
    _ready["startedAt"] = time.time()
    threading.Thread(target=_warm_tables_background, daemon=True, name="ie-tables").start()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    _ready["listening"] = True
    _log(
        f"LOCAL DEV WALLET on http://{HOST}:{PORT} pid={os.getpid()}\n"
        "GET /health  POST /wallet/authenticate /wallet/play /bet/action /wallet/end-round"
    )
    try:
        server.serve_forever()
    except Exception as exc:
        _log(f"server loop crashed: {exc}\n{traceback.format_exc()}")
        raise


if __name__ == "__main__":
    main()
