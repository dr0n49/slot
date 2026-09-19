# 5×5 poker-grid — paste into ZCode / GLM chat

Open workspace: `/Users/andriinorenko/slot/math-sdk/games/poker_mult_slot`

Mode: **Plan mode first** · Thought: **Max** · Model: **GLM-5.3** (or whatever GLM is selected)

Do **not** edit files until I approve the plan. After approval, implement in small diffs.

---

You are converting Lightning Poker from a **single 5-card hand** into a **5×5 card grid slot**. This is a layout + calibration change, not a new game and not a fruit slot.

## Why

Stake Engine reviewers killed the current build as **Weak Burst / Originals poker**. Originals already owns 1-hand video poker. Engine wants a **feature slot**. Same cards, multipliers, JOB/Flush bonus — but the spin must read as a **grid with paying lines**, not “deal me a poker hand”.

## Locked product (do not invent a different game)

Keep:

- Card ranks/suits, Jacks-or-Better paytable names + `evaluateHand()`
- Win rule: **hand pay × multipliers** (multipliers SUM on the line; they never add to hand pay). Cap **50,000×**
- Golden scatters: **3 = JOB**, **4–5 = Flush** → **10 free spins**; bonus bank × accumulates across FS
- Buy: JOB **60×**, Flush **300×**. Ante: SPIN JOB **3×**, SPIN FLUSH **10×**
- HUD, buy modal, bonus banner, storm FX, i18n, RGS, social mode, mobile **lite FX** (`frontend/src/game/fxMode.ts` — no WebM rain/thunder on iPhone)
- Art direction / CSS card faces — **no new asset pack**, no fruit symbols, no 5×3 reel strip

Stake Engine hard rules:

- **Stateless** — no hold/draw, no gamble, no persistent meter across bets, no cashout
- Mode RTPs in **[90%, 96.7%]** and **within 0.5% of each other**; target **96%** (UI 96%)
- Do not break `run.py` / books / LUT pipeline

## Grid and lines (exact)

Board: **5 rows × 5 cols** = 25 cards. Index `r * 5 + c` (row-major).

**Paylines — only these 7.** No verticals. No zigzags. No ways. No clusters.

```
H0: 0,1,2,3,4
H1: 5,6,7,8,9
H2: 10,11,12,13,14
H3: 15,16,17,18,19
H4: 20,21,22,23,24
D0: 0,6,12,18,24        (main ↘)
D1: 4,8,12,16,20        (main ↙)
```

Each line is a **5-card poker hand**. Evaluate with existing `evaluateHand`.

**Payout for one spin:**

```
spinWin = Σ over the 7 lines:
  if handPay(line) > 0:
    handPay(line) * max(1, sum of × sitting on that line’s 5 cells)
  else 0
then cap at 50_000×
```

A cell’s multiplier (if any) counts **only for lines that include that cell**. Golden cells do not also carry × (same as today).

Multiple lines may win at once. Highlight **all** winning line cells (union of `winIndices`). Optionally draw 7 thin line traces on win — keep it readable on a phone 5×5.

## Math — honest grid, then calibrate (critical)

**Do not** sample 7 independent hands with the old 1-hand hit rates. Shared cells make that inconsistent, and RTP would explode (~7×).

**Required model:**

1. Deal **25 cards** onto the grid from a shuffled **52-card deck** (if you run out, shuffle a second deck — document it). Prefer 1 deck: 25 unique cards.
2. Evaluate the 7 lines for real.
3. Place multipliers on non-golden cells with the existing value table; **retune chance/intensity** so 7 lines don’t 7× EV.
4. Place goldens with a **per-cell probability** (or equivalent) retuned so trigger rates stay near current:
   - JOB (exactly 3 goldens, or ≥3 and <4): ~**1/120**
   - Flush (≥4 goldens): ~**1/1500**
   - 0–2 goldens = tease only
5. Recalibrate `base_pay_scale` / new `linePayScale` / `MODE_SCALE` so every mode lands ~**96% RTP**.
6. Bonus FS: **same 5×5 + 7 lines**. JOB/Flush **floors** from today must be reinterpreted without breaking RTP:
   - **JOB FS / ante JOB:** each spin should feel juicier than base (higher pair+ rate and/or more ×), not “7 guaranteed JOB hands” (that overpays at 3× / 60×).
   - **Flush FS / ante Flush:** higher flush+ rate and/or more × — not 7 guaranteed flushes unless you prove 10× / 300× still hit 96%.
   - Prefer: biased deal or limited rerolls (cap rerolls) + existing intensity knobs. Document the rule in `mathConfig.json` comments / README.

Update in lockstep:

- `par_sheet.py` (Monte Carlo + export)
- `frontend/src/mathConfig.json`
- `gamestate.py` (must match FE sampling)
- `game_config.py` only if mode costs/names change (**they should not**)

Do **not** invent a new paytable. Keep `hands.pays`. Scale globally if needed.

After math changes, say whether `python run.py` must be re-run for books. If yes, run it (needs repo venv + `PYTHONPATH=../..`).

## Frontend

Replace `CardRow` (one row of 5) with a **5×5 grid** that still uses the same card-face CSS (`card-face`, `bonus-card`, `card-win-ring`, `mult-chip`).

- Phone: cells must fit above the HUD without overflow. Prefer compact tiles (~40–48px) on narrow widths; keep current card size on `sm+`.
- Deal stagger: short delay per cell (turbo faster). Do not 25× the old 140ms delay (too slow).
- Win: outline winning cells; show best / total win as now. If several lines hit, show the **total** in the win field; hand name = best line (existing names).
- `App.tsx` / `engine.ts`: `cards: Card[25]`, `multipliers` length 25, `winIndices` any of 0..24, plus `lines?: { id, indices, handIndex, handPay, multFactor, winX }[]` for debug/UI.
- Rules copy (`i18n/en.ts` + packs): describe **5×5, 7 lines (5 horizontal + 2 long diagonals)**. Do **not** lead with “video poker hand”. Frame as a lightning card slot. Keep Poker in the title unless a one-line rename is trivial (`Lightning Grid` / keep Lightning Poker — **keep title**, change rules text).
- Do **not** regress `fxMode` lite path, LoadingSplash timeout, or mounting `CosmicBackground` only after loading+intro.

## Out of scope (reject these ideas)

- Vertical paylines, 20+ slot lines, ways, clusters
- Hold / discard / draw
- New bonus type, new buy prices, jackpots
- Replacing cards with slot symbols
- Rewriting rain WebM / new art
- Refactors unrelated to the grid

## Plan you must deliver first

1. Current vs 5×5 data flow (mermaid): `par_sheet` → `mathConfig` → `engine.ts` → `App` → books.
2. Exact golden + multiplier + bonus-floor rules (formulas).
3. RTP plan: which knobs you turn, how you verify 96% and 0.5% band.
4. File list + sequence (math export → engine → grid UI → i18n → gamestate).
5. Risks: overlapping lines, tiny mobile cards, bonus overpay, Engine book event shape if you add `board` events (optional; today books mostly emit `winX` — don’t break LUT).
6. Test plan: unit tests for `evaluateHand` on the 7 index sets; one fixture board with known multi-line win; `par_sheet` short MC; `npm run dev` screenshot of 5×5.

Wait for approval. Then implement.

## Acceptance

- One spin shows a **5×5** of cards, not one row of five
- Horizontal and both long diagonals can pay in the **same** spin
- Bonus / buy / ante / bank / cap / lite-mobile FX still work
- Display RTP 96%; math target unchanged in spirit
- No new vendor assets
