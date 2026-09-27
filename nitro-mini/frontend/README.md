# NITRO VEIN

A 5 × 6 cascading ways slot for Stake Engine: a cursed gold mine, a **Blast Ladder** that
climbs with every cascade, and TNT kegs that blow the ladder open. Built on the Stake Engine
web-sdk (SvelteKit + Svelte 5 + Pixi 8) and the math-sdk (Python + Rust optimiser).

The frontend **only presents** what the RGS returns. Every win, cascade, ladder step and free spin
comes from a math-sdk *book*; the UI never decides an outcome.

## Game in one minute

* 5 reels × 6 rows, **ways pay** — 4 or 5 matching reels from the leftmost reel, adjacent positions.
* Symbols: 5 low gems (`L1–L5`), 4 high relics (`H1–H4`), **Wild** (reels 2–5), **Scatter** (dynamite),
  **Nitro Keg** (`K`), **Bedrock** (`R`, never pays, never removed — it only falls with gravity).
* **Cascades:** winning symbols explode, the rest fall, new symbols drop in until nothing wins.
* **Blast Ladder** (`×1 … ×100`): every winning cascade step is paid at the current rung, then the ladder
  climbs one rung. Each **Keg** on the board detonates on a winning step and lifts it one extra rung.
  Resets every spin in the base game.
* **Free spins – "Deep Vein":** 3 / 4 / 5 scatters → 8 / 12 / 16 spins. The ladder **never resets** between
  spins and has a taller track (up to ×100). Retrigger 3 / 4 / 5 → +4 / 6 / 8 spins.
* **Bonus buy:** 100 × bet. **Max win:** 10,000 × bet. **RTP:** 96.0 % in both modes.
* Win tiers (from the book's `winLevel`): Big ≥ 20×, Mega ≥ 50×, Massive ≥ 200×, Max = wincap.

## Folder map

```
apps/nitro-vein/
  src/game/            game logic — no Svelte markup in here
    config.ts            static config (paytable, ladder …) generated from the math
    mathConfig.generated.ts   written by math-sdk `export_frontend.py` — display only
    typesBookEvent.ts    the book event contract (reveal, winInfo, kegBlast, tumbleBoard …)
    bookEventHandlerMap.ts    one handler per book event → presentation
    boardLogic.ts        pure board / tumble bookkeeping (unit-tested)
    stateGame.svelte.ts  presentation phase machine  IDLE → SPINNING → RESOLVING → WIN_PRESENTATION
                         → CASCADE → FEATURE → COMPLETE  (+ ERROR)
    roundFlow.ts         beginSpin / endRound / recoverFromError (never a dead end)
    presentation.ts      timing, win counter, big-win tiers, skip / turbo
    errors.ts            RGS / network error → player-facing message
    sfx.ts               audio (categories, pooled one-shots, loops, bgm cross-fade)
    engine/              Pixi scene: board, symbols, reels, particles, tween scheduler
  src/components/      Svelte UI: HUD (stats, bet, spin, auto, turbo, buy), overlays, dialogs
  static/assets/       art, sounds, fonts (all self-hosted)
  dev/                 development-only mock RGS + sampled books (never shipped)
```

Layers, top to bottom: **presentation** (`engine/`, `components/`) → **game state** (`stateGame`, xstate bet
machine from `utils-xstate`) → **integration** (`rgs-requests`, `bookEventHandlerMap`) → **math** (math-sdk books).
Nothing above the math layer contains a probability, weight or payout rule.

## Run it

```bash
# once, from the web-sdk root
pnpm install
pnpm --filter pixi-svelte build          # pixi-svelte ships as a built package

# against a real RGS (Stake Engine dev launcher):
pnpm --filter nitro-vein dev

# fully local, no RGS needed (HTTPS mock that serves real math-sdk books):
pnpm --filter nitro-vein dev:mock
#  → https://localhost:3007/?sessionID=dev&rgs_url=localhost:3007/mock-rgs
```

The mock RGS lives in `dev/mockRgs.js` and reads `dev/mock-books.json.gz`, a weighted sample of the
published books plus a few QA books per category. Regenerate it after changing the math:

```bash
cd math-sdk && python games/nitro_vein/export_mock_books.py
```

Handy QA hooks (mock only), all plain GETs under `/mock-rgs/__qa/`:

| URL | Effect |
| --- | --- |
| `force?cat=fs` / `big` / `mega` / `massive` / `max` | next spin returns a book of that category |
| `book?id=2396` | next spin returns exactly that sampled book |
| `fail?kind=http` / `invalid` / `slow` / `balance` | next spin fails in that way |
| `balance?amount=0.5` | set the balance |
| `reset` | reset balance, forced book, failures |

Add `&e2e=1` to the game URL to expose the read-only `window.__nitro` diagnostics handle.

## Math (math-sdk)

The game lives in `math-sdk/games/nitro_vein/`; `math_params.py` is the single source of truth (RTP, paytable,
reel weights, ladder, free-spin tables, win levels, win cap, distribution quotas). Nothing else hard-codes a
number.

```bash
cd math-sdk
python games/nitro_vein/build_reels.py                      # strips from the weights (deterministic)
python games/nitro_vein/run.py                              # simulate → optimise → publish books + LUTs
python games/nitro_vein/export_frontend.py                  # writes mathConfig.generated.ts for the UI
PYTHONPATH=. pytest games/nitro_vein/tests -q               # invariants + independent replay of the books
```

`run.py --modes base` / `--base N` / `--bonus N` / `--no-opt` narrow a run. The published books are large
(≈ 64 MB base, 80 MB bonus, compressed), so they are **generated, not committed**; generation is deterministic.
Upload `library/publish_files/*` to the Stake Engine dashboard (`index.json`, the two `.jsonl.zst` books and the two
lookup tables).

## Tests

```bash
pnpm --filter nitro-vein test       # vitest: tumble bookkeeping, error mapping, and every sampled book replays cleanly
pnpm --filter nitro-vein check      # svelte-check
pytest games/nitro_vein/tests       # math (see above)
```

## Behaviour worth knowing

* **Failure handling:** a failed spin, an invalid book, an insufficient balance, a dropped connection or an
  expired session all end in the game's own error dialog and a clean `IDLE` — the reels never keep spinning and
  the player can always spin again. A reload in the middle of a round resumes it from the RGS.
* **Skip / turbo:** tap SPIN (or Space) during a round to skip the animation; Turbo shortens every phase.
  Background tabs fast-forward presentations instead of stalling them.
* **Performance:** particle systems are pooled and capped (fewer on mobile / low DPR) and the device pixel ratio is capped.
* **Accessibility:** every control is a real, labelled button; dialogs open with focus on their primary action and close with
  Esc; Space spins; `prefers-reduced-motion` switches off the looping CSS animations.
