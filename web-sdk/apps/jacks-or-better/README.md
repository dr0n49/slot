# Jacks or Better 7/5 — test project notes

Frontend: `web-sdk/apps/jacks-or-better`  
Math (frozen): `math-sdk/games/jacks_or_better`  
Unit tests: `games/jacks_or_better/tests`

Do not change the paytable, optimal-hold strategy, double-up cap, or book/LUT weights without an explicit ask. The numbers below are the source of truth; they do not need to be re-derived for ordinary frontend work.

## Frozen math

**Paytable** (7/5 Jacks or Better, multipliers of 1× stake):

| Category | × |
|---|---|
| Royal Flush | 800 |
| Straight Flush | 50 |
| Four of a Kind | 25 |
| Full House | 7 |
| Flush | 5 |
| Straight | 4 |
| Three of a Kind | 3 |
| Two Pair | 2 |
| Jacks or Better | 1 |
| Nothing | 0 |

**Double-up:** mandatory even-money red/black, `n = 2`, fresh 52-card deck, P(correct) = 1/2. Combined EV of the chain is exactly 1, so it does not change poker RTP. Surviving both stages multiplies the poker win by 4. Max win = 800 × 4 = **3,200×**.

**LUT vs combinatorics (δ = 0):**

| Metric | Value |
|---|---|
| RTP | **96.1472094886%** — exact fraction `24570826799 / 25555423740` |
| Hit rate | **11.3741932760%** (1 in 8.7918) — poker hit / 4 |
| Max win | **3,200×** — frequency 1 in 160,688.53 |
| Approval | RTP in [90, 98], hit ≥ 1/20, max-win freq ≥ 1/10M — all PASS |

`payoutMultiplier` and book `amount` fields are in hundredths of 1× (3200× → `320000`).

Books: `math-sdk/games/jacks_or_better/library/publish_files/`. `auto_close_disabled=True` so a win stays open until Collect / `/wallet/end-round`.

## No live decision

The book is selected and locked at `/wallet/play`, including `payoutMultiplier`. The client only plays `events[]`.

- **Hold** is pre-selected (`holdMask`). Draw continues playback; the player cannot change holds.
- **Double-up** colour is pre-determined. Reveal continues playback; it is not a red/black choice.
- **Collect** settles a locked win. It does not change the paid amount.
- **Resume** (`POST /bet/event`) sends only `{ sessionID, event: "<index>" }`. That restores playback position. It cannot alter `payoutMultiplier` or any event payload.

Round states: `idle` → `betPlaced` → `initialDeal` → `holdSelection` → `draw` → `handResult` → `doubleUpRound` (0, 1, or 2 stages) → `settled` (plus `error` / `timeout`).

## Frontend

Storybook (port 6001): `cd apps/jacks-or-better && pnpm run storybook`  
Real-book stories: `MODE_BASE/book/real_*`. Mocked stories from earlier steps are labeled `*_MOCKED`.

The round-state HUD and generated-book source labels are gated on `PUBLIC_CHROMATIC` (Storybook sets this). They are not active in a normal app build. There is no 20ms HUD poll in the game — that was a one-off Storybook verification script.

Engine UI kit is used for chrome (bet, balance, win). Cards and the double-up reveal are game-specific Pixi.

## Tests

There is no frontend unit-test suite in this app. Math:

```bash
cd games/jacks_or_better
# from ~/slot
.venv/bin/pytest -v
```

Includes evaluator, combinadic, solver, double-up (`n=2`), exact LUT weights, and `test_ie_matches_brute_on_sample_hands` (marked `slow`).
