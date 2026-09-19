# Muerta Poker — math audit (2026-09-19): joker = separate bonus card

Change under audit: a **joker (bonus card) is no longer an ordinary poker card**. Before, the golden
cell still counted as a normal card in every hand it sat on. Now it is a separate bonus symbol:

- every payline through a joker cell pays **0** (hand index 0);
- jokers are placed **before** the deal, and floors (JOB / FLUSH guarantee, ante spins, feature spins)
  are checked on **live lines only**, so a floor can never be "satisfied" by a dead line;
- multiplier chips never sit on a joker cell;
- at most one joker per column (unchanged). Trigger rates, joker counts, FS rules: **unchanged**.

**Not changed:** bet prices (25 / 35 / 190 / 5 / 15), hand pay table, multiplier face values and
weights, `linePayScale`, 25 000× cap, trigger rates, `MODE_SCALE` (locked at 1).

## A. What the rule change did to RTP (same books pipeline, old knobs, no re-calibration)

| mode | cost | RTP before (old rule, published) | RTP after rule change, old knobs |
|------|------|-----------------------------------|----------------------------------|
| base | 1 | 96.00% | **87.0%** (−9.0pp) |
| bonus | 25 | 96.00% | **80.9%** (−15.1pp) |
| bonus_job | 35 | 96.00% | **92.5%** (−3.5pp) |
| bonus_flush | 190 | 96.00% | 96.5% (+0.5pp) |
| ante_job | 5 | 96.00% | 95.9% |
| ante_flush | 15 | 96.00% | 96.0% |

So the RTP did move — down, mostly in base and BONUS (jokers sit on the board there and now kill lines).
Ante spins carry no jokers, so they barely moved.

## B. Re-calibration (prices and payouts untouched)

Only the **frequency knobs** were moved — the per-class chance that multiplier chips appear
(`mathConfig.multipliers.chance`). Chip face values / weights are as before.

| knob | before | after |
|------|--------|-------|
| chance.base | 0.18 | 0.364 |
| chance.bonus | 0.2124 | 0.2648 |
| chance.job | 0.20971 | 0.2202 |
| chance.flush | 0.15995 | 0.1590 |
| chance.ante_job | 0.96373 | 0.96485 |
| chance.ante_flush | 0.75064 | 0.75064 |

Note the base chance had to roughly double to make up ~9pp: chips land more often on base spins.
If you would rather keep base chips rare, the alternative is raising trigger frequencies
(a marketing-visible change) — not done here.

`run.py` calibrates with a log-log secant on (chance, RTP) instead of the old damped step, then a
final **LUT weight trim** (`lut_trim.py`): books are finite, so their equal-weight RTP wanders by
a few tenths; each LUT row weight is nudged by a linear tilt to land exactly on 96.000%.
Payout values and book contents are not touched; row weights move by at most ×0.992…×1.011.

| mode | cost | raw books RTP (equal weights) | **published LUT RTP** | hit rate | max in LUT | n |
|------|------|------|------|------|------|---|
| base | 1 | 96.316% | **96.000%** | 77.9% | 1 208× | 50k |
| bonus | 25 | 95.551% | **96.000%** | 100% | 8 071× | 15k |
| bonus_job | 35 | 95.938% | **96.000%** | 100% | 10 964× | 15k |
| bonus_flush | 190 | 95.890% | **96.000%** | 100% | 23 166× | 15k |
| ante_job | 5 | 95.986% | **96.000%** | 100% | 856× | 15k |
| ante_flush | 15 | 95.983% | **96.000%** | 100% | 1 807× | 15k |

Spread 0.000pp; Stake band 90–96.7% OK. No LUT row reaches the 25 000× cap.
Trigger rates in the 50k base books: BONUS 229 (1/218, coded 1/219), JOB 287 (1/174, coded 1/164),
FLUSH 25 (1/2000, coded 1/2056).

## C. Checks

- `pytest tests` — **21 passed** (18 old + 3 new: joker kills only its lines, floors ignore dead lines,
  vector `_eval_lines` with joker mask == scalar `eval_board`).
- LUT payout column == book `payoutMultiplier` for every row of all six modes.
- LUT payouts are byte-identical before / after the weight trim.
- `mathConfig.json`: only `multipliers.chance.*` changed (diff verified: prices, values, weights identical).
- Frontend: `tsc --noEmit` clean, `vitest` 17 passed, `vite build` OK.

