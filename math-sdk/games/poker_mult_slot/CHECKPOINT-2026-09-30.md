# Muerta Poker — checkpoint, 30 September 2026

**Paused at the user's explicit request: “сделай чекпоинт, продолжим как скажу”. Do not resume implementation, generation, purchases or submission until the user says to continue.** No background agents are working; no generation or browser audit is running.

## Current checkout

- Workspace: `/Users/andriinorenko/slot/math-sdk/games/poker_mult_slot`.
- Git root: `/Users/andriinorenko/slot`; current branch: `codex/phase-2i-anticipation-colour`.
- This checkpoint preserves the unfinished colour change in `frontend/src/components/PixiSlot.tsx`. TypeScript and all 39 tests pass. Browser rendering, colour sampling, performance, GIFs and a production build for this change **have not been run**. It is not a completed parity phase.
- Preserve unrelated working-tree changes. In particular, `frontend/src/game/audio.ts` was already dirty and is excluded from the checkpoint. Other existing changes outside this game are also excluded.

## Decisions and non-negotiable gates

- Full Pixi migration is approved. Godot remains the production default and automatic fallback until full parity. Stop and show parity to the user before deleting the Godot export.
- React is the only wallet owner. Keep the single presentation hold, visible counter, actual `resultReady/closeRevealGate`, reversible wallet-wait travel, exact rejection rollback and skip-to-final behavior. No guessed result while waiting for a wallet response.
- Preserve Godot's landing grammar: continuous actual strip phase, +0.03-cell overshoot, 70 ms settle, 1.04/0.97 squash, column/row stagger, 0.8/2.2 shake and 5.0 only for Joker landings, one stop sound per visible column collision.
- No math, payouts, bonus costs, RTP, thresholds or cap changes. Joker poker lines remain dead; no multiplier on a Joker. FS bank starts at ×3. No resubmission until full renderer/art/audio integration and real-phone play.
- One branch/commit per phase or sub-phase; reread edits. Desktop and 390×844 GIFs for completed engineering sub-phases. The current user-requested checkpoint is intentionally unfinished.
- Art: Queen A, bone/ink/gold and one-engraver treatment. Keep the Reaper; no dealer/mascot. Ranks, pips and indices are vectors. New deck installs as one complete set.

## Completed renderer work

- Phase 0.5 preserved: `fc2e255`; renderer slice: `c67e6d1`; continuous landing: `2ec6c07`.
- `95183ab`: live Pixi board connected to existing React flow, opt-in `?renderer=pixi`, real 25-card payload and actual painted-board settlement; Godot fallback retained.
- `300e3d9`: two-Joker anticipation, actual strip slowdown, column frames, delayed Joker pulse, normal/turbo/reduced behavior and lifecycle checks.
- `79d3954`: normal MAX ~8.97 s, turbo ~2.015 s, reduced final state, first two hand focus beats then all, Space/resize skip, capped particles, bone/gold treatment, no side mascot.
- `4c78ddb`: complete BONUS/JOB/Flush buys and both Ante modes; 30 social mobile-lite rounds cover all 52 identities and Joker. Autoplay completes exactly 10, and stop during the next batch's third round lets it finish without a fourth request. Fixed cumulative bonus WIN counting from zero at each increment. All features verify monotonic visible totals and no increase before their actual settled revision. Local mock wallet payouts only; no real money traffic.
- `38530a1`: total summary count 1600 ms, ≥350 ms final hold, first tap/Space resolves to exact amount, later tap exits; reduced/resize/visibility resolve correctly; one lock sound. Portrait hint centered and clears WIN by 8 px.

Evidence folders: `reports/phase2c-live-pixi-2026-09-30`, `phase2e-anticipation-2026-09-30`, `phase2f-presentation-2026-09-30`, `phase2g-features-2026-09-30`, `phase2h-reward-closure-2026-09-30`. Start with the phase markdown and compact metrics; full traces are large. Full features measured ~59.6–59.9 FPS / p95 16.7 ms in desktop Chrome. This is not real-phone acceptance. MAX runs are component auditions; separate NICE and full-feature runs use the real engine.

## Unfinished renderer work — next after resume

1. Finish and audit the current anticipation colour change. The old `0xbcbcbc` tint darkened but did not desaturate. The preserved edit uses a shared `ColorMatrixFilter` matching Godot's `mix(rgb, dot(rgb,[.299,.587,.114])*.55, .58)` and leaves alpha unchanged. Card bodies are separate from multiplier plates, so plates are not dimmed; Jokers remain undimmed. Filter lifecycle cleanup is included. Need actual browser colour/lifecycle checks, shader first-use/performance checks, desktop/portrait GIFs and build. No prewarming has been added yet.
2. Strict accepted-press raster feedback ≤50 ms is still **OPEN**. The last actual App 1200 ms mock-wallet runs measured 27.30 ms accepted and 50.90 ms rejected. Earlier runs also had >50 ms values. Do not claim this gate passed from averages or a selected run. Current scene uses a 4 px reversible compositor nudge, briefly pauses WebGL for two animation frames, and transfers that nudge into real strip phase on result arrival. Input/wallet ownership must remain in React.
3. Complete remaining presentation/parity review, including approved FS intro/multiplier-bank beats and final production debug-hook cleanup. Full feature-flow coverage alone is not full visual parity. Godot must remain until the user reviews parity.

## Art approval state

- Queen A approved. All 12 courts approved after K♥/K♦ neck-bone corrections; sources and native proofs in `reports/phase2b-courts-2026-09-30`.
- Four vector aces approved by continuation after removing the central oval and ticks. Sources/proofs in `reports/phase2b-aces-2026-09-30`; commit `6f85108`, approval records updated later.
- **Card back approved explicitly by the user: “Утверждаю — переходите к рамке”.** Commit `48ccc43`, folder `reports/phase2b-card-back-2026-09-30`. The revised back has two scythes; the rejected face-like folds are archived. Built-in image generator, Queen A direct reference, original 1058×1487 and 512×720 master, exact 86×121 / 60×85 proofs and prompts preserved. No runtime installation.
- **Next authorized art group after resume: frame.** Generate it using Queen A as the style reference and existing board geometry; show at actual desktop/portrait display size for approval. Then backgrounds → bunting → candles → plaque, each group approved before the next. No frame or later art has been generated yet.

## Audio

- Licensed-pack route chosen; user declined an ElevenLabs purchase. No purchase or upgrade is authorized or performed.
- Recommended sources: Epic Stock Media Board Game Sound Effects Kit plus Image Sounds Nylon Guitar Latin & Spanish Styles. Actual owned/licensed source files and license evidence are still missing. Do not treat the recommendation or private auditions as a licensed production bank.
- `33da434`, `reports/phase2d-audio-bank-2026-09-30`: exact 42-event `event-bank.json`, `export-list.csv` and mastering/loop handoff. Full edited bank, integration and 10-minute seamless-loop verification remain pending licensed sources.
- Identity: D minor, 100 BPM, D-A-C-D; nylon, bell, bone/wood, brushed drum, muted brass. Mix/duck rules and true peak ≤−1 dBTP remain binding. Do not put credentials into source, checkpoint files or output.

## Resume hygiene

Read this checkpoint and current files before continuing; inspect git state and preserve unrelated changes. Existing local previews may remain open, but they are not background work. No deployment, submission, purchase, wallet ownership transfer, new deck installation or Godot removal has occurred. Await the user's explicit continuation.
