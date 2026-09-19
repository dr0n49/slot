# Live-hold mode — local dev wallet (NOT approval-ready)

This is a **learning/demo branch**. It is **not** Stake Engine, **not** RGS-compliant, and **not** the shippable Jacks or Better game.

The frozen `base` mode (published books, LUT, Storybook `real_*` / `*_MOCKED`, 96.1472094886% RTP) is unchanged. Do not treat this file as a replacement for `README.md`.

## What this is

A local stateful wallet (`games/jacks_or_better/live_wallet/server.py`) that mimics wallet URL shapes for **live card-hold** and **optional player double-up** (Flush+ only):

1. `GET /health` — returns `readyForPlay: true` as soon as the HTTP server is listening (before contain-sum tables finish warming). The Storybook client polls this before the first Action click and shows **wallet starting up…** instead of a raw fetch error.
2. `POST /wallet/play` — debit, deal 5 cards, store remaining deck + double-up RNG **server-side**. Returns `payoutMultiplier: 0`, `state: [deal]`, `awaitingHold: true`.
3. `POST /bet/action` `{ "action": "DECISION", "meta": { "phase": "hold", "holdMask": 0–31 } }` — player hold, draw from stored deck, evaluate 7/5. Hands **below Flush** settle immediately. **Flush or better** with a win enters `awaitingDoubleUp` (no payout locked yet).
4. `POST /bet/action` `{ "action": "DECISION", "meta": { "phase": "doubleUp", "choice": "collect"|"red"|"black" } }` — **collect** locks current win; **red/black** draws one card from a fresh 52-card deck (after the choice) and doubles on a match (fair coin). Up to **n=2** stages (same cap as frozen mandatory chain). Miss → 0.
5. `POST /wallet/end-round` — credit the locked amount.

Default: `http://127.0.0.1:8787`

```bash
cd games/jacks_or_better
../../.venv/bin/python live_wallet/server.py
```

Storybook: `MODE_LIVE/book/liveHold_localWallet` — **Bet** (or **Auto Spin**) starts a live round after `/health` is ready. Click cards to hold, then **Submit hold — Draw**. Flush+ wins show **Collect / Pick Red / Pick Black**.

Verify script:

```bash
cd games/jacks_or_better
../../.venv/bin/python live_wallet/verify_double_up.py
```

## What this is not

The OpenAPI field is **`POST /bet/action`** with `action: "DECISION"`, not `/wallet/action`. Published books still lock `payoutMultiplier` on `/wallet/play`. This local server **pretends** to be that missing game runtime.

## Approval guarantees that are lost

| Frozen / approval-ready | This live-hold mode |
|---|---|
| Displayed RTP from a fixed LUT (96.1472094886%, δ=0 vs combinatorics) | **Lost.** Realized RTP is player-skill-dependent. |
| Non-editable hold (book `holdMask`) | **Lost.** Hold is a live decision. |
| `payoutMultiplier` locked at `/wallet/play` before any click | **Lost.** Lock happens after hold (and optional double-up choices). |
| Mandatory n=2 double-up on every win | **Lost in live mode.** Only Flush+ offered; player may collect anytime; colour is a real DECISION. |
| `/bet/event` cannot change the outcome | Frozen mode: still true. Live mode: **`DECISION` changes the outcome.** |

The HUD after Draw shows `player poker × vs optimal-same-deck ×` (debug only). Remaining deck and RNG seed are never in the JSON.

## Double-up EV note (live mode only)

Per stage, red/black is a fair 50/50 coin: **EV(continue) = EV(collect) = current win**. Collect-anytime removes forced variance from the old mandatory n=2 chain — a rational player is never worse off in EV by collecting vs gambling one stage. Realized RTP from double-up still depends on player behaviour (risk appetite), not combinatorial LUT math.

## RTP note

Combinatorial 96.1472094886% is the RTP of **optimal hold + frozen double-up rules**. This mode does not use the LUT and does not enforce optimal holds or mandatory double-up.