## D. Caveats

- Feature-mode books are 15k rounds: their tails are heavy, so the *shipped* RTP is exactly 96.000%
  by construction of the LUT weights, but a fresh regeneration will land a few tenths away before the trim.
- The local demo engine (`engine.ts`, client RNG) is a visual reconstruction; RTP is defined by the books.

Files: `grid_math.py`, `gamestate.py`, `par_sheet.py`, `run.py`, new `lut_trim.py`, `tests/test_grid_math.py`,
`frontend/src/mathConfig.json`, `library/publish_files/*`.

---

# Lightning Poker — math audit (2026-09-12)

Target: every bet mode **~96% RTP** (same number, hard band 90–96.7%, cross-mode spread ≤ 0.50pp).
Max win **25 000×** on every `BetMode`. Pipeline: `run.py` books (base 50k, features 15k) + LUT
scale trim. Locked: 5×5 / 7 lines / `linePayScale` 0.2 / trigger rates / FS rules.

## 0. Recalibration (25k cap · 96% RTP)

`run.py` pass 6 + base LUT mean nudge, lookup tables in `library/lookup_tables/`. Multiplier weights nudged
slightly toward 10–100×; 250×/1000× stay rare. Feature books reroll leftover 25k hits
so equal-weight LUTs do not overweight the cap (live play still caps at 25 000×).
Base books sit at 96.138% before a 1¢-per-row nudge on the largest hits so the
published LUT mean is **96.000%** (spin-only `modeScale` cannot land exactly because
triggered packages keep their own keys). Frontend `baseRoundTrim` 0.998565 matches that.

| mode | cost | modeScale | LUT mean (×) | **full LUT RTP** | P(win=cap) | max in LUT | n |
|------|------|-----------|--------------|------------------|------------|------------|---|
| base | 1 | 1.2132 | 0.960 | **96.000%** | 0 | 1 094× | 50k |
| bonus | 20 | 1.0016 | 19.200 | **96.000%** | 0 | 13 800× | 15k |
| bonus_job | 25 | 0.8109 | 24.000 | **96.000%** | 0 | 21 819× | 15k |
| bonus_flush | 150 | 0.9740 | 144.000 | **96.000%** | 0 | 18 488× | 15k |
| ante_job | 3 | 0.8868 | 2.880 | **96.000%** | 0 | 550× | 15k |
| ante_flush | 10 | 0.8575 | 9.601 | **96.005%** | 0 | 5 145× | 15k |

Spread **0.005pp**. All six in **[96.000%, 96.005%]**. Stake band 90–96.7% OK.
`priceX` = 0.96×cost: 19.2 / 24.0 / 144.0 / 2.88 / 9.6. UI prices unchanged: 20 / 25 / 150 / 3 / 10.

---

# Prior audit (2026-09-11) — 94% / 50k cap

Target then: every bet mode **94.00% RTP** (hard band 93.5–94.5%, cross-mode spread ≤ 0.50pp).
Pipeline: `run.py` books (base 50k, features 15k) + LUT scale trim. Locked: 5×5 / 7 lines /
`linePayScale` 0.2 / trigger rates / 50k cap / FS rules.

## 1. Before (audit, no changes)

Probe (seed 20260911): 20k base spins, 4k BONUS/JOB packages, 2k FLUSH packages, 15k ante JOB, 7.5k ante FLUSH.
`modeScale` and costs as shipped. Scaled EV = raw × then-current scale. RTP vs **charged** `BetMode.cost`.

| mode | raw EV (×bet) | SE | then scale | cost | priceX | priceUiX | scaled EV | RTP vs cost | Δ vs 94% | scale to hit 94% |
|------|---------------|----|------------|------|--------|----------|-----------|-------------|----------|------------------|
| base (spin only) | 0.512 | 0.004 | 1.000 | 1 | 0.94 | 1 | 0.512 | 51.2% | — | n/a (features extra) |
| base (round)* | — | — | mix | 1 | 0.94 | 1 | 0.914 | **91.4%** | −2.6pp | base scale ~1.07 |
| bonus | 20.53 | 3.74 | 0.938 | 20 | 18.8 | 20 | 19.26 | 96.3% | +2.3pp | 0.916 |
| bonus_job | 24.07 | 1.38 | 0.993 | 25 | 23.5 | 25 | 23.89 | 95.6% | +1.6pp | 0.977 |
| bonus_flush | 124.29 | 6.73 | 1.000 | **200** | 188 | 200 | 124.29 | **62.1%** | −31.9pp | **1.51 (out of band)** |
| ante_job | 2.97 | 0.04 | 0.985 | 3 | 2.82 | 3 | 2.92 | 97.4% | +3.4pp | 0.950 |
| ante_flush | 10.01 | 0.60 | 1.000 | 10 | 9.4 | 10 | 10.01 | 100.1% | +6.1pp | 0.939 |

\*Base round = `s_base·E[spin] + p_B·s_B·E[B] + p_J·s_J·E[J] + p_F·s_F·E[F]` with
`p_B=1/160`, `p_J=1/120`, `p_F=1/1500`.

### 1c. Trigger rates (by construction — confirmed)

| event | coded | 300k sample | relative error |
|-------|-------|-------------|----------------|
| 3 goldens BONUS | 1/160 = 0.006250 | 0.006270 | +0.3% |
| 4 goldens JOB | 1/120 = 0.008333 | 0.008193 | −1.7% |
| 5 goldens FLUSH | 1/1500 = 0.000667 | 0.000700 | +5.0% (N small) |
| FS retrigger (3 goldens) | 1/80 = 0.012500 | 0.012223 | −2.2% |

Kind is sampled first, then cells painted — rates are exact in expectation.

### 1d. Wincap seeding (fixed)

Buy-mode LUTs used to inject **equal-weight 50k rows** (`_wincap_dist`, n=1 JOB / n=2 FLUSH).
One 50k in 15k JOB books at cost 25× is **+13pp** LUT RTP; pass-2 then crushed the live scale.
Those distributions are **removed**. `BetMode.max_win` still declares 50k. Natural cap hits stay in the books.

The “ante_job ≈ 92.6%” suspicion mixed `priceX=2.82` (the 94% *payout* target) with scale.
Actual ante_job was **high** (~97%), not low. Charging 3× and scaling so E[win]=2.82 is the correct identity.

### 1e. Parity

`pytest tests/test_grid_math.py` — 18 passed. `cd frontend && npm test` — 23 passed (before and after).

## 2. Decisions

| dial | choice | why |
|------|--------|-----|
| FLUSH buy price | **200× → 150×** | Raw package ~124×. Scale 1.51 needed at 200×, outside [0.90, 1.10]. At 150×, scale lands at **0.962**. Round catalog number. `priceX = 141.0` (= 0.94×150). |
| BONUS / JOB / antes | **keep 20 / 25 / 3 / 10** | Required scales in (or next to) [0.90, 1.10]. |
| `modeScale` | rewritten by `run.py` pass 3 | See after table. |
| Wincap LUT seed | **removed** from buy modes | Equal-weight fake 50k rows are expectancy pollution. |
| Base LUT calibration | **body RTP** when one cap swing > 10pp | Safety net if a jackpot still lands in a short book. |
| Base published books | **reroll wins ≥ 10k×** | One 50k× in 50k equal-weight base rows is +100pp RTP and fails ACP tail / CVaR / σ. True P(cap) on a 1× spin is ~10⁻⁷. Game `maxWin` stays 50k; FLUSH books still hit it. |
| Intensity / weights / paytable | **unchanged** | Price + scale were enough. |

BONUS `modeScale` 1.172 sits **slightly above 1.10**. The 15k bonus book has no 50k hit, so sample EV is low and scale compensates. Keeping UI price 20× (catalog). A longer book would pull this toward 1.0. Not worth a non-round 18× price.

Frontend: `guaranteedSpinPriceX` now reads `mathConfig.anteSpin[kind].priceUiX` (no hardcoded 3/10). Buys already used `priceUiX`.

## 3. After — books / LUT (acceptance numbers)

`run.py` pass 3, lookup tables in `library/lookup_tables/`.

| mode | cost | modeScale | LUT mean (×) | **full LUT RTP** | P(win=cap) | max in LUT | n |
|------|------|-----------|--------------|------------------|------------|------------|---|
| base | 1 | 1.0949 | 0.938 | **93.765%** | 0 | 1 279× | 50k |
| bonus | 20 | 1.1718 | 18.800 | **94.000%** | 0 | 7 296× | 15k |
| bonus_job | 25 | 0.9780 | 23.500 | **94.000%** | 0 | 6 090× | 15k |
| bonus_flush | 150 | 0.9621 | 140.996 | **93.997%** | 2/15000 | 50 000× | 15k |
| ante_job | 3 | 0.9556 | 2.820 | **93.999%** | 0 | 395× | 15k |
| ante_flush | 10 | 0.9425 | 9.400 | **94.000%** | 0 | 1 362× | 15k |

Spread **0.235pp**. All six in **[93.77%, 94.00%]**. Stake band 90–96.7% OK.

ACP 2-star (base after reroll): tail40 **0.225** / 0.800 · tail10k **0** / 0.600 · sum **0.225** / 1.300 · σ/cost **8.97** / 50 · CVaR **188** / 700. All pass. `maxWin` remains 50k on every `BetMode`.

### FS / bank (pre-scale probe, 4k/2k packages)

| package | FS mean | FS max (cap 50) | bank mean | bank p50 | bank p90 | P(cap) in probe |
|---------|---------|-----------------|-----------|----------|----------|-----------------|
| BONUS | 10.67 | 30 | 2.43 | 2 | 6 | 0 |
| JOB | 10.65 | 30 | 3.16 | 2 | 8 | 0 |
| FLUSH | 10.71 | 30 | 5.32 | 4 | 13 | 0 (books later: 2/15k) |

Retrigger +5 at 1/80 gives E[FS] ≈ 10 / (1 − 5/80) clipped by the 50 cap — sample mean ~10.7 matches.

## 4. Price consistency (charged = UI)

| mode | `game_config.py` cost | `mathConfig` priceUiX | `priceX` (0.96×cost) | frontend |
|------|----------------------|----------------------|----------------------|----------|
| bonus | 20 | 20 | 19.2 | `buyBonusPriceX("bonus")` |
| bonus_job | 25 | 25 | 24.0 | `buyBonusPriceX("job")` |
| bonus_flush | **150** | **150** | **144.0** | `buyBonusPriceX("flush")` |
| ante_job | 3 | 3 | 2.88 | `guaranteedSpinPriceX("job")` |
| ante_flush | 10 | 10 | 9.6 | `guaranteedSpinPriceX("flush")` |

`gamestate.MODE_COST` and `par_sheet.MODE_COST` match. `run.py` writes `params.modeScale` into `mathConfig.json`.

## 5. Risks

- **Base jackpots in a 50k book.** A single 50k× row is +100pp equal-weight RTP and fails ACP. Published base books now reroll any win ≥ 10k× (`BASE_BOOK_WIN_CAP`). The ~0.4pp of true base-cap EV is not in the 50k sample; FLUSH buys still carry the 50k cap.
- **FLUSH variance.** 2 natural caps in 15k books (~5pp of that mode’s EV). Scale 0.962 absorbs them. A quieter 15k seed would need a slightly higher scale.
- **BONUS scale 1.17.** Sample has no clip; longer books would likely lower the scale. UI price stays 20×.
- **Flush floor CPU.** FS flush still uses `floorRerolls.flush=800` (not `flush_package: 50`) in `gamestate._fs_spin`. Locked this pass; worth a follow-up if book time matters.
- **Cap cost inside FLUSH buys.** Two 50k hits in 15k is ~0.67× of mean at cost 150 (0.4% of turnover). Not a pricing bug after the 150× move.

## 6. Files touched (math / prices only)

- `game_config.py` — FLUSH cost 150; wincap distributions detached from buy modes
- `gamestate.py` — `MODE_COST`, body LUT RTP, clipped pass-2 factor, `BASE_BOOK_WIN_CAP` reroll
- `par_sheet.py` — `MODE_COST` 150
- `run.py` — up to 3 LUT trim passes
- `frontend/src/mathConfig.json` — prices + `modeScale` from pipeline
- `frontend/src/game/engine.ts` — ante price from `mathConfig`
- `frontend/tests/engine.test.ts` — flush 150×
- `AGENTS.md`, `README.md`, `UPLOAD.md` — published costs
